import { jest } from '@jest/globals';
import { createGarden, createZone } from '../../model.js';
import { mountPlanStep } from '../../ui/plan-step.js';
import { allPlants } from '../../catalog.js';

const click = (el, sel) => el.querySelector(sel).click();
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

function jardin() {
  const g = createGarden('Dom <vues>');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  const z = createZone('midplants', { kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }] });
  const fleurs = allPlants().filter((p) => p.category === 'perennial' && p.flowerColor && p.bloom.length).slice(0, 2);
  z.plantings = fleurs.map((p) => ({ plantId: p.id, count: 6 }));
  const arbre = createZone('trees', { kind: 'circle', center: { x: 9, y: 5 }, radius: 1.5 });
  arbre.plantings = [{ plantId: allPlants().find((p) => p.category === 'tree' && p.flowerColor).id, count: 1 }];
  g.zones.push(z, arbre);
  g.obstacles.push({ id: 'm', kind: 'house', points: [{ x: 7, y: 0.5 }, { x: 11, y: 0.5 }, { x: 11, y: 2 }, { x: 7, y: 2 }], height: 5 });
  return g;
}
const mount = (g = jardin(), props = {}) => {
  const el = document.createElement('div'); document.body.append(el);
  const un = mountPlanStep(el, { garden: g, onBack() {}, ...props });
  return { el, un };
};
const svgOf = (el) => el.querySelector('[data-role=plan-content] svg').outerHTML;

describe('étape Rendu : vues et saison', () => {
  test('sélecteur de vues : dessus + 4 isométriques + 4 faces, pression visible', () => {
    const { el } = mount();
    const acts = [...el.querySelectorAll('[data-act^=vue-]')].map((b) => b.dataset.act);
    expect(acts).toEqual(['vue-top', 'vue-iso-ne', 'vue-iso-se', 'vue-iso-sw', 'vue-iso-nw', 'vue-front-s', 'vue-front-w', 'vue-front-n', 'vue-front-e']);
    expect(el.querySelector('[data-act=vue-top]').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-act=vue-iso-ne]').textContent).toBe('Iso NE');
  });

  test('changer de vue change le SVG ; plan/illustré ramène au dessus', () => {
    const { el } = mount();
    const top = svgOf(el);
    expect(el.querySelector('[data-role=plan-content] svg').getAttribute('data-view')).toBeNull();
    const vues = new Set([top]);
    for (const id of ['iso-ne', 'iso-se', 'iso-sw', 'iso-nw', 'front-s', 'front-w', 'front-n', 'front-e']) {
      click(el, `[data-act=vue-${id}]`);
      expect(el.querySelector('[data-role=plan-content] svg').getAttribute('data-view')).toBe(id);
      expect(el.querySelector(`[data-act=vue-${id}]`).getAttribute('aria-pressed')).toBe('true');
      vues.add(svgOf(el));
    }
    expect(vues.size).toBe(9);
    click(el, '[data-act=view-illustrated]');
    expect(el.querySelector('[data-role=plan-content] svg').getAttribute('data-view')).toBeNull();
    expect(el.querySelector('[data-act=view-illustrated]').getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-act=vue-top]').getAttribute('aria-pressed')).toBe('true');
  });

  test('saison : pleine floraison par défaut, mois appliqué à toutes les vues', () => {
    const { el } = mount();
    const range = el.querySelector('[data-role=season]');
    expect(range.value).toBe('0');
    expect(el.querySelector('[data-role=season-label]').textContent).toBe('Pleine floraison');
    const plein = svgOf(el);
    range.value = '1'; range.dispatchEvent(new Event('input'));
    expect(el.querySelector('[data-role=season-label]').textContent).toBe('Janv.');
    expect(svgOf(el)).not.toBe(plein);
    expect(svgOf(el)).toContain('Janvier');
    click(el, '[data-act=vue-iso-sw]');
    expect(svgOf(el)).toContain('Janvier');
    range.value = '0'; range.dispatchEvent(new Event('input'));
    expect(svgOf(el)).toContain('Pleine floraison');
  });

  test('jeunes plants et calques conservés dans toutes les vues', () => {
    const { el } = mount();
    click(el, '[data-act=vue-iso-ne]');
    const adulte = svgOf(el);
    click(el, '[data-act=age-young]');
    expect(svgOf(el)).not.toBe(adulte);
    expect(svgOf(el)).toContain('Jeunes plants');
    const legend = el.querySelector('[data-layer=legend]');
    legend.checked = false; legend.dispatchEvent(new Event('change'));
    expect(svgOf(el)).not.toContain('data-role="legend"');
    expect(el.querySelector('[data-act=zoom-in]')).not.toBeNull();
  });

  test('exports : SVG, PNG et feuille « Toutes les vues » (nom <jardin>-vues.svg)', async () => {
    const created = []; const names = [];
    const URLmock = { createObjectURL: (b) => { created.push(b); return 'blob:x'; }, revokeObjectURL() {} };
    const old = { URL: globalThis.URL.createObjectURL, rev: globalThis.URL.revokeObjectURL };
    globalThis.URL.createObjectURL = URLmock.createObjectURL; globalThis.URL.revokeObjectURL = URLmock.revokeObjectURL;
    const spy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { names.push(this.download); });
    try {
      const { el } = mount();
      expect(el.querySelector('[data-act=export-sheet]').textContent).toContain('Toutes les vues');
      click(el, '[data-act=export-svg]'); await tick(10);
      click(el, '[data-act=vue-iso-nw]');
      click(el, '[data-act=export-svg]'); await tick(10);
      click(el, '[data-act=export-sheet]'); await tick(10);
      expect(names).toEqual(['plan-dom-vues.svg', 'plan-dom-vues-iso-nw.svg', 'dom-vues-vues.svg']);
      const sheet = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(created[2]); });
      expect(sheet).toContain('<svg x=');
      expect(sheet).toContain('Dom &lt;vues&gt;');
    } finally {
      spy.mockRestore(); globalThis.URL.createObjectURL = old.URL; globalThis.URL.revokeObjectURL = old.rev;
    }
  });
});

