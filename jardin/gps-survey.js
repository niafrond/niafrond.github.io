// Relevé GPS guidé du contour (logique pure, sans DOM) : qualité du signal, capture d'un point par fenêtre
// d'échantillons, conversion en repère local, fermeture, redressement des angles droits, incertitude.
import {
  gpsToLocal, localToGps, haversine, polygonArea, perimeter, isSimplePolygon, closeGapReport,
} from './geometry.js';

/** Seuils de précision (m) : ≤ 3 bonne, ≤ 6 moyenne, au-delà faible. */
export const QUALITY_GOOD = 3;
export const QUALITY_MEDIUM = 6;
/** Un échantillon plus vieux que cela n'est plus « en direct ». */
export const STALE_MS = 15000;
/** Durée par défaut de la fenêtre de capture d'un point. */
export const CAPTURE_MS = 5000;
/** Distance minimale entre deux points consécutifs (m). */
export const MIN_SEGMENT = 1;
/** Distance au 1er point en dessous de laquelle on propose de fermer le tour (m). */
export const CLOSE_RADIUS = 4;

const RAD = Math.PI / 180;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100 + 0; // « + 0 » évite -0

/** 'good' | 'medium' | 'weak' | 'none' selon la précision (m). */
export function qualityOf(accuracy) {
  if (!finite(accuracy) || accuracy <= 0) return 'none';
  if (accuracy <= QUALITY_GOOD) return 'good';
  if (accuracy <= QUALITY_MEDIUM) return 'medium';
  return 'weak';
}

export const QUALITY_LABEL = { good: 'bonne', medium: 'moyenne', weak: 'faible', none: 'aucun signal' };

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const validFix = (f) => f && finite(f.lat) && finite(f.lon) && Math.abs(f.lat) <= 90 && Math.abs(f.lon) <= 180;
const accOf = (f) => (finite(f.accuracy) && f.accuracy > 0 ? Math.max(0.5, f.accuracy) : 50);

/**
 * Point issu d'une fenêtre d'échantillons : rejet des valeurs aberrantes (écart à la médiane),
 * moyenne pondérée par 1/accuracy², précision estimée du point.
 * @param {{lat:number, lon:number, accuracy?:number}[]} fixes
 * @returns {{lat:number, lon:number, accuracy:number, used:number, rejected:number}|null}
 */
export function combineFixes(fixes) {
  const list = (fixes || []).filter(validFix);
  if (!list.length) return null;
  const ref = { lat: median(list.map((f) => f.lat)), lon: median(list.map((f) => f.lon)) };
  const loc = gpsToLocal(list.map((f) => ({ lat: f.lat, lon: f.lon })), ref).points;
  const dist = loc.map((p) => Math.hypot(p.x, p.y));
  const mad = median(dist.map((d) => Math.abs(d - median(dist)))) * 1.4826;
  const medAcc = median(list.map(accOf));
  const limit = Math.max(3 * mad, 2 * medAcc, 3);
  let keep = list.map((_, i) => i).filter((i) => dist[i] <= limit);
  if (!keep.length) keep = list.map((_, i) => i);
  let sw = 0; let sx = 0; let sy = 0;
  for (const i of keep) {
    const a = accOf(list[i]);
    const w = 1 / (a * a);
    sw += w; sx += w * loc[i].x; sy += w * loc[i].y;
  }
  const mx = sx / sw; const my = sy / sw;
  let sv = 0;
  for (const i of keep) { const a = accOf(list[i]); sv += ((loc[i].x - mx) ** 2 + (loc[i].y - my) ** 2) / (a * a); }
  const n = keep.length;
  const spread = n > 1 ? Math.sqrt(sv / sw / n) : 0;
  // les échantillons d'un même récepteur sont corrélés : ~3 mesures indépendantes au mieux
  const sigma = Math.sqrt(1 / sw) * Math.sqrt(Math.max(1, n / 3));
  const accuracy = Math.max(0.5, sigma, spread);
  const c = localToGps({ x: mx, y: my }, ref);
  return { lat: c.lat, lon: c.lon, accuracy: round2(accuracy), used: n, rejected: list.length - n };
}

/**
 * Redresse à 90° les angles du contour fermé dont l'écart à l'angle droit est < `toleranceDeg`.
 * Les côtés reliés par des angles droits partagent une même orientation ; les sommets sont recalculés
 * à l'intersection des côtés redressés (chaque côté garde son milieu). Renvoie de nouveaux points.
 * @returns {{points:{x,y}[], squared:number, maxShift:number, changed:boolean[]}}
 */
