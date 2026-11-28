package fr.jardin.core

import fr.jardin.core.Ambiances.isTypical
import fr.jardin.core.Ambiances.plantAmbianceScore
import fr.jardin.core.Maintenance.plantEffort
import fr.jardin.core.Recommend.checkCoherence
import fr.jardin.core.Recommend.contextForZone
import fr.jardin.core.Recommend.isSmallShrub
import fr.jardin.core.Recommend.recommendForZone
import fr.jardin.core.Recommend.scorePlant
import fr.jardin.core.Recommend.suggestForGarden
import fr.jardin.core.Recommend.suggestQuantity
import fr.jardin.core.Recommend.suggestSelection
import kotlin.math.PI
import kotlin.math.hypot
import kotlin.test.*

// Tests de recommend.js portés : score, zones, quantités, cohérence, « Surprends-moi » (budget, ambiance, entretien, mare,
// espacements, arbres et arbustes).

private fun sq(x: Double, y: Double, w: Double, h: Double) = rectShape(x, y, w, h)
private fun sq0(w: Double, h: Double) = rectShape(0.0, 0.0, w, h)
private fun mk(
    id: String = "p", commonName: String = "Plante", category: String = "perennial", heightAdult: Double = 0.6, widthAdult: Double = 0.5,
    sun: List<String> = listOf("full", "partial"), hardiness: Double = -20.0, water: String = "medium", soil: List<String> = emptyList(),
    bloom: List<Int> = listOf(6), zones: List<String> = listOf("midplants"), spacing: Double = 0.5, windTolerant: Boolean = false,
    melliferous: Boolean = false, invasive: Boolean = false, toxic: Boolean = false, priceEur: Double? = null, priceUnit: String? = null,
) = Plant(
    id = id, commonName = commonName, latinName = "Plantus", category = category, heightAdult = heightAdult, widthAdult = widthAdult, sun = sun,
    hardiness = hardiness, water = water, soil = soil, foliage = "deciduous", bloom = bloom, zones = zones, maintenance = "low", kc = 0.7,
    spacing = spacing, windTolerant = windTolerant, melliferous = melliferous, invasive = invasive, toxic = toxic, priceEur = priceEur, priceUnit = priceUnit,
)
private fun garden(zones: List<Zone>, altitude: Double? = null, maintenance: String? = null, departement: String? = "75", uniform: String = "full") =
    Garden(id = "g", context = GardenContext(departement = departement, altitude = altitude, maintenance = maintenance),
        sun = SunInfo("uniform", uniform, emptyList()), zones = zones)
private fun zone(id: String, type: String, shape: Shape?, plantings: List<Planting> = emptyList(), label: String? = null) =
    Zone(id = id, type = type, label = label ?: id, shape = shape, plantings = plantings)
private val baseCtx = ScoreContext(tminC = -8.0, zoneType = "midplants", sunLevel = "full", areaM2 = 10.0, minDimension = 3.0)
private fun by(id: String) = getPlant(id)!!
private fun ids(rs: List<Recommendation>) = rs.map { it.plant.id }

class RecommendTest {
    @Test fun scoreIdeale() {
        val r = scorePlant(mk(hardiness = -15.0), baseCtx)
        assertEquals("ideal", r.status)
        assertTrue(r.score >= 90)
        val rus = r.reasons.first { it.criterion == "rusticité" }
        assertEquals(true, rus.ok)
        assertEquals("Résiste au gel jusqu'à −15 °C (votre secteur : −8 °C)", rus.text)
    }

    @Test fun exclusionDureSiRusticiteInsuffisante() {
        val r = scorePlant(mk(hardiness = -5.0), baseCtx)
        assertTrue(r.excluded)
        assertEquals(0, r.score)
        assertEquals("discouraged", r.status)
        assertEquals(false, r.reasons.first { it.criterion == "rusticité" }.ok)
    }

    @Test fun rusticiteJusteAvertissement() {
        val r = scorePlant(mk(hardiness = -9.0), baseCtx)
        assertFalse(r.excluded)
        assertNull(r.reasons.first { it.criterion == "rusticité" }.ok)
    }

    @Test fun soleilPenaliteCroissanteInconnuSansPenalite() {
        val shade = scorePlant(mk(sun = listOf("shade")), baseCtx)
        val part = scorePlant(mk(sun = listOf("partial")), baseCtx)
        val noSun = baseCtx.copy(sunLevel = null)
        val unknown = scorePlant(mk(sun = listOf("shade")), noSun)
        assertTrue(shade.score < part.score)
        assertTrue(part.score < 100)
        assertEquals(scorePlant(mk(), noSun).score, unknown.score)
        assertTrue(unknown.reasons.any { it.criterion == "soleil" && it.ok == null })
    }

    @Test fun solVent() {
        assertTrue(scorePlant(mk(soil = listOf("limestone")), baseCtx.copy(soil = "clay")).score < 100)
        assertTrue(scorePlant(mk(soil = listOf("clay")), baseCtx.copy(soil = "clay")).reasons.any { it.criterion == "sol" && it.ok == true })
        val windy = scorePlant(mk(), baseCtx.copy(windy = true))
        val tol = scorePlant(mk(windTolerant = true), baseCtx.copy(windy = true))
        assertTrue(windy.score < tol.score)
    }

    @Test fun place() {
        val wide = scorePlant(mk(widthAdult = 4.0), baseCtx.copy(minDimension = 1.5, areaM2 = 30.0))
        assertEquals(false, wide.reasons.first { it.criterion == "place" }.ok)
        assertTrue(wide.score < 80)
        val small = scorePlant(mk(widthAdult = 3.0), baseCtx.copy(minDimension = 5.0, areaM2 = 3.0))
        assertEquals(false, small.reasons.first { it.criterion == "place" }.ok)
    }

