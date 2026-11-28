package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class AmbiancesTest {
    private val IDS = Ambiances.AMBIANCES.map { it.id }.toSet()
    private fun by(id: String) = getPlant(id)!!

    @Test fun listeComplete() {
        assertEquals(12, Ambiances.AMBIANCES.size)
        for (a in Ambiances.AMBIANCES) {
            assertTrue(Regex("^[a-z]+$").matches(a.id))
            assertTrue(a.label.isNotEmpty() && a.emoji.isNotEmpty() && a.desc.length > 20 && a.keywords.isNotEmpty())
            for (k in a.keywords) assertEquals(k, java.text.Normalizer.normalize(k, java.text.Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase())
            assertSame(a, Ambiances.getAmbiance(a.id))
        }
        assertNull(Ambiances.getAmbiance("nimporte"))
    }

    @Test fun tags() {
        val plants = allPlants()
        for (p in plants) {
            val t = assertNotNull(p.ambianceTag, p.id)
            assertTrue(t.ambiances.size in 2..4, p.id)
            assertEquals(t.ambiances.size, t.ambiances.toSet().size)
            for (a in t.ambiances + t.avoid) assertTrue(a in IDS, p.id)
            for (a in t.avoid) assertFalse(a in t.ambiances)
        }
    }

    @Test fun huitTypiquesParAmbiance() {
        for (a in Ambiances.AMBIANCES) assertTrue(allPlants().count { Ambiances.isTypical(it, a.id) } >= 8, a.id)
    }

    @Test fun detection() {
        val cases = listOf(
            "Massif bucolique devant la terrasse" to "bucolique", "coin zen" to "zen", "Jardin japonais" to "zen", "Coin ZEN près du bassin" to "zen",
            "Parterre décoratif" to "decoratif", "Haie champêtre" to "bucolique", "Espace méditerranéen" to "mediterraneen", "Carré gourmand" to "gourmand",
            "Allée romantique" to "romantique", "Massif contemporain" to "contemporain", "Angle exotique" to "exotique",
            "Pour les papillons et les abeilles" to "pollinisateurs", "Coin calme" to "apaisant", "Bordure colorée" to "colore", "Zone sauvage au fond" to "sauvage",
        )
        for ((t, id) in cases) assertEquals(id, Ambiances.detectAmbiance(t), t)
        for (t in listOf("Potager", "Massif de plantes moyennes", "Arbres", "", null, "Zone 2", "Zenith")) assertNull(Ambiances.detectAmbiance(t), t)
    }

    @Test fun ambiancesEtScores() {
        assertEquals("mediterraneen", Ambiances.plantAmbiances(by("h-lavande"))[0])
        val a = Ambiances.plantAmbiances(Plant("x", category = "fruit", edible = true, melliferous = true, sun = listOf("full"), water = "medium", bloom = listOf(5)))
        assertTrue("gourmand" in a && "pollinisateurs" in a)
        val g = Ambiances.plantAmbiances(Plant("x", category = "grass", sun = listOf("full"), water = "low", bloom = listOf(8)))
        assertTrue(g.containsAll(listOf("contemporain", "zen", "sauvage")))
        for (p in allPlants()) for (id in IDS) assertTrue(Ambiances.plantAmbianceScore(p, id) in 0.0..1.0)
        assertEquals(1.0, Ambiances.plantAmbianceScore(by("h-lavande"), "mediterraneen"))
        assertEquals(0.0, Ambiances.plantAmbianceScore(by("thuya"), "sauvage"))
        assertTrue(Ambiances.plantAmbianceScore(by("h-hosta"), "zen") > 0.7)
        assertTrue(Ambiances.plantAmbianceScore(by("h-dahlia"), "apaisant") < 0.5)
        assertEquals(0.5, Ambiances.plantAmbianceScore(by("h-tomate"), "sauvage"), 1e-9)
        assertEquals(0.5, Ambiances.plantAmbianceScore(by("h-lavande"), "inconnue"))
    }

    @Test fun golden() {
        val g = goldenJson("ambiances")
        for (e in g["ambiances"]!!.jsonArray) {
            val o = e.jsonObject
            val a = Ambiances.getAmbiance(o["id"]!!.jsonPrimitive.content)!!
            assertEquals(o["label"]!!.jsonPrimitive.content, a.label)
            assertEquals(o["emoji"]!!.jsonPrimitive.content, a.emoji)
            assertEquals(o["desc"]!!.jsonPrimitive.content, a.desc)
            assertEquals(o["keywords"]!!.jsonArray.map { it.jsonPrimitive.content }, a.keywords)
        }
        for (e in g["detect"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["r"]!!.jsonPrimitive.contentOrNull, Ambiances.detectAmbiance(o["t"]!!.jsonPrimitive.contentOrNull), "$o")
        }
        val dec = Json { ignoreUnknownKeys = true; coerceInputValues = true }
        val synth = g["synth"]!!.jsonArray.associate { it.jsonObject["id"]!!.jsonPrimitive.content to dec.decodeFromJsonElement(Plant.serializer(), it) }
        val ids = Ambiances.AMBIANCES.map { it.id }
        for (e in g["plants"]!!.jsonArray) {
            val o = e.jsonObject
            val id = o["id"]!!.jsonPrimitive.content
            val p = synth[id] ?: getPlant(id)!!
            assertEquals(o["ambiances"]!!.jsonArray.map { it.jsonPrimitive.content }, Ambiances.plantAmbiances(p), id)
            assertEquals(o["avoids"]!!.jsonArray.map { it.jsonPrimitive.content }, Ambiances.plantAvoids(p), id)
            val sc = o["scores"]!!.jsonArray
            val ty = o["typical"]!!.jsonArray
            ids.forEachIndexed { i, a ->
                assertEquals(sc[i].jsonPrimitive.double, Ambiances.plantAmbianceScore(p, a), 1e-6, "$id/$a")
                assertEquals(ty[i].jsonPrimitive.boolean, Ambiances.isTypical(p, a), "$id/$a")
            }
        }
        assertEquals(g["unknownScore"]!!.jsonPrimitive.double, Ambiances.plantAmbianceScore(allPlants()[0], "inconnue"), 1e-6)
    }
}
