package fr.jardin.core

import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import java.text.Normalizer
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Mares (port de jardin/ponds.js) : profondeur, adéquation d'une essence à la taille de la mare, couverture et quantités.

private val WATER_ROLES = setOf("flottante", "oxygenante")
/** Part de la surface de la mare qu'un rôle peut raisonnablement occuper. */
private val COVER = mapOf("flottante" to 0.5, "oxygenante" to 0.3, "bordure" to 0.25, "berge" to 0.2, "marais" to 0.2)
/** Au-delà de cette surface, une essence très colonisatrice (`spread = fort`) reste raisonnable. */
const val STRONG_SPREAD_MIN_AREA = 20.0
/** Mare plus grande que cela : les grands arbres et ligneux à racines agressives redeviennent tolérables. */
const val BIG_TREE_MIN_AREA = 30.0

/** Étiquettes « mare » par id d'essence (ressource `pond-tags.json`, exportée du JS). */
val POND_TAGS: Map<String, PondTag> by lazy {
    val text = PondTag::class.java.getResourceAsStream("/pond-tags.json")?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
    if (text == null) emptyMap() else JardinJson.json.decodeFromString(MapSerializer(String.serializer(), PondTag.serializer()), text)
}

private fun r1(n: Double) = jsRound(n * 10) / 10
private fun fmt(n: Double) = jsNumStr(r1(n)).replace('.', ',')

fun pondTag(plant: PlantLike?): PondTag? = if (plant == null) null else POND_TAGS[plant.id]

