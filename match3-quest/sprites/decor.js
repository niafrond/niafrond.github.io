// Éléments de décor de la carte d'exploration et icônes de régions (carte du monde) : petits dessins SVG
// (viewBox 64x64, contour #2b1b17, base vers y = 58) qui remplacent les anciens emojis. decorSprite(nom) → chaîne SVG.

import { HOUSE_SPRITES } from './house.js';
import { SOULS_DECOR } from './souls-decor.js';

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
    // ── Décors des autres biomes (obstacles et décoration à l'échelle d'une case) ──
    strawhat: () => `<ellipse cx="32" cy="44" rx="26" ry="8" fill="#d8b050"/><path d="M18 44 Q20 22 32 20 Q44 22 46 44Z" fill="#e8c860"/><path d="M22 40 Q32 44 42 40 M24 32 Q32 35 40 32" fill="none" stroke="#a8863a" stroke-width="1.4"/><path d="M19 44 Q32 50 45 44" fill="none" stroke="#c8402e" stroke-width="2.4"/>`,
    wiltedlotus: () => `<path d="M32 58 Q30 40 34 22" fill="none" stroke-width="5"/><path d="M32 58 Q30 40 34 22" fill="none" stroke="#8a7a3a" stroke-width="2.4"/><path d="M34 22 Q24 16 22 26 Q28 32 34 26Z M34 22 Q44 14 46 24 Q40 32 34 26Z" fill="#b8a05a"/><path d="M10 54 Q18 46 28 52 Q18 58 10 54Z M42 54 Q50 46 58 52 Q50 58 42 54Z" fill="#8a9a58"/>`,
    sluice: () => `<rect x="6" y="14" width="8" height="44" rx="1.5" fill="#8a6a3a"/><rect x="50" y="14" width="8" height="44" rx="1.5" fill="#8a6a3a"/><rect x="14" y="14" width="36" height="8" fill="#a8864a"/><rect x="18" y="22" width="28" height="22" fill="#7a5c30"/><path d="M22 22 L22 44 M28 22 L28 44 M34 22 L34 44 M40 22 L40 44" fill="none" stroke-width="1.4"/><path d="M14 52 L50 52" fill="none" stroke="#c8b070" stroke-width="3"/><circle cx="32" cy="12" r="4" fill="#c9a448"/>`,
    mudrock: () => `<path d="M6 56 L10 38 L22 28 L38 30 L52 40 L58 56Z" fill="#a8825a"/><path d="M38 30 L52 40 L58 56 L44 56 L42 40Z" fill="#7a5c3a" stroke="none"/><path d="M12 48 Q22 44 30 48 M24 36 L28 44" fill="none" stroke="#5a4028" stroke-width="1.4"/><path d="M6 56 Q16 52 26 56" fill="none" stroke="#c8a070" stroke-width="2.4"/>`,
    driftlog: () => `<path d="M4 52 Q4 40 12 38 L52 36 Q60 38 60 46 Q60 54 52 54 L12 56 Q4 56 4 52Z" fill="#9a7a50"/><ellipse cx="54" cy="45" rx="5" ry="8" fill="#c8a870"/><ellipse cx="54" cy="45" rx="2.4" ry="4.4" fill="none" stroke="#8a6a3a" stroke-width="1.2"/><path d="M14 40 L30 42 M12 50 L40 52 M20 36 L24 28 L28 36" fill="none" stroke="#5a4028" stroke-width="1.6"/>`,
    clayblock: () => `<path d="M8 58 L8 30 L20 22 L48 22 L56 30 L56 58Z" fill="#c8985a"/><path d="M20 22 L48 22 L56 30 L8 30Z" fill="#dcb070" stroke-width="1.6"/><path d="M36 30 L36 58 M8 44 L36 44 M36 40 L56 40" fill="none" stroke="#8a5a30" stroke-width="1.6"/><path d="M14 36 L18 40 M44 48 L48 52" fill="none" stroke="#8a5a30" stroke-width="1.4"/>`,
    fossil: () => `<ellipse cx="32" cy="46" rx="22" ry="12" fill="#b8a888"/><path d="M32 46 m-12 0 a12 8 0 1 1 24 0 m-6 0 a6 4 0 1 0 -12 0" fill="none" stroke="#6a5a3a" stroke-width="2"/><path d="M14 46 L50 46 M20 40 L44 40 M20 52 L44 52" fill="none" stroke="#8a7a58" stroke-width="1.2"/>`,
    fallenlog: () => `<path d="M4 50 Q4 38 14 36 L50 34 Q60 36 60 44 Q60 52 50 54 L14 56 Q4 56 4 50Z" fill="#7a5a36"/><ellipse cx="54" cy="44" rx="5" ry="9" fill="#c8a468"/><path d="M14 38 Q30 42 46 38 M12 50 Q30 54 48 50" fill="none" stroke="#4a3220" stroke-width="1.6"/><path d="M10 38 Q20 30 30 36 Q22 40 10 38Z M30 36 Q40 28 48 34 Q40 40 30 36Z" fill="#6aa04a" stroke-width="1.4"/>`,
    mossrock: () => `<path d="M6 56 L10 38 L22 26 L40 28 L54 40 L58 56Z" fill="#8a9088"/><path d="M40 28 L54 40 L58 56 L44 56 L44 40Z" fill="#686e66" stroke="none"/><path d="M10 38 L22 26 L40 28 L30 36 Q18 32 10 38Z" fill="#6aa04a"/><path d="M14 52 Q22 46 30 52 M36 50 Q42 44 50 50" fill="none" stroke="#6aa04a" stroke-width="3"/>`,
    shoot: () => `<path d="M24 58 Q24 38 28 20 Q32 6 36 20 Q40 38 40 58Z" fill="#a8d070"/><path d="M26 44 L38 44 M26 32 L38 32 M28 20 L36 20" fill="none" stroke="#5a8a3a" stroke-width="1.6"/><path d="M28 14 Q32 6 36 14" fill="none" stroke="#c8e890" stroke-width="2"/><path d="M12 58 Q18 50 24 54 M40 54 Q46 50 52 58" fill="none" stroke="#6a8a40" stroke-width="2.4"/>`,
    mushroom: () => `<path d="M12 40 Q14 20 30 20 Q46 20 48 40 Q30 46 12 40Z" fill="#c8402e"/><path d="M26 42 L26 56 L36 56 L36 42" fill="#f0e8d0"/><circle cx="22" cy="30" r="3" fill="#f6f0e0" stroke="none"/><circle cx="34" cy="26" r="2.4" fill="#f6f0e0" stroke="none"/><circle cx="40" cy="34" r="2.2" fill="#f6f0e0" stroke="none"/><path d="M44 46 Q50 40 56 46 L56 54 L48 54Z" fill="#e8d8b0"/>`,
    stonelantern: () => `<rect x="18" y="52" width="28" height="6" rx="1.5" fill="#9a9a94"/><rect x="26" y="32" width="12" height="20" fill="#aaaaa4"/><rect x="20" y="20" width="24" height="12" fill="#b8b8b0"/><rect x="26" y="23" width="12" height="6" fill="#f6d070" stroke="none"/><path d="M14 20 L32 8 L50 20Z" fill="#8a8a84"/><circle cx="32" cy="8" r="2.4" fill="#aaaaa4"/>`,
    thornbush: () => `<path d="M4 56 Q2 36 16 30 Q22 18 34 22 Q48 18 54 32 Q64 40 58 56Z" fill="#8a8a40"/><path d="M34 22 Q48 18 54 32 Q64 40 58 56 L44 56 Q50 40 34 22Z" fill="#6a6a2c" stroke="none"/><path d="M12 36 L6 32 M24 28 L22 20 M40 26 L44 18 M50 36 L58 32 M18 46 L10 46 M46 48 L54 50" fill="none" stroke="#5a4a28" stroke-width="2"/>`,
    acacia: () => `<path d="M30 58 L30 34 Q28 28 22 24 M34 58 L34 32 Q38 26 46 24" fill="none" stroke-width="7"/><path d="M30 58 L30 34 Q28 28 22 24 M34 58 L34 32 Q38 26 46 24" fill="none" stroke="#7a5a36" stroke-width="3"/><path d="M4 24 Q8 10 26 12 Q40 6 56 14 Q62 22 52 26 Q36 22 18 28 Q8 30 4 24Z" fill="#8a9a40"/><path d="M26 12 Q40 6 56 14 Q62 22 52 26 Q44 20 26 12Z" fill="#6a7a2c" stroke="none"/>`,
    termite: () => `<path d="M8 58 Q10 46 16 42 Q20 22 32 8 Q44 22 48 42 Q54 46 56 58Z" fill="#b8784a"/><path d="M32 8 Q44 22 48 42 Q54 46 56 58 L44 58 Q44 40 32 8Z" fill="#8a5232" stroke="none"/><path d="M22 44 Q28 40 34 44 M26 30 Q31 27 36 30 M18 54 Q26 50 34 54" fill="none" stroke="#6a3c22" stroke-width="1.6"/><ellipse cx="30" cy="54" rx="3" ry="2" fill="#2b1b17" stroke="none"/>`,
    driftwood: () => `<path d="M6 52 Q14 46 26 48 L40 40 Q46 30 44 22 L50 22 Q54 34 48 44 L56 50 Q60 54 54 56 L12 58 Q4 58 6 52Z" fill="#d8c8a8"/><path d="M26 48 L40 40 M20 54 L48 54" fill="none" stroke="#a89878" stroke-width="1.6"/><path d="M44 22 L40 14 M50 22 L54 14" fill="none" stroke-width="3"/>`,
    // crabe mort : sur le dos, carapace délavée, pattes repliées en l'air, pinces molles, yeux en croix
    crab: () => `<ellipse cx="32" cy="55" rx="22" ry="3.4" fill="#000" opacity=".18" stroke="none"/>` +
        `<path d="M14 44 Q4 40 6 30 L14 32 L12 38 L18 40Z M50 44 Q60 40 58 30 L50 32 L52 38 L46 40Z" fill="#c8a898"/>` +
        `<path d="M16 38 L8 24 M22 34 L16 18 M42 34 L48 18 M48 38 L56 24" fill="none" stroke-width="5"/><path d="M16 38 L8 24 M22 34 L16 18 M42 34 L48 18 M48 38 L56 24" fill="none" stroke="#c8a898" stroke-width="2.2"/>` +
        `<ellipse cx="32" cy="46" rx="19" ry="11" fill="#d8c0b0"/><path d="M16 46 Q32 38 48 46 Q32 56 16 46Z" fill="#ecdccc" stroke-width="1.4"/><path d="M22 46 L42 46 M24 42 L40 42 M24 50 L40 50" fill="none" stroke="#b8a090" stroke-width="1.2"/>` +
        `<path d="M26 34 L30 38 M30 34 L26 38 M34 34 L38 38 M38 34 L34 38" fill="none" stroke-width="1.8"/>`,
    starfish: () => `<path d="M32 8 L38 26 L58 26 L42 38 L48 56 L32 45 L16 56 L22 38 L6 26 L26 26Z" fill="#f08a5a"/><path d="M32 18 L32 38 M18 30 L46 36 M46 30 L18 36" fill="none" stroke="#c8603a" stroke-width="1.4"/><circle cx="32" cy="30" r="2" fill="#fbd0a8" stroke="none"/>`,
    seaweed: () => `<path d="M14 58 Q8 44 16 34 Q22 24 14 10 M30 58 Q24 40 34 28 Q40 18 32 4 M46 58 Q40 46 48 36 Q54 28 48 18" fill="none" stroke-width="7"/><path d="M14 58 Q8 44 16 34 Q22 24 14 10 M30 58 Q24 40 34 28 Q40 18 32 4 M46 58 Q40 46 48 36 Q54 28 48 18" fill="none" stroke="#3a8a5a" stroke-width="3.6" stroke-linecap="round"/>`,
    kelp: () => `<path d="M20 58 Q10 44 22 34 Q30 24 18 8 M42 58 Q32 42 44 30 Q50 20 40 6" fill="none" stroke-width="8"/><path d="M20 58 Q10 44 22 34 Q30 24 18 8 M42 58 Q32 42 44 30 Q50 20 40 6" fill="none" stroke="#4a7a3a" stroke-width="4.4" stroke-linecap="round"/><ellipse cx="24" cy="26" rx="3" ry="5" fill="#6a9a4a"/><ellipse cx="40" cy="34" rx="3" ry="5" fill="#6a9a4a"/>`,
    anemone: () => `<ellipse cx="32" cy="54" rx="22" ry="6" fill="#4a6a7a"/><path d="M14 54 Q10 36 16 26 M22 54 Q20 32 24 20 M32 54 L32 16 M42 54 Q44 32 40 20 M50 54 Q54 36 48 26" fill="none" stroke-width="6"/><path d="M14 54 Q10 36 16 26 M22 54 Q20 32 24 20 M32 54 L32 16 M42 54 Q44 32 40 20 M50 54 Q54 36 48 26" fill="none" stroke="#e8609a" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="26" r="2.4" fill="#ffd0e8" stroke="none"/><circle cx="32" cy="16" r="2.4" fill="#ffd0e8" stroke="none"/><circle cx="48" cy="26" r="2.4" fill="#ffd0e8" stroke="none"/>`,
    hermit: () => `<path d="M22 56 Q8 40 22 26 Q34 16 46 28 Q54 40 46 52 Q40 58 22 56Z" fill="#e8c8a0"/><path d="M22 56 Q10 40 24 28 M30 22 Q22 36 34 48 M42 28 Q34 38 44 50" fill="none" stroke="#b8946a" stroke-width="1.6"/><path d="M10 54 L16 48 L22 56Z" fill="#e0603a"/><circle cx="10" cy="50" r="2" fill="#2b1b17" stroke="none"/>`,
    tidestone: () => `<rect x="20" y="10" width="24" height="46" rx="3" fill="#8a9aa4"/><path d="M20 24 L44 24 M20 36 L44 36 M20 46 L44 46" fill="none" stroke="#5a6a74" stroke-width="1.6"/><path d="M24 30 L26 34 M32 40 L35 44 M26 50 L30 52" fill="none" stroke="#3a8a5a" stroke-width="2"/><path d="M10 58 Q32 52 54 58" fill="none" stroke="#5aa0c8" stroke-width="3"/>`,
    sunflower: () => `<path d="M32 58 L32 28" fill="none" stroke-width="6"/><path d="M32 58 L32 28" fill="none" stroke="#5a9a3a" stroke-width="3"/><path d="M32 46 Q20 40 16 46 Q24 52 32 48Z" fill="#6aaa44"/><g fill="#f2b82a"><circle cx="32" cy="10" r="5"/><circle cx="42" cy="16" r="5"/><circle cx="44" cy="28" r="5"/><circle cx="20" cy="16" r="5"/><circle cx="18" cy="28" r="5"/></g><circle cx="32" cy="20" r="9" fill="#8a4a1a"/><circle cx="29" cy="18" r="2" fill="#b8742a" stroke="none"/>`,
    fusroot: () => `<path d="M4 58 Q10 40 22 36 Q20 22 30 14 Q36 22 34 36 Q46 38 54 58 L46 58 Q40 46 32 46 Q26 46 22 58Z" fill="#8a4a30"/><path d="M30 14 Q36 22 34 36 Q46 38 54 58 L46 58 Q40 46 34 44Z" fill="#5a2c1c" stroke="none"/><path d="M26 28 L28 44 M14 52 L18 46" fill="none" stroke="#e8a82a" stroke-width="1.8"/>`,
    goldleaves: () => `<g fill="#f2c040"><path d="M8 52 Q14 40 26 44 Q22 56 8 52Z"/><path d="M24 40 Q32 26 46 32 Q40 46 24 40Z"/><path d="M36 54 Q44 44 56 48 Q52 58 36 54Z"/></g><path d="M10 52 L22 46 M26 38 L42 34 M38 54 L52 49" fill="none" stroke="#c8801a" stroke-width="1.4"/><path d="M20 30 Q24 22 30 24 Q28 32 20 30Z" fill="#e8742e" stroke-width="1.4"/>`,
    blackfeather: () => `<path d="M12 56 Q18 28 44 8 Q52 28 40 44 Q28 54 12 56Z" fill="#2e2a3a"/><path d="M12 56 L44 8" fill="none" stroke="#6a5a8a" stroke-width="1.8"/><path d="M22 44 L34 40 M26 34 L38 28 M30 26 L42 20" fill="none" stroke="#6a5a8a" stroke-width="1.2"/><circle cx="38" cy="22" r="1.6" fill="#f2c040" stroke="none"/>`,
    meteorite: () => `<path d="M8 52 L12 36 L24 26 L42 28 L54 40 L56 52 L42 58 L20 58Z" fill="#6a6870"/><path d="M42 28 L54 40 L56 52 L42 58 L38 40Z" fill="#4a4850" stroke="none"/><ellipse cx="22" cy="42" rx="5" ry="3.4" fill="#4a4850" stroke-width="1.4"/><ellipse cx="38" cy="50" rx="4" ry="2.6" fill="#3a3840" stroke-width="1.4"/><circle cx="26" cy="32" r="1.6" fill="#c8d0f0" stroke="none"/>`,
    mooncrystal: () => `<path d="M10 58 L14 34 L22 22 L28 34 L30 58Z" fill="#b8c4f4"/><path d="M26 58 L30 18 L36 4 L42 18 L46 58Z" fill="#d4dcff"/><path d="M44 58 L46 36 L52 28 L58 38 L58 58Z" fill="#9aa8e4"/><path d="M36 4 L42 18 L46 58 L38 58 L38 20Z" fill="#8a98d8" stroke="none"/><path d="M33 14 L33 30 M18 30 L20 42" fill="none" stroke="#fff" stroke-width="2"/>`,
    brokenpillar: () => `<rect x="12" y="52" width="40" height="7" rx="1.6" fill="#b8b4c8"/><path d="M18 52 L18 24 L24 18 L30 24 L36 14 L46 22 L46 52Z" fill="#d8d6e8"/><path d="M36 14 L46 22 L46 52 L40 52 L40 24Z" fill="#a8a4bc" stroke="none"/><path d="M24 24 L24 52 M30 28 L30 52" fill="none" stroke="#9a96b0" stroke-width="1.4"/><path d="M4 58 L14 56 M50 58 L60 56" fill="none" stroke-width="2.4"/>`,
    moonflower: () => `<path d="M32 58 Q30 44 32 30" fill="none" stroke-width="5"/><path d="M32 58 Q30 44 32 30" fill="none" stroke="#8aa8a0" stroke-width="2.4"/><g fill="#f4f0ff"><ellipse cx="32" cy="16" rx="5" ry="10"/><ellipse cx="22" cy="24" rx="5" ry="10" transform="rotate(-50 22 24)"/><ellipse cx="42" cy="24" rx="5" ry="10" transform="rotate(50 42 24)"/></g><circle cx="32" cy="26" r="4" fill="#b8a0f0"/><path d="M20 52 Q26 46 32 50 M44 52 Q38 46 32 50" fill="none" stroke="#8aa8a0" stroke-width="2.4"/>`,
    whiterabbit: () => `<ellipse cx="32" cy="46" rx="16" ry="12" fill="#f6f4ff"/><circle cx="32" cy="30" r="10" fill="#f6f4ff"/><path d="M26 24 Q22 8 28 4 Q32 10 30 22Z M38 24 Q42 8 36 4 Q32 10 34 22Z" fill="#f6f4ff"/><circle cx="28" cy="30" r="1.8" fill="#c8402e" stroke="none"/><circle cx="36" cy="30" r="1.8" fill="#c8402e" stroke="none"/><path d="M30 35 L34 35 M32 35 L32 38" fill="none" stroke-width="1.4"/><circle cx="44" cy="54" r="4" fill="#f6f4ff"/>`,
    embers: () => `<ellipse cx="32" cy="48" rx="24" ry="9" fill="#2a2024"/><g stroke="none"><circle cx="18" cy="46" r="3.4" fill="#ff5a1f"/><circle cx="30" cy="50" r="4" fill="#ff8a2e"/><circle cx="44" cy="46" r="3" fill="#ff5a1f"/><circle cx="36" cy="44" r="2" fill="#ffd24a"/><circle cx="24" cy="40" r="1.6" fill="#ffd24a"/><circle cx="40" cy="34" r="1.6" fill="#ff8a2e"/><circle cx="14" cy="34" r="1.4" fill="#ff8a2e"/></g>`,
    obsidian: () => `<path d="M10 58 L16 30 L26 16 L34 30 L36 58Z" fill="#241e2c"/><path d="M30 58 L38 24 L46 12 L54 30 L56 58Z" fill="#2e2638"/><path d="M26 16 L34 30 L36 58 L30 58 L28 30Z" fill="#14101a" stroke="none"/><path d="M18 36 L20 30 M42 26 L46 18" fill="none" stroke="#8a78c8" stroke-width="2.2"/>`,
    dragonstatue: () => `<rect x="12" y="50" width="40" height="8" rx="2" fill="#6a5a48"/><path d="M18 50 Q14 36 22 28 Q16 20 24 14 Q30 10 38 14 L44 12 L42 20 Q46 28 40 34 Q48 40 46 50Z" fill="#8a7a58"/><path d="M40 34 Q48 40 46 50 L38 50 Q42 42 36 36Z" fill="#6a5a3a" stroke="none"/><circle cx="34" cy="18" r="2" fill="#ff5a1f" stroke="none"/><path d="M24 14 L22 6 M30 12 L30 4 M38 14 L42 6" fill="none" stroke-width="3"/><path d="M22 36 L36 34 M22 44 L40 42" fill="none" stroke="#5a4a2c" stroke-width="1.6"/>`,
    blastedtree: () => `<path d="M26 58 L27 30 L20 16 L26 20 L30 6 L34 22 L40 14 L38 32 L40 58Z" fill="#5a4a40"/><path d="M33 8 L30 24 L36 24 L31 40" fill="none" stroke="#f2e060" stroke-width="2.6"/><path d="M27 30 L14 24 M38 32 L50 24" fill="none" stroke-width="4"/><path d="M27 30 L14 24 M38 32 L50 24" fill="none" stroke="#5a4a40" stroke-width="1.6"/>`,
    brokenpost: () => `<path d="M26 58 L26 26 L30 20 L34 28 L38 22 L38 58Z" fill="#7a6a58"/><path d="M26 34 L38 36 M26 46 L38 48" fill="none" stroke="#4a3e30" stroke-width="1.6"/><path d="M42 58 L52 40 L56 44 L48 58Z" fill="#6a5a48"/><path d="M12 58 L28 58" fill="none" stroke="#4a3e30" stroke-width="3"/>`,
    fallenbranch: () => `<path d="M4 50 L24 44 L36 46 L58 38 L60 44 L40 54 L22 52 L6 56Z" fill="#6a5a46"/><path d="M24 44 L22 34 L28 30 L30 44 M42 50 L48 58 L52 52" fill="#6a5a46"/><path d="M10 52 L30 48 M38 50 L54 44" fill="none" stroke="#3e3226" stroke-width="1.4"/>`,
    standingstone: () => `<path d="M20 58 L18 24 L26 8 L38 12 L44 28 L44 58Z" fill="#a8a29a"/><path d="M38 12 L44 28 L44 58 L36 58 L36 24Z" fill="#7a746c" stroke="none"/><path d="M24 24 L30 24 M24 34 Q30 30 36 34 M26 44 L34 44" fill="none" stroke="#5a544c" stroke-width="1.6"/>`,
    drygrass: () => `<path d="M14 58 Q10 40 4 30 M22 58 Q22 38 20 22 M32 58 Q34 40 40 24 M42 58 Q46 44 56 38 M50 58 Q54 50 62 48" fill="none" stroke-width="5"/><path d="M14 58 Q10 40 4 30 M22 58 Q22 38 20 22 M32 58 Q34 40 40 24 M42 58 Q46 44 56 38 M50 58 Q54 50 62 48" fill="none" stroke="#d8b868" stroke-width="2.2"/>`,
    // Décors des Rizières asséchées (obstacles et décoration à l'échelle d'une case).
    deadreed: () => `<path d="M16 58 Q12 36 8 14 M24 58 Q22 34 24 8 M32 58 Q32 30 38 12 M40 58 Q44 34 50 16 M48 58 Q52 40 58 28" fill="none" stroke-width="5"/>` +
        `<path d="M16 58 Q12 36 8 14 M24 58 Q22 34 24 8 M32 58 Q32 30 38 12 M40 58 Q44 34 50 16 M48 58 Q52 40 58 28" fill="none" stroke="#c8b070" stroke-width="2.4"/>` +
        `<path d="M8 14 L4 18 M24 8 L20 12 M24 8 L28 12 M38 12 L34 16 M50 16 L55 20 M30 38 Q20 34 14 40 M34 34 Q44 28 52 34" fill="none" stroke="#a08850" stroke-width="2"/><path d="M12 58 L52 58" fill="none" stroke="#8a6a3a" stroke-width="3"/>`,
    stump: () => `<path d="M12 58 Q14 50 16 46 L16 28 Q32 22 48 28 L48 46 Q50 50 52 58Z" fill="#7a5632"/><path d="M36 28 L48 28 L48 46 Q50 50 52 58 L40 58 L40 40Z" fill="#5a3e22" stroke="none"/>` +
        `<ellipse cx="32" cy="27" rx="17" ry="7" fill="#c8a060"/><ellipse cx="32" cy="27" rx="11" ry="4.4" fill="none" stroke="#8a6a3a" stroke-width="1.4"/><ellipse cx="32" cy="27" rx="5" ry="2" fill="none" stroke="#8a6a3a" stroke-width="1.2"/>` +
        `<path d="M20 34 L20 50 M27 32 L27 46" fill="none" stroke="#4a3018" stroke-width="1.4"/><path d="M12 58 Q8 56 5 58 M52 58 Q56 56 59 58" fill="none" stroke-width="2.4"/>`,
    fence: () => `<path d="M6 58 L6 22 L12 18 L18 22 L18 58Z M28 58 L28 18 L34 14 L40 18 L40 58Z M50 58 L50 24 L56 20 L62 24 L62 58Z" fill="#8a6a3a"/>` +
        `<path d="M2 28 L66 32 L66 38 L2 34Z" fill="#a8864a"/><path d="M2 44 L24 46 L30 52 L8 50Z M40 46 L66 46 L66 52 L44 52Z" fill="#a8864a"/>` +
        `<path d="M12 18 L12 58 M34 14 L34 58 M56 20 L56 58" fill="none" stroke="#5a3e22" stroke-width="1.4"/>`,
    scarecrow: () => `<path d="M32 60 L32 14" fill="none" stroke-width="6"/><path d="M32 60 L32 14" fill="none" stroke="#8a6a3a" stroke-width="3"/><path d="M8 28 L56 28" fill="none" stroke-width="6"/><path d="M8 28 L56 28" fill="none" stroke="#8a6a3a" stroke-width="3"/>` +
        `<path d="M22 28 L24 50 L40 50 L42 28Z" fill="#a8885a"/><path d="M26 34 L30 36 M36 40 L38 44" fill="none" stroke="#6a4e2a" stroke-width="1.4"/><circle cx="32" cy="20" r="7" fill="#e2c88a"/><circle cx="29.6" cy="19" r="1.2" fill="#2b1b17" stroke="none"/><circle cx="34.4" cy="19" r="1.2" fill="#2b1b17" stroke="none"/>` +
        `<path d="M16 15 Q32 2 48 15 L40 17 Q32 12 24 17Z" fill="#d8b050"/><path d="M6 26 L2 32 M10 30 L6 36 M54 30 L58 36 M58 26 L62 32 M26 50 L24 58 M38 50 L40 58" fill="none" stroke="#d8b050" stroke-width="2.4"/>`,
    tools: () => `<path d="M16 58 L16 8" fill="none" stroke-width="5"/><path d="M16 58 L16 8" fill="none" stroke="#8a6a3a" stroke-width="2.4"/><path d="M16 8 L34 10 L34 20 L22 16Z" fill="#9a9aa0"/>` +
        `<path d="M32 58 L40 14" fill="none" stroke-width="5"/><path d="M32 58 L40 14" fill="none" stroke="#8a6a3a" stroke-width="2.4"/><path d="M34 14 L52 12 M36 14 L36 24 M41 14 L41 24 M46 14 L46 24 M51 12 L51 22" fill="none" stroke-width="2.8"/>` +
        `<path d="M34 14 L52 12" fill="none" stroke="#9a9aa0" stroke-width="1.2"/><path d="M48 58 L58 44 L62 48 L52 58Z" fill="#a8864a"/><path d="M8 58 L56 58" fill="none" stroke="#8a6a3a" stroke-width="2.4"/>`,
    brokenjar: () => `<path d="M16 24 L22 18 L26 24 L32 16 L38 24 L44 18 L48 24 Q56 38 46 52 Q40 58 32 58 Q24 58 18 52 Q8 38 16 24Z" fill="#b8683a"/><path d="M40 24 Q54 38 46 52 Q40 58 36 58 Q46 44 40 24Z" fill="#8a4a28" stroke="none"/>` +
        `<path d="M18 30 Q32 34 46 30 M16 40 Q32 44 48 40" fill="none" stroke="#e0a060" stroke-width="1.6"/><path d="M26 28 L30 40 L26 50" fill="none" stroke-width="1.6"/><path d="M52 52 L60 46 L62 54Z" fill="#b8683a"/>`,
    // Dangers du Volcan : fissure brûlante, évent de vapeur, geyser (sprites seuls, la mécanique reste à définir).
    fissure: () => `<ellipse cx="32" cy="44" rx="28" ry="12" fill="#2a2024"/><path d="M6 44 L16 40 L22 48 L32 38 L40 48 L50 40 L58 46" fill="none" stroke-width="6"/><path d="M6 44 L16 40 L22 48 L32 38 L40 48 L50 40 L58 46" fill="none" stroke="#ff5a1f" stroke-width="3"/>` +
        `<path d="M16 40 L22 48 L32 38 L40 48" fill="none" stroke="#ffd24a" stroke-width="1.4"/><path d="M20 34 Q18 28 22 24 M34 32 Q32 24 36 18 M46 34 Q44 28 48 24" fill="none" stroke="#ff8a3a" stroke-width="2"/>`,
    vent: () => `<path d="M8 58 Q10 42 20 38 L44 38 Q54 42 56 58Z" fill="#5a4e52"/><path d="M44 38 Q54 42 56 58 L46 58 Q46 46 38 38Z" fill="#3e3438" stroke="none"/><ellipse cx="32" cy="38" rx="12" ry="4.4" fill="#1d1719"/>` +
        `<path d="M28 34 Q22 26 28 20 Q22 14 30 8 M36 34 Q42 26 36 18 Q42 12 36 6" fill="none" stroke-width="7" opacity=".5"/><path d="M28 34 Q22 26 28 20 Q22 14 30 8 M36 34 Q42 26 36 18 Q42 12 36 6" fill="none" stroke="#e8e4e0" stroke-width="4" stroke-linecap="round"/>`,
    geyser: () => `<path d="M6 58 Q8 46 18 44 L46 44 Q56 46 58 58Z" fill="#8a7e72"/><path d="M46 44 Q56 46 58 58 L48 58 Q48 50 40 44Z" fill="#665c52" stroke="none"/><ellipse cx="32" cy="44" rx="12" ry="4" fill="#3a8ab8"/>` +
        `<path d="M32 42 L32 8" fill="none" stroke-width="12"/><path d="M32 42 L32 8" fill="none" stroke="#bfe6f6" stroke-width="8" stroke-linecap="round"/><path d="M28 36 L28 18 M36 30 L36 14" fill="none" stroke="#ffffff" stroke-width="2"/>` +
        `<circle cx="22" cy="14" r="3.4" fill="#e6f6fc"/><circle cx="43" cy="10" r="3" fill="#e6f6fc"/><circle cx="46" cy="22" r="2.4" fill="#e6f6fc"/>`,
    // Décors du Volcan (obstacles à l'échelle d'une case) : orgues de basalte, cristaux de braise, arbre calciné, ossements, champignons luminescents.
    basalt: () => `<path d="M8 58 L8 34 L16 28 L26 32 L26 58Z" fill="#4a4448"/><path d="M26 58 L26 22 L34 14 L44 18 L44 58Z" fill="#524c50"/><path d="M44 58 L44 36 L52 30 L58 34 L58 58Z" fill="#403a3e"/>` +
        `<path d="M8 34 L16 28 L26 32 L16 38Z" fill="#6c6468" stroke-width="1.4"/><path d="M26 22 L34 14 L44 18 L34 26Z" fill="#7a7276" stroke-width="1.4"/><path d="M44 36 L52 30 L58 34 L50 40Z" fill="#605a5e" stroke-width="1.4"/>` +
        `<path d="M34 26 L34 58 M16 38 L16 58 M50 40 L50 58" fill="none" stroke="#2b1b17" stroke-width="1.6"/><path d="M30 40 L32 46 L30 52" fill="none" stroke="#ff5a1f" stroke-width="1.8"/><path d="M12 46 L14 52" fill="none" stroke="#ff7a2e" stroke-width="1.6"/>`,
    vcrystal: () => `<path d="M10 58 L14 36 L20 26 L26 36 L28 58Z" fill="#c8402a"/><path d="M24 58 L28 24 L34 6 L40 24 L44 58Z" fill="#e0582e"/><path d="M42 58 L44 40 L50 32 L55 42 L56 58Z" fill="#a8322a"/>` +
        `<path d="M34 6 L40 24 L44 58 L36 58 L36 24Z" fill="#8a2a1e" stroke="none"/><path d="M20 26 L26 36 L28 58 L22 58 L22 36Z" fill="#8a2a1e" stroke="none"/>` +
        `<path d="M30 20 L33 10 M16 36 L19 30" fill="none" stroke="#ffb878" stroke-width="2.2"/><ellipse cx="34" cy="40" rx="5" ry="9" fill="#ffd24a" opacity=".45" stroke="none"/><circle cx="34" cy="8" r="2" fill="#fff0b0" stroke="none"/>`,
    charred: () => `<path d="M28 58 L29 30 L26 18 L30 8 L34 20 L36 30 L38 58Z" fill="#241c1a"/><path d="M29 36 L18 28 L14 18 L18 22 L24 26 Z M36 28 L46 22 L50 12 L52 20 L42 32Z" fill="#241c1a"/>` +
        `<path d="M31 14 L30 28 M33 34 L34 52" fill="none" stroke="#4a3a34" stroke-width="1.6"/><path d="M30 44 L31 50 M35 38 L36 44" fill="none" stroke="#ff5a1f" stroke-width="2"/><circle cx="14" cy="17" r="1.6" fill="#ff8a3a" stroke="none"/><circle cx="52" cy="11" r="1.6" fill="#ff8a3a" stroke="none"/>` +
        `<path d="M20 58 L44 58" fill="none" stroke="#3a3034" stroke-width="3"/>`,
    bones: () => `<path d="M8 50 Q10 30 30 30 Q50 30 52 50" fill="none" stroke-width="5"/><path d="M8 50 Q10 30 30 30 Q50 30 52 50" fill="none" stroke="#efe6cc" stroke-width="2.4"/>` +
        `<path d="M16 46 Q30 36 44 46 M20 52 Q30 44 40 52" fill="none" stroke="#d8cfb4" stroke-width="2"/>` +
        `<path d="M10 56 L54 52" fill="none" stroke-width="5"/><path d="M10 56 L54 52" fill="none" stroke="#efe6cc" stroke-width="2.4"/><circle cx="9" cy="55" r="3.4" fill="#efe6cc"/><circle cx="55" cy="51" r="3.4" fill="#efe6cc"/>` +
        `<path d="M22 32 Q22 14 34 14 Q46 14 46 28 L44 38 L26 38Z" fill="#efe6cc"/><circle cx="30" cy="26" r="3.6" fill="#2b1b17" stroke="none"/><circle cx="40" cy="26" r="3.6" fill="#2b1b17" stroke="none"/><path d="M34 32 L36 32 M28 38 L28 34 M32 38 L32 34 M36 38 L36 34 M40 38 L40 34" fill="none" stroke-width="1.4"/>`,
    glowmush: () => `<ellipse cx="30" cy="40" rx="26" ry="16" fill="#40e8c8" opacity=".22" stroke="none"/><path d="M20 58 L21 40 L27 40 L28 58Z" fill="#cfe8dc"/><path d="M8 42 Q10 22 24 22 Q38 22 40 42 Q24 46 8 42Z" fill="#2fc8b0"/>` +
        `<path d="M38 58 L38 46 L43 46 L44 58Z" fill="#cfe8dc"/><path d="M30 48 Q32 36 41 36 Q51 36 53 48 Q41 51 30 48Z" fill="#58f0d2"/>` +
        `<circle cx="18" cy="31" r="2.2" fill="#d8fff4" stroke="none"/><circle cx="29" cy="28" r="1.8" fill="#d8fff4" stroke="none"/><circle cx="36" cy="33" r="1.8" fill="#d8fff4" stroke="none"/><circle cx="43" cy="42" r="1.6" fill="#d8fff4" stroke="none"/>`,
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
export const DECOR_NAMES = [...Object.keys(D), ...Object.keys(SOULS_DECOR), 'deadtree'];

const cache = new Map();
export function decorSprite(name) {
    if (SOULS_DECOR[name]) return SOULS_DECOR[name].uri;   // décors du Royaume des âmes errantes en pixel art (tools/gen-souls-decor.mjs), sans dessin SVG
    if (!D[name]) return null;
    if (HOUSE_SPRITES[name]) return HOUSE_SPRITES[name].uri;   // mobilier de maison en pixel art (tools/gen-house-sprites.mjs), sinon le dessin SVG
    if (!cache.has(name)) cache.set(name, wrap(D[name]()));
    return cache.get(name);
}
