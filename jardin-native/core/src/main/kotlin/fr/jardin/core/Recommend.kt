package fr.jardin.core

import fr.jardin.core.Ambiances.detectAmbiance
import fr.jardin.core.Ambiances.getAmbiance
import fr.jardin.core.Ambiances.isTypical
import fr.jardin.core.Ambiances.plantAmbianceScore
import fr.jardin.core.Ambiances.plantAvoids
import fr.jardin.core.Maintenance.fitsMaintenance
import fr.jardin.core.Maintenance.getMaintenanceLevel
import fr.jardin.core.Maintenance.levelForZone
import fr.jardin.core.Maintenance.plantEffort
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import java.text.Collator
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Recommandation d'essences (port de jardin/recommend.js) : score, quantité, cohérence, « Surprends-moi ».
// Les PRNG (hashSeed FNV-1a, mulberry32) sont ceux du JS, bit à bit.

/**
 * Argument « optionnel au sens JS » : `null` = `undefined` (absent, on applique la valeur par défaut) ;
 * `Maybe(null)` = `null` explicite (désactive), `Maybe(x)` = valeur fournie.
 */
class Maybe<out T>(val value: T?)

/** Raison d'un score : `ok` vrai / faux / null (neutre). */
data class Reason(val ok: Boolean?, val criterion: String, val text: String)

/** Contexte de scoring d'une essence (équivalent du `ctx` JS ; absent = null). */
data class ScoreContext(
    val tminC: Double? = null,
    val zoneType: String? = null,
    val sunLevel: String? = null,
    val areaM2: Double? = null,
    val minDimension: Double? = null,
    val soil: String? = null,
    val windy: Boolean? = null,
    val ambiance: String? = null,
    val maintenance: String? = null,
    val pondArea: Double? = null,
    val pondDepth: Int? = null,
)

/** Résultat de `scorePlant` ; `rank` = score non plafonné (départage les essences à 100). */
data class ScoreResult(
    val score: Int,
    val status: String,
    val reasons: List<Reason>,
    val excluded: Boolean,
    val forbidden: Boolean = false,
    val rank: Int? = null,
)

/** Une recommandation : essence + son score. */
data class Recommendation(val plant: Plant, val result: ScoreResult) {
    val score: Int get() = result.score
    val status: String get() = result.status
    val reasons: List<Reason> get() = result.reasons
    val excluded: Boolean get() = result.excluded
    val forbidden: Boolean get() = result.forbidden
    val rank: Int? get() = result.rank
}

/** Avertissement de cohérence (`plantId`/`kind` seulement pour les avertissements d'espacement). */
data class Coherence(val level: String, val zoneId: String, val plantId: String?, val kind: String?, val text: String)

/** Zone du jardin + sélection proposée. */
data class ZoneSelection(val zoneId: String, val selection: List<Planting>)

/** Options de `recommendForZone`. */
data class RecommendOptions(
    val includeDiscouraged: Boolean = false,
    val includeForbidden: Boolean = false,
    val filters: PlantFilters? = null,
    val plants: List<Plant>? = null,
    val ambiance: Maybe<String>? = null,
    val maintenance: Maybe<String>? = null,
)

/** Options de `suggestSelection`. `seed` : nombre ou chaîne. */
data class SelectionOptions(
    val seed: Any? = 1,
    val plants: List<Plant>? = null,
    val max: Int? = null,
    val budget: Double? = null,
    val ambiance: Maybe<String>? = null,
    val maintenance: Maybe<String>? = null,
)

/** Hypoténuse de V8 (`Math.hypot` : mise à l'échelle + sommation de Kahan), distincte de celle de la JVM au dernier bit. */
internal fun jsHypot(x: Double, y: Double): Double {
    if (x.isNaN() || y.isNaN()) return if (x.isInfinite() || y.isInfinite()) Double.POSITIVE_INFINITY else Double.NaN
    val ax = abs(x); val ay = abs(y)
    val mx = if (ax > ay) ax else ay
    if (mx == Double.POSITIVE_INFINITY) return mx
    if (mx == 0.0) return 0.0
    var sum = 0.0; var comp = 0.0
    for (v in doubleArrayOf(ax, ay)) {
        val n = v / mx
        val summand = n * n - comp
        val prelim = sum + summand
        comp = (prelim - sum) - summand
        sum = prelim
    }
    return Math.sqrt(sum) * mx
}

/** `x >>> 0` du JS pour un double (ToUint32) rendu en Int (mêmes 32 bits). */
internal fun toUint32(d: Double): Int {
    if (d.isNaN() || d.isInfinite()) return 0
    val t = if (d < 0) -floor(-d) else floor(d)
    val m = t % 4294967296.0
    val u = if (m < 0) m + 4294967296.0 else m
    return u.toLong().toInt()
}

