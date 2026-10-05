/**
 * musicTracks.js — correspondance scène de jeu → piste de musique pré-enregistrée (module pur, sans DOM ni audio).
 *
 * Les pistes sont des MP3 en boucle (`audio/music/<clé>.mp3`) produits une fois pour toutes par
 * `tools/audio/render.mjs` (voir tools/audio/README.md) : plus aucune synthèse en temps réel dans le jeu.
 *
 * Clés : title, menu, house, sanctuary, moon, ending · village-<biome> · wild-<biome> · combat-<0..4> ·
 *        boss-<nom du boss en minuscules, tirets> (un thème par boss) · boss-a<0..7> (thème d'archétype, repli).
 */

export const SCENE_IDS = ['title', 'menu', 'village', 'house', 'wild', 'sanctuary', 'moon', 'ending', 'combat', 'boss'];
export const BIOMES = ['paddy', 'riverbed', 'bamboo', 'gobi', 'storm', 'volcano', 'savanna', 'coast', 'fusang', 'moon'];
export const COMBAT_STYLE_COUNT = 5;
export const BOSS_ARCHETYPE_COUNT = 8;
export const MUSIC_DIR = 'audio/music/';

/** Hash FNV-1a 32 bits d'une chaîne. */
export function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
}

/** Nom de boss normalisé (sans accents, minuscules, mots séparés par une espace). */
export function bossKey(name) {
    return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export const bossSlug = (name) => bossKey(name).replace(/ /g, '-');

/** Archétype (0..7) du thème d'un boss, déduit de son nom. */
export function bossArchetypeIndex(name) {
    return hashString(`boss|${bossKey(name) || 'boss'}`) % BOSS_ARCHETYPE_COUNT;
}

/** Style (0..4) de la musique d'un combat ordinaire, déduit de `variant` (entier ou chaîne). */
export function combatStyleIndex(variant) {
    const n = typeof variant === 'number' && Number.isFinite(variant) ? Math.abs(Math.floor(variant)) : hashString(String(variant ?? 0));
    return n % COMBAT_STYLE_COUNT;
}

/** Clés de pistes à essayer, de la plus précise à la plus générale. Tableau vide si la scène est inconnue. */
export function trackCandidates(sceneId, { biome, boss, variant } = {}) {
    if (!SCENE_IDS.includes(sceneId)) return [];
    if (sceneId === 'village' || sceneId === 'wild') return [`${sceneId}-${BIOMES.includes(biome) ? biome : 'paddy'}`];
    if (sceneId === 'combat') return [`combat-${combatStyleIndex(variant ?? 0)}`];
    if (sceneId === 'boss') {
        const name = boss ?? variant;
        return name ? [`boss-${bossSlug(name)}`, `boss-a${bossArchetypeIndex(name)}`] : ['boss-a0'];
    }
    return [sceneId];
}

export const trackUrl = (key) => `${MUSIC_DIR}${key}.mp3`;
