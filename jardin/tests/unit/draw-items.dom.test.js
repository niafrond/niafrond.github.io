/** @jest-environment jsdom */
import { createGarden } from '../../model.js';
import { mountItemEditor } from '../../ui/draw-items.js';
import { ITEM_KINDS } from '../../items.js';

const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function jardin() {
  const g = createGarden('Dom');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  return g;
}
function monter(g = jardin()) {
  const el = document.createElement('div');
  document.body.append(el);
  let n = 0;
  const unmount = mountItemEditor(el, { garden: g, onChange: () => { n++; } });
  const svg = el.querySelector('.jd-svg');
  const toClient = (x, y) => {
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    return { clientX: ((x - vx) / vw) * 390, clientY: ((y - vy) / vh) * 520 };
  };
  const ptr = (type, x, y) => svg.dispatchEvent(new MouseEvent(type, { bubbles: true, ...toClient(x, y) }));
  const tap = (x, y) => { ptr('pointerdown', x, y); ptr('pointerup', x, y); };
  const longPress = async (x, y) => { ptr('pointerdown', x, y); await wait(560); ptr('pointerup', x, y); };
  const click = (sel) => { const b = el.querySelector(sel); if (!b) throw new Error('introuvable : ' + sel); b.click(); };
  return { el, g, unmount, tap, longPress, click, ptr, count: () => n };
}

