/**
 * engine.js — Logique pure de Mob Rush (aucune dépendance DOM).
 *
 * Monde logique fixe W×H (portrait). Le canon du joueur est en bas, la base
 * ennemie en haut. Les unités bleues montent, traversent des portes qui les
 * multiplient, et détruisent la base. Les unités rouges descendent vers le canon.
 */

export const W = 360;
export const H = 640;
export const CANNON_Y = 590;
export const CANNON_MIN_X = 24;
export const CANNON_MAX_X = W - 24;
export const BASE = { x: W / 2, y: 64, w: 130, h: 56 };

export const MAX_BLUE = 650;
export const FIRE_RATE = 9;            // tirs / seconde
export const CHAMPION_CHARGE = 40;     // tirs nécessaires pour charger le champion
// Vitesses ralenties (vs. 170/105/62/42 à l'origine) pour que l'action reste
// lisible à l'œil et laisse le temps de choisir une vraie stratégie de visée.
const BLUE_SPEED = 108;
const CHAMP_SPEED = 68;
const RED_SPEED = 40;
const BRUTE_SPEED = 27;
const CANNON_SPEED = 900;
const GATE_H = 14;
// Décalage vers le bas (donc vers le joueur) du bord « avant » d'une rangée
// de portes/murs par rapport à `row.y`/`gate.y` — doit rester synchronisé
// avec la bande de 30px dessinée par main.js (de row.y-16 à row.y+14).
export const ROW_FRONT = 14;

// Équilibrage (réglé par simulation d'un bot sur les niveaux 1–30)
export const T = {
  BASE_HP_0: 200, BASE_HP_K: 75, CHAIN_CAP: 140, LEVEL_K: 0.02,
  SPAWN_0: 0.8, SPAWN_K: 0.02, SPAWN_MIN: 0.25, GROUP_EVERY: 4,
  WAVE_0: 8, WAVE_K: 2.5, RAMP: 40,
  BOSS_WAVES: 3,          // vagues intensifiées à survivre après le dernier château
  DIFFICULTY_MAX: 1,      // borne du multiplicateur de difficulté adaptative
};

// ─── RPG : compétences, armes, héros ────────────────────────────────────────
// Tout se débloque en jouant (niveaux réussis, niveaux bonus) — rien ne
// s'achète, rien ne s'obtient plus vite en rejouant un niveau déjà validé.
// Les compétences sont évolutives : chaque palier coûte plus cher et
// renforce un peu plus l'effet, jusqu'à `maxLevel`.
export const PERKS = {
  cadence: {
    id: 'cadence', name: 'Cadence renforcée', maxLevel: 3, costPerLevel: [2, 3, 4],
    perLevel: { fireRateMul: 0.1 },
    format: v => `+${Math.round(v * 100)}% de vitesse de tir`,
  },
  charge: {
    id: 'charge', name: 'Charge rapide', maxLevel: 3, costPerLevel: [2, 3, 4],
    perLevel: { chargeReduction: 0.15 },
    format: v => `Champion ${Math.round(v * 100)}% plus rapide à charger`,
  },
  blindage: {
    id: 'blindage', name: 'Blindage', maxLevel: 3, costPerLevel: [2, 3, 4],
    perLevel: { cannonHpBonus: 2 },
    format: v => `+${v} PV de canon`,
  },
  perce: {
    id: 'perce', name: 'Tir perforant', maxLevel: 3, costPerLevel: [3, 4, 5],
    perLevel: { divResist: 0.2 },
    format: v => `${Math.round(v * 100)}% de résistance aux portes ÷`,
  },
  renfort: {
    id: 'renfort', name: 'Renfort', maxLevel: 3, costPerLevel: [3, 4, 5],
    perLevel: { championCloneBonus: 1 },
    format: v => `+${v} clone(s) de champion dans les portes ×`,
  },
};

// Niveau actuel d'une compétence, borné à [0, maxLevel].
export function perkLevel(levels, id) {
  const perk = PERKS[id];
  if (!perk) return 0;
  const lvl = Math.floor((levels && levels[id]) || 0);
  return clamp(lvl, 0, perk.maxLevel);
}

// Coût pour passer une compétence de son niveau actuel au suivant (undefined
// si déjà au niveau max).
export function perkUpgradeCost(id, currentLevel) {
  const perk = PERKS[id];
  if (!perk || currentLevel >= perk.maxLevel) return undefined;
  return perk.costPerLevel[currentLevel];
}

