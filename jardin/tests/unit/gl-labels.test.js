// Étiquettes des plantes : regroupement (jamais une étiquette par plant) et désencombrement en espace écran.
import { buildLabelGroups, applyGrowth, declutter, ficheRows, renderIdsOfEssence, MAX_LABELS, LABEL } from '../../gl-labels.js';
import { createGarden, createZone } from '../../model.js';

const P = {
  lavande: { id: 'lavande', commonName: 'Lavande vraie', latinName: 'Lavandula angustifolia', category: 'perennial', habit: 'perennial-mound', heightAdult: 0.6, widthAdult: 0.5, spacing: 0.4, foliage: 'evergreen', bloom: [6, 7, 8], flowerColor: '#7b68b8', foliageColor: '#8a9a7b', priceEur: 6.5, priceUnit: 'plant' },
  rosier: { id: 'rosier', commonName: 'Rosier', latinName: 'Rosa', category: 'shrub', habit: 'shrub-round', heightAdult: 1.2, widthAdult: 1, spacing: 0.8, foliage: 'deciduous', bloom: [6, 7], flowerColor: '#dd1122', foliageColor: '#2e7d4a' },
  buis: { id: 'buis', commonName: 'Buis', latinName: 'Buxus', category: 'hedge', habit: 'hedge-clipped', heightAdult: 1.5, widthAdult: 0.8, spacing: 0.5, foliage: 'evergreen', bloom: [], foliageColor: '#1f6f3a' },
  bambou: { id: 'bambou', commonName: 'Bambou', latinName: 'Fargesia', category: 'shrub', habit: 'bamboo', heightAdult: 3, widthAdult: 1.5, spacing: 1, foliage: 'evergreen', bloom: [], foliageColor: '#4a8f3a' },
  cerisier: { id: 'cerisier', commonName: 'Cerisier', latinName: 'Prunus', category: 'tree', habit: 'tree-round', heightAdult: 6, widthAdult: 4, spacing: 4, foliage: 'deciduous', bloom: [4], flowerColor: '#ff66aa', foliageColor: '#2f8f3f' },
  pommier: { id: 'pommier', commonName: 'Pommier', latinName: 'Malus', category: 'fruit', habit: 'tree-fruit', heightAdult: 4, widthAdult: 4, spacing: 4, foliage: 'deciduous', bloom: [4, 5], foliageColor: '#5c9a3e' },
  gazon: { id: 'gazon', commonName: 'Gazon', category: 'lawn', heightAdult: 0.1, widthAdult: 1, foliage: 'evergreen', bloom: [], foliageColor: '#88c057' },
};
const lookup = (id) => P[id];
const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
const garden = (...zones) => {
  const g = createGarden('Test'); g.boundary = rect(0, 0, 30, 20).points; g.boundaryClosed = true;
  zones.forEach(([type, shape, pl, id]) => { const z = createZone(type, shape); if (id) z.id = id; z.label = id || z.label; pl.forEach(([p, c]) => z.plantings.push({ plantId: p, count: c })); g.zones.push(z); });
  return g;
};
const groups = (g, o = {}) => buildLabelGroups(g, { plantsById: lookup, ...o });

