/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { bedCard, bloomCalendar, bloomMonthsOf, monthsText, settingsPanel, createThumbLoader, flowerColorsOf } from '../../ui/beds-panel.js';
import { getPlant } from '../../catalog.js';
import { createGarden } from '../../model.js';

const click = (n) => n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const bed = {
  id: 'm_1_1', role: 'bordure', areaM2: 6.4, widthM: 1.2, sunLevel: 'full',
  why: 'Bordure de 1,2 m le long de la clôture sud, plein soleil',
  plantsWhy: '8 mois de floraison (mars à octobre), 4 hauteurs',
  plantings: [{ plantId: 'h-lavande', count: 5 }, { plantId: 'h-echinacee', count: 2 }, { plantId: 'inconnue-xyz', count: 1 }],
  summary: { bloomMonths: [3, 4, 5, 6, 7, 8, 9, 10], costEur: 84.5 }, ambiance: 'bucolique', alternatives: [],
};

beforeEach(() => { document.body.innerHTML = ''; });

test('calendrier de floraison : 12 mois, barres allumées pour les mois fleuris', () => {
  const cal = bloomCalendar([3, 4, 5], { color: '#d6568a' });
  expect(cal.querySelectorAll('.bed-month')).toHaveLength(12);
  expect([...cal.querySelectorAll('.bed-month[data-on="1"]')].map((m) => m.dataset.month)).toEqual(['3', '4', '5']);
  expect(cal.querySelector('[data-month="3"] .bed-bar').style.background).not.toBe('');
  expect(cal.querySelector('[data-month="1"] .bed-bar').style.background).toBe('');
  expect(cal.getAttribute('aria-label')).toBe('Floraison : mars à mai');
  expect(monthsText([])).toBe('aucune floraison');
  expect(monthsText([3, 4, 9])).toBe('mars et avril, septembre');
});

