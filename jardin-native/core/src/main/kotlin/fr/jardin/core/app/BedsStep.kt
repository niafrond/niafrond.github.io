package fr.jardin.core.app

import fr.jardin.core.Ambiances
import fr.jardin.core.Bed
import fr.jardin.core.BedAlternative
import fr.jardin.core.BedOptions
import fr.jardin.core.DesignOptions
import fr.jardin.core.Garden
import fr.jardin.core.Maintenance
import fr.jardin.core.Massifs
import fr.jardin.core.Maybe
import fr.jardin.core.Plant
import fr.jardin.core.PolygonShape
import fr.jardin.core.Pricing
import fr.jardin.core.Catalog
import fr.jardin.core.Zone
import fr.jardin.core.bedModeOf
import fr.jardin.core.bounds
import fr.jardin.core.shapeArea
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull

/** Réglages des propositions de massifs. */
data class BedSettings(
    val coverage: Int = 50,
    val style: String = "mixed",
    val palette: String = "auto",
    val ambiance: String? = null,
    val budget: Double? = null,
)

/** Massif de la proposition (le moteur ne connaît pas verrou / variante / nom). */
data class BedEntry(
    val bed: Bed,
    val locked: Boolean = false,
    val variant: Int = 0,
    val label: String? = null,
    val designSeed: Double? = null,
)

/** Brouillon des propositions (en mémoire pour la session, reconstruit depuis les zones « auto » au rechargement). */
data class BedsDraft(
    val seed: Int = 1,
    val settings: BedSettings = BedSettings(),
    val beds: List<BedEntry> = emptyList(),
    /** id de massif -> id de zone validée. */
    val applied: Map<String, String> = emptyMap(),
)

/** Dernière validation annulable. */
data class BedsUndo(val zones: List<Zone>, val draft: BedsDraft)

data class BedsOutcome(val garden: Garden, val draft: BedsDraft, val message: String? = null, val kind: String = "info")

/** Étape 7 « Massifs » (port de jardin/ui/step-beds.js + beds-panel.js : logique pure). */
object BedsStep {
    const val MIN_AREA = 2.0
    const val NO_SPACE = "Pas de place libre : réduisez les zones ou le mobilier."
    const val NO_CONTOUR = "Dessinez d’abord le contour du terrain (étape Terrain)."
    const val NOTHING_TO_ADD = "Rien à ajouter : les massifs gardés couvrent déjà la part de vide demandée."

    val BED_COLORS = listOf("#e8744f", "#7a6bd6", "#d9a21b", "#2f9e8f", "#d6568a", "#4f8fd4", "#8fb339", "#c0703d", "#9a5fc4", "#3c9a5f", "#d9843a", "#4f7fb0")
    fun bedColor(i: Int): String = BED_COLORS[((i % BED_COLORS.size) + BED_COLORS.size) % BED_COLORS.size]

    data class Preset(val id: String, val label: String, val value: Int)
    val COVERAGE_PRESETS = listOf(Preset("few", "Quelques massifs", 25), Preset("balanced", "Équilibré", 50), Preset("lush", "Foisonnant", 80))
    data class Style(val id: String, val label: String, val emoji: String)
    val STYLES = listOf(Style("mixed", "Mixte", "🌿"), Style("borders", "Bordures", "▭"), Style("islands", "Îlots", "🏝"))
    data class Palette(val id: String, val label: String, val color: String)
    val PALETTES = listOf(
        Palette("auto", "Auto", "#d9a21b"), Palette("chaud", "Chaude", "#e8744f"), Palette("froid", "Froide", "#5b7fd6"),
        Palette("pastel", "Pastel", "#f3c6d8"), Palette("blanc", "Blanche", "#f6f6ef"), Palette("vif", "Vive", "#e0307a"),
    )
    val SUN_TEXT = mapOf("full" to "☀️ plein soleil", "partial" to "⛅ mi-ombre", "shade" to "☁️ ombre")
    val MONTH_LETTERS = listOf("J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D")

    fun fmt1(n: Double): String { val v = Math.round(n * 10) / 10.0; return (if (v == Math.floor(v)) v.toLong().toString() else v.toString()).replace('.', ',') }

    fun hasContour(g: Garden) = g.boundary.size >= 3 && g.boundaryClosed

    fun manualZones(g: Garden): List<Zone> = g.zones.filter { !it.auto }

    /** Zones des massifs de la liste (aperçu sur le plan ou jardin de calcul). */
    fun bedZones(beds: List<Bed>, plants: List<Plant>? = null): List<Zone> =
        Massifs.bedsToZones(Garden(id = "tmp"), beds, null, plants, 0)

