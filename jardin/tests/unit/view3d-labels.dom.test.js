// Noms des plantes en vue 3D (jsdom) : case par défaut, touche N, clic sur une étiquette (mise en évidence + fiche), Échap.
import { jest } from '@jest/globals';
import { mountView3D } from '../../ui/view3d.js';
import { createLabelsUI } from '../../ui/view3d-labels.js';
import { buildLabelGroups, MAX_LABELS } from '../../gl-labels.js';
import { createGarden, createZone } from '../../model.js';

const P = {
  lavande: { id: 'lavande', commonName: 'Lavande vraie', latinName: 'Lavandula angustifolia', category: 'perennial', habit: 'perennial-mound', heightAdult: 0.6, widthAdult: 0.5, foliage: 'evergreen', bloom: [6, 7, 8], flowerColor: '#7b68b8', foliageColor: '#8a9a7b', priceEur: 6.5 },
  buis: { id: 'buis', commonName: 'Buis', latinName: 'Buxus sempervirens', category: 'hedge', habit: 'hedge-clipped', heightAdult: 1.5, widthAdult: 0.8, foliage: 'evergreen', bloom: [], foliageColor: '#1f6f3a' },
  cerisier: { id: 'cerisier', commonName: 'Cerisier', latinName: 'Prunus', category: 'tree', habit: 'tree-round', heightAdult: 6, widthAdult: 4, foliage: 'deciduous', bloom: [4], flowerColor: '#ff66aa', foliageColor: '#2f8f3f' },
};
const rect = (x0, y0, x1, y1) => ({ kind: 'polygon', points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
function jardin() {
  const g = createGarden('Test'); g.boundary = rect(0, 0, 40, 30).points; g.boundaryClosed = true;
  const add = (type, shape, pl, id, label) => { const z = createZone(type, shape); z.id = id; z.label = label; pl.forEach(([p, c]) => z.plantings.push({ plantId: p, count: c })); g.zones.push(z); };
  for (let i = 0; i < 6; i++) add('midplants', rect(2 + i * 6, 2, 6 + i * 6, 6), [['lavande', 12]], `m${i}`, `Massif ${i}`);
  add('hedge', { kind: 'line', points: [{ x: 2, y: 20 }, { x: 30, y: 20 }], width: 0.8 }, [['buis', 30]], 'h', 'Haie');
  add('trees', rect(2, 24, 30, 28), [['cerisier', 8]], 't', 'Arbres');
  return g;
}
const totalPlants = 6 * 12 + 30 + 8;
const key = (k, o = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o }));

describe('vue 3D : noms des plantes (interface)', () => {
  let el; let un; let closed;
  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {}); // pas de WebGL en jsdom : le moteur affiche son erreur, sans importance ici
    document.body.innerHTML = ''; closed = 0;
    el = document.createElement('div'); document.body.appendChild(el);
    un = mountView3D(el, { garden: jardin(), onClose: () => { closed++; } });
  });
  afterEach(async () => { try { await un.ready; } catch (e) { /* ignoré */ } try { un(); } catch (e) { /* ignoré */ } jest.restoreAllMocks(); });

  test('case « Noms des plantes » cochée par défaut, « + noms latins » décochée', () => {
    const names = el.querySelector('[data-role=names]'); const latin = el.querySelector('[data-role=latin]');
    expect(names.checked).toBe(true);
    expect(latin.checked).toBe(false);
    expect(el.textContent).toContain('Noms des plantes'); expect(el.textContent).toContain('+ noms latins');
  });

  test('touche N : bascule les noms (ignorée dans un champ), la case suit', () => {
    const names = el.querySelector('[data-role=names]');
    key('n'); expect(names.checked).toBe(false);
    expect(el.querySelector('[data-role=labels]').classList.contains('is-off')).toBe(true);
    expect(el.querySelector('[data-role=latin]').disabled).toBe(true);
    key('N'); expect(names.checked).toBe(true);
    expect(el.querySelector('[data-role=labels]').classList.contains('is-off')).toBe(false);
    const sel = el.querySelector('[data-role=quality]'); sel.focus();
    sel.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    expect(names.checked).toBe(true);
    names.checked = false; names.dispatchEvent(new Event('change'));
    expect(un.labels.el.classList.contains('is-off')).toBe(true);
  });

  test('Échap : retire d’abord la mise en évidence, puis ferme', () => {
    const gs = buildLabelGroups(jardin(), { plantsById: (id) => P[id] });
    un.labels.setGroups(gs);
    un.labels.select(gs[0].key);
    expect(un.labels.selected()).toBe(gs[0].key);
    expect(el.querySelector('[data-role=label-card]').hidden).toBe(false);
    key('Escape');
    expect(un.labels.selected()).toBe(null); expect(closed).toBe(0);
    expect(el.querySelector('[data-role=label-card]').hidden).toBe(true);
    key('Escape'); expect(closed).toBe(1);
  });
});

