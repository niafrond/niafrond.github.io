// Équilibrage de la durée des combats (cible : 3 à 8 minutes) : formules du document « Équilibrage des combats » et enregistreur de mesures.
// Les PV ne se déduisent pas d'une durée sans mesurer le rythme réel : l'enregistreur relève, pour chaque combat gagné, la durée, les cycles
// (un tour du joueur + un tour de l'ennemi) et les dégâts effectifs, puis `summarizeCombats` en tire la durée moyenne d'un cycle et les dégâts par cycle.
// Module pur (sans DOM) ; seul le stockage local est protégé par try/catch.

export const COMBAT_STATS_STORAGE_KEY = 'match3quest.combatStats';
export const THINK_PAUSE_CAP_MS = 20000;   // entre deux événements du combat, au-delà de 20 s on considère que le joueur réfléchit : l'excédent n'est pas compté
export const COMBAT_STATS_KEEP = 60;   // combats gardés (les plus récents)

// Durée cible en secondes (min, max) par catégorie d'ennemi.
export const TARGET_DURATION_SECONDS = {
    weak: [180, 180],
    normal: [180, 240],
    aggressive: [240, 300],
    elite: [300, 360],
    miniBoss: [360, 420],
    boss: [420, 480]
};
export const NORMAL_OVERRUN_SECONDS = 270;   // au-delà de 4 min 30 régulièrement : chercher la cause avant d'ajouter des PV

// Coefficients de PV indicatifs (min, max) par profil, relatifs au dégât effectif × cycles cibles.
export const PROFILE_HP_COEFFICIENTS = {
    weak: [0.75, 0.9],
    normal: [0.95, 1.05],
    resistant: [1.05, 1.15],
    elite: [1.1, 1.25],
    miniBoss: [1.15, 1.3],
    boss: [1.2, 1.4]
};

// Archétypes : coefficients relatifs à un ennemi normal de même niveau.
export const ARCHETYPES = {
    aggressiveGoblin: { hp: 0.75, attack: 1.2, defense: 0.8 },
    soldier: { hp: 1, attack: 1, defense: 1 },
    defensiveGolem: { hp: 1.15, attack: 0.85, defense: 1.2 },
    mage: { hp: 0.8, attack: 1.1, defense: 0.85 },
    assassin: { hp: 0.7, attack: 1.35, defense: 0.75 }
};

// Multiplicateurs de statistiques de base selon le niveau (relatifs au niveau 1) ; à ne pas appliquer aux PV issus d'une mesure de dégâts.
export function levelMultipliers(level) {
    const x = Math.max(0, (Number(level) || 1) - 1);
    return {
        hp: 1 + 0.045 * x + 0.00018 * x * x,
        attack: 1 + 0.038 * x + 0.00012 * x * x,
        defense: 1 + 0.018 * x + 0.00004 * x * x
    };
}

export function targetCycles(targetDurationSeconds, averageCycleSeconds) {
    return averageCycleSeconds > 0 ? targetDurationSeconds / averageCycleSeconds : 0;
}

/** PV de départ = dégâts effectifs moyens par cycle × cycles cibles × coefficient de profil. */
export function estimateEnemyHp({ effectiveDamagePerCycle, targetDurationSeconds, averageCycleSeconds, profileMultiplier = 1 }) {
    return Math.round(effectiveDamagePerCycle * targetCycles(targetDurationSeconds, averageCycleSeconds) * profileMultiplier);
}

/** Écart d'un combat à sa catégorie : 'short', 'ok' ou 'long' (la durée est en secondes). */
export function durationVerdict(category, seconds) {
    const range = TARGET_DURATION_SECONDS[category];
    if (!range) return 'ok';
    const [min, max] = range;
    const upper = category === 'normal' ? NORMAL_OVERRUN_SECONDS : max;
    if (seconds < min) return 'short';
    return seconds > upper ? 'long' : 'ok';
}

// --- Enregistreur d'un combat en cours -------------------------------------------------------------------------------------------------------
let current = null;

