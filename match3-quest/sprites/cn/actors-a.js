// Sprites SVG (fantasy chinoise, legende de Hou Yi) : heros, PNJ de la premiere moitie du monde, coffres.
// Meme facture que sprites/actors.js : chibi de face, contour #2b1b17 de 2 px, viewBox 64x64, pieds vers y = 58,
// sans ombre au sol. Les helpers ne servent qu'a factoriser ; chaque valeur exportee est une chaine SVG statique.

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const OT = O.replace('stroke-width="2"', 'stroke-width="1.5"');
const OB = O.replace('stroke-width="2"', 'stroke-width="1.6"');
// Le contour est porte par un <g> commun (heritage) : les formes sans trait recoivent stroke="none".
const svg = (body) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g ' + O + '>' +
  body.split(O).join('@S').split(OT).join('stroke-width="1.5"@S').split(OB).join('stroke-width="1.6"@S')
    .replace(/<(path|circle|ellipse|rect)\b[^>]*>/g, (m) => (/stroke|@S/.test(m) ? m : m.replace(/\s*\/?>$/, ' stroke="none"/>')))
    .replace(/@S/g, '') + '</g></svg>';

const GOLD = '#f2c14e', GOLD_D = '#c9922a', RED = '#c0392b', RED_D = '#8e2a22', HAIR = '#1d1a24';
const SKIN = '#f5cba7', SKIN_D = '#e0a582';

const eyes = (y = 25, dx = 5.2) =>
  `<circle cx="${32 - dx}" cy="${y}" r="1.6" fill="${K}"/><circle cx="${32 + dx}" cy="${y}" r="1.6" fill="${K}"/>` +
  `<circle cx="${32 - dx + 0.6}" cy="${y - 0.6}" r="0.6" fill="#fff"/><circle cx="${32 + dx + 0.6}" cy="${y - 0.6}" r="0.6" fill="#fff"/>`;
// Yeux rieurs (arcs)
const happyEyes = (y = 26, dx = 5.2) =>
  `<path d="M${32 - dx - 1.8} ${y + 0.6} Q${32 - dx} ${y - 1.8} ${32 - dx + 1.8} ${y + 0.6} M${32 + dx - 1.8} ${y + 0.6} Q${32 + dx} ${y - 1.8} ${32 + dx + 1.8} ${y + 0.6}" fill="none" stroke="${K}" stroke-width="1.4" stroke-linecap="round"/>`;
const cheeks = (y = 29.5, dx = 8.5) =>
  `<ellipse cx="${32 - dx}" cy="${y}" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".45"/><ellipse cx="${32 + dx}" cy="${y}" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".45"/>`;
const smile = (y = 30, w = 2) => `<path d="M${32 - w} ${y} Q32 ${y + 2.4} ${32 + w} ${y}" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>`;
const grin = (y = 30) => `<path d="M28.6 ${y} Q32 ${y + 4.4} 35.4 ${y}Z" fill="#8e2a3a" stroke="${K}" stroke-width="1.1" stroke-linejoin="round"/>`;
const brows = (y, dx = 5.2, w = 1.2, col = K, tilt = 0) =>
  `<path d="M${32 - dx - 2.4} ${y - tilt} L${32 - dx + 2.2} ${y - 0.4 + tilt} M${32 + dx + 2.4} ${y - tilt} L${32 + dx - 2.2} ${y - 0.4 + tilt}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const head = (skin, shade, cy = 25, rx = 13.5, ry = 11.5) => {
  const p = (t) => `${(32 + rx * Math.cos(t)).toFixed(1)} ${(cy + ry * Math.sin(t)).toFixed(1)}`;
  const a = Math.PI / 6, b = (100 * Math.PI) / 180;
  return `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>` +
    `<path d="M${p(a)} A${rx} ${ry} 0 0 1 ${p(b)} Q${32 + rx * 0.45} ${cy + ry * 0.7} ${p(a)}Z" fill="${shade}"/>` +
    `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" ${O}/>` +
    `<ellipse cx="${32 - rx * 0.45}" cy="${cy - ry * 0.55}" rx="2.6" ry="1.3" fill="#fff" opacity=".4" transform="rotate(-25 ${32 - rx * 0.45} ${cy - ry * 0.55})"/>`;
};
const hand = (x, y, c = SKIN) => `<circle cx="${x}" cy="${y}" r="2.7" fill="${c}" ${O}/>`;
const feet = (c, y = 57, rx = 4.4) =>
  `<ellipse cx="26.5" cy="${y}" rx="${rx}" ry="2.6" fill="${c}" ${O}/><ellipse cx="37.5" cy="${y}" rx="${rx}" ry="2.6" fill="${c}" ${O}/>`;
// Manche : ellipse inclinee
const sleeve = (cx, cy, rx, ry, rot, fill) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${fill}" ${O}/>`;
// Nuage stylise (xiangyun), trait seul
const cloud = (x, y, s = 1, c = GOLD, w = 1.2) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 c-2.2 0-2.4-3 0-3.4 c.2-2.6 3.6-2.8 4.2-.6 c1.8-1.8 4.6-.2 3.8 2 c2 .2 2 2.4 0 2.4 c-1.4 1.2-2.6-.4-3.8 .4 c-1 .8-2.6-.4-4.2-.8z" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ---------- Hou Yi : meme visage pour les 4 styles ----------
const HOU_SKIN = '#f2c59e', HOU_SKIN_D = '#dca07a';
// Cheveux derriere la tete + chignon (a dessiner AVANT la tete)
const houBack = (knot = 9) =>
  `<ellipse cx="32" cy="22.5" rx="15.6" ry="13.6" fill="${HAIR}" ${O}/>` +
  `<ellipse cx="32" cy="${knot}" rx="4.8" ry="5.2" fill="${HAIR}" ${O}/><path d="M29.4 ${knot - 2} Q31 ${knot - 4.2} 33.6 ${knot - 3.4}" fill="none" stroke="#6a6f96" stroke-width="1.1" stroke-linecap="round"/>`;
