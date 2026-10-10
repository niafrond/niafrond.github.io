// Générateur des Soleils-Boss en pixel art (sprites/cn/suns.js) et de la tuile « soleil ardent » (sprites/tiles/tile-skull.svg).
// Style : disque ombré à visage expressif, couronne de rayons pointus, contour sombre d'un pixel, reflets (voir SPECS.md).
// Chaque sprite est dessiné sur une grille 64 x 64 puis émis en SVG autonome (rectangles nets, shape-rendering="crispEdges").
// Relancer :  node match3-quest/sprites/gen-suns.mjs            (réécrit suns.js et tile-skull.svg)
//             node match3-quest/sprites/gen-suns.mjs --preview <dossier>   (en plus : planche PNG agrandie)
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

const N = 64;
const OUT = '#2b1b17';
const W = '#ffffff';

class Img {
    constructor(n = N) { this.n = n; this.p = new Array(n * n).fill(null); }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.n && y < this.n) this.p[y * this.n + x] = c; }
    get(x, y) { return x < 0 || y < 0 || x >= this.n || y >= this.n ? null : this.p[y * this.n + x]; }
}

// Remplit un polygone (centres de pixels) ; fn(x, y) renvoie la couleur (ou null pour ne rien poser).
function poly(img, pts, fn) {
    const ys = pts.map(p => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(img.n - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
            const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
            if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
            for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) {
                const c = typeof fn === 'function' ? fn(x, y) : fn;
                if (c) img.set(x, y, c);
            }
        }
    }
}
const centroid = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const shrink = (pts, k) => { const [cx, cy] = centroid(pts); return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };

// Forme avec contour sombre intérieur : contour plein puis cœur réduit.
function blob(img, pts, fill, k = 0.72) {
    poly(img, pts, OUT);
    poly(img, shrink(pts, k), fill);
}

function disc(img, cx, cy, r, fn) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) { const c = fn(x, y); if (c) img.set(x, y, c); }
    }
}
function ell(img, cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) { const c = typeof fn === 'function' ? fn(x, y) : fn; if (c) img.set(x, y, c); }
    }
}
function line(img, x0, y0, x1, y1, c, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
        for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < w; dy++) img.set(x + dx - (w - 1) / 2 + 0, y + dy - (w - 1) / 2 + 0, c);
    }
}
function bitmap(img, rows, ox, oy, map) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch === '.' || ch === ' ') return;
        const c = map[ch] === undefined ? null : map[ch];
        if (c) img.set(ox + i, oy + j, c);
    }));
}

// ── briques ─────────────────────────────────────────────────────────────
// Rayons pointus autour du disque. ramp : couleurs claire → sombre ; la lumière vient du haut gauche.
function spikes(img, { cx, cy, n, rIn: r0, rOut, off = 0, ramp, rim }) {
    const half = Math.PI / n * 0.92, rIn = r0 + 4;   // rayons larges, joints à la base
    const L = Math.atan2(-1, -0.7);
    for (let k = 0; k < n; k++) {
        const a = off + k * 2 * Math.PI / n;
        const ro = typeof rOut === 'function' ? rOut(k) : rOut;
        const tip = [cx + ro * Math.cos(a), cy + ro * Math.sin(a)];
        const bl = [cx + rIn * Math.cos(a - half), cy + rIn * Math.sin(a - half)];
        const br = [cx + rIn * Math.cos(a + half), cy + rIn * Math.sin(a + half)];
        const pts = [bl, tip, br];
        const g = Math.cos(a - L);
        const base = g > 0.55 ? 0 : g > -0.1 ? 1 : g > -0.6 ? 2 : 3;
        poly(img, pts, rim || OUT);
        const inner = shrink(pts, 0.74);
        const ax = Math.cos(a), ay = Math.sin(a);
        poly(img, inner, (x, y) => {
            const side = ax * (y + 0.5 - cy) - ay * (x + 0.5 - cx);   // côté du rayon
            const lit = Math.cos(a + Math.PI / 2 - L) > 0 ? side > 0 : side < 0;   // la moitié tournée vers la lumière
            return ramp[Math.min(ramp.length - 1, base + (lit ? 0 : 1))];
        });
    }
}

