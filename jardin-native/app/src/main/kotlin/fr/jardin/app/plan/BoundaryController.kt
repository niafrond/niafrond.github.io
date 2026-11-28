package fr.jardin.app.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import fr.jardin.core.Point
import fr.jardin.core.bounds
import fr.jardin.core.distance
import fr.jardin.core.bearing
import fr.jardin.core.plan.CloseResult
import fr.jardin.core.plan.ContourEdit
import fr.jardin.core.plan.ContourState
import fr.jardin.core.plan.History
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.PlanHit
import fr.jardin.core.plan.PlanView

/** Fenêtre ouverte au-dessus du plan (saisie en cm, confirmation, orientation). */
sealed interface BoundaryPop {
    data class Side(val index: Int) : BoundaryPop
    data class Vertex(val index: Int) : BoundaryPop
    data class Rect(val origin: Point) : BoundaryPop
    /** Côté suivant depuis le dernier sommet ; `dir` = direction proposée (0, 90, 180, 270). */
    data class Next(val dir: Double) : BoundaryPop
    data object ConfirmClear : BoundaryPop
    data object North : BoundaryPop
}

/**
 * État et gestes de l'étape « Terrain » (port de `mountContourEditor`). Les opérations sur le contour sont dans
 * `fr.jardin.core.plan.ContourEdit` (testées sans Android) ; ici on ne fait que relier gestes, historique et sauvegarde.
 * `commit` est appelé à chaque modification (sauvegarde automatique dans le jardin).
 */
class BoundaryController(initial: ContourState, private val commit: (ContourState) -> Unit) {
    var state by mutableStateOf(initial); private set
    var history by mutableStateOf(History<ContourState>()); private set
    var view by mutableStateOf(PlanView()); private set
    var sel by mutableStateOf<Int?>(null); private set
    var selSide by mutableStateOf<Int?>(null); private set
    var gridIdx by mutableStateOf(0); private set
    var ortho by mutableStateOf(true); private set
    var magnet by mutableStateOf(true); private set
    var msg by mutableStateOf(""); private set
    var msgKind by mutableStateOf(""); private set
    var pop by mutableStateOf<BoundaryPop?>(null); private set
    /** Écart de fermeture proposé à la répartition (m), sinon null. */
    var closePrompt by mutableStateOf<Double?>(null); private set
    var fullscreen by mutableStateOf(false); private set

    /** px par dp de l'écran, fixé par l'écran ; points hors contour à cadrer (obstacles) ; bande du haut recouverte (px). */
    var density = 1f
    var extraPoints: List<Point> = emptyList()
    var topInsetPx = 0.0
    private var needsFit = true

    val grid: Double? get() = GRIDS[gridIdx].takeIf { it > 0 }
    val canUndo get() = history.canUndo
    val canRedo get() = history.canRedo
    val helpText: String get() = msg.ifEmpty { ContourEdit.helpText(state) }

    private fun tol(dp: Double) = view.px(dp * density)

    // ------------------------------------------------------------------ état

    private fun say(m: String, kind: String = "") { msg = m; msgKind = kind }
    private fun set(s: ContourState) { state = s; commit(s) }
    private fun mutate(fn: (ContourState) -> ContourState) {
        val next = fn(state)
        if (next == state) return
        history = history.record(state)
        set(next)
    }

    fun undo() { history.undo(state)?.let { (s, h) -> history = h; sel = null; selSide = null; closePrompt = null; set(s) } }
    fun redo() { history.redo(state)?.let { (s, h) -> history = h; sel = null; selSide = null; closePrompt = null; set(s) } }

    fun toggleFullscreen() { fullscreen = !fullscreen; needsFit = true }
    fun cycleGrid() { gridIdx = (gridIdx + 1) % GRIDS.size }
    fun toggleOrtho() { ortho = !ortho }
    fun toggleMagnet() { magnet = !magnet }
    fun openNorth() { pop = BoundaryPop.North }
    fun askClear() { if (state.n > 0) pop = BoundaryPop.ConfirmClear }
    fun askRect() { pop = BoundaryPop.Rect(Point(0.0, 0.0)) }
    fun closePop() { pop = null; selSide = null }
    fun hint(m: String) = say(m)

    // ------------------------------------------------------------------ vue

    fun changeView(v: PlanView) { view = v }
    fun zoom(factor: Double) { view = view.zoomCenter(factor) }

    fun onSize(w: Double, h: Double) {
        view = view.withSize(w, h)
        if (needsFit && w > 0 && h > 0) { needsFit = false; fitView() }
    }

    fun fitView() {
        val pts = state.points + extraPoints
        val top = topInsetPx
        view = when {
            pts.size >= 2 -> view.fit(bounds(pts), 1.35, topInset = top)
            pts.size == 1 -> view.centerOn(pts[0], 25.0)
            else -> view.centerOn(Point(5.0, 4.0), 25.0)
        }
    }

    // ------------------------------------------------------------------ gestes

    private fun snapAt(w: Point, exclude: Int = -1, from: Point? = null, useDefaultFrom: Boolean = true): Point =
        ContourEdit.snap(w, state, grid, magnet, ortho, tol(14.0), exclude, from, useDefaultFrom)

    fun onDown(w: Point): PlanDrag? {
        if (pop != null) closePop()
        val vi = PlanHit.vertexAt(state.points, w, tol(22.0))
        if (vi >= 0) return vertexDrag(vi)
        val mi = PlanHit.midAt(state.points, state.isClosed, w, tol(18.0), tol(50.0))
        if (mi >= 0) return midDrag(mi)
        return null
    }

