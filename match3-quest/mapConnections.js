// Connexions de bordure entre cartes (« à la Pokémon Rubis / Saphir / Émeraude ») : logique pure, sans DOM.
//
// Vocabulaire du système :
//  - Map                : un écran de `SCREENS` (`{ id, w, h, … }`), indépendant des autres ;
//  - MapConnection      : { from, dir, to, offset | align, requires?, lockedMessage?, oneWay? } (déclarées dans world/connections.js) ;
//  - MapTransitionManager : `crossBorder` (détecte la sortie de carte et calcule l'arrivée), appelé par `tryMove` (exploration.js) ;
//  - WarpTrigger        : les `exit` des écrans (portes, escaliers, grottes : destination + case d'arrivée explicites),
//                         volontairement distincts des connexions de bordure ; `warpOf` les normalise ;
//  - PlayerController   : `tryMove` / `doMove` (exploration.js, explorationView.js).
//
// `range: [min, max]` (facultatif, repère de la carte de départ) restreint le passage à une portion de la bordure
// (passage de 3 cases au milieu d'un rivage, par exemple) ; sans lui, tout le recouvrement des deux cartes est franchissable.
// Décalage (`offset`, en tuiles) : position de l'origine de la carte de destination dans le repère de la carte de départ, le long
// de la bordure (colonne pour le nord / sud, ligne pour l'est / ouest). Un joueur qui sort en x = 7 par le nord d'une carte
// dont la voisine est décalée de 3 arrive en x = 7 − 3 = 4. `align` ('start' | 'center' | 'end') le calcule à partir des tailles
// (offset ajouté si présent). Hors du recouvrement des deux cartes le passage est un mur : on ne sort pas dans le vide.

export const DIRS = {
    north: { dx: 0, dy: -1, opposite: 'south', axis: 'x' },
    south: { dx: 0, dy: 1, opposite: 'north', axis: 'x' },
    west: { dx: -1, dy: 0, opposite: 'east', axis: 'y' },
    east: { dx: 1, dy: 0, opposite: 'west', axis: 'y' }
};

export const dirOfStep = (dx, dy) => Object.keys(DIRS).find(d => DIRS[d].dx === dx && DIRS[d].dy === dy) || null;

const lengthAlong = (screen, dir) => (DIRS[dir].axis === 'x' ? screen.w : screen.h);

// Décalage effectif d'une connexion (tuiles) selon `offset` et `align`.
export function offsetOf(conn, from, to) {
    const a = lengthAlong(from, conn.dir);
    const b = lengthAlong(to, conn.dir);
    const base = conn.align === 'center' ? Math.floor((a - b) / 2) : conn.align === 'end' ? a - b : 0;
    return base + (conn.offset || 0);
}

// Intervalle (le long de la bordure, repère de la carte de départ) où l'on peut passer : [min, max] inclus, ou null.
export function overlapOf(conn, from, to) {
    const off = offsetOf(conn, from, to);
    const min = Math.max(0, off, conn.range ? conn.range[0] : 0);
    const max = Math.min(lengthAlong(from, conn.dir), off + lengthAlong(to, conn.dir), conn.range ? conn.range[1] + 1 : Infinity) - 1;
    return min <= max ? [min, max] : null;
}

// Connexion inverse (même passage vu depuis l'autre carte) : décalage opposé.
export function reverseOf(conn, from, to) {
    const { requires, lockedMessage, label, sea } = conn;
    const off = offsetOf(conn, from, to);
    const rev = { from: conn.to, dir: DIRS[conn.dir].opposite, to: conn.from, offset: -off, requires, lockedMessage, label, sea, derived: true };
    if (conn.range) rev.range = [conn.range[0] - off, conn.range[1] - off];
    return rev;
}

// Erreurs de configuration d'une liste de connexions (tableau de messages ; vide = valide).
export function validateConnections(screens, list) {
    const errors = [];
    const seen = new Set();
    for (const c of list) {
        const name = `${c.from}.${c.dir}→${c.to}`;
        const a = screens[c.from], b = screens[c.to];
        if (!DIRS[c.dir]) { errors.push(`${name} : direction inconnue`); continue; }
        if (!a || !b) { errors.push(`${name} : carte inconnue`); continue; }
        if (c.from === c.to) errors.push(`${name} : une carte ne se connecte pas à elle-même`);
        if (!overlapOf(c, a, b)) errors.push(`${name} : les cartes ne se recouvrent pas (décalage hors bordure)`);
        const k = `${c.from}/${c.dir}`;
        if (seen.has(k)) errors.push(`${name} : direction déjà connectée`);
        seen.add(k);
    }
    return errors;
}

