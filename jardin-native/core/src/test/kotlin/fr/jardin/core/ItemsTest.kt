package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class ItemsTest {
    private fun p(x: Double, y: Double) = Point(x, y)
    private fun garden(closed: Boolean = true) = createGarden("t").copy(
        boundary = listOf(p(0.0, 0.0), p(10.0, 0.0), p(10.0, 10.0), p(0.0, 10.0)), boundaryClosed = closed,
    )

    // ---- portés de items.test.js
    @Test fun catalogue() {
        assertTrue(ITEM_KINDS.size >= 25)
        assertEquals(ITEM_KINDS.size, ITEM_KINDS.map { it.id }.toSet().size)
        assertEquals(listOf("gate", "wicket", "door", "garage", "double_gate"), OPENING_KINDS.map { it.id })
        assertEquals(listOf("open", "wall", "fence", "hedge"), EDGE_IDS)
    }

    @Test fun polygoneDElement() {
        val r = Item(id = "a", kind = "bench", x = 5.0, y = 5.0, width = 2.0, depth = 1.0)
        val poly = itemPolygon(r)
        assertEquals(4, poly.size)
        assertEquals(2.0, polygonArea(poly), 1e-9)
        val rot = itemPolygon(r.copy(rotation = 90.0))
        assertEquals(2.0, polygonArea(rot), 1e-9)
        assertEquals(1.0, bounds(rot).width, 1e-9)
        val c = itemPolygon(createItem("parasol", 5.0, 5.0))
        assertEquals(24, c.size)
    }

    @Test fun cotesEtOuvertures() {
        assertEquals(4, boundarySides(garden()).size)
        assertEquals(3, boundarySides(garden(closed = false)).size)
        assertEquals(4, obstacleSides(Obstacle(kind = "house", points = listOf(p(0.0, 0.0), p(1.0, 0.0), p(1.0, 1.0), p(0.0, 1.0)))).size)
        assertEquals(3, obstacleSides(Obstacle(kind = "wall", points = listOf(p(0.0, 0.0), p(1.0, 0.0), p(1.0, 1.0), p(0.0, 1.0)))).size)
        val g = garden()
        val op = createOpening("gate", OpeningRef("boundary", 0), 0.5)
        val geo = openingGeometry(g, op)!!
        assertEquals(5.0, geo.center.x, 1e-9)
        assertEquals(3.0, geo.width, 1e-9)
        assertEquals(-1.0, geo.normal.y, 1e-9) // vers l'extérieur (le haut du plan)
        assertNull(openingGeometry(g, op.copy(ref = OpeningRef("boundary", 9))))
        val snap = snapOpeningToSides(g, p(5.0, -1.0), kind = "gate")!!
        assertEquals(0, snap.ref.side)
        assertEquals(1.0, snap.dist, 1e-9)
    }

    @Test fun obstaclesDerives() {
        val g = garden().copy(boundaryEdges = listOf(BoundaryEdge("wall"), BoundaryEdge("fence", height = 1.6)), items = listOf(createItem("pergola", 5.0, 5.0), createItem("bench", 1.0, 1.0)))
        val e = edgeObstacles(g)
        assertEquals(listOf("wall", "fence"), e.map { it.kind })
        assertEquals(listOf(2.0, 1.6), e.map { it.height })
        assertEquals(1, itemObstacles(g).size)
        assertEquals(900.0 + 90.0, itemsTotalPrice(g), 1e-9)
    }

    // ---- golden
    private val o = loadGolden("items")
    private val g = GoldenFixtures.garden(o["garden"]!!)

    @Test fun golden() {
        val c = o["consts"]!!.jsonObject
        assertEquals(c["items"]!!.jsonArray.map { it.jsonObject["id"]!!.jsonPrimitive.content }, ITEM_KINDS.map { it.id })
        c["items"]!!.jsonArray.forEachIndexed { i, e ->
            val k = ITEM_KINDS[i]; val j = e.jsonObject
            assertJsonClose(buildJsonObject { put("label", k.label); put("w", jn(k.w)); put("d", jn(k.d)); put("shape", k.shape); put("price", jn(k.priceEur)); k.height?.let { put("height", jn(it)) } },
                buildJsonObject { put("label", j["label"]!!); put("w", j["w"]!!); put("d", j["d"]!!); put("shape", j["shape"]!!); put("price", j["priceEur"]!!); j["height"]?.let { put("height", it) } }, "item.${k.id}")
        }
        c["openings"]!!.jsonArray.forEachIndexed { i, e ->
            val k = OPENING_KINDS[i]
            assertEquals(e.jsonObject["id"]!!.jsonPrimitive.content, k.id); assertEquals(e.jsonObject["width"]!!.jsonPrimitive.double, k.width)
            assertEquals(e.jsonObject["swing"]!!.jsonPrimitive.content, k.swing)
            assertEquals(e.jsonObject["targets"]!!.jsonArray.map { it.jsonPrimitive.content }, k.targets)
        }
        c["edges"]!!.jsonArray.forEachIndexed { i, e ->
            assertEquals(e.jsonObject["height"]!!.jsonPrimitive.double, EDGE_KINDS[i].height)
            assertEquals(e.jsonObject["thickness"]?.jsonPrimitive?.doubleOrNull, EDGE_KINDS[i].thickness)
        }
        for ((k, v) in c["materials"]!!.jsonObject) assertEquals(v.jsonObject["color"]!!.jsonPrimitive.content, MATERIALS.getValue(k).color)
        for (m in o["materialOf"]!!.jsonArray) {
            val j = m.jsonObject
            assertEquals(j["r"]?.jsonPrimitive?.contentOrNull, materialOf(j["k"]!!.jsonPrimitive.content, j["m"]?.jsonPrimitive?.contentOrNull))
            assertEquals(j["d"]?.jsonPrimitive?.contentOrNull, defaultMaterial(j["k"]!!.jsonPrimitive.content))
        }
        for (l in o["lookups"]!!.jsonArray) {
            val id = l.jsonObject["id"]?.jsonPrimitive?.contentOrNull
            assertEquals(l.jsonObject["item"]!!.jsonPrimitive.boolean, getItemKind(id) != null)
            assertEquals(l.jsonObject["opening"]!!.jsonPrimitive.boolean, getOpeningKind(id) != null)
            assertEquals(l.jsonObject["edge"]!!.jsonPrimitive.boolean, getEdgeKind(id) != null)
        }
        val items = o["itemInputs"]!!.jsonArray.map { itemOf(it) }
        val probe = pts(o["probe"]!!)
        o["itemFns"]!!.jsonArray.forEachIndexed { i, e ->
            val it = items[i]; val j = e.jsonObject
            assertJsonClose(j["radius"], itemRadius(it)?.let { r -> jn(r) } ?: JsonNull, "radius$i")
            val h = itemHalfSize(it)
            assertJsonClose(j["half"], buildJsonObject { put("hw", jn(h.hw)); put("hd", jn(h.hd)) }, "half$i")
            assertJsonClose(j["poly"], jpts(itemPolygon(it)), "poly$i")
            assertJsonClose(j["poly8"], jpts(itemPolygon(it, 8)), "poly8$i")
            assertEquals(j["contains"]!!.jsonArray.map { x -> x.jsonPrimitive.boolean }, probe.map { q -> itemContains(it, q) }, "contains$i")
        }
        fun side(s: Side) = buildJsonObject { put("i", jn(s.i)); put("a", jp(s.a)); put("b", jp(s.b)) }
        for ((k, v) in o["boundarySides"]!!.jsonObject) assertJsonClose(v, JsonArray(boundarySides(GoldenFixtures.garden(k)).map { side(it) }), "bsides.$k")
        o["obstacleSides"]!!.jsonArray.forEachIndexed { i, e -> assertJsonClose(e, JsonArray(obstacleSides(g.obstacles[i]).map { side(it) }), "osides$i") }
        assertJsonClose(o["obstacleSidesNull"], JsonArray(listOf(obstacleSides(null), obstacleSides(Obstacle(kind = "wall", points = listOf(Point(0.0, 0.0))))).map { l -> JsonArray(l.map { side(it) }) }))
        fun rs(r: ResolvedSide?): JsonElement = if (r == null) JsonNull else buildJsonObject { put("a", jp(r.a)); put("b", jp(r.b)); put("outward", jn(r.outward)); put("kind", r.kind) }
        val refs = o["refs"]!!.jsonArray.map { refOf(it) }
        assertJsonClose(o["resolve"], JsonArray(refs.map { rs(resolveSide(g, it)) }), "resolve")
        val open = GoldenFixtures.garden("open")
        assertJsonClose(o["resolveOpen"], JsonArray(refs.take(4).map { rs(resolveSide(open, it)) }), "resolveOpen")
        val ops = o["openingInputs"]!!.jsonArray.map { openingOf(it) }
        assertJsonClose(o["openingGeom"], JsonArray(ops.map { op ->
            openingGeometry(g, op)?.let { r ->
                buildJsonObject {
                    put("a", jp(r.a)); put("b", jp(r.b)); put("center", jp(r.center)); put("normal", jp(r.normal)); put("u", jp(r.u))
                    put("width", jn(r.width)); put("t", jn(r.t)); put("sideLength", jn(r.sideLength)); put("sideKind", r.sideKind)
                }
            } ?: JsonNull
        }), "openingGeom")
        for (a in o["allowed"]!!.jsonArray) assertEquals(a.jsonObject["r"]!!.jsonPrimitive.boolean, openingAllowedOn(a.jsonObject["k"]!!.jsonPrimitive.content, a.jsonObject["t"]!!.jsonPrimitive.content))
        for (s in o["snapInputs"]!!.jsonArray) {
            val so = s.jsonObject["o"]!!.jsonObject
            val r = snapOpeningToSides(g, pt(s.jsonObject["p"]!!), so["kind"]?.jsonPrimitive?.contentOrNull, dbl(so["maxDist"]) ?: Double.POSITIVE_INFINITY)
            val actual = if (r == null) JsonNull else buildJsonObject {
                put("ref", buildJsonObject { put("type", r.ref.type); put("side", jn(r.ref.side)); r.ref.obstacleId?.let { put("obstacleId", it) }; r.ref.existingId?.let { put("existingId", it) } })
                put("t", jn(r.t)); put("point", jp(r.point)); put("dist", jn(r.dist))
            }
            assertJsonClose(s.jsonObject["r"], actual, "snap $s")
        }
        for (e in o["edges"]!!.jsonArray) {
            val i = e.jsonObject["i"]!!.jsonPrimitive.int
            assertEquals(e.jsonObject["kind"]!!.jsonPrimitive.content, edgeKindOf(g, i)); assertEquals(e.jsonObject["h"]!!.jsonPrimitive.double, edgeHeightOf(g, i), 1e-12)
        }
        val empty = GoldenFixtures.garden("empty")
        for (e in o["edgesNoEdges"]!!.jsonArray) {
            val i = e.jsonObject["i"]!!.jsonPrimitive.int
            assertEquals(e.jsonObject["kind"]!!.jsonPrimitive.content, edgeKindOf(empty, i)); assertEquals(e.jsonObject["h"]!!.jsonPrimitive.double, edgeHeightOf(empty, i), 1e-12)
        }
        assertJsonClose(o["edgeObstacles"], jobsList(edgeObstacles(g)), "edgeObstacles")
        assertJsonClose(o["itemObstacles"], jobsList(itemObstacles(g)), "itemObstacles")
        assertEquals(o["price"]!!.jsonPrimitive.double, itemsTotalPrice(g), 1e-9)
        assertEquals(o["priceEmpty"]!!.jsonPrimitive.double, itemsTotalPrice(empty), 1e-9)
    }
}
