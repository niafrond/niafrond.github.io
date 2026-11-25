/** @jest-environment jsdom */
// Toucher le 1er point d'une forme en cours (≥ 3 points) la ferme, dans tous les éditeurs de formes.
import { createGarden } from '../../model.js';
import { mountZoneEditor, mountContourEditor, mountSunPainter } from '../../ui/draw.js';
import { mountItemEditor } from '../../ui/draw-items.js';

const sleep = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const RECT = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

async function monter(mount, prep) {
  const g = createGarden('Fermer');
  g.boundary = RECT(0, 0, 12, 8); g.boundaryClosed = true;
  if (prep) prep(g);
  const el = document.createElement('div'); document.body.append(el);
  const un = mount(el, { garden: g, onChange() {} });
  await sleep(100);
  const svg = el.querySelector('.jd-svg');
  const fire = (type, x, y) => {
    const vb = svg.getAttribute('viewBox').split(' ').map(Number);
    const mpp = vb[2] / 390;
    const ev = new MouseEvent(type, { clientX: (x - vb[0]) / mpp, clientY: (y - vb[1]) / mpp, bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: 1 }); Object.defineProperty(ev, 'pointerType', { value: 'touch' });
    svg.dispatchEvent(ev);
  };
  const tap = (x, y) => { fire('pointerdown', x, y); fire('pointerup', x, y); };
  const click = (s) => { const b = el.querySelector(s); if (!b) throw new Error('introuvable : ' + s); b.click(); };
  return { g, el, un, tap, click };
}

afterEach(() => { document.body.innerHTML = ''; });

test('zones : toucher le 1er point ferme la forme libre', async () => {
  const t = await monter(mountZoneEditor);
  t.click('[data-type=lawn]'); t.click('[data-act=mode-free]');
  t.tap(2, 2); t.tap(8, 2); t.tap(8, 6);
  expect(t.g.zones).toHaveLength(0);
  t.tap(2.05, 2.05); // retour sur le 1er point
  expect(t.g.zones).toHaveLength(1);
  expect(t.g.zones[0].shape.points).toHaveLength(3);
  t.un();
});

test('zones : avec moins de 3 points, toucher le 1er point n’y met pas fin', async () => {
  const t = await monter(mountZoneEditor);
  t.click('[data-type=lawn]'); t.click('[data-act=mode-free]');
  t.tap(2, 2); t.tap(8, 2);
  t.tap(2, 2);
  expect(t.g.zones).toHaveLength(0);
  t.un();
});

test('contour : obstacle polygonal fermé en touchant son 1er point', async () => {
  const t = await monter(mountContourEditor);
  t.click('[data-act=tool]');
  const rect = t.el.querySelector('input[type=checkbox]'); // « Rectangle en 2 touches »
  if (rect && rect.checked) { rect.checked = false; rect.dispatchEvent(new Event('change')); }
  t.tap(2, 2); t.tap(6, 2); t.tap(6, 5);
  expect(t.g.obstacles).toHaveLength(0);
  t.tap(2, 2);
  expect(t.g.obstacles).toHaveLength(1);
  expect(t.g.obstacles[0].points).toHaveLength(3);
  t.un();
});

test('ensoleillement : polygone peint fermé en touchant son 1er point', async () => {
  const t = await monter(mountSunPainter, (g) => { g.sun = { mode: 'map', uniform: null, regions: [] }; });
  t.click('[data-act=tool-polygon]');
  t.tap(2, 2); t.tap(8, 2); t.tap(8, 6);
  expect(t.g.sun.regions).toHaveLength(0);
  t.tap(2, 2);
  expect(t.g.sun.regions).toHaveLength(1);
  expect(t.g.sun.regions[0].points).toHaveLength(3);
  t.un();
});

test('aménagements : un mur libre se referme en boucle en touchant son 1er point', async () => {
  const t = await monter(mountItemEditor);
  t.click('[data-tab=edges]');
  t.click('[data-act=draft-wall]');
  t.tap(2, 2); t.tap(8, 2); t.tap(8, 6);
  expect(t.g.obstacles).toHaveLength(0);
  t.tap(2, 2);
  expect(t.g.obstacles).toHaveLength(1);
  const pts = t.g.obstacles[0].points;
  expect(pts).toHaveLength(4);
  expect(pts[3]).toEqual(pts[0]);
  t.un();
});
