// Vie des villages et hameaux : les PNJ se baladent autour de leur place d'origine (pas à pas, avec des pauses).
// Leur position « vivante » est tenue dans `session.rt.villageLife` ; `visibleNpcs` (exploration.js) la lit.
// La donnée de la carte (`screen.npcs`) n'est jamais modifiée : revenir sur la carte les replace près de chez eux.
import { isLowObstacle } from './decor.js';
import { onSide, dirOfStep } from './mapConnections.js';
import { currentScreen, isGrassCell, isTerrainBlocked } from './exploration.js';

const FOUR = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ROAM = 3;   // rayon max (en cases) autour de la place d'origine
const RIM = 3;    // bande de bord (passages vers les cartes voisines) : on n'y traîne pas

const isVillageScreen = s => s.kind === 'village' || /_(village|hamlet)$/.test(s.id || '');
// PNJ qui restent à leur poste : marchands, géants, ceux qui défilent déjà (accourent) ou liés à une scène.
const stays = n => n.merchant || n.span || n.stay || n.injured || n.ambient;

function stepOpen(screen, x, y, dx, dy) {
    const nx = x + dx, ny = y + dy;
    if (nx < RIM || ny < RIM || nx >= screen.w - RIM || ny >= screen.h - RIM) return false;
    if (isTerrainBlocked(screen, nx, ny)) return false;
    if ((screen.structures || []).some(st => nx >= st.x && nx < st.x + st.w && ny >= st.y && ny < st.y + st.h)) return false;
    if ((screen.buildings || []).some(b => nx >= b.x && nx < b.x + b.w && ny >= b.y && ny < b.y + b.h)) return false;
    if ((screen.exits || []).some(e => e.x === nx && e.y === ny)) return false;
    const dir = screen.connections && dirOfStep(dx, dy);
    if (dir && screen.connections[dir] && onSide(screen, dir, nx, ny)) return false;
    return !isGrassCell(screen, nx, ny) && !isLowObstacle(screen, nx, ny);
}

/** Fait avancer les PNJ promeneurs du village courant. Renvoie true si l'un d'eux a bougé. */
export function stepVillageLife(session, dtMs, rng = Math.random, frozenIds = []) {
    const screen = currentScreen(session);
    const rt = session.rt;
    if (rt.changeMode || !isVillageScreen(screen)) { rt.villageLife = null; return false; }
    if (!rt.villageLife || rt.villageLife.screenId !== screen.id) {
        rt.villageLife = { screenId: screen.id, clock: 0, walkers: new Map() };
        (screen.npcs || []).filter(n => !stays(n)).forEach((n, i) => {
            rt.villageLife.walkers.set(n.id, { ...n, hx: n.x, hy: n.y, wanders: true, next: 600 + i * 450 });
        });
    }
    const life = rt.villageLife;
    life.clock += Math.max(0, dtMs);
    const all = [...life.walkers.values()];
    const fixed = (screen.npcs || []).filter(n => !life.walkers.has(n.id));
    const blocked = new Set([...fixed, ...(screen.chests || []), ...(screen.spots || []), screen.waypoint, screen.spawn].filter(Boolean).map(e => `${e.x},${e.y}`));
    let moved = false;
    for (const w of all) {
        if (life.clock < w.next || frozenIds.includes(w.id)) continue;
        w.next = life.clock + 1800 + rng() * 4200;
        if (Math.max(Math.abs(w.x - session.data.x), Math.abs(w.y - session.data.y)) <= 1) continue;   // reste en place près du héros
        for (const [dx, dy] of [...FOUR].sort(() => rng() - 0.5)) {
            const nx = w.x + dx, ny = w.y + dy;
            if (Math.hypot(nx - w.hx, ny - w.hy) > ROAM || !stepOpen(screen, w.x, w.y, dx, dy)) continue;
            if (blocked.has(`${nx},${ny}`) || (nx === session.data.x && ny === session.data.y)) continue;
            if (all.some(o => o !== w && o.x === nx && o.y === ny)) continue;
            w.x = nx; w.y = ny; w.face = { dx, dy };
            moved = true;
            break;
        }
    }
    return moved;
}
