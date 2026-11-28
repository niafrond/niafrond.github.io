package fr.jardin.core

import kotlin.math.*

// Aménagements du jardin (port de jardin/items.js) : catalogue de mobilier/équipements, ouvertures,
// géométrie des éléments, des côtés de contour et des passages. Repère : mètres, x droite, y bas ;
// rotation en degrés, sens horaire à l'écran.

/** Élément posable : `w` × `d` = largeur × profondeur par défaut (m) ; cercle : w = d = diamètre. `height` : hauteur d'ombre. */
data class ItemKind(
    val id: String, val label: String, val short: String, val emoji: String, val category: String,
    val w: Double, val d: Double, val shape: String, val color: String, val priceEur: Double, val height: Double? = null,
)

val ITEM_KINDS: List<ItemKind> = listOf(
    ItemKind("bench", "Banc", "Banc", "🪑", "furniture", 1.5, 0.5, "rect", "#a1887f", 90.0),
    ItemKind("table", "Table rectangulaire", "Table", "🍽️", "furniture", 1.8, 0.9, "rect", "#bcaaa4", 250.0),
    ItemKind("table_round", "Table ronde", "Table", "⭕", "furniture", 1.2, 1.2, "circle", "#bcaaa4", 200.0),
    ItemKind("chair", "Chaise", "Chaise", "💺", "furniture", 0.5, 0.5, "rect", "#8d6e63", 40.0),
    ItemKind("lounge", "Salon de jardin", "Salon", "🛋️", "furniture", 2.4, 2.4, "rect", "#90a4ae", 450.0),
    ItemKind("sunbed", "Transat / bain de soleil", "Transat", "🏖️", "furniture", 0.65, 1.9, "rect", "#ffcc80", 120.0),
    ItemKind("parasol", "Parasol", "Parasol", "⛱️", "furniture", 3.0, 3.0, "circle", "#ef9a9a", 150.0, 2.5),
    ItemKind("hammock", "Hamac sur pied", "Hamac", "🛏️", "furniture", 3.5, 1.0, "rect", "#ce93d8", 130.0),
    ItemKind("bbq", "Barbecue / plancha", "Barbecue", "🔥", "equipment", 0.9, 0.6, "rect", "#757575", 220.0),
    ItemKind("firepit", "Brasero / foyer", "Brasero", "🪵", "equipment", 0.8, 0.8, "circle", "#8d6e63", 80.0),
    ItemKind("composter", "Composteur", "Compost", "♻️", "equipment", 0.8, 0.8, "rect", "#6d4c41", 60.0),
    ItemKind("rain_tank", "Cuve de récupération d’eau", "Cuve", "🛢️", "equipment", 1.0, 1.0, "circle", "#4fc3f7", 150.0, 1.5),
    ItemKind("planter", "Jardinière / bac", "Bac", "🪴", "equipment", 1.0, 0.4, "rect", "#a5d6a7", 40.0),
    ItemKind("raised_bed", "Carré potager surélevé", "Potager", "🥬", "equipment", 1.2, 1.2, "rect", "#c5e1a5", 70.0),
    ItemKind("woodpile", "Abri à bûches", "Bûches", "🪓", "equipment", 1.5, 0.5, "rect", "#a1887f", 90.0),
    ItemKind("clothesline", "Étendoir", "Étendoir", "🧺", "equipment", 1.6, 1.6, "rect", "#b0bec5", 60.0),
    ItemKind("mailbox", "Boîte aux lettres", "Boîte", "📮", "equipment", 0.4, 0.3, "rect", "#ffb74d", 40.0),
    ItemKind("light", "Éclairage / lampadaire", "Lampe", "💡", "equipment", 0.3, 0.3, "circle", "#fff176", 40.0),
    ItemKind("fountain", "Fontaine", "Fontaine", "⛲", "equipment", 0.8, 0.8, "circle", "#81d4fa", 150.0),
    ItemKind("swing", "Balançoire", "Balançoire", "🎠", "equipment", 3.0, 2.0, "rect", "#ffab91", 250.0),
    ItemKind("trampoline", "Trampoline", "Trampo", "🤸", "equipment", 3.0, 3.0, "circle", "#9fa8da", 250.0),
    ItemKind("sandbox", "Bac à sable", "Sable", "🏖️", "equipment", 1.2, 1.2, "rect", "#ffe082", 80.0),
    ItemKind("playhouse", "Cabane enfant", "Cabane", "🛖", "structure", 1.5, 1.5, "rect", "#bcaaa4", 300.0, 1.8),
    ItemKind("shed_item", "Abri de jardin", "Abri", "🏚️", "structure", 2.5, 2.0, "rect", "#a1887f", 600.0, 2.3),
    ItemKind("greenhouse", "Serre", "Serre", "🏡", "structure", 3.0, 2.0, "rect", "#b2dfdb", 500.0, 2.0),
    ItemKind("pergola", "Pergola", "Pergola", "🏛️", "structure", 3.0, 3.0, "rect", "#d7ccc8", 900.0, 2.4),
    ItemKind("gazebo", "Tonnelle", "Tonnelle", "⛺", "structure", 3.0, 3.0, "rect", "#e0e0e0", 500.0, 2.5),
)

