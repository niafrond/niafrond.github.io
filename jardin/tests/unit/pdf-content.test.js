import { inflateSync } from 'node:zlib';
import { createGarden, createZone, createItem } from '../../model.js';
import { allPlants, getPlant } from '../../catalog.js';
import { gardenCost } from '../../pricing.js';
import { buildGardenPdf, speciesNumbering, buildElements, PdfAbort } from '../../pdf-content.js';
import { winAnsiBytes } from '../../pdf-writer.js';

const r = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
const by = (c) => allPlants().filter((p) => p.category === c && p.flowerColor && p.bloom && p.bloom.length && typeof p.priceEur === 'number');
function jardin() {
  const g = createGarden('Jardin de Léa');
  g.context = { ...g.context, departement: '75', region: 'Île-de-France', soil: 'loam' };
  g.boundary = r(0, 0, 14, 9).points; g.boundaryClosed = true;
  g.boundaryEdges = [{ kind: 'fence', material: 'wood' }, { kind: 'wall', material: 'stone' }];
  const ter = createZone('terrace', r(9, 5, 5, 4)); ter.label = 'Terrasse';
  const mas = createZone('midplants', r(0, 0, 8, 3)); mas.label = 'Massif'; mas.plantings = by('perennial').slice(0, 3).map((p, i) => ({ plantId: p.id, count: 4 + i }));
  const arb = createZone('trees', { kind: 'circle', center: { x: 11, y: 2.5 }, radius: 2 }); arb.label = 'Arbres'; arb.plantings = [{ plantId: by('tree')[0].id, count: 1 }];
  g.zones = [ter, mas, arb];
  g.items = [createItem('bench', 3, 4), createItem('pergola', 11, 6)];
  g.obstacles = [{ id: 'm', kind: 'house', points: r(9.5, 4.2, 4, 0.8).points, height: 6 }];
  return g;
}
const png = () => ({ type: 'rgb', width: 2, height: 2, data: new Uint8Array(12).fill(180) });
const makeEnv = (extra = {}) => { const calls = []; return { calls, rasterize: async (svg, o) => { calls.push({ svg, o }); return png(); }, now: new Date('2026-05-10T10:00:00Z'), ...extra }; };

function textOf(bytes) {
  const s = Buffer.from(bytes).toString('latin1'); let all = '';
  for (const m of s.matchAll(/stream\n/g)) {
    const start = m.index + 7; const end = s.indexOf('\nendstream', start);
    try { all += Buffer.from(inflateSync(Buffer.from(bytes.subarray(start, end)))).toString('latin1') + '\n'; } catch { if (!s.slice(start, start + 3000).includes('\u0000')) all += s.slice(start, end) + '\n'; }
  }
  return all;
}
const has = (all, txt) => all.includes(Buffer.from(winAnsiBytes(txt)).toString('latin1').replace(/[^\x20-\x7e]/g, (c) => `\\${c.charCodeAt(0).toString(8).padStart(3, '0')}`).replace(/\(/g, '\\(').replace(/\)/g, '\\)'));

