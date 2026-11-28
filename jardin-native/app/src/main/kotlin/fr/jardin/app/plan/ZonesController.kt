package fr.jardin.app.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import fr.jardin.core.CircleShape
import fr.jardin.core.Garden
import fr.jardin.core.Point
import fr.jardin.core.PolygonShape
import fr.jardin.core.Shape
import fr.jardin.core.Zone
import fr.jardin.core.defaultZoneHeight
import fr.jardin.core.distance
import fr.jardin.core.getZoneType
import fr.jardin.core.heightMessage
import fr.jardin.core.checkHeight
import fr.jardin.core.setPoolVariant
import fr.jardin.core.zoneHeightKind
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.ZoneDims
import fr.jardin.core.plan.ZoneDraft
import fr.jardin.core.plan.ZoneEdit
import fr.jardin.core.plan.ZoneHandle
import fr.jardin.core.rotationOf
import kotlin.math.abs

/** Fenêtre de saisie en cm ouverte sur le plan. */
sealed interface ZnPop {
    /** Appui long avec un type choisi : saisie des dimensions de la nouvelle zone posée en `at`. */
    data class Create(val at: Point) : ZnPop
    data class Dims(val id: String) : ZnPop
}

/**
 * État et gestes de l'étape « Dessin des zones » (port de `mountZoneEditor`). Les opérations (création, déformation,
 * rotation, dimensions, avertissements) sont dans `fr.jardin.core.plan.ZoneEdit` ; ici on relie gestes, sélection et historique.
 */
class ZonesController(gardenOf: () -> Garden?, updater: ((Garden) -> Garden) -> Unit) : PlanEditor(gardenOf, updater) {
    var typeId by mutableStateOf<String?>(null); private set
    var kind by mutableStateOf<String?>(null); private set
    /** `true` = rectangle par deux coins, `false` = forme libre (polygone). */
    var rectMode by mutableStateOf(true); private set
    var lineWidth by mutableStateOf(1.0)
    var sel by mutableStateOf<String?>(null); private set
    var drawing by mutableStateOf<ZoneDraft?>(null); private set
    /** Cercle : centre posé, on attend le point du bord. */
    var circleCenter by mutableStateOf<Point?>(null); private set
    var ghost by mutableStateOf<Point?>(null); private set
    var snapMark by mutableStateOf<Point?>(null); private set
    var pop by mutableStateOf<ZnPop?>(null); private set
    var rotSnap by mutableStateOf(true); private set
    var rotLive by mutableStateOf<Double?>(null); private set
    var dragging by mutableStateOf(false); private set
    var naming by mutableStateOf(false)
    var detailOpen by mutableStateOf(true)

    val selZone: Zone? get() = ZoneEdit.zoneById(garden, sel)

    val helpText: String get() = msg.ifEmpty {
        ZoneEdit.help(garden, typeId, kind, rectMode, drawing, circleCenter != null, selZone)
            .let { if (kind == "line" && typeId != null) "Touchez chaque point de la ligne puis « Terminer ». Largeur : ${LengthInput.frLen(lineWidth)}. Appui long : saisir les mesures." else it }
    }

    // ------------------------------------------------------------------ choix du type et de la forme

    private fun stopDrawing() { drawing = null; circleCenter = null; ghost = null; snapMark = null }

    fun chooseType(id: String) {
        val t = getZoneType(id) ?: return
        stopDrawing(); sel = null; naming = false; pop = null; say("")
        if (typeId == id) { typeId = null; kind = null } else { typeId = id; kind = t.shapeKinds.first(); rectMode = true; lineWidth = t.defaultWidth ?: 1.0 }
    }

    fun chooseKind(k: String) { kind = k; stopDrawing(); say("") }
    fun chooseRectMode(rect: Boolean) { rectMode = rect; stopDrawing() }
    fun cancelDrawing() { stopDrawing() }
    fun stopType() { typeId = null; kind = null; stopDrawing() }

    /** Choix dans la liste des zones : abandonne le type en cours puis sélectionne la zone. */
    fun pickZone(id: String) { stopType(); select(id) }

