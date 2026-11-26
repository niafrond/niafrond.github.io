// Contenu du PDF du jardin : couverture, plans en niveaux cumulatifs (terrain et mobilier → zones → plantations), plan complet à
// calques PDF (OCG), fiches par zone, conseils de plantation, calendrier, entretien, arrosage, protection hivernale, listes de courses,
// vues isométriques, hypothèses. Tout est calculé ici (hors ligne) ; la rastérisation SVG → image et les photos sont INJECTÉES
// (`env.rasterize`, `env.photo`) pour rester testable sous Node. Le texte est du vrai texte PDF (polices standards, WinAnsi).
import { PdfDocument, A4, A4_LANDSCAPE, A3_LANDSCAPE, textWidth, wrapText, pdfSafeText } from './pdf-writer.js';
import { Flow, COLORS, drawBadge, drawCheckbox, drawSwatch } from './pdf-layout.js';
import { renderPlanSVG } from './render.js';
import { renderContactSheet } from './render3d.js';
import { elementAnchors } from './render-items.js';
import { getPlant, allPlants } from './catalog.js';
import { getZoneType, CATEGORY_LABELS, SUN_LABELS, SOIL_LABELS, WATER_LABELS, ORIENTATIONS, isAbovePool } from './model.js';
import { shapeArea, polygonArea, perimeter, bounds, distance } from './geometry.js';
import { gardenCost, formatEuro, formatPrice } from './pricing.js';
import { buildAdvice, calendar, frostProtection } from './advice.js';
import { hydrozones, monthlySchedule } from './watering.js';
import { climateForDepartement, adjustTminForAltitude, hardinessZone } from './climate.js';
import { zoneSunLevel } from './sun.js';
import { levelForZone, getMaintenanceLevel, plantEffort, effortLabel } from './maintenance.js';
import { getAmbiance } from './ambiances.js';
import { effectivePlant, plantingHeight, zoneHeight, itemHeight, obstacleHeight, formatHeight } from './heights.js';
import { getItemKind, getOpeningKind, getEdgeKind, boundarySides, edgeKindOf, edgeHeightOf, materialOf, MATERIALS, openingGeometry } from './items.js';
import { getExistingKind, existingLabel, getFenceMaterial } from './existing.js';
import { MONTHS, MONTHS_SHORT, OBSTACLE_LABELS, monthLabel } from './render-common.js';
import { shoppingList, shoppingByPeriod, suppliesList, itemsToBuy, monthsText, SHOPPING_NOTE, LOSS_MARGIN, SUPPLY } from './shopping.js';

export const PDF_DEFAULTS = { format: 'a4', levels: { 1: true, 2: true, 3: true }, zonePages: true, advice: true, shopping: true, photos: true, iso: false, layers: true, month: null };

const fr = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '—');
const frM = (n) => `${fr(n, 2)} m`;
const area = (n) => `${fr(n, n >= 100 ? 0 : 1)} m²`;
const euro = (n) => formatEuro(n, { digits: n >= 100 ? 0 : 2 });
const CAT_ORDER = ['tree', 'fruit', 'hedge', 'shrub', 'climber', 'perennial', 'grass', 'bulb', 'groundcover', 'vegetable', 'aquatic', 'lawn'];
const STAGE = { tree: 1, fruit: 1, shrub: 2, hedge: 2, climber: 2, perennial: 3, bulb: 3, aquatic: 3, vegetable: 3, groundcover: 4, grass: 5, lawn: 5 };
const STAGE_LABEL = { 0: 'Gros œuvre (terrasse, allées, mare, clôtures, mobilier)', 1: 'Arbres et fruitiers', 2: 'Arbustes, haies et grimpantes', 3: 'Vivaces, bulbes, aquatiques et potager', 4: 'Couvre-sols', 5: 'Gazon et graminées' };
const lookupFn = (l) => (typeof l === 'function' ? l : getPlant);
const tick = () => new Promise((r) => setTimeout(r));
const nom = (p) => p.commonName || p.id;

export class PdfAbort extends Error { constructor() { super('Génération annulée'); this.name = 'AbortError'; } }

/** Numérotation des essences : ordre par catégorie puis nom. → {list:[{n, plant, qty, zoneIds}], map: Map(plantId → n)} */
export function speciesNumbering(garden, lookup = getPlant) {
  const by = new Map();
  for (const z of garden.zones || []) {
    for (const pl of z.plantings || []) {
      const plant = lookup(pl.plantId);
      if (!plant) continue;
      let s = by.get(plant.id);
      if (!s) { s = { plant, qty: 0, zoneIds: [] }; by.set(plant.id, s); }
      s.qty += Math.max(1, Math.round(Number(pl.count) || 1));
      if (!s.zoneIds.includes(z.id)) s.zoneIds.push(z.id);
    }
  }
  const list = [...by.values()].sort((a, b) => CAT_ORDER.indexOf(a.plant.category) - CAT_ORDER.indexOf(b.plant.category) || nom(a.plant).localeCompare(nom(b.plant), 'fr'));
  list.forEach((s, i) => { s.n = i + 1; });
  return { list, map: new Map(list.map((s) => [s.plant.id, s.n])) };
}

/** Éléments du niveau 1 (bâti, murs, clôtures, portes, plantes existantes, mobilier) numérotés : [{n, group, key, label, dims, height, material, price}]. */
export function buildElements(garden, lookup = getPlant) {
  const els = []; let n = 0;
  const add = (group, key, o) => els.push({ n: ++n, group, key, price: null, material: '', height: '—', ...o });
  const pathLen = (pts) => { let s = 0; for (let i = 0; i < pts.length - 1; i++) s += distance(pts[i], pts[i + 1]); return s; };
  const G1 = 'Bâti, murs et clôtures'; const G2 = 'Portes et portails'; const G3 = 'Plantes et clôtures existantes'; const G4 = 'Mobilier, équipements et structures';
  for (const o of garden.obstacles || []) {
    if (o.kind === 'tree' || !o.points || o.points.length < 2) continue;
    const closed = o.kind === 'house' || o.kind === 'shed';
    let dims;
    if (closed && o.points.length >= 3) { const b = bounds(o.points); dims = `${fr(b.width, 1)} × ${fr(b.height, 1)} m (${area(polygonArea(o.points))})`; } else dims = `${fr(pathLen(o.points), 1)} m de long`;
    add(G1, `obstacle:${o.id}`, { label: OBSTACLE_LABELS[o.kind] || 'Obstacle', dims, height: formatHeight(obstacleHeight(o)) });
  }
  for (const s of boundarySides(garden)) {
    const kind = edgeKindOf(garden, s.i);
    if (kind === 'open') continue;
    const mat = materialOf(kind, garden.boundaryEdges[s.i] && garden.boundaryEdges[s.i].material);
    add(G1, `edge:${s.i}`, { label: `${getEdgeKind(kind).label} du terrain, côté ${s.i + 1}`, dims: `${fr(distance(s.a, s.b), 1)} m de long`, height: formatHeight(edgeHeightOf(garden, s.i)), material: mat ? MATERIALS[mat].label : '' });
  }
  for (const op of garden.openings || []) {
    const k = getOpeningKind(op.kind); const g = k && openingGeometry(garden, op);
    if (g) add(G2, `opening:${op.id}`, { label: k.label, dims: `${fr(g.width, 2)} m de large`, height: '—' });
  }
  for (const e of garden.existing || []) {
    const k = getExistingKind(e.kind);
    if (!k) continue;
    const linear = Array.isArray(e.points) && e.points.length >= 2;
    const label = (e.kind === 'fence' && !(e.label && e.label !== 'Clôture existante') ? `Clôture ${getFenceMaterial(e.material).label.toLowerCase()}` : existingLabel(e, lookup)) + (e.keep === false ? ' (à retirer)' : '');
    add(G3, `existing:${e.id}`, { label, dims: linear ? `${fr(pathLen(e.points), 1)} m de long` : `Ø ${fr(e.width, 1)} m`, height: formatHeight(e.height), material: e.kind === 'fence' ? getFenceMaterial(e.material).label : '' });
  }
  for (const it of garden.items || []) {
    const k = getItemKind(it.kind);
    if (!k) continue;
    const r = Number.isFinite(it.radius) && it.radius > 0 ? it.radius : null;
    add(G4, `item:${it.id}`, { label: it.label || k.label, dims: r != null ? `Ø ${fr(r * 2, 2)} m` : `${fr(it.width || k.w, 2)} × ${fr(it.depth || k.d, 2)} m`, height: formatHeight(itemHeight(it)), price: k.priceEur || 0 });
  }
  return els;
}

const sunText = (g, z) => { try { const s = zoneSunLevel(g, z); return s && s.level ? SUN_LABELS[s.level].replace(/ \(.*\)/, '') : '—'; } catch { return '—'; } };

