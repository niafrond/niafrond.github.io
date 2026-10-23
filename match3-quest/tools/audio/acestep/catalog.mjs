/**
 * catalog.mjs — prompts ACE-Step de toute la bande-son (une entrée par clé de piste de `musicTracks.js`).
 *
 * Pour retoucher un morceau : modifier son `style` (anglais, tags séparés par des virgules : ACE-Step comprend mieux
 * les mots-clés que les phrases) puis `node generate.mjs generate <clé>`. Les `motif` rattachent la piste à un
 * leitmotiv de `leitmotifs.json` (audio de référence envoyé à ACE-Step).
 */

/**
 * Références musicales voulues (ambiance seulement, mélodies 100 % originales) : la bande-son de Final Fantasy IX
 * (chaleur mélodique, lyrisme médiéval-féerique, thèmes très chantants) et celle des Pokémon GBA
 * (Rubis/Saphir/Émeraude, Rouge Feu : mélodies vives et accrocheuses, basses bondissantes, son GBA compact).
 * Les noms d'artistes ne sont pas utilisés ; on décrit le style. Vider la constante pour les désactiver.
 */
export const STYLE_REFERENCES = 'inspired by the warm lyrical melodic charm of Final Fantasy IX and the bright catchy compact sound of Pokemon Ruby Sapphire Emerald FireRed on Game Boy Advance';

/** Préfixe commun à TOUTES les pistes : garde l'unité sonore du jeu. */
export const GLOBAL_STYLE = [
    STYLE_REFERENCES,
    'instrumental video game soundtrack', 'early 2000s Game Boy Advance JRPG style',
    'sampled traditional Chinese instruments with chiptune accents', 'pentatonic melodic identity',
    'square and pulse wave accents', 'triangle bass', 'compact arrangement with limited polyphony',
    'one strong memorable lead melody', 'clear separation of parts', 'seamless loop',
    'no vocals', 'no cinematic orchestral bombast', 'no EDM', 'no trap', 'no sub-bass'
].filter(Boolean).join(', ');

/** Fiches d'instruments (rappel du brief) pour composer les styles. */
const I = {
    erhu: 'expressive erhu lead (Hou Yi, courage and loneliness)',
    dizi: 'agile breathy dizi (living world, wind, hope)',
    xiao: 'soft xiao (solitude, destiny, twilight)',
    pipa: 'agile plucked pipa ostinato (martial tension, arrows)',
    guzheng: 'flowing guzheng (rivers, passing time)',
    guqin: 'sparse guqin (ancient wisdom, restraint)',
    sheng: 'sustained sheng pads (celestial presence)',
    perc: 'restrained Chinese drums, woodblocks and small cymbals'
};

const TRACKS = {};
/** Déclare une piste. o = { bpm, key, dur (s), motif, mode: 'ref'|'cover' } */
const T = (key, style, o = {}) => { TRACKS[key] = { key, style, dur: 60, bpm: null, keyScale: '', motif: null, ...o }; };

/* ───────────── Scènes principales ───────────── */
T('title', `heroic and bittersweet main theme, ${I.erhu} playing the Hou Yi motif with confidence, strong triangle bass, ${I.pipa} restrained, ${I.sheng}, noble and melancholic, world burning beneath ten suns`,
    { bpm: 76, keyScale: 'D major', dur: 75, motif: 'houyi' });
T('menu', `calm menu theme, ${I.guzheng}, ${I.dizi}, gentle arpeggios, warm and inviting, Hou Yi motif hinted softly on erhu`,
    { bpm: 72, keyScale: 'D major', dur: 60, motif: 'houyi' });
T('house', `cozy home of Hou Yi and Chang'e, warm intimate, ${I.guzheng} and soft dizi, tender, safe, slow gentle waltz-like feel`,
    { bpm: 66, keyScale: 'G major', dur: 50 });
T('sanctuary', `sacred sanctuary of a sun guardian, ritual atmosphere, ${I.sheng}, ${I.guqin}, slow temple bell and low drum, sparse and ominous with a trace of the sun motif`,
    { bpm: 60, keyScale: 'D minor', dur: 60, motif: 'suns' });
T('moon', `moonlit peak, crystalline plucked guzheng and harp-like tones, very airy and spacious, ${I.xiao}, silence between phrases, Chang'e's longing`,
    { bpm: 58, keyScale: 'A minor', dur: 60 });
