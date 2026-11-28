package fr.jardin.core

import kotlin.math.*

// Ensoleillement (port de jardin/sun.js) : trajectoire du soleil, ombres des obstacles, cartes estimées.
// Repère du plan : x droite, y bas ; `northAngle` = rotation du nord (degrés, sens horaire).
// Les dates sont des instants en millisecondes depuis l'époque (équivalent de `Date.getTime()`).

data class SunPosition(val azimuth: Double, val elevation: Double)

/** Position du soleil (algorithme type NOAA, précision ~0,1°) : azimut depuis le nord (sens horaire), élévation (°). */
fun sunPosition(lat: Double, lon: Double, epochMillis: Long): SunPosition {
    val jd = epochMillis.toDouble() / 86400000.0 + 2440587.5
    val T = (jd - 2451545) / 36525
    val L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360
    val M = 357.52911 + T * (35999.05029 - 0.0001537 * T)
    val e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
    val Mr = rad(M)
    val C = sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
        sin(2 * Mr) * (0.019993 - 0.000101 * T) + sin(3 * Mr) * 0.000289
    val vraie = L0 + C
    val omega = 125.04 - 1934.136 * T
    val apparente = vraie - 0.00569 - 0.00478 * sin(rad(omega))
    val eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60
    val eps = eps0 + 0.00256 * cos(rad(omega))
    val decl = asin(sin(rad(eps)) * sin(rad(apparente)))
    val y = tan(rad(eps) / 2).pow(2)
    val L0r = rad(L0)
    val eqt = 4 * deg(y * sin(2 * L0r) - 2 * e * sin(Mr) + 4 * e * y * sin(Mr) * cos(2 * L0r) -
        0.5 * y * y * sin(4 * L0r) - 1.25 * e * e * sin(2 * Mr))
    val dayMs = Math.floorMod(epochMillis, 86400000L)
    val h = dayMs / 3600000L
    val mi = (dayMs / 60000L) % 60
    val s = (dayMs / 1000L) % 60
    val ms = dayMs % 1000
    val minutesUTC = (h * 60 + mi).toDouble() + s / 60.0 + ms / 60000.0
    val tst = minutesUTC + eqt + 4 * lon
    val H = rad(tst / 4 - 180)
    val phi = rad(lat)
    val sinEl = sin(phi) * sin(decl) + cos(phi) * cos(decl) * cos(H)
    val elevation = deg(asin(max(-1.0, min(1.0, sinEl))))
    val az = atan2(sin(H), cos(H) * sin(phi) - tan(decl) * cos(phi))
    return SunPosition((deg(az) + 180 + 360) % 360, elevation)
}

/** Niveau d'ensoleillement selon les heures de soleil direct. */
fun levelFromHours(h: Double): String = if (h >= 6) "full" else if (h >= 3) "partial" else "shade"

private const val PAS_MIN = 15

private class SunSample(val ux: Double, val uy: Double, val tanEl: Double)

private fun utcYmd(epochMillis: Long): Triple<Int, Int, Int> {
    val d = java.time.Instant.ofEpochMilli(epochMillis).atZone(java.time.ZoneOffset.UTC)
    return Triple(d.year, d.monthValue - 1, d.dayOfMonth)
}

private fun dateUtcMillis(year: Int, month0: Int, day: Int, hour: Int): Long =
    java.time.LocalDateTime.of(year, month0 + 1, day, hour, 0).toInstant(java.time.ZoneOffset.UTC).toEpochMilli()

/** Solstice d'été (21 juin, 12 h UTC) de l'année courante : date par défaut des cartes estimées. */
fun defaultSolsticeMillis(): Long = dateUtcMillis(java.time.Year.now(java.time.ZoneOffset.UTC).value, 5, 21, 12)

private fun echantillonsSoleil(lat: Double, lon: Double, northAngle: Double, epochMillis: Long): List<SunSample> {
    val (y, m, d) = utcYmd(epochMillis)
    val midi = dateUtcMillis(y, m, d, 12).toDouble() - (lon / 15) * 3600000
    val debut = midi - 12 * 3600000
    val res = ArrayList<SunSample>()
    var t = debut
    while (t < debut + 24 * 3600000) {
        val s = sunPosition(lat, lon, t.toLong())
        if (s.elevation > 0) {
            val a = rad(s.azimuth + northAngle)
            res.add(SunSample(sin(a), -cos(a), tan(rad(s.elevation))))
        }
        t += PAS_MIN * 60000
    }
    return res
}

