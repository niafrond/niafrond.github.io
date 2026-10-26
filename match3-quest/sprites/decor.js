// Éléments de décor de la carte d'exploration et icônes de régions (carte du monde) : petits dessins SVG
// (viewBox 64x64, contour #2b1b17, base vers y = 58) qui remplacent les anciens emojis. decorSprite(nom) → chaîne SVG.

import { HOUSE_SPRITES } from './house.js';

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const N = 'stroke="none"';
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g ${O}>${body}</g></svg>`;

const D = {
    rice: () => {
        let s = '';
        [[20, 58, 14, 12], [32, 58, 32, 8], [44, 58, 50, 12], [26, 58, 22, 18], [38, 58, 42, 16]].forEach(([x0, y0, x1, y1]) => {
            s += `<path d="M${x0} ${y0} Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + 6} ${x1} ${y1}" fill="none" stroke="#a88a3a" stroke-width="2.4"/>`;
            s += `<ellipse cx="${x1}" cy="${y1 + 4}" rx="3.4" ry="7" transform="rotate(${(x1 - 32) * 1.4} ${x1} ${y1 + 4})" fill="#e8c860"/>`;
        });
        return s;
    },
    lantern: () => `<path d="M32 4 L32 12" fill="none"/><rect x="25" y="11" width="14" height="4" rx="1.2" fill="#c9a448"/>` +
        `<path d="M18 30 Q18 15 32 15 Q46 15 46 30 Q46 45 32 45 Q18 45 18 30Z" fill="#d9302e"/>` +
        `<path d="M26 16 Q22 30 26 44 M38 16 Q42 30 38 44" fill="none" stroke="#a8281e" stroke-width="1.4"/>` +
        `<ellipse cx="32" cy="30" rx="7" ry="10" fill="#f6b24a" opacity=".4" ${N}/>` +
        `<rect x="25" y="44" width="14" height="4" rx="1.2" fill="#c9a448"/><path d="M29 48 L28 56 M32 48 L32 58 M35 48 L36 56" fill="none" stroke="#f2c14e" stroke-width="1.8"/>`,
    rock: () => `<path d="M8 56 L12 38 L24 26 L40 28 L52 40 L56 56Z" fill="#9a9a94"/>` +
        `<path d="M40 28 L52 40 L56 56 L44 56 L42 40Z" fill="#7a7a74" ${N}/><path d="M8 56 L12 38 L24 26 L40 28 L52 40 L56 56Z" fill="none"/>` +
        `<path d="M24 26 L28 40 L42 40 M28 40 L20 56" fill="none" stroke-width="1.4"/><path d="M14 46 Q20 42 26 46" fill="none" stroke="#7a9a4a" stroke-width="2.4"/>`,
    bamboo: () => {
        let s = '';
        [[22, 6, '#7fb35a'], [34, 2, '#6aa04a'], [44, 12, '#8ac464']].forEach(([x, top, c]) => {
            s += `<rect x="${x}" y="${top}" width="7" height="${58 - top}" rx="2" fill="${c}"/>`;
            for (let y = top + 12; y < 56; y += 13) s += `<path d="M${x} ${y} L${x + 7} ${y}" fill="none" stroke-width="1.4"/>`;
        });
        s += `<path d="M29 18 Q20 12 14 14 Q20 20 29 20Z M41 12 Q50 6 56 8 Q50 14 41 14Z M51 26 Q60 24 62 28 Q56 32 51 28Z" fill="#9fd06a" stroke-width="1.4"/>`;
        return s;
    },
    campfire: () => `<path d="M14 54 L50 46 M14 46 L50 54" fill="none" stroke="#6a4226" stroke-width="5"/>` +
        `<path d="M32 10 Q38 20 42 22 Q48 32 44 42 Q40 50 32 50 Q24 50 20 42 Q16 32 22 24 Q24 30 27 28 Q26 18 32 10Z" fill="#f2702e"/>` +
        `<path d="M32 26 Q38 34 37 42 Q35 47 32 47 Q29 47 27 42 Q26 34 32 26Z" fill="#fbe08a" ${N}/>`,
    cactus: () => `<path d="M26 58 L26 14 Q26 6 32 6 Q38 6 38 14 L38 58Z" fill="#5d9a4a"/>` +
        `<path d="M26 36 L18 36 Q12 36 12 30 L12 20 Q12 16 16 16 Q20 16 20 20 L20 28 L26 28" fill="#5d9a4a"/>` +
        `<path d="M38 30 L46 30 Q52 30 52 24 L52 16 Q52 12 48 12 Q44 12 44 16 L44 22 L38 22" fill="#5d9a4a"/>` +
        `<path d="M32 12 L32 54" fill="none" stroke="#3f7634" stroke-width="1.4"/><circle cx="32" cy="6" r="3" fill="#f27aa0"/>` +
        `<path d="M20 58 L44 58" fill="none" stroke="#c9a06a" stroke-width="3"/>`,
    // Obstacles à l'échelle d'une case (les montagnes et volcans ci-dessus restent des icônes de carte du monde).
    spire: () => `<path d="M14 58 L22 30 L28 36 L34 8 L42 34 L48 28 L52 58Z" fill="#4a3c3a"/>` +
        `<path d="M34 8 L42 34 L40 58 L46 58 L52 58 L48 28 L42 34Z" fill="#2e2426" ${N}/>` +
        `<path d="M34 16 L32 28 L36 26 L35 38" fill="none" stroke="#ff7a2e" stroke-width="2.4"/><circle cx="34" cy="12" r="2" fill="#ffd24a" ${N}/>`,
    stalagmite: () => `<path d="M10 58 L16 34 L22 58Z M20 58 L30 10 L40 58Z M38 58 L46 30 L54 58Z" fill="#7a726a"/>` +
        `<path d="M30 10 L40 58 L34 58 L32 30Z" fill="#5a534c" ${N}/><path d="M24 40 L28 34 M44 44 L47 38" fill="none" stroke="#9a9288" stroke-width="1.4"/>`,
    // Amas de blocs de basalte frappés par la foudre (à l'échelle d'une case, pas une montagne en miniature).
    crag: () => `<path d="M6 58 L8 44 L16 36 L26 38 L30 46 L28 58Z" fill="#6f6a86"/>` +
        `<path d="M24 58 L26 38 L34 24 L46 26 L52 38 L54 58Z" fill="#7a7690"/>` +
        `<path d="M44 58 L46 46 L54 42 L60 48 L60 58Z" fill="#625e78"/>` +
        `<path d="M34 24 L46 26 L52 38 L54 58 L44 58 L46 40 L40 32Z" fill="#4e4a66" ${N}/>` +
        `<path d="M8 44 L16 36 L26 38 L30 46 L22 44Z" fill="#8f8aa8" ${N}/>` +
        `<path d="M36 28 L33 38 L38 38 L35 50" fill="none" stroke="#f2c14e" stroke-width="1.6"/>` +
        `<path d="M12 50 L18 46 M30 56 L34 50" fill="none" stroke="#4e4a66" stroke-width="1.3"/>`,
    mountain: () => `<path d="M2 58 L24 16 L36 34 L44 24 L62 58Z" fill="#7a7690"/>` +
        `<path d="M24 16 L30 28 L26 30 L22 26 L18 30 Z M44 24 L50 36 L46 34 L42 38 L38 32Z" fill="#f4f2ea" stroke-width="1.4"/>` +
        `<path d="M36 34 L44 58 M24 16 L14 58" fill="none" stroke="#5a5670" stroke-width="1.4"/>`,
    storm: () => `<path d="M10 34 Q4 34 6 26 Q8 20 16 22 Q18 10 30 12 Q38 6 46 14 Q58 14 56 26 Q60 34 52 36 Z" fill="#6b6f8a"/>` +
        `<path d="M14 30 Q30 34 50 30" fill="none" stroke="#4a4e68" stroke-width="1.6"/>` +
        `<path d="M34 34 L24 48 L32 48 L26 62 L42 42 L34 42 L40 34Z" fill="#f2c14e"/>`,
    volcano: () => `<path d="M2 58 L22 20 L42 20 L62 58Z" fill="#5a4a48"/><path d="M22 20 Q32 26 42 20 L40 16 L24 16Z" fill="#ff5a1f"/>` +
        `<path d="M28 20 L24 34 L30 30 L28 44 M38 20 L42 30" fill="none" stroke="#ff7a2e" stroke-width="2.4"/>` +
        `<path d="M26 12 Q20 6 26 2 M34 12 Q38 6 34 0" fill="none" stroke="#9aa0aa" stroke-width="2"/>`,
    wave: () => `<path d="M4 50 Q4 30 22 26 Q40 24 42 38 Q36 32 30 36 Q26 42 34 46 Q46 50 60 40 L60 58 L4 58Z" fill="#3a8ad0"/>` +
        `<path d="M22 26 Q34 22 40 32 Q32 28 28 32" fill="#dcf0fa" ${N}/><path d="M8 50 Q18 46 28 52 Q40 56 56 48" fill="none" stroke="#dcf0fa" stroke-width="2"/>`,
    // Coquillages échoués sur le sable (décors fixes de la côte).
    shell: () => `<path d="M32 56 L10 40 Q6 24 18 16 Q32 8 46 16 Q58 24 54 40Z" fill="#f2c7b0"/>` +
        `<path d="M32 56 L18 16 M32 56 L26 11 M32 56 L32 10 M32 56 L38 11 M32 56 L46 16" fill="none" stroke="#c98f7a" stroke-width="1.8"/>` +
        `<path d="M26 56 L38 56 L36 60 L28 60Z" fill="#d9a58f"/><path d="M12 38 Q32 46 52 38" fill="none" stroke="#fbe6da" stroke-width="2"/>`,
    conch: () => `<path d="M12 50 Q10 36 24 30 Q22 18 34 14 Q44 12 46 22 Q54 24 54 34 Q56 48 40 54 Q24 60 12 50Z" fill="#f4dcc0"/>` +
        `<path d="M40 54 Q54 48 52 34 Q50 40 42 40 Q36 40 36 34" fill="none" stroke="#d9a57a" stroke-width="2"/>` +
        `<path d="M24 30 Q32 32 34 26 Q38 20 44 24 M20 44 Q30 48 38 44" fill="none" stroke="#d9a57a" stroke-width="1.8"/>` +
        `<path d="M34 14 Q40 8 44 12" fill="none" stroke="#f4dcc0" stroke-width="3"/>`,
    drop: () => `<path d="M32 4 Q52 30 52 40 Q52 58 32 58 Q12 58 12 40 Q12 30 32 4Z" fill="#4a9ad8"/>` +
        `<path d="M22 38 Q22 30 28 24" fill="none" stroke="#dcf0fa" stroke-width="3"/>`,
    tree: () => `<path d="M28 58 L29 36 L35 36 L36 58Z" fill="#8a5a33"/>` +
        `<circle cx="32" cy="24" r="16" fill="#5d8a4a"/><circle cx="18" cy="32" r="10" fill="#5d8a4a"/><circle cx="46" cy="32" r="10" fill="#5d8a4a"/>` +
        `<path d="M22 18 Q28 12 36 14" fill="none" stroke="#8ac464" stroke-width="2.4"/><circle cx="40" cy="22" r="2.4" fill="#f2a03a"/><circle cx="24" cy="30" r="2.4" fill="#f2a03a"/>`,
    paw: () => `<ellipse cx="32" cy="42" rx="14" ry="12" fill="#e8a03a"/>` +
        `<ellipse cx="14" cy="26" rx="6" ry="7.4" fill="#e8a03a"/><ellipse cx="25" cy="14" rx="6" ry="7.4" fill="#e8a03a"/><ellipse cx="39" cy="14" rx="6" ry="7.4" fill="#e8a03a"/><ellipse cx="50" cy="26" rx="6" ry="7.4" fill="#e8a03a"/>` +
        `<path d="M24 40 L30 44 M36 38 L40 46" fill="none" stroke="#2b1b17" stroke-width="3"/>`,
    moon: () => `<circle cx="32" cy="30" r="24" fill="#f6e7a8"/><circle cx="24" cy="22" r="5" fill="#e6d48a" ${N}/><circle cx="40" cy="36" r="7" fill="#e6d48a" ${N}/><circle cx="26" cy="42" r="3" fill="#e6d48a" ${N}/>` +
        `<circle cx="32" cy="30" r="24" fill="none"/>`,
    chair: () => `<rect x="18" y="8" width="28" height="6" rx="1.4" fill="#8a4a2a"/><path d="M22 14 L22 34 M42 14 L42 34 M32 14 L32 34" fill="none" stroke="#8a4a2a" stroke-width="3"/>` +
        `<rect x="14" y="34" width="36" height="7" rx="1.4" fill="#a8683a"/><path d="M18 41 L16 58 M46 41 L48 58 M24 41 L24 56 M40 41 L40 56" fill="none" stroke="#6a3a20" stroke-width="3"/>`,
    jar: () => `<path d="M24 8 L40 8 L38 14 Q52 22 50 40 Q48 56 32 58 Q16 56 14 40 Q12 22 26 14Z" fill="#c9883a"/>` +
        `<path d="M16 32 Q32 38 48 32" fill="none" stroke="#2f6f73" stroke-width="3"/><path d="M18 42 Q32 48 46 42" fill="none" stroke="#f2c14e" stroke-width="2"/>` +
        `<ellipse cx="22" cy="24" rx="2.6" ry="5" fill="#fff" opacity=".35" ${N}/>`,
    bed: () => `<rect x="6" y="24" width="8" height="34" rx="2" fill="#8a4a2a"/><rect x="50" y="34" width="8" height="24" rx="2" fill="#8a4a2a"/>` +
        `<rect x="10" y="36" width="44" height="12" rx="2" fill="#a8683a"/><rect x="12" y="30" width="40" height="8" rx="3" fill="#f4ecd8"/>` +
        `<rect x="14" y="26" width="12" height="7" rx="3" fill="#fff"/><path d="M28 30 L52 30 L52 38 L28 38Z" fill="#c45a4a"/>`,
    books: () => `<rect x="8" y="50" width="48" height="8" rx="1" fill="#2f6f73"/><rect x="12" y="42" width="40" height="8" rx="1" fill="#c45a4a"/><rect x="10" y="34" width="44" height="8" rx="1" fill="#c9a448"/>` +
        `<path d="M20 30 L24 10 L44 14 L40 34Z" fill="#f4ecd8"/><path d="M26 16 L38 18 M25 21 L37 23 M24 26 L32 27" fill="none" stroke="#8a7a60" stroke-width="1.4"/>`,
    teapot: () => `<path d="M14 30 Q14 54 32 54 Q50 54 50 30Z" fill="#2f6f73"/><path d="M14 30 Q32 24 50 30" fill="#3f8a8e"/>` +
        `<path d="M50 34 Q60 32 58 22 L54 24 Q55 30 49 30" fill="#2f6f73"/><path d="M14 36 Q4 36 6 46 Q8 50 14 48" fill="none" stroke-width="3"/>` +
        `<path d="M26 26 Q26 18 32 18 Q38 18 38 26" fill="#3f8a8e"/><circle cx="32" cy="16" r="3" fill="#f2c14e"/>` +
        `<path d="M22 40 Q32 44 42 40" fill="none" stroke="#f2c14e" stroke-width="2"/><path d="M60 16 Q58 10 62 6" fill="none" stroke="#c8d0d8" stroke-width="2"/>`,
    // Mobilier des maisons : posé contre un mur (étagère, armoire, lit) ou au milieu de la pièce (table basse, jarre, panier, plante, coussin).
    shelf: () => `<rect x="8" y="6" width="48" height="52" rx="2" fill="#8a4a2a"/><rect x="12" y="10" width="40" height="44" fill="#4a2a18"/>` +
        `<rect x="10" y="26" width="44" height="4" fill="#a8683a"/><rect x="10" y="42" width="44" height="4" fill="#a8683a"/>` +
        `<rect x="14" y="14" width="6" height="12" rx="1" fill="#c45a4a"/><rect x="21" y="16" width="5" height="10" rx="1" fill="#2f6f73"/><rect x="27" y="13" width="6" height="13" rx="1" fill="#c9a448"/>` +
        `<rect x="38" y="16" width="12" height="10" rx="3" fill="#f4ecd8"/><path d="M38 21 L50 21" fill="none" stroke-width="1.4"/>` +
        `<path d="M16 38 Q16 31 22 31 Q28 31 28 38Z" fill="#c9883a"/><rect x="33" y="31" width="7" height="7" rx="1" fill="#6a9a4a"/><rect x="42" y="32" width="8" height="6" rx="1" fill="#f2c14e"/>` +
        `<rect x="14" y="46" width="12" height="8" rx="1" fill="#f4ecd8"/><rect x="29" y="47" width="9" height="7" rx="1" fill="#f4ecd8"/><rect x="41" y="46" width="9" height="8" rx="1" fill="#c9883a"/>`,
    cabinet: () => `<rect x="10" y="10" width="44" height="48" rx="2" fill="#a8683a"/><rect x="8" y="6" width="48" height="7" rx="2" fill="#8a4a2a"/>` +
        `<rect x="14" y="16" width="14" height="13" rx="1" fill="#b87a46" stroke-width="1.4"/><rect x="36" y="16" width="14" height="13" rx="1" fill="#b87a46" stroke-width="1.4"/>` +
        `<rect x="14" y="36" width="14" height="16" rx="1" fill="#b87a46" stroke-width="1.4"/><rect x="36" y="36" width="14" height="16" rx="1" fill="#b87a46" stroke-width="1.4"/>` +
        `<circle cx="28" cy="22" r="1.8" fill="#f2c14e"/><circle cx="36" cy="22" r="1.8" fill="#f2c14e"/><circle cx="28" cy="44" r="1.8" fill="#f2c14e"/><circle cx="36" cy="44" r="1.8" fill="#f2c14e"/>`,
    table: () => `<path d="M12 34 L12 56 M52 34 L52 56 M22 38 L22 54 M42 38 L42 54" fill="none" stroke="#6a3a20" stroke-width="4"/>` +
        `<rect x="6" y="28" width="52" height="9" rx="2" fill="#a8683a"/><rect x="8" y="29" width="48" height="3" rx="1.5" fill="#c8884a" ${N}/>` +
        `<path d="M14 28 Q14 18 22 18 Q30 18 30 28Z" fill="#2f6f73"/><path d="M30 22 Q36 20 36 25" fill="none" stroke-width="1.6"/><circle cx="22" cy="16" r="2" fill="#f2c14e"/>` +
        `<path d="M38 28 Q38 22 46 22 Q54 22 54 28Z" fill="#f4ecd8"/>`,
    basket: () => `<path d="M12 28 L52 28 L48 56 Q32 60 16 56Z" fill="#c9a448"/><path d="M14 36 L50 36 M15 44 L49 44 M16 51 L48 51" fill="none" stroke="#8a6a20" stroke-width="1.6"/>` +
        `<path d="M20 28 L22 56 M32 28 L32 58 M44 28 L42 56" fill="none" stroke="#8a6a20" stroke-width="1.4"/>` +
        `<ellipse cx="32" cy="28" rx="20" ry="5" fill="#8a6a20"/><circle cx="22" cy="25" r="3.4" fill="#f4ecd8"/><circle cx="31" cy="23" r="3.4" fill="#f4ecd8"/><circle cx="40" cy="25" r="3.4" fill="#f4ecd8"/><circle cx="27" cy="27" r="3.2" fill="#e8dcb8"/><circle cx="36" cy="27" r="3.2" fill="#e8dcb8"/>`,
    plant: () => `<path d="M18 38 L46 38 L42 58 L22 58Z" fill="#c9883a"/><rect x="16" y="34" width="32" height="6" rx="2" fill="#d9983a"/>` +
        `<path d="M32 36 Q20 28 18 14 Q30 16 32 30 Q34 16 46 14 Q44 28 32 36Z" fill="#5a9a3a"/><path d="M32 36 L32 20" fill="none" stroke="#3a6a24" stroke-width="1.6"/><circle cx="40" cy="22" r="2.6" fill="#e8a03a" ${N}/>`,
    cushion: () => `<path d="M10 44 Q10 34 32 34 Q54 34 54 44 Q54 56 32 56 Q10 56 10 44Z" fill="#c45a4a"/>` +
        `<path d="M16 44 Q32 38 48 44" fill="none" stroke="#f2c14e" stroke-width="2"/><circle cx="32" cy="45" r="3" fill="#f2c14e"/>`,
    // Autel de pierre : vide, ou orné de gâteaux de lune et d'une lanterne une fois l'offrande déposée.
    altar: () => `<rect x="12" y="40" width="40" height="18" rx="2" fill="#d8d6cc"/><rect x="8" y="34" width="48" height="8" rx="2" fill="#ece8e0"/>` +
        `<path d="M18 46 L46 46 M18 52 L46 52" fill="none" stroke="#a8a49a" stroke-width="1.4"/>` +
        `<circle cx="32" cy="18" r="12" fill="#f6e7a8" opacity=".9"/><circle cx="32" cy="18" r="12" fill="none" stroke-dasharray="3 3"/>`,
    altarLit: () => `<rect x="12" y="40" width="40" height="18" rx="2" fill="#d8d6cc"/><rect x="8" y="34" width="48" height="8" rx="2" fill="#ece8e0"/>` +
        `<path d="M18 46 L46 46 M18 52 L46 52" fill="none" stroke="#a8a49a" stroke-width="1.4"/>` +
        `<ellipse cx="22" cy="31" rx="7" ry="4" fill="#d9963a"/><ellipse cx="22" cy="29" rx="7" ry="3.4" fill="#f2c14e"/>` +
        `<ellipse cx="42" cy="31" rx="7" ry="4" fill="#d9963a"/><ellipse cx="42" cy="29" rx="7" ry="3.4" fill="#f2c14e"/>` +
        `<path d="M32 2 L32 8" fill="none"/><path d="M24 18 Q24 8 32 8 Q40 8 40 18 Q40 28 32 28 Q24 28 24 18Z" fill="#d9302e"/>` +
        `<ellipse cx="32" cy="18" rx="4" ry="6" fill="#f6b24a" opacity=".6" ${N}/>`,
    // Pilier de pierre : encadre un passage gardé (world/junctions.js)
    pillar: () => `<rect x="14" y="52" width="36" height="7" rx="1.6" fill="#b8b4a8"/><rect x="19" y="14" width="26" height="40" rx="1.6" fill="#d8d6cc"/>` +
        `<rect x="14" y="7" width="36" height="9" rx="1.8" fill="#ece8e0"/><path d="M26 18 L26 52 M32 18 L32 52 M38 18 L38 52" fill="none" stroke="#a8a49a" stroke-width="1.4"/>`,
    // Pierre de voyage (spirale gravée)
    swirl: () => `<circle cx="32" cy="32" r="26" fill="#cfe6f6"/><path d="M32 32 Q32 24 40 25.6 Q48 30.4 44 40 Q37.6 49.6 25.6 45.6 Q14.4 40 16 28 Q19.2 14.4 33.6 13.6" fill="none" stroke="#3a7ad8" stroke-width="4"/>`
};

// « deadtree » n'est pas un dessin SVG : c'est l'une des variantes de sprites/deadtrees.js (dessinée par explorationView.js).
export const DECOR_NAMES = [...Object.keys(D), 'deadtree'];

const cache = new Map();
export function decorSprite(name) {
    if (!D[name]) return null;
    if (HOUSE_SPRITES[name]) return HOUSE_SPRITES[name].uri;   // mobilier de maison en pixel art (tools/gen-house-sprites.mjs), sinon le dessin SVG
    if (!cache.has(name)) cache.set(name, wrap(D[name]()));
    return cache.get(name);
}
