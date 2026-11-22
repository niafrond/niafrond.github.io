// Génère bus-naolib/data/ à partir du GTFS officiel Naolib (data.nantesmetropole.fr).
// Usage : node tools/build-data.mjs [dossier-gtfs-décompressé]
//   sans argument : télécharge et décompresse le GTFS courant (nécessite `unzip`).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const DS = 'https://data.nantesmetropole.fr/api/explore/v2.1/catalog/datasets/244400404_transports_commun_naolib_nantes_metropole_gtfs/records?limit=1';
const here = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(here, '..', 'data');

const unq = s => s.replace(/^"|"$/g, '');
function csv(line) { // CSV avec guillemets
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}
async function table(file, fn) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let head = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!head) { head = csv(line.replace(/^﻿/, '')); continue; }
    const v = line.includes('"') ? csv(line) : line.split(',');
    const o = {}; head.forEach((h, i) => o[h] = v[i]); fn(o);
  }
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

let dir = process.argv[2];
const rec = await (await fetch(DS)).json();
const f = rec.results[0];
const validity = { from: f.debut_de_validite, to: f.fin_de_validite };
if (!dir) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-'));
  const zip = path.join(dir, 'g.zip');
  fs.writeFileSync(zip, Buffer.from(await (await fetch(f.fichier.url)).arrayBuffer()));
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
}

const routes = {}, byShort = {};
await table(path.join(dir, 'routes.txt'), r => {
  routes[r.route_id] = r;
  const L = byShort[r.route_short_name] ||= { id: r.route_short_name, name: r.route_long_name, color: r.route_color, type: +r.route_type };
});
const stopName = {};
await table(path.join(dir, 'stops.txt'), s => { stopName[s.stop_id] = s.stop_name; });

const svcInfo = {};
await table(path.join(dir, 'calendar.txt'), c => {
  svcInfo[c.service_id] = { d: [c.sunday, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday].join(''), s: +c.start_date, e: +c.end_date, x: {} };
});
await table(path.join(dir, 'calendar_dates.txt'), c => {
  const s = svcInfo[c.service_id] ||= { d: '0000000', s: 99999999, e: 0, x: {} };
  s.x[c.date] = +c.exception_type;
});

const trips = {}; // trip_id -> {line, dir, svc, head}
await table(path.join(dir, 'trips.txt'), t => {
  const r = routes[t.route_id]; if (!r) return;
  trips[t.trip_id] = { line: r.route_short_name, dir: +t.direction_id || 0, svc: t.service_id, head: t.trip_headsign, st: [] };
});

// stop_times est lu en flux (≈ 500 Mo) ; trié par voyage
let curId = null, cur = null;
const lines = {};
function flush() {
  if (!cur || !cur.st.length) return;
  const L = lines[cur.line] ||= { dirs: [{}, {}], heads: [{}, {}], svcs: new Map(), pats: new Map(), trips: [], stopsOrd: [new Map(), new Map()] };
  L.heads[cur.dir][cur.head] = (L.heads[cur.dir][cur.head] || 0) + 1;
  const base = cur.st[0][1];
  const seen = new Set(), pat = [];
  cur.st.forEach(([name, min], i) => {
    if (seen.has(name)) return; seen.add(name);
    const m = L.stopsOrd[cur.dir]; const o = m.get(name) || { n: 0, sum: 0 };
    o.n++; o.sum += i / cur.st.length; m.set(name, o);
    pat.push([name, min - base]);
  });
  if (!L.svcs.has(cur.svc)) L.svcs.set(cur.svc, L.svcs.size);
  const key = cur.dir + '|' + pat.map(p => p.join(':')).join(',');
  if (!L.pats.has(key)) L.pats.set(key, { i: L.pats.size, dir: cur.dir, pat });
  L.trips.push([cur.dir, L.svcs.get(cur.svc), L.pats.get(key).i, base]);
}
{
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'stop_times.txt')), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    const p = line.split(',');
    const id = unq(p[0]);
    if (id !== curId) { flush(); curId = id; cur = trips[id] ? { ...trips[id], st: [] } : null; }
    if (cur) cur.st.push([stopName[unq(p[3])] || unq(p[3]), toMin(p[2])]);
  }
  flush();
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'l'), { recursive: true });
const index = [];
let total = 0;
for (const [id, L] of Object.entries(lines)) {
  const best = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  // arrêts de chaque sens, dans l'ordre moyen de passage ; indices partagés par les motifs
  const stops = L.stopsOrd.map(m => [...m.entries()].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n).map(e => e[0]));
  const idx = stops.map(s => new Map(s.map((n, i) => [n, i])));
  const svcs = [...L.svcs.keys()].map(s => svcInfo[s]);
  const pats = [...L.pats.values()].sort((a, b) => a.i - b.i).map(p => p.pat.flatMap(([n, o]) => [idx[p.dir].get(n), o]));
  const file = { dirs: [best(L.heads[0]), best(L.heads[1])], stops, svcs, pats, trips: L.trips };
  const json = JSON.stringify(file);
  fs.writeFileSync(path.join(OUT, 'l', encodeURIComponent(id) + '.json'), json);
  total += json.length;
  index.push({ id, name: byShort[id].name, color: byShort[id].color, dirs: file.dirs, stops: stops.map(s => s.length) });
}
index.sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), validity, lines: index }));
console.log(index.length, 'lignes,', (total / 1e6).toFixed(1), 'Mo');
