package fr.jardin.core

import java.text.Normalizer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class PlantCare(
    val plantMonths: List<Int> = emptyList(),
    val pruneMonths: List<Int> = emptyList(),
    val fertMonths: List<Int> = emptyList(),
    val planting: String = "",
    val pruning: String = "",
    val fertilizer: String = "",
    val watering: String = "",
    val notes: String = "",
)

@Serializable
data class StemRange(val min: Int, val max: Int)

/** Étiquette de port (data/plants/habits-tags.js). */
@Serializable
data class HabitTag(
    val habit: String,
    val stems: StemRange? = null,
    val support: String? = null,
    val note: String? = null,
)

/** Étiquette « mare » (data/plants/pond-tags.js). */
@Serializable
data class PondTag(
    val minArea: Double = 0.0,
    val minDepth: Double = 0.0,
    val maxDepth: Double = 0.0,
    val role: String = "",
    val spread: String = "",
    val forbid: Boolean = false,
    val note: String = "",
)

/** Ambiances typiques (par ordre de pertinence) et à éviter (data/plants/ambiances-tags.js). */
@Serializable
data class AmbianceTag(
    val ambiances: List<String> = emptyList(),
    val avoid: List<String> = emptyList(),
)

/** Une essence du catalogue, telle qu'exposée par `allPlants()` du JS (extras fusionnés) + tags fusionnés. */
@Serializable
data class Plant(
    override val id: String,
    override val commonName: String = "",
    override val latinName: String = "",
    override val category: String = "",
    override val heightAdult: Double = 0.0,
    override val widthAdult: Double = 0.0,
    val sun: List<String> = emptyList(),
    val hardiness: Double = 0.0,
    val water: String = "",
    val soil: List<String> = emptyList(),
    override val foliage: String = "",
    val bloom: List<Int> = emptyList(),
    val bloomColor: String? = null,
    val zones: List<String> = emptyList(),
    val melliferous: Boolean = false,
    val windTolerant: Boolean = false,
    val maintenance: String = "",
    val kc: Double = 0.0,
    override val spacing: Double = 0.0,
    val care: PlantCare = PlantCare(),
    val priceEur: Double? = null,
    val priceUnit: String? = null,
    val priceNote: String? = null,
    val flowerColor: String? = null,
    val foliageColor: String? = null,
    val wiki: String? = null,
    val toxic: Boolean = false,
    val edible: Boolean = false,
    val harvest: List<Int> = emptyList(),
    override val invasive: Boolean = false,
    val ambianceTag: AmbianceTag? = null,
    val habitTag: HabitTag? = null,
    val pondTag: PondTag? = null,
) : PlantLike {
    /** Port forcé par l'étiquette de port (sinon déduit par `habitOf`). */
    override val habit: String? get() = habitTag?.habit
}

@Serializable
private data class PlantsFile(val plants: List<Plant>)

/** Filtres du §7 (tous optionnels). */
data class PlantFilters(
    val foliage: String? = null,
    val bloomMonth: Int? = null,
    val heightMax: Double? = null,
    val melliferous: Boolean = false,
    val edible: Boolean = false,
    val lowMaintenance: Boolean = false,
    val lowWater: Boolean = false,
    val nonToxic: Boolean = false,
    val nonInvasive: Boolean = false,
    val category: List<String> = emptyList(),
)

object Catalog {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private var plants: List<Plant> = load()
    private var byId: Map<String, Plant> = plants.associateBy { it.id }

    private fun load(): List<Plant> {
        val stream = Catalog::class.java.getResourceAsStream("/plants.json") ?: return emptyList()
        return stream.use { json.decodeFromString<PlantsFile>(it.readBytes().toString(Charsets.UTF_8)).plants }
    }

    /** Remplace le catalogue (tests). */
    fun setCatalog(list: List<Plant>) {
        plants = list
        byId = list.associateBy { it.id }
    }

    /** Retire accents et casse pour les comparaisons. */
    fun normalizeText(s: String?): String =
        Normalizer.normalize(s ?: "", Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase().trim()

    fun allPlants(): List<Plant> = plants

    fun getPlant(id: String?): Plant? = if (id == null) null else byId[id]

    /** Recherche texte (nom commun ou latin, sans accents, tous les mots). */
    fun searchPlants(query: String?, list: List<Plant> = plants): List<Plant> {
        val words = normalizeText(query).split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return list.toList()
        return list.filter { p ->
            val hay = "${normalizeText(p.commonName)} ${normalizeText(p.latinName)}"
            words.all { hay.contains(it) }
        }
    }

    /** Filtres du §7. */
    fun filterPlants(list: List<Plant>?, f: PlantFilters = PlantFilters()): List<Plant> = (list ?: emptyList()).filter { p ->
        if (f.foliage != null && f.foliage != "" && p.foliage != f.foliage) return@filter false
        if (f.bloomMonth != null && f.bloomMonth != 0 && f.bloomMonth !in p.bloom) return@filter false
        if (f.heightMax != null && p.heightAdult > f.heightMax) return@filter false
        if (f.melliferous && !p.melliferous) return@filter false
        if (f.edible && !p.edible) return@filter false
        if (f.lowMaintenance && p.maintenance != "low") return@filter false
        if (f.lowWater && p.water != "low") return@filter false
        if (f.nonToxic && p.toxic) return@filter false
        if (f.nonInvasive && p.invasive) return@filter false
        if (f.category.isNotEmpty() && p.category !in f.category) return@filter false
        true
    }
}

fun allPlants(): List<Plant> = Catalog.allPlants()
fun getPlant(id: String?): Plant? = Catalog.getPlant(id)
fun searchPlants(query: String?, plants: List<Plant> = allPlants()): List<Plant> = Catalog.searchPlants(query, plants)
fun filterPlants(plants: List<Plant>?, filters: PlantFilters = PlantFilters()): List<Plant> = Catalog.filterPlants(plants, filters)
