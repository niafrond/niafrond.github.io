package fr.jardin.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

// Hauteurs réglables (port de jardin/heights.js) : valeurs par défaut, bornes plausibles, validation et
// formatage. Unité : mètres (les saisies se font en cm). Une hauteur absente = valeur par défaut du catalogue.

object DEFAULT_HEIGHTS {
    /** Paroi d'une piscine hors sol. */
    const val poolAbove = 1.2
    /** Terrasse au sol. */
    const val terrace = 0.0
    val edge: Map<String, Double> = mapOf("wall" to 2.0, "fence" to 1.2, "hedge" to 1.8)
    val obstacle: Map<String, Double> = mapOf("house" to 6.0, "shed" to 2.5, "wall" to 2.0, "fence" to 1.2, "tree" to 8.0)
    val item: Map<String, Double> = mapOf("bench" to 0.85, "table" to 0.76, "table_round" to 0.76, "chair" to 0.85, "lounge" to 0.8, "sunbed" to 0.5, "parasol" to 2.5, "hammock" to 1.6, "bbq" to 1.0, "firepit" to 0.35, "composter" to 0.9, "rain_tank" to 1.5, "planter" to 0.55, "raised_bed" to 0.45, "woodpile" to 1.0, "clothesline" to 1.8, "mailbox" to 1.3, "light" to 2.2, "fountain" to 1.0, "swing" to 2.2, "trampoline" to 0.9, "sandbox" to 0.3, "playhouse" to 1.8, "shed_item" to 2.3, "greenhouse" to 2.0, "pergola" to 2.4, "gazebo" to 2.5)
}

/** Bornes plausibles [min, max] (m) par catégorie d'élément ou de plante. */
val HEIGHT_LIMITS: Map<String, DoubleArray> = linkedMapOf(
    "tree" to doubleArrayOf(0.5, 40.0),
    "fruit" to doubleArrayOf(0.5, 15.0),
    "shrub" to doubleArrayOf(0.1, 8.0),
    "hedge" to doubleArrayOf(0.3, 8.0),
    "climber" to doubleArrayOf(0.2, 15.0),
    "perennial" to doubleArrayOf(0.05, 3.0),
    "grass" to doubleArrayOf(0.05, 4.0),
    "bulb" to doubleArrayOf(0.05, 2.0),
    "groundcover" to doubleArrayOf(0.02, 1.0),
    "vegetable" to doubleArrayOf(0.05, 3.0),
    "aquatic" to doubleArrayOf(0.02, 3.0),
    "lawn" to doubleArrayOf(0.02, 0.5),
    "pool" to doubleArrayOf(0.5, 2.0),
    "terrace" to doubleArrayOf(0.0, 1.5),
    "wall" to doubleArrayOf(0.3, 6.0),
    "fence" to doubleArrayOf(0.3, 3.0),
    "house" to doubleArrayOf(2.0, 15.0),
    "shed" to doubleArrayOf(1.5, 5.0),
    "pergola" to doubleArrayOf(1.8, 4.0),
    "gazebo" to doubleArrayOf(1.8, 4.0),
    "parasol" to doubleArrayOf(1.5, 4.0),
    "shed_item" to doubleArrayOf(1.5, 5.0),
    "greenhouse" to doubleArrayOf(1.2, 5.0),
    "playhouse" to doubleArrayOf(0.8, 3.5),
    "rain_tank" to doubleArrayOf(0.5, 3.0),
    "swing" to doubleArrayOf(1.5, 4.0),
    "trampoline" to doubleArrayOf(0.3, 2.0),
    "light" to doubleArrayOf(0.3, 6.0),
    "item" to doubleArrayOf(0.05, 5.0),
    "default" to doubleArrayOf(0.05, 40.0),
)

