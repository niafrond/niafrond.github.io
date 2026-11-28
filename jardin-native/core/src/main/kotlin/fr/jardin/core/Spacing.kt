package fr.jardin.core

import kotlin.math.*

// Espacements horticoles (port de jardin/spacing.js) : couches de végétation, distances minimales entre plants,
// capacité d'une zone, répartition des quantités qui PARTAGENT la surface, placement déterministe respectant les
// distances et avertissements d'espacement. Unité : mètres.
// Le placement reproduit le JS à l'identique (même PRNG mulberry32, mêmes parcours, Float32 pour les voisinages).

val LAYERS = listOf("canopy", "tall", "mid", "low", "ground", "aquatic")
/** Parts de la surface de sous-étage par couche. */
val DEFAULT_SHARES: Map<String, Double> = mapOf("tall" to 0.20, "mid" to 0.35, "low" to 0.30, "ground" to 0.15)
private const val CAP = 2.0 // plafond des rapports distance / distance minimale
private const val ROW_HABIT = "hedge-clipped"

private fun clamp(v: Double, a: Double, b: Double) = min(b, max(a, v))

/** Fabrique de résolution d'essence depuis une liste ou une table (équivalent de `toLookup` du JS). */
fun toLookup(list: List<PlantLike>): PlantLookup = { id -> list.firstOrNull { it.id == id } }
fun toLookup(map: Map<String, PlantLike>): PlantLookup = { id -> map[id] }

// ---------------------------------------------------------------- couches et distances
/** Espacement du catalogue (m) ; repli : largeur adulte, puis 0,5 m. */
fun spacingOf(p: PlantLike?): Double = max(0.05, num(p?.spacing, num(p?.widthAdult, 0.5)))
private fun widthOf(p: PlantLike?): Double = num(p?.widthAdult, spacingOf(p))

/** Couche de végétation : canopy | tall | mid | low | ground | aquatic. */
fun plantLayer(plant: PlantLike?): String {
    if (plant == null) return "mid"
    val h = num(plant.heightAdult, 0.5)
    return when (plant.category) {
        "aquatic" -> "aquatic"
        "lawn", "groundcover", "bulb" -> "ground"
        "tree" -> "canopy"
        "fruit" -> if (h >= 5) "canopy" else if (h >= 2.5) "tall" else "mid"
        "hedge" -> if (h >= 2) "tall" else "mid"
        "shrub" -> if (h >= 2.5) "tall" else "mid"
        "climber" -> "mid"
        "perennial" -> if (h >= 0.8) "mid" else "low"
        "grass" -> if (h >= 1) "mid" else "low"
        "vegetable" -> "low"
        else -> "mid"
    }
}

/** Rayon de pied (m) : ≈ 0,25 × largeur adulte, plafonné (0,6 m sous un arbre, 0,4 m sinon). */
fun footRadius(plant: PlantLike?): Double {
    val cap = if (plantLayer(plant) == "canopy") 0.6 else 0.4
    return clamp(0.25 * widthOf(plant), 0.03, cap)
}
private fun isShrubby(p: PlantLike?) = p != null && (p.category == "shrub" || p.category == "hedge" || p.category == "fruit")
private fun same(a: PlantLike?, b: PlantLike?) = a === b || (a != null && b != null && a.id == b.id)

/**
 * Distance minimale centre à centre (m) entre deux plants adultes.
 * Arbres entre eux ≥ 0,7 × largeur moyenne ; arbre ↔ arbuste ≥ 1 m du tronc + rayon de l'arbuste ; arbre ↔ vivace ≥ 0,8 m ;
 * même espèce : espacement ; même couche : espacement moyen ; couches différentes : somme des rayons de pied.
 */
fun minDistance(a: PlantLike?, b: PlantLike?): Double {
    val la = plantLayer(a); val lb = plantLayer(b)
    val sa = spacingOf(a); val sb = spacingOf(b)
    if (la == "canopy" && lb == "canopy") return max(0.7 * (widthOf(a) + widthOf(b)) / 2, (sa + sb) / 2)
    if (la == "canopy" || lb == "canopy") {
        val o = if (la == "canopy") b else a
        return if (isShrubby(o)) 1 + widthOf(o) / 2 else 0.8
    }
    if (same(a, b)) return sa
    if (la == lb) return (sa + sb) / 2
    return max(0.2, footRadius(a) + footRadius(b))
}

/** Distance minimale (m) d'un bâtiment : arbre ≥ max(3 m, 0,5 × hauteur adulte), grand arbuste ≥ 1,5 m, sinon 0. */
fun clearanceFromBuilding(plant: PlantLike?, heightM: Double? = null): Double {
    val l = plantLayer(plant)
    val h = num(heightM, num(plant?.heightAdult, 1.0))
    if (l == "canopy") return max(3.0, 0.5 * h)
    if (l == "tall") return 1.5
    return 0.0
}

/** Marge au bord de la forme (m) : 0,5 × espacement, plafonnée à 0,8 m. */
fun edgeMargin(plant: PlantLike?): Double = min(0.5 * spacingOf(plant), 0.8)

