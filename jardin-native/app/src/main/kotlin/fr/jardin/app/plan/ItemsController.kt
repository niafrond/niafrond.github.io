package fr.jardin.app.plan

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import fr.jardin.core.Existing
import fr.jardin.core.Garden
import fr.jardin.core.Item
import fr.jardin.core.Obstacle
import fr.jardin.core.Opening
import fr.jardin.core.Plant
import fr.jardin.core.Point
import fr.jardin.core.distance
import fr.jardin.core.edgeHeightOf
import fr.jardin.core.edgeKindOf
import fr.jardin.core.existingFootprint
import fr.jardin.core.formatHeight
import fr.jardin.core.defaultItemHeight
import fr.jardin.core.getEdgeKind
import fr.jardin.core.getExistingKind
import fr.jardin.core.getItemKind
import fr.jardin.core.getOpeningKind
import fr.jardin.core.itemPolygon
import fr.jardin.core.itemRadius
import fr.jardin.core.plan.AmSel
import fr.jardin.core.plan.ExistingEdit
import fr.jardin.core.plan.ItemEdit
import fr.jardin.core.plan.LengthInput
import fr.jardin.core.plan.snapToGrid

/** Fenêtre de saisie ouverte sur un élément (appui long). */
sealed interface AmPop {
    data class ItemSize(val id: String) : AmPop
    data class Edge(val index: Int) : AmPop
    data class Free(val id: String) : AmPop
    data class Open(val id: String) : AmPop
    data class Ex(val id: String) : AmPop
}

/** Mur / clôture libre en cours de tracé. */
data class FreeDraft(val kind: String, val points: List<Point> = emptyList())

val AM_TABS = listOf("furniture" to "🪑 Mobilier", "edges" to "🧱 Murs & clôtures", "access" to "🚪 Portes & accès", "existing" to "🌳 Existant")

/**
 * État et gestes de l'étape « Aménagements » (port de `mountItemEditor`) : mobilier, murs et clôtures, portes et accès,
 * existant. Les opérations sont dans `fr.jardin.core.plan.ItemEdit` / `ExistingEdit` (testées sans Android).
 */
class ItemsController(gardenOf: () -> Garden?, updater: ((Garden) -> Garden) -> Unit) : PlanEditor(gardenOf, updater) {
    var tab by mutableStateOf("furniture"); private set
    var cat by mutableStateOf("all")
    var kind by mutableStateOf<String?>(null); private set
    var openKind by mutableStateOf("gate"); private set
    var sel by mutableStateOf<AmSel?>(null); private set
    var draft by mutableStateOf<FreeDraft?>(null); private set
    var exKind by mutableStateOf<String?>(null); private set
    var exDraft by mutableStateOf<List<Point>?>(null); private set
    var exDraftKind by mutableStateOf("hedge"); private set
    var fenceMaterial by mutableStateOf("wood"); private set
    var exQuery by mutableStateOf("")
    var exAge by mutableStateOf("adult"); private set
    var pop by mutableStateOf<AmPop?>(null); private set
    /** Panneau des réglages replié dans l'atelier plein écran. */
    var detailOpen by mutableStateOf(true)

    val selItem: Item? get() = (sel as? AmSel.ItemSel)?.let { s -> garden.items.firstOrNull { it.id == s.id } }
    val selEdge: Int? get() = (sel as? AmSel.EdgeSel)?.index
    val selFree: Obstacle? get() = (sel as? AmSel.FreeSel)?.let { s -> garden.obstacles.firstOrNull { it.id == s.id } }
    val selOpening: Opening? get() = (sel as? AmSel.OpenSel)?.let { s -> garden.openings.firstOrNull { it.id == s.id } }
    val selEx: Existing? get() = (sel as? AmSel.ExSel)?.let { s -> garden.existing.firstOrNull { it.id == s.id } }

    val placing: Boolean get() = (tab == "furniture" && kind != null) || (tab == "existing" && (exKind != null || exDraft != null)) || (tab == "edges" && draft != null)

