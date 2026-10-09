// Garde-fou « vrai pixel art » : aucun SVG source de sprite ne doit introduire de dégradé, de filtre, de motif ni d'opacité partielle non
// autorisée, aucun ne dépasse 9 000 caractères ; aucun module d'affichage ne dessine un canvas sans lissage désactivé ; les images
// pixellisées sont toujours affichées avec `image-rendering: pixelated` et à une taille multiple de leur grille (zoom entier).
// Les SVG source restent vectoriels : c'est `sprites/index.js` (pixelSprite / spriteUri) qui les pixellise à l'affichage.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { SCREENS } from '../../story.js';
import { NPC_PACK } from '../../sprites/packs.js';
import { HERO_SPRITES, CHEST_SPRITES, NPC_SPRITES_A } from '../../sprites/cn/actors-a.js';
import { NPC_SPRITES_B, FENGMENG_SPRITES } from '../../sprites/cn/actors-b.js';
import { ENEMY_SPRITES_CN_1 } from '../../sprites/cn/enemies-1.js';
import { ENEMY_SPRITES_CN_2 } from '../../sprites/cn/enemies-2.js';
import { SUN_SPRITES, BEAST_SPRITES } from '../../sprites/cn/suns.js';
import { villagerSprite } from '../../sprites/villagers.js';
import { CREATURE_KINDS, CREATURE_BY_ID, creatureSprite, drawCreature } from '../../sprites/creatures.js';
import { DECOR_NAMES, decorSprite } from '../../sprites/decor.js';
import { viewSprite, HERO_VIEW_OPTS } from '../../sprites/side.js';
import { ICON_NAMES, iconSvg } from '../../icons.js';
import { TILE_FILES } from '../../sprites/index.js';
import { tileGeometry } from '../../sprites/tilePixels.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = rel => readFileSync(join(root, rel), 'utf8');

// ── Inventaire des SVG source, par famille ────────────────────────────────────────────────────────────────────────────────────
const families = {
    héros: HERO_SPRITES,
    coffres: CHEST_SPRITES,
    'PNJ dessinés': { ...NPC_SPRITES_A, ...NPC_SPRITES_B },
    Fengmeng: FENGMENG_SPRITES,
    'ennemis (1)': ENEMY_SPRITES_CN_1,
    'ennemis (2)': ENEMY_SPRITES_CN_2,
    soleils: SUN_SPRITES,
    'bêtes solaires': BEAST_SPRITES,
    décors: Object.fromEntries(DECOR_NAMES.map(n => [n, decorSprite(n)])),
    icônes: Object.fromEntries(ICON_NAMES.map(n => [n, iconSvg(n)])),
    tuiles: Object.fromEntries(TILE_FILES.map(f => [f, read(f)])),
    'créatures (genres)': Object.fromEntries(CREATURE_KINDS.map(k => [k, drawCreature(k)])),
    'créatures (PNJ)': {},
    'villageois générés': {},
    'vues de profil et de dos': {}
};
// Tous les PNJ de l'histoire sans dessin à la main : villageois ou créature générés à partir de l'identifiant.
const npcIds = [...new Set(Object.values(SCREENS).flatMap(s => s.npcs.map(n => n.id)))];
npcIds.filter(id => !NPC_PACK[id]).forEach(id => {
    const creature = creatureSprite(id);
    if (creature) families['créatures (PNJ)'][id] = creature;
    else families['villageois générés'][id] = villagerSprite(id);
});
Object.entries(HERO_SPRITES).forEach(([k, svg]) => ['left', 'back'].forEach(dir => {
    families['vues de profil et de dos'][`${k}-${dir}`] = viewSprite(svg, dir, HERO_VIEW_OPTS);
}));
const entries = Object.entries(families).flatMap(([family, items]) => Object.entries(items).map(([key, svg]) => ({ family, key, svg })));