    /** Jardin avec ses zones manuelles + les massifs donnés. */
    fun gardenWith(g: Garden, beds: List<Bed>, plants: List<Plant>? = null): Garden = g.copy(zones = manualZones(g) + bedZones(beds, plants))

    fun maintLevel(g: Garden): String = Maintenance.levelForZone(g, null)

    fun nameOf(e: BedEntry, i: Int): String {
        e.label?.takeIf { it.isNotEmpty() }?.let { return it }
        val a = Ambiances.getAmbiance(e.bed.ambiance)
        return if (a != null) "Massif ${a.label.lowercase()} n°${i + 1}" else "Massif n°${i + 1}"
    }

    // ------------------------------------------------------------ synchronisation avec les zones
    private fun bedFromZone(z: Zone): Bed? {
        val shape = z.shape as? PolygonShape ?: return null
        val pts = shape.points
        val area = Math.round(shapeArea(shape) * 10) / 10.0
        val bb = bounds(pts)
        val info = z.autoInfo as? JsonObject
        return Bed(
            id = z.id.removePrefix("z_"), role = (info?.get("role") as? JsonPrimitive)?.contentOrNull ?: "ilot", shape = shape,
            areaM2 = area, widthM = Math.round(minOf(bb.width, bb.height) * 10) / 10.0, sunLevel = null,
            why = (info?.get("why") as? JsonPrimitive)?.contentOrNull ?: "", plantings = z.plantings, summary = null, plantsWhy = "",
            alternatives = emptyList(), ambiance = z.ambiance, seed = (info?.get("seed") as? JsonPrimitive)?.doubleOrNull,
        )
    }

    /** Suit les modifications faites dans l'étape Zones (forme, essences, nom, suppression) ; affiche les zones auto comme massifs validés. */
    fun sync(garden: Garden, d: BedsDraft): BedsDraft {
        val applied = d.applied.toMutableMap()
        val beds = ArrayList<BedEntry>()
        for (e in d.beds) {
            val zid = applied[e.bed.id]
            if (zid == null) { beds.add(e); continue }
            val z = garden.zones.firstOrNull { it.id == zid }
            if (z == null || !z.auto) { applied.remove(e.bed.id); continue }
            var b = e.bed
            val sh = z.shape
            if (sh is PolygonShape) b = b.copy(shape = PolygonShape(sh.points), areaM2 = Math.round(shapeArea(sh) * 10) / 10.0)
            beds.add(e.copy(bed = b.copy(plantings = z.plantings, ambiance = z.ambiance), label = z.label))
        }
        for (z in garden.zones) {
            if (!z.auto || applied.containsValue(z.id)) continue
            val b = bedFromZone(z) ?: continue
            if (beds.none { it.bed.id == b.id }) { beds.add(BedEntry(b, label = z.label)); applied[b.id] = z.id }
        }
        return d.copy(beds = beds, applied = applied)
    }

    // ------------------------------------------------------------ totaux
    fun totalArea(d: BedsDraft) = d.beds.sumOf { it.bed.areaM2 }
    fun totalCost(d: BedsDraft) = d.beds.sumOf { it.bed.summary?.costEur?.takeIf { c -> c.isFinite() } ?: 0.0 }

    fun freeArea(g: Garden, d: BedsDraft, plants: List<Plant>? = null): Double =
        try { Massifs.freeSpace(gardenWith(g, d.beds.map { it.bed }, plants), 0.25).freeArea } catch (_: Exception) { 0.0 }

    fun legend(g: Garden, d: BedsDraft, plants: List<Plant>? = null): String {
        if (!hasContour(g)) return NO_CONTOUR
        val n = d.beds.size
        return "Vide à planter : ${fmt1(freeArea(g, d, plants))} m²" + if (n > 0) " · $n massif${if (n > 1) "s" else ""} sur ${fmt1(totalArea(d))} m²" else ""
    }

    fun totalLine(d: BedsDraft): String {
        val n = d.beds.size
        return if (n == 0) "" else "$n massif${if (n > 1) "s" else ""} · ${fmt1(totalArea(d))} m² · ≈ ${Pricing.formatEuro(totalCost(d), 0)}"
    }

    fun allApplied(d: BedsDraft) = d.beds.isNotEmpty() && d.beds.all { it.bed.id in d.applied }

    /** Mois de floraison d'un massif : résumé du moteur, sinon calculé depuis les essences. */
    fun bloomMonths(b: Bed): List<Int> {
        b.summary?.bloomMonths?.takeIf { it.isNotEmpty() }?.let { return it }
        return b.plantings.flatMap { Catalog.getPlant(it.plantId)?.bloom ?: emptyList() }.toSortedSet().toList()
    }

