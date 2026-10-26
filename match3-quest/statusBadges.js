import { icon } from './icons.js';

// Bonus / malus actifs d'un combattant, affichés en pastilles sur sa carte (survol ou appui long = explication).

const n = v => Math.max(0, Math.floor(v || 0));
const turns = t => `${t} tour${t > 1 ? 's' : ''}`;

/** Liste des effets actifs de `entity` : [{ id, icon (nom d'icône de icons.js), label, kind: 'buff' | 'debuff', turns?, text }]. */
export function activeStatuses(entity) {
    const out = [];
    const se = entity?.statusEffects || {};
    const add = (id, icon, label, kind, text, t) => out.push({ id, icon, label, kind, text, turns: t });

    if (n(se.enraged) > 0) add('enraged', 'anger', 'Fureur des Steppes', 'buff', `Ajoute +${n(se.enragedBonus)} dégâts inblocables à chaque attaque (crânes, armes, sorts).`, n(se.enraged));
    if (n(se.strength) > 0) add('strength', 'muscle', 'Force du Tigre', 'buff', `+${n(se.strengthBonus)} attaque.`, n(se.strength));
    if (n(se.barrier) > 0) add('barrier', 'shield', 'Rempart de Jade', 'buff', `+${n(se.barrierDefense)} défense.`, n(se.barrier));
    if (n(se.stoneskin) > 0) add('stoneskin', 'rock', 'Peau de Jade', 'buff', `+${n(se.stoneskinDefense)} défense.`, n(se.stoneskin));
    if (n(se.reflectDamage) > 0) add('reflect', 'mirror', 'Miroir de Bronze', 'buff', `Renvoie ${n(se.reflectDamagePercent)} % des dégâts subis à l'adversaire.`, n(se.reflectDamage));
    if (n(se.counterOnBlock) > 0) add('counter', 'sword', 'Riposte du Garde', 'buff', `Contre-attaque (${n(se.counterOnBlockDmg)} dégâts) quand un coup est bloqué.`, n(se.counterOnBlock));
    if (n(se.manaShield?.turns) > 0) add('manaShield', 'mana', 'Bouclier de qì', 'buff', `Les dégâts subis sont absorbés par le qì ${se.manaShield.color}.`, n(se.manaShield.turns));
    if (n(se.immunityEffects) > 0) add('immunity', 'yinyang', 'Formation de la Tortue', 'buff', 'Immunisé aux effets négatifs (poison, étourdissement, affaiblissement…).', n(se.immunityEffects));
    if (n(se.drainOnHit) > 0) add('drain', 'swirl', 'Flèches Sifflantes', 'buff', `Chaque coup draine ${n(se.drainOnHitAmount)} qì à l'adversaire.`, n(se.drainOnHit));
    if (n(se.flameblade) > 0) add('flameblade', 'fire', 'Lame de Feu Pourpre', 'buff', `Le prochain coup d'arme inflige +${n(se.flameblade)} dégâts.`);
    if (se.revenant) add('revenant', 'ghost', 'Revenant', 'buff', 'Revient à la vie une fois à 0 PV.');
    for (const [stat, name, icon] of [['attack', 'attaque', 'sword'], ['defense', 'défense', 'shield']]) {
        const b = entity?.statBuffs?.[stat];
        if (b && b.turns > 0) add(`buff-${stat}`, icon, `Bonus de ${name}`, 'buff', `+${n(b.amount)} ${name}.`, n(b.turns));
    }
    if (n(entity?.regenEffect?.turnsLeft) > 0) add('regen', 'heart', 'Régénération', 'buff', `Rend ${n(entity.regenEffect.hp)} PV au début de chaque tour.`, n(entity.regenEffect.turnsLeft));
    if (n(entity?.manaMultiplier?.turnsLeft) > 0) add('manaMult', 'spark', 'Déferlement du Qi', 'buff', 'Le qì gagné est multiplié.', n(entity.manaMultiplier.turnsLeft));

    if (n(se.poisoned) > 0) add('poisoned', 'poison', 'Poison', 'debuff', `Perd ${n(se.poisonDamage)} PV à chaque tour.`, n(se.poisoned));
    if (n(se.stunned) > 0) add('stunned', 'dizzy', 'Étourdi', 'debuff', 'Passe son prochain tour.', n(se.stunned));
    if (n(se.weakened) > 0) add('weakened', 'snow', 'Affaibli', 'debuff', `-${n(se.weakenedAmount)} attaque (chance de critique réduite).`, n(se.weakened));
    if (n(se.confused) > 0) add('confused', 'brain', 'Confus', 'debuff', 'Ses actions peuvent échouer ou viser au hasard.', n(se.confused));
    if (n(se.itemBlocked) > 0) add('itemBlocked', 'lock', 'Objets scellés', 'debuff', 'Ne peut pas utiliser d\'objets.', n(se.itemBlocked));
    return out;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Rangée de pastilles (vide si aucun effet). Chaque pastille porte `data-status` et un `title` de repli. */
export function statusBadgesHtml(entity) {
    const list = activeStatuses(entity);
    if (!list.length) return '';
    return `<div class="status-badges">${list.map(s =>
        `<span class="status-badge ${s.kind}" tabindex="0" data-status="${s.id}" title="${esc(`${s.label} — ${s.text}${s.turns ? ` (${turns(s.turns)})` : ''}`)}">${icon(s.icon)}${s.turns ? `<small>${s.turns}</small>` : ''}</span>`
    ).join('')}</div>`;
}

/** Contenu HTML de l'infobulle d'une pastille. */
export function statusTooltipHtml(status) {
    return `<div class="spell-tooltip-title">${icon(status.icon)} ${esc(status.label)}</div>`
        + `<div class="spell-tooltip-line">${esc(status.text)}</div>`
        + `<div class="spell-tooltip-line"><strong>${status.kind === 'buff' ? 'Bonus' : 'Malus'}</strong>${status.turns ? ` · ${turns(status.turns)} restant${status.turns > 1 ? 's' : ''}` : ' · jusqu\'à utilisation'}</div>`;
}

/** Lignes de l'infobulle d'un combattant : un bonus/malus par ligne (vide si aucun effet). */
export function statusLinesHtml(entity) {
    const list = activeStatuses(entity);
    if (!list.length) return '';
    return list.map(s =>
        `<div class="spell-tooltip-line status-line ${s.kind}">${icon(s.icon)} <strong>${esc(s.label)}</strong> — ${esc(s.text)}${s.turns ? ` (${turns(s.turns)})` : ''}</div>`
    ).join('');
}