T('ending', `ending theme, the Hou Yi motif returns slowly on ${I.erhu} with sparse ${I.guqin} accompaniment, same melody as the heroic theme but stripped of grandeur, slower, deeply bittersweet, lament, long silences, quiet final resolution`,
    { bpm: 48, keyScale: 'D minor', dur: 70, motif: 'houyi' });
T('victory', `short triumphant fanfare of a sun fallen, ${I.dizi} and ${I.erhu} stating the Hou Yi motif, relief and warmth, bright but humble, gentle drums`,
    { bpm: 92, keyScale: 'D major', dur: 20, motif: 'houyi' });
T('defeat', `defeat jingle, fragments of the Hou Yi motif on lonely ${I.xiao}, slow, hollow, unresolved suspended harmony, long silence`,
    { bpm: 54, keyScale: 'D minor', dur: 15, motif: 'houyi' });

/* ───────────── Biomes : village (chaleureux) / sauvage (dispersé) ───────────── */
const BIOMES = {
    paddy:    { place: 'dried rice paddies and straw huts', village: `${I.dizi}, ${I.guzheng}`, wild: `${I.dizi} and sparse ${I.guqin}`, bpm: 80, key: 'D major' },
    riverbed: { place: 'cracked dry Yellow River bed', village: `${I.guzheng} flowing like a trickle of water, ${I.dizi}`, wild: `${I.xiao} and dry guzheng drops`, bpm: 70, key: 'G major' },
    bamboo:   { place: 'scorched bamboo forest', village: `wooden flute dizi, ${I.guqin}, woodblock`, wild: `${I.xiao}, crackling woodblock, pipa tremolo`, bpm: 74, key: 'E minor' },
    gobi:     { place: 'Gobi desert with mirages', village: `${I.pipa}, ${I.dizi}, caravan rhythm`, wild: `shimmering detuned pulses, ${I.xiao}, mirage illusion`, bpm: 68, key: 'A minor' },
    storm:    { place: 'Thunder Mountains', village: `${I.erhu}, steady drums, mountain smithy hammer rhythm`, wild: `${I.sheng}, distant thunder drums, ${I.pipa}`, bpm: 84, key: 'F# minor' },
    volcano:  { place: 'volcano gorges and magma', village: `low ${I.pipa}, ${I.erhu}, ember glow`, wild: `slow low pulse, ${I.pipa} tremolo, heat haze`, bpm: 78, key: 'C minor' },
    savanna:  { place: 'golden dry plain of beasts', village: `${I.dizi}, lively hand drums, ${I.guzheng}`, wild: `${I.xiao}, restless drums, wind`, bpm: 88, key: 'C major' },
    coast:    { place: 'Eastern Sea shore', village: `${I.guzheng} like gentle waves, ${I.dizi}`, wild: `${I.guzheng} arpeggios, ${I.xiao}, sea wind`, bpm: 72, key: 'F major' },
    fusang:   { place: 'golden summit of the mythical Fusang tree', village: `${I.sheng}, ${I.dizi}, golden bells`, wild: `${I.sheng}, shimmering ${I.guzheng}, celestial awe`, bpm: 66, key: 'D major' },
    moon:     { place: 'silver Moon Peak at night', village: `crystalline plucked strings, ${I.xiao}, hushed`, wild: `very sparse crystalline notes, ${I.guqin}, silence`, bpm: 56, key: 'A minor' }
};
for (const [b, d] of Object.entries(BIOMES)) {
    T(`village-${b}`, `${d.place}, village theme, warm and slow, clear melody, ${d.village}, ${I.perc} very soft, hope under a harsh sky`, { bpm: d.bpm, keyScale: d.key, dur: 55 });
    T(`wild-${b}`, `${d.place}, exploration theme, scattered phrases, gentle tension, ${d.wild}, spacious, lonely journey of Hou Yi`, { bpm: d.bpm - 8, keyScale: d.key, dur: 50, motif: b === 'moon' ? null : null });
}

/* Ton épique commun aux combats et aux boss : grand ensemble, taiko, mélodie héroïque, montées dynamiques. */
const EPIC = 'epic cinematic orchestral battle, huge taiko war drums, soaring heroic erhu and pipa lead, powerful full ensemble with layered strings and brass, driving rhythm, grand dynamic crescendos, triumphant';