// Valeur totale accumulée d'une stat de compétence pour un niveau donné
// (ex : perkStatAt('cadence', 'fireRateMul', 2) → 0.2).
export function perkStatAt(id, key, level) {
  const perk = PERKS[id];
  return ((perk && perk.perLevel[key]) || 0) * level;
}

// `shotHp` : PV des tirs normaux (non-champion), 1 par défaut — un tir plus
// « lourd » encaisse plusieurs unités rouges faibles avant de tomber.
// `multishot` : nombre de tirs simultanés par cadence, 1 par défaut.
export const WEAPONS = {
  standard:  { id: 'standard',  name: 'Canon standard', desc: 'Tir simple et fiable.' },
  rafale:    { id: 'rafale',    name: 'Rafale', desc: '+25% de vitesse de tir.', fireRateMul: 1.25, xpCost: 80 },
  perforant: { id: 'perforant', name: 'Perforant', desc: 'Les tirs ignorent les portes ÷.', ignoreDiv: true, xpCost: 120 },
  lourd:     { id: 'lourd',     name: 'Canon lourd', desc: 'Tir lent mais 3 PV par unité tirée.', fireRateMul: 0.65, shotHp: 3, xpCost: 150 },
  gatling:   { id: 'gatling',   name: 'Gatling', desc: '+70% de vitesse de tir.', fireRateMul: 1.7, xpCost: 180 },
  jumeau:    { id: 'jumeau',    name: 'Canon jumeau', desc: 'Deux tirs à chaque cadence.', multishot: 2, fireRateMul: 0.85, xpCost: 220 },
  sniper:    { id: 'sniper',    name: 'Sniper', desc: 'Très lent, 2 PV par tir, ignore les portes ÷.', fireRateMul: 0.45, shotHp: 2, ignoreDiv: true, xpCost: 260 },
};

// `cannonHpBonus` : PV de canon supplémentaires apportés par le héros.
// `chargeGainMul` : multiplie la charge du champion gagnée à chaque tir.
export const HEROES = {
  champion:   { id: 'champion',   name: 'Champion', desc: 'Unité géante équilibrée.', hp: 25, speedMul: 1, cloneMul: 4 },
  colosse:    { id: 'colosse',    name: 'Colosse', desc: 'Beaucoup plus de PV, un peu plus lent.', hp: 45, speedMul: 0.75, cloneMul: 3, xpCost: 100 },
  eclaireur:  { id: 'eclaireur',  name: 'Éclaireur', desc: 'Fragile mais ignore les portes ÷.', hp: 12, speedMul: 1.3, cloneMul: 4, ignoreDiv: true, xpCost: 100 },
  gardien:    { id: 'gardien',    name: 'Gardien', desc: 'Robuste, +4 PV de canon.', hp: 30, speedMul: 0.85, cloneMul: 3, cannonHpBonus: 4, xpCost: 140 },
  berserker:  { id: 'berserker',  name: 'Berserker', desc: 'Très fragile, clonage massif dans les portes ×.', hp: 16, speedMul: 1.2, cloneMul: 5, xpCost: 180 },
  sentinelle: { id: 'sentinelle', name: 'Sentinelle', desc: 'Charge le champion 50% plus vite.', hp: 20, speedMul: 1, cloneMul: 4, chargeGainMul: 1.5, xpCost: 180 },
  titan:      { id: 'titan',      name: 'Titan', desc: 'Immense tank, +6 PV de canon.', hp: 70, speedMul: 0.55, cloneMul: 3, cannonHpBonus: 6, xpCost: 220 },
};

export const DEFAULT_LOADOUT = { weapon: 'standard', hero: 'champion', perks: {} };