/** Bornes [min, max] d'une catégorie (tout type d'aménagement inconnu = « item »). */
fun heightLimits(kind: String?): DoubleArray {
    HEIGHT_LIMITS[kind]?.let { return it }
    if (kind != null && getItemKind(kind) != null) return HEIGHT_LIMITS.getValue("item")
    return HEIGHT_LIMITS.getValue("default")
}

/** `toFixed(d)` JS puis virgule décimale. */
private fun frNum(v: Double, d: Int = 2): String {
    val r = jsRound(v * 10.0.pow(d)) / 10.0.pow(d)
    return java.math.BigDecimal(r).setScale(d, java.math.RoundingMode.HALF_UP).toPlainString().replace('.', ',')
}

/** Équivalent de `String(Math.round(v*100)/100)` avec virgule. */
internal fun jsNumStr(v: Double): String {
    if (v.isNaN()) return "NaN"
    if (v == Math.floor(v) && abs(v) < 1e15) return v.toLong().toString()
    return v.toString().removeSuffix(".0")
}
private fun frShort(v: Double) = jsNumStr(jsRound(v * 100) / 100).replace('.', ',')

/** « 2,40 m ». */
fun formatHeight(m: Double?): String = if (m != null && m.isFinite()) "${frNum(m)} m" else "—"

/** Hauteur en cm entier pour un champ de saisie. */
fun heightToCm(m: Double): String = jsNumStr(jsRound(m * 100))

/** Message d'aide : « Hauteur plausible : 0,5 à 40 m ; valeur arrondie ». */
fun heightMessage(kind: String?): String {
    val (a, b) = heightLimits(kind).let { it[0] to it[1] }
    return "Hauteur plausible : ${frShort(a)} à ${frShort(b)} m ; valeur arrondie"
}

/** Saisie → mètres : « 450 » = 4,50 m (cm), « 4,5 m » accepté ; null si illisible. */
fun parseHeight(text: String?): Double? {
    val s = (text ?: "").trim().lowercase().replace(Regex("\\s+"), "").replaceFirst(',', '.')
    if (s.isEmpty()) return null
    val m = Regex("^(-?\\d+(?:\\.\\d+)?)(cm|m)?$").find(s) ?: return null
    val v = m.groupValues[1].toDoubleOrNull() ?: return null
    if (!v.isFinite()) return null
    return if (m.groupValues[2] == "m") v else v / 100
}
/** Saisie numérique : valeur en cm (comme le JS pour un nombre). */
fun parseHeight(cm: Double): Double? = if (cm.isFinite()) cm / 100 else null

/** Ramène une hauteur (m) dans les bornes de la catégorie. */
fun clampHeight(kind: String?, value: Double?): Double {
    val (a, b) = heightLimits(kind).let { it[0] to it[1] }
    if (value == null || !value.isFinite()) return a
    return min(b, max(a, jsRound(value * 100) / 100))
}

data class HeightCheck(val value: Double?, val ok: Boolean, val clamped: Boolean, val message: String)

/** Validation : `ok` faux si illisible. */
fun checkHeight(kind: String?, value: Double?): HeightCheck {
    if (value == null || !value.isFinite()) return HeightCheck(null, false, false, heightMessage(kind))
    val c = clampHeight(kind, value)
    val clamped = abs(c - jsRound(value * 100) / 100) > 1e-9
    return HeightCheck(c, true, clamped, if (clamped) heightMessage(kind) else "")
}

/** Hauteur réglée (m) d'une entité (`height`), sinon `defaults`. 0 est valide si `defaults` vaut 0 (terrasse au sol). */
fun heightOf(height: Double?, defaults: Double): Double {
    if (height != null && height.isFinite() && height >= 0 && (height > 0 || defaults == 0.0)) return height
    return if (defaults.isFinite()) defaults else 0.0
}

/** Vrai si la hauteur est celle par défaut (absente ou égale à `defaults` au centimètre près). */
fun isDefaultHeight(height: Double?, defaults: Double): Boolean =
    height == null || abs(height - defaults) < 0.005

