// Arrosage : hydrozones, besoins, bilan hydrique, planification des notifications.
//
// BILAN HYDRIQUE (par zone, jour par jour, en mm = L/m²) :
//   ETc      = ET₀ × kc × facteur sol × facteur soleil × facteur reprise
//              (kc = moyenne des essences pondérée par le nombre de plants ; ET₀ météo, sinon climatologie du mois)
//   pluie eff. = 80 % de la pluie si < 10 mm, sinon 60 %
//   déficit(j) = max(0, déficit(j-1) + ETc − pluie eff.)
//   Déclenchement : déficit > seuil (faible 15 / moyen 10 / élevé 6 mm). Dose = déficit (plafonné à 25 mm) × surface.
//   Après arrosage (ou date « Fait » dans state.lastWatered) le déficit repart de 0.
// RÈGLES : pas d'arrosage si pluie ≥ 5 mm le jour même ou prévue ≥ 5 mm le lendemain (≈ 24 h) ;
//   jamais deux jours consécutifs sauf canicule (tmax ≥ 35 °C) ; une seule notification groupée par jour,
//   à l'heure des réglages ; veille d'un gel (tmin ≤ 2 °C) alerte si plantes de rusticité > −5 °C ;
//   veille d'une canicule alerte ; mode vacances et report (state.snoozeUntil) suppriment les notifications.
// SANS MÉTÉO : repli calendaire (fréquence moyenne mensuelle, `monthlySchedule`), mention « estimation sans météo ».
// Tout est ordre de grandeur : à adapter au terrain.
import { shapeArea } from './geometry.js';
import { zoneSunLevel } from './sun.js';
import { allPlants } from './catalog.js';

export const FROST_C = 2;
export const HEAT_C = 35;
export const RAIN_SKIP_MM = 5;
const MAX_DEPTH_MM = 25;
const THRESHOLD_MM = { low: 15, medium: 10, high: 6 };
const DEPTH_MM = { low: 10, medium: 15, high: 20 };
// ET₀ moyenne en France (mm/jour) et pluie moyenne (mm/jour), mois 1..12
const ET0_MONTH = [0.5, 0.9, 1.7, 2.8, 3.8, 4.6, 5.0, 4.3, 2.9, 1.5, 0.7, 0.4];
const RAIN_MONTH = [2.0, 1.7, 1.7, 1.9, 2.3, 2.0, 1.7, 1.8, 2.0, 2.4, 2.5, 2.4];
const SOIL_FACTOR = { sandy: 1.15, limestone: 1.05, loam: 1, clay: 0.9, humus: 0.9 };
const SUN_FACTOR = { full: 1.1, partial: 1, shade: 0.85 };
const NO_WATER = new Set(['pond', 'pool', 'terrace', 'path']);
const TYPE_DEFAULT = {
  lawn: { level: 'medium', kc: 0.8 },
  vegetable: { level: 'high', kc: 1.0 },
  orchard: { level: 'medium', kc: 0.7 },
  hedge: { level: 'medium', kc: 0.6 },
  trees: { level: 'low', kc: 0.6 },
  lowplants: { level: 'medium', kc: 0.6 },
  midplants: { level: 'medium', kc: 0.7 },
  tallplants: { level: 'medium', kc: 0.7 },
};
const RANK = { low: 1, medium: 2, high: 3 };
const LEVELS = [null, 'low', 'medium', 'high'];
const TYPE_LABEL = {
  pond: 'mare', pool: 'piscine', terrace: 'terrasse', path: 'allée', lawn: 'pelouse', lowplants: 'couvre-sols',
  midplants: 'massif', tallplants: 'plantes hautes', hedge: 'haie', trees: 'arbres', vegetable: 'potager',
  orchard: 'verger', other: 'zone',
};

let defaultMap = null;
function defaultPlantsById() {
  if (!defaultMap) defaultMap = Object.fromEntries(allPlants().map((p) => [p.id, p]));
  return defaultMap;
}

