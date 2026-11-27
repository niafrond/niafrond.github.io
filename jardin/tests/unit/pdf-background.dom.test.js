import { jest } from '@jest/globals';
import { openPdfDialog } from '../../ui/pdf-dialog.js';
import { mountPdfReady } from '../../ui/pdf-ready.js';
import { saveReady, loadReady, clearReady } from '../../pdf-ready.js';
import { notifyNow } from '../../notify.js';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
beforeEach(async () => { document.body.innerHTML = ''; localStorage.clear(); await clearReady(); });

test('en arrière-plan : la fenêtre se ferme, le PDF est gardé, une notification part, le bandeau propose le téléchargement', async () => {
  let finish;
  const build = jest.fn((g, o, env) => new Promise((res) => { env.onProgress({ label: 'plan 1/3…', step: 1, total: 4 }); finish = () => res({ bytes: new Uint8Array([37, 80, 68, 70]), filename: 'jardin-x-plan.pdf' }); }));
  const notify = jest.fn(async () => true); const openSave = jest.fn();
  const banner = mountPdfReady({ deps: { openSave } });
  openPdfDialog({ garden: { name: 'x' }, deps: { build, rasterize: async () => null, photo: null, notify, ensurePermission: async () => true, openSave: jest.fn() } });
  document.querySelector('[data-act=pdf-go]').click();
  await tick(10);
  document.querySelector('[data-act=pdf-background]').click();
  expect(document.querySelector('[data-role=pdf-dialog]')).toBeNull();
  expect(banner.el.hidden).toBe(false);
  expect(banner.el.textContent).toContain('Génération du PDF');
  finish(); await tick(40);
  expect(notify.mock.calls[0][0].title).toMatch(/prêt/);
  const r = await loadReady(); expect(r.filename).toBe('jardin-x-plan.pdf'); expect(r.blob.size).toBe(4);
  expect(banner.el.textContent).toContain('Le PDF est prêt');
  banner.el.querySelector('[data-act=pdf-ready-open]').click();
  expect(openSave).toHaveBeenCalledWith(expect.objectContaining({ filename: 'jardin-x-plan.pdf', mime: 'application/pdf' }));
  banner.el.querySelector('[data-act=pdf-ready-dismiss]').click(); await tick(10);
  expect(await loadReady()).toBeNull(); expect(banner.el.hidden).toBe(true);
  banner.destroy();
});

test('annuler depuis le bandeau interrompt la génération détachée', async () => {
  let aborted = false;
  const build = (g, o, env) => new Promise((res, rej) => env.signal.addEventListener('abort', () => { aborted = true; rej(Object.assign(new Error('x'), { name: 'AbortError' })); }));
  const banner = mountPdfReady();
  openPdfDialog({ garden: {}, deps: { build, rasterize: async () => null, photo: null, notify: async () => true, ensurePermission: async () => true } });
  document.querySelector('[data-act=pdf-go]').click(); await tick(10);
  document.querySelector('[data-act=pdf-background]').click();
  banner.el.querySelector('[data-act=pdf-ready-cancel]').click(); await tick(10);
  expect(aborted).toBe(true); expect(banner.el.hidden).toBe(true); banner.destroy();
});

test('notifyNow : plugin Capacitor, refus de permission, repli web', async () => {
  const schedule = jest.fn(async () => ({}));
  expect(await notifyNow({ title: 'T', body: 'B' }, { plugin: { schedule, checkPermissions: async () => ({ display: 'granted' }) } })).toBe(true);
  expect(schedule.mock.calls[0][0].notifications[0]).toMatchObject({ title: 'T', extra: { source: 'jardin-pdf' } });
  expect(await notifyNow({ title: 'T', body: 'B' }, { plugin: { schedule, checkPermissions: async () => ({ display: 'denied' }) } })).toBe(false);
  expect(await notifyNow({ title: 'T', body: 'B' })).toBe(false); // jsdom : pas de Notification
});

test('saveReady / loadReady / clearReady (repli mémoire)', async () => {
  await saveReady({ filename: 'a.pdf', bytes: new Uint8Array([1, 2, 3]) });
  expect((await loadReady()).size).toBe(3);
  await clearReady(); expect(await loadReady()).toBeNull();
});
