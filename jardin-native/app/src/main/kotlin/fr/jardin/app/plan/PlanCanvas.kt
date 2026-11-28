package fr.jardin.app.plan

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalViewConfiguration
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.ui.input.pointer.positionChange
import fr.jardin.core.CircleShape as CircleZone
import fr.jardin.core.EDGE_KINDS
import fr.jardin.core.EXISTING_KINDS
import fr.jardin.core.Garden
import fr.jardin.core.LineShape
import fr.jardin.core.Point
import fr.jardin.core.ZONE_TYPES
import fr.jardin.core.centroid
import fr.jardin.core.distance
import fr.jardin.core.edgeKindOf
import fr.jardin.core.existingFootprint
import fr.jardin.core.getEdgeKind
import fr.jardin.core.getItemKind
import fr.jardin.core.itemPolygon
import fr.jardin.core.shapePolygon
import fr.jardin.core.signedArea
import fr.jardin.core.plan.ContourState
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.NorthIndicator
import fr.jardin.core.plan.PlanHit
import fr.jardin.core.plan.PlanView
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.sign

/** Geste de glissé pris en charge par l'éditeur (ex. déplacer un sommet) : le plan ne se déplace pas pendant ce temps. */
interface PlanDrag {
    fun move(w: Point)
    /** `moved` : le doigt a dépassé le seuil de glissement (sinon c'est un simple toucher du sommet). */
    fun up(w: Point, moved: Boolean)
    fun cancel()
}

/** Ce que l'éditeur ajoute au rendu de base : contour en cours, sélection, aimantation, aide. */
data class PlanOverlay(
    val contour: ContourState = ContourState(),
    val editable: Boolean = false,
    val selectedVertex: Int? = null,
    val selectedSide: Int? = null,
    /** Point aimanté sous le doigt / curseur (trait pointillé depuis le dernier sommet). */
    val ghost: Point? = null,
    val grid: Double? = null,
)

/** Orientation du plan : angle du nord (0 = nord en haut, sens horaire). `known` = false : pastille en pointillés + « ? ». */
data class PlanNorth(val angle: Double, val known: Boolean, val onClick: (() -> Unit)? = null)

private fun hex(s: String?, fallback: Color = Color.Gray): Color {
    val h = s?.removePrefix("#") ?: return fallback
    return try {
        when (h.length) {
            6 -> Color(0xFF000000L or h.toLong(16))
            3 -> Color(0xFF000000L or h.map { "$it$it" }.joinToString("").toLong(16))
            else -> fallback
        }
    } catch (_: NumberFormatException) { fallback }
}

/**
 * Plan 2D vectoriel réutilisable (équivalent de `createCanvas` + rendus de jardin/ui et render*.js).
 * Sans état : la vue ([PlanView]) et le contour édité sont fournis par l'appelant.
 *
 * Gestes : un doigt glisse = déplacement du plan (sauf si `onDown` renvoie un [PlanDrag]) ; deux doigts = zoom + déplacement ;
 * toucher = `onTap` ; appui long (≈ 0,5 s sans bouger, avec vibration) = `onLong`.
 */
