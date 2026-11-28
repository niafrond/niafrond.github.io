package fr.jardin.core.plan

import fr.jardin.core.BoundaryEdge
import fr.jardin.core.Existing
import fr.jardin.core.Garden
import fr.jardin.core.Item
import fr.jardin.core.Obstacle
import fr.jardin.core.Opening
import fr.jardin.core.OpeningRef
import fr.jardin.core.Point
import fr.jardin.core.Zone
import fr.jardin.core.EDGE_MATERIALS
import fr.jardin.core.HeightCheck
import fr.jardin.core.boundarySides
import fr.jardin.core.checkHeight
import fr.jardin.core.createItem
import fr.jardin.core.createOpening
import fr.jardin.core.distance
import fr.jardin.core.edgeHeightOf
import fr.jardin.core.edgeKindOf
import fr.jardin.core.getEdgeKind
import fr.jardin.core.getItemKind
import fr.jardin.core.getOpeningKind
import fr.jardin.core.itemContains
import fr.jardin.core.itemHalfSize
import fr.jardin.core.itemPolygon
import fr.jardin.core.itemRadius
import fr.jardin.core.newId
import fr.jardin.core.norm360
import fr.jardin.core.obstacleSides
import fr.jardin.core.openingAllowedOn
import fr.jardin.core.openingGeometry
import fr.jardin.core.polygonInside
import fr.jardin.core.resolveSide
import fr.jardin.core.snapOpeningToSides
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round
import kotlin.math.sin

/** Ce que l'éditeur d'aménagements a sélectionné. */
sealed interface AmSel {
    data class ItemSel(val id: String) : AmSel
    data class EdgeSel(val index: Int) : AmSel
    data class FreeSel(val id: String) : AmSel
    data class OpenSel(val id: String) : AmSel
    data class ExSel(val id: String) : AmSel
}

/** Instantané des éléments modifiés par les étapes Aménagements et Zones (annuler / rétablir, 100 niveaux). */
data class PlanSnapshot(
    val items: List<Item>, val existing: List<Existing>, val obstacles: List<Obstacle>,
    val openings: List<Opening>, val edges: List<BoundaryEdge>, val zones: List<Zone>,
) {
    companion object { fun of(g: Garden) = PlanSnapshot(g.items, g.existing, g.obstacles, g.openings, g.boundaryEdges, g.zones) }
    fun applyTo(g: Garden): Garden = g.copy(items = items, existing = existing, obstacles = obstacles, openings = openings, boundaryEdges = edges, zones = zones)
}

private fun r2(v: Double) = round(v * 100) / 100 + 0.0
private fun r3(v: Double) = round(v * 1000) / 1000 + 0.0

/** Aimantation et position d'un point sur la grille (pas en m ; null / 0 = désactivée). */
fun snapToGrid(p: Point, grid: Double?): Point =
    if (grid != null && grid > 0) Point(r3(round(p.x / grid) * grid), r3(round(p.y / grid) * grid)) else p

/** Réglage d'une hauteur saisie : résultat validé (bornes de `heights`) ou null si illisible. */
data class HeightEdit(val check: HeightCheck)

/**
 * Opérations pures de l'étape « Aménagements » (port de `mountItemEditor`, ui/draw-items.js) : mobilier, côtés du terrain
 * (mur / clôture / haie), murs et clôtures libres, portes et accès. Aucune dépendance Android.
 */
object ItemEdit {
    // ------------------------------------------------------------------ mobilier

    /** Côtés d'accrochage du mobilier : contour + maison / abri / mur / clôture. */
    fun magnetSides(g: Garden): List<Pair<Point, Point>> {
        val out = ArrayList<Pair<Point, Point>>()
        boundarySides(g).forEach { out.add(it.a to it.b) }
        for (o in g.obstacles) if (o.kind in listOf("house", "shed", "wall", "fence")) obstacleSides(o).forEach { out.add(it.a to it.b) }
        return out
    }

    private class Frame(val ux: Double, val uy: Double, val nx: Double, val ny: Double, val dist: Double, val ang: Double)

    private fun frame(it: Item, a: Point, b: Point): Frame? {
        val dx = b.x - a.x; val dy = b.y - a.y
        val l = Math.hypot(dx, dy)
        if (l < 1e-6) return null
        val ux = dx / l; val uy = dy / l; val nx = -uy; val ny = ux
        val along = (it.x - a.x) * ux + (it.y - a.y) * uy
        if (along < -0.3 || along > l + 0.3) return null
        return Frame(ux, uy, nx, ny, (it.x - a.x) * nx + (it.y - a.y) * ny, atan2(dy, dx) * 180 / PI)
    }

