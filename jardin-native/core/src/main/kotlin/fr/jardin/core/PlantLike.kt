package fr.jardin.core

/**
 * Vue minimale d'une essence pour les modules géométriques (espacement, ports, hauteurs, mares, existants).
 * `Plant` (Catalog.kt) l'implémente. Les valeurs numériques sont nullables : absent = inconnu.
 */
interface PlantLike {
    val id: String
    val commonName: String?
    val latinName: String? get() = null
    val category: String?
    val heightAdult: Double?
    val widthAdult: Double?
    val spacing: Double? get() = null
    /** Port forcé (id de `HABITS`), sinon déduit. */
    val habit: String? get() = null
    val foliage: String? get() = null
    val invasive: Boolean get() = false
}

/** Résolution d'une essence par id (équivalent du `lookup` du JS). */
typealias PlantLookup = (String) -> PlantLike?

/** Essence « effective » : hauteur/largeur adultes réglées à la place de celles du catalogue (`effectivePlant`). */
class OverriddenPlant(
    val base: PlantLike,
    override val heightAdult: Double?,
    override val widthAdult: Double?,
) : PlantLike {
    override val id: String get() = base.id
    override val commonName: String? get() = base.commonName
    override val latinName: String? get() = base.latinName
    override val category: String? get() = base.category
    override val spacing: Double? get() = base.spacing
    override val habit: String? get() = base.habit
    override val foliage: String? get() = base.foliage
    override val invasive: Boolean get() = base.invasive
}

/** Implémentation simple (tests, essences ad hoc). */
data class SimplePlant(
    override val id: String,
    override val commonName: String? = null,
    override val latinName: String? = null,
    override val category: String? = null,
    override val heightAdult: Double? = null,
    override val widthAdult: Double? = null,
    override val spacing: Double? = null,
    override val habit: String? = null,
    override val foliage: String? = null,
    override val invasive: Boolean = false,
) : PlantLike

/** Résolution d'essence par défaut (équivalent de `getPlant` du catalogue JS) : à brancher sur le catalogue. */
@Volatile
var defaultPlantLookup: PlantLookup = { id -> Catalog.getPlant(id) }
