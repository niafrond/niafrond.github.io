// logique globale du joueur, ennemis, combat et interface

import { escapeHtml } from "./escapeHtml.js";
import { setBoardSize, BASE_BOARD_SIZE, BOSS_BOARD_SIZE, MAX_ACTIVE_SPELLS, MAX_WEAPONS } from "./constants.js";
import { generateRandomEnemy } from "./enemies.js";
import { tutorialCallbacks, isTutorialActive, getTutorialStep } from "./tutorial.js";
import { allWeapons, getWeaponById, weaponBiomeBonus, BIOME_LABELS } from "./weapons.js";
import { weaknessDamage, ruleForBiome, prepBanner } from "./terrain.js";

import { setGameStarted, isBoardResolving, setBiomeRule, boostBoardColor } from "./board.js";
import { actionGuard } from "./actionGuard.js";

import { protectsFromBiome, stuffTotals, normalizeStuff, grantStuff } from "./stuff.js";


import { createAnnouncement, announceDurationMs, waitUntil, isHpBarEmpty, openingStrikeCount, HP_BAR_EMPTY_PAUSE_MS } from "./combatFlow.js";

import { recordBossLoss, pickBossTip } from "./bossTips.js";


import { setAIDifficultyByLevel } from "./enemyAI.js";

import { getRarityIcon, applyArtifactEffects } from "./items.js";
import { icon as svgIcon } from "./icons.js";



import { startingRage, boostedRageGain, ATTRIBUTE_MANA_RULES, agilityScore } from "./attributes.js";
import { initializeXP, addXP, normalizeXP } from "./experience.js";

import { playSfx } from "./sound.js";
import { loadSequence, sequenceRect } from "./ultimateCinematics.js"; // enregistre aussi les cinématiques plein écran des ultimes
import { getEquippedUltimate, getUltimateById, unlockUltimate, normalizeUnlockedUltimates, rageFromDamage, addRage, resetRage, isRageFull, playUltimateCinematic, ultimateCostEntries, resetUltimateMana, addUltimateMana, collectedUltimateMana, canCastUltimateMana, spendUltimateMana } from "./ultimates.js";
import { applyGrowth } from "./progression.js";
import { gearManaBonus } from "./manaGear.js";


import { resolveStrike, blockLabel, addStatBuff, describeStatBuff, clearStatBuffs } from "./combatStats.js";
import { animationFactor, vibrate } from "./gameOptions.js";
import { flyManaSpend, flyHeal } from "./manaFlight.js";
import { getSpellTooltipHtml, TOOLTIP_LONG_PRESS_MS } from "./gameTooltips.js";
export { TOOLTIP_LONG_PRESS_MS };
import { equipSpell, equipUltimate, unequipSpell, updateSpellsTab, updateUltimatePicker } from "./gameSpellsTab.js";
export { equipSpell, equipUltimate, unequipSpell, updateSpellsTab };
import { createWeaponButton, discardInventoryItem, equipGear, equipWeapon, getLeftHandWeapon, setActiveInventoryItem, shieldStats, toggleSellSurplus, unequipGear, unequipWeapon, updateAvailableWeapons, updateInventoryTab, updateItemButton, updateWeaponsTab, useInventoryItem } from "./gameInventoryTabs.js";
export { createWeaponButton, discardInventoryItem, equipGear, equipWeapon, getLeftHandWeapon, setActiveInventoryItem, shieldStats, toggleSellSurplus, unequipGear, unequipWeapon, updateAvailableWeapons, updateInventoryTab, updateItemButton, updateWeaponsTab, useInventoryItem };
import { allSpells as spellsCatalog } from "./spells.js";
import { _activeCounters, log, logActiveAction, saveUpdate, updateEnemySpells, updateStats } from './gameHud.js';
export * from './gameHud.js';
import { showCombatAnimation } from './gameStatsTab.js';
export * from './gameStatsTab.js';
import { showAttributeMenu, updateLevelHud } from './gameLevelUp.js';
export * from './gameLevelUp.js';
import { updateAvailableSpells } from './gameSpellList.js';
import { applyDuelRulesAtCombatStart, enemyTurn, finishPlayerTurn, handleEnemyDefeated } from './gameTurnFlow.js';
export * from './gameTurnFlow.js';
export * from './gameSpellList.js';

const BASE_MANA_CAP = 50;
const EMPTY_MANA_POOL = { red:0, blue:0, green:0, yellow:0, purple:0 };
const WEAPON_ICONS = {
    sword: 'sword',
    axe: 'axe',
    dagger: 'dagger',
    mace: 'mace',
    bow: 'bow',
    staff: 'staff'
};
// Icône de la classe (sprites/icons) : affichée devant le nom des combattants et des sorts de classe.
const CLASS_ICONS = { sorcerer: 'yinyang', assassin: 'bow', templar: 'shield', barbarian: 'axe' };
// Pictogramme discret des sorts qui détruisent une ligne, une colonne, les deux ou toute une couleur.
const SPELL_EFFECT_ICONS = {
    sweepRow: 'sweepRow', sweepCol: 'sweepCol', destroyColumns: 'sweepCol',
    sweepCross: 'sweepCross', starRain: 'sweepCross',
    clearColor: 'sweepColor', destroyColor: 'sweepColor', destroyPurple: 'sweepColor'
};
export const spellEffectIcon = sp => (SPELL_EFFECT_ICONS[sp.effect] ? svgIcon(SPELL_EFFECT_ICONS[sp.effect], 'spell-fx-ic') : '');
export const classIcon = classId => (CLASS_ICONS[classId] ? svgIcon(CLASS_ICONS[classId]) : '');
export const MANA_COLOR_ORDER = ['red', 'blue', 'green', 'yellow', 'purple'];
export const MANA_COLOR_META = {
    red: { name: 'Rouge' },
    blue: { name: 'Bleu' },
    green: { name: 'Vert' },
    yellow: { name: 'Jaune' },
    purple: { name: 'Violet' }
};

export { ATTRIBUTE_MANA_RULES };

export function getPrimaryAttributeEffect(entity, attribute){
    return Math.max(0, Math.floor(entity?.attributes?.[attribute] || 0));
}

function getAssociatedAttributeByColor(color){
    return Object.keys(ATTRIBUTE_MANA_RULES).find(attr => ATTRIBUTE_MANA_RULES[attr].color === color);
}

export function getAttributeManaBonus(entity, color, bonusType){
    const attribute = getAssociatedAttributeByColor(color);
    if(!attribute) return 0;
    const fixedBonus = ATTRIBUTE_MANA_RULES[attribute]?.bonuses?.[bonusType] || 0;
    if(fixedBonus <= 0) return 0;
    return Math.floor(getPrimaryAttributeEffect(entity, attribute) * fixedBonus + 1e-9);
}

export function getManaCapForColor(entity, color){
    const baseCap = Math.max(0, Math.floor(entity?.maxMana ?? BASE_MANA_CAP));
    return baseCap + getAttributeManaBonus(entity, color, "max") + gearManaBonus(entity, color);
}

export function recalculateManaCaps(entity){
    if(!entity || !entity.mana) return;
    const manaCaps = {};
    Object.keys(entity.mana).forEach(color => {
        manaCaps[color] = getManaCapForColor(entity, color);
    });
    entity.manaCaps = manaCaps;
}

export function clampManaToCaps(entity){
    if(!entity || !entity.mana) return;
    recalculateManaCaps(entity);
    Object.keys(entity.mana).forEach(color => {
        entity.mana[color] = Math.min(entity.manaCaps[color], Math.max(0, Math.floor(entity.mana[color] || 0)));
    });
}

export function addManaForColor(entity, color, baseGain, options = {}){
    if(!entity || !entity.mana || !Object.prototype.hasOwnProperty.call(entity.mana, color)) {
        return { before: 0, after: 0, totalGain: 0, gainBonus: 0, cap: 0, gained: 0 };
    }

    const before = Math.max(0, Math.floor(entity.mana[color] || 0));
    const applyGainBonus = options.applyGainBonus !== false;
    const gainBonus = applyGainBonus ? getAttributeManaBonus(entity, color, "gain") : 0;
    const manaMultAmt = (entity === player && entity.manaMultiplier && entity.manaMultiplier.turnsLeft > 0 && applyGainBonus) ? entity.manaMultiplier.mult : 1;
    const totalGain = Math.max(0, Math.floor(((baseGain || 0) + gainBonus) * manaMultAmt));
    const cap = getManaCapForColor(entity, color);
    const after = Math.min(cap, before + totalGain);
    entity.mana[color] = after;
    if(entity === player) addUltimateMana(entity, color, totalGain);
    recalculateManaCaps(entity);

    return {
        before,
        after,
        totalGain,
        gainBonus,
        cap,
        gained: Math.max(0, after - before)
    };
}

export function getWeaponIcon(weaponType){
    return svgIcon(WEAPON_ICONS[weaponType] || 'sword');
}

// Menu secret : tant qu'actif, les sorts du joueur ne coûtent aucun qì.
// Indicateur porté par le joueur, non énumérable (jamais sauvegardé) : canEntityCastSpell doit rester autonome.
export function setCheatFreeSpells(on){ Object.defineProperty(player, 'cheatFreeSpells', { value: !!on, enumerable: false, writable: true, configurable: true }); }
export function isCheatFreeSpells(){ return player.cheatFreeSpells === true; }
export function setCheatMaxRage(on){ Object.defineProperty(player, 'cheatMaxRage', { value: !!on, enumerable: false, writable: true, configurable: true }); }
export function isCheatMaxRage(){ return player.cheatMaxRage === true; }

export function canEntityCastSpell(entity, spell){
    if(!entity || !entity.mana || !spell) return false;
    if(entity.cheatFreeSpells === true) return true;

    if(typeof spell.cost === 'number') {
        return (entity.mana[spell.color] || 0) >= spell.cost;
    }

    if(spell.cost && typeof spell.cost === 'object') {
        return Object.entries(spell.cost).every(([color, amount]) =>
            (entity.mana[color] || 0) >= amount
        );
    }

    return true;
}

export function normalizeBonusTurnValue(value){
    if(value === true) return 1;
    if(value === false || value === null || value === undefined) return 0;

    const numericValue = Number(value);
    if(!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.floor(numericValue));
}

// Pastille « cadeau ×N » affichée à côté du nom tant qu'il reste des tours bonus accumulés.
export function bonusTurnBadge(entity){
    const n = normalizeBonusTurnValue(entity?.bonusTurn);
    if(n <= 0) return '';
    return `<span class="bonus-turn-badge" title="${n} tour${n > 1 ? 's' : ''} bonus en réserve">${svgIcon('gift')}×${n}</span>`;
}

export function addBonusTurn(entity, amount = 1){
    if(!entity) return 0;

    const currentTurns = normalizeBonusTurnValue(entity.bonusTurn);
    const turnsToAdd = Math.max(0, Math.floor(Number(amount) || 0));
    entity.bonusTurn = currentTurns + turnsToAdd;
    return entity.bonusTurn;
}

// Couleurs de qì d'un sort : une (coût simple) ou plusieurs (coût multi-qì).
export function spellColorsOf(spell){
    if(!spell) return [];
    if(spell.cost && typeof spell.cost === 'object') return Object.keys(spell.cost);
    if(Array.isArray(spell.colors) && spell.colors.length > 0) return spell.colors;
    return spell.color ? [spell.color] : [];
}

