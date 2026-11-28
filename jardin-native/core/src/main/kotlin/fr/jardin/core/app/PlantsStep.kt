package fr.jardin.core.app

import fr.jardin.core.Catalog
import fr.jardin.core.Garden
import fr.jardin.core.Maintenance
import fr.jardin.core.Maybe
import fr.jardin.core.Plant
import fr.jardin.core.PlantFilters
import fr.jardin.core.Planting
import fr.jardin.core.Pricing
import fr.jardin.core.Recommend
import fr.jardin.core.RecommendOptions
import fr.jardin.core.Recommendation
import fr.jardin.core.SelectionOptions
import fr.jardin.core.Zone
import fr.jardin.core.checkSpacing
import fr.jardin.core.estimatePondDepth
import fr.jardin.core.fitQuantities
import fr.jardin.core.formatSpacing
import fr.jardin.core.getZoneType
import fr.jardin.core.pondArea
import fr.jardin.core.pondConcerned
import fr.jardin.core.pondDepth
import fr.jardin.core.pondFit
import fr.jardin.core.pondTag
import fr.jardin.core.pondTreeRule
import fr.jardin.core.shapeArea
import fr.jardin.core.zoneLayout
import fr.jardin.core.Ambiances
import fr.jardin.core.plantHeightKind
import fr.jardin.core.applyHeight
import fr.jardin.core.formatHeight
import fr.jardin.core.parseHeight

/** Ligne de la liste des essences conseillées. */
data class PlantRow(
    val rec: Recommendation,
    val statusLabel: String,
    val bloom: String,
    val priceLabel: String?,
    val effort: Int,
    val maintenanceOk: Boolean,
    val maintenanceText: String,
    val typical: Boolean,
    val alreadyIn: Boolean,
    val suggestedQty: Int,
)

/** Mare : résumé, essences écartées, essences choisies devenues inadaptées. */
data class PondReport(
    val area: Double, val depth: Int, val summary: String, val hint: String,
    val excluded: List<Pair<Plant, List<String>>>, val badPlantings: List<Planting>, val alert: String?,
)

/** Ligne d'essence choisie (quantité, hauteur, densité). */
data class ChosenRow(val planting: Planting, val plant: Plant?, val lineTotal: String, val density: String, val overMax: Boolean, val customHeight: Boolean, val heightCm: String, val heightState: String)

/** Résultat de la saisie d'une hauteur. */
data class HeightEdit(val planting: Planting, val note: String, val ok: Boolean)

/** Étape 8 « Essences » (port de jardin/ui/step-plants.js : logique pure). */
object PlantsStep {
    val STATUS = mapOf("ideal" to "Idéale", "possible" to "Possible", "discouraged" to "Déconseillée")
    val SUNL = mapOf("full" to "soleil", "partial" to "mi-ombre", "shade" to "ombre")
    val WATER = mapOf("low" to "peu d’eau", "medium" to "eau moyenne", "high" to "beaucoup d’eau")
    val FOLIAGE = listOf("" to "Tous feuillages", "deciduous" to "Caduc", "evergreen" to "Persistant", "semi" to "Semi-persistant")
    val CHECKS = listOf("melliferous" to "Mellifère", "edible" to "Comestible", "lowMaintenance" to "Faible entretien", "lowWater" to "Peu d’eau", "nonToxic" to "Non toxique", "nonInvasive" to "Non invasive")
    const val PAGE = 30
    val NO_PLANT = setOf("pool", "path")
    val MONTHS = listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")
    val CAT_EMOJI = mapOf(
        "tree" to "🌳", "shrub" to "🌿", "hedge" to "🌲", "fruit" to "🍎", "climber" to "🌱", "perennial" to "🌸", "groundcover" to "☘️",
        "grass" to "🌾", "bulb" to "🌷", "aquatic" to "🪷", "vegetable" to "🥕", "lawn" to "🟩",
    )
    const val DEFAULT_TINT = "#7fb069"
    const val NO_ZONE_TITLE = "Aucune zone à garnir"
    const val NO_ZONE_TEXT = "Dessinez d’abord des zones sur le plan pour choisir leurs essences."
    const val EMPTY_LIST = "Aucune essence ne correspond. Assouplissez les filtres ou affichez les déconseillées."

