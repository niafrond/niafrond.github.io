// Altérations de combat : Muet, Maudit, Pétrifié, Endormi, Épuisé, Corrompu (et la part « se frappe lui-même » de Confus).
// Chaque altération est un compteur de tours dans `entity.statusEffects` (comme le poison). Valable pour le héros comme pour l'ennemi.
// Module sans dépendance : game.js lui branche `applyDamage` et `log` (setAlterationHooks) pour les soins corrompus.
export const CURSE_PCT = 30;            // Maudit : dégâts subis majorés de 30 %
export const EXHAUST_DRAIN = 3;         // Épuisé : qì perdu chaque tour dans une couleur au hasard
export const CONFUSION_SELF_HIT = 0.35; // Confus : chance qu'une attaque se retourne contre son auteur
const QI_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];

export const ALTERATION_KEYS = ['muted', 'cursed', 'petrified', 'asleep', 'exhausted', 'corrupted'];

let hooks = { damage: (t, d) => { t.hp = Math.max(0, (t.hp || 0) - d); }, log: () => {} };
export const setAlterationHooks = h => { hooks = { ...hooks, ...h }; };

export const hasStatus = (entity, key) => (entity?.statusEffects?.[key] || 0) > 0;
export const isMuted = entity => hasStatus(entity, 'muted');
export const isAsleep = entity => hasStatus(entity, 'asleep');
export const isPetrified = entity => hasStatus(entity, 'petrified');
export const isCorrupted = entity => hasStatus(entity, 'corrupted');

// Pose une altération. Refusée si la cible est immunisée (Formation de la Tortue). Renvoie true si elle est posée.
export function inflictAlteration(entity, key, turns, extra = {}) {
    if (!entity) return false;
    if (!entity.statusEffects) entity.statusEffects = {};
    if (hasStatus(entity, 'immunityEffects')) return false;
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
    const ends = { muted: 'retrouve la voix', cursed: 'n\'est plus maudit', petrified: 'retrouve sa souplesse', asleep: 'se réveille', exhausted: 'reprend son souffle', corrupted: 'n\'est plus corrompu' };
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
