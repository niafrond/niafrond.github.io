// Golden de l'arrosage (watering.js). Fuseau fixé à Europe/Paris : les clés de jour et les heures de notification
// dépendent du fuseau local ; les tests Kotlin passent le même fuseau.
process.env.TZ = 'Europe/Paris';
const { writeFileSync, mkdirSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { dirname, resolve } = await import('node:path');
const { hydrozones, waterNeed, planWatering, monthlySchedule, zoneProfile } = await import('../../jardin/watering.js');
const { makeGardens, SYNTH, plantsMap } = await import('./fixtures-jardins.mjs');

const here = dirname(fileURLToPath(import.meta.url));
const gardens = makeGardens();
const map = plantsMap();
const plantsById = Object.fromEntries(map);

const dates = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 5, from + i)).toISOString().slice(0, 10));
const day = (date, o = {}) => ({ date, precipMm: 0, et0Mm: 5, tminC: 12, tmaxC: 28, ...o });
const mk = (over = {}, n = 13, from = 7) => ({ daily: dates(from, n).map((d) => day(d, { ...(over.all || {}), ...(over[d] || {}) })) });
const forecasts = {
  sec: mk(),
  chaud: mk({ all: { tmaxC: 37 } }),
  gel: mk({ '2026-06-13': { tminC: 1 }, '2026-06-15': { tminC: -2.5 }, '2026-06-16': { tmaxC: 36.4 } }),
  pluie: mk({ '2026-06-11': { precipMm: 6 }, '2026-06-13': { precipMm: 12 }, '2026-06-14': { precipMm: 0.4 }, '2026-06-17': { precipMm: 8 }, '2026-06-09': { precipMm: 3 } }),
  humide: mk({ all: { precipMm: 4, et0Mm: 2.5 } }),
  nulls: { daily: dates(8, 10).map((d, i) => ({ date: d, precipMm: i % 3 === 0 ? null : 1.5, et0Mm: i % 2 === 0 ? null : 4.2, tminC: i % 4 === 0 ? null : 8, tmaxC: i % 5 === 0 ? null : 30 })) },
  desordre: { daily: [...mk({ all: { et0Mm: 4.4 } }, 9, 9).daily].reverse() },
  court: mk({}, 3, 10),
  vide: { daily: [] },
  aucune: null,
};
const states = {
  vierge: {},
  fait: { lastWatered: { z1: '2026-06-10', z2: '2026-06-09', z3: '2026-06-10', z4: '2026-06-10', z5: '2026-06-08' } },
  report: { snoozeUntil: '2026-06-13T10:00:00.000Z', lastWatered: { z1: '2026-06-08' } },
};
const settingsList = {
  defaut: {},
  matin: { notifications: { enabled: true, hour: 7, minute: 30, frost: true, heat: true, vacationUntil: null } },
  soir: { notifications: { hour: 21, minute: 15 } },
  vacances: { notifications: { vacationUntil: '2026-06-12' } },
  coupe: { notifications: { enabled: false } },
  sansAlertes: { notifications: { frost: false, heat: false, hour: 12 } },
};
const nows = {
  matin: '2026-06-10T06:30:00.000Z', // 08:30 Paris
  tard: '2026-06-10T20:00:00.000Z', // 22:00 Paris, après l'heure de notification
  janvier: '2026-01-15T10:00:00.000Z',
  aout: '2026-08-01T05:00:00.000Z',
};
// combinaisons : toutes les prévisions × (matin, vierge, défaut) puis variations d'état / réglages / date
const cases = [];
for (const f of Object.keys(forecasts)) cases.push({ f, s: 'vierge', set: 'defaut', now: 'matin' });
for (const s of Object.keys(states)) for (const set of Object.keys(settingsList)) cases.push({ f: s === 'vierge' ? 'gel' : 'sec', s, set, now: 'matin' });
for (const n of Object.keys(nows)) for (const f of ['sec', 'aucune', 'gel']) cases.push({ f, s: 'fait', set: 'defaut', now: n });
cases.push({ f: 'chaud', s: 'vierge', set: 'soir', now: 'tard' }, { f: 'aucune', s: 'report', set: 'vacances', now: 'matin' }, { f: 'aucune', s: 'vierge', set: 'matin', now: 'aout' });

const plans = [];
gardens.forEach((g, gi) => {
  for (const c of cases) {
    const p = planWatering(g, forecasts[c.f], states[c.s], new Date(nows[c.now]), settingsList[c.set], { plantsById });
    plans.push({ g: gi, ...c, plan: p });
  }
});
const profiles = gardens.map((g) => g.zones.map((z) => zoneProfile(z, plantsById)));
const hydro = gardens.map((g) => hydrozones(g, plantsById));
const monthly = gardens.map((g) => monthlySchedule(g, { plantsById, year: 2026 }));
const needs = gardens.map((g) => g.zones.map((z) => ['2026-01-10', '2026-06-10', '2026-07-20', '2026-12-31'].flatMap((d) => [waterNeed(z, g, d, { plantsById }), waterNeed(z, g, d, { plantsById, et0Mm: 4 })])));
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/watering.json'), JSON.stringify({ gardens, synth: SYNTH, forecasts, states, settings: settingsList, nows, plans, profiles, hydro, monthly, needs }));
console.log('golden watering ok', plans.length, 'plans');