// Coût en HTML : pastille + montant par couleur, « + » entre deux couleurs ; le sort multi-qì est marqué `spell-multi`.
const MANA_HEX = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f', purple: '#9b59b6' };
// Coût d'un sort en { couleur: quantité } (forme unique pour `cost` nombre ou objet).
function spellCostEntries(sp){
    if(typeof sp?.cost === 'number') return [[sp.color, sp.cost]];
    if(sp?.cost && typeof sp.cost === 'object') return Object.entries(sp.cost);
    return [];
}

// Mini-barre collée à la jauge de rage : un tronçon par couleur de qì requise, rempli selon le qì possédé
// (tronçon vide / pointillé = couleur manquante).
export function ultimateManaBarHtml(entity, spell){
    const parts = ultimateCostEntries(spell).map(([color, need]) => {
        const have = entity?.cheatFreeSpells === true ? need : collectedUltimateMana(entity, color);
        const pct = need > 0 ? Math.min(100, Math.round(have / need * 100)) : 100;
        const label = `${color} ${Math.min(have, need)}/${need}`;
        return `<span class="ult-mana-seg${have >= need ? ' ok' : ' missing'}${color === 'yellow' ? ' light' : ''}" style="--seg-c:${MANA_HEX[color] || '#888'};--seg-fill:${pct}%;flex:${Math.max(1, need)}" title="${label}"><span class="ult-mana-num">${Math.min(have, need)}</span></span>`;
    });
    return parts.length ? `<div class="ult-mana-bar" aria-hidden="true">${parts.join('')}</div>` : '';
}

// Fiche de l'ultime (appui long / survol de la jauge) : nom, coût en qì avec le qì possédé, effet.
export function getUltimateTooltipHtml(entity, spell){
    const cost = ultimateCostEntries(spell).map(([color, need]) => {
        const have = entity?.cheatFreeSpells === true ? need : collectedUltimateMana(entity, color);
        return `<span class="ult-cost${have >= need ? '' : ' missing'}">${costBadge(color, `${Math.min(have, need)}/${need}`)}</span>`;
    }).join(' ');
    return `<div class="spell-tooltip-title">ULTIME · ${spell.name}</div>`
        + `<div class="spell-tooltip-line">Qì : ${cost}</div>`
        + getSpellTooltipHtml(spell);
}

// Gomette de coût : disque de la couleur du qì avec la quantité écrite dedans.
const costBadge = (color, text) => `<span class="cost-badge mana-${color}${color === 'yellow' ? ' cost-badge-light' : ''}" title="${color}">${text}</span>`;
export function spellCostHtml(sp, entity = null){
    // Avec un lanceur : chaque couleur du coût d'un sort multi-qì est marquée atteinte (`met`) ou manquante (`unmet`).
    if(entity && sp.cost && typeof sp.cost === 'object'){
        return Object.entries(sp.cost).map(([color, amount]) => `<span class="cost-part ${entity.cheatFreeSpells === true || (entity.mana?.[color] || 0) >= amount ? 'met' : 'unmet'}">${costBadge(color, amount)}</span>`).join('');
    }
    if(typeof sp.cost === 'number') return costBadge(sp.color, sp.cost);
    if(sp.cost && typeof sp.cost === 'object'){
        return Object.entries(sp.cost).map(([color, amount]) => costBadge(color, amount)).join('');
    }
    return '';
}
// Marque visuelle d'un sort multi-qì : barre dégradée aux deux couleurs (CSS `.spell-multi`).
export function markMultiManaSpell(el, sp){
    const colors = spellColorsOf(sp);
    if(colors.length < 2) return;
    el.classList.add('spell-multi');
    el.style.setProperty('--spell-c1', MANA_HEX[colors[0]] || '#888');
    el.style.setProperty('--spell-c2', MANA_HEX[colors[colors.length - 1]] || '#888');
}

function getPrimarySpellColor(spell, target = null){
    if(!spell || typeof spell !== 'object') return null;

    // Sort multi-qì : on retient la couleur la plus pertinente contre la cible (sa faiblesse, sinon une couleur qu'elle ne maîtrise pas)
    const multi = spellColorsOf(spell);
    if(multi.length > 1 && target){
        if(target.weakColor && multi.includes(target.weakColor)) return target.weakColor;
        const other = multi.find(c => c !== target.preferredColor);
        if(other) return other;
    }
    if(Array.isArray(spell.colors) && spell.colors.length > 0) {
        return spell.colors[0];
    }
    if(Array.isArray(spell.couleurs) && spell.couleurs.length > 0) {
        return spell.couleurs[0];
    }
    if(typeof spell.color === 'string' && spell.color.trim().length > 0) {
        return spell.color;
    }
    if(spell.cost && typeof spell.cost === 'object') {
        const keys = Object.keys(spell.cost);
        return keys.length > 0 ? keys[0] : null;
    }

    return null;
}

function applyEnemyColorAffinityModifier(target, damage, sourceColor){
    if(target !== enemy) {
        return {
            modifiedDamage: damage,
            affinityType: null,
            delta: 0
        };
    }

    const color = typeof sourceColor === 'string' ? sourceColor.toLowerCase() : null;
    const preferredColor = typeof target.preferredColor === 'string' ? target.preferredColor.toLowerCase() : null;
    const weakColor = typeof target.weakColor === 'string' ? target.weakColor.toLowerCase() : null;
    const levelDelta = Math.max(0, Math.floor(target.level || 0));

    if(!color || levelDelta <= 0) {
        return {
            modifiedDamage: damage,
            affinityType: null,
            delta: 0
        };
    }

    if(preferredColor && color === preferredColor) {
        const reduced = Math.max(0, damage - levelDelta);
        return {
            modifiedDamage: reduced,
            affinityType: 'force',
            delta: damage - reduced
        };
    }

    if(weakColor && color === weakColor) {
        return {
            modifiedDamage: damage + levelDelta,
            affinityType: 'faiblesse',
            delta: levelDelta
        };
    }

    return {
        modifiedDamage: damage,
        affinityType: null,
        delta: 0
    };
}

// Résultat { damage, crit, block } du dernier sort de dégâts résolu par applyDamage (pour l'animation et le journal).
let lastSpellStrike = null;

// Dégâts réellement infligés par le dernier sort (bonus, critique et blocage inclus), `fallback` si aucun jet n'a eu lieu.
export function lastSpellDamage(fallback){
    return lastSpellStrike ? lastSpellStrike.damage : fallback;
}

export function applyDamage(target, damage, options = {}){
    if(!target) return 0;
    let normalizedDamage = Math.max(0, Math.floor(damage || 0));

    // Les sorts de dégâts peuvent aussi être critiques (attaque du lanceur) et bloqués (défense de la cible).
    lastSpellStrike = null;
    if(options.sourceSpell && normalizedDamage > 0 && (target === player || target === enemy)) {
        const caster = target === player ? enemy : player;
        const weakened = caster === enemy ? Math.max(0, Math.floor(enemy.statusEffects?.weakenedAmount || 0)) : 0;
        // Les ultimes sont inblocables et imparables : on les résout contre une cible sans défense (le critique reste possible).
        const strike = resolveStrike(normalizedDamage, caster, options.sourceSpell.ultimate ? {} : target, { weakened });
        normalizedDamage = strike.damage;
        strike.damage = normalizedDamage;
        lastSpellStrike = strike;
        if(strike.crit) log(`${options.sourceSpell.name} : coup critique !`);
        if(strike.block === 'total') log(`${escapeHtml(target.name)} bloque entièrement ${options.sourceSpell.name}.`);
        else if(strike.block === 'partial') log(`${escapeHtml(target.name)} pare ${options.sourceSpell.name}.`);
    }

    const sourceColor = options.sourceColor || getPrimarySpellColor(options.sourceSpell, target);
    const affinityResult = applyEnemyColorAffinityModifier(target, normalizedDamage, sourceColor);
    normalizedDamage = affinityResult.modifiedDamage;
    if(cheatOneShot && target === enemy && normalizedDamage > 0) normalizedDamage = Math.max(normalizedDamage, (enemy.hp || 0) + (enemy.shield || 0) + 1);

    if(affinityResult.affinityType === 'force' && affinityResult.delta > 0) {
        log(`${escapeHtml(target.name)} résiste (${target.preferredColor}) : -${affinityResult.delta} dégâts (niveau ${target.level}).`);
    } else if(affinityResult.affinityType === 'faiblesse' && affinityResult.delta > 0) {
        log(`${escapeHtml(target.name)} est faible à ${sourceColor} : +${affinityResult.delta} dégâts (niveau ${target.level}).`);
    }

    // Bouclier équipé : absorbe un total de dégâts par combat (`absorbDamage`).
    if(target === player && normalizedDamage > 0 && player.shieldAbsorbLeft > 0) {
        const absorbedByShield = Math.min(player.shieldAbsorbLeft, normalizedDamage);
        player.shieldAbsorbLeft -= absorbedByShield;
        normalizedDamage -= absorbedByShield;
        log(`${player.equipment?.leftHand?.name || 'Votre bouclier'} absorbe ${absorbedByShield} dégâts.`);
    }

    // Bouclier mana: certains sorts redirigent les dégâts subis vers une réserve de qì.
    if(target === player && normalizedDamage > 0) {
        const manaShield = player.statusEffects?.manaShield;
        const shieldColor = manaShield?.color;
        const shieldTurns = Math.max(0, Math.floor(manaShield?.turns || 0));
        if(shieldColor && shieldTurns > 0) {
            const availableMana = Math.max(0, Math.floor(player.mana?.[shieldColor] || 0));
            const absorbed = Math.min(availableMana, normalizedDamage);
            if(absorbed > 0) {
                player.mana[shieldColor] = availableMana - absorbed;
                normalizedDamage -= absorbed;
                log(`Bouclier de qì (${shieldColor}) absorbe ${absorbed} dégâts.`);
            }

            if(player.mana[shieldColor] <= 0) {
                delete player.statusEffects.manaShield;
                log(`Le bouclier de qì se dissipe.`);
            }
        }
    }

    const currentHp = Math.max(0, Math.floor(target.hp || 0));
    // Tutoriel : plancher de PV de l'adversaire (il ne meurt qu'à l'étape finale, sans gonfler ses PV).
    const hpFloor = target === enemy ? Math.max(0, Math.min(currentHp, tutorialCallbacks.enemyHpFloor || 0)) : 0;
    const nextHp = Math.max(hpFloor, currentHp - normalizedDamage);
    target.hp = nextHp;
    // Le téléphone vibre quand le joueur subit des dégâts (plus long si le coup est lourd ; option « Vibrations »).
    if(target === player && currentHp - nextHp > 0) vibrate(Math.min(260, 70 + Math.round(190 * (currentHp - nextHp) / Math.max(1, player.maxHp))), true);

    // Jauge de rage : se charge quand le joueur perd des PV en combat.
    if(target === player && currentHp - nextHp > 0 && gameState.combatState === 'active') {
        addRage(player, boostedRageGain(player, rageFromDamage(currentHp - nextHp, player.maxHp)));
    }

    if(target === player && normalizedDamage > 0 && enemy.hp > 0) {
        // Gorgerin antique de la Charrette : une part des dégâts reçus retourne à l'ennemi.
        const ancientReflect = stuffTotals(player).reflectPct;
        if(ancientReflect > 0) {
            const reflected = Math.floor((normalizedDamage * ancientReflect) / 100);
            if(reflected > 0) {
                enemy.hp = Math.max(0, enemy.hp - reflected);
                log(`Gorgerin antique : ${reflected} dégâts renvoyés à ${enemy.name}.`);
            }
        }
        const reflectTurns = Math.max(0, Math.floor(player.statusEffects?.reflectDamage || 0));
        const reflectPercent = Math.max(0, Math.floor(player.statusEffects?.reflectDamagePercent || 0));
        if(reflectTurns > 0 && reflectPercent > 0) {
            const reflected = Math.max(0, Math.floor((normalizedDamage * reflectPercent) / 100));
            if(reflected > 0) {
                const enemyHpBefore = enemy.hp;
                const enemyHpAfter = Math.max(0, enemyHpBefore - reflected);
                enemy.hp = enemyHpAfter;
                log(`Miroir de Bronze renvoie ${enemyHpBefore - enemyHpAfter} dégâts à ${enemy.name}.`);
            }
        }

        const counterTurns = Math.max(0, Math.floor(player.statusEffects?.counterOnBlock || 0));
        const counterDmg = Math.max(0, Math.floor(player.statusEffects?.counterOnBlockDmg || 0));
        if(counterTurns > 0 && counterDmg > 0 && (player.defense || 0) > 0) {
            const enemyHpBefore = enemy.hp;
            const enemyHpAfter = Math.max(0, enemyHpBefore - counterDmg);
            enemy.hp = enemyHpAfter;
            log(`Contre-attaque inflige ${enemyHpBefore - enemyHpAfter} dégâts à ${enemy.name}.`);
        }
    }

    if(target === enemy && normalizedDamage > 0) {
        const drainTurns = Math.max(0, Math.floor(player.statusEffects?.drainOnHit || 0));
        const drainAmount = Math.max(0, Math.floor(player.statusEffects?.drainOnHitAmount || 0));
        if(drainTurns > 0 && drainAmount > 0) {
            const manaColors = ['red', 'blue', 'green', 'yellow', 'purple'];
            let remaining = drainAmount;
            for(const color of manaColors) {
                if(remaining <= 0) break;
                const available = Math.max(0, Math.floor(enemy.mana[color] || 0));
                if(available <= 0) continue;
                const steal = Math.min(available, remaining);
                enemy.mana[color] -= steal;
                remaining -= steal;
            }
            const drained = drainAmount - remaining;
            if(drained > 0) {
                log(`Flèches Sifflantes drainent ${drained} qì ennemi.`);
            }
        }
    }

    if(gameState.combatState === 'active') {
        if(player.hp <= 0) {
            handlePlayerDeath();
        } else if(enemy.hp <= 0) {
            handleEnemyDefeated();
        }
    }

    return currentHp - nextHp;
}

