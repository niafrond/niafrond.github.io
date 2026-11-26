// Atelier plein écran : sur toute une matrice d'écrans, la page ne défile plus, la barre du bas reste joignable,
// le plan garde de la place et la feuille se tire (repliée / mi-hauteur / haute) ou devient une colonne à droite.
import { test, expect } from '@playwright/test';
import { jardinFixture, allerEtape, ouvrirFeuille, replierFeuille, ouvrirOnglet, etatFeuille, enColonne } from './helpers.js';

// WebGL logiciel (SwiftShader) pour la vue 3D ; même réglage que vue3d.spec.js
test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });

const ECRANS = [[360, 640], [390, 844], [412, 915], [360, 500], [320, 568], [800, 360], [844, 390], [768, 1024], [1280, 800]];
const ETAPES = [
  { id: 'boundary', pret: '[data-role=contour-editor]' },
  { id: 'items', pret: '[data-role=items-editor]' },
  { id: 'zones', pret: '[data-role=zone-editor]' },
  { id: 'sun', pret: '[data-role=sun-painter]' },
  { id: 'beds', pret: '[data-role=beds-auto]' },
  { id: 'render', pret: '[data-role=plan-step]' },
];

/** Jardin d'essai pour la matrice : carte du soleil peinte et massifs calculés par l'app. */
async function jardin(page) {
  const id = await jardinFixture(page);
  await page.evaluate(async (i) => {
    const g = await window.__jardin.storage.getGarden(i);
    g.sun = { mode: 'map', uniform: null, regions: [] };
    g.context.bedMode = 'auto';
    await window.__jardin.storage.saveGarden(g);
  }, id);
  return id;
}

/** Les boutons de la barre du bas sont entièrement dans l'écran et rien ne les recouvre. */
async function verifierBarreDuBas(page) {
  const infos = await page.evaluate(() => {
    const W = window.innerWidth; const H = window.innerHeight;
    return [...document.querySelectorAll('.wizard-nav .btn')].map((b) => {
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { txt: b.textContent.trim(), bottom: r.bottom, right: r.right, left: r.left, top: r.top, h: r.height, w: r.width, ok: top === b || b.contains(top), W, H };
    });
  });
  expect(infos.length, 'la barre du bas a des boutons').toBeGreaterThan(0);
  for (const i of infos) {
    expect(i.bottom, `bas de « ${i.txt} »`).toBeLessThanOrEqual(i.H + 0.5);
    expect(i.right, `droite de « ${i.txt} »`).toBeLessThanOrEqual(i.W + 0.5);
    expect(i.left).toBeGreaterThanOrEqual(-0.5);
    expect(i.top).toBeGreaterThanOrEqual(0);
    expect(i.h, `hauteur de « ${i.txt} »`).toBeGreaterThanOrEqual(40);
    expect(i.ok, `« ${i.txt} » est recouvert`).toBe(true);
  }
}

