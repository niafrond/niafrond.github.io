package fr.jardin.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlin.math.max
import kotlin.math.min

// Ports (silhouettes) des plantes (port de jardin/habits.js) : table des ports + fonctions pures de modélisation.

/** Port : forme du houppier, ratio hauteur/largeur, densité 0–1, étalement 0–1… */
data class Habit(
    val id: String, val label: String, val crown: String, val ratio: Double, val trunk: String,
    val density: Double, val spread: Double, val leaf: String, val flowerStyle: String, val note: String,
    val stems: StemRange? = null, val support: String? = null, val sheath: Boolean = false,
)

val HABITS: List<Habit> = listOf(
    Habit("tree-round", "arbre à houppier arrondi", "round", 1.4, "tall", 0.8, 0.6, "broad", "canopy", "Tronc net et houppier ovale ou arrondi."),
    Habit("tree-spreading", "arbre à houppier étalé", "spreading", 1.1, "tall", 0.85, 0.9, "broad", "canopy", "Large houppier plus large que haut, charpente massive."),
    Habit("tree-columnar", "arbre en colonne", "column", 3.2, "short", 0.85, 0.1, "needle", "none", "Silhouette fastigiée très étroite (cyprès)."),
    Habit("tree-conical", "arbre conique", "cone", 2.0, "short", 0.9, 0.35, "needle", "none", "Cône régulier, branches étagées jusqu'au sol ou presque."),
    Habit("tree-weeping", "arbre pleureur", "weeping", 1.5, "tall", 0.6, 0.6, "broad", "canopy", "Rameaux retombants en rideau."),
    Habit("tree-vase", "arbre en vase", "vase", 1.2, "short", 0.65, 0.7, "broad", "canopy", "Branches ascendantes partant d'un tronc court, houppier évasé."),
    Habit("tree-umbrella", "arbre en parasol", "umbrella", 0.9, "tall", 0.65, 0.9, "broad", "canopy", "Houppier plat et large porté par un tronc nu."),
    Habit("tree-fruit", "arbre fruitier", "round", 1.0, "short", 0.75, 0.7, "broad", "canopy", "Tronc court, houppier bas et arrondi, floraison abondante."),
    Habit("palm", "palmier", "fountain", 1.8, "tall", 0.7, 0.5, "palm", "none", "Stipe nu surmonté d'une couronne de palmes."),
    Habit("shrub-round", "arbuste arrondi", "dome", 1.0, "none", 0.85, 0.7, "broad", "scattered", "Dôme dense ramifié dès la base."),
    Habit("shrub-upright", "arbuste dressé", "vase", 1.5, "multi", 0.7, 0.4, "broad", "scattered", "Tiges dressées partant de la souche.", stems = StemRange(5, 15)),
    Habit("shrub-arching", "arbuste à port arqué", "fountain", 1.0, "multi", 0.6, 0.8, "broad", "scattered", "Branches souples arquées qui retombent en fontaine.", stems = StemRange(6, 20)),
    Habit("shrub-mound", "arbuste en coussin", "dome", 0.7, "none", 0.9, 0.85, "broad", "scattered", "Dôme bas, plus large que haut."),
    Habit("shrub-conical", "arbuste conique", "cone", 1.8, "none", 0.9, 0.3, "needle", "none", "Cône dense feuillu jusqu'au sol."),
    Habit("shrub-columnar", "arbuste en colonne", "column", 3.5, "none", 0.9, 0.1, "needle", "none", "Pilier étroit fastigié (if, genévrier colonnaire)."),
    Habit("bamboo", "bambou", "tuft", 3.0, "multi", 0.3, 0.5, "fine", "none", "Touffe cespiteuse (non traçante) de nombreux chaumes verticaux fins, feuillage léger en plumeaux en haut, gaine souvent teintée ; 2 à 6 m.", stems = StemRange(20, 80), sheath = true),
    Habit("hedge-clipped", "haie taillée", "column", 2.2, "none", 0.95, 0.15, "broad", "none", "Bande verte dense aux faces planes, taillée."),
    Habit("climber", "grimpante", "vines", 3.0, "none", 0.6, 0.3, "broad", "scattered", "Tiges volubiles ou palissées qui montent sur un support.", stems = StemRange(2, 6), support = "trellis"),
    Habit("vine", "liane à crampons", "vines", 3.0, "none", 0.85, 0.5, "broad", "none", "Liane vigoureuse qui couvre mur, pergola ou arbre.", stems = StemRange(1, 4), support = "wall"),
    Habit("perennial-clump", "vivace en touffe", "clump", 1.1, "none", 0.7, 0.5, "broad", "scattered", "Touffe buissonnante de tiges feuillées.", stems = StemRange(8, 30)),
    Habit("perennial-upright", "vivace à hampes dressées", "spike", 1.8, "none", 0.5, 0.3, "broad", "spikes", "Rosette basse d'où partent de hautes hampes florales.", stems = StemRange(3, 12)),
    Habit("perennial-mound", "vivace en coussin", "dome", 0.7, "none", 0.85, 0.7, "broad", "scattered", "Coussin arrondi de feuillage couvert de fleurs.", stems = StemRange(10, 40)),
    Habit("groundcover-mat", "couvre-sol en tapis", "mat", 0.15, "none", 0.95, 0.9, "fine", "scattered", "Tapis ras et dense."),
    Habit("groundcover-creeping", "couvre-sol rampant", "creeping", 0.2, "none", 0.8, 1.0, "broad", "scattered", "Tiges rampantes qui s'étalent et s'enracinent."),
    Habit("grass-arching", "graminée arquée", "fountain", 1.3, "none", 0.55, 0.8, "blade", "spikes", "Fontaine de feuilles arquées et d'épis.", stems = StemRange(30, 100)),
    Habit("grass-upright", "graminée dressée", "column", 2.5, "none", 0.5, 0.2, "blade", "spikes", "Touffe raide et dressée, panicules verticales.", stems = StemRange(25, 80)),
    Habit("grass-fine", "graminée fine", "tuft", 1.0, "none", 0.4, 0.6, "fine", "spikes", "Touffe ébouriffée de feuilles filiformes.", stems = StemRange(50, 150)),
    Habit("fern", "fougère", "fountain", 1.1, "none", 0.6, 0.8, "frond", "none", "Couronne de frondes arquées qui se déroulent.", stems = StemRange(8, 25)),
    Habit("rosette", "plante en rosette", "rosette", 0.6, "none", 0.9, 0.9, "broad", "spikes", "Rosette de grandes feuilles, hampes florales au-dessus.", stems = StemRange(10, 30)),
    Habit("bulb-spike", "bulbe à hampe", "spike", 6.0, "none", 0.3, 0.1, "blade", "spikes", "Hampe unique dressée portant la fleur, feuilles basses.", stems = StemRange(1, 5)),
    Habit("bulb-clump", "bulbe en touffe", "tuft", 2.5, "none", 0.5, 0.4, "blade", "scattered", "Petite touffe de feuilles en lanières et de fleurs.", stems = StemRange(5, 20)),
    Habit("aquatic-floating", "plante aquatique flottante", "floating", 0.05, "none", 0.8, 1.0, "floating", "scattered", "Feuilles posées à la surface de l'eau."),
    Habit("aquatic-reed", "plante de roselière", "blade", 4.0, "none", 0.5, 0.4, "blade", "spikes", "Touffe de feuilles ou tiges dressées dans l'eau.", stems = StemRange(10, 60)),
    Habit("aquatic-marginal", "plante de berge", "clump", 1.0, "none", 0.7, 0.6, "broad", "scattered", "Touffe à pied humide, au bord de l'eau.", stems = StemRange(6, 20)),
    Habit("vegetable-row", "légume en rang", "row", 1.0, "none", 0.8, 0.5, "broad", "none", "Plants alignés en rang au potager.", stems = StemRange(1, 6)),
    Habit("vegetable-climbing", "légume grimpant", "vines", 3.0, "none", 0.65, 0.3, "broad", "scattered", "Tiges palissées sur tuteur, rames ou grillage.", stems = StemRange(1, 4), support = "tripod"),
    Habit("herb-bush", "aromatique en buisson", "dome", 0.9, "none", 0.65, 0.7, "fine", "spikes", "Petit buisson dense de feuilles fines et aromatiques.", stems = StemRange(10, 40)),
    Habit("lawn", "pelouse", "mat", 0.1, "none", 1.0, 1.0, "blade", "none", "Tapis uniforme de gazon."),
)

