// Scène 3D temps réel du jardin (three.js passé en paramètre : chargé à la demande par `ui/view3d.js`).
// Repère 3D : x = plan x, z = plan y (vers le bas du plan = vers le sud si northAngle = 0), y = haut. Unités : mètres.
import { sunPosition } from './sun.js';
import { shapePolygon, bounds as polyBounds, signedArea } from './geometry.js';
import { ZONE_TYPES, isAbovePool } from './model.js';
import {
  placePlants, runJob, slimPlant, groupsFromRecords, hashStr, kindOf, isDeciduousWoody, isWoody, heightFactor, LAWN_PLANT, mulberry32,
  wallSegments, spotsAlong, hedgeSeg, familyOf, arcPt,
} from './gl-worker-core.js';
import { habitOf } from './habits.js';
import * as tx from './gl-textures.js';
import {
  dayOfYear, seasonDoy, plantSeasonState, groundState, seasonWarmth, leafFall, mixHex, fruitAmount,
} from './gl-season.js';
import { polyGeometry, buildBuilding, buildLinear, linearMaterial, buildOpening, buildItem, buildPoolLadder, segmentsWithGaps } from './gl-structures.js';

export { placePlants };

// Aménagements (items.js, écrit en parallèle) : import défensif.
let ITEMS = null;
try { ITEMS = await import('./items.js'); } catch (e) { ITEMS = null; }
// Plantes existantes déclarées (existing.js, écrit en parallèle) : import défensif, repli = aucune.
let EXISTING = null;
try { EXISTING = await import('./existing.js'); } catch (e) { EXISTING = null; }
/** Entrées « existant » à dessiner : `opts.existing` (tests) sinon `existingForRender(garden)`. */
export function existingEntries(garden, override) {
  if (Array.isArray(override)) return override;
  try { return (EXISTING && EXISTING.existingForRender && EXISTING.existingForRender(garden)) || []; } catch (e) { return []; }
}
const GHOST_GREY = '#a3a69e';
const edgeMaterial = (g, i) => { const e = g && Array.isArray(g.boundaryEdges) ? g.boundaryEdges[i] : null; return e && e.material; };
const DOUBLE_SIDED = new Set(['tuft', 'plume', 'fountain', 'upright', 'fine', 'frond', 'leaf', 'pad', 'curtain', 'stem']);
const STATIC_PARTS = new Set(['trunk', 'slat', 'culm']);
const TOP_PARTS = new Set(['crown', 'cone', 'tuft', 'mound', 'plume', 'fountain', 'upright', 'fine', 'frond', 'leaf', 'curtain', 'hedgebox', 'culm', 'stem', 'spike']);

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const DEFAULT_LAT = 46.5; const DEFAULT_LON = 2.5; // centre de la France
const FOLIAGE_DEFAULT = { tree: '#4f8f3a', fruit: '#5c9a3e', shrub: '#5a9a45', hedge: '#3f8f4a', climber: '#4f9a4a', perennial: '#6aa84a', groundcover: '#7ab356', grass: '#9ab45a', bulb: '#6aa84a', aquatic: '#4f9a6a', vegetable: '#6fae48', lawn: '#6aa84a' };

/** Direction du soleil (vers le soleil) dans le repère de la scène. `hour` = heure solaire (0–24). */
export function sunDirection(garden, { date = new Date(), hour = 14 } = {}) {
  const ctx = (garden && garden.context) || {};
  const loc = ctx.location;
  const lat = loc && Number.isFinite(loc.lat) ? loc.lat : DEFAULT_LAT;
  const lon = loc && Number.isFinite(loc.lon) ? loc.lon : DEFAULT_LON;
  const d0 = date instanceof Date ? date : new Date(date);
  const utc = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()) + (hour - lon / 15) * 3600000;
  const pos = sunPosition(lat, lon, new Date(utc));
  const a = rad(pos.azimuth + (Number(ctx.northAngle) || 0));
  const el = rad(pos.elevation);
  return { azimuth: pos.azimuth, elevation: pos.elevation, lat, lon, dir: { x: Math.sin(a) * Math.cos(el), y: Math.sin(el), z: -Math.cos(a) * Math.cos(el) } };
}

/** Couleurs du ciel (zénith, horizon) et intensités selon l'élévation du soleil (°). */
export function skyState(elev) {
  const KEYS = [
    { e: -12, top: '#050a1c', hor: '#101a33', hemi: 0.18, sun: 0 },
    { e: -3, top: '#14214a', hor: '#3b3f6b', hemi: 0.25, sun: 0 },
    { e: 3, top: '#3b5a8e', hor: '#f0a56e', hemi: 0.42, sun: 0.45 },
    { e: 12, top: '#4d86c8', hor: '#f3d3a7', hemi: 0.7, sun: 1.7 },
    { e: 30, top: '#4a90d9', hor: '#cfe6f5', hemi: 0.95, sun: 2.7 },
    { e: 70, top: '#3d86d6', hor: '#c4e0f4', hemi: 1.05, sun: 3.1 },
  ];
  if (elev <= KEYS[0].e) return { ...KEYS[0] };
  for (let i = 1; i < KEYS.length; i++) {
    if (elev <= KEYS[i].e) {
      const a = KEYS[i - 1]; const b = KEYS[i]; const t = (elev - a.e) / (b.e - a.e);
      return { e: elev, top: [a.top, b.top, t], hor: [a.hor, b.hor, t], hemi: a.hemi + (b.hemi - a.hemi) * t, sun: a.sun + (b.sun - a.sun) * t };
    }
  }
  return { ...KEYS[KEYS.length - 1] };
}

/** Le feuillage des caducs est-il présent ce mois-ci ? */
export const leavesOn = (month) => month >= 4 && month <= 11;
/** Facteur de hauteur des herbacées caduques (repos hivernal). */
export const dormancy = (month) => ([12, 1, 2].includes(month) ? 0.22 : [3, 11].includes(month) ? 0.6 : 1);

/** Piscine hors sol : hauteur de paroi et niveau de l'eau (m). */
export const ABOVE_POOL_H = 1.2;
export const ABOVE_POOL_WATER_H = 1.05;

function offsetPoly(poly, d) {
  const n = poly.length; const s = Math.sign(signedArea(poly)) || 1;
  return poly.map((p, i) => {
    const a = poly[(i + n - 1) % n]; const b = poly[(i + 1) % n];
    const e1 = Math.hypot(p.x - a.x, p.y - a.y) || 1; const e2 = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    const n1 = { x: ((p.y - a.y) / e1) * s, y: (-(p.x - a.x) / e1) * s };
    const n2 = { x: ((b.y - p.y) / e2) * s, y: (-(b.x - p.x) / e2) * s };
    let nx = n1.x + n2.x; let ny = n1.y + n2.y; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
    const k = d / Math.max(0.5, nx * n1.x + ny * n1.y);
    return { x: p.x + nx * k, y: p.y + ny * k };
  });
}