data class ItemCategory(val id: String, val label: String)
val ITEM_CATEGORIES = listOf(ItemCategory("furniture", "Mobilier"), ItemCategory("equipment", "Équipements"), ItemCategory("structure", "Structures"))

/** Type d'ouverture. `targets` : où le passage peut se poser (contour du terrain, types d'obstacles). */
data class OpeningKind(val id: String, val label: String, val emoji: String, val width: Double, val swing: String, val color: String, val targets: List<String>)

val OPENING_KINDS: List<OpeningKind> = listOf(
    OpeningKind("gate", "Portail", "🚪", 3.0, "in", "#5d4037", listOf("boundary", "wall", "fence", "house", "shed")),
    OpeningKind("wicket", "Portillon", "🚪", 1.0, "in", "#6d4c41", listOf("boundary", "wall", "fence")),
    OpeningKind("door", "Porte", "🚪", 0.9, "out", "#8d6e63", listOf("house", "shed")),
    OpeningKind("garage", "Porte de garage", "🚗", 2.4, "sliding", "#607d8b", listOf("house", "shed")),
    OpeningKind("double_gate", "Double portail", "🚧", 4.0, "in", "#4e342e", listOf("boundary", "wall", "fence")),
)
data class OpeningSwing(val id: String, val label: String)
val OPENING_SWINGS = listOf(
    OpeningSwing("in", "S’ouvre vers l’intérieur"),
    OpeningSwing("out", "S’ouvre vers l’extérieur"),
    OpeningSwing("sliding", "Coulissant / sectionnel"),
)

/** Côtés de contour : types et hauteurs par défaut (m). */
data class EdgeKind(val id: String, val label: String, val height: Double, val thickness: Double? = null, val color: String? = null)
val EDGE_KINDS: List<EdgeKind> = listOf(
    EdgeKind("open", "Ouvert", 0.0, null),
    EdgeKind("wall", "Mur", 2.0, 0.2, "#424242"),
    EdgeKind("fence", "Clôture", 1.2, 0.05, "#6d4c41"),
    EdgeKind("hedge", "Haie", 1.8, 0.6, "#3f8f4a"),
)
val EDGE_IDS: List<String> = EDGE_KINDS.map { it.id }

