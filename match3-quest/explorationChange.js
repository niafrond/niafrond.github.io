// Mode Chang'e : Chang'e explore son village (places des blessés et des habitants de passage, épisodes, ambiance).
// Extrait de exploration.js (ré-exporté par celui-ci).
import { isLowObstacle } from './decor.js';
import { onSide, dirOfStep } from './mapConnections.js';
import { EPISODES, episodeById } from './change/data.js';
import { START_SCREEN, currentScreen, initScreenRuntime, isGrassCell, isTerrainBlocked, tryMove, visibleNpcs } from './exploration.js';

export const pendingChangeEpisode = session => session.data.change?.pending || null;

// ── Mode Chang'e : Chang'e explore son village (écran de la région, deux régions derrière Hou Yi) et soigne cinq habitants ─────────────
// L'état de Hou Yi (écran, case) est mis de côté dans `data.change.return` ; la fin du mode le replace. Dans le village : aucun ennemi, coffre ni
// herbe de rencontre, pas de compagnon, sorties fermées (`changeStay`) ; les cinq blessés sont des PNJ virtuels (`rt.changeMode.npcs`).
export const inChangeMode = session => Boolean(session.rt?.changeMode);
export const changeEpisodeOf = session => (session.rt.changeMode ? episodeById(session.rt.changeMode.episode) : null);

// ── Places des blessés et des habitants de passage ──────────────────────────────────────────────────────────────────────────────
const CHANGE_RIM = 4;   // bande de bord où se trouvent les passages vers les cartes voisines (couloirs de 3 cases) : jamais de PNJ dedans
const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Pas de (x, y) vers (x + dx, y + dy) possible pour Chang'e : mêmes règles que tryMove en mode Chang'e (terrain, obstacles, sorties, passages de bord).
function stepOpen(screen, x, y, dx, dy) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h) return false;
    if (isTerrainBlocked(screen, nx, ny)) return false;
    if ((screen.structures || []).some(st => nx >= st.x && nx < st.x + st.w && ny >= st.y && ny < st.y + st.h)) return false;
    if (screen.exits.some(e => e.x === nx && e.y === ny)) return false;
    const dir = screen.connections && dirOfStep(dx, dy);
    if (dir && screen.connections[dir] && onSide(screen, dir, nx, ny)) return false;
    return true;
}

// Cases accessibles à pied depuis le départ : { dist: Map "x,y" → pas, cells: liste dans l'ordre du parcours }.
function walkableFrom(screen, from) {
    const dist = new Map([[`${from.x},${from.y}`, 0]]), cells = [[from.x, from.y]];
    for (let i = 0; i < cells.length; i++) {
        const [x, y] = cells[i];
        for (const [dx, dy] of FOUR) {
            const k = `${x + dx},${y + dy}`;
            if (dist.has(k) || !stepOpen(screen, x, y, dx, dy)) continue;
            dist.set(k, dist.get(`${x},${y}`) + 1);
            cells.push([x + dx, y + dy]);
        }
    }
    return { dist, cells };
}

// Une case où un PNJ peut se tenir : loin des bords, sur un sol dégagé (ni haute herbe ni obstacle bas, pas sur le point de passage), avec au moins deux voisines libres.
function standable(screen, walk, x, y) {
    if (x < CHANGE_RIM || y < CHANGE_RIM || x >= screen.w - CHANGE_RIM || y >= screen.h - CHANGE_RIM) return false;
    if (isGrassCell(screen, x, y) || isLowObstacle(screen, x, y)) return false;
    if (screen.waypoint && screen.waypoint.x === x && screen.waypoint.y === y) return false;
    return FOUR.filter(([dx, dy]) => walk.dist.has(`${x + dx},${y + dy}`)).length >= 2;
}

