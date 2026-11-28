package fr.jardin.core

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.*
import java.io.ByteArrayOutputStream
import java.net.URLDecoder
import java.util.Base64
import java.util.zip.Deflater
import java.util.zip.DeflaterOutputStream
import java.util.zip.Inflater
import java.util.zip.InflaterInputStream

// Transfert d'un jardin entre appareils (PC → téléphone) par lien, QR code ou code collé (port de jardin/transfer.js).
// Format binaire IDENTIQUE au web : `v2.<longueur base 36>.<base64url(deflate-raw(JSON UTF-8))>` ou `v2u.<longueur>.<base64url(JSON)>`
// (sans compression) ; les anciens `v1[u].<données>` restent lisibles. Le JSON est `{"format":"jardin-v1","garden":{…}}`.
// Le générateur de QR (ZXing) est côté application : le noyau n'expose que `QR_MAX_BYTES`.

/** Erreur de lecture d'un code de transfert (message en français, affichable tel quel). */
class TransferException(message: String) : Exception(message)

data class GardenDescription(val name: String, val areaM2: Double, val zones: Int, val plants: Int, val items: Int)
data class SizeInfo(val length: Int, val fitsQr: Boolean)

object Transfer {
    /** Longueur maximale d'un lien pour tenir dans un QR code (octets). */
    const val QR_MAX_BYTES = 2000
    private const val SCHEME = "jardin://import/"
    private const val HASH = "#/import/"

    /** Champs lourds ou régénérables : jamais dans le code de transfert. */
    val CHAMPS_LOURDS = setOf("svg", "views", "photo", "photos", "thumb", "history", "historique", "journal", "gpsSurveyDraft")

    private const val ILLISIBLE = "Code illisible : il est incomplet ou abîmé. Recopiez le lien en entier, ou utilisez le fichier JSON."
    private fun tronque(recu: Int, attendu: Long) =
        "Lien coupé : $recu caractères reçus sur $attendu. Une messagerie a tronqué le lien : copiez-le directement (sans l’envoyer par SMS) ou utilisez le fichier JSON."

    private val WS = Regex("(?U)[\\s\\uFEFF]+")
    private val PCT = Regex("%[0-9a-f]{2}", RegexOption.IGNORE_CASE)
    private val CODE_RE = Regex("^v(\\d+)(u?)\\.(?:([0-9a-z]+)\\.)?([A-Za-z0-9_-]+)$")
    private val CUT_RE = Regex("^v2u?\\.([0-9a-z]+)\\.([A-Za-z0-9_-]*)$")
    private val VALID_CODE = Regex("^v\\d+u?\\.(?:[0-9a-z]+\\.)?[A-Za-z0-9_-]+$")

    private fun decodeURIComponent(s: String): String = URLDecoder.decode(s.replace("+", "%2B"), Charsets.UTF_8)