    /** Aimante l'élément contre le côté proche (position et, pour un rectangle, rotation au multiple de 90° voisin). */
    fun magnet(item: Item, g: Garden, tol: Double): Item {
        var it = item
        val sides = magnetSides(g)
        val r = itemRadius(it)
        val (hw, hd) = itemHalfSize(it)
        var pick: Triple<Pair<Point, Point>, Double, Double>? = null
        for (s in sides) {
            val f0 = frame(it, s.first, s.second) ?: continue
            val gap = abs(f0.dist) - max(hw, hd)
            if (abs(gap) <= tol * 1.5 && (pick == null || abs(gap) < pick.second)) pick = Triple(s, abs(gap), f0.ang)
        }
        if (pick == null) return it
        if (r == null) {
            val d = ((((it.rotation - pick.third) % 90) + 135) % 90) - 45
            if (abs(d) <= 25) it = it.copy(rotation = norm360(round(it.rotation - d)))
        }
        val f2 = frame(it, pick.first.first, pick.first.second) ?: return it
        val ext = if (r != null) r else {
            val a = it.rotation * PI / 180
            hw * abs(f2.nx * cos(a) + f2.ny * sin(a)) + hd * abs(-f2.nx * sin(a) + f2.ny * cos(a))
        }
        val gap = abs(f2.dist) - ext
        if (abs(gap) <= tol) {
            val sgn = if (f2.dist >= 0) 1.0 else -1.0
            it = it.copy(x = it.x - f2.nx * sgn * gap, y = it.y - f2.ny * sgn * gap)
        }
        return it
    }

    /** Nouvel élément posé en `at` (grille puis aimantation). */
    fun create(g: Garden, kind: String, at: Point, grid: Double?, tol: Double): Item {
        val p = snapToGrid(at, grid)
        return magnet(createItem(kind, p.x, p.y, 0.0), g, tol)
    }

    /** Élément touché en `w` (le dernier posé d'abord) : dans sa forme ou à moins de `tol` m de son centre. */
    fun hit(g: Garden, w: Point, tol: Double): Item? {
        for (i in g.items.indices.reversed()) {
            val it = g.items[i]
            if (itemContains(it, w) || distance(Point(it.x, it.y), w) <= tol) return it
        }
        return null
    }

    /** Position de la poignée de rotation ⟳ : au-dessus de l'élément, dans son repère tourné. */
    fun handlePos(it: Item, offset: Double): Point {
        val (_, hd) = itemHalfSize(it)
        val a = it.rotation * PI / 180
        val off = hd + offset
        return Point(it.x + off * sin(a), it.y - off * cos(a))
    }

    /** Rotation par glisser de la poignée : pas de 5°, aimantée aux multiples de 90° (à ±6°). */
    fun rotateFromHandle(it: Item, w: Point): Item {
        if (itemRadius(it) != null) return it
        var a = atan2(w.y - it.y, w.x - it.x) * 180 / PI + 90
        a = round(norm360(a) / 5) * 5
        val near = round(a / 90) * 90
        if (abs(a - near) <= 6) a = near
        return it.copy(rotation = norm360(a))
    }

    fun rotateBy(it: Item, delta: Double): Item = if (itemRadius(it) != null) it else it.copy(rotation = norm360(it.rotation + delta))

    fun rotateTo(it: Item, deg: Double): Item = if (itemRadius(it) != null) it else it.copy(rotation = norm360(deg))

    /** Taille : cercle = diamètre `w` ; rectangle = largeur `w`, profondeur `d`. Valeurs en m. */
    fun resize(it: Item, w: Double?, d: Double?): Item {
        if (itemRadius(it) != null) return if (w != null && w > 0) it.copy(radius = w / 2, width = w, depth = w) else it
        return it.copy(width = if (w != null && w > 0) w else it.width, depth = if (d != null && d > 0) d else it.depth)
    }

    /** Hauteur saisie (m) : validée par `checkHeight` ; `null` = retour à la valeur du catalogue. */
    fun setHeight(it: Item, value: Double?): Pair<Item, HeightCheck?> {
        if (value == null) return it.copy(height = null) to null
        val chk = checkHeight(it.kind, value)
        if (!chk.ok) return it to chk
        return it.copy(height = chk.value) to chk
    }

    fun setLabel(it: Item, label: String): Item = it.copy(label = label.trim().ifEmpty { null })

    fun duplicate(it: Item): Item = it.copy(id = newId("i_"), x = it.x + 0.5, y = it.y + 0.5)

    /** L'élément dépasse-t-il du terrain (contour fermé) ? */
    fun isOutside(g: Garden, it: Item): Boolean =
        g.boundaryClosed && g.boundary.size >= 3 && !polygonInside(itemPolygon(it), g.boundary)

    fun dims(it: Item): String {
        val r = itemRadius(it)
        return if (r != null) "Ø ${cm(r * 2)} cm" else "${cm(it.width)} × ${cm(it.depth)} cm"
    }

