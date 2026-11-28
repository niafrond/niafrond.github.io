package fr.jardin.core.plan

import fr.jardin.core.Point
import fr.jardin.core.bearing
import fr.jardin.core.closeGapReport
import fr.jardin.core.distance
import fr.jardin.core.isSimplePolygon
import fr.jardin.core.perimeter
import fr.jardin.core.pointFromLengthBearing
import fr.jardin.core.polygonArea
import fr.jardin.core.snapPoint
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.round

/** État éditable du contour : sommets en mètres + forme fermée ou non. */
data class ContourState(val points: List<Point> = emptyList(), val closed: Boolean = false) {
    val n: Int get() = points.size
    val isClosed: Boolean get() = closed && n >= 3
    val area: Double get() = if (n >= 3) polygonArea(points) else 0.0
    val perimeterM: Double get() = if (n >= 2) perimeter(points, isClosed) else 0.0
    val isSimple: Boolean get() = n < 3 || isSimplePolygon(points)
    val sideCount: Int get() = PlanHit.sideCount(n, closed)
}

/** Résultat d'une demande de fermeture. */
sealed interface CloseResult {
    data class Closed(val state: ContourState) : CloseResult
    /** Écart de fermeture faible : proposer de le répartir sur les côtés. */
    data class AskGap(val gap: Double) : CloseResult
    data object TooFew : CloseResult
}

/** Historique annuler / rétablir générique, immuable (100 niveaux comme le web). */
data class History<T>(val past: List<T> = emptyList(), val future: List<T> = emptyList()) {
    val canUndo: Boolean get() = past.isNotEmpty()
    val canRedo: Boolean get() = future.isNotEmpty()
    fun record(current: T): History<T> = History((past + current).takeLast(LIMIT), emptyList())
    /** Renvoie (état à restaurer, nouvel historique) ou null. */
    fun undo(current: T): Pair<T, History<T>>? = past.lastOrNull()?.let { it to History(past.dropLast(1), future + current) }
    fun redo(current: T): Pair<T, History<T>>? = future.lastOrNull()?.let { it to History(past + current, future.dropLast(1)) }
    companion object { const val LIMIT = 100 }
}

/** Opérations pures du tracé du contour (port de `mountContourEditor`, ui/draw-contour.js). */
object ContourEdit {
    private fun r3(v: Double) = round(v * 1000) / 1000 + 0.0 // + 0.0 : évite -0.0
    private fun rp(p: Point) = Point(r3(p.x), r3(p.y))

    fun addPoint(s: ContourState, p: Point): ContourState = if (s.isClosed) s else s.copy(points = s.points + p, closed = false)

    fun movePoint(s: ContourState, i: Int, p: Point): ContourState =
        if (i !in s.points.indices) s else s.copy(points = s.points.toMutableList().also { it[i] = p })

    /** Insère un sommet au milieu (ou en `p`) du côté i -> i+1. Renvoie l'état et l'indice du nouveau sommet. */
    fun insertOnSide(s: ContourState, side: Int, p: Point? = null): Pair<ContourState, Int> {
        val n = s.n
        if (side !in 0 until s.sideCount) return s to -1
        val a = s.points[side]
        val b = s.points[(side + 1) % n]
        val q = p ?: Point((a.x + b.x) / 2, (a.y + b.y) / 2)
        val list = s.points.toMutableList()
        list.add(side + 1, q)
        return s.copy(points = list) to side + 1
    }

    fun deletePoint(s: ContourState, i: Int): ContourState {
        if (i !in s.points.indices) return s
        val list = s.points.toMutableList().also { it.removeAt(i) }
        return ContourState(list, if (list.size < 3) false else s.closed)
    }

    fun reopen(s: ContourState): ContourState = s.copy(closed = false)

    fun clear(): ContourState = ContourState()