    val helpText: String get() {
        if (msg.isNotEmpty()) return msg
        return when (tab) {
            "furniture" -> when {
                kind != null -> "Touchez le plan pour poser « ${getItemKind(kind)?.label} » (aimanté aux côtés, grille ${grid?.let { LengthInput.fr(it, 1) + " m" } ?: "off"})."
                selItem != null -> "Glissez l’élément pour le déplacer, tirez la poignée ⟳ pour le tourner, appui long pour saisir sa taille en cm."
                else -> "Touchez un élément de la palette, puis touchez le plan pour le poser."
            }
            "edges" -> when {
                draft != null -> "${ItemEdit.FREE_KINDS.getValue(draft!!.kind).first} libre : touchez les points successifs (${draft!!.points.size} posé${if (draft!!.points.size > 1) "s" else ""}), puis « Terminer »."
                selEdge != null -> "Choisissez Ouvert, Mur, Clôture ou Haie, ajustez la hauteur en cm, ou appliquez à tous les côtés."
                garden.boundary.size >= 2 -> "Touchez un côté du terrain (numéroté) pour en faire un mur, une clôture ou une haie."
                else -> "Pas de contour tracé : vous pouvez dessiner un mur ou une clôture libre."
            }
            "existing" -> when {
                exDraft != null -> "${getExistingKind(exDraftKind)?.label} : touchez les points successifs (${exDraft!!.size} posé${if (exDraft!!.size > 1) "s" else ""}), puis « Terminer »${if (exDraftKind == "fence") " (ou touchez le 1er point pour fermer la boucle)" else ""}."
                exKind != null -> if (getExistingKind(exKind)?.linear == true) "Touchez le plan pour tracer ${if (exKind == "fence") "la clôture" else "la haie"} point par point." else "Touchez le plan pour poser « ${getExistingKind(exKind)?.label} »."
                selEx != null -> "Glissez pour déplacer, appui long pour saisir la taille en cm, précisez la plante ci-dessous."
                else -> "Déjà des plantes ou une clôture ? Touchez un type, puis le plan pour le placer."
            }
            else -> if (selOpening != null) "Glissez le passage le long du côté, appui long pour sa largeur en cm, ou changez son sens d’ouverture."
            else "Choisissez un type de passage puis touchez un côté ${ItemEdit.openingTarget(openKind)}."
        }
    }

    // ------------------------------------------------------------------ onglets, palettes

    fun switchTab(t: String) {
        if (t == tab) return
        tab = t; sel = null; kind = null; draft = null; exKind = null; exDraft = null; pop = null
        say("")
        if (t == "access") chooseOpening(openKind)
    }

    fun chooseKind(id: String) {
        kind = if (kind == id) null else id; sel = null
        if (kind != null) say("Touchez le plan pour poser « ${getItemKind(id)?.label} ».") else say("")
    }

    fun chooseOpening(id: String) {
        openKind = id; sel = null
        if (!ItemEdit.canPlaceOpening(garden, id)) {
            say(if (id == "garage" || id == "door") "Aucune maison ni abri : dessinez-en un à l’étape Terrain (obstacles) pour y poser cette porte."
            else "Aucun côté disponible : tracez d’abord le terrain (étape Terrain).", "warn")
        } else say("${getOpeningKind(id)?.label} : touchez un côté ${ItemEdit.openingTarget(id)} pour le poser.")
    }

    fun pickExKind(id: String?) { exKind = id; sel = null; exDraft = null; say("") }
    fun pickFenceMaterial(id: String) { fenceMaterial = id; exKind = "fence"; sel = null; say("") }

    fun closePop() { pop = null }
    fun openExPop(id: String) { pop = AmPop.Ex(id) }

    // ------------------------------------------------------------------ sélection

    private fun select(s: AmSel?) { sel = s }

    fun deselect() { sel = null }

