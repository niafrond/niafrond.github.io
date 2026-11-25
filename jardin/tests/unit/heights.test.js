// Hauteurs réglables : bornes, clamp, défauts, formatage, saisie (pur).
import {
  DEFAULT_HEIGHTS, HEIGHT_LIMITS, heightLimits, clampHeight, checkHeight, heightOf, isDefaultHeight, formatHeight, heightMessage,
  parseHeight, applyHeight, resetHeight, defaultItemHeight, itemHeight, zoneHeight, effectivePlant, plantHeightKind, heightToCm,
} from '../../heights.js';
import { ITEM_KINDS, EDGE_KINDS } from '../../items.js';

describe('bornes', () => {
  test('catégories demandées', () => {
    expect(HEIGHT_LIMITS.tree).toEqual([0.5, 40]);
    expect(HEIGHT_LIMITS.shrub).toEqual([0.1, 8]);
    expect(HEIGHT_LIMITS.perennial).toEqual([0.05, 3]);
    expect(HEIGHT_LIMITS.pool).toEqual([0.5, 2]);
    expect(HEIGHT_LIMITS.wall).toEqual([0.3, 6]);
    expect(HEIGHT_LIMITS.fence).toEqual([0.3, 3]);
    expect(HEIGHT_LIMITS.pergola).toEqual([1.8, 4]);
    expect(HEIGHT_LIMITS.terrace).toEqual([0, 1.5]);
  });
  test('tout aménagement du catalogue a des bornes qui contiennent sa hauteur par défaut', () => {
    for (const k of ITEM_KINDS) {
      const [a, b] = heightLimits(k.id);
      const d = defaultItemHeight(k.id);
      expect(d).toBeGreaterThanOrEqual(a); expect(d).toBeLessThanOrEqual(b);
      if (k.height) expect(Math.abs(k.height - d)).toBeLessThan(0.01);
    }
    for (const e of EDGE_KINDS.filter((x) => x.id !== 'open')) {
      const [a, b] = heightLimits(e.id); expect(e.height).toBeGreaterThanOrEqual(a); expect(e.height).toBeLessThanOrEqual(b);
      expect(DEFAULT_HEIGHTS.edge[e.id]).toBe(e.height);
    }
  });
  test('clampHeight ramène dans les bornes et arrondit au cm', () => {
    expect(clampHeight('tree', 80)).toBe(40);
    expect(clampHeight('tree', 0.01)).toBe(0.5);
    expect(clampHeight('fence', 1.2349)).toBe(1.23);
    expect(clampHeight('pergola', 1)).toBe(1.8);
    expect(clampHeight('terrace', -3)).toBe(0);
    expect(clampHeight('tree', 'abc')).toBe(0.5);
    expect(clampHeight('inconnu', 100)).toBe(40);
  });
  test('checkHeight : valeur arrondie signalée par un message', () => {
    expect(checkHeight('tree', 80)).toEqual({ value: 40, ok: true, clamped: true, message: 'Hauteur plausible : 0,5 à 40 m ; valeur arrondie' });
    expect(checkHeight('tree', 15)).toMatchObject({ value: 15, clamped: false, message: '' });
    expect(checkHeight('tree', NaN).ok).toBe(false);
    expect(heightMessage('pool')).toBe('Hauteur plausible : 0,5 à 2 m ; valeur arrondie');
  });
});

describe('valeurs par défaut', () => {
  test('heightOf : réglée sinon défaut (0 valide pour une terrasse)', () => {
    expect(heightOf({ height: 3 }, 2.4)).toBe(3);
    expect(heightOf({}, 2.4)).toBe(2.4);
    expect(heightOf(null, 2.4)).toBe(2.4);
    expect(heightOf({ height: 0 }, 2.4)).toBe(2.4);
    expect(heightOf({ height: 0 }, 0)).toBe(0);
    expect(heightOf({ height: 'x' }, 1)).toBe(1);
  });
  test('isDefaultHeight', () => {
    expect(isDefaultHeight({}, 2.4)).toBe(true);
    expect(isDefaultHeight({ height: 2.4 }, 2.4)).toBe(true);
    expect(isDefaultHeight({ height: 3 }, 2.4)).toBe(false);
  });
  test('applyHeight / resetHeight : la valeur par défaut supprime le champ', () => {
    const it = { kind: 'pergola' };
    expect(applyHeight(it, 'pergola', 3, 2.4)).toMatchObject({ value: 3, isDefault: false });
    expect(it.height).toBe(3);
    expect(applyHeight(it, 'pergola', 9, 2.4)).toMatchObject({ value: 4, clamped: true });
    applyHeight(it, 'pergola', 2.4, 2.4); expect('height' in it).toBe(false);
    applyHeight(it, 'pergola', 3, 2.4); resetHeight(it); expect('height' in it).toBe(false);
    expect(applyHeight(it, 'pergola', NaN, 2.4).invalid).toBe(true);
  });
  test('aménagements et zones', () => {
    expect(itemHeight({ kind: 'pergola' })).toBe(2.4);
    expect(itemHeight({ kind: 'pergola', height: 3 })).toBe(3);
    expect(zoneHeight({ type: 'pool', variant: 'above' })).toBe(1.2);
    expect(zoneHeight({ type: 'pool', variant: 'above', height: 1.5 })).toBe(1.5);
    expect(zoneHeight({ type: 'pool', variant: 'inground', height: 1.5 })).toBe(0);
    expect(zoneHeight({ type: 'terrace' })).toBe(0);
    expect(zoneHeight({ type: 'terrace', height: 0.4 })).toBe(0.4);
    expect(zoneHeight({ type: 'lawn', height: 3 })).toBe(0);
  });
  test('effectivePlant : hauteur / largeur réglées, sinon même objet', () => {
    const p = { id: 'x', category: 'tree', heightAdult: 8, widthAdult: 5 };
    expect(effectivePlant(p, { plantId: 'x', count: 1 })).toBe(p);
    expect(effectivePlant(p, { height: 15 })).toMatchObject({ heightAdult: 15, widthAdult: 5, id: 'x' });
    expect(effectivePlant(p, { height: 15, width: 9 })).toMatchObject({ heightAdult: 15, widthAdult: 9 });
    expect(p.heightAdult).toBe(8);
    expect(plantHeightKind(p)).toBe('tree');
    expect(plantHeightKind({ category: 'zzz' })).toBe('default');
  });
});

describe('format et saisie', () => {
  test('formatHeight', () => {
    expect(formatHeight(2.4)).toBe('2,40 m');
    expect(formatHeight(15)).toBe('15,00 m');
    expect(formatHeight(0.05)).toBe('0,05 m');
    expect(formatHeight(NaN)).toBe('—');
    expect(heightToCm(2.4)).toBe('240');
  });
  test('parseHeight : cm par défaut, « m » accepté', () => {
    expect(parseHeight('450')).toBe(4.5);
    expect(parseHeight('4,5 m')).toBe(4.5);
    expect(parseHeight('240cm')).toBe(2.4);
    expect(parseHeight('')).toBeNull();
    expect(parseHeight('abc')).toBeNull();
  });
});
