#!/usr/bin/env node
/**
 * gen-companion-walk.mjs — Images de marche des compagnons (`companion_<id>` dans sprites/generated.js).
 *
 * gen-sprites-gm.mjs (ComfyUI : SDXL + LoRA Pixel Art XL) dessine les quatre directions fixes (front, back, left, right). Ce script en
 * tire les trois images du cycle de marche `walk_<dir>_0..2` que le jeu rejoue en va-et-vient (sprites/index.js gbaWalkSprite) :
 *   - de dos / de face : une patte se lève après l'autre (moitié basse gauche puis droite remontée d'un pixel), léger rebond au passage ;
 *   - de profil : la partie basse (pattes) fait un pas vers l'avant puis vers l'arrière (±1 pixel), rebond au passage ;
 *   - créatures volantes (--hover=id,id) : tout le corps monte et descend (battement), sans mouvement de pattes.
 * Le profil droit est le miroir du profil gauche. Les PNG sont aussi écrits dans sprites/png/<id>_walk_<dir>_<n>.png.
 *
 * Si tools/gen-companion-flux.py (FLUX.2 Klein + LoRA 4walk) a déjà écrit sprites/png/flux/<id>_walk_<dir>_<n>.png pour une direction (utilisées seulement pour les ids de --flux=, voir FLUX_OK), ce sont ces images
 * qui sont reprises (et l'image du milieu devient la pose fixe de cette direction, pour que le style ne saute pas à l'arrêt) ; le calcul
 * ci-dessus ne sert alors que de repli pour les directions manquantes.
 *
 * Usage : node tools/gen-companion-walk.mjs [--only=companion_zhi,…] [--hover=companion_yu,companion_etincelle,companion_jian]
 * Puis : node sprites/build-gba.mjs   (découpe generated.js en sprites/gba/ et met à jour sprites/gbaIndex.js)
 */
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const GENERATED = join(GAME, 'sprites', 'generated.js'), PNG_DIR = join(GAME, 'sprites', 'png'), FLUX_DIR = join(PNG_DIR, 'flux');
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=')]; }));
const ONLY = args.only ? args.only.split(',') : null;
// FLUX (LoRA 4walk) dessine un humanoïde plus petit et plus sombre que les sprites SDXL : essayé sur les 8 compagnons, il déforme les animaux et jure avec les humains.
const FLUX_OK = new Set((args.flux ?? '').split(','));   // vide par défaut : sprite fixe SDXL + pas procéduraux (style homogène) ; --flux=companion_zhi pour tester FLUX
// Dessins de dos ratés (le corbeau SDXL de dos est un oiseau de profil, plus petit) : on reprend la vue de face, qui garde la même taille.
const BACK_FROM_FRONT = new Set((args.backFromFront ?? 'companion_jian').split(','));
const HOVER = new Set((args.hover ?? 'companion_yu,companion_etincelle,companion_jian').split(','));

const readPng = uri => PNG.sync.read(Buffer.from(uri.split(',')[1], 'base64'));
const uriOf = png => 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
const blank = (w, h) => new PNG({ width: w, height: h });
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];

function bbox(img) {
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (alphaAt(img, x, y) > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
}
/** Fond gris résiduel d'une génération SDXL (détourage raté) : cases grises neutres, claires, reliées au bord de l'image (directement ou à travers du vide) -> transparentes. */
function cleanGray(img) {
    const { width: w, height: h, data } = img;
    const grayish = (x, y) => { const i = (y * w + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], l = (r + g + b) / 3; return data[i + 3] > 0 && Math.abs(r - g) < 16 && Math.abs(g - b) < 22 && l > 105 && l < 215; };
    const seen = new Uint8Array(w * h), stack = [];
    for (let x = 0; x < w; x++) stack.push([x, 0], [x, h - 1]);
    for (let y = 0; y < h; y++) stack.push([0, y], [w - 1, y]);
    while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
        seen[y * w + x] = 1;
        const clear = data[(y * w + x) * 4 + 3] === 0;
        if (!clear && !grayish(x, y)) continue;   // on traverse le vide : le fond gris peut être séparé du bord par une marge transparente
        data[(y * w + x) * 4 + 3] = 0;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return img;
}
function copyPixel(src, sx, sy, dst, dx, dy) {
    if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) return;
    const si = (sy * src.width + sx) * 4, di = (dy * dst.width + dx) * 4;
    if (src.data[si + 3] === 0) return;
    for (let k = 0; k < 4; k++) dst.data[di + k] = src.data[si + k];
}

