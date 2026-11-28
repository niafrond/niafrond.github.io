package fr.jardin.core.app

import fr.jardin.core.Garden
import fr.jardin.core.JardinJson
import fr.jardin.core.ensureAmenagements
import fr.jardin.core.newId
import fr.jardin.core.Plan
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit

/** Stockage des jardins (équivalent de `jardin/storage.js`). Appels synchrones : l'appelant choisit son thread. */
interface GardenRepository {
    /** Jardins triés du plus récemment modifié au plus ancien. */
    fun list(): List<Garden>
    fun load(id: String): Garden?
    /** Enregistre le jardin avec `updatedAt` mis à jour ; retourne le jardin enregistré. */
    fun save(g: Garden): Garden
    fun delete(id: String)
    /** Copie « variante » : nouvel id, brouillon, plan à régénérer. */
    fun duplicate(id: String): Garden?
}

/** Erreur d'import / de stockage, message en français. */
class StorageException(message: String) : Exception(message)

/** Implémentation par fichiers : un `<id>.json` par jardin (JSON identique à celui du web) dans [dir]. */
class FileGardenRepository(private val dir: File, private val clock: () -> String = { nowIsoMillis() }) : GardenRepository {
    init { dir.mkdirs() }

    private fun file(id: String): File {
        if (!ID_OK.matches(id)) throw StorageException("Identifiant de jardin invalide.")
        return File(dir, "$id.json")
    }

    override fun list(): List<Garden> =
        (dir.listFiles { f -> f.isFile && f.name.endsWith(".json") } ?: emptyArray())
            .mapNotNull { read(it) }
            .sortedByDescending { it.updatedAt }

    override fun load(id: String): Garden? = read(file(id))

    private fun read(f: File): Garden? {
        if (!f.isFile) return null
        return try { ensureAmenagements(JardinJson.decodeGarden(f.readText(Charsets.UTF_8))) } catch (_: Exception) { null }
    }

    override fun save(g: Garden): Garden {
        if (g.id.isEmpty()) throw StorageException("Jardin invalide : identifiant manquant.")
        val out = g.copy(updatedAt = clock())
        val target = file(out.id)
        val tmp = File(dir, "${out.id}.json.tmp")
        tmp.writeText(JardinJson.encodeGarden(out), Charsets.UTF_8)
        if (!tmp.renameTo(target)) { target.delete(); if (!tmp.renameTo(target)) throw StorageException("Échec de l’enregistrement.") }
        return out
    }

    override fun delete(id: String) { file(id).delete() }

    override fun duplicate(id: String): Garden? {
        val src = load(id) ?: return null
        val now = clock()
        val copy = src.copy(
            id = newId("g_"), name = "${src.name} (variante)", createdAt = now, updatedAt = now,
            status = "draft", plan = Plan(), tasksDone = kotlinx.serialization.json.JsonObject(emptyMap()),
        )
        return save(copy)
    }

    private companion object { val ID_OK = Regex("^[A-Za-z0-9_-]{1,64}$") }
}

internal fun nowIsoMillis(): String = Instant.now().truncatedTo(ChronoUnit.MILLIS).toString()
