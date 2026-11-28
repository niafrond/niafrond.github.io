package fr.jardin.core.plan

import fr.jardin.core.*
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.assertFalse

class AmenagementEditTest {
    private fun garden(): Garden = createGarden("t").copy(
        boundary = listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 8.0), Point(0.0, 8.0)), boundaryClosed = true,
        obstacles = listOf(Obstacle(id = "h", kind = "house", points = listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(4.0, 3.0), Point(0.0, 3.0)))),
    )

    @Test fun grid_and_create() {
        val g = garden()
        val it = ItemEdit.create(g, "bench", Point(5.04, 5.02), 0.5, 0.2)
        assertEquals(5.0, it.x); assertEquals(5.0, it.y)
        assertEquals("bench", it.kind)
        val c = ItemEdit.create(g, "table_round", Point(7.0, 4.0), null, 0.2)
        assertNotNull(c.radius)
    }

    @Test fun magnet_to_boundary_side_and_rotation() {
        val g = garden()
        // banc 1,5 x 0,5 posé près du bord haut (y=0), légèrement tourné : s'aligne et se colle
        val it = ItemEdit.magnet(createItem("bench", 5.0, 0.6, 10.0), g, 0.4)
        assertEquals(0.0, it.rotation, 1e-6)
        assertEquals(0.25, it.y, 1e-6)
        // loin de tout : inchangé
        val far = createItem("bench", 7.0, 5.0, 10.0)
        assertEquals(far, ItemEdit.magnet(far, g, 0.2))
    }

    @Test fun rotate_move_resize() {
        val it = createItem("bench", 5.0, 5.0)
        assertEquals(90.0, ItemEdit.rotateBy(it, 90.0).rotation)
        assertEquals(0.0, ItemEdit.rotateBy(ItemEdit.rotateBy(it, 270.0), 90.0).rotation)
        val round = createItem("table_round", 5.0, 5.0)
        assertEquals(0.0, ItemEdit.rotateBy(round, 90.0).rotation)
        assertEquals(0.0, ItemEdit.rotateFromHandle(round, Point(9.0, 9.0)).rotation)
        // handle au-dessus (nord) = 0°, à l'est = 90°
        assertEquals(90.0, ItemEdit.rotateFromHandle(it, Point(9.0, 5.0)).rotation, 1e-6)
        assertEquals(0.0, ItemEdit.rotateFromHandle(it, Point(5.2, 1.0)).rotation, 1e-6) // 5 degrés d'écart -> aimanté à 0
        val hp = ItemEdit.handlePos(ItemEdit.rotateBy(it, 90.0), 0.5)
        assertTrue(hp.x > 5.5 && abs(hp.y - 5.0) < 1e-6)
        val r = ItemEdit.resize(it, 2.0, 1.0)
        assertEquals(2.0, r.width); assertEquals(1.0, r.depth)
        val d = ItemEdit.resize(round, 2.0, null)
        assertEquals(1.0, d.radius)
    }

    @Test fun hit_and_height() {
        var g = garden()
        val a = createItem("bench", 5.0, 5.0)
        val b = createItem("table", 5.1, 5.0)
        g = ItemEdit.upsert(ItemEdit.upsert(g, a), b)
        assertEquals(b.id, ItemEdit.hit(g, Point(5.0, 5.0), 0.1)?.id) // le dernier posé d'abord
        assertNull(ItemEdit.hit(g, Point(9.0, 7.0), 0.1))
        val (h, chk) = ItemEdit.setHeight(a, 1.2)
        assertEquals(1.2, h.height); assertTrue(chk!!.ok)
        val (h2, c2) = ItemEdit.setHeight(a, 50.0)
        assertTrue(c2!!.clamped); assertEquals(5.0, h2.height)
        assertNull(ItemEdit.setHeight(h, null).first.height)
        assertEquals(2, ItemEdit.removeItem(g, "zz").items.size)
        assertEquals(1, ItemEdit.removeItem(g, a.id).items.size)
        assertFalse(ItemEdit.isOutside(g, a))
        assertTrue(ItemEdit.isOutside(g, a.copy(x = 11.0)))
    }

    @Test fun edges() {
        var g = garden()
        g = ItemEdit.chooseEdgeKind(g, 1, "wall")
        assertEquals("wall", edgeKindOf(g, 1)); assertEquals(2.0, edgeHeightOf(g, 1))
        assertEquals("open", edgeKindOf(g, 0))
        g = ItemEdit.setEdgeHeight(g, 1, 2.5).first
        assertEquals(2.5, edgeHeightOf(g, 1))
        g = ItemEdit.chooseEdgeKind(g, 1, "wall") // même type : garde la hauteur
        assertEquals(2.5, edgeHeightOf(g, 1))
        g = ItemEdit.setEdgeMaterial(g, 1, "brick")
        assertEquals("brick", ItemEdit.edgeMaterial(g, 1))
        g = ItemEdit.applyAllEdges(g, 1)
        assertTrue((0 until 4).all { edgeKindOf(g, it) == "wall" && edgeHeightOf(g, it) == 2.5 })
        g = ItemEdit.setEdge(g, 2, "open", 0.0)
        assertEquals("open", edgeKindOf(g, 2))
        assertEquals(0, ItemEdit.hitBoundarySide(g, Point(5.0, 0.1), 0.3))
        assertEquals(-1, ItemEdit.hitBoundarySide(g, Point(5.0, 4.0), 0.3))
    }

    @Test fun free_lines_and_openings() {
        var g = garden()
        val (g2, o) = ItemEdit.addFreeLine(g, "fence", listOf(Point(5.0, 5.0), Point(9.0, 5.0)))
        g = g2
        assertEquals(1.2, o.height)
        assertEquals(o.id, ItemEdit.hitFreeLine(g, Point(7.0, 5.1), 0.3)?.id)
        g = ItemEdit.setFreeHeight(g, o.id, 1.8).first
        assertEquals(1.8, g.obstacles.first { it.id == o.id }.height)
        // un portail sur la clôture libre : supprimé avec elle
        val op = ItemEdit.placeOpening(g, "gate", Point(7.0, 5.0), 2.0)
        assertNotNull(op)
        g = ItemEdit.upsertOpening(g, op)
        assertEquals(op.id, ItemEdit.hitOpening(g, Point(7.0, 5.0), 0.2)?.id)
        val slid = ItemEdit.slideOpening(g, op, Point(8.0, 5.05), null, 0.9, 1.8, 0.0)
        assertNotNull(slid); assertTrue(slid.t > op.t)
        g = ItemEdit.removeObstacle(g, o.id)
        assertTrue(g.openings.isEmpty())
        // une porte exige une maison ou un abri
        assertTrue(ItemEdit.canPlaceOpening(garden(), "door"))
        assertFalse(ItemEdit.canPlaceOpening(garden().copy(obstacles = emptyList()), "door"))
        assertTrue(ItemEdit.hasHouse(garden()))
    }

    @Test fun existing() {
        var g = garden()
        val t = ExistingEdit.place("tree", Point(5.02, 5.02), 0.5)
        assertEquals(5.0, t.x)
        g = ExistingEdit.upsert(g, t)
        assertEquals(t.id, ExistingEdit.hit(g, Point(5.2, 5.0), 0.3)?.id)
        val m = ExistingEdit.translate(t, 1.0, 2.0)
        assertEquals(6.0, m.x); assertEquals(7.0, m.y)
        val (h, chk) = ExistingEdit.setHeight(t, 6.5)
        assertEquals(6.5, h.height); assertTrue(chk.ok)
        assertTrue(ExistingEdit.setHeight(t, 100.0).second.clamped)
        val f = ExistingEdit.fromTrace("fence", listOf(Point(1.0, 7.0), Point(3.0, 7.0), Point(3.0, 7.5)), "metal")
        assertEquals("metal", f.material); assertEquals(1.5, f.height)
        assertTrue(ExistingEdit.closesLoop("fence", f.points!!, Point(1.05, 7.0), 0.2))
        assertFalse(ExistingEdit.closesLoop("hedge", f.points!!, Point(1.05, 7.0), 0.2))
        g = ExistingEdit.upsert(g, f)
        g = ExistingEdit.remove(g, f.id)
        assertEquals(1, g.existing.size)
        assertTrue(ExistingEdit.setKeep(t, false).keep.not())
        assertEquals(8, ExistingEdit.plantResults("tree", "").size)
        assertTrue(ExistingEdit.isOutside(g, t.copy(x = 20.0)))
    }

    @Test fun snapshot_roundtrip() {
        val g = garden()
        val s = PlanSnapshot.of(g)
        val g2 = ItemEdit.upsert(g, createItem("bench", 5.0, 5.0))
        assertEquals(g, s.applyTo(g2))
    }
}