/** Tâches pour les workers : une par zone plantée ou pelouse, plus les arbres existants. */
export function jobsForGarden(garden, plantsById, { age = 1, density = 1, existing = null } = {}) {
  const get = (id) => (typeof plantsById === 'function' ? plantsById(id) : plantsById instanceof Map ? plantsById.get(id) : (plantsById || {})[id]);
  const jobs = [];
  for (const z of (garden && garden.zones) || []) {
    const plants = {};
    for (const pl of z.plantings || []) { const p = get(pl.plantId); if (p) plants[p.id] = slimPlant(p); }
    if (!Object.keys(plants).length && z.type !== 'lawn') continue;
    const lawnPlant = Object.values(plants).find((p) => p.category === 'lawn');
    const climbs = Object.values(plants).some((p) => familyOf(p) === 'climber');
    jobs.push({ zoneId: z.id, zone: { id: z.id, type: z.type, shape: z.shape, plantings: (z.plantings || []).map((p) => ({ plantId: p.plantId, count: p.count ?? p.quantity })) }, plants, age, density, lawnColor: lawnPlant && lawnPlant.foliageColor, walls: climbs ? wallSegments(garden) : [] });
  }
  // plantes existantes déclarées : taille actuelle (jamais jeunes/adultes), estompées si `keep === false`
  const ex = existingEntries(garden, existing).filter((e) => e && !['fence', 'wall'].includes(e.kind) && (Number.isFinite(e.x) || (e.points && e.points.length >= 2)));
  if (ex.length) {
    const plants = {}; const extra = [];
    ex.forEach((e, i) => {
      const pid = `_ex_${e.id ?? i}`; const ghost = e.keep === false;
      const base = e.plant ? slimPlant(e.plant) : { id: pid, category: e.kind === 'tree' ? 'tree' : e.kind === 'hedge' ? 'hedge' : 'shrub', heightAdult: 3, widthAdult: 2, foliage: 'deciduous', bloom: [], flowerColor: null, foliageColor: '#4f8a3c', spacing: 0, genus: '', stems: 0, support: null, culm: '#7aa04c' };
      const hid = (e.habit && (e.habit.id || e.habit)) || null;
      const habit = typeof hid === 'string' && habitOf({ habit: hid }).id === hid ? hid : (e.plant ? base.habit : (e.kind === 'tree' ? 'tree-round' : e.kind === 'hedge' ? 'hedge-clipped' : 'shrub-round'));
      const h = Number(e.height) > 0 ? Number(e.height) : base.heightAdult; const w = Number(e.width) > 0 ? Number(e.width) : base.widthAdult;
      const fo = base.foliageColor || FOLIAGE_DEFAULT[base.category];
      plants[pid] = { ...base, id: pid, habit, heightAdult: h, widthAdult: w, fixed: true, ghost, foliageColor: ghost ? mixHex(fo, GHOST_GREY, 0.55) : fo, flowerColor: base.flowerColor && ghost ? mixHex(base.flowerColor, GHOST_GREY, 0.55) : base.flowerColor };
      const r = (hashStr(String(e.id ?? i)) % 1000) / 1000;
      if (e.points && e.points.length >= 2) {
        let L = 0; for (let k = 0; k < e.points.length - 1; k++) L += Math.hypot(e.points[k + 1].x - e.points[k].x, e.points[k + 1].y - e.points[k].y);
        const seg = habit === 'hedge-clipped' ? hedgeSeg(plants[pid]) : Math.max(0.5, w * 0.8);
        const n = Math.max(1, Math.min(250, Math.ceil(L / seg)));
        spotsAlong(e.points, n).forEach((sp, k) => {
          let ang = 0; let bd = Infinity;
          for (let q = 0; q < e.points.length - 1; q++) { const dx = e.points[q + 1].x - e.points[q].x; const dy = e.points[q + 1].y - e.points[q].y; const t = Math.max(0, Math.min(1, ((sp.x - e.points[q].x) * dx + (sp.y - e.points[q].y) * dy) / (dx * dx + dy * dy || 1))); const d = Math.hypot(sp.x - e.points[q].x - dx * t, sp.y - e.points[q].y - dy * t); if (d < bd) { bd = d; ang = Math.atan2(dy, dx); } }
          extra.push({ plantId: pid, x: sp.x, y: sp.y, rot: ang, seed: ((r + k * 0.137) % 1) || 0.5, aux: habit === 'hedge-clipped' ? seg : 0 });
        });
      } else extra.push({ plantId: pid, x: e.x, y: e.y, rot: r * 6.28, seed: r || 0.5 });
    });
    jobs.push({ zoneId: '_existing', zone: null, plants, extra, age: 1, density });
  }
  const extra = []; const tplants = {};
  ((garden && garden.obstacles) || []).forEach((ob, i) => {
    if (ob.kind !== 'tree' || !ob.center) return;
    const id = `_otree${i}`;
    tplants[id] = { ...slimPlant({ id, category: 'tree', heightAdult: Number(ob.height) > 0 ? ob.height : 8, widthAdult: Math.max(1, (Number(ob.radius) || 2) * 2), foliage: 'deciduous', bloom: [], foliageColor: '#4f8a3c' }) };
    const r = (hashStr(`${ob.id || i}`) % 1000) / 1000;
    extra.push({ plantId: id, x: ob.center.x, y: ob.center.y, rot: r * 6.28, seed: r });
  });
  if (extra.length) jobs.push({ zoneId: '_obstacles', zone: null, plants: tplants, extra, age, density });
  return jobs;
}

/** Fusionne les groupes de plusieurs zones (même essence + même partie → un seul InstancedMesh). */
function mergeGroups(listOfGroups) {
  const map = new Map();
  for (const groups of listOfGroups) {
    for (const g of groups) {
      const k = `${g.plantId}|${g.part}`;
      let e = map.get(k);
      if (!e) { e = { plantId: g.plantId, part: g.part, n: 0, ms: [], ts: [] }; map.set(k, e); }
      e.n += g.n; e.ms.push(g.matrices); e.ts.push(g.tints);
    }
  }
  const out = [];
  for (const e of map.values()) {
    const matrices = new Float32Array(e.n * 16); const tints = new Float32Array(e.n);
    let om = 0; let ot = 0;
    for (let i = 0; i < e.ms.length; i++) { matrices.set(e.ms[i], om); om += e.ms[i].length; tints.set(e.ts[i], ot); ot += e.ts[i].length; }
    out.push({ plantId: e.plantId, part: e.part, n: e.n, matrices, tints });
  }
  return out;
}

/**
 * Construit la scène 3D (synchrone ; les instances viennent de `opts.results` — workers — sinon du calcul synchrone).
 * @returns {{scene, bounds, update(patch), dispose(), stats, ...}}
 */
