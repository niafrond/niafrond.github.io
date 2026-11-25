// Plan 2D : un symbole propre à chaque port, légende avec le port, placement (haies en rang, bambous groupés, grimpantes au mur).
import { renderPlanSVG, placePlants } from '../../render.js';
import { createGarden, createZone } from '../../model.js';
import { getPlant } from '../../catalog.js';

const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
function jardinDe(plantId, count = 1, shape = rect(1, 1, 7, 7), type = 'midplants') {
  const g = createGarden('Ports');
  g.boundary = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]; g.boundaryClosed = true;
  const z = createZone(type, shape); z.id = `z-${plantId}`; z.plantings.push({ plantId, count });
  g.zones.push(z);
  return { g, z };
}
const body = (svg, id) => { const m = new RegExp(`<g data-plant="${id}"[^>]*>(.*?)</g>`, 's').exec(svg); return m ? m[0] : ''; };
const NO_LEG = { legend: false, names: false, dims: false };

describe('symboles par port', () => {
  const CAS = ['bambou-fargesia', 'cypres-de-provence', 'bouleau-verruqueux', 'h-miscanthus', 'h-hosta', 'charmille', 'clematite-viticella', 'h-fougere-male', 'pommier', 'albizia', 'h-nenuphar', 'h-tomate'];
  const rendu = {};
  for (const id of CAS) {
    const { g } = jardinDe(id, 1);
    rendu[id] = renderPlanSVG(g, { layers: NO_LEG, view: 'illustrated', month: 7 });
  }
  test('chaque port a un symbole propre (famille et dessin distincts)', () => {
    const fam = new Set(); const dessins = new Set();
    for (const id of CAS) {
      const b = body(rendu[id], id);
      expect(b).toContain('data-family=');
      fam.add(/data-family="([a-z]+)"/.exec(b)[1]);
      dessins.add(b.replace(/data-plant="[^"]*"/, '').replace(/[0-9.\-]+/g, '#'));
    }
    expect(fam.size).toBe(CAS.length);
    expect(dessins.size).toBe(CAS.length);
  });
  test('bambou : faisceau de petits cercles (chaumes) ; conifère : étoile ; haie : rang arrondi ; grimpante : tiges et support', () => {
    expect(body(rendu['bambou-fargesia'], 'bambou-fargesia')).toMatch(/data-culms="8"/);
    expect(body(rendu['cypres-de-provence'], 'cypres-de-provence')).toMatch(/data-family="column"/);
    expect(body(rendu.charmille, 'charmille')).toContain('data-row="1"');
    const cl = body(rendu['clematite-viticella'], 'clematite-viticella');
    expect(cl).toContain('stroke-dasharray'); // support (treillis / tuteur)
    expect(body(rendu['h-hosta'], 'h-hosta')).toContain('data-family="rosette"');
    expect(body(rendu['h-fougere-male'], 'h-fougere-male')).toContain('data-family="fern"');
  });
  test('caduc : branches nues l’hiver, saisons conservées', () => {
    const { g } = jardinDe('bouleau-verruqueux', 1);
    expect(renderPlanSVG(g, { layers: NO_LEG, month: 1 })).toContain('data-bare="1"');
    expect(renderPlanSVG(g, { layers: NO_LEG, month: 7 })).not.toContain('data-bare="1"');
    const { g: gp } = jardinDe('pommier', 1);
    expect(renderPlanSVG(gp, { layers: NO_LEG, month: 8 })).toContain('data-fruit="1"');
  });
});

describe('légende « Essences »', () => {
  test('le port apparaît en petit sous le nom', () => {
    const { g } = jardinDe('bambou-fargesia', 3);
    const svg = renderPlanSVG(g, { layers: { legend: true } });
    expect(svg).toMatch(/data-role="port"[^>]*>bambou</);
    const { g: g2 } = jardinDe('charmille', 4, { kind: 'line', points: [{ x: 1, y: 2 }, { x: 8, y: 2 }], width: 0.8 }, 'hedge');
    expect(renderPlanSVG(g2, { layers: { legend: true } })).toMatch(/data-role="port"[^>]*>haie taillée</);
  });
});

describe('placePlants et ports', () => {
  test('haie : plants alignés en rang le long de la plus grande dimension, même orientation', () => {
    const { g, z } = jardinDe('charmille', 8, rect(1, 3, 9, 4.5), 'hedge');
    const pl = placePlants(g, z, getPlant);
    expect(pl.length).toBeGreaterThanOrEqual(8);
    const ys = pl.map((p) => p.y); const xs = pl.map((p) => p.x);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.05);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5);
    expect(new Set(pl.map((p) => Math.round(p.rot * 100))).size).toBe(1);
    expect(pl.every((p) => p.family === 'hedge' && p.seg > 0)).toBe(true);
  });
  test('haie sur une ligne : suit la ligne et se complète pour la couvrir', () => {
    const { g, z } = jardinDe('charmille', 1, { kind: 'line', points: [{ x: 1, y: 2 }, { x: 9, y: 2 }], width: 0.8 }, 'hedge');
    const pl = placePlants(g, z, getPlant);
    expect(pl.length).toBeGreaterThan(5);
    expect(pl.every((p) => Math.abs(p.y - 2) < 0.01)).toBe(true);
  });
  test('bambous : touffes serrées (plus groupés qu’un autre arbuste)', () => {
    const etendue = (id) => { const { g, z } = jardinDe(id, 6, rect(1, 1, 9, 9)); const pl = placePlants(g, z, getPlant); return Math.max(...pl.map((p) => p.x)) - Math.min(...pl.map((p) => p.x)); };
    expect(etendue('bambou-fargesia')).toBeLessThan(etendue('lavande') * 0.8);
    const { g, z } = jardinDe('bambou-fargesia', 4, rect(1, 1, 9, 9));
    expect(placePlants(g, z, getPlant).every((p) => p.family === 'bamboo')).toBe(true);
  });
  test('grimpantes : posées contre le mur le plus proche, orientées comme lui', () => {
    const { g, z } = jardinDe('clematite-viticella', 2, rect(1, 0.8, 8, 4));
    g.obstacles.push({ id: 'mur', kind: 'wall', points: [{ x: 0, y: 0.5 }, { x: 9, y: 0.5 }], height: 2 });
    const pl = placePlants(g, z, getPlant);
    expect(pl.length).toBe(2);
    for (const p of pl) { expect(Math.abs(p.y - 0.5)).toBeLessThan(0.3); expect(p.wall).toBeTruthy(); expect(Math.abs(Math.sin(p.rot))).toBeLessThan(0.01); }
    // sans mur : pas de support mural
    g.obstacles.length = 0;
    expect(placePlants(g, z, getPlant).every((p) => !p.wall)).toBe(true);
  });
  test('couvre-sols : nappes qui se chevauchent', () => {
    const { g, z } = jardinDe('h-pervenche', 4, rect(1, 1, 5, 5));
    const pl = placePlants(g, z, getPlant);
    expect(pl.every((p) => p.family === 'creeping' || p.family === 'mat')).toBe(true);
    expect(pl[0].r).toBeGreaterThan((getPlant('h-pervenche').widthAdult || 1) / 2);
  });
});
