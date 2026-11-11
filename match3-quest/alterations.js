// Altérations de combat : Muet, Maudit, Pétrifié, Endormi, Épuisé, Corrompu (et la part « se frappe lui-même » de Confus).
// Chaque altération est un compteur de tours dans `entity.statusEffects` (comme le poison). Valable pour le héros comme pour l'ennemi.
// Module sans dépendance : game.js lui branche `applyDamage` et `log` (setAlterationHooks) pour les soins corrompus.
import { resistsControl } from './gearEffects.js';

export const CURSE_PCT = 30;            // Maudit : dégâts subis majorés de 30 %
export const EXHAUST_DRAIN = 3;         // Épuisé : qì perdu chaque tour dans une couleur au hasard
export const CONFUSION_SELF_HIT = 0.35; // Confus : chance qu'une attaque se retourne contre son auteur
const QI_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

export const ALTERATION_LABELS = {
    muted: { icon: 'mask', name: 'Muet', text: 'ne peut plus lancer de sorts' },
    cursed: { icon: 'ghost', name: 'Maudit', text: 'subit davantage de dégâts' },
    petrified: { icon: 'rock', name: 'Pétrifié', text: 'ne peut plus bloquer ni parer' },
    stunned: { icon: 'dizzy', name: 'Étourdi', text: 'perd son prochain tour' },
    asleep: { icon: 'moon', name: 'Endormi', text: 'n\'agit plus tant qu\'il ne subit pas de dégâts' },
    exhausted: { icon: 'hourglass', name: 'Épuisé', text: 'perd du qì chaque tour' },
    corrupted: { icon: 'blood', name: 'Corrompu', text: 'ses soins deviennent des dégâts' },
    chilled: { icon: 'snow', name: 'Ralenti', text: 'gagne moins de points de combat' },
    burning: { icon: 'fire', name: 'Brûlé', text: 'subit des dégâts de feu chaque tour' }
};

// Altération qu'un sort inflige (`alterEnemy`), avec ses champs annexes ; null si le sort n'en pose pas.
export function alterationOfSpell(spell) {
    if (spell?.effect !== 'alterEnemy' || !ALTERATION_LABELS[spell.alteration]) return null;
    const extra = {};
    if (spell.alteration === 'cursed' && spell.cursePct) extra.cursePct = spell.cursePct;
    if (spell.alteration === 'exhausted' && spell.exhaustDrain) extra.exhaustDrain = spell.exhaustDrain;
    return { key: spell.alteration, turns: Math.max(1, Math.floor(spell.duration || 1)), extra, label: ALTERATION_LABELS[spell.alteration] };
}

export const ALTERATION_KEYS = ['muted', 'cursed', 'petrified', 'asleep', 'exhausted', 'corrupted', 'chilled', 'burning'];

let hooks = { damage: (t, d) => { t.hp = Math.max(0, (t.hp || 0) - d); }, log: () => {} };
export const setAlterationHooks = h => { hooks = { ...hooks, ...h }; };

export const hasStatus = (entity, key) => (entity?.statusEffects?.[key] || 0) > 0;
export const isMuted = entity => hasStatus(entity, 'muted');
export const isAsleep = entity => hasStatus(entity, 'asleep');
export const isPetrified = entity => hasStatus(entity, 'petrified');
export const isCorrupted = entity => hasStatus(entity, 'corrupted');

// Contrôles qui font perdre des tours (étourdissement, sommeil) : une seule fois à la fois, puis la cible leur résiste CONTROL_RESIST_TURNS tours
// de plus que la durée du contrôle (`controlResist`). Les autres contrôles (silence, scellement, pétrification…) restent combinables avec eux.
export const TURN_LOSS_CONTROLS = ['stunned', 'asleep'];
export const CONTROL_RESIST_TURNS = 2;
export const hasControlResist = entity => hasStatus(entity, 'controlResist');
export const isTurnLossControlled = entity => TURN_LOSS_CONTROLS.some(key => hasStatus(entity, key));

// Pose un contrôle qui fait perdre des tours. Renvoie { landed, reason } : reason = 'immune' (Formation de la Tortue) ou 'resist' (contrôle déjà en cours ou résistance).
export function inflictTurnLoss(entity, key, turns) {
    if (!entity) return { landed: false, reason: 'immune' };
    if (!entity.statusEffects) entity.statusEffects = {};
    if (hasStatus(entity, 'immunityEffects')) return { landed: false, reason: 'immune' };
    if (resistsControl(entity, key)) return { landed: false, reason: 'gear' };   // équipement du héros
    if (isTurnLossControlled(entity) || hasControlResist(entity)) return { landed: false, reason: 'resist' };
    const duration = Math.max(1, Math.floor(turns || 1));
    entity.statusEffects[key] = duration;
    entity.statusEffects.controlResist = duration + CONTROL_RESIST_TURNS;
    return { landed: true, reason: null, turns: duration };
}

// Pose une altération. Refusée si la cible est immunisée (Formation de la Tortue). Renvoie true si elle est posée.
export function inflictAlteration(entity, key, turns, extra = {}) {
    if (!entity) return false;
    if (TURN_LOSS_CONTROLS.includes(key)) return inflictTurnLoss(entity, key, turns).landed;
    if (!entity.statusEffects) entity.statusEffects = {};
    if (hasStatus(entity, 'immunityEffects')) return false;
    if (resistsControl(entity, key)) return false;   // équipement du héros
    entity.statusEffects[key] = Math.max(entity.statusEffects[key] || 0, Math.max(1, Math.floor(turns || 1)));
    Object.entries(extra).forEach(([k, v]) => { entity.statusEffects[k] = Math.max(entity.statusEffects[k] || 0, v); });
    return true;
}