    /** Boutons « côté » : le contour doit avoir un côté sélectionné. */
    fun chooseEdgeKind(k: String) {
        val i = selEdge
        if (i == null) { say("Touchez d’abord un côté du terrain.", "warn"); return }
        val h0 = if (edgeKindOf(garden, i) == k) edgeHeightOf(garden, i) else (getEdgeKind(k)?.height ?: 0.0)
        mutate { ItemEdit.chooseEdgeKind(it, i, k) }
        val lab = getEdgeKind(k)?.label?.lowercase()
        say(if (k == "open") "Côté ${i + 1} : ouvert." else "Côté ${i + 1} : $lab de ${ItemEdit.cm(h0)} cm.")
    }

    fun setEdgeHeight(i: Int, m: Double) {
        val chk = ItemEdit.setEdgeHeight(garden, i, m).second
        if (!chk.ok) { say(fr.jardin.core.heightMessage(edgeKindOf(garden, i)), "warn"); return }
        mutate { ItemEdit.setEdgeHeight(it, i, m).first }
        if (chk.clamped) say(chk.message, "warn")
    }

    fun setEdgeMaterial(i: Int, mat: String) {
        mutate { ItemEdit.setEdgeMaterial(it, i, mat) }
        say("Côté ${i + 1} : ${fr.jardin.core.MATERIALS[mat]?.label?.lowercase()}.")
    }

    fun applyAllEdges() {
        val i = selEdge ?: return
        val kind0 = edgeKindOf(garden, i); val h = edgeHeightOf(garden, i)
        mutate { ItemEdit.applyAllEdges(it, i) }
        say(if (kind0 == "open") "Tous les côtés sont ouverts." else "Tous les côtés : ${getEdgeKind(kind0)?.label?.lowercase()} de ${ItemEdit.cm(h)} cm.")
    }

    fun setFreeHeight(id: String, m: Double?) {
        val (_, chk) = ItemEdit.setFreeHeight(garden, id, m)
        if (chk != null && !chk.ok) { say(fr.jardin.core.heightMessage(garden.obstacles.firstOrNull { it.id == id }?.kind), "warn"); return }
        mutate { ItemEdit.setFreeHeight(it, id, m).first }
        if (chk?.clamped == true) say(chk.message, "warn")
    }

    fun setFreeMaterial(id: String, mat: String) = mutate { ItemEdit.setFreeMaterial(it, id, mat) }

    fun setItemHeight(m: Double?) {
        val it0 = selItem ?: return
        val chk = ItemEdit.setHeight(it0, m).second
        if (chk != null && !chk.ok) { say(fr.jardin.core.heightMessage(it0.kind), "warn"); return }
        mutate { g -> ItemEdit.upsert(g, ItemEdit.setHeight(g.items.first { q -> q.id == it0.id }, m).first) }
        if (chk?.clamped == true) say(chk.message, "warn")
    }

    fun rotateSel(delta: Double) { val it0 = selItem ?: return; mutate { g -> ItemEdit.upsert(g, ItemEdit.rotateBy(g.items.first { q -> q.id == it0.id }, delta)) } }

    fun setOpeningSwing(sw: String) { val op = selOpening ?: return; mutate { ItemEdit.upsertOpening(it, ItemEdit.setSwing(op, sw)) } }

    fun duplicateItem(it0: Item) {
        val c = ItemEdit.duplicate(it0)
        mutate { ItemEdit.upsert(it, c) }
        sel = AmSel.ItemSel(c.id)
    }

    fun duplicateExisting(e: Existing) {
        val c = ExistingEdit.duplicate(e)
        mutate { ExistingEdit.upsert(it, c) }
        sel = AmSel.ExSel(c.id)
    }

    fun deleteSel() {
        val s = sel ?: return
        mutate { g ->
            when (s) {
                is AmSel.ItemSel -> ItemEdit.removeItem(g, s.id)
                is AmSel.ExSel -> ExistingEdit.remove(g, s.id)
                is AmSel.OpenSel -> ItemEdit.removeOpening(g, s.id)
                is AmSel.FreeSel -> ItemEdit.removeObstacle(g, s.id)
                is AmSel.EdgeSel -> g
            }
        }
        sel = null
    }

