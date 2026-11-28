package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class WeatherTest {
    private val json = Json.parseToJsonElement("""{"daily":{"time":["2026-06-01","2026-06-02"],"precipitation_sum":[0,4.2],"et0_fao_evapotranspiration":[4.1,null],"temperature_2m_min":[11,12],"temperature_2m_max":[24,36]}}""")

    @Test fun parseOpenMeteo() {
        assertEquals(listOf(WeatherDay("2026-06-01", 0.0, 4.1, 11.0, 24.0), WeatherDay("2026-06-02", 4.2, null, 12.0, 36.0)), Weather.parseOpenMeteo(json))
        assertFailsWith<IllegalArgumentException> { Weather.parseOpenMeteo(Json.parseToJsonElement("{}")) }
    }

    @Test fun url() {
        val u = Weather.weatherUrl(48.85661, 2.35222, 7)
        assertTrue(u.contains("latitude=48.857&longitude=2.352"))
        assertTrue(u.contains("forecast_days=7")); assertTrue(u.contains("past_days=3"))
        assertTrue(u.contains("timezone=auto")); assertTrue(u.contains("et0_fao_evapotranspiration"))
    }

    @Test fun cache() {
        val t = java.time.Instant.parse("2026-06-01T10:00:00Z").toEpochMilli()
        assertTrue(Weather.isCacheFresh("2026-06-01T10:00:00.000Z", t + 60000, 7, 7))
        assertFalse(Weather.isCacheFresh("2026-06-01T10:00:00.000Z", t + 3 * 3600_000, 7, 7))
        assertFalse(Weather.isCacheFresh("2026-06-01T10:00:00.000Z", t + 60000, 3, 7))
        assertEquals("jardin:weather:3.000,4.000", Weather.cacheKey(3.0, 4.0))
    }

    @Test fun golden() {
        val g = goldenJson("weather")
        g["inputs"]!!.jsonArray.forEachIndexed { i, input ->
            val exp = g["parsed"]!!.jsonArray[i].jsonObject
            val r = runCatching { Weather.parseOpenMeteo(input) }
            if (exp["error"] != null) { assertTrue(r.isFailure, "input $i"); assertEquals(exp["error"]!!.jsonPrimitive.content, r.exceptionOrNull()!!.message) }
            else {
                val got = JsonArray(r.getOrThrow().map { d -> buildJsonObject { put("date", d.date); put("precipMm", d.precipMm); put("et0Mm", d.et0Mm); put("tminC", d.tminC); put("tmaxC", d.tmaxC) } })
                assertSame2(exp["ok"], got, "parsed[$i]")
            }
        }
        for (e in g["urls"]!!.jsonArray) { val o = e.jsonObject; assertEquals(o["url"]!!.jsonPrimitive.content, Weather.weatherUrl(o["la"]!!.jsonPrimitive.double, o["lo"]!!.jsonPrimitive.double, Math.floor(o["d"]!!.jsonPrimitive.double + 0.5).toInt()), o.toString()) }
        for (e in g["keys"]!!.jsonArray) { val o = e.jsonObject; assertEquals(o["key"]!!.jsonPrimitive.content, Weather.cacheKey(o["la"]!!.jsonPrimitive.double, o["lo"]!!.jsonPrimitive.double)) }
    }
}