@Composable
fun PlanCanvas(
    view: PlanView,
    onViewChange: (PlanView) -> Unit,
    garden: Garden,
    modifier: Modifier = Modifier,
    overlay: PlanOverlay = PlanOverlay(),
    north: PlanNorth? = null,
    /** Bande du haut recouverte par une barre d'outils flottante : la pastille du Nord se place dessous. */
    topInset: androidx.compose.ui.unit.Dp = 0.dp,
    onDown: (Point) -> PlanDrag? = { null },
    onTap: (Point) -> Unit = {},
    onLong: (Point) -> Unit = {},
    onSize: (Double, Double) -> Unit = { _, _ -> },
    description: String = "Plan du jardin",
) {
    val density = LocalDensity.current
    val haptic = LocalHapticFeedback.current
    val textMeasurer = rememberTextMeasurer()
    val viewState = rememberUpdatedState(view)
    val onViewChangeS = rememberUpdatedState(onViewChange)
    val onDownS = rememberUpdatedState(onDown)
    val onTapS = rememberUpdatedState(onTap)
    val onLongS = rememberUpdatedState(onLong)
    val slop = LocalViewConfiguration.current.touchSlop
    val longMs = 480L
    val colors = PlanColors(
        bg = MaterialTheme.colorScheme.surface, fg = MaterialTheme.colorScheme.onSurface,
        grid = MaterialTheme.colorScheme.outline, accent = MaterialTheme.colorScheme.primary,
        muted = MaterialTheme.colorScheme.onSurfaceVariant, err = MaterialTheme.colorScheme.error,
    )

    Box(modifier.clipToBounds().background(colors.bg).onSizeChanged { onSize(it.width.toDouble(), it.height.toDouble()) }) {
        Canvas(
            Modifier.fillMaxSize()
                .semantics { contentDescription = description }
                .pointerInput(slop) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        val id = down.id
                        val startPos = down.position
                        var cur = viewState.value
                        val startW = cur.toWorld(startPos.x.toDouble(), startPos.y.toDouble())
                        var drag: PlanDrag? = onDownS.value(startW)
                        down.consume()

                        // phase 1 : toucher / appui long / début de glissement / second doigt
                        var outcome = 0 // 0 appui long, 1 relâché, 2 glissé, 3 pincement
                        val r = withTimeoutOrNull(longMs) {
                            while (true) {
                                val ev = awaitPointerEvent()
                                if (ev.changes.count { it.pressed } >= 2) { outcome = 3; return@withTimeoutOrNull }
                                val c = ev.changes.firstOrNull { it.id == id } ?: continue
                                if (c.changedToUp()) { outcome = 1; c.consume(); return@withTimeoutOrNull }
                                val d = c.position - startPos
                                if (hypot(d.x.toDouble(), d.y.toDouble()) > slop) { outcome = 2; return@withTimeoutOrNull }
                            }
                        }
                        if (r == null) {
                            // appui long
                            drag?.cancel(); drag = null
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            onLongS.value(startW)
                            // on attend le relâchement sans rien faire d'autre
                            while (true) {
                                val ev = awaitPointerEvent()
                                ev.changes.forEach { it.consume() }
                                if (ev.changes.none { it.pressed }) break
                            }
                            return@awaitEachGesture
                        }
                        if (outcome == 1) {
                            val d = drag
                            if (d != null) d.up(startW, false) else onTapS.value(startW)
                            return@awaitEachGesture
                        }
                        if (outcome == 3) { drag?.cancel(); drag = null }

                        // phase 2 : glissé (plan ou élément) ou pincement
                        var pinching = outcome == 3
                        while (true) {
                            val ev = awaitPointerEvent()
                            val pressed = ev.changes.count { it.pressed }
                            if (pressed == 0) {
                                val last = ev.changes.firstOrNull { it.id == id }
                                if (drag != null && !pinching) {
                                    val p = last?.position ?: startPos
                                    drag.up(cur.toWorld(p.x.toDouble(), p.y.toDouble()), true)
                                }
                                break
                            }
                            if (pressed >= 2 && !pinching) { drag?.cancel(); drag = null; pinching = true }
                            if (pinching || drag == null) {
                                val zoom = ev.calculateZoom()
                                val pan = ev.calculatePan()
                                val c = ev.calculateCentroid(useCurrent = true)
                                if (zoom != 1f || pan != Offset.Zero) {
                                    cur = cur.panBy(pan.x.toDouble(), pan.y.toDouble())
                                    if (zoom != 1f && c.isSpecified) cur = cur.zoomAt(c.x.toDouble(), c.y.toDouble(), zoom.toDouble())
                                    onViewChangeS.value(cur)
                                }
                            } else {
                                val c = ev.changes.firstOrNull { it.id == id }
                                if (c != null) drag.move(cur.toWorld(c.position.x.toDouble(), c.position.y.toDouble()))
                            }
                            ev.changes.forEach { if (it.positionChange() != Offset.Zero) it.consume() }
                        }
                    }
                },
        ) {
            drawPlan(viewState.value, garden, overlay, colors, textMeasurer, with(density) { 1.dp.toPx() })
        }
        if (north != null) {
            NorthBadge(
                angle = north.angle, known = north.known, onClick = north.onClick,
                modifier = Modifier.align(Alignment.TopEnd).padding(top = topInset + 8.dp, end = 8.dp),
            )
        }
    }
}

