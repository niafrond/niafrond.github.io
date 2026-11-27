// Étiquettes des plantes pour les vues 3D (temps réel) et isométriques (SVG) : regroupement + désencombrement (pur, sans DOM).
// Principe : JAMAIS une étiquette par plant. Un massif de 12 lavandes = UNE étiquette ; une haie = UNE étiquette ;
// les arbres ne sont individuels que s'il y en a 3 au plus de la même essence dans le jardin.
// Repère des ancres : celui de la scène 3D (x = plan x, y = haut, z = plan y), en mètres.
import { placePlants, heightFactor, spotsAlong } from './gl-worker-core.js';
import { habitOf } from './habits.js';
import { existingForRender, getExistingKind } from './existing.js';
import { bloomRangeText, formatEuro } from './pricing.js';
import { formatHeight } from './heights.js';

const FOLIAGE_DEFAULT = { tree: '#4f8f3a', fruit: '#5c9a3e', shrub: '#5a9a45', hedge: '#3f8f4a', climber: '#4f9a4a', perennial: '#6aa84a', groundcover: '#7ab356', grass: '#9ab45a', bulb: '#6aa84a', aquatic: '#4f9a6a', vegetable: '#6fae48', lawn: '#6aa84a' };

/** Distance (m) sous laquelle deux groupes de la même essence fusionnent. */
export const MERGE_DISTANCE = 2;
/** Nombre maximal d'arbres d'une même essence qui gardent chacun leur étiquette. */
export const MAX_INDIVIDUAL_TREES = 3;
/** Hauteur minimale (m) de l'ancre : une plante basse ou jeune garde une étiquette lisible, juste au-dessus du sol. */
export const MIN_ANCHOR_H = 0.3;
/** Marge (m) entre le sommet de la plante et l'ancre. */
export const ANCHOR_MARGIN = 0.15;

const dormancy = (m) => ([12, 1, 2].includes(m) ? 0.22 : [3, 11].includes(m) ? 0.6 : 1);
const lookupOf = (plantsById) => (id) => {
  if (!plantsById) return null;
  if (typeof plantsById === 'function') return plantsById(id) || null;
  if (plantsById instanceof Map) return plantsById.get(id) || null;
  return plantsById[id] || null;
};
const isTreeHabit = (id) => /^tree-/.test(id) || id === 'palm';
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Comportement saisonnier : 'woody' (ligneux), 'herb' (caduque : repos hivernal), 'semi', 'none'. */
function seasonKindOf(plant, habit) {
  if (!plant) return 'none';
  const c = plant.category;
  if (['tree', 'fruit', 'shrub', 'hedge', 'climber'].includes(c) || habit === 'bamboo' || /^(tree|shrub|hedge)/.test(habit)) return 'woody';
  if (c === 'lawn') return 'none';
  if (plant.foliage === 'deciduous') return 'herb';
  if (plant.foliage === 'semi') return 'semi';
  return 'none';
}

/** Longueur d'une polyligne et point à mi-longueur. */
function polyMid(points) {
  let L = 0;
  for (let i = 0; i < points.length - 1; i++) L += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  let half = L / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (half <= d && d > 0) { const t = half / d; return { x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t, length: L }; }
    half -= d;
  }
  return { x: points[0].x, y: points[0].y, length: L };
}

/** Entrées « existant » à étiqueter (mêmes critères que le rendu 3D : ni clôture ni mur). */
function existingEntries(garden, override) {
  let list = [];
  if (Array.isArray(override)) list = override;
  else { try { list = existingForRender(garden) || []; } catch (e) { list = []; } }
  return list.filter((e) => e && !['fence', 'wall'].includes(e.kind) && (e.plant || e.habit || ['tree', 'shrub', 'hedge'].includes(e.kind)) && (Number.isFinite(e.x) || (e.points && e.points.length >= 2)));
}

/**
 * Hauteur affichée d'un groupe à un âge et un mois donnés, et ancre à la verticale du sommet.
 * Retourne une copie (les groupes passés ne sont pas modifiés) : sert à suivre « Pousse » et les saisons sans tout recalculer.
 */
