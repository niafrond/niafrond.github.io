// Relevé GPS guidé (logique pure) : qualité, capture par fenêtre d'échantillons, fermeture, redressement, incertitude.
import {
  createSurvey, combineFixes, squareCorners, buildContour, areaUncertainty, qualityOf, STALE_MS,
} from '../../gps-survey.js';
import { localToGps, gpsToLocal, haversine, polygonArea, distance } from '../../geometry.js';

// générateur pseudo-aléatoire déterministe + gaussienne (Box-Muller)
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }

const ORIGIN = { lat: 47.2184, lon: -1.5536 };
/** Échantillons autour d'un point local (x est, y = −nord) avec bruit gaussien de `sigma` m par axe. */
function samples(p, { n = 25, sigma = 2, acc = 3, r, t0 = 0, dt = 200 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const q = localToGps({ x: p.x + gauss(r) * sigma, y: p.y + gauss(r) * sigma }, ORIGIN);
    return { lat: q.lat, lon: q.lon, accuracy: acc, t: t0 + i * dt };
  });
}
const clock = (t = 1_000_000) => { const c = { t, now: () => c.t }; return c; };

describe('qualité du signal', () => {
  test('seuils : ≤ 3 m bonne, ≤ 6 m moyenne, au-delà faible', () => {
    expect(qualityOf(2.9)).toBe('good');
    expect(qualityOf(3)).toBe('good');
    expect(qualityOf(3.1)).toBe('medium');
    expect(qualityOf(6)).toBe('medium');
    expect(qualityOf(6.1)).toBe('weak');
    expect(qualityOf(NaN)).toBe('none');
    expect(qualityOf(0)).toBe('none');
  });

  test('états idle → waiting-fix → ready → recording → closed', () => {
    const c = clock();
    const sv = createSurvey({ now: c.now });
    expect(sv.state).toBe('idle');
    sv.start();
    expect(sv.state).toBe('waiting-fix');
    sv.feed({ lat: ORIGIN.lat, lon: ORIGIN.lon, accuracy: 12, t: c.t });
    expect(sv.state).toBe('waiting-fix'); // signal faible
    expect(sv.status().canCapture).toBe(false);
    sv.feed({ lat: ORIGIN.lat, lon: ORIGIN.lon, accuracy: 2.5, t: c.t });
    expect(sv.state).toBe('ready');
    expect(sv.status()).toMatchObject({ quality: 'good', canCapture: true, fresh: true });
    expect(sv.capturePoint().ok).toBe(true);
    expect(sv.state).toBe('recording');
    for (const p of [{ x: 10, y: 0 }, { x: 10, y: 8 }]) {
      const g = localToGps(p, sv.origin);
      c.t += 10000; // le point suivant n'utilise que la fenêtre récente
      sv.feed({ lat: g.lat, lon: g.lon, accuracy: 2, t: c.t });
      expect(sv.capturePoint().ok).toBe(true);
    }
    expect(sv.close()).not.toBeNull();
    expect(sv.state).toBe('closed');
    expect(sv.capturePoint().reason).toBe('closed');
  });

  test('un échantillon trop ancien n\'est plus « en direct »', () => {
    const c = clock();
    const sv = createSurvey({ now: c.now }); sv.start();
    sv.feed({ lat: ORIGIN.lat, lon: ORIGIN.lon, accuracy: 2, t: c.t });
    expect(sv.status().quality).toBe('good');
    c.t += STALE_MS + 1000;
    expect(sv.status()).toMatchObject({ quality: 'none', fresh: false, canCapture: false });
    expect(sv.state).toBe('waiting-fix');
  });
});

