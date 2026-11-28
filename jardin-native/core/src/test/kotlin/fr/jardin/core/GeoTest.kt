package fr.jardin.core

import kotlinx.serialization.json.*
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.test.*

class GeoTest {
    private fun parse(s: String) = Json.parseToJsonElement(s)

    @Test fun moyennePonderee() {
        val r = Geo.averageSamples(listOf(GpsSample(10.0, 10.0, 1.0), GpsSample(20.0, 20.0, 100.0)))
        assertEquals(10.0, r.lat, 0.1); assertTrue(r.accuracy <= 1.0)
    }

    @Test fun declinaisonPlausible() {
        val d = LocalDate.of(2026, 1, 1)
        assertTrue(Geo.magneticDeclination(48.85, 2.35, d) > 0)
        assertTrue(Geo.magneticDeclination(48.4, -4.5, d) < Geo.magneticDeclination(48.6, 7.75, d))
    }

    @Test fun communes() {
        val r = Geo.parseCommune(parse("""[{"nom":"Nantes","code":"44109","codeDepartement":"44","codeRegion":"52","region":{"code":"52","nom":"Pays de la Loire"}}]"""))
        assertEquals(CommuneInfo("Nantes", "44", "Pays de la Loire", "44109"), r)
        assertTrue(Geo.reverseCommuneUrl(47.2, -1.55).contains("geo.api.gouv.fr/communes?lat=47.2&lon=-1.55"))
        assertNull(Geo.parseCommune(parse("[]")))
    }

    @Test fun adresses() {
        val r = Geo.parseAddresses(parse("""{"features":[{"geometry":{"coordinates":[2.35,48.85]},"properties":{"label":"1 rue X 75001 Paris"}}]}"""))
        assertEquals(listOf(AddressHit("1 rue X 75001 Paris", 48.85, 2.35)), r)
        assertTrue(Geo.searchAddressUrl("1 rue X")!!.contains("data.geopf.fr/geocodage/search?q=1%20rue%20X&limit=5"))
        assertNull(Geo.searchAddressUrl(" "))
    }

    @Test fun altitude() {
        assertEquals(412.3, Geo.pickElevation(parse("""{"elevations":[412.3]}"""), null))
        assertEquals(150.0, Geo.pickElevation(parse("""{"elevations":[-99999]}"""), parse("""{"elevation":[150]}""")))
        assertNull(Geo.pickElevation(null, null))
    }

    @Test fun boussole() {
        val f = Geo.HeadingFilter(0.0)
        // alpha 90 absolu → cap magnétique (360 - 90) = 270
        assertEquals(270.0, f.update((360 - 90.0) % 360))
    }

    @Test fun messages() {
        assertTrue(Geo.geoErrorMessage("denied").startsWith("Localisation refusée"))
        assertEquals(Geo.geoErrorMessage("denied"), Geo.geoErrorMessage("1"))
        assertEquals(Geo.geoErrorMessage("timeout"), Geo.geoErrorMessage("3"))
        assertTrue(Geo.geoErrorMessage("unsupported").startsWith("Géolocalisation indisponible"))
    }

    @Test fun golden() {
        val g = goldenJson("geo")
        for (e in g["averages"]!!.jsonArray) {
            val o = e.jsonObject
            val s = o["s"]!!.jsonArray.map { x -> val p = x.jsonObject; GpsSample(p["lat"]!!.jsonPrimitive.double, p["lon"]!!.jsonPrimitive.double, p["accuracy"]?.jsonPrimitive?.doubleOrNull) }
            val r = Geo.averageSamples(s); val x = o["r"]!!.jsonObject
            assertEquals(x["lat"]!!.jsonPrimitive.double, r.lat, 1e-9); assertEquals(x["lon"]!!.jsonPrimitive.double, r.lon, 1e-9); assertEquals(x["accuracy"]!!.jsonPrimitive.double, r.accuracy, 1e-9)
        }
        for (e in g["errorCodes"]!!.jsonArray) { val o = e.jsonObject; assertEquals(o["msg"]!!.jsonPrimitive.content, Geo.geoErrorMessage(o["c"]!!.jsonPrimitive.contentOrNull), o.toString()) }
        for (e in g["decl"]!!.jsonArray) {
            val o = e.jsonObject; val ds = o["d"]!!.jsonPrimitive.content
            val date = if ('T' in ds) Instant.parse(ds).atZone(ZoneOffset.UTC).toLocalDate() else LocalDate.parse(ds)
            assertEquals(o["v"]!!.jsonPrimitive.double, Geo.magneticDeclination(o["la"]!!.jsonPrimitive.double, o["lo"]!!.jsonPrimitive.double, date), 1e-9, o.toString())
        }
        for (e in g["heads"]!!.jsonArray) {
            val o = e.jsonObject
            val lat = o["lat"]!!.jsonPrimitive.doubleOrNull; val lon = o["lon"]!!.jsonPrimitive.doubleOrNull
            val decl = if (lat != null && lon != null) Geo.magneticDeclination(lat, lon) else 0.0
            val f = Geo.HeadingFilter(decl)
            val webkit = o["kind"]!!.jsonPrimitive.content == "webkit"
            val got = o["a"]!!.jsonArray.map { a -> val v = a.jsonPrimitive.double; f.update(if (webkit) v else (360 - v) % 360) }
            val exp = o["out"]!!.jsonArray.map { it.jsonPrimitive.double }
            assertEquals(exp.size, got.size)
            exp.forEachIndexed { i, v -> assertEquals(v, got[i], 1e-9, "cap $o #$i") }
        }
        for (e in g["searchUrls"]!!.jsonArray) {
            val o = e.jsonObject; val q = o["q"]!!.jsonPrimitive.content
            val url = Geo.searchAddressUrl(q)
            assertEquals(o["url"]!!.jsonPrimitive.contentOrNull, url, q)
        }
        for (e in g["searchRes"]!!.jsonArray) {
            val o = e.jsonObject
            assertSame2(o["r"], JsonArray(Geo.parseAddresses(o["f"]).map { buildJsonObject { put("label", it.label); put("lat", it.lat); put("lon", it.lon) } }), "searchRes $o")
        }
        for (e in g["communeRes"]!!.jsonArray) {
            val o = e.jsonObject; val r = Geo.parseCommune(o["c"])
            val got: JsonElement = if (r == null) JsonNull else buildJsonObject { put("commune", r.commune); put("departement", r.departement); put("region", r.region); put("codeInsee", r.codeInsee) }
            assertSame2(o["r"], got, "commune $o")
            assertEquals(o["u"]!!.jsonPrimitive.content, Geo.reverseCommuneUrl(47.2, -1.55))
        }
        for (e in g["communeUrls"]!!.jsonArray) { val o = e.jsonObject; assertEquals(o["u"]!!.jsonPrimitive.content, Geo.reverseCommuneUrl(o["la"]!!.jsonPrimitive.double, o["lo"]!!.jsonPrimitive.double)) }
        for (e in g["elevations"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["r"]!!.jsonPrimitive.doubleOrNull, Geo.pickElevation(o["ign"], o["om"]), o.toString())
            assertEquals(o["urls"]!!.jsonArray[0].jsonPrimitive.content, Geo.elevationUrlIgn(45.5, 3.25))
            if (o["urls"]!!.jsonArray.size > 1) assertEquals(o["urls"]!!.jsonArray[1].jsonPrimitive.content, Geo.elevationUrlOpenMeteo(45.5, 3.25))
        }
    }
}
