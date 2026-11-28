package fr.jardin.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import fr.jardin.core.Garden
import fr.jardin.core.createGarden
import fr.jardin.core.app.StorageException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class HomeUiState(val gardens: List<Garden> = emptyList(), val loading: Boolean = true, val message: String? = null)

class HomeViewModel(app: Application) : AndroidViewModel(app) {
    private val container = AppContainer.get(app)
    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            val list = withContext(Dispatchers.IO) { container.gardens.list() }
            _state.value = _state.value.copy(gardens = list, loading = false)
        }
    }

    fun create(onCreated: (String) -> Unit) {
        viewModelScope.launch {
            val g = withContext(Dispatchers.IO) { container.gardens.save(createGarden()) }
            refresh()
            onCreated(g.id)
        }
    }

    fun delete(id: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { container.gardens.delete(id) }
            refresh()
        }
    }

    fun duplicate(id: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { container.gardens.duplicate(id) }
            _state.value = _state.value.copy(message = "Jardin dupliqué.")
            refresh()
        }
    }

    /** Importe un lien, un code de transfert ou un JSON collé. Retourne l'erreur (en français) via l'état. */
    fun import(text: String, onDone: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            val result: Result<Garden> = withContext(Dispatchers.IO) {
                try {
                    val t = text.trim()
                    Result.success(if (t.startsWith("{")) container.exchange.importJson(t) else container.exchange.importCode(t))
                } catch (e: StorageException) {
                    Result.failure(e)
                } catch (e: Exception) {
                    Result.failure(e)
                }
            }
            if (result.isSuccess) {
                _state.value = _state.value.copy(message = "Jardin importé.")
                refresh()
                onDone(true, null)
            } else {
                onDone(false, result.exceptionOrNull()?.message ?: "Import impossible.")
            }
        }
    }

    fun messageShown() { _state.value = _state.value.copy(message = null) }
}
