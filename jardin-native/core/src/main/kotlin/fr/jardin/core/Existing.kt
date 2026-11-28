package fr.jardin.core

import java.util.UUID
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin

// Plantes déjà présentes sur le terrain (port de jardin/existing.js) : modèle, empreintes, ombre portée,
// résumé et données pour les rendus. Les fonctions qui modifiaient l'objet en place renvoient une copie.

/**
 * Type d'élément existant. `height` × `width` : dimensions typiques (m) ; `habit` : port par défaut sans essence ;
 * `category` : catégories du catalogue proposées ; `linear` : tracé en polyligne (haie) ; `palette = false` : hors palette.
 */
data class ExistingKind(
    val id: String, val label: String, val plural: String, val emoji: String, val color: String,
    val height: Double, val width: Double, val habit: String?, val category: List<String>, val defaultLabel: String,
    val linear: Boolean = false, val plant: Boolean = true, val palette: Boolean = true,
)

val EXISTING_KINDS: List<ExistingKind> = listOf(
    ExistingKind("tree", "Arbre", "arbres", "🌳", "#4f8a3a", 8.0, 5.0, "tree-round", listOf("tree", "fruit"), "Arbre existant", linear = false, plant = true, palette = true),
    ExistingKind("shrub", "Arbuste", "arbustes", "🌿", "#6aa84a", 1.5, 1.5, "shrub-round", listOf("shrub"), "Arbuste existant", linear = false, plant = true, palette = true),
    ExistingKind("hedge", "Haie", "haies", "🟩", "#3f8f4a", 1.8, 0.8, "hedge-clipped", listOf("hedge"), "Haie existante", linear = true, plant = true, palette = true),
    ExistingKind("climber", "Grimpante", "grimpantes", "🌱", "#5a9a4a", 2.5, 1.5, "climber", listOf("climber"), "Grimpante existante", linear = false, plant = true, palette = true),
    ExistingKind("perennial", "Vivace / massif", "vivaces ou massifs", "🌸", "#c26a9a", 0.7, 1.0, "perennial-clump", listOf("perennial", "grass", "bulb", "groundcover"), "Massif existant", linear = false, plant = true, palette = true),
    ExistingKind("fence", "Clôture", "clôtures", "🚧", "#8d6e63", 1.2, 0.05, null, listOf(), "Clôture existante", linear = true, plant = false, palette = true),
    ExistingKind("other", "Autre plante", "autres plantes", "🪴", "#7a9a5a", 1.0, 1.0, "shrub-round", listOf(), "Plante existante", linear = false, plant = true, palette = false),
)
val EXISTING_KIND_IDS: List<String> = EXISTING_KINDS.map { it.id }
fun getExistingKind(id: String?): ExistingKind? = EXISTING_KINDS.firstOrNull { it.id == id }

/** Matériau de clôture existante : hauteur/épaisseur typiques (m) ; `opacity` : part de lumière arrêtée. */
data class FenceMaterial(val id: String, val label: String, val height: Double, val thickness: Double, val opacity: Double, val color: String)

val FENCE_MATERIALS: List<FenceMaterial> = listOf(
    FenceMaterial("wood", "Bois", 1.2, 0.05, 1.0, "#8d6e63"),
    FenceMaterial("metal", "Métal", 1.5, 0.03, 0.15, "#455a64"),
    FenceMaterial("concrete", "Béton", 1.8, 0.15, 1.0, "#9e9e9e"),
)
fun getFenceMaterial(id: String?): FenceMaterial = FENCE_MATERIALS.firstOrNull { it.id == id } ?: FENCE_MATERIALS[0]

data class ExistingAge(val id: String, val label: String, val factor: Double)
val EXISTING_AGES = listOf(ExistingAge("young", "Jeune", 0.4), ExistingAge("adult", "Adulte", 1.0), ExistingAge("old", "Vieux", 1.15))

/** `num` d'existing.js : nombre fini (0 compris), sinon défaut. */
private fun numF(v: Double?, d: Double): Double = if (v != null && v.isFinite()) v else d
private const val SEG = 20