    private fun vertexDrag(i: Int, alreadyRecorded: Boolean = false): PlanDrag {
        val before = state
        return object : PlanDrag {
            override fun move(w: Point) {
                val n = state.n
                val from = if (i > 0) state.points[i - 1] else if (state.isClosed) state.points[n - 1] else null
                val p = snapAt(w, exclude = i, from = from, useDefaultFrom = false)
                sel = i
                set(ContourEdit.movePoint(state, i, p))
            }
            override fun up(w: Point, moved: Boolean) {
                if (moved) { if (!alreadyRecorded) history = history.record(before) ; return }
                // simple toucher : fermer sur le 1er point, sinon sélectionner
                if (i == 0 && !state.isClosed && state.n >= 3) { tryClose(fromTap = true); return }
                sel = if (sel == i) null else i
            }
            override fun cancel() { set(before) }
        }
    }

    /** Milieu d'un côté : un toucher ouvre la saisie de la longueur, un glissé insère un sommet. */
    private fun midDrag(mi: Int): PlanDrag {
        var inserted: PlanDrag? = null
        val before = state
        return object : PlanDrag {
            override fun move(w: Point) {
                if (inserted == null) {
                    val (s, idx) = ContourEdit.insertOnSide(state, mi)
                    history = history.record(before)
                    state = s; sel = idx
                    inserted = vertexDrag(idx, alreadyRecorded = true)
                }
                inserted!!.move(w)
            }
            override fun up(w: Point, moved: Boolean) {
                val ins = inserted
                if (ins != null) ins.up(w, moved) else openSide(mi)
            }
            override fun cancel() { inserted?.cancel() }
        }
    }

    fun onTap(w: Point) {
        val lab = PlanHit.midAt(state.points, state.isClosed, w, tol(26.0), tol(40.0))
        if (lab >= 0) { openSide(lab); return }
        if (state.isClosed) {
            sel = null
            say("Contour fermé : touchez un sommet pour le déplacer, un « + » pour en insérer un, ou « Rouvrir ».")
            return
        }
        val p = snapAt(w)
        if (state.n > 0 && distance(state.points.last(), p) < 1e-6) return
        mutate { ContourEdit.addPoint(it, p) }
        sel = null; closePrompt = null; say("")
    }

    fun onLong(w: Point) {
        val vi = PlanHit.vertexAt(state.points, w, tol(26.0))
        if (vi >= 0) { openVertex(vi); return }
        val si = PlanHit.sideAt(state.points, state.isClosed, w, tol(22.0))
        if (si >= 0) { openSide(si); return }
        if (state.n == 0) { pop = BoundaryPop.Rect(snapAt(w)); return }
        if (!state.isClosed) {
            val last = state.points.last()
            pop = BoundaryPop.Next(ContourEdit.nearestCardinal(bearing(last, w)))
        }
    }

    // ------------------------------------------------------------------ fenêtres

    fun openSide(i: Int) { selSide = i; sel = null; pop = BoundaryPop.Side(i) }
    fun openVertex(i: Int) { sel = i; pop = BoundaryPop.Vertex(i) }

    fun applySideLength(i: Int, len: Double) { mutate { ContourEdit.setSideLength(it, i, len) } }
    fun addSegment(len: Double, dir: Double) {
        if (state.isClosed) { say("Contour fermé : rouvrez-le pour ajouter un côté.", "warn"); return }
        mutate { ContourEdit.addSegment(it, len, dir) }
    }
    fun createRect(origin: Point, w: Double, l: Double) {
        mutate { ContourEdit.rectangle(origin, w, l) }
        sel = null; needsFit = true; fitView(); announceValidity()
    }
    fun clear() { mutate { ContourEdit.clear() }; sel = null; selSide = null; closePrompt = null; say("") }
    fun deleteSelected() { sel?.let { i -> mutate { ContourEdit.deletePoint(it, i) }; sel = null } }
    fun deleteVertex(i: Int) { mutate { ContourEdit.deletePoint(it, i) }; sel = null }

    // ------------------------------------------------------------------ fermeture

    fun reopen() { mutate { ContourEdit.reopen(it) }; closePrompt = null }
    fun toggleClose() { if (state.isClosed) reopen() else tryClose() }
    fun tryClose(fromTap: Boolean = false) {
        when (val r = ContourEdit.tryClose(state, fromTap)) {
            CloseResult.TooFew -> say(ContourEdit.MSG_TOO_FEW, "warn")
            is CloseResult.AskGap -> closePrompt = r.gap
            is CloseResult.Closed -> { mutate { r.state }; closePrompt = null; sel = null; announceValidity() }
        }
    }
    fun closeAsIs() { mutate { ContourEdit.close(it) }; closePrompt = null; sel = null; announceValidity() }
    fun closeWithGap() { mutate { ContourEdit.closeWithGapDistributed(it) }; closePrompt = null; sel = null; announceValidity() }
    fun cancelClosePrompt() { closePrompt = null }
    private fun announceValidity() { val (t, k) = ContourEdit.validityMessage(state); say(t, k) }

    fun sideTitle(i: Int): String {
        val n = state.n
        return "Côté ${i + 1} → ${((i + 1) % n) + 1} · ${LengthInput.frLen(ContourEdit.sideLength(state, i))}"
    }

    companion object { val GRIDS = listOf(0.5, 0.1, 1.0, 0.0) }
}