private data class PlanColors(val bg: Color, val fg: Color, val grid: Color, val accent: Color, val muted: Color, val err: Color)

private val Offset.isSpecified: Boolean get() = x.isFinite() && y.isFinite()

// ------------------------------------------------------------------ rendu

private fun DrawScope.drawPlan(view: PlanView, garden: Garden, ov: PlanOverlay, c: PlanColors, tm: TextMeasurer, dp: Float) {
    fun sp(p: Point): Offset { val s = view.toScreen(p); return Offset(s.x.toFloat(), s.y.toFloat()) }
    fun path(pts: List<Point>, close: Boolean) = Path().apply {
        pts.forEachIndexed { i, p -> val o = sp(p); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }
        if (close) close()
    }
    val scale = view.scale.toFloat()

    // grille : pas adaptatif (au moins ~14 dp entre deux traits), traits majeurs tous les 5 pas
    val steps = doubleArrayOf(0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 25.0, 50.0)
    val minor = steps.firstOrNull { it * view.scale >= 14 * dp } ?: steps.last()
    run {
        val tl = view.toWorld(0.0, 0.0)
        val br = view.toWorld(size.width.toDouble(), size.height.toDouble())
        var x = Math.floor(tl.x / minor) * minor
        var k = 0
        while (x <= br.x && k < 400) {
            val sx = sp(Point(x, 0.0)).x
            val major = abs(Math.round(x / minor) % 5) == 0L
            drawLine(c.grid.copy(alpha = if (major) 0.9f else 0.45f), Offset(sx, 0f), Offset(sx, size.height), strokeWidth = 1f)
            x += minor; k++
        }
        var y = Math.floor(tl.y / minor) * minor
        k = 0
        while (y <= br.y && k < 400) {
            val sy = sp(Point(0.0, y)).y
            val major = abs(Math.round(y / minor) % 5) == 0L
            drawLine(c.grid.copy(alpha = if (major) 0.9f else 0.45f), Offset(0f, sy), Offset(size.width, sy), strokeWidth = 1f)
            y += minor; k++
        }
        val o = sp(Point(0.0, 0.0)) // repère de l'origine
        drawLine(c.muted, Offset(o.x - 5 * dp, o.y), Offset(o.x + 5 * dp, o.y), 1.5f)
        drawLine(c.muted, Offset(o.x, o.y - 5 * dp), Offset(o.x, o.y + 5 * dp), 1.5f)
    }

    // zones (couleur du type, comme render*.js)
    for (z in garden.zones) {
        val sh = z.shape ?: continue
        val col = hex(ZONE_TYPES.firstOrNull { it.id == z.type }?.color)
        if (sh is LineShape && sh.points.size >= 2) {
            drawPath(path(sh.points, false), col.copy(alpha = 0.55f), style = Stroke(width = (sh.width * scale).toFloat().coerceAtLeast(2f), cap = StrokeCap.Round, join = StrokeJoin.Round))
        } else {
            val poly = shapePolygon(sh)
            if (poly.size >= 3) {
                drawPath(path(poly, true), col.copy(alpha = 0.45f))
                drawPath(path(poly, true), col, style = Stroke(1.5f * dp))
            }
        }
    }
    // obstacles
    for (o in garden.obstacles) {
        val pts = o.points
        when {
            o.kind == "tree" && o.center != null -> {
                val ctr = sp(o.center!!); val r = ((o.radius ?: 1.0) * scale).toFloat()
                drawCircle(Color(0xFF558B2F).copy(alpha = 0.25f), r, ctr)
                drawCircle(Color(0xFF33691E), r, ctr, style = Stroke(2f * dp, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f * dp, 4f * dp))))
                drawCircle(Color(0xFF33691E), 4f * dp, ctr)
            }
            pts == null -> {}
            o.kind == "wall" -> drawPath(path(pts, false), Color(0xFF424242), style = Stroke(5f * dp, join = StrokeJoin.Round))
            o.kind == "fence" -> drawPath(path(pts, false), Color(0xFF6D4C41), style = Stroke(3f * dp, pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f * dp, 4f * dp))))
            pts.size >= 3 -> {
                drawPath(path(pts, true), Color(0xFFBDBDBD).copy(alpha = 0.55f))
                drawPath(path(pts, true), Color(0xFF424242), style = Stroke(2f * dp))
                val label = if (o.kind == "house") "Maison" else if (o.kind == "shed") "Abri" else o.kind
                drawLabel(tm, label, sp(centroid(pts)), 12 * dp, Color(0xFF263238), null)
            }
        }
    }
    // existant
    for (e in garden.existing) {
        val k = EXISTING_KINDS.firstOrNull { it.id == e.kind }
        val col = hex(k?.color).copy(alpha = if (e.keep) 1f else 0.4f)
        val ep = e.points
        if (ep != null && ep.size >= 2) {
            val dashed = e.kind == "fence"
            drawPath(path(ep, false), col, style = Stroke(
                width = if (dashed) 3f * dp else (e.width * scale).toFloat().coerceAtLeast(3f * dp), cap = StrokeCap.Round, join = StrokeJoin.Round,
                pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(8f * dp, 4f * dp)) else null))
        } else {
            val foot = existingFootprint(e)
            if (foot.size >= 3) {
                drawPath(path(foot, true), col.copy(alpha = col.alpha * 0.3f))
                drawPath(path(foot, true), col, style = Stroke(2f * dp, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f * dp, 4f * dp))))
            }
            drawCircle(col, 4f * dp, sp(Point(e.x, e.y)))
        }
    }
    // aménagements
    for (it in garden.items) {
        val k = getItemKind(it.kind)
        val poly = itemPolygon(it)
        val col = hex(k?.color, Color(0xFFA1887F))
        drawPath(path(poly, true), col.copy(alpha = 0.85f))
        drawPath(path(poly, true), c.fg.copy(alpha = 0.55f), style = Stroke(1.2f * dp))
        if (k != null && view.scale * minOf(it.width, it.depth) > 28 * dp) drawLabel(tm, k.short, sp(Point(it.x, it.y)), 10 * dp, c.fg, null)
    }

    // contour
    val b = ov.contour.points
    val n = b.size
    val closed = ov.contour.isClosed
    if (n >= 2) {
        if (closed) {
            drawPath(path(b, true), c.accent.copy(alpha = 0.12f))
            drawPath(path(b, true), c.fg, style = Stroke(2.5f * dp, join = StrokeJoin.Round))
        } else drawPath(path(b, false), c.fg, style = Stroke(2.5f * dp, join = StrokeJoin.Round))
        // murs / clôtures / haies des côtés
        for (i in 0 until PlanHit.sideCount(n, closed)) {
            val kind = edgeKindOf(garden, i)
            if (kind == "open") continue
            val ec = hex(getEdgeKind(kind)?.color)
            drawLine(ec, sp(b[i]), sp(b[(i + 1) % n]), strokeWidth = (if (kind == "wall") 5f else 3.5f) * dp, cap = StrokeCap.Round,
                pathEffect = if (kind == "fence") PathEffect.dashPathEffect(floatArrayOf(8f * dp, 4f * dp)) else null)
        }
        ov.selectedSide?.let { si ->
            if (si in 0 until PlanHit.sideCount(n, closed)) drawLine(Color(0xFFD81B60), sp(b[si]), sp(b[(si + 1) % n]), strokeWidth = 5f * dp, cap = StrokeCap.Round)
        }
        // cotes
        val sgn = if (closed) sign(signedArea(b)).let { if (it == 0.0) 1.0 else it } else 1.0
        for (i in 0 until PlanHit.sideCount(n, closed)) drawDim(tm, sp(b[i]), sp(b[(i + 1) % n]), distance(b[i], b[(i + 1) % n]), 12 * dp, sgn, c)
    }
    if (ov.editable) {
        // poignées « + » au milieu des côtés (toucher = saisir la longueur, glisser = insérer un sommet)
        for (i in 0 until PlanHit.sideCount(n, closed)) {
            val a = b[i]; val d = b[(i + 1) % n]
            if (distance(a, d) < 50 * dp / view.scale) continue
            val m = sp(Point((a.x + d.x) / 2, (a.y + d.y) / 2))
            drawCircle(c.bg, 5f * dp, m); drawCircle(Color(0xFF0D47A1), 5f * dp, m, style = Stroke(1.5f * dp))
        }
        // sommets numérotés ; le 1er devient un grand rond vert quand on peut fermer la forme
        b.forEachIndexed { i, p ->
            val first = i == 0
            val sel = ov.selectedVertex == i
            val canClose = first && !closed && n >= 3
            val r = (if (canClose) 9f * 1.5f else 9f) * dp
            val o = sp(p)
            val green = Color(0xFF2E7D32)
            drawCircle(if (sel) Color(0xFFD81B60) else if (first) green else c.bg, r, o)
            drawCircle(if (sel) Color.White else green, r, o, style = Stroke(2.5f * dp))
            drawLabel(tm, "${i + 1}", o, 10 * dp, if (first || sel) Color.White else green, null, bold = true)
        }
        // trait d'aimantation depuis le dernier sommet
        val g = ov.ghost
        if (g != null && !closed && n > 0) {
            val last = sp(b.last()); val go = sp(g)
            if (hypot((go.x - last.x).toDouble(), (go.y - last.y).toDouble()) > 14 * dp) {
                drawLine(c.accent, last, go, 2f * dp, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f * dp, 4f * dp)))
                drawDim(tm, last, go, distance(b.last(), g), 12 * dp, 1.0, c)
            }
            drawCircle(c.accent, 5f * dp, go, style = Stroke(1.5f * dp))
        }
    }
}

