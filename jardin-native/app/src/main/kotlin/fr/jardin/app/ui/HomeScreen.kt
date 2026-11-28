package fr.jardin.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import android.app.Application
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import fr.jardin.app.HomeViewModel
import fr.jardin.core.Garden
import fr.jardin.core.app.HomeModel

private class HomeFactory(private val app: Application) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = HomeViewModel(app) as T
}

@Composable
fun HomeScreen(onOpen: (String) -> Unit) {
    val app = LocalContext.current.applicationContext as Application
    val vm: HomeViewModel = viewModel(factory = HomeFactory(app))
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    var toDelete by remember { mutableStateOf<Garden?>(null) }
    var importing by remember { mutableStateOf(false) }

    LaunchedEffect(state.message) {
        val m = state.message
        if (m != null) { snackbar.showSnackbar(m); vm.messageShown() }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 12.dp)) {
                Text("🌱 Mon jardin", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = { vm.create(onOpen) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                Text("＋ Nouveau jardin")
            }
            OutlinedButton(onClick = { importing = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                Text("📲 Importer un lien ou un code")
            }
            if (!state.loading && state.gardens.isEmpty()) {
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(HomeModel.EMPTY_TITLE, style = MaterialTheme.typography.titleMedium)
                        Text(HomeModel.EMPTY_HELP, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
                items(state.gardens, key = { it.id }) { g ->
                    GardenCard(g, onOpen = { onOpen(g.id) }, onDuplicate = { vm.duplicate(g.id) }, onDelete = { toDelete = g })
                }
            }
        }
    }

    toDelete?.let { g ->
        AlertDialog(
            onDismissRequest = { toDelete = null },
            text = { Text(HomeModel.confirmDelete(g)) },
            confirmButton = {
                TextButton(onClick = { vm.delete(g.id); toDelete = null }) {
                    Text("Supprimer", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { toDelete = null }) { Text("Annuler") } },
        )
    }

    if (importing) {
        ImportDialog(onDismiss = { importing = false }, onImport = { text, done -> vm.import(text) { ok, err -> if (ok) importing = false; done(err) } })
    }
}

@Composable
private fun GardenCard(g: Garden, onOpen: () -> Unit, onDuplicate: () -> Unit, onDelete: () -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column {
            Row(Modifier.fillMaxWidth().clickable(onClick = onOpen).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("🌳", style = MaterialTheme.typography.headlineMedium)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(HomeModel.title(g), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(HomeModel.subtitle(g), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    Text(HomeModel.badge(g), color = if (g.status == "validated") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDuplicate) { Text("Dupliquer") }
                TextButton(onClick = onDelete, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) { Text("Supprimer") }
            }
        }
    }
}

@Composable
private fun ImportDialog(onDismiss: () -> Unit, onImport: (String, (String?) -> Unit) -> Unit) {
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Importer un lien ou un code") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Collez un lien « Continuer sur mon téléphone » ou un code de transfert.")
                OutlinedTextField(
                    value = text, onValueChange = { text = it; error = null }, minLines = 3, maxLines = 6,
                    placeholder = { Text("Collez ici le lien ou le code reçu") }, modifier = Modifier.fillMaxWidth(), isError = error != null,
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
            }
        },
        confirmButton = { TextButton(onClick = { onImport(text) { err -> error = err } }) { Text("Continuer") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annuler") } },
    )
}