// Pose `screen.connections = { north?, south?, east?, west? }` sur chaque carte à partir de la liste déclarative.
// Chaque connexion est bidirectionnelle sauf `oneWay: true` ; une connexion explicite l'emporte sur la déduite.
export function applyConnections(screens, list) {
    const errors = validateConnections(screens, list);
    if (errors.length) throw new Error(`Connexions de cartes invalides :\n${errors.join('\n')}`);
    for (const s of Object.values(screens)) s.connections = {};
    const explicit = new Set(list.map(c => `${c.from}/${c.dir}`));
    for (const c of list) {
        screens[c.from].connections[c.dir] = { ...c };
        const r = reverseOf(c, screens[c.from], screens[c.to]);
        if (!c.oneWay && !explicit.has(`${r.from}/${r.dir}`)) {
            if (screens[r.from].connections[r.dir]) throw new Error(`Connexions de cartes invalides :\n${r.from}.${r.dir} : direction déjà connectée`);
            screens[r.from].connections[r.dir] = r;
        }
    }
    return screens;
}

const key = (x, y) => `${x},${y}`;

// Cases occupées d'une carte (entités, sorties, pierre de voyage) : on n'y arrive jamais.
export function occupiedCells(screen) {
    const cells = new Set();
    for (const e of [...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []), ...(screen.exits || [])]) cells.add(key(e.x, e.y));
    if (screen.waypoint) cells.add(key(screen.waypoint.x, screen.waypoint.y));
    return cells;
}

// Case d'arrivée : un pas à l'intérieur de la bordure d'entrée, à la même position relative ; si elle est bloquée, la plus proche case libre
// de cette rangée, puis les rangées `depth` plus à l'intérieur.
export function arrivalCell(conn, from, to, x, y, isBlocked, depth = 2) {
    const d = DIRS[conn.dir];
    const along = (d.axis === 'x' ? x : y) - offsetOf(conn, from, to);
    const len = lengthAlong(to, conn.dir);
    const taken = occupiedCells(to);
    for (let inward = 1; inward <= depth + 1; inward++) {   // un pas à l'intérieur : jamais sur une case de bordure ouverte (pas de rebond)
        for (let shift = 0; shift < len; shift++) {
            for (const a of shift ? [along - shift, along + shift] : [along]) {
                if (a < 0 || a >= len) continue;
                // Arrivée sur la bordure opposée à la direction de sortie, `inward` cases à l'intérieur.
                const cx = d.axis === 'x' ? a : d.dx > 0 ? inward : to.w - 1 - inward;
                const cy = d.axis === 'y' ? a : d.dy > 0 ? inward : to.h - 1 - inward;
                if (!isBlocked(to, cx, cy) && !taken.has(key(cx, cy))) return { x: cx, y: cy };
            }
        }
    }
    return null;
}

/**
 * Gestionnaire de transition de bordure : le joueur est en (x, y) sur `screen` et tente le pas (dx, dy) qui sort de la carte.
 * Retourne null (pas de connexion ni de passage : mur), ou { conn, to, x, y, dir } ; `conn` est renvoyée même si la case
 * d'arrivée est introuvable (x = y = null) pour que l'appelant puisse refuser proprement.
 */
export function crossBorder(screens, screen, x, y, dx, dy, isBlocked) {
    const dir = dirOfStep(dx, dy);
    const conn = dir && screen.connections?.[dir];
    const to = conn && screens[conn.to];
    if (!conn || !to) return null;
    const range = overlapOf(conn, screen, to);
    const pos = DIRS[dir].axis === 'x' ? x : y;
    if (!range || pos < range[0] || pos > range[1]) return null;
    const cell = arrivalCell(conn, screen, to, x, y, isBlocked);
    return { conn, to: conn.to, dir, x: cell ? cell.x : null, y: cell ? cell.y : null };
}