    /** Fermeture : `fromTap` (toucher du 1er point) ferme toujours sans proposition. */
    fun tryClose(s: ContourState, fromTap: Boolean = false): CloseResult {
        val pts = s.points
        if (pts.size < 3) return CloseResult.TooFew
        val gap = distance(pts.last(), pts.first())
        val per = perimeter(pts, false)
        if (!fromTap && pts.size >= 4 && gap > 0.005 && gap < min(2.0, 0.1 * per)) return CloseResult.AskGap(gap)
        return CloseResult.Closed(s.copy(closed = true))
    }

    fun close(s: ContourState): ContourState = if (s.n >= 3) s.copy(closed = true) else s

    /** « Répartir l'écart et fermer » : le dernier point se confond avec le premier. */
    fun closeWithGapDistributed(s: ContourState): ContourState {
        val rep = closeGapReport(s.points)
        val pts = if (rep.corrected.isNotEmpty()) rep.corrected else s.points
        return ContourState(pts.dropLast(1).map { Point(it.x, it.y) }, true)
    }

    fun rectangle(origin: Point, w: Double, l: Double): ContourState = ContourState(
        listOf(Point(origin.x, origin.y), Point(origin.x + w, origin.y), Point(origin.x + w, origin.y + l), Point(origin.x, origin.y + l)).map(::rp),
        true,
    )

    fun isRect(s: ContourState): Boolean {
        val b = s.points
        if (b.size != 4 || !s.isClosed) return false
        return (0..3).all { k ->
            val p = b[k]; val q = b[(k + 1) % 4]; val r = b[(k + 2) % 4]
            val dot = (q.x - p.x) * (r.x - q.x) + (q.y - p.y) * (r.y - q.y)
            abs(dot) < 1e-3 * maxOf(1.0, distance(p, q) * distance(q, r))
        }
    }

    private fun shiftFrom(pts: MutableList<Point>, i: Int, dx: Double, dy: Double) {
        for (k in i until pts.size) pts[k] = Point(pts[k].x + dx, pts[k].y + dy)
    }

    private fun applyEdgeDelta(s: ContourState, pts: MutableList<Point>, i: Int, dx: Double, dy: Double) {
        if (isRect(s)) {
            val pair = listOf((i + 1) % 4, (i + 2) % 4)
            if (0 in pair) listOf(i % 4, (i + 3) % 4).forEach { k -> pts[k] = Point(pts[k].x - dx, pts[k].y - dy) }
            else pair.forEach { k -> pts[k] = Point(pts[k].x + dx, pts[k].y + dy) }
        } else shiftFrom(pts, i + 1, dx, dy)
    }

    /** Fixe la longueur du côté i (en m) : les sommets suivants se décalent (rectangle : reste rectangle). */
    fun setSideLength(s: ContourState, i: Int, len: Double): ContourState {
        if (!(len > 0) || i !in 0 until s.sideCount) return s
        val n = s.n
        val a = s.points[i]
        val b = s.points[(i + 1) % n]
        if (abs(distance(a, b) - len) < 0.0005) return s
        val last = s.isClosed && i == n - 1
        val brg = if (distance(a, b) > 1e-9) bearing(a, b) else 0.0
        val pts = s.points.toMutableList()
        if (last && !isRect(s)) {
            pts[i] = pointFromLengthBearing(b, len, bearing(b, a))
        } else {
            val nb = pointFromLengthBearing(a, len, if (last) bearing(b, a) + 180 else brg)
            applyEdgeDelta(s, pts, i, nb.x - b.x, nb.y - b.y)
        }
        return s.copy(points = pts)
    }

    /** Ajoute un côté de `len` m depuis le dernier sommet dans la direction `deg` (0 = haut, sens horaire). */
    fun addSegment(s: ContourState, len: Double, deg: Double): ContourState {
        if (!(len > 0) || !deg.isFinite() || s.isClosed) return s
        val pts = s.points.toMutableList()
        if (pts.isEmpty()) pts.add(Point(0.0, 0.0))
        val p = pointFromLengthBearing(pts.last(), len, ((deg % 360) + 360) % 360)
        pts.add(rp(p))
        return s.copy(points = pts, closed = false)
    }

