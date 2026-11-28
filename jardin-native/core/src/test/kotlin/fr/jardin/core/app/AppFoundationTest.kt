package fr.jardin.core.app

import fr.jardin.core.*
import java.io.File
import java.nio.file.Files
import kotlin.test.*

class AppFoundationTest {
    private fun tmp(): File = Files.createTempDirectory("jardin-test").toFile()
    private var tick = 0
    private fun repo(dir: File = tmp()) = FileGardenRepository(dir) { "2026-01-01T00:00:%02d.000Z".format(tick++) }

    private fun sample(name: String = "Test"): Garden = createGarden(name).copy(
        boundary = listOf(Point(0.0, 0.0), Point(10.0, 0.0), Point(10.0, 8.0), Point(0.0, 8.0)), boundaryClosed = true,
        context = GardenContext(region = "Bretagne", departement = "29"),
    )

    @Test fun sauveChargeListeSupprime() {
        val r = repo()
        val a = r.save(sample("A")); val b = r.save(sample("B"))
        assertEquals(listOf("B", "A"), r.list().map { it.name })
        assertEquals("A", r.load(a.id)?.name)
        assertEquals(a.boundary, r.load(a.id)?.boundary)
        r.delete(a.id)
        assertNull(r.load(a.id))
        assertEquals(listOf(b.id), r.list().map { it.id })
    }

    @Test fun idInvalideEtFichierCorrompu() {
        val dir = tmp(); val r = repo(dir)
        assertFailsWith<StorageException> { r.load("../x") }
        File(dir, "casse.json").writeText("{pas du json")
        assertTrue(r.list().isEmpty())
    }

    @Test fun dupliquer() {
        val r = repo()
        val a = r.save(sample("A").copy(status = "validated"))
        val d = assertNotNull(r.duplicate(a.id))
        assertNotEquals(a.id, d.id); assertEquals("A (variante)", d.name); assertEquals("draft", d.status)
        assertNull(r.duplicate("inconnu"))
    }

    @Test fun exportImportJson() {
        val r = repo(); val x = GardenExchange(r) { "2026-02-02T00:00:00.000Z" }
        val g = r.save(sample("Source"))
        val imp = x.importJson(x.exportJson(g))
        assertNotEquals(g.id, imp.id); assertEquals("Source", imp.name); assertEquals(g.boundary, imp.boundary)
        assertEquals(2, r.list().size)
        assertTrue(x.exportJson(g).contains("\"format\": \"jardin-v1\"") || x.exportJson(g).contains("\"format\":\"jardin-v1\""))
    }

    @Test fun importJsonErreurs() {
        val x = GardenExchange(repo())
        assertEquals("Fichier illisible : ce n'est pas du JSON valide.", assertFailsWith<StorageException> { x.importJson("nope") }.message)
        assertTrue(assertFailsWith<StorageException> { x.importJson("{\"format\":\"autre\"}") }.message!!.startsWith("Fichier non reconnu"))
        assertTrue(assertFailsWith<StorageException> { x.importJson("{\"format\":\"jardin-v1\",\"garden\":{\"id\":\"a\"}}") }.message!!.startsWith("Jardin invalide"))
    }

    @Test fun importCode() {
        val r = repo(); val x = GardenExchange(r)
        val g = sample("Via code")
        val code = x.exportCode(g)
        val imp = x.importCode("Voici : " .let { code })
        assertEquals("Via code", imp.name); assertEquals(g.boundary, imp.boundary)
        val viaLien = x.importCode(Transfer.buildShareLink(code, "https://x.github.io/jardin/"))
        assertEquals("Via code", viaLien.name)
        assertTrue(assertFailsWith<StorageException> { x.importCode("n'importe quoi") }.message!!.startsWith("Rien de reconnu"))
    }

    @Test fun reglages() {
        val dir = tmp(); val f = File(dir, "sub/settings.json"); val s = FileSettingsStore(f)
        assertEquals(Settings(), s.get())
        assertEquals(19, s.get().notifications.hour)
        val saved = s.save(Settings(notifications = NotificationSettings(enabled = true, hour = 30, minute = -4)))
        assertEquals(23, saved.notifications.hour); assertEquals(0, saved.notifications.minute)
        assertEquals(saved, FileSettingsStore(f).get())
        f.writeText("{\"notifications\":{\"enabled\":true}}")
        assertEquals(19, s.get().notifications.hour); assertTrue(s.get().notifications.enabled)
        f.writeText("illisible"); assertEquals(Settings(), s.get())
    }

    @Test fun etapes() {
        assertEquals(listOf("context", "boundary", "wished", "sun", "items", "zones", "beds", "plants", "render"), WizardSteps.ids)
        assertEquals("Zones souhaitées", WizardSteps.byId("wished").label)
        assertEquals("1/9 · Contexte", WizardSteps.title("context"))
        assertEquals("9/9 · Rendu", WizardSteps.title("render"))
        assertEquals(0, WizardSteps.indexOf("nimporte"))
        assertNull(WizardSteps.previous("context")); assertNull(WizardSteps.next("render"))
    }

    @Test fun etatAssistant() {
        var s = WizardState(sample())
        assertNull(s.previous); assertEquals("boundary", s.next?.id)
        s = s.goNext().goNext()
        assertEquals("wished", s.stepId)
        assertEquals("boundary", s.goPrevious().stepId)
        assertEquals("wished", s.goTo("inconnue").stepId)
        assertEquals("render", s.goTo("render").goNext().stepId)
        assertEquals(1f / 9, WizardState(sample()).progress)
        assertTrue(s.isComplete("boundary")); assertFalse(s.isComplete("zones"))
        assertTrue(s.notes.isNotEmpty())
    }

    @Test fun validationFinale() {
        assertFalse(WizardGuards.canValidate(createGarden()))
        assertTrue(WizardGuards.canValidate(sample()))
        assertTrue(WizardGuards.notes(createGarden(), "render").isNotEmpty())
    }

    @Test fun formulaireContexte() {
        var g = createGarden()
        g = ContextForm.withDepartement(g, "29")
        assertEquals("29", g.context.departement); assertEquals("Bretagne", g.context.region)
        g = ContextForm.withRegion(g, "Occitanie")
        assertNull(g.context.departement); assertEquals("Occitanie", g.context.region)
        assertTrue(ContextForm.departementsOf("Bretagne").all { it.region == "Bretagne" })
        assertTrue(ContextForm.regions().contains("Bretagne"))
        g = ContextForm.withOrientation(g, 135)
        assertEquals(135, ContextForm.azimuthOf(g)); assertEquals(225.0, g.context.northAngle)
        assertEquals("Sud-Est (135°)", ContextForm.orientationLabel(135))
        assertEquals("inconnue", ContextForm.orientationLabel(null))
        assertNull(ContextForm.azimuthOf(ContextForm.withOrientation(g, null)))
        assertEquals(60, ContextForm.withName(g, "x".repeat(100)).name.length)
        assertNotNull(ContextForm.hardinessText(ContextForm.withDepartement(g, "29")))
        assertNull(ContextForm.hardinessText(createGarden()))
    }

    @Test fun accueil() {
        val g = sample().copy(name = " ")
        assertEquals("Jardin sans nom", HomeModel.title(g))
        assertEquals("80 m² · Bretagne", HomeModel.subtitle(g))
        assertEquals("Contour à tracer", HomeModel.subtitle(createGarden()))
        assertEquals("Brouillon", HomeModel.badge(g))
    }
}