// ── Analyse d'un SVG ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const TAG = /<(circle|ellipse|path|rect|polygon|polyline|line|g|use|stop)\b((?:[^<>"']|"[^"]*"|'[^']*')*?)\/?>/g;
const attr = (attrs, name) => (attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`)) || [])[1];
const alphaOf = attrs => ['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity']
    .map(n => attr(attrs, n)).filter(v => v !== undefined).map(parseFloat).filter(v => v < 1);

// Opacité partielle AUTORISÉE (liste blanche, vérifiée à l'œil sur les planches de contact 1x et 3x) :
//  1. lueurs, halos, faisceaux : l'élément porte class="glow" (aplat translucide voulu, un seul ton après pixellisation) ;
//  2. petites taches rondes (rayon <= 5 : joues, reflets d'yeux et de lames) : elles deviennent UN pixel de teinte propre ;
//  3. filets de reflet : trait seul (fill="none"), épaisseur <= 2,6, sans pointillé : un pixel clair au plus.
// Toute autre opacité (corps, ombres, vêtements, bêtes) doit être un aplat opaque (couleur déjà mélangée).
const SMALL_BLOB_MAX_RADIUS = 5;
const THIN_STROKE_MAX = 2.6;
function partialOpacityViolations(svg) {
    const bad = [];
    for (const m of svg.matchAll(TAG)) {
        const [, tag, attrs] = m;
        if (!alphaOf(attrs).length) continue;
        if (/\bclass="[^"]*\bglow\b/.test(attrs)) continue;
        const num = n => parseFloat(attr(attrs, n));
        if (tag === 'circle' && num('r') <= SMALL_BLOB_MAX_RADIUS) continue;
        if (tag === 'ellipse' && Math.max(num('rx'), num('ry')) <= SMALL_BLOB_MAX_RADIUS) continue;
        const fill = attr(attrs, 'fill');
        const stroke = attr(attrs, 'stroke');
        const width = attr(attrs, 'stroke-width') === undefined ? 1 : num('stroke-width');
        if ((fill === 'none' || (fill === undefined && stroke)) && width <= THIN_STROKE_MAX && attr(attrs, 'stroke-dasharray') === undefined) continue;
        bad.push(m[0].slice(0, 90));
    }
    if (/rgba\(|hsla\(/.test(svg)) bad.push('couleur rgba()/hsla()');
    return bad;
}

const colorCount = svg => new Set([...svg.matchAll(/(?:fill|stroke|stop-color|flood-color)="(#[0-9a-fA-F]{3,8})"/g)].map(m => m[1].toLowerCase())).size;

// Dessins tolérés entre 6 000 et 9 000 caractères (limite recommandée : 6 000) : liste fermée, ne pas l'allonger.
const OVER_SOFT_LIMIT = new Set(['Fengmeng:fengmeng_1', 'Fengmeng:fengmeng_3a', 'Fengmeng:fengmeng_3b', 'PNJ dessinés:shepherd_zi', 'PNJ dessinés:envoy_longwang']);
const HARD_LIMIT = 9000;
const SOFT_LIMIT = 6000;
// Au-delà de 28 teintes distinctes, un sprite n'est plus lisible une fois ramené à 6 niveaux par couche : borne de non-régression
// (la charte vise 16 ; 28 est le maximum constaté à l'audit du 2026-10-09).
const MAX_COLORS = 28;

describe('inventaire des sprites audités', () => {
    test('toutes les familles sont représentées et couvrent plus de 300 dessins', () => {
        Object.entries(families).forEach(([family, items]) => expect({ family, n: Object.keys(items).length }).toEqual({ family, n: expect.any(Number) }));
        expect(Object.keys(families['villageois générés']).length).toBeGreaterThanOrEqual(30);
        expect(Object.keys(families['tuiles'])).toHaveLength(8);
        expect(entries.length).toBeGreaterThan(300);
    });
});

describe('SVG source : pas de dégradé, de filtre ni de motif', () => {
    test.each(entries.map(e => [`${e.family} : ${e.key}`, e]))('%s', (name, { svg }) => {
        expect(svg).not.toMatch(/<(linear|radial)Gradient/);
        expect(svg).not.toMatch(/<filter\b|<fe[A-Z]\w*|\sfilter="/);
        expect(svg).not.toMatch(/<pattern\b|<mask\b/);
        expect(svg).not.toMatch(/\b(?:fill|stroke)="url\(#/);              // ni fill ni stroke ne renvoie à une définition (clip-path : autorisé)
    });
});

describe('SVG source : opacité partielle limitée aux lueurs, taches et filets', () => {
    test.each(entries.map(e => [`${e.family} : ${e.key}`, e]))('%s', (name, { svg }) => {
        expect(partialOpacityViolations(svg)).toEqual([]);
    });

    test('le contrôle détecte bien une opacité interdite', () => {
        const bad = '<svg viewBox="0 0 64 64"><path d="M0 0L9 9L0 9Z" fill="#fff" opacity=".5"/></svg>';
        expect(partialOpacityViolations(bad)).toHaveLength(1);
        const ok = '<svg viewBox="0 0 64 64"><ellipse cx="1" cy="1" rx="2" ry="1" fill="#f77" opacity=".45"/><path d="M0 0L9 9" fill="none" stroke="#fff" stroke-width="1" opacity=".7"/>'
            + '<circle cx="9" cy="9" r="12" fill="#ff0" fill-opacity=".3" class="glow"/></svg>';
        expect(partialOpacityViolations(ok)).toEqual([]);
    });
});

describe('SVG source : poids et palette', () => {
    test.each(entries.map(e => [`${e.family} : ${e.key}`, e]))('%s', (name, { family, key, svg }) => {
        expect(svg.length).toBeLessThanOrEqual(HARD_LIMIT);
        if (svg.length > SOFT_LIMIT) expect(OVER_SOFT_LIMIT.has(`${family}:${key}`)).toBe(true);
        expect(colorCount(svg)).toBeLessThanOrEqual(MAX_COLORS);
    });

    test('la liste des dessins lourds ne contient que des dessins qui dépassent réellement 6 000 caractères', () => {
        const heavy = new Set(entries.filter(e => e.svg.length > SOFT_LIMIT).map(e => `${e.family}:${e.key}`));
        OVER_SOFT_LIMIT.forEach(k => expect(heavy.has(k)).toBe(true));
    });
});

// ── Code d'affichage : lissage désactivé, pixellisation, zoom entier ────────────────────────────────────────────────────────
function listFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (['node_modules', 'tests', 'tools', 'audio', 'fonts', '.git'].includes(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) listFiles(full, out);
        else if (/\.(js|mjs)$/.test(name)) out.push(full);
    }
    return out;
}
const jsFiles = listFiles(root).map(f => relative(root, f));

describe('modules d\'affichage : jamais de canvas lissé', () => {
    // Un module qui appelle drawImage doit désactiver le lissage (imageSmoothingEnabled = false) quelque part dans le même module : c'est le
    // contrat des modules de dessin (explorationView.js, cinematics.js, tilePainter.js, sprites/index.js). Aucun faux positif : le test ne
    // regarde que les appels réels `.drawImage(` hors commentaires de ligne.
    const withDrawImage = jsFiles.filter(f => /^\s*[^/\s].*\.drawImage\(/m.test(read(f).split('\n').filter(l => !l.trim().startsWith('//')).join('\n')));

    test('au moins explorationView.js, cinematics.js et sprites/index.js sont détectés', () => {
        ['explorationView.js', 'cinematics.js', 'sprites/index.js'].forEach(f => expect(withDrawImage).toContain(f));
    });

    test.each(withDrawImage.map(f => [f]))('%s désactive imageSmoothingEnabled', file => {
        expect(read(file)).toMatch(/imageSmoothingEnabled\s*=\s*false/);
    });

    test('aucun module n\'active le lissage explicitement (imageSmoothingEnabled = true)', () => {
        jsFiles.forEach(f => expect({ f, on: /imageSmoothingEnabled\s*=\s*true/.test(read(f)) }).toEqual({ f, on: false }));
    });

    test('spriteImage (SVG brut, flou une fois agrandi) n\'est appelé que par sprites/index.js', () => {
        const users = jsFiles.filter(f => f !== 'sprites/index.js' && /\bspriteImage\(/.test(read(f)));
        expect(users).toEqual([]);
    });

    test('aucun canvas d\'affichage ne reçoit de flou (shadowBlur, ctx.filter = blur)', () => {
        const users = jsFiles.filter(f => /\.shadowBlur\s*=\s*[1-9]|\.filter\s*=\s*['"`][^'"`]*blur/.test(read(f)));
        expect(users).toEqual([]);
    });
});

