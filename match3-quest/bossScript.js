// Boss semi-scriptés : attaque dévastatrice télégraphiée. Module pur (sans DOM), utilisé par gameTurnFlow.js et le simulateur.
//
// Le reste du jeu du boss reste confié à l'IA ; seule son attaque signature suit un script fixe, propre à chaque boss (donc apprenable) :
//  - un rythme régulier : premier échauffement au tour 4 ou 5 du boss, puis tous les 7 à 9 tours selon le boss ;
//  - des phases : la première fois qu'il passe sous 66 % puis sous 33 % de ses PV, il commence aussitôt un échauffement.
// Déroulé : tour 1 « échauffement » (il se concentre, n'agit pas, l'attaque est annoncée), tour 2 action normale, tour 3 attaque.
// Le héros a donc deux tours pour se préparer : buffs de défense et réduction de dégâts (diminuent l'attaque), Bastion Infranchissable
// (l'annule), bouclier de qì (l'absorbe), soin (pour l'encaisser). Étourdir ou endormir le boss pendant l'échauffement l'interrompt.
// Puissance : une part des PV max du héros selon le mode (30 % en Facile à 45 % en Expert), sans critique : un héros en pleine santé n'en
// meurt jamais d'un coup. Les coups ordinaires du boss sont réglés en conséquence (le danger vient surtout de l'attaque annoncée).

export const CHARGE_TURNS = 2;                       // tours entre l'annonce et l'attaque
export const HP_TRIGGERS = [0.66, 0.33];             // phases : seuils de PV du boss qui déclenchent un échauffement
export const SIGNATURE_SHARE = { easy: 0.3, normal: 0.35, auto: 0.35, hard: 0.4, expert: 0.45 };
export const MAX_REDUCTION = 0.75;
export const PERIOD = { min: 7, spread: 3, first: 4 };   // rythme : tous les 7 à 9 tours, premier au tour 4 ou 5 (≈ 2 attaques par combat avec les phases)                   // la préparation peut retirer au plus 75 % de l'attaque (le Bastion l'annule)
export const SIGNATURE_NAMES = { red: 'Brasier dévastateur', blue: 'Raz-de-marée', green: 'Ronces de jade', yellow: 'Foudre céleste', purple: 'Ombre dévorante' };

function hash(text) {
    let h = 2166136261;
    for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

/** Script d'un boss de la carte (null pour les autres ennemis). `difficulty` : mode de difficulté. */
export function createBossScript(enemy, difficulty = 'auto') {
    if (!enemy?.isBoss || enemy.arena || enemy.duel || enemy.isTutorialEnemy) return null;
    const h = hash(enemy.mapEnemyId || enemy.templateId || enemy.name || 'boss');
    const period = PERIOD.min + (h % PERIOD.spread);
    const first = PERIOD.first + ((h >>> 3) % 2);
    const color = ['red', 'blue', 'green', 'yellow', 'purple'].includes(enemy.preferredColor) ? enemy.preferredColor : 'red';
    const name = SIGNATURE_NAMES[color] || 'Frappe dévastatrice';
    return {
        name, color,
        // Fiche de sort affichée parmi les sorts du boss (gameHud.js) : gratuite, désactivée tant que le boss ne l'a pas annoncée, puis active
        // avec son délai ; les dégâts ne sont pas annoncés.
        spell: { id: 'bossSignature', name, color, colors: [color], cost: {}, type: 'bossSignature', description: `Attaque dévastatrice : ${name}. Inactive jusqu'à ce que le boss s'échauffe, puis il frappe 2 tours plus tard.` },
        share: SIGNATURE_SHARE[difficulty] ?? SIGNATURE_SHARE.auto,
        period, turn: 0, nextAt: first, charge: 0, triggers: [...HP_TRIGGERS]
    };
}

/**
 * Avance le script au début du tour du boss. `lostTurn` : le boss perd ce tour (étourdi, endormi…).
 * Renvoie { action } : 'start' (échauffement : le boss n'agit pas), 'charging' (il joue normalement, attaque au tour suivant),
 * 'release' (attaque dévastatrice à la place de son action), 'interrupted' (échauffement cassé), ou 'none'.
 */
export function stepBossScript(script, enemy, { lostTurn = false } = {}) {
    if (!script) return { action: 'none' };
    script.turn++;
    if (script.charge > 0) {
        if (lostTurn) { script.charge = 0; script.nextAt = script.turn + script.period; return { action: 'interrupted' }; }
        script.charge--;
        if (script.charge === 0) { script.nextAt = script.turn + script.period; return { action: 'release' }; }
        return { action: 'charging', left: script.charge };
    }
    if (lostTurn) return { action: 'none' };
    const hpPct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    const phase = script.triggers.findIndex(t => hpPct <= t);
    if (phase >= 0 || script.turn >= script.nextAt) {
        if (phase >= 0) script.triggers.splice(0, phase + 1);    // une phase franchie (et celles d'avant) ne se redéclenche pas
        script.charge = CHARGE_TURNS;
        return { action: 'start', left: CHARGE_TURNS, phase: phase >= 0 };
    }
    return { action: 'none' };
}

/** Réduction apportée par la préparation du héros (0 à MAX_REDUCTION) : buffs de défense (en points, /100) et réduction de dégâts. */
export function preparationReduction(hero) {
    const def = Math.max(0, Number(hero?.statBuffs?.defense?.amount) || 0);
    return Math.min(MAX_REDUCTION, def / 100 + Math.max(0, Number(hero?.damageReduction) || 0));
}

/** Dégâts de l'attaque dévastatrice sur le héros : { damage, blocked, reduction }. */
export function signatureDamage(script, hero) {
    const shieldWall = (hero?.statusEffects?.shieldWall || 0) > 0 && !((hero?.statusEffects?.petrified || 0) > 0);
    if (shieldWall) return { damage: 0, blocked: true, reduction: 1 };
    const reduction = preparationReduction(hero);
    const base = script.share * Math.max(1, hero?.maxHp || 1);
    return { damage: Math.max(1, Math.round(base * (1 - reduction))), blocked: false, reduction };
}

