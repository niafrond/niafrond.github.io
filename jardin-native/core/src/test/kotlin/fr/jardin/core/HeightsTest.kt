package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class HeightsTest {
    // ---- portés de heights.test.js / height-override.test.js
    @Test fun saisieEtFormat() {
        assertEquals(4.5, parseHeight("450")!!, 1e-12)
        assertEquals(4.5, parseHeight("4,5 m")!!, 1e-12)
        assertNull(parseHeight("abc"))
        assertNull(parseHeight(""))
        assertEquals("2,40 m", formatHeight(2.4))
        assertEquals("—", formatHeight(null))
        assertEquals("450", heightToCm(4.5))
    }

    @Test fun bornesEtValidation() {
        assertEquals(40.0, clampHeight("tree", 99.0), 0.0)
        assertEquals(0.5, clampHeight("tree", 0.0), 0.0)
        assertEquals(0.05, clampHeight("zzz", 0.0), 0.0)
        val c = checkHeight("wall", 99.0)
        assertTrue(c.ok && c.clamped); assertEquals(6.0, c.value)
        assertFalse(checkHeight("wall", null).ok)
        assertEquals("Hauteur plausible : 0,5 à 40 m ; valeur arrondie", heightMessage("tree"))
    }

    @Test fun hauteurParDefautEtReglee() {
        assertEquals(1.2, heightOf(null, 1.2))
        assertEquals(2.0, heightOf(2.0, 1.2))
        assertEquals(1.2, heightOf(0.0, 1.2))
        assertEquals(0.0, heightOf(0.0, 0.0))
        val a = applyHeight(2.0, "wall", 2.001, 2.0)
        assertNull(a.stored); assertTrue(a.result.isDefault)
        val b = applyHeight(null, "wall", 2.5, 2.0)
        assertEquals(2.5, b.stored)
        assertTrue(applyHeight(1.0, "wall", null, 2.0).result.invalid)
    }

    @Test fun zonesEtEssences() {
        val pool = createZone("pool", null)
        assertEquals(0.0, zoneHeight(pool))
        assertEquals(1.2, zoneHeight(setPoolVariant(pool, "above")), 1e-12)
        assertEquals(0.4, zoneHeight(createZone("terrace", null).copy(height = 0.4)), 1e-12)
        val p = SimplePlant("x", category = "tree", heightAdult = 10.0, widthAdult = 5.0)
        assertSame(p, effectivePlant(p, Planting("x")))
        val e = effectivePlant(p, Planting("x", height = 4.0))!!
        assertEquals(4.0, e.heightAdult); assertEquals(5.0, e.widthAdult)
        assertEquals(4.0, plantingHeight(p, Planting("x", height = 4.0)))
        assertEquals(10.0, plantingHeight(p, null))
    }

    // ---- golden
    private val o = loadGolden("heights")

    @Test fun golden() {
        for ((k, v) in o["limits"]!!.jsonObject) assertEquals(v.jsonArray.map { it.jsonPrimitive.double }, HEIGHT_LIMITS.getValue(k).toList(), "limits $k")
        val d = o["defaults"]!!.jsonObject
        assertEquals(d["poolAbove"]!!.jsonPrimitive.double, DEFAULT_HEIGHTS.poolAbove)
        for ((k, v) in d["item"]!!.jsonObject) assertEquals(v.jsonPrimitive.double, DEFAULT_HEIGHTS.item.getValue(k))
        for ((k, v) in d["obstacle"]!!.jsonObject) assertEquals(v.jsonPrimitive.double, DEFAULT_HEIGHTS.obstacle.getValue(k))
        for ((k, v) in d["edge"]!!.jsonObject) assertEquals(v.jsonPrimitive.double, DEFAULT_HEIGHTS.edge.getValue(k))
        for (l in o["limitsFor"]!!.jsonArray) {
            val k = l.jsonObject["k"]?.jsonPrimitive?.contentOrNull
            assertEquals(l.jsonObject["r"]!!.jsonArray.map { it.jsonPrimitive.double }, heightLimits(k).toList(), "limitsFor $k")
            assertEquals(l.jsonObject["msg"]!!.jsonPrimitive.content, heightMessage(k))
        }
        for (e in o["parse"]!!.jsonArray) {
            val t = e.jsonObject["t"]?.jsonPrimitive?.contentOrNull
            assertEquals(dbl(e.jsonObject["r"]), parseHeight(t), "parse $t")
        }
        for (e in o["parseNum"]!!.jsonArray) assertEquals(dbl(e.jsonObject["r"]), parseHeight(dbl(e.jsonObject["n"])!!))
        for (e in o["format"]!!.jsonArray) assertEquals(e.jsonObject["r"]!!.jsonPrimitive.content, formatHeight(dbl(e.jsonObject["v"])), "format ${e.jsonObject["v"]}")
        for (e in o["toCm"]!!.jsonArray) assertEquals(e.jsonObject["r"]!!.jsonPrimitive.content, heightToCm(dbl(e.jsonObject["v"])!!))
        for (e in o["clamp"]!!.jsonArray) {
            val j = e.jsonObject; val k = j["k"]!!.jsonPrimitive.content; val v = dbl(j["v"])
            assertEquals(j["r"]!!.jsonPrimitive.double, clampHeight(k, v), 1e-12, "clamp $k $v")
            val c = checkHeight(k, v)
            assertJsonClose(j["chk"], buildJsonObject { put("value", c.value?.let { jn(it) } ?: JsonNull); put("ok", c.ok); put("clamped", c.clamped); put("message", c.message) }, "chk $k $v")
        }
        for (e in o["heightOf"]!!.jsonArray) {
            val j = e.jsonObject; val h = dbl(j["h"]); val df = j["d"]!!.jsonPrimitive.double
            assertEquals(j["r"]!!.jsonPrimitive.double, heightOf(h, df), 1e-12, "heightOf $h $df")
            assertEquals(j["isDef"]!!.jsonPrimitive.boolean, isDefaultHeight(h, df))
        }
        assertEquals(o["heightOfNull"]!!.jsonArray.map { it.jsonPrimitive.double }, listOf(heightOf(null, 2.0), heightOf(null, 0.0)))
        for (e in o["apply"]!!.jsonArray) {
            val j = e.jsonObject
            val a = applyHeight(dbl(j["h"]), j["k"]!!.jsonPrimitive.content, dbl(j["v"]), j["d"]!!.jsonPrimitive.double)
            assertEquals(dbl(j["entity"]!!.jsonObject["height"]), a.stored, "apply $j")
            val r = j["r"]!!.jsonObject
            assertEquals(r["value"]!!.jsonPrimitive.double, a.result.value, 1e-12)
            assertEquals(r["isDefault"]!!.jsonPrimitive.boolean, a.result.isDefault)
            assertEquals(r["clamped"]?.jsonPrimitive?.booleanOrNull ?: false, a.result.clamped)
            assertEquals(r["message"]!!.jsonPrimitive.content, a.result.message)
            assertEquals(r["invalid"]?.jsonPrimitive?.booleanOrNull ?: false, a.result.invalid)
        }
        for (e in o["itemDefaults"]!!.jsonArray) {
            val j = e.jsonObject; val id = j["id"]!!.jsonPrimitive.content
            assertEquals(j["d"]!!.jsonPrimitive.double, defaultItemHeight(id), 1e-12)
            assertEquals(j["h"]!!.jsonPrimitive.double, itemHeight(Item("i", id)), 1e-12)
            assertEquals(j["h2"]!!.jsonPrimitive.double, itemHeight(Item("i", id, height = 3.3)), 1e-12)
        }
        for (e in o["obstacle"]!!.jsonArray) {
            val j = e.jsonObject; val k = j["k"]!!.jsonPrimitive.content
            assertEquals(j["d"]!!.jsonPrimitive.double, defaultObstacleHeight(k), 1e-12)
            assertEquals(j["h"]!!.jsonPrimitive.double, obstacleHeight(Obstacle(kind = k)), 1e-12)
            assertEquals(j["h2"]!!.jsonPrimitive.double, obstacleHeight(Obstacle(kind = k, height = 4.4)), 1e-12)
        }
        val zones = o["zones"]!!.jsonArray.map { JardinJson.json.decodeFromJsonElement(Zone.serializer(), it) }
        o["zoneFns"]!!.jsonArray.forEachIndexed { i, e ->
            assertEquals(e.jsonObject["h"]!!.jsonPrimitive.double, zoneHeight(zones[i]), 1e-12, "zoneHeight $i")
            assertEquals(e.jsonObject["d"]!!.jsonPrimitive.double, defaultZoneHeight(zones[i]), 1e-12)
            assertEquals(e.jsonObject["k"]!!.jsonPrimitive.content, zoneHeightKind(zones[i]))
        }
        val plants = GoldenFixtures.plants(o["plants"]!!)
        assertEquals(o["plantKinds"]!!.jsonArray.map { it.jsonPrimitive.content }, plants.map { plantHeightKind(it) })
        val pls = o["plantings"]!!.jsonArray.map { if (it is JsonNull) null else JardinJson.json.decodeFromJsonElement(Planting.serializer(), JsonObject(it.jsonObject + ("plantId" to JsonPrimitive("x")))) }
        o["effective"]!!.jsonArray.forEachIndexed { i, row ->
            row.jsonArray.forEachIndexed { j, e ->
                val r = effectivePlant(plants[i], pls[j])!!
                assertEquals(dbl(e.jsonObject["h"]), r.heightAdult); assertEquals(dbl(e.jsonObject["w"]), r.widthAdult)
                assertEquals(o["plantingHeight"]!!.jsonArray[i].jsonArray[j].jsonPrimitive.double, plantingHeight(plants[i], pls[j]), 1e-12)
            }
        }
    }
}
