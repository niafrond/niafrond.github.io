package fr.jardin.core

import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.*

// Géométrie pure du jardin (port de jardin/geometry.js). Unités : mètres, x vers la droite, y vers le bas.
// Cap/azimut : degrés depuis le haut du plan, sens horaire.

private const val EPS = 1e-9
private const val RAYON_TERRE = 6371008.8 // m

internal fun rad(d: Double) = d * PI / 180
internal fun deg(r: Double) = r * 180 / PI

/** Arrondi JS (`Math.round`) : demi vers +∞. */
internal fun jsRound(x: Double): Double = floor(x + 0.5)

data class Bounds(val minX: Double, val minY: Double, val maxX: Double, val maxY: Double, val width: Double, val height: Double)

/** Distance euclidienne entre deux points. */
fun distance(a: Point, b: Point): Double = hypot(b.x - a.x, b.y - a.y)

/** Aire signée (lacet) : positive si le sens est horaire à l'écran (y vers le bas). */
fun signedArea(points: List<Point>): Double {
    var s = 0.0
    val n = points.size
    for (i in 0 until n) {
        val p = points[i]
        val q = points[(i + 1) % n]
        s += p.x * q.y - q.x * p.y
    }
    return s / 2
}

/** Aire du polygone (≥ 0). */
fun polygonArea(points: List<Point>?): Double {
    if (points == null || points.size < 3) return 0.0
    return abs(signedArea(points))
}

/** Périmètre ; `closed` ajoute le côté de fermeture. */
fun perimeter(points: List<Point>?, closed: Boolean = true): Double {
    if (points == null || points.size < 2) return 0.0
    var s = 0.0
    for (i in 0 until points.size - 1) s += distance(points[i], points[i + 1])
    if (closed && points.size > 2) s += distance(points[points.size - 1], points[0])
    return s
}

/** Centre de gravité (repli sur la moyenne des sommets si aire nulle). */
fun centroid(points: List<Point>?): Point {
    if (points == null || points.isEmpty()) return Point(0.0, 0.0)
    val a = signedArea(points)
    val n = points.size
    if (abs(a) < EPS) {
        return Point(points.sumOf { it.x } / n, points.sumOf { it.y } / n)
    }
    var cx = 0.0
    var cy = 0.0
    for (i in 0 until n) {
        val p = points[i]
        val q = points[(i + 1) % n]
        val f = p.x * q.y - q.x * p.y
        cx += (p.x + q.x) * f
        cy += (p.y + q.y) * f
    }
    return Point(cx / (6 * a), cy / (6 * a))
}

