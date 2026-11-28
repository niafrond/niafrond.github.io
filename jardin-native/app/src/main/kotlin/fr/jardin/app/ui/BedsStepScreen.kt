package fr.jardin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import fr.jardin.app.plan.PlanCanvas
import fr.jardin.core.Ambiances
import fr.jardin.core.Garden
import fr.jardin.core.Point
import fr.jardin.core.PolygonShape
import fr.jardin.core.app.BedEntry
import fr.jardin.core.app.BedSettings
import fr.jardin.core.app.BedsDraft
import fr.jardin.core.app.BedsStep
import fr.jardin.core.app.BedsUndo
import fr.jardin.core.app.PlantsStep
import fr.jardin.core.bounds
import fr.jardin.core.plan.PlanView
import fr.jardin.core.Pricing
import fr.jardin.core.Catalog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Brouillons des massifs gardés en mémoire le temps de l'application (les zones « auto » reconstruisent les massifs validés). */
object StepSessions {
    val beds = HashMap<String, BedsDraft>()
    val undo = HashMap<String, BedsUndo>()
}

private val MONTH_NAMES = listOf("janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre")

/** Étape 7 « Massifs » : mode manuel (rien à calculer) ou automatique (propositions, réglages, verrouillage, validation). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BedsStepScreen(garden: Garden, onChange: ((Garden) -> Garden) -> Unit, goTo: (String) -> Unit) {
    if (!BedsStep.isAuto(garden)) {
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("🖌 Vos massifs sont dessinés à la main", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("Vous avez choisi de dessiner vous-même les zones de fleurs et de plantes à l’étape précédente. Rien à calculer ici.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("Envie d’un coup de main ? L’app peut calculer les meilleurs massifs dans les vides de votre jardin et choisir les plantes.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(onClick = { onChange { g -> BedsStep.setBedMode(g, "auto") } }, Modifier.fillMaxWidth()) { Text("✨ Laisser l’app calculer les massifs") }
                OutlinedButton(onClick = { goTo("plants") }, Modifier.fillMaxWidth()) { Text("Passer à l’étape suivante →") }
            }
        }
        return
    }
    BedsAuto(garden, onChange, goTo)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BedsAuto(garden: Garden, onChange: ((Garden) -> Garden) -> Unit, goTo: (String) -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var draft by remember(garden.id) { mutableStateOf(BedsStep.sync(garden, StepSessions.beds[garden.id] ?: BedsDraft())) }
    var undo by remember(garden.id) { mutableStateOf(StepSessions.undo[garden.id]) }
    var message by remember { mutableStateOf<Pair<String, String>?>(null) }
    var computing by remember { mutableStateOf(false) }
    var pickFor by remember { mutableStateOf<BedEntry?>(null) }
    // les modifications faites ailleurs (étape Zones) sont suivies
    LaunchedEffect(garden.zones) { draft = BedsStep.sync(garden, draft) }
    fun setDraft(d: BedsDraft) { draft = d; StepSessions.beds[garden.id] = d }
    fun setUndo(u: BedsUndo?) { undo = u; if (u == null) StepSessions.undo.remove(garden.id) else StepSessions.undo[garden.id] = u }

    fun compute(another: Boolean) {
        if (computing) return
        computing = true; message = null
        val g = garden; val d = draft
        scope.launch {
            val o = withContext(Dispatchers.Default) { BedsStep.compute(g, d, another) }
            setDraft(o.draft)
            message = o.message?.let { it to o.kind }
            computing = false
        }
    }

    val shown = draft.beds
    val hasContour = BedsStep.hasContour(garden)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("🌸 Massifs calculés par l’app", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("L’app place des massifs fleuris dans les vides du jardin et choisit pour chacun les meilleures plantes (floraison étalée, couleurs harmonieuses, adaptées au soleil).", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { onChange { g -> BedsStep.setBedMode(g, "manual") } }) { Text("🖌 Je préfère dessiner mes massifs") }
            }
        }

        BedsPlan(garden, draft)
        Text(BedsStep.legend(garden, draft), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

        SettingsPanel(garden, draft.settings, onSettings = { setDraft(BedsStep.setSettings(draft, it)) }, onMaintenance = { id -> onChange { g -> PlantsStep.setGardenMaintenance(g, id ?: "green") } })

        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { compute(false) }, enabled = !computing, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text("✨ Calculer les massifs") }
                if (shown.isNotEmpty()) OutlinedButton(onClick = { compute(true) }, enabled = !computing, modifier = Modifier.fillMaxWidth()) { Text("🎲 Autre proposition") }
                if (computing) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp); Text("Calcul des massifs…")
                }
                if (!hasContour && message == null) Notice(BedsStep.NO_CONTOUR, warn = true)
                message?.let { (t, k) -> Notice(t, warn = k == "warn") }
            }
        }

        if (shown.isNotEmpty() || undo != null) {
            if (shown.isNotEmpty()) {
                Text(BedsStep.totalLine(draft), fontWeight = FontWeight.SemiBold)
                Button(onClick = {
                    val (g2, d2, u) = BedsStep.validate(garden, draft)
                    onChange { g -> g.copy(zones = g2.zones) }
                    setDraft(d2); setUndo(u)
                    toast(ctx, BedsStep.validatedMessage(d2.beds.size))
                    goTo("plants")
                }, modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(if (BedsStep.allApplied(draft)) "✔ Revalider ces massifs" else "✔ Valider ces massifs") }
            }
            undo?.let { u ->
                OutlinedButton(onClick = {
                    val (g2, d2) = BedsStep.undoValidation(garden, u)
                    onChange { g -> g.copy(zones = g2.zones) }
                    setDraft(d2); setUndo(null)
                    toast(ctx, "Validation annulée : zones précédentes restaurées.")
                }, modifier = Modifier.fillMaxWidth()) { Text("↩ Annuler la dernière validation") }
            }
            shown.forEachIndexed { i, e ->
                BedCard(
                    e, i,
                    onLock = { setDraft(BedsStep.toggleLock(draft, e.bed.id)) },
                    onRemove = { setDraft(BedsStep.remove(draft, e.bed.id)); toast(ctx, "Massif retiré de la proposition.") },
                    onShuffle = { setDraft(BedsStep.reshuffle(garden, draft, e.bed.id)) },
                    onAmbiance = { pickFor = e },
                    onEdit = {
                        val (g2, d2) = BedsStep.editShape(garden, draft, e.bed.id)
                        onChange { g -> g.copy(zones = g2.zones) }
                        setDraft(d2)
                        toast(ctx, "Le massif est devenu une zone ordinaire : modifiez sa forme à l’étape Zones.")
                        goTo("zones")
                    },
                )
            }
        }
    }

    pickFor?.let { e ->
        val z = fr.jardin.core.Zone(id = e.bed.id, type = "midplants", label = BedsStep.nameOf(e, draft.beds.indexOf(e).coerceAtLeast(0)), ambiance = e.bed.ambiance)
        SurpriseDialog(
            garden, listOf(z), title = "Quelle ambiance pour ce massif ?", askMaintenance = false,
            onCancel = { pickFor = null },
            onConfirm = { c ->
                val id = c.ambiances[z.id]
                pickFor = null
                scope.launch {
                    val g = garden; val d = draft
                    val nd = withContext(Dispatchers.Default) { BedsStep.setAmbiance(g, d, e.bed.id, id) }
                    setDraft(nd)
                    val a = Ambiances.getAmbiance(id)
                    toast(ctx, if (a != null) "Ambiance « ${a.label} » : plantes redessinées pour ce massif." else "Ambiance retirée : plantes redessinées pour ce massif.")
                }
            },
        )
    }
}

/** Plan des massifs proposés : plan du jardin (sans massifs automatiques) + massifs numérotés aux couleurs des cartes. */
@Composable
private fun BedsPlan(garden: Garden, draft: BedsDraft) {
    val base = remember(garden) { garden.copy(zones = BedsStep.manualZones(garden)) }
    var view by remember { mutableStateOf(PlanView()) }
    var sized by remember { mutableStateOf(false) }
    var fitKey by remember { mutableStateOf<Any?>(null) }
    fun fit(v: PlanView) = if (garden.boundary.size >= 3) v.fit(bounds(garden.boundary), 1.2) else v
    Box(Modifier.fillMaxWidth().height(320.dp).clip(RoundedCornerShape(12.dp))) {
        PlanCanvas(
            view = view, onViewChange = { view = it }, garden = base, modifier = Modifier.fillMaxSize(),
            onSize = { w, h -> view = fit(view.withSize(w, h)); if (!sized) { sized = true; fitKey = garden.boundary } },
            description = "Plan des massifs proposés",
        )
        Canvas(Modifier.fillMaxSize()) {
            draft.beds.forEachIndexed { i, e ->
                val col = hexColor(BedsStep.bedColor(i))
                val pts = (e.bed.shape as? PolygonShape)?.points ?: return@forEachIndexed
                if (pts.size < 3) return@forEachIndexed
                val path = Path().apply {
                    pts.forEachIndexed { k, p -> val s = view.toScreen(p); if (k == 0) moveTo(s.x.toFloat(), s.y.toFloat()) else lineTo(s.x.toFloat(), s.y.toFloat()) }
                    close()
                }
                drawPath(path, col.copy(alpha = 0.62f))
                drawPath(path, col, style = Stroke(width = if (e.locked) 8f else 4f))
                val cx = pts.sumOf { it.x } / pts.size; val cy = pts.sumOf { it.y } / pts.size
                val c = view.toScreen(Point(cx, cy))
                drawCircle(Color.White.copy(alpha = 0.92f), 22f, Offset(c.x.toFloat(), c.y.toFloat()))
                drawCircle(col, 22f, Offset(c.x.toFloat(), c.y.toFloat()), style = Stroke(3f))
            }
        }
        // numéros (texte) : posés dans une couche Compose pour rester lisibles
        draft.beds.forEachIndexed { i, e ->
            val pts = (e.bed.shape as? PolygonShape)?.points ?: return@forEachIndexed
            if (pts.size < 3) return@forEachIndexed
            val c = view.toScreen(Point(pts.sumOf { it.x } / pts.size, pts.sumOf { it.y } / pts.size))
            val d = androidx.compose.ui.platform.LocalDensity.current
            with(d) { Box(Modifier.padding(start = (c.x.toFloat() - 22f).toDp(), top = (c.y.toFloat() - 22f).toDp()).size(44f.toDp()), contentAlignment = Alignment.Center) { Text("${i + 1}", fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Color(0xFF222222)) } }
        }
        Column(Modifier.align(Alignment.BottomEnd).padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            MiniBtn("＋") { view = view.zoomCenter(1.4) }; MiniBtn("－") { view = view.zoomCenter(1 / 1.4) }; MiniBtn("⤢") { view = fit(view) }
        }
    }
}

