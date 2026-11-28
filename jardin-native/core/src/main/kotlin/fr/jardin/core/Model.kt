package fr.jardin.core

import kotlinx.serialization.*
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.*
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

// Modèle de données du jardin (port de jardin/model.js). Le JSON est identique à celui du web :
// mêmes noms de champs, mêmes valeurs par défaut. Les classes sont immuables ; les fonctions qui
// modifiaient le jardin en place dans le JS (ensure*, setPoolVariant…) renvoient une copie.

/** Configuration JSON commune : tolère les champs inconnus et les `null` sur les champs non nuls. */
object JardinJson {
    @OptIn(ExperimentalSerializationApi::class)
    val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        coerceInputValues = true
        isLenient = true
    }
    fun encodeGarden(g: Garden): String = json.encodeToString(Garden.serializer(), g)
    fun decodeGarden(s: String): Garden = json.decodeFromString(Garden.serializer(), s)
}

/** Entier tolérant : accepte 3, 3.0 ou 2.6 (arrondi) comme le fait le JS avec `Math.round`. */
object LenientIntSerializer : KSerializer<Int> {
    override val descriptor = PrimitiveSerialDescriptor("LenientInt", PrimitiveKind.INT)
    override fun deserialize(decoder: Decoder): Int {
        val d = decoder as? JsonDecoder ?: return decoder.decodeInt()
        val e = d.decodeJsonElement()
        val p = e as? JsonPrimitive ?: return 0
        return p.doubleOrNull?.let { Math.round(it).toInt() } ?: 0
    }
    override fun serialize(encoder: Encoder, value: Int) = encoder.encodeInt(value)
}

@Serializable
data class Point(val x: Double, val y: Double)

/** Forme d'une zone : discriminant JSON `kind` = polygon | circle | line. */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
sealed interface Shape

@Serializable @SerialName("polygon")
data class PolygonShape(val points: List<Point>) : Shape

@Serializable @SerialName("circle")
data class CircleShape(val center: Point, val radius: Double) : Shape

@Serializable @SerialName("line")
data class LineShape(val points: List<Point>, val width: Double = 1.0) : Shape

@Serializable
data class Planting(
    val plantId: String,
    @Serializable(with = LenientIntSerializer::class) val count: Int? = null,
    @Serializable(with = LenientIntSerializer::class) val quantity: Int? = null,
    val height: Double? = null,
    val width: Double? = null,
    val plantedAt: String? = null,
)

@Serializable
data class Zone(
    val id: String,
    val type: String,
    val label: String = "",
    val shape: Shape? = null,
    val plantings: List<Planting> = emptyList(),
    val notes: String = "",
    val ambiance: String? = null,
    val auto: Boolean = false,
    val variant: String? = null,
    val depth: Double? = null,
    val height: Double? = null,
    val maintenance: String? = null,
    val autoInfo: JsonElement? = null,
)

@Serializable
data class Obstacle(
    val id: String = "",
    val kind: String,
    val points: List<Point>? = null,
    val center: Point? = null,
    val radius: Double? = null,
    val height: Double? = null,
    val label: String? = null,
    val material: String? = null,
    val thickness: Double? = null,
)

@Serializable
data class Item(
    val id: String,
    val kind: String,
    val x: Double = 0.0,
    val y: Double = 0.0,
    val rotation: Double = 0.0,
    val width: Double = 0.5,
    val depth: Double = 0.5,
    val radius: Double? = null,
    val height: Double? = null,
    val label: String? = null,
)

@Serializable
data class Existing(
    val id: String,
    val kind: String,
    val plantId: String? = null,
    /** Libellé saisi (null = absent : `ensureExisting` le remplace par le libellé du type). */
    val label: String? = null,
    val x: Double = 0.0,
    val y: Double = 0.0,
    val points: List<Point>? = null,
    val height: Double = 1.0,
    val width: Double = 1.0,
    val keep: Boolean = true,
    val notes: String = "",
    val material: String? = null,
)

@Serializable
data class BoundaryEdge(
    val kind: String = "open",
    val height: Double? = null,
    val material: String? = null,
)

@Serializable
data class OpeningRef(
    val type: String,
    val side: Int,
    val obstacleId: String? = null,
    val existingId: String? = null,
)

@Serializable
data class Opening(
    val id: String,
    val kind: String,
    val ref: OpeningRef,
    val t: Double = 0.5,
    val width: Double = 1.0,
    val swing: String = "in",
)

@Serializable
data class LatLon(val lat: Double, val lon: Double)

