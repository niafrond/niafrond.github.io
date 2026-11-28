package fr.jardin.app.plan

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import fr.jardin.core.CircleShape
import fr.jardin.core.Garden
import fr.jardin.core.LineShape
import fr.jardin.core.Point
import fr.jardin.core.PolygonShape
import fr.jardin.core.boundarySides
import fr.jardin.core.centroid
import fr.jardin.core.distance
import fr.jardin.core.existingFootprint
import fr.jardin.core.getOpeningKind
import fr.jardin.core.itemPolygon
import fr.jardin.core.itemRadius
import fr.jardin.core.openingGeometry
import fr.jardin.core.shapeArea
import fr.jardin.core.shapePolygon
import fr.jardin.core.plan.AmSel
import fr.jardin.core.plan.ExistingEdit
import fr.jardin.core.plan.ItemEdit
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.PlanView
import fr.jardin.core.plan.ZoneEdit
import fr.jardin.core.plan.ZoneHandle
import fr.jardin.core.rotationOf

private val PINK = Color(0xFFD81B60)
private val GREEN = Color(0xFF2E7D32)
private val BLUE = Color(0xFF0D47A1)
private val ORANGE = Color(0xFFB26A00)
private val RED = Color(0xFFC62828)

private fun hexColor(s: String?, fallback: Color = Color.Gray): Color {
    val h = s?.removePrefix("#") ?: return fallback
    return try { if (h.length == 6) Color(0xFF000000L or h.toLong(16)) else fallback } catch (_: NumberFormatException) { fallback }
}

private fun DrawScope.o(v: PlanView, p: Point): Offset { val s = v.toScreen(p); return Offset(s.x.toFloat(), s.y.toFloat()) }

private fun DrawScope.pathOf(v: PlanView, pts: List<Point>, close: Boolean) = Path().apply {
    pts.forEachIndexed { i, p -> val q = o(v, p); if (i == 0) moveTo(q.x, q.y) else lineTo(q.x, q.y) }
    if (close) close()
}

private fun DrawScope.txt(tm: TextMeasurer, text: String, center: Offset, fontPx: Float, color: Color, halo: Color? = Color.White, bold: Boolean = false) {
    val l = tm.measure(text, TextStyle(color = color, fontSize = (fontPx / density).sp, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal))
    val tl = Offset(center.x - l.size.width / 2f, center.y - l.size.height / 2f)
    if (halo != null) drawRoundRect(halo.copy(alpha = 0.8f), tl - Offset(3f, 1f), Size(l.size.width + 6f, l.size.height + 2f), androidx.compose.ui.geometry.CornerRadius(4f, 4f))
    drawText(l, topLeft = tl)
}

private fun DrawScope.dot(v: PlanView, p: Point, r: Float, fill: Color, stroke: Color, dp: Float) {
    val c = o(v, p)
    drawCircle(fill, r, c); drawCircle(stroke, r, c, style = Stroke(2f * dp))
}

private fun dash(dp: Float) = PathEffect.dashPathEffect(floatArrayOf(6f * dp, 3f * dp))

/** Passages (portail, porte, garage…) posés sur les côtés : trait épais de la couleur du type, icône au centre. */
private fun DrawScope.drawOpenings(v: PlanView, dp: Float, tm: TextMeasurer, g: Garden, selected: String?) {
    for (op in g.openings) {
        val og = openingGeometry(g, op) ?: continue
        val k = getOpeningKind(op.kind)
        val a = o(v, og.a); val b = o(v, og.b)
        if (op.id == selected) drawLine(PINK.copy(alpha = 0.75f), a, b, 11f * dp, StrokeCap.Round)
        drawLine(Color.White, a, b, 8f * dp, StrokeCap.Round)
        drawLine(hexColor(k?.color, Color(0xFF8D6E63)), a, b, 5.5f * dp, StrokeCap.Round)
        txt(tm, k?.emoji ?: "", o(v, og.center), 13 * dp, Color.Black, null)
    }
}