/* ───────────── Combats (5 styles, progression sans jamais sonner « boss final ») ───────────── */
[
    ['light skirmish, playful pipa ostinato, quick dizi, light woodblock', 112],
    ['steady fight, driving pipa pattern, firm triangle bass, erhu counter-melody', 120],
    ['tense fight, rapid pipa arrows, snare-like woodblocks, rising dizi figure', 128],
    ['fierce fight, pulse-wave arpeggios, powerful Chinese drums, erhu lead with the Hou Yi motif fragment', 136],
    ['relentless fight, urgent pipa and square-wave ostinato, brass-like pulse stabs, bold erhu line', 144]
].forEach(([s, bpm], i) => T(`combat-${i}`, `epic battle theme, ${EPIC}, ${s}, readable memorable melody, short loop`, { bpm: bpm + 8, keyScale: ['D minor', 'E minor', 'A minor', 'G minor', 'B minor'][i], dur: 45, motif: i >= 3 ? 'houyi' : null }));

/* Ambiance commune à tous les boss : la menace doit s'entendre dès la première mesure. */
const BOSS_PERC = 'aggressive war drums, hard woodblocks, crashing cymbals';
const BOSS_MOOD = `epic cinematic boss battle, menacing, ominous dread, dangerous, threatening, aggressive, dissonant, tense, heavy low pulse, huge taiko war drums, massive full ensemble, soaring heroic melody, thundering crescendos`;

/* ───────────── Boss : dix soleils (motif céleste qui se délite) ───────────── */
const SUN = (name, detail, bpm, keyScale, rank) => ({ name, detail, bpm, keyScale, rank });
const SUNS = {
    'soleil-ardent': SUN('Ardent Sun', 'first sun, overwhelming and almost beautiful, bright upper-register ascending pattern, full dense arrangement', 138, 'D major', 0),
    'soleil-des-eaux-taries': SUN('Sun of the Dried Waters', 'dry parched feel, brittle guzheng and pipa ostinato, motif slightly thinner', 136, 'G minor', 1),
    'soleil-de-cendres': SUN('Sun of Ashes', 'ash and smoke, motif fragmenting, sudden drops in density', 134, 'E minor', 2),
    'soleil-des-mirages': SUN('Sun of Mirages', 'illusions, motif echoed and duplicated with detuned delay, shimmering', 132, 'A minor', 3),
    'soleil-des-orages': SUN('Sun of Storms', 'thunder drums, electric pulse-wave arpeggios, motif broken by lightning gaps', 140, 'F# minor', 4),
    'soleil-de-magma': SUN('Sun of Magma', 'heavy low pipa and drums, motif sunk to a lower register, molten and slow-burning', 128, 'C minor', 5),
    'soleil-des-betes-folles': SUN('Sun of Frenzied Beasts', 'stampeding drum rhythm, motif only in short wild fragments', 144, 'C minor', 6),
    'soleil-des-marees': SUN('Sun of Tides', 'surging guzheng waves, motif drifting and losing dominance, hint of relief', 120, 'F major', 7),
    'soleil-lache': SUN('Cowardly Sun', 'precision duel, tense pipa and sparse erhu, the motif almost silent, one sun hiding behind the last', 112, 'D minor', 8)
};
for (const [k, s] of Object.entries(SUNS)) {
    const fade = ['full strength', 'slightly weakened', 'weakening', 'fragmenting', 'fragmenting', 'losing dominance', 'losing dominance', 'nearly gone', 'almost silent'][s.rank];
    T(`boss-${k}`, `boss battle against the ${s.name}, ten suns celestial motif ${fade}, ${s.detail}, ${I.pipa}, ${BOSS_PERC}, Hou Yi erhu phrase answering, ${BOSS_MOOD}, deadly boss battle`,
        { bpm: s.bpm, keyScale: s.keyScale, dur: 55, motif: 'suns' });
}

/* ───────────── Boss : Feng Meng (le thème se déforme au fil des rencontres) ───────────── */
T('boss-fengmeng-le-disciple', `duel with Feng Meng the disciple, dangerous rival, aggressive low pipa figures, ${BOSS_MOOD}, the heroic motif twisted into a threat`,
    { bpm: 100, keyScale: 'D minor', dur: 50, motif: 'fengmeng' });