fun formatSpacing(plant: PlantLike?): String {
    val s = spacingOf(plant)
    return if (s < 1) "${jsNumStr(jsRound(s * 100))} cm" else "${jsNumStr(jsRound(s * 10) / 10).replace('.', ',')} m"
}
private fun fmtM(n: Double) = "${jsNumStr(jsRound(n * 10) / 10).replace('.', ',')} m"

// ---------------------------------------------------------------- géométrie
private fun segDist(px: Double, py: Double, ax: Double, ay: Double, bx: Double, by: Double): Double {
    val dx = bx - ax; val dy = by - ay; val l2 = dx * dx + dy * dy
    val t = if (l2 != 0.0) clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0.0, 1.0) else 0.0
    return hypot(px - (ax + t * dx), py - (ay + t * dy))
}
private fun edgeDist(x: Double, y: Double, poly: List<Point>): Double {
    var d = Double.POSITIVE_INFINITY
    var j = poly.size - 1
    for (i in poly.indices) { d = min(d, segDist(x, y, poly[j].x, poly[j].y, poly[i].x, poly[i].y)); j = i }
    return d
}
private fun perimeterOf(poly: List<Point>): Double {
    var s = 0.0
    for (i in poly.indices) { val q = poly[(i + 1) % poly.size]; s += hypot(poly[i].x - q.x, poly[i].y - q.y) }
    return s
}

/** FNV-1a 32 bits sur les unités UTF-16 (identique à `hash32` du JS). */
internal fun hash32(str: String): Int {
    var h = -2128831035 // 2166136261
    for (ch in str) { h = h xor ch.code; h *= 16777619 }
    return h
}

/** PRNG mulberry32 (identique au JS) : renvoie des flottants dans [0, 1). */
internal class Mulberry32(seed: Int) {
    private var s = seed
    fun next(): Double {
        s += 0x6D2B79F5
        var t = s
        t = (t xor (t ushr 15)) * (t or 1)
        t = t xor (t + (t xor (t ushr 7)) * (t or 61))
        return ((t xor (t ushr 14)).toLong() and 0xFFFFFFFFL).toDouble() / 4294967296.0
    }
}

private fun zonePoly(zone: Zone?): List<Point> = if (zone?.shape != null) shapePolygon(zone.shape, 48) else emptyList()
private fun lineLength(pts: List<Point>): Double { var l = 0.0; for (i in 0 until pts.size - 1) l += hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); return l }

/** Surface utile (m²) : surface moins une bande de 25 cm au bord ; 75 % pour un potager (allées). */
fun usableArea(zone: Zone?, poly: List<Point> = zonePoly(zone)): Double {
    if (poly.size < 3) return 0.0
    val a = polygonArea(poly)
    val u = max(0.4 * a, a - perimeterOf(poly) * 0.25)
    return if (zone?.type == "vegetable") u * 0.75 else u
}

// ---------------------------------------------------------------- capacité (pavage hexagonal)
/** Pied déjà posé : (x, y) ; `r` = rayon d'exclusion imposé, sinon `minDistance(plant, nouvelle essence)`. */
data class PackObstacle(val x: Double, val y: Double, val plant: PlantLike? = null, val r: Double? = null)

/**
 * Nombre maximal de plants de cette essence qui tiennent dans le polygone en respectant l'espacement et la marge au bord
 * (meilleur de plusieurs pavages hexagonaux ou carrés, décalés et orientés).
 */
fun packingCapacity(poly: List<Point>?, plant: PlantLike?, obstacles: List<PackObstacle> = emptyList(), margin: Double? = null): Int {
    if (poly == null || poly.size < 3 || plant == null) return 0
    val d = spacingOf(plant)
    val mg = margin ?: edgeMargin(plant)
    class K(val x: Double, val y: Double, val r: Double)
    val keep = obstacles.map { K(it.x, it.y, it.r ?: minDistance(it.plant, plant)) }
    val A = polygonArea(poly)
    val b = bounds(poly)
    val est = A * 1.16 / (d * d)
    if (est > 30000) return max(1, floor(max(0.0, A - perimeterOf(poly) * mg) * 1.1547 / (d * d) * 0.98).toInt())
    fun ok(x: Double, y: Double): Boolean {
        if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return false
        if (!pointInPolygon(Point(x, y), poly)) return false
        if (mg > 0 && edgeDist(x, y, poly) < mg - 1e-9) return false
        for (k in keep) if (hypot(x - k.x, y - k.y) < k.r - 1e-9) return false
        return true
    }
    fun ok2(x: Double, y: Double): Boolean {
        if (!pointInPolygon(Point(x, y), poly)) return false
        for (k in keep) if (hypot(x - k.x, y - k.y) < k.r - 1e-9) return false
        return true
    }
    val n = if (est > 2500) 1 else if (est > 600) 2 else if (est > 120) 3 else 4
    val cx = (b.minX + b.maxX) / 2; val cy = (b.minY + b.maxY) / 2
    val R = hypot(b.width, b.height) / 2 + d
    var angles = listOf(0.0)
    if (est <= 600) { val ax = polyAxis(poly).ang; if (abs(sin(ax)) > 0.02) angles = listOf(0.0, ax) }
    var best = 0
    for (th in angles) {
        for (hex in if (est > 2500) listOf(true) else listOf(true, false)) {
            val ux = cos(th) * d; val uy = sin(th) * d
            val vAng = th + (if (hex) PI / 3 else PI / 2)
            val vx = cos(vAng) * d; val vy = sin(vAng) * d
            val range = ceil(R / (d * (if (hex) 0.8 else 1.0))).toInt() + 1
            for (sa in 0 until n) {
                for (sb in 0 until n) {
                    val ox = cx + (ux * sa + vx * sb) / n; val oy = cy + (uy * sa + vy * sb) / n
                    var cnt = 0
                    for (i in -range..range) {
                        for (j in -range..range) if (ok(ox + i * ux + j * vx, oy + i * uy + j * vy)) cnt++
                    }
                    if (cnt > best) best = cnt
                }
            }
        }
    }
    if (best == 0) {
        val c = centroid(poly)
        if (ok2(c.x, c.y)) return 1
        for (i in 1 until 10) for (j in 1 until 10) if (ok2(b.minX + b.width * i / 10, b.minY + b.height * j / 10)) return 1
    }
    return best
}

