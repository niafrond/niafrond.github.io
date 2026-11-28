package fr.jardin.app

import android.content.Context
import fr.jardin.core.app.FileGardenRepository
import fr.jardin.core.app.FileSettingsStore
import fr.jardin.core.app.GardenExchange
import fr.jardin.core.app.GardenRepository
import fr.jardin.core.app.SettingsStore
import java.io.File

/** Dépendances de l'application (stockage interne), créées à la demande. */
class AppContainer(context: Context) {
    private val root: File = context.applicationContext.filesDir
    val gardens: GardenRepository by lazy { FileGardenRepository(File(root, "gardens")) }
    val exchange: GardenExchange by lazy { GardenExchange(gardens) }
    val settings: SettingsStore by lazy { FileSettingsStore(File(root, "settings.json")) }

    companion object {
        @Volatile private var instance: AppContainer? = null
        fun get(context: Context): AppContainer =
            instance ?: synchronized(this) { instance ?: AppContainer(context).also { instance = it } }
    }
}