T('boss-fengmeng-l-archer-presse', `ambush duel of archers, Feng Meng vicious and impatient, ${BOSS_MOOD}, insistent repeated pipa rhythm, chromatic tension, unstable bass, interrupted melodic phrases, fragments of Hou Yi's motif distorted`,
    { bpm: 122, keyScale: 'D minor', dur: 50, motif: 'fengmeng' });
T('boss-fengmeng-l-archer-miroir', `final boss phase one, The Mirror Archer, Feng Meng's motif collides with and crushes Hou Yi's heroic motif, mirrored melodic lines on erhu and pipa, ${BOSS_MOOD}, personal betrayal`,
    { bpm: 132, keyScale: 'D minor', dur: 60, motif: 'fengmeng' });
T('boss-fengmeng-rage-et-desespoir', `final boss phase two, Rage and Despair, ${BOSS_MOOD}, fast broken pipa tremolo, Feng Meng motif displacing Hou Yi motif, unresolved suspensions, sudden silence before the strike, despair`,
    { bpm: 146, keyScale: 'D minor', dur: 60, motif: 'fengmeng' });

/* ───────────── Boss : gardiens et maîtres (couleur propre à la région) ───────────── */
const GUARDS = {
    'gardien-de-la-digue': ['river dam guardian, heavy slow stone steps, low drums, guzheng drops', 100, 'G minor'],
    'colosse-de-l-ecluse': ['sluice gate colossus, water and iron, rolling pipa', 104, 'G minor'],
    'gardien-des-cendres': ['ash guardian, smouldering low pulse, hollow woodwind', 108, 'E minor'],
    'chef-de-dune-bras-de-sable': ['sand dune chieftain, caravan war drums, pipa, dizi flourishes', 116, 'A minor'],
    'lion-gardien-fendu': ['cracked stone guardian lion, ritual drums, dissonant sheng stabs', 112, 'F# minor'],
    'forgeron-de-lave': ['lava blacksmith, anvil woodblock rhythm, molten low pipa', 118, 'C minor'],
    'tigre-alpha-griffe-de-feu': ['alpha tiger with fiery claws, prowling rhythm then pounce, pipa slides', 126, 'C minor'],
    'serpent-de-maree': ['tide serpent, undulating guzheng glissandi, sea drums', 114, 'F major'],
    'garde-solaire-des-racines': ['solar guard of the roots, sheng pads, golden bells, solemn pulse', 108, 'D major'],
    'pretresse-de-givre': ['frost priestess, icy crystalline plucks, xiao, cold stillness', 96, 'A minor'],
    'maitresse-tong-la-lame-de-bronze': ['mistress Tong the bronze blade, elegant fast pipa, metallic cymbal accents', 124, 'E minor'],
    'maitre-hong-gang-le-gong-de-cuivre': ['master Hong Gang the copper gong, big gong strokes, martial drums', 120, 'D minor'],
    'maitre-tie-bi-le-bras-de-fer': ['master Tie Bi the iron arm, heavy hammering rhythm, erhu growl', 118, 'G minor'],
    'dame-yin-yue-la-lune-d-argent': ['lady Yin Yue the silver moon, graceful crystalline guzheng, tense and airy', 110, 'A minor'],
    'seigneur-jin-long-le-dragon-d-or': ['lord Jin Long the golden dragon, majestic sheng, soaring dizi, drums', 122, 'D major'],
    'dame-bi-yu-la-main-de-jade': ['lady Bi Yu the jade hand, polished guzheng runs, cool precise pipa', 112, 'F major'],
    'immortel-yun-zhong-celui-des-nuees': ['immortal Yun Zhong of the clouds, floating sheng, wind-like dizi, mystical', 104, 'D major'],
    'grand-maitre-qian-jian-l-archer-aux-mille-fleches': ['grand master Qian Jian the thousand-arrow archer, the Hou Yi motif answered in canon, precise pipa arrows, noble rival', 128, 'D minor'],
    'gardien-de-la-forge-noire': ['guardian of the black forge, iron pulse, dark drums', 116, 'C# minor'],
    'capitaine-noye-des-limons': ['drowned captain of the river silt, deep watery guqin, drowned bells', 98, 'G minor'],
    'lion-cendre-gardien-du-sutra': ['ash lion guardian of the sutra, ritual chant-like erhu, temple drums', 106, 'E minor'],
    'colosse-des-caravanes-ensevelies': ['colossus of buried caravans, sand-heavy slow march, buried bells', 102, 'A minor'],
    'jiangshi-du-cassia-lunaire': ['hopping jiangshi of the lunar cassia tree, axe chopping rhythm, eerie moonlit xiao', 108, 'A minor'],
    'vieux-saule-des-boues-gardien-du-terrier': ['mud turtle guardian of the burrow, slow muddy bass, curious dizi', 90, 'G major'],
    'long-du-tonnerre-sourd': ['dragon of the muffled thunder, rumbling distant drums, sheng, rising storm', 118, 'F# minor'],
    'tigre-blanc-des-ancetres': ['white tiger of the ancestors, solemn noble guqin and drums, ancestral weight', 104, 'D minor'],
    'serpent-des-marees-noires': ['serpent of the black tides, dark guzheng glissandi, oily slow menace', 110, 'F minor'],
    'immortel-dechu-des-branches': ['fallen immortal of the branches, broken celestial sheng, sad erhu', 100, 'D minor']
};
for (const [k, [s, bpm, key]] of Object.entries(GUARDS)) T(`boss-${k}`, `dangerous boss battle, ${s}, ${BOSS_MOOD}, ${I.pipa}, ${BOSS_PERC}, readable melody`, { bpm, keyScale: key, dur: 50 });

