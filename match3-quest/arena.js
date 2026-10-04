// Arène des Mille Flèches : ouverte à partir du niveau ARENA_MIN_LEVEL, rejouable à volonté.
// Huit cercles de difficulté croissante (ARENA_TIERS) ; le cercle 1 est ouvert d'emblée, chaque cercle suivant se
// débloque en terminant au moins une fois le précédent. Un cercle = une série de vagues, la dernière étant son
// champion (boss) ; les cercles hauts ajoutent des stats renforcées et les règles de duel de Fengmeng (duel.js :
// tirs rapides, pièges de zone, miroir). Chaque victoire rapporte l'XP, l'or et le butin d'un combat normal, plus
// une prime d'arène (croissante avec le cercle et la vague) ; terminer un cercle pour la première fois paie une
// grosse prime. La série s'arrête sur une défaite ou un abandon. État sauvegardé : `player.arena`
// = { cleared: [ids], best: { [id]: vague }, wins, runs }. Fonctions pures : main.js enchaîne les vagues,
// enemies.js applique le renfort, game.js verse la prime.

export const ARENA_MIN_LEVEL = 15;
export const ARENA_NAME = 'Arène des Mille Flèches';

//  waves       : nombre de vagues (la dernière = champion) ;
//  levelOffset : écart de niveau des adversaires avec le héros à la 1re vague (+1 toutes les deux vagues) ;
//  statMult    : multiplicateur des PV, de l'attaque et de la défense des adversaires ;
//  duel        : règles de duel de toutes les vagues ; championDuel : règles du champion (remplacent `duel`) ;
//  rewardMult  : multiplicateur de la prime de vague ; clearGold / clearXp : prime du premier passage.
export const ARENA_TIERS = [
    { id: 1, name: 'Cercle de Bronze', emoji: '🥉', waves: 4, levelOffset: -1, statMult: 1.0, rewardMult: 1.0,
      clearGold: 150, clearXp: 1500,
      desc: 'Des yaoguai de la plaine, pour se faire la main.' },
    { id: 2, name: 'Cercle de Cuivre', emoji: '🟤', waves: 4, levelOffset: 0, statMult: 1.08, rewardMult: 1.3,
      clearGold: 250, clearXp: 2500,
      desc: 'Adversaires à votre niveau, un peu plus coriaces.' },
    { id: 3, name: 'Cercle de Fer', emoji: '⚙️', waves: 5, levelOffset: 1, statMult: 1.16, rewardMult: 1.6,
      clearGold: 400, clearXp: 4000,
      desc: 'Cinq vagues ; le champion encoche deux flèches à la fois.',
      championDuel: { rapidShots: 4 } },
    { id: 4, name: "Cercle d'Argent", emoji: '🥈', waves: 5, levelOffset: 2, statMult: 1.25, rewardMult: 2.0,
      clearGold: 600, clearXp: 6000,
      desc: 'Tirs rapides plus fréquents chez le champion.',
      championDuel: { rapidShots: 3 } },
    { id: 5, name: "Cercle d'Or", emoji: '🥇', waves: 6, levelOffset: 3, statMult: 1.35, rewardMult: 2.5,
      clearGold: 900, clearXp: 9000,
      desc: 'Le champion piège le plateau : désamorcez ses zones.',
      championDuel: { rapidShots: 3, zoneTraps: 3 } },
    { id: 6, name: 'Cercle de Jade', emoji: '💚', waves: 6, levelOffset: 4, statMult: 1.45, rewardMult: 3.0,
      clearGold: 1300, clearXp: 13000,
      desc: 'Toutes les vagues tirent vite ; le champion piège sans relâche.',
      duel: { rapidShots: 4 }, championDuel: { rapidShots: 3, zoneTraps: 2 } },
    { id: 7, name: 'Cercle Céleste', emoji: '☁️', waves: 7, levelOffset: 5, statMult: 1.6, rewardMult: 3.6,
      clearGold: 1800, clearXp: 18000,
      desc: 'Pièges à chaque vague ; le champion copie vos techniques.',
      duel: { rapidShots: 4, zoneTraps: 3 }, championDuel: { mirror: true, rapidShots: 3, zoneTraps: 2 } },
    { id: 8, name: 'Cercle des Mille Flèches', emoji: '🏹', waves: 8, levelOffset: 6, statMult: 1.8, rewardMult: 4.5,
      clearGold: 3000, clearXp: 30000,
      desc: "L'épreuve ultime : huit vagues impitoyables et un champion miroir, vous entrez à 80 % de vos PV.",
      duel: { rapidShots: 3, zoneTraps: 3 }, championDuel: { mirror: true, heroHpPct: 0.8, rapidShots: 2, zoneTraps: 2 } }
];

