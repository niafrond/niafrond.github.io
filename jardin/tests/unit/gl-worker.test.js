// Logique pure du worker 3D (gl-worker-core.js) et pool synchrone.
import { runJob, placePlants, groupsFromRecords, packRecords, slimPlant, kindOf, heightFactor, transferablesOf, mulberry32 } from '../../gl-worker-core.js';
import { createPool, poolSize } from '../../gl-pool.js';
import { QUALITIES, autoQuality, isSoftwareRenderer, resolveQuality, isStrongMobileGpu, lowerQuality } from '../../gl-quality.js';
import { allPlants } from '../../catalog.js';

const P = allPlants();
const arbre = P.find((p) => p.category === 'tree');
const haie = P.find((p) => p.category === 'hedge');
const vivace = P.find((p) => p.category === 'perennial');
const plants = Object.fromEntries([arbre, haie, vivace].map((p) => [p.id, slimPlant(p)]));
const zone = (type, shape, pl) => ({ id: `z_${type}`, type, shape, plantings: pl });
const carre = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 6 }, { x: 0, y: 6 }] };

describe('répartition', () => {
  test('déterministe et dans la zone', () => {
    const z = zone('midplants', carre, [{ plantId: vivace.id, count: 12 }, { plantId: arbre.id, count: 2 }]);
    const a = placePlants(null, z, plants);
    const b = placePlants(null, z, plants);
    expect(a).toEqual(b);
    expect(a.length).toBe(14);
    expect(a.every((r) => r.x >= -0.5 && r.x <= 8.5 && r.y >= -0.5 && r.y <= 6.5)).toBe(true);
  });
  test('une haie en ligne est remplie sur la longueur', () => {
    const z = zone('hedge', { kind: 'line', points: [{ x: 0, y: 0 }, { x: 12, y: 0 }], width: 1 }, [{ plantId: haie.id, count: 1 }]);
    expect(placePlants(null, z, plants).length).toBeGreaterThan(5);
  });
  test('les formes : arbre, vivace, haie', () => {
    expect(['tree', 'conifer']).toContain(kindOf(plants[arbre.id]));
    expect(['tuft', 'mound']).toContain(kindOf(plants[vivace.id]));
    expect(heightFactor(0)).toBeCloseTo(0.35);
    expect(heightFactor(1)).toBe(1);
  });
});

describe('runJob / matrices', () => {
  const job = { zoneId: 'z', zone: zone('midplants', carre, [{ plantId: vivace.id, count: 6 }, { plantId: arbre.id, count: 1 }]), plants, age: 1, density: 1 };
  test('matrices Float32Array de 16 flottants par instance, transférables', () => {
    const r = runJob(job);
    expect(r.count).toBe(7);
    expect(r.groups.length).toBeGreaterThan(2);
    for (const g of r.groups) {
      expect(g.matrices).toBeInstanceOf(Float32Array);
      expect(g.matrices.length).toBe(g.n * 16);
      expect(g.tints.length).toBe(g.n);
      expect(g.matrices[15]).toBe(1);
    }
    expect(transferablesOf(r).length).toBe(1 + r.groups.length * 2);
  });
  test('l’âge réduit la taille sans changer le nombre d’instances', () => {
    const adulte = runJob({ ...job, age: 1 }); const jeune = runJob({ ...job, age: 0 });
    expect(jeune.groups.map((g) => g.n)).toEqual(adulte.groups.map((g) => g.n));
    const g1 = adulte.groups.find((g) => g.part === 'crown'); const g0 = jeune.groups.find((g) => g.part === 'crown');
    expect(g0.matrices[5]).toBeLessThan(g1.matrices[5]);
    const re = groupsFromRecords(adulte.rec, adulte.ids, plants, { age: 0 });
    expect(re.find((g) => g.part === 'crown').matrices[5]).toBeCloseTo(g0.matrices[5], 5);
  });
  test('la densité réduit les fleurs', () => {
    const n = (d) => (runJob({ ...job, density: d }).groups.filter((g) => g.part === 'flower').reduce((s, g) => s + g.n, 0));
    expect(n(0.3)).toBeLessThan(n(1.6));
  });
  test('le pool se replie en synchrone sans Worker', async () => {
    const pool = createPool({ forceSync: true });
    const { results, workers, ms } = await pool.run([job, job]);
    expect(workers).toBe(0); expect(ms).toBeGreaterThanOrEqual(0);
    expect(results.length).toBe(2);
    expect(poolSize(8)).toBe(7); expect(poolSize(32)).toBe(8); expect(poolSize(1)).toBe(1);
    pool.dispose();
  });
  test('packRecords / PRNG', () => {
    const { rec, ids } = packRecords([{ plantId: 'a', x: 1, y: 2, rot: 0, seed: 0.5 }, { plantId: 'b', x: 3, y: 4, rot: 1, seed: 0.2 }]);
    expect(ids).toEqual(['a', 'b']); expect(rec[10]).toBe(1);
    expect(mulberry32(5)()).toBe(mulberry32(5)());
  });
});

describe('qualité', () => {
  test('détection du GPU', () => {
    expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15)')).toBe(true);
    expect(autoQuality('Mesa llvmpipe')).toBe('low');
    expect(autoQuality('ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)')).toBe('ultra');
    expect(autoQuality('ANGLE (NVIDIA GeForce GTX 1060)')).toBe('high');
    expect(autoQuality('ANGLE (Intel, Intel(R) UHD Graphics 630)')).toBe('medium');
  });
  test('profil mobile : Basse par défaut, Moyenne si GPU costaud', () => {
    expect(autoQuality('Mali-G52', { mobile: true })).toBe('low');
    expect(autoQuality('Adreno (TM) 730', { mobile: true })).toBe('medium');
    expect(autoQuality('Apple GPU', { mobile: true })).toBe('medium');
    expect(autoQuality('SwiftShader', { mobile: true })).toBe('low');
    expect(isStrongMobileGpu('Adreno (TM) 640')).toBe(false);
  });
  test('resolveQuality mobile : ombres, pixelRatio, densité, photo bornés, MSAA selon le GPU', () => {
    const m = resolveQuality('ultra', { maxTextureSize: 16384, dpr: 3, mobile: true });
    expect(m.shadow).toBe(2048); expect(m.pixelRatio).toBe(2); expect(m.photoWidth).toBe(2048); expect(m.photoPasses).toBe(48);
    expect(m.density).toBeLessThan(QUALITIES.ultra.density); expect(m.msaa).toBe(false);
    expect(resolveQuality('medium', { mobile: true, strongGpu: true }).msaa).toBe(true);
    expect(resolveQuality('low', { mobile: true, strongGpu: true }).msaa).toBe(false);
    expect(resolveQuality('high', { maxTextureSize: 16384 }).msaa).toBe(true);
  });
  test('lowerQuality', () => { expect(lowerQuality('ultra')).toBe('high'); expect(lowerQuality('low')).toBeNull(); });
  test('shadow map bornée par maxTextureSize', () => {
    expect(resolveQuality('ultra', { maxTextureSize: 4096 }).shadow).toBe(4096);
    expect(resolveQuality('low', { maxTextureSize: 16384 }).shadow).toBe(QUALITIES.low.shadow);
    expect(resolveQuality('high', { dpr: 3 }).pixelRatio).toBe(1.5);
  });
});