    @Test fun typeDeZoneAbsentDeclasse() {
        val r = scorePlant(mk(zones = listOf("pond")), baseCtx)
        assertEquals("discouraged", r.status)
        assertEquals(false, r.reasons.first { it.criterion == "zone" }.ok)
    }

    @Test fun scoreBorne() {
        val r = scorePlant(mk(sun = listOf("shade"), zones = emptyList(), soil = listOf("clay"), widthAdult = 9.0), baseCtx.copy(soil = "sandy", windy = true, areaM2 = 1.0, minDimension = 1.0))
        assertTrue(r.score in 0..100)
    }

    // ---- recommendForZone
    private val plantsR = listOf(
        mk(id = "a", commonName = "Alpha"), mk(id = "b", commonName = "Bravo", sun = listOf("shade")), mk(id = "c", commonName = "Charlie", hardiness = -2.0),
        mk(id = "d", commonName = "Delta", zones = listOf("pond")), mk(id = "e", commonName = "Echo", hardiness = -15.0, melliferous = true),
    )
    private val z1 = zone("z1", "midplants", sq(0.0, 0.0, 4.0, 3.0))
    private val g1 = garden(listOf(z1))

    @Test fun recommendTrieDiscouragedMasqueesExclusionAbsente() {
        val r = recommendForZone(g1, z1, RecommendOptions(plants = plantsR))
        assertFalse("c" in ids(r)); assertFalse("d" in ids(r))
        assertTrue(r.first().score >= r.last().score)
        assertTrue(r.all { it.status != "discouraged" })
    }

    @Test fun includeDiscouragedJamaisLesExclues() {
        val r = ids(recommendForZone(g1, z1, RecommendOptions(plants = plantsR, includeDiscouraged = true)))
        assertTrue("d" in r); assertFalse("c" in r)
    }

    @Test fun filtresAppliques() {
        assertEquals(listOf("e"), ids(recommendForZone(g1, z1, RecommendOptions(plants = plantsR, filters = PlantFilters(melliferous = true)))))
    }

    @Test fun altitudeDurcitLeClimat() {
        val p12 = listOf(mk(id = "m", hardiness = -12.0))
        assertEquals(1, recommendForZone(g1, z1, RecommendOptions(plants = p12)).size)
        val cold = garden(listOf(z1), altitude = 1000.0) // -9 - 6 = -15 °C
        assertEquals(0, recommendForZone(cold, z1, RecommendOptions(plants = p12)).size)
    }

    // ---- suggestQuantity
    @Test fun quantites() {
        assertEquals(48, suggestQuantity(mk(spacing = 0.5), zone("z", "midplants", sq(0.0, 0.0, 4.0, 3.0))))
        assertEquals(4, suggestQuantity(mk(spacing = 1.0), zone("z", "midplants", sq(0.0, 0.0, 2.0, 2.0))))
        assertEquals(1, suggestQuantity(mk(category = "tree", spacing = 4.0), zone("z", "trees", sq(0.0, 0.0, 10.0, 10.0))))
        val h = zone("h", "hedge", LineShape(listOf(Point(0.0, 0.0), Point(10.0, 0.0)), 1.0))
        assertEquals(10, suggestQuantity(mk(category = "hedge", spacing = 1.0), h))
        assertEquals(13, suggestQuantity(mk(category = "hedge", spacing = 0.8), h))
        assertEquals(1, suggestQuantity(mk(spacing = 5.0), zone("z", "midplants", sq(0.0, 0.0, 1.0, 1.0))))
    }

    // ---- checkCoherence
    private val plantsC = listOf(
        mk(id = "tall", commonName = "Chêne", category = "tree", heightAdult = 15.0, widthAdult = 8.0, spacing = 8.0), mk(id = "dry", commonName = "Lavande", water = "low"),
        mk(id = "wet", commonName = "Hortensia", water = "high"), mk(id = "inv", commonName = "Renouée", invasive = true), mk(id = "tox", commonName = "Laurier-rose", toxic = true),
    )

    @Test fun coherenceSansProbleme() {
        val g = garden(listOf(zone("a", "midplants", sq(0.0, 0.0, 4.0, 4.0), listOf(Planting("dry", count = 5)))))
        assertEquals(emptyList(), checkCoherence(g, plantsC))
    }

    @Test fun coherenceSurdensite() {
        val g = garden(listOf(zone("a", "midplants", sq(0.0, 0.0, 2.0, 2.0), listOf(Planting("dry", count = 40)))))
        val r = checkCoherence(g, plantsC)
        assertEquals(1, r.size)
        assertEquals("warn", r[0].level); assertEquals("a", r[0].zoneId)
        assertTrue(Regex("surdensité").containsMatchIn(r[0].text))
    }

    @Test fun coherenceArbreHautPresTerrasse() {
        val g = garden(listOf(
            zone("t", "trees", CircleShape(Point(0.0, 0.0), 1.0), listOf(Planting("tall", count = 1))),
            zone("ter", "terrace", sq(2.5, -1.0, 3.0, 2.0)), zone("far", "pool", sq(20.0, 0.0, 4.0, 3.0)),
        ))
        val r = checkCoherence(g, plantsC).filter { "moins de 3 m" in it.text }
        assertEquals(1, r.size)
        assertTrue("terrasse" in r[0].text)
        assertEquals("t", r[0].zoneId)
    }

    @Test fun coherenceEauMelangee() {
        val g = garden(listOf(zone("a", "midplants", sq(0.0, 0.0, 6.0, 6.0), listOf(Planting("dry", count = 3), Planting("wet", count = 3)))))
        assertTrue(checkCoherence(g, plantsC).any { "eau" in it.text })
    }

