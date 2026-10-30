/**
 * musicTracks.js — correspondance scène de jeu → piste de musique pré-enregistrée (module pur, sans DOM ni audio).
 *
 * Les pistes sont des MP3 en boucle (`audio/music/<clé>.mp3`) produits une fois pour toutes par
 * `tools/audio/render.mjs` (voir tools/audio/README.md) : plus aucune synthèse en temps réel dans le jeu.
 *
 * Clés : title, menu, house, sanctuary, moon, ending · village-<biome> · wild-<biome> · combat-<0..4> ·
 *        boss-<nom du boss en minuscules, tirets> (un thème par boss) · boss-a<0..7> (thème d'archétype, repli).
 */

export const SCENE_IDS = ['title', 'menu', 'village', 'house', 'wild', 'sanctuary', 'moon', 'ending', 'combat', 'boss', 'victory', 'defeat', 'puzzle-push', 'puzzle-mirror', 'puzzle-slide'];
export const BIOMES = ['paddy', 'riverbed', 'bamboo', 'gobi', 'storm', 'volcano', 'savanna', 'coast', 'tides', 'fusang', 'moon'];
// Biomes d'événement (events/) → piste de musique de leur zone. Ajouter une entrée par événement qui a sa musique.
export const EVENT_TRACKS = { wandering_souls: 'event-wandering-souls' };
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
    // Écrans d'événement : piste propre à l'événement (clé `event-<id>`), repli sur la musique sauvage des Bambous si elle manque.
    if (sceneId === 'wild' && EVENT_TRACKS[biome]) return [EVENT_TRACKS[biome], 'wild-bamboo'];
    if (sceneId === 'village' || sceneId === 'wild') return [`${sceneId}-${BIOMES.includes(biome) ? biome : 'paddy'}`];
    if (sceneId === 'combat') return [...(biome === 'tides' ? ['combat-tides'] : []), `combat-${combatStyleIndex(variant ?? 0)}`];   // Hautes-Eaux : « Tourbillon des Eaux »
    if (sceneId === 'boss') {
        const name = boss ?? variant;
        return name ? [`boss-${bossSlug(name)}`, `boss-a${bossArchetypeIndex(name)}`] : ['boss-a0'];
    }
    if (sceneId === 'victory' || sceneId === 'defeat') return [sceneId];
    return [sceneId];
}

export const trackUrl = (key) => `${MUSIC_DIR}${key}.mp3`;

/** Suffixe de la 2e variante d'une piste (`<clé>-b.mp3`), générée avec la même consigne que `<clé>.mp3`. */
export const VARIANT_SUFFIX = '-b';

/**
 * Liste de lecture : pour chaque clé candidate, ses deux variantes dans un ordre tiré au hasard (`random()` dans [0, 1[).
 * L'ordre des candidates (piste précise puis repli) est conservé ; une variante absente est simplement sautée.
 */
export function withVariants(candidates, random = Math.random) {
    return candidates.flatMap((key) => (random() < 0.5 ? [key, key + VARIANT_SUFFIX] : [key + VARIANT_SUFFIX, key]));
}