describe('buildLabelGroups : regroupement', () => {
  test('12 lavandes = 1 groupe, au centre du massif, au-dessus du sommet', () => {
    const gs = groups(garden(['midplants', rect(2, 2, 8, 5), [['lavande', 12]], 'm1']));
    expect(gs).toHaveLength(1);
    const g = gs[0];
    expect(g).toMatchObject({ plantId: 'lavande', zoneId: 'm1', name: 'Lavande vraie', latin: 'Lavandula angustifolia', count: 12, source: 'zone', habit: 'perennial-mound' });
    expect(g.anchor.x).toBeGreaterThan(3.5); expect(g.anchor.x).toBeLessThan(6.5);
    expect(g.anchor.z).toBeGreaterThan(2.5); expect(g.anchor.z).toBeLessThan(4.5);
    expect(g.anchor.y).toBeGreaterThan(g.heightM);
    expect(g.colors).toEqual({ flower: '#7b68b8', foliage: '#8a9a7b' });
    expect(g.radius).toBeGreaterThan(1);
  });

  test('une haie = 1 groupe posé sur la ligne, au milieu', () => {
    const gs = groups(garden(['hedge', { kind: 'line', points: [{ x: 1, y: 10 }, { x: 11, y: 10 }], width: 0.8 }, [['buis', 20]], 'h1']));
    expect(gs).toHaveLength(1);
    expect(gs[0].anchor.x).toBeGreaterThan(4); expect(gs[0].anchor.x).toBeLessThan(8);
    expect(Math.abs(gs[0].anchor.z - 10)).toBeLessThan(0.4);
    expect(gs[0].heightM).toBeCloseTo(1.5, 5);
  });

  test('un bambou (touffe) = 1 groupe ; deux essences d’une même zone = 2 groupes', () => {
    expect(groups(garden(['tallplants', rect(2, 2, 6, 6), [['bambou', 3]]]))).toHaveLength(1);
    const gs = groups(garden(['midplants', rect(2, 2, 8, 5), [['lavande', 12], ['rosier', 3]]]));
    expect(gs.map((g) => g.plantId).sort()).toEqual(['lavande', 'rosier']);
  });

  test('le gazon n’a pas d’étiquette', () => {
    expect(groups(garden(['lawn', rect(1, 1, 20, 15), [['gazon', 1]]]))).toHaveLength(0);
  });

  test('3 arbres de la même essence = 3 étiquettes ; 4 = 1 par groupe', () => {
    const trois = groups(garden(['trees', rect(2, 2, 12, 8), [['cerisier', 3]], 'a']));
    expect(trois).toHaveLength(3);
    expect(trois.every((g) => g.individual && g.count === 1)).toBe(true);
    expect(new Set(trois.map((g) => g.key)).size).toBe(3);
    const quatre = groups(garden(['trees', rect(2, 2, 12, 8), [['cerisier', 4]], 'a']));
    expect(quatre).toHaveLength(1);
    expect(quatre[0]).toMatchObject({ count: 4, individual: false });
    const deuxZones = groups(garden(['trees', rect(2, 2, 6, 6), [['cerisier', 2]], 'a'], ['trees', rect(20, 10, 26, 16), [['cerisier', 2]], 'b']));
    expect(deuxZones).toHaveLength(2); // 4 arbres au total : une étiquette par zone
    expect(deuxZones.every((g) => !g.individual)).toBe(true);
  });

  test('arbres d’essences différentes : chacune compte pour elle-même', () => {
    const gs = groups(garden(['trees', rect(2, 2, 12, 8), [['cerisier', 2], ['pommier', 3]]]));
    expect(gs).toHaveLength(5);
  });

  test('deux groupes de la même essence à moins de 2 m fusionnent, pas au-delà', () => {
    const proches = groups(garden(['midplants', rect(2, 2, 6, 5), [['lavande', 6]], 'a'], ['midplants', rect(6.2, 2, 10.2, 5), [['lavande', 6]], 'b']));
    expect(proches).toHaveLength(1);
    expect(proches[0]).toMatchObject({ count: 12, zoneId: null });
    expect(proches[0].zones.map((z) => z.id).sort()).toEqual(['a', 'b']);
    const loin = groups(garden(['midplants', rect(2, 2, 6, 5), [['lavande', 6]], 'a'], ['midplants', rect(14, 2, 18, 5), [['lavande', 6]], 'b']));
    expect(loin).toHaveLength(2);
  });

  test('plantes existantes : étiquette propre, nom libre si espèce inconnue, arbres peu nombreux individuels', () => {
    const g = garden(['midplants', rect(2, 2, 6, 5), [['lavande', 6]], 'a']);
    const ex = [
      { id: 'e1', kind: 'tree', plant: P.cerisier, x: 20, y: 5, height: 7, width: 5, keep: true, habit: { id: 'tree-round' }, label: 'Cerisier' },
      { id: 'e2', kind: 'other', plant: null, x: 25, y: 12, height: 1, width: 1, keep: false, habit: { id: 'shrub-round' }, label: 'Le vieux lilas de mamie' },
      { id: 'e3', kind: 'hedge', plant: null, points: [{ x: 1, y: 18 }, { x: 15, y: 18 }], height: 1.8, width: 0.8, keep: true, habit: { id: 'hedge-clipped' }, label: 'Haie existante' },
      { id: 'f1', kind: 'fence', plant: null, points: [{ x: 0, y: 0 }, { x: 5, y: 0 }], height: 1, width: 0.05, keep: true, habit: null, label: 'Clôture' },
    ];
    const gs = groups(g, { existing: ex });
    const ge = gs.filter((q) => q.source === 'existant');
    expect(ge).toHaveLength(3); // pas de clôture
    expect(ge.find((q) => q.name === 'Le vieux lilas de mamie')).toMatchObject({ plantId: null, ghost: true, count: 1, heightM: 1 });
    expect(ge.find((q) => q.name === 'Haie existante').anchor.x).toBeGreaterThan(5);
    expect(ge.find((q) => q.name === 'Cerisier').heightM).toBe(7); // taille actuelle, indépendante de l'âge
    expect(groups(g, { existing: ex, age: 0 }).find((q) => q.name === 'Cerisier').heightM).toBe(7);
  });

  test('plus de 3 arbres existants de la même essence : fusion par proximité, pas une étiquette chacun', () => {
    const ex = [0, 1, 2, 3].map((i) => ({ id: `t${i}`, kind: 'tree', plant: P.pommier, x: 5 + i * 1.2, y: 5, height: 4, width: 3, keep: true, habit: { id: 'tree-fruit' }, label: 'Pommier' }));
    const gs = groups(garden(), { existing: ex });
    expect(gs).toHaveLength(1);
    expect(gs[0].count).toBe(4);
  });

  test('priorité : arbre et grosse haie avant un petit massif ; bonus existants', () => {
    const gs = groups(garden(['trees', rect(2, 2, 8, 8), [['cerisier', 1]]], ['midplants', rect(12, 2, 16, 5), [['lavande', 12]]], ['hedge', { kind: 'line', points: [{ x: 1, y: 15 }, { x: 11, y: 15 }], width: 0.8 }, [['buis', 20]]]));
    const by = Object.fromEntries(gs.map((q) => [q.plantId, q.priority]));
    expect(by.cerisier).toBeGreaterThan(by.buis);
    expect(by.buis).toBeGreaterThan(by.lavande);
    expect(gs.map((q) => q.priority)).toEqual([...gs.map((q) => q.priority)].sort((a, b) => b - a));
    const ex = [{ id: 'e', kind: 'shrub', plant: P.lavande, x: 20, y: 10, height: 0.6, width: 0.5, keep: true, habit: { id: 'perennial-mound' }, label: 'Lavande vraie' }];
    const g2 = groups(garden(['midplants', rect(2, 2, 3, 3), [['lavande', 1]]]), { existing: ex });
    expect(g2.find((q) => q.source === 'existant').priority).toBeGreaterThanOrEqual(6);
  });

  test('âge et saison : la plante jeune ou en repos garde son étiquette, plus basse', () => {
    const g = garden(['midplants', rect(2, 2, 8, 5), [['lavande', 12]]], ['trees', rect(12, 2, 16, 6), [['cerisier', 1]]]);
    const adulte = groups(g, { age: 1, month: 7 });
    const jeune = groups(g, { age: 0, month: 7 });
    expect(jeune).toHaveLength(adulte.length);
    for (const q of adulte) {
      const j = jeune.find((x) => x.key === q.key);
      expect(j.heightM).toBeLessThan(q.heightM); expect(j.anchor.y).toBeLessThan(q.anchor.y);
      expect(j.anchor.x).toBe(q.anchor.x); expect(j.priority).toBe(q.priority); // la priorité ne bouge pas : pas de clignotement pendant « Pousse »
    }
    const hiver = groups(g, { age: 1, month: 1 });
    expect(hiver.find((x) => x.plantId === 'lavande').heightM).toBeCloseTo(0.6, 5); // persistante
    const cad = groups(garden(['midplants', rect(2, 2, 8, 5), [['rosier', 3]]]), { month: 1 });
    expect(cad[0].heightM).toBe(1.2); // arbuste : ligneux
    const herb = { ...P.lavande, id: 'herbe', foliage: 'deciduous' };
    const gh = buildLabelGroups(garden(['midplants', rect(2, 2, 8, 5), [['herbe', 3]]]), { plantsById: (id) => (id === 'herbe' ? herb : null), month: 1 });
    expect(gh[0].heightM).toBeCloseTo(0.6 * 0.22, 5);
    expect(gh[0].anchor.y).toBeGreaterThanOrEqual(0.3); // jamais sous le sol
    const re = applyGrowth(adulte, { age: 0 });
    expect(re[0].heightM).toBeLessThan(adulte[0].heightM);
    expect(adulte[0].heightM).toBe(groups(g, { age: 1, month: 7 })[0].heightM); // copie : l'entrée n'est pas modifiée
  });

  test('fiche : quantité, hauteur, floraison, prix, zone ; mise en évidence = toutes les instances de l’essence', () => {
    const g = garden(['midplants', rect(2, 2, 8, 5), [['lavande', 12]], 'Massif sud'], ['midplants', rect(20, 12, 24, 15), [['lavande', 4]], 'Coin']);
    const gs = groups(g);
    expect(gs).toHaveLength(2);
    const rows = Object.fromEntries(ficheRows(gs.find((q) => q.count === 12)).map((r) => [r.label, r.value]));
    expect(rows.Quantité).toBe('12 plants'); expect(rows.Hauteur).toContain('0,60 m'); expect(rows.Floraison).toBe('de juin à août');
    expect(rows.Prix).toContain('6,50 €'); expect(rows.Prix).toContain('78 €'); expect(rows.Zone).toBe('Massif sud');
    expect([...renderIdsOfEssence(gs, 'lavande')]).toEqual(['lavande']);
  });
});

