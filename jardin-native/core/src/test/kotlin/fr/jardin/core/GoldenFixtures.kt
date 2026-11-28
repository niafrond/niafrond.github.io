package fr.jardin.core

import kotlinx.serialization.json.*

/** Fixtures partagées (golden/fixtures.json) : échantillon du catalogue réel et jardins de test. */
internal object GoldenFixtures {
    private val fx: JsonObject by lazy { loadGolden("fixtures") }

    fun plantOf(e: JsonElement): SimplePlant {
        val o = e.jsonObject
        fun d(k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.doubleOrNull
        fun s(k: String) = (o[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
        return SimplePlant(
            id = s("id")!!, commonName = s("commonName"), latinName = s("latinName"), category = s("category"),
            heightAdult = d("heightAdult"), widthAdult = d("widthAdult"), spacing = d("spacing"), habit = s("habit"), foliage = s("foliage"),
            invasive = (o["invasive"] as? JsonPrimitive)?.booleanOrNull ?: false,
        )
    }
    fun plants(e: JsonElement): List<SimplePlant> = e.jsonArray.map { plantOf(it) }
    val plants: List<SimplePlant> by lazy { plants(fx["plants"]!!) }
    fun lookupOf(l: List<PlantLike>): PlantLookup = { id -> l.firstOrNull { it.id == id } }
    val lookup: PlantLookup by lazy { lookupOf(plants) }
    fun garden(e: JsonElement): Garden = JardinJson.json.decodeFromJsonElement(Garden.serializer(), e)
    fun gardenJson(name: String): JsonElement = fx["gardens"]!!.jsonObject[name]!!
    fun garden(name: String): Garden = garden(gardenJson(name))
}

internal fun zoneOf(e: JsonElement): Zone = JardinJson.json.decodeFromJsonElement(Zone.serializer(), e)
internal fun existingOf(e: JsonElement): Existing = JardinJson.json.decodeFromJsonElement(Existing.serializer(), e)
internal fun itemOf(e: JsonElement): Item = JardinJson.json.decodeFromJsonElement(Item.serializer(), e)
internal fun openingOf(e: JsonElement): Opening = JardinJson.json.decodeFromJsonElement(Opening.serializer(), e)
internal fun refOf(e: JsonElement): OpeningRef = JardinJson.json.decodeFromJsonElement(OpeningRef.serializer(), e)
internal fun plantingsOf(e: JsonElement?): List<Planting> = if (e == null) emptyList() else JardinJson.json.decodeFromJsonElement(kotlinx.serialization.builtins.ListSerializer(Planting.serializer()), e)

internal fun jobs(o: ShadowObstacle): JsonElement = buildJsonObject {
    put("id", o.id); put("kind", o.kind); put("height", jn(o.height))
    o.points?.let { put("points", jpts(it)) }
    o.center?.let { put("center", jp(it)) }
    o.radius?.let { put("radius", jn(it)) }
    o.thickness?.let { put("thickness", jn(it)) }
    o.opacity?.let { put("opacity", jn(it)) }
    o.itemKind?.let { put("itemKind", it) }
    o.edge?.let { put("edge", jn(it)) }
    if (o.existing) put("existing", true)
    if (o.zone) put("zone", true)
}
internal fun jobsList(l: List<ShadowObstacle>): JsonElement = JsonArray(l.map { jobs(it) })