// `count` cases étalées sur le village : chacune maximise sa distance aux ancres (départ, cases déjà prises) ; `minSpawn` : pas du départ, `minGap` : écart aux ancres.
function spreadCells(screen, walk, count, anchors, { minSpawn = 4, minGap = 3 } = {}) {
    const spawn = anchors[0];
    const cands = walk.cells.filter(([x, y]) => walk.dist.get(`${x},${y}`) >= minSpawn && standable(screen, walk, x, y));
    const taken = [], pool = [...anchors];
    for (let n = 0; n < count; n++) {
        let best = null, bd = -1;
        for (const [x, y] of cands) {
            const d = Math.min(...pool.map(([ax, ay]) => Math.hypot(ax - x, ay - y)));
            if (d < minGap) continue;
            if (d > bd + 1e-9 || (Math.abs(d - bd) <= 1e-9 && (y < best[1] || (y === best[1] && x < best[0])))) { bd = d; best = [x, y]; }
        }
        if (!best) break;
        taken.push(best);
        pool.push(best);
    }
    return taken;
}

/** Commence l'épisode : Chang'e arrive dans le village. Renvoie l'écran ou null (épisode ou écran inconnu). */
export function startChangeMode(session, episodeId) {
    const ep = episodeById(episodeId), screen = ep && session.screens[ep.screen];
    if (!ep || !screen || session.rt.changeMode) return null;
    const ch = session.data.change;
    // Épisode déjà terminé : rejeu (par le miroir de la maison). Ses soins sont mis de côté (le Livre des noms les garde) et rendus à la fin ; l'épisode reste « terminé ».
    const replay = ch.done.includes(ep.id);
    if (replay) {
        const ids = ep.injured.map(n => n.id);
        ch.keep = { healed: ids.filter(id => ch.healed.includes(id)), hp: Object.fromEntries(ids.filter(id => ch.hp[id]).map(id => [id, ch.hp[id]])) };
        ch.healed = ch.healed.filter(id => !ids.includes(id));
        ids.forEach(id => { delete ch.hp[id]; });
    } else ch.pending = ep.id;
    ch.return = { screenId: session.data.screenId, x: session.data.x, y: session.data.y };
    const walk = walkableFrom(screen, screen.spawn);
    const spawn = [screen.spawn.x, screen.spawn.y];
    const cells = spreadCells(screen, walk, ep.injured.length, [spawn], { minSpawn: 4, minGap: 4 });
    if (cells.length < ep.injured.length) throw new Error(`village ${screen.id} : pas assez de cases accessibles pour ${ep.injured.length} blessés`);
    const npcs = ep.injured.map((n, i) => {
        const real = screen.npcs.find(r => r.id === n.id);   // son dessin et son étiquette d'origine, mais pas sa place : les blessés sont étalés sur le village
        return { ...(real || {}), id: n.id, x: cells[i][0], y: cells[i][1], name: n.name, title: n.state, injured: true, need: n.need };
    });
    // Habitants de passage : ils se baladent autour de leur case d'attache, à l'écart des blessés
    const homes = spreadCells(screen, walk, (ep.ambient || []).length, [spawn, ...cells], { minSpawn: 2, minGap: 2.5 });
    const ambient = (ep.ambient || []).slice(0, homes.length).map((a, i) => ({
        id: a.id, name: a.name, title: 'Habitant du village', x: homes[i][0], y: homes[i][1], hx: homes[i][0], hy: homes[i][1], ambient: true, next: 700 + i * 650
    }));
    session.rt.changeMode = { episode: ep.id, npcs, ambient, clock: 0, replay };
    session.data.screenId = screen.id;
    session.data.x = screen.spawn.x;
    session.data.y = screen.spawn.y;
    initScreenRuntime(session);
    session.rt.facing = { dx: 0, dy: 1 };
    return screen;
}

