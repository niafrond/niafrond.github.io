package fr.jardin.core

import kotlinx.serialization.json.*
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant

// Météo : parties pures de jardin/weather.js (Open-Meteo : gratuit, sans clé). Pas de réseau ici : l'application
// télécharge l'URL de `weatherUrl` et passe la réponse JSON à `parseOpenMeteo`.

/** Un jour de prévision. Valeurs absentes ou non numériques = null. */
data class WeatherDay(val date: String, val precipMm: Double?, val et0Mm: Double?, val tminC: Double?, val tmaxC: Double?)

/** Prévisions (jours passés + à venir). */
data class Forecast(val daily: List<WeatherDay>, val fetchedAt: String? = null, val stale: Boolean = false)

object Weather {
    const val BASE = "https://api.open-meteo.com/v1/forecast"
    const val DAILY = "precipitation_sum,et0_fao_evapotranspiration,temperature_2m_min,temperature_2m_max"
    const val PAST_DAYS = 3
    const val CACHE_PREFIX = "jardin:weather:"
    const val DEFAULT_TTL_MS = 30L * 60 * 1000

    private fun num(e: JsonElement?): Double? {
        val p = e as? JsonPrimitive ?: return null
        if (p is JsonNull || p.isString) return null
        return p.doubleOrNull?.takeIf { it.isFinite() }
    }

    /** Réponse Open-Meteo → `[WeatherDay]` ; lève `IllegalArgumentException("Réponse météo invalide")`. */
    fun parseOpenMeteo(json: JsonElement?): List<WeatherDay> {
        val d = (json as? JsonObject)?.get("daily") as? JsonObject
        val time = d?.get("time") as? JsonArray ?: throw IllegalArgumentException("Réponse météo invalide")
        fun col(name: String) = d[name] as? JsonArray
        val p = col("precipitation_sum"); val e = col("et0_fao_evapotranspiration"); val tn = col("temperature_2m_min"); val tx = col("temperature_2m_max")
        return time.mapIndexed { i, t ->
            WeatherDay((t as? JsonPrimitive)?.contentOrNull ?: "", num(p?.getOrNull(i)), num(e?.getOrNull(i)), num(tn?.getOrNull(i)), num(tx?.getOrNull(i)))
        }
    }

    fun parseOpenMeteo(text: String): List<WeatherDay> = parseOpenMeteo(Json.parseToJsonElement(text))

    /** `Number.prototype.toFixed(3)`. */
    private fun fixed3(x: Double): String =
        if (x < 0) "-" + BigDecimal(-x).setScale(3, RoundingMode.HALF_UP).toPlainString() else BigDecimal(x).setScale(3, RoundingMode.HALF_UP).toPlainString()

    fun weatherUrl(lat: Double, lon: Double, days: Int = 7): String {
        val n = Math.min(16, Math.max(1, jsRound(days.toDouble()).toInt()))
        return "$BASE?latitude=${fixed3(lat)}&longitude=${fixed3(lon)}&daily=$DAILY&timezone=auto&forecast_days=$n&past_days=$PAST_DAYS"
    }

    fun cacheKey(lat: Double, lon: Double): String = "$CACHE_PREFIX${fixed3(lat)},${fixed3(lon)}"

    /** Le cache est-il encore frais (pas de réseau nécessaire) ? `cachedDays` : durée demandée lors de l'enregistrement. */
    fun isCacheFresh(fetchedAtIso: String, nowMs: Long, cachedDays: Int, days: Int, ttlMs: Long = DEFAULT_TTL_MS): Boolean {
        val t = try { Instant.parse(fetchedAtIso).toEpochMilli() } catch (_: Exception) { return false }
        return nowMs - t < ttlMs && cachedDays >= days
    }
}