    fun setExHeight(e: Existing, m: Double) {
        val (_, chk) = ExistingEdit.setHeight(e, m)
        if (!chk.ok) { say(fr.jardin.core.heightMessage(e.kind), "warn"); return }
        mutate { g -> ExistingEdit.upsert(g, ExistingEdit.setHeight(g.existing.first { it.id == e.id }, m).first) }
        if (chk.clamped) say(chk.message, "warn")
    }

    fun updateEx(id: String, fn: (Existing) -> Existing) { mutate { g -> g.existing.firstOrNull { it.id == id }?.let { ExistingEdit.upsert(g, fn(it)) } ?: g } }

    fun setKeep(e: Existing, keep: Boolean) {
        updateEx(e.id) { ExistingEdit.setKeep(it, keep) }
        say(if (keep) "À conserver." else "À retirer ou remplacer : l’élément ne compte plus dans l’ombre ni l’espace occupé.")
    }

    fun choosePlant(e: Existing, p: Plant) {
        updateEx(e.id) { ExistingEdit.choosePlant(it, p, exAge) }
        val h = garden.existing.firstOrNull { it.id == e.id }?.height ?: e.height
        say("${p.commonName} : taille ${ItemEdit.cm(h)} cm de haut, réglable en cm.")
    }

    fun setAge(e: Existing, p: Plant, age: String) { exAge = age; updateEx(e.id) { ExistingEdit.setAge(it, p, age) } }

    // ------------------------------------------------------------------ gestes

    fun onDown(w: Point): PlanDrag? {
        if (pop != null) pop = null
        when (tab) {
            "furniture" -> {
                val cur = selItem
                if (cur != null && itemRadius(cur) == null && distance(w, ItemEdit.handlePos(cur, tol(30.0))) <= tol(24.0)) return rotateDrag(cur.id)
                val hit = ItemEdit.hit(garden, w, tol(18.0)) ?: return null
                return itemDrag(hit, w)
            }
            "access" -> if (draft == null) {
                val op = ItemEdit.hitOpening(garden, w, tol(24.0)) ?: return null
                return openingDrag(op.id)
            }
            "existing" -> if (exDraft == null) {
                val e = ExistingEdit.hit(garden, w, tol(18.0)) ?: return null
                return existingDrag(e, w)
            }
        }
        return null
    }

    private fun itemDrag(it0: Item, w: Point): PlanDrag {
        val before = beginDrag()
        val id = it0.id
        val off = Point(it0.x - w.x, it0.y - w.y)
        if (sel != AmSel.ItemSel(id)) { sel = AmSel.ItemSel(id); kind = null }
        return object : PlanDrag {
            override fun move(w: Point) {
                val p = snapToGrid(Point(w.x + off.x, w.y + off.y), grid)
                val t = tol(18.0)
                live { g -> g.items.firstOrNull { it.id == id }?.let { cur -> ItemEdit.upsert(g, ItemEdit.magnet(cur.copy(x = p.x, y = p.y), g, t)) } ?: g }
            }
            override fun up(w: Point, moved: Boolean) = endDrag(before, moved)
            override fun cancel() { restore(before) }
        }
    }

    private fun rotateDrag(id: String): PlanDrag {
        val before = beginDrag()
        return object : PlanDrag {
            override fun move(w: Point) { live { g -> g.items.firstOrNull { it.id == id }?.let { ItemEdit.upsert(g, ItemEdit.rotateFromHandle(it, w)) } ?: g } }
            override fun up(w: Point, moved: Boolean) = endDrag(before, moved)
            override fun cancel() { restore(before) }
        }
    }

