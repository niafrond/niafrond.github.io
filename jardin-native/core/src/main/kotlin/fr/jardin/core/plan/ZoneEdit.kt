package fr.jardin.core.plan

import fr.jardin.core.CircleShape
import fr.jardin.core.Garden
import fr.jardin.core.LineShape
import fr.jardin.core.Point
import fr.jardin.core.PolygonShape
import fr.jardin.core.Shape
import fr.jardin.core.Zone
import fr.jardin.core.boundarySides
import fr.jardin.core.centroid
import fr.jardin.core.createZone
import fr.jardin.core.distance
import fr.jardin.core.getZoneType
import fr.jardin.core.isRotatable
import fr.jardin.core.itemPolygon
import fr.jardin.core.itemRadius
import fr.jardin.core.newId
import fr.jardin.core.norm360
import fr.jardin.core.overlapArea
import fr.jardin.core.pointInPolygon
import fr.jardin.core.polygonInside
import fr.jardin.core.rebuildRect
import fr.jardin.core.rotateShapeBy
import fr.jardin.core.rotateShapeTo
import fr.jardin.core.rotationCenter
import fr.jardin.core.rotationOf
import fr.jardin.core.shapeArea
import fr.jardin.core.shapeBounds
import fr.jardin.core.shapePolygon
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

/** Poignée de la zone sélectionnée. */
sealed interface ZoneHandle {
    val p: Point
    data class Center(override val p: Point) : ZoneHandle
    data class Radius(override val p: Point) : ZoneHandle
    data class Vertex(val i: Int, override val p: Point) : ZoneHandle
    /** Milieu d'un côté : glisser insère un sommet. */
    data class Mid(val i: Int, override val p: Point) : ZoneHandle
}

/** Dimensions affichables d'une zone. */
sealed interface ZoneDims {
    data class Circle(val r: Double) : ZoneDims
    data class Line(val w: Double, val len: Double) : ZoneDims
    data class Rect(val w: Double, val l: Double) : ZoneDims
    data class Poly(val w: Double, val l: Double) : ZoneDims
}

/** Forme en cours de dessin (polygone, ligne ou rectangle deux coins). */
data class ZoneDraft(val kind: String, val points: List<Point> = emptyList(), val rect: Boolean = false)

/**
 * Opérations pures de l'étape « Dessin des zones » (port de `mountZoneEditor`, ui/draw-zones.js) : création par type,
 * déplacement, déformation, rotation, saisie des dimensions, détection de chevauchement / de dépassement.
 */
object ZoneEdit {
    private fun r2(v: Double) = round(v * 100) / 100 + 0.0
    private fun r3(v: Double) = round(v * 1000) / 1000 + 0.0
    private fun p2(p: Point) = Point(r2(p.x), r2(p.y))

    // ------------------------------------------------------------------ types et création

    /** Types de formes d'une zone (`polygon`, `circle`, `line`) dans l'ordre du type. */
    fun shapeKinds(typeId: String): List<String> = getZoneType(typeId)?.shapeKinds ?: listOf("polygon")

    /** Forme proposée par défaut pour un type (la première de la liste). */
    fun defaultKind(typeId: String): String = shapeKinds(typeId).first()

    fun defaultRadius(typeId: String): Double = when (typeId) { "trees", "orchard" -> 2.0; "pond", "pool" -> 1.5; else -> 1.2 }

    fun defaultLineWidth(typeId: String): Double = getZoneType(typeId)?.defaultWidth ?: 1.0

    /** Rectangle (haut gauche, haut droite, bas droite, bas gauche) de deux coins opposés. */
    fun rectPoints(a: Point, b: Point): List<Point> {
        val x0 = min(a.x, b.x); val x1 = max(a.x, b.x); val y0 = min(a.y, b.y); val y1 = max(a.y, b.y)
        return listOf(Point(x0, y0), Point(x1, y0), Point(x1, y1), Point(x0, y1))
    }

