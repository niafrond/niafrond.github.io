// Les trois modes d'énigme livrés : pousser des caisses (push), refléter la lumière (mirror), faire sortir un bloc (slide).
import { registerMode, DIRS } from './engine.js';

const COLORS = { ink: '#2a1a0e', wall: '#4b3a2c', floor: '#d9c39a', floorAlt: '#cfb88c', gold: '#e8b73a', red: '#c0392b', jade: '#2f8f6b', light: '#ffe27a', sky: '#7aa6c9' };
const BLOCK_COLORS = ['#6b7f9a', '#8a6a4b', '#5d8a6b', '#8a5d7d', '#9a8a4b', '#4b7f8a'];
const floorCell = (x, y) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${(x + y) % 2 ? COLORS.floorAlt : COLORS.floor}"/>`;
const wallCell = (x, y) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${COLORS.wall}"/><rect x="${x + 0.08}" y="${y + 0.08}" width="0.84" height="0.84" fill="none" stroke="#6a5642" stroke-width="0.06"/>`;
const rows = level => level.grid;

// ── Pousser : le héros pousse des caisses (une seule à la fois) sur les cibles ─────────────────────────────
// Grille : # mur · . sol · @ héros · $ caisse · * cible · + héros sur cible · ! caisse sur cible · espace = sol
const push = {
    init(level) {
        const g = rows(level), walls = [], boxes = [], targets = [];
        let player = null;
        g.forEach((row, y) => [...row].forEach((c, x) => {
            const i = y * g[0].length + x;
            if (c === '#') walls.push(i);
            if (c === '$' || c === '!') boxes.push(i);
            if (c === '*' || c === '+' || c === '!') targets.push(i);
            if (c === '@' || c === '+') player = i;
        }));
        return { w: g[0].length, h: g.length, walls: new Set(walls), targets, boxes, player };
    },
    size: s => ({ w: s.w, h: s.h }),
    dir(s, d) {
        const [dx, dy] = DIRS[d];
        const px = s.player % s.w, py = (s.player / s.w) | 0;
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) return null;
        const to = ny * s.w + nx;
        if (s.walls.has(to)) return null;
        const bi = s.boxes.indexOf(to);
        let boxes = s.boxes;
        if (bi >= 0) {
            const bx = nx + dx, by = ny + dy;
            if (bx < 0 || by < 0 || bx >= s.w || by >= s.h) return null;
            const beyond = by * s.w + bx;
            if (s.walls.has(beyond) || s.boxes.includes(beyond)) return null;
            boxes = s.boxes.slice();
            boxes[bi] = beyond;
        }
        return { state: { ...s, boxes, player: to }, move: true };
    },
    // Un appui pousse le héros d'un pas vers la case touchée (selon l'axe le plus éloigné).
    tap(s, x, y) {
        const dx = x - (s.player % s.w), dy = y - ((s.player / s.w) | 0);
        if (!dx && !dy) return null;
        return push.dir(s, Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    },
    won: s => s.targets.every(t => s.boxes.includes(t)),
    key: s => `${s.player}|${[...s.boxes].sort((a, b) => a - b).join(',')}`,
    successors: s => Object.keys(DIRS).map(d => push.dir(s, d)).filter(Boolean).map(r => r.state),
    render(s) {
        let out = '';
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) out += s.walls.has(y * s.w + x) ? wallCell(x, y) : floorCell(x, y);
        s.targets.forEach(t => { const x = t % s.w, y = (t / s.w) | 0; out += `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.2" fill="none" stroke="${COLORS.red}" stroke-width="0.07"/><circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.06" fill="${COLORS.red}"/>`; });
        s.boxes.forEach(b => {
            const x = b % s.w, y = (b / s.w) | 0, on = s.targets.includes(b);
            out += `<rect x="${x + 0.1}" y="${y + 0.1}" width="0.8" height="0.8" rx="0.08" fill="${on ? COLORS.jade : COLORS.gold}" stroke="${COLORS.ink}" stroke-width="0.06"/><path d="M${x + 0.1} ${y + 0.1}L${x + 0.9} ${y + 0.9}M${x + 0.9} ${y + 0.1}L${x + 0.1} ${y + 0.9}" stroke="${COLORS.ink}" stroke-width="0.05" opacity="0.5"/>`;
        });
        const px = s.player % s.w, py = (s.player / s.w) | 0;
        out += `<circle cx="${px + 0.5}" cy="${py + 0.5}" r="0.32" fill="${COLORS.sky}" stroke="${COLORS.ink}" stroke-width="0.06"/><circle cx="${px + 0.4}" cy="${py + 0.44}" r="0.05" fill="${COLORS.ink}"/><circle cx="${px + 0.6}" cy="${py + 0.44}" r="0.05" fill="${COLORS.ink}"/>`;
        return out;
    }
};