export function beginCombatRecord(info = {}, now = Date.now()) {
    current = { lastEventAt: now, startedAt: now, pausedMs: 0, pausedAt: null, playerTurns: 0, enemyTurns: 0, dealt: 0, dealtBy: { weapon: 0, spell: 0, skull: 0, other: 0 }, taken: 0, takenRaw: 0, healed: 0, ...info };
}
// Chaque événement relève le temps écoulé depuis le précédent : l'excédent au-delà de THINK_PAUSE_CAP_MS (pause de réflexion longue) est retiré de la durée.
function touch(now) {
    if (!current) return;
    if (current.pausedAt == null) {
        const gap = now - current.lastEventAt;
        if (gap > THINK_PAUSE_CAP_MS) current.pausedMs += gap - THINK_PAUSE_CAP_MS;
    }
    current.lastEventAt = now;
}
export function recordPlayerTurn(now = Date.now()) { if (current) { touch(now); current.playerTurns++; } }
export function recordEnemyTurn(now = Date.now()) { if (current) { touch(now); current.enemyTurns++; } }
export const DAMAGE_SOURCES = ['weapon', 'spell', 'skull', 'other'];   // arme, sort, crânes d'un match ; le reste : poison, lave, compagnons, altérations
export function recordDamageDealt(amount, now = Date.now(), source = 'other') {
    if (!current || !(amount > 0)) return;
    touch(now);
    const dealt = Math.floor(amount), key = DAMAGE_SOURCES.includes(source) ? source : 'other';
    current.dealt += dealt;
    current.dealtBy[key] += dealt;
}
// `raw` : dégâts avant le réglage `damageScale` de l'ennemi (sert à recalibrer sans boucle de rétroaction).
export function recordDamageTaken(amount, raw = amount, now = Date.now()) { if (current && amount > 0) { touch(now); current.taken += Math.floor(amount); current.takenRaw += Math.floor(raw > 0 ? raw : amount); } }
export function recordHealing(amount) { if (current && amount > 0) current.healed += Math.floor(amount); }
/** Met le chrono en pause (page masquée, cinématique) : le temps n'est pas compté dans la durée du combat. */
export function pauseCombatRecord(now = Date.now()) { if (current && current.pausedAt == null) { touch(now); current.pausedAt = now; } }
export function resumeCombatRecord(now = Date.now()) {
    if (current && current.pausedAt != null) { current.pausedMs += now - current.pausedAt; current.pausedAt = null; current.lastEventAt = now; }
}
export function hasCombatRecord() { return Boolean(current); }
export function abandonCombatRecord() { current = null; }

/** Clôt le combat : renvoie l'enregistrement (durée en secondes, cycles, dégâts par cycle) ou null s'il n'y en avait pas. */
export function finishCombatRecord(outcome = 'victory', now = Date.now()) {
    if (!current) return null;
    resumeCombatRecord(now);
    touch(now);
    const seconds = Math.max(0, Math.round((now - current.startedAt - current.pausedMs) / 1000));
    const cycles = Math.max(1, Math.max(current.playerTurns, current.enemyTurns));
    const { startedAt, pausedMs, pausedAt, lastEventAt, ...rest } = current;
    const record = { ...rest, outcome, seconds, cycles, damagePerCycle: Math.round((current.dealt / cycles) * 10) / 10, secondsPerCycle: Math.round((seconds / cycles) * 10) / 10 };
    current = null;
    return record;
}

/** Moyennes sur un échantillon de combats gagnés : rythme d'un cycle et dégâts effectifs par cycle (à injecter dans `estimateEnemyHp`). */
export function summarizeCombats(records = []) {
    const won = records.filter(r => r && r.outcome === 'victory' && r.cycles > 0);
    if (!won.length) return { count: 0, averageCycleSeconds: 0, effectiveDamagePerCycle: 0, damageBySourcePerCycle: Object.fromEntries(DAMAGE_SOURCES.map(k => [k, 0])), rawDamageTakenPerCycle: 0, averageSeconds: 0 };
    const sum = key => won.reduce((total, r) => total + (r[key] || 0), 0);
    const cycles = sum('cycles');
    return {
        count: won.length,
        averageCycleSeconds: Math.round((sum('seconds') / cycles) * 10) / 10,
        effectiveDamagePerCycle: Math.round((sum('dealt') / cycles) * 10) / 10,
        damageBySourcePerCycle: Object.fromEntries(DAMAGE_SOURCES.map(k => [k, Math.round((won.reduce((total, r) => total + (r.dealtBy?.[k] || 0), 0) / cycles) * 10) / 10])),
        rawDamageTakenPerCycle: Math.round((sum('takenRaw') / cycles) * 10) / 10,
        averageSeconds: Math.round(sum('seconds') / won.length)
    };
}