describe('capture d\'un point (fenêtre d\'échantillons)', () => {
  test('rejette les valeurs aberrantes (saut de 40 m) grâce à la médiane', () => {
    const r = rng(7);
    const fx = samples({ x: 0, y: 0 }, { n: 20, sigma: 0.8, acc: 3, r });
    const bad = localToGps({ x: 40, y: -25 }, ORIGIN);
    fx.push({ lat: bad.lat, lon: bad.lon, accuracy: 3, t: 5000 }, { lat: bad.lat, lon: bad.lon, accuracy: 3, t: 5100 });
    const c = combineFixes(fx);
    expect(c.rejected).toBe(2);
    const p = gpsToLocal([{ lat: c.lat, lon: c.lon }], ORIGIN).points[0];
    expect(Math.hypot(p.x, p.y)).toBeLessThan(1);
  });

  test('moyenne pondérée par 1/accuracy² : l\'échantillon précis l\'emporte', () => {
    const a = localToGps({ x: 0, y: 0 }, ORIGIN);
    const b = localToGps({ x: 2, y: 0 }, ORIGIN);
    const c = combineFixes([{ ...a, accuracy: 1 }, { ...b, accuracy: 4 }]);
    const p = gpsToLocal([c], ORIGIN).points[0];
    // poids 1 contre 1/16 : le barycentre est à 2/17 m du premier
    expect(p.x).toBeCloseTo(2 / 17, 1);
    expect(c.accuracy).toBeGreaterThan(0);
  });

  test('précision estimée : plus d\'échantillons ⇒ plus précis, jamais inférieure à 0,5 m', () => {
    const r = rng(3);
    const few = combineFixes(samples({ x: 0, y: 0 }, { n: 3, sigma: 0.5, acc: 4, r }));
    const many = combineFixes(samples({ x: 0, y: 0 }, { n: 30, sigma: 0.5, acc: 4, r }));
    expect(many.accuracy).toBeLessThanOrEqual(few.accuracy);
    expect(many.accuracy).toBeGreaterThanOrEqual(0.5);
  });

  test('aucun échantillon valide → null ; capturePoint renvoie no-fix', () => {
    expect(combineFixes([])).toBeNull();
    expect(combineFixes([{ lat: NaN, lon: 1 }])).toBeNull();
    const sv = createSurvey(); sv.start();
    expect(sv.capturePoint([]).reason).toBe('no-fix');
  });

  test('signal faible refusé sauf force ; avertissement « weak »', () => {
    const sv = createSurvey(); sv.start();
    const fx = [{ lat: ORIGIN.lat, lon: ORIGIN.lon, accuracy: 15, t: Date.now() }];
    expect(sv.capturePoint(fx)).toMatchObject({ ok: false, reason: 'weak' });
    const r = sv.capturePoint(fx, { force: true });
    expect(r.ok).toBe(true);
    expect(r.warn).toContain('weak');
  });

  test('le 1er point est l\'origine (0, 0) et mémorise l\'origine GPS ; repère x = est, y = −nord', () => {
    const sv = createSurvey(); sv.start();
    const a = localToGps({ x: 0, y: 0 }, ORIGIN);
    sv.capturePoint([{ ...a, accuracy: 2 }]);
    expect(sv.points[0]).toMatchObject({ x: 0, y: 0 });
    expect(sv.origin.lat).toBeCloseTo(ORIGIN.lat, 6);
    const east = localToGps({ x: 10, y: 0 }, sv.origin);
    expect(sv.capturePoint([{ ...east, accuracy: 2 }]).point.x).toBeCloseTo(10, 1);
    const north = { lat: sv.origin.lat + 5 / 111195, lon: sv.origin.lon };
    const pn = sv.capturePoint([{ ...north, accuracy: 2 }], { force: true }).point;
    expect(pn.y).toBeCloseTo(-5, 1); // le nord est en haut : y négatif
  });

  test('mode d\'origine « fixed » : l\'origine existante est conservée', () => {
    const o = { lat: 47, lon: -1 };
    const sv = createSurvey({ originMode: 'fixed', origin: o }); sv.start();
    const p = localToGps({ x: 3, y: 4 }, o);
    const r = sv.capturePoint([{ ...p, accuracy: 2 }]);
    expect(r.point.x).toBeCloseTo(3, 1);
    expect(r.point.y).toBeCloseTo(4, 1);
    expect(sv.origin).toEqual(o);
  });

  test('point trop proche du précédent (< 1 m) refusé, accepté avec force', () => {
    const sv = createSurvey(); sv.start();
    const a = localToGps({ x: 0, y: 0 }, ORIGIN);
    sv.capturePoint([{ ...a, accuracy: 2 }]);
    const near = localToGps({ x: 0.4, y: 0.3 }, sv.origin);
    const r = sv.capturePoint([{ ...near, accuracy: 2 }]);
    expect(r).toMatchObject({ ok: false, reason: 'too-close' });
    expect(r.distance).toBeLessThan(1);
    expect(sv.points).toHaveLength(1);
    expect(sv.capturePoint([{ ...near, accuracy: 2 }], { force: true }).ok).toBe(true);
    expect(sv.points).toHaveLength(2);
  });

  test('annulation du dernier point ; l\'origine est libérée si le relevé est vidé', () => {
    const sv = createSurvey(); sv.start();
    const a = localToGps({ x: 0, y: 0 }, ORIGIN);
    sv.capturePoint([{ ...a, accuracy: 2 }]);
    sv.capturePoint([{ ...localToGps({ x: 6, y: 0 }, sv.origin), accuracy: 2 }]);
    expect(sv.undo()).toBe(true);
    expect(sv.points).toHaveLength(1);
    expect(sv.undo()).toBe(true);
    expect(sv.points).toHaveLength(0);
    expect(sv.origin).toBeNull();
    expect(sv.undo()).toBe(false);
  });
});