// `loadout.perks` est une map { perkId: niveau } — les compétences sont
// évolutives, chaque niveau accumule son effet (voir `perkStatAt`).
function resolveLoadout(loadout) {
  const weapon = (loadout && WEAPONS[loadout.weapon]) || WEAPONS.standard;
  const hero = (loadout && HEROES[loadout.hero]) || HEROES.champion;
  const levels = (loadout && loadout.perks) || {};
  const sum = key => Object.keys(PERKS).reduce((a, id) => a + perkStatAt(id, key, perkLevel(levels, id)), 0);
  return {
    weapon, hero,
    fireRateMul: (weapon.fireRateMul || 1) * (1 + sum('fireRateMul')),
    chargeMul: clamp(1 - sum('chargeReduction'), 0.25, 1),
    cannonHpBonus: sum('cannonHpBonus') + (hero.cannonHpBonus || 0),
    divResist: Math.min(0.9, sum('divResist')),
    championCloneBonus: sum('championCloneBonus'),
    ignoreDiv: !!(weapon.ignoreDiv || hero.ignoreDiv),
    shotHp: weapon.shotHp || 1,
    multishot: weapon.multishot || 1,
    chargeGainMul: hero.chargeGainMul || 1,
  };
}

// ─── Niveaux bonus (optionnels, toujours jouables, très durs) ───────────────
// Jamais requis pour progresser dans le jeu principal, jamais verrouillés :
// faisables à tout moment, mais nettement plus durs qu'un niveau normal du
// même palier — la récompense est un gros bonus d'XP (dépensable à la
// boutique), pas un déblocage direct d'arme/héros.
export const BONUS_EVERY = 5;
// Niveau principal « équivalent » représenté par un palier de bonus donné
// (purement indicatif pour l'affichage — ne verrouille plus rien).
export function bonusRefLevel(index) {
  return Math.max(1, Math.floor(index)) * BONUS_EVERY;
}
export function bonusXpReward(index) {
  return 100 + Math.max(1, Math.floor(index)) * 40;
}

// ─── RNG déterministe ────────────────────────────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ─── Séquence de châteaux ────────────────────────────────────────────────────
// La base n'est pas une seule barre de vie géante : elle est découpée en
// 2 à 4 phases (mini-châteaux successifs puis un grand château final), pour
// que le joueur voie une vraie progression (jalons, célébrations) plutôt
// qu'un écran figé — jamais un seul château géant, même au niveau 1.
function castleCount(level) {
  return clamp(2 + Math.floor((level - 1) / 3), 2, 4);
}

function splitCastles(totalHp, level) {
  const count = castleCount(level);
  if (count === 1) return [totalHp];
  const finalHp = Math.round(totalHp * 0.4);
  const rest = totalHp - finalHp;
  const each = Math.round(rest / (count - 1));
  const minis = Array(count - 1).fill(each);
  minis[0] += rest - each * (count - 1); // absorbe l'arrondi
  return [...minis, finalHp];
}

// Génère la disposition des portes d'un terrain (une rangée de murs percés
// de couloirs) pour un niveau donné, à partir d'un générateur aléatoire fourni
// par l'appelant — permet de produire plusieurs terrains distincts pour un
// même niveau (un par mini-château) sans dupliquer cette logique.
function generateGateLayout(rng, level) {
  const pick = arr => arr[Math.floor(rng() * arr.length)];

  const rows = 2 + Math.min(2, Math.floor((level - 1) / 4));
  const top = 190;
  const bottom = 500;
  const gates = [];

  for (let r = 0; r < rows; r++) {
    const y = rows === 1 ? (top + bottom) / 2 : bottom - (r * (bottom - top)) / (rows - 1);
    const twoGates = level >= 2 && rng() < 0.55;
    const slots = twoGates ? [W * 0.27, W * 0.73] : [W * (0.3 + rng() * 0.4)];

    slots.forEach((x, i) => {
      let op;
      if (twoGates && i === 1 && level >= 3 && rng() < 0.45) {
        op = { type: 'div', n: 2 };
      } else {
        const muls = level < 4 ? [2, 2, 3] : level < 10 ? [2, 2, 3, 3, 4] : [2, 3, 3, 4, 5];
        op = { type: 'mul', n: pick(muls) };
      }
      const w = twoGates ? 88 + rng() * 22 : 100 + rng() * 40;
      const moving = level >= 2 && rng() < Math.min(0.6, 0.2 + level * 0.04);
      const vx = moving ? (30 + rng() * 40) * (rng() < 0.5 ? -1 : 1) : 0;
      // Couloir de déplacement : tout le terrain, ou une moitié si deux portes sur la rangée
      const laneL = twoGates && i === 1 ? W / 2 : 0;
      const laneR = twoGates && i === 0 ? W / 2 : W;
      gates.push({ id: gates.length, x, y, w, h: GATE_H, op, vx, minX: laneL + w / 2 + 4, maxX: laneR - w / 2 - 4 });
    });
  }
  // Garantit minX <= maxX
  for (const g of gates) {
    if (g.minX > g.maxX) { const m = (g.minX + g.maxX) / 2; g.minX = g.maxX = m; g.vx = 0; }
    g.x = clamp(g.x, g.minX, g.maxX);
  }
  return gates;
}

