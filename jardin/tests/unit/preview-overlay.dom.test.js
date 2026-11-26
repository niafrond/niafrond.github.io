/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { openPreview } from '../../ui/preview-overlay.js';
import { createGarden, createZone } from '../../model.js';

const rect = (x, y, w, h) => ({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] });
function jardin() {
  const g = createGarden('Test');
  g.boundary = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }];
  g.boundaryClosed = true;
  g.sun = { mode: 'uniform', uniform: 'full', regions: [] };
  const a = createZone('midplants', rect(0, 0, 6, 4)); a.label = 'Massif'; a.plantings = [{ plantId: 'h-astilbe', count: 4 }];
  const b = createZone('lawn', rect(0, 4, 12, 4)); b.label = 'Pelouse';
  g.zones = [a, b];
  return g;
}
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; });
const fake3d = (capable) => {
  const un = jest.fn();
  return { un, mod: { isView3DCapable: () => capable, mountView3D: jest.fn((host) => { host.append(Object.assign(document.createElement('canvas'), {})); return un; }) } };
};

test('onglets, zone en cours et légende des essences', () => {
  const g = jardin();
  const pv = openPreview(g, { zoneId: g.zones[0].id, view3d: fake3d(false).mod });
  const root = document.querySelector('[data-role=preview-overlay]');
  expect([...root.querySelectorAll('[role=tab]')].map((t) => t.textContent)).toEqual(['🗺️ Zones', '🧊 Vue 3D', '📐 Isométrique']);
  expect(root.querySelector('[data-panel=zones]').hidden).toBe(false);
  expect(root.querySelector('[data-panel=zones] svg')).toBeTruthy();
  expect(root.querySelector(`g[data-zone="${g.zones[0].id}"]`).classList.contains('pv-sel')).toBe(true);
  expect(root.querySelector('[data-role=preview-zone-name]').textContent).toContain('Massif');
  expect(root.querySelector('[data-role=preview-legend]').textContent).toContain('Astilbe');
  root.querySelector('[data-tab=iso]').click();
  expect(root.querySelector('[data-panel=iso]').hidden).toBe(false);
  expect(root.querySelector('[data-panel=iso] svg')).toBeTruthy();
  expect(root.querySelectorAll('button[data-view]')).toHaveLength(4);
  pv.close();
});

test('toucher une zone la sélectionne sans fermer', () => {
  const g = jardin();
  const onSelectZone = jest.fn();
  openPreview(g, { zoneId: g.zones[0].id, onSelectZone, view3d: fake3d(false).mod });
  const target = document.querySelector(`g[data-zone="${g.zones[1].id}"]`);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(onSelectZone).toHaveBeenCalledWith(g.zones[1].id);
  expect(target.classList.contains('pv-sel')).toBe(true);
  expect(document.querySelector('[data-role=preview-overlay]')).toBeTruthy();
});

test('repli sans WebGL : message et vue isométrique', async () => {
  const g = jardin();
  openPreview(g, { tab: '3d', view3d: fake3d(false).mod });
  await wait(5);
  const fb = document.querySelector('[data-role=preview-3d-fallback]');
  expect(fb.hidden).toBe(false);
  expect(fb.textContent).toContain('Vue 3D indisponible sur cet appareil');
  expect(fb.querySelector('svg')).toBeTruthy();
});

test('vue 3D montée puis démontée à la fermeture et au changement d’onglet', async () => {
  const g = jardin();
  const f = fake3d(true);
  const onClose = jest.fn();
  const pv = openPreview(g, { tab: '3d', view3d: f.mod, onClose });
  await wait(5);
  expect(f.mod.mountView3D).toHaveBeenCalledTimes(1);
  expect(f.mod.mountView3D.mock.calls[0][1].garden).toBe(g);
  pv.setTab('zones');
  expect(f.un).toHaveBeenCalledTimes(1);
  pv.setTab('3d'); await wait(5);
  expect(f.mod.mountView3D).toHaveBeenCalledTimes(2);
  pv.close();
  expect(f.un).toHaveBeenCalledTimes(2);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[data-role=preview-overlay]')).toBeNull();
});

test('fermeture : bouton, Échap, retour Android ; reflète les plantations non enregistrées', () => {
  const g = jardin();
  let pv = openPreview(g, { view3d: fake3d(false).mod });
  document.querySelector('[data-act=preview-close]').click();
  expect(document.querySelector('[data-role=preview-overlay]')).toBeNull();
  const onClose = jest.fn();
  g.zones[1].plantings = [{ plantId: 'h-molinie', count: 2 }];
  pv = openPreview(g, { onClose, view3d: fake3d(false).mod });
  expect(document.querySelector('[data-role=preview-legend]').textContent).toContain('Molinie');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector('[data-role=preview-overlay]')).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
  pv = openPreview(g, { onClose, view3d: fake3d(false).mod });
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(document.querySelector('[data-role=preview-overlay]')).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(2);
});
