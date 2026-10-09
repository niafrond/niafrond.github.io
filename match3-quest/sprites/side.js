// Vues de côté et de dos des sprites (héros, ennemis) : les dessins de base sont de face (viewBox 64x64).
//  - `viewDir(face)` : direction de regard {dx, dy} → 'front' | 'back' | 'left' | 'right' ;
//  - `viewSprite(svg, dir, opts)` : le dessin à utiliser pour cette direction.
// Un dessin de côté / de dos dédié (SIDE_SPRITES / BACK_SPRITES, clé = ce même SVG de face) prime ; à défaut il est dérivé du
// dessin de face : le corps est affiné (profil), le visage (yeux, sourcils, bouche, museau : petits éléments de la zone de la tête)
// est resserré et décalé vers l'avant — ou retiré pour la vue de dos. Dérivation faite dans le navigateur (mesure des formes
// avec getBBox), mise en cache ; hors navigateur le dessin de face est renvoyé tel quel. Le dessin « vers la droite » sert de
// base : « vers la gauche » en est le miroir.

export const SIDE_SPRITES = new Map();   // svg de face → svg de profil (vers la droite), dessiné à la main
export const BACK_SPRITES = new Map();   // svg de face → svg de dos, dessiné à la main

const HEAD_ZONE = [6, 40];      // bandes verticales (viewBox) où l'on cherche le visage
const FEATURE_MAX = [15, 10];   // largeur / hauteur maximales d'un trait de visage
const BODY_SCALE = 0.88;        // affinement du corps vu de profil
const FACE_SQUEEZE = 0.65;      // resserrement horizontal du visage
const FACE_SHIFT = 5.5;         // décalage du visage vers l'avant (avant affinement)

export function viewDir(face) {
    const dx = face?.dx || 0, dy = face?.dy || 0;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy < 0 ? 'back' : 'front';
}

const SHAPES = new Set(['path', 'ellipse', 'circle', 'rect', 'polygon', 'polyline']);
const HIDDEN_PARENTS = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol']);
const inHiddenParent = el => { for (let p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (HIDDEN_PARENTS.has(p.localName)) return true; return false; };

const cache = { back: new Map(), left: new Map(), right: new Map() };

function featuresOf(root) {
    const rootBox = root.getBoundingClientRect();
    const k = 64 / (rootBox.width || 64);
    const out = [];
    root.querySelectorAll('*').forEach(el => {
        if (!SHAPES.has(el.localName) || inHiddenParent(el)) return;
        const r = el.getBoundingClientRect();
        const w = r.width * k, h = r.height * k;
        const cy = (r.top - rootBox.top + r.height / 2) * k;
        if (w <= 0 || h <= 0 || cy < HEAD_ZONE[0] || cy > HEAD_ZONE[1]) return;
        if (w > FEATURE_MAX[0] || h > FEATURE_MAX[1]) return;
        out.push({ el, w, h, cy, cx: (r.left - rootBox.left + r.width / 2) * k });
    });
    return out;
}

function derive(svg, dir, opts) {
    if (typeof document === 'undefined' || typeof DOMParser === 'undefined') return svg;
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'svg' || doc.querySelector('parsererror')) return svg;
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-9999px;top:0;width:64px;height:64px;visibility:hidden;pointer-events:none';
    const live = document.importNode(root, true);
    live.setAttribute('width', '64');
    live.setAttribute('height', '64');
    host.appendChild(live);
    document.body.appendChild(host);
    let feats;
    try { feats = featuresOf(live); } catch { feats = []; } finally { host.remove(); }
    if (!feats.length) return svg;

    // les mêmes éléments, retrouvés dans l'arbre à modifier (même ordre de parcours)
    const all = el => [...el.querySelectorAll('*')];
    const liveAll = all(live), docAll = all(root);
    const mine = feats.map(f => docAll[liveAll.indexOf(f.el)]).filter(Boolean);

    if (dir === 'back') {
        mine.forEach(el => el.remove());
        if (opts?.hair) {
            const skins = new Set(opts.skins || []);
            feats.length && docAll.forEach(el => {
                const fill = el.getAttribute?.('fill');
                if (fill && skins.has(fill.toLowerCase())) el.setAttribute('fill', opts.hair);
            });
        }
    } else {
        mine.forEach(el => {
            const T = `translate(${32 + FACE_SHIFT} 0) scale(${FACE_SQUEEZE} 1) translate(-32 0)`;
            el.setAttribute('transform', `${T} ${el.getAttribute('transform') || ''}`.trim());
        });
        const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(32 0) scale(${BODY_SCALE} 1) translate(-32 0)`);
        [...root.childNodes].forEach(n => {
            if (n.nodeType === 1 && (n.localName === 'defs' || n.localName === 'title')) return;
            g.appendChild(n);
        });
        root.appendChild(g);
    }
    return new XMLSerializer().serializeToString(root);
}

const mirror = svg => svg.replace(/(<svg\b[^>]*>)([\s\S]*)(<\/svg>)\s*$/, (_, open, body, close) =>
    `${open}<g transform="translate(64 0) scale(-1 1)">${body}</g>${close}`);

/**
 * @param {string} svg   dessin de face
 * @param {'front'|'back'|'left'|'right'} dir
 * @param {object} [opts] { hair, skins } : pour la vue de dos d'un personnage, la peau de la tête devient `hair`
 */
export function viewSprite(svg, dir, opts) {
    if (!svg || dir === 'front') return svg;
    const store = cache[dir];
    if (!store) return svg;
    if (store.has(svg)) return store.get(svg);
    let out;
    if (dir === 'back') out = BACK_SPRITES.get(svg) || derive(svg, 'back', opts);
    else {
        const right = SIDE_SPRITES.get(svg) || derive(svg, 'right', opts);
        out = dir === 'left' ? mirror(right) : right;
    }
    store.set(svg, out);
    return out;
}

// Vue de dos du héros : la peau de la tête devient la chevelure.
export const HERO_VIEW_OPTS = { hair: '#1d1a24', skins: ['#f2c59e', '#dca07a'] };
