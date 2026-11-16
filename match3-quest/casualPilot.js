// Mode Casual : applique au héros les choix de casual.js (stuff, armes, points d'attribut), sans message ni fenêtre.
// Appelé avant chaque combat, après chaque combat et à la montée de niveau.
import { getOption } from './gameOptions.js';
import { biasFor, planStuff, planWeapons, planAttributes } from './casual.js';
import { getStuffById, equipStuff, unequipStuff, STUFF_SLOTS } from './stuff.js';
import { WEAPON_STAT_BONUSES } from './weapons.js';
import { gameState, player, saveUpdate } from './game.js';
import { createWeaponButton } from './gameInventoryTabs.js';
import { applyAttributeBonus, updateLevelHud } from './gameLevelUp.js';
import { updatePlayerStatsTab } from './gameStatsTab.js';

let lossStreak = 0;   // défaites d'affilée (cette session)

export const isCasual = () => getOption('casual') === true;
export const casualLossStreak = () => lossStreak;

/** Dépense tous les points d'attribut en attente selon le profil courant. Renvoie le nombre de points dépensés. */
export function autoSpendAttributePoints() {
    const points = Math.max(0, player.unspentLevelPoints || 0);
    if (!points) return 0;
    planAttributes(player.attributes, points, biasFor(lossStreak)).forEach(attr => {
        player.attributes[attr]++;
        player.unspentLevelPoints = Math.max(0, (player.unspentLevelPoints || 0) - 1);
        applyAttributeBonus(attr);
    });
    updateLevelHud();
    updatePlayerStatsTab();
    return points;
}

/** Choisit stuff, armes et points d'attribut pour le héros (hors combat). Silencieux. */
export function runCasualAutopilot() {
    if (!isCasual() || gameState.combatState === 'active') return false;
    const bias = biasFor(lossStreak);
    let changed = autoSpendAttributePoints() > 0;

    const stuffPlan = planStuff(player, bias, getStuffById, STUFF_SLOTS);
    STUFF_SLOTS.forEach(slot => {
        const id = stuffPlan[slot];
        if ((player.stuff?.[slot] || null) === id) return;
        if (id) equipStuff(player, id); else unequipStuff(player, slot);
        changed = true;
    });

    const plan = planWeapons(player, bias, WEAPON_STAT_BONUSES);
    const byId = id => (player.weapons || []).find(w => w.id === id) || null;
    const right = byId(plan.right), left = byId(plan.left);
    const leftHeld = player.equipment?.leftHand;
    const keepsShield = leftHeld?.type === 'shield' && !left;   // un bouclier tenu n'est pas retiré pour rien
    if ((player.equippedWeapon?.id || null) !== (right?.id || null) || (!keepsShield && (leftHeld?.id || null) !== (left?.id || null))) {
        if (!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
        player.equippedWeapon = right;
        player.equipment.rightHand = right;
        if (!keepsShield) player.equipment.leftHand = left;
        changed = true;
    }
    if (changed) { createWeaponButton(); saveUpdate(); }
    return changed;
}

/** Fin de combat : met à jour la série de défaites, puis adapte l'équipement (profil défensif si le héros perd trop). */
export function noteCasualOutcome(isVictory) {
    lossStreak = isVictory ? 0 : lossStreak + 1;
    runCasualAutopilot();
}
