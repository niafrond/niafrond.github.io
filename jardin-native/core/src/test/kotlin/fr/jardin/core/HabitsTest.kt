package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class HabitsTest {
    // ---- portés de habits.test.js (cas essentiels)
    @Test fun table() {
        assertEquals(HABITS.size, HABIT_IDS.toSet().size)
        assertTrue(HABITS.size >= 38)
        assertNotNull(getHabit("tree-round")); assertNull(getHabit("zzz")); assertNull(getHabit(null))
        assertEquals("shrub-round", habitOf(null).id)
    }

    @Test fun deduction() {
        assertEquals("tree-columnar", habitOf(SimplePlant("a", latinName = "Zzz", category = "tree", heightAdult = 12.0, widthAdult = 3.0)).id)
        assertEquals("tree-spreading", habitOf(SimplePlant("a", latinName = "Zzz", category = "tree", heightAdult = 10.0, widthAdult = 10.0)).id)
        assertEquals("tree-conical", habitOf(SimplePlant("a", latinName = "Pinus nigra", category = "tree", heightAdult = 20.0, widthAdult = 12.0)).id)
        assertEquals("palm", habitOf(SimplePlant("a", latinName = "Trachycarpus fortunei", category = "tree", heightAdult = 8.0, widthAdult = 3.0)).id)
        assertEquals("bamboo", habitOf(SimplePlant("a", latinName = "Phyllostachys aurea", category = "shrub", heightAdult = 4.0, widthAdult = 1.5)).id)
        assertEquals("palm", habitOf(SimplePlant("a", category = "tree", habit = "palm", heightAdult = 3.0)).id)
        assertEquals("shrub-round", habitOf(SimplePlant("a", category = "shrub", habit = "nope", heightAdult = 1.5, widthAdult = 1.5, foliage = "evergreen")).id)
    }

    @Test fun parametresEtAge() {
        val p = SimplePlant("a", latinName = "Zzz", category = "tree", heightAdult = 10.0, widthAdult = 6.0)
        val adult = habitParams(p)
        assertEquals(10.0, adult.height, 1e-9); assertEquals(6.0, adult.width, 1e-9)
        val young = habitParams(p, age = "young")
        assertEquals(3.5, young.height, 1e-9); assertEquals(1.8, young.width, 1e-9)
        val over = habitParams(p, height = 4.0, width = 2.0)
        assertEquals(4.0, over.heightAdult); assertEquals(2.0, over.widthAdult)
        assertTrue(describeHabit(p).startsWith("Arbre à houppier arrondi (10 m × 6 m)."))
    }

    // ---- golden
    private val o = loadGolden("habits")

    @Test fun golden() {
        o["habits"]!!.jsonArray.forEachIndexed { i, e ->
            val h = HABITS[i]; val j = e.jsonObject
            assertEquals(j["id"]!!.jsonPrimitive.content, h.id)
            assertJsonClose(buildJsonObject {
                put("label", j["label"]!!); put("crown", j["crown"]!!); put("ratio", j["ratio"]!!); put("trunk", j["trunk"]!!); put("density", j["density"]!!)
                put("spread", j["spread"]!!); put("leaf", j["leaf"]!!); put("flowerStyle", j["flowerStyle"]!!); put("note", j["note"]!!)
                j["stems"]?.let { put("stems", it) }; j["support"]?.let { put("support", it) }; if (j["sheath"] != null) put("sheath", true)
            }, buildJsonObject {
                put("label", h.label); put("crown", h.crown); put("ratio", jn(h.ratio)); put("trunk", h.trunk); put("density", jn(h.density))
                put("spread", jn(h.spread)); put("leaf", h.leaf); put("flowerStyle", h.flowerStyle); put("note", h.note)
                h.stems?.let { put("stems", buildJsonObject { put("min", jn(it.min)); put("max", jn(it.max)) }) }; h.support?.let { put("support", it) }; if (h.sheath) put("sheath", true)
            }, "habit.${h.id}")
        }
        assertEquals(o["tagCount"]!!.jsonPrimitive.int, TAGS_BY_PLANT.size)
        assertEquals(o["supports"]!!.jsonArray.map { it.jsonPrimitive.content }, SUPPORTS)
        for (e in o["getHabit"]!!.jsonArray) assertEquals(e.jsonObject["r"]?.jsonPrimitive?.contentOrNull, getHabit(e.jsonObject["id"]?.jsonPrimitive?.contentOrNull)?.id)
        val plants = GoldenFixtures.plants(o["plants"]!!)
        assertEquals(o["habitOf"]!!.jsonArray.map { it.jsonPrimitive.content }, plants.map { habitOf(it).id })
        assertEquals(o["habitOfNull"]!!.jsonPrimitive.content, habitOf(null).id)
        fun hp(r: HabitParams) = buildJsonObject {
            put("habit", r.habit); put("label", r.label); put("crown", r.crown); put("trunk", r.trunk); put("leaf", r.leaf); put("flowerStyle", r.flowerStyle)
            put("heightAdult", jn(r.heightAdult)); put("widthAdult", jn(r.widthAdult)); put("height", jn(r.height)); put("width", jn(r.width)); put("ratio", jn(r.ratio))
            put("typicalRatio", jn(r.typicalRatio)); put("trunkHeight", jn(r.trunkHeight)); put("crownHeight", jn(r.crownHeight)); put("density", jn(r.density))
            put("spread", jn(r.spread)); put("stems", jn(r.stems)); put("support", jstr(r.support)); put("sheath", r.sheath); put("ageFactor", jn(r.ageFactor))
        }
        val ages: List<Any> = o["ages"]!!.jsonArray.map { a -> a.jsonPrimitive.let { if (it.isString) it.content else it.double } }
        o["params"]!!.jsonArray.forEachIndexed { i, row ->
            row.jsonArray.forEachIndexed { j, e -> assertJsonClose(e, hp(habitParams(plants[i], age = ages[j])), "params ${plants[i].id} age ${ages[j]}") }
        }
        o["paramsOverride"]!!.jsonArray.forEachIndexed { i, row ->
            val p = plants[i]
            assertJsonClose(row.jsonArray[0], hp(habitParams(p, height = 3.0, width = 2.0)), "ov0 ${p.id}")
            assertJsonClose(row.jsonArray[1], hp(habitParams(p, age = 0.4, height = 1.5)), "ov1 ${p.id}")
            assertJsonClose(row.jsonArray[2], hp(habitParams(p, width = 0.5)), "ov2 ${p.id}")
        }
        assertJsonClose(o["paramsNull"]!!.jsonArray[0], hp(habitParams(null)))
        assertJsonClose(o["paramsNull"]!!.jsonArray[1], hp(habitParams(null, age = 0.3)))
        assertEquals(o["describe"]!!.jsonArray.map { it.jsonPrimitive.content }, plants.map { describeHabit(it) })
        assertEquals(o["describeNull"]!!.jsonPrimitive.content, describeHabit(null))
    }
}
