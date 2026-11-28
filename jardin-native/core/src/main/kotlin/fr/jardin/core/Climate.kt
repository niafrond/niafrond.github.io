package fr.jardin.core

import java.text.Collator
import java.util.Locale
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.math.floor

@Serializable
data class Departement(
    val code: String,
    val name: String,
    val region: String,
    val tminC: Double,
    val rainMm: Double,
    val frostFreeFrom: Int,
    val frostFreeTo: Int,
    val zoneUSDA: String,
)

@Serializable
private data class DepartementsFile(val departements: List<Departement>)

/** Climat par département : rusticité, régions, conversion de codes. */
object Climate {
    val departements: List<Departement> by lazy {
        val s = Climate::class.java.getResourceAsStream("/departements.json") ?: return@lazy emptyList()
        s.use { Json { ignoreUnknownKeys = true }.decodeFromString<DepartementsFile>(it.readBytes().toString(Charsets.UTF_8)).departements }
    }
    private val byCode by lazy { departements.associateBy { it.code } }

    private fun normCode(code: String?): String? {
        if (code == null) return null
        var c = code.trim().uppercase()
        if (Regex("^\\d$").matches(c)) c = "0$c"
        return c
    }

    fun climateForDepartement(code: String?): Departement? = normCode(code)?.takeIf { it.isNotEmpty() }?.let { byCode[it] }
    fun climateForDepartement(code: Int): Departement? = climateForDepartement(code.toString())

    /** Liste triée (fr) des régions. */
    fun regions(): List<String> {
        val col = Collator.getInstance(Locale.FRENCH)
        return departements.map { it.region }.distinct().sortedWith { a, b -> col.compare(a, b) }
    }

    /** −0,6 °C par 100 m (altitude inconnue/≤ 0 : inchangé). */
    fun adjustTminForAltitude(tminC: Double, altitudeM: Double?): Double {
        if (altitudeM == null || !altitudeM.isFinite() || altitudeM <= 0) return tminC
        return floor((tminC - 0.6 * (altitudeM / 100)) * 10 + 0.5) / 10
    }

    /** Zone de rusticité USDA (ex. « 8b »). */
    fun hardinessZone(tminC: Double): String {
        val idx = floor((tminC + 51.1) / 2.78).toInt()
        if (idx < 0) return "1a"
        return "${idx / 2 + 1}${if (idx % 2 != 0) "b" else "a"}"
    }

    /** Code département depuis un code INSEE (5 car.) ; null si invalide ou hors métropole. */
    fun departementFromCommuneCode(insee: String?): String? {
        if (insee == null) return null
        val s = insee.trim().uppercase()
        if (!Regex("^(\\d{5}|2[AB]\\d{3})$").matches(s)) return null
        val code = s.substring(0, 2)
        return if (byCode.containsKey(code)) code else null
    }
}
