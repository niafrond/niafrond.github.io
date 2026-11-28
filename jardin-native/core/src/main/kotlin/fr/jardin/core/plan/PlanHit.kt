package fr.jardin.core.plan

import fr.jardin.core.Point
import fr.jardin.core.distance

/** Tests de toucher purs (tolérances en mètres : `view.px(14.0)` donne l'équivalent de 14 pixels). */
object PlanHit {
    /** Indice du sommet le plus proche à moins de `tol` m de `w`, -1 sinon. */
    fun vertexAt(points: List<Point>, w: Point, tol: Double): Int {
        var best = -1
        var bd = tol
        points.forEachIndexed { i, p -> val d = distance(p, w); if (d <= bd) { bd = d; best = i } }
        return best
    }

    /** Nombre de côtés d'un contour (n si fermé, n-1 sinon). */
    fun sideCount(n: Int, closed: Boolean): Int = if (n < 2) 0 else if (closed && n >= 3) n else n - 1

    /** Projection de `p` sur le segment [a, b] : point le plus proche (t borné à [0, 1]). */
    fun nearestOnSegment(p: Point, a: Point, b: Point): Pair<Point, Double> {
        val l2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)
        val t = if (l2 <= 0.0) 0.0 else (((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2).coerceIn(0.0, 1.0)
        return Point(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)) to t
    }

    /** Côté le plus proche à moins de `tol` m de `w` (indice du côté i -> i+1), -1 sinon. */
    fun sideAt(points: List<Point>, closed: Boolean, w: Point, tol: Double): Int {
        val n = points.size
        var best = -1
        var bd = tol
        for (i in 0 until sideCount(n, closed)) {
            val (q, _) = nearestOnSegment(w, points[i], points[(i + 1) % n])
            val d = distance(w, q)
            if (d <= bd) { bd = d; best = i }
        }
        return best
    }

    /**
     * Côté dont le milieu (poignée « + » ou étiquette de cote) est touché ; les côtés plus courts que `minLen` m
     * n'ont pas de poignée.
     */
    fun midAt(points: List<Point>, closed: Boolean, w: Point, tol: Double, minLen: Double): Int {
        val n = points.size
        var best = -1
        var bd = tol
        for (i in 0 until sideCount(n, closed)) {
            val a = points[i]
            val b = points[(i + 1) % n]
            if (distance(a, b) < minLen) continue
            val d = distance(Point((a.x + b.x) / 2, (a.y + b.y) / 2), w)
            if (d <= bd) { bd = d; best = i }
        }
        return best
    }

    /** Un polygone (ou une polyligne) est-il touché ? Utilitaire générique pour obstacles et zones. */
    fun inside(points: List<Point>, w: Point): Boolean = points.size >= 3 && fr.jardin.core.pointInPolygon(w, points)
}