    // ── base64url ──
    private fun toB64u(bytes: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    private fun fromB64u(s: String): ByteArray = Base64.getUrlDecoder().decode(s)

    private fun deflateRaw(bytes: ByteArray): ByteArray {
        val d = Deflater(Deflater.DEFAULT_COMPRESSION, true)
        val bos = ByteArrayOutputStream()
        DeflaterOutputStream(bos, d).use { it.write(bytes) }
        d.end()
        return bos.toByteArray()
    }

    private fun inflateRaw(bytes: ByteArray): ByteArray {
        val inf = Inflater(true)
        try { return InflaterInputStream(bytes.inputStream(), inf).use { it.readBytes() } } finally { inf.end() }
    }

    /** Retire récursivement les champs lourds ou régénérables (plan SVG, photos, historiques) ; les `null` sont omis. */
    fun allege(v: JsonElement): JsonElement = when (v) {
        is JsonArray -> JsonArray(v.map { allege(it) })
        is JsonObject -> JsonObject(v.filter { (k, x) -> k !in CHAMPS_LOURDS && x !is JsonNull }.mapValues { allege(it.value) })
        else -> v
    }

    /** Jardin (JSON brut) → code de transfert compact. `compress = false` : repli `v2u.`. */
    fun encodeGardenJson(garden: JsonElement, compress: Boolean = true): String {
        val json = buildJsonObject { put("format", "jardin-v1"); put("garden", allege(garden)) }.toString()
        val bytes = json.toByteArray(Charsets.UTF_8)
        val tag = if (compress) "v2" else "v2u"
        val data = toB64u(if (compress) deflateRaw(bytes) else bytes)
        return "$tag.${data.length.toString(36)}.$data"
    }

    /** Jardin → code de transfert `v2.<longueur>.<données>`. La longueur (base 36) détecte un lien COUPÉ par une messagerie. */
    fun encodeGarden(garden: Garden, compress: Boolean = true): String =
        encodeGardenJson(JardinJson.json.encodeToJsonElement(Garden.serializer(), garden), compress)

    private fun isObj(e: JsonElement?) = e is JsonObject

    private fun fusion(base: JsonObject, extra: JsonElement?): JsonObject {
        if (extra !is JsonObject) return base
        val r = LinkedHashMap(base)
        for ((k, v) in extra) {
            val b = base[k]
            r[k] = if (isObj(b) && isObj(v)) fusion(b as JsonObject, v) else v
        }
        return JsonObject(r)
    }

    private fun finiteNum(e: JsonElement?): Boolean {
        val p = e as? JsonPrimitive ?: return false
        return p !is JsonNull && !p.isString && p.doubleOrNull?.isFinite() == true
    }

    /** Code de transfert → jardin brut (valeurs par défaut du modèle complétées). Lève `TransferException`. */
    fun decodeGardenJson(code: String?): JsonObject {
        var c = (code ?: "").replace(WS, "")
        if (PCT.containsMatchIn(c)) { try { c = decodeURIComponent(c) } catch (_: Exception) { /* garde tel quel */ } }
        val m = CODE_RE.matchEntire(c)
        if (m == null) {
            val t = CUT_RE.matchEntire(c)
            if (t != null) throw TransferException(tronque(t.groupValues[2].length, t.groupValues[1].toLongOrNull(36) ?: Long.MAX_VALUE))
            throw TransferException(ILLISIBLE)
        }
        val version = m.groupValues[1]
        if (version != "1" && version != "2") throw TransferException("Ce code vient d’une version plus récente de l’application : mettez Mon jardin à jour, puis réessayez.")
        val payload = m.groupValues[4]
        if (version == "2") {
            val attendu = m.groupValues[3].toLongOrNull(36) ?: throw TransferException(ILLISIBLE)
            if (payload.length.toLong() != attendu) throw TransferException(tronque(payload.length, attendu))
        }
        val data: JsonElement = try {
            var bytes = fromB64u(payload)
            if (m.groupValues[2].isEmpty()) bytes = inflateRaw(bytes)
            Json.parseToJsonElement(String(bytes, Charsets.UTF_8))
        } catch (_: Exception) { throw TransferException(ILLISIBLE) }
        val obj = data as? JsonObject
        val brut = obj?.get("garden") as? JsonObject
        if (obj == null || (obj["format"] as? JsonPrimitive)?.contentOrNull != "jardin-v1" || brut == null) throw TransferException("Code non reconnu : ce n’est pas un jardin Mon jardin.")
        val boundary = brut["boundary"] as? JsonArray
        val zones = brut["zones"]
        val okPoint = { p: JsonElement -> p is JsonObject && finiteNum(p["x"]) && finiteNum(p["y"]) }
        if (boundary == null || !(zones == null || zones is JsonNull || zones is JsonArray) || !boundary.all(okPoint)) throw TransferException("Jardin invalide : contour ou zones incorrects.")
        val nom = (brut["name"] as? JsonPrimitive)?.takeIf { it !is JsonNull && it.isString }?.content?.ifEmpty { null } ?: "Jardin importé"
        val base = JardinJson.json.encodeToJsonElement(Garden.serializer(), createGarden(nom)).jsonObject
        val g = LinkedHashMap(fusion(base, brut))
        g["context"] = fusion(base["context"] as JsonObject, brut["context"])
        g["sun"] = fusion(base["sun"] as JsonObject, brut["sun"])
        g["plan"] = fusion(base["plan"] as JsonObject, brut["plan"])
        return JsonObject(g)
    }

    /** Code de transfert → jardin (valeurs par défaut du modèle complétées). Lève `TransferException` en français. */
    fun decodeGarden(code: String?): Garden {
        val g = decodeGardenJson(code)
        return try { JardinJson.json.decodeFromJsonElement(Garden.serializer(), g) }
        catch (_: SerializationException) { throw TransferException("Jardin invalide : contour ou zones incorrects.") }
        catch (_: IllegalArgumentException) { throw TransferException("Jardin invalide : contour ou zones incorrects.") }
    }

    /** Lien web : `${base}#/import/${code}`. */
    fun buildShareLink(code: String, base: String?): String = "${(base ?: "").replace(Regex("#.*$"), "")}$HASH$code"

    /** Lien profond de l'application Android. */
    fun buildAppLink(code: String): String = SCHEME + code

    /** Extrait le code d'un lien https `#/import/…`, d'un lien `jardin://import/…` ou d'un code collé ; `null` sinon. */
    fun codeFromUrl(urlOrText: String?): String? {
        var s = (urlOrText ?: "").trim()
        val i = s.indexOf(HASH)
        val ic = RegexOption.IGNORE_CASE
        if (i >= 0) s = s.substring(i + HASH.length)
        else if (Regex("^jardin://import/", ic).containsMatchIn(s)) s = s.replace(Regex("^jardin://import/", ic), "")
        else if (Regex("^intent://import/", ic).containsMatchIn(s)) s = s.replace(Regex("^intent://import/", ic), "").replace(Regex("#Intent.*$", ic), "")
        s = s.replace(WS, "").replace(Regex("[?#].*$"), "")
        try { if (PCT.containsMatchIn(s)) s = decodeURIComponent(s) } catch (_: Exception) { /* garde tel quel */ }
        return if (VALID_CODE.matches(s)) s else null
    }

    /** Lien entrant (lien profond Android) → `#/import/<code>` ou `null`. */
    fun routeFromIncomingUrl(url: String?): String? {
        val s = url ?: ""
        if (!Regex("(^jardin://import/)|(^intent://import/)|#/import/", RegexOption.IGNORE_CASE).containsMatchIn(s.trim())) return null
        val code = codeFromUrl(s)
        return if (code != null) HASH + code else null
    }

    /** Résumé pour l'aperçu avant import (`items` = nombre d'obstacles, comme le web). */
    fun describeGarden(garden: Garden?): GardenDescription {
        val g = garden
        var area = 0.0
        try { if (g != null && g.boundary.size >= 3) area = polygonArea(g.boundary) } catch (_: Exception) { /* ignore */ }
        val zones = g?.zones ?: emptyList()
        val plants = zones.sumOf { z -> z.plantings.sumOf { p -> (p.count ?: 0).let { if (it == 0) 1 else it } } }
        return GardenDescription(g?.name?.ifEmpty { null } ?: "Jardin sans nom", area, zones.size, plants, g?.obstacles?.size ?: 0)
    }

    /** Taille d'un code ; `fitsQr` : le lien complet tiendra dans un QR code. */
    fun sizeInfo(code: String?): SizeInfo {
        val length = (code ?: "").length
        return SizeInfo(length, length + 80 <= QR_MAX_BYTES)
    }
}
