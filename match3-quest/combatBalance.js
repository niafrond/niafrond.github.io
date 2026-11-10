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
    current = { lastEventAt: now, startedAt: now, pausedMs: 0, pausedAt: null, playerTurns: 0, enemyTurns: 0, dealt: 0, taken: 0, healed: 0, ...info };
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
export function recordDamageDealt(amount, now = Date.now()) { if (current && amount > 0) { touch(now); current.dealt += Math.floor(amount); } }
export function recordDamageTaken(amount, now = Date.now()) { if (current && amount > 0) { touch(now); current.taken += Math.floor(amount); } }
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
    if (!won.length) return { count: 0, averageCycleSeconds: 0, effectiveDamagePerCycle: 0, averageSeconds: 0 };
    const sum = key => won.reduce((total, r) => total + (r[key] || 0), 0);
    const cycles = sum('cycles');
    return {
        count: won.length,
        averageCycleSeconds: Math.round((sum('seconds') / cycles) * 10) / 10,
        effectiveDamagePerCycle: Math.round((sum('dealt') / cycles) * 10) / 10,
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