// WarpTrigger : destination et case d'arrivée explicites d'une sortie (porte, escalier, entrée de grotte).
export const warpOf = exit => (exit && exit.to ? { to: exit.to, x: exit.arrive?.x, y: exit.arrive?.y, door: Boolean(exit.door) } : null);

const borderCell = (screen, dir, along) => (dir === 'north' ? { x: along, y: 0 } : dir === 'south' ? { x: along, y: screen.h - 1 }
    : dir === 'west' ? { x: 0, y: along } : { x: screen.w - 1, y: along });

// Les connexions d'une carte sous forme de « sorties » repères { to, x, y, label, requires, lockedMessage, edge, connection } :
// case de bordure au milieu du passage (guidage de quête, flèche d'affichage). Elles ne sont pas franchissables comme des `exits`.
export function connectionMarkers(screens, screen) {
    return Object.entries(screen.connections || {}).flatMap(([dir, c]) => {
        const to = screens[c.to];
        const range = to && overlapOf(c, screen, to);
        if (!range) return [];
        const { x, y } = borderCell(screen, dir, Math.floor((range[0] + range[1]) / 2));
        return [{ to: c.to, x, y, label: c.label || to.name, requires: c.requires, lockedMessage: c.lockedMessage, edge: dir, connection: true }];
    });
}

/**
 * Migration des passages de bord (rangées de sorties `edge` / `span` de world/expand.js) vers des connexions : retire ces sorties
 * des cartes et retourne les connexions équivalentes (même portion de bordure, même alignement, mêmes verrous). Les portes,
 * escaliers et grottes (sorties sans `edge`) ne sont pas touchés.
 */
export function migrateEdgeExits(screens) {
    const list = [];
    for (const s of Object.values(screens)) {
        const groups = new Map();
        for (const e of s.exits) if (e.edge !== undefined && !e.door && !e.leaveArena) {
            const k = `${e.edge}/${e.to}`;
            (groups.get(k) || groups.set(k, []).get(k)).push(e);
        }
        for (const rows of groups.values()) {
            const centre = rows.find(e => e.span === 0) || rows[0];
            const target = screens[centre.to];
            if (!target || !centre.arrive) continue;
            const axis = DIRS[centre.edge].axis;
            const alongs = rows.map(e => e[axis]);
            const conn = {
                from: s.id, dir: centre.edge, to: centre.to,
                offset: centre[axis] - centre.arrive[axis],
                range: [Math.min(...alongs), Math.max(...alongs)]
            };
            for (const f of ['label', 'requires', 'lockedMessage', 'wall']) if (centre[f] !== undefined) conn[f] = centre[f];
            list.push(conn);
        }
        s.exits = s.exits.filter(e => e.edge === undefined || e.door || e.leaveArena);
    }
    return list;
}

/**
 * Vue « sorties » des connexions d'une carte (une par case de bordure du passage, `span` -1/0/1 autour du centre) avec
 * `arrive` = case d'arrivée libre sur la carte voisine : sert aux outils et aux tests qui raisonnent en cases de sortie.
 * Ces entrées sont des repères : le franchissement réel passe par `crossBorder`.
 */
export function connectionRows(screens, screen) {
    return Object.entries(screen.connections || {}).flatMap(([dir, c]) => {
        const to = screens[c.to];
        const range = to && overlapOf(c, screen, to);
        if (!range) return [];
        const mid = Math.floor((range[0] + range[1]) / 2);
        const rows = [];
        for (let a = range[0]; a <= range[1]; a++) {
            const { x, y } = borderCell(screen, dir, a);
            const cell = arrivalCell(c, screen, to, x, y, (m, cx, cy) => cx < 0 || cy < 0 || cx >= m.w || cy >= m.h, 0);   // arrivée théorique (sans collisions)
            rows.push({ to: c.to, x, y, label: c.label || to.name, requires: c.requires, lockedMessage: c.lockedMessage, wall: c.wall, sea: c.sea, edge: dir,
                span: a - mid, arrive: cell, connection: true });
        }
        return rows.sort((p, q) => Math.abs(p.span) - Math.abs(q.span));
    });
}

// Vrai si (x, y) est une case de la bordure du côté `dir`.
export const onSide = (screen, dir, x, y) => (dir === 'north' ? y === 0 : dir === 'south' ? y === screen.h - 1 : dir === 'west' ? x === 0 : x === screen.w - 1);
