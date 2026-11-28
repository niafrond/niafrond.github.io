package fr.jardin.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.activity.compose.BackHandler
import fr.jardin.app.plan.BoundaryController
import fr.jardin.app.plan.BoundaryPop
import fr.jardin.app.plan.PlanCanvas
import fr.jardin.app.plan.PlanNorth
import fr.jardin.app.plan.PlanOverlay
import fr.jardin.app.plan.NorthBadge
import fr.jardin.core.Garden
import fr.jardin.core.plan.ContourEdit
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.NorthIndicator

/** Rangée d'outils compacte : cible tactile >= 44 dp. */
@Composable
private fun TBtn(label: String, onClick: () -> Unit, enabled: Boolean = true, active: Boolean = false, description: String? = null) {
    val mod = Modifier.heightIn(min = 44.dp)
    val pad = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
    if (active) FilledTonalButton(onClick, mod, enabled = enabled, contentPadding = pad, shape = RoundedCornerShape(12.dp)) { Text(label, maxLines = 1) }
    else OutlinedButton(onClick, mod, enabled = enabled, contentPadding = pad, shape = RoundedCornerShape(12.dp)) { Text(label, maxLines = 1) }
    @Suppress("UNUSED_EXPRESSION") description
}

@Composable
private fun ToolButtons(c: BoundaryController, withZoom: Boolean = false) {
    TBtn("↶", c::undo, enabled = c.canUndo)
    TBtn("↷", c::redo, enabled = c.canRedo)
    TBtn(if (c.state.isClosed) "🔓 Rouvrir" else "🔒 Fermer", c::toggleClose, enabled = c.state.isClosed || c.state.n >= 3)
    TBtn("🗑 Sommet", c::deleteSelected, enabled = c.sel != null)
    TBtn(c.grid?.let { "▦ ${LengthInput.fr(it, 1)} m" } ?: "▦ off", c::cycleGrid)
    TBtn("⊾ Équerre", c::toggleOrtho, active = c.ortho)
    TBtn("🧲", c::toggleMagnet, active = c.magnet)
    TBtn("▭ Dimensions", c::askRect)
    TBtn("🧹 Effacer", c::askClear, enabled = c.state.n > 0)
    if (withZoom) { TBtn("－", { c.zoom(1 / 1.4) }); TBtn("＋", { c.zoom(1.4) }); TBtn("⤢", c::fitView) }
}