describe('suivi pendant la marche', () => {
  test('distanceToLast : distance depuis le dernier point', () => {
    const sv = createSurvey(); sv.start();
    const a = localToGps({ x: 0, y: 0 }, ORIGIN);
    sv.capturePoint([{ ...a, accuracy: 2 }]);
    expect(sv.distanceToLast()).toBeNull(); // pas encore de position courante
    const q = localToGps({ x: 12.4, y: 0 }, sv.origin);
    sv.feed({ ...q, accuracy: 2, t: Date.now() });
    expect(sv.distanceToLast()).toBeCloseTo(12.4, 1);
    expect(sv.distanceToLast(localToGps({ x: 3, y: 4 }, sv.origin))).toBeCloseTo(5, 1);
  });

  test('détection du retour au point de départ (≥ 3 points, ≤ 4 m)', () => {
    const sv = createSurvey(); sv.start();
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }];
    sv.capturePoint([{ ...localToGps(pts[0], ORIGIN), accuracy: 2 }]);
    for (const p of pts.slice(1)) sv.capturePoint([{ ...localToGps(p, sv.origin), accuracy: 2 }]);
    const near = { ...localToGps({ x: 1.5, y: 1.9 }, sv.origin), accuracy: 2 };
    const r = sv.nearStart(near);
    expect(r.near).toBe(true);
    expect(r.distance).toBeCloseTo(2.4, 1);
    expect(sv.nearStart({ ...localToGps({ x: 8, y: 6 }, sv.origin), accuracy: 2 }).near).toBe(false);
    // pas de proposition de fermeture avant 3 points
    const sv2 = createSurvey(); sv2.start();
    sv2.capturePoint([{ ...localToGps({ x: 0, y: 0 }, ORIGIN), accuracy: 2 }]);
    expect(sv2.nearStart({ ...localToGps({ x: 1, y: 0 }, sv2.origin), accuracy: 2 }).near).toBe(false);
  });

  test('trace : conserve les positions espacées de ≥ 0,5 m', () => {
    const sv = createSurvey(); sv.start();
    for (let i = 0; i < 10; i++) sv.feed({ ...localToGps({ x: i * 0.1, y: 0 }, ORIGIN), accuracy: 2, t: Date.now() });
    expect(sv.trail.length).toBeLessThanOrEqual(3);
    sv.feed({ ...localToGps({ x: 20, y: 0 }, ORIGIN), accuracy: 2, t: Date.now() });
    expect(sv.trail.length).toBeGreaterThan(1);
  });

  test('brouillon : sérialisation puis reprise', () => {
    const sv = createSurvey(); sv.start();
    sv.capturePoint([{ ...localToGps({ x: 0, y: 0 }, ORIGIN), accuracy: 2 }]);
    sv.capturePoint([{ ...localToGps({ x: 10, y: 0 }, sv.origin), accuracy: 3 }]);
    const draft = JSON.parse(JSON.stringify(sv.toDraft()));
    expect(draft.points).toHaveLength(2);
    expect(draft.points[1].accuracy).toBeGreaterThan(0);
    const sv2 = createSurvey({ draft });
    expect(sv2.state).toBe('recording');
    expect(sv2.points.map((p) => [p.x, p.y])).toEqual(sv.points.map((p) => [p.x, p.y]));
    expect(sv2.origin).toEqual(sv.origin);
  });
});

describe('rectangle 10 × 8 m relevé avec bruit de ±2 m', () => {
  function releve(seed, { sigma = 2, n = 50, drift = null, closeAtStart = false } = {}) {
    const r = rng(seed);
    const c = clock();
    const sv = createSurvey({ now: c.now }); sv.start();
    const corners = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
    const walk = closeAtStart ? [...corners, { x: 0, y: 0 }] : corners;
    walk.forEach((p, i) => {
      const dr = drift ? { x: p.x + drift.x * (i / (walk.length - 1)), y: p.y + drift.y * (i / (walk.length - 1)) } : p;
      const fx = samples(dr, { n, sigma, acc: 2.5, r, t0: c.t }).map((f) => ({ ...f, t: c.t }));
      c.t += 1000;
      // le premier point fixe l'origine sur la position GPS « vraie » du coin 1
      const res = sv.capturePoint(fx, closeAtStart && i === walk.length - 1 ? { asClosing: true } : {});
      expect(res.ok).toBe(true);
    });
    return sv;
  }
  const areaOf = (sv) => sv.result().area;

  test('surface ≈ 80 m² à ±8 % (échantillons moyennés)', () => {
    const sv = releve(12);
    const res = sv.close();
    expect(res.points).toHaveLength(4);
    expect(res.area).toBeGreaterThan(80 * 0.92);
    expect(res.area).toBeLessThan(80 * 1.08);
    expect(res.perimeter).toBeGreaterThan(33);
    expect(res.perimeter).toBeLessThan(39);
    expect(res.simple).toBe(true);
    expect(res.closureGap).toBeNull();
  });

  test('sur plusieurs relevés, l\'erreur de surface reste modeste et l\'incertitude annoncée est cohérente', () => {
    const errs = []; let unc = 0;
    for (let s = 1; s <= 20; s++) { const sv = releve(100 + s); errs.push(Math.abs(areaOf(sv) - 80)); unc = sv.result().uncertainty; }
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    expect(mean).toBeLessThan(6);
    expect(errs.filter((e) => e < 80 * 0.15).length).toBeGreaterThanOrEqual(18);
    expect(unc).toBeGreaterThan(1);
    expect(unc).toBeLessThan(40);
  });

  test('dérive de fermeture : retour au départ mesuré, écart réparti sur les côtés', () => {
    const sv = releve(21, { sigma: 0.3, n: 20, drift: { x: 2, y: -1.5 }, closeAtStart: true });
    expect(sv.points).toHaveLength(4);
    expect(sv.closing).not.toBeNull();
    const raw = sv.result({});
    expect(raw.closureGap).toBeGreaterThan(2);
    expect(raw.closureGap).toBeLessThan(3);
    const fixed = sv.result({ distribute: true });
    expect(fixed.distributed).toBe(true);
    expect(fixed.points).toHaveLength(4);
    // le 1er point ne bouge pas, les autres sont corrigés proportionnellement
    expect(fixed.points[0]).toEqual({ x: raw.points[0].x, y: raw.points[0].y });
    expect(distance(fixed.points[3], raw.points[3])).toBeGreaterThan(distance(fixed.points[1], raw.points[1]));
  });
});

