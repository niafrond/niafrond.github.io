package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class ClimateTest {
    @Test fun tableClimatique() {
        val d = Climate.departements
        assertEquals(96, d.size)
        assertEquals(96, d.map { it.code }.toSet().size)
        val codes = d.map { it.code }
        assertTrue(codes.containsAll(listOf("01", "2A", "2B", "95")))
        assertFalse("20" in codes)
        for (x in d) {
            assertTrue(x.tminC in -25.0..0.0)
            assertTrue(x.rainMm > 400 && x.rainMm < 1500)
            assertTrue(x.frostFreeFrom >= 1 && x.frostFreeFrom < x.frostFreeTo && x.frostFreeTo <= 12)
            assertEquals(Climate.hardinessZone(x.tminC), x.zoneUSDA)
        }
    }

    @Test fun lookup() {
        assertEquals("Bretagne", Climate.climateForDepartement("29")!!.region)
        assertEquals("Corse-du-Sud", Climate.climateForDepartement("2a")!!.name)
        assertEquals("07", Climate.climateForDepartement(7)!!.code)
        assertNull(Climate.climateForDepartement("99"))
        assertNull(Climate.climateForDepartement(null as String?))
        assertTrue(Climate.climateForDepartement("06")!!.tminC > Climate.climateForDepartement("05")!!.tminC)
    }

    @Test fun regionsTriees() {
        val r = Climate.regions()
        assertTrue("Bretagne" in r && "Corse" in r)
        assertEquals(r.size, r.toSet().size)
    }

    @Test fun altitudeEtZone() {
        assertEquals(-13.0, Climate.adjustTminForAltitude(-10.0, 500.0))
        assertEquals(-10.0, Climate.adjustTminForAltitude(-10.0, 0.0))
        assertEquals(-10.0, Climate.adjustTminForAltitude(-10.0, null))
        assertEquals("7a", Climate.hardinessZone(-15.0))
        assertEquals("7b", Climate.hardinessZone(-13.0))
        assertEquals("8b", Climate.hardinessZone(-7.0))
        assertEquals("9b", Climate.hardinessZone(-3.0))
        assertEquals("6b", Climate.hardinessZone(-20.0))
    }

    @Test fun communes() {
        assertEquals("75", Climate.departementFromCommuneCode("75056"))
        assertEquals("2A", Climate.departementFromCommuneCode("2A004"))
        assertEquals("2B", Climate.departementFromCommuneCode("2B033"))
        assertEquals("01", Climate.departementFromCommuneCode("01001"))
        assertNull(Climate.departementFromCommuneCode("97411"))
        assertNull(Climate.departementFromCommuneCode("abc"))
        assertNull(Climate.departementFromCommuneCode(null))
    }

    private fun s(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content

    @Test fun golden() {
        val g = goldenJson("climate")
        assertEquals(g["departementCount"]!!.jsonPrimitive.int, Climate.departements.size)
        assertEquals(g["departementCodes"]!!.jsonArray.map { it.jsonPrimitive.content }, Climate.departements.map { it.code })
        for (e in g["lookup"]!!.jsonArray) {
            val o = e.jsonObject
            val c = s(o["c"])
            val r = o["r"]
            val got = Climate.climateForDepartement(c)
            if (r is JsonNull) assertNull(got, "c=$c") else {
                val ro = r!!.jsonObject
                assertEquals(ro["code"]!!.jsonPrimitive.content, got!!.code)
                assertEquals(ro["name"]!!.jsonPrimitive.content, got.name)
                assertEquals(ro["tminC"]!!.jsonPrimitive.double, got.tminC, 1e-6)
                assertEquals(ro["zoneUSDA"]!!.jsonPrimitive.content, got.zoneUSDA)
            }
        }
        assertEquals(g["regions"]!!.jsonArray.map { it.jsonPrimitive.content }, Climate.regions())
        for (e in g["adjust"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["r"]!!.jsonPrimitive.double, Climate.adjustTminForAltitude(o["t"]!!.jsonPrimitive.double, o["a"]!!.jsonPrimitive.doubleOrNull), 1e-6, "$o")
        }
        for (e in g["zones"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(o["r"]!!.jsonPrimitive.content, Climate.hardinessZone(o["t"]!!.jsonPrimitive.double), "$o")
        }
        for (e in g["communes"]!!.jsonArray) {
            val o = e.jsonObject
            assertEquals(s(o["r"]), Climate.departementFromCommuneCode(s(o["c"])), "$o")
        }
    }
}