private fun newEid(): String = "e_" + UUID.randomUUID().toString().replace("-", "").take(14)

private fun centroidOf(pts: List<Point>): Point =
    if (pts.isEmpty()) Point(0.0, 0.0) else Point(pts.sumOf { it.x } / pts.size, pts.sumOf { it.y } / pts.size)

/** Nouvel élément existant en un point `at`. Une haie/clôture reçoit un tracé de 2 m centré sur le point. */
fun createExisting(kind: String, at: Point = Point(0.0, 0.0)): Existing {
    val k = getExistingKind(kind) ?: throw IllegalArgumentException("Type d'existant inconnu : $kind")
    var e = Existing(id = newEid(), kind = kind, plantId = null, label = k.defaultLabel, x = at.x, y = at.y, height = k.height, width = k.width,
        points = if (k.linear) listOf(Point(at.x - 1, at.y), Point(at.x + 1, at.y)) else null)
    if (kind == "fence") { val m = getFenceMaterial("wood"); e = e.copy(material = "wood", height = m.height, width = m.thickness) }
    return e
}

/** Nouvel élément existant tracé (haie, clôture) : le centre est le centroïde des points. */
fun createExisting(kind: String, points: List<Point>): Existing {
    val k = getExistingKind(kind) ?: throw IllegalArgumentException("Type d'existant inconnu : $kind")
    val pts = points.map { Point(it.x, it.y) }
    val c = centroidOf(pts)
    var e = Existing(id = newEid(), kind = kind, plantId = null, label = k.defaultLabel, x = c.x, y = c.y, points = pts, height = k.height, width = k.width)
    if (kind == "fence") { val m = getFenceMaterial("wood"); e = e.copy(material = "wood", height = m.height, width = m.thickness) }
    return e
}

/** Change le matériau d'une clôture existante (hauteur et épaisseur typiques du matériau). */
fun setFenceMaterial(e: Existing, material: String?): Existing {
    val m = getFenceMaterial(material)
    return e.copy(material = m.id, height = m.height, width = m.thickness)
}

/** Essence du catalogue d'un existant, ou null. */
fun existingPlant(e: Existing?, lookup: PlantLookup = defaultPlantLookup): PlantLike? =
    if (e?.plantId != null) lookup(e.plantId) else null

/** Nom affiché : libellé saisi, sinon nom de l'essence, sinon libellé par défaut du type. */
fun existingLabel(e: Existing?, lookup: PlantLookup = defaultPlantLookup): String {
    if (e?.label != null && e.label.trim().isNotEmpty()) return e.label.trim()
    val p = existingPlant(e, lookup)
    if (p != null) return p.commonName?.takeIf { it.isNotEmpty() } ?: p.id
    val k = e?.let { getExistingKind(it.kind) }
    return k?.defaultLabel ?: "Plante existante"
}

/** Taille actuelle estimée d'une essence selon l'âge ("young" | "adult" | "old" ou facteur) : (hauteur, largeur) en m. */
data class PlantSize(val height: Double, val width: Double)

fun sizeForPlant(plant: PlantLike?, age: Any? = "adult", kind: String? = null): PlantSize {
    val a = EXISTING_AGES.firstOrNull { it.id == age }
    val f = a?.factor ?: when (age) { is Number -> age.toDouble(); is String -> age.toDoubleOrNull(); else -> null }?.takeIf { it.isFinite() } ?: 1.0
    val k = getExistingKind(kind)
    val h0 = numF(plant?.heightAdult, k?.height ?: 1.0)
    val w0 = numF(plant?.widthAdult, k?.width ?: 1.0)
    fun r(v: Double) = max(0.1, jsRound(v * 20) / 20)
    return PlantSize(r(h0 * f), r(w0 * (0.5 + 0.5 * f)))
}

/** Type d'existant conseillé pour une catégorie du catalogue. */
fun kindForCategory(category: String?): String = EXISTING_KINDS.firstOrNull { category in it.category }?.id ?: "other"