@Serializable
data class SunRegion(val level: String, val points: List<Point> = emptyList())

@Serializable
data class SunInfo(
    val mode: String = "unknown",
    val uniform: String? = null,
    val regions: List<SunRegion> = emptyList(),
)

@Serializable
data class GardenContext(
    val location: LatLon? = null,
    val commune: String? = null,
    val departement: String? = null,
    val region: String? = null,
    val altitude: Double? = null,
    val orientation: String? = null,
    val northAngle: Double = 0.0,
    val soil: String? = null,
    val slope: JsonElement? = null,
    val wind: JsonElement? = null,
    val roofArea: Double? = null,
    val bedMode: String = "manual",
    val maintenance: String? = null,
)

@Serializable
data class Plan(
    val svg: String? = null,
    val validatedAt: String? = null,
    val views: JsonElement? = null,
)

@Serializable
data class Garden(
    val id: String,
    val name: String = "Mon jardin",
    val createdAt: String = "",
    val updatedAt: String = "",
    val status: String = "draft",
    val context: GardenContext = GardenContext(),
    val boundary: List<Point> = emptyList(),
    val boundaryClosed: Boolean = false,
    val obstacles: List<Obstacle> = emptyList(),
    val items: List<Item> = emptyList(),
    val existing: List<Existing> = emptyList(),
    val boundaryEdges: List<BoundaryEdge> = emptyList(),
    val openings: List<Opening> = emptyList(),
    val sun: SunInfo = SunInfo(),
    val wishedZoneTypes: List<String> = emptyList(),
    val zones: List<Zone> = emptyList(),
    val plan: Plan = Plan(),
    val tasksDone: JsonObject = JsonObject(emptyMap()),
)

// ------------------------------------------------------------------ constantes

/** Type de zone. `layer` : 'ground' (au sol, exclusif) ou 'canopy' (au-dessus, superposable). */
data class ZoneType(
    val id: String, val label: String, val color: String, val icon: String, val layer: String,
    val shapeKinds: List<String>, val minSun: String? = null, val defaultWidth: Double? = null,
)

val ZONE_TYPES: List<ZoneType> = listOf(
    ZoneType("pond", "Mare / bassin", "#4aa3d8", "💧", "ground", listOf("polygon", "circle"), "partial"),
    ZoneType("pool", "Piscine", "#2ec4d6", "🏊", "ground", listOf("polygon", "circle"), "full"),
    ZoneType("terrace", "Terrasse", "#c9a77c", "🪑", "ground", listOf("polygon")),
    ZoneType("path", "Allée / cheminement", "#b8b0a2", "🚶", "ground", listOf("line", "polygon"), null, 1.0),
    ZoneType("lawn", "Pelouse", "#7cc95a", "🌱", "ground", listOf("polygon", "circle"), "partial"),
    ZoneType("lowplants", "Plantes basses / couvre-sol", "#9bd17a", "🍀", "ground", listOf("polygon", "circle")),
    ZoneType("midplants", "Massif de plantes moyennes", "#e58fb0", "🌸", "ground", listOf("polygon", "circle")),
    ZoneType("tallplants", "Plantes hautes", "#6aa86a", "🌾", "ground", listOf("polygon", "circle", "line"), null, 1.0),
    ZoneType("hedge", "Haie", "#3f8f4a", "🌿", "ground", listOf("line", "polygon"), null, 1.0),
    ZoneType("trees", "Arbres", "#2e7d32", "🌳", "canopy", listOf("circle", "polygon")),
    ZoneType("vegetable", "Potager", "#d9a441", "🥕", "ground", listOf("polygon"), "full"),
    ZoneType("orchard", "Verger", "#e0793c", "🍎", "canopy", listOf("polygon", "circle"), "full"),
    ZoneType("other", "Autre", "#9e9e9e", "📍", "ground", listOf("polygon", "circle", "line"), null, 1.0),
)

val SUN_LEVELS = listOf("full", "partial", "shade")
val SUN_LABELS = mapOf("full" to "Plein soleil (≥ 6 h)", "partial" to "Mi-ombre (3–6 h)", "shade" to "Ombre (< 3 h)")

val WATER_NEEDS = listOf("low", "medium", "high")
val WATER_LABELS = mapOf("low" to "Faible", "medium" to "Moyen", "high" to "Élevé")

