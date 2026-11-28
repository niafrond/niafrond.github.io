package fr.jardin.core

import java.io.File
import kotlinx.serialization.json.*
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.fail

/** Charge `golden/<name>.json` (cherche le dossier `golden` en remontant). */
internal fun loadGolden(name: String): JsonObject {
    var dir: File? = File("").absoluteFile
    while (dir != null && !File(dir, "golden/$name.json").exists()) dir = dir.parentFile
    val f = File(requireNotNull(dir) { "golden/$name.json introuvable" }, "golden/$name.json")
    return Json.parseToJsonElement(f.readText()).jsonObject
}

internal fun jn(v: Double): JsonElement = when {
    v.isNaN() -> JsonPrimitive("__NaN__")
    v == Double.POSITIVE_INFINITY -> JsonPrimitive("__Inf__")
    v == Double.NEGATIVE_INFINITY -> JsonPrimitive("__-Inf__")
    else -> JsonPrimitive(v)
}
internal fun jn(v: Int): JsonElement = JsonPrimitive(v)
internal fun jp(p: Point): JsonElement = buildJsonObject { put("x", jn(p.x)); put("y", jn(p.y)) }
internal fun jpts(l: List<Point>): JsonElement = JsonArray(l.map { jp(it) })
internal fun jb(b: Bounds): JsonElement = buildJsonObject {
    put("minX", jn(b.minX)); put("minY", jn(b.minY)); put("maxX", jn(b.maxX)); put("maxY", jn(b.maxY)); put("width", jn(b.width)); put("height", jn(b.height))
}
internal fun jstr(s: String?): JsonElement = if (s == null) JsonNull else JsonPrimitive(s)
internal fun jlist(l: List<JsonElement>): JsonElement = JsonArray(l)

internal fun pt(e: JsonElement): Point = Point(e.jsonObject["x"]!!.jsonPrimitive.double, e.jsonObject["y"]!!.jsonPrimitive.double)
internal fun pts(e: JsonElement): List<Point> = e.jsonArray.map { pt(it) }
internal fun shapeOf(e: JsonElement): Shape = JardinJson.json.decodeFromJsonElement(Shape.serializer(), e)
internal fun dbl(e: JsonElement?): Double? {
    val p = e as? JsonPrimitive ?: return null
    if (p is JsonNull) return null
    return when (p.content) { "__NaN__" -> Double.NaN; "__Inf__" -> Double.POSITIVE_INFINITY; "__-Inf__" -> Double.NEGATIVE_INFINITY; else -> p.doubleOrNull }
}

/** Compare deux JSON : flottants à `tol` près, clés nulles ignorées de part et d'autre. */
internal fun assertJsonClose(expected: JsonElement?, actual: JsonElement?, path: String = "$", tol: Double = 1e-6) {
    val e = if (expected is JsonNull) null else expected
    val a = if (actual is JsonNull) null else actual
    if (e == null || a == null) { if (e != a) fail("$path : attendu=$expected, obtenu=$actual"); return }
    when (e) {
        is JsonObject -> {
            if (a !is JsonObject) fail("$path : objet attendu, obtenu=$a")
            val ek = e.filterValues { it !is JsonNull }.keys; val ak = a.filterValues { it !is JsonNull }.keys
            if (ek != ak) fail("$path : clés attendues=${ek.sorted()} obtenues=${ak.sorted()}")
            for (k in ek) assertJsonClose(e[k], a[k], "$path.$k", tol)
        }
        is JsonArray -> {
            if (a !is JsonArray) fail("$path : tableau attendu, obtenu=$a")
            if (e.size != a.size) fail("$path : taille attendue=${e.size} obtenue=${a.size}")
            for (i in e.indices) assertJsonClose(e[i], a[i], "$path[$i]", tol)
        }
        is JsonPrimitive -> {
            if (a !is JsonPrimitive) fail("$path : primitive attendue, obtenu=$a")
            if (e.isString) { if (!a.isString || a.content != e.content) fail("$path : attendu=${e.content}, obtenu=${a.content}"); return }
            if (a.isString) fail("$path : nombre attendu ($e), obtenu chaîne ${a.content}")
            val eb = e.booleanOrNull
            if (eb != null) { if (a.booleanOrNull != eb) fail("$path : attendu=$e, obtenu=$a"); return }
            val x = e.double; val y = a.doubleOrNull ?: fail("$path : nombre attendu, obtenu=$a")
            if (abs(x - y) > tol * max(1.0, abs(x))) fail("$path : attendu=$x, obtenu=$y")
        }
    }
}