// ---------------------------------------------------------------- placement
private fun isRow(plant: PlantLike?) = habitOf(plant).id == ROW_HABIT
private fun isClimber(plant: PlantLike?): Boolean { val id = habitOf(plant).id; return id == "climber" || id == "vine" }
private fun isBamboo(plant: PlantLike?) = habitOf(plant).id == "bamboo"

/** Position le long d'une polyligne à l'abscisse curviligne t. */
private fun alongPath(pts: List<Point>, t: Double): Point {
    var rest = t
    for (i in 0 until pts.size - 1) {
        val L = hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
        if (rest <= L || i == pts.size - 2) {
            val k = if (L != 0.0) clamp(rest / L, 0.0, 1.0) else 0.0
            return Point(pts[i].x + (pts[i + 1].x - pts[i].x) * k, pts[i].y + (pts[i + 1].y - pts[i].y) * k)
        }
        rest -= L
    }
    return Point(pts[0].x, pts[0].y)
}

private class RowPath(val pts: List<Point>, val inset: Double, val line: Boolean)

/** Chemin d'une haie : la ligne de la zone, sinon le grand axe du polygone. */
private fun rowPath(shape: Shape?, poly: List<Point>): RowPath {
    if (shape is LineShape && shape.points.size >= 2) return RowPath(shape.points, 0.05, true)
    val ax = polyAxis(poly)
    return RowPath(listOf(Point(ax.cx - ax.ux * ax.len / 2, ax.cy - ax.uy * ax.len / 2), Point(ax.cx + ax.ux * ax.len / 2, ax.cy + ax.uy * ax.len / 2)), 0.3, false)
}

private class Grp(val idx: Int, val src: Int, val plantId: String, val plant: PlantLike, val n: Int, val layer: String, val sp: Double, val margin: Double, var placed: Int = 0)

/** Essences (groupes) → ordre de pose : entremêlées en proportion. */
private fun interleave(groups: List<Grp>, rnd: () -> Double): List<Grp> {
    val left = IntArray(groups.size) { groups[it].n }
    val seq = ArrayList<Grp>()
    var total = left.sum()
    while (total > 0) {
        var bi = -1; var bv = -1.0
        for (i in groups.indices) {
            if (left[i] > 0) { val v = left[i].toDouble() / groups[i].n + rnd() * 0.25; if (v > bv) { bv = v; bi = i } }
        }
        seq.add(groups[bi]); left[bi]--; total--
    }
    return seq
}

data class PackPosition(
    val plantId: String, val x: Double, val y: Double, val gi: Int, val k: Int,
    val forced: Boolean = false, val row: Boolean = false, val wall: Boolean = false,
)
data class Overflow(val plantId: String, val wanted: Int, val placed: Int, val gi: Int)
data class PackResult(val positions: List<PackPosition>, val overflow: List<Overflow>, val maxima: List<Int>? = null)

/** Options de `packZone` : graine, jardin (murs porteurs), `force` (pose au mieux les plants qui ne tiennent pas), `maxima`. */
data class PackOptions(val seed: Any? = null, val garden: Garden? = null, val force: Boolean = false, val maxima: Boolean = false)

private fun seedString(seed: Any?): String = when (seed) {
    null -> ""
    is Double -> if (seed == floor(seed) && abs(seed) < 1e15) seed.toLong().toString() else seed.toString()
    is Float -> seedString(seed.toDouble())
    else -> seed.toString()
}

private class DBuf {
    var a = DoubleArray(256); var n = 0
    fun add(v: Double) { if (n == a.size) a = a.copyOf(n * 2); a[n++] = v }
    fun toArray(): DoubleArray = a.copyOf(n)
}