for (const [w, h] of ECRANS) {
  test.describe(`écran ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    for (const etape of ETAPES) {
      test(`${etape.id} : barre du bas, pas de défilement, plan assez grand`, async ({ page }) => {
        const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
        const id = await jardin(page);
        await allerEtape(page, id, etape.id, etape.pret);
        await replierFeuille(page);
        await page.waitForTimeout(350);

        await verifierBarreDuBas(page);
        const sc = await page.evaluate(() => ({ s: document.scrollingElement.scrollHeight, h: window.innerHeight, sx: document.scrollingElement.scrollWidth, w: window.innerWidth }));
        expect(sc.s, 'la page défile').toBeLessThanOrEqual(sc.h + 1);
        expect(sc.sx).toBeLessThanOrEqual(sc.w + 1);

        const colonne = await enColonne(page);
        const cv = await page.locator('.ws-canvas').first().boundingBox();
        expect(cv, 'zone de dessin').toBeTruthy();
        if (colonne) expect(cv.width).toBeGreaterThanOrEqual(0.6 * w);
        else expect(cv.height).toBeGreaterThanOrEqual(0.4 * h);
        expect(cv.y + cv.height).toBeLessThanOrEqual(h + 1);
        expect(errors).toEqual([]);
      });
    }
  });
}

test.describe('feuille tirable (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('glisser la poignée change l’état, un toucher passe à la hauteur suivante, Échap replie', async ({ page }) => {
    const id = await jardin(page);
    await allerEtape(page, id, 'zones', '[data-role=zone-editor]');
    await replierFeuille(page);
    expect(await etatFeuille(page)).toBe('peek');
    const poignee = page.locator('[data-role=sheet-handle]');
    let b = await poignee.boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(24);
    const glisser = async (dy) => {
      b = await poignee.boundingBox();
      const x = b.x + b.width / 2; const y = b.y + b.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 6; i++) await page.mouse.move(x, y + (dy * i) / 6);
      await page.mouse.up();
      await page.waitForTimeout(350);
    };
    await glisser(-160);
    expect(['half', 'full']).toContain(await etatFeuille(page));
    await glisser(-400);
    expect(await etatFeuille(page)).toBe('full');
    await glisser(600);
    expect(await etatFeuille(page)).toBe('peek');
    // toucher : repliée → mi-hauteur → haute → repliée
    await poignee.click(); await page.waitForTimeout(300);
    expect(await etatFeuille(page)).toBe('half');
    await poignee.click(); await page.waitForTimeout(300);
    expect(await etatFeuille(page)).toBe('full');
    // clavier : flèche bas puis Échap
    await poignee.focus();
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
    expect(await etatFeuille(page)).toBe('half');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    expect(await etatFeuille(page)).toBe('peek');
    await expect(poignee).toHaveAttribute('aria-expanded', 'false');
  });

  test('sélectionner une zone ouvre la feuille à mi-hauteur, désélectionner la replie', async ({ page }) => {
    const id = await jardin(page);
    await allerEtape(page, id, 'zones', '[data-role=zone-editor]');
    await replierFeuille(page);
    const projeter = () => page.evaluate(() => {
      const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect();
      const k = Math.min(r.width / vb.width, r.height / vb.height);
      return { ox: r.left + (r.width - vb.width * k) / 2, oy: r.top + (r.height - vb.height * k) / 2, k, vx: vb.x, vy: vb.y };
    });
    const clic = async (x, y) => { const p = await projeter(); await page.mouse.click(p.ox + (x - p.vx) * p.k, p.oy + (y - p.vy) * p.k); await page.waitForTimeout(350); };
    await clic(5, 6);
    await expect(page.locator('[data-role=zone-panel]')).toBeVisible();
    expect(await etatFeuille(page)).toBe('half');
    await clic(5, 3);
    await expect(page.locator('[data-role=zone-panel]')).toBeHidden();
    expect(await etatFeuille(page)).toBe('peek');
  });

  test('le champ actif de la feuille reste visible, aussi quand le clavier réduit la zone visible', async ({ page }) => {
    const id = await jardin(page);
    await allerEtape(page, id, 'zones', '[data-role=zone-editor]');
    await replierFeuille(page);
    const p = await page.evaluate(() => { const s = document.querySelector('.jd-svg'); const vb = s.viewBox.baseVal; const r = s.getBoundingClientRect(); const k = Math.min(r.width / vb.width, r.height / vb.height); return { x: r.left + (r.width - vb.width * k) / 2 + (5 - vb.x) * k, y: r.top + (r.height - vb.height * k) / 2 + (6 - vb.y) * k }; });
    await page.mouse.click(p.x, p.y);
    const champ = page.locator('[data-role=zone-name]');
    await expect(champ).toBeVisible();
    await champ.focus();
    // clavier simulé : visualViewport réduit de 320 px
    await page.evaluate(() => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - 320 });
      vv.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.app.ws-on')).toHaveClass(/ws-kb/);
    const vis = await page.evaluate(() => {
      const f = document.querySelector('[data-role=zone-name]').getBoundingClientRect();
      const s = document.querySelector('.ws-inner').getBoundingClientRect();
      const vh = window.innerHeight - 320;
      return { fTop: f.top, fBottom: f.bottom, sTop: s.top, sBottom: s.bottom, vh, appH: document.querySelector('.app.ws-on').getBoundingClientRect().height };
    });
    expect(vis.fBottom).toBeLessThanOrEqual(vis.vh + 1);
    expect(vis.fTop).toBeGreaterThanOrEqual(vis.sTop - 1);
    expect(vis.fBottom).toBeLessThanOrEqual(vis.sBottom + 1);
    expect(vis.appH).toBeLessThanOrEqual(vis.vh + 1);
    // le plan reste là, en retrait
    const cv = await page.locator('.ws-canvas').first().boundingBox();
    expect(cv.height).toBeGreaterThan(40);
  });

  test('menu « ⋯ », sélecteur d’étapes, plein écran', async ({ page }) => {
    const id = await jardin(page);
    await allerEtape(page, id, 'zones', '[data-role=zone-editor]');
    await page.locator('[data-role=ws-menu-btn]').click();
    await expect(page.locator('[data-role=ws-menu]')).toBeVisible();
    await page.locator('[data-act=menu-steps]').click();
    await expect(page.locator('[data-role=step-picker]')).toBeVisible();
    await page.locator('[data-step-pick=boundary]').click();
    await expect(page).toHaveURL(/\/boundary$/);
    await page.waitForSelector('[data-role=contour-editor]');
    await page.locator('[data-role=step-title-btn]').click();
    await expect(page.locator('[data-role=step-picker]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('[data-role=ws-menu-btn]').click();
    await page.locator('[data-act=menu-fullscreen]').click();
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.steps')).toBeHidden();
    await page.locator('[data-role=ws-exit-full]').click();
    await expect(page.locator('.topbar')).toBeVisible();
  });

  test('un clic sur un segment de progression change d’étape', async ({ page }) => {
    const id = await jardin(page);
    await allerEtape(page, id, 'zones', '[data-role=zone-editor]');
    const seg = page.locator('.step[data-step=wished]');
    const b = await seg.boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(24);
    await seg.click();
    await expect(page).toHaveURL(/\/wished$/);
    // étape qui défile : plus d'atelier
    await expect(page.locator('.app.ws-on')).toHaveCount(0);
  });
});

for (const [w, h] of [[360, 640], [800, 360]]) {
  test.describe(`Rendu ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test('« Valider le plan » et l’onglet « Exporter » sont joignables', async ({ page }) => {
      const id = await jardin(page);
      await allerEtape(page, id, 'render', '[data-role=plan-step]');
      const valider = page.locator('.wizard-nav [data-act=validate]');
      await expect(valider).toBeVisible();
      const bb = await valider.boundingBox();
      expect(bb.y + bb.height).toBeLessThanOrEqual(h + 1);
      await expect(page.locator('.wizard-nav [data-act=back]')).toBeVisible();
      await ouvrirOnglet(page, 'export');
      for (const act of ['export-pdf', 'export-svg', 'export-png', 'export-sheet']) {
        const el = page.locator(`[data-act=${act}]`);
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        expect(box.y + box.height, act).toBeLessThanOrEqual(h + 1);
        expect(await el.evaluate((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === t || e.contains(t); }), act).toBe(true);
      }
      await ouvrirOnglet(page, 'view');
      await expect(page.locator('[data-act=view-illustrated]')).toBeVisible();
      await expect(page.locator('[data-role=season]')).toBeVisible();
    });
  });
}

