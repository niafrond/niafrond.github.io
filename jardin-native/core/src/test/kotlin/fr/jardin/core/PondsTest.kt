package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class PondsTest {
    private fun circle(r: Double, depth: Double? = null) = createZone("pond", CircleShape(Point(0.0, 0.0), r)).copy(depth = depth)
    private val saule = SimplePlant("x", "Saule pleureur", "Salix babylonica", "tree", 15.0, 10.0)

    // ---- portés de ponds.test.js (cas essentiels)
    @Test fun profondeur() {
        assertEquals(40, estimatePondDepth(1.0)); assertEquals(60, estimatePondDepth(5.0)); assertEquals(80, estimatePondDepth(10.0)); assertEquals(100, estimatePondDepth(30.0))
        assertEquals(70, pondDepth(circle(1.0, 70.0)))
        assertEquals(40, pondDepth(circle(0.5)))
        assertEquals(60, pondDepth(circle(1.2)))
    }

    @Test fun saulesEtGrandsArbres() {
        assertEquals("willow", pondTreeRule(saule))
        assertEquals("forbid", pondFit(saule, circle(5.0)).level)
        assertFalse(pondFit(saule, circle(5.0)).ok)
        val chene = SimplePlant("c", "Chêne", "Quercus robur", "tree", 25.0, 12.0)
        assertEquals("bigtree", pondTreeRule(chene))
        assertEquals("avoid", pondFit(chene, circle(2.0)).level)
        assertEquals("ok", pondFit(chene, circle(5.0)).level)
        assertEquals("aggressive", pondTreeRule(SimplePlant("p", "Peuplier", "Populus nigra", "tree", 25.0, 8.0)))
        assertEquals("ok", pondFit(SimplePlant("r", "Rose", "Rosa", "shrub", 1.0, 1.0), circle(1.0)).level)
        assertEquals(null, pondTreeRule(null))
    }

    @Test fun nenuphar() {
        val n = SimplePlant("h-nenuphar", "Nénuphar", "Nymphaea alba", "aquatic", 0.05, 1.5, spacing = 1.0)
        assertTrue(pondTag(n) != null && pondConcerned(n))
        assertEquals("forbid", pondFit(n, circle(0.8)).level)
        assertEquals("ok", pondFit(n, circle(3.0, 80.0)).level)
        assertEquals(0.5, pondCoverage(n, null))
        assertTrue(pondPlantQuantity(n, circle(3.0, 80.0)) >= 1)
    }

    // ---- golden
    private val o = loadGolden("ponds")
    private val plants = GoldenFixtures.plants(o["plants"]!!)

    @Test fun golden() {
        assertEquals(o["ids"]!!.jsonArray.map { it.jsonPrimitive.content }, pondTaggedIds())
        assertEquals(o["rule"]!!.jsonArray.map { it.jsonPrimitive.contentOrNull }, plants.map { pondTreeRule(it) })
        assertEquals(o["concerned"]!!.jsonArray.map { it.jsonPrimitive.boolean }, plants.map { pondConcerned(it) })
        o["tag"]!!.jsonArray.forEachIndexed { i, e ->
            val t = pondTag(plants[i])
            if (e is JsonNull) assertNull(t, plants[i].id) else {
                assertNotNull(t); val j = e.jsonObject
                assertEquals(j["minArea"]!!.jsonPrimitive.double, t.minArea); assertEquals(j["role"]!!.jsonPrimitive.content, t.role); assertEquals(j["spread"]!!.jsonPrimitive.content, t.spread)
                assertEquals(j["minDepth"]?.jsonPrimitive?.doubleOrNull ?: 0.0, t.minDepth); assertEquals(j["forbid"]?.jsonPrimitive?.booleanOrNull ?: false, t.forbid)
            }
        }
        for (e in o["depthEstimate"]!!.jsonArray) assertEquals(e.jsonObject["r"]!!.jsonPrimitive.int, estimatePondDepth(e.jsonObject["a"]!!.jsonPrimitive.double))
        val zones = o["zones"]!!.jsonArray.map { JardinJson.json.decodeFromJsonElement(Zone.serializer(), JsonObject(it.jsonObject + ("type" to JsonPrimitive("pond")))) }
        o["zoneFns"]!!.jsonArray.forEachIndexed { i, e ->
            assertEquals(e.jsonObject["area"]!!.jsonPrimitive.double, pondArea(zones[i]), 1e-9, "area$i")
            assertEquals(e.jsonObject["depth"]!!.jsonPrimitive.int, pondDepth(zones[i]), "depth$i")
        }
        fun fit(f: PondFit) = buildJsonObject { put("ok", f.ok); put("level", f.level); put("reasons", JsonArray(f.reasons.map { JsonPrimitive(it) })) }
        var k = 0
        val areaDepth = listOf(0.5 to 30, 2.0 to 40, 5.0 to 60, 10.0 to 80, 25.0 to 100, 50.0 to 150, 4.0 to 10)
        for (p in plants) for ((a, d) in areaDepth) assertJsonClose(o["fitFor"]!!.jsonArray[k++], fit(pondFitFor(p, a, d)), "fitFor ${p.id} $a $d")
        k = 0
        for (p in plants.filterIndexed { i, _ -> i % 3 == 0 }) for (z in zones) {
            val j = o["fit"]!!.jsonArray[k++].jsonObject
            assertJsonClose(j["ok"], fit(pondFit(p, z)), "fit ${p.id}")
            assertEquals(j["cover"]!!.jsonPrimitive.double, pondCoverage(p, z), 1e-12)
            assertEquals(j["qty"]!!.jsonPrimitive.int, pondPlantQuantity(p, z), "qty ${p.id} ${z.id}")
        }
    }
}
