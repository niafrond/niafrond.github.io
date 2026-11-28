package fr.jardin.core

import fr.jardin.core.Ambiances.plantAmbianceScore
import fr.jardin.core.Ambiances.plantAvoids
import fr.jardin.core.Maintenance.fitsMaintenance
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.math.hypot
import kotlin.test.*

// Tests de massifs.js portés : espace libre, propositions, zones, régénération, combinaison de plantes (bed-design).

private fun bedPoly(b: Bed): List<Point> = (b.shape as PolygonShape).points
private fun minDistTo(p: Point, poly: List<Point>): Double {
    var best = Double.POSITIVE_INFINITY
    for (i in poly.indices) {
        val a = poly[i]; val b = poly[(i + 1) % poly.size]
        val dx = b.x - a.x; val dy = b.y - a.y; val l2 = (dx * dx + dy * dy).let { if (it == 0.0) 1.0 else it }
        val t = maxOf(0.0, minOf(1.0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
        best = minOf(best, hypot(p.x - a.x - t * dx, p.y - a.y - t * dy))
    }
    return best
}
private fun tree(id: String, x: Double, y: Double, h: Double, w: Double) = Existing(id = id, kind = "tree", x = x, y = y, height = h, width = w, keep = true)

class FreeSpaceTest {
    private val g = gardenA()
    private val fs = Massifs.freeSpace(g)
    private fun free(x: Double, y: Double) = fs.isFree(x, y)

    @Test fun exclutMaisonTerrassePelousePiscineMobilierHorsContour() {
        assertFalse(free(6.0, 0.8)); assertFalse(free(5.0, 3.0)); assertFalse(free(5.0, 6.0)); assertFalse(free(10.2, 6.2))
        assertFalse(free(10.2, 4.4)); assertTrue(free(10.2, 3.9))
        assertFalse(free(1.2, 4.0)); assertFalse(free(1.0, 4.5)); assertTrue(free(1.0, 4.7))
        assertFalse(free(-1.0, 3.0)); assertTrue(free(1.0, 7.0))
    }

    @Test fun pelouseLibereeAvecAllowLawnEtGrilleCoherente() {
        val fl = Massifs.freeSpace(g, allowLawn = true)
        assertTrue(fl.isFree(5.0, 6.0))
        assertTrue(fl.freeArea > fs.freeArea + 10)
        var n = 0
        for (j in 0 until fs.ny) for (i in 0 until fs.nx) {
            val c = fs.cellCenter(i, j)
            assertEquals(fs.grid[j * fs.nx + i].toInt() != 0, fs.isFree(c.x, c.y))
            if (fs.grid[j * fs.nx + i].toInt() != 0) n++
        }
        assertEquals(n * 0.0625, fs.freeArea, 1e-6)
    }

    @Test fun mareArbreHouppierAlleeMassifOuverture() {
        val h = gardenA().let { it.copy(
            zones = it.zones + listOf(
                createZone("pond", CircleShape(Point(2.0, 7.5), 0.6)), createZone("trees", CircleShape(Point(6.0, 8.0), 0.8)),
                createZone("path", LineShape(listOf(Point(9.0, 2.0), Point(9.0, 4.0)), 1.0)), createZone("midplants", rectShape(0.2, 2.0, 1.5, 1.2)),
            ),
            obstacles = it.obstacles + Obstacle(id = "a", kind = "tree", center = Point(4.0, 4.5), radius = 0.5, height = 5.0),
        ) }
        val f = Massifs.freeSpace(h)
        assertFalse(f.isFree(2.0, 7.5 - 0.6 - 0.3)); assertTrue(f.isFree(2.0, 7.5 - 0.6 - 0.7))
        assertFalse(f.isFree(6.0, 8.0)); assertFalse(f.isFree(9.0, 3.0)); assertFalse(f.isFree(1.0, 2.5)); assertFalse(f.isFree(4.0, 4.5 + 0.7))
        assertTrue(f.freeArea < fs.freeArea)
    }

    @Test fun degagementDevantUnePorte() {
        val h = gardenA().copy(zones = emptyList(), items = emptyList())
        val before = Massifs.freeSpace(h)
        val h2 = h.copy(openings = listOf(createOpening("door", OpeningRef("obstacle", 2, obstacleId = "maison"), 0.5)))
        val f = Massifs.freeSpace(h2)
        assertTrue(before.isFree(6.0, 2.2))
        assertFalse(f.isFree(6.0, 2.2)); assertTrue(f.isFree(6.0, 2.6)); assertTrue(f.isFree(8.0, 2.2))
    }

    @Test fun composantesTrieesEtAireTotale() {
        val comps = fs.components()
        assertTrue(comps.isNotEmpty())
        for (i in 1 until comps.size) assertTrue(comps[i - 1].areaM2 >= comps[i].areaM2)
        assertEquals(fs.freeArea, comps.sumOf { it.areaM2 }, 1e-6)
    }

    @Test fun empreinteDUnePlanteExistante() {
        val h = gardenBig().copy(existing = listOf(tree("e1", 14.0, 11.0, 8.0, 4.0)))
        val f = Massifs.freeSpace(h)
        assertFalse(f.isFree(14.0, 11.0)); assertFalse(f.isFree(14.0 + 2.2, 11.0)); assertTrue(f.isFree(14.0 + 2.8, 11.0))
    }
}

class ProposeBedsTest {
    private val g = gardenA()

    @Test fun massifsValides() {
        for (seed in 1..3) {
            val beds = Massifs.proposeBeds(g, BedOptions(seed = seed, design = false))
            assertTrue(beds.isNotEmpty())
            val fs = Massifs.freeSpace(g)
            for (b in beds) {
                assertTrue(b.shape is PolygonShape)
                assertTrue(bedPoly(b).size in 8..24)
                assertTrue(polygonInside(bedPoly(b), g.boundary))
                assertTrue(b.areaM2 >= 2 - 0.05); assertTrue(b.areaM2 <= 20)
                assertTrue(b.widthM >= 0.6)
                assertTrue(b.role in listOf("bordure", "pied-de-mur", "ilot", "angle", "haie-fleurie"))
                assertEquals("full", b.sunLevel)
                for (z in g.zones) assertTrue(overlapArea(bedPoly(b), shapePolygon(z.shape)) < 0.1)
                for (it in g.items) assertTrue(overlapArea(bedPoly(b), itemPolygon(it)) < 0.1)
                for (ob in g.obstacles) if (ob.points != null) assertTrue(overlapArea(bedPoly(b), ob.points) < 0.1)
                for (p in bedPoly(b)) assertTrue(minDistTo(p, listOf(Point(10.2, 6.2), Point(10.2001, 6.2))) - 1 > 0.95 - 0.001)
                var y = 0.1
                while (y < 9) { var x = 0.1; while (x < 12) {
                    if (pointInPolygon(Point(x, y), bedPoly(b))) {
                        val k = Math.floor((y - fs.minY) / fs.cell).toInt() * fs.nx + Math.floor((x - fs.minX) / fs.cell).toInt()
                        assertTrue(fs.isFree(x, y) || fs.grid[k].toInt() == 0)
                    }
                    x += 0.4 }; y += 0.4 }
            }
            for (i in beds.indices) for (j in i + 1 until beds.size) assertTrue(overlapArea(bedPoly(beds[i]), bedPoly(beds[j])) < 0.1)
        }
    }

    @Test fun coverageRespecteA25Pourcent() {
        val fs = Massifs.freeSpace(g)
        for (coverage in listOf(0.3, 0.5)) for (seed in 1..3) {
            val beds = Massifs.proposeBeds(g, BedOptions(seed = seed, coverage = coverage, design = false))
            val ratio = beds.sumOf { it.areaM2 } / (coverage * fs.freeArea)
            assertTrue(ratio >= 0.75 && ratio <= 1.25, "ratio $ratio")
        }
    }

    @Test fun deterministeEtVariantes() {
        val a = Massifs.proposeBeds(g, BedOptions(seed = 5))
        assertEquals(a, Massifs.proposeBeds(g, BedOptions(seed = 5)))
        val sigs = (1..6).map { s -> Massifs.proposeBeds(g, BedOptions(seed = s, design = false)).map { bedPoly(it) } }.toSet()
        assertTrue(sigs.size >= 3)
    }

    @Test fun stylesMaxBedsDescriptionsEtPlantations() {
        val big = gardenBig()
        val borders = Massifs.proposeBeds(big, BedOptions(seed = 1, style = "borders", design = false))
        assertTrue(borders.isNotEmpty()); assertTrue(borders.all { it.role != "ilot" })
        val islands = Massifs.proposeBeds(big, BedOptions(seed = 1, style = "islands", design = false, coverage = 0.3))
        assertTrue(islands.isNotEmpty()); assertTrue(islands.all { it.role == "ilot" })
        assertTrue(Massifs.proposeBeds(big, BedOptions(seed = 1, maxBeds = 2, design = false)).size <= 2)
        val full = Massifs.proposeBeds(big, BedOptions(seed = 1))
        for (b in full) {
            assertTrue(b.plantings.size >= 3)
            assertTrue(b.summary!!.bloomMonths.isNotEmpty())
            assertTrue(Regex("\\d").containsMatchIn(b.why))
        }
        assertTrue(full.any { Regex("^Bordure de \\d+(,\\d)? m le long de ").containsMatchIn(it.why) || it.why.startsWith("Pied de mur") || Regex("^(Haie fleurie|Massif d’angle|Îlot)").containsMatchIn(it.why) })
    }

    @Test fun jardinSansVideOuSansContour() {
        val h = gardenA().let { it.copy(zones = it.zones + createZone("other", rectShape(-1.0, -1.0, 14.0, 11.0))) }
        assertEquals(emptyList(), Massifs.proposeBeds(h, BedOptions(seed = 1)))
        assertEquals(emptyList(), Massifs.proposeBeds(gardenA().copy(boundary = emptyList()), BedOptions(seed = 1)))
        assertEquals(emptyList(), Massifs.proposeBeds(g, BedOptions(seed = 1, coverage = 0.0)))
    }

    @Test fun arbreExistantAuMilieuNEstRecouvertParAucunMassif() {
        val h = gardenBig().let { it.copy(zones = it.zones.filter { z -> z.type != "lawn" }, obstacles = it.obstacles.filter { o -> o.kind == "house" }, items = emptyList(),
            existing = listOf(tree("e1", 10.0, 10.5, 9.0, 5.0))) }
        for (style in listOf("mixed", "islands")) for (seed in 1..2) {
            val beds = Massifs.proposeBeds(h, BedOptions(seed = seed, style = style, coverage = 0.6, design = false))
            assertTrue(beds.isNotEmpty())
            for (b in beds) {
                for (p in bedPoly(b)) assertTrue(hypot(p.x - 10, p.y - 10.5) >= 2.5 + 0.3 - 0.05)
                assertTrue(b.sunLevel == null || b.sunLevel in listOf("full", "partial", "shade"))
            }
        }
    }

    @Test fun ombreDUnGrandArbreCoteNord() {
        val h = gardenBig().let { it.copy(sun = SunInfo("uniform", "full", emptyList()), zones = emptyList(),
            obstacles = listOf(Obstacle(id = "maison", kind = "house", points = listOf(Point(4.0, 0.0), Point(16.0, 0.0), Point(16.0, 3.0), Point(4.0, 3.0)), height = 6.0)),
            items = emptyList(), existing = listOf(tree("e1", 10.0, 12.0, 10.0, 4.0))) }
        val beds = Massifs.proposeBeds(h, BedOptions(seed = 1, design = false, coverage = 0.7))
        val north = beds.filter { b -> bedPoly(b).all { p -> hypot(p.x - 10, p.y - 12) < 9 && p.y < 12 - 2.3 } }
        for (b in north) assertTrue(b.sunLevel in listOf("partial", "shade"))
        assertTrue(beds.any { it.sunLevel == "full" })
    }

    @Test fun troisCentsM2EnTempsBorne() {
        val big = gardenBig()
        val t = System.currentTimeMillis()
        val beds = Massifs.proposeBeds(big, BedOptions(seed = 1))
        assertTrue(System.currentTimeMillis() - t < 5000 * 4)
        assertTrue(beds.size > 2)
        for (b in beds) assertTrue(polygonArea(bedPoly(b)) <= 20.5)
    }

    @Test fun exports() {
        assertEquals(listOf("lowplants", "midplants", "tallplants"), Massifs.FLOWER_ZONE_TYPES)
        assertTrue(Massifs.isFlowerZone(createZone("midplants", rectShape(0.0, 0.0, 1.0, 1.0))))
        assertFalse(Massifs.isFlowerZone(createZone("terrace", rectShape(0.0, 0.0, 1.0, 1.0))))
        assertFalse(Massifs.isFlowerZone(null))
    }

    @Test fun ensoleillementEstimeQuandAucunReleve() {
        val h = gardenA().copy(sun = SunInfo(), context = gardenA().context.copy(location = LatLon(48.85, 2.35)))
        val beds = Massifs.proposeBeds(h, BedOptions(seed = 1, design = false))
        assertTrue(beds.isNotEmpty())
        assertTrue(beds.all { it.sunLevel in listOf("full", "partial", "shade") })
    }
}

class BedZonesTest {
    private val g = gardenBig()
    private val beds = Massifs.proposeBeds(g, BedOptions(seed = 4, ambiance = "bucolique"))

    @Test fun modeleBedModeEtAuto() {
        assertEquals("manual", createGarden().context.bedMode)
        assertEquals("manual", bedModeOf(createGarden()))
        assertEquals("auto", bedModeOf(createGarden().let { it.copy(context = it.context.copy(bedMode = "auto")) }))
        assertEquals("manual", bedModeOf(null))
        assertFalse(createZone("midplants", rectShapeZ()).auto)
    }
    private fun rectShapeZ() = rectShape(0.0, 0.0, 2.0, 2.0)

    @Test fun zonesAutoPretesAInserer() {
        val zones = Massifs.bedsToZones(g, beds, ambiance = Maybe("bucolique"))
        assertEquals(beds.size, zones.size)
        zones.forEachIndexed { i, z ->
            assertTrue(z.type in Massifs.FLOWER_ZONE_TYPES); assertTrue(Massifs.isFlowerZone(z))
            assertTrue(z.auto)
            assertEquals("Massif bucolique n°${i + 1}", z.label)
            assertEquals("bucolique", z.ambiance)
            assertTrue(z.shape is PolygonShape)
            assertEquals(beds[i].plantings, z.plantings)
            val info = z.autoInfo!!.jsonObject
            assertEquals(beds[i].role, info["role"]!!.let { (it as JsonPrimitive).content })
            assertEquals(4.0, (info["seed"] as JsonPrimitive).content.toDouble())
            assertTrue(beds[i].why in (info["why"] as JsonPrimitive).content)
        }
        assertEquals(zones.size, zones.map { it.id }.toSet().size)
    }

    @Test fun sansAmbianceEtTypeSelonHauteur() {
        val zones = Massifs.bedsToZones(g, Massifs.proposeBeds(g, BedOptions(seed = 4)))
        assertEquals("Massif n°1", zones[0].label)
        assertNull(zones[0].ambiance)
        val low = Bed(id = "x", role = "bordure", shape = beds[0].shape, plantings = listOf(Planting("h-trefle-nain", count = 5)))
        val tall = Bed(id = "y", role = "bordure", shape = beds[0].shape, plantings = listOf(Planting("h-miscanthus", count = 3)))
        val hedge = Bed(id = "w", role = "haie-fleurie", shape = beds[0].shape)
        assertNotNull(getPlant("h-trefle-nain"))
        val (zl, zt, zh) = Massifs.bedsToZones(g, listOf(low, tall, hedge))
        assertEquals("lowplants", zl.type); assertEquals("tallplants", zt.type); assertEquals("tallplants", zh.type)
    }

    @Test fun jardinValideApresInsertion() {
        for (garden in listOf(gardenA(), gardenBig())) {
            val zones = Massifs.bedsToZones(garden, Massifs.proposeBeds(garden, BedOptions(seed = 2)))
            assertTrue(zones.isNotEmpty())
            val before = validateGarden(garden)
            val g2 = garden.copy(zones = garden.zones + zones)
            val v = validateGarden(g2)
            assertTrue(v.ok); assertEquals(emptyList(), v.errors)
            assertEquals(emptyList(), v.warnings.filter { it !in before.warnings }.filter { "Massif" in it })
        }
    }

    @Test fun numerotationContinueApresLesZonesAuto() {
        val h = gardenBig()
        val first = Massifs.bedsToZones(h, Massifs.proposeBeds(h, BedOptions(seed = 1, maxBeds = 2, coverage = 0.3)))
        val h2 = h.copy(zones = h.zones + first)
        val next = Massifs.bedsToZones(h2, Massifs.proposeBeds(h2, BedOptions(seed = 2, maxBeds = 1, coverage = 0.2)))
        assertEquals("Massif n°${first.size + 1}", next[0].label)
        assertFalse(h2.zones.any { it.id == next[0].id })
    }
}

class RegenerateTest {
    @Test fun refaitUniquementLesMassifsNonGardes() {
        val g = gardenBig()
        val manual = createZone("midplants", rectShape(0.5, 12.5, 2.0, 1.5))
        val g0 = g.copy(zones = g.zones + manual)
        val first = Massifs.regenerate(g0, seed = 1)
        assertTrue(first.added.size > 1)
        val g1 = g0.copy(zones = first.zones)
        val keep = first.added[0].id
        val second = Massifs.regenerate(g1, keepIds = listOf(keep), seed = 7)
        assertEquals(first.added.size - 1, second.removed.size)
        assertFalse(keep in second.removed)
        assertEquals(listOf(keep), second.kept)
        assertTrue(second.zones.any { it.id == manual.id && !it.auto })
        assertSame(first.added[0], second.zones.first { it.id == keep })
        assertTrue(second.added.all { it.auto && (it.autoInfo!!.jsonObject["seed"] as JsonPrimitive).content.toDouble() == 7.0 })
        val v = validateGarden(g1.copy(zones = second.zones))
        assertEquals(emptyList(), v.errors)
        assertEquals(emptyList(), v.warnings.filter { "Massif" in it && "chevauchent" in it })
        assertSame(first.zones, g1.zones)
    }

    @Test fun sansKeepIdsToutEstRefaitGraineSuivante() {
        val g = gardenA()
        val first = Massifs.regenerate(g, seed = 3)
        val g1 = g.copy(zones = first.zones)
        val again = Massifs.regenerate(g1)
        assertEquals(first.added.map { it.id }.sorted(), again.removed.sorted())
        assertTrue(again.added.all { (it.autoInfo!!.jsonObject["seed"] as JsonPrimitive).content.toDouble() == 4.0 })
    }
}

class DesignBedTest {
    private val g = gardenA()
    private fun poly(x: Double, y: Double, w: Double, h: Double) = rectShape(x, y, w, h)
    private fun bed(shape: Shape = poly(0.0, 5.0, 6.0, 1.5), areaM2: Double = 9.0, widthM: Double = 1.5, sunLevel: String? = "full", role: String = "bordure", id: String = "b1", given: Boolean = true) =
        Bed(id = id, role = role, shape = shape, areaM2 = areaM2, widthM = widthM, sunLevel = sunLevel, sunLevelGiven = given)
    private fun plantsOf(d: DesignResult) = d.plantings.map { getPlant(it.plantId)!! }
    private fun months(d: DesignResult) = d.summary.bloomMonths.filter { it in 3..10 }.toSet()
    private fun opts(seed: Int = 1, tminC: Double? = null, ambiance: String? = null, maintenance: String? = null, palette: String? = null, budget: Double? = null, plants: List<Plant>? = null) =
        DesignOptions(seed = seed, tminC = tminC, ambiance = ambiance?.let { Maybe(it) }, maintenance = maintenance?.let { Maybe(it) }, palette = palette, budget = budget, plants = plants)

    @Test fun cinqADixEssencesDeterministe() {
        val d = Massifs.designBed(g, bed(), opts(3, -15.0))
        assertTrue(d.plantings.size in 5..10)
        d.plantings.forEach { assertNotNull(getPlant(it.plantId)); assertTrue(it.count!! >= 1) }
        assertEquals(d.plantings.size, d.plantings.map { it.plantId }.toSet().size)
        assertEquals(d, Massifs.designBed(g, bed(), opts(3, -15.0)))
    }

    @Test fun floraisonContinue() {
        for (sun in listOf("full", "partial", "shade")) for (seed in 1..4) {
            val d = Massifs.designBed(g, bed(sunLevel = sun), opts(seed, -15.0))
            assertTrue(months(d).size >= 7)
            val ps = plantsOf(d)
            for (season in listOf(listOf(3, 4, 5), listOf(6, 7, 8), listOf(9, 10))) assertTrue(ps.count { p -> p.bloom.any { it in season } } >= 2)
        }
    }

    @Test fun etagement() {
        for (seed in 1..3) {
            val d = Massifs.designBed(g, bed(), opts(seed, -15.0))
            assertTrue(d.summary.layers >= 3)
            val hs = plantsOf(d).map { it.heightAdult }
            assertTrue(hs.max() / hs.min() > 2)
            assertTrue(plantsOf(d).all { habitOf(it) != null })
        }
    }

    @Test fun rusticiteEtSoleil() {
        for (sun in listOf("full", "shade")) {
            val d = Massifs.designBed(g, bed(sunLevel = sun), opts(2, -15.0))
            for (p in plantsOf(d)) { assertTrue(p.hardiness <= -15); assertTrue(sun in p.sun) }
        }
    }

    @Test fun aucuneInvasiveNiToxiquePresDeLaTerrasse() {
        val near = bed(poly(3.0, 4.1, 5.0, 0.9), 4.5, 0.9)
        for (seed in 1..3) {
            val d = Massifs.designBed(g, near, opts(seed, -15.0))
            assertTrue(d.plantings.size >= 3)
            for (p in plantsOf(d)) { assertFalse(p.invasive); assertFalse(p.toxic) }
        }
        for (p in plantsOf(Massifs.designBed(g, bed(), opts(1)))) assertFalse(p.invasive)
    }

    @Test fun ambianceRespectee() {
        for (ambiance in listOf("bucolique", "zen", "pollinisateurs")) {
            val d = Massifs.designBed(g, bed(), opts(1, -15.0, ambiance))
            val ps = plantsOf(d)
            assertTrue(ps.all { ambiance !in plantAvoids(it) })
            assertTrue(ps.sumOf { plantAmbianceScore(it, ambiance) } / ps.size >= 0.6)
            assertTrue("ambiance" in d.why)
        }
    }

    @Test fun niveauDEntretienRespecte() {
        for (level in listOf("low", "none")) for (p in plantsOf(Massifs.designBed(g, bed(), opts(1, maintenance = level)))) assertTrue(fitsMaintenance(p, level).ok)
    }

    @Test fun harmonieDesCouleurs() {
        for (seed in 1..5) for (palette in listOf("auto", "chaud", "froid", "pastel")) {
            val d = Massifs.designBed(g, bed(), opts(seed, -15.0, palette = palette))
            val fams = plantsOf(d).filter { it.bloom.isNotEmpty() }.mapNotNull { Massifs.colorFamily(it.flowerColor) }.toSet()
            assertTrue(fams.size <= 3); assertTrue(d.summary.families.size <= 3)
            assertTrue("palette" in d.why)
        }
    }

    @Test fun paletteFroid() {
        val d = Massifs.designBed(g, bed(), opts(1, -15.0, palette = "froid"))
        val fams = d.summary.families
        assertTrue(fams.count { it in listOf("bleu-violet", "blanc", "vert") } >= fams.size - 1)
    }

    @Test fun feuillagePersistantEtMellipheres() {
        val d = Massifs.designBed(g, bed(), opts(1, -15.0))
        val ps = plantsOf(d)
        assertTrue(ps.count { it.foliage == "evergreen" } >= 1)
        assertTrue(ps.count { it.melliferous } >= 2)
        assertEquals(ps.count { it.melliferous }, d.summary.melliferous)
        assertTrue(Regex("^\\d+ mois de floraison \\(\\w+ à \\w+\\), \\d+ hauteurs?, palette .+, \\d+ essences? mellifères?").containsMatchIn(d.why), d.why)
    }

    @Test fun budgetRespecte() {
        for (seed in 1..4) {
            val free = Massifs.designBed(g, bed(), opts(seed, -15.0))
            val d = Massifs.designBed(g, bed(), opts(seed, -15.0, budget = 150.0))
            assertTrue(d.summary.costEur <= 150)
            assertTrue(d.summary.costEur <= maxOf(150.0, free.summary.costEur))
            assertTrue(d.plantings.size >= 5)
        }
    }

    @Test fun quantitesCoherentesAvecLaSurface() {
        for (area in listOf(3.0, 9.0, 18.0)) {
            val w = area / 6
            val d = Massifs.designBed(g, bed(poly(0.0, 5.0, 6.0, w), area, w), opts(1, -15.0))
            var footprint = 0.0
            for (pl in d.plantings) { val p = getPlant(pl.plantId)!!; val s = if (p.spacing > 0) p.spacing else p.widthAdult; footprint += pl.count!! * s * s }
            assertTrue(footprint / area > 0.3); assertTrue(footprint / area < 1.3)
            assertTrue(Math.abs(d.summary.density - footprint / area) < 0.1)
        }
        fun count(area: Double) = Massifs.designBed(g, bed(poly(0.0, 5.0, 6.0, area / 6), area, area / 6), opts(1, -15.0)).plantings.sumOf { it.count!! }
        assertTrue(count(18.0) > count(3.0))
    }

    @Test fun deuxAlternativesDifferentes() {
        for (seed in 1..2) {
            val d = Massifs.designBed(g, bed(), opts(seed, -15.0, "bucolique"))
            assertEquals(2, d.alternatives.size)
            fun sig(p: List<Planting>) = p.map { it.plantId }.sorted().joinToString("|")
            assertEquals(3, setOf(sig(d.plantings), sig(d.alternatives[0].plantings), sig(d.alternatives[1].plantings)).size)
            for (a in d.alternatives) { assertTrue(a.plantings.size >= 5); assertTrue(a.why.isNotEmpty()); assertTrue(a.summary.bloomMonths.isNotEmpty()) }
            assertNotEquals(d.alternatives[0].palette, d.alternatives[1].palette)
        }
    }

    @Test fun sousBoisPresDUnGrandArbreExistant() {
        val h = gardenBig().copy(existing = listOf(tree("e1", 10.0, 11.0, 9.0, 5.0)))
        val b = bed(poly(8.0, 9.0, 4.0, 2.0), 8.0, 2.0, "partial")
        val d = Massifs.designBed(h, b, opts(1, -15.0))
        assertTrue("sous-bois" in d.why)
        val ps = plantsOf(d)
        assertEquals(ps.size, ps.count { "shade" in it.sun || "partial" in it.sun })
        assertTrue(ps.count { "shade" in it.sun } >= 2)
    }

    @Test fun catalogueInjecte() {
        fun mk(id: String, bloom: List<Int> = listOf(6), h: Double = 0.6, color: String = "#3355cc") = Plant(id = id, commonName = id, latinName = "$id x", category = "perennial", heightAdult = h,
            widthAdult = 0.5, sun = listOf("full"), hardiness = -20.0, water = "medium", foliage = "deciduous", bloom = bloom, zones = listOf("midplants"), maintenance = "low",
            spacing = 0.5, priceEur = 5.0, priceUnit = "plant", flowerColor = color)
        val plants = listOf(mk("a", listOf(3, 4)), mk("b", listOf(5, 6), 1.4), mk("c", listOf(7, 8), 0.3), mk("d", listOf(9, 10), 0.8, "#ffffff"), mk("e", listOf(6, 7), 0.5), mk("f", listOf(8, 9), 1.8))
        val d = Massifs.designBed(g, bed(), opts(1, plants = plants))
        assertTrue(d.plantings.all { p -> plants.any { it.id == p.plantId } })
        assertTrue(d.plantings.size >= 5)
    }

    @Test fun proposeBedsBudgetReparti() {
        val beds = Massifs.proposeBeds(gardenBig(), BedOptions(seed = 2, budget = 1200.0))
        assertTrue(beds.isNotEmpty())
        assertTrue(beds.sumOf { it.summary!!.costEur } <= 1200)
    }

    @Test fun ensoleillementCalculeSiAbsent() {
        val d1 = Massifs.designBed(g, bed(sunLevel = null, given = false), opts(1, -15.0))
        val d2 = Massifs.designBed(g, bed(sunLevel = "full"), opts(1, -15.0))
        assertEquals(d1, d2) // jardin A : plein soleil uniforme
    }

    @Test fun catalogueVideDonneUnResultatVide() {
        val d = Massifs.designBed(g, bed(), opts(1, plants = emptyList()))
        assertEquals(0, d.plantings.size)
        assertEquals("Aucune essence du catalogue ne convient à ce massif", d.why)
        assertEquals(0, d.alternatives.size)
    }
}
