package fr.jardin.core.app

import fr.jardin.core.JardinJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import java.io.File

/** Réglages de notification (comme `defaultSettings().notifications` du web). */
@Serializable
data class NotificationSettings(
    val enabled: Boolean = false,
    val hour: Int = 19,
    val minute: Int = 0,
    val frost: Boolean = true,
    val heat: Boolean = true,
    val monthlyTasks: Boolean = true,
    val vacationUntil: String? = null,
)

/** Réglages de l'application (équivalent de `defaultSettings()` de `storage.js`). */
@Serializable
data class Settings(
    val notifications: NotificationSettings = NotificationSettings(),
    val units: String = "metric",
    val apiCache: JsonObject = JsonObject(emptyMap()),
)

interface SettingsStore {
    fun get(): Settings
    fun save(s: Settings): Settings
}

/** Réglages dans un fichier JSON ; fichier absent ou illisible = valeurs par défaut. */
class FileSettingsStore(private val file: File) : SettingsStore {
    override fun get(): Settings =
        try { if (file.isFile) JardinJson.json.decodeFromString(Settings.serializer(), file.readText(Charsets.UTF_8)) else Settings() }
        catch (_: Exception) { Settings() }

    override fun save(s: Settings): Settings {
        val ok = s.copy(
            notifications = s.notifications.copy(hour = s.notifications.hour.coerceIn(0, 23), minute = s.notifications.minute.coerceIn(0, 59)),
            units = if (s.units == "imperial") "imperial" else "metric",
        )
        file.parentFile?.mkdirs()
        file.writeText(JardinJson.json.encodeToString(Settings.serializer(), ok), Charsets.UTF_8)
        return ok
    }
}

/** Réglages en mémoire (tests, aperçus). */
class MemorySettingsStore(private var s: Settings = Settings()) : SettingsStore {
    override fun get() = s
    override fun save(s: Settings): Settings { this.s = s; return s }
}
