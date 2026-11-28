package fr.jardin.core.app

import fr.jardin.core.*
import kotlin.test.*

class StepsLotTest {
    // ---- Zones souhaitées
    @Test fun souhaitsCocherDecocherEtOrdre() {
        var g = createGarden("t")
        g = WishedStep.toggle(g, "lawn", true); g = WishedStep.toggle(g, "pond", true); g = WishedStep.toggle(g, "pond", true)
        assertEquals(listOf("pond", "lawn"), g.wishedZoneTypes)
        assertEquals("2 types de zone souhaités.", WishedStep.countText(g))
        g = WishedStep.toggle(g, "lawn", false)
        assertEquals("1 type de zone souhaité.", WishedStep.countText(g))
        assertEquals("Aucune zone cochée pour l’instant.", WishedStep.countText(createGarden("v")))
    }

    @Test fun souhaitsModeAutoMasqueLesMassifsSansPerte() {
        var g = WishedStep.toggle(createGarden("t"), "midplants", true)
        assertTrue(WishedStep.visibleTypes(g).any { it.id == "midplants" })
        g = WishedStep.setMode(g, "auto")
        assertEquals("auto", bedModeOf(g))
        assertTrue(WishedStep.visibleTypes(g).none { it.id in Massifs.FLOWER_ZONE_TYPES })
        assertEquals(0, WishedStep.shownCount(g))
        assertEquals(listOf("midplants"), g.wishedZoneTypes)
        assertEquals("manual", bedModeOf(WishedStep.setMode(g, "manual")))
    }

    // ---- Soleil
    @Test fun soleilModesEtEstimation() {
        val g = gardenA().copy(sun = SunInfo())
        assertEquals("unknown", SunStep.viewOf(g))
        assertEquals("uniform", SunStep.viewOf(SunStep.setUniform(g, "full")))
        assertEquals(SunStep.NO_LOCATION, SunStep.estimate(g).error)
        assertEquals(SunStep.NO_CONTOUR, SunStep.estimate(createGarden("v")).error)
        val located = g.copy(context = g.context.copy(location = LatLon(48.85, 2.35)))
        val e = SunStep.estimate(located, dateMillis = 1_750_000_000_000L)
        assertNull(e.error)
        val m = e.garden!!
        assertEquals("map", m.sun.mode)
        assertTrue(m.sun.regions.isNotEmpty())
        assertEquals(108.0, SunStep.areaByLevel(m).values.sum(), 1e-6)
        val r = SunStep.relevel(m, 0, "shade")
        assertEquals("shade", r.sun.regions[0].level)
        assertEquals(1, SunStep.fillAll(g, "partial").sun.regions.size)
        assertEquals("unknown", SunStep.setUnknown(m).sun.mode)
    }

    // ---- Essences : utilitaires
    @Test fun nomsDeCouleursEtFloraison() {
        assertEquals("noir", PlantsStep.colorName("#000"))
        assertEquals("blanc", PlantsStep.colorName("#ffffff"))
        assertEquals("rouge", PlantsStep.colorName("#d32f2f"))
        assertEquals("inconnue", PlantsStep.colorName("rouge"))
        assertEquals("mars à juin, septembre", PlantsStep.formatBloom(listOf(3, 4, 5, 6, 9)))
        assertEquals("mars et avril", PlantsStep.formatBloom(listOf(4, 3)))
        assertEquals("", PlantsStep.formatBloom(emptyList()))
        val p = Plant("x", "X", priceEur = 12.0, priceUnit = "plant", priceNote = "pot 3 L")
        assertEquals("≈ 12 € / plant, pot 3 L", PlantsStep.priceLabel(p))
        assertNull(PlantsStep.priceLabel(Plant("y")))
        assertEquals("#7fb069" to "#7fb069", PlantsStep.thumbColors(Plant("z")))
        assertEquals("#ff0000" to "#00ff00", PlantsStep.thumbColors(Plant("z", flowerColor = "#ff0000", foliageColor = "#00ff00")))
    }

    private fun gardenWithBed(): Garden {
        val g = gardenA()
        return g.copy(zones = g.zones + createZone("midplants", rectShape(0.5, 5.0, 2.0, 3.0)))
    }

