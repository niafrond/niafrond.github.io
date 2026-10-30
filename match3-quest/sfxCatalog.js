/**
 * sfxCatalog.js — correspondance événement sonore → clip pré-enregistré (module pur, sans DOM ni audio).
 *
 * Les clips sont des MP3 (`audio/sfx/<clé>.mp3`) produits une fois pour toutes par `tools/audio/render.mjs`.
 */

export const SFX_DIR = 'audio/sfx/';
export const SFX_PLAY_GAIN = 0.24;   // les clips sont rendus à SFX_RENDER_GAIN (0,5) : 0,24 = le niveau historique (0,12)
export const SFX_RENDER_GAIN = 0.5;

const SINGLE = ['uiClick', 'toggleOn', 'swap', 'invalid', 'turnBonus', 'spellCast', 'heal', 'victory', 'defeat',
    'battleStart', 'combatStart', 'bossStart', 'introJingle', 'endingJingle'];
const MATCH_TYPES = ['color', 'skull', 'combat'];
const LENGTHS = [3, 4, 5];   // 3, 4, 5 et plus

/** Identifiants de tous les sorts de `spells.json` (un clip `spell-<id>` chacun ; le test sfxCatalog.test.js vérifie la liste). */
export const SPELL_SFX_IDS = [
    'fireball', 'flameStrike', 'inferno', 'meteor', 'ice', 'frostNova', 'blizzard', 'iceAge', 'heal', 'greatHeal',
    'revitalize', 'miracle', 'bolt', 'thunderBolt', 'lightningStorm', 'stormOfGods', 'vaporBurst', 'goldenDew',
    'lotusPoison', 'emberStorm', 'shadowFlame', 'springRain', 'frostLightning', 'voidChill', 'bladeWinds',
    'brasierSeals', 'threeDragons', 'dragonCross', 'thunderPrison', 'jadeBreath', 'starRain', 'fiveHarmony',
    'twinDragonsStrike', 'vermilionBirdDive', 'azureDragonRoar', 'whiteTigerClaw', 'thunderDukeWrath',
    'fiveElementsSeal', 'heavenlyRiverFlood', 'nineSunsFall', 'kunlunMountainFall', 'pangusAxe', 'jadeEmperorDecree',
    'heavenTribulationEnd', 'jadeSpringBlessing', 'immortalPeach', 'queenMotherElixir', 'emberScythe', 'frostCleave',
    'galeSlash', 'voidRift', 'crimsonPurge', 'tidalPurge', 'jadePurge', 'stormPurge', 'shadowPurge',
    'emberGoldCross', 'jadeCurtain', 'purpleRazor', 'burningTide', 'seasonsPurge', 'mageStrike', 'wildMana',
    'shadowCurse', 'darkChannels', 'flameBolts', 'iceShield', 'flameblade', 'weakness', 'handOfIce', 'fingerOfDeath',
    'chasm', 'stoneskin', 'strength', 'flameSphere', 'mirrorShield', 'manaSiphon', 'manaBlast', 'tigerEye',
    'sneakAttack', 'swiftStrike', 'confuse', 'stealth', 'poisonBlade', 'shadowStrike', 'dualShot', 'shadowStep',
    'sharpenedBlade', 'defensiveWall', 'shieldBash', 'focus', 'intimidate', 'rush', 'counterAttack', 'reinforce',
    'barrier', 'divinePower', 'holdTheLine', 'heavensWrath', 'commandAura', 'enrage', 'cleave', 'throwAxe',
    'bloodlust', 'summonTempest', 'berserkerRage', 'singingBlades', 'deathbringer', 'revenant', 'warCry',
    'ultimateFiveElements', 'ultimateHeavenlyThunder', 'ultimateThousandArrows', 'ultimateSunPiercer',
    'ultimateImperialDragon', 'ultimateEternalBastion', 'ultimateThousandRiders', 'ultimateSkyWolf',
    'ultimateVermilionBird', 'ultimateBlackTortoise', 'ultimateWhiteTiger', 'ultimateAzureDragon',
    'bloodBoil', 'furyToQi', 'furyBlow', 'bloodTide', 'warDrums', 'dragonBlood', 'heavenFury', 'asuraRoar', 'warGodBlood', 'wrathBreath', 'rageWell', 'angerCirculation', 'stormMind', 'fireHeart', 'rageNirvana', 'shatteredWrath', 'tigerBreaker', 'dragonRage', 'thunderFist', 'skySplitter', 'worldEnder'
];
const SPELL_SET = new Set(SPELL_SFX_IDS);

