// Sprites SVG (fantasy chinoise, legende de Hou Yi) : heros, PNJ de la premiere moitie du monde, coffres.
// Heros et coffres : chibi de face dessine en vectoriel, contour #2b1b17 de 2 px, viewBox 64x64, pieds vers y = 58, sans ombre au sol
// (les helpers ne servent qu'a factoriser ; chaque valeur exportee est une chaine SVG statique).
// PNJ (NPC_SPRITES_A) : pixel art, memes proportions mais dessines sur une grille de 64 x 64 pixels indexes, voir le bloc plus bas.

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
const cheeks = (y = 29.5, dx = 8.5) =>
  `<ellipse cx="${32 - dx}" cy="${y}" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".45"/><ellipse cx="${32 + dx}" cy="${y}" rx="2.4" ry="1.5" fill="#ff7f7f" opacity=".45"/>`;
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

// PNJ : pixel art (grille de 64 x 64 pixels indexes convertie en rectangles alignes, contour #2b1b17 d'un pixel, 3 tons + reflet laque en haut a gauche).
export const NPC_SPRITES_A = {
  // Chang'e : longs cheveux noirs et chignon aux fleurs, robe claire a haute ceinture jade, plateau de gateaux de lune
  change: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M30 3h5v54h-5M28 4h9v53h-9M27 5h2v54h-2M26 7h1v52h-1M37 11h2v48h-2M24 12h17v45h-17M22 13h21v44h-21M19 14h26v43h-26M18 15h1v40h-1M17 18h30v37h-30M16 20h1v35h-1M15 24h34v31h-34M14 29h1v24h-1M49 29h2v2h-2M13 34h38v9h-38M49 43h2v2h-2M49 52h2v1h-2M48 55h1v2h-1M23 57h3v2h-3M35 57h6v2h-6"/>' +
    '<path fill="#336" d="M32 4h2v7h-2M31 5h5v6h-5M29 6h2v5h-2M28 8h1v3h-1M27 9h1v2h-1M32 13h8v9h-8M40 14h2v9h-2M29 15h15v7h-15M27 16h2v7h-2M25 17h2v5h-2M18 18h3v14h-3M24 18h1v4h-1M23 19h1v4h-1M17 20h1v10h-1M42 22h3v11h-3M41 23h1v2h-1M16 30h1v12h-1M17 32h1v9h-1M19 32h1v1h-1M18 33h1v7h-1M45 33h2v7h-2M15 34h5v5h-5M44 34h1v5h-1M20 35h2v3h-2M43 35h1v3h-1M22 36h1v1h-1M41 36h2v1h-2M42 37h1v1h-1M15 39h1v4h-1M46 40h1v1h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#fc9" d="M24 24h6v2h-6M34 24h2v14h-2M36 24h4v2h-4M23 25h18v1h-18M24 26h1v1h-1M27 26h10v1h-10M39 26h1v1h-1M22 27h2v8h-2M28 27h6v7h-6M40 27h1v9h-1M24 31h5v5h-5M36 31h4v5h-4M30 34h2v1h-2M33 34h1v4h-1M29 35h1v3h-1M32 35h1v3h-1M16 53h3v1h-3M44 53h3v1h-3"/>' +
    '<path fill="#333" d="M35 5h1v1h-1M35 7h1v4h-1M34 9h1v2h-1M44 18h1v9h-1M34 19h3v4h-3M45 19h1v13h-1M22 20h2v3h-2M24 20h1v2h-1M26 20h1v2h-1M31 20h3v4h-3M37 20h1v2h-1M21 21h18v1h-18M21 22h1v5h-1M27 22h4v1h-4M20 23h1v11h-1M22 23h1v2h-1M30 23h1v1h-1M46 24h1v6h-1M48 29h1v1h-1M47 30h1v12h-1M44 31h1v2h-1M43 32h1v2h-1M46 32h1v2h-1M42 33h1v2h-1M48 34h1v9h-1M49 35h1v7h-1M14 42h1v1h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#fc3" d="M30 6h4v2h-4M19 15h2v3h-2M43 15h1v3h-1M30 45h4v5h-4M23 46h4v5h-4M29 46h1v3h-1M34 46h1v2h-1M37 46h4v5h-4M22 47h1v3h-1M28 47h1v1h-1M36 47h6v3h-6M21 48h1v1h-1M35 48h1v1h-1M16 50h3v2h-3M20 50h2v2h-2M28 50h2v3h-2M34 50h2v3h-2M42 50h1v3h-1M45 50h3v2h-3M22 51h1v2h-1M27 51h10v2h-10M23 52h1v1h-1"/>' +
    '<path fill="#ccf" d="M27 38h1v8h-1M25 39h11v5h-11M20 40h1v8h-1M41 40h4v6h-4M19 41h1v9h-1M18 42h1v8h-1M17 43h1v7h-1M16 44h1v6h-1M25 44h5v1h-5M34 44h4v1h-4M45 44h1v6h-1M28 45h1v1h-1M35 45h2v1h-2M42 46h3v1h-3M43 47h2v1h-2M44 48h1v2h-1M21 54h1v1h-1"/>' +
    '<path fill="#fff" d="M27 13h5v2h-5M25 14h2v3h-2M23 15h2v3h-2M27 15h2v1h-2M22 16h1v4h-1M21 17h1v4h-1M20 18h1v4h-1M23 18h1v1h-1M19 19h1v3h-1M24 28h2v3h-2M36 28h2v3h-2M24 37h1v1h-1M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M15 44h1v8h-1"/>' +
    '<path fill="#99c" d="M39 37h1v1h-1M22 38h2v7h-2M36 38h3v6h-3M40 38h2v1h-2M21 39h1v8h-1M41 39h3v1h-3M42 40h3v1h-3M43 41h3v1h-3M44 42h3v1h-3M45 43h3v1h-3M38 44h1v1h-1M46 44h2v6h-2M22 45h1v1h-1M20 46h1v2h-1M15 51h1v1h-1M42 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#c90" d="M31 47h2v1h-2M34 47h1v1h-1M24 48h2v1h-2M27 48h1v2h-1M33 48h1v2h-1M38 48h2v1h-2M41 48h1v2h-1M42 48h1v1h-1M26 49h1v2h-1M30 49h3v1h-3M40 49h1v2h-1M23 50h3v1h-3M37 50h3v1h-3M43 50h1v2h-1M41 51h2v2h-2M21 52h2v1h-2M24 52h17v1h-17M29 53h6v1h-6"/>' +
    '<path fill="#669" d="M30 4h1v2h-1M31 4h1v1h-1M28 5h1v3h-1M29 5h1v1h-1M27 7h1v2h-1M26 12h12v1h-12M24 13h3v1h-3M39 13h1v1h-1M22 14h3v1h-3M22 15h1v1h-1M41 24h1v1h-1M15 29h1v5h-1M14 34h1v8h-1"/>' +
    '<path fill="#c96" d="M37 34h4v2h-4M23 35h3v1h-3M34 35h5v2h-5M25 36h9v1h-9M28 37h8v1h-8M19 53h1v2h-1M47 53h1v1h-1M44 54h1v1h-1"/>' +
    '<path fill="#396" d="M25 38h2v1h-2M37 38h1v2h-1M38 38h1v1h-1M26 39h2v1h-2M36 39h1v5h-1M27 40h2v4h-2M35 40h1v4h-1M29 41h10v3h-10M25 42h2v2h-2"/>' +
    '<path fill="#f99" d="M21 15h1v2h-1M42 15h1v2h-1M19 17h2v1h-2M43 17h1v1h-1M22 32h3v2h-3M39 32h3v2h-3"/>' +
    '<path fill="#063" d="M30 40h4v2h-4M25 43h5v1h-5M34 43h5v1h-5"/>' +
    '<path fill="#369" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2"/>' +
    '<path fill="#6c9" d="M25 41h3v1h-3M31 41h2v2h-2M36 41h3v1h-3"/>' +
    '</svg>',
  // Doyen Wen : vieillard a barbe blanche, robe bordeaux a galons d'or, bonnet noir, canne
  elder_wen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M24 4h17v53h-17M23 5h6v54h-6M22 6h1v51h-1M21 8h22v27h-22M20 9h1v26h-1M19 11h26v22h-26M18 17h33v14h-33M17 18h2v15h-2M51 19h2v4h-2M16 20h1v11h-1M46 31h5v2h-5M43 33h2v2h-2M47 33h4v24h-4M41 35h2v22h-2M21 36h1v21h-1M20 38h25v19h-25M19 39h1v18h-1M18 40h1v15h-1M17 41h30v14h-30M16 42h1v13h-1M15 43h1v12h-1M14 44h1v9h-1M35 57h6v2h-6M50 57h1v2h-1"/>' +
    '<path fill="#ccc" d="M18 18h1v14h-1M17 20h1v10h-1M19 22h2v10h-2M40 22h4v3h-4M23 23h5v5h-5M36 23h6v2h-6M42 25h3v6h-3M42 31h2v2h-2M23 36h7v6h-7M35 36h4v8h-4M30 37h5v11h-5M25 42h5v2h-5M27 44h3v2h-3M29 46h1v2h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#336" d="M38 5h2v16h-2M25 6h13v15h-13M24 7h1v14h-1M40 8h1v13h-1M23 9h19v12h-19M22 10h1v11h-1M21 12h1v9h-1M20 16h1v5h-1"/>' +
    '<path fill="#fc9" d="M28 24h2v11h-2M34 24h2v11h-2M23 25h18v3h-18M22 27h2v5h-2M24 28h1v1h-1M27 28h10v1h-10M39 28h2v1h-2M25 29h2v5h-2M30 29h4v7h-4M37 29h2v5h-2M40 29h1v4h-1M24 30h16v4h-16M23 32h1v1h-1M26 34h11v1h-11M16 53h3v1h-3M44 53h3v1h-3"/>' +
    '<path fill="#933" d="M30 9h4v4h-4M20 40h1v12h-1M19 41h1v11h-1M42 41h3v11h-3M18 42h1v10h-1M41 42h5v8h-5M17 43h1v9h-1M16 44h1v8h-1M25 45h1v8h-1M38 45h1v8h-1M24 49h7v4h-7M34 49h6v4h-6M23 50h18v3h-18M21 53h1v2h-1M22 53h1v1h-1M29 53h6v1h-6M30 54h4v1h-4"/>' +
    '<path fill="#999" d="M45 18h1v12h-1M46 20h1v10h-1M44 21h1v6h-1M21 22h2v3h-2M23 22h1v1h-1M27 22h10v1h-10M20 23h1v10h-1M30 23h4v1h-4M21 25h1v2h-1M43 32h1v1h-1M22 33h1v2h-1M42 33h1v2h-1M23 34h1v2h-1M40 34h1v8h-1M24 35h2v1h-2M38 35h2v1h-2M27 36h3v1h-3M39 36h1v7h-1M41 36h1v2h-1M22 38h1v1h-1M38 38h1v6h-1M23 41h1v1h-1M24 42h1v1h-1M37 42h1v3h-1M25 43h1v1h-1M36 43h1v3h-1M26 44h1v1h-1M35 44h1v3h-1M27 45h1v1h-1M34 45h1v3h-1M28 46h1v1h-1M33 46h1v2h-1M29 47h2v1h-2M32 47h1v2h-1M31 48h1v1h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#fc3" d="M20 17h24v2h-24M47 18h3v2h-3M50 19h1v4h-1M48 20h2v4h-2M48 25h1v18h-1M24 47h4v2h-4M36 47h4v2h-4M16 50h6v2h-6M42 50h6v2h-6M22 52h20v1h-20M48 55h1v1h-1"/>' +
    '<path fill="#633" d="M21 39h1v11h-1M42 39h2v2h-2M43 41h2v1h-2M22 42h1v8h-1M44 42h3v1h-3M23 43h1v3h-1M45 43h3v1h-3M46 44h3v6h-3M40 45h1v1h-1M20 46h1v4h-1M24 48h5v1h-5M35 48h5v1h-5M30 49h1v1h-1M33 49h1v1h-1M39 49h1v1h-1M41 49h1v1h-1M40 50h1v1h-1M48 50h1v2h-1M15 51h1v1h-1M41 53h2v1h-2M42 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#333" d="M41 10h1v7h-1M42 11h1v6h-1M43 12h1v5h-1M23 19h21v2h-21M20 20h3v1h-3"/>' +
    '<path fill="#c90" d="M51 20h1v2h-1M50 21h1v2h-1M49 22h1v2h-1M48 23h1v1h-1M49 25h1v19h-1M49 52h1v4h-1"/>' +
    '<path fill="#669" d="M24 5h14v1h-14M23 6h1v3h-1M24 6h1v1h-1M22 8h1v2h-1M21 9h1v3h-1M20 11h1v5h-1"/>' +
    '<path fill="#c66" d="M31 10h2v2h-2M20 39h1v1h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M40 43h1v2h-1M15 44h1v7h-1M41 46h1v3h-1"/>' +
    '<path fill="#c96" d="M40 32h1v1h-1M39 33h1v1h-1M37 34h1v1h-1M19 53h1v2h-1M47 53h1v2h-1M44 54h1v1h-1"/>' +
    '<path fill="#fff" d="M19 21h1v1h-1M41 24h1v1h-1M22 36h1v2h-1M34 36h1v1h-1M23 39h1v2h-1"/>' +
    '<path fill="#fe6" d="M24 46h3v1h-3M37 46h3v1h-3"/>' +
    '</svg>',
  // Paysan Lin : chapeau conique de paille, houe, tunique d'indigo rapiecee
  farmer_lin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M31 3h2v54h-2M30 4h1v53h-1M29 5h6v52h-6M28 6h1v53h-1M26 7h13v50h-13M25 8h3v51h-3M24 9h1v50h-1M22 10h21v25h-21M21 11h1v24h-1M20 12h1v23h-1M19 13h26v20h-26M17 14h30v17h-30M16 15h1v16h-1M15 16h34v9h-34M13 17h2v42h-2M49 17h2v6h-2M10 18h45v5h-45M8 19h8v8h-8M55 19h2v4h-2M7 20h1v7h-1M4 21h3v4h-3M3 22h1v3h-1M54 23h1v2h-1M5 25h2v2h-2M11 27h2v32h-2M15 27h1v2h-1M47 30h2v1h-2M17 31h2v2h-2M46 31h1v2h-1M43 34h2v1h-2M23 35h18v22h-18M41 36h2v21h-2M22 37h1v20h-1M20 38h25v19h-25M19 39h1v18h-1M18 40h1v15h-1M17 41h30v14h-30M16 42h1v15h-1M15 43h34v12h-34M10 51h1v2h-1M49 52h2v1h-2M48 55h1v2h-1M23 57h1v2h-1M35 57h6v2h-6"/>' +
    '<path fill="#fc3" d="M32 5h1v19h-1M31 6h3v18h-3M30 7h5v17h-5M29 8h9v16h-9M27 9h2v15h-2M26 10h13v14h-13M25 11h17v13h-17M23 12h2v12h-2M22 13h21v11h-21M21 14h24v10h-24M20 15h26v9h-26M18 16h29v8h-29M17 17h32v6h-32M16 18h35v4h-35M10 19h44v3h-44M8 20h47v2h-47"/>' +
    '<path fill="#369" d="M14 24h1v4h-1M6 25h8v1h-8M11 26h3v1h-3M12 27h2v1h-2M26 28h14v1h-14M26 29h1v1h-1M38 29h1v1h-1M24 30h2v6h-2M36 30h2v7h-2M26 31h15v4h-15M27 38h1v15h-1M25 39h14v14h-14M20 40h1v12h-1M41 40h3v10h-3M19 41h1v11h-1M18 42h1v10h-1M17 43h1v8h-1M44 43h2v9h-2M16 44h1v6h-1M24 49h16v4h-16M23 51h18v2h-18M21 53h1v2h-1M29 53h6v1h-6M30 54h4v1h-4"/>' +
    '<path fill="#c96" d="M23 25h18v1h-18M23 26h1v9h-1M24 26h1v1h-1M27 26h10v1h-10M39 26h2v1h-2M22 27h1v7h-1M28 27h8v11h-8M40 27h1v8h-1M24 31h1v5h-1M27 31h10v6h-10M39 31h1v5h-1M25 32h15v4h-15M13 49h2v6h-2M12 50h4v4h-4M11 51h1v2h-1M17 53h2v1h-2M44 53h3v1h-3"/>' +
    '<path fill="#c90" d="M45 19h4v4h-4M49 19h1v3h-1M27 20h21v4h-21M50 20h2v2h-2M55 20h1v2h-1M8 21h1v1h-1M21 21h6v3h-6M52 21h3v1h-3M10 22h11v1h-11M15 23h6v1h-6"/>' +
    '<path fill="#930" d="M17 25h3v5h-3M42 25h3v6h-3M18 30h2v2h-2M42 31h1v2h-1M43 31h1v1h-1M28 33h8v2h-8M24 47h16v2h-16M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#630" d="M20 25h1v8h-1M21 25h1v2h-1M44 25h2v2h-2M45 27h1v3h-1M13 29h1v19h-1M36 33h1v4h-1M27 34h9v1h-9M30 45h4v5h-4M24 48h16v1h-16M29 55h1v1h-1M41 55h1v1h-1M13 56h1v2h-1M28 56h1v1h-1M40 56h1v1h-1M12 57h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#336" d="M39 37h1v1h-1M22 38h2v8h-2M36 38h3v3h-3M40 38h2v2h-2M21 39h2v11h-2M42 39h2v2h-2M37 41h2v1h-2M43 41h2v1h-2M44 42h2v1h-2M37 43h1v1h-1M45 43h2v1h-2M46 44h2v8h-2M40 45h1v1h-1M20 46h1v6h-1M39 49h1v1h-1M41 49h1v1h-1M40 50h1v1h-1M40 52h2v1h-2M41 53h2v1h-2M42 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#963" d="M37 34h2v3h-2M39 34h1v2h-1M40 34h1v1h-1M24 35h2v1h-2M34 35h2v3h-2M36 35h1v2h-1M25 36h9v1h-9M28 37h6v1h-6M16 51h1v2h-1M15 52h1v2h-1M14 53h1v2h-1M19 53h1v2h-1M47 53h1v1h-1M13 54h1v1h-1M16 54h1v1h-1M44 54h1v1h-1"/>' +
    '<path fill="#c63" d="M12 29h1v20h-1M27 33h1v1h-1M24 46h6v1h-6M31 46h2v3h-2M34 46h6v1h-6M12 55h1v2h-1"/>' +
    '<path fill="#fe6" d="M31 4h1v2h-1M30 5h1v2h-1M29 6h1v2h-1M28 7h1v2h-1M26 8h1v2h-1M27 8h1v1h-1M37 8h1v1h-1M25 9h1v2h-1M24 10h1v2h-1M22 11h1v2h-1M23 11h1v1h-1M41 11h1v1h-1M21 12h1v2h-1M20 13h1v2h-1M19 14h1v2h-1M17 15h1v2h-1M18 15h1v1h-1M16 16h1v2h-1M15 17h1v2h-1M13 18h2v1h-2"/>' +
    '<path fill="#fc9" d="M22 32h3v2h-3M39 32h3v2h-3M17 50h5v1h-5M42 50h6v2h-6M18 51h4v1h-4"/>' +
    '<path fill="#69c" d="M24 37h1v1h-1M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M38 42h1v4h-1M16 43h1v1h-1M15 44h1v5h-1M41 46h1v3h-1M23 50h3v1h-3M25 51h1v2h-1M22 52h1v2h-1"/>' +
    '<path fill="#9cf" d="M6 22h2v3h-2M25 38h2v1h-2M37 38h1v2h-1M38 38h1v1h-1M26 39h2v1h-2M36 39h1v2h-1M27 40h2v1h-2M35 40h1v2h-1M28 41h2v1h-2M34 41h1v2h-1M29 42h2v1h-2M33 42h1v2h-1M30 43h3v1h-3M31 44h2v1h-2"/>' +
    '<path fill="#999" d="M4 22h2v2h-2M6 23h4v2h-4M5 24h9v1h-9M9 25h4v1h-4"/>' +
    '<path fill="#fff" d="M24 28h2v2h-2M36 28h2v2h-2"/>' +
    '</svg>',
  // Passeur Gu : chapeau de pluie vert, cape de paille, perche de bambou
  ferryman_gu: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M31 3h2v54h-2M30 4h1v55h-1M29 5h6v52h-6M28 6h1v53h-1M26 7h13v50h-13M25 8h3v51h-3M24 9h1v50h-1M22 10h21v47h-21M21 11h1v24h-1M50 11h3v46h-3M20 12h1v23h-1M49 12h1v45h-1M19 13h26v20h-26M17 14h30v17h-30M16 15h1v16h-1M15 16h34v9h-34M13 17h2v6h-2M10 18h45v5h-45M8 19h49v4h-49M7 20h1v3h-1M54 23h1v2h-1M47 30h2v1h-2M17 31h2v2h-2M46 31h1v2h-1M43 34h2v1h-2M21 36h3v23h-3M20 37h25v20h-25M19 39h2v20h-2M18 40h1v19h-1M17 41h30v16h-30M16 42h2v17h-2M15 43h34v14h-34M14 44h1v9h-1M33 57h8v2h-8M42 57h1v2h-1M44 57h5v2h-5M52 57h1v2h-1"/>' +
    '<path fill="#960" d="M24 37h1v1h-1M25 38h3v15h-3M36 38h3v15h-3M28 39h8v14h-8M20 40h1v12h-1M41 40h3v10h-3M19 41h1v11h-1M18 42h1v10h-1M17 43h1v9h-1M44 43h2v9h-2M16 44h1v8h-1M24 46h16v7h-16M23 50h18v3h-18M43 50h1v2h-1M22 52h1v2h-1M41 52h1v2h-1M21 53h1v2h-1M29 53h6v1h-6M42 53h1v2h-1M30 54h4v1h-4M20 55h1v1h-1M31 55h2v1h-2M17 56h1v2h-1M19 56h1v1h-1M45 56h1v2h-1M47 56h1v2h-1"/>' +
    '<path fill="#693" d="M32 5h1v19h-1M31 6h3v18h-3M30 7h5v17h-5M29 8h9v16h-9M27 9h2v15h-2M26 10h13v14h-13M25 11h17v13h-17M23 12h2v12h-2M22 13h21v11h-21M21 14h24v10h-24M20 15h26v9h-26M18 16h29v8h-29M17 17h32v7h-32M16 18h35v5h-35M10 19h44v3h-44M8 20h47v2h-47"/>' +
    '<path fill="#363" d="M51 12h1v6h-1M45 19h4v5h-4M49 19h1v4h-1M27 20h18v4h-18M50 20h2v3h-2M55 20h1v2h-1M8 21h1v1h-1M21 21h6v3h-6M52 21h3v1h-3M15 22h38v1h-38M16 23h5v1h-5M51 24h1v32h-1M50 32h1v24h-1"/>' +
    '<path fill="#c96" d="M23 25h18v1h-18M23 26h1v10h-1M24 26h1v1h-1M27 26h10v1h-10M39 26h2v1h-2M22 27h1v8h-1M28 27h8v11h-8M40 27h1v9h-1M24 31h16v5h-16M16 53h3v2h-3M44 53h3v2h-3"/>' +
    '<path fill="#630" d="M41 36h1v1h-1M39 37h1v1h-1M42 37h1v1h-1M22 38h2v8h-2M38 38h1v1h-1M40 38h2v2h-2M21 39h2v11h-2M42 39h2v2h-2M43 41h2v1h-2M44 42h2v1h-2M45 43h2v1h-2M46 44h3v8h-3M40 45h1v1h-1M20 46h2v6h-2M41 49h1v1h-1M19 50h1v2h-1M15 51h4v1h-4M42 51h4v1h-4M43 55h1v1h-1M16 56h1v1h-1M18 56h1v1h-1M44 56h1v1h-1M46 56h1v1h-1"/>' +
    '<path fill="#336" d="M17 25h3v5h-3M42 25h3v6h-3M18 30h2v2h-2M42 31h1v2h-1M43 31h1v1h-1M28 33h8v2h-8M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#9c6" d="M31 4h1v2h-1M30 5h1v2h-1M29 6h1v2h-1M28 7h1v2h-1M26 8h1v2h-1M27 8h1v1h-1M37 8h1v1h-1M25 9h1v2h-1M24 10h1v2h-1M22 11h1v2h-1M23 11h1v1h-1M41 11h1v1h-1M21 12h1v2h-1M50 12h1v5h-1M20 13h1v2h-1M19 14h1v2h-1M17 15h1v2h-1M18 15h1v1h-1M16 16h1v2h-1M15 17h1v2h-1M13 18h2v1h-2M50 24h1v8h-1M50 33h1v11h-1M50 45h1v11h-1"/>' +
    '<path fill="#963" d="M37 34h4v2h-4M23 35h3v1h-3M34 35h5v2h-5M25 36h9v1h-9M28 37h8v1h-8M19 53h1v2h-1M47 53h1v2h-1M16 54h3v1h-3M44 54h3v1h-3"/>' +
    '<path fill="#333" d="M20 25h1v8h-1M21 25h1v2h-1M44 25h2v2h-2M45 27h1v3h-1M36 33h1v2h-1M27 34h9v1h-9M42 34h1v1h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#c90" d="M22 36h1v1h-1M21 37h1v1h-1M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M15 44h1v7h-1M41 46h1v3h-1M42 50h1v1h-1"/>' +
    '<path fill="#369" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2"/>' +
    '<path fill="#f99" d="M22 32h3v2h-3M39 32h3v2h-3"/>' +
    '<path fill="#fff" d="M24 28h2v2h-2M36 28h2v2h-2"/>' +
    '<path fill="#669" d="M27 33h1v1h-1"/>' +
    '</svg>',
  // Tisserande Mei : robe rose, deux chignons fleuris, metier a tisser
  weaver_mei: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M16 8h5v23h-5M44 8h3v23h-3M47 8h2v11h-2M14 9h9v10h-9M42 9h9v10h-9M13 10h1v9h-1M41 10h2v25h-2M26 11h13v46h-13M12 12h29v5h-29M51 16h2v1h-2M48 19h1v2h-1M24 22h17v35h-17M23 23h6v36h-6M22 25h23v8h-23M49 25h12v32h-12M47 26h2v5h-2M21 27h2v8h-2M61 29h2v2h-2M17 31h3v2h-3M46 31h1v2h-1M48 31h3v28h-3M20 33h1v2h-1M43 34h2v1h-2M41 36h2v21h-2M22 37h1v20h-1M20 38h25v19h-25M19 39h1v18h-1M18 40h1v15h-1M17 41h30v14h-30M16 42h32v13h-32M15 43h1v12h-1M14 44h1v9h-1M61 53h2v2h-2M35 57h6v2h-6M59 57h4v2h-4"/>' +
    '<path fill="#336" d="M18 9h2v7h-2M46 9h2v9h-2M17 10h5v4h-5M45 10h5v7h-5M15 11h3v7h-3M43 11h2v4h-2M14 13h1v5h-1M32 13h8v9h-8M42 13h1v1h-1M13 14h1v2h-1M40 14h2v9h-2M29 15h14v7h-14M44 15h1v1h-1M27 16h17v6h-17M19 17h2v15h-2M25 17h2v5h-2M18 18h1v14h-1M24 18h1v4h-1M23 19h1v4h-1M17 20h1v10h-1M42 22h3v9h-3M41 23h1v2h-1M42 31h1v2h-1M43 31h1v1h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#fc9" d="M24 24h6v2h-6M34 24h2v14h-2M36 24h4v2h-4M23 25h18v1h-18M24 26h1v1h-1M27 26h10v1h-10M39 26h1v1h-1M22 27h2v7h-2M28 27h6v7h-6M40 27h1v8h-1M53 29h6v27h-6M24 31h5v5h-5M36 31h4v5h-4M23 34h1v1h-1M30 34h2v1h-2M33 34h1v4h-1M29 35h1v3h-1M32 35h1v3h-1M16 53h3v1h-3M44 53h3v1h-3"/>' +
    '<path fill="#c69" d="M27 38h1v15h-1M25 39h14v14h-14M20 40h1v12h-1M41 40h3v10h-3M19 41h1v11h-1M18 42h1v10h-1M17 43h1v9h-1M44 43h2v9h-2M16 44h1v8h-1M51 48h9v5h-9M24 49h16v4h-16M23 50h18v3h-18M21 53h1v2h-1M22 53h1v1h-1M29 53h6v1h-6M30 54h4v1h-4"/>' +
    '<path fill="#936" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2M39 37h1v1h-1M22 38h2v8h-2M36 38h3v3h-3M40 38h2v2h-2M21 39h2v11h-2M42 39h2v2h-2M37 41h2v1h-2M43 41h2v1h-2M38 42h1v3h-1M44 42h3v1h-3M37 43h1v1h-1M45 43h3v1h-3M46 44h3v8h-3M30 45h4v5h-4M40 45h1v1h-1M20 46h1v6h-1M24 48h16v1h-16M39 49h1v1h-1M41 49h1v1h-1M40 50h1v1h-1M15 51h1v1h-1M41 53h2v1h-2M42 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#fc3" d="M16 13h2v3h-2M46 13h2v5h-2M50 26h10v3h-10M25 38h2v1h-2M37 38h1v2h-1M38 38h1v1h-1M26 39h2v1h-2M36 39h1v2h-1M27 40h2v1h-2M35 40h1v2h-1M28 41h2v1h-2M34 41h1v2h-1M29 42h2v1h-2M33 42h1v2h-1M30 43h3v1h-3M31 44h2v1h-2M24 47h6v1h-6M34 47h6v1h-6M16 50h6v2h-6M42 50h6v2h-6M22 52h20v1h-20M50 54h10v2h-10"/>' +
    '<path fill="#333" d="M21 10h1v1h-1M49 10h1v1h-1M21 12h1v2h-1M22 12h1v1h-1M49 12h1v6h-1M20 14h1v1h-1M48 15h1v3h-1M18 16h1v1h-1M46 16h2v2h-2M14 17h1v1h-1M16 17h1v2h-1M17 17h1v1h-1M44 17h1v10h-1M45 18h1v12h-1M34 19h3v4h-3M22 20h2v3h-2M24 20h1v2h-1M26 20h1v2h-1M31 20h3v4h-3M37 20h1v2h-1M21 21h18v1h-18M21 22h1v5h-1M27 22h4v1h-4M20 23h1v10h-1M22 23h1v2h-1M30 23h1v1h-1M46 26h1v4h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#f9c" d="M16 12h2v1h-2M46 12h2v1h-2M15 13h1v2h-1M18 13h1v2h-1M45 13h1v2h-1M48 13h1v2h-1M16 15h2v1h-2M46 15h2v1h-2M22 32h3v2h-3M39 32h3v2h-3M24 37h1v1h-1M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M15 44h1v7h-1M51 44h8v4h-8M41 46h1v3h-1M51 50h8v4h-8"/>' +
    '<path fill="#fe6" d="M49 26h1v3h-1M49 30h1v14h-1M59 30h1v23h-1M24 46h6v1h-6M31 46h2v3h-2M34 46h6v1h-6M49 52h1v1h-1M49 54h1v3h-1"/>' +
    '<path fill="#ffc" d="M51 29h2v15h-2M55 29h2v15h-2"/>' +
    '<path fill="#fff" d="M27 13h5v2h-5M25 14h2v3h-2M23 15h2v3h-2M27 15h2v1h-2M22 16h1v4h-1M21 17h1v4h-1M20 18h1v4h-1M23 18h1v1h-1M19 19h1v3h-1M24 28h2v2h-2M36 28h2v2h-2"/>' +
    '<path fill="#669" d="M16 9h1v2h-1M17 9h1v1h-1M44 9h1v2h-1M45 9h1v1h-1M14 10h1v3h-1M15 10h1v1h-1M42 10h1v3h-1M43 10h1v1h-1M13 12h1v2h-1M26 12h12v1h-12M41 12h1v1h-1M24 13h3v1h-3M39 13h1v1h-1M22 14h3v1h-3M21 15h1v2h-1M22 15h1v1h-1M20 16h1v1h-1M41 24h1v1h-1"/>' +
    '<path fill="#c96" d="M37 34h2v3h-2M39 34h1v2h-1M40 34h1v1h-1M24 35h2v1h-2M34 35h2v3h-2M36 35h1v2h-1M25 36h9v1h-9M28 37h6v1h-6M19 53h1v2h-1M47 53h1v1h-1M44 54h1v1h-1"/>' +
    '<path fill="#c90" d="M49 28h11v1h-11M50 30h1v23h-1M49 56h2v1h-2M59 56h1v1h-1"/>' +
    '</svg>',
  // Moine Zhen : crane rase, robe safran, kasaya rouge, mains jointes, chapelet
  monk_zhen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M28 13h9v44h-9M25 14h14v43h-14M23 15h18v42h-18M22 16h1v19h-1M21 17h22v18h-22M20 18h1v15h-1M19 19h26v14h-26M18 21h1v10h-1M17 23h30v6h-30M22 37h21v20h-21M20 38h25v19h-25M19 39h1v18h-1M18 40h1v15h-1M17 41h30v14h-30M16 42h1v13h-1M15 43h34v12h-34M14 44h1v9h-1M49 52h2v1h-2M48 55h1v2h-1M23 57h6v2h-6M35 57h6v2h-6"/>' +
    '<path fill="#c96" d="M30 15h6v19h-6M36 15h3v8h-3M39 16h1v7h-1M27 17h14v6h-14M25 18h17v5h-17M24 19h19v4h-19M23 20h21v3h-21M22 21h1v13h-1M20 22h2v10h-2M28 23h2v11h-2M41 23h3v9h-3M19 24h1v7h-1M23 25h18v4h-18M23 29h1v6h-1M25 29h2v1h-2M37 29h2v1h-2M40 29h1v6h-1M24 30h1v6h-1M27 30h2v7h-2M36 30h1v7h-1M39 30h1v6h-1M25 31h14v3h-14M21 32h1v1h-1M25 34h2v3h-2M30 34h2v1h-2M33 34h3v4h-3M29 35h1v3h-1M32 35h1v3h-1M30 47h4v6h-4M28 48h7v4h-7M16 53h3v1h-3M44 53h3v1h-3"/>' +
    '<path fill="#f90" d="M34 39h3v1h-3M20 40h1v12h-1M35 40h1v1h-1M41 40h3v10h-3M19 41h1v11h-1M18 42h1v10h-1M37 42h1v1h-1M17 43h1v9h-1M44 43h2v9h-2M16 44h1v8h-1M24 47h1v6h-1M25 48h1v5h-1M26 49h1v4h-1M23 50h1v3h-1M22 52h1v2h-1M27 52h1v1h-1M21 53h1v2h-1M29 53h1v1h-1M30 54h4v1h-4"/>' +
    '<path fill="#c33" d="M25 38h3v9h-3M28 39h5v7h-5M33 43h3v3h-3M28 46h2v1h-2M34 46h3v1h-3M27 47h1v1h-1M36 47h2v1h-2M37 48h3v5h-3M16 50h6v2h-6M40 50h1v3h-1M42 50h6v2h-6M36 52h6v1h-6M41 53h1v1h-1"/>' +
    '<path fill="#963" d="M43 20h1v1h-1M44 23h1v6h-1M45 24h1v4h-1M43 27h1v5h-1M42 29h1v4h-1M41 31h1v3h-1M37 34h2v3h-2M39 34h1v2h-1M40 34h1v1h-1M24 35h2v1h-2M34 35h2v3h-2M36 35h1v2h-1M25 36h9v1h-9M28 37h6v1h-6M26 40h2v2h-2M36 40h2v2h-2M28 43h2v2h-2M34 43h2v2h-2M31 45h2v1h-2M35 48h1v4h-1M28 51h1v1h-1M33 51h1v2h-1M34 51h1v1h-1M30 52h3v1h-3M19 53h1v2h-1M47 53h1v1h-1M44 54h1v1h-1"/>' +
    '<path fill="#c60" d="M39 37h1v1h-1M22 38h2v8h-2M36 38h3v1h-3M40 38h2v2h-2M21 39h2v11h-2M37 39h2v1h-2M42 39h2v2h-2M38 40h1v4h-1M43 41h2v1h-2M44 42h2v1h-2M45 43h2v1h-2M46 44h2v6h-2M40 45h1v1h-1M20 46h1v4h-1M41 49h1v1h-1M15 51h1v1h-1M20 55h1v1h-1M31 55h2v1h-2"/>' +
    '<path fill="#fc9" d="M28 14h8v1h-8M25 15h5v2h-5M37 15h2v1h-2M23 16h2v3h-2M22 17h1v4h-1M25 17h2v1h-2M21 18h1v4h-1M20 19h1v3h-1M23 19h1v1h-1M19 21h1v3h-1M18 23h1v6h-1M19 30h1v1h-1"/>' +
    '<path fill="#336" d="M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#933" d="M30 39h3v1h-3M31 40h3v1h-3M32 41h3v1h-3M33 42h3v1h-3M36 43h1v3h-1M37 44h1v3h-1M38 45h1v3h-1M25 46h1v1h-1M39 46h1v3h-1M26 47h1v1h-1M34 53h1v1h-1M42 53h1v2h-1M43 55h1v1h-1"/>' +
    '<path fill="#fc3" d="M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M15 44h1v7h-1M41 46h1v3h-1"/>' +
    '<path fill="#f99" d="M22 32h3v2h-3M39 32h3v2h-3"/>' +
    '<path fill="#333" d="M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '</svg>',
  // Herboriste Xu : bandeau et tablier verts, chignon, plante en pot, gourde
  herbalist_xu: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M30 3h5v54h-5M28 4h9v53h-9M27 5h2v54h-2M26 7h1v52h-1M37 11h2v48h-2M24 12h17v45h-17M22 13h21v22h-21M21 14h1v21h-1M20 15h1v20h-1M19 16h26v17h-26M18 17h1v16h-1M17 18h30v13h-30M16 20h1v11h-1M47 30h2v1h-2M17 31h1v2h-1M46 31h1v2h-1M43 34h2v1h-2M11 35h2v24h-2M23 35h3v24h-3M10 36h1v11h-1M41 36h2v21h-2M9 37h6v10h-6M22 37h1v20h-1M7 38h2v21h-2M20 38h25v19h-25M6 39h1v18h-1M19 39h1v18h-1M5 40h12v7h-12M18 40h1v15h-1M4 41h43v6h-43M50 42h3v15h-3M47 43h3v12h-3M53 45h2v4h-2M14 47h33v8h-33M9 48h8v11h-8M5 50h50v3h-50M54 53h1v2h-1M53 54h1v1h-1M46 55h1v2h-1M48 55h2v2h-2M35 57h6v2h-6"/>' +
    '<path fill="#693" d="M20 17h24v5h-24M19 18h26v4h-26M11 36h1v7h-1M10 37h3v5h-3M13 38h1v3h-1M25 38h2v1h-2M37 38h2v1h-2M7 39h1v10h-1M28 39h9v14h-9M6 40h1v7h-1M9 40h2v5h-2M14 41h2v2h-2M27 41h1v12h-1M5 42h1v4h-1M13 42h1v6h-1M12 43h1v4h-1M14 43h1v1h-1M10 45h1v1h-1M26 45h1v8h-1M25 49h1v4h-1M29 53h6v1h-6"/>' +
    '<path fill="#336" d="M32 4h2v7h-2M31 5h5v6h-5M29 6h2v5h-2M28 8h1v3h-1M27 9h1v2h-1M32 13h8v4h-8M40 14h2v3h-2M29 15h3v2h-3M27 16h16v1h-16M17 20h4v10h-4M25 20h19v2h-19M40 22h4v1h-4M41 23h3v2h-3M42 25h3v6h-3M18 30h2v2h-2M42 31h1v2h-1M43 31h1v1h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#fc9" d="M24 24h6v2h-6M34 24h2v14h-2M36 24h4v2h-4M23 25h18v1h-18M24 26h1v1h-1M27 26h10v1h-10M39 26h1v1h-1M22 27h2v7h-2M28 27h6v7h-6M40 27h1v8h-1M24 31h5v5h-5M36 31h4v5h-4M23 34h1v1h-1M30 34h2v1h-2M33 34h1v4h-1M29 35h1v3h-1M32 35h1v3h-1M49 49h1v7h-1M16 50h6v2h-6M42 50h4v2h-4M46 50h1v1h-1M48 50h1v5h-1M47 51h1v3h-1M16 53h3v1h-3M44 53h2v1h-2"/>' +
    '<path fill="#c63" d="M25 39h1v2h-1M20 40h1v10h-1M41 40h3v10h-3M19 41h1v9h-1M18 42h1v8h-1M17 43h1v7h-1M44 43h2v7h-2M16 44h1v6h-1M7 50h7v6h-7M14 52h1v6h-1M22 52h1v1h-1M21 53h1v2h-1M9 56h5v2h-5"/>' +
    '<path fill="#333" d="M35 5h1v1h-1M35 7h1v4h-1M34 9h1v2h-1M22 20h2v3h-2M24 20h1v2h-1M26 20h1v2h-1M31 20h6v3h-6M37 20h1v2h-1M44 20h2v7h-2M21 21h18v1h-18M21 22h1v5h-1M27 22h4v1h-4M20 23h1v10h-1M22 23h1v2h-1M30 23h4v1h-4M45 27h1v3h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#933" d="M39 37h1v1h-1M22 38h2v8h-2M40 38h2v2h-2M21 39h2v11h-2M38 39h1v2h-1M42 39h2v2h-2M43 41h2v1h-2M44 42h2v1h-2M45 43h2v1h-2M50 43h2v5h-2M46 44h1v6h-1M47 44h1v1h-1M40 45h1v1h-1M20 46h1v4h-1M41 49h1v1h-1M47 49h1v1h-1M6 51h1v1h-1M15 51h1v1h-1M41 52h1v1h-1M42 53h1v2h-1M7 55h1v1h-1M15 55h1v3h-1M20 55h1v1h-1M43 55h1v1h-1M14 56h1v2h-1M8 57h6v1h-6"/>' +
    '<path fill="#363" d="M18 19h28v1h-28M34 39h3v2h-3M13 40h1v1h-1M35 41h3v3h-3M36 44h2v5h-2M8 45h1v2h-1M38 45h1v8h-1M7 48h1v1h-1M37 49h3v4h-3M30 54h4v1h-4"/>' +
    '<path fill="#c96" d="M37 34h2v3h-2M39 34h1v2h-1M40 34h1v1h-1M24 35h2v1h-2M34 35h2v3h-2M36 35h1v2h-1M25 36h9v1h-9M28 37h6v1h-6M53 46h1v2h-1M52 47h1v1h-1M53 52h1v2h-1M19 53h1v2h-1M52 53h1v2h-1M16 54h1v1h-1M44 54h1v1h-1M51 54h1v2h-1M50 55h1v1h-1"/>' +
    '<path fill="#fc3" d="M49 44h3v4h-3M48 45h1v4h-1M52 45h1v2h-1M50 49h2v5h-2M49 50h1v6h-1M52 50h1v3h-1M48 51h3v4h-3M53 51h1v1h-1M47 52h1v2h-1"/>' +
    '<path fill="#fff" d="M27 13h5v2h-5M25 14h2v3h-2M23 15h2v2h-2M27 15h2v1h-2M22 16h1v1h-1M19 20h2v2h-2M21 20h1v1h-1M24 28h2v3h-2M36 28h2v3h-2"/>' +
    '<path fill="#669" d="M30 4h1v2h-1M31 4h1v1h-1M28 5h1v3h-1M29 5h1v1h-1M27 7h1v2h-1M26 12h12v1h-12M24 13h3v1h-3M39 13h1v1h-1M22 14h3v1h-3M21 15h1v2h-1M22 15h1v1h-1M20 16h1v1h-1M41 24h1v1h-1"/>' +
    '<path fill="#f96" d="M24 37h1v1h-1M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M15 44h1v7h-1M41 46h1v3h-1M6 50h1v1h-1M7 52h1v3h-1M8 56h1v1h-1"/>' +
    '<path fill="#9c6" d="M19 17h1v1h-1M18 18h1v1h-1M9 39h1v1h-1M27 39h1v2h-1M5 41h1v1h-1M26 41h1v4h-1M25 45h1v4h-1M24 49h1v4h-1"/>' +
    '<path fill="#396" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2"/>' +
    '<path fill="#f99" d="M22 32h3v2h-3M39 32h3v2h-3"/>' +
    '</svg>',
  // Marchand Ma : robe de brocart pourpre, bonnet pointu a fourrure, barbe noire, ballot et balance
  merchant_ma: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M30 2h3v55h-3M29 3h8v54h-8M28 4h1v55h-1M27 5h12v52h-12M26 6h2v53h-2M25 7h16v50h-16M24 8h2v51h-2M23 9h1v50h-1M22 10h21v47h-21M21 11h1v24h-1M20 14h1v21h-1M19 16h26v17h-26M18 17h29v16h-29M17 18h1v15h-1M16 20h1v11h-1M47 20h2v3h-2M47 29h12v4h-12M43 33h4v2h-4M48 33h3v22h-3M52 33h1v2h-1M58 33h1v2h-1M21 36h24v21h-24M56 36h3v5h-3M45 37h2v18h-2M54 37h7v4h-7M20 38h1v19h-1M53 38h1v3h-1M19 39h1v18h-1M18 40h1v15h-1M9 41h6v16h-6M17 41h1v14h-1M58 41h1v2h-1M7 42h41v13h-41M6 43h1v12h-1M5 44h1v11h-1M4 46h1v7h-1M48 55h1v2h-1M15 56h2v1h-2M35 57h6v2h-6"/>' +
    '<path fill="#939" d="M31 4h5v13h-5M30 5h7v12h-7M29 6h9v11h-9M28 7h11v10h-11M27 8h13v9h-13M26 9h1v8h-1M25 10h16v7h-16M24 11h1v6h-1M23 12h1v5h-1M22 15h1v2h-1M21 16h1v1h-1M20 40h1v12h-1M19 41h1v11h-1M18 42h1v10h-1M41 42h5v8h-5M17 43h1v9h-1M16 44h1v8h-1M25 45h1v8h-1M38 45h1v8h-1M24 49h7v4h-7M34 49h6v4h-6M23 50h18v3h-18M22 52h1v2h-1M21 53h1v2h-1M29 53h6v1h-6M30 54h4v1h-4"/>' +
    '<path fill="#336" d="M17 20h1v10h-1M18 22h1v10h-1M19 23h1v9h-1M41 23h3v2h-3M42 25h3v7h-3M42 32h2v1h-2M23 36h7v6h-7M35 36h4v8h-4M30 37h5v11h-5M25 42h5v2h-5M27 44h3v2h-3M29 46h1v2h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#fc3" d="M30 8h4v4h-4M47 30h10v2h-10M43 37h1v4h-1M56 37h2v3h-2M42 38h3v2h-3M54 38h5v2h-5M10 43h4v13h-4M14 43h1v1h-1M8 44h2v10h-2M7 45h1v9h-1M6 47h1v7h-1M24 47h4v2h-4M36 47h4v2h-4M16 50h6v2h-6M42 50h6v2h-6M5 51h1v1h-1"/>' +
    '<path fill="#c96" d="M28 24h2v11h-2M34 24h2v11h-2M23 25h18v1h-18M23 26h1v7h-1M24 26h1v1h-1M27 26h10v1h-10M39 26h2v1h-2M22 27h1v5h-1M30 27h4v9h-4M40 27h1v6h-1M24 31h16v3h-16M26 34h11v1h-11M16 53h3v1h-3M44 53h3v1h-3"/>' +
    '<path fill="#333" d="M46 20h1v2h-1M45 22h1v10h-1M20 23h1v10h-1M21 23h1v4h-1M22 23h1v2h-1M30 23h4v1h-4M44 23h1v4h-1M46 29h1v1h-1M44 31h1v1h-1M43 32h1v1h-1M22 33h1v2h-1M42 33h1v2h-1M23 34h1v2h-1M40 34h1v8h-1M24 35h2v1h-2M38 35h2v1h-2M27 36h3v1h-3M39 36h1v7h-1M41 36h1v2h-1M22 38h1v1h-1M38 38h1v6h-1M23 41h1v1h-1M24 42h1v1h-1M37 42h1v3h-1M25 43h1v1h-1M36 43h1v3h-1M26 44h1v1h-1M35 44h1v3h-1M27 45h1v1h-1M34 45h1v3h-1M28 46h1v1h-1M33 46h1v2h-1M29 47h2v1h-2M32 47h1v2h-1M31 48h1v1h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#636" d="M40 10h1v4h-1M41 11h1v6h-1M42 16h1v1h-1M21 39h1v11h-1M44 41h2v2h-2M22 42h1v8h-1M46 42h1v8h-1M23 43h1v3h-1M45 43h3v1h-3M47 44h1v6h-1M40 45h1v1h-1M20 46h1v4h-1M24 48h5v1h-5M35 48h5v1h-5M30 49h1v1h-1M33 49h1v1h-1M39 49h1v1h-1M41 49h1v1h-1M40 50h1v1h-1M15 51h1v1h-1M40 52h2v1h-2M41 53h2v1h-2M42 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#fff" d="M19 18h25v4h-25M24 28h2v3h-2M36 28h2v3h-2"/>' +
    '<path fill="#c9c" d="M30 3h3v1h-3M29 4h1v2h-1M30 4h1v1h-1M34 4h2v1h-2M28 5h1v2h-1M27 6h1v2h-1M26 7h1v2h-1M25 8h1v2h-1M24 9h1v2h-1M23 10h1v2h-1M22 11h1v4h-1M21 14h1v2h-1M20 39h1v1h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M40 43h1v2h-1M15 44h1v7h-1M41 46h1v3h-1"/>' +
    '<path fill="#fe6" d="M31 9h2v2h-2M49 34h1v20h-1M7 43h3v1h-3M6 44h1v3h-1M7 44h1v1h-1M5 46h1v5h-1M24 46h3v1h-3M37 46h3v1h-3"/>' +
    '<path fill="#c90" d="M57 30h1v2h-1M46 32h1v1h-1M48 32h3v1h-3M45 38h1v2h-1M59 38h1v2h-1M43 39h1v2h-1M44 39h1v1h-1M54 39h1v1h-1M57 39h2v1h-2M42 40h1v1h-1M12 52h3v3h-3M10 53h4v3h-4M9 54h1v1h-1"/>' +
    '<path fill="#ccc" d="M44 18h1v4h-1M19 21h25v1h-25"/>' +
    '<path fill="#630" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2"/>' +
    '<path fill="#963" d="M40 32h1v1h-1M39 33h1v1h-1M37 34h1v1h-1M19 53h1v2h-1M47 53h1v1h-1M44 54h1v1h-1"/>' +
    '<path fill="#669" d="M41 24h1v1h-1M22 36h1v2h-1M34 36h1v1h-1M23 39h1v2h-1"/>' +
    '</svg>',
  // Guide Dawa : turban creme a bandeau turquoise, tunique de sable, baton a fanion
  guide_dawa: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M26 10h13v47h-13M24 11h17v46h-17M22 12h21v23h-21M21 13h1v22h-1M20 14h1v19h-1M19 15h26v18h-26M18 16h1v15h-1M17 17h34v12h-34M16 19h37v4h-37M15 21h1v2h-1M53 23h4v6h-4M57 24h2v3h-2M59 26h2v3h-2M52 28h1v3h-1M47 29h4v28h-4M51 29h1v2h-1M23 35h6v24h-6M22 37h21v20h-21M20 38h25v19h-25M19 39h1v18h-1M18 40h1v15h-1M17 41h30v14h-30M16 42h1v13h-1M15 43h1v12h-1M14 44h1v9h-1M35 57h6v2h-6M50 57h1v2h-1"/>' +
    '<path fill="#c96" d="M20 23h3v9h-3M28 23h8v11h-8M41 23h3v9h-3M19 24h1v7h-1M23 25h18v1h-18M23 26h1v9h-1M24 26h1v1h-1M27 26h10v1h-10M39 26h2v1h-2M40 27h1v8h-1M24 31h5v5h-5M36 31h4v5h-4M21 32h1v1h-1M30 34h2v1h-2M33 34h3v4h-3M29 35h1v3h-1M32 35h1v3h-1M20 40h1v12h-1M41 40h3v10h-3M19 41h1v11h-1M18 42h1v10h-1M17 43h1v9h-1M25 43h14v3h-14M44 43h2v9h-2M16 44h1v8h-1M23 51h18v2h-18M22 52h1v2h-1M16 53h3v1h-3M21 53h1v2h-1M29 53h6v1h-6M44 53h3v1h-3M30 54h4v1h-4"/>' +
    '<path fill="#399" d="M17 20h30v2h-30M51 23h2v5h-2M53 24h3v4h-3M56 25h1v2h-1M57 25h1v1h-1M51 28h1v1h-1M25 38h3v4h-3M36 38h3v4h-3M28 39h11v3h-11M24 47h16v3h-16"/>' +
    '<path fill="#963" d="M44 23h2v5h-2M43 27h1v5h-1M44 28h1v1h-1M42 29h1v4h-1M41 31h1v3h-1M37 34h2v3h-2M39 34h1v2h-1M40 34h1v1h-1M24 35h2v1h-2M34 35h2v3h-2M36 35h1v2h-1M25 36h9v1h-9M28 37h6v1h-6M22 38h2v8h-2M40 38h2v2h-2M21 39h2v11h-2M42 39h2v2h-2M43 41h2v1h-2M44 42h3v1h-3M38 43h1v2h-1M45 43h3v1h-3M46 44h3v8h-3M40 45h1v1h-1M20 46h1v6h-1M41 49h1v1h-1M15 51h1v1h-1M40 52h2v1h-2M19 53h1v2h-1M41 53h2v1h-2M47 53h1v2h-1M42 54h1v1h-1M44 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#ffc" d="M32 12h8v8h-8M28 13h14v7h-14M26 14h2v6h-2M24 15h19v5h-19M23 16h21v4h-21M18 17h27v3h-27"/>' +
    '<path fill="#fc9" d="M44 17h1v1h-1M45 18h1v2h-1M16 21h1v1h-1M47 21h1v1h-1M18 23h1v6h-1M19 23h1v1h-1M19 30h1v1h-1M20 39h1v1h-1M40 39h1v6h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M15 44h1v7h-1M41 46h1v3h-1M16 50h6v2h-6M42 50h6v2h-6"/>' +
    '<path fill="#fff" d="M26 11h6v2h-6M32 11h6v1h-6M24 12h2v3h-2M39 12h1v1h-1M22 13h2v3h-2M26 13h2v1h-2M21 14h1v4h-1M20 15h1v5h-1M19 16h4v1h-4M19 18h1v3h-1M18 20h1v2h-1M24 28h2v3h-2M36 28h2v3h-2"/>' +
    '<path fill="#6cc" d="M17 19h2v1h-2M20 19h27v1h-27M26 42h12v2h-12"/>' +
    '<path fill="#fc3" d="M30 17h4v4h-4M47 18h3v1h-3M48 19h3v2h-3M49 21h1v3h-1M48 22h1v2h-1M48 25h1v18h-1M48 55h1v1h-1"/>' +
    '<path fill="#336" d="M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#c90" d="M51 20h1v2h-1M50 21h1v2h-1M49 22h1v2h-1M47 23h2v1h-2M49 25h1v19h-1M49 52h1v4h-1"/>' +
    '<path fill="#396" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2"/>' +
    '<path fill="#f99" d="M22 32h3v2h-3M39 32h3v2h-3"/>' +
    '<path fill="#333" d="M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#fe6" d="M31 18h2v2h-2"/>' +
    '</svg>',
  // Forgeron Tie : bras nus, tablier de cuir, marteau et fleche rouge
  smith_tie: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M29 5h6v52h-6M28 6h1v53h-1M27 10h10v47h-10M26 11h13v46h-13M24 12h17v45h-17M22 13h21v22h-21M21 14h1v21h-1M12 15h3v44h-3M20 15h1v20h-1M11 16h1v9h-1M19 16h26v17h-26M18 17h1v16h-1M10 18h1v7h-1M17 18h30v13h-30M15 20h2v5h-2M9 21h48v4h-48M8 23h1v2h-1M16 25h41v6h-41M11 26h1v33h-1M57 30h2v1h-2M17 31h1v2h-1M46 31h5v2h-5M47 33h4v24h-4M43 34h2v1h-2M23 35h5v24h-5M41 36h2v1h-2M21 38h22v19h-22M19 39h26v18h-26M18 40h1v17h-1M17 41h30v16h-30M16 42h1v15h-1M15 43h1v12h-1M21 57h2v2h-2M30 57h1v2h-1M33 57h8v2h-8M42 57h1v2h-1M50 57h1v2h-1"/>' +
    '<path fill="#963" d="M24 24h2v2h-2M29 24h1v10h-1M34 24h1v14h-1M38 24h2v2h-2M23 25h18v1h-18M23 26h1v9h-1M24 26h1v1h-1M27 26h10v1h-10M39 26h2v1h-2M22 27h1v7h-1M28 27h8v7h-8M40 27h1v8h-1M24 31h5v5h-5M36 31h4v5h-4M33 34h3v4h-3M27 36h3v1h-3M32 36h1v2h-1M20 40h1v11h-1M41 40h3v8h-3M19 41h1v11h-1M18 42h1v11h-1M17 43h1v10h-1M44 43h3v9h-3M16 44h1v9h-1M15 45h1v8h-1M43 48h1v3h-1M44 53h1v2h-1"/>' +
    '<path fill="#336" d="M31 6h3v5h-3M30 7h1v4h-1M29 9h1v2h-1M28 10h1v1h-1M32 13h8v9h-8M40 14h2v8h-2M29 15h3v8h-3M27 16h16v6h-16M17 20h4v10h-4M25 20h19v2h-19M41 22h3v3h-3M52 22h4v8h-4M48 23h4v7h-4M42 25h3v6h-3M18 30h2v2h-2M42 31h1v2h-1M43 31h1v1h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#930" d="M24 38h2v1h-2M26 39h12v14h-12M25 41h14v12h-14M24 44h1v9h-1M23 48h1v5h-1M21 51h1v1h-1M22 52h1v2h-1M29 53h6v1h-6M30 54h4v1h-4M31 55h2v1h-2"/>' +
    '<path fill="#630" d="M49 31h1v25h-1M40 34h1v1h-1M38 35h1v2h-1M39 35h1v1h-1M25 36h2v1h-2M35 36h3v1h-3M28 37h8v1h-8M39 37h1v2h-1M38 38h1v1h-1M21 39h2v9h-2M23 39h1v4h-1M35 39h3v2h-3M40 39h3v1h-3M42 40h2v1h-2M36 41h3v3h-3M43 41h2v1h-2M40 42h1v1h-1M44 42h3v1h-3M20 43h1v8h-1M45 43h2v1h-2M37 44h3v4h-3M46 44h1v1h-1M41 47h1v1h-1M19 48h1v4h-1M21 48h1v1h-1M38 48h3v4h-3M42 48h1v1h-1M18 49h1v4h-1M43 50h1v1h-1M17 51h1v2h-1M42 51h1v1h-1M44 51h1v1h-1M14 52h3v1h-3M39 52h3v1h-3M45 52h2v1h-2M19 53h1v2h-1M41 53h1v1h-1M16 54h3v1h-3M44 54h3v1h-3"/>' +
    '<path fill="#333" d="M34 10h1v1h-1M22 20h3v2h-3M26 20h1v2h-1M31 20h6v3h-6M37 20h1v2h-1M44 20h2v7h-2M21 21h2v4h-2M25 21h14v1h-14M46 21h1v9h-1M27 22h4v1h-4M20 23h1v10h-1M30 23h4v1h-4M21 25h1v2h-1M55 25h1v5h-1M45 27h1v3h-1M48 28h7v2h-7M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#c33" d="M20 17h24v3h-24M19 18h26v2h-26M18 19h28v1h-28M13 26h1v19h-1M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2M13 53h1v5h-1M12 57h1v1h-1"/>' +
    '<path fill="#c63" d="M48 31h1v25h-1M22 32h3v2h-3M39 32h3v2h-3M24 37h1v1h-1"/>' +
    '<path fill="#fff" d="M27 13h5v2h-5M25 14h2v3h-2M23 15h2v2h-2M27 15h2v1h-2M22 16h1v1h-1M19 20h2v2h-2M21 20h1v1h-1M24 28h2v2h-2M36 28h2v2h-2"/>' +
    '<path fill="#f66" d="M19 17h1v1h-1M18 18h1v1h-1M12 26h1v31h-1M30 35h2v1h-2"/>' +
    '<path fill="#669" d="M29 6h1v3h-1M30 6h1v1h-1M26 12h12v1h-12M24 13h3v1h-3M39 13h1v1h-1M22 14h3v1h-3M21 15h1v2h-1M22 15h1v1h-1M20 16h1v1h-1M48 22h4v1h-4M41 24h1v1h-1"/>' +
    '<path fill="#fc3" d="M12 16h2v8h-2M11 19h1v5h-1M14 20h1v4h-1M10 21h1v3h-1"/>' +
    '<path fill="#c96" d="M19 40h1v1h-1M40 40h1v2h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M41 43h1v4h-1M15 44h1v1h-1M14 45h1v7h-1M43 49h1v1h-1"/>' +
    '<path fill="#c90" d="M13 16h1v1h-1M15 21h1v3h-1M14 22h1v2h-1M9 23h5v1h-5"/>' +
    '<path fill="#fe6" d="M11 18h1v1h-1"/>' +
    '</svg>',
  // Ermite Lei : crinieres et barbe grises, robe bleu orage, eclairs
  hermit_lei: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M27 3h2v56h-2M36 3h1v56h-1M26 4h1v55h-1M35 4h1v55h-1M37 4h2v3h-2M18 6h1v5h-1M34 6h1v51h-1M45 6h2v3h-2M17 7h4v2h-4M44 7h1v28h-1M29 8h2v49h-2M33 8h1v49h-1M43 8h1v27h-1M21 9h2v26h-2M41 9h2v48h-2M31 10h2v47h-2M40 10h1v49h-1M19 11h21v2h-21M13 13h2v4h-2M20 13h20v22h-20M49 13h2v4h-2M5 14h4v3h-4M12 14h7v1h-7M46 14h3v19h-3M4 15h3v8h-3M18 15h28v16h-28M3 16h1v3h-1M2 17h1v4h-1M15 17h3v2h-3M7 18h2v3h-2M16 19h4v14h-4M11 20h42v3h-42M59 20h4v3h-4M10 21h1v4h-1M58 21h3v8h-3M3 22h2v5h-2M9 22h46v1h-46M57 22h1v3h-1M6 23h1v2h-1M12 23h39v2h-39M53 23h2v2h-2M56 23h1v4h-1M2 24h1v3h-1M51 24h2v1h-2M61 24h2v3h-2M15 25h1v6h-1M13 27h38v4h-38M11 28h42v3h-42M57 28h2v5h-2M9 29h2v4h-2M53 29h2v4h-2M60 29h1v2h-1M8 30h49v1h-49M56 31h1v2h-1M22 35h18v22h-18M21 36h1v21h-1M7 38h4v3h-4M20 38h25v19h-25M6 39h3v8h-3M19 39h1v18h-1M5 40h1v3h-1M18 40h1v15h-1M4 41h1v4h-1M17 41h30v14h-30M9 42h2v3h-2M16 42h1v13h-1M15 43h34v12h-34M14 44h1v9h-1M5 46h2v5h-2M8 47h1v2h-1M4 48h1v3h-1M49 52h2v1h-2M48 55h1v2h-1M23 57h3v2h-3M37 58h3v1h-3"/>' +
    '<path fill="#ccc" d="M27 5h1v6h-1M35 6h1v5h-1M19 8h1v3h-1M28 8h1v3h-1M34 8h1v3h-1M20 9h1v4h-1M29 9h1v2h-1M43 9h1v4h-1M21 10h1v4h-1M33 10h1v1h-1M41 10h2v3h-2M22 11h1v2h-1M40 11h1v2h-1M23 12h1v1h-1M32 13h8v9h-8M40 14h2v11h-2M14 15h4v1h-4M29 15h14v7h-14M46 15h2v3h-2M48 15h1v2h-1M15 16h4v1h-4M27 16h17v6h-17M45 16h1v1h-1M16 17h1v2h-1M17 17h1v1h-1M19 17h2v15h-2M25 17h2v5h-2M18 18h1v14h-1M24 18h1v4h-1M23 19h1v14h-1M17 20h1v10h-1M11 21h5v1h-5M48 21h3v2h-3M51 21h1v1h-1M12 22h4v1h-4M42 22h3v9h-3M14 23h2v1h-2M24 23h4v5h-4M36 23h6v2h-6M15 27h1v3h-1M48 27h1v3h-1M13 28h2v2h-2M49 28h2v2h-2M11 29h2v1h-2M51 29h2v1h-2M42 31h2v2h-2M23 36h7v6h-7M35 36h4v8h-4M30 37h5v11h-5M25 42h5v2h-5M27 44h3v2h-3M29 46h1v2h-1M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#fc9" d="M28 24h2v11h-2M34 24h2v11h-2M23 25h18v3h-18M22 27h2v5h-2M24 28h1v1h-1M27 28h10v1h-10M39 28h2v1h-2M25 29h2v5h-2M30 29h4v7h-4M37 29h2v5h-2M40 29h1v4h-1M24 30h16v4h-16M23 32h1v1h-1M26 34h11v1h-11M24 47h4v6h-4M36 47h4v6h-4M16 50h6v2h-6M42 50h6v2h-6M16 53h3v1h-3M44 53h3v1h-3"/>' +
    '<path fill="#999" d="M27 4h1v1h-1M36 4h1v2h-1M45 7h1v1h-1M44 8h1v1h-1M30 10h1v1h-1M43 10h1v3h-1M42 12h1v2h-1M49 14h1v2h-1M48 16h1v1h-1M44 17h1v10h-1M47 17h1v2h-1M45 18h1v12h-1M34 19h3v4h-3M22 20h2v3h-2M24 20h1v2h-1M26 20h1v2h-1M31 20h3v4h-3M37 20h1v2h-1M46 20h1v10h-1M21 21h18v1h-18M10 22h1v1h-1M21 22h1v5h-1M27 22h4v1h-4M13 23h1v1h-1M20 23h1v10h-1M22 23h1v2h-1M30 23h1v1h-1M48 23h1v2h-1M49 23h1v1h-1M15 24h1v1h-1M48 29h3v1h-3M9 30h2v1h-2M16 30h1v1h-1M47 30h1v1h-1M53 30h2v1h-2M43 32h1v1h-1M22 33h1v2h-1M42 33h1v2h-1M23 34h1v2h-1M40 34h1v8h-1M24 35h2v1h-2M38 35h2v1h-2M27 36h3v1h-3M39 36h1v7h-1M41 36h1v2h-1M22 38h1v1h-1M38 38h1v6h-1M23 41h1v1h-1M24 42h1v1h-1M37 42h1v3h-1M25 43h1v1h-1M36 43h1v3h-1M26 44h1v1h-1M35 44h1v3h-1M27 45h1v1h-1M34 45h1v3h-1M28 46h1v1h-1M33 46h1v2h-1M29 47h2v1h-2M32 47h1v2h-1M31 48h1v1h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#369" d="M20 40h1v10h-1M19 41h1v9h-1M42 41h3v9h-3M18 42h1v8h-1M41 42h5v8h-5M17 43h1v7h-1M16 44h1v6h-1M25 45h1v2h-1M38 45h1v2h-1M24 49h7v4h-7M34 49h6v4h-6M23 50h18v3h-18M22 52h1v2h-1M21 53h1v2h-1M29 53h6v1h-6M30 54h4v1h-4"/>' +
    '<path fill="#fff" d="M18 7h1v1h-1M19 9h1v2h-1M26 12h6v3h-6M32 12h6v1h-6M24 13h3v4h-3M39 13h1v1h-1M13 14h2v1h-2M22 14h2v5h-2M21 15h1v6h-1M27 15h2v1h-2M20 16h1v1h-1M24 17h1v1h-1M20 18h1v4h-1M19 19h1v3h-1M22 19h1v1h-1M41 24h1v1h-1M22 36h1v2h-1M34 36h1v1h-1M23 39h1v2h-1"/>' +
    '<path fill="#336" d="M21 39h1v11h-1M42 39h2v2h-2M43 41h2v1h-2M22 42h1v8h-1M44 42h2v1h-2M23 43h1v3h-1M45 43h2v1h-2M46 44h2v6h-2M40 45h1v1h-1M20 46h1v4h-1M24 48h5v1h-5M35 48h5v1h-5M30 49h1v1h-1M33 49h1v1h-1M39 49h1v1h-1M41 49h1v1h-1M40 50h1v1h-1M15 51h1v1h-1M40 52h2v1h-2M41 53h2v1h-2M42 54h1v1h-1M20 55h1v1h-1M31 55h2v1h-2M43 55h1v1h-1"/>' +
    '<path fill="#fe6" d="M5 15h1v7h-1M6 15h1v1h-1M4 16h1v3h-1M3 17h1v1h-1M6 18h1v2h-1M59 21h1v7h-1M60 21h1v1h-1M4 22h1v1h-1M58 22h1v3h-1M57 23h1v1h-1M3 24h1v1h-1M60 24h1v2h-1M58 28h1v1h-1M57 30h1v1h-1M7 39h1v7h-1M8 39h1v1h-1M6 40h1v3h-1M5 41h1v1h-1M8 42h1v2h-1M6 46h1v1h-1M5 48h1v1h-1"/>' +
    '<path fill="#69c" d="M20 39h1v1h-1M19 40h1v1h-1M18 41h1v1h-1M17 42h1v1h-1M16 43h1v1h-1M40 43h1v2h-1M15 44h1v7h-1M41 46h1v3h-1"/>' +
    '<path fill="#c96" d="M40 32h1v1h-1M39 33h1v1h-1M37 34h1v1h-1M19 53h1v2h-1M47 53h1v1h-1M44 54h1v1h-1"/>' +
    '<path fill="#ffc" d="M24 46h3v1h-3M37 46h3v1h-3"/>' +
    '</svg>',
  // Yuan, doyen des noyes (parley_sun2) : vieux noye venerable, peau bleutee, chevelure et barbe de joncs, perles d'eau
  parley_sun2: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M26 11h13v46h-13M24 12h17v45h-17M22 13h21v44h-21M21 14h1v21h-1M20 15h1v20h-1M19 16h26v17h-26M18 17h1v40h-1M17 18h30v15h-30M16 20h2v37h-2M15 28h34v5h-34M14 29h1v24h-1M49 29h2v2h-2M43 33h6v2h-6M45 35h4v22h-4M21 36h1v21h-1M20 38h25v19h-25M19 39h1v18h-1M13 40h38v3h-38M15 53h1v2h-1M23 57h6v2h-6M35 57h6v2h-6"/>' +
    '<path fill="#693" d="M32 13h8v9h-8M40 14h2v11h-2M29 15h3v8h-3M27 16h16v6h-16M19 17h25v5h-25M18 18h3v14h-3M17 20h1v10h-1M42 22h3v10h-3M15 29h1v24h-1M16 30h1v24h-1M47 30h1v24h-1M42 32h2v1h-2M46 32h1v22h-1M23 36h7v6h-7M35 36h4v8h-4M30 37h5v11h-5M14 40h1v2h-1M20 40h1v12h-1M48 40h1v2h-1M19 41h1v10h-1M42 41h3v10h-3M25 42h5v2h-5M41 42h1v8h-1M27 44h3v2h-3M25 45h1v8h-1M38 45h1v8h-1M24 46h3v7h-3M29 46h1v2h-1M37 46h3v7h-3M27 47h1v6h-1M36 47h1v6h-1M28 48h1v5h-1M35 48h1v5h-1M29 49h2v5h-2M33 49h2v5h-2M17 50h1v4h-1M23 50h18v3h-18M45 51h1v2h-1M22 52h1v2h-1M21 53h1v2h-1M23 54h6v3h-6M31 54h3v1h-3M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#363" d="M44 18h1v9h-1M34 19h3v4h-3M45 19h1v13h-1M22 20h2v5h-2M24 20h1v2h-1M26 20h1v2h-1M31 20h3v4h-3M37 20h1v2h-1M21 21h18v1h-18M21 22h1v5h-1M27 22h4v1h-4M20 23h1v10h-1M24 23h4v3h-4M30 23h1v1h-1M36 23h5v3h-5M46 28h1v2h-1M48 29h1v1h-1M44 31h1v1h-1M17 32h1v18h-1M43 32h1v1h-1M22 33h1v2h-1M42 33h1v2h-1M23 34h1v2h-1M40 34h1v8h-1M24 35h2v1h-2M38 35h2v1h-2M27 36h3v1h-3M39 36h1v7h-1M41 36h1v2h-1M22 38h1v1h-1M38 38h1v6h-1M21 39h1v13h-1M42 39h2v2h-2M44 40h1v3h-1M23 41h1v1h-1M43 41h1v1h-1M48 41h1v1h-1M22 42h1v8h-1M24 42h1v1h-1M37 42h1v3h-1M23 43h1v3h-1M25 43h1v1h-1M36 43h1v3h-1M26 44h1v1h-1M35 44h1v3h-1M27 45h1v1h-1M34 45h1v3h-1M40 45h1v1h-1M20 46h1v6h-1M28 46h1v1h-1M33 46h1v2h-1M38 46h2v1h-2M29 47h2v1h-2M32 47h1v2h-1M39 47h1v3h-1M31 48h1v1h-1M41 49h1v1h-1M40 50h1v1h-1M18 51h1v2h-1M17 52h1v2h-1M40 52h2v1h-2M47 52h1v2h-1M16 53h1v1h-1M41 53h2v1h-2M46 53h1v1h-1M29 55h1v1h-1M31 55h1v1h-1M41 55h1v1h-1M43 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#9cc" d="M28 24h2v11h-2M34 24h2v11h-2M23 25h18v1h-18M23 26h1v7h-1M24 26h1v1h-1M27 26h10v1h-10M39 26h2v1h-2M22 27h1v5h-1M30 27h4v9h-4M40 27h1v6h-1M24 31h16v3h-16M26 34h11v1h-11M44 53h1v2h-1"/>' +
    '<path fill="#cff" d="M27 13h5v2h-5M25 14h2v3h-2M23 15h2v3h-2M27 15h2v1h-2M22 16h1v4h-1M21 17h1v4h-1M20 18h1v4h-1M23 18h1v1h-1M19 19h1v3h-1"/>' +
    '<path fill="#9c6" d="M26 12h12v1h-12M24 13h3v1h-3M39 13h1v1h-1M22 14h3v1h-3M21 15h1v2h-1M22 15h1v1h-1M20 16h1v1h-1M41 24h1v1h-1M22 36h1v2h-1M34 36h1v1h-1M20 39h1v1h-1M23 39h1v2h-1M19 40h1v1h-1M40 43h1v2h-1M41 46h1v3h-1"/>' +
    '<path fill="#fff" d="M24 28h2v3h-2M36 28h2v3h-2M38 48h2v2h-2M31 52h2v2h-2"/>' +
    '<path fill="#963" d="M19 50h3v1h-3M42 50h2v2h-2M44 50h1v1h-1M20 51h2v1h-2M30 54h1v1h-1M32 54h1v2h-1M42 54h1v1h-1M20 55h1v1h-1"/>' +
    '<path fill="#369" d="M26 28h1v2h-1M27 28h1v1h-1M38 28h1v2h-1M39 28h1v1h-1M24 30h2v1h-2M36 30h2v1h-2M25 31h2v1h-2M37 31h2v1h-2"/>' +
    '<path fill="#699" d="M40 32h1v1h-1M39 33h1v1h-1M37 34h1v1h-1M19 53h1v2h-1M18 54h1v1h-1M44 54h2v1h-2"/>' +
    '</svg>',
  // Tintement, ame de la cloche felee (parley_sun3) : cloche de bronze patine, anse en chignon, fissure lumineuse, visage timide
  parley_sun3: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M30 3h3v12h-3M33 3h2v10h-2M28 4h9v9h-9M27 5h1v8h-1M26 7h1v4h-1M36 13h1v2h-1M33 14h2v1h-2M28 17h9v38h-9M25 18h6v41h-6M37 18h2v41h-2M24 19h1v40h-1M22 20h21v35h-21M44 20h1v35h-1M45 20h2v3h-2M21 21h3v38h-3M20 22h24v33h-24M19 24h1v31h-1M18 25h1v30h-1M17 33h30v22h-30M16 37h1v18h-1M10 41h39v8h-39M50 41h3v14h-3M53 41h2v6h-2M9 42h41v5h-41M8 43h1v4h-1M49 47h1v8h-1M53 48h2v1h-2M12 49h37v6h-37M11 50h1v5h-1M33 55h10v4h-10M52 55h1v2h-1"/>' +
    '<path fill="#699" d="M32 4h2v8h-2M31 5h4v7h-4M29 6h2v6h-2M28 8h1v4h-1M27 9h1v2h-1M29 19h9v8h-9M38 20h1v7h-1M39 21h3v6h-3M28 22h2v27h-2M27 23h16v4h-16M25 24h2v3h-2M24 25h1v2h-1M20 27h3v22h-3M19 34h7v15h-7M42 37h4v12h-4M18 38h10v11h-10M40 40h2v9h-2M39 41h1v8h-1M17 42h22v7h-22M15 46h2v3h-2M22 56h7v2h-7M34 56h7v2h-7"/>' +
    '<path fill="#ffc" d="M28 26h8v14h-8M36 26h3v1h-3M25 28h16v2h-16M24 29h1v2h-1M23 30h1v10h-1M27 30h10v1h-10M39 30h2v1h-2M40 31h1v9h-1M22 32h4v8h-4M27 35h13v5h-13M26 36h4v6h-4M24 40h2v1h-2M31 40h2v1h-2M34 40h1v3h-1M10 42h4v5h-4M50 42h4v4h-4M9 43h1v3h-1M49 43h1v2h-1M50 46h3v1h-3"/>' +
    '<path fill="#fc3" d="M34 6h2v2h-2M13 50h38v4h-38"/>' +
    '<path fill="#366" d="M35 5h1v1h-1M35 8h1v4h-1M34 9h1v3h-1M32 11h1v2h-1M33 11h1v1h-1M30 12h2v1h-2M31 13h1v1h-1M41 21h1v1h-1M42 22h1v1h-1M41 23h1v1h-1M40 24h1v1h-1M41 25h3v12h-3M40 26h1v1h-1M44 33h1v8h-1M45 34h1v12h-1M43 37h1v1h-1M43 39h1v1h-1M46 41h1v8h-1M44 42h4v1h-4M47 43h1v6h-1M48 45h1v4h-1M24 46h1v3h-1M26 46h1v3h-1M28 46h1v3h-1M30 46h1v3h-1M32 46h1v3h-1M34 46h1v3h-1M36 46h1v3h-1M38 46h1v3h-1M40 46h1v3h-1M42 46h1v3h-1M44 46h1v3h-1M21 47h1v2h-1M23 47h23v2h-23M18 48h1v1h-1M20 48h3v1h-3M29 56h1v1h-1M41 56h1v1h-1M28 57h1v1h-1M40 57h1v1h-1"/>' +
    '<path fill="#fff" d="M26 20h2v3h-2M28 20h1v2h-1M25 21h2v3h-2M23 22h2v3h-2M22 23h2v4h-2M21 25h1v2h-1M27 25h10v1h-10M20 26h1v1h-1M25 26h3v1h-3M23 28h1v2h-1M24 28h1v1h-1M22 29h1v3h-1M21 31h1v6h-1M24 32h2v3h-2M36 32h2v3h-2"/>' +
    '<path fill="#9cc" d="M30 4h1v2h-1M31 4h1v1h-1M28 5h1v3h-1M29 5h1v1h-1M27 7h1v2h-1M28 18h8v1h-8M25 19h4v1h-4M37 19h1v1h-1M24 20h1v2h-1M25 20h1v1h-1M22 21h1v2h-1M23 21h1v1h-1M21 22h1v3h-1M20 24h1v2h-1M19 25h1v9h-1M18 33h1v5h-1M17 37h1v5h-1M16 41h1v5h-1M15 45h1v1h-1"/>' +
    '<path fill="#fc9" d="M41 29h1v11h-1M42 31h1v6h-1M40 35h1v5h-1M39 37h1v4h-1M38 38h1v4h-1M37 39h1v3h-1M35 40h2v3h-2M25 41h6v1h-6M33 41h2v2h-2M27 42h6v1h-6M14 43h1v2h-1M13 46h1v2h-1M11 47h2v1h-2M50 47h2v1h-2"/>' +
    '<path fill="#fe6" d="M45 21h1v1h-1M44 22h1v1h-1M43 23h1v5h-1M42 24h1v2h-1M43 30h1v6h-1M42 32h1v2h-1M44 34h1v4h-1M45 36h1v2h-1M12 50h1v4h-1"/>' +
    '<path fill="#c90" d="M51 50h1v4h-1M21 54h10v1h-10M33 54h10v1h-10"/>' +
    '<path fill="#c63" d="M26 32h1v2h-1M27 32h1v1h-1M38 32h1v2h-1M39 32h1v1h-1M24 34h2v1h-2M36 34h2v1h-2M25 35h2v1h-2M37 35h2v1h-2"/>' +
    '<path fill="#f99" d="M22 38h3v2h-3M39 38h3v2h-3"/>' +
    '</svg>',
  // Rongrong, petite voix du tonnerre (parley_sun5) : enfant-esprit a nuage d'orage pour chapeau, meches en eclairs, tambour et baguettes
  parley_sun5: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><path fill="#2b1b17" d="M29 6h6v51h-6M27 7h10v50h-10M26 8h3v51h-3M25 9h14v48h-14M24 10h2v49h-2M19 11h26v32h-26M17 12h30v9h-30M16 13h1v8h-1M15 14h34v5h-34M14 15h1v26h-1M11 16h2v9h-2M51 16h2v7h-2M10 17h41v2h-41M10 19h1v2h-1M47 19h3v2h-3M18 21h1v2h-1M46 21h1v2h-1M49 21h2v16h-2M52 23h1v2h-1M18 24h1v19h-1M48 24h1v19h-1M12 25h2v10h-2M17 25h1v16h-1M47 25h1v16h-1M15 26h32v15h-32M51 28h2v9h-2M53 29h2v2h-2M11 30h1v3h-1M13 35h1v6h-1M53 36h2v3h-2M50 37h1v2h-1M12 38h1v1h-1M55 38h2v1h-2M54 39h1v2h-1M49 40h2v1h-2M20 43h23v2h-23M21 45h22v12h-22M20 48h1v9h-1M16 49h31v2h-31M19 51h26v6h-26M18 52h1v3h-1M17 53h1v2h-1M45 54h2v1h-2M45 56h2v1h-2M23 57h1v2h-1M35 57h6v2h-6"/>' +
    '<path fill="#99c" d="M30 8h6v6h-6M28 9h7v6h-7M36 9h1v4h-1M27 10h1v5h-1M37 10h1v2h-1M26 11h1v4h-1M25 12h1v3h-1M44 12h1v5h-1M20 13h3v3h-3M40 13h6v2h-6M18 14h2v4h-2M24 14h1v1h-1M38 14h9v1h-9M17 15h1v5h-1M31 15h3v1h-3M42 15h5v1h-5M16 16h3v3h-3M20 16h1v1h-1M29 16h2v2h-2M40 16h2v8h-2M45 16h2v2h-2M15 17h1v1h-1M24 17h5v7h-5M35 17h9v6h-9M22 18h2v5h-2M29 18h1v1h-1M34 18h1v6h-1M44 18h1v3h-1M19 19h3v2h-3M33 19h1v1h-1M20 21h2v1h-2M44 26h1v8h-1M45 27h1v5h-1M43 30h1v6h-1M51 30h1v1h-1M16 31h1v2h-1M50 31h1v1h-1M15 32h1v2h-1M42 32h1v5h-1M49 32h1v2h-1M14 33h1v1h-1M48 33h1v1h-1M13 34h1v1h-1M41 34h1v4h-1M14 36h1v2h-1M37 37h4v2h-4M23 38h3v1h-3M34 38h5v2h-5M25 39h5v1h-5M32 39h4v2h-4M28 40h4v1h-4M22 47h2v1h-2M21 48h1v7h-1M20 51h1v5h-1M19 52h1v3h-1M18 53h1v1h-1"/>' +
    '<path fill="#ccf" d="M29 7h6v1h-6M27 8h3v1h-3M26 9h1v2h-1M27 9h1v1h-1M25 10h1v2h-1M24 11h1v3h-1M19 12h4v1h-4M39 12h5v1h-5M17 13h3v1h-3M37 13h3v1h-3M16 14h1v2h-1M17 14h1v1h-1M36 14h2v1h-2M15 15h1v2h-1M23 16h6v1h-6M34 16h6v1h-6M21 17h3v1h-3M34 17h1v1h-1M20 18h2v1h-2M21 24h2v13h-2M31 24h3v13h-3M42 24h2v6h-2M20 25h22v1h-22M20 26h1v10h-1M28 26h8v11h-8M41 26h1v8h-1M19 27h1v7h-1M23 28h18v1h-18M23 29h1v9h-1M24 29h1v1h-1M27 29h10v1h-10M39 29h2v1h-2M12 30h1v2h-1M40 30h1v7h-1M42 30h1v2h-1M13 31h1v2h-1M47 31h1v2h-1M14 32h1v1h-1M48 32h1v1h-1M24 34h16v3h-16M22 37h7v1h-7M33 37h4v1h-4M26 38h3v1h-3M33 38h1v1h-1"/>' +
    '<path fill="#669" d="M38 11h1v1h-1M47 15h1v4h-1M46 17h1v2h-1M48 17h1v1h-1M43 19h1v4h-1M44 19h1v2h-1M45 19h1v1h-1M42 20h1v3h-1M29 21h1v3h-1M40 21h2v3h-2M21 22h10v1h-10M33 22h7v1h-7M23 23h8v1h-8M34 23h6v1h-6M46 33h1v7h-1M16 34h2v6h-2M47 34h1v6h-1M14 35h2v1h-2M45 35h1v5h-1M48 35h1v2h-1M15 36h4v4h-4M19 37h1v5h-1M44 37h1v4h-1M20 38h1v5h-1M43 38h1v4h-1M21 39h1v6h-1M42 39h1v4h-1M18 40h5v1h-5M41 40h1v6h-1M22 41h3v5h-3M26 41h2v1h-2M39 41h2v5h-2M27 42h9v3h-9M38 42h1v4h-1M23 47h1v1h-1M22 48h1v6h-1M21 51h1v4h-1M20 52h1v4h-1M19 53h1v2h-1"/>' +
    '<path fill="#fc3" d="M11 17h2v4h-2M51 17h1v5h-1M50 19h1v4h-1M12 21h2v3h-2M13 24h1v5h-1M49 24h1v7h-1M14 26h1v5h-1M48 27h1v4h-1M26 31h1v2h-1M27 31h1v1h-1M38 31h1v2h-1M39 31h1v1h-1M24 33h2v1h-2M36 33h2v1h-2M25 34h2v1h-2M37 34h2v1h-2M51 35h1v1h-1M27 43h1v2h-1M36 43h1v2h-1M28 44h1v1h-1M35 44h1v1h-1M20 49h2v2h-2M42 49h1v6h-1M19 50h1v1h-1M43 50h2v1h-2M23 54h6v3h-6M35 54h6v3h-6M22 55h1v1h-1M34 55h1v1h-1"/>' +
    '<path fill="#c33" d="M35 46h2v7h-2M29 47h10v6h-10M26 48h14v5h-14M25 49h1v4h-1M24 52h1v1h-1M29 53h6v1h-6M30 54h4v1h-4M31 55h2v1h-2"/>' +
    '<path fill="#ffc" d="M28 47h1v6h-1M35 47h1v6h-1M24 50h16v2h-16"/>' +
    '<path fill="#336" d="M17 33h1v1h-1M50 34h1v1h-1M18 35h1v1h-1M49 35h1v1h-1M47 39h1v1h-1M36 41h1v2h-1M37 41h1v1h-1M25 42h1v4h-1M41 44h1v2h-1M22 45h3v1h-3M38 45h3v1h-3M40 47h2v1h-2M41 48h1v6h-1M42 51h2v4h-2M44 54h1v1h-1M20 55h1v1h-1M43 55h1v1h-1"/>' +
    '<path fill="#c90" d="M12 17h1v1h-1M13 19h1v4h-1M51 20h1v2h-1M15 27h1v4h-1M49 28h1v3h-1M50 28h1v1h-1M52 29h1v1h-1M14 30h1v1h-1M48 30h1v1h-1M13 38h1v1h-1M54 38h1v1h-1M29 55h1v1h-1M41 55h1v1h-1M28 56h1v1h-1M40 56h1v1h-1M24 57h4v1h-4M36 57h4v1h-4"/>' +
    '<path fill="#f66" d="M30 38h2v1h-2M27 46h8v1h-8M25 47h3v1h-3M24 48h1v2h-1M25 48h1v1h-1"/>' +
    '<path fill="#eef" d="M20 23h1v2h-1M19 24h1v3h-1M18 26h1v6h-1M19 33h1v1h-1"/>' +
    '<path fill="#c9c" d="M22 35h3v2h-3M39 35h3v2h-3"/>' +
    '<path fill="#fff" d="M24 31h2v2h-2M36 31h2v2h-2"/>' +
    '<path fill="#fe6" d="M32 18h1v4h-1M33 18h1v1h-1M31 19h1v1h-1"/>' +
    '</svg>'
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
