package fr.jardin.core

import kotlinx.serialization.json.*
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.math.max
import kotlin.math.sqrt

// Géolocalisation : parties pures de jardin/geo.js (moyenne de relevés GPS, messages d'erreur, déclinaison magnétique,
// lissage de la boussole, URL et analyse des réponses de geo.api.gouv.fr / Géoplateforme / Open-Meteo). Pas de réseau ni de capteur.

data class GpsSample(val lat: Double, val lon: Double, val accuracy: Double?)
data class GpsFix(val lat: Double, val lon: Double, val accuracy: Double)
data class CommuneInfo(val commune: String?, val departement: String?, val region: String?, val codeInsee: String?)
data class AddressHit(val label: String, val lat: Double, val lon: Double)

object Geo {
    /** Moyenne pondérée (1/précision²) de plusieurs relevés. */
    fun averageSamples(samples: List<GpsSample>): GpsFix {
        var sw = 0.0; var slat = 0.0; var slon = 0.0
        for (s in samples) {
            val acc = max(1.0, s.accuracy?.takeIf { it != 0.0 && !it.isNaN() } ?: 50.0)
            val w = 1 / (acc * acc)
            sw += w; slat += w * s.lat; slon += w * s.lon
        }
        return GpsFix(slat / sw, slon / sw, sqrt(1 / sw))
    }

    /** Message français pour un code d'erreur (`denied` | `unavailable` | `timeout` | `unsupported`, ou 1/2/3 du navigateur). */
    fun geoErrorMessage(code: String?): String = when (code) {
        "1", "denied" -> "Localisation refusée : autorisez la position pour cette application dans les réglages du téléphone."
        "unsupported" -> "Géolocalisation indisponible sur cet appareil."
        "3", "timeout" -> "Le GPS met trop de temps à répondre : sortez à découvert et réessayez."
        else -> "Signal GPS indisponible : sortez à découvert et vérifiez que la localisation est activée."
    }

    /** Déclinaison magnétique approchée pour la France (°, positive = est), dérive ~+0,15°/an. */
    fun magneticDeclination(lat: Double, lon: Double, date: LocalDate = LocalDate.now(ZoneOffset.UTC)): Double {
        val year = date.year + (date.monthValue - 1) / 12.0
        val base = 1.3 + 0.35 * (lon - 2.3) + 0.05 * (lat - 46.5)
        return jsRound((base + 0.15 * (year - 2025)) * 10) / 10
    }

    /** Cap magnétique → cap vrai lissé circulairement (boussole). `cur` = cap précédent (null au premier relevé). */
    fun smoothHeading(cur: Double?, magnetic: Double, declination: Double, smoothing: Double = 0.3): Double {
        val h = (magnetic + declination + 360) % 360
        if (cur == null) return h
        val diff = ((h - cur + 540) % 360) - 180
        return (cur + diff * smoothing + 360) % 360
    }

    /** Boussole à état : `update(magnetic)` renvoie le cap vrai affiché (arrondi au dixième). */
    class HeadingFilter(private val declination: Double = 0.0, private val smoothing: Double = 0.3) {
        private var cur: Double? = null
        fun update(magnetic: Double): Double {
            val v = smoothHeading(cur, magnetic, declination, smoothing)
            cur = v
            return jsRound(v * 10) / 10
        }
    }

    /** `encodeURIComponent` du JS. */
    fun encodeURIComponent(s: String): String {
        val keep = "-_.!~*'()"
        val sb = StringBuilder()
        for (b in s.toByteArray(Charsets.UTF_8)) {
            val c = (b.toInt() and 0xff).toChar()
            if (c in 'A'..'Z' || c in 'a'..'z' || c in '0'..'9' || c in keep) sb.append(c) else sb.append('%').append("%02X".format(b.toInt() and 0xff))
        }
        return sb.toString()
    }

    fun reverseCommuneUrl(lat: Double, lon: Double): String =
        "https://geo.api.gouv.fr/communes?lat=${jsNum(lat)}&lon=${jsNum(lon)}&fields=nom,code,codeDepartement,codeRegion,region&format=json"

    fun searchAddressUrl(q: String): String? {
        val query = q.trim()
        return if (query.length < 2) null else "https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=5"
    }

    fun elevationUrlIgn(lat: Double, lon: Double): String =
        "https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${jsNum(lon)}&lat=${jsNum(lat)}&resource=ign_rge_alti_wld&zonly=true"

    fun elevationUrlOpenMeteo(lat: Double, lon: Double): String =
        "https://api.open-meteo.com/v1/elevation?latitude=${jsNum(lat)}&longitude=${jsNum(lon)}"

    private fun str(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content

    /** Réponse de geo.api.gouv.fr → commune, département (code), région ; null hors de France. */
    fun parseCommune(json: JsonElement?): CommuneInfo? {
        val c = (json as? JsonArray)?.firstOrNull() as? JsonObject ?: return null
        return CommuneInfo(str(c["nom"]), str(c["codeDepartement"]), str((c["region"] as? JsonObject)?.get("nom")), str(c["code"]))
    }

    /** Réponse de recherche d'adresse (Géoplateforme). */
    fun parseAddresses(json: JsonElement?): List<AddressHit> {
        val feats = ((json as? JsonObject)?.get("features") as? JsonArray) ?: return emptyList()
        return feats.mapNotNull { f ->
            val o = f as? JsonObject ?: return@mapNotNull null
            val coords = (o["geometry"] as? JsonObject)?.get("coordinates") as? JsonArray ?: return@mapNotNull null
            val lon = (coords.getOrNull(0) as? JsonPrimitive)?.doubleOrNull
            val lat = (coords.getOrNull(1) as? JsonPrimitive)?.doubleOrNull
            if (lat == null || lon == null) null else AddressHit(str((o["properties"] as? JsonObject)?.get("label")) ?: "", lat, lon)
        }
    }

    private fun finiteNumber(e: JsonElement?): Double? {
        val p = e as? JsonPrimitive ?: return null
        if (p is JsonNull || p.isString) return null
        return p.doubleOrNull?.takeIf { it.isFinite() }
    }

    /** Altitude depuis la réponse IGN (`elevations: [z]` ou `[{z}]`) ; null si invalide. */
    fun parseElevationIgn(json: JsonElement?): Double? {
        val first = ((json as? JsonObject)?.get("elevations") as? JsonArray)?.firstOrNull()
        val v = finiteNumber(if (first is JsonObject) first["z"] else first)
        return v?.takeIf { it > -1000 }
    }

    /** Altitude : IGN d'abord, repli Open-Meteo ; null si aucune source valide (une réponse en échec se passe comme `null`). */
    fun pickElevation(ign: JsonElement?, openMeteo: JsonElement?): Double? = parseElevationIgn(ign) ?: parseElevationOpenMeteo(openMeteo)

    /** Altitude depuis la réponse Open-Meteo (`elevation: [z]` ou `z`) ; null si invalide. */
    fun parseElevationOpenMeteo(json: JsonElement?): Double? {
        val e = (json as? JsonObject)?.get("elevation")
        return finiteNumber(if (e is JsonArray) e.firstOrNull() else e)
    }
}
