package fr.jardin.core

import java.time.LocalDate
import kotlin.math.max

// Conseils de plantation, entretien, arrosage et calendrier (port de jardin/advice.js, textes en français).
// Les fiches d'essence (`plant.care`) priment ; les champs manquants sont complétés par `genericCare(category)`.

/** Conseils génériques d'une catégorie. */
data class GenericCare(
    val plantMonths: List<Int>, val pruneMonths: List<Int>, val fertMonths: List<Int>,
    val planting: String, val pruning: String, val fertilizer: String, val watering: String, val notes: String,
)

object Advice {
    private val TYPE_LABEL = mapOf(
        "pond" to "Mare", "pool" to "Piscine", "terrace" to "Terrasse", "path" to "Allée", "lawn" to "Pelouse", "lowplants" to "Couvre-sols",
        "midplants" to "Massif", "tallplants" to "Plantes hautes", "hedge" to "Haie", "trees" to "Arbres", "vegetable" to "Potager",
        "orchard" to "Verger", "other" to "Zone",
    )

    private fun range(a: Int, b: Int): List<Int> = (a..b).toList()

    private val GENERIC: Map<String, GenericCare> = mapOf(
        "tree" to GenericCare(listOf(11, 12, 2, 3), listOf(1, 2), listOf(3),
            "Planter à l'automne ou en fin d'hiver hors gel, dans un trou deux fois plus large que la motte ; tuteurer, pailler et arroser copieusement.",
            "Taille de formation les premières années, puis éclaircie légère en fin d'hiver ; retirer le bois mort.",
            "Compost mûr au pied chaque printemps.",
            "Arrosage de reprise la première année (20 à 30 L toutes les 2 semaines en été sec), ensuite rare.",
            "Respecter la distance aux limites de propriété et à la maison selon la taille adulte."),
        "fruit" to GenericCare(listOf(11, 12, 2, 3), listOf(1, 2, 7), listOf(3, 9),
            "Planter à racines nues de novembre à mars hors gel ; pralinage des racines, tuteur, paillage.",
            "Taille de fructification en hiver, éclaircissage des fruits en juin.",
            "Compost ou fumier décomposé en fin d'hiver, apport potassique à l'automne.",
            "Arroser en cas de sécheresse, surtout pendant le grossissement des fruits.",
            "Vérifier la pollinisation (variété compagne) pour les espèces non autofertiles."),
        "shrub" to GenericCare(listOf(10, 11, 3, 4), listOf(3, 6), listOf(3),
            "Planter à l'automne ou au printemps, collet au niveau du sol, avec un apport de compost et un paillage.",
            "Tailler après la floraison pour les arbustes de printemps, en fin d'hiver pour ceux d'été.",
            "Engrais organique ou compost au printemps.",
            "Arroser régulièrement la première année ; ensuite seulement en période sèche prolongée.",
            "Laisser la place du développement adulte."),
        "hedge" to GenericCare(listOf(10, 11, 3), listOf(4, 9), listOf(3),
            "Planter en quinconce à l'automne, en respectant l'écartement indiqué ; pailler le pied pour limiter les herbes.",
            "Deux tailles par an (printemps et fin d'été), en évitant la période de nidification (avril à juillet).",
            "Compost ou engrais organique au printemps.",
            "Arrosage soutenu les deux premières années.",
            "Tailler plus large à la base qu'au sommet pour que la lumière arrive en bas."),
        "climber" to GenericCare(listOf(10, 11, 3, 4), listOf(2, 3), listOf(3, 6),
            "Planter à 30 cm du support, incliner la tige vers lui ; installer fils ou treillage solides.",
            "Tailler selon l'espèce : fin d'hiver pour les floraisons d'été, après floraison pour le printemps.",
            "Compost au printemps, engrais floraison en juin.",
            "Arroser régulièrement au pied, surtout au contact d'un mur.",
            "Palisser les jeunes pousses au fur et à mesure."),
        "perennial" to GenericCare(listOf(3, 4, 9, 10), listOf(3, 10), listOf(3),
            "Planter au printemps ou à l'automne, en ameublissant le sol ; espacer selon la taille adulte.",
            "Couper les tiges fanées en fin d'automne ou en fin d'hiver ; supprimer les fleurs fanées pour prolonger la floraison.",
            "Compost en surface au printemps.",
            "Arroser à la plantation et en période sèche ; pailler pour garder la fraîcheur.",
            "Diviser les touffes tous les 3 à 5 ans à l'automne ou au printemps."),
        "groundcover" to GenericCare(listOf(3, 4, 9, 10), listOf(3), listOf(3),
            "Planter serré (voir l'écartement conseillé) sur sol désherbé et paillé pour une couverture rapide.",
            "Rabattre ou recadrer en fin d'hiver pour contenir la plante.",
            "Peu d'apports : un peu de compost au printemps suffit.",
            "Arrosage de reprise régulier, puis occasionnel.",
            "Désherber soigneusement la première année, le temps que la plante couvre le sol."),
        "grass" to GenericCare(listOf(3, 4, 9, 10), listOf(3), listOf(4),
            "Planter en touffes au printemps ou à l'automne, en sol bien drainé.",
            "Couper les touffes à 10 cm du sol en fin d'hiver avant la reprise.",
            "Compost léger au printemps.",
            "Arroser à la plantation, puis seulement en cas de sécheresse.",
            "Éviter de tailler avant la fin de l'hiver : le feuillage protège le cœur du gel."),
        "bulb" to GenericCare(listOf(9, 10, 11), emptyList(), listOf(3),
            "Planter à une profondeur égale à 2 à 3 fois la hauteur du bulbe, pointe vers le haut, en sol drainant.",
            "Laisser le feuillage jaunir complètement avant de le couper.",
            "Engrais pauvre en azote après la floraison.",
            "Arroser modérément pendant la croissance, pas en dormance.",
            "Éviter l'eau stagnante qui fait pourrir les bulbes."),
        "aquatic" to GenericCare(listOf(4, 5, 6), listOf(9, 10), emptyList(),
            "Installer en panier ou en berge à la profondeur indiquée, de mai à juin quand l'eau se réchauffe.",
            "Retirer les feuilles mortes et limiter les plantes envahissantes à l'automne.",
            "Aucun engrais : il favorise les algues.",
            "Maintenir le niveau d'eau en été ; privilégier l'eau de pluie.",
            "Curer la mare tous les 3 à 5 ans à l'automne, par moitié."),
        "vegetable" to GenericCare(listOf(3, 4, 5, 6), emptyList(), listOf(3, 5),
            "Semer ou repiquer après les dernières gelées, sur sol ameubli et enrichi en compost.",
            "Tuteurer et supprimer les gourmands selon la culture.",
            "Compost mûr à la préparation, purin ou engrais organique en cours de culture.",
            "Arroser au pied, régulièrement, de préférence le soir ou tôt le matin.",
            "Pratiquer la rotation des cultures d'une année sur l'autre."),
        "lawn" to GenericCare(listOf(4, 5, 9), range(4, 10), listOf(4, 9),
            "Semer au printemps ou en début d'automne sur sol bien préparé et roulé.",
            "Tondre à 5-6 cm de hauteur, une fois par semaine en pleine pousse.",
            "Engrais gazon organique au printemps et en septembre.",
            "Arroser rarement mais abondamment, tôt le matin ; laisser jaunir en été est toléré.",
            "Scarifier et aérer à l'automne."),
    )

