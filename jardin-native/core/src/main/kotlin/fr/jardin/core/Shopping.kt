package fr.jardin.core

import java.text.Normalizer
import kotlin.math.ceil
import kotlin.math.max

// Listes de courses de plantation (port de jardin/shopping.js) : plantes groupées par format d'achat et par catégorie,
// par zone, par période de plantation, fournitures estimées et aménagements à acheter. Les totaux de plantes reprennent
// exactement `Pricing.plantCost`. Prix moyens indicatifs en jardinerie (France, € TTC).

object Shopping {
    const val LOSS_MARGIN = 0.1
    const val SHOPPING_NOTE = "Prix moyens en jardinerie, à titre indicatif : vérifiez les stocks et les tailles de pots. Ajustez les quantités de 10 % pour compenser les pertes."

    /** Constantes des fournitures : quantités unitaires et conditionnements. */
    object SUPPLY {
        const val compostLPerM2Bed = 10.0
        const val compostLPerWoody = 20.0
        const val compostBagL = 40.0
        const val compostBagPrice = 6.9
        const val mulchDepthM = 0.05
        const val mulchBagL = 50.0
        const val mulchBagPrice = 5.5
        const val fertKgPerWoody = 0.1
        const val fertKgPerOther = 0.03
        const val fertBagKg = 2.0
        const val fertBagPrice = 8.5
        const val stakePrice = 4.5
        const val tiesPack = 10.0
        const val tiesPackPrice = 4.5
        const val trellisPrice = 18.0
        const val hedgeStakeEvery = 4.0
        const val hedgeStakePrice = 2.5
        const val cardboardPricePerM2 = 1.2
        const val waterLTree = 30.0
        const val waterLShrub = 15.0
        const val waterLSmall = 5.0
        const val waterRounds = 10.0
    }

    data class ShopGroup(val id: String, val label: String, val cats: List<String>)

    val SHOP_GROUPS = listOf(
        ShopGroup("trees", "Arbres et fruitiers", listOf("tree", "fruit")),
        ShopGroup("shrubs", "Arbustes et haies", listOf("shrub", "hedge")),
        ShopGroup("climbers", "Grimpantes", listOf("climber")),
        ShopGroup("perennials", "Vivaces et graminées", listOf("perennial", "grass")),
        ShopGroup("groundcover", "Couvre-sols", listOf("groundcover")),
        ShopGroup("bulbs", "Bulbes", listOf("bulb")),
        ShopGroup("aquatic", "Plantes aquatiques", listOf("aquatic")),
        ShopGroup("vegetable", "Potager (godets et semis)", listOf("vegetable")),
        ShopGroup("lawn", "Gazon (semences ou rouleaux)", listOf("lawn")),
    )
    private val WOODY = setOf("tree", "fruit", "shrub", "hedge", "climber")
    private val MONTHS_SHORT = listOf("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.")

    private const val PUNCT_ORDER = " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$"
    private fun primaryWeight(c: Char): Int = when {
        c.isLetter() -> 3000 + c.code
        c.isDigit() -> 2000 + c.code
        else -> { val i = PUNCT_ORDER.indexOf(if (c == '’') '\'' else c); if (i >= 0) i else 1000 + c.code }
    }

    /**
     * Comparaison `localeCompare('fr')` (ICU) : primaire (lettres sans accents ni casse ; ponctuation < chiffres < lettres),
     * puis accents, puis casse (minuscule avant majuscule). Ne pas utiliser `java.text.Collator` : il ignore la ponctuation.
     */
    internal fun fr(a: String, b: String): Int {
        fun base(s: String) = Normalizer.normalize(s.replace("œ", "oe").replace("Œ", "OE").replace("æ", "ae").replace("Æ", "AE"), Normalizer.Form.NFD)
        val na = base(a); val nb = base(b)
        fun prim(s: String) = s.filter { !it.isMarkChar() }.lowercase()
        val pa = prim(na); val pb = prim(nb)
        for (i in 0 until minOf(pa.length, pb.length)) {
            val d = primaryWeight(pa[i]) - primaryWeight(pb[i])
            if (d != 0) return d
        }
        if (pa.length != pb.length) return pa.length - pb.length
        val ma = na.filter { it.isMarkChar() }; val mb = nb.filter { it.isMarkChar() }
        if (ma != mb) return ma.compareTo(mb)
        val ca = na.filter { !it.isMarkChar() }; val cb = nb.filter { !it.isMarkChar() }
        for (i in 0 until minOf(ca.length, cb.length)) {
            if (ca[i] != cb[i]) return if (ca[i].isLowerCase() && cb[i].isUpperCase()) -1 else if (ca[i].isUpperCase() && cb[i].isLowerCase()) 1 else ca[i].compareTo(cb[i])
        }
        return 0
    }
    private fun Char.isMarkChar() = Character.getType(this).let { it == Character.NON_SPACING_MARK.toInt() || it == Character.COMBINING_SPACING_MARK.toInt() || it == Character.ENCLOSING_MARK.toInt() }