/** Raretés d'arme (weapons.js) : un coup d'arme par rareté et par camp. */
export const WEAPON_RARITIES = ['common', 'uncommon', 'rare', 'legendary'];

/** Sons qui baissent légèrement la musique le temps de leur lecture : facteur appliqué au volume de la musique et durée (ms). */
export const SFX_DUCK = { spellCast: { factor: 0.55, ms: 1500 }, weaponHit: { factor: 0.6, ms: 1100 } };

const lenBucket = (payload) => Math.max(3, Math.min(5, Math.round(Number(payload?.length) || 3)));
const side = (payload) => (payload?.isPlayer === false ? 'e' : 'p');

/** Clé du clip pour un événement (`default` pour un événement inconnu). */
export function sfxKeyFor(eventName, payload = {}) {
    switch (eventName) {
        case 'match': return `match-${MATCH_TYPES.includes(payload.matchType) ? payload.matchType : 'color'}-${lenBucket(payload)}`;
        case 'skullHit': return `skullHit-${side(payload)}-${lenBucket(payload)}`;
        case 'manaGain': return `manaGain-${lenBucket(payload)}`;
        case 'spellCast': return SPELL_SET.has(payload.spellId) ? `spell-${payload.spellId}` : 'spellCast';
        case 'weaponHit': return WEAPON_RARITIES.includes(payload.rarity) ? `weaponHit-${payload.rarity}-${side(payload)}` : `weaponHit-${side(payload)}`;
        case 'spellHit': return `spellHit-${side(payload)}`;
        default: return SINGLE.includes(eventName) ? eventName : 'default';
    }
}

/** Clip de repli quand le clip précis n'existe pas (sort sans clip, arme de rareté inconnue), ou null. */
export function sfxFallbackKey(key) {
    if (/^spell-/.test(key)) return 'spellCast';
    const m = /^weaponHit-(?:common|uncommon|rare|legendary)-([pe])$/.exec(key);
    return m ? `weaponHit-${m[1]}` : null;
}

/** Baisse de la musique qui accompagne un événement sonore : { factor, ms } ou null. */
export const sfxDuckFor = (eventName) => SFX_DUCK[eventName] || null;

/** Multiplicateur de volume à la lecture (le qì de l'ennemi est plus discret). */
export function sfxGainFor(eventName, payload = {}) {
    return eventName === 'manaGain' && payload.isPlayer === false ? 0.5 : 1;
}

/** Tous les clips à produire : [{ key, event, payload }]. */
export function sfxVariants() {
    const out = [];
    SINGLE.forEach(event => out.push({ key: event, event, payload: {} }));
    out.push({ key: 'default', event: 'default', payload: {} });
    MATCH_TYPES.forEach(matchType => LENGTHS.forEach(length => out.push({ key: `match-${matchType}-${length}`, event: 'match', payload: { matchType, length } })));
    ['p', 'e'].forEach(s => {
        const isPlayer = s === 'p';
        LENGTHS.forEach(length => out.push({ key: `skullHit-${s}-${length}`, event: 'skullHit', payload: { isPlayer, length } }));
        out.push({ key: `weaponHit-${s}`, event: 'weaponHit', payload: { isPlayer } });
        out.push({ key: `spellHit-${s}`, event: 'spellHit', payload: { isPlayer } });
        WEAPON_RARITIES.forEach(rarity => out.push({ key: `weaponHit-${rarity}-${s}`, event: 'weaponHit', payload: { isPlayer, rarity } }));
    });
    SPELL_SFX_IDS.forEach(spellId => out.push({ key: `spell-${spellId}`, event: 'spellCast', payload: { spellId, isPlayer: true } }));
    LENGTHS.forEach(length => out.push({ key: `manaGain-${length}`, event: 'manaGain', payload: { length, isPlayer: true } }));
    return out;
}

export const sfxUrl = (key) => `${SFX_DIR}${key}.mp3`;