    private const val FALLBACK_CAT = "shrub"

    /** Conseils génériques d'une catégorie (arbre, arbuste, vivace…) quand la fiche est incomplète. */
    fun genericCare(category: String?): GenericCare = GENERIC[category] ?: GENERIC.getValue(FALLBACK_CAT)

    private val ZONE_TIPS = mapOf(
        "pond" to listOf("Curer la mare par moitié à l'automne, tous les 3 à 5 ans.", "Ne pas introduire de poissons rouges : ils déséquilibrent la mare."),
        "pool" to listOf("Garder les arbres à l'écart pour limiter les feuilles et les racines."),
        "terrace" to listOf("Nettoyer à la brosse et au savon noir, sans produits agressifs, au printemps."),
        "path" to listOf("Désherber à la main ou au grattoir, regarnir le revêtement si besoin."),
        "lawn" to listOf("Tondre haut (5-6 cm), scarifier à l'automne, sursemer les zones dégarnies."),
        "vegetable" to listOf("Faire tourner les cultures chaque année et pailler pour économiser l'eau."),
        "orchard" to listOf("Ramasser les fruits tombés pour limiter les maladies."),
    )

    private val CATEGORY_ORDER = mapOf(
        "tree" to 1, "fruit" to 1, "shrub" to 2, "hedge" to 2, "climber" to 2,
        "perennial" to 3, "bulb" to 3, "aquatic" to 3, "vegetable" to 3, "groundcover" to 4, "grass" to 5, "lawn" to 5,
    )