    fun flowerColors(b: Bed): List<String> {
        val out = ArrayList<String>()
        for (pl in b.plantings) {
            val c = PlantsStep.hexOk(Catalog.getPlant(pl.plantId)?.flowerColor)?.lowercase()
            if (c != null && c !in out) out.add(c)
        }
        return out
    }

    fun monthsText(months: Collection<Int>): String {
        val t = PlantsStep.formatBloom(months)
        return if (t.isEmpty()) "aucune floraison" else t
    }

    // ------------------------------------------------------------ calcul
    private fun designOpts(g: Garden, s: BedSettings, seed: Number, budget: Double?, ambiance: Maybe<String>) = DesignOptions(
        seed = seed, ambiance = ambiance, maintenance = Maybe(maintLevel(g)), budget = budget, palette = s.palette,
    )

    /** « Calculer les massifs » / « Autre proposition » : garde les massifs verrouillés, remplit le reste. */
    fun compute(garden: Garden, d0: BedsDraft, another: Boolean = false, plants: List<Plant>? = null): BedsOutcome {
        if (!hasContour(garden)) return BedsOutcome(garden, d0, NO_CONTOUR, "warn")
        var d = if (another) d0.copy(seed = d0.seed + 1) else d0
        val s = d.settings
        return try {
            val locked = d.beds.filter { it.locked }
            val lockedBeds = locked.map { it.bed }
            val base = gardenWith(garden, lockedBeds, plants)
            val free0 = Massifs.freeSpace(garden.copy(zones = manualZones(garden)), 0.25).freeArea
            val freeBase = Massifs.freeSpace(base, 0.25).freeArea
            val wanted = (s.coverage / 100.0).coerceIn(0.1, 1.0) * free0
            val remaining = maxOf(0.0, wanted - lockedBeds.sumOf { it.areaM2 })
            var shapes = emptyList<Bed>()
            if (freeBase >= MIN_AREA && remaining >= MIN_AREA * 0.9) {
                val cov = (remaining / freeBase).coerceIn(0.02, 1.0)
                shapes = Massifs.proposeBeds(base, BedOptions(
                    seed = d.seed, coverage = cov, style = s.style, minArea = MIN_AREA, ambiance = s.ambiance, maintenance = maintLevel(garden),
                    palette = s.palette, plants = plants, design = false,
                ))
            }
            if (shapes.isEmpty() && locked.isEmpty()) return BedsOutcome(garden, d.copy(beds = emptyList()), NO_SPACE, "warn")
            val totalShape = shapes.sumOf { it.areaM2 }.takeIf { it > 0 } ?: 1.0
            val lockedCost = lockedBeds.sumOf { it.summary?.costEur ?: 0.0 }
            val budgetLeft = s.budget?.let { maxOf(0.0, it - lockedCost) }
            val fresh = shapes.map { b ->
                val r = Massifs.designBed(base, b, designOpts(garden, s, d.seed, budgetLeft?.let { it * (b.areaM2 / totalShape) }, Maybe(s.ambiance)).copy(plants = plants))
                BedEntry(b.copy(plantings = r.plantings, summary = r.summary, plantsWhy = r.why, alternatives = r.alternatives, ambiance = s.ambiance, seed = d.seed.toDouble()))
            }
            d = d.copy(beds = locked + fresh)
            BedsOutcome(garden, d, if (d.beds.isEmpty()) NO_SPACE else if (fresh.isEmpty()) NOTHING_TO_ADD else null, if (d.beds.isEmpty()) "warn" else "info")
        } catch (e: Exception) {
            BedsOutcome(garden, d, "Le calcul a échoué : ${e.message ?: "erreur"}", "warn")
        }
    }

    private fun replace(d: BedsDraft, id: String, f: (BedEntry) -> BedEntry) = d.copy(beds = d.beds.map { if (it.bed.id == id) f(it) else it })

    fun toggleLock(d: BedsDraft, id: String) = replace(d, id) { it.copy(locked = !it.locked) }
    fun remove(d: BedsDraft, id: String) = d.copy(beds = d.beds.filter { it.bed.id != id })
    fun setSettings(d: BedsDraft, s: BedSettings) = d.copy(settings = s)

    fun altLabel(e: BedEntry): String = if (e.variant > 0) e.bed.alternatives.getOrNull(e.variant - 1)?.label ?: "" else ""

