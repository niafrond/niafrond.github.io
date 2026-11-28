package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.math.hypot
import kotlin.test.*

class SpacingTest {
    private val tree = SimplePlant("t", "Chêne", "Quercus", "tree", 15.0, 8.0, spacing = 8.0)
    private val shrub = SimplePlant("s", "Arbuste", "Zzz", "shrub", 1.5, 1.2, spacing = 1.0)
    private val rose = SimplePlant("r", "Rose", "Rosa", "perennial", 0.5, 0.5, spacing = 0.4)
    private val lookup = GoldenFixtures.lookupOf(listOf(tree, shrub, rose))
    private fun rect(w: Double, h: Double) = PolygonShape(listOf(Point(0.0, 0.0), Point(w, 0.0), Point(w, h), Point(0.0, h)))

    // ---- portés de spacing.test.js / place-plants.test.js (cas essentiels)
    @Test fun couchesEtDistances() {
        assertEquals("canopy", plantLayer(tree)); assertEquals("mid", plantLayer(shrub)); assertEquals("low", plantLayer(rose))
        assertEquals("mid", plantLayer(null))
        assertEquals(0.8, minDistance(tree, rose)); assertEquals(1 + 1.2 / 2, minDistance(tree, shrub), 1e-12)
        assertEquals(8.0, minDistance(tree, tree), 1e-12)
        assertEquals(0.4, minDistance(rose, rose), 1e-12)
        assertEquals(0.5, edgeMargin(shrub), 1e-12); assertEquals(0.8, edgeMargin(tree), 1e-12)
        assertEquals(7.5, clearanceFromBuilding(tree), 1e-12); assertEquals(0.0, clearanceFromBuilding(rose))
        assertEquals("40 cm", formatSpacing(rose)); assertEquals("1,5 m", formatSpacing(SimplePlant("a", spacing = 1.5)))
    }

    @Test fun placementDeterministeEtDistances() {
        val z = createZone("midplants", rect(6.0, 4.0)).copy(plantings = listOf(Planting("s", count = 3), Planting("r", count = 10)))
        val a = packZone(z, z.plantings, lookup, PackOptions(seed = "x"))
        val b = packZone(z, z.plantings, lookup, PackOptions(seed = "x"))
        assertEquals(a, b)
        assertEquals(13, a.positions.size); assertTrue(a.overflow.isEmpty())
        for (i in a.positions.indices) for (j in i + 1 until a.positions.size) {
            val p = a.positions[i]; val q = a.positions[j]
            val need = minDistance(lookup(p.plantId), lookup(q.plantId))
            assertTrue(hypot(p.x - q.x, p.y - q.y) >= need - 1e-6, "trop proches : ${p.plantId} ${q.plantId}")
        }
        val c = packZone(z, z.plantings, lookup, PackOptions(seed = "y"))
        assertNotEquals(a.positions, c.positions)
    }

    @Test fun debordementEtAjustement() {
        val z = createZone("midplants", rect(2.0, 2.0)).copy(id = "z-fixe", plantings = listOf(Planting("r", count = 200)))
        val r = packZone(z, z.plantings, lookup)
        assertEquals(1, r.overflow.size); assertTrue(r.overflow[0].placed < 200)
        val fit = fitQuantities(z, z.plantings, lookup)
        assertTrue(fit[0].count!! in 1..r.overflow[0].placed) // l'ajustement ne dépasse jamais ce qui tenait au premier passage
        assertTrue(packZone(z.copy(plantings = fit), fit, lookup).overflow.isEmpty())
    }

    @Test fun repartition() {
        val z = createZone("midplants", rect(10.0, 8.0))
        val q = allocateQuantities(z, listOf(tree, shrub, rose))
        assertEquals(listOf("t", "s", "r"), q.map { it.plantId })
        assertTrue(q.all { it.count >= 1 })
        assertEquals(listOf(1, 1), allocateQuantities(z.copy(shape = null), listOf(tree, shrub)).map { it.count })
        assertEquals(1, packingCapacity(rect(0.3, 0.3).points, tree).coerceAtMost(1))
    }