export function applyGrowth(groups, { age = 1, month = null } = {}) {
  const hf = heightFactor(age);
  const d = Number.isFinite(month) ? dormancy(month) : 1;
  return groups.map((g) => {
    const season = g.seasonKind === 'herb' ? d : g.seasonKind === 'semi' ? 0.6 + 0.4 * d : 1;
    const heightM = Math.max(0.05, g.hAdult * (g.fixedH ? 1 : hf) * season);
    return { ...g, heightM, anchor: { x: g.anchor.x, y: Math.max(heightM, MIN_ANCHOR_H) + ANCHOR_MARGIN, z: g.anchor.z } };
  });
}

/**
 * Groupes d'étiquettes d'un jardin : un par couple (zone, essence) ; les plantes existantes ont les leurs.
 * @param {object} garden
 * @param {{plantsById?:Function|Map|object, age?:number, month?:number|null, existing?:object[]|null}} opts `age` 0 (jeune) → 1 (adulte)
 * @returns {{key:string, plantId:string|null, zoneId:string|null, name:string, latin:string, count:number, heightM:number, widthM:number,
 *   anchor:{x:number,y:number,z:number}, radius:number, priority:number, colors:{flower:string|null,foliage:string}, habit:string,
 *   source:'zone'|'existant', essence:string, renderIds:string[], zones:{id:string,label:string}[], bloom:number[], priceEur:number|null}[]}
 */
