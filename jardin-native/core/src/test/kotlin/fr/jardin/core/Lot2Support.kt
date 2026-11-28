package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.math.abs
import kotlin.test.fail

// Aides des tests golden (pricing, shopping, advice, watering, transfer) : jardins de test et essences synthétiques
// relus depuis le golden, comparaison JSON avec tolérance 1e-6.

private val dec = Json { ignoreUnknownKeys = true; coerceInputValues = true }

internal fun goldenGardens(g: JsonObject): List<Garden> =
    g["gardens"]!!.jsonArray.map { JardinJson.json.decodeFromJsonElement(Garden.serializer(), it) }

internal fun goldenSynth(g: JsonObject): List<Plant> =
    g["synth"]!!.jsonArray.map { dec.decodeFromJsonElement(Plant.serializer(), it) }

/** Catalogue réel + essences synthétiques du golden. */
internal fun goldenLookup(g: JsonObject): PlantById {
    val map = (allPlants() + goldenSynth(g)).associateBy { it.id }
    return { map[it] }
}

internal fun assertSame2(expected: JsonElement?, actual: JsonElement?, path: String = "$", eps: Double = 1e-6) {
    val e = expected ?: JsonNull
    val a = actual ?: JsonNull
    when {
        e is JsonNull || a is JsonNull -> if (e != a) fail("$path : attendu $e, obtenu $a")
        e is JsonObject -> {
            if (a !is JsonObject) fail("$path : objet attendu, obtenu $a")
            val ek = e.keys.filter { e[it] !is JsonNull }.toSet(); val ak = a.keys.filter { a[it] !is JsonNull }.toSet()
            if (ek != ak) fail("$path : clés attendues $ek, obtenues $ak")
            for (k in e.keys) assertSame2(e[k], a[k], "$path.$k", eps)
        }
        e is JsonArray -> {
            if (a !is JsonArray) fail("$path : tableau attendu, obtenu $a")
            if (e.size != a.size) fail("$path : ${e.size} éléments attendus, ${a.size} obtenus")
            for (i in e.indices) assertSame2(e[i], a[i], "$path[$i]", eps)
        }
        e is JsonPrimitive && a is JsonPrimitive -> {
            if (e.isString || a.isString) { if (e.content != a.content || e.isString != a.isString) fail("$path : attendu '${e.content}', obtenu '${a.content}'") }
            else if (e.booleanOrNull != null) { if (e.content != a.content) fail("$path : attendu ${e.content}, obtenu ${a.content}") }
            else {
                val x = e.double; val y = a.double
                if (abs(x - y) > eps * maxOf(1.0, abs(x))) fail("$path : attendu $x, obtenu $y")
            }
        }
        else -> fail("$path : types incompatibles $e / $a")
    }
}

