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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import fr.jardin.app.plan.ZnPop
import fr.jardin.app.plan.ZonesController
import fr.jardin.app.plan.zonesOverlay
import fr.jardin.core.CircleShape
import fr.jardin.core.Garden
import fr.jardin.core.LineShape
import fr.jardin.core.POOL_VARIANTS
import fr.jardin.core.PolygonShape
import fr.jardin.core.ZONE_TYPES
import fr.jardin.core.Zone
import fr.jardin.core.defaultZoneHeight
import fr.jardin.core.getZoneType
import fr.jardin.core.isRotatable
import fr.jardin.core.poolVariant
import fr.jardin.core.rotationOf
import fr.jardin.core.zoneHeight
import fr.jardin.core.zoneHeightKind
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.ZoneDims
import fr.jardin.core.plan.ZoneEdit
import kotlin.math.abs

private val KIND_LABELS = mapOf("polygon" to "⬠ Polygone", "circle" to "◯ Cercle", "line" to "〰 Ligne")

/** Résumé : nombre de zones, chevauchements, zones hors terrain, types à dessiner (calcul gelé pendant un glissé). */
@Composable
fun ZonesInfo(c: ZonesController, g: Garden) {
    val key = if (c.dragging) null else g.zones to g.boundary
    val stats = remember(key) { Triple(ZoneEdit.overlapIds(g).first, ZoneEdit.outCount(g), ZoneEdit.wishedToDraw(g)) }
    Column {
        Text("${g.zones.size} zone${if (g.zones.size > 1) "s" else ""}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        if (stats.first > 0) Text("⚠ ${stats.first} chevauchement${if (stats.first > 1) "s" else ""}", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (stats.second > 0) Text("⚠ ${stats.second} hors du terrain", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (stats.third.isNotEmpty()) Text("À dessiner : ${stats.third.joinToString(", ") { getZoneType(it)?.label ?: it }}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Wrap(horizontal: Boolean, content: @Composable () -> Unit) {
    if (horizontal) Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) { content() }
    else FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
}

@Composable
private fun TypeCard(title: String, status: String, selected: Boolean, onClick: () -> Unit) {
    val mod = Modifier.width(118.dp).heightIn(min = 56.dp)
    val pad = PaddingValues(horizontal = 6.dp, vertical = 6.dp)
    val shape = RoundedCornerShape(12.dp)
    val body: @Composable () -> Unit = {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            if (status.isNotEmpty()) Text(status, maxLines = 1, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (selected) FilledTonalButton(onClick, mod, contentPadding = pad, shape = shape) { body() }
    else OutlinedButton(onClick, mod, contentPadding = pad, shape = shape) { body() }
}

/**
 * Boutons de choix : types de zones (souhaités d'abord, état « à dessiner » / « ✓ dessiné ») et liste des zones du plan.
 * Toujours visibles, dans la page comme dans l'atelier.
 */
@Composable
fun ZonesDock(c: ZonesController, g: Garden, horizontal: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Types de zones", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Wrap(horizontal) {
            val wished = g.wishedZoneTypes.mapNotNull { getZoneType(it) }
            (wished + ZONE_TYPES.filter { t -> wished.none { it.id == t.id } }).forEach { t ->
                val n = g.zones.count { it.type == t.id }
                val isWished = wished.any { it.id == t.id }
                val status = if (n > 0) "✓ dessiné ($n)" else if (isWished) "à dessiner" else ""
                TypeCard("${t.icon} ${t.label}", status, c.typeId == t.id, { c.chooseType(t.id) })
            }
        }
        if (g.zones.isNotEmpty()) {
            Text("Zones du plan", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Wrap(horizontal) {
                g.zones.forEach { z ->
                    val t = getZoneType(z.type)
                    EBtn("${t?.icon ?: ""} ${z.label}", { c.pickZone(z.id) }, active = c.sel == z.id && c.typeId == null)
                }
            }
        }
    }
}

/** Forme à dessiner : polygone / cercle / ligne, rectangle ou forme libre, largeur de ligne, Terminer, Annuler le tracé. */
@Composable
fun ZonesKindBar(c: ZonesController) {
    val t = c.typeId?.let { getZoneType(it) } ?: return
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        if (t.shapeKinds.size > 1) t.shapeKinds.forEach { k -> EBtn(KIND_LABELS[k] ?: k, { c.chooseKind(k) }, active = c.kind == k) }
        if (c.kind == "polygon") {
            EBtn("▭ Rectangle", { c.chooseRectMode(true) }, active = c.rectMode)
            EBtn("✎ Forme libre", { c.chooseRectMode(false) }, active = !c.rectMode)
        }
        if (c.kind == "line") {
            var w by remember(c.typeId) { mutableStateOf(LengthInput.toCm(c.lineWidth)) }
            OutlinedTextField(
                value = w, onValueChange = { w = it; LengthInput.parseLength(it)?.takeIf { v -> v > 0.04 }?.let { v -> c.lineWidth = v } },
                label = { Text("Largeur") }, suffix = { Text("cm") }, singleLine = true, modifier = Modifier.width(150.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
            )
        }
        if (c.kind != "circle") EBtn("✔ Terminer", c::finishDrawing, enabled = c.canFinish, active = true)
        if (c.kind != "circle") EBtn("↩ Retirer le dernier point", c::undoPoint, enabled = (c.drawing?.points?.isNotEmpty() == true))
        EBtn("✕ Annuler le tracé", c::cancelDrawing, enabled = c.drawing != null || c.circleCenter != null)
    }
}

/** Réglages de la zone sélectionnée : nom, type, piscine, hauteur, surface, rotation, avertissements, actions. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ZonesDetail(c: ZonesController, g: Garden) {
    val z = c.selZone
    if (z == null || c.typeId != null) return
    val t = getZoneType(z.type)
    val key = if (c.dragging) null else g.zones to g.boundary
    val warns = remember(key, z.id) { ZoneEdit.warnings(g, z) }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(t?.icon ?: "", style = MaterialTheme.typography.titleLarge)
            var name by remember(z.id) { mutableStateOf(z.label) }
            OutlinedTextField(
                value = name, onValueChange = { name = it.take(60); c.setLabel(z.id, name) }, label = { Text(if (c.naming) "Donnez-lui un nom" else "Nom de la zone") },
                singleLine = true, modifier = Modifier.weight(1f), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { c.naming = false }),
            )
            EBtn("✕", { c.select(null) })
        }
        if (c.naming) Text("Le nom s’affiche sur le plan : donnez-lui un nom qui vous aide à vous y retrouver.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        val kindOfShape = when (z.shape) { is CircleShape -> "circle"; is LineShape -> "line"; else -> "polygon" }
        DropdownField(
            "Type de zone", z.type,
            ZONE_TYPES.filter { kindOfShape in it.shapeKinds || it.id == z.type }.map { Choice(it.id, "${it.icon} ${it.label}") },
            { id -> if (id != null) c.setType(z.id, id) },
        )
        if (z.type == "pool") {
            val cur = poolVariant(z)
            Text("Type de piscine", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                POOL_VARIANTS.forEach { v -> EBtn(v.label, { c.setPool(z.id, v.id) }, active = cur == v.id, modifier = Modifier.weight(1f)) }
            }
            Text("Une piscine hors sol dépasse du sol : prévoyez un dégagement d’au moins 1 m autour et un accès.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if ((z.type == "pool" && poolVariant(z) == "above") || z.type == "terrace") {
            val def = defaultZoneHeight(z)
            HeightField(
                if (z.type == "terrace") "Surélévation (cm)" else "Hauteur de la paroi (cm)", zoneHeight(z), def, zoneHeightKind(z),
                custom = z.height != null && abs(z.height!! - def) >= 0.005, defLabel = if (z.type == "terrace") "au sol" else "standard",
                onSet = { m -> c.setHeight(z.id, m) }, onMessage = { c.hint(it) },
            )
        }
        Text(
            "Surface : ${ZoneEdit.areaText(z)}  ·  ${ZoneEdit.dimsText(z.shape)}  ·  " +
                if (z.plantings.isNotEmpty()) "🌱 ${z.plantings.size} plante${if (z.plantings.size > 1) "s" else ""} choisie${if (z.plantings.size > 1) "s" else ""}" else "Aucune plante choisie",
            style = MaterialTheme.typography.bodyMedium,
        )
        // rotation
        val rotOk = isRotatable(z.shape)
        val rotNow = Math.round(rotationOf(z.shape)) % 360
        var rot by remember(z.id, rotNow) { mutableStateOf(rotNow.toString()) }
        Text("Rotation de la forme", style = MaterialTheme.typography.labelLarge)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = rot, onValueChange = { rot = it }, label = { Text("Rotation (°)") }, singleLine = true, enabled = rotOk, suffix = { Text("°") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = {
                    val a = LengthInput.parseNum(rot)
                    if (a == null) { c.hint("Saisissez un angle en degrés, par exemple 30 (0 à 359).") ; rot = rotNow.toString() } else c.rotateTo(z.id, a)
                }),
                modifier = Modifier.weight(1f),
            )
            EBtn("🧲 15°", c::toggleRotSnap, enabled = rotOk, active = c.rotSnap)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            EBtn("↺ −15°", { c.rotateBy(z.id, -15.0) }, enabled = rotOk)
            EBtn("↻ +15°", { c.rotateBy(z.id, 15.0) }, enabled = rotOk)
            EBtn("⟲ 90°", { c.rotateBy(z.id, 90.0) }, enabled = rotOk)
            EBtn("Remettre droit", { c.straighten(z.id) }, enabled = rotOk)
        }
        if (!rotOk) Text(ZoneEdit.NO_ROT_TIP + ".", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        warns.forEach { Text("⚠ $it", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            EBtn("📏 Dimensions…", { c.openDims(z.id) })
            EBtn("⧉ Dupliquer", { c.duplicate(z) })
            EBtn("🗑 Supprimer", { c.remove(z) }, danger = true)
        }
    }
}

/** Fenêtres de saisie en cm : nouvelle zone (appui long avec un type) et dimensions d'une zone. */
@Composable
fun ZonesDialogs(c: ZonesController, g: Garden) {
    when (val p = c.pop) {
        null -> {}
        is ZnPop.Create -> {
            val t = c.typeId?.let { getZoneType(it) }
            if (t == null) c.closePop() else {
                val title = "Nouvelle zone : ${t.icon} ${t.label}"
                when (c.kind) {
                    "circle" -> PopDialog(title, listOf(PField("r", "Rayon", "")), "Le centre est posé là où vous avez appuyé. Centimètres : 150 = 1,50 m.", "Créer le cercle", c::closePop,
                        { v -> c.createFromPop(p.at, v["r"] as Double, null, null) })
                    "line" -> PopDialog(title, listOf(PField("len", "Longueur", ""), PField("w", "Largeur", LengthInput.toCm(c.lineWidth))), "La ligne part de ce point vers la droite ; vous pourrez la déformer ensuite.", "Créer la ligne", c::closePop,
                        { v -> c.createFromPop(p.at, null, v["w"] as Double, v["len"] as Double) })
                    else -> PopDialog(title, listOf(PField("w", "Largeur", ""), PField("l", "Longueur", "")), "Le coin haut gauche est posé là où vous avez appuyé. Centimètres : 350 = 3,50 m.", "Créer la zone", c::closePop,
                        { v -> c.createFromPop(p.at, null, v["w"] as Double, v["l"] as Double) })
                }
            }
        }
        is ZnPop.Dims -> {
            val z = g.zones.firstOrNull { it.id == p.id }
            val d = ZoneEdit.dimsOf(z?.shape)
            if (z == null || d == null) c.closePop() else {
                val fields = when (d) {
                    is ZoneDims.Circle -> listOf(PField("r", "Rayon", LengthInput.toCm(d.r)))
                    is ZoneDims.Line -> listOf(PField("w", "Largeur", LengthInput.toCm(d.w)))
                    is ZoneDims.Rect -> listOf(PField("w", "Largeur", LengthInput.toCm(d.w)), PField("l", "Longueur", LengthInput.toCm(d.l)),
                        PField("rot", "Rotation", (Math.round(rotationOf(z.shape)) % 360).toString(), "angle"))
                    is ZoneDims.Poly -> listOf(PField("w", "Largeur", LengthInput.toCm(d.w)), PField("l", "Longueur", LengthInput.toCm(d.l)))
                }
                PopDialog(
                    title = "${z.label} · ${ZoneEdit.dimsText(z.shape)}", fields = fields, hint = ZoneEdit.dimsHint(d), okLabel = "Appliquer", onDismiss = c::closePop,
                    onOk = { v -> c.applyDims(z.id, v["r"] as? Double, v["w"] as? Double, v["l"] as? Double, v["rot"] as? Double) },
                )
            }
        }
    }
}

@Composable
private fun ZonesPlan(c: ZonesController, garden: Garden, modifier: Modifier, topInset: androidx.compose.ui.unit.Dp = androidx.compose.ui.unit.Dp.Hairline) {
    val key = if (c.dragging) null else garden.zones
    val ids = remember(key) { ZoneEdit.overlapIds(garden).second }
    EditorPlan(
        c, garden, modifier, "Plan des zones", zonesOverlay(c, garden, ids),
        onDown = c::onDown, onTap = c::onTap, onLong = c::onLong, topInset = topInset,
    )
}

/** Étape « Dessin des zones » dans la page de l'assistant. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ZonesStep(c: ZonesController, garden: Garden) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        ZonesInfo(c, garden)
        Box(Modifier.fillMaxWidth().height(380.dp)) {
            ZonesPlan(c, garden, Modifier.fillMaxSize())
            ZoomButtons(c, Modifier.align(Alignment.BottomEnd))
        }
        EMessage(c, c.helpText)
        ZonesKindBar(c)
        ZonesDock(c, garden, horizontal = false)
        ZonesDetail(c, garden)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            EBtn("↶", c::undo, enabled = c.canUndo); EBtn("↷", c::redo, enabled = c.canRedo)
            EBtn(c.grid?.let { "▦ ${LengthInput.fr(it, 1)} m" } ?: "▦ off", c::cycleGrid)
        }
        Button(c::toggleFullscreen, Modifier.fillMaxWidth().heightIn(min = 48.dp), shape = RoundedCornerShape(12.dp)) { Text("⤢ Plan en plein écran") }
    }
    ZonesDialogs(c, garden)
}

/**
 * Atelier plein écran des zones : plan sur tout l'espace, outils défilants en haut, choix de types et liste des zones
 * toujours visibles, réglages repliables et barre du bas FIXE (Annuler, Rétablir, Réglages, OK).
 */
@Composable
fun ZonesWorkshop(c: ZonesController, garden: Garden) {
    BackHandler { c.toggleFullscreen() }
    val hasDetail = c.selZone != null && c.typeId == null
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            ZonesPlan(c, garden, Modifier.fillMaxSize(), topInset = 64.dp)
            Row(
                Modifier.align(Alignment.TopStart).fillMaxWidth().statusBarsPadding().padding(horizontal = 8.dp, vertical = 6.dp).horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                EBtn(c.grid?.let { "▦ ${LengthInput.fr(it, 1)} m" } ?: "▦ off", c::cycleGrid)
                EBtn("－", { c.zoom(1 / 1.4) }); EBtn("＋", { c.zoom(1.4) }); EBtn("⤢", c::fitView)
            }
        }
        Surface(color = MaterialTheme.colorScheme.background, tonalElevation = 3.dp) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ZonesInfo(c, garden)
                EMessage(c, c.helpText, maxLines = 2)
                ZonesKindBar(c)
                if (hasDetail && c.detailOpen) Column(Modifier.fillMaxWidth().heightIn(max = 170.dp).verticalScroll(rememberScrollState())) { ZonesDetail(c, garden) }
                Column(Modifier.fillMaxWidth().heightIn(max = 150.dp).verticalScroll(rememberScrollState())) { ZonesDock(c, garden, horizontal = true) }
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
    ZonesDialogs(c, garden)
}

@Suppress("unused") private val keepImports = listOf(Zone::class, PolygonShape::class)
