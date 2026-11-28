package fr.jardin.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import fr.jardin.app.plan.PlanEditor
import fr.jardin.core.Garden
import fr.jardin.core.Point
import fr.jardin.core.formatHeight
import fr.jardin.core.heightMessage
import fr.jardin.core.heightToCm
import fr.jardin.core.parseHeight
import fr.jardin.core.plan.ContourEdit
import fr.jardin.core.plan.ContourState
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.NorthIndicator
import fr.jardin.app.plan.NorthBadge
import fr.jardin.app.plan.PlanCanvas
import fr.jardin.app.plan.PlanDrag
import fr.jardin.app.plan.PlanNorth
import fr.jardin.app.plan.PlanOverlay
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.TextMeasurer
import fr.jardin.core.plan.PlanView

/** Bouton d'outil compact : cible tactile >= 44 dp. `active` = état enfoncé. */
@Composable
fun EBtn(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, active: Boolean = false, danger: Boolean = false) {
    val mod = modifier.heightIn(min = 44.dp)
    val pad = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
    val shape = RoundedCornerShape(12.dp)
    if (active) FilledTonalButton(onClick, mod, enabled = enabled, contentPadding = pad, shape = shape) { Text(label, maxLines = 1) }
    else OutlinedButton(onClick, mod, enabled = enabled, contentPadding = pad, shape = shape) {
        Text(label, maxLines = 1, color = if (danger && enabled) MaterialTheme.colorScheme.error else androidx.compose.ui.graphics.Color.Unspecified)
    }
}

/** Plan réutilisable des étapes d'édition : contour du jardin affiché, zones / aménagements / existant toujours visibles. */
@Composable
fun EditorPlan(
    c: PlanEditor, garden: Garden, modifier: Modifier, description: String,
    extra: DrawScope.(PlanView, Float, TextMeasurer) -> Unit,
    onDown: (Point) -> PlanDrag?, onTap: (Point) -> Unit, onLong: (Point) -> Unit,
    topInset: Dp = 0.dp,
) {
    val density = LocalDensity.current
    c.density = density.density
    c.topInsetPx = with(density) { topInset.toPx() }.toDouble()
    val ctx = garden.context
    PlanCanvas(
        view = c.view, onViewChange = c::changeView, garden = garden, modifier = modifier,
        overlay = PlanOverlay(contour = ContourState(garden.boundary, garden.boundaryClosed), editable = false, extra = extra),
        north = PlanNorth(angle = ctx.northAngle, known = NorthIndicator.known(ctx.orientation, ctx.northAngle)),
        topInset = topInset, onDown = onDown, onTap = onTap, onLong = onLong, onSize = c::onSize, description = description,
    )
}