// Disque ombré (lumière en haut à gauche) avec liseré sombre et reflet.
function body(img, { cx, cy, r, ramp, hl = '#ffffff', ring = OUT }) {
    const hx = cx - r * 0.38, hy = cy - r * 0.42;
    disc(img, cx, cy, r, (x, y) => {
        const d = Math.hypot(x + 0.5 - hx, y + 0.5 - hy) / (2 * r);
        const i = d < 0.30 ? 0 : d < 0.52 ? 1 : d < 0.76 ? 2 : 3;
        return ramp[Math.min(i, ramp.length - 1)];
    });
    disc(img, cx, cy, r, (x, y) => (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) >= r - 1 ? ring : null));
    ell(img, cx - r * 0.45, cy - r * 0.58, 2.6, 1.5, hl);
    img.set(cx - r * 0.45 + 3, cy - r * 0.58 + 2, hl);
}

function eye(img, ex, ey, { iris, sclera = W, look = 0, w = 6, h = 5, pupil = OUT }) {
    // contour arrondi
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
        const corner = (i === -1 || i === w) && (j === -1 || j === h);
        if (!corner) img.set(ex + i, ey + j, OUT);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.set(ex + i, ey + j, sclera);
    const ix = ex + 1 + look;
    for (let j = 0; j < h; j++) for (let i = 0; i < w - 2; i++) img.set(ix + i, ey + j, iris);
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < 3; i++) img.set(ix + i, ey + j, pupil);
    img.set(ix, ey, W);   // reflet
}
function brows(img, cx, ey, dx, { c = OUT, tilt = 3, y = -4, w = 7 }) {
    for (const s of [-1, 1]) {
        const ex = cx + s * dx;
        const outer = [ex + s * 3, ey + y - tilt + 1], inner = [ex - s * 3, ey + y + 1];
        line(img, outer[0], outer[1], inner[0], inner[1], c, 2);
    }
}
const cheeks = (img, cx, ey, dx, c) => { for (const s of [-1, 1]) { const x = cx + s * (dx + 3) - 1; ell(img, x + 0.5, ey + 5.5, 2, 1.2, c); } };

const MOUTHS = {
    fangs: ['.ooooooooo.', 'orwrrrrrwro', 'orwrrrrrwro', '.orrtttrro.', '..orttrro..', '...ooooo...'],
    smile: ['o.....o', '.ooooo.'],
    grin: ['ooooooooooo', 'owwwwwwwwwo', 'orrrrrrrrro', '.orrrrrrro.', '..ooooooo..'],
    lava: ['ooooooooooo', 'orrrrrrrrro', 'orooorooror', '.orrrrrrro.', '..ooooooo..'],
    smirk: ['.........o', '..ooooooo.', 'ooo.......']
};
function mouth(img, kind, x, y, colors) {
    bitmap(img, MOUTHS[kind], x, y, { o: OUT, w: W, ...colors });
}

// ── passe finale : contour extérieur d'un pixel ─────────────────────────────
function outline(img) {
    const add = [];
    for (let y = 0; y < img.n; y++) for (let x = 0; x < img.n; x++) {
        if (img.get(x, y)) continue;
        if (img.get(x + 1, y) || img.get(x - 1, y) || img.get(x, y + 1) || img.get(x, y - 1)) add.push([x, y]);
    }
    add.forEach(([x, y]) => img.set(x, y, OUT));
}

// ── émission SVG ─────────────────────────────────────────────────────────
function toSvg(img, { scale = 1 } = {}) {
    const n = img.n;
    const used = new Array(n * n).fill(false);
    const byColor = new Map();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const c = img.get(x, y);
        if (!c || used[y * n + x]) continue;
        let w = 1;
        while (x + w < n && img.get(x + w, y) === c && !used[y * n + x + w]) w++;
        let h = 1;
        outer: while (y + h < n) {
            for (let i = 0; i < w; i++) if (img.get(x + i, y + h) !== c || used[(y + h) * n + x + i]) break outer;
            h++;
        }
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) used[(y + j) * n + x + i] = true;
        if (!byColor.has(c)) byColor.set(c, []);
        byColor.get(c).push(`M${x} ${y}h${w}v${h}h-${w}z`);
    }
    const body = [...byColor.entries()].map(([c, ds]) => `<path fill="${c}" d="${ds.join('')}"/>`).join('');
    const inner = scale === 1 ? body : `<g transform="scale(${scale})">${body}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges">${inner}</svg>`;
}

