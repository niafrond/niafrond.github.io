// Créatures et esprits génériques : animaux, fantômes, objets animés… pour les PNJ sans sprite dessiné à la main
// qui ne sont pas des humains (buffle, épouvantail, corbeau, crapaud…). Même facture que villagers.js : chibi de face,
// viewBox 64x64, contour #2b1b17, pieds vers y = 58. Le genre est déduit de l'emoji du PNJ (CREATURE_BY_EMOJI) ;
// CREATURE_BY_ID tranche quand l'emoji est ambigu (🕊️ = éleveur de pigeons ou mouette, 🔥 = chauffeur ou esprit…)
// et donne les variantes de couleur ou d'accessoire d'un même genre.

const K = '#2b1b17';
const O = `stroke="${K}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const N = 'stroke="none"';

// Emojis sans ambiguïté : un PNJ qui porte l'un d'eux est cette créature (les métiers liés à un animal,
// comme l'éleveur de canards 🦆 ou le fauconnier 🦅, gardent leur emoji hors de cette table et restent humains).
export const CREATURE_BY_EMOJI = {
    '🐦‍⬛': 'crow', '🐸': 'toad', '🐃': 'buffalo', '🦦': 'weasel', '🪿': 'goose', '🐢': 'turtle', '🐟': 'carp',
    '🐼': 'panda', '🐍': 'snake', '🦊': 'fox', '🐫': 'camel', '🐐': 'goat', '🐕': 'dog', '🐒': 'monkey', '🐵': 'monkey',
    '🐲': 'dragon', '🐉': 'dragon', '🦎': 'salamander', '🐎': 'horse', '🐺': 'wolf', '🐇': 'rabbit', '🐰': 'rabbit',
    '🪼': 'jellyfish', '🐙': 'octopus', '🦀': 'crab', '🦢': 'crane', '🐋': 'whale', '🐥': 'chick', '🎃': 'scarecrow',
    '👻': 'ghost', '👺': 'imp', '🧞': 'djinn', '🎋': 'bamboo', '🌳': 'tree', '🧜': 'mermaid'
};

// Par identifiant : genre forcé (emoji ambigu) et/ou variante.
export const CREATURE_BY_ID = {
    gull_pip: { kind: 'gull' },
    cairn_spirit: { kind: 'cairn' },
    forge_spirit: { kind: 'flame' },
    lantern_old: { kind: 'lantern' },
    fennec_lili: { kind: 'fennec' },
    lava_fish_bi: { kind: 'carp', lava: true },
    paper_dragon_long: { kind: 'dragon', paper: true },
    moon_crow_wu: { kind: 'crow', moon: true },
    phoenix_chick: { kind: 'chick', phoenix: true },
    horse_tian: { kind: 'horse', celestial: true },
    jade_hare: { kind: 'rabbit', jade: true },
    moon_rabbit_yutu: { kind: 'rabbit', pestle: true },
    panda_mimi: { kind: 'panda', scroll: true },
    snake_qing: { kind: 'snake', scholar: true },
    octo_ba: { kind: 'octopus', chef: true },
    monkey_ji: { kind: 'monkey', peach: true },
    wolf_pup_baatar: { kind: 'wolf', ember: true },
    captain_lo: { kind: 'ghost', hat: 'captain' },
    ghost_miner_shu: { kind: 'ghost', hat: 'miner' },
    ghost_rider_tolui: { kind: 'ghost', hat: 'rider' }
};

export function creatureKind(id, hint = '') {
    const byId = CREATURE_BY_ID[id];
    if (byId?.kind) return byId.kind;
    for (const [emoji, kind] of Object.entries(CREATURE_BY_EMOJI)) if (hint && hint.includes(emoji)) return kind;
    return null;
}

// ---------- petits éléments communs ----------
const eyes = (y = 25, dx = 5.6, r = 1.7) =>
    `<circle cx="${32 - dx}" cy="${y}" r="${r}" fill="${K}" ${N}/><circle cx="${32 + dx}" cy="${y}" r="${r}" fill="${K}" ${N}/>` +
    `<circle cx="${32 - dx + .6}" cy="${y - .6}" r=".6" fill="#fff" ${N}/><circle cx="${32 + dx + .6}" cy="${y - .6}" r=".6" fill="#fff" ${N}/>`;
const sleepy = (y = 25, dx = 5.6) =>
    `<path d="M${32 - dx - 2.2} ${y} Q${32 - dx} ${y + 1.8} ${32 - dx + 2.2} ${y} M${32 + dx - 2.2} ${y} Q${32 + dx} ${y + 1.8} ${32 + dx + 2.2} ${y}" fill="none" stroke-width="1.4"/>`;
const cheeks = (y = 29.5, dx = 9, c = '#ff7f7f') =>
    `<ellipse cx="${32 - dx}" cy="${y}" rx="2.4" ry="1.5" fill="${c}" opacity=".45" ${N}/><ellipse cx="${32 + dx}" cy="${y}" rx="2.4" ry="1.5" fill="${c}" opacity=".45" ${N}/>`;
const smile = (y = 31, w = 2.2) => `<path d="M${32 - w} ${y} Q32 ${y + 2.2} ${32 + w} ${y}" fill="none" stroke-width="1.2"/>`;
const shine = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.3" fill="#fff" opacity=".45" transform="rotate(-25 ${x} ${y})" ${N}/>`;
const sparkle = (x, y, c = '#fbe7b0') =>
    `<path d="M${x} ${y - 3} L${x + .9} ${y - .9} L${x + 3} ${y} L${x + .9} ${y + .9} L${x} ${y + 3} L${x - .9} ${y + .9} L${x - 3} ${y} L${x - .9} ${y - .9}Z" fill="${c}" stroke-width="1"/>`;
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g ${O}>${body}</g></svg>`;

// ---------- mammifère assis (buffle, cheval, chèvre, chien, loup, renard, panda, lapin, singe, chameau, belette) ----------
function beast(p) {
    const { fur, furD, belly, limb = furD } = p;
    let s = p.back || '';
    // corps assis, ventre clair, pattes
    s += `<path d="M18.6 57.6 Q15.6 44 24 36.6 L40 36.6 Q48.4 44 45.4 57.6 Q32 60.2 18.6 57.6Z" fill="${fur}"/>` +
        `<path d="M40.4 39 Q47 46 44.6 56.8 L38.6 57.8 Q42.4 47 40.4 39Z" fill="${furD}" ${N}/>` +
        `<ellipse cx="32" cy="49" rx="7.4" ry="7.6" fill="${belly}"/>` +
        `<ellipse cx="25" cy="57.2" rx="4.6" ry="2.6" fill="${limb}"/><ellipse cx="39" cy="57.2" rx="4.6" ry="2.6" fill="${limb}"/>` +
        `<ellipse cx="22.6" cy="45.4" rx="3.4" ry="5.4" transform="rotate(14 22.6 45.4)" fill="${limb}"/>` +
        `<ellipse cx="41.4" cy="45.4" rx="3.4" ry="5.4" transform="rotate(-14 41.4 45.4)" fill="${limb}"/>`;
    s += p.held || '';
    // oreilles derrière la tête
    const e = p.ears, ec = p.earC || fur, ei = p.earIn || belly;
    if (e === 'round') s += `<circle cx="20.4" cy="15.4" r="5.4" fill="${ec}"/><circle cx="43.6" cy="15.4" r="5.4" fill="${ec}"/>`;
    else if (e === 'small') s += `<circle cx="20" cy="18.6" r="3.4" fill="${ec}"/><circle cx="44" cy="18.6" r="3.4" fill="${ec}"/>`;
    else if (e === 'pointy') s += `<path d="M18 21 L19.4 6.4 L28.6 14.6Z" fill="${ec}"/><path d="M46 21 L44.6 6.4 L35.4 14.6Z" fill="${ec}"/>` +
        `<path d="M20.4 16 L21 10 L25 14Z" fill="${ei}" ${N}/><path d="M43.6 16 L43 10 L39 14Z" fill="${ei}" ${N}/>`;
    else if (e === 'big') s += `<path d="M19 22 L10.6 1.6 L29 13Z" fill="${ec}"/><path d="M45 22 L53.4 1.6 L35 13Z" fill="${ec}"/>` +
        `<path d="M19.6 17 L14.4 6 L25.4 13.6Z" fill="${ei}" ${N}/><path d="M44.4 17 L49.6 6 L38.6 13.6Z" fill="${ei}" ${N}/>`;
    else if (e === 'long') s += `<ellipse cx="25" cy="8.6" rx="4.2" ry="11" transform="rotate(-10 25 8.6)" fill="${ec}"/><ellipse cx="39" cy="8.6" rx="4.2" ry="11" transform="rotate(10 39 8.6)" fill="${ec}"/>` +
        `<ellipse cx="25" cy="9.4" rx="1.9" ry="7.4" transform="rotate(-10 25 9.4)" fill="${ei}" ${N}/><ellipse cx="39" cy="9.4" rx="1.9" ry="7.4" transform="rotate(10 39 9.4)" fill="${ei}" ${N}/>`;
    else if (e === 'side') s += `<ellipse cx="16.4" cy="21" rx="6" ry="3.2" transform="rotate(-18 16.4 21)" fill="${ec}"/><ellipse cx="47.6" cy="21" rx="6" ry="3.2" transform="rotate(18 47.6 21)" fill="${ec}"/>`;
    else if (e === 'floppy') s += `<ellipse cx="18" cy="25" rx="4" ry="8.4" transform="rotate(22 18 25)" fill="${ec}"/><ellipse cx="46" cy="25" rx="4" ry="8.4" transform="rotate(-22 46 25)" fill="${ec}"/>`;
    else if (e === 'monkey') s += `<circle cx="17.6" cy="25" r="5" fill="${ec}"/><circle cx="46.4" cy="25" r="5" fill="${ec}"/><circle cx="17.6" cy="25" r="2.6" fill="${ei}" ${N}/><circle cx="46.4" cy="25" r="2.6" fill="${ei}" ${N}/>`;
    s += p.behindHead || '';
    // tête
    const hy = p.headY || 25, rx = p.headRx || 14, ry = p.headRy || 12;
    s += `<ellipse cx="32" cy="${hy}" rx="${rx}" ry="${ry}" fill="${fur}"/>` +
        `<path d="M${32 + rx * .55} ${hy + ry * .5} Q${32 + rx * .95} ${hy} ${32 + rx * .8} ${hy - ry * .5} Q${32 + rx} ${hy + ry * .6} ${32 + rx * .1} ${hy + ry * .98}Z" fill="${furD}" ${N}/>` +
        `<ellipse cx="32" cy="${hy}" rx="${rx}" ry="${ry}" fill="none"/>` + shine(32 - rx * .45, hy - ry * .55);
    s += p.face || '';
    // museau
    if (p.snout === 'muzzle') s += `<ellipse cx="32" cy="${hy + 6.4}" rx="8" ry="5" fill="${belly}"/><ellipse cx="29" cy="${hy + 6}" rx="1.2" ry="1.6" fill="${K}" ${N}/><ellipse cx="35" cy="${hy + 6}" rx="1.2" ry="1.6" fill="${K}" ${N}/>` + smile(hy + 8.4, 2);
    else if (p.snout === 'long') s += `<ellipse cx="32" cy="${hy + 7.4}" rx="7" ry="6" fill="${belly}"/><ellipse cx="29.4" cy="${hy + 8}" rx="1.1" ry="1.5" fill="${K}" ${N}/><ellipse cx="34.6" cy="${hy + 8}" rx="1.1" ry="1.5" fill="${K}" ${N}/>` + smile(hy + 10.4, 1.8);
    else if (p.snout === 'small') s += `<ellipse cx="32" cy="${hy + 5.4}" rx="4.6" ry="3.4" fill="${belly}" ${N}/><path d="M30.4 ${hy + 3.6} L33.6 ${hy + 3.6} L32 ${hy + 5.4}Z" fill="${K}" stroke-width="1"/>` +
        `<path d="M29.6 ${hy + 6.4} Q31 ${hy + 7.8} 32 ${hy + 5.6} Q33 ${hy + 7.8} 34.4 ${hy + 6.4}" fill="none" stroke-width="1.1"/>`;
    s += (p.eyes === 'sleepy' ? sleepy(hy, 6) : eyes(hy, 6)) + cheeks(hy + 4, 9.6);
    s += p.top || '';
    return wrap(s);
}

const TAIL = (c, d = 'M42 52 Q56 50 55 38 Q54 32 50 33 Q52 44 41 47Z') => `<path d="${d}" fill="${c}"/>`;

function buffalo() {
    return beast({
        fur: '#4a4e58', furD: '#363944', belly: '#9aa0aa', ears: 'side', snout: 'muzzle', eyes: 'sleepy',
        back: TAIL('#363944', 'M42 54 Q52 56 52 46 L54 44 L51 43 Q49 50 42 50Z'),
        behindHead: `<path d="M19 16 Q6 15 5 6 Q10 11 21 11Z" fill="#e2d6bc"/><path d="M45 16 Q58 15 59 6 Q54 11 43 11Z" fill="#e2d6bc"/>`,
        face: `<path d="M24 15.6 Q28 12 32 15 Q36 12 40 15.6 Q36 17.4 32 17 Q28 17.4 24 15.6Z" fill="#363944" ${N}/>`,
        top: `<path d="M27 33.6 Q32 36 37 33.6" fill="none" stroke-width="1"/>`
    });
}

function horse(v) {
    const fur = v.celestial ? '#f4e6b8' : '#f1ece2', furD = v.celestial ? '#d9c486' : '#cfc6b6', mane = v.celestial ? '#7aa7d8' : '#8a6a4a';
    return beast({
        fur, furD, belly: v.celestial ? '#fbf3d8' : '#e2d7c6', limb: furD, ears: 'pointy', earIn: '#f2b8b0', snout: 'long', headRy: 12.6, headY: 23,
        back: TAIL(mane, 'M42 54 Q57 52 54 36 Q50 40 41 47Z'),
        top: `<path d="M24 14 Q28 6 34 9 Q40 7 41 13 Q36 11 33 14 Q30 12 27 16 Q26 13 24 14Z" fill="${mane}"/>` +
            `<path d="M46 18 Q51 26 47 34 Q47 26 44 21Z" fill="${mane}"/>` +
            (v.celestial ? `<path d="M10 52 Q10 47 15 48 Q17 44 21 47 Q25 46 24 51 Q22 55 15 54 Q10 55 10 52Z" fill="#fff"/>` + sparkle(12, 30) + sparkle(54, 14) : '')
    });
}

function goat() {
    return beast({
        fur: '#efe7d6', furD: '#cdbfa6', belly: '#f8f2e6', limb: '#cdbfa6', ears: 'side', earC: '#efe7d6', snout: 'small',
        behindHead: `<path d="M24 15 Q20 3 30 4 Q25 7 27.6 14Z" fill="#a8916c"/><path d="M40 15 Q44 3 34 4 Q39 7 36.4 14Z" fill="#a8916c"/>`,
        top: `<path d="M29 35 Q32 44 35 35Z" fill="#efe7d6"/>`,
        back: TAIL('#efe7d6', 'M42 50 Q50 46 48 40 Q45 43 41 46Z')
    });
}

function dog() {
    return beast({
        fur: '#d9a066', furD: '#b47c44', belly: '#f6e2c4', ears: 'floppy', earC: '#8a5a33', snout: 'small',
        back: TAIL('#d9a066', 'M42 52 Q54 50 53 40 Q50 42 47 44 Q46 48 41 48Z'),
        face: `<path d="M38 20 Q44 18 44 26 Q40 26 38 20Z" fill="#8a5a33" ${N}/>`,
        top: `<path d="M24 34.8 L40 34.8 L39 38.4 L25 38.4Z" fill="#c45a4a"/><circle cx="32" cy="39.6" r="1.8" fill="#f2c14e"/>`
    });
}

function wolf(v) {
    const fur = v.ember ? '#6b5a54' : '#8a8f99', furD = v.ember ? '#4e403b' : '#6b6f7a';
    return beast({
        fur, furD, belly: '#ece4da', ears: 'pointy', earIn: v.ember ? '#f08a3a' : '#ece4da', snout: 'small',
        back: TAIL(fur, 'M42 54 Q58 54 56 40 Q54 36 51 38 Q53 48 41 49Z') + (v.ember ? `<path d="M55.4 39 Q54 35 51.4 37.6 Q53 39 55.4 39Z" fill="#f08a3a" ${N}/>` : ''),
        top: v.ember ? sparkle(14, 36, '#f6b24a') + sparkle(52, 18, '#f6b24a') : ''
    });
}

function fox(v, fennec) {
    const fur = fennec ? '#e8c38a' : '#e07a2e', furD = fennec ? '#c99f62' : '#b85a1c';
    return beast({
        fur, furD, belly: '#fbf1e2', limb: fennec ? furD : '#4a3326', ears: fennec ? 'big' : 'pointy', earIn: fennec ? '#f6c9b0' : '#4a3326', snout: 'small',
        back: TAIL(fur, 'M42 54 Q60 56 57 38 Q55 30 49 33 Q53 46 41 48Z') + `<path d="M57.4 40 Q57 31 49.6 33.2 Q53 35 54 41Z" fill="#fbf1e2"/>`,
        face: `<path d="M18.4 27 Q24 26 28 31 Q32 35 36 31 Q40 26 45.6 27 Q44 35 32 36.8 Q20 35 18.4 27Z" fill="#fbf1e2" ${N}/>`
    });
}

function panda(v) {
    return beast({
        fur: '#f6f4ee', furD: '#d8d4ca', belly: '#ffffff', limb: '#2a2a32', ears: 'round', earC: '#2a2a32', snout: 'small',
        face: `<ellipse cx="25.4" cy="25.6" rx="3.8" ry="4.6" transform="rotate(25 25.4 25.6)" fill="#2a2a32" ${N}/><ellipse cx="38.6" cy="25.6" rx="3.8" ry="4.6" transform="rotate(-25 38.6 25.6)" fill="#2a2a32" ${N}/>`,
        held: v.scroll
            ? `<rect x="24" y="44" width="16" height="5" rx="2.4" fill="#f4ecd8"/><circle cx="24" cy="46.5" r="2.4" fill="#a8683a"/><circle cx="40" cy="46.5" r="2.4" fill="#a8683a"/>`
            : `<path d="M44 30 L48 58" fill="none" stroke="#5d8a4a" stroke-width="3"/><path d="M46 38 Q53 34 54 29 Q49 32 46 38Z" fill="#7fb35a" stroke-width="1"/>`
    }).replace(/<circle cx="(\d+(?:\.\d+)?)" cy="25" r="1.7" fill="#2b1b17"/g, '<circle cx="$1" cy="25" r="1.7" fill="#fff"');
}

function rabbit(v) {
    const fur = v.jade ? '#d6efe0' : '#f8f6f2', furD = v.jade ? '#9ccbb0' : '#d9d4ce';
    return beast({
        fur, furD, belly: '#ffffff', ears: 'long', earIn: '#f6b8c4', snout: 'small', headY: 27,
        back: `<circle cx="45" cy="53" r="4.2" fill="#fff"/>`,
        held: (v.pestle || v.jade)
            ? `<path d="M22 50 L44 50 L41 58 L25 58Z" fill="#c9a448"/><path d="M38 34 L33 48" fill="none" stroke="#8a5a33" stroke-width="3"/>`
            : '',
        top: v.jade || v.pestle ? sparkle(12, 20) + sparkle(54, 32) : ''
    });
}

function monkey(v) {
    return beast({
        fur: '#8a5a33', furD: '#6a4226', belly: '#e8c39a', ears: 'monkey', earIn: '#e8c39a', snout: 'small',
        back: TAIL('#8a5a33', 'M43 53 Q58 54 56 42 Q55 36 50 38 Q48 40 51 42 Q53 41 52.4 44 Q51 49 42 49Z'),
        face: `<path d="M20.4 27 Q20 18 26 18.6 Q30 19 32 22 Q34 19 38 18.6 Q44 18 43.6 27 Q43 36 32 36.4 Q21 36 20.4 27Z" fill="#e8c39a" ${N}/>`,
        held: v.peach ? `<circle cx="32" cy="46" r="5.4" fill="#f6a0a0"/><path d="M32 41 Q32 46 32 50" fill="none" stroke="#e07a7a" stroke-width="1"/><path d="M32 41 Q37 37 39 40 Q35 42 32 41Z" fill="#7fb35a" stroke-width="1"/>` : '',
        top: `<path d="M28 14 Q32 9 33 14 Q35 10 36 14" fill="none" stroke="#6a4226" stroke-width="1.6"/>`
    });
}

function camel() {
    return beast({
        fur: '#d2a86c', furD: '#ad844c', belly: '#ecd4aa', ears: 'side', snout: 'long', eyes: 'sleepy', headY: 23,
        back: `<path d="M34 42 Q38 22 48 26 Q58 30 54 50Z" fill="#d2a86c"/><path d="M47 28 Q55 32 53 46 Q52 36 47 28Z" fill="#ad844c" ${N}/>`,
        top: `<path d="M24 14 Q32 8 40 14 Q36 12 32 13 Q28 12 24 14Z" fill="#ad844c"/>` +
            `<path d="M18 38 L46 38 L44 42 L20 42Z" fill="#c45a4a"/><path d="M22 42 L24 45 M28 42 L30 45 M34 42 L36 45 M40 42 L42 45" fill="none" stroke="#f2c14e" stroke-width="1.4"/>`
    });
}

function weasel() {
    return beast({
        fur: '#d9a441', furD: '#b07f26', belly: '#fbf1d8', ears: 'small', earIn: '#b07f26', snout: 'small', headRx: 15.4, headRy: 10.4, headY: 26,
        back: TAIL('#d9a441', 'M42 54 Q60 56 58 44 Q56 38 52 40 Q54 50 41 49Z') + `<path d="M58.4 45 Q57 38 52.6 40.4 Q55 42 55.4 46Z" fill="#6a4226" ${N}/>`,
        face: `<path d="M18 24 Q24 21 30 25 L34 25 Q40 21 46 24 Q42 28 36 27 L28 27 Q22 28 18 24Z" fill="#8a5a24" ${N}/>` +
            `<path d="M20 29 Q32 40 44 29 Q38 36.4 32 36.4 Q26 36.4 20 29Z" fill="#fbf1d8" ${N}/>`
    });
}

// ---------- oiseaux ----------
function bird(p) {
    const { body, bodyD, belly, beak, legC = '#e0902a' } = p;
    const long = p.long, hy = long ? 15 : 24, hr = long ? 8.6 : 11.4, by = long ? 40 : 43;
    let s = `<path d="M28 52 L28 57.6 M36 52 L36 57.6" fill="none" stroke="${legC}" stroke-width="2.4"/>` +
        `<path d="M24.6 58 L28 56 L31 58 M33 58 L36 56 L39.4 58" fill="none" stroke="${legC}" stroke-width="1.8"/>`;
    if (p.tail) s += p.tail;
    s += `<ellipse cx="32" cy="${by}" rx="14" ry="12.4" fill="${body}"/>` +
        `<ellipse cx="32" cy="${by + 3}" rx="8" ry="8.4" fill="${belly}" ${N}/><ellipse cx="32" cy="${by}" rx="14" ry="12.4" fill="none"/>` +
        `<path d="M18.6 ${by - 5} Q12 ${by + 2} 17 ${by + 9} Q21 ${by + 5} 21.4 ${by - 2}Z" fill="${bodyD}"/>` +
        `<path d="M45.4 ${by - 5} Q52 ${by + 2} 47 ${by + 9} Q43 ${by + 5} 42.6 ${by - 2}Z" fill="${bodyD}"/>`;
    if (long) s += `<path d="M28.6 ${hy + 4} Q27.6 ${by - 8} 25 ${by - 9} L39 ${by - 9} Q36.4 ${by - 8} 35.4 ${hy + 4}Z" fill="${p.neck || body}"/>`;
    if (p.crest) s += p.crest;
    s += `<circle cx="32" cy="${hy}" r="${hr}" fill="${p.head || body}"/>` + shine(32 - hr * .45, hy - hr * .5) + (p.face || '');
    s += (long ? eyes(hy - 1, 4, 1.5) : eyes(hy - 1, 5)) +
        `<path d="M28.4 ${hy + 2.4} L32 ${hy + (p.longBeak ? 9 : 6)} L35.6 ${hy + 2.4} Q32 ${hy + .8} 28.4 ${hy + 2.4}Z" fill="${beak}"/>` +
        cheeks(hy + 3, long ? 6 : 8);
    return wrap(s + (p.top || ''));
}

function crow(v) {
    const b = v.moon ? '#3a3350' : '#2c2c36';
    return bird({
        body: b, bodyD: v.moon ? '#25203a' : '#1b1b22', belly: v.moon ? '#4e4670' : '#3e3e4a', beak: '#9aa0aa', legC: '#5a5a66',
        tail: `<path d="M26 50 L22 58 L32 54 L42 58 L38 50Z" fill="${b}"/>`,
        face: `<circle cx="26.4" cy="23" r="3" fill="#fff" ${N}/><circle cx="37.6" cy="23" r="3" fill="#fff" ${N}/>`,
        top: v.moon ? `<path d="M48 6 A6 6 0 1 0 54 14 A4.6 4.6 0 1 1 48 6Z" fill="#fbe7b0"/>` : `<path d="M29 13 Q31 8 33 13 Q35 9 36 14" fill="none" stroke-width="1.6"/>`
    });
}
const goose = () => bird({ body: '#b8ab98', bodyD: '#8f8170', belly: '#ece4d6', beak: '#2c2c36', legC: '#2c2c36', long: true, head: '#2c2c36', neck: '#2c2c36',
    face: `<circle cx="28" cy="14" r="2.6" fill="#fff" ${N}/><circle cx="36" cy="14" r="2.6" fill="#fff" ${N}/><path d="M25 17.6 Q32 22.6 39 17.6 Q37 22.4 32 23 Q27 22.4 25 17.6Z" fill="#fff" ${N}/>` });
const gull = () => bird({ body: '#ffffff', bodyD: '#b8c0cc', belly: '#ffffff', beak: '#f2c14e', legC: '#e8a03a',
    tail: `<path d="M26 50 L24 57 L32 54 L40 57 L38 50Z" fill="#b8c0cc"/>` });
const crane = () => bird({ body: '#ffffff', bodyD: '#2c2c36', belly: '#ffffff', beak: '#c9b48a', legC: '#3a3a44', long: true, longBeak: true, neck: '#2c2c36',
    crest: `<ellipse cx="32" cy="7" rx="4" ry="2.4" fill="#d9302e"/>` });
const chick = v => bird({ body: v.phoenix ? '#f6a83a' : '#f6d860', bodyD: v.phoenix ? '#e05a2a' : '#e0b83a', belly: v.phoenix ? '#fbe08a' : '#fbefb0', beak: '#e8703a',
    crest: v.phoenix ? `<path d="M28 15 Q24 4 30 6 Q30 0 34 4 Q38 0 37 8 Q42 6 37 15Z" fill="#e8402e"/>` : '',
    tail: v.phoenix ? `<path d="M40 50 Q52 54 58 44 Q54 52 48 48 Q56 46 56 38 Q50 46 43 45Z" fill="#e8402e"/>` : '' });

// ---------- eau ----------
function carp(v) {
    const c = v.lava ? '#e8452e' : '#f29a2e', cd = v.lava ? '#a8281e' : '#c96a1c', pool = v.lava ? '#f6a83a' : '#7ec0e0', poolD = v.lava ? '#d9572e' : '#4a8ab0';
    return wrap(`<ellipse cx="32" cy="54.6" rx="22" ry="5" fill="${pool}"/><path d="M16 54 Q24 52 32 54 Q40 56 48 54" fill="none" stroke="${poolD}" stroke-width="1.4"/>` +
        `<path d="M14 26 L4 16 Q6 30 4 44 L14 34Z" fill="${cd}"/>` +
        `<path d="M28 20 Q34 10 42 20Z" fill="${cd}"/><path d="M30 42 Q34 50 40 42Z" fill="${cd}"/>` +
        `<ellipse cx="32" cy="30" rx="20" ry="12.6" fill="${c}"/><path d="M26 22 Q30 30 26 38 M34 21 Q38 30 34 39" fill="none" stroke="${cd}" stroke-width="1.4"/>` +
        shine(24, 23) + `<circle cx="44" cy="26.6" r="3.4" fill="#fff"/><circle cx="44.8" cy="26.6" r="1.8" fill="${K}" ${N}/>` +
        `<path d="M49 33 Q51.4 34.4 49.6 36" fill="none" stroke-width="1.4"/><path d="M50 34 Q56 36 55 42" fill="none" stroke="${cd}" stroke-width="1.2"/>` +
        (v.lava ? `<path d="M22 12 Q20 8 23 5 M44 10 Q46 6 44 3" fill="none" stroke="#9aa0aa" stroke-width="1.4"/>` : `<circle cx="54" cy="16" r="2.2" fill="#d8f0ff"/><circle cx="57" cy="10" r="1.4" fill="#d8f0ff"/>`));
}

function whale() {
    return wrap(`<path d="M8 54 Q6 47 13 47 Q15 41 22 44 Q27 40 32 44 Q37 40 42 44 Q49 41 51 47 Q58 47 56 54 Q32 58 8 54Z" fill="#fff"/>` +
        `<path d="M52 30 L62 22 Q60 33 62 42 L52 38Z" fill="#3a6ea8"/>` +
        `<path d="M8 32 Q8 16 30 16 Q54 16 54 34 Q54 46 32 47 Q8 47 8 32Z" fill="#4a8ad0"/>` +
        `<path d="M10 36 Q20 46 32 46 Q48 46 53 38 Q44 42 32 42 Q18 42 10 36Z" fill="#dcecf8"/>` + shine(18, 21) +
        `<circle cx="20" cy="30" r="1.8" fill="${K}" ${N}/><circle cx="20.6" cy="29.4" r=".6" fill="#fff" ${N}/>` +
        `<path d="M12.6 36 Q16 38.6 20 37" fill="none" stroke-width="1.2"/>` + cheeks(34, -9) +
        `<path d="M30 16 Q28 8 24 6 M30 16 Q32 8 36 6 M30 16 L30 7" fill="none" stroke="#9fd0f0" stroke-width="2"/>`);
}

function jellyfish() {
    return wrap(`<path d="M22 36 Q18 46 22 56 M28 37 Q26 47 30 57 M36 37 Q38 47 34 57 M42 36 Q46 46 42 56" fill="none" stroke="#c48ad8" stroke-width="2.4"/>` +
        `<path d="M12 34 Q12 12 32 12 Q52 12 52 34 Q48 38 44 34 Q40 38 36 34 Q32 38 28 34 Q24 38 20 34 Q16 38 12 34Z" fill="#e6b8f0" fill-opacity=".9"/>` +
        `<path d="M18 26 Q20 16 30 15" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>` + sleepy(26, 6) + smile(29.6) + cheeks(28.6, 10) +
        `<circle cx="10" cy="14" r="2" fill="#d8f0ff"/><circle cx="54" cy="10" r="1.4" fill="#d8f0ff"/>`);
}

function octopus(v) {
    let s = '';
    [[14, 52, 18, 44], [22, 57, 25, 46], [32, 58, 32, 46], [42, 57, 39, 46], [50, 52, 46, 44]]
        .forEach(([x, y, x0, y0]) => { s += `<path d="M${x0 - 3} ${y0} Q${x - 4} ${y - 4} ${x} ${y} Q${x + 2} ${y - 6} ${x0 + 3} ${y0}Z" fill="#d86a8a"/>`; });
    s += `<path d="M14 34 Q12 12 32 12 Q52 12 50 34 Q50 48 32 48 Q14 48 14 34Z" fill="#e8809e"/>` +
        `<path d="M44 20 Q50 30 46 42 Q50 30 44 20Z" fill="#c45a7a" ${N}/>` + shine(22, 18) +
        `<circle cx="24" cy="38" r="1.4" fill="#f6b8c8" ${N}/><circle cx="40" cy="40" r="1.4" fill="#f6b8c8" ${N}/>` +
        eyes(30, 6) + cheeks(34, 10) + smile(35);
    if (v.chef) s += `<path d="M22 16 Q16 6 24 4 Q28 -1 33 3 Q40 0 41 6 Q48 8 42 16Z" fill="#fff"/><rect x="22" y="13" width="20" height="5" rx="1.4" fill="#fff"/>`;
    return wrap(s);
}

function crab() {
    const c = '#d9452e', d = '#a8281e';
    return wrap(`<path d="M18 46 L10 54 M20 49 L14 57 M46 46 L54 54 M44 49 L50 57" fill="none" stroke="${d}" stroke-width="2.6"/>` +
        `<path d="M18 38 Q12 32 12 24" fill="none" stroke="${c}" stroke-width="3"/><path d="M46 38 Q52 32 52 24" fill="none" stroke="${c}" stroke-width="3"/>` +
        `<path d="M6 22 Q6 12 13 12 Q18 14 14 19 Q18 22 16 26 Q10 28 6 22Z" fill="${c}"/><path d="M58 22 Q58 12 51 12 Q46 14 50 19 Q46 22 48 26 Q54 28 58 22Z" fill="${c}"/>` +
        `<path d="M27 32 L26 22 M37 32 L38 22" fill="none" stroke="${c}" stroke-width="2.4"/>` +
        `<circle cx="26" cy="20" r="3.6" fill="#fff"/><circle cx="38" cy="20" r="3.6" fill="#fff"/><circle cx="26.6" cy="20.4" r="1.7" fill="${K}" ${N}/><circle cx="38.6" cy="20.4" r="1.7" fill="${K}" ${N}/>` +
        `<path d="M10 42 Q10 28 32 28 Q54 28 54 42 Q54 52 32 52 Q10 52 10 42Z" fill="${c}"/>` +
        `<path d="M44 33 Q52 40 46 50 Q50 40 44 33Z" fill="${d}" ${N}/>` + shine(20, 33) +
        `<path d="M27 42 Q32 39 37 42" fill="none" stroke-width="1.4"/><path d="M24 45 Q28 47 29 45" fill="none" stroke="#fbe7b0" stroke-width="1.2"/>` +
        `<path d="M23 38 L29 39 M41 38 L35 39" fill="none" stroke-width="1.6"/>`);
}

// ---------- reptiles et amphibiens ----------
function toad() {
    const c = '#7a9a4a', d = '#5a7634', b = '#d8dca0';
    return wrap(`<ellipse cx="20" cy="56.4" rx="7" ry="2.8" fill="${d}"/><ellipse cx="44" cy="56.4" rx="7" ry="2.8" fill="${d}"/>` +
        `<path d="M8 46 Q6 26 32 26 Q58 26 56 46 Q54 57 32 57 Q10 57 8 46Z" fill="${c}"/>` +
        `<ellipse cx="32" cy="48" rx="13" ry="7.6" fill="${b}"/>` +
        `<path d="M46 32 Q56 40 52 52 Q53 40 46 32Z" fill="${d}" ${N}/>` +
        `<circle cx="20" cy="24" r="7" fill="${c}"/><circle cx="44" cy="24" r="7" fill="${c}"/>` +
        `<circle cx="20" cy="24" r="4.4" fill="#fbf1b0"/><circle cx="44" cy="24" r="4.4" fill="#fbf1b0"/>` +
        `<path d="M16.6 24 L23.4 24 M40.6 24 L47.4 24" fill="none" stroke-width="2"/>` +
        `<circle cx="16" cy="36" r="1.6" fill="${d}" ${N}/><circle cx="48" cy="38" r="1.6" fill="${d}" ${N}/><circle cx="40" cy="31" r="1.2" fill="${d}" ${N}/>` +
        `<path d="M18 37 Q32 44 46 37" fill="none" stroke-width="1.6"/>` + cheeks(37, 15) +
        `<ellipse cx="17" cy="51" rx="4" ry="3" fill="${c}"/><ellipse cx="47" cy="51" rx="4" ry="3" fill="${c}"/>`);
}

function turtle() {
    const skin = '#7a8a5a', sd = '#5a6a3e', shell = '#2e3a34', rim = '#4e5c50';
    return wrap(`<ellipse cx="18" cy="55" rx="5.4" ry="3.4" fill="${skin}"/><ellipse cx="46" cy="55" rx="5.4" ry="3.4" fill="${skin}"/>` +
        `<path d="M6 48 Q6 28 32 28 Q58 28 58 48 Q46 54 32 54 Q18 54 6 48Z" fill="${shell}"/>` +
        `<path d="M6 48 Q18 53 32 53 Q46 53 58 48 L57 51 Q46 57 32 57 Q18 57 7 51Z" fill="${rim}"/>` +
        `<path d="M24 32 L40 32 L44 42 L32 48 L20 42Z" fill="${rim}" stroke-width="1.4"/><path d="M12 40 L20 42 M52 40 L44 42 M24 32 L20 30 M40 32 L44 30" fill="none" stroke="${rim}" stroke-width="1.4"/>` +
        `<ellipse cx="32" cy="22" rx="11.6" ry="10" fill="${skin}"/><path d="M38 16 Q44 22 40 30 Q42 22 38 16Z" fill="${sd}" ${N}/>` +
        sleepy(21, 4.6) + smile(26) + cheeks(24.4, 7) +
        `<path d="M24 12 Q32 6 40 12" fill="none" stroke="${sd}" stroke-width="1.4"/><path d="M28 31 Q32 36 36 31" fill="none" stroke="#ece8e0" stroke-width="2"/>`);
}

function salamander() {
    const c = '#e2583a', d = '#b03a22', b = '#f6c08a';
    return beast({
        fur: c, furD: d, belly: b, limb: c, ears: null, snout: null, headRx: 14.6, headRy: 11,
        back: TAIL(c, 'M42 54 Q60 58 60 46 Q60 38 54 36 Q56 44 52 48 Q48 50 41 49Z') + `<circle cx="55" cy="44" r="1.6" fill="#f6c84a" ${N}/>`,
        face: `<circle cx="22" cy="18" r="1.6" fill="#f6c84a" ${N}/><circle cx="42" cy="18" r="1.6" fill="#f6c84a" ${N}/><circle cx="32" cy="15.6" r="1.4" fill="#f6c84a" ${N}/>` +
            `<path d="M24 30 Q32 34 40 30" fill="none" stroke-width="1.4"/>`,
        top: `<circle cx="24" cy="42" r="1.4" fill="#f6c84a" ${N}/><circle cx="40" cy="52" r="1.4" fill="#f6c84a" ${N}/>`
    });
}

function snake(v) {
    const c = v.scholar ? '#f4f2ea' : '#6a9a4a', d = v.scholar ? '#c8c2b0' : '#4a7634', b = v.scholar ? '#fffdf6' : '#d8e8a0';
    return wrap(`<ellipse cx="32" cy="52" rx="22" ry="6.4" fill="${c}"/><path d="M44 47 Q56 49 54 55 Q50 52 42 51Z" fill="${d}" ${N}/>` +
        `<ellipse cx="32" cy="44" rx="16" ry="5.6" fill="${c}"/><path d="M50 52 Q60 50 58 44" fill="none" stroke="${c}" stroke-width="3.4"/>` +
        `<path d="M26 44 Q24 32 30 26 L36 28 Q32 34 36 42Z" fill="${c}"/>` +
        `<path d="M28 42 Q27 34 31 29" fill="none" stroke="${b}" stroke-width="2.4"/>` +
        `<ellipse cx="32" cy="20" rx="11" ry="8.6" fill="${c}"/>` + shine(27, 16) +
        eyes(19, 4.6) + cheeks(22.4, 7.4) + `<path d="M30 25 L32 26 L34 25" fill="none" stroke-width="1.2"/><path d="M32 26.4 L32 30 M32 30 L30.6 31.6 M32 30 L33.4 31.6" fill="none" stroke="#d9302e" stroke-width="1"/>` +
        (v.scholar ? `<path d="M22 13 Q32 6 42 13 L40 15 Q32 11 24 15Z" fill="#26202e"/><rect x="29" y="5.6" width="6" height="5" rx="1" fill="#26202e"/><path d="M42 13 L48 16" fill="none" stroke-width="1.6"/>` +
            `<rect x="40" y="38" width="12" height="4.4" rx="2" fill="#f4ecd8"/><circle cx="40" cy="40.2" r="1.8" fill="#a8683a"/><circle cx="52" cy="40.2" r="1.8" fill="#a8683a"/>` : ''));
}

function dragon(v) {
    const c = v.paper ? '#f2c14e' : '#d9452e', d = v.paper ? '#c9963a' : '#a8281e', b = v.paper ? '#fbf1d8' : '#f6c08a', mane = v.paper ? '#d9452e' : '#f2a03a';
    return beast({
        fur: c, furD: d, belly: b, ears: 'pointy', earIn: b, snout: 'muzzle',
        back: TAIL(c, 'M42 54 Q60 54 57 40 Q55 34 50 36 Q54 46 41 48Z') + `<path d="M50 36 L54 30 L55 36 L59 33 L57 40Z" fill="${mane}"/>`,
        behindHead: `<path d="M24 14 Q20 4 24 2 Q25 8 28 12Z" fill="#fbe7b0"/><path d="M40 14 Q44 4 40 2 Q39 8 36 12Z" fill="#fbe7b0"/>` +
            `<path d="M17 22 Q10 22 9 30 Q14 27 18 28Z" fill="${mane}"/><path d="M47 22 Q54 22 55 30 Q50 27 46 28Z" fill="${mane}"/>`,
        top: `<path d="M26 32 Q20 34 18 40 M38 32 Q44 34 46 40" fill="none" stroke="${mane}" stroke-width="1.6"/>` +
            (v.paper ? `<path d="M19 46 L45 46 M18.4 51 L45.6 51" fill="none" stroke="${d}" stroke-width="1.2" stroke-dasharray="2 2"/><path d="M32 59 L32 63" fill="none" stroke="#8a5a33" stroke-width="2"/>` : sparkle(52, 14, '#f6b24a'))
    });
}

// ---------- esprits, objets animés, êtres fabuleux ----------
function scarecrow() {
    const sack = '#e2cc98', sackD = '#c4aa70', robe = '#7a6a4a', robeD = '#5a4c34', straw = '#e8c860';
    return wrap(`<rect x="30" y="34" width="4" height="24" fill="#8a5a33"/>` +
        `<path d="M4 34 L60 34" fill="none" stroke="#8a5a33" stroke-width="4"/>` +
        `<path d="M2 32 L6 34 L2 37 M62 32 L58 34 L62 37" fill="none" stroke="${straw}" stroke-width="2"/>` +
        `<path d="M20 32 L44 32 L47 50 L42 48 L38 52 L32 49 L26 52 L22 48 L17 50Z" fill="${robe}"/>` +
        `<path d="M38 34 L44 34 L46 48 L42 47Z" fill="${robeD}" ${N}/><rect x="24" y="38" width="7" height="6" fill="#b84a3a" stroke-width="1.4"/>` +
        `<path d="M25 38 L30 44 M30 38 L25 44" fill="none" stroke="#fbe7b0" stroke-width=".8"/>` +
        `<path d="M8 36 L6 30 M10 36 L10 30 M56 36 L58 30 M54 36 L54 30" fill="none" stroke="${straw}" stroke-width="1.6"/>` +
        `<path d="M27 50 L26 56 M32 50 L33 57 M37 50 L38 56" fill="none" stroke="${straw}" stroke-width="1.6"/>` +
        `<ellipse cx="32" cy="22" rx="12" ry="11" fill="${sack}"/><path d="M38 14 Q46 22 40 31 Q42 22 38 14Z" fill="${sackD}" ${N}/>` +
        `<path d="M24 32 Q32 35 40 32 L38 35 Q32 37 26 35Z" fill="${straw}" stroke-width="1.4"/>` +
        `<path d="M24.4 20 L29 24 M29 20 L24.4 24 M35 20 L39.6 24 M39.6 20 L35 24" fill="none" stroke-width="1.8"/>` +
        `<path d="M25 28 Q32 31 39 28" fill="none" stroke-width="1.4"/><path d="M27 27 L27.6 29.6 M30 28 L30 30.4 M34 28 L34 30.4 M37 27 L36.4 29.6" fill="none" stroke-width="1"/>` +
        `<ellipse cx="22" cy="26" rx="2.2" ry="1.4" fill="#e8806a" opacity=".5" ${N}/>` +
        `<path d="M6 14 L32 2 L58 14 Q32 19 6 14Z" fill="${straw}"/><path d="M12 13.4 Q32 17 52 13.4" fill="none" stroke="#b8923a" stroke-width="1.4"/>` +
        `<path d="M20 9 L32 3.6 L44 9" fill="none" stroke="#b8923a" stroke-width="1"/>` +
        `<path d="M50 6 Q54 2 57 4" fill="none" stroke="${K}" stroke-width="1.6"/><circle cx="56" cy="4.4" r="1.4" fill="${K}"/>`);
}

function ghost(v) {
    const c = '#dcecf6', d = '#a8c4dc';
    let s = `<path d="M14 30 Q14 10 32 10 Q50 10 50 30 L50 50 Q47 46 44 50 Q41 54 38 50 Q35 46 32 52 Q29 56 26 50 Q23 46 20 51 Q17 56 14 50Z" fill="${c}" fill-opacity=".92"/>` +
        `<path d="M42 16 Q50 26 48 46 Q46 44 44 46 Q46 30 42 16Z" fill="${d}" ${N}/>` +
        `<path d="M14 36 Q6 34 6 40 Q10 38 15 42Z" fill="${c}"/><path d="M50 36 Q58 34 58 40 Q54 38 49 42Z" fill="${c}"/>` + shine(22, 18) +
        `<ellipse cx="26" cy="27" rx="2.4" ry="3.2" fill="${K}" ${N}/><ellipse cx="38" cy="27" rx="2.4" ry="3.2" fill="${K}" ${N}/>` +
        `<ellipse cx="32" cy="35" rx="2.4" ry="3" fill="${K}" ${N}/>` + cheeks(31, 10, '#b8a8e0') +
        `<path d="M8 56 Q12 52 16 56 M48 56 Q52 52 56 56" fill="none" stroke="#a8c4dc" stroke-width="1.6" opacity=".7"/>`;
    if (v.hat === 'captain') s += `<path d="M14 18 Q32 4 50 18 Q32 14 14 18Z" fill="#26304a"/><path d="M18 16 Q32 10 46 16" fill="none" stroke="#f2c14e" stroke-width="1.4"/><circle cx="32" cy="12" r="2" fill="#f2c14e"/>`;
    else if (v.hat === 'miner') s += `<path d="M17 20 Q16 8 32 8 Q48 8 47 20Z" fill="#c9a448"/><rect x="14" y="18" width="36" height="3.4" rx="1.6" fill="#9c7d2e"/>` +
        `<rect x="29" y="11" width="6" height="5" rx="1" fill="#f4ecd8"/><path d="M32 11 Q30 7 32 4 Q34 7 32 11Z" fill="#f6b24a" stroke-width="1"/>`;
    else if (v.hat === 'rider') s += `<path d="M16 19 Q15 6 32 6 Q49 6 48 19 Q32 15 16 19Z" fill="#8a3a2a"/><path d="M15 19 Q32 14 49 19 L49 22 Q32 18 15 22Z" fill="#e8d6b8"/><path d="M32 6 L32 1" fill="none" stroke="#c9a448" stroke-width="2"/>`;
    return wrap(s);
}

function imp() {
    const c = '#6a7a4a', d = '#4a5634', mud = '#7a5a3a';
    return wrap(`<ellipse cx="32" cy="56" rx="18" ry="3.6" fill="${mud}"/>` +
        `<path d="M20 56 Q18 42 24 38 L40 38 Q46 42 44 56Z" fill="${c}"/><path d="M38 40 Q45 46 43 55 L38 55Z" fill="${d}" ${N}/>` +
        `<path d="M22 42 L14 48 L18 50 L24 46 M42 42 L50 48 L46 50 L40 46" fill="${c}"/>` +
        `<path d="M18 22 L8 14 L19 16Z" fill="${c}"/><path d="M46 22 L56 14 L45 16Z" fill="${c}"/>` +
        `<path d="M24 14 L22 4 L29 12Z" fill="#d9c4a0"/><path d="M40 14 L42 4 L35 12Z" fill="#d9c4a0"/>` +
        `<ellipse cx="32" cy="26" rx="14" ry="12" fill="${c}"/><path d="M40 18 Q48 26 42 36 Q44 26 40 18Z" fill="${d}" ${N}/>` +
        `<path d="M22 16 Q26 20 24 26 M42 18 Q38 24 41 30" fill="none" stroke="${mud}" stroke-width="2.4" opacity=".8"/>` +
        `<circle cx="26.4" cy="25" r="3" fill="#f6e86a"/><circle cx="37.6" cy="25" r="3" fill="#f6e86a"/><circle cx="26.8" cy="25.4" r="1.4" fill="${K}" ${N}/><circle cx="38" cy="25.4" r="1.4" fill="${K}" ${N}/>` +
        `<path d="M25 32 Q32 37 39 32" fill="none" stroke-width="1.4"/><path d="M28 33.4 L29 35.6 L30 33.8 M34 33.8 L35 35.6 L36 33.4" fill="#fff" stroke-width="1"/>` +
        `<path d="M26 44 Q26 50 27 52 M37 44 Q38 49 37 52" fill="none" stroke="${mud}" stroke-width="2"/>`);
}

function djinn() {
    const c = '#5a8ad8', d = '#3a68b0';
    return wrap(`<path d="M24 44 Q22 52 30 54 Q40 56 44 60 Q34 60 28 58 Q14 56 18 46Z" fill="#9fc0ec" fill-opacity=".9"/>` +
        `<path d="M20 34 Q20 46 32 48 Q44 46 44 34 Q40 30 32 30 Q24 30 20 34Z" fill="${c}"/>` +
        `<path d="M30 30 L34 30 L36 44 L32 47 L28 44Z" fill="#e8d6f0" stroke-width="1.4"/>` +
        `<path d="M21 36 L10 30 Q8 26 12 25 L22 32 M43 36 L54 30 Q56 26 52 25 L42 32" fill="${c}"/>` +
        `<rect x="10" y="26.4" width="5" height="4" rx="1" transform="rotate(-30 12.5 28.4)" fill="#f2c14e"/><rect x="49" y="26.4" width="5" height="4" rx="1" transform="rotate(30 51.5 28.4)" fill="#f2c14e"/>` +
        `<ellipse cx="32" cy="20" rx="12" ry="10.6" fill="${c}"/><path d="M38 12 Q46 20 40 29 Q42 20 38 12Z" fill="${d}" ${N}/>` + shine(26, 14) +
        `<path d="M27 9 Q32 -2 37 9Z" fill="#26202e"/><circle cx="32" cy="5" r="2" fill="#f2c14e"/>` +
        eyes(19, 4.8) + `<path d="M27 25 Q32 22 37 25 Q36 28 32 27 Q28 28 27 25Z" fill="#26202e"/>` + smile(26.4, 1.8) +
        `<circle cx="20" cy="21" r="1.6" fill="#f2c14e"/><circle cx="44" cy="21" r="1.6" fill="#f2c14e"/>`);
}

function cairn() {
    return wrap(`<path d="M10 52 Q10 44 22 44 L42 44 Q54 44 54 52 Q54 58 32 58 Q10 58 10 52Z" fill="#8a8a86"/>` +
        `<path d="M14 36 Q14 28 32 28 Q50 28 50 36 Q50 44 32 44 Q14 44 14 36Z" fill="#a8a8a2"/>` +
        `<path d="M42 30 Q50 34 46 42 Q46 36 42 30Z" fill="#888882" ${N}/>` +
        `<path d="M20 22 Q20 12 32 12 Q44 12 44 22 Q44 28 32 28 Q20 28 20 22Z" fill="#9a9a94"/>` +
        `<ellipse cx="32" cy="9" rx="6" ry="3.6" fill="#b4b4ae"/>` +
        `<path d="M14 36 Q18 31 24 33 Q22 30 16 31Z" fill="#7a9a4a"/><path d="M20 22 Q24 17 30 19 Q26 14 21 18Z" fill="#7a9a4a"/><path d="M12 52 Q16 47 22 49 Q16 45 12 49Z" fill="#7a9a4a"/>` +
        eyes(35, 6) + cheeks(39, 10) + smile(40) +
        `<path d="M24 32 L27 31 M40 32 L37 31" fill="none" stroke-width="1.4"/><path d="M44 50 L48 54 M36 18 L39 21" fill="none" stroke="#6a6a66" stroke-width="1.2"/>`);
}

function flame() {
    return wrap(`<ellipse cx="32" cy="57" rx="14" ry="2.6" fill="#5a3a2e"/>` +
        `<path d="M32 2 Q40 12 46 10 Q44 18 50 22 Q56 34 50 46 Q44 57 32 57 Q20 57 14 46 Q8 34 14 22 Q18 26 20 20 Q20 10 26 12 Q28 6 32 2Z" fill="#f2702e"/>` +
        `<path d="M32 16 Q38 22 42 22 Q46 32 42 44 Q38 52 32 52 Q26 52 22 44 Q18 34 22 26 Q26 28 28 22 Q30 20 32 16Z" fill="#f6b24a" ${N}/>` +
        `<path d="M32 30 Q37 36 38 42 Q38 48 32 49 Q26 48 26 42 Q27 36 32 30Z" fill="#fbe8a0" ${N}/>` +
        eyes(36, 5.4) + cheeks(40, 9, '#e8402e') + smile(41) +
        `<path d="M8 20 Q10 16 8 12 M56 26 Q58 22 56 18" fill="none" stroke="#f6b24a" stroke-width="1.6"/>`);
}

function lantern() {
    return wrap(`<path d="M32 2 L32 8" fill="none" stroke-width="1.6"/><rect x="25" y="8" width="14" height="4" rx="1.2" fill="#c9a448"/>` +
        `<path d="M14 30 Q14 12 32 12 Q50 12 50 30 Q50 48 32 48 Q14 48 14 30Z" fill="#d9302e"/>` +
        `<path d="M24 13 Q20 30 24 47 M40 13 Q44 30 40 47" fill="none" stroke="#a8281e" stroke-width="1.4"/>` +
        `<path d="M42 16 Q50 28 44 44 Q46 28 42 16Z" fill="#a8281e" ${N}/>` + `<ellipse cx="32" cy="30" rx="9" ry="12" fill="#f6b24a" opacity=".35" ${N}/>` + shine(21, 19) +
        `<rect x="25" y="47" width="14" height="4" rx="1.2" fill="#c9a448"/><path d="M29 51 L28 58 M32 51 L32 59 M35 51 L36 58" fill="none" stroke="#f2c14e" stroke-width="1.6"/>` +
        sleepy(29, 5.6) + cheeks(33, 9, '#f6b24a') + smile(34) +
        `<path d="M24 38 Q22 41 25 42" fill="none" stroke="#fbe7b0" stroke-width="1"/>` + sparkle(8, 20) + sparkle(56, 40));
}

function bamboo() {
    const c = '#7fb35a', d = '#5d8a4a';
    return wrap(`<ellipse cx="25" cy="57.2" rx="4.4" ry="2.4" fill="${d}"/><ellipse cx="39" cy="57.2" rx="4.4" ry="2.4" fill="${d}"/>` +
        `<path d="M20 56 L20 22 Q20 14 32 14 Q44 14 44 22 L44 56 Q32 59 20 56Z" fill="${c}"/>` +
        `<path d="M38 18 Q44 22 44 30 L44 55 L39 56Z" fill="${d}" ${N}/>` +
        `<path d="M20 38 Q32 41 44 38 M20 50 Q32 53 44 50" fill="none" stroke-width="1.6"/>` +
        `<path d="M20 42 Q12 40 10 32 Q16 34 20 38 M44 44 Q52 42 54 34 Q48 36 44 40" fill="${c}"/>` +
        `<path d="M30 14 Q22 2 14 4 Q20 10 30 14Z" fill="#9fd06a"/><path d="M33 14 Q40 0 50 2 Q44 10 33 14Z" fill="#9fd06a"/><path d="M32 14 Q32 6 34 2" fill="none" stroke="${d}" stroke-width="1.4"/>` +
        eyes(26, 5.4) + cheeks(30, 8.6) + smile(31) + shine(25, 19));
}

function tree() {
    const bark = '#8a5a33', barkD = '#6a4226', leaf = '#5d8a4a', leafL = '#7fb35a';
    return wrap(`<path d="M14 58 Q18 52 20 46 M50 58 Q46 52 44 46 M24 58 Q26 54 26 50 M40 58 Q38 54 38 50" fill="none" stroke="${barkD}" stroke-width="3"/>` +
        `<path d="M18 52 L20 26 L44 26 L46 52 Q32 56 18 52Z" fill="${bark}"/><path d="M38 28 L44 28 L45.4 52 L40 53Z" fill="${barkD}" ${N}/>` +
        `<path d="M24 42 Q26 48 24 52 M41 44 Q40 48 42 51" fill="none" stroke="${barkD}" stroke-width="1.2"/>` +
        `<path d="M6 22 Q2 10 14 8 Q16 0 28 3 Q34 -2 42 4 Q54 2 56 12 Q64 18 56 26 Q52 32 42 28 L22 28 Q10 32 6 22Z" fill="${leaf}"/>` +
        `<path d="M14 12 Q20 6 28 8 M38 8 Q46 6 50 12" fill="none" stroke="${leafL}" stroke-width="2.4"/>` +
        eyes(34, 5.6) + `<path d="M23 31 L29 32 M41 31 L35 32" fill="none" stroke="#ece8e0" stroke-width="1.8"/>` +
        `<path d="M24 38 Q32 52 40 38 Q36 42 32 41 Q28 42 24 38Z" fill="${leafL}"/>` + `<path d="M29 39.4 Q32 41 35 39.4" fill="none" stroke-width="1.2"/>` +
        `<circle cx="48" cy="18" r="2.2" fill="#f6a0a0"/><circle cx="14" cy="16" r="2.2" fill="#f6a0a0"/>`);
}

function mermaid() {
    const skin = '#f5cba7', tail = '#3aa8a0', tailD = '#2a7a76', hair = '#2a5a8a';
    return wrap(`<path d="M8 58 Q10 48 22 48 L42 48 Q54 48 56 58Z" fill="#8a8a86"/>` +
        `<path d="M17 24 Q12 40 18 50 L46 50 Q52 40 47 24Z" fill="${hair}"/>` +
        `<path d="M24 38 Q22 50 30 54 Q40 58 48 52 L56 48 L54 56 L44 58 Q30 60 24 54 Q18 46 22 38Z" fill="${tail}"/>` +
        `<path d="M48 52 L58 44 Q60 50 56 54 Q60 56 58 60 L50 56Z" fill="${tailD}"/>` +
        `<path d="M28 46 Q30 44 32 46 M34 49 Q36 47 38 49 M30 51 Q32 49 34 51" fill="none" stroke="${tailD}" stroke-width="1"/>` +
        `<path d="M24 36 Q24 32 32 32 Q40 32 40 36 L40 42 Q32 44 24 42Z" fill="${skin}"/>` +
        `<path d="M24 36 Q28 40 32 37 Q36 40 40 36 L40 39 Q36 43 32 40 Q28 43 24 39Z" fill="#e8806a"/>` +
        `<ellipse cx="20.6" cy="40" rx="3.2" ry="5" transform="rotate(16 20.6 40)" fill="${skin}"/><ellipse cx="43.4" cy="40" rx="3.2" ry="5" transform="rotate(-16 43.4 40)" fill="${skin}"/>` +
        `<ellipse cx="32" cy="22" rx="12.4" ry="10.6" fill="${skin}"/>` +
        `<path d="M19.6 22 Q18 10 32 10 Q46 10 44.4 22 Q40 15 34 16 Q30 18 26 16 Q22 17 19.6 22Z" fill="${hair}"/>` +
        eyes(23, 4.8) + cheeks(27, 8) + smile(28) +
        `<circle cx="27" cy="31" r="1.4" fill="#fff"/><circle cx="37" cy="31" r="1.4" fill="#fff"/>` +
        `<path d="M38 9 L42 4 L44 9 L48 6 L46 12" fill="#f6a0b0" stroke-width="1.2"/><circle cx="20" cy="29" r="1.2" fill="#d8f0ff" ${N}/>`);
}

const DRAW = {
    buffalo, horse, goat, dog, wolf, fox, fennec: v => fox(v, true), panda, rabbit, monkey, camel, weasel,
    crow, goose, gull, crane, chick, carp, whale, jellyfish, octopus, crab, toad, turtle, salamander, snake, dragon,
    scarecrow, ghost, imp, djinn, cairn, flame, lantern, bamboo, tree, mermaid
};
export const CREATURE_KINDS = Object.keys(DRAW);

// Sprite de la créature correspondant au PNJ, ou null si c'est un humain (villagers.js prend alors le relais).
export function creatureSprite(id, hint = '') {
    const kind = creatureKind(id, hint);
    if (!kind || !DRAW[kind]) return null;
    return DRAW[kind](CREATURE_BY_ID[id] || {});
}

// Pour les tests et les aperçus : dessin d'un genre précis.
export const drawCreature = (kind, variant = {}) => DRAW[kind](variant);