    private val HEX = Regex("^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$")
    fun hexOk(c: String?): String? = c?.trim()?.takeIf { HEX.matches(it) }

    /** Nom français approximatif d'une couleur #hex (libellés accessibles). */
    fun colorName(hex: String?): String {
        var c = hexOk(hex) ?: return "inconnue"
        c = c.substring(1)
        if (c.length == 3) c = c.map { "$it$it" }.joinToString("")
        val r = c.substring(0, 2).toInt(16) / 255.0; val g = c.substring(2, 4).toInt(16) / 255.0; val b = c.substring(4, 6).toInt(16) / 255.0
        val mx = maxOf(r, g, b); val mn = minOf(r, g, b); val l = (mx + mn) / 2; val d = mx - mn
        val sat = if (d == 0.0) 0.0 else d / (1 - Math.abs(2 * l - 1))
        if (l < 0.12) return "noir"
        if (l > 0.93) return "blanc"
        if (sat < 0.13) return if (l > 0.7) "gris clair" else "gris"
        var hue = 0.0
        if (d != 0.0) {
            hue = if (mx == r) ((g - b) / d) % 6 else if (mx == g) (b - r) / d + 2 else (r - g) / d + 4
            hue = (hue * 60 + 360) % 360
        }
        return when {
            hue < 15 || hue >= 345 -> if (l > 0.72) "rose pâle" else if (l < 0.3) "bordeaux" else "rouge"
            hue < 40 -> if (l < 0.38) "brun" else if (l > 0.75) "pêche" else "orange"
            hue < 68 -> if (l > 0.8) "crème" else if (l < 0.35) "olive" else "jaune"
            hue < 95 -> if (l > 0.65) "vert tendre" else "vert-jaune"
            hue < 165 -> if (l < 0.3) "vert foncé" else if (l > 0.7) "vert clair" else "vert"
            hue < 200 -> "turquoise"
            hue < 255 -> if (l > 0.75) "bleu clair" else "bleu"
            hue < 290 -> if (l > 0.72) "lilas" else "violet"
            hue < 330 -> if (sat > 0.5 && l < 0.7) "magenta" else "rose"
            else -> if (l < 0.35) "bordeaux" else "rose"
        }
    }

    /** « mars à juin, septembre » à partir d'une liste de mois (1–12). */
    fun formatBloom(months: Collection<Int>?): String {
        val ms = (months ?: emptyList()).filter { it in 1..12 }.toSortedSet().toList()
        if (ms.isEmpty()) return ""
        val groups = ArrayList<IntArray>()
        for (m in ms) { val last = groups.lastOrNull(); if (last != null && m == last[1] + 1) last[1] = m else groups.add(intArrayOf(m, m)) }
        return groups.joinToString(", ") { (a, b) -> if (a == b) MONTHS[a - 1] else if (b == a + 1) "${MONTHS[a - 1]} et ${MONTHS[b - 1]}" else "${MONTHS[a - 1]} à ${MONTHS[b - 1]}" }
    }

    fun fmtNum(n: Double): String { val v = Math.round(n * 10) / 10.0; return (if (v == Math.floor(v)) v.toLong().toString() else v.toString()).replace('.', ',') }

    /** « ≈ 12 € / plant, pot 3 L » ; null si pas de prix. */
    fun priceLabel(p: Plant?): String? {
        val e = p?.priceEur ?: return null
        val unit = Pricing.UNIT_LABEL[p.priceUnit] ?: "plant"
        return "≈ ${Pricing.formatPrice(e)} / $unit${p.priceNote?.takeIf { it.isNotEmpty() }?.let { ", $it" } ?: ""}"
    }

    /** Deux teintes du repli en pastille de couleur (fleur / feuillage). */
    fun thumbColors(p: Plant): Pair<String, String> {
        val fl = hexOk(p.flowerColor); val fo = hexOk(p.foliageColor)
        return (fl ?: fo ?: DEFAULT_TINT) to (fo ?: fl ?: DEFAULT_TINT)
    }