    private data class Stage(val n: Int, val label: String, val text: String)
    private val STAGES = listOf(
        Stage(0, "Gros œuvre", "terrasse, allées, mare ou piscine, clôtures et terrassements"),
        Stage(1, "Arbres", "arbres isolés et fruitiers (les plus gros d'abord)"),
        Stage(2, "Arbustes", "arbustes, haies et plantes grimpantes"),
        Stage(3, "Vivaces", "vivaces, bulbes, plantes aquatiques et potager"),
        Stage(4, "Couvre-sols", "plantes couvre-sol"),
        Stage(5, "Gazon", "semis ou pose du gazon, en dernier pour ne pas l'abîmer"),
    )

    private fun defaultLookup(): PlantById = { Catalog.getPlant(it) }
    private fun zoneLabel(z: Zone): String = z.label.ifEmpty { TYPE_LABEL[z.type] ?: "Zone" }

    /** Conseils d'une essence : fiche complétée par le générique. */
    fun mergedCare(plant: Plant): GenericCare {
        val g = genericCare(plant.category)
        val c = plant.care
        // Le JSON distingue « mois absents » (repli générique) de « liste vide » ; ici une fiche entièrement vide = fiche absente.
        val absent = c == PlantCare()
        return GenericCare(
            plantMonths = c.plantMonths.ifEmpty { g.plantMonths },
            pruneMonths = if (absent) g.pruneMonths else c.pruneMonths, fertMonths = if (absent) g.fertMonths else c.fertMonths,
            planting = c.planting.ifBlank { g.planting }, pruning = c.pruning.ifBlank { g.pruning },
            fertilizer = c.fertilizer.ifBlank { g.fertilizer }, watering = c.watering.ifBlank { g.watering }, notes = c.notes.ifBlank { g.notes },
        )
    }

    private fun waterMonths(plant: Plant): List<Int> = when (plant.water) { "high" -> range(4, 10); "low" -> listOf(6, 7, 8); else -> range(5, 9) }

    private data class Entry(val zone: Zone, val plant: Plant, val count: Int)

    private fun entries(garden: Garden?, lookup: PlantById): List<Entry> {
        val out = mutableListOf<Entry>()
        for (zone in garden?.zones ?: emptyList()) for (pl in zone.plantings) {
            val plant = lookup(pl.plantId)
            if (plant != null) out.add(Entry(zone, plant, pl.count ?: 1))
        }
        return out
    }

    data class PlantAdvice(val plant: Plant, val count: Int, val planting: String, val pruning: String, val fertilizer: String, val watering: String, val notes: String)
    data class ZoneAdvice(val zoneId: String, val zoneLabel: String, val type: String, val plants: List<PlantAdvice>, val tips: List<String>)
    data class General(val disclaimer: String, val mulch: String, val water: String, val rainwater: String, val emptyHint: String?)
    data class GardenAdvice(val zones: List<ZoneAdvice>, val plantingOrder: List<String>, val general: General, val existing: ExistingAdvice)

    /** Conseils du jardin par zone et par essence, ordre de chantier, conseils généraux. */
    fun buildAdvice(garden: Garden?, plantsById: PlantById = defaultLookup(), month: Int = LocalDate.now().monthValue): GardenAdvice {
        val zones = (garden?.zones ?: emptyList()).map { zone ->
            val plants = zone.plantings.mapNotNull { pl ->
                val plant = plantsById(pl.plantId) ?: return@mapNotNull null
                val c = mergedCare(plant)
                PlantAdvice(plant, pl.count ?: 1, c.planting, c.pruning, c.fertilizer, c.watering, c.notes)
            }
            ZoneAdvice(zone.id, zoneLabel(zone), zone.type, plants, ZONE_TIPS[zone.type] ?: emptyList())
        }
        val present = mutableSetOf<Int>()
        for (z in garden?.zones ?: emptyList()) if (z.type in listOf("pond", "pool", "terrace", "path")) present.add(0)
        for (z in garden?.zones ?: emptyList()) if (z.type == "lawn") present.add(5)
        for (e in entries(garden, plantsById)) present.add(CATEGORY_ORDER[e.plant.category] ?: 2)
        val plantingOrder = STAGES.filter { it.n in present }.mapIndexed { i, s -> "${i + 1}. ${s.label} : ${s.text}." }
        val roof = garden?.context?.roofArea
        val general = General(
            disclaimer = "Les quantités et périodes sont des ordres de grandeur : adaptez-les à votre terrain et au temps qu'il fait.",
            mulch = "Paillez les massifs sur 5 à 8 cm (broyat, paille, feuilles) pour garder l'humidité et limiter les herbes.",
            water = "Arrosez de préférence tôt le matin ou le soir, au pied, copieusement et rarement.",
            rainwater = if (roof != null && roof != 0.0 && !roof.isNaN())
                "Avec ${jsNum(jsRound(roof))} m² de toit, une cuve de ${jsNum(max(300.0, jsRound(roof * 15 / 100) * 100))} L est un bon départ pour récupérer l'eau de pluie."
            else "Récupérer l'eau de pluie d'un toit dans une cuve réduit l'arrosage au robinet.",
            emptyHint = if (zones.all { it.plants.isEmpty() }) "Aucune essence choisie pour le moment : ajoutez-en pour obtenir des conseils détaillés." else null,
        )
        return GardenAdvice(zones, plantingOrder, general, existingAdvice(garden, plantsById, month))
    }