private class Placed(val x: Double, val y: Double, val g: Int, val forced: Boolean = false, val row: Boolean = false, val wall: Boolean = false)

/**
 * Place les plants d'une zone (déterministe) en respectant `minDistance` entre tous les plants et la marge au bord.
 * Arbres d'abord, puis arbustes, vivaces, couvre-sols ; haies en rang unique ; bambous en touffes ; grimpantes au pied du
 * mur le plus proche (`opts.garden`) ; potager en rangs. `gi` : indice de la ligne dans `plantings`.
 */
fun packZone(zone: Zone?, plantings: List<Planting>?, plantsById: PlantLookup, opts: PackOptions = PackOptions()): PackResult {
    val shape = zone?.shape
    val poly = zonePoly(zone)
    if (zone == null || shape == null || poly.size < 3) return PackResult(emptyList(), emptyList())
    val lookup = plantsById
    val groups = ArrayList<Grp>()
    (plantings ?: emptyList()).forEachIndexed { src, pl ->
        val plant = effectivePlant(lookup(pl.plantId), pl) ?: return@forEachIndexed
        if (plant.category == "lawn") return@forEachIndexed
        val n = max(0, pl.count ?: 1)
        if (n == 0) return@forEachIndexed
        groups.add(Grp(groups.size, src, pl.plantId, plant, n, plantLayer(plant), spacingOf(plant), edgeMargin(plant)))
    }
    if (groups.isEmpty()) return PackResult(emptyList(), emptyList())
    val G = groups.size
    val M = Array(G) { i -> DoubleArray(G) { j -> minDistance(groups[i].plant, groups[j].plant) } }
    val rng = Mulberry32(hash32("${seedString(opts.seed)}|${zone.id}"))
    val rnd: () -> Double = { rng.next() }
    val placed = ArrayList<Placed>()
    val gardenWalls = if (opts.garden != null) wallSegments(opts.garden) else emptyList()
    val b = bounds(poly)

    fun finish(nb: Array<FloatArray>?, X: DoubleArray, Y: DoubleArray, ED: DoubleArray, WALL: BooleanArray, hasWallCand: Boolean): PackResult {
        val positions = ArrayList<PackPosition>()
        val overflow = ArrayList<Overflow>()
        for (g in groups) {
            var k = 0
            for (q in placed) if (q.g == g.idx) positions.add(PackPosition(g.plantId, q.x, q.y, g.src, k++, q.forced, q.row, q.wall))
            if (g.placed < g.n) overflow.add(Overflow(g.plantId, g.n, g.placed, g.src))
        }
        var maxima: List<Int>? = null
        if (opts.maxima) {
            val res = IntArray((plantings ?: emptyList()).size)
            if (nb != null && X.isNotEmpty()) {
                for (g in groups) {
                    var extra = 0
                    if (g.placed >= g.n && !isRow(g.plant)) {
                        val tmp = nb[g.idx].copyOf()
                        val m = M[g.idx][g.idx]
                        val climbWall = hasWallCand && isClimber(g.plant)
                        while (extra < 80) {
                            var best = -1; var bv = -1.0
                            for (c in X.indices) {
                                if (tmp[c] < 1 - 1e-9) continue
                                if (if (WALL[c]) !climbWall else climbWall) continue
                                if (!WALL[c] && ED[c] < g.margin - 1e-9) continue
                                if (tmp[c] > bv) { bv = tmp[c].toDouble(); best = c }
                            }
                            if (best < 0) break
                            for (c in X.indices) { val r = hypot(X[c] - X[best], Y[c] - Y[best]) / m; if (r < tmp[c]) tmp[c] = r.toFloat() }
                            extra++
                        }
                    }
                    res[g.src] = g.placed + extra
                }
            }
            maxima = res.toList()
        }
        return PackResult(positions, overflow, maxima)
    }

    // ----- potager : rangs réguliers
    if (groups.all { it.plant.category == "vegetable" }) {
        val step = groups.maxOf { it.sp }
        val pts = ArrayList<Point>()
        var y = b.minY + step / 2
        while (y <= b.maxY) {
            var x = b.minX + step / 2
            while (x <= b.maxX) {
                if (pointInPolygon(Point(x, y), poly) && edgeDist(x, y, poly) >= min(step / 2, 0.3) - 1e-9) pts.add(Point(x, y))
                x += step
            }
            y += step
        }
        val total = groups.sumOf { it.n }
        if (pts.size >= total) {
            val seq = interleave(groups, rnd)
            seq.forEachIndexed { i, g ->
                val p = pts[min(pts.size - 1, floor(((i + 0.5) * pts.size) / total).toInt())]
                placed.add(Placed(p.x, p.y, g.idx)); g.placed++
            }
            return finish(null, DoubleArray(0), DoubleArray(0), DoubleArray(0), BooleanArray(0), false)
        }
    }

    // ----- candidats
    val A = polygonArea(poly)
    val minSp = groups.minOf { it.sp }
    var step = max(max(min(minSp / 4, 0.25), sqrt(A / 2200)), 0.04)
    var xs = DBuf(); var ys = DBuf(); var eds = DBuf()
    for (attempt in 0 until 4) {
        xs = DBuf(); ys = DBuf(); eds = DBuf()
        val ox = b.minX + rnd() * step; val oy = b.minY + rnd() * step
        var y = oy
        while (y <= b.maxY) {
            var x = ox
            while (x <= b.maxX) {
                if (pointInPolygon(Point(x, y), poly)) { xs.add(x); ys.add(y); eds.add(edgeDist(x, y, poly)) }
                x += step
            }
            y += step
        }
        if (xs.n >= 6) break
        step /= 2
    }
    if (xs.n == 0) { val c = centroid(poly); xs.add(c.x); ys.add(c.y); eds.add(max(0.0, edgeDist(c.x, c.y, poly))) }
    val walls = DBuf() // 1.0 = candidat au pied d'un mur
    for (i in 0 until xs.n) walls.add(0.0)
    var hasWallCand = false
    val hasClimber = groups.any { isClimber(it.plant) }
    if (hasClimber && gardenWalls.isNotEmpty()) {
        val cen = centroid(poly)
        for (w in gardenWalls) {
            val L = hypot(w.b.x - w.a.x, w.b.y - w.a.y)
            if (L < 0.2) continue
            var nx = -(w.b.y - w.a.y) / L; var ny = (w.b.x - w.a.x) / L
            val mx = (w.a.x + w.b.x) / 2; val my = (w.a.y + w.b.y) / 2
            if ((cen.x - mx) * nx + (cen.y - my) * ny < 0) { nx = -nx; ny = -ny }
            val ns = max(1, jsRound(L / 0.1).toInt())
            for (i in 0..ns) {
                val t = 0.02 + 0.96 * i / ns
                val px = w.a.x + (w.b.x - w.a.x) * t + nx * 0.22; val py = w.a.y + (w.b.y - w.a.y) * t + ny * 0.22
                val inside = pointInPolygon(Point(px, py), poly)
                if (inside || edgeDist(px, py, poly) <= 0.6) {
                    xs.add(px); ys.add(py); eds.add(if (inside) edgeDist(px, py, poly) else 0.0); walls.add(1.0); hasWallCand = true
                }
            }
        }
    }
    val X = xs.toArray(); val Y = ys.toArray(); val ED = eds.toArray()
    val WALL = BooleanArray(X.size) { walls.a[it] == 1.0 }
    val C = X.size
    val nb = Array(G) { FloatArray(C) { CAP.toFloat() } }

    // candidats rangés en cases de 0,5 m
    val CS = 0.5
    val cells = HashMap<Long, MutableList<Int>>()
    fun cellKey(ix: Int, iy: Int): Long = (ix + 64).toLong() * 16384 + (iy + 64)
    for (c in 0 until C) {
        cells.getOrPut(cellKey(floor((X[c] - b.minX) / CS).toInt(), floor((Y[c] - b.minY) / CS).toInt())) { ArrayList() }.add(c)
    }
    fun commit(g: Grp, x: Double, y: Double, forced: Boolean = false, row: Boolean = false, wall: Boolean = false) {
        placed.add(Placed(x, y, g.idx, forced, row, wall))
        if (!forced) g.placed++
        for (h in 0 until G) {
            val m = M[h][g.idx]; val lim = CAP * m; val arr = nb[h]
            val x0 = floor((x - lim - b.minX) / CS).toInt(); val x1 = floor((x + lim - b.minX) / CS).toInt()
            val y0 = floor((y - lim - b.minY) / CS).toInt(); val y1 = floor((y + lim - b.minY) / CS).toInt()
            for (ix in x0..x1) {
                for (iy in y0..y1) {
                    val l = cells[cellKey(ix, iy)] ?: continue
                    for (c in l) {
                        val dx = X[c] - x; val dy = Y[c] - y
                        val r = sqrt(dx * dx + dy * dy) / m
                        if (r < arr[c]) arr[c] = r.toFloat()
                    }
                }
            }
        }
    }
    fun clearAt(g: Grp, x: Double, y: Double): Boolean { for (q in placed) if (hypot(q.x - x, q.y - y) < M[g.idx][q.g] - 1e-9) return false; return true }

    // ----- rangs de haies taillées
    val rows = groups.filter { isRow(it.plant) }
    if (rows.isNotEmpty()) {
        val path = rowPath(shape, poly)
        val L = lineLength(path.pts)
        val seq = interleave(rows, rnd)
        var need = 0.0
        for (i in 1 until seq.size) need += M[seq[i - 1].idx][seq[i].idx]
        val usable = max(0.0, L - 2 * path.inset)
        var t = path.inset + max(0.0, (usable - need) / 2)
        var k = 0
        while (k < seq.size) {
            if (k > 0) t += M[seq[k - 1].idx][seq[k].idx]
            if (t > L - path.inset + 1e-9) break
            val p = alongPath(path.pts, t)
            if (!path.line && !pointInPolygon(p, poly)) { k++; continue }
            if (!clearAt(seq[k], p.x, p.y)) { k++; continue }
            commit(seq[k], p.x, p.y, row = true)
            k++
        }
    }

    // ----- pose générale
    val rest = groups.filter { !isRow(it.plant) }
    val order = ArrayList<Grp>()
    for (layer in LAYERS) {
        val gs = rest.filter { it.layer == layer }
        if (gs.isNotEmpty()) order.addAll(interleave(gs, rnd))
    }
    val cen0 = centroid(poly); val diag = max(0.5, hypot(b.width, b.height))
    val nTotal = groups.sumOf { it.n }
    fun pickFor(g: Grp, relaxed: Boolean): Int {
        val pull = if (g.layer == "canopy" || nTotal <= 3) 0.15 else 0.0
        val climbWall = hasWallCand && isClimber(g.plant)
        var anchorX = 0.0; var anchorY = 0.0; var hasAnchor = false
        if (isBamboo(g.plant) && g.placed != 0) {
            val mine = placed.filter { it.g == g.idx }
            for (q in mine) { anchorX += q.x / mine.size; anchorY += q.y / mine.size }
            hasAnchor = true
        }
        var best = -1; var bestV = Double.NEGATIVE_INFINITY
        val arr = nb[g.idx]
        for (c in 0 until C) {
            if (arr[c] < 1 - 1e-9) continue
            val e: Double
            if (WALL[c]) { if (!climbWall) continue; e = CAP }
            else if (climbWall) continue
            else e = if (relaxed) (if (ED[c] > 0.01) CAP else -1.0) else ED[c] / g.margin
            if (e < 1 - 1e-9) continue
            val v = if (hasAnchor) -hypot(X[c] - anchorX, Y[c] - anchorY) + rnd() * 0.02
            else min(min(arr[c].toDouble(), e), CAP) + rnd() * 0.03 + (if (pull != 0.0) pull * (1 - hypot(X[c] - cen0.x, Y[c] - cen0.y) / diag) else 0.0)
            if (v > bestV) { bestV = v; best = c }
        }
        return best
    }
    fun forceFor(g: Grp): Int {
        var best = -1; var bestV = Double.NEGATIVE_INFINITY
        val arr = nb[g.idx]
        for (c in 0 until C) {
            if (WALL[c] || ED[c] <= 0.01) continue
            val v = arr[c] + rnd() * 0.02
            if (v > bestV) { bestV = v; best = c }
        }
        return if (best >= 0) best else 0
    }
    for (g in order) {
        var c = pickFor(g, false)
        if (c < 0) c = pickFor(g, true)
        if (c >= 0) { commit(g, X[c], Y[c], wall = WALL[c]); continue }
        if (opts.force) { val f = forceFor(g); commit(g, X[f], Y[f], forced = true) }
    }
    return finish(nb, X, Y, ED, WALL, hasWallCand)
}