private fun DrawScope.drawLabel(tm: TextMeasurer, text: String, center: Offset, fontPx: Float, color: Color, halo: Color?, bold: Boolean = false) {
    val layout = tm.measure(text, TextStyle(color = color, fontSize = (fontPx / density).sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal))
    val tl = Offset(center.x - layout.size.width / 2f, center.y - layout.size.height / 2f)
    if (halo != null) drawRoundRect(halo.copy(alpha = 0.8f), tl - Offset(3f, 1f), Size(layout.size.width + 6f, layout.size.height + 2f), androidx.compose.ui.geometry.CornerRadius(4f, 4f))
    drawText(layout, topLeft = tl)
}

/** Cote d'un côté : texte « 12,50 m » orienté le long du côté, décalé vers l'extérieur, bleu foncé sur fond du plan. */
private fun DrawScope.drawDim(tm: TextMeasurer, a: Offset, b: Offset, lengthM: Double, fontPx: Float, outward: Double, c: PlanColors) {
    if (lengthM < 1e-6) return
    val dx = b.x - a.x; val dy = b.y - a.y
    val l = hypot(dx.toDouble(), dy.toDouble()).toFloat()
    if (l < 1f) return
    var nx = dy / l; var ny = -dx / l
    if (outward < 0) { nx = -nx; ny = -ny }
    var ang = Math.toDegrees(atan2(dy.toDouble(), dx.toDouble())).toFloat()
    if (ang > 90) ang -= 180 else if (ang < -90) ang += 180
    val off = fontPx * 1.1f
    val mid = Offset((a.x + b.x) / 2 + nx * off, (a.y + b.y) / 2 + ny * off)
    val layout = tm.measure(LengthInput.frLen(lengthM), TextStyle(color = Color(0xFF0D47A1), fontSize = (fontPx / density).sp, fontWeight = FontWeight.Medium))
    withTransform({ translate(mid.x, mid.y); rotate(ang, Offset.Zero) }) {
        val w = layout.size.width.toFloat(); val h = layout.size.height.toFloat()
        drawRoundRect(c.bg.copy(alpha = 0.78f), Offset(-w / 2 - 3f, -h / 2 - 1f), Size(w + 6f, h + 2f), androidx.compose.ui.geometry.CornerRadius(4f, 4f))
        drawText(layout, topLeft = Offset(-w / 2, -h / 2))
    }
}

