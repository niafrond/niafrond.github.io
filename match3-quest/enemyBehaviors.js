// Comportements distinctifs de boss. Module pur (sans DOM), branché par game.js (dégâts subis), gameTurnFlow.js (tour du boss) et statusBadges.js.
//
// Un boss dont le gabarit figure dans BEHAVIOR_TEMPLATES (ou dont l'élément et la race correspondent) reçoit `enemy.behavior`. Trois comportements :
//  - Dragon de feu (`fireDragon`) : prépare une attaque de zone (le Souffle de braise, géré par bossScript.js : dégâts + brûlure). Le héros peut
//    INTERROMPRE la préparation (assez de dégâts pendant l'échauffement, ou étourdissement) ou RENFORCER sa défense (buffs, réduction, Bastion).
//  - Reine de glace (`iceQueen`) : une armure de givre réduit les dégâts de tout ce qui n'est pas du Feu ; toutes les 3 tours, une tempête RALENTIT
//    le héros (moins de flèches par match) et BROUILLE des cases du plateau. Un sort de Feu fait fondre l'armure (3 tours), enlève le ralentissement
//    et frappe plus fort : le héros reprend l'avantage.
//  - Chevalier noir (`blackKnight`) : une garde le protège des coups PHYSIQUES (crânes, armes) ou des coups MAGIQUES (sorts) : −60 %. Frapper à
//    travers sa garde lui fait PRÉPARER UNE CONTRE-ATTAQUE (jouée à son tour). À chaque tour il se met en garde contre ce que le héros a le plus
//    employé : il faut alterner dégâts magiques et physiques.

export const BEHAVIOR_TEMPLATES = {
    iceQueen: ['dame_des_neiges', 'canglong'],
    blackKnight: ['gui_guerrier', 'seigneur_jin_long', 'garde_solaire']
};

export const BEHAVIOR_INFO = {
    fireDragon: { name: 'Dragon de feu', summary: 'Prépare une attaque de zone : interrompez-la avec assez de dégâts, ou renforcez votre défense.' },
    iceQueen: { name: 'Reine de glace', summary: 'Armure de givre, tempête qui ralentit et brouille le plateau : les sorts de Feu la font fondre.' },
    blackKnight: { name: 'Chevalier noir', summary: 'Garde physique ou magique et contre-attaque : alternez coups d\'arme et sorts.' }
};

export const FIRE_DRAGON = { interruptShare: 0.2, burnTurns: 3, burnPct: 0.03, name: 'Souffle de braise' };
export const ICE_QUEEN = { stormEvery: 3, chillTurns: 2, armorReduction: 0.3, meltTurns: 3, fireBonus: 0.25, scrambleTiles: 5 };
export const BLACK_KNIGHT = { resist: 0.6, counterShare: 0.18 };

const FIRE = 'red';

/** Identifiant du comportement d'un boss (null si aucun). `template` : fiche du catalogue (race, id). */
export function behaviorIdOf(enemy, template = null) {
    if (!enemy?.isBoss || enemy.arena || enemy.duel || enemy.isTutorialEnemy) return null;
    if (enemy.behaviorId && BEHAVIOR_INFO[enemy.behaviorId]) return enemy.behaviorId;
    const ids = [enemy.templateId, template?.id, template?.copyOf].filter(Boolean);
    for (const [id, list] of Object.entries(BEHAVIOR_TEMPLATES)) if (ids.some(t => list.includes(t))) return id;
    if (template?.race === 'Dragon' && enemy.preferredColor === FIRE) return 'fireDragon';
    return null;
}

/** État du comportement (null sans comportement). */
export function createBehavior(enemy, template = null) {
    const id = behaviorIdOf(enemy, template);
    if (!id) return null;
    if (id === 'iceQueen') return { id, turn: 0, armor: true, melt: 0 };
    if (id === 'blackKnight') return { id, turn: 0, stance: 'guard', counterReady: false, dealt: { physical: 0, magic: 0 } };
    return { id };
}

/** Nature d'un coup reçu : 'magic' (sort) ou 'physical' (crânes, armes). */
export const damageKindOf = ({ sourceSpell, damageSource } = {}) => (sourceSpell ? 'magic' : damageSource === 'skull' || damageSource === 'weapon' ? 'physical' : null);

/** Garde du chevalier : 'physical' (stance 'guard') ou 'magic' (stance 'ward'). */
export const knightResists = behavior => (behavior?.stance === 'ward' ? 'magic' : 'physical');

/**
 * Dégâts reçus par le boss après son comportement. `kind` : 'physical' | 'magic' ; `colors` : couleurs du sort.
 * Renvoie { damage, notes, melted, counterReady } (melted : l'armure de givre vient de fondre ; counterReady : le chevalier vient de se promettre une contre-attaque).
 */