// ── dates (clés locales 'YYYY-MM-DD') ─────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
export function dateKey(d) {
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
const monthOf = (key) => Number(key.slice(5, 7));
function atIso(key, hour, minute) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
}
function daysBetween(a, b) {
  const t = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

const effRain = (mm) => (mm < 10 ? 0.8 : 0.6) * mm;
const zoneLabel = (z) => z.label || TYPE_LABEL[z.type] || 'zone';

// ── profils de zone ───────────────────────────────────────────────────────────
/** Niveau d'eau et kc d'une zone (essences pondérées par le nombre de plants), null si pas d'arrosage. */
export function zoneProfile(zone, plantsById = defaultPlantsById()) {
  if (!zone || NO_WATER.has(zone.type)) return null;
  let sw = 0, sr = 0, sk = 0;
  for (const pl of zone.plantings || []) {
    const p = plantsById[pl.plantId];
    if (!p || p.category === 'aquatic') continue;
    const w = Math.max(1, pl.count || 1);
    sw += w; sr += w * (RANK[p.water] || 2); sk += w * (typeof p.kc === 'number' ? p.kc : 0.6);
  }
  if (sw > 0) return { level: LEVELS[Math.min(3, Math.max(1, Math.round(sr / sw)))], kc: sk / sw };
  return TYPE_DEFAULT[zone.type] || null;
}

function zoneArea(zone) {
  try { return shapeArea(zone.shape) || 0; } catch { return 0; }
}

function youngFactor(zone, day) {
  for (const pl of zone.plantings || []) {
    if (pl.plantedAt && daysBetween(dateKey(pl.plantedAt), day) >= 0 && daysBetween(dateKey(pl.plantedAt), day) < 365) return 1.3;
  }
  return 1;
}

function sunFactor(garden, zone) {
  try { return SUN_FACTOR[zoneSunLevel(garden, zone)?.level] ?? 1; } catch { return 1; }
}

function etcMm(zone, profile, garden, et0, day) {
  return et0 * profile.kc * (SOIL_FACTOR[garden?.context?.soil] ?? 1) * sunFactor(garden, zone) * youngFactor(zone, day);
}

function profiles(garden, plantsById) {
  const out = [];
  for (const zone of garden?.zones || []) {
    const prof = zoneProfile(zone, plantsById);
    const area = zoneArea(zone);
    if (prof && area > 0) out.push({ zone, id: zone.id, label: zoneLabel(zone), level: prof.level, kc: prof.kc, area });
  }
  return out;
}

/** Regroupe les zones arrosables par niveau de besoin → `[{id, level, zoneIds, areaM2, avgKc}]`. */
export function hydrozones(garden, plantsById = defaultPlantsById()) {
  const groups = new Map();
  for (const p of profiles(garden, plantsById)) {
    const g = groups.get(p.level) || { id: `hz-${p.level}`, level: p.level, zoneIds: [], areaM2: 0, kcSum: 0 };
    g.zoneIds.push(p.id); g.areaM2 += p.area; g.kcSum += p.kc * p.area;
    groups.set(p.level, g);
  }
  return ['low', 'medium', 'high'].filter((l) => groups.has(l)).map((l) => {
    const g = groups.get(l);
    return { id: g.id, level: g.level, zoneIds: g.zoneIds, areaM2: g.areaM2, avgKc: g.kcSum / g.areaM2 };
  });
}

/** Besoin d'une zone en L/jour un jour donné (sans pluie). `opts` : {plantsById, et0Mm}. */
export function waterNeed(zone, garden, day = new Date(), opts = {}) {
  const prof = zoneProfile(zone, opts.plantsById);
  const area = zoneArea(zone);
  if (!prof || area <= 0) return 0;
  const key = dateKey(day);
  const et0 = opts.et0Mm ?? ET0_MONTH[monthOf(key) - 1];
  return etcMm(zone, prof, garden, et0, key) * area;
}

/** Fréquence et litres par mois et par zone (repli sans météo). */
export function monthlySchedule(garden, opts = {}) {
  const profs = profiles(garden, opts.plantsById || defaultPlantsById());
  const year = opts.year ?? new Date().getFullYear();
  return ET0_MONTH.map((et0, i) => {
    const month = i + 1;
    const zones = profs.map((p) => {
      const day = `${year}-${pad(month)}-15`;
      const netDay = Math.max(0, etcMm(p.zone, p, garden, et0, day) - effRain(RAIN_MONTH[i]));
      const base = { zoneId: p.id, label: p.label, level: p.level };
      if (netDay * 7 < 2) return { ...base, intervalDays: 0, timesPerWeek: 0, litersPerWatering: 0, litersPerWeek: 0 };
      const depth = DEPTH_MM[p.level];
      const interval = Math.min(21, Math.max(1, Math.round(depth / netDay)));
      return {
        ...base, intervalDays: interval, timesPerWeek: Math.round((7 / interval) * 10) / 10,
        litersPerWatering: Math.round(netDay * interval * p.area), litersPerWeek: Math.round(netDay * 7 * p.area),
      };
    });
    return { month, zones };
  });
}

// ── planification ─────────────────────────────────────────────────────────────
function roundL(x) { return Math.max(1, Math.round(x)); }

function momentWord(hour) { return hour < 12 ? 'ce matin' : hour < 17 ? 'cet après-midi' : 'ce soir'; }

function joinLabels(labels) {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

function wateringLines(entries, profs, hour, suffix) {
  const byLevel = new Map();
  for (const e of entries) {
    const lvl = profs.find((p) => p.id === e.zoneId).level;
    const g = byLevel.get(lvl) || { labels: [], liters: 0 };
    g.labels.push(e.label); g.liters += e.liters;
    byLevel.set(lvl, g);
  }
  return ['high', 'medium', 'low'].filter((l) => byLevel.has(l)).map((l) => {
    const g = byLevel.get(l);
    return `Arroser ${joinLabels(g.labels)} ${momentWord(hour)} (≈ ${roundL(g.liters)} L)${suffix}`;
  });
}

function notifId(key) { return Number(key.replace(/-/g, '')) * 10; }

function tenderPlants(garden, plantsById) {
  const names = new Set();
  for (const z of garden?.zones || []) {
    for (const pl of z.plantings || []) {
      const p = plantsById[pl.plantId];
      if (p && typeof p.hardiness === 'number' && p.hardiness > -5) names.add(p.commonName || p.id);
    }
  }
  return [...names];
}

function notifTitle(kinds) {
  const w = kinds.has('water'), f = kinds.has('frost'), h = kinds.has('heat');
  if (w && !f && !h) return 'Arrosage du jour';
  if (!w && f && !h) return 'Alerte gel cette nuit';
  if (!w && !f && h) return 'Alerte canicule';
  return 'Jardin : arrosage et alertes météo';
}

/**
 * Planifie les notifications de 7 jours. `state` : {lastWatered:{[zoneId]:'YYYY-MM-DD'}, snoozeUntil?:'YYYY-MM-DD'}.
 * `settings` : réglages complets (`{notifications:{...}}`) ou directement `notifications`. `opts.plantsById` injectable.
 * → {notifications:[{id, at, title, body, zoneIds, kinds}], summary:[{zoneId, litersPerWeek}], skipped:[{date, reason}], withoutWeather}
 */
export function planWatering(garden, forecast, state = {}, now = new Date(), settings = {}, opts = {}) {
  const plantsById = opts.plantsById || defaultPlantsById();
  const n = settings?.notifications ?? settings ?? {};
  const hour = n.hour ?? 19;
  const minute = n.minute ?? 0;
  const enabled = n.enabled !== false;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const today = dateKey(new Date(nowMs));
  const lastDay = addDays(today, 6);
  const vacation = n.vacationUntil ? dateKey(n.vacationUntil) : null;
  const snooze = state?.snoozeUntil ? dateKey(state.snoozeUntil) : null;
  const profs = profiles(garden, plantsById);
  const hasWeather = !!(forecast && Array.isArray(forecast.daily) && forecast.daily.length);
  const skipped = [];
  const notes = new Map(); // date → {lines, kinds:Set, zoneIds:Set}
  const addNote = (date, kind, lines, zoneIds) => {
    const e = notes.get(date) || { lines: [], kinds: new Set(), zoneIds: new Set() };
    e.lines.push(...lines); e.kinds.add(kind); zoneIds.forEach((z) => e.zoneIds.add(z));
    notes.set(date, e);
  };
  const skip = (date, reason) => { if (!skipped.some((s) => s.date === date && s.reason === reason)) skipped.push({ date, reason }); };
  const blocked = (date) => {
    if (vacation && date <= vacation) return 'Mode vacances';
    if (snooze && date < snooze) return 'Arrosage reporté';
    if (date === today && Date.parse(atIso(date, hour, minute)) <= nowMs) return 'Heure de notification passée';
    return null;
  };

  const summary = [];
  const lastWatered = state?.lastWatered || {};

  if (hasWeather) {
    const daily = [...forecast.daily].sort((a, b) => (a.date < b.date ? -1 : 1));
    const bal = {}; const lastWater = {};
    for (const p of profs) { bal[p.id] = 0; lastWater[p.id] = lastWatered[p.id] || null; }
    const net = Object.fromEntries(profs.map((p) => [p.id, 0]));
    let futureDays = 0;
    daily.forEach((day, i) => {
      const future = day.date >= today;
      const et0 = day.et0Mm ?? ET0_MONTH[monthOf(day.date) - 1];
      const eff = effRain(day.precipMm ?? 0);
      const heat = typeof day.tmaxC === 'number' && day.tmaxC >= HEAT_C;
      const nextRain = daily[i + 1]?.precipMm ?? 0;
      if (future) futureDays++;
      const due = [];
      for (const p of profs) {
        const etc = etcMm(p.zone, p, garden, et0, day.date);
        bal[p.id] = Math.max(0, bal[p.id] + etc - eff);
        if (future) net[p.id] += etc - eff;
        if (lastWatered[p.id] === day.date) { bal[p.id] = 0; continue; }
        if (!future || day.date > lastDay || bal[p.id] <= THRESHOLD_MM[p.level]) continue;
        due.push(p);
      }
      if (!due.length) return;
      const reason = blocked(day.date)
        || ((day.precipMm ?? 0) >= RAIN_SKIP_MM ? 'Pluie ≥ 5 mm ce jour-là' : null)
        || (nextRain >= RAIN_SKIP_MM ? 'Pluie ≥ 5 mm prévue dans les 24 h' : null);
      if (reason) { skip(day.date, reason); return; }
      const entries = [];
      for (const p of due) {
        if (!heat && lastWater[p.id] === addDays(day.date, -1)) { skip(day.date, 'Pas deux jours de suite'); continue; }
        const mm = Math.min(bal[p.id], MAX_DEPTH_MM);
        const liters = mm * p.area;
        if (liters < 1) continue;
        bal[p.id] -= mm; lastWater[p.id] = day.date;
        entries.push({ zoneId: p.id, label: p.label, liters });
      }
      if (entries.length) addNote(day.date, 'water', wateringLines(entries, profs, hour, heat ? ' - canicule : privilégiez le soir' : ''), entries.map((e) => e.zoneId));
    });
    for (const p of profs) {
      const perWeek = futureDays ? (Math.max(0, net[p.id]) / futureDays) * 7 * p.area : 0;
      summary.push({ zoneId: p.id, litersPerWeek: Math.round(perWeek) });
    }
    // alertes gel / canicule : notifiées la veille à l'heure des réglages
    const tender = tenderPlants(garden, plantsById);
    for (const day of daily) {
      const eve = addDays(day.date, -1);
      if (eve < today || eve > lastDay) continue;
      if (n.frost !== false && tender.length && typeof day.tminC === 'number' && day.tminC <= FROST_C) {
        const r = blocked(eve);
        if (r) { skip(eve, r); continue; }
        const list = tender.slice(0, 4).join(', ') + (tender.length > 4 ? '…' : '');
        addNote(eve, 'frost', [`Gel annoncé (${Math.round(day.tminC)} °C) : protégez ${list} (voile d'hivernage, rentrer les pots).`], []);
      }
      if (n.heat !== false && typeof day.tmaxC === 'number' && day.tmaxC >= HEAT_C) {
        const r = blocked(eve);
        if (r) { skip(eve, r); continue; }
        addNote(eve, 'heat', [`Canicule demain (${Math.round(day.tmaxC)} °C) : arrosez tôt ou tard, paillez et ombrez les plantes fragiles.`], []);
      }
    }
  } else {
    // repli calendaire mensuel
    const sched = monthlySchedule(garden, { plantsById, year: Number(today.slice(0, 4)) });
    for (const p of profs) {
      const per = sched[monthOf(today) - 1].zones.find((z) => z.zoneId === p.id);
      summary.push({ zoneId: p.id, litersPerWeek: per ? per.litersPerWeek : 0 });
    }
    const dues = new Map();
    for (const p of profs) {
      const last = lastWatered[p.id] || null;
      const zToday = sched[monthOf(today) - 1].zones.find((z) => z.zoneId === p.id);
      let next = last && zToday?.intervalDays ? addDays(last, zToday.intervalDays) : today;
      if (next < today) next = today;
      let guard = 0;
      while (next <= lastDay && guard++ < 20) {
        const z = sched[monthOf(next) - 1].zones.find((s) => s.zoneId === p.id);
        if (!z || !z.intervalDays) { next = addDays(next, 7); continue; }
        const arr = dues.get(next) || [];
        arr.push({ zoneId: p.id, label: p.label, liters: z.litersPerWatering });
        dues.set(next, arr);
        next = addDays(next, z.intervalDays);
      }
    }
    for (const [date, entries] of dues) {
      const r = blocked(date);
      if (r) { skip(date, r); continue; }
      addNote(date, 'water', wateringLines(entries, profs, hour, ' - estimation sans météo'), entries.map((e) => e.zoneId));
    }
  }

  const notifications = [];
  if (enabled) {
    [...notes.keys()].sort().forEach((date) => {
      const e = notes.get(date);
      notifications.push({
        id: notifId(date), at: atIso(date, hour, minute), title: notifTitle(e.kinds),
        body: e.lines.join('\n'), zoneIds: [...e.zoneIds], kinds: [...e.kinds],
      });
    });
  }
  skipped.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { notifications, summary, skipped, withoutWeather: !hasWeather };
}