export function buildLabelGroups(garden, { plantsById, age = 1, month = null, existing = null } = {}) {
  const get = lookupOf(plantsById);
  const g = garden || {};
  const raw = [];
  const treeCount = new Map();
  const addTrees = (essence, n) => treeCount.set(essence, (treeCount.get(essence) || 0) + n);

  // ── zones plantées ──
  for (const zone of g.zones || []) {
    if (!zone || !zone.shape || !(zone.plantings || []).length) continue;
    let placed = [];
    try { placed = placePlants(g, zone, plantsById, { age }); } catch (e) { placed = []; }
    const byPlant = new Map();
    for (const p of placed) {
      if (!p.plant || p.plant.category === 'lawn') continue;
      let e = byPlant.get(p.plantId);
      if (!e) { e = { plant: p.plant, pts: [] }; byPlant.set(p.plantId, e); }
      e.pts.push({ x: p.x, y: p.y });
    }
    const declared = new Map();
    for (const pl of zone.plantings) declared.set(pl.plantId, (declared.get(pl.plantId) || 0) + Math.max(1, Math.round(num(pl.count ?? pl.quantity, 1))));
    const isLine = zone.shape.kind === 'line';
    for (const [pid, e] of byPlant) {
      const catalog = get(pid) || e.plant;
      const habit = habitOf(e.plant).id;
      const tree = isTreeHabit(habit);
      const count = declared.get(pid) || e.pts.length;
      if (tree) addTrees(pid, count);
      raw.push({
        source: 'zone', zoneId: zone.id, zoneLabel: zone.label || '', plant: e.plant, catalog, habit, tree, essence: pid, plantId: pid,
        name: e.plant.commonName || pid, latin: e.plant.latinName || '', pts: e.pts, count, hAdult: num(e.plant.heightAdult, 1), fixedH: false,
        width: num(e.plant.widthAdult, 1), line: isLine, renderId: pid, ghost: false,
      });
    }
  }

  // ── plantes existantes : une entrée = un élément (étiquette libre si espèce inconnue) ──
  existingEntries(g, existing).forEach((e, i) => {
    const plant = e.plant || null;
    const hid = (e.habit && (e.habit.id || e.habit)) || null;
    const habit = typeof hid === 'string' && habitOf({ habit: hid }).id === hid ? hid : (plant ? habitOf(plant).id : (e.kind === 'tree' ? 'tree-round' : e.kind === 'hedge' ? 'hedge-clipped' : 'shrub-round'));
    const tree = isTreeHabit(habit);
    const kd = getExistingKind(e.kind);
    const typed = typeof e.label === 'string' && e.label.trim() && !(plant && kd && e.label.trim() === kd.defaultLabel) ? e.label.trim() : '';
    const label = typed || (plant && plant.commonName) || (kd && kd.defaultLabel) || 'Plante existante';
    const essence = plant ? plant.id : `x:${label}`;
    if (tree) addTrees(essence, 1);
    let pts; let line = false;
    if (e.points && e.points.length >= 2) {
      const mid = polyMid(e.points);
      pts = [{ x: mid.x, y: mid.y }, ...spotsAlong(e.points, clamp(Math.ceil(mid.length), 2, 40))];
      line = true;
    } else pts = [{ x: e.x, y: e.y }];
    raw.push({
      source: 'existant', zoneId: null, zoneLabel: '', plant, catalog: plant, habit, tree, essence, plantId: plant ? plant.id : null,
      name: label, latin: plant ? (plant.latinName || '') : '', pts, count: 1,
      hAdult: num(e.height) > 0 ? num(e.height) : (plant ? num(plant.heightAdult, 3) : 3), fixedH: true,
      width: num(e.width) > 0 ? num(e.width) : (plant ? num(plant.widthAdult, 2) : 2), line, renderId: `_ex_${e.id ?? i}`, ghost: e.keep === false,
      entryId: e.id ?? i,
    });
  });

  // ── arbres : étiquettes individuelles seulement s'il y en a peu de la même essence ──
  const units = [];
  for (const r of raw) {
    if (r.tree && (treeCount.get(r.essence) || 0) <= MAX_INDIVIDUAL_TREES) {
      if (r.source === 'zone') r.pts.forEach((p, i) => units.push({ ...r, pts: [p], count: 1, individual: true, key: `z:${r.zoneId}:${r.plantId}:${i}`, members: [r] }));
      else units.push({ ...r, individual: true, key: `x:${r.entryId}`, members: [r] });
    } else units.push({ ...r, individual: false, key: r.source === 'zone' ? `z:${r.zoneId}:${r.plantId}` : `x:${r.entryId}`, members: [r] });
  }

  // ── fusion : même essence, même origine, moins de 2 m d'écart (hors arbres individuels) ──
  const parent = units.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const near = (a, b) => {
    const A = a.pts; const B = b.pts;
    const ax0 = Math.min(...A.map((p) => p.x)); const ax1 = Math.max(...A.map((p) => p.x)); const ay0 = Math.min(...A.map((p) => p.y)); const ay1 = Math.max(...A.map((p) => p.y));
    const bx0 = Math.min(...B.map((p) => p.x)); const bx1 = Math.max(...B.map((p) => p.x)); const by0 = Math.min(...B.map((p) => p.y)); const by1 = Math.max(...B.map((p) => p.y));
    if (ax0 - bx1 > MERGE_DISTANCE || bx0 - ax1 > MERGE_DISTANCE || ay0 - by1 > MERGE_DISTANCE || by0 - ay1 > MERGE_DISTANCE) return false;
    for (const p of A) for (const q of B) if (Math.hypot(p.x - q.x, p.y - q.y) < MERGE_DISTANCE) return true;
    return false;
  };
  for (let i = 0; i < units.length; i++) {
    if (units[i].individual) continue;
    for (let j = i + 1; j < units.length; j++) {
      if (units[j].individual || units[i].essence !== units[j].essence || units[i].source !== units[j].source) continue;
      if (find(i) !== find(j) && near(units[i], units[j])) parent[find(j)] = find(i);
    }
  }
  const clusters = new Map();
  units.forEach((u, i) => { const r = find(i); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r).push(u); });

  const out = [];
  for (const members of clusters.values()) {
    members.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const first = members[0];
    const pts = members.flatMap((m) => m.pts);
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length; const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    // ligne (haie) : on reste SUR la ligne (point le plus proche du centroïde) ; massif ou touffe : centre exact
    let ax = cx; let ay = cy;
    if (members.every((m) => m.line)) {
      let best = Infinity;
      for (const p of pts) { const d = Math.hypot(p.x - cx, p.y - cy); if (d < best) { best = d; ax = p.x; ay = p.y; } }
    }
    const width = Math.max(...members.map((m) => m.width));
    const radius = Math.max(0.3, Math.max(...pts.map((p) => Math.hypot(p.x - ax, p.y - ay))) + width / 2);
    const hAdult = Math.max(...members.map((m) => m.hAdult));
    const count = members.reduce((s, m) => s + m.count, 0);
    const zoneIds = [...new Set(members.map((m) => m.zoneId).filter((z) => z != null))];
    const plant = first.catalog || first.plant;
    const colors = {
      flower: (plant && plant.flowerColor) || null,
      foliage: (plant && plant.foliageColor) || (plant && FOLIAGE_DEFAULT[plant.category]) || '#5a9a45',
    };
    const isLineGroup = members.every((m) => m.line);
    const footprint = isLineGroup ? 2 * radius * Math.max(width, 1) : Math.PI * radius * radius;
    const priority = hAdult * footprint + (first.tree ? 12 : 0) + (first.source === 'existant' ? 6 : 0) + Math.min(count, 40) * 0.1;
    const key = members.length > 1 ? `m:${first.essence}:${first.key}` : first.key;
    out.push({
      key, plantId: first.plantId, zoneId: zoneIds.length === 1 ? zoneIds[0] : null, name: first.name, latin: first.latin, count,
      heightM: hAdult, widthM: width, anchor: { x: ax, y: hAdult + ANCHOR_MARGIN, z: ay }, radius, priority, colors, habit: first.habit,
      source: first.source, essence: first.essence, renderIds: [...new Set(members.map((m) => m.renderId))],
      zones: zoneIds.map((id) => ({ id, label: (members.find((m) => m.zoneId === id) || {}).zoneLabel || '' })),
      bloom: (plant && Array.isArray(plant.bloom)) ? plant.bloom.slice() : [],
      priceEur: plant && typeof plant.priceEur === 'number' && Number.isFinite(plant.priceEur) ? plant.priceEur : null,
      priceUnit: (plant && plant.priceUnit) || 'plant',
      photo: { id: String(first.plantId || first.essence), commonName: first.name, latinName: first.latin, wiki: (plant && plant.wiki) || undefined },
      individual: !!first.individual, tree: !!first.tree, ghost: members.every((m) => m.ghost),
      hAdult, fixedH: members.every((m) => m.fixedH), seasonKind: seasonKindOf(plant, first.habit),
    });
  }
  out.sort((a, b) => b.priority - a.priority || (a.key < b.key ? -1 : 1));
  return applyGrowth(out, { age, month });
}

