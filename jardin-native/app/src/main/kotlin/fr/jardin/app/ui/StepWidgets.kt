package fr.jardin.app.ui

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import fr.jardin.app.photos.PhotoRepo
import fr.jardin.core.Ambiances
import fr.jardin.core.Garden
import fr.jardin.core.Maintenance
import fr.jardin.core.Plant
import fr.jardin.core.Planting
import fr.jardin.core.Recommendation
import fr.jardin.core.Zone
import fr.jardin.core.app.PlantsStep
import fr.jardin.core.photos.PHOTO_CREDIT
import fr.jardin.core.photos.PlantPhoto

/** « #rrggbb » ou « #rgb » -> Color (repli si invalide). */
fun hexColor(s: String?, fallback: Color = Color(0xFF7FB069)): Color {
    val h = PlantsStep.hexOk(s)?.removePrefix("#") ?: return fallback
    val full = if (h.length == 3) h.map { "$it$it" }.joinToString("") else h
    return try { Color(0xFF000000L or full.toLong(16)) } catch (_: NumberFormatException) { fallback }
}

fun toast(ctx: android.content.Context, text: String) { Toast.makeText(ctx, text, Toast.LENGTH_SHORT).show() }

/** Pastille de couleur (fleurs / feuillage) avec son libellé. */
@Composable
fun ColorSwatch(hex: String, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(12.dp).clip(CircleShape).background(hexColor(hex)).then(Modifier))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun Swatches(p: Plant) {
    val fl = PlantsStep.hexOk(p.flowerColor); val fo = PlantsStep.hexOk(p.foliageColor)
    if (fl == null && fo == null) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (fl != null) ColorSwatch(fl, "Fleurs : ${PlantsStep.colorName(fl)}")
        if (fo != null) ColorSwatch(fo, "Feuillage : ${PlantsStep.colorName(fo)}")
    }
}

/** Photo Wikipédia d'une essence, chargée à la demande ; pastille de couleur + emoji de catégorie en repli immédiat. */
@Composable
fun PlantThumb(plant: Plant, size: Dp = 56.dp, big: Boolean = false, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, onPhoto: (PlantPhoto?) -> Unit = {}) {
    val ctx = LocalContext.current
    val repo = remember { PhotoRepo.get(ctx) }
    val photo by produceState<PlantPhoto?>(null, plant.id) { value = repo.photo(plant); onPhoto(value) }
    val bmp by produceState<ImageBitmap?>(null, photo) { value = photo?.let { repo.image(if (big) it.medium else it.url, if (big) 800 else 240) ?: if (big) repo.image(it.url, 320) else null } }
    val (a, b) = PlantsStep.thumbColors(plant)
    val m = modifier.size(size).clip(RoundedCornerShape(10.dp)).background(Brush.linearGradient(listOf(hexColor(a), hexColor(b))))
    Box(if (onClick != null) m.clickable(onClickLabel = "Agrandir la fiche de ${plant.commonName}") { onClick() } else m, contentAlignment = Alignment.Center) {
        val img = bmp
        if (img != null) Image(img, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
        else Text(PlantsStep.categoryEmoji(plant), fontSize = (size.value * 0.45f).sp)
    }
}

/** Légende de crédit sous la photo (visible une fois la photo trouvée). */
@Composable
fun PhotoCredit(plant: Plant, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    val repo = remember { PhotoRepo.get(ctx) }
    val photo by produceState<PlantPhoto?>(null, plant.id) { value = repo.photo(plant) }
    if (photo != null) Text(PHOTO_CREDIT, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier)
}

/** Fiche détail d'une essence : photo (crédit cliquable vers la page), couleurs, caractéristiques, raisons, entretien. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PlantDetailDialog(plant: Plant, planting: Planting?, rec: Recommendation?, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val repo = remember { PhotoRepo.get(ctx) }
    val uri = LocalUriHandler.current
    val photo by produceState<PlantPhoto?>(null, plant.id) { value = repo.photo(plant) }
    val bmp by produceState<ImageBitmap?>(null, photo) { value = photo?.let { repo.image(it.medium, 800) ?: repo.image(it.url, 320) } }
    Dialog(onDismissRequest = onClose) {
        androidx.compose.material3.Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surface) {
            Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                val (a, b) = PlantsStep.thumbColors(plant)
                Box(
                    Modifier.fillMaxWidth().heightIn(min = 120.dp, max = 260.dp).clip(RoundedCornerShape(12.dp))
                        .background(Brush.linearGradient(listOf(hexColor(a), hexColor(b)))),
                    contentAlignment = Alignment.Center,
                ) {
                    val img = bmp
                    if (img != null) Image(img, contentDescription = "Photo de ${plant.commonName}", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().heightIn(max = 260.dp))
                    else Text(PlantsStep.categoryEmoji(plant), fontSize = 48.sp)
                }
                photo?.let { ph ->
                    Text(
                        ph.credit, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { try { uri.openUri(ph.page) } catch (_: Exception) { } },
                    )
                }
                Text(plant.commonName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(plant.latinName, fontStyle = FontStyle.Italic, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Swatches(plant)
                Text(PlantsStep.detailLine(plant, planting), style = MaterialTheme.typography.bodySmall)
                if (rec != null) {
                    Text("Pourquoi ${PlantsStep.STATUS[rec.status]?.lowercase() ?: "cette note"} (${rec.score}/100)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    rec.reasons.forEach { Reason(it.ok, it.text) }
                }
                val care = PlantsStep.careRows(plant)
                if (care.isNotEmpty()) {
                    Text("Entretien", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    care.forEach { (k, v) -> Text("$k : $v", style = MaterialTheme.typography.bodySmall) }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { TextButton(onClick = onClose) { Text("Fermer") } }
            }
        }
    }
}

@Composable
fun Reason(ok: Boolean?, text: String) {
    val color = when (ok) { true -> Color(0xFF2E7D32); false -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.onSurface }
    Text((if (ok == true) "✔ " else if (ok == false) "✖ " else "• ") + text, style = MaterialTheme.typography.bodySmall, color = color)
}

/** Pastille sélectionnable. */
@Composable
fun Chip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    FilterChip(selected = selected, onClick = onClick, label = { Text(label) }, modifier = modifier)
}

