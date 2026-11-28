package fr.jardin.app.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import fr.jardin.core.Garden
import fr.jardin.core.Point
import fr.jardin.core.bounds
import fr.jardin.core.existingFootprint
import fr.jardin.core.itemPolygon
import fr.jardin.core.shapePolygon
import fr.jardin.core.plan.History
import fr.jardin.core.plan.PlanSnapshot
import fr.jardin.core.plan.PlanView

/**
 * Socle commun des éditeurs plein plan (Aménagements, Zones) : vue, grille, messages, atelier plein écran, historique
 * annuler / rétablir (100 niveaux) sur le jardin lui-même. La logique des opérations est dans `fr.jardin.core.plan`.
 * `gardenOf` donne le jardin courant, `updater` applique une modification (sauvegarde automatique par l'assistant).
 */
abstract class PlanEditor(private val gardenOf: () -> Garden?, private val updater: ((Garden) -> Garden) -> Unit) {
    var view by mutableStateOf(PlanView()); private set
    var history by mutableStateOf(History<PlanSnapshot>()); private set
    var gridIdx by mutableStateOf(0); private set
    var msg by mutableStateOf(""); protected set
    var msgKind by mutableStateOf(""); protected set
    var fullscreen by mutableStateOf(false); private set

    /** px par dp de l'écran (fixé par l'écran) et bande du haut recouverte par la barre d'outils flottante (px). */
    var density = 1f
    var topInsetPx = 0.0
    private var needsFit = true

    val garden: Garden get() = gardenOf() ?: Garden(id = "")
    val grid: Double? get() = GRIDS[gridIdx].takeIf { it > 0 }
    val canUndo get() = history.canUndo
    val canRedo get() = history.canRedo

    protected fun say(m: String, kind: String = "") { msg = m; msgKind = kind }
    fun hint(m: String) = say(m)
    fun tol(dp: Double): Double = view.px(dp * density)

    // ------------------------------------------------------------------ jardin et historique

    /** Modification annulable (un niveau d'historique). */
    protected fun mutate(fn: (Garden) -> Garden) {
        val g = garden
        if (fn(g) == g) return
        history = history.record(PlanSnapshot.of(g))
        updater { fn(it) }
    }

    /** Modification en direct pendant un geste (pas d'historique ; voir [beginDrag] / [endDrag]). */
    protected fun live(fn: (Garden) -> Garden) { updater { fn(it) } }

    protected fun beginDrag(): PlanSnapshot = PlanSnapshot.of(garden)
    protected fun endDrag(before: PlanSnapshot, moved: Boolean) { if (moved && before != PlanSnapshot.of(garden)) history = history.record(before) }
    protected fun restore(before: PlanSnapshot) { updater { before.applyTo(it) } }

    open fun onHistoryApplied() {}

    fun undo() {
        history.undo(PlanSnapshot.of(garden))?.let { (s, h) -> history = h; updater { s.applyTo(it) }; onHistoryApplied() }
    }
    fun redo() {
        history.redo(PlanSnapshot.of(garden))?.let { (s, h) -> history = h; updater { s.applyTo(it) }; onHistoryApplied() }
    }

    // ------------------------------------------------------------------ vue

    fun toggleFullscreen() { fullscreen = !fullscreen; needsFit = true }
    fun cycleGrid() { gridIdx = (gridIdx + 1) % GRIDS.size }
    fun changeView(v: PlanView) { view = v }
    fun zoom(factor: Double) { view = view.zoomCenter(factor) }

    fun onSize(w: Double, h: Double) {
        view = view.withSize(w, h)
        if (needsFit && w > 0 && h > 0) { needsFit = false; fitView() }
    }

    /** Points à cadrer : contour, obstacles, mobilier, existant, zones. */
    protected open fun fitPoints(): List<Point> {
        val g = garden
        val pts = ArrayList<Point>(g.boundary)
        g.obstacles.forEach { o -> o.points?.let { pts.addAll(it) } ?: o.center?.let { pts.add(it) } }
        g.items.forEach { pts.addAll(itemPolygon(it)) }
        g.existing.forEach { pts.addAll(existingFootprint(it)) }
        g.zones.forEach { pts.addAll(shapePolygon(it.shape)) }
        return pts
    }

    fun fitView() {
        val pts = fitPoints()
        val top = topInsetPx
        view = if (pts.size >= 2) view.fit(bounds(pts), 1.3, topInset = top) else view.centerOn(Point(6.0, 4.0), 25.0)
    }

    companion object { val GRIDS = listOf(0.5, 0.1, 1.0, 0.0) }
}
