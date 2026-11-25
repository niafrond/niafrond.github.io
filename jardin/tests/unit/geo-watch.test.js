// watchFix : suivi continu de la position (navigator.geolocation et plugin Capacitor), erreurs en français, écran allumé.
import { jest } from '@jest/globals';
import { watchFix, geoErrorMessage, keepScreenOn } from '../../geo.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeGeo() {
  const g = { cbs: null, opts: null, cleared: [], watchPosition(ok, ko, opts) { g.cbs = { ok, ko }; g.opts = opts; return 42; }, clearWatch(id) { g.cleared.push(id); } };
  return g;
}
function install(geo, wake) {
  const nav = globalThis.navigator;
  Object.defineProperty(nav, 'geolocation', { configurable: true, value: geo });
  Object.defineProperty(nav, 'wakeLock', { configurable: true, value: wake });
}
const pos = (lat, lon, accuracy, timestamp = 1700000000000) => ({ coords: { latitude: lat, longitude: lon, accuracy, speed: null, heading: null }, timestamp });

afterEach(() => { delete globalThis.Capacitor; Object.defineProperty(globalThis.navigator, 'wakeLock', { configurable: true, value: undefined }); });

describe('watchFix (navigateur)', () => {
  test('haute précision sans cache, relaie chaque position', async () => {
    const geo = fakeGeo(); install(geo, undefined);
    const got = [];
    const stop = watchFix((f) => got.push(f));
    await flush();
    expect(geo.opts).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
    geo.cbs.ok(pos(47.2, -1.55, 4.5));
    geo.cbs.ok(pos(47.2001, -1.55, 3));
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ lat: 47.2, lon: -1.55, accuracy: 4.5, t: 1700000000000 });
    stop();
    expect(geo.cleared).toEqual([42]);
    geo.cbs.ok(pos(1, 1, 1));
    expect(got).toHaveLength(2); // plus de relais après stop()
    stop(); // idempotent
    expect(geo.cleared).toEqual([42]);
  });

  test.each([
    [1, 'denied', /refusée/],
    [2, 'unavailable', /indisponible/],
    [3, 'timeout', /trop de temps/],
  ])('erreur %i → code %s et message en français', async (n, code, re) => {
    const geo = fakeGeo(); install(geo, undefined);
    const errs = [];
    watchFix(() => {}, { onError: (e) => errs.push(e) });
    await flush();
    geo.cbs.ko({ code: n });
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe(code);
    expect(errs[0].message).toMatch(re);
  });

  test('géolocalisation non prise en charge', async () => {
    install(undefined, undefined);
    const errs = [];
    watchFix(() => {}, { onError: (e) => errs.push(e) });
    await flush();
    expect(errs[0]).toMatchObject({ code: 'unsupported' });
    expect(errs[0].message).toMatch(/indisponible sur cet appareil/);
  });

  test('geoErrorMessage : codes numériques et textuels', () => {
    expect(geoErrorMessage({ code: 1 })).toMatch(/refusée/);
    expect(geoErrorMessage({ code: 'timeout' })).toMatch(/trop de temps/);
    expect(geoErrorMessage(null)).toMatch(/Signal GPS indisponible/);
  });
});

describe('watchFix (Capacitor)', () => {
  test('permission demandée puis suivi ; clearWatch à l\'arrêt', async () => {
    const calls = [];
    let handler = null;
    globalThis.Capacitor = { Plugins: { Geolocation: {
      checkPermissions: async () => { calls.push('check'); return { location: 'prompt' }; },
      requestPermissions: async () => { calls.push('request'); return { location: 'granted' }; },
      watchPosition: async (opts, cb) => { calls.push(['watch', opts]); handler = cb; return 'w1'; },
      clearWatch: async ({ id }) => { calls.push(['clear', id]); },
    } } };
    const got = [];
    const stop = watchFix((f) => got.push(f), { keepAwake: false });
    await flush(); await flush();
    expect(calls.slice(0, 2)).toEqual(['check', 'request']);
    expect(calls[2][1]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
    handler(pos(45, 3, 2.2), undefined);
    expect(got[0]).toMatchObject({ lat: 45, lon: 3, accuracy: 2.2 });
    stop();
    expect(calls[calls.length - 1]).toEqual(['clear', 'w1']);
  });

  test('permission refusée → erreur « denied » sans démarrer le suivi', async () => {
    const watch = jest.fn();
    globalThis.Capacitor = { Plugins: { Geolocation: {
      checkPermissions: async () => ({ location: 'denied' }), requestPermissions: async () => ({ location: 'denied' }), watchPosition: watch, clearWatch: () => {},
    } } };
    const errs = [];
    watchFix(() => {}, { onError: (e) => errs.push(e), keepAwake: false });
    await flush(); await flush();
    expect(errs[0].code).toBe('denied');
    expect(watch).not.toHaveBeenCalled();
  });
});

describe('maintien de l\'écran allumé', () => {
  test('wakeLock demandé au démarrage et libéré à l\'arrêt', async () => {
    const geo = fakeGeo();
    const sentinel = { released: false, release: jest.fn(async () => { sentinel.released = true; }) };
    const request = jest.fn(async () => sentinel);
    install(geo, { request });
    const stop = watchFix(() => {});
    await flush(); await flush();
    expect(request).toHaveBeenCalledWith('screen');
    stop();
    expect(sentinel.release).toHaveBeenCalled();
  });

  test('repli silencieux : API absente ou refus', async () => {
    install(fakeGeo(), undefined);
    expect(() => keepScreenOn()()).not.toThrow();
    install(fakeGeo(), { request: async () => { throw new Error('NotAllowedError'); } });
    const errs = [];
    const stop = watchFix(() => {}, { onError: (e) => errs.push(e) });
    await flush(); await flush();
    expect(errs).toEqual([]);
    expect(() => stop()).not.toThrow();
  });
});