val HABIT_IDS: List<String> = HABITS.map { it.id }
private val BY_ID: Map<String, Habit> = HABITS.associateBy { it.id }
val SUPPORTS = listOf("wall", "trellis", "pergola", "tripod")

/** Table des étiquettes par id d'essence (ressource `habits-tags.json`, exportée du JS). */
val TAGS_BY_PLANT: Map<String, HabitTag> by lazy {
    val text = Habit::class.java.getResourceAsStream("/habits-tags.json")?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }
    if (text == null) emptyMap() else JardinJson.json.decodeFromString(MapSerializer(String.serializer(), HabitTag.serializer()), text)
}

private fun clamp(v: Double, a: Double, b: Double) = min(b, max(a, v))
/** `num` du JS : nombre fini > 0, sinon valeur par défaut. */
internal fun num(v: Double?, d: Double): Double = if (v != null && v.isFinite() && v > 0) v else d

/** Port par id (null si inconnu). */
fun getHabit(id: String?): Habit? = if (id == null) null else BY_ID[id]

private val RE_CONIFER = Regex("\\b(Pinus|Cedrus|Cupressus|Cupressocyparis|Taxus|Thuja|Abies|Picea|Juniperus|Larix|Sequoia|Chamaecyparis|Tsuga)\\b", RegexOption.IGNORE_CASE)
private val RE_PALM = Regex("\\b(Phoenix|Trachycarpus|Chamaerops|Washingtonia|Butia|Livistona)\\b", RegexOption.IGNORE_CASE)
private val RE_BAMBOO = Regex("\\b(Fargesia|Phyllostachys|Bambusa|Pleioblastus|Sasa|Semiarundinaria|Pseudosasa|Chusquea)\\b", RegexOption.IGNORE_CASE)
private val RE_FERN = Regex("\\b(Dryopteris|Athyrium|Polystichum|Asplenium|Osmunda|Blechnum|Matteuccia|Polypodium)\\b", RegexOption.IGNORE_CASE)
private val RE_ROSETTE = Regex("\\b(Hosta|Bergenia|Heuchera|Sempervivum|Primula|Brunnera)\\b", RegexOption.IGNORE_CASE)
private val RE_WEEPING = Regex("pendula|babylonica|pendulum|'?pleureur", RegexOption.IGNORE_CASE)