function getMissingManaColor(entity, spell){
    if(!entity || !entity.mana || !spell) return null;

    if(typeof spell.cost === 'number') {
        return (entity.mana[spell.color] || 0) >= spell.cost ? null : spell.color;
    }

    if(spell.cost && typeof spell.cost === 'object') {
        for(const [color, amount] of Object.entries(spell.cost)) {
            if((entity.mana[color] || 0) < amount) return color;
        }
    }

    return null;
}

export function consumeSpellMana(entity, spell){
    if(!entity || !entity.mana || !spell) return;
    if(entity.cheatFreeSpells === true) return;

    const paid = {};
    if(typeof spell.cost === 'number') {
        paid[spell.color] = spell.cost;
    } else if(spell.cost && typeof spell.cost === 'object') {
        Object.assign(paid, spell.cost);
    }
    Object.entries(paid).forEach(([color, amount]) => {
        entity.mana[color] = Math.max(0, (entity.mana[color] || 0) - amount);
    });
    flyManaSpend(entity === player, paid, { toSpellId: entity === player ? spell.id : null });
}

export function applyStandardSpellEffects(caster, target, spell, isPlayerCaster){
    if(spell.effect === 'statBuff' && !isPlayerCaster){
        const buff = { attack: spell.atkBuff || 0, defense: spell.defBuff || 0, turns: spell.duration || 1 };
        addStatBuff(caster, buff);
        showCombatAnimation({ icon: buff.attack > 0 ? 'sword' : 'shield', title: spell.name, heal: describeStatBuff(buff), source: caster.name, target: `→ ${caster.name}` }, false);
        log(`${escapeHtml(caster.name)} lance ${spell.name} : ${describeStatBuff(buff)}.`);
        return;
    }
    const intelligenceBonus = getPrimaryAttributeEffect(caster, "intelligence");

    if(spell.dmg){
        let spellFlags = '';
        const spellColors = spellColorsOf(spell);
        const targetResistance = spellColors.length
            ? spellColors.reduce((sum, c) => sum + (target.resistances?.[c] || 0), 0) / spellColors.length   // multi-qì : résistance moyenne
            : (target.resistances?.[spell.color] || 0);
        let dmg = Math.floor((spell.dmg + intelligenceBonus) * (1 - targetResistance));
        if(isPlayerCaster && target.prep?.weaknessRevealed){
            dmg = weaknessDamage(dmg, spellColors.includes(target.weakColor) ? target.weakColor : spell.color, target.weakColor, true);
        }
        if(!isPlayerCaster && target.damageReduction > 0) {
            dmg = Math.max(1, Math.floor(dmg * (1 - target.damageReduction)));
        }
        applyDamage(target, dmg, { sourceSpell: spell });
        if(lastSpellStrike) {
            dmg = lastSpellStrike.damage;
            spellFlags = `${lastSpellStrike.crit ? ' CRITIQUE !' : ''}${blockLabel(lastSpellStrike.block) ? ` ${blockLabel(lastSpellStrike.block)}` : ''}`;
        }

        if(isPlayerCaster) {
            playSfx('spellHit', { isPlayer: true });
            showCombatAnimation({ icon: 'fire', title: spell.name, damage: `-${Math.floor(dmg)} dégâts${spellFlags}`, target: `→ ${target.name}` }, true);
            log(`${spell.name} inflige ${dmg} dégâts.`);
        } else {
            playSfx('spellHit', { isPlayer: false });
            showCombatAnimation({ icon: 'fire', title: spell.name, damage: `-${Math.floor(dmg)} dégâts${spellFlags}`, source: caster.name, target: '→ Vous' }, false);
            log(`${escapeHtml(caster.name)} lance ${spell.name} ! ${dmg} dégâts.`);
        }
    }

    if(spell.effect === 'bonusTurn'){   // Tir Furtif : le lanceur rejoue, quel qu'il soit
        addBonusTurn(caster, 1);
        log(`${spell.name} : ${escapeHtml(caster.name)} gagne un tour bonus !`);
    }

    if(spell.heal){
        const healAmount = spell.heal + intelligenceBonus;
        caster.hp = Math.min(caster.maxHp, caster.hp + healAmount);
        flyHeal(isPlayerCaster, healAmount);
        playSfx('heal', { isPlayer: isPlayerCaster });

        if(isPlayerCaster) {
            showCombatAnimation({ icon: 'leaf', title: spell.name, heal: `+${healAmount} HP`, target: '→ Vous' }, true);
            log(`${spell.name} soigne ${healAmount} HP.`);
        } else {
            showCombatAnimation({ icon: 'leaf', title: spell.name, heal: `+${healAmount} HP`, source: caster.name }, false);
            log(`${escapeHtml(caster.name)} utilise ${spell.name} et soigne ${healAmount} HP.`);
        }
    }
}

// joueur
export let player = {
    name: "Hou Yi",
    hp: 100,
    maxHp: 100,
    mana: { ...EMPTY_MANA_POOL },
    maxMana: BASE_MANA_CAP,
    manaCaps: { red:BASE_MANA_CAP, blue:BASE_MANA_CAP, green:BASE_MANA_CAP, yellow:BASE_MANA_CAP, purple:BASE_MANA_CAP },
    attack: 15,
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    attributes: { strength:0, agility:0, intelligence:0, stamina:0, morale:0 },
    spells: [],
    activeSpells: [],  // sorts équipés (max 4)
    equippedUltimate: null,  // id de l'ultime choisi (le seul utilisable en combat, via la jauge de rage)
    unlockedUltimates: [],   // ultimes de légende (Quatre Gardiens Célestes) gagnés par quête, toutes classes (ultimates.js)
    availableSpells: [], // sorts débloqués
    weapons: [],  // armes possédées
    equippedWeapon: null,  // arme équipée
    availableWeapons: [],  // armes débloquées
    equipment: { rightHand: null, leftHand: null, item: null },  // système d'équipement multi-slot
    stuffOwned: [],  // casques, colliers, bracelets et bagues possédés (stuff.js)
    stuff: { head: null, neck: null, wrist: null, ring: null },  // stuff porté (ids)
    combatPoints: 0,
    bonusTurn: 0,
    abilities: [],  // aptitudes acquises
    class: null,  // classe du joueur (sorcerer, assassin, templar, barbarian)
    statusEffects: {},  // effets de statut actifs (poison, stun, buffs, etc.)
    defense: 0,  // défense du joueur
    inventory: [],  // inventaire des objets possédés
    activeInventoryIndex: null,  // index de l'objet actuellement actif
    sellTags: [],  // ids des objets dont l'excédent est à vendre au prochain marchand
    tempAttack: 0,  // bonus d'attaque temporaire
    tempDefense: 0,  // bonus de défense temporaire
    hasRevive: false,  // possède un effet de résurrection
    revivePercent: 0,  // pourcentage de HP à la résurrection
    unspentLevelPoints: 0, // points d'attribut a depenser apres les gains de niveaux
    gold: 0,  // pièces d'or accumulées
    torch: false,  // torche achetée : éclaire les souterrains (world/underground.js)
    mount: null,  // monture achetée ('horse') : déplacements plus rapides sur les cartes
    defeatedBossTiers: [], // paliers de boss déjà nettoyés (5, 10, 15, ...)
    pendingBoss: null, // boss imposé tant qu'il n'est pas vaincu
    worldMap: { currentZoneId: null, visitedZoneIds: [] }, // régions découvertes (carte du monde)
    exploration: null // progression sur la carte d'exploration (voir exploration.js, arène comprise), créée au premier lancement
};

// Équipe automatiquement une arme de départ si le joueur n'en a encore aucune.
// Appelé à la création du personnage (choix de classe) et comme garde-fou
// pour les sauvegardes existantes créées avant l'introduction de cette règle.
export function grantStartingWeapon(weaponId){
    if(player.equippedWeapon) return null;
    if(Array.isArray(player.weapons) && player.weapons.length > 0) return null;

    const weapon = getWeaponById(weaponId) || allWeapons.find(w => w.minLevel <= player.level) || allWeapons[0];
    if(!weapon) return null;

    if(!player.weapons) player.weapons = [];
    if(!player.weapons.some(w => w.id === weapon.id)) {
        player.weapons.push(weapon);
    }
    player.equippedWeapon = weapon;
    if(player.equipment) player.equipment.rightHand = weapon;
    updateAvailableWeapons();
    log(`Vous recevez votre arme de départ : ${weapon.name}.`);
    return weapon;
}