    @Test fun avertissements() {
        val z = createZone("trees", rect(5.0, 3.0)).copy(plantings = listOf(Planting("t", count = 4)))
        val w = checkSpacing(null, z, lookup)
        assertTrue(w.any { it.kind == "surdensite" })
        assertTrue(checkSpacing(null, z.copy(plantings = emptyList()), lookup).isEmpty())
    }

    // ---- golden
    private val o = loadGolden("spacing")
    private val g = GoldenFixtures.garden(o["garden"]!!)
    private val plants = GoldenFixtures.plants(o["plants"]!!)
    private val glookup = GoldenFixtures.lookupOf(plants)
    private val zones = o["zones"]!!.jsonArray.map { zoneOf(it) }
    private fun zone(id: String) = zones.first { it.id == id }
    private fun pl(id: String) = plants.first { it.id == id }

    private fun jpack(r: PackResult): JsonElement = buildJsonObject {
        put("positions", JsonArray(r.positions.map { p ->
            buildJsonObject {
                put("plantId", p.plantId); put("x", jn(p.x)); put("y", jn(p.y)); put("gi", jn(p.gi)); put("k", jn(p.k))
                if (p.forced) put("forced", true); if (p.row) put("row", true); if (p.wall) put("wall", true)
            }
        }))
        put("overflow", JsonArray(r.overflow.map { buildJsonObject { put("plantId", it.plantId); put("wanted", jn(it.wanted)); put("placed", jn(it.placed)); put("gi", jn(it.gi)) } }))
        r.maxima?.let { put("maxima", JsonArray(it.map { m -> jn(m) })) }
    }

