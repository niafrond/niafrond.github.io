package fr.jardin.core.plan

import fr.jardin.core.Point
import fr.jardin.core.bounds
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PlanViewTest {
    @Test fun roundTrip() {
        val v = PlanView(cx = 3.0, cy = 2.0, scale = 40.0, width = 400.0, height = 600.0)
        val s = v.toScreen(Point(5.0, 1.0))
        val w = v.toWorld(s.x, s.y)
        assertEquals(5.0, w.x, 1e-9); assertEquals(1.0, w.y, 1e-9)
        val c = v.toScreen(Point(3.0, 2.0))
        assertEquals(200.0, c.x, 1e-9); assertEquals(300.0, c.y, 1e-9)
    }

    @Test fun zoomKeepsPointUnderFinger() {
        val v = PlanView(cx = 3.0, cy = 2.0, scale = 40.0, width = 400.0, height = 600.0)
        val before = v.toWorld(123.0, 456.0)
        val z = v.zoomAt(123.0, 456.0, 2.0)
        assertEquals(80.0, z.scale, 1e-9)
        val after = z.toWorld(123.0, 456.0)
        assertEquals(before.x, after.x, 1e-9); assertEquals(before.y, after.y, 1e-9)
    }

    @Test fun zoomIsClamped() {
        val v = PlanView().zoomAt(0.0, 0.0, 1e9)
        assertEquals(PlanView.MAX_SCALE, v.scale, 1e-9)
        assertEquals(PlanView.MIN_SCALE, PlanView().zoomAt(0.0, 0.0, 1e-9).scale, 1e-9)
    }

    @Test fun panFollowsFinger() {
        val v = PlanView(cx = 0.0, cy = 0.0, scale = 10.0)
        val p = Point(1.0, 1.0)
        val s0 = v.toScreen(p)
        val s1 = v.panBy(30.0, -20.0).toScreen(p)
        assertEquals(s0.x + 30, s1.x, 1e-9); assertEquals(s0.y - 20, s1.y, 1e-9)
    }

    @Test fun fitCentersAndContains() {
        val b = bounds(listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 5.0), Point(0.0, 5.0)))
        val v = PlanView(width = 400.0, height = 400.0).fit(b, 1.0)
        val a = v.toScreen(Point(0.0, 0.0)); val c = v.toScreen(Point(10.0, 5.0))
        assertTrue(a.x >= -1e-6 && c.x <= 400.0 + 1e-6)
        assertEquals(40.0, v.scale, 1e-9)
        // avec une barre de 100 px en bas, le contenu reste au-dessus
        val v2 = PlanView(width = 400.0, height = 400.0).fit(b, 1.0, bottomInset = 100.0)
        assertTrue(v2.toScreen(Point(0.0, 5.0)).y <= 300.0 + 1e-6)
    }
}

class PlanHitTest {
    private val sq = listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 4.0), Point(0.0, 4.0))
    @Test fun vertex() {
        assertEquals(1, PlanHit.vertexAt(sq, Point(3.9, 0.1), 0.3))
        assertEquals(-1, PlanHit.vertexAt(sq, Point(2.0, 2.0), 0.3))
    }
    @Test fun side() {
        assertEquals(0, PlanHit.sideAt(sq, true, Point(2.0, 0.1), 0.2))
        assertEquals(3, PlanHit.sideAt(sq, true, Point(0.05, 2.0), 0.2)) // côté fermant 4 -> 1
        assertEquals(-1, PlanHit.sideAt(sq, false, Point(0.05, 2.0), 0.2)) // contour ouvert : pas de côté 4 -> 1
    }
    @Test fun mid() {
        assertEquals(0, PlanHit.midAt(sq, true, Point(2.0, 0.05), 0.3, 1.0))
        assertEquals(-1, PlanHit.midAt(sq, true, Point(2.0, 0.05), 0.3, 5.0)) // côté trop court pour une poignée
    }
    @Test fun sideCount() {
        assertEquals(4, PlanHit.sideCount(4, true)); assertEquals(3, PlanHit.sideCount(4, false)); assertEquals(0, PlanHit.sideCount(1, false))
    }
}

