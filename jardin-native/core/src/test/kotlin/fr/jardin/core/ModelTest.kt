package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class ModelTest {
    private val sq = listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 10.0), Point(0.0, 10.0))
    private fun jardin() = createGarden("Test").copy(boundary = sq, boundaryClosed = true)
    private fun poly(vararg p: Pair<Double, Double>) = PolygonShape(p.map { Point(it.first, it.second) })

    // ---- portés de model.test.js / model-items.test.js / pool-variant.test.js
    @Test fun constantes() {
        assertEquals(listOf("pond", "pool", "terrace", "path", "lawn", "lowplants", "midplants", "tallplants", "hedge", "trees", "vegetable", "orchard", "other"), ZONE_TYPES.map { it.id })
        assertTrue(getZoneType("hedge")!!.shapeKinds.contains("line"))
        assertNull(getZoneType("nope"))
        assertEquals(listOf("full", "partial", "shade"), SUN_LEVELS)
        assertEquals(12, PLANT_CATEGORIES.size)
        assertEquals(180, ORIENTATIONS.first { it.id == "S" }.azimuth)
        assertEquals(200, (1..200).map { newId() }.toSet().size)
        assertTrue(newId("g_").startsWith("g_") && newId().length == 16)
    }

    @Test fun creation() {
        val g = createGarden("Mon pré")
        assertEquals("Mon pré", g.name); assertEquals("draft", g.status); assertFalse(g.boundaryClosed)
        assertEquals(SunInfo("unknown", null, emptyList()), g.sun); assertEquals(Plan(null, null), g.plan)
        assertEquals("manual", g.context.bedMode); assertEquals(0.0, g.context.northAngle)
        val z = createZone("pond", poly(0.0 to 0.0, 1.0 to 0.0, 1.0 to 1.0))
        assertEquals("Mare / bassin", z.label); assertTrue(z.id.startsWith("z_")); assertFalse(z.auto); assertEquals(emptyList(), z.plantings)
        assertFailsWith<IllegalArgumentException> { createZone("zzz", null) }
        val c = createItem("parasol", 1.0, 2.0)
        assertEquals(1.5, c.radius); assertEquals(3.0, c.width)
        assertNull(createItem("bench").radius)
        val op = createOpening("gate", OpeningRef("boundary", 1), 0.25)
        assertEquals(3.0, op.width); assertEquals("in", op.swing); assertEquals(0.25, op.t)
        assertFailsWith<IllegalArgumentException> { createItem("zzz") }
        assertFailsWith<IllegalArgumentException> { createOpening("zzz", OpeningRef("boundary", 0)) }
    }

    @Test fun validation() {
        assertTrue(validateGarden(jardin()).ok)
        assertEquals("Le contour du terrain doit comporter au moins 3 sommets.", validateGarden(createGarden("x")).errors[0])
        assertEquals("Le contour du terrain n'est pas fermé.", validateGarden(jardin().copy(boundaryClosed = false)).errors[0])
        assertEquals("Le contour du terrain se croise lui-même.", validateGarden(jardin().copy(boundary = listOf(Point(0.0, 0.0), Point(4.0, 4.0), Point(4.0, 0.0), Point(0.0, 4.0)))).errors[0])
        val out = validateGarden(jardin().copy(zones = listOf(createZone("lawn", poly(8.0 to 8.0, 14.0 to 8.0, 14.0 to 14.0, 8.0 to 14.0)))))
        assertTrue(out.ok); assertEquals(listOf("Zone « Pelouse » : sort du contour du terrain."), out.warnings.take(1))
        val over = validateGarden(jardin().copy(zones = listOf(createZone("lawn", poly(0.0 to 0.0, 5.0 to 0.0, 5.0 to 5.0, 0.0 to 5.0)), createZone("terrace", poly(3.0 to 3.0, 8.0 to 3.0, 8.0 to 8.0, 3.0 to 8.0)))))
        assertTrue(over.warnings.any { it.contains("se chevauchent") })
        val canopy = validateGarden(jardin().copy(zones = listOf(createZone("lawn", poly(0.0 to 0.0, 5.0 to 0.0, 5.0 to 5.0, 0.0 to 5.0)), createZone("trees", poly(3.0 to 3.0, 8.0 to 3.0, 8.0 to 8.0, 3.0 to 8.0)))))
        assertFalse(canopy.warnings.any { it.contains("se chevauchent") })
        assertTrue(validateGarden(jardin().copy(wishedZoneTypes = listOf("vegetable"))).warnings.contains("Zone souhaitée « Potager » : aucune forme dessinée."))
        val auto = jardin().copy(wishedZoneTypes = listOf("midplants"), context = jardin().context.copy(bedMode = "auto"))
        assertTrue(validateGarden(auto).warnings.isEmpty())
        assertEquals("auto", bedModeOf(auto)); assertEquals("manual", bedModeOf(null))
    }

    @Test fun variantesDePiscine() {
        val pool = createZone("pool", null)
        assertEquals("inground", poolVariant(pool)); assertFalse(isAbovePool(pool)); assertNull(poolVariant(createZone("lawn", null)))
        val above = setPoolVariant(pool, "above")
        assertEquals("Piscine hors sol", above.label); assertTrue(isAbovePool(above))
        assertEquals("Piscine 2", setPoolVariant(above.copy(label = "Piscine hors sol 2"), "inground").label)
        assertEquals("Ma piscine", setPoolVariant(pool.copy(label = "Ma piscine"), "above").label)
        assertEquals(createZone("lawn", null).let { it.copy(id = "a") }, setPoolVariant(createZone("lawn", null).copy(id = "a"), "above"))
    }

    // ---- compatibilité JSON avec l'export du web
    @Test fun aller_retour_des_jardins_du_web() {
        for (name in listOf("main", "empty", "bad", "open", "small", "old")) {
            val src = GoldenFixtures.gardenJson(name)
            val g = GoldenFixtures.garden(name)
            val back = JardinJson.json.parseToJsonElement(JardinJson.encodeGarden(g))
            assertSubset(src, back, name)
            assertEquals(g, JardinJson.decodeGarden(JardinJson.encodeGarden(g)))
        }
    }

    /** Tout champ non nul de `expected` se retrouve dans `actual` (flottants à 1e-9 près). */
    private fun assertSubset(expected: JsonElement, actual: JsonElement?, path: String) {
        when (expected) {
            is JsonNull -> {}
            is JsonObject -> { assertTrue(actual is JsonObject, path); for ((k, v) in expected) assertSubset(v, actual.jsonObject[k], "$path.$k") }
            is JsonArray -> { assertTrue(actual is JsonArray && actual.size == expected.size, "$path taille"); expected.forEachIndexed { i, v -> assertSubset(v, actual.jsonArray[i], "$path[$i]") } }
            is JsonPrimitive -> {
                assertNotNull(actual, path); val a = actual.jsonPrimitive
                if (expected.isString) assertEquals(expected.content, a.content, path)
                else if (expected.booleanOrNull != null) assertEquals(expected.boolean, a.boolean, path)
                else assertEquals(expected.double, a.double, 1e-9, path)
            }
        }
    }

    @Test fun importTolerant() {
        val json = """{"id":"g_x","name":"Importé","champInconnu":42,"context":{"location":{"lat":48.0,"lon":2.0},"northAngle":15,"nouveau":true},
            "zones":[{"id":"z1","type":"lawn","label":"Pelouse","shape":{"kind":"line","points":[{"x":0,"y":0},{"x":3,"y":0}],"width":2},
            "plantings":[{"plantId":"a","count":2.6},{"plantId":"b","quantity":3}],"notes":null,"extra":1}],
            "items":[{"id":"i","kind":"bench","x":1,"y":2,"rotation":0,"width":1.5,"depth":0.5}],
            "sun":{"mode":"uniform","uniform":"full","regions":[]}}"""
        val g = JardinJson.decodeGarden(json)
        assertEquals("Importé", g.name); assertEquals(15.0, g.context.northAngle); assertEquals(48.0, g.context.location!!.lat)
        val z = g.zones[0]
        assertEquals("", z.notes)
        assertEquals(LineShape(listOf(Point(0.0, 0.0), Point(3.0, 0.0)), 2.0), z.shape)
        assertEquals(listOf(3, null), z.plantings.map { it.count }); assertEquals(3, z.plantings[1].quantity)
        assertEquals("full", g.sun.uniform)
    }

    // ---- golden
    private val o = loadGolden("model")

    @Test fun golden() {
        val c = o["consts"]!!.jsonObject
        c["zoneTypes"]!!.jsonArray.forEachIndexed { i, e ->
            val t = ZONE_TYPES[i]; val j = e.jsonObject
            assertEquals(j["id"]!!.jsonPrimitive.content, t.id); assertEquals(j["label"]!!.jsonPrimitive.content, t.label); assertEquals(j["color"]!!.jsonPrimitive.content, t.color)
            assertEquals(j["icon"]!!.jsonPrimitive.content, t.icon); assertEquals(j["layer"]!!.jsonPrimitive.content, t.layer)
            assertEquals(j["shapeKinds"]!!.jsonArray.map { it.jsonPrimitive.content }, t.shapeKinds); assertEquals(j["minSun"]?.jsonPrimitive?.contentOrNull, t.minSun)
            assertEquals(j["defaultWidth"]?.jsonPrimitive?.doubleOrNull, t.defaultWidth)
        }
        assertEquals(c["sunLevels"]!!.jsonArray.map { it.jsonPrimitive.content }, SUN_LEVELS)
        assertEquals(c["sunLabels"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }, SUN_LABELS)
        assertEquals(c["waterLabels"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }, WATER_LABELS)
        assertEquals(c["categories"]!!.jsonArray.map { it.jsonPrimitive.content }, PLANT_CATEGORIES)
        assertEquals(c["categoryLabels"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }, CATEGORY_LABELS)
        assertEquals(c["soils"]!!.jsonArray.map { it.jsonPrimitive.content }, SOILS)
        assertEquals(c["soilLabels"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content }, SOIL_LABELS)
        assertEquals(c["orientations"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content to it.jsonObject["azimuth"]!!.jsonPrimitive.int }, ORIENTATIONS.map { it.id to it.azimuth })
        assertEquals(c["bedModes"]!!.jsonArray.map { it.jsonPrimitive.content }, BED_MODES)
        assertEquals(c["poolAboveLabel"]!!.jsonPrimitive.content, POOL_ABOVE_LABEL)
        for (e in o["zoneType"]!!.jsonArray) assertEquals(e.jsonObject["r"] !is JsonNull, getZoneType(e.jsonObject["id"]?.jsonPrimitive?.contentOrNull) != null)

        fun jzone(z: Zone) = JardinJson.json.encodeToJsonElement(Zone.serializer(), z.copy(id = ""))
        val shape = PolygonShape(listOf(Point(0.0, 0.0), Point(1.0, 0.0), Point(1.0, 1.0)))
        o["createZone"]!!.jsonArray.forEachIndexed { i, e ->
            val z = createZone(ZONE_TYPES[i].id, shape)
            assertJsonClose(JsonObject(e.jsonObject.filterKeys { it != "plantings" } + ("plantings" to JsonArray(emptyList()))), JsonObject(jzone(z).jsonObject.filterKeys { it != "id" && it != "depth" && it != "height" && it != "maintenance" && it != "autoInfo" } + ("plantings" to JsonArray(emptyList()))), "createZone ${ZONE_TYPES[i].id}")
        }
        val g = o["createGarden"]!!.jsonObject
        val cg = createGarden("Mon pré")
        assertEquals(g["name"]!!.jsonPrimitive.content, cg.name); assertEquals(g["status"]!!.jsonPrimitive.content, cg.status)
        assertEquals(g["context"]!!.jsonObject["bedMode"]!!.jsonPrimitive.content, cg.context.bedMode)
        assertEquals(g["sun"]!!.jsonObject["mode"]!!.jsonPrimitive.content, cg.sun.mode)
        for (e in o["createItem"]!!.jsonArray) {
            val a = e.jsonObject["args"]!!.jsonArray
            val it = createItem(a[0].jsonPrimitive.content, dbl(a.getOrNull(1)) ?: 0.0, dbl(a.getOrNull(2)) ?: 0.0, dbl(a.getOrNull(3)) ?: 0.0)
            val r = e.jsonObject["r"]!!.jsonObject
            assertJsonClose(r, buildJsonObject { put("kind", it.kind); put("x", jn(it.x)); put("y", jn(it.y)); put("rotation", jn(it.rotation)); put("width", jn(it.width)); put("depth", jn(it.depth)); it.radius?.let { x -> put("radius", jn(x)) } }, "createItem $a")
        }
        for (e in o["createOpening"]!!.jsonArray) {
            val a = e.jsonObject["args"]!!.jsonArray
            val op = createOpening(a[0].jsonPrimitive.content, refOf(a[1]), dbl(a.getOrNull(2)) ?: 0.5)
            assertJsonClose(e.jsonObject["r"], buildJsonObject {
                put("kind", op.kind); put("ref", JardinJson.json.encodeToJsonElement(OpeningRef.serializer(), op.ref)); put("t", jn(op.t)); put("width", jn(op.width)); put("swing", op.swing)
            }, "createOpening $a")
        }
        assertTrue(o["createZoneErr"]!!.jsonPrimitive.boolean && o["createItemErr"]!!.jsonPrimitive.boolean && o["createOpeningErr"]!!.jsonPrimitive.boolean)
        val bedInputs = listOf(createGarden("x"), createGarden("x").copy(context = GardenContext(bedMode = "auto")), createGarden("x").copy(context = GardenContext()), null, createGarden("x"))
        assertEquals(o["bedMode"]!!.jsonArray.map { it.jsonPrimitive.content }, bedInputs.map { bedModeOf(it) })
        for (e in o["setPool"]!!.jsonArray) {
            val j = e.jsonObject
            val z = setPoolVariant(Zone("p", "pool", label = j["label"]!!.jsonPrimitive.content, variant = "inground"), j["v"]!!.jsonPrimitive.content)
            assertEquals(j["r"]!!.jsonObject["label"]!!.jsonPrimitive.content, z.label, "setPool $j"); assertEquals(j["r"]!!.jsonObject["variant"]!!.jsonPrimitive.content, z.variant)
        }
        val plants = GoldenFixtures.plants(o["plants"]!!)
        val lookup = GoldenFixtures.lookupOf(plants)
        fun jv(v: Validation) = buildJsonObject { put("ok", v.ok); put("errors", JsonArray(v.errors.map { JsonPrimitive(it) })); put("warnings", JsonArray(v.warnings.map { JsonPrimitive(it) })) }
        for ((k, v) in o["validate"]!!.jsonObject) assertJsonClose(v, jv(validateGarden(GoldenFixtures.garden(k), lookup)), "validate.$k")
        val withEx = GoldenFixtures.garden("main").copy(existing = listOf(Existing("ee", "tree", plants[0].id, "", -5.0, -5.0, null, 8.0, 5.0)))
        assertJsonClose(o["validateLabel"], jv(validateGarden(withEx, lookup)), "validateLabel")
        val ens = ensureAmenagements(GoldenFixtures.garden("old"))
        val ee = o["ensure"]!!.jsonObject
        assertEquals(0, ens.items.size); assertEquals(0, ens.openings.size); assertEquals(0, ens.boundaryEdges.size)
        assertEquals(ee["existing"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content }, ens.existing.map { it.id })
        assertEquals(ee["obstacles"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content }, ens.obstacles.map { it.id })
    }
}