    @Test fun listeFiltreEtRecherche() {
        val g = gardenWithBed()
        val z = g.zones.last()
        val all = PlantsStep.list(g, z, PlantFilters(), "", false)
        assertTrue(all.isNotEmpty())
        assertTrue(all.none { it.status == "discouraged" })
        val q = PlantsStep.list(g, z, PlantFilters(), "lavande", false)
        assertTrue(q.isNotEmpty() && q.size < all.size)
        val row = PlantsStep.row(g, z, all.first())
        assertTrue(row.suggestedQty >= 1)
        assertFalse(row.alreadyIn)
        val low = PlantsStep.list(g, z, PlantFilters(lowMaintenance = true), "", false)
        assertTrue(low.all { Maintenance.plantEffort(it.plant) <= 3 })
    }

    @Test fun ajoutQuantiteEtRetrait() {
        val g = gardenWithBed(); var z = g.zones.last()
        z = PlantsStep.addPlant(z, "lavande", 3)
        assertEquals(3, PlantsStep.countOf(z.plantings[0]))
        z = PlantsStep.setCount(z, 0, 0)
        assertEquals(1, PlantsStep.countOf(z.plantings[0]))
        z = PlantsStep.removeById(z, "lavande")
        assertTrue(z.plantings.isEmpty())
    }

    @Test fun hauteurModifiable() {
        val p = Catalog.getPlant("lavande") ?: Catalog.allPlants().first { it.category == "shrub" }
        val pl = Planting(p.id, count = 2)
        val e = PlantsStep.editHeight(p, pl, "80")
        assertTrue(e.ok); assertEquals(0.8, e.planting.height!!, 1e-9)
        val back = PlantsStep.editHeight(p, e.planting, "")
        assertNull(back.planting.height)
        val bad = PlantsStep.editHeight(p, pl, "abc")
        assertFalse(bad.ok); assertTrue(bad.note.isNotEmpty())
        val chk = PlantsStep.editHeight(p, pl, "99999")
        assertTrue(chk.ok); assertTrue(chk.note.isNotEmpty())
    }

    @Test fun surprendsMoiEtAnnulation() {
        val g = gardenWithBed(); val z = g.zones.last()
        val r = PlantsStep.propose(g, "zone:${z.id}", listOf(z.id), mapOf(z.id to "bucolique"), "low", null, 0, 1L, null)
        val g2 = assertNotNull(r.garden)
        val z2 = g2.zones.first { it.id == z.id }
        assertTrue(z2.plantings.isNotEmpty())
        assertEquals("bucolique", z2.ambiance)
        assertEquals("low", z2.maintenance)
        assertTrue(r.summary.contains("essence"))
        // « autre proposition » repart du même snapshot
        val r2 = PlantsStep.propose(g2, "zone:${z.id}", listOf(z.id), mapOf(z.id to "bucolique"), "low", null, 1, 1L, r.proposal)
        assertEquals(r.proposal!!.snapshot, r2.proposal!!.snapshot)
        val back = PlantsStep.undo(r2.garden!!, r2.proposal!!)
        assertTrue(back.zones.first { it.id == z.id }.plantings.isEmpty())
        // zone inconnue
        assertNull(PlantsStep.propose(g, "x", listOf("nope"), emptyMap(), null, null, 0, 1L, null).garden)
    }

    @Test fun budgetEtMare() {
        val g = gardenBig(); val pond = g.zones.first { it.type == "pond" }
        val rep = assertNotNull(PlantsStep.pond(g, pond))
        assertTrue(rep.summary.startsWith("Mare de "))
        assertNull(PlantsStep.pond(g, g.zones.first { it.type == "lawn" }))
        assertEquals("Profondeur entre 10 et 500 cm.", PlantsStep.setPondDepth(pond, "5").second)
        assertEquals(120.0, PlantsStep.setPondDepth(pond, "120").first.depth)
        val b = PlantsStep.budget(g, pond, 1.0)
        assertTrue(b.main.startsWith("Budget estimé ≈ "))
        assertNull(PlantsStep.parseBudget("0"))
        assertEquals(50.5, PlantsStep.parseBudget("50,5"))
    }