@Composable
private fun MiniBtn(t: String, onClick: () -> Unit) {
    androidx.compose.material3.Surface(onClick = onClick, shape = CircleShape, color = MaterialTheme.colorScheme.surface, shadowElevation = 3.dp, modifier = Modifier.size(40.dp)) {
        Box(contentAlignment = Alignment.Center) { Text(t, fontSize = 18.sp) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SettingsPanel(garden: Garden, s: BedSettings, onSettings: (BedSettings) -> Unit, onMaintenance: (String?) -> Unit) {
    var budgetText by remember { mutableStateOf(s.budget?.let { (if (it == Math.floor(it)) it.toLong().toString() else it.toString()) } ?: "") }
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Quelle part du vide remplir ?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Slider(value = s.coverage.toFloat(), onValueChange = { onSettings(s.copy(coverage = (Math.round(it / 5f) * 5).coerceIn(10, 100))) }, valueRange = 10f..100f, steps = 17, modifier = Modifier.weight(1f))
                Text("${s.coverage} %", Modifier.width(52.dp), textAlign = TextAlign.End)
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { BedsStep.COVERAGE_PRESETS.forEach { p -> Chip(p.label, s.coverage == p.value, { onSettings(s.copy(coverage = p.value)) }) } }
            Text("Style", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { BedsStep.STYLES.forEach { st -> Chip("${st.emoji} ${st.label}", s.style == st.id, { onSettings(s.copy(style = st.id)) }) } }
            Text("Palette de couleurs", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) { BedsStep.PALETTES.forEach { p -> Chip("● ${p.label}", s.palette == p.id, { onSettings(s.copy(palette = p.id)) }) } }
            Text("Ambiance globale", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            AmbianceChips(s.ambiance, { onSettings(s.copy(ambiance = it)) }, none = "Aucune")
            Text("Entretien du jardin", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            MaintenanceChips(fr.jardin.core.Maintenance.levelForZone(garden, null), onMaintenance, cards = false)
            OutlinedTextField(
                value = budgetText,
                onValueChange = { t -> budgetText = t; onSettings(s.copy(budget = PlantsStep.parseBudget(t))) },
                label = { Text("Budget max en € (facultatif)") }, placeholder = { Text("Sans limite") }, singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun BedCard(e: BedEntry, i: Int, onLock: () -> Unit, onRemove: () -> Unit, onShuffle: () -> Unit, onAmbiance: () -> Unit, onEdit: () -> Unit) {
    val b = e.bed
    val color = hexColor(BedsStep.bedColor(i))
    val months = BedsStep.bloomMonths(b)
    val cost = b.summary?.costEur
    val amb = Ambiances.getAmbiance(b.ambiance)
    var detail by remember { mutableStateOf<fr.jardin.core.Plant?>(null) }
    Card(
        Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(if (e.locked) 2.dp else 1.dp, if (e.locked) color else MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(color), contentAlignment = Alignment.Center) { Text("${i + 1}", color = Color.White, fontWeight = FontWeight.Bold) }
                Column(Modifier.weight(1f)) {
                    Text(BedsStep.nameOf(e, i), fontWeight = FontWeight.SemiBold)
                    Text(
                        "${BedsStep.fmt1(b.areaM2)} m²" + (if (b.widthM > 0) " · ${BedsStep.fmt1(b.widthM)} m de large" else "") + (b.sunLevel?.let { " · ${BedsStep.SUN_TEXT[it]}" } ?: ""),
                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (e.locked) Text("🔒")
            }
            if (b.why.isNotEmpty()) Text(b.why, style = MaterialTheme.typography.bodyMedium)
            b.plantsWhy?.takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            // mini-calendrier de floraison
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                BedsStep.MONTH_LETTERS.forEachIndexed { m, l ->
                    val on = (m + 1) in months
                    Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(3.dp)).background(if (on) color else MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)))
                        Text(l, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Text("Floraison : ${BedsStep.monthsText(months)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                BedsStep.flowerColors(b).forEach { Box(Modifier.size(14.dp).clip(CircleShape).background(hexColor(it))) }
                if (amb != null) Text("${amb.emoji} ${amb.label}", style = MaterialTheme.typography.bodySmall)
                val alt = BedsStep.altLabel(e); if (alt.isNotEmpty()) Text(alt, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (cost != null && cost.isFinite()) Text("≈ ${Pricing.formatEuro(cost, 0)}", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            }
            b.plantings.forEach { pl ->
                val p = Catalog.getPlant(pl.plantId)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (p != null) PlantThumb(p, 36.dp, onClick = { detail = p })
                    Text(p?.commonName ?: pl.plantId, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                    Text("× ${PlantsStep.countOf(pl)}", fontWeight = FontWeight.SemiBold)
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedButton(onClick = onLock) { Text(if (e.locked) "🔓 Libérer" else "🔒 Garder") }
                OutlinedButton(onClick = onShuffle) { Text("🎲 Autre combinaison") }
                OutlinedButton(onClick = onAmbiance) { Text("🎨 Ambiance") }
                OutlinedButton(onClick = onEdit) { Text("✏️ Modifier la forme") }
                TextButton(onClick = onRemove) { Text("🗑 Retirer", color = MaterialTheme.colorScheme.error) }
            }
        }
    }
    detail?.let { PlantDetailDialog(it, b.plantings.firstOrNull { pl -> pl.plantId == it.id }, null) { detail = null } }
}
