/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { mountPlants } from '../../ui/step-plants.js';
import { createGarden, createZone } from '../../model.js';
import { allPlants, getPlant } from '../../catalog.js';
import { renderPlanSVG } from '../../render.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
function jardin() {
  const g = createGarden('Test');
  g.context.departement = '75';
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  const massif = createZone('midplants', rect(0, 0, 6, 4)); massif.label = 'Massif';
  const pelouse = createZone('lawn', rect(0, 4, 12, 4)); pelouse.label = 'Pelouse';
  g.zones = [massif, pelouse];
  return g;
}
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));

let el;
beforeEach(() => {
  document.body.innerHTML = '<div id="toast" hidden></div>';
  el = document.createElement('div'); document.body.append(el);
});

function fakeIO() {
  const inst = [];
  class IO { constructor(cb) { this.cb = cb; this.els = new Set(); inst.push(this); } observe(e) { this.els.add(e); } unobserve(e) { this.els.delete(e); } disconnect() { this.els.clear(); }
    fire() { const t = [...this.els]; this.cb(t.map((target) => ({ target, isIntersecting: true }))); } }
  return { IO, inst };
}

test('vignettes : repli coloré immédiat, photo chargée seulement quand visible', async () => {
  const g = jardin();
  const { IO, inst } = fakeIO();
  const getPhoto = jest.fn(async () => ({ url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', medium: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', credit: 'Photo : Wikipédia', page: 'https://fr.wikipedia.org/wiki/X' }));
  mountPlants(el, { garden: g, onChange() {}, getPhoto, IO });
  const cards = el.querySelectorAll('.plant-card');
  expect(cards.length).toBeGreaterThan(3);
  const first = cards[0];
  expect(first.querySelector('.plant-thumb .thumb-fb')).not.toBeNull();
  expect(first.querySelector('.plant-thumb').getAttribute('aria-label')).toMatch(/^Agrandir la fiche de /);
  expect(getPhoto).not.toHaveBeenCalled();
  inst[inst.length - 1].fire();
  await wait(5);
  expect(getPhoto).toHaveBeenCalled();
  const img = first.querySelector('.plant-thumb img');
  expect(img).not.toBeNull();
  img.dispatchEvent(new Event('load'));
  expect(first.querySelector('.plant-thumb').classList.contains('has-photo') || first.querySelector('.thumb-box').classList.contains('has-photo')).toBe(true);
  expect(first.querySelector('.photo-credit').textContent).toBe('Photo : Wikipédia');
});

test('échec de photo : le repli reste, aucune exception', async () => {
  const g = jardin();
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => { throw new Error('x'); }, IO: null });
  await wait(5);
  expect(el.querySelector('.plant-card .thumb-fb')).not.toBeNull();
});

test('cartes : couleurs accessibles, floraison, hauteur, prix', () => {
  const g = jardin();
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null });
  const card = [...el.querySelectorAll('.plant-card')].find((c) => c.querySelector('[data-kind=flower]') && c.querySelector('[data-role=price]').textContent.startsWith('≈'));
  expect(card.querySelector('[data-kind=flower]').textContent).toMatch(/^Fleurs : \S/);
  expect(card.querySelector('[data-kind=foliage]').textContent).toMatch(/^Feuillage : \S/);
  expect(card.textContent).toMatch(/Floraison : /);
  expect(card.textContent).toMatch(/Hauteur adulte/);
  expect(card.querySelector('[data-role=price]').textContent).toMatch(/^≈ [\d,]+ € \/ (plant|bulbe|m²)/);
});

test('fiche détail : s’ouvre au toucher de la vignette, raisons, entretien, se ferme', async () => {
  const g = jardin();
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => ({ url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', credit: 'Photo : Wikipédia', page: 'https://fr.wikipedia.org/wiki/X' }), IO: null });
  click(el.querySelector('.plant-card .plant-thumb'));
  const d = document.querySelector('[data-role=plant-detail]');
  expect(d).not.toBeNull();
  expect(d.textContent).toMatch(/Pourquoi/);
  expect(d.textContent).toMatch(/Entretien/);
  expect(d.querySelector('.detail-photo')).not.toBeNull();
  click(d.querySelector('[data-act=close-detail]'));
  expect(document.querySelector('[data-role=plant-detail]')).toBeNull();
});

test('budget en direct : ajout/retrait, essences sans prix comptées', () => {
  const g = jardin();
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null });
  const bar = el.querySelector('#budget-bar');
  expect(bar.textContent).toMatch(/Budget estimé ≈ 0 €/);
  expect(bar.textContent).toMatch(/prix moyens en jardinerie, à titre indicatif/);
  const add = [...el.querySelectorAll('.plant-card')].find((c) => c.querySelector('[data-role=price]').textContent.startsWith('≈'));
  const unit = getPlant(add.dataset.plant);
  click(add.querySelector('.btn-primary'));
  expect(g.zones[0].plantings).toHaveLength(1);
  const n = g.zones[0].plantings[0].count;
  const expected = Math.round(n * unit.priceEur);
  expect(el.querySelector('[data-role=budget-main]').textContent).toBe(`Budget estimé ≈ ${String(expected).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`);
  // essence sans prix
  g.zones[1].plantings = [{ plantId: 'inexistante', count: 2 }];
  el.querySelector('#budget-max').dispatchEvent(new Event('input'));
  expect(el.querySelector('[data-role=budget-main]').textContent).toMatch(/· 1 essence sans prix$/);
});