export function squareCorners(points, { toleranceDeg = 8 } = {}) {
  const n = points ? points.length : 0;
  const base = (points || []).map((p) => ({ x: p.x, y: p.y }));
  const none = { points: base, squared: 0, maxShift: 0, changed: base.map(() => false) };
  if (n < 3) return none;
  const ang = []; // direction de l'arête i → i+1
  const len = [];
  for (let i = 0; i < n; i++) {
    const a = points[i]; const b = points[(i + 1) % n];
    ang.push(Math.atan2(b.y - a.y, b.x - a.x));
    len.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  if (len.some((l) => l < 1e-6)) return none;
  const tol = toleranceDeg * RAD;
  // virage au sommet i (entre l'arête i-1 et l'arête i), dans ]-π, π]
  const turn = (i) => { let d = ang[i] - ang[(i - 1 + n) % n]; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; return d; };
  const squareAt = (i) => Math.abs(Math.abs(turn(i)) - Math.PI / 2) < tol;
  const sq = Array.from({ length: n }, (_, i) => squareAt(i));
  const squared = sq.filter(Boolean).length;
  if (!squared) return none;
  let start = sq.findIndex((v) => !v);
  if (start < 0) start = 0;
  const off = new Array(n).fill(0); // décalage (multiple de 90°) de chaque arête par rapport à la tête de groupe
  const group = new Array(n).fill(0);
  let g = 0; let acc = 0;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (k > 0) {
      if (sq[i]) acc += Math.sign(turn(i)) * (Math.PI / 2);
      else { g++; acc = 0; }
    }
    off[i] = acc; group[i] = g;
  }
  const dir = new Array(n);
  for (let gi = 0; gi <= g; gi++) {
    const idx = []; for (let i = 0; i < n; i++) if (group[i] === gi) idx.push(i);
    if (idx.length < 2) { idx.forEach((i) => { dir[i] = ang[i]; }); continue; }
    let sx = 0; let sy = 0;
    idx.forEach((i) => { sx += len[i] * Math.cos(ang[i] - off[i]); sy += len[i] * Math.sin(ang[i] - off[i]); });
    const th = Math.atan2(sy, sx);
    idx.forEach((i) => { dir[i] = th + off[i]; });
  }
  const mid = points.map((p, i) => ({ x: (p.x + points[(i + 1) % n].x) / 2, y: (p.y + points[(i + 1) % n].y) / 2 }));
  const out = []; let maxShift = 0;
  const changed = [];
  for (let i = 0; i < n; i++) {
    const j = (i - 1 + n) % n; // arête j : sommet j → i ; arête i : sommet i → i+1
    const u = { x: Math.cos(dir[j]), y: Math.sin(dir[j]) };
    const v = { x: Math.cos(dir[i]), y: Math.sin(dir[i]) };
    const cross = u.x * v.y - u.y * v.x;
    let p = { x: points[i].x, y: points[i].y };
    if (Math.abs(cross) > 0.05) {
      const dx = mid[i].x - mid[j].x; const dy = mid[i].y - mid[j].y;
      const t = (dx * v.y - dy * v.x) / cross;
      p = { x: mid[j].x + u.x * t, y: mid[j].y + u.y * t };
    }
    const shift = Math.hypot(p.x - points[i].x, p.y - points[i].y);
    maxShift = Math.max(maxShift, shift);
    changed.push(shift > 0.005);
    out.push({ x: round2(p.x), y: round2(p.y) });
  }
  return { points: out, squared, maxShift, changed };
}

/**
 * Incertitude (1 σ, m²) sur la surface : ∂A/∂p_i = |p_{i+1} − p_{i−1}| / 2, précision de chaque point en σ.
 * @param {{x,y,accuracy?}[]} pts
 */
export function areaUncertainty(pts, fallbackAccuracy = 3) {
  const n = pts.length;
  if (n < 3) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]; const b = pts[(i + 1) % n];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const sg = finite(pts[i].accuracy) ? pts[i].accuracy : fallbackAccuracy;
    s += (sg * L / 2) ** 2;
  }
  return Math.sqrt(s);
}

/**
 * Contour final à partir des points relevés.
 * `closing` : point posé en revenant au départ (sert à mesurer l'écart de fermeture, il n'est pas un sommet).
 * @returns {{points:{x,y}[], area:number, perimeter:number, closureGap:number|null, uncertainty:number, simple:boolean, squared:number, distributed:boolean}}
 */