// ---------- plein cadre : aperçu plan/3D, relevé GPS guidé, vue 3D ----------
const dansEcran = (page, sel) => page.locator(sel).first().evaluate((e) => {
  const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, ok: e === t || e.contains(t), W: window.innerWidth, H: window.innerHeight };
});
const verifier = (r, nom) => {
  expect(r.top, `${nom} : haut`).toBeGreaterThanOrEqual(0);
  expect(r.bottom, `${nom} : bas`).toBeLessThanOrEqual(r.H + 0.5);
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeLessThanOrEqual(r.W + 0.5);
  expect(r.ok, `${nom} recouvert`).toBe(true);
};

for (const [w, h] of [[360, 640], [800, 360]]) {
  test.describe(`plein cadre ${w}×${h}`, () => {
    test.use({ viewport: { width: w, height: h }, permissions: ['geolocation'], geolocation: { latitude: 47.2184, longitude: -1.5536, accuracy: 3 } });

    test('aperçu plan et 3D : « Fermer » et les onglets sont joignables', async ({ page }) => {
      const id = await jardinFixture(page);
      await allerEtape(page, id, 'plants', '#btn-preview');
      await page.locator('#btn-preview').scrollIntoViewIfNeeded();
      await page.locator('#btn-preview').click();
      await expect(page.locator('[data-role=preview-overlay]')).toBeVisible();
      verifier(await dansEcran(page, '[data-act=preview-close]'), 'Fermer l’aperçu');
      verifier(await dansEcran(page, '.pv-tabs .pv-btn'), 'onglet de l’aperçu');
      const hauteur = await page.locator('.pv-view').first().boundingBox();
      expect(hauteur.height).toBeGreaterThan(100);
      await page.locator('[data-act=preview-close]').click();
      await expect(page.locator('[data-role=preview-overlay]')).toHaveCount(0);
    });

    test('relevé GPS guidé : consignes, « Mettre un point ici » et quitter restent joignables', async ({ page }) => {
      await page.addInitScript(() => { window.__JARDIN_GPS = { captureMs: 700 }; });
      const id = await jardinFixture(page, { nom: 'GPS', plein: false });
      await page.evaluate(async (i) => { const g = await window.__jardin.storage.getGarden(i); g.boundary = []; g.boundaryClosed = false; await window.__jardin.storage.saveGarden(g); }, id);
      await allerEtape(page, id, 'boundary', '[data-role=contour-editor]');
      await ouvrirFeuille(page);
      await page.locator('[data-act=start-gps]').click();
      await expect(page.locator('.jd-survey-on')).toBeVisible();
      await page.waitForTimeout(400);
      verifier(await dansEcran(page, '[data-act=survey-point]'), 'Mettre un point ici');
      const quit = page.locator('.jd-survey-on button', { hasText: /Quitter|Annuler|Fermer|Arrêter/ }).first();
      if (await quit.count()) verifier(await dansEcran(page, '.jd-survey-on .jd-shead button'), 'bouton de l’en-tête du relevé');
    });
  });
}

test.describe('vue 3D (téléphone) : « Fermer » dans la zone de sécurité', () => {
  const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  test.use({ userAgent: UA_ANDROID, hasTouch: true, isMobile: true});
  for (const [w, h] of [[360, 640], [800, 360]]) {
    test(`${w}×${h}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: w, height: h });
      const id = await jardinFixture(page);
      await page.goto('/jardin/?3d=1');
      await page.waitForFunction(() => window.__jardin);
      await page.evaluate(async (i) => {
        const g = await window.__jardin.storage.getGarden(i);
        const { mountView3D } = await import('./ui/view3d.js');
        const div = document.createElement('div'); document.body.appendChild(div);
        window.__un = mountView3D(div, { garden: g, onClose() { window.__closed = true; window.__un(); } });
        await window.__un.ready;
      }, id);
      await page.waitForSelector('[data-role=view3d] [data-act=close]');
      verifier(await dansEcran(page, '[data-act=close]'), 'Fermer la vue 3D');
      verifier(await dansEcran(page, '[data-act=toggle-panel]'), 'bouton des réglages 3D');
    });
  }
});
