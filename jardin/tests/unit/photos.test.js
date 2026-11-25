import { getPlantPhoto, photoTitles, clearPhotoMemory, CREDIT } from '../../photos.js';

const plant = (o = {}) => ({ id: 'rosa', commonName: 'Rosier', latinName: 'Rosa gallica var. officinalis', wiki: 'Rosa gallica', ...o });
const ok = (src) => ({ ok: true, json: async () => ({ type: 'standard', thumbnail: { source: src }, content_urls: { desktop: { page: 'https://fr.wikipedia.org/wiki/X' } } }) });
const miss = { ok: false, status: 404, json: async () => ({}) };
const memCache = () => { const m = new Map(); return { get: (k) => m.get(k), set: (k, v) => m.set(k, v), m }; };

beforeEach(() => clearPhotoMemory());

test('titres : wiki, nom latin (2 mots), nom commun, sans doublon', () => {
  expect(photoTitles(plant())).toEqual(['Rosa gallica', 'Rosier']);
  expect(photoTitles(plant({ wiki: null }))).toEqual(['Rosa gallica', 'Rosier']);
  expect(photoTitles(plant({ wiki: 'Rose' }))).toEqual(['Rose', 'Rosa gallica', 'Rosier']);
});

test('succès : url, crédit et page ; l’URL de l’API est encodée', async () => {
  const calls = [];
  const fetchImpl = async (u) => { calls.push(u); return ok('https://upload.wikimedia.org/x/320px-a.jpg'); };
  const r = await getPlantPhoto(plant(), { fetchImpl, cache: memCache() });
  expect(calls[0]).toBe('https://fr.wikipedia.org/api/rest_v1/page/summary/Rosa_gallica');
  expect(r.url).toBe('https://upload.wikimedia.org/x/320px-a.jpg');
  expect(r.medium).toContain('/640px-');
  expect(r.credit).toBe(CREDIT);
  expect(r.page).toBe('https://fr.wikipedia.org/wiki/X');
});

test('essais successifs puis échec silencieux', async () => {
  const seen = [];
  const f1 = async (u) => { seen.push(u); return seen.length < 3 ? miss : ok('https://i/p.jpg'); };
  expect((await getPlantPhoto(plant({ wiki: 'Rose' }), { fetchImpl: f1, cache: memCache() })).url).toBe('https://i/p.jpg');
  expect(seen).toHaveLength(3);
  const boom = async () => { throw new Error('réseau'); };
  expect(await getPlantPhoto(plant({ id: 'b' }), { fetchImpl: boom, cache: memCache() })).toBeNull();
  const noThumb = async () => ({ ok: true, json: async () => ({ type: 'standard' }) });
  expect(await getPlantPhoto(plant({ id: 'c' }), { fetchImpl: noThumb, cache: memCache() })).toBeNull();
  const dis = async () => ({ ok: true, json: async () => ({ type: 'disambiguation', thumbnail: { source: 'x' } }) });
  expect(await getPlantPhoto(plant({ id: 'd' }), { fetchImpl: dis, cache: memCache() })).toBeNull();
  expect(await getPlantPhoto(null)).toBeNull();
});

test('cache : succès 30 jours, échec 24 h', async () => {
  const cache = memCache();
  let n = 0;
  const fetchImpl = async () => { n++; return ok('https://i/p.jpg'); };
  const t0 = 1_000_000;
  await getPlantPhoto(plant(), { fetchImpl, cache, now: t0 });
  await getPlantPhoto(plant(), { fetchImpl, cache, now: t0 + 29 * 86400e3 });
  expect(n).toBe(1);
  await getPlantPhoto(plant(), { fetchImpl, cache, now: t0 + 31 * 86400e3 });
  expect(n).toBe(2);
  const c2 = memCache();
  let m = 0;
  const bad = async () => { m++; return miss; };
  await getPlantPhoto(plant({ id: 'z', wiki: null, latinName: 'Z z', commonName: 'Zed' }), { fetchImpl: bad, cache: c2, now: t0 });
  const after = m;
  expect(await getPlantPhoto(plant({ id: 'z' }), { fetchImpl: bad, cache: c2, now: t0 + 23 * 3600e3 })).toBeNull();
  expect(m).toBe(after);
  await getPlantPhoto(plant({ id: 'z', wiki: null, latinName: 'Z z', commonName: 'Zed' }), { fetchImpl: bad, cache: c2, now: t0 + 25 * 3600e3 });
  expect(m).toBeGreaterThan(after);
});

test('au plus 3 requêtes en parallèle', async () => {
  let cur = 0, max = 0;
  const fetchImpl = async () => { cur++; max = Math.max(max, cur); await new Promise((r) => setTimeout(r, 5)); cur--; return ok('https://i/p.jpg'); };
  const ps = Array.from({ length: 10 }, (_, i) => getPlantPhoto(plant({ id: 'p' + i, wiki: 'T' + i }), { fetchImpl, cache: memCache() }));
  const res = await Promise.all(ps);
  expect(res.every((r) => r && r.url)).toBe(true);
  expect(max).toBeLessThanOrEqual(3);
  expect(max).toBeGreaterThan(1);
});

test('requêtes simultanées de la même essence : une seule recherche', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return ok('https://i/p.jpg'); };
  const [a, b] = await Promise.all([getPlantPhoto(plant({ id: 'same' }), { fetchImpl }), getPlantPhoto(plant({ id: 'same' }), { fetchImpl })]);
  expect(a).toEqual(b);
  expect(n).toBe(1);
});