/** Ids des maillages (rendu 3D) à mettre en évidence pour une essence : tous ses groupes (zones et existants). */
export function renderIdsOfEssence(groups, essence) {
  const ids = new Set();
  for (const g of groups) if (g.essence === essence) for (const id of g.renderIds) ids.add(id);
  return ids;
}

/** Lignes de la fiche d'un groupe : [{label, value}] (français). */
export function ficheRows(g) {
  const rows = [];
  if (g.source === 'existant') rows.push({ label: 'Origine', value: g.ghost ? 'Plante existante (à retirer)' : 'Plante existante' });
  else rows.push({ label: 'Quantité', value: `${g.count} plant${g.count > 1 ? 's' : ''}` });
  rows.push({ label: 'Hauteur', value: `${formatHeight(g.hAdult)} à maturité` });
  const bl = bloomRangeText(g.bloom || []);
  if (bl) rows.push({ label: 'Floraison', value: bl.replace(/^floraison /, '') });
  if (g.priceEur != null && g.source !== 'existant') {
    const unit = g.priceUnit === 'm2' ? 'le m²' : g.priceUnit === 'bulb' ? 'le bulbe' : 'le plant';
    rows.push({ label: 'Prix', value: `${formatEuro(g.priceEur)} ${unit}${g.priceUnit !== 'm2' && g.count > 1 ? ` (≈ ${formatEuro(g.priceEur * g.count, { digits: 0 })})` : ''}` });
  }
  const zl = (g.zones || []).map((z) => z.label).filter(Boolean);
  if (zl.length) rows.push({ label: zl.length > 1 ? 'Zones' : 'Zone', value: zl.join(', ') });
  return rows;
}

// ───────────────────────── désencombrement en espace écran ─────────────────────────
/** Dimensions des pastilles (px) : hauteur d'une ligne, de deux lignes, marges. */
export const LABEL = { h1: 24, h2: 38, padX: 9, dot: 24, maxW: 200, gap: 10, fontPx: 12, latinPx: 10.5 };
/** Plafonds par défaut. */
export const MAX_LABELS = { desktop: 14, mobile: 8, dense: 5 };
const HYST = 2.5;
const DENSE_AREA_PER_CANDIDATE = 12000;
const FAR_RATIO = 3;