/** Fin du mode (épisode terminé ou quitté par le miroir) : Hou Yi retrouve sa place. `done` : tous les blessés sont soignés. */
export function endChangeMode(session, { done = false } = {}) {
    const cm = session.rt.changeMode, ch = session.data.change;
    if (!cm) return null;
    session.rt.changeMode = null;
    if (cm.replay && ch.keep) {   // fin d'un rejeu : on rend les soins mis de côté (plus ceux gagnés pendant le rejeu)
        ch.healed = [...new Set([...ch.healed, ...ch.keep.healed])];
        for (const [k, v] of Object.entries(ch.keep.hp)) if (v > (ch.hp[k] || 0)) ch.hp[k] = v;
        ch.keep = null;
    }
    if (done && !ch.done.includes(cm.episode)) ch.done.push(cm.episode);
    if (done && ch.pending === cm.episode) ch.pending = null;   // un rejeu ne ferme pas un autre épisode resté ouvert
    const back = ch.return && session.screens[ch.return.screenId] ? ch.return : { screenId: START_SCREEN, ...session.screens[START_SCREEN].spawn };
    ch.return = null;
    session.data.screenId = back.screenId;
    session.data.x = back.x;
    session.data.y = back.y;
    initScreenRuntime(session);
    return back;
}

/** Les blessés de l'épisode en cours : [{ id, healed }]. */
export const changeProgress = session => {
    const cm = session.rt.changeMode;
    return cm ? cm.npcs.map(n => ({ id: n.id, healed: session.data.change.healed.includes(n.id) })) : [];
};

/**
 * Fait avancer les habitants de passage de `dtMs` ms : chacun, à intervalles irréguliers, fait un pas vers une case voisine libre sans s'éloigner de plus de
 * 4,5 cases de son attache (jamais sur un blessé, sur Chang'e, sur un autre habitant, en haute herbe ou dans un obstacle bas). Renvoie vrai si l'un d'eux a bougé.
 */
export function stepChangeAmbient(session, dtMs, rng = Math.random) {
    const cm = session.rt.changeMode;
    if (!cm || !cm.ambient.length) return false;
    const screen = currentScreen(session);
    cm.clock += Math.max(0, dtMs);
    let moved = false;
    for (const a of cm.ambient) {
        if (cm.clock < a.next) continue;
        a.next = cm.clock + 1400 + rng() * 2600;
        const dirs = [...FOUR].sort(() => rng() - 0.5);
        for (const [dx, dy] of dirs) {
            const nx = a.x + dx, ny = a.y + dy;
            if (Math.hypot(nx - a.hx, ny - a.hy) > 4.5 || !stepOpen(screen, a.x, a.y, dx, dy)) continue;
            if (isGrassCell(screen, nx, ny) || isLowObstacle(screen, nx, ny)) continue;
            if ((nx === session.data.x && ny === session.data.y) || visibleNpcs(session).some(n => n !== a && n.x === nx && n.y === ny)) continue;
            a.x = nx; a.y = ny; a.face = { dx, dy };
            moved = true;
            break;
        }
    }
    return moved;
}

/** Répliques des habitants de passage : { id, name, line } ou null. */
export const changeAmbientOf = (session, npcId) => {
    const ep = changeEpisodeOf(session);
    return ep?.ambient?.find(a => a.id === npcId) || null;
};

/** Le mode en cours est-il le rejeu d'un épisode déjà terminé ? */
export const changeIsReplay = session => Boolean(session.rt.changeMode?.replay);

/**
 * Ce que propose le miroir de la maison : les épisodes terminés (à revoir), l'épisode resté ouvert (à reprendre) et ceux dont le soleil est déjà
 * abattu mais qui n'ont jamais été joués (parties commencées avant le mode Chang'e : à découvrir).
 * [{ episode, village, kind: 'replay' | 'resume' | 'new' }], dans l'ordre des épisodes ; vide si aucun soleil concerné n'est tombé.
 */
export function changeReplayOptions(session) {
    const ch = session.data.change;
    const unlocked = EPISODES.filter(e => session.data.defeated.includes(e.sun)).map(e => e.id);
    const ids = [...new Set([...ch.done, ...(ch.pending ? [ch.pending] : []), ...unlocked])].sort((a, b) => a - b);
    return ids.map(id => ({ episode: id, village: episodeById(id).village, kind: ch.done.includes(id) ? 'replay' : ch.pending === id ? 'resume' : 'new' }));
}
