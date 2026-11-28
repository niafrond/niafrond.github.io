package fr.jardin.core

import java.io.File
import kotlinx.serialization.json.*
import kotlin.test.*

internal fun goldenJson(name: String): JsonObject {
    var dir: File? = File("").absoluteFile
    while (dir != null && !File(dir, "golden/$name.json").exists()) dir = dir.parentFile
    return Json.parseToJsonElement(File(requireNotNull(dir) { "golden/$name.json introuvable" }, "golden/$name.json").readText()).jsonObject
}

class CatalogTest {
    private val ZONES = setOf("pond", "pool", "terrace", "path", "lawn", "lowplants", "midplants", "tallplants", "hedge", "trees", "vegetable", "orchard", "other")
    private val CATEGORIES = setOf("tree", "shrub", "hedge", "fruit", "climber", "perennial", "groundcover", "grass", "bulb", "aquatic", "vegetable", "lawn")
    private val SUNS = setOf("full", "partial", "shade")
    private val LEVELS = setOf("low", "medium", "high")
    private val SOILS = setOf("clay", "limestone", "sandy", "loam", "humus")
    private val FOLIAGES = setOf("deciduous", "evergreen", "semi", "none")
    private val HEX = Regex("^#[0-9a-fA-F]{6}$")
    private val SLUG = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")
    private fun months(l: List<Int>) = l.all { it in 1..12 }

    private val P = listOf(
        Plant("lavande", "Lavande", "Lavandula angustifolia", "shrub", heightAdult = 0.6, foliage = "evergreen", bloom = listOf(6, 7, 8), melliferous = true, maintenance = "low", water = "low"),
        Plant("erable", "Érable du Japon", "Acer palmatum", "tree", heightAdult = 5.0, foliage = "deciduous", bloom = listOf(4), maintenance = "medium", water = "medium"),
        Plant("buddleia", "Arbre à papillons", "Buddleja davidii", "shrub", heightAdult = 3.0, foliage = "deciduous", bloom = listOf(7, 8, 9), melliferous = true, invasive = true, maintenance = "low", water = "medium"),
        Plant("laurier", "Laurier-rose", "Nerium oleander", "hedge", heightAdult = 3.0, foliage = "evergreen", bloom = listOf(6, 7), toxic = true, maintenance = "medium", water = "high"),
        Plant("fraisier", "Fraisier", "Fragaria vesca", "groundcover", heightAdult = 0.2, foliage = "semi", bloom = listOf(5), edible = true, maintenance = "medium", water = "medium"),
    )
    private fun ids(l: List<Plant>) = l.map { it.id }

    @Test fun catalogueReelChargeEtUtilisable() {
        assertTrue(allPlants().size >= 150)
        assertTrue(allPlants().size > 200)
        assertNull(getPlant("inexistant-xyz"))
        assertEquals(allPlants().size, allPlants().map { it.id }.toSet().size)
    }

    @Test fun normalizeText() = assertEquals("erable", Catalog.normalizeText("  Érable  "))

    @Test fun recherche() {
        assertEquals(listOf("erable"), ids(searchPlants("erable", P)))
        assertEquals(listOf("erable"), ids(searchPlants("ÉRABLE", P)))
        assertEquals(listOf("lavande"), ids(searchPlants("lavandula", P)))
        assertEquals(listOf("buddleia"), ids(searchPlants("arbre papillons", P)))
        assertEquals(5, searchPlants("", P).size)
        assertEquals(emptyList(), searchPlants("zzz", P))
    }

    @Test fun filtres() {
        assertEquals(listOf("lavande", "laurier"), ids(filterPlants(P, PlantFilters(foliage = "evergreen"))))
        assertEquals(listOf("erable"), ids(filterPlants(P, PlantFilters(category = listOf("tree")))))
        assertEquals(listOf("erable", "laurier"), ids(filterPlants(P, PlantFilters(category = listOf("tree", "hedge")))))
        assertEquals(listOf("lavande", "buddleia", "laurier"), ids(filterPlants(P, PlantFilters(bloomMonth = 7))))
        assertEquals(listOf("lavande", "fraisier"), ids(filterPlants(P, PlantFilters(heightMax = 1.0))))
        assertEquals(listOf("lavande", "buddleia"), ids(filterPlants(P, PlantFilters(melliferous = true))))
        assertEquals(listOf("fraisier"), ids(filterPlants(P, PlantFilters(edible = true))))
        assertEquals(listOf("lavande", "buddleia"), ids(filterPlants(P, PlantFilters(lowMaintenance = true))))
        assertEquals(listOf("lavande"), ids(filterPlants(P, PlantFilters(lowWater = true))))
        assertFalse("laurier" in ids(filterPlants(P, PlantFilters(nonToxic = true))))
        assertFalse("buddleia" in ids(filterPlants(P, PlantFilters(nonInvasive = true))))
        assertEquals(listOf("lavande"), ids(filterPlants(P, PlantFilters(melliferous = true, nonInvasive = true))))
        assertEquals(5, filterPlants(P).size)
    }

