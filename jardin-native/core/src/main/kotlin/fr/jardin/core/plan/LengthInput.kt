package fr.jardin.core.plan

import java.util.Locale
import kotlin.math.roundToLong

/** Saisie et affichage des longueurs « à la française » (port de `parseLength`, `fr`, `frLen`, `frArea` de ui/draw-util.js). */
object LengthInput {
    private val RE = Regex("^(-?\\d+(?:\\.\\d+)?)(cm|m)?$")

    /**
     * Lit une longueur saisie et la renvoie en mètres (null si illisible). Un entier seul est en centimètres
     * (« 350 » = 3,50 m) ; avec décimale ou « m » c'est des mètres (« 3,5 » ou « 3,5 m ») ; « 350 cm » est explicite.
     */
    fun parseLength(s: String?): Double? {
        val t = (s ?: "").trim().lowercase().replace(Regex("\\s+"), "").replace(',', '.')
        if (t.isEmpty()) return null
        val m = RE.matchEntire(t) ?: return null
        val n = m.groupValues[1].toDouble()
        if (!(n > 0)) return null
        return when {
            m.groupValues[2] == "cm" -> n / 100
            m.groupValues[2] == "m" || m.groupValues[1].contains('.') -> n
            else -> n / 100
        }
    }

    /** Lit un nombre (virgule ou point), null si illisible. */
    fun parseNum(s: String?): Double? = (s ?: "").trim().replace(',', '.').toDoubleOrNull()?.takeIf { it.isFinite() }

    /** Longueur en mètres -> centimètres entiers pour le champ de saisie. */
    fun toCm(m: Double): String = (m * 100).roundToLong().toString()

    /** Nombre au format français : 12,50 */
    fun fr(n: Double, digits: Int = 2): String =
        if (n.isFinite()) String.format(Locale.US, "%.${digits}f", n).replace('.', ',') else "—"

    fun frLen(n: Double): String = "${fr(n, 2)} m"
    fun frArea(n: Double): String = "${fr(n, if (n >= 100) 1 else 2)} m²"
}