    @Test fun coherenceInvasiveEtToxique() {
        val g = garden(listOf(
            zone("a", "midplants", sq(0.0, 0.0, 6.0, 6.0), listOf(Planting("inv", count = 2))),
            zone("v", "vegetable", sq(10.0, 0.0, 6.0, 6.0), listOf(Planting("tox", count = 2))),
            zone("m", "midplants", sq(20.0, 0.0, 6.0, 6.0), listOf(Planting("tox", count = 2))),
        ))
        val r = checkCoherence(g, plantsC)
        assertTrue(r.any { "invasive" in it.text && it.zoneId == "a" })
        assertTrue(r.any { "toxique" in it.text && it.zoneId == "v" })
        assertFalse(r.any { "toxique" in it.text && it.zoneId == "m" })
    }

    // ---- suggestSelection
    private val plantsS = listOf(
        mk(id = "g1", commonName = "Couvre-sol", category = "groundcover", heightAdult = 0.2, bloom = listOf(3, 4)),
        mk(id = "g2", commonName = "Couvre-sol 2", category = "groundcover", heightAdult = 0.25, bloom = listOf(3, 4)),
        mk(id = "v1", commonName = "Vivace", heightAdult = 0.8, bloom = listOf(6, 7, 8)),
        mk(id = "s1", commonName = "Arbuste", category = "shrub", heightAdult = 2.5, widthAdult = 1.5, spacing = 1.5, bloom = listOf(10, 11)),
        mk(id = "inv", commonName = "Invasive", invasive = true, heightAdult = 1.0, bloom = listOf(1, 2, 3, 4, 5, 9)),
        mk(id = "frile", commonName = "Frileuse", hardiness = 0.0),
    )
    private val zs = zone("z", "midplants", sq(0.0, 0.0, 5.0, 4.0))
    private val gs = garden(listOf(zs))

    @Test fun selectionDeterministe() {
        val plantsM = plantsS
        assertEquals(suggestSelection(gs, zs, SelectionOptions(seed = 42, plants = plantsM)), suggestSelection(gs, zs, SelectionOptions(seed = 42, plants = plantsM)))
    }

    @Test fun selectionExclutInvasivesEtFrileuses() {
        val z9 = zone("z9", "midplants", sq(0.0, 0.0, 3.0, 3.0))
        val r = suggestSelection(garden(listOf(z9)), z9, SelectionOptions(seed = 7, plants = plantsS))
        val idsR = r.map { it.plantId }
        assertFalse("inv" in idsR); assertFalse("frile" in idsR)
        assertTrue("s1" in idsR); assertTrue("v1" in idsR)
        assertEquals(1, idsR.count { it.startsWith("g") })
        assertTrue(r.all { it.count!! >= 1 })
    }

    @Test fun zoneSansCandidat() {
        assertEquals(emptyList(), suggestSelection(gs, zs, SelectionOptions(seed = 1, plants = emptyList())))
    }

    @Test fun grainesDifferentes() {
        val many = (0 until 12).map { i -> mk(id = "x$i", commonName = "X$i", heightAdult = 0.3 + (i % 4), bloom = listOf((i % 12) + 1)) }
        val sets = (1..6).map { s -> suggestSelection(gs, zs, SelectionOptions(seed = s, plants = many)).joinToString(",") { it.plantId } }.toSet()
        assertTrue(sets.size > 1)
    }
}

// ---- ambiance
class RecommendAmbianceTest {
    private fun sqA(w: Double, h: Double) = sq0(w, h)
    private fun mkGarden(zones: List<Zone>) = garden(zones)
    private fun massif(id: String = "z1", type: String = "midplants", label: String = "Massif", shape: Shape = sqA(8.0, 6.0), ambiance: String? = null) =
        Zone(id = id, type = type, label = label, shape = shape, ambiance = ambiance)
    private val base = ScoreContext(tminC = -5.0, zoneType = "midplants", sunLevel = "full", areaM2 = 50.0, minDimension = 6.0)

    @Test fun ambianceAjouteRaisonEtBonus() {
        val lav = by("h-lavande")
        val sans = scorePlant(lav, base)
        val avec = scorePlant(lav, base.copy(ambiance = "mediterraneen"))
        val r = avec.reasons.first { it.criterion == "ambiance" }
        assertEquals(Reason(true, "ambiance", "Convient à l'ambiance « méditerranéen »"), r)
        assertFalse(sans.reasons.any { it.criterion == "ambiance" })
        assertTrue(avec.rank!! > sans.score)
        assertTrue(avec.rank!! - sans.score <= 15)
    }

    @Test fun malusEssenceAEviter() {
        val ctx = base.copy(zoneType = "hedge")
        val sans = scorePlant(by("thuya"), ctx)
        val avec = scorePlant(by("thuya"), ctx.copy(ambiance = "sauvage"))
        assertTrue(avec.score < sans.score)
        assertEquals(false, avec.reasons.first { it.criterion == "ambiance" }.ok)
    }

    @Test fun retroCompatibilite() {
        val lav = by("h-lavande")
        val a = scorePlant(lav, base)
        assertNull(a.rank)
        assertEquals(a, scorePlant(lav, base.copy(ambiance = null)))
        val z = massif()
        assertEquals(ids(recommendForZone(mkGarden(listOf(z)), z)), ids(recommendForZone(mkGarden(listOf(z)), z, RecommendOptions(ambiance = Maybe(null)))))
    }

    @Test fun contexteAmbiance() {
        val g = mkGarden(emptyList())
        assertEquals("zen", contextForZone(g, massif(ambiance = "zen")).ambiance)
        assertEquals("bucolique", contextForZone(g, massif(label = "Massif bucolique")).ambiance)
        assertNull(contextForZone(g, massif(label = "Massif bucolique"), ambiance = Maybe(null)).ambiance)
        assertNull(contextForZone(g, massif()).ambiance)
    }

