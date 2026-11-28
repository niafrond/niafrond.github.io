package fr.jardin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import fr.jardin.core.Garden
import fr.jardin.core.app.WishedStep
import fr.jardin.core.bedModeOf

/** Étape 3 « Zones souhaitées » : mode de création des massifs + liste de contrôle des types de zones. */
@Composable
fun WishedStepScreen(garden: Garden, onChange: ((Garden) -> Garden) -> Unit) {
    val auto = bedModeOf(garden) == "auto"
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Comment créer vos massifs ?", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Vous pourrez changer d’avis à tout moment, sans rien perdre.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                WishedStep.MODES.forEach { m ->
                    val on = auto == (m.id == "auto")
                    Surface(
                        onClick = { onChange { g -> WishedStep.setMode(g, m.id) } }, shape = RoundedCornerShape(12.dp),
                        color = if (on) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                        border = BorderStroke(if (on) 2.dp else 1.dp, if (on) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline),
                    ) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text(m.icon, fontSize = 26.sp)
                            Column { Text(m.title, fontWeight = FontWeight.SemiBold); Text(m.desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                }
            }
        }
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Que voulez-vous dans votre jardin ?", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Cochez les types de zones souhaités : ils serviront de liste de contrôle avant le rendu.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (auto) Notice(WishedStep.AUTO_NOTE)
                WishedStep.visibleTypes(garden).forEach { t ->
                    val checked = t.id in garden.wishedZoneTypes
                    Row(
                        Modifier.fillMaxWidth().clickable(role = Role.Checkbox) { onChange { g -> WishedStep.toggle(g, t.id, !checked) } },
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Checkbox(checked = checked, onCheckedChange = null)
                        Box(Modifier.size(30.dp).clip(RoundedCornerShape(8.dp)).background(hexColor(t.color)), contentAlignment = Alignment.Center) { Text(t.icon, fontSize = 16.sp) }
                        Text(t.label)
                    }
                }
                Text(WishedStep.countText(garden), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