function bestChainOf(gates) {
  const rowsY = [...new Set(gates.map(g => g.y))];
  return rowsY.reduce((acc, y) =>
    acc * Math.max(1, ...gates.filter(g => g.y === y && g.op.type === 'mul').map(g => g.op.n)), 1);
}

// ─── Génération de niveau ────────────────────────────────────────────────────
/**
 * Génère la configuration d'un niveau (déterministe : mêmes n/difficulty →
 * même niveau).
 *
 * Chaque mini-château a son propre terrain (disposition de portes) : le
 * décor change à chaque fois qu'un château tombe, pour forcer à réévaluer sa
 * stratégie de visée plutôt que de rejouer le même couloir en boucle.
 *
 * `difficulty` (0..T.DIFFICULTY_MAX) est un multiplicateur adaptatif tenu à
 * jour par l'appelant (cf. mobilityFor) : un joueur qui gagne sans jamais
 * déplacer le canon (pure cadence, aucune visée) durcit ses niveaux suivants
 * (plus d'ennemis, plus de brutes) plutôt que de pouvoir « bourriner »
 * indéfiniment avec la même stratégie statique.
 */
export function generateLevel(n, difficulty = 0) {
  const level = Math.max(1, Math.floor(n));
  const diff = clamp(difficulty, 0, T.DIFFICULTY_MAX);
  const rng = mulberry32(level * 9973 + 17);
  const gates = generateGateLayout(rng, level);

  // PV de la base proportionnels au meilleur enchaînement de portes possible
  // (le plus dur parmi tous les terrains du niveau), pour que les niveaux à
  // gros multiplicateurs ne se gagnent pas en 5 secondes.
  const count = castleCount(level);
  const terrains = [gates];
  for (let i = 1; i < count; i++) {
    const trng = mulberry32(level * 9973 + 17 + i * 104729 + 13);
    terrains.push(generateGateLayout(trng, level));
  }
  const bestChain = Math.max(...terrains.map(bestChainOf));

  const baseHp = Math.round((T.BASE_HP_0 + T.BASE_HP_K * Math.min(bestChain, T.CHAIN_CAP)) * (1 + level * T.LEVEL_K));
  const diffMul = 1 + diff * 0.6; // jusqu'à +60% de pression à difficulté max

  return {
    level,
    difficulty: diff,
    bestChain,
    baseHp,
    castles: splitCastles(baseHp, level),
    cannonHp: 10,
    spawnInterval: Math.max(T.SPAWN_MIN, T.SPAWN_0 - level * T.SPAWN_K),
    spawnGroup: Math.max(1, Math.round((1 + Math.floor(level / T.GROUP_EVERY)) * diffMul)),
    waveEvery: Math.max(6, 12 - level * 0.3),
    waveSize: Math.round((T.WAVE_0 + Math.floor(level * T.WAVE_K)) * diffMul),
    bruteChance: Math.min(0.4, (level >= 4 ? Math.min(0.22, (level - 3) * 0.025) : 0) * diffMul + diff * 0.05),
    seed: level * 7919 + 3,
    gates,
    terrains,
  };
}

/**
 * Génère un niveau bonus (déterministe, jamais requis pour progresser,
 * jamais verrouillé — faisable à tout moment). Réutilise la mise en page de
 * portes d'un niveau "virtuel" avancé, mais toujours nettement plus dur que
 * la progression normale à cet endroit du jeu, quelle que soit la
 * difficulté adaptative du joueur (jamais adouci) : ils se battent avec les
 * compétences/armes/héros déjà gagnés, récompensés par un gros bonus d'XP.
 */
