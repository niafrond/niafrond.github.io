// Arène des Mille Flèches : combats en vagues, ouverte à partir du niveau ARENA_MIN_LEVEL, rejouable à volonté.
// Chaque vague est plus dure que la précédente (niveau, puis un champion de boss toutes les 5 vagues) ; une
// victoire rapporte l'XP, l'or et le butin d'un combat normal, plus une prime d'arène qui grandit avec la vague.
// La série s'arrête sur une défaite ou quand le joueur quitte l'arène ; le record est gardé dans `player.arena`.
// Fonctions pures (aucun accès DOM) : main.js enchaîne les vagues, game.js verse la prime.

export const ARENA_MIN_LEVEL = 15;
export const ARENA_NAME = 'Arène des Mille Flèches';
export const ARENA_BOSS_EVERY = 5;

// Adversaires possibles (gabarits de enemies.catalog.json, hors soleils et Fengmeng).
export const ARENA_TEMPLATES = [
    'goblin_saboteur', 'iron_gladiator', 'arcane_scholar', 'orc_warmaster', 'temple_warden', 'flame_boar',
    'void_vampire', 'storm_wyrm', 'crypt_lich', 'shadow_assassin', 'forest_guardian', 'moon_priestess',
    'plague_doctor', 'storm_knight', 'fungal_horror', 'ice_witch', 'bone_reaver', 'sun_paladin', 'crystal_sage',
    'war_troll', 'fire_tiger', 'ember_wolf', 'frost_dragon', 'ember_dragon', 'sand_colossus', 'lava_behemoth',
    'deep_sea_serpent'
];

const CHAMPION_TITLES = ['Champion de bronze', "Champion d'argent", "Champion d'or", 'Champion de jade', 'Champion céleste'];

export const isArenaUnlocked = playerLevel => (Number(playerLevel) || 0) >= ARENA_MIN_LEVEL;

// Niveau des adversaires d'une vague : un cran sous le joueur à la première, +1 toutes les deux vagues.
export function arenaWaveLevel(wave, playerLevel) {
    const w = Math.max(1, Math.floor(wave || 1));
    return Math.max(1, Math.floor(playerLevel || 1) - 1 + Math.floor(w / 2));
}

export const isChampionWave = wave => Math.max(1, Math.floor(wave || 1)) % ARENA_BOSS_EVERY === 0;

// Rencontre d'une vague (même forme que encounterFor d'exploration.js, sans ennemi de carte).
export function arenaEncounter(wave, playerLevel, rng = Math.random, templates = ARENA_TEMPLATES) {
    const w = Math.max(1, Math.floor(wave || 1));
    const level = arenaWaveLevel(w, playerLevel);
    const templateId = templates[Math.min(templates.length - 1, Math.floor(rng() * templates.length))];
    const champion = isChampionWave(w);
    const title = CHAMPION_TITLES[Math.min(CHAMPION_TITLES.length - 1, w / ARENA_BOSS_EVERY - 1)];
    const name = champion ? `${title} — vague ${w}` : `Vague ${w}`;
    return {
        enemyId: null,
        templateId,
        name,
        emoji: champion ? '🏆' : '🏟️',
        level,
        boss: champion ? { name, level } : null,
        arena: { wave: w }
    };
}

// Prime d'arène versée en plus des gains normaux du combat, croissante avec la vague (et doublée pour un champion).
export function arenaRewardBonus(wave, enemyLevel) {
    const w = Math.max(1, Math.floor(wave || 1));
    const lvl = Math.max(1, Math.floor(enemyLevel || 1));
    const mult = isChampionWave(w) ? 2 : 1;
    return { gold: (12 * w + 2 * lvl) * mult, xp: (150 * w + 10 * lvl) * mult };
}

// Fin d'une vague : met à jour le record (plus haute vague gagnée) et le nombre de victoires dans l'arène.
export function recordArenaWave(stats = {}, wave, won) {
    const out = { best: 0, wins: 0, runs: 0, ...stats };
    if (won) {
        out.wins += 1;
        out.best = Math.max(out.best, Math.floor(wave || 0));
    }
    return out;
}