describe('étape Rendu : validation', () => {
  test('enregistre le dessus et les 4 isométriques si la taille reste < 1,5 Mo', () => {
    const g = jardin();
    let ok = 0;
    const { el } = mount(g, { onValidate: () => ok++ });
    const range = el.querySelector('[data-role=season]');
    range.value = '6'; range.dispatchEvent(new Event('input'));
    click(el, '[data-act=validate]');
    expect(ok).toBe(1);
    expect(g.status).toBe('validated');
    expect(g.plan.svg).toContain('<svg');
    expect(g.plan.svg).toContain('Juin');
    expect(Object.keys(g.plan.views)).toEqual(['iso-ne', 'iso-se', 'iso-sw', 'iso-nw']);
    for (const svg of Object.values(g.plan.views)) expect(svg).toContain('<svg');
    const total = g.plan.svg.length + Object.values(g.plan.views).reduce((s, v) => s + v.length, 0);
    expect(total).toBeLessThan(1.5e6);
  });

  test('plan trop volumineux : seul le dessus est enregistré', () => {
    const g = jardin();
    const vivaces = allPlants().filter((p) => p.category === 'perennial');
    for (let i = 0; i < 14; i++) {
      const z = createZone('midplants', { kind: 'polygon', points: [{ x: 0.5, y: 2 }, { x: 11.5, y: 2 }, { x: 11.5, y: 7.5 }, { x: 0.5, y: 7.5 }] });
      z.plantings = [{ plantId: vivaces[i].id, count: 200 }];
      g.zones.push(z);
    }
    g.plan = { svg: null, validatedAt: null, views: { 'iso-ne': 'ancien' } };
    const { el } = mount(g);
    click(el, '[data-act=validate]');
    expect(g.status).toBe('validated');
    expect(g.plan.svg).toContain('<svg');
    expect(g.plan.views).toBeUndefined();
  });

  test('un contour non fermé bloque toujours la validation', () => {
    const g = jardin(); g.boundaryClosed = false;
    const { el } = mount(g, { onValidate() { throw new Error('non'); } });
    click(el, '[data-act=validate]');
    expect(g.status).toBe('draft');
    expect(el.querySelector('[data-role=plan-issues]').hidden).toBe(false);
  });
});