// ------------------------------------------------------------------ pastille du Nord

/**
 * Rose des vents ronde de 52 dp en haut à droite du plan (cible tactile >= 44 dp) : aiguille rouge (nord, avec « N » toujours
 * lisible) et grise (sud) tournée de `angle` degrés dans le sens horaire (0 = nord en haut), transition douce.
 * Orientation inconnue : contour en pointillés et « ? ».
 */
@Composable
fun NorthBadge(angle: Double, known: Boolean, onClick: (() -> Unit)?, modifier: Modifier = Modifier, size: androidx.compose.ui.unit.Dp = 52.dp) {
    val target = (NorthIndicator.normAngle(angle) ?: 0).toFloat()
    val cumRef = remember { floatArrayOf(target) }
    // angle cumulé : la rotation prend toujours le chemin le plus court
    val cum = remember(target) { cumRef[0] += (((target - cumRef[0]) % 360f) + 540f) % 360f - 180f; cumRef[0] }
    val shown by animateFloatAsState(cum, label = "north")
    val desc = (if (known) NorthIndicator.label(angle) else NorthIndicator.UNKNOWN_TIP)
    val fg = MaterialTheme.colorScheme.onSurface
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val line = MaterialTheme.colorScheme.outline
    val err = MaterialTheme.colorScheme.error
    val tm = rememberTextMeasurer()
    Surface(
        shape = CircleShape, color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f), shadowElevation = 2.dp,
        modifier = modifier.size(size).semantics { contentDescription = desc }.let { if (onClick != null) it.clickable { onClick() } else it },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val r = this.size.minDimension / 2
            val u = r / 26f
            drawCircle(line, r - 1f * u, style = Stroke(1.6f * u, pathEffect = if (known) null else PathEffect.dashPathEffect(floatArrayOf(4f * u, 3f * u))))
            val ctr = center
            rotate(shown, ctr) {
                drawPath(Path().apply { moveTo(ctr.x, ctr.y - 14 * u); lineTo(ctr.x + 5 * u, ctr.y + 1 * u); lineTo(ctr.x - 5 * u, ctr.y + 1 * u); close() }, err)
                drawPath(Path().apply { moveTo(ctr.x, ctr.y + 15 * u); lineTo(ctr.x + 5 * u, ctr.y + 1 * u); lineTo(ctr.x - 5 * u, ctr.y + 1 * u); close() }, muted)
            }
            // « N » au bout de l'aiguille, contre-tourné pour rester lisible
            val rad = Math.toRadians(shown.toDouble())
            val nx = ctr.x + (19.5 * u * Math.sin(rad)).toFloat()
            val ny = ctr.y - (19.5 * u * Math.cos(rad)).toFloat()
            val layout = tm.measure("N", TextStyle(color = fg, fontSize = (10 * u / density).sp, fontWeight = FontWeight.ExtraBold))
            drawText(layout, topLeft = Offset(nx - layout.size.width / 2f, ny - layout.size.height / 2f))
            if (!known) {
                val q = tm.measure("?", TextStyle(color = muted, fontSize = (10 * u / density).sp, fontWeight = FontWeight.Bold))
                drawText(q, topLeft = Offset(ctr.x + 15 * u - q.size.width / 2f, ctr.y + 20 * u - q.size.height / 2f))
            }
        }
    }
}