    /** Deux coins trop proches : le rectangle n'est pas créé (message du web). */
    const val MSG_CORNERS_CLOSE = "Les deux coins sont trop proches : touchez le coin opposé, plus loin."
    fun cornersTooClose(a: Point, b: Point): Boolean = abs(b.x - a.x) < 0.1 || abs(b.y - a.y) < 0.1

    /** Ajoute une zone du type donné ; le nom devient « Type n » dès qu'il y en a déjà une. */
    fun addZone(g: Garden, typeId: String, shape: Shape): Pair<Garden, Zone> {
        val t = getZoneType(typeId) ?: throw IllegalArgumentException("Type de zone inconnu : $typeId")
        var z = createZone(typeId, shape)
        val same = g.zones.count { it.type == typeId }
        if (same > 0) z = z.copy(label = "${t.label} ${same + 1}")
        return g.copy(zones = g.zones + z) to z
    }

    fun zoneById(g: Garden, id: String?): Zone? = if (id == null) null else g.zones.firstOrNull { it.id == id }

    fun replace(g: Garden, z: Zone): Garden = g.copy(zones = g.zones.map { if (it.id == z.id) z else it })

    fun remove(g: Garden, id: String): Garden = g.copy(zones = g.zones.filter { it.id != id })

    fun duplicate(g: Garden, z: Zone): Pair<Garden, Zone> {
        val shape = z.shape?.let { translate(it, 0.5, 0.5) }
        var c = createZone(z.type, shape).copy(label = "${z.label} (copie)", notes = z.notes, variant = z.variant ?: createZone(z.type, null).variant)
        if (z.ambiance != null) c = c.copy(ambiance = z.ambiance)
        return g.copy(zones = g.zones + c) to c
    }

    fun setLabel(z: Zone, label: String): Zone = z.copy(label = label.take(60))

    fun setType(z: Zone, typeId: String): Zone = if (getZoneType(typeId) == null) z else z.copy(type = typeId)

    fun areaText(z: Zone): String = LengthInput.frArea(shapeArea(z.shape))

    // ------------------------------------------------------------------ dessin

    /** Ajout d'un point par toucher. Renvoie le dessin mis à jour, et la forme terminée si le toucher a fermé la forme. */
    data class TapResult(val draft: ZoneDraft, val finished: Shape? = null, val message: String? = null)

    /** Rayon du 1er point : le toucher sur le 1er point (≥ 3 points) ferme un polygone. */
    fun tap(draft: ZoneDraft?, kind: String, rectMode: Boolean, w: Point, p: Point, closeTol: Double, lineWidth: Double): TapResult {
        val d = draft ?: ZoneDraft(kind, emptyList(), rect = kind == "polygon" && rectMode)
        val pts = d.points
        if (d.rect) {
            if (pts.isEmpty()) return TapResult(d.copy(points = listOf(p)))
            if (cornersTooClose(pts[0], p)) return TapResult(d, message = MSG_CORNERS_CLOSE)
            return TapResult(ZoneDraft("polygon"), finished = PolygonShape(rectPoints(pts[0], p)))
        }
        if (d.kind == "polygon" && pts.size >= 3 && (distance(w, pts[0]) <= closeTol || distance(p, pts[0]) <= closeTol)) return finish(d, lineWidth)
        if (pts.isNotEmpty() && distance(pts.last(), p) < 1e-6) {
            return if (pts.size >= (if (d.kind == "line") 2 else 3)) finish(d, lineWidth) else TapResult(d)
        }
        return TapResult(d.copy(points = pts + p))
    }

    /** Termine le tracé (bouton « Terminer ») : minimum 3 points (polygone) ou 2 (ligne). */
    fun finish(d: ZoneDraft, lineWidth: Double): TapResult {
        val min = if (d.kind == "line") 2 else 3
        if (d.rect || d.points.size < min) return TapResult(d, message = if (d.rect) "Touchez le coin opposé pour finir le rectangle." else "Il faut au moins $min points.")
        val shape: Shape = if (d.kind == "line") LineShape(d.points, lineWidth) else PolygonShape(d.points)
        return TapResult(ZoneDraft(d.kind), finished = shape)
    }