    @Test fun ambianceRemonteLesTypiques() {
        val z = massif()
        fun top(amb: String?) = recommendForZone(mkGarden(listOf(z)), z, RecommendOptions(ambiance = Maybe(amb))).take(15)
        val typ = top("mediterraneen").count { isTypical(it.plant, "mediterraneen") }
        val typSans = top(null).count { isTypical(it.plant, "mediterraneen") }
        assertTrue(typ > typSans)
    }

    @Test fun selectionAuMoins70PourCentTypiques() {
        for (amb in listOf("bucolique", "zen", "gourmand", "pollinisateurs", "contemporain", "romantique")) for (type in listOf("midplants", "tallplants")) {
            val z = massif(type = type)
            for (seed in 1..5) {
                val sel = suggestSelection(mkGarden(listOf(z)), z, SelectionOptions(seed = seed, ambiance = Maybe(amb)))
                assertTrue(sel.isNotEmpty())
                val t = sel.count { isTypical(by(it.plantId), amb) }
                assertTrue(t.toDouble() / sel.size >= 0.7, "$amb $type $seed")
            }
        }
    }

    @Test fun determinismeEtVarieteEntreGraines() {
        val z = massif(); val g = mkGarden(listOf(z))
        assertEquals(suggestSelection(g, z, SelectionOptions(seed = 7, ambiance = Maybe("bucolique"))), suggestSelection(g, z, SelectionOptions(seed = 7, ambiance = Maybe("bucolique"))))
        val seen = (1..8).map { s -> suggestSelection(g, z, SelectionOptions(seed = s, ambiance = Maybe("bucolique"))) }.toSet()
        assertTrue(seen.size > 1)
    }

    @Test fun sansAmbianceInchangeEtNomDeZone() {
        val z = massif(); val g = mkGarden(listOf(z))
        assertEquals(suggestSelection(g, z, SelectionOptions(seed = 3)), suggestSelection(g, z, SelectionOptions(seed = 3, ambiance = Maybe(null))))
        val zb = massif(label = "Coin bucolique")
        assertEquals(suggestSelection(g, zb, SelectionOptions(seed = 3)), suggestSelection(g, zb, SelectionOptions(seed = 3, ambiance = Maybe("bucolique"))))
    }

    @Test fun equilibreReste() {
        val z = massif(shape = sqA(10.0, 10.0))
        val sel = suggestSelection(mkGarden(listOf(z)), z, SelectionOptions(seed = 2, ambiance = Maybe("bucolique")))
        val ps = sel.map { by(it.plantId) }
        assertTrue(ps.map { p -> if (p.heightAdult < 0.5) 0 else if (p.heightAdult < 1.5) 1 else if (p.heightAdult < 4) 2 else 3 }.toSet().size > 1)
        assertTrue(ps.flatMap { it.bloom }.toSet().size >= 4)
    }

    @Test fun surprendsMoiTousLesJardins() {
        val z1 = massif(id = "a"); val z2 = massif(id = "b", label = "Coin zen"); val z3 = massif(id = "c", label = "Coin zen")
        val piscine = Zone(id = "p", type = "pool", label = "Piscine", shape = sqA(4.0, 3.0))
        val g = mkGarden(listOf(z1, z2, z3, piscine))
        val amb = mapOf<String, String?>("a" to "gourmand", "c" to null)
        val res = suggestForGarden(g, seed = 4, ambiances = amb)
        assertEquals(listOf("a", "b", "c"), res.map { it.zoneId })
        fun ratio(r: ZoneSelection, a: String) = r.selection.count { isTypical(by(it.plantId), a) }.toDouble() / r.selection.size
        assertTrue(ratio(res[0], "gourmand") >= 0.7)
        assertTrue(ratio(res[1], "zen") >= 0.7)
        assertEquals(suggestSelection(g, z3, SelectionOptions(seed = "4:2", ambiance = Maybe(null))), res[2].selection)
        assertEquals(res, suggestForGarden(g, seed = 4, ambiances = amb))
    }

    @Test fun modeleAmbianceNullParDefaut() {
        assertNull(createZone("lawn", sqA(3.0, 3.0)).ambiance)
        assertTrue(plantAmbianceScore(by("h-lavande"), "zen") >= 0)
    }
}

// ---- budget
class RecommendBudgetTest {
    private fun mkB(id: String, priceEur: Double, heightAdult: Double = 0.6, bloom: List<Int> = listOf(6)) =
        mk(id = id, commonName = id, sun = listOf("full"), priceEur = priceEur, priceUnit = "plant", heightAdult = heightAdult, bloom = bloom)
    private val z = Zone(id = "z", type = "midplants", shape = sq0(6.0, 5.0))
    private val g = garden(listOf(z))
    private val plants = listOf(mkB("cher", 40.0, 1.2, listOf(4, 5)), mkB("moyen", 8.0, bloom = listOf(7, 8)), mkB("bon", 2.0, 2.0, listOf(9)), mkB("autre", 3.0, 0.2, listOf(3)))
    private fun costOf(sel: List<Planting>) = Pricing.zoneCost(z.copy(plantings = sel), plants.associateBy { it.id }.let { m -> { id: String -> m[id] } }).total

    @Test fun sansBudgetInchangeEtDeterministe() {
        val a = suggestSelection(g, z, SelectionOptions(seed = 3, plants = plants))
        assertEquals(a, suggestSelection(g, z, SelectionOptions(seed = 3, plants = plants, budget = null)))
        assertTrue(a.isNotEmpty())
    }

