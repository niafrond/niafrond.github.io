package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class MaintenanceTest {
    private fun by(id: String) = getPlant(id)!!

    @Test fun niveaux() {
        assertEquals(listOf("green", "low", "none"), Maintenance.MAINTENANCE_LEVELS.map { it.id })
        for (l in Maintenance.MAINTENANCE_LEVELS) assertTrue(l.label.isNotEmpty() && l.emoji.isNotEmpty() && l.desc.isNotEmpty())
        assertEquals("Pas d’entretien", Maintenance.getMaintenanceLevel("none")!!.label)
        assertNull(Maintenance.getMaintenanceLevel("x"))
    }

    @Test fun effortGazonPotagerHaies() {
        for (id in listOf("h-gazon-rustique", "h-tomate", "h-laitue", "thuya", "laurier-palme", "charmille")) assertTrue(Maintenance.plantEffort(by(id)) >= 2, id)
        assertEquals(3, Maintenance.plantEffort(by("h-gazon-rustique")))
        assertEquals(3, Maintenance.plantEffort(by("h-tomate")))
        assertEquals(3, Maintenance.plantEffort(by("thuya")))
    }

    @Test fun effortLeger() {
        for (id in listOf("h-miscanthus", "h-stipa-tenuissima", "h-pervenche", "h-bugle", "viorne-tin", "aucuba", "laurier-sauce")) assertEquals(1, Maintenance.plantEffort(by(id)), id)
    }

    @Test fun effortBorne() {
        assertEquals(3, Maintenance.plantEffort(Plant("a", maintenance = "high", water = "high", category = "fruit")))
        assertEquals(1, Maintenance.plantEffort(Plant("a", maintenance = "low", category = "grass")))
        assertEquals(2, Maintenance.plantEffort(Plant("a")))
        assertEquals(2, Maintenance.plantEffort(Plant("a", maintenance = "low", care = PlantCare(pruneMonths = listOf(1, 2, 3)))))
        assertEquals(1, Maintenance.plantEffort(Plant("a", maintenance = "medium", windTolerant = true, water = "low")))
        assertEquals(2, Maintenance.plantEffort(null))
        assertTrue(allPlants().all { Maintenance.plantEffort(it) in 1..3 })
    }

    @Test fun distribution() {
        val n = { e: Int -> allPlants().count { Maintenance.plantEffort(it) == e } }
        assertTrue(n(1) >= 40)
        assertTrue(n(2) > 10)
        assertTrue(n(3) > 10)
    }

    @Test fun libelles() {
        assertEquals(listOf("léger", "moyen", "soutenu"), listOf(1, 2, 3).map { Maintenance.effortLabel(it) })
        assertEquals("🧤×2", Maintenance.effortBadge(2))
    }

    @Test fun levelForZone() {
        assertEquals("none", Maintenance.levelForZone("low", "none"))
        assertEquals("low", Maintenance.levelForZone("low", null))
        assertEquals("green", Maintenance.levelForZone(null as String?, null as String?))
        assertEquals("green", Maintenance.levelForZone("zzz", "yyy"))
        val g = Garden(id = "g", context = GardenContext(maintenance = "low"))
        assertEquals("low", Maintenance.levelForZone(g, null as Zone?))
        assertEquals("green", Maintenance.levelForZone(null as Garden?, null as Zone?))
    }

    @Test fun fits() {
        for (p in allPlants()) assertEquals(MaintenanceFit(true, 0, 0, false, ""), Maintenance.fitsMaintenance(p, "green"))
        assertTrue(Maintenance.fitsMaintenance(by("h-tomate"), null).ok)
        assertTrue(Maintenance.fitsMaintenance(by("h-miscanthus"), "low").ok)
        val r = Maintenance.fitsMaintenance(by("h-tomate"), "low")
        assertFalse(r.ok); assertEquals(25, r.penalty)
        assertEquals("Demande pas mal d’entretien : déconseillée si vous voulez peu d’entretien", r.text)
        val ok = Maintenance.fitsMaintenance(by("h-miscanthus"), "none")
        assertEquals(MaintenanceFit(true, 0, 10, false, "Très peu d’entretien : on plante et on oublie"), ok)
        val two = allPlants().first { Maintenance.plantEffort(it) == 2 }
        val f2 = Maintenance.fitsMaintenance(two, "none")
        assertFalse(f2.ok); assertEquals(30, f2.penalty); assertFalse(f2.discouraged)
        assertTrue(Maintenance.fitsMaintenance(by("h-tomate"), "none").discouraged)
    }

    @Test fun golden() {
        val g = goldenJson("maintenance")
        val dec = Json { ignoreUnknownKeys = true; coerceInputValues = true }
        val synth = g["synth"]!!.jsonArray.mapIndexed { i, e -> dec.decodeFromJsonElement(Plant.serializer(), JsonObject(e.jsonObject + ("id" to JsonPrimitive("s$i")))) }
        val all = allPlants() + synth
        val levels = listOf("green", "low", "none", null, "zzz")
        val effort = g["effort"]!!.jsonArray
        val fits = g["fits"]!!.jsonArray
        assertEquals(effort.size, all.size)
        all.forEachIndexed { i, p ->
            assertEquals(effort[i].jsonPrimitive.int, Maintenance.plantEffort(p), p.id)
            levels.forEachIndexed { j, l ->
                val o = fits[i].jsonArray[j].jsonObject
                val f = Maintenance.fitsMaintenance(p, l)
                assertEquals(o["ok"]!!.jsonPrimitive.boolean, f.ok, "${p.id}/$l")
                assertEquals(o["penalty"]!!.jsonPrimitive.int, f.penalty)
                assertEquals(o["bonus"]!!.jsonPrimitive.int, f.bonus)
                assertEquals(o["discouraged"]!!.jsonPrimitive.boolean, f.discouraged)
                assertEquals(o["text"]!!.jsonPrimitive.content, f.text)
            }
        }
        assertEquals(g["nullEffort"]!!.jsonPrimitive.int, Maintenance.plantEffort(null))
        for (e in g["levels"]!!.jsonArray) {
            val o = e.jsonObject
            val l = Maintenance.getMaintenanceLevel(o["id"]!!.jsonPrimitive.content)!!
            assertEquals(o["label"]!!.jsonPrimitive.content, l.label); assertEquals(o["emoji"]!!.jsonPrimitive.content, l.emoji); assertEquals(o["desc"]!!.jsonPrimitive.content, l.desc)
        }
        for (e in g["labels"]!!.jsonArray) {
            val o = e.jsonObject
            val raw = o["e"]
            val d: Double? = when {
                raw == null || raw is JsonNull -> null
                raw.jsonPrimitive.content == "NaN" -> Double.NaN
                else -> raw.jsonPrimitive.double
            }
            assertEquals(o["label"]!!.jsonPrimitive.content, Maintenance.effortLabel(d), "$o")
            assertEquals(o["badge"]!!.jsonPrimitive.content, Maintenance.effortBadge(d), "$o")
        }
        for (e in g["zones"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["r"]!!.jsonPrimitive.content, Maintenance.levelForZone(o["g"]!!.jsonPrimitive.contentOrNull, o["z"]!!.jsonPrimitive.contentOrNull), "$o")
        }
    }
}
