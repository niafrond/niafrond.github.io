package fr.jardin.core.app

import fr.jardin.core.Garden

/** État de l'assistant : jardin en cours + étape courante. Immuable ; chaque action renvoie un nouvel état. */
data class WizardState(val garden: Garden, val stepId: String = "context") {
    val index: Int get() = WizardSteps.indexOf(stepId)
    val step: WizardStep get() = WizardSteps.all[index]
    val title: String get() = WizardSteps.title(stepId)
    val previous: WizardStep? get() = WizardSteps.previous(stepId)
    val next: WizardStep? get() = WizardSteps.next(stepId)
    val progress: Float get() = (index + 1).toFloat() / WizardSteps.all.size
    val notes: List<StepNote> get() = WizardGuards.notes(garden, stepId)

    fun goTo(id: String): WizardState =
        if (id in WizardSteps.ids && WizardGuards.canGoTo(garden, id)) copy(stepId = id) else this
    fun goPrevious(): WizardState = previous?.let { goTo(it.id) } ?: this
    fun goNext(): WizardState = next?.let { goTo(it.id) } ?: this
    fun withGarden(g: Garden): WizardState = copy(garden = g)
    fun isComplete(id: String): Boolean = WizardGuards.isComplete(garden, id)
}
