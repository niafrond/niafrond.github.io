// Sprites SVG (fantasy chinoise) : PNJ des regions volcan a fusang + lune, et les quatre formes de Fengmeng.
// Meme facture que sprites/actors.js (chibi de face, contour #2b1b17 de 2 px, viewBox 64x64, pieds vers y=58, sans ombre au sol).
// Les helpers ne servent qu'a factoriser ; chaque export est une chaine SVG statique et autonome.

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const OW = (w) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

const eyes = (y = 25, dx = 5.2) =>
  `<circle cx="${32 - dx}" cy="${y}" r="1.6" fill="${K}"/><circle cx="${32 + dx}" cy="${y}" r="1.6" fill="${K}"/>` +
  `<circle cx="${32 - dx + 0.6}" cy="${y - 0.6}" r="0.6" fill="#fff"/><circle cx="${32 + dx + 0.6}" cy="${y - 0.6}" r="0.6" fill="#fff"/>`;
const cheeks = (y = 29.5, dx = 8.5, c = '#ff7f7f') =>
  `<ellipse cx="${32 - dx}" cy="${y}" rx="2.4" ry="1.5" fill="${c}" opacity=".4"/><ellipse cx="${32 + dx}" cy="${y}" rx="2.4" ry="1.5" fill="${c}" opacity=".4"/>`;
