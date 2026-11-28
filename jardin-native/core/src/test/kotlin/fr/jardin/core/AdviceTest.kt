package fr.jardin.core

import fr.jardin.core.Advice.buildAdvice
import fr.jardin.core.Advice.calendar
import fr.jardin.core.Advice.frostProtection
import fr.jardin.core.Advice.genericCare
import fr.jardin.core.Advice.tasksForMonth
import kotlinx.serialization.json.*
import kotlin.test.*

class AdviceTest {
    private fun sq(s: Double) = PolygonShape(listOf(Point(0.0, 0.0), Point(s, 0.0), Point(s, s), Point(0.0, s)))
    private val plants = listOf(
        Plant("tree", commonName = "Érable", category = "tree", water = "low", hardiness = -25.0, care = PlantCare(listOf(11), listOf(2), listOf(3), "Planter en novembre.", "Tailler en février.", "Compost.", "Peu.", "RAS")),
        Plant("shrub", commonName = "Laurier", category = "shrub", water = "medium", hardiness = -3.0),
        Plant("gc", commonName = "Lierre", category = "groundcover", water = "low", hardiness = -20.0, care = PlantCare(planting = "")),
        Plant("tom", commonName = "Tomate", category = "vegetable", water = "high", hardiness = 2.0, harvest = listOf(8, 9)),
        Plant("per", commonName = "Sauge", category = "perennial", water = "low", hardiness = -10.0),
    ).associateBy { it.id }
    private val lookup: PlantById = { plants[it] }
    private fun garden() = Garden(id = "g", context = GardenContext(roofArea = 40.0), zones = listOf(
        Zone("z1", "lawn", "Pelouse", sq(5.0)),
        Zone("z2", "trees", "Bosquet", sq(5.0), listOf(Planting("tree", count = 1), Planting("shrub", count = 2))),
        Zone("z3", "lowplants", "Sous-bois", sq(3.0), listOf(Planting("gc", count = 5), Planting("unknown", count = 1))),
        Zone("z4", "vegetable", "Potager", sq(3.0), listOf(Planting("tom", count = 4), Planting("per", count = 1))),
        Zone("z5", "terrace", "Terrasse", sq(3.0)),
    ))

    @Test fun genericCareToutesCategories() {
        for (c in PLANT_CATEGORIES) {
            val g = genericCare(c)
            for (t in listOf(g.planting, g.pruning, g.fertilizer, g.watering, g.notes)) assertTrue(t.length > 10, c)
        }
        assertEquals(genericCare("shrub").planting, genericCare("inconnu").planting)
    }

    @Test fun ficheCompletePrioritaire() {
        val a = buildAdvice(garden(), lookup)
        assertEquals(5, a.zones.size)
        val z2 = a.zones.first { it.zoneId == "z2" }
        assertEquals("Planter en novembre.", z2.plants.first { it.plant.id == "tree" }.planting)
        assertEquals(genericCare("shrub").pruning, z2.plants.first { it.plant.id == "shrub" }.pruning)
        val z3 = a.zones.first { it.zoneId == "z3" }
        assertEquals(1, z3.plants.size)
        assertEquals(genericCare("groundcover").planting, z3.plants[0].planting)
        assertTrue(a.zones.first { it.zoneId == "z1" }.tips[0].contains("Tondre"))
    }

    @Test fun ordreDeChantier() {
        val o = buildAdvice(garden(), lookup).plantingOrder
        val labels = listOf("Gros œuvre", "Arbres", "Arbustes", "Vivaces", "Couvre-sols", "Gazon")
        assertEquals(6, o.size)
        labels.forEachIndexed { i, l -> assertTrue(o[i].contains(l)) }
        assertTrue(o[0].startsWith("1."))
        val g = garden().copy(zones = garden().zones.filter { it.id == "z2" })
        assertEquals(listOf("1. Arbres", "2. Arbustes"), buildAdvice(g, lookup).plantingOrder.map { it.split(" : ")[0] })
    }

    @Test fun conseilsGeneraux() {
        val a = buildAdvice(garden(), lookup)
        assertTrue(a.general.rainwater.contains("40 m²"))
        assertTrue(a.general.disclaimer.contains("ordres de grandeur"))
    }

    @Test fun calendrier() {
        val c = calendar(garden(), lookup)
        assertEquals(12, c.size)
        assertEquals((1..12).toList(), c.map { it.month })
        assertTrue(c[10].tasks.any { it.kind == "plant" && it.plantId == "tree" })
        assertTrue(c[1].tasks.any { it.kind == "prune" && it.plantId == "tree" })
        assertTrue(c[7].tasks.any { it.kind == "harvest" && it.plantId == "tom" })
        assertTrue(c[0].tasks.any { it.kind == "protect" && it.plantId == "shrub" })
        assertFalse(c[0].tasks.any { it.kind == "protect" && it.plantId == "tree" })
        assertTrue(c[6].tasks.any { it.kind == "water" })
        assertTrue(c[5].tasks.any { it.text.startsWith("Tondre") })
        for (t in c.flatMap { it.tasks }) assertTrue(t.kind in listOf("plant", "prune", "fertilize", "water", "harvest", "protect"))
    }