/**
 * Assainit `existing` et y migre les obstacles « arbre existant » (kind 'tree' avec centre) de l'éditeur de contour,
 * en conservant leurs ids. Idempotent.
 */
fun ensureExisting(g: Garden): Garden {
    val list = g.existing.map { e ->
        val k = getExistingKind(e.kind) ?: getExistingKind("other")!!
        var out = e.copy(kind = k.id)
        if (out.id.isEmpty()) out = out.copy(id = newEid())
        if (out.label == null) out = out.copy(label = k.defaultLabel)
        out.points?.let { ps -> out = out.copy(points = ps.filter { it.x.isFinite() && it.y.isFinite() }.map { Point(it.x, it.y) }) }
        if (k.linear && (out.points == null || out.points!!.size < 2)) {
            out = out.copy(points = listOf(Point(numF(out.x, 0.0) - 1, numF(out.y, 0.0)), Point(numF(out.x, 0.0) + 1, numF(out.y, 0.0))))
        }
        out = if (!out.points.isNullOrEmpty()) {
            if (!out.x.isFinite() || !out.y.isFinite()) { val c = centroidOf(out.points!!); out.copy(x = c.x, y = c.y) } else out
        } else out.copy(x = numF(out.x, 0.0), y = numF(out.y, 0.0))
        out = out.copy(height = max(0.05, numF(out.height, k.height)), width = max(0.02, numF(out.width, k.width)))
        out = out.copy(material = if (k.id == "fence") (if (FENCE_MATERIALS.any { it.id == out.material }) out.material else "wood") else null)
        out
    }.toMutableList()
    val have = list.map { it.id }.toMutableSet()
    val rest = ArrayList<Obstacle>()
    for (o in g.obstacles) {
        if (o.kind == "tree" && o.center != null) {
            val id = o.id.ifEmpty { newEid() }
            if (id !in have) {
                have.add(id)
                list.add(Existing(
                    id = id, kind = "tree", plantId = null, label = getExistingKind("tree")!!.defaultLabel,
                    x = o.center.x, y = o.center.y, height = numF(o.height, 8.0), width = max(0.2, numF(o.radius, 2.0) * 2),
                ))
            }
        } else rest.add(o)
    }
    return g.copy(existing = list, obstacles = if (rest.size != g.obstacles.size) rest else g.obstacles)
}

private fun circleOf(c: Point, r: Double, n: Int = SEG): List<Point> = List(n) { i ->
    val t = 2 * PI * i / n
    Point(c.x + r * cos(t), c.y + r * sin(t))
}

/** Bande de largeur `w` autour d'une polyligne (décalage des sommets par la normale moyenne). */
private fun band(points: List<Point>, w: Double): List<Point> {
    val n = points.size
    val half = w / 2
    val left = ArrayList<Point>(); val right = ArrayList<Point>()
    for (i in 0 until n) {
        val a = points[max(0, i - 1)]; val b = points[minOf(n - 1, i + 1)]
        var dx = b.x - a.x; var dy = b.y - a.y
        val L = hypot(dx, dy).let { if (it == 0.0) 1.0 else it }
        dx /= L; dy /= L
        left.add(Point(points[i].x - dy * half, points[i].y + dx * half))
        right.add(Point(points[i].x + dy * half, points[i].y - dx * half))
    }
    return left + right.reversed()
}

/** Empreinte au sol d'un existant : houppier échantillonné (cercle) ou bande de haie. */
fun existingFootprint(e: Existing?): List<Point> {
    if (e == null) return emptyList()
    val w = max(0.02, numF(e.width, 1.0))
    if (e.points != null && e.points.size >= 2) return band(e.points, w)
    return circleOf(Point(numF(e.x, 0.0), numF(e.y, 0.0)), w / 2)
}

private fun actifs(garden: Garden?, includeRemoved: Boolean): List<Existing> =
    (garden?.existing ?: emptyList()).filter { includeRemoved || it.keep }