/** Largeur de texte estimée (px) quand aucune mesure réelle n'est fournie. */
export const estimateWidth = (text, { size = 12, italic = false } = {}) => String(text || '').length * size * (italic ? 0.54 : 0.6) + 2;

const overlaps = (a, b, pad) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

function normalizeProjected(projected) {
  if (projected instanceof Map) return projected;
  const m = new Map();
  if (Array.isArray(projected)) { for (const p of projected) if (p && p.key != null) m.set(p.key, p); }
  else if (projected && typeof projected === 'object') { for (const k of Object.keys(projected)) m.set(k, projected[k]); }
  return m;
}

/**
 * Désencombrement glouton en espace écran : par priorité décroissante, une pastille par groupe, refusée si elle chevauche
 * (marge ≥ `pad` px) une pastille déjà acceptée ou une zone interdite, sort de l'écran ou si le groupe est derrière la caméra ;
 * plafond `maxLabels`. Une pastille déjà affichée à l'image précédente (`previous`) garde sa place et passe en premier (hystérésis).
 * @param {object[]} groups  groupes de `buildLabelGroups` (hauteurs déjà appliquées)
 * @param {Map|Object|Array} projected  par clé de groupe : {x, y} ancre en px d'écran, `behind` (derrière la caméra) ou `visible:false`
 * @param {{viewport?:{x?:number,y?:number,width:number,height:number}, maxLabels?:number, mobile?:boolean, dense?:boolean, pad?:number, edge?:number,
 *   measure?:Function, previous?:Array|Map, safe?:{x:number,y:number,w:number,h:number}[], latin?:boolean, distance?:number|null}} o
 *   `distance` : distance caméra / rayon de la scène (loin > 3 : plafond divisé par deux, donc seulement les plus grosses ; près : tout ce qui tient).
 * @returns {{key:string, group:object, ax:number, ay:number, rect:{x:number,y:number,w:number,h:number}, lines:1|2, latin:boolean, slot:number}[]}
 */