    // ---- Massifs
    @Test fun massifsCalculValidationAnnulation() {
        val g = gardenA()
        val auto = g.copy(context = g.context.copy(bedMode = "auto"))
        val o = BedsStep.compute(auto, BedsDraft())
        assertTrue(o.draft.beds.isNotEmpty(), o.message ?: "vide")
        assertTrue(o.draft.beds.all { it.bed.plantings.isNotEmpty() })
        // « autre proposition » change la graine
        val o2 = BedsStep.compute(auto, o.draft, another = true)
        assertEquals(2, o2.draft.seed)
        // verrouiller garde le massif
        val id = o2.draft.beds[0].bed.id
        val locked = BedsStep.toggleLock(o2.draft, id)
        val o3 = BedsStep.compute(auto, locked, another = true)
        assertEquals(id, o3.draft.beds[0].bed.id)
        assertTrue(o3.draft.beds[0].locked)
        // validation + annulation
        val (g2, d2, undo) = BedsStep.validate(auto, o3.draft)
        assertEquals(o3.draft.beds.size, g2.zones.count { it.auto })
        assertTrue(BedsStep.allApplied(d2))
        val (g3, d3) = BedsStep.undoValidation(g2, undo)
        assertEquals(auto.zones.size, g3.zones.size)
        assertTrue(d3.applied.isEmpty())
        // rechargement : les zones auto redeviennent des massifs validés
        val synced = BedsStep.sync(g2, BedsDraft())
        assertEquals(g2.zones.count { it.auto }, synced.beds.size)
        assertTrue(BedsStep.allApplied(synced))
        // suppression d'une zone auto -> le massif disparaît
        val killed = g2.copy(zones = g2.zones.filter { !it.auto })
        assertTrue(BedsStep.sync(killed, d2).beds.isEmpty())
    }

    @Test fun massifsAutreCombinaisonAmbianceEtForme() {
        val g = gardenA().let { it.copy(context = it.context.copy(bedMode = "auto")) }
        val d = BedsStep.compute(g, BedsDraft()).draft
        val id = d.beds[0].bed.id
        val before = d.beds[0].bed.plantings
        val s = BedsStep.reshuffle(g, d, id)
        assertEquals(d.beds.size, s.beds.size)
        assertTrue(s.beds[0].variant >= 1 || s.beds[0].bed.plantings != before)
        val a = BedsStep.setAmbiance(g, d, id, "zen")
        assertEquals("zen", a.beds[0].bed.ambiance)
        assertTrue(BedsStep.nameOf(a.beds[0], 0).contains("zen"))
        val (g2, d2) = BedsStep.editShape(g, d, id)
        assertEquals(g.zones.size + 1, g2.zones.size)
        assertTrue(g2.zones.last().auto.not())
        assertEquals(d.beds.size - 1, d2.beds.size)
        assertEquals(BedsStep.NO_CONTOUR, BedsStep.compute(createGarden("v"), BedsDraft()).message)
    }

    @Test fun massifsSansPlaceEtLegende() {
        val g = gardenA()
        val full = g.copy(zones = g.zones + createZone("terrace", rectShape(0.0, 0.0, 12.0, 9.0)))
        val o = BedsStep.compute(full, BedsDraft())
        assertTrue(o.draft.beds.isEmpty())
        assertEquals(BedsStep.NO_SPACE, o.message)
        assertTrue(BedsStep.legend(g, BedsDraft()).startsWith("Vide à planter : "))
        assertEquals("", BedsStep.totalLine(BedsDraft()))
    }

    @Test fun recalculerUnMassifAuto() {
        val g = gardenA().let { it.copy(context = it.context.copy(bedMode = "auto")) }
        val d = BedsStep.compute(g, BedsDraft()).draft
        val (g2, _, _) = BedsStep.validate(g, d)
        val z = g2.zones.first { it.auto }
        assertNotNull(PlantsStep.autoWhy(z))
        val nz = assertNotNull(PlantsStep.recalcBed(g2, z, 1))
        assertEquals(z.shape, nz.shape)
        assertTrue(nz.plantings.isNotEmpty())
        assertTrue(nz.auto)
    }
}
