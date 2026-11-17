// Primitives de dessin de la vue d'exploration : bâtiments, sprites, marqueurs, ombres, portails, étiquettes.
// Extrait de explorationView.js : fabrique appelée une fois par createExplorationView, `env` donne accès à l'état partagé de la vue.
import { pixelSprite } from './sprites/index.js';
import { decorSprite } from './sprites/decor.js';
import { rectGrid } from './explorationGrids.js';
import { drawHouse } from './tilePainter.js';

export function createPainters(env) {
    const { ctx } = env;



    // Maison de village : toit à pignon, murs crème, porte (tuile de la porte), fenêtres, nom du bâtiment.
    // Objets de décor statiques (arbres de bordure, rochers, murs, maisons) : dessinés une seule fois dans un petit canvas hors écran,
    // puis recopiés d'un seul appel par image (au lieu de dizaines de fillRect par objet et par image).
    const rimCache = new WeakMap();
    // Case de l'étendue hors terrain d'une carte agrandie (`screen.rimTrees`, world/enlarge.js) : arbre de bordure plutôt que décor isolé.
    function isRimTree(screen, x, y) {
        if (!screen.rimTrees) return false;
        let grid = rimCache.get(screen.rimTrees);
        if (!grid) { grid = rectGrid(screen, screen.rimTrees); rimCache.set(screen.rimTrees, grid); }
        return grid[y * screen.w + x] === 1;
    }
    const objCache = new Map();
    // Rogne les marges transparentes d'un objet mis en cache : la marge demandée (ombre, feuillage qui dépasse) est large par prudence,
    // et chaque pixel transparent recopié coûte autant qu'un pixel plein (mélange alpha par image, sur 60+ arbres de bordure).
    // Retourne { cv, ox, oy } : le canvas réduit et son décalage (px du canvas d'origine).
    function trimObject(src) {
        const W = src.width, H = src.height;
        let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
        try {
            const d = src.getContext('2d').getImageData(0, 0, W, H).data;
            const rowEmpty = y => { for (let i = y * W * 4 + 3, e = (y + 1) * W * 4; i < e; i += 4) if (d[i]) return false; return true; };
            const colEmpty = x => { for (let y = y0; y <= y1; y++) if (d[(y * W + x) * 4 + 3]) return false; return true; };
            while (y0 < y1 && rowEmpty(y0)) y0++;
            while (y1 > y0 && rowEmpty(y1)) y1--;
            while (x0 < x1 && colEmpty(x0)) x0++;
            while (x1 > x0 && colEmpty(x1)) x1--;
        } catch { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }   // lecture impossible : on garde tout
        const cv = document.createElement('canvas');
        cv.width = x1 - x0 + 1;
        cv.height = y1 - y0 + 1;
        cv.getContext('2d').drawImage(src, -x0, -y0);
        return { cv, ox: x0, oy: y0 };
    }
    function drawCachedObject(key, x, y, w, h, pad, paint) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const [pl, pt, pr, pb] = pad;
        const k = `${key}|${Math.round(w)}x${Math.round(h)}|${dpr}`;
        let obj = objCache.get(k);
        if (!obj) {
            if (typeof document === 'undefined') { paint(ctx, x, y); return; }
            if (objCache.size > 300) objCache.clear();
            const cv = document.createElement('canvas');
            cv.width = Math.ceil((w + pl + pr) * dpr);
            cv.height = Math.ceil((h + pt + pb) * dpr);
            const g = cv.getContext('2d', { willReadFrequently: true });   // lu une fois (rognage) : canvas en mémoire, pas de relecture GPU
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.imageSmoothingEnabled = false;
            paint(g, pl, pt);
            obj = trimObject(cv);
            objCache.set(k, obj);
        }
        const was = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(obj.cv, (Math.round((x - pl) * dpr) + obj.ox) / dpr, (Math.round((y - pt) * dpr) + obj.oy) / dpr, obj.cv.width / dpr, obj.cv.height / dpr);
        ctx.imageSmoothingEnabled = was;
    }

    const ROOFS = ['#c9a45a', '#b8924a', '#a98342', '#8f7040', '#6f6f78', '#9a6a3a', '#c2a063', '#7a5a34'];   // chaume, paille, ardoise brute : pas de couleurs vives

    function drawBuilding(b, p, tile, labelSize, stilts = false) {
        const w = b.w * tile;
        const h = b.h * tile;
        const roof = ROOFS[(b.id.charCodeAt(0) + (b.x * 7 + b.y * 3)) % ROOFS.length];
        const roofH = Math.round(Math.max(tile * 0.95, h * 0.52));
        drawCachedObject(`house:${b.id}:${roof}:${b.door.x - b.x},${b.door.y - b.y}${stilts ? ':stilts' : ''}`, p.x, p.y, w, h,
            [tile * 0.5, tile * 0.4, tile * 0.9, tile * 0.5],
            (g, ox, oy) => drawHouse(g, ox, oy, w, h, tile, roof, { dx: (b.door.x - b.x) * tile, dy: (b.door.y - b.y) * tile }, stilts));
        if (b.name && tile >= 40) drawLabel(p.x + w / 2, p.y + roofH * 0.5, b.name, 'rgba(255,248,225,0.92)', '#5a3e1b', Math.max(10, labelSize - 1), w / 2);
    }

    // Dessine un sprite SVG (pieds vers le bas du cadre) centré sur cx, dont les pieds sont posés en feetY.
    // Retourne false tant que l'image n'est pas chargée (ou s'il n'y a pas de sprite).
    // `fallback` : dessin de face montré le temps que la vue de côté / de dos (dérivée) se décode.
    function drawSprite(svg, cx, feetY, size, fallback = null) {
        if (!svg) return false;
        let px = pixelSprite(svg);
        if (!px) {
            if (!fallback || fallback === svg) return true; // en cours de conversion : rien à dessiner (jamais de version floue)
            px = pixelSprite(fallback);
            if (!px) return true;
        }
        blitPixels(px, cx - size / 2, feetY - size * 0.92, size);
        return true;
    }

    // Copie nette d'un sprite pixellisé : pas de lissage, destination arrondie au pixel de l'écran.
    function blitPixels(px, x, y, size) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const snap = v => Math.round(v * dpr) / dpr;
        const was = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(px, snap(x), snap(y), Math.max(1 / dpr, snap(size)), Math.max(1 / dpr, snap(size)));
        ctx.imageSmoothingEnabled = was;
    }

    // Pastille de quête au-dessus d'un PNJ : « ! » (quête à prendre) ou « ? » (à rendre).
    function drawMarker(x, y, char, tile, scale = 1) {
        const r = tile * 0.17 * scale;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = char === '?' ? '#38bdf8' : '#facc15';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.stroke();
        ctx.fillStyle = '#2b1b17';
        ctx.font = `700 ${Math.round(r * 1.6)}px 'Rt Digits', 'Pixelify Sans', ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, x, y + r * 0.08);
    }

    // Pièce chinoise dorée (trou carré) au-dessus d'un PNJ marchand : repérable de loin.
    function drawMerchantBadge(x, y, tile) {
        const r = tile * 0.21;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#f2c14e';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#b8862a';
        ctx.stroke();
        const h = r * 0.5;
        ctx.fillStyle = '#2b1b17';
        ctx.fillRect(x - h / 2, y - h / 2, h, h);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y - r * 0.45, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
    }

    // Petite couronne dorée au-dessus des boss.
    function drawCrown(x, y, w) {
        const h = w * 0.7;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x - w / 2, y - h / 4);
        ctx.lineTo(x - w / 4, y + h / 12);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x + w / 4, y + h / 12);
        ctx.lineTo(x + w / 2, y - h / 4);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.closePath();
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#2b1b17';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // Ombre ovale sous les pieds : une dizaine par image. Remplir un chemin elliptique translucide coûte cher en rendu logiciel (≈ 40 % du temps
    // natif d'une image sur un vieux téléphone) ; l'ovale est donc rasterisé une fois par taille (au quart de pixel) puis recopié.
    const shadowSprites = new Map();
    function shadowSprite(rx, ry, dpr) {
        const key = `${Math.round(rx * 4)}|${Math.round(ry * 4)}|${dpr}`;
        let sprite = shadowSprites.get(key);
        if (!sprite) {
            const pad = 1;   // marge (px CSS) pour l'anticrénelage du bord
            const cv = document.createElement('canvas');
            cv.width = Math.ceil((rx + pad) * 2 * dpr);
            cv.height = Math.ceil((ry + pad) * 2 * dpr);
            const g = cv.getContext('2d');
            g.beginPath();
            g.ellipse(cv.width / 2, cv.height / 2, rx * dpr, ry * dpr, 0, 0, Math.PI * 2);
            g.fillStyle = 'rgba(0,0,0,0.22)';
            g.fill();
            sprite = { cv, w: cv.width / dpr, h: cv.height / dpr };
            if (shadowSprites.size > 64) shadowSprites.clear();
            shadowSprites.set(key, sprite);
        }
        return sprite;
    }
    function drawShadow(x, y, rx, ry) {
        const sprite = shadowSprite(rx, ry, env.drawDpr);
        ctx.drawImage(sprite.cv, x - sprite.w / 2, y - sprite.h / 2, sprite.w, sprite.h);
    }

    // Porte d'événement : grande (GATE_SCALE cases de large, elle déborde sur les cases voisines), entourée d'une aura qui change de couleur
    // (jade, violet, or), de flammes d'esprits en orbite, de braises qui montent et de deux lanternes qui vacillent. `layer` : 'back' (derrière le
    // sprite) ou 'front' (devant). Sans mouvement (préférence système), l'animation est figée sur une image.
    const GATE_SCALE = 2.8;
    const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    function drawGateAura(x, y, tile, now, layer) {
        const t = reducedMotion() ? 0 : now;
        const cy = y - tile * 1.25;
        ctx.save();
        if (layer === 'back') {
            // aura saturée (fusion normale : « lighter » délave les fonds clairs) qui change de couleur : jade → violet → or
            const hue = 150 + 120 * Math.sin(t / 2600) + 40 * Math.sin(t / 900);
            const r = tile * (2.0 + 0.15 * Math.sin(t / 420));
            const g = ctx.createRadialGradient(x, cy, tile * 0.1, x, cy, r);
            g.addColorStop(0, `hsla(${hue},100%,55%,0.62)`);
            g.addColorStop(0.55, `hsla(${hue + 50},100%,48%,0.34)`);
            g.addColorStop(1, `hsla(${hue + 90},100%,40%,0)`);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, cy, r, 0, Math.PI * 2);
            ctx.fill();
            // cercle de runes au sol, qui tourne (tirets) et change de teinte
            ctx.lineWidth = Math.max(2, tile * 0.07);
            ctx.setLineDash([tile * 0.22, tile * 0.16]);
            ctx.lineDashOffset = -t / 45;
            ctx.strokeStyle = `hsla(${hue + 180},100%,62%,0.9)`;
            ctx.beginPath();
            ctx.ellipse(x, y + tile * 0.12, tile * 1.2, tile * 0.38, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalCompositeOperation = 'lighter';
            // flammes d'esprits en orbite autour de la porte (de couleurs différentes)
            for (let i = 0; i < 10; i++) {
                const a = t / 1100 + (i * Math.PI * 2) / 10, rx = tile * 1.55, ry = tile * 1.75;
                const px = x + Math.cos(a) * rx, py = cy + Math.sin(a) * ry * 0.85;
                const behind = Math.sin(a) < 0;   // la moitié haute passe derrière la porte
                if (!behind) continue;
                ctx.fillStyle = `hsla(${[150, 280, 45, 190, 330][i % 5]},95%,70%,${(0.55 + 0.35 * Math.sin(t / 260 + i)).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(px, py, tile * (0.07 + 0.03 * Math.sin(t / 200 + i * 2)), 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 10; i++) {
                const a = t / 1100 + (i * Math.PI * 2) / 10;
                if (Math.sin(a) < 0) continue;   // la moitié basse passe devant
                const px = x + Math.cos(a) * tile * 1.55, py = cy + Math.sin(a) * tile * 1.75 * 0.85;
                ctx.fillStyle = `hsla(${[150, 280, 45, 190, 330][i % 5]},95%,72%,${(0.6 + 0.35 * Math.sin(t / 260 + i)).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(px, py, tile * (0.08 + 0.03 * Math.sin(t / 200 + i * 2)), 0, Math.PI * 2);
                ctx.fill();
            }
            // halo vert qui pulse dans l'ouverture de la porte, volutes de brume qui montent et couronne de lumière au-dessus du linteau
            const pulse = 0.5 + 0.5 * Math.sin(t / 520), dy = y - tile * 0.85;
            ctx.globalCompositeOperation = 'source-over';
            const pg = ctx.createRadialGradient(x, dy, 0, x, dy, tile * (0.95 + 0.12 * pulse));
            pg.addColorStop(0, `rgba(190,255,220,${(0.5 + 0.3 * pulse).toFixed(3)})`);
            pg.addColorStop(0.5, `rgba(80,230,150,${(0.28 + 0.15 * pulse).toFixed(3)})`);
            pg.addColorStop(1, 'rgba(40,200,120,0)');
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.ellipse(x, dy, tile * 0.95, tile * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            for (let i = 0; i < 5; i++) {
                const k = ((t / 3200 + i / 5) % 1 + 1) % 1, mx = x + Math.sin(i * 7.3 + k * 4) * tile * 0.38, my = dy + tile * 0.7 - k * tile * 1.6;
                ctx.fillStyle = `rgba(215,255,235,${(0.4 * Math.sin(k * Math.PI)).toFixed(3)})`;
                ctx.beginPath();
                ctx.ellipse(mx, my, tile * (0.16 + 0.1 * k), tile * 0.09, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.lineWidth = Math.max(2, tile * 0.06);
            ctx.strokeStyle = `rgba(150,255,200,${(0.3 + 0.3 * pulse).toFixed(3)})`;
            ctx.beginPath();
            ctx.ellipse(x, y - tile * 2.35, tile * (0.7 + 0.08 * pulse), tile * 0.2, 0, 0, Math.PI * 2);
            ctx.stroke();
            // braises qui montent du seuil et s'éteignent
            for (let i = 0; i < 8; i++) {
                const k = ((t / 2200 + i / 8) % 1 + 1) % 1;
                const px = x + Math.sin(i * 12.9 + k * 5) * tile * 0.7, py = y - k * tile * 2.6;
                ctx.fillStyle = `hsla(${[45, 20, 150, 290][i % 4]},95%,65%,${(0.8 * (1 - k)).toFixed(3)})`;
                ctx.fillRect(Math.round(px), Math.round(py), Math.max(2, tile * 0.06), Math.max(2, tile * 0.06));
            }
            // lanternes rouges qui vacillent, de chaque côté du linteau
            for (const side of [-1, 1]) {
                const flick = 0.55 + 0.3 * Math.sin(t / 130 + side * 2) + 0.15 * Math.sin(t / 47 + side);
                const lx = x + side * tile * 1.0, ly = y - tile * 1.3;
                const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, tile * 0.55);
                lg.addColorStop(0, `rgba(255,140,60,${(0.7 * flick).toFixed(3)})`);
                lg.addColorStop(1, 'rgba(255,60,40,0)');
                ctx.fillStyle = lg;
                ctx.beginPath();
                ctx.arc(lx, ly, tile * 0.55, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Élément de décor dessiné (sprites/decor.js), base posée en baseY.
    function drawDecor(name, x, baseY, size) {
        const svg = decorSprite(name);
        if (!svg) return;
        const px = pixelSprite(svg);
        if (px) blitPixels(px, x - size / 2, baseY - size * 0.92, size);
    }

    function drawLabel(x, y, text, bg, fg, size = 12, reach = env.cam.tile * 0.5) {
        ctx.font = `700 ${size}px 'Rt Digits', 'Pixelify Sans', ui-monospace, monospace`;
        const w = ctx.measureText(text).width + 14;
        const h = size + 8;
        // carte plus large que l'écran (caméra qui suit le héros) : l'étiquette d'une entité hors cadre n'est pas dessinée
        // (sinon elle s'empilerait contre le bord de l'écran)
        if (x < -reach || x > env.cam.vw + reach) return;
        // reste dans le cadre : une étiquette près du bord (sortie) ne doit pas être coupée
        if (env.cam.vw > w) x = Math.min(Math.max(x, w / 2 + 4), env.cam.vw - w / 2 - 4);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 6);
        else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.stroke();
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 0.5);
    }

    return { GATE_SCALE, drawBuilding, drawCachedObject, drawCrown, drawDecor, drawGateAura, drawLabel, drawMarker, drawMerchantBadge, drawShadow, drawSprite, isRimTree };
}