/** Boîte englobante. */
fun bounds(points: List<Point>?): Bounds {
    if (points == null || points.isEmpty()) return Bounds(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    var minX = Double.POSITIVE_INFINITY; var minY = Double.POSITIVE_INFINITY
    var maxX = Double.NEGATIVE_INFINITY; var maxY = Double.NEGATIVE_INFINITY
    for (p in points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
    }
    return Bounds(minX, minY, maxX, maxY, maxX - minX, maxY - minY)
}

internal fun surSegment(p: Point, a: Point, b: Point, tol: Double = 1e-9): Boolean {
    val cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    val len = hypot(b.x - a.x, b.y - a.y)
    if (len < EPS) return hypot(p.x - a.x, p.y - a.y) <= tol
    if (abs(cross) / len > tol) return false
    val dot = (p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)
    return dot >= -tol * len && dot <= len * len + tol * len
}

/** Point dans le polygone (bord compris). Lancer de rayon. */
fun pointInPolygon(p: Point, points: List<Point>): Boolean {
    val n = points.size
    if (n < 3) return false
    var dedans = false
    var j = n - 1
    for (i in 0 until n) {
        val a = points[i]
        val b = points[j]
        if (surSegment(p, a, b)) return true
        if ((a.y > p.y) != (b.y > p.y)) {
            val xi = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
            if (p.x < xi) dedans = !dedans
        }
        j = i
    }
    return dedans
}

internal fun orient(a: Point, b: Point, c: Point): Int {
    val v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    return if (abs(v) < EPS) 0 else if (v > 0) 1 else -1
}

/** Les segments [a,b] et [c,d] se coupent ou se touchent-ils ? */
fun segmentsIntersect(a: Point, b: Point, c: Point, d: Point): Boolean {
    val o1 = orient(a, b, c)
    val o2 = orient(a, b, d)
    val o3 = orient(c, d, a)
    val o4 = orient(c, d, b)
    if (o1 != o2 && o3 != o4) return true
    if (o1 == 0 && surSegment(c, a, b)) return true
    if (o2 == 0 && surSegment(d, a, b)) return true
    if (o3 == 0 && surSegment(a, c, d)) return true
    if (o4 == 0 && surSegment(b, c, d)) return true
    return false
}

/** Polygone simple : ≥ 3 sommets, aire non nulle, aucune auto-intersection. */
fun isSimplePolygon(points: List<Point>?): Boolean {
    val n = points?.size ?: 0
    if (points == null || n < 3) return false
    if (polygonArea(points) < EPS) return false
    for (i in 0 until n) {
        val a = points[i]
        val b = points[(i + 1) % n]
        if (distance(a, b) < EPS) return false
        for (j in i + 1 until n) {
            val c = points[j]
            val d = points[(j + 1) % n]
            val adjacents = j == i + 1 || (i == 0 && j == n - 1)
            if (adjacents) {
                if (j == i + 1) {
                    if (surSegment(d, a, b) || surSegment(a, c, d)) return false
                } else if (surSegment(c, a, b) || surSegment(b, c, d)) {
                    return false
                }
                continue
            }
            if (segmentsIntersect(a, b, c, d)) return false
        }
    }
    return true
}

private fun ligneEpaissie(points: List<Point>, width: Double): List<Point> {
    val h = width / 2
    if (points.size < 2) return emptyList()
    val normales = ArrayList<Point>()
    for (i in points.indices) {
        val prev = points[max(0, i - 1)]
        val next = points[min(points.size - 1, i + 1)]
        var dx1 = points[i].x - prev.x
        var dy1 = points[i].y - prev.y
        var dx2 = next.x - points[i].x
        var dy2 = next.y - points[i].y
        val l1 = hypot(dx1, dy1)
        val l2 = hypot(dx2, dy2)
        if (l1 < EPS) { dx1 = dx2; dy1 = dy2 }
        if (l2 < EPS) { dx2 = dx1; dy2 = dy1 }
        val n1 = hypot(dx1, dy1).let { if (it == 0.0) 1.0 else it }
        val n2 = hypot(dx2, dy2).let { if (it == 0.0) 1.0 else it }
        val nx1 = -dy1 / n1
        val ny1 = dx1 / n1
        val nx2 = -dy2 / n2
        val ny2 = dx2 / n2
        var mx = nx1 + nx2
        var my = ny1 + ny2
        val ml = hypot(mx, my)
        if (ml < 1e-6) { mx = nx1; my = ny1 } else { mx /= ml; my /= ml }
        val cos = max(0.3, mx * nx1 + my * ny1)
        normales.add(Point(mx * h / cos, my * h / cos))
    }
    val gauche = points.mapIndexed { i, p -> Point(p.x + normales[i].x, p.y + normales[i].y) }
    val droite = points.mapIndexed { i, p -> Point(p.x - normales[i].x, p.y - normales[i].y) }
    return gauche + droite.reversed()
}

/** Polygone d'une forme de zone (cercle échantillonné, ligne épaissie). */
fun shapePolygon(shape: Shape?, segments: Int = 24): List<Point> = when (shape) {
    null -> emptyList()
    is PolygonShape -> shape.points.map { Point(it.x, it.y) }
    is CircleShape -> List(segments) { i ->
        val t = 2 * PI * i / segments
        Point(shape.center.x + shape.radius * cos(t), shape.center.y + shape.radius * sin(t))
    }
    is LineShape -> ligneEpaissie(shape.points, shape.width)
}

/** Aire d'une forme (cercle exact, ligne = polygone épaissi). */
fun shapeArea(shape: Shape?): Double {
    if (shape == null) return 0.0
    if (shape is CircleShape) return PI * shape.radius * shape.radius
    return polygonArea(shapePolygon(shape))
}

/** Boîte englobante d'une forme. */
fun shapeBounds(shape: Shape?): Bounds {
    if (shape is CircleShape) {
        val c = shape.center; val r = shape.radius
        return Bounds(c.x - r, c.y - r, c.x + r, c.y + r, 2 * r, 2 * r)
    }
    return bounds(shapePolygon(shape))
}

/** Aire de recouvrement de deux polygones, par échantillonnage (centres de cellules de 0,05 m). */
fun overlapArea(polyA: List<Point>?, polyB: List<Point>?): Double {
    if (polyA == null || polyB == null || polyA.size < 3 || polyB.size < 3) return 0.0
    val a = bounds(polyA)
    val b = bounds(polyB)
    val minX = max(a.minX, b.minX)
    val maxX = min(a.maxX, b.maxX)
    val minY = max(a.minY, b.minY)
    val maxY = min(a.maxY, b.maxY)
    if (maxX <= minX || maxY <= minY) return 0.0
    var pas = 0.05
    val cellules = ((maxX - minX) / pas) * ((maxY - minY) / pas)
    if (cellules > 1e6) pas *= sqrt(cellules / 1e6)
    var n = 0
    var y = minY + pas / 2
    while (y < maxY) {
        var x = minX + pas / 2
        while (x < maxX) {
            val p = Point(x, y)
            if (pointInPolygon(p, polyA) && pointInPolygon(p, polyB)) n++
            x += pas
        }
        y += pas
    }
    return n * pas * pas
}

/** `inner` est-il entièrement dans `outer` (bord compris) ? */
fun polygonInside(inner: List<Point>?, outer: List<Point>?): Boolean {
    if (inner == null || inner.isEmpty() || outer == null || outer.size < 3) return false
    for (p in inner) if (!pointInPolygon(p, outer)) return false
    val n = inner.size
    val m = outer.size
    for (i in 0 until n) {
        val a = inner[i]
        val b = inner[(i + 1) % n]
        for (j in 0 until m) {
            val c = outer[j]
            val d = outer[(j + 1) % m]
            if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return false
        }
        val mid = Point((a.x + b.x) / 2, (a.y + b.y) / 2)
        if (!pointInPolygon(mid, outer)) return false
    }
    return true
}

/**
 * Aimantation d'un point. Priorité : sommets existants, alignement orthogonal (`orthoFrom`), grille.
 */
fun snapPoint(p: Point, grid: Double? = null, points: List<Point>? = null, tolerance: Double = 0.15, orthoFrom: Point? = null): Point {
    if (points != null && points.isNotEmpty()) {
        var meilleur: Point? = null
        var dMin = tolerance
        for (q in points) {
            val d = distance(p, q)
            if (d <= dMin) { dMin = d; meilleur = q }
        }
        if (meilleur != null) return Point(meilleur.x, meilleur.y)
    }
    var rx = p.x
    var ry = p.y
    var fixeX = false
    var fixeY = false
    if (orthoFrom != null) {
        val dx = abs(p.x - orthoFrom.x)
        val dy = abs(p.y - orthoFrom.y)
        if (dx <= tolerance && dx <= dy) { rx = orthoFrom.x; fixeX = true }
        else if (dy <= tolerance) { ry = orthoFrom.y; fixeY = true }
    }
    if (grid != null && grid > 0) {
        fun toFixed10(v: Double) = BigDecimal(v).setScale(10, RoundingMode.HALF_UP).toDouble()
        if (!fixeX) rx = toFixed10(jsRound(rx / grid) * grid)
        if (!fixeY) ry = toFixed10(jsRound(ry / grid) * grid)
    }
    return Point(rx, ry)
}

/** Point à `length` m de `from` dans la direction `bearingDeg` (0 = haut du plan, sens horaire). */
fun pointFromLengthBearing(from: Point, length: Double, bearingDeg: Double): Point {
    val t = rad(bearingDeg)
    return Point(from.x + length * sin(t), from.y - length * cos(t))
}

/** Cap de a vers b en degrés [0, 360), 0 = haut du plan, sens horaire. */
fun bearing(a: Point, b: Point): Double {
    val d = deg(atan2(b.x - a.x, -(b.y - a.y)))
    return (d + 360) % 360
}

data class CloseGapReport(val gap: Double, val dx: Double, val dy: Double, val corrected: List<Point>)

/** Écart de fermeture d'un contour saisi comme ligne ouverte, et points corrigés proportionnellement. */
fun closeGapReport(points: List<Point>?): CloseGapReport {
    if (points == null || points.size < 2) return CloseGapReport(0.0, 0.0, 0.0, points?.toList() ?: emptyList())
    val first = points[0]
    val last = points[points.size - 1]
    val dx = first.x - last.x
    val dy = first.y - last.y
    val gap = hypot(dx, dy)
    val total = perimeter(points, false)
    var cum = 0.0
    val corrected = points.mapIndexed { i, p ->
        if (i > 0) cum += distance(points[i - 1], p)
        val f = if (total > EPS) cum / total else i.toDouble() / (points.size - 1)
        Point(p.x + dx * f, p.y + dy * f)
    }
    return CloseGapReport(gap, dx, dy, corrected)
}

/** Translate un polygone (nouveaux points). */
fun translatePolygon(points: List<Point>, dx: Double, dy: Double): List<Point> = points.map { Point(it.x + dx, it.y + dy) }

/** Distance orthodromique (m) entre deux positions. */
fun haversine(a: LatLon, b: LatLon): Double {
    val p1 = rad(a.lat)
    val p2 = rad(b.lat)
    val dLat = p2 - p1
    val dLon = rad(b.lon - a.lon)
    val h = sin(dLat / 2).pow(2) + cos(p1) * cos(p2) * sin(dLon / 2).pow(2)
    return 2 * RAYON_TERRE * asin(min(1.0, sqrt(h)))
}

data class LocalProjection(val points: List<Point>, val origin: LatLon)

/** Projection plan tangent : x = est (m), y = −nord (m), relative à `origin` (par défaut le 1er point). */
fun gpsToLocal(latlons: List<LatLon>, origin: LatLon? = null): LocalProjection {
    val o = origin ?: if (latlons.isNotEmpty()) LatLon(latlons[0].lat, latlons[0].lon) else LatLon(0.0, 0.0)
    val k = cos(rad(o.lat))
    val points = latlons.map { q -> Point(rad(q.lon - o.lon) * RAYON_TERRE * k, -rad(q.lat - o.lat) * RAYON_TERRE) }
    return LocalProjection(points, LatLon(o.lat, o.lon))
}

/** Inverse de `gpsToLocal` pour un point. */
fun localToGps(point: Point, origin: LatLon): LatLon {
    val k = cos(rad(origin.lat))
    return LatLon(origin.lat + deg(-point.y / RAYON_TERRE), origin.lon + deg(point.x / (RAYON_TERRE * k)))
}
