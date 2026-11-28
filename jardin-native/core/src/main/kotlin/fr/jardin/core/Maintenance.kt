package fr.jardin.core

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

data class MaintenanceLevel(val id: String, val label: String, val emoji: String, val desc: String)

data class MaintenanceFit(
    val ok: Boolean,
    val penalty: Int,
    val bonus: Int,
    val discouraged: Boolean,
    val text: String,
)

/** Niveau d'entretien souhaité (jardin ou zone) et effort demandé par une essence. */
object Maintenance {
    val MAINTENANCE_LEVELS = listOf(
        MaintenanceLevel("green", "Main verte", "🧤", "J’aime jardiner : tout est permis"),
        MaintenanceLevel("low", "Peu d’entretien", "🌿", "Quelques gestes par an"),
        MaintenanceLevel("none", "Pas d’entretien", "🛋", "On plante et on oublie"),
    )

    fun getMaintenanceLevel(id: String?): MaintenanceLevel? = MAINTENANCE_LEVELS.firstOrNull { it.id == id }

    private fun base(m: String): Int = when (m) { "low" -> 1; "medium" -> 2; "high" -> 3; else -> 2 }
    private const val PRUNE_LONG = 2

    /** Effort d'entretien d'une essence : 1 (léger), 2 (moyen), 3 (soutenu). */
    fun plantEffort(plant: Plant?): Int {
        if (plant == null) return 2
        var e = base(plant.maintenance)
        val cat = plant.category
        val demanding = cat == "vegetable" || cat == "lawn" || cat == "hedge" || cat == "fruit"
        if (demanding) e += 1
        if (plant.water == "high") e += 1
        if (plant.care.pruneMonths.size > PRUNE_LONG) e += 1
        if (cat == "grass" || cat == "groundcover") e -= 1
        if (cat == "shrub" && plant.foliage == "evergreen" && plant.hardiness <= -10) e -= 1
        if (!demanding && plant.windTolerant && plant.water == "low") e -= 1
        return max(1, min(3, e))
    }

    private fun clampEffort(effort: Double?): Int {
        val n = if (effort == null || effort.isNaN() || effort == 0.0) 2.0 else effort
        return max(1, min(3, floor(n + 0.5).toInt()))
    }

    fun effortLabel(effort: Double?): String = when (clampEffort(effort)) { 1 -> "léger"; 2 -> "moyen"; else -> "soutenu" }
    fun effortLabel(effort: Int): String = effortLabel(effort.toDouble())
    fun effortBadge(effort: Double?): String = "🧤×${clampEffort(effort)}"
    fun effortBadge(effort: Int): String = effortBadge(effort.toDouble())

    /** Niveau effectif d'une zone : le sien, sinon celui du jardin, sinon « green ». */
    fun levelForZone(gardenLevel: String?, zoneLevel: String?): String {
        if (getMaintenanceLevel(zoneLevel) != null) return zoneLevel!!
        if (getMaintenanceLevel(gardenLevel) != null) return gardenLevel!!
        return "green"
    }

    /** Niveau effectif d'une zone du jardin (zone > jardin > « green »). */
    fun levelForZone(garden: Garden?, zone: Zone?): String = levelForZone(garden?.context?.maintenance, zone?.maintenance)

    /** Une essence convient-elle au niveau d'entretien ? */
    fun fitsMaintenance(plant: Plant?, levelId: String?): MaintenanceFit {
        val e = plantEffort(plant)
        val none = MaintenanceFit(true, 0, 0, false, "")
        if (levelId == "low") {
            if (e >= 3) return MaintenanceFit(false, 25, 0, false, "Demande pas mal d’entretien : déconseillée si vous voulez peu d’entretien")
            return none.copy(
                bonus = if (e == 1) 5 else 0,
                text = if (e == 1) "Très peu d’entretien, parfait pour un jardin facile" else "Entretien raisonnable (quelques gestes par an)",
            )
        }
        if (levelId == "none") {
            if (e >= 3) return MaintenanceFit(false, 60, 0, true, "Demande beaucoup d’entretien : à éviter dans un jardin sans entretien")
            if (e == 2) return MaintenanceFit(false, 30, 0, false, "Demande un entretien régulier : peu adaptée si on ne veut aucun entretien")
            return none.copy(bonus = 10, text = "Très peu d’entretien : on plante et on oublie")
        }
        return none
    }
}