    data class CalendarTask(val kind: String, val zoneId: String, val plantId: String?, val text: String)
    data class CalendarMonth(val month: Int, val tasks: List<CalendarTask>)

    /** Calendrier de 12 mois. */
    fun calendar(garden: Garden?, plantsById: PlantById = defaultLookup()): List<CalendarMonth> {
        val months = range(1, 12).map { mutableListOf<CalendarTask>() }
        fun add(m: Int, kind: String, zone: Zone, plant: Plant?, text: String) { months[m - 1].add(CalendarTask(kind, zone.id, plant?.id, text)) }
        for ((zone, plant) in entries(garden, plantsById).map { it.zone to it.plant }) {
            val c = mergedCare(plant)
            val where = zoneLabel(zone).lowercase()
            val name = plant.commonName.ifEmpty { plant.id }
            c.plantMonths.forEach { add(it, "plant", zone, plant, "Planter : $name ($where)") }
            c.pruneMonths.forEach { add(it, "prune", zone, plant, "Tailler / entretenir : $name ($where)") }
            c.fertMonths.forEach { add(it, "fertilize", zone, plant, "Fertiliser : $name ($where)") }
            waterMonths(plant).forEach { add(it, "water", zone, plant, "Surveiller l'arrosage : $name ($where)") }
            plant.harvest.forEach { add(it, "harvest", zone, plant, "Récolter : $name ($where)") }
            if (plant.hardiness > -5) listOf(11, 12, 1, 2).forEach { add(it, "protect", zone, plant, "Protéger du gel : $name ($where)") }
        }
        for (zone in garden?.zones ?: emptyList()) {
            if (zone.type == "lawn" && zone.plantings.isEmpty()) {
                val g = genericCare("lawn")
                g.pruneMonths.forEach { add(it, "prune", zone, null, "Tondre : ${zoneLabel(zone).lowercase()}") }
                g.fertMonths.forEach { add(it, "fertilize", zone, null, "Fertiliser : ${zoneLabel(zone).lowercase()}") }
            }
            if (zone.type == "pond") add(10, "prune", zone, null, "Curer la mare par moitié : ${zoneLabel(zone).lowercase()}")
        }
        return months.mapIndexed { i, t -> CalendarMonth(i + 1, t) }
    }

    fun tasksForMonth(garden: Garden?, month: Int, plantsById: PlantById = defaultLookup()): List<CalendarTask> {
        val m = Math.floorMod(month - 1 + 12, 12) + 1
        return calendar(garden, plantsById)[m - 1].tasks
    }

    data class FrostAlert(val zoneId: String, val plantId: String, val text: String)

    /** Protections à prévoir pour une température minimale donnée (°C). */
    fun frostProtection(garden: Garden?, tminC: Double, plantsById: PlantById = defaultLookup()): List<FrostAlert> {
        val out = mutableListOf<FrostAlert>()
        for (e in entries(garden, plantsById)) {
            val plant = e.plant
            if (plant.hardiness <= tminC) continue
            val name = plant.commonName.ifEmpty { plant.id }
            val where = zoneLabel(e.zone).lowercase()
            val how = if (plant.category in listOf("aquatic", "perennial", "bulb")) "pailler épais le pied et couvrir d'un voile d'hivernage"
            else if (plant.category == "vegetable") "couvrir d'un voile ou d'une cloche"
            else if (plant.category == "tree" || plant.category == "fruit") "pailler le pied et protéger le tronc d'un voile ou de paille"
            else "pailler le pied et envelopper la plante d'un voile d'hivernage (rentrer si en pot)"
            out.add(FrostAlert(e.zone.id, plant.id, "$name ($where) supporte ${jsNum(plant.hardiness)} °C et il fera ${jsNum(tminC)} °C : $how."))
        }
        return out
    }