    fun cm(m: Double): String = round(m * 100).toLong().toString()

    fun upsert(g: Garden, it: Item): Garden =
        if (g.items.any { q -> q.id == it.id }) g.copy(items = g.items.map { q -> if (q.id == it.id) it else q }) else g.copy(items = g.items + it)

    fun removeItem(g: Garden, id: String): Garden = g.copy(items = g.items.filter { it.id != id })

    // ------------------------------------------------------------------ côtés du terrain

    /** Côté du contour touché à moins de `tol` m, ou -1. */
    fun hitBoundarySide(g: Garden, w: Point, tol: Double): Int {
        var best = -1; var bd = tol
        for (s in boundarySides(g)) {
            val (q, _) = PlanHit.nearestOnSegment(w, s.a, s.b)
            val d = distance(w, q)
            if (d <= bd) { bd = d; best = s.i }
        }
        return best
    }

    /** Type, hauteur et matériau d'un côté (`material` null = matériau par défaut du type ; `keep` = conserver celui du côté si le type est inchangé). */
    fun setEdge(g: Garden, i: Int, kind: String, height: Double, material: String? = null, keep: Boolean = false): Garden {
        val n = boundarySides(g).size
        val list = g.boundaryEdges.toMutableList()
        while (list.size < max(n, i + 1)) list.add(BoundaryEdge("open", 0.0))
        val prev = list[i]
        val mat = if (keep) (if (prev.kind == kind) prev.material else null) else material
        val ok = mat != null && (EDGE_MATERIALS[kind] ?: emptyList()).contains(mat)
        list[i] = if (kind == "open") BoundaryEdge("open", 0.0) else if (ok) BoundaryEdge(kind, height, mat) else BoundaryEdge(kind, height)
        return g.copy(boundaryEdges = list)
    }

    /** Choix du type d'un côté : garde la hauteur si le type ne change pas, sinon celle du type. */
    fun chooseEdgeKind(g: Garden, i: Int, kind: String): Garden {
        val k = getEdgeKind(kind) ?: return g
        val h0 = if (edgeKindOf(g, i) == kind) edgeHeightOf(g, i) else k.height
        return setEdge(g, i, kind, h0, keep = true)
    }

    fun setEdgeHeight(g: Garden, i: Int, m: Double): Pair<Garden, HeightCheck> {
        val kind = edgeKindOf(g, i)
        val chk = checkHeight(kind, m)
        if (kind == "open" || !chk.ok) return g to chk
        return setEdge(g, i, kind, chk.value!!, keep = true) to chk
    }

    fun setEdgeMaterial(g: Garden, i: Int, mat: String): Garden {
        val kind = edgeKindOf(g, i)
        return if (kind == "open") g else setEdge(g, i, kind, edgeHeightOf(g, i), mat)
    }

    fun edgeMaterial(g: Garden, i: Int): String? = fr.jardin.core.materialOf(edgeKindOf(g, i), g.boundaryEdges.getOrNull(i)?.material)

    /** Applique le type, la hauteur et le matériau du côté `i` à tous les côtés. */
    fun applyAllEdges(g: Garden, i: Int): Garden {
        val kind = edgeKindOf(g, i); val h = edgeHeightOf(g, i)
        val mat = g.boundaryEdges.getOrNull(i)?.material
        var out = g
        for (s in boundarySides(g)) out = setEdge(out, s.i, kind, h, mat)
        return out
    }

    // ------------------------------------------------------------------ murs et clôtures libres

    val FREE_KINDS: Map<String, Pair<String, Double>> = linkedMapOf("wall" to ("Mur" to 2.0), "fence" to ("Clôture" to 1.2))

    /** Mur / clôture libre (points posés un à un ; fermer = ajouter le 1er point à la fin). */
    fun addFreeLine(g: Garden, kind: String, points: List<Point>): Pair<Garden, Obstacle> {
        val def = FREE_KINDS[kind] ?: error("Type libre inconnu : $kind")
        val o = Obstacle(id = newId("o_"), kind = kind, points = points, height = def.second)
        return g.copy(obstacles = g.obstacles + o) to o
    }

    fun hitFreeLine(g: Garden, w: Point, tol: Double): Obstacle? {
        var best: Obstacle? = null; var bd = tol
        for (o in g.obstacles) {
            if (o.kind != "wall" && o.kind != "fence") continue
            for (s in obstacleSides(o)) {
                val (q, _) = PlanHit.nearestOnSegment(w, s.a, s.b)
                val d = distance(w, q)
                if (d <= bd) { bd = d; best = o }
            }
        }
        return best
    }

