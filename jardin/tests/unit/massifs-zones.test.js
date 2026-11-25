import { proposeBeds, bedsToZones, regenerate, isFlowerZone, FLOWER_ZONE_TYPES } from '../../massifs.js';
import { createGarden, createZone, validateGarden, bedModeOf } from '../../model.js';
import { getPlant } from '../../catalog.js';
import { gardenA, gardenBig, rect } from './massif-fixtures.js';

describe('modèle : bedMode et zone.auto', () => {
  test('nouveau jardin : bedMode « manual » ; champ absent toléré', () => {
    const g = createGarden();
    expect(g.context.bedMode).toBe('manual');
    expect(bedModeOf(g)).toBe('manual');
    delete g.context.bedMode;
    expect(bedModeOf(g)).toBe('manual');
    g.context.bedMode = 'auto';
    expect(bedModeOf(g)).toBe('auto');
    expect(bedModeOf(null)).toBe('manual');
  });
  test('createZone : auto = false par défaut', () => {
    expect(createZone('midplants', rect(0, 0, 2, 2)).auto).toBe(false);
  });
});

describe('bedsToZones', () => {
  const g = gardenBig();
  const beds = proposeBeds(g, { seed: 4, ambiance: 'bucolique' });

  test('zones auto prêtes à insérer', () => {
    const zones = bedsToZones(g, beds, { ambiance: 'bucolique' });
    expect(zones).toHaveLength(beds.length);
    zones.forEach((z, i) => {
      expect(FLOWER_ZONE_TYPES).toContain(z.type);
      expect(isFlowerZone(z)).toBe(true);
      expect(z.auto).toBe(true);
      expect(z.label).toBe(`Massif bucolique n°${i + 1}`);
      expect(z.ambiance).toBe('bucolique');
      expect(z.shape.kind).toBe('polygon');
      expect(z.plantings).toEqual(beds[i].plantings);
      expect(z.autoInfo.role).toBe(beds[i].role);
      expect(z.autoInfo.seed).toBe(4);
      expect(z.autoInfo.why).toContain(beds[i].why);
      expect(z.autoInfo.summary).toEqual(beds[i].summary);
    });
    expect(new Set(zones.map((z) => z.id)).size).toBe(zones.length);
  });

  test('sans ambiance : « Massif n°1 » ; type selon la hauteur dominante', () => {
    const zones = bedsToZones(g, proposeBeds(g, { seed: 4 }));
    expect(zones[0].label).toBe('Massif n°1');
    expect(zones[0].ambiance).toBeNull();
    const low = { id: 'x', role: 'bordure', shape: beds[0].shape, plantings: [{ plantId: 'h-trefle-nain', count: 5 }] };
    const tall = { id: 'y', role: 'bordure', shape: beds[0].shape, plantings: [{ plantId: 'h-miscanthus', count: 3 }] };
    const hedge = { id: 'w', role: 'haie-fleurie', shape: beds[0].shape, plantings: [] };
    expect(getPlant('h-trefle-nain')).toBeTruthy();
    const [zl, zt, zh] = bedsToZones(g, [low, tall, hedge]);
    expect(zl.type).toBe('lowplants');
    expect(zt.type).toBe('tallplants');
    expect(zh.type).toBe('tallplants');
  });

  test('jardin valide après insertion : aucune erreur, aucun débordement ni chevauchement', () => {
    for (const garden of [gardenA(), gardenBig()]) {
      const zones = bedsToZones(garden, proposeBeds(garden, { seed: 2 }));
      expect(zones.length).toBeGreaterThan(0);
      const before = validateGarden(garden);
      garden.zones.push(...zones);
      const v = validateGarden(garden);
      expect(v.ok).toBe(true);
      expect(v.errors).toEqual([]);
      const neuf = v.warnings.filter((w) => !before.warnings.includes(w));
      expect(neuf.filter((w) => /Massif/.test(w))).toEqual([]);
    }
  });

  test('la numérotation continue après les zones auto existantes', () => {
    const h = gardenBig();
    const first = bedsToZones(h, proposeBeds(h, { seed: 1, maxBeds: 2, coverage: 0.3 }));
    h.zones.push(...first);
    const next = bedsToZones(h, proposeBeds(h, { seed: 2, maxBeds: 1, coverage: 0.2 }));
    expect(next[0].label).toBe(`Massif n°${first.length + 1}`);
    expect(h.zones.some((z) => z.id === next[0].id)).toBe(false);
  });
});

describe('regenerate', () => {
  test('refait uniquement les massifs non gardés ; massifs manuels intacts', () => {
    const g = gardenBig();
    const manual = createZone('midplants', rect(0.5, 12.5, 2, 1.5));
    g.zones.push(manual);
    const first = regenerate(g, { seed: 1 });
    expect(first.added.length).toBeGreaterThan(1);
    g.zones = first.zones;
    const keep = first.added[0].id;
    const second = regenerate(g, { keepIds: [keep], seed: 7 });
    expect(second.removed).toHaveLength(first.added.length - 1);
    expect(second.removed).not.toContain(keep);
    expect(second.kept).toEqual([keep]);
    expect(second.zones.some((z) => z.id === manual.id && z.auto === false)).toBe(true);
    expect(second.zones.find((z) => z.id === keep)).toBe(first.added[0]);
    expect(second.added.every((z) => z.auto && z.autoInfo.seed === 7)).toBe(true);
    // les nouveaux massifs ne recouvrent pas le massif gardé
    const v = validateGarden({ ...g, zones: second.zones });
    expect(v.errors).toEqual([]);
    expect(v.warnings.filter((w) => /Massif/.test(w) && /chevauchent/.test(w))).toEqual([]);
    // garden non modifié
    expect(g.zones).toBe(first.zones);
  });

  test('sans keepIds : toutes les zones auto sont refaites, graine suivante par défaut', () => {
    const g = gardenA();
    const first = regenerate(g, { seed: 3 });
    g.zones = first.zones;
    const again = regenerate(g, {});
    expect(again.removed.sort()).toEqual(first.added.map((z) => z.id).sort());
    expect(again.added.every((z) => z.autoInfo.seed === 4)).toBe(true);
  });
});