    /** Cercle : centre + point du bord (rayon par défaut si trop petit). */
    fun circleFrom(center: Point, edge: Point, typeId: String): CircleShape {
        val r = r2(distance(center, edge))
        return CircleShape(center, if (r < 0.2) defaultRadius(typeId) else r)
    }

    /** Ligne créée par saisie : part de `a` vers la droite. */
    fun lineFromLength(a: Point, len: Double, width: Double): LineShape = LineShape(listOf(a, Point(r2(a.x + len), a.y)), r2(width))

    fun rectFromSize(a: Point, w: Double, l: Double): PolygonShape = PolygonShape(rectPoints(a, Point(r2(a.x + w), r2(a.y + l))))

    fun lineLength(pts: List<Point>): Double = pts.zipWithNext().sumOf { distance(it.first, it.second) }

    // ------------------------------------------------------------------ aimantation

    /** Points d'accroche : contour, sommets des zones, coins du mobilier rectangulaire, obstacles. */
    fun allVerts(g: Garden): List<Point> {
        val v = ArrayList<Point>(g.boundary)
        g.zones.forEach { z -> (z.shape as? PolygonShape)?.let { v.addAll(it.points) }; (z.shape as? LineShape)?.let { v.addAll(it.points) } }
        g.items.forEach { if (itemRadius(it) == null) v.addAll(itemPolygon(it)) }
        g.obstacles.forEach { o -> o.points?.let { v.addAll(it) } }
        return v
    }

    fun boundaryLines(g: Garden): List<Pair<Point, Point>> = boundarySides(g).map { it.a to it.b }

    /** Aimantation : sommets > côtés du contour > grille. `exclude` : points en cours de déplacement. */
    fun snapAt(g: Garden, w: Point, tol: Double, grid: Double?, exclude: List<Point> = emptyList()): Point {
        var best: Point? = null; var bd = tol
        for (q in allVerts(g)) { if (exclude.any { it === q }) continue; val d = distance(w, q); if (d <= bd) { bd = d; best = q } }
        if (best != null) return best
        var bl: Point? = null; bd = tol
        for ((a, b) in boundaryLines(g)) {
            val (q, _) = PlanHit.nearestOnSegment(w, a, b)
            val d = distance(w, q)
            if (d <= bd) { bd = d; bl = q }
        }
        if (bl != null) return p2(bl)
        if (grid != null && grid > 0) return snapToGrid(w, grid)
        return p2(w)
    }

    // ------------------------------------------------------------------ toucher

    fun inZone(z: Zone, w: Point, tol: Double): Boolean {
        val s = z.shape ?: return false
        if (s is LineShape) {
            for (k in 0 until s.points.size - 1) {
                val (q, _) = PlanHit.nearestOnSegment(w, s.points[k], s.points[k + 1])
                if (distance(w, q) <= max(s.width / 2, tol)) return true
            }
            return false
        }
        val poly = shapePolygon(s, 48)
        return poly.size >= 3 && pointInPolygon(w, poly)
    }

    /** Zone touchée : la zone sélectionnée d'abord, puis la dernière dessinée (les zones « au sol » avant celles de canopée). */
    fun hit(g: Garden, selectedId: String?, w: Point, tol: Double): Zone? {
        val sel = zoneById(g, selectedId)
        if (sel != null && inZone(sel, w, tol)) return sel
        val order = g.zones.sortedBy { if (getZoneType(it.type)?.layer == "canopy") 1 else 0 }
        for (i in order.indices.reversed()) if (inZone(order[i], w, tol)) return order[i]
        return null
    }

    // ------------------------------------------------------------------ poignées