// Range dans le sac le butin d'un coffre d'exploration (tiré par chestLoot.js : rollChestLoot).
// Retourne les libellés à afficher en texte (ex. « Bague d'Archer en Jade (rare) »).
const RARITY_LABEL = { common: 'commune', uncommon: 'peu commune', rare: 'rare', legendary: 'légendaire' };
export function grantChestLoot({ loot = [] } = {}){
    if(!Array.isArray(player.inventory)) player.inventory = [];
    if(!Array.isArray(player.weapons)) player.weapons = [];
    const labels = [];
    loot.forEach(entry => {
        const rarityIcon = getRarityIcon(entry.rarity);
        const rarityText = RARITY_LABEL[entry.rarity] || entry.rarity;
        if(entry.kind === 'weapon' && entry.weapon) {
            if(player.weapons.some(w => w.id === entry.weapon.id)) return;
            player.weapons.push(entry.weapon);
            const lvl = entry.weapon.minLevel > player.level ? `, niv. ${entry.weapon.minLevel}` : '';
            labels.push(`${entry.weapon.name} (${rarityText}${lvl})`);
            log(`${getWeaponIcon(entry.weapon.type)} Trouvé dans un coffre : ${entry.weapon.name} !`);
        } else if(entry.kind === 'item' && entry.item) {
            player.inventory.push({ ...entry.item, applied: false });
            // Une relique n'a pas d'emplacement : on dit où elle va (bonus permanent, listée dans l'onglet Stuff).
            labels.push(entry.item.type === 'artifact' ? `${entry.item.name} (relique permanente, ${rarityText}, onglet Stuff)` : `${entry.item.name} (${rarityText})`);
            log(`${rarityIcon} Trouvé dans un coffre : ${entry.item.name} !`);
            if(entry.item.type === 'artifact') {
                applyArtifactEffects(player);
                log(entry.item.description);
            }
        }
    });
    if(labels.length) {
        normalizeActiveInventoryIndex();
        updateAvailableWeapons();
        updateInventoryTab();
    }
    return labels;
}

// Range un stuff (casque, collier, bracelet, bague) dans la collection du héros ; renvoie son libellé, ou null s'il l'avait déjà.
export function grantStuffPiece(id, origin = 'Trouvé'){
    const s = grantStuff(player, id);
    if(!s) return null;
    log(`${getRarityIcon(s.rarity)} ${origin} : ${s.name} (onglet Stuff) !`);
    document.dispatchEvent(new Event('stuff-changed'));
    return s.name;
}

// Récompense de quête : un ultime de légende, pour toutes les classes. Retourne le sort s'il vient d'être débloqué, sinon null (déjà acquis ou inconnu).
export function grantUltimate(id, origin = 'Récompense de quête'){
    if(!unlockUltimate(player, id)) return null;
    const spell = getUltimateById(id);
    log(`✦ ${origin} : ultime « ${spell.name} » débloqué (onglet Sorts, niveau ${spell.minLevel} requis) !`);
    saveUpdate();
    if(typeof document !== 'undefined' && document.getElementById('ultimate-spells-list')) updateUltimatePicker();
    return spell;
}

// tour actuel
export let currentTurn = 'player';
export function setCurrentTurn(value){ currentTurn = value; }   // une liaison importée ne s'assigne pas : les modules extraits passent par ici

// Compagnons actifs transmis par l'exploration (ids comme 'xiao_gui', 'zhi', 'dawa').
export let activeCompanionIds = new Set();
export function setActiveCompanions(ids) { activeCompanionIds = new Set(ids || []); }

// Garde-fou : Xiao Gui ne joue qu'une seule fois par tour du joueur.
export const turnFlags = { foxActed: false, companionsActed: false, pendingOutcome: null, foxPlaying: false };   // état du tour (renard, pouvoirs des compagnons) : objet partagé avec gameTurnFlow.js
export const isFoxPlaying = () => turnFlags.foxPlaying;

// état du combat (objet pour pouvoir modifier la propriété)
export const gameState = { 
    combatState: 'ready' // 'ready' (avant combat), 'active' (en cours), 'finished' (terminé)
};

export const combatRewards = {
    xpGained: 0,
    xpApplied: false,
    items: [],
    weapons: [],
    gold: 0,
    levelsGained: 0,      // niveaux gagnés en fin de combat (écran de résultat)
    levelReached: 0
};

const PLAYER_DEATH_DELAY_MS = 900;
const LEVEL_UP_MAX_HP_GAIN = 5;
const LEVEL_UP_HEAL_GAIN = 20;
let pendingPlayerDeathTimeout = null;

function resetCombatRewards(){
    combatRewards.xpGained = 0;
    combatRewards.xpApplied = false;
    combatRewards.items = [];
    combatRewards.weapons = [];
    combatRewards.gold = 0;
    combatRewards.levelsGained = 0;
    combatRewards.levelReached = 0;
}

export function queueCombatXP(xpAmount){
    const safeXP = Math.max(0, Math.floor(xpAmount || 0));
    if(safeXP <= 0) return 0;
    combatRewards.xpGained += safeXP;
    return safeXP;
}

// Récompenses d'un gain de niveau (hors XP) : points d'attribut, PV max et soin. Commun au combat et à l'exploration.
function applyLevelUpRewards(levelUpResult){
    let maxHpGained = 0;
    let hpRecovered = 0;
    if(levelUpResult?.leveledUp) {
        const levelsGained = Math.max(1, levelUpResult.levelsGained || 1);
        player.unspentLevelPoints = Math.max(0, player.unspentLevelPoints || 0) + levelsGained;

        maxHpGained = levelsGained * LEVEL_UP_MAX_HP_GAIN;
        if(maxHpGained > 0) {
            player.maxHp += maxHpGained;
        }
        // croissance innée (attaque après le niveau 18, PV après le niveau 20) : voir progression.js
        const extras = applyGrowth(player);
        maxHpGained += extras.maxHp;
        if(extras.attack > 0) log(`+${extras.attack} attaque (maîtrise du niveau ${player.level}).`);

        const beforeHeal = player.hp;
        const healAmount = levelsGained * LEVEL_UP_HEAL_GAIN;
        if(healAmount > 0 || maxHpGained > 0) {
            // Le gain de HP max est aussi applique aux HP actuels pour eviter une perte relative.
            player.hp = Math.min(player.maxHp, player.hp + healAmount + maxHpGained);
            hpRecovered = Math.max(0, player.hp - beforeHeal);
        }
        // le nouveau niveau déverrouille des pièces : l'onglet Stuff (rendu une seule fois) doit se rafraîchir
        document.dispatchEvent(new Event('stuff-changed'));
    }
    return { maxHpGained, hpRecovered };
}

// XP gagnée hors combat (quêtes, exploration) : même traitement qu'un niveau gagné en combat — points d'attribut,
// PV, sorts/armes débloqués, journal, sauvegarde. Renvoie { leveledUp, newLevel, levelsGained } ; l'appelant affiche la
// notification et ouvre l'écran de choix (`showAttributeMenu`).
export function grantExplorationXP(amount){
    const res = addXP(player, Math.max(0, Math.floor(amount || 0)));
    if(!res.leveledUp) return res;
    const { maxHpGained, hpRecovered } = applyLevelUpRewards(res);
    log(`Niveau ${player.level} atteint ! +${maxHpGained} HP max, +${hpRecovered} HP de recuperation.`);
    if((res.levelsGained || 1) > 1) log(`Vous avez gagné ${res.levelsGained} niveaux d'un coup !`);
    updateAvailableSpells();
    updateAvailableWeapons();
    updateInventoryTab();
    updateLevelHud();
    saveUpdate();
    return res;
}

export function applyCombatXPAtEnd(){
    if(combatRewards.xpApplied) {
        return {
            xpApplied: 0,
            leveledUp: false,
            levelsGained: 0,
            maxHpGained: 0,
            hpRecovered: 0
        };
    }

    const pendingXP = Math.max(0, Math.floor(combatRewards.xpGained || 0));
    combatRewards.xpApplied = true;

    if(pendingXP <= 0) {
        return {
            xpApplied: 0,
            leveledUp: false,
            levelsGained: 0,
            maxHpGained: 0,
            hpRecovered: 0
        };
    }

    const levelUpResult = addXP(player, pendingXP);
    const { maxHpGained, hpRecovered } = applyLevelUpRewards(levelUpResult);
    combatRewards.levelsGained = levelUpResult.leveledUp ? (levelUpResult.levelsGained || 1) : 0;
    combatRewards.levelReached = player.level;

    return {
        xpApplied: pendingXP,
        leveledUp: levelUpResult.leveledUp,
        levelsGained: levelUpResult.levelsGained,
        maxHpGained,
        hpRecovered
    };
}

function hideCombatResultScreen(){
    const screen = document.getElementById('battle-result-screen');
    if(screen){
        screen.classList.remove('active');
    }
}

function showCombatResultScreen(isVictory){
    const screen = document.getElementById('battle-result-screen');
    const title = document.getElementById('battle-result-title');
    const subtitle = document.getElementById('battle-result-subtitle');
    const summary = document.getElementById('battle-result-summary');
    if(!screen || !title || !subtitle || !summary) return;

    title.textContent = isVictory ? 'Victoire' : 'Défaite';
    subtitle.textContent = isVictory ? 'Combat terminé avec succès.' : 'Vous avez été vaincu.';

    const allLoot = [...combatRewards.weapons, ...combatRewards.items];
    const lootLines = allLoot.length > 0
        ? allLoot.map(name => `<li>${name}</li>`).join('')
        : '<li class="battle-result-empty">Aucun butin</li>';

    const gold = combatRewards.gold || 0;
    const levelLine = combatRewards.levelsGained > 0
        ? `<div class="battle-result-levelup">${svgIcon('star')} Niveau ${combatRewards.levelReached} atteint${combatRewards.levelsGained > 1 ? ` (+${combatRewards.levelsGained})` : ''} !</div>`
        : '';

    // Anti try-hard : après trois défaites d'affilée contre le même boss, un conseil pour progresser autrement.
    const tip = !isVictory && enemy?.isBoss
        ? pickBossTip(player.bossLossStreak, { playerLevel: player.level, bossLevel: enemy.level, gold: player.gold, unspentPoints: player.unspentLevelPoints })
        : null;
    // Trois sections nettement séparées (cadre, titre, icône) qui se partagent la hauteur de l'écran.
    const section = (cls, icon, label, body) => `
        <section class="battle-result-section battle-result-sec-${cls}">
            <h3 class="battle-result-section-title">${svgIcon(icon)} <span>${label}</span></h3>
            <div class="battle-result-section-body">${body}</div>
        </section>`;
    summary.innerHTML = `
        ${tip ? `<p class="battle-result-tip">${svgIcon('scroll')} <strong>Conseil :</strong> ${tip}</p>` : ''}
        ${section('xp', 'star', 'Expérience', `<div class="battle-result-xp">+${combatRewards.xpGained} XP</div>${levelLine}`)}
        ${section('gold', 'coin', 'Pièces', `<div class="battle-result-gold">${gold > 0 ? `+${gold} pièce${gold > 1 ? 's' : ''}` : 'Aucune pièce'}</div>`)}
        ${section('items', 'bag', 'Objets', `<ul class="battle-result-loot">${lootLines}</ul>`)}
    `;

    screen.classList.add('active');
}

