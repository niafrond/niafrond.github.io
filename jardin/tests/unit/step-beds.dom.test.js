/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { mountBeds } from '../../ui/step-beds.js';
import { gardenA } from './massif-fixtures.js';
import { createGarden, createZone } from '../../model.js';

jest.setTimeout(60000);
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
async function until(fn, ms = 30000) {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) throw new Error('délai dépassé'); await wait(20); }
}

let el; let onChange; let navigate; let unmount;
const q = (s) => el.querySelector(s);
const qa = (s) => [...el.querySelectorAll(s)];
const cards = () => qa('.bed-card');
function mount(garden, opts = {}) {
  onChange = jest.fn(); navigate = jest.fn();
  unmount = mountBeds(el, { garden, onChange, navigate, getPhoto: async () => null, IO: null, ...opts });
}
async function compute() {
  click(q('[data-act=compute]'));
  await until(() => cards().length > 0 || q('[data-role=bed-message]:not([hidden])'));
  await until(() => !q('[data-act=compute]').disabled);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="toast" hidden></div>';
  el = document.createElement('div'); document.body.append(el);
});
afterEach(() => { if (unmount) unmount(); unmount = null; });

test('mode manuel : carte explicative, bouton pour passer en auto et bouton « étape suivante »', () => {
  const g = gardenA();
  g.context.bedMode = 'manual';
  mount(g);
  expect(q('[data-role=beds-manual]').textContent).toContain('Vos massifs sont dessinés à la main');
  click(q('[data-act=next]'));
  expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/\/plants$/));
  click(q('[data-act=to-auto]'));
  expect(g.context.bedMode).toBe('auto');
  expect(onChange).toHaveBeenCalled();
  expect(q('[data-role=beds-auto]')).not.toBeNull();
  expect(q('[data-act=compute]').textContent).toContain('Calculer les massifs');
});

test('mode auto : calcul → cartes, plan, calendrier, brouillon enregistré', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  mount(g);
  expect(cards()).toHaveLength(0);
  expect(q('[data-act=another]').hidden).toBe(true);
  expect(q('[data-role=bed-summary]').textContent).toMatch(/Vide à planter : \d/);
  await compute();
  const n = cards().length;
  expect(n).toBeGreaterThan(0);
  expect(qa('[data-bed-shape]')).toHaveLength(n);
  expect(q('[data-role=free-space]')).not.toBeNull();
  cards().forEach((c) => {
    expect(c.querySelector('[data-role=bed-name]').textContent).toMatch(/^Massif n°\d+/);
    expect(c.querySelectorAll('.bed-month')).toHaveLength(12);
    expect(c.querySelectorAll('.bed-month[data-on="1"]').length).toBeGreaterThan(0);
    expect(c.querySelectorAll('.bed-comp').length).toBeGreaterThan(2);
    expect(c.querySelector('[data-role=bed-why]').textContent.length).toBeGreaterThan(10);
  });
  const d = g.context.bedDraft;
  expect(d.beds).toHaveLength(n);
  expect(d.settings.coverage).toBe(50);
  expect(onChange).toHaveBeenCalled();
  expect(q('[data-act=another]').hidden).toBe(false);
  // le calcul ne touche pas aux zones tant qu'on n'a pas validé
  expect(g.zones.filter((z) => z.auto)).toHaveLength(0);
});

test('verrouiller, autre proposition (le verrouillé reste), retirer', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  mount(g);
  await compute();
  const first = cards()[0].dataset.bed;
  const others = cards().slice(1).map((c) => c.dataset.bed);
  click(cards()[0].querySelector('[data-act=lock]'));
  expect(cards()[0].classList.contains('locked')).toBe(true);
  expect(g.context.bedDraft.locked).toEqual([first]);
  const seed0 = g.context.bedDraft.seed;
  click(q('[data-act=another]'));
  await until(() => q('[data-act=compute]').disabled);
  await until(() => !q('[data-act=compute]').disabled);
  expect(g.context.bedDraft.seed).toBe(seed0 + 1);
  expect(cards()[0].dataset.bed).toBe(first);
  expect(cards()[0].classList.contains('locked')).toBe(true);
  cards().slice(1).forEach((c) => expect(others).not.toContain(c.dataset.bed));
  // retirer
  const before = cards().length;
  click(cards()[cards().length - 1].querySelector('[data-act=remove]'));
  expect(cards()).toHaveLength(before - 1);
  expect(g.context.bedDraft.beds).toHaveLength(before - 1);
});

