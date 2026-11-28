package fr.jardin.core.app

import fr.jardin.core.Garden
import fr.jardin.core.JardinJson
import fr.jardin.core.Transfer
import fr.jardin.core.TransferException
import fr.jardin.core.ensureAmenagements
import fr.jardin.core.newId
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put

/** Import / export de jardins (fichier JSON `jardin-v1`, lien ou code de transfert). */
class GardenExchange(private val repo: GardenRepository, private val clock: () -> String = { nowIsoMillis() }) {

    /** Sérialise : `{"format":"jardin-v1","garden":{…}}` (les vues SVG régénérables sont omises). */
    fun exportJson(g: Garden): String {
        val slim = g.copy(plan = g.plan.copy(views = null))
        val obj = buildJsonObject {
            put("format", FORMAT)
            put("garden", JardinJson.json.encodeToJsonElement(Garden.serializer(), slim))
        }
        return JardinJson.json.encodeToString(JsonObject.serializer(), obj)
    }

    /** Importe un fichier JSON exporté : nouvel id, enregistré et retourné. Lève [StorageException] en français. */
    fun importJson(text: String): Garden {
        val data: JsonElement = try { if (!text.trimStart().startsWith("{")) throw IllegalArgumentException(); JardinJson.json.parseToJsonElement(text) }
        catch (_: Exception) { throw StorageException("Fichier illisible : ce n'est pas du JSON valide.") }
        val o = data as? JsonObject
        val fmt = (o?.get("format") as? JsonPrimitive)?.contentOrNull
        val raw = o?.get("garden") as? JsonObject
        if (fmt != FORMAT || raw == null) throw StorageException("Fichier non reconnu : format « jardin-v1 » attendu.")
        val g = try { JardinJson.json.decodeFromJsonElement(Garden.serializer(), raw) }
        catch (_: Exception) { throw StorageException("Jardin invalide : contour ou zones manquants.") }
        if (raw["boundary"] !is kotlinx.serialization.json.JsonArray) throw StorageException("Jardin invalide : contour ou zones manquants.")
        return adopt(g)
    }

    /** Importe un lien ou un code de transfert collé. Lève [StorageException] en français. */
    fun importCode(text: String): Garden {
        val code = Transfer.codeFromUrl(text)
            ?: throw StorageException("Rien de reconnu : collez le lien complet ou le code (il commence par « v1. »).")
        val g = try { Transfer.decodeGarden(code) } catch (e: TransferException) { throw StorageException(e.message ?: "Code illisible.") }
        return adopt(g)
    }

    /** Code de transfert pour le partage. */
    fun exportCode(g: Garden): String = Transfer.encodeGarden(g)

    private fun adopt(g: Garden): Garden {
        val now = clock()
        val base = g.copy(id = newId("g_"), name = g.name.ifBlank { "Jardin importé" }, createdAt = g.createdAt.ifEmpty { now })
        return repo.save(ensureAmenagements(base))
    }

    companion object { const val FORMAT = "jardin-v1" }
}
