package fr.jardin.core

import kotlin.math.*

// Extraits de jardin/gl-worker-core.js nécessaires à l'espacement : supports muraux et axe principal d'un polygone.

/** Segment de mur / clôture / maison pouvant servir de support. */
data class WallSegment(val a: Point, val b: Point, val h: Double)

/** Segments de mur / clôture / maison pouvant servir de support. */
fun wallSegments(garden: Garden?): List<WallSegment> {
    val out = ArrayList<WallSegment>()
    fun add(a: Point?, b: Point?, h: Double) {
        if (a != null && b != null && hypot(b.x - a.x, b.y - a.y) > 0.2) out.add(WallSegment(Point(a.x, a.y), Point(b.x, b.y), h))
    }
    fun hOr(h: Double?, d: Double) = if (h != null && h > 0) h else d
    for (o in garden?.obstacles ?: emptyList()) {
        val pts = o.points ?: emptyList()
        if (o.kind == "wall" || o.kind == "fence") {
            for (i in 0 until pts.size - 1) add(pts[i], pts[i + 1], hOr(o.height, if (o.kind == "wall") 2.0 else 1.2))
        } else if ((o.kind == "house" || o.kind == "shed") && pts.size >= 3) {
            for (i in pts.indices) add(pts[i], pts[(i + 1) % pts.size], min(3.0, hOr(o.height, 3.0)))
        }
    }
    val b = garden?.boundary ?: emptyList()
    val be = garden?.boundaryEdges ?: emptyList()
    for (i in b.indices) {
        val e = be.getOrNull(i)
        if (e != null && (e.kind == "wall" || e.kind == "fence")) add(b[i], b[(i + 1) % b.size], hOr(e.height, if (e.kind == "wall") 2.0 else 1.2))
    }
    return out
}

/** Axe principal d'un polygone (rectangle englobant d'aire minimale). */
data class PolyAxisResult(val ang: Double, val ux: Double, val uy: Double, val cx: Double, val cy: Double, val len: Double, val wid: Double)

fun polyAxis(poly: List<Point>): PolyAxisResult {
    var best: DoubleArray? = null // area, r, c, s, x0, x1, y0, y1
    var a = 0
    while (a < 180) {
        val r = a * PI / 180; val c = cos(r); val s = sin(r)
        var x0 = Double.POSITIVE_INFINITY; var x1 = Double.NEGATIVE_INFINITY; var y0 = Double.POSITIVE_INFINITY; var y1 = Double.NEGATIVE_INFINITY
        for (p in poly) {
            val u = p.x * c + p.y * s; val v = -p.x * s + p.y * c
            x0 = min(x0, u); x1 = max(x1, u); y0 = min(y0, v); y1 = max(y1, v)
        }
        val area = (x1 - x0) * (y1 - y0)
        if (best == null || area < best[0] - 1e-9) best = doubleArrayOf(area, r, c, s, x0, x1, y0, y1)
        a += 5
    }
    val bb = best!!
    val u = (bb[4] + bb[5]) / 2; val v = (bb[6] + bb[7]) / 2
    var ang = bb[1]; var len = bb[5] - bb[4]; var wid = bb[7] - bb[6]
    if (wid > len) { ang += PI / 2; val t = len; len = wid; wid = t }
    return PolyAxisResult(ang, cos(ang), sin(ang), u * bb[2] - v * bb[3], u * bb[3] + v * bb[2], len, wid)
}