    private fun zoneArea(z: Zone?): Double = try { if (z?.shape != null) shapeArea(z.shape) else 0.0 } catch (_: Exception) { 0.0 }
    private fun zoneLabelOf(z: Zone, i: Int): String = z.label.ifEmpty { "Zone ${i + 1}" }

    /** « oct. à nov. » à partir de mois (suites consécutives réunies : « mars à mai, sept. »). */
    fun monthsText(months: Collection<Int>?): String {
        val ms = (months ?: emptyList()).toSet().filter { it in 1..12 }.sorted()
        if (ms.isEmpty()) return ""
        val runs = mutableListOf<Pair<Int, Int>>()
        var s = ms[0]; var p = ms[0]
        for (m in ms.drop(1)) { if (m == p + 1) { p = m; continue }; runs.add(s to p); s = m; p = m }
        runs.add(s to p)
        return runs.joinToString(", ") { (a, b) -> if (a == b) MONTHS_SHORT[a - 1] else "${MONTHS_SHORT[a - 1]} à ${MONTHS_SHORT[b - 1]}" }
    }

    private fun groupOf(plant: Plant): ShopGroup = SHOP_GROUPS.firstOrNull { plant.category in it.cats } ?: SHOP_GROUPS[3]
    private fun formatOf(plant: Plant): String =
        plant.priceNote?.trim()?.takeIf { it.isNotEmpty() } ?: when (plant.priceUnit) { "bulb" -> "bulbe"; "m2" -> "au m²"; else -> "plant" }

    /** Mois de plantation d'une essence (fiche, sinon vide). */
    fun plantMonthsOf(plant: Plant?): List<Int> = plant?.care?.plantMonths ?: emptyList()

    /** Ligne de courses. `unitPrice` null = sans prix. */
    class Line(
        val plantId: String, val plant: Plant, val format: String,
        var qty: Double = 0.0, var unit: String = "plant", var unitPrice: Double? = null, var total: Double = 0.0, var priced: Boolean = true,
        val zoneIds: MutableList<String> = mutableListOf(), val plantMonths: List<Int> = plantMonthsOf(plant),
    ) { fun copyLine() = Line(plantId, plant, format, qty, unit, unitPrice, total, priced, zoneIds.toMutableList(), plantMonths) }

    class FormatGroup(val format: String, val lines: MutableList<Line> = mutableListOf())
    class Group(val id: String, val label: String, val formats: List<FormatGroup>, val lines: List<Line>, val subtotal: Double)
    class ZoneList(val zoneId: String, val label: String, val n: Int, val lines: List<Line>, val total: Double)
    class ShoppingList(val groups: List<Group>, val byZone: List<ZoneList>, val total: Double, val unknownCount: Int, val plantCount: Int, val lines: List<Line>)

    private fun sortLines(ls: List<Line>): List<Line> =
        ls.sortedWith { a, b -> fr(a.format, b.format).let { if (it != 0) it else fr(a.plant.commonName, b.plant.commonName) } }

    private fun default(): PlantById = { Catalog.getPlant(it) }

    fun shoppingList(garden: Garden?, plantsById: PlantById = default()): ShoppingList {
        val zones = garden?.zones ?: emptyList()
        val byPlant = LinkedHashMap<String, Line>()
        val byZone = mutableListOf<ZoneList>()
        var unknown = 0; var plantCount = 0
        zones.forEachIndexed { zi, z ->
            val zl = LinkedHashMap<String, Line>()
            var zTotal = 0.0
            for (pl in z.plantings) {
                val plant = plantsById(pl.plantId) ?: continue
                val c = Pricing.plantCost(plant, pl, z)
                val count = max(1, pl.count ?: 1)
                if (plant.category != "lawn") plantCount += count
                for ((map, key) in listOf(byPlant to plant.id, zl to plant.id)) {
                    val ln = map.getOrPut(key) { Line(plant.id, plant, formatOf(plant)) }
                    if (c != null) { ln.qty = round2(ln.qty + c.qty); ln.unit = c.unit; ln.unitPrice = c.unitPrice; ln.total = round2(ln.total + c.total) }
                    else { ln.priced = false; ln.qty = round2(ln.qty + count) }
                    if (z.id !in ln.zoneIds) ln.zoneIds.add(z.id)
                }
                if (c == null) unknown++
                zTotal = round2(zTotal + (c?.total ?: 0.0))
            }
            byZone.add(ZoneList(z.id, zoneLabelOf(z, zi), zi + 1, sortLines(zl.values.toList()), zTotal))
        }
        val lines = byPlant.values.toList()
        val groups = SHOP_GROUPS.map { g ->
            val gl = sortLines(lines.filter { groupOf(it.plant).id == g.id })
            val formats = mutableListOf<FormatGroup>()
            for (l in gl) { val f = formats.firstOrNull { it.format == l.format } ?: FormatGroup(l.format).also { formats.add(it) }; f.lines.add(l) }
            Group(g.id, g.label, formats, gl, round2(gl.sumOf { it.total }))
        }.filter { it.lines.isNotEmpty() }
        return ShoppingList(groups, byZone.filter { it.lines.isNotEmpty() }, round2(groups.sumOf { it.subtotal }), unknown, plantCount, lines)
    }

