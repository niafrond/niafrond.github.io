import { jest } from '@jest/globals';
import { openPdfDialog, toPdfOptions } from '../../ui/pdf-dialog.js';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('fenêtre Exporter en PDF', () => {
  test('options par défaut et conversion', () => {
    openPdfDialog({ garden: { name: 'x' } });
    const q = (k) => document.querySelector(`[data-opt=${k}]`);
    expect(q('format').value).toBe('a4'); expect(q('month').value).toBe('');
    for (const k of ['l1', 'l2', 'l3', 'photos', 'layers', 'zonePages', 'advice', 'shopping']) expect(q(k).checked).toBe(true);
    expect(q('iso').checked).toBe(false);
    q('l2').checked = false; q('l2').dispatchEvent(new Event('change'));
    q('format').value = 'a3'; q('format').dispatchEvent(new Event('change'));
    q('month').value = '5'; q('month').dispatchEvent(new Event('change'));
    document.querySelector('[data-act=pdf-cancel]').click();
    expect(toPdfOptions({ format: 'a3', l1: true, l2: false, l3: true, photos: false, iso: true, layers: true, month: '5' })).toMatchObject({ format: 'a3', levels: { 1: true, 2: false, 3: true }, photos: false, iso: true, month: 5 });
    expect(document.querySelector('[data-role=pdf-dialog]')).toBeNull();
  });
  test('génération : progression puis fenêtre Fichier prêt avec le blob PDF', async () => {
    const build = jest.fn(async (g, o, env) => { env.onProgress({ label: 'plan niveau 1/3…', step: 1, total: 4 }); await tick(); return { bytes: new Uint8Array([37, 80, 68, 70]), filename: 'jardin-x-plan.pdf' }; });
    const openSave = jest.fn();
    const d = openPdfDialog({ garden: { name: 'x' }, deps: { build, rasterize: async () => null, photo: null, openSave } });
    document.querySelector('[data-act=pdf-go]').click();
    await tick(1);
    expect(document.querySelector('[data-role=pdf-progress]').value).toBe(25);
    expect(document.querySelector('[data-role=pdf-status]').textContent).toContain('plan niveau 1/3');
    await tick(20);
    expect(build).toHaveBeenCalledTimes(1);
    expect(openSave).toHaveBeenCalledWith(expect.objectContaining({ filename: 'jardin-x-plan.pdf', mime: 'application/pdf' }));
    expect(openSave.mock.calls[0][0].blob.size).toBe(4);
    expect(document.querySelector('[data-role=pdf-dialog]')).toBeNull();
    void d;
  });
  test('annulation pendant la génération', async () => {
    const build = jest.fn((g, o, env) => new Promise((res, rej) => env.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))));
    const openSave = jest.fn();
    openPdfDialog({ garden: {}, deps: { build, rasterize: async () => null, photo: null, openSave } });
    document.querySelector('[data-act=pdf-go]').click();
    await tick(5);
    document.querySelector('[data-act=pdf-cancel]').click();
    await tick(5);
    expect(openSave).not.toHaveBeenCalled();
    expect(document.querySelector('[data-role=pdf-error]').textContent).toContain('annulée');
    expect(document.querySelector('[data-role=pdf-form]').hidden).toBe(false);
  });
  test('erreur de génération affichée', async () => {
    const build = async () => { throw new Error('boum'); };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    openPdfDialog({ garden: {}, deps: { build, rasterize: async () => null, photo: null, openSave: jest.fn() } });
    document.querySelector('[data-act=pdf-go]').click();
    await tick(10);
    expect(document.querySelector('[data-role=pdf-error]').textContent).toContain('boum');
    spy.mockRestore();
  });
});
