package fr.jardin.core

import kotlinx.serialization.json.*
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.test.*

class WateringTest {
    private val paris = ZoneId.of("Europe/Paris")
    private fun sq(s: Double, x: Double = 0.0) = PolygonShape(listOf(Point(x, 0.0), Point(x + s, 0.0), Point(x + s, s), Point(x, s)))
    private val plants = listOf(
        Plant("lav", commonName = "Lavande", category = "perennial", water = "low", kc = 0.4, hardiness = -12.0),
        Plant("hyd", commonName = "Hortensia", category = "shrub", water = "high", kc = 0.9, hardiness = -15.0),
        Plant("oli", commonName = "Olivier", category = "tree", water = "low", kc = 0.5, hardiness = -3.0),
    ).associateBy { it.id }
    private val lookup: PlantById = { plants[it] }
    private fun garden() = Garden(id = "g", context = GardenContext(soil = "loam"), zones = listOf(
        Zone("a", "midplants", "massif sud", sq(5.0), listOf(Planting("hyd", count = 4))),
        Zone("b", "midplants", "rocaille", sq(2.0, 10.0), listOf(Planting("lav", count = 3), Planting("oli", count = 1))),
        Zone("c", "terrace", "terrasse", sq(3.0, 20.0)),
        Zone("d", "lawn", "pelouse", sq(4.0, 30.0)),
    ))
    private fun day(date: String, precip: Double = 0.0, et0: Double = 5.0, tmin: Double = 12.0, tmax: Double = 28.0) = WeatherDay(date, precip, et0, tmin, tmax)
    private fun dates(from: Int, n: Int) = (0 until n).map { LocalDate.of(2026, 6, from).plusDays(it.toLong()).toString() }
    private fun forecast(over: Map<String, WeatherDay.() -> WeatherDay> = emptyMap(), all: (WeatherDay) -> WeatherDay = { it }, n: Int = 10, from: Int = 7) =
        Forecast(dates(from, n).map { d -> val b = all(day(d)); over[d]?.invoke(b) ?: b })
    private val now: Instant = LocalDateTime.of(2026, 6, 10, 8, 0).atZone(paris).toInstant()
    private val settings = NotifSettings()
    private fun plan(f: Forecast?, state: WateringState = WateringState(), s: NotifSettings = settings, g: Garden = garden(), at: Instant = now) =
        Watering.planWatering(g, f, state, at, s, lookup, paris)
    private fun dayOf(n: WateringNotification) = n.at.substring(0, 10)

    @Test fun hydrozonesEtProfils() {
        val hz = Watering.hydrozones(garden(), lookup)
        assertEquals(listOf("low", "medium", "high"), hz.map { it.level })
        assertEquals(listOf("a"), hz.first { it.level == "high" }.zoneIds); assertEquals(25.0, hz.first { it.level == "high" }.areaM2)
        assertEquals(listOf("d"), hz.first { it.level == "medium" }.zoneIds)
        assertEquals(0.425, hz.first { it.level == "low" }.avgKc, 0.01)
        assertEquals("medium", Watering.zoneProfile(Zone("x", "lawn"), lookup)!!.level)
        assertNull(Watering.zoneProfile(Zone("x", "pond"), lookup))
    }

    @Test fun waterNeedTest() {
        val g = garden()
        assertEquals(4 * 0.9 * 25, Watering.waterNeed(g.zones[0], g, LocalDate.of(2026, 6, 10), lookup, 4.0), 1e-5)
        assertEquals(0.0, Watering.waterNeed(g.zones[2], g, LocalDate.of(2026, 6, 10), lookup))
    }

    @Test fun beauTemps() {
        val p = plan(forecast())
        assertFalse(p.withoutWeather)
        assertTrue(p.notifications.isNotEmpty())
        val days = p.notifications.map { dayOf(it) }
        assertEquals(days.size, days.toSet().size)
        assertEquals(p.notifications.size, p.notifications.map { it.id }.toSet().size)
        val aDays = p.notifications.filter { "a" in it.zoneIds }.map { Instant.parse(it.at).toEpochMilli() }
        for (i in 1 until aDays.size) assertTrue(aDays[i] - aDays[i - 1] > 36 * 3600e3)
        val n0 = p.notifications[0]
        assertEquals("Arrosage du jour", n0.title)
        assertTrue(Regex("Arroser .* ce soir \\(≈ \\d+ L\\)").containsMatchIn(n0.body))
        assertEquals(19, Instant.parse(n0.at).atZone(paris).hour)
    }

    @Test fun pluieLeJourMeme() {
        val base = plan(forecast())
        val firstDay = dayOf(base.notifications[0])
        val rainy = plan(forecast(over = mapOf(firstDay to { d: WeatherDay -> d.copy(precipMm = 6.0) })))
        assertFalse(firstDay in rainy.notifications.map { dayOf(it) })
    }