    @Test fun invariantsDuCatalogue() {
        val plants = allPlants()
        val woody = plants.count { it.category in setOf("tree", "shrub", "hedge", "fruit", "climber") }
        assertTrue(woody >= 70, "ligneux: $woody")
        assertTrue(plants.size - woody >= 70)
        for (p in plants) {
            val m = "${p.id}: "
            assertTrue(SLUG.matches(p.id), m + "slug")
            assertTrue(p.commonName.isNotBlank() && p.latinName.isNotBlank(), m + "noms")
            assertTrue(p.category in CATEGORIES, m + "categorie")
            assertTrue(p.heightAdult > 0 && p.widthAdult > 0, m + "dimensions")
            assertTrue(p.sun.isNotEmpty() && p.sun.all { it in SUNS }, m + "sun")
            assertTrue(p.hardiness <= 5, m + "hardiness")
            assertTrue(p.water in LEVELS, m + "water")
            assertTrue(p.soil.all { it in SOILS }, m + "soil")
            assertTrue(p.foliage in FOLIAGES, m + "foliage")
            assertTrue(months(p.bloom), m + "bloom")
            assertTrue(p.zones.isNotEmpty() && p.zones.all { it in ZONES }, m + "zones")
            assertTrue(p.maintenance in LEVELS, m + "maintenance")
            assertTrue(p.kc in 0.3..1.1, m + "kc")
            assertTrue(p.spacing > 0, m + "spacing")
            if (p.edible && p.category in setOf("perennial", "groundcover", "grass", "bulb", "aquatic", "vegetable", "lawn")) assertTrue(months(p.harvest) && p.harvest.isNotEmpty(), m + "harvest")
            assertTrue(months(p.harvest))
            val c = p.care
            assertTrue(months(c.plantMonths) && months(c.pruneMonths) && months(c.fertMonths), m + "mois")
            assertTrue(listOf(c.planting, c.pruning, c.fertilizer, c.watering, c.notes).all { it.isNotBlank() }, m + "textes")
            // extras
            val price = p.priceEur
            if (price != null) {
                assertTrue(p.priceUnit in setOf("plant", "bulb", "m2"), m + "unit")
                assertTrue(price > 0, m + "prix")
            }
            assertTrue(p.flowerColor == null || HEX.matches(p.flowerColor), m + "flowerColor")
            assertTrue(p.foliageColor == null || HEX.matches(p.foliageColor), m + "foliageColor")
            // tags
            assertNotNull(p.habitTag, m + "habit")
            assertNotNull(p.ambianceTag, m + "ambiance")
        }
        assertTrue(plants.count { it.priceEur != null }.toDouble() / plants.size > 0.9)
        assertTrue(getPlant("h-jussie")!!.invasive)
        assertNotNull(getPlant("h-nenuphar")!!.pondTag)
    }

    @Test fun golden() {
        val g = goldenJson("catalog")
        assertEquals(g["count"]!!.jsonPrimitive.int, allPlants().size)
        assertEquals(g["ids"]!!.jsonArray.map { it.jsonPrimitive.content }, ids(allPlants()))
        for (e in g["normalize"]!!.jsonArray) {
            val a = e.jsonArray
            assertEquals(a[1].jsonPrimitive.content, Catalog.normalizeText(a[0].jsonPrimitive.contentOrNull))
        }
        for (e in g["search"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["ids"]!!.jsonArray.map { it.jsonPrimitive.content }, ids(searchPlants(o["q"]!!.jsonPrimitive.content)), "q=${o["q"]}")
        }
        for (e in g["filter"]!!.jsonArray) {
            val o = e.jsonObject
            val f = o["f"]!!.jsonObject
            val cat = f["category"]?.let { if (it is JsonArray) it.map { x -> x.jsonPrimitive.content } else listOf(it.jsonPrimitive.content) } ?: emptyList()
            val filters = PlantFilters(
                foliage = f["foliage"]?.jsonPrimitive?.content,
                bloomMonth = f["bloomMonth"]?.jsonPrimitive?.int,
                heightMax = f["heightMax"]?.jsonPrimitive?.double,
                melliferous = f["melliferous"] != null, edible = f["edible"] != null,
                lowMaintenance = f["lowMaintenance"] != null, lowWater = f["lowWater"] != null,
                nonToxic = f["nonToxic"] != null, nonInvasive = f["nonInvasive"] != null, category = cat,
            )
            assertEquals(o["ids"]!!.jsonArray.map { it.jsonPrimitive.content }, ids(filterPlants(allPlants(), filters)), "f=$f")
        }
        val dec = Json { ignoreUnknownKeys = true }
        for (e in g["sample"]!!.jsonArray) {
            val js = e.jsonObject
            val p = getPlant(js["id"]!!.jsonPrimitive.content)!!
            assertEquals(js["commonName"]!!.jsonPrimitive.content, p.commonName)
            assertEquals(js["heightAdult"]!!.jsonPrimitive.double, p.heightAdult, 1e-6)
            assertEquals(js["kc"]!!.jsonPrimitive.double, p.kc, 1e-6)
            assertEquals(js["priceEur"]?.jsonPrimitive?.doubleOrNull, p.priceEur)
            assertEquals(js["care"]!!.jsonObject["pruneMonths"]!!.jsonArray.map { it.jsonPrimitive.int }, p.care.pruneMonths)
            assertNotNull(dec.decodeFromJsonElement(Plant.serializer(), js))
        }
    }
}
