/**
 * game.test.js — Tests unitaires pour geo-party/game.js
 *
 * Teste les fonctions pures (haversineKm, calcScore) et la logique de résolution
 * des panoramas Mapillary (prepareRoundLocations).
 */

import { jest } from '@jest/globals';

// ─── Mock fetch (utilisé par prepareRoundLocations → _fetchMapillaryImageId) ──

const fetchMock = jest.fn();
globalThis.fetch = fetchMock;

// ─── Mock Web Audio (importé indirectement via sound.js) ─────────────────────

globalThis.window = {
  AudioContext: function () {
    return {
      state: 'running',
      currentTime: 0,
      destination: {},
      resume: () => Promise.resolve(),
      createOscillator: () => ({ connect: () => {}, type: 'sine', frequency: { setValueAtTime: () => {} }, start: () => {}, stop: () => {} }),
      createGain: () => ({ connect: () => {}, gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} } }),
    };
  },
};

import { haversineKm, calcScore, prepareRoundLocations } from '../../game.js';
import { pickLocations, LOCATIONS } from '../../locations.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Réponse API Mapillary avec panoramas. */
function makePanoResponse(ids = ['pano-1']) {
  return {
    ok: true,
    json: async () => ({ data: ids.map(id => ({ id, is_pano: true })) }),
  };
}

/** Réponse API Mapillary vide (aucun panorama). */
function makeEmptyResponse() {
  return { ok: true, json: async () => ({ data: [] }) };
}

/**
 * Candidat de test avec coordonnées déterministes.
 * lat = 48 + i × 0.1, lng = 2 + i × 0.1
 */
function makeCandidate(i) {
  return { id: i + 1, name: `Lieu ${i + 1}`, country: 'Pays', lat: 48 + i * 0.1, lng: 2 + i * 0.1 };
}

/**
 * Mock fetch qui dispatche selon la latitude du centre de la bbox :
 * si l'index du candidat (≈ round((lat - 48) × 10)) est < threshold, retourne vide.
 */
function makeBboxDispatchMock(threshold) {
  return (url) => {
    const m = url.match(/bbox=([\d.+-]+),([\d.+-]+),([\d.+-]+),([\d.+-]+)/);
    if (!m) return Promise.resolve(makeEmptyResponse());
    const centerLat   = (parseFloat(m[2]) + parseFloat(m[4])) / 2;
    const candidateIdx = Math.round((centerLat - 48) * 10);
    if (candidateIdx < threshold) return Promise.resolve(makeEmptyResponse());
    return Promise.resolve(makePanoResponse([`pano-${candidateIdx}`]));
  };
}

// ─── haversineKm ──────────────────────────────────────────────────────────────

describe('haversineKm', () => {
  test('même point → 0 km', () => {
    expect(haversineKm(48.8584, 2.2945, 48.8584, 2.2945)).toBeCloseTo(0, 1);
  });

  test('Paris → Londres ≈ 340 km', () => {
    const d = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(350);
  });

  test('Paris → New York ≈ 5835 km', () => {
    const d = haversineKm(48.8566, 2.3522, 40.7128, -74.0060);
    expect(d).toBeGreaterThan(5800);
    expect(d).toBeLessThan(5870);
  });

  test('symétrie : haversine(A, B) === haversine(B, A)', () => {
    expect(haversineKm(10, 20, 30, 40)).toBeCloseTo(haversineKm(30, 40, 10, 20), 5);
  });

  test('valeur strictement positive pour deux points distincts', () => {
    expect(haversineKm(0, 0, 1, 1)).toBeGreaterThan(0);
  });
});

// ─── calcScore ────────────────────────────────────────────────────────────────

describe('calcScore', () => {
  test('0 km → score maximum (5000)', () => {
    expect(calcScore(0)).toBe(5000);
  });

  test('le score diminue à mesure que la distance augmente', () => {
    expect(calcScore(100)).toBeGreaterThan(calcScore(1000));
    expect(calcScore(1000)).toBeGreaterThan(calcScore(5000));
  });

  test('score non-négatif, même très loin', () => {
    expect(calcScore(50000)).toBeGreaterThanOrEqual(0);
  });

  test('score > 0 pour des distances réalistes (≤ 20 000 km)', () => {
    expect(calcScore(10000)).toBeGreaterThan(0);
  });

  test('score ≈ 1839 à 2000 km (facteur de décroissance)', () => {
    // MAX_SCORE * e^(-1) ≈ 5000 / e ≈ 1839
    const score = calcScore(2000);
    expect(score).toBeGreaterThan(1800);
    expect(score).toBeLessThan(1900);
  });

  test('le score est un entier', () => {
    expect(Number.isInteger(calcScore(500))).toBe(true);
    expect(Number.isInteger(calcScore(3000))).toBe(true);
  });
});

// ─── pickLocations ────────────────────────────────────────────────────────────