@Composable
fun EMessage(c: PlanEditor, text: String, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE) {
    val color = if (c.msgKind == "warn" || c.msgKind == "err") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
    Text(text, modifier, color = color, style = MaterialTheme.typography.bodySmall, maxLines = maxLines, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
}

/** Zoom + recentrage en surimpression du plan. */
@Composable
fun ZoomButtons(c: PlanEditor, modifier: Modifier = Modifier) {
    Column(modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        EBtn("＋", { c.zoom(1.4) }); EBtn("－", { c.zoom(1 / 1.4) }); EBtn("⤢", c::fitView)
    }
}

class PField(val key: String, val label: String, val value: String, val kind: String = "length")

/**
 * Fenêtre de saisie : longueurs en cm (« 350 » = 3,50 m ; « 3,5 m » accepté, boutons −10 / +10), angles en degrés (−15 / +15), texte libre.
 * `onOk` reçoit les longueurs en m (Double), les angles (Double) et les textes (String), par clé.
 */
@Composable
fun PopDialog(
    title: String, fields: List<PField>, hint: String? = null, okLabel: String = "Valider",
    onDismiss: () -> Unit, onOk: (Map<String, Any>) -> Unit,
    actions: List<Pair<String, () -> Unit>> = emptyList(), dangerLabels: Set<String> = emptySet(), extra: @Composable () -> Unit = {},
) {
    val values = remember { fields.associate { it.key to mutableStateOf(TextFieldValue(it.value, TextRange(0, it.value.length))) } }
    var error by remember { mutableStateOf<String?>(null) }
    val focus = remember { FocusRequester() }
    fun commit() {
        val out = HashMap<String, Any>()
        for (f in fields) {
            val txt = values.getValue(f.key).value.text
            when (f.kind) {
                "text" -> out[f.key] = txt.trim()
                "angle" -> { val a = LengthInput.parseNum(txt); if (a == null) { error = "Saisissez un angle en degrés, par exemple 30 (0 à 359)."; return }; out[f.key] = a }
                else -> { val v = LengthInput.parseLength(txt); if (v == null) { error = ContourEdit.MSG_BAD_LENGTH; return }; out[f.key] = v }
            }
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
                    if (f.kind == "text") {
                        OutlinedTextField(
                            value = st.value, onValueChange = { st.value = it; error = null }, label = { Text(f.label) }, singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { commit() }),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        val angle = f.kind == "angle"
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            fun step(d: Double) {
                                if (angle) {
                                    val a = (LengthInput.parseNum(st.value.text) ?: 0.0) + d
                                    val t = Math.round(((a % 360) + 360) % 360).toString(); st.value = TextFieldValue(t, TextRange(0, t.length))
                                } else {
                                    val v = LengthInput.parseLength(st.value.text) ?: 0.0
                                    val t = LengthInput.toCm(maxOf(0.01, v + d)); st.value = TextFieldValue(t, TextRange(0, t.length))
                                }
                                error = null
                            }
                            OutlinedButton({ step(if (angle) -15.0 else -0.1) }, Modifier.heightIn(min = 44.dp), contentPadding = PaddingValues(horizontal = 8.dp)) { Text(if (angle) "−15" else "−10") }
                            OutlinedTextField(
                                value = st.value, onValueChange = { st.value = it; error = null },
                                label = { Text(f.label) }, singleLine = true, isError = error != null,
                                suffix = { Text(if (angle) "°" else "cm") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
                                keyboardActions = KeyboardActions(onDone = { commit() }),
                                modifier = Modifier.weight(1f).let { if (idx == 0) it.focusRequester(focus) else it },
                            )
                            OutlinedButton({ step(if (angle) 15.0 else 0.1) }, Modifier.heightIn(min = 44.dp), contentPadding = PaddingValues(horizontal = 8.dp)) { Text(if (angle) "+15" else "+10") }
                        }
                    }
                }
                extra()
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                if (hint != null) Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                actions.forEach { (label, fn) ->
                    TextButton(fn, Modifier.heightIn(min = 44.dp)) { Text(label, color = if (label in dangerLabels || label.startsWith("🗑")) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary) }
                }
            }
        },
        confirmButton = { Button(::commit, Modifier.heightIn(min = 44.dp)) { Text(okLabel) } },
        dismissButton = { TextButton(onDismiss, Modifier.heightIn(min = 44.dp)) { Text("Annuler") } },
    )
}

/**
 * Champ « Hauteur (cm) » commun (port de `heightField`) : saisie en cm, −10 / +10, valeur par défaut (↺), bornes de `heights`.
 * `onSet(m)` : m = nouvelle hauteur en m, ou null pour revenir à la valeur par défaut. La validation et le message sont faits par l'appelant.
 */
@Composable
fun HeightField(
    label: String, value: Double, def: Double, kind: String?, custom: Boolean, defLabel: String = "catalogue",
    onSet: (Double?) -> Unit, onMessage: (String) -> Unit = {}, modifier: Modifier = Modifier, enabled: Boolean = true,
) {
    var text by remember(value, kind) { mutableStateOf(heightToCm(value)) }
    fun commit(t: String) {
        val m = parseHeight(t)
        if (m == null) { onMessage(heightMessage(kind)); text = heightToCm(value); return }
        onSet(m)
    }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            OutlinedButton({ commit(heightToCm((parseHeight(text) ?: value) - 0.1)) }, Modifier.heightIn(min = 44.dp), enabled = enabled, contentPadding = PaddingValues(horizontal = 8.dp)) { Text("−10") }
            OutlinedTextField(
                value = text, onValueChange = { text = it }, label = { Text(label) }, singleLine = true, enabled = enabled, suffix = { Text("cm") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { commit(text) }), modifier = Modifier.weight(1f),
            )
            OutlinedButton({ commit(heightToCm((parseHeight(text) ?: value) + 0.1)) }, Modifier.heightIn(min = 44.dp), enabled = enabled, contentPadding = PaddingValues(horizontal = 8.dp)) { Text("+10") }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                if (custom) "personnalisée · par défaut ${formatHeight(def)}" else "$defLabel · ${formatHeight(def)}",
                Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton({ onSet(null) }, Modifier.heightIn(min = 44.dp), enabled = enabled && custom) { Text("↺ Valeur par défaut") }
        }
    }
}