test('mois de floraison : résumé du moteur, sinon calculés depuis les essences', () => {
  expect(bloomMonthsOf(bed)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  const p = getPlant('h-lavande') || getPlant(Object.keys({})[0]);
  const m = bloomMonthsOf({ plantings: [{ plantId: 'h-lavande', count: 1 }] });
  if (p) expect(m.length).toBeGreaterThan(0);
  expect(bloomMonthsOf({ plantings: [] })).toEqual([]);
});

test('carte : nom, surface, ensoleillement, why, couleurs, composition, coût, actions', () => {
  const on = { lock: jest.fn(), remove: jest.fn(), shuffle: jest.fn(), ambiance: jest.fn(), edit: jest.fn() };
  const card = bedCard(bed, { index: 0, name: 'Massif bucolique n°1', locked: false, color: '#e8744f' }, on);
  document.body.append(card);
  expect(card.querySelector('[data-role=bed-name]').textContent).toBe('Massif bucolique n°1');
  expect(card.textContent).toContain('6,4 m²');
  expect(card.textContent).toContain('plein soleil');
  expect(card.querySelector('[data-role=bed-why]').textContent).toContain('clôture sud');
  expect(card.querySelector('[data-role=bed-cost]').textContent).toMatch(/85|84/);
  expect(card.querySelectorAll('.bed-comp')).toHaveLength(3);
  expect(card.querySelector('.bed-comp[data-plant="inconnue-xyz"] .bed-comp-name').textContent).toBe('inconnue-xyz');
  expect(card.querySelector('.bed-comp .bed-comp-qty').textContent).toBe('× 5');
  expect(card.querySelectorAll('.bed-cal .bed-month')).toHaveLength(12);
  expect(card.querySelector('[data-role=bed-locked]')).toBeNull();
  for (const a of ['lock', 'shuffle', 'ambiance', 'edit', 'remove']) {
    click(card.querySelector(`[data-act=${a}]`));
    expect(on[a]).toHaveBeenCalledTimes(1);
  }
  expect(card.querySelector('[data-act=lock]').textContent).toContain('Garder');
});

test('carte verrouillée : cadenas, bouton « Libérer », aria-pressed', () => {
  const card = bedCard(bed, { index: 1, name: 'Massif n°2', locked: true, color: '#7a6bd6', altLabel: 'Variante froid' }, {});
  expect(card.classList.contains('locked')).toBe(true);
  expect(card.querySelector('[data-role=bed-locked]')).not.toBeNull();
  expect(card.querySelector('[data-act=lock]').getAttribute('aria-pressed')).toBe('true');
  expect(card.querySelector('[data-act=lock]').textContent).toContain('Libérer');
  expect(card.querySelector('.bed-alt').textContent).toBe('Variante froid');
  expect(card.querySelector('.bed-num').textContent).toBe('2');
});

test('vignettes : repli coloré puis photo Wikipédia quand elle est disponible', async () => {
  const getPhoto = jest.fn(async () => ({ url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }));
  const thumbs = createThumbLoader({ getPhoto, IO: null });
  const card = bedCard(bed, { index: 0, name: 'M', color: '#000' }, {}, { thumbs });
  document.body.append(card);
  const box = card.querySelector('.bed-comp .bed-thumb');
  expect(box.style.background).toContain('linear-gradient');
  await wait(10);
  const catalogued = [...card.querySelectorAll('.bed-comp')].filter((c) => getPlant(c.dataset.plant)).length;
  expect(getPhoto).toHaveBeenCalledTimes(catalogued);
  expect(card.querySelector('.bed-thumb img')).not.toBeNull();
  thumbs.destroy();
});

test('couleurs de fleurs distinctes', () => {
  const cols = flowerColorsOf(bed);
  expect(new Set(cols).size).toBe(cols.length);
  cols.forEach((c) => expect(c).toMatch(/^#/));
});

test('réglages : curseur 10–100 %, puces, style, palette, ambiance, entretien, budget', () => {
  const st = { coverage: 50, style: 'mixed', palette: 'auto', ambiance: null, budget: null };
  const g = createGarden();
  const onChange = jest.fn();
  const p = settingsPanel(st, { getMaint: () => g.context.maintenance || 'green', setMaint: (id) => { g.context.maintenance = id; }, onChange });
  document.body.append(p.el);
  const range = p.el.querySelector('[data-role=coverage]');
  expect([range.min, range.max]).toEqual(['10', '100']);
  expect(p.el.querySelector('[data-preset=balanced]').classList.contains('on')).toBe(true);
  click(p.el.querySelector('[data-preset=few]'));
  expect(st.coverage).toBe(25);
  expect(range.value).toBe('25');
  expect(p.el.querySelector('[data-role=coverage-out]').textContent).toBe('25 %');
  range.value = '65'; range.dispatchEvent(new Event('input', { bubbles: true }));
  expect(st.coverage).toBe(65);
  expect(p.el.querySelectorAll('[data-preset].on')).toHaveLength(0);
  expect([...p.el.querySelectorAll('[data-style]')].map((b) => b.textContent.trim())).toEqual(['🌿 Mixte', '▭ Bordures', '🏝 Îlots']);
  click(p.el.querySelector('[data-style=islands]'));
  expect(st.style).toBe('islands');
  expect([...p.el.querySelectorAll('[data-palette]')].map((b) => b.dataset.palette)).toEqual(['auto', 'chaud', 'froid', 'pastel', 'blanc', 'vif']);
  expect(p.el.querySelectorAll('[data-palette] .bed-pal')).toHaveLength(6);
  click(p.el.querySelector('[data-palette=pastel]'));
  expect(st.palette).toBe('pastel');
  click(p.el.querySelector('[data-role=bed-ambiance] [data-ambiance=bucolique]'));
  expect(st.ambiance).toBe('bucolique');
  click(p.el.querySelector('[data-maintenance=low]'));
  expect(g.context.maintenance).toBe('low');
  const b = p.el.querySelector('[data-role=bed-budget]');
  b.value = '250'; b.dispatchEvent(new Event('input', { bubbles: true }));
  expect(st.budget).toBe(250);
  b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true }));
  expect(st.budget).toBeNull();
  expect(onChange).toHaveBeenCalled();
});