    private fun openingDrag(id: String): PlanDrag {
        val before = beginDrag()
        sel = AmSel.OpenSel(id)
        return object : PlanDrag {
            override fun move(w: Point) {
                val stick = tol(45.0); val near = tol(90.0); val mid = tol(10.0); val gr = grid
                live { g -> g.openings.firstOrNull { it.id == id }?.let { op -> ItemEdit.slideOpening(g, op, w, gr, stick, near, mid)?.let { ItemEdit.upsertOpening(g, it) } } ?: g }
            }
            override fun up(w: Point, moved: Boolean) = endDrag(before, moved)
            override fun cancel() { restore(before) }
        }
    }

    private fun existingDrag(e: Existing, w: Point): PlanDrag {
        val before = beginDrag()
        val from = e
        if (sel != AmSel.ExSel(e.id)) { sel = AmSel.ExSel(e.id); exKind = null }
        return object : PlanDrag {
            override fun move(w2: Point) {
                var dx = w2.x - w.x; var dy = w2.y - w.y
                val ref = from.points?.firstOrNull() ?: Point(from.x, from.y)
                val p = snapToGrid(Point(ref.x + dx, ref.y + dy), grid)
                dx = p.x - ref.x; dy = p.y - ref.y
                live { g -> ExistingEdit.upsert(g, ExistingEdit.translate(from, dx, dy)) }
            }
            override fun up(w: Point, moved: Boolean) = endDrag(before, moved)
            override fun cancel() { restore(before) }
        }
    }

    fun onTap(w: Point) {
        when (tab) {
            "furniture" -> {
                val k = kind
                if (k != null) { placeItem(w, k); return }
                if (sel != null) sel = null
                say("Touchez un élément de la palette, puis le plan pour le poser.")
            }
            "edges" -> tapEdges(w)
            "existing" -> tapExisting(w)
            else -> tapAccess(w)
        }
    }

    fun onLong(w: Point) {
        when (tab) {
            "furniture" -> {
                val hit = ItemEdit.hit(garden, w, tol(18.0))
                if (hit != null) { sel = AmSel.ItemSel(hit.id); pop = AmPop.ItemSize(hit.id); return }
                val k = kind
                if (k != null) placeItem(w, k)?.let { pop = AmPop.ItemSize(it.id) }
            }
            "existing" -> {
                val hit = ExistingEdit.hit(garden, w, tol(18.0))
                if (hit != null) { sel = AmSel.ExSel(hit.id); exKind = null; pop = AmPop.Ex(hit.id); return }
                val k = exKind
                if (k != null && exDraft == null && getExistingKind(k)?.linear != true) placeExisting(w)?.let { pop = AmPop.Ex(it.id) }
            }
            "edges" -> {
                val sd = ItemEdit.hitBoundarySide(garden, w, tol(22.0))
                if (sd >= 0) { sel = AmSel.EdgeSel(sd); pop = AmPop.Edge(sd); return }
                ItemEdit.hitFreeLine(garden, w, tol(20.0))?.let { sel = AmSel.FreeSel(it.id); pop = AmPop.Free(it.id) }
            }
            else -> ItemEdit.hitOpening(garden, w, tol(24.0))?.let { sel = AmSel.OpenSel(it.id); pop = AmPop.Open(it.id) }
        }
    }

    // ------------------------------------------------------------------ mobilier

    private fun placeItem(w: Point, k: String): Item? {
        val def = getItemKind(k) ?: return null
        val it0 = ItemEdit.create(garden, k, w, grid, tol(18.0))
        mutate { ItemEdit.upsert(it, it0) }
        sel = AmSel.ItemSel(it0.id); kind = null
        say("« ${def.label} » posé. Glissez pour le déplacer, la poignée ⟳ pour le tourner, appui long pour saisir sa taille en cm.")
        return it0
    }

    fun applyItemPop(id: String, w: Double?, d: Double?, rot: Double?, heightM: Double?, label: String?) {
        mutate { g ->
            val cur = g.items.firstOrNull { it.id == id } ?: return@mutate g
            var n = ItemEdit.resize(cur, w, d)
            if (rot != null) n = ItemEdit.rotateTo(n, rot)
            if (heightM != null) { val r = ItemEdit.setHeight(n, heightM); if (r.second?.ok != false) n = r.first }
            if (label != null) n = ItemEdit.setLabel(n, label)
            ItemEdit.upsert(g, n)
        }
    }

