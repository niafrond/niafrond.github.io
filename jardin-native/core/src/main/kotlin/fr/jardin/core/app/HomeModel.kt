package fr.jardin.core.app

import fr.jardin.core.Garden
import fr.jardin.core.polygonArea
import java.util.Locale

/** Données d'affichage de l'accueil (équivalent de `jardin/ui/home.js`). */
object HomeModel {
    const val EMPTY_TITLE = "Aucun jardin pour l’instant."
    const val EMPTY_HELP = "Créez votre premier jardin : décrivez votre terrain, placez des zones et choisissez des essences adaptées."

    fun title(g: Garden): String = g.name.ifBlank { "Jardin sans nom" }
    fun badge(g: Garden): String = if (g.status == "validated") "Validé" else "Brouillon"

    /** Surface du terrain (« 12,5 m² » sous 10 m², entière sinon ; « Contour à tracer »), suivie de la région. */
    fun subtitle(g: Garden): String {
        val area = if (g.boundary.size >= 3) polygonArea(g.boundary) else 0.0
        val s = if (area > 0) String.format(Locale.FRANCE, if (area < 10) "%.1f m²" else "%.0f m²", area) else "Contour à tracer"
        return s + (g.context.region?.let { " · $it" } ?: "")
    }

    fun confirmDelete(g: Garden): String = "Supprimer « ${title(g)} » ? Cette action est définitive."
}