/** Valeur numérique d'une graine JS rendue en chaîne (`String(seed)`). */
internal fun seedToString(seed: Any?): String = when (seed) {
    null -> "1"
    is Double -> jsNumStr(seed)
    is Float -> jsNumStr(seed.toDouble())
    else -> seed.toString()
}

/** `localeCompare(…, 'fr')`. */
private val FR_COLLATOR: Collator = Collator.getInstance(Locale.FRENCH)
internal fun frCompare(a: String, b: String): Int = FR_COLLATOR.compare(a, b)

object Recommend {
    private val SUN_ORDER = mapOf("shade" to 0, "partial" to 1, "full" to 2)
    private val SUN_LABEL = mapOf("full" to "plein soleil", "partial" to "mi-ombre", "shade" to "ombre")
    private val SOIL_LABEL = mapOf("clay" to "argileux", "limestone" to "calcaire", "sandy" to "sableux", "loam" to "limoneux", "humus" to "humifère")
    private val ZONE_LABEL = mapOf(
        "pond" to "une mare", "pool" to "une piscine", "terrace" to "une terrasse", "path" to "une allée", "lawn" to "une pelouse",
        "lowplants" to "des plantes basses", "midplants" to "un massif", "tallplants" to "des plantes hautes", "hedge" to "une haie",
        "trees" to "des arbres", "vegetable" to "un potager", "orchard" to "un verger", "other" to "cette zone",
    )

    private fun r1(n: Double) = jsRound(n * 10) / 10
    private fun fmtC(t: Double) = "${jsNumStr(r1(t)).replace('.', ',').replaceFirst('-', '−')} °C"
    private fun fmtM(n: Double) = "${jsNumStr(r1(n)).replace('.', ',')} m"
    private fun plantName(p: Plant) = p.commonName.ifEmpty { p.id }

    /** Petit arbuste (≤ 4 m) : accepté aussi dans une zone d'arbres, en sous-étage. */
    fun isSmallShrub(plant: PlantLike?): Boolean = plant != null && plant.category == "shrub" && (plant.heightAdult ?: 0.0).let { if (it.isNaN()) 0.0 else it } <= 4

