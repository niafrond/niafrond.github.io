// Détection PC de la vue 3D : matchMedia et WebGL2 simulés.
import { isDesktop3DCapable, resetWebGL2Cache } from '../../ui/view3d.js';

const realGetContext = HTMLCanvasElement.prototype.getContext;
function env({ desktop = true, reduced = false, webgl2 = true, search = '', force = null } = {}) {
  resetWebGL2Cache();
  window.matchMedia = (q) => ({ matches: q.includes('prefers-reduced-data') ? reduced : desktop, media: q });
  HTMLCanvasElement.prototype.getContext = function (t) { return t === 'webgl2' && webgl2 ? { getExtension: () => null } : null; };
  window.history.replaceState({}, '', `/${search}`);
  localStorage.clear();
  if (force) localStorage.setItem('jardin-force-3d', force);
}
afterAll(() => { HTMLCanvasElement.prototype.getContext = realGetContext; });

describe('isDesktop3DCapable', () => {
  test('PC + WebGL2 → oui', () => { env(); expect(isDesktop3DCapable()).toBe(true); });
  test('mobile / tactile → non', () => { env({ desktop: false }); expect(isDesktop3DCapable()).toBe(false); });
  test('sans WebGL2 → non, même forcé', () => { env({ webgl2: false }); expect(isDesktop3DCapable()).toBe(false); env({ webgl2: false, search: '?3d=1' }); expect(isDesktop3DCapable()).toBe(false); });
  test('économie de données → non', () => { env({ reduced: true }); expect(isDesktop3DCapable()).toBe(false); });
  test('?3d=1 force sur mobile', () => { env({ desktop: false, search: '?3d=1' }); expect(isDesktop3DCapable()).toBe(true); });
  test('localStorage jardin-force-3d force', () => { env({ desktop: false, force: '1' }); expect(isDesktop3DCapable()).toBe(true); env({ desktop: false, force: '0' }); expect(isDesktop3DCapable()).toBe(false); });
  test('sans matchMedia → non', () => { env(); delete window.matchMedia; expect(isDesktop3DCapable()).toBe(false); });
});