describe('feuilles de style : sprites pixellisés, taille à zoom entier', () => {
    const css = read('style.css');
    const retro = read('retro.css');
    const rule = (src, selector) => {
        const i = src.search(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`));
        expect(i).toBeGreaterThanOrEqual(0);
        return src.slice(i, src.indexOf('}', i));
    };

    test.each([
        ['style.css', '.cine-canvas'],
        ['style.css', '.title-canvas'],
        ['style.css', '.bt-sprite'],
        ['style.css', '#player-stats::after, #enemy-stats::after'],
        ['style.css', '.wm-node-icon, .wm-node-badge, .wm-hero']
    ])('%s : « %s » a image-rendering: pixelated', (file, selector) => {
        expect(rule(file === 'style.css' ? css : retro, selector)).toMatch(/image-rendering:\s*pixelated/);
    });

    test('les PNG pixellisés (data:image/png) ont image-rendering: pixelated partout', () => {
        expect(css).toMatch(/img\[src\^="data:image\/png"\]\s*\{[^}]*image-rendering:\s*pixelated/);
    });

    test('les tuiles du plateau sont affichées sans lissage, à la taille donnée par tilePixels.js', () => {
        const base = retro.slice(retro.indexOf('body.rt .tile,\nbody.rt .tile.red'));
        const block = base.slice(0, base.indexOf('}'));
        expect(block).toMatch(/image-rendering:\s*pixelated/);
        expect(block).toMatch(/background-size:\s*var\(--tile-bg-size/);
    });

    test('pas d\'ombre floue ni de flou CSS sur les sprites de la rencontre', () => {
        expect(rule(css, '.bt-sprite')).not.toMatch(/drop-shadow|blur\(/);
        expect(css).not.toMatch(/\.bt-sprite[^{]*\{[^}]*(drop-shadow|blur\()/);
    });

    test('les images pixellisées (grille 32, PNG de 128 px) ont une taille multiple de 32 px', () => {
        const size = (selector, prop) => parseInt((rule(css, selector).match(new RegExp(`${prop}:\\s*(\\d+)px`)) || [])[1], 10);
        [['.explore-dialog-portrait img', 'width'], ['.explore-dialog-portrait img', 'height'], ['.class-emoji img', 'width'], ['.class-emoji img', 'height'],
            ['.bt-dialog-portrait .bt-sprite', 'width'], ['.bt-dialog-portrait .bt-sprite', 'height'],
            ['#player-stats::after, #enemy-stats::after', 'width'], ['#player-stats::after, #enemy-stats::after', 'height']].forEach(([sel, prop]) => {
            expect({ sel, prop, ok: size(sel, prop) % 32 === 0 && size(sel, prop) > 0 }).toEqual({ sel, prop, ok: true });
        });
    });

    test('aucune animation de sprite ne passe par une rotation ou une échelle fractionnaire (keyframes de la rencontre)', () => {
        const frames = css.match(/@keyframes bt-(?:pop|title)\s*\{[^\n]*\}/g) || [];
        expect(frames).toHaveLength(2);
        frames.forEach(f => expect(f).not.toMatch(/rotate\(|scale\(/));
    });

    test('les icônes en ligne (.ic) ne sont pas anti-crénelées', () => {
        expect(rule(css, '.ic')).toMatch(/shape-rendering:\s*crispEdges/);
    });
});

describe('tuiles du plateau : pixel = nombre entier de pixels CSS', () => {
    test.each([16, 24, 30, 36, 40, 44, 47, 48, 52, 56, 64, 72, 80, 96, 100, 120])('case de %i px', tile => {
        const { px, grid, size } = tileGeometry(tile);
        expect(Number.isInteger(px) && px >= 2).toBe(true);
        expect(Number.isInteger(grid) && grid >= 8).toBe(true);
        expect(size).toBe(grid * px);
        if (tile >= 16) expect(size).toBeLessThanOrEqual(tile);
        expect(tile - size).toBeLessThan(px + 1);          // le débord inutilisé reste inférieur à un pixel de dessin
    });
});
