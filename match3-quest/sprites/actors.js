// Sprites SVG des acteurs (heros, PNJ, coffres) - style chibi RPG, viewBox 64x64.
// Les helpers ci-dessous ne servent qu'a factoriser le contour et les yeux ; chaque export est une chaine SVG autonome.

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

// Yeux : points fonces + reflet blanc.
const eyes = (y = 25, dx = 5.2) =>
  `<circle cx="${32 - dx}" cy="${y}" r="1.6" fill="${K}"/><circle cx="${32 + dx}" cy="${y}" r="1.6" fill="${K}"/>` +
  `<circle cx="${32 - dx + 0.6}" cy="${y - 0.6}" r="0.6" fill="#fff"/><circle cx="${32 + dx + 0.6}" cy="${y - 0.6}" r="0.6" fill="#fff"/>`;
const cheeks = (y = 29.5, dx = 8.5) =>
  `<ellipse cx="${32 - dx}" cy="${y}" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".4"/><ellipse cx="${32 + dx}" cy="${y}" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".4"/>`;
const smile = (y = 30) => `<path d="M30 ${y} Q32 ${y + 2} 34 ${y}" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>`;
// Tete : aplat, ombre en croissant (bas/droite), contour par-dessus, reflet.
const head = (skin, shade, cy = 24, rx = 14, ry = 12) => {
  const p = (t) => `${(32 + rx * Math.cos(t)).toFixed(1)} ${(cy + ry * Math.sin(t)).toFixed(1)}`;
  const a = Math.PI / 6, b = (100 * Math.PI) / 180;
  return `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>` +
    `<path d="M${p(a)} A${rx} ${ry} 0 0 1 ${p(b)} Q${32 + rx * 0.45} ${cy + ry * 0.7} ${p(a)}Z" fill="${shade}"/>` +
    `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" ${O}/>` +
    `<ellipse cx="${32 - rx * 0.45}" cy="${cy - ry * 0.55}" rx="2.6" ry="1.3" fill="#fff" opacity=".45" transform="rotate(-25 ${32 - rx * 0.45} ${cy - ry * 0.55})"/>`;
};
const hand = (x, y, c = '#f5cba7') => `<circle cx="${x}" cy="${y}" r="2.7" fill="${c}" ${O}/>`;
const feet = (c, y = 57, rx = 4.4) =>
  `<ellipse cx="26.5" cy="${y}" rx="${rx}" ry="2.6" fill="${c}" ${O}/><ellipse cx="37.5" cy="${y}" rx="${rx}" ry="2.6" fill="${c}" ${O}/>`;
const SKIN = '#f5cba7', SKIN_D = '#e0a582';