    @Test fun tasksForMonthTest() {
        assertTrue(tasksForMonth(garden(), 8, lookup).any { it.kind == "harvest" })
        assertEquals(calendar(garden(), lookup)[0].tasks, tasksForMonth(garden(), 13, lookup))
    }

    @Test fun gel() {
        val r = frostProtection(garden(), -4.0, lookup)
        assertEquals(listOf("shrub", "tom"), r.map { it.plantId }.sorted())
        assertTrue(r[0].text.contains("-4 °C"))
        assertEquals(emptyList(), frostProtection(garden(), 5.0, lookup))
    }

    // ── golden ──
    private fun ints(l: List<Int>) = JsonArray(l.map { JsonPrimitive(it) })
    private fun strs(l: List<String>) = JsonArray(l.map { JsonPrimitive(it) })
    private fun existingJson(a: Advice.ExistingAdvice) = buildJsonObject {
        put("month", a.month)
        put("toRemove", JsonArray(a.toRemove.map { r -> buildJsonObject { put("id", r.id); put("label", r.label); put("kind", r.kind); put("tip", r.tip) } }))
        put("entries", JsonArray(a.entries.map { e -> buildJsonObject {
            put("id", e.id); put("kind", e.kind); put("label", e.label); put("plantId", e.plant?.id); put("keep", e.keep); put("now", strs(e.now))
            put("pruning", e.pruning); put("fertilizer", e.fertilizer); put("watering", e.watering); put("notes", e.notes)
            put("pruneMonths", ints(e.pruneMonths)); put("fertMonths", ints(e.fertMonths)); put("known", e.known); put("tips", strs(e.tips)); put("userNotes", e.userNotes)
        } }))
    }
    private fun careJson(g: GenericCare) = buildJsonObject {
        put("plantMonths", ints(g.plantMonths)); put("pruneMonths", ints(g.pruneMonths)); put("fertMonths", ints(g.fertMonths))
        put("planting", g.planting); put("pruning", g.pruning); put("fertilizer", g.fertilizer); put("watering", g.watering); put("notes", g.notes)
    }
    private fun taskJson(t: Advice.CalendarTask) = buildJsonObject { put("kind", t.kind); put("zoneId", t.zoneId); if (t.plantId != null) put("plantId", t.plantId); put("text", t.text) }

    @Test fun golden() {
        val gj = goldenJson("advice")
        val gardens = goldenGardens(gj); val lk = goldenLookup(gj)
        gardens.forEachIndexed { i, ga ->
            val a = buildAdvice(ga, lk, 6)
            assertSame2(gj["advice"]!!.jsonArray[i], buildJsonObject {
                put("zones", JsonArray(a.zones.map { z -> buildJsonObject {
                    put("zoneId", z.zoneId); put("zoneLabel", z.zoneLabel); put("type", z.type); put("tips", strs(z.tips))
                    put("plants", JsonArray(z.plants.map { p -> buildJsonObject { put("plantId", p.plant.id); put("count", p.count); put("planting", p.planting); put("pruning", p.pruning); put("fertilizer", p.fertilizer); put("watering", p.watering); put("notes", p.notes) } }))
                } }))
                put("plantingOrder", strs(a.plantingOrder))
                put("general", buildJsonObject { put("disclaimer", a.general.disclaimer); put("mulch", a.general.mulch); put("water", a.general.water); put("rainwater", a.general.rainwater); put("emptyHint", a.general.emptyHint) })
            }, "advice[$i]")
            assertSame2(gj["calendars"]!!.jsonArray[i], JsonArray(calendar(ga, lk).map { m -> buildJsonObject { put("month", m.month); put("tasks", JsonArray(m.tasks.map { taskJson(it) })) } }), "calendar[$i]")
            assertSame2(gj["tasks"]!!.jsonArray[i], JsonArray(listOf(0, 1, 7, 12, 13, -1).map { m -> JsonArray(tasksForMonth(ga, m, lk).map { taskJson(it) }) }), "tasks[$i]")
            assertSame2(gj["frost"]!!.jsonArray[i], JsonArray(listOf(-15.0, -5.0, -1.0, 0.0, 2.0, 5.0).map { t -> JsonArray(frostProtection(ga, t, lk).map { f -> buildJsonObject { put("zoneId", f.zoneId); put("plantId", f.plantId); put("text", f.text) } }) }), "frost[$i]")
            assertSame2(gj["existing"]!!.jsonArray[i], JsonArray((1..12).map { m -> existingJson(Advice.existingAdvice(ga, lk, m)) }), "existing[$i]")
        }
        for (e in gj["generic"]!!.jsonArray) assertSame2(e.jsonObject["g"], careJson(genericCare(e.jsonObject["c"]!!.jsonPrimitive.contentOrNull)), "generic ${e.jsonObject["c"]}")
    }
}
