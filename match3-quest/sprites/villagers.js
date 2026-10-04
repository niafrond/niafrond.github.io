// Villageois génériques : sprite SVG chibi (viewBox 64x64, contour #2b1b17, pieds vers y = 58) composé à partir de
// l'identifiant du PNJ (couleurs de robe, coiffure, couvre-chef, accessoire) pour que chaque habitant du Grand Monde
// ait un dessin propre sans sprite écrit à la main. Déterministe : même id → même personnage. L'identifiant oriente
// aussi l'âge (OLD_IDS : cheveux blancs, barbe ; CHILD_ID / CHILD_IDS : plus petit, couettes) et l'habit (moines).
// Les PNJ non humains (animaux, esprits, épouvantail…) sont dessinés par creatures.js.

import { creatureSprite } from './creatures.js';

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const SKINS = [['#f5cba7', '#e0a582'], ['#e8b58a', '#cf9468'], ['#d9a273', '#bd8456'], ['#f2c59e', '#dca07a']];
const ROBES = [
    ['#2f6f73', '#1f4f54', '#f2c14e'], ['#8e2a3a', '#661d2b', '#f2c14e'], ['#b8742a', '#8a5420', '#fbe7b0'],
    ['#4a6fa5', '#34507a', '#fbf1d8'], ['#5d8a4a', '#3f6434', '#fbf1d8'], ['#7a4a8a', '#563466', '#f2c14e'],
    ['#c9a448', '#9c7d2e', '#7a1f24'], ['#6b6f7a', '#4a4e58', '#f2c14e'], ['#c45a4a', '#963f33', '#fbf1d8']
];
const HAIRS = ['#1d1a24', '#2d2220', '#4a3326', '#1d1a24'];
const OLD_HAIR = '#ece8e0';

function hashOf(id) {
    let h = 2166136261;
    for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}
const pick = (list, h, shift) => list[(h >>> shift) % list.length];

const OLD_IDS = new Set(['aunt_liu', 'grandma_tao', 'ke_paper', 'bath_old_wang', 'grandma_altan', 'old_nomad_bayan']);
const OLD_ID = /(^|_)(old|grandma|grandpa|elder)(_|$)/;
const CHILD_IDS = new Set(['xiaobao', 'star_child_xing', 'cricket_boy_hao', 'eagle_boy_temur']);
const CHILD_ID = /(^|_)(kid|kids|boy|girl|child|orphan|twins|apprentice)(_|$)/;
// Moines et nonnes : crâne rasé, robe safran.
const MONK_ID = /(^|_)(monk|nun)(_|$)/;