// Réduit d'un facteur 2 (couleur dominante du bloc, le contour l'emporte à égalité) : tuile 32 x 32 affichée à l'échelle 2.
function half(img) {
    const out = new Img(img.n / 2);
    for (let y = 0; y < out.n; y++) for (let x = 0; x < out.n; x++) {
        const cs = [img.get(2 * x, 2 * y), img.get(2 * x + 1, 2 * y), img.get(2 * x, 2 * y + 1), img.get(2 * x + 1, 2 * y + 1)].filter(Boolean);
        if (cs.length < 2) continue;
        const cnt = new Map();
        cs.forEach(c => cnt.set(c, (cnt.get(c) || 0) + 1));
        let best = null;
        for (const [c, k] of cnt) if (!best || k > best[1] || (k === best[1] && c === OUT)) best = [c, k];
        out.set(x, y, best[0]);
    }
    return out;
}

// ── les soleils ───────────────────────────────────────────────────────────
const C = 32;
const GOLD_RAYS = ['#ffe27a', '#ffc23a', '#f0901c', '#b9560f'];

function sun1() {   // Soleil Ardent : rouge-orangé, crête de feu, gueule à crocs
    const img = new Img();
    // boules de flamme aux pieds
    for (const [x, y, r] of [[10, 47, 4.2], [54, 47, 4.2], [14, 53, 3.4], [50, 53, 3.4]]) {
        ell(img, x, y, r, r, OUT); ell(img, x, y, r - 1, r - 1, (px, py) => (px < x - 1 && py < y - 1 ? '#ffd45a' : '#f58a22'));
    }
    spikes(img, { cx: C, cy: 30, n: 14, rIn: 11, rOut: k => (k % 2 ? 24 : 29), half: 0.25, off: -Math.PI / 2 + 0.11, ramp: GOLD_RAYS });
    body(img, { cx: C, cy: 30, r: 17, ramp: ['#ffb040', '#fb7a2a', '#e24a22', '#b02a1c'] });
    // crête rouge
    poly(img, [[30, 14], [32, 9], [34, 14], [32, 17]], '#d6281c');
    brows(img, C, 29, 7, { c: '#7a1f12' });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 27, { iris: '#b5420f', look: 0 });
    cheeks(img, C, 27, 7, '#ff8a6a');
    mouth(img, 'fangs', 27, 36, { r: '#7a1428', t: '#ff7a8a' });
    outline(img);
    return img;
}

function sun2() {   // Soleil des Eaux Taries : or terreux craquelé
    const img = new Img();
    spikes(img, { cx: C, cy: 31, n: 16, rIn: 11, rOut: k => (k % 2 ? 24 : 30), half: 0.25, off: -Math.PI / 2 + 0.1, ramp: ['#ffe070', '#f5b83a', '#d58f22', '#9a6014'] });
    body(img, { cx: C, cy: 31, r: 17, ramp: ['#e6b845', '#cf9a30', '#a8741c', '#7d5214'], hl: '#fbe9a0' });
    // craquelures de terre sèche
    const crack = '#6b4310';
    for (const pts of [[[22, 22], [24, 26], [23, 29]], [[40, 21], [38, 25], [41, 28]], [[30, 43], [32, 40], [31, 38]], [[22, 38], [25, 36]], [[41, 39], [38, 36]]]) {
        for (let i = 0; i + 1 < pts.length; i++) line(img, ...pts[i], ...pts[i + 1], crack);
    }
    brows(img, C, 29, 7, { c: '#4a2c0c' });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 27, { iris: '#8a4a10', sclera: '#fff3d0' });
    cheeks(img, C, 27, 7, '#d98a50');
    mouth(img, 'fangs', 27, 36, { r: '#5e3410', t: '#a05a22' });
    outline(img);
    return img;
}