val PLANT_CATEGORIES = listOf("tree", "shrub", "hedge", "fruit", "climber", "perennial", "groundcover", "grass", "bulb", "aquatic", "vegetable", "lawn")
val CATEGORY_LABELS = mapOf(
    "tree" to "Arbre", "shrub" to "Arbuste", "hedge" to "Haie", "fruit" to "Fruitier", "climber" to "Grimpante", "perennial" to "Vivace",
    "groundcover" to "Couvre-sol", "grass" to "Graminée", "bulb" to "Bulbe", "aquatic" to "Aquatique", "vegetable" to "Légume", "lawn" to "Gazon",
)

val SOILS = listOf("clay", "limestone", "sandy", "loam", "humus")
val SOIL_LABELS = mapOf("clay" to "Argileux", "limestone" to "Calcaire", "sandy" to "Sableux", "loam" to "Limoneux", "humus" to "Humifère")

data class Orientation(val id: String, val label: String, val azimuth: Int)

/** Orientations : `azimuth` en degrés depuis le nord, sens horaire. */
val ORIENTATIONS = listOf(
    Orientation("N", "Nord", 0), Orientation("NE", "Nord-Est", 45), Orientation("E", "Est", 90), Orientation("SE", "Sud-Est", 135),
    Orientation("S", "Sud", 180), Orientation("SW", "Sud-Ouest", 225), Orientation("W", "Ouest", 270), Orientation("NW", "Nord-Ouest", 315),
)

val BED_MODES = listOf("manual", "auto")

/** Identifiant unique court (préfixe optionnel) : 16 hexadécimaux d'un UUID. */
fun newId(prefix: String = ""): String = prefix + UUID.randomUUID().toString().replace("-", "").take(16)

/** Type de zone par id (null si inconnu). */
fun getZoneType(id: String?): ZoneType? = ZONE_TYPES.firstOrNull { it.id == id }

private fun nowIso(): String = Instant.now().truncatedTo(ChronoUnit.MILLIS).toString()

/** Nouveau jardin brouillon. */
fun createGarden(name: String = "Mon jardin"): Garden {
    val now = nowIso()
    return Garden(id = newId("g_"), name = name, createdAt = now, updatedAt = now)
}

/** Mode des massifs d'un jardin : 'manual' (défaut) ou 'auto'. */
fun bedModeOf(g: Garden?): String = if (g != null && g.context.bedMode == "auto") "auto" else "manual"

/** Nouvelle zone d'un type donné (lève une erreur si le type est inconnu). */
fun createZone(typeId: String, shape: Shape?): Zone {
    val t = getZoneType(typeId) ?: throw IllegalArgumentException("Type de zone inconnu : $typeId")
    return Zone(id = newId("z_"), type = typeId, label = t.label, shape = shape, variant = if (typeId == "pool") "inground" else null)
}

data class PoolVariant(val id: String, val label: String)
val POOL_VARIANTS = listOf(PoolVariant("inground", "Enterrée"), PoolVariant("above", "Hors sol"))
const val POOL_ABOVE_LABEL = "Piscine hors sol"

/** Variante effective d'une zone (« inground » par défaut, seulement pour une piscine ; null sinon). */
fun poolVariant(zone: Zone?): String? = if (zone == null || zone.type != "pool") null else if (zone.variant == "above") "above" else "inground"
fun isAbovePool(zone: Zone?): Boolean = poolVariant(zone) == "above"

/** Change la variante d'une piscine ; le libellé par défaut suit la variante (numéro conservé), un nom saisi n'est jamais écrasé. */
fun setPoolVariant(zone: Zone, variant: String): Zone {
    if (zone.type != "pool") return zone
    val v = if (variant == "above") "above" else "inground"
    val base = getZoneType("pool")!!.label
    val m = Regex("^(Piscine(?: hors sol)?)( \\d+)?$").find(zone.label)
    val label = if (m != null) (if (v == "above") POOL_ABOVE_LABEL else base) + (m.groupValues[2]) else zone.label
    return zone.copy(variant = v, label = label)
}

/** Nouvel élément d'aménagement. Cercle : `radius` = w/2 et width = depth = diamètre. */
fun createItem(kindId: String, x: Double = 0.0, y: Double = 0.0, rotation: Double = 0.0): Item {
    val k = getItemKind(kindId) ?: throw IllegalArgumentException("Élément inconnu : $kindId")
    return Item(id = newId("i_"), kind = kindId, x = x, y = y, rotation = rotation, width = k.w, depth = k.d,
        radius = if (k.shape == "circle") k.w / 2 else null)
}

/** Nouvelle ouverture sur un côté `ref` à la position `t` (0..1). */
fun createOpening(kindId: String, ref: OpeningRef, t: Double = 0.5): Opening {
    val k = getOpeningKind(kindId) ?: throw IllegalArgumentException("Ouverture inconnue : $kindId")
    return Opening(id = newId("op_"), kind = kindId, ref = ref, t = t, width = k.width, swing = k.swing)
}