/** Dessin supplémentaire de l'étape « Aménagements » : passages, sélection, poignée de rotation, tracés en cours. */
fun itemsOverlay(c: ItemsController, g: Garden): DrawScope.(PlanView, Float, TextMeasurer) -> Unit = { v, dp, tm ->
    drawOpenings(v, dp, tm, g, (c.sel as? AmSel.OpenSel)?.id)
    if (c.tab == "edges") {
        for (s in boundarySides(g)) {
            val m = o(v, Point((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2))
            val sel = c.selEdge == s.i
            drawCircle(Color.White, 11f * dp, m); drawCircle(if (sel) PINK else BLUE, 11f * dp, m, style = Stroke(1.5f * dp))
            txt(tm, "${s.i + 1}", m, 11 * dp, if (sel) PINK else BLUE, null, bold = true)
            if (sel) drawLine(PINK.copy(alpha = 0.75f), o(v, s.a), o(v, s.b), 5f * dp, StrokeCap.Round)
        }
        c.selFree?.points?.let { drawPath(pathOf(v, it, false), PINK.copy(alpha = 0.7f), style = Stroke(6f * dp, cap = StrokeCap.Round, join = StrokeJoin.Round)) }
        c.draft?.let { d -> drawDraft(v, dp, d.points, d.points.size >= 3) }
    }
    c.selItem?.let { it0 ->
        val poly = itemPolygon(it0)
        drawPath(pathOf(v, poly, true), PINK, style = Stroke(2f * dp, pathEffect = dash(dp)))
        if (itemRadius(it0) == null) {
            val hp = ItemEdit.handlePos(it0, v.px(30.0 * dp))
            val ctr = o(v, Point(it0.x, it0.y)); val h = o(v, hp)
            drawLine(PINK, ctr, h, 1.5f * dp)
            drawCircle(PINK, 13f * dp, h)
            txt(tm, "⟳", h, 15 * dp, Color.White, null, bold = true)
        }
        if (ItemEdit.isOutside(g, it0)) txt(tm, "hors du terrain", o(v, Point(it0.x, it0.y - v.px(18.0 * dp))), 12 * dp, ORANGE)
    }
    c.selEx?.let { e ->
        val pts = e.points
        if (pts != null && pts.size >= 2) drawPath(pathOf(v, pts, false), PINK.copy(alpha = 0.6f), style = Stroke(5f * dp, cap = StrokeCap.Round, join = StrokeJoin.Round))
        else drawPath(pathOf(v, existingFootprint(e), true), PINK, style = Stroke(2f * dp, pathEffect = dash(dp)))
        if (ExistingEdit.isOutside(g, e)) txt(tm, "hors du terrain", o(v, Point(e.x, e.y - v.px(18.0 * dp))), 12 * dp, ORANGE)
    }
    c.exDraft?.let { drawDraft(v, dp, it, c.exDraftKind == "fence" && it.size >= 3) }
}

private fun DrawScope.drawDraft(v: PlanView, dp: Float, pts: List<Point>, closable: Boolean) {
    if (pts.isNotEmpty()) drawPath(pathOf(v, pts, false), PINK, style = Stroke(3f * dp, cap = StrokeCap.Round, join = StrokeJoin.Round))
    pts.forEachIndexed { i, p ->
        if (i == 0 && closable) dot(v, p, 12f * dp, GREEN, Color.White, dp) else dot(v, p, 6f * dp, PINK, Color.White, dp)
    }
}

/** Dessin supplémentaire de l'étape « Dessin des zones » : tracé en cours, sélection, poignées, rotation, cotes. */
fun zonesOverlay(c: ZonesController, g: Garden, overlapIds: Set<String>): DrawScope.(PlanView, Float, TextMeasurer) -> Unit = { v, dp, tm ->
    // zones qui se chevauchent : contour rouge
    for (z in g.zones) if (z.id in overlapIds && z.id != c.sel) {
        val poly = shapePolygon(z.shape)
        if (poly.size >= 3) drawPath(pathOf(v, poly, true), RED, style = Stroke(2.5f * dp, pathEffect = dash(dp)))
    }
    // tracé en cours
    val d = c.drawing
    if (d != null) {
        val pts = if (d.rect && d.points.isNotEmpty() && c.ghost != null) ZoneEdit.rectPoints(d.points[0], c.ghost!!) else d.points
        if (d.rect && pts.size == 4) drawPath(pathOf(v, pts, true), PINK.copy(alpha = 0.15f))
        if (pts.isNotEmpty()) drawPath(pathOf(v, pts, d.rect && pts.size == 4), PINK, style = Stroke(3f * dp, cap = StrokeCap.Round, join = StrokeJoin.Round))
        val ghost = c.ghost
        if (!d.rect && ghost != null && d.points.isNotEmpty()) drawLine(PINK.copy(alpha = 0.7f), o(v, d.points.last()), o(v, ghost), 2f * dp, pathEffect = dash(dp))
        if (!d.rect) d.points.forEachIndexed { i, p ->
            if (i == 0 && d.kind == "polygon" && d.points.size >= 3) dot(v, p, 12f * dp, GREEN, Color.White, dp) else dot(v, p, 6f * dp, PINK, Color.White, dp)
        }
        if (d.rect && d.points.isNotEmpty()) dot(v, d.points[0], 6f * dp, PINK, Color.White, dp)
    }
    // cercle en cours
    val cc = c.circleCenter ?: c.ghostRadiusCenter
    if (cc != null) {
        val gh = c.ghost
        val r = if (gh != null) distance(cc, gh) else 0.0
        if (r > 0.05) {
            val ctr = o(v, cc)
            drawCircle(PINK.copy(alpha = 0.15f), (r * v.scale).toFloat(), ctr)
            drawCircle(PINK, (r * v.scale).toFloat(), ctr, style = Stroke(2.5f * dp))
            drawLine(PINK, ctr, o(v, gh!!), 1.5f * dp)
            txt(tm, LengthInput.frLen(r), o(v, Point((cc.x + gh.x) / 2, (cc.y + gh.y) / 2)), 12 * dp, BLUE)
        }
        dot(v, cc, 7f * dp, PINK, Color.White, dp)
    }
    c.snapMark?.let { if (c.typeId != null || c.dragging) drawCircle(GREEN, 6f * dp, o(v, it), style = Stroke(1.5f * dp)) }
    // zone sélectionnée
    val z = c.selZone
    val s = z?.shape
    if (z != null && s != null && c.typeId == null) {
        when (s) {
            is CircleShape -> drawCircle(PINK, (s.radius * v.scale).toFloat(), o(v, s.center), style = Stroke(2.5f * dp, pathEffect = dash(dp)))
            is LineShape -> drawPath(pathOf(v, s.points, false), PINK.copy(alpha = 0.7f), style = Stroke(2.5f * dp, pathEffect = dash(dp)))
            is PolygonShape -> {
                drawPath(pathOf(v, s.points, true), PINK, style = Stroke(2.5f * dp, pathEffect = dash(dp)))
                // cotes
                val ctr = centroid(s.points); val n = s.points.size
                for (i in 0 until n) {
                    val a = s.points[i]; val b = s.points[(i + 1) % n]; val l = distance(a, b)
                    if (l < v.px(44.0 * dp)) continue
                    val m = Point((a.x + b.x) / 2, (a.y + b.y) / 2)
                    var nx = -(b.y - a.y) / l; var ny = (b.x - a.x) / l
                    if ((m.x - ctr.x) * nx + (m.y - ctr.y) * ny < 0) { nx = -nx; ny = -ny }
                    val off = v.px(16.0 * dp)
                    txt(tm, LengthInput.frLen(l), o(v, Point(m.x + nx * off, m.y + ny * off)), 11 * dp, BLUE)
                }
            }
        }
        // poignées
        for (h in ZoneEdit.handles(s, v.px(36.0 * dp))) {
            when (h) {
                is ZoneHandle.Mid -> { val p = o(v, h.p); drawCircle(Color.White, 8f * dp, p); drawCircle(BLUE, 8f * dp, p, style = Stroke(1.5f * dp)); txt(tm, "＋", p, 11 * dp, BLUE, null, bold = true) }
                is ZoneHandle.Radius -> dot(v, h.p, 9f * dp, Color.White, GREEN, dp)
                is ZoneHandle.Center -> dot(v, h.p, 9f * dp, GREEN, Color.White, dp)
                is ZoneHandle.Vertex -> dot(v, h.p, 9f * dp, Color.White, GREEN, dp)
            }
        }
        // rotation
        ZoneEdit.rotHandle(s, v.px(40.0 * dp))?.let { (ctr, hp) ->
            drawLine(PINK, o(v, ctr), o(v, hp), 1.5f * dp)
            val h = o(v, hp)
            drawCircle(PINK, 13f * dp, h)
            txt(tm, "⟳", h, 15 * dp, Color.White, null, bold = true)
            val ang = c.rotLive ?: rotationOf(s)
            if (c.rotLive != null) txt(tm, "${Math.round(ang)}°", Offset(h.x, h.y - 24f * dp), 13 * dp, PINK)
        }
        txt(tm, LengthInput.frArea(shapeArea(s)), o(v, if (s is CircleShape) s.center else centroid(shapePolygon(s))), 12 * dp, Color(0xFF14210F), Color.White)
    }
}