function sun3() {   // Soleil de Cendres : disque de cendre, éclats de roche, deux piliers de bambou calciné
    const img = new Img();
    for (const x of [3, 56]) {   // piliers
        for (let y = 9; y < 56; y++) for (let i = 0; i < 5; i++) img.set(x + i, y, i === 0 ? '#6a6a76' : i < 3 ? '#44444f' : '#2c2c35');
        for (let i = 0; i < 5; i++) { img.set(x + i, 9, OUT); img.set(x + i, 55, OUT); }
        for (const y of [22, 36]) for (let i = 0; i < 5; i++) img.set(x + i, y, OUT);
        img.set(x + 1, 12, '#9a9aa8'); img.set(x + 1, 13, '#9a9aa8');
    }
    // roches autour du disque
    const rock = ['#c28a58', '#9a6840', '#6e4628'];
    const rocks = [[14, 22, 6], [49, 20, 6], [11, 38, 5], [53, 36, 6], [20, 51, 5], [44, 52, 5], [32, 12, 5], [24, 14, 4], [41, 13, 4]];
    rocks.forEach(([x, y, r], i) => {
        const pts = [[x - r, y], [x - r * 0.4, y - r * 0.9], [x + r * 0.5, y - r], [x + r, y + r * 0.1], [x + r * 0.4, y + r * 0.9], [x - r * 0.6, y + r * 0.7]];
        poly(img, pts, OUT);
        poly(img, shrink(pts, 0.7), (px, py) => (px + py < x + y - r * 0.3 ? rock[0] : px + py < x + y + r * 0.6 ? rock[1] : rock[2]));
    });
    // débris flottants
    for (const [x, y] of [[8, 12], [14, 8], [50, 8], [56, 14], [6, 48], [57, 50], [34, 57], [26, 6]]) { img.set(x, y, '#9a6840'); img.set(x + 1, y, '#9a6840'); img.set(x, y + 1, '#6e4628'); img.set(x + 1, y + 1, '#6e4628'); }
    body(img, { cx: C, cy: 33, r: 15, ramp: ['#8d8d9a', '#686874', '#474750', '#2f2f38'], hl: '#c4c4d0' });
    brows(img, C, 31, 6, { c: '#1a1a22', tilt: 2 });
    for (const s of [-1, 1]) eye(img, C + s * 6 - 3, 29, { iris: '#ff5a1c', sclera: '#ffb04a' });
    cheeks(img, C, 29, 6, '#e06a38');
    mouth(img, 'smile', 29, 38, {});
    outline(img);
    return img;
}

function sun4() {   // Soleil des Mirages : disque nacré, reflets scintillants, anneau fantôme
    const img = new Img();
    // anneau fantôme (pointillé) et scintillements
    for (let a = 0; a < 360; a += 7) { const x = C + 29 * Math.cos(a * Math.PI / 180), y = 32 + 29 * Math.sin(a * Math.PI / 180); img.set(x, y, a % 14 ? '#9ad4ee' : '#ffe9a0'); }
    spikes(img, { cx: C, cy: 32, n: 14, rIn: 10, rOut: k => (k % 2 ? 20 : 25), half: 0.25, off: -Math.PI / 2 + 0.11, ramp: ['#fff2b8', '#ffdc7a', '#f0b84a', '#c8902c'] });
    body(img, { cx: C, cy: 32, r: 16, ramp: ['#fffaf0', '#ffefc4', '#f6d88c', '#e0b862'], hl: W });
    brows(img, C, 30, 7, { c: '#7a5a1a', tilt: 0, y: -3 });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 29, { iris: '#e0a020', sclera: '#fffdf4', w: 6, h: 4 });
    cheeks(img, C, 28, 7, '#ffb4b0');
    mouth(img, 'smile', 29, 38, {});
    for (const [x, y] of [[6, 8], [57, 12], [58, 55], [5, 56], [58, 28]]) {   // étoiles à quatre branches
        img.set(x, y, W); img.set(x - 1, y, '#ffe9a0'); img.set(x + 1, y, '#ffe9a0'); img.set(x, y - 1, '#ffe9a0'); img.set(x, y + 1, '#ffe9a0');
    }
    outline(img);
    return img;
}