private fun norm(t: String?): String =
    Normalizer.normalize(t ?: "", Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase()

private val AGGRESSIVE_GENERA = Regex("^(populus|alnus|robinia|ailanthus|ulmus|platanus|fraxinus)\\b")
private val SALIX = Regex("^salix\\b")
private val OSIER = Regex("\\b(saules?|osiers?)\\b")
private fun isWillow(plant: PlantLike) = SALIX.containsMatchIn(norm(plant.latinName)) || OSIER.containsMatchIn(norm(plant.commonName))

/**
 * Règle générale (par genre / nom) : "willow" (toujours interdit), "aggressive" (racines agressives),
 * "bigtree" (grand arbre > 6 m) ou null.
 */
fun pondTreeRule(plant: PlantLike?): String? {
    if (plant == null) return null
    if (isWillow(plant)) return "willow"
    val lat = norm(plant.latinName)
    if (AGGRESSIVE_GENERA.containsMatchIn(lat) || Regex("^acer saccharinum\\b").containsMatchIn(lat) ||
        Regex("^betula pendula\\b").containsMatchIn(lat) || Regex("^populus tremula\\b").containsMatchIn(lat)) return "aggressive"
    if (plant.category == "tree" && (plant.heightAdult ?: 0.0) > 6) return "bigtree"
    return null
}

/** L'essence est-elle concernée par les règles de mare (étiquette ou règle générale) ? */
fun pondConcerned(plant: PlantLike?): Boolean = pondTag(plant) != null || pondTreeRule(plant) != null
fun pondTaggedIds(): List<String> = POND_TAGS.keys.toList()

/** Surface de la mare (m²). */
fun pondArea(zone: Zone?): Double = try { if (zone?.shape != null) shapeArea(zone.shape) else 0.0 } catch (_: Exception) { 0.0 }

/** Profondeur estimée d'après la surface : < 2 m² → 40 cm, < 6 → 60, < 20 → 80, sinon 100. */
fun estimatePondDepth(area: Double): Int = if (area < 2) 40 else if (area < 6) 60 else if (area < 20) 80 else 100

/** Profondeur moyenne (cm) : `zone.depth` si valide, sinon estimée d'après la surface. */
fun pondDepth(zone: Zone?): Int {
    val d = zone?.depth
    return if (d != null && d.isFinite() && d > 0) jsRound(d).toInt() else estimatePondDepth(pondArea(zone))
}

data class PondFit(val ok: Boolean, val level: String, val reasons: List<String>)

/** Adéquation à partir de valeurs numériques (surface m², profondeur cm). */
fun pondFitFor(plant: PlantLike?, area: Double, depth: Int): PondFit {
    val tag = pondTag(plant)
    val rule = pondTreeRule(plant)
    if (plant == null || (tag == null && rule == null)) return PondFit(true, "ok", emptyList())
    val reasons = ArrayList<String>()
    var level = "ok"
    fun worse(l: String) { if (l == "forbid" || (l == "avoid" && level == "ok")) level = l }
    val name = plant.commonName?.takeIf { it.isNotEmpty() } ?: plant.id

    if (rule == "willow" || (tag != null && tag.forbid)) {
        return PondFit(false, "forbid", listOf("Les saules ne conviennent pas aux mares : racines envahissantes, feuilles dans l’eau"))
    }
    if (rule != null && area < BIG_TREE_MIN_AREA) {
        worse(if (rule == "aggressive") "forbid" else "avoid")
        val bt = jsNumStr(BIG_TREE_MIN_AREA)
        reasons.add(if (rule == "aggressive") "Racines agressives et grand développement : à éviter autour d’une mare de moins de $bt m² (bâche, feuilles dans l’eau)"
        else "Grand arbre (plus de 6 m) : trop imposant autour d’une mare de moins de $bt m²")
    }
    if (tag == null) return PondFit(level == "ok", level, reasons)

    if (plant.invasive) {
        worse("forbid")
        reasons.add("$name est une plante invasive : interdite en mare, elle envahit les milieux naturels")
    }
    if (area < tag.minArea - 1e-9) {
        worse(if (area < tag.minArea * 0.6) "forbid" else "avoid")
        if (!plant.invasive) reasons.add("Trop grande pour cette mare (${fmt(area)} m² ; il faut ≥ ${fmt(tag.minArea)} m²)")
    }
    if (tag.role in WATER_ROLES && depth < tag.minDepth - 1e-9) {
        worse(if (depth < tag.minDepth * 0.75) "forbid" else "avoid")
        reasons.add("Mare trop peu profonde pour ${if (plant.id == "h-nenuphar") "ce nénuphar" else "cette plante"} ($depth cm ; il faut ≥ ${jsNumStr(tag.minDepth)} cm)")
    }
    if (tag.spread == "fort" && area < STRONG_SPREAD_MIN_AREA && !plant.invasive) {
        worse("avoid")
        reasons.add("Très colonisatrice : elle envahirait une mare de moins de ${jsNumStr(STRONG_SPREAD_MIN_AREA)} m²")
    }
    return PondFit(level == "ok", level, reasons)
}

/** L'essence convient-elle à cette mare ? */
fun pondFit(plant: PlantLike?, zone: Zone?): PondFit = pondFitFor(plant, pondArea(zone), pondDepth(zone))

/** Part de la surface de la mare (0–1) que l'essence peut raisonnablement couvrir ; 0 si non étiquetée. */
fun pondCoverage(plant: PlantLike?, @Suppress("UNUSED_PARAMETER") zone: Zone? = null): Double {
    val tag = pondTag(plant) ?: return 0.0
    return COVER[tag.role] ?: 0.2
}

/** Quantité raisonnable d'une essence dans cette mare (≥ 1). */
fun pondPlantQuantity(plant: PlantLike, zone: Zone?): Int {
    val tag = pondTag(plant)
    val area = pondArea(zone)
    if (tag == null || area <= 0) return 1
    if (tag.role == "oxygenante") return max(1, min(30, jsRound(area * pondCoverage(plant, zone) / 0.5).toInt()))
    val sp = (plant.spacing ?: 0.0).let { s -> if (s > 0) s else (plant.widthAdult ?: 0.0).let { w -> if (w > 0) w else 1.0 } }
    val wa = plant.widthAdult?.takeIf { it != 0.0 } ?: sp
    val footprint = if (tag.role == "flottante") PI * (wa / 2) * (wa / 2) else sp * sp
    return max(1, floor(pondCoverage(plant, zone) * area / footprint + 1e-9).toInt())
}
