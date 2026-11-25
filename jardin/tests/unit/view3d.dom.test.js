// Détection de la vue 3D (PC et mobile) : matchMedia, WebGL2, deviceMemory simulés.
import { isView3DCapable, isDesktop3DCapable, isMobileDevice, resetWebGL2Cache } from '../../ui/view3d.js';

const realGetContext = HTMLCanvasElement.prototype.getContext;
const SWIFT = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)';
function env({ coarse = false, width = 1280, reduced = false, webgl2 = true, search = '', force = null, gpu = 'ANGLE (NVIDIA GeForce RTX 4070)', memory, cores = 8, ua = 'Mozilla/5.0 (X11; Linux)' } = {}) {
  resetWebGL2Cache();
  window.matchMedia = (q) => ({ matches: q.includes('prefers-reduced-data') ? reduced : q.includes('pointer: coarse') ? coarse : false, media: q });
  HTMLCanvasElement.prototype.getContext = function (t) {
    return t === 'webgl2' && webgl2 ? { getExtension: (n) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 1 } : null), getParameter: () => gpu } : null;
  };
  window.history.replaceState({}, '', `/${search}`);
  localStorage.clear();
  if (force) localStorage.setItem('jardin-force-3d', force);
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(navigator, 'deviceMemory', { value: memory, configurable: true });
  Object.defineProperty(navigator, 'hardwareConcurrency', { value: cores, configurable: true });
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}
afterAll(() => { HTMLCanvasElement.prototype.getContext = realGetContext; });

describe('isView3DCapable', () => {
  test('PC + WebGL2 -> oui ; alias conservé', () => { env(); expect(isView3DCapable()).toBe(true); expect(isDesktop3DCapable).toBe(isView3DCapable); });
  test('sans WebGL2 -> non, même forcé', () => { env({ webgl2: false }); expect(isView3DCapable()).toBe(false); env({ webgl2: false, search: '?3d=1' }); expect(isView3DCapable()).toBe(false); });
  test('économie de données -> non', () => { env({ reduced: true }); expect(isView3DCapable()).toBe(false); });
  test('PC avec rendu logiciel -> oui (qualité Basse)', () => { env({ gpu: SWIFT }); expect(isView3DCapable()).toBe(true); });
  test('mobile avec vrai GPU -> oui', () => { env({ coarse: true, width: 393, gpu: 'Adreno (TM) 730', memory: 8, ua: 'Mozilla/5.0 (Linux; Android 14)' }); expect(isMobileDevice()).toBe(true); expect(isView3DCapable()).toBe(true); });
  test('mobile : rendu logiciel, mémoire < 3 Go ou 1 cœur -> non', () => {
    env({ coarse: true, width: 393, gpu: SWIFT }); expect(isView3DCapable()).toBe(false);
    env({ coarse: true, width: 393, gpu: 'Mali-G52', memory: 2 }); expect(isView3DCapable()).toBe(false);
    env({ coarse: true, width: 393, gpu: 'Mali-G52', cores: 1 }); expect(isView3DCapable()).toBe(false);
    env({ coarse: true, width: 393, gpu: 'Mali-G52', memory: 4 }); expect(isView3DCapable()).toBe(true);
  });
  test('mobile : mémoire inconnue tolérée', () => { env({ coarse: true, width: 393, gpu: 'Mali-G52' }); expect(isView3DCapable()).toBe(true); });
  test('détection mobile : coarse, largeur ou UA Android', () => {
    env(); expect(isMobileDevice()).toBe(false);
    env({ width: 600 }); expect(isMobileDevice()).toBe(true);
    env({ ua: 'Mozilla/5.0 (Linux; Android 13)' }); expect(isMobileDevice()).toBe(true);
  });
  test('?3d=1 / jardin-force-3d forcent sur un mobile faible', () => {
    env({ coarse: true, width: 393, gpu: SWIFT, search: '?3d=1' }); expect(isView3DCapable()).toBe(true);
    env({ coarse: true, width: 393, gpu: SWIFT, force: '1' }); expect(isView3DCapable()).toBe(true);
    env({ coarse: true, width: 393, gpu: SWIFT, force: '0' }); expect(isView3DCapable()).toBe(false);
  });
});