    /**
     * Score de compatibilité d'une essence dans un contexte. `excluded` = exclusion dure (rusticité insuffisante).
     */
    fun scorePlant(plant: Plant, ctx: ScoreContext = ScoreContext()): ScoreResult {
        var score = 100
        var forceDiscouraged = false
        var excluded = false
        val reasons = ArrayList<Reason>()
        fun add(ok: Boolean?, criterion: String, text: String) { reasons.add(Reason(ok, criterion, text)) }

        // Rusticité : exclusion dure.
        if (ctx.tminC != null) {
            val margin = ctx.tminC - plant.hardiness
            if (margin < 0) {
                excluded = true
                score = 0
                add(false, "rusticité", "Ne résiste pas au gel : tolère ${fmtC(plant.hardiness)} seulement (votre secteur : ${fmtC(ctx.tminC)})")
            } else if (margin < 3) {
                score -= 10
                add(null, "rusticité", "Résiste au gel jusqu'à ${fmtC(plant.hardiness)}, juste suffisant (votre secteur : ${fmtC(ctx.tminC)}) : prévoir une protection hivernale")
            } else {
                add(true, "rusticité", "Résiste au gel jusqu'à ${fmtC(plant.hardiness)} (votre secteur : ${fmtC(ctx.tminC)})")
            }
        } else {
            add(null, "rusticité", "Climat du secteur non renseigné : rusticité non vérifiée")
        }

        // Type de zone.
        if (!ctx.zoneType.isNullOrEmpty()) {
            if (ctx.zoneType in plant.zones) {
                add(true, "zone", "Convient pour ${ZONE_LABEL[ctx.zoneType] ?: "ce type de zone"}")
            } else if (ctx.zoneType == "trees" && isSmallShrub(plant)) {
                add(true, "zone", "Petit arbuste : s’associe bien aux arbres (sous-étage)")
            } else {
                score -= 35
                forceDiscouraged = true
                add(false, "zone", "Peu adaptée à ${ZONE_LABEL[ctx.zoneType] ?: "ce type de zone"}")
            }
        }

        // Mare : taille et profondeur de la mare (essences aquatiques et de berge étiquetées).
        var forbidden = false
        if (ctx.zoneType == "pond" && ctx.pondArea != null && pondConcerned(plant)) {
            val area = ctx.pondArea
            val depth = ctx.pondDepth ?: 60
            val fit = pondFitFor(plant, area, depth)
            val areaTxt = "${jsNumStr(r1(area)).replace('.', ',')} m²"
            if (fit.level == "ok") {
                add(true, "mare", "Adaptée à une mare de $areaTxt (profondeur $depth cm)")
            } else {
                forceDiscouraged = true
                score -= if (fit.level == "forbid") 80 else 40
                if (fit.level == "forbid") forbidden = true
                add(false, "mare", "Ne convient pas à une mare de $areaTxt : ${fit.reasons.joinToString(" ; ")}")
            }
        }

        // Soleil.
        if (ctx.sunLevel.isNullOrEmpty()) {
            add(null, "soleil", "Ensoleillement non renseigné")
        } else {
            val sun = plant.sun
            val here = SUN_ORDER[ctx.sunLevel] ?: 0
            if (ctx.sunLevel in sun) {
                add(true, "soleil", "Apprécie ${SUN_LABEL[ctx.sunLevel]}, comme dans cette zone")
            } else {
                val dist = min(sun.minOfOrNull { abs((SUN_ORDER[it] ?: 0) - here) } ?: 2, 2)
                score -= if (dist >= 2) 45 else 20
                val wants = sun.joinToString(" ou ") { SUN_LABEL[it] ?: "" }.ifEmpty { "un autre ensoleillement" }
                add(false, "soleil", "Préfère $wants (cette zone : ${SUN_LABEL[ctx.sunLevel]})")
            }
        }

        // Sol.
        if (!ctx.soil.isNullOrEmpty()) {
            val soils = plant.soil
            if (soils.isEmpty() || ctx.soil in soils) {
                add(true, "sol", "Supporte un sol ${SOIL_LABEL[ctx.soil] ?: ctx.soil}")
            } else {
                score -= 15
                add(false, "sol", "Sol ${SOIL_LABEL[ctx.soil] ?: ctx.soil} peu adapté (préfère : ${soils.joinToString(", ") { SOIL_LABEL[it] ?: it }})")
            }
        }

        // Vent.
        if (ctx.windy == true) {
            if (plant.windTolerant) {
                add(true, "vent", "Tolère les emplacements ventés")
            } else {
                score -= 10
                add(false, "vent", "Sensible au vent, emplacement exposé")
            }
        }

        // Place disponible.
        val width = plant.widthAdult
        if (width > 0) {
            val footprint = PI * (width / 2) * (width / 2)
            val minDim = ctx.minDimension
            val area = ctx.areaM2
            if (minDim != null && minDim > 0 && width > minDim + 1e-6) {
                score -= 25
                add(false, "place", "Trop large à l'âge adulte (${fmtM(width)}) pour une zone large de ${fmtM(minDim)}")
            } else if (area != null && area > 0 && footprint > area + 1e-6) {
                score -= 30
                add(false, "place", "Surface insuffisante : emprise adulte ≈ ${jsNumStr(jsRound(footprint * 10) / 10)} m² pour ${jsNumStr(jsRound(area * 10) / 10)} m²")
            } else if ((area != null && area != 0.0 && !area.isNaN()) || (minDim != null && minDim != 0.0 && !minDim.isNaN())) {
                add(true, "place", "Assez de place pour son développement (largeur adulte ${fmtM(width)})")
            }
        }

        // Ambiance souhaitée (facultative).
        var rank: Int? = null
        val amb = if (!ctx.ambiance.isNullOrEmpty()) getAmbiance(ctx.ambiance) else null
        if (amb != null && !excluded) {
            val s = plantAmbianceScore(plant, amb.id)
            val name = amb.label.lowercase()
            if (amb.id in plantAvoids(plant)) {
                score -= 20
                add(false, "ambiance", "Peu adaptée à l'ambiance « $name »")
            } else if (s >= 0.7) {
                score += jsRound(15 * (s - 0.5) / 0.5).toInt()
                add(true, "ambiance", "Convient à l'ambiance « $name »")
            } else {
                if (s < 0.5) score -= jsRound((0.5 - s) * 20).toInt()
                add(if (s < 0.5) false else null, "ambiance", if (s < 0.5) "Ne correspond pas vraiment à l'ambiance « $name »" else "Compatible avec l'ambiance « $name »")
            }
            rank = score
        }

        // Niveau d'entretien souhaité (facultatif : « green » ou absent = aucune restriction).
        if ((ctx.maintenance == "low" || ctx.maintenance == "none") && !excluded) {
            val fit = fitsMaintenance(plant, ctx.maintenance)
            score += fit.bonus - fit.penalty
            if (fit.discouraged) forceDiscouraged = true
            add(fit.ok, "entretien", fit.text)
            rank = score
        }

        score = max(0, min(100, score))
        var status = if (score >= 75) "ideal" else if (score >= 50) "possible" else "discouraged"
        if (excluded || forceDiscouraged) status = "discouraged"
        return ScoreResult(score, status, reasons, excluded, forbidden, rank)
    }