// Boucles pixel art plein écran derrière le mot (tools/gen-combat-end.py, planches `combatend_<issue>-seq`) : un feu d'artifice pour la
// victoire, un cœur qui ne bat presque plus pour la défaite. Sans la planche (hors ligne, pas encore chargée), le mot reste sur fond noir.
const COMBAT_END_SEQUENCES = { victory: 'combatend_victory', defeat: 'combatend_defeat' };
export function preloadCombatEndSequences(){
    Object.values(COMBAT_END_SEQUENCES).forEach(id => loadSequence(id).catch(() => null));
}
function playCombatEndLoop(fade, isVictory, reduced){
    loadSequence(COMBAT_END_SEQUENCES[isVictory ? 'victory' : 'defeat']).then(seq => {
        if(!seq || !fade.isConnected) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'combat-end-loop';
        canvas.width = seq.size[0];
        canvas.height = seq.size[1];
        fade.prepend(canvas);
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        ctx.imageSmoothingEnabled = false;
        const start = performance.now();
        const draw = () => {
            const [sx, sy, sw, sh] = sequenceRect(seq, reduced ? 0 : ((performance.now() - start) / 1000 * seq.fps) % seq.frames);
            ctx.drawImage(seq.img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            if(!reduced && fade.isConnected) requestAnimationFrame(draw);
        };
        draw();
    }).catch(() => {});
}

// Fin de combat : écran noir avec le mot « Victoire » / « Défaite » (la musique de l'issue démarre avec lui), qui s'efface ensuite
// sur l'écran de résultat. Rappelle `reveal` quand l'écran est plein : c'est là que le résultat se met en place, sous le mot.
export const COMBAT_END_BANNER_MS = 2600;
function playCombatEndBanner(isVictory, reveal){
    document.getElementById('combat-end-fade')?.remove();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const total = reduced ? 400 : COMBAT_END_BANNER_MS;
    const fade = document.createElement('div');
    fade.id = 'combat-end-fade';
    fade.className = `combat-end-fade ${isVictory ? 'victory' : 'defeat'}`;
    fade.textContent = isVictory ? 'VICTOIRE' : 'DÉFAITE';
    fade.style.pointerEvents = 'none';
    fade.style.animationDuration = `${total}ms`;
    document.body.appendChild(fade);
    playCombatEndLoop(fade, isVictory, reduced);
    setTimeout(reveal, total * 0.7);
    setTimeout(() => fade.remove(), total);
}

// Points d'accroche de la phase d'exploration : onVictory est appelé dès la victoire (avant la
// sauvegarde), onEnd quand l'écran de résultat s'affiche (victoire, défaite ou abandon).
export const combatHooks = { onVictory: null, onEnd: null };
// Menu des compagnons (branché par main.js sur l'exploration) : { getChoices(): { companions, activeId }, setActive(id) }.
export const companionMenuHooks = { getChoices: null, setActive: null };

function finalizeCombatEndUI(isVictory){
    introToken++;
    dismissCombatIntro();
    // Ordre : 1. le mot Victoire / Défaite plein écran (et la musique de l'issue, qui boucle jusqu'au retour à l'exploration),
    // 2. l'écran de résultat, 3. le bouton « Retour à l'exploration » (apparition retardée, style.css body.combat-ended).
    document.body.dataset.combatEnd = isVictory ? 'victory' : 'defeat';
    playCombatEndBanner(isVictory, () => {
        if(gameState.combatState !== 'finished') return;   // un nouveau combat a démarré entre-temps
        revealCombatEndUI(isVictory);
    });
}

function revealCombatEndUI(isVictory){
    showCombatResultScreen(isVictory);
    // Fin de partie : « Retour à l'exploration » est la seule action possible (voir style.css, body.combat-ended).
    document.body.classList.add('combat-ended');

    const statsContainer = document.querySelector('.stats-container');
    if(statsContainer) {
        statsContainer.style.display = 'none';
    }

    const boardEl = document.getElementById('board');
    if(boardEl) {
        boardEl.style.display = 'none';
    }

    const spellsContainer = document.getElementById('spells-container');
    if(spellsContainer) {
        spellsContainer.style.display = 'none';
    }

    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'none';
    }

    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'block';
    }

    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'flex';
    }

    if(isVictory) {
        log(`Cliquez sur "Retour à l'exploration" pour continuer.`);
    } else {
        log("Cliquez sur \"Retour à l'exploration\" : vous reprenez vos esprits à l'entrée de la zone.");
    }
    combatHooks.onEnd?.(isVictory);
}

// Barre de PV d'un combattant : animée par un compteur (_animateHpBar), donc « vide » seulement une fois ce compteur terminé.
function isFighterHpBarEmpty(isPlayer){
    const prefix = isPlayer ? 'player' : 'enemy';
    const bar = document.querySelector(`#${prefix}-stats .hp-bar-container progress`);
    return isHpBarEmpty({
        shownValue: bar ? Number(bar.value) : null,
        animating: Boolean(_activeCounters[`${prefix}-hp-current`])
    });
}

// Attend que la barre de PV du vaincu (l'adversaire en cas de victoire, le joueur en cas de défaite) soit réellement
// arrivée à zéro à l'écran (transition terminée, filet de sécurité de 6 s), puis une courte pause avant l'écran de fin.
// Un abandon (PV > 0) n'attend rien.
function whenLoserHpBarEmpty(isVictory, callback){
    const loser = isVictory ? enemy : player;
    if(!(loser?.hp <= 0)){ callback(); return; }
    updateStats();
    waitUntil(() => isFighterHpBarEmpty(!isVictory), () => setTimeout(callback, HP_BAR_EMPTY_PAUSE_MS * animationFactor()));
}

export function showEndCombatAnimation(isVictory){
    whenLoserHpBarEmpty(isVictory, () => {
        if(gameState.combatState !== 'finished') return;   // un nouveau combat a démarré entre-temps
        // Victoire comme défaite : le mot plein écran, puis l'écran de résultat, sans second écran « Cliquez pour continuer ».
        finalizeCombatEndUI(isVictory);
    });
}

// règles de combat
export const combatCost = 5;             // points nécessaires pour une attaque normale
export const skullDamage = 1;           // dégâts infligés par soleil lors d'un match

// ennemi courant (combatPoints pour attaquer)
export let enemy = { name:"Ennemi", hp:50, maxHp:50, attack:10, resistances:{}, combatPoints:0, mana: { red:0, blue:0, green:0, yellow:0, purple:0 }, spells:[], weapon: null, abilities: [], statusEffects: {}, bonusTurn: 0, inventoryItem: null };

// si le joueur meurt, on restaure ses PV et réinitialise le combat ; `keepHp` : phase enchaînée d'un duel, les PV restent ceux du combat précédent
export function restartCombat({ keepHp = false } = {}){
    actionGuard.reset();
    introToken++;
    turnFlags.foxActed = false;
    turnFlags.companionsActed = false;
    turnFlags.pendingOutcome = null;
    turnFlags.foxPlaying = false;
    dismissCombatIntro();
    if(pendingPlayerDeathTimeout) {
        clearTimeout(pendingPlayerDeathTimeout);
        pendingPlayerDeathTimeout = null;
    }

    player.hp = keepHp ? Math.max(1, Math.min(player.hp, player.maxHp)) : player.maxHp;
    player.combatPoints = 0;
    player.bonusTurn = 0;
    resetRage(player);
    addRage(player, startingRage(player));
    resetUltimateMana(player);
    enemy.hp = enemy.maxHp;
    enemy.combatPoints = 0;
    enemy.bonusTurn = 0;
    // Réinitialiser le qì à 0
    player.mana = { ...EMPTY_MANA_POOL };
    enemy.mana = { ...EMPTY_MANA_POOL };
    // Réinitialiser les bonus temporaires
    if(player.tempAttack) {
        player.attack -= player.tempAttack;
        player.tempAttack = 0;
    }
    if(player.tempDefense) {
        player.defense -= player.tempDefense;
        player.tempDefense = 0;
    }
    const wornShield = player.equipment?.leftHand;
    player.shieldAbsorbLeft = wornShield?.type === 'shield' ? (wornShield.absorbDamage || 0) : 0;
    player.hasRevive = false;
    player.revivePercent = 0;
    player.itemBuffs = {};
    player.regenEffect = null;
    player.lifesteal = 0;
    player.manaMultiplier = null;
    player.damageReduction = 0;
    player.tempCritChance = 0;
    clearStatBuffs(player);
    clearStatBuffs(enemy);
    if(player.statusEffects){ delete player.statusEffects.poisoned; delete player.statusEffects.poisonDamage; }   // le poison ne survit pas au combat
    // Réinitialiser le statut du jeu
    setGameStarted(false);
    // Appliquer les aptitudes de début de combat
    applyStartingAbilities();
    
    log(keepHp ? `Le duel se poursuit sans répit : vous gardez vos ${player.hp}/${player.maxHp} PV.` : "Combat réinitialisé, vous êtes en pleine santé.");
    updateStats();
    saveUpdate();
}

// Gérer la mort du joueur
export function handlePlayerDeath(){
    if(gameState.combatState === 'finished') {
        return;
    }

    // Vérifier si le joueur a un effet de résurrection
    if(player.hasRevive && player.revivePercent > 0) {
        const reviveHp = Math.floor(player.maxHp * player.revivePercent);
        player.hp = reviveHp;
        player.hasRevive = false;
        player.revivePercent = 0;
        log(`Vous êtes ressuscité avec ${reviveHp} HP !`);
        updateStats();
        saveUpdate();
        return;
    }
    
    const xpResult = applyCombatXPAtEnd();
    if(xpResult.xpApplied > 0) {
        log(`${xpResult.xpApplied} XP appliquee(s) a la fin du combat.`);
        if(xpResult.leveledUp) {
            log(`Niveau ${player.level} atteint en fin de combat.`);
            if(xpResult.maxHpGained > 0) {
                log(`+${xpResult.maxHpGained} HP max, +${xpResult.hpRecovered} HP recuperes.`);
            }
            if(xpResult.levelsGained > 1) {
                log(`Vous avez gagne ${xpResult.levelsGained} niveaux d'un coup !`);
            }
            updateAvailableSpells();
            updateAvailableWeapons();
            updateInventoryTab();
            showAttributeMenu();
        }
    }
    log("Vous êtes mort ! Le combat est terminé.");
    if(enemy?.isBoss) player.bossLossStreak = recordBossLoss(player.bossLossStreak, enemy.mapEnemyId || enemy.name);
    playSfx('defeat');
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    updateStats();
    saveUpdate();

    // Laisse le coup fatal visible avant l'écran de défaite.
    pendingPlayerDeathTimeout = setTimeout(() => {
        pendingPlayerDeathTimeout = null;
        showEndCombatAnimation(false);
    }, PLAYER_DEATH_DELAY_MS);
}

// démarre un nouveau combat
export function startNewCombat(selectedEnemy = null){
    playSfx('uiClick');
    document.body.classList.remove('combat-ended');
    delete document.body.dataset.combatEnd;
    preloadCombatEndSequences();   // les boucles de fin de combat sont prêtes avant la fin du combat
    gameState.combatState = 'active';
    setBoardSize((selectedEnemy?.isBoss && !selectedEnemy.isTutorialEnemy) ? BOSS_BOARD_SIZE : BASE_BOARD_SIZE);   // plateau 10×10 contre un boss, 8×8 sinon (et pour le duel-tutoriel, dont le plateau figé est en 8×8)
    window.dispatchEvent(new CustomEvent('match3:combat-start', { detail: { boss: Boolean(selectedEnemy?.isBoss) } }));   // le jingle de boss a déjà joué avec l'annonce du combat
    ensureCombatUsableActiveItem();
    resetCombatRewards();
    hideCombatResultScreen();
    // Cacher le bouton "Nouveau Combat"
    const newCombatBtn = document.getElementById('new-combat-btn');
    if(newCombatBtn) {
        newCombatBtn.style.display = 'none';
    }
    // Afficher le bouton "Abandonner"
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) {
        abandonBtn.style.display = 'inline-block';
    }
    // Cacher les onglets pendant le combat
    const tabs = document.querySelector('.tabs');
    if(tabs) {
        tabs.style.display = 'none';
    }
    // Restaurer les PV (sauf phase enchaînée d'un duel) et préparer le combat
    restartCombat({ keepHp: Boolean(selectedEnemy?.carryHp) });
    newEnemy(selectedEnemy);
    if(!enemy?.isBoss) playSfx('combatStart');   // boss : bossStart a déjà joué pendant l'annonce du combat (explorationView.js)
}

