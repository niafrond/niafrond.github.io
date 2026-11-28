// Golden des conseils, du calendrier et de la protection contre le gel (advice.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildAdvice, calendar, tasksForMonth, frostProtection, existingAdvice, genericCare } from '../../jardin/advice.js';
import { allPlants } from '../../jardin/catalog.js';
import { makeGardens, SYNTH, plantsMap } from './fixtures-jardins.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gardens = makeGardens();
const map = plantsMap();
const plantsById = Object.fromEntries(map);
const exOut = (a) => ({
  month: a.month,
  toRemove: a.toRemove,
  entries: a.entries.map((e) => ({ id: e.id, kind: e.kind, label: e.label, plantId: e.plant ? e.plant.id : null, keep: e.keep, now: e.now, pruning: e.pruning, fertilizer: e.fertilizer, watering: e.watering, notes: e.notes, pruneMonths: e.pruneMonths, fertMonths: e.fertMonths, known: e.known, tips: e.tips, userNotes: e.userNotes ?? null })),
});
const advice = gardens.map((g) => {
  const a = buildAdvice(g, { plantsById });
  return {
    zones: a.zones.map((z) => ({ zoneId: z.zoneId, zoneLabel: z.zoneLabel, type: z.type, tips: z.tips, plants: z.plants.map((p) => ({ plantId: p.plant.id, count: p.count, planting: p.planting, pruning: p.pruning, fertilizer: p.fertilizer, watering: p.watering, notes: p.notes })) })),
    plantingOrder: a.plantingOrder, general: a.general,
  };
});
const calendars = gardens.map((g) => calendar(g, { plantsById }));
const tasks = gardens.map((g) => [0, 1, 7, 12, 13, -1].map((m) => tasksForMonth(g, m, { plantsById })));
const frost = gardens.map((g) => [-15, -5, -1, 0, 2, 5].map((t) => frostProtection(g, t, { plantsById })));
const existing = gardens.map((g) => Array.from({ length: 12 }, (_, i) => exOut(existingAdvice(g, { plantsById, month: i + 1 }))));
const generic = [...new Set([...allPlants().map((p) => p.category), 'zzz', undefined])].map((c) => ({ c: c ?? null, g: genericCare(c) }));
mkdirSync(resolve(here, '../golden'), { recursive: true });
writeFileSync(resolve(here, '../golden/advice.json'), JSON.stringify({ gardens, synth: SYNTH, advice, calendars, tasks, frost, existing, generic }));
console.log('golden advice ok');
