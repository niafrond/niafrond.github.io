package fr.jardin.core

import kotlinx.serialization.json.*
import java.time.Instant
import kotlin.math.abs
import kotlin.test.*

class SunTest {
    private fun ms(iso: String) = Instant.parse(iso).toEpochMilli()

    // ---- portés de sun.test.js (cas essentiels)
    @Test fun positionDuSoleil() {
        val s = sunPosition(48.85, 2.35, ms("2025-06-21T10:30:00Z"))
        assertTrue(s.elevation in 55.0..66.0, "élévation ${s.elevation}")
        assertTrue(abs(s.azimuth - 180) < 50, "azimut ${s.azimuth}")
        assertTrue(sunPosition(48.85, 2.35, ms("2025-06-21T00:00:00Z")).elevation < 0)
        assertTrue(sunPosition(48.85, 2.35, ms("2025-12-21T11:00:00Z")).elevation < 20)
    }

    @Test fun niveaux() {
        assertEquals("full", levelFromHours(6.0)); assertEquals("partial", levelFromHours(3.0)); assertEquals("shade", levelFromHours(2.99))
    }

    @Test fun murAuSud() {
        // un mur haut juste au sud d'un point prive le point de soleil de plein midi
        val mur = ShadowObstacle("w", "wall", 10.0, points = listOf(Point(-20.0, 1.0), Point(20.0, 1.0)))
        val libre = sunHoursOnPoint(Point(0.0, 0.0), 48.85, 2.35, 0.0, emptyList(), ms("2025-06-21T12:00:00Z"))
        val ombre = sunHoursOnPoint(Point(0.0, 0.0), 48.85, 2.35, 0.0, listOf(mur), ms("2025-06-21T12:00:00Z"))
        assertTrue(libre > 12, "libre $libre"); assertTrue(ombre < libre)
    }

    @Test fun zoneUniforme() {
        val g = createGarden("t").copy(sun = SunInfo("uniform", "partial"))
        val z = createZone("lawn", PolygonShape(listOf(Point(0.0, 0.0), Point(1.0, 0.0), Point(1.0, 1.0))))
        val r = zoneSunLevel(g, z)
        assertEquals("partial", r.level); assertEquals(1.0, r.share.partial)
        assertNull(zoneSunLevel(createGarden("t"), z).level)
    }

    // ---- golden
    private val o = loadGolden("sun")
    private val g = GoldenFixtures.garden(o["garden"]!!)
    private val plants = GoldenFixtures.plants(o["plants"]!!)
    private val lookup = GoldenFixtures.lookupOf(plants)
    private val frozenSolstice = ms("2025-06-21T12:00:00Z")

    @Test fun golden() {
        for (e in o["pos"]!!.jsonArray) {
            val j = e.jsonObject
            val r = sunPosition(dbl(j["la"])!!, dbl(j["lo"])!!, ms(j["t"]!!.jsonPrimitive.content))
            assertJsonClose(j["r"], buildJsonObject { put("azimuth", jn(r.azimuth)); put("elevation", jn(r.elevation)) }, "pos $j", tol = 1e-6)
        }
        for (e in o["level"]!!.jsonArray) assertEquals(e.jsonObject["r"]!!.jsonPrimitive.content, levelFromHours(dbl(e.jsonObject["h"])!!))
        assertJsonClose(o["shadow"], jobsList(shadowObstacles(g)), "shadow")
        assertJsonClose(o["shadowLookup"], jobsList(shadowObstacles(g, lookup)), "shadowLookup")
        assertJsonClose(o["zoneShadow"], jobsList(zoneShadowObstacles(g, lookup)), "zoneShadow")
        val obs = shadowObstacles(g)
        for (e in o["hours"]!!.jsonArray) {
            val j = e.jsonObject; val d = ms(j["d"]!!.jsonPrimitive.content); val na = dbl(j["na"])!!; val p = pt(j["p"]!!)
            assertEquals(dbl(j["r"])!!, sunHoursOnPoint(p, 48.85, 2.35, na, obs, d), 1e-9, "hours $j")
            assertEquals(dbl(j["r0"])!!, sunHoursOnPoint(p, 48.85, 2.35, na, emptyList(), d), 1e-9, "hours0 $j")
        }
        fun regions(l: List<SunMapRegion>) = JsonArray(l.map { buildJsonObject { put("level", it.level); put("points", jpts(it.points)) } })
        val dates = o["dates"]!!.jsonArray.map { ms(it.jsonPrimitive.content) }
        val m = o["map"]!!.jsonArray
        assertJsonClose(m[0], regions(estimateSunMap(g, dates[0], 1.0)), "map0")
        assertJsonClose(m[1], regions(estimateSunMap(g, dates[2], 0.75, lookup)), "map1")
        assertJsonClose(m[2], regions(estimateSunMap(g, frozenSolstice, 1.0)), "map2")
        assertJsonClose(m[3], regions(estimateSunMap(GoldenFixtures.garden("empty"))), "map3")
        assertJsonClose(m[4], regions(estimateSunMap(GoldenFixtures.garden("small"), null, 0.25)), "map4")
        val variants = mapOf(
            "map" to g,
            "uniform" to g.copy(sun = SunInfo("uniform", "partial")),
            "uniformNone" to g.copy(sun = SunInfo("uniform", null)),
            "unknown" to g.copy(sun = SunInfo("unknown")),
            "noExisting" to g.copy(existing = emptyList()),
            "mapNoExisting" to g.copy(existing = emptyList()),
            "noLoc" to g.copy(context = g.context.copy(location = null)),
        )
        for ((k, v) in variants) {
            val expected = o["zoneSun"]!!.jsonObject[k]!!.jsonArray
            // `noExisting` du golden reprend la carte d'origine (régions peintes) avec `existing` vide
            v.zones.forEachIndexed { i, z ->
                val r = zoneSunLevel(v, z, frozenSolstice)
                assertJsonClose(expected[i], buildJsonObject {
                    put("level", jstr(r.level)); put("dominant", jstr(r.dominant))
                    put("share", buildJsonObject { put("full", jn(r.share.full)); put("partial", jn(r.share.partial)); put("shade", jn(r.share.shade)) })
                }, "zoneSun.$k.${z.id}")
            }
        }
    }
}