    fun handles(shape: Shape?, minMid: Double): List<ZoneHandle> = when (shape) {
        null -> emptyList()
        is CircleShape -> listOf(ZoneHandle.Center(shape.center), ZoneHandle.Radius(Point(shape.center.x + shape.radius, shape.center.y)))
        is PolygonShape, is LineShape -> {
            val pts = if (shape is PolygonShape) shape.points else (shape as LineShape).points
            val out = ArrayList<ZoneHandle>(pts.mapIndexed { i, p -> ZoneHandle.Vertex(i, p) })
            val n = pts.size
            val edges = if (shape is PolygonShape) n else n - 1
            for (i in 0 until edges) {
                val a = pts[i]; val b = pts[(i + 1) % n]
                if (distance(a, b) > minMid) out.add(ZoneHandle.Mid(i, Point((a.x + b.x) / 2, (a.y + b.y) / 2)))
            }
            out
        }
    }

    /** Poignée touchée (rotation exclue). Sommets / centre à `tol`, milieux à `tolMid`. */
    fun hitHandle(shape: Shape?, w: Point, tol: Double, tolMid: Double, minMid: Double): ZoneHandle? {
        var best: ZoneHandle? = null; var bd = Double.POSITIVE_INFINITY
        for (h in handles(shape, minMid)) {
            val d = distance(h.p, w)
            val lim = if (h is ZoneHandle.Mid) tolMid else tol
            if (d <= lim && d < bd) { best = h; bd = d }
        }
        return best
    }

    private fun pointsOf(s: Shape): List<Point>? = when (s) { is PolygonShape -> s.points; is LineShape -> s.points; else -> null }
    private fun withPoints(s: Shape, pts: List<Point>): Shape = when (s) { is PolygonShape -> s.copy(points = pts); is LineShape -> s.copy(points = pts); else -> s }

    /** Un polygone à 4 sommets dont tous les angles sont droits. */
    fun isRectangle(pts: List<Point>?): Boolean {
        if (pts == null || pts.size != 4) return false
        for (i in 0 until 4) {
            val a = pts[i]; val b = pts[(i + 1) % 4]; val c = pts[(i + 2) % 4]
            val l1 = distance(a, b); val l2 = distance(b, c)
            if (l1 < 1e-6 || l2 < 1e-6) return false
            val cos = ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (l1 * l2)
            if (abs(cos) > 0.02) return false
        }
        return true
    }

    /** Un coin d'un rectangle : le coin opposé reste fixe, les deux voisins suivent (le rectangle reste un rectangle). */
    fun dragRectCorner(pts: List<Point>, i: Int, q: Point): List<Point> {
        val o = pts[(i + 2) % 4]
        fun u(a: Point, b: Point): Point { val l = distance(a, b).let { if (it == 0.0) 1.0 else it }; return Point((b.x - a.x) / l, (b.y - a.y) / l) }
        val e1 = u(pts[i], pts[(i + 1) % 4]); val e2 = u(pts[i], pts[(i + 3) % 4])
        val dx = q.x - o.x; val dy = q.y - o.y
        val s1 = dx * e1.x + dy * e1.y; val s2 = dx * e2.x + dy * e2.y
        if (abs(s1) < 0.05 || abs(s2) < 0.05) return pts
        val out = pts.toMutableList()
        out[(i + 1) % 4] = p2(Point(o.x + s2 * e2.x, o.y + s2 * e2.y))
        out[(i + 3) % 4] = p2(Point(o.x + s1 * e1.x, o.y + s1 * e1.y))
        out[i] = q
        return out
    }

    /** Déplace la poignée `h` vers `p` (déjà aimanté). */
    fun moveHandle(shape: Shape, h: ZoneHandle, p: Point): Shape = when (h) {
        is ZoneHandle.Center -> (shape as? CircleShape)?.copy(center = p) ?: shape
        is ZoneHandle.Radius -> (shape as? CircleShape)?.copy(radius = max(0.2, r2(distance(shape.center, p)))) ?: shape
        is ZoneHandle.Vertex -> {
            val pts = pointsOf(shape)
            if (pts == null || h.i !in pts.indices) shape
            else if (shape is PolygonShape && isRectangle(pts)) withPoints(shape, dragRectCorner(pts, h.i, p))
            else withPoints(shape, pts.toMutableList().also { it[h.i] = p })
        }
        is ZoneHandle.Mid -> shape
    }