/**
 * Ramène les quantités à ce qui tient réellement (aucun dépassement) : renvoie de nouvelles plantations
 * (lignes ramenées à 0 retirées) ; ne modifie pas `plantings`.
 */
fun fitQuantities(zone: Zone, plantings: List<Planting>?, plantsById: PlantLookup, opts: PackOptions = PackOptions()): List<Planting> {
    var cur: MutableList<Planting> = (plantings ?: emptyList()).toMutableList()
    for (it in 0 until 40) {
        val r = packZone(zone.copy(plantings = cur), cur, plantsById, opts)
        if (r.overflow.isEmpty()) break
        for (o in r.overflow) {
            val pl = cur.getOrNull(o.gi) ?: continue
            val c = pl.count ?: 1
            val nc = if (it < 5) o.placed else max(0, min(o.placed, (if (c == 0) 1 else c) - 1))
            cur[o.gi] = pl.copy(count = nc)
        }
        cur = cur.filter { p -> p.count == null || p.count > 0 }.toMutableList()
    }
    return cur
}

// ---------------------------------------------------------------- répartition des quantités
data class Allocation(val plantId: String, val count: Int)

/** Options de `allocateQuantities` : parts par couche, couche personnalisée (`layerOf`), graine. */
data class AllocOptions(val shares: Map<String, Double>? = null, val layerOf: ((PlantLike) -> String)? = null, val seed: Any? = null)

