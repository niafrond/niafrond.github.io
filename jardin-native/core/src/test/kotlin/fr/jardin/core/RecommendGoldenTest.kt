package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

/** Parité avec le JS : `golden/recommend.json` (tools/golden-recommend.mjs). */
class RecommendGoldenTest {
    private val g = loadGolden("recommend")
    private val synth = goldenSynth(g)
    private val all: List<Plant> = allPlants() + synth
    private val gardens: Map<String, Garden> = g["gardens"]!!.jsonArray.associate {
        it.jsonObject["name"]!!.jsonPrimitive.content to JardinJson.json.decodeFromJsonElement(Garden.serializer(), it.jsonObject["garden"]!!)
    }

    private fun obj(vararg kv: Pair<String, Any?>): JsonObject = JsonObject(kv.filter { it.second != null }.associate { (k, v) -> k to toJson(v) })
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

    private fun reasonJson(r: Reason) = obj("ok" to r.ok, "criterion" to r.criterion, "text" to r.text)
    private fun slim(r: Recommendation) = obj("id" to r.plant.id, "score" to r.score, "status" to r.status, "rank" to r.rank, "forbidden" to (if (r.forbidden) true else null))
    private fun full(p: Plant, r: ScoreResult) = obj(
        "id" to p.id, "score" to r.score, "status" to r.status, "rank" to r.rank, "forbidden" to (if (r.forbidden) true else null),
        "excluded" to r.excluded, "reasons" to r.reasons.map { reasonJson(it) },
    )
    private fun ctxJson(c: ScoreContext) = obj(
        "tminC" to c.tminC, "zoneType" to c.zoneType, "sunLevel" to c.sunLevel, "areaM2" to c.areaM2, "minDimension" to c.minDimension, "soil" to c.soil,
        "windy" to c.windy, "ambiance" to c.ambiance, "maintenance" to c.maintenance, "pondArea" to c.pondArea, "pondDepth" to c.pondDepth,
    )
    private fun ctxOf(o: JsonObject) = ScoreContext(
        tminC = dbl(o["tminC"]), zoneType = o["zoneType"]?.jsonPrimitive?.contentOrNull, sunLevel = o["sunLevel"]?.jsonPrimitive?.contentOrNull,
        areaM2 = dbl(o["areaM2"]), minDimension = dbl(o["minDimension"]), soil = o["soil"]?.jsonPrimitive?.contentOrNull,
        windy = o["windy"]?.jsonPrimitive?.booleanOrNull, ambiance = o["ambiance"]?.jsonPrimitive?.contentOrNull,
        maintenance = o["maintenance"]?.jsonPrimitive?.contentOrNull, pondArea = dbl(o["pondArea"]), pondDepth = dbl(o["pondDepth"])?.toInt(),
    )
    private fun plantings(l: List<Planting>) = l.map { obj("plantId" to it.plantId, "count" to it.count) }

    @Test fun scorePlantToutesEssencesTousContextes() {
        val ctxs = g["ctxs"]!!.jsonArray.map { ctxOf(it.jsonObject) }
        val exp = g["score"]!!.jsonArray
        assertEquals(ctxs.size, exp.size)
        ctxs.forEachIndexed { ci, c ->
            val row = exp[ci].jsonArray
            assertEquals(all.size, row.size)
            all.forEachIndexed { pi, p -> assertSame2(row[pi], full(p, Recommend.scorePlant(p, c)), "score[$ci][${p.id}]") }
        }
    }

    @Test fun petitsArbustes() {
        assertEquals(g["small"]!!.jsonArray.map { it.jsonPrimitive.content }, all.filter { Recommend.isSmallShrub(it) }.map { it.id })
    }