describe('calque d’étiquettes (sans WebGL)', () => {
  const garden = jardin();
  const groups = buildLabelGroups(garden, { plantsById: (id) => P[id] });
  let root; let ui; let highlights; let focused;
  const setup = (opts = {}) => {
    document.body.innerHTML = ''; root = document.createElement('div'); document.body.appendChild(root);
    highlights = []; focused = [];
    ui = createLabelsUI({
      root, mobile: !!opts.mobile,
      project: (a) => ({ x: a.x * 30 + 20, y: 700 - a.z * 22 - a.y * 20, behind: false }),
      viewport: () => ({ width: opts.width || 1280, height: opts.height || 800 }),
      safeRects: () => opts.safe || [],
      onHighlight: (ids) => highlights.push(ids), onFocus: (g) => focused.push(g.essence),
    });
    ui.setGroups(groups);
    return ui;
  };
  const labels = () => [...root.querySelectorAll('.v3d-label')];

  test('un massif de 12 lavandes ne donne qu’une étiquette ; moins d’étiquettes que de plants ; plafond respecté', () => {
    setup();
    expect(groups.length).toBeLessThan(totalPlants);
    const n = labels().length;
    expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(MAX_LABELS.desktop); expect(n).toBeLessThan(totalPlants);
    expect(ui.visible().length).toBe(n);
    // chaque étiquette est unique par groupe
    expect(new Set(labels().map((l) => l.dataset.key)).size).toBe(n);
    setup({ mobile: true, width: 393, height: 727 });
    expect(labels().length).toBeLessThanOrEqual(MAX_LABELS.mobile);
  });

  test('aucune paire de pastilles ne se chevauche ; zones sûres respectées', () => {
    const safe = [{ x: 0, y: 0, w: 1280, h: 80 }];
    setup({ safe });
    const vis = ui.visible();
    for (let i = 0; i < vis.length; i++) {
      expect(vis[i].rect.y).toBeGreaterThanOrEqual(80);
      for (let j = i + 1; j < vis.length; j++) { const a = vis[i].rect; const b = vis[j].rect; expect(a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4).toBe(false); }
    }
  });

  test('clic sur une étiquette : mise en évidence de l’essence + fiche ; reclic ou Échap la retire', () => {
    setup();
    const lab = labels().find((l) => /Lavande/.test(l.textContent)) || labels()[0];
    lab.click();
    const g = ui.selectedGroup();
    expect(g).toBeTruthy();
    expect(lab.classList.contains('is-selected')).toBe(true);
    expect(highlights.at(-1)).toBeInstanceOf(Set);
    expect([...highlights.at(-1)]).toEqual(g.renderIds);
    const card = root.querySelector('[data-role=label-card]');
    expect(card.hidden).toBe(false);
    expect(card.textContent).toContain(g.name);
    expect(card.textContent).toContain(g.latin);
    expect(card.textContent).toContain('Quantité'); expect(card.textContent).toContain('Hauteur');
    lab.click();
    expect(ui.selected()).toBe(null); expect(highlights.at(-1)).toBe(null); expect(card.hidden).toBe(true);
    lab.click(); expect(ui.selected()).not.toBe(null);
    expect(ui.clear()).toBe(true); expect(card.hidden).toBe(true);
    expect(ui.clear()).toBe(false);
    card.hidden = false; lab.click(); root.querySelector('.v3d-card-close').click(); expect(ui.selected()).toBe(null);
  });

  test('légende : sélection d’une essence = même mise en évidence + demande de centrage', () => {
    setup();
    expect(ui.selectEssence('lavande')).toBe(true);
    expect(focused).toEqual(['lavande']);
    expect([...highlights.at(-1)]).toEqual(['lavande']);
    expect(ui.selectedGroup().essence).toBe('lavande');
    expect(ui.selectEssence('inconnue')).toBe(false);
  });

  test('nom latin : seulement avec l’option ; calque masqué par « noms » désactivé et pendant un geste', () => {
    setup();
    expect(root.querySelector('.v3d-label-latin').textContent).toBe('');
    ui.setOptions({ latin: true });
    expect(labels().some((l) => l.classList.contains('has-latin'))).toBe(true);
    ui.setOptions({ names: false });
    expect(labels().length).toBe(0);
    ui.setOptions({ names: true });
    expect(labels().length).toBeGreaterThan(0);
    ui.setMoving(true); expect(ui.el.classList.contains('is-moving')).toBe(true);
    ui.setMoving(false); expect(ui.el.classList.contains('is-moving')).toBe(false);
  });

  test('la sélection garde son étiquette et la saison / l’âge recalculent les ancres sans changer l’ensemble', () => {
    setup();
    const before = ui.visible().map((v) => v.key).join();
    ui.setGrowth({ age: 0.2, month: 1 });
    ui.update();
    expect(ui.visible().map((v) => v.key).join()).toBe(before);
    const g = ui.groups().find((q) => q.plantId === 'cerisier');
    ui.select(g.key);
    expect(ui.visible().some((v) => v.key === g.key)).toBe(true);
  });
});