export function declutter(groups, projected, o = {}) {
  const vp = { x: 0, y: 0, width: 1280, height: 800, ...(o.viewport || {}) };
  const pad = Math.max(4, Number.isFinite(o.pad) ? o.pad : 4);
  const edge = Number.isFinite(o.edge) ? o.edge : 6;
  const measure = typeof o.measure === 'function' ? o.measure : estimateWidth;
  const safe = Array.isArray(o.safe) ? o.safe : [];
  const P = normalizeProjected(projected);
  const prev = new Map();
  if (o.previous instanceof Map) for (const [k, v] of o.previous) prev.set(k, typeof v === 'number' ? v : (v && v.slot) || 0);
  else if (Array.isArray(o.previous)) for (const r of o.previous) if (r) prev.set(r.key, r.slot || 0);

  const x0 = vp.x + edge; const x1 = vp.x + vp.width - edge; const y0 = vp.y + edge; const y1 = vp.y + vp.height - edge;
  const cands = [];
  for (const g of groups || []) {
    const p = P.get(g.key);
    if (!p || p.behind || p.visible === false || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    cands.push({ g, p });
  }
  const far = Number.isFinite(o.distance) && o.distance > FAR_RATIO;
  const dense = o.dense != null ? !!o.dense : cands.length * DENSE_AREA_PER_CANDIDATE > vp.width * vp.height;
  let cap = Number.isFinite(o.maxLabels) ? o.maxLabels : (o.mobile ? MAX_LABELS.mobile : MAX_LABELS.desktop);
  if (dense && o.maxLabels == null) cap = Math.min(cap, MAX_LABELS.dense);
  if (far) cap = Math.max(3, Math.ceil(cap * 0.5));
  let pool = cands;
  pool = pool.map((c) => ({ ...c, score: c.g.priority * (prev.has(c.g.key) ? HYST : 1) }));
  pool.sort((a, b) => b.score - a.score || (a.g.key < b.g.key ? -1 : 1));

  const accepted = [];
  const out = [];
  const wantLatin = !!o.latin && !far;
  for (const { g, p } of pool) {
    if (out.length >= cap) break;
    const tryLines = wantLatin && g.latin ? [2, 1] : [1];
    let placed = null;
    for (const lines of tryLines) {
      const h = lines === 2 ? LABEL.h2 : LABEL.h1;
      const tw = Math.max(measure(g.name, { size: LABEL.fontPx, bold: true }), lines === 2 ? measure(g.latin, { size: LABEL.latinPx, italic: true }) : 0);
      const w = Math.min(LABEL.maxW, Math.ceil(tw + LABEL.padX * 2 + LABEL.dot));
      const slotsY = [p.y - LABEL.gap - h, p.y - LABEL.gap - 2 * h - pad, p.y + LABEL.gap, p.y + LABEL.gap + h + pad];
      const order = [0, 1, 2, 3];
      if (prev.has(g.key)) { const s = prev.get(g.key); order.splice(order.indexOf(s), 1); order.unshift(s); }
      for (const s of order) {
        const rect = { x: clamp(p.x - w / 2, x0, Math.max(x0, x1 - w)), y: slotsY[s], w, h };
        if (rect.y < y0 || rect.y + h > y1) continue;
        if (safe.some((r) => overlaps(rect, r, pad))) continue;
        if (accepted.some((r) => overlaps(rect, r, pad))) continue;
        placed = { key: g.key, group: g, ax: p.x, ay: p.y, rect, lines, latin: lines === 2, slot: s };
        break;
      }
      if (placed) break;
    }
    if (placed) { accepted.push(placed.rect); out.push(placed); }
  }
  return out;
}

/** Part du rayon réel du houppier / de la touffe prise en compte pour masquer (les bords clairsemés ne cachent pas). */
export const OCCLUDE_RADIUS_RATIO = 0.8;

/**
 * Clés des groupes dont l'ancre est cachée, depuis la caméra, par un autre groupe de plantes (arbre, haie, massif) :
 * chaque groupe est approché par un cylindre vertical (centre = ancre en x/z, rayon × 0,8, de 0 à sa hauteur) ;
 * l'ancre est cachée si le segment caméra → ancre traverse un tel cylindre avant d'arriver.
 * @param {object[]} groups  groupes de `buildLabelGroups` (hauteurs appliquées)
 * @param {{x:number,y:number,z:number}} cam  position de la caméra (y = hauteur)
 * @param {{keep?:string|null}} [o]  `keep` : clé jamais masquée (groupe sélectionné)
 * @returns {Set<string>}
 */
export function occludedKeys(groups, cam, o = {}) {
  const out = new Set();
  if (!cam || ![cam.x, cam.y, cam.z].every(Number.isFinite)) return out;
  const gs = (groups || []).filter((g) => g && g.anchor && Number.isFinite(g.radius) && Number.isFinite(g.heightM));
  for (const a of gs) {
    if (o.keep && a.key === o.keep) continue;
    const dx = a.anchor.x - cam.x; const dz = a.anchor.z - cam.z; const dy = a.anchor.y - cam.y;
    const A = dx * dx + dz * dz;
    for (const b of gs) {
      if (b === a) continue;
      const r = Math.max(0.05, b.radius * OCCLUDE_RADIUS_RATIO);
      const fx = cam.x - b.anchor.x; const fz = cam.z - b.anchor.z;
      let t0; let t1;
      if (A < 1e-9) { if (fx * fx + fz * fz > r * r) continue; t0 = 0; t1 = 1; } else {
        const B = 2 * (fx * dx + fz * dz); const C = fx * fx + fz * fz - r * r;
        const disc = B * B - 4 * A * C;
        if (disc <= 0) continue;
        const s = Math.sqrt(disc); t0 = (-B - s) / (2 * A); t1 = (-B + s) / (2 * A);
      }
      t0 = Math.max(0, t0); t1 = Math.min(0.98, t1); // devant l'ancre uniquement
      if (t0 >= t1) continue;
      const y0 = cam.y + dy * t0; const y1 = cam.y + dy * t1;
      if (Math.min(y0, y1) < b.heightM) { out.add(a.key); break; }
    }
  }
  return out;
}
