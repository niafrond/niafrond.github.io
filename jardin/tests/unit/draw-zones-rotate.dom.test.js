// Éditeur de zones (DOM) : rotation de chaque forme (boutons, champ en degrés, poignée, appui long) et piscine hors sol.
import { createGarden, createZone } from '../../model.js';
import { mountZoneEditor } from '../../ui/draw.js';
import { rotationOf } from '../../zone-rotate.js';
import { shapeArea } from '../../geometry.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

async function setup(zones) {
  const el = document.createElement('div'); document.body.append(el);
  const g = createGarden('Rot');
  g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true;
  zones.forEach((z) => g.zones.push(z));
  const unmount = mountZoneEditor(el, { garden: g, onChange: () => {} });
  await sleep(100);
  const svg = el.querySelector('.jd-svg');
  const vb = () => svg.getAttribute('viewBox').split(' ').map(Number);
  const xy = (x, y) => { const v = vb(); const mpp = v[2] / 390; return [(x - v[0]) / mpp, (y - v[1]) / mpp]; };
  const fire = (type, x, y) => {
    const [cx, cy] = xy(x, y);
    const ev = new MouseEvent(type, { clientX: cx, clientY: cy, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    svg.dispatchEvent(ev);
  };
  const tap = (x, y) => { fire('pointerdown', x, y); fire('pointerup', x, y); };
  const q = (s) => el.querySelector(s);
  return { el, g, svg, fire, tap, q, click: (s) => q(s).click(), mpp: () => vb()[2] / 390, unmount };
}
const rect = () => createZone('terrace', { kind: 'polygon', points: RECT(2, 2, 6, 5) });

describe('rotation des formes de zones', () => {
  test('boutons ↺ −15°, ↻ +15°, ⟲ 90°, Remettre droit : points changés, surface inchangée', async () => {
    const z = rect(); const t = await setup([z]);
    t.tap(4, 3.5);
    const area0 = shapeArea(z.shape);
    expect(t.q('[data-role=zone-rotation]')).not.toBeNull();
    t.click('[data-act=rot-cw]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(15, 1);
    expect(t.q('[data-role=zone-rot]').value).toBe('15');
    t.click('[data-act=rot-ccw]'); t.click('[data-act=rot-ccw]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(345, 1);
    t.click('[data-act=rot-90]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(75, 1);
    expect(shapeArea(t.g.zones[0].shape)).toBeCloseTo(area0, 2);
    t.click('[data-act=rot-reset]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(90, 1); // multiple de 90° le plus proche
    t.click('[data-act=rot-reset]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(90, 1);
    t.click('[data-act=undo]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(75, 1);
    t.unmount();
  });

  test('champ « Rotation (°) » : saisie 0–359, valeur illisible refusée', async () => {
    const z = rect(); const t = await setup([z]);
    t.tap(4, 3.5);
    const inp = t.q('[data-role=zone-rot]');
    expect(inp.getAttribute('aria-label')).toBe('Rotation (°)');
    inp.value = '30'; inp.dispatchEvent(new Event('change', { bubbles: true }));
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(30, 1);
    expect(t.g.zones[0].shape.points).not.toEqual(RECT(2, 2, 6, 5));
    t.q('[data-role=zone-rot]').value = '-90'; t.q('[data-role=zone-rot]').dispatchEvent(new Event('change', { bubbles: true }));
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(270, 1);
    t.q('[data-role=zone-rot]').value = 'abc'; t.q('[data-role=zone-rot]').dispatchEvent(new Event('change', { bubbles: true }));
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(270, 1);
    t.unmount();
  });

  test('poignée de rotation : glisser pivote autour du centre, aimanté à 15°, désactivable', async () => {
    const z = rect(); const t = await setup([z]);
    t.tap(4, 3.5);
    expect(t.q('[data-handle=rotate]')).not.toBeNull();
    const m = t.mpp();
    const c = { x: 4, y: 3.5 }; const h = { x: 4, y: 2 - 40 * m };
    // glisser la poignée à 38° dans le sens horaire : aimanté à 45° ? (38 → 45) puis sans aimant → 38
    const target = (deg) => { const a = ((deg - 90) * Math.PI) / 180; return { x: c.x + 3 * Math.cos(a), y: c.y + 3 * Math.sin(a) }; };
    const dragTo = (deg) => { t.fire('pointerdown', h.x, h.y); const p = target(deg); t.fire('pointermove', (h.x + p.x) / 2, (h.y + p.y) / 2); t.fire('pointermove', p.x, p.y); t.fire('pointerup', p.x, p.y); };
    dragTo(38);
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(45, 0);
    const c1 = t.g.zones[0].shape.points.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
    expect(c1.x).toBeCloseTo(4, 1); expect(c1.y).toBeCloseTo(3.5, 1);
    t.click('[data-act=undo]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(0, 1);
    t.click('[data-act=rot-snap]');
    expect(t.q('[data-act=rot-snap]').getAttribute('aria-pressed')).toBe('false');
    const m2 = t.mpp(); h.y = 2 - 40 * m2;
    dragTo(38);
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(38, 0);
    t.unmount();
  });

  test('cercle : boutons de rotation désactivés avec info-bulle', async () => {
    const z = createZone('lawn', { kind: 'circle', center: { x: 4, y: 4 }, radius: 1.5 });
    const t = await setup([z]);
    t.tap(4, 4);
    for (const a of ['rot-ccw', 'rot-cw', 'rot-90', 'rot-reset']) {
      const b = t.q(`[data-act=${a}]`);
      expect(b.disabled).toBe(true); expect(b.title).toBe('Un cercle n’a pas d’orientation');
    }
    expect(t.q('[data-handle=rotate]')).toBeNull();
    t.unmount();
  });

  test('ligne : pivote autour de son milieu', async () => {
    const z = createZone('path', { kind: 'line', points: [{ x: 2, y: 4 }, { x: 6, y: 4 }], width: 1 });
    const t = await setup([z]);
    t.tap(4, 4);
    t.click('[data-act=rot-90]');
    const p = t.g.zones[0].shape.points;
    expect(p[0].x).toBeCloseTo(4, 2); expect(p[0].y).toBeCloseTo(2, 2); expect(p[1].y).toBeCloseTo(6, 2);
    t.unmount();
  });

  test('forme pivotée qui sort du terrain : signalée', async () => {
    const z = createZone('terrace', { kind: 'polygon', points: RECT(0.5, 3, 11, 4.5) });
    const t = await setup([z]);
    t.tap(5, 3.7);
    expect(t.q('[data-role=zone-warnings]')).toBeNull();
    t.click('[data-act=rot-ccw]'); t.click('[data-act=rot-ccw]'); t.click('[data-act=rot-ccw]');
    expect(t.q('[data-role=zone-warnings]').textContent).toContain('Dépasse du contour');
    t.unmount();
  });

  test('appui long sur un rectangle : champ Rotation, angle conservé quand on change largeur × longueur', async () => {
    const z = rect(); const t = await setup([z]);
    t.tap(4, 3.5);
    t.q('[data-role=zone-rot]').value = '30'; t.q('[data-role=zone-rot]').dispatchEvent(new Event('change', { bubbles: true }));
    t.click('[data-act=dims]');
    expect(t.q('[data-field=rot]').value).toBe('30');
    t.q('[data-field=w]').value = '500'; t.q('[data-field=l]').value = '200';
    t.click('[data-act=pop-ok]');
    const s = t.g.zones[0].shape;
    expect(rotationOf(s)).toBeCloseTo(30, 0);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    expect(d(s.points[0], s.points[1])).toBeCloseTo(5, 1); expect(d(s.points[0], s.points[3])).toBeCloseTo(2, 1);
    t.click('[data-act=dims]');
    t.q('[data-field=rot]').value = '90'; t.click('[data-act=pop-ok]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(90, 0);
    expect(shapeArea(t.g.zones[0].shape)).toBeCloseTo(10, 1);
    t.unmount();
  });

  test('création d’un rectangle en 2 touches : axe-aligné, puis pivotable', async () => {
    const t = await setup([]);
    t.click('[data-start-type]');
    t.tap(2, 2); t.tap(6, 5);
    expect(t.g.zones).toHaveLength(1);
    expect(rotationOf(t.g.zones[0].shape)).toBe(0);
    t.click('[data-act=rot-90]');
    expect(rotationOf(t.g.zones[0].shape)).toBeCloseTo(90, 1);
    t.unmount();
  });
});

describe('piscine hors sol dans le bandeau', () => {
  test('pastilles Enterrée / Hors sol, aide, libellé par défaut suivi', async () => {
    const z = createZone('pool', { kind: 'polygon', points: RECT(2, 2, 6, 5) });
    const t = await setup([z]);
    t.tap(4, 3.5);
    const grp = t.q('[data-role=pool-variant]');
    expect(grp.getAttribute('role')).toBe('radiogroup');
    expect(t.q('[data-variant=inground]').getAttribute('aria-checked')).toBe('true');
    expect(t.q('[data-role=pool-variant-help]').textContent).toContain('dégagement d’au moins 1 m');
    t.click('[data-variant=above]');
    expect(t.g.zones[0].variant).toBe('above');
    expect(t.g.zones[0].label).toBe('Piscine hors sol');
    expect(t.q('[data-variant=above]').getAttribute('aria-checked')).toBe('true');
    t.click('[data-act=undo]');
    expect(t.g.zones[0].variant).toBe('inground');
    t.unmount();
  });

  test('proposé juste après la création d’une piscine ronde ; pas de pastilles pour une autre zone', async () => {
    const t = await setup([]);
    t.click('[data-act=start-more]');
    t.click('[data-type=pool]');
    t.q('[data-act=kind-circle]').click();
    t.tap(5, 4); t.tap(6.5, 4);
    expect(t.g.zones[0].type).toBe('pool'); expect(t.g.zones[0].shape.kind).toBe('circle');
    expect(t.q('[data-role=pool-variant]')).not.toBeNull();
    t.q('[data-variant=above]').click();
    expect(t.g.zones[0].variant).toBe('above');
    t.unmount();
    const t2 = await setup([rect()]);
    t2.tap(4, 3.5);
    expect(t2.q('[data-role=pool-variant]')).toBeNull();
    t2.unmount();
  });
});
