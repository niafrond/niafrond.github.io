package fr.jardin.core

import fr.jardin.core.Pricing.bloomRangeText
import fr.jardin.core.Pricing.formatEuro
import fr.jardin.core.Pricing.formatPrice
import fr.jardin.core.Pricing.gardenCost
import fr.jardin.core.Pricing.plantCost
import fr.jardin.core.Pricing.summarizeGarden
import fr.jardin.core.Pricing.zoneCost
import kotlinx.serialization.json.*
import kotlin.test.*

class PricingTest {
    private fun sq(w: Double, h: Double) = PolygonShape(listOf(Point(0.0, 0.0), Point(w, 0.0), Point(w, h), Point(0.0, h)))
    private val P = mapOf(
        "rose" to Plant("rose", priceEur = 12.5, priceUnit = "plant", priceNote = "pot 3 L", bloom = listOf(5, 6, 7)),
        "tulipe" to Plant("tulipe", priceEur = 0.4, priceUnit = "bulb", bloom = listOf(4)),
        "gazon" to Plant("gazon", priceEur = 0.5, priceUnit = "m2"),
        "inconnue" to Plant("inconnue", priceEur = null, bloom = listOf(9)),
    )
    private fun zone(id: String, shape: Shape?, plantings: List<Planting> = emptyList(), label: String = id) = Zone(id = id, type = "other", label = label, shape = shape, plantings = plantings)

    @Test fun plantEtBulbe() {
        assertEquals(Pricing.PlantCost(4.0, "plant", 12.5, 50.0), plantCost(P["rose"], Planting("rose", count = 4), zone("z", sq(2.0, 2.0))))
        assertEquals(Pricing.PlantCost(25.0, "bulb", 0.4, 10.0), plantCost(P["tulipe"], Planting("tulipe", count = 25), zone("z", sq(2.0, 2.0))))
    }

    @Test fun m2() {
        assertEquals(Pricing.PlantCost(40.0, "m2", 0.5, 20.0), plantCost(P["gazon"], Planting("gazon", count = 1), zone("z", sq(10.0, 4.0))))
    }

    @Test fun quantiteInvalideEtSansPrix() {
        assertEquals(1.0, plantCost(P["rose"], Planting("rose", count = 0), zone("z", sq(1.0, 1.0)))!!.qty)
        assertNull(plantCost(P["inconnue"], Planting("inconnue", count = 2), zone("z", sq(1.0, 1.0))))
        assertNull(plantCost(null, null, null))
    }

    @Test fun arrondiCentime() {
        assertEquals(0.3, plantCost(Plant("x", priceEur = 0.1, priceUnit = "plant"), Planting("x", count = 3), null)!!.total)
    }

    private val garden = Garden(id = "g", zones = listOf(
        zone("a", sq(10.0, 4.0), listOf(Planting("rose", count = 2), Planting("inconnue", count = 3), Planting("absente", count = 1)), "Massif"),
        zone("b", sq(5.0, 2.0), listOf(Planting("gazon", count = 1), Planting("tulipe", count = 10)), "Pelouse"),
        zone("c", sq(1.0, 1.0), emptyList()),
    ))

    @Test fun zoneEtJardin() {
        val z = zoneCost(garden.zones[0], P.asLookup())
        assertEquals(25.0, z.total); assertEquals(2, z.unknownCount); assertEquals(1, z.lines.size); assertEquals("Massif", z.label)
        val g = gardenCost(garden, P.asLookup())
        assertEquals(25.0 + 5.0 + 4.0, g.total); assertEquals(2, g.unknownCount)
        assertEquals(listOf("a" to 25.0, "b" to 9.0, "c" to 0.0), g.byZone.map { it.zoneId to it.total })
        assertEquals(34.0, gardenCost(garden) { P[it] }.total)
        assertEquals(Pricing.GardenCost(0.0, emptyList(), 0), gardenCost(Garden(id = "e"), P.asLookup()))
    }

    @Test fun formats() {
        assertEquals("12,50 €", formatEuro(12.5))
        assertEquals("0,00 €", formatEuro(0.0))
        assertEquals("1,01 €", formatEuro(1.005))
        assertEquals("1 234,57 €", formatEuro(1234.567))
        assertEquals("340 €", formatEuro(339.6, 0))
        assertEquals("0,00 €", formatEuro(Double.NaN))
        assertEquals("12 €", formatPrice(12.0))
        assertEquals("0,5 €", formatPrice(0.5))
        assertEquals("6,75 €", formatPrice(6.75))
    }