    fun select(id: String?) { sel = id; naming = false; pop = null; say("") }
    fun closePop() { pop = null }
    fun openDims(id: String) { pop = ZnPop.Dims(id) }

    val canFinish: Boolean get() = drawing.let { it != null && !it.rect && it.points.size >= (if (kind == "line") 2 else 3) }

    fun finishDrawing() {
        val d = drawing ?: return
        val r = ZoneEdit.finish(d, lineWidth)
        if (r.message != null) say(r.message!!)
        r.finished?.let { stopDrawing(); addZone(it) }
    }

    fun undoPoint() { drawing?.let { d -> if (!d.rect && d.points.isNotEmpty()) drawing = d.copy(points = d.points.dropLast(1)) else if (d.rect) drawing = null } }

    private fun addZone(shape: Shape) {
        val t = typeId ?: return
        val (_, z) = ZoneEdit.addZone(garden, t, shape)
        mutate { it.copy(zones = it.zones + z) }
        sel = z.id; naming = true; typeId = null; kind = null; ghost = null; snapMark = null
        say(ZoneEdit.addedMessage(z.label, shape))
    }

    private fun snap(w: Point, exclude: List<Point> = emptyList()): Point {
        val g = garden
        val p = ZoneEdit.snapAt(g, w, tol(14.0), grid, exclude)
        snapMark = p
        return p
    }

    // ------------------------------------------------------------------ gestes

    fun onDown(w: Point): PlanDrag? {
        pop = null
        val t = typeId
        if (t != null) {
            say("")
            if (kind == "circle") return circleDown(w, t)
            val d = drawing
            if (d != null && d.rect && d.points.isNotEmpty()) return rectDown(d.points[0])
            return null
        }
        val z = selZone ?: return null
        val s = z.shape ?: return null
        val rh = ZoneEdit.rotHandle(s, tol(40.0))
        if (rh != null && distance(rh.second, w) <= tol(26.0)) return rotateDrag(z, rh.first, rh.second)
        val hd = ZoneEdit.hitHandle(s, w, tol(26.0), tol(22.0), tol(36.0))
        if (hd != null) return if (hd is ZoneHandle.Mid) midDrag(z, hd) else handleDrag(z, hd)
        if (ZoneEdit.inZone(z, w, tol(16.0))) return bodyDrag(z, w)
        return null
    }

    private fun setShape(id: String, fn: (Shape) -> Shape) {
        live { g -> g.zones.firstOrNull { it.id == id }?.let { z -> z.shape?.let { ZoneEdit.replace(g, z.copy(shape = fn(it))) } } ?: g }
    }

    private fun circleDown(w0: Point, t: String): PlanDrag {
        val was = circleCenter
        val c = was ?: snap(w0)
        return object : PlanDrag {
            override fun move(w: Point) { ghost = snap(w); ghostRadiusCenter = c }
            override fun up(w: Point, moved: Boolean) {
                ghostRadiusCenter = null
                if (was == null && !moved) { circleCenter = c; ghost = null; return }
                val shape = ZoneEdit.circleFrom(c, snap(w), t)
                circleCenter = null; ghost = null
                addZone(shape)
            }
            override fun cancel() { ghostRadiusCenter = null; ghost = null }
        }
    }

    /** Centre du cercle en cours de glissé (aperçu du rayon). */
    var ghostRadiusCenter by mutableStateOf<Point?>(null); private set

    private fun rectDown(a: Point): PlanDrag = object : PlanDrag {
        override fun move(w: Point) { ghost = snap(w) }
        override fun up(w: Point, moved: Boolean) { finishRect(a, snap(w)) }
        override fun cancel() { ghost = null }
    }

    private fun finishRect(a: Point, b: Point) {
        if (ZoneEdit.cornersTooClose(a, b)) { say(ZoneEdit.MSG_CORNERS_CLOSE); return }
        stopDrawing()
        addZone(PolygonShape(ZoneEdit.rectPoints(a, b)))
    }

