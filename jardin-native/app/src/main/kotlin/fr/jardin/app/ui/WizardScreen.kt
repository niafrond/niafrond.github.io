package fr.jardin.app.ui

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.activity.compose.BackHandler
import androidx.lifecycle.viewmodel.compose.viewModel
import fr.jardin.app.WizardViewModel
import fr.jardin.app.plan.BoundaryController
import fr.jardin.core.app.WizardState
import fr.jardin.core.plan.ContourState
import fr.jardin.core.app.WizardSteps

@Composable
fun WizardScreen(gardenId: String, onBack: () -> Unit) {
    val app = LocalContext.current.applicationContext as Application
    val vm: WizardViewModel = viewModel(key = "wizard-$gardenId", factory = WizardViewModel.Factory(app, gardenId))
    val state by vm.state.collectAsState()
    val notFound by vm.notFound.collectAsState()
    val saveStatus by vm.saveStatus.collectAsState()
    val s = state

    if (notFound) {
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Jardin introuvable.", style = MaterialTheme.typography.titleMedium)
            OutlinedButton(onClick = onBack) { Text("← Retour à l’accueil") }
        }
        return
    }
    if (s == null) {
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(24.dp)) { Text("Chargement…") }
        return
    }

    val boundary = remember(gardenId) {
        BoundaryController(ContourState(s.garden.boundary, s.garden.boundaryClosed)) { st ->
            vm.update { g -> g.copy(boundary = st.points, boundaryClosed = st.isClosed) }
        }
    }
    // atelier plein écran de l'étape Terrain : le plan prend tout l'écran, barre du bas fixe
    if (s.stepId == "boundary" && boundary.fullscreen) {
        BoundaryWorkshop(s.garden, boundary, onChange = vm::update)
        return
    }

    // « Précédent » du système : étape précédente, puis accueil depuis la première étape.
    BackHandler(enabled = s.previous != null) { vm.goPrevious() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { WizardHeader(s, saveStatus, onBack = onBack, onSelect = vm::goTo) },
        bottomBar = { WizardNav(s, onPrevious = vm::goPrevious, onNext = vm::goNext) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(s.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            s.notes.forEach { Notice(it.message, warn = true) }
            when (s.stepId) {
                "context" -> ContextStep(s.garden, onChange = vm::update)
                "boundary" -> BoundaryStep(s.garden, boundary, onChange = vm::update)
                else -> ComingSoonStep(s.step.label)
            }
        }
    }
}

@Composable
private fun WizardHeader(s: WizardState, saveStatus: String, onBack: () -> Unit, onSelect: (String) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onBack) { Text("←") }
                Text(
                    s.garden.name.ifBlank { "Jardin sans nom" }, Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold,
                )
                Text(saveStatus, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            SegmentedProgress(s, onSelect)
            StepPicker(s, onSelect)
        }
    }
}

/** Barre de progression : un segment par étape, cliquable (étape courante pleine, étapes passées teintées). */
@Composable
private fun SegmentedProgress(s: WizardState, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        WizardSteps.all.forEachIndexed { i, step ->
            val color = when {
                i == s.index -> MaterialTheme.colorScheme.primary
                i < s.index -> MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)
                else -> MaterialTheme.colorScheme.outline
            }
            Box(
                Modifier.weight(1f).height(28.dp).clickable { onSelect(step.id) },
                contentAlignment = androidx.compose.ui.Alignment.Center,
            ) {
                Box(Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(color))
            }
        }
    }
}

/** Sélecteur d'étape : liste des 9 étapes avec leur numéro et leur icône. */
@Composable
private fun StepPicker(s: WizardState, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
            Text("${s.step.icon}  ${s.title}  ▾")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            WizardSteps.all.forEachIndexed { i, step ->
                DropdownMenuItem(
                    text = { Text("${step.icon}  ${i + 1}/${WizardSteps.all.size} · ${step.label}", fontWeight = if (i == s.index) FontWeight.Bold else FontWeight.Normal) },
                    onClick = { open = false; onSelect(step.id) },
                )
            }
        }
    }
}

/** Boutons Précédent / Suivant fixes en bas (libellés = nom de l'étape voisine, comme le web). */
@Composable
private fun WizardNav(s: WizardState, onPrevious: () -> Unit, onNext: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background, tonalElevation = 2.dp) {
        Row(
            Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val prev = s.previous
            val next = s.next
            if (prev != null) {
                OutlinedButton(onClick = onPrevious, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Text("← " + prev.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            } else Box(Modifier.weight(1f))
            if (next != null) {
                Button(onClick = onNext, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Text(next.label + " →", maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            } else Box(Modifier.weight(1f))
        }
    }
}

@Composable
private fun ComingSoonStep(label: String) {
    Notice("Cette étape n’est pas encore disponible.\n« $label » arrive dans une prochaine version de l’application.")
}