    fun categoryEmoji(p: Plant): String = CAT_EMOJI[p.category] ?: "🌱"

    fun qty(n: Int?): Int = if (n != null && n > 0) n else 1
    fun countOf(pl: Planting): Int = qty(pl.count ?: pl.quantity)

    fun safeQty(p: Plant, z: Zone): Int = try { Recommend.suggestQuantity(p, z) } catch (_: Exception) { 1 }

    fun zoneLabel(z: Zone): String {
        val t = getZoneType(z.type)
        val e = Ambiances.getAmbiance(zoneAmbiance(z))?.emoji
        return "${t?.let { it.icon + " " } ?: ""}${z.label.ifEmpty { t?.label ?: "Zone" }}${e?.let { " $it" } ?: ""}${if (z.auto) " ✨" else ""}"
    }

    /** Ambiance effective d'une zone : enregistrée, sinon celle que son nom laisse deviner. */
    fun zoneAmbiance(z: Zone?): String? = z?.ambiance ?: try { Ambiances.detectAmbiance(z?.label) } catch (_: Exception) { null }

    fun zoneInfo(z: Zone): String {
        val a = try { shapeArea(z.shape) } catch (_: Exception) { 0.0 }
        val t = getZoneType(z.type)
        return "${t?.label ?: z.type} · ${String.format(java.util.Locale.ROOT, if (a < 10) "%.1f" else "%.0f", a).replace('.', ',')} m²"
    }

    /** Liste des essences conseillées (filtres, recherche, plafond d'entretien, règles de mare). */
    fun list(garden: Garden, z: Zone, filters: PlantFilters, query: String, showDiscouraged: Boolean): List<Recommendation> {
        var recs = try { Recommend.recommendForZone(garden, z, RecommendOptions(includeDiscouraged = showDiscouraged, filters = filters)) } catch (_: Exception) { emptyList() }
        if (filters.lowMaintenance) {
            val cap = when (Maintenance.levelForZone(garden, z)) { "none" -> 1; "low" -> 2; else -> 3 }
            recs = recs.filter { Maintenance.plantEffort(it.plant) <= cap }
        }
        if (query.isNotBlank()) {
            val ids = try { Catalog.searchPlants(query).map { it.id }.toSet() } catch (_: Exception) { null }
            if (ids != null) recs = recs.filter { it.plant.id in ids }
        }
        if (z.type == "pond") recs = recs.filter { !pondConcerned(it.plant) || pondFit(it.plant, z).ok }
        return recs
    }

    fun row(garden: Garden, z: Zone, r: Recommendation): PlantRow {
        val p = r.plant
        val fit = Maintenance.fitsMaintenance(p, Maintenance.levelForZone(garden, z))
        val typical = Ambiances.isTypical(p, zoneAmbiance(z)).let { zoneAmbiance(z) != null && it }
        return PlantRow(
            r, STATUS[r.status] ?: r.status, formatBloom(p.bloom), priceLabel(p), Maintenance.plantEffort(p), fit.ok, fit.text, typical,
            z.plantings.any { it.plantId == p.id }, safeQty(p, z),
        )
    }

    /** Raisons d'une essence déjà choisie (pour la fiche), même déconseillée. */
    fun reasonFor(garden: Garden, z: Zone, plantId: String): Recommendation? = try {
        Recommend.recommendForZone(garden, z, RecommendOptions(includeDiscouraged = true)).firstOrNull { it.plant.id == plantId }
    } catch (_: Exception) { null }

    fun addPlant(z: Zone, plantId: String, count: Int): Zone = z.copy(plantings = z.plantings + Planting(plantId, count = qty(count)))
    fun removePlant(z: Zone, index: Int): Zone = z.copy(plantings = z.plantings.filterIndexed { i, _ -> i != index })
    fun removeById(z: Zone, plantId: String): Zone = z.copy(plantings = z.plantings.filter { it.plantId != plantId })
    fun setCount(z: Zone, index: Int, n: Int): Zone = z.copy(plantings = z.plantings.mapIndexed { i, pl -> if (i == index) pl.copy(count = maxOf(1, n), quantity = null) else pl })

