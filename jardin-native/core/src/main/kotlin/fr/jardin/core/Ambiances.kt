package fr.jardin.core

import java.text.Normalizer
import kotlin.math.abs
import kotlin.math.max

data class Ambiance(val id: String, val label: String, val emoji: String, val desc: String, val keywords: List<String>)

/** Ambiances de jardin (« Surprends-moi ») : liste, détection dans un libellé, affinité d'une essence. */
object Ambiances {
    /** keywords : minuscules sans accents ; un mot-clé de 4 lettres ou plus accepte n'importe quelle fin de mot. */
    val AMBIANCES = listOf(
        Ambiance("bucolique", "Bucolique", "🌼", "Un jardin champêtre : fleurs des champs, vivaces rustiques et mellifères, ambiance de campagne.", listOf("bucolique", "champetre", "campagnard", "campagne", "pastoral")),
        Ambiance("decoratif", "Décoratif", "🎨", "Des floraisons spectaculaires, des couleurs vives et des feuillages ornementaux pour faire de l'effet.", listOf("decoratif", "decorative", "ornemental", "spectaculaire")),
        Ambiance("sauvage", "Sauvage", "🦔", "Un coin naturel d'essences indigènes, très peu d'entretien et un refuge pour la faune.", listOf("sauvage", "naturel", "naturelle", "friche", "refuge", "biodiversite", "ensauvage")),
        Ambiance("zen", "Zen", "🎋", "Un esprit japonais sobre : graminées, feuillages, érables, bambous non traçants et mousses.", listOf("zen", "japonais", "japonaise", "japon", "nippon")),
        Ambiance("mediterraneen", "Méditerranéen", "🫒", "Lavande, olivier, romarin et plantes sèches au feuillage gris, qui aiment le soleil et la sécheresse.", listOf("mediterran", "provencal", "provence", "garrigue", "maquis")),
        Ambiance("gourmand", "Gourmand", "🍓", "Des plantes comestibles : légumes, aromatiques, petits fruits et fruitiers.", listOf("gourmand", "comestible", "nourricier", "nourriciere")),
        Ambiance("romantique", "Romantique", "🌹", "Roses, clématites, tons pastel et floraisons parfumées pour un jardin tout en douceur.", listOf("romantique", "romance", "cottage", "anglais", "anglaise")),
        Ambiance("contemporain", "Contemporain", "◼️", "Un style minimaliste : graminées, formes nettes, peu de couleurs et des plantes structurantes.", listOf("contemporain", "moderne", "minimal", "epure", "design")),
        Ambiance("exotique", "Exotique", "🌴", "Grands feuillages luxuriants et floraisons éclatantes : un effet jungle, mais rustique.", listOf("exotique", "tropical", "tropicale", "jungle", "luxuriant")),
        Ambiance("pollinisateurs", "Pollinisateurs", "🐝", "Des plantes mellifères pour attirer abeilles, bourdons et papillons toute la saison.", listOf("pollinis", "abeille", "papillon", "mellifer", "butin")),
        Ambiance("apaisant", "Apaisant", "🕊️", "Des tons blancs, bleus et verts pour un coin calme où se reposer.", listOf("apaisant", "calme", "serein", "sereine", "reposant", "tranquille", "detente", "relaxant", "zenitude")),
        Ambiance("colore", "Coloré", "🌈", "Une explosion de couleurs, avec une floraison étalée sur toute la saison.", listOf("colore", "coloree", "multicolore", "arc en ciel", "flamboyant")),
    )

    private val BY_ID = AMBIANCES.associateBy { it.id }

    /** Une essence est typique d'une ambiance à partir de 0,7. */
    const val TYPICAL_THRESHOLD = 0.7

    fun getAmbiance(id: String?): Ambiance? = if (id == null) null else BY_ID[id]