    @Test fun budgetRespecteQuandPossible() {
        for (seed in 1..5) {
            val base = suggestSelection(g, z, SelectionOptions(seed = seed, plants = plants))
            val cap = maxOf(20.0, Math.floor(costOf(base) / 3))
            val sel = suggestSelection(g, z, SelectionOptions(seed = seed, plants = plants, budget = cap))
            assertTrue(sel.isNotEmpty())
            assertTrue(costOf(sel) <= cap + 1e-9)
            assertTrue(costOf(sel) <= costOf(base))
        }
    }

    @Test fun budgetIrrealisable() {
        val sel = suggestSelection(g, z, SelectionOptions(seed = 1, plants = plants, budget = 0.5))
        assertEquals(1, sel.size); assertEquals(1, sel[0].count)
        assertEquals(suggestSelection(g, z, SelectionOptions(seed = 1, plants = plants)), suggestSelection(g, z, SelectionOptions(seed = 1, plants = plants, budget = -3.0)))
    }

    @Test fun grainesDifferentes() {
        assertTrue((1..8).map { suggestSelection(g, z, SelectionOptions(seed = it, plants = plants)) }.toSet().size > 1)
    }
}

// ---- entretien
class RecommendMaintenanceTest {
    private fun mkGarden(zones: List<Zone>, maintenance: String? = null) = garden(zones, maintenance = maintenance)
    private fun massif(maintenance: String? = null, id: String = "z1") = Zone(id = id, type = "midplants", label = "Massif", shape = sq0(8.0, 6.0), maintenance = maintenance)
    private val base = ScoreContext(tminC = -5.0, zoneType = "midplants", sunLevel = "full", areaM2 = 50.0, minDimension = 6.0)
    private val plants = allPlants()

    @Test fun sansNiveauOuGreenAucuneRaison() {
        val p = by("h-lavande")
        val a = scorePlant(p, base)
        for (m in listOf(null, "green")) {
            val b = scorePlant(p, base.copy(maintenance = m))
            assertEquals(a.score, b.score)
            assertFalse(b.reasons.any { it.criterion == "entretien" })
        }
    }

    @Test fun noneRecompenseEffort1PenaliseEffort2EcarteEffort3() {
        val easy = plants.first { plantEffort(it) == 1 && scorePlant(it, base).score == 100 }
        val mid = plants.first { plantEffort(it) == 2 && scorePlant(it, base).score == 100 }
        val hard = plants.first { plantEffort(it) == 3 && scorePlant(it, base).score == 100 }
        val e = scorePlant(easy, base.copy(maintenance = "none"))
        assertEquals(Reason(true, "entretien", "Très peu d’entretien : on plante et on oublie"), e.reasons.first { it.criterion == "entretien" })
        assertTrue(e.rank!! > 100)
        val m = scorePlant(mid, base.copy(maintenance = "none"))
        assertEquals(70, m.score); assertEquals("possible", m.status)
        assertEquals(false, m.reasons.first { it.criterion == "entretien" }.ok)
        assertEquals("discouraged", scorePlant(hard, base.copy(maintenance = "none")).status)
    }

    @Test fun lowPenaliseSeulementEffort3() {
        val mid = plants.first { plantEffort(it) == 2 && scorePlant(it, base).score == 100 }
        val hard = plants.first { plantEffort(it) == 3 && scorePlant(it, base).score == 100 }
        assertEquals(100, scorePlant(mid, base.copy(maintenance = "low")).score)
        val h = scorePlant(hard, base.copy(maintenance = "low"))
        assertEquals(75, h.score)
        val r = h.reasons.first { it.criterion == "entretien" }
        assertEquals(false, r.ok)
        assertEquals("Demande pas mal d’entretien : déconseillée si vous voulez peu d’entretien", r.text)
    }

    @Test fun niveauDeLaZonePrioritaire() {
        val z = massif()
        assertEquals("green", contextForZone(mkGarden(listOf(z)), z).maintenance)
        assertEquals("low", contextForZone(mkGarden(listOf(z), "low"), z).maintenance)
        val z2 = massif("none")
        assertEquals("none", contextForZone(mkGarden(listOf(z2), "low"), z2).maintenance)
        assertEquals("green", contextForZone(mkGarden(listOf(z2), "low"), z2, maintenance = Maybe("green")).maintenance)
    }

    @Test fun noneMetLesLegeresEnTete() {
        val z = massif()
        val recs = recommendForZone(mkGarden(listOf(z), "none"), z)
        assertTrue(recs.size > 5)
        assertTrue(recs.take(5).all { plantEffort(it.plant) == 1 })
        assertFalse(recs.any { plantEffort(it.plant) == 3 })
        assertTrue(recommendForZone(mkGarden(listOf(z)), z).size > recs.size - 1)
    }

    @Test fun selectionNoneEffort1() {
        val z = massif()
        for (seed in listOf<Any>(1, 2, 3, "a")) {
            val sel = suggestSelection(mkGarden(listOf(z), "none"), z, SelectionOptions(seed = seed))
            assertTrue(sel.isNotEmpty())
            assertTrue(sel.all { plantEffort(by(it.plantId)) == 1 })
        }
    }

    @Test fun selectionLowEviteEffort3() {
        val z = massif()
        assertTrue(suggestSelection(mkGarden(listOf(z), "low"), z, SelectionOptions(seed = 4)).all { plantEffort(by(it.plantId)) <= 2 })
    }