    private fun polyLength(points: List<Point>): Double {
        var l = 0.0
        for (i in 1 until points.size) l += jsHypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
        return l
    }

    private fun minDimensionOf(shape: Shape?): Double? = when (shape) {
        null -> null
        is CircleShape -> shape.radius * 2
        is LineShape -> shape.width
        is PolygonShape -> { val b = bounds(shapePolygon(shape)); min(b.width, b.height) }
    }

    /** `wind` du jardin → ventée (true), non ventée (false) ou inconnu (null). */
    internal fun windyOf(w: JsonElement?): Boolean? {
        if (w == null || w is JsonNull) return null
        if (w is JsonPrimitive) {
            if (!w.isString && w.booleanOrNull == false) return false
            if (w.isString && (w.content == "none" || w.content == "low")) return false
        }
        return true
    }

    /** Contexte de scoring d'une zone dans un jardin. */
    fun contextForZone(garden: Garden?, zone: Zone, ambiance: Maybe<String>? = null, maintenance: Maybe<String>? = null): ScoreContext {
        val c = garden?.context
        val clim = Climate.climateForDepartement(c?.departement)
        val tminC = if (clim != null) Climate.adjustTminForAltitude(clim.tminC, c?.altitude) else null
        var sunLevel: String? = null
        try { if (garden != null) sunLevel = zoneSunLevel(garden, zone).level } catch (_: Exception) { sunLevel = null }
        return ScoreContext(
            tminC = tminC,
            zoneType = zone.type,
            sunLevel = sunLevel,
            areaM2 = shapeArea(zone.shape),
            minDimension = minDimensionOf(zone.shape),
            soil = c?.soil?.takeIf { it.isNotEmpty() },
            windy = windyOf(c?.wind),
            ambiance = if (ambiance != null) ambiance.value else resolveAmbiance(zone),
            maintenance = if (maintenance != null) maintenance.value else levelForZone(garden, zone),
            pondArea = if (zone.type == "pond") pondArea(zone) else null,
            pondDepth = if (zone.type == "pond") pondDepth(zone) else null,
        )
    }

    /** Ambiance d'une zone : explicite (`zone.ambiance`), sinon détectée dans son nom, sinon null. */
    fun resolveAmbiance(zone: Zone?): String? {
        if (!zone?.ambiance.isNullOrEmpty()) return if (getAmbiance(zone!!.ambiance) != null) zone.ambiance else null
        return detectAmbiance(zone?.label)
    }

    /** Essences conseillées pour une zone, triées par score (les exclusions dures sont toujours retirées). */
    fun recommendForZone(garden: Garden?, zone: Zone, opts: RecommendOptions = RecommendOptions()): List<Recommendation> {
        val ctx = contextForZone(garden, zone, opts.ambiance, opts.maintenance)
        val list = filterPlants(opts.plants ?: allPlants(), opts.filters ?: PlantFilters())
        return list
            .map { Recommendation(it, scorePlant(it, ctx)) }
            .filter { !it.excluded && (opts.includeForbidden || !it.forbidden) && (opts.includeDiscouraged || it.status != "discouraged") }
            .sortedWith { a, b ->
                val d = (b.rank ?: b.score) - (a.rank ?: a.score)
                if (d != 0) d else frCompare(plantName(a.plant), plantName(b.plant))
            }
    }

    /**
     * Quantité suggérée pour une zone (proposition manuelle d'une essence seule) : surface / espacement², bornée par la
     * capacité réelle de la zone ; arbre et gazon : 1 ; haie sur une ligne : un rang à l'espacement.
     */
    fun suggestQuantity(plant: Plant, zone: Zone): Int {
        val spacing = if (plant.spacing > 0) plant.spacing else if (plant.widthAdult > 0) plant.widthAdult else 1.0
        val shape = zone.shape ?: return 1
        if (zone.type == "pond" && pondConcerned(plant)) return pondPlantQuantity(plant, zone)
        if (shape is LineShape) {
            val l = polyLength(shape.points)
            return max(1, min(jsRound(l / spacing).toInt(), floor((l - 0.1) / spacing + 1e-9).toInt() + 1))
        }
        if (plant.category == "tree" || plant.category == "lawn") return 1
        val byArea = max(1, floor(shapeArea(shape) / (spacing * spacing) + 1e-9).toInt())
        var cap = byArea
        try { cap = packingCapacity(shapePolygon(shape, 48), plant) } catch (_: Exception) { /* */ }
        return max(1, min(byArea, if (cap == 0) 1 else cap))
    }