export const HERO_SPRITES = {
  sorcerer: svg(
    `<defs><radialGradient id="sorcerer-g1" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#eafcff"/><stop offset=".5" stop-color="#5fd0f0"/><stop offset="1" stop-color="#2a7fc0"/></radialGradient></defs>` +
    `<rect x="48" y="12" width="3.4" height="46" rx="1.7" fill="#8a5a33" ${O}/>` +
    `<circle cx="49.7" cy="9" r="5" fill="url(#sorcerer-g1)" ${O}/><circle cx="48.2" cy="7.4" r="1.3" fill="#fff"/>` +
    feet('#6b4226') +
    `<ellipse cx="32" cy="29" rx="16.5" ry="13" fill="#8a4b2a" ${O}/>` +
    `<path d="M20 56 Q18.5 44 23 35 L41 35 Q45.5 44 44 56 Q32 58.5 20 56Z" fill="#5b4bb5" ${O}/>` +
    `<path d="M38 37 Q43 45 42 55 L37 55.5 Q40 46 38 37Z" fill="#3e3290"/>` +
    `<path d="M20.5 53.5 Q32 56.5 43.5 53.5" fill="none" stroke="#f2c14e" stroke-width="1.6" stroke-linecap="round"/>` +
    `<rect x="24" y="43" width="16" height="3" rx="1.2" fill="#f2c14e" ${O}/>` +
    `<ellipse cx="20.5" cy="43" rx="3.6" ry="6.2" transform="rotate(14 20.5 43)" fill="#5b4bb5" ${O}/>` + hand(19, 49.5) +
    `<ellipse cx="44.5" cy="42" rx="3.6" ry="6" transform="rotate(-18 44.5 42)" fill="#3e3290" ${O}/>` + hand(49.7, 45.5) +
    head(SKIN, SKIN_D, 26, 13.5, 11) + eyes(27.5) + `<path d="M28.6 24.6 L35.4 24.2" stroke="none"/>` +
    `<path d="M26 24.4 L29.4 25.2 M38 24.4 L34.6 25.2" stroke="${K}" stroke-width="1.2" stroke-linecap="round" fill="none"/>` +
    cheeks(31.5, 8.5) + `<path d="M30 32.4 Q32 33.6 34 32.4" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="18" rx="19" ry="5" fill="#4a3aa0" ${O}/>` +
    `<path d="M22 17 Q24 8 31 5 Q36 3 41.5 6.5 Q35 8 42 17.5 Q32 20 22 17Z" fill="#5b4bb5" ${O}/>` +
    `<path d="M36 12 L41 16.5 Q38 18.5 36 18Z" fill="#3e3290"/>` +
    `<path d="M22.6 16.4 Q32 19.6 41.6 17" fill="none" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M30 12 l1 2.2 2.3.2 -1.8 1.5 .6 2.3 -2.1-1.2 -2.1 1.2 .6-2.3 -1.8-1.5 2.3-.2z" fill="#ffe27a" transform="translate(-1.5 -3)"/>` +
    `<path d="M14 17.5 Q20 21 32 21.5" fill="none" stroke="#7e6fe0" stroke-width="1" opacity=".7"/>`
  ),

  assassin: svg(
    feet('#1f2030') +
    `<path d="M16 57 Q12 42 21.5 34 L42.5 34 Q52 42 48 57 Q32 60 16 57Z" fill="#24263a" ${O}/>` +
    `<path d="M44 38 Q49 46 47 56 L42 57 Q45 47 42.5 37Z" fill="#171826"/>` +
    `<path d="M22 56 Q21 45 24 35 L40 35 Q43 45 42 56 Q32 58 22 56Z" fill="#3b3f5e" ${O}/>` +
    `<path d="M38 37 Q41 45 40.5 55 L36.5 55.5 Q38.5 46 37 37Z" fill="#2a2d47"/>` +
    `<rect x="22.5" y="44" width="19" height="3.6" rx="1.4" fill="#c0392b" ${O}/><rect x="30" y="43.4" width="4" height="4.8" rx="1" fill="#e6b84a" ${O}/>` +
    `<path d="M17.5 46 L15.5 30.5 L19.5 30.5Z" fill="#dfe6ee" ${O}/><path d="M17.5 45 L17.4 32" stroke="#fff" stroke-width=".9"/>` +
    `<rect x="13.8" y="45.2" width="7.4" height="2" rx="1" fill="#c0392b" ${O}/>` +
    `<path d="M46.5 46 L44.5 30.5 L48.5 30.5Z" fill="#dfe6ee" ${O}/><path d="M46.5 45 L46.4 32" stroke="#fff" stroke-width=".9"/>` +
    `<rect x="42.8" y="45.2" width="7.4" height="2" rx="1" fill="#c0392b" ${O}/>` +
    `<ellipse cx="22" cy="42" rx="3.4" ry="5.5" transform="rotate(10 22 42)" fill="#3b3f5e" ${O}/>` + hand(18.5, 49.5, '#e8b98f') +
    `<ellipse cx="42" cy="42" rx="3.4" ry="5.5" transform="rotate(-10 42 42)" fill="#2a2d47" ${O}/>` + hand(45.5, 49.5, '#e8b98f') +
    `<path d="M15.5 27 Q13 8 32 5.5 Q51 8 48.5 27 Q49 37 32 37.5 Q15 37 15.5 27Z" fill="#3b3f5e" ${O}/>` +
    `<path d="M40 9 Q49 12 48 27 Q48.5 35 41 37 Q46 30 44 20 Q43 13 40 9Z" fill="#2a2d47"/>` +
    `<ellipse cx="32" cy="27" rx="10.5" ry="8.5" fill="${SKIN}" ${O}/>` +
    `<path d="M21.8 24 Q32 18 42.2 24 Q42 21 32 19 Q22 21 21.8 24Z" fill="#000" opacity=".3"/>` +
    `<path d="M22 29.5 Q32 27 42 29.5 Q41 35.5 32 36 Q23 35.5 22 29.5Z" fill="#8e2a3a" ${O}/>` +
    eyes(26.4, 5) + `<path d="M25 23.2 L29.6 24.6 M39 23.2 L34.4 24.6" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M22.5 11 Q26 7.5 30 7" fill="none" stroke="#6a6f96" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>`
  ),

  templar: svg(
    `<path d="M15 57 Q12 44 20 35 L44 35 Q52 44 49 57 Q32 60 15 57Z" fill="#2a5db0" ${O}/>` +
    `<path d="M44 38 Q50 46 48 56 L43 57 Q46 47 43 37Z" fill="#1b428a"/>` +
    feet('#7c8794') +
    `<path d="M22 56 Q21 45 23.5 35 L40.5 35 Q43 45 42 56 Q32 58 22 56Z" fill="#b7c2cf" ${O}/>` +
    `<path d="M27 37 L37 37 L38 56 Q32 57.5 26 56Z" fill="#f4f1e8" ${O}/>` +
    `<rect x="30.4" y="39" width="3.2" height="13" fill="#e6b84a"/><rect x="27.6" y="42.5" width="8.8" height="3" fill="#e6b84a"/>` +
    `<path d="M37 39 Q41 46 40.5 55 L38 55.5Z" fill="#8d99a8"/>` +
    `<circle cx="22" cy="37.5" r="4.4" fill="#c9d3de" ${O}/><circle cx="42" cy="37.5" r="4.4" fill="#9aa6b4" ${O}/>` +
    `<rect x="46.4" y="14" width="3.4" height="30" rx="1" fill="#e4ebf2" ${O}/><path d="M48 15 L48 42" stroke="#fff" stroke-width=".9"/>` +
    `<rect x="43.4" y="43" width="9.4" height="2.8" rx="1.2" fill="#e6b84a" ${O}/>` + hand(48.1, 47.5, '#9aa6b4') +
    `<ellipse cx="42.5" cy="43" rx="3" ry="5" transform="rotate(-10 42.5 43)" fill="#9aa6b4" ${O}/>` +
    `<path d="M9 40 Q9 37 12 36.5 L26 36.5 Q29 37 29 40 L29 47 Q29 55 19 59 Q9 55 9 47Z" fill="#2a5db0" ${O}/>` +
    `<path d="M20.5 38 L27.6 38 Q27.6 46 27 49 Q25 54.5 20.5 57Z" fill="#1b428a"/>` +
    `<rect x="17.6" y="40" width="3.6" height="14" rx="1" fill="#f4f1e8"/><rect x="12.6" y="44" width="13.6" height="3.6" rx="1" fill="#f4f1e8"/>` +
    `<path d="M11.2 39.2 L18 38.6" stroke="#fff" stroke-width="1" opacity=".6"/>` + hand(30.5, 47.5, '#9aa6b4') +
    head(SKIN, SKIN_D, 23, 13.5, 11.5) +
    `<path d="M18.5 22 Q19 8 32 7 Q45 8 45.5 22 Q40 17.5 32 17.5 Q24 17.5 18.5 22Z" fill="#b7c2cf" ${O}/>` +
    `<path d="M40 9 Q45 12 45.5 22 Q42.5 19 39 18Z" fill="#8d99a8"/>` +
    `<path d="M18.5 22 Q17.5 30 21.5 33.5 L23 31 Q21 27 22.2 22Z" fill="#b7c2cf" ${O}/>` +
    `<path d="M45.5 22 Q46.5 30 42.5 33.5 L41 31 Q43 27 41.8 22Z" fill="#8d99a8" ${O}/>` +
    `<path d="M32 7 L32 1.8 Q37 1.5 38.5 6" fill="none" stroke="#c0392b" stroke-width="3.4" stroke-linecap="round"/>` +
    `<path d="M22 12 Q25 9.5 28 9" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>` +
    eyes(24.6, 5.2) + `<path d="M25.6 21.6 L29.6 22.6 M38.4 21.6 L34.4 22.6" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>` +
    cheeks(28.6, 8) + `<path d="M30 30 L34 30" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  barbarian: svg(
    `<defs><linearGradient id="barbarian-g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8eef4"/><stop offset="1" stop-color="#8a97a6"/></linearGradient></defs>` +
    `<rect x="49" y="12" width="3.4" height="46" rx="1.5" fill="#7a4a26" ${O}/>` +
    `<path d="M50.7 8 Q42 6 40.5 15 Q43.5 22 50.7 20Z" fill="url(#barbarian-g1)" ${O}/>` +
    `<path d="M50.7 8 Q56 11 56.5 15.5 Q56 19.5 50.7 20Z" fill="#a3afbd" ${O}/>` +
    `<path d="M43 12 Q45 9.5 48 9.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="26.5" cy="56.5" rx="5" ry="3" fill="#8b5e3c" ${O}/><ellipse cx="37.5" cy="56.5" rx="5" ry="3" fill="#8b5e3c" ${O}/>` +
    `<rect x="21.5" y="47" width="21" height="8" rx="3" fill="#7a4a26" ${O}/>` +
    `<path d="M21.5 53 l2.5 3 2.5-3 2.5 3 2.5-3 2.5 3 2.5-3 2.5 3 2.5-3" fill="#e8d8b8" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M18 46 Q16.5 37 21.5 34.5 L42.5 34.5 Q47.5 37 46 46 Q32 50.5 18 46Z" fill="#e0a070" ${O}/>` +
    `<path d="M39 38 Q45 41 44.5 46 Q42 48 38 48.5Z" fill="#c4834f"/>` +
    `<path d="M32 36 L32 45 M24 41.5 Q28 44 31.4 41.6 M40 41.5 Q36 44 32.6 41.6" fill="none" stroke="#b6743f" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M20 35 Q32 32.5 44 35 Q45 40 43 41 Q32 37 21 41 Q19 40 20 35Z" fill="#8b5e3c" ${O}/>` +
    `<path d="M22 37 l1.5 2 1.5-2 1.5 2 1.5-2 M39 37 l1.5 2 1.5-2" stroke="#e8d8b8" stroke-width="1.4" fill="none" stroke-linejoin="round"/>` +
    `<ellipse cx="17" cy="41.5" rx="4.6" ry="6.6" transform="rotate(10 17 41.5)" fill="#e0a070" ${O}/><rect x="13.4" y="43.4" width="7.4" height="3.6" rx="1.4" fill="#7a4a26" ${O}/>` + hand(16, 50.5, '#e0a070') +
    `<ellipse cx="47" cy="41.5" rx="4.6" ry="6.6" transform="rotate(-10 47 41.5)" fill="#c4834f" ${O}/><rect x="43.4" y="43.4" width="7.4" height="3.6" rx="1.4" fill="#7a4a26" ${O}/>` + hand(50.6, 46, '#c4834f') +
    `<path d="M17 25 Q13 10 25 7 Q32 5 39 7 Q51 10 47 25 Q47 30 44 32 L20 32 Q17 30 17 25Z" fill="#c8561f" ${O}/>` +
    head('#e8b088', '#cf8f66', 25, 13.5, 11.5) +
    `<path d="M18.6 21 Q19 10.5 32 10 Q45 10.5 45.4 21 Q41 15.5 32 15.5 Q23 15.5 18.6 21Z" fill="#c8561f" ${O}/>` +
    `<path d="M22 13.5 Q26 11.5 30 11.5" fill="none" stroke="#f08a4a" stroke-width="1.3" stroke-linecap="round"/>` +
    eyes(26, 5.3) + `<path d="M25 22.8 L29.8 24.4 M39 22.8 L34.2 24.4" stroke="${K}" stroke-width="1.7" stroke-linecap="round"/>` +
    `<path d="M22 30.5 Q24 38 32 38.5 Q40 38 42 30.5 Q38 34.5 32 34.5 Q26 34.5 22 30.5Z" fill="#c8561f" ${O}/>` +
    `<path d="M30.2 32.2 L33.8 32.2" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>`
  ),
};