describe('éditeur d’aménagements (DOM)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('trois onglets, palette complète avec dimensions et prix', () => {
    const { el } = monter();
    expect([...el.querySelectorAll('[role=tab]')].map((t) => t.dataset.tab)).toEqual(['furniture', 'edges', 'access']);
    const cards = el.querySelectorAll('.jdi-card');
    expect(cards.length).toBe(ITEM_KINDS.length);
    const banc = el.querySelector('[data-kind=bench]');
    expect(banc.textContent).toContain('Banc'); expect(banc.textContent).toContain('150×50 cm'); expect(banc.textContent).toContain('90 €');
    el.querySelector('[data-act=cat-structure]').click();
    expect([...el.querySelectorAll('.jdi-card')].every((c) => ['pergola', 'gazebo', 'shed_item', 'greenhouse', 'playhouse'].includes(c.dataset.kind))).toBe(true);
  });

  test('toucher un élément puis le plan : posé, sélectionné, bandeau et total', () => {
    const m = monter();
    m.click('[data-kind=bench]');
    expect(m.el.querySelector('[data-kind=bench]').getAttribute('aria-pressed')).toBe('true');
    m.tap(6, 4);
    expect(m.g.items).toHaveLength(1);
    expect(m.g.items[0]).toMatchObject({ kind: 'bench', x: 6, y: 4, width: 1.5, depth: 0.5 });
    expect(m.count()).toBeGreaterThan(0);
    expect(m.el.querySelector('[data-role=sel-banner]').textContent).toContain('150 × 50 cm');
    expect(m.el.querySelector('[data-role=total]').textContent).toContain('90');
    expect(m.el.querySelector('[data-kind=bench]').getAttribute('aria-pressed')).toBe('false');
  });

  test('aimantation : posé près du bord, l’élément vient se coller au côté', () => {
    const m = monter();
    m.click('[data-kind=bench]');
    m.tap(6, 0.4); // le banc (0,5 m de profondeur) se colle au mur du haut
    const it = m.g.items[0];
    expect(it.y).toBeCloseTo(0.25, 2);
    expect(((it.rotation % 360) + 360) % 360).toBe(0);
  });

  test('appui long : fenêtre en cm (largeur, profondeur, rotation)', async () => {
    const m = monter();
    m.click('[data-kind=bench]');
    m.tap(6, 4);
    await m.longPress(6, 4);
    expect(m.el.querySelector('[data-role=pop]').hidden).toBe(false);
    m.el.querySelector('[data-field=w]').value = '200';
    m.el.querySelector('[data-field=d]').value = '60';
    m.el.querySelector('[data-field=rot]').value = '90';
    m.click('[data-act=pop-ok]');
    expect(m.g.items[0]).toMatchObject({ width: 2, depth: 0.6, rotation: 90 });
    expect(m.el.querySelector('[data-role=pop]').hidden).toBe(true);
  });

  test('saisie invalide : la fenêtre reste ouverte', async () => {
    const m = monter();
    m.click('[data-kind=bench]'); m.tap(6, 4);
    await m.longPress(6, 4);
    m.el.querySelector('[data-field=w]').value = 'abc';
    m.click('[data-act=pop-ok]');
    expect(m.el.querySelector('[data-role=pop]').hidden).toBe(false);
    expect(m.g.items[0].width).toBe(1.5);
    m.click('[data-act=pop-cancel]');
  });

  test('élément rond : diamètre ; rotation 90°, dupliquer, supprimer, annuler / rétablir', async () => {
    const m = monter();
    m.click('[data-kind=table_round]'); m.tap(6, 4);
    expect(m.el.querySelector('[data-act=rot-cw]')).toBeNull();
    await m.longPress(6, 4);
    expect(m.el.querySelector('[data-field=d]')).toBeNull();
    m.el.querySelector('[data-field=w]').value = '150';
    m.click('[data-act=pop-ok]');
    expect(m.g.items[0].radius).toBeCloseTo(0.75);

    m.click('[data-kind=bench]'); m.tap(3, 3);
    m.click('[data-act=rot-cw]');
    expect(m.g.items[1].rotation).toBe(90);
    m.click('[data-act=rot-ccw]');
    expect(m.g.items[1].rotation).toBe(0);
    m.click('[data-act=dup]');
    expect(m.g.items).toHaveLength(3);
    m.click('[data-act=del]');
    expect(m.g.items).toHaveLength(2);
    m.click('[data-act=undo]');
    expect(m.g.items).toHaveLength(3);
    m.click('[data-act=redo]');
    expect(m.g.items).toHaveLength(2);
  });

  test('glisser déplace l’élément (une seule étape d’annulation)', () => {
    const m = monter();
    m.click('[data-kind=chair]'); m.tap(6, 4);
    m.ptr('pointerdown', 6, 4);
    m.ptr('pointermove', 7, 4.5);
    m.ptr('pointermove', 8, 5);
    m.ptr('pointerup', 8, 5);
    expect(m.g.items[0].x).toBeCloseTo(8, 0);
    expect(m.g.items[0].y).toBeCloseTo(5, 0);
    m.click('[data-act=undo]');
    expect(m.g.items[0]).toMatchObject({ x: 6, y: 4 });
  });

  test('murs & clôtures : côté du contour, type, hauteur, tous les côtés', () => {
    const m = monter();
    m.click('[data-tab=edges]');
    m.tap(6, 0.05); // côté 1 (haut)
    expect(m.el.querySelector('[data-role=sel-banner]').textContent).toContain('Côté 1');
    m.click('[data-edge-kind=wall]');
    expect(m.g.boundaryEdges[0]).toEqual({ kind: 'wall', height: 2 });
    const hIn = m.el.querySelector('[data-field=edge-height]');
    hIn.value = '250'; hIn.dispatchEvent(new Event('change'));
    expect(m.g.boundaryEdges[0].height).toBeCloseTo(2.5);
    m.click('[data-edge-kind=hedge]');
    expect(m.g.boundaryEdges[0]).toEqual({ kind: 'hedge', height: 1.8 });
    m.click('[data-act=apply-all]');
    expect(m.g.boundaryEdges.map((e) => e.kind)).toEqual(['hedge', 'hedge', 'hedge', 'hedge']);
    m.click('[data-edge-kind=open]');
    expect(m.g.boundaryEdges[0].kind).toBe('open');
  });

  test('murs & clôtures : appui long sur un côté ouvre la fenêtre type + hauteur', async () => {
    const m = monter();
    m.click('[data-tab=edges]');
    await m.longPress(6, 0.05);
    m.click('[data-edge-pop=fence]');
    m.el.querySelector('[data-field=h]').value = '150';
    m.click('[data-act=pop-ok]');
    expect(m.g.boundaryEdges[0]).toEqual({ kind: 'fence', height: 1.5 });
  });

  test('mur libre : polyligne en obstacle « wall », puis suppression', () => {
    const m = monter();
    m.click('[data-tab=edges]');
    m.click('[data-act=draft-wall]');
    m.tap(2, 2); m.tap(6, 2); m.tap(6, 5);
    m.click('[data-act=draft-finish]');
    expect(m.g.obstacles).toHaveLength(1);
    expect(m.g.obstacles[0]).toMatchObject({ kind: 'wall', height: 2 });
    expect(m.g.obstacles[0].points).toHaveLength(3);
    m.click('[data-act=del]');
    expect(m.g.obstacles).toHaveLength(0);
  });

  test('portes & accès : portail sur le contour, glissé, largeur en cm, sens, suppression', async () => {
    const m = monter();
    m.click('[data-tab=access]');
    m.click('[data-opening-kind=gate]');
    m.tap(5, 0.2);
    expect(m.g.openings).toHaveLength(1);
    expect(m.g.openings[0]).toMatchObject({ kind: 'gate', ref: { type: 'boundary', side: 0 }, width: 3 });
    m.ptr('pointerdown', 5, 0); m.ptr('pointermove', 8, 0); m.ptr('pointerup', 8, 0);
    expect(m.g.openings[0].t).toBeCloseTo(8 / 12, 1);
    await m.longPress(8, 0);
    m.el.querySelector('[data-field=w]').value = '350';
    m.click('[data-act=pop-ok]');
    expect(m.g.openings[0].width).toBeCloseTo(3.5);
    m.click('[data-act=swing-out]');
    expect(m.g.openings[0].swing).toBe('out');
    m.click('[data-act=del]');
    expect(m.g.openings).toHaveLength(0);
  });

  test('garage : seulement sur maison ou abri', () => {
    const m = monter();
    m.click('[data-tab=access]');
    m.click('[data-opening-kind=garage]');
    expect(m.el.querySelector('.jd-msg').textContent).toMatch(/Aucune maison/);
    m.tap(6, 0.1);
    expect(m.g.openings).toHaveLength(0);
    m.g.obstacles.push({ id: 'h1', kind: 'house', points: [{ x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 2, y: 6 }], height: 6 });
    m.click('[data-opening-kind=door]'); m.click('[data-opening-kind=garage]');
    m.tap(5, 6.2);
    expect(m.g.openings[0]).toMatchObject({ kind: 'garage', ref: { type: 'obstacle', obstacleId: 'h1', side: 2 }, swing: 'sliding' });
  });

  test('sans contour : l’écran reste utilisable (mobilier libre, aide contextuelle)', () => {
    const g = createGarden('Vide');
    const m = monter(g);
    m.click('[data-kind=bench]'); m.tap(5, 4);
    expect(g.items).toHaveLength(1);
    m.click('[data-tab=edges]');
    expect(m.el.querySelector('[data-role=start-panel]').hidden).toBe(false);
    m.click('[data-tab=access]');
    expect(m.el.querySelector('[data-role=start-panel]').textContent).toMatch(/Terrain/);
    m.tap(5, 4);
    expect(g.openings).toHaveLength(0);
  });

  test('jardin ancien sans les champs : complétés au montage', () => {
    const g = jardin(); delete g.items; delete g.openings; delete g.boundaryEdges;
    monter(g);
    expect(g.items).toEqual([]); expect(g.openings).toEqual([]); expect(g.boundaryEdges).toEqual([]);
  });

  test('unmount retire l’éditeur', () => {
    const m = monter();
    m.unmount();
    expect(m.el.querySelector('[data-role=items-editor]')).toBeNull();
  });
});