data class ExistingFootprintInfo(val id: String, val kind: String, val keep: Boolean, val polygon: List<Point>)

/** Empreintes de tous les existants conservés (espace occupé). */
fun existingFootprints(garden: Garden?, includeRemoved: Boolean = false): List<ExistingFootprintInfo> =
    actifs(garden, includeRemoved).map { ExistingFootprintInfo(it.id, it.kind, it.keep, existingFootprint(it)) }

/**
 * Obstacles d'ombre pour le soleil : disques (tree/shrub) ou polylignes (haie, clôture).
 * Les éléments « à retirer » ne projettent pas d'ombre ; `includeRemoved` les garde.
 */
fun existingShadowObstacles(garden: Garden?, includeRemoved: Boolean = false): List<ShadowObstacle> {
    val out = ArrayList<ShadowObstacle>()
    for (e in actifs(garden, includeRemoved)) {
        val height = numF(e.height, 0.0)
        if (!(height > 0)) continue
        val opacity = if (e.kind == "fence") getFenceMaterial(e.material).opacity else 1.0
        if (opacity < 0.5) continue
        if (e.points != null && e.points.size >= 2) {
            out.add(ShadowObstacle("existing_${e.id}", if (e.kind == "fence") "fence" else "hedge", height, existing = true,
                thickness = if (e.kind == "fence") numF(e.width, 0.05) else numF(e.width, 0.8), opacity = opacity,
                points = e.points.map { Point(it.x, it.y) }))
        } else {
            out.add(ShadowObstacle("existing_${e.id}", if (e.kind == "tree") "tree" else "shrub", height, existing = true,
                center = Point(numF(e.x, 0.0), numF(e.y, 0.0)), radius = max(0.05, numF(e.width, 1.0) / 2)))
        }
    }
    return out
}

data class ExistingSummary(val total: Int, val byKind: Map<String, Int>, val toRemove: Int, val text: String)

/** Résumé : « 3 existants : 2 arbres, 1 haie ». */
fun existingSummary(garden: Garden?): ExistingSummary {
    val list = garden?.existing ?: emptyList()
    val byKind = LinkedHashMap<String, Int>()
    for (e in list) byKind[e.kind] = (byKind[e.kind] ?: 0) + 1
    val toRemove = list.count { !it.keep }
    val parts = EXISTING_KINDS.filter { (byKind[it.id] ?: 0) > 0 }.map { k ->
        val n = byKind.getValue(k.id)
        "$n ${if (n > 1) k.plural else k.label.lowercase().replace(" / massif", "")}"
    }
    val total = list.size
    val text = if (total > 0) "$total existant${if (total > 1) "s" else ""} : ${parts.joinToString(", ")}" else "Aucun existant"
    return ExistingSummary(total, byKind, toRemove, text)
}

/** Existant prêt pour les rendus isométrique / 3D. */
data class RenderExisting(
    val id: String, val kind: String, val plant: PlantLike?, val x: Double, val y: Double, val height: Double, val width: Double,
    val keep: Boolean, val habit: Habit?, val label: String, val material: String? = null, val points: List<Point>? = null,
)

/** Données pour les rendus : `habit` = port de l'essence, sinon port par défaut du type. */
fun existingForRender(garden: Garden?, lookup: PlantLookup = defaultPlantLookup): List<RenderExisting> =
    (garden?.existing ?: emptyList()).map { e ->
        val k = getExistingKind(e.kind) ?: getExistingKind("other")!!
        val plant = existingPlant(e, lookup)
        val habit = if (k.habit != null) (if (plant != null) habitOf(plant) else getHabit(k.habit)) else null
        RenderExisting(
            e.id, e.kind, plant, e.x, e.y, e.height, e.width, e.keep, habit, existingLabel(e, lookup),
            material = if (e.kind == "fence") getFenceMaterial(e.material).id else null,
            points = if (e.points != null && e.points.size >= 2) e.points.map { Point(it.x, it.y) } else null,
        )
    }