    private val EXISTING_CATEGORY = mapOf("tree" to "tree", "shrub" to "shrub", "hedge" to "hedge", "climber" to "climber", "perennial" to "perennial", "other" to "shrub")
    private val REMOVAL_TIP = mapOf(
        "tree" to "Pour un arbre, demandez conseil à un élagueur et renseignez-vous en mairie avant l'abattage (certains arbres sont protégés) ; l'automne et l'hiver conviennent le mieux.",
        "hedge" to "Arrachez la haie hors période de nidification (évitez avril à juillet) et dessouchez ou broyez les souches.",
        "shrub" to "Arrachez l'arbuste hors gel, en gardant une motte si vous voulez le replanter ailleurs.",
        "climber" to "Coupez les tiges à la base et laissez sécher avant de décrocher du support, pour ne pas abîmer le mur.",
        "perennial" to "Divisez ou levez les touffes à l'automne ou au printemps ; elles peuvent se replanter ailleurs.",
        "fence" to "Démontez la clôture panneau par panneau (poteaux scellés : prévoyez de quoi les déterrer) et triez les matériaux pour la déchetterie ou le réemploi.",
        "other" to "Retirez la plante hors gel, en gardant la motte si vous voulez la replanter.",
    )
    private val KIND_TIP = mapOf(
        "tree" to "Sous un arbre existant, privilégiez des plantes d'ombre ; ses racines sont proches du sol, plantez à distance du tronc.",
    )

    data class ExistingEntry(
        val id: String, val kind: String, val label: String, val plant: Plant?, val keep: Boolean, val now: List<String>,
        val pruning: String, val fertilizer: String, val watering: String, val notes: String,
        val pruneMonths: List<Int>, val fertMonths: List<Int>, val known: Boolean, val tips: List<String>, val userNotes: String? = null,
    )
    data class RemovalEntry(val id: String, val label: String, val kind: String, val tip: String)
    data class ExistingAdvice(val entries: List<ExistingEntry>, val toRemove: List<RemovalEntry>, val month: Int)

    /** Conseils pour les plantes déjà présentes (saison `month`, par défaut le mois courant). */
    fun existingAdvice(garden: Garden?, plantsById: PlantById = defaultLookup(), month: Int = LocalDate.now().monthValue): ExistingAdvice {
        val entries = mutableListOf<ExistingEntry>()
        val toRemove = mutableListOf<RemovalEntry>()
        for (e in garden?.existing ?: emptyList()) {
            getExistingKind(e.kind) ?: continue
            val label = existingLabel(e, plantsById)
            if (!e.keep) { toRemove.add(RemovalEntry(e.id, label, e.kind, REMOVAL_TIP[e.kind] ?: REMOVAL_TIP.getValue("other"))); continue }
            if (e.kind == "fence") continue
            val plant = e.plantId?.let { plantsById(it) }
            val c = if (plant != null) mergedCare(plant) else genericCare(EXISTING_CATEGORY[e.kind] ?: FALLBACK_CAT)
            val now = mutableListOf<String>()
            if (month in c.pruneMonths) now.add("Tailler / entretenir ce mois-ci : ${c.pruning}")
            if (month in c.fertMonths) now.add("Fertiliser ce mois-ci : ${c.fertilizer}")
            if (plant != null && ((plant.water == "high" && month in 4..10) || (plant.water != "low" && month in 6..8))) now.add("Surveiller l'arrosage en période chaude.")
            entries.add(ExistingEntry(
                e.id, e.kind, label, plant, true, now, c.pruning, c.fertilizer, c.watering, c.notes, c.pruneMonths, c.fertMonths, plant != null,
                KIND_TIP[e.kind]?.let { listOf(it) } ?: emptyList(), e.notes.ifEmpty { null },
            ))
        }
        return ExistingAdvice(entries, toRemove, month)
    }
}