/** Port de repli par catégorie, taille et feuillage (sans tag explicite). */
private fun deduce(p: PlantLike): String {
    val cat = p.category
    val h = num(p.heightAdult, 1.0)
    val w = num(p.widthAdult, h)
    val ratio = h / w
    val latin = p.latinName ?: ""
    val ev = p.foliage == "evergreen"
    if (RE_BAMBOO.containsMatchIn(latin)) return "bamboo"
    if (RE_PALM.containsMatchIn(latin)) return "palm"
    return when (cat) {
        "tree" -> {
            if (RE_CONIFER.containsMatchIn(latin)) { if (ratio >= 3) "tree-columnar" else "tree-conical" }
            else if (RE_WEEPING.containsMatchIn(latin)) "tree-weeping"
            else if (ratio >= 3) "tree-columnar"
            else if (ratio <= 1.1) "tree-spreading" else "tree-round"
        }
        "fruit" -> if (h >= 8) "tree-spreading" else if (h <= 2) "shrub-round" else "tree-fruit"
        "shrub" -> {
            if (RE_CONIFER.containsMatchIn(latin)) { if (ratio >= 3) "shrub-columnar" else "shrub-conical" }
            else if (ratio >= 3) "shrub-columnar"
            else if (h <= 1.2 && w >= h) "shrub-mound"
            else if (ratio >= 1.4) "shrub-upright"
            else if (ev) "shrub-round" else "shrub-arching"
        }
        "hedge" -> if (RE_CONIFER.containsMatchIn(latin) && ratio >= 6) "tree-columnar" else "hedge-clipped"
        "climber" -> if (h >= 8) "vine" else "climber"
        "perennial" -> {
            if (RE_FERN.containsMatchIn(latin)) "fern"
            else if (RE_ROSETTE.containsMatchIn(latin)) "rosette"
            else if (ratio >= 1.8) "perennial-upright"
            else if (ratio <= 0.8) "perennial-mound"
            else "perennial-clump"
        }
        "groundcover" -> if (h < 0.3) "groundcover-mat" else "groundcover-creeping"
        "grass" -> if (ratio >= 2) "grass-upright" else if (h <= 0.5 && w <= 0.5) "grass-fine" else "grass-arching"
        "bulb" -> if (ratio >= 3) "bulb-spike" else "bulb-clump"
        "aquatic" -> if (h <= 0.2 && w >= 0.4) "aquatic-floating" else if (h >= 0.8) "aquatic-reed" else "aquatic-marginal"
        "vegetable" -> if (h >= 1.5) "vegetable-climbing" else "vegetable-row"
        "lawn" -> "lawn"
        else -> if (h >= 3) "tree-round" else if (h >= 1) "shrub-round" else "perennial-clump"
    }
}

private fun tagOf(p: PlantLike?): HabitTag? = if (p == null) null else TAGS_BY_PLANT[p.id]