export function generateBonusLevel(index) {
  const idx = Math.max(1, Math.floor(index));
  const layout = generateLevel(idx * BONUS_EVERY + 3);
  const baseHp = Math.round(layout.baseHp * 2.2);
  return {
    ...layout,
    level: layout.level,
    bonus: true,
    bonusIndex: idx,
    baseHp,
    castles: splitCastles(baseHp, layout.level),
    spawnInterval: Math.max(T.SPAWN_MIN, layout.spawnInterval * 0.6),
    spawnGroup: Math.round(layout.spawnGroup * 1.5),
    waveSize: Math.round(layout.waveSize * 1.8),
    bruteChance: Math.min(0.45, layout.bruteChance * 1.8 + 0.1),
    seed: layout.seed + 500000,
  };
}

// Regroupe les portes par rangée (même y). Sert à détecter les « murs » :
// tout ce qui, sur une rangée, n'est couvert par aucune porte.
function groupRows(gates) {
  const map = new Map();
  for (const gt of gates) {
    if (!map.has(gt.y)) map.set(gt.y, []);
    map.get(gt.y).push(gt.id);
  }
  return [...map.entries()].map(([y, gateIds]) => ({
    y: Number(y),
    gateIds,
    mask: gateIds.reduce((m, id) => m | (1 << id), 0),
  }));
}

// ─── État de partie ──────────────────────────────────────────────────────────
export function createGame(levelConfig, loadout) {
  const ld = resolveLoadout(loadout);
  const cannonHpMax = levelConfig.cannonHp + ld.cannonHpBonus;
  return {
    cfg: levelConfig,
    loadout: ld,
    rng: mulberry32(levelConfig.seed),
    time: 0,
    status: 'playing',           // 'playing' | 'won' | 'lost'
    cannonX: W / 2,
    cannonHp: cannonHpMax,
    cannonHpMax,
    baseHp: levelConfig.baseHp,
    castleIndex: 0,
    castleHp: levelConfig.castles[0],
    fireRate: FIRE_RATE * ld.fireRateMul,
    championCharge: Math.max(5, Math.round(CHAMPION_CHARGE * ld.chargeMul)),
    fireAcc: 0,
    charge: 0,
    spawnAcc: 0,
    waveAcc: 0,
    gates: levelConfig.gates.map(g => ({ ...g, op: { ...g.op }, flash: 0 })),
    rows: groupRows(levelConfig.gates),
    blue: [],
    red: [],
    events: [],
    boss: null,
    stats: { shots: 0, kills: 0, peak: 0, gateHits: 0, moveDist: 0 },
  };
}

function makeBlue(x, y, mask, champ = false, hero = HEROES.champion, shotHp = 1) {
  return champ
    ? { x, y, vx: 0, vy: -CHAMP_SPEED * hero.speedMul, hp: hero.hp, r: 13, mask, champ: true }
    : { x, y, vx: 0, vy: -BLUE_SPEED, hp: shotHp, r: 5, mask, champ: false };
}

function spawnRed(g, brute) {
  const x = BASE.x + (g.rng() - 0.5) * (BASE.w - 20);
  const y = BASE.y + BASE.h / 2 + 6;
  g.red.push(brute
    ? { x, y, vx: 0, vy: BRUTE_SPEED, hp: 6, r: 10, brute: true }
    : { x, y, vx: 0, vy: RED_SPEED, hp: 1, r: 5, brute: false });
}

export function canLaunchChampion(g) {
  return g.status === 'playing' && g.charge >= g.championCharge;
}

export function starsFor(g) {
  if (g.status !== 'won') return 0;
  const ratio = g.cannonHp / g.cannonHpMax;
  return ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1;
}

// XP gagnée pour une partie, qu'elle soit gagnée OU perdue — la progression
// (armes/héros via la boutique) avance même sur un échec, proportionnelle à
// ce qui a été accompli (châteaux détruits, ennemis tués, vagues de boss
// survécues), avec un bonus à la victoire.
export function xpFor(g) {
  const castleXp = g.castleIndex * 8;
  const killXp = Math.floor(g.stats.kills / 4);
  const bossXp = g.boss ? (g.boss.wavesTotal - g.boss.wavesLeft) * 15 : 0;
  const winBonus = g.status === 'won' ? 30 : 0;
  return castleXp + killXp + bossXp + winBonus;
}

