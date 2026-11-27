// Vues isométriques : noms des plantes en pastilles SVG (mêmes groupes que la vue 3D), sans chevauchement.
import { renderViewSVG, renderContactSheet } from '../../render3d.js';
import { buildLabelGroups } from '../../gl-labels.js';
import { jardin, lookup, PLANTS } from './render-fixture.js';

const pills = (svg) => [...svg.matchAll(/<g data-role="plant-label" data-label-key="([^"]*)" data-label-plant="([^"]*)" data-label-count="(\d+)">.*?<rect data-label-rect="1" x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)".*?<text [^>]*>([^<]*)<\/text>/g)]
  .map((m) => ({ key: m[1], plant: m[2], count: +m[3], x: +m[4], y: +m[5], w: +m[6], h: +m[7], name: m[8] }));
const hit = (a, b, pad) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const view = (id, o = {}, g = jardin()) => renderViewSVG(g, { view: id, plantLookup: lookup, layers: { legend: false, cartouche: false }, ...o });

describe('renderViewSVG : noms des plantes', () => {
  test('par défaut sur les vues isométriques : une pastille par groupe, jamais une par plant', () => {
    const g = jardin();
    const groups = buildLabelGroups(g, { plantsById: lookup, age: 1, month: null });
    for (const id of ['iso-ne', 'iso-se', 'iso-sw', 'iso-nw']) {
      const ps = pills(view(id));
      expect(ps.length).toBeGreaterThan(0);
      expect(ps.length).toBeLessThanOrEqual(groups.length);
      expect(new Set(ps.map((p) => p.key)).size).toBe(ps.length); // une seule par groupe
      for (const p of ps) expect(groups.map((q) => q.key)).toContain(p.key);
      const lav = ps.filter((p) => p.plant === 'lavande');
      expect(lav.length).toBeLessThanOrEqual(1); // 12 lavandes = au plus UNE étiquette
      if (lav.length) expect(lav[0]).toMatchObject({ name: PLANTS.lavande.commonName, count: 12 });
      expect(ps.filter((p) => p.plant === 'buis').length).toBeLessThanOrEqual(1); // haie = une
    }
    // l'arbre, la haie et le massif sont tous nommés sur au moins une vue
    const all = ['iso-ne', 'iso-se', 'iso-sw', 'iso-nw'].flatMap((id) => pills(view(id)).map((p) => p.plant));
    for (const id of ['cerisier', 'buis', 'lavande']) expect(all).toContain(id);
  });

  test('aucun chevauchement (marge ≥ 4 px), toutes dans la zone du dessin, sous toutes les vues, même chargée', () => {
    const g = jardin();
    // beaucoup d'essences dans un petit espace : le désencombrement doit trancher
    const noms = ['rosier', 'buis', 'lavande', 'cerisier'];
    noms.forEach((n, i) => g.zones.push({ id: `x${i}`, type: 'midplants', label: `X${i}`, plantings: [{ plantId: n, count: 3 }], shape: { kind: 'polygon', points: [{ x: 1 + i, y: 1 }, { x: 1.8 + i, y: 1 }, { x: 1.8 + i, y: 2 }, { x: 1 + i, y: 2 }] } }));
    for (const id of ['iso-ne', 'iso-se', 'iso-sw', 'iso-nw', 'front-s', 'front-e']) {
      for (const size of [{ width: 1000, height: 760 }, { width: 420, height: 520 }]) {
        const ps = pills(view(id, size, g));
        expect(ps.length).toBeLessThanOrEqual(12);
        for (let i = 0; i < ps.length; i++) {
          expect(ps[i].x).toBeGreaterThanOrEqual(0); expect(ps[i].x + ps[i].w).toBeLessThanOrEqual(size.width);
          for (let j = i + 1; j < ps.length; j++) expect(hit(ps[i], ps[j], 4)).toBe(false);
        }
      }
    }
  });

  test('plafond réglable ; `names:false` supprime les pastilles ; la feuille de contact n’en a pas', () => {
    expect(pills(view('iso-ne', { maxNames: 1 })).length).toBeLessThanOrEqual(1);
    const off = view('iso-ne', { layers: { legend: false, cartouche: false, names: false } });
    expect(off).not.toContain('data-role="plant-label"');
    expect(renderContactSheet(jardin(), { plantLookup: lookup })).not.toContain('data-role="plant-label"');
  });

  test('nom latin en seconde ligne avec `layers.latinNames`', () => {
    const lk = (id) => ({ ...PLANTS[id], latinName: `Latinus ${id}` });
    const o = { plantLookup: lk, layers: { legend: false, cartouche: false, latinNames: true } };
    const svg = renderViewSVG(jardin(), { view: 'iso-se', ...o });
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('Latinus ');
    expect(renderViewSVG(jardin(), { view: 'iso-se', plantLookup: lk, layers: { legend: false, cartouche: false } })).not.toContain('font-style="italic"');
  });

  test('les noms de zones ne passent jamais sous une pastille', () => {
    const svg = view('iso-ne');
    const ps = pills(svg);
    for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)" font-size="11" font-weight="700" text-anchor="middle"[^>]*>([^<]*)<\/text>/g)) {
      const w = m[3].length * 11 * 0.6 + 2; const box = { x: +m[1] - w / 2, y: +m[2] - 12, w, h: 16 };
      for (const p of ps) expect(hit(box, p, 4)).toBe(false);
    }
  });

  test('jeunes plants : mêmes groupes, pastilles plus basses ; sans NaN ; échappement du nom', () => {
    const g = jardin();
    const lk = (id) => (id === 'buis' ? { ...PLANTS.buis, commonName: 'Buis <b> & "co"' } : PLANTS[id]);
    const svg = renderViewSVG(g, { view: 'iso-ne', age: 'young', plantLookup: lk, layers: { legend: false, cartouche: false } });
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    expect(svg).not.toContain('<b>');
    expect(pills(svg).length).toBeGreaterThan(0);
  });
});