    @Test fun golden() {
        o["layer"]!!.jsonArray.forEachIndexed { i, e ->
            val p = plants[i]
            assertJsonClose(e, buildJsonObject {
                put("layer", plantLayer(p)); put("spacing", jn(spacingOf(p))); put("foot", jn(footRadius(p))); put("margin", jn(edgeMargin(p)))
                put("fmt", formatSpacing(p)); put("clr", jn(clearanceFromBuilding(p))); put("clr9", jn(clearanceFromBuilding(p, 9.0)))
            }, "layer ${p.id}")
        }
        val ln = o["layerNull"]!!.jsonArray
        assertEquals(ln[0].jsonPrimitive.content, plantLayer(null)); assertEquals(dbl(ln[1])!!, spacingOf(null), 1e-12)
        assertEquals(dbl(ln[2])!!, footRadius(null), 1e-12); assertEquals(dbl(ln[3])!!, edgeMargin(null), 1e-12); assertEquals(ln[4].jsonPrimitive.content, formatSpacing(null))
        val sub = o["subIds"]!!.jsonArray.map { pl(it.jsonPrimitive.content) }
        o["minDist"]!!.jsonArray.forEachIndexed { i, row ->
            row.jsonArray.forEachIndexed { j, e -> assertEquals(dbl(e)!!, minDistance(sub[i], sub[j]), 1e-9, "minDist ${sub[i].id} ${sub[j].id}") }
        }
        o["usable"]!!.jsonArray.forEachIndexed { i, e -> assertEquals(dbl(e)!!, usableArea(g.zones[i]), 1e-9, "usable$i") }
        for (e in o["capacity"]!!.jsonArray) {
            val j = e.jsonObject
            assertEquals(j["r"]!!.jsonPrimitive.int, packingCapacity(shapePolygon(zone(j["z"]!!.jsonPrimitive.content).shape, 48), pl(j["p"]!!.jsonPrimitive.content)), "capacity $j")
        }
        val bedPoly = shapePolygon(zone("z_bed").shape, 48)
        val per = sub.first { it.category == "perennial" }
        val co = o["capacityObs"]!!.jsonArray
        assertEquals(co[0].jsonObject["r"]!!.jsonPrimitive.int, packingCapacity(bedPoly, per, listOf(PackObstacle(10.0, 3.0, sub[0]))))
        assertEquals(co[1].jsonObject["r"]!!.jsonPrimitive.int, packingCapacity(bedPoly, per, listOf(PackObstacle(10.0, 3.0, r = 2.0), PackObstacle(9.5, 2.0, sub[3])), 0.1))
        assertEquals(co[2].jsonObject["r"]!!.jsonPrimitive.int, packingCapacity(bedPoly, per, emptyList(), 0.0))
        val ce = o["capacityEdge"]!!.jsonArray
        assertEquals(ce[0].jsonPrimitive.int, packingCapacity(null, sub[0])); assertEquals(ce[1].jsonPrimitive.int, packingCapacity(bedPoly, null))
        assertEquals(ce[2].jsonPrimitive.int, packingCapacity(listOf(Point(0.0, 0.0), Point(0.2, 0.0), Point(0.2, 0.2)), sub[0]))
        assertEquals(ce[3].jsonPrimitive.int, packingCapacity(listOf(Point(0.0, 0.0), Point(400.0, 0.0), Point(400.0, 300.0), Point(0.0, 300.0)), plants.first { it.category == "groundcover" }))

        for (e in o["pack"]!!.jsonArray) {
            val j = e.jsonObject; val z = zone(j["z"]!!.jsonPrimitive.content); val op = j["opts"]!!.jsonObject
            val seed: Any? = op["seed"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.let { if (it.isString) it.content else it.double }
            val r = packZone(z, z.plantings, glookup, PackOptions(seed, if (op["garden"]!!.jsonPrimitive.boolean) g else null, op["force"]!!.jsonPrimitive.boolean, op["maxima"]!!.jsonPrimitive.boolean))
            assertJsonClose(j["r"], jpack(r), "pack ${z.id} $op")
        }
        for (e in o["fit"]!!.jsonArray) {
            val z = zone(e.jsonObject["z"]!!.jsonPrimitive.content)
            val input = z.plantings.mapIndexed { i, p -> p.copy(count = (p.count ?: 1) * (i + 2)) }
            val r = fitQuantities(z, input, glookup, PackOptions(seed = "f"))
            assertJsonClose(e.jsonObject["r"], JsonArray(r.map { buildJsonObject { put("plantId", it.plantId); it.count?.let { c -> put("count", jn(c)) }; it.height?.let { h -> put("height", jn(h)) } } }), "fit ${z.id}")
        }
        val specs = o["specs"]!!.jsonArray.map { l -> l.jsonArray.map { pl(it.jsonPrimitive.content) } }
        fun alloc(l: List<Allocation>) = JsonArray(l.map { buildJsonObject { put("plantId", it.plantId); put("count", jn(it.count)) } })
        for (e in o["alloc"]!!.jsonArray) {
            val j = e.jsonObject
            assertJsonClose(j["r"], alloc(allocateQuantities(zone(j["z"]!!.jsonPrimitive.content), specs[j["s"]!!.jsonPrimitive.int], AllocOptions(seed = "s"))), "alloc $j")
        }
        assertJsonClose(o["allocShares"]!!.jsonArray[0], alloc(allocateQuantities(zone("z_lawn"), specs[1], AllocOptions(shares = mapOf("mid" to 0.5, "low" to 0.5, "tall" to 0.1)))), "allocShares")
        assertJsonClose(o["allocNoShape"], alloc(allocateQuantities(Zone("q", "other"), sub.take(2))), "allocNoShape")
        fun warns(l: List<SpacingWarning>) = JsonArray(l.map { buildJsonObject { put("level", it.level); put("zoneId", it.zoneId); it.plantId?.let { p -> put("plantId", p) }; put("kind", it.kind); put("text", it.text) } })
        val crowd = zone("z_crowd")
        val extraZones = zones + crowd.copy(id = "z_close", plantings = listOf(Planting(plants.first { it.category == "tree" }.id, count = 4)),
            shape = PolygonShape(listOf(Point(2.5, 3.0), Point(7.5, 3.0), Point(7.5, 5.5), Point(2.5, 5.5))))
        for ((i, e) in o["check"]!!.jsonArray.withIndex()) {
            val z = extraZones[i]
            assertEquals(e.jsonObject["z"]!!.jsonPrimitive.content, z.id)
            assertJsonClose(e.jsonObject["r"], warns(checkSpacing(g, z, glookup)), "check ${z.id}")
            assertJsonClose(e.jsonObject["layout"], jpack(zoneLayout(g, z, glookup)), "layout ${z.id}")
        }
        assertJsonClose(o["checkNull"]!!.jsonArray[0], warns(checkSpacing(g, null, glookup)))
        assertJsonClose(o["checkNull"]!!.jsonArray[1], warns(checkSpacing(g, crowd.copy(plantings = emptyList()), glookup)))
    }
}