    @Test fun resume() {
        val g = Garden(id = "g", zones = listOf(zone("a", sq(2.0, 2.0), listOf(Planting("rose", count = 2), Planting("tulipe", count = 5))), zone("b", sq(2.0, 2.0), listOf(Planting("rose", count = 1)))))
        val s = summarizeGarden(g, P.asLookup())
        assertEquals(2, s.species)
        assertEquals("2 essences, floraison de avril à juillet, ≈ 40 €", s.text)
        assertEquals("floraison en mars", bloomRangeText(listOf(3)))
        assertEquals("", bloomRangeText(emptyList()))
        assertEquals("0 essence, ≈ 0 €", summarizeGarden(Garden(id = "e"), P.asLookup()).text)
    }

    private fun costJson(c: Pricing.GardenCost) = buildJsonObject {
        put("total", c.total); put("unknownCount", c.unknownCount)
        put("byZone", JsonArray(c.byZone.map { z -> buildJsonObject {
            put("zoneId", z.zoneId); put("label", z.label); put("total", z.total); put("unknownCount", z.unknownCount)
            put("lines", JsonArray(z.lines.map { l -> buildJsonObject { put("plantId", l.plantId); put("qty", l.qty); put("unit", l.unit); put("unitPrice", l.unitPrice); put("total", l.total) } }))
        } }))
    }

    @Test fun golden() {
        val g = goldenJson("pricing")
        val gardens = goldenGardens(g); val lookup = goldenLookup(g)
        gardens.forEachIndexed { i, ga ->
            assertSame2(g["costs"]!!.jsonArray[i], costJson(gardenCost(ga, lookup)), "costs[$i]")
            val s = summarizeGarden(ga, lookup); val es = g["summaries"]!!.jsonArray[i].jsonObject
            assertEquals(es["species"]!!.jsonPrimitive.int, s.species); assertEquals(es["text"]!!.jsonPrimitive.content, s.text)
            assertEquals(es["unknownCount"]!!.jsonPrimitive.int, s.unknownCount)
            assertEquals(es["total"]!!.jsonPrimitive.double, s.total, 1e-6)
        }
        val zone = gardens[1].zones[0]
        val plantings = listOf(Planting("p", count = 1), Planting("p", count = 0), Planting("p", count = 3), Planting("p", quantity = 7), Planting("p"), Planting("p", count = 2, quantity = 9))
        for (e in g["plantCosts"]!!.jsonArray) {
            val id = e.jsonObject["id"]!!.jsonPrimitive.content; val p = lookup(id)
            e.jsonObject["r"]!!.jsonArray.forEachIndexed { k, r ->
                val c = plantCost(p, plantings[k], zone)
                if (r is JsonNull) assertNull(c, "$id/$k") else {
                    val o = r.jsonObject
                    assertNotNull(c, "$id/$k")
                    assertEquals(o["unit"]!!.jsonPrimitive.content, c.unit, "$id/$k"); assertEquals(o["qty"]!!.jsonPrimitive.double, c.qty, 1e-6, "$id/$k")
                    assertEquals(o["unitPrice"]!!.jsonPrimitive.double, c.unitPrice, 1e-9); assertEquals(o["total"]!!.jsonPrimitive.double, c.total, 1e-6, "$id/$k")
                }
            }
        }
        for (e in g["euros"]!!.jsonArray) {
            val o = e.jsonObject; val n = o["n"]!!.jsonPrimitive.double
            assertEquals(o["d2"]!!.jsonPrimitive.content, formatEuro(n), "d2 $n")
            assertEquals(o["d0"]!!.jsonPrimitive.content, formatEuro(n, 0), "d0 $n")
            assertEquals(o["d1"]!!.jsonPrimitive.content, formatEuro(n, 1), "d1 $n")
            assertEquals(o["d3"]!!.jsonPrimitive.content, formatEuro(n, 3), "d3 $n")
            assertEquals(o["price"]!!.jsonPrimitive.content, formatPrice(n), "price $n")
        }
        for (e in g["blooms"]!!.jsonArray) assertEquals(e.jsonObject["t"]!!.jsonPrimitive.content, bloomRangeText(e.jsonObject["m"]!!.jsonArray.map { it.jsonPrimitive.int }))
    }
}