/** Trois images de marche d'un sprite `img` vu de `dir`. */
export function walkFrames(img, dir, hover = false) {
    const { x0, y0, x1, y1 } = bbox(img);
    const w = img.width, h = img.height, midX = Math.round((x0 + x1) / 2);
    const bodyH = y1 - y0 + 1, band = Math.max(3, Math.round(bodyH * 0.3)), legsY = y1 - band + 1;
    return [0, 1, 2].map(f => {
        const out = blank(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (alphaAt(img, x, y) === 0) continue;
            let dx = 0, dy = 0;
            if (hover) dy = f === 1 ? -1 : f === 2 ? 1 : 0;                              // battement : haut, milieu, bas
            else {
                if (f === 1) dy = -1;                                                       // au passage, le corps monte d'un pixel
                if (y >= legsY) {                                                           // pattes
                    if (dir === 'left' || dir === 'right') dx = f === 0 ? 1 : f === 2 ? -1 : 0;   // pas vers l'avant puis vers l'arrière
                    else if (f === 0 && x < midX) dy = -1;                                  // patte gauche levée
                    else if (f === 2 && x >= midX) dy = -1;                                 // patte droite levée
                }
            }
            copyPixel(img, x, y, out, x + dx, y + dy);
        }
        return out;
    });
}
const mirror = img => { const o = blank(img.width, img.height); for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) copyPixel(img, x, y, o, img.width - 1 - x, y); return o; };

function loadGenerated() {
    const m = readFileSync(GENERATED, 'utf8').match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);
    return Function(`return ${m[1]}`)();
}
function saveGenerated(sprites) {
    const lines = ['// Généré par match3-quest/tools/gen-sprites.mjs — ne pas éditer à la main', `// Dernière mise à jour : ${new Date().toISOString().slice(0, 10)}`,
        '// Lancez: node match3-quest/tools/gen-sprites.mjs --only=all --dir=all', 'export const GBA_SPRITES = {'];
    for (const [key, dirs] of Object.entries(sprites)) {
        lines.push(`  ${JSON.stringify(key)}: {`);
        for (const [dir, uri] of Object.entries(dirs)) lines.push(`    ${dir}: ${JSON.stringify(uri)},`);
        lines.push('  },');
    }
    lines.push('};');
    writeFileSync(GENERATED + '.tmp', lines.join('\n') + '\n', 'utf8');
    renameSync(GENERATED + '.tmp', GENERATED);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const sprites = loadGenerated();
    mkdirSync(PNG_DIR, { recursive: true });
    const ids = Object.keys(sprites).filter(k => /^companion_/.test(k) && (!ONLY || ONLY.includes(k)));
    for (const id of ids) {
        const s = sprites[id];
        if (!['front', 'back', 'left', 'right'].every(d => s[d])) { console.log(`· ${id} : les 4 directions manquent, ignoré`); continue; }
        const hover = HOVER.has(id);
        const fluxFrames = d => [0, 1, 2].map(n => join(FLUX_DIR, `${id}_walk_${d}_${n}.png`));
        const fromFlux = d => FLUX_OK.has(id) && fluxFrames(d).every(f => existsSync(f));
        // pose fixe : toujours le sprite SDXL d'origine (sprites/png/<id>_<dir>.png), sauf pour FLUX où l'image du milieu garde le style
        for (const d of ['front', 'back', 'left', 'right']) { const f = join(PNG_DIR, `${id}_${d}.png`); if (existsSync(f)) s[d] = uriOf(cleanGray(PNG.sync.read(readFileSync(f)))); }
        if (BACK_FROM_FRONT.has(id)) s.back = s.front;
        const byDir = {};
        for (const d of ['front', 'back', 'left']) byDir[d] = fromFlux(d) ? fluxFrames(d).map(f => PNG.sync.read(readFileSync(f))) : walkFrames(readPng(s[d]), d, hover);
        byDir.right = fromFlux('right') ? fluxFrames('right').map(f => PNG.sync.read(readFileSync(f))) : byDir.left.map(mirror);
        if (BACK_FROM_FRONT.has(id)) byDir.back = walkFrames(readPng(s.front), 'back', hover);
        const used = [];
        for (const [dir, frames] of Object.entries(byDir)) {
            frames.forEach((png, n) => {
                s[`walk_${dir}_${n}`] = uriOf(png);
                writeFileSync(join(PNG_DIR, `${id}_walk_${dir}_${n}.png`), PNG.sync.write(png));
            });
            if (fromFlux(dir)) { s[dir] = s[`walk_${dir}_1`]; used.push(dir); }
        }
        console.log(`flux : ${used.join(', ') || 'aucune direction'}`);
        console.log(`OK ${id}${hover ? ' (vol)' : ''} : 12 images de marche`);
    }
    saveGenerated(sprites);
}