// ── Miroirs : orienter des miroirs pour que le rayon atteigne toutes les cibles ────────────────────────────
// Grille : # mur · . vide · > < ^ v source (direction d'émission) · T cible · / \ miroir tournant (un appui le bascule)
//          a b miroirs fixes (/ et \) · * séparateur (le rayon continue et un second part en « / »)
const REFLECT = { '/': ([dx, dy]) => [-dy, -dx], '\\': ([dx, dy]) => [dy, dx] };
const SOURCES = { '>': [1, 0], '<': [-1, 0], '^': [0, -1], v: [0, 1] };

/** Trace les rayons : renvoie les cases éclairées (clé "x,y" → segments pour le dessin) et les cibles atteintes. */
export function traceBeams(s) {
    const segs = [], hit = new Set(), seen = new Set();
    const cellAt = (x, y) => (x < 0 || y < 0 || x >= s.w || y >= s.h) ? '#' : s.cells[y * s.w + x];
    const rays = [[s.source.x, s.source.y, ...SOURCES[s.source.dir]]];
    while (rays.length) {
        let [x, y, dx, dy] = rays.pop();
        for (let step = 0; step < 200; step++) {
            const key = `${x},${y},${dx},${dy}`;
            if (seen.has(key)) break;
            seen.add(key);
            const nx = x + dx, ny = y + dy;
            const c = cellAt(nx, ny);
            segs.push([x + 0.5, y + 0.5, nx + 0.5, ny + 0.5]);
            if (c === '#' || SOURCES[c]) { segs[segs.length - 1] = [x + 0.5, y + 0.5, nx + 0.5 - dx * 0.5, ny + 0.5 - dy * 0.5]; break; }
            x = nx; y = ny;
            if (c === 'T') { hit.add(`${x},${y}`); break; }
            const m = c === 'a' ? '/' : c === 'b' ? '\\' : c;
            if (REFLECT[m]) { [dx, dy] = REFLECT[m]([dx, dy]); continue; }
            if (c === '*') { const [rx, ry] = REFLECT['/']([dx, dy]); rays.push([x, y, rx, ry]); }
        }
    }
    return { segs, hit };
}