export const NPC_SPRITES = {
  maelle: svg(
    `<rect x="12.6" y="38" width="3.2" height="20" rx="1.4" fill="#8a5a33" ${O}/>` +
    `<path d="M14.2 38 Q14.2 33 19 34" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M14.2 38 Q14.2 33 19 34" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/>` +
    feet('#6b4226') +
    `<path d="M19.5 56 Q18 44 23 35 L41 35 Q46 44 44.5 56 Q32 58.5 19.5 56Z" fill="#6b7f99" ${O}/>` +
    `<path d="M39 38 Q44 46 43 55 L38 55.6 Q41 46 39 38Z" fill="#4f6079"/>` +
    `<path d="M20 53.6 Q32 56.6 44 53.6" fill="none" stroke="#e8d8b8" stroke-width="1.6" stroke-linecap="round"/>` +
    `<ellipse cx="20" cy="43" rx="3.5" ry="6" transform="rotate(12 20 43)" fill="#6b7f99" ${O}/>` + hand(15.4, 49) +
    `<ellipse cx="44" cy="43" rx="3.5" ry="6" transform="rotate(-12 44 43)" fill="#4f6079" ${O}/>` + hand(46.4, 49) +
    `<path d="M20.5 37 Q32 32.5 43.5 37 L38.5 51 Q32 54 25.5 51Z" fill="#b0587a" ${O}/>` +
    `<path d="M36 41 Q40 40 42 38 L38.5 50 Q36.5 51 35 51.6Z" fill="#8a3f5c"/>` +
    `<circle cx="27" cy="42" r="1.1" fill="#f4d6e2"/><circle cx="32" cy="46" r="1.1" fill="#f4d6e2"/><circle cx="36" cy="41.5" r="1.1" fill="#f4d6e2"/>` +
    `<path d="M25.5 51 l1.4 2.4 1.4-2.4 1.4 2.4 1.4-2.4 1.4 2.4 1.4-2.4 1.4 2.4 1.4-2.4 1.4 2.4" fill="none" stroke="${K}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<circle cx="32" cy="9.5" r="5.4" fill="#f2f2f2" ${O}/><path d="M34.5 8 Q37.5 10 35.6 13.6 Q37 10 34.5 8Z" fill="#cfd6dd"/>` +
    `<ellipse cx="32" cy="24" rx="15.5" ry="13" fill="#eef1f4" ${O}/>` +
    head('#f2c9a5', '#dba784', 25.5, 12.5, 11) +
    `<path d="M19.5 22 Q20 11.5 32 11.5 Q44 11.5 44.5 22 Q40 15.5 32 16 Q24 15.5 19.5 22Z" fill="#f2f2f2" ${O}/>` +
    `<path d="M24 14.2 Q27 12.6 30 12.6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
    eyes(26.6, 5) + `<path d="M24.6 23.4 Q27 22.2 29.4 23.6 M39.4 23.4 Q37 22.2 34.6 23.6" fill="none" stroke="#b8bec6" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M19.6 28 l1.6 .4 M44.4 28 l-1.6 .4" stroke="#c99674" stroke-width=".9" stroke-linecap="round"/>` +
    cheeks(30.2, 8) + smile(31)
  ),

  bran: svg(
    `<rect x="49" y="21" width="3.6" height="30" rx="1.4" fill="#7a4a26" ${O}/>` +
    `<rect x="43" y="10" width="15" height="11" rx="2" fill="#7f8a96" ${O}/><rect x="52" y="11.5" width="4.8" height="8" fill="#5a6470"/><path d="M44.8 12.4 L52 12.4" stroke="#dfe6ee" stroke-width="1.3" stroke-linecap="round"/>` +
    `<ellipse cx="25" cy="57" rx="6" ry="2.8" fill="#4a3324" ${O}/><ellipse cx="39" cy="57" rx="6" ry="2.8" fill="#4a3324" ${O}/>` +
    `<path d="M14.5 56 Q12 42 18.5 35 L45.5 35 Q52 42 49.5 56 Q32 59 14.5 56Z" fill="#6d7f92" ${O}/>` +
    `<path d="M22 36 L42 36 L44.5 56 Q32 58.5 19.5 56Z" fill="#8a5232" ${O}/>` +
    `<path d="M37 38 L42 38 L44 55.6 L38 56.2Z" fill="#663a20"/>` +
    `<rect x="26" y="44" width="12" height="7" rx="1.6" fill="#a9683f" ${O}/><path d="M22 36 L26 33 M42 36 L38 33" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<ellipse cx="16.5" cy="43" rx="5.2" ry="7.6" transform="rotate(10 16.5 43)" fill="#e0a07a" ${O}/><path d="M13 47 Q17 49.6 20.4 47" fill="none" stroke="#b97853" stroke-width="1.2" stroke-linecap="round"/>` + hand(15.5, 51.2, '#e0a07a') +
    `<ellipse cx="47.5" cy="42" rx="5.2" ry="7.4" transform="rotate(-8 47.5 42)" fill="#c4825c" ${O}/>` + hand(50.8, 49.5, '#c4825c') +
    head('#e0a07a', '#c4825c', 23.5, 14.5, 12) +
    `<path d="M18 17 Q32 9 46 17 L46 21.5 Q32 15.5 18 21.5Z" fill="#c0392b" ${O}/><path d="M21 17.5 Q27 14 32 13.6" fill="none" stroke="#e8776a" stroke-width="1.2" stroke-linecap="round"/>` +
    eyes(25.4, 5.4) + `<path d="M24.6 22.2 L29.8 23.6 M39.4 22.2 L34.2 23.6" stroke="#3a2418" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M17.8 27 Q17 39 27 41.6 Q32 43 37 41.6 Q47 39 46.2 27 Q42 33 32 33 Q22 33 17.8 27Z" fill="#5a3320" ${O}/>` +
    `<path d="M37 34 Q43 32 45 28.4 Q44.6 37.4 37.6 40.6Z" fill="#3e2213"/>` +
    `<path d="M26 31.6 Q32 29 38 31.6 Q32 34.4 26 31.6Z" fill="#6f4229" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M24 36 Q26 38.4 29 38.8" fill="none" stroke="#8a5a3a" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  odile: svg(
    `<rect x="12.8" y="14" width="3.2" height="44" rx="1.4" fill="#8a5a33" ${O}/>` +
    `<path d="M14.4 14 Q14.4 6.5 8.4 8 Q5.6 9.2 6.6 13" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M14.4 14 Q14.4 6.5 8.4 8 Q5.6 9.2 6.6 13" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/>` +
    feet('#7a4a26') +
    `<path d="M19 56 Q17.5 44 23 35 L41 35 Q46.5 44 45 56 Q32 58.6 19 56Z" fill="#4f8fd0" ${O}/>` +
    `<path d="M39 38 Q45 46 44 55 L38 55.6 Q41.5 46 39 38Z" fill="#3a6fa8"/>` +
    `<path d="M25 43 L39 43 L41 56 Q32 58 23 56Z" fill="#f6f1e6" ${O}/><path d="M36 45 L39.6 45 L40.4 55.5 L36.6 56Z" fill="#dcd3c0"/>` +
    `<ellipse cx="20.5" cy="42.5" rx="3.6" ry="5.6" transform="rotate(10 20.5 42.5)" fill="#f6f1e6" ${O}/>` + hand(17, 49.4) +
    `<ellipse cx="43.5" cy="42.5" rx="3.6" ry="5.6" transform="rotate(-10 43.5 42.5)" fill="#dcd3c0" ${O}/>` + hand(47, 49.4) +
    `<path d="M25 35.5 L32 41 L39 35.5Z" fill="#c0392b" ${O}/>` +
    `<ellipse cx="17.5" cy="34.5" rx="3.2" ry="5.2" transform="rotate(12 17.5 34.5)" fill="#e8c05a" ${O}/><ellipse cx="46.5" cy="34.5" rx="3.2" ry="5.2" transform="rotate(-12 46.5 34.5)" fill="#cfa43e" ${O}/>` +
    `<circle cx="16.4" cy="38.8" r="1.7" fill="#c0392b"/><circle cx="47.6" cy="38.8" r="1.7" fill="#c0392b"/>` +
    head('#f7d0ac', '#e2ac86', 26, 13.5, 11.5) +
    `<path d="M18.5 24 Q19 15 32 15 Q45 15 45.5 24 Q40 19 32 20.6 Q24 19 18.5 24Z" fill="#e8c05a" ${O}/>` +
    eyes(27.4, 5.2) + `<circle cx="27.4" cy="30.6" r=".5" fill="#c98f6a"/><circle cx="29.2" cy="31.2" r=".5" fill="#c98f6a"/><circle cx="36.6" cy="30.6" r=".5" fill="#c98f6a"/><circle cx="34.8" cy="31.2" r=".5" fill="#c98f6a"/>` +
    cheeks(30.2, 9) + smile(32) +
    `<ellipse cx="32" cy="18" rx="21" ry="6" fill="#efd070" ${O}/>` +
    `<path d="M50 19 Q46 24.5 34 23.6 Q46 22.6 49 17.6Z" fill="#cfa43e"/>` +
    `<path d="M20.5 17 Q20 5 32 5 Q44 5 43.5 17 Q32 21 20.5 17Z" fill="#efd070" ${O}/>` +
    `<path d="M38 8 Q43 9 43.2 16 Q41 18 38 18.5Z" fill="#cfa43e"/>` +
    `<path d="M20.6 15 Q32 19.4 43.4 15 L43.6 12 Q32 16.4 20.4 12Z" fill="#c0392b" ${O}/>` +
    `<path d="M25 8.5 Q28 6.6 31 6.4 M10 17 Q14 14 19 14" fill="none" stroke="#fff6cc" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  aldric: svg(
    feet('#5a3a22') +
    `<path d="M17 57 Q13 43 21 34.5 L43 34.5 Q51 43 47 57 Q32 59.6 17 57Z" fill="#8e2f3f" ${O}/>` +
    `<path d="M40 37 Q48 44 45.6 56 L39 57 Q43 46 40 37Z" fill="#6a1f2d"/>` +
    `<path d="M27 36 L32 42 L37 36" fill="none" stroke="#f2c14e" stroke-width="2" stroke-linejoin="round"/><path d="M17.6 54.6 Q32 58.4 46.4 54.6" fill="none" stroke="#f2c14e" stroke-width="1.8" stroke-linecap="round"/>` +
    `<ellipse cx="20" cy="45" rx="4.4" ry="7" transform="rotate(-8 20 45)" fill="#8e2f3f" ${O}/><ellipse cx="44" cy="45" rx="4.4" ry="7" transform="rotate(8 44 45)" fill="#6a1f2d" ${O}/>` +
    `<path d="M24 34 Q32 44 40 34 Q42 44 32 54 Q22 44 24 34Z" fill="#d9dde2" ${O}/><path d="M35 38 Q39 40 38 44 Q36 48 33 52 Q37 44 35 38Z" fill="#aab1b9"/>` +
    `<rect x="21.4" y="44" width="21.4" height="11" rx="1.6" fill="#2f6f8f" ${O}/><rect x="21.4" y="44" width="3.4" height="11" fill="#245670"/>` +
    `<rect x="26.6" y="46.4" width="12.4" height="6.2" rx=".8" fill="#f3e2b3"/><path d="M28.4 49.6 L37 49.6 M28.4 51.4 L35 51.4" stroke="#b89a5a" stroke-width=".9"/>` +
    hand(22, 52) + hand(42, 52) +
    `<ellipse cx="19" cy="27" rx="3" ry="4.6" fill="#c8ccd2" ${O}/><ellipse cx="45" cy="27" rx="3" ry="4.6" fill="#a4aab2" ${O}/>` +
    head('#f3cba7', '#dba784', 24, 13.5, 12) +
    `<path d="M24 12.6 Q29 10 34 10.4" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>` +
    eyes(25.4, 5) + `<path d="M23.6 21.6 Q27 19.8 30.6 22.6 M40.4 21.6 Q37 19.8 33.4 22.6" fill="#d9dde2" stroke="${K}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M24 29 Q32 26 40 29 Q41 35.5 32 38 Q23 35.5 24 29Z" fill="#d9dde2" ${O}/><path d="M29 30.6 Q32 32.4 35 30.6" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M36 33 Q39 32 39.6 30 Q40 34.6 36.6 36.6Z" fill="#aab1b9"/>`
  ),

  nessa: svg(
    feet('#4a3324') +
    `<path d="M19.5 56 Q18 44 23 35 L41 35 Q46 44 44.5 56 Q32 58.6 19.5 56Z" fill="#2aa198" ${O}/>` +
    `<path d="M39 38 Q44 46 43 55 L38 55.6 Q41 46 39 38Z" fill="#1d7c74"/>` +
    `<path d="M24 35.5 Q32 40.5 40 35.5 L40 38.6 Q32 44 24 38.6Z" fill="#f6efd8" ${O}/><rect x="23" y="44" width="18" height="3.4" rx="1.4" fill="#e6b84a" ${O}/>` +
    `<ellipse cx="20.6" cy="43.5" rx="3.4" ry="5.6" transform="rotate(20 20.6 43.5)" fill="#2aa198" ${O}/><ellipse cx="43.4" cy="43.5" rx="3.4" ry="5.6" transform="rotate(-20 43.4 43.5)" fill="#1d7c74" ${O}/>` +
    `<path d="M14 45.6 L50 45.6 L50 52.8 L14 52.8Z" fill="#f3e2b3" ${O}/>` +
    `<path d="M14 45.6 L50 45.6 L50 47.4 L14 47.4Z" fill="#fff6d8"/><path d="M14 51 L50 51 L50 52.8 L14 52.8Z" fill="#dcc48a"/>` +
    `<ellipse cx="14" cy="49.2" rx="2.4" ry="4.4" fill="#e8d09a" ${O}/><ellipse cx="50" cy="49.2" rx="2.4" ry="4.4" fill="#cfb374" ${O}/>` +
    `<path d="M20 48.4 L28 48.4 M36 48.4 L44 48.4" stroke="#b89a5a" stroke-width=".9"/><rect x="29.2" y="45" width="5.6" height="8.4" rx="1" fill="#c0392b" ${O}/>` +
    hand(21, 49.2) + hand(43, 49.2) +
    `<ellipse cx="32" cy="25" rx="16.6" ry="14.4" fill="#5b3a29" ${O}/>` +
    `<circle cx="47.4" cy="14" r="4.2" fill="#5b3a29" ${O}/>` +
    head('#f5cba7', '#e0a582', 25.5, 13, 11.5) +
    `<path d="M18.6 22 Q19 11.6 32 11.6 Q45 11.6 45.4 22 Q42 20 37 16.4 Q28 21 18.6 22Z" fill="#5b3a29" ${O}/>` +
    `<path d="M24 14.6 Q28 12.6 32 12.8" fill="none" stroke="#a5735a" stroke-width="1.3" stroke-linecap="round"/>` +
    `<circle cx="26.6" cy="26.4" r="4.3" fill="#cfefff" fill-opacity=".35" stroke="#d9a521" stroke-width="1.5"/><circle cx="37.4" cy="26.4" r="4.3" fill="#cfefff" fill-opacity=".35" stroke="#d9a521" stroke-width="1.5"/><path d="M30.9 26 L33.1 26" stroke="#d9a521" stroke-width="1.4"/>` +
    eyes(26.6, 5.4) + cheeks(31, 8.6) + smile(31.6)
  ),

  brakka: svg(
    `<rect x="12.4" y="26" width="3.4" height="32" rx="1.4" fill="#4a3324" ${O}/>` +
    `<path d="M14.1 2.5 L20.6 8 L19.6 26 L8.6 26 L7.6 8Z" fill="#8a929c" ${O}/><path d="M14.1 5 L14.1 24" stroke="#5a616b" stroke-width="1.3"/><path d="M9.6 9 L9.8 22" stroke="#e2672a" stroke-width="1.6" stroke-linecap="round"/>` +
    `<rect x="7.8" y="25.4" width="12.6" height="3" rx="1.2" fill="#e2672a" ${O}/>` +
    `<ellipse cx="25.5" cy="56.6" rx="5" ry="3" fill="#3a3a42" ${O}/><ellipse cx="38.5" cy="56.6" rx="5" ry="3" fill="#3a3a42" ${O}/>` +
    `<rect x="21" y="48" width="22" height="8" rx="2.4" fill="#4a4a52" ${O}/><path d="M22 51 L42 51" stroke="#e2672a" stroke-width="1.4"/>` +
    `<path d="M19 47.5 Q17 38 22.5 35 L41.5 35 Q47 38 45 47.5 Q32 51 19 47.5Z" fill="#4a4a52" ${O}/>` +
    `<path d="M38 38 Q45 40 44 46.6 Q42 48 37 49Z" fill="#32323a"/>` +
    `<path d="M32 36.5 L32 47.4 M24 42 L40 42" stroke="#e2672a" stroke-width="1.8" stroke-linecap="round"/><circle cx="32" cy="42" r="2.4" fill="#f2b04a" ${O}/>` +
    `<ellipse cx="17.8" cy="43" rx="4.2" ry="6.2" transform="rotate(8 17.8 43)" fill="#6fa84a" ${O}/><rect x="14.2" y="44.4" width="7.2" height="3.4" rx="1.4" fill="#3a3a42" ${O}/>` + hand(14.6, 50.6, '#6fa84a') +
    `<ellipse cx="46.2" cy="43" rx="4.2" ry="6.2" transform="rotate(-8 46.2 43)" fill="#4c7d33" ${O}/><rect x="42.6" y="44.4" width="7.2" height="3.4" rx="1.4" fill="#3a3a42" ${O}/>` + hand(49.4, 50.6, '#4c7d33') +
    `<circle cx="20.4" cy="37" r="5" fill="#8a929c" ${O}/><circle cx="43.6" cy="37" r="5" fill="#5a616b" ${O}/><path d="M17.6 35 Q19 33.6 21 33.6" stroke="#dfe6ee" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    `<path d="M17 24 L9 19.6 L16.4 29.6Z" fill="#6fa84a" ${O}/><path d="M47 24 L55 19.6 L47.6 29.6Z" fill="#4c7d33" ${O}/>` +
    `<path d="M26 12 Q29 4 32 3 Q35 4 38 12Z" fill="#2a2a30" ${O}/><path d="M29.2 10.4 Q31 6.6 32.4 5.4" stroke="#6a6a78" stroke-width="1.1" fill="none" stroke-linecap="round"/>` +
    head('#6fa84a', '#4c7d33', 24.5, 14.2, 12) +
    `<path d="M18.2 20 Q20 11 32 10.6 Q44 11 45.8 20 Q40 16.4 32 16.6 Q24 16.4 18.2 20Z" fill="#2a2a30" ${O}/>` +
    `<path d="M21.6 28.4 L26 30.4 M42.4 28.4 L38 30.4 M21 30.8 L24.6 32" stroke="#e2672a" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>` +
    eyes(25.2, 5.3) + `<path d="M24.4 21.6 L29.8 23.6 M39.6 21.6 L34.2 23.6" stroke="${K}" stroke-width="1.9" stroke-linecap="round"/>` +
    `<path d="M28.4 31.2 Q32 33.4 35.6 31.2" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M26.6 32.4 L25.4 28.2 L29 31.6Z" fill="#f7f1e0" ${O.replace('stroke-width="2"', 'stroke-width="1.3"')}/><path d="M37.4 32.4 L38.6 28.2 L35 31.6Z" fill="#f7f1e0" ${O.replace('stroke-width="2"', 'stroke-width="1.3"')}/>`
  ),

  tariq: svg(
    feet('#a9683f') +
    `<path d="M18 57 Q14.5 43 21.5 34.5 L42.5 34.5 Q49.5 43 46 57 Q32 59.6 18 57Z" fill="#dcb673" ${O}/>` +
    `<path d="M40 37 Q47 44 44.6 56 L39 57 Q42.6 46 40 37Z" fill="#b98d4a"/>` +
    `<rect x="21.6" y="43.6" width="20.8" height="4" rx="1.6" fill="#2f4b8a" ${O}/><path d="M36 47.4 L37.6 56 L41.4 55 L40 47.4Z" fill="#2f4b8a" ${O}/>` +
    `<path d="M22 35 Q32 41 42 35" fill="none" stroke="#f6efe0" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M22.6 36 Q21 47 21 52 L27 51 L26.6 40Z" fill="#8a5a3a" ${O.replace('stroke-width="2"', 'stroke-width="1.4"')}/>` +
    `<ellipse cx="19.5" cy="45" rx="4.2" ry="6.4" transform="rotate(10 19.5 45)" fill="#dcb673" ${O}/>` + hand(16.6, 51.4, '#cf9a68') +
    `<ellipse cx="44.5" cy="45" rx="4.2" ry="6.4" transform="rotate(-10 44.5 45)" fill="#b98d4a" ${O}/>` + hand(47.4, 51.4, '#cf9a68') +
    head('#d9a577', '#b98456', 26, 13.4, 11) +
    `<path d="M26 32.6 Q32 37.2 38 32.6 Q37 35.6 32 36.4 Q27 35.6 26 32.6Z" fill="#4a2f1e" ${O.replace('stroke-width="2"', 'stroke-width="1.2"')}/>` +
    `<path d="M18.4 21.6 Q19 7 32 6 Q45 7 45.6 21.6 Q41 17.6 32 17.6 Q23 17.6 18.4 21.6Z" fill="#f6efe0" ${O}/>` +
    `<path d="M18.6 19 Q32 24 45.4 19 L45.6 22 Q32 27 18.4 22Z" fill="#2f4b8a" ${O}/>` +
    `<path d="M22 12.4 Q32 8.6 41 12.2 M24.6 15.4 Q32 12.6 39.6 15.4" fill="none" stroke="#d6c9ae" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M40.6 8.4 Q47 8 47.6 15.6" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M45 21 Q52 24 50 34 Q48 30 44.6 28.6Z" fill="#2f4b8a" ${O}/>` +
    eyes(27.6, 5.2) + cheeks(31, 8.4) + `<path d="M30 33.4 Q32 34.6 34 33.4" fill="none" stroke="#e8c9a0" stroke-width="1" stroke-linecap="round"/>`
  ),

  hakim: svg(
    feet('#5a3a22') +
    `<path d="M14 57 Q10 42 20.5 34.5 L43.5 34.5 Q54 42 50 57 Q32 60.4 14 57Z" fill="#2b7a78" ${O}/>` +
    `<path d="M44 38 Q52 45 49 56 L43 57 Q47 47 43.6 37Z" fill="#1d5a58"/>` +
    `<path d="M22.4 56.6 Q21 45 24 35 L40 35 Q43 45 41.6 56.6 Q32 58.6 22.4 56.6Z" fill="#efe6d2" ${O}/>` +
    `<path d="M37.6 38 Q40.6 46 40 55.6 L37 56Z" fill="#cfc3a8"/>` +
    `<path d="M22 44.2 Q32 48 42 44.2 L42 47.4 Q32 51 22 47.4Z" fill="#d6a85a" ${O}/><path d="M26 45.6 l2 3 M31 46.4 l2 3.2 M36 45.8 l2 3" stroke="#a97a34" stroke-width="1.1"/>` +
    `<path d="M38 48 Q41 54 37.6 57.6" fill="none" stroke="${K}" stroke-width="4.2" stroke-linecap="round"/><path d="M38 48 Q41 54 37.6 57.6" fill="none" stroke="#d6a85a" stroke-width="2" stroke-linecap="round"/><circle cx="37.6" cy="57.4" r="1.8" fill="#c0392b" ${O.replace('stroke-width="2"', 'stroke-width="1.3"')}/>` +
    `<ellipse cx="19" cy="44.4" rx="4.2" ry="6.4" transform="rotate(10 19 44.4)" fill="#2b7a78" ${O}/><ellipse cx="45" cy="44.4" rx="4.2" ry="6.4" transform="rotate(-10 45 44.4)" fill="#1d5a58" ${O}/>` +
    `<path d="M15.6 49.4 Q12 53 15.6 56.4 Q19.4 56 18.4 51" fill="none" stroke="${K}" stroke-width="4.2" stroke-linecap="round"/><path d="M15.6 49.4 Q12 53 15.6 56.4 Q19.4 56 18.4 51" fill="none" stroke="#d6a85a" stroke-width="2" stroke-linecap="round"/>` +
    hand(16.6, 50, '#c48a5c') + hand(47.4, 50.4, '#c48a5c') +
    head('#cc9264', '#a9703f', 26, 13.6, 11) +
    `<path d="M24.4 32.4 Q28 30.6 32 32 Q36 30.6 39.6 32.4 Q37 35.4 32 34 Q27 35.4 24.4 32.4Z" fill="#2a1a12" ${O.replace('stroke-width="2"', 'stroke-width="1.2"')}/>` +
    `<path d="M18.2 22 Q18 6.6 32 5.6 Q46 6.6 45.8 22 Q41 17.8 32 17.8 Q23 17.8 18.2 22Z" fill="#c2452d" ${O}/>` +
    `<path d="M38 8 Q45.4 10 45.8 21 Q43 18.8 39 18.2Z" fill="#9b3320"/>` +
    `<path d="M18.6 19.6 Q32 24 45.4 19.6" fill="none" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M22 12 Q28 8.8 34 9.4 M24 15 Q30 12.4 37 13.6" fill="none" stroke="#e57b62" stroke-width="1.2" stroke-linecap="round"/>` +
    eyes(27.6, 5.2) + `<path d="M25.6 24.6 Q27.4 23.4 29.6 24.4 M38.4 24.6 Q36.6 23.4 34.4 24.4" fill="none" stroke="#2a1a12" stroke-width="1.6" stroke-linecap="round"/>` + cheeks(31, 8.6)
  ),

  ylva: svg(
    `<defs><linearGradient id="ylva-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0ffff"/><stop offset=".55" stop-color="#63d8ee"/><stop offset="1" stop-color="#2b8fc9"/></linearGradient></defs>` +
    `<rect x="11.6" y="14" width="3.2" height="44" rx="1.4" fill="#7a8fa3" ${O}/>` +
    `<path d="M13.2 1.6 L18.4 8.2 L13.2 15 L8 8.2Z" fill="url(#ylva-g1)" ${O}/><path d="M13.2 3.8 L13.2 13" stroke="#fff" stroke-width=".9" opacity=".8"/><path d="M10.4 8 L12 5.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="26.4" cy="57" rx="4.6" ry="2.7" fill="#f4fbff" ${O}/><ellipse cx="37.6" cy="57" rx="4.6" ry="2.7" fill="#f4fbff" ${O}/>` +
    `<path d="M18.6 56 Q16.6 43 22.6 34.6 L41.4 34.6 Q47.4 43 45.4 56 Q32 58.8 18.6 56Z" fill="#8fd3f0" ${O}/>` +
    `<path d="M39 37 Q46 44 44.4 55 L38.6 56 Q42 46 39 37Z" fill="#5aa9d6"/>` +
    `<path d="M18.6 54.4 Q32 58.4 45.4 54.4 L45.4 57 Q32 60 18.6 57Z" fill="#f4fbff" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/>` +
    `<rect x="22" y="43.6" width="20" height="3.4" rx="1.4" fill="#4a6fa5" ${O}/><rect x="30" y="43" width="4" height="4.6" rx="1" fill="#f4fbff" ${O.replace('stroke-width="2"', 'stroke-width="1.3"')}/>` +
    `<ellipse cx="20" cy="43.4" rx="3.6" ry="6" transform="rotate(10 20 43.4)" fill="#8fd3f0" ${O}/><ellipse cx="44" cy="43.4" rx="3.6" ry="6" transform="rotate(-10 44 43.4)" fill="#5aa9d6" ${O}/>` +
    `<circle cx="16.8" cy="49.6" r="3.2" fill="#f4fbff" ${O}/><circle cx="47.2" cy="49.6" r="3.2" fill="#dcecf5" ${O}/>` +
    `<path d="M14.6 30.6 Q13.6 11 32 8.6 Q50.4 11 49.4 30.6 Q49 39.6 32 40.2 Q15 39.6 14.6 30.6Z" fill="#8fd3f0" ${O}/>` +
    `<path d="M43 11.6 Q50 16 49 30 Q48.6 37.6 42 39.4 Q46 30 43.6 20Z" fill="#5aa9d6"/>` +
    `<ellipse cx="32" cy="26.6" rx="13.6" ry="12.4" fill="#f4fbff" ${O}/>` +
    `<ellipse cx="32" cy="27.4" rx="11.6" ry="10.2" fill="#f5d2b8" ${O}/>` +
    `<path d="M22.4 25 Q26 20.4 32 21.4 Q28 20 22.4 25Z" fill="#dfe8ee"/>` +
    `<path d="M23 25.4 Q27 19.2 32 21.4 Q37 19.2 41 25.4 Q37 22.6 32 24 Q27 22.6 23 25.4Z" fill="#dfe8ee" ${O.replace('stroke-width="2"', 'stroke-width="1.3"')}/>` +
    `<path d="M36 32 Q40 30 41 26 Q41 32 36.6 35Z" fill="#e2b898"/>` +
    eyes(28.6, 4.4) + `<ellipse cx="25.4" cy="31.6" rx="2.2" ry="1.4" fill="#ff8a9a" opacity=".5"/><ellipse cx="38.6" cy="31.6" rx="2.2" ry="1.4" fill="#ff8a9a" opacity=".5"/>` + smile(33) +
    `<path d="M20.4 14 Q24 10.6 28 10" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>`
  ),
};