export function buildScene(THREE, garden, opts = {}) {
  const g = garden || {};
  const quality = { density: 1, detail: 2, ...(opts.quality || {}) };
  const plantsById = opts.plantsById || {};
  const state = {
    age: clamp(Number.isFinite(opts.age) ? opts.age : 1, 0, 1),
    hour: Number.isFinite(opts.hour) ? opts.hour : 14,
    date: opts.date instanceof Date ? opts.date : new Date(new Date().getFullYear(), (opts.month || 6) - 1, 15),
    month: null, doy: null, leaves: opts.leaves !== false,
  };
  state.month = Number.isFinite(opts.month) ? opts.month : state.date.getMonth() + 1;
  state.doy = Number.isFinite(opts.doy) ? opts.doy : dayOfYear(state.date);
  const gloc = g.context && g.context.location;
  const glat = gloc && Number.isFinite(gloc.lat) ? gloc.lat : DEFAULT_LAT;
  const dry = 0.2 + 0.7 * ((hashStr(String(g.id || g.name || 'jardin')) % 1000) / 1000); // sécheresse estivale propre au jardin
  const sdoy = () => seasonDoy(state.doy, glat);

  const tracked = [];
  const track = (o) => { tracked.push(o); return o; };
  const scene = new THREE.Scene();
  const texCache = new Map();
  const ctx = {
    THREE, track,
    tex(name, factory, rx, ry) {
      let base = texCache.get(name);
      if (base === undefined) { base = factory(THREE); texCache.set(name, base); if (base) tracked.push(base); }
      if (!base || rx == null) return base;
      const t = base.clone(); t.repeat.set(rx, ry == null ? rx : ry); t.needsUpdate = true; tracked.push(t);
      return t;
    },
    mat(color, o = {}) {
      const key = `${color}|${Object.keys(o).sort().map((k) => `${k}=${o[k] && o[k].uuid ? o[k].uuid : o[k]}`).join(',')}`;
      let m = ctx._mats.get(key);
      if (!m) {
        const params = { color: new THREE.Color(color), roughness: 0.9, metalness: 0, ...o };
        if (!params.map) delete params.map;
        m = new THREE.MeshStandardMaterial(params);
        ctx._mats.set(key, m); tracked.push(m);
      }
      return m;
    },
    _mats: new Map(),
  };

  // ── contour et emprise ──
  let boundary = ((g.boundary || []).length >= 3 ? g.boundary : null);
  const allPts = [];
  for (const z of g.zones || []) { try { allPts.push(...shapePolygon(z.shape, 12)); } catch (e) { /* forme invalide */ } }
  for (const o of g.obstacles || []) { if (o.points) allPts.push(...o.points); }
  if (!boundary) boundary = allPts.length >= 3 ? [{ x: Math.min(...allPts.map((p) => p.x)), y: Math.min(...allPts.map((p) => p.y)) }, { x: Math.max(...allPts.map((p) => p.x)), y: Math.min(...allPts.map((p) => p.y)) }, { x: Math.max(...allPts.map((p) => p.x)), y: Math.max(...allPts.map((p) => p.y)) }, { x: Math.min(...allPts.map((p) => p.x)), y: Math.max(...allPts.map((p) => p.y)) }] : [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }];
  const bb = polyBounds(boundary);
  const cx = (bb.minX + bb.maxX) / 2; const cz = (bb.minY + bb.maxY) / 2;
  const radius = Math.max(6, Math.hypot(bb.width, bb.height) / 2);
  const bounds = { minX: bb.minX, maxX: bb.maxX, minZ: bb.minY, maxZ: bb.maxY, cx, cz, width: bb.width, depth: bb.height, radius };

  // ── sol ──
  const outerSize = radius * 24;
  const outer = new THREE.Mesh(track(new THREE.CircleGeometry(outerSize / 2, 48)), ctx.mat('#cfdcc0', { map: ctx.tex('ground', tx.groundTexture, outerSize / 4, outerSize / 4) }));
  outer.rotation.x = -Math.PI / 2; outer.position.set(cx, -0.02, cz); outer.receiveShadow = true; outer.name = 'terrain-exterieur';
  // le repeat du clone est en 1/tuile × taille : texture clonée déjà à 1/4 → on fixe la répétition absolue
  if (outer.material.map) outer.material.map.repeat.set(outerSize / 4, outerSize / 4);
  scene.add(outer);
  const ground = new THREE.Mesh(track(polyGeometry(THREE, boundary)), ctx.mat('#ffffff', { map: ctx.tex('ground', tx.groundTexture) }));
  const groundMats = [outer.material, ground.material];
  const lawnMats = [];
  ground.position.y = 0; ground.receiveShadow = true; ground.name = 'sol';
  scene.add(ground);

  // ── zones ──
  const zonesGroup = new THREE.Group(); zonesGroup.name = 'zones'; scene.add(zonesGroup);
  const zoneMat = (z) => {
    const h = hashStr(String(z.id || ''));
    switch (z.type) {
      case 'lawn': return { mat: ctx.mat('#ffffff', { map: ctx.tex('lawn', tx.lawnTexture) }), y: 0.012, depth: 0 };
      case 'terrace': return h % 2 ? { mat: ctx.mat('#ffffff', { map: ctx.tex('slab', tx.slabTexture), roughness: 0.85 }), y: 0, depth: 0.07 } : { mat: ctx.mat('#ffffff', { map: ctx.tex('wood', tx.woodTexture), roughness: 0.75 }), y: 0, depth: 0.07 };
      case 'path': return { mat: ctx.mat('#ffffff', { map: ctx.tex('gravel', tx.gravelTexture), roughness: 1 }), y: 0.02, depth: 0 };
      case 'vegetable': return { mat: ctx.mat('#ffffff', { map: ctx.tex('soilv', (T) => tx.soilTexture(T, '#5a3f2c')), roughness: 1 }), y: 0.016, depth: 0 };
      case 'lowplants': case 'midplants': case 'tallplants': return { mat: ctx.mat('#ffffff', { map: ctx.tex('soil', tx.soilTexture), roughness: 1 }), y: 0.016, depth: 0 };
      case 'other': { const t = ZONE_TYPES.find((x) => x.id === 'other'); return { mat: ctx.mat(t ? t.color : '#9e9e9e', {}), y: 0.016, depth: 0 }; }
      default: return null;
    }
  };
  const waterMeshes = [];
  for (const z of g.zones || []) {
    let poly = [];
    try { poly = shapePolygon(z.shape, 40); } catch (e) { poly = []; }
    if (poly.length < 3) continue;
    if (isAbovePool(z)) {
      // piscine hors sol : paroi en caisson / cylindre (selon la forme), épaisseur, margelle, eau à 1,05 m, échelle
      const poolPoly = z.shape.kind === 'circle' ? shapePolygon(z.shape, 64) : poly;
      const H = ABOVE_POOL_H;
      const wall = new THREE.Mesh(track(polyGeometry(THREE, offsetPoly(poolPoly, 0.07), H, [poolPoly])), ctx.mat('#ffffff', { map: ctx.tex('poolwall', tx.poolWallTexture, 1.5, 1.5), roughness: 0.6, metalness: 0.15 }));
      wall.castShadow = true; wall.receiveShadow = true; wall.name = `paroi-${z.id}`;
      const lip = new THREE.Mesh(track(polyGeometry(THREE, offsetPoly(poolPoly, 0.15), 0.05, [offsetPoly(poolPoly, 0.0)])), ctx.mat('#eceff1', { roughness: 0.5 }));
      lip.position.y = H; lip.castShadow = true; lip.name = `margelle-${z.id}`;
      const water = new THREE.Mesh(track(polyGeometry(THREE, poolPoly)), ctx.mat('#27b9d2', { roughness: 0.04, metalness: 0.25, envMapIntensity: 1.6 }));
      water.position.y = ABOVE_POOL_WATER_H; water.receiveShadow = true; water.name = `eau-${z.id}`;
      const floor = new THREE.Mesh(track(polyGeometry(THREE, poolPoly)), ctx.mat('#78909c', { roughness: 0.9 }));
      floor.position.y = 0.02; floor.name = `fond-${z.id}`;
      zonesGroup.add(wall, lip, water, floor); waterMeshes.push(water);
      // échelle : sur le sommet du côté sud (z maximal), à l'extérieur
      let pick = poolPoly[0];
      for (const p of poolPoly) if (p.y > pick.y) pick = p;
      const cx = poolPoly.reduce((s0, p) => s0 + p.x, 0) / poolPoly.length; const cy = poolPoly.reduce((s0, p) => s0 + p.y, 0) / poolPoly.length;
      const ux = pick.x - cx; const uy = pick.y - cy; const ul = Math.hypot(ux, uy) || 1;
      const ladder = buildPoolLadder(ctx, pick.x + (ux / ul) * 0.07, pick.y + (uy / ul) * 0.07, ux / ul, uy / ul, H);
      ladder.name = `echelle-${z.id}`;
      zonesGroup.add(ladder);
      continue;
    }
    if (z.type === 'pond' || z.type === 'pool') {
      const pool = z.type === 'pool';
      const rim = new THREE.Mesh(track(polyGeometry(THREE, offsetPoly(poly, pool ? 0.22 : 0.32), 0.1, [poly])), ctx.mat(pool ? '#e6e1d6' : '#a39d90', { roughness: 0.95 }));
      rim.castShadow = true; rim.receiveShadow = true; rim.name = `berge-${z.id}`;
      const water = new THREE.Mesh(track(polyGeometry(THREE, poly)), ctx.mat(pool ? '#27b9d2' : '#ffffff', { map: pool ? null : ctx.tex('water', tx.waterTexture), roughness: 0.04, metalness: 0.25, envMapIntensity: 1.6 }));
      water.position.y = 0.065; water.receiveShadow = true; water.name = `eau-${z.id}`;
      zonesGroup.add(rim, water); waterMeshes.push(water);
      continue;
    }
    const zm = zoneMat(z);
    if (!zm) continue;
    const mesh = new THREE.Mesh(track(polyGeometry(THREE, poly, zm.depth)), zm.mat);
    mesh.position.y = zm.y; mesh.receiveShadow = true; mesh.castShadow = zm.depth > 0; mesh.name = `zone-${z.type}-${z.id}`;
    zonesGroup.add(mesh);
    if (z.type === 'lawn') lawnMats.push(zm.mat);
  }

  // ── structures : obstacles, côtés du contour, ouvertures, mobilier ──
  const structures = new THREE.Group(); structures.name = 'structures'; scene.add(structures);
  const openings = g.openings || [];
  const gapsOf = (refMatch) => openings.map((op) => {
    if (!ITEMS || !op.ref || !refMatch(op.ref)) return null;
    const geo = ITEMS.openingGeometry(g, op); if (!geo) return null;
    return { t: geo.t, w: geo.width };
  }).filter(Boolean);
  for (const ob of g.obstacles || []) {
    if ((ob.kind === 'house' || ob.kind === 'shed') && (ob.points || []).length >= 3) structures.add(buildBuilding(ctx, ob));
    else if ((ob.kind === 'wall' || ob.kind === 'fence') && (ob.points || []).length >= 2) {
      const h = Number(ob.height) > 0 ? Number(ob.height) : (ob.kind === 'wall' ? 2 : 1.2);
      for (let i = 0; i < ob.points.length - 1; i++) {
        const gaps = gapsOf((r) => r.type === 'obstacle' && r.obstacleId === ob.id && r.side === i);
        const L = Math.hypot(ob.points[i + 1].x - ob.points[i].x, ob.points[i + 1].y - ob.points[i].y);
        for (const [t0, t1] of segmentsWithGaps(L, gaps)) {
          const m = buildLinear(ctx, ob.kind, ob.points[i], ob.points[i + 1], h, ob.kind === 'wall' ? 0.2 : 0.06, t0, t1, { material: ob.material });
          if (m) structures.add(m);
        }
      }
    }
  }
  if (ITEMS && boundary === g.boundary) {
    for (const s of ITEMS.boundarySides(g)) {
      const kind = ITEMS.edgeKindOf(g, s.i);
      if (kind === 'open') continue;
      const ek = ITEMS.getEdgeKind(kind) || {};
      const h = ITEMS.edgeHeightOf(g, s.i);
      const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      const gaps = gapsOf((r) => r.type === 'boundary' && r.side === s.i);
      for (const [t0, t1] of segmentsWithGaps(L, gaps)) {
        const m = buildLinear(ctx, kind, s.a, s.b, h, ek.thickness || (kind === 'hedge' ? 0.6 : 0.15), t0, t1, { material: edgeMaterial(g, s.i) });
        if (m) structures.add(m);
      }
    }
  }
  // clôtures / murs existants déclarés (matériau, hauteur réelle, estompés si `keep === false`)
  for (const e of existingEntries(g, opts.existing)) {
    if (!e || !['fence', 'wall'].includes(e.kind) || !(e.points || []).length) continue;
    const h = Number(e.height) > 0 ? Number(e.height) : (e.kind === 'wall' ? 2 : 1.2);
    for (let i = 0; i < e.points.length - 1; i++) {
      const m = buildLinear(ctx, e.kind, e.points[i], e.points[i + 1], h, e.kind === 'wall' ? 0.2 : 0.06, 0, 1, { material: e.material, ghost: e.keep === false });
      if (m) { m.userData.existing = true; structures.add(m); }
    }
  }
  if (ITEMS) {
    for (const op of openings) {
      try {
        const geo = ITEMS.openingGeometry(g, op); if (!geo) continue;
        structures.add(buildOpening(ctx, op, ITEMS.getOpeningKind(op.kind), geo));
      } catch (e) { /* ouverture invalide */ }
    }
    for (const it of g.items || []) {
      try { structures.add(buildItem(ctx, it, ITEMS.getItemKind(it.kind))); } catch (e) { /* élément invalide */ }
    }
  }

  // ── plantes (instances) ──
  const plantsGroup = new THREE.Group(); plantsGroup.name = 'plantes'; scene.add(plantsGroup);
  const jobs = opts.jobs || jobsForGarden(g, plantsById, { age: state.age, density: quality.density, existing: opts.existing });
  const results = opts.results && opts.results.length === jobs.length ? opts.results : jobs.map((j) => runJob(j));
  const slims = { _lawn: LAWN_PLANT };
  for (const j of jobs) Object.assign(slims, j.plants);
  const merged = mergeGroups(results.map((r) => r.groups));

  const geoCache = new Map();
  const partGeometry = (part) => {
    let geo = geoCache.get(part);
    if (geo) return geo;
    const made = portGeometry(THREE, part, quality.detail);
    if (made) geo = made;
    else if (part === 'trunk') { geo = new THREE.CylinderGeometry(0.6, 1, 1, 7, 1); geo.translate(0, 0.5, 0); }
    else if (part === 'branch') { geo = new THREE.CylinderGeometry(0.1, 1, 1, 5, 1); geo.translate(0, 0.5, 0); }
    else if (part === 'cone') { geo = new THREE.ConeGeometry(1, 1, 9, 1); geo.translate(0, 0.5, 0); shadeVertical(THREE, geo, 0, 1, 0.62, 1.08); }
    else if (part === 'flower') geo = new THREE.IcosahedronGeometry(1, 0);
    else if (part === 'tuft') geo = bladesGeometry(THREE);
    else { // crown | mound : icosaèdre irrégulier
      geo = new THREE.IcosahedronGeometry(1, quality.detail);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
        const f = 1 + 0.11 * Math.sin(x * 5.1 + z * 3.7) + 0.09 * Math.sin(y * 6.3 - x * 2.9) + 0.07 * Math.sin(z * 8.1 + y * 4.3);
        p.setXYZ(i, x * f, y * f, z * f);
      }
      geo.computeVertexNormals();
      shadeVertical(THREE, geo, -1, 1, 0.66, 1.08);
    }
    track(geo); geoCache.set(part, geo);
    return geo;
  };
  const partMaterial = (plantId, part) => {
    const plant = slims[plantId] || LAWN_PLANT;
    const ghost = plant.ghost ? { transparent: true, opacity: 0.38, depthWrite: false } : {};
    if (part === 'trunk') return ctx.mat(plant.ghost ? '#8c8a86' : '#6b5242', { roughness: 1, ...ghost });
    if (part === 'branch' || part === 'arc') return ctx.mat(plant.ghost ? '#8c8a86' : '#5b4636', { roughness: 1, ...ghost });
    if (part === 'slat') return ctx.mat('#a88b63', { roughness: 0.85 });
    if (part === 'culm') return ctx.mat(plant.ghost ? '#9a9c94' : (plant.culm || '#7aa04c'), { roughness: 0.55, vertexColors: true, ...ghost });
    if (part === 'fruit') { const c = ['#d63a2a', '#e0932b', '#c9402a', '#8e2f5a'][hashStr(String(plant.id)) % 4]; return ctx.mat(c, { roughness: 0.5, flatShading: true, transparent: true }); }
    if (part === 'flower' || part === 'spike') { const c = plant.flowerColor || '#f4c2d7'; return ctx.mat(c, { roughness: 0.55, emissive: c, emissiveIntensity: 0.12, flatShading: true }); }
    const c = plant.foliageColor || FOLIAGE_DEFAULT[plant.category] || '#5a9a45';
    const o = { roughness: 0.88, vertexColors: true, flatShading: ['crown', 'cone', 'mound', 'hedgebox'].includes(part), ...ghost };
    if (DOUBLE_SIDED.has(part)) o.side = THREE.DoubleSide;
    return ctx.mat(c, o);
  };
  const meshes = [];
  const smallShadows = quality.density >= 1;
  for (const gr of merged) {
    const geo = partGeometry(gr.part);
    const mat = partMaterial(gr.plantId, gr.part);
    const im = new THREE.InstancedMesh(geo, mat, gr.n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.instanceMatrix.array.set(gr.matrices);
    const col = new Float32Array(gr.n * 3);
    for (let i = 0; i < gr.n; i++) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = gr.tints[i]; }
    im.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
    im.frustumCulled = false;
    im.castShadow = (['trunk', 'branch', 'crown', 'cone', 'hedgebox', 'curtain'].includes(gr.part) || (smallShadows && (gr.part === 'mound' || gr.part === 'culm'))) && !(slims[gr.plantId] && slims[gr.plantId].ghost);
    im.receiveShadow = !['flower', 'spike', 'fruit'].includes(gr.part);
    im.name = `${gr.plantId}:${gr.part}`;
    im.userData = { plantId: gr.plantId, part: gr.part, key: `${gr.plantId}|${gr.part}` };
    plantsGroup.add(im); meshes.push(im);
  }
  const instanceCount = meshes.reduce((s, m) => s + m.count, 0);
  const speciesIds = [...new Set(meshes.map((m) => m.userData.plantId))].filter((id) => !id.startsWith('_'));

  // ── lumières, ciel, brouillard ──
  const hemi = new THREE.HemisphereLight('#bcd6f5', '#6b5a3f', 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff2dc', 3);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  const ext = radius * 1.3;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = radius * 8;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; sun.shadow.radius = 3;
  sun.shadow.mapSize.set(quality.shadow || 2048, quality.shadow || 2048);
  sun.target.position.set(cx, 0, cz);
  scene.add(sun, sun.target);

  const skyR = Math.max(700, radius * 30);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4a90d9') }, hor: { value: new THREE.Color('#cfe6f5') }, ground: { value: new THREE.Color('#9fb08a') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff2dc') }, glow: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 ground; uniform vec3 sunDir; uniform vec3 sunCol; uniform float glow; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 c = h >= 0.0 ? mix(hor, top, pow(h, 0.55)) : mix(hor, ground, smoothstep(0.0, 0.2, -h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.18) * glow;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  skyMat.toneMapped = true;
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(skyR, 32, 16)), track(skyMat));
  sky.position.set(cx, 0, cz); sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'ciel';
  scene.add(sky);
  scene.fog = new THREE.Fog('#cfe6f5', radius * 4, radius * 16);

  // ── feuilles qui tombent (particules légères, désactivées en qualité Basse / mobile) ──
  let fx = null;
  const fxMax = Math.max(0, Math.round(quality.particles || 0));
  if (fxMax > 0) {
    const srcs = [];
    for (const im of meshes) {
      const { plantId, part } = im.userData; const plant = slims[plantId];
      if (part !== 'crown' || !plant || !isDeciduousWoody(plant)) continue;
      const a = im.instanceMatrix.array;
      const hue = plantSeasonState(plant, 300).hue;
      for (let i = 0; i < im.count; i++) srcs.push({ x: a[i * 16 + 12], y: a[i * 16 + 13] + Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]) * 0.3, z: a[i * 16 + 14], r: Math.hypot(a[i * 16], a[i * 16 + 1], a[i * 16 + 2]) * 0.8, hue });
    }
    if (srcs.length) {
      const rnd = mulberry32(hashStr('feuilles'));
      const pos = new Float32Array(fxMax * 3); const col = new Float32Array(fxMax * 3);
      const own = new Array(fxMax); const vel = new Float32Array(fxMax); const ph = new Float32Array(fxMax);
      const tc = new THREE.Color();
      for (let i = 0; i < fxMax; i++) {
        const sr = srcs[Math.floor(rnd() * srcs.length)]; own[i] = sr;
        const a = rnd() * 6.283; const d = Math.sqrt(rnd()) * sr.r;
        pos[i * 3] = sr.x + Math.cos(a) * d; pos[i * 3 + 1] = rnd() * sr.y; pos[i * 3 + 2] = sr.z + Math.sin(a) * d;
        vel[i] = 0.45 + rnd() * 0.7; ph[i] = rnd() * 6.283;
        tc.set(sr.hue).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.12);
        col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setDrawRange(0, 0);
      const pts = new THREE.Points(track(geo), track(new THREE.PointsMaterial({ size: 0.24, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.92, depthWrite: false })));
      pts.frustumCulled = false; pts.visible = false; pts.name = 'feuilles-qui-tombent';
      scene.add(pts);
      fx = { points: pts, pos, vel, ph, own, rnd, t: 0, max: fxMax, rng: rnd };
    }
  }
  const fxCount = () => (fx && state.leaves ? Math.round(fx.max * (state.fall || 0)) : 0);
  function fxApply() {
    if (!fx) return;
    const n = fxCount();
    fx.points.geometry.setDrawRange(0, n); fx.points.visible = n > 0;
  }
  function fxTick(dt) {
    if (!fx) return false;
    const n = fxCount();
    if (!n) return false;
    fx.t += dt;
    const { pos, vel, ph, own, rnd } = fx;
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] -= vel[i] * dt;
      pos[i * 3] += Math.sin(fx.t * 1.3 + ph[i]) * 0.3 * dt;
      pos[i * 3 + 2] += Math.cos(fx.t * 1.1 + ph[i]) * 0.2 * dt;
      if (pos[i * 3 + 1] < 0.03) {
        const sr = own[i]; const a = rnd() * 6.283; const d = Math.sqrt(rnd()) * sr.r;
        pos[i * 3] = sr.x + Math.cos(a) * d; pos[i * 3 + 1] = sr.y * (0.6 + rnd() * 0.5); pos[i * 3 + 2] = sr.z + Math.sin(a) * d;
      }
    }
    fx.points.geometry.attributes.position.needsUpdate = true;
    return true;
  }

  // ── mise à jour ──
  const tmpA = new THREE.Color(); const tmpB = new THREE.Color();
  const TENDER = new THREE.Color('#b4de6e'); const DRY = new THREE.Color('#a8955f');
  const baseOf = (plant) => plant.foliageColor || FOLIAGE_DEFAULT[plant.category] || '#5a9a45';
  const applySeason = () => {
    const doy = sdoy();
    const cache = new Map();
    const st = (plantId) => { let v = cache.get(plantId); if (!v) { v = plantSeasonState(slims[plantId] || LAWN_PLANT, doy); cache.set(plantId, v); } return v; };
    for (const im of meshes) {
      const { plantId, part } = im.userData; const plant = slims[plantId];
      if (!plant) continue;
      const ps = st(plantId);
      const mat = im.material;
      const gh = plant.ghost ? 0.38 : 1;
      if (part === 'flower' || part === 'spike') {
        im.visible = ps.flower > 0.02;
        if (!mat.transparent) { mat.transparent = true; mat.needsUpdate = true; }
        mat.opacity = ps.flower * gh; mat.depthWrite = ps.flower > 0.9 && !plant.ghost;
        continue;
      }
      if (part === 'fruit') {
        const fa = fruitAmount(plant, doy) * (ps.kind === 'woody' ? Math.min(1, ps.leafDensity * 1.6) : 1);
        im.visible = fa > 0.05; mat.opacity = fa * gh; mat.depthWrite = false;
        continue;
      }
      if (part === 'branch' || part === 'arc') { im.visible = ps.kind === 'woody' ? ps.leafDensity < 0.97 : part === 'branch' && plant.habit !== 'bamboo'; continue; }
      if (STATIC_PARTS.has(part)) continue;
      if (ps.kind === 'woody') {
        im.visible = ps.leafDensity > 0.03;
        const hash = ps.leafDensity < 0.985;
        if (mat.alphaHash !== hash) { mat.alphaHash = hash; mat.needsUpdate = true; }
        mat.opacity = (hash ? Math.max(0.04, ps.leafDensity) : 1) * gh;
        tmpA.set(baseOf(plant));
        if (ps.spring > 0) tmpA.lerp(TENDER, ps.spring * 0.75);
        if (ps.tint > 0) tmpA.lerp(tmpB.set(ps.hue), ps.tint);
        mat.color.copy(tmpA);
        im.scale.y = 1;
        if (plant.ghost) { mat.transparent = true; mat.depthWrite = false; }
      } else {
        im.visible = true; im.scale.y = ps.scaleY;
        tmpA.set(baseOf(plant));
        if (ps.tint > 0) tmpA.lerp(DRY, ps.tint);
        mat.color.copy(tmpA);
      }
    }
    // sol : vert vif → vert doux → paille → terne
    const gs = groundState(doy, dry);
    for (const m of lawnMats) m.color.set(gs.lawnTint);
    for (const m of groundMats) m.color.set(gs.groundTint);
    state.fall = leafFall(doy);
    fxApply();
  };
  const applySun = () => {
    const s = sunDirection(g, { date: state.date, hour: state.hour });
    const sk = skyState(s.elevation);
    const mix = (v) => (Array.isArray(v) ? new THREE.Color(v[0]).lerp(new THREE.Color(v[1]), v[2]) : new THREE.Color(v));
    const wm = seasonWarmth(sdoy()); const winter = Math.max(0, -wm); const summer = Math.max(0, wm);
    const top = mix(sk.top).lerp(new THREE.Color('#8ea3ba'), 0.32 * winter);
    const hor = mix(sk.hor).lerp(new THREE.Color('#f7e2bd'), 0.14 * summer).lerp(new THREE.Color('#e3e9ee'), 0.3 * winter);
    skyMat.uniforms.top.value.copy(top); skyMat.uniforms.hor.value.copy(hor);
    skyMat.uniforms.ground.value.copy(hor).multiplyScalar(0.75);
    const warm = new THREE.Color('#ff9f55').lerp(new THREE.Color('#fff4e2'), smooth(2, 35, s.elevation)).lerp(new THREE.Color('#d4e3ff'), 0.4 * winter).lerp(new THREE.Color('#ffe2b0'), 0.25 * summer);
    sun.color.copy(warm);
    skyMat.uniforms.sunCol.value.copy(warm);
    skyMat.uniforms.glow.value = s.elevation > -1 ? 1 : 0;
    const d = radius * 3;
    sun.position.set(cx + s.dir.x * d, Math.max(0.5, s.dir.y * d + 0), cz + s.dir.z * d);
    sun.intensity = sk.sun * (s.elevation > 0 ? 1 : smooth(-3, 0, s.elevation));
    sun.visible = sun.intensity > 0.01;
    hemi.color.copy(top).lerp(new THREE.Color('#ffffff'), 0.35); hemi.groundColor.set('#5f5440').lerp(hor, 0.2);
    hemi.intensity = sk.hemi;
    scene.fog.color.copy(hor);
    scene.fog.near = radius * 4 * (1 - 0.4 * winter); scene.fog.far = radius * 16 * (1 - 0.3 * winter);
    skyMat.uniforms.sunDir.value.set(s.dir.x, s.dir.y, s.dir.z);
    state.sun = s;
    return s;
  };
  const growth = (age) => {
    const gs = jobs.map((j, ji) => {
      const r = results[ji];
      return groupsFromRecords(r.rec, r.ids, { ...j.plants, _lawn: LAWN_PLANT }, { age, density: quality.density });
    });
    const next = mergeGroups(gs);
    const byKey = new Map(next.map((n) => [`${n.plantId}|${n.part}`, n]));
    for (const im of meshes) {
      const n = byKey.get(im.userData.key);
      if (n && n.n === im.count) { im.instanceMatrix.array.set(n.matrices); im.instanceMatrix.needsUpdate = true; }
    }
  };

  const api = {
    scene, bounds, state, sun, hemi, sky, waterMeshes, meshes, plantsGroup, zonesGroup, structures, jobs,
    speciesIds, slims,
    stats: { instances: instanceCount, meshes: meshes.length, objects: scene.children.length },
    /** Hauteur max (m) des plantes, lue dans les matrices d'instances. */
    topHeight() {
      let top = 0;
      for (const im of meshes) {
        if (!TOP_PARTS.has(im.userData.part)) continue;
        const a = im.instanceMatrix.array;
        for (let i = 0; i < im.count; i++) top = Math.max(top, a[i * 16 + 13] + Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]));
      }
      return top;
    },
    update(patch = {}) {
      let seasonDirty = false;
      if (patch.date instanceof Date) { state.date = patch.date; if (!Number.isFinite(patch.month)) state.month = patch.date.getMonth() + 1; state.doy = dayOfYear(patch.date); seasonDirty = true; }
      if (Number.isFinite(patch.month)) {
        state.month = patch.month;
        if (!(patch.date instanceof Date)) state.date = new Date(state.date.getFullYear(), patch.month - 1, 15);
        state.doy = dayOfYear(state.date);
        seasonDirty = true;
      }
      if (Number.isFinite(patch.doy)) { state.doy = patch.doy; seasonDirty = true; }
      if (typeof patch.leaves === 'boolean' && patch.leaves !== state.leaves) { state.leaves = patch.leaves; seasonDirty = true; }
      if (Number.isFinite(patch.hour)) state.hour = patch.hour;
      if (Number.isFinite(patch.age)) { const a = clamp(patch.age, 0, 1); if (a !== state.age) { state.age = a; growth(a); } }
      if (seasonDirty) applySeason();
      applySun();
      return state;
    },
    /** Anime les feuilles qui tombent (dt en s) ; renvoie true si des particules bougent. */
    tick(dt) { return fxTick(dt); },
    fxActive() { return fxCount() > 0; },
    leafFx: () => fx,
    setShadowSize(n) {
      sun.shadow.mapSize.set(n, n);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    },
    dispose() {
      for (const im of meshes) im.dispose();
      for (const o of tracked) { try { o.dispose && o.dispose(); } catch (e) { /* déjà libéré */ } }
      sun.shadow.map && sun.shadow.map.dispose();
      scene.clear();
      api.disposed = true;
    },
  };
  applySeason();
  applySun();
  if (state.age !== 1 && opts.results == null) { /* instances déjà générées à l'âge demandé */ }
  return api;
}