/** Pastilles d'ambiance : « Peu importe » puis les 12 ambiances ; `value` null = peu importe. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AmbianceChips(value: String?, onPick: (String?) -> Unit, none: String = "Peu importe") {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Chip("∅ $none", value == null, { onPick(null) })
        Ambiances.AMBIANCES.forEach { a -> Chip("${a.emoji} ${a.label}", value == a.id, { onPick(a.id) }) }
    }
}

/** Pastilles du niveau d'entretien (main verte / peu / pas d'entretien) ; `inherit` ajoute « Comme le jardin ». */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MaintenanceChips(value: String?, onPick: (String?) -> Unit, inherit: Boolean = false, cards: Boolean = false) {
    if (cards) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Maintenance.MAINTENANCE_LEVELS.forEach { l ->
                val on = value == l.id
                androidx.compose.material3.Surface(
                    onClick = { onPick(l.id) }, shape = RoundedCornerShape(12.dp),
                    color = if (on) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, if (on) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline),
                ) {
                    Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(l.emoji, fontSize = 22.sp)
                        Column { Text(l.label, fontWeight = FontWeight.SemiBold); Text(l.desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }
        }
    } else {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (inherit) Chip("Comme le jardin", value == null, { onPick(null) })
            Maintenance.MAINTENANCE_LEVELS.forEach { l -> Chip("${l.emoji} ${l.label}", value == l.id, { onPick(l.id) }) }
        }
    }
}

/** Résultat de la fenêtre « Surprends-moi » : ambiance par zone + niveau d'entretien. */
class SurpriseChoice(val ambiances: Map<String, String?>, val maintenance: String)

/**
 * Fenêtre « Quelle ambiance pour cette zone ? » (une zone) ou « …pour chaque zone ? » (zone par zone ou « Même ambiance pour toutes »),
 * avec le rappel du niveau d'entretien (modifiable) : main verte / peu d'entretien / pas d'entretien.
 */
@Composable
fun SurpriseDialog(garden: Garden, zones: List<Zone>, onConfirm: (SurpriseChoice) -> Unit, onCancel: () -> Unit, title: String? = null, okLabel: String = "Valider", askMaintenance: Boolean = true) {
    val multi = zones.size > 1
    var vals by remember { mutableStateOf(zones.associate { it.id to PlantsStep.zoneAmbiance(it) }) }
    var maint by remember { mutableStateOf(Maintenance.levelForZone(garden, zones.singleOrNull())) }
    var sameOpen by remember { mutableStateOf(false) }
    var maintOpen by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(title ?: if (multi) "Quelle ambiance pour chaque zone ?" else "Quelle ambiance pour cette zone ?") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (!multi && zones.isNotEmpty()) Text(zones[0].label.ifEmpty { "Zone" }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                else Text("Choisissez l’ambiance de chaque zone, ou « Peu importe ». Vous pourrez la changer ensuite.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (askMaintenance) {
                    val l = Maintenance.getMaintenanceLevel(maint) ?: Maintenance.getMaintenanceLevel("green")!!
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Niveau d’entretien : ${l.emoji} ${l.label.lowercase()} — ", style = MaterialTheme.typography.bodySmall)
                        Text("changer", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall, modifier = Modifier.clickable { maintOpen = !maintOpen })
                    }
                    if (maintOpen) MaintenanceChips(maint, { maint = it ?: "green"; maintOpen = false })
                }
                if (multi) {
                    androidx.compose.material3.OutlinedButton(onClick = { sameOpen = !sameOpen }, modifier = Modifier.fillMaxWidth()) { Text("Même ambiance pour toutes") }
                    if (sameOpen) AmbianceChips(null, { id -> vals = zones.associate { it.id to id }; sameOpen = false })
                    zones.forEach { z ->
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(z.label.ifEmpty { "Zone" }, fontWeight = FontWeight.SemiBold)
                            AmbianceChips(vals[z.id], { id -> vals = vals + (z.id to id) })
                        }
                    }
                } else if (zones.isNotEmpty()) {
                    AmbianceChips(vals[zones[0].id], { id -> vals = vals + (zones[0].id to id) })
                    Ambiances.getAmbiance(vals[zones[0].id])?.let { Text(it.desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onConfirm(SurpriseChoice(vals, maint)) }) { Text(okLabel) } },
        dismissButton = { TextButton(onClick = onCancel) { Text("Annuler") } },
    )
}

/** Confirmation simple. */
@Composable
fun ConfirmDialog(message: String, okLabel: String = "Confirmer", onOk: () -> Unit, onCancel: () -> Unit) {
    AlertDialog(
        onDismissRequest = onCancel, text = { Text(message) },
        confirmButton = { TextButton(onClick = onOk) { Text(okLabel) } },
        dismissButton = { TextButton(onClick = onCancel) { Text("Annuler") } },
    )
}
