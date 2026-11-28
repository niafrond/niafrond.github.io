package fr.jardin.core.app

import fr.jardin.core.Climate
import fr.jardin.core.Departement
import fr.jardin.core.Garden
import fr.jardin.core.ORIENTATIONS

/** Logique pure de l'étape « Contexte » (nom, région / département, exposition). */
object ContextForm {
    const val NAME_MAX = 60

    fun regions(): List<String> = Climate.regions()
    fun departementsOf(region: String?): List<Departement> =
        Climate.departements.filter { region == null || it.region == region }.sortedBy { it.code }

    fun withName(g: Garden, name: String): Garden = g.copy(name = name.take(NAME_MAX))

    /** Choisir une région efface un département qui n'en fait pas partie. */
    fun withRegion(g: Garden, region: String?): Garden {
        val dep = g.context.departement?.let { Climate.climateForDepartement(it) }
        val keep = dep != null && (region == null || dep.region == region)
        return g.copy(context = g.context.copy(region = region, departement = if (keep) g.context.departement else null))
    }

    /** Choisir un département fixe aussi sa région. */
    fun withDepartement(g: Garden, code: String?): Garden {
        val dep = code?.let { Climate.climateForDepartement(it) }
        return g.copy(context = g.context.copy(departement = dep?.code, region = dep?.region ?: g.context.region))
    }

    /** Exposition en degrés (0..359) ; met à jour l'angle du nord comme le web. */
    fun withOrientation(g: Garden, azimuth: Int?): Garden {
        val o = azimuth?.let { Math.floorMod(it, 360) }
        return g.copy(context = g.context.copy(orientation = o?.toString(), northAngle = if (o == null) 0.0 else ((360 - o) % 360).toDouble()))
    }


    /** Azimut courant de l'exposition (le champ est stocké en texte dans le modèle). */
    fun azimuthOf(g: Garden): Int? = g.context.orientation?.let { s -> s.toDoubleOrNull()?.toInt() ?: ORIENTATIONS.firstOrNull { it.id == s }?.azimuth }

    /** « Nord-Est (45°) » ou « inconnue » (comme `orientationLabel` du web). */
    fun orientationLabel(az: Int?): String {
        if (az == null) return "inconnue"
        val i = Math.round((((az % 360) + 360) % 360) / 45.0).toInt() % 8
        return "${ORIENTATIONS[i].label} (${az}°)"
    }

    /** Ligne de rusticité, ou null si le département est inconnu. */
    fun hardinessText(g: Garden): String? {
        val cl = Climate.climateForDepartement(g.context.departement) ?: return null
        val t = Climate.adjustTminForAltitude(cl.tminC, g.context.altitude)
        return "Zone de rusticité ${Climate.hardinessZone(t)} · températures minimales ≈ ${Math.round(t)} °C · pluviométrie ≈ ${fmt(cl.rainMm)} mm/an"
    }

    private fun fmt(d: Double) = if (d == Math.floor(d)) d.toLong().toString() else d.toString()
}