/** Comme `buildScene`, mais la génération des instances passe par un pool de Web Workers. */
export async function buildSceneAsync(THREE, garden, opts = {}, pool = null) {
  const age = Number.isFinite(opts.age) ? opts.age : 1;
  const jobs = jobsForGarden(garden, opts.plantsById || {}, { age, density: (opts.quality && opts.quality.density) || 1, existing: opts.existing });
  let gen = { results: null, ms: 0, workers: 0 };
  if (pool) gen = await pool.run(jobs);
  else {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    gen = { results: jobs.map((j) => runJob(j)), workers: 0 };
    gen.ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  }
  const api = buildScene(THREE, garden, { ...opts, jobs, results: gen.results });
  api.generation = { ms: gen.ms, workers: gen.workers, jobs: jobs.length, instances: api.stats.instances };
  return api;
}

/** Feuilles d'herbe d'une touffe (rayon 1, hauteur 1, base sombre → pointe claire). */
function bladesGeometry(THREE) {
  const N = 12; const pos = []; const col = []; const nor = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * 2.3 + i * 0.37;
    const r0 = 0.05 + ((i * 37) % 10) / 10 * 0.35;
    const lean = 0.18 + ((i * 53) % 10) / 10 * 0.5;
    const hgt = 0.62 + ((i * 29) % 10) / 10 * 0.38;
    const ca = Math.cos(a); const sa = Math.sin(a); const tx_ = -sa; const tz_ = ca;
    const w = 0.07;
    const bx = ca * r0; const bz = sa * r0;
    const tipx = ca * (r0 + lean); const tipz = sa * (r0 + lean);
    pos.push(bx - tx_ * w, 0, bz - tz_ * w, bx + tx_ * w, 0, bz + tz_ * w, tipx, hgt, tipz);
    col.push(0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 1.1, 1.1, 1.1);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return geo;
}