/** Port d'une essence : tag explicite (champ `habit` de la plante, sinon table de tags), sinon déduction. */
fun habitOf(plant: PlantLike?): Habit {
    if (plant == null) return BY_ID.getValue("shrub-round")
    plant.habit?.let { h -> BY_ID[h]?.let { return it } }
    val tag = tagOf(plant)
    tag?.habit?.let { h -> BY_ID[h]?.let { return it } }
    return BY_ID.getValue(deduce(plant))
}

private data class AgeF(val a: Double, val h: Double, val w: Double)

/** Âge → facteurs : nombre 0–1 (0,35→1 en hauteur), 'young' ou 'adult'. */
private fun ageFactors(age: Any?): AgeF {
    var a = 1.0
    when {
        age == "young" -> a = 0.0
        age == "adult" || age == null -> a = 1.0
        else -> {
            val n = when (age) { is Number -> age.toDouble(); is String -> age.toDoubleOrNull(); else -> null }
            if (n != null && n.isFinite()) a = clamp(n, 0.0, 1.0)
        }
    }
    return AgeF(a, 0.35 + 0.65 * a, 0.3 + 0.7 * a)
}

private val TRUNK_FRAC = mapOf("none" to 0.0, "short" to 0.2, "tall" to 0.4, "multi" to 0.12)

data class HabitParams(
    val habit: String, val label: String, val crown: String, val trunk: String, val leaf: String, val flowerStyle: String,
    val heightAdult: Double, val widthAdult: Double, val height: Double, val width: Double, val ratio: Double,
    val typicalRatio: Double, val trunkHeight: Double, val crownHeight: Double, val density: Double, val spread: Double,
    val stems: Int, val support: String?, val sheath: Boolean, val ageFactor: Double,
)

/**
 * Paramètres numériques de modélisation d'une plante à un âge donné (`age` : nombre 0–1, "young" ou "adult").
 * `height` / `width` : hauteur et largeur adultes réglées à la main (m).
 */
fun habitParams(plant: PlantLike?, age: Any? = 1, height: Double? = null, width: Double? = null): HabitParams {
    val habit = habitOf(plant)
    val tag = tagOf(plant)
    val f = ageFactors(age)
    val heightAdult = num(height, num(plant?.heightAdult, 1.0))
    val widthAdult = num(width, num(plant?.widthAdult, max(0.05, heightAdult / habit.ratio)))
    val h = max(0.001, heightAdult * f.h)
    val w = max(0.001, widthAdult * f.w)
    val trunkHeight = if (habit.trunk == "none") 0.0 else h * TRUNK_FRAC.getValue(habit.trunk)
    val range = tag?.stems ?: habit.stems
    val stems: Int = if (range != null) {
        val fill = clamp(widthAdult / 2, 0.05, 1.0)
        val adult = range.min + (range.max - range.min) * fill
        max(if (range.min > 1) 2 else 1, jsRound(adult * (0.3 + 0.7 * f.a)).toInt())
    } else if (habit.trunk == "multi") 3
    else if (habit.trunk != "none") 1 else 0
    val support = tag?.support ?: habit.support
    return HabitParams(
        habit.id, habit.label, habit.crown, habit.trunk, habit.leaf, habit.flowerStyle, heightAdult, widthAdult, h, w, h / w,
        habit.ratio, trunkHeight, h - trunkHeight, habit.density, habit.spread, stems, support, habit.sheath, f.a,
    )
}

private val SUPPORT_FR = mapOf("wall" to "un mur", "trellis" to "un treillage", "pergola" to "une pergola", "tripod" to "un tuteur")

/** Phrase française courte décrivant le port de l'essence. */
fun describeHabit(plant: PlantLike?): String {
    val h = habitOf(plant)
    val tag = tagOf(plant)
    val hh = num(plant?.heightAdult, 0.0)
    val ww = num(plant?.widthAdult, 0.0)
    fun fmt(v: Double) = (if (v >= 10) jsNumStr(jsRound(v)) else jsNumStr(jsRound(v * 10) / 10)).replace('.', ',')
    val dims = if (hh != 0.0) " (${fmt(hh)} m${if (ww != 0.0 && ww >= 0.1) " × ${fmt(ww)} m" else ""})" else ""
    val cap = h.label.take(1).uppercase() + h.label.drop(1)
    val sup = tag?.support ?: h.support
    var first = "$cap$dims"
    if (sup != null && h.crown == "vines") first += ", sur ${SUPPORT_FR[sup] ?: "un support"}"
    val note = tag?.note ?: h.note
    return "$first. $note"
}
