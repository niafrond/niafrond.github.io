/** @jest-environment jsdom */
import { jest } from '@jest/globals';
import { getPlantPhoto, clearPhotoMemory } from '../../photos.js';

const plant = { id: 'ls1', commonName: 'Rosier', latinName: 'Rosa gallica', wiki: 'Rosa gallica' };
const ok = { ok: true, json: async () => ({ thumbnail: { source: 'https://i/p.jpg' } }) };

beforeEach(() => { clearPhotoMemory(); localStorage.clear(); });

test('persiste le succès dans localStorage (jardin-photo:<id>) et le relit sans réseau', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return ok; };
  await getPlantPhoto(plant, { fetchImpl });
  const raw = JSON.parse(localStorage.getItem('jardin-photo:ls1'));
  expect(raw.data.url).toBe('https://i/p.jpg');
  clearPhotoMemory();
  const r = await getPlantPhoto(plant, { fetchImpl });
  expect(r.url).toBe('https://i/p.jpg');
  expect(n).toBe(1);
});

test('mémorise l’échec 24 h et ne lève jamais (stockage cassé)', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; return { ok: false }; };
  expect(await getPlantPhoto(plant, { fetchImpl })).toBeNull();
  const k = n;
  clearPhotoMemory();
  expect(await getPlantPhoto(plant, { fetchImpl })).toBeNull();
  expect(n).toBe(k);
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  clearPhotoMemory(); localStorage.clear();
  expect(await getPlantPhoto({ ...plant, id: 'q' }, { fetchImpl: async () => ok })).toEqual(expect.objectContaining({ url: 'https://i/p.jpg' }));
  spy.mockRestore();
});