class LengthInputTest {
    @Test fun parse() {
        assertEquals(3.5, LengthInput.parseLength("350")!!, 1e-9)
        assertEquals(3.5, LengthInput.parseLength("3,5")!!, 1e-9)
        assertEquals(3.5, LengthInput.parseLength("3,5 m")!!, 1e-9)
        assertEquals(3.5, LengthInput.parseLength("350 cm")!!, 1e-9)
        assertNull(LengthInput.parseLength("")); assertNull(LengthInput.parseLength("abc")); assertNull(LengthInput.parseLength("0")); assertNull(LengthInput.parseLength("-5"))
    }
    @Test fun format() {
        assertEquals("12,50 m", LengthInput.frLen(12.5))
        assertEquals("350", LengthInput.toCm(3.5))
        assertEquals("120,0 m²", LengthInput.frArea(120.04))
        assertEquals("48,00 m²", LengthInput.frArea(48.0))
    }
}

class ContourEditTest {
    private fun rect() = ContourEdit.rectangle(Point(0.0, 0.0), 10.0, 5.0)

    @Test fun rectangleAreaAndClosed() {
        val r = rect()
        assertTrue(r.isClosed); assertEquals(50.0, r.area, 1e-9); assertEquals(30.0, r.perimeterM, 1e-9)
    }

