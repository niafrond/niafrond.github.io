package fr.jardin.core.plan

import fr.jardin.core.Existing
import fr.jardin.core.Garden
import fr.jardin.core.HeightCheck
import fr.jardin.core.PlantLike
import fr.jardin.core.Point
import fr.jardin.core.checkHeight
import fr.jardin.core.createExisting
import fr.jardin.core.distance
import fr.jardin.core.existingFootprint
import fr.jardin.core.getExistingKind
import fr.jardin.core.newId
import fr.jardin.core.polygonInside
import fr.jardin.core.setFenceMaterial
import fr.jardin.core.sizeForPlant
import kotlin.math.max

/** Opérations pures de l'onglet « Existant » : arbres, arbustes, haies, clôtures déjà présents (port de ui/draw-items.js + existing-panel.js). */
object ExistingEdit {
    /** Essences proposées pour un type (types voisins d'abord), filtrées par la saisie. */
    fun plantResults(kindId: String, query: String, limit: Int = 8): List<fr.jardin.core.Plant> {
        val k = getExistingKind(kindId)
        val q = query.trim()
        val list = (if (q.isEmpty()) fr.jardin.core.allPlants() else fr.jardin.core.searchPlants(q))
        fun pref(p: fr.jardin.core.Plant) = if (k != null && p.category in k.category) 0 else 1
        return list.sortedWith(Comparator { a, b ->
            val c = pref(a) - pref(b)
            if (c != 0) c else fr.jardin.core.frCompare(a.commonName, b.commonName)
        }).take(limit)
    }

    /** Nouvel existant ponctuel posé en `at` (grille appliquée). */
    fun place(kind: String, at: Point, grid: Double?): Existing = createExisting(kind, snapToGrid(at, grid))

    /** Haie ou clôture tracée point par point ; `material` pour la clôture (bois par défaut). */
    fun fromTrace(kind: String, points: List<Point>, fenceMaterial: String = "wood"): Existing {
        val e = createExisting(kind, points)
        return if (kind == "fence") setFenceMaterial(e, fenceMaterial) else e
    }

    /** Toucher le 1er point (au moins 3 points posés, clôture seulement) ferme la boucle. */
    fun closesLoop(kind: String, pts: List<Point>, w: Point, tol: Double): Boolean =
        kind == "fence" && pts.size >= 3 && distance(w, pts[0]) <= tol

    fun pointsOf(e: Existing): List<Point> = e.points ?: emptyList()

    /** Existant touché : dans son emprise, près de son centre, ou près de son tracé. */
    fun hit(g: Garden, w: Point, tol: Double): Existing? {
        for (i in g.existing.indices.reversed()) {
            val e = g.existing[i]
            val pts = e.points
            if (pts != null && pts.size >= 2) {
                for (k in 0 until pts.size - 1) {
                    val (q, _) = PlanHit.nearestOnSegment(w, pts[k], pts[k + 1])
                    if (distance(w, q) <= max(tol, e.width / 2)) return e
                }
                continue
            }
            val foot = existingFootprint(e)
            if (distance(Point(e.x, e.y), w) <= tol || (foot.size >= 3 && fr.jardin.core.pointInPolygon(w, foot))) return e
        }
        return null
    }

    /** Déplace l'existant de (dx, dy) m (centre et tracé). */
    fun translate(e: Existing, dx: Double, dy: Double): Existing =
        e.copy(x = e.x + dx, y = e.y + dy, points = e.points?.map { Point(it.x + dx, it.y + dy) })

    fun moveTo(e: Existing, p: Point): Existing = translate(e, p.x - e.x, p.y - e.y)

    fun setHeight(e: Existing, m: Double): Pair<Existing, HeightCheck> {
        val chk = checkHeight(e.kind, m)
        return if (chk.ok) e.copy(height = chk.value!!) to chk else e to chk
    }

    fun setWidth(e: Existing, m: Double): Existing = if (e.kind == "fence" || !(m > 0)) e else e.copy(width = m)

    fun setMaterial(e: Existing, material: String): Existing = if (e.kind == "fence") setFenceMaterial(e, material) else e

    fun setKeep(e: Existing, keep: Boolean): Existing = e.copy(keep = keep)
    fun setNotes(e: Existing, notes: String): Existing = e.copy(notes = notes.trim())
    fun setLabel(e: Existing, label: String): Existing = e.copy(label = label.trim().ifEmpty { null })

    /** Choisit l'essence : taille actuelle d'après l'âge, nom du catalogue. */
    fun choosePlant(e: Existing, plant: PlantLike, age: String): Existing {
        val s = sizeForPlant(plant, age, e.kind)
        return e.copy(plantId = plant.id, label = plant.commonName ?: e.label, height = s.height, width = s.width)
    }

    /** « Je ne sais pas / autre » : espèce inconnue, le texte saisi sert de nom libre. */
    fun unknownPlant(e: Existing, text: String): Existing {
        val k = getExistingKind(e.kind)
        return e.copy(plantId = null, label = text.trim().ifEmpty { k?.defaultLabel })
    }

    fun setAge(e: Existing, plant: PlantLike, age: String): Existing {
        val s = sizeForPlant(plant, age, e.kind)
        return e.copy(height = s.height, width = s.width)
    }

    fun duplicate(e: Existing): Existing =
        e.copy(id = "e_" + newId().take(14), x = e.x + 0.5, y = e.y + 0.5, points = e.points?.map { Point(it.x + 0.5, it.y + 0.5) })

    fun isOutside(g: Garden, e: Existing): Boolean {
        if (!(g.boundaryClosed && g.boundary.size >= 3)) return false
        val foot = existingFootprint(e)
        return foot.size >= 3 && !polygonInside(foot, g.boundary)
    }

    fun upsert(g: Garden, e: Existing): Garden =
        if (g.existing.any { it.id == e.id }) g.copy(existing = g.existing.map { if (it.id == e.id) e else it }) else g.copy(existing = g.existing + e)

    /** Supprime l'existant et les passages posés sur lui. */
    fun remove(g: Garden, id: String): Garden = g.copy(
        existing = g.existing.filter { it.id != id },
        openings = g.openings.filter { !(it.ref.type == "existing" && it.ref.existingId == id) },
    )
}
