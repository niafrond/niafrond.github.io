package fr.jardin.core

import java.math.BigDecimal
import java.math.RoundingMode
import kotlin.math.abs

// Budget indicatif des plantations (port de jardin/pricing.js) : prix moyens en jardinerie, à titre indicatif.

/** Résolution d'une essence du catalogue par id. */
typealias PlantById = (String) -> Plant?

/** Adapte une table `id → essence` en résolveur. */
fun Map<String, Plant>.asLookup(): PlantById = { id -> this[id] }

/** `Number.EPSILON` du JS. */
internal const val JS_EPSILON = 2.220446049250313e-16

/** Arrondi au centime à la JS : `Math.round((n + EPSILON) * 100) / 100`. */
internal fun round2(n: Double): Double = jsRound((n + JS_EPSILON) * 100) / 100

/** Représentation texte d'un nombre comme `String(n)` du JS (sans notation scientifique, sans zéros inutiles). */
internal fun jsNum(v: Double): String {
    if (v.isNaN()) return "NaN"
    if (v.isInfinite()) return if (v > 0) "Infinity" else "-Infinity"
    if (v == 0.0) return "0"
    return BigDecimal(java.lang.Double.toString(v)).stripTrailingZeros().toPlainString()
}

private val MONTHS = listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")

private fun group(intStr: String): String {
    val sb = StringBuilder()
    for ((i, c) in intStr.withIndex()) {
        if (i > 0 && (intStr.length - i) % 3 == 0) sb.append(' ')
        sb.append(c)
    }
    return sb.toString()
}

object Pricing {
    /** « 12,50 € » (arrondi au centime) ; `digits` : 0 pour « 340 € ». */
    fun formatEuro(n: Double, digits: Int = 2): String {
        var v = if (n.isFinite()) n else 0.0
        val k = Math.pow(10.0, digits.toDouble())
        v = jsRound((abs(v) + JS_EPSILON) * k) / k * (if (v < 0) -1 else 1)
        val neg = v < 0
        val s = BigDecimal(abs(v)).setScale(digits, RoundingMode.HALF_UP).toPlainString()
        val parts = s.split('.')
        val d = parts.getOrNull(1)
        return "${if (neg) "−" else ""}${group(parts[0])}${if (d != null) ",$d" else ""} €"
    }

    /** Prix unitaire sans zéros inutiles : 12 → « 12 € », 0,5 → « 0,5 € », 6,75 → « 6,75 € ». */
    fun formatPrice(n: Double): String {
        val v = round2(if (n.isFinite()) n else 0.0)
        return "${jsNum(v).replace('.', ',')} €"
    }

    val UNIT_LABEL = mapOf("plant" to "plant", "bulb" to "bulbe", "m2" to "m²")

    private fun hasPrice(p: Plant?): Boolean = p != null && p.priceEur != null && p.priceEur.isFinite() && p.priceEur >= 0

    /** Coût d'une plantation. */
    data class PlantCost(val qty: Double, val unit: String, val unitPrice: Double, val total: Double)

    /** Coût d'une plantation, ou null si la plante n'a pas de prix. */
    fun plantCost(plant: Plant?, planting: Planting?, zone: Zone?): PlantCost? {
        if (plant == null || !hasPrice(plant)) return null
        val unit = if (plant.priceUnit == "bulb" || plant.priceUnit == "m2") plant.priceUnit else "plant"
        val qty: Double
        if (unit == "m2") {
            val a = try { if (zone?.shape != null) shapeArea(zone.shape) else 0.0 } catch (_: Exception) { 0.0 }
            qty = round2(a)
        } else {
            val c = planting?.count ?: planting?.quantity
            qty = if (c != null && c > 0) c.toDouble() else 1.0
        }
        val price = plant.priceEur!!
        return PlantCost(qty, unit, price, round2(qty * price))
    }

    data class CostLine(val plantId: String, val plant: Plant?, val qty: Double, val unit: String, val unitPrice: Double, val total: Double)
    data class ZoneCost(val zoneId: String?, val label: String, val total: Double, val lines: List<CostLine>, val unknownCount: Int)
    data class GardenCost(val total: Double, val byZone: List<ZoneCost>, val unknownCount: Int)

    fun zoneCost(zone: Zone?, plantsById: PlantById = { null }): ZoneCost {
        val lines = mutableListOf<CostLine>()
        var total = 0.0
        var unknown = 0
        for (pl in zone?.plantings ?: emptyList()) {
            val plant = plantsById(pl.plantId)
            val c = plantCost(plant, pl, zone)
            if (c == null) { unknown++; continue }
            lines.add(CostLine(pl.plantId, plant, c.qty, c.unit, c.unitPrice, c.total))
            total += c.total
        }
        return ZoneCost(zone?.id, zone?.label ?: "", round2(total), lines, unknown)
    }

    fun gardenCost(garden: Garden?, plantsById: PlantById = { null }): GardenCost {
        val byZone = (garden?.zones ?: emptyList()).map { zoneCost(it, plantsById) }
        return GardenCost(round2(byZone.sumOf { it.total }), byZone, byZone.sumOf { it.unknownCount })
    }

    /** Plage de floraison « de mars à octobre » à partir de tous les mois. */
    fun bloomRangeText(months: Collection<Int>): String {
        val ms = months.toSet().filter { it in 1..12 }.sorted()
        if (ms.isEmpty()) return ""
        return if (ms.size == 1) "floraison en ${MONTHS[ms[0] - 1]}" else "floraison de ${MONTHS[ms[0] - 1]} à ${MONTHS[ms.last() - 1]}"
    }

    data class GardenSummary(val species: Int, val total: Double, val unknownCount: Int, val text: String)

    /** Résumé d'un jardin : « 8 essences, floraison de mars à octobre, ≈ 210 € ». */
    fun summarizeGarden(garden: Garden?, plantsById: PlantById = { null }): GardenSummary {
        val ids = linkedSetOf<String>()
        val months = mutableListOf<Int>()
        for (z in garden?.zones ?: emptyList()) {
            for (pl in z.plantings) {
                ids.add(pl.plantId)
                plantsById(pl.plantId)?.let { months.addAll(it.bloom) }
            }
        }
        val cost = gardenCost(garden, plantsById)
        val parts = mutableListOf("${ids.size} essence${if (ids.size > 1) "s" else ""}")
        val bl = bloomRangeText(months)
        if (bl.isNotEmpty()) parts.add(bl)
        parts.add("≈ ${formatEuro(cost.total, 0)}")
        return GardenSummary(ids.size, cost.total, cost.unknownCount, parts.joinToString(", "))
    }
}