/* ───────────── Boss : les quatre Gardiens Célestes (quêtes de légende, world/legends.js) ───────────── */
const CELESTIAL = {
    'zhuque-l-oiseau-vermillon': ['Zhuque the Vermilion Bird of the South, blazing fire, soaring dizi flights, crackling drums, rising and falling flame arpeggios', 138, 'E minor'],
    'xuanwu-la-tortue-noire': ['Xuanwu the Black Tortoise and serpent of the North, deep watery guqin, slow crushing drums, cold tolling bells', 96, 'C minor'],
    'baihu-le-tigre-blanc': ['Baihu the White Tiger of the West, prowling metallic rhythm then violent pounce, pipa slides, sharp cymbals', 132, 'A minor'],
    'qinglong-le-dragon-d-azur': ['Qinglong the Azure Dragon of the East, storm winds, sweeping sheng and dizi, thunderous drums, majestic and furious', 124, 'D minor']
};
for (const [k, [s, bpm, key]] of Object.entries(CELESTIAL)) T(`boss-${k}`, `legendary celestial guardian boss battle, ${s}, ${BOSS_MOOD}, ${I.pipa}, ${BOSS_PERC}, readable heroic melody`, { bpm, keyScale: key, dur: 60 });

/* ───────────── Boss : archétypes (repli) ───────────── */
[
    'brute, heavy stomping drums and low erhu', 'swift hunter, fast pipa runs and dizi', 'mystic, sheng pads and guqin with eerie xiao',
    'armored warrior, brass-like square waves and big gong', 'beast, savage drum patterns and pipa slides', 'water spirit, guzheng arpeggios and flowing erhu',
    'fire spirit, crackling woodblock and pulse waves', 'ancient guardian, slow ritual drums and sheng chords'
].forEach((s, i) => T(`boss-a${i}`, `boss battle archetype, ${s}, ${BOSS_MOOD}, strong melody, short loop`, { bpm: 108 + i * 3, keyScale: ['D minor', 'E minor', 'A minor', 'G minor', 'C minor', 'F major', 'C minor', 'D minor'][i], dur: 50 }));

export const CATALOG = TRACKS;
export const MOTIF_NAMES = ['houyi', 'fengmeng', 'suns'];

/** Description textuelle complète envoyée à ACE-Step (caption). `extra` = retouche libre pour une régénération. */
/** Combats et boss : le brief « pas de bombast, arrangement compact » est levé pour laisser place à l'épique. */
const isEpic = (track) => /^(combat|boss)-/.test(track.key);
const EPIC_STYLE = GLOBAL_STYLE.replace('no cinematic orchestral bombast', 'big cinematic orchestral power').replace('compact arrangement with limited polyphony', 'rich layered arrangement, full ensemble');

export function buildCaption(track, extra = '') {
    return [isEpic(track) ? EPIC_STYLE : GLOBAL_STYLE, track.style, extra].filter(Boolean).join(', ');
}