/** Distance (le long du rayon P + t·u) jusqu'à l'obstacle, ou +∞. */
private fun distanceObstacle(p: Point, u: SunSample, ob: ShadowObstacle): Double {
    val c = ob.center
    if (ob.kind == "tree" || (c != null && ob.radius != null && ob.points == null)) {
        if (c == null || ob.radius == null) return Double.POSITIVE_INFINITY
        val fx = p.x - c.x
        val fy = p.y - c.y
        val b = fx * u.ux + fy * u.uy
        val cc = fx * fx + fy * fy - ob.radius * ob.radius
        val disc = b * b - cc
        if (disc < 0) return Double.POSITIVE_INFINITY
        val r = sqrt(disc)
        val t1 = -b - r
        val t2 = -b + r
        if (t2 < 0) return Double.POSITIVE_INFINITY
        return max(0.0, t1)
    }
    val pts = ob.points
    if (pts == null || pts.size < 2) return Double.POSITIVE_INFINITY
    val n = if (pts.size == 2) 1 else pts.size
    var best = Double.POSITIVE_INFINITY
    for (i in 0 until n) {
        val a = pts[i]
        val b = pts[(i + 1) % pts.size]
        val ex = b.x - a.x
        val ey = b.y - a.y
        val den = u.ux * ey - u.uy * ex
        if (abs(den) < 1e-12) continue
        val t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den
        val s = ((a.x - p.x) * u.uy - (a.y - p.y) * u.ux) / den
        if (t > 1e-9 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t
    }
    return best
}

private fun heuresAvecEchantillons(point: Point, samples: List<SunSample>, obstacles: List<ShadowObstacle>): Double {
    var n = 0
    for (u in samples) {
        var masque = false
        for (ob in obstacles) {
            val h = ob.height
            if (h <= 0 || h.isNaN()) continue
            val t = distanceObstacle(point, u, ob)
            if (t != Double.POSITIVE_INFINITY && t * u.tanEl <= h) { masque = true; break }
        }
        if (!masque) n++
    }
    return (n * PAS_MIN).toDouble() / 60
}

/** Heures de soleil direct reçues par un point sur la journée de `dateMillis`, à l'ombre des obstacles. */
fun sunHoursOnPoint(
    point: Point, lat: Double, lon: Double, northAngle: Double = 0.0,
    obstacles: List<ShadowObstacle> = emptyList(), dateMillis: Long = System.currentTimeMillis(),
): Double = heuresAvecEchantillons(point, echantillonsSoleil(lat, lon, northAngle, dateMillis), obstacles)

/** Obstacle dessiné → obstacle d'ombre (hauteur absente = sans ombre, comme dans le JS). */
fun Obstacle.toShadowObstacle(): ShadowObstacle =
    ShadowObstacle(id, kind, height ?: 0.0, points = points, center = center, radius = radius, thickness = thickness)

/**
 * Obstacles d'ombre d'un jardin : obstacles dessinés, côtés de contour mur/clôture/haie, éléments hauts,
 * plantes existantes conservées et obstacles portés par les zones.
 */
fun shadowObstacles(garden: Garden?, plantLookup: PlantLookup? = null): List<ShadowObstacle> =
    (garden?.obstacles ?: emptyList()).map { it.toShadowObstacle() } + edgeObstacles(garden) + itemObstacles(garden) +
        existingShadowObstacles(garden) + zoneShadowObstacles(garden, plantLookup)

/** Obstacles d'ombre portés par les zones : paroi de piscine hors sol, terrasse surélevée, arbres et haies plantés. */
fun zoneShadowObstacles(garden: Garden?, plantLookup: PlantLookup? = null): List<ShadowObstacle> {
    val out = ArrayList<ShadowObstacle>()
    for (z in garden?.zones ?: emptyList()) {
        val shape = z.shape ?: continue
        val zh = zoneHeight(z)
        if (zh > 0) {
            val poly = shapePolygon(shape, 24)
            if (poly.size >= 3) out.add(ShadowObstacle("zone_${z.id}", if (z.type == "pool") "pool" else "terrace", zh, points = poly, zone = true))
        }
        if (plantLookup == null) continue
        for (pl in z.plantings) {
            val plant = effectivePlant(plantLookup(pl.plantId), pl)
            val ph = plant?.heightAdult ?: 0.0
            if (plant == null || plant.category !in listOf("tree", "fruit", "hedge") || !(ph >= 1.5)) continue
            val n = max(1, pl.count ?: pl.quantity ?: 1)
            val line = if (shape is LineShape && shape.points.size >= 2) shape.points else null
            val w = plant.widthAdult ?: 0.0
            if (line != null && plant.category == "hedge") {
                out.add(ShadowObstacle("zone_${z.id}_${pl.plantId}", "hedge", ph, zone = true, thickness = max(0.3, w * 0.8), points = line.map { Point(it.x, it.y) }))
            } else if (n == 1 && plant.category != "hedge") {
                val poly = shapePolygon(shape, 24)
                if (poly.size < 3) continue
                var cx = 0.0; var cy = 0.0
                for (p in poly) { cx += p.x / poly.size; cy += p.y / poly.size }
                out.add(ShadowObstacle("zone_${z.id}_${pl.plantId}", "tree", ph, zone = true, center = Point(cx, cy), radius = max(0.2, (if (w != 0.0) w else 2.0) / 2)))
            }
        }
    }
    return out
}

data class SunMapRegion(val level: String, val points: List<Point>)

/**
 * Carte d'ensoleillement estimée : régions rectangulaires (grille `step`) fusionnées par niveau.
 * Date par défaut : solstice d'été de l'année courante.
 */
fun estimateSunMap(garden: Garden, dateMillis: Long? = null, step: Double = 0.5, plantLookup: PlantLookup? = null): List<SunMapRegion> {
    val loc = garden.context.location
    val contour = garden.boundary
    if (loc == null || contour.size < 3) return emptyList()
    val d = dateMillis ?: defaultSolsticeMillis()
    val samples = echantillonsSoleil(loc.lat, loc.lon, garden.context.northAngle, d)
    val obstacles = shadowObstacles(garden, plantLookup)
    val b = bounds(contour)
    val nx = ceil(b.width / step).toInt()
    val ny = ceil(b.height / step).toInt()
    val grille = ArrayList<List<String?>>()
    for (j in 0 until ny) {
        val ligne = ArrayList<String?>()
        for (i in 0 until nx) {
            val p = Point(b.minX + (i + 0.5) * step, b.minY + (j + 0.5) * step)
            ligne.add(if (pointInPolygon(p, contour)) levelFromHours(heuresAvecEchantillons(p, samples, obstacles)) else null)
        }
        grille.add(ligne)
    }
    class R(val level: String, val i0: Int, val i1: Int, val j0: Int, var j1: Int)
    val regions = ArrayList<R>()
    var ouverts = LinkedHashMap<String, R>()
    for (j in 0..ny) {
        val courants = LinkedHashMap<String, R>()
        if (j < ny) {
            var i = 0
            while (i < nx) {
                val lv = grille[j][i]
                if (lv == null) { i++; continue }
                var k = i
                while (k + 1 < nx && grille[j][k + 1] == lv) k++
                val cle = "$lv|$i|$k"
                val r = ouverts[cle]
                if (r != null) { r.j1 = j + 1; courants[cle] = r; ouverts.remove(cle) }
                else courants[cle] = R(lv, i, k, j, j + 1)
                i = k + 1
            }
        }
        for (r in ouverts.values) regions.add(r)
        ouverts = courants
    }
    return regions.map { r ->
        val x0 = b.minX + r.i0 * step
        val x1 = b.minX + (r.i1 + 1) * step
        val y0 = b.minY + r.j0 * step
        val y1 = b.minY + r.j1 * step
        SunMapRegion(r.level, listOf(Point(x0, y0), Point(x1, y0), Point(x1, y1), Point(x0, y1)))
    }
}

data class SunShare(val full: Double = 0.0, val partial: Double = 0.0, val shade: Double = 0.0)
data class ZoneSun(val level: String?, val dominant: String?, val share: SunShare)

private val VIDE = ZoneSun(null, null, SunShare())

private fun dominantOf(share: SunShare): String {
    var dominant = "full"
    var dv = share.full
    if (share.partial > dv) { dominant = "partial"; dv = share.partial }
    if (share.shade > dv) { dominant = "shade" }
    return dominant
}

/**
 * Niveau d'ensoleillement d'une zone selon `garden.sun` (mode uniforme ou cartographié), assombri par l'ombre
 * des plantes existantes. `share` : part de la surface connue par niveau.
 */
fun zoneSunLevel(garden: Garden, zone: Zone, dateMillis: Long? = null): ZoneSun {
    val base = zoneSunLevelBase(garden, zone)
    if (base.level == null) return base
    val ex = existingShadowObstacles(garden)
    val loc = garden.context.location
    val poly = shapePolygon(zone.shape)
    if (ex.isEmpty() || loc == null || poly.size < 3) return base
    val samples = echantillonsSoleil(loc.lat, loc.lon, garden.context.northAngle, dateMillis ?: defaultSolsticeMillis())
    val b = bounds(poly)
    val pas = max(0.2, min(0.5, max(b.width, b.height) / 30))
    val rang = mapOf("full" to 2, "partial" to 1, "shade" to 0)
    val cpt = mutableMapOf("full" to 0, "partial" to 0, "shade" to 0)
    var total = 0
    var y = b.minY + pas / 2
    while (y < b.maxY) {
        var x = b.minX + pas / 2
        while (x < b.maxX) {
            val p = Point(x, y)
            if (pointInPolygon(p, poly)) {
                val lvEx = levelFromHours(heuresAvecEchantillons(p, samples, ex))
                val lvBase = pointBaseLevel(garden, p) ?: base.dominant!!
                val pick = if (rang.getValue(lvEx) < rang.getValue(lvBase)) lvEx else lvBase
                cpt[pick] = cpt.getValue(pick) + 1
                total++
            }
            x += pas
        }
        y += pas
    }
    if (total == 0) return base
    val share = SunShare(cpt.getValue("full").toDouble() / total, cpt.getValue("partial").toDouble() / total, cpt.getValue("shade").toDouble() / total)
    val dom = dominantOf(share)
    return ZoneSun(dom, dom, share)
}

/** Niveau déclaré en un point (uniforme ou région peinte), ou null. */
private fun pointBaseLevel(garden: Garden, p: Point): String? {
    val sun = garden.sun
    if (sun.mode == "uniform") return sun.uniform
    if (sun.mode != "map") return null
    for (i in sun.regions.indices.reversed()) {
        if (pointInPolygon(p, sun.regions[i].points)) return sun.regions[i].level
    }
    return null
}

private fun zoneSunLevelBase(garden: Garden, zone: Zone): ZoneSun {
    val sun = garden.sun
    if (sun.mode == "unknown") return VIDE
    if (sun.mode == "uniform") {
        val u = sun.uniform ?: return VIDE
        val share = when (u) { "full" -> SunShare(full = 1.0); "partial" -> SunShare(partial = 1.0); "shade" -> SunShare(shade = 1.0); else -> SunShare() }
        return ZoneSun(u, u, share)
    }
    if (sun.mode != "map" || sun.regions.isEmpty()) return VIDE
    val poly = shapePolygon(zone.shape)
    if (poly.size < 3) return VIDE
    val b = bounds(poly)
    val pas = max(0.1, min(0.25, max(b.width, b.height) / 60))
    val cpt = mutableMapOf("full" to 0, "partial" to 0, "shade" to 0)
    var total = 0
    var y = b.minY + pas / 2
    while (y < b.maxY) {
        var x = b.minX + pas / 2
        while (x < b.maxX) {
            val p = Point(x, y)
            if (pointInPolygon(p, poly)) {
                var lv: String? = null
                for (i in sun.regions.indices.reversed()) {
                    if (pointInPolygon(p, sun.regions[i].points)) { lv = sun.regions[i].level; break }
                }
                if (lv != null && cpt.containsKey(lv)) { cpt[lv] = cpt.getValue(lv) + 1; total++ }
            }
            x += pas
        }
        y += pas
    }
    if (total == 0) return VIDE
    val share = SunShare(cpt.getValue("full").toDouble() / total, cpt.getValue("partial").toDouble() / total, cpt.getValue("shade").toDouble() / total)
    val dom = dominantOf(share)
    return ZoneSun(dom, dom, share)
}