    // ---------- géométrie locale (distance entre formes) ----------
    private fun segDist(p: Point, a: Point, b: Point): Double {
        val dx = b.x - a.x; val dy = b.y - a.y
        val l2 = dx * dx + dy * dy
        var t = if (l2 != 0.0) ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 else 0.0
        t = max(0.0, min(1.0, t))
        return jsHypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
    }

    private fun inside(p: Point, poly: List<Point>): Boolean {
        var c = false
        var j = poly.size - 1
        for (i in poly.indices) {
            val a = poly[i]; val b = poly[j]
            if ((a.y > p.y) != (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c
            j = i
        }
        return c
    }

    /** Distance minimale entre deux polygones (0 si contact ou inclusion). */
    private fun polygonsDistance(a: List<Point>, b: List<Point>): Double {
        if (a.isEmpty() || b.isEmpty()) return Double.POSITIVE_INFINITY
        if (inside(a[0], b) || inside(b[0], a)) return 0.0
        var best = Double.POSITIVE_INFINITY
        for (i in a.indices) { val a1 = a[i]; val a2 = a[(i + 1) % a.size]; for (p in b) best = min(best, segDist(p, a1, a2)) }
        for (i in b.indices) { val b1 = b[i]; val b2 = b[(i + 1) % b.size]; for (p in a) best = min(best, segDist(p, b1, b2)) }
        return best
    }

    private class WallLine(val name: String, val height: Double, val a: Point, val b: Point)

    /** Essence effective d'une plantation (hauteur/largeur réglées) en `Plant`. */
    private fun effPlant(plant: Plant?, pl: Planting?): Plant? {
        if (plant == null || pl == null) return plant
        val hh = pl.height != null && pl.height.isFinite() && pl.height > 0
        val ww = pl.width != null && pl.width.isFinite() && pl.width > 0
        if (!hh && !ww) return plant
        return plant.copy(heightAdult = if (hh) pl.height!! else plant.heightAdult, widthAdult = if (ww) pl.width!! else plant.widthAdult)
    }

    /** Haies, clôtures et murs hauts (> 2 m) situés au sud (± 60°) et à moins de 6 m d'une zone de plein soleil. */
    private fun tallWallsSouth(garden: Garden, zone: Zone, lookup: (String) -> Plant?): List<WallLine> {
        var level: String? = null
        try { level = zoneSunLevel(garden, zone).level } catch (_: Exception) { level = null }
        if (level != "full") return emptyList()
        val poly = shapePolygon(zone.shape)
        if (poly.size < 3) return emptyList()
        var cx = 0.0; var cy = 0.0
        for (p in poly) { cx += p.x / poly.size; cy += p.y / poly.size }
        val th = garden.context.northAngle * PI / 180
        val south = Point(-StrictMath.sin(th), StrictMath.cos(th))
        val kind = mapOf("wall" to "Mur", "fence" to "Clôture", "hedge" to "Haie")
        val lines = ArrayList<WallLine>()
        for (e in edgeObstacles(garden)) lines.add(WallLine(kind[e.kind] ?: "Mur", e.height, e.points!![0], e.points[1]))
        for (o in garden.obstacles) {
            val pts = o.points
            if ((o.kind == "wall" || o.kind == "fence") && pts != null && pts.size >= 2) {
                for (i in 0 until pts.size - 1) {
                    val h = o.height?.takeIf { it != 0.0 && !it.isNaN() } ?: (if (o.kind == "wall") 2.0 else 1.2)
                    lines.add(WallLine(kind[o.kind]!!, h, pts[i], pts[i + 1]))
                }
            }
        }
        for (e in existingShadowObstacles(garden)) {
            val pts = e.points
            if (pts != null && pts.size >= 2) for (i in 0 until pts.size - 1) lines.add(WallLine(kind[e.kind] ?: "Haie", e.height, pts[i], pts[i + 1]))
        }
        for (z in garden.zones) {
            val sh = z.shape
            if (z === zone || sh !is LineShape || sh.points.size < 2) continue
            for (pl in z.plantings) {
                val pt = effPlant(lookup(pl.plantId), pl)
                if (pt != null && (pt.category == "hedge" || pt.category == "shrub") && pt.heightAdult > 2) {
                    for (i in 0 until sh.points.size - 1) lines.add(WallLine("Haie", pt.heightAdult, sh.points[i], sh.points[i + 1]))
                }
            }
        }
        var best: WallLine? = null
        for (l in lines) {
            if (!(l.height > 2)) continue
            val mx = (l.a.x + l.b.x) / 2; val my = (l.a.y + l.b.y) / 2
            val vx = mx - cx; val vy = my - cy
            val vl = jsHypot(vx, vy).let { if (it == 0.0) 1.0 else it }
            if ((vx * south.x + vy * south.y) / vl < 0.5) continue
            if (polygonsDistance(poly, listOf(l.a, l.b)) > 6) continue
            if (best == null || l.height > best.height) best = l
        }
        return if (best != null) listOf(best) else emptyList()
    }

    /** Contrôle de cohérence du jardin : surdensité, arbres hauts près d'une terrasse/piscine, eau, invasives, toxiques. */
    fun checkCoherence(garden: Garden?, plants: List<Plant>? = null): List<Coherence> {
        val out = ArrayList<Coherence>()
        val lookup: (String) -> Plant? = { id -> if (plants != null) plants.firstOrNull { it.id == id } else getPlant(id) }
        val zones = garden?.zones ?: emptyList()
        val sensitive = zones.filter { it.type == "terrace" || it.type == "pool" }

        for (zone in zones) {
            val items = zone.plantings.mapNotNull { pl -> effPlant(lookup(pl.plantId), pl) }
            if (items.isEmpty()) continue
            val name = zone.label.ifEmpty { zone.type }
            val area = shapeArea(zone.shape)

            // Espacements (voir spacing).
            if (area > 0) {
                var sp: List<SpacingWarning> = emptyList()
                try { sp = checkSpacing(garden, zone) { id -> lookup(id) } } catch (_: Exception) { sp = emptyList() }
                for (w in sp) {
                    out.add(Coherence(if (w.level == "info") "info" else "warn", zone.id, w.plantId, w.kind,
                        "Zone « $name » : ${if (w.kind == "surdensite") "surdensité, " else ""}${w.text}"))
                }
            }

            // Arbre haut près d'une terrasse / piscine.
            val tall = items.filter { it.heightAdult >= 4 }
            if (tall.isNotEmpty() && zone.shape != null) {
                val poly = shapePolygon(zone.shape)
                for (s in sensitive) {
                    if (s.id == zone.id) continue
                    val d = polygonsDistance(poly, shapePolygon(s.shape))
                    if (d < 3) {
                        val what = if (s.type == "pool") "la piscine" else "la terrasse"
                        out.add(Coherence("warn", zone.id, null, null, "${plantName(tall[0])} (${fmtM(tall[0].heightAdult)} adulte) est à moins de 3 m de $what (${fmtM(d)}) : racines, ombre et feuilles à prévoir"))
                    }
                }
            }

            // Haie / clôture / mur haut (> 2 m) au sud d'une zone de plein soleil.
            if (zone.shape != null && zone.type != "pool" && zone.type != "path" && garden != null) {
                for (w in tallWallsSouth(garden, zone, lookup)) {
                    out.add(Coherence("warn", zone.id, null, null, "${w.name} de ${fmtM(w.height)} au sud de la zone « $name » (plein soleil) : son ombre portée réduira l'ensoleillement"))
                }
            }

            // Besoins en eau mélangés.
            val levels = items.map { it.water }.filter { it.isNotEmpty() }.toSet()
            if ("low" in levels && "high" in levels) {
                out.add(Coherence("warn", zone.id, null, null, "Zone « $name » : besoins en eau très différents (faible et élevé) dans la même zone, arrosage difficile à adapter"))
            }

            // Zone prévue sans entretien : essences qui en demandent.
            if (levelForZone(garden, zone) == "none") {
                for (plant in items) {
                    if (plantEffort(plant) >= 2) {
                        out.add(Coherence("warn", zone.id, null, null, "Zone « $name » : ${plantName(plant)} demande un entretien régulier alors que cette zone est prévue sans entretien"))
                    }
                }
            }

            // Mare redimensionnée : essences devenues inadaptées.
            if (zone.type == "pond") {
                for (plant in items) {
                    if (plant.invasive) continue
                    val fit = pondFit(plant, zone)
                    if (!fit.ok) out.add(Coherence("warn", zone.id, null, null, "Mare « $name » : ${plantName(plant)} ne convient plus (${fit.reasons.joinToString(" ; ")})"))
                }
            }

            // Invasives.
            for (plant in items) {
                if (plant.invasive) {
                    out.add(Coherence("warn", zone.id, null, null, "${plantName(plant)} est une essence invasive : à éviter, elle peut envahir le jardin et les milieux naturels"))
                }
            }

            // Toxiques en potager / terrasse.
            if (zone.type == "vegetable" || zone.type == "terrace") {
                for (plant in items) {
                    if (plant.toxic) {
                        out.add(Coherence("warn", zone.id, null, null, "${plantName(plant)} est toxique : déconseillée ${if (zone.type == "vegetable") "au potager" else "près d'une terrasse"} (enfants, animaux)"))
                    }
                }
            }
        }
        return out
    }

    // ---------- « Surprends-moi » ----------

    /** FNV-1a 32 bits des points de code (premier code UTF-16 de chacun), ou `seed >>> 0` pour un nombre. */
    internal fun hashSeed(seed: Any?): Int {
        if (seed is Number) return toUint32(seed.toDouble())
        var h = -2128831035
        val s = seedToString(seed ?: 1)
        var i = 0
        while (i < s.length) {
            val cp = s.codePointAt(i)
            h = (h xor s[i].code) * 16777619
            i += Character.charCount(cp)
        }
        return h
    }

    private fun heightLayer(h: Double) = if (h < 0.5) 0 else if (h < 1.5) 1 else if (h < 4) 2 else 3

    /**
     * Quantités d'une sélection qui partagent la surface de la zone et respectent les espacements : les arbres
     * comptent pour leur couronne, les autres couches se répartissent le reste, puis un ajustement final par pose
     * réelle retire ce qui ne tient pas. Au moins une essence reste.
     */
    private fun spacedQuantities(garden: Garden?, zone: Zone, chosen: List<Plant>, plants: List<Plant>?): List<Planting> {
        val lookup: PlantLookup = { id -> (if (plants != null) plants.firstOrNull { it.id == id } else getPlant(id)) ?: chosen.firstOrNull { it.id == id } }
        val n = chosen.size
        val poly = shapePolygon(zone.shape, 48)
        val counts = IntArray(n)
        val general = ArrayList<Int>()
        chosen.forEachIndexed { i, plant ->
            if (zone.type == "pond" && pondConcerned(plant)) {
                val q = pondPlantQuantity(plant, zone)
                var cap = q
                try { cap = max(1, packingCapacity(poly, plant)) } catch (_: Exception) { /* */ }
                counts[i] = min(max(1, jsRound(q.toDouble() / n).toInt()), cap)
            } else general.add(i)
        }
        if (general.isNotEmpty()) {
            var al: List<Allocation>? = null
            try { al = allocateQuantities(zone, general.map { chosen[it] }) } catch (_: Exception) { al = null }
            general.forEachIndexed { k, i -> counts[i] = if (al != null) al[k].count else suggestQuantity(chosen[i], zone) }
        }
        var sel: List<Planting> = chosen.mapIndexed { i, p -> Planting(p.id, count = counts[i]) }.filter { it.count!! > 0 }
        if (sel.isEmpty()) sel = listOf(Planting(chosen[0].id, count = 1))
        try { sel = fitQuantities(zone, sel, lookup, PackOptions(garden = garden)) } catch (_: Exception) { /* conserve la répartition */ }
        if (sel.isEmpty()) sel = listOf(Planting(chosen[0].id, count = 1))
        return sel
    }

    /**
     * Sélection équilibrée déterministe : hauteurs étagées, floraison étalée. `budget` (€, facultatif) : privilégie les
     * essences peu coûteuses et réduit quantités/essences pour rester sous le budget si possible (au moins une essence reste).
     */
    fun suggestSelection(garden: Garden?, zone: Zone, opts: SelectionOptions = SelectionOptions()): List<Planting> {
        val rnd = Mulberry32(hashSeed(opts.seed))
        val strict = zone.type == "vegetable" || zone.type == "terrace"
        val amb: String? = if (opts.ambiance != null) (if (getAmbiance(opts.ambiance.value) != null) opts.ambiance.value else null) else resolveAmbiance(zone)
        val level: String = if (opts.maintenance != null) (if (getMaintenanceLevel(opts.maintenance.value) != null) opts.maintenance.value!! else "green") else levelForZone(garden, zone)
        val maxEffort = if (level == "none") 1 else if (level == "low") 2 else 3
        var cands = recommendForZone(garden, zone, RecommendOptions(plants = opts.plants, ambiance = Maybe(amb), maintenance = Maybe(level)))
            .filter { !it.plant.invasive && !(strict && it.plant.toxic) }
        if (cands.isEmpty()) return emptyList()
        val area = shapeArea(zone.shape)
        val target = min(cands.size, opts.max?.takeIf { it != 0 } ?: (if (area < 4) 2 else if (area < 15) 3 else if (area < 60) 4 else 5))
        val cap: Double? = opts.budget?.takeIf { it.isFinite() && it > 0 }
        fun estCost(plant: Plant): Double {
            if (cap == null) return 0.0
            val c = Pricing.plantCost(plant, Planting(plant.id, count = max(1, jsRound(suggestQuantity(plant, zone).toDouble() / target).toInt())), zone)
            return c?.total ?: 0.0
        }

        val chosen = ArrayList<Recommendation>()
        val layers = HashSet<Int>()
        val months = HashSet<Int>()
        val cats = HashSet<String>()
        val minTypical = if (amb != null) Math.ceil(0.7 * target - 1e-9).toInt() else 0
        var typicalCount = 0
        val minShrub = if (zone.type == "trees" && target >= 3) max(1, floor(target / 3.0).toInt()) else 0
        var shrubCount = 0
        while (chosen.size < target && cands.isNotEmpty()) {
            var best: Recommendation? = null
            var bestV = Double.NEGATIVE_INFINITY
            var pool = cands
            if (maxEffort < 3) {
                val easy = cands.filter { plantEffort(it.plant) <= maxEffort }
                if (easy.isNotEmpty()) pool = easy
            }
            if (amb != null && minTypical - typicalCount >= target - chosen.size) {
                val typ = pool.filter { isTypical(it.plant, amb) }
                if (typ.isNotEmpty()) pool = typ
            }
            if (minShrub - shrubCount > 0 && minShrub - shrubCount >= target - chosen.size) {
                val sh = pool.filter { isSmallShrub(it.plant) }
                val sh2 = if (sh.isNotEmpty()) sh else (if (maxEffort < 3) emptyList() else cands.filter { isSmallShrub(it.plant) })
                if (sh2.isNotEmpty()) pool = sh2
            }
            for (c in pool) {
                val bloom = c.plant.bloom
                val newMonths = bloom.count { it !in months }
                val v = c.score / 100.0 +
                    (if (heightLayer(c.plant.heightAdult) in layers) 0.0 else 0.5) +
                    newMonths / 12.0 +
                    (if (c.plant.category in cats) 0.0 else 0.15) -
                    (if (cap == null) 0.0 else min(1.0, estCost(c.plant) / cap) * 0.6) +
                    (if (amb != null) plantAmbianceScore(c.plant, amb) * 1.5 else 0.0) +
                    rnd.next() * 0.25
                if (v > bestV) { bestV = v; best = c }
            }
            val b = best!!
            chosen.add(b)
            if (amb != null && isTypical(b.plant, amb)) typicalCount++
            if (isSmallShrub(b.plant)) shrubCount++
            cands = cands.filter { it !== b }
            layers.add(heightLayer(b.plant.heightAdult))
            b.plant.bloom.forEach { months.add(it) }
            cats.add(b.plant.category)
        }
        val sel = spacedQuantities(garden, zone, chosen.map { it.plant }, opts.plants).toMutableList()
        if (cap == null) return sel
        // Respect du budget : on réduit d'abord les quantités de la ligne la plus chère, puis on retire des essences.
        val byId = chosen.associate { it.plant.id to it.plant }
        fun line(it: Planting): Double = Pricing.plantCost(byId[it.plantId], it, zone)?.total ?: 0.0
        fun sum(): Double = sel.sumOf { line(it) }
        var guard = 0
        while (guard < 5000 && sum() > cap + 1e-9) {
            val reducible = sel.withIndex().filter { (_, it) -> (it.count ?: 0) > 1 && line(it) > 0 && byId[it.plantId]!!.priceUnit != "m2" }
                .sortedByDescending { line(it.value) }
            if (reducible.isNotEmpty()) {
                val i = reducible[0].index
                sel[i] = sel[i].copy(count = sel[i].count!! - 1)
            } else if (sel.size > 1) {
                var k = 0
                sel.forEachIndexed { i, it -> if (line(it) > line(sel[k])) k = i }
                sel.removeAt(k)
            } else break
            guard++
        }
        return sel
    }

    private val NO_PLANT_ZONES = setOf("pool", "path")

    /**
     * « Surprends-moi » pour tout le jardin : une sélection par zone plantable, chacune avec son ambiance
     * (`ambiances[zone.id]`, sinon `zone.ambiance`, sinon détectée dans le nom ; `null` explicite = aucune).
     */
    fun suggestForGarden(
        garden: Garden?, seed: Any? = 1, budget: Double? = null, ambiances: Map<String, String?> = emptyMap(),
        plants: List<Plant>? = null, maintenance: Maybe<String>? = null,
    ): List<ZoneSelection> {
        val zones = (garden?.zones ?: emptyList()).filter { it.type !in NO_PLANT_ZONES }
        val cap = budget?.takeIf { it.isFinite() && it > 0 }
        return zones.mapIndexed { i, zone ->
            val ambiance = if (ambiances.containsKey(zone.id)) Maybe(ambiances[zone.id]) else null
            val selection = suggestSelection(garden, zone, SelectionOptions(
                seed = "${seedToString(seed)}:$i", plants = plants, ambiance = ambiance, maintenance = maintenance,
                budget = if (cap != null) cap / zones.size else null,
            ))
            ZoneSelection(zone.id, selection)
        }
    }
}
