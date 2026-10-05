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

const lenBucket = (payload) => Math.max(3, Math.min(5, Math.round(Number(payload?.length) || 3)));
const side = (payload) => (payload?.isPlayer === false ? 'e' : 'p');

/** Clé du clip pour un événement (`default` pour un événement inconnu). */
export function sfxKeyFor(eventName, payload = {}) {
    switch (eventName) {
        case 'match': return `match-${MATCH_TYPES.includes(payload.matchType) ? payload.matchType : 'color'}-${lenBucket(payload)}`;
        case 'skullHit': return `skullHit-${side(payload)}-${lenBucket(payload)}`;
        case 'manaGain': return `manaGain-${lenBucket(payload)}`;
        case 'weaponHit': case 'spellHit': return `${eventName}-${side(payload)}`;
        default: return SINGLE.includes(eventName) ? eventName : 'default';
    }
}

/** Multiplicateur de volume à la lecture (le mana de l'ennemi est plus discret). */
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
    });
    LENGTHS.forEach(length => out.push({ key: `manaGain-${length}`, event: 'manaGain', payload: { length, isPlayer: true } }));
    return out;
}

export const sfxUrl = (key) => `${SFX_DIR}${key}.mp3`;
