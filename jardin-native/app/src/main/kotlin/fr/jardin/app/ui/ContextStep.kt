package fr.jardin.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import fr.jardin.core.Garden
import fr.jardin.core.ORIENTATIONS
import fr.jardin.core.app.ContextForm

/** Étape 1 « Contexte » : nom, région / département, exposition du fond du jardin. */
@Composable
fun ContextStep(garden: Garden, onChange: ((Garden) -> Garden) -> Unit) {
    val c = garden.context
    val regionOptions = listOf(Choice(null, "Je ne sais pas")) + ContextForm.regions().map { Choice(it, it) }
    val depOptions = listOf(Choice(null, "Je ne sais pas")) +
        ContextForm.departementsOf(c.region).map { Choice(it.code, "${it.code} · ${it.name}") }
    val orientOptions = listOf(Choice(null, "Je ne sais pas")) +
        ORIENTATIONS.map { Choice(it.azimuth.toString(), "${it.label} (${it.id})") }
    val azimuth = ContextForm.azimuthOf(garden)

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        OutlinedTextField(
            value = garden.name,
            onValueChange = { v -> onChange { g -> ContextForm.withName(g, v) } },
            label = { Text("Nom du jardin") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        if (c.commune != null) Text("📍 ${c.commune}" + (c.region?.let { " · $it" } ?: ""))
        else if (c.region == null && c.departement == null && c.location == null) {
            Text(
                "Localisation non renseignée : les essences ne seront pas filtrées selon le climat.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        DropdownField("Région", c.region, regionOptions, onSelect = { v -> onChange { g -> ContextForm.withRegion(g, v) } })
        DropdownField("Département", c.departement, depOptions, onSelect = { v -> onChange { g -> ContextForm.withDepartement(g, v) } })
        ContextForm.hardinessText(garden)?.let { Text("❄️ $it") }

        Text(
            "Placez-vous dos à la maison, face au jardin : le fond du jardin est la direction à renseigner.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("Exposition du fond du jardin : ${ContextForm.orientationLabel(azimuth)}", style = MaterialTheme.typography.titleSmall)
        DropdownField(
            "Ou choisir à la main", azimuth?.takeIf { a -> ORIENTATIONS.any { it.azimuth == a } }?.toString(), orientOptions,
            onSelect = { v -> onChange { g -> ContextForm.withOrientation(g, v?.toInt()) } },
        )
    }
}
