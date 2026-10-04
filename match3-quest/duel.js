// Règles de duel des combats contre Fengmeng (champ `duel` d'un ennemi de story.js, recopié sur l'ennemi
// de combat par createMapEnemy). Fonctions pures, testables sans DOM ; game.js les applique.
//  - mirror      : l'Archer Miroir copie les techniques du héros (sorts équipés, arme, classe) ;
//  - heroHpPct   : le héros entre dans le duel affaibli (fraction de ses PV max) ;
//  - rapidShots  : tous les N tours ennemis, Fengmeng enchaîne un tir rapide (tour bonus) ;
//  - zoneTraps   : tous les N tours ennemis, Fengmeng piège une zone 3 x 3 du plateau ; chaque case encore
//                  piégée à son tour suivant inflige des dégâts au héros. Détruire une tuile d'une case
//                  piégée pendant son tour (match, sort) la désamorce.

export const TRAP_SIZE = 3;

// Indices d'une zone carrée TRAP_SIZE x TRAP_SIZE tirée au hasard sur un plateau `size` x `size`.
export function pickTrapZone(size, rng = Math.random) {
    const span = Math.max(1, size - TRAP_SIZE + 1);
    const row0 = Math.min(span - 1, Math.floor(rng() * span));
    const col0 = Math.min(span - 1, Math.floor(rng() * span));
    const cells = [];
    for (let r = row0; r < Math.min(size, row0 + TRAP_SIZE); r++) {
        for (let c = col0; c < Math.min(size, col0 + TRAP_SIZE); c++) cells.push(r * size + c);
    }
    return cells;
}

// Dégâts d'un piège qui se déclenche : par case encore piégée, un huitième de l'attaque de Fengmeng (2 minimum).
export function trapDamage(remainingCells, enemyAttack) {
    const perCell = Math.max(2, Math.ceil((Number(enemyAttack) || 0) / 8));
    return Math.max(0, remainingCells) * perCell;
}

// Techniques du héros recopiées par l'Archer Miroir : sorts équipés (sinon sorts de classe connus), arme équipée.
export function mirrorLoadout(hero, fallbackClassSpells = []) {
    const equipped = Array.isArray(hero?.activeSpells) ? hero.activeSpells : [];
    const source = equipped.length ? equipped : fallbackClassSpells.slice(0, 4);
    return {
        spells: source.map(sp => ({ ...sp })),
        weapon: hero?.equippedWeapon ? { ...hero.equippedWeapon } : null,
        playerClass: hero?.class || null
    };
}

// Ce qui se passe juste avant un tour « normal » de Fengmeng (pas un tour bonus) : `turn` = numéro de ce tour
// (1, 2, …), `trapped` = cases encore piégées. Renvoie { detonate, layTrap, rapidShot }.
export function duelTurnPlan(duel, turn, trapped = 0) {
    if (!duel) return { detonate: 0, layTrap: false, rapidShot: false };
    return {
        detonate: Math.max(0, trapped),
        layTrap: Boolean(duel.zoneTraps) && turn % duel.zoneTraps === 0,
        rapidShot: Boolean(duel.rapidShots) && turn % duel.rapidShots === 0
    };
}

// PV de départ du héros quand il entre affaibli dans le duel.
export function weakenedHp(maxHp, pct) {
    if (!(pct > 0 && pct < 1)) return maxHp;
    return Math.max(1, Math.floor(maxHp * pct));
}