// Détecte un joueur qui « bourrine » sans bouger le canon (peu ou pas de
// visée) — sert à durcir le niveau suivant plutôt que de laisser une
// stratégie purement statique fonctionner indéfiniment.
export function mobilityFor(g) {
  return g.time > 0 ? g.stats.moveDist / g.time : 0;
}

// Remplace le terrain actif (portes + rangées) par celui du château courant.
// Les unités bleues déjà en jeu perdent la mémoire des portes franchies : le
// nouveau terrain n'a pas les mêmes identifiants de portes, et surtout pas
// forcément aux mêmes endroits — elles doivent re-choisir un couloir.
function swapTerrain(g, gates) {
  g.gates = gates.map(gt => ({ ...gt, op: { ...gt.op }, flash: 0 }));
  g.rows = groupRows(gates);
  for (const u of g.blue) u.mask = 0;
}

// Applique des dégâts à la base, en faisant progresser la séquence de
// châteaux (le trop-plein d'un château détruit passe au suivant). Chaque
// mini-château franchi change aussi la configuration du terrain (portes),
// pour obliger à revoir sa stratégie de visée à chaque étape.
function applyBaseDamage(g, dmg) {
  g.baseHp -= dmg;
  g.castleHp -= dmg;
  while (g.castleHp <= 0 && g.castleIndex < g.cfg.castles.length - 1) {
    const overflow = -g.castleHp;
    g.castleIndex++;
    g.castleHp = g.cfg.castles[g.castleIndex] - overflow;
    const terrain = g.cfg.terrains && g.cfg.terrains[g.castleIndex];
    if (terrain) swapTerrain(g, terrain);
    g.events.push({
      type: 'castleDown', index: g.castleIndex,
      final: g.castleIndex === g.cfg.castles.length - 1,
      terrainChanged: !!terrain,
    });
  }
}

/**
 * Avance la simulation de dt secondes.
 * input = { firing: bool, targetX: number|null, champion: bool }
 */