    /** Lignes « Dans cette zone » : quantité, coût de ligne, densité (« 60 cm entre plants ; 3 / 12 maximum »), hauteur. */
    fun chosenRows(garden: Garden, z: Zone): List<ChosenRow> {
        val lay = try { zoneLayout(garden, z, Catalog::getPlant) } catch (_: Exception) { null }
        return z.plantings.mapIndexed { i, pl ->
            val p = Catalog.getPlant(pl.plantId)
            val mx = lay?.maxima?.getOrNull(i)
            val cnt = countOf(pl)
            val dens = if (p != null) "${formatSpacing(p)} entre plants${if (mx != null && p.category != "lawn") " ; $cnt / $mx maximum" else ""}" else ""
            val gc = Pricing.gardenCost(garden.copy(zones = listOf(z.copy(plantings = listOf(pl)))), Catalog::getPlant)
            val line = if (gc.total != 0.0) "≈ ${Pricing.formatEuro(gc.total, 0)}" else if (gc.unknownCount > 0) "sans prix" else ""
            val def = p?.heightAdult?.takeIf { it > 0 } ?: 0.5
            val custom = (pl.height ?: 0.0) > 0 && Math.abs((pl.height ?: 0.0) - def) >= 0.005
            ChosenRow(pl, p, line, dens, mx != null && cnt > mx, custom, if (custom) fr.jardin.core.heightToCm(pl.height!!) else "",
                if (custom) "personnalisée · catalogue ${formatHeight(def)}" else "catalogue")
        }
    }

    /** Saisie d'une hauteur (cm ou m) : vide = valeur par défaut ; hors bornes = erreur ou valeur ramenée. */
    fun editHeight(p: Plant, pl: Planting, raw: String): HeightEdit {
        val def = p.heightAdult.takeIf { it > 0 } ?: 0.5
        val text = raw.trim()
        if (text.isEmpty()) return HeightEdit(pl.copy(height = null), "", true)
        val kind = plantHeightKind(p)
        val m = parseHeight(text)
        val a = applyHeight(pl.height, kind, m, def)
        if (a.result.invalid) return HeightEdit(pl, a.result.message, false)
        return HeightEdit(pl.copy(height = a.stored), if (a.result.clamped) a.result.message else "", true)
    }

    fun resetHeight(pl: Planting): Planting = pl.copy(height = null)

    /** Avertissements d'espacement de la zone ; `fixable` = proposer « Ajuster automatiquement ». */
    fun spacingWarnings(garden: Garden, z: Zone) = try { checkSpacing(garden, z, Catalog::getPlant) } catch (_: Exception) { emptyList() }
    fun spacingFixable(list: List<fr.jardin.core.SpacingWarning>): Boolean = list.any { it.kind == "surdensite" || it.kind == "arbres-proches" || it.kind == "pied-arbre" }
    fun fitZone(garden: Garden, z: Zone): Zone = z.copy(plantings = fitQuantities(z, z.plantings, Catalog::getPlant, fr.jardin.core.PackOptions(garden = garden)))

    fun coherence(garden: Garden) = try { Recommend.checkCoherence(garden) } catch (_: Exception) { emptyList() }

    // ---------- budget ----------
    data class Budget(val main: String, val sub: String, val over: Boolean)
    fun budget(garden: Garden, z: Zone, max: Double?): Budget {
        val gc = Pricing.gardenCost(garden, Catalog::getPlant)
        val u = gc.unknownCount
        val main = "Budget estimé ≈ ${Pricing.formatEuro(gc.total, 0)}${if (u > 0) " · $u essence${if (u > 1) "s" else ""} sans prix" else ""}"
        val zc = gc.byZone.firstOrNull { it.zoneId == z.id }
        val sub = "Cette zone ≈ ${Pricing.formatEuro(zc?.total ?: 0.0, 0)} · prix moyens en jardinerie, à titre indicatif"
        return Budget(main, sub, max != null && max > 0 && gc.total > max)
    }
    fun parseBudget(raw: String): Double? = raw.trim().replace(',', '.').toDoubleOrNull()?.takeIf { it > 0 && it.isFinite() }