    fun resetItemHeight(id: String) {
        mutate { g -> g.items.firstOrNull { it.id == id }?.let { ItemEdit.upsert(g, ItemEdit.setHeight(it, null).first) } ?: g }
        say("Hauteur par défaut : ${formatHeight(defaultItemHeight(garden.items.firstOrNull { it.id == id }?.kind))}.")
    }

    // ------------------------------------------------------------------ côtés, murs libres

    private fun tapEdges(w: Point) {
        val d = draft
        if (d != null) { addDraftPoint(w, d); return }
        val sd = ItemEdit.hitBoundarySide(garden, w, tol(22.0))
        if (sd >= 0) { sel = AmSel.EdgeSel(sd); say("Côté ${sd + 1} sélectionné : choisissez Ouvert, Mur, Clôture ou Haie."); return }
        ItemEdit.hitFreeLine(garden, w, tol(20.0))?.let { sel = AmSel.FreeSel(it.id); say(""); return }
        if (sel != null) sel = null
        say(if (garden.boundary.size >= 2) "Touchez un côté du terrain pour en faire un mur, une clôture ou une haie." else "Pas de contour tracé : vous pouvez dessiner un mur ou une clôture libre.")
    }

    fun startDraft(k: String) {
        draft = FreeDraft(k); sel = null
        say("${ItemEdit.FREE_KINDS.getValue(k).first} libre : touchez les points successifs, puis « Terminer » (ou touchez le 1er point pour fermer la boucle).")
    }

    private fun nearVertex(w: Point): Point? {
        val g = garden
        val pts = ArrayList<Point>(g.boundary)
        g.obstacles.forEach { o -> o.points?.let { pts.addAll(it) } }
        var best: Point? = null; var bd = tol(14.0)
        for (q in pts) { val d = distance(w, q); if (d <= bd) { bd = d; best = q } }
        return best?.let { Point(it.x, it.y) }
    }

    private fun addDraftPoint(w: Point, d: FreeDraft) {
        val pts = d.points
        if (pts.size >= 3 && distance(w, pts[0]) <= tol(24.0)) { draft = d.copy(points = pts + Point(pts[0].x, pts[0].y)); finishDraft(); say("Boucle fermée."); return }
        val p = nearVertex(w) ?: snapToGrid(w, grid)
        if (pts.isNotEmpty() && distance(pts.last(), p) < 0.02) return
        draft = d.copy(points = pts + p)
    }

    fun finishDraft() {
        val d = draft
        if (d == null || d.points.size < 2) { say("Posez au moins deux points.", "warn"); return }
        val o = ItemEdit.addFreeLine(garden, d.kind, d.points).second
        mutate { it.copy(obstacles = it.obstacles + o) }
        draft = null; sel = AmSel.FreeSel(o.id)
        say("${ItemEdit.FREE_KINDS.getValue(d.kind).first} ajouté. Appui long pour changer sa hauteur.")
    }

    fun draftUndoPoint() { draft?.let { draft = it.copy(points = it.points.dropLast(1)) } }
    fun cancelDraft() { draft = null }

    // ------------------------------------------------------------------ portes et accès

    private fun tapAccess(w: Point) {
        ItemEdit.hitOpening(garden, w, tol(24.0))?.let { sel = AmSel.OpenSel(it.id); return }
        val label = getOpeningKind(openKind)?.label ?: ""
        val op = ItemEdit.placeOpening(garden, openKind, w, tol(70.0))
        if (op == null) {
            say(if (openKind == "garage" || openKind == "door") "Une ${label.lowercase()} se pose sur un côté de maison ou d’abri : touchez plus près d’un bâtiment."
            else "Touchez plus près d’un côté du terrain, d’un mur ou d’une clôture.", "warn")
            return
        }
        mutate { ItemEdit.upsertOpening(it, op) }
        sel = AmSel.OpenSel(op.id)
        say("$label ajouté. Glissez-le le long du côté, appui long pour sa largeur en cm.")
    }