    /** Insère le sommet d'un milieu de côté (indice du nouveau sommet : i + 1). */
    fun insertMid(shape: Shape, i: Int, p: Point): Shape {
        val pts = pointsOf(shape) ?: return shape
        val list = pts.toMutableList(); list.add(i + 1, p)
        return withPoints(shape, list)
    }

    fun translate(s: Shape, dx: Double, dy: Double): Shape = when (s) {
        is CircleShape -> s.copy(center = Point(s.center.x + dx, s.center.y + dy))
        is PolygonShape -> s.copy(points = s.points.map { Point(it.x + dx, it.y + dy) })
        is LineShape -> s.copy(points = s.points.map { Point(it.x + dx, it.y + dy) })
    }

    /** Déplacement du corps de la zone de (dx0, dy0) : aimante un sommet sur un sommet / un côté du terrain, sinon la grille. */
    fun bodyMove(g: Garden, z: Zone, s0: Shape, dx0: Double, dy0: Double, tol: Double, grid: Double?): Shape {
        val anchors = if (s0 is CircleShape) listOf(s0.center) else pointsOf(s0) ?: emptyList()
        val own = anchors
        val others = allVerts(g).filter { p -> own.none { it == p } }
        val lines = boundaryLines(g)
        var best: Triple<Double, Double, Double>? = null
        for (a in anchors) {
            val q = Point(a.x + dx0, a.y + dy0)
            for (o in others) { val d = distance(q, o); if (d <= tol && (best == null || d < best.first)) best = Triple(d, o.x - a.x, o.y - a.y) }
            for ((la, lb) in lines) {
                val (c, _) = PlanHit.nearestOnSegment(q, la, lb)
                val d = distance(q, c)
                if (d <= tol && (best == null || d < best.first)) best = Triple(d, c.x - a.x, c.y - a.y)
            }
        }
        var dx = dx0; var dy = dy0
        if (best != null) { dx = best.second; dy = best.third }
        else if (grid != null && grid > 0) { dx = round(dx0 / grid) * grid; dy = round(dy0 / grid) * grid }
        return translate(s0, dx, dy)
    }

    // ------------------------------------------------------------------ rotation

    /** Poignée de rotation : centre de rotation et position de la poignée (au-dessus de l'emprise), ou null (cercle). */
    fun rotHandle(shape: Shape?, offset: Double): Pair<Point, Point>? {
        if (shape == null || !isRotatable(shape)) return null
        val c = rotationCenter(shape); val b = shapeBounds(shape)
        return c to Point(c.x, b.minY - offset)
    }

    /** Angle absolu aimanté : côtés du terrain (±3°), puis multiples de 15° si `snap15`. */
    fun snapAngle(g: Garden, a: Double, snap15: Boolean): Double {
        var out = norm360(a)
        if (!snap15) return out
        var best: Pair<Double, Double>? = null
        for ((p, q) in boundaryLines(g)) {
            val e = atan2(q.y - p.y, q.x - p.x) * 180 / PI
            for (k in 0 until 4) {
                val cand = norm360(e + k * 90)
                val d = abs(((out - cand + 540) % 360) - 180)
                if (d <= 3 && (best == null || d < best.first)) best = d to cand
            }
        }
        if (best != null) return best.second
        out = norm360(round(out / 15) * 15)
        return out
    }

    /** Rotation par la poignée : `s0` forme au début du geste, `hc` centre, `h0` position de départ de la poignée, `w` doigt. */
    fun rotateDrag(g: Garden, s0: Shape, hc: Point, h0: Point, w: Point, snap15: Boolean): Pair<Shape, Double> {
        fun ang(p: Point) = atan2(p.y - hc.y, p.x - hc.x) * 180 / PI
        val target = snapAngle(g, rotationOf(s0) + (ang(w) - ang(h0)), snap15)
        return roundShape(rotateShapeTo(s0, target)) to target
    }