test('autre combinaison : plantes redessinées pour ce massif seulement', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  mount(g);
  await compute();
  const ids = (c) => [...c.querySelectorAll('.bed-comp')].map((x) => x.dataset.plant).join(',');
  const a = ids(cards()[0]); const b = cards().length > 1 ? ids(cards()[1]) : null;
  click(cards()[0].querySelector('[data-act=shuffle]'));
  expect(ids(cards()[0])).not.toBe(a);
  expect(cards()[0].querySelector('.bed-alt').textContent).toMatch(/Variante/);
  if (b) expect(ids(cards()[1])).toBe(b);
});

test('valider : zones auto avec plantations, remplacement des anciens massifs, annulation', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  const manual = g.zones.map((z) => z.id);
  mount(g);
  await compute();
  const n = cards().length;
  click(q('[data-act=validate]'));
  const autos = g.zones.filter((z) => z.auto);
  expect(autos).toHaveLength(n);
  autos.forEach((z, i) => {
    expect(z.auto).toBe(true);
    expect(z.plantings.length).toBeGreaterThan(2);
    expect(z.label).toBe(`Massif n°${i + 1}`);
    expect(z.autoInfo.why.length).toBeGreaterThan(10);
  });
  expect(g.zones.filter((z) => !z.auto).map((z) => z.id)).toEqual(manual);
  expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/\/plants$/));
  // revalider : les anciens massifs auto sont remplacés, pas dupliqués
  click(q('[data-act=validate]'));
  expect(g.zones.filter((z) => z.auto)).toHaveLength(n);
  // annuler la dernière validation = revenir à l'état précédent (la 1re validation)
  expect(q('[data-act=undo-validation]').hidden).toBe(false);
  click(q('[data-act=undo-validation]'));
  expect(g.zones.filter((z) => z.auto)).toHaveLength(n);
  click(q('[data-act=undo-validation]')); // plus rien à annuler : bouton masqué
});

test('annulation : restaure exactement les zones d’avant', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  const avant = JSON.stringify(g.zones);
  mount(g);
  await compute();
  click(q('[data-act=validate]'));
  expect(g.zones.length).toBeGreaterThan(3);
  click(q('[data-act=undo-validation]'));
  expect(JSON.stringify(g.zones)).toBe(avant);
  expect(q('[data-act=undo-validation]').hidden).toBe(true);
});

test('modifier la forme : le massif devient une zone ordinaire et on ouvre l’étape Zones', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  mount(g);
  await compute();
  const n = cards().length;
  click(cards()[0].querySelector('[data-act=edit]'));
  const converted = g.zones.filter((z) => ['lowplants', 'midplants', 'tallplants'].includes(z.type));
  expect(converted).toHaveLength(1);
  expect(converted[0].auto).toBe(false);
  expect(converted[0].plantings.length).toBeGreaterThan(2);
  expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/\/zones$/));
  expect(g.context.bedDraft.beds).toHaveLength(n - 1);
});

test('jardin sans vide : message clair', async () => {
  const g = createGarden('Plein');
  g.boundary = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }];
  g.boundaryClosed = true;
  g.context.bedMode = 'auto';
  g.zones = [createZone('terrace', { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }] })];
  mount(g);
  expect(q('[data-role=bed-message]').textContent).toContain('Pas de place libre : réduisez les zones ou le mobilier');
  click(q('[data-act=compute]'));
  await until(() => !q('[data-act=compute]').disabled && !q('[data-act=compute]').disabled);
  await wait(50);
  expect(cards()).toHaveLength(0);
  expect(q('[data-role=bed-message]').textContent).toContain('Pas de place libre');
  expect(q('[data-act=validate]').hidden).toBe(true);
});

test('réglages : part du vide, palette, style conservés dans le brouillon ; les massifs déjà validés reviennent à l’ouverture', async () => {
  const g = gardenA();
  g.context.bedMode = 'auto';
  mount(g);
  click(q('[data-preset=lush]'));
  expect(g.context.bedDraft.settings.coverage).toBe(80);
  click(q('[data-palette=froid]'));
  click(q('[data-style=borders]'));
  expect(g.context.bedDraft.settings).toMatchObject({ palette: 'froid', style: 'borders' });
  await compute();
  const n = cards().length;
  click(q('[data-act=validate]'));
  unmount();
  mount(g);
  expect(cards()).toHaveLength(n);
  expect(q('[data-act=validate]').textContent).toContain('Revalider');
  // une zone supprimée dans l'étape Zones disparaît de la liste
  const z = g.zones.find((x) => x.auto);
  g.zones = g.zones.filter((x) => x !== z);
  unmount();
  mount(g);
  expect(cards()).toHaveLength(n - 1);
});