function sun5() {   // Soleil des Orages : disque jaune électrique, nuées violettes, éclairs
    const img = new Img();
    const cloud = ['#a46ad8', '#7e44b8', '#56288e'];
    for (const pts of [[[2, 8], [20, 4], [30, 16], [14, 24], [3, 20]], [[62, 8], [44, 4], [34, 16], [50, 24], [61, 20]], [[3, 46], [18, 36], [28, 50], [14, 60], [4, 56]], [[61, 46], [46, 36], [36, 50], [50, 60], [60, 56]]]) {
        poly(img, pts, OUT);
        const [cx0, cy0] = centroid(pts);
        poly(img, shrink(pts, 0.8), (x, y) => (x + y < cx0 + cy0 - 4 ? cloud[0] : x + y < cx0 + cy0 + 6 ? cloud[1] : cloud[2]));
    }
    spikes(img, { cx: C, cy: 32, n: 12, rIn: 11, rOut: k => (k % 2 ? 22 : 26), half: 0.27, off: -Math.PI / 2 + 0.13, ramp: ['#fff27a', '#ffd92a', '#e8a810', '#b27208'] });
    body(img, { cx: C, cy: 32, r: 16, ramp: ['#fff6a0', '#ffe238', '#f2b814', '#c88a0a'], hl: W });
    // éclairs
    const bolt = (pts, w = 2) => { for (let i = 0; i + 1 < pts.length; i++) { line(img, ...pts[i], ...pts[i + 1], OUT, w + 2); } for (let i = 0; i + 1 < pts.length; i++) line(img, ...pts[i], ...pts[i + 1], '#fff06a', w); };
    bolt([[52, 4], [48, 12], [53, 12], [49, 20]]);
    bolt([[8, 40], [13, 36], [11, 44], [16, 42], [10, 54]]);
    bolt([[50, 50], [54, 44], [52, 52], [58, 48], [54, 58]]);
    brows(img, C, 30, 7, { c: '#3a1a6a' });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 28, { iris: '#7a40d8' });
    mouth(img, 'grin', 27, 36, { r: '#2a2a8a' });
    outline(img);
    return img;
}

function sun6() {   // Soleil de Magma : croûte de basalte, failles de lave, mâchoire en fusion
    const img = new Img();
    spikes(img, { cx: C, cy: 32, n: 12, rIn: 11, rOut: k => (k % 2 ? 24 : 30), half: 0.27, off: -Math.PI / 2 + 0.13, ramp: ['#8a5a3a', '#5c3a2a', '#3c2420', '#2a1814'], rim: '#ff8a1c' });
    body(img, { cx: C, cy: 32, r: 17, ramp: ['#74646c', '#51434a', '#3a2f36', '#2a2128'], hl: '#a89aa4' });
    const lava = '#ff8a1c', hot = '#ffd04a';
    for (const pts of [[[24, 20], [27, 23], [25, 27]], [[40, 19], [38, 23], [41, 26]], [[19, 33], [22, 36], [20, 40]], [[45, 34], [42, 38], [44, 41]], [[32, 44], [35, 46], [33, 48]]]) {
        for (let i = 0; i + 1 < pts.length; i++) { line(img, ...pts[i], ...pts[i + 1], lava); }
        img.set(...pts[1], hot);
    }
    brows(img, C, 30, 7, { c: '#140e10' });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 28, { iris: '#ffd21a', sclera: '#3a2f36' });
    mouth(img, 'lava', 27, 37, { r: '#ff7a1a' });
    outline(img);
    return img;
}

function sun7() {   // Soleil des Bêtes Folles : crinière de lion, museau, pattes griffues
    const img = new Img();
    // deux couronnes de crinière
    spikes(img, { cx: C, cy: 30, n: 16, rIn: 13, rOut: 29, half: 0.27, off: -Math.PI / 2, ramp: ['#ffc23a', '#f0901c', '#d86a14', '#9a420c'] });
    spikes(img, { cx: C, cy: 30, n: 16, rIn: 11, rOut: 24, half: 0.25, off: -Math.PI / 2 + Math.PI / 16, ramp: ['#ffe27a', '#ffb02a', '#f07a18', '#b8480c'] });
    // pattes
    for (const s of [-1, 1]) {
        const x = C + s * 11;
        ell(img, x, 55, 5.5, 3.6, OUT); ell(img, x, 55, 4.5, 2.7, s < 0 ? '#f58a2a' : '#d8681c');
        for (const k of [-2, 0, 2]) { img.set(x + k, 58, W); img.set(x + k, 59, '#d8d0c0'); }
    }
    body(img, { cx: C, cy: 30, r: 16, ramp: ['#c88040', '#a9602a', '#82431c', '#5e2f14'], hl: '#e6b070' });
    // museau
    ell(img, C, 38, 8, 5.2, OUT); ell(img, C, 38, 7, 4.2, '#f2c89c');
    poly(img, [[29, 33], [35, 33], [32, 36]], OUT);
    line(img, 32, 36, 32, 38, OUT); line(img, 28, 40, 32, 38, OUT); line(img, 36, 40, 32, 38, OUT);
    for (const s of [-1, 1]) { img.set(32 + s * 3, 40, W); img.set(32 + s * 3, 41, W); }
    brows(img, C, 28, 7, { c: '#2a1208' });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 26, { iris: '#ffd21a', sclera: '#e8b84a' });
    outline(img);
    return img;
}