export function buildContour(points, { closing = null, distribute = false, square = false, toleranceDeg = 8 } = {}) {
  let pts = points.map((p) => ({ x: p.x, y: p.y }));
  let closureGap = null; let distributed = false;
  if (closing && pts.length >= 2) {
    const rep = closeGapReport([...pts, { x: closing.x, y: closing.y }]);
    closureGap = rep.gap;
    if (distribute && rep.gap > 1e-6) {
      pts = rep.corrected.slice(0, -1).map((p) => ({ x: round2(p.x), y: round2(p.y) }));
      distributed = true;
    }
  }
  let squaredCount = 0;
  if (square) { const r = squareCorners(pts, { toleranceDeg }); pts = r.points; squaredCount = r.squared; }
  const sigma = points.map((p, i) => ({ x: pts[i] ? pts[i].x : p.x, y: pts[i] ? pts[i].y : p.y, accuracy: p.accuracy }));
  return {
    points: pts,
    area: pts.length >= 3 ? polygonArea(pts) : 0,
    perimeter: perimeter(pts, true),
    closureGap,
    uncertainty: areaUncertainty(sigma),
    simple: pts.length >= 3 ? isSimplePolygon(pts) : true,
    squared: squaredCount,
    distributed,
  };
}

/**
 * Machine d'états du relevé : idle → waiting-fix → ready → recording → closed.
 * @param {{originMode?:'first-point'|'fixed', origin?:{lat,lon}, now?:()=>number, draft?:object}} [opts]
 */