    @Test fun pluieLeLendemain() {
        val d = dayOf(plan(forecast()).notifications[0])
        val next = LocalDate.parse(d).plusDays(1).toString()
        val p = plan(forecast(over = mapOf(next to { x: WeatherDay -> x.copy(precipMm = 8.0) })))
        assertFalse(d in p.notifications.map { dayOf(it) })
        assertTrue(p.skipped.any { it.date == d && it.reason.contains("24 h") })
    }

    @Test fun pluieEfficace() {
        val dry = plan(forecast(n = 4, from = 8)); val wet = plan(forecast(all = { it.copy(precipMm = 4.0) }, n = 4, from = 8))
        assertTrue(wet.summary.sumOf { it.litersPerWeek } < dry.summary.sumOf { it.litersPerWeek })
    }

    @Test fun gel() {
        val f = forecast(over = mapOf("2026-06-13" to { d: WeatherDay -> d.copy(tminC = 1.0) }))
        val n = plan(f).notifications.firstOrNull { "frost" in it.kinds }
        assertNotNull(n)
        assertEquals("2026-06-12", dayOf(n))
        assertTrue(n.body.contains("Olivier"))
        val g = garden().let { it.copy(zones = it.zones.mapIndexed { i, z -> if (i == 1) z.copy(plantings = listOf(Planting("lav", count = 1))) else z }) }
        assertFalse(plan(f, g = g).notifications.any { "frost" in it.kinds })
        assertFalse(plan(f, s = settings.copy(frost = false)).notifications.any { "frost" in it.kinds })
    }

    @Test fun canicule() {
        val p = plan(forecast(all = { it.copy(tmaxC = 37.0) }))
        assertTrue(p.notifications.any { "heat" in it.kinds })
        val w = p.notifications.filter { "water" in it.kinds }.map { LocalDate.parse(dayOf(it)) }
        assertTrue(w.withIndex().any { (i, d) -> i > 0 && d.toEpochDay() - w[i - 1].toEpochDay() <= 1 })
    }

    @Test fun vacancesEtDesactive() {
        val v = plan(forecast(), s = settings.copy(vacationUntil = "2026-06-14"))
        assertTrue(v.notifications.all { dayOf(it) > "2026-06-14" })
        assertTrue(v.skipped.any { it.reason == "Mode vacances" })
        val off = plan(forecast(), s = settings.copy(enabled = false))
        assertEquals(emptyList(), off.notifications); assertEquals(3, off.summary.size)
    }

    @Test fun faitEtHeurePassee() {
        val tard = LocalDateTime.of(2026, 6, 10, 21, 0).atZone(paris).toInstant()
        val late = plan(forecast(), at = tard)
        assertTrue(late.notifications.all { dayOf(it) != "2026-06-10" })
        val done = plan(forecast(), WateringState(lastWatered = mapOf("a" to "2026-06-10", "b" to "2026-06-10", "d" to "2026-06-10")))
        assertTrue(Instant.parse(done.notifications[0].at) > Instant.parse(plan(forecast()).notifications[0].at))
    }

    @Test fun resumeSemaine() {
        val a = plan(forecast()).summary.first { it.zoneId == "a" }
        assertTrue(a.litersPerWeek in 601..899)
    }

    @Test fun replisCalendaire() {
        val p = plan(null)
        assertTrue(p.withoutWeather); assertTrue(p.notifications.isNotEmpty())
        assertTrue(p.notifications.all { it.body.contains("estimation sans météo") })
        assertEquals(3, p.summary.size)
    }

    @Test fun planningMensuel() {
        val s = Watering.monthlySchedule(garden(), lookup, 2026)
        assertEquals(12, s.size)
        fun a(m: Int) = s[m - 1].zones.first { it.zoneId == "a" }
        assertEquals(0, a(1).litersPerWeek); assertTrue(a(7).litersPerWeek > 200); assertTrue(a(7).intervalDays in 1..7)
    }

