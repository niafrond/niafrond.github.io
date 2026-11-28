package fr.jardin.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import fr.jardin.app.plan.NorthBadge
import fr.jardin.core.Garden
import fr.jardin.core.Point
import fr.jardin.core.app.SunStep
import fr.jardin.core.bounds
import fr.jardin.core.plan.NorthIndicator
import fr.jardin.core.plan.PlanView
import fr.jardin.core.pointInPolygon

private fun sunColor(level: String) = when (level) {
    "full" -> Color(0xFFF9C74F); "partial" -> Color(0xFFF4A261); else -> Color(0xFF7A8FB5)
}

/** Étape 4 « Soleil » : inconnu / un niveau / carte (zones à corriger au toucher) / estimation automatique. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SunStepScreen(garden: Garden, onChange: ((Garden) -> Garden) -> Unit) {
    val ctx = LocalContext.current
    var estimated by remember { mutableStateOf(false) }
    var brush by remember { mutableStateOf("full") }
    val view = SunStep.viewOf(garden)
    val shownMode = if (estimated && view == "map") "estimated" else view

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(SunStep.TITLE, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(SunStep.HINT, color = MaterialTheme.colorScheme.onSurfaceVariant)
                SunStep.MODES.forEach { m ->
                    Row(
                        Modifier.fillMaxWidth().pointerInput(m.id, garden.sun.mode) {
                            detectTapGestures {
                                when (m.id) {
                                    "unknown" -> { estimated = false; onChange { g -> SunStep.setUnknown(g) } }
                                    "uniform" -> { estimated = false; onChange { g -> if (g.sun.mode == "uniform") g else SunStep.setUniform(g, null) } }
                                    "map" -> { estimated = false; onChange { g -> if (g.sun.mode == "map") g else SunStep.setMap(g) } }
                                    else -> {
                                        val e = SunStep.estimate(garden)
                                        val eg = e.garden
                                        if (eg == null) toast(ctx, e.error ?: "Estimation impossible")
                                        else { estimated = true; onChange { _ -> eg } }
                                    }
                                }
                            }
                        },
                        verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        RadioButton(selected = m.id == shownMode, onClick = null, modifier = Modifier.padding(top = 4.dp))
                        Column(Modifier.padding(vertical = 6.dp)) { Text(m.label, fontWeight = FontWeight.SemiBold); Text(m.hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
            }
        }
        when (view) {
            "uniform" -> Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Ensoleillement du jardin", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    SunStep.LEVELS.forEach { (id, label) ->
                        Row(
                            Modifier.fillMaxWidth().pointerInput(id) { detectTapGestures { onChange { g -> SunStep.setUniform(g, id) } } },
                            verticalAlignment = Alignment.CenterVertically,
                        ) { RadioButton(selected = garden.sun.uniform == id, onClick = null); Text(label, Modifier.padding(start = 8.dp, top = 8.dp, bottom = 8.dp)) }
                    }
                }
            }
            "map" -> Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (shownMode == "estimated") Notice(SunStep.ESTIMATE_NOTE)
                    if (garden.boundary.size < 3) Notice(SunStep.NO_CONTOUR, warn = true)
                    else {
                        SunMap(garden, onTap = { i -> onChange { g -> SunStep.relevel(g, i, brush) } })
                        Text("Touchez un secteur pour lui donner le niveau choisi :", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            SunStep.LEVELS.forEach { (id, label) -> Chip(label, brush == id, { brush = id }) }
                        }
                        val areas = SunStep.areaByLevel(garden)
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            SunStep.LEVELS.forEach { (id, _) ->
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Box(Modifier.size(12.dp).clip(RoundedCornerShape(3.dp)).background(sunColor(id)))
                                    Text("${BedsFmt.m2(areas[id] ?: 0.0)} m²", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = {
                                val e = SunStep.estimate(garden)
                                val eg = e.garden
                                if (eg == null) toast(ctx, e.error ?: "Estimation impossible") else { estimated = true; onChange { _ -> eg } }
                            }) { Text("Estimer automatiquement") }
                            OutlinedButton(onClick = { estimated = false; onChange { g -> SunStep.fillAll(g, brush) } }) { Text("Tout le terrain en un secteur") }
                        }
                    }
                }
            }
        }
    }
}

object BedsFmt { fun m2(a: Double): String = fr.jardin.core.app.BedsStep.fmt1(a) }

/** Carte d'ensoleillement : contour + secteurs colorés par niveau ; un toucher renvoie l'indice du secteur. */
@Composable
private fun SunMap(garden: Garden, onTap: (Int) -> Unit) {
    var size by remember { mutableStateOf(androidx.compose.ui.unit.IntSize.Zero) }
    val view = remember(size, garden.boundary) {
        if (size.width > 0) PlanView().withSize(size.width.toDouble(), size.height.toDouble()).fit(bounds(garden.boundary), 1.15) else PlanView()
    }
    val outline = MaterialTheme.colorScheme.onSurface
    Box(
        Modifier.fillMaxWidth().height(300.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant)
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp)).onSizeChanged { size = it },
    ) {
        Canvas(
            Modifier.fillMaxWidth().height(300.dp).pointerInput(view, garden.sun.regions) {
                detectTapGestures { o ->
                    val w = view.toWorld(o.x.toDouble(), o.y.toDouble())
                    val i = garden.sun.regions.indexOfLast { pointInPolygon(w, it.points) }
                    if (i >= 0) onTap(i)
                }
            },
        ) {
            fun path(pts: List<Point>) = Path().apply {
                pts.forEachIndexed { i, p -> val s = view.toScreen(p); if (i == 0) moveTo(s.x.toFloat(), s.y.toFloat()) else lineTo(s.x.toFloat(), s.y.toFloat()) }
                close()
            }
            drawPath(path(garden.boundary), Color.White.copy(alpha = 0.6f))
            garden.sun.regions.forEach { r -> if (r.points.size >= 3) drawPath(path(r.points), sunColor(r.level).copy(alpha = 0.65f)) }
            drawPath(path(garden.boundary), outline, style = Stroke(width = 3f))
        }
        val ctx = garden.context
        NorthBadge(ctx.northAngle, NorthIndicator.known(ctx.orientation, ctx.northAngle), null, Modifier.align(Alignment.TopEnd).padding(6.dp), size = 44.dp)
    }
}