data class Material(val label: String, val color: String)
/** Matériaux des murs et clôtures. */
val MATERIALS: Map<String, Material> = linkedMapOf("wood" to Material("Bois", "#8d6e63"), "metal" to Material("Métal", "#455a64"), "concrete" to Material("Béton", "#9e9e9e"), "stone" to Material("Pierre", "#a1887f"), "brick" to Material("Brique", "#b5593c"), "mesh" to Material("Grillage", "#78909c"))
val EDGE_MATERIALS: Map<String, List<String>> = mapOf(
    "wall" to listOf("stone", "concrete", "brick"),
    "fence" to listOf("wood", "metal", "concrete", "mesh"),
)
fun defaultMaterial(kind: String?): String? = when (kind) { "wall" -> "stone"; "fence" -> "wood"; else -> null }
/** Matériau effectif d'un côté de contour (ou d'une clôture libre) : valeur valide, sinon défaut du type. */
fun materialOf(kind: String?, material: String?): String? {
    val ids = EDGE_MATERIALS[kind] ?: return null
    return if (material != null && material in ids) material else defaultMaterial(kind)
}

fun getItemKind(id: String?): ItemKind? = ITEM_KINDS.firstOrNull { it.id == id }
fun getOpeningKind(id: String?): OpeningKind? = OPENING_KINDS.firstOrNull { it.id == id }
fun getEdgeKind(id: String?): EdgeKind? = EDGE_KINDS.firstOrNull { it.id == id }

private const val CERCLE = 24
/** Obstacles polygonaux fermés ; les autres (mur, clôture) sont des polylignes ouvertes. */
private val FERMES = setOf("house", "shed")

/** Rayon d'un élément circulaire (null pour un rectangle). */
fun itemRadius(item: Item?): Double? = item?.radius?.takeIf { it.isFinite() && it > 0 }

data class HalfSize(val hw: Double, val hd: Double)

/** Demi-dimensions d'un élément (m). */
fun itemHalfSize(item: Item): HalfSize {
    val r = itemRadius(item)
    if (r != null) return HalfSize(r, r)
    return HalfSize(max(0.01, item.width.takeIf { it != 0.0 } ?: 0.5) / 2, max(0.01, item.depth.takeIf { it != 0.0 } ?: 0.5) / 2)
}

/** Polygone d'un élément : rectangle tourné (4 sommets) ou cercle échantillonné (24 sommets). */
fun itemPolygon(item: Item, segments: Int = CERCLE): List<Point> {
    val cx = item.x; val cy = item.y
    val r = itemRadius(item)
    if (r != null) {
        return List(segments) { i ->
            val t = 2 * PI * i / segments
            Point(cx + r * cos(t), cy + r * sin(t))
        }
    }
    val (hw, hd) = itemHalfSize(item)
    val a = rad(item.rotation)
    val c = cos(a); val s = sin(a)
    return listOf(-hw to -hd, hw to -hd, hw to hd, -hw to hd).map { (lx, ly) -> Point(cx + lx * c - ly * s, cy + lx * s + ly * c) }
}

/** Le point est-il dans l'élément ? */
fun itemContains(item: Item, p: Point): Boolean = pointInPolygon(p, itemPolygon(item))

data class Side(val i: Int, val a: Point, val b: Point)

/** Côtés du contour (n côtés si fermé, n-1 sinon). */
fun boundarySides(garden: Garden?): List<Side> {
    val b = garden?.boundary ?: emptyList()
    val n = b.size
    if (n < 2) return emptyList()
    val count = if (garden!!.boundaryClosed && n >= 3) n else n - 1
    return List(count) { i -> Side(i, b[i], b[(i + 1) % n]) }
}

/** Côtés d'une forme : maison/abri = polygone fermé, mur/clôture = polyligne ; arbre = aucun. */
fun obstacleSides(kind: String?, pts: List<Point>?): List<Side> {
    if (pts == null || pts.size < 2) return emptyList()
    val n = pts.size
    val count = if (kind in FERMES && n >= 3) n else n - 1
    return List(count) { i -> Side(i, pts[i], pts[(i + 1) % n]) }
}
fun obstacleSides(ob: Obstacle?): List<Side> = obstacleSides(ob?.kind, ob?.points)