describe('contenu du PDF', () => {
  const g = jardin();
  test('numérotation des essences et des éléments cohérente avec le plan', async () => {
    const sp = speciesNumbering(g, getPlant);
    expect(sp.list.map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(sp.list[0].plant.category).toBe('tree');
    const els = buildElements(g, getPlant);
    expect(els.map((e) => e.n)).toEqual(els.map((_, i) => i + 1));
    const env = makeEnv();
    const res = await buildGardenPdf(g, { photos: false, layers: false, shopping: false }, env);
    const l3 = env.calls.map((c) => c.svg).find((s) => s.includes('data-num-kind="sp"') && s.includes('data-ghost="zones"'));
    expect(l3).toBeTruthy();
    for (const s of sp.list) expect(l3).toContain(`data-num="${s.n}"`);
    const l1 = env.calls.map((c) => c.svg).find((s) => s.includes('data-num-kind="el"'));
    for (const e of els) expect(l1).toContain(`data-num="${e.n}"`);
    expect(res.filename).toBe('jardin-Jardin_de_Lea-plan.pdf');
  });
  test('sections, pages par zone, texte accentué, calques et liens', async () => {
    const env = makeEnv();
    const res = await buildGardenPdf(g, { photos: false, iso: false }, env);
    const titles = res.sections.map((s) => s.title);
    expect(titles).toEqual(expect.arrayContaining(['Niveau 1 : terrain et mobilier', 'Niveau 2 : zones', 'Niveau 3 : plantations', 'Plan complet à calques', 'Fiches par zone', 'Conseils de plantation', 'Calendrier annuel des tâches', 'Arrosage', 'Listes de courses', 'Aménagements à acheter ou à faire', 'Hypothèses et limites']));
    for (const z of g.zones) expect(titles.some((t) => t.includes(z.label))).toBe(true);
    const zonePages = res.sections.filter((s) => /^Z\d · /.test(s.title)).map((s) => s.page);
    expect(new Set(zonePages).size).toBe(g.zones.length); // une page par zone
    const raw = Buffer.from(res.bytes).toString('latin1');
    expect(raw).toMatch(/\/Count (\d+)/);
    expect(raw).toContain('/OCProperties'); expect((raw.match(/\/Type \/OCG/g) || []).length).toBe(6);
    expect(raw).toContain('/Subtype /Link'); expect(raw).toContain('/Type /Outlines');
    expect(raw).toContain('/Title <FEFF'); // métadonnées
    const all = textOf(res.bytes);
    for (const t of ['Jardin de Léa', 'Floraison', 'Liste globale', 'Prix moyens en jardinerie, à titre indicatif', 'Conseils généraux, à adapter', 'Hypothèses et limites', 'Page 1 / ']) expect(has(all, t)).toBe(true);
    expect(res.pages).toBeGreaterThanOrEqual(15);
    // plan complet : 6 calques d'images + SMask, mois de référence transmis
    expect(env.calls.filter((c) => c.o.type === 'rgba')).toHaveLength(6);
  });
  test('totaux = gardenCost, calendrier de floraison et liste d\'achats', async () => {
    const env = makeEnv();
    const res = await buildGardenPdf(g, { photos: false, layers: false, month: 5 }, env);
    const all = textOf(res.bytes);
    const total = gardenCost(g, getPlant).total;
    const eur = (n) => `${String(Math.round(n * 100) / 100).replace('.', ',')}`;
    expect(all.includes(`TOTAL G`)).toBe(true);
    expect(has(all, `${eur(total)} €`) || has(all, `${Math.round(total)} €`)).toBe(true);
    expect(env.calls.some((c) => c.svg.includes('data-num'))).toBe(true);
    expect(has(all, 'J F M A M J J A S O N D'.split(' ')[0])).toBe(true);
  });
  test('options : niveaux décochés, photos injectées, progression et annulation', async () => {
    const steps = []; const photo = jest_photo();
    const env = makeEnv({ photo, onProgress: (p) => steps.push(p.label) });
    const res = await buildGardenPdf(g, { levels: { 1: false, 2: false, 3: true }, layers: false, zonePages: false, advice: false, shopping: false, photos: true }, env);
    expect(res.sections.map((s) => s.title)).not.toContain('Niveau 1 : terrain et mobilier');
    expect(Buffer.from(res.bytes).toString('latin1')).toContain('/DCTDecode');
    expect(steps.some((l) => /Photos/.test(l))).toBe(true); expect(steps.some((l) => /plan niveau 3/i.test(l))).toBe(true);
    const ctrl = new AbortController(); ctrl.abort();
    await expect(buildGardenPdf(g, { layers: false }, makeEnv({ signal: ctrl.signal }))).rejects.toThrow(PdfAbort);
  });
  test('jardin sans zone ni plantation : sections vides explicites', async () => {
    const e = createGarden('Vide'); e.boundary = r(0, 0, 5, 5).points; e.boundaryClosed = true;
    const res = await buildGardenPdf(e, { photos: false, layers: false }, makeEnv());
    const all = textOf(res.bytes);
    expect(has(all, 'Aucune plante à acheter')).toBe(true);
    expect(has(all, 'Aucune zone')).toBe(true);
  });
});
function jest_photo() {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 8, 0, 8, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);
  return async () => ({ data: jpg, width: 8, height: 8, page: 'https://fr.wikipedia.org/wiki/X' });
}
