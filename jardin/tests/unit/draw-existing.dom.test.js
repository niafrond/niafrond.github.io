/** @jest-environment jsdom */
import { createGarden } from '../../model.js';
import { mountItemEditor } from '../../ui/draw-items.js';

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
  const unmount = mountItemEditor(el, { garden: g, onChange: () => {} });
  const svg = el.querySelector('.jd-svg');
  const toClient = (x, y) => {
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    return { clientX: ((x - vx) / vw) * 390, clientY: ((y - vy) / vh) * 520 };
  };
  const ptr = (type, x, y) => svg.dispatchEvent(new MouseEvent(type, { bubbles: true, ...toClient(x, y) }));
  const tap = (x, y) => { ptr('pointerdown', x, y); ptr('pointerup', x, y); };
  const longPress = async (x, y) => { ptr('pointerdown', x, y); await wait(560); ptr('pointerup', x, y); };
  const click = (sel) => { const b = el.querySelector(sel); if (!b) throw new Error('introuvable : ' + sel); b.click(); };
  const set = (sel, v) => { const i = el.querySelector(sel); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); };
  return { el, g, unmount, tap, longPress, click, set };
}

describe('onglet Existant (DOM)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('palette : arbre, arbuste, haie, grimpante, vivace, clôture', () => {
    const m = monter(); m.click('[data-tab=existing]');
    expect([...m.el.querySelectorAll('[data-ex-kind]')].map((b) => b.dataset.exKind)).toEqual(['tree', 'shrub', 'hedge', 'climber', 'perennial', 'fence']);
    expect(m.el.querySelectorAll('[data-fence-material]').length).toBe(3);
  });

  test('pose d’un arbre, choix de l’espèce, tailles en cm, compteur', () => {
    const m = monter(); m.click('[data-tab=existing]');
    m.click('[data-ex-kind=tree]'); m.tap(6, 4);
    expect(m.g.existing).toHaveLength(1);
    expect(m.g.existing[0]).toMatchObject({ kind: 'tree', x: 6, y: 4, height: 8, width: 5, keep: true });
    expect(m.el.querySelector('[data-role=existing-count]').textContent).toContain('1 existant : 1 arbre');
    m.set('[data-field=plant-search]', 'érable');
    m.el.querySelector('[data-field=plant-search]').dispatchEvent(new Event('input', { bubbles: true }));
    const cand = m.el.querySelector('[data-plant=erable-champetre]');
    expect(cand).toBeTruthy(); expect(cand.textContent).toContain('Acer');
    cand.click();
    expect(m.g.existing[0]).toMatchObject({ plantId: 'erable-champetre', label: 'Érable champêtre', height: 10, width: 6 });
    m.set('[data-field=ex-height]', '850');
    expect(m.g.existing[0].height).toBeCloseTo(8.5, 3);
    m.click('[data-act=age-young]');
    expect(m.g.existing[0].height).toBeLessThan(5);
  });

  test('appui long : fenêtre en cm', async () => {
    const m = monter(); m.click('[data-tab=existing]');
    m.click('[data-ex-kind=shrub]'); m.tap(4, 4);
    await m.longPress(4, 4);
    m.el.querySelector('[data-field=h]').value = '220';
    m.el.querySelector('[data-field=w]').value = '180';
    m.el.querySelector('[data-act=pop-ok]').click();
    expect(m.g.existing[0]).toMatchObject({ height: 2.2, width: 1.8 });
  });

  test('haie en points successifs + Terminer ; clôture fermée en touchant le 1er point', () => {
    const m = monter(); m.click('[data-tab=existing]');
    m.click('[data-ex-kind=hedge]'); m.tap(2, 7); m.tap(8, 7);
    expect(m.g.existing).toHaveLength(0);
    m.click('[data-act=ex-finish]');
    expect(m.g.existing[0]).toMatchObject({ kind: 'hedge' }); expect(m.g.existing[0].points).toHaveLength(2);
    m.click('[data-fence-material=metal]');
    m.tap(3, 2); m.tap(6, 2); m.tap(6, 4); m.tap(3, 2);
    const f = m.g.existing[1];
    expect(f).toMatchObject({ kind: 'fence', material: 'metal', height: 1.5 });
    expect(f.points).toHaveLength(4); expect(f.points[3]).toEqual(f.points[0]);
    const dans = m.el.querySelectorAll('.jdi-detail [data-fence-material=concrete]'); // bandeau de la clôture sélectionnée
    expect(dans).toHaveLength(1); dans[0].click();
    expect(f.material).toBe('concrete');
  });

  test('à retirer, notes, espèce inconnue / nom libre, suppression, annulation', () => {
    const m = monter(); m.click('[data-tab=existing]');
    m.click('[data-ex-kind=tree]'); m.tap(6, 4);
    m.click('[data-act=remove]');
    expect(m.g.existing[0].keep).toBe(false);
    m.set('[data-field=ex-notes]', 'malade');
    expect(m.g.existing[0].notes).toBe('malade');
    const s = m.el.querySelector('[data-field=plant-search]'); s.value = 'Vieux noyer';
    m.click('[data-act=plant-other]');
    expect(m.g.existing[0]).toMatchObject({ plantId: null, label: 'Vieux noyer' });
    m.click('[data-act=del]');
    expect(m.g.existing).toHaveLength(0);
    m.click('[data-act=undo]');
    expect(m.g.existing).toHaveLength(1);
    m.click('[data-act=undo]'); m.click('[data-act=undo]'); m.click('[data-act=undo]'); m.click('[data-act=undo]');
    expect(m.g.existing).toHaveLength(0);
    m.click('[data-act=redo]');
    expect(m.g.existing).toHaveLength(1);
  });

  test('glisser déplace l’élément', () => {
    const m = monter(); m.click('[data-tab=existing]');
    m.click('[data-ex-kind=shrub]'); m.tap(4, 4);
    const svg = m.el.querySelector('.jd-svg');
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    const p = (x, y) => ({ bubbles: true, clientX: ((x - vx) / vw) * 390, clientY: ((y - vy) / vh) * 520 });
    svg.dispatchEvent(new MouseEvent('pointerdown', p(4, 4)));
    svg.dispatchEvent(new MouseEvent('pointermove', p(7, 5)));
    svg.dispatchEvent(new MouseEvent('pointerup', p(7, 5)));
    expect(m.g.existing[0].x).toBeCloseTo(7, 0);
  });

  test('les murs et clôtures du contour acceptent un matériau', () => {
    const m = monter(); m.click('[data-tab=edges]');
    const g = m.g;
    g.boundaryEdges = [{ kind: 'fence', height: 1.2 }];
    // sélection du côté 1 par un appui sur son milieu
    m.tap(6, 0);
    m.click('[data-edge-material=metal]');
    expect(g.boundaryEdges[0]).toEqual({ kind: 'fence', height: 1.2, material: 'metal' });
  });
});