/** Dégradé vertical (assombrit le bas) : couleurs de sommet multipliées par la couleur du matériau. */
function shadeVertical(THREE, geo, y0, y1, lo, hi) {
  const p = geo.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1);
    const v = lo + (hi - lo) * t;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
}
export { heightFactor, kindOf };


// ─── géométries des ports (unité = 1 m avant mise à l'échelle par instance) ───────
const LCOL = (g, f0, f1) => { // couleurs de sommet : base sombre → pointe claire selon y relatif
  const p = g.attributes.position; let lo = Infinity; let hi = -Infinity;
  for (let i = 0; i < p.count; i++) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); }
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = hi > lo ? (p.getY(i) - lo) / (hi - lo) : 1; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f0 + (f1 - f0) * t; }
  g.setAttribute('color', new (g.attributes.position.constructor)(c, 3));
  return g;
};

/** Ruban de feuille : `path(t)` → [r, y] (r = portée horizontale), `wid(t)` → largeur ; orienté selon `phi`. Ajoute à `out`. */
function leafInto(out, { phi = 0, path, wid, segs = 6, cup = 0, ox = 0, oz = 0 }) {
  const c = Math.cos(phi); const s = Math.sin(phi); const tx_ = -s; const tz_ = c;
  const base = out.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; const [r, y] = path(t); const w = wid(t) / 2;
    const cx0 = ox + c * r; const cz0 = oz + s * r;
    const row = cup ? [[-w, cup * w], [0, 0], [w, cup * w]] : [[-w, 0], [w, 0]];
    for (const [d, up] of row) { out.pos.push(cx0 + tx_ * d, y + up, cz0 + tz_ * d); out.col.push(0.55 + 0.6 * t); }
  }
  const per = cup ? 3 : 2;
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < per - 1; k++) {
      const a = base + i * per + k; const b = a + 1; const c2 = a + per; const d = c2 + 1;
      out.idx.push(a, b, c2, b, d, c2);
    }
  }
}
function finishLeaves(THREE, out, flat = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  const col = []; for (const v of out.col) col.push(v, v, v);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(out.idx); g.computeVertexNormals();
  if (flat) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  return g;
}
const newOut = () => ({ pos: [], col: [], idx: [] });
const frac = (i, k) => ((i * k) % 97) / 97;

