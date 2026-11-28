package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

/** Parité avec le JS : `golden/massifs.json` (tools/golden-massifs.mjs). */
class MassifsGoldenTest {
    private val g = loadGolden("massifs")
    private val gardens: Map<String, Garden> = g["gardens"]!!.jsonArray.associate {
        it.jsonObject["name"]!!.jsonPrimitive.content to JardinJson.json.decodeFromJsonElement(Garden.serializer(), it.jsonObject["garden"]!!)
    }
    private val dec = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val custom: List<Plant> by lazy { g["custom"]!!.jsonArray.map { dec.decodeFromJsonElement(Plant.serializer(), it) } }

    private fun toJson(v: Any?): JsonElement = when (v) {
        null -> JsonNull
        is JsonElement -> v
        is Boolean -> JsonPrimitive(v)
        is Int -> JsonPrimitive(v)
        is Double -> jn(v)
        is String -> JsonPrimitive(v)
        is List<*> -> JsonArray(v.map { toJson(it) })
        else -> error("type ${v::class}")
    }
    private fun obj(vararg kv: Pair<String, Any?>): JsonObject = JsonObject(kv.filter { it.second != null }.associate { (k, v) -> k to toJson(v) })
    private fun plantingsJ(l: List<Planting>) = l.map { obj("plantId" to it.plantId, "count" to it.count) }
    private fun shapeJ(s: Shape) = JardinJson.json.encodeToJsonElement(Shape.serializer(), s)
    private fun summaryJ(s: BedSummary?): JsonElement = if (s == null) JsonNull else obj(
        "bloomMonths" to s.bloomMonths, "layers" to s.layers, "palette" to s.palette, "families" to s.families, "costEur" to s.costEur,
        "effort" to s.effort, "species" to s.species, "melliferous" to s.melliferous, "density" to s.density,
    )
    private fun bedJ(b: Bed): JsonElement = obj(
        "id" to b.id, "role" to b.role, "shape" to shapeJ(b.shape), "areaM2" to b.areaM2, "widthM" to b.widthM, "sunLevel" to b.sunLevel, "score" to b.score,
        "why" to b.why, "plantings" to plantingsJ(b.plantings), "summary" to (if (b.summary == null) null else summaryJ(b.summary)), "plantsWhy" to b.plantsWhy,
        "alternatives" to b.alternatives.takeIf { it.isNotEmpty() }?.map { a ->
            obj("label" to a.label, "palette" to a.palette, "ambiance" to a.ambiance, "plantings" to plantingsJ(a.plantings), "summary" to summaryJ(a.summary), "why" to a.why)
        },
        "ambiance" to b.ambiance, "seed" to b.seed,
    )
    private fun designJ(d: DesignResult): JsonElement = obj(
        "plantings" to plantingsJ(d.plantings), "summary" to summaryJ(d.summary), "why" to d.why,
        "alternatives" to d.alternatives.map { a ->
            obj("label" to a.label, "palette" to a.palette, "ambiance" to a.ambiance, "plantings" to plantingsJ(a.plantings), "summary" to summaryJ(a.summary), "why" to a.why)
        },
    )
    private fun zoneJ(z: Zone): JsonElement = obj(
        "id" to z.id, "type" to z.type, "label" to z.label, "shape" to z.shape?.let { shapeJ(it) }, "plantings" to plantingsJ(z.plantings),
        "ambiance" to z.ambiance, "auto" to z.auto, "autoInfo" to z.autoInfo,
    )

    private fun str(o: JsonObject, k: String) = o[k]?.jsonPrimitive?.contentOrNull
    private fun num(o: JsonObject, k: String) = o[k]?.jsonPrimitive?.doubleOrNull
    private fun summaryOf(e: JsonElement?): BedSummary? {
        val o = e as? JsonObject ?: return null
        return BedSummary(
            o["bloomMonths"]!!.jsonArray.map { it.jsonPrimitive.int }, o["layers"]!!.jsonPrimitive.int, o["palette"]!!.jsonPrimitive.content,
            o["families"]!!.jsonArray.map { it.jsonPrimitive.content }, num(o, "costEur")!!, num(o, "effort")!!, o["species"]!!.jsonPrimitive.int,
            o["melliferous"]!!.jsonPrimitive.int, num(o, "density")!!,
        )
    }
    private fun plantingsOf(e: JsonElement?): List<Planting> = (e as? JsonArray)?.map { Planting(it.jsonObject["plantId"]!!.jsonPrimitive.content, count = it.jsonObject["count"]?.jsonPrimitive?.int) } ?: emptyList()
    private fun bedOf(o: JsonObject): Bed = Bed(
        id = str(o, "id") ?: "", role = str(o, "role"), shape = shapeOf(o["shape"]!!), areaM2 = num(o, "areaM2") ?: 0.0, widthM = num(o, "widthM") ?: 0.0,
        sunLevel = str(o, "sunLevel"), sunLevelGiven = o.containsKey("sunLevel"), score = o["score"]?.jsonPrimitive?.int ?: 0, why = str(o, "why") ?: "",
        plantings = plantingsOf(o["plantings"]), summary = summaryOf(o["summary"]), plantsWhy = str(o, "plantsWhy"), ambiance = str(o, "ambiance"), seed = num(o, "seed"),
    )
    private fun maybe(o: JsonObject, k: String): Maybe<String>? = if (o.containsKey(k)) Maybe(str(o, k)) else null
    private fun numOf(o: JsonObject, k: String, d: Number): Number { val p = o[k]?.jsonPrimitive ?: return d; return p.intOrNull ?: p.double }