// Adversaires possibles (gabarits de enemies.catalog.json, hors soleils et Fengmeng).
export const ARENA_TEMPLATES = [
    'goblin_saboteur', 'iron_gladiator', 'arcane_scholar', 'orc_warmaster', 'temple_warden', 'flame_boar',
    'void_vampire', 'storm_wyrm', 'crypt_lich', 'shadow_assassin', 'forest_guardian', 'moon_priestess',
    'plague_doctor', 'storm_knight', 'fungal_horror', 'ice_witch', 'bone_reaver', 'sun_paladin', 'crystal_sage',
    'war_troll', 'fire_tiger', 'ember_wolf', 'frost_dragon', 'ember_dragon', 'sand_colossus', 'lava_behemoth',
    'deep_sea_serpent'
];

export const isArenaUnlocked = playerLevel => (Number(playerLevel) || 0) >= ARENA_MIN_LEVEL;

export const arenaTier = id => ARENA_TIERS.find(t => t.id === Number(id)) || null;

// État d'arène normalisé (accepte l'ancien format { best: nombre, wins, runs }).
export function normalizeArenaStats(stats) {
    const s = stats && typeof stats === 'object' ? stats : {};
    const cleared = Array.isArray(s.cleared) ? s.cleared.filter(id => arenaTier(id)).map(Number) : [];
    const best = s.best && typeof s.best === 'object' ? { ...s.best } : {};
    if (typeof s.best === 'number' && s.best > 0) best[1] = Math.min(s.best, arenaTier(1).waves);
    return { cleared: [...new Set(cleared)].sort((a, b) => a - b), best, wins: s.wins || 0, runs: s.runs || 0 };
}

// Le cercle 1 est toujours ouvert ; les suivants exigent d'avoir terminé le précédent au moins une fois.
export function isTierUnlocked(stats, tierId) {
    const id = Number(tierId);
    if (!arenaTier(id)) return false;
    return id === 1 || normalizeArenaStats(stats).cleared.includes(id - 1);
}

// Niveau des adversaires d'une vague : héros + écart du cercle, +1 toutes les deux vagues.
export function arenaWaveLevel(tierId, wave, playerLevel) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    const w = Math.max(1, Math.floor(wave || 1));
    return Math.max(1, Math.floor(playerLevel || 1) + tier.levelOffset + Math.floor((w - 1) / 2));
}

export function isChampionWave(tierId, wave) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    return Math.floor(wave || 0) === tier.waves;
}

// Rencontre d'une vague (même forme que encounterFor d'exploration.js, sans ennemi de carte).
export function arenaEncounter(tierId, wave, playerLevel, rng = Math.random, templates = ARENA_TEMPLATES) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    const w = Math.min(tier.waves, Math.max(1, Math.floor(wave || 1)));
    const level = arenaWaveLevel(tier.id, w, playerLevel);
    const templateId = templates[Math.min(templates.length - 1, Math.floor(rng() * templates.length))];
    const champion = isChampionWave(tier.id, w);
    const name = champion ? `Champion du ${tier.name}` : `${tier.name} — vague ${w}/${tier.waves}`;
    const duel = champion ? (tier.championDuel || tier.duel) : tier.duel;
    return {
        enemyId: null,
        templateId,
        name,
        emoji: champion ? '🏆' : tier.emoji,
        level,
        boss: champion ? { name, level } : null,
        duel: duel ? { ...duel } : null,
        arena: { tier: tier.id, wave: w, waves: tier.waves, statMult: tier.statMult }
    };
}

// Renfort des adversaires des cercles hauts (PV, attaque, défense).
export function applyArenaScaling(entity, statMult = 1) {
    if (!entity || !(statMult > 1)) return entity;
    entity.maxHp = Math.max(1, Math.round(entity.maxHp * statMult));
    entity.hp = entity.maxHp;
    entity.attack = Math.max(1, Math.round(entity.attack * statMult));
    entity.defense = Math.max(0, Math.round((entity.defense || 0) * statMult));
    return entity;
}

// Prime d'arène d'une vague gagnée, en plus des gains normaux du combat (doublée pour le champion).
export function arenaRewardBonus(tierId, wave, enemyLevel) {
    const tier = arenaTier(tierId) || ARENA_TIERS[0];
    const w = Math.max(1, Math.floor(wave || 1));
    const lvl = Math.max(1, Math.floor(enemyLevel || 1));
    const mult = tier.rewardMult * (isChampionWave(tier.id, w) ? 2 : 1);
    return { gold: Math.round((12 * w + 2 * lvl) * mult), xp: Math.round((150 * w + 10 * lvl) * mult) };
}

// Fin d'une vague : victoires, record par cercle et cercle terminé (champion vaincu).
// `firstClear` : vrai si le cercle vient d'être terminé pour la première fois (prime de premier passage).
export function recordArenaWave(stats, tierId, wave, won) {
    const out = normalizeArenaStats(stats);
    const tier = arenaTier(tierId);
    let firstClear = false;
    if (won && tier) {
        out.wins += 1;
        out.best[tier.id] = Math.max(out.best[tier.id] || 0, Math.floor(wave || 0));
        if (isChampionWave(tier.id, wave) && !out.cleared.includes(tier.id)) {
            out.cleared = [...out.cleared, tier.id].sort((a, b) => a - b);
            firstClear = true;
        }
    }
    return { stats: out, firstClear };
}