export function adjustDamageTaken(behavior, damage, { kind = null, colors = [] } = {}) {
    const out = { damage, notes: [], melted: false, counterReady: false };
    if (!behavior || damage <= 0 || !kind) return out;
    if (behavior.id === 'iceQueen') {
        const fire = kind === 'magic' && colors.includes(FIRE);
        if (fire && behavior.armor) {
            behavior.armor = false;
            behavior.melt = ICE_QUEEN.meltTurns;
            out.melted = true;
            out.damage = damage + Math.max(1, Math.round(damage * ICE_QUEEN.fireBonus));
            out.notes.push(`le feu fait fondre l'armure de givre (+${Math.round(ICE_QUEEN.fireBonus * 100)} % de dégâts)`);
        } else if (!fire && behavior.armor) {
            out.damage = Math.max(1, Math.round(damage * (1 - ICE_QUEEN.armorReduction)));
            out.notes.push(`l'armure de givre absorbe ${Math.round(ICE_QUEEN.armorReduction * 100)} %`);
        }
    } else if (behavior.id === 'blackKnight') {
        behavior.dealt[kind] = (behavior.dealt[kind] || 0) + damage;
        if (kind === knightResists(behavior)) {
            out.damage = Math.max(1, Math.round(damage * (1 - BLACK_KNIGHT.resist)));
            out.notes.push(`sa garde ${kind === 'physical' ? 'physique' : 'magique'} absorbe ${Math.round(BLACK_KNIGHT.resist * 100)} %`);
            if (!behavior.counterReady) { behavior.counterReady = true; out.counterReady = true; }
        }
    }
    return out;
}

/**
 * Début du tour du boss (non étourdi, non endormi). Renvoie { action, notes, ... } :
 *  - Reine : 'storm' (tempête de givre : ralentit le héros, brouille le plateau) ou 'none' ; `rearmed` quand l'armure se reforme ;
 *  - Chevalier : 'counter' (contre-attaque, `damage`) ou 'none' ; `stance` quand il change de garde.
 */
export function stepBehavior(behavior, enemy, hero) {
    const out = { action: 'none', notes: [] };
    if (!behavior) return out;
    behavior.turn = (behavior.turn || 0) + 1;
    if (behavior.id === 'iceQueen') {
        if (behavior.melt > 0 && --behavior.melt === 0) { behavior.armor = true; out.rearmed = true; out.notes.push(`${enemy?.name || 'La reine'} reforme son armure de givre.`); }
        if (behavior.turn % ICE_QUEEN.stormEvery === 0) out.action = 'storm';
    } else if (behavior.id === 'blackKnight') {
        const { physical, magic } = behavior.dealt;
        if (physical > 0 || magic > 0) {
            const stance = physical >= magic ? 'guard' : 'ward';   // il se garde contre ce que le héros a le plus employé
            if (stance !== behavior.stance) { behavior.stance = stance; out.stance = stance; out.notes.push(`${enemy?.name || 'Le chevalier'} se met en garde contre les coups ${stance === 'guard' ? 'physiques' : 'magiques'}.`); }
            behavior.dealt = { physical: 0, magic: 0 };
        }
        if (behavior.counterReady) {
            behavior.counterReady = false;
            out.action = 'counter';
            out.damage = Math.max(1, Math.round((hero?.maxHp || 1) * BLACK_KNIGHT.counterShare));
        }
    }
    return out;
}

/** Points de flèches gagnés par un match de flèches : −1 (au moins 1) quand le héros est ralenti. */
export const chilledGain = (gain, entity) => ((entity?.statusEffects?.chilled || 0) > 0 && gain > 1 ? gain - 1 : gain);

/** Brûlure posée par le Souffle de braise : { turns, damage } (3 % des PV max du héros par tour). */
export const burnOf = hero => ({ turns: FIRE_DRAGON.burnTurns, damage: Math.max(1, Math.round((hero?.maxHp || 1) * FIRE_DRAGON.burnPct)) });

/** Lignes de la pastille d'état du comportement (statusBadges.js) : [{ id, icon, label, kind, text }]. */
export function behaviorBadges(behavior) {
    if (!behavior) return [];
    if (behavior.id === 'iceQueen') return [behavior.armor
        ? { id: 'iceArmor', icon: 'snow', label: 'Armure de givre', kind: 'buff', text: `Dégâts −${Math.round(ICE_QUEEN.armorReduction * 100)} %, sauf les sorts de Feu qui la font fondre.` }
        : { id: 'iceArmor', icon: 'fire', label: 'Givre fondu', kind: 'debuff', text: `Armure fondue : elle se reforme dans ${behavior.melt} tour(s).`, turns: behavior.melt }];
    if (behavior.id === 'blackKnight') {
        const physical = knightResists(behavior) === 'physical';
        const list = [{ id: 'knightGuard', icon: physical ? 'shield' : 'mask', label: physical ? 'Garde physique' : 'Garde magique', kind: 'buff', text: `Coups ${physical ? "d'arme et de crânes" : 'de sorts'} −${Math.round(BLACK_KNIGHT.resist * 100)} %. Alternez les types de dégâts.` }];
        if (behavior.counterReady) list.push({ id: 'knightCounter', icon: 'sword', label: 'Contre-attaque prête', kind: 'debuff', text: 'Frappera à son prochain tour.' });
        return list;
    }
    return [];
}
