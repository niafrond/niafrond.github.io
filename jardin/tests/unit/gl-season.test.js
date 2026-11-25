// État saisonnier pur : feuillage, teinte, floraison, sol (gl-season.js).
import {
  plantSeasonState, flowerAmount, groundState, seasonName, seasonLabel, seasonDoy, dayOfYear, dormancy, leafFall, seasonWarmth, SEASON_DOY, AUTUMN_HUES, mixHex,
} from '../../gl-season.js';

const caduc = { id: 'erable', category: 'tree', foliage: 'deciduous', bloom: [4, 5], heightAdult: 10, widthAdult: 6 };
const persistant = { id: 'laurier', category: 'shrub', foliage: 'evergreen', bloom: [6], heightAdult: 3, widthAdult: 2 };
const conifere = { id: 'pin', category: 'tree', foliage: 'evergreen', bloom: [], genus: 'Pinus', heightAdult: 15, widthAdult: 6 };
const vivace = { id: 'lavande', category: 'perennial', foliage: 'deciduous', bloom: [6, 7, 8], heightAdult: 0.6, widthAdult: 0.7 };
const sansFleurs = { id: 'fougere', category: 'perennial', foliage: 'deciduous', heightAdult: 0.5, widthAdult: 0.5 };
const { hiver, printemps, été, automne } = SEASON_DOY;

describe('caduc ligneux', () => {
  test('hiver : branches nues', () => {
    const s = plantSeasonState(caduc, hiver);
    expect(s.kind).toBe('woody'); expect(s.leafDensity).toBe(0); expect(s.bare).toBe(true);
  });
  test('printemps : bourgeons, feuillage clairsemé vert tendre', () => {
    const s = plantSeasonState(caduc, printemps);
    expect(s.leafDensity).toBeGreaterThan(0.05); expect(s.leafDensity).toBeLessThan(0.7);
    expect(s.spring).toBeGreaterThan(0.5); expect(s.bare).toBe(false);
  });
  test('été : pleine frondaison, vert franc', () => {
    const s = plantSeasonState(caduc, été);
    expect(s.leafDensity).toBe(1); expect(s.spring).toBe(0); expect(s.tint).toBe(0);
  });
  test('automne : virage de couleur puis chute', () => {
    const oct = plantSeasonState(caduc, automne);
    expect(oct.tint).toBeGreaterThan(0.05); expect(oct.leafDensity).toBe(1);
    const nov = plantSeasonState(caduc, 322);
    expect(nov.tint).toBe(1); expect(nov.leafDensity).toBeLessThan(0.7);
    expect(AUTUMN_HUES).toContain(nov.hue);
    expect(plantSeasonState(caduc, 350).bare).toBe(true);
  });
  test('progression monotone au printemps et à la chute', () => {
    let prev = -1;
    for (let d = 80; d <= 140; d += 5) { const v = plantSeasonState(caduc, d).leafDensity; expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    prev = 2;
    for (let d = 295; d <= 350; d += 5) { const v = plantSeasonState(caduc, d).leafDensity; expect(v).toBeLessThanOrEqual(prev); prev = v; }
  });
  test('la couleur d’automne est stable par essence', () => {
    expect(plantSeasonState(caduc, 320).hue).toBe(plantSeasonState({ ...caduc }, 320).hue);
  });
});

describe('persistants, herbacées, floraison', () => {
  test('persistant et conifère : inchangés toute l’année', () => {
    for (const d of [15, 105, 172, 288, 350]) {
      for (const p of [persistant, conifere]) {
        const s = plantSeasonState(p, d);
        expect(s.kind).toBe('evergreen'); expect(s.leafDensity).toBe(1); expect(s.tint).toBe(0); expect(s.bare).toBe(false);
      }
    }
  });
  test('herbacée caduque : repos l’hiver, pleine vigueur l’été', () => {
    expect(plantSeasonState(vivace, hiver).scaleY).toBeCloseTo(0.22, 5);
    expect(plantSeasonState(vivace, été).scaleY).toBe(1);
    expect(plantSeasonState(vivace, hiver).tint).toBeGreaterThan(0.7);
    expect(dormancy(200)).toBe(1);
  });
  test('floraison : seulement les mois de bloom, avec fondu', () => {
    expect(plantSeasonState(vivace, été).flower).toBe(1);
    expect(plantSeasonState(vivace, hiver).flower).toBe(0);
    expect(plantSeasonState(caduc, 105).flower).toBe(1); // mi-avril
    expect(plantSeasonState(caduc, 93).flower).toBeLessThan(1); // 3 avril : début de fondu
    expect(plantSeasonState(caduc, 93).flower).toBeGreaterThan(0);
    expect(flowerAmount([6, 7, 8], 172)).toBeGreaterThan(0.9); // 21 juin, déjà en plein
    expect(flowerAmount([12, 1], 1)).toBe(1); // bloom à cheval sur l’année
  });
  test('plante sans bloom : jamais de fleurs ; sans foliage connu : pas d’erreur', () => {
    for (const d of [15, 105, 172, 288]) expect(plantSeasonState(sansFleurs, d).flower).toBe(0);
    expect(plantSeasonState({ id: 'x', category: 'tree', heightAdult: 3, widthAdult: 2 }, été).leafDensity).toBe(1);
  });
});

describe('sol, neige, ciel, calendrier', () => {
  test('pelouse : vert vif au printemps, paille l’été sec, terne l’hiver', () => {
    const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(groundState(printemps).lawnTint).toBe('#ffffff');
    const sec = groundState(215, 1); const humide = groundState(215, 0);
    expect(parseInt(sec.lawnTint.slice(5, 7), 16)).toBeLessThan(parseInt(humide.lawnTint.slice(5, 7), 16)); // moins de bleu = plus jaune
    expect(sec.dryness).toBeGreaterThan(0.9); expect(groundState(hiver).dryness).toBe(0);
    expect(lum(groundState(hiver).lawnTint)).toBeLessThan(lum(groundState(printemps).lawnTint));
  });
  test('saisons, libellé, hémisphère sud', () => {
    expect(['hiver', 'printemps', 'été', 'automne'].map((n) => seasonName(SEASON_DOY[n]))).toEqual(['hiver', 'printemps', 'été', 'automne']);
    expect(seasonLabel(new Date(2026, 3, 15))).toBe('Printemps · 15 avril');
    expect(seasonName(15, -33)).toBe('été');
    expect(seasonDoy(15, -33)).not.toBe(15);
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1); expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });
  test('lumière : chaude l’été, froide l’hiver ; chute des feuilles en novembre', () => {
    expect(seasonWarmth(172)).toBeCloseTo(1, 3); expect(seasonWarmth(355)).toBeLessThan(-0.9);
    expect(leafFall(320)).toBeGreaterThan(0.8); expect(leafFall(200)).toBe(0); expect(leafFall(360)).toBe(0);
  });
  test('mixHex', () => { expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080'); });
});