// Tete + frange + sourcils + regard determine (a dessiner apres le corps)
const houFace = () =>
  head(HOU_SKIN, HOU_SKIN_D, 25, 13.5, 11.5) +
  `<path d="M18.4 24 Q17 13.6 32 12.8 Q47 13.6 45.6 24 Q43 19.4 38.4 19.8 Q35 19.2 32 21.6 Q29 19.2 25.6 19.8 Q21 19.4 18.4 24Z" fill="${HAIR}" ${O}/>` +
  `<path d="M22 16.4 Q26 14 30 14" fill="none" stroke="#6a6f96" stroke-width="1.2" stroke-linecap="round"/>` +
  `<path d="M18.6 24 Q18 28.6 20.2 31.6 L21.8 28 Q21 26 21.4 23Z M45.4 24 Q46 28.6 43.8 31.6 L42.2 28 Q43 26 42.6 23Z" fill="${HAIR}" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
  brows(23.6, 5.2, 2.2, K, 0.9) + eyes(26.8, 5.2) + cheeks(30, 8.2) +
  `<path d="M29.6 31.6 Q32 32.6 34.6 31" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>`;

export const HERO_SPRITES = {
  // Hou Yi l'Archer : tunique rouge et or, grand arc rouge, carquois dans le dos, bandeau rouge
  assassin: svg(
    // carquois derriere l'epaule
    `<g transform="rotate(24 47 28)"><path d="M45 15 l-1.6-6.4 2.4 2.4 1-5 1.2 5 2.4-2.4 -1 6.4z" fill="#f4ecd8" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<rect x="43.4" y="14" width="7" height="24" rx="2.4" fill="#7a2e22" ${O}/><rect x="43.4" y="19" width="7" height="2.6" fill="${GOLD}" stroke="${K}" stroke-width="1.2"/><rect x="43.4" y="30" width="7" height="2.6" fill="${GOLD}" stroke="${K}" stroke-width="1.2"/></g>` +
    feet('#3a2a24') +
    `<path d="M19.5 56.5 Q17.5 44 22.5 35 L41.5 35 Q46.5 44 44.5 56.5 Q32 59 19.5 56.5Z" fill="${RED}" ${O}/>` +
    `<path d="M39 37 Q44.5 45 43.4 55.6 L37.5 56.6 Q40.8 46 39 37Z" fill="#9a2a22"/>` +
    `<path d="M26.4 35 L32 44.4 L37.6 35Z" fill="#f4ecd8" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M24.6 35.6 L32.6 48 M39.4 35.6 L32.4 47" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
    `<path d="M20 53.6 Q32 57 44 53.6" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<rect x="21.6" y="46" width="20.8" height="4" rx="1.6" fill="#3a2a24" ${O}/><circle cx="32" cy="48" r="2.6" fill="${GOLD}" ${O}/>` +
    sleeve(44.6, 42.4, 3.8, 6.4, -12, '#9a2a22') + `<rect x="42.4" y="46.4" width="7.4" height="2.6" rx="1.2" fill="${GOLD}" transform="rotate(-12 46 47.7)" ${OT}/>` + hand(47.2, 51.4) +
    // arc rouge tenu a gauche
    `<path d="M19 5.2 Q3.4 31.4 19 57.8" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M19 5.2 Q3.4 31.4 19 57.8" fill="none" stroke="#d6402e" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M16.4 10 Q8.4 24 9.6 28" fill="none" stroke="#ff9a7a" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M19 5.2 L19 57.8" stroke="#f4ecd8" stroke-width="1"/>` +
    `<circle cx="19" cy="5.4" r="1.8" fill="${GOLD}" ${OT}/><circle cx="19" cy="57.6" r="1.8" fill="${GOLD}" ${OT}/>` +
    `<rect x="7.2" y="32.4" width="5.2" height="9.6" rx="1.8" fill="${GOLD}" ${OT}/>` +
    sleeve(17.4, 38.6, 6.4, 3.9, -8, RED) + `<rect x="10.8" y="34.8" width="2.8" height="7.6" rx="1.2" fill="${GOLD}" ${OT}/>` + hand(9.2, 37.6) +
    houBack(8) + houFace() +
    `<path d="M18.2 21.6 Q32 14.6 45.8 21.6" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M18.2 21.6 Q32 14.6 45.8 21.6" fill="none" stroke="${RED}" stroke-width="2.8" stroke-linecap="round"/>` +
    `<circle cx="32" cy="17.4" r="2.2" fill="${GOLD}" ${OT}/>` +
    `<rect x="29" y="12" width="6" height="2.8" rx="1" fill="${RED}" ${OT}/>`
  ),

  // Hou Yi le Maitre taoiste : robe bleu nuit a nuages dores, baton a talisman, orbe de qi
  sorcerer: svg(
    `` +
    // baton + talisman
    `<rect x="48.4" y="10" width="3.2" height="48" rx="1.6" fill="#7a3a22" ${O}/>` +
    `<circle cx="50" cy="8" r="3.8" fill="none" stroke="${K}" stroke-width="4.6"/><circle cx="50" cy="8" r="3.8" fill="none" stroke="${GOLD}" stroke-width="2.4"/>` +
    `<g transform="rotate(8 55 20)"><rect x="52.4" y="13" width="5.6" height="13" fill="#f7dc62" stroke="${K}" stroke-width="1.5" stroke-linejoin="round"/><path d="M54 15.4 h2.4 M54 18.4 h2.4 M54.4 21.4 h1.6 M55.2 15 v8" stroke="${RED}" stroke-width="1" stroke-linecap="round"/></g>` +
    feet('#1a2150') +
    `<path d="M19 56.6 Q16.6 44 22.4 35 L41.6 35 Q47.4 44 45 56.6 Q32 59.4 19 56.6Z" fill="#26397f" ${O}/>` +
    `<path d="M38.6 37 Q45 45 43.6 55.8 L37 56.8 Q41 46 38.6 37Z" fill="#17255a"/>` +
    cloud(21.4, 55.6, 0.95) + cloud(34.4, 55.8, 0.95) +
    `<path d="M25.4 35 L32 45 L38.6 35Z" fill="#eef1fb" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M24 35.6 L32.6 49 M40 35.6 L31.6 48" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
    `<rect x="22.4" y="44.6" width="19.2" height="3.6" rx="1.4" fill="${GOLD}" ${O}/><path d="M32 48 L30.6 53 M32 48 L33.6 53" stroke="${GOLD_D}" stroke-width="1.6" stroke-linecap="round"/>` +
    // manche gauche + orbe de qi
    sleeve(18.4, 44, 4.8, 7.4, 14, '#2f46a0') + `<path d="M14.4 49.4 Q18 52.4 22.4 50" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>` +
    hand(16.6, 52.4) +
    `<circle class="glow" cx="13" cy="39" r="8.4" fill="#8be8ff" opacity=".28"/>` +
    `<circle cx="13" cy="42" r="5.2" fill="#6fe0f4" ${O}/><circle cx="11.2" cy="40.2" r="1.3" fill="#fff"/>` +
    `<path d="M5.4 41 Q6 33 14 32.4" fill="none" stroke="#8be8ff" stroke-width="1.4" stroke-linecap="round"/>` +
    // manche droite sur le baton
    sleeve(44.8, 43, 4.8, 7, -14, '#17255a') + `<path d="M41.6 48.4 Q46 51.4 50 48" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>` + hand(49.6, 47.6) +
    houBack(8.4) + houFace() +
    // coiffe taoiste doree + epingle
    `<path d="M28.2 13.8 L28.8 8.4 Q32 6.4 35.2 8.4 L35.8 13.8 Q32 15.2 28.2 13.8Z" fill="${GOLD}" ${O}/>` +
    `<path d="M22.4 10.6 L41.6 10.6" stroke="${K}" stroke-width="4.2" stroke-linecap="round"/><path d="M22.4 10.6 L41.6 10.6" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="21.6" cy="10.6" r="1.7" fill="${RED}" ${OT}/><circle cx="42.4" cy="10.6" r="1.7" fill="${RED}" ${OT}/>`
  ),

  // Hou Yi le Garde imperial : armure lamellaire laquee, bouclier rond, lance
  templar: svg(
        // lance
    `<rect x="49" y="12" width="3" height="46" rx="1.4" fill="#7a3a22" ${O}/>` +
    `<path d="M50.5 1.4 Q54.6 6.4 53.4 12.6 L50.5 14.4 L47.6 12.6 Q46.4 6.4 50.5 1.4Z" fill="#e4ebf2" ${O}/><path d="M50.5 3.4 L50.5 12" stroke="#fff" stroke-width=".9"/>` +
    `<path d="M50.5 14.4 L46 24 M50.5 14.4 L55 24 M50.5 14.4 L50.5 25" stroke="${K}" stroke-width="4.2" stroke-linecap="round"/><path d="M50.5 14.4 L46 24 M50.5 14.4 L55 24 M50.5 14.4 L50.5 25" stroke="${RED}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<ellipse cx="26.5" cy="57" rx="4.6" ry="2.6" fill="#2a2430" ${O}/><ellipse cx="37.5" cy="57" rx="4.6" ry="2.6" fill="#2a2430" ${O}/>` +
    // jupe de plates
    `<path d="M20.6 47 L43.4 47 L44.4 57 L38.4 57.6 L38 52 L32 53 L26 52 L25.6 57.6 L19.6 57Z" fill="#26335e" ${O}/>` +
    `<path d="M26 52 L32 53 L38 52 M32 47 L32 53" stroke="${GOLD}" stroke-width="1.2" fill="none"/>` +
    // cuirasse
    `<path d="M21.4 48.4 Q20.4 41 23 35 L41 35 Q43.6 41 42.6 48.4 Q32 50.6 21.4 48.4Z" fill="#8e2a22" ${O}/>` +
    `<path d="M21.4 48.4 Q20.4 41 23 35 L41 35 Q43.6 41 42.6 48.4 Q32 50.6 21.4 48.4Z" fill="#9a2e24" stroke="none"/>` +
    `<path d="M22 40 L42 40 M23 44.4 L41 44.4" fill="none" stroke="${GOLD}" stroke-width="1"/>` +
    `<path d="M38.4 36 Q43 41 41.6 48 L36 49.4Z" fill="#73211b"/>` +
    `<path d="M26 35 Q32 41.4 38 35" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>` +
    `<rect x="21.4" y="44.6" width="21.2" height="4" rx="1.4" fill="#2a2430" ${O}/><circle cx="32" cy="46.6" r="2.8" fill="${GOLD}" ${O}/>` +
    // epaulieres + bras
    `<ellipse cx="42.8" cy="37.6" rx="5" ry="4.2" fill="#2a2d4e" ${O}/><path d="M38.6 38 Q42.8 41.6 47 38" fill="none" stroke="${GOLD}" stroke-width="1.4"/>` +
    sleeve(44.4, 44, 3.6, 5.4, -10, '#8e2a22') + `<rect x="42" y="45.6" width="7.6" height="2.6" rx="1.2" fill="${GOLD}" transform="rotate(-10 45.8 46.9)" ${OT}/>` + hand(48.4, 50.6, '#2a2d4e') +
    // bouclier rond + epauliere gauche
    `<ellipse cx="21.2" cy="37.6" rx="5" ry="4.2" fill="#2a2d4e" ${O}/><path d="M17 38 Q21.2 41.6 25.4 38" fill="none" stroke="${GOLD}" stroke-width="1.4"/>` +
    `<circle cx="14" cy="47.6" r="10.6" fill="#c0392b" ${O}/>` +
    `<path d="M21.4 40 Q24.6 47 19 56 Q22.6 47.4 21.4 40Z" fill="#982d24"/>` +
    `<circle cx="14" cy="47.6" r="8.2" fill="none" stroke="${GOLD}" stroke-width="1.8"/>` +
    `<circle cx="14" cy="47.6" r="3.6" fill="${GOLD}" ${O}/><circle cx="12.8" cy="46.4" r="1.1" fill="#fff6c8"/>` +
    `<circle cx="14" cy="41" r="1.1" fill="${GOLD}"/><circle cx="14" cy="54.2" r="1.1" fill="${GOLD}"/><circle cx="7.4" cy="47.6" r="1.1" fill="${GOLD}"/><circle cx="20.6" cy="47.6" r="1.1" fill="${GOLD}"/>` +
    `<path d="M7 42.4 Q9.4 39 13.4 38.2" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>` +
    hand(24.6, 44.6, '#2a2d4e') +
    houBack(6.6) + houFace() +
    // casque laque : cheveux et chignon visibles
    `<path d="M18 22.6 Q16.6 8.4 32 8 Q47.4 8.4 46 22.6 Q40 17.6 32 17.6 Q24 17.6 18 22.6Z" fill="#a63a2c" ${O}/>` +
    `<path d="M39.6 9.6 Q46 12.6 45.8 22 Q42.8 19 38.6 18Z" fill="#8e2a22"/>` +
    `<path d="M18.6 21.6 Q32 14.6 45.4 21.6" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M22 12.6 Q25 10.4 28.4 10" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>` +
    `<path d="M29 8.6 L29.6 4.2 Q32 2.4 34.4 4.2 L35 8.6Z" fill="${GOLD}" ${O}/>`
  ),

  // Hou Yi le Guerrier des steppes : fourrures, torse tatoue, grande hache
  barbarian: svg(
    `` +
    // hache
    `<rect x="50" y="16" width="3.2" height="43" rx="1.4" fill="#7a4a26" ${O}/>` +
    `<path d="M51.6 6 Q63 9 62 20 Q61.4 30 51.6 33 Q56 20 51.6 6Z" fill="#b3bcc7" ${O}/>` +
    `<path d="M54.4 10.4 Q58.4 13 58.6 18" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M51.6 33 L51.6 40 M51.6 36 L47 42" stroke="${K}" stroke-width="4" stroke-linecap="round"/><path d="M51.6 33 L51.6 40 M51.6 36 L47 42" stroke="${RED}" stroke-width="2" stroke-linecap="round"/>` +
    // bottes de fourrure
    `<ellipse cx="26.4" cy="56.4" rx="5.4" ry="3.2" fill="#e6dcc6" ${O}/><ellipse cx="37.6" cy="56.4" rx="5.4" ry="3.2" fill="#e6dcc6" ${O}/>` +
    // pantalon de cuir
    `<rect x="21.6" y="47.6" width="20.8" height="8" rx="3" fill="#6b4a2e" ${O}/>` +
    `<path d="M21.6 52.8 l2.4 3.4 2.4-3.4 2.4 3.4 2.4-3.4 2.4 3.4 2.4-3.4 2.4 3.4 2.4-3.4" fill="#e6dcc6" stroke="${K}" stroke-width="1.6" stroke-linejoin="round"/>` +
    // torse nu tatoue
    `<path d="M18.4 47 Q17 37 22 34.4 L42 34.4 Q47 37 45.6 47 Q32 51.4 18.4 47Z" fill="#e0a070" ${O}/>` +
    `<path d="M39 38 Q45 41 44.6 47 Q42 49 38 49.4Z" fill="#c4834f"/>` +
    `<path d="M32 38.6 L32 46 M24.6 41.6 q3.6-2.8 6 0 q-1 3.4-3.6 3 M39.4 41.6 q-3.6-2.8-6 0 q1 3.4 3.6 3" fill="none" stroke="#26357a" stroke-width="1.7" stroke-linecap="round"/>` +
    `<rect x="21.8" y="46.2" width="20.4" height="4" rx="1.6" fill="#4a2e1a" ${O}/><circle cx="32" cy="48.2" r="2.4" fill="${GOLD}" ${O}/>` +
    // bras tatoues et brassards
    `<ellipse cx="17" cy="41.5" rx="4.6" ry="6.6" transform="rotate(10 17 41.5)" fill="#e0a070" ${O}/><path d="M13.6 38.4 q3 1.6 6 -.2 M13.6 41.4 q3 1.6 6 -.2" stroke="#2a3a7a" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="13.4" y="44.4" width="7.4" height="3.8" rx="1.4" fill="#e6dcc6" ${O}/>` + hand(16, 51.4, '#e0a070') +
    `<ellipse cx="47" cy="41.5" rx="4.6" ry="6.6" transform="rotate(-10 47 41.5)" fill="#c4834f" ${O}/><path d="M43.4 38.4 q3 1.6 6 -.2 M43.4 41.4 q3 1.6 6 -.2" stroke="#2a3a7a" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="43.4" y="44.4" width="7.4" height="3.8" rx="1.4" fill="#e6dcc6" ${O}/>` + hand(51.6, 50.4, '#c4834f') +
    // cape de fourrure (epaules)
    `<path d="M17.6 38 Q19 33.4 26 33.4 L38 33.4 Q45 33.4 46.4 38 L44.4 39.6 L41.6 37.6 L38.6 40 L35.6 38 L32 40.4 L28.4 38 L25.4 40 L22.4 37.6 L19.6 39.6Z" fill="#e6dcc6" ${O}/>` +
    `<path d="M38 36 L35.6 38 L38.6 40 L41.6 37.6 L44.4 39.6 L46.4 38 Q45.6 35.6 42 34.6Z" fill="#c4b79a"/>` +
    // tete : chignon, natte, bandeau de fourrure, peinture de guerre
    `<path d="M19 26 Q10.6 34 13.6 46 Q16.6 44 17 38 Q19 33 21 30Z" fill="${HAIR}" ${O}/><path d="M13.8 41 l3.2 1.2 M14.8 45.4 l2.6-.4" stroke="${RED}" stroke-width="1.6" stroke-linecap="round"/>` +
    houBack(8) + houFace() +
    `<path d="M24 28.4 L29 31.4 M40 28.4 L35 31.4" stroke="#c0392b" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M18 22 Q18.4 16 32 16.2 Q45.6 16 46 22 L44.4 24 L41.6 21.6 L38.6 24 L35.6 21.6 L32 24 L28.4 21.6 L25.4 24 L22.4 21.6 L19.6 24Z" fill="#e6dcc6" ${O}/>` +
    `<path d="M22 17.6 Q26 16.4 30 16.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`
  ),
};

