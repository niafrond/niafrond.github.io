package fr.jardin.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import fr.jardin.core.Garden
import fr.jardin.core.app.WizardState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** État de l'assistant pour un jardin : charge, applique les modifications, sauvegarde avec délai (comme le web). */
class WizardViewModel(app: Application, private val gardenId: String) : AndroidViewModel(app) {
    private val repo = AppContainer.get(app).gardens
    private val _state = MutableStateFlow<WizardState?>(null)
    val state: StateFlow<WizardState?> = _state
    private val _notFound = MutableStateFlow(false)
    val notFound: StateFlow<Boolean> = _notFound
    private val _saveStatus = MutableStateFlow("")
    val saveStatus: StateFlow<String> = _saveStatus
    private var saveJob: Job? = null
    private var dirty = false

    init {
        viewModelScope.launch {
            val g = withContext(Dispatchers.IO) { repo.load(gardenId) }
            if (g == null) _notFound.value = true else _state.value = WizardState(g)
        }
    }

    fun update(transform: (Garden) -> Garden) {
        val s = _state.value ?: return
        _state.value = s.withGarden(transform(s.garden))
        dirty = true
        _saveStatus.value = "Enregistrement…"
        saveJob?.cancel()
        saveJob = viewModelScope.launch {
            delay(SAVE_DELAY_MS)
            flush()
        }
    }

    fun goTo(id: String) { _state.value = _state.value?.goTo(id) }
    fun goNext() { _state.value = _state.value?.goNext() }
    fun goPrevious() { _state.value = _state.value?.goPrevious() }

    private suspend fun flush() {
        val g = _state.value?.garden ?: return
        if (!dirty) return
        dirty = false
        try {
            val saved = withContext(Dispatchers.IO) { repo.save(g) }
            // on garde `updatedAt` à jour sans écraser une modification survenue entre-temps
            _state.value = _state.value?.let { if (it.garden === g) it.withGarden(saved) else it }
            _saveStatus.value = "Enregistré ✓"
        } catch (e: Exception) {
            _saveStatus.value = "Échec de l’enregistrement"
        }
    }

    override fun onCleared() {
        // dernier enregistrement synchrone si une modification attend encore son délai
        val g = _state.value?.garden
        if (dirty && g != null) { try { repo.save(g) } catch (_: Exception) { } }
        super.onCleared()
    }

    class Factory(private val app: Application, private val id: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = WizardViewModel(app, id) as T
    }

    private companion object { const val SAVE_DELAY_MS = 400L }
}
