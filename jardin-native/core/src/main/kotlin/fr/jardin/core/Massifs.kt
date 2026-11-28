package fr.jardin.core

import fr.jardin.core.Ambiances.getAmbiance
import fr.jardin.core.Ambiances.plantAmbianceScore
import fr.jardin.core.Ambiances.plantAvoids
import fr.jardin.core.Maintenance.fitsMaintenance
import fr.jardin.core.Maintenance.plantEffort
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Massifs automatiques (port de jardin/massifs.js) : espace libre, propositions de massifs, combinaison de plantes,
// conversion en zones. Moteur pur et déterministe. Repère : mètres, x vers la droite, y vers le bas.
// Les PRNG (mulberry32, FNV-1a) et le tri de V8 (comparateur à effets de bord) sont reproduits à l'identique.

/** Options de `proposeBeds`. */
data class BedOptions(
    val seed: Number = 1,
    val coverage: Double = 0.5,
    val minArea: Double = 2.0,
    val maxArea: Double = 20.0,
    val maxBeds: Int = 12,
    /** 'mixed' | 'borders' | 'islands'. */
    val style: String = "mixed",
    val ambiance: String? = null,
    val maintenance: String? = null,
    val budget: Double? = null,
    /** 'auto' | 'chaud' | 'froid' | 'pastel' | 'blanc' | 'vif'. */
    val palette: String? = "auto",
    val plants: List<Plant>? = null,
    val allowLawn: Boolean = false,
    val cell: Double? = null,
    val margin: Double? = null,
    val clearances: Map<String, Double>? = null,
    val design: Boolean = true,
    val tminC: Double? = null,
)

/** Options de `designBed` (`ambiance`/`maintenance` : voir `Maybe`). */
data class DesignOptions(
    val seed: Number = 1,
    val ambiance: Maybe<String>? = null,
    val maintenance: Maybe<String>? = null,
    val budget: Double? = null,
    val palette: String? = null,
    val plants: List<Plant>? = null,
    val tminC: Double? = null,
    val iterations: Int? = null,
)

/** Résumé chiffré d'une combinaison de plantes. */
data class BedSummary(
    val bloomMonths: List<Int>,
    val layers: Int,
    val palette: String,
    val families: List<String>,
    val costEur: Double,
    val effort: Double,
    val species: Int,
    val melliferous: Int,
    val density: Double,
)

/** Variante d'une combinaison (autre palette, autre ambiance). */
data class BedAlternative(
    val label: String, val palette: String?, val ambiance: String?,
    val plantings: List<Planting>, val summary: BedSummary, val why: String,
)

data class DesignResult(val plantings: List<Planting>, val summary: BedSummary, val why: String, val alternatives: List<BedAlternative>)

/**
 * Massif proposé (ou saisi à la main pour `designBed` / `bedsToZones`). `sunLevelGiven` faux : `designBed` calcule
 * l'ensoleillement dominant (champ `sunLevel` absent du JS).
 */
data class Bed(
    val id: String = "",
    val role: String? = null,
    val shape: Shape,
    val areaM2: Double = 0.0,
    val widthM: Double = 0.0,
    val sunLevel: String? = null,
    val score: Int = 0,
    val why: String = "",
    val plantings: List<Planting> = emptyList(),
    val summary: BedSummary? = null,
    val plantsWhy: String? = null,
    val alternatives: List<BedAlternative> = emptyList(),
    val ambiance: String? = null,
    val seed: Double? = null,
    val sunLevelGiven: Boolean = true,
)

/** Zone libre connexe (cellules de la grille). */
class FreeComponent(val cells: IntArray, val areaM2: Double, val centroid: Point, val bounds: Bounds)

class Blocker(val minX: Double, val minY: Double, val maxX: Double, val maxY: Double, val test: (Double, Double) -> Boolean)

/** Grille d'occupation du terrain. */
class FreeSpace internal constructor(
    val cell: Double, val minX: Double, val minY: Double, val nx: Int, val ny: Int, val grid: ByteArray, val freeArea: Double,
    private val freeFn: (Double, Double) -> Boolean,
) {
    fun isFree(x: Double, y: Double): Boolean = freeFn(x, y)
    fun cellCenter(i: Int, j: Int): Point = Point(minX + (i + 0.5) * cell, minY + (j + 0.5) * cell)

    /** Zones libres connexes (4-voisinage), triées par surface décroissante. */
    fun components(): List<FreeComponent> {
        val seen = ByteArray(grid.size)
        val out = ArrayList<FreeComponent>()
        for (s in grid.indices) {
            if (grid[s].toInt() == 0 || seen[s].toInt() != 0) continue
            val stack = ArrayList<Int>(); stack.add(s); seen[s] = 1
            val cells = ArrayList<Int>()
            while (stack.isNotEmpty()) {
                val c = stack.removeAt(stack.size - 1); cells.add(c)
                val ci = c % nx; val cj = (c - ci) / nx
                for ((di, dj) in DIRS) {
                    val ii = ci + di; val jj = cj + dj
                    if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue
                    val k = jj * nx + ii
                    if (grid[k].toInt() != 0 && seen[k].toInt() == 0) { seen[k] = 1; stack.add(k) }
                }
            }
            var sx = 0.0; var sy = 0.0
            var minI = Int.MAX_VALUE; var maxI = Int.MIN_VALUE; var minJ = Int.MAX_VALUE; var maxJ = Int.MIN_VALUE
            for (c in cells) {
                val ci = c % nx; val cj = (c - ci) / nx
                sx += ci; sy += cj
                minI = min(minI, ci); maxI = max(maxI, ci); minJ = min(minJ, cj); maxJ = max(maxJ, cj)
            }
            val b = Bounds(minX + minI * cell, minY + minJ * cell, minX + (maxI + 1) * cell, minY + (maxJ + 1) * cell,
                (maxI + 1 - minI) * cell, (maxJ + 1 - minJ) * cell)
            out.add(FreeComponent(cells.toIntArray(), cells.size * cell * cell,
                Point(minX + (sx / cells.size + 0.5) * cell, minY + (sy / cells.size + 0.5) * cell), b))
        }
        return out.sortedWith { a, b -> b.areaM2.compareTo(a.areaM2) }
    }

    /** Distance (m) de chaque cellule libre à la cellule non libre la plus proche (chanfrein 3-4), en Float32 comme le JS. */
    fun distanceMap(): FloatArray {
        val inf = 1e9f
        val d = FloatArray(grid.size)
        for (k in d.indices) d[k] = if (grid[k].toInt() != 0) inf else 0f
        fun at(i: Int, j: Int): Double = if (i < 0 || j < 0 || i >= nx || j >= ny) 0.0 else d[j * nx + i].toDouble()
        for (j in 0 until ny) for (i in 0 until nx) {
            val k = j * nx + i; if (grid[k].toInt() == 0) continue
            d[k] = minOf(d[k].toDouble(), at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.414, at(i + 1, j - 1) + 1.414).toFloat()
        }
        for (j in ny - 1 downTo 0) for (i in nx - 1 downTo 0) {
            val k = j * nx + i; if (grid[k].toInt() == 0) continue
            d[k] = minOf(d[k].toDouble(), at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.414, at(i - 1, j + 1) + 1.414).toFloat()
        }
        for (k in d.indices) d[k] = if (grid[k].toInt() != 0) ((d[k].toDouble() - 0.5) * cell).toFloat() else 0f
        return d
    }

    private companion object { val DIRS = listOf(1 to 0, -1 to 0, 0 to 1, 0 to -1) }
}

data class RegenerateResult(val beds: List<Bed>, val zones: List<Zone>, val added: List<Zone>, val kept: List<String>, val removed: List<String>)

object Massifs {
    val FLOWER_ZONE_TYPES = listOf("lowplants", "midplants", "tallplants")
    /** Zone « massif » (plantes basses, moyennes ou hautes) ? */
    fun isFlowerZone(zone: Zone?): Boolean = zone != null && zone.type in FLOWER_ZONE_TYPES

    // ---------------------------------------------------------------- utilitaires
    private fun clamp(v: Double, a: Double, b: Double) = min(b, max(a, v))
    private fun r1(n: Double) = jsRound(n * 10) / 10
    private fun r3(n: Double) = jsRound(n * 1000) / 1000
    private fun fr(n: Double) = jsNumStr(r1(n)).replace('.', ',')
    private fun cap(s: String) = if (s.isEmpty()) s else s.substring(0, 1).uppercase() + s.substring(1)
    private val MONTHS = listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")
    private fun hyp(x: Double, y: Double) = jsHypot(x, y)
    private fun cosd(x: Double) = StrictMath.cos(x)
    private fun sind(x: Double) = StrictMath.sin(x)

    /** `rngFrom(seed)` : `(Number(seed) || 1) >>> 0` puis mulberry32. */
    private fun rngFrom(seed: Double): Mulberry32 = Mulberry32(toUint32(if (seed.isNaN() || seed == 0.0) 1.0 else seed))
    private fun hashStr(s: String): Double = (hash32(s).toLong() and 0xFFFFFFFFL).toDouble()