// Maudit : dégâts majorés.
export function cursedDamage(entity, damage) {
    if (!hasStatus(entity, 'cursed') || damage <= 0) return damage;
    const pct = Math.max(0, entity.statusEffects.cursePct ?? CURSE_PCT);
    return Math.ceil(damage * (1 + pct / 100));
}

// Endormi : un dégât réveille. Renvoie true si l'entité vient de se réveiller.
export function wakeIfAsleep(entity) {
    if (!isAsleep(entity)) return false;
    delete entity.statusEffects.asleep;
    return true;
}

// Confus : l'attaque de `attacker` se retourne-t-elle contre lui ?
export function confusedSelfHit(attacker, rng = Math.random) {
    return hasStatus(attacker, 'confused') && rng() < CONFUSION_SELF_HIT;
}

// Soin : devient un dégât si l'entité est Corrompue. Renvoie { healed, harmed }. `apply` fait le soin réel (plafonné aux PV max).
export function healEntity(entity, amount) {
    const n = Math.max(0, Math.floor(amount || 0));
    if (!entity || n === 0) return { healed: 0, harmed: 0 };
    if (isCorrupted(entity)) {
        hooks.damage(entity, n);
        hooks.log(`Corrompu : le soin de ${n} PV se change en ${n} dégâts pour ${entity.name || 'la cible'}.`);
        return { healed: 0, harmed: n };
    }
    const before = entity.hp || 0;
    entity.hp = Math.min(entity.maxHp ?? before + n, before + n);
    return { healed: entity.hp - before, harmed: 0 };
}

// Altérations négatives qu'un remède peut guérir (sans le scellement, l'étourdissement et le sommeil : le héros n'agit plus, il ne peut pas utiliser de remède). Champs annexes retirés avec elles.
export const CURABLE_STATUSES = ['poisoned', 'weakened', 'confused', 'muted', 'cursed', 'petrified', 'exhausted', 'corrupted', 'chilled', 'burning'];
const STATUS_EXTRAS = { burning: ['burnDamage'], poisoned: ['poisonDamage'], weakened: ['weakenedAmount'], cursed: ['cursePct'], exhausted: ['exhaustDrain'] };
export const CURE_NAMES = { poisoned: 'le poison', weakened: "l'affaiblissement", confused: 'la confusion', muted: 'le silence', petrified: 'la pétrification', cursed: 'la malédiction', exhausted: "l'épuisement", corrupted: 'la corruption', chilled: 'le ralentissement', burning: 'la brûlure' };

/** Altérations de `keys` (sinon toutes les guérissables) dont l'entité souffre. */
export const afflictionsOf = (entity, keys = CURABLE_STATUSES) => keys.filter(k => hasStatus(entity, k));

/** Guérit les altérations de `keys` (toutes si 'all'). Renvoie les clés effectivement guéries. */
export function cureStatuses(entity, keys = 'all') {
    const cured = afflictionsOf(entity, keys === 'all' ? CURABLE_STATUSES : keys.filter(k => CURABLE_STATUSES.includes(k)));
    cured.forEach(k => {
        delete entity.statusEffects[k];
        (STATUS_EXTRAS[k] || []).forEach(x => { delete entity.statusEffects[x]; });
    });
    return cured;
}

// Fin de tour de l'entité : épuisement (qì qui fuit) puis compte à rebours de chaque altération. Renvoie les messages à journaliser.
export function tickAlterations(entity, rng = Math.random) {
    const msgs = [];
    if (!entity?.statusEffects) return msgs;
    const name = entity.name || 'La cible';
    if (hasStatus(entity, 'exhausted') && entity.mana) {
        const colors = QI_COLORS.filter(c => (entity.mana[c] || 0) > 0);
        if (colors.length) {
            const c = colors[Math.floor(rng() * colors.length)];
            const lost = Math.min(entity.mana[c], Math.max(1, Math.floor(entity.statusEffects.exhaustDrain ?? EXHAUST_DRAIN)));
            entity.mana[c] -= lost;
            msgs.push(`Épuisé : ${name} perd ${lost} qì ${c}.`);
        }
    }
    if (hasStatus(entity, 'controlResist')) {
        entity.statusEffects.controlResist--;
        if (entity.statusEffects.controlResist <= 0) delete entity.statusEffects.controlResist;
    }
    const ends = { muted: 'retrouve la voix', cursed: 'n\'est plus maudit', petrified: 'retrouve sa souplesse', asleep: 'se réveille', exhausted: 'reprend son souffle', corrupted: 'n\'est plus corrompu', chilled: 'retrouve son rythme', burning: 'cesse de brûler' };
    for (const key of ALTERATION_KEYS) {
        if (!hasStatus(entity, key)) continue;
        entity.statusEffects[key]--;
        if (entity.statusEffects[key] <= 0) {
            delete entity.statusEffects[key];
            if (key === 'cursed') delete entity.statusEffects.cursePct;
            if (key === 'exhausted') delete entity.statusEffects.exhaustDrain;
            msgs.push(`${name} ${ends[key]}.`);
        }
    }
    return msgs;
}