    private fun handleDrag(z: Zone, hd: ZoneHandle): PlanDrag {
        val before = beginDrag(); dragging = true
        return object : PlanDrag {
            override fun move(w: Point) {
                val own = (z.shape as? PolygonShape)?.points ?: emptyList()
                val ex = if (hd is ZoneHandle.Vertex) listOfNotNull(own.getOrNull(hd.i)) else emptyList()
                val p = snap(w, ex)
                setShape(z.id) { ZoneEdit.moveHandle(it, hd, p) }
            }
            override fun up(w: Point, moved: Boolean) { dragging = false; snapMark = null; endDrag(before, moved) }
            override fun cancel() { dragging = false; snapMark = null; restore(before) }
        }
    }

    private fun midDrag(z: Zone, hd: ZoneHandle.Mid): PlanDrag {
        val before = beginDrag(); dragging = true
        var ins = -1
        return object : PlanDrag {
            override fun move(w: Point) {
                if (ins < 0) { setShape(z.id) { ZoneEdit.insertMid(it, hd.i, hd.p) }; ins = hd.i + 1 }
                val p = snap(w)
                val i = ins
                setShape(z.id) { ZoneEdit.moveHandle(it, ZoneHandle.Vertex(i, p), p) }
            }
            override fun up(w: Point, moved: Boolean) { dragging = false; snapMark = null; endDrag(before, ins >= 0) }
            override fun cancel() { dragging = false; snapMark = null; restore(before) }
        }
    }

    private fun bodyDrag(z: Zone, start: Point): PlanDrag {
        val before = beginDrag(); dragging = true
        val s0 = z.shape!!
        return object : PlanDrag {
            override fun move(w: Point) {
                val g = garden; val t = tol(14.0); val gr = grid
                val moved = ZoneEdit.bodyMove(g, z, s0, w.x - start.x, w.y - start.y, t, gr)
                setShape(z.id) { moved }
            }
            override fun up(w: Point, moved: Boolean) { dragging = false; endDrag(before, moved) }
            override fun cancel() { dragging = false; restore(before) }
        }
    }

    private fun rotateDrag(z: Zone, center: Point, handle: Point): PlanDrag {
        val before = beginDrag(); dragging = true
        val s0 = z.shape!!
        return object : PlanDrag {
            override fun move(w: Point) {
                val (shape, ang) = ZoneEdit.rotateDrag(garden, s0, center, handle, w, rotSnap)
                rotLive = ang
                setShape(z.id) { shape }
            }
            override fun up(w: Point, moved: Boolean) { dragging = false; rotLive = null; endDrag(before, moved) }
            override fun cancel() { dragging = false; rotLive = null; restore(before) }
        }
    }

    fun onTap(w: Point) {
        say("")
        val t = typeId
        val k = kind
        if (t != null && k != null && k != "circle") {
            val p = snap(w)
            val r = ZoneEdit.tap(drawing, k, rectMode, w, p, tol(24.0), lineWidth)
            if (r.message != null) say(r.message!!)
            if (r.finished != null) { stopDrawing(); addZone(r.finished!!) } else drawing = r.draft
            return
        }
        if (t != null) return // cercle : géré au toucher
        val z = selZone
        if (z != null && ZoneEdit.dimsOf(z.shape) != null && hitDimLabel(z, w)) { pop = ZnPop.Dims(z.id); return }
        select(ZoneEdit.hit(garden, sel, w, tol(16.0))?.id)
    }

    /** Toucher une cote de la zone sélectionnée : saisir ses dimensions. */
    private fun hitDimLabel(z: Zone, w: Point): Boolean {
        val pts = (z.shape as? PolygonShape)?.points ?: return false
        val n = pts.size
        for (i in 0 until n) {
            val a = pts[i]; val b = pts[(i + 1) % n]
            if (distance(a, b) < tol(44.0)) continue
            val mid = Point((a.x + b.x) / 2, (a.y + b.y) / 2)
            if (distance(mid, w) <= tol(22.0) && ZoneEdit.hitHandle(z.shape, w, 0.0, 0.0, tol(36.0)) == null) return true
        }
        return false
    }