    private fun redesign(garden: Garden, d: BedsDraft, e: BedEntry, ambiance: String?, bump: Boolean, plants: List<Plant>?): BedEntry {
        val seed = if (bump) (e.designSeed ?: d.seed.toDouble()) + 7 else e.designSeed ?: d.seed.toDouble()
        val bedsTotal = maxOf(1.0, totalArea(d))
        val budget = d.settings.budget?.let { it * (e.bed.areaM2 / bedsTotal) }
        val r = Massifs.designBed(garden.copy(zones = manualZones(garden)), e.bed, designOpts(garden, d.settings, seed, budget, Maybe(ambiance)).copy(plants = plants))
        return e.copy(bed = e.bed.copy(plantings = r.plantings, summary = r.summary, plantsWhy = r.why, alternatives = r.alternatives, ambiance = ambiance), variant = 0, designSeed = seed)
    }

    /** « 🎲 Autre combinaison » : variante suivante du moteur, sinon nouveau tirage. */
    fun reshuffle(garden: Garden, d: BedsDraft, id: String, plants: List<Plant>? = null): BedsDraft = replace(d, id) { e ->
        val alts: List<BedAlternative> = e.bed.alternatives
        val next = e.variant + 1
        if (next <= alts.size) {
            val a = alts[next - 1]
            e.copy(bed = e.bed.copy(plantings = a.plantings, summary = a.summary, plantsWhy = a.why, ambiance = a.ambiance ?: e.bed.ambiance), variant = next, label = null)
        } else try { redesign(garden, d, e, e.bed.ambiance, true, plants) } catch (_: Exception) { e }
    }

    /** « 🎨 Ambiance » d'un massif : plantes redessinées. */
    fun setAmbiance(garden: Garden, d: BedsDraft, id: String, ambiance: String?, plants: List<Plant>? = null): BedsDraft = replace(d, id) { e ->
        try { redesign(garden, d, e, ambiance, false, plants).copy(label = null) } catch (_: Exception) { e }
    }

    // ------------------------------------------------------------ validation / annulation / forme
    /** « ✔ Valider ces massifs » : remplace les zones automatiques par les massifs de la proposition. */
    fun validate(garden: Garden, d: BedsDraft, plants: List<Plant>? = null): Triple<Garden, BedsDraft, BedsUndo> {
        val undo = BedsUndo(garden.zones, d)
        val kept = manualZones(garden)
        val beds = d.beds.map { it.bed }
        val fresh = Massifs.bedsToZones(garden.copy(zones = kept), beds, null, plants, 0).mapIndexed { i, z ->
            val prev = garden.zones.firstOrNull { it.id == d.applied[beds[i].id] }
            if (prev != null) z.copy(label = prev.label.ifEmpty { z.label }, notes = prev.notes, maintenance = prev.maintenance ?: z.maintenance) else z
        }
        val applied = LinkedHashMap<String, String>()
        val entries = d.beds.mapIndexed { i, e -> applied[e.bed.id] = fresh[i].id; e.copy(label = fresh[i].label) }
        return Triple(garden.copy(zones = kept + fresh), d.copy(beds = entries, applied = applied), undo)
    }

    fun validatedMessage(n: Int) = "$n massif${if (n > 1) "s" else ""} ajouté${if (n > 1) "s" else ""} au plan : retrouvez-les dans l’étape Essences."

    fun undoValidation(garden: Garden, u: BedsUndo): Pair<Garden, BedsDraft> = garden.copy(zones = u.zones) to u.draft

    /** « ✏️ Modifier la forme » : le massif devient une zone ordinaire (à modifier à l'étape Zones). */
    fun editShape(garden: Garden, d: BedsDraft, id: String, plants: List<Plant>? = null): Pair<Garden, BedsDraft> {
        val i = d.beds.indexOfFirst { it.bed.id == id }
        if (i < 0) return garden to d
        val e = d.beds[i]
        val zid = d.applied[id]
        val prev = garden.zones.firstOrNull { it.id == zid }
        val zones = if (prev != null) garden.zones.map { if (it.id == prev.id) it.copy(auto = false, autoInfo = null) else it }
        else {
            val z = Massifs.bedsToZones(garden, listOf(e.bed), null, plants, i)[0]
            garden.zones + z.copy(label = nameOf(e, i), auto = false, autoInfo = null)
        }
        return garden.copy(zones = zones) to d.copy(beds = d.beds.filter { it.bed.id != id }, applied = d.applied - id)
    }

    fun setBedMode(g: Garden, mode: String): Garden = g.copy(context = g.context.copy(bedMode = if (mode == "auto") "auto" else "manual"))
    fun isAuto(g: Garden) = bedModeOf(g) == "auto"
}