    // ---------- mare ----------
    fun fmtArea(a: Double): String = "${String.format(java.util.Locale.ROOT, if (a < 10) "%.1f" else "%.0f", a).replace('.', ',')} m²"

    fun pond(garden: Garden, z: Zone): PondReport? {
        if (z.type != "pond") return null
        val area = pondArea(z); val depth = pondDepth(z)
        val all = try { Recommend.recommendForZone(garden, z, RecommendOptions(includeDiscouraged = true, includeForbidden = true)) } catch (_: Exception) { emptyList() }
        val tagged = all.filter { pondTag(it.plant) != null || (pondTreeRule(it.plant) != null && "pond" in it.plant.zones) || pondTreeRule(it.plant) == "willow" }
        val out = tagged.map { it.plant to pondFit(it.plant, z) }.filter { !it.second.ok }
        val okN = tagged.size - out.size
        val summary = "Mare de ${fmtArea(area)}, profondeur $depth cm : $okN essence${if (okN > 1) "s" else ""} adaptée${if (okN > 1) "s" else ""}, ${out.size} écartée${if (out.size > 1) "s" else ""}."
        val hint = if ((z.depth ?: 0.0) > 0) "Valeur saisie (estimation d’après la surface : ${estimatePondDepth(area)} cm)." else "Valeur estimée d’après la surface : modifiez-la si vous la connaissez."
        val bad = z.plantings.filter { pl -> Catalog.getPlant(pl.plantId)?.let { pondConcerned(it) && !pondFit(it, z).ok } == true }
        val alert = if (bad.isEmpty()) null else {
            val names = bad.mapNotNull { Catalog.getPlant(it.plantId)?.commonName }
            "⚠️ La mare a changé (${fmtArea(area)}, $depth cm) : ${names.joinToString(", ")} ne ${if (bad.size > 1) "conviennent" else "convient"} plus."
        }
        return PondReport(area, depth, summary, hint, out.map { it.first to it.second.reasons }, bad, alert)
    }

    /** Profondeur de mare saisie : null = valeur estimée ; erreur si hors 10–500. */
    fun setPondDepth(z: Zone, raw: String): Pair<Zone, String?> {
        val s = raw.trim().replace(',', '.')
        if (s.isEmpty()) return z.copy(depth = null) to null
        val n = s.toDoubleOrNull()?.let { Math.round(it) }
        if (n == null || n < 10 || n > 500) return z to "Profondeur entre 10 et 500 cm."
        return z.copy(depth = n.toDouble()) to null
    }
    fun removeBadPond(z: Zone, rep: PondReport): Zone = z.copy(plantings = z.plantings.filter { it !in rep.badPlantings })

    // ---------- « Surprends-moi » ----------
    fun selectionFor(garden: Garden, z: Zone, seed: Any, ambiance: String?, maintenance: String?, budget: Double?): List<Planting> {
        val sel = try {
            Recommend.suggestSelection(garden, z, SelectionOptions(seed = seed, ambiance = Maybe(ambiance), maintenance = maintenance?.let { Maybe(it) }, budget = budget))
        } catch (_: Exception) { emptyList() }
        return sel.map { Planting(it.plantId, count = countOf(it)) }
    }

    data class Proposal(val key: String, val snapshot: Map<String, List<Planting>>)
    data class ProposalResult(val garden: Garden?, val proposal: Proposal?, val message: String, val summary: String = "")