function sun8() {   // Soleil des Marées : disque orange, cornes blanches, coquillages, vague
    const img = new Img();
    spikes(img, { cx: C, cy: 30, n: 14, rIn: 11, rOut: k => (k % 2 ? 22 : 27), half: 0.25, off: -Math.PI / 2 + 0.11, ramp: ['#ffb040', '#fb7a2a', '#e24a22', '#a8321a'] });
    // cornes
    for (const s of [-1, 1]) {
        const x = C + s * 14;
        poly(img, [[x - s * 2, 14], [x + s * 5, 3], [x + s * 6, 6], [x + s * 1, 17]], OUT);
        poly(img, [[x - s * 1, 14], [x + s * 4, 5], [x + s * 4, 7], [x + s * 0, 16]], W);
    }
    // coquillages sur les côtés
    for (const s of [-1, 1]) {
        const x = C + s * 24;
        ell(img, x, 36, 4.4, 7, OUT); ell(img, x, 36, 3.4, 6, '#fbdcb0');
        for (const k of [-3, 0, 3]) line(img, x, 32 + k + 3, x + s * 0, 33 + k + 4, '#e0a070');
    }
    body(img, { cx: C, cy: 30, r: 16, ramp: ['#ff9a54', '#f57030', '#d84c1c', '#a8321a'], hl: '#ffd4a8' });
    brows(img, C, 28, 7, { c: '#6a1a0c' });
    for (const s of [-1, 1]) eye(img, C + s * 7 - 3, 26, { iris: '#2a7ae0' });
    mouth(img, 'smirk', 27, 36, {});
    // vague
    const wave = [];
    for (let x = 3; x < 61; x++) wave.push([x, 47 + Math.round(2 * Math.sin(x * 0.45))]);
    for (let y = 44; y < 62; y++) for (let x = 3; x < 61; x++) {
        const top = 47 + Math.round(2 * Math.sin(x * 0.45));
        const edge = Math.abs(x - 32) / 29;
        if (y >= top && y < 60 - Math.round(edge * edge * 8)) img.set(x, y, y < top + 1 ? W : y < top + 4 ? '#58b4f0' : y < top + 8 ? '#2f84d8' : '#1d5cb0');
    }
    for (const [x, y] of [[12, 52], [24, 54], [40, 52], [50, 54], [32, 50]]) { img.set(x, y, W); img.set(x + 1, y, W); img.set(x + 2, y + 1, '#c8ecff'); }
    outline(img);
    return img;
}

function sun9() {   // Soleil Lâche : pâle, yeux écarquillés, gouttes de sueur, tremblements
    const img = new Img();
    spikes(img, { cx: C, cy: 32, n: 14, rIn: 11, rOut: k => (k % 2 ? 22 : 27), half: 0.25, off: -Math.PI / 2 + 0.11, ramp: ['#fff0a0', '#ffd860', '#f0b040', '#c08428'] });
    body(img, { cx: C, cy: 32, r: 16, ramp: ['#fff2b4', '#ffe080', '#f6c04c', '#d49a30'], hl: W });
    // tremblements
    for (const s of [-1, 1]) for (const k of [0, 1, 2]) { const x = C + s * 29 + (k % 2 ? s : 0); img.set(x, 20 + k * 4, '#ffe9a0'); img.set(x, 21 + k * 4, '#ffe9a0'); }
    // sourcils inquiets (inclinés vers le haut au centre)
    for (const s of [-1, 1]) line(img, C + s * 4, 24, C + s * 10, 26, '#7a4a10', 2);
    for (const s of [-1, 1]) {
        const ex = C + s * 7 - 3;
        eye(img, ex, 27, { iris: '#4a90d8', sclera: W, w: 6, h: 6, look: s });
    }
    cheeks(img, C, 27, 7, '#ff9a90');
    // bouche tremblante
    bitmap(img, ['.o.o.o.o.', 'o.o.o.o.o'], 28, 39, { o: OUT });
    // gouttes de sueur
    for (const [x, y] of [[47, 22], [16, 24]]) { bitmap(img, ['.b.', 'bbb', 'bbb', '.b.'], x, y, { b: '#7ac8f4' }); img.set(x + 1, y + 1, W); }
    outline(img);
    return img;
}