function portGeometry(THREE, part, detail) {
  const lo = detail < 2;
  switch (part) {
    case 'culm': { // chaume : cylindre effilé aux nœuds renflés, teinte plus sombre aux nœuds
      const seg = lo ? 18 : 30; const g = new THREE.CylinderGeometry(0.62, 1, 1, 6, seg); g.translate(0, 0.5, 0);
      const p = g.attributes.position; const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); const k = Math.round(y * 9); const dn = Math.abs(y * 9 - k) / 9; // distance au nœud le plus proche (en fraction de hauteur)
        const node = Math.exp(-((dn / 0.012) ** 2));
        const f = 1 + 0.5 * node; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
        const v = 1.05 - 0.3 * node - 0.1 * y; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    }
    case 'stem': { const g = new THREE.CylinderGeometry(0.55, 1, 1, 4, 1); g.translate(0, 0.5, 0); return LCOL(g, 0.7, 1.05); }
    case 'slat': { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }
    case 'fruit': return new THREE.IcosahedronGeometry(1, 0);
    case 'spike': { // épi : fuseau effilé, renflé au tiers inférieur
      const g = new THREE.CylinderGeometry(0.12, 0.55, 1, 6, 5); g.translate(0, 0.5, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const f = (0.55 + 0.9 * Math.sin(Math.PI * Math.min(1, y * 1.15))) * (1 + 0.12 * Math.sin(y * 31 + p.getX(i) * 9)); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
      g.computeVertexNormals(); return g;
    }
    case 'arc': { // tige arquée : monte puis retombe (plan XY, portée 1)
      const N = lo ? 8 : 12; const g = new THREE.BufferGeometry(); const pos = []; const col = []; const idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N; const [x, y] = arcPt(t); const r = 0.02 * (1 - 0.7 * t) + 0.004;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; pos.push(x, y + Math.cos(a) * r, Math.sin(a) * r); col.push(1, 1, 1); }
      }
      for (let i = 0; i < N; i++) for (let k = 0; k < 5; k++) { const a = i * 5 + k; const b = i * 5 + ((k + 1) % 5); idx.push(a, b, a + 5, b, b + 5, a + 5); }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    case 'plume': { // plumeau de feuilles lancéolées au sommet d'un chaume
      const o = newOut(); const n = lo ? 7 : 11;
      for (let k = 0; k < n; k++) {
        const th = 0.45 + 0.8 * frac(k + 1, 31); const az = k * 2.399; const L = 0.8 + 0.4 * frac(k, 17);
        leafInto(o, { phi: az, segs: 4, path: (t) => [Math.sin(th) * L * t, Math.cos(th) * L * t - 0.45 * t * t * L * 0.5], wid: (t) => 0.07 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8 + 0.004 });
      }
      return finishLeaves(THREE, o);
    }
    case 'fountain': case 'upright': case 'fine': {
      const o = newOut(); const n = part === 'fine' ? (lo ? 22 : 36) : (lo ? 14 : 22);
      for (let k = 0; k < n; k++) {
        const az = k * 2.399; const f1 = frac(k + 3, 29); const f2 = frac(k + 7, 41);
        let reach; let hgt; let w0;
        if (part === 'fountain') { reach = 0.45 + 0.55 * f1; hgt = 0.7 + 0.3 * f2; w0 = 0.05; }
        else if (part === 'upright') { reach = 0.08 + 0.2 * f1; hgt = 0.82 + 0.18 * f2; w0 = 0.045; }
        else { reach = 0.2 + 0.7 * f1; hgt = 0.5 + 0.5 * f2; w0 = 0.02; }
        const bend = part === 'upright' ? 0.3 : 1;
        leafInto(o, { phi: az, segs: 5, path: (t) => [reach * (t * 0.15 + 0.85 * t * t * bend), hgt * (1 - 0.55 * t * t * bend) * t + (1 - t) * 0], wid: (t) => w0 * (1 - t) ** 0.7 + 0.002, ox: Math.cos(az) * 0.04, oz: Math.sin(az) * 0.04 });
      }
      return finishLeaves(THREE, o);
    }
    case 'frond': { // fronde pennée (fougère, palme) : arc effilé aux bords dentelés
      const o = newOut(); const segs = lo ? 8 : 14;
      leafInto(o, { phi: 0, segs, cup: 0, path: (t) => { const [x, y] = arcPt(t); return [x, y]; }, wid: (t) => (0.2 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7 + 0.01) * (Math.round(t * segs) % 2 ? 0.55 : 1) });
      return finishLeaves(THREE, o);
    }
    case 'leaf': { // grande feuille large en coupe (hosta) : base à l'origine, retombe vers l'extérieur
      const o = newOut();
      leafInto(o, { phi: 0, segs: 6, cup: 0.12, path: (t) => [t, 0.4 * t * (1 - 0.95 * t)], wid: (t) => 0.95 * Math.sin(Math.PI * Math.min(1, t ** 0.8)) ** 0.9 + 0.02 });
      return finishLeaves(THREE, o);
    }
    case 'pad': { // feuille flottante : disque échancré
      const g = new THREE.CircleGeometry(1, 12, 0.35, Math.PI * 2 - 0.5); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position; const col = new Float32Array(p.count * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); void p;
      return g;
    }
    case 'curtain': { // rideau retombant : cloche ouverte aux franges irrégulières
      const A = 28; const RN = 5; const pos = []; const col = []; const idx = [];
      for (let j = 0; j <= RN; j++) {
        const y = j / RN;
        for (let i = 0; i < A; i++) {
          const a = (i / A) * Math.PI * 2; const rr = (0.5 + 0.5 * (1 - y) ** 0.8) * (1 + 0.1 * Math.sin(a * 9 + j) + 0.06 * Math.sin(a * 17));
          const yy = j === 0 ? y + 0.06 * (0.5 + 0.5 * Math.sin(a * 11) + 0.4 * Math.sin(a * 5 + 1)) : y;
          pos.push(Math.cos(a) * rr, yy, Math.sin(a) * rr); const v = 0.7 + 0.4 * yy; col.push(v, v, v);
        }
      }
      for (let j = 0; j < RN; j++) for (let i = 0; i < A; i++) { const a = j * A + i; const b = j * A + ((i + 1) % A); idx.push(a, b, a + A, b, b + A, a + A); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    case 'hedgebox': { // volume taillé : pavé aux arêtes arrondies, face feuillue légèrement bosselée (x : longueur, y : 0→1, z : épaisseur)
      const n = lo ? 3 : 5; const g = new THREE.BoxGeometry(1, 1, 1, n, n, n); g.translate(0, 0.5, 0);
      const p = g.attributes.position; const rr = 0.12;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i); const y = p.getY(i) - 0.5; const z = p.getZ(i);
        const ix = Math.max(-0.5 + rr, Math.min(0.5 - rr, x)); const iy = Math.max(-0.5 + rr, Math.min(0.5 - rr, y)); const iz = Math.max(-0.5 + rr, Math.min(0.5 - rr, z));
        const dx = x - ix; const dy = y - iy; const dz = z - iz; const dl = Math.hypot(dx, dy, dz);
        const bump = 1 + 0.025 * Math.sin(x * 23 + z * 17 + y * 13);
        if (dl > 1e-6) p.setXYZ(i, ix + (dx / dl) * rr * bump, iy + (dy / dl) * rr * bump + 0.5, iz + (dz / dl) * rr * bump); else p.setY(i, y + 0.5);
      }
      g.computeVertexNormals();
      const q = g.attributes.position; const col = new Float32Array(q.count * 3);
      for (let i = 0; i < q.count; i++) { const v = 0.7 + 0.38 * q.getY(i); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    }
    default: return null;
  }
}
export { portGeometry };