const smile = (y = 30) => `<path d="M30 ${y} Q32 ${y + 2} 34 ${y}" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>`;
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
// Bras en gelule (contour + aplat), pour les sprites minces.
const arm = (d, w, fill) =>
  `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// Rangee de dents (paille, franges, haillons) : forme fermee, bord superieur droit, bord inferieur dentele.
const teeth = (x0, x1, yTop, yHem, n, fill, depth = 3) => {
  const w = (x1 - x0) / n;
  let d = `M${x0} ${yTop} L${x1} ${yTop} L${x1} ${yHem}`;
  for (let i = n - 1; i >= 0; i--) d += ` L${(x0 + i * w + w / 2).toFixed(1)} ${yHem + depth} L${(x0 + i * w).toFixed(1)} ${yHem}`;
  return `<path d="${d}Z" fill="${fill}" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/>`;
};
// Yeux fins en amande, regard de cote (pour Fengmeng).
const sharpEyes = (y, iris = K, look = 1, sclera = '#fff') => {
  const e = (cx) =>
    `<path d="M${cx - 3.6} ${y + 0.4} Q${cx} ${y - 2.8} ${cx + 3.6} ${y - 0.4} Q${cx} ${y + 2} ${cx - 3.6} ${y + 0.4}Z" fill="${sclera}" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<circle cx="${cx + look * 1.2}" cy="${y - 0.2}" r="1.5" fill="${iris}"/><circle cx="${cx + look * 1.2}" cy="${y - 0.2}" r=".7" fill="${K}"/>` +
    `<path d="M${cx - 3.8} ${y + 0.2} Q${cx} ${y - 3.2} ${cx + 3.8} ${y - 0.6}" fill="none" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/>`;
  return e(25.6) + e(38.4);
};

// Yeux alignes sur la grille de pixellisation (pixels de 2 unites) : rectangles de 2 x h unites aux colonnes impaires.
const pxEyes = (y, h = 4, x1 = 27, x2 = 37, w = 2) =>
  `<rect x="${x1 - w / 2}" y="${y}" width="${w}" height="${h}" rx=".5" fill="${K}"/><rect x="${x2 - w / 2}" y="${y}" width="${w}" height="${h}" rx=".5" fill="${K}"/>`;
const SKIN = '#f5cba7', SKIN_D = '#e0a582';

// ---------------------------------------------------------------- PNJ
export const NPC_SPRITES_B = {
  // Mineur : casque de cuir a lampe, pioche, visage noirci de suie.
  miner_shan: svg(
    `<rect x="48" y="17" width="3.4" height="42" rx="1.5" fill="#8a5a33" ${O} transform="rotate(8 49.7 38)"/>` +
    `<path d="M42.5 20 Q52.6 8 62 19.5 L59 22 Q52.6 14.5 46 22.6Z" fill="#9aa6b4" ${O}/>` +
    `<path d="M46.4 17.6 Q50 13.8 54 13" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>` +
    feet('#3d2b1f') +
    `<path d="M20 56 Q18 44 23 35 L41 35 Q46 44 44 56 Q32 58.5 20 56Z" fill="#8b7b66" ${O}/>` +
    `<path d="M38 37 Q43 45 42 55 L37 55.6 Q40 46 38 37Z" fill="#6b5d4b"/>` +
    `<path d="M24.5 36 L39.5 36 L40.5 56 Q32 58 23.5 56Z" fill="#6b4226" ${O}/>` +
    `<path d="M36.5 38 L39.5 38 L40.2 55.4 L37.4 55.8Z" fill="#4e2f19"/>` +
    `<path d="M24 36 L21 33.6 M40 36 L43 33.6" stroke="${K}" stroke-width="2" stroke-linecap="round"/>` +
    `<rect x="27.5" y="47.6" width="8" height="6" rx="1.2" fill="#a9683f" ${O}/><path d="M29 49.4 L34 49.4 M29 51.6 L34 51.6" stroke="#6b4226" stroke-width=".8" stroke-dasharray="1.4 1"/>` +
    `<path d="M21 45.4 Q32 49 43 45.4" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M21 45.4 Q32 49 43 45.4" fill="none" stroke="#e0cc90" stroke-width="2" stroke-linecap="round" stroke-dasharray="2.2 1.2"/>` +
    `<ellipse cx="29" cy="40" rx="2.6" ry="1.6" fill="#2b2420" opacity=".4"/>` +
    `<ellipse cx="20" cy="43" rx="3.6" ry="6" transform="rotate(12 20 43)" fill="#8b7b66" ${O}/><path d="M17.4 48.6 Q20 50.4 22.4 48.6" fill="none" stroke="#6b5d4b" stroke-width="1.4"/>` + hand(18.6, 50, '#5a4a40') +
    `<ellipse cx="44.5" cy="42" rx="3.6" ry="6" transform="rotate(-18 44.5 42)" fill="#6b5d4b" ${O}/>` + hand(48.8, 46, '#5a4a40') +
    head('#d2a98a', '#b58865', 26.5, 13.5, 11) +
    `<ellipse cx="24" cy="31.4" rx="4.6" ry="2.8" fill="#2b2420" opacity=".55"/><ellipse cx="40" cy="31.4" rx="4.6" ry="2.8" fill="#2b2420" opacity=".55"/>` +
    `<path d="M31 27 L31.4 30.6 L33.2 30.6 L33 27Z" fill="#4b4136"/>` +
    `<ellipse cx="26.6" cy="27.4" rx="2.7" ry="3" fill="#fff" stroke="${K}" stroke-width="1"/><ellipse cx="37.4" cy="27.4" rx="2.7" ry="3" fill="#fff" stroke="${K}" stroke-width="1"/>` +
    `<circle cx="27" cy="27.8" r="1.5" fill="${K}"/><circle cx="37" cy="27.8" r="1.5" fill="${K}"/><circle cx="27.5" cy="27.2" r=".55" fill="#fff"/><circle cx="37.5" cy="27.2" r=".55" fill="#fff"/>` +
    `<path d="M23.4 23.6 L29.4 24.4 M40.6 23.6 L34.6 24.4" stroke="#2b2420" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M27.4 33.4 Q32 37.2 36.6 33.4 Q32 34.6 27.4 33.4Z" fill="#fff" stroke="${K}" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<path d="M17.8 24 Q17.4 11 32 10.4 Q46.6 11 46.2 24 Q42 20 32 20 Q22 20 17.8 24Z" fill="#7a5230" ${O}/>` +
    `<path d="M39 12.4 Q45 14 45 22 Q43 20.4 40 20Z" fill="#573719"/>` +
    `<path d="M17.8 24 Q16 28 19.4 31 L21.4 28 Q20 26 20.6 23Z M46.2 24 Q48 28 44.6 31 L42.6 28 Q44 26 43.4 23Z" fill="#7a5230" ${O}/>` +
    `<path d="M22 14.6 Q25 12.4 29 12.2" fill="none" stroke="#c18a52" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M32 4.4 Q36.4 9 32.8 11.2 Q28.4 9.4 32 4.4Z" fill="#ff9b2f" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/><path d="M32 7.6 Q33.6 9.4 32.2 10.4 Q30.8 9.2 32 7.6Z" fill="#ffe27a"/>` +
    `<rect x="28.4" y="11.2" width="7.2" height="5.4" rx="1.6" fill="#d9a441" ${O}/><path d="M30 12.8 L33.6 12.8" stroke="#fff3b0" stroke-width="1" stroke-linecap="round"/>`
  ),

  // Pretresse du feu repentie : robe rouge sombre, eventail charbonneux, braises eteintes, air triste.
  priestess_yan: svg(
    `` +
    `<ellipse cx="13" cy="56" rx="3.6" ry="2.8" fill="#3a3236" ${O}/><path d="M11 53.8 Q13 52.6 15 54" fill="none" stroke="#9a908c" stroke-width="1.6" stroke-linecap="round"/><path d="M12 56.6 L13.8 55" stroke="#9c5a3a" stroke-width="1" stroke-linecap="round"/>` +
    `<ellipse cx="51.5" cy="57.4" rx="2.4" ry="1.8" fill="#3a3236" ${O}/>` +
    `<ellipse cx="32" cy="29" rx="16" ry="14" fill="#2a2438" ${O}/>` +
    feet('#2a1a1c') +
    `<path d="M18.5 57 Q16 44 22.5 35 L41.5 35 Q48 44 45.5 57 Q32 60 18.5 57Z" fill="#7a1f2b" ${O}/>` +
    `<path d="M39 37 Q46 46 44 56 L38.5 56.6 Q42 47 39 37Z" fill="#531420"/>` +
    `<path d="M19.4 53.6 Q32 57 44.6 53.6" fill="none" stroke="#2a1a1c" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M22 42 Q32 45.4 42 42 L42 46.6 Q32 50 22 46.6Z" fill="#3a1a1f" ${O}/><path d="M22.6 43.2 Q32 46.4 41.4 43.2" fill="none" stroke="#a8863a" stroke-width="1" stroke-dasharray="2 1.6"/>` +
    `<path d="M24.6 35.6 L32 47 L39.4 35.6 L36.6 35.2 L32 41.6 L27.4 35.2Z" fill="#e8d8b8" ${O}/>` +
    `<ellipse cx="18.5" cy="45" rx="5" ry="8" transform="rotate(8 18.5 45)" fill="#7a1f2b" ${O}/><path d="M13.4 50.6 Q18 54.4 22.6 51" fill="none" stroke="#e8d8b8" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M14.4 53.6 L15 56.6 M18 54.6 L18.4 58" stroke="#9a908c" stroke-width="1" stroke-linecap="round" opacity=".8"/>` +
    `<rect x="48.2" y="43" width="2.6" height="14" rx="1.2" fill="#6b4226" ${O}/>` +
    `<circle cx="50.5" cy="35.4" r="10" fill="#a99d96" ${O}/><circle cx="50.5" cy="35.4" r="7.8" fill="none" stroke="#8e2a30" stroke-width="1.2"/>` +
    `<path d="M50.5 42 Q44.4 38.8 47 33 Q48 35.6 49.6 35 Q48.6 31 51.4 28.2 Q51.4 32.4 53.8 33.6 Q55 31.6 54.8 30 Q57.2 35 54.6 39.8Z" fill="#6c6360"/>` +
    `<path d="M43.6 31 Q45 29 47.4 28" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>` +
    `<ellipse cx="45" cy="44" rx="4.8" ry="7.4" transform="rotate(-8 45 44)" fill="#531420" ${O}/><path d="M40.4 49.4 Q45 53.6 49.6 50.4" fill="none" stroke="#e8d8b8" stroke-width="2.4" stroke-linecap="round"/>` + hand(49.4, 46.4, '#f3d3bb') +
    head('#f3d3bb', '#dcb69c', 25.6, 13.4, 11.4) +
    `<path d="M17 27 Q13 41 19 49 Q22.6 41 22.4 29Z" fill="#2a2438" ${O}/><path d="M47 27 Q51 41 45 49 Q41.4 41 41.6 29Z" fill="#2a2438" ${O}/>` +
    `<path d="M18.6 24.4 Q19 12.4 32 12.4 Q45 12.4 45.4 24.4 Q41 18.6 34.6 20.2 Q32 23.6 29.4 20.2 Q23 18.6 18.6 24.4Z" fill="#2a2438" ${O}/>` +
    `<path d="M23 15.6 Q26 13.6 30 13.4" fill="none" stroke="#5a5470" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="32" cy="8.4" r="5.2" fill="#2a2438" ${O}/><path d="M24 9 L40 9" stroke="${K}" stroke-width="3.4" stroke-linecap="round"/><path d="M24 9 L40 9" stroke="#a8863a" stroke-width="1.6" stroke-linecap="round"/><circle cx="40.6" cy="9" r="1.8" fill="#8a807c" ${O}/>` +
    `<circle cx="26.6" cy="28" r="1.5" fill="${K}"/><circle cx="37.4" cy="28" r="1.5" fill="${K}"/><circle cx="26.2" cy="27.4" r=".55" fill="#fff"/><circle cx="37" cy="27.4" r=".55" fill="#fff"/>` +
    `<path d="M24 26.6 Q26.6 25 29.4 26.6 M34.6 26.6 Q37.4 25 40 26.6" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M24 24.4 L29.4 22.4 M40 24.4 L34.6 22.4" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M24.6 29.6 Q23.6 32.2 25 33.4 Q26.4 32.2 24.6 29.6Z" fill="#9fd4ff" stroke="${K}" stroke-width=".7"/>` +
    `<path d="M30 33.8 Q32 32.2 34 33.8" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` + cheeks(31.4, 8.6, '#d9605c')
  ),

  // Chasseur : cape de peau tachetee, bandeau, arc simple, une fleche.
  hunter_wu: svg(
    `<path d="M16.5 10 Q5 34 16.5 58" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M16.5 10 Q5 34 16.5 58" fill="none" stroke="#b87a45" stroke-width="2.6" stroke-linecap="round"/><path d="M16.5 10 L16.5 58" stroke="#efe6d0" stroke-width=".9"/>` +
    `<path d="M10.2 20 Q8.6 28 9.6 34" fill="none" stroke="#e0b078" stroke-width="1" stroke-linecap="round"/>` +
    `<rect x="48" y="10" width="2" height="36" rx="1" fill="#e8d8b8" ${OW(1.6)}/><path d="M49 7 L46.4 13.4 L51.6 13.4Z" fill="#9aa6b4" ${OW(1.4)}/>` +
    `<path d="M49 36 L45.4 41 L49 40 L52.6 41Z" fill="#c0392b" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<ellipse cx="26" cy="57" rx="5" ry="2.8" fill="#5a3a22" ${O}/><ellipse cx="38" cy="57" rx="5" ry="2.8" fill="#5a3a22" ${O}/>` +
    `<path d="M21.5 56 Q20 45 23.5 35 L40.5 35 Q44 45 42.5 56 Q32 58.4 21.5 56Z" fill="#5a6b78" ${O}/>` +
    `<path d="M38.4 37 Q42 45 41 55 L37.4 55.6 Q39.6 46 38.4 37Z" fill="#43525d"/>` +
    `<path d="M22.4 49.6 L41.6 49.6 L41.4 53.6 L22.6 53.6Z" fill="#8a5a33" ${OW(1.6)}/><path d="M26 49.6 L26 53.6 M32 49.6 L32 53.6 M38 49.6 L38 53.6" stroke="#5a3a22" stroke-width=".9"/>` +
    `<path d="M22 44 Q32 47.4 42 44" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M22 44 Q32 47.4 42 44" fill="none" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>` +
    `<ellipse cx="19.4" cy="43.4" rx="3.6" ry="6" transform="rotate(14 19.4 43.4)" fill="#5a6b78" ${O}/><rect x="15.6" y="45.6" width="7.6" height="4" rx="1.4" fill="#8a5a33" ${OW(1.6)}/>` + hand(14, 41, '#d9a578') +
    `<ellipse cx="44.6" cy="43" rx="3.6" ry="6" transform="rotate(-14 44.6 43)" fill="#43525d" ${O}/><rect x="41" y="45.4" width="7.6" height="4" rx="1.4" fill="#8a5a33" ${OW(1.6)}/>` + hand(48.6, 46.6, '#d9a578') +
    `<path d="M18 38.4 Q32 31 46 38.4 Q51 47 48 54.4 L41 49.6 Q32 52.6 23 49.6 L16 54.4 Q13 47 18 38.4Z" fill="#c58a4a" ${O}/>` +
    `<path d="M38 36 Q47 38 47.4 46 Q47.6 51 45.6 53 L42 50 Q46 45 38 36Z" fill="#a66d33"/>` +
    `<circle cx="22" cy="43" r="1.6" fill="#7a4a26"/><circle cx="26" cy="47.4" r="1.2" fill="#7a4a26"/><circle cx="43" cy="41" r="1.5" fill="#7a4a26"/><circle cx="19.4" cy="49.4" r="1.2" fill="#7a4a26"/><circle cx="45.6" cy="48.4" r="1.2" fill="#7a4a26"/>` +
    `<path d="M20.6 37.4 Q32 31.8 43.4 37.4 L42 40.6 Q32 36 22 40.6Z" fill="#f2e8d4" ${O}/><path d="M24 37.6 L25.4 39.6 M28 36.4 L29.2 38.4 M32 36 L32.8 38 M36 36.4 L36.6 38.4 M40 37.4 L40.4 39.2" stroke="#d6c8ac" stroke-width="1.2" stroke-linecap="round"/>` +
    head('#d9a578', '#bf8a5c', 25, 13.6, 11.4) +
    `<path d="M18.4 22.4 Q16.4 12 24.6 10 L22 6.6 L28 9.4 L30 4.8 L33.6 9 L38 5.6 L38.6 10.4 Q47 12 45.6 22.4 Q41 17.6 32 17.6 Q23 17.6 18.4 22.4Z" fill="#3b2a1c" ${O}/>` +
    `<path d="M18.2 22.6 Q32 16.6 45.8 22.6 L45.4 19 Q32 13.4 18.6 19Z" fill="#efe3c6" ${O}/><path d="M22 18.6 L22.6 22 M28 17 L28.4 20.4 M34 17 L34.4 20.4 M40 18.6 L40.2 22" stroke="#b0392b" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M45 20.6 Q52.6 19.6 54 29 Q50.6 25 45.4 24.6Z" fill="#efe3c6" ${OW(1.6)}/>` +
    eyes(26.4, 5.2) + `<path d="M24.4 22.8 L29.6 24.2 M39.6 22.8 L34.4 24.2" stroke="#3b2a1c" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M39.4 28.4 L42.4 32.6" stroke="#8e3a3a" stroke-width="1" stroke-linecap="round"/>` +
    `<circle cx="25.4" cy="32.4" r=".5" fill="#6a4a30"/><circle cx="27.4" cy="33.6" r=".5" fill="#6a4a30"/><circle cx="36.6" cy="33.6" r=".5" fill="#6a4a30"/><circle cx="38.6" cy="32.4" r=".5" fill="#6a4a30"/><circle cx="32" cy="35" r=".5" fill="#6a4a30"/>` +
    cheeks(30, 8.8) + `<path d="M29.6 31.6 Q32.4 33 35 31" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  // Bergere : grand chapeau de paille, foulard, houlette, minuscule mouton.
  shepherd_zi: svg(
    `<rect x="12.8" y="12" width="3.2" height="46" rx="1.4" fill="#8a5a33" ${O}/>` +
    `<path d="M14.4 12 Q14.4 4.4 8.4 6 Q5.6 7.2 6.6 11.2" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M14.4 12 Q14.4 4.4 8.4 6 Q5.6 7.2 6.6 11.2" fill="none" stroke="#8a5a33" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M14.4 40 L12 44 M14.4 46 L17 49" stroke="#e0b078" stroke-width="0" />` +
    feet('#6b4226') +
    `<path d="M19 56.6 Q17.4 45 22.4 36 L41.6 36 Q46.6 45 45 56.6 Q32 59 19 56.6Z" fill="#9a7bc4" ${O}/>` +
    `<path d="M39 38.6 Q45 46 44 55.6 L38.6 56.2 Q41.6 47 39 38.6Z" fill="#7a5da8"/>` +
    `<path d="M26 47 Q26.6 52 25 57 M32 47.6 L32 58 M38 47 Q37.4 52 39 57" fill="none" stroke="#7a5da8" stroke-width="1" opacity=".8"/>` +
    `<path d="M20.4 52.6 Q32 56 43.6 52.6" fill="none" stroke="#e8d8b8" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M22.6 36.4 Q32 34 41.4 36.4 L42 46.4 Q32 49.6 22 46.4Z" fill="#f6f1e6" ${O}/>` +
    `<path d="M22 44.6 Q32 48 42 44.6 L42.4 47.6 Q32 51 21.6 47.6Z" fill="#3aa59a" ${O}/>` +
    `<ellipse cx="19.4" cy="42.4" rx="3.6" ry="5.6" transform="rotate(12 19.4 42.4)" fill="#f6f1e6" ${O}/>` + hand(15.6, 47.6, '#f7d0ac') +
    `<ellipse cx="44.6" cy="42.4" rx="3.6" ry="5.6" transform="rotate(-12 44.6 42.4)" fill="#dcd3c0" ${O}/>` + hand(48, 47.4, '#f7d0ac') +
    `<circle cx="14.8" cy="46" r="2.8" fill="none"/>` +
    `<ellipse cx="50.6" cy="53.4" rx="6" ry="4.4" fill="#fbf6ea" ${O}/><circle cx="46.6" cy="51.4" r="2.6" fill="#fbf6ea" ${OW(1.4)}/><circle cx="51" cy="49.6" r="3" fill="#fbf6ea" ${OW(1.4)}/><circle cx="54.6" cy="52" r="2.6" fill="#fbf6ea" ${OW(1.4)}/>` +
    `<ellipse cx="50.6" cy="53.4" rx="4.6" ry="3" fill="#fbf6ea"/>` +
    `<path d="M55 55 Q57.6 54 57.4 57.4 Q56 58.4 54.6 57.6Z" fill="#6b4a3a" ${OW(1.4)}/><ellipse cx="56.6" cy="55.6" rx="1.6" ry="1.2" fill="#6b4a3a"/><circle cx="57" cy="55.2" r=".5" fill="#fff"/>` +
    `<path d="M47.4 57.4 L47.4 59 M52.6 58.2 L52.6 59.6" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M18.6 28 Q14 34 16.6 42 Q20.6 38 21.6 30Z" fill="#6b3f26" ${O}/><path d="M45.4 28 Q50 34 47.4 42 Q43.4 38 42.4 30Z" fill="#6b3f26" ${O}/><circle cx="16.8" cy="42.6" r="1.8" fill="#e2607a" ${OW(1.2)}/><circle cx="47.2" cy="42.6" r="1.8" fill="#e2607a" ${OW(1.2)}/>` +
    head('#f7d0ac', '#e2ac86', 26, 13.4, 11.4) +
    `<path d="M19 24 Q20 17 32 17 Q44 17 45 24 Q39 20.6 32 22.4 Q25 20.6 19 24Z" fill="#6b3f26" ${O}/>` +
    eyes(28, 5.2) + cheeks(31.4, 8.6) + smile(32.6) +
    `<path d="M25 25.4 Q27 24 29.4 25 M38.6 25.4 Q37 24 34.6 25" fill="none" stroke="#6b3f26" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M26.4 38 Q32 42.6 37.6 38 L36.4 42 L38 49.6 L32.2 46 L28 49.6 L28.4 42Z" fill="#e2607a" ${OW(1.6)}/><path d="M33 40.4 L35.4 44" stroke="#b83c58" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="17" rx="21.4" ry="6" fill="#e8cf8a" ${O}/><path d="M48 18.4 Q44 22.6 34 22 Q44 20.4 47 16.6Z" fill="#c9ad62"/>` +
    `<path d="M20.6 16.4 Q20.2 4.4 32 4.4 Q43.8 4.4 43.4 16.4 Q32 20.4 20.6 16.4Z" fill="#efd89a" ${O}/><path d="M37 7 Q43 7.4 43 15.6 Q40.6 17.4 37 17.8Z" fill="#c9ad62"/>` +
    `<path d="M20.8 14 Q32 18 43.2 14 L43.4 10.4 Q32 14.4 20.6 10.4Z" fill="#3aa59a" ${O}/>` +
    `<path d="M42.8 12.4 Q50 14 51.6 24 Q48.4 20.6 44.6 18Z" fill="#3aa59a" ${OW(1.6)}/>` +
    `<path d="M24.4 7.6 Q27.6 5.6 31 5.6 M9 15.6 Q13 13.4 18 13.6" fill="none" stroke="#fffbe6" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  // Pecheur : chapeau conique, manteau de paille, canne a peche et poisson.
  fisher_hai: svg(
    `<path d="M45 46 L57 6" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M45 46 L57 6" stroke="#8a5a33" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M57 6 Q61.4 14 59 25" fill="none" stroke="#f1f1e6" stroke-width="1"/>` +
    `<g transform="rotate(8 58.4 32)"><path d="M54 32 Q58.4 24.4 62.8 32 Q62.8 39.4 58.4 40.6 Q54 39.4 54 32Z" fill="#8fc4e0" ${OW(1.6)}/><path d="M58.4 40 L55.4 44.4 L61.4 44.4Z" fill="#6aa6c8" ${OW(1.4)}/><path d="M56.4 28.6 Q58.4 26.6 60.4 28.6" fill="none" stroke="#e8f6ff" stroke-width="1" stroke-linecap="round"/><path d="M54.6 33.6 Q58.4 36 62.2 33.6" fill="none" stroke="#e8f6ff" stroke-width=".8"/><circle cx="56.8" cy="29.6" r=".9" fill="${K}"/></g>` +
    `<path d="M20 57 L22 61" stroke="none"/>` +
    `<ellipse cx="26" cy="57.4" rx="4.8" ry="2.6" fill="#4a3324" ${O}/><ellipse cx="38" cy="57.4" rx="4.8" ry="2.6" fill="#4a3324" ${O}/>` +
    `<path d="M15.6 57 Q12.4 43 21 34.6 L43 34.6 Q51.6 43 48.4 57 Q32 60 15.6 57Z" fill="#9c7a38" ${O}/>` +
    `<path d="M26 36 L38 36 L39 56 Q32 58 25 56Z" fill="#3f5f7a" ${O}/>` +
    teeth(14.2, 49.8, 49.4, 53.6, 9, '#a98640', 3.6) +
    teeth(16, 48, 43.6, 47.6, 8, '#bd9a4c', 3.6) +
    `<path d="M33 35 L33 36" stroke="none"/>` +
    `<ellipse cx="18" cy="43.6" rx="3.6" ry="6" transform="rotate(12 18 43.6)" fill="#b8944a" ${O}/>` + hand(15.4, 50.4, '#d9a578') +
    `<ellipse cx="45.4" cy="42.6" rx="3.4" ry="5.6" transform="rotate(-24 45.4 42.6)" fill="#a98640" ${O}/>` + hand(46, 46.4, '#d9a578') +
    teeth(15.6, 48.4, 36.4, 40.4, 8, '#c9a752', 3.6) +
    `<path d="M20 38.6 Q22 36.6 24 37.6 M30 38.4 Q32 36.6 34 37.6 M40 38.6 Q42 36.6 44 37.6" fill="none" stroke="#e6cd84" stroke-width="1.1" stroke-linecap="round"/>` +
    head('#d9a578', '#bf8a5c', 26, 12.6, 10.6) +
    `<path d="M26 31 Q32 30 38 31 Q36.6 36.4 32 38.6 Q27.4 36.4 26 31Z" fill="#cfd3d6" ${OW(1.6)}/>` +
    `<path d="M23.4 28.6 Q27.6 28 30.2 30 M40.6 28.6 Q36.4 28 33.8 30" fill="none" stroke="#cfd3d6" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M25.2 27.6 Q27.2 25.6 29.4 27.4 M34.6 27.4 Q36.8 25.6 38.8 27.6" fill="none" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M29.6 32.6 Q32 34.4 34.4 32.6" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` + cheeks(30.4, 9.4) +
    `<path d="M9.6 21.4 L32 3 L54.4 21.4 Q32 27.4 9.6 21.4Z" fill="#e0bb62" ${O}/>` +
    `<path d="M32 3 L54.4 21.4 Q47 23.4 40 24.2 Q41 12 32 3Z" fill="#c29a42"/>` +
    `<path d="M32 4.6 Q22 12 15 20 M32 4.6 Q27 13 24 23 M32 4.6 Q38 13 40.4 23.6" fill="none" stroke="#a98030" stroke-width="1"/>` +
    `<path d="M12.6 18.4 Q32 23.4 51.4 18.4 M17.6 13.6 Q32 17.8 46.4 13.6" fill="none" stroke="#a98030" stroke-width="1"/>` +
    `<path d="M25 9 Q28 6.6 30.4 6" fill="none" stroke="#fff3c0" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M14 20.4 Q15 30 20 34 M50 20.4 Q49 30 44 34" fill="none" stroke="#c0392b" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  // Envoye du Roi-Dragon : ecailles turquoise aux joues, robe marine a vagues, perle lumineuse.
  envoy_longwang: svg(
    `<defs>` +
    `</defs>` +
    feet('#142244') +
    `<path d="M18 57 Q14 43 21.4 35 L42.6 35 Q50 43 46 57 Q32 60 18 57Z" fill="#1d3a6b" ${O}/>` +
    `<path d="M40 37.6 Q49 45 45 56 L39.6 56.8 Q44 46 40 37.6Z" fill="#132a52"/>` +
    [[24, 51], [32, 51], [40, 51], [28, 55], [36, 55]].map(([x, y]) =>
      `<path d="M${x - 4} ${y + 3} a4 4 0 0 1 8 0 M${x - 2.4} ${y + 3} a2.4 2.4 0 0 1 4.8 0" fill="none" stroke="#6fb0e8" stroke-width=".9"/>`).join('') +
    `<path d="M21.6 42 Q32 45.4 42.4 42 L42.4 46.4 Q32 49.8 21.6 46.4Z" fill="#e6b84a" ${O}/><circle cx="32" cy="46.4" r="2.5" fill="#4fd1a5" ${OW(1.4)}/>` +
    `<ellipse cx="18.6" cy="45" rx="5" ry="8" transform="rotate(8 18.6 45)" fill="#1d3a6b" ${O}/><path d="M13.4 50.4 Q18.6 54.6 24 50.6" fill="none" stroke="#bff3f0" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M15 44 a2.6 2.6 0 0 1 5.2 0 M16.4 44 a1.4 1.4 0 0 1 2.4 0" fill="none" stroke="#6fb0e8" stroke-width=".8"/>` +
    `<ellipse cx="45" cy="42.4" rx="4.2" ry="7" transform="rotate(-20 45 42.4)" fill="#132a52" ${O}/><path d="M42.4 47 Q47 49 50.4 45.6" fill="none" stroke="#bff3f0" stroke-width="2.4" stroke-linecap="round"/>` + hand(49.8, 45.6, '#f2d5be') +
    `<circle cx="49.8" cy="39.4" r="8.4" fill="#bff5ff" fill-opacity="0.26" class="glow"/><circle cx="49.8" cy="39.6" r="4.6" fill="#d6f6ff" ${OW(1.6)}/><circle cx="48.2" cy="37.8" r="1.3" fill="#fff"/>` +
    `<path d="M20.4 36.6 Q32 32.4 43.6 36.6 Q42 41.6 36.6 40.6 Q32 45 27.4 40.6 Q22 41.6 20.4 36.6Z" fill="#2fc5c0" ${O}/>` +
    `<path d="M23.4 37 Q25 35.4 26.6 36.6 M37.4 36.6 Q39 35.4 40.6 37" fill="none" stroke="#e6fffb" stroke-width="1" stroke-linecap="round"/><circle cx="32" cy="39.4" r="1.4" fill="#e6b84a"/>` +
    `<circle cx="32" cy="9.4" r="5.2" fill="#1b1b2e" ${O}/>` +
    head('#f2d5be', '#dcb497', 25.6, 13.2, 11.2) +
    [[21.9, 29.4], [24, 30.8], [22, 31.8], [24.4, 33]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="1.5" fill="#3fd9d0" stroke="#0f6b73" stroke-width=".6"/><path d="M${x - .9} ${y - .4} Q${x} ${y - 1.2} ${x + .9} ${y - .4}" fill="none" stroke="#d6fffb" stroke-width=".5"/>`).join('') +
    [[42.1, 29.4], [40, 30.8], [42, 31.8], [39.6, 33]].map(([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="1.5" fill="#3fd9d0" stroke="#0f6b73" stroke-width=".6"/><path d="M${x - .9} ${y - .4} Q${x} ${y - 1.2} ${x + .9} ${y - .4}" fill="none" stroke="#d6fffb" stroke-width=".5"/>`).join('') +
    `<path d="M18.8 24.6 Q18.2 11.6 32 11.4 Q45.8 11.6 45.2 24.6 Q40.6 17.4 32 18 Q23.4 17.4 18.8 24.6Z" fill="#1b1b2e" ${O}/>` +
    `<path d="M23.4 14.6 Q26.4 12.8 30 12.6" fill="none" stroke="#4a5a8a" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M26.6 12.6 L28.4 6.6 L32 9.8 L35.6 6.6 L37.4 12.6Z" fill="#e6b84a" ${O}/><circle cx="32" cy="8.6" r="1.4" fill="#ff7a6a" stroke="${K}" stroke-width=".8"/>` +
    eyes(26.8, 5) + `<path d="M24.4 23.6 L29.6 24.2 M39.6 23.6 L34.4 24.2" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M28.6 31 Q25.4 31.2 24.4 35 M35.4 31 Q38.6 31.2 39.6 35" fill="none" stroke="#2a9ea0" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M30.4 32.8 Q32 33.8 33.6 32.8" fill="none" stroke="${K}" stroke-width="1.1" stroke-linecap="round"/>`
  ),

  // Grue messagere de la Reine Mere de l'Occident : ailes deployees, couronne rouge, rouleau a cordon rouge.
  crane_envoy: svg(
    `<path d="M25.4 46 L38.6 46 L41.6 55 Q32 51.6 22.4 55Z" fill="#3a3f4a" ${O}/>` +
    `<path d="M28.6 50 L27 57.6 M27 57.6 L23.4 59 M27 57.6 L27.8 59.4" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M28.6 50 L27 57.6 M27 57.6 L23.4 59 M27 57.6 L27.8 59.4" fill="none" stroke="#e9a0a0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M35.4 50 L37 57.6 M37 57.6 L40.6 59 M37 57.6 L36.2 59.4" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M35.4 50 L37 57.6 M37 57.6 L40.6 59 M37 57.6 L36.2 59.4" fill="none" stroke="#e9a0a0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    [['#e9eff6', ''], ['#d3dde9', ' transform="translate(64 0) scale(-1 1)"']].map(([g, t]) =>
      `<g${t}><path d="M26 32 Q14 22 2.4 21 Q5 25.6 3.4 29.6 Q6.4 32.4 5.4 36.6 Q8.6 38.6 8.6 43 Q18 45 27 43.4Z" fill="${g}" ${O}/>` +
      `<path d="M2.4 21 Q5 25.6 3.4 29.6 Q6.4 32.4 5.4 36.6 Q8.6 38.6 8.6 43 Q18 45 27 43.4 L27 38.6 Q18 40 12.6 35 Q10 31 8.6 25.4Z" fill="#363b47"/>` +
      `<path d="M8.6 25.4 Q11 31 12.6 35 M13 36.4 L10.4 42 M18 38.4 L16.4 44 M23 39 L22 44" fill="none" stroke="#6a7080" stroke-width=".9" stroke-linecap="round"/>` +
      `<path d="M14 30 Q21 28 26 32 M16 34 Q22 33 26 35.4" fill="none" stroke="#b9c8da" stroke-width="1" stroke-linecap="round"/></g>`).join('') +
    `<path d="M32 34 Q36.6 26 31 19" fill="none" stroke="${K}" stroke-width="8.6" stroke-linecap="round"/><path d="M32 34 Q36.6 26 31 19" fill="none" stroke="#fff" stroke-width="5.4" stroke-linecap="round"/>` +
    `<path d="M33.6 30 Q34.6 25 32.6 21.4" fill="none" stroke="#d3deea" stroke-width="1.6" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="40" rx="9.6" ry="12.4" fill="#fff" ${O}/><path d="M38.4 31.6 Q43 40 38.4 50.6 Q41 40 38.4 31.6Z" fill="#cfd9e5" stroke="#cfd9e5" stroke-width="1.4"/>` +
    `<path d="M26.4 44 Q32 47 37.6 44" fill="none" stroke="#e1e8f0" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="30" cy="15" r="8.8" fill="#fff" ${O}/>` +
    `<path d="M34.6 13.6 Q38.4 16.4 35.6 21.6 Q37.6 16.8 34.6 13.6Z" fill="#cfd9e5" stroke="#cfd9e5" stroke-width="1.2"/>` +
    `<path d="M21.6 12.6 Q22.2 6 30 5.8 Q36.6 6.2 38 12.4 Q30 9.4 21.6 12.6Z" fill="#d62f2f" ${O}/><path d="M25 9 Q27.6 7.6 30 7.6" fill="none" stroke="#ff8f8f" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M22.6 16 L8.6 19.6 L22.4 20.8Z" fill="#e0a43a" ${O}/><path d="M22.2 18.4 L11.4 19.6" stroke="#8a5a1a" stroke-width=".8" stroke-linecap="round"/>` +
    `<circle cx="27" cy="14" r="1.9" fill="${K}"/><circle cx="27.6" cy="13.3" r=".75" fill="#fff"/><path d="M24 11 L29.4 11.6" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="25.2" cy="18.2" rx="2" ry="1.2" fill="#ff8f8f" opacity=".5"/>` +
    `<path d="M27.6 30 Q29 37 32 40.6 M36.6 30 Q35 37 32 40.6" fill="none" stroke="${K}" stroke-width="3.2" stroke-linecap="round"/><path d="M27.6 30 Q29 37 32 40.6 M36.6 30 Q35 37 32 40.6" fill="none" stroke="#c0392b" stroke-width="1.3" stroke-linecap="round"/>` +
    `<rect x="23.6" y="41" width="16.8" height="6.2" rx="2.6" fill="#f4ead0" ${O}/><rect x="22.6" y="40.4" width="3.8" height="7.4" rx="1.6" fill="#c0392b" ${OW(1.4)}/><rect x="37.6" y="40.4" width="3.8" height="7.4" rx="1.6" fill="#c0392b" ${OW(1.4)}/><rect x="30.6" y="40.2" width="2.8" height="7.8" rx="1" fill="#e6b84a" ${OW(1.2)}/>` +
    `<path d="M27 43.4 L29.2 43.4 M27 45.4 L29.2 45.4 M34.8 43.4 L37 43.4" stroke="#b69a6a" stroke-width=".8" stroke-linecap="round"/>`
  ),

  // Dixieme Soleil : petite boule de lumiere terrifiee, flammeches qui tremblent, grands yeux humides.
  sun_ten: svg(
    `<defs>` +
    `</defs>` +
    `<circle cx="32" cy="35" r="30" fill="#fff3a0" fill-opacity="0.24" class="glow"/>` +
    [[0, 1.1], [-38, .85], [38, .85], [-72, .72], [72, .72], [-108, .6], [108, .6]].map(([a, s]) =>
      `<g transform="translate(32 36) rotate(${a}) scale(${s})"><path d="M-6 -14 Q-9 -21 -3.4 -26.4 Q-3.6 -21.6 -0.6 -20.2 Q1.2 -26 6.4 -30.6 Q8.4 -22 6 -14Z" fill="#ffb62e" stroke="${K}" stroke-width="${(1.8 / s).toFixed(2)}" stroke-linejoin="round"/>` +
      `<path d="M-1.6 -16 Q-3 -20 -0.4 -22.6 Q1.6 -19 3 -16Z" fill="#ffe27a"/></g>`).join('') +
    `<ellipse cx="27" cy="55.6" rx="3.4" ry="2.2" fill="#f2a030" ${O}/><ellipse cx="37" cy="55.6" rx="3.4" ry="2.2" fill="#f2a030" ${O}/>` +
    `<circle cx="32" cy="36" r="18" fill="#ffd95a" ${O}/>` +
    `<path class="glow" d="M44.4 26 Q51 36 43 47.6 Q38 52.6 30 53.6 Q43 50 44.4 26Z" fill="#f2a030" opacity=".55"/>` +
    `<ellipse cx="23.4" cy="25.4" rx="3.6" ry="1.9" fill="#fff" opacity=".7" transform="rotate(-30 23.4 25.4)"/>` +
    `<ellipse cx="25.2" cy="37" rx="4.4" ry="5.2" fill="#4a2a16"/><ellipse cx="38.8" cy="37" rx="4.4" ry="5.2" fill="#4a2a16"/>` +
    `<circle cx="23.8" cy="34.8" r="1.9" fill="#fff"/><circle cx="37.4" cy="34.8" r="1.9" fill="#fff"/><circle cx="26.6" cy="39.4" r=".9" fill="#fff"/><circle cx="40.2" cy="39.4" r=".9" fill="#fff"/>` +
    `<path d="M21.4 39.6 Q25.2 43.4 29 39.6 M35 39.6 Q38.8 43.4 42.6 39.6" fill="none" stroke="#8fd3ff" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M20.4 31 L28.6 28 M43.6 31 L35.4 28" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<ellipse cx="21" cy="44.4" rx="2.8" ry="1.7" fill="#ff7f7f" opacity=".5"/><ellipse cx="43" cy="44.4" rx="2.8" ry="1.7" fill="#ff7f7f" opacity=".5"/>` +
    `<path d="M28.6 46.4 Q30.3 44.8 32 46.4 Q33.7 48 35.4 46.4" fill="none" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M20.4 44.6 Q18.6 47.6 20.4 49 Q22.2 47.6 20.4 44.6Z" fill="#9fd4ff" stroke="${K}" stroke-width=".8"/>` +
    `<circle cx="28.6" cy="51" r="3" fill="#ffc94a" ${OW(1.6)}/><circle cx="35.4" cy="51" r="3" fill="#ffc94a" ${OW(1.6)}/>` +
    `<path d="M8.6 30 Q5.6 36 8.6 42 M55.4 30 Q58.4 36 55.4 42" fill="none" stroke="#f7a928" stroke-width="1.6" stroke-linecap="round"/>`
  ),

  // Chang'e a la Lune : robe-lumiere nacree, manches flottantes, croissant dans les cheveux, lapin de jade, aura lunaire.
  change_moon: svg(
    `<defs>` +
    `</defs>` +
    `<circle cx="32" cy="32" r="31.5" fill="#eaf7ff" fill-opacity="0.29" class="glow"/><circle cx="32" cy="32" r="28.6" fill="none" stroke="#f6ecc9" stroke-width="1" stroke-dasharray="2 3"/>` +
    `<path d="M20.6 37 Q5 33 4.6 46 Q4.8 52 10 52.4" fill="none" stroke="${K}" stroke-width="5.4" stroke-linecap="round"/><path d="M20.6 37 Q5 33 4.6 46 Q4.8 52 10 52.4" fill="none" stroke="#bfe0ff" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M43.4 37 Q59 33 59.4 46 Q59.2 52 54 52.4" fill="none" stroke="${K}" stroke-width="5.4" stroke-linecap="round"/><path d="M43.4 37 Q59 33 59.4 46 Q59.2 52 54 52.4" fill="none" stroke="#a9c6ee" stroke-width="2.4" stroke-linecap="round"/>` +
    `<ellipse cx="26.5" cy="57.4" rx="4.4" ry="2.4" fill="#dfe9f8" ${O}/><ellipse cx="37.5" cy="57.4" rx="4.4" ry="2.4" fill="#dfe9f8" ${O}/>` +
    `<path d="M17 57.4 Q13 43 21.4 35 L42.6 35 Q51 43 47 57.4 Q32 60.4 17 57.4Z" fill="#d9e9fb" ${O}/>` +
    `<path d="M40 37.4 Q49 45 45.4 56.6 L40 57.4 Q44 47 40 37.4Z" fill="#b7d1f2"/>` +
    `<path d="M25 50 Q32 53 39 50 L40.4 57.6 Q32 59.4 23.6 57.6Z" fill="#e9f1fb"/><path d="M28 53.4 Q32 55.6 36 53.4" fill="none" stroke="#a9c6ee" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M22 43.6 Q32 47 42 43.6 L42 48 Q32 51.4 22 48Z" fill="#8fb0e0" ${O}/><circle cx="32" cy="47.4" r="2.6" fill="#f8fbff" ${OW(1.4)}/><path d="M31 46.6 Q32 45.8 33 46.6" fill="none" stroke="#8fb0e0" stroke-width=".8"/>` +
    `<path d="M24.4 35.4 L32 45 L39.6 35.4 L37 35 L32 41 L27 35Z" fill="#f2f8ff" ${O}/>` +
    `<path d="M22 37.6 Q8 40.4 5.8 52.4 Q11.6 57 16.6 51.4 Q20.4 46.6 24.4 46Z" fill="#f4f9ff" ${O}/><path d="M6 52 Q11.6 57 16.4 51.6" fill="none" stroke="#8fb0e0" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M42 37.6 Q56 40.4 58.2 52.4 Q52.4 57 47.4 51.4 Q43.6 46.6 39.6 46Z" fill="#d9e9fb" ${O}/><path d="M58 52 Q52.4 57 47.6 51.6" fill="none" stroke="#7da0d4" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M10 45 Q14 41 19 43 M54 45 Q50 41 45 43" fill="none" stroke="#bfd4f0" stroke-width="1" stroke-linecap="round"/>` +
    `<circle cx="32" cy="10.6" r="6" fill="#1f2547" ${O}/>` +
    head('#fbe3d0', '#ecc4ac', 25.6, 13, 11.2) +
    `<path d="M18.8 26 Q13.4 40 18.4 53 Q22.2 44 22 30Z" fill="#1f2547" ${O}/><path d="M45.2 26 Q50.6 40 45.6 53 Q41.8 44 42 30Z" fill="#1f2547" ${O}/>` +
    `<path d="M19 25.4 Q18.4 12.4 32 12.2 Q45.6 12.4 45 25.4 Q41 18 34.6 19.4 L32 23.4 L29.4 19.4 Q23 18 19 25.4Z" fill="#1f2547" ${O}/>` +
    `<path d="M23.4 15.6 Q26.4 13.8 30 13.6" fill="none" stroke="#5a6ab0" stroke-width="1.2" stroke-linecap="round"/>` +
    `<g transform="translate(31 8) rotate(-120)"><path d="M0 -6.4 A6.4 6.4 0 1 0 0 6.4 A8.6 8.6 0 0 1 0 -6.4Z" fill="#f8fbff" ${O}/></g><path d="M25.6 8.6 Q27 11.6 30 12.8" fill="none" stroke="#bfe0ff" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M26 27.6 Q28.4 29.6 30.8 27.6 M33.2 27.6 Q35.6 29.6 38 27.6" fill="none" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M24.6 25 Q27.4 23.6 30 24.6 M39.4 25 Q36.6 23.6 34 24.6" fill="none" stroke="#1f2547" stroke-width="1.2" stroke-linecap="round"/>` +
    cheeks(31, 8.4, '#ff9a9a') + `<path d="M30 32.6 Q32 34 34 32.6" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
        `<ellipse cx="50.6" cy="55.4" rx="4.8" ry="3.4" fill="#fff" ${OW(1.6)}/><ellipse cx="48.2" cy="46.6" rx="1.3" ry="3.4" fill="#fff" ${OW(1.4)}/><ellipse cx="52.6" cy="46.6" rx="1.3" ry="3.4" fill="#fff" ${OW(1.4)}/>` +
    `<circle cx="50.4" cy="50.6" r="3.8" fill="#fff" ${OW(1.6)}/><path d="M48.2 45.6 L48.2 47.6 M52.6 45.6 L52.6 47.6" stroke="#f5b6c4" stroke-width="1" stroke-linecap="round"/>` +
    `<circle cx="49" cy="50.2" r=".7" fill="${K}"/><circle cx="52" cy="50.2" r=".7" fill="${K}"/><circle cx="50.5" cy="52.4" r="1.5" fill="#5fd0a0" ${OW(1)}/>` +
    `<path d="M8 11 l.8 2.2 2.2.8 -2.2.8 -.8 2.2 -.8-2.2 -2.2-.8 2.2-.8z M56 8 l.6 1.8 1.8.6 -1.8.6 -.6 1.8 -.6-1.8 -1.8-.6 1.8-.6z M55 24 l.5 1.5 1.5.5 -1.5.5 -.5 1.5 -.5-1.5 -1.5-.5 1.5-.5z" fill="#fff"/>`
  ),

  // ---------- Pourparlers (volcan, mer, fusang) ----------
  // Chi, vieil attiseur du temple du feu (parley_sun6) : vieil homme voute, robe rouge brulee, tablier de cendre,
  // soufflet de forge a la main, braise au front.
  parley_sun6: svg(
    `<ellipse cx="21.6" cy="30" rx="10.6" ry="10" fill="#7c2a1a" ${O}/>` +
    feet('#3d2018') +
    `<path d="M18.6 57.6 Q14.4 46 20 38 Q24 35.6 29 35.6 L37 35.6 Q44 36 46.4 44 Q47.6 51 45.4 57.6 Q32 60.4 18.6 57.6Z" fill="#a83a22" ${O}/>` +
    `<path d="M18.8 54.4 Q32 58.4 45.2 54.4 L45.4 57.6 Q32 60.4 18.6 57.6Z" fill="#3d2018"/>` +
    `<path d="M24.6 38 L39.4 38 L41.6 56.4 Q32 58.6 22.4 56.4Z" fill="#9a948e" ${O}/>` +
    `<path d="M37.6 38.6 L39.4 38 L41.6 56 L38.6 56.5Z" fill="#7d7771"/>` +
    `<ellipse cx="28.4" cy="46.4" rx="3.6" ry="2.4" fill="#4a4440" opacity=".55"/><ellipse cx="35.4" cy="52" rx="3" ry="2" fill="#4a4440" opacity=".55"/>` +
    `<rect x="27.4" y="48.2" width="9" height="5.2" rx="1" fill="#b8b2aa" ${OW(1.4)}/>` +
    `<path d="M21 44.4 Q32 47.6 43 44.4" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M21 44.4 Q32 47.6 43 44.4" fill="none" stroke="#c08a4a" stroke-width="1.8" stroke-linecap="round"/>` +
    // soufflet : buse de fer, cuir plisse, deux planches, poignee
    `<g transform="translate(49 48) rotate(-35) scale(.8)">` +
    `<rect x="-16" y="-1.8" width="8.6" height="3.6" fill="#4a4440" ${O}/>` +
    `<path d="M-8 -2.6 L10 -8.4 L10 8.4 L-8 2.6Z" fill="#b8743f" ${O}/>` +
    `<path d="M-3 -4 L-3 4 M2 -5.6 L2 5.6 M6.4 -7 L6.4 7" fill="none" stroke="#3d2018" stroke-width="1.3"/>` +
    `<rect x="10" y="-10" width="3.6" height="20" rx="1.2" fill="#d9a25a" ${O}/><rect x="13.6" y="-2" width="5" height="4" rx="1.4" fill="#c08a4a" ${O}/></g>` +
    `<circle cx="38.2" cy="55.4" r="2.2" fill="#ff8a24"/><circle cx="38.2" cy="55.4" r="1" fill="#ffd24a"/><rect x="34" y="57.6" width="1.6" height="1.6" fill="#ff8a24"/>` +
    `<ellipse cx="19" cy="46" rx="4.2" ry="7" transform="rotate(14 19 46)" fill="#a83a22" ${O}/>` + hand(17.4, 52.6, '#d9a173') +
    arm('M43 40.6 Q51 39 56 41.4', 5, '#a83a22') + hand(58.4, 41.2, '#d9a173') +
    `<g transform="translate(2 0)">` +
    `<circle cx="32" cy="15.8" r="3.8" fill="#e4ded2" ${O}/>` +
    head('#d9a173', '#bd8456', 30, 13.4, 11) +
    `<ellipse cx="19.4" cy="31" rx="2.6" ry="4.4" fill="#e4ded2" ${OW(1.4)}/><ellipse cx="44.6" cy="31" rx="2.6" ry="4.4" fill="#e4ded2" ${OW(1.4)}/>` +
    `<ellipse cx="22.6" cy="35.4" rx="3.2" ry="2" fill="#4a4440" opacity=".4"/>` +
    `<path d="M32 19.4 Q36 22.8 32 26.4 Q28 22.8 32 19.4Z" fill="#ff8a24"/><path d="M32 22 Q33.4 23.6 32 25 Q30.6 23.6 32 22Z" fill="#ffd24a"/>` +
    `<path d="M22.2 29.4 Q26 27 30.2 29.2 M33.8 29.2 Q38 27 41.8 29.4" fill="none" stroke="#e4ded2" stroke-width="2.4" stroke-linecap="round"/>` +
    pxEyes(32, 2, 27, 37, 4) +
    `<ellipse cx="32" cy="35" rx="2.2" ry="1.6" fill="#bd8456"/>` +
    `<path d="M24.4 37.6 Q26 45.4 32 47 Q38 45.4 39.6 37.6 Q36 40.4 32 39.6 Q28 40.4 24.4 37.6Z" fill="#e4ded2" ${O}/>` +
    `<path d="M26.4 37.4 Q29.2 35.2 32 37.2 Q34.8 35.2 37.6 37.4 Q35 39.6 32 38.6 Q29 39.6 26.4 37.4Z" fill="#e4ded2" ${OW(1.3)}/></g>`
  ),

  // Amiral Xie, amiral de l'escadre du Roi-Dragon (parley_sun8) : crabe-amiral a armure d'ecailles bleu-vert,
  // casque a crete de corail, grande pince levee, epee a pommeau de perle blanche, dignite raide.
  parley_sun8: svg(
    `<path d="M52 5.4 L55.2 10.6 L55.2 38.6 L48.8 38.6 L48.8 10.6Z" fill="#cfe4ee" ${O}/><path d="M52 11 L52 36" fill="none" stroke="#8fb0c4" stroke-width="1.2"/>` +
    `<rect x="45.4" y="38.4" width="13.2" height="3.6" rx="1.4" fill="#d9b04a" ${O}/><rect x="50.4" y="42" width="3.2" height="7" fill="#7a3a2a" ${O}/>` +
    `<circle cx="52" cy="52" r="3.2" fill="#fff" ${O}/><circle cx="51" cy="51" r="1" fill="#cfe0e8"/>` +
    `<ellipse cx="20.6" cy="57.4" rx="3.6" ry="2.2" fill="#b74a38" ${O}/><ellipse cx="27" cy="58.4" rx="3.6" ry="2.2" fill="#b74a38" ${O}/>` +
    `<ellipse cx="37" cy="58.4" rx="3.6" ry="2.2" fill="#b74a38" ${O}/><ellipse cx="43.4" cy="57.4" rx="3.6" ry="2.2" fill="#b74a38" ${O}/>` +
    arm('M20 42 L12.6 39.4', 4.6, '#e0674c') +
    `<path d="M5 38 Q3 30 5.4 22 Q8 25 10.4 29 Q12.4 25 15.6 22.4 Q18 30 16.4 38 Q11 42 5 38Z" fill="#e0674c" ${O}/>` +
    `<path d="M7.4 35 Q6.4 30 7.8 26.4" fill="none" stroke="#f59a80" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M19 57 Q15.6 46 21 36 L43 36 Q48.4 46 45 57 Q32 59.6 19 57Z" fill="#2c9a94" ${O}/>` +
    `<path d="M40 38 Q46.6 46 43.6 56 L39.4 56.6 Q43 46 40 38Z" fill="#1e6f72"/>` +
    `<path d="M20.6 41.4 q2.8 3 5.6 0 q2.8 3 5.6 0 q2.8 3 5.6 0 q2.8 3 5.6 0 M23.4 45 q2.8 3 5.6 0 q2.8 3 5.6 0 q2.8 3 5.6 0 M21 54.6 q2.8 3 5.6 0 q2.8 3 5.6 0 q2.8 3 5.6 0 q2.8 3 5.6 0" fill="none" stroke="#1e6f72" stroke-width="1.1" stroke-linecap="round"/>` +
    `<rect x="19.6" y="47.6" width="24.8" height="3.4" fill="#d9b04a" ${OW(1.4)}/><circle cx="32" cy="49.3" r="2.4" fill="#fff" ${OW(1.2)}/>` +
    `<ellipse cx="19.6" cy="38.6" rx="5" ry="3.6" fill="#1e6f72" ${O}/><ellipse cx="44.4" cy="38.6" rx="5" ry="3.6" fill="#1e6f72" ${O}/>` +
    arm('M44 41.4 L50.4 44', 4.6, '#e0674c') + `<ellipse cx="52" cy="44.4" rx="4.2" ry="3.4" fill="#e0674c" ${O}/><path d="M52 41.6 L52 47.2" fill="none" stroke="${K}" stroke-width="1.2"/>` +
    // crete de corail
    `<path d="M24.6 14 Q18.4 8.6 22.4 2.6 Q25.4 6.2 28.6 5.4 Q28.4 1 32 0.8 Q35.6 1 35.4 5.4 Q38.6 6.2 41.6 2.6 Q45.6 8.6 39.4 14Z" fill="#ff9a82" ${O}/>` +
    `<path d="M32 12 L32 4 M28 11 L25 6.4 M36 11 L39 6.4" fill="none" stroke="#f6c2b4" stroke-width="1.2" stroke-linecap="round"/><circle cx="22.8" cy="3.6" r="1.4" fill="#ffd1c4"/><circle cx="41.2" cy="3.6" r="1.4" fill="#ffd1c4"/><circle cx="32" cy="2.2" r="1.4" fill="#ffd1c4"/>` +
    head('#e0674c', '#b74a38', 25, 13.4, 10.6) +
    `<path d="M18.6 24 Q17.4 11.8 32 11.2 Q46.6 11.8 45.4 24 Q40 18.8 32 18.8 Q24 18.8 18.6 24Z" fill="#2c9a94" ${O}/>` +
    `<path d="M19.8 21.6 Q32 16.4 44.2 21.6" fill="none" stroke="#d9b04a" stroke-width="1.6" stroke-linecap="round"/><circle cx="32" cy="15.4" r="2.1" fill="#fff" ${OW(1.2)}/>` +
    `<path d="M23 22.6 L29.4 24 M41 22.6 L34.6 24" fill="none" stroke="${K}" stroke-width="2" stroke-linecap="round"/>` +
    pxEyes(26, 4, 27, 37) +
    `<path d="M29 32 L35 32 M30.6 32.8 L31 34.6 M33.4 32.8 L33 34.6" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>`
  ),

  // Hegui, la grue au nid retrouve (parley_sun9) : grue blanche a col fin en S, calotte rouge, plumes d'argent,
  // bout des ailes sombre, petit nid d'or garde dans les ailes (deux oeufs), expression apaisee.
  parley_sun9: svg(
    arm('M28.4 52 L26.4 57.6', 1.8, '#5a5560') + arm('M36.4 52 L37.6 57.6', 1.8, '#5a5560') +
    `<ellipse cx="24.6" cy="58.4" rx="3.4" ry="1.5" fill="#5a5560" ${OW(1.5)}/><ellipse cx="39.4" cy="58.4" rx="3.4" ry="1.5" fill="#5a5560" ${OW(1.5)}/>` +
    `<path d="M34 16.4 Q38.4 22 32.4 26 Q27 30 31.4 35" fill="none" stroke="${K}" stroke-width="9.4" stroke-linecap="round"/><path d="M34 16.4 Q38.4 22 32.4 26 Q27 30 31.4 35" fill="none" stroke="#f4f2ea" stroke-width="6.2" stroke-linecap="round"/>` +
    `<ellipse cx="32" cy="41" rx="14.4" ry="11.6" fill="#f4f2ea" ${O}/>` +
    `<path d="M41 33 Q47.6 41 42 49.4 Q37 52.6 30 52 Q40 49 41 33Z" fill="#cfd6dc"/>` +
    `<path d="M26 35 q2 2 4 0 M33 37.4 q2 2 4 0 M25 40 q2 2 4 0" fill="none" stroke="#b9c4d0" stroke-width="1.1" stroke-linecap="round"/>` +
    // nid d'or et oeufs
    `<ellipse cx="32" cy="43.6" rx="10.8" ry="3.2" fill="#7a5220" ${O}/>` +
    `<ellipse cx="28.2" cy="41.6" rx="3.3" ry="3.9" fill="#ffd966" ${OW(1.5)}/><ellipse cx="35.8" cy="41.8" rx="3.1" ry="3.7" fill="#fff6dc" ${OW(1.5)}/><circle cx="27" cy="40" r=".9" fill="#fff1a8"/>` +
    `<path d="M21.2 43.6 Q22 52.4 32 52.8 Q42 52.4 42.8 43.6 Q32 47.6 21.2 43.6Z" fill="#b7863a" ${O}/>` +
    `<path d="M24 46.4 L30 49.4 M40 46.4 L34 49.4 M27 50.8 L37 50.2" fill="none" stroke="#7a5220" stroke-width="1.2" stroke-linecap="round"/>` +
    // ailes repliees qui bercent le nid
    `<path d="M23 33.6 Q10.6 36 10.6 46 Q11 53 19.6 56.4 Q22.4 51 23.2 45Z" fill="#f4f2ea" ${O}/>` +
    `<path d="M41 33.6 Q53.4 36 53.4 46 Q53 53 44.4 56.4 Q41.6 51 40.8 45Z" fill="#e6e9ec" ${O}/>` +
    `<path d="M11 48 Q11.8 53.4 19.6 56.4 Q15.4 53.6 14.6 49.6Z M53 48 Q52.2 53.4 44.4 56.4 Q48.6 53.6 49.4 49.6Z" fill="#3a3744"/>` +
    `<path d="M14.4 40.4 Q16 47 20 52 M18.4 37.4 Q19.4 43.4 21.4 47.4 M49.6 40.4 Q48 47 44 52 M45.6 37.4 Q44.6 43.4 42.6 47.4" fill="none" stroke="#b9c4d0" stroke-width="1.1" stroke-linecap="round"/>` +
    // tete : calotte rouge, plumes d'argent, bec d'or, oeil clos
    `<path d="M38.6 9.2 Q47 5.6 52.4 11 Q45.6 10.6 40.4 13Z" fill="#b9c4d0" ${OW(1.4)}/><path d="M39 13 Q47.6 12.4 51 18 Q44.4 15.4 39.4 15.6Z" fill="#e8ecf0" ${OW(1.4)}/>` +
    `<path d="M27 8.4 L9.6 13 L27.4 16.2Z" fill="#f2c14e" ${OW(1.5)}/>` +
    `<ellipse cx="33.4" cy="11.6" rx="8" ry="7" fill="#f4f2ea" ${O}/>` +
    `<path d="M26.6 8.6 Q32 1.6 40.4 8.2 Q34 6.4 26.6 8.6Z" fill="#d7382c" ${OW(1.5)}/><ellipse cx="33.6" cy="6.6" rx="4.4" ry="2.4" fill="#d7382c"/>` +
    `<path d="M28.6 11.4 Q30.8 13.8 33 11.4" fill="none" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="30.4" cy="15" rx="2" ry="1.1" fill="#f4a39a" opacity=".7"/>`
  ),
};