/**
 * Quantités par essence qui PARTAGENT la surface d'une zone : couronne des arbres réservée d'abord, puis surface restante
 * répartie par couches (haut 20 %, milieu 35 %, bas 30 %, sol 15 %), chaque essence recevant `part / espacement²` plants,
 * jamais plus que la capacité. Une haie taillée = un rang unique. Dans l'ordre de `species` (0 = ne tient pas).
 */
fun allocateQuantities(zone: Zone, species: List<PlantLike>, opts: AllocOptions = AllocOptions()): List<Allocation> {
    val plants = species
    val out = IntArray(plants.size)
    val poly = zonePoly(zone)
    if (poly.size < 3) return plants.map { Allocation(it.id, 1) }
    val layerOf: (PlantLike) -> String = opts.layerOf ?: { plantLayer(it) }
    val shares = opts.shares ?: DEFAULT_SHARES
    val usable = usableArea(zone, poly)
    val lawn = ArrayList<Int>(); val row = ArrayList<Int>(); val tree = ArrayList<Int>(); val under = ArrayList<Int>()
    plants.forEachIndexed { i, p ->
        if (p.category == "lawn") lawn.add(i)
        else if (isRow(p) && opts.layerOf == null) row.add(i)
        else if (layerOf(p) == "canopy") tree.add(i)
        else under.add(i)
    }
    for (i in lawn) out[i] = 1

    var crown = 0.0
    var obstacles: List<PackObstacle> = emptyList()
    if (tree.isNotEmpty()) {
        val nT = tree.size
        for (i in tree) {
            val p = plants[i]; val c = PI * (widthOf(p) / 2).pow(2)
            val byCrown = floor(usable * 0.8 / nT / c + 1e-9).toInt()
            val bySp = max(1, floor(usable / spacingOf(p).pow(2) + 1e-9).toInt())
            out[i] = max(1, min(byCrown, bySp))
        }
        val byId: PlantLookup = { id -> plants.firstOrNull { it.id == id } }
        var pl: MutableList<Planting> = tree.map { Planting(plants[it].id, count = out[it]) }.toMutableList()
        var r: PackResult? = null
        for (it in 0 until 12) {
            r = packZone(zone.copy(plantings = pl), pl, byId, PackOptions(seed = opts.seed))
            if (r.overflow.isEmpty()) break
            for (o in r.overflow) pl[o.gi] = pl[o.gi].copy(count = o.placed)
            pl = pl.filter { (it.count ?: 0) > 0 }.toMutableList()
            if (pl.isEmpty()) { r = PackResult(emptyList(), emptyList()); break }
        }
        for (i in tree) out[i] = 0
        for (x in pl) { val i = tree.firstOrNull { plants[it].id == x.plantId }; if (i != null) out[i] = x.count ?: 0 }
        obstacles = (r?.positions ?: emptyList()).map { q -> PackObstacle(q.x, q.y, byId(q.plantId)) }
        crown = tree.sumOf { i -> out[i] * PI * (widthOf(plants[i]) / 2).pow(2) }
    }
    val R = if (tree.isNotEmpty() && crown > 0) max(usable - crown, 0.2 * usable) else usable

    if (row.isNotEmpty()) {
        val path = rowPath(zone.shape, poly)
        val L = lineLength(path.pts)
        val avg = row.sumOf { spacingOf(plants[it]) } / row.size
        val total = max(1, floor((L - 2 * path.inset) / avg + 1e-9).toInt() + 1)
        for (i in row) out[i] = max(1, floor(total.toDouble() / row.size).toInt())
    }

    val byLayer = LinkedHashMap<String, MutableList<Int>>()
    for (i in under) byLayer.getOrPut(layerOf(plants[i])) { ArrayList() }.add(i)
    fun shareOf(k: String): Double = (shares[k] ?: 0.0).let { if (it > 0) it else 0.3 }
    val totalShare = byLayer.keys.sumOf { shareOf(it) }.let { if (it == 0.0) 1.0 else it }
    for ((k, idxs) in byLayer) {
        val part = R * shareOf(k) / totalShare
        for (i in idxs) {
            val p = plants[i]
            val raw = part / idxs.size / spacingOf(p).pow(2)
            var n = min(300, jsRound(raw).toInt())
            val upper = floor(max(0.0, usable) * 1.1547 / spacingOf(p).pow(2) + perimeterOf(poly) / spacingOf(p)).toInt() + 1
            val cap = if (n > 0.5 * upper || obstacles.isNotEmpty()) packingCapacity(poly, p, obstacles) else n
            if (cap >= 1) n = max(1, n)
            out[i] = max(0, min(n, cap))
        }
    }
    return plants.mapIndexed { i, p -> Allocation(p.id, out[i]) }
}

