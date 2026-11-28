package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.math.PI
import kotlin.test.*

class GeometryTest {
    private val sq = listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 4.0), Point(0.0, 4.0))
    private fun p(x: Double, y: Double) = Point(x, y)

    // ---- tests portés de geometry.test.js (cas essentiels)
    @Test fun aireEtPerimetre() {
        assertEquals(16.0, polygonArea(sq), 1e-12)
        assertEquals(16.0, signedArea(sq), 1e-12)
        assertEquals(-16.0, signedArea(sq.reversed()), 1e-12)
        assertEquals(16.0, perimeter(sq), 1e-12)
        assertEquals(12.0, perimeter(sq, false), 1e-12)
        assertEquals(0.0, polygonArea(sq.take(2)), 0.0)
        assertEquals(Point(2.0, 2.0), centroid(sq))
        assertEquals(Point(0.0, 0.0), centroid(emptyList()))
        val b = bounds(sq)
        assertEquals(4.0, b.width, 0.0); assertEquals(4.0, b.height, 0.0)
    }

    @Test fun pointDansPolygone() {
        assertTrue(pointInPolygon(p(2.0, 2.0), sq))
        assertTrue(pointInPolygon(p(0.0, 2.0), sq))
        assertTrue(pointInPolygon(p(4.0, 4.0), sq))
        assertFalse(pointInPolygon(p(5.0, 2.0), sq))
        assertFalse(pointInPolygon(p(2.0, 2.0), sq.take(2)))
    }

    @Test fun polygoneSimple() {
        assertTrue(isSimplePolygon(sq))
        assertFalse(isSimplePolygon(listOf(p(0.0, 0.0), p(4.0, 4.0), p(4.0, 0.0), p(0.0, 4.0))))
        assertFalse(isSimplePolygon(listOf(p(0.0, 0.0), p(1.0, 1.0), p(2.0, 2.0))))
        assertFalse(isSimplePolygon(null))
    }

    @Test fun formesEtCercle() {
        val c = CircleShape(p(0.0, 0.0), 2.0)
        assertEquals(24, shapePolygon(c).size)
        assertEquals(PI * 4, shapeArea(c), 1e-12)
        assertEquals(4.0, shapeBounds(c).width, 1e-12)
        assertTrue(shapePolygon(null).isEmpty())
        val l = LineShape(listOf(p(0.0, 0.0), p(4.0, 0.0)), 1.0)
        assertEquals(4.0, shapeArea(l), 1e-9)
    }

    @Test fun cheminEtCap() {
        assertEquals(90.0, bearing(p(0.0, 0.0), p(5.0, 0.0)), 1e-9)
        assertEquals(0.0, bearing(p(0.0, 0.0), p(0.0, -5.0)), 1e-9)
        val q = pointFromLengthBearing(p(1.0, 1.0), 5.0, 90.0)
        assertEquals(6.0, q.x, 1e-9); assertEquals(1.0, q.y, 1e-9)
    }

    @Test fun fermetureEtGps() {
        val r = closeGapReport(listOf(p(0.0, 0.0), p(10.0, 0.0), p(10.0, 8.0), p(0.0, 8.5)))
        assertEquals(8.5, r.gap, 1e-9)
        assertEquals(0.0, r.corrected.last().x, 1e-9); assertEquals(0.0, r.corrected.last().y, 1e-9)
        val o = LatLon(48.85, 2.35)
        val g = gpsToLocal(listOf(LatLon(48.8501, 2.3502)), o)
        val back = localToGps(g.points[0], o)
        assertEquals(48.8501, back.lat, 1e-9); assertEquals(2.3502, back.lon, 1e-9)
        assertTrue(abs(haversine(o, LatLon(48.86, 2.35)) - 1112.0) < 5)
    }
    private fun abs(d: Double) = kotlin.math.abs(d)

    // ---- golden
    private val g = loadGolden("geometry")

    @Test fun golden() {
        val polys = g["polys"]!!.jsonObject.mapValues { pts(it.value) }
        for ((k, v) in g["poly"]!!.jsonObject) {
            val po = polys.getValue(k)
            val o = v.jsonObject
            assertJsonClose(o["area"], jn(polygonArea(po)), "area.$k")
            assertJsonClose(o["signed"], jn(signedArea(if (po.isEmpty()) listOf(p(0.0, 0.0)) else po)), "signed.$k")
            assertJsonClose(o["perClosed"], jn(perimeter(po)), "perClosed.$k")
            assertJsonClose(o["perOpen"], jn(perimeter(po, false)), "perOpen.$k")
            assertJsonClose(o["centroid"], jp(centroid(po)), "centroid.$k")
            assertJsonClose(o["bounds"], jb(bounds(po)), "bounds.$k")
            assertEquals(o["simple"]!!.jsonPrimitive.boolean, isSimplePolygon(po), "simple.$k")
        }
        val pp = pts(g["pipPoints"]!!)
        for ((k, v) in g["pip"]!!.jsonObject) {
            val po = polys.getValue(k)
            assertEquals(v.jsonArray.map { it.jsonPrimitive.boolean }, pp.map { pointInPolygon(it, po) }, "pip.$k")
        }
        for (s in g["segs"]!!.jsonArray) {
            val q = pts(s.jsonObject["s"]!!)
            assertEquals(s.jsonObject["r"]!!.jsonPrimitive.boolean, segmentsIntersect(q[0], q[1], q[2], q[3]), "seg $q")
        }
        for ((k, v) in g["shape"]!!.jsonObject) {
            val sh = shapeOf(g["shapes"]!!.jsonObject[k]!!)
            assertJsonClose(v.jsonObject["poly24"], jpts(shapePolygon(sh)), "poly24.$k")
            assertJsonClose(v.jsonObject["poly7"], jpts(shapePolygon(sh, 7)), "poly7.$k")
            assertJsonClose(v.jsonObject["area"], jn(shapeArea(sh)), "sarea.$k")
            assertJsonClose(v.jsonObject["bounds"], jb(shapeBounds(sh)), "sbounds.$k")
        }
        val sn = g["shapeNull"]!!.jsonObject
        assertJsonClose(sn["poly"], jpts(shapePolygon(null)))
        assertJsonClose(sn["area"], jn(shapeArea(null)))
        for (o in g["overlap"]!!.jsonArray) {
            val a = polys.getValue(o.jsonObject["a"]!!.jsonPrimitive.content); val b = polys.getValue(o.jsonObject["b"]!!.jsonPrimitive.content)
            assertJsonClose(o.jsonObject["r"], jn(overlapArea(a, b)), "overlap")
        }
        assertJsonClose(g["overlapBig"], jn(overlapArea(
            listOf(p(0.0, 0.0), p(400.0, 0.0), p(400.0, 300.0), p(0.0, 300.0)), listOf(p(100.0, 100.0), p(500.0, 100.0), p(500.0, 400.0), p(100.0, 400.0)))), "overlapBig", tol = 1e-6)
        val all = polys + ("big" to pts(g["big"]!!))
        for (o in g["inside"]!!.jsonArray) {
            val a = all.getValue(o.jsonObject["a"]!!.jsonPrimitive.content); val b = all.getValue(o.jsonObject["b"]!!.jsonPrimitive.content)
            assertEquals(o.jsonObject["r"]!!.jsonPrimitive.boolean, polygonInside(a, b), "inside $o")
        }
        for (s in g["snap"]!!.jsonArray) {
            val o = s.jsonObject["o"]!!.jsonObject
            val r = snapPoint(pt(s.jsonObject["p"]!!), grid = dbl(o["grid"]), points = o["points"]?.let { pts(it) },
                tolerance = dbl(o["tolerance"]) ?: 0.15, orthoFrom = o["ortho"]?.jsonObject?.get("from")?.let { pt(it) })
            assertJsonClose(s.jsonObject["r"], jp(r), "snap $s")
        }
        for (b in g["bearing"]!!.jsonArray) {
            val o = b.jsonObject
            assertJsonClose(o["d"], jn(distance(pt(o["a"]!!), pt(o["b"]!!))), "dist")
            assertJsonClose(o["r"], jn(bearing(pt(o["a"]!!), pt(o["b"]!!))), "bearing")
        }
        for (b in g["fromBearing"]!!.jsonArray) {
            val o = b.jsonObject
            assertJsonClose(o["r"], jp(pointFromLengthBearing(pt(o["f"]!!), dbl(o["l"])!!, dbl(o["b"])!!)), "fromBearing")
        }
        for (c in g["closeGap"]!!.jsonArray) {
            val r = closeGapReport(pts(c.jsonObject["pts"]!!))
            val e = c.jsonObject["r"]!!.jsonObject
            assertJsonClose(e["gap"], jn(r.gap)); assertJsonClose(e["dx"], jn(r.dx)); assertJsonClose(e["dy"], jn(r.dy))
            assertJsonClose(e["corrected"], jpts(r.corrected), "corrected")
        }
        assertJsonClose(g["translate"], jpts(translatePolygon(polys.getValue("tilted"), 1.5, -2.25)))
        fun ll(e: JsonElement) = LatLon(e.jsonObject["lat"]!!.jsonPrimitive.double, e.jsonObject["lon"]!!.jsonPrimitive.double)
        val lls = g["latlons"]!!.jsonArray.map { ll(it) }
        for (h in g["haversine"]!!.jsonArray) assertJsonClose(h.jsonObject["r"], jn(haversine(ll(h.jsonObject["a"]!!), ll(h.jsonObject["b"]!!))), "haversine")
        assertJsonClose(g["gps"]!!.jsonObject["points"], jpts(gpsToLocal(lls).points))
        val o = LatLon(48.85, 2.35)
        assertJsonClose(g["gpsOrigin"]!!.jsonObject["points"], jpts(gpsToLocal(lls, o).points))
        assertJsonClose(g["gpsEmpty"]!!.jsonObject["points"], jpts(gpsToLocal(emptyList()).points))
        val back = gpsToLocal(lls, o).points.map { localToGps(it, o) }
        g["toGps"]!!.jsonArray.forEachIndexed { i, e ->
            assertEquals(dbl(e.jsonObject["lat"])!!, back[i].lat, 1e-9); assertEquals(dbl(e.jsonObject["lon"])!!, back[i].lon, 1e-9)
        }
    }
}
