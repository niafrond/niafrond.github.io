/** @jest-environment jsdom */
import { mountPlants } from '../../ui/step-plants.js';
import { createGarden, createZone } from '../../model.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
function jardin(w, h) {
  const g = createGarden('Mare');
  g.context.departement = '75';
  g.boundary = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }];
  g.boundaryClosed = true;
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  const m = createZone('pond', rect(1, 1, w, h)); m.label = 'Mare';
  g.zones = [m];
  return g;
}
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let el;
beforeEach(() => { document.body.innerHTML = '<div id="toast" hidden></div>'; el = document.createElement('div'); document.body.append(el); });
const mount = (g) => mountPlants(el, { garden: g, IO: null, getPhoto: async () => null, seed: 1 });
const cards = () => [...el.querySelectorAll('.plant-card')].map((c) => c.dataset.plant);

test('petite mare : champ profondeur estimé, résumé, essences écartées avec raison', () => {
  const g = jardin(2, 2.1); // 4,2 m²
  mount(g);
  expect(el.querySelector('[data-field=pond-depth]').value).toBe('60');
  expect(el.querySelector('[data-role=pond-summary]').textContent).toMatch(/^Mare de 4,2 m², profondeur 60 cm : \d+ essences? adaptées?, \d+ écartées?\.$/);
  expect(cards()).not.toContain('h-nenuphar');
  expect(cards()).not.toContain('saule-tortueux');
  expect(cards()).toContain('h-populage');
  const ex = el.querySelector('[data-role=pond-excluded]');
  expect(ex.hidden).toBe(false);
  expect(ex.querySelector('summary').textContent).toMatch(/^Écartées pour cette mare \(\d+\)$/);
  expect(ex.querySelector('[data-plant=h-nenuphar]').textContent).toMatch(/Trop grande pour cette mare/);
  expect(ex.querySelector('[data-plant=saule-tortueux]').textContent).toMatch(/Les saules ne conviennent pas aux mares/);
  expect(ex.querySelector('[data-plant=h-jussie]')).toBeTruthy();
});

test('grande mare : le grand nénuphar est proposé', () => {
  mount(jardin(6, 5));
  expect(cards()).toContain('h-nenuphar');
  expect(cards()).not.toContain('h-jussie');
  expect(el.querySelector('[data-field=pond-depth]').value).toBe('100');
});

test('modifier la profondeur écarte le nénuphar et signale celui déjà choisi', async () => {
  const g = jardin(6, 5);
  g.zones[0].plantings = [{ plantId: 'h-nenuphar', count: 3 }];
  mount(g);
  expect(el.querySelector('[data-role=pond-alert]').hidden).toBe(true);
  const inp = el.querySelector('[data-field=pond-depth]');
  inp.value = '30'; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await wait();
  expect(g.zones[0].depth).toBe(30);
  const alert = el.querySelector('[data-role=pond-alert]');
  expect(alert.hidden).toBe(false);
  expect(alert.textContent).toMatch(/La mare a changé .*Nénuphar.* ne convient plus/);
  alert.querySelector('[data-act=pond-remove-bad]').click();
  expect(g.zones[0].plantings).toHaveLength(0);
  expect(el.querySelector('[data-role=pond-alert]').hidden).toBe(true);
});

test('bandeau après redimensionnement de la mare entre deux affichages', () => {
  const g = jardin(6, 5);
  g.zones[0].plantings = [{ plantId: 'h-nenuphar', count: 2 }];
  const un = mount(g); un();
  g.zones[0].shape = rect(1, 1, 2, 1);
  mount(g);
  const alert = el.querySelector('[data-role=pond-alert]');
  expect(alert.hidden).toBe(false);
  expect(alert.textContent).toMatch(/ne convient plus/);
});

test('autres zones : pas de bloc mare, bouton d’aperçu présent', () => {
  const g = jardin(3, 3);
  g.zones.push(createZone('midplants', rect(10, 10, 4, 3)));
  mount(g);
  expect(el.querySelector('#btn-preview').textContent).toContain('Revoir le plan et la 3D');
  const sel = el.querySelector('#zone-sel'); sel.value = g.zones[1].id; sel.dispatchEvent(new Event('change'));
  expect(el.querySelector('[data-role=pond-box]').hidden).toBe(true);
});
