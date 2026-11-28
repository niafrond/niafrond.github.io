package fr.jardin.core.photos

import fr.jardin.core.JardinJson
import fr.jardin.core.Plant
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.net.URLEncoder

// Photos d'essences via l'API REST Wikipédia (port de jardin/photos.js, parties sans réseau).
// Le réseau (HttpURLConnection) et le stockage fichier sont fournis par l'application via `PhotoFetcher` / `PhotoCache`.

const val PHOTO_CREDIT = "Photo : Wikipédia"
const val PHOTO_OK_TTL_MS: Long = 30L * 24 * 3600 * 1000
const val PHOTO_KO_TTL_MS: Long = 24L * 3600 * 1000
const val PHOTO_MAX_PARALLEL = 3
const val PHOTO_API = "https://fr.wikipedia.org/api/rest_v1/page/summary/"

/** Photo d'une essence : `url` = vignette, `medium` = ≈ 640 px, `large` = originale. */
@Serializable
data class PlantPhoto(val url: String, val medium: String, val large: String, val credit: String = PHOTO_CREDIT, val page: String)

/** Entrée du cache : `data` null = échec mémorisé (réessai après `PHOTO_KO_TTL_MS`). */
@Serializable
data class PhotoCacheEntry(val t: Long, val data: PlantPhoto? = null)

/** Récupération d'une URL : corps de la réponse si HTTP 200, sinon null (ne lève jamais). */
fun interface PhotoFetcher { fun get(url: String): String? }

/** Cache clé/valeur (fichier côté application). */
interface PhotoCache {
    fun get(id: String): PhotoCacheEntry?
    fun put(id: String, entry: PhotoCacheEntry)
}

/** Cache mémoire (tests, repli). */
class MemoryPhotoCache : PhotoCache {
    private val map = HashMap<String, PhotoCacheEntry>()
    override fun get(id: String): PhotoCacheEntry? = synchronized(map) { map[id] }
    override fun put(id: String, entry: PhotoCacheEntry) { synchronized(map) { map[id] = entry } }
}

object PlantPhotos {
    /** Titres à essayer : page Wikipédia, puis nom latin (2 premiers mots), puis nom commun (sans doublon ni vide). */
    fun photoTitles(plant: Plant?): List<String> {
        val out = ArrayList<String>()
        fun add(t: String?) { val s = (t ?: "").trim(); if (s.isNotEmpty() && s !in out) out.add(s) }
        add(plant?.wiki)
        add((plant?.latinName ?: "").trim().split(Regex("\\s+")).take(2).joinToString(" "))
        add(plant?.commonName)
        return out
    }

    /** URL de l'API pour un titre (espaces -> « _ », encodage URL). */
    fun summaryUrl(title: String): String = PHOTO_API + URLEncoder.encode(title.replace(' ', '_'), "UTF-8").replace("+", "%20")

    private fun pageUrl(title: String): String = "https://fr.wikipedia.org/wiki/" + URLEncoder.encode(title.replace(' ', '_'), "UTF-8").replace("+", "%20")

    private val SIZE = Regex("/(\\d+)px-")

    /** Analyse du JSON `page/summary` : null si homonymie, sans image ou illisible. */
    fun parseSummary(json: String?, title: String): PlantPhoto? {
        if (json.isNullOrBlank()) return null
        return try {
            val j = Json.parseToJsonElement(json) as? JsonObject ?: return null
            if (j["type"]?.jsonPrimitive?.contentOrNull == "disambiguation") return null
            val url = (j["thumbnail"] as? JsonObject)?.get("source")?.let { it as? JsonPrimitive }?.takeIf { it.isString }?.content
            if (url.isNullOrEmpty()) return null
            val page = (((j["content_urls"] as? JsonObject)?.get("desktop") as? JsonObject)?.get("page") as? JsonPrimitive)?.contentOrNull
                ?.takeIf { it.isNotEmpty() } ?: pageUrl(title)
            val large = ((j["originalimage"] as? JsonObject)?.get("source") as? JsonPrimitive)?.takeIf { it.isString }?.content
            PlantPhoto(url, SIZE.replaceFirst(url, "/640px-"), large ?: url, PHOTO_CREDIT, page)
        } catch (_: Exception) { null }
    }

    /** Une entrée est fraîche pendant 30 jours (succès) ou 1 jour (échec). */
    fun isFresh(e: PhotoCacheEntry?, now: Long): Boolean =
        e != null && now - e.t >= 0 && now - e.t < (if (e.data != null) PHOTO_OK_TTL_MS else PHOTO_KO_TTL_MS)

    /**
     * Photo d'une essence (null si aucune). Ne lève jamais. Utilise le cache s'il est frais, sinon essaie les titres dans l'ordre
     * et mémorise le résultat (y compris l'échec).
     */
    fun getPlantPhoto(plant: Plant?, fetcher: PhotoFetcher, cache: PhotoCache, now: Long = System.currentTimeMillis()): PlantPhoto? {
        return try {
            if (plant == null || plant.id.isEmpty()) return null
            val hit = try { cache.get(plant.id) } catch (_: Exception) { null }
            if (isFresh(hit, now)) return hit!!.data
            var data: PlantPhoto? = null
            for (t in photoTitles(plant)) {
                data = try { parseSummary(fetcher.get(summaryUrl(t)), t) } catch (_: Exception) { null }
                if (data != null) break
            }
            try { cache.put(plant.id, PhotoCacheEntry(now, data)) } catch (_: Exception) { /* cache indisponible */ }
            data
        } catch (_: Exception) { null }
    }

    /** Sérialisation d'une entrée (fichier de cache). */
    fun encodeEntry(e: PhotoCacheEntry): String = JardinJson.json.encodeToString(PhotoCacheEntry.serializer(), e)
    fun decodeEntry(s: String): PhotoCacheEntry? = try { JardinJson.json.decodeFromString(PhotoCacheEntry.serializer(), s) } catch (_: Exception) { null }
}
