package fr.jardin.core.app

import fr.jardin.core.Garden
import fr.jardin.core.Massifs
import fr.jardin.core.ZONE_TYPES
import fr.jardin.core.ZoneType
import fr.jardin.core.bedModeOf

/** Mode de création des massifs (carte de l'étape « Zones souhaitées »). */
data class BedModeCard(val id: String, val icon: String, val title: String, val desc: String)

/** Étape 3 « Zones souhaitées » (port de jardin/ui/step-wished.js, logique pure). */
object WishedStep {
    val MODES = listOf(
        BedModeCard("manual", "🖌", "Je dessine mes massifs moi-même", "Vous placez chaque massif et choisissez ses plantes."),
        BedModeCard("auto", "✨", "L’app calcule les massifs", "Zones fleuries dans les vides, avec les meilleures plantes."),
    )
    const val AUTO_NOTE = "🌸 Les zones de fleurs et de plantes (plantes basses, massifs, plantes hautes) ne sont pas à choisir ici : l’app les calcule à l’étape Massifs, dans les vides du jardin."

    /** Types proposés : en mode auto les types « massif » ne sont plus à choisir (choix conservé si on revient en manuel). */
    fun visibleTypes(g: Garden): List<ZoneType> =
        if (bedModeOf(g) == "auto") ZONE_TYPES.filter { it.id !in Massifs.FLOWER_ZONE_TYPES } else ZONE_TYPES

    fun shownCount(g: Garden): Int { val v = visibleTypes(g).map { it.id }.toSet(); return g.wishedZoneTypes.count { it in v } }

    fun countText(g: Garden): String {
        val n = shownCount(g)
        return if (n > 0) "$n type${if (n > 1) "s" else ""} de zone souhaité${if (n > 1) "s" else ""}." else "Aucune zone cochée pour l’instant."
    }

    /** Coche / décoche un type ; la liste suit l'ordre de `ZONE_TYPES`. */
    fun toggle(g: Garden, typeId: String, checked: Boolean): Garden {
        val s = g.wishedZoneTypes.toMutableSet()
        if (checked) s.add(typeId) else s.remove(typeId)
        return g.copy(wishedZoneTypes = ZONE_TYPES.map { it.id }.filter { it in s })
    }

    fun setMode(g: Garden, mode: String): Garden =
        if (bedModeOf(g) == mode) g else g.copy(context = g.context.copy(bedMode = if (mode == "auto") "auto" else "manual"))
}
