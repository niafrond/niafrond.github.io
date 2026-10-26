// Architecture des biomes dessinée en SVG (pièces larges de 2 × 1 cases : viewBox 128 × 64, contour #2b1b17), non encore placée sur les cartes.
// Remplace les sprites pixel art générés qui n'étaient pas réussis (escaliers, pont de bois) : le SVG est plus net et plus léger.

const K = '#2b1b17';
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64"><g stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

export const BIOME_SVG = {
    // Pont de bois délabré au-dessus d'un fossé asséché : tablier de planches, une planche manquante, rambarde de corde rompue, pieux.
    paddy_bridge: wrap(
        `<path d="M0 54 Q64 46 128 54 L128 64 L0 64Z" fill="#8a6a3a" stroke="none"/><path d="M8 58 L16 54 L22 60 M50 60 L58 55 M92 58 L100 54 L106 60" fill="none" stroke="#5a4028" stroke-width="1.6"/>` +
        `<rect x="18" y="44" width="7" height="16" fill="#6a4e2a"/><rect x="58" y="44" width="7" height="14" fill="#6a4e2a"/><rect x="100" y="44" width="7" height="16" fill="#6a4e2a"/>` +
        `<rect x="4" y="34" width="120" height="11" fill="#a8864a"/><path d="M16 34 L16 45 M30 34 L30 45 M44 34 L44 45 M78 34 L78 45 M92 34 L92 45 M106 34 L106 45" fill="none" stroke="#6a4e2a" stroke-width="1.6"/>` +
        `<rect x="52" y="34" width="22" height="11" fill="#3a2a18" stroke="none"/><path d="M52 34 L56 36 L52 44 M74 34 L70 37 L74 44" fill="none"/><path d="M56 44 L66 40 L72 45Z" fill="#a8864a" stroke-width="1.6"/>` +
        `<rect x="8" y="14" width="6" height="22" fill="#8a6a3a"/><path d="M114 36 L116 22 L122 24 L120 36Z" fill="#8a6a3a"/><circle cx="11" cy="14" r="3" fill="#a8864a"/>` +
        `<path d="M12 18 Q30 32 50 26 M12 26 Q26 34 44 32" fill="none" stroke="#d8c088" stroke-width="2.4"/><path d="M50 26 L52 36 M118 26 Q104 36 86 32" fill="none" stroke="#d8c088" stroke-width="2.4"/>`),

    // Escalier de pierre qui plonge dans la mer : marches couvertes d'algues, vague en pied, balanes.
    tides_stairs: wrap(
        Array.from({ length: 7 }, (_, i) => `<rect x="${i * 18}" y="${6 + i * 8}" width="${128 - i * 18}" height="${64 - 6 - i * 8}" fill="#9aa6aa"/><rect x="${i * 18}" y="${6 + i * 8}" width="${128 - i * 18}" height="3" fill="#c4d0d4" stroke="none"/>`).join('') +
        `<path d="M70 46 Q82 42 94 47 Q106 52 128 46 L128 64 L60 64Z" fill="#3a8ab8" opacity=".85" stroke="none"/><path d="M64 52 Q78 49 92 53 Q108 57 128 52" fill="none" stroke="#bfe6f6" stroke-width="2"/>` +
        `<path d="M22 18 L22 26 M44 26 L44 34 M64 34 L64 40 M34 14 L38 18" fill="none" stroke="#3a8a5a" stroke-width="2.4"/><circle cx="12" cy="12" r="1.6" fill="#e8e4d8" stroke="none"/><circle cx="52" cy="28" r="1.6" fill="#e8e4d8" stroke="none"/><circle cx="82" cy="44" r="1.6" fill="#e8e4d8" stroke="none"/>`),

    // Escalier de jade de Fusang : marches qui s'élargissent vers le bas, balustrades à pommeaux dorés.
    fusang_stairs: wrap(
        `<path d="M44 6 L84 6 L100 58 L28 58Z" fill="#5aae88"/>` +
        [0, 1, 2, 3, 4].map(i => `<path d="M${44 - i * 4} ${8 + i * 10} L${84 + i * 4} ${8 + i * 10} L${86 + i * 4} ${16 + i * 10} L${42 - i * 4} ${16 + i * 10}Z" fill="#6cc29c"/><path d="M${44 - i * 4} ${8 + i * 10} L${84 + i * 4} ${8 + i * 10}" fill="none" stroke="#a8ecc8" stroke-width="2"/>`).join('') +
        `<path d="M40 6 L14 56 L24 58 L46 8Z M88 6 L114 56 L104 58 L82 8Z" fill="#8a2a1e"/><path d="M38 8 L16 52 M90 8 L112 52" fill="none" stroke="#f2c040" stroke-width="2"/>` +
        `<circle cx="42" cy="5" r="5" fill="#f2c040"/><circle cx="86" cy="5" r="5" fill="#f2c040"/><circle cx="14" cy="57" r="6" fill="#f2c040"/><circle cx="114" cy="57" r="6" fill="#f2c040"/>`),

    // Escalier flottant de jade blanc de la Lune : marches qui montent dans le vide, nuages en dessous, éclats d'étoile.
    moon_stairs: wrap(
        `<ellipse cx="30" cy="58" rx="22" ry="5" fill="#d8dcf0" opacity=".7" stroke="none"/><ellipse cx="82" cy="52" rx="24" ry="5" fill="#d8dcf0" opacity=".6" stroke="none"/><ellipse cx="108" cy="30" rx="14" ry="4" fill="#d8dcf0" opacity=".5" stroke="none"/>` +
        Array.from({ length: 6 }, (_, i) => `<rect x="${6 + i * 19}" y="${50 - i * 7}" width="22" height="9" fill="#e8ecf8"/><rect x="${6 + i * 19}" y="${50 - i * 7}" width="22" height="3" fill="#ffffff" stroke="none"/><path d="M${6 + i * 19} ${59 - i * 7} L${28 + i * 19} ${59 - i * 7} L${24 + i * 19} ${64 - i * 7}Z" fill="#b8a8e8" stroke-width="1.6"/>`).join('') +
        `<path d="M112 6 L114 12 L120 14 L114 16 L112 22 L110 16 L104 14 L110 12Z" fill="#fff8b8" stroke="none"/><path d="M14 24 L15 27 L18 28 L15 29 L14 32 L13 29 L10 28 L13 27Z" fill="#fff8b8" stroke="none"/>`)
};

export const biomeSvg = id => BIOME_SVG[id] || null;