    fun setFreeHeight(g: Garden, id: String, m: Double?): Pair<Garden, HeightCheck?> {
        val o = g.obstacles.firstOrNull { it.id == id } ?: return g to null
        val v = m ?: FREE_KINDS[o.kind]?.second
        val chk = checkHeight(o.kind, v)
        if (!chk.ok) return g to chk
        return g.copy(obstacles = g.obstacles.map { if (it.id == id) it.copy(height = chk.value) else it }) to chk
    }

    fun setFreeMaterial(g: Garden, id: String, mat: String): Garden =
        g.copy(obstacles = g.obstacles.map { if (it.id == id) it.copy(material = mat) else it })

    /** Supprime un obstacle (mur / clôture libre) et les passages posés dessus. */
    fun removeObstacle(g: Garden, id: String): Garden = g.copy(
        obstacles = g.obstacles.filter { it.id != id },
        openings = g.openings.filter { !(it.ref.type == "obstacle" && it.ref.obstacleId == id) },
    )

    // ------------------------------------------------------------------ portes et accès

    fun hasHouse(g: Garden): Boolean = g.obstacles.any { it.kind == "house" || it.kind == "shed" }

    /** Y a-t-il un côté où poser ce type de passage ? */
    fun canPlaceOpening(g: Garden, kind: String): Boolean = snapOpeningToSides(g, Point(0.0, 0.0), kind) != null

    /** Passage touché (le plus proche à moins de max(tol, 0,15) m), ou null. */
    fun hitOpening(g: Garden, w: Point, tol: Double): Opening? {
        var best: Opening? = null; var bd = max(tol, 0.15)
        for (op in g.openings) {
            val og = openingGeometry(g, op) ?: continue
            val (q, _) = PlanHit.nearestOnSegment(w, og.a, og.b)
            val d = distance(w, q)
            if (d <= bd) { bd = d; best = op }
        }
        return best
    }

    /** Pose un passage sur le côté le plus proche de `w` (à moins de `maxDist` m) ; null s'il n'y en a pas. */
    fun placeOpening(g: Garden, kind: String, w: Point, maxDist: Double): Opening? {
        val s = snapOpeningToSides(g, w, kind, maxDist) ?: return null
        val op = createOpening(kind, s.ref, s.t)
        val ends = sideEnds(g, s.ref) ?: return op
        val l = distance(ends.first, ends.second)
        val half = min(op.width, l) / 2 / l
        return op.copy(t = min(1 - half, max(half, s.t)))
    }

    fun sideEnds(g: Garden, ref: OpeningRef): Pair<Point, Point>? {
        val rs = resolveSide(g, ref) ?: return null
        return rs.a to rs.b
    }

    /** Glisse un passage : reste sur son côté si le doigt en est proche (`stick` m), sinon bascule sur le côté voisin. */
    fun slideOpening(g: Garden, op: Opening, w: Point, grid: Double?, stick: Double, near: Double, snapMid: Double): Opening? {
        val ends = sideEnds(g, op.ref)
        var ref: OpeningRef? = null; var t = 0.0
        if (ends != null) {
            val (q, tt) = PlanHit.nearestOnSegment(w, ends.first, ends.second)
            if (distance(w, q) <= stick) { ref = op.ref; t = tt }
        }
        if (ref == null) {
            val s = snapOpeningToSides(g, w, op.kind, near) ?: return null
            ref = s.ref; t = s.t
        }
        val e = sideEnds(g, ref) ?: return null
        val l = distance(e.first, e.second)
        if (l < 1e-9) return null
        val half = min(op.width, l) / 2 / l
        if (grid != null && grid > 0) t = round(t * l / grid) * grid / l
        if (abs(t - 0.5) * l < snapMid) t = 0.5
        return op.copy(ref = ref, t = min(1 - half, max(half, t)))
    }

    fun setOpeningWidth(op: Opening, m: Double): Opening = op.copy(width = max(0.1, m))
    fun setSwing(op: Opening, swing: String): Opening = op.copy(swing = swing)
    fun upsertOpening(g: Garden, op: Opening): Garden =
        if (g.openings.any { it.id == op.id }) g.copy(openings = g.openings.map { if (it.id == op.id) op else it }) else g.copy(openings = g.openings + op)
    fun removeOpening(g: Garden, id: String): Garden = g.copy(openings = g.openings.filter { it.id != id })

    /** Texte d'aide « où poser » : maison ou terrain. */
    fun openingTarget(kind: String): String =
        if (kind == "garage" || kind == "door") "de la maison ou d’un abri" else "du terrain, d’un mur ou d’une clôture"

    fun openingAllowed(kind: String, target: String) = openingAllowedOn(kind, target)
    fun openingLabel(kind: String): String = getOpeningKind(kind)?.label ?: kind
    fun itemLabel(kind: String): String = getItemKind(kind)?.label ?: kind
}