/** Surface / périmètre / sommets, avertissements (texte du web). */
@Composable
private fun InfoLine(c: BoundaryController, modifier: Modifier = Modifier) {
    val s = c.state
    val closedTxt = if (!s.isClosed && s.n >= 3) " (si fermé)" else ""
    val parts = buildList {
        add("Surface ${if (s.n >= 3) LengthInput.fr(s.area) else "0,00"} m²$closedTxt")
        add("Périmètre ${LengthInput.fr(s.perimeterM)} m")
        add("${s.n} sommet${if (s.n > 1) "s" else ""}${if (s.isClosed) " · fermé" else ""}")
    }
    Column(modifier) {
        Text(parts.joinToString("  ·  "), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        if (!s.isSimple) Text("⚠ contour croisé", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (s.n >= 3 && s.isClosed && s.area <= 1) Text("⚠ surface ≤ 1 m²", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun MessageLine(c: BoundaryController, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE) {
    val color = when (c.msgKind) { "err" -> MaterialTheme.colorScheme.error; "warn" -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.onSurfaceVariant }
    Text(c.helpText, modifier, color = color, style = MaterialTheme.typography.bodySmall, maxLines = maxLines, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
}

/** Démarrage guidé (plan vide) et assistant de fermeture. */
@Composable
private fun Panels(c: BoundaryController, modifier: Modifier = Modifier) {
    val gap = c.closePrompt
    if (c.state.n == 0) {
        Notice("Comment voulez-vous commencer ?", modifier = modifier)
        Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(c::askRect, Modifier.weight(1f).heightIn(min = 44.dp), shape = RoundedCornerShape(12.dp)) { Text("▭ Je connais les dimensions") }
            OutlinedButton({ c.hint("Touchez le plan pour poser chaque angle du terrain.") }, Modifier.weight(1f).heightIn(min = 44.dp), shape = RoundedCornerShape(12.dp)) { Text("✏️ Je dessine au doigt") }
        }
    }
    if (gap != null) {
        Notice("Écart de fermeture : ${LengthInput.frLen(gap)}. Le dernier point doit-il se confondre avec le premier ? Dans ce cas l'écart est réparti sur les côtés.", warn = true, modifier = modifier)
        @OptIn(ExperimentalLayoutApi::class)
        FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(c::closeWithGap, Modifier.heightIn(min = 44.dp), shape = RoundedCornerShape(12.dp)) { Text("Répartir l'écart et fermer") }
            OutlinedButton(c::closeAsIs, Modifier.heightIn(min = 44.dp), shape = RoundedCornerShape(12.dp)) { Text("Fermer tel quel") }
            TextButton(c::cancelClosePrompt, Modifier.heightIn(min = 44.dp)) { Text("Annuler") }
        }
    }
}

@Composable
private fun BoundaryPlan(c: BoundaryController, garden: Garden, modifier: Modifier, topInset: androidx.compose.ui.unit.Dp = 0.dp) {
    val density = LocalDensity.current
    c.density = density.density
    c.topInsetPx = with(density) { topInset.toPx() }.toDouble()
    c.extraPoints = remember(garden.obstacles) { garden.obstacles.flatMap { o -> o.points ?: listOfNotNull(o.center) } }
    val ctx = garden.context
    PlanCanvas(
        view = c.view, onViewChange = c::changeView, garden = garden, modifier = modifier,
        overlay = PlanOverlay(contour = c.state, editable = true, selectedVertex = c.sel, selectedSide = c.selSide, grid = c.grid),
        north = PlanNorth(
            angle = ctx.northAngle, known = NorthIndicator.known(ctx.orientation, ctx.northAngle),
            onClick = c::openNorth,
        ),
        topInset = topInset,
        onDown = c::onDown, onTap = c::onTap, onLong = c::onLong, onSize = c::onSize,
        description = "Plan du terrain : touchez pour poser les sommets du contour",
    )
}

/** Étape « Terrain » dans la page de l'assistant : plan de hauteur bornée (la page défile toujours jusqu'aux boutons du bas). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BoundaryStep(garden: Garden, c: BoundaryController, onChange: ((Garden) -> Garden) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        InfoLine(c)
        Panels(c)
        Box(Modifier.fillMaxWidth().height(380.dp)) {
            BoundaryPlan(c, garden, Modifier.fillMaxSize())
            Column(Modifier.align(Alignment.BottomEnd).padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                TBtn("＋", { c.zoom(1.4) }); TBtn("－", { c.zoom(1 / 1.4) }); TBtn("⤢", c::fitView)
            }
        }
        MessageLine(c)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { ToolButtons(c) }
        Button(c::toggleFullscreen, Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(12.dp)) { Text("⤢ Plan en plein écran") }
    }
    BoundaryDialogs(garden, c, onChange)
}

/**
 * Atelier plein écran : le plan occupe tout l'espace restant, outils en une rangée défilante superposée en haut,
 * barre du bas FIXE (Annuler, Rétablir, Fermer la forme, OK) hors du plan : rien ne peut empêcher de l'atteindre.
 */
@Composable
fun BoundaryWorkshop(garden: Garden, c: BoundaryController, onChange: ((Garden) -> Garden) -> Unit) {
    BackHandler { c.toggleFullscreen() }
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            BoundaryPlan(c, garden, Modifier.fillMaxSize(), topInset = 64.dp)
            Row(
                Modifier.align(Alignment.TopStart).fillMaxWidth().statusBarsPadding().padding(horizontal = 8.dp, vertical = 6.dp)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) { ToolButtons(c, withZoom = true) }
            Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Panels(c)
            }
        }
        Surface(color = MaterialTheme.colorScheme.background, tonalElevation = 3.dp) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                InfoLine(c)
                MessageLine(c, maxLines = 2)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    val shape = RoundedCornerShape(12.dp)
                    val m = Modifier.weight(1f).heightIn(min = 48.dp)
                    val pad = PaddingValues(horizontal = 4.dp)
                    OutlinedButton(c::undo, m, enabled = c.canUndo, shape = shape, contentPadding = pad) { Text("Annuler", maxLines = 1) }
                    OutlinedButton(c::redo, m, enabled = c.canRedo, shape = shape, contentPadding = pad) { Text("Rétablir", maxLines = 1) }
                    OutlinedButton(c::toggleClose, m, enabled = c.state.isClosed || c.state.n >= 3, shape = shape, contentPadding = pad) {
                        Text(if (c.state.isClosed) "Rouvrir" else "Fermer la forme", maxLines = 1)
                    }
                    Button(c::toggleFullscreen, m, shape = shape, contentPadding = pad) { Text("OK", maxLines = 1) }
                }
            }
        }
    }
    BoundaryDialogs(garden, c, onChange)
}

