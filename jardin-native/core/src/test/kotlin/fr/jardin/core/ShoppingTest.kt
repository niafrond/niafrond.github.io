package fr.jardin.core

import fr.jardin.core.Shopping.itemsToBuy
import fr.jardin.core.Shopping.monthsText
import fr.jardin.core.Shopping.periodOf
import fr.jardin.core.Shopping.shoppingByPeriod
import fr.jardin.core.Shopping.shoppingList
import fr.jardin.core.Shopping.suppliesList
import kotlinx.serialization.json.*
import kotlin.math.ceil
import kotlin.math.round
import kotlin.test.*

class ShoppingTest {
    private fun r(x: Double, y: Double, w: Double, h: Double) = PolygonShape(listOf(Point(x, y), Point(x + w, y), Point(x + w, y + h), Point(x, y + h)))
    private fun by(c: String) = allPlants().filter { it.category == c && it.priceEur != null }

    private fun jardin(): Garden {
        val m = createZone("midplants", r(0.0, 0.0, 6.0, 3.0)).copy(label = "Massif", plantings = listOf(
            Planting(by("perennial")[0].id, count = 5), Planting(by("shrub")[0].id, count = 2), Planting(by("climber")[0].id, count = 1)))
        val t = createZone("trees", CircleShape(Point(9.0, 5.0), 1.5)).copy(label = "Arbres", plantings = listOf(
            Planting(by("tree")[0].id, count = 2), Planting(by("perennial")[0].id, count = 3)))
        val l = createZone("lawn", r(0.0, 3.0, 6.0, 5.0)).copy(plantings = listOf(Planting(by("lawn")[0].id, count = 1)))
        return createGarden("Courses").copy(boundary = r(0.0, 0.0, 12.0, 8.0).points, boundaryClosed = true, zones = listOf(m, t, l),
            items = listOf(createItem("bench", 3.0, 3.0), createItem("pergola", 8.0, 2.0)))
    }
    private val g = jardin()
    private fun c2(x: Double) = round(x * 100) / 100

    @Test fun regroupementEtTotal() {
        val s = shoppingList(g)
        assertEquals(listOf("trees", "shrubs", "climbers", "perennials", "lawn"), s.groups.map { it.id })
        for (grp in s.groups) {
            assertEquals(grp.lines.size, grp.formats.flatMap { it.lines }.size)
            assertEquals(grp.subtotal, c2(grp.lines.sumOf { it.total }))
        }
        assertEquals(Pricing.gardenCost(g) { getPlant(it) }.total, s.total, 0.01)
        val viv = s.groups.first { it.id == "perennials" }.lines.first { it.plantId == by("perennial")[0].id }
        assertEquals(8.0, viv.qty)
        assertEquals(2, viv.zoneIds.size)
        val lawn = s.groups.first { it.id == "lawn" }.lines[0]
        assertEquals("m2", lawn.unit); assertEquals(30.0, lawn.qty, 0.1)
    }

    @Test fun parZone() {
        val s = shoppingList(g)
        assertEquals(3, s.byZone.size)
        assertEquals(s.total, c2(s.byZone.sumOf { it.total }))
    }

    @Test fun parPeriode() {
        val p = shoppingByPeriod(g)
        assertTrue(p.isNotEmpty())
        assertTrue(p.first { it.id == "sow" }.lines.any { it.line.plant.category == "lawn" })
        assertEquals(shoppingList(g).lines.size, p.flatMap { it.lines }.size)
        assertEquals("winter", periodOf(Plant("x", category = "shrub", priceNote = "racines nues", care = PlantCare(plantMonths = listOf(12, 1, 2, 11)))))
        assertEquals("autumn", periodOf(Plant("x", category = "shrub", care = PlantCare(plantMonths = listOf(10, 11)))))
        assertEquals("spring", periodOf(Plant("x", category = "perennial", care = PlantCare(plantMonths = listOf(3, 4)))))
    }

    @Test fun fournitures() {
        val s = suppliesList(g)
        val ids = s.lines.map { it.id }
        for (id in listOf("compost", "mulch", "fert", "stakes", "ties", "trellis", "water")) assertTrue(id in ids, id)
        val c = s.lines.first { it.id == "compost" }
        assertEquals(ceil(c.qty / Shopping.SUPPLY.compostBagL).toInt(), c.packs)
        assertEquals(c.packs * Shopping.SUPPLY.compostBagPrice, c.total, 0.01)
        assertEquals(2, s.lines.first { it.id == "stakes" }.packs)
        assertEquals(1, s.lines.first { it.id == "trellis" }.packs)
    }

    @Test fun amenagements() {
        val it = itemsToBuy(g)
        assertEquals(2, it.lines.size)
        assertEquals(90.0 + 900.0, it.total)
    }

