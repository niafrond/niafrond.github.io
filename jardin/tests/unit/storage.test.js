import { createStorage, createMemoryBackend, defaultSettings } from '../../storage.js';
import { createGarden, createZone } from '../../model.js';

const nouveau = () => createStorage(createMemoryBackend());
const jardin = (nom = 'J') => {
  const g = createGarden(nom);
  g.boundary = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }];
  g.boundaryClosed = true;
  g.zones.push(createZone('lawn', { kind: 'polygon', points: g.boundary }));
  return g;
};
const attendre = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe('CRUD', () => {
  test('save / get / list / delete', async () => {
    const s = nouveau();
    const g = jardin('A');
    const avant = g.updatedAt;
    await attendre();
    await s.saveGarden(g);
    expect(g.updatedAt > avant).toBe(true);
    expect((await s.getGarden(g.id)).name).toBe('A');
    expect(await s.getGarden('nope')).toBeNull();
    await attendre();
    const h = jardin('B');
    await s.saveGarden(h);
    expect((await s.listGardens()).map((x) => x.name)).toEqual(['B', 'A']);
    await s.deleteGarden(g.id);
    expect((await s.listGardens()).map((x) => x.name)).toEqual(['B']);
  });
  test('les données stockées sont isolées de l’objet passé', async () => {
    const s = nouveau();
    const g = jardin();
    await s.saveGarden(g);
    g.name = 'modifié sans sauvegarde';
    expect((await s.getGarden(g.id)).name).toBe('J');
  });
  test('saveGarden sans id', async () => {
    await expect(nouveau().saveGarden({})).rejects.toThrow(/identifiant/);
  });
  test('duplicateGarden : variante en brouillon', async () => {
    const s = nouveau();
    const g = jardin('Orig'); g.status = 'validated'; g.plan = { svg: '<svg/>', validatedAt: 'x' };
    await s.saveGarden(g);
    const d = await s.duplicateGarden(g.id);
    expect(d.id).not.toBe(g.id);
    expect(d.name).toBe('Orig (variante)');
    expect(d.status).toBe('draft');
    expect(d.plan.svg).toBeNull();
    expect(d.zones).toHaveLength(1);
    expect(await s.listGardens()).toHaveLength(2);
    expect(await s.duplicateGarden('nope')).toBeNull();
  });
  test('méthodes utilisables détachées', async () => {
    const { saveGarden, duplicateGarden } = nouveau();
    const g = jardin();
    await saveGarden(g);
    expect((await duplicateGarden(g.id)).id).toBeTruthy();
  });
});

describe('export / import', () => {
  test('aller-retour avec nouvel id', async () => {
    const s = nouveau();
    const g = jardin('Export');
    const json = s.exportGarden(g);
    expect(JSON.parse(json).format).toBe('jardin-v1');
    const imp = await s.importGarden(json);
    expect(imp.id).not.toBe(g.id);
    expect(imp.name).toBe('Export');
    expect(imp.boundary).toEqual(g.boundary);
    expect((await s.listGardens()).map((x) => x.id)).toEqual([imp.id]);
  });
  test('complète les champs manquants', async () => {
    const s = nouveau();
    const json = JSON.stringify({ format: 'jardin-v1', garden: { name: 'Vieux', boundary: [{ x: 0, y: 0 }], context: { region: 'Bretagne' } } });
    const g = await s.importGarden(json);
    expect(g.context.region).toBe('Bretagne');
    expect(g.context.northAngle).toBe(0);
    expect(g.sun.mode).toBe('unknown');
    expect(g.zones).toEqual([]);
  });
  test('rejette les fichiers invalides', async () => {
    const s = nouveau();
    await expect(s.importGarden('pas du json')).rejects.toThrow(/JSON/);
    await expect(s.importGarden('{"format":"autre"}')).rejects.toThrow(/jardin-v1/);
    await expect(s.importGarden(JSON.stringify({ format: 'jardin-v1', garden: { boundary: 3 } }))).rejects.toThrow(/invalide/);
    await expect(s.importGarden(JSON.stringify({ format: 'jardin-v1', garden: { boundary: [{ x: 'a' }] } }))).rejects.toThrow(/contour/);
    expect(await s.listGardens()).toHaveLength(0);
  });
});

describe('réglages', () => {
  test('valeurs par défaut', async () => {
    const r = await nouveau().getSettings();
    expect(r).toEqual(defaultSettings());
    expect(r.notifications).toMatchObject({ enabled: false, hour: 19, minute: 0, frost: true, heat: true, monthlyTasks: true, vacationUntil: null });
  });
  test('fusion et persistance', async () => {
    const s = nouveau();
    await s.saveSettings({ notifications: { enabled: true, hour: 8 } });
    const r = await s.getSettings();
    expect(r.notifications).toMatchObject({ enabled: true, hour: 8, minute: 0, frost: true });
    expect(r.units).toBe('metric');
  });
});