    /**
     * Applique « Surprends-moi » à `targets` (ids de zones) avec les ambiances demandées. `again` : on repart du snapshot de la
     * proposition précédente (autre proposition). `max` : budget global réparti selon la surface.
     */
    fun propose(
        garden: Garden, key: String, targets: List<String>, ambiances: Map<String, String?>, maintenance: String?, max: Double?,
        round: Int, baseSeed: Long, previous: Proposal?,
    ): ProposalResult {
        val again = previous != null && previous.key == key
        var g = garden
        // ambiance choisie pour chaque zone, niveau d'entretien (zone seule : sur la zone, sinon sur le jardin)
        g = g.copy(zones = g.zones.map { z -> if (z.id in targets && ambiances.containsKey(z.id)) z.copy(ambiance = ambiances[z.id]) else z })
        if (maintenance != null) {
            g = if (targets.size == 1) g.copy(zones = g.zones.map { if (it.id in targets) it.copy(maintenance = maintenance) else it })
            else g.copy(context = g.context.copy(maintenance = maintenance))
        }
        val zones = g.zones.filter { it.id in targets }
        if (zones.isEmpty()) return ProposalResult(null, previous, "Aucune zone à garnir.")
        val snapshot = if (again) previous!!.snapshot else zones.associate { it.id to it.plantings.map { p -> p.copy() } }
        val totalArea = zones.sumOf { try { shapeArea(it.shape) } catch (_: Exception) { 0.0 } }.takeIf { it > 0 } ?: 1.0
        val results = zones.map { z ->
            val a = try { shapeArea(z.shape) } catch (_: Exception) { 0.0 }
            val share = if (max != null) max * (if (zones.size == 1) 1.0 else a / totalArea) else null
            z to selectionFor(g, z, baseSeed + round + 1, z.ambiance, Maintenance.levelForZone(g, z), share)
        }
        if (results.none { it.second.isNotEmpty() }) {
            return ProposalResult(null, previous, "Aucune proposition possible pour " + (if (zones.size == 1) "cette zone." else "ces zones."))
        }
        val byId = results.associate { it.first.id to it.second }
        g = g.copy(zones = g.zones.map { z ->
            if (z.id !in byId) z else {
                val n = byId.getValue(z.id)
                val base = snapshot[z.id]?.map { it.copy() } ?: z.plantings
                z.copy(plantings = if (n.isNotEmpty()) n else base)
            }
        })
        val sm = Pricing.summarizeGarden(g, Catalog::getPlant)
        val spacingOk = zones.all { z -> val cur = g.zones.first { it.id == z.id }; !spacingFixable(spacingWarnings(g, cur)) }
        val parts = sm.text.split(", ").toMutableList()
        val ids = zones.map { g.zones.first { q -> q.id == it.id }.ambiance }.distinct()
        var amb: String? = null
        if (ids.size == 1 && ids[0] != null) Ambiances.getAmbiance(ids[0])?.let { amb = "ambiance ${it.label.lowercase()}" }
        else if (ids.size > 1 && ids.any { it != null }) amb = "ambiances variées selon les zones"
        if (amb != null) parts.add(1.coerceAtMost(parts.size), amb!!)
        val lv = zones.map { Maintenance.levelForZone(g, g.zones.first { q -> q.id == it.id }) }.distinct()
        val mt = if (lv.size == 1) levelPhrase(lv[0]) else if (lv.any { it != "green" }) "entretien variable selon les zones" else null
        if (!mt.isNullOrEmpty()) parts.add((if (amb != null) 2 else 1).coerceAtMost(parts.size), mt)
        val summary = parts.joinToString(" · ") + (if (spacingOk) " · espacements respectés" else "") +
            (if (max != null && sm.total > max) " (au-dessus du budget de ${Pricing.formatEuro(max, 0)})" else "")
        return ProposalResult(g, Proposal(key, snapshot), "Sélection proposée : retouchez-la à votre guise ou annulez-la.", summary)
    }

    /** Annule une proposition : restaure les essences d'avant. */
    fun undo(garden: Garden, p: Proposal): Garden = garden.copy(zones = garden.zones.map { z -> p.snapshot[z.id]?.let { z.copy(plantings = it.map { x -> x.copy() }) } ?: z })

    /** « 🌿 peu d'entretien » (minuscules) ; vide pour « main verte » ou niveau inconnu. */
    fun levelPhrase(id: String?): String {
        val l = Maintenance.getMaintenanceLevel(id)
        return if (l != null && l.id != "green") "${l.emoji} ${l.label.lowercase()}" else ""
    }

