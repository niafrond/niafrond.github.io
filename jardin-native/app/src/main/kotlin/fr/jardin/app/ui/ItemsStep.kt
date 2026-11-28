package fr.jardin.app.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import fr.jardin.app.plan.AmPop
import fr.jardin.app.plan.AM_TABS
import fr.jardin.app.plan.ItemsController
import fr.jardin.app.plan.itemsOverlay
import fr.jardin.core.EDGE_KINDS
import fr.jardin.core.EDGE_MATERIALS
import fr.jardin.core.EXISTING_AGES
import fr.jardin.core.EXISTING_KINDS
import fr.jardin.core.FENCE_MATERIALS
import fr.jardin.core.Garden
import fr.jardin.core.ITEM_CATEGORIES
import fr.jardin.core.ITEM_KINDS
import fr.jardin.core.MATERIALS
import fr.jardin.core.OPENING_KINDS
import fr.jardin.core.OPENING_SWINGS
import fr.jardin.core.defaultItemHeight
import fr.jardin.core.defaultObstacleHeight
import fr.jardin.core.edgeHeightOf
import fr.jardin.core.edgeKindOf
import fr.jardin.core.existingLabel
import fr.jardin.core.existingSummary
import fr.jardin.core.formatHeight
import fr.jardin.core.getEdgeKind
import fr.jardin.core.getExistingKind
import fr.jardin.core.getFenceMaterial
import fr.jardin.core.getItemKind
import fr.jardin.core.getOpeningKind
import fr.jardin.core.getPlant
import fr.jardin.core.itemHeight
import fr.jardin.core.itemRadius
import fr.jardin.core.itemsTotalPrice
import fr.jardin.core.materialOf
import fr.jardin.core.obstacleHeight
import fr.jardin.core.plan.AmSel
import fr.jardin.core.plan.ExistingEdit
import fr.jardin.core.plan.ItemEdit
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.boundarySides
import fr.jardin.core.distance
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs

private fun euro(n: Double) = NumberFormat.getIntegerInstance(Locale.FRANCE).format(Math.round(n)) + " €"
private fun cm(m: Double) = ItemEdit.cm(m)