/** Données de la couverture et du résumé. */
export function gardenFacts(garden, lookup = getPlant, now = new Date()) {
  const c = garden.context || {};
  const clim = c.departement ? climateForDepartement(c.departement) : null;
  const tmin = clim && typeof clim.tminC === 'number' ? Math.round(adjustTminForAltitude(clim.tminC, c.altitude || 0)) : null;
  const cost = gardenCost(garden, lookup);
  const sp = speciesNumbering(garden, lookup);
  const amb = [...new Set((garden.zones || []).map((z) => z.ambiance).filter(Boolean))].map((id) => (getAmbiance(id) || {}).label).filter(Boolean);
  const boundary = garden.boundary || [];
  const lvl = getMaintenanceLevel(c.maintenance);
  return {
    name: garden.name || 'Mon jardin', now, region: c.region || (clim && clim.region) || '', departement: c.departement || '', commune: c.commune || '', altitude: c.altitude,
    tmin, usda: tmin != null ? hardinessZone(tmin) : null, northAngle: Number(c.northAngle) || 0,
    orientation: (ORIENTATIONS.find((o) => o.id === c.orientation) || {}).label || '',
    area: boundary.length >= 3 ? polygonArea(boundary) : 0, perimeter: boundary.length >= 2 ? perimeter(boundary, garden.boundaryClosed !== false && boundary.length >= 3) : 0,
    zones: (garden.zones || []).length, species: sp.list.length, plants: sp.list.filter((s) => s.plant.category !== 'lawn').reduce((a, s) => a + s.qty, 0),
    cost, maintenance: lvl ? lvl.label : '', ambiances: amb,
  };
}

const monthLetters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const DEPTH = {
  tree: 'trou de 60 × 60 × 60 cm', fruit: 'trou de 50 × 50 × 50 cm', shrub: 'trou 2 fois plus large que la motte', hedge: 'tranchée de 40 cm de large', climber: 'trou de 40 cm, à 30 cm du support',
  perennial: 'trou de la taille du pot, collet au sol', groundcover: 'trou de la taille du godet', grass: 'trou de la taille du pot', bulb: 'profondeur = 2 à 3 fois la hauteur du bulbe',
  aquatic: 'panier posé à la profondeur indiquée', vegetable: 'selon la culture (semis 1 à 2 cm)', lawn: 'semis en surface (1 cm), roulé',
};
const MULCH = { tree: 'Pailler sur 5 à 8 cm, sans toucher le tronc', fruit: 'Pailler sur 5 à 8 cm, sans toucher le tronc', shrub: 'Pailler sur 5 à 8 cm', hedge: 'Pailler tout le long du rang', climber: 'Pailler le pied', perennial: 'Pailler léger (3 à 5 cm)', groundcover: 'Pailler entre les plants jusqu’à la couverture', grass: 'Pailler léger', bulb: 'Paillage léger après plantation', aquatic: 'Aucun paillage', vegetable: 'Pailler entre les rangs', lawn: 'Aucun paillage' };
const RESUME = { tree: 'Arroser 30 L par semaine en été la 1re année', fruit: 'Arroser 30 L par semaine en été la 1re année', shrub: 'Arroser 15 à 20 L par semaine en été la 1re année', hedge: 'Arroser 10 à 15 L par plant et par semaine la 1re année', climber: 'Arroser 10 à 15 L par semaine la 1re année', perennial: 'Arroser 5 à 10 L par semaine jusqu’à la reprise', groundcover: 'Arroser 2 à 3 fois par semaine les 3 premières semaines', grass: 'Arroser 5 L par semaine jusqu’à la reprise', bulb: 'Un arrosage à la plantation, puis selon la pluie', aquatic: 'Maintenir le niveau d’eau', vegetable: 'Arroser régulièrement au pied', lawn: 'Arroser chaque jour en fin de journée 3 semaines' };
const STAKE = { tree: 'Tuteur + lien souple à retirer après 2 ou 3 ans', fruit: 'Tuteur + lien souple à retirer après 2 ou 3 ans', climber: 'Treillage, fils tendus ou pergola ; palisser les jeunes tiges', hedge: 'Cordeau pour aligner ; tuteurs si le vent est fort', shrub: 'Tuteur seulement si l’arbuste dépasse 2 m' };
const SOIL_PREP = {
  clay: 'Sol argileux : ameublir à la fourche-bêche, ajouter du sable grossier et du compost pour drainer.', limestone: 'Sol calcaire : ajouter du compost, éviter la terre de bruyère.',
  sandy: 'Sol sableux : enrichir de compost et de fumier décomposé pour retenir l’eau.', loam: 'Sol limoneux : ameublir sur 30 cm et ajouter du compost mûr.', humus: 'Sol humifère : ameublir simplement, peu d’apports nécessaires.',
};

const kindLabel = { plant: 'Planter', prune: 'Tailler / entretenir', fertilize: 'Fertiliser', water: 'Surveiller l’arrosage', harvest: 'Récolter', protect: 'Protéger du gel' };
const KINDS = Object.keys(kindLabel);