// ---------------------------------------------------------------- avertissements
private val layoutCache = object : LinkedHashMap<Any, PackResult>() {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Any, PackResult>?) = size > 300
}

private fun spacingKey(garden: Garden?, zone: Zone, plantings: List<Planting>, lookup: PlantLookup): Any {
    val pls = plantings.map { pl ->
        val p = lookup(pl.plantId)
        listOf(pl.plantId, pl.count, pl.height, pl.width, p?.let { listOf(it.spacing, it.widthAdult, it.heightAdult, it.category, it.habit) })
    }
    val g = garden?.let { listOf(it.obstacles, it.boundary, it.boundaryClosed, it.boundaryEdges) }
    return listOf(zone.shape, zone.type, zone.id, pls, g)
}

/** Pose d'une zone avec mémoire (mêmes entrées, mêmes positions) : utilisée par les avertissements et l'interface. */
fun zoneLayout(garden: Garden?, zone: Zone, plantsById: PlantLookup): PackResult {
    val pls = zone.plantings
    val key = spacingKey(garden, zone, pls, plantsById)
    synchronized(layoutCache) {
        layoutCache[key]?.let { return it }
    }
    val hit = packZone(zone, pls, plantsById, PackOptions(garden = garden, force = true, maxima = true))
    synchronized(layoutCache) { layoutCache[key] = hit }
    return hit
}

