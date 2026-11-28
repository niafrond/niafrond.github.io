package fr.jardin.core.app

import fr.jardin.core.Garden
import fr.jardin.core.bedModeOf
import fr.jardin.core.validateGarden

/** Une étape de l'assistant (ids, libellés et icônes identiques à `STEPS` de `jardin/ui/wizard.js`). */
data class WizardStep(val id: String, val label: String, val icon: String)

object WizardSteps {
    val all: List<WizardStep> = listOf(
        WizardStep("context", "Contexte", "📍"),
        WizardStep("boundary", "Terrain", "📐"),
        WizardStep("wished", "Zones souhaitées", "✅"),
        WizardStep("sun", "Soleil", "☀️"),
        WizardStep("items", "Aménagements", "🪑"),
        WizardStep("zones", "Dessin des zones", "🗺️"),
        WizardStep("beds", "Massifs", "🌸"),
        WizardStep("plants", "Essences", "🌿"),
        WizardStep("render", "Rendu", "🖼️"),
    )
    val ids: List<String> = all.map { it.id }

    /** Index de l'étape ; une étape inconnue ou nulle retombe sur « context » (comme `parseRoute`). */
    fun indexOf(id: String?): Int = ids.indexOf(id).coerceAtLeast(0)
    fun byId(id: String?): WizardStep = all[indexOf(id)]
    fun previous(id: String?): WizardStep? = all.getOrNull(indexOf(id) - 1)
    fun next(id: String?): WizardStep? = all.getOrNull(indexOf(id) + 1)

    /** « 3/9 · Zones souhaitées » */
    fun title(id: String?): String = "${indexOf(id) + 1}/${all.size} · ${byId(id).label}"
}

/** Remarque non bloquante sur une étape. */
data class StepNote(val stepId: String, val message: String)

/**
 * Règles d'accès. Comme sur le web, la navigation entre étapes est libre (rien ne bloque « Suivant ») ;
 * les remarques servent de pastilles d'avertissement, et seule la validation finale exige un jardin sans erreur.
 */
object WizardGuards {
    fun canGoTo(@Suppress("UNUSED_PARAMETER") garden: Garden, @Suppress("UNUSED_PARAMETER") stepId: String): Boolean = true

    /** Étapes complètes d'après le contenu du jardin (pour colorer la barre de progression). */
    fun isComplete(g: Garden, stepId: String): Boolean = when (stepId) {
        "context" -> g.name.isNotBlank() && (g.context.region != null || g.context.departement != null || g.context.commune != null || g.context.location != null)
        "boundary" -> g.boundary.size >= 3 && g.boundaryClosed
        "wished" -> g.wishedZoneTypes.isNotEmpty()
        "sun" -> g.sun.mode != "unknown"
        "items" -> g.items.isNotEmpty() || g.openings.isNotEmpty() || g.existing.isNotEmpty() || g.obstacles.isNotEmpty()
        "zones" -> g.zones.isNotEmpty()
        "beds" -> bedModeOf(g) == "auto" || g.zones.any { it.plantings.isNotEmpty() || it.type in BED_TYPES }
        "plants" -> g.zones.any { it.plantings.isNotEmpty() }
        "render" -> g.status == "validated"
        else -> false
    }

    /** Remarques d'une étape (liste vide = rien à signaler). */
    fun notes(g: Garden, stepId: String): List<StepNote> {
        val out = ArrayList<StepNote>()
        fun n(m: String) = out.add(StepNote(stepId, m))
        when (stepId) {
            "context" -> if (g.context.region == null && g.context.departement == null && g.context.location == null)
                n("Localisation non renseignée : les essences ne seront pas filtrées selon le climat.")
            "boundary" -> if (!isComplete(g, "boundary")) n("Le contour du terrain n'est pas encore tracé et fermé.")
            "wished" -> if (g.wishedZoneTypes.isEmpty()) n("Aucune zone souhaitée choisie.")
            "zones" -> if (g.zones.isEmpty()) n("Aucune zone dessinée.")
            "render" -> validateGarden(g).errors.forEach { n(it) }
        }
        return out
    }

    /** La validation finale (étape « Rendu ») n'est possible que sans erreur bloquante. */
    fun canValidate(g: Garden): Boolean = validateGarden(g).ok

    private val BED_TYPES = setOf("lowplants", "midplants", "tallplants")
}