const chestBase =
  `<path d="M9 36 L55 36 L54 55.6 Q54 57.6 51.6 57.6 L12.4 57.6 Q10 57.6 10 55.6Z" fill="#a8683a" ${O}/>` +
  `<path d="M42 37 L54 37 L53.2 55.6 L42 57Z" fill="#87502b"/>` +
  `<path d="M10 45.6 L54 45.6 M10 51 L54 51" stroke="#87502b" stroke-width="1" opacity=".8"/>` +
  `<rect x="13" y="36" width="6" height="21.6" fill="#9aa5b3" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/><rect x="45" y="36" width="6" height="21.6" fill="#7d8896" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/>` +
  `<circle cx="16" cy="41" r="1" fill="#dfe6ee"/><circle cx="16" cy="52" r="1" fill="#dfe6ee"/><circle cx="48" cy="41" r="1" fill="#dfe6ee"/><circle cx="48" cy="52" r="1" fill="#dfe6ee"/>`;

export const CHEST_SPRITES = {
  closed: svg(
    chestBase +
    `<path d="M9 37 Q9 19 32 19 Q55 19 55 37Z" fill="#c07f45" ${O}/>` +
    `<path d="M44 21.6 Q55 24 55 37 L46 37 Q47 27 44 21.6Z" fill="#9a6232"/>` +
    `<path d="M14 30 Q17 23.6 24 22" fill="none" stroke="#f0b47a" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M13 37 Q12.6 27 19 21.6 L19 37Z" fill="#9aa5b3" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/><path d="M51 37 Q51.4 27 45 21.6 L45 37Z" fill="#7d8896" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/>` +
    `<rect x="9" y="34" width="46" height="4.6" rx="1.4" fill="#b3bdc9" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/>` +
    `<rect x="27.6" y="35" width="8.8" height="10.4" rx="1.6" fill="#f2c14e" ${O}/><circle cx="32" cy="39.4" r="1.5" fill="${K}"/><path d="M32 40 L32 43" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/><path d="M29.4 36.6 L31 36.6" stroke="#fff" stroke-width="1" stroke-linecap="round"/>`
  ),
  open: svg(
    `<defs><radialGradient id="open-g1" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fffbd0"/><stop offset=".55" stop-color="#ffd84a"/><stop offset="1" stop-color="#e59a1a"/></radialGradient></defs>` +
    `<path d="M32 33 L16 2 L48 2Z" fill="#fff3a0" opacity=".45"/><path d="M32 33 L4 14 L10 6Z M32 33 L60 14 L54 6Z" fill="#fff3a0" opacity=".3"/>` +
    `<path d="M10 37 L13.6 14 Q32 8 50.4 14 L54 37Z" fill="#6f4123" ${O}/>` +
    `<path d="M14.6 18 Q32 12.6 49.4 18 L50.4 32 Q32 27 13.6 32Z" fill="#8a5630"/>` +
    `<rect x="12" y="13.6" width="6" height="22" fill="#7d8896" transform="rotate(-6 15 25)" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/><rect x="46" y="13.6" width="6" height="22" fill="#5f6a78" transform="rotate(6 49 25)" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/>` +
    `<ellipse cx="32" cy="36" rx="22.4" ry="6.4" fill="url(#open-g1)" ${O}/>` +
    `<circle cx="22" cy="33.6" r="3.6" fill="#ffd84a" ${O.replace('stroke-width="2"', 'stroke-width="1.4"')}/><circle cx="31" cy="31.4" r="4" fill="#ffc21f" ${O.replace('stroke-width="2"', 'stroke-width="1.4"')}/><circle cx="40.6" cy="33" r="3.6" fill="#ffd84a" ${O.replace('stroke-width="2"', 'stroke-width="1.4"')}/><circle cx="30" cy="30" r="1.2" fill="#fff"/>` +
    `<path d="M9 37 L55 37 L54 55.6 Q54 57.6 51.6 57.6 L12.4 57.6 Q10 57.6 10 55.6Z" fill="#a8683a" ${O}/>` +
    `<path d="M42 38 L54 38 L53.2 55.6 L42 57Z" fill="#87502b"/>` +
    `<path d="M10 46.4 L54 46.4 M10 52 L54 52" stroke="#87502b" stroke-width="1" opacity=".8"/>` +
    `<rect x="13" y="37" width="6" height="20.6" fill="#9aa5b3" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/><rect x="45" y="37" width="6" height="20.6" fill="#7d8896" ${O.replace('stroke-width="2"', 'stroke-width="1.6"')}/>` +
    `<circle cx="16" cy="42" r="1" fill="#dfe6ee"/><circle cx="16" cy="52" r="1" fill="#dfe6ee"/><circle cx="48" cy="42" r="1" fill="#dfe6ee"/><circle cx="48" cy="52" r="1" fill="#dfe6ee"/>` +
    `<rect x="27.6" y="39" width="8.8" height="9" rx="1.6" fill="#f2c14e" ${O}/><circle cx="32" cy="42.8" r="1.4" fill="${K}"/>` +
    `<path d="M8 8 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2-2.6 -2.6-1.2 2.6-1.2z M56 6 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1-2.2 -2.2-1 2.2-1z" fill="#fff8c0"/>`
  ),
};