    private fun bedOptsOf(o: JsonObject) = BedOptions(
        seed = numOf(o, "seed", 1), coverage = num(o, "coverage") ?: 0.5, minArea = num(o, "minArea") ?: 2.0, maxArea = num(o, "maxArea") ?: 20.0,
        maxBeds = o["maxBeds"]?.jsonPrimitive?.int ?: 12, style = str(o, "style") ?: "mixed", ambiance = str(o, "ambiance"), maintenance = str(o, "maintenance"),
        budget = num(o, "budget"), palette = str(o, "palette") ?: "auto", allowLawn = o["allowLawn"]?.jsonPrimitive?.booleanOrNull ?: false,
        design = o["design"]?.jsonPrimitive?.booleanOrNull ?: true,
    )

    @Test fun espaceLibre() {
        val opts = g["freeOpts"]!!.jsonArray
        for (e in g["free"]!!.jsonArray) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content; val k = o["k"]!!.jsonPrimitive.int
            val oo = opts[k].jsonObject
            val cl = (oo["clearances"] as? JsonObject)?.mapValues { it.value.jsonPrimitive.double }
            val fs = Massifs.freeSpace(gardens[name], cell = num(oo, "cell") ?: 0.25, margin = num(oo, "margin") ?: 0.3, clearances = cl, allowLawn = oo["allowLawn"]?.jsonPrimitive?.booleanOrNull ?: false)
            val at = "$name/$k"
            assertSame2(o["cell"], jn(fs.cell), "$at.cell"); assertSame2(o["nx"], jn(fs.nx), "$at.nx"); assertSame2(o["ny"], jn(fs.ny), "$at.ny")
            assertSame2(o["minX"], jn(fs.minX), "$at.minX"); assertSame2(o["minY"], jn(fs.minY), "$at.minY"); assertSame2(o["freeArea"], jn(fs.freeArea), "$at.freeArea")
            assertEquals(o["grid"]!!.jsonPrimitive.content, fs.grid.joinToString("") { it.toString() }, "$at.grid")
            val dmE = o["dm"] as? JsonArray
            if (dmE != null) {
                val dm = fs.distanceMap()
                assertEquals(dmE.size, dm.size)
                for (i in dm.indices) assertSame2(dmE[i], jn(dm[i].toDouble()), "$at.dm[$i]")
            }
            val comps = fs.components()
            assertSame2(o["comps"], toJson(comps.map { c -> obj("n" to c.cells.size, "a" to c.areaM2, "c" to jp(c.centroid), "b" to obj("minX" to c.bounds.minX, "minY" to c.bounds.minY, "maxX" to c.bounds.maxX, "maxY" to c.bounds.maxY)) }), "$at.comps")
            val probes = listOf(1.0 to 1.0, 5.0 to 5.0, 10.2 to 4.4, 6.0 to 8.0, 15.0 to 7.0, 3.0 to 11.0, -1.0 to 3.0).map { fs.isFree(it.first, it.second) }
            assertSame2(o["probes"], toJson(probes), "$at.probes")
        }
    }

    @Test fun propositions() {
        val opts = g["bedOpts"]!!.jsonArray
        for (e in g["beds"]!!.jsonArray) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content; val k = o["k"]!!.jsonPrimitive.int
            val beds = Massifs.proposeBeds(gardens[name]!!, bedOptsOf(opts[k].jsonObject))
            assertSame2(o["r"], toJson(beds.map { bedJ(it) }), "beds/$name/$k")
        }
    }

    @Test fun combinaisonDePlantes() {
        for ((n, e) in g["designs"]!!.jsonArray.withIndex()) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content
            val gd = if (name == "under") JardinJson.json.decodeFromJsonElement(Garden.serializer(), g["under"]!!) else gardens[name]!!
            val oo = o["opts"]!!.jsonObject
            val plants = if (oo.containsKey("plants")) (if (oo["plants"]!!.jsonArray.isEmpty()) emptyList() else custom) else null
            val opts = DesignOptions(
                seed = numOf(oo, "seed", 1), ambiance = maybe(oo, "ambiance"), maintenance = maybe(oo, "maintenance"), budget = num(oo, "budget"),
                palette = str(oo, "palette"), plants = plants, tminC = num(oo, "tminC"), iterations = oo["iterations"]?.jsonPrimitive?.int,
            )
            val r = Massifs.designBed(gd, bedOf(o["bed"]!!.jsonObject), opts)
            assertSame2(o["r"], designJ(r), "design[$n]/$name")
        }
    }

    @Test fun zones() {
        for (e in g["zones"]!!.jsonArray) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content; val k = o["k"]!!.jsonPrimitive.int
            val beds = o["beds"]!!.jsonArray.map { bedOf(it.jsonObject) }
            val gd = gardens[name]!!
            val zs = when (k) {
                0 -> Massifs.bedsToZones(gd, beds, ambiance = Maybe("bucolique"))
                1 -> Massifs.bedsToZones(gd, beds)
                else -> Massifs.bedsToZones(gd, beds, ambiance = Maybe(null), startIndex = 5)
            }
            assertSame2(o["r"], toJson(zs.map { zoneJ(it) }), "zones/$name/$k")
        }
        val h = g["hand"]!!.jsonObject
        val zs = Massifs.bedsToZones(gardens[h["g"]!!.jsonPrimitive.content], h["beds"]!!.jsonArray.map { bedOf(it.jsonObject) })
        assertSame2(h["r"], toJson(zs.map { zoneJ(it) }), "hand")
        val nb = g["numbering"]!!.jsonObject
        val g2 = JardinJson.json.decodeFromJsonElement(Garden.serializer(), nb["garden"]!!)
        val next = Massifs.bedsToZones(g2, Massifs.proposeBeds(g2, BedOptions(seed = 2, maxBeds = 1, coverage = 0.2)))
        assertSame2(nb["r"], toJson(next.map { zoneJ(it) }), "numbering")
    }

    @Test fun regeneration() {
        for (e in g["regen"]!!.jsonArray) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content
            val g0 = JardinJson.json.decodeFromJsonElement(Garden.serializer(), o["garden0"]!!)
            fun fmt(r: RegenerateResult) = obj("beds" to r.beds.map { bedJ(it) }, "zones" to r.zones.map { zoneJ(it) }, "added" to r.added.map { it.id }, "kept" to r.kept, "removed" to r.removed)
            val first = Massifs.regenerate(g0, seed = 1)
            assertSame2(o["first"], fmt(first), "regen/$name/first")
            val g1 = g0.copy(zones = first.zones)
            val keep = str(o, "keep")
            val second = Massifs.regenerate(g1, keepIds = listOfNotNull(keep), seed = 7)
            assertSame2(o["second"], fmt(second), "regen/$name/second")
            assertSame2(o["third"], fmt(Massifs.regenerate(g1)), "regen/$name/third")
        }
    }

    @Test fun famillesDeCouleurs() {
        for ((i, e) in g["colors"]!!.jsonArray.withIndex()) {
            val h = e.jsonObject["h"]!!.let { if (it is JsonNull) null else it.jsonPrimitive.content }
            assertSame2(e.jsonObject["f"], toJson(Massifs.colorFamily(h)), "color[$i] $h")
        }
        assertEquals(g["families"]!!.jsonArray.map { it.jsonPrimitive.content }, Massifs.COLOR_FAMILIES)
    }

    @Test fun triV8AvecComparateurAleatoire() {
        for (e in g["sorts"]!!.jsonArray) {
            val o = e.jsonObject
            val n = o["n"]!!.jsonPrimitive.int
            val dm = FloatArray(n) { o["dm"]!!.jsonArray[it].jsonPrimitive.float }
            val r = Mulberry32(n * 31 + 5)
            val idx = MutableList(n) { it }
            V8Sort.sort(idx) { a, b -> (dm[b] + r.next() * 0.8) - (dm[a] + r.next() * 0.8) }
            val at = "sort n=$n ${o["mode"]!!.jsonPrimitive.content}"
            assertEquals(o["r"]!!.jsonArray.map { it.jsonPrimitive.int }, idx, at)
            assertEquals(o["calls"]!!.jsonPrimitive.int, Math.floor(r.next() * 1e9).toInt(), "$at calls")
        }
    }
}