// ---------------------------------------------------------------- Fengmeng
const FM_HAIR = '#1a1d24', FM_HAIR_L = '#4a6a88';
const FM_SKIN = '#f3d3bc', FM_SKIN_D = '#dfb194';

export const FENGMENG_SPRITES = {
  // Rencontre 1 : le disciple agressif, tenue d'entrainement bleu-vert, arc de bois, sourire en coin.
  fengmeng_1: svg(
    `<path d="M16.5 12 Q5 36 16.5 58" fill="none" stroke="${K}" stroke-width="5.4" stroke-linecap="round"/><path d="M16.5 12 Q5 36 16.5 58" fill="none" stroke="#b87a45" stroke-width="2.6" stroke-linecap="round"/><path d="M16.5 12 L16.5 58" stroke="#efe6d0" stroke-width=".9"/>` +
    `<path d="M10 22 Q8.6 28 9.4 33" fill="none" stroke="#e0b078" stroke-width="1" stroke-linecap="round"/><circle cx="16.5" cy="12.4" r="1.8" fill="#7fe6d6" ${OW(1.2)}/><circle cx="16.5" cy="57.6" r="1.8" fill="#7fe6d6" ${OW(1.2)}/>` +
    `<path d="M40 11 Q58 14 54 38 Q50 28 42 23Z" fill="${FM_HAIR}" ${O}/><path d="M45 15 Q52 18 52 28" fill="none" stroke="${FM_HAIR_L}" stroke-width="1.2" stroke-linecap="round"/><path d="M43 18 Q47 22 48 28" fill="none" stroke="#4fd1c5" stroke-width="2" stroke-linecap="round"/>` +
    feet('#17232a', 57.4, 4.8) +
    `<path d="M21 56.6 Q19.6 44 23.6 35 L40.4 35 Q44.4 44 43 56.6 Q32 59 21 56.6Z" fill="#2f9a9a" ${O}/>` +
    `<path d="M38 37.4 Q43 45 42 55.6 L37.6 56.2 Q40.4 46 38 37.4Z" fill="#1f7676"/>` +
    `<path d="M22 49 Q32 53 42 49 L42.4 56.4 Q32 58.8 21.6 56.4Z" fill="#17232a" ${OW(1.6)}/><path d="M26 51.6 L26.6 57.4 M38 51.6 L37.4 57.4" stroke="#2f9a9a" stroke-width=".9" opacity=".7"/>` +
    `<path d="M24 35.4 L32.6 47.4 L40 35.4 L37.4 35 L32.6 42.2 L27 35Z" fill="#bfeee8" ${O}/>` +
    `<rect x="22" y="45" width="20" height="4" rx="1.6" fill="#17232a" ${O}/><circle cx="32" cy="47" r="2.6" fill="#7fe6d6" ${OW(1.4)}/><path d="M31 46.2 Q32 45.4 33 46.2" fill="none" stroke="#fff" stroke-width=".8"/>` +
    arm('M22.6 38.6 L13.2 37.4', 5.6, '#2f9a9a') + `<path d="M19 33.8 L18.2 41.4" stroke="#17232a" stroke-width="3.4" stroke-linecap="round"/>` + hand(11.4, 37.2, '#17232a') +
    arm('M41 38 Q50 40 44 47', 5.4, '#1f7676') + `<path d="M42.4 43.6 L47.6 43.6" stroke="#17232a" stroke-width="3.2" stroke-linecap="round"/>` + hand(43.6, 47.6, '#17232a') +
    head(FM_SKIN, FM_SKIN_D, 25, 12.6, 11.2) +
    `<circle cx="32" cy="8.4" r="4.4" fill="${FM_HAIR}" ${O}/><rect x="29" y="11.2" width="6" height="2.8" rx="1" fill="#7fe6d6" ${OW(1.4)}/><path d="M26 8.6 L38 8.6" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M26 8.6 L38 8.6" stroke="#cfeee9" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M19.4 25 Q18 11 32 10.6 Q46 11 44.6 25 Q42 18.5 35 18 Q30 21.6 26 20 Q22 22 19.4 25Z" fill="${FM_HAIR}" ${O}/>` +
    `<path d="M19.2 24.6 Q16.8 31 20.6 38 Q21.4 31 22.4 26Z" fill="${FM_HAIR}" ${OW(1.6)}/><path d="M44.8 24.6 Q47.2 31 43.4 38 Q42.6 31 41.6 26Z" fill="${FM_HAIR}" ${OW(1.6)}/>` +
    `<path d="M23 14.6 Q26.4 12.4 30.4 12.4" fill="none" stroke="${FM_HAIR_L}" stroke-width="1.3" stroke-linecap="round"/>` +
    sharpEyes(26.4, '#2a7f86', 1) +
    `<path d="M23.4 22.4 L30 24 M40.6 21.6 L34 23.8" stroke="${K}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M29 32 Q33 33.6 37.2 30.6" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/><path d="M37.2 30.6 L38 29.6" stroke="${K}" stroke-width="1.1" stroke-linecap="round"/>` +
    cheeks(30.2, 8.4, '#ff9a9a')
  ),

  // Rencontre 2 : l'embuscade, cape sombre a capuchon, arc noir bande, carquois garni, posture d'affut.
  fengmeng_2: svg(
    `` +
    `<rect x="46" y="16" width="6.6" height="24" rx="2.2" fill="#3a2a2a" ${O} transform="rotate(16 49.3 28)"/>` +
    `<path d="M47 17 L46.2 9 M49.6 16.4 L50.4 8 M52.2 17.6 L54.6 10.6" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M47 17 L46.2 9 M49.6 16.4 L50.4 8 M52.2 17.6 L54.6 10.6" fill="none" stroke="#dfe9ee" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M46.2 9 L44.6 5.4 L48 7.6Z M50.4 8 L49.6 4 L52.4 6.6Z M54.6 10.6 L54 6.6 L57 9Z" fill="#4fd1c5" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M14.4 18 Q2.6 38 14.4 58" fill="none" stroke="${K}" stroke-width="5.2" stroke-linecap="round"/><path d="M14.4 18 Q2.6 38 14.4 58" fill="none" stroke="#2c3350" stroke-width="2.6" stroke-linecap="round"/><path d="M7.6 26 Q5.8 34 7.4 42" fill="none" stroke="#8f9fd0" stroke-width="1" stroke-linecap="round"/>` +
    `<ellipse cx="25" cy="57.4" rx="5" ry="2.6" fill="#10181f" ${O}/><ellipse cx="39" cy="57.4" rx="5" ry="2.6" fill="#10181f" ${O}/>` +
    `<path d="M13 58.4 Q8.6 42 19 34 L45 34 Q55 42 51 58.4 Q32 61.6 13 58.4Z" fill="#1a2734" ${O}/>` +
    `<path d="M26 38 L32 58.6 L22 58.4Z" fill="#2c898b"/><path d="M26 38 L32 58.6 M38 38 L33 58.6" fill="none" stroke="${K}" stroke-width="1.4"/><path d="M38 38 L33 58.6 L42 58.4Z" fill="#217979"/>` +
    `<path d="M17 52 Q15.6 44 20 38 M47 52 Q48.4 44 44 38" fill="none" stroke="#3d566e" stroke-width="1" stroke-linecap="round"/>` +
    `<rect x="26" y="45.6" width="12" height="3.2" rx="1.2" fill="#17232a" ${OW(1.6)}/><circle cx="32" cy="47.2" r="1.8" fill="#7fe6d6" ${OW(1.2)}/>` +
    `<path d="M14.4 18 L31 39.6 L14.4 58" fill="none" stroke="#e9f1f4" stroke-width="1" stroke-linejoin="round" opacity=".9"/>` +
    `<path d="M31 39.6 L6 39.6" fill="none" stroke="${K}" stroke-width="3.2" stroke-linecap="round"/><path d="M31 39.6 L6 39.6" fill="none" stroke="#c9d6e2" stroke-width="1.4" stroke-linecap="round"/><path d="M6.6 39.6 L2.6 39.6" stroke="${K}" stroke-width="0"/><path d="M4.2 39.6 L9 36.8 L9 42.4Z" fill="#9aa6b4" ${OW(1.4)}/>` +
    `<path d="M29 37 L34 35 M29 42 L34 44.4" stroke="#4fd1c5" stroke-width="2" stroke-linecap="round"/>` +
    arm('M42 41 Q40 46 33 41', 5.2, '#1b2a37') + hand(31.4, 39.8, '#10181f') +
    arm('M20 41 Q15 46 10 40', 5.2, '#26374a') + hand(9.4, 39.6, '#10181f') +
    `<path d="M14 28 Q12 8 32 5.6 Q52 8 50 28 Q48 36 42 37 L22 37 Q16 36 14 28Z" fill="#1c2a38" ${O}/>` +
    `<path d="M40 8.6 Q50 12 49 26 Q48 33 42 36 Q46 28 44.6 20 Q43.4 13 40 8.6Z" fill="#121c26"/>` +
    `<path d="M20 12 Q24 8 30 7.4" fill="none" stroke="#4d6a88" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M19.2 28 Q18.6 17 32 16.4 Q45.4 17 44.8 28 Q44 35 32 37.6 Q20 35 19.2 28Z" fill="${FM_SKIN}" ${O}/>` +
    `<path d="M19.2 28 Q18.6 17 32 16.4 Q45.4 17 44.8 28 L44.2 24.2 Q32 21.4 19.8 24.2Z" fill="#121f2a"/>` +
    `<path d="M39 30 Q43 29 44 28.4 Q44 35 32 37.6 Q38 35 39 30Z" fill="${FM_SKIN_D}"/>` +
    `<path d="M22.6 27 Q25.8 24 29.4 26.6 Q26 28.6 22.6 27Z M41.4 27 Q38.2 24 34.6 26.6 Q38 28.6 41.4 27Z" fill="#c9fbf4" stroke="${K}" stroke-width=".8"/>` +
    `<circle cx="27.4" cy="26.6" r="1.1" fill="#2a7f86"/><circle cx="36.6" cy="26.6" r="1.1" fill="#2a7f86"/>` +
    `<path d="M22.4 24.4 L30 25.4 M41.6 24.4 L34 25.4" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M29.4 32.4 Q32.4 33.4 35.4 31.6" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M16 28 Q14.6 35 18.6 38 L22 37.2 L20 33.4Z" fill="#26374a" ${OW(1.6)}/><path d="M48 28 Q49.4 35 45.4 38 L42 37.2 L44 33.4Z" fill="#121c26" ${OW(1.6)}/>`
  ),

  // Boss final, phase 1 : l'Archer Miroir. Motifs de Hou Yi en negatif (tunique sombre, rayons cyan, arc rouge sombre).
  fengmeng_3a: svg(
    `<defs>` +
    `</defs>` +
    `<circle cx="32" cy="33" r="31.5" fill="#3fc6d4" fill-opacity="0.2" class="glow"/>` +
    `<rect x="46" y="14" width="6.6" height="25" rx="2.2" fill="#3a2a2a" ${O} transform="rotate(14 49.3 26)"/><path d="M47.4 15 L46.4 7.6 M50 14.4 L50.6 6.4 M52.6 15.6 L55 9" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M47.4 15 L46.4 7.6 M50 14.4 L50.6 6.4 M52.6 15.6 L55 9" fill="none" stroke="#cfe3ea" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M46.4 7.6 L45 4 L48.2 6Z M50.6 6.4 L50 2.6 L52.6 5Z M55 9 L54.6 5 L57.4 7.6Z" fill="#a01f34" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M10.6 58.6 Q5.6 38 19 31 L45 31 Q58.4 38 53.4 58.6 Q32 62.6 10.6 58.6Z" fill="#13232c" ${O}/>` +
    `` +
    `<path d="M16.6 16 Q10.6 20.4 14 30 Q12.4 42 16.6 52 Q21 42 22 30Z" fill="${FM_HAIR}" ${O}/><path d="M47.4 16 Q53.4 20.4 50 30 Q51.6 42 47.4 52 Q43 42 42 30Z" fill="${FM_HAIR}" ${O}/>` +
    `<ellipse cx="25" cy="57.4" rx="5" ry="2.6" fill="#10181f" ${O}/><ellipse cx="39" cy="57.4" rx="5" ry="2.6" fill="#10181f" ${O}/><path d="M21 56.6 Q25 54.6 29 56.6 M35 56.6 Q39 54.6 43 56.6" fill="none" stroke="#cfe3ea" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M20.6 57.6 Q19.4 47.4 22.6 41 L41.4 41 Q44.6 47.4 43.4 57.6 Q32 60 20.6 57.6Z" fill="#17262f" ${O}/>` +
    `<path d="M21.4 46.4 L42.6 46.4 M21 51.6 L43 51.6 M26.6 41.6 L26.6 58.4 M32 41.6 L32 59 M37.4 41.6 L37.4 58.4" fill="none" stroke="#3fc6d4" stroke-width=".9" opacity=".65"/>` +
    `` +
    `<path d="M22.4 35.4 L41.6 35.4 Q45 40.4 42.4 46.4 L21.6 46.4 Q19 40.4 22.4 35.4Z" fill="#1d3340" ${O}/>` +
    `<path d="M26 35.8 L32 44.6 L38 35.8" fill="none" stroke="#cfe3ea" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="32" cy="41" r="3.8" fill="#0b1319" ${OW(1.4)}/><circle cx="32" cy="41" r="1.4" fill="#5fe0ee"/>` +
    `<path d="M32 35.4 L32 36.4 M32 45.6 L32 46.6 M26.4 41 L27.4 41 M36.6 41 L37.6 41 M28.2 37.2 L28.9 37.9 M35.8 37.2 L35.1 37.9 M28.2 44.8 L28.9 44.1 M35.8 44.8 L35.1 44.1" stroke="#5fe0ee" stroke-width="1" stroke-linecap="round"/>` +
    `<rect x="21" y="45.6" width="22" height="3.8" rx="1.4" fill="#0e171d" ${O}/><circle cx="32" cy="47.5" r="2.7" fill="#cfe3ea" ${OW(1.4)}/><path d="M30.8 46.6 Q32 45.6 33.2 46.6" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round"/>` +
    arm('M23 39.6 L13 39', 5.4, '#17262f') + `<path d="M16.4 36.4 L16.4 41.8" stroke="#cfe3ea" stroke-width="2.6" stroke-linecap="round"/>` +
    arm('M41 39.6 Q47 42 44.6 47', 5.4, '#0e171d') + `<path d="M43.4 43.4 L47.6 44.6" stroke="#cfe3ea" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M13.4 10 Q1.6 36 13.4 60" fill="none" stroke="${K}" stroke-width="6.4" stroke-linecap="round"/><path d="M13.4 10 Q1.6 36 13.4 60" fill="none" stroke="#7a1424" stroke-width="3.4" stroke-linecap="round"/><path d="M7.4 22 Q5.6 30 6.6 38" fill="none" stroke="#c4344a" stroke-width="1.1" stroke-linecap="round"/><path d="M13.4 10 L13.4 60" stroke="#dfe9ee" stroke-width=".9"/>` +
    `<circle cx="13.4" cy="10" r="2.2" fill="#cfe3ea" ${OW(1.2)}/><circle cx="13.4" cy="59" r="2.2" fill="#cfe3ea" ${OW(1.2)}/><rect x="5.2" y="34.6" width="3.8" height="6.6" rx="1.2" fill="#cfe3ea" ${OW(1.4)}/>` +
    hand(10.6, 39.2, '#0e171d') + hand(45.4, 47.6, '#0e171d') +
    `<ellipse cx="21.6" cy="36.8" rx="6.6" ry="4.4" fill="#1d3340" ${O}/><path d="M16.4 37.8 Q21.6 41.4 26.8 37.8" fill="none" stroke="#7fb0c0" stroke-width="1" stroke-linecap="round"/><path d="M18 34.8 Q21.6 33 25 34.6" fill="none" stroke="#5fe0ee" stroke-width=".9" stroke-linecap="round"/>` +
    `<ellipse cx="42.4" cy="36.8" rx="6.6" ry="4.4" fill="#0e171d" ${O}/><path d="M37.2 37.8 Q42.4 41.4 47.6 37.8" fill="none" stroke="#7fb0c0" stroke-width="1" stroke-linecap="round"/><path d="M39 34.8 Q42.4 33 46 34.6" fill="none" stroke="#5fe0ee" stroke-width=".9" stroke-linecap="round"/>` +
    head('#eed4c3', '#d8b49e', 25, 12.8, 11.4) +
    `<circle cx="32" cy="7.6" r="4.8" fill="${FM_HAIR}" ${O}/><path d="M26.8 12.6 L28.2 6.8 L32 9.6 L35.8 6.8 L37.2 12.6Z" fill="#cfe3ea" ${O}/><circle cx="32" cy="9.8" r="1.3" fill="#3fe0ee" stroke="${K}" stroke-width=".7"/><path d="M24 8.4 L40 8.4" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M24 8.4 L40 8.4" stroke="#cfe3ea" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M19 25.4 Q18 11.4 32 11 Q46 11.4 45 25.4 Q42 18 36 19.6 L32 24 L28 19.6 Q22 18 19 25.4Z" fill="${FM_HAIR}" ${O}/>` +
    `<path d="M23 15.4 Q26.4 12.8 30 12.6" fill="none" stroke="${FM_HAIR_L}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M19.2 25 Q17 32 20.4 40 Q21.4 32 22.6 27Z" fill="${FM_HAIR}" ${OW(1.6)}/><path d="M44.8 25 Q47 32 43.6 40 Q42.6 32 41.4 27Z" fill="${FM_HAIR}" ${OW(1.6)}/>` +
    sharpEyes(26.6, '#3fc6d4', 1, '#eaf6f8') +
    `<path d="M23 22.6 L30.4 24.6 M41 22.6 L33.6 24.6" stroke="${K}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M39 28.6 L41.4 32.4" stroke="#8e3a3a" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M29.4 32.8 Q32 31.8 34.6 32.8" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>`
  ),

  // Boss final, phase 2 : Rage et Desespoir. Haillons, cheveux defaits, aura rouge sang, yeux brillants, flechees multiples.
  fengmeng_3b: svg(
    `<defs>` +
    `</defs>` +
    `<path d="M32.0 7.0 L37.9 0.5 L41.2 8.6 L49.0 4.6 L49.4 13.3 L58.0 12.1 L55.4 20.5 L63.9 22.4 L58.6 29.3 L66.0 34.0 L58.6 38.7 L63.9 45.6 L55.4 47.5 L58.0 55.9 L49.4 54.7 L49.0 63.4 L41.2 59.4 L37.9 67.5 L32.0 61.0 L26.1 67.5 L22.8 59.4 L15.0 63.4 L14.6 54.7 L6.0 55.9 L8.6 47.5 L0.1 45.6 L5.4 38.7 L-2.0 34.0 L5.4 29.3 L0.1 22.4 L8.6 20.5 L6.0 12.1 L14.6 13.3 L15.0 4.6 L22.8 8.6 L26.1 0.5Z" fill="#9f8d94"/><circle cx="32" cy="34" r="32" fill="#ff3a30" fill-opacity="0.25" class="glow"/>` +
    `<rect x="46" y="14" width="7.4" height="25" rx="2.2" fill="#4a2a3a" ${O} transform="rotate(16 49.7 26)"/><path d="M47 15 L45.6 7 M50 14.4 L50.6 5.6 M53 15.8 L56 8.6" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M47 15 L45.6 7 M50 14.4 L50.6 5.6 M53 15.8 L56 8.6" fill="none" stroke="#e8d8d8" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M45.6 7 L44 3.2 L47.6 5.4Z M50.6 5.6 L50 1.6 L52.8 4.4Z M56 8.6 L55.6 4.6 L58.6 7.4Z" fill="#e0202c" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M9 58 L5 50 L9 47 L4.6 40 L13 33.6 L19 31 L45 31 L51 33.6 L59.4 40 L55 47 L59 50 L55 58 L50 55 L46 60 L41 56 L36 61 L32 56.6 L28 61 L23 56 L18 60 L14 55Z" fill="#2f1a26" ${O}/>` +
    `` +
    `<path d="M14 24 Q4 32 8 46 Q10 54 14 58 Q13 48 15 40 Q15 32 20 28Z" fill="#2e3046" ${O}/><path d="M50 24 Q60 32 56 46 Q54 54 50 58 Q51 48 49 40 Q49 32 44 28Z" fill="#2e3046" ${O}/>` +
    `<ellipse cx="24" cy="57.4" rx="5.2" ry="2.6" fill="#10181f" ${O}/><ellipse cx="40" cy="57.4" rx="5.2" ry="2.6" fill="#10181f" ${O}/>` +
    `<path d="M19.6 57.6 Q18.4 47.4 21.8 41 L42.2 41 Q45.6 47.4 44.4 57.6 L40 55 L36 59.4 L32 55.6 L28 59.4 L24 55 Z" fill="#3e2436" ${O}/>` +
    `<path d="M27 47 L30 51 L27.6 55 M37.6 46 L35 51 L38 55" fill="none" stroke="#a01f34" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M21.6 35.4 L42.4 35.4 L46 41.4 L43 46.4 L40 44 L37 47 L33 44.6 L30 47.4 L26 44 L22 46.6 L18.6 41.4Z" fill="#54304a" ${O}/>` +
    `<path d="M29 40 L33 43.6 L31 47 L36 46 L35 41 L38 38 L33 36Z" fill="#e8c0a8" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/><path d="M31 41 L34 42.4 M33 38.6 L35 40" stroke="#c46a5a" stroke-width=".9" stroke-linecap="round"/>` +
    `` +
    `<path d="M21 45.6 L43 45.6 L42.4 49.4 L38 48.4 L34 50.2 L30 48.4 L26 50.2 L22 49Z" fill="#1a1018" ${O}/><circle cx="32" cy="47.2" r="2.3" fill="#cfe3ea" ${OW(1.3)}/>` +
    arm('M23 40 L13 40.4', 5.8, '#54304a') + `<path d="M15.4 36.8 L16.6 43.4" stroke="#a01f34" stroke-width="2.6" stroke-linecap="round"/>` +
    arm('M41 39.6 Q47 44 33.4 41.6', 5.8, '#3e2436') + `<path d="M43 39.6 Q44.6 42 44 44" stroke="#a01f34" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M14.6 8 Q-.4 36 14.6 60" fill="none" stroke="${K}" stroke-width="6.6" stroke-linecap="round"/><path d="M14.6 8 Q-.4 36 14.6 60" fill="none" stroke="#7a1424" stroke-width="3.6" stroke-linecap="round"/><path d="M6.4 20 Q4.4 28 5.4 36" fill="none" stroke="#e0202c" stroke-width="1.1" stroke-linecap="round"/><path d="M14.6 8 L32.6 41.6 L14.6 60" fill="none" stroke="#f0e8e8" stroke-width=".9" stroke-linejoin="round"/>` +
    `<path d="M32 41.6 L2 31 M32 41.6 L1.4 40.4 M32 41.6 L2 50" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/><path d="M32 41.6 L2 31 M32 41.6 L1.4 40.4 M32 41.6 L2 50" fill="none" stroke="#e8d8d8" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M5.4 29.8 L0.6 30.4 L3.2 33.4Z M4.8 39 L0.4 40.6 L4.8 42.2Z M5.4 52.4 L0.6 50.4 L3.2 47.4Z" fill="#e0e6ee" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    hand(10.6, 40, '#1a1018') + hand(33.4, 41.8, '#1a1018') +
    `<ellipse cx="21" cy="36.6" rx="7.4" ry="5" fill="#54304a" ${O}/><path d="M15 37.8 L17 41 L19.6 38.6 L22 41.4 L24.4 38.4 L27 40.6" fill="none" stroke="#a01f34" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M16.6 34.8 Q21 32.4 25.6 34.4" fill="none" stroke="#cfe3ea" stroke-width="1.2" stroke-linecap="round"/>` +
    `<ellipse cx="43" cy="36.6" rx="7.4" ry="5" fill="#3e2436" ${O}/><path d="M37 38 L39.4 40.6 L41.6 38.6 L44 41.2 L46.2 38.4 L49 40.6" fill="none" stroke="#a01f34" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M38.4 34.8 Q43 32.4 47.4 34.4" fill="none" stroke="#cfe3ea" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M32 28 L12 22 L3.6 8 L16 13 L14 1.6 L25 9 L29 -.4 L35 7.4 L43 -.4 L45 9.6 L56 2.4 L52 14 L62 10 L55 23 Z" fill="#2e3046" ${O} transform="translate(0 2.4)"/>` +
    `<path d="M10 13 Q9 17 12 20 M54 12 Q56 17 52 20 M26 6 Q25 9 28 11 M40 6 Q42 9 38 12" fill="none" stroke="#e0202c" stroke-width="1.1" stroke-linecap="round"/>` +
    head('#eed4c3', '#d8b49e', 26.6, 13.4, 11.6) +
    `<path d="M18.6 27 Q16.6 16.4 24 12 L22 6 L28 11 L32 6.4 L36 11 L42 6 L40 12 Q47.4 16.4 45.4 27 Q42 20 36.4 21 L32 26 L27.6 21 Q22 20 18.6 27Z" fill="#2e3046" ${O}/>` +
    `<path d="M18.8 26 L14.4 38 L20.6 33 L21.6 41 L23.6 29Z M45.2 26 L49.6 38 L43.4 33 L42.4 41 L40.4 29Z" fill="#2e3046" ${OW(1.6)}/>` +
    `<path d="M22.2 28.6 Q25.8 24.4 29.6 27.6 Q26 30.4 22.2 28.6Z M41.8 28.6 Q38.2 24.4 34.4 27.6 Q38 30.4 41.8 28.6Z" fill="#ff5a5a" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<circle cx="26" cy="27.8" r="1.5" fill="#fff"/><circle cx="38" cy="27.8" r="1.5" fill="#fff"/><circle cx="26" cy="27.8" r=".7" fill="${K}"/><circle cx="38" cy="27.8" r=".7" fill="${K}"/>` +
    `<path d="M20.4 22.4 L30.6 26 M43.6 22.4 L33.4 26" stroke="${K}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M27.6 33.4 Q32 31.4 36.4 33.4 L35.4 37.4 Q32 39 28.6 37.4Z" fill="#6a0f1c" stroke="${K}" stroke-width="1.3" stroke-linejoin="round"/><path d="M28.6 33.4 L28.8 35 M30.6 32.6 L30.8 34.4 M33.4 32.6 L33.2 34.4 M35.4 33.4 L35.2 35" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M22.4 31.4 Q22.8 34 24 35.2 Q24.6 33.4 22.4 31.4Z" fill="#9fd4ff" stroke="${K}" stroke-width=".6"/>`
  ),
};