    data class Period(val id: String, val label: String, val months: List<Int>)

    val PERIODS = listOf(
        Period("autumn", "À acheter pour planter en automne", listOf(9, 10, 11)),
        Period("winter", "À acheter pour planter en hiver (racines nues, hors gel)", listOf(12, 1, 2)),
        Period("spring", "À acheter pour planter au printemps", listOf(3, 4, 5, 6)),
        Period("sow", "À semer (graines et semences)", emptyList()),
    )
    private val SOW_RE = Regex("semis|graine|semence", RegexOption.IGNORE_CASE)
    private val BARE_RE = Regex("racines nues", RegexOption.IGNORE_CASE)
    private fun isSow(plant: Plant) = SOW_RE.containsMatchIn(plant.priceNote ?: "") || plant.category == "lawn"

    /** Période d'achat conseillée d'une essence : 'autumn' | 'winter' | 'spring' | 'sow'. */
    fun periodOf(plant: Plant): String {
        if (isSow(plant)) return "sow"
        val pm = plantMonthsOf(plant)
        fun score(id: String) = PERIODS.first { it.id == id }.months.count { it in pm }
        if (BARE_RE.containsMatchIn(plant.priceNote ?: "") && score("winter") > 0) return "winter"
        var best = "autumn"; var bs = -1
        for (id in listOf("autumn", "spring", "winter")) { val s = score(id); if (s > bs) { best = id; bs = s } }
        return if (bs > 0) best else "spring"
    }

    class PeriodLine(val line: Line, val best: String)
    class PeriodList(val id: String, val label: String, val lines: List<PeriodLine>, val subtotal: Double)

    /** Achats étalés selon la période de plantation (périodes non vides). */
    fun shoppingByPeriod(garden: Garden?, plantsById: PlantById = default()): List<PeriodList> {
        val sl = shoppingList(garden, plantsById)
        return PERIODS.map { p ->
            val lines = sortLines(sl.lines.filter { periodOf(it.plant) == p.id }).map { l ->
                PeriodLine(l, if (p.id == "sow") monthsText(l.plantMonths) else monthsText(l.plantMonths.filter { it in p.months }).ifEmpty { monthsText(l.plantMonths) })
            }
            PeriodList(p.id, p.label, lines, round2(lines.sumOf { it.line.total }))
        }.filter { it.lines.isNotEmpty() }
    }

    class SupplyLine(val id: String, val label: String, val qty: Double, val unit: String, val pack: Double?, val packs: Int, val unitPrice: Double?, val total: Double, val basis: String)
    class Supplies(val lines: List<SupplyLine>, val total: Double, val bedArea: Double, val plantedArea: Double, val woody: Int, val trees: Int, val climbers: Int)

    private fun n(v: Double): String = jsNum(v)

