package fr.jardin.core.app

import fr.jardin.core.Garden
import fr.jardin.core.SunInfo
import fr.jardin.core.SunRegion
import fr.jardin.core.estimateSunMap

/** Étape 4 « Soleil » (port de jardin/ui/step-sun.js, logique pure). */
object SunStep {
    val LEVELS = listOf(
        "full" to "☀️ Plein soleil (6 h ou plus)",
        "partial" to "⛅ Mi-ombre (3 à 6 h)",
        "shade" to "☁️ Ombre (moins de 3 h)",
    )
    data class Mode(val id: String, val label: String, val hint: String)
    val MODES = listOf(
        Mode("unknown", "Je ne sais pas", "Aucune essence n’est exclue sur ce critère, mais un avertissement s’affichera."),
        Mode("uniform", "Un seul niveau pour tout le jardin", "Mode rapide."),
        Mode("map", "Je dessine les zones sur le plan", "Zones d’ombre, de mi-ombre et de soleil, avec légende."),
        Mode("estimated", "Estimer automatiquement", "Calcul approximatif selon la position, l’exposition et les obstacles saisis. À corriger à la main."),
    )
    const val TITLE = "Ensoleillement (facultatif)"
    const val HINT = "Il sert à filtrer et à noter les essences. Vous pouvez passer cette étape."
    const val ESTIMATE_NOTE = "Estimation approximative : corrigez-la si vous connaissez mieux votre jardin (ombre des voisins, arbres…)."
    const val NO_CONTOUR = "Tracez d’abord le contour du terrain (étape 2)."
    const val NO_LOCATION = "Renseignez d’abord la localisation (étape 1) pour estimer le soleil."

    /** Vue affichée : « map » et « uniform » suivent le jardin, sinon « unknown » (« estimated » n'est pas mémorisé). */
    fun viewOf(g: Garden): String = when (g.sun.mode) { "map" -> "map"; "uniform" -> "uniform"; else -> "unknown" }

    fun setUnknown(g: Garden): Garden = g.copy(sun = SunInfo("unknown", null, emptyList()))
    fun setUniform(g: Garden, level: String?): Garden = g.copy(sun = SunInfo("uniform", level, emptyList()))
    fun setMap(g: Garden): Garden = g.copy(sun = SunInfo("map", null, g.sun.regions))

    /** Un seul grand secteur couvrant tout le terrain (point de départ de la correction à la main). */
    fun fillAll(g: Garden, level: String): Garden =
        g.copy(sun = SunInfo("map", null, if (g.boundary.size >= 3) listOf(SunRegion(level, g.boundary)) else emptyList()))

    /** Remplace un niveau de plage par un autre (légende / correction manuelle d'une région). */
    fun relevel(g: Garden, index: Int, level: String): Garden {
        val r = g.sun.regions.toMutableList()
        if (index !in r.indices) return g
        r[index] = r[index].copy(level = level)
        return g.copy(sun = g.sun.copy(mode = "map", regions = r))
    }

    data class Estimate(val garden: Garden?, val error: String?)

    /** Estimation par Sun.kt : exige un contour et une localisation (messages du web). */
    fun estimate(g: Garden, dateMillis: Long? = null): Estimate {
        if (g.boundary.size < 3) return Estimate(null, NO_CONTOUR)
        if (g.context.location == null) return Estimate(null, NO_LOCATION)
        return try {
            val regions = estimateSunMap(g, dateMillis).map { SunRegion(it.level, it.points) }
            Estimate(g.copy(sun = SunInfo("map", null, regions)), null)
        } catch (e: Exception) { Estimate(null, "Estimation impossible : ${e.message ?: "erreur"}") }
    }

    /** Surface par niveau (m², rectangles de la grille) pour la légende. */
    fun areaByLevel(g: Garden): Map<String, Double> {
        val out = linkedMapOf("full" to 0.0, "partial" to 0.0, "shade" to 0.0)
        for (r in g.sun.regions) {
            val p = r.points
            if (p.size < 3) continue
            var a = 0.0
            for (i in p.indices) { val q = p[(i + 1) % p.size]; a += p[i].x * q.y - q.x * p[i].y }
            out[r.level] = (out[r.level] ?: 0.0) + kotlin.math.abs(a) / 2
        }
        return out
    }
}
