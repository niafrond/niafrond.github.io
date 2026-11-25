// Patrouilleurs des eaux et des coulées : sur les cartes de plein air qui ont une nappe d'eau ou de lave assez longue, une ou deux créatures y font la ronde.
// Le joueur ne peut pas les y rejoindre avant le Pas de Yu ; elles le repèrent en revanche de loin (vigilance de LIQUID_SIGHT cases, à 360°) et viennent à lui
// par leur seule ronde : on ne longe donc pas la rive sans risque. Logique pure, appliquée par `assembleWorld` après le level design ; déterministe (tirage stable selon
// l'identifiant de la carte). Les espèces sont tirées de la table de hautes herbes de la carte (créatures de la région, de son niveau).
// Jamais touchés : bordures, entités et leur voisinage, sorties, apparition, pierres de voyage. Villages, hameaux, cartes marines : aucune ronde.

import { isPopulable, isVillage } from './levelDesign.js';

export const LIQUID_PATROLS_PER_MAP = 2;
export const LIQUID_SIGHT = 3;           // rayon de vigilance (un ennemi normal : 1)
export const LIQUID_RUN_MIN = 5;         // longueur minimale d'une nappe pour y tracer une ronde
export const LIQUID_RUN_MAX = 8;         // longueur maximale d'une ronde
const EDGE = 4;                          // bande de bord laissée libre
const KEEP_OFF = 4;                      // distance (Chebyshev) minimale aux entités, sorties, apparition et pierre de voyage
const SHORE_MIN = 6;                     // cases de rive (franchissables) à portée de la ronde : sinon la vigilance ne sert à rien

const hash = (a, b) => Math.abs(Math.sin(a * 127.1 + b * 311.7) * 43758.5453) % 1;
const seedOf = id => [...id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 9973, 7);
const inRects = (rects, x, y) => (rects || []).some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

export function addLiquidPatrols(screen) {
    if (!isPopulable(screen) || isVillage(screen) || !(screen.liquids || []).length) return screen;
    const table = (screen.grass?.table || []).filter(t => t.templateId && !t.boss);
    if (!table.length) return screen;
    const { w, h } = screen;
    const liquid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && inRects(screen.liquids, x, y) && !inRects(screen.obstacles, x, y);
    const walkable = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !inRects(screen.liquids, x, y) && !inRects(screen.obstacles, x, y);
    const anchors = [...(screen.npcs || []), ...(screen.chests || []), ...(screen.enemies || []), ...(screen.exits || []), ...(screen.waypoint ? [screen.waypoint] : []), ...(screen.spawn ? [screen.spawn] : [])];
    (screen.enemies || []).forEach(e => (e.patrol || []).forEach(p => { if (Array.isArray(p)) anchors.push({ x: p[0], y: p[1] }); }));
    const far = (x, y) => anchors.every(a => Math.max(Math.abs(a.x - x), Math.abs(a.y - y)) >= KEEP_OFF);
    const seed = seedOf(screen.id);

    // nappes candidates : rangées ou colonnes de liquide d'au moins LIQUID_RUN_MIN cases, loin du bord et des entités, avec de la rive à portée
    const candidates = [];
    const scan = (horizontal) => {
        const outer = horizontal ? h : w, inner = horizontal ? w : h;
        for (let o = EDGE; o < outer - EDGE; o++) {
            let start = -1;
            for (let i = EDGE; i <= inner - EDGE; i++) {
                const x = horizontal ? i : o, y = horizontal ? o : i;
                const ok = i < inner - EDGE && liquid(x, y) && far(x, y);
                if (ok && start < 0) start = i;
                if (!ok && start >= 0) {
                    const len = i - start;
                    if (len >= LIQUID_RUN_MIN) candidates.push({ horizontal, o, start, len });
                    start = -1;
                }
            }
        }
    };
    scan(true); scan(false);
    const shoreOf = c => {
        const mid = c.start + Math.floor(c.len / 2);
        const cx = c.horizontal ? mid : c.o, cy = c.horizontal ? c.o : mid;
        let n = 0;
        for (let dy = -LIQUID_SIGHT; dy <= LIQUID_SIGHT; dy++) for (let dx = -LIQUID_SIGHT; dx <= LIQUID_SIGHT; dx++) if (walkable(cx + dx, cy + dy)) n++;
        return n;
    };
    const pool = candidates.filter(c => shoreOf(c) >= SHORE_MIN).map((c, i) => ({ ...c, order: hash(seed, i + c.o * 17 + c.start * 5) }));
    pool.sort((a, b) => a.order - b.order);

    const chosen = [];
    for (const c of pool) {
        if (chosen.length >= LIQUID_PATROLS_PER_MAP) break;
        const len = Math.min(c.len, LIQUID_RUN_MAX);
        const from = c.start + Math.floor(hash(seed, c.o + c.start) * (c.len - len + 1));
        const a = c.horizontal ? { x: from, y: c.o } : { x: c.o, y: from };
        const b = c.horizontal ? { x: from + len - 1, y: c.o } : { x: c.o, y: from + len - 1 };
        // deux rondes proches se gêneraient : au moins 8 cases d'écart
        if (chosen.some(p => Math.max(Math.abs(p.a.x - a.x), Math.abs(p.a.y - a.y)) < 8)) continue;
        chosen.push({ a, b });
    }
    if (!chosen.length) return screen;

    screen.enemies = screen.enemies || [];
    chosen.forEach(({ a, b }, i) => {
        const entry = table[Math.floor(hash(seed, 31 + i) * table.length) % table.length];
        screen.enemies.push({
            id: `${screen.id}_liquid_patrol_${i + 1}`, x: a.x, y: a.y, templateId: entry.templateId, name: entry.name || entry.templateId,
            kind: 'patrol', patrol: [[a.x, a.y], [b.x, b.y]], offset: Number.isInteger(entry.offset) ? entry.offset : 0,
            spriteKey: entry.templateId, sight: LIQUID_SIGHT, allAround: true, liquidPatrol: true
        });
    });
    return screen;
}