    fun suppliesList(garden: Garden?, plantsById: PlantById = default()): Supplies {
        val S = SUPPLY
        var bedArea = 0.0; var treeArea = 0.0
        var woody = 0; var trees = 0; var climbers = 0; var hedgePlants = 0; var others = 0
        var waterL = 0.0; var any = false
        for (z in garden?.zones ?: emptyList()) {
            val area = zoneArea(z)
            var hasBed = false; var hasTree = false
            for (pl in z.plantings) {
                val p = plantsById(pl.plantId) ?: continue
                any = true
                val cnt = max(1, pl.count ?: 1)
                if (p.category == "lawn") continue
                if (p.category == "aquatic") { others += cnt; continue }
                if (p.category in WOODY) {
                    woody += cnt
                    if (p.category == "tree" || p.category == "fruit") { trees += cnt; hasTree = true; waterL += cnt * S.waterLTree } else waterL += cnt * S.waterLShrub
                    if (p.category == "climber") climbers += cnt
                    if (p.category == "hedge") hedgePlants += cnt
                    if (p.category != "tree" && p.category != "fruit") hasBed = hasBed || z.type != "trees"
                } else { others += cnt; hasBed = true; waterL += cnt * S.waterLSmall }
            }
            if (hasBed) bedArea += area else if (hasTree) treeArea += area
        }
        if (!any) return Supplies(emptyList(), 0.0, 0.0, 0.0, 0, 0, 0)
        val plantedArea = bedArea + treeArea
        val lines = mutableListOf<SupplyLine>()
        fun add(id: String, label: String, qty: Double, unit: String, pack: Double, unitPrice: Double, basis: String) {
            val packs = max(1.0, ceil(qty / pack - 1e-9)).toInt()
            lines.add(SupplyLine(id, label, round2(qty), unit, pack, packs, unitPrice, round2(packs * unitPrice), basis))
        }
        val compostL = bedArea * S.compostLPerM2Bed + woody * S.compostLPerWoody
        if (compostL > 0) add("compost", "Terreau ou compost (sacs de ${n(S.compostBagL)} L)", compostL, "L", S.compostBagL, S.compostBagPrice, "${n(S.compostLPerM2Bed)} L/m² de massif (${n(round2(bedArea))} m²) + ${n(S.compostLPerWoody)} L par arbre, arbuste ou haie ($woody)")
        val mulchM3 = plantedArea * S.mulchDepthM
        if (mulchM3 > 0) add("mulch", "Paillage : broyat, paille ou écorces (sacs de ${n(S.mulchBagL)} L)", mulchM3 * 1000, "L", S.mulchBagL, S.mulchBagPrice, "${n(round2(plantedArea))} m² plantés × 5 cm = ${n(round2(mulchM3))} m³")
        val fertKg = woody * S.fertKgPerWoody + others * S.fertKgPerOther
        if (fertKg > 0) add("fert", "Engrais de plantation : corne broyée ou organique (sacs de ${n(S.fertBagKg)} kg)", fertKg, "kg", S.fertBagKg, S.fertBagPrice, "${n(S.fertKgPerWoody * 1000)} g par ligneux, ${n(S.fertKgPerOther * 1000)} g par autre plant")
        if (trees > 0) {
            add("stakes", "Tuteurs d’arbre (1 par arbre)", trees.toDouble(), "pièce", 1.0, S.stakePrice, "$trees arbre${if (trees > 1) "s" else ""}")
            add("ties", "Attaches souples (lots de ${n(S.tiesPack)})", (trees + climbers).toDouble(), "attache", S.tiesPack, S.tiesPackPrice, "arbres et grimpantes")
        }
        if (climbers > 0) add("trellis", "Treillage ou fils tendus (1 par grimpante)", climbers.toDouble(), "pièce", 1.0, S.trellisPrice, "$climbers grimpante${if (climbers > 1) "s" else ""}")
        if (hedgePlants > 0) add("hedgestakes", "Piquets et cordeau pour aligner les haies", ceil(hedgePlants / S.hedgeStakeEvery), "piquet", 1.0, S.hedgeStakePrice, "1 piquet pour ${n(S.hedgeStakeEvery)} plants de haie")
        if (bedArea > 0) add("cardboard", "Carton brun ou géotextile sous le paillage (si le sol est enherbé)", bedArea, "m²", 1.0, S.cardboardPricePerM2, "${n(round2(bedArea))} m² de massifs")
        if (waterL > 0) lines.add(SupplyLine("water", "Arrosage de reprise (eau, à prévoir la 1re saison)", jsRound(waterL * S.waterRounds), "L", null, 0, null, 0.0, "≈ ${n(jsRound(waterL))} L par tour d’arrosage × ${n(S.waterRounds)} arrosages"))
        return Supplies(lines, round2(lines.sumOf { it.total }), round2(bedArea), round2(plantedArea), woody, trees, climbers)
    }

    class ItemLine(val id: String, val kind: String, val label: String, val category: String, val dims: String, val height: Double, val price: Double)
    class ItemsToBuy(val lines: List<ItemLine>, val total: Double)

    /** Mobilier et structures à acheter ou à construire (catalogue d'éléments). */
    fun itemsToBuy(garden: Garden?): ItemsToBuy {
        val lines = mutableListOf<ItemLine>()
        for (it in garden?.items ?: emptyList()) {
            val k = getItemKind(it.kind) ?: continue
            val r = it.radius?.takeIf { v -> v.isFinite() && v > 0 }
            fun f(v: Double) = jsNum(jsRound(v * 100) / 100).replace('.', ',')
            val w = if (it.width != 0.0) it.width else k.w
            val d = if (it.depth != 0.0) it.depth else k.d
            lines.add(ItemLine(it.id, it.kind, it.label?.takeIf { l -> l.isNotEmpty() } ?: k.label, k.category,
                if (r != null) "Ø ${f(r * 2)} m" else "${f(w)} × ${f(d)} m", itemHeight(it), k.priceEur))
        }
        return ItemsToBuy(lines, round2(lines.sumOf { it.price }))
    }
}
