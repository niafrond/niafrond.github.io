// Éditeur de zones : le mobilier / les murs / obstacles posés avant les zones sont visibles (lecture seule) et accrochables.
import { createGarden, createItem } from '../../model.js';
import { itemPolygon } from '../../items.js';
import { mountZoneEditor } from '../../ui/draw.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

async function setup() {
  const el = document.createElement('div'); document.body.append(el);
  const g = createGarden('Posé');
  g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true;
  const bench = createItem('bench', 3, 3, 0); bench.id = 'i-bench';
  g.items.push(bench);
  g.boundaryEdges = [{ i: 0, kind: 'wall' }];
  g.obstacles.push({ id: 'o-house', kind: 'house', points: RECT(8, 4.5, 11.5, 7.5), height: 5 });
  const unmount = mountZoneEditor(el, { garden: g, onChange: () => {} });
  await sleep(100);
  const svg = el.querySelector('.jd-svg');
  const xy = (x, y) => { const vb = svg.getAttribute('viewBox').split(' ').map(Number); const mpp = vb[2] / 390; return [(x - vb[0]) / mpp, (y - vb[1]) / mpp]; };
  const tap = (x, y) => {
    for (const type of ['pointerdown', 'pointerup']) {
      const [cx, cy] = xy(x, y);
      const ev = new MouseEvent(type, { clientX: cx, clientY: cy, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' });
      svg.dispatchEvent(ev);
    }
  };
  return { el, g, svg, tap, q: (s) => el.querySelector(s), unmount };
}

describe('éditeur de zones : aménagements déjà posés', () => {
  test('mobilier, côté en mur et obstacle nommé dessinés en lecture seule', async () => {
    const t = await setup();
    const layer = t.q('[data-role=placed-layer]');
    expect(layer).not.toBeNull();
    expect(layer.getAttribute('pointer-events')).toBe('none');
    expect(layer.querySelector('[data-kind]')).not.toBeNull();
    expect(layer.textContent).toContain('Banc');
    expect(layer.querySelector('[data-edge="0"][data-kind="wall"]')).not.toBeNull();
    expect(layer.querySelector('[data-obstacle-name=house]').textContent).toBe('Maison');
    t.unmount();
  });

  test('un tap sur le mobilier pose bien le premier coin d’une zone en cours de tracé', async () => {
    const t = await setup();
    t.q('[data-type=lawn]') ? t.q('[data-type=lawn]').click() : t.q('[data-act=toggle-all]').click();
    if (!t.q('[data-type=lawn]').getAttribute('aria-pressed') || t.q('[data-type=lawn]').getAttribute('aria-pressed') === 'false') t.q('[data-type=lawn]').click();
    t.tap(3, 3.05); // au milieu du banc (aucun coin proche)
    expect(t.q('[data-role=live]').hidden).toBe(false);
    t.tap(6, 5);
    expect(t.g.zones).toHaveLength(1);
    const p = t.g.zones[0].shape.points;
    expect(p[0].x).toBeCloseTo(3, 1); expect(p[0].y).toBeCloseTo(3.05, 1);
    t.unmount();
  });

  test('aimantation sur un coin du mobilier et sur un coin d’obstacle', async () => {
    const t = await setup();
    t.q('[data-type=lawn]') ? t.q('[data-type=lawn]').click() : t.q('[data-act=toggle-all]').click();
    const corner = itemPolygon(t.g.items[0])[0];
    t.tap(corner.x + 0.03, corner.y + 0.02);
    t.tap(8.03, 4.52);
    const p = t.g.zones[0].shape.points;
    expect(p[0].x).toBeCloseTo(corner.x, 2); expect(p[0].y).toBeCloseTo(corner.y, 2);
    expect(p[1].x).toBeCloseTo(8, 2); expect(p[2].y).toBeCloseTo(4.5, 2);
    t.unmount();
  });
});
