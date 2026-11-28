package fr.jardin.core

import kotlin.math.*

// Rotation des formes de zones (port de jardin/zone-rotate.js). Angles en degrés, sens horaire à l'écran,
// 0° = premier côté orienté vers la droite.

private const val RAD = PI / 180

/** Angle ramené dans [0, 360), arrondi à 1e-6 près. */
fun norm360(deg: Double?): Double {
    var a = jsRound((deg ?: 0.0).let { if (it.isNaN()) 0.0 else it } * 1e6) / 1e6
    a = ((a % 360) + 360) % 360
    return if (a >= 360) 0.0 else a
}

/** Points pivotés de `deg` degrés (sens horaire à l'écran) autour de `center` (centroïde par défaut). */
fun rotatePoints(points: List<Point>, deg: Double, center: Point? = null): List<Point> {
    val c = center ?: centroid(points)
    val cs = cos(deg * RAD); val sn = sin(deg * RAD)
    return points.map { p ->
        val dx = p.x - c.x; val dy = p.y - c.y
        Point(c.x + dx * cs - dy * sn, c.y + dx * sn + dy * cs)
    }
}

private fun shapePoints(shape: Shape?): List<Point> = when (shape) { is PolygonShape -> shape.points; is LineShape -> shape.points; else -> emptyList() }

/** Centre de rotation : centroïde d'un polygone, milieu moyen d'une ligne, centre d'un cercle. */
fun rotationCenter(shape: Shape?): Point = when (shape) {
    null -> Point(0.0, 0.0)
    is CircleShape -> Point(shape.center.x, shape.center.y)
    is LineShape -> {
        val pts = shape.points
        val n = if (pts.isEmpty()) 1 else pts.size
        Point(pts.sumOf { it.x } / n, pts.sumOf { it.y } / n)
    }
    is PolygonShape -> centroid(shape.points)
}

/** Vrai si la forme a une orientation (tout sauf le cercle). */
fun isRotatable(shape: Shape?): Boolean = shape != null && shape !is CircleShape && shapePoints(shape).size >= 2

/** Angle (0–359,99…) du premier côté : de points[0] vers points[1]. 0 pour un cercle. */
fun rotationOf(shape: Shape?): Double {
    if (!isRotatable(shape)) return 0.0
    val (a, b) = shapePoints(shape)
    if (hypot(b.x - a.x, b.y - a.y) < 1e-9) return 0.0
    return norm360(atan2(b.y - a.y, b.x - a.x) / RAD)
}

/** Nouvelle forme pivotée de `delta` degrés autour de son centre. Le cercle est rendu inchangé. */
fun rotateShapeBy(shape: Shape, delta: Double): Shape {
    if (!isRotatable(shape)) return shape
    val c = rotationCenter(shape)
    return when (shape) {
        is PolygonShape -> shape.copy(points = rotatePoints(shape.points, delta, c))
        is LineShape -> shape.copy(points = rotatePoints(shape.points, delta, c))
        else -> shape
    }
}

/** Nouvelle forme dont le premier côté est orienté à `deg` (pivot autour du centre). */
fun rotateShapeTo(shape: Shape, deg: Double): Shape = rotateShapeBy(shape, norm360(deg) - rotationOf(shape))

/** Rectangle (4 points) de largeur `w` (côté 0→1) et longueur `l` (côté 0→3), centré sur `center`, pivoté de `deg`. */
fun rebuildRect(center: Point, w: Double, l: Double, deg: Double = 0.0): List<Point> {
    val hw = w / 2; val hl = l / 2
    val pts = listOf(
        Point(center.x - hw, center.y - hl), Point(center.x + hw, center.y - hl),
        Point(center.x + hw, center.y + hl), Point(center.x - hw, center.y + hl),
    )
    return if (deg != 0.0) rotatePoints(pts, deg, center) else pts
}