private fun nameOf(p: PlantLike?): String = p?.let { it.commonName?.takeIf { n -> n.isNotEmpty() } ?: it.id } ?: "Plante"
private fun polyDist(x: Double, y: Double, poly: List<Point>): Double = if (pointInPolygon(Point(x, y), poly)) 0.0 else edgeDist(x, y, poly)

/** Avertissement d'espacement. `level` : warn | info ; `kind` : surdensite | arbres-proches | pied-arbre | batiment | bord. */
data class SpacingWarning(val level: String, val zoneId: String, val plantId: String?, val kind: String, val text: String)

fun checkSpacing(garden: Garden?, zone: Zone?, plantsById: PlantLookup): List<SpacingWarning> {
    val res = ArrayList<SpacingWarning>()
    if (zone == null || zone.shape == null || zone.plantings.isEmpty()) return res
    val lay = zoneLayout(garden, zone, plantsById)
    val zid = zone.id
    val pls = zone.plantings
    fun plantOf(gi: Int): PlantLike? = effectivePlant(plantsById(pls[gi].plantId), pls[gi])

    for (o in lay.overflow) {
        val p = plantOf(o.gi)
        res.add(SpacingWarning("warn", zid, o.plantId, "surdensite", "${nameOf(p)} : ${o.wanted} plants ne tiennent pas, ${o.placed} maximum avec ${formatSpacing(p)} d'espacement"))
    }
    class Pos(val q: PackPosition, val plant: PlantLike)
    val pos = lay.positions.mapNotNull { q -> plantOf(q.gi)?.let { Pos(q, it) } }
    val trees = pos.filter { plantLayer(it.plant) == "canopy" }
    val seen = HashSet<String>()
    for (i in trees.indices) {
        for (j in i + 1 until trees.size) {
            val d = hypot(trees[i].q.x - trees[j].q.x, trees[i].q.y - trees[j].q.y); val need = minDistance(trees[i].plant, trees[j].plant)
            if (d < need - 0.05) {
                val key = "${trees[i].q.plantId}|${trees[j].q.plantId}"
                if (!seen.add(key)) continue
                val a = nameOf(trees[i].plant); val b = nameOf(trees[j].plant)
                res.add(SpacingWarning("warn", zid, trees[i].q.plantId, "arbres-proches",
                    if (a == b) "Deux $a à ${fmtM(d)} : prévoir ${fmtM(need)}" else "$a et $b à ${fmtM(d)} : prévoir ${fmtM(need)}"))
            }
        }
    }
    val seenFoot = HashSet<String>()
    for (q in pos) {
        if (plantLayer(q.plant) == "canopy") continue
        for (t in trees) {
            val d = hypot(q.q.x - t.q.x, q.q.y - t.q.y); val need = minDistance(t.plant, q.plant)
            if (d < need - 0.05) {
                val key = "${q.q.plantId}|${t.q.plantId}"
                if (!seenFoot.add(key)) continue
                res.add(SpacingWarning("warn", zid, q.q.plantId, "pied-arbre", "${nameOf(q.plant)} à ${fmtM(d)} du tronc de ${nameOf(t.plant)} : prévoir ${fmtM(need)}"))
            }
        }
    }
    val builds = (garden?.obstacles ?: emptyList()).filter { (it.kind == "house" || it.kind == "shed") && it.points != null && it.points.size >= 3 }
    val bound = if (garden != null && garden.boundaryClosed && garden.boundary.size >= 3) garden.boundary else null
    val seenB = HashSet<String>(); val seenE = HashSet<String>()
    for (q in pos) {
        val need = clearanceFromBuilding(q.plant, q.plant.heightAdult)
        if (need > 0) {
            for (bd in builds) {
                val d = polyDist(q.q.x, q.q.y, bd.points!!)
                val key = "${q.q.plantId}|${bd.id}"
                if (d < need - 0.05 && key !in seenB) {
                    seenB.add(key)
                    res.add(SpacingWarning("warn", zid, q.q.plantId, "batiment",
                        "${nameOf(q.plant)} à ${fmtM(d)} de ${if (bd.kind == "house") "la maison" else "l’abri"} : prévoir ${fmtM(need)}"))
                }
            }
        }
        if (bound != null && plantLayer(q.plant) == "canopy" && q.q.plantId !in seenE) {
            val d = edgeDist(q.q.x, q.q.y, bound)
            if (pointInPolygon(Point(q.q.x, q.q.y), bound) && d < 2 && num(q.plant.heightAdult, 0.0) > 2) {
                seenE.add(q.q.plantId)
                res.add(SpacingWarning("info", zid, q.q.plantId, "bord",
                    "${nameOf(q.plant)} à ${fmtM(d)} de la limite du terrain : un arbre de plus de 2 m se plante à 2 m au moins de la limite"))
            }
        }
    }
    return res
}
