package fr.jardin.core.plan

/** Indicateur du Nord (port de `normAngle`, `northLabel` de ui/draw-util.js et `setNorthAngle` de ui/north-pop.js). */
object NorthIndicator {
    const val UNKNOWN_TIP = "Orientation non renseignée : nord supposé en haut. Touchez pour la régler"
    private val DIRS = listOf("en haut", "en haut à droite", "à droite", "en bas à droite", "en bas", "en bas à gauche", "à gauche", "en haut à gauche")

    /** Angle entier dans [0, 360) ; null si illisible. */
    fun normAngle(deg: Double?): Int? {
        if (deg == null || !deg.isFinite()) return null
        val r = Math.floor(deg + 0.5).toLong()
        return (((r % 360) + 360) % 360).toInt()
    }

    /** « Le nord est à droite du plan » (pas de 45°). */
    fun label(angle: Double?): String {
        val a = normAngle(angle) ?: 0
        return "Le nord est ${DIRS[Math.round(a / 45.0).toInt() % 8]} du plan"
    }

    /** `orientation` (azimut du fond du jardin) déduite de l'angle du nord : (360 − a) % 360. */
    fun orientationFor(angle: Int): Int = (360 - angle) % 360

    /** Orientation renseignée ? (pastille en pointillés + « ? » sinon). */
    fun known(orientation: String?, northAngle: Double, hasGpsOrigin: Boolean = false): Boolean =
        orientation != null || northAngle != 0.0 || hasGpsOrigin
}