    @Test fun jardinSansPlantation() {
        val e = createGarden("Vide").copy(zones = listOf(createZone("terrace", r(0.0, 0.0, 3.0, 3.0))))
        assertEquals(emptyList(), shoppingList(e).groups); assertEquals(0.0, shoppingList(e).total)
        assertEquals(emptyList(), shoppingByPeriod(e))
        assertEquals(emptyList(), suppliesList(e).lines)
        assertEquals(0.0, itemsToBuy(e).total)
    }

    @Test fun texteMois() { assertEquals("mars, oct. à nov.", monthsText(listOf(11, 10, 3))); assertEquals("", monthsText(emptyList())) }

    // ── golden ──
    private fun lineJson(l: Shopping.Line) = buildJsonObject {
        put("plantId", l.plantId); put("format", l.format); put("qty", l.qty); put("unit", l.unit); put("unitPrice", l.unitPrice)
        put("total", l.total); put("priced", l.priced); put("zoneIds", JsonArray(l.zoneIds.map { JsonPrimitive(it) })); put("plantMonths", JsonArray(l.plantMonths.map { JsonPrimitive(it) }))
    }
    private fun listJson(s: Shopping.ShoppingList) = buildJsonObject {
        put("total", s.total); put("unknownCount", s.unknownCount); put("plantCount", s.plantCount)
        put("lines", JsonArray(s.lines.map { lineJson(it) }))
        put("groups", JsonArray(s.groups.map { x -> buildJsonObject {
            put("id", x.id); put("label", x.label); put("subtotal", x.subtotal); put("lines", JsonArray(x.lines.map { lineJson(it) }))
            put("formats", JsonArray(x.formats.map { f -> buildJsonObject { put("format", f.format); put("ids", JsonArray(f.lines.map { JsonPrimitive(it.plantId) })) } }))
        } }))
        put("byZone", JsonArray(s.byZone.map { z -> buildJsonObject { put("zoneId", z.zoneId); put("label", z.label); put("n", z.n); put("total", z.total); put("lines", JsonArray(z.lines.map { lineJson(it) })) } }))
    }
    private fun suppliesJson(s: Shopping.Supplies) = buildJsonObject {
        put("lines", JsonArray(s.lines.map { l -> buildJsonObject {
            put("id", l.id); put("label", l.label); put("qty", l.qty); put("unit", l.unit); put("pack", l.pack); put("packs", l.packs)
            put("unitPrice", l.unitPrice); put("total", l.total); put("basis", l.basis) } }))
        put("total", s.total); put("bedArea", s.bedArea); put("plantedArea", s.plantedArea); put("woody", s.woody); put("trees", s.trees); put("climbers", s.climbers)
    }

    @Test fun golden() {
        val gj = goldenJson("shopping")
        val gardens = goldenGardens(gj); val lookup = goldenLookup(gj)
        gardens.forEachIndexed { i, ga ->
            assertSame2(gj["lists"]!!.jsonArray[i], listJson(shoppingList(ga, lookup)), "lists[$i]")
            val per = JsonArray(shoppingByPeriod(ga, lookup).map { p -> buildJsonObject {
                put("id", p.id); put("label", p.label); put("subtotal", p.subtotal)
                put("lines", JsonArray(p.lines.map { l -> JsonObject(lineJson(l.line) + ("best" to JsonPrimitive(l.best))) }))
            } })
            assertSame2(gj["periods"]!!.jsonArray[i], per, "periods[$i]")
            assertSame2(gj["supplies"]!!.jsonArray[i], suppliesJson(suppliesList(ga, lookup)), "supplies[$i]")
            val items = itemsToBuy(ga)
            assertSame2(gj["items"]!!.jsonArray[i], buildJsonObject {
                put("lines", JsonArray(items.lines.map { l -> buildJsonObject { put("id", l.id); put("kind", l.kind); put("label", l.label); put("category", l.category); put("dims", l.dims); put("height", l.height); put("price", l.price) } }))
                put("total", items.total)
            }, "items[$i]")
        }
        for (e in gj["monthCases"]!!.jsonArray) {
            val m = e.jsonObject["m"]
            assertEquals(e.jsonObject["t"]!!.jsonPrimitive.content, monthsText((m as? JsonArray)?.map { it.jsonPrimitive.int }))
        }
        val sc = gj["sortCheck"]!!.jsonObject
        assertEquals(sc["sorted"]!!.jsonArray.map { it.jsonPrimitive.content }, sc["input"]!!.jsonArray.map { it.jsonPrimitive.content }.sortedWith { a, b -> Shopping.fr(a, b) })
        for (e in gj["allPeriods"]!!.jsonArray) assertEquals(e.jsonObject["p"]!!.jsonPrimitive.content, periodOf(lookup(e.jsonObject["id"]!!.jsonPrimitive.content)!!), e.toString())
    }
}