    @Test fun determinismeOptionExpliciteEtNiveauDeZone() {
        val z = massif(); val g = mkGarden(listOf(z), "none")
        assertEquals(suggestSelection(g, z, SelectionOptions(seed = 7)), suggestSelection(g, z, SelectionOptions(seed = 7)))
        val zn = massif("none")
        assertTrue(suggestSelection(mkGarden(listOf(zn), "green"), zn, SelectionOptions(seed = 7)).all { plantEffort(by(it.plantId)) == 1 })
        val zg = massif("green")
        assertEquals(suggestSelection(mkGarden(listOf(zg), "none"), zg, SelectionOptions(seed = 7)), suggestSelection(mkGarden(listOf(zg)), zg, SelectionOptions(seed = 7)))
        assertTrue(suggestSelection(mkGarden(listOf(z)), z, SelectionOptions(seed = 7, maintenance = Maybe("none"))).all { plantEffort(by(it.plantId)) == 1 })
    }

    @Test fun retroCompatibiliteSansNiveau() {
        val z = massif()
        val a = suggestSelection(mkGarden(listOf(z)), z, SelectionOptions(seed = 5))
        assertEquals(a, suggestSelection(mkGarden(listOf(z), "green"), z, SelectionOptions(seed = 5)))
        assertTrue(a.isNotEmpty())
    }

    @Test fun surprendsMoiTientCompteDuNiveauDeChaqueZone() {
        val a = massif("none", "a"); val b = massif(null, "b")
        val res = suggestForGarden(mkGarden(listOf(a, b), "green"), seed = 3)
        assertTrue(res.first { it.zoneId == "a" }.selection.all { plantEffort(by(it.plantId)) == 1 })
        val all = suggestForGarden(mkGarden(listOf(a, b), "green"), seed = 3, maintenance = Maybe("none"))
        assertTrue(all.all { r -> r.selection.all { plantEffort(by(it.plantId)) == 1 } })
    }

    @Test fun coherenceZoneSansEntretien() {
        val hard = plants.firstOrNull { plantEffort(it) >= 2 && it.category == "perennial" } ?: plants.first { plantEffort(it) >= 2 }
        val easy = plants.first { plantEffort(it) == 1 }
        val z = massif().copy(plantings = listOf(Planting(hard.id, count = 1), Planting(easy.id, count = 1)))
        val w = checkCoherence(mkGarden(listOf(z), "none")).filter { "sans entretien" in it.text }
        assertEquals(1, w.size)
        assertTrue("demande un entretien régulier alors que cette zone est prévue sans entretien" in w[0].text)
        assertEquals("z1", w[0].zoneId)
        assertFalse(checkCoherence(mkGarden(listOf(z), "low")).any { "sans entretien" in it.text })
        assertTrue(checkCoherence(mkGarden(listOf(z.copy(maintenance = "none")), "green")).any { "sans entretien" in it.text })
        assertFalse(checkCoherence(mkGarden(listOf(z.copy(maintenance = "green")), "none")).any { "sans entretien" in it.text })
    }
}

// ---- mare
class RecommendPondTest {
    private fun jardin(w: Double, h: Double, depth: Double? = null): Pair<Garden, Zone> {
        val mare = createZone("pond", rectShape(1.0, 1.0, w, h)).copy(label = "Mare", depth = depth)
        val g = createGarden("Mare").let { it.copy(context = it.context.copy(departement = "75"), boundary = listOf(Point(0.0, 0.0), Point(40.0, 0.0), Point(40.0, 40.0), Point(0.0, 40.0)),
            boundaryClosed = true, sun = SunInfo("uniform", "full", emptyList()), zones = listOf(mare)) }
        return g to mare
    }

    @Test fun petiteMare() {
        val (g, mare) = jardin(2.0, 1.0)
        val sans = ids(recommendForZone(g, mare))
        val avec = ids(recommendForZone(g, mare, RecommendOptions(includeDiscouraged = true)))
        for (id in listOf("h-nenuphar", "h-massette", "h-jussie", "saule-tortueux")) { assertFalse(id in sans); assertFalse(id in avec) }
        assertTrue("h-populage" in sans)
        val tout = recommendForZone(g, mare, RecommendOptions(includeDiscouraged = true, includeForbidden = true))
        val nen = tout.first { it.plant.id == "h-nenuphar" }
        assertTrue(nen.forbidden); assertEquals("discouraged", nen.status)
        assertTrue(Regex("^Ne convient pas à une mare de 2 m² : Trop grande").containsMatchIn(nen.reasons.first { it.criterion == "mare" }.text))
    }

    @Test fun grandeMare() {
        val (g, mare) = jardin(6.0, 5.0)
        val sans = ids(recommendForZone(g, mare))
        assertTrue("h-nenuphar" in sans); assertTrue("h-massette" in sans)
        assertFalse("h-jussie" in ids(recommendForZone(g, mare, RecommendOptions(includeDiscouraged = true))))
    }

    @Test fun massetteSelonLaTaille() {
        val m = by("h-massette")
        fun statut(w: Double, h: Double): String { val (g, mare) = jardin(w, h); return scorePlant(m, contextForZone(g, mare)).status }
        assertEquals("discouraged", statut(3.0, 3.0)); assertEquals("discouraged", statut(4.0, 4.0))
        assertNotEquals("discouraged", statut(5.0, 4.0)) // 20 m² : seuil atteint
    }

    @Test fun scoreSansContexteDeMareInchange() {
        val r = scorePlant(by("h-nenuphar"), ScoreContext(tminC = -5.0, zoneType = "pond", sunLevel = "full", areaM2 = 4.0, minDimension = 2.0))
        assertFalse(r.reasons.any { it.criterion == "mare" })
        assertFalse(r.forbidden)
    }

    @Test fun profondeurSaisieEcarteLeNenuphar() {
        val (g, mare) = jardin(6.0, 5.0, depth = 30.0)
        assertFalse("h-nenuphar" in ids(recommendForZone(g, mare, RecommendOptions(includeDiscouraged = true))))
    }

