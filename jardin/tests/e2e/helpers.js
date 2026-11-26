// Aides partagées des tests e2e du jardin : jardin d'essai, accès à la feuille tirable de l'atelier plein écran.
export const URL = '/jardin/';
export const ORDRE = ['peek', 'half', 'full'];

/** État de la feuille (peek / half / full) ou null si l'écran n'a pas d'atelier. */
export async function etatFeuille(page) {
  const s = page.locator('[data-role=sheet]');
  return (await s.count()) ? s.first().getAttribute('data-state') : null;
}

/** L'atelier est-il en colonne à droite (paysage, écran large) ? Dans ce cas la feuille est toujours ouverte. */
export const enColonne = (page) => page.evaluate(() => {
  const g = document.querySelector('[data-role=sheet-handle]');
  return !!g && getComputedStyle(g).display === 'none';
});

/** Ouvre la feuille au moins à `min` (mi-hauteur par défaut) ; sans effet sans atelier ni en colonne. */
export async function ouvrirFeuille(page, min = 'half') {
  if ((await etatFeuille(page)) == null || (await enColonne(page))) return;
  for (let i = 0; i < 3; i++) {
    const e = await etatFeuille(page);
    if (ORDRE.indexOf(e) >= ORDRE.indexOf(min)) return;
    await page.locator('[data-role=sheet-handle]').click();
    await page.waitForTimeout(300);
  }
}

/** Replie la feuille (peek). */
export async function replierFeuille(page) {
  if ((await etatFeuille(page)) == null || (await enColonne(page))) return;
  for (let i = 0; i < 3 && (await etatFeuille(page)) !== 'peek'; i++) {
    await page.locator('[data-role=sheet-handle]').click();
    await page.waitForTimeout(300);
  }
}

/** Ouvre l'onglet « Affichage » ou « Exporter » de la feuille du Rendu. */
export async function ouvrirOnglet(page, id) {
  await page.locator(`.ws-tab[data-tab=${id}]`).click();
  await ouvrirFeuille(page);
}

/** Jardin d'essai riche : terrain 12×8, maison, zones, banc, plantes. Renvoie l'id. */
export async function jardinFixture(page, { nom = 'Jardin d’essai', plein = true } = {}) {
  await page.goto(URL);
  await page.waitForFunction(() => window.__jardin);
  return page.evaluate(async ({ nom: n, plein: p }) => {
    const { createGarden, createZone, createItem } = await import('./model.js');
    const { allPlants } = await import('./catalog.js');
    const g = createGarden(n);
    g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
    g.boundaryClosed = true;
    g.context.northAngle = 15;
    g.wishedZoneTypes = ['terrace', 'lawn', 'trees'];
    if (p) {
      g.obstacles = [{ id: 'o_maison', kind: 'house', points: [{ x: 1, y: 0.2 }, { x: 7, y: 0.2 }, { x: 7, y: 2 }, { x: 1, y: 2 }], height: 6 }];
      const poly = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
      const pelouse = createZone('lawn', poly(0.3, 4, 11.7, 7.7));
      pelouse.plantings = [{ plantId: allPlants().find((q) => q.category === 'lawn').id, count: 1 }];
      const terrasse = createZone('terrace', poly(8, 0.5, 11.5, 3.5));
      g.zones.push(pelouse, terrasse);
      g.items = [createItem('bench', 4, 3.2)];
    }
    await window.__jardin.storage.saveGarden(g);
    return g.id;
  }, { nom, plein });
}

/** Ouvre une étape du jardin et attend le sélecteur donné. */
export async function allerEtape(page, id, etape, pret) {
  await page.goto(`${URL}#/garden/${id}/${etape}`);
  await page.reload();
  await page.waitForFunction(() => window.__jardin);
  if (pret) await page.waitForSelector(pret);
  await page.waitForTimeout(400);
}
