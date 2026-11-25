// SVG bien formé (analyse XML stricte) pour toutes les vues et la feuille de contact.
import { renderViewSVG, renderContactSheet, VIEWS } from '../../render3d.js';
import { renderPlanSVG } from '../../render.js';
import { jardin, lookup } from './render-fixture.js';

function parse(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect(doc.documentElement.nodeName).toBe('svg');
  return doc;
}

describe('SVG bien formé', () => {
  test.each(VIEWS.map((v) => v.id))('vue %s (mois nul, hiver, jeunes plants, tailles mobile et bureau)', (id) => {
    for (const o of [{}, { month: 1 }, { month: 6, age: 'young' }, { width: 390, height: 844 }, { width: 1280, height: 720 }]) {
      const doc = parse(renderViewSVG(jardin(), { view: id, plantLookup: lookup, ...o }));
      expect(doc.querySelectorAll('[data-plant]').length).toBeGreaterThan(10);
    }
  });

  test('plan 2D (vues plan et illustrée) et feuille de contact', () => {
    parse(renderPlanSVG(jardin(), { view: 'plan', plantLookup: lookup, month: 7 }));
    parse(renderPlanSVG(jardin(), { view: 'illustrated', plantLookup: lookup, month: 2 }));
    const doc = parse(renderContactSheet(jardin(), { plantLookup: lookup }));
    expect(doc.querySelectorAll('svg > g > svg')).toHaveLength(5);
  });
});