    private fun norm(s: String?): String =
        Normalizer.normalize(s ?: "", Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase()
            .replace(Regex("[^a-z0-9]+"), " ").trim()

    /** Détecte une ambiance explicite dans un texte (nom de zone) : premier mot rencontré, sinon null. */
    fun detectAmbiance(texte: String?): String? {
        val t = " ${norm(texte)}"
        if (t.trim() == "") return null
        var best: String? = null
        var bestIdx = Int.MAX_VALUE
        for (a in AMBIANCES) for (k in a.keywords) {
            val i = t.indexOf(" $k")
            if (i < 0) continue
            val end = i + 1 + k.length
            if (k.length < 4 && end < t.length && t[end] != ' ') continue
            if (i < bestIdx) { bestIdx = i; best = a.id }
        }
        return best
    }

    private class Hsl(val h: Double, val s: Double, val l: Double)

    private fun hexToHsl(hex: String?): Hsl? {
        val m = Regex("^#?([0-9a-fA-F]{6})$").find(hex ?: "") ?: return null
        val n = m.groupValues[1].toInt(16)
        val r = ((n shr 16) and 255) / 255.0
        val g = ((n shr 8) and 255) / 255.0
        val b = (n and 255) / 255.0
        val mx = maxOf(r, g, b)
        val mn = minOf(r, g, b)
        val l = (mx + mn) / 2
        val d = mx - mn
        val s = if (d == 0.0) 0.0 else d / (1 - abs(2 * l - 1))
        var h = 0.0
        if (d != 0.0) {
            h = if (mx == r) ((g - b) / d) % 6 else if (mx == g) (b - r) / d + 2 else (r - g) / d + 4
            h = (h * 60 + 360) % 360
        }
        return Hsl(h, s, l)
    }

    private fun isVivid(p: Plant): Boolean {
        val c = hexToHsl(p.flowerColor) ?: return false
        return c.s >= 0.6 && c.l >= 0.3 && c.l <= 0.65
    }

    private fun isCalmColor(p: Plant): Boolean {
        val c = hexToHsl(p.flowerColor) ?: return p.category == "grass" || p.foliage == "evergreen"
        return c.s < 0.4 || c.l > 0.8 || (c.h >= 180 && c.h <= 270) || (c.h >= 60 && c.h < 180)
    }

    private fun deduce(p: Plant): List<String> {
        val out = ArrayList<String>()
        fun add(a: String) { if (a !in out) out.add(a) }
        if (p.edible || p.category == "vegetable" || p.category == "fruit") add("gourmand")
        if (p.melliferous) add("pollinisateurs")
        if (p.category == "grass") { add("contemporain"); add("zen"); add("sauvage") }
        if (p.water == "low" && "full" in p.sun && "shade" !in p.sun && p.foliage == "evergreen") add("mediterraneen")
        if (p.category == "aquatic" || p.category == "groundcover") add("sauvage")
        if (p.category == "perennial" || p.category == "lawn") add("bucolique")
        if (p.bloom.size >= 5 && isVivid(p)) add("colore")
        if (p.category != "vegetable" && isCalmColor(p) && !isVivid(p)) add("apaisant")
        if (p.maintenance == "low" && p.melliferous && p.category != "tree") add("sauvage")
        return out
    }

    private fun taggedList(p: Plant): List<String>? = p.ambianceTag?.ambiances?.takeIf { it.isNotEmpty() }

    /** Ambiances typiques d'une essence (tags explicites, sinon déductions), par ordre de pertinence. */
    fun plantAmbiances(plant: Plant?): List<String> {
        if (plant == null) return emptyList()
        return taggedList(plant)?.toList() ?: deduce(plant)
    }

    /** Ambiances auxquelles l'essence ne convient pas. */
    fun plantAvoids(plant: Plant?): List<String> = plant?.ambianceTag?.avoid?.toList() ?: emptyList()

    /** Affinité essence/ambiance : 1 très typique, 0,5 compatible, 0 contraire. */
    fun plantAmbianceScore(plant: Plant?, ambianceId: String?): Double {
        if (plant == null || ambianceId == null || !BY_ID.containsKey(ambianceId)) return 0.5
        if (ambianceId in plantAvoids(plant)) return 0.0
        val tagged = taggedList(plant)
        val list = tagged ?: deduce(plant)
        val idx = list.indexOf(ambianceId)
        if (idx >= 0) return if (tagged != null) max(0.7, 1 - 0.1 * idx) else 0.7
        if (ambianceId == "gourmand" && !plant.edible) return 0.4
        if (ambianceId == "pollinisateurs" && !plant.melliferous) return 0.4
        if ((ambianceId == "apaisant" || ambianceId == "zen") && isVivid(plant)) return 0.3
        if (ambianceId == "colore" && plant.bloom.isEmpty()) return 0.4
        return 0.5
    }

    fun isTypical(plant: Plant?, ambianceId: String?): Boolean = plantAmbianceScore(plant, ambianceId) >= TYPICAL_THRESHOLD
}