    @Test fun contexteEtRecommandationsParZone() {
        for (zg in g["zones"]!!.jsonArray) for (e in zg.jsonArray) {
            val name = e.jsonObject["g"]!!.jsonPrimitive.content
            val gd = gardens[name]!!
            val z = gd.zones.first { it.id == e.jsonObject["z"]!!.jsonPrimitive.content }
            val at = "$name/${z.id}"
            assertSame2(e.jsonObject["ctx"], ctxJson(Recommend.contextForZone(gd, z)), "$at.ctx")
            assertSame2(e.jsonObject["ctxNoAmb"], ctxJson(Recommend.contextForZone(gd, z, ambiance = Maybe(null))), "$at.ctxNoAmb")
            assertSame2(e.jsonObject["ctxAmb"], ctxJson(Recommend.contextForZone(gd, z, ambiance = Maybe("zen"), maintenance = Maybe("none"))), "$at.ctxAmb")
            assertSame2(e.jsonObject["resolve"], toJson(Recommend.resolveAmbiance(z)), "$at.resolve")
            fun rec(o: RecommendOptions = RecommendOptions()) = Recommend.recommendForZone(gd, z, o.copy(plants = all))
            assertSame2(e.jsonObject["rec"], toJson(rec().map { slim(it) }), "$at.rec")
            assertSame2(e.jsonObject["recAll"], toJson(rec(RecommendOptions(includeDiscouraged = true, includeForbidden = true)).map { slim(it) }), "$at.recAll")
            assertSame2(e.jsonObject["recFirst"], toJson(rec(RecommendOptions(includeDiscouraged = true)).take(3).map { full(it.plant, it.result) }), "$at.recFirst")
            assertSame2(e.jsonObject["recFiltered"], toJson(rec(RecommendOptions(filters = PlantFilters(melliferous = true, heightMax = 2.0))).map { it.plant.id }), "$at.recFiltered")
            assertSame2(e.jsonObject["recMaint"], toJson(rec(RecommendOptions(maintenance = Maybe("none"), ambiance = Maybe("bucolique"))).map { slim(it) }), "$at.recMaint")
            assertSame2(e.jsonObject["qty"], toJson(all.map { Recommend.suggestQuantity(it, z) }), "$at.qty")
        }
    }

    @Test fun coherence() {
        for (e in g["coherence"]!!.jsonArray) {
            val name = e.jsonObject["g"]!!.jsonPrimitive.content
            val r = Recommend.checkCoherence(gardens[name]!!, all)
            assertSame2(e.jsonObject["r"], toJson(r.map { obj("level" to it.level, "zoneId" to it.zoneId, "plantId" to it.plantId, "kind" to it.kind, "text" to it.text) }), "coh/$name")
        }
    }

    private fun selOpts(k: Int, base: SelectionOptions): SelectionOptions = when (k) {
        0 -> base
        1 -> base.copy(ambiance = Maybe("bucolique"))
        2 -> base.copy(maintenance = Maybe("none"))
        3 -> base.copy(budget = 150.0)
        else -> base.copy(max = 6, ambiance = Maybe(null))
    }

    @Test fun surprendsMoi() {
        for (e in g["sel"]!!.jsonArray) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content
            val gd = gardens[name]!!
            val z = gd.zones.first { it.id == o["z"]!!.jsonPrimitive.content }
            val sp = o["seed"]!!.jsonPrimitive
            val seed: Any = if (sp.isString) sp.content else sp.int
            val k = o["k"]!!.jsonPrimitive.int
            val r = Recommend.suggestSelection(gd, z, selOpts(k, SelectionOptions(seed = seed, plants = all)))
            assertSame2(o["r"], toJson(plantings(r)), "sel/$name/${z.id}/$seed/$k")
        }
    }

    @Test fun surprendsMoiTousLesJardins() {
        for (e in g["forGarden"]!!.jsonArray) {
            val o = e.jsonObject
            val name = o["g"]!!.jsonPrimitive.content
            val gd = gardens[name]!!
            val r = if (o["k"]!!.jsonPrimitive.int == 0) {
                val amb = o["ambiances"]!!.jsonObject.mapValues { (_, v) -> v.jsonPrimitive.contentOrNull }
                Recommend.suggestForGarden(gd, seed = 4, plants = all, ambiances = amb)
            } else Recommend.suggestForGarden(gd, seed = "x", plants = all, budget = 600.0, maintenance = Maybe("low"))
            assertSame2(o["r"], toJson(r.map { obj("zoneId" to it.zoneId, "selection" to plantings(it.selection)) }), "forGarden/$name/${o["k"]}")
        }
    }
}