// Abandonner le combat en cours
export function abandonCombat(){
    if(gameState.combatState !== 'active') {
        return;
    }
    
    const xpResult = applyCombatXPAtEnd();
    if(xpResult.xpApplied > 0) {
        log(`${xpResult.xpApplied} XP appliquee(s) a la fin du combat.`);
        if(xpResult.leveledUp) {
            log(`Niveau ${player.level} atteint en fin de combat.`);
            if(xpResult.maxHpGained > 0) {
                log(`+${xpResult.maxHpGained} HP max, +${xpResult.hpRecovered} HP recuperes.`);
            }
            if(xpResult.levelsGained > 1) {
                log(`Vous avez gagne ${xpResult.levelsGained} niveaux d'un coup !`);
            }
            updateAvailableSpells();
            updateAvailableWeapons();
            updateInventoryTab();
            showAttributeMenu();
        }
    }
    saveUpdate();

    log("Vous avez abandonné le combat...");
    playSfx('defeat');
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';
    showEndCombatAnimation(false);
}


// bibliothèque des aptitudes
export const allAbilities = [
    {id:"fireAffinity", name:"Affinité de Feu", description:"Commence le combat avec 10 qì rouge", startMana:{red:10}},
    {id:"iceAffinity", name:"Affinité de Glace", description:"Commence le combat avec 10 qì bleu", startMana:{blue:10}},
    {id:"natureAffinity", name:"Affinité de Nature", description:"Commence le combat avec 10 qì vert", startMana:{green:10}},
    {id:"stormAffinity", name:"Affinité de Foudre", description:"Commence le combat avec 10 qì jaune", startMana:{yellow:10}},
    {id:"shadowAffinity", name:"Affinité d'Ombre", description:"Commence le combat avec 10 qì violet", startMana:{purple:10}},
    {id:"elementalist", name:"Maître des Cinq Éléments", description:"Commence le combat avec 5 qì de chaque couleur", startMana:{red:5, blue:5, green:5, yellow:5, purple:5}},
    {id:"fireMastery", name:"Maîtrise du Feu", description:"+2 qì rouge par match (5 au lieu de 3)"},
    {id:"iceMastery", name:"Maîtrise de la Glace", description:"+2 qì bleu par match (5 au lieu de 3)"},
    {id:"natureMastery", name:"Maîtrise de la Nature", description:"+2 qì vert par match (5 au lieu de 3)"},
    {id:"stormMastery", name:"Maîtrise de la Foudre", description:"+2 qì jaune par match (5 au lieu de 3)"},
    {id:"shadowMastery", name:"Maîtrise de l'Ombre", description:"+2 qì violet par match (5 au lieu de 3)"}
];

// bibliothèque des sorts (source: spells.json via spells.js)
export const allSpells = spellsCatalog;

// Fonction de chargement de la sauvegarde
export function loadGameData() {
    const savedPlayer = localStorage.getItem('player');
    if (savedPlayer) {
        try {
            const loaded = JSON.parse(savedPlayer);
            // Fusionner les données sauvegardées avec les valeurs par défaut
            player.name = loaded.name ?? player.name;
            player.hp = loaded.hp ?? player.hp;
            player.maxHp = loaded.maxHp ?? player.maxHp;
            player.mana = { ...player.mana, ...(loaded.mana || {}) };
            player.maxMana = loaded.maxMana ?? player.maxMana;
            player.attack = loaded.attack ?? player.attack;
            player.level = loaded.level ?? player.level;
            player.xp = loaded.xp ?? player.xp;
            player.xpToNextLevel = loaded.xpToNextLevel ?? player.xpToNextLevel;
            player.attributes = { ...player.attributes, ...(loaded.attributes || {}) };
            player.spells = loaded.spells ?? player.spells;
            player.activeSpells = loaded.activeSpells ?? player.activeSpells;
            player.equippedUltimate = loaded.equippedUltimate ?? player.equippedUltimate;
            player.unlockedUltimates = normalizeUnlockedUltimates(loaded.unlockedUltimates);
            // Ancienne Sphère de Flammes du sorcier : elle partageait l'id « fireball » avec le Souffle du Dragon de Feu.
            (player.activeSpells || []).forEach(sp => { if(sp?.id === 'fireball' && sp.class === 'sorcerer') sp.id = 'flameSphere'; });
            player.availableSpells = loaded.availableSpells ?? player.availableSpells;
            // Armes : toujours les fiches du catalogue actuel (les anciens ids de sabres, haches… sont convertis en arcs ; les inconnues sont retirées).
            const catalogWeapon = w => (w?.id ? getWeaponById(w.id) : null);
            player.weapons = (loaded.weapons ?? []).map(catalogWeapon).filter((w, i, arr) => w && arr.findIndex(x => x?.id === w.id) === i);
            player.equippedWeapon = catalogWeapon(loaded.equippedWeapon);
            player.availableWeapons = loaded.availableWeapons ?? player.availableWeapons;
            player.combatPoints = loaded.combatPoints ?? player.combatPoints;
            player.bonusTurn = normalizeBonusTurnValue(loaded.bonusTurn ?? player.bonusTurn);
            player.abilities = loaded.abilities ?? player.abilities;
            player.class = loaded.class ?? player.class;
            player.statusEffects = loaded.statusEffects ?? player.statusEffects;
            player.defense = loaded.defense ?? player.defense;
            player.inventory = loaded.inventory ?? player.inventory;
            player.equipment = { rightHand: null, leftHand: null, item: null, ...(loaded.equipment || {}) };
            player.equipment.rightHand = player.equippedWeapon;
            player.stuffOwned = loaded.stuffOwned ?? [];
            player.stuff = loaded.stuff ?? player.stuff;
            normalizeStuff(player);
            if(player.equipment.leftHand && player.equipment.leftHand.type !== 'shield') player.equipment.leftHand = catalogWeapon(player.equipment.leftHand);
            player.activeInventoryIndex = loaded.activeInventoryIndex ?? player.activeInventoryIndex;
            player.tempAttack = loaded.tempAttack ?? player.tempAttack;
            player.tempDefense = loaded.tempDefense ?? player.tempDefense;
            player.hasRevive = loaded.hasRevive ?? player.hasRevive;
            player.revivePercent = loaded.revivePercent ?? player.revivePercent;
            player.unspentLevelPoints = loaded.unspentLevelPoints ?? player.unspentLevelPoints;
            player.gold = loaded.gold ?? player.gold;
            normalizeXP(player);   // recale l'XP sur la courbe actuelle sans changer le niveau
            player.growthLevel = Number.isInteger(loaded.growthLevel) ? loaded.growthLevel : undefined;
            applyGrowth(player);   // rattrapage unique de la croissance innée (niveaux > 18)
            player.mount = loaded.mount === 'horse' ? 'horse' : null;
            player.torch = loaded.torch === true;
            player.merchantSold = loaded.merchantSold && typeof loaded.merchantSold === 'object' ? loaded.merchantSold : {};
            player.sellTags = Array.isArray(loaded.sellTags) ? loaded.sellTags.filter(t => typeof t === 'string') : [];
            player.bossLossStreak = loaded.bossLossStreak && loaded.bossLossStreak.id ? loaded.bossLossStreak : null;
            player.defeatedBossTiers = Array.isArray(loaded.defeatedBossTiers)
                ? loaded.defeatedBossTiers
                    .map(tier => Math.max(5, Math.floor(Number(tier) || 0)))
                    .filter((tier, idx, arr) => tier > 0 && arr.indexOf(tier) === idx)
                    .sort((a, b) => a - b)
                : [];
            player.pendingBoss = loaded.pendingBoss && loaded.pendingBoss.enemy
                ? loaded.pendingBoss
                : null;
            player.worldMap = {
                currentZoneId: loaded.worldMap?.currentZoneId ?? null,
                visitedZoneIds: Array.isArray(loaded.worldMap?.visitedZoneIds) ? loaded.worldMap.visitedZoneIds : []
            };
            player.exploration = loaded.exploration && typeof loaded.exploration === 'object'
                ? loaded.exploration
                : null;
            clampManaToCaps(player);
            console.log('Données du joueur chargées depuis le localStorage');
            if (player.class) {
                console.log(`Classe chargée: ${player.class}`);
            }
        } catch (e) {
            console.error('Erreur lors du chargement de la sauvegarde:', e);
        }
    }
    // Initialiser l'XP si nécessaire (pour les sauvegardes anciennes)
    initializeXP(player);
}

export function normalizeActiveInventoryIndex() {
    if(!Array.isArray(player.inventory) || player.inventory.length === 0) {
        player.activeInventoryIndex = null;
        return;
    }

    if(!Number.isInteger(player.activeInventoryIndex) || player.activeInventoryIndex < 0 || player.activeInventoryIndex >= player.inventory.length) {
        player.activeInventoryIndex = 0;
    }
    if(player.inventory[player.activeInventoryIndex]?.type === 'shield') {
        const usable = player.inventory.findIndex(item => item?.type !== 'shield');
        player.activeInventoryIndex = usable >= 0 ? usable : null;
    }
}

export function getActiveInventoryItem() {
    normalizeActiveInventoryIndex();
    if(player.activeInventoryIndex === null) return null;
    return player.inventory[player.activeInventoryIndex] || null;
}

function ensureCombatUsableActiveItem() {
    normalizeActiveInventoryIndex();
    if(!Array.isArray(player.inventory) || player.inventory.length === 0) return;

    const activeItem = getActiveInventoryItem();
    if(activeItem?.type === 'reusable' && player.level >= (activeItem.minLevel || 1)) return;

    const consumableIndex = player.inventory.findIndex(item => (item?.type === 'consumable' || item?.type === 'reusable') && player.level >= (item.minLevel || 1));
    if(consumableIndex >= 0) {
        player.activeInventoryIndex = consumableIndex;
        const combatItem = player.inventory[consumableIndex];
        if(combatItem?.name) {
            log(`Objet actif pour le combat : ${combatItem.name}.`);
        }
    }
}

// Chargement de la sauvegarde au démarrage
loadGameData();
// Appliquer les effets des artefacts
applyArtifactEffects(player);
normalizeActiveInventoryIndex();
clampManaToCaps(player);

// interface minimale



// -------------------------------------
// Anti-bourrinage : arme / objet / sort refusés pendant la résolution du plateau, juste après une action plateau,
// ou dans le court délai qui suit une autre action du joueur (voir actionGuard.js).
export function isPlayerActionBlocked(){
    return currentTurn !== 'player' || turnFlags.foxPlaying || isBoardResolving() || actionGuard.blockReason() !== null;
}

// Dès que le joueur ne joue plus (tour adverse, écran de début de combat), TOUS ses boutons sont désactivés :
// armes, objets, sorts (colonne #player-spells rendue inerte : ni clic ni focus) et abandon ; l'actionGuard refuse aussi
// tout clic. Réactivés dès que le tour revient au joueur. Appelé à chaque updateStats().
export function syncPlayerControlsLock(){
    const locked = gameState.combatState === 'active' && (currentTurn !== 'player' || turnFlags.foxPlaying);
    actionGuard.setTurnLocked(locked);
    if(typeof document === 'undefined') return locked;
    const column = document.getElementById('player-spells');
    if(column){
        column.classList.toggle('turn-locked', locked);
        column.setAttribute('aria-disabled', String(locked));
        if(locked) column.setAttribute('inert', '');
        else column.removeAttribute('inert');
    }
    const abandonBtn = document.getElementById('abandon-combat-btn');
    if(abandonBtn) abandonBtn.disabled = locked;
    return locked;
}

// Renvoie true (et ignore silencieusement le clic) si l'action doit être refusée.
export function rejectRushedAction(){
    if(!isPlayerActionBlocked()) return false;
    return true;
}