/** Carte de palette : pastille + nom + détail, 2 lignes, cible >= 44 dp. */
@Composable
private fun PaletteCard(title: String, meta: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val mod = modifier.width(112.dp).heightIn(min = 56.dp)
    val pad = PaddingValues(horizontal = 6.dp, vertical = 6.dp)
    val shape = RoundedCornerShape(12.dp)
    val body: @Composable () -> Unit = {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            if (meta.isNotEmpty()) Text(meta, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (selected) FilledTonalButton(onClick, mod, contentPadding = pad, shape = shape) { body() }
    else OutlinedButton(onClick, mod, contentPadding = pad, shape = shape) { body() }
}

/** Rangée défilante (atelier) ou grille qui passe à la ligne (page). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Cards(horizontal: Boolean, content: @Composable () -> Unit) {
    if (horizontal) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) { content() }
    else FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
}

@Composable
private fun MaterialChoice(ids: List<String>, current: String?, onPick: (String) -> Unit) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Matériau", style = MaterialTheme.typography.labelMedium)
        ids.forEach { id -> EBtn(MATERIALS[id]?.label ?: id, { onPick(id) }, active = current == id) }
    }
}

@Composable
fun ItemsInfo(c: ItemsController, g: Garden) {
    val n = g.items.size
    val ex = existingSummary(g)
    val parts = buildList {
        add("$n élément${if (n > 1) "s" else ""}${if (n > 0) " · ≈ ${euro(itemsTotalPrice(g))}" else ""}")
        add("${g.boundaryEdges.count { it.kind != "open" }} côté(s) bâti(s)")
        add("${g.openings.size} passage${if (g.openings.size > 1) "s" else ""}")
        if (ex.total > 0 || c.tab == "existing") add(ex.text)
    }
    Text(parts.joinToString("  ·  "), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
}

@Composable
fun ItemsTabs(c: ItemsController) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        AM_TABS.forEach { (id, label) -> EBtn(label, { c.switchTab(id) }, active = c.tab == id) }
    }
}

/** Palette de l'onglet courant (toujours visible : défilante dans l'atelier, grille dans la page). */
@Composable
fun ItemsPalette(c: ItemsController, g: Garden, horizontal: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        when (c.tab) {
            "furniture" -> {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    EBtn("Tout", { c.cat = "all" }, active = c.cat == "all")
                    ITEM_CATEGORIES.forEach { cat -> EBtn(cat.label, { c.cat = cat.id }, active = c.cat == cat.id) }
                }
                Cards(horizontal) {
                    ITEM_KINDS.filter { c.cat == "all" || it.category == c.cat }.forEach { k ->
                        PaletteCard("${k.emoji} ${k.label}", "${if (k.shape == "circle") "Ø " + cm(k.w) else cm(k.w) + "×" + cm(k.d)} cm · ${euro(k.priceEur)}", c.kind == k.id, { c.chooseKind(k.id) })
                    }
                }
            }
            "edges" -> Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val d = c.draft
                if (d != null) {
                    EBtn("✔ Terminer", c::finishDraft, enabled = d.points.size >= 2, active = true)
                    EBtn("↩ Retirer le dernier point", c::draftUndoPoint, enabled = d.points.isNotEmpty())
                    EBtn("✕ Annuler", c::cancelDraft)
                } else {
                    EBtn("＋ Mur libre", { c.startDraft("wall") }); EBtn("＋ Clôture libre", { c.startDraft("fence") })
                }
            }
            "access" -> Cards(horizontal) {
                OPENING_KINDS.forEach { k -> PaletteCard("${k.emoji} ${k.label}", "${cm(k.width)} cm", c.openKind == k.id, { c.chooseOpening(k.id) }) }
            }
            else -> {
                if (c.exDraft != null) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    EBtn("✔ Terminer", c::finishExDraft, enabled = (c.exDraft?.size ?: 0) >= 2, active = true)
                    EBtn("↩ Retirer le dernier point", c::exDraftUndoPoint, enabled = (c.exDraft?.size ?: 0) > 0)
                    EBtn("✕ Annuler", c::cancelExDraft)
                } else {
                    Cards(horizontal) {
                        EXISTING_KINDS.filter { it.palette }.forEach { k ->
                            val dims = if (k.id == "fence") "${cm(getFenceMaterial(c.fenceMaterial).height)} cm" else "${cm(k.height)}×${cm(k.width)} cm"
                            PaletteCard("${k.emoji} ${k.label}", dims + if (k.linear) " · tracé" else "", c.exKind == k.id, { c.pickExKind(if (c.exKind == k.id) null else k.id) })
                        }
                    }
                    if (c.exKind == "fence") MaterialChoice(FENCE_MATERIALS.map { it.id }, c.fenceMaterial, c::pickFenceMaterial)
                }
            }
        }
    }
}