    // ── golden ──
    private fun fc(e: JsonElement): Forecast? {
        if (e is JsonNull) return null
        return Forecast(e.jsonObject["daily"]!!.jsonArray.map { d -> val o = d.jsonObject
            fun n(k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.double
            WeatherDay(o["date"]!!.jsonPrimitive.content, n("precipMm"), n("et0Mm"), n("tminC"), n("tmaxC")) })
    }
    private fun st(o: JsonObject) = WateringState(
        (o["lastWatered"] as? JsonObject)?.mapValues { it.value.jsonPrimitive.content } ?: emptyMap(),
        (o["snoozeUntil"] as? JsonPrimitive)?.contentOrNull)
    private fun ns(o: JsonObject): NotifSettings {
        val n = (o["notifications"] as? JsonObject) ?: o
        val d = NotifSettings()
        return NotifSettings(
            n["hour"]?.jsonPrimitive?.int ?: d.hour, n["minute"]?.jsonPrimitive?.int ?: d.minute, n["enabled"]?.jsonPrimitive?.boolean ?: d.enabled,
            (n["vacationUntil"] as? JsonPrimitive)?.contentOrNull, n["frost"]?.jsonPrimitive?.boolean ?: d.frost, n["heat"]?.jsonPrimitive?.boolean ?: d.heat)
    }
    private fun strs(l: List<String>) = JsonArray(l.map { JsonPrimitive(it) })
    private fun planJson(p: WateringPlan) = buildJsonObject {
        put("notifications", JsonArray(p.notifications.map { n -> buildJsonObject {
            put("id", n.id); put("at", n.at); put("title", n.title); put("body", n.body); put("zoneIds", strs(n.zoneIds)); put("kinds", strs(n.kinds)) } }))
        put("summary", JsonArray(p.summary.map { s -> buildJsonObject { put("zoneId", s.zoneId); put("litersPerWeek", s.litersPerWeek) } }))
        put("skipped", JsonArray(p.skipped.map { s -> buildJsonObject { put("date", s.date); put("reason", s.reason) } }))
        put("withoutWeather", p.withoutWeather)
    }

    @Test fun golden() {
        val gj = goldenJson("watering")
        val gardens = goldenGardens(gj); val lk = goldenLookup(gj)
        val forecasts = gj["forecasts"]!!.jsonObject.mapValues { fc(it.value) }
        val states = gj["states"]!!.jsonObject.mapValues { st(it.value.jsonObject) }
        val settingsMap = gj["settings"]!!.jsonObject.mapValues { ns(it.value.jsonObject) }
        val nows = gj["nows"]!!.jsonObject.mapValues { Instant.parse(it.value.jsonPrimitive.content) }
        var n = 0
        for (e in gj["plans"]!!.jsonArray) {
            val o = e.jsonObject
            val key = "g${o["g"]} f=${o["f"]!!.jsonPrimitive.content} s=${o["s"]!!.jsonPrimitive.content} set=${o["set"]!!.jsonPrimitive.content} now=${o["now"]!!.jsonPrimitive.content}"
            val p = Watering.planWatering(gardens[o["g"]!!.jsonPrimitive.int], forecasts[o["f"]!!.jsonPrimitive.content],
                states.getValue(o["s"]!!.jsonPrimitive.content), nows.getValue(o["now"]!!.jsonPrimitive.content), settingsMap.getValue(o["set"]!!.jsonPrimitive.content), lk, paris)
            assertSame2(o["plan"], planJson(p), key); n++
        }
        assertTrue(n > 100)
        gardens.forEachIndexed { gi, ga ->
            ga.zones.forEachIndexed { zi, z ->
                val pr = Watering.zoneProfile(z, lk); val ep = gj["profiles"]!!.jsonArray[gi].jsonArray[zi]
                if (ep is JsonNull) assertNull(pr, "profile $gi/$zi") else { assertEquals(ep.jsonObject["level"]!!.jsonPrimitive.content, pr!!.level); assertEquals(ep.jsonObject["kc"]!!.jsonPrimitive.double, pr.kc, 1e-9) }
                val needs = gj["needs"]!!.jsonArray[gi].jsonArray[zi].jsonArray.map { it.jsonPrimitive.double }
                val got = listOf("2026-01-10", "2026-06-10", "2026-07-20", "2026-12-31").flatMap { d -> val ld = LocalDate.parse(d); listOf(Watering.waterNeed(z, ga, ld, lk), Watering.waterNeed(z, ga, ld, lk, 4.0)) }
                needs.forEachIndexed { k, v -> assertEquals(v, got[k], 1e-6, "need $gi/$zi/$k") }
            }
            assertSame2(gj["hydro"]!!.jsonArray[gi], JsonArray(Watering.hydrozones(ga, lk).map { h -> buildJsonObject { put("id", h.id); put("level", h.level); put("zoneIds", strs(h.zoneIds)); put("areaM2", h.areaM2); put("avgKc", h.avgKc) } }), "hydro $gi")
            assertSame2(gj["monthly"]!!.jsonArray[gi], JsonArray(Watering.monthlySchedule(ga, lk, 2026).map { m -> buildJsonObject {
                put("month", m.month)
                put("zones", JsonArray(m.zones.map { z -> buildJsonObject { put("zoneId", z.zoneId); put("label", z.label); put("level", z.level); put("intervalDays", z.intervalDays); put("timesPerWeek", z.timesPerWeek); put("litersPerWatering", z.litersPerWatering); put("litersPerWeek", z.litersPerWeek) } }))
            } }), "monthly $gi")
        }
    }
}