data class ResolvedSide(val a: Point, val b: Point, val outward: Double, val kind: String)

private fun sign1(v: Double): Double = if (v > 0) 1.0 else if (v < 0) -1.0 else 1.0

/** Côté désigné par une référence d'ouverture, ou null. */
fun resolveSide(garden: Garden?, ref: OpeningRef?): ResolvedSide? {
    if (ref == null || ref.side < 0 || garden == null) return null
    when (ref.type) {
        "boundary" -> {
            val s = boundarySides(garden).firstOrNull { it.i == ref.side } ?: return null
            val closed = garden.boundaryClosed && garden.boundary.size >= 3
            return ResolvedSide(s.a, s.b, if (closed) sign1(signedArea(garden.boundary)) else 1.0, "boundary")
        }
        "obstacle" -> {
            val ob = garden.obstacles.firstOrNull { it.id == ref.obstacleId } ?: return null
            val s = obstacleSides(ob).firstOrNull { it.i == ref.side } ?: return null
            val pts = ob.points ?: return null
            val closedPoly = ob.kind in FERMES && pts.size >= 3
            return ResolvedSide(s.a, s.b, if (closedPoly) sign1(signedArea(pts)) else 1.0, ob.kind)
        }
        "existing" -> {
            val ex = garden.existing.firstOrNull { it.id == ref.existingId }
            if (ex == null || ex.kind != "fence" || ex.points == null) return null
            val s = obstacleSides(ex.kind, ex.points).firstOrNull { it.i == ref.side } ?: return null
            return ResolvedSide(s.a, s.b, 1.0, "fence")
        }
    }
    return null
}

data class OpeningGeometry(
    val a: Point, val b: Point, val center: Point, val normal: Point, val u: Point,
    val width: Double, val t: Double, val sideLength: Double, val sideKind: String,
)

/** Segment du passage d'une ouverture ; `normal` unitaire vers l'extérieur ; null si le côté n'existe plus. */
fun openingGeometry(garden: Garden?, opening: Opening?): OpeningGeometry? {
    val side = resolveSide(garden, opening?.ref) ?: return null
    val dx = side.b.x - side.a.x; val dy = side.b.y - side.a.y
    val L = hypot(dx, dy)
    if (L < 1e-9) return null
    val u = Point(dx / L, dy / L)
    val width = min(max(0.1, opening!!.width.takeIf { it != 0.0 } ?: 1.0), L)
    val half = width / 2 / L
    val t = min(1 - half, max(half, if (opening.t.isFinite()) opening.t else 0.5))
    val center = Point(side.a.x + dx * t, side.a.y + dy * t)
    val normal = Point(u.y * side.outward, -u.x * side.outward)
    val w2 = width / 2
    return OpeningGeometry(
        Point(center.x - u.x * w2, center.y - u.y * w2), Point(center.x + u.x * w2, center.y + u.y * w2),
        center, normal, u, width, t, L, side.kind,
    )
}

/** La cible (`boundary`, `wall`, `house`…) accepte-t-elle ce type d'ouverture ? */
fun openingAllowedOn(kindId: String, target: String): Boolean {
    val k = getOpeningKind(kindId) ?: return false
    return target in k.targets
}

data class OpeningSnap(val ref: OpeningRef, val t: Double, val point: Point, val dist: Double)

