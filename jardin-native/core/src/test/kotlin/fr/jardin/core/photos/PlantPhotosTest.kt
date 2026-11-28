package fr.jardin.core.photos

import fr.jardin.core.Plant
import kotlin.test.*

class PlantPhotosTest {
    private val lav = Plant("lavande", "Lavande", "Lavandula angustifolia subsp. x", "shrub", wiki = "Lavandula angustifolia")
    private val ok = """{"type":"standard","thumbnail":{"source":"https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/L.jpg/320px-L.jpg"},"originalimage":{"source":"https://upload.wikimedia.org/wikipedia/commons/a/ab/L.jpg"},"content_urls":{"desktop":{"page":"https://fr.wikipedia.org/wiki/Lavande"}}}"""

    @Test fun titresDansLOrdreSansDoublon() {
        assertEquals(listOf("Lavandula angustifolia", "Lavande"), PlantPhotos.photoTitles(lav))
        assertEquals(listOf("Lavandula angustifolia", "Lavande"), PlantPhotos.photoTitles(lav.copy(wiki = null)))
        assertEquals(listOf("Rosa canina", "Eglantier"), PlantPhotos.photoTitles(Plant("r", "Eglantier", "Rosa canina L.", "shrub", wiki = "Rosa canina")))
        assertEquals(emptyList(), PlantPhotos.photoTitles(null))
    }

    @Test fun urlDeLApi() {
        assertEquals(PHOTO_API + "Acer_palmatum", PlantPhotos.summaryUrl("Acer palmatum"))
        assertEquals(PHOTO_API + "%C3%89rable_du_Japon", PlantPhotos.summaryUrl("Érable du Japon"))
    }

    @Test fun analyseDuJson() {
        val p = assertNotNull(PlantPhotos.parseSummary(ok, "Lavande"))
        assertTrue(p.url.endsWith("/320px-L.jpg"))
        assertTrue(p.medium.contains("/640px-L.jpg"))
        assertEquals("https://upload.wikimedia.org/wikipedia/commons/a/ab/L.jpg", p.large)
        assertEquals("https://fr.wikipedia.org/wiki/Lavande", p.page)
        assertEquals("Photo : Wikipédia", p.credit)
        // homonymie, pas d'image, JSON illisible
        assertNull(PlantPhotos.parseSummary("""{"type":"disambiguation","thumbnail":{"source":"x"}}""", "A"))
        assertNull(PlantPhotos.parseSummary("""{"type":"standard"}""", "A"))
        assertNull(PlantPhotos.parseSummary("pas du json", "A"))
        assertNull(PlantPhotos.parseSummary(null, "A"))
        // page de repli, original absent
        val q = assertNotNull(PlantPhotos.parseSummary("""{"thumbnail":{"source":"https://x/y/50px-Z.png"}}""", "Rosa canina"))
        assertEquals("https://fr.wikipedia.org/wiki/Rosa_canina", q.page)
        assertEquals(q.url, q.large)
    }

    @Test fun cacheEtTtl() {
        val now = 1_000_000_000L
        assertTrue(PlantPhotos.isFresh(PhotoCacheEntry(now - PHOTO_OK_TTL_MS + 1, PlantPhotos.parseSummary(ok, "L")), now))
        assertFalse(PlantPhotos.isFresh(PhotoCacheEntry(now - PHOTO_OK_TTL_MS - 1, PlantPhotos.parseSummary(ok, "L")), now))
        assertTrue(PlantPhotos.isFresh(PhotoCacheEntry(now - PHOTO_KO_TTL_MS + 1, null), now))
        assertFalse(PlantPhotos.isFresh(PhotoCacheEntry(now - PHOTO_KO_TTL_MS - 1, null), now))
        assertFalse(PlantPhotos.isFresh(null, now))
    }

    @Test fun getPhotoEssaieLesTitresPuisMemorise() {
        val calls = ArrayList<String>()
        val cache = MemoryPhotoCache()
        val f = PhotoFetcher { u -> calls.add(u); if (u.endsWith("/Lavande")) ok else null }
        val p = PlantPhotos.getPlantPhoto(lav, f, cache, now = 10L)
        assertNotNull(p)
        assertEquals(2, calls.size)
        // deuxième appel : cache, pas de réseau
        assertEquals(p, PlantPhotos.getPlantPhoto(lav, f, cache, now = 20L))
        assertEquals(2, calls.size)
    }

    @Test fun echecMemoriseUnJourPuisReessaie() {
        var n = 0
        val cache = MemoryPhotoCache()
        val f = PhotoFetcher { n++; null }
        assertNull(PlantPhotos.getPlantPhoto(lav, f, cache, now = 0L))
        val first = n
        assertNull(PlantPhotos.getPlantPhoto(lav, f, cache, now = 1000L))
        assertEquals(first, n)
        assertNull(PlantPhotos.getPlantPhoto(lav, f, cache, now = PHOTO_KO_TTL_MS + 1))
        assertEquals(first * 2, n)
    }

    @Test fun neLevePasEtSerialiseLesEntrees() {
        assertNull(PlantPhotos.getPlantPhoto(null, { error("x") }, MemoryPhotoCache()))
        assertNull(PlantPhotos.getPlantPhoto(lav, { error("réseau") }, MemoryPhotoCache()))
        val e = PhotoCacheEntry(5L, PlantPhotos.parseSummary(ok, "L"))
        assertEquals(e, PlantPhotos.decodeEntry(PlantPhotos.encodeEntry(e)))
        assertNull(PlantPhotos.decodeEntry("{"))
    }
}