export function createSurvey({ originMode = 'first-point', origin = null, now = () => Date.now(), draft = null } = {}) {
  let started = false;
  let isClosed = false;
  let originRef = originMode === 'fixed' && origin ? { lat: origin.lat, lon: origin.lon } : null;
  let current = null; // dernier échantillon {lat, lon, accuracy, t}
  let first = null; // premier échantillon reçu (origine provisoire)
  const points = []; // {x, y, lat, lon, accuracy, used, t}
  let closing = null;
  const buffer = [];
  const trail = [];

  function localOf(lat, lon) {
    const o = originRef || first || { lat, lon };
    const p = gpsToLocal([{ lat, lon }], o).points[0];
    return { x: round2(p.x), y: round2(p.y) };
  }

  const api = {
    get points() { return points; },
    get closing() { return closing; },
    get current() { return current; },
    get trail() { return trail; },
    get origin() { return originRef ? { ...originRef } : null; },
    get closed() { return isClosed; },
    /** Origine du repère : celle du 1er point, sinon provisoire (1er échantillon reçu), sinon null. */
    frameOrigin() { return originRef || (first ? { lat: first.lat, lon: first.lon } : null); },
    start() { if (!isClosed) started = true; return api.state; },
    get state() {
      if (isClosed) return 'closed';
      if (!started) return 'idle';
      if (points.length) return 'recording';
      const q = api.status().quality;
      return q === 'good' || q === 'medium' ? 'ready' : 'waiting-fix';
    },
    /** Reçoit un échantillon GPS : met à jour la position courante, la qualité, le tampon et la trace. */
    feed(fix) {
      if (!validFix(fix)) return api.status();
      const f = { lat: fix.lat, lon: fix.lon, accuracy: finite(fix.accuracy) ? fix.accuracy : NaN, t: finite(fix.t) ? fix.t : now() };
      current = f;
      if (!first) first = f;
      buffer.push(f);
      if (buffer.length > 80) buffer.shift();
      const last = trail[trail.length - 1];
      if (!last || haversine(last, f) >= 0.5) { trail.push({ lat: f.lat, lon: f.lon }); if (trail.length > 600) trail.shift(); }
      return api.status();
    },
    /** Qualité du signal courant (précision et récence). */
    status() {
      if (!current) return { quality: 'none', accuracy: null, age: null, fresh: false, canCapture: false };
      const age = Math.max(0, now() - current.t);
      const fresh = age <= STALE_MS;
      const quality = fresh ? qualityOf(current.accuracy) : 'none';
      return { quality, accuracy: finite(current.accuracy) ? current.accuracy : null, age, fresh, canCapture: !isClosed && started && (quality === 'good' || quality === 'medium') };
    },
    /** Échantillons des `ms` dernières millisecondes (au moins le dernier). */
    recentFixes(ms = CAPTURE_MS) {
      const t0 = now() - ms;
      const r = buffer.filter((f) => f.t >= t0);
      return r.length ? r : (current ? [current] : []);
    },
    /** Position courante en repère local du plan (ou null). */
    currentLocal() { return current ? localOf(current.lat, current.lon) : null; },
    /** Distance (m) du dernier point posé à la position courante (ou `fix`). */
    distanceToLast(fix = current) {
      const last = points[points.length - 1];
      if (!last || !validFix(fix)) return null;
      return haversine(last, fix);
    },
    distanceToStart(fix = current) {
      if (!points.length || !validFix(fix)) return null;
      return haversine(points[0], fix);
    },
    /** Retour au départ : au moins 3 points et position courante à moins de `radius` m du 1er point. */
    nearStart(fix = current, radius = CLOSE_RADIUS) {
      if (points.length < 3) return { near: false, distance: api.distanceToStart(fix) };
      const d = api.distanceToStart(fix);
      return { near: d != null && d <= radius, distance: d };
    },
    /**
     * Pose un point à partir d'une fenêtre d'échantillons.
     * @param {object[]} [fixes] fenêtre (défaut : les 5 dernières secondes)
     * @param {{force?:boolean, closing?:boolean}} [opts]
     * @returns {{ok:true, point:object, index:number, warn:string[]} | {ok:false, reason:string, distance?:number}}
     */
    capturePoint(fixes = api.recentFixes(), { force = false, asClosing = false } = {}) {
      if (isClosed) return { ok: false, reason: 'closed' };
      if (!started) return { ok: false, reason: 'not-started' };
      const c = combineFixes(fixes);
      if (!c) return { ok: false, reason: 'no-fix' };
      const q = qualityOf(c.accuracy);
      if (!force && q === 'weak') return { ok: false, reason: 'weak', accuracy: c.accuracy };
      if (!originRef) originRef = { lat: c.lat, lon: c.lon };
      const loc = localOf(c.lat, c.lon);
      const pt = { x: loc.x, y: loc.y, lat: c.lat, lon: c.lon, accuracy: c.accuracy, used: c.used, t: now() };
      if (asClosing) {
        closing = pt;
        return { ok: true, point: pt, index: points.length, warn: [], closing: true };
      }
      const prev = points[points.length - 1];
      if (prev) {
        const d = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        if (d < MIN_SEGMENT && !force) { return { ok: false, reason: 'too-close', distance: d }; }
      }
      const warn = [];
      if (q === 'weak') warn.push('weak');
      if (c.rejected) warn.push('outliers');
      points.push(pt);
      return { ok: true, point: pt, index: points.length - 1, warn, rejected: c.rejected };
    },
    /** Annule le dernier point (et le point de fermeture éventuel). */
    undo() {
      if (isClosed) return false;
      if (closing) { closing = null; return true; }
      if (!points.length) return false;
      points.pop();
      if (!points.length && originMode !== 'fixed') originRef = null;
      return true;
    },
    clearClosing() { closing = null; },
    /** Contour courant (voir buildContour). */
    result(opts = {}) { return buildContour(points, { closing, ...opts }); },
    /** Termine le relevé : renvoie le contour et passe à l'état `closed`. */
    close(opts = {}) {
      if (points.length < 3) return null;
      const res = buildContour(points, { closing, ...opts });
      isClosed = true;
      return { ...res, origin: originRef ? { ...originRef } : null };
    },
    /** Brouillon sérialisable (reprise après interruption). */
    toDraft() {
      return {
        version: 1,
        origin: originRef ? { ...originRef } : null,
        points: points.map((p) => ({ lat: p.lat, lon: p.lon, accuracy: p.accuracy, x: p.x, y: p.y, used: p.used, t: p.t })),
        closing: closing ? { ...closing } : null,
      };
    },
  };

  if (draft && Array.isArray(draft.points)) {
    if (draft.origin && finite(draft.origin.lat) && finite(draft.origin.lon)) originRef = { lat: draft.origin.lat, lon: draft.origin.lon };
    for (const p of draft.points) if (validFix(p)) points.push({ ...p, ...localOf(p.lat, p.lon) });
    if (!points.length) originRef = originMode === 'fixed' && origin ? { lat: origin.lat, lon: origin.lon } : null;
    if (draft.closing && validFix(draft.closing)) closing = { ...draft.closing, ...localOf(draft.closing.lat, draft.closing.lon) };
    if (points.length) started = true;
  }
  return api;
}