export function step(g, dt, input = {}) {
  if (g.status !== 'playing') return g;
  dt = Math.min(dt, 0.05);
  g.time += dt;

  // Canon
  if (input.targetX != null) {
    const tx = clamp(input.targetX, CANNON_MIN_X, CANNON_MAX_X);
    const d = tx - g.cannonX;
    const maxMove = CANNON_SPEED * dt;
    const applied = Math.abs(d) <= maxMove ? d : Math.sign(d) * maxMove;
    g.cannonX += applied;
    // Distance parcourue par le canon — sert à détecter un joueur qui
    // « bourrine » sans jamais bouger, pour adapter la difficulté du
    // niveau suivant (cf. mobilityFor/generateLevel).
    g.stats.moveDist += Math.abs(applied);
  }

  // Tir
  if (input.firing) {
    g.fireAcc += dt * g.fireRate;
    while (g.fireAcc >= 1) {
      g.fireAcc -= 1;
      for (let s = 0; s < g.loadout.multishot; s++) {
        if (g.blue.length >= MAX_BLUE) break;
        const u = makeBlue(g.cannonX + (g.rng() - 0.5) * 10, CANNON_Y - 22, 0, false, g.loadout.hero, g.loadout.shotHp);
        u.vx = (g.rng() - 0.5) * 24;
        g.blue.push(u);
        g.stats.shots++;
      }
      g.charge = Math.min(g.championCharge, g.charge + g.loadout.chargeGainMul);
    }
  } else {
    g.fireAcc = Math.min(g.fireAcc, 0.99);
  }

  if (input.champion && canLaunchChampion(g)) {
    g.blue.push(makeBlue(g.cannonX, CANNON_Y - 26, 0, true, g.loadout.hero));
    g.charge = 0;
    g.events.push({ type: 'champion', x: g.cannonX, y: CANNON_Y - 26 });
  }

  // Ennemis — combat de boss : une fois le dernier château détruit, une
  // salve de vagues deux fois plus dures (quantité doublée, plus de brutes)
  // avant de valider la victoire. Pas un sprite unique : la difficulté de
  // fin de niveau, via les mêmes vagues que le reste du niveau.
  const bossActive = !!g.boss;
  const spawnInterval = bossActive ? g.cfg.spawnInterval * 0.5 : g.cfg.spawnInterval;
  const spawnGroup = bossActive ? g.cfg.spawnGroup * 2 : g.cfg.spawnGroup;
  const waveEvery = bossActive ? g.cfg.waveEvery * 0.5 : g.cfg.waveEvery;
  const waveSize = bossActive ? g.cfg.waveSize * 2 : g.cfg.waveSize;
  const bruteChance = bossActive ? Math.min(0.6, g.cfg.bruteChance * 2 + 0.15) : g.cfg.bruteChance;

  g.spawnAcc += dt * (1 + g.time / T.RAMP);   // la pression monte avec le temps
  while (g.spawnAcc >= spawnInterval) {
    g.spawnAcc -= spawnInterval;
    for (let i = 0; i < spawnGroup; i++) spawnRed(g, g.rng() < bruteChance);
  }
  g.waveAcc += dt;
  if (g.waveAcc >= waveEvery) {
    g.waveAcc = 0;
    for (let i = 0; i < waveSize; i++) spawnRed(g, g.rng() < bruteChance);
    g.events.push({ type: 'wave', boss: bossActive });
    if (bossActive) g.boss.wavesLeft = Math.max(0, g.boss.wavesLeft - 1);
  }

  // Portes mobiles
  for (const gate of g.gates) {
    if (gate.flash > 0) gate.flash = Math.max(0, gate.flash - dt);
    if (!gate.vx) continue;
    gate.x += gate.vx * dt;
    if (gate.x < gate.minX) { gate.x = gate.minX; gate.vx = Math.abs(gate.vx); }
    if (gate.x > gate.maxX) { gate.x = gate.maxX; gate.vx = -Math.abs(gate.vx); }
  }

  // Unités bleues
  const newBlue = [];
  for (const u of g.blue) {
    const prevY = u.y;
    if (u.y < 300) {
      const dx = BASE.x - u.x;
      const want = Math.sign(dx) * Math.min(Math.abs(dx) * 2.2, 150);
      u.vx += (want - u.vx) * Math.min(1, dt * 5);
    } else {
      u.vx *= 1 - Math.min(1, dt * 0.8);
    }
    u.x = clamp(u.x + u.vx * dt, u.r, W - u.r);
    u.y += u.vy * dt;

    for (const row of g.rows) {
      if (u.mask & row.mask) continue;
      // Bord « avant » du mur/de la porte tel que dessiné (bande de 30px,
      // de row.y-16 à row.y+14) : le premier bord rencontré par une unité
      // qui monte. La ligne d'arrêt tient compte du rayon de l'unité pour
      // qu'elle vienne buter pile contre la surface, sans jamais s'enfoncer
      // dedans (sinon elle se retrouve visuellement à l'intérieur du mur).
      // On exige que l'unité ait effectivement approché par le sud (prevY
      // au niveau ou au-delà de la ligne d'arrêt) : une unité placée
      // directement au nord de la rangée (ex. déjà à la base) ne doit pas
      // se faire téléporter en arrière contre un mur qu'elle n'a jamais
      // traversé.
      const stopY = row.y + ROW_FRONT + u.r;
      if (!(prevY >= stopY && u.y <= stopY)) continue;
      const gate = row.gateIds.map(id => g.gates[id]).find(gt => Math.abs(u.x - gt.x) <= gt.w / 2);
      if (!gate) {
        // Mur : aucune porte ouverte ici. Collision : l'unité vient buter
        // contre la surface (jamais à travers) et glisse horizontalement le
        // long du mur vers le couloir ouvert le plus proche.
        u.y = stopY;
        const nearest = row.gateIds
          .map(id => g.gates[id])
          .reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a));
        const want = clamp((nearest.x - u.x) * 3, -140, 140);
        u.vx += (want - u.vx) * Math.min(1, dt * 6);
        continue;
      }
      u.mask |= 1 << gate.id;
      gate.flash = 0.15;
      g.stats.gateHits++;
      if (gate.op.type === 'mul') {
        const clones = u.champ
          ? (gate.op.n - 1) * g.loadout.hero.cloneMul + g.loadout.championCloneBonus
          : gate.op.n - 1;
        for (let k = 0; k < clones; k++) {
          if (g.blue.length + newBlue.length >= MAX_BLUE) break;
          const c = makeBlue(clamp(u.x + (g.rng() - 0.5) * gate.w * 0.8, 5, W - 5), gate.y - 2 - g.rng() * 8, u.mask);
          c.vx = (g.rng() - 0.5) * 50;
          newBlue.push(c);
        }
        g.events.push({ type: 'gate', x: u.x, y: gate.y });
      } else if (gate.op.type === 'div') {
        if (g.loadout.ignoreDiv) { /* survit à la porte ÷ */ }
        else if (u.champ) u.hp = Math.max(1, Math.ceil(u.hp / gate.op.n));
        else if (g.rng() < (1 - 1 / gate.op.n) * (1 - g.loadout.divResist)) u.hp = 0;
      }
    }
  }
  if (newBlue.length) g.blue.push(...newBlue);

  // Unités rouges
  for (const e of g.red) {
    const want = clamp((g.cannonX - e.x) * 0.35, -35, 35);
    e.vx += (want - e.vx) * Math.min(1, dt * 2);
    e.x = clamp(e.x + e.vx * dt, e.r, W - e.r);
    e.y += e.vy * dt;
  }

  resolveCombat(g);

  // Impacts base / canon
  const baseBottom = BASE.y + BASE.h / 2;
  for (const u of g.blue) {
    if (u.hp <= 0) continue;
    if (u.y - u.r <= baseBottom && Math.abs(u.x - BASE.x) <= BASE.w / 2 + u.r) {
      applyBaseDamage(g, u.hp);
      g.events.push({ type: 'baseHit', x: u.x, y: baseBottom, big: u.champ });
      u.hp = 0;
    } else if (u.y < -20) {
      u.hp = 0;
    }
  }
  for (const e of g.red) {
    if (e.hp <= 0) continue;
    if (e.y + e.r >= CANNON_Y - 8) {
      g.cannonHp -= e.brute ? 3 : 1;
      g.events.push({ type: 'cannonHit', x: e.x, y: CANNON_Y });
      e.hp = 0;
    }
  }

  g.blue = g.blue.filter(u => u.hp > 0);
  g.red = g.red.filter(e => e.hp > 0);
  if (g.blue.length > g.stats.peak) g.stats.peak = g.blue.length;

  // Le canon peut tomber à tout moment, y compris pendant le combat de
  // boss — vérifié en priorité pour ne jamais être masqué par baseHp<=0
  // (resté vrai en continu une fois le dernier château détruit).
  if (g.cannonHp <= 0) {
    g.cannonHp = 0;
    g.status = 'lost';
    g.events.push({ type: 'lost' });
  } else if (g.baseHp <= 0) {
    g.baseHp = 0;
    if (!g.boss) {
      // Dernier château tout juste détruit : le niveau ne se termine pas
      // encore, un combat de boss (vagues renforcées) doit être survécu.
      g.boss = { wavesLeft: T.BOSS_WAVES, wavesTotal: T.BOSS_WAVES };
      g.events.push({ type: 'bossStart', wavesTotal: T.BOSS_WAVES });
    } else if (g.boss.wavesLeft <= 0) {
      g.status = 'won';
      g.events.push({ type: 'won' });
    }
  }
  return g;
}