const mirror = {
    init(level) {
        const g = rows(level), cells = [];
        let source = null;
        g.forEach((row, y) => [...row].forEach((c, x) => {
            if (SOURCES[c]) { source = { x, y, dir: c }; cells.push(c); } else cells.push(c === ' ' ? '.' : c);
        }));
        return { w: g[0].length, h: g.length, cells, source, targets: cells.flatMap((c, i) => c === 'T' ? [i] : []) };
    },
    size: s => ({ w: s.w, h: s.h }),
    tap(s, x, y) {
        const i = y * s.w + x, c = s.cells[i];
        if (c !== '/' && c !== '\\') return null;
        const cells = s.cells.slice();
        cells[i] = c === '/' ? '\\' : '/';
        return { state: { ...s, cells }, move: true };
    },
    won(s) { const { hit } = traceBeams(s); return s.targets.every(t => hit.has(`${t % s.w},${(t / s.w) | 0}`)); },
    key: s => s.cells.join(''),
    successors: s => s.cells.flatMap((c, i) => (c === '/' || c === '\\') ? [mirror.tap(s, i % s.w, (i / s.w) | 0).state] : []),
    render(s) {
        const { segs, hit } = traceBeams(s);
        let out = '';
        s.cells.forEach((c, i) => {
            const x = i % s.w, y = (i / s.w) | 0;
            out += c === '#' ? wallCell(x, y) : floorCell(x, y);
        });
        out += `<g stroke="${COLORS.light}" stroke-width="0.14" stroke-linecap="round" opacity="0.9">${segs.map(([a, b, c, d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`).join('')}</g>`;
        s.cells.forEach((c, i) => {
            const x = i % s.w, y = (i / s.w) | 0, cx = x + 0.5, cy = y + 0.5;
            if (c === '/' || c === 'a' || c === '\\' || c === 'b') {
                const slash = c === '/' || c === 'a', fixed = c === 'a' || c === 'b';
                out += `<line x1="${x + (slash ? 0.15 : 0.15)}" y1="${y + (slash ? 0.85 : 0.15)}" x2="${x + 0.85}" y2="${y + (slash ? 0.15 : 0.85)}" stroke="${fixed ? '#8a8a8a' : '#bfe6ff'}" stroke-width="0.16" stroke-linecap="round"/><line x1="${x + 0.15}" y1="${y + (slash ? 0.85 : 0.15)}" x2="${x + 0.85}" y2="${y + (slash ? 0.15 : 0.85)}" stroke="${COLORS.ink}" stroke-width="0.04"/>`;
            } else if (c === '*') {
                out += `<rect x="${x + 0.2}" y="${y + 0.2}" width="0.6" height="0.6" transform="rotate(45 ${cx} ${cy})" fill="#dff3ff" stroke="${COLORS.ink}" stroke-width="0.05" opacity="0.9"/>`;
            } else if (c === 'T') {
                const lit = hit.has(`${x},${y}`);
                out += `<circle cx="${cx}" cy="${cy}" r="0.3" fill="${lit ? COLORS.light : '#6b4f8a'}" stroke="${COLORS.ink}" stroke-width="0.06"/>${lit ? `<circle cx="${cx}" cy="${cy}" r="0.42" fill="none" stroke="${COLORS.light}" stroke-width="0.05"/>` : ''}`;
            } else if (SOURCES[c]) {
                const [dx, dy] = SOURCES[c];
                out += `<circle cx="${cx}" cy="${cy}" r="0.34" fill="${COLORS.gold}" stroke="${COLORS.ink}" stroke-width="0.06"/><path d="M${cx + dx * 0.3} ${cy + dy * 0.3}L${cx - dy * 0.15} ${cy + dx * 0.15}L${cx + dy * 0.15} ${cy - dx * 0.15}Z" fill="${COLORS.ink}"/>`;
            }
        });
        return out;
    }
};

// ── Glisser (Rush Hour) : faire sortir le bloc rouge en déplaçant les autres le long de leur axe ───────────
// Niveau : { w, h, exit: { side: 'right'|'left'|'up'|'down', at: ligne ou colonne }, blocks: [{ id, x, y, w, h, hero? }] }
const slide = {
    swipeSelects: true,       // un glissement sur un bloc le choisit puis le déplace
    init: level => ({ ...level, blocks: level.blocks.map(b => ({ ...b })), sel: null }),
    size: s => ({ w: s.w, h: s.h }),
    occupant(s, x, y, ignore) { return s.blocks.find(b => b.id !== ignore && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) || null; },
    // Un bloc long (w>1) ne glisse que horizontalement, un bloc haut (h>1) que verticalement.
    moveBlock(s, id, dx, dy) {
        const b = s.blocks.find(k => k.id === id);
        if (!b || (dx && b.h > 1) || (dy && b.w > 1)) return null;
        const nx = b.x + dx, ny = b.y + dy;
        if (nx < 0 || ny < 0 || nx + b.w > s.w || ny + b.h > s.h) return null;
        for (let y = ny; y < ny + b.h; y++) for (let x = nx; x < nx + b.w; x++) if (slide.occupant(s, x, y, id)) return null;
        return { ...s, blocks: s.blocks.map(k => k.id === id ? { ...k, x: nx, y: ny } : k) };
    },
    dir(s, d) {
        if (!s.sel) return null;
        const [dx, dy] = DIRS[d];
        const next = slide.moveBlock(s, s.sel, dx, dy);
        return next ? { state: next, move: true } : null;
    },
    // Appui : sur un bloc, il est sélectionné ; sur une case libre alignée avec le bloc sélectionné, il glisse jusque-là.
    tap(s, x, y) {
        const hit = slide.occupant(s, x, y, null);
        if (hit) return hit.id === s.sel ? null : { state: { ...s, sel: hit.id }, move: false };
        const b = s.blocks.find(k => k.id === s.sel);
        if (!b) return null;
        const dx = b.h > 1 ? 0 : x < b.x ? -1 : x >= b.x + b.w ? 1 : 0, dy = b.w > 1 ? 0 : y < b.y ? -1 : y >= b.y + b.h ? 1 : 0;
        if ((b.w > 1 && y >= b.y && y < b.y + b.h) || (b.h > 1 && x >= b.x && x < b.x + b.w)) {
            if (!dx && !dy) return null;
            let cur = s, moved = 0;
            for (;;) {
                const nb = cur.blocks.find(k => k.id === b.id);
                if (dx > 0 ? nb.x + nb.w > x : dx < 0 ? nb.x <= x : dy > 0 ? nb.y + nb.h > y : nb.y <= y) break;
                const next = slide.moveBlock(cur, b.id, dx, dy);
                if (!next) break;
                cur = next; moved++;
            }
            return moved ? { state: cur, move: true } : null;
        }
        return null;
    },
    won(s) {
        const h = s.blocks.find(b => b.hero);
        const e = s.exit;
        return e.side === 'right' ? h.x + h.w === s.w : e.side === 'left' ? h.x === 0 : e.side === 'down' ? h.y + h.h === s.h : h.y === 0;
    },
    key: s => s.blocks.map(b => `${b.x},${b.y}`).join(';'),
    successors(s) {
        const out = [];
        s.blocks.forEach(b => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const n = slide.moveBlock(s, b.id, dx, dy); if (n) out.push(n); }));
        return out;
    },
    render(s) {
        let out = '';
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) out += floorCell(x, y);
        const e = s.exit;
        // Ouverture dans le cadre, à l'endroit de la sortie.
        const gate = e.side === 'right' ? [s.w - 0.12, e.at, 0.12, 1] : e.side === 'left' ? [0, e.at, 0.12, 1] : e.side === 'down' ? [e.at, s.h - 0.12, 1, 0.12] : [e.at, 0, 1, 0.12];
        out += `<rect x="${gate[0]}" y="${gate[1]}" width="${gate[2]}" height="${gate[3]}" fill="${COLORS.jade}"/>`;
        s.blocks.forEach((b, i) => {
            const sel = b.id === s.sel;
            out += `<rect x="${b.x + 0.07}" y="${b.y + 0.07}" width="${b.w - 0.14}" height="${b.h - 0.14}" rx="0.12" fill="${b.hero ? COLORS.red : b.color || BLOCK_COLORS[i % BLOCK_COLORS.length]}" stroke="${sel ? COLORS.light : COLORS.ink}" stroke-width="${sel ? 0.12 : 0.06}"/>`;
            if (b.hero) out += `<circle cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" r="0.16" fill="${COLORS.light}" stroke="${COLORS.ink}" stroke-width="0.04"/>`;
        });
        return out;
    }
};
registerMode('push', push);
registerMode('mirror', mirror);
registerMode('slide', slide);
export const MODES = { push, mirror, slide };