// ---------- Pourparlers : petits outils des PNJ des soleils 2, 3 et 5 ----------
// Trait epais a contour (algue, bras minuscule, baguette) : dessous sombre + dessus colore.
const cord = (d, w, fill) =>
  `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const pearl = (x, y, r = 1.7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#eaf8fb" stroke="${K}" stroke-width="1"/>`;
// Eclair en zigzag (mèche de Rongrong), pointe vers le bas.
const bolt = (x, y, s = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 L5 0 L3 4.2 L6 4.2 L-0.8 11.4 L1.2 6 L-1.6 6Z" fill="#ffe35c" stroke="${K}" stroke-width="${(1.5 / s).toFixed(2)}" stroke-linejoin="round"/>`;
// Yeux alignes sur la grille de pixellisation (pixels de 2 unites) : rectangles de 2 x h unites aux colonnes impaires.
const pxEyes = (y, h = 4, x1 = 27, x2 = 37, w = 2) =>
  `<rect x="${x1 - w / 2}" y="${y}" width="${w}" height="${h}" rx=".5" fill="${K}"/><rect x="${x2 - w / 2}" y="${y}" width="${w}" height="${h}" rx=".5" fill="${K}"/>`;
const spark = (x, y, c = '#ffd870') => `<path d="M${x} ${y - 3} L${x + 1} ${y - 1} L${x + 3} ${y} L${x + 1} ${y + 1} L${x} ${y + 3} L${x - 1} ${y + 1} L${x - 3} ${y} L${x - 1} ${y - 1}Z" fill="${c}"/>`;

export const NPC_SPRITES_A = {
  // Chang'e : robe claire a haute ceinture jade, epingles a cheveux, plateau de gateaux de lune
  change: svg(
    `<path d="M17 23 Q12.6 33 16.4 46 L24 40 L40 40 L47.6 46 Q51.4 33 47 23Z" fill="${HAIR}" ${O}/>` +
    feet('#e8a0b8') +
    `<path d="M16.6 57.6 Q14.6 46 22.6 35 L41.4 35 Q49.4 46 47.4 57.6 Q32 60.6 16.6 57.6Z" fill="#f6f1e8" ${O}/>` +
    `<path d="M39 38 Q47 46 45.6 56.6 L38 58 Q42.6 46 39 38Z" fill="#d4cde6"/>` +
    `<path d="M17.4 55.4 Q32 59 46.6 55.4" fill="none" stroke="#9fd3c7" stroke-width="2" stroke-linecap="round"/>` +
    cloud(22, 53.4, 0.9, '#c9a8e8', 1) + cloud(36, 54.6, 0.9, '#c9a8e8', 1) +
    `<path d="M26 35 L32 42 L38 35Z" fill="#f6f1e8" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M24 35.6 L32 43.6 L40 35.6" fill="none" stroke="#c9a8e8" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M22 41.6 Q32 44.6 42 41.6 L42 45 Q32 48 22 45Z" fill="#6fc3b0" ${O}/>` +
    `<path d="M33 45 Q36 52 33.6 58 M30 45 Q27 52 29.4 58" fill="none" stroke="${K}" stroke-width="3.8" stroke-linecap="round"/><path d="M33 45 Q36 52 33.6 58 M30 45 Q27 52 29.4 58" fill="none" stroke="#8fe0cb" stroke-width="1.8" stroke-linecap="round"/>` +
    // plateau de gateaux de lune
    `<ellipse cx="32" cy="50.6" rx="15.4" ry="3.6" fill="${RED}" ${O}/><ellipse cx="32" cy="49.8" rx="12" ry="2.1" fill="${GOLD}"/>` +
    `<circle cx="26.4" cy="46" r="4" fill="#c8863e" ${O}/><circle cx="26.4" cy="46" r="2.1" fill="none" stroke="#f0c070" stroke-width="1"/>` +
    `<circle cx="37.6" cy="46" r="4" fill="#c8863e" ${O}/><circle cx="37.6" cy="46" r="2.1" fill="none" stroke="#f0c070" stroke-width="1"/>` +
    `<circle cx="32" cy="42.6" r="4.2" fill="#d89a4a" ${O}/><circle cx="32" cy="42.6" r="2.3" fill="none" stroke="#f6d08a" stroke-width="1"/><circle cx="30.6" cy="41.2" r="1" fill="#fff6d8"/>` +
    sleeve(19.4, 44.4, 4, 6.6, 8, '#d8d0f2') + `<path d="M15.6 49.4 Q19 52 22.6 50" fill="none" stroke="#b49be0" stroke-width="1.5" stroke-linecap="round"/>` + hand(18.6, 51.4) +
    sleeve(44.6, 44.4, 4, 6.6, -8, '#bdb0e4') + `<path d="M41.4 50 Q45 52 48.4 49.4" fill="none" stroke="#9a86d4" stroke-width="1.5" stroke-linecap="round"/>` + hand(45.4, 51.4) +
    // tete
    `<ellipse cx="32" cy="9.4" rx="6.4" ry="4.8" fill="${HAIR}" ${O}/><ellipse cx="29" cy="8" rx="2.2" ry="1" fill="#6a6f96" opacity=".8"/>` +
    head(SKIN, SKIN_D, 25, 13.2, 11.4) +
    `<path d="M18.8 25.4 Q17.2 14.6 32 13.2 Q46.8 14.6 45.2 25.4 Q44.4 21 41 19.6 Q36 18.4 32 20 Q28 18.4 23 19.6 Q19.6 21 18.8 25.4Z" fill="${HAIR}" ${O}/>` +
    `<path d="M19 25 Q18 32 20.6 36.6 L22.4 31 Q21.6 28 22 24Z M45 25 Q46 32 43.4 36.6 L41.6 31 Q42.4 28 42 24Z" fill="${HAIR}" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M22.4 15.6 Q26 13.4 30 13.2" fill="none" stroke="#6a6f96" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M23.4 7.6 L41 10.4" stroke="${K}" stroke-width="4" stroke-linecap="round"/><path d="M23.4 7.6 L41 10.4" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="22.4" cy="7.4" r="1.9" fill="#f8a8c8" ${OT}/>` +
    `` +
    `<circle cx="37" cy="8" r="2" fill="#f8a8c8" ${OT}/><circle cx="34.4" cy="6.6" r="1.8" fill="#ff7ea6" ${OT}/>` +
    eyes(27, 5.2) + `<path d="M24.4 24.6 Q27 23 29.6 24.6 M39.6 24.6 Q37 23 34.4 24.6" fill="none" stroke="${K}" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M22.8 26 L24 27 M41.2 26 L40 27" stroke="${K}" stroke-width="1" stroke-linecap="round"/>` +
    cheeks(30.6, 8.2) + `<path d="M30 31.6 Q32 33.8 34 31.6" fill="#e0607a" stroke="${K}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`
  ),

  // Doyen Wen : vieillard a barbe blanche, robe de mandarin bordeaux, bonnet a ailes, canne
  elder_wen: svg(
    `<rect x="47.6" y="32" width="3.2" height="26" rx="1.4" fill="#7a3a22" ${O}/>` +
    `<circle cx="49.2" cy="31" r="3.2" fill="${GOLD}" ${O}/>` +
    feet('#2a2430') +
    `<path d="M17.6 57.6 Q15 45 22.4 35 L41.6 35 Q49 45 46.4 57.6 Q32 60.4 17.6 57.6Z" fill="#8e2a3a" ${O}/>` +
    `<path d="M39 38 Q47 46 45.4 56.6 L38 58 Q42 46 39 38Z" fill="#661d2b"/>` +
    `<path d="M18.4 55.6 Q32 59.2 45.6 55.6" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M24 37 L32 44 L40 37" fill="none" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<rect x="22" y="47.4" width="20" height="4" rx="1.6" fill="#3e8e68" ${O}/><rect x="29" y="46.6" width="6" height="5.6" rx="1.2" fill="${GOLD}" ${O}/>` +
    sleeve(19.4, 44, 4.8, 7.2, 14, '#8e2a3a') + `<circle cx="18.6" cy="43" r="1.5" fill="${GOLD}"/><circle cx="21" cy="47.6" r="1.3" fill="${GOLD}"/>` + `<path d="M14.6 49.6 Q18.6 52.6 23 50" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>` + hand(18.4, 53.6) +
    sleeve(45.2, 43, 4.8, 7, -14, '#661d2b') + `<circle cx="45.8" cy="42" r="1.5" fill="${GOLD}"/>` + `<path d="M41.4 48.6 Q46 51.6 50 48.8" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>` + hand(49.4, 47.2) +
    head('#f2c9a6', '#dca482', 26, 13.4, 11) +
    `<path d="M20 29.4 Q18.4 42.4 32 49.4 Q45.6 42.4 44 29.4 Q39 36.4 32 35.4 Q25 36.4 20 29.4Z" fill="#f6f3ec" ${O}/>` +
    `<path d="M38.6 38 Q42.6 42.6 36.8 47.6 Q41.6 44.4 44 29.4 Q43 36 38.6 38Z" fill="#d6d2c8"/>` +
    `<path d="M24 36.6 Q26 41.6 29 44.4 M40 36.6 Q38 41.6 35 44.4" stroke="#cfcbc2" stroke-width="1" fill="none" stroke-linecap="round"/>` +
    `<path d="M24.6 33 Q28.4 29.6 32 32 Q35.6 29.6 39.4 33 Q36 35.8 32 34.2 Q28 35.8 24.6 33Z" fill="#fbf8f2" ${OT}/>` +
    happyEyes(26.8, 5.2) + `<path d="M23.4 23.6 Q26.6 21 30.4 23.2 M40.6 23.6 Q37.4 21 33.6 23.2" fill="none" stroke="#fbf8f2" stroke-width="2.8" stroke-linecap="round"/><path d="M23.4 23.6 Q26.6 21 30.4 23.2 M40.6 23.6 Q37.4 21 33.6 23.2" fill="none" stroke="#cfcbc2" stroke-width=".8" stroke-linecap="round"/>` +
    cheeks(30.4, 8.2) +
    // bonnet de mandarin a ailes
    `<path d="M21.4 21 Q20.4 6.6 32 6.4 Q43.6 6.6 42.6 21 Q37 17.4 32 17.4 Q27 17.4 21.4 21Z" fill="#26202e" ${O}/>` +
    `<path d="M21.6 18.6 Q32 14.4 42.4 18.6" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>` +
    `<rect x="9.4" y="12.4" width="13" height="3.8" rx="1.9" fill="#26202e" ${O}/><rect x="41.6" y="12.4" width="13" height="3.8" rx="1.9" fill="#26202e" ${O}/>` +
    `<circle cx="32" cy="10.6" r="2" fill="${RED}" ${OT}/><path d="M24.4 9.4 Q27 7.8 29.4 8" fill="none" stroke="#6a6f96" stroke-width="1.1" stroke-linecap="round"/>`
  ),

  // Paysan Lin : chapeau conique de paille, houe, vetements d'indigo rapieces
  farmer_lin: svg(
    `<rect x="11.6" y="22" width="3" height="37" rx="1.4" fill="#8a5a33" ${O}/>` +
    `<path d="M12.6 21 L3 21.6 L4.4 28.4 L12.6 26Z" fill="#9aa5b3" ${O}/><path d="M5.6 23.4 L10 23" stroke="#fff" stroke-width="1" opacity=".7"/>` +
    // jambes nues + sandales
    `<rect x="23" y="49" width="6" height="7" fill="#e0a070" ${O}/><rect x="35" y="49" width="6" height="7" fill="#c4834f" ${O}/>` +
    `<ellipse cx="26" cy="57.4" rx="5" ry="2.4" fill="#c9a448" ${O}/><ellipse cx="38" cy="57.4" rx="5" ry="2.4" fill="#c9a448" ${O}/>` +
    `<path d="M21 54 L43 54 L43.6 50 L20.4 50Z" fill="#9c8a62" ${O}/>` +
    // tunique indigo
    `<path d="M19.6 53 Q18 44 23 37 L41 37 Q46 44 44.4 53 Q32 55.6 19.6 53Z" fill="#3e5f8a" ${O}/>` +
    `<path d="M39 39.6 Q44.4 45 43 52 L37.6 53.4 Q41 46 39 39.6Z" fill="#2c4568"/>` +
    `<path d="M26 37 L32 44 L38 37" fill="none" stroke="#b8c8e0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<rect x="26" y="45.8" width="12" height="2.4" rx="1.2" fill="#d8c08a" ${OT}/>` +
    `<rect x="22.4" y="47.4" width="5.6" height="4.6" fill="#8a6a3a" stroke="${K}" stroke-width="1.1" stroke-linejoin="round"/><path d="M22.4 47.4 L28 52" stroke="${K}" stroke-width=".8" stroke-dasharray="1 1"/>` +
    sleeve(19.6, 42.6, 3.4, 4.6, 14, '#3e5f8a') + `<rect x="15.8" y="44.8" width="6.4" height="5.4" rx="2.2" fill="#e0a070" transform="rotate(12 19 47.5)" ${O}/>` + hand(14.6, 49.6, '#e0a070') +
    sleeve(44.4, 42.6, 3.4, 4.6, -14, '#2c4568') + `<rect x="41.8" y="44.8" width="6.4" height="5.4" rx="2.2" fill="#c4834f" transform="rotate(-12 45 47.5)" ${O}/>` + hand(48.6, 50.4, '#c4834f') +
    `<path d="M20 28 Q18 38 22 39.6 L26 33Z M44 28 Q46 38 42 39.6 L38 33Z" fill="#2a2430" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    head('#e8b88c', '#cf9a6c', 28, 13.2, 10.6) +
    `<path d="M20.6 24.4 Q23 21.8 32 21.8 Q41 21.8 43.4 24.4 Q38 22.6 32 22.6 Q26 22.6 20.6 24.4Z" fill="#2a2430"/>` +
    brows(26, 5.2, 1.5, K, -0.5) + eyes(29.4, 5.2) + cheeks(32.8, 8.2) + smile(34.4, 1.8) +
    `<path d="M45.4 25 Q47 28.4 45.4 29.6 Q43.8 28.4 45.4 25Z" fill="#8fd6ff" ${OT}/>` +
    // chapeau conique
    `<path d="M32 2 Q40 12 55 24 Q32 31 9 24 Q24 12 32 2Z" fill="#e8c76a" ${O}/>` +
    `<path d="M32 2 Q41 12 55 24 Q46 26 40 27 Q41 14 32 2Z" fill="#c9a448"/>` +
    `<path d="M32 2 L32 27.6 M32 4 Q22 14 14 24.6 M32 4 Q42 14 50 24.6 M32 4 Q27 15 22 26.4 M32 4 Q37 15 42 26.4" stroke="#a88830" stroke-width=".9" fill="none" opacity=".7"/>` +
    `<path d="M14 21 Q22 12 28 6.6" fill="none" stroke="#fff6c8" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>` +
    `<path d="M19 28 Q18.4 32 20.6 35 M45 28 Q45.6 32 43.4 35" fill="none" stroke="${RED}" stroke-width="1.4" stroke-linecap="round"/>`
  ),

  // Passeur Gu : chapeau de pluie vert, cape de paille, perche de bambou
  ferryman_gu: svg(
    `<rect x="50.4" y="1.6" width="3.6" height="58" rx="1.6" fill="#6fa64a" ${O}/>` +
    `<path d="M50.4 12 L54 12 M50.4 26 L54 26 M50.4 40 L54 40 M50.4 52 L54 52" stroke="#3f6a2a" stroke-width="1.6"/><path d="M51.6 3 L51.6 58" stroke="#b9e08a" stroke-width=".9" opacity=".8"/>` +
    // jambes retroussees
    `<rect x="23" y="48" width="6.4" height="8" fill="#e0a070" ${O}/><rect x="34.6" y="48" width="6.4" height="8" fill="#c4834f" ${O}/>` +
    `<ellipse cx="26.2" cy="57.4" rx="4.8" ry="2.4" fill="#e0a070" ${O}/><ellipse cx="37.8" cy="57.4" rx="4.8" ry="2.4" fill="#c4834f" ${O}/>` +
    `<path d="M21 52 L43 52 L43.6 47 L20.4 47Z" fill="#2f8f94" ${O}/>` +
    // chemise + cape de paille
    `<path d="M20 50 Q18 41 23 36 L41 36 Q46 41 44 50 Q32 52.4 20 50Z" fill="#3aa0a4" ${O}/>` +
    sleeve(18.4, 42, 3.4, 5.6, 16, '#3aa0a4') + hand(14, 48.4, '#e0a070') +
    sleeve(46, 41.6, 3.4, 5.6, -12, '#2b7f84') + hand(50.2, 41.4, '#c4834f') +
    `<path d="M16 38 Q22 32.6 32 33 Q42 32.6 48 38 L49.4 50 L47 49 L47.6 56 L44.4 52 L42 57 L39 51.4 L36 56.4 L33 51 L29.6 57 L27 51.6 L23.6 56 L21 50.6 L18 55 L17.6 49 L14.6 50Z" fill="#a8743c" ${O}/>` +
    `<path d="M40 36 Q46.6 38.6 48.4 49 L47 49 L47.6 56 L44.4 52 L42 57 L39 51.4Z" fill="#8e5e2f"/>` +
    `<path d="M21 38 L19 52 M26 36 L25 52 M31 36 L31 52 M36 36 L36.6 52 M41 37 L42 52" stroke="#d6a868" stroke-width="1" stroke-linecap="round" opacity=".8"/>` +
    head('#e8b88c', '#cf9a6c', 25, 13, 10.4) +
    `<path d="M19.2 25 Q18 30 20.4 33 L22.2 29 Q21.6 27 22 24.6Z M44.8 25 Q46 30 43.6 33 L41.8 29 Q42.4 27 42 24.6Z" fill="${HAIR}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    brows(23.4, 5.2, 1.4) + eyes(26.4, 5.2) + cheeks(30, 8.2) + smile(31, 2.2) +
    `<path d="M29.8 33.4 Q32 36.4 34.2 33.4 Q32 34.6 29.8 33.4Z" fill="${HAIR}" stroke="${K}" stroke-width="1"/>` +
    // chapeau de pluie
    `<ellipse cx="32" cy="17.4" rx="23" ry="6.6" fill="#5e8c4a" ${O}/>` +
    `<path d="M9.4 18 Q12 23.8 32 24 Q52 23.8 54.6 18 Q50 22 32 22 Q14 22 9.4 18Z" fill="#3f6a2a"/>` +
    `<path d="M20.4 15.4 Q20.4 3.6 32 3.6 Q43.6 3.6 43.6 15.4 Q32 19.4 20.4 15.4Z" fill="#79a85e" ${O}/>` +
    `<path d="M32 3.6 L32 18.4 M26.6 4.8 L25 17.4 M37.4 4.8 L39 17.4" stroke="#4a7a36" stroke-width=".9" fill="none"/>` +
    `<path d="M24 8 Q26 5.6 29.6 5" fill="none" stroke="#d6f0b0" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>` +
    `<path d="M16 21.4 Q15.6 29.4 20.4 34 M48 21.4 Q48.4 29.4 43.6 34" fill="none" stroke="${RED}" stroke-width="1.5" stroke-linecap="round"/>`
  ),

  // Tisserande Mei : robe rose a fleurs, deux chignons fleuris, metier a tisser
  weaver_mei: svg(
    // metier a tisser
    `<rect x="45" y="19" width="14" height="34" rx="1.4" fill="none" stroke="${K}" stroke-width="5"/><rect x="45" y="19" width="14" height="34" rx="1.4" fill="none" stroke="#a8683a" stroke-width="2.6"/>` +
    `<path d="M48.6 22 L48.6 50 M52 22 L52 50 M55.4 22 L55.4 50" stroke="#f4ecd8" stroke-width="1"/>` +
    `<rect x="47" y="40" width="10" height="8.6" fill="#e0405f"/><path d="M47 43 L57 43 M47 46 L57 46" stroke="${GOLD}" stroke-width="1.3"/><path d="M47 40 L57 40" stroke="${K}" stroke-width="1"/>` +
    `<path d="M46 56 L46 59 M58 56 L58 59" stroke="${K}" stroke-width="3" stroke-linecap="round"/>` +
    feet('#e0405f') +
    `<path d="M16.6 57.6 Q14.4 45 22.6 35 L41.4 35 Q49.6 45 47.4 57.6 Q32 60.6 16.6 57.6Z" fill="#d4538a" ${O}/>` +
    `<path d="M39 38 Q47 46 45.6 56.6 L38 58 Q42.6 46 39 38Z" fill="#a83a68"/>` +
    // fleurs
    `<g fill="#fff0f4"><circle cx="23.4" cy="50" r="1.5"/><circle cx="23.4" cy="46.8" r="1.5"/><circle cx="20.6" cy="48.4" r="1.5"/><circle cx="26.2" cy="48.4" r="1.5"/>` +
    `<circle cx="39" cy="53" r="1.5"/><circle cx="39" cy="49.8" r="1.5"/><circle cx="36.2" cy="51.4" r="1.5"/><circle cx="41.8" cy="51.4" r="1.5"/>` +
    `<circle cx="29" cy="55" r="1.4"/><circle cx="29" cy="52" r="1.4"/><circle cx="26.4" cy="53.5" r="1.4"/><circle cx="31.6" cy="53.5" r="1.4"/></g>` +
    `<g fill="${GOLD}"><circle cx="23.4" cy="48.4" r="1"/><circle cx="39" cy="51.4" r="1"/><circle cx="29" cy="53.5" r="1"/></g>` +
    `<path d="M26 35 L32 43 L38 35" fill="#fff0f4" stroke="${K}" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M23.4 35.4 L32 45.4 L40.6 35.4" fill="none" stroke="#fff0f4" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M22 42.4 Q32 45.8 42 42.4 L42 46.4 Q32 49.8 22 46.4Z" fill="#2f9a9a" ${O}/>` +
    sleeve(20.4, 44, 4.2, 6.4, 16, '#e87aa6') + `<path d="M16.6 48.6 Q20 51 23.6 49.4" fill="none" stroke="#fff0f4" stroke-width="1.6" stroke-linecap="round"/>` + hand(24.4, 50.2) +
    sleeve(43.6, 44, 4.2, 6.4, -16, '#c0447c') + `<path d="M40.4 49.4 Q44 51 47.4 48.6" fill="none" stroke="#fff0f4" stroke-width="1.6" stroke-linecap="round"/>` + hand(46.8, 50.2) +
    // petite navette doree entre les mains
    `<rect x="26.6" y="53" width="10.8" height="3" rx="1.5" fill="${GOLD}" ${OT}/>` +
    // chignons fleuris
    `<circle cx="15.6" cy="17.6" r="5.4" fill="${HAIR}" ${O}/><circle cx="48.4" cy="17.6" r="5.4" fill="${HAIR}" ${O}/>` +
    head(SKIN, SKIN_D, 25, 13.2, 11.4) +
    `<path d="M18.8 25.6 Q17.2 13.4 32 13 Q46.8 13.4 45.2 25.6 Q44.6 20.4 40 19.4 L24 19.4 Q19.4 20.4 18.8 25.6Z" fill="${HAIR}" ${O}/>` +
    `<path d="M24 19.4 Q32 24 40 19.4 L40 17 L24 17Z" fill="${HAIR}"/>` +
    `<path d="M19 25.6 Q18.4 30 20.4 33.6 L22 29 Q21.4 27 21.8 24.6Z M45 25.6 Q45.6 30 43.6 33.6 L42 29 Q42.6 27 42.2 24.6Z" fill="${HAIR}" stroke="${K}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<path d="M23 15.8 Q27 14 31 14" fill="none" stroke="#6a6f96" stroke-width="1.2" stroke-linecap="round"/>` +
    `<g><circle cx="15.6" cy="12.4" r="2.2" fill="#ff7ea6" ${OT}/><circle cx="12.6" cy="14.6" r="2.2" fill="#ff9ec0" ${OT}/><circle cx="18.6" cy="14.6" r="2.2" fill="#ff9ec0" ${OT}/><circle cx="15.6" cy="14.4" r="1.2" fill="${GOLD}"/>` +
    `<circle cx="48.4" cy="12.4" r="2.2" fill="#ff7ea6" ${OT}/><circle cx="45.4" cy="14.6" r="2.2" fill="#ff9ec0" ${OT}/><circle cx="51.4" cy="14.6" r="2.2" fill="#ff9ec0" ${OT}/><circle cx="48.4" cy="14.4" r="1.2" fill="${GOLD}"/></g>` +
    eyes(27, 5.2) + `<path d="M24.6 24.4 Q27 23 29.6 24.4 M39.4 24.4 Q37 23 34.4 24.4" fill="none" stroke="${K}" stroke-width="1" stroke-linecap="round"/>` +
    cheeks(30.6, 8.4) + smile(31.2, 2)
  ),

  // Moine Zhen : crane rase, robe safran, kasaya, mains jointes, chapelet
  monk_zhen: svg(
    `<ellipse cx="26.4" cy="57" rx="4.6" ry="2.6" fill="#6e6a64" ${O}/><ellipse cx="37.6" cy="57" rx="4.6" ry="2.6" fill="#6e6a64" ${O}/>` +
    `<path d="M15.6 57.6 Q12.6 45 21.4 35 L42.6 35 Q51.4 45 48.4 57.6 Q32 60.8 15.6 57.6Z" fill="#f2a61e" ${O}/>` +
    `<path d="M41 38 Q50 46 47.4 56.8 L40 58.6 Q45 46 41 38Z" fill="#c97a12"/>` +
    // kasaya en diagonale (patchwork)
    `<path d="M21.4 35 L30.4 35 L47 47.4 Q49.4 53 48.4 57.6 Q32 60.8 15.6 57.6 Q12.6 45 21.4 35Z" fill="#d9461a" ${O}/>` +
    `<path d="M24 37 L44 54 M20 44 L36 58 M30 36 L18 50 M36 40 L24 58 M42 46 L32 59" stroke="#9a2e0c" stroke-width="1" fill="none" opacity=".7"/>` +
    `<circle cx="26" cy="38.4" r="2.2" fill="${GOLD}" ${OT}/>` +
    // chapelet
    `<path d="M24.4 36 Q32 55 39.6 36" fill="none" stroke="${K}" stroke-width="4.6" stroke-linecap="round" stroke-dasharray="0 3.4"/><path d="M24.4 36 Q32 55 39.6 36" fill="none" stroke="#b0703a" stroke-width="2.8" stroke-linecap="round" stroke-dasharray="0 3.4"/>` +
    `<circle cx="32" cy="46.6" r="2.3" fill="${RED}" ${OT}/>` +
    sleeve(21.6, 46.4, 4.2, 5.8, -42, '#ffc247') + sleeve(42.4, 46.4, 4.2, 5.8, 42, '#e0941a') + hand(30.8, 49.4) + hand(33.4, 49.4) +
    // tete rasee
    `<ellipse cx="18.2" cy="26.6" rx="2.4" ry="4" fill="#f5cba7" ${O}/><ellipse cx="45.8" cy="26.6" rx="2.4" ry="4" fill="#e0a582" ${O}/>` +
    head(SKIN, SKIN_D, 25, 13.2, 11.6) +
    `<g fill="#8a5a4a"><circle cx="29.2" cy="16.4" r=".9"/><circle cx="32" cy="15.6" r=".9"/><circle cx="34.8" cy="16.4" r=".9"/></g>` +
    `<path d="M25 23.2 Q27.4 21.8 30 22.8 M39 23.2 Q36.6 21.8 34 22.8" fill="none" stroke="${K}" stroke-width="1.1" stroke-linecap="round"/>` +
    happyEyes(26.6, 5.2) + cheeks(30.4, 8.4) + smile(30.8, 2.4)
  ),

  // Herboriste Xu : foulard et tablier verts, chignon, panier d'herbes, fiole
  herbalist_xu: svg(
    // panier + herbes
    `<path d="M9 42 Q15 29 21 42" fill="none" stroke="${K}" stroke-width="4.4" stroke-linecap="round"/><path d="M9 42 Q15 29 21 42" fill="none" stroke="#b8863f" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M10.4 40 Q8 32 11.6 28.6 Q13.6 33 12.6 40Z M14 40 Q14.6 30 18.4 27.6 Q18.6 34 16.6 40Z M17 40 Q22.4 34 25.6 36 Q23.6 40 19 41Z" fill="#4fae5a" stroke="${K}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<circle cx="13.6" cy="39" r="1.7" fill="#e0405f" stroke="${K}" stroke-width="1"/>` +
    `<path d="M6.4 41.6 L22.6 41.6 L20.4 56 Q15 58 9.6 56Z" fill="#c8964a" ${O}/>` +
    `<path d="M7.4 46 L21.6 46 M8.6 51 L20.6 51 M12 42 L11.4 56 M16 42 L16 57 M20 42 L20.4 56" stroke="#8a5e2a" stroke-width="1" fill="none"/>` +
    feet('#6b4226') +
    `<path d="M18.6 57 Q16.6 45 22.4 36 L41.6 36 Q47.4 45 45.4 57 Q32 59.8 18.6 57Z" fill="#efe3c0" ${O}/>` +
    `<path d="M22.4 40 L41.6 40 L43.6 56.6 Q32 59.4 20.4 56.6Z" fill="#4fa05a" ${O}/>` +
    `<path d="M39 42 Q43 48 42.4 56.6 L37 58Z" fill="#357a40"/>` +
    `<path d="M26 40 L26 36 M38 40 L38 36" stroke="${K}" stroke-width="3.8" stroke-linecap="round"/><path d="M26 40 L26 36 M38 40 L38 36" stroke="#4fa05a" stroke-width="1.8" stroke-linecap="round"/>` +
    `<rect x="27" y="47.6" width="10" height="6.4" rx="1.6" fill="#6cc078" ${OT}/><path d="M32 50.6 L32 46 M32 49 Q29.6 47 28.6 45.4 M32 49 Q34.4 47 35.6 45.4" stroke="#357a40" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    sleeve(19.8, 43.6, 4, 5.6, 18, '#efe3c0') + hand(15.8, 49.4) +
    sleeve(44.2, 43.6, 4, 5.6, -22, '#d9ccaa') + hand(47.6, 48.4) +
    // fiole
    `<rect x="48.6" y="38" width="3.2" height="4" fill="#d9e8ee" ${OT}/><circle cx="50.2" cy="45.6" r="4.6" fill="#d9e8ee" ${O}/><path d="M45.8 46 Q50.2 44 54.6 46 Q54.4 50 50.2 50.2 Q46 50 45.8 46Z" fill="#a85ed8"/><rect x="48.2" y="35.6" width="4" height="3" rx="1" fill="#a8683a" ${OT}/><circle cx="48.4" cy="44.2" r="1.1" fill="#fff"/>` + hand(47.4, 48.2) +
    // chignon + tete
    `<ellipse cx="32" cy="10.6" rx="5.4" ry="4.4" fill="${HAIR}" ${O}/>` +
    head(SKIN, SKIN_D, 25, 13.2, 11.4) +
    `<path d="M18.8 25 Q17.4 13.6 32 13 Q46.6 13.6 45.2 25 Q44 20.6 39 19.8 L25 19.8 Q20 20.6 18.8 25Z" fill="${HAIR}" ${O}/>` +
    `<path d="M18.2 20.6 Q32 14.6 45.8 20.6 L45.4 24 Q32 19 18.6 24Z" fill="#4fae5a" ${O}/>` +
    `<path d="M45.6 22 Q50 21.4 52 24.4 Q48 24.6 46 26Z" fill="#4fae5a" ${OT}/>` +
    `<path d="M22 21 Q26 19 30 19" fill="none" stroke="#b8f0b8" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>` +
    brows(24.6, 5.2, 1.1, K, -0.2) + eyes(27.2, 5.2) + cheeks(30.8, 8.4) + smile(31.4, 2.2)
  ),

  // Marchand Ma : robe de brocart pourpre, bonnet pointu a fourrure, balance, ballot
  merchant_ma: svg(
    // ballot
    `<path d="M8.4 57 Q3 47 8.6 40 Q14.6 35.6 19.4 40.6 Q22 46 21.4 57Z" fill="#cfae7c" ${O}/>` +
    `<path d="M16.4 43 Q20.4 48 19.4 56 L21.4 57 Q22 46 19.4 40.6Z" fill="#a8864f"/>` +
    `<path d="M9.4 43 Q14 46 19 42" fill="none" stroke="${RED}" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="38.4" r="2" fill="${RED}" ${OT}/>` +
    feet('#2a2430') +
    `<path d="M14.6 57.6 Q12 44 20.4 35 L43.6 35 Q52 44 49.4 57.6 Q32 60.8 14.6 57.6Z" fill="#7a3fa0" ${O}/>` +
    `<path d="M41 38 Q50 46 48.4 56.6 L40 58.4 Q45 46 41 38Z" fill="#552a74"/>` +
    `<g fill="none" stroke="${GOLD}" stroke-width="1.2"><circle cx="23" cy="43" r="2.6"/><circle cx="41" cy="43" r="2.6"/><circle cx="32" cy="53" r="2.6"/><circle cx="21.6" cy="52.4" r="2.2"/><circle cx="42.4" cy="52.4" r="2.2"/></g>` +
    `<path d="M15.6 55.4 Q32 59.8 48.4 55.4" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M25 35 L32 44 L39 35" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<rect x="19.6" y="45.6" width="24.8" height="4.4" rx="1.8" fill="${RED}" ${O}/><rect x="29" y="44.8" width="6" height="6" rx="1.4" fill="${GOLD}" ${O}/>` +
    sleeve(19.8, 43.4, 4.6, 6.8, 16, '#7a3fa0') + `<path d="M15.2 49 Q19.4 52.2 23.6 49.6" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>` + hand(17.6, 53.2) +
    // balance a la main droite
    `<path d="M40 40 L58 40" stroke="${K}" stroke-width="3.4" stroke-linecap="round"/><path d="M40 40 L58 40" stroke="#d6b04a" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M40 40 L37.6 50 M40 40 L44.4 50 M58 40 L55.6 50 M58 40 L60.4 50" stroke="${K}" stroke-width="1" fill="none"/>` +
    `<path d="M36.2 50 Q41 54 45.6 50Z" fill="${GOLD}" ${OT}/><path d="M54.6 50 Q58 54 61.6 50Z" fill="${GOLD}" ${OT}/>` +
    `<circle cx="41" cy="48.4" r="1.7" fill="#ffe27a" ${OT}/><circle cx="58" cy="48.6" r="1.7" fill="#ffe27a" ${OT}/>` +
    sleeve(44, 41.6, 4.6, 6.4, -30, '#552a74') + `<path d="M41 46.4 Q45 49.6 49 45.6" fill="none" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round"/>` + hand(49.6, 41.4) +
    // tete ronde
    head('#f4cba0', '#dca07a', 26, 14.2, 11.6) +
    `<path d="M25 33.6 Q32 35.6 39 33.6" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M25.4 31.6 Q28 29.6 31.4 31.4 Q28 33.8 25.4 31.6Z M38.6 31.6 Q36 29.6 32.6 31.4 Q36 33.8 38.6 31.6Z" fill="${HAIR}" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M26 31.8 Q22.6 31.6 22.4 35 M38 31.8 Q41.4 31.6 41.6 35" fill="none" stroke="${K}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M30.4 34 Q32 37.2 33.6 34Z" fill="${HAIR}" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    brows(23.4, 5.4, 1.2, K, -0.3) + happyEyes(26.4, 5.4) + cheeks(30.2, 9.4) +
    // bonnet pointu a fourrure
    `<path d="M18.6 20.4 Q18 6.6 33 5 Q42 4.6 48.6 9.4 Q41 8.6 42.4 14.6 Q45.8 17 45.4 20.4 Q32 15.8 18.6 20.4Z" fill="${RED}" ${O}/>` +
    `<path d="M38.4 8 Q43 11.6 42.4 15 Q45.4 17 45.4 20.4 Q41.6 19 38.6 18.4Z" fill="#8e2a22"/>` +
    `<path d="M17.4 21.2 Q32 14.6 46.6 21.2 Q47 24 44.6 24 Q32 19.6 19.4 24 Q16.8 24 17.4 21.2Z" fill="#f2efe6" ${O}/>` +
    `<circle cx="32" cy="16.4" r="2.6" fill="#3ec0a0" ${O}/><circle cx="31" cy="15.4" r=".9" fill="#fff"/>` +
    `<path d="M23 11.6 Q26 8.6 30 8" fill="none" stroke="#ff8a76" stroke-width="1.2" stroke-linecap="round"/>`
  ),

  // Guide Dawa : turban et voile, manteau de sable a capuche, baton
  guide_dawa: svg(
    // baton avec fanion
    `<path d="M50.4 4 Q50.4 1.6 53.6 2.4 Q55.6 3.6 54.4 6" fill="none" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M50.4 4 Q50.4 1.6 53.6 2.4 Q55.6 3.6 54.4 6" fill="none" stroke="#8a5a33" stroke-width="2.4" stroke-linecap="round"/>` +
    `<rect x="49" y="4.6" width="3.2" height="54" rx="1.4" fill="#8a5a33" ${O}/>` +
    `<path d="M52.2 12 Q58 12.6 58.4 19.6 Q54 17.6 52.2 18Z" fill="#1f9a9a" ${OT}/>` +
    feet('#6b4226') +
    // manteau
    `<path d="M15.4 57.6 Q12.4 44 20.6 35 L43.4 35 Q51.6 44 48.6 57.6 Q32 60.8 15.4 57.6Z" fill="#d9ad5c" ${O}/>` +
    `<path d="M41 38 Q50 46 48 56.6 L40 58.4 Q45 46 41 38Z" fill="#b3873c"/>` +
    `<path d="M26 38 L38 38 L38.6 56.6 Q32 58 25.4 56.6Z" fill="#7a5632" ${O}/>` +
    `<path d="M26 38 L26.4 57 M38 38 L37.6 57" stroke="#e8c47a" stroke-width="1.3" opacity=".9"/>` +
    `<rect x="24.6" y="46" width="14.8" height="3.4" rx="1.4" fill="#1f9a9a" ${O}/>` +
    // outre a eau
    `<path d="M36 50 Q42 49 42.8 54 Q41 58 36.6 56.6Z" fill="#8a5a33" ${O}/><rect x="37.6" y="47.6" width="2.8" height="3" fill="#6b4226" ${OT}/>` +
    sleeve(19.2, 43.4, 4.6, 6.8, 16, '#d9ad5c') + `<path d="M14.8 49 Q19 52 23.2 49.6" fill="none" stroke="#b3873c" stroke-width="1.6" stroke-linecap="round"/>` + hand(17.4, 53, '#d9a070') +
    sleeve(44.4, 42.6, 4.6, 6.6, -14, '#b3873c') + hand(50, 46.6, '#d9a070') +
    // capuchon derriere la tete
    `<path d="M17 24 Q14.4 36 19.4 40.4 L26 36 L38 36 L44.6 40.4 Q49.6 36 47 24Z" fill="#e8c47a" ${O}/>` +
    head('#e2b080', '#c98f5e', 26, 13.2, 11.2) +
    `<path d="M20 36.4 Q32 42.4 44 36.4 L45.2 41 Q32 47.6 18.8 41Z" fill="#1f9a9a" ${O}/><path d="M24 40.4 Q32 44.6 40 40.4" fill="none" stroke="#7fe0d8" stroke-width="1" opacity=".8"/>` +
    `<path d="M24 29.6 Q32 34.4 40 29.6" fill="none" stroke="#536250" stroke-width=".8" stroke-dasharray="1 1.4"/>` +
    brows(23.6, 5.2, 1.3, '#4a3a2a', 0.2) + happyEyes(26.6, 5.2) + cheeks(30.4, 8.6) + grin(30.6) +
    // turban
    `<path d="M18 22.6 Q16.6 8 32 7 Q47.4 8 46 22.6 Q40 17.4 32 17.4 Q24 17.4 18 22.6Z" fill="#f6efd8" ${O}/>` +
    `<path d="M19 19.4 Q32 12.2 45 19.4 L45.8 22 Q32 15 18.2 22Z" fill="#1f9a9a" ${O}/>` +
    `<path d="M22 11.4 Q32 6.4 42 11.4 M20.4 15 Q32 9.4 43.6 15" fill="none" stroke="#d6c9a0" stroke-width="1.1"/>` +
    `<path d="M40 8 Q46 11 46 22 Q42 19 38.6 18Z" fill="#d9cda4"/>` +
    `<circle cx="32" cy="16.4" r="2" fill="#e0405f" ${OT}/><circle cx="31.2" cy="15.6" r=".7" fill="#fff"/>` +
    `<path d="M22.6 11 Q26 8.6 29.6 8.4" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/>`
  ),

  // Forgeron Tie : muscle, tablier de cuir, marteau et fleche rouge
  smith_tie: svg(
    // marteau
    `<rect x="50" y="20" width="3.2" height="40" rx="1.4" fill="#7a4a26" ${O}/>` +
    `<rect x="43.4" y="9" width="16.4" height="11.6" rx="2.2" fill="#8e98a6" ${O}/><path d="M53 10 L58.6 10 L58.6 19.6 L53 19.6Z" fill="#6a7482"/><path d="M45.4 11.6 L51 11.6" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>` +
    // fleche rouge
    `<rect x="11.4" y="22" width="2.8" height="30" rx="1.2" fill="#d8402a" ${O}/>` +
    `<path d="M12.8 12 L17 23 L8.6 23Z" fill="#ff8a3a" ${O}/><path d="M12.8 15 L12.8 22" stroke="#ffe27a" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M12.8 52 L8.4 56.6 L12.8 55 L17.2 56.6Z" fill="#2a2430" ${OT}/>` +
    `<g fill="#ffd84a"><path d="M5 14 l1 2 2 1 -2 1 -1 2 -1-2 -2-1 2-1z"/><path d="M19.6 9 l.8 1.6 1.6.8 -1.6.8 -.8 1.6 -.8-1.6 -1.6-.8 1.6-.8z"/></g>` +
    // bottes
    `<ellipse cx="26" cy="57" rx="5" ry="2.8" fill="#2a2430" ${O}/><ellipse cx="38" cy="57" rx="5" ry="2.8" fill="#2a2430" ${O}/>` +
    `<path d="M20.6 56.6 Q19.6 48 22 41 L42 41 Q44.4 48 43.4 56.6 Q32 58.6 20.6 56.6Z" fill="#3a3440" ${O}/>` +
    // torse large
    `<path d="M16.4 45 Q14.6 36 21 34 L43 34 Q49.4 36 47.6 45 Q32 47 16.4 45Z" fill="#c98f62" ${O}/>` +
    `<path d="M39 36 Q47 38 46.6 45 L40 46Z" fill="#a8704a"/>` +
    // tablier de cuir
    `<path d="M22.6 36 L41.4 36 L43 56 Q32 58.4 21 56Z" fill="#8a5a30" ${O}/>` +
    `<path d="M38.4 38 L41.4 37 L42.8 55.4 L36.6 56.6Z" fill="#6a4020"/>` +
    `<path d="M24.6 40 L24.6 36 M39.4 40 L39.4 36" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M24.6 40 L24.6 36 M39.4 40 L39.4 36" stroke="#8a5a30" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M24 41 L40 41 M25 54.4 L39 54.4" stroke="#c89860" stroke-width=".9" stroke-dasharray="1.6 1.4"/>` +
    `<rect x="26.6" y="45" width="10.8" height="6" rx="1.6" fill="#a8703c" ${OT}/><circle cx="29.6" cy="48" r="1" fill="#f6d08a"/><path d="M31.8 46.4 L35.6 49.6" stroke="#4a2a14" stroke-width="1.2" stroke-linecap="round"/>` +
    // bras muscles
    `<ellipse cx="16" cy="42" rx="5.2" ry="6.8" transform="rotate(10 16 42)" fill="#c98f62" ${O}/><path d="M13.4 38.4 Q16 36.4 19 38.4" fill="none" stroke="#a8704a" stroke-width="1.2" stroke-linecap="round"/><rect x="11.6" y="44.6" width="8.2" height="3.6" rx="1.4" fill="#4a3a30" ${O}/>` + hand(14.6, 51.6, '#c98f62') +
    `<ellipse cx="48" cy="40.6" rx="5.2" ry="6.8" transform="rotate(-10 48 40.6)" fill="#a8704a" ${O}/><path d="M45.4 37.4 Q48 35.4 51 37.4" fill="none" stroke="#8a5a34" stroke-width="1.2" stroke-linecap="round"/><rect x="43.8" y="43.6" width="8.2" height="3.6" rx="1.4" fill="#4a3a30" ${O}/>` + hand(51.6, 49, '#a8704a') +
    // tete
    head('#d9a074', '#bf8258', 24, 13.6, 11.2) +
    `<path d="M18.6 22 Q17.6 11.4 32 10.8 Q46.4 11.4 45.4 22 Q43 17.4 38.6 18.4 L36 15.6 L33 18.4 L30 15.4 L27 18.4 Q21.6 17.4 18.6 22Z" fill="${HAIR}" ${O}/>` +
    `<path d="M17.8 18.6 Q32 12.4 46.2 18.6 L46.2 22.4 Q32 16.6 17.8 22.4Z" fill="#c0392b" ${O}/>` +
    `<path d="M45.6 20 Q50.4 20.6 52 25 Q47.6 23.6 45.4 23.6Z" fill="#c0392b" ${OT}/>` +
    `<path d="M20.4 28 Q22 36.4 32 37 Q42 36.4 43.6 28 Q40 33 32 33 Q24 33 20.4 28Z" fill="${HAIR}" ${O}/>` +
    brows(22.4, 5.2, 2, K, 0.5) + eyes(25.6, 5.2) + cheeks(29.2, 8.8) + `<path d="M28 30.6 Q32 35.2 36 30.6Z" fill="#fff" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>` +
    `<circle cx="23.4" cy="30" r=".8" fill="#4a3a30" opacity=".6"/><circle cx="40.6" cy="31.4" r=".8" fill="#4a3a30" opacity=".6"/>`
  ),

  // Ermite Lei : barbe grise ebouriffee, robe bleu orage, eclairs
  hermit_lei: svg(
    // eclairs
    `<path d="M10 2 L4.6 14 L9.2 14 L5.4 25 L14.4 10.6 L9.6 10.6 L13.6 2Z" fill="#ffe44d" ${OT}/>` +
    `<path d="M52 2 L46.4 15 L51.2 15 L47.6 27 L57.6 11.4 L52.6 11.4 L56.8 2Z" fill="#ffe44d" ${OT}/>` +
    `<path d="M58 30 L55 36 L58 36 L56 42 L61.4 33.6 L58.6 33.6 L61 30Z" fill="#fff08a" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M8 28 L5.4 33 L8 33 L6.4 38 L11 31 L8.6 31 L10.6 28Z" fill="#fff08a" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    feet('#4a3a2a') +
    // robe d'orage
    `<path d="M17.6 57.6 Q15 45 22.4 35 L41.6 35 Q49 45 46.4 57.6 L43 56 L41 58.6 L37 56.6 L33 59 L29 56.6 L25 58.6 L22 56Z" fill="#3e5f9e" ${O}/>` +
    `<path d="M39 38 Q47 46 45.4 56.6 L41 58.6 L37 56.6Z" fill="#2a4580"/>` +
    `<path d="M22.6 47 l5 3 -3 4 M38.4 42 l-4 3 3 3" stroke="#7aa0dc" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M26 35 L32 43 L38 35" fill="none" stroke="#a8c0ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M22 46.6 Q32 49.6 42 46.6" fill="none" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M22 46.6 Q32 49.6 42 46.6" fill="none" stroke="#d9c08a" stroke-width="1.8" stroke-linecap="round"/>` +
    // gourde
    `<ellipse cx="40.6" cy="53.4" rx="3.8" ry="2.8" fill="#d8a838" ${O}/><ellipse cx="40.6" cy="49.6" rx="2.4" ry="2.2" fill="#d8a838" ${O}/><path d="M40.6 47.6 L41.6 45.6" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/>` +
    sleeve(19.6, 44, 4.6, 6.6, 16, '#3e5f9e') + hand(16.4, 50.2, '#f0d4b8') +
    // bras leve vers le ciel
    sleeve(46.4, 38, 4.4, 6.8, -34, '#2a4580') + `<path d="M43 43 Q47 44 49.4 41" fill="none" stroke="#a8c0ea" stroke-width="1.5" stroke-linecap="round"/>` + hand(51.2, 31.4, '#f0d4b8') +
    `<path d="M53.6 28.4 L55.6 26 M54.6 31.6 L57.4 31.4 M53 34.6 L55.4 36" stroke="#ffe44d" stroke-width="1.4" stroke-linecap="round"/>` +
    // cheveux ebouriffes
    `<path d="M32 2 L35.6 9 L41.6 4.4 L41.4 12 L48.4 10 L44.6 17 L50.6 20 L45.2 24 L48 31 L42 29 L44 36 L38 32 L32 37 L26 32 L20 36 L22 29 L16 31 L18.8 24 L13.4 20 L19.4 17 L15.6 10 L22.6 12 L22.4 4.4 L28.4 9Z" fill="#b8bcc8" ${O}/>` +
    `<path d="M32 2 L35.6 9 L41.6 4.4 L41.4 12 L48.4 10 L44.6 17 L50.6 20 L45.2 24 L48 31 L42 29 L44 36 L38 32Z" fill="#9ba0af"/>` +
    head('#f0d4b8', '#dab294', 25.6, 12.6, 10.8) +
    `<path d="M22 20 Q27 17 32 19.4 Q37 17 42 20 Q37 18.8 32 21.6 Q27 18.8 22 20Z" fill="#b8bcc8" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>` +
    // barbe ebouriffee
    `<path d="M20.4 29 L17.6 36 L22 35.4 L21 43 L26.4 40 L28 47 L32 41 L36 47 L37.6 40 L43 43 L42 35.4 L46.4 36 L43.6 29 Q38 35.6 32 34.6 Q26 35.6 20.4 29Z" fill="#c8ccd6" ${O}/>` +
    `<path d="M38.4 36 L37.6 40 L43 43 L42 35.4 L46.4 36 L43.6 29 Q41 33 38.4 36Z" fill="#9aa0b0"/>` +
    `<path d="M26 37.6 L27 42 M38 37.6 L37 42 M32 39 L32 43.6" stroke="#9aa0b0" stroke-width="1" stroke-linecap="round"/>` +
    `<path d="M22.8 24.4 Q26.4 19.8 30.6 23 Q27 24.4 22.8 24.4Z M41.2 24.4 Q37.6 19.8 33.4 23 Q37 24.4 41.2 24.4Z" fill="#e4e6ec" ${OT}/>` +
    eyes(26.8, 5.2) + cheeks(30.2, 8.2) + `<path d="M29 31.6 Q32 35 35 31.6Z" fill="#8e2a3a" stroke="${K}" stroke-width="1" stroke-linejoin="round"/>`
  ),

  // ---------- Pourparlers (fleuve boueux, bambous cendres, tonnerre) ----------
  // Yuan, doyen des noyes (parley_sun2) : vieux noye venerable, peau bleutee, robe detrempee ourlee de boue,
  // algues et perles d'eau, longue barbe de joncs, regard doux.
  parley_sun2: svg(
    `<ellipse cx="32" cy="22" rx="14.8" ry="12.6" fill="#dfe7e9" ${O}/><ellipse cx="32" cy="9.6" rx="4.6" ry="4.4" fill="#dfe7e9" ${O}/>` +
    `<path d="M18 55 Q14.6 45 22.4 35 L41.6 35 Q49.4 45 46 55 L44.4 59 L41.4 56.6 L38.6 59.6 L35.6 56.8 L32 60 L28.4 56.8 L25.4 59.6 L22.6 56.6 L19.6 59Z" fill="#4d7683" ${O}/>` +
    `<path d="M39 38 Q47 46 45.4 54.6 L40.4 55.6 Q43.4 46 39 38Z" fill="#38596a"/>` +
    `<path d="M18.2 51.4 Q32 56.2 45.8 51.4 L45.4 54.4 Q32 59 18.6 54.4Z" fill="#a67c3a"/>` +
    `<path d="M24 36.4 L32 44 L40 36.4" fill="none" stroke="#a67c3a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    cord('M23.6 37.4 Q30 40.6 27.4 46 Q24.4 50.6 30.6 52.6 Q36.4 54.2 40.4 50.6', 2.8, '#3f8a4c') +
    pearl(24.4, 52.2) + pearl(39.6, 46.6) + pearl(35.6, 56.2, 1.5) + pearl(21.4, 47.6, 1.5) +
    sleeve(19.4, 44.6, 4.6, 7, 12, '#4d7683') + hand(17.8, 51.8, '#a6cddb') +
    sleeve(44.6, 44.6, 4.6, 7, -12, '#38596a') + hand(46.2, 51.8, '#a6cddb') +
    head('#a6cddb', '#7eaabd', 25, 13.2, 11.4) +
    `<path d="M19.4 22 Q19 14 32 13.4 Q45 14 44.6 22 Q41 18.8 36 19 Q32 17.8 28 19 Q23 18.8 19.4 22Z" fill="#dfe7e9"/>` +
    `<path d="M22.4 23 Q26 21 30.2 23.4 M41.6 23 Q38 21 33.8 23.4" fill="none" stroke="#f4f8f8" stroke-width="2.2" stroke-linecap="round"/>` +
    pxEyes(28, 2, 28, 36, 4) +
    `<path d="M20.4 30 L18.6 40 L23 37.6 L22.4 48 L27 41.6 L28.6 52 L32 44 L35.4 52 L37 41.6 L41.6 48 L41 37.6 L45.4 40 L43.6 30 Q38.4 35.6 32 34.6 Q25.6 35.6 20.4 30Z" fill="#a3a95a" ${O}/>` +
    `<path d="M37 41.6 L41.6 48 L41 37.6 L45.4 40 L43.6 30 Q41 33 38 34.4Z" fill="#767d3a"/>` +
    `<path d="M24.6 36 L24.6 41 M28.6 38 L28.6 46 M32 38.6 L32 43 M35.6 38 L35.6 46" fill="none" stroke="#767d3a" stroke-width="1.1" stroke-linecap="round"/>` +
    `<path d="M29.6 32.6 Q32 34 34.4 32.6" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    cord('M22.4 13.6 Q14.6 14 15.4 22.4 Q16.4 29 13.6 34.4', 2.6, '#3f8a4c') +
    `<ellipse cx="38.4" cy="8.4" rx="3.4" ry="1.7" transform="rotate(-24 38.4 8.4)" fill="#3f8a4c" ${OT}/>`
  ),

  // Tintement, ame de la cloche felee (parley_sun3) : petit esprit en cloche de bronze patine, anse en chignon
  // piquee d'une epingle, fissure lumineuse, lueur chaude au visage, bras minuscules, air timide.
  parley_sun3: svg(
    `<ellipse cx="22.6" cy="58" rx="4.2" ry="2.2" fill="#8a5a22" ${O}/><ellipse cx="41.4" cy="58" rx="4.2" ry="2.2" fill="#8a5a22" ${O}/>` +
    `<path fill-rule="evenodd" d="M25 8.6 a7 5.4 0 1 0 14 0 a7 5.4 0 1 0 -14 0Z M28.6 8.8 a3.4 2.6 0 1 0 6.8 0 a3.4 2.6 0 1 0 -6.8 0Z" fill="#c98a3a" ${O}/>` +
    `<path d="M24 17 Q32 12.4 40 17 Q43.4 28 46.6 38 Q49.6 46 53 51 Q32 54.6 11 51 Q14.4 46 17.4 38 Q20.6 28 24 17Z" fill="#c98a3a" ${O}/>` +
    `<path d="M24.8 19.6 Q22.6 30 19 40 Q17.2 45 15.4 48 L20.6 47 Q23 41 26 30Z" fill="#e9b45e"/>` +
    `<ellipse cx="30" cy="36" rx="11.6" ry="11.4" fill="#f0bf68"/><ellipse cx="29.6" cy="35.6" rx="8.8" ry="8.6" fill="#ffdf94"/>` +
    `<path d="M23.6 19.6 Q32 15.6 40.4 19.6" fill="none" stroke="#8a5a22" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M10.8 49.6 Q9 58 16 58 L48 58 Q55 58 53.2 49.6 Q32 54 10.8 49.6Z" fill="#6f9a86" ${O}/>` +
    `<path d="M14 53.2 Q20 55.4 27 55.4" fill="none" stroke="#a9cdb8" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M41.5 15.6 L38.4 22.4 L41.6 27.6 L38.2 33 L41.4 38.6 L37.8 44.6 L39.8 51" fill="none" stroke="${K}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M41.5 15.6 L38.4 22.4 L41.6 27.6 L38.2 33 L41.4 38.6 L37.8 44.6 L39.8 51" fill="none" stroke="#fff3b8" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M21.6 6.2 L42.4 4" stroke="${K}" stroke-width="3.6" stroke-linecap="round"/><path d="M21.6 6.2 L42.4 4" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round"/>` +
    // yeux ronds baisses, sourcils inquiets, joues rouges, petite bouche tremblante
    `${pxEyes(32, 4, 25, 35)}` +
    `<ellipse cx="21.6" cy="39.4" rx="2.6" ry="1.6" fill="#ff7f6a" opacity=".7"/><ellipse cx="36.8" cy="39.4" rx="2.4" ry="1.5" fill="#ff7f6a" opacity=".7"/>` +
    `<path d="M27.4 41.6 Q28.8 40.4 30 41.6 Q31.2 42.8 32.6 41.4" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round"/>` +
    cord('M17.4 40.4 L27 46.6', 3.2, '#c98a3a') + cord('M44.6 40.4 L33.4 46.8', 3.2, '#b9772e') +
    `<circle cx="28" cy="47.4" r="2.5" fill="#f6cf86" ${O}/><circle cx="33" cy="47.6" r="2.5" fill="#f6cf86" ${O}/>` +
    spark(8.4, 22) + spark(56.2, 30, '#ffe9a0') + spark(9.4, 44, '#ffe9a0')
  ),

  // Rongrong, petite voix du tonnerre (parley_sun5) : enfant-esprit a nuage d'orage pour chapeau, meches en eclairs,
  // petit tambour au ventre et baguettes levees, sourire espiegle ; violet-gris de l'orage.
  parley_sun5: svg(
    cord('M18 47.4 L7.4 36.4', 2, '#e0b070') + `<circle cx="6.4" cy="35.2" r="2.5" fill="#ffe35c" ${OT}/>` +
    cord('M46 47.4 L56.6 36.4', 2, '#e0b070') + `<circle cx="57.6" cy="35.2" r="2.5" fill="#ffe35c" ${OT}/>` +
    feet('#3a2f55', 57.4, 4.4) +
    `<path d="M22 57 Q20 47 24.6 39 L39.4 39 Q44 47 42 57 Q32 59.6 22 57Z" fill="#5b4f8c" ${O}/>` +
    `<path d="M37.4 41 Q43 48 41.2 56 L37.6 56.6 Q40 48 37.4 41Z" fill="#43386a"/>` +
    `<path d="M22.4 54 L25 56 L27.6 54 L30.2 56.2 L32.8 54 L35.4 56.2 L38 54 L40.6 56 L41.6 54" fill="none" stroke="#ffe35c" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect x="24" y="44.4" width="16" height="9" rx="3" fill="#a8683a" ${O}/><ellipse cx="32" cy="44.6" rx="8" ry="2.6" fill="#ecd7a8" ${O}/>` +
    `<circle cx="27.4" cy="50" r=".9" fill="#ffe35c" stroke="none"/><circle cx="32" cy="50.6" r=".9" fill="#ffe35c" stroke="none"/><circle cx="36.6" cy="50" r=".9" fill="#ffe35c" stroke="none"/>` +
    sleeve(20.4, 44.6, 3.8, 6, 14, '#5b4f8c') + hand(18, 47.8) +
    sleeve(43.6, 44.6, 3.8, 6, -14, '#43386a') + hand(46, 47.8) +
    head(SKIN, SKIN_D, 27.6, 13.4, 11.4) +
    pxEyes(30, 4, 27, 37) + cheeks(34, 8.4) + grin(34.6) +
    `<path d="M16.4 24.6 Q9.6 20.4 15.4 14.6 Q14 7 22.4 7.4 Q26 1.4 33.4 4 Q40 0.4 44.6 7.8 Q53.4 7 51.4 15.4 Q57.4 21 50.6 25 Q46 21.8 41.6 23.4 Q37 20.8 32 22.8 Q27 20.8 22.4 23.4 Q19 21.8 16.4 24.6Z" fill="#7a7399" ${O}/>` +
    `<path d="M17.6 22.8 Q22 21 24.6 23.4 Q28 21 32 22.8 Q36 21 40 23.4 Q43 21.4 50 23.2 Q53.6 20 52 17.6 Q48 21.4 40 21 Q28 20 17.6 22.8Z" fill="#524b78"/>` +
    `<ellipse cx="24.6" cy="11" rx="5" ry="2.4" fill="#a49dc2"/><ellipse cx="40.4" cy="9.4" rx="4.2" ry="2" fill="#a49dc2"/><ellipse cx="47.6" cy="16" rx="2.8" ry="1.8" fill="#a49dc2"/>` +
    bolt(12.6, 21.4, 1.05) + bolt(45.4, 21.4, 1.05)
  ),
};

// ---------- Coffres ----------
const ingot = (x, y, s, f = GOLD) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M-8 -3 Q-7 2 -3.4 3 L3.4 3 Q7 2 8 -3 Q5.4 -1.6 3.4 -3.6 Q0 -7.4 -3.4 -3.6 Q-5.4 -1.6 -8 -3Z" fill="${f}" stroke-width="${(1.5 / s).toFixed(2)}"/>` +
  `<path transform="translate(${x} ${y}) scale(${s})" d="M-2.6 -3.8 Q0 -6 2.6 -3.8" fill="none" stroke="#fffbd0" stroke-width="${(1 / s).toFixed(2)}"/>`;
const coin = (x, y, r = 3.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffc21f" ${OT}/><rect x="${x - 1}" y="${y - 1}" width="2" height="2" fill="${K}" stroke="none"/>`;
const bandO = OB;
export const CHEST_SPRITES = {
  // Coffre laque rouge cercle d'or, serrure en forme de nuage
  closed: svg(
    `<path d="M9 36 L55 36 L54 56 Q54 58.4 51.6 58.4 L12.4 58.4 Q10 58.4 10 56Z" fill="#b52a22" ${O}/>` +
    `<path d="M42 37 L54 37 L53.2 56 L42 57.6Z" fill="#8a1f1a"/>` +
    `<path d="M9 37 Q9 18.6 32 18.6 Q55 18.6 55 37Z" fill="#cf3a2c" ${O}/>` +
    `<path d="M44 21 Q55 24 55 37 L46 37 Q47 27 44 21Z" fill="#a22a20"/>` +
    `<path d="M14 30 Q17 23.6 24 21.6" fill="none" stroke="#ff9a82" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M13 37 Q12.6 26.6 19 21 L19 37Z" fill="${GOLD}" ${bandO}/><path d="M51 37 Q51.4 26.6 45 21 L45 37Z" fill="${GOLD_D}" ${bandO}/>` +
    `<rect x="13" y="37" width="6" height="20.6" fill="${GOLD}" ${bandO}/><rect x="45" y="37" width="6" height="20.6" fill="${GOLD_D}" ${bandO}/>` +
    `<rect x="9" y="33.6" width="46" height="4.8" rx="1.4" fill="${GOLD}" ${bandO}/>` +
    cloud(21.4, 48.6, 0.9, GOLD, 1.2) + cloud(36, 52.6, 0.9, GOLD, 1.2) + cloud(36.4, 25.6, 0.7, GOLD, 1.1) +
    `<circle cx="16" cy="42" r="1" fill="#fff6c8"/><circle cx="16" cy="53" r="1" fill="#fff6c8"/><circle cx="48" cy="42" r="1" fill="#fff6c8"/><circle cx="48" cy="53" r="1" fill="#fff6c8"/>` +
    // serrure nuage
    `<path d="M24.4 41.2 Q21.6 38.4 24.6 36.2 Q25 32.6 29 33.4 Q32 31.4 35 33.4 Q39 32.6 39.4 36.2 Q42.4 38.4 39.6 41.2 Q40 45.6 35.4 44.4 Q32 46.8 28.6 44.4 Q24 45.6 24.4 41.2Z" fill="${GOLD}" ${O}/>` +
    `<path d="M27 34.8 Q29 33.8 31 34.4" fill="none" stroke="#fff6c8" stroke-width="1.2" stroke-linecap="round"/>` +
    `<circle cx="32" cy="38.8" r="1.7" fill="${K}"/><path d="M32 39.6 L32 42.6" stroke="${K}" stroke-width="1.6" stroke-linecap="round"/>`
  ),

  // Coffre ouvert : lueur doree, lingots yuanbao, pieces et jade
  open: svg(
    `` +
    `<path class="glow" d="M32 33 L16 2 L48 2Z" fill="#fff3a0" opacity=".45"/><path class="glow" d="M32 33 L4 14 L10 6Z M32 33 L60 14 L54 6Z" fill="#fff3a0" opacity=".3"/>` +
    `<path d="M10 37 L13.6 14 Q32 8 50.4 14 L54 37Z" fill="#7a1f1a" ${O}/>` +
    `<path d="M14.6 18 Q32 12.6 49.4 18 L50.4 32 Q32 27 13.6 32Z" fill="#9a2a22"/>` +
    `<rect x="12" y="13.6" width="6" height="22" fill="${GOLD_D}" transform="rotate(-6 15 25)" ${bandO}/><rect x="46" y="13.6" width="6" height="22" fill="#a8761c" transform="rotate(6 49 25)" ${bandO}/>` +
    `<ellipse cx="32" cy="36" rx="22.4" ry="6.4" fill="#ffd84a" ${O}/>` +
    // lingots et pieces
    ingot(20, 33.4, 1.05, '#ffd23a') + ingot(44, 33, 1.05, '#ffc21f') + ingot(32, 29.4, 1.25) +
    coin(24.6, 33.2, 3.1) + coin(40.4, 33.6, 3.1) + `<ellipse cx="32" cy="35.6" rx="3" ry="2" fill="#4fd0a0" ${OT}/>` +
    `<path d="M10 37 L54 37 L53 55.6 Q53 58 50.6 58 L13.4 58 Q11 58 11 55.6Z" fill="#b52a22" ${O}/>` +
    `<path d="M42 38 L54 38 L53.2 55.6 L42 57.4Z" fill="#8a1f1a"/>` +
    `<rect x="13" y="37" width="6" height="21" fill="${GOLD}" ${bandO}/><rect x="45" y="37" width="6" height="21" fill="${GOLD_D}" ${bandO}/>` +
    cloud(22, 52, 0.9, GOLD, 1.2) + cloud(36, 54, 0.9, GOLD, 1.2) +
    `<path d="M25 42.4 Q22.6 40 25.2 38.4 Q25.6 36.2 29 36.6 Q32 35.2 35 36.6 Q38.4 36.2 38.8 38.4 Q41.4 40 39 42.4 Q39.2 45.8 35.4 44.8 Q32 46.6 28.6 44.8 Q24.8 45.8 25 42.4Z" fill="${GOLD}" ${OT}/><circle cx="32" cy="40.6" r="1.4" fill="${K}"/>` +
    `<path d="M8 8 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2-2.6 -2.6-1.2 2.6-1.2z M56 6 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1-2.2 -2.2-1 2.2-1z" fill="#fff8c0"/>`
  ),
};