// ─── Combat (grille spatiale) ────────────────────────────────────────────────
const CELL = 24;
function resolveCombat(g) {
  if (!g.red.length || !g.blue.length) return;
  const grid = new Map();
  for (const u of g.blue) {
    if (u.hp <= 0) continue;
    const key = Math.floor(u.x / CELL) + Math.floor(u.y / CELL) * 64;
    let cell = grid.get(key);
    if (!cell) grid.set(key, (cell = []));
    cell.push(u);
  }
  for (const e of g.red) {
    const cx = Math.floor(e.x / CELL);
    const cy = Math.floor(e.y / CELL);
    for (let oy = -1; oy <= 1 && e.hp > 0; oy++) {
      for (let ox = -1; ox <= 1 && e.hp > 0; ox++) {
        const cell = grid.get(cx + ox + (cy + oy) * 64);
        if (!cell) continue;
        for (const u of cell) {
          if (u.hp <= 0) continue;
          const dx = u.x - e.x;
          const dy = u.y - e.y;
          const rr = u.r + e.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          const d = Math.min(u.hp, e.hp);
          u.hp -= d;
          e.hp -= d;
          if (e.hp <= 0) {
            g.stats.kills++;
            g.events.push({ type: 'kill', x: e.x, y: e.y, big: e.brute });
            break;
          }
        }
      }
    }
  }
}