/** Complète un jardin ancien (les listes absentes sont déjà vides à la désérialisation) et migre les existants. */
fun ensureAmenagements(g: Garden): Garden = ensureExisting(g)

private const val SEUIL_CHEVAUCHEMENT = 0.1 // m²

/** Résultat de `validateGarden` : erreurs bloquantes et avertissements. */
data class Validation(val ok: Boolean, val errors: List<String>, val warnings: List<String>)

/**
 * Valide un jardin. Erreurs bloquantes : contour absent, non fermé, auto-intersecté, surface ≤ 1 m², zone dégénérée ou
 * de type inconnu. Avertissements : zone hors contour, chevauchement de zones « au sol », zone souhaitée sans forme dessinée.
 */
fun validateGarden(g: Garden, lookup: PlantLookup = defaultPlantLookup): Validation {
    val errors = ArrayList<String>()
    val warnings = ArrayList<String>()
    val contour = g.boundary
    var contourValide = false

    if (contour.size < 3) {
        errors.add("Le contour du terrain doit comporter au moins 3 sommets.")
    } else if (!g.boundaryClosed) {
        errors.add("Le contour du terrain n'est pas fermé.")
    } else if (!isSimplePolygon(contour)) {
        errors.add("Le contour du terrain se croise lui-même.")
    } else if (polygonArea(contour) <= 1) {
        errors.add("La surface du terrain doit dépasser 1 m².")
    } else {
        contourValide = true
    }

    class ZP(val z: Zone, val nom: String, val type: ZoneType, val poly: List<Point>)
    val polys = ArrayList<ZP>()
    g.zones.forEachIndexed { i, z ->
        val nom = z.label.ifEmpty { "Zone ${i + 1}" }
        val type = getZoneType(z.type)
        if (type == null) { errors.add("Zone « $nom » : type inconnu."); return@forEachIndexed }
        val poly = shapePolygon(z.shape)
        if (poly.size < 3 || shapeArea(z.shape) <= 1e-6) { errors.add("Zone « $nom » : forme invalide ou vide."); return@forEachIndexed }
        polys.add(ZP(z, nom, type, poly))
        if (contourValide && !polygonInside(poly, contour)) warnings.add("Zone « $nom » : sort du contour du terrain.")
    }

    val sol = polys.filter { it.type.layer == "ground" }
    for (i in sol.indices) {
        for (j in i + 1 until sol.size) {
            if (overlapArea(sol[i].poly, sol[j].poly) > SEUIL_CHEVAUCHEMENT) {
                warnings.add("Zones « ${sol[i].nom} » et « ${sol[j].nom} » : elles se chevauchent.")
            }
        }
    }

    g.items.forEachIndexed { i, it ->
        val k = getItemKind(it.kind)
        val nom = it.label?.takeIf { l -> l.isNotEmpty() } ?: k?.label ?: "Élément ${i + 1}"
        if (k == null) { warnings.add("Élément « $nom » : type inconnu."); return@forEachIndexed }
        if (contourValide && !polygonInside(itemPolygon(it), contour)) warnings.add("Élément « $nom » : sort du contour du terrain.")
    }
    g.openings.forEachIndexed { i, op ->
        val k = getOpeningKind(op.kind)
        val nom = k?.label ?: "Ouverture ${i + 1}"
        if (resolveSide(g, op.ref) == null) warnings.add("Ouverture « $nom » : le côté qui la porte n'existe plus.")
    }

    g.existing.forEachIndexed { i, e ->
        if (!contourValide) return@forEachIndexed
        val pts = if (!e.points.isNullOrEmpty()) e.points else listOf(Point(e.x, e.y))
        if (pts.any { !pointInPolygon(it, contour) }) {
            warnings.add("${if (e.kind == "fence") "Clôture existante" else "Plante existante"} « ${existingLabel(e, lookup).ifEmpty { "Élément ${i + 1}" }} » : sort du contour du terrain.")
        }
    }

    val auto = bedModeOf(g) == "auto"
    for (id in g.wishedZoneTypes) {
        if (auto && (id == "lowplants" || id == "midplants" || id == "tallplants")) continue
        if (g.zones.none { it.type == id }) {
            val t = getZoneType(id)
            warnings.add("Zone souhaitée « ${t?.label ?: id} » : aucune forme dessinée.")
        }
    }
    return Validation(errors.isEmpty(), errors, warnings)
}