test('Surprends-moi pour tout le jardin : remplit les zones vides, change à chaque appui, annulable, résumé', async () => {
  const g = jardin();
  g.zones[1].plantings = [{ plantId: 'h-gazon-rustique', count: 1 }]; // déjà remplie : conservée
  const before = JSON.stringify(g.zones);
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 7 });
  expect(el.querySelector('#btn-undo').hidden).toBe(true);
  click(el.querySelector('#btn-surprise-all'));
  await wait(5);
  expect(g.zones[0].plantings.length).toBeGreaterThan(0);
  expect(g.zones[1].plantings).toEqual([{ plantId: 'h-gazon-rustique', count: 1 }]);
  expect(el.querySelector('#proposal-summary').textContent).toMatch(/^\d+ essences?, floraison de \S+ à \S+, ≈ \d+ €$/);
  expect(el.querySelector('#btn-undo').hidden).toBe(false);
  expect(el.querySelector('#btn-surprise-all').textContent).toBe('🎲 Autre proposition');
  const seen = new Set([JSON.stringify(g.zones[0].plantings)]);
  for (let i = 0; i < 6; i++) { click(el.querySelector('#btn-surprise-all')); await wait(5); seen.add(JSON.stringify(g.zones[0].plantings)); }
  expect(seen.size).toBeGreaterThan(1);
  expect(g.zones[1].plantings).toEqual([{ plantId: 'h-gazon-rustique', count: 1 }]);
  click(el.querySelector('#btn-undo'));
  expect(JSON.stringify(g.zones)).toBe(before);
  expect(el.querySelector('#btn-undo').hidden).toBe(true);
  expect(el.querySelector('#proposal-summary').textContent).toBe('');
});

test('Surprends-moi (tout) avec zones déjà remplies : confirmation, puis annulation restaure', async () => {
  const g = jardin();
  g.zones[0].plantings = [{ plantId: allPlants()[0].id, count: 2 }];
  g.zones[1].plantings = [{ plantId: 'h-gazon-rustique', count: 1 }];
  const before = JSON.stringify(g.zones);
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 3 });
  click(el.querySelector('#btn-surprise-all'));
  await wait(5);
  const dlg = document.querySelector('[role=alertdialog]');
  expect(dlg).not.toBeNull();
  click([...dlg.querySelectorAll('button')].find((b) => b.textContent === 'Remplacer'));
  await wait(5);
  expect(JSON.stringify(g.zones)).not.toBe(before);
  click(el.querySelector('#btn-undo'));
  expect(JSON.stringify(g.zones)).toBe(before);
});

test('budget max : la proposition respecte le plafond quand c’est possible', async () => {
  const g = jardin();
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 11 });
  const input = el.querySelector('#budget-max'); input.value = '150'; input.dispatchEvent(new Event('input'));
  click(el.querySelector('#btn-surprise-all')); await wait(5);
  const m = el.querySelector('[data-role=budget-main]').textContent.match(/≈ ([\d ]+) €/);
  expect(Number(m[1].replace(/\s/g, ''))).toBeLessThanOrEqual(150);
});

test('Surprends-moi par zone conservé et annulable', async () => {
  const g = jardin();
  mountPlants(el, { garden: g, onChange() {}, getPhoto: async () => null, IO: null, seed: 5 });
  click(el.querySelector('#btn-surprise')); await wait(5);
  expect(g.zones[0].plantings.length).toBeGreaterThan(0);
  click(el.querySelector('#btn-undo'));
  expect(g.zones[0].plantings).toEqual([]);
});

test('rendu illustré : couleurs de floraison/feuillage ; budget dans le cartouche si demandé', () => {
  const g = jardin();
  const p = allPlants().find((x) => x.flowerColor && x.foliageColor && x.category === 'perennial');
  g.zones[0].plantings = [{ plantId: p.id, count: 6 }];
  const ill = renderPlanSVG(g, { view: 'illustrated' });
  expect(ill).toContain(`fill="${p.foliageColor}"`);
  expect(ill).toContain('data-flower="1"');
  expect(ill).not.toMatch(/Budget estimé/);
  const young = renderPlanSVG(g, { view: 'plan', age: 'young' });
  expect(young).toContain('data-flower="1"');
  expect(renderPlanSVG(g, { view: 'plan' })).not.toContain('data-flower');
  const b = renderPlanSVG(g, { view: 'plan', layers: { budget: true } });
  expect(b).toMatch(/Budget estimé ≈ \d+ €/);
});