data class ApplyHeightResult(val value: Double, val clamped: Boolean, val message: String, val isDefault: Boolean, val invalid: Boolean = false)

/**
 * Valide une hauteur et renvoie la hauteur à stocker (`stored` : null = valeur par défaut, champ supprimé).
 * Version fonctionnelle de `applyHeight` : l'appelant applique `stored` sur l'entité.
 */
data class AppliedHeight(val stored: Double?, val result: ApplyHeightResult)

fun applyHeight(current: Double?, kind: String?, value: Double?, defaults: Double): AppliedHeight {
    val chk = checkHeight(kind, value)
    if (!chk.ok) {
        return AppliedHeight(current, ApplyHeightResult(heightOf(current, defaults), false, chk.message, isDefaultHeight(current, defaults), invalid = true))
    }
    val v = chk.value!!
    val isDef = abs(v - defaults) < 0.005
    return AppliedHeight(if (isDef) null else v, ApplyHeightResult(v, chk.clamped, chk.message, isDef))
}

// ─── hauteurs par catégorie d'objet ───

/** Hauteur par défaut d'un aménagement (m). */
fun defaultItemHeight(kindId: String?): Double {
    val k = getItemKind(kindId)
    val d = DEFAULT_HEIGHTS.item[kindId]
    if (d != null && d != 0.0) return d
    return k?.height?.takeIf { it != 0.0 } ?: 0.5
}
/** Hauteur effective d'un aménagement (m). */
fun itemHeight(item: Item): Double = heightOf(item.height, defaultItemHeight(item.kind))

/** Hauteur par défaut d'un obstacle (maison, abri, mur, clôture, arbre). */
fun defaultObstacleHeight(kind: String?): Double = DEFAULT_HEIGHTS.obstacle[kind] ?: 2.3
fun obstacleHeight(ob: Obstacle): Double = heightOf(ob.height, defaultObstacleHeight(ob.kind))

/** Hauteur de paroi d'une piscine hors sol ou surélévation d'une terrasse (0 sinon). */
fun zoneHeight(zone: Zone?): Double {
    if (zone == null) return 0.0
    if (zone.type == "pool" && zone.variant == "above") return heightOf(zone.height, DEFAULT_HEIGHTS.poolAbove)
    if (zone.type == "terrace") return heightOf(zone.height, DEFAULT_HEIGHTS.terrace)
    return 0.0
}
fun defaultZoneHeight(zone: Zone?): Double = when (zone?.type) { "pool" -> DEFAULT_HEIGHTS.poolAbove; "terrace" -> DEFAULT_HEIGHTS.terrace; else -> 0.0 }
/** Clé de bornes pour une zone ('pool' | 'terrace'). */
fun zoneHeightKind(zone: Zone?): String = if (zone?.type == "terrace") "terrace" else "pool"

/** Bornes d'une essence selon sa catégorie. */
fun plantHeightKind(plant: PlantLike?): String = if (plant?.category != null && HEIGHT_LIMITS.containsKey(plant.category)) plant.category!! else "default"

/** Essence « effective » d'une plantation : hauteur/largeur réglées à la place du catalogue ; même objet si aucun réglage. */
fun effectivePlant(plant: PlantLike?, planting: Planting?): PlantLike? {
    if (plant == null || planting == null) return plant
    val h = planting.height
    val w = planting.width
    val hh = h != null && h.isFinite() && h > 0
    val ww = w != null && w.isFinite() && w > 0
    if (!hh && !ww) return plant
    return OverriddenPlant(plant, if (hh) h else plant.heightAdult, if (ww) w else plant.widthAdult)
}

/** Hauteur adulte retenue (m) pour une plantation : réglée sinon catalogue. */
fun plantingHeight(plant: PlantLike?, planting: Planting?): Double {
    val h = planting?.height
    if (h != null && h.isFinite() && h > 0) return h
    val p = plant?.heightAdult
    return if (p != null && p.isFinite() && p != 0.0) p else 0.0
}