// -------------------------------------
// Combat avec arme
export function useWeapon(hand = 'right'){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Seul le joueur actif peut utiliser une attaque."); return; }
    if(rejectRushedAction()) return;
    const weapon = hand === 'left' ? getLeftHandWeapon() : player.equippedWeapon;
    if(!weapon){ log("Aucune arme équipée !"); return; }
    if(player.combatPoints < weapon.actionPoints){ 
        log(`Il faut ${weapon.actionPoints} points d'action pour utiliser ${weapon.name}.`); 
        return; 
    }
    if(player.hp<=0){ handlePlayerDeath(); return; }
    if(player.level < weapon.minLevel){ 
        log(`Nécessite niveau ${weapon.minLevel} pour utiliser ${weapon.name}`); 
        return; 
    }
    
    actionGuard.markPlayerAction();
    player.combatPoints -= weapon.actionPoints;
    logActiveAction(`utilise l'arme ${weapon.name} (cout ${weapon.actionPoints} PA)`);
    strikeWithWeapon(weapon);
    finishPlayerTurn();
}

// Coup d'arme du joueur sur l'ennemi (dégâts, critique, vol de vie, animation) ; ne consomme ni PA ni tour.
function strikeWithWeapon(weapon, { free = false } = {}){
    let dmg = weapon.damage;
    const biomeBonus = weaponBiomeBonus(weapon, enemy.biome);
    if(biomeBonus > 0) {
        dmg += biomeBonus;
        log(`${weapon.name} est dans son biome (${BIOME_LABELS[weapon.biome]}) : +${biomeBonus} dégâts.`);
    }

    if((player.statusEffects?.flameblade || 0) > 0) {
        const flameBonus = Math.max(0, Math.floor(player.statusEffects.flameblade));
        dmg += flameBonus;
        delete player.statusEffects.flameblade;
        log(`Lame de Feu Pourpre ajoute ${flameBonus} dégâts au coup d'arme.`);
    }

    // Attaque = chance de critique, défense de l'ennemi = chance de blocage (voir combatStats.js)
    const strike = resolveStrike(dmg, player, enemy);
    const isCrit = strike.crit;
    const blockText = blockLabel(strike.block);
    dmg = strike.damage;

    applyDamage(enemy, dmg);
    playSfx('weaponHit', { isPlayer: true, rarity: weapon.rarity });

    // Vol de vie
    if(player.lifesteal > 0) {
        const heal = Math.floor(dmg * player.lifesteal);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        flyHeal(true, heal);
        log(`Vol de vie : +${heal} HP.`);
    }

    const icon = getWeaponIcon(weapon.type);

    const critSuffix = `${isCrit ? ' CRITIQUE !' : ''}${blockText ? ` ${blockText}` : ''}`;
    showCombatAnimation({ icon, title: weapon.name, damage: `-${dmg} dégâts${critSuffix}`, target: `→ ${enemy.name}` }, true);
    log(`${icon} Vous utilisez ${weapon.name}${free ? ' gratuitement' : ''} et infligez ${dmg} dégâts.${isCrit ? ' Coup critique !' : ''}${blockText ? ` L'ennemi ${blockText === 'BLOQUÉ !' ? 'bloque le coup' : 'pare le coup'}.` : ''}`);
}


export function castSpell(spellId){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Seul le joueur actif peut lancer un sort."); return; }
    if(rejectRushedAction()) return;
    // Blocage tutoriel : interdire les sorts avant l'étape 4
    if(isTutorialActive() && getTutorialStep() < 4){
        log("Générez d'abord du qì avec des alignements de gâteaux de lune colorés !");
        return;
    }
    const spell=player.activeSpells.find(s=>s.id===spellId);
    if(!spell){ log("Sort indisponible !"); return; }
    if(tutorialCallbacks.allowSpell && !tutorialCallbacks.allowSpell(spell)) return;
    if(player.level<spell.minLevel){ log(`Nécessite niveau ${spell.minLevel}`); return; }
    
    if(!canEntityCastSpell(player, spell)){
        const missingColor = getMissingManaColor(player, spell);
        log(missingColor ? `Pas assez de qì ${missingColor} !` : "Pas assez de qì !");
        return;
    }
    actionGuard.markPlayerAction();
    consumeSpellMana(player, spell);
    playSfx('spellCast', { isPlayer: true, spellId: spell.id });
    
    // Gérer les sorts avec effet spécial
    if(spell.effect) {
        logActiveAction(`lance le sort ${spell.name} (effet special)`);
        // Import dynamique pour éviter les dépendances circulaires
        import('./classSpellEffects.js').then(async module => {
            const boardBefore = module.snapshotBoard();
            if(await module.applyClassSpellEffect(spell)) {
                saveUpdate();
                tutorialCallbacks.onSpellCast?.();
                // Plateau modifié : on attend la régénération, les combos qui suivent profitent au lanceur.
                module.endPlayerSpellTurn(boardBefore);
            } else {
                saveUpdate();
            }
        });
        return;
    }
    
    // Sorts standards (dégâts ou soins)
    logActiveAction(`lance le sort ${spell.name}`);
    applyStandardSpellEffects(player, enemy, spell, true);
    
    updateStats();
    saveUpdate();

    // Notifier le tutoriel qu'un sort a été lancé
    tutorialCallbacks.onSpellCast?.();

    finishPlayerTurn();
}

// Lance un ultime : jauge de rage pleine + qì requis ; la jauge retombe à 0. La cinématique plein écran éventuelle
// (voir `playUltimateCinematic`) se joue avant l'effet.
export async function castUltimate(spellId){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Seul le joueur actif peut lancer un sort."); return; }
    if(rejectRushedAction()) return;
    const spell = getUltimateById(spellId);
    if(!spell || getEquippedUltimate(player)?.id !== spell.id){ log("Ultime indisponible !"); return; }
    if(player.level < spell.minLevel && player.cheatAllUltimates !== true){ log(`Nécessite niveau ${spell.minLevel}`); return; }
    if(!isRageFull(player)){ log("La jauge de rage n'est pas pleine !"); return; }
    if(player.cheatFreeSpells !== true && !canCastUltimateMana(player, spell)){
        const missing = ultimateCostEntries(spell).find(([color, need]) => collectedUltimateMana(player, color) < need);
        log(missing ? `Pas assez de qì ${missing[0]} collecté !` : "Pas assez de qì !");
        return;
    }
    actionGuard.markPlayerAction();
    if(player.cheatFreeSpells !== true) spendUltimateMana(player, spell);
    resetRage(player);
    playSfx('spellCast', { isPlayer: true, spellId: spell.id });
    logActiveAction(`lance l'ultime ${spell.name}`);
    updateStats();
    await playUltimateCinematic(spell);
    const module = await import('./classSpellEffects.js');
    const boardBefore = module.snapshotBoard();
    if(await module.applyClassSpellEffect(spell)) {
        saveUpdate();
        module.endPlayerSpellTurn(boardBefore);
    } else {
        saveUpdate();
    }
}

// API de test: permet de simuler n'importe quel sort sans contraintes de niveau/mana.
export async function castSpellForCheat(spellId, options = {}){
    const consumeTurn = options.consumeTurn === true;
    if(gameState.combatState !== 'active'){
        log("Cheat: aucun combat en cours.");
        return false;
    }

    let spell = player.activeSpells.find(s => s.id === spellId)
        || player.availableSpells.find(s => s.id === spellId)
        || spellsCatalog.find(s => s.id === spellId);

    if(!spell){
        try {
            const classesModule = await import('./classes.js');
            spell = classesModule.allClassSpells.find(s => s.id === spellId) || getUltimateById(spellId);
        } catch {
            spell = null;
        }
    }

    if(!spell){
        log("Cheat: sort introuvable.");
        return false;
    }

    playSfx('spellCast', { isPlayer: true, spellId: spell.id });
    logActiveAction(`simule le sort ${spell.name} (cheat)`);

    if(spell.effect){
        try {
            const module = await import('./classSpellEffects.js');
            const boardBefore = module.snapshotBoard();
            const applied = await module.applyClassSpellEffect(spell);
            if(!applied){
                saveUpdate();
                return false;
            }
            saveUpdate();
            if(consumeTurn){
                module.endPlayerSpellTurn(boardBefore);
            } else {
                updateStats();
            }
            return true;
        } catch {
            log("Cheat: impossible d'appliquer ce sort de classe.");
            return false;
        }
    }

    applyStandardSpellEffects(player, enemy, spell, true);
    updateStats();
    saveUpdate();
    if(consumeTurn){
        finishPlayerTurn();
    }
    return true;
}

export function forcePlayerTurnForCheat(){
    if(currentTurn !== 'player') {
        currentTurn = 'player';
        updateStats();
        saveUpdate();
    }
}


// Menu secret : tant qu'actif, tout dégât infligé à l'ennemi le tue d'un coup.
let cheatOneShot = false;
export function setCheatOneShot(on){ cheatOneShot = !!on; }
export function isCheatOneShot(){ return cheatOneShot; }
// -------------------------------------
// Applique les aptitudes de début de combat pour le joueur et l'ennemi
export function applyStartingAbilities(){
    // Réinitialiser le qì à 0
    player.mana = { ...EMPTY_MANA_POOL };
    enemy.mana = { ...EMPTY_MANA_POOL };

    // Bonus de départ liés aux aptitudes (une couleur par aptitude).
    Object.keys(player.mana).forEach(color => {
        const initialBonus = getAttributeManaBonus(player, color, "initial");
        if(initialBonus > 0) {
            addManaForColor(player, color, initialBonus, { applyGainBonus: false });
        }
    });

    Object.keys(enemy.mana).forEach(color => {
        const initialBonus = getAttributeManaBonus(enemy, color, "initial");
        if(initialBonus > 0) {
            addManaForColor(enemy, color, initialBonus, { applyGainBonus: false });
        }
    });
    
    // Appliquer les aptitudes du joueur
    if(player.abilities && player.abilities.length > 0){
        player.abilities.forEach(abilityId => {
            const ability = allAbilities.find(a => a.id === abilityId);
            if(ability && ability.startMana){
                Object.keys(ability.startMana).forEach(color => {
                    addManaForColor(player, color, ability.startMana[color], { applyGainBonus: false });
                });
                log(`Aptitude: ${ability.name} activée`);
            }
        });
    }
    
    // Appliquer les aptitudes de l'ennemi
    if(enemy.abilities && enemy.abilities.length > 0){
        enemy.abilities.forEach(abilityId => {
            const ability = allAbilities.find(a => a.id === abilityId);
            if(ability && ability.startMana){
                Object.keys(ability.startMana).forEach(color => {
                    addManaForColor(enemy, color, ability.startMana[color], { applyGainBonus: false });
                });
            }
        });
    }

    clampManaToCaps(player);

    // Appliquer les points d'action de départ (ex: Bottes de Célérité)
    if(player.startActionPoints > 0) {
        player.combatPoints = (player.combatPoints || 0) + player.startActionPoints;
        log(`Sandales du Vent Léger : +${player.startActionPoints} point(s) d'action au début du combat.`);
    }
}

// ennemis
// Scène musicale du combat en cours (musique générée par music.js) : 'boss' contre un boss, sinon 'combat' ; null hors combat.
export function getCombatMusicScene() {
    if(gameState.combatState !== 'active') return null;
    return enemy?.isBoss ? 'boss' : 'combat';
}

// Options de la scène musicale : thème propre à chaque boss (son nom), style de rythme variable selon l'ennemi ordinaire.
let combatBiomeId = null;   // biome du combat en cours (musique propre aux Hautes-Eaux)
export function getCombatMusicOptions() {
    if(!enemy) return {};
    return enemy.isBoss ? { boss: enemy.name } : { variant: enemy.name, biome: combatBiomeId };
}

// Fond de la page de combat : teinte et motif du biome (CSS `body[data-combat-biome]` de retro.css).
export function setCombatBackdrop(biome){
    if(typeof document === 'undefined') return;
    combatBiomeId = biome || null;
    if(biome && BIOME_LABELS[biome]) document.body.dataset.combatBiome = biome;
    else delete document.body.dataset.combatBiome;
}

export function newEnemy(selectedEnemy = null){
    enemy = selectedEnemy ? { ...selectedEnemy } : generateRandomEnemy(player.level, spellsCatalog, allWeapons);
    // Copie propre des statuts (étourdi, affaibli, poison…) : les ennemis générés n'en ont pas, et les sorts écrivent dedans sans vérifier.
    enemy.statusEffects = { ...(enemy.statusEffects || {}) };
    // Mêmes limites que le joueur : au plus MAX_ACTIVE_SPELLS sorts et une arme par main (MAX_WEAPONS), quelle que soit l'origine de l'ennemi.
    enemy.spells = (Array.isArray(enemy.spells) ? enemy.spells : []).slice(0, MAX_ACTIVE_SPELLS);
    if(Array.isArray(enemy.weapon)) enemy.weapon = enemy.weapon.slice(0, MAX_WEAPONS)[0] || null;

    // Avantage caché du plus haut niveau : bonus d'attaque et de défense (critiques et blocages), voir combatStats.js
    enemy.levelEdge = Math.max(0, (enemy.level || 0) - (player.level || 0));
    player.levelEdge = Math.max(0, (player.level || 0) - (enemy.level || 0));

    // Ajuster automatiquement la difficulté de l'IA selon le niveau et le profil de l'ennemi
    setAIDifficultyByLevel(enemy.level, player.level, enemy);
    
    // Afficher le niveau de l'ennemi dans les logs
    if (enemy.level > player.level) {
        log(`${enemy.name} (Niveau ${enemy.level}) apparaît ! Il est plus fort que vous !`);
    } else {
        log(`${enemy.name} (Niveau ${enemy.level}) apparaît !`);
    }
    // Réinitialiser le qì de l'ennemi à 0 puis appliquer ses aptitudes
    enemy.mana = { red:0, blue:0, green:0, yellow:0, purple:0 };
    applyStartingAbilities();
    log(`Un nouvel ennemi: ${enemy.name}`);
    if(enemy.weapon){
        log(`L'ennemi est équipé de : ${enemy.weapon.name}`);
    } else {
        log(`L'ennemi n'a pas d'arme (utilise uniquement la magie)`);
    }
    if(enemy.inventoryItem){
        log(`${enemy.name} porte : ${enemy.inventoryItem.name}`);
    }
    applyDuelRulesAtCombatStart();
    const biomeKey = ruleForBiome(enemy.biome);
    setBiomeRule(biomeKey, protectsFromBiome(player, biomeKey));
    setCombatBackdrop(enemy.biome);
    applyTerrainPrep();
    if(enemy.spells.length > 0){
        log(`L'ennemi dispose de sorts : ${enemy.spells.map(s => s.name).join(", ")}`);
    }
    updateEnemySpells();
    // déterminer au hasard qui commence
    decideFirstTurn();
}

// Préparation du terrain (terrain.js) : bonus d'embuscade, ennemi altéré, faiblesse repérée, plateau de départ.
function applyTerrainPrep(){
    const prep = enemy?.prep;
    if(!prep) return;
    if(prep.playerBonusPA) player.combatPoints += prep.playerBonusPA;
    if(prep.enemyBonusPA) enemy.combatPoints += prep.enemyBonusPA;
    if(prep.enemyStatus){
        if(!enemy.statusEffects) enemy.statusEffects = {};
        Object.assign(enemy.statusEffects, prep.enemyStatus);
        if(prep.enemyStatus.poisoned) enemy.statusEffects.poisonDamage = Math.max(2, Math.ceil(enemy.maxHp / 20));
    }
    prep.lines.forEach(line => log(line));
    if(prep.boardBoost) pendingBoardBoost = { color: enemy.weakColor, count: prep.boardBoost.count };
}

// Tuiles de départ d'un belvédère : appliquées par main.js une fois le plateau généré.
let pendingBoardBoost = null;
export function consumeBoardBoost(){
    const boost = pendingBoardBoost;
    pendingBoardBoost = null;
    if(boost?.color) boostBoardColor(boost.color, boost.count);
}

// Écran de début de combat (« Vous commencez ! », « Préparation du terrain »…), fusionné avec l'annonce de l'avantage du
// terrain (embuscade, faiblesse repérée, piège, hautes herbes…) : un seul écran, plein cadre, sans bandeau séparé.
// Il reste au moins 2 s (combatFlow.MIN_ANNOUNCE_MS) puis un clic / toucher / touche n'importe où le ferme ; ni le joueur
// ni l'ennemi n'agit avant sa fin (currentTurn vaut 'intro', tous les boutons du joueur sont verrouillés).
let combatIntro = null;
function dismissCombatIntro(){
    combatIntro?.cancel();
    combatIntro = null;
    document.getElementById('combat-intro')?.remove();
}
function showCombatIntro({ anim, banner, lines = [], startLine }, done){
    dismissCombatIntro();
    if(typeof document === 'undefined' || !document.body){ done(); return; }
    const el = document.createElement('div');
    el.id = 'combat-intro';
    el.className = 'combat-intro';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Début du combat');
    el.tabIndex = 0;
    const head = banner
        ? { icon: banner.icon, title: banner.title }
        : { icon: anim.icon, title: anim.title };
    el.innerHTML = `<div class="combat-intro-card">` +
        `<div class="combat-intro-head"><span class="combat-intro-icon">${svgIcon(head.icon) || ''}</span>` +
        `<span class="combat-intro-title">${String(head.title).toUpperCase()}</span></div>` +
        (!banner && anim.source ? `<div class="combat-intro-source">${anim.source}</div>` : '') +
        lines.map(l => `<div class="prep-banner-line">${l}</div>`).join('') +
        `<div class="prep-banner-start">${startLine}</div>` +
        `<div class="combat-intro-hint" aria-hidden="true">Touchez pour continuer</div></div>`;
    document.body.appendChild(el);

    const ann = createAnnouncement({
        autoMs: announceDurationMs(lines.length, animationFactor()),
        onDone: () => {
            if(combatIntro === ann) combatIntro = null;
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 300);
            done();
        }
    });
    combatIntro = ann;
    const hintTimer = setTimeout(() => el.classList.add('skippable'), 2000);
    const trySkip = () => { if(ann.skip()) clearTimeout(hintTimer); };
    el.addEventListener('click', trySkip);
    el.addEventListener('keydown', event => {
        if(event.key === 'Enter' || event.key === ' ' || event.key === 'Escape'){ event.preventDefault(); trySkip(); }
    });
}