// ------------------------------------------------------------------ fenêtres

private class LenField(val key: String, val label: String, val value: String)

/**
 * Fenêtre de saisie en cm (« 350 » = 3,50 m ; « 3,5 m » accepté), boutons −10 / +10 cm ; `onOk` reçoit les valeurs en m.
 */
@Composable
private fun LengthDialog(
    title: String, fields: List<LenField>, hint: String? = null, okLabel: String = "Valider",
    onDismiss: () -> Unit, onOk: (Map<String, Double>) -> Unit,
    actions: List<Pair<String, () -> Unit>> = emptyList(), extra: @Composable () -> Unit = {},
) {
    val values = remember { fields.associate { it.key to mutableStateOf(TextFieldValue(it.value, TextRange(0, it.value.length))) } }
    var error by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    fun commit() {
        val out = HashMap<String, Double>()
        for (f in fields) {
            val v = LengthInput.parseLength(values.getValue(f.key).value.text)
            if (v == null) { error = true; return }
            out[f.key] = v
        }
        onOk(out); onDismiss()
    }
    LaunchedEffect(Unit) { if (fields.isNotEmpty()) try { focus.requestFocus() } catch (_: Exception) { } }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) },
        text = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                fields.forEachIndexed { idx, f ->
                    val st = values.getValue(f.key)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        fun step(d: Double) {
                            val v = LengthInput.parseLength(st.value.text) ?: 0.0
                            val t = LengthInput.toCm(maxOf(0.01, v + d)); st.value = TextFieldValue(t, TextRange(0, t.length)); error = false
                        }
                        OutlinedButton({ step(-0.1) }, Modifier.heightIn(min = 44.dp), contentPadding = PaddingValues(horizontal = 8.dp)) { Text("−10") }
                        OutlinedTextField(
                            value = st.value, onValueChange = { st.value = it; error = false },
                            label = { Text(f.label) }, singleLine = true, isError = error,
                            suffix = { Text("cm") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
                            keyboardActions = KeyboardActions(onDone = { commit() }),
                            modifier = Modifier.weight(1f).let { if (idx == 0) it.focusRequester(focus) else it },
                        )
                        OutlinedButton({ step(0.1) }, Modifier.heightIn(min = 44.dp), contentPadding = PaddingValues(horizontal = 8.dp)) { Text("+10") }
                    }
                }
                extra()
                if (error) Text(ContourEdit.MSG_BAD_LENGTH, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                if (hint != null) Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                actions.forEach { (label, fn) ->
                    TextButton(fn, Modifier.heightIn(min = 44.dp)) { Text(label, color = MaterialTheme.colorScheme.error) }
                }
            }
        },
        confirmButton = { Button(::commit, Modifier.heightIn(min = 44.dp)) { Text(okLabel) } },
        dismissButton = { TextButton(onDismiss, Modifier.heightIn(min = 44.dp)) { Text("Annuler") } },
    )
}