    @Test fun neProposeJamaisEssenceInterdite() {
        for ((w, h) in listOf(2.0 to 1.0, 2.0 to 2.0, 3.0 to 3.0, 6.0 to 5.0)) {
            val (g, mare) = jardin(w, h)
            for (seed in 1..12) for (it in suggestSelection(g, mare, SelectionOptions(seed = seed))) {
                assertNotEquals("forbid", pondFit(getPlant(it.plantId), mare).level)
                assertNotEquals("h-jussie", it.plantId)
            }
        }
    }

    @Test fun quantiteAquatique() {
        val (_, mare) = jardin(6.0, 5.0)
        val n = by("h-nenuphar")
        assertTrue(suggestQuantity(n, mare) * PI * (n.widthAdult / 2) * (n.widthAdult / 2) <= 0.6 * 30)
    }

    @Test fun retroCompatibiliteAutresZones() {
        val z = createZone("midplants", rectShape(0.0, 0.0, 4.0, 3.0))
        val g = createGarden("x").copy(zones = listOf(z))
        val p = by("h-astilbe")
        val brut = maxOf(1, Math.floor(12 / (p.spacing * p.spacing) + 1e-9).toInt())
        assertTrue(suggestQuantity(p, z) <= brut)
        assertTrue(suggestQuantity(p, z) >= Math.floor(brut * 0.85))
        assertNull(contextForZone(g, z).pondArea)
    }

    @Test fun coherenceApresRedimensionnement() {
        val (g, mare) = jardin(6.0, 5.0)
        val m1 = mare.copy(plantings = listOf(Planting("h-nenuphar", count = 3)))
        assertEquals(0, checkCoherence(g.copy(zones = listOf(m1))).count { "ne convient plus" in it.text })
        val m2 = m1.copy(shape = rectShape(1.0, 1.0, 2.0, 1.0))
        val w = checkCoherence(g.copy(zones = listOf(m2))).filter { "ne convient plus" in it.text }
        assertEquals(1, w.size)
        assertTrue("Nénuphar" in w[0].text)
    }

    @Test fun saules() {
        for ((w, h) in listOf(2.0 to 1.0, 10.0 to 10.0)) {
            val (g, mare) = jardin(w, h)
            val tous = ids(recommendForZone(g, mare, RecommendOptions(includeDiscouraged = true)))
            assertEquals(emptyList(), tous.filter { pondTreeRule(getPlant(it)) == "willow" })
            for (seed in 1..15) for (it in suggestSelection(g, mare, SelectionOptions(seed = seed))) assertNotEquals("willow", pondTreeRule(getPlant(it.plantId)))
            val ecartes = recommendForZone(g, mare, RecommendOptions(includeDiscouraged = true, includeForbidden = true)).filter { it.plant.id == "saule-tortueux" }
            assertTrue(ecartes[0].forbidden)
            assertTrue("Les saules ne conviennent pas aux mares" in ecartes[0].reasons.first { it.criterion == "mare" }.text)
        }
        val bois = createZone("trees", rectShape(1.0, 1.0, 20.0, 20.0))
        val g = createGarden("x").let { it.copy(context = it.context.copy(departement = "75"), boundary = listOf(Point(0.0, 0.0), Point(40.0, 0.0), Point(40.0, 40.0), Point(0.0, 40.0)),
            boundaryClosed = true, sun = SunInfo("uniform", "full", emptyList()), zones = listOf(bois)) }
        val salix = allPlants().filter { pondTreeRule(it) == "willow" }
        val dispo = ids(recommendForZone(g, bois, RecommendOptions(includeDiscouraged = true)))
        assertTrue(salix.any { it.id in dispo })
    }
}

// ---- espacements
class RecommendSpacingTest {
    private fun jardin(type: String, shape: Shape): Pair<Garden, Zone> {
        val z = createZone(type, shape).copy(id = "zz")
        val g = createGarden("Espacement").let { it.copy(context = it.context.copy(departement = "75"), sun = SunInfo("uniform", "full", emptyList()), zones = listOf(z)) }
        return g to z
    }
    private fun verifie(g: Garden, z: Zone, sel: List<Planting>) {
        val pls = sel.map { Planting(it.plantId, count = it.count) }
        val r = packZone(z.copy(plantings = pls), pls, { id -> getPlant(id) }, PackOptions(garden = g))
        assertEquals(emptyList(), r.overflow)
        for (i in r.positions.indices) for (j in i + 1 until r.positions.size) {
            val a = r.positions[i]; val b = r.positions[j]
            val need = minDistance(getPlant(a.plantId), getPlant(b.plantId))
            val d = hypot(a.x - b.x, a.y - b.y)
            if (d < need - 1e-6) fail("${a.plantId}/${b.plantId} à $d < $need")
        }
    }
    private val cas = listOf(
        "trees" to listOf(3.0 to 3.0, 5.3 to 5.3, 8.0 to 7.0), "midplants" to listOf(2.0 to 2.0, 4.0 to 3.0, 6.0 to 4.0),
        "lawn" to listOf(3.0 to 3.0, 6.0 to 5.0, 10.0 to 8.0), "vegetable" to listOf(2.0 to 2.0, 4.0 to 3.0, 6.0 to 4.0),
        "hedge" to listOf(2.0 to 1.0, 5.0 to 1.2, 9.0 to 1.5),
    )

    @Test fun selectionRespecteLesEspacements() {
        for ((type, tailles) in cas) for ((w, h) in tailles) {
            val (g, z) = jardin(type, rectShape(0.0, 0.0, w, h))
            for (seed in 1..6) {
                val sel = suggestSelection(g, z, SelectionOptions(seed = seed))
                assertTrue(sel.isNotEmpty(), "$type $w x $h")
                sel.forEach { assertTrue(it.count!! >= 1) }
                verifie(g, z, sel)
            }
        }
    }