describe('pickLocations', () => {
  test('retourne exactement n lieux', () => {
    expect(pickLocations(5)).toHaveLength(5);
    expect(pickLocations(10)).toHaveLength(10);
  });

  test('retourne au plus LOCATIONS.length lieux', () => {
    const all = pickLocations(1000);
    expect(all.length).toBe(LOCATIONS.length);
  });

  test('tous les lieux sont uniques (pas de doublon)', () => {
    const locs = pickLocations(LOCATIONS.length);
    const ids  = locs.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('chaque lieu a les champs requis', () => {
    pickLocations(LOCATIONS.length).forEach(loc => {
      expect(typeof loc.id).toBe('number');
      expect(typeof loc.name).toBe('string');
      expect(typeof loc.country).toBe('string');
      expect(typeof loc.lat).toBe('number');
      expect(typeof loc.lng).toBe('number');
    });
  });
});

// ─── prepareRoundLocations ────────────────────────────────────────────────────

describe('prepareRoundLocations', () => {
  beforeEach(() => { fetchMock.mockReset(); });

  test('sans token → retourne wantCount lieux avec mapillaryId: null, sans appel réseau', async () => {
    const candidates = [makeCandidate(0), makeCandidate(1), makeCandidate(2)];
    const result     = await prepareRoundLocations(candidates, 2, '');
    expect(result).toHaveLength(2);
    result.forEach(loc => expect(loc.mapillaryId).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('retourne exactement wantCount lieux quand les panoramas sont disponibles', async () => {
    fetchMock.mockResolvedValue(makePanoResponse(['pano-1']));
    const candidates = Array.from({ length: 10 }, (_, i) => makeCandidate(i));
    const result     = await prepareRoundLocations(candidates, 3, 'token');
    expect(result).toHaveLength(3);
    result.forEach(loc => expect(loc.mapillaryId).not.toBeNull());
  });

  test('ne retourne jamais de lieux sans panorama quand des panoramas sont disponibles', async () => {
    // Candidat 0 : pas de pano — Candidats 1 et 2 : pano disponible
    fetchMock.mockImplementation(makeBboxDispatchMock(1));
    const candidates = [makeCandidate(0), makeCandidate(1), makeCandidate(2)];
    const result     = await prepareRoundLocations(candidates, 2, 'token');
    expect(result).toHaveLength(2);
    result.forEach(loc => expect(loc.mapillaryId).not.toBeNull());
  });

  test('passe au lot suivant si le premier lot ne contient pas assez de panoramas', async () => {
    // Candidats 0-9 (premier lot de 10) : sans pano — Candidats 10+ : avec pano
    fetchMock.mockImplementation(makeBboxDispatchMock(10));
    const candidates = Array.from({ length: 15 }, (_, i) => makeCandidate(i));
    const result     = await prepareRoundLocations(candidates, 2, 'token');
    expect(result).toHaveLength(2);
    result.forEach(loc => expect(loc.mapillaryId).not.toBeNull());
  });

  test('retourne moins de wantCount si le pool est entièrement épuisé sans trouver assez de panoramas', async () => {
    fetchMock.mockResolvedValue(makeEmptyResponse());
    const candidates = Array.from({ length: 4 }, (_, i) => makeCandidate(i));
    const result     = await prepareRoundLocations(candidates, 5, 'token');
    expect(result.length).toBeLessThan(5);
    // Les lieux retournés (s'il y en a) ont tous un panorama
    result.forEach(loc => expect(loc.mapillaryId).not.toBeNull());
  });

  test("ok=false stoppe les tentatives pour ce candidat, les suivants sont essayés", async () => {
    // Premier appel (candidat 0, première bbox) : erreur API → null pour candidat 0
    fetchMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue(makePanoResponse(['pano-ok']));
    const candidates = [makeCandidate(0), makeCandidate(1)];
    const result     = await prepareRoundLocations(candidates, 1, 'token');
    expect(result).toHaveLength(1);
    expect(result[0].mapillaryId).toBe('pano-ok');
  });

  test('gère les erreurs réseau gracieusement : retente avec une bbox plus grande', async () => {
    // Les 2 premiers appels (bbox les plus petites) lèvent une erreur réseau ;
    // le 3ème retourne un pano (bbox plus grande).
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(makePanoResponse(['pano-retry']));
    const result = await prepareRoundLocations([makeCandidate(0)], 1, 'token');
    expect(result).toHaveLength(1);
    expect(result[0].mapillaryId).toBe('pano-retry');
  });

  test("s'arrête dès que wantCount panoramas sont trouvés (n'appelle pas fetch inutilement)", async () => {
    fetchMock.mockResolvedValue(makePanoResponse(['pano-1']));
    const candidates = Array.from({ length: 20 }, (_, i) => makeCandidate(i));
    await prepareRoundLocations(candidates, 2, 'token');
    // wantCount=2, premier lot=10 : 10 appels fetch au maximum (1 appel par candidat)
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
