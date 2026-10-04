// Éléments de décor de la carte d'exploration et icônes de régions (carte du monde) : petits dessins SVG
// (viewBox 64x64, contour #2b1b17, base vers y = 58) qui remplacent les anciens emojis. decorSprite(nom) → chaîne SVG.

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const N = 'stroke="none"';
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g ${O}>${body}</g></svg>`;

const D = {
    rice: () => {
        let s = '';
        [[20, 58, 14, 12], [32, 58, 32, 8], [44, 58, 50, 12], [26, 58, 22, 18], [38, 58, 42, 16]].forEach(([x0, y0, x1, y1]) => {
            s += `<path d="M${x0} ${y0} Q${(x0 + x1) / 2} ${(y0 + y1) / 2 + 6} ${x1} ${y1}" fill="none" stroke="#7a9a3a" stroke-width="2.4"/>`;
            s += `<ellipse cx="${x1}" cy="${y1 + 4}" rx="3.4" ry="7" transform="rotate(${(x1 - 32) * 1.4} ${x1} ${y1 + 4})" fill="#e8c860"/>`;
        });
        return s;
    },
    lantern: () => `<path d="M32 4 L32 12" fill="none"/><rect x="25" y="11" width="14" height="4" rx="1.2" fill="#c9a448"/>` +
        `<path d="M18 30 Q18 15 32 15 Q46 15 46 30 Q46 45 32 45 Q18 45 18 30Z" fill="#d9302e"/>` +
        `<path d="M26 16 Q22 30 26 44 M38 16 Q42 30 38 44" fill="none" stroke="#a8281e" stroke-width="1.4"/>` +
        `<ellipse cx="32" cy="30" rx="7" ry="10" fill="#f6b24a" opacity=".4" ${N}/>` +
        `<rect x="25" y="44" width="14" height="4" rx="1.2" fill="#c9a448"/><path d="M29 48 L28 56 M32 48 L32 58 M35 48 L36 56" fill="none" stroke="#f2c14e" stroke-width="1.8"/>`,
    hut: () => `<rect x="14" y="32" width="36" height="25" fill="#c9a06a"/><rect x="28" y="40" width="9" height="17" fill="#6a4226"/>` +
        `<path d="M6 34 Q32 4 58 34 Q32 30 6 34Z" fill="#d8b860"/><path d="M14 30 L16 26 M22 25 L24 21 M40 21 L42 25 M48 26 L50 30 M31 18 L33 14" fill="none" stroke="#a8862a" stroke-width="1.4"/>` +
        `<rect x="17" y="38" width="7" height="6" fill="#f6e2a8"/>`,
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
    // Pierre de voyage (spirale gravée)
    swirl: () => `<circle cx="32" cy="32" r="26" fill="#cfe6f6"/><path d="M32 32 Q32 24 40 25.6 Q48 30.4 44 40 Q37.6 49.6 25.6 45.6 Q14.4 40 16 28 Q19.2 14.4 33.6 13.6" fill="none" stroke="#3a7ad8" stroke-width="4"/>`
};

export const DECOR_NAMES = Object.keys(D);

const cache = new Map();
export function decorSprite(name) {
    if (!D[name]) return null;
    if (!cache.has(name)) cache.set(name, wrap(D[name]()));
    return cache.get(name);
}