// --- Stockage local (les 60 derniers combats, par appareil) ----------------------------------------------------------------------------------
export function loadCombatRecords(storage = globalThis.localStorage) {
    try {
        const list = JSON.parse(storage.getItem(COMBAT_STATS_STORAGE_KEY) || '[]');
        return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
}
export function saveCombatRecord(record, storage = globalThis.localStorage) {
    if (!record) return;
    try { storage.setItem(COMBAT_STATS_STORAGE_KEY, JSON.stringify([...loadCombatRecords(storage), record].slice(-COMBAT_STATS_KEEP))); } catch (e) { /* ignoré */ }
}

// --- Calibration des ennemis ------------------------------------------------------------------------------------------------------------------
// Temps que l'ennemi met à vaincre le héros, en multiple de la durée cible, par catégorie : plus le rapport est proche de 1, plus le combat
// est serré (l'ennemi peut gagner dans la fenêtre). Valeurs trouvées par simulation (tools/balance-search.mjs search-all, héros complet,
// tous niveaux) pour viser 95 % (faible), 85 % (normal), 80 % (agressif), 75 % (élite), 70 % (mini-boss) et 60 % (boss) de victoires.
// Sous 1, l'ennemi pourrait vaincre un héros sans soins avant la fin de la durée cible : ce sont les soins (sorts, objets, Zhi) qui tiennent.
export const ENEMY_WIN_RATIO = { weak: 2.65, normal: 1.3, aggressive: 1.25, elite: 1.15, miniBoss: 0.8, boss: 0.6 };
// Correction des PV par catégorie (simulation) : durée cible ÷ durée moyenne observée des victoires (le héros ne tape pas au maximum
// à chaque cycle : il prépare ses PA et son qì, l'ennemi bloque…).
export const HP_DURATION_FACTOR = { weak: 0.5, normal: 0.77, aggressive: 0.85, elite: 1.02, miniBoss: 0.98, boss: 1.15 };
export const DEFAULT_CYCLE_SECONDS = 30;     // tant que le jeu n'a pas mesuré le rythme (exemple du document)
export const MIN_SAMPLE = 4;                 // combats mesurés (proches du niveau du héros) avant de préférer les mesures au modèle
export const DAMAGE_SCALE_BOUNDS = [0.5, 7];
// Modèles tirés de la simulation d'un héros « complet » (tools/balance-search.mjs fit : 1 680 combats, niveaux 1 à 70, 4 classes, meilleur
// équipement de son niveau, sorts équipés avec leurs effets, ultime, objet de soin, compagnon) ; remplacés par les mesures du joueur
// dès MIN_SAMPLE victoires proches de son niveau.
export const heroDamagePerCycleModel = heroLevel => 6.2 + 0.71 * Math.max(1, heroLevel);            // dégâts effectifs du héros par cycle
export const ENEMY_RAW_CATEGORY_FACTOR = { weak: 1.48, normal: 1.03, aggressive: 1.42, elite: 1.35, miniBoss: 1.24, boss: 2.09 };   // rapport mesuré à l'ennemi normal
export const enemyRawDamagePerCycleModel = (enemyLevel, category = 'normal') =>                   // dégâts bruts de l'ennemi par cycle, avant réglage
    (2.5 + 0.32 * Math.max(1, enemyLevel)) * (ENEMY_RAW_CATEGORY_FACTOR[category] || 1);   // pente du héros complet, base des premiers niveaux

// Mode de difficulté (Options > Difficulté des ennemis). Base « ultra difficile » : les dégâts de l'ennemi sont réglés au niveau Expert.
// Un mode plus doux DIVISE cette attaque (chiffres de l'arme, « Crânes ×N », Talisman de Résonance des sorts) et les bonus de son stuff
// (`MODE_DIVISOR`), tout restant affiché. Les PV de l'ennemi ne dépendent pas du mode : ils fixent la durée du combat (3 à 8 min selon la
// catégorie, dans tous les modes). En plus, l'IA joue selon le palier du mode (enemyAIProfiles.js). Taux de victoire visés du héros complet.
export const DIFFICULTY_TARGET_WIN_RATE = {
    easy: { weak: 0.98, normal: 0.95, aggressive: 0.92, elite: 0.9, miniBoss: 0.88, boss: 0.85 },
    normal: { weak: 0.95, normal: 0.85, aggressive: 0.8, elite: 0.75, miniBoss: 0.72, boss: 0.7 },
    auto: { weak: 0.95, normal: 0.85, aggressive: 0.8, elite: 0.75, miniBoss: 0.7, boss: 0.6 },
    hard: { weak: 0.9, normal: 0.72, aggressive: 0.68, elite: 0.62, miniBoss: 0.56, boss: 0.5 },
    expert: { weak: 0.85, normal: 0.6, aggressive: 0.55, elite: 0.48, miniBoss: 0.42, boss: 0.35 }
};
// Référence « ultra difficile » des dégâts (simulation, mode Expert) : rapport de victoire ×0,5, corrigé par catégorie.
export const EXPERT_WIN_RATIO_FACTOR = 0.5;
export const EXPERT_CATEGORY_FACTOR = { weak: 1.44, normal: 1, aggressive: 0.73, elite: 1.03, miniBoss: 1.22, boss: 1.22 };
export const MAX_DAMAGE_MULT = 7;   // dégâts de l'ennemi au plus ×7 (au-delà, un coup d'arme suffirait à emporter le héros)
// Diviseur de l'attaque et du stuff de l'ennemi par mode et catégorie (simulation : tools/balance-search.mjs search-divisors).
export const MODE_DIVISOR = {
    easy: { weak: 1.26, normal: 2.21, aggressive: 2.31, elite: 2.01, miniBoss: 2.11, boss: 2.31 },
    normal: { weak: 0.95, normal: 1.83, aggressive: 1.2, elite: 1.52, miniBoss: 1.67, boss: 1.52 },
    auto: { weak: 1.2, normal: 1.83, aggressive: 1.59, elite: 1.52, miniBoss: 1.83, boss: 1.52 },
    hard: { weak: 0.87, normal: 1.2, aggressive: 1.2, elite: 1.26, miniBoss: 1.45, boss: 1.32 },
    expert: { weak: 0.83, normal: 0.45, aggressive: 1.09, elite: 1.04, miniBoss: 1.32, boss: 1.09 }
};
export const MIN_DAMAGE_MULT = 1;
// Réglage propre à chaque boss de la carte (id → { attack, hp }), trouvé par simulation (tools/balance-search.mjs boss-adjust) : le calibrage
// par catégorie est une moyenne, or chaque boss a son kit fixe (arme ou non, sorts plus ou moins forts). `attack` divise son attaque en plus du
// mode (> 1 : moins fort), `hp` multiplie ses PV (durée ramenée vers le milieu de la fenêtre des boss).
export const BOSS_ADJUST = {
    fengmeng_1: { attack: 2.66, hp: 1.34 },
    rizieres_warden: { attack: 2.73, hp: 1.39 },
    volcan_forge_giant: { attack: 1.38, hp: 1.25 },
    rizieres_cave_gardien: { attack: 5.25, hp: 1.35 },
    sun_1: { attack: 1.98, hp: 1.24 },
    gobi_dune_warlord: { attack: 2.87, hp: 1.2 },
    volcan_cave_behemoth: { attack: 0.88, hp: 1.37 },
    fengmeng_2: { attack: 2.24, hp: 0.9 },
    gobi_crypt_gardien: { attack: 1.43, hp: 0.88 },
    sun_6: { attack: 1.98, hp: 0.96 },
    legend_zhuque_boss: { attack: 1.54, hp: 0.84 },
    fleuve_sluice_golem: { attack: 1.45, hp: 0.85 },
    fleuve_cave_gardien: { attack: 9.5, hp: 1.01 },
    sun_4: { attack: 0.33, hp: 0.98 },
    legend_xuanwu_boss: { attack: 0.65, hp: 1.13 },
    bambous_seal_keeper: { attack: 0.69, hp: 1.23 },
    sun_2: { attack: 7.76, hp: 0.74 },
    bambous_crypt_abbe: { attack: 7.76, hp: 0.9 },
    ws_gardien_jugement: { attack: 0.69, hp: 1.02 },
    ws_wuchang_blanc: { attack: 0.94, hp: 1.02 },
    ws_wuchang_noir: { attack: 0.5, hp: 0.94 },
    ws_reflet_peche: { attack: 1, hp: 0.97 },
    tonnerre_stone_lion: { attack: 1.13, hp: 0.91 },
    ws_yanluo: { attack: 1.06, hp: 1.08 },
    sun_3: { attack: 0.37, hp: 1.14 },
    tonnerre_cave_wyrm: { attack: 0.65, hp: 0.94 },
    wlm_gardien_flamme: { attack: 1, hp: 1 },
    fauves_alpha_tiger: { attack: 0.54, hp: 1.04 },
    fauves_crypt_tigre: { attack: 1.28, hp: 0.98 },
    sun_5: { attack: 7.76, hp: 0.81 },
    mer_tide_serpent: { attack: 1.12, hp: 1.6 },
    legend_baihu_boss: { attack: 0.65, hp: 1.18 },
    mer_cave_serpent: { attack: 0.81, hp: 1.6 },
    sun_7: { attack: 5.17, hp: 1.53 },
    fusang_root_guard: { attack: 2.38, hp: 1.29 },
    fusang_crypt_liche: { attack: 0.88, hp: 1.48 },
    sun_8: { attack: 0.94, hp: 1.6 },
    changxi: { attack: 1.13, hp: 1.01 },
    lune_crypt_vampire: { attack: 2.19, hp: 0.89 },
    legend_qinglong_boss: { attack: 0.83, hp: 1.12 },
    lune_frost_priestess: { attack: 2.38, hp: 0.85 },
    sun_9: { attack: 1.2, hp: 0.98 }
};   // un mode doux n'affaiblit jamais l'ennemi sous les chiffres de son grimoire et de son arme

// Ajustement du rapport de victoire selon le niveau du héros (points d'ancrage interpolés) : ses soins et ses défenses grandissent avec lui
// (Zhi, objets de soin, sorts de soin dès le niveau 17-20), donc à niveau élevé l'ennemi doit pouvoir frapper relativement plus fort.
export const WIN_RATIO_LEVEL_ANCHORS = [[5, 0.66], [15, 1.08], [30, 0.79], [50, 0.7], [68, 0.7]];   // tools/balance-search.mjs search-levels
export function winRatioLevelFactor(level, anchors = WIN_RATIO_LEVEL_ANCHORS) {
    const L = Math.max(1, Number(level) || 1);
    if (L <= anchors[0][0]) return anchors[0][1];
    for (let i = 1; i < anchors.length; i++) {
        const [l1, v1] = anchors[i], [l0, v0] = anchors[i - 1];
        if (L <= l1) return v0 + (v1 - v0) * (L - l0) / (l1 - l0);
    }
    return anchors[anchors.length - 1][1];
}

// Le héros n'est pas non plus un sac à PV : au-delà du budget de sa progression (base + niveaux + Endurance, plus une marge de stuff), seule une part
// de ses PV compte pour la durée du combat. Les statistiques affichées ne changent pas ; l'excédent est neutralisé par un surcroît de dégâts subis.
export const HERO_HP_ALLOWANCE = 0.6;     // marge de PV d'équipement tolérée au-dessus de la progression (+60 %)
export const HERO_SURPLUS_SHARE = 0.25;   // part des PV au-delà de ce plafond qui compte encore
export const heroReferenceHp = level => { const L = Math.max(1, Math.floor(level) || 1); return 100 + 6 * (L - 1) + 5 * Math.max(0, L - 20); };   // 100 + (5 PV + 1 Endurance) / niveau, +5 après le niveau 20
export function heroEffectiveHp(maxHp, level) {
    const ceiling = heroReferenceHp(level) * (1 + HERO_HP_ALLOWANCE);
    return maxHp <= ceiling ? maxHp : Math.round(ceiling + (maxHp - ceiling) * HERO_SURPLUS_SHARE);
}

/** Catégorie de durée d'un ennemi : boss, facile, sinon d'après la robustesse de son gabarit (hpMult du catalogue). */
export function enemyCategory({ boss = false, easy = false, hpMult = 1 } = {}) {
    if (boss) return 'boss';
    if (easy || hpMult < 1) return 'weak';
    if (hpMult < 1.3) return 'normal';
    if (hpMult < 1.6) return 'aggressive';
    if (hpMult < 2) return 'elite';
    return 'miniBoss';
}
const mid = ([a, b]) => (a + b) / 2;

/**
 * PV et réglage des dégâts d'un ennemi pour que le combat dure la durée cible, dans les deux sens :
 *  - PV = dégâts effectifs du héros par cycle × cycles cibles × coefficient du profil ;
 *  - damageScale : multiplicateur des dégâts que l'ennemi inflige, pour qu'il vainque un héros de `heroMaxHp` PV en ENEMY_WIN_RATIO × la durée cible.
 * `records` : combats mesurés (récents) ; on n'en retient que ceux joués à ±3 niveaux du héros.
 */
export function calibrateEnemy({ category, heroMaxHp: rawHeroMaxHp, heroLevel = 1, enemyLevel = heroLevel, records = [], winRatio, levelAnchors, difficulty = 'auto', modeDivisor, adjust = null }) {
    const heroMaxHp = heroEffectiveHp(rawHeroMaxHp, heroLevel);   // PV qui comptent vraiment (plafond de progression)
    const heroDamageScale = rawHeroMaxHp > heroMaxHp ? Math.round((rawHeroMaxHp / heroMaxHp) * 100) / 100 : 1;
    const near = records.filter(r => r && r.outcome === 'victory' && Math.abs((r.playerLevel || 0) - heroLevel) <= 3);
    const measured = near.length >= MIN_SAMPLE ? summarizeCombats(near) : null;
    const cycleSeconds = measured?.averageCycleSeconds > 0 ? measured.averageCycleSeconds : DEFAULT_CYCLE_SECONDS;
    const damagePerCycle = measured?.effectiveDamagePerCycle > 0 ? measured.effectiveDamagePerCycle : heroDamagePerCycleModel(heroLevel);
    const targetSeconds = mid(TARGET_DURATION_SECONDS[category] || TARGET_DURATION_SECONDS.normal);
    const cycles = targetCycles(targetSeconds, cycleSeconds);
    // Coefficient de profil : non pas une robustesse en plus (la durée cible de la catégorie la traduit déjà ; l'appliquer allongeait les
    // combats d'autant), mais une correction mesurée par simulation pour que la durée moyenne des victoires tombe sur la cible.
    const coefficient = HP_DURATION_FACTOR[category] ?? 1;
    const hp = Math.max(1, estimateEnemyHp({ effectiveDamagePerCycle: damagePerCycle, targetDurationSeconds: targetSeconds, averageCycleSeconds: cycleSeconds, profileMultiplier: coefficient }));
    // Dégâts bruts attendus de l'ennemi par cycle : mesure du joueur (pondérée par la catégorie) ou modèle de simulation.
    const rawEnemy = measured?.rawDamageTakenPerCycle > 0
        ? measured.rawDamageTakenPerCycle * (ENEMY_RAW_CATEGORY_FACTOR[category] || 1)
        : enemyRawDamagePerCycleModel(enemyLevel, category);
    // Dégâts réglés au niveau Expert, quel que soit le mode.
    const ratio = (winRatio ?? ENEMY_WIN_RATIO[category] ?? 1.2) * winRatioLevelFactor(heroLevel, levelAnchors)
        * EXPERT_WIN_RATIO_FACTOR * (EXPERT_CATEGORY_FACTOR[category] ?? 1);
    const wanted = heroMaxHp / (cycles * ratio);
    const damageScale = Math.round(Math.min(MAX_DAMAGE_MULT, Math.max(DAMAGE_SCALE_BOUNDS[0], wanted / Math.max(0.1, rawEnemy))) * 100) / 100;
    // Mode : diviseur de l'attaque (réglage Expert × neutralisation des PV du héros au-delà du plafond) et des bonus du stuff ; PV inchangés.
    const divisor = Math.max(0.25, (modeDivisor ?? MODE_DIVISOR[difficulty]?.[category] ?? 1) * (adjust?.attack ?? 1));
    const expertMult = Math.min(MAX_DAMAGE_MULT, damageScale * heroDamageScale);
    const damageMult = Math.round(Math.min(MAX_DAMAGE_MULT, Math.max(MIN_DAMAGE_MULT, expertMult / divisor)) * 100) / 100;
    const finalHp = Math.max(1, Math.round(hp * (adjust?.hp ?? 1)));
    return { hp: finalHp, hpBase: hp, modeDivisor: divisor, gearScale: Math.round(Math.min(1.5, 1 / divisor) * 100) / 100, damageMult, damageScale, heroDamageScale, heroEffectiveHp: heroMaxHp, cycles: Math.round(cycles * 10) / 10, cycleSeconds, damagePerCycle: Math.round(damagePerCycle * 10) / 10, measured: Boolean(measured) };
}

/** Part de chaque source dans les dégâts infligés (0 à 1) ; sert à repérer un levier qui fait toute la durée (arme, sort ou crânes). */
export function damageShares(summary) {
    const by = summary?.damageBySourcePerCycle || {};
    const total = DAMAGE_SOURCES.reduce((t, k) => t + (by[k] || 0), 0);
    return Object.fromEntries(DAMAGE_SOURCES.map(k => [k, total > 0 ? Math.round((by[k] || 0) / total * 100) / 100 : 0]));
}