// ── désencombrement ──
const VP = { width: 1000, height: 700 };
const mk = (n, f = (i) => ({})) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, name: `Plante numéro ${i}`, latin: `Plantus ${i}`, priority: 100 - i, essence: `e${i}`, ...f(i) }));
const proj = (gs, f) => new Map(gs.map((g, i) => [g.key, f(i, g)]));
const hit = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

describe('declutter', () => {
  test('aucune paire d’étiquettes ne se chevauche (marge ≥ 4 px), toutes dans l’écran', () => {
    const gs = mk(60);
    const p = proj(gs, (i) => ({ x: 80 + (i % 10) * 85, y: 120 + Math.floor(i / 10) * 90 + (i % 3) * 7 }));
    const out = declutter(gs, p, { viewport: VP, maxLabels: 40, dense: false });
    expect(out.length).toBeGreaterThan(5);
    for (let i = 0; i < out.length; i++) {
      const r = out[i].rect;
      expect(r.x).toBeGreaterThanOrEqual(6); expect(r.y).toBeGreaterThanOrEqual(6);
      expect(r.x + r.w).toBeLessThanOrEqual(VP.width - 6); expect(r.y + r.h).toBeLessThanOrEqual(VP.height - 6);
      for (let j = i + 1; j < out.length; j++) expect(hit(r, out[j].rect, 4)).toBe(false);
    }
  });

  test('toutes les ancres au même endroit : une seule étiquette sur place, les autres empilées sans chevauchement', () => {
    const gs = mk(10);
    const out = declutter(gs, proj(gs, () => ({ x: 500, y: 350 })), { viewport: VP, maxLabels: 14, dense: false });
    expect(out.length).toBeLessThanOrEqual(4);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(hit(out[i].rect, out[j].rect, 4)).toBe(false);
  });

  test('plafond respecté : 14 PC, 8 mobile, 5 en vue dense ; le plus prioritaire d’abord', () => {
    const gs = mk(40);
    const p = proj(gs, (i) => ({ x: 60 + (i % 8) * 110, y: 60 + Math.floor(i / 8) * 120 }));
    expect(declutter(gs, p, { viewport: { width: 1000, height: 700 }, dense: false }).length).toBe(MAX_LABELS.desktop);
    expect(declutter(gs, p, { viewport: { width: 1000, height: 700 }, mobile: true, dense: false }).length).toBe(MAX_LABELS.mobile);
    expect(declutter(gs, p, { viewport: { width: 1000, height: 700 }, dense: true }).length).toBeLessThanOrEqual(MAX_LABELS.dense);
    expect(declutter(gs, p, { viewport: { width: 1000, height: 700 }, maxLabels: 3 }).length).toBe(3);
    const out = declutter(gs, p, { viewport: VP, dense: false });
    expect(out[0].key).toBe('k0');
    expect(declutter(gs, p, { viewport: { width: 393, height: 727 }, mobile: true }).length).toBeLessThanOrEqual(8);
  });

  test('éléments derrière la caméra, hors écran, sur le bord ou sous une zone interdite : ignorés', () => {
    const gs = mk(5);
    const pr = [{ x: 300, y: 300, behind: true }, { x: -50, y: 300 }, { x: 3, y: 300 }, { x: 600, y: 300 }, { x: 600, y: 600, visible: false }];
    const out = declutter(gs, proj(gs, (i) => pr[i]), { viewport: VP, maxLabels: 14, dense: false });
    expect(out.map((o) => o.key)).toEqual(['k3']);
    const safe = [{ x: 500, y: 250, w: 200, h: 120 }];
    expect(declutter(gs, proj(gs, (i) => pr[i]), { viewport: VP, safe, dense: false })).toHaveLength(0);
  });

  test('étiquette collée en haut : repasse sous l’ancre ; collée à droite : décalée dans l’écran', () => {
    const gs = mk(2);
    const out = declutter(gs, proj(gs, (i) => (i ? { x: 995 - 6, y: 300 } : { x: 400, y: 20 })), { viewport: VP, dense: false });
    expect(out).toHaveLength(2);
    expect(out[0].rect.y).toBeGreaterThan(20); // sous l'ancre
    expect(out[1].rect.x + out[1].rect.w).toBeLessThanOrEqual(994);
  });

  test('loin : moins d’étiquettes, seulement les plus grosses ; près : tout ce qui tient', () => {
    const gs = mk(30, (i) => ({ priority: i < 4 ? 100 - i : 5 }));
    const p = proj(gs, (i) => ({ x: 60 + (i % 8) * 110, y: 60 + Math.floor(i / 8) * 120 }));
    const loin = declutter(gs, p, { viewport: VP, distance: 4, dense: false });
    const pres = declutter(gs, p, { viewport: VP, distance: 0.8, dense: false });
    expect(loin.length).toBeLessThan(pres.length);
    expect(loin.length).toBeLessThanOrEqual(MAX_LABELS.desktop / 2);
    for (const k of ['k0', 'k1', 'k2', 'k3']) expect(loin.map((o) => o.key)).toContain(k); // les plus grosses d'abord
    expect(pres.length).toBe(MAX_LABELS.desktop);
  });

  test('nom latin en seconde ligne si l’option est active et si la place le permet', () => {
    const gs = mk(2);
    const p = proj(gs, (i) => ({ x: 300 + i * 400, y: 300 }));
    const sans = declutter(gs, p, { viewport: VP, dense: false });
    const avec = declutter(gs, p, { viewport: VP, latin: true, dense: false });
    expect(sans.every((o) => o.lines === 1)).toBe(true);
    expect(avec.every((o) => o.lines === 2 && o.rect.h === LABEL.h2)).toBe(true);
    // pas de place pour deux lignes (écran très bas) : repli sur une seule
    const g1 = mk(1); const pp = proj(g1, () => ({ x: 500, y: 50 }));
    expect(declutter(g1, pp, { viewport: { width: 1000, height: 100 }, latin: true, dense: false })[0].lines).toBe(1);
    expect(declutter(g1, pp, { viewport: { width: 1000, height: 300 }, latin: true, dense: false })[0].lines).toBe(2);
    const loin = declutter(gs, p, { viewport: VP, latin: true, distance: 4, dense: false });
    expect(loin.every((o) => o.lines === 1)).toBe(true);
  });

  test('hystérésis : l’ensemble des étiquettes reste identique sur 30 images avec un léger mouvement de caméra', () => {
    const gs = mk(25, (i) => ({ priority: 200 - i * 3 }));
    const base = (i) => ({ x: 70 + (i % 5) * 190 + (i % 2) * 30, y: 80 + Math.floor(i / 5) * 120 + (i % 3) * 25 });
    let prev = null; let first = null;
    for (let f = 0; f < 30; f++) {
      const dx = Math.sin(f / 4) * 6; const dy = Math.cos(f / 5) * 4; // balancement de la caméra
      const out = declutter(gs, proj(gs, (i) => { const b = base(i); return { x: b.x + dx * (1 + (i % 4) * 0.3), y: b.y + dy }; }), { viewport: VP, maxLabels: 14, previous: prev, dense: false });
      const keys = out.map((o) => o.key).sort().join(',');
      if (first == null) first = keys;
      expect(keys).toBe(first);
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(hit(out[i].rect, out[j].rect, 4)).toBe(false);
      prev = out;
    }
  });

  test('hystérésis : une étiquette déjà affichée garde sa place face à un concurrent un peu plus prioritaire', () => {
    const a = { key: 'a', name: 'Alpha', latin: '', priority: 50, essence: 'a' }; const b = { key: 'b', name: 'Bravo', latin: '', priority: 60, essence: 'b' };
    const p = new Map([['a', { x: 500, y: 300 }], ['b', { x: 505, y: 300 }]]);
    const s1 = declutter([a], new Map([['a', { x: 500, y: 300 }]]), { viewport: VP, maxLabels: 1, dense: false });
    const s2 = declutter([a, b], p, { viewport: VP, maxLabels: 1, previous: s1, dense: false });
    expect(s2.map((o) => o.key)).toEqual(['a']);
    expect(declutter([a, b], p, { viewport: VP, maxLabels: 1, dense: false }).map((o) => o.key)).toEqual(['b']);
  });

  test('projection manquante ou NaN ignorée', () => {
    const gs = mk(3);
    const out = declutter(gs, new Map([['k0', { x: NaN, y: 3 }], ['k1', { x: 400, y: 300 }]]), { viewport: VP, dense: false });
    expect(out.map((o) => o.key)).toEqual(['k1']);
  });
});
