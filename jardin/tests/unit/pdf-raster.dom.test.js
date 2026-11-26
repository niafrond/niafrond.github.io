import { jest } from '@jest/globals';
import { rasterizeSVG, cleanSvgForImage, xmlProblem, loadSvg, RasterError } from '../../pdf-raster.js';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="NaN" height="10"/><text>a & b \u0001 \ud800</text></svg>';
const fakeCanvas = (fail = []) => (w, h) => ({ width: w, height: h, toBlob: (cb) => cb({ arrayBuffer: async () => new Uint8Array([0xff, 0xd8, 1, 2]).buffer }), getContext: () => ({ fillRect() {}, fillStyle: '', drawImage() { if (fail.includes(w)) throw new Error('mémoire'); }, getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4) }) }) });
/** Image simulée : échoue les `failures` premières fois (src), puis réussit. */
const imageClass = (failures, log = []) => { let n = 0; return class { set src(v) { log.push(String(v).slice(0, 10)); const ok = ++n > failures; setTimeout(() => (ok ? this.onload && this.onload() : this.onerror && this.onerror()), 0); } decode() { return Promise.resolve(); } }; };
const URLm = { createObjectURL: jest.fn(() => 'blob:abc'), revokeObjectURL: jest.fn() };

describe('pdf-raster : nettoyage, validation, repli', () => {
  test('nettoyage : XML valide, nombres finis, dimensions garanties', () => {
    const c = cleanSvgForImage(SVG);
    expect(c).not.toMatch(/NaN|\u0001|\ud800/); expect(c).toContain('a &amp; b');
    expect(xmlProblem(c)).toBeNull();
    expect(xmlProblem('<svg xmlns="http://www.w3.org/2000/svg"><a></svg>')).toMatch(/\S/);
    const w = cleanSvgForImage('<svg width="0" height="x"><g/></svg>', { width: 300, height: 200 });
    expect(w).toContain('xmlns="http://www.w3.org/2000/svg"'); expect(w).toContain('viewBox="0 0 300 200"');
    expect(() => cleanSvgForImage('pas du svg')).toThrow();
    expect(cleanSvgForImage('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 9 9"><filter id="f"><x/></filter><g filter="url(#f)" style="a:b"/></svg>', { strict: true })).not.toMatch(/filter|style/);
  });
  test('chargement : échoue au 1er et au 2e essai (blob, data), réussit au 3e (bitmap)', async () => {
    const log = [];
    const cib = jest.fn(async () => ({ close() {} }));
    const r = await loadSvg(cleanSvgForImage(SVG), { Image: imageClass(2, log), URL: URLm, createImageBitmap: cib });
    expect(r.via).toBe('bitmap'); expect(log).toEqual(['blob:abc', 'data:image']);
    expect(URLm.revokeObjectURL).toHaveBeenCalled(); // révoqué après l'échec seulement
  });
  test('rasterisation : image chargée, le blob n\'est révoqué qu\'après le dessin', async () => {
    const order = [];
    const U = { createObjectURL: () => 'blob:x', revokeObjectURL: () => order.push('revoke') };
    const canvas = (w, h) => { const c = fakeCanvas()(w, h); const gc = c.getContext; c.getContext = () => { const x = gc(); const d = x.drawImage; x.drawImage = () => { order.push('draw'); return d(); }; return x; }; return c; };
    const out = await rasterizeSVG(SVG, { width: 100, height: 50, pxWidth: 400, pxHeight: 200 }, { Image: imageClass(0), URL: U, createCanvas: canvas });
    expect(out.type).toBe('jpeg'); expect(out.width).toBe(400);
    expect(order.filter((x) => x === 'draw').length).toBe(1); expect(order[order.length - 1]).toBe('revoke');
  });
  test('repli de résolution quand le canvas est trop gros', async () => {
    const out = await rasterizeSVG(SVG, { width: 100, height: 50, pxWidth: 1000, pxHeight: 500 }, { Image: imageClass(0), URL: URLm, createCanvas: fakeCanvas([1000, 700]) });
    expect(out.width).toBe(480); expect(out.scale).toBe(0.48);
  });
  test('échec total : message explicite et diagnostic', async () => {
    const p = rasterizeSVG(SVG, { width: 100, height: 50 }, { Image: imageClass(99), URL: URLm, createCanvas: fakeCanvas(), createImageBitmap: async () => { throw new Error('SVG non supporté'); } });
    await expect(p).rejects.toBeInstanceOf(RasterError);
    const e = await p.catch((x) => x);
    expect(e.message).toBe('image'); expect(e.diag.causes.length).toBeGreaterThanOrEqual(6); expect(e.diag.svgKb).toBeGreaterThanOrEqual(0); expect(e.diag.elements).toBeGreaterThan(1);
    expect(e.diag.causes.join(' ')).toMatch(/blob.*data.*bitmap/);
  });
  test('rgba : données brutes', async () => {
    const out = await rasterizeSVG(SVG, { width: 100, height: 50, pxWidth: 80, pxHeight: 40, type: 'rgba' }, { Image: imageClass(0), URL: URLm, createCanvas: fakeCanvas() });
    expect(out.type).toBe('rgba'); expect(out.data.length).toBe(80 * 40 * 4);
  });
});