    fun roundShape(s: Shape): Shape = when (s) {
        is PolygonShape -> s.copy(points = s.points.map { Point(r3(it.x), r3(it.y)) })
        is LineShape -> s.copy(points = s.points.map { Point(r3(it.x), r3(it.y)) })
        else -> s
    }

    fun rotateBy(z: Zone, delta: Double): Zone = z.shape?.let { z.copy(shape = roundShape(rotateShapeBy(it, delta))) } ?: z

    fun rotateTo(z: Zone, deg: Double): Zone {
        val s = z.shape ?: return z
        if (abs(((norm360(deg) - rotationOf(s) + 540) % 360) - 180) < 0.01) return z
        return z.copy(shape = roundShape(rotateShapeTo(s, deg)))
    }

    /** « Remettre droit » : aligne le côté principal sur le multiple de 90° le plus proche. */
    fun straighten(z: Zone): Zone = z.shape?.let { rotateTo(z, norm360(round(rotationOf(it) / 90) * 90)) } ?: z

    const val NO_ROT_TIP = "Un cercle n’a pas d’orientation"

    // ------------------------------------------------------------------ dimensions

    fun dimsOf(shape: Shape?): ZoneDims? = when (shape) {
        null -> null
        is CircleShape -> ZoneDims.Circle(shape.radius)
        is LineShape -> ZoneDims.Line(shape.width, lineLength(shape.points))
        is PolygonShape -> if (isRectangle(shape.points)) ZoneDims.Rect(distance(shape.points[0], shape.points[1]), distance(shape.points[0], shape.points[3]))
        else shapeBounds(shape).let { ZoneDims.Poly(it.maxX - it.minX, it.maxY - it.minY) }
    }

    fun dimsText(shape: Shape?): String = when (val d = dimsOf(shape)) {
        null -> ""
        is ZoneDims.Circle -> "rayon ${LengthInput.frLen(d.r)}"
        is ZoneDims.Line -> "${LengthInput.frLen(d.len)} de long × ${LengthInput.frLen(d.w)} de large"
        is ZoneDims.Rect -> "${LengthInput.frLen(d.w)} × ${LengthInput.frLen(d.l)}"
        is ZoneDims.Poly -> "${LengthInput.frLen(d.w)} × ${LengthInput.frLen(d.l)} (emprise)"
    }

    fun dimsHint(d: ZoneDims?): String = when (d) {
        is ZoneDims.Circle -> "Tapez le rayon en centimètres : 150 = 1,50 m."
        is ZoneDims.Line -> "Longueur du tracé : ${LengthInput.frLen(d.len)}. Tapez la largeur en centimètres : 100 = 1 m."
        is ZoneDims.Poly -> "Forme libre : la forme est étirée à cette emprise. Centimètres : 350 = 3,50 m."
        else -> "Tapez en centimètres : 350 = 3,50 m. Le centre reste en place, l’angle est conservé. Rotation en degrés (0–359)."
    }

    /** Applique des dimensions saisies (m ; `rot` en degrés pour un rectangle). */
    fun applyDims(shape: Shape, r: Double? = null, w: Double? = null, l: Double? = null, rot: Double? = null): Shape = when (shape) {
        is CircleShape -> if (r != null) shape.copy(radius = r2(r)) else shape
        is LineShape -> if (w != null) shape.copy(width = r2(w)) else shape
        is PolygonShape -> if (w == null || l == null) shape else if (isRectangle(shape.points)) {
            val deg = rot ?: rotationOf(shape)
            shape.copy(points = rebuildRect(centroid(shape.points), w, l, deg).map { Point(r3(it.x), r3(it.y)) })
        } else {
            val b = shapeBounds(shape)
            val kx = w / ((b.maxX - b.minX).let { if (it == 0.0) 1.0 else it })
            val ky = l / ((b.maxY - b.minY).let { if (it == 0.0) 1.0 else it })
            shape.copy(points = shape.points.map { Point(r2(b.minX + (it.x - b.minX) * kx), r2(b.minY + (it.y - b.minY) * ky)) })
        }
    }

    // ------------------------------------------------------------------ surfaces et avertissements