// Tuile « soleil ardent » (dégâts) : visage de soleil sans décor, version 32 x 32 agrandie ×2.
function tile() {
    const img = new Img();
    spikes(img, { cx: C, cy: 32, n: 12, rIn: 12, rOut: k => (k % 2 ? 25 : 30), half: 0.27, off: -Math.PI / 2 + 0.13, ramp: GOLD_RAYS });
    body(img, { cx: C, cy: 32, r: 19, ramp: ['#ffb040', '#fb7a2a', '#e24a22', '#b02a1c'] });
    for (const s of [-1, 1]) eye(img, C + s * 8 - 3, 29, { iris: '#b5420f' });
    mouth(img, 'fangs', 27, 38, { r: '#7a1428', t: '#ff7a8a' });
    outline(img);
    return half(img);
}

export const SUNS = { sun_1: sun1, sun_2: sun2, sun_3: sun3, sun_4: sun4, sun_5: sun5, sun_6: sun6, sun_7: sun7, sun_8: sun8, sun_9: sun9 };

// ── aperçu PNG (agrandi) ───────────────────────────────────────────────────
function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
    return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, rgba) {
    const chunk = (type, data) => {
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const td = Buffer.concat([Buffer.from(type), data]);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
        return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function sheet(imgs, scale = 6, cols = 5) {
    const rows = Math.ceil(imgs.length / cols), S = N * scale, w = cols * S, h = rows * S;
    const buf = Buffer.alloc(w * h * 4);
    imgs.forEach((img, i) => {
        const ox = (i % cols) * S, oy = Math.floor(i / cols) * S;
        const bg = (i % 2 ? [226, 205, 150] : [58, 36, 30]);
        const k = img.n === N ? 1 : N / img.n;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const c = img.get(Math.floor(x / scale / k), Math.floor(y / scale / k));
            const rgb = c ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : bg;
            const o = ((oy + y) * w + ox + x) * 4;
            buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2]; buf[o + 3] = 255;
        }
    });
    return png(w, h, buf);
}

if (process.argv[1] && process.argv[1].endsWith('gen-suns.mjs')) {
    const imgs = Object.values(SUNS).map(f => f());
    const t = tile();
    const pi = process.argv.indexOf('--preview');
    if (pi > 0) {
        mkdirSync(process.argv[pi + 1], { recursive: true });
        writeFileSync(`${process.argv[pi + 1]}/suns.png`, sheet([...imgs, t]));
    }
    if (!process.argv.includes('--no-write')) {
        const entries = Object.keys(SUNS).map((k, i) => `  ${k}: \`${toSvg(imgs[i])}\``).join(',\n');
        writeFileSync(new URL('./cn/suns.js', import.meta.url),
`// Illustrations SVG pixel art : les neuf Soleils-Boss (sun_1 a sun_9) et trois betes embrasees.
// Fichier genere par sprites/gen-suns.mjs (ne pas modifier a la main) : rectangles nets sur grille 64 x 64, contour #2b1b17,
// sans texte ni ressource externe.
export { BEAST_SPRITES } from './beasts.js';

export const SUN_SPRITES = {
${entries}
};
`);
        writeFileSync(new URL('./tiles/tile-skull.svg', import.meta.url), toSvg(t, { scale: 2 }) + '\n');
    }
    console.log('tailles :', imgs.map(i => toSvg(i).length).join(' '), '| tuile', toSvg(t, { scale: 2 }).length);
}