export function villagerSprite(id) {
    const creature = creatureSprite(id);
    if (creature) return creature;
    const h = hashOf(id);
    const old = OLD_IDS.has(id) || OLD_ID.test(id);
    const child = !old && (CHILD_IDS.has(id) || CHILD_ID.test(id));
    const monk = MONK_ID.test(id);
    const [skin, skinD] = pick(SKINS, h, 3);
    const [robe, robeD, trim] = monk ? ['#e0902a', '#b06a1c', '#8e2a3a'] : pick(ROBES, h, 6);
    const hair = monk ? skin : old ? OLD_HAIR : pick(HAIRS, h, 11);
    const hat = monk ? 'none' : old ? ['none', 'scholar', 'straw'][(h >>> 14) % 3] : child ? 'none' : ['none', 'straw', 'scholar', 'scarf', 'none'][(h >>> 14) % 5];
    const style = monk ? 'bald' : child ? 'tufts' : ['bun', 'topknot', 'long', 'bun'][(h >>> 18) % 4];
    const item = ['none', 'staff', 'basket', 'lantern', 'scroll', 'none'][(h >>> 22) % 6];
    const scale = child ? 0.82 : 1;
    const ty = child ? (1 - scale) * 58 : 0;

    const feet = `<ellipse cx="26.5" cy="57" rx="4.4" ry="2.6" fill="#3a2a24"/><ellipse cx="37.5" cy="57" rx="4.4" ry="2.6" fill="#3a2a24"/>`;
    const body =
        `<path d="M18 57.6 Q15.6 45 22.4 35 L41.6 35 Q48.4 45 46 57.6 Q32 60.4 18 57.6Z" fill="${robe}"/>` +
        `<path d="M39 38 Q47 46 45.4 56.6 L38 58 Q42 46 39 38Z" fill="${robeD}" stroke="none"/>` +
        `<path d="M24 36.4 L32 44.6 L40 36.4" fill="none" stroke="${trim}" stroke-width="2.2"/>` +
        `<rect x="22" y="47" width="20" height="4" rx="1.6" fill="${robeD}"/><rect x="29.4" y="46.2" width="5.2" height="5.6" rx="1.2" fill="${trim}"/>` +
        `<ellipse cx="19" cy="44.6" rx="4.4" ry="7" transform="rotate(12 19 44.6)" fill="${robe}"/><circle cx="17.6" cy="50.4" r="2.6" fill="${skin}"/>` +
        `<ellipse cx="45" cy="44.6" rx="4.4" ry="7" transform="rotate(-12 45 44.6)" fill="${robeD}"/><circle cx="46.4" cy="50.4" r="2.6" fill="${skin}"/>`;

    let itemSvg = '';
    if (item === 'staff') itemSvg = `<rect x="48.4" y="26" width="3" height="32" rx="1.4" fill="#8a5a33"/><circle cx="50" cy="25" r="2.8" fill="${trim}"/>`;
    else if (item === 'basket') itemSvg = `<path d="M44 49 L55 49 L53.4 57 L45.6 57Z" fill="#c9a448"/><path d="M45.6 49 Q49.5 41 53.4 49" fill="none"/>`;
    else if (item === 'lantern') itemSvg = `<path d="M50 40 L50 45" fill="none"/><ellipse cx="50" cy="50" rx="4.4" ry="5.4" fill="#e8553a"/><rect x="47.6" y="44" width="4.8" height="2" fill="${trim}"/><rect x="47.6" y="54" width="4.8" height="2" fill="${trim}"/>`;
    else if (item === 'scroll') itemSvg = `<rect x="44.6" y="46" width="11" height="4.6" rx="2.2" fill="#f4ecd8"/><circle cx="44.8" cy="48.3" r="2" fill="#a8683a"/><circle cx="55.4" cy="48.3" r="2" fill="#a8683a"/>`;

    const beard = old ? `<path d="M23 31 Q23 41 32 44 Q41 41 41 31 Q37 36 32 35 Q27 36 23 31Z" fill="${OLD_HAIR}"/>` : '';
    const backHair = style === 'long' ? `<path d="M17 24 Q13 36 17.4 47 L25 42 L39 42 L46.6 47 Q51 36 47 24Z" fill="${hair}"/>` : '';
    const hairBack = `<ellipse cx="32" cy="22" rx="14.6" ry="12.6" fill="${hair}"/>`;
    const bun = style === 'bun' ? `<circle cx="32" cy="8.8" r="5" fill="${hair}"/>` :
        style === 'topknot' ? `<path d="M29 11 Q32 3 35 11Z" fill="${hair}"/>` :
            style === 'tufts' ? `<circle cx="20" cy="12.6" r="3.8" fill="${hair}"/><circle cx="44" cy="12.6" r="3.8" fill="${hair}"/>` : '';
    const face =
        `<ellipse cx="32" cy="25" rx="13" ry="11.2" fill="${skin}"/>` +
        `<path d="M40 31 Q44 27 44.6 23 Q44 33 36 35.4Z" fill="${skinD}" stroke="none"/>` +
        `<ellipse cx="32" cy="25" rx="13" ry="11.2" fill="none"/>`;
    const fringe = monk ? '' : `<path d="M19 23.6 Q18 14 32 13.4 Q46 14 45 23.6 Q42 19 37 19.6 Q34 19 32 21 Q30 19 27 19.6 Q22 19 19 23.6Z" fill="${hair}"/>`;
    const brow = old ? '#ece8e0' : K;
    const eyes = old
        ? `<path d="M24.8 26.6 Q27 24.4 29.2 26.6 M34.8 26.6 Q37 24.4 39.2 26.6" fill="none" stroke="${K}" stroke-width="1.4"/>`
        : `<circle cx="27" cy="26.4" r="1.6" fill="${K}" stroke="none"/><circle cx="37" cy="26.4" r="1.6" fill="${K}" stroke="none"/><circle cx="27.6" cy="25.8" r=".6" fill="#fff" stroke="none"/><circle cx="37.6" cy="25.8" r=".6" fill="#fff" stroke="none"/>`;
    const brows = `<path d="M23.6 23.2 L29.6 22.6 M40.4 23.2 L34.4 22.6" stroke="${brow}" stroke-width="1.6" fill="none"/>`;
    const cheeks = `<ellipse cx="24" cy="30" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".45" stroke="none"/><ellipse cx="40" cy="30" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".45" stroke="none"/>`;
    const mouth = `<path d="M29.8 31.2 Q32 33.4 34.2 31.2" fill="none" stroke="${K}" stroke-width="1.2"/>`;

    let hatSvg = '';
    if (hat === 'straw') hatSvg = `<path d="M10 20 L32 3 L54 20 Q32 25 10 20Z" fill="#e0c068"/><path d="M16 19 Q32 22.4 48 19" fill="none" stroke="#b8923a" stroke-width="1.4"/>`;
    else if (hat === 'scholar') hatSvg = `<path d="M21.4 21 Q20.6 7 32 6.6 Q43.4 7 42.6 21 Q37 17.6 32 17.6 Q27 17.6 21.4 21Z" fill="#26202e"/><path d="M21.6 18.8 Q32 14.6 42.4 18.8" fill="none" stroke="${trim}" stroke-width="1.6"/>`;
    else if (hat === 'scarf') hatSvg = `<path d="M18.6 22 Q18 10 32 10 Q46 10 45.4 22 Q39 15.6 32 16.2 Q25 15.6 18.6 22Z" fill="${robe}"/><path d="M42 17 Q50 18 49 27 Q46 22 41 21Z" fill="${robeD}"/>`;

    // L'accessoire tenu en main passe devant le corps mais derrière la tête.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g ${O} transform="translate(${((1 - scale) * 32).toFixed(1)} ${ty.toFixed(1)}) scale(${scale})">` +
        feet + backHair + body + itemSvg + hairBack + bun + face + beard + fringe + brows + eyes + cheeks + mouth + hatSvg + `</g></svg>`;
}
