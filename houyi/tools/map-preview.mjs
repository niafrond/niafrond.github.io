#!/usr/bin/env node
/**
 * Aperçu ASCII d'une carte ASSEMBLÉE du Grand Monde (celle que le joueur parcourt : couronne d'eau, barrières de bordure, gardes de
 * jonction et entités ajoutées par world/junctions.js comprises), avec statistiques et contrôle d'atteignabilité à pied.
 *
 * Usage (Node ≥ 22, sous WSL) :
 *   node match3-quest/tools/map-preview.mjs <screenId>            aperçu + règles de coordonnées + statistiques + atteignabilité
 *   node match3-quest/tools/map-preview.mjs <screenId> --json     même contenu en JSON
 *   node match3-quest/tools/map-preview.mjs --all                 résumé d'une ligne par écran de plein air
 *   node match3-quest/tools/map-preview.mjs --all --json
 *   options : --routes (marque les trajets de patrouille « : »), --no-entities (sans la liste des entités)
 *
 * Légende : # obstacle · ~ liquide · = chemin · " hautes herbes · . sol · lettre A-H bâtiment (porte en minuscule) ·
 *           N PNJ · C coffre · E ennemi · B boss / gardien de porte · X sortie ou passage · W pierre de voyage · S apparition.
 * Avertissements (jamais une erreur) : entité ou passage inatteignable à pied depuis l'apparition. Un gardien de porte
 * (`guardsDoor`) n'est pas un obstacle (il tombe avant que la porte ne s'ouvre) ; les autres entités bloquent le passage et
 * s'atteignent depuis une case voisine.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// spells.js et enemies.js chargent leur catalogue JSON par XMLHttpRequest synchrone : simulé ici (comme tests/unit/fixtures/playerForge.js)
// AVANT d'importer les modules du jeu.
if (typeof globalThis.XMLHttpRequest === 'undefined') {
    globalThis.XMLHttpRequest = class XhrDisque {
        open(method, url) { this.file = basename(String(url).split('?')[0]); }
        send() {
            try { this.responseText = readFileSync(join(GAME_ROOT, this.file), 'utf8'); this.status = 200; } catch { this.status = 404; }
        }
    };
}

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));
const asJson = flags.has('--json');

if (flags.has('--help') || (!flags.has('--all') && positional.length === 0)) {
    console.log('Usage : node tools/map-preview.mjs <screenId> [--json] [--routes] [--no-entities]\n        node tools/map-preview.mjs --all [--json]');
    process.exit(flags.has('--help') ? 0 : 1);
}

const { SCREENS } = await import(new URL('../story.js', import.meta.url).href);
const { connectionRows } = await import(new URL('../mapConnections.js', import.meta.url).href);

const key = (x, y) => `${x},${y}`;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);
const isOutdoor = s => !s.interior && !s.arena && s.kind !== 'house' && !s.underground;

// Terrain bloquant : obstacle, liquide (sauf écran aquatique : l'eau se parcourt), hors carte.
const blockedAt = (s, x, y) => x < 0 || y < 0 || x >= s.w || y >= s.h || inRects(s.obstacles, x, y) || (!s.aquatic && inRects(s.liquids, x, y));

function analyse(s, screens) {
    const passages = connectionRows(screens, s).map(r => ({ x: r.x, y: r.y, to: r.to, edge: r.edge, span: r.span, requires: r.requires }));
    const exits = [...s.exits.map(e => ({ x: e.x, y: e.y, to: e.to, door: Boolean(e.door), edge: e.edge, requires: e.requires })), ...passages.map(p => ({ ...p, passage: true }))];
    const entities = [
        ...s.npcs.map(e => ({ kind: 'npc', ch: 'N', id: e.id, x: e.x, y: e.y })),
        ...s.chests.map(e => ({ kind: 'chest', ch: 'C', id: e.id, x: e.x, y: e.y })),
        ...s.enemies.map(e => ({
            kind: 'enemy', ch: e.boss || e.guardsDoor ? 'B' : 'E', id: e.id, x: e.x, y: e.y, patrol: e.patrol || null,
            boss: Boolean(e.boss), guardsDoor: Boolean(e.guardsDoor), perm: Boolean(e.permanent)
        })),
        ...(s.waypoint ? [{ kind: 'waypoint', ch: 'W', id: 'pierre', x: s.waypoint.x, y: s.waypoint.y }] : [])
    ];

    // Atteignabilité à pied depuis l'apparition : les entités et sorties (portes, entrées) bloquent, sauf un gardien de porte.
    const solid = new Set([...entities.filter(e => !e.guardsDoor), ...s.exits].map(e => key(e.x, e.y)));
    solid.delete(key(s.spawn.x, s.spawn.y));
    const seen = new Set([key(s.spawn.x, s.spawn.y)]);
    const queue = [s.spawn];
    while (queue.length) {
        const p = queue.shift();
        for (const [dx, dy] of DIRS) {
            const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
            if (seen.has(k) || blockedAt(s, nx, ny) || solid.has(k)) continue;
            seen.add(k); queue.push({ x: nx, y: ny });
        }
    }
    const touches = e => seen.has(key(e.x, e.y)) || DIRS.some(([dx, dy]) => seen.has(key(e.x + dx, e.y + dy)));
    const unreachable = [
        ...entities.filter(e => !touches(e)).map(e => ({ what: e.kind, id: e.id, x: e.x, y: e.y })),
        ...s.exits.filter(e => !touches(e)).map(e => ({ what: e.door ? 'porte' : 'sortie', id: e.to, x: e.x, y: e.y })),
        ...passages.filter(p => !seen.has(key(p.x, p.y)) && !touches(p)).map(p => ({ what: 'passage', id: `${p.edge}→${p.to}`, x: p.x, y: p.y }))
    ];

    // Statistiques
    let walkable = 0;
    let grassCells = 0;
    const grassSet = new Set();
    (s.grass?.cells || []).forEach(([rx, ry, rw, rh]) => { for (let x = rx; x < rx + rw; x++) for (let y = ry; y < ry + rh; y++) grassSet.add(key(x, y)); });
    for (let x = 0; x < s.w; x++) for (let y = 0; y < s.h; y++) {
        if (blockedAt(s, x, y)) continue;
        walkable++;
        if (grassSet.has(key(x, y))) grassCells++;
    }
    const enemies = entities.filter(e => e.kind === 'enemy');
    const stats = {
        w: s.w, h: s.h, cells: s.w * s.h, native: Boolean(s.native),
        walkable, walkablePct: round1(100 * walkable / (s.w * s.h)),
        grassCells, grassPct: round1(walkable ? 100 * grassCells / walkable : 0),
        reachablePct: round1(walkable ? 100 * seen.size / walkable : 0),
        enemies: enemies.length, patrols: enemies.filter(e => e.patrol).length, bosses: enemies.filter(e => e.boss || e.guardsDoor).length,
        chests: s.chests.length, npcs: s.npcs.length, exits: s.exits.filter(e => !e.door).length, doors: s.exits.filter(e => e.door).length,
        passages: passages.length, waypoint: Boolean(s.waypoint)
    };
    return { entities, exits, passages, unreachable, stats, seen, grassSet };
}
const round1 = n => Math.round(n * 10) / 10;

function render(s, a, options = {}) {
    const cells = Array.from({ length: s.h }, (_, y) => Array.from({ length: s.w }, (_, x) => {
        if (inRects(s.obstacles, x, y)) return '#';
        if (inRects(s.liquids, x, y)) return '~';
        if (a.grassSet.has(key(x, y))) return '"';
        if (inRects(s.paths, x, y)) return '=';
        return '.';
    }));
    (s.buildings || []).forEach(b => {
        for (let x = b.x; x < b.x + b.w; x++) for (let y = b.y; y < b.y + b.h; y++) cells[y][x] = b.id;
        cells[b.door.y][b.door.x] = b.id.toLowerCase();
    });
    if (options.routes) {
        s.enemies.filter(e => e.patrol).forEach(e => {
            let cur = null;
            e.patrol.forEach(([tx, ty], i) => {
                if (i === 0) { cur = { x: tx, y: ty }; return; }
                while (cur.x !== tx || cur.y !== ty) {
                    if (cur.x !== tx) cur.x += Math.sign(tx - cur.x); else cur.y += Math.sign(ty - cur.y);
                    if (cells[cur.y]?.[cur.x] === '.' || cells[cur.y]?.[cur.x] === '"') cells[cur.y][cur.x] = ':';
                }
            });
        });
    }
    const put = (x, y, ch) => { if (cells[y]?.[x] !== undefined) cells[y][x] = ch; };
    a.exits.forEach(e => { if (!e.door) put(e.x, e.y, 'X'); });
    a.entities.forEach(e => put(e.x, e.y, e.ch));
    put(s.spawn.x, s.spawn.y, cells[s.spawn.y][s.spawn.x] === '.' || cells[s.spawn.y][s.spawn.x] === '"' ? 'S' : cells[s.spawn.y][s.spawn.x]);

    // Règles de coordonnées : dizaines (tous les 10) puis unités en haut ; numéro de rangée à gauche et à droite.
    const pad = String(s.h - 1).length;
    const margin = ' '.repeat(pad + 2);
    let tens = '';
    for (let x = 0; x < s.w; x++) tens += x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ';
    const lines = [
        `${margin}${tens}`,
        `${margin}${Array.from({ length: s.w }, (_, x) => x % 10).join('')}`,
        ...cells.map((r, y) => `${String(y).padStart(pad, '0')}  ${r.join('')}  ${String(y).padStart(pad, '0')}`),
        `${margin}${Array.from({ length: s.w }, (_, x) => x % 10).join('')}`
    ];
    return { lines, rows: cells.map(r => r.join('')) };
}

function describeOne(id) {
    const s = SCREENS[id];
    if (!s) {
        const near = Object.keys(SCREENS).filter(k => k.includes(id) || id.includes(k) || k.startsWith(id.slice(0, 3))).slice(0, 12);
        console.error(`Écran inconnu : ${id}${near.length ? `\nProches : ${near.join(', ')}` : ''}`);
        process.exit(1);
    }
    const a = analyse(s, SCREENS);
    const view = render(s, a, { routes: flags.has('--routes') });
    if (asJson) {
        console.log(JSON.stringify({
            id: s.id, name: s.name, region: s.region, kind: s.kind || 'sanctuary', biome: s.biome, spawn: s.spawn,
            grid: view.rows, stats: a.stats, entities: a.entities.map(({ ch, ...e }) => e),
            exits: a.exits, unreachable: a.unreachable
        }, null, 2));
        return;
    }
    const st = a.stats;
    console.log(`${s.id} — ${s.name} (${s.region}, ${s.kind || 'sanctuaire'}, biome ${s.biome})${s.native ? ' [native]' : ''}`);
    console.log(`Apparition S en (${s.spawn.x}, ${s.spawn.y}). Coordonnées : x = colonne (règle du haut), y = rangée (règle de gauche).\n`);
    view.lines.forEach(l => console.log(l));
    console.log('\nLégende : # obstacle · ~ liquide · = chemin · " hautes herbes · . sol · A-H bâtiment (porte en minuscule) · N PNJ · C coffre'
        + ' · E ennemi · B boss/gardien · X sortie ou passage · W pierre de voyage · S apparition' + (flags.has('--routes') ? ' · : trajet de patrouille' : ''));
    console.log('\nStatistiques');
    console.log(`  taille          ${st.w} x ${st.h} = ${st.cells} cases${st.native ? ' (native, limite 1500 / 64 de côté)' : ''}`);
    console.log(`  franchissable   ${st.walkablePct} % (${st.walkable} cases)`);
    console.log(`  hautes herbes   ${st.grassPct} % des cases franchissables (${st.grassCells} cases)`);
    console.log(`  atteignable     ${st.reachablePct} % des cases franchissables, depuis l'apparition`);
    console.log(`  ennemis         ${st.enemies} (dont ${st.patrols} patrouilleur(s), ${st.bosses} boss/gardien(s))`);
    console.log(`  coffres ${st.chests} · PNJ ${st.npcs} · sorties ${st.exits} · portes ${st.doors} · passages de bord ${st.passages} · pierre de voyage ${st.waypoint ? 'oui' : 'non'}`);
    if (!flags.has('--no-entities')) {
        console.log('\nEntités');
        a.entities.forEach(e => {
            const extra = [e.patrol ? `patrouille ${e.patrol.map(p => `(${p[0]},${p[1]})`).join('→')}` : '', e.boss ? 'boss' : '', e.guardsDoor ? 'garde une porte' : ''].filter(Boolean).join(', ');
            console.log(`  ${e.ch} ${e.id.padEnd(28)} (${e.x}, ${e.y})${extra ? `  ${extra}` : ''}`);
        });
        a.exits.filter(e => !e.passage || e.span === 0).forEach(e => {
            console.log(`  X ${(e.door ? 'porte ' : e.passage ? `${e.edge} ` : 'sortie ') + '→ ' + e.to}`.padEnd(32) + ` (${e.x}, ${e.y})${e.requires ? `  verrou : ${e.requires}` : ''}`);
        });
    }
    console.log('');
    if (a.unreachable.length) {
        console.log(`AVERTISSEMENT : ${a.unreachable.length} élément(s) inatteignable(s) à pied depuis l'apparition :`);
        a.unreachable.forEach(u => console.log(`  - ${u.what} ${u.id} en (${u.x}, ${u.y})`));
    } else {
        console.log('Atteignabilité : toutes les entités, sorties et passages sont atteignables à pied.');
    }
}

function describeAll() {
    const rows = Object.values(SCREENS).filter(isOutdoor).map(s => {
        const a = analyse(s, SCREENS);
        return { id: s.id, region: s.region, ...a.stats, unreachable: a.unreachable.length };
    });
    if (asJson) { console.log(JSON.stringify(rows, null, 2)); return; }
    const head = ['écran', 'taille', 'natif', 'franch.%', 'herbe%', 'ennemis', 'patr.', 'coffres', 'PNJ', 'inatt.'];
    const fmt = r => [r.id, `${r.w}x${r.h}`, r.native ? 'oui' : '', r.walkablePct, r.grassPct, r.enemies, r.patrols, r.chests, r.npcs, r.unreachable || ''].map(String);
    const table = [head, ...rows.map(fmt)];
    const widths = head.map((_, i) => Math.max(...table.map(r => r[i].length)));
    table.forEach((r, i) => {
        console.log(r.map((c, j) => (j === 0 ? c.padEnd(widths[j]) : c.padStart(widths[j]))).join('  '));
        if (i === 0) console.log(widths.map(w => '-'.repeat(w)).join('  '));
    });
    const warn = rows.filter(r => r.unreachable);
    console.log(`\n${rows.length} écrans de plein air${warn.length ? `, ${warn.length} avec éléments inatteignables : ${warn.map(r => r.id).join(', ')}` : ', aucun élément inatteignable'}.`);
}

if (flags.has('--all')) describeAll();
else describeOne(positional[0]);
