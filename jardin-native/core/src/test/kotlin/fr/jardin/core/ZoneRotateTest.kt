package fr.jardin.core

import kotlinx.serialization.json.*
import kotlin.test.*

class ZoneRotateTest {
    private val rect = PolygonShape(listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 2.0), Point(0.0, 2.0)))

    // ---- portés de zone-rotate.test.js
    @Test fun angles() {
        assertEquals(0.0, rotationOf(rect)); assertEquals(0.0, rotationOf(CircleShape(Point(0.0, 0.0), 1.0)))
        assertEquals(270.0, norm360(-90.0)); assertEquals(0.0, norm360(360.0))
        assertEquals(90.0, rotationOf(rotateShapeBy(rect, 90.0)), 1e-6)
        assertEquals(45.0, rotationOf(rotateShapeTo(rect, 45.0)), 1e-6)
        assertFalse(isRotatable(CircleShape(Point(0.0, 0.0), 1.0))); assertTrue(isRotatable(rect))
    }

    @Test fun pivotEtRectangle() {
        val r = rotateShapeBy(rect, 90.0) as PolygonShape
        assertEquals(polygonArea(rect.points), polygonArea(r.points), 1e-9)
        val c = centroid(r.points)
        assertEquals(2.0, c.x, 1e-9); assertEquals(1.0, c.y, 1e-9)
        val re = rebuildRect(Point(5.0, 5.0), 4.0, 2.0)
        assertEquals(Point(3.0, 4.0), re[0]); assertEquals(Point(7.0, 6.0), re[2])
    }

    // ---- golden
    private val o = loadGolden("zone-rotate")
    private val shapes = o["shapes"]!!.jsonObject.mapValues { shapeOf(it.value) }
    private fun js(s: Shape): JsonElement = JardinJson.json.encodeToJsonElement(Shape.serializer(), s)
    private fun jshape(s: Shape): JsonElement = JsonObject(js(s).jsonObject.filterKeys { true })

    @Test fun golden() {
        for (e in o["norm"]!!.jsonArray) assertEquals(dbl(e.jsonObject["r"])!!, norm360(dbl(e.jsonObject["d"])!!), 1e-9)
        val tri = (shapes.getValue("tri") as PolygonShape).points
        for (e in o["rotatePoints"]!!.jsonArray) {
            val j = e.jsonObject
            assertJsonClose(j["r"], jpts(rotatePoints(tri, dbl(j["d"])!!, j["c"]?.takeIf { it !is JsonNull }?.let { pt(it) })), "rotatePoints $j")
        }
        for ((k, v) in o["center"]!!.jsonObject) assertJsonClose(v, jp(rotationCenter(shapes.getValue(k))), "center.$k")
        for ((k, v) in o["rotatable"]!!.jsonObject) assertEquals(v.jsonPrimitive.boolean, isRotatable(shapes.getValue(k)), "rotatable.$k")
        for ((k, v) in o["rotationOf"]!!.jsonObject) assertEquals(dbl(v)!!, rotationOf(shapes.getValue(k)), 1e-6, "rotationOf.$k")
        for (e in o["by"]!!.jsonArray) { val j = e.jsonObject; assertJsonClose(j["r"], jshape(rotateShapeBy(shapes.getValue(j["k"]!!.jsonPrimitive.content), dbl(j["d"])!!)), "by $j") }
        for (e in o["to"]!!.jsonArray) { val j = e.jsonObject; assertJsonClose(j["r"], jshape(rotateShapeTo(shapes.getValue(j["k"]!!.jsonPrimitive.content), dbl(j["d"])!!)), "to $j") }
        for (e in o["rect"]!!.jsonArray) { val j = e.jsonObject; assertJsonClose(j["r"], jpts(rebuildRect(pt(j["c"]!!), dbl(j["w"])!!, dbl(j["l"])!!, dbl(j["d"])!!)), "rect $j") }
        assertJsonClose(o["rectDefault"], jpts(rebuildRect(Point(1.0, 1.0), 2.0, 2.0)))
    }
}