// détermine le premier tour selon l'agilité (plus d'agilité = joueur plus rapide)
export function decideFirstTurn(){
    const prep = enemy?.prep;
    const banner = prepBanner(prep, enemy?.name);
    const strikes = openingStrikeCount(prep);   // seule l'embuscade offre un coup d'ouverture (plus la faiblesse repérée)
    let starter, anim, extraLine = null;
    if(prep?.playerFirst || prep?.enemyFirst){
        starter = prep.playerFirst ? 'player' : 'enemy';
        anim = { icon: 'bolt', title: 'Préparation du terrain', source: '', target: starter === 'player' ? '→ À vous de jouer !' : '→ Ennemi joue en premier' };
        log(`Premier tour : ${starter === 'player' ? 'Joueur' : 'Ennemi'} (préparation du terrain)`);
    } else {
        const playerAgility = agilityScore(player);
        const enemyAgility = enemy.attributes?.agility || 0;
        if(playerAgility > enemyAgility){
            starter = 'player';
            log(`Vous êtes plus agile ! Vous commencez en premier.`);
            anim = { icon: 'bolt', title: 'Vous commencez !', source: `Agilité : ${playerAgility} > ${enemyAgility}`, target: '→ À vous de jouer !' };
            extraLine = 'Plus agile : vous commencez.';
        } else if(enemyAgility > playerAgility){
            starter = 'enemy';
            log(`${enemy.name} est plus agile ! Il commence en premier.`);
            anim = { icon: 'bolt', title: `${enemy.name} commence !`, source: `Agilité : ${enemyAgility} > ${playerAgility}`, target: '→ Ennemi joue en premier' };
            extraLine = `${enemy.name} est plus agile : il commence.`;
        } else {
            // En cas d'égalité, le joueur commence
            starter = 'player';
            log(`Égalité d'agilité, vous commencez !`);
            anim = { icon: 'scales', title: 'Égalité !', source: `Agilité : ${playerAgility} = ${enemyAgility}`, target: '→ À vous de jouer !' };
            extraLine = "Égalité d'agilité : vous commencez.";
        }
        log(`Premier tour : ${starter === 'player' ? 'Joueur' : 'Ennemi'}`);
    }

    // Personne n'agit pendant l'écran de début : tour « intro », boutons du joueur verrouillés.
    currentTurn = 'intro';
    updateStats();
    const token = ++introToken;
    showCombatIntro({
        anim,
        banner,
        lines: banner ? (extraLine ? [...banner.lines, extraLine] : banner.lines) : [],
        startLine: anim.target
    }, () => {
        if(token !== introToken || gameState.combatState !== 'active') return;
        currentTurn = starter;
        updateStats();
        if(starter === 'enemy'){
            if(strikes) runOpeningStrikes(strikes, OPENING_LEAD_MS, () => enemyTurn());
            else setTimeout(() => enemyTurn(), OPENING_LEAD_MS);
        } else if(strikes){
            runOpeningStrikes(strikes, OPENING_LEAD_MS, () => {});
        }
    });
}
let introToken = 0;

// Coups gratuits et automatiques de l'arme courante au début du combat (le plateau reste bloqué le temps des animations).
// Seule l'embuscade en offre un : l'annonce a déjà eu lieu dans l'écran de début de combat.
const OPENING_LEAD_MS = 300;       // courte pause après la fin de l'écran de début
const OPENING_STRIKE_MS = 1300;    // durée de l'animation du coup avant l'enchaînement
function runOpeningStrikes(count, delayMs, done){
    const weapon = player.equippedWeapon;
    if(!weapon){ log("Aucune arme équipée : pas de coup d'ouverture."); setTimeout(done, delayMs); return; }
    const wasPlayerTurn = currentTurn === 'player';
    if(wasPlayerTurn){ currentTurn = 'enemy'; syncPlayerControlsLock(); }
    const step = i => {
        if(gameState.combatState !== 'active') return;
        if(i >= count){
            if(wasPlayerTurn) currentTurn = 'player';
            updateStats();
            done();
            return;
        }
        log('Embuscade : attaque par derrière !');
        strikeWithWeapon(weapon, { free: true });
        updateStats();
        setTimeout(() => step(i + 1), OPENING_STRIKE_MS * animationFactor());
    };
    setTimeout(() => step(0), delayMs);
}


// Exports pour les fonctions accessibles globalement
window.equipSpell = equipSpell;
window.unequipSpell = unequipSpell;
window.equipUltimate = equipUltimate;
window.equipWeapon = equipWeapon;
window.unequipWeapon = unequipWeapon;
window.equipGear = equipGear;
window.unequipGear = unequipGear;
window.useInventoryItem = useInventoryItem;
window.discardInventoryItem = discardInventoryItem;
window.toggleSellSurplus = toggleSellSurplus;
window.setActiveInventoryItem = setActiveInventoryItem;