/** Génère le PDF. → {bytes:Uint8Array, pages:number, filename, facts, sections}. */
export async function buildGardenPdf(garden, options = {}, env = {}) {
  const opt = { ...PDF_DEFAULTS, ...options, levels: { ...PDF_DEFAULTS.levels, ...(options.levels || {}) } };
  const lookup = lookupFn(env.plantLookup);
  const now = env.now || new Date();
  const rast = env.rasterize;
  const progress = (label, i = 0, n = 1) => { if (env.onProgress) env.onProgress({ label, step: i, total: n }); };
  const check = async () => { if (env.signal && env.signal.aborted) throw new PdfAbort(); await tick(); };
  const month = opt.month ? Number(opt.month) : null;
  const facts = gardenFacts(garden, lookup, now);
  const zones = garden.zones || [];
  const zoneNums = new Map(zones.map((z, i) => [z.id, i + 1]));
  const zoneLabel = (z) => z.label || (getZoneType(z.type) || {}).label || 'Zone';
  const zLabelById = new Map(zones.map((z) => [z.id, zoneLabel(z)]));
  const sp = speciesNumbering(garden, lookup);
  const elements = buildElements(garden, lookup);
  const elNums = new Map(elements.map((e) => [e.key, e.n]));
  const advice = buildAdvice(garden);
  const cal = calendar(garden);
  const cost = facts.cost;
  const dateText = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const planSize = opt.format === 'a3' ? A3_LANDSCAPE : A4_LANDSCAPE;

  const doc = new PdfDocument({
    title: `Jardin « ${facts.name} » : plan et guide de plantation`, author: 'Jardin', subject: 'Plan du jardin, plantations, conseils et listes de courses',
    keywords: 'jardin, plan, plantation, conseils, calendrier, arrosage', date: now,
  });
  const cover = doc.addPage(A4);
  const toc = []; // {title, page, level, note}
  const section = (title, page, level = 0, note = '') => { doc.addOutline(title, page, level); toc.push({ title, page, level, note }); };
  const headerLeft = `${facts.name}`;
  const newFlow = (right) => { const f = new Flow(doc, { headerLeft, headerRight: right }); f.newPage(); return f; };

  const stepsTotal = 1 + [1, 2, 3].filter((l) => opt.levels[l]).length + (opt.layers ? 1 : 0) + (opt.zonePages ? zones.length : 0) + (opt.advice ? 6 : 0) + (opt.shopping ? 5 : 0) + (opt.iso ? 1 : 0) + 2;
  let step = 0; const prog = (label) => progress(label, ++step, stepsTotal);

  // --- photos (miniatures d'essences) ---
  const photoIds = new Map(); const credits = [];
  if (opt.photos && env.photo) {
    prog('Photos des essences…');
    const queue = [...sp.list];
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        if (env.signal && env.signal.aborted) return;
        const s = queue.shift();
        try {
          const ph = await env.photo(s.plant);
          if (ph && ph.data) { photoIds.set(s.plant.id, doc.addImage({ type: 'jpeg', data: ph.data, width: ph.width, height: ph.height })); credits.push({ plant: s.plant, page: ph.page || '' }); }
        } catch { /* repli : pastille de couleur */ }
        done++; progress(`Photos des essences… ${done}/${sp.list.length}`, step, stepsTotal);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    await check();
  }

  // --- pages de plan (paysage) ---
  const planBox = () => { const keyW = opt.format === 'a3' ? 250 : 180; const bx = 22; const by = 46; return { bx, by, bw: planSize.w - 44 - keyW - 12, bh: planSize.h - by - 34, keyX: planSize.w - 22 - keyW, keyW }; };
  const rasterPlan = async (svgOpts, box, type = 'jpeg', dpi = 200) => {
    const Wl = Math.round(box.bw / 0.72); const Hl = Math.round(box.bh / 0.72);
    const svg = renderPlanSVG(garden, { view: 'plan', age: 'adult', month, idPrefix: 'pdf', ...svgOpts, print: true, width: Wl, height: Hl, plantLookup: env.plantLookup, layers: { legend: false, cartouche: false, ...(svgOpts.layers || {}) } });
    const img = await rast(svg, { width: Wl, height: Hl, pxWidth: Math.round((box.bw / 72) * dpi), pxHeight: Math.round((box.bh / 72) * dpi), type, quality: 0.88 });
    return { svg, img };
  };
  const planHeader = (page, title, sub) => {
    page.text(title, 22, 26, { size: 15, font: 'bold', color: COLORS.dark });
    page.text(sub, 22, 39, { size: 8.5, color: COLORS.muted });
    page.text(headerLeft, planSize.w - 22, 26, { size: 8, color: COLORS.muted, align: 'right' });
    page.line(22, 43, planSize.w - 22, 43, { color: COLORS.accent, width: 1 });
  };
  const keyColumn = (page, box, title, rowsFn) => {
    page.rect(box.keyX, box.by, box.keyW, box.bh, { fill: '#fafcf8', stroke: COLORS.line, lineWidth: 0.6, radius: 4 });
    page.text(title, box.keyX + 8, box.by + 14, { size: 9.5, font: 'bold', color: COLORS.dark });
    rowsFn(page, box.keyX + 8, box.by + 28, box.keyW - 16, box.by + box.bh - 8);
  };
  let lastPlanImg = null;
  const planNote = (page, box, text) => { const lines = wrapText(text, box.keyW - 16, 7.5, 'italic'); let y = box.by + box.bh - 6 - lines.length * 9.5; for (const ln of lines) { page.text(ln, box.keyX + 8, y + 7, { size: 7.5, font: 'italic', color: COLORS.muted }); y += 9.5; } };
  const levelPages = {};

  async function levelPlan(level, title, sub, svgOpts, keyTitle, rowsFn, note) {
    prog(`Plan niveau ${level}/3…`);
    const page = doc.addPage(planSize); const box = planBox();
    planHeader(page, title, sub);
    const { img } = await rasterPlan(svgOpts, box);
    const id = doc.addImage(img);
    page.image(id, box.bx, box.by, box.bw, box.bh);
    page.rect(box.bx, box.by, box.bw, box.bh, { stroke: COLORS.line, lineWidth: 0.6 });
    keyColumn(page, box, keyTitle, rowsFn);
    planNote(page, box, note);
    lastPlanImg = { id, w: box.bw, h: box.bh };
    levelPages[level] = page;
    section(title, page, 0, sub);
    await check();
    return page;
  }

  // Niveau 1 : terrain et mobilier
  if (opt.levels[1]) {
    const p1 = await levelPlan(1, 'Niveau 1 : terrain et mobilier', 'Ce qui est déjà là et ce que vous aménagez : contour coté, bâti, murs, portes, plantes existantes, mobilier.',
      { layers: { zones: false, plants: false, zoneNames: false, dims: true, names: false }, numbering: { items: elNums } }, 'Repères numérotés',
      (page, x, y, w, yMax) => {
        let yy = y; let shown = 0;
        for (const e of elements) {
          if (yy + 13 > yMax - 30) break;
          drawBadge(page, e.n, x + 8, yy + 5, 'el');
          const t = wrapText(e.label, w - 24, 7.5)[0];
          page.text(t, x + 22, yy + 8, { size: 7.5 }); yy += 13; shown++;
        }
        if (shown < elements.length) page.text(`… et ${elements.length - shown} autre(s) : voir le tableau`, x, yy + 8, { size: 7.5, font: 'italic', color: COLORS.muted });
        if (!elements.length) page.text('Aucun élément placé.', x, yy + 8, { size: 8, font: 'italic', color: COLORS.muted });
      }, 'Cotes en mètres. Le nord est indiqué en haut à droite du plan, l’échelle en bas à gauche.');
    const f = newFlow('Niveau 1 : terrain et mobilier');
    f.h1('Niveau 1 : terrain et mobilier');
    f.p(`Terrain de ${area(facts.area)}, ${fr(facts.perimeter, 1)} m de périmètre. Les numéros noirs du plan renvoient à ce tableau (dimensions, hauteur, matériau, prix indicatif du mobilier).`, { gap: 6 });
    if (!elements.length) f.note('Aucun bâti, mur, clôture, porte, plante existante ni mobilier n’a été renseigné pour ce jardin.');
    else {
      const rows = []; let grp = null;
      for (const e of elements) {
        if (e.group !== grp) { rows.push({ group: e.group }); grp = e.group; }
        rows.push([{ badge: e.n, kind: 'el' }, e.label, e.dims, e.height, e.material || '—', { text: e.price != null ? formatPrice(e.price) : '—', align: 'right' }]);
      }
      const total = elements.reduce((s, e) => s + (e.price || 0), 0);
      if (total) rows.push({ total: ['', 'Total mobilier et structures', '', '', '', { text: euro(total), align: 'right' }] });
      f.table({ cols: [{ label: 'N°', w: 30, align: 'center' }, { label: 'Élément', w: 'flex' }, { label: 'Dimensions', w: 104 }, { label: 'Hauteur', w: 48 }, { label: 'Matériau', w: 58 }, { label: 'Prix indicatif', w: 58, align: 'right' }], rows });
    }
    void p1;
  }

  // Niveau 2 : zones
  const zoneRowsInfo = zones.map((z, i) => {
    const t = getZoneType(z.type) || {}; const zc = cost.byZone[i];
    const amb = getAmbiance(z.ambiance);
    const zh = zoneHeight(z);
    return { z, n: i + 1, t, label: zoneLabel(z), area: (() => { try { return shapeArea(z.shape) || 0; } catch { return 0; } })(), sun: sunText(garden, z), maint: (getMaintenanceLevel(levelForZone(garden, z)) || {}).label || '—', amb: amb ? amb.label : '—', zh, cost: zc ? zc.total : 0 };
  });
  if (opt.levels[2]) {
    await levelPlan(2, 'Niveau 2 : zones', 'Niveau 1 adouci + zones colorées avec leur nom et leur surface.',
      { ghost: ['terrain', 'existing', 'items'].filter((k) => k !== 'terrain'), layers: { plants: false, names: false, dims: false }, numbering: { zones: zoneNums }, zoneSub: (z) => { const r = zoneRowsInfo.find((q) => q.z === z); return r ? area(r.area) : ''; } }, 'Zones',
      (page, x, y, w, yMax) => {
        let yy = y;
        for (const r of zoneRowsInfo) {
          if (yy + 22 > yMax - 30) { page.text('… suite dans le tableau', x, yy + 8, { size: 7.5, font: 'italic', color: COLORS.muted }); break; }
          page.rect(x, yy, 10, 10, { fill: r.t.color || '#999999', stroke: '#333333', lineWidth: 0.5 });
          page.text(`Z${r.n}`, x + 15, yy + 8, { size: 7.5, font: 'bold' });
          const t = wrapText(r.label, w - 40, 7.5)[0];
          page.text(t, x + 32, yy + 8, { size: 7.5 });
          page.text(`${area(r.area)}${r.amb !== '—' ? ` · ${r.amb}` : ''}`, x + 32, yy + 17, { size: 6.5, color: COLORS.muted });
          yy += 22;
        }
      }, 'Le mobilier et les éléments existants du niveau 1 restent visibles, adoucis.');
    const f = newFlow('Niveau 2 : zones');
    f.h1('Niveau 2 : zones');
    f.p('Chaque zone du plan est repérée par « Z » et son numéro. Ensoleillement, entretien et ambiance guident le choix des essences.', { gap: 6 });
    if (!zones.length) f.note('Aucune zone n’a été dessinée pour ce jardin.');
    else {
      const rows = zoneRowsInfo.map((r) => [{ badge: `Z${r.n}`, kind: 'sp' }, { name: r.label }, r.t.label || r.z.type, { text: area(r.area), align: 'right' }, r.sun, r.maint, r.amb, r.zh > 0 ? (r.z.type === 'terrace' ? `surélévation ${formatHeight(r.zh)}` : `paroi ${formatHeight(r.zh)}`) : '—', { text: r.cost ? euro(r.cost) : '—', align: 'right' }]);
      rows.push({ total: ['', 'Total', '', { text: area(zoneRowsInfo.reduce((s, r) => s + r.area, 0)), align: 'right' }, '', '', '', '', { text: euro(cost.total), align: 'right' }] });
      f.table({ cols: [{ label: 'N°', w: 28, align: 'center' }, { label: 'Zone', w: 'flex' }, { label: 'Type', w: 66 }, { label: 'Surface', w: 40, align: 'right' }, { label: 'Soleil', w: 46 }, { label: 'Entretien', w: 50 }, { label: 'Ambiance', w: 54 }, { label: 'Hauteur', w: 52 }, { label: 'Budget', w: 44, align: 'right' }], rows, size: 7.5 });
    }
  }

  // Niveau 3 : plantations
  if (opt.levels[3]) {
    await levelPlan(3, 'Niveau 3 : plantations', 'Niveaux 1 et 2 adoucis + plantes (couleurs et ports réels, à l’âge adulte), numérotées par essence.',
      { ghost: ['existing', 'items', 'zones'], layers: { names: false, dims: false }, numbering: { species: sp.map, zones: zoneNums } }, 'Essences',
      (page, x, y, w, yMax) => {
        let yy = y;
        for (const s of sp.list) {
          if (yy + 14 > yMax - 30) { page.text('… suite dans le tableau', x, yy + 8, { size: 7.5, font: 'italic', color: COLORS.muted }); break; }
          drawBadge(page, s.n, x + 8, yy + 5, 'sp');
          drawSwatch(page, x + 28, yy + 5, 4.5, safeColor(s.plant.foliageColor, '#6aa04a'), safeColor(s.plant.flowerColor, null));
          page.text(wrapText(`${nom(s.plant)} ×${s.qty}`, w - 40, 7.5)[0], x + 37, yy + 8, { size: 7.5 });
          yy += 14;
        }
        if (!sp.list.length) page.text('Aucune essence choisie.', x, yy + 8, { size: 8, font: 'italic', color: COLORS.muted });
      }, month ? `Floraison représentée : ${monthLabel(month).toLowerCase()}.` : 'Floraison représentée : pleine floraison (toutes les couleurs).');
    const f = newFlow('Niveau 3 : plantations');
    f.h1('Niveau 3 : plantations');
    f.p('Légende des essences du plan : le numéro blanc d’une pastille est celui de l’essence dans les tableaux de zone, de conseils et de courses.', { gap: 6 });
    if (!sp.list.length) f.note('Aucune essence n’a encore été choisie : ajoutez des plantes aux zones pour obtenir cette légende.');
    else {
      const rows = sp.list.map((s) => [{ badge: s.n, kind: 'sp' }, { name: nom(s.plant), sub: s.plant.latinName || '' }, { chip: safeColor(s.plant.flowerColor, '#f3f3f0'), text: s.plant.flowerColor ? (monthsText(s.plant.bloom) || 'fleurs') : '—' }, { chip: safeColor(s.plant.foliageColor, '#6aa04a'), text: s.plant.foliage === 'evergreen' ? 'persistant' : s.plant.foliage === 'semi' ? 'semi-persistant' : 'caduc' }, { text: String(s.plant.category === 'lawn' ? '—' : s.qty), align: 'right' }, s.zoneIds.map((id) => `Z${zoneNums.get(id)}`).join(', ')]);
      f.table({ cols: [{ label: 'N°', w: 28, align: 'center' }, { label: 'Essence', w: 'flex' }, { label: 'Fleurs', w: 84 }, { label: 'Feuillage', w: 70 }, { label: 'Qté', w: 30, align: 'right' }, { label: 'Zones', w: 62 }], rows, size: 8 });
    }
  }

  // Plan complet à calques PDF (OCG)
  let layersPage = null;
  if (opt.layers) {
    prog('Plan complet à calques…');
    const page = doc.addPage(planSize); const box = planBox();
    planHeader(page, 'Plan complet à calques', 'Dans Acrobat, Foxit, Okular ou Chrome de bureau : panneau « Calques » pour afficher ou masquer chaque couche.');
    const defs = [
      ['Terrain et existant', { terrain: true, existing: true }], ['Mobilier', { items: true }], ['Zones', { zones: true, zoneNames: true }],
      ['Plantations', { plants: true, numbers: true }], ['Cotes', { dims: true }], ['Légende', { frame: true }],
    ];
    const none = { terrain: false, existing: false, items: false, zones: false, plants: false, zoneNames: false, numbers: false, dims: false, frame: false, names: false };
    // fond blanc non calque : cadre de la zone du plan
    page.rect(box.bx, box.by, box.bw, box.bh, { fill: '#ffffff', stroke: COLORS.line, lineWidth: 0.6 });
    for (const [name, on] of defs) {
      if (name === 'Légende') continue;
      const lid = doc.addLayer(name);
      const { img } = await rasterPlan({ bg: 'none', layers: { ...none, ...on, names: name === 'Mobilier' || name === 'Terrain et existant' }, numbering: name === 'Plantations' ? { species: sp.map } : null }, box, 'rgba', 130);
      page.image(doc.addImage(img), box.bx, box.by, box.bw, box.bh, { layer: lid });
      await check();
    }
    const { img: fimg } = await rasterPlan({ bg: 'none', layers: { ...none, frame: true } }, box, 'rgba', 130);
    const legL = doc.addLayer('Légende');
    page.image(doc.addImage(fimg), box.bx, box.by, box.bw, box.bh, { layer: legL });
    page.layer(legL, () => keyColumn(page, box, 'Légende des essences', (pg, x, y, w, yMax) => {
      let yy = y;
      for (const s of sp.list) {
        if (yy + 14 > yMax - 40) { pg.text('…', x, yy + 8, { size: 8 }); break; }
        drawBadge(pg, s.n, x + 8, yy + 5, 'sp'); drawSwatch(pg, x + 28, yy + 5, 4.5, safeColor(s.plant.foliageColor, '#6aa04a'), safeColor(s.plant.flowerColor, null));
        pg.text(wrapText(`${nom(s.plant)} ×${s.qty}`, w - 40, 7.5)[0], x + 37, yy + 8, { size: 7.5 }); yy += 14;
      }
    }));
    planNote(page, box, 'Beaucoup de lecteurs mobiles ignorent les calques : utilisez alors les pages « niveaux » cumulatives.');
    layersPage = page;
    section('Plan complet à calques', page, 0, 'calques PDF activables');
    await check();
  }

  // --- fiches par zone ---
  const bloomCell = (plant) => ({ cal: { months: plant.bloom || [], color: safeColor(plant.flowerColor, '#aaaaaa'), ref: month } });
  const zoneFirstPages = new Map();
  if (opt.zonePages) {
    let firstZone = true;
    for (let zi = 0; zi < zones.length; zi++) {
      const z = zones[zi]; const info = zoneRowsInfo[zi];
      prog(`Fiche de zone ${zi + 1}/${zones.length}…`);
      const f = newFlow(`Zone Z${info.n}`);
      zoneFirstPages.set(z.id, f.page);
      if (firstZone) section('Fiches par zone', f.page, 0, 'une page par zone');
      section(`Z${info.n} · ${info.label}`, f.page, 1, info.t.label || '');
      firstZone = false;
      drawBadge(f.page, `Z${info.n}`, f.x0 + 14, f.y + 9, 'sp');
      f.page.text(info.label, f.x0 + 34, f.y + 14, { size: 16, font: 'bold', color: COLORS.dark });
      f.y += 28;
      const bits = [info.t.label, area(info.area), `soleil : ${info.sun}`, `entretien : ${info.maint}`, info.amb !== '—' ? `ambiance : ${info.amb}` : null, info.zh > 0 ? (z.type === 'terrace' ? `surélévation ${formatHeight(info.zh)}` : `paroi ${formatHeight(info.zh)}`) : null, isAbovePool(z) ? 'piscine hors sol' : null].filter(Boolean);
      f.p(bits.join(' · '), { size: 8.5, color: COLORS.muted, gap: 6 });
      // gros plan
      const box = { bw: f.width, bh: 292 };
      const nPlants = (z.plantings || []).reduce((s, q) => s + Math.max(1, Math.round(q.count || 1)), 0);
      const Wl = Math.round(box.bw / 0.72); const Hl = Math.round(box.bh / 0.72);
      const svg = renderPlanSVG(garden, { view: 'plan', age: 'adult', month, idPrefix: 'pdf', ghost: ['existing', 'items'], crop: { zoneId: z.id, margin: 1.2 }, print: true, width: Wl, height: Hl, plantLookup: env.plantLookup, layers: { legend: false, cartouche: false, dims: false, names: false }, numbering: { species: sp.map, zones: zoneNums, every: nPlants <= 80 } });
      const img = await rast(svg, { width: Wl, height: Hl, pxWidth: Math.round((box.bw / 72) * 200), pxHeight: Math.round((box.bh / 72) * 200), type: 'jpeg', quality: 0.88 });
      f.ensure(box.bh + 6);
      f.page.image(doc.addImage(img), f.x0, f.y, box.bw, box.bh);
      f.page.rect(f.x0, f.y, box.bw, box.bh, { stroke: COLORS.line, lineWidth: 0.6 });
      f.y += box.bh + 8;
      const zc = cost.byZone[zi];
      const groups = new Map();
      for (const pl of z.plantings || []) { const plant = lookup(pl.plantId); if (!plant) continue; const g = groups.get(plant.id) || { plant, pl, qty: 0, plantings: [] }; g.qty += Math.max(1, Math.round(pl.count || 1)); g.plantings.push(pl); groups.set(plant.id, g); }
      if (!groups.size) f.note(`Aucune plantation dans cette zone (${info.t.label ? info.t.label.toLowerCase() : 'zone'}).`);
      else {
        const rows = [...groups.values()].sort((a, b) => sp.map.get(a.plant.id) - sp.map.get(b.plant.id)).map((g) => {
          const eff = effectivePlant(g.plant, g.pl); const hgt = plantingHeight(g.plant, g.pl);
          const line = zc && zc.lines.filter((l) => l.plantId === g.plant.id);
          const lt = line && line.length ? line.reduce((s, l) => s + l.total, 0) : null; const unit = line && line[0];
          const custom = Number(g.pl.height) > 0;
          const qtyText = unit && unit.unit === 'm2' ? area(unit.qty) : String(g.qty);
          return [{ badge: sp.map.get(g.plant.id), kind: 'sp' }, { thumb: photoIds.get(g.plant.id) || null, fo: safeColor(g.plant.foliageColor, '#6aa04a'), fl: safeColor(g.plant.flowerColor, null) }, { name: nom(g.plant), sub: g.plant.latinName || '' }, { text: qtyText, align: 'right' }, { text: `${hgt ? fr(hgt, hgt < 1 ? 2 : 1) + ' m' : '—'}${custom ? ' *' : ''}`, align: 'right' }, bloomCell(eff), effortLabel(plantEffort(g.plant)), { text: unit ? (unit.unit === 'm2' ? `${formatPrice(unit.unitPrice)}/m²` : formatPrice(unit.unitPrice)) : '—', align: 'right' }, { text: lt != null ? euro(lt) : '—', align: 'right' }];
        });
        rows.push({ total: ['', '', `Total de la zone Z${info.n}`, '', '', '', '', '', { text: euro(zc ? zc.total : 0), align: 'right' }] });
        f.table({ cols: [{ label: 'N°', w: 26, align: 'center' }, { label: '', w: 28, align: 'center' }, { label: 'Essence', w: 'flex' }, { label: 'Qté', w: 42, align: 'right' }, { label: 'Hauteur', w: 38, align: 'right' }, { label: 'Floraison', w: 92, sub: monthLetters, refMonth: month }, { label: 'Entretien', w: 40 }, { label: 'Prix unit.', w: 38, align: 'right' }, { label: 'Total', w: 40, align: 'right' }], rows, size: 7.5, minRowH: 26 });
        if ([...groups.values()].some((g) => Number(g.pl.height) > 0)) f.p('* hauteur adulte personnalisée pour ce jardin.', { size: 7.5, color: COLORS.muted });
      }
      const az = advice.zones[zi];
      if (z.notes && String(z.notes).trim()) { f.h3('Notes'); f.p(String(z.notes), { size: 8.5 }); }
      if (az && az.tips && az.tips.length) { f.h3('Conseils pour cette zone'); f.bullets(az.tips, { size: 8.5 }); }
      await check();
    }
    if (!zones.length) { const f = newFlow('Fiches par zone'); section('Fiches par zone', f.page); f.h1('Fiches par zone'); f.note('Aucune zone dessinée : pas de fiche à afficher.'); }
  }

  // --- conseils ---
  const monthsFor = (zoneId, plantId, kind) => cal.filter((c) => c.tasks.some((t) => t.zoneId === zoneId && t.plantId === plantId && t.kind === kind)).map((c) => c.month);
  const plantsFlat = []; // {z, zi, plant, pl, qty}
  zones.forEach((z, zi) => { const seen = new Map(); for (const pl of z.plantings || []) { const plant = lookup(pl.plantId); if (!plant) continue; const e = seen.get(plant.id); if (e) e.qty += Math.max(1, Math.round(pl.count || 1)); else { const r = { z, zi, plant, pl, qty: Math.max(1, Math.round(pl.count || 1)) }; seen.set(plant.id, r); plantsFlat.push(r); } } });
  const soilText = SOIL_PREP[garden.context && garden.context.soil] || 'Ameublir le sol sur 30 cm et enrichir de compost mûr.';
  if (opt.advice) {
    // 1. Ordre du chantier et fiches de plantation
    prog('Conseils de plantation…');
    let f = newFlow('Conseils de plantation');
    section('Conseils de plantation', f.page);
    f.h1('Conseils de plantation');
    f.note('Conseils généraux, à adapter à votre terrain, à votre région et à la météo. Les périodes sont des ordres de grandeur.');
    f.h2('Ordre du chantier');
    const stage0 = [];
    for (const r of zoneRowsInfo) if (['terrace', 'path', 'pond', 'pool'].includes(r.z.type)) stage0.push(`Z${r.n} ${r.label} (${r.t.label})`);
    for (const e of elements) if (e.group === 'Mobilier, équipements et structures' || /Clôture|Mur/.test(e.label)) stage0.push(`${e.label}`);
    const stages = new Map();
    if (stage0.length) stages.set(0, stage0.map((t) => ({ text: t })));
    for (const r of plantsFlat) {
      const st = STAGE[r.plant.category] ?? 2;
      const arr = stages.get(st) || []; stages.set(st, arr);
      const when = monthsText(monthsFor(r.z.id, r.plant.id, 'plant'));
      arr.push({ text: `${r.plant.category === 'lawn' ? `Semer ${area(shapeAreaSafe(r.z))} de` : `Planter ${r.qty} ×`} ${nom(r.plant)}`, detail: `Z${zoneNums.get(r.z.id)} ${zLabelById.get(r.z.id)}${when ? ` · ${when}` : ''}`, n: sp.map.get(r.plant.id) });
    }
    if (!stages.size) f.p('Aucune étape à planifier pour le moment : ajoutez des zones et des essences.', { color: COLORS.muted });
    let k = 1;
    for (const st of [0, 1, 2, 3, 4, 5]) {
      if (!stages.has(st)) continue;
      f.h3(`${k++}. ${STAGE_LABEL[st]}`);
      for (const it of stages.get(st)) f.check(it.text, { indent: 8, detail: it.detail });
      f.spacer(3);
    }
    f.h2('Fiches de plantation, zone par zone');
    f.p(`${soilText} Paillage : ${advice.general.mulch}`, { size: 8.5, gap: 6 });
    for (let zi = 0; zi < zones.length; zi++) {
      const rows = plantsFlat.filter((r) => r.zi === zi);
      if (!rows.length) continue;
      f.h3(`Z${zi + 1} · ${zLabelById.get(zones[zi].id)}`);
      for (const r of rows) {
        const c = advice.zones[zi].plants.find((q) => q.plant.id === r.plant.id) || {};
        const sp2 = r.plant.spacing > 0 ? (r.plant.spacing < 1 ? `${Math.round(r.plant.spacing * 100)} cm` : `${fr(r.plant.spacing, 1)} m`) : null;
        const lines = [
          `Quand : ${monthsText(monthsFor(r.z.id, r.plant.id, 'plant')) || 'selon la saison'}${sp2 ? ` · Écartement : ${sp2}` : ''} · Profondeur : ${DEPTH[r.plant.category] || DEPTH.shrub}`,
          c.planting ? `Plantation : ${c.planting}` : null, `Reprise : ${RESUME[r.plant.category] || RESUME.shrub}`, `Paillage : ${MULCH[r.plant.category] || MULCH.shrub}`, STAKE[r.plant.category] ? `Tuteurage : ${STAKE[r.plant.category]}` : null,
        ].filter(Boolean);
        const h = 13 + lines.reduce((s, t) => s + wrapText(t, f.width - 24, 8).length * 10.6, 0) + 5;
        f.ensure(h);
        drawCheckbox(f.page, f.x0, f.y + 1, 8);
        drawBadge(f.page, sp.map.get(r.plant.id), f.x0 + 24, f.y + 5.5, 'sp');
        f.page.text(`${nom(r.plant)}${r.plant.category === 'lawn' ? '' : ` ×${r.qty}`}`, f.x0 + 38, f.y + 9, { size: 9, font: 'bold' });
        f.page.text(r.plant.latinName || '', f.x0 + 42 + textWidth(`${nom(r.plant)} ×${r.qty}`, 9, 'bold'), f.y + 9, { size: 8, font: 'italic', color: COLORS.muted });
        f.y += 13;
        for (const t of lines) f.p(t, { size: 8, indent: 14, gap: 0 });
        f.y += 5;
      }
    }
    await check();

    // 2. Calendrier annuel
    prog('Calendrier annuel…');
    f = newFlow('Calendrier annuel');
    section('Calendrier annuel des tâches', f.page);
    f.h1('Calendrier annuel des tâches');
    f.p('Nombre de tâches par type et par mois : plus la case est foncée, plus il y a à faire.', { size: 8.5, color: COLORS.muted });
    {
      const lw = 92; const cw = (f.width - lw) / 12; const rh = 17; f.ensure(rh * 7 + 10);
      const pg = f.page; const y0 = f.y;
      MONTHS_SHORT.forEach((m, i) => pg.text(m, f.x0 + lw + i * cw + cw / 2, y0 + 10, { size: 7, font: 'bold', align: 'center', color: COLORS.dark }));
      KINDS.forEach((kd, r) => {
        const y = y0 + 14 + r * rh;
        pg.text(kindLabel[kd], f.x0, y + 11, { size: 8 });
        for (let m = 1; m <= 12; m++) {
          const nTasks = new Set(cal[m - 1].tasks.filter((t) => t.kind === kd).map((t) => t.plantId || t.zoneId)).size;
          const shade = nTasks === 0 ? '#f3f3f0' : nTasks <= 2 ? '#cfe3c8' : nTasks <= 5 ? '#8fbf86' : '#4d8f4f';
          pg.rect(f.x0 + lw + (m - 1) * cw + 0.8, y, cw - 1.6, rh - 2, { fill: shade, stroke: '#b9c3b4', lineWidth: 0.4 });
          if (nTasks) pg.text(String(nTasks), f.x0 + lw + (m - 1) * cw + cw / 2, y + 10.5, { size: 7.5, font: 'bold', align: 'center', color: nTasks > 5 ? '#ffffff' : '#111111' });
        }
      });
      f.y = y0 + 14 + 6 * rh + 8;
    }
    for (let m = 1; m <= 12; m++) {
      const tasks = cal[m - 1].tasks;
      f.h3(MONTHS[m - 1]);
      if (!tasks.length) { f.p('Rien de particulier.', { size: 8.5, color: COLORS.muted, gap: 2 }); continue; }
      for (const kd of KINDS) {
        const names = [...new Set(tasks.filter((t) => t.kind === kd).map((t) => { const pl = t.plantId ? lookup(t.plantId) : null; return pl ? nom(pl) : t.text.replace(/^[^:]+: /, '').split(' (')[0]; }))];
        if (names.length) { const hh = wrapText(`${kindLabel[kd]} : ${names.join(', ')}`, f.width - 10, 8.5).length * 11.2; f.ensure(hh); const lead = `${kindLabel[kd]} : `; f.page.text(lead, f.x0 + 4, f.y + 8, { size: 8.5, font: 'bold' }); const rest = wrapText(`${lead}${names.join(', ')}`, f.width - 10, 8.5); let yy = f.y; rest.forEach((ln, i) => { if (i === 0) f.page.text(ln.slice(lead.length), f.x0 + 4 + textWidth(lead, 8.5, 'bold'), yy + 8, { size: 8.5 }); else f.page.text(ln, f.x0 + 4, yy + 8, { size: 8.5 }); yy += 11.2; }); f.y += hh + 1; }
      }
      f.spacer(3);
    }
    await check();

    // 3. Entretien
    prog('Entretien…');
    f = newFlow('Entretien');
    section('Entretien : taille et engrais', f.page);
    f.h1('Entretien : taille et engrais');
    const seenSp = new Set(); const careRows = [];
    for (const r of plantsFlat) {
      if (seenSp.has(r.plant.id)) continue; seenSp.add(r.plant.id);
      const c = advice.zones[r.zi].plants.find((q) => q.plant.id === r.plant.id) || {};
      careRows.push([{ badge: sp.map.get(r.plant.id), kind: 'sp' }, { name: nom(r.plant), sub: r.plant.latinName || '' }, monthsText(monthsFor(r.z.id, r.plant.id, 'prune')) || '—', monthsText(monthsFor(r.z.id, r.plant.id, 'fertilize')) || '—', `${c.pruning || ''}${c.fertilizer ? ` Engrais : ${c.fertilizer}` : ''}`]);
    }
    if (careRows.length) f.table({ cols: [{ label: 'N°', w: 26, align: 'center' }, { label: 'Essence', w: 110 }, { label: 'Taille', w: 54 }, { label: 'Engrais', w: 44 }, { label: 'Conseils', w: 'flex' }], rows: careRows, size: 7.5 });
    else f.note('Aucune essence : pas de conseil d’entretien.');
    const ex = advice.existing;
    if (ex && (ex.entries.length || ex.toRemove.length)) {
      f.h2('Plantes existantes');
      for (const e of ex.entries) { f.h3(`${e.label}${e.plant ? ` (${e.plant.latinName || ''})` : ''}`); f.p(`${e.pruning} ${e.notes || ''}`, { size: 8.5, gap: 1 }); f.p(`Taille : ${monthsText(e.pruneMonths) || '—'} · Engrais : ${monthsText(e.fertMonths) || '—'}`, { size: 8, color: COLORS.muted }); }
      if (ex.toRemove.length) { f.h3('À retirer ou remplacer'); for (const r of ex.toRemove) f.check(`${r.label} : ${r.tip}`, { size: 8.5 }); }
    }
    await check();

    // 4. Arrosage
    prog('Arrosage…');
    f = newFlow('Arrosage');
    section('Arrosage', f.page);
    f.h1('Arrosage');
    f.note('Ordres de grandeur : adaptez à votre sol, à la météo et à l’âge des plantations (arrosage de reprise la première année).');
    const hz = hydrozones(garden); const sched = monthlySchedule(garden, { year: now.getFullYear() });
    if (!hz.length) f.p('Aucune zone arrosable pour le moment : ajoutez des essences ou une pelouse.', { color: COLORS.muted });
    else {
      f.h2('Hydrozones');
      f.table({ cols: [{ label: 'Besoin en eau', w: 80 }, { label: 'Surface', w: 56, align: 'right' }, { label: 'Zones', w: 'flex' }], rows: hz.map((h2) => [{ text: WATER_LABELS[h2.level] || h2.level, bold: true }, { text: area(h2.areaM2), align: 'right' }, h2.zoneIds.map((id) => `Z${zoneNums.get(id)} ${zLabelById.get(id)}`).join(', ')]), size: 8 });
      if (hz.length > 1) f.p('Les zones de besoins différents s’arrosent à part : ne les regroupez pas sur le même circuit.', { size: 8.5 });
      f.h2('Litres par semaine, mois par mois');
      const mc = (i) => ({ text: MONTHS_SHORT[i].replace('.', ''), align: 'center' });
      const colsM = [{ label: 'Zone', w: 'flex' }, ...MONTHS_SHORT.map((m) => ({ label: m.replace('.', ''), w: 30, align: 'right' }))];
      void mc;
      f.table({ cols: colsM, rows: sched[0].zones.map((zz, zi) => [{ text: `Z${zoneNums.get(zz.zoneId)} ${zz.label}` }, ...sched.map((s) => ({ text: String(s.zones[zi].litersPerWeek || '—'), align: 'right' }))]), size: 7 });
      f.h2('Fréquence d’arrosage, mois par mois');
      f.table({ cols: colsM, rows: sched[0].zones.map((zz, zi) => [{ text: `Z${zoneNums.get(zz.zoneId)} ${zz.label}` }, ...sched.map((s) => ({ text: s.zones[zi].intervalDays ? `${s.zones[zi].intervalDays} j` : '—', align: 'right' }))]), size: 7 });
      f.p('« 3 j » = un arrosage tous les 3 jours ; « — » = la pluie suffit en général.', { size: 8, color: COLORS.muted });
      f.h2('Matériel suggéré');
      const mat = [];
      if (hz.some((h2) => h2.level === 'high')) mat.push('Zones à fort besoin (potager, massifs) : tuyau poreux ou goutte-à-goutte avec programmateur.');
      if (zones.some((z) => z.type === 'lawn')) mat.push('Pelouse : arroseur oscillant ou turbine rétractable, tôt le matin.');
      if (hz.some((h2) => h2.level === 'low')) mat.push('Zones à faible besoin : arrosoir ou tuyau, seulement la première année puis en cas de sécheresse.');
      mat.push(advice.general.rainwater, 'Un programmateur et un tuyau avec lance douchette suffisent pour la plupart des jardins.');
      f.bullets(mat, { size: 8.5 });
    }
    await check();

    // 5. Protection hivernale
    prog('Protection hivernale…');
    f.h2('Protection hivernale');
    if (facts.tmin == null) f.p('Renseignez le département du jardin pour obtenir les protections selon votre zone de rusticité.', { color: COLORS.muted });
    else {
      f.p(`Zone de rusticité ${facts.usda} (minimum de référence ≈ ${facts.tmin} °C${garden.context && garden.context.altitude ? `, altitude corrigée` : ''}).`, { size: 8.5 });
      const prot = frostProtection(garden, facts.tmin);
      if (prot.length) for (const x of prot) f.check(x.text, { size: 8.5 }); else f.p('Aucune essence du jardin ne demande de protection particulière dans votre zone.', { size: 8.5 });
    }
    await check();
  }

  // --- listes de courses ---
  if (opt.shopping) {
    const sl = shoppingList(garden, lookup);
    const sup = suppliesList(garden, lookup);
    const itb = itemsToBuy(garden);
    const periods = shoppingByPeriod(garden, lookup);
    const zn = (l) => l.zoneIds.map((id) => `Z${zoneNums.get(id)}`).join(', ');
    const qtyText = (l) => (l.unit === 'm2' ? area(l.qty) : l.unit === 'bulb' ? `${l.qty} bulbes` : String(l.qty));
    const puText = (l) => (l.unitPrice == null ? '—' : `${formatPrice(l.unitPrice)}${l.unit === 'm2' ? '/m²' : ''}`);
    const totText = (l) => (l.unitPrice == null ? '—' : euro(l.total));
    const empty = 'Aucune plante à acheter : ajoutez des essences aux zones pour obtenir cette liste.';
    prog('Listes de courses…');
    let f = newFlow('Listes de courses');
    section('Listes de courses', f.page);
    f.h1('Listes de courses');
    f.p(`Plantes ≈ ${euro(sl.total)} · fournitures ≈ ${euro(sup.total)} · mobilier et structures ≈ ${euro(itb.total)} · total estimé ≈ ${euro(sl.total + sup.total + itb.total)}${sl.unknownCount ? ` (${sl.unknownCount} essence(s) sans prix)` : ''}.`, { size: 9, font: 'bold', gap: 4 });
    f.note(SHOPPING_NOTE);
    // 1. globale
    f.h2('1. Liste globale (par catégorie et format d’achat)');
    if (!sl.groups.length) f.p(empty, { color: COLORS.muted });
    else {
      const cols = [{ label: '', w: 16, align: 'center' }, { label: 'Essence', w: 'flex' }, { label: 'Format', w: 82 }, { label: 'Qté', w: 40, align: 'right' }, { label: 'Prix unit.', w: 44, align: 'right' }, { label: 'Total', w: 44, align: 'right' }, { label: 'Zones', w: 50 }];
      const rows = [];
      for (const g of sl.groups) {
        rows.push({ group: g.label });
        for (const l of g.lines) rows.push([{ check: true }, { name: nom(l.plant), sub: l.plant.latinName || '' }, l.format, { text: qtyText(l), align: 'right' }, { text: puText(l), align: 'right' }, { text: totText(l), align: 'right' }, zn(l)]);
        rows.push({ total: ['', `Sous-total : ${g.label}`, '', '', '', { text: euro(g.subtotal), align: 'right' }, ''] });
      }
      rows.push({ total: ['', 'TOTAL GÉNÉRAL DES PLANTES', '', '', '', { text: euro(sl.total), align: 'right' }, ''] });
      f.table({ cols, rows, size: 7.5, minRowH: 17 });
    }
    // 2. par zone
    prog('Listes par zone…');
    f.h2('2. Une liste par zone');
    if (!sl.byZone.length) f.p(empty, { color: COLORS.muted });
    for (const zl of sl.byZone) {
      f.h3(`Z${zl.n} · ${zl.label}`);
      const rows = zl.lines.map((l) => [{ check: true }, { name: nom(l.plant), sub: l.plant.latinName || '' }, l.format, { text: qtyText(l), align: 'right' }, { text: puText(l), align: 'right' }, { text: totText(l), align: 'right' }]);
      rows.push({ total: ['', `Total zone Z${zl.n}`, '', '', '', { text: euro(zl.total), align: 'right' }] });
      f.table({ cols: [{ label: '', w: 16, align: 'center' }, { label: 'Essence', w: 'flex' }, { label: 'Format', w: 96 }, { label: 'Qté', w: 46, align: 'right' }, { label: 'Prix unit.', w: 48, align: 'right' }, { label: 'Total', w: 48, align: 'right' }], rows, size: 7.5, minRowH: 17 });
    }
    // 3. par période
    f.h2('3. Étaler les achats selon la période de plantation');
    if (!periods.length) f.p(empty, { color: COLORS.muted });
    for (const p of periods) {
      f.h3(p.label);
      const rows = p.lines.map((l) => [{ check: true }, { name: nom(l.plant), sub: l.plant.latinName || '' }, l.format, { text: qtyText(l), align: 'right' }, l.best || '—', { text: totText(l), align: 'right' }, zn(l)]);
      rows.push({ total: ['', 'Sous-total de la période', '', '', '', { text: euro(p.subtotal), align: 'right' }, ''] });
      f.table({ cols: [{ label: '', w: 16, align: 'center' }, { label: 'Essence', w: 'flex' }, { label: 'Format', w: 84 }, { label: 'Qté', w: 40, align: 'right' }, { label: 'Meilleure date', w: 66 }, { label: 'Total', w: 44, align: 'right' }, { label: 'Zones', w: 44 }], rows, size: 7.5, minRowH: 17 });
    }
    await check();
    // 4. fournitures
    prog('Fournitures…');
    f.h2('4. Fournitures estimées');
    if (!sup.lines.length) f.p('Aucune plantation : pas de fourniture de plantation à prévoir.', { color: COLORS.muted });
    else {
      const rows = sup.lines.map((l) => [{ check: true }, { name: l.label, sub: l.basis }, { text: `${l.qty >= 100 ? Math.round(l.qty) : String(l.qty).replace('.', ',')} ${l.unit}`, align: 'right' }, l.pack ? `${l.packs} × ${l.pack} ${l.unit === 'L' ? 'L' : l.unit === 'kg' ? 'kg' : ''}`.trim() : l.packs ? `${l.packs} lot` : '—', { text: l.unitPrice == null ? '—' : formatPrice(l.unitPrice), align: 'right' }, { text: l.unitPrice == null ? 'eau' : euro(l.total), align: 'right' }]);
      rows.push({ total: ['', 'Total des fournitures', '', '', '', { text: euro(sup.total), align: 'right' }] });
      f.table({ cols: [{ label: '', w: 16, align: 'center' }, { label: 'Fourniture (calcul)', w: 'flex' }, { label: 'Besoin', w: 58, align: 'right' }, { label: 'À acheter', w: 62 }, { label: 'Prix unit.', w: 44, align: 'right' }, { label: 'Total', w: 44, align: 'right' }], rows, size: 7.5, minRowH: 17 });
      f.p(`Hypothèses : ${SUPPLY.compostLPerM2Bed} L de terreau par m² de massif, ${SUPPLY.compostLPerWoody} L par arbre ou arbuste en fosse, paillage de 5 cm, quantités arrondies au sac ou au lot.`, { size: 7.5, color: COLORS.muted });
    }
    // 5. aménagements
    prog('Aménagements…');
    f = newFlow('Aménagements');
    section('Aménagements à acheter ou à faire', f.page);
    f.h1('Aménagements à acheter ou à faire');
    f.p('Mobilier, équipements et structures du plan (niveau 1), avec le prix moyen du catalogue d’éléments.', { size: 8.5, gap: 6 });
    if (!itb.lines.length) f.note('Aucun mobilier ni structure n’a été placé sur le plan.');
    else {
      const rows = itb.lines.map((l) => [{ check: true }, { badge: elNums.get(`item:${l.id}`), kind: 'el' }, l.label, l.dims, l.height === undefined ? '—' : formatHeight(l.height), { text: formatPrice(l.price), align: 'right' }]);
      rows.push({ total: ['', '', 'Total mobilier et structures', '', '', { text: euro(itb.total), align: 'right' }] });
      f.table({ cols: [{ label: '', w: 16, align: 'center' }, { label: 'N°', w: 28, align: 'center' }, { label: 'Élément', w: 'flex' }, { label: 'Dimensions', w: 80 }, { label: 'Hauteur', w: 48 }, { label: 'Prix', w: 56, align: 'right' }], rows, size: 8, minRowH: 17 });
    }
    f.h2('À retenir');
    f.bullets([SHOPPING_NOTE, `Prévoyez environ ${Math.round(LOSS_MARGIN * 100)} % de plants en plus pour les pertes à la reprise.`, 'Comparez les formats (pot, godet, racines nues) : à même taille adulte, un plus petit plant coûte moins cher et reprend souvent mieux.'], { size: 8.5 });
    await check();
  }

  // --- vues isométriques ---
  if (opt.iso) {
    prog('Vues isométriques…');
    const f = newFlow('Vues isométriques');
    section('Vues isométriques', f.page);
    f.h1('Vues isométriques');
    const svg = renderContactSheet(garden, { month, age: 'adult', plantLookup: env.plantLookup });
    const bw = Math.min(f.width, (f.bottom - f.y - 4) * (2000 / 2960)); const bh = bw * (2960 / 2000);
    const img = await rast(svg, { width: 2000, height: 2960, pxWidth: Math.round((bw / 72) * 160), pxHeight: Math.round((bh / 72) * 160), type: 'jpeg', quality: 0.85 });
    f.page.image(doc.addImage(img), f.x0 + (f.width - bw) / 2, f.y, bw, bh);
    await check();
  }

  // --- hypothèses et limites ---
  prog('Hypothèses et crédits…');
  {
    const f = newFlow('Hypothèses et limites');
    section('Hypothèses et limites', f.page);
    f.h1('Hypothèses et limites');
    f.bullets([
      'Prix moyens indicatifs en jardinerie (France, € TTC) : vérifiez les tarifs, les stocks et les tailles de pots auprès de votre fournisseur.',
      'Conseils généraux, à adapter à votre terrain, à votre région, à l’exposition réelle et à la météo de l’année.',
      'Le plan est à l’échelle d’après les mesures saisies dans l’application ; les plantes sont dessinées à l’âge adulte, leur disposition est indicative.',
      'Périodes de plantation, de taille et d’arrosage : ordres de grandeur. Les quantités de fournitures sont arrondies au sac ou au lot.',
      'Zone de rusticité et températures minimales : valeurs moyennes du département, corrigées de l’altitude quand elle est renseignée.',
      'Avant d’abattre un arbre ou de planter près d’une limite de propriété, renseignez-vous sur la réglementation locale.',
    ], { size: 9 });
    f.h2('Crédits photos');
    if (credits.length) { f.p('Photos : Wikipédia (miniatures, licences libres de leurs auteurs). Pages d’origine :', { size: 8.5 }); f.p(credits.map((c) => `${nom(c.plant)}${c.page ? ` (${c.page.replace(/^https?:\/\//, '')})` : ''}`).join(' ; '), { size: 7.5, color: COLORS.muted }); }
    else f.p('Aucune photo n’est incluse dans ce document : les essences sont représentées par des pastilles de couleur.', { size: 8.5, color: COLORS.muted });
    f.h2('Informations du document');
    f.p(`Généré le ${dateText} par l’application Jardin${env.appVersion ? `, version ${env.appVersion}` : ''}. Document créé hors ligne, sur votre appareil.`, { size: 8.5 });
  }

  // --- couverture (rédigée en dernier : numéros de page connus) ---
  prog('Couverture…');
  drawCover(doc, cover, { facts, garden, toc, levelPages, layersPage, zoneFirstPages, lastPlanImg, opt, sp, zones, dateText, elements, itb: itemsToBuy(garden), sup: suppliesList(garden, lookup), zoneRowsInfo });
  // pieds de page
  const n = doc.pages.length;
  doc.pages.forEach((p, i) => {
    p.text(`${facts.name} · ${dateText}`, 22, p.h - 14, { size: 7.5, color: COLORS.muted });
    p.text(`Page ${i + 1} / ${n}`, p.w - 22, p.h - 14, { size: 7.5, color: COLORS.muted, align: 'right' });
  });
  progress('Écriture du fichier PDF…', stepsTotal, stepsTotal);
  await check();
  const bytes = await doc.save();
  const baseName = String(facts.name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'jardin';
  return { bytes, pages: n, filename: `jardin-${baseName}-plan.pdf`, facts, sections: toc.map((t) => ({ title: t.title, page: doc.pages.indexOf(t.page) + 1 })) };
}

function shapeAreaSafe(z) { try { return shapeArea(z.shape) || 0; } catch { return 0; } }
function safeColor(c, fb) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : (typeof c === 'string' && /^#[0-9a-f]{3}$/i.test(c.trim()) ? c.trim() : fb); }

function drawCover(doc, page, d) {
  const { facts, toc, levelPages, layersPage, opt } = d;
  const L = 40; const W = page.w - 80;
  const pn = (p) => doc.pages.indexOf(p) + 1;
  page.rect(0, 0, page.w, 120, { fill: '#2f6b3a' });
  page.text('Plan et guide de plantation', L, 44, { size: 11, color: '#d8ecd4' });
  const title = wrapText(facts.name, W, 28, 'bold')[0];
  page.text(title, L, 80, { size: 28, font: 'bold', color: '#ffffff' });
  page.text(`Jardin de ${area(facts.area)} · ${facts.region || 'France'} · ${d.dateText}`, L, 102, { size: 10, color: '#e8f3e5' });
  // fiche
  let y = 142;
  const info = [
    ['Localisation', [facts.commune, facts.departement ? `département ${facts.departement}` : '', facts.region].filter(Boolean).join(', ') || 'non renseignée'],
    ['Altitude', Number.isFinite(facts.altitude) && facts.altitude ? `${Math.round(facts.altitude)} m` : 'non renseignée'],
    ['Rusticité', facts.usda ? `zone ${facts.usda} (minimum ≈ ${facts.tmin} °C)` : 'département non renseigné'],
    ['Orientation', `${facts.orientation ? `${facts.orientation} · ` : ''}nord à ${Math.round(facts.northAngle)} ° du haut de la page`],
    ['Surface / périmètre', `${area(facts.area)} / ${fr(facts.perimeter, 1)} m`],
    ['Entretien souhaité', facts.maintenance || 'non précisé'],
    ['Ambiances', facts.ambiances.length ? facts.ambiances.join(', ') : 'aucune ambiance particulière'],
  ];
  for (const [k, v] of info) { page.text(k, L, y, { size: 9, font: 'bold', color: COLORS.dark }); wrapText(v, W - 260, 9).slice(0, 2).forEach((ln, i) => page.text(ln, L + 105, y + i * 11, { size: 9 })); y += 15; }
  // rose du nord
  const cx = page.w - 40 - 34; const cy = 168; const a = (facts.northAngle * Math.PI) / 180; const R = 28;
  page.circle(cx, cy, R, { stroke: COLORS.line, lineWidth: 0.8 });
  const tip = { x: cx + Math.sin(a) * R * 0.85, y: cy - Math.cos(a) * R * 0.85 };
  const l1 = { x: cx + Math.sin(a + 2.5) * R * 0.45, y: cy - Math.cos(a + 2.5) * R * 0.45 }; const l2 = { x: cx + Math.sin(a - 2.5) * R * 0.45, y: cy - Math.cos(a - 2.5) * R * 0.45 };
  page.path([tip, l1, { x: cx, y: cy }, l2], { close: true, fill: '#222222', stroke: '#222222' });
  page.text('N', tip.x + Math.sin(a) * 8 - 3, tip.y - Math.cos(a) * 8 + 3, { size: 9, font: 'bold' });
  // résumé chiffré
  y += 8;
  const tiles = [[String(facts.zones), 'zones'], [String(facts.species), 'essences'], [String(facts.plants), 'plants'], [euro(facts.cost.total), 'budget plantes'], [euro(d.itb.total), 'mobilier'], [euro(d.sup.total), 'fournitures']];
  const tw = (W - 5 * 8) / 6;
  tiles.forEach(([v, lab], i) => { const x = L + i * (tw + 8); page.rect(x, y, tw, 40, { fill: '#f1f6ee', stroke: COLORS.line, lineWidth: 0.6, radius: 4 }); page.text(v, x + tw / 2, y + 19, { size: v.length > 7 ? 11 : 15, font: 'bold', color: COLORS.dark, align: 'center' }); page.text(lab, x + tw / 2, y + 32, { size: 7.5, color: COLORS.muted, align: 'center' }); });
  y += 54;
  // mini plan
  if (d.lastPlanImg) { const bw = 230; const bh = bw * d.lastPlanImg.h / d.lastPlanImg.w; page.image(d.lastPlanImg.id, page.w - 40 - bw, y, bw, bh); page.rect(page.w - 40 - bw, y, bw, bh, { stroke: COLORS.line, lineWidth: 0.6 }); d.miniH = bh; }
  // sommaire
  page.text('Sommaire', L, y + 12, { size: 13, font: 'bold', color: COLORS.dark });
  let ty = y + 28; const tocW = d.lastPlanImg ? W - 250 : W;
  for (const t of toc.filter((q) => q.level === 0)) {
    const num = String(pn(t.page));
    page.text(wrapText(t.title, tocW - 30, 9)[0], L, ty, { size: 9, color: '#0b4f8a' });
    page.text(num, L + tocW, ty, { size: 9, align: 'right' });
    page.line(L, ty + 2, L + tocW, ty + 2, { color: '#dfe5dc', width: 0.4, dash: [1, 2] });
    page.link(L, ty - 9, tocW, 13, { page: t.page });
    ty += 15;
  }
  y = Math.max(ty, y + (d.miniH || 0)) + 14;
  // mode d'emploi
  page.text('Comment utiliser ce PDF', L, y, { size: 13, font: 'bold', color: COLORS.dark }); y += 14;
  const tips = [];
  if (levelPages[1]) tips.push(`Page ${pn(levelPages[1])} : ce qui est déjà là (terrain, bâti, plantes existantes) et le mobilier.`);
  if (levelPages[2]) tips.push(`Page ${pn(levelPages[2])} : + les zones, avec leur surface ; le niveau 1 reste visible, adouci.`);
  if (levelPages[3]) tips.push(`Page ${pn(levelPages[3])} : + les plantations, numérotées par essence.`);
  if (layersPage) tips.push(`Page ${pn(layersPage)} : plan complet à calques PDF (Acrobat, Foxit, Okular…) ; beaucoup de lecteurs mobiles les ignorent, utilisez alors les pages précédentes.`);
  tips.push('Ensuite : une page par zone, les conseils de plantation, le calendrier, l’entretien, l’arrosage, puis les listes de courses à cocher.');
  tips.push('Les liens du sommaire et les signets du lecteur PDF permettent de sauter directement à une section. Le texte est sélectionnable et imprimable en noir et blanc.');
  for (const t of tips) { for (const [i, ln] of wrapText(t, W - 12, 9).entries()) { if (i === 0) page.text('•', L + 2, y, { size: 9, color: COLORS.accent }); page.text(ln, L + 12, y, { size: 9 }); y += 11.5; } y += 2; }
  void pdfSafeText;
}
