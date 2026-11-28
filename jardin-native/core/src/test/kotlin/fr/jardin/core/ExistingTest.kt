package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class ExistingTest {
    // ---- portés de existing.test.js (cas essentiels)
    @Test fun creation() {
        val t = createExisting("tree", Point(3.0, 4.0))
        assertEquals("Arbre existant", t.label); assertEquals(8.0, t.height); assertEquals(5.0, t.width); assertTrue(t.keep); assertNull(t.points)
        val h = createExisting("hedge", Point(3.0, 4.0))
        assertEquals(2, h.points!!.size)
        val h2 = createExisting("hedge", listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 2.0)))
        assertEquals(3, h2.points!!.size); assertEquals(8.0 / 3, h2.x, 1e-9)
        val f = createExisting("fence", Point(0.0, 0.0))
        assertEquals("wood", f.material); assertEquals(1.2, f.height); assertEquals(0.05, f.width)
        assertEquals("metal", setFenceMaterial(f, "metal").material)
        assertFailsWith<IllegalArgumentException> { createExisting("zz") }
        assertTrue(f.id.startsWith("e_"))
    }

    @Test fun tailleSelonAge() {
        val p = SimplePlant("a", category = "tree", heightAdult = 10.0, widthAdult = 6.0)
        assertEquals(PlantSize(10.0, 6.0), sizeForPlant(p))
        assertEquals(PlantSize(4.0, 6.0 * 0.7), sizeForPlant(p, "young").let { PlantSize(it.height, 6.0 * 0.7) }.copy(height = sizeForPlant(p, "young").height))
        assertEquals("tree", kindForCategory("fruit"))
        assertEquals("other", kindForCategory("zzz"))
    }

    @Test fun migrationDesArbresObstacles() {
        val g = createGarden("t").copy(obstacles = listOf(Obstacle("ot", "tree", center = Point(2.0, 3.0), radius = 1.5, height = 6.0), Obstacle("w", "wall", points = listOf(Point(0.0, 0.0), Point(1.0, 0.0)))))
        val e = ensureExisting(g)
        assertEquals(1, e.existing.size); assertEquals("ot", e.existing[0].id); assertEquals(3.0, e.existing[0].width); assertEquals(6.0, e.existing[0].height)
        assertEquals(listOf("w"), e.obstacles.map { it.id })
        assertEquals(e, ensureExisting(e))
    }

    @Test fun resume() {
        assertEquals("Aucun existant", existingSummary(createGarden("t")).text)
        val g = createGarden("t").copy(existing = listOf(createExisting("tree"), createExisting("tree"), createExisting("perennial").copy(keep = false)))
        val s = existingSummary(g)
        assertEquals("3 existants : 2 arbres, 1 vivace", s.text); assertEquals(1, s.toRemove)
    }

    // ---- golden
    private val o = loadGolden("existing")
    private val g = GoldenFixtures.garden(o["garden"]!!)
    private val plants = GoldenFixtures.plants(o["plants"]!!)
    private val lookup = GoldenFixtures.lookupOf(plants)

    private fun jex(e: Existing, id: Boolean = true): JsonObject = buildJsonObject {
        if (id) put("id", e.id)
        put("kind", e.kind); put("plantId", jstr(e.plantId)); put("label", jstr(e.label)); put("x", jn(e.x)); put("y", jn(e.y))
        e.points?.let { put("points", jpts(it)) }
        put("height", jn(e.height)); put("width", jn(e.width)); put("keep", e.keep); put("notes", e.notes); e.material?.let { put("material", it) }
    }

    @Test fun golden() {
        val c = o["consts"]!!.jsonObject
        c["kinds"]!!.jsonArray.forEachIndexed { i, e ->
            val k = EXISTING_KINDS[i]; val j = e.jsonObject
            assertEquals(j["id"]!!.jsonPrimitive.content, k.id); assertEquals(j["height"]!!.jsonPrimitive.double, k.height); assertEquals(j["width"]!!.jsonPrimitive.double, k.width)
            assertEquals(j["habit"]?.jsonPrimitive?.contentOrNull, k.habit); assertEquals(j["category"]!!.jsonArray.map { it.jsonPrimitive.content }, k.category)
            assertEquals(j["linear"]?.jsonPrimitive?.booleanOrNull ?: false, k.linear); assertEquals(j["plant"]?.jsonPrimitive?.booleanOrNull ?: true, k.plant)
            assertEquals(j["palette"]?.jsonPrimitive?.booleanOrNull ?: true, k.palette); assertEquals(j["plural"]!!.jsonPrimitive.content, k.plural)
        }
        c["fence"]!!.jsonArray.forEachIndexed { i, e -> assertEquals(e.jsonObject["opacity"]!!.jsonPrimitive.double, FENCE_MATERIALS[i].opacity); assertEquals(e.jsonObject["color"]!!.jsonPrimitive.content, FENCE_MATERIALS[i].color) }
        for (e in o["fenceMat"]!!.jsonArray) assertEquals(e.jsonObject["r"]!!.jsonPrimitive.content, getFenceMaterial(e.jsonObject["id"]?.jsonPrimitive?.contentOrNull).id)
        for (e in o["size"]!!.jsonArray) {
            val j = e.jsonObject; val p = plants.first { it.id == j["p"]!!.jsonPrimitive.content }
            val age = j["age"]!!.jsonPrimitive.let { if (it.isString) it.content else it.double }
            val r = sizeForPlant(p, age, j["kind"]?.jsonPrimitive?.contentOrNull)
            assertJsonClose(j["r"], buildJsonObject { put("height", jn(r.height)); put("width", jn(r.width)) }, "size ${p.id} $age")
        }
        val sn = o["sizeNull"]!!.jsonArray
        for ((i, r) in listOf(sizeForPlant(null), sizeForPlant(null, "old", "tree"), sizeForPlant(SimplePlant("x"), "young", "fence")).withIndex())
            assertJsonClose(sn[i], buildJsonObject { put("height", jn(r.height)); put("width", jn(r.width)) }, "sizeNull$i")
        for (e in o["kindFor"]!!.jsonArray) assertEquals(e.jsonObject["r"]!!.jsonPrimitive.content, kindForCategory(e.jsonObject["c"]?.jsonPrimitive?.contentOrNull))
        for (e in o["create"]!!.jsonArray) {
            val j = e.jsonObject; val at = j["at"]!!
            val r = if (at is JsonArray) createExisting(j["k"]!!.jsonPrimitive.content, pts(at)) else createExisting(j["k"]!!.jsonPrimitive.content, pt(at))
            assertJsonClose(j["r"], jex(r, id = false), "create $j")
        }
        assertTrue(o["createErr"]!!.jsonPrimitive.boolean)
        for (e in o["setFence"]!!.jsonArray) assertJsonClose(e.jsonObject["r"], jex(setFenceMaterial(createExisting("fence", Point(0.0, 0.0)), e.jsonObject["m"]!!.jsonPrimitive.content), id = false), "setFence")
        for (e in o["labels"]!!.jsonArray) {
            val ex = existingOf(e.jsonObject["e"]!!)
            assertEquals(e.jsonObject["r"]!!.jsonPrimitive.content, existingLabel(ex, lookup), "label ${ex.id}")
            assertEquals(e.jsonObject["p"]?.jsonPrimitive?.contentOrNull, existingPlant(ex, lookup)?.id)
        }
        o["footprint"]!!.jsonArray.forEachIndexed { i, e -> assertJsonClose(e, jpts(existingFootprint(g.existing[i])), "footprint$i") }
        fun fps(l: List<ExistingFootprintInfo>) = JsonArray(l.map { buildJsonObject { put("id", it.id); put("kind", it.kind); put("keep", it.keep); put("polygon", jpts(it.polygon)) } })
        assertJsonClose(o["footprints"]!!.jsonArray[0], fps(existingFootprints(g)), "fps0")
        assertJsonClose(o["footprints"]!!.jsonArray[1], fps(existingFootprints(g, includeRemoved = true)), "fps1")
        assertJsonClose(o["shadow"]!!.jsonArray[0], jobsList(existingShadowObstacles(g)), "shadow0")
        assertJsonClose(o["shadow"]!!.jsonArray[1], jobsList(existingShadowObstacles(g, includeRemoved = true)), "shadow1")
        val sums = listOf(g, GoldenFixtures.garden("empty"), createGarden("x").copy(existing = listOf(Existing("a", "perennial", keep = false), Existing("b", "perennial"), Existing("c", "tree"))))
        o["summary"]!!.jsonArray.forEachIndexed { i, e ->
            val s = existingSummary(sums[i]); val j = e.jsonObject
            assertEquals(j["total"]!!.jsonPrimitive.int, s.total); assertEquals(j["toRemove"]!!.jsonPrimitive.int, s.toRemove); assertEquals(j["text"]!!.jsonPrimitive.content, s.text)
            assertEquals(j["byKind"]!!.jsonObject.mapValues { it.value.jsonPrimitive.int }, s.byKind)
        }
        val render = existingForRender(g, lookup)
        o["render"]!!.jsonArray.forEachIndexed { i, e ->
            val r = render[i]
            assertJsonClose(e, buildJsonObject {
                put("id", r.id); put("kind", r.kind); put("plant", jstr(r.plant?.id)); put("x", jn(r.x)); put("y", jn(r.y)); put("height", jn(r.height)); put("width", jn(r.width))
                put("keep", r.keep); put("habit", jstr(r.habit?.id)); put("label", r.label); r.material?.let { put("material", it) }; r.points?.let { put("points", jpts(it)) }
            }, "render$i")
        }
        // ensureExisting : ids générés normalisés en « NEW »
        val rawG = GoldenFixtures.garden(o["raw"]!!)
        val known = (rawG.existing.map { it.id } + rawG.obstacles.map { it.id } + g.existing.map { it.id } + "old_tree").toSet()
        val inputs = listOf(rawG, g, GoldenFixtures.garden("old"))
        o["ensure"]!!.jsonArray.forEachIndexed { i, e ->
            val r = ensureExisting(inputs[i])
            assertJsonClose(e.jsonObject["existing"], JsonArray(r.existing.map { x -> JsonObject(jex(x) + ("id" to JsonPrimitive(if (x.id in known) x.id else "NEW"))) }), "ensure$i.existing")
            assertJsonClose(e.jsonObject["obstacles"], JsonArray(r.obstacles.map { ob -> buildJsonObject { put("id", ob.id); put("kind", ob.kind); ob.points?.let { put("points", jpts(it)) }; ob.center?.let { put("center", jp(it)) }; ob.radius?.let { put("radius", jn(it)) }; ob.height?.let { put("height", jn(it)) } } }), "ensure$i.obstacles")
        }
        assertTrue(o["idempotent"]!!.jsonPrimitive.boolean)
    }
}