    fun applyOpeningWidth(id: String, m: Double) {
        mutate { g -> g.openings.firstOrNull { it.id == id }?.let { op ->
            val w = ItemEdit.setOpeningWidth(op, m)
            val og = fr.jardin.core.openingGeometry(g, w)
            ItemEdit.upsertOpening(g, if (og != null) w.copy(t = og.t) else w)
        } ?: g }
    }

    // ------------------------------------------------------------------ existant

    private fun tapExisting(w: Point) {
        val dr = exDraft
        if (dr != null) { addExDraftPoint(w, dr); return }
        val hit = ExistingEdit.hit(garden, w, tol(18.0))
        if (hit != null) { sel = AmSel.ExSel(hit.id); exKind = null; say(""); return }
        val k = exKind
        if (k != null) {
            if (getExistingKind(k)?.linear == true) { exDraftKind = k; exDraft = emptyList(); sel = null; addExDraftPoint(w, emptyList()); say(""); return }
            placeExisting(w); return
        }
        if (sel != null) sel = null
        say("Touchez un type (arbre, arbuste, haie…), puis le plan pour le poser.")
    }

    private fun placeExisting(w: Point): Existing? {
        val k = exKind ?: return null
        val kd = getExistingKind(k) ?: return null
        var e = ExistingEdit.place(k, w, grid)
        if (k == "fence") e = ExistingEdit.setMaterial(e, fenceMaterial)
        mutate { ExistingEdit.upsert(it, e) }
        sel = AmSel.ExSel(e.id); exKind = null; exQuery = ""
        say("« ${kd.label} » posé. Précisez la plante ci-dessous (ou « Je ne sais pas »), réglez sa taille actuelle, glissez pour le déplacer.")
        return e
    }

    private fun addExDraftPoint(w: Point, pts: List<Point>) {
        if (ExistingEdit.closesLoop(exDraftKind, pts, w, tol(24.0))) { exDraft = pts + Point(pts[0].x, pts[0].y); finishExDraft(); say("Boucle fermée."); return }
        val p = nearVertex(w) ?: snapToGrid(w, grid)
        if (pts.isNotEmpty() && distance(pts.last(), p) < 0.02) return
        exDraft = pts + p
    }

    fun finishExDraft() {
        val pts = exDraft
        if (pts == null || pts.size < 2) { say("Posez au moins deux points.", "warn"); return }
        val e = ExistingEdit.fromTrace(exDraftKind, pts, fenceMaterial)
        mutate { ExistingEdit.upsert(it, e) }
        exDraft = null; exKind = null; sel = AmSel.ExSel(e.id); exQuery = ""
        say("${getExistingKind(e.kind)?.label} ajoutée. Glissez-la pour la déplacer, appui long pour saisir sa hauteur en cm.")
    }

    fun exDraftUndoPoint() { exDraft?.let { exDraft = it.dropLast(1) } }
    fun cancelExDraft() { exDraft = null }

    fun applyExistingPop(id: String, h: Double?, w: Double?, label: String?) {
        mutate { g -> g.existing.firstOrNull { it.id == id }?.let { e ->
            var n = e
            if (h != null) { val r = ExistingEdit.setHeight(n, h); if (r.second.ok) n = r.first }
            if (w != null) n = ExistingEdit.setWidth(n, w)
            if (label != null) n = ExistingEdit.setLabel(n, label)
            ExistingEdit.upsert(g, n)
        } ?: g }
    }

    override fun fitPoints(): List<Point> = super.fitPoints()

    /** Sélection hors du terrain (pour l'avertissement « ⚠ sort du terrain »). */
    fun outside(): Boolean {
        selItem?.let { return ItemEdit.isOutside(garden, it) }
        selEx?.let { return ExistingEdit.isOutside(garden, it) }
        return false
    }

    override fun onHistoryApplied() { sel = null; pop = null; draft = null; exDraft = null }
}