class ZoneEditTest {
    private fun garden(): Garden = createGarden("t").copy(
        boundary = listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 8.0), Point(0.0, 8.0)), boundaryClosed = true,
    )

    @Test fun add_zone_labels() {
        var g = garden()
        val (g1, z1) = ZoneEdit.addZone(g, "lawn", PolygonShape(ZoneEdit.rectPoints(Point(1.0, 1.0), Point(4.0, 3.0))))
        assertEquals("Pelouse", z1.label)
        val (g2, z2) = ZoneEdit.addZone(g1, "lawn", CircleShape(Point(7.0, 5.0), 1.0))
        assertEquals("Pelouse 2", z2.label)
        g = g2
        assertEquals(2, g.zones.size)
        assertEquals("6,00 m²", ZoneEdit.areaText(z1))
        assertEquals("inground", ZoneEdit.addZone(g, "pool", CircleShape(Point(5.0, 5.0), 1.0)).second.variant)
    }

    @Test fun draw_polygon_closes_on_first_point() {
        val closeTol = 0.3
        var d: ZoneDraft? = null
        val pts = listOf(Point(1.0, 1.0), Point(4.0, 1.0), Point(4.0, 4.0))
        for (p in pts) { val r = ZoneEdit.tap(d, "polygon", false, p, p, closeTol, 1.0); assertNull(r.finished); d = r.draft }
        // un toucher loin du 1er point ajoute un point
        d = ZoneEdit.tap(d, "polygon", false, Point(1.0, 4.0), Point(1.0, 4.0), closeTol, 1.0).draft
        assertEquals(4, d!!.points.size)
        // toucher le 1er point ferme
        val r = ZoneEdit.tap(d, "polygon", false, Point(1.1, 1.1), Point(1.1, 1.1), closeTol, 1.0)
        assertTrue(r.finished is PolygonShape)
        assertEquals(4, (r.finished as PolygonShape).points.size)
    }

    @Test fun draw_two_few_points_and_line_and_rect() {
        val d = ZoneDraft("polygon", listOf(Point(0.0, 0.0), Point(1.0, 0.0)))
        assertNotNull(ZoneEdit.finish(d, 1.0).message)
        val line = ZoneEdit.finish(ZoneDraft("line", listOf(Point(0.0, 0.0), Point(3.0, 0.0))), 0.8)
        assertEquals(0.8, (line.finished as LineShape).width)
        val r1 = ZoneEdit.tap(null, "polygon", true, Point(1.0, 1.0), Point(1.0, 1.0), 0.3, 1.0)
        assertNull(r1.finished)
        val bad = ZoneEdit.tap(r1.draft, "polygon", true, Point(1.05, 3.0), Point(1.05, 3.0), 0.3, 1.0)
        assertEquals(ZoneEdit.MSG_CORNERS_CLOSE, bad.message)
        val ok = ZoneEdit.tap(r1.draft, "polygon", true, Point(3.0, 3.0), Point(3.0, 3.0), 0.3, 1.0)
        assertEquals(4.0, shapeArea(ok.finished))
    }

    @Test fun circle_default_radius() {
        assertEquals(2.0, ZoneEdit.circleFrom(Point(3.0, 3.0), Point(3.05, 3.0), "trees").radius)
        assertEquals(1.5, ZoneEdit.circleFrom(Point(3.0, 3.0), Point(3.05, 3.0), "pool").radius)
        assertEquals(1.0, ZoneEdit.circleFrom(Point(3.0, 3.0), Point(4.0, 3.0), "lawn").radius)
    }

    @Test fun hit_handles_and_drag() {
        var g = garden()
        val (g1, z) = ZoneEdit.addZone(g, "lawn", PolygonShape(ZoneEdit.rectPoints(Point(2.0, 2.0), Point(6.0, 5.0))))
        g = g1
        assertEquals(z.id, ZoneEdit.hit(g, null, Point(3.0, 3.0), 0.2)?.id)
        assertNull(ZoneEdit.hit(g, null, Point(9.0, 7.0), 0.2))
        val hs = ZoneEdit.handles(z.shape, 0.5)
        assertEquals(4 + 4, hs.size)
        assertTrue(ZoneEdit.hitHandle(z.shape, Point(6.05, 5.0), 0.3, 0.3, 0.5) is ZoneHandle.Vertex)
        // glisser le coin 2 d'un rectangle garde un rectangle
        val moved = ZoneEdit.moveHandle(z.shape!!, ZoneHandle.Vertex(2, Point(6.0, 5.0)), Point(8.0, 6.0)) as PolygonShape
        assertTrue(ZoneEdit.isRectangle(moved.points))
        assertEquals(Point(2.0, 2.0), moved.points[0])
        assertEquals(24.0, shapeArea(moved), 1e-6)
        // milieu : insertion d'un sommet
        val ins = ZoneEdit.insertMid(z.shape!!, 0, Point(4.0, 1.0)) as PolygonShape
        assertEquals(5, ins.points.size); assertEquals(Point(4.0, 1.0), ins.points[1])
        // déplacement avec grille
        val s = ZoneEdit.bodyMove(g, z, z.shape!!, 1.04, 0.97, 0.01, 0.5) as PolygonShape
        assertEquals(3.0, s.points[0].x); assertEquals(3.0, s.points[0].y)
    }

    @Test fun body_move_snaps_to_boundary() {
        val g = garden()
        val z = createZone("lawn", PolygonShape(ZoneEdit.rectPoints(Point(2.0, 2.0), Point(4.0, 4.0))))
        val s = ZoneEdit.bodyMove(g.copy(zones = listOf(z)), z, z.shape!!, -1.95, -1.9, 0.2, null) as PolygonShape
        // le coin le plus proche (bas gauche, à 5 cm du côté gauche) colle au côté du terrain ; l'autre axe reste libre
        assertEquals(0.0, s.points[0].x, 1e-9)
        assertEquals(0.1, s.points[0].y, 1e-9)
    }

    @Test fun rotate_and_dims() {
        val g = garden()
        val z0 = createZone("terrace", PolygonShape(ZoneEdit.rectPoints(Point(2.0, 2.0), Point(6.0, 4.0))))
        val z = ZoneEdit.rotateBy(z0, 90.0)
        assertEquals(90.0, rotationOf(z.shape), 1e-4)
        assertEquals(8.0, shapeArea(z.shape), 1e-6)
        val st = rotationOf(ZoneEdit.straighten(ZoneEdit.rotateBy(z0, 10.0)).shape)
        assertTrue(st < 1e-3 || st > 359.999)
        assertNull(ZoneEdit.rotHandle(CircleShape(Point(1.0, 1.0), 1.0), 0.5))
        val (c, h) = ZoneEdit.rotHandle(z0.shape, 0.5)!!
        assertEquals(c.x, h.x); assertTrue(h.y < 2.0)
        assertEquals(15.0, ZoneEdit.snapAngle(g, 17.0, true))
        assertEquals(17.0, ZoneEdit.snapAngle(g, 17.0, false))
        assertEquals(90.0, ZoneEdit.snapAngle(g, 91.0, true)) // côtés du terrain à ±3°
        val ang = ZoneEdit.rotateDrag(g, z0.shape!!, c, h, Point(c.x + 3.0, c.y), false)
        assertEquals(90.0, ang.second, 1e-6)
        // dimensions
        val r = ZoneEdit.applyDims(z0.shape!!, w = 6.0, l = 2.0) as PolygonShape
        assertEquals(12.0, shapeArea(r), 1e-6)
        assertEquals(4.0, centroid(r.points).x, 1e-6)
        assertEquals("6,00 m × 2,00 m", ZoneEdit.dimsText(r))
        assertEquals("rayon 1,50 m", ZoneEdit.dimsText(CircleShape(Point(0.0, 0.0), 1.5)))
        assertEquals(2.0, (ZoneEdit.applyDims(CircleShape(Point(0.0, 0.0), 1.5), r = 2.0) as CircleShape).radius)
        val line = LineShape(listOf(Point(0.0, 0.0), Point(3.0, 0.0), Point(3.0, 4.0)), 1.0)
        assertEquals(7.0, (ZoneEdit.dimsOf(line) as ZoneDims.Line).len)
        assertEquals("(emprise)", ZoneEdit.dimsText(PolygonShape(listOf(Point(0.0, 0.0), Point(4.0, 0.0), Point(2.0, 3.0)))).substringAfterLast(' '))
    }

    @Test fun overlaps_and_out() {
        var g = garden()
        g = ZoneEdit.addZone(g, "lawn", PolygonShape(ZoneEdit.rectPoints(Point(1.0, 1.0), Point(5.0, 5.0)))).first
        val (g2, b) = ZoneEdit.addZone(g, "terrace", PolygonShape(ZoneEdit.rectPoints(Point(3.0, 3.0), Point(7.0, 7.0))))
        assertEquals(1, ZoneEdit.overlapIds(g2).first)
        assertTrue(ZoneEdit.warnings(g2, b).any { it.startsWith("Chevauche « Pelouse »") })
        // une zone de canopée peut se superposer
        val (g3, t) = ZoneEdit.addZone(g, "trees", CircleShape(Point(3.0, 3.0), 2.0))
        assertEquals(0, ZoneEdit.overlapIds(g3).first)
        assertTrue(ZoneEdit.warnings(g3, t).isEmpty())
        val (g4, o) = ZoneEdit.addZone(g, "lawn", PolygonShape(ZoneEdit.rectPoints(Point(8.0, 6.0), Point(12.0, 9.0))))
        assertTrue(ZoneEdit.isOut(g4, o)); assertEquals(1, ZoneEdit.outCount(g4))
        assertTrue(ZoneEdit.warnings(g4, o).contains("Dépasse du contour du terrain."))
    }

    @Test fun duplicate_remove_wished() {
        var g = garden().copy(wishedZoneTypes = listOf("lawn", "pond"))
        val (g1, z) = ZoneEdit.addZone(g, "lawn", CircleShape(Point(3.0, 3.0), 1.0))
        assertEquals(listOf("pond"), ZoneEdit.wishedToDraw(g1))
        val (g2, c) = ZoneEdit.duplicate(g1, z)
        assertEquals("Pelouse (copie)", c.label)
        assertEquals(3.5, (c.shape as CircleShape).center.x)
        assertEquals(1, ZoneEdit.remove(g2, z.id).zones.size)
        assertEquals(listOf("polygon", "circle"), ZoneEdit.shapeKinds("pool"))
        assertEquals(1.0, ZoneEdit.defaultLineWidth("path"))
        assertEquals("circle", ZoneEdit.defaultKind("trees"))
    }
}