    fun plantableZones(g: Garden): List<Zone> = g.zones.filter { it.type !in NO_PLANT }

    /** Rappel « Niveau d'entretien : 🌿 peu d'entretien » du niveau effectif. */
    fun maintenanceReminder(g: Garden, z: Zone?): String {
        val l = Maintenance.getMaintenanceLevel(Maintenance.levelForZone(g, z)) ?: Maintenance.getMaintenanceLevel("green")!!
        return "Niveau d’entretien : ${l.emoji} ${l.label.lowercase()}"
    }

    fun setZoneMaintenance(z: Zone, id: String?): Zone = z.copy(maintenance = id)
    fun setGardenMaintenance(g: Garden, id: String): Garden = g.copy(context = g.context.copy(maintenance = id))

    /** Fiche : lignes d'entretien (« Plantation », « Taille »…). */
    fun careRows(p: Plant): List<Pair<String, String>> = listOf(
        "Plantation" to p.care.planting, "Taille" to p.care.pruning, "Engrais" to p.care.fertilizer, "Arrosage" to p.care.watering, "À savoir" to p.care.notes,
    ).filter { it.second.isNotEmpty() }

    fun detailLine(p: Plant, pl: Planting?): String = buildString {
        if (p.bloom.isNotEmpty()) append("Floraison : ${formatBloom(p.bloom)}. ")
        append("Hauteur adulte : ${fmtNum(p.heightAdult)} m, largeur ${fmtNum(p.widthAdult)} m. ")
        if (pl != null && (pl.height ?: 0.0) > 0 && Math.abs((pl.height ?: 0.0) - p.heightAdult) >= 0.005) append("Hauteur : ${formatHeight(pl.height)} (personnalisée). ")
        val price = priceLabel(p)
        append(if (price != null) "Prix indicatif : $price. " else "Prix non renseigné. ")
        append("Entretien : ${Maintenance.effortLabel(Maintenance.plantEffort(p))}.")
    }

    // ---------- massif calculé par l'app : « Recalculer ce massif » ----------
    /** Autre combinaison de plantes pour la même forme ; null si aucune trouvée. */
    fun recalcBed(garden: Garden, z: Zone, round: Int): Zone? {
        val info = z.autoInfo as? kotlinx.serialization.json.JsonObject
        val prevSeed = (info?.get("seed") as? kotlinx.serialization.json.JsonPrimitive)?.takeIf { !it.isString }?.content?.toDoubleOrNull() ?: 1.0
        val seed = prevSeed + round * 11 + z.plantings.size
        val sh = z.shape ?: return null
        val area = Math.round(shapeArea(sh) * 10) / 10.0
        val role = (info?.get("role") as? kotlinx.serialization.json.JsonPrimitive)?.takeIf { it.isString }?.content
        val whyBase = ((info?.get("why") as? kotlinx.serialization.json.JsonPrimitive)?.content ?: "").split(" — ")[0]
        val d = try {
            fr.jardin.core.Massifs.designBed(garden, fr.jardin.core.Bed(id = z.id, role = role, shape = sh, areaM2 = area),
                fr.jardin.core.DesignOptions(seed = seed, ambiance = Maybe(z.ambiance), maintenance = Maybe(Maintenance.levelForZone(garden, z))))
        } catch (_: Exception) { return null }
        if (d.plantings.isEmpty()) return null
        val nz = fr.jardin.core.Massifs.bedsToZones(garden.copy(zones = emptyList()), listOf(
            fr.jardin.core.Bed(id = z.id.removePrefix("z_"), role = role, shape = sh, areaM2 = area, why = whyBase, plantings = d.plantings, summary = d.summary, plantsWhy = d.why, seed = seed),
        ), null, null, 0)[0]
        return z.copy(plantings = d.plantings, autoInfo = nz.autoInfo)
    }

    fun autoWhy(z: Zone): String? = ((z.autoInfo as? kotlinx.serialization.json.JsonObject)?.get("why") as? kotlinx.serialization.json.JsonPrimitive)?.content?.takeIf { it.isNotEmpty() }
}
