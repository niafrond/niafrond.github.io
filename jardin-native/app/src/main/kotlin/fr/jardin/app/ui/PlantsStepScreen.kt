package fr.jardin.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import fr.jardin.core.Ambiances
import fr.jardin.core.Catalog
import fr.jardin.core.Garden
import fr.jardin.core.Maintenance
import fr.jardin.core.PlantFilters
import fr.jardin.core.Planting
import fr.jardin.core.Recommendation
import fr.jardin.core.Zone
import fr.jardin.core.app.PlantsStep
import fr.jardin.core.app.PondReport
import fr.jardin.core.getZoneType

private fun Modifier.card() = this.fillMaxWidth()

@Composable
private fun Section(content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

/** Étape 8 « Essences » : essences recommandées par zone, quantités et espacements, Surprends-moi, mares, fiche avec photo. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PlantsStepScreen(garden: Garden, onChange: ((Garden) -> Garden) -> Unit, goTo: (String) -> Unit) {
    val ctx = LocalContext.current
    if (garden.zones.isEmpty()) {
        Section {
            Text(PlantsStep.NO_ZONE_TITLE, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(PlantsStep.NO_ZONE_TEXT)
            Button(onClick = { goTo("zones") }) { Text("← Dessiner les zones") }
        }
        return
    }

    var zoneId by remember { mutableStateOf(garden.zones[0].id) }
    val zone: Zone = garden.zones.firstOrNull { it.id == zoneId } ?: garden.zones[0]
    var foliage by remember { mutableStateOf("") }
    var checks by remember { mutableStateOf(setOf<String>()) }
    var query by remember { mutableStateOf("") }
    var showDisc by remember { mutableStateOf(false) }
    var limit by remember { mutableStateOf(PlantsStep.PAGE) }
    var budgetText by remember { mutableStateOf("") }
    var proposal by remember { mutableStateOf<PlantsStep.Proposal?>(null) }
    var summary by remember { mutableStateOf("") }
    var round by remember { mutableStateOf(0) }
    var recalcRound by remember { mutableStateOf(0) }
    val baseSeed = remember { System.currentTimeMillis() }
    var askFor by remember { mutableStateOf<Pair<String, List<Zone>>?>(null) }  // (clé, zones) en attente de l'ambiance
    var confirmAll by remember { mutableStateOf(false) }
    var ambianceFor by remember { mutableStateOf(false) }
    var detail by remember { mutableStateOf<Pair<fr.jardin.core.Plant, Recommendation?>?>(null) }
    var depthText by remember(zone.id) { mutableStateOf("") }
    var depthErr by remember(zone.id) { mutableStateOf<String?>(null) }

    fun upd(zoneUpdate: (Zone) -> Zone) = onChange { g -> g.copy(zones = g.zones.map { if (it.id == zoneId) zoneUpdate(it) else it }) }
    val max = PlantsStep.parseBudget(budgetText)
    val filters = PlantFilters(
        foliage = foliage.ifEmpty { null }, melliferous = "melliferous" in checks, edible = "edible" in checks, lowMaintenance = "lowMaintenance" in checks,
        lowWater = "lowWater" in checks, nonToxic = "nonToxic" in checks, nonInvasive = "nonInvasive" in checks,
    )

    fun runPropose(key: String, targets: List<String>, amb: Map<String, String?>, maint: String?) {
        val r = PlantsStep.propose(garden, key, targets, amb, maint, max, round, baseSeed, proposal)
        val g2 = r.garden
        if (g2 == null) { toast(ctx, r.message); return }
        round += 1
        onChange { g -> g.copy(zones = g2.zones, context = g2.context) }
        proposal = r.proposal; summary = r.summary; limit = PlantsStep.PAGE
        toast(ctx, r.message)
    }
    fun startPropose(key: String, targets: List<Zone>) {
        if (targets.isEmpty()) { toast(ctx, "Aucune zone à garnir."); return }
        if (proposal?.key == key) { runPropose(key, proposal!!.snapshot.keys.toList(), emptyMap(), null); return }
        askFor = key to targets
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // entretien du jardin
        Section {
            Text("Quel niveau d’entretien ?", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text("Les essences conseillées s’adaptent au temps que vous voulez y consacrer.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            MaintenanceChips(Maintenance.levelForZone(garden, null), { id -> onChange { g -> PlantsStep.setGardenMaintenance(g, id ?: "green") }; limit = PlantsStep.PAGE }, cards = true)
        }

        // surprends-moi pour tout le jardin + budget
        val bud = PlantsStep.budget(garden, zone, max)
        Section {
            Button(
                onClick = {
                    val plantable = PlantsStep.plantableZones(garden)
                    val empty = plantable.filter { it.plantings.isEmpty() }
                    when {
                        proposal?.key == "all" -> startPropose("all", plantable)
                        empty.isNotEmpty() -> startPropose("all", empty)
                        plantable.isEmpty() -> toast(ctx, "Aucune zone à garnir.")
                        else -> confirmAll = true
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text(if (proposal?.key == "all") "🎲 Autre proposition" else "🎲 Surprends-moi pour tout le jardin") }
            OutlinedTextField(
                value = budgetText, onValueChange = { budgetText = it }, label = { Text("Budget max en € (facultatif)") }, placeholder = { Text("Sans limite") },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = Modifier.fillMaxWidth(),
            )
            if (summary.isNotEmpty()) Text(summary, style = MaterialTheme.typography.bodyMedium)
            if (proposal != null) OutlinedButton(onClick = {
                onChange { g -> PlantsStep.undo(g, proposal!!) }
                proposal = null; summary = ""; round += 1
                toast(ctx, "Proposition annulée : sélection précédente restaurée.")
            }) { Text("Annuler la proposition") }
        }

        // budget estimé
        Card(
            Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = if (bud.over) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer),
        ) {
            Column(Modifier.padding(12.dp)) {
                Text(bud.main, fontWeight = FontWeight.Bold)
                Text(bud.sub, style = MaterialTheme.typography.bodySmall)
            }
        }

        // avertissements de cohérence
        PlantsStep.coherence(garden).forEach { w -> Notice((if (w.level == "warn") "⚠️ " else "ℹ️ ") + w.text, warn = w.level == "warn") }

        // la zone
        Section {
            DropdownField(
                "Zone", zone.id, garden.zones.map { Choice(it.id, PlantsStep.zoneLabel(it)) },
                onSelect = { id -> if (id != null) { zoneId = id; limit = PlantsStep.PAGE } },
            )
            Text(PlantsStep.zoneInfo(zone), color = MaterialTheme.colorScheme.onSurfaceVariant)
            ZoneHead(garden, zone, onAmbiance = { ambianceFor = true }, onMaintenance = { id -> upd { PlantsStep.setZoneMaintenance(it, id) }; limit = PlantsStep.PAGE }, onRecalc = {
                recalcRound += 1
                val nz = PlantsStep.recalcBed(garden, zone, recalcRound)
                if (nz == null) toast(ctx, "Aucune autre combinaison trouvée pour ce massif.")
                else { upd { nz }; limit = PlantsStep.PAGE; toast(ctx, "Massif recalculé : nouvelle combinaison de plantes.") }
            })
            val pond = PlantsStep.pond(garden, zone)
            if (pond != null) PondBox(pond, depthText.ifEmpty { pond.depth.toString() }, depthErr, onDepth = { depthText = it }, onCommit = {
                val (nz, err) = PlantsStep.setPondDepth(zone, depthText.ifEmpty { pond.depth.toString() })
                depthErr = err
                if (err == null) { upd { nz }; limit = PlantsStep.PAGE }
            }, onRemoveBad = { upd { z -> PlantsStep.removeBadPond(z, pond) } })
            ChosenList(garden, zone, onCount = { i, n -> upd { PlantsStep.setCount(it, i, n) } }, onRemove = { i -> upd { PlantsStep.removePlant(it, i) } },
                onOpen = { p -> detail = p to PlantsStep.reasonFor(garden, zone, p.id) },
                onHeight = { i, raw ->
                    val pl = zone.plantings[i]; val p = Catalog.getPlant(pl.plantId)
                    if (p == null) "" else {
                        val e = PlantsStep.editHeight(p, pl, raw)
                        if (e.ok) upd { z -> z.copy(plantings = z.plantings.mapIndexed { k, q -> if (k == i) e.planting else q }) }
                        e.note
                    }
                },
                onResetHeight = { i -> upd { z -> z.copy(plantings = z.plantings.mapIndexed { k, q -> if (k == i) PlantsStep.resetHeight(q) else q }) } },
                onFix = { upd { PlantsStep.fitZone(garden, it) }; toast(ctx, "Quantités ajustées : espacements respectés.") })
            OutlinedButton(onClick = { startPropose("zone:${zone.id}", listOf(zone)) }) { Text(if (proposal?.key == "zone:${zone.id}") "🎲 Autre proposition" else "🎲 Surprends-moi") }
        }

        // liste
        Section {
            Text("Essences conseillées", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = query, onValueChange = { query = it; limit = PlantsStep.PAGE }, label = { Text("Rechercher (nom commun ou latin)") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            var fOpen by remember { mutableStateOf(false) }
            OutlinedButton(onClick = { fOpen = !fOpen }) { Text(if (fOpen) "Filtres ▴" else "Filtres ▾") }
            if (fOpen) {
                DropdownField("Feuillage", foliage.ifEmpty { null }, PlantsStep.FOLIAGE.map { Choice(it.first.ifEmpty { null }, it.second) }, onSelect = { foliage = it ?: ""; limit = PlantsStep.PAGE })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PlantsStep.CHECKS.forEach { (k, l) -> Chip(l, k in checks, { checks = if (k in checks) checks - k else checks + k; limit = PlantsStep.PAGE }) }
                    Chip("Afficher les déconseillées", showDisc, { showDisc = !showDisc; limit = PlantsStep.PAGE })
                }
            }
            val recs = PlantsStep.list(garden, zone, filters, query, showDisc)
            if (recs.isEmpty()) Text(PlantsStep.EMPTY_LIST, color = MaterialTheme.colorScheme.onSurfaceVariant)
            recs.take(limit).forEach { r ->
                key(zone.id, r.plant.id) {
                    PlantCard(PlantsStep.row(garden, zone, r), zone,
                        onAdd = { n -> upd { PlantsStep.addPlant(it, r.plant.id, n) } },
                        onRemove = { upd { PlantsStep.removeById(it, r.plant.id) } },
                        onOpen = { detail = r.plant to r })
                }
            }
            if (recs.size > limit) OutlinedButton(onClick = { limit += PlantsStep.PAGE }, modifier = Modifier.fillMaxWidth()) { Text("Afficher plus (${recs.size - limit} restantes)") }
            if (zone.type == "pond") PondExcluded(PlantsStep.pond(garden, zone))
        }
    }

    // fenêtres
    askFor?.let { (key, zs) ->
        SurpriseDialog(garden, zs, onCancel = { askFor = null }, onConfirm = { c ->
            askFor = null
            runPropose(key, zs.map { it.id }, c.ambiances, c.maintenance)
        })
    }
    if (ambianceFor) SurpriseDialog(garden, listOf(zone), askMaintenance = false, onCancel = { ambianceFor = false }, onConfirm = { c ->
        ambianceFor = false
        val id = c.ambiances[zone.id]
        upd { it.copy(ambiance = id) }; limit = PlantsStep.PAGE
        toast(ctx, if (id != null) "Ambiance « ${Ambiances.getAmbiance(id)?.label} » enregistrée pour cette zone." else "Ambiance retirée pour cette zone.")
    })
    if (confirmAll) ConfirmDialog("Toutes les zones ont déjà des essences. Les remplacer par une proposition ? (vous pourrez l’annuler)", "Remplacer",
        onOk = { confirmAll = false; startPropose("all", PlantsStep.plantableZones(garden)) }, onCancel = { confirmAll = false })
    detail?.let { (p, r) -> PlantDetailDialog(p, zone.plantings.firstOrNull { it.plantId == p.id }, r) { detail = null } }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ZoneHead(garden: Garden, zone: Zone, onAmbiance: () -> Unit, onMaintenance: (String?) -> Unit, onRecalc: () -> Unit) {
    val amb = Ambiances.getAmbiance(PlantsStep.zoneAmbiance(zone))
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(zone.label.ifEmpty { "Zone" }, fontWeight = FontWeight.Bold)
            if (zone.auto) Text("✨ auto", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        }
        Text(if (amb != null) "${amb.emoji} ambiance ${amb.label.lowercase()}" else "Ambiance : peu importe", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = onAmbiance) { Text("Changer l’ambiance") }
        Text("Entretien de cette zone", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        MaintenanceChips(zone.maintenance, onMaintenance, inherit = true)
        if (zone.auto) PlantsStep.autoWhy(zone)?.let {
            Text(it, style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = onRecalc) { Text("🎲 Recalculer ce massif") }
        }
    }
}

@Composable
private fun PondBox(r: PondReport, depth: String, err: String?, onDepth: (String) -> Unit, onCommit: () -> Unit, onRemoveBad: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        OutlinedTextField(
            value = depth, onValueChange = onDepth, label = { Text("Profondeur de la mare (cm)") }, singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = androidx.compose.ui.text.input.ImeAction.Done),
            keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { onCommit() }),
            supportingText = { Text(err ?: r.hint) }, isError = err != null, modifier = Modifier.fillMaxWidth(),
        )
        TextButton(onClick = onCommit) { Text("Appliquer la profondeur") }
        Text(r.summary, style = MaterialTheme.typography.bodyMedium)
        r.alert?.let { Notice(it, warn = true); OutlinedButton(onClick = onRemoveBad) { Text("Retirer ces essences") } }
    }
}

@Composable
private fun PondExcluded(r: PondReport?) {
    if (r == null || r.excluded.isEmpty()) return
    var open by remember { mutableStateOf(false) }
    OutlinedButton(onClick = { open = !open }) { Text("Écartées pour cette mare (${r.excluded.size}) ${if (open) "▴" else "▾"}") }
    if (open) r.excluded.forEach { (p, why) -> Reason(false, "${p.commonName} : ${why.joinToString(" ; ")}") }
}

@Composable
private fun ChosenList(
    garden: Garden, zone: Zone, onCount: (Int, Int) -> Unit, onRemove: (Int) -> Unit, onOpen: (fr.jardin.core.Plant) -> Unit,
    onHeight: (Int, String) -> String, onResetHeight: (Int) -> Unit, onFix: () -> Unit,
) {
    val rows = PlantsStep.chosenRows(garden, zone)
    val total = fr.jardin.core.Pricing.gardenCost(garden, Catalog::getPlant).byZone.firstOrNull { it.zoneId == zone.id }?.total ?: 0.0
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Dans cette zone (${rows.size})" + if (total != 0.0) " · ≈ ${fr.jardin.core.Pricing.formatEuro(total, 0)}" else "", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        if (rows.isEmpty()) Text("Aucune essence choisie pour l’instant.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        rows.forEachIndexed { i, row ->
            val p = row.plant
            key(zone.id, i, row.planting.plantId) {
                Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                    Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (p != null) PlantThumb(p, 48.dp, onClick = { onOpen(p) })
                            Column(Modifier.weight(1f)) {
                                Text(p?.commonName ?: row.planting.plantId, fontWeight = FontWeight.SemiBold)
                                if (p != null) Text(p.latinName, fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                if (row.lineTotal.isNotEmpty()) Text(row.lineTotal, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            TextButton(onClick = { onRemove(i) }) { Text("🗑", color = MaterialTheme.colorScheme.error) }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            OutlinedButton(onClick = { onCount(i, PlantsStep.countOf(row.planting) - 1) }) { Text("−") }
                            var txt by remember(row.planting.count, row.planting.quantity) { mutableStateOf(PlantsStep.countOf(row.planting).toString()) }
                            OutlinedTextField(
                                value = txt, onValueChange = { t -> txt = t.filter { it.isDigit() }.take(3); txt.toIntOrNull()?.let { n -> if (n >= 1) onCount(i, n) } },
                                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.width(84.dp),
                            )
                            OutlinedButton(onClick = { onCount(i, PlantsStep.countOf(row.planting) + 1) }) { Text("+") }
                        }
                        if (row.density.isNotEmpty()) Text(row.density, style = MaterialTheme.typography.bodySmall, color = if (row.overMax) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                        if (p != null) HeightField(row, p, onHeight = { raw -> onHeight(i, raw) }, onReset = { onResetHeight(i) })
                    }
                }
            }
        }
        val warns = PlantsStep.spacingWarnings(garden, zone)
        warns.forEach { w -> Notice((if (w.level == "warn") "⚠️ " else "ℹ️ ") + w.text, warn = w.level == "warn") }
        if (PlantsStep.spacingFixable(warns)) OutlinedButton(onClick = onFix) { Text("Ajuster automatiquement") }
    }
}

@Composable
private fun HeightField(row: fr.jardin.core.app.ChosenRow, p: fr.jardin.core.Plant, onHeight: (String) -> String, onReset: () -> Unit) {
    var txt by remember(row.planting.height) { mutableStateOf(row.heightCm) }
    var note by remember { mutableStateOf("") }
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = txt, onValueChange = { txt = it.filter { c -> c.isDigit() || c == ',' || c == '.' }.take(6) },
                label = { Text("Hauteur (cm)") }, placeholder = { Text(fr.jardin.core.heightToCm(p.heightAdult.takeIf { it > 0 } ?: 0.5)) },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { note = onHeight(txt) }),
                modifier = Modifier.width(150.dp),
            )
            TextButton(onClick = { note = onHeight(txt) }) { Text("OK") }
            TextButton(onClick = { txt = ""; note = ""; onReset() }, enabled = row.customHeight) { Text("↺ Valeur par défaut") }
        }
        Text(row.heightState, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (note.isNotEmpty()) Text(note, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PlantCard(row: fr.jardin.core.app.PlantRow, zone: Zone, onAdd: (Int) -> Unit, onRemove: () -> Unit, onOpen: () -> Unit) {
    val r = row.rec; val p = r.plant
    var why by remember { mutableStateOf(false) }
    var qty by remember(zone.id, p.id) { mutableStateOf(row.suggestedQty.toString()) }
    val border = when (r.status) { "ideal" -> Color0(0xFF2E7D32); "possible" -> Color0(0xFFC9A227); else -> Color0(0xFFB3261E) }
    Card(
        Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, if (row.maintenanceOk) border.copy(alpha = 0.5f) else MaterialTheme.colorScheme.outline),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) { PlantThumb(p, 56.dp, onClick = onOpen); PhotoCredit(p) }
                Column(Modifier.weight(1f)) {
                    Text(p.commonName, fontWeight = FontWeight.SemiBold)
                    Text(p.latinName, fontStyle = FontStyle.Italic, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Swatches(p)
                    if (row.typical) Text("✓ ambiance", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
                Text("${row.statusLabel} · ${r.score}", color = border, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
            }
            Text((if (row.bloom.isNotEmpty()) "Floraison : ${row.bloom} · " else "") + "Hauteur adulte ${PlantsStep.fmtNum(p.heightAdult)} m × ${PlantsStep.fmtNum(p.widthAdult)} m", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("${p.sun.mapNotNull { PlantsStep.SUNL[it] }.joinToString("/")} · ${PlantsStep.WATER[p.water] ?: ""} · rustique à ${PlantsStep.fmtNum(p.hardiness)} °C", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(row.priceLabel ?: "Prix non renseigné", style = MaterialTheme.typography.bodySmall, color = if (row.priceLabel != null) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
            Text("🧤×${row.effort} Entretien : ${Maintenance.effortLabel(row.effort)}" + if (!row.maintenanceOk) " · demande de l’entretien" else "", style = MaterialTheme.typography.bodySmall, color = if (row.maintenanceOk) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error)
            TextButton(onClick = { why = !why }) { Text("Pourquoi ? ${if (why) "▴" else "▾"}") }
            if (why) r.reasons.forEach { Reason(it.ok, it.text) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                if (row.alreadyIn) OutlinedButton(onClick = onRemove) { Text("Retirer") }
                else {
                    OutlinedTextField(
                        value = qty, onValueChange = { qty = it.filter { c -> c.isDigit() }.take(3) }, singleLine = true, label = { Text("Quantité") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.width(110.dp),
                    )
                    Button(onClick = { onAdd(qty.toIntOrNull() ?: 1) }) { Text("Ajouter") }
                }
            }
        }
    }
}

private fun Color0(v: Long) = androidx.compose.ui.graphics.Color(v)