    @Test fun mareQuantitesBornees() {
        val (g, z) = jardin("pond", rectShape(0.0, 0.0, 4.0, 3.0))
        for (seed in 1..10) for (s in suggestSelection(g, z, SelectionOptions(seed = seed))) {
            assertTrue(s.count!! <= maxOf(1, packingCapacity(shapePolygon(z.shape, 48), getPlant(s.plantId))))
        }
    }

    @Test fun zoneDArbres28m2() {
        val (g, z) = jardin("trees", rectShape(0.0, 0.0, 5.3, 5.3))
        val sel = suggestSelection(g, z, SelectionOptions(seed = 4))
        val arbres = sel.filter { getPlant(it.plantId)!!.category == "tree" }
        val crown = arbres.sumOf { it.count!! * PI * (getPlant(it.plantId)!!.widthAdult / 2) * (getPlant(it.plantId)!!.widthAdult / 2) }
        assertTrue(crown <= 28 * 0.8 + 30)
        assertTrue(arbres.size <= 2)
    }

    @Test fun retroCompatibilite() {
        val (g, z) = jardin("midplants", rectShape(0.0, 0.0, 4.0, 3.0))
        val sel = suggestSelection(g, z, SelectionOptions(seed = 2))
        assertEquals(sel, suggestSelection(g, z, SelectionOptions(seed = 2)))
        val all = suggestForGarden(g, seed = 3)
        assertEquals("zz", all[0].zoneId)
        verifie(g, z, all[0].selection)
        assertTrue(suggestQuantity(by("h-lavande"), z) <= packingCapacity(shapePolygon(z.shape, 48), by("h-lavande")))
    }

    @Test fun zoneProposeeSansAvertissementDEspacement() {
        val (g, z) = jardin("trees", rectShape(0.0, 0.0, 5.3, 5.3))
        val z2 = z.copy(plantings = suggestSelection(g, z, SelectionOptions(seed = 7)))
        assertEquals(emptyList(), checkCoherence(g.copy(zones = listOf(z2))).filter { it.kind in listOf("surdensite", "arbres-proches", "pied-arbre") })
    }

    @Test fun surdensiteSignaleeQuandOnForce() {
        val (g, z) = jardin("midplants", rectShape(0.0, 0.0, 2.0, 2.0))
        val z2 = z.copy(plantings = listOf(Planting("h-lavande", count = 60)))
        val w = checkCoherence(g.copy(zones = listOf(z2))).filter { it.kind == "surdensite" }
        assertEquals(1, w.size)
        assertTrue("surdensité" in w[0].text)
    }
}

// ---- arbres et arbustes
class RecommendTreesShrubsTest {
    private fun jardin(): Pair<Garden, Zone> {
        val z = createZone("trees", CircleShape(Point(8.0, 6.0), 3.0))
        val g = createGarden("Arbres").let { it.copy(boundary = listOf(Point(0.0, 0.0), Point(16.0, 0.0), Point(16.0, 12.0), Point(0.0, 12.0)), boundaryClosed = true,
            context = it.context.copy(departement = "69"), zones = listOf(z)) }
        return g to z
    }

    @Test fun petitArbusteSeulement() {
        assertTrue(isSmallShrub(SimplePlant("a", category = "shrub", heightAdult = 2.0)))
        assertFalse(isSmallShrub(SimplePlant("a", category = "shrub", heightAdult = 5.0)))
        assertFalse(isSmallShrub(SimplePlant("a", category = "tree", heightAdult = 3.0)))
    }

    @Test fun petitArbustePasPenalise() {
        val sh = allPlants().first { it.category == "shrub" && it.heightAdult <= 3 && "trees" !in it.zones }
        val r = scorePlant(sh, ScoreContext(tminC = -10.0, zoneType = "trees", areaM2 = 28.0, minDimension = 6.0))
        assertNotEquals("discouraged", r.status)
        assertTrue("Petit arbuste" in r.reasons.first { it.criterion == "zone" }.text)
    }

    @Test fun grandArbusteResteDeconseille() {
        val big = allPlants().first { it.category == "shrub" }.copy(heightAdult = 6.0, zones = listOf("midplants"))
        assertEquals("discouraged", scorePlant(big, ScoreContext(tminC = -10.0, zoneType = "trees")).status)
    }

    @Test fun recommandationsDArbresContiennentArbresEtPetitsArbustes() {
        val (g, z) = jardin()
        val rec = recommendForZone(g, z)
        assertTrue(rec.any { it.plant.category == "tree" })
        assertTrue(rec.any { isSmallShrub(it.plant) })
    }

    @Test fun surprendsMoiMelangeArbresEtPetitsArbustes() {
        val (g, z) = jardin()
        for (seed in 1..5) {
            val sel = suggestSelection(g, z, SelectionOptions(seed = seed, max = 5))
            assertTrue(sel.size >= 3)
            val shrubs = sel.count { isSmallShrub(getPlant(it.plantId)) }
            assertTrue(shrubs >= 1)
            assertTrue(sel.size - shrubs >= 1)
            assertEquals(sel, suggestSelection(g, z, SelectionOptions(seed = seed, max = 5)))
        }
    }

    @Test fun autresTypesDeZoneInchanges() {
        val z = createZone("lawn", rectShape(1.0, 1.0, 6.0, 6.0))
        val sh = allPlants().first { it.category == "shrub" && "lawn" !in it.zones }
        assertFalse("Petit arbuste" in scorePlant(sh, ScoreContext(tminC = -10.0, zoneType = "lawn")).reasons.first { it.criterion == "zone" }.text)
        assertEquals("lawn", z.type)
    }
}