/** Réglages de l'élément sélectionné (mobilier, côté, mur libre, passage, existant). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ItemsDetail(c: ItemsController, g: Garden) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when (c.tab) {
            "furniture" -> c.selItem?.let { it0 ->
                val k = getItemKind(it0.kind)
                val round = itemRadius(it0) != null
                val dflt = defaultItemHeight(it0.kind)
                val ht = itemHeight(it0)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("${k?.emoji ?: ""} ${it0.label ?: k?.label ?: "Élément"}", fontWeight = FontWeight.SemiBold)
                        Text("${ItemEdit.dims(it0)}${if (!round) " · ${Math.round(it0.rotation)}°" else ""} · ≈ ${euro(k?.priceEur ?: 0.0)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (c.outside()) Text("⚠ sort du terrain", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    }
                    if (!round) { EBtn("↺", { c.rotateSel(-90.0) }); EBtn("↻", { c.rotateSel(90.0) }) }
                    EBtn("⧉", { c.duplicateItem(it0) }); EBtn("🗑", c::deleteSel, danger = true)
                }
                HeightField("Hauteur (cm)", ht, dflt, it0.kind, custom = it0.height != null && abs(it0.height!! - dflt) >= 0.005, onSet = c::setItemHeight, onMessage = { c.hint(it) })
            }
            "edges" -> {
                val i = c.selEdge
                val fl = c.selFree
                if (i != null) {
                    val sd = boundarySides(g).firstOrNull { it.i == i }
                    val kind = edgeKindOf(g, i)
                    val k = getEdgeKind(kind)
                    Text("Côté ${i + 1} · ${LengthInput.fr(if (sd != null) distance(sd.a, sd.b) else 0.0)} m", fontWeight = FontWeight.SemiBold)
                    Text(if (kind == "open") "Ouvert" else "${k?.label} · hauteur en cm", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    if (kind != "open") {
                        val def = k?.height ?: 0.0
                        HeightField("Hauteur (cm)", edgeHeightOf(g, i), def, kind, custom = abs(edgeHeightOf(g, i) - def) >= 0.005, defLabel = "type", onSet = { m -> c.setEdgeHeight(i, m ?: def) }, onMessage = { c.hint(it) })
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        EDGE_KINDS.forEach { e -> EBtn(e.label, { c.chooseEdgeKind(e.id) }, active = kind == e.id) }
                        EBtn("Appliquer à tous", c::applyAllEdges)
                    }
                    EDGE_MATERIALS[kind]?.let { MaterialChoice(it, ItemEdit.edgeMaterial(g, i), { m -> c.setEdgeMaterial(i, m) }) }
                } else if (fl != null) {
                    val label = ItemEdit.FREE_KINDS[fl.kind]?.first ?: fl.kind
                    val def = ItemEdit.FREE_KINDS[fl.kind]?.second ?: defaultObstacleHeight(fl.kind)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("$label libre", fontWeight = FontWeight.SemiBold)
                            Text("hauteur en cm", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        EBtn("🗑", c::deleteSel, danger = true)
                    }
                    HeightField("Hauteur (cm)", obstacleHeight(fl), def, fl.kind, custom = abs(obstacleHeight(fl) - def) >= 0.005, defLabel = "type", onSet = { m -> c.setFreeHeight(fl.id, m) }, onMessage = { c.hint(it) })
                    EDGE_MATERIALS[fl.kind]?.let { MaterialChoice(it, materialOf(fl.kind, fl.material), { m -> c.setFreeMaterial(fl.id, m) }) }
                }
            }
            "access" -> c.selOpening?.let { op ->
                val k = getOpeningKind(op.kind)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("${k?.emoji ?: ""} ${k?.label ?: op.kind}", fontWeight = FontWeight.SemiBold)
                        Text("${cm(op.width)} cm", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    EBtn("🗑", c::deleteSel, danger = true)
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    OPENING_SWINGS.filter { op.kind != "garage" || it.id == "sliding" }.forEach { sw ->
                        EBtn((if (sw.id == "in") "⤶ " else if (sw.id == "out") "⤷ " else "⇄ ") + sw.label, { c.setOpeningSwing(sw.id) }, active = op.swing == sw.id)
                    }
                }
                var w by remember(op.id, op.width) { mutableStateOf(cm(op.width)) }
                OutlinedTextField(
                    value = w, onValueChange = { w = it; LengthInput.parseLength(it)?.let { m -> c.applyOpeningWidth(op.id, m) } },
                    label = { Text("Largeur") }, suffix = { Text("cm") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done, keyboardType = androidx.compose.ui.text.input.KeyboardType.Number), modifier = Modifier.fillMaxWidth(),
                )
            }
            else -> c.selEx?.let { e -> ExistingDetail(c, g, e) }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExistingDetail(c: ItemsController, g: Garden, e: fr.jardin.core.Existing) {
    val k = getExistingKind(e.kind)
    val isFence = e.kind == "fence"
    val plant = e.plantId?.let { getPlant(it) }
    val lab = if (isFence) "Clôture ${getFenceMaterial(e.material).label.lowercase()}" else existingLabel(e)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Column(Modifier.weight(1f)) {
            Text("${k?.emoji ?: ""} ${if (e.label != null && e.label != k?.defaultLabel) e.label else lab}", fontWeight = FontWeight.SemiBold)
            Text(
                "${if (isFence) "hauteur ${cm(e.height)} cm" else "${cm(e.height)} cm de haut × ${cm(e.width)} cm de large"} · ${if (!e.keep) "à retirer ou remplacer" else "à conserver"}${if (plant != null) " · ${plant.latinName}" else ""}",
                style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (c.outside()) Text("⚠ sort du terrain", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
        }
        EBtn("✎ Taille", { c.openExPop(e.id) }); EBtn("⧉", { c.duplicateExisting(e) }); EBtn("🗑", c::deleteSel, danger = true)
    }
    if (isFence) {
        MaterialChoice(FENCE_MATERIALS.map { it.id }, e.material, { m -> c.updateEx(e.id) { ExistingEdit.setMaterial(it, m) } })
    } else {
        Text("Quelle plante ?" + if (plant != null) "  ✔ ${plant.commonName}" else "  (espèce non précisée)", style = MaterialTheme.typography.labelLarge)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = c.exQuery, onValueChange = { c.exQuery = it }, label = { Text("Quelle plante ? (nom ou nom latin)") }, singleLine = true,
                modifier = Modifier.weight(1f),
            )
            EBtn("Je ne sais pas / autre", { c.updateEx(e.id) { ExistingEdit.unknownPlant(it, c.exQuery) } })
        }
        val results = remember(e.kind, c.exQuery) { ExistingEdit.plantResults(e.kind, c.exQuery) }
        if (results.isEmpty()) Text("Aucune essence trouvée : utilisez « Je ne sais pas / autre ».", style = MaterialTheme.typography.bodySmall)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            results.forEach { p -> PaletteCard(p.commonName, p.latinName, e.plantId == p.id, { c.choosePlant(e, p) }) }
        }
        if (plant != null) Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Âge :")
            EXISTING_AGES.forEach { a -> EBtn(a.label, { c.setAge(e, plant, a.id) }, active = c.exAge == a.id) }
        }
    }
    val defH = if (isFence) getFenceMaterial(e.material).height else if (plant != null) fr.jardin.core.sizeForPlant(plant, c.exAge, e.kind).height else k?.height ?: 1.0
    HeightField("Hauteur (cm)", e.height, defH, e.kind, custom = abs(e.height - defH) >= 0.005, defLabel = "défaut", onSet = { m -> c.setExHeight(e, m ?: defH) }, onMessage = { c.hint(it) })
    if (!isFence) {
        var w by remember(e.id, e.width) { mutableStateOf(cm(e.width)) }
        OutlinedTextField(
            value = w, onValueChange = { w = it; LengthInput.parseLength(it)?.let { m -> c.updateEx(e.id) { x -> ExistingEdit.setWidth(x, m) } } },
            label = { Text("Largeur") }, suffix = { Text("cm") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done, keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
        )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        EBtn("✅ À conserver", { c.setKeep(e, true) }, active = e.keep, modifier = Modifier.weight(1f))
        EBtn("🪓 À retirer ou remplacer", { c.setKeep(e, false) }, active = !e.keep, modifier = Modifier.weight(1f))
    }
    var notes by remember(e.id) { mutableStateOf(e.notes) }
    OutlinedTextField(
        value = notes, onValueChange = { notes = it; c.updateEx(e.id) { x -> ExistingEdit.setNotes(x, it) } }, label = { Text("Notes (état, remarques…)") },
        singleLine = true, modifier = Modifier.fillMaxWidth(),
    )
}

/** Fenêtres de saisie (appui long) de l'étape. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ItemsDialogs(c: ItemsController, g: Garden) {
    when (val p = c.pop) {
        null -> {}
        is AmPop.ItemSize -> {
            val it0 = g.items.firstOrNull { it.id == p.id }
            if (it0 == null) c.closePop() else {
                val k = getItemKind(it0.kind)
                val round = itemRadius(it0) != null
                val fields = buildList {
                    if (round) add(PField("w", "Diamètre", cm(itemRadius(it0)!! * 2)))
                    else { add(PField("w", "Largeur", cm(it0.width))); add(PField("d", "Profondeur", cm(it0.depth))); add(PField("rot", "Rotation", Math.round(it0.rotation).toString(), "angle")) }
                    add(PField("ht", "Hauteur", cm(itemHeight(it0))))
                    add(PField("label", "Nom", it0.label ?: "", "text"))
                }
                PopDialog(
                    title = "${k?.emoji ?: ""} ${k?.label ?: "Élément"} : taille en cm", fields = fields,
                    hint = "« 150 » = 1,50 m ; « 1,5 m » accepté. Hauteur par défaut : ${formatHeight(defaultItemHeight(it0.kind))}.",
                    onDismiss = c::closePop,
                    onOk = { v -> c.applyItemPop(it0.id, v["w"] as? Double, v["d"] as? Double, v["rot"] as? Double, v["ht"] as? Double, v["label"] as? String) },
                    actions = listOf(
                        "↺ Hauteur par défaut" to { c.closePop(); c.resetItemHeight(it0.id) },
                        "⧉ Dupliquer" to { c.closePop(); c.duplicateItem(it0) },
                        "🗑 Supprimer" to { c.closePop(); c.deleteSel() },
                    ),
                )
            }
        }
        is AmPop.Edge -> {
            var tmp by remember(p.index) { mutableStateOf(edgeKindOf(g, p.index).let { if (it == "open") "wall" else it }) }
            val cur = edgeKindOf(g, p.index)
            PopDialog(
                title = "Côté ${p.index + 1} : type et hauteur", hint = "Hauteur en cm (« 200 » = 2 m).",
                fields = listOf(PField("h", "Hauteur", cm(if (cur == "open") getEdgeKind(tmp)?.height ?: 2.0 else edgeHeightOf(g, p.index)))),
                onDismiss = c::closePop,
                onOk = { v -> c.chooseEdgeKind(tmp); c.setEdgeHeight(p.index, v.getValue("h") as Double) },
                actions = listOf("Ouvert" to { c.closePop(); c.chooseEdgeKind("open") }),
                extra = {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        EDGE_KINDS.filter { it.id != "open" }.forEach { e -> EBtn(e.label, { tmp = e.id }, active = tmp == e.id) }
                    }
                },
            )
        }
        is AmPop.Free -> {
            val o = g.obstacles.firstOrNull { it.id == p.id }
            if (o == null) c.closePop() else PopDialog(
                title = "${ItemEdit.FREE_KINDS[o.kind]?.first ?: o.kind} libre : hauteur",
                fields = listOf(PField("h", "Hauteur", cm(obstacleHeight(o)))), onDismiss = c::closePop,
                onOk = { v -> c.setFreeHeight(o.id, v.getValue("h") as Double) },
                actions = listOf("🗑 Supprimer" to { c.closePop(); c.deleteSel() }),
            )
        }
        is AmPop.Open -> {
            val op = g.openings.firstOrNull { it.id == p.id }
            val k = getOpeningKind(op?.kind)
            if (op == null) c.closePop() else PopDialog(
                title = "${k?.label ?: "Passage"} : largeur en cm", hint = "« 300 » = 3 m.",
                fields = listOf(PField("w", "Largeur", cm(op.width))), onDismiss = c::closePop,
                onOk = { v -> c.applyOpeningWidth(op.id, v.getValue("w") as Double) },
                actions = listOf("🗑 Supprimer" to { c.closePop(); c.deleteSel() }),
            )
        }
        is AmPop.Ex -> {
            val e = g.existing.firstOrNull { it.id == p.id }
            val k = getExistingKind(e?.kind)
            if (e == null) c.closePop() else {
                val fields = buildList {
                    add(PField("h", "Hauteur", cm(e.height)))
                    if (e.kind != "fence") add(PField("w", if (e.kind == "hedge") "Largeur" else "Largeur (houppier)", cm(e.width)))
                    add(PField("label", "Nom", e.label ?: "", "text"))
                }
                PopDialog(
                    title = "${k?.emoji ?: ""} ${k?.label ?: ""} : taille actuelle en cm", hint = "« 800 » = 8 m ; « 1,5 m » accepté.", fields = fields,
                    onDismiss = c::closePop,
                    onOk = { v -> c.applyExistingPop(e.id, v["h"] as? Double, v["w"] as? Double, (v["label"] as? String)?.ifEmpty { k?.defaultLabel }) },
                    actions = listOf("⧉ Dupliquer" to { c.closePop(); c.duplicateExisting(e) }, "🗑 Supprimer" to { c.closePop(); c.deleteSel() }),
                )
            }
        }
    }
}

/** Étape « Aménagements » dans la page de l'assistant : plan de hauteur bornée, la page défile jusqu'aux boutons du bas. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ItemsStep(c: ItemsController, garden: Garden) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        ItemsInfo(c, garden)
        ItemsTabs(c)
        Box(Modifier.fillMaxWidth().height(380.dp)) {
            ItemsPlan(c, garden, Modifier.fillMaxSize())
            ZoomButtons(c, Modifier.align(Alignment.BottomEnd))
        }
        EMessage(c, c.helpText)
        ItemsPalette(c, garden, horizontal = false)
        ItemsDetail(c, garden)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EBtn("↶", c::undo, enabled = c.canUndo); EBtn("↷", c::redo, enabled = c.canRedo)
            EBtn(c.grid?.let { "▦ ${LengthInput.fr(it, 1)} m" } ?: "▦ off", c::cycleGrid)
        }
        Button(c::toggleFullscreen, Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(12.dp)) { Text("⤢ Plan en plein écran") }
    }
    ItemsDialogs(c, garden)
}

@Composable
private fun ItemsPlan(c: ItemsController, garden: Garden, modifier: Modifier, topInset: androidx.compose.ui.unit.Dp = androidx.compose.ui.unit.Dp.Hairline) {
    EditorPlan(
        c, garden, modifier, "Plan du terrain : aménagements", itemsOverlay(c, garden),
        onDown = c::onDown, onTap = c::onTap, onLong = c::onLong, topInset = topInset,
    )
}

/**
 * Atelier plein écran des aménagements : plan sur tout l'espace, outils défilants en haut, palette toujours visible,
 * réglages de la sélection repliables et barre du bas FIXE (Annuler, Rétablir, Réglages, OK).
 */
