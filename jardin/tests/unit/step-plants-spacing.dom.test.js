/** @jest-environment jsdom */
import { mountPlants } from '../../ui/step-plants.js';
import { createGarden, createZone } from '../../model.js';
import { checkSpacing } from '../../spacing.js';
import { getPlant } from '../../catalog.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
let el;
beforeEach(() => { document.body.innerHTML = '<div id="toast" hidden></div>'; el = document.createElement('div'); document.body.append(el); });

function setup(plantings) {
  const g = createGarden('Test'); g.context.departement = '75';
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  const z = createZone('midplants', rect(0, 0, 2, 2)); z.id = 'zm'; z.plantings = plantings;
  g.zones = [z];
  mountPlants(el, { garden: g, onChange() {}, IO: null });
  return { g, z };
}

test('indicateur de densité par ligne et aucun avertissement quand tout tient', () => {
  setup([{ plantId: 'h-lavande', count: 5 }]);
  const d = el.querySelector('[data-role=density]');
  expect(d.textContent).toMatch(/^\d+ cm entre plants ; 5 \/ \d+ maximum$/);
  expect(el.querySelectorAll('[data-role=spacing-warning]')).toHaveLength(0);
  expect(el.querySelector('[data-act=spacing-fix]')).toBeNull();
});

test('trop de plants : avertissement, bouton « Ajuster automatiquement » qui ramène à la capacité', () => {
  const { g, z } = setup([{ plantId: 'h-lavande', count: 60 }]);
  const w = el.querySelectorAll('[data-role=spacing-warning]');
  expect(w.length).toBeGreaterThan(0);
  expect(w[0].textContent).toMatch(/60 plants ne tiennent pas/);
  expect(el.querySelector('[data-role=density]').classList.contains('over')).toBe(true);
  const btn = el.querySelector('[data-act=spacing-fix]');
  expect(btn.textContent).toBe('Ajuster automatiquement');
  click(btn);
  expect(z.plantings[0].count).toBeLessThan(60);
  expect(checkSpacing(g, z, getPlant).filter((x) => x.kind === 'surdensite')).toEqual([]);
  expect(el.querySelectorAll('[data-role=spacing-warning]')).toHaveLength(0);
  expect(el.querySelector('[data-act=spacing-fix]')).toBeNull();
});

test('les ± avertissent sans bloquer', () => {
  const { z } = setup([{ plantId: 'h-lavande', count: 5 }]);
  const plus = el.querySelector('[aria-label=Plus]');
  for (let i = 0; i < 40; i++) click(plus);
  expect(z.plantings[0].count).toBe(45);
  expect(el.querySelectorAll('[data-role=spacing-warning]').length).toBeGreaterThan(0);
});
