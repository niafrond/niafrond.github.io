package fr.jardin.core

import kotlinx.serialization.json.*
import java.io.File
import java.util.Base64
import java.util.zip.Deflater
import kotlin.test.*

class TransferTest {
    private fun riche(): Garden {
        val boundary = listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 8.0), Point(0.0, 8.0))
        val z = createZone("lawn", PolygonShape(boundary)).copy(plantings = listOf(Planting("p1", count = 3), Planting("p2", count = 2)))
        val g = createGarden("Jardin é à ñ 🌳")
        return g.copy(boundary = boundary, boundaryClosed = true, context = g.context.copy(region = "Bretagne"),
            obstacles = listOf(Obstacle(id = "o1", kind = "tree", center = Point(2.0, 2.0), radius = 2.0, height = 6.0)),
            zones = listOf(z), plan = Plan(svg = "<svg>" + "x".repeat(5000) + "</svg>"))
    }
    private val CODE_RE = Regex("^v2u?\\.[0-9a-z]+\\.[A-Za-z0-9_-]+$")
    private fun b64u(b: ByteArray) = Base64.getUrlEncoder().withoutPadding().encodeToString(b)

    @Test fun allerRetour() {
        val g = riche()
        val code = Transfer.encodeGarden(g)
        assertTrue(CODE_RE.matches(code))
        assertTrue(code.length < JardinJson.encodeGarden(g).length)
        val r = Transfer.decodeGarden(code)
        assertEquals(g.name, r.name); assertEquals(g.boundary, r.boundary)
        assertEquals(g.zones[0].plantings, r.zones[0].plantings); assertEquals(g.obstacles, r.obstacles)
        assertNull(r.plan.svg)
    }

    @Test fun repliNonCompresse() {
        val code = Transfer.encodeGarden(riche(), compress = false)
        assertTrue(code.startsWith("v2u."))
        assertEquals(riche().name, Transfer.decodeGarden(code).name)
    }

    @Test fun valeursParDefaut() {
        val code = Transfer.encodeGardenJson(buildJsonObject { put("name", "Mini"); put("boundary", JsonArray(emptyList())); put("zones", JsonArray(emptyList())) })
        val r = Transfer.decodeGarden(code)
        assertEquals("Mini", r.name); assertEquals(JsonObject(emptyMap()), r.tasksDone); assertEquals("draft", r.status)
    }

    @Test fun erreurs() {
        for (c in listOf("", "abc", "v1.", "v1.@@@", "v1.AAAA", "v1u.AAAA")) {
            val e = assertFailsWith<TransferException>(c) { Transfer.decodeGarden(c) }
            assertTrue(Regex("illisible|reconnu|invalide", RegexOption.IGNORE_CASE).containsMatchIn(e.message!!), c)
        }
        assertTrue(assertFailsWith<TransferException> { Transfer.decodeGarden("v9.AAAA") }.message!!.contains("version plus récente"))
        val code = Transfer.encodeGarden(riche())
        assertFailsWith<TransferException> { Transfer.decodeGarden(code.take(20) + "zzzz" + code.drop(30)) }
        val bad = "v1u." + b64u("""{"a":1}""".toByteArray())
        assertTrue(assertFailsWith<TransferException> { Transfer.decodeGarden(bad) }.message!!.contains("reconnu"))
    }

    @Test fun liens() {
        val code = "v1.AbC-_123"
        assertEquals("https://niafrond.github.io/jardin/#/import/v1.AbC-_123", Transfer.buildShareLink(code, "https://niafrond.github.io/jardin/"))
        assertEquals("jardin://import/v1.AbC-_123", Transfer.buildAppLink(code))
        assertEquals(code, Transfer.codeFromUrl("https://niafrond.github.io/jardin/#/import/$code"))
        assertEquals(code, Transfer.codeFromUrl("jardin://import/$code"))
        assertEquals(code, Transfer.codeFromUrl("intent://import/$code#Intent;scheme=jardin;end"))
        assertEquals(code, Transfer.codeFromUrl("  v1.AbC\n-_123 \n"))
        assertNull(Transfer.codeFromUrl("bonjour")); assertNull(Transfer.codeFromUrl("")); assertNull(Transfer.codeFromUrl(null))
        assertEquals("#/import/$code", Transfer.routeFromIncomingUrl("jardin://import/$code"))
        assertEquals("#/import/$code", Transfer.routeFromIncomingUrl("https://niafrond.github.io/jardin/#/import/$code"))
        assertNull(Transfer.routeFromIncomingUrl("https://niafrond.github.io/jardin/")); assertNull(Transfer.routeFromIncomingUrl(code)); assertNull(Transfer.routeFromIncomingUrl(null))
    }

    @Test fun description() {
        assertEquals(GardenDescription("Jardin é à ñ 🌳", 80.0, 1, 5, 1), Transfer.describeGarden(riche()))
        assertEquals(0.0, Transfer.describeGarden(null).areaM2)
    }

    @Test fun taille() {
        assertEquals(SizeInfo(6, true), Transfer.sizeInfo("v1.abc"))
        assertFalse(Transfer.sizeInfo("v1." + "a".repeat(3000)).fitsQr)
        assertEquals(2000, Transfer.QR_MAX_BYTES)
    }

    private fun gros(): Garden {
        val g = createGarden("Gros")
        val views = buildJsonObject { put("iso-ne", "<svg>" + "y".repeat(300000) + "</svg>"); put("iso-se", "<svg>" + "z".repeat(300000) + "</svg>") }
        return g.copy(boundary = listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 8.0), Point(0.0, 8.0)), boundaryClosed = true, status = "validated",
            plan = Plan(svg = "<svg>" + "x".repeat(200000) + "</svg>", validatedAt = "2026-01-01", views = views))
    }

    @Test fun liensLegersEtCoupes() {
        val code = Transfer.encodeGarden(gros())
        assertTrue(code.length < 4000)
        val g = Transfer.decodeGarden(code)
        assertTrue(g.plan.views == null || g.plan.views is JsonNull || (g.plan.views as? JsonObject)?.isEmpty() == true)
        assertEquals("Gros", g.name)
        assertTrue(Regex("^v2u?\\.[0-9a-z]+\\.").containsMatchIn(code))
        assertEquals(4, g.boundary.size)
        val e = assertFailsWith<TransferException> { Transfer.decodeGarden(code.dropLast(30)) }
        assertTrue(Regex("Lien coupé : \\d+ caractères reçus sur \\d+").containsMatchIn(e.message!!))
        assertEquals("Gros", Transfer.decodeGarden(code.replace(Regex("(.{40})"), "$1\n")).name)
        assertEquals("Gros", Transfer.decodeGarden(java.net.URLEncoder.encode(code, "UTF-8")).name)
        assertEquals(code, Transfer.codeFromUrl("https://niafrond.github.io/jardin/#/import/$code"))
    }

    @Test fun anciensCodesV1() {
        val json = """{"format":"jardin-v1","garden":{"name":"Ancien","boundary":[{"x":0,"y":0},{"x":4,"y":0},{"x":4,"y":4}],"zones":[]}}"""
        assertEquals("Ancien", Transfer.decodeGarden("v1u." + b64u(json.toByteArray())).name)
        val d = Deflater(Deflater.DEFAULT_COMPRESSION, true)
        d.setInput(json.toByteArray()); d.finish()
        val buf = ByteArray(1000); val n = d.deflate(buf)
        assertEquals("Ancien", Transfer.decodeGarden("v1." + b64u(buf.copyOf(n))).name)
    }

    // ── golden ──
    private val dec = JardinJson.json
    private fun asGarden(e: JsonElement) = dec.decodeFromJsonElement(Garden.serializer(), e)

    @Test fun golden() {
        val gj = goldenJson("transfer")
        assertEquals(gj["qrMax"]!!.jsonPrimitive.int, Transfer.QR_MAX_BYTES)
        // codes du web (compressés et non compressés) lus en Kotlin
        for (key in listOf("withCodes", "codesU")) gj[key]!!.jsonArray.forEachIndexed { i, e ->
            val o = e.jsonObject; val code = o["code"]!!.jsonPrimitive.content
            assertSame2(o["decoded"], Transfer.decodeGardenJson(code), "$key[$i] json")
            assertEquals(asGarden(o["decoded"]!!), Transfer.decodeGarden(code), "$key[$i]")
            assertEquals(code.startsWith("v2u."), key == "codesU")
        }
        // cas limites : messages d'erreur identiques
        for (e in gj["custom"]!!.jsonArray) {
            val o = e.jsonObject; val c = o["c"]!!.jsonPrimitive.content
            if (o["error"] != null) {
                val ex = assertFailsWith<TransferException>("custom ${c.take(30)}") { Transfer.decodeGarden(c) }
                assertEquals(o["error"]!!.jsonPrimitive.content, ex.message, "custom ${c.take(30)}")
            } else assertSame2(o["decoded"], Transfer.decodeGardenJson(c), "custom ${c.take(30)}")
        }
        for (e in gj["urls"]!!.jsonArray) {
            val o = e.jsonObject; val u = o["u"]?.jsonPrimitive?.contentOrNull
            assertEquals(o["code"]!!.jsonPrimitive.contentOrNull, Transfer.codeFromUrl(u), "code $u")
            assertEquals(o["route"]!!.jsonPrimitive.contentOrNull, Transfer.routeFromIncomingUrl(u), "route $u")
        }
        for (e in gj["links"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["share"]!!.jsonPrimitive.content, Transfer.buildShareLink(o["code"]!!.jsonPrimitive.content, o["base"]!!.jsonPrimitive.contentOrNull))
            assertEquals(o["app"]!!.jsonPrimitive.content, Transfer.buildAppLink(o["code"]!!.jsonPrimitive.content))
        }
        fun descJson(d: GardenDescription) = buildJsonObject { put("name", d.name); put("areaM2", d.areaM2); put("zones", d.zones); put("plants", d.plants); put("items", d.items) }
        goldenGardens(gj).forEachIndexed { i, g -> assertSame2(gj["descs"]!!.jsonArray[i], descJson(Transfer.describeGarden(g)), "desc[$i]") }
        for (e in gj["extraDesc"]!!.jsonArray) {
            val gg = asGarden(JsonObject(e.jsonObject["g"]!!.jsonObject + ("id" to JsonPrimitive("x"))))
            val exp = e.jsonObject["d"]!!.jsonObject
            val got = descJson(Transfer.describeGarden(if (e.jsonObject["g"]!!.jsonObject.isEmpty()) null else gg))
            // l'ancien code renvoie « Jardin sans nom » quand le nom est absent ; Garden.name vaut « Mon jardin » par défaut
            assertEquals(exp["zones"], got["zones"]); assertEquals(exp["plants"], got["plants"]); assertEquals(exp["items"], got["items"]); assertSame2(exp["areaM2"], got["areaM2"])
        }
        for (e in gj["sizes"]!!.jsonArray) {
            val o = e.jsonObject; val s = o["s"]!!.jsonObject
            val r = Transfer.sizeInfo(o["c"]!!.jsonPrimitive.contentOrNull)
            assertEquals(s["length"]!!.jsonPrimitive.int, r.length); assertEquals(s["fitsQr"]!!.jsonPrimitive.boolean, r.fitsQr)
        }
    }

    /** Codes générés par Kotlin pour la vérification croisée côté JS (`tools/verify-transfer-kotlin.mjs`). */
    @Test fun ecritCodesPourVerificationJs() {
        val gj = goldenJson("transfer")
        val out = buildJsonArray {
            goldenGardens(gj).forEachIndexed { i, g ->
                add(buildJsonObject { put("i", i); put("code", Transfer.encodeGarden(g)); put("codeU", Transfer.encodeGarden(g, compress = false)) })
            }
        }
        val dir = File("build").also { it.mkdirs() }
        File(dir, "transfer-kotlin-codes.json").writeText(out.toString())
    }
}
