package fr.jardin.app.photos

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import fr.jardin.core.Plant
import fr.jardin.core.photos.PHOTO_MAX_PARALLEL
import fr.jardin.core.photos.PhotoCache
import fr.jardin.core.photos.PhotoCacheEntry
import fr.jardin.core.photos.PhotoFetcher
import fr.jardin.core.photos.PlantPhoto
import fr.jardin.core.photos.PlantPhotos
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

/** Cache disque des entrées (un `<id>.json` par essence, TTL géré par le noyau). */
class FilePhotoCache(private val dir: File) : PhotoCache {
    init { dir.mkdirs() }
    private fun file(id: String) = File(dir, id.replace(Regex("[^A-Za-z0-9_-]"), "_") + ".json")
    override fun get(id: String): PhotoCacheEntry? = try { file(id).takeIf { it.exists() }?.readText()?.let { PlantPhotos.decodeEntry(it) } } catch (_: Exception) { null }
    override fun put(id: String, entry: PhotoCacheEntry) { try { file(id).writeText(PlantPhotos.encodeEntry(entry)) } catch (_: Exception) { /* cache indisponible */ } }
}

private const val UA = "JardinNatif/0.1 (application Android de jardinage)"

/** Récupération HTTP (HttpURLConnection) : corps si 200, sinon null. */
object HttpFetcher : PhotoFetcher {
    override fun get(url: String): String? = bytes(url, "application/json")?.toString(Charsets.UTF_8)

    fun bytes(url: String, accept: String = "*/*"): ByteArray? {
        var c: HttpURLConnection? = null
        return try {
            c = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000; readTimeout = 10000
                setRequestProperty("Accept", accept); setRequestProperty("User-Agent", UA)
            }
            if (c.responseCode != 200) null else c.inputStream.use { it.readBytes() }
        } catch (_: Exception) { null } finally { try { c?.disconnect() } catch (_: Exception) { } }
    }
}

/** Photos d'essences : métadonnées Wikipédia (cache disque, 3 requêtes en parallèle au plus) et images (cache disque). */
class PhotoRepo private constructor(ctx: Context) {
    private val dir = File(ctx.applicationContext.cacheDir, "photos").apply { mkdirs() }
    private val cache = FilePhotoCache(dir)
    private val gate = Semaphore(PHOTO_MAX_PARALLEL)
    private val memory = ConcurrentHashMap<String, Optional>()
    private val images = ConcurrentHashMap<String, ImageBitmap>()
    private class Optional(val photo: PlantPhoto?)

    suspend fun photo(plant: Plant): PlantPhoto? {
        memory[plant.id]?.let { return it.photo }
        val r = withContext(Dispatchers.IO) { gate.withPermit { PlantPhotos.getPlantPhoto(plant, HttpFetcher, cache) } }
        memory[plant.id] = Optional(r)
        return r
    }

    /** Image décodée (réduite à `maxSide` px), téléchargée une seule fois puis lue sur disque. */
    suspend fun image(url: String, maxSide: Int = 640): ImageBitmap? {
        val key = sha1(url) + "-$maxSide"
        images[key]?.let { return it }
        val bmp = withContext(Dispatchers.IO) {
            try {
                val f = File(dir, "img-${sha1(url)}")
                var data: ByteArray? = if (f.exists() && f.length() > 0) f.readBytes() else null
                if (data == null) {
                    data = gate.withPermit { HttpFetcher.bytes(url, "image/*") }
                    if (data != null) try { f.writeBytes(data) } catch (_: Exception) { }
                }
                if (data == null) null else {
                    val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeByteArray(data, 0, data.size, b)
                    var sample = 1
                    while (maxOf(b.outWidth, b.outHeight) / (sample * 2) >= maxSide) sample *= 2
                    BitmapFactory.decodeByteArray(data, 0, data.size, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
                }
            } catch (_: Exception) { null }
        }
        if (bmp != null) images[key] = bmp
        return bmp
    }

    private fun sha1(s: String) = MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    companion object {
        @Volatile private var inst: PhotoRepo? = null
        fun get(ctx: Context): PhotoRepo = inst ?: synchronized(this) { inst ?: PhotoRepo(ctx).also { inst = it } }
    }
}