/** Côté le plus proche d'un point, parmi ceux acceptant le type d'ouverture (`kind`, tous si null). */
fun snapOpeningToSides(garden: Garden?, point: Point, kind: String? = null, maxDist: Double = Double.POSITIVE_INFINITY): OpeningSnap? {
    var best: OpeningSnap? = null
    fun essai(a: Point, b: Point, ref: OpeningRef) {
        val dx = b.x - a.x; val dy = b.y - a.y
        val L2 = dx * dx + dy * dy
        if (L2 < 1e-12) return
        val t = min(1.0, max(0.0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / L2))
        val q = Point(a.x + dx * t, a.y + dy * t)
        val dist = hypot(point.x - q.x, point.y - q.y)
        if (dist <= maxDist && (best == null || dist < best!!.dist)) best = OpeningSnap(ref, t, q, dist)
    }
    if (kind == null || openingAllowedOn(kind, "boundary")) {
        for (s in boundarySides(garden)) essai(s.a, s.b, OpeningRef("boundary", s.i))
    }
    for (ob in garden?.obstacles ?: emptyList()) {
        if (ob.kind !in listOf("house", "shed", "wall", "fence")) continue
        if (kind != null && !openingAllowedOn(kind, ob.kind)) continue
        for (s in obstacleSides(ob)) essai(s.a, s.b, OpeningRef("obstacle", s.i, obstacleId = ob.id))
    }
    for (ex in garden?.existing ?: emptyList()) {
        if (ex.kind != "fence" || ex.points == null) continue
        if (kind != null && !openingAllowedOn(kind, "fence")) continue
        for (s in obstacleSides(ex.kind, ex.points)) essai(s.a, s.b, OpeningRef("existing", s.i, existingId = ex.id))
    }
    return best
}

/** Type d'un côté de contour : 'open' | 'wall' | 'fence' | 'hedge'. */
fun edgeKindOf(garden: Garden?, i: Int): String {
    val e = garden?.boundaryEdges?.getOrNull(i)
    return if (e != null && e.kind in EDGE_IDS) e.kind else "open"
}

/** Hauteur (m) d'un côté de contour. */
fun edgeHeightOf(garden: Garden?, i: Int): Double {
    val e = garden?.boundaryEdges?.getOrNull(i)
    val k = getEdgeKind(edgeKindOf(garden, i))
    if (k == null || k.id == "open") return 0.0
    return if (e?.height != null && e.height.isFinite() && e.height > 0) e.height else k.height
}

/**
 * Obstacle d'ombre/rendu : disque (`center` + `radius`) ou polyligne/polygone (`points`) avec hauteur.
 * Regroupe les « obstacles » dynamiques du JS (côtés de contour, éléments hauts, existants, zones, dessinés).
 */
data class ShadowObstacle(
    val id: String,
    val kind: String,
    val height: Double,
    val points: List<Point>? = null,
    val center: Point? = null,
    val radius: Double? = null,
    val thickness: Double? = null,
    val opacity: Double? = null,
    val itemKind: String? = null,
    val edge: Int? = null,
    val existing: Boolean = false,
    val zone: Boolean = false,
)

/** Obstacles linéaires dérivés des côtés du contour murs / clôtures / haies. */
fun edgeObstacles(garden: Garden?): List<ShadowObstacle> {
    val out = ArrayList<ShadowObstacle>()
    for (s in boundarySides(garden)) {
        val kind = edgeKindOf(garden, s.i)
        if (kind == "open") continue
        out.add(ShadowObstacle("edge_${s.i}", kind, edgeHeightOf(garden, s.i), points = listOf(Point(s.a.x, s.a.y), Point(s.b.x, s.b.y)), edge = s.i))
    }
    return out
}

/** Obstacles d'ombre issus des éléments hauts (pergola, parasol, abri…). */
fun itemObstacles(garden: Garden?): List<ShadowObstacle> {
    val out = ArrayList<ShadowObstacle>()
    for (it in garden?.items ?: emptyList()) {
        val k = getItemKind(it.kind)
        val h = it.height ?: k?.height
        if (h == null || !(h > 0)) continue
        out.add(ShadowObstacle("item_${it.id}", "item", h, points = itemPolygon(it), itemKind = it.kind))
    }
    return out
}

/** Prix indicatif total (€) des éléments posés. */
fun itemsTotalPrice(garden: Garden?): Double {
    var s = 0.0
    for (it in garden?.items ?: emptyList()) {
        val k = getItemKind(it.kind)
        if (k != null) s += k.priceEur
    }
    return s
}