    fun onLong(w: Point) {
        if (typeId != null) { stopDrawingKeepType(); pop = ZnPop.Create(snap(w)); return }
        val z = ZoneEdit.hit(garden, sel, w, tol(16.0))
        if (z != null) { sel = z.id; pop = ZnPop.Dims(z.id); return }
        say("Choisissez d’abord un type de zone, puis appuyez longuement sur le plan pour saisir ses dimensions.")
    }

    private fun stopDrawingKeepType() { drawing = null; circleCenter = null; ghost = null }

    // ------------------------------------------------------------------ saisie des dimensions

    fun createFromPop(at: Point, r: Double?, w: Double?, l: Double?) {
        val t = typeId ?: return
        val shape: Shape? = when (kind) {
            "circle" -> r?.let { CircleShape(at, kotlin.math.round(it * 100) / 100) }
            "line" -> if (l != null && w != null) ZoneEdit.lineFromLength(at, l, w) else null
            else -> if (w != null && l != null) ZoneEdit.rectFromSize(at, w, l) else null
        }
        if (shape != null) { stopDrawing(); addZone(shape) }
        @Suppress("UNUSED_VARIABLE") val unused = t
    }

    fun applyDims(id: String, r: Double?, w: Double?, l: Double?, rot: Double?) {
        mutate { g -> g.zones.firstOrNull { it.id == id }?.let { z -> z.shape?.let { ZoneEdit.replace(g, z.copy(shape = ZoneEdit.applyDims(it, r, w, l, rot))) } } ?: g }
    }

    // ------------------------------------------------------------------ zone sélectionnée

    private fun upd(id: String, fn: (Zone) -> Zone) { mutate { g -> g.zones.firstOrNull { it.id == id }?.let { ZoneEdit.replace(g, fn(it)) } ?: g } }

    fun setLabel(id: String, label: String) { live { g -> g.zones.firstOrNull { it.id == id }?.let { ZoneEdit.replace(g, ZoneEdit.setLabel(it, label)) } ?: g } }
    fun setType(id: String, typeId: String) = upd(id) { ZoneEdit.setType(it, typeId) }
    fun setPool(id: String, variant: String) = upd(id) { if (fr.jardin.core.poolVariant(it) != variant) setPoolVariant(it, variant) else it }

    /** Hauteur de paroi / surélévation (m) ; `null` = valeur par défaut. */
    fun setHeight(id: String, m: Double?) {
        val z = ZoneEdit.zoneById(garden, id) ?: return
        val def = defaultZoneHeight(z)
        if (m == null) { upd(id) { it.copy(height = null) }; return }
        val chk = checkHeight(zoneHeightKind(z), m)
        if (!chk.ok) { say(heightMessage(zoneHeightKind(z)), "warn"); return }
        upd(id) { it.copy(height = if (abs(chk.value!! - def) < 0.005) null else chk.value) }
        if (chk.clamped) say(chk.message, "warn")
    }

    fun rotateBy(id: String, d: Double) = upd(id) { ZoneEdit.rotateBy(it, d) }
    fun rotateTo(id: String, deg: Double) = upd(id) { ZoneEdit.rotateTo(it, deg) }
    fun straighten(id: String) = upd(id) { ZoneEdit.straighten(it) }
    fun toggleRotSnap() { rotSnap = !rotSnap }
    fun rotation(z: Zone): Double = rotationOf(z.shape)

    fun duplicate(z: Zone) {
        val (_, c) = ZoneEdit.duplicate(garden, z)
        mutate { it.copy(zones = it.zones + c) }
        sel = c.id
        say(ZoneEdit.newCopyMessage(c.label))
    }

    fun remove(z: Zone) {
        mutate { ZoneEdit.remove(it, z.id) }
        sel = null; naming = false
        say(ZoneEdit.removedMessage(z.label))
    }

    override fun onHistoryApplied() { sel = null; pop = null; stopDrawing() }

    fun dimsOf(z: Zone): ZoneDims? = ZoneEdit.dimsOf(z.shape)
}