    fun isGround(z: Zone): Boolean = getZoneType(z.type)?.layer == "ground"

    private fun poly(z: Zone) = shapePolygon(z.shape, 48)

    fun overlapOf(a: Zone, b: Zone): Double = overlapArea(poly(a), poly(b))

    /** Zone qui dépasse du contour fermé du terrain. */
    fun isOut(g: Garden, z: Zone): Boolean {
        if (!(g.boundary.size >= 3 && g.boundaryClosed)) return false
        val p = poly(z)
        return p.size >= 3 && !polygonInside(p, g.boundary)
    }

    fun warnings(g: Garden, z: Zone): List<String> {
        val out = ArrayList<String>()
        if (isGround(z)) {
            for (o in g.zones) {
                if (o.id == z.id || !isGround(o)) continue
                val a = overlapOf(z, o)
                if (a > 0.1) out.add("Chevauche « ${o.label} » sur environ ${LengthInput.frArea(a)}. Deux zones au sol ne peuvent pas occuper le même endroit.")
            }
        }
        if (isOut(g, z)) out.add("Dépasse du contour du terrain.")
        return out
    }

    /** Nombre de chevauchements entre zones au sol, et ids concernés. */
    fun overlapIds(g: Garden): Pair<Int, Set<String>> {
        val ids = HashSet<String>(); var n = 0
        val ground = g.zones.filter { isGround(it) }
        for (i in ground.indices) for (j in i + 1 until ground.size) if (overlapOf(ground[i], ground[j]) > 0.1) { n++; ids.add(ground[i].id); ids.add(ground[j].id) }
        return n to ids
    }

    fun outCount(g: Garden): Int = g.zones.count { isOut(g, it) }

    /** Types à dessiner : souhaités et pas encore dessinés. */
    fun wishedToDraw(g: Garden): List<String> = g.wishedZoneTypes.filter { id -> g.zones.none { it.type == id } }

    /** Aide contextuelle (textes du web). */
    fun help(g: Garden, typeId: String?, kind: String?, rectMode: Boolean, draft: ZoneDraft?, circleWaiting: Boolean, selected: Zone?): String {
        if (typeId != null) {
            if (kind == "circle") return if (circleWaiting) "Touchez le bord du cercle (ou glissez) pour fixer le rayon." else "Touchez le centre, puis glissez ou touchez le bord pour le rayon. Appui long : saisir le rayon."
            if (kind == "line") return if (draft != null && draft.points.size >= 2) "Touchez pour ajouter un point, puis « Terminer »." else "Touchez chaque point du tracé, puis « Terminer ». Appui long : saisir longueur et largeur."
            if (kind == "polygon" && rectMode) return if (draft != null && draft.points.isNotEmpty()) "Touchez (ou glissez jusqu’à) le coin opposé du rectangle." else "Touchez un premier coin, puis le coin opposé. Appui long : saisir largeur × longueur."
            return if (draft != null && draft.points.size >= 3) "Touchez le 1er point (✔ vert) pour fermer la forme, ou continuez à poser des angles." else "Touchez chaque angle ; touchez le 1er point pour fermer la forme. Appui long : saisir les mesures."
        }
        if (selected != null) return "Glissez un rond pour déformer, un ＋ pour ajouter un sommet, ⟳ pour pivoter, la zone pour la déplacer. Appui long : dimensions en cm."
        return if (g.zones.isNotEmpty()) "Touchez une zone pour la sélectionner, ou choisissez un type pour en ajouter. Appui long sur une zone : dimensions." else "Choisissez un type de zone puis dessinez-la sur le plan."
    }

    fun newCopyMessage(label: String) = "Copie « $label » posée en décalé : glissez-la à sa place."
    fun removedMessage(label: String) = "Zone « $label » supprimée. Touchez ↶ pour la retrouver."
    fun addedMessage(label: String, shape: Shape) = "Zone « $label » ajoutée (${LengthInput.frArea(shapeArea(shape))}). Choisissez un autre type pour enchaîner, ou ↶ pour annuler."
}