@Composable
private fun BoundaryDialogs(garden: Garden, c: BoundaryController, onChange: ((Garden) -> Garden) -> Unit) {
    when (val p = c.pop) {
        null -> {}
        is BoundaryPop.Side -> {
            if (p.index in 0 until c.state.sideCount) LengthDialog(
                title = c.sideTitle(p.index),
                fields = listOf(LenField("len", "Longueur", LengthInput.toCm(fr.jardin.core.plan.ContourEdit.sideLength(c.state, p.index)))),
                hint = "Tapez en centimètres : 350 = 3,50 m. Les sommets suivants se décalent.",
                onDismiss = c::closePop, onOk = { c.applySideLength(p.index, it.getValue("len")) },
            ) else c.closePop()
        }
        is BoundaryPop.Vertex -> {
            val pt = c.state.points.getOrNull(p.index)
            if (pt == null) c.closePop() else LengthDialog(
                title = "Sommet ${p.index + 1}", fields = emptyList(),
                hint = "Position : ${LengthInput.fr(pt.x)} m ; ${LengthInput.fr(pt.y)} m. Glissez le sommet pour le déplacer.",
                okLabel = "Fermer", onDismiss = c::closePop, onOk = {},
                actions = listOf("🗑 Supprimer" to { c.closePop(); c.deleteVertex(p.index) }),
            )
        }
        is BoundaryPop.Rect -> LengthDialog(
            title = "Terrain rectangulaire",
            fields = listOf(LenField("w", "Largeur", ""), LenField("l", "Longueur", "")),
            hint = "Tapez les dimensions en centimètres (1000 = 10 m). Vous pourrez ensuite ajuster chaque côté.",
            okLabel = "Créer le rectangle", onDismiss = c::closePop,
            onOk = { c.createRect(p.origin, it.getValue("w"), it.getValue("l")) },
        )
        is BoundaryPop.Next -> {
            var dir by remember { mutableStateOf(p.dir) }
            LengthDialog(
                title = "Côté suivant depuis le sommet ${c.state.n}",
                fields = listOf(LenField("len", "Longueur", "")),
                hint = "Haut du plan = ↑. Tapez la longueur en cm (500 = 5 m).",
                okLabel = "Ajouter le côté", onDismiss = c::closePop,
                onOk = { c.addSegment(it.getValue("len"), dir) },
                extra = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Direction")
                        listOf(0.0 to "↑", 90.0 to "→", 180.0 to "↓", 270.0 to "←").forEach { (d, t) ->
                            FilterChip(selected = dir == d, onClick = { dir = d }, label = { Text(t) }, modifier = Modifier.heightIn(min = 44.dp))
                        }
                    }
                },
            )
        }
        BoundaryPop.ConfirmClear -> AlertDialog(
            onDismissRequest = c::closePop,
            title = { Text("Effacer le contour ?") },
            text = { Text("Tous les sommets seront supprimés. Vous pourrez annuler avec ↶.") },
            confirmButton = { Button({ c.closePop(); c.clear() }, Modifier.heightIn(min = 44.dp)) { Text("Effacer") } },
            dismissButton = { TextButton(c::closePop, Modifier.heightIn(min = 44.dp)) { Text("Annuler") } },
        )
        BoundaryPop.North -> NorthDialog(
            garden = garden, onDismiss = c::closePop,
            onApply = { a ->
                onChange { g -> g.copy(context = g.context.copy(northAngle = a.toDouble(), orientation = NorthIndicator.orientationFor(a).toString())) }
            },
        )
    }
}

/** « Orienter le plan » : où est le nord par rapport au haut du plan ? (boutons, angle ; textes du web) */
@Composable
private fun NorthDialog(garden: Garden, onDismiss: () -> Unit, onApply: (Int) -> Unit) {
    val ctx = garden.context
    val start = NorthIndicator.normAngle(ctx.northAngle) ?: 0
    var text by remember { mutableStateOf(start.toString()) }
    var error by remember { mutableStateOf(false) }
    val draft = LengthInput.parseNum(text)?.let { NorthIndicator.normAngle(it) }
    fun commit() {
        val a = LengthInput.parseNum(text)?.let { NorthIndicator.normAngle(it) }
        if (a == null) { error = true; return }
        onApply(a); onDismiss()
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Orienter le plan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) },
        text = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    NorthBadge(angle = (draft ?: start).toDouble(), known = true, onClick = null, size = 64.dp)
                    Text(NorthIndicator.label((draft ?: start).toDouble()), style = MaterialTheme.typography.bodyMedium)
                }
                Text("Où est le nord par rapport au haut du plan ?", style = MaterialTheme.typography.bodySmall)
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Nord en haut ↑" to 0, "Nord à droite →" to 90, "Nord en bas ↓" to 180, "Nord à gauche ←" to 270).forEach { (l, a) ->
                        OutlinedButton({ text = a.toString(); error = false }, Modifier.heightIn(min = 44.dp)) { Text(l) }
                    }
                }
                OutlinedTextField(
                    value = text, onValueChange = { text = it; error = false }, label = { Text("Angle") }, singleLine = true, isError = error,
                    suffix = { Text("°") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { commit() }), modifier = Modifier.fillMaxWidth(),
                )
                if (error) Text("Saisissez un angle entre 0 et 359 degrés.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                Text(
                    "Degrés, de 0 à 359, dans le sens des aiguilles d'une montre : 0 = nord en haut, 90 = nord à droite.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = { Button(::commit, Modifier.heightIn(min = 44.dp)) { Text("Valider") } },
        dismissButton = { TextButton(onDismiss, Modifier.heightIn(min = 44.dp)) { Text("Annuler") } },
    )
}