    private fun segDist(p: Point, a: Point, b: Point): Double {
        val dx = b.x - a.x; val dy = b.y - a.y
        val l2 = dx * dx + dy * dy
        var t = if (l2 != 0.0) ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 else 0.0
        t = clamp(t, 0.0, 1.0)
        return hyp(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
    }
    private fun edgeDist(p: Point, poly: List<Point>, closed: Boolean = true): Double {
        var best = Double.POSITIVE_INFINITY
        val n = poly.size
        val cnt = if (closed) n else n - 1
        for (i in 0 until cnt) best = min(best, segDist(p, poly[i], poly[(i + 1) % n]))
        return best
    }
    /** Distance d'un point à un polygone (0 dedans). */
    private fun polyDist(p: Point, poly: List<Point>): Double {
        if (poly.size >= 3 && pointInPolygon(p, poly)) return 0.0
        return edgeDist(p, poly)
    }
    private fun polysDistance(a: List<Point>, b: List<Point>): Double {
        var best = Double.POSITIVE_INFINITY
        for (p in a) best = min(best, polyDist(p, b))
        for (p in b) best = min(best, polyDist(p, a))
        return best
    }

    /** Recouvrement strict de deux polygones convexes (SAT) ; `eps` = pénétration tolérée (m). */
    private fun convexOverlap(a: List<Point>, b: List<Point>, eps: Double = 1e-3): Boolean {
        for (poly in listOf(a, b)) {
            for (i in poly.indices) {
                val p = poly[i]; val q = poly[(i + 1) % poly.size]
                var nx = -(q.y - p.y); var ny = q.x - p.x
                val l = hyp(nx, ny).let { if (it == 0.0) 1.0 else it }
                nx /= l; ny /= l
                var minA = Double.POSITIVE_INFINITY; var maxA = Double.NEGATIVE_INFINITY
                var minB = Double.POSITIVE_INFINITY; var maxB = Double.NEGATIVE_INFINITY
                for (pt in a) { val d = pt.x * nx + pt.y * ny; if (d < minA) minA = d; if (d > maxA) maxA = d }
                for (pt in b) { val d = pt.x * nx + pt.y * ny; if (d < minB) minB = d; if (d > maxB) maxB = d }
                if (maxA <= minB + eps || maxB <= minA + eps) return false
            }
        }
        return true
    }

    // ---------------------------------------------------------------- espace libre
    private val DEFAULT_CLEARANCES = mapOf(
        "pool" to 1.0, "pond" to 0.5, "opening" to 0.9, "existing" to 0.3, "obstacle" to 0.0, "terrace" to 0.0, "path" to 0.0, "other" to 0.0, "bed" to 0.0,
    )

    private fun polyBlocker(poly: List<Point>, d: Double): Blocker {
        val bb = bounds(poly)
        val minX = bb.minX - d; val minY = bb.minY - d; val maxX = bb.maxX + d; val maxY = bb.maxY + d
        return Blocker(minX, minY, maxX, maxY) { x, y ->
            if (x < minX || x > maxX || y < minY || y > maxY) false
            else {
                val p = Point(x, y)
                if (pointInPolygon(p, poly)) true else d > 0 && edgeDist(p, poly) <= d
            }
        }
    }
    private fun circleBlocker(c: Point, r: Double, d: Double): Blocker {
        val rr = r + d
        return Blocker(c.x - rr, c.y - rr, c.x + rr, c.y + rr) { x, y -> hyp(x - c.x, y - c.y) <= rr }
    }
    private fun lineBlocker(points: List<Point>, half: Double): Blocker {
        val bb = bounds(points)
        val minX = bb.minX - half; val minY = bb.minY - half; val maxX = bb.maxX + half; val maxY = bb.maxY + half
        return Blocker(minX, minY, maxX, maxY) { x, y ->
            if (x < minX || x > maxX || y < minY || y > maxY) false else edgeDist(Point(x, y), points, false) <= half
        }
    }

    /** Empreintes des plantes existantes conservées. */
    private fun existingPolys(garden: Garden?): List<List<Point>> {
        val out = ArrayList<List<Point>>()
        try {
            for (f in existingFootprints(garden)) {
                if (!f.keep) continue
                if (f.polygon.size >= 3) out.add(f.polygon)
            }
        } catch (_: Exception) { /* repli : rien */ }
        return out
    }

    /**
     * Grille d'occupation du terrain. Une cellule est libre si son centre est dans le contour et hors de tout ce qui est
     * occupé : zones non-massif (piscine +1 m, mare +0,5 m, terrasse, allée, potager, haie, arbres… ; pelouse seulement si
     * `allowLawn` la libère), massifs déjà dessinés, mobilier (+`margin`), obstacles (maison, abri, murs, arbres + `margin`),
     * houppiers, plantes existantes (+0,3 m), dégagement des ouvertures (0,9 m).
     */
    fun freeSpace(
        garden: Garden?, cell: Double = 0.25, margin: Double = 0.3, clearances: Map<String, Double>? = null,
        allowLawn: Boolean = false, ignoreIds: List<String> = emptyList(),
    ): FreeSpace {
        val cl = HashMap<String, Double>(DEFAULT_CLEARANCES)
        cl["furniture"] = margin; cl["tree"] = margin
        if (clearances != null) cl.putAll(clearances)
        val contour = garden?.boundary ?: emptyList()
        val ignore = ignoreIds.toSet()
        val blockers = ArrayList<Blocker>()
        fun c(k: String): Double = cl[k]?.takeIf { !it.isNaN() } ?: 0.0

        for (z in garden?.zones ?: emptyList()) {
            if (z.id in ignore || z.shape == null) continue
            if (z.type == "lawn" && allowLawn) continue
            val d = c(z.type)
            when (val sh = z.shape) {
                is CircleShape -> blockers.add(circleBlocker(sh.center, sh.radius, d + (if (z.type == "trees") c("tree") else 0.0)))
                is LineShape -> blockers.add(lineBlocker(sh.points, (if (sh.width != 0.0) sh.width else 1.0) / 2 + d))
                else -> {
                    val poly = shapePolygon(sh)
                    if (poly.size >= 3) blockers.add(polyBlocker(poly, d + (if (z.type == "trees") c("tree") else 0.0)))
                }
            }
        }
        for (it in garden?.items ?: emptyList()) {
            val r = itemRadius(it)
            if (r != null) blockers.add(circleBlocker(Point(it.x, it.y), r, c("furniture")))
            else blockers.add(polyBlocker(itemPolygon(it), c("furniture")))
        }
        for (ob in garden?.obstacles ?: emptyList()) {
            if (ob.center != null && ob.radius != null && ob.points == null) { blockers.add(circleBlocker(ob.center, ob.radius, c("tree"))); continue }
            val pts = ob.points ?: emptyList()
            if (pts.size >= 3 && (ob.kind == "house" || ob.kind == "shed")) blockers.add(polyBlocker(pts, c("obstacle")))
            else if (pts.size >= 2) blockers.add(lineBlocker(pts, (ob.thickness?.takeIf { it != 0.0 && !it.isNaN() } ?: (if (ob.kind == "wall") 0.2 else 0.05)) / 2 + c("obstacle")))
        }
        for (poly in existingPolys(garden)) blockers.add(polyBlocker(poly, c("existing")))
        for (op in garden?.openings ?: emptyList()) {
            var g: OpeningGeometry? = null
            try { g = openingGeometry(garden, op) } catch (_: Exception) { g = null }
            if (g == null) continue
            val hw = g.width / 2 + 0.3
            val u = g.u; val n = g.normal; val ce = g.center
            val dd = c("opening")
            blockers.add(polyBlocker(listOf(
                Point(ce.x - u.x * hw - n.x * dd, ce.y - u.y * hw - n.y * dd),
                Point(ce.x + u.x * hw - n.x * dd, ce.y + u.y * hw - n.y * dd),
                Point(ce.x + u.x * hw + n.x * dd, ce.y + u.y * hw + n.y * dd),
                Point(ce.x - u.x * hw + n.x * dd, ce.y - u.y * hw + n.y * dd),
            ), 0.0))
        }

        val isFree: (Double, Double) -> Boolean = fn@{ x, y ->
            if (!(contour.size >= 3 && pointInPolygon(Point(x, y), contour))) return@fn false
            for (b in blockers) {
                if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue
                if (b.test(x, y)) return@fn false
            }
            true
        }

        val bb = bounds(contour)
        val nx = if (contour.size >= 3) max(1, ceil(bb.width / cell).toInt()) else 0
        val ny = if (contour.size >= 3) max(1, ceil(bb.height / cell).toInt()) else 0
        val grid = ByteArray(nx * ny)
        var nFree = 0
        for (j in 0 until ny) for (i in 0 until nx) {
            if (isFree(bb.minX + (i + 0.5) * cell, bb.minY + (j + 0.5) * cell)) { grid[j * nx + i] = 1; nFree++ }
        }
        return FreeSpace(cell, bb.minX, bb.minY, nx, ny, grid, nFree * cell * cell, isFree)
    }

    // ---------------------------------------------------------------- ensoleillement
    private val LEVELS = listOf("shade", "partial", "full")
    private fun downgrade(level: String?, n: Int = 1): String? {
        if (level == null) return level
        return LEVELS[max(0, LEVELS.indexOf(level) - n)]
    }

    private class Tree(val x: Double, val y: Double, val h: Double, val w: Double)

    /** Grands arbres existants (≥ 3 m). */
    private fun existingTrees(garden: Garden?): List<Tree> =
        (garden?.existing ?: emptyList())
            .filter { it.keep && it.height >= 3 && !(it.points != null && it.points.size >= 2) }
            .map { Tree(it.x, it.y, it.height, if (it.width > 0) it.width else 4.0) }

    /** Échantillonneur d'ensoleillement : point → 'full' | 'partial' | 'shade' | null (ombre des arbres existants incluse). */
    private fun makeSunSampler(garden: Garden?): (Point) -> String? {
        val sun = garden?.sun ?: SunInfo()
        var base: (Point) -> String? = { null }
        var estimated = false
        if (sun.mode == "uniform" && !sun.uniform.isNullOrEmpty()) { val u = sun.uniform; base = { u } }
        else if (sun.mode == "map" && sun.regions.isNotEmpty()) {
            val regs = sun.regions
            base = { p -> var r: String? = null; for (i in regs.indices.reversed()) if (pointInPolygon(p, regs[i].points)) { r = regs[i].level; break }; r }
        } else if (garden?.context?.location != null && garden.boundary.size >= 3) {
            estimated = true // sun.js tient déjà compte de l'ombre des existants
            var regs: List<SunMapRegion> = emptyList()
            try {
                val bb = bounds(garden.boundary)
                regs = estimateSunMap(garden, null, if (bb.width * bb.height > 150) 1.0 else 0.5)
            } catch (_: Exception) { regs = emptyList() }
            base = { p -> var r: String? = null; for (reg in regs) if (pointInPolygon(p, reg.points)) { r = reg.level; break }; r }
        }
        val trees = if (estimated) emptyList() else existingTrees(garden)
        val na = (garden?.context?.northAngle ?: 0.0) * PI / 180
        val north = Point(StrictMath.sin(na), -StrictMath.cos(na))
        return fn@{ p ->
            val lv = base(p)
            if (lv == null || trees.isEmpty()) return@fn lv
            var n = 0
            for (t in trees) {
                val dx = p.x - t.x; val dy = p.y - t.y; val d = hyp(dx, dy)
                if (d < t.w / 2) n = max(n, 1)
                else if (d < t.h) {
                    val cos = (dx * north.x + dy * north.y) / d
                    if (cos >= 0.34) n = max(n, 1) // côté nord du grand arbre : ombre portée
                }
            }
            if (n != 0) downgrade(lv, n) else lv
        }
    }

    private fun dominantSun(poly: List<Point>, sunAt: (Point) -> String?): String? {
        val bb = bounds(poly)
        val cnt = HashMap<String, Int>()
        val step = max(0.25, max(bb.width, bb.height) / 12)
        var y = bb.minY + step / 2
        while (y < bb.maxY) {
            var x = bb.minX + step / 2
            while (x < bb.maxX) {
                val p = Point(x, y)
                if (pointInPolygon(p, poly)) {
                    val l = sunAt(p)
                    if (l != null) cnt[l] = (cnt[l] ?: 0) + 1
                }
                x += step
            }
            y += step
        }
        var best: String? = null; var bn = 0
        for (k in listOf("full", "partial", "shade")) if ((cnt[k] ?: 0) > bn) { bn = cnt[k]!!; best = k }
        return best
    }

    // ---------------------------------------------------------------- formes
    private val ARC = listOf(0, 30, 60, 90).map { it * PI / 180 }

    private fun stripPoly(p0: Point, p1: Point, u: Point, n: Point, w: Double, rc: Double): List<Point> {
        val c1 = Point(p1.x + n.x * (w - rc) - u.x * rc, p1.y + n.y * (w - rc) - u.y * rc)
        val c0 = Point(p0.x + n.x * (w - rc) + u.x * rc, p0.y + n.y * (w - rc) + u.y * rc)
        val pts = ArrayList<Point>()
        pts.add(p0); pts.add(p1)
        for (t in ARC) pts.add(Point(c1.x + rc * (u.x * cosd(t) + n.x * sind(t)), c1.y + rc * (u.y * cosd(t) + n.y * sind(t))))
        for (t in ARC.reversed()) pts.add(Point(c0.x + rc * (-u.x * cosd(t) + n.x * sind(t)), c0.y + rc * (-u.y * cosd(t) + n.y * sind(t))))
        return pts.map { Point(r3(it.x), r3(it.y)) }
    }
    private fun ellipsePoly(cx: Double, cy: Double, a: Double, b: Double, ang: Double, nPts: Int = 16): List<Point> {
        val c = cosd(ang); val s = sind(ang)
        val pts = ArrayList<Point>()
        for (i in 0 until nPts) {
            val t = (2 * PI * i) / nPts
            val lx = a * cosd(t); val ly = b * sind(t)
            pts.add(Point(r3(cx + lx * c - ly * s), r3(cy + lx * s + ly * c)))
        }
        return pts
    }
    private fun rrectPoly(cx: Double, cy: Double, hw: Double, hh: Double, ang: Double, rcArg: Double): List<Point> {
        val c = cosd(ang); val s = sind(ang)
        val rc = min(rcArg, min(hw * 0.9, hh * 0.9))
        val pts = ArrayList<Point>()
        val corners = listOf(Triple(1, 1, 0), Triple(-1, 1, 90), Triple(-1, -1, 180), Triple(1, -1, 270))
        for ((sx, sy, a0) in corners) {
            val ccx = sx * (hw - rc); val ccy = sy * (hh - rc)
            for (dg in listOf(0, 30, 60, 90)) {
                val t = ((a0 + dg) * PI) / 180
                val lx = ccx + rc * cosd(t); val ly = ccy + rc * sind(t)
                pts.add(Point(r3(cx + lx * c - ly * s), r3(cy + lx * s + ly * c)))
            }
        }
        return pts
    }
    private fun perim(poly: List<Point>): Double {
        var l = 0.0
        for (i in poly.indices) l += hyp(poly[(i + 1) % poly.size].x - poly[i].x, poly[(i + 1) % poly.size].y - poly[i].y)
        return l
    }

    /** Points d'échantillonnage d'une forme convexe : intérieur en treillis + bord décalé de 3 cm vers l'intérieur. */
    private fun samplePoints(poly: List<Point>, step: Double = 0.3): List<Point> {
        val bb = bounds(poly)
        val pts = ArrayList<Point>()
        var y = bb.minY + step / 2
        while (y < bb.maxY) {
            var x = bb.minX + step / 2
            while (x < bb.maxX) {
                if (pointInPolygon(Point(x, y), poly)) pts.add(Point(x, y))
                x += step
            }
            y += step
        }
        val c = centroid(poly)
        for (i in poly.indices) {
            val a = poly[i]; val b = poly[(i + 1) % poly.size]
            val len = hyp(b.x - a.x, b.y - a.y)
            if (len < 1e-6) continue
            var nx = -(b.y - a.y) / len; var ny = (b.x - a.x) / len
            val mid = Point((a.x + b.x) / 2, (a.y + b.y) / 2)
            if ((c.x - mid.x) * nx + (c.y - mid.y) * ny < 0) { nx = -nx; ny = -ny }
            val k = max(1, ceil(len / 0.15).toInt())
            val e = min(0.45, 0.03 / len)
            for (j in 0..k) {
                val t = e + (1 - 2 * e) * (j.toDouble() / k)
                pts.add(Point(a.x + (b.x - a.x) * t + nx * 0.03, a.y + (b.y - a.y) * t + ny * 0.03))
            }
        }
        return pts
    }

    // ---------------------------------------------------------------- compas / libellés
    private val COMPASS = listOf("nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest")
    private fun compassOf(garden: Garden?, from: Point, to: Point): String {
        val na = garden?.context?.northAngle ?: 0.0
        val b = (bearing(from, to) - na + 720) % 360
        return COMPASS[jsRound(b / 45).toInt() % 8]
    }
    private val SUN_TEXT = mapOf("full" to "plein soleil", "partial" to "mi-ombre", "shade" to "ombre")
    private val ALONG = mapOf(
        "wall" to "du mur", "fence" to "de la clôture", "hedge" to "de la haie", "open" to "de la limite du terrain",
        "house" to "de la maison", "shed" to "de l’abri", "terrace" to "de la terrasse", "path" to "de l’allée", "lawn" to "de la pelouse",
    )
    private val ROLE_LABEL = mapOf("bordure" to "Bordure", "pied-de-mur" to "Massif de pied de mur", "ilot" to "Îlot", "angle" to "Massif d’angle", "haie-fleurie" to "Haie fleurie")
    private val ROLE_WEIGHT = mapOf("pied-de-mur" to 1.0, "haie-fleurie" to 0.85, "bordure" to 0.8, "angle" to 0.75, "ilot" to 0.55)

    // ---------------------------------------------------------------- supports et candidats
    private class Support(val a: Point, val b: Point, val len: Double, val u: Point, val kind: String, val role: String, val contour: Boolean)

    private fun collectSupports(garden: Garden, allowLawn: Boolean): List<Support> {
        val sup = ArrayList<Support>()
        fun push(a: Point, b: Point, kind: String, role: String, contour: Boolean) {
            val l = hyp(b.x - a.x, b.y - a.y)
            if (l >= 1.2) sup.add(Support(a, b, l, Point((b.x - a.x) / l, (b.y - a.y) / l), kind, role, contour))
        }
        for (s in boundarySides(garden)) {
            val k = edgeKindOf(garden, s.i)
            push(s.a, s.b, k, if (k == "wall") "pied-de-mur" else "bordure", true)
        }
        for (ob in garden.obstacles) {
            if (ob.center != null && ob.points == null) continue
            if (ob.kind == "house" || ob.kind == "shed") for (s in obstacleSides(ob)) push(s.a, s.b, ob.kind, "pied-de-mur", false)
            else if (ob.kind == "wall") for (s in obstacleSides(ob)) push(s.a, s.b, "wall", "pied-de-mur", false)
            else if (ob.kind == "fence") for (s in obstacleSides(ob)) push(s.a, s.b, "fence", "bordure", false)
        }
        for (z in garden.zones) {
            if (!(z.type == "terrace" || z.type == "path" || (z.type == "lawn" && !allowLawn)) || z.shape == null || z.shape is CircleShape) continue
            val poly = shapePolygon(z.shape)
            for (i in poly.indices) push(poly[i], poly[(i + 1) % poly.size], z.type, "bordure", false)
        }
        return sup
    }

    private val WIDTHS = listOf(0.8, 1.0, 1.2, 1.5, 1.8, 2.0)

    /** Candidat (bande, angle, îlot) ; champs mutables comme l'objet JS. */
    private class Cand(val type: String, val role: String) {
        var sup: Support? = null
        var a: Point = Point(0.0, 0.0)
        var u: Point = Point(0.0, 0.0)
        var n: Point = Point(0.0, 0.0)
        var w: Double = 0.0
        var t0: Double = 0.0
        var t1: Double = 0.0
        var minLen: Double = 0.0
        var poly: List<Point> = emptyList()
        var guard: List<Point> = emptyList()
        var area: Double = 0.0
        var cen: Point = Point(0.0, 0.0)
        var widthM: Double = 0.0
        var corner: Point? = null
        var center: Point? = null
        var vis: Double? = null
        var base: Double = 0.0
        var jit: Double = 1.0
        var score: Double = 0.0
        var src: Cand? = null
        fun dup(): Cand {
            val c = Cand(type, role)
            c.sup = sup; c.a = a; c.u = u; c.n = n; c.w = w; c.t0 = t0; c.t1 = t1; c.minLen = minLen
            c.poly = poly; c.guard = guard; c.area = area; c.cen = cen; c.widthM = widthM; c.corner = corner; c.center = center
            c.vis = vis; c.base = base; c.jit = jit; c.score = score; c.src = src
            return c
        }
    }

    private fun buildStrip(c: Cand, t0: Double, t1: Double): List<Point> {
        val p0 = Point(c.a.x + c.u.x * t0, c.a.y + c.u.y * t0)
        val p1 = Point(c.a.x + c.u.x * t1, c.a.y + c.u.y * t1)
        return stripPoly(p0, p1, c.u, c.n, c.w, min(0.45, min(c.w * 0.45, (t1 - t0) * 0.2)))
    }

    private fun stripCandidates(fs: FreeSpace, sup: Support, side: Int, o: BedOptions, rng: Mulberry32): List<Cand> {
        val out = ArrayList<Cand>()
        val n = Point(-sup.u.y * side, sup.u.x * side)
        val step = 0.1
        val cols = floor(sup.len / step).toInt() + 1
        val depth = DoubleArray(cols)
        val maxD = WIDTHS[WIDTHS.size - 1] + 0.03
        for (i in 0 until cols) {
            val t = min(sup.len, i * step)
            val bx = sup.a.x + sup.u.x * t; val by = sup.a.y + sup.u.y * t
            var d = 0.03
            var k = 0
            while (d <= maxD && fs.isFree(bx + n.x * d, by + n.y * d)) { k++; d += 0.05 }
            depth[i] = if (k != 0) 0.03 + 0.05 * (k - 1) + 0.03 else 0.0
        }
        for (w in WIDTHS) {
            val minLen = max(1.5, o.minArea / w + 0.05)
            val lmax = min(10.0, o.maxArea / w - 0.05)
            if (lmax < minLen) continue
            var i = 0
            while (i < cols) {
                if (depth[i] + 1e-9 < w) { i++; continue }
                var j = i
                while (j + 1 < cols && depth[j + 1] + 1e-9 >= w) j++
                val t0 = i * step; val t1 = min(sup.len, j * step)
                val lr = t1 - t0
                if (lr >= minLen) {
                    val lens = listOf(min(lr, lmax), max(minLen, min(lr, lmax) * 0.55), max(minLen, min(lr, 3.0)))
                        .map { v -> r1(min(v, min(lr, lmax))) }.distinct()
                    val wins = ArrayList<Pair<Double, Double>>()
                    for (len in lens) {
                        if (len < minLen - 1e-9) continue
                        wins.add(t0 to t0 + len); wins.add(t1 - len to t1)
                        if (lr - len > 0.4) { val s0 = t0 + rng.next() * (lr - len); wins.add(s0 to s0 + len) }
                    }
                    val seen = HashSet<String>()
                    for ((a0, a1) in wins) {
                        val key = "${jsNumStr(r1(a0))}|${jsNumStr(r1(a1))}"
                        if (!seen.add(key)) continue
                        var role = sup.role
                        if (role == "bordure" && sup.contour && (sup.kind == "fence" || sup.kind == "hedge") && w >= 1.2 && w <= 1.8 && a1 - a0 >= 4) role = "haie-fleurie"
                        val c = Cand("strip", role)
                        c.sup = sup; c.a = sup.a; c.u = sup.u; c.n = n; c.w = w; c.t0 = a0; c.t1 = a1; c.minLen = minLen
                        out.add(c)
                    }
                }
                i = j + 1
            }
        }
        return out
    }

    private fun cornerCandidates(garden: Garden, o: BedOptions): List<Cand> {
        val out = ArrayList<Cand>()
        val b = garden.boundary
        val n = b.size
        if (!garden.boundaryClosed || n < 3) return out
        for (i in 0 until n) {
            val p = b[i]; val prev = b[(i + n - 1) % n]; val next = b[(i + 1) % n]
            val l1 = hyp(next.x - p.x, next.y - p.y); val l2 = hyp(prev.x - p.x, prev.y - p.y)
            if (l1 < 1 || l2 < 1) continue
            val u1 = Point((next.x - p.x) / l1, (next.y - p.y) / l1)
            val u2 = Point((prev.x - p.x) / l2, (prev.y - p.y) / l2)
            val bis = Point(u1.x + u2.x, u1.y + u2.y)
            val bl = hyp(bis.x, bis.y)
            if (bl < 0.2 || !pointInPolygon(Point(p.x + (bis.x / bl) * 0.2, p.y + (bis.y / bl) * 0.2), b)) continue
            val phi = StrictMath.acos(clamp(u1.x * u2.x + u1.y * u2.y, -1.0, 1.0))
            if (phi < 0.7 || phi > 2.6) continue
            val a1 = StrictMath.atan2(u1.y, u1.x)
            var da = StrictMath.atan2(u2.y, u2.x) - a1
            while (da > PI) da -= 2 * PI
            while (da < -PI) da += 2 * PI
            for (r in listOf(1.8, 2.4, 3.0, 3.6)) {
                val area = 0.5 * r * r * phi
                if (area < o.minArea || area > o.maxArea) continue
                val pts = ArrayList<Point>()
                pts.add(Point(r3(p.x), r3(p.y)))
                for (k in 0..8) {
                    val a = a1 + (da * k) / 8
                    pts.add(Point(r3(p.x + r * cosd(a)), r3(p.y + r * sind(a))))
                }
                val sh = sind(phi / 2)
                val c = Cand("corner", "angle")
                c.poly = pts; c.guard = pts; c.widthM = 2 * r * sh / (1 + sh); c.corner = p
                out.add(c)
            }
        }
        return out
    }

    private fun islandCandidates(fs: FreeSpace, o: BedOptions, rng: Mulberry32): List<Cand> {
        val out = ArrayList<Cand>()
        val dm = fs.distanceMap()
        val cells = ArrayList<Int>()
        for (k in dm.indices) if (dm[k].toDouble() >= 1.45) cells.add(k)
        V8Sort.sort(cells) { a, b -> (dm[b] + rng.next() * 0.8) - (dm[a] + rng.next() * 0.8) }
        class Center(val x: Double, val y: Double, val d: Double)
        val centers = ArrayList<Center>()
        for (k in cells) {
            val i = k % fs.nx; val j = (k - i) / fs.nx
            val c = fs.cellCenter(i, j)
            if (centers.all { q -> hyp(q.x - c.x, q.y - c.y) >= 1.8 }) centers.add(Center(c.x, c.y, dm[k].toDouble()))
            if (centers.size >= 28) break
        }
        val angles = listOf(0, 30, 60, 90, 120, 150)
        val bPicks = listOf(1.0, 1.3, 1.5)
        for (c in centers) {
            for (rep in 0 until 2) {
                val ang = (angles[floor(rng.next() * angles.size).toInt()] * PI) / 180
                val bPick = bPicks[floor(rng.next() * 3).toInt()]
                val b = min(bPick, min(c.d - 0.62, 1.5))
                if (b < 0.7) continue
                val rect = rng.next() < 0.45
                val aMax = min(4.3, o.maxArea / (if (rect) 4 * b * 0.97 else PI * b))
                var a = aMax
                while (a >= b && a >= 0.9) {
                    fun mk(pa: Double, pb: Double) = if (rect) rrectPoly(c.x, c.y, pa, pb, ang, min(0.6, pb * 0.6)) else ellipsePoly(c.x, c.y, pa, pb, ang)
                    val poly = mk(a, b)
                    val area = polygonArea(poly)
                    if (area > o.maxArea || area < o.minArea) { a -= 0.3; continue }
                    val guard = mk(a + 0.6, b + 0.6)
                    if (!guard.all { p -> fs.isFree(p.x, p.y) }) { a -= 0.3; continue }
                    val cd = Cand("island", "ilot")
                    cd.poly = poly; cd.guard = guard; cd.widthM = 2 * b; cd.center = Point(c.x, c.y)
                    out.add(cd)
                    break
                }
            }
        }
        return out
    }

    private fun validShape(fs: FreeSpace, poly: List<Point>, guard: List<Point>?): Boolean {
        val g = guard ?: poly
        for (p in samplePoints(g, 0.3)) if (!fs.isFree(p.x, p.y)) return false
        return true
    }

    // ---------------------------------------------------------------- propositions de massifs
    private class Viewpoint(val poly: List<Point>?, val pt: Point?)

    private fun viewpointsOf(garden: Garden): List<Viewpoint> {
        val vps = ArrayList<Viewpoint>()
        for (z in garden.zones) if (z.type == "terrace" && z.shape != null) vps.add(Viewpoint(shapePolygon(z.shape), null))
        for (ob in garden.obstacles) if (ob.kind == "house" && ob.points != null && ob.points.size >= 3) vps.add(Viewpoint(ob.points, null))
        for (op in garden.openings) {
            if (op.kind != "door" && op.kind != "garage") continue
            try { val g = openingGeometry(garden, op); if (g != null) vps.add(Viewpoint(null, g.center)) } catch (_: Exception) { /* ignoré */ }
        }
        return vps
    }
    private fun viewDistance(vps: List<Viewpoint>, p: Point): Double {
        var d = Double.POSITIVE_INFINITY
        for (v in vps) d = min(d, if (v.poly != null) polyDist(p, v.poly) else hyp(p.x - v.pt!!.x, p.y - v.pt.y))
        return d
    }

    /**
     * Propose des massifs dans le vide du jardin (voir `BedOptions`). Déterministe avec `seed`.
     */
    fun proposeBeds(garden: Garden, o: BedOptions = BedOptions()): List<Bed> {
        val seed = o.seed.toDouble()
        val maxBeds = if (o.maxBeds > 0) o.maxBeds else 12
        val rng = rngFrom(seed * 7919 + 13)
        val fs = freeSpace(garden, o.cell ?: 0.25, o.margin ?: 0.3, o.clearances, o.allowLawn)
        if (fs.freeArea < o.minArea) return emptyList()
        var target = clamp(o.coverage, 0.0, 1.0) * fs.freeArea
        if (target <= 0) return emptyList()
        target = max(target, min(o.minArea * 0.9, fs.freeArea * 0.5))

        val sunAt = makeSunSampler(garden)
        val vps = viewpointsOf(garden)
        val bc = centroid(garden.boundary)
        val bbG = bounds(garden.boundary)

        // Candidats.
        val cands = ArrayList<Cand>()
        if (o.style != "islands") {
            for (sup in collectSupports(garden, o.allowLawn)) for (side in listOf(1, -1)) cands.addAll(stripCandidates(fs, sup, side, o, rng))
            cands.addAll(cornerCandidates(garden, o))
        }
        if (o.style != "borders") cands.addAll(islandCandidates(fs, o, rng))

        fun finish(c: Cand): Cand {
            if (c.type == "strip") { c.poly = buildStrip(c, c.t0, c.t1); c.guard = c.poly }
            c.area = polygonArea(c.poly)
            c.cen = centroid(c.poly)
            if (c.type == "strip") c.widthM = c.w
            return c
        }
        fun scoreOf(c: Cand): Double {
            val sun = sunAt(c.cen)
            val sunS = if (sun == "full") 1.0 else if (sun == "partial") 0.75 else if (sun == "shade") 0.45 else 0.65
            val d: Double? = if (vps.isNotEmpty()) viewDistance(vps, c.cen) else null
            val vis = if (d == null) 0.5 else max(0.1, StrictMath.exp(-d / 7))
            val pp = perim(c.poly)
            val iso = (4 * PI * c.area) / (pp * pp)
            val compact = min(1.0, 0.4 + Math.sqrt(iso))
            val wS = min(1.0, c.widthM / 1.5)
            val lg = StrictMath.log(c.area / 6)
            val sizeS = StrictMath.exp(-(lg * lg) / 2)
            c.vis = d
            return 100 * (0.30 * ROLE_WEIGHT[c.role]!! + 0.22 * vis + 0.18 * sunS + 0.10 * compact + 0.10 * wS + 0.10 * sizeS)
        }
        for (c in cands) { finish(c); c.jit = 1 + (rng.next() - 0.5) * 0.4; c.base = scoreOf(c) * c.jit }

        val placed = ArrayList<Cand>()
        var total = 0.0
        fun conflicts(c: Cand, poly: List<Point>): Boolean =
            placed.any { p -> convexOverlap(if (c.guard === c.poly) poly else c.guard, p.poly) || convexOverlap(poly, p.guard) }
        fun insideAny(x: Double, y: Double): Boolean = placed.any { p -> pointInPolygon(Point(x, y), p.poly) }
        fun isFreeAll(x: Double, y: Double): Boolean = fs.isFree(x, y) && !insideAny(x, y)

        fun trimmed(c: Cand): Cand? {
            if (placed.isEmpty()) return c
            if (!conflicts(c, c.poly)) return c
            if (c.type != "strip") return null
            for (k in 1..80) {
                for ((t0, t1) in listOf(c.t0 to c.t1 - 0.1 * k, c.t0 + 0.1 * k to c.t1)) {
                    if (t1 - t0 < c.minLen) continue
                    val poly = buildStrip(c, t0, t1)
                    if (!conflicts(c, poly)) { val d = c.dup(); d.t0 = t0; d.t1 = t1; d.poly = poly; return finish(d) }
                }
                if (c.t1 - c.t0 - 0.1 * k < c.minLen) break
            }
            return null
        }
        fun sliverLen(c: Cand): Double {
            var len = 0.0
            val ctr = c.cen
            for (i in c.poly.indices) {
                val a = c.poly[i]; val b = c.poly[(i + 1) % c.poly.size]
                val l = hyp(b.x - a.x, b.y - a.y)
                if (l < 1e-6) continue
                var nx = (b.y - a.y) / l; var ny = -(b.x - a.x) / l
                val mid = Point((a.x + b.x) / 2, (a.y + b.y) / 2)
                if ((mid.x - ctr.x) * nx + (mid.y - ctr.y) * ny < 0) { nx = -nx; ny = -ny }
                val k = max(1, ceil(l / 0.25).toInt())
                for (j in 0 until k) {
                    val t = (j + 0.5) / k
                    val px = a.x + (b.x - a.x) * t; val py = a.y + (b.y - a.y) * t
                    var d = 0.05; var hit: Double? = null
                    while (d <= 0.5) { if (!isFreeAll(px + nx * d, py + ny * d)) { hit = d; break }; d += 0.05 }
                    if (hit != null && hit > 0.09) len += l / k
                }
            }
            return len
        }

        val dead = java.util.IdentityHashMap<Cand, Boolean>()
        while (placed.size < maxBeds && total < target * 0.92) {
            val remaining = target - total
            if (remaining < o.minArea * 0.75) break
            val order = cands.filter { !dead.containsKey(it) }.sortedWith { a, b -> b.base.compareTo(a.base) }
            var best: Cand? = null; var bestScore = -1.0; var tried = 0
            for (c0 in order) {
                if (tried >= 14) break
                val c = trimmed(c0)
                if (c == null) { dead[c0] = true; continue }
                if (c.area < o.minArea || c.area > o.maxArea) { dead[c0] = true; continue }
                if (total + c.area > target * 1.25 && placed.isNotEmpty()) continue
                tried++
                val fit = if (c.area <= remaining * 1.2 + 0.3) 1.0 else (remaining * 1.2 + 0.3) / c.area * 0.5
                val sc = scoreOf(c) * c0.jit * fit
                if (sc > bestScore) { bestScore = sc; best = c; best.src = c0 }
            }
            if (best == null) break
            val c = best
            if (!validShape(fs, c.poly, c.guard) || sliverLen(c) > 1.5) { dead[c.src!!] = true; continue }
            c.score = bestScore
            placed.add(c); total += c.area; dead[c.src!!] = true
        }

        // Sorties.
        val totalArea = placed.sumOf { it.area }.let { if (it == 0.0) 1.0 else it }
        return placed.mapIndexed { idx, c ->
            val sunLevel = dominantSun(c.poly, sunAt)
            val area = r1(c.area)
            val widthM = r1(c.widthM)
            var bed = Bed(
                id = "m_${jsNumStr(seed)}_${idx + 1}",
                role = c.role,
                shape = PolygonShape(c.poly.map { Point(r3(it.x), r3(it.y)) }),
                areaM2 = area,
                widthM = widthM,
                sunLevel = sunLevel,
                score = jsRound(clamp(c.score, 0.0, 100.0)).toInt(),
                why = whyBed(garden, c, area, widthM, sunLevel, bc, bbG),
            )
            if (o.design) {
                val budget = if (o.budget != null && o.budget.isFinite()) max(0.0, o.budget) * (c.area / totalArea) else null
                val d = designBed(garden, bed, DesignOptions(
                    seed = seed, ambiance = Maybe(o.ambiance), maintenance = Maybe(o.maintenance), budget = budget,
                    palette = o.palette, plants = o.plants, tminC = o.tminC,
                ))
                bed = bed.copy(plantings = d.plantings, summary = d.summary, plantsWhy = d.why, alternatives = d.alternatives)
            }
            bed.copy(ambiance = o.ambiance, seed = seed)
        }
    }

    private fun whyBed(garden: Garden, c: Cand, area: Double, widthM: Double, sunLevel: String?, bc: Point, bbG: Bounds): String {
        val sun = if (sunLevel != null) ", ${SUN_TEXT[sunLevel]}" else ""
        var vis = ""
        if (c.vis != null && c.vis!! < 5) vis = ", bien visible depuis la terrasse ou la maison"
        if (c.type == "strip") {
            val mid = Point(c.a.x + c.u.x * (c.t0 + c.t1) / 2, c.a.y + c.u.y * (c.t0 + c.t1) / 2)
            val dir = compassOf(garden, bc, mid)
            val lab = if (c.role == "pied-de-mur") "Pied de mur" else cap(ROLE_LABEL[c.role]!!.lowercase())
            return "$lab de ${fr(widthM)} m le long ${ALONG[c.sup!!.kind] ?: "de la limite"} $dir$sun$vis"
        }
        if (c.type == "corner") return "Massif d’angle de ${fr(area)} m² au coin ${compassOf(garden, bc, c.corner!!)}$sun$vis"
        val dist = hyp(c.center!!.x - bc.x, c.center!!.y - bc.y)
        val pos = if (dist < max(bbG.width, bbG.height) * 0.18) "au centre du jardin" else "côté ${compassOf(garden, bc, c.center!!)}"
        return "Îlot de ${fr(area)} m² dans un grand vide $pos$sun$vis"
    }

    // ---------------------------------------------------------------- couleurs
    private class Hsl(val h: Double, val s: Double, val l: Double)

    private fun hexToHsl(hex: String?): Hsl? {
        val m = Regex("^#?([0-9a-fA-F]{6})$").find(hex ?: "") ?: return null
        val n = m.groupValues[1].toInt(16)
        val r = ((n shr 16) and 255) / 255.0; val g = ((n shr 8) and 255) / 255.0; val b = (n and 255) / 255.0
        val mx = max(r, max(g, b)); val mn = min(r, min(g, b))
        val l = (mx + mn) / 2; val d = mx - mn
        val s = if (d == 0.0) 0.0 else d / (1 - abs(2 * l - 1))
        var h = 0.0
        if (d != 0.0) {
            h = if (mx == r) ((g - b) / d) % 6 else if (mx == g) (b - r) / d + 2 else (r - g) / d + 4
            h = (h * 60 + 360) % 360
        }
        return Hsl(h, s, l)
    }

    /** Familles de teintes : 'rose-rouge' | 'jaune-orangé' | 'vert' | 'bleu-violet' | 'blanc'. */
    val COLOR_FAMILIES = listOf("rose-rouge", "jaune-orangé", "vert", "bleu-violet", "blanc")
    fun colorFamily(hex: String?): String? {
        val c = hexToHsl(hex) ?: return null
        if (c.l >= 0.85 || (c.s < 0.15 && c.l > 0.6)) return "blanc"
        if (c.h >= 300 || c.h < 20) return "rose-rouge"
        if (c.h < 70) return "jaune-orangé"
        if (c.h < 170) return "vert"
        return "bleu-violet"
    }
    private val WHEEL = listOf("rose-rouge", "jaune-orangé", "vert", "bleu-violet")
    private fun harmony(fams: List<String>): Double {
        val nb = fams.filter { it != "blanc" }
        if (fams.size > 3) return 0.0
        if (nb.isEmpty()) return 0.7
        if (nb.size == 1) return 1.0
        val idx = nb.map { WHEEL.indexOf(it) }.sorted()
        if (nb.size == 2) {
            val d = (idx[1] - idx[0]) % 4
            return if (d == 1 || d == 3) 0.95 else 0.88 // analogues / complémentaires
        }
        return 0.5
    }
    private fun foliageTone(hex: String?): String {
        val c = hexToHsl(hex) ?: return "moyen"
        if (c.s < 0.25 || (c.h >= 170 && c.h < 230)) return "glauque"
        if (c.h >= 270 || c.h < 25) return "pourpre"
        if (c.l > 0.55) return "clair"
        if (c.l < 0.33) return "foncé"
        return "moyen"
    }

    /** Une essence évaluée pour un massif (identité = objet, comme en JS). */
    private class Info(
        val p: Plant, val id: String, val fit: Int, val layer: String, val bulb: Boolean, val bloom: List<Int>,
        val hsl: Hsl?, val fam: String?, val tone: String, val evergreen: Boolean, var amb: Double, var avoid: Boolean,
        val maintOk: Boolean, val effort: Int, val mell: Boolean, val water: Int, val sunOk: Boolean, val genus: String, val under: Double,
    ) {
        var pal: Boolean = true
        fun dup(): Info {
            val i = Info(p, id, fit, layer, bulb, bloom, hsl, fam, tone, evergreen, amb, avoid, maintOk, effort, mell, water, sunOk, genus, under)
            i.pal = pal
            return i
        }
    }

    private class Palette(val label: String, val ok: (Info) -> Boolean)
    private val PALETTES: Map<String, Palette> = linkedMapOf(
        "chaud" to Palette("chaud") { i -> i.fam == null || i.fam in listOf("rose-rouge", "jaune-orangé", "blanc") },
        "froid" to Palette("froid") { i -> i.fam == null || i.fam in listOf("bleu-violet", "vert", "blanc") },
        "pastel" to Palette("pastel") { i -> i.hsl == null || (i.hsl.l >= 0.68 && i.hsl.s <= 0.85) },
        "blanc" to Palette("blanc") { i -> i.fam == null || i.fam == "blanc" || i.fam == "vert" },
        "vif" to Palette("vif") { i -> i.hsl == null || (i.hsl.s >= 0.55 && i.hsl.l >= 0.3 && i.hsl.l <= 0.72) },
    )
    private val PALETTE_FAMS = mapOf(
        "chaud" to listOf("rose-rouge", "jaune-orangé"), "froid" to listOf("bleu-violet", "vert"), "pastel" to listOf("rose-rouge", "bleu-violet"),
        "blanc" to listOf("blanc", "vert"), "vif" to listOf("rose-rouge", "jaune-orangé"),
    )

    // ---------------------------------------------------------------- combinaison de plantes
    private val LAYER_SHARE = mapOf("fond" to 0.15, "milieu" to 0.35, "avant" to 0.30, "bordure" to 0.10, "bulbes" to 0.10)
    private val WATER = mapOf("low" to 0, "medium" to 1, "high" to 2)
    private val SEASONS = listOf(listOf(3, 4, 5), listOf(6, 7, 8), listOf(9, 10))

    private fun layerOf(p: Plant): String {
        val h = if (p.heightAdult != 0.0 && !p.heightAdult.isNaN()) p.heightAdult else 0.5
        val hab = habitOf(p).id
        if (hab.startsWith("groundcover") || h <= 0.3) return "bordure"
        if (h <= 0.6) return "avant"
        if (h <= 1.1) return "milieu"
        return "fond"
    }
    private fun bedSpacingOf(p: Plant): Double {
        val s = if (p.spacing > 0) p.spacing else if (p.widthAdult > 0) p.widthAdult else 0.5
        return max(if (p.category == "bulb") 0.12 else 0.2, s)
    }
    private fun priceOf(info: Info, count: Int, area: Double): Double {
        val p = info.p
        if (p.priceEur == null) return count * 8.0
        return if (p.priceUnit == "m2") p.priceEur * area else p.priceEur * count
    }

    /** Quantités d'une sélection selon la surface : fond 15 %, milieu 35 %, avant 30 %, bordure 10 %, bulbes 10 %. */
    private fun allocate(s: List<Info>, area: Double): IntArray {
        val groups = LinkedHashMap<String, MutableList<Int>>()
        s.forEachIndexed { k, i -> groups.getOrPut(if (i.bulb) "bulbes" else i.layer) { ArrayList() }.add(k) }
        var tot = 0.0
        for (g in groups.keys) tot += LAYER_SHARE[g]!!
        if (tot == 0.0) tot = 1.0
        val counts = IntArray(s.size) { 1 }
        for ((g, ks) in groups) {
            val per = (area * LAYER_SHARE[g]!! / tot) / ks.size
            for (k in ks) {
                val sp = bedSpacingOf(s[k].p)
                counts[k] = max(1, jsRound(per / (sp * sp)).toInt())
            }
        }
        fun fp(): Double { var t = 0.0; s.forEachIndexed { k, i -> val sp = bedSpacingOf(i.p); t += counts[k] * (sp * sp) }; return t }
        var guard = 400
        while (fp() > area * 1.15 && guard-- > 0) {
            var bk = -1; var bv = 0.0
            s.forEachIndexed { k, i -> if (counts[k] > 1) { val sp = bedSpacingOf(i.p); val v = counts[k] * (sp * sp); if (v > bv) { bv = v; bk = k } } }
            if (bk < 0) break
            counts[bk]--
        }
        return counts
    }

    /**
     * Quantités finales d'un massif : mêmes parts par couche que `allocate` mais calculées par `allocateQuantities`
     * (surface utile, capacité du massif) puis ajustées par une pose réelle : aucune distance horticole n'est violée.
     */
    private fun spacedCounts(s: List<Info>, counts: IntArray, bedId: String, bedShape: Shape, bedAreaM2: Double): IntArray {
        try {
            val zone = Zone(id = bedId, type = "midplants", shape = bedShape)
            val key = s.associate { it.p.id to (if (it.bulb) "bulbes" else it.layer) }
            val al = allocateQuantities(zone, s.map { it.p }, AllocOptions(shares = LAYER_SHARE, layerOf = { p -> key[p.id]!! }))
            val pl = s.mapIndexed { k, i -> Planting(i.id, count = max(1, al[k].count)) }
            val bedArea = if (bedAreaM2 > 0) bedAreaM2 else polygonArea(shapePolygon(bedShape))
            var fpSum = 0.0
            s.forEachIndexed { k, i -> val sp = bedSpacingOf(i.p); fpSum += pl[k].count!! * (sp * sp) }
            if (fpSum <= 0.45 * bedArea) return IntArray(s.size) { pl[it].count!! } // très aéré : rien ne peut dépasser
            val byId = s.associate { it.id to it.p }
            val fit = fitQuantities(zone, pl, { id -> byId[id] })
            val fitted = fit.associate { it.plantId to it.count!! }
            return IntArray(s.size) { k -> max(1, fitted[s[k].id] ?: min(counts[k], pl[k].count!!)) }
        } catch (_: Exception) {
            return counts
        }
    }

    private class GardenCtx(val tminC: Double?, val soil: String?, val windy: Boolean?, val maintenance: String?)

    private fun normalizeGardenCtx(garden: Garden?, tminOpt: Double?): GardenCtx {
        val c = garden?.context
        var tminC: Double? = null
        if (tminOpt != null && tminOpt.isFinite()) tminC = tminOpt
        else {
            val clim = Climate.climateForDepartement(c?.departement)
            if (clim != null) tminC = Climate.adjustTminForAltitude(clim.tminC, c?.altitude)
        }
        return GardenCtx(tminC, c?.soil?.takeIf { it.isNotEmpty() }, Recommend.windyOf(c?.wind), c?.maintenance?.takeIf { it.isNotEmpty() })
    }

    private fun <T> relax(list: List<T>, pred: (T) -> Boolean, min: Int): List<T> {
        val f = list.filter(pred)
        return if (f.size >= min) f else list
    }

    private class DesignParams(
        val area: Double, val rng: Mulberry32, val iters: Int, val budget: Double?, val ambiance: String?, val maintenance: String?, val palette: String?,
    )

    private fun runDesign(infos: List<Info>, pp: DesignParams): List<Info> {
        val area = pp.area; val rng = pp.rng; val iters = pp.iters; val budget = pp.budget
        val ambiance = pp.ambiance; val maintenance = pp.maintenance; val palette = pp.palette
        val n0 = clamp(jsRound(4 + area / 2.2), 5.0, 9.0).toInt()
        val amb = if (ambiance != null) getAmbiance(ambiance) else null
        val pollW = if (ambiance == "pollinisateurs") 1.5 else 0.6
        val budgetFinite = budget != null && budget.isFinite()
        val pal = if (palette != null) PALETTES[palette] else null

        fun evaluate(s: List<Info>): Double {
            val n = s.size
            if (n == 0) return -1e9
            val counts = allocate(s, area)
            var fitSum = 0.0; for (i in s) fitSum += i.fit
            val fit = fitSum / n / 100
            val months = HashSet<Int>()
            for (i in s) for (m in i.bloom) if (m >= 3 && m <= 10) months.add(m)
            val cov = months.size / 8.0
            var seasons = 0
            for (ss in SEASONS) seasons += min(2, s.count { i -> ss.any { m -> m in i.bloom } })
            var run = 0; var longest = 0
            for (m in 3..10) { if (m in months) { run++; longest = max(longest, run) } else run = 0 }
            val bloom = 0.5 * cov + 0.25 * (seasons / 6.0) + 0.25 * (longest / 8.0)
            val layers = s.map { it.layer }.toSet().size
            val layerS = if (layers >= 3) (if (layers >= 4) 1.0 else 0.8) else layers / 4.0 * 0.5
            val fams = LinkedHashSet<String>(); for (i in s) if (i.fam != null) fams.add(i.fam)
            val famList = fams.toList()
            var color = harmony(famList)
            val famCount = HashMap<String, Int>()
            for (i in s) if (i.fam != null) famCount[i.fam] = (famCount[i.fam] ?: 0) + 1
            val flow = s.count { it.fam != null }
            if (flow != 0 && (famCount.values.maxOrNull() ?: 0).toDouble() / flow >= 0.4) color = min(1.0, color + 0.05)
            val ev = s.count { it.evergreen }
            val tones = s.map { it.tone }.toSet().size
            val foliage = 0.6 * (if (ev >= 2) 1.0 else if (ev == 1) 0.6 else 0.0) + 0.4 * min(1.0, tones / 3.0)
            var ambSum = 0.0; for (i in s) ambSum += i.amb
            val ambS = if (amb != null) ambSum / n else 0.5
            var maintSum = 0.0
            val maintS = if (maintenance == "low" || maintenance == "none") {
                for (i in s) maintSum += if (i.maintOk) 1.0 else 0.3
                maintSum / n
            } else {
                for (i in s) maintSum += 1 - (i.effort - 1) / 4.0
                maintSum / n
            }
            val poll = min(1.0, s.count { it.mell } / 3.0)
            val ws = s.map { it.water }
            val spread = ws.max() - ws.min()
            val water = if (spread == 0) 1.0 else if (spread == 1) 0.75 else 0.0
            val sizeS = 1 - abs(n - n0) / 5.0
            val palS = if (pal != null) s.count { it.pal } / n.toDouble() else 0.5
            var fpSum = 0.0
            s.forEachIndexed { k, i -> val sp = bedSpacingOf(i.p); fpSum += counts[k] * (sp * sp) }
            val fp = fpSum / area
            val dens = if (fp > 1.2) 1 - (fp - 1.2) * 2 else if (fp < 0.5) 0.5 + fp else 1.0
            var cost = 0.0
            s.forEachIndexed { k, i -> cost += priceOf(i, counts[k], area) }
            val costS = if (budgetFinite) { if (cost <= budget!!) 1.0 else -6 * (cost - budget) / max(budget, 1.0) } else 1 - min(1.0, cost / (area * 60))
            val genus = HashMap<String, Int>()
            var genusPen = 0.0
            for (i in s) { genus[i.genus] = (genus[i.genus] ?: 0) + 1; if (genus[i.genus]!! > 2) genusPen += 0.4 }
            var underSum = 0.0; for (i in s) underSum += i.under
            val under = underSum / n
            var f = 1.0 * fit + 3.4 * bloom + 1.6 * layerS + 1.6 * color + 0.8 * foliage + (if (amb != null) 1.4 * ambS else 0.0) +
                1.0 * maintS + pollW * poll + 1.0 * water + 0.4 * sizeS + (if (pal != null) 2 * palS else 0.0) + 0.6 * costS + 1.0 * dens + under * 0.8 - genusPen
            if (n < 5 && infos.size >= 5) f -= 2 * (5 - n)
            if (n > 10) f -= 3 * (n - 10)
            if (famList.size > 3) f -= 3
            return f
        }

        val rank = infos.indices.sortedWith { a, b -> infos[b].fit.compareTo(infos[a].fit) }
        fun contains(l: List<Info>, i: Info) = l.any { it === i }

        fun search(nIt: Int): Pair<List<Info>, Double> {
            var s: List<Info> = emptyList()
            val want = min(infos.size, n0 + floor(rng.next() * 2).toInt())
            while (s.size < want) {
                val rest = infos.filter { i -> !contains(s, i) }
                val sample = ArrayList<Info>()
                var k = 0
                while (k < 28 && k < rest.size) { sample.add(rest[floor(rng.next() * rest.size).toInt()]); k++ }
                var bi: Info? = null; var bv = Double.NEGATIVE_INFINITY
                val seen = java.util.IdentityHashMap<Info, Boolean>()
                for (c in sample) {
                    if (seen.put(c, true) != null) continue
                    val v = evaluate(s + c) + rng.next() * 0.15
                    if (v > bv) { bv = v; bi = c }
                }
                s = s + bi!!
            }
            var cur = evaluate(s); var best = s; var bestV = cur
            for (it in 0 until nIt) {
                val temp = 0.08 * (1 - it.toDouble() / nIt)
                val r = rng.next()
                val nn = s.toMutableList()
                fun pick(): Info { val a1 = rng.next(); val a2 = rng.next(); return infos[rank[floor(a1 * a2 * rank.size).toInt()]] }
                var gapPick: Info? = null
                if (rng.next() < 0.4) {
                    val have = HashSet<Int>()
                    for (i in s) for (m in i.bloom) have.add(m)
                    val miss = ArrayList<Int>()
                    for (m in 3..10) if (m !in have) miss.add(m)
                    if (miss.isNotEmpty()) {
                        val m = miss[floor(rng.next() * miss.size).toInt()]
                        val cand = infos.filter { i -> m in i.bloom && !contains(s, i) }
                        if (cand.isNotEmpty()) gapPick = cand[floor(rng.next() * cand.size).toInt()]
                    }
                }
                if (r < 0.72 || nn.size <= 1) {
                    val k = floor(rng.next() * nn.size).toInt()
                    val c = gapPick ?: (if (rng.next() < 0.5) pick() else infos[floor(rng.next() * infos.size).toInt()])
                    if (contains(nn, c)) continue
                    nn[k] = c
                } else if (r < 0.84 && nn.size < 10) {
                    val c = pick(); if (contains(nn, c)) continue; nn.add(c)
                } else if (r < 0.94 && nn.size > 5) {
                    nn.removeAt(floor(rng.next() * nn.size).toInt())
                } else {
                    val k1 = floor(rng.next() * nn.size).toInt(); val k2 = floor(rng.next() * nn.size).toInt()
                    val c1 = pick(); val c2 = infos[floor(rng.next() * infos.size).toInt()]
                    if (contains(nn, c1) || contains(nn, c2) || c1 === c2) continue
                    nn[k1] = c1; nn[k2] = c2
                }
                val v = evaluate(nn)
                if (v >= cur || rng.next() < StrictMath.exp((v - cur) / max(temp, 1e-6))) {
                    s = nn; cur = v
                    if (v > bestV) { bestV = v; best = nn.toList() }
                }
            }
            return best to bestV
        }
        val r1s = search(ceil(iters / 2.0).toInt())
        val r2s = search(ceil(iters / 2.0).toInt())
        var s: List<Info> = (if (r2s.second > r1s.second) r2s else r1s).first
        // Réparation du budget : remplacer les essences les plus chères par des moins chères.
        if (budgetFinite) {
            fun costOf(l: List<Info>): Double { val c = allocate(l, area); var t = 0.0; l.forEachIndexed { k, i -> t += priceOf(i, c[k], area) }; return t }
            val order = infos.sortedWith { x, y -> priceOf(x, 1, area).compareTo(priceOf(y, 1, area)) }
            var t = 0
            while (t < 80 && costOf(s) > budget!!) {
                t++
                val c = allocate(s, area)
                var wk = 0; var wv = -1.0
                s.forEachIndexed { k, i -> val v = priceOf(i, c[k], area); if (v > wv) { wv = v; wk = k } }
                val cheaper = order.filter { i -> !contains(s, i) && priceOf(i, 1, area) < priceOf(s[wk], 1, area) }
                if (cheaper.isEmpty()) {
                    if (s.size > 5) { s = s.toMutableList().also { it.removeAt(wk) }; continue }
                    break
                }
                val sameLayer = cheaper.filter { i -> i.layer == s[wk].layer && i.bulb == s[wk].bulb }
                val src = if (sameLayer.isNotEmpty() && rng.next() < 0.7) sameLayer else cheaper
                val cand = src[floor(rng.next() * min(src.size, 6)).toInt()]
                val trial = s.toMutableList(); trial[wk] = cand
                if (costOf(trial) < costOf(s)) s = trial
            }
        }
        return s
    }

    private fun monthRangeText(months: Collection<Int>): String {
        val ms = months.toSortedSet().toList()
        if (ms.isEmpty()) return ""
        var best = intArrayOf(ms[0], ms[0]); var s = ms[0]; var p = ms[0]
        for (m in ms.drop(1)) {
            if (m == p + 1) { p = m } else { s = m; p = m }
            if (p - s > best[1] - best[0]) best = intArrayOf(s, p)
        }
        return if (best[0] == best[1]) MONTHS[best[0] - 1] else "${MONTHS[best[0] - 1]} à ${MONTHS[best[1] - 1]}"
    }
    private fun listFr(a: List<String>): String = if (a.size <= 1) a.joinToString("") else "${a.dropLast(1).joinToString(", ")} et ${a.last()}"

    private class Described(val plantings: List<Planting>, val summary: BedSummary, val why: String, var ids: Set<String> = emptySet())

    private fun describe(s: List<Info>, counts: IntArray, area: Double, ambiance: String?, understory: Boolean): Described {
        val months = HashSet<Int>()
        for (i in s) months.addAll(i.bloom)
        val bloomMonths = months.sorted()
        val layers = s.map { it.layer }.toSet().size
        val w = LinkedHashMap<String, Double>()
        s.forEachIndexed { k, i -> if (i.fam != null) { val sp = bedSpacingOf(i.p); w[i.fam] = (w[i.fam] ?: 0.0) + counts[k] * (sp * sp) } }
        val fams = w.keys.toList().sortedWith { a, b ->
            val x = (if (a == "blanc") 1 else 0) - (if (b == "blanc") 1 else 0)
            if (x != 0) x else w[b]!!.compareTo(w[a]!!)
        }
        val paletteText = if (fams.isNotEmpty()) listFr(fams) else "feuillage seul"
        val mell = s.count { it.mell }
        var cost = 0.0
        s.forEachIndexed { k, i -> cost += priceOf(i, counts[k], area) }
        var effSum = 0.0; for (i in s) effSum += i.effort
        val effort = r1(effSum / s.size)
        var fpSum = 0.0
        s.forEachIndexed { k, i -> val sp = bedSpacingOf(i.p); fpSum += counts[k] * (sp * sp) }
        val density = r1(fpSum / area * 100) / 100
        val nMonths = bloomMonths.size
        val parts = ArrayList<String>()
        if (nMonths != 0) parts.add("$nMonths mois de floraison (${monthRangeText(bloomMonths)})")
        parts.add("$layers hauteur${if (layers > 1) "s" else ""}")
        parts.add("palette $paletteText")
        if (mell != 0) parts.add("$mell essence${if (mell > 1) "s" else ""} mellifère${if (mell > 1) "s" else ""}")
        if (understory) parts.add("sous-bois d’un arbre existant")
        if (ambiance != null && getAmbiance(ambiance) != null) parts.add("ambiance ${getAmbiance(ambiance)!!.label.lowercase()}")
        return Described(
            s.mapIndexed { k, i -> Planting(i.id, count = counts[k]) },
            BedSummary(bloomMonths, layers, paletteText, fams, jsRound(cost * 100) / 100, effort, s.size, mell, density),
            parts.joinToString(", "),
        )
    }

    /**
     * Combinaison de plantes d'un massif (5 à 10 essences) : étagement, floraison continue, harmonie des couleurs,
     * feuillage persistant, ambiance, entretien, mellifères, arrosage, coût. Déterministe avec `opts.seed`.
     */
    fun designBed(garden: Garden?, bed: Bed, opts: DesignOptions = DesignOptions()): DesignResult {
        val poly = shapePolygon(bed.shape)
        val area = if (bed.areaM2 > 0) bed.areaM2 else polygonArea(poly)
        val bb = bounds(poly)
        val width = if (bed.widthM > 0) bed.widthM else min(bb.width, bb.height)
        val g = normalizeGardenCtx(garden, opts.tminC)
        val sunAt = makeSunSampler(garden)
        val sunLevel = if (bed.sunLevelGiven) bed.sunLevel else dominantSun(poly, sunAt)
        val ambiance: String? = if (opts.ambiance != null) opts.ambiance.value else bed.ambiance
        val maintenance: String? = if (opts.maintenance != null) opts.maintenance.value else g.maintenance
        val seedN = opts.seed.toDouble().let { if (it == 0.0 || it.isNaN()) 1.0 else it }
        val catalog = opts.plants ?: allPlants()
        val cen = centroid(poly)

        // Contexte local : terrasse/piscine proches, arbre existant (sous-bois).
        var nearTerrace = false
        for (z in garden?.zones ?: emptyList()) {
            if ((z.type == "terrace" || z.type == "pool") && z.shape != null && polysDistance(poly, shapePolygon(z.shape)) < 3) nearTerrace = true
        }
        val understory = existingTrees(garden).any { t -> hyp(cen.x - t.x, cen.y - t.y) <= max(t.h * 0.8, t.w) }

        val ctx = ScoreContext(tminC = g.tminC, sunLevel = sunLevel, areaM2 = area, minDimension = width, soil = g.soil, windy = g.windy, ambiance = ambiance, maintenance = maintenance)
        val massifCats = listOf("perennial", "grass", "bulb", "groundcover", "shrub")
        val roleHigh = bed.role == "haie-fleurie"
        val base = ArrayList<Info>()
        for (p in catalog) {
            if (p.category !in massifCats || p.invasive) continue
            if (p.zones.isNotEmpty() && p.zones.none { it in FLOWER_ZONE_TYPES }) continue
            if (nearTerrace && p.toxic) continue
            if (p.category == "shrub" && p.heightAdult > (if (roleHigh) 3.2 else 2.5)) continue
            val sp = bedSpacingOf(p)
            if (sp * sp > area * 0.45) continue
            if (p.category != "bulb" && p.widthAdult > max(width, 0.6) * 1.25) continue
            val sc = Recommend.scorePlant(p, ctx)
            if (sc.excluded || sc.score < 50) continue
            val hsl = hexToHsl(p.flowerColor)
            val bloom = p.bloom
            val sunOk = sunLevel == null || sunLevel in p.sun
            val shadeLover = "shade" in p.sun || "partial" in p.sun
            base.add(Info(
                p = p, id = p.id, fit = sc.score, layer = layerOf(p), bulb = p.category == "bulb", bloom = bloom,
                hsl = hsl, fam = if (bloom.isNotEmpty()) colorFamily(p.flowerColor) else null, tone = foliageTone(p.foliageColor),
                evergreen = p.foliage == "evergreen", amb = if (ambiance != null) plantAmbianceScore(p, ambiance) else 0.5,
                avoid = if (ambiance != null) ambiance in plantAvoids(p) else false,
                maintOk = if (maintenance == "low" || maintenance == "none") fitsMaintenance(p, maintenance).ok else true,
                effort = plantEffort(p), mell = p.melliferous, water = WATER[p.water] ?: 1, sunOk = sunOk,
                genus = (p.latinName.ifEmpty { p.id }).split(' ')[0],
                under = if (understory) (if (shadeLover && p.heightAdult <= 1.5) 0.6 else if ("full" in p.sun && !shadeLover) -0.4 else 0.0) else 0.0,
            ))
        }

        fun build(palette: String?, amb: String?, avoidIds: Set<String>?, salt: Int): Described? {
            var pool: List<Info> = base.toList()
            pool = relax(pool, { it.sunOk }, 12)
            if (amb != null) pool = relax(pool, { i -> !i.avoid && plantAmbianceScore(i.p, amb) >= 0.4 }, 15)
            if (maintenance == "low" || maintenance == "none") pool = relax(pool, { it.maintOk }, 10)
            val pal = if (palette != null) PALETTES[palette] else null
            if (pal != null) pool = relax(pool, { pal.ok(it) }, 10)
            if (avoidIds != null && avoidIds.isNotEmpty()) pool = relax(pool, { it.id !in avoidIds }, 8)
            if (nearTerrace) pool = pool.filter { !it.p.toxic }
            val infos0 = if (amb == ambiance) pool else pool.map { i -> val d = i.dup(); d.amb = plantAmbianceScore(i.p, amb); d.avoid = if (amb != null) amb in plantAvoids(i.p) else false; d }
            val infos = infos0.map { i -> val d = i.dup(); d.pal = if (pal != null) pal.ok(i) else true; d }
            if (infos.isEmpty()) return null
            val rng = rngFrom(seedN * 104729 + hashStr(bed.id) + salt)
            val s = runDesign(infos, DesignParams(
                area, rng, clamp((opts.iterations?.takeIf { it != 0 } ?: 220).toDouble(), 150.0, 300.0).toInt(), opts.budget, amb, maintenance, palette,
            ))
            val counts = spacedCounts(s, allocate(s, area), bed.id, bed.shape, bed.areaM2)
            val res = describe(s, counts, area, amb, understory)
            res.ids = s.map { it.id }.toSet()
            return res
        }

        val palette = if (opts.palette != null && opts.palette != "auto") opts.palette else null
        val main = build(palette, ambiance, null, 0)
            ?: return DesignResult(emptyList(), describeEmpty(), "Aucune essence du catalogue ne convient à ce massif", emptyList())

        // Alternatives : une autre palette, puis une autre ambiance + palette.
        val mainFams = main.summary.families.filter { it != "blanc" }.toSet()
        val names = PALETTES.keys.filter { it != palette }.toMutableList()
        fun overlap(k: String) = PALETTE_FAMS[k]!!.count { it in mainFams }
        names.sortWith { a, b -> val d = overlap(a) - overlap(b); if (d != 0) d else if (a < b) -1 else 1 }
        val altAmbs = listOf("romantique", "bucolique", "decoratif", "pollinisateurs", "colore", "apaisant").filter { it != ambiance }
        class Spec(val palette: String, val ambiance: String?, val avoid: Set<String>, val label: String)
        val specs = listOf(
            Spec(names[0], ambiance, main.ids, "Variante ${PALETTES[names[0]]!!.label}"),
            Spec(names[1], altAmbs[0], main.ids, "Variante ${PALETTES[names[1]]!!.label}, ambiance ${getAmbiance(altAmbs[0])!!.label.lowercase()}"),
        )
        val alternatives = ArrayList<BedAlternative>()
        val used = HashSet<String>(main.ids)
        specs.forEachIndexed { k, sp ->
            val av = HashSet<String>(sp.avoid); av.addAll(used)
            var r = build(sp.palette, sp.ambiance, av, 17 + k * 31)
            if (r != null && r.ids.all { it in main.ids }) r = build(sp.palette, sp.ambiance, main.ids, 99 + k)
            if (r == null) return@forEachIndexed
            used.addAll(r.ids)
            alternatives.add(BedAlternative(sp.label, sp.palette, sp.ambiance, r.plantings, r.summary, r.why))
        }
        return DesignResult(main.plantings, main.summary, main.why, alternatives)
    }

    private fun describeEmpty() = BedSummary(emptyList(), 0, "feuillage seul", emptyList(), 0.0, 0.0, 0, 0, 0.0)

    // ---------------------------------------------------------------- zones
    /** Hauteur dominante d'un massif (moyenne des hauteurs adultes pondérée par l'emprise) → type de zone. */
    private fun zoneTypeFor(bed: Bed, lookup: (String) -> Plant?): String {
        if (bed.role == "haie-fleurie") return "tallplants"
        var s = 0.0; var h = 0.0
        for (pl in bed.plantings) {
            val p = lookup(pl.plantId) ?: continue
            val sp = bedSpacingOf(p)
            val fp = (pl.count?.takeIf { it != 0 } ?: 1) * (sp * sp)
            s += fp; h += fp * (if (p.heightAdult != 0.0 && !p.heightAdult.isNaN()) p.heightAdult else 0.5)
        }
        if (s == 0.0) return "midplants"
        val m = h / s
        return if (m >= 1.2) "tallplants" else if (m >= 0.45) "midplants" else "lowplants"
    }

    private fun summaryJson(s: BedSummary): JsonObject = JsonObject(linkedMapOf(
        "bloomMonths" to JsonArray(s.bloomMonths.map { JsonPrimitive(it) }),
        "layers" to JsonPrimitive(s.layers),
        "palette" to JsonPrimitive(s.palette),
        "families" to JsonArray(s.families.map { JsonPrimitive(it) }),
        "costEur" to JsonPrimitive(s.costEur),
        "effort" to JsonPrimitive(s.effort),
        "species" to JsonPrimitive(s.species),
        "melliferous" to JsonPrimitive(s.melliferous),
        "density" to JsonPrimitive(s.density),
    ))

    /**
     * Transforme des massifs proposés en zones prêtes à insérer (`auto = true`, `autoInfo`, ambiance, plantations).
     * `ambiance` : `null` (absent) = celle de chaque massif ; `Maybe(x)` = imposée.
     */
    fun bedsToZones(garden: Garden?, beds: List<Bed>, ambiance: Maybe<String>? = null, plants: List<Plant>? = null, startIndex: Int? = null): List<Zone> {
        val catalog = plants ?: allPlants()
        val byId = catalog.associateBy { it.id }
        val lookup: (String) -> Plant? = { byId[it] }
        var start = startIndex
        val existingIds = (garden?.zones ?: emptyList()).map { it.id }.toMutableSet()
        if (start == null) {
            start = 0
            for (z in garden?.zones ?: emptyList()) {
                if (!z.auto) continue
                val m = Regex("n°\\s*(\\d+)").find(z.label) ?: continue
                start = max(start!!, m.groupValues[1].toInt())
            }
        }
        return beds.mapIndexed { i, bed ->
            val type = zoneTypeFor(bed, lookup)
            val pts = (bed.shape as? PolygonShape)?.points ?: shapePolygon(bed.shape)
            var z = createZone(type, PolygonShape(pts.map { Point(it.x, it.y) }))
            val amb = if (ambiance != null) ambiance.value else bed.ambiance
            val a = if (amb != null) getAmbiance(amb) else null
            val num = start!! + i + 1
            var id = "z_${bed.id}"
            while (id in existingIds) id += "b"
            existingIds.add(id)
            val info = linkedMapOf(
                "role" to (bed.role?.let { JsonPrimitive(it) } ?: JsonNull),
                "why" to JsonPrimitive(listOfNotNull(bed.why.takeIf { it.isNotEmpty() }, bed.plantsWhy?.takeIf { it.isNotEmpty() }).joinToString(" — ")),
                "seed" to (bed.seed?.let { JsonPrimitive(it) } ?: JsonNull),
                "summary" to (bed.summary?.let { summaryJson(it) } ?: JsonNull),
            )
            z = z.copy(
                label = if (a != null) "Massif ${a.label.lowercase()} n°$num" else "Massif n°$num",
                id = id,
                auto = true,
                ambiance = a?.id,
                plantings = bed.plantings.map { Planting(it.plantId, count = it.count) },
                autoInfo = JsonObject(info),
            )
            z
        }
    }

    /**
     * Refait les massifs automatiques non gardés. `keepIds` : ids de zones auto à conserver (elles restent occupées).
     * Les massifs dessinés à la main ne sont jamais touchés. Ne modifie pas `garden`. `opts.seed` null : graine suivante.
     */
    fun regenerate(garden: Garden, keepIds: List<String> = emptyList(), opts: BedOptions? = null, seed: Number? = null, ambiance: Maybe<String>? = null): RegenerateResult {
        val keep = keepIds.toSet()
        val zones = garden.zones
        val removed = zones.filter { it.auto && it.id !in keep }.map { it.id }
        val rest = zones.filter { it.id !in removed }
        val g2 = garden.copy(zones = rest)
        var prev = 0.0
        for (z in zones) {
            val s = ((z.autoInfo as? JsonObject)?.get("seed") as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
            if (z.auto && s != null && s.isFinite()) prev = max(prev, s)
        }
        val o = opts ?: BedOptions()
        val sd = seed ?: (prev + 1)
        val beds = proposeBeds(g2, o.copy(seed = sd))
        val added = bedsToZones(g2, beds, ambiance, o.plants)
        return RegenerateResult(beds, rest + added, added, rest.filter { it.auto }.map { it.id }, removed)
    }
}
