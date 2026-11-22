// Points de récupération des PV en exploration : au plus UN par zone.
//  - pierre de voyage (« point de téléport ») : toute zone qui en possède une soigne déjà au toucher ;
//  - auberge : une couche d'hôte dans une maison par région ;
//  - fontaine : sur les routes, qui n'ont pas de pierre.
// Les emplacements sont calculés à la création de la session (déterministes, rien n'est sauvegardé ni écrit dans le monde).
import { isTerrainBlocked, isGrassCell, isLowObstacle } from './exploration.js';
import { occupiedCells } from './mapConnections.js';

export const REST_KINDS = {
    inn: { name: "Couche d'hôte", message: 'Une nuit de repos : vos PV sont rétablis.' },
    fountain: { name: 'Fontaine de jade', message: "L'eau claire vous ranime : vos PV sont rétablis." },
    teleport: { name: 'Pierre de voyage', message: 'La pierre vous réchauffe : vos PV sont rétablis.' }
};

// Maison-auberge de chaque région (la couche d'hôte est dans cet intérieur).
export const INN_HOUSES = {
    rizieres: 'rizieres_h_lin', volcan: 'volcan_h_cantine', gobi: 'gobi_h_bains', fleuve: 'fleuve_h_gu', bambous: 'bambous_h_the',
    tonnerre: 'tonnerre_h_auberge', fauves: 'fauves_h_zi', mer: 'mer_h_marin', fusang: 'fusang_h_chambre', marees: 'marees_h_cormoran', lune: 'lune_h_veilleuse'
};

const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x, y) => `${x},${y}`;

// Nature du point de repos d'une zone, ou null. Une zone avec pierre de voyage n'en reçoit pas d'autre.
export function restKindOf(screen) {
    if (screen.waypoint) return 'teleport';
    if (Object.values(INN_HOUSES).includes(screen.id)) return 'inn';
    if (screen.kind === 'wild' && /_road$/.test(screen.id)) return 'fountain';
    return null;
}

function reachableCount(screen, from, blocked, extra) {
    const seen = new Set([key(from.x, from.y)]);
    const queue = [from];
    while (queue.length) {
        const c = queue.pop();
        for (const [dx, dy] of FOUR) {
            const x = c.x + dx, y = c.y + dy, k = key(x, y);
            if (seen.has(k) || blocked.has(k) || extra === k || isTerrainBlocked(screen, x, y)) continue;
            seen.add(k);
            queue.push({ x, y });
        }
    }
    return seen.size;
}

// Case libre proche du centre de la zone, loin des bords, du départ et des sorties, qui ne coupe aucun passage.
export function placeRest(screen) {
    const taken = occupiedCells(screen);
    const near = (x, y, list, r) => list.some(e => Math.abs(e.x - x) <= r && Math.abs(e.y - y) <= r);
    const around = [screen.spawn, ...(screen.exits || [])];
    const base = reachableCount(screen, screen.spawn, taken, null);
    const cx = screen.w / 2, cy = screen.h / 2;
    const cells = [];
    for (let y = 2; y < screen.h - 2; y++) for (let x = 2; x < screen.w - 2; x++) {
        if (taken.has(key(x, y)) || isTerrainBlocked(screen, x, y) || isGrassCell(screen, x, y) || isLowObstacle(screen, x, y)) continue;
        if (near(x, y, around, 2)) continue;
        if (FOUR.filter(([dx, dy]) => !isTerrainBlocked(screen, x + dx, y + dy)).length < 3) continue;
        cells.push({ x, y, d: Math.hypot(x - cx, y - cy) });
    }
    cells.sort((a, b) => a.d - b.d);
    for (const c of cells.slice(0, 40)) {
        if (reachableCount(screen, screen.spawn, taken, key(c.x, c.y)) === base - 1) return { x: c.x, y: c.y };
    }
    return null;
}

/** { [screenId]: { x, y, kind, name } } pour les auberges et fontaines (les pierres de voyage restent `screen.waypoint`). */
export function buildRestPoints(screens) {
    const rest = {};
    Object.values(screens).forEach(screen => {
        const kind = restKindOf(screen);
        if (!kind || kind === 'teleport' || screen.rest) return;
        const p = placeRest(screen);
        if (p) rest[screen.id] = { ...p, kind, name: REST_KINDS[kind].name };
    });
    return rest;
}

export const restOf = (session, screen) => (session.rt.changeMode ? null : session.rest?.[screen.id] || null);