    @Test fun closeNeedsThreePoints() {
        val s = ContourState(listOf(Point(0.0, 0.0), Point(1.0, 0.0)))
        assertTrue(ContourEdit.tryClose(s) is CloseResult.TooFew)
        val t = ContourEdit.tryClose(ContourState(listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 3.0))), fromTap = true)
        assertTrue(t is CloseResult.Closed && t.state.isClosed)
    }

    @Test fun closeProposesGapWhenSmall() {
        val s = ContourState(listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 10.0), Point(0.0, 10.0), Point(0.0, 0.2)))
        val r = ContourEdit.tryClose(s)
        assertTrue(r is CloseResult.AskGap)
        assertTrue(ContourEdit.tryClose(s, fromTap = true) is CloseResult.Closed)
        val fixed = ContourEdit.closeWithGapDistributed(s)
        assertEquals(4, fixed.n); assertTrue(fixed.isClosed)
    }

    @Test fun setSideLengthOnRectangleKeepsRectangle() {
        val r = ContourEdit.setSideLength(rect(), 0, 12.0)
        assertTrue(ContourEdit.isRect(r))
        assertEquals(12.0, ContourEdit.sideLength(r, 0), 1e-6)
        assertEquals(60.0, r.area, 1e-6)
    }

    @Test fun setSideLengthOnPolygonShiftsFollowing() {
        val s = ContourState(listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 3.0), Point(0.0, 5.0)), true)
        val r = ContourEdit.setSideLength(s, 0, 6.0)
        assertEquals(6.0, ContourEdit.sideLength(r, 0), 1e-6)
        assertEquals(6.0, r.points[1].x, 1e-9); assertEquals(0.0, r.points[1].y, 1e-9)
        assertEquals(Point(0.0, 0.0), r.points[0])
        assertEquals(s.n, r.n)
    }

    @Test fun setSideLengthRejectsInvalid() {
        val r = rect()
        assertEquals(r, ContourEdit.setSideLength(r, 0, 0.0))
        assertEquals(r, ContourEdit.setSideLength(r, 9, 3.0))
    }

    @Test fun insertAndDelete() {
        val (s, idx) = ContourEdit.insertOnSide(rect(), 0)
        assertEquals(1, idx); assertEquals(5, s.n); assertEquals(Point(5.0, 0.0), s.points[1])
        val d = ContourEdit.deletePoint(ContourEdit.deletePoint(s, 1), 0)
        assertEquals(3, d.n); assertTrue(d.isClosed)
        assertTrue(!ContourEdit.deletePoint(d, 0).closed) // 2 sommets : plus fermé
    }

    @Test fun addSegmentFollowsBearing() {
        val s = ContourEdit.addSegment(ContourEdit.addSegment(ContourState(), 5.0, 90.0), 3.0, 180.0)
        assertEquals(listOf(Point(0.0, 0.0), Point(5.0, 0.0), Point(5.0, 3.0)), s.points)
    }

    @Test fun addPointIgnoredWhenClosed() { assertEquals(rect(), ContourEdit.addPoint(rect(), Point(50.0, 50.0))) }

    @Test fun snapOnVertexGridAndOrtho() {
        val s = ContourState(listOf(Point(0.0, 0.0), Point(4.0, 0.0)))
        assertEquals(Point(0.0, 0.0), ContourEdit.snap(Point(0.1, 0.05), s, null, tol = 0.15, from = null, useDefaultFrom = false))
        // grille 0,5
        assertEquals(Point(2.5, 3.0), ContourEdit.snap(Point(2.6, 2.9), s, 0.5, ortho = false, tol = 0.15))
        // équerre : à l'aplomb du dernier sommet (4;0), x collé à 4
        val p = ContourEdit.snap(Point(4.1, 3.0), s, null, tol = 0.15)
        assertEquals(4.0, p.x, 1e-9)
        assertEquals(3.0, p.y, 1e-9)
    }

    @Test fun snapRightAngleWithPreviousSide() {
        val s = ContourState(listOf(Point(0.0, 0.0), Point(4.0, 4.0)))
        // perpendiculaire au côté diagonal (0,0)->(4,4) en (4,4)
        val w = Point(2.0, 5.8)
        val p = ContourEdit.snap(w, s, null, tol = 0.5)
        val dot = (p.x - 4.0) * 4.0 + (p.y - 4.0) * 4.0
        assertEquals(0.0, dot, 1e-6)
    }

    @Test fun validityMessages() {
        assertEquals("Contour fermé : 50,00 m²." to "", ContourEdit.validityMessage(rect()))
        val cross = ContourState(listOf(Point(0.0, 0.0), Point(4.0, 4.0), Point(4.0, 0.0), Point(0.0, 4.0)), true)
        assertEquals("err", ContourEdit.validityMessage(cross).second)
    }

    @Test fun historyUndoRedo() {
        var h = History<Int>()
        h = h.record(1); h = h.record(2)
        val (a, h2) = assertNotNull(h.undo(3))
        assertEquals(2, a)
        val (b, _) = assertNotNull(h2.redo(a))
        assertEquals(3, b)
        assertNull(History<Int>().undo(0))
        assertEquals(History.LIMIT, (1..150).fold(History<Int>()) { acc, i -> acc.record(i) }.past.size)
    }
}

class NorthIndicatorTest {
    @Test fun labels() {
        assertEquals("Le nord est en haut du plan", NorthIndicator.label(0.0))
        assertEquals("Le nord est à droite du plan", NorthIndicator.label(90.0))
        assertEquals("Le nord est en bas à gauche du plan", NorthIndicator.label(225.0))
        assertEquals("Le nord est en haut du plan", NorthIndicator.label(359.0))
    }
    @Test fun normAndOrientation() {
        assertEquals(350, NorthIndicator.normAngle(-10.0)); assertEquals(0, NorthIndicator.normAngle(360.0)); assertNull(NorthIndicator.normAngle(null))
        assertEquals(270, NorthIndicator.orientationFor(90)); assertEquals(0, NorthIndicator.orientationFor(0))
    }
    @Test fun known() {
        assertTrue(!NorthIndicator.known(null, 0.0)); assertTrue(NorthIndicator.known("180", 0.0)); assertTrue(NorthIndicator.known(null, 45.0))
    }
}