describe('squareCorners : redressement des angles droits', () => {
  const bruit = [{ x: 0, y: 0 }, { x: 10.2, y: 0.6 }, { x: 9.5, y: 8.4 }, { x: -0.3, y: 7.7 }];

  test('rectangle légèrement déformé → vrai rectangle', () => {
    const r = squareCorners(bruit, { toleranceDeg: 8 });
    expect(r.squared).toBe(4);
    const p = r.points;
    for (let i = 0; i < 4; i++) {
      const a = p[i]; const b = p[(i + 1) % 4]; const c = p[(i + 2) % 4];
      const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
      expect(Math.abs(dot)).toBeLessThan(0.05);
    }
    expect(r.maxShift).toBeLessThan(1);
    expect(polygonArea(r.points)).toBeCloseTo(polygonArea(bruit), -1);
    // l'original n'est pas modifié (réversible)
    expect(bruit[1]).toEqual({ x: 10.2, y: 0.6 });
  });

  test('un angle éloigné de 90° (> tolérance) n\'est pas touché ; forme en L', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }];
    const r = squareCorners(tri, { toleranceDeg: 8 });
    expect(r.squared).toBe(0);
    expect(r.points).toEqual(tri);
    const L = [{ x: 0, y: 0 }, { x: 10, y: 0.4 }, { x: 10.3, y: 4 }, { x: 5, y: 4.2 }, { x: 4.8, y: 8 }, { x: 0.2, y: 8.3 }];
    const rl = squareCorners(L, { toleranceDeg: 8 });
    expect(rl.squared).toBe(6);
    expect(polygonArea(rl.points)).toBeCloseTo(10 * 4 + 5 * 4, -1);
  });

  test('la tolérance est respectée', () => {
    const trapeze = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 8 }, { x: 0, y: 8 }]; // angles ≈ 76° et 104°
    expect(squareCorners(trapeze, { toleranceDeg: 8 }).squared).toBe(2); // les deux angles à gauche sont droits
    expect(squareCorners(trapeze, { toleranceDeg: 20 }).squared).toBe(4);
  });

  test('buildContour : option explicite de redressement, aire et incertitude', () => {
    const pts = bruit.map((p) => ({ ...p, accuracy: 2 }));
    const plain = buildContour(pts);
    const sq = buildContour(pts, { square: true });
    expect(plain.squared).toBe(0);
    expect(sq.squared).toBe(4);
    expect(sq.area).toBeGreaterThan(70);
    expect(sq.uncertainty).toBeGreaterThan(5);
    expect(areaUncertainty([{ x: 0, y: 0, accuracy: 0 }, { x: 10, y: 0, accuracy: 0 }, { x: 10, y: 8, accuracy: 0 }])).toBeCloseTo(0, 5);
  });
});

describe('cohérence géographique', () => {
  test('la distance relevée correspond à la distance orthodromique', () => {
    const sv = createSurvey(); sv.start();
    sv.capturePoint([{ ...localToGps({ x: 0, y: 0 }, ORIGIN), accuracy: 2 }]);
    const q = localToGps({ x: 30, y: 40 }, sv.origin);
    sv.capturePoint([{ ...q, accuracy: 2 }]);
    const [a, b] = sv.points;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(haversine(a, b), 0);
  });
});