    /** Longueur du côté i. */
    fun sideLength(s: ContourState, i: Int): Double =
        if (i in 0 until s.sideCount) distance(s.points[i], s.points[(i + 1) % s.n]) else 0.0

    // ------------------------------------------------------------------ aimantation

    /** Direction cardinale la plus proche d'un cap : 0 (haut), 90, 180, 270. */
    fun nearestCardinal(raw: Double): Double =
        listOf(0.0, 90.0, 180.0, 270.0).minByOrNull { abs((((raw - it) % 360) + 540) % 360 - 180) } ?: 90.0

    /**
     * Aimantation d'un point en cours de pose ou de déplacement : sommets existants (hors `exclude`), alignement
     * horizontal / vertical (équerre), angle droit avec le côté précédent, grille. `tol` en mètres.
     */
    fun snap(
        w: Point, s: ContourState, grid: Double?, magnet: Boolean = true, ortho: Boolean = true,
        tol: Double = 0.15, exclude: Int = -1, from: Point? = null, useDefaultFrom: Boolean = true,
    ): Point {
        val verts = s.points.filterIndexed { i, _ -> i != exclude }
        val last = if (from != null) from else if (useDefaultFrom && !s.isClosed && s.points.isNotEmpty()) s.points.last() else null
        val near = if (magnet) verts.minByOrNull { distance(it, w) }?.takeIf { distance(it, w) <= tol } else null
        if (near != null) return Point(near.x, near.y)
        var p = snapPoint(w, grid = grid?.takeIf { it > 0 }, points = null, tolerance = tol, orthoFrom = if (ortho) last else null)
        if (ortho && last != null) {
            val aligned = abs(p.x - last.x) < 1e-9 || abs(p.y - last.y) < 1e-9
            if (!aligned) {
                val idx = s.points.indexOf(last)
                val prev = if (idx > 0) s.points[idx - 1] else null
                if (prev != null) {
                    val dx = last.x - prev.x; val dy = last.y - prev.y
                    val len = hypot(dx, dy)
                    if (len > 1e-6) {
                        val ux = dx / len; val uy = dy / len
                        val cx = w.x - last.x; val cy = w.y - last.y
                        val along = cx * ux + cy * uy
                        if (abs(along) < tol) {
                            val t = -cx * uy + cy * ux
                            p = Point(last.x - uy * t, last.y + ux * t)
                        }
                    }
                }
            }
        }
        return p
    }

    // ------------------------------------------------------------------ messages (identiques au web)

    const val MSG_TOO_FEW = "Il faut au moins 3 sommets pour fermer le contour."
    const val MSG_BAD_LENGTH = "Saisissez une longueur en cm, par exemple 350 (ou 3,5 m)."
    const val MSG_EMPTY = "Touchez le plan pour poser le 1er sommet. Un appui long ouvre la saisie des dimensions en cm."
    const val MSG_OPEN = "Touchez pour ajouter un sommet, touchez une cote ou appuyez longuement sur un côté pour saisir sa longueur en cm. Touchez le sommet 1 pour fermer."
    const val MSG_CLOSED = "Touchez une cote (ou appuyez longuement sur un côté) pour la corriger en cm. Glissez un sommet pour le déplacer, tirez le point au milieu d'un côté pour ajouter un sommet."

    /** Message après fermeture (validité du contour). Renvoie (texte, gravité : "", "warn", "err"). */
    fun validityMessage(s: ContourState): Pair<String, String> = when {
        !s.isSimple -> "Attention : le contour se croise lui-même. Déplacez un sommet." to "err"
        s.area <= 1 -> "La surface doit dépasser 1 m²." to "warn"
        else -> "Contour fermé : ${LengthInput.frArea(s.area)}." to ""
    }

    /** Texte d'aide selon l'état (affiché quand aucun message n'est à montrer). */
    fun helpText(s: ContourState): String = when {
        s.n == 0 -> MSG_EMPTY
        !s.isClosed -> MSG_OPEN
        else -> MSG_CLOSED
    }
}