@Composable
fun ItemsWorkshop(c: ItemsController, garden: Garden) {
    BackHandler { c.toggleFullscreen() }
    val hasDetail = (c.tab == "furniture" && c.selItem != null) || (c.tab == "edges" && (c.selEdge != null || c.selFree != null)) ||
        (c.tab == "access" && c.selOpening != null) || (c.tab == "existing" && c.selEx != null)
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            ItemsPlan(c, garden, Modifier.fillMaxSize(), topInset = 108.dp)
            Column(Modifier.align(Alignment.TopStart).fillMaxWidth().statusBarsPadding().padding(horizontal = 8.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                ItemsTabs(c)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    EBtn(c.grid?.let { "▦ ${LengthInput.fr(it, 1)} m" } ?: "▦ off", c::cycleGrid)
                    EBtn("－", { c.zoom(1 / 1.4) }); EBtn("＋", { c.zoom(1.4) }); EBtn("⤢", c::fitView)
                }
            }
        }
        Surface(color = MaterialTheme.colorScheme.background, tonalElevation = 3.dp) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ItemsInfo(c, garden)
                EMessage(c, c.helpText, maxLines = 2)
                if (hasDetail && c.detailOpen) Column(Modifier.fillMaxWidth().heightIn(max = 170.dp).verticalScroll(rememberScrollState())) { ItemsDetail(c, garden) }
                Column(Modifier.fillMaxWidth().heightIn(max = 130.dp).verticalScroll(rememberScrollState())) { ItemsPalette(c, garden, horizontal = true) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    val shape = RoundedCornerShape(12.dp)
                    val m = Modifier.weight(1f).heightIn(min = 48.dp)
                    val pad = PaddingValues(horizontal = 4.dp)
                    OutlinedButton(c::undo, m, enabled = c.canUndo, shape = shape, contentPadding = pad) { Text("Annuler", maxLines = 1) }
                    OutlinedButton(c::redo, m, enabled = c.canRedo, shape = shape, contentPadding = pad) { Text("Rétablir", maxLines = 1) }
                    OutlinedButton({ c.detailOpen = !c.detailOpen }, m, enabled = hasDetail, shape = shape, contentPadding = pad) { Text(if (c.detailOpen) "Masquer" else "Réglages", maxLines = 1) }
                    Button(c::toggleFullscreen, m, shape = shape, contentPadding = pad) { Text("OK", maxLines = 1) }
                }
            }
        }
    }
    ItemsDialogs(c, garden)
}

