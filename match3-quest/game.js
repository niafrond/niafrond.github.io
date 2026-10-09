// logique globale du joueur, ennemis, combat et interface

import { colors, boardSize } from "./constants.js";
import { generateRandomEnemy } from "./enemies.js";
import { tutorialCallbacks, isTutorialActive, getTutorialStep } from "./tutorial.js";
import { allWeapons, getAvailableWeapons, getWeaponById, weaponBiomeBonus, BIOME_LABELS } from "./weapons.js";
import { weaknessDamage, ruleForBiome, prepBanner } from "./terrain.js";
import { heroSprite, enemySprite, spriteUri } from "./sprites/index.js";
import { viewSprite, HERO_VIEW_OPTS } from "./sprites/side.js";
import { enemyMakeMove, enemyMakeRandomMove, setGameStarted, restartSuggestionTimer, getTrappedCells, setTrappedCells, isBoardResolving, setBiomeRule, advanceBiomeTurn, boostBoardColor } from "./board.js";
import { actionGuard } from "./actionGuard.js";
import { elementName } from "./elements.js";
import { createAnnouncement, announceDurationMs, waitUntil, isHpBarEmpty, openingStrikeCount, isWeaknessShown, HP_BAR_EMPTY_PAUSE_MS } from "./combatFlow.js";
import { bigMatchXpFor } from "./matchMechanics.js";
import { recordBossLoss, recordVictory, pickBossTip } from "./bossTips.js";
import { pickTrapZone, trapDamage, mirrorLoadout, duelTurnPlan, weakenedHp } from "./duel.js";
import { arenaRewardBonus, arenaTier } from "./arena.js";
import { makeDecision, setAIDifficulty, getAIDifficulty, logDecision, setAIDifficultyByLevel } from "./enemyAI.js";
import { getRandomItem, getRarityIcon, getRarityColor, useItem, applyArtifactEffects, tickReusableRecharge, describeRecharge } from "./items.js";
import { icon as svgIcon, manaIcon } from "./icons.js";
import { ATTRIBUTE_MANA_RULES, ATTRIBUTE_ORDER, describeAttributeChoice, summarizeColorBonuses, respecAttributes, totalAttributePoints } from "./attributes.js";
import { MAX_LEVEL, initializeXP, addXP, calculateXPGain, getXPProgress, getXPToNextLevel, normalizeXP } from "./experience.js";
import { equip as equipGearSlot, unequip as unequipGearSlot } from "./equipment.js";
import { playSfx } from "./sound.js";
import { applyGrowth } from "./progression.js";
import { animationFactor } from "./gameOptions.js";
import { allSpells as spellsCatalog, getSpellsByLevel, getSpellsByClass } from "./spells.js";

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
const classIcon = classId => (CLASS_ICONS[classId] ? svgIcon(CLASS_ICONS[classId]) : '');
const MANA_COLOR_ORDER = ['red', 'blue', 'green', 'yellow', 'purple'];
const MANA_COLOR_META = {
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
    return getPrimaryAttributeEffect(entity, attribute) * fixedBonus;
}

export function getManaCapForColor(entity, color){
    const baseCap = Math.max(0, Math.floor(entity?.maxMana ?? BASE_MANA_CAP));
    return baseCap + getAttributeManaBonus(entity, color, "max");
}

export function recalculateManaCaps(entity){
    if(!entity || !entity.mana) return;
    const manaCaps = {};
    Object.keys(entity.mana).forEach(color => {
        manaCaps[color] = getManaCapForColor(entity, color);
    });
    entity.manaCaps = manaCaps;
}

function clampManaToCaps(entity){
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

export function canEntityCastSpell(entity, spell){
    if(!entity || !entity.mana || !spell) return false;

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

function normalizeBonusTurnValue(value){
    if(value === true) return 1;
    if(value === false || value === null || value === undefined) return 0;

    const numericValue = Number(value);
    if(!Number.isFinite(numericValue)) return 0;
    return Math.max(0, Math.floor(numericValue));
}

// Pastille « cadeau ×N » affichée à côté du nom tant qu'il reste des tours bonus accumulés.
function bonusTurnBadge(entity){
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

export function getEnemyAttackDamageCap(enemyEntity = enemy){
    const hpReference = Math.max(1, Math.floor(enemyEntity?.maxHp || enemyEntity?.hp || 1));
    return Math.max(1, Math.floor(hpReference / 4));
}

export function clampEnemyAttackDamage(rawDamage, enemyEntity = enemy){
    const normalizedDamage = Math.max(0, Math.floor(rawDamage || 0));
    return Math.min(normalizedDamage, getEnemyAttackDamageCap(enemyEntity));
}

// Couleurs de mana d'un sort : une (coût simple) ou plusieurs (coût multi-mana).
export function spellColorsOf(spell){
    if(!spell) return [];
    if(spell.cost && typeof spell.cost === 'object') return Object.keys(spell.cost);
    if(Array.isArray(spell.colors) && spell.colors.length > 0) return spell.colors;
    return spell.color ? [spell.color] : [];
}

// Coût en HTML : pastille + montant par couleur, « + » entre deux couleurs ; le sort multi-mana est marqué `spell-multi`.
const MANA_HEX = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f', purple: '#9b59b6' };
export function spellCostHtml(sp){
    if(typeof sp.cost === 'number') return `<span class="mana-dot mana-${sp.color}"></span>${sp.cost}`;
    if(sp.cost && typeof sp.cost === 'object'){
        return Object.entries(sp.cost).map(([color, amount]) => `<span class="mana-dot mana-${color}"></span>${amount}`).join('<span class="cost-plus">+</span>');
    }
    return '';
}
// Marque visuelle d'un sort multi-mana : barre dégradée aux deux couleurs (CSS `.spell-multi`).
export function markMultiManaSpell(el, sp){
    const colors = spellColorsOf(sp);
    if(colors.length < 2) return;
    el.classList.add('spell-multi');
    el.style.setProperty('--spell-c1', MANA_HEX[colors[0]] || '#888');
    el.style.setProperty('--spell-c2', MANA_HEX[colors[colors.length - 1]] || '#888');
}

function getPrimarySpellColor(spell, target = null){
    if(!spell || typeof spell !== 'object') return null;

    // Sort multi-mana : on retient la couleur la plus pertinente contre la cible (sa faiblesse, sinon une couleur qu'elle ne maîtrise pas)
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

export function applyDamage(target, damage, options = {}){
    if(!target) return 0;
    let normalizedDamage = Math.max(0, Math.floor(damage || 0));

    const sourceColor = options.sourceColor || getPrimarySpellColor(options.sourceSpell, target);
    const affinityResult = applyEnemyColorAffinityModifier(target, normalizedDamage, sourceColor);
    normalizedDamage = affinityResult.modifiedDamage;

    if(affinityResult.affinityType === 'force' && affinityResult.delta > 0) {
        log(`${target.name} résiste (${target.preferredColor}) : -${affinityResult.delta} dégâts (niveau ${target.level}).`);
    } else if(affinityResult.affinityType === 'faiblesse' && affinityResult.delta > 0) {
        log(`${target.name} est faible à ${sourceColor} : +${affinityResult.delta} dégâts (niveau ${target.level}).`);
    }

    // Bouclier équipé : absorbe un total de dégâts par combat (`absorbDamage`).
    if(target === player && normalizedDamage > 0 && player.shieldAbsorbLeft > 0) {
        const absorbedByShield = Math.min(player.shieldAbsorbLeft, normalizedDamage);
        player.shieldAbsorbLeft -= absorbedByShield;
        normalizedDamage -= absorbedByShield;
        log(`${player.equipment?.leftHand?.name || 'Votre bouclier'} absorbe ${absorbedByShield} dégâts.`);
    }

    // Bouclier mana: certains sorts redirigent les dégâts subis vers une réserve de mana.
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
                log(`Bouclier de mana (${shieldColor}) absorbe ${absorbed} dégâts.`);
            }

            if(player.mana[shieldColor] <= 0) {
                delete player.statusEffects.manaShield;
                log(`Le bouclier de mana se dissipe.`);
            }
        }
    }

    const currentHp = Math.max(0, Math.floor(target.hp || 0));
    const nextHp = Math.max(0, currentHp - normalizedDamage);
    target.hp = nextHp;

    if(target === player && normalizedDamage > 0 && enemy.hp > 0) {
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
                log(`Flèches Sifflantes drainent ${drained} mana ennemi.`);
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

    if(typeof spell.cost === 'number') {
        entity.mana[spell.color] = Math.max(0, (entity.mana[spell.color] || 0) - spell.cost);
        return;
    }

    if(spell.cost && typeof spell.cost === 'object') {
        for(const [color, amount] of Object.entries(spell.cost)) {
            entity.mana[color] = Math.max(0, (entity.mana[color] || 0) - amount);
        }
    }
}

function applyStandardSpellEffects(caster, target, spell, isPlayerCaster){
    const intelligenceBonus = getPrimaryAttributeEffect(caster, "intelligence");

    if(spell.dmg){
        const spellColors = spellColorsOf(spell);
        const targetResistance = spellColors.length
            ? spellColors.reduce((sum, c) => sum + (target.resistances?.[c] || 0), 0) / spellColors.length   // multi-mana : résistance moyenne
            : (target.resistances?.[spell.color] || 0);
        let dmg = Math.floor((spell.dmg + intelligenceBonus) * (1 - targetResistance));
        if(isPlayerCaster && target.prep?.weaknessRevealed){
            dmg = weaknessDamage(dmg, spellColors.includes(target.weakColor) ? target.weakColor : spell.color, target.weakColor, true);
        }
        if(!isPlayerCaster && target.damageReduction > 0) {
            dmg = Math.max(1, Math.floor(dmg * (1 - target.damageReduction)));
        }
        if(!isPlayerCaster) {
            dmg = clampEnemyAttackDamage(dmg, caster);
        }
        applyDamage(target, dmg, { sourceSpell: spell });

        if(isPlayerCaster) {
            playSfx('spellHit', { isPlayer: true });
            showCombatAnimation({ icon: 'fire', title: spell.name, damage: `-${Math.floor(dmg)} dégâts`, target: `→ ${target.name}` }, true);
            log(`${spell.name} inflige ${dmg} dégâts.`);
        } else {
            playSfx('spellHit', { isPlayer: false });
            showCombatAnimation({ icon: 'fire', title: spell.name, damage: `-${Math.floor(dmg)} dégâts`, source: caster.name, target: '→ Vous' }, false);
            log(`${caster.name} lance ${spell.name} ! ${dmg} dégâts.`);
        }
    }

    if(spell.heal){
        const healAmount = spell.heal + intelligenceBonus;
        caster.hp = Math.min(caster.maxHp, caster.hp + healAmount);
        playSfx('heal', { isPlayer: isPlayerCaster });

        if(isPlayerCaster) {
            showCombatAnimation({ icon: 'leaf', title: spell.name, heal: `+${healAmount} HP`, target: '→ Vous' }, true);
            log(`${spell.name} soigne ${healAmount} HP.`);
        } else {
            showCombatAnimation({ icon: 'leaf', title: spell.name, heal: `+${healAmount} HP`, source: caster.name }, false);
            log(`${caster.name} utilise ${spell.name} et soigne ${healAmount} HP.`);
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
    availableSpells: [], // sorts débloqués
    weapons: [],  // armes possédées
    equippedWeapon: null,  // arme équipée
    availableWeapons: [],  // armes débloquées
    equipment: { rightHand: null, leftHand: null, item: null },  // système d'équipement multi-slot
    combatPoints: 0,
    bonusTurn: 0,
    abilities: [],  // aptitudes acquises
    class: null,  // classe du joueur (sorcerer, assassin, templar, barbarian)
    statusEffects: {},  // effets de statut actifs (poison, stun, buffs, etc.)
    defense: 0,  // défense du joueur
    inventory: [],  // inventaire des objets possédés
    activeInventoryIndex: null,  // index de l'objet actuellement actif
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
            labels.push(`${entry.item.name} (${rarityText})`);
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

// tour actuel
export let currentTurn = 'player';

// état du combat (objet pour pouvoir modifier la propriété)
export const gameState = { 
    combatState: 'ready' // 'ready' (avant combat), 'active' (en cours), 'finished' (terminé)
};

const combatRewards = {
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

function queueCombatXP(xpAmount){
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

function applyCombatXPAtEnd(){
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
    playCombatEndFade(isVictory);
}

// Fin de combat : fondu au noir très court avec le mot « Victoire » / « Défaite », puis retour à l'écran de résultat.
function playCombatEndFade(isVictory){
    document.getElementById('combat-end-fade')?.remove();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fade = document.createElement('div');
    fade.id = 'combat-end-fade';
    fade.className = `combat-end-fade ${isVictory ? 'victory' : 'defeat'}`;
    fade.textContent = isVictory ? 'VICTOIRE' : 'DÉFAITE';
    fade.style.pointerEvents = 'none';
    document.body.appendChild(fade);
    setTimeout(() => fade.remove(), reduced ? 400 : 1300);
}

// Points d'accroche de la phase d'exploration : onVictory est appelé dès la victoire (avant la
// sauvegarde), onEnd quand l'écran de résultat s'affiche (victoire, défaite ou abandon).
export const combatHooks = { onVictory: null, onEnd: null };

function finalizeCombatEndUI(isVictory){
    introToken++;
    dismissCombatIntro();
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

function showEndCombatAnimation(isVictory, options = {}){
    const {
        requireClick = true,
        continueText = ''
    } = options;

    whenLoserHpBarEmpty(isVictory, () => {
        if(gameState.combatState !== 'finished') return;   // un nouveau combat a démarré entre-temps
        // Victoire : l'écran de résultat (avec son fondu « VICTOIRE ») s'affiche sans second écran « Cliquez pour continuer ».
        if(isVictory){
            finalizeCombatEndUI(true);
            return;
        }

        const data = { icon: 'skull', title: 'Defaite', damage: 'Combat termine !', target: 'Cliquez pour continuer' };
        if(!requireClick){
            data.target = 'Retour a l ecran de resultat...';
        }

        showCombatAnimation(data, isVictory, {
            requireClick,
            continueText,
            autoHideMs: 650,
            onContinue: () => finalizeCombatEndUI(isVictory)
        });
    });
}

// règles de combat
export const combatCost = 5;             // points nécessaires pour une attaque normale
export const skullDamage = 1;           // dégâts infligés par soleil lors d'un match

// ennemi courant (combatPoints pour attaquer)
export let enemy = { name:"Xiao Gui", hp:50, maxHp:50, attack:10, resistances:{}, combatPoints:0, mana: { red:0, blue:0, green:0, yellow:0, purple:0 }, spells:[], weapon: null, abilities: [], statusEffects: {}, bonusTurn: 0, inventoryItem: null };

// si le joueur meurt, on restaure ses PV et réinitialise le combat
export function restartCombat(){
    actionGuard.reset();
    introToken++;
    dismissCombatIntro();
    if(pendingPlayerDeathTimeout) {
        clearTimeout(pendingPlayerDeathTimeout);
        pendingPlayerDeathTimeout = null;
    }

    player.hp = player.maxHp;
    player.combatPoints = 0;
    player.bonusTurn = 0;
    enemy.hp = enemy.maxHp;
    enemy.combatPoints = 0;
    enemy.bonusTurn = 0;
    // Réinitialiser le mana à 0
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
    // Réinitialiser le statut du jeu
    setGameStarted(false);
    // Appliquer les aptitudes de début de combat
    applyStartingAbilities();
    
    log("Combat réinitialisé, vous êtes en pleine santé.");
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
        showEndCombatAnimation(false, { requireClick: false });
    }, PLAYER_DEATH_DELAY_MS);
}

// démarre un nouveau combat
export function startNewCombat(selectedEnemy = null){
    playSfx('uiClick');
    document.body.classList.remove('combat-ended');
    gameState.combatState = 'active';
    window.dispatchEvent(new Event('match3:combat-start'));
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
    // Restaurer les PV et préparer le combat
    restartCombat();
    newEnemy(selectedEnemy);
    playSfx(enemy?.isBoss ? 'bossStart' : 'combatStart');
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
    {id:"fireAffinity", name:"Affinité de Feu", description:"Commence le combat avec 10 mana rouge", startMana:{red:10}},
    {id:"iceAffinity", name:"Affinité de Glace", description:"Commence le combat avec 10 mana bleu", startMana:{blue:10}},
    {id:"natureAffinity", name:"Affinité de Nature", description:"Commence le combat avec 10 mana vert", startMana:{green:10}},
    {id:"stormAffinity", name:"Affinité de Foudre", description:"Commence le combat avec 10 mana jaune", startMana:{yellow:10}},
    {id:"shadowAffinity", name:"Affinité d'Ombre", description:"Commence le combat avec 10 mana violet", startMana:{purple:10}},
    {id:"elementalist", name:"Maître des Cinq Éléments", description:"Commence le combat avec 5 mana de chaque couleur", startMana:{red:5, blue:5, green:5, yellow:5, purple:5}},
    {id:"fireMastery", name:"Maîtrise du Feu", description:"+2 mana rouge par match (5 au lieu de 3)"},
    {id:"iceMastery", name:"Maîtrise de la Glace", description:"+2 mana bleu par match (5 au lieu de 3)"},
    {id:"natureMastery", name:"Maîtrise de la Nature", description:"+2 mana vert par match (5 au lieu de 3)"},
    {id:"stormMastery", name:"Maîtrise de la Foudre", description:"+2 mana jaune par match (5 au lieu de 3)"},
    {id:"shadowMastery", name:"Maîtrise de l'Ombre", description:"+2 mana violet par match (5 au lieu de 3)"}
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

function normalizeActiveInventoryIndex() {
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

function getActiveInventoryItem() {
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

// --- Animation compteur (tick 1 par 1) ---
const _activeCounters = {};
/**
 * Anime simultanément un compteur texte (id) et sa progress bar associée,
 * en incrémentant/décrémentant de 1 à chaque tick jusqu'à la valeur cible.
 * @param {string} id      - id du span texte
 * @param {number} from    - valeur de départ
 * @param {number} to      - valeur cible
 * @param {HTMLElement|null} progressEl - élément <progress> à synchroniser (optionnel)
 */
function _animateHpBar(id, from, to, progressEl = null) {
    if (_activeCounters[id]) {
        clearInterval(_activeCounters[id]);
        delete _activeCounters[id];
    }
    if (isNaN(from) || from === to) return;
    let current = from;
    const step = to > from ? 1 : -1;
    const delta = Math.abs(to - from);
    const intervalMs = Math.max(50, Math.min(150, Math.round(1500 / delta)));

    function applyValue(val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
        if (progressEl) progressEl.value = val;
    }

    applyValue(current);
    _activeCounters[id] = setInterval(() => {
        current += step;
        applyValue(current);
        if (current === to) {
            clearInterval(_activeCounters[id]);
            delete _activeCounters[id];
        }
    }, intervalMs);
}

function _animateCounter(id, from, to) {
    _animateHpBar(id, from, to, null);
}

// Dessins des combattants (héros à gauche tourné vers la droite, ennemi à droite tourné vers la gauche) : posés en variable CSS
// `--portrait` des panneaux de stats (pseudo-élément ::after), donc sans clignotement quand le panneau est reconstruit.
function updateFighterPortraits(){
    const set = (id, svg, dir, opts) => {
        const el = document.getElementById(id);
        if(!el) return;
        const view = svg ? viewSprite(svg, dir, opts) : null;
        if(view) el.style.setProperty('--portrait', `url("${spriteUri(view)}")`);
        else el.style.removeProperty('--portrait');
    };
    set('player-stats', heroSprite(player.class) || heroSprite('assassin'), 'right', HERO_VIEW_OPTS);
    set('enemy-stats', enemySprite(enemy.spriteKey || enemy.id, enemy.templateId, enemy.biome), 'left');
}

export function updateStats(){
    syncPlayerControlsLock();
    updateLevelHud();
    updateFighterPortraits();
    // truncate log to only the latest message
    const logDiv=document.getElementById('log');
    if(logDiv){
        const lines = logDiv.innerHTML.split('<br>').filter(l=>l.trim()!=='');
        logDiv.innerHTML = lines.slice(-1).join('<br>');
    }

    // Snapshot des valeurs affichées AVANT le rebuild du DOM
    const snapPlayerHp = parseInt(document.getElementById('player-hp-current')?.textContent, 10);
    const snapEnemyHp  = parseInt(document.getElementById('enemy-hp-current')?.textContent,  10);
    const snapPlayerMana = {};
    const snapEnemyMana  = {};
    for (const c of ['red','blue','green','yellow','purple']) {
        snapPlayerMana[c] = parseInt(document.getElementById(`player-mana-${c}`)?.textContent, 10);
        snapEnemyMana[c]  = parseInt(document.getElementById(`enemy-mana-${c}`)?.textContent,  10);
    }

    // Cibles (valeurs actuelles des entités)
    const targetPlayerHp = Math.floor(player.hp);
    const targetEnemyHp  = Math.floor(enemy.hp);
    // Valeurs initiales pour les progress bars (snap si disponible, sinon target)
    const initPlayerHp = isNaN(snapPlayerHp) ? targetPlayerHp : snapPlayerHp;
    const initEnemyHp  = isNaN(snapEnemyHp)  ? targetEnemyHp  : snapEnemyHp;
    const targetPlayerMana = { red: player.mana.red, blue: player.mana.blue, green: player.mana.green, yellow: player.mana.yellow, purple: player.mana.purple };
    const targetEnemyMana  = { red: enemy.mana.red,  blue: enemy.mana.blue,  green: enemy.mana.green,  yellow: enemy.mana.yellow,  purple: enemy.mana.purple  };

    const playerDiv=document.getElementById('player-stats');
    // Affichage de la classe si définie
    Promise.resolve(classIcon(player.class)).then(emoji => {
        playerDiv.innerHTML = `
            <div class="stat"><span class="enemy-combat-name" title="${player.name || 'Hou Yi'}">${emoji} ${(player.name || 'Hou Yi').split(' ')[0]}</span><span style="color: #888;"> ${player.level}</span>${bonusTurnBadge(player)}</div>
            <div class="stat">
                <div class="hp-bar-container">
                    <progress value="${initPlayerHp}" max="${player.maxHp}"></progress>
                    <span class="hp-text"><span id="player-hp-current">${targetPlayerHp}</span>/${player.maxHp}</span>
                </div>
            </div>
            <div class="stat"><strong>Atk:</strong> ${player.attack} <strong>Def:</strong> ${player.defense || 0} <span class="pa-stat" title="Points d'action">${svgIcon('arrow')} ${player.combatPoints}</span></div>
            <div class="stat">
                <div class="mana-dots">
                    <span class="mana-dot mana-red" title="${targetPlayerMana.red}"></span><span id="player-mana-red">${targetPlayerMana.red}</span>
                    <span class="mana-dot mana-blue" title="${targetPlayerMana.blue}"></span><span id="player-mana-blue">${targetPlayerMana.blue}</span>
                    <span class="mana-dot mana-green" title="${targetPlayerMana.green}"></span><span id="player-mana-green">${targetPlayerMana.green}</span>
                    <span class="mana-dot mana-yellow" title="${targetPlayerMana.yellow}"></span><span id="player-mana-yellow">${targetPlayerMana.yellow}</span>
                    <span class="mana-dot mana-purple" title="${targetPlayerMana.purple}"></span><span id="player-mana-purple">${targetPlayerMana.purple}</span>
                </div>
            </div>`;
        
        // Animer les compteurs si les valeurs ont changé
        const playerProgressEl = playerDiv.querySelector('.hp-bar-container progress');
        _animateHpBar('player-hp-current', initPlayerHp, targetPlayerHp, playerProgressEl);
        for (const c of ['red','blue','green','yellow','purple']) {
            _animateCounter(`player-mana-${c}`, snapPlayerMana[c], targetPlayerMana[c]);
        }

        // Ajouter/retirer classe pour liseré selon le tour actuel
        playerDiv.classList.toggle('active-turn', currentTurn === 'player');
    });
    
    const enemyDiv=document.getElementById('enemy-stats');
    enemyDiv.classList.toggle('active-turn', currentTurn === 'enemy');
    
    // Icône de la classe de l'ennemi
    const enemyClassEmoji = classIcon(enemy.playerClass);
    
    // Afficher un indicateur visuel si l'ennemi est plus fort
    const levelIndicator = enemy.level > player.level ? 
        `<span style="color: #ff4444; font-weight: bold;"> Niv.${enemy.level}</span>` : 
        `<span style="color: #888;"> ${enemy.level}</span>`;
    
    enemyDiv.innerHTML = `
        <div class="stat"><span class="enemy-combat-name" data-full-name="${enemy.name}" aria-label="Nom complet: ${enemy.name}">${enemyClassEmoji} ${enemy.name.split(' ')[0]}</span>${levelIndicator}${bonusTurnBadge(enemy)}</div>
        <div class="stat">
            <div class="hp-bar-container">
                <progress class="enemy-bar" value="${initEnemyHp}" max="${enemy.maxHp}"></progress>
                <span class="hp-text"><span id="enemy-hp-current">${targetEnemyHp}</span>/${enemy.maxHp}</span>
            </div>
        </div>
        <div class="stat"><strong>Atk:</strong> ${enemy.attack} <strong>Def:</strong> ${enemy.defense || 0} <span class="pa-stat" title="Points d'action">${svgIcon('arrow')} ${enemy.combatPoints}</span></div>
        <div class="stat">
            <div class="mana-dots">
                <span class="mana-dot mana-red" title="${targetEnemyMana.red}"></span><span id="enemy-mana-red">${targetEnemyMana.red}</span>
                <span class="mana-dot mana-blue" title="${targetEnemyMana.blue}"></span><span id="enemy-mana-blue">${targetEnemyMana.blue}</span>
                <span class="mana-dot mana-green" title="${targetEnemyMana.green}"></span><span id="enemy-mana-green">${targetEnemyMana.green}</span>
                <span class="mana-dot mana-yellow" title="${targetEnemyMana.yellow}"></span><span id="enemy-mana-yellow">${targetEnemyMana.yellow}</span>
                <span class="mana-dot mana-purple" title="${targetEnemyMana.purple}"></span><span id="enemy-mana-purple">${targetEnemyMana.purple}</span>
            </div>
        </div>`;
    // Animer les compteurs ennemi
    const enemyProgressEl = enemyDiv.querySelector('.hp-bar-container progress');
    _animateHpBar('enemy-hp-current', initEnemyHp, targetEnemyHp, enemyProgressEl);
    for (const c of ['red','blue','green','yellow','purple']) {
        _animateCounter(`enemy-mana-${c}`, snapEnemyMana[c], targetEnemyMana[c]);
    }

    const enemyNameEl = enemyDiv.querySelector('.enemy-combat-name');
    if(enemyNameEl) {
        const fullName = enemyNameEl.dataset.fullName || enemy.name;
        const showName = () => showEnemyNameTooltip(enemyNameEl, fullName, enemy);
        const hideName = () => hideEnemyNameTooltip();

        enemyNameEl.addEventListener('mouseenter', showName);
        enemyNameEl.addEventListener('mouseleave', hideName);
        enemyNameEl.addEventListener('focus', showName);
        enemyNameEl.addEventListener('blur', hideName);
        enemyNameEl.addEventListener('touchstart', showName, { passive: true });
        enemyNameEl.addEventListener('touchend', hideName);
        enemyNameEl.addEventListener('touchcancel', hideName);
    }
    bindEnemyCardTap(enemyDiv);
    
    updateEnemySpells();
}

export function updateEnemySpells(){
    // Afficher l'arme ennemie (au-dessus des sorts, comme le joueur)
    const weaponContainer = document.getElementById('enemy-weapon-button');
    if (weaponContainer) {
        let weaponHtml = '';
        if (enemy.weapon) {
            const icon = getWeaponIcon(enemy.weapon.type);
            weaponHtml += `
                <div class="enemy-spell-item disabled">
                    <div class="spell-name">${icon} ${enemy.weapon.name}</div>
                    <div class="spell-cost">${enemy.weapon.actionPoints} ${svgIcon('arrow')} - ${enemy.weapon.damage} ${svgIcon('skull')}</div>
                </div>
            `;
        }
        if (enemy.inventoryItem) {
            weaponHtml += `
                <div class="enemy-spell-item disabled enemy-item-card" tabindex="0">
                    <div class="spell-name">${svgIcon('bag')} ${enemy.inventoryItem.name}</div>
                    <div class="spell-cost">Objet ennemi</div>
                </div>
            `;
        }
        weaponContainer.innerHTML = weaponHtml;

        const enemyItemCard = weaponContainer.querySelector('.enemy-item-card');
        if(enemyItemCard && enemy.inventoryItem) {
            const showDetails = () => showItemTooltip(enemyItemCard, enemy.inventoryItem, { isEnemyItem: true });
            const hideDetails = () => hideSpellTooltip();
            bindTooltip(enemyItemCard, showDetails, hideDetails);
        }
    }

    const container = document.getElementById('enemy-spell-list');
    if(!container) return;
    container.innerHTML = '';
    
    if(!enemy.spells || enemy.spells.length === 0){
        container.innerHTML = '<div class="enemy-spell-item" style="text-align:center;"><em>Aucun sort</em></div>';
        return;
    }
    
    enemy.spells.forEach(sp => {
        const div = document.createElement('div');
        div.className = 'enemy-spell-item';
        const hasEnoughMana = canEntityCastSpell(enemy, sp);
        if(!hasEnoughMana) {
            div.classList.add('disabled');
        }
        
        // Sort de classe : icône de la classe
        const spellClassIndicator = sp.class ? classIcon(sp.class) : '';
        
        // Gestion des coûts multiples pour les sorts de classe
        const costDisplay = spellCostHtml(sp);
        
        const damageText = sp.dmg ? ` • ${sp.dmg} dmg` : '';
        const healText = sp.heal ? ` • ${sp.heal} HP` : '';
        const effectText = sp.description || (sp.effect ? 'Effet special' : (sp.dmg ? `Inflige ${sp.dmg} degats` : (sp.heal ? `Soigne ${sp.heal} HP` : 'Aucun effet')));
        div.innerHTML = `
            <div class="spell-name">${spellClassIndicator} ${sp.name}</div>
            <div class="spell-cost">${costDisplay}${damageText}${healText}</div>
        `;
        div.title = effectText;
        markMultiManaSpell(div, sp);

        const showDetails = () => showSpellTooltip(div, sp);
        const hideDetails = () => hideSpellTooltip();
        bindTooltip(div, showDetails, hideDetails);

        container.appendChild(div);
    });
}

export function log(text){
    const logDiv=document.getElementById('log');
    if(logDiv){
        logDiv.innerHTML = text + "<br>";
        logDiv.scrollTop = logDiv.scrollHeight;
    }
}

export function logActiveAction(actionText){
    const actor = currentTurn === 'player'
        ? `joueur (${player.name || 'Hou Yi'})`
        : `ennemi (${enemy.name || 'Ennemi'})`;
    console.log(`Action active - ${actor}: ${actionText}`);
}

// ========================================
// GESTION DE LA DIFFICULTÉ DE L'IA
// ========================================

export function changeAIDifficulty(difficultyLevel) {
    setAIDifficulty(difficultyLevel);
    log(`Difficulté de l'IA changée: ${difficultyLevel}`);
}

export function getCurrentAIDifficulty() {
    const difficulty = getAIDifficulty();
    return difficulty.name;
}

// ========================================

export function saveUpdate(){
    clampManaToCaps(player);
    try {
        localStorage.setItem('player', JSON.stringify(player));
        console.log('Données du joueur sauvegardées');
        if (player.class) {
            console.log(`Classe sauvegardée: ${player.class}`);
        }
    } catch (e) {
        console.error('Erreur lors de la sauvegarde:', e);
    }
    updateStats();
    createSpellButtons();
    createWeaponButton();
    updatePlayerStatsTab();
}

// Fonction pour effacer la sauvegarde
export function clearSaveData() {
    if (confirm('Réinitialiser le jeu ? Toute votre progression (personnage, quêtes, objets) sera définitivement effacée.')) {
        localStorage.removeItem('player');
        console.log('Sauvegarde effacée');
        location.reload();
    }
}

// mise à jour de l'onglet stats détaillées
export function updatePlayerStatsTab(){
    const statsContent = document.getElementById('stats-content');
    if(!statsContent) return;
    
    // Import de la classe pour afficher le nom
    import('./classes.js').then(module => {
        const classData = player.class ? module.playerClasses[player.class] : null;
        const className = classData ? `${classIcon(player.class)} ${classData.name}` : 'Aucun';
        
        // Calculer la progression XP
        const xpProgress = getXPProgress(player);
        const xpRemaining = getXPToNextLevel(player);
        
        statsContent.innerHTML = `
            <div class="stats-section">
                <h3>Informations</h3>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('idCard')} Nom:</span>
                    <span class="stat-value">${player.name || 'Hou Yi'}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('mask')} Style:</span>
                    <span class="stat-value">${className}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('star')} Niveau:</span>
                    <span class="stat-value">${player.level}</span>
                </div>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('chart')} Expérience:</span>
                    <span class="stat-value">${player.xp} / ${player.xpToNextLevel} XP</span>
                </div>
                <div class="stat-line">
                    <div style="width: 100%; margin-top: 5px;">
                        <div class="xp-bar-container">
                            <progress class="xp-bar" value="${xpProgress}" max="100" style="width: 100%;"></progress>
                            <span class="xp-text">${xpProgress}% (${xpRemaining} XP restants)</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="stats-section attribute-points-section">
                <h3>Points d'attribut</h3>
                <div class="stat-line">
                    <span class="stat-label">${svgIcon('star')} À répartir :</span>
                    <span class="stat-value">${player.unspentLevelPoints || 0}</span>
                    <span class="stat-effect">${totalAttributePoints(player)} point(s) dépensé(s)</span>
                </div>
                <div class="attribute-points-actions">
                    <button type="button" id="spend-points-btn" ${(player.unspentLevelPoints || 0) > 0 && gameState.combatState !== 'active' ? '' : 'disabled'}>Répartir les points</button>
                    <button type="button" id="reset-points-btn" ${totalAttributePoints(player) > 0 && gameState.combatState !== 'active' ? '' : 'disabled'} title="Rend tous les points dépensés pour les répartir autrement (hors combat)">Réinitialiser les points</button>
                </div>
            </div>
            <div class="stats-section">
                <h3>Caractéristiques</h3>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('muscle')} Force (Strength):</span>
                <span class="stat-value">${player.attributes.strength}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'strength')} Attaque</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('runner')} Agilité (Agility):</span>
                <span class="stat-value">${player.attributes.agility}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'agility')} Défense</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('brain')} Intelligence:</span>
                <span class="stat-value">${player.attributes.intelligence}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'intelligence')} Puissance magique</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('heart')} Endurance (Stamina):</span>
                <span class="stat-value">${player.attributes.stamina}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'stamina')} HP max</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('target')} Moral (Morale):</span>
                <span class="stat-value">${player.attributes.morale}</span>
                <span class="stat-effect">Effet principal: ${getPrimaryAttributeEffect(player, 'morale')} Attaque morale</span>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Statistiques de combat</h3>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('sword')} Attaque:</span>
                <span class="stat-value">${player.attack}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('shield')} Défense:</span>
                <span class="stat-value">${player.defense || 0}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('heart')} HP Maximum:</span>
                <span class="stat-value">${player.maxHp}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${svgIcon('spark')} Mana Maximum:</span>
                <span class="stat-value">${player.maxMana}</span>
            </div>
            <div class="stat-line">
                <span class="stat-label">${['red', 'yellow', 'green', 'blue', 'purple'].map(manaIcon).join('')} Caps mana:</span>
                <span class="stat-value">${player.manaCaps?.red ?? player.maxMana}/${player.manaCaps?.yellow ?? player.maxMana}/${player.manaCaps?.green ?? player.maxMana}/${player.manaCaps?.blue ?? player.maxMana}/${player.manaCaps?.purple ?? player.maxMana}</span>
            </div>
        </div>
        
        <div class="stats-section">
            <h3>Bonus de couleur (niveaux)</h3>
            ${summarizeColorBonuses(player).map(c => `<div class="stat-line">
                <span class="stat-label">${manaIcon(c.color)} ${c.colorLabel[0].toUpperCase() + c.colorLabel.slice(1)} (${c.points} pt) :</span>
                <span class="stat-effect">match de 3 = ${c.perMatch3} mana · +${c.initial} au départ · réserve ${c.cap}</span>
            </div>`).join('')}
        </div>

        <div class="stats-section">
            <button onclick="window.clearPlayerSave()" class="secondary">Effacer la sauvegarde</button>
        </div>
    `;
        statsContent.querySelector('#spend-points-btn')?.addEventListener('click', () => showAttributeMenu());
        statsContent.querySelector('#reset-points-btn')?.addEventListener('click', () => {
            if(gameState.combatState === 'active') return;
            if(confirm(`Réinitialiser les ${totalAttributePoints(player)} point(s) d'attribut dépensés ? Ils vous seront rendus pour être répartis autrement.`)) {
                resetAttributePoints();
            }
        });
    });
}

// Construit et affiche une animation d'attaque ou de sort à partir de paramètres structurés.
// Paramètres : { icon, title, damage?, heal?, source?, target? }
export function showCombatAnimation({ icon, title, damage = null, heal = null, source = null, target = null }, isPlayerAttack = true, options = {}) {
    let html = `<div class="attack-icon">${svgIcon(icon) || icon}</div><div class="attack-title">${String(title).toUpperCase()}</div>`;
    if (damage !== null) html += `<div class="attack-damage">${damage}</div>`;
    if (heal   !== null) html += `<div class="attack-heal">${heal}</div>`;
    if (source !== null) html += `<div class="attack-source">${source}</div>`;
    if (target !== null) html += `<div class="attack-target">${target}</div>`;
    showAttackAnimation(html, isPlayerAttack, options);
}

// Mécanisme DOM bas niveau pour afficher un overlay d'animation sur la grille
export function showAttackAnimation(text, isPlayerAttack = true, options = {}) {
    const {
        requireClick = false,
        continueText = 'Cliquez pour continuer',
        onContinue = null,
        autoHideMs = 1000 * animationFactor()
    } = options;

    const boardDiv = document.getElementById('board');
    if(!boardDiv) {
        if(typeof onContinue === 'function') {
            onContinue();
        }
        return;
    }
    
    // Créer l'overlay qui cache la grille
    const overlay = document.createElement('div');
    overlay.className = 'attack-overlay';
    
    // Créer le contenu de l'animation
    const attackDiv = document.createElement('div');
    attackDiv.className = 'attack-animation';
    attackDiv.innerHTML = text;
    
    // Couleur selon qui attaque
    if(isPlayerAttack) {
        overlay.classList.add('player-attack');
    } else {
        overlay.classList.add('enemy-attack');
    }

    const finishOverlay = () => {
        if(!overlay.parentNode) return;
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if(overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            if(typeof onContinue === 'function') {
                onContinue();
            }
        }, 500);
    };

    if(requireClick) {
        overlay.classList.add('requires-click');
        const continueHint = document.createElement('div');
        continueHint.className = 'attack-continue';
        continueHint.textContent = continueText;
        attackDiv.appendChild(continueHint);

        overlay.setAttribute('role', 'button');
        overlay.setAttribute('aria-label', continueText);
        overlay.tabIndex = 0;
        overlay.addEventListener('click', finishOverlay);
        overlay.addEventListener('keydown', (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                finishOverlay();
            }
        });
    }
    
    overlay.appendChild(attackDiv);
    boardDiv.appendChild(overlay);

    if(!requireClick) {
        // Supprimer automatiquement après un court délai.
        setTimeout(() => {
            finishOverlay();
        }, autoHideMs);
    }
}

// -------------------------------------
// Anti-bourrinage : arme / objet / sort refusés pendant la résolution du plateau, juste après une action plateau,
// ou dans le court délai qui suit une autre action du joueur (voir actionGuard.js).
export function isPlayerActionBlocked(){
    return currentTurn !== 'player' || isBoardResolving() || actionGuard.blockReason() !== null;
}

// Dès que le joueur ne joue plus (tour adverse, écran de début de combat), TOUS ses boutons sont désactivés :
// armes, objets, sorts (colonne #player-spells rendue inerte : ni clic ni focus) et abandon ; l'actionGuard refuse aussi
// tout clic. Réactivés dès que le tour revient au joueur. Appelé à chaque updateStats().
export function syncPlayerControlsLock(){
    const locked = gameState.combatState === 'active' && currentTurn !== 'player';
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
function rejectRushedAction(){
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
    let dmg = weapon.damage + (player.attack || 0);
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

    // Critique
    const totalCritChance = (player.critChance || 0) + (player.tempCritChance || 0);
    let isCrit = false;
    if(totalCritChance > 0 && Math.random() * 100 < totalCritChance) {
        dmg = Math.floor(dmg * 1.5);
        isCrit = true;
    }

    // Défense de l'ennemi
    dmg = Math.max(1, dmg - (enemy.defense || 0));

    applyDamage(enemy, dmg);
    playSfx('weaponHit', { isPlayer: true });

    // Vol de vie
    if(player.lifesteal > 0) {
        const heal = Math.floor(dmg * player.lifesteal);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        log(`Vol de vie : +${heal} HP.`);
    }

    const icon = getWeaponIcon(weapon.type);

    const critSuffix = isCrit ? ' CRITIQUE !' : '';
    showCombatAnimation({ icon, title: weapon.name, damage: `-${dmg} dégâts${critSuffix}`, target: `→ ${enemy.name}` }, true);
    log(`${icon} Vous utilisez ${weapon.name}${free ? ' gratuitement' : ''} et infligez ${dmg} dégâts.${isCrit ? ' Coup critique !' : ''}`);
}


export function castSpell(spellId){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Seul le joueur actif peut lancer un sort."); return; }
    if(rejectRushedAction()) return;
    // Blocage tutoriel : interdire les sorts avant l'étape 4
    if(isTutorialActive() && getTutorialStep() < 4){
        log("Générez d'abord du mana avec des alignements de gâteaux de lune colorés !");
        return;
    }
    const spell=player.activeSpells.find(s=>s.id===spellId);
    if(!spell){ log("Sort indisponible !"); return; }
    if(player.level<spell.minLevel){ log(`Nécessite niveau ${spell.minLevel}`); return; }
    
    if(!canEntityCastSpell(player, spell)){
        const missingColor = getMissingManaColor(player, spell);
        log(missingColor ? `Pas assez de mana ${missingColor} !` : "Pas assez de mana !");
        return;
    }
    actionGuard.markPlayerAction();
    consumeSpellMana(player, spell);
    playSfx('spellCast', { isPlayer: true });
    
    // Gérer les sorts avec effet spécial
    if(spell.effect) {
        logActiveAction(`lance le sort ${spell.name} (effet special)`);
        // Import dynamique pour éviter les dépendances circulaires
        import('./classSpellEffects.js').then(module => {
            if(module.applyClassSpellEffect(spell)) {
                saveUpdate();
                tutorialCallbacks.onSpellCast?.();
                finishPlayerTurn();
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
            spell = classesModule.allClassSpells.find(s => s.id === spellId) || null;
        } catch {
            spell = null;
        }
    }

    if(!spell){
        log("Cheat: sort introuvable.");
        return false;
    }

    playSfx('spellCast', { isPlayer: true });
    logActiveAction(`simule le sort ${spell.name} (cheat)`);

    if(spell.effect){
        try {
            const module = await import('./classSpellEffects.js');
            const applied = module.applyClassSpellEffect(spell);
            if(!applied){
                saveUpdate();
                return false;
            }
            saveUpdate();
            if(consumeTurn){
                finishPlayerTurn();
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

export function finishPlayerTurn(){
    if(gameState.combatState !== 'active'){
        return;
    }

    // Vérifier si le joueur est mort
    if(player.hp<=0){
        handlePlayerDeath();
        return;
    }
    
    // Vérifier si le joueur a un tour bonus
    if(normalizeBonusTurnValue(player.bonusTurn) > 0){
        player.bonusTurn = normalizeBonusTurnValue(player.bonusTurn) - 1;
        const remaining = normalizeBonusTurnValue(player.bonusTurn);
        log(`Tour bonus utilisé : pas d'attaque ennemie.${remaining > 0 ? ` (${remaining} restant${remaining > 1 ? 's' : ''})` : ''}`);
        saveUpdate();
        return;
    }
    // Laisse finir l'animation de l'action du joueur (attaque, sort, soin, objet) avant la réplique de l'adversaire.
    currentTurn = 'enemy'; // bloque le plateau pendant l'animation
    updateStats();
    afterPlayerAnimations(() => {
        if(gameState.combatState !== 'active') return;
        if(player.hp <= 0){ handlePlayerDeath(); return; }
        const burn = advanceBiomeTurn();
        if(burn > 0){ applyDamage(player, burn); log(`Cases brûlantes : -${burn} PV.`); updateStats(); }
        if(player.hp <= 0){ handlePlayerDeath(); return; }
        if(!applyDuelRulesBeforeEnemyTurn()) return;
        enemyTurn();
    });
}

// Délai minimal après une action du joueur, puis attente de la disparition des overlays d'animation du plateau.
const PLAYER_ACTION_PAUSE_MS = 500;   // × vitesse des animations (gameOptions.js)
function afterPlayerAnimations(callback){
    const waitOverlay = () => {
        if(document.querySelector('#board .attack-overlay')) setTimeout(waitOverlay, 100);
        else setTimeout(callback, 250 * animationFactor());
    };
    setTimeout(waitOverlay, PLAYER_ACTION_PAUSE_MS * animationFactor());
}

// Duel contre Fengmeng (duel.js) : avant chacun de ses tours normaux, les pièges restants se déclenchent,
// puis il peut piéger une nouvelle zone et préparer un tir rapide. Renvoie false si le héros y succombe.
function applyDuelRulesBeforeEnemyTurn(){
    const duel = enemy?.duel;
    if(!duel) return true;
    enemy.duelTurns = (enemy.duelTurns || 0) + 1;
    const plan = duelTurnPlan(duel, enemy.duelTurns, getTrappedCells().length);
    if(plan.detonate > 0){
        const dmg = applyDamage(player, trapDamage(plan.detonate, enemy.attack));
        log(`Les pièges de ${enemy.name} se déclenchent : ${plan.detonate} case(s) encore piégée(s), ${dmg} dégâts !`);
        playSfx('weaponHit');
    } else if(getTrappedCells().length === 0 && enemy.duelTrapLaid){
        log('Vous avez désamorcé tous les pièges !');
    }
    enemy.duelTrapLaid = false;
    setTrappedCells([]);
    updateStats();
    if(player.hp <= 0){
        handlePlayerDeath();
        return false;
    }
    if(plan.layTrap){
        setTrappedCells(pickTrapZone(boardSize));
        enemy.duelTrapLaid = true;
        log(`${enemy.name} piège une zone du plateau : détruisez ses tuiles avant son prochain tour, sinon chaque case piégée vous blessera.`);
    }
    if(plan.rapidShot){
        addBonusTurn(enemy, 1);
        log(`Tir rapide : ${enemy.name} encoche deux flèches à la fois, il rejouera !`);
    }
    return true;
}

// Règles de duel au début du combat : l'Archer Miroir copie les techniques du héros ; le héros peut entrer affaibli.
function applyDuelRulesAtCombatStart(){
    const duel = enemy?.duel;
    if(!duel) return;
    enemy.duelTurns = 0;
    enemy.duelTrapLaid = false;
    if(duel.mirror){
        const copy = mirrorLoadout(player, getSpellsByClass(player.class, enemy.level));
        if(copy.spells.length) enemy.spells = copy.spells;
        if(copy.weapon) enemy.weapon = copy.weapon;
        if(copy.playerClass) enemy.playerClass = copy.playerClass;
        log(`${enemy.name} imite vos techniques : ${enemy.spells.map(sp => sp.name).join(', ') || 'aucun sort'}${copy.weapon ? `, ${copy.weapon.name}` : ''}.`);
    }
    if(duel.heroHpPct){
        player.hp = Math.min(player.hp, weakenedHp(player.maxHp, duel.heroHpPct));
        log(enemy.arena
            ? `L'épreuve commence durement : vous entrez avec ${player.hp}/${player.maxHp} PV.`
            : `Épuisé par neuf soleils, vous entrez dans le duel avec ${player.hp}/${player.maxHp} PV.`);
    }
}

export function enemyTurn(){
    if(gameState.combatState !== 'active'){
        return;
    }

    if(enemy.hp<=0){ handleEnemyDefeated(); return; }

    if((enemy.statusEffects?.poisoned || 0) > 0) {
        const poisonDmg = Math.max(1, Math.floor(enemy.statusEffects.poisonDamage || 1));
        applyDamage(enemy, poisonDmg);
        enemy.statusEffects.poisoned--;
        log(`Poison: ${enemy.name} subit ${poisonDmg} dégâts.`);
        if(enemy.statusEffects.poisoned <= 0) {
            delete enemy.statusEffects.poisoned;
            delete enemy.statusEffects.poisonDamage;
            log(`Le poison sur ${enemy.name} se dissipe.`);
        }
        if(enemy.hp <= 0) {
            handleEnemyDefeated();
            return;
        }
    }

    if((enemy.statusEffects?.stunned || 0) > 0) {
        enemy.statusEffects.stunned--;
        log(`${enemy.name} est étourdi et perd son tour.`);
        currentTurn = 'enemy';
        updateStats();
        setTimeout(() => {
            finishEnemyTurn();
        }, 500);
        return;
    }

    currentTurn = 'enemy';
    // show turn change before action
    updateStats();
    
    // Utiliser la nouvelle IA pour prendre une décision
    const decision = makeDecision();
    
    // Log la décision pour debug
    logDecision(decision);
    
    // Afficher la réflexion de l'ennemi
    log(`${enemy.name} réfléchit... (${decision.reason})`);
    
    // Attendre le temps de réflexion avant d'agir
    setTimeout(()=>{
        if(gameState.combatState !== 'active'){
            return;
        }

        // Exécuter l'action choisie par l'IA
        if(decision.action === 'spell'){
            const spell = decision.data.spell;
            logActiveAction(`lance le sort ${spell.name}`);

            if(!canEntityCastSpell(enemy, spell)) {
                log(`${enemy.name} n'a plus assez de mana pour ${spell.name}.`);
                finishEnemyTurn();
                return;
            }

            consumeSpellMana(enemy, spell);
            applyStandardSpellEffects(enemy, player, spell, false);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else if(decision.action === 'weapon'){
            logActiveAction(`utilise l'arme ${enemy.weapon.name}`);
            enemy.combatPoints -= enemy.weapon.actionPoints;
            const weakenedAmount = Math.max(0, Math.floor(enemy.statusEffects?.weakenedAmount || 0));
            const effectiveAttack = Math.max(0, (enemy.attack || 0) - weakenedAmount);
            let dmg = enemy.weapon.damage + effectiveAttack;
            // Défense du joueur
            dmg = Math.max(1, dmg - (player.defense || 0));
            if(player.damageReduction > 0) {
                dmg = Math.max(1, Math.floor(dmg * (1 - player.damageReduction)));
            }
            dmg = clampEnemyAttackDamage(dmg, enemy);
            applyDamage(player, dmg);
            playSfx('weaponHit', { isPlayer: false });
            const icon = getWeaponIcon(enemy.weapon.type);
            showCombatAnimation({ icon, title: enemy.weapon.name, damage: `-${dmg} dégâts`, source: enemy.name, target: '→ Vous' }, false);
            log(`${icon} ${enemy.name} utilise ${enemy.weapon.name} ! ${dmg} dégâts.`);
            
            // Vérifier l'état après l'action
            finishEnemyTurn();
            
        } else {
            // L'ennemi joue sur le plateau
            logActiveAction(`joue sur le plateau${decision.isStupid ? ' (mouvement hasardeux)' : ''}`);
            if(decision.randomBoardMove) {
                enemyMakeRandomMove();
            } else {
                enemyMakeMove();
            }
            // Pas besoin d'appeler finishEnemyTurn ici car checkMatches le fera
            // après avoir traité tous les combos
        }
    }, decision.thinkingTime);
}

// Fonction pour terminer le tour de l'ennemi
export function finishEnemyTurn(){
    if(gameState.combatState !== 'active'){
        return;
    }

    if(player.hp<=0){
        handlePlayerDeath();
        return;
    }
    
    // Vérifier si l'ennemi a un tour bonus
    if(normalizeBonusTurnValue(enemy.bonusTurn) > 0){
        enemy.bonusTurn = normalizeBonusTurnValue(enemy.bonusTurn) - 1;
        const remaining = normalizeBonusTurnValue(enemy.bonusTurn);
        log(`L'ennemi a un tour bonus et rejoue !${remaining > 0 ? ` (${remaining} restant${remaining > 1 ? 's' : ''})` : ''}`);
        updateStats();
        saveUpdate();
        // L'ennemi rejoue immédiatement
        setTimeout(() => {
            enemyTurn();
        }, 1000);
    } else {
        if((enemy.statusEffects?.confused || 0) > 0) {
            enemy.statusEffects.confused--;
            if(enemy.statusEffects.confused <= 0) {
                delete enemy.statusEffects.confused;
                log(`La confusion de ${enemy.name} se dissipe.`);
            }
        }
        if((enemy.statusEffects?.weakened || 0) > 0) {
            enemy.statusEffects.weakened--;
            if(enemy.statusEffects.weakened <= 0) {
                delete enemy.statusEffects.weakened;
                delete enemy.statusEffects.weakenedAmount;
                log(`L'affaiblissement de ${enemy.name} prend fin.`);
            }
        }
        if((enemy.statusEffects?.itemBlocked || 0) > 0) {
            enemy.statusEffects.itemBlocked--;
            if(enemy.statusEffects.itemBlocked <= 0) {
                delete enemy.statusEffects.itemBlocked;
                log(`Le blocage d'objets de ${enemy.name} se dissipe.`);
            }
        }

        // Tick des effets de durée du joueur
        if(player.regenEffect && player.regenEffect.turnsLeft > 0) {
            player.hp = Math.min(player.maxHp, player.hp + player.regenEffect.hp);
            log(`Régénération : +${player.regenEffect.hp} HP.`);
            player.regenEffect.turnsLeft--;
            if(player.regenEffect.turnsLeft <= 0) {
                player.regenEffect = null;
                log(`L'effet de régénération se dissipe.`);
            }
        }
        if(player.manaMultiplier && player.manaMultiplier.turnsLeft > 0) {
            player.manaMultiplier.turnsLeft--;
            if(player.manaMultiplier.turnsLeft <= 0) {
                player.manaMultiplier = null;
                log(`L'effet du Déferlement du Qi se dissipe.`);
            }
        }
        if((player.statusEffects?.barrier || 0) > 0) {
            player.statusEffects.barrier--;
            if(player.statusEffects.barrier <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.barrierDefense || 0));
                player.defense = Math.max(0, (player.defense || 0) - bonus);
                delete player.statusEffects.barrier;
                delete player.statusEffects.barrierDefense;
                log(`Rempart de Jade se dissipe (-${bonus} défense).`);
            }
        }
        if((player.statusEffects?.stoneskin || 0) > 0) {
            player.statusEffects.stoneskin--;
            if(player.statusEffects.stoneskin <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.stoneskinDefense || 0));
                player.defense = Math.max(0, (player.defense || 0) - bonus);
                delete player.statusEffects.stoneskin;
                delete player.statusEffects.stoneskinDefense;
                log(`Peau de Jade se dissipe (-${bonus} défense).`);
            }
        }
        if((player.statusEffects?.enraged || 0) > 0) {
            player.statusEffects.enraged--;
            if(player.statusEffects.enraged <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.enragedBonus || 0));
                player.attack = Math.max(0, (player.attack || 0) - bonus);
                delete player.statusEffects.enraged;
                delete player.statusEffects.enragedBonus;
                log(`Fureur des Steppes se dissipe (-${bonus} attaque).`);
            }
        }
        if((player.statusEffects?.strength || 0) > 0) {
            player.statusEffects.strength--;
            if(player.statusEffects.strength <= 0) {
                const bonus = Math.max(0, Math.floor(player.statusEffects.strengthBonus || 0));
                player.attack = Math.max(0, (player.attack || 0) - bonus);
                delete player.statusEffects.strength;
                delete player.statusEffects.strengthBonus;
                log(`Force du Tigre se dissipe (-${bonus} attaque).`);
            }
        }
        if((player.statusEffects?.reflectDamage || 0) > 0) {
            player.statusEffects.reflectDamage--;
            if(player.statusEffects.reflectDamage <= 0) {
                delete player.statusEffects.reflectDamage;
                delete player.statusEffects.reflectDamagePercent;
                log(`Miroir de Bronze se dissipe.`);
            }
        }
        if((player.statusEffects?.counterOnBlock || 0) > 0) {
            player.statusEffects.counterOnBlock--;
            if(player.statusEffects.counterOnBlock <= 0) {
                delete player.statusEffects.counterOnBlock;
                delete player.statusEffects.counterOnBlockDmg;
                log(`Riposte du Garde se dissipe.`);
            }
        }
        if((player.statusEffects?.immunityEffects || 0) > 0) {
            player.statusEffects.immunityEffects--;
            if(player.statusEffects.immunityEffects <= 0) {
                delete player.statusEffects.immunityEffects;
                log(`L'immunité aux effets négatifs se dissipe.`);
            }
        }
        if((player.statusEffects?.drainOnHit || 0) > 0) {
            player.statusEffects.drainOnHit--;
            if(player.statusEffects.drainOnHit <= 0) {
                delete player.statusEffects.drainOnHit;
                delete player.statusEffects.drainOnHitAmount;
                log(`L'effet des Flèches Sifflantes se dissipe.`);
            }
        }
        if((player.statusEffects?.manaShield?.turns || 0) > 0) {
            player.statusEffects.manaShield.turns--;
            if(player.statusEffects.manaShield.turns <= 0) {
                delete player.statusEffects.manaShield;
                log(`Le bouclier de mana se dissipe.`);
            }
        }
        // Objets rechargeables épuisés : le compte à rebours avance d'un tour ; à 0 ils sont de nouveau pleins.
        tickReusableRecharge(player).forEach(it => log(`${it.name} est rechargé.`));
        // Tour suivant : joueur (définir le tour avant saveUpdate pour que les boutons dépendants du tour soient corrects)
        currentTurn = 'player';
        updateStats();
        saveUpdate();
        updateStats(); // Pour mettre à jour le liseré
        restartSuggestionTimer();
    }
}

// -------------------------------------
// progression
export function handleEnemyDefeated(){
    log(`${enemy.name} est vaincu !`);
    player.bossLossStreak = recordVictory();
    playSfx('victory');
    
    // Calculer et mettre en attente l'XP (application en fin de combat)
    const xpGain = calculateXPGain(enemy, player.level);
    queueCombatXP(xpGain);
    log(`Vous gagnez ${xpGain} XP !`);

    // Pièces d'or : base liée au niveau de l'ennemi + part aléatoire + multiplicateur du profil de l'ennemi
    const enemyLvl = enemy.level || player.level || 1;
    const goldMult = enemy.dropProfile?.goldMult ?? 1.0;
    const goldBase = Math.round(enemyLvl * 3 * goldMult);
    const goldBonus = Math.floor(Math.random() * (enemyLvl * 2 + 5)) + 1;
    const goldEarned = goldBase + goldBonus;
    player.gold = (player.gold || 0) + goldEarned;
    combatRewards.gold = goldEarned;
    log(`Vous ramassez ${goldEarned} pièce${goldEarned > 1 ? 's' : ''} d'or !`);

    // Prime de l'Arène des Mille Flèches (arena.js) : or et XP en plus, croissants avec le cercle et le combat,
    // et grosse prime quand un cercle est terminé pour la première fois (son maître vaincu : `firstClear`).
    if(enemy.arena) {
        const { tier: tierId, wave } = enemy.arena;
        const bonus = arenaRewardBonus(tierId, wave, enemyLvl);
        player.gold += bonus.gold;
        combatRewards.gold += bonus.gold;
        queueCombatXP(bonus.xp);
        log(`Prime d'arène (combat ${wave}/${enemy.arena.waves}) : +${bonus.gold} or, +${bonus.xp} XP !`);
        const tier = arenaTier(tierId);
        if(tier && enemy.arena.firstClear) {
            player.gold += tier.clearGold;
            combatRewards.gold += tier.clearGold;
            queueCombatXP(tier.clearXp);
            log(`${tier.name} terminé pour la première fois : +${tier.clearGold} or, +${tier.clearXp} XP !`);
        }
    }

    // Drop de l'objet de l'ennemi (si il en avait un)
    if(enemy.inventoryItem) {
        player.inventory.push({...enemy.inventoryItem, applied: false});
        normalizeActiveInventoryIndex();
        combatRewards.items.push(enemy.inventoryItem.name);
        const rarityEmoji = getRarityIcon(enemy.inventoryItem.rarity);
        log(`${rarityEmoji} ${enemy.name} portait : ${enemy.inventoryItem.name} !`);
        if(enemy.inventoryItem.type === 'artifact') {
            applyArtifactEffects(player);
            log(`${enemy.inventoryItem.description}`);
        }
    }

    // Chance de drop selon le profil de l'ennemi (défaut : 60%)
    const baseDropChance = enemy.dropProfile?.dropChance ?? 0.6;
    const dropChance = Math.random();
    if(dropChance < baseDropChance) {
        // Répartition arme/objet selon le profil de l'ennemi (défaut : 30% arme)
        const weaponChance = enemy.dropProfile?.weaponChance ?? 0.3;
        const itemOrWeapon = Math.random();
        
        if(itemOrWeapon >= weaponChance) {
            // chance d'obtenir un objet (1 - weaponChance)
            const droppedItem = getRandomItem(player.level);
            if(droppedItem) {
                player.inventory.push({...droppedItem, applied: false});
                normalizeActiveInventoryIndex();
                combatRewards.items.push(droppedItem.name);
                const rarityEmoji = getRarityIcon(droppedItem.rarity);
                log(`${rarityEmoji} Vous obtenez : ${droppedItem.name} !`);
                // Appliquer immédiatement les effets des artefacts
                if(droppedItem.type === "artifact") {
                    applyArtifactEffects(player);
                    log(`${droppedItem.description}`);
                }
            }
        } else {
            // chance d'obtenir une arme (weaponChance)
            const availableWeapons = getAvailableWeapons(player.level + 2).filter(
                w => w.minLevel >= Math.max(1, player.level - 3)
            );
            if(availableWeapons.length > 0) {
                const randomWeapon = availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
                // Vérifier si le joueur possède déjà cette arme
                if(!player.weapons.some(w => w.id === randomWeapon.id)) {
                    player.weapons.push(randomWeapon);
                    combatRewards.weapons.push(randomWeapon.name);
                    // Mettre à jour la liste des armes disponibles du joueur
                    updateAvailableWeapons();
                    const icon = getWeaponIcon(randomWeapon.type);
                    log(`${icon} Vous obtenez : ${randomWeapon.name} !`);
                } else {
                    // Arme déjà possédée : convertir en or
                    const bonusGold = Math.floor(randomWeapon.minLevel * 2 + 5);
                    player.gold = (player.gold || 0) + bonusGold;
                    combatRewards.gold += bonusGold;
                    log(`Arme déjà possédée, convertie en ${bonusGold} pièce${bonusGold > 1 ? 's' : ''} d'or.`);
                }
            }
        }
    } else {
        log(`L'ennemi ne laisse rien derrière lui...`);
    }
    
    const xpResult = applyCombatXPAtEnd();
    if(xpResult.leveledUp) {
        log(`Niveau ${player.level} atteint ! +${xpResult.maxHpGained} HP max, +${xpResult.hpRecovered} HP de recuperation.`);
        if(xpResult.levelsGained > 1) {
            log(`Vous avez gagné ${xpResult.levelsGained} niveaux d'un coup !`);
        }
        updateAvailableSpells();
        updateAvailableWeapons();
        updateInventoryTab();
        showAttributeMenu();
    } else {
        log(`Progression: ${player.xp}/${player.xpToNextLevel} XP`);
    }

    if(enemy.isBoss) {
        const bossTier = Math.max(5, Math.floor(enemy.bossTier || enemy.level || 5));
        if(!Array.isArray(player.defeatedBossTiers)) {
            player.defeatedBossTiers = [];
        }
        if(!player.defeatedBossTiers.includes(bossTier)) {
            player.defeatedBossTiers.push(bossTier);
            player.defeatedBossTiers.sort((a, b) => a - b);
        }
        if(player.pendingBoss && player.pendingBoss.tier === bossTier) {
            player.pendingBoss = null;
        }
        log(`Boss du palier ${bossTier} vaincu !`);
    }

    combatHooks.onVictory?.();
    saveUpdate();
    
    // Marquer le combat comme terminé
    gameState.combatState = 'finished';

    // Notifier le tutoriel que l'ennemi est vaincu
    tutorialCallbacks.onEnemyDefeated?.();

    showEndCombatAnimation(true);
}

export function grantComboMasteryRewards(xpAmount = 25){
    queueCombatXP(xpAmount);
    return xpAmount;
}

export function grantBigMatchXP(len){
    return queueCombatXP(bigMatchXpFor(len));
}

export function grantManaGeneratedXP(manaAmount){
    const safeMana = Math.max(0, Math.floor(manaAmount || 0));
    if(safeMana <= 0) return { xpGained: 0, leveledUp: false, levelsGained: 0 };

    queueCombatXP(safeMana);

    return {
        xpGained: safeMana,
        leveledUp: false,
        levelsGained: 0
    };
}

// HUD permanent : niveau, XP actuelle, XP du prochain niveau et progression.
export function updateLevelHud(){
    const hud = document.getElementById('level-hud');
    if(!hud) return;
    const max = player.level >= MAX_LEVEL;
    const pct = getXPProgress(player);
    hud.querySelector('.level-hud-level').textContent = `Niv. ${player.level}`;
    hud.querySelector('.level-hud-xp').textContent = max ? `${player.xp} XP (max)` : `${player.xp} / ${player.xpToNextLevel} XP`;
    hud.querySelector('.level-hud-bar i').style.width = `${pct}%`;
    hud.querySelector('.level-hud-pct').textContent = max ? '' : `${pct}%`;
    const pts = player.unspentLevelPoints || 0;
    hud.title = max ? 'Niveau maximum atteint' : `Niveau ${player.level} : ${getXPToNextLevel(player)} XP restants avant le niveau ${player.level + 1}`
        + (pts > 0 ? ` · ${pts} point(s) d'attribut à dépenser` : '');
    hud.classList.toggle('has-points', pts > 0);
}
if(typeof window !== 'undefined' && typeof setInterval === 'function'){
    setInterval(() => { if(!document.hidden) updateLevelHud(); }, 500);   // inutile (et coûteux sur vieil appareil) onglet masqué
}

function renderLevelUpHud(){
    const info = document.getElementById('levelup-progress');
    if(!info) return;
    const remaining = getXPToNextLevel(player);
    info.innerHTML = player.level >= MAX_LEVEL
        ? `Niveau ${player.level} (maximum) · ${player.xp} XP`
        : `Niveau ${player.level} · ${player.xp} / ${player.xpToNextLevel} XP · ${getXPProgress(player)} % vers le niveau ${player.level + 1} (${remaining} XP restants)`;
}

function buildAttributeCards(){
    const grid = document.getElementById('levelup-attributes');
    if(!grid) return;
    grid.innerHTML = ATTRIBUTE_ORDER.map(attr => {
        const d = describeAttributeChoice(player, attr);
        return `<div class="attribute-card attr-${d.color}" data-attr="${attr}" role="button" tabindex="0">
            <div class="attr-icon">${svgIcon(d.icon)}</div>
            <div class="attr-name">${d.name} <span class="attr-points">(${d.points} → ${d.nextPoints})</span></div>
            <div class="attr-description"><ul>${d.lines.map((l, i) => `<li>${i === 1 ? manaIcon(d.color) + ' ' : ''}${l}</li>`).join('')}</ul></div>
        </div>`;
    }).join('');
}

export function showAttributeMenu(){
    if((player.unspentLevelPoints || 0) <= 0) return;

    // Afficher la modale de montée de niveau
    const modal = document.getElementById('levelup-modal');
    const newLevelSpan = document.getElementById('new-level');
    const subtitle = modal ? modal.querySelector('.levelup-subtitle') : null;
    
    if(!modal || !newLevelSpan) {
        console.error('Modale de montée de niveau introuvable');
        return;
    }
    
    newLevelSpan.textContent = player.level;
    if(subtitle) {
        const remainingPoints = player.unspentLevelPoints || 0;
        subtitle.textContent = remainingPoints > 1
            ? `Choisissez un attribut à améliorer (${remainingPoints} points restants). Chaque point améliore une statistique ET la couleur de mana associée.`
            : 'Choisissez un attribut à améliorer. Chaque point améliore une statistique ET la couleur de mana associée.';
    }
    renderLevelUpHud();
    buildAttributeCards();
    modal.style.display = 'flex';

    modal.querySelectorAll('.attribute-card').forEach(card => {
        const choose = () => {
            const attr = card.dataset.attr;
            if(!attr) return;
            selectAttribute(attr);
            if((player.unspentLevelPoints || 0) <= 0) {
                modal.style.display = 'none';
            } else {
                showAttributeMenu();
            }
        };
        card.addEventListener('click', choose);
        card.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); choose(); } });
    });
}

function selectAttribute(attr) {
    const attrNames = {
        'strength': 'Battle',
        'agility': 'Defense',
        'intelligence': 'Cunning',
        'stamina': 'Stamina',
        'morale': 'Morale'
    };
    
    if((player.unspentLevelPoints || 0) <= 0) return;

    player.attributes[attr]++;
    player.unspentLevelPoints = Math.max(0, (player.unspentLevelPoints || 0) - 1);
    applyAttributeBonus(attr);
    const d = describeAttributeChoice(player, attr);
    log(`+1 ${attrNames[attr]} : ${d.statTitle} +1, mana ${d.colorLabel} ${3 + (player.attributes[attr])} par match de 3`);
    updateLevelHud();
    updatePlayerStatsTab();
    saveUpdate();
}

// Menu « Réinitialiser les points » (onglet Stats) : rend tous les points d'attribut dépensés, hors combat, puis ouvre la répartition.
export function resetAttributePoints(){
    if(gameState.combatState === 'active') {
        log("Impossible de réinitialiser les points pendant un combat.");
        return { ok: false, refunded: 0 };
    }
    const { refunded } = respecAttributes(player);
    if(refunded <= 0) return { ok: false, refunded: 0 };
    clampManaToCaps(player);
    log(`Points réinitialisés : ${refunded} point(s) d'attribut à répartir.`);
    updateLevelHud();
    updateStats();
    updatePlayerStatsTab();
    saveUpdate();
    showAttributeMenu();
    return { ok: true, refunded };
}

export function applyAttributeBonus(attr){
    switch(attr){
        case "strength":
            player.attack += 1;
            break;
        case "agility":
            player.defense = (player.defense || 0) + 1;
            break;
        case "intelligence":
            // L'effet principal reste linéaire (v) sur la puissance magique.
            break;
        case "stamina":
            player.maxHp += 1;
            player.hp = Math.min(player.maxHp, player.hp + 1);
            break;
        case "morale":
            player.attack += 1;
            break;
    }
    clampManaToCaps(player);
}

// -------------------------------------
// sorts
const HIGH_SPELL_FROM_LEVEL = 15;

function getUnlockedSpellCap(level) {
    const safeLevel = Math.max(1, Math.floor(level || 1));
    return Math.max(0, safeLevel - 1);
}

function buildUnlockedSpellsList(spells, level) {
    const unlockCap = getUnlockedSpellCap(level);
    if(unlockCap <= 0) return [];

    const uniqueById = [];
    const seenIds = new Set();
    for(const spell of spells || []) {
        if(!spell || !spell.id || seenIds.has(spell.id)) continue;
        seenIds.add(spell.id);
        uniqueById.push(spell);
    }

    uniqueById.sort((a, b) => {
        const levelA = Math.max(1, Math.floor(a?.minLevel || 1));
        const levelB = Math.max(1, Math.floor(b?.minLevel || 1));
        if(levelA !== levelB) return levelA - levelB;
        return String(a.id).localeCompare(String(b.id));
    });

    // Les sorts de haut niveau (multimana, niveau > 15) et les sorts avancés (3 à 5 couleurs, dès le niveau 8) sont débloqués dès leur
    // niveau, hors plafond du nombre de sorts : sinon, triés après les sorts de niveau inférieur, ils restaient hors de portée jusqu'au niveau 38+.
    const isFreeUnlock = s => s.type === 'advanced' || (s.minLevel || 1) > HIGH_SPELL_FROM_LEVEL;
    const early = uniqueById.filter(s => !isFreeUnlock(s)).slice(0, unlockCap);
    const free = uniqueById.filter(isFreeUnlock);
    return [...early, ...free].sort((a, b) => Math.max(1, Math.floor(a?.minLevel || 1)) - Math.max(1, Math.floor(b?.minLevel || 1)) || String(a.id).localeCompare(String(b.id)));
}

export function updateAvailableSpells(){
    // Si le joueur a une classe, inclure les sorts de classe
    let allAvailableSpells = [...getSpellsByLevel(player.level)];
    
    if(player.class) {
        import('./classes.js').then(module => {
            const classSpells = module.getClassSpells(player.class, player.level);
            allAvailableSpells = [...allAvailableSpells, ...classSpells];
            player.availableSpells = buildUnlockedSpellsList(allAvailableSpells, player.level);
            updateActiveSpells();
        });
    } else {
        player.availableSpells = buildUnlockedSpellsList(allAvailableSpells, player.level);
        updateActiveSpells();
    }
}

function updateActiveSpells() {
    // garder seulement les sorts actifs valides
    player.activeSpells = player.activeSpells.filter(sp => 
        player.availableSpells.some(avail => avail.id === sp.id)
    );
    // si moins de 4 sorts actifs, en ajouter automatiquement
    if(player.activeSpells.length < 4){
        for(const sp of player.availableSpells){
            if(!player.activeSpells.some(active => active.id === sp.id)){
                player.activeSpells.push(sp);
                if(player.activeSpells.length >= 4) break;
            }
        }
    }
    // maintenir la compatibilité avec l'ancien code
    player.spells = player.activeSpells;
}

export function createSpellButtons(){
    const container=document.getElementById('spell-buttons');
    if(!container) return;
    hideSpellTooltip();
    container.innerHTML="";
    player.activeSpells.forEach(sp=>{
        const btn=document.createElement('div');
        btn.className = 'enemy-spell-item';
        btn.tabIndex = 0;
        const damageText = sp.dmg ? ` - ${sp.dmg} dmg` : '';
        const healText = sp.heal ? ` - ${sp.heal} HP` : '';
        
        // Gérer l'affichage du coût (simple ou multiple)
        const costHTML = spellCostHtml(sp);
        const hasEnoughMana = canEntityCastSpell(player, sp);
        markMultiManaSpell(btn, sp);
        
        btn.innerHTML = `
            <div class="spell-name">${sp.name}</div>
            <div class="spell-cost">${costHTML}${damageText}${healText}</div>
        `;
        if(player.level<sp.minLevel || !hasEnoughMana) {
            btn.classList.add('disabled');
            btn.tabIndex = -1;
        } else {
            btn.onclick=()=>castSpell(sp.id);
            btn.onkeydown=(event)=>{
                if(event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    castSpell(sp.id);
                }
            };
        }

        const showDetails = () => showSpellTooltip(btn, sp);
        const hideDetails = () => hideSpellTooltip();
        bindTooltip(btn, showDetails, hideDetails);

        container.appendChild(btn);
    });
    updateSpellsTab();
}

// Infobulle d'un sort / d'une arme / d'un objet : au survol à la souris, au focus clavier, ou par appui long au doigt
// (un appui bref sert à utiliser l'élément et ne doit pas afficher l'infobulle).
export const TOOLTIP_LONG_PRESS_MS = 400;
function bindTooltip(el, show, hide) {
    let timer = null;
    let shownByPress = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('pointerenter', e => { if(e.pointerType === 'mouse') show(); });
    el.addEventListener('pointerleave', e => { cancel(); if(e.pointerType === 'mouse') hide(); });
    el.addEventListener('pointerdown', e => {
        if(e.pointerType === 'mouse') return;
        cancel();
        timer = setTimeout(() => { timer = null; shownByPress = true; show(); }, TOOLTIP_LONG_PRESS_MS);
    });
    // Relâcher un appui long ne doit pas utiliser l'élément : on avale le clic qui suit.
    el.addEventListener('click', e => {
        if(!shownByPress) return;
        shownByPress = false;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    ['pointerup', 'pointercancel'].forEach(type => el.addEventListener(type, () => { cancel(); hide(); }));
    el.addEventListener('focus', () => { if(el.matches?.(':focus-visible')) show(); });
    el.addEventListener('blur', () => { cancel(); hide(); });
}

function getSpellTooltipHtml(spell) {
    let effectText = 'Aucun effet';
    if(spell.effect) {
        effectText = spell.description || 'Effet spécial';
    } else if(spell.dmg && spell.heal) {
        effectText = `Inflige ${spell.dmg} ${svgIcon('skull')} et soigne ${spell.heal} ${svgIcon('heart')}`;
    } else if(spell.dmg) {
        effectText = `Inflige ${spell.dmg} ${svgIcon('skull')}`;
    } else if(spell.heal) {
        effectText = `Soigne ${spell.heal} ${svgIcon('heart')}`;
    }

    return `<div class="spell-tooltip-line">${effectText}</div>`;
}

function getWeaponTooltipHtml(weapon) {
    let html = `<div class="spell-tooltip-title">${weapon.name}</div>`;
    html += `<div class="spell-tooltip-line">${weapon.damage} ${svgIcon('skull')} • ${weapon.actionPoints} ${svgIcon('arrow')}</div>`;
    if(weapon.description) html += `<div class="spell-tooltip-line">${weapon.description}</div>`;
    if(weapon.biome) html += `<div class="spell-tooltip-line">Bonus de dégâts en ${BIOME_LABELS[weapon.biome]}${enemy?.biome === weapon.biome ? ' (actif)' : ''}</div>`;
    return html;
}

function showWeaponTooltip(button, weapon) {
    if(!button || !weapon) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getWeaponTooltipHtml(weapon);
    tooltip.classList.add('visible');
    placeTooltip(tooltip, button, 260);
}

function getItemTooltipHtml(item, options = {}) {
    if(!item) return '<div class="spell-tooltip-line">Objet inconnu</div>';

    const isEnemyItem = options.isEnemyItem === true;
    const ownerLabel = isEnemyItem ? 'ennemi' : 'allié';
    const typeLabel = item.type === 'artifact'
        ? 'Relique passive'
        : (item.type === 'consumable' ? 'Consommable' : item.type === 'reusable' ? 'Objet rechargeable' : 'Objet');
    const actionPoints = (item.type === 'consumable' || item.type === 'reusable') ? (item.actionPoints || 2) : null;

    let html = `<div class="spell-tooltip-title">${item.name || 'Objet'}</div>`;
    html += `<div class="spell-tooltip-line">Objet ${ownerLabel}</div>`;
    html += `<div class="spell-tooltip-line">Type: ${typeLabel}</div>`;
    if(actionPoints !== null) {
        html += `<div class="spell-tooltip-line">Coût: ${actionPoints} PA</div>`;
    }
    if(item.description) {
        html += `<div class="spell-tooltip-line">${item.description}</div>`;
    }
    if(item.type === 'reusable') {
        html += `<div class="spell-tooltip-line">Charges: ${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle} • ${describeRecharge(item)}</div>`;
    }
    return html;
}

function ensureSpellTooltip() {
    let tooltip = document.getElementById('spell-detail-tooltip');
    if(!tooltip){
        tooltip = document.createElement('div');
        tooltip.id = 'spell-detail-tooltip';
        tooltip.className = 'spell-detail-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

// Place une infobulle au-dessus de l'élément maintenu, à bonne distance : le pouce (ou le doigt) qui appuie dessus ne doit pas
// cacher le contenu. Pas assez de place au-dessus : en dessous, plus bas encore pour dégager le pouce.
const TOOLTIP_GAP_ABOVE = 28;
const TOOLTIP_GAP_BELOW = 72;
function placeTooltip(tooltip, targetEl, tooltipWidth) {
    const rect = targetEl.getBoundingClientRect();
    const margin = 10;
    const height = tooltip.offsetHeight || 100;
    const left = Math.min(
        window.innerWidth - tooltipWidth - margin,
        Math.max(margin, rect.left + (rect.width / 2) - (tooltipWidth / 2))
    );
    let top = rect.top - height - TOOLTIP_GAP_ABOVE;
    if(top < margin) top = Math.min(window.innerHeight - height - margin, rect.bottom + TOOLTIP_GAP_BELOW);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
}

function showSpellTooltip(button, spell) {
    if(!button || !spell) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getSpellTooltipHtml(spell);
    tooltip.classList.add('visible');

    placeTooltip(tooltip, button, 260);
}

function showItemTooltip(button, item, options = {}) {
    if(!button || !item) return;
    const tooltip = ensureSpellTooltip();
    tooltip.innerHTML = getItemTooltipHtml(item, options);
    tooltip.classList.add('visible');

    placeTooltip(tooltip, button, 260);
}

function hideSpellTooltip() {
    const tooltip = document.getElementById('spell-detail-tooltip');
    if(tooltip){
        tooltip.classList.remove('visible');
    }
}

function ensureEnemyNameTooltip() {
    let tooltip = document.getElementById('enemy-name-tooltip');
    if(!tooltip){
        tooltip = document.createElement('div');
        tooltip.id = 'enemy-name-tooltip';
        tooltip.className = 'enemy-name-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

function getEnemyResistanceInsights(enemyEntity) {
    const resistances = enemyEntity?.resistances || {};
    const entries = MANA_COLOR_ORDER
        .filter(color => Number.isFinite(Number(resistances[color])))
        .map(color => ({
            color,
            value: Math.max(0, Number(resistances[color]))
        }));

    if(entries.length === 0) {
        return { weakest: null, strongest: null };
    }

    const sorted = [...entries].sort((a, b) => a.value - b.value);
    return {
        weakest: sorted[0] || null,
        strongest: sorted[sorted.length - 1] || null
    };
}

// Infobulle de l'ennemi : sa force est toujours indiquée ; sa faiblesse (couleur + élément) seulement une fois repérée
// (avantage « Faiblesse repérée » du terrain, prep.weaknessRevealed).
function getEnemyNameTooltipHtml(fullName, enemyEntity) {
    const { weakest, strongest } = getEnemyResistanceInsights(enemyEntity);
    const lines = [`<div class="enemy-tooltip-title">${fullName}</div>`];

    if(strongest) {
        const strongMeta = MANA_COLOR_META[strongest.color];
        const strongPercent = Math.round(strongest.value * 100);
        lines.push(`<div class="enemy-tooltip-row enemy-tooltip-strong">Force : ${manaIcon(strongest.color)} ${strongMeta.name} (${strongPercent}% res.)</div>`);
    }

    if(isWeaknessShown(enemyEntity?.prep)) {
        const weakColor = enemyEntity.weakColor || weakest?.color;
        if(weakColor && MANA_COLOR_META[weakColor]) {
            const element = elementName(weakColor);
            const resist = Number(enemyEntity.resistances?.[weakColor]);
            const percent = Number.isFinite(resist) ? ` (${Math.round(Math.max(0, resist) * 100)}% res.)` : '';
            lines.push(`<div class="enemy-tooltip-row enemy-tooltip-weak">Faiblesse : ${manaIcon(weakColor)} ${element ? `${element} - ` : ''}${MANA_COLOR_META[weakColor].name}${percent}</div>`);
        }
    }

    return lines.join('');
}

// Un clic / toucher sur la carte ou le portrait de l'ennemi affiche son infobulle (faiblesse incluse si elle est repérée),
// qui se referme seule après quelques secondes. Lié une seule fois : le panneau est reconstruit à chaque updateStats.
const ENEMY_TAP_TOOLTIP_MS = 3500;
let enemyTapTimer = null;
function bindEnemyCardTap(enemyDiv){
    if(!enemyDiv || enemyDiv.dataset.tapBound) return;
    enemyDiv.dataset.tapBound = '1';
    enemyDiv.addEventListener('click', () => {
        const nameEl = enemyDiv.querySelector('.enemy-combat-name');
        if(!nameEl) return;
        showEnemyNameTooltip(nameEl, nameEl.dataset.fullName || enemy.name, enemy);
        clearTimeout(enemyTapTimer);
        enemyTapTimer = setTimeout(hideEnemyNameTooltip, ENEMY_TAP_TOOLTIP_MS);
    });
}

function showEnemyNameTooltip(targetEl, fullName, enemyEntity = enemy) {
    if(!targetEl || !fullName) return;
    const tooltip = ensureEnemyNameTooltip();
    tooltip.innerHTML = getEnemyNameTooltipHtml(fullName, enemyEntity);
    tooltip.classList.add('visible');

    placeTooltip(tooltip, targetEl, 250);
}

function hideEnemyNameTooltip() {
    const tooltip = document.getElementById('enemy-name-tooltip');
    if(tooltip){
        tooltip.classList.remove('visible');
    }
}

// mise à jour de l'onglet sorts
export function updateSpellsTab(){
    const activeList = document.getElementById('active-spells-list');
    const availableList = document.getElementById('available-spells-list');
    if(!activeList || !availableList) return;
    
    // sorts actifs
    activeList.innerHTML = '<h3>Sorts actifs (' + player.activeSpells.length + '/4)</h3>';
    if(player.activeSpells.length === 0){
        activeList.innerHTML += '<p><em>Aucun sort équipé</em></p>';
    } else {
        player.activeSpells.forEach(sp => {
            const div = document.createElement('div');
            div.className = 'spell-item active-spell';
            markMultiManaSpell(div, sp);
            const damageText = sp.dmg ? ` • ${sp.dmg} ${svgIcon('skull')}` : '';
            const healText = sp.heal ? ` • ${sp.heal} ${svgIcon('heart')}` : '';
            const effectText = sp.effect ? ` • ${sp.description}` : '';
            
            // Gérer l'affichage du coût
            const costHTML = spellCostHtml(sp);
            
            div.innerHTML = `
                <div class="spell-content">
                    <div class="spell-name">${sp.name}</div>
                    <div class="spell-cost">${costHTML}${damageText}${healText}${effectText}</div>
                </div>
                <div class="spell-action" tabindex="0" onclick="window.unequipSpell('${sp.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.unequipSpell('${sp.id}');}">Retirer</div>
            `;
            activeList.appendChild(div);
        });
    }
    
    // sorts disponibles (non équipés)
    availableList.innerHTML = '';
    const unequipped = player.availableSpells.filter(sp => 
        !player.activeSpells.some(active => active.id === sp.id)
    );
    if(unequipped.length === 0){
        availableList.innerHTML = '<p><em>Tous vos sorts sont équipés</em></p>';
    } else {
        unequipped.forEach(sp => {
            const div = document.createElement('div');
            div.className = 'spell-item available-spell';
            markMultiManaSpell(div, sp);
            const canEquip = player.activeSpells.length < 4;
            const damageText = sp.dmg ? ` • ${sp.dmg} ${svgIcon('skull')}` : '';
            const healText = sp.heal ? ` • ${sp.heal} ${svgIcon('heart')}` : '';
            const effectText = sp.effect ? ` • ${sp.description}` : '';
            
            // Gérer l'affichage du coût
            const costHTML = spellCostHtml(sp);
            
            div.innerHTML = `
                <div class="spell-content">
                    <div class="spell-name">${sp.name}</div>
                    <div class="spell-cost">${costHTML}${damageText}${healText}${effectText}</div>
                </div>
                <div class="spell-action ${canEquip ? '' : 'disabled'}" tabindex="${canEquip ? '0' : '-1'}" aria-disabled="${canEquip ? 'false' : 'true'}" ${canEquip ? `onclick="window.equipSpell('${sp.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.equipSpell('${sp.id}');}"` : ''}>Équiper</div>
            `;
            availableList.appendChild(div);
        });
    }
}

export function equipSpell(spellId){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos sorts pendant le combat !');
        return;
    }
    if(player.activeSpells.length >= 4){
        log('Maximum 4 sorts actifs atteint.');
        return;
    }
    const spell = player.availableSpells.find(s => s.id === spellId);
    if(!spell) return;
    if(player.activeSpells.some(s => s.id === spellId)) return;
    player.activeSpells.push(spell);
    player.spells = player.activeSpells;
    saveUpdate();
    log(`${spell.name} équipé.`);
}

export function unequipSpell(spellId){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos sorts pendant le combat !');
        return;
    }
    player.activeSpells = player.activeSpells.filter(s => s.id !== spellId);
    player.spells = player.activeSpells;
    saveUpdate();
    const spell = player.availableSpells.find(s => s.id === spellId);
    if(spell) log(`${spell.name} retiré.`);
}

// -------------------------------------
// Applique les aptitudes de début de combat pour le joueur et l'ennemi
export function applyStartingAbilities(){
    // Réinitialiser le mana à 0
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
export function getCombatMusicOptions() {
    if(!enemy) return {};
    return enemy.isBoss ? { boss: enemy.name } : { variant: enemy.name };
}

// Fond de la page de combat : teinte et motif du biome (CSS `body[data-combat-biome]` de retro.css).
export function setCombatBackdrop(biome){
    if(typeof document === 'undefined') return;
    if(biome && BIOME_LABELS[biome]) document.body.dataset.combatBiome = biome;
    else delete document.body.dataset.combatBiome;
}

export function newEnemy(selectedEnemy = null){
    enemy = selectedEnemy ? { ...selectedEnemy } : generateRandomEnemy(player.level, spellsCatalog, allWeapons);

    // Ajuster automatiquement la difficulté de l'IA selon le niveau et le profil de l'ennemi
    setAIDifficultyByLevel(enemy.level, player.level, enemy);
    
    // Afficher le niveau de l'ennemi dans les logs
    if (enemy.level > player.level) {
        log(`${enemy.name} (Niveau ${enemy.level}) apparaît ! Il est plus fort que vous !`);
    } else {
        log(`${enemy.name} (Niveau ${enemy.level}) apparaît !`);
    }
    // Réinitialiser le mana de l'ennemi à 0 puis appliquer ses aptitudes
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
    setBiomeRule(ruleForBiome(enemy.biome));
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
        const playerAgility = player.attributes.agility || 0;
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

// -------------------------------------
// Armes
export function updateAvailableWeapons(){
    // Initialiser l'inventaire des armes s'il n'existe pas
    if(!player.weapons) {
        player.weapons = [];
    }
    // Les armes disponibles sont celles que le joueur possède et peut utiliser
    player.availableWeapons = player.weapons.filter(weapon => weapon.minLevel <= player.level);
    
    // Si l'arme équipée n'est plus disponible (niveau trop bas), la retirer
    if(player.equippedWeapon && player.level < player.equippedWeapon.minLevel){
        player.equippedWeapon = null;
    }
}

// Retire ce qui occupe la main gauche ; un bouclier retourne dans l'inventaire (et perd son bonus de défense).
function clearLeftHand(){
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    const previous = player.equipment.leftHand;
    player.equipment.leftHand = null;
    if(previous?.type === 'shield'){
        if(!player.inventory) player.inventory = [];
        player.inventory.push(previous);
        if(previous.defense) player.defense = Math.max(0, (player.defense || 0) - previous.defense);
    }
    return previous;
}

export function equipWeapon(weaponId, hand = 'right'){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos armes pendant le combat !');
        return;
    }
    const weapon = getWeaponById(weaponId);
    if(!weapon){ log('Arme inconnue.'); return; }
    if(player.level < weapon.minLevel){
        log(`Nécessite niveau ${weapon.minLevel} pour équiper ${weapon.name}.`);
        return;
    }
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    if(hand === 'left'){
        if(weapon.twoHanded){ log(`${weapon.name} se manie à deux mains : main droite uniquement.`); return; }
        if(player.equippedWeapon?.twoHanded){ log(`Une arme à deux mains occupe déjà vos deux mains.`); return; }
        if(player.equippedWeapon?.id === weapon.id){ log(`${weapon.name} est déjà en main droite.`); return; }
        clearLeftHand();
        player.equipment.leftHand = weapon;
        saveUpdate();
        log(`${weapon.name} équipée en main gauche.`);
        createWeaponButton();
        return;
    }
    if(weapon.twoHanded && player.equipment.leftHand){
        const freed = clearLeftHand();
        log(`${weapon.name} se manie à deux mains : ${freed.name} est retiré de la main gauche.`);
    }
    if(player.equipment.leftHand?.id === weapon.id) player.equipment.leftHand = null;
    player.equippedWeapon = weapon;
    player.equipment.rightHand = weapon;
    saveUpdate();
    log(`${weapon.name} équipée.`);
    createWeaponButton();
}

export function unequipWeapon(hand = 'right'){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas modifier vos armes pendant le combat !');
        return;
    }
    if(hand === 'left'){
        const left = getLeftHandWeapon();
        if(!left) return;
        player.equipment.leftHand = null;
        saveUpdate();
        log(`${left.name} retirée.`);
        createWeaponButton();
        return;
    }
    if(!player.equippedWeapon) return;
    const weaponName = player.equippedWeapon.name;
    player.equippedWeapon = null;
    if(player.equipment) player.equipment.rightHand = null;
    saveUpdate();
    log(`${weaponName} retirée.`);
    createWeaponButton();
}

export function getLeftHandWeapon(){
    const left = player.equipment?.leftHand;
    return left && left.type !== 'shield' && left.damage !== undefined ? left : null;
}

function appendWeaponButton(container, weapon, hand){
    const btn = document.createElement('div');
    btn.className = 'enemy-spell-item';
    btn.tabIndex = 0;
    const icon = getWeaponIcon(weapon.type);
    btn.innerHTML = `
        <div class="spell-name">${icon} ${weapon.name}</div>
        <div class="spell-cost">${weapon.actionPoints} ${svgIcon('arrow')} - ${weapon.damage} ${svgIcon('skull')}</div>
    `;
    const showDetails = () => showWeaponTooltip(btn, weapon);
    const hideDetails = () => hideSpellTooltip();
    bindTooltip(btn, showDetails, hideDetails);
    if(player.level < weapon.minLevel || player.combatPoints < weapon.actionPoints) {
        btn.classList.add('disabled');
        btn.tabIndex = -1;
        btn.onclick = null;
    } else {
        btn.onclick = () => useWeapon(hand);
        btn.onkeydown = (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                useWeapon(hand);
            }
        };
    }
    container.appendChild(btn);
}

export function createWeaponButton(){
    const container = document.getElementById('weapon-button');
    if(!container) return;
    container.innerHTML = "";

    if(!player.equippedWeapon){
        if(player.availableWeapons && player.availableWeapons.length > 0) {
            container.innerHTML = `
                <div class="enemy-spell-item disabled">
                    <div class="spell-name">Aucune arme equipee</div>
                    <div class="spell-cost">Allez dans l'onglet Armes pour en equiper une.</div>
                </div>
            `;
        }
    } else {
        appendWeaponButton(container, player.equippedWeapon, 'right');
    }
    const leftWeapon = getLeftHandWeapon();
    if(leftWeapon) appendWeaponButton(container, leftWeapon, 'left');

    updateWeaponsTab();
}

// mise à jour de l'onglet armes
export function updateWeaponsTab(){
    const equippedDiv = document.getElementById('equipped-weapon');
    const availableList = document.getElementById('available-weapons-list');
    if(!equippedDiv || !availableList) return;
    
    // Armes équipées (main droite / main gauche)
    equippedDiv.innerHTML = '<h3>Armes équipées</h3>';
    const equippedRow = (weapon, hand) => {
        const div = document.createElement('div');
        div.className = 'weapon-item equipped-weapon';
        div.innerHTML = `
            <span class="weapon-icon">${getWeaponIcon(weapon.type)}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name} <em>(${hand === 'left' ? 'main gauche' : 'main droite'}${weapon.twoHanded ? ', deux mains' : ''})</em></span>
                <span class="weapon-stats">${weapon.damage} ${svgIcon('skull')} • ${weapon.actionPoints} ${svgIcon('arrow')} • Niv. ${weapon.minLevel}${weapon.biome ? ` • Bonus : ${BIOME_LABELS[weapon.biome]}` : ''}</span>
                <span class="weapon-description">${weapon.description}</span>
            </div>
            <button class="weapon-action" onclick="window.unequipWeapon('${hand}')">Retirer</button>
        `;
        equippedDiv.appendChild(div);
    };
    if(!player.equippedWeapon){
        equippedDiv.innerHTML += '<p><em>Aucune arme en main droite</em></p>';
    } else {
        equippedRow(player.equippedWeapon, 'right');
    }
    const equippedLeft = getLeftHandWeapon();
    if(equippedLeft) equippedRow(equippedLeft, 'left');

    // Armes disponibles
    availableList.innerHTML = '';
    const ownedWeapons = player.weapons || [];
    if(ownedWeapons.length === 0){
        availableList.innerHTML = '<div style="padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-top: 15px;"><strong>Aucune arme en votre possession</strong><br>Les armes peuvent être obtenues en gagnant des combats !</div>';
        renderGearList(availableList);
        updateInventoryTab();
        updateItemButton();
        return;
    }
    ownedWeapons.forEach(weapon => {
        const icon = getWeaponIcon(weapon.type);
        const div = document.createElement('div');
        div.className = 'weapon-item available-weapon';
        const locked = player.level < weapon.minLevel;
        if(locked) div.classList.add('is-locked');
        const isRight = player.equippedWeapon?.id === weapon.id;
        const isLeft = getLeftHandWeapon()?.id === weapon.id;
        const isEquipped = isRight || isLeft;
        if(isEquipped) div.classList.add('is-equipped');
        const leftBlocked = weapon.twoHanded || player.equippedWeapon?.twoHanded;
        
        div.innerHTML = `
            <span class="weapon-icon">${icon}</span>
            <div class="weapon-details">
                <span class="weapon-name">${weapon.name}</span>
                <span class="weapon-stats">${weapon.damage} ${svgIcon('skull')} • ${weapon.actionPoints} ${svgIcon('arrow')} • Niv. ${weapon.minLevel}${weapon.biome ? ` • Bonus : ${BIOME_LABELS[weapon.biome]}` : ''}</span>
                <span class="weapon-description">${weapon.description}</span>
            </div>
            <div class="weapon-hand-actions">
                <button class="weapon-action" ${isRight || locked ? 'disabled' : ''} onclick="window.equipWeapon('${weapon.id}', 'right')">${isRight ? 'Main droite' : locked ? `Niv. ${weapon.minLevel} requis` : 'Main droite'}</button>
                ${locked ? '' : `<button class="weapon-action" ${isLeft || isRight || leftBlocked ? 'disabled' : ''} title="${weapon.twoHanded ? 'Arme à deux mains' : ''}" onclick="window.equipWeapon('${weapon.id}', 'left')">${isLeft ? 'Main gauche' : 'Main gauche'}</button>`}
            </div>
        `;
        availableList.appendChild(div);
    });

    renderGearList(availableList);
    updateInventoryTab();
    updateItemButton();
}


// Boucliers (main gauche) et objets rechargeables (objet actif) : affichés dès l'achat,
// non sélectionnables tant que le niveau requis n'est pas atteint.
function renderGearList(container){
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    const inventory = player.inventory || [];
    const wornShield = player.equipment.leftHand?.type === 'shield' ? player.equipment.leftHand : null;
    const shields = inventory.map((it, index) => ({ it, index })).filter(({ it }) => it.type === 'shield');
    const reusables = inventory.map((it, index) => ({ it, index })).filter(({ it }) => it.type === 'reusable');
    if(!wornShield && shields.length === 0 && reusables.length === 0) return;
    const section = document.createElement('div');
    section.innerHTML = '<h3 class="shop-section-title">Boucliers et objets</h3>';
    const row = (it, details, action) => {
        const div = document.createElement('div');
        div.className = 'weapon-item available-weapon' + (action.locked ? ' is-locked' : '') + (action.current ? ' is-equipped' : '');
        div.innerHTML = `
            <span class="weapon-icon">${svgIcon(it.type === 'shield' ? 'shield' : 'bag')}</span>
            <div class="weapon-details">
                <span class="weapon-name">${it.name}</span>
                <span class="weapon-stats">${details}</span>
                <span class="weapon-description">${it.description || ''}</span>
            </div>
            <button class="weapon-action" ${action.disabled ? 'disabled' : ''} onclick="${action.onclick || ''}">${action.label}</button>`;
        section.appendChild(div);
    };
    const shieldStats = it => [it.defense ? `Déf. +${it.defense}` : '', it.absorbDamage ? `absorbe ${it.absorbDamage}` : '', `Niv. ${it.minLevel}`, 'Main gauche'].filter(Boolean).join(' • ');
    if(wornShield) row(wornShield, shieldStats(wornShield), { current: true, label: 'Retirer', onclick: "window.unequipGear('leftHand')" });
    shields.forEach(({ it, index }) => {
        const locked = player.level < (it.minLevel || 1);
        row(it, shieldStats(it), { locked, disabled: locked, label: locked ? `Niv. ${it.minLevel} requis` : 'Équiper', onclick: `window.equipGear(${index})` });
    });
    reusables.forEach(({ it, index }) => {
        const locked = player.level < (it.minLevel || 1);
        const isActive = index === player.activeInventoryIndex;
        const details = `${it.chargesLeft ?? it.chargesPerCycle}/${it.chargesPerCycle} charges • ${describeRecharge(it)} • Niv. ${it.minLevel} • Objet`;
        row(it, details, { locked, current: isActive, disabled: locked || isActive, label: isActive ? 'Objet actif' : locked ? `Niv. ${it.minLevel} requis` : 'Choisir', onclick: `window.setActiveInventoryItem(${index})` });
    });
    container.appendChild(section);
}

export function equipGear(inventoryIndex){
    if(gameState.combatState === 'active'){ log('Vous ne pouvez pas modifier votre équipement pendant le combat !'); return; }
    const it = player.inventory?.[inventoryIndex];
    if(!it || it.type !== 'shield') return;
    if(player.level < (it.minLevel || 1)){ log(`Nécessite niveau ${it.minLevel} pour équiper ${it.name}.`); return; }
    if(!player.equipment) player.equipment = { rightHand: null, leftHand: null, item: null };
    const previous = player.equipment.leftHand;
    const result = equipGearSlot(player, it, 'leftHand');
    if(!result.success){ log(result.message || `${it.name} ne peut pas être équipé.`); return; }
    player.inventory.splice(inventoryIndex, 1);
    if(previous?.type === 'shield'){ player.inventory.push(previous); if(previous.defense) player.defense = Math.max(0, (player.defense || 0) - previous.defense); }
    if(it.defense) player.defense = (player.defense || 0) + it.defense;
    // L'index de l'objet actif suit le décalage de l'inventaire
    if(Number.isInteger(player.activeInventoryIndex) && player.activeInventoryIndex > inventoryIndex) player.activeInventoryIndex--;
    saveUpdate();
    log(`${it.name} équipé.`);
    updateWeaponsTab();
}

export function unequipGear(slot){
    if(gameState.combatState === 'active'){ log('Vous ne pouvez pas modifier votre équipement pendant le combat !'); return; }
    if(slot !== 'leftHand' || player.equipment?.leftHand?.type !== 'shield') return;
    const it = unequipGearSlot(player, slot);
    player.inventory.push(it);
    if(it.defense) player.defense = Math.max(0, (player.defense || 0) - it.defense);
    saveUpdate();
    log(`${it.name} retiré.`);
    updateWeaponsTab();
}

// =====================================
// (Boutique déplacée dans shop.js)
// =====================================

export function updateInventoryTab(){
    const inventoryList = document.getElementById('inventory-list');
    if(!inventoryList) return;
    normalizeActiveInventoryIndex();

    inventoryList.innerHTML = '';

    if(!player.inventory || !player.inventory.some(item => item.type !== 'shield')){
        inventoryList.innerHTML = `
            <div class="inventory-slot inventory-slot-empty">
                <span class="slot-icon">${svgIcon('box')}</span>
                <span class="slot-label"><em>Aucun objet</em></span>
            </div>
        `;
        return;
    }

    player.inventory.forEach((item, index) => {
        if(item.type === 'shield') return;
        const isActive = index === player.activeInventoryIndex;
        const rarityEmoji = getRarityIcon(item.rarity);
        const rarityColor = getRarityColor(item.rarity);

        const div = document.createElement('div');
        div.className = `item-card ${item.type === 'consumable' || item.type === 'reusable' ? 'consumable-item' : 'artifact-item'}`;
        div.style.borderLeft = `4px solid ${rarityColor}`;
        const paInfo = item.type === 'consumable' || item.type === 'reusable' ? ` <span style="color:#888;font-size:0.85em;">(${item.actionPoints || 2} ${svgIcon('arrow')})</span>` : '';
        const levelLocked = player.level < (item.minLevel || 1);
        const inCombat = gameState.combatState === 'active';
        const activateTitle = levelLocked ? `Nécessite le niveau ${item.minLevel}` : inCombat ? "Impossible de changer d'objet actif pendant le combat" : '';
        div.innerHTML = `
            <div class="item-header">
                <span class="item-name">${rarityEmoji} ${item.name}${paInfo}</span>
                <div class="item-actions">
                    ${isActive ? '<span class="artifact-badge">Actif</span>' : `<button class="item-discard-btn" ${levelLocked || inCombat ? 'disabled' : ''} title="${activateTitle}" onclick="window.setActiveInventoryItem(${index})">${levelLocked ? `Niv. ${item.minLevel} requis` : 'Activer'}</button>`}
                    <button class="item-discard-btn" onclick="window.discardInventoryItem(${index})">Jeter</button>
                </div>
            </div>
            <div class="item-description">${item.description}${item.type === 'reusable' && (item.chargesLeft ?? item.chargesPerCycle) <= 0 ? ` <em>(${describeRecharge(item)})</em>` : ''}</div>
        `;
        inventoryList.appendChild(div);
    });
}

export function updateItemButton(){
    const container = document.getElementById('item-button');
    if(!container) return;
    container.innerHTML = '';
    normalizeActiveInventoryIndex();

    if(!player.inventory || player.inventory.length === 0) return;

    const item = getActiveInventoryItem();
    if(!item) return;

    if(item.type === 'artifact'){
        const div = document.createElement('div');
        div.className = 'enemy-spell-item disabled';
        div.tabIndex = 0;
        div.innerHTML = `
            <div class="spell-name">${svgIcon('bolt')} ${item.name}</div>
            <div class="spell-cost">Actif (passif)</div>
        `;
        const showDetails = () => showItemTooltip(div, item, { isEnemyItem: false });
        const hideDetails = () => hideSpellTooltip();
        bindTooltip(div, showDetails, hideDetails);
        container.appendChild(div);
        return;
    }

    const pa = item.actionPoints || 2;
    const exhausted = item.type === 'reusable' && (item.chargesLeft ?? item.chargesPerCycle) <= 0;
    const canUse = gameState.combatState === 'active' && currentTurn === 'player' && player.combatPoints >= pa && !exhausted;

    const btn = document.createElement('div');
    btn.className = 'enemy-spell-item';
    btn.tabIndex = 0;
    btn.innerHTML = `
        <div class="spell-name">${svgIcon('bag')} ${item.name}</div>
        <div class="spell-cost">${pa} ${svgIcon('arrow')}${item.type === 'reusable' ? ` • ${item.chargesLeft ?? item.chargesPerCycle}/${item.chargesPerCycle}${(item.chargesLeft ?? item.chargesPerCycle) <= 0 ? ` • ${describeRecharge(item)}` : ''}` : ''}</div>
    `;
    const showDetails = () => showItemTooltip(btn, item, { isEnemyItem: false });
    const hideDetails = () => hideSpellTooltip();
    bindTooltip(btn, showDetails, hideDetails);

    if(!canUse){
        btn.classList.add('disabled');
        btn.tabIndex = -1;
        btn.onclick = null;
    } else {
        btn.onclick = () => useInventoryItem(item.id, player.activeInventoryIndex);
        btn.onkeydown = (event) => {
            if(event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                useInventoryItem(item.id, player.activeInventoryIndex);
            }
        };
    }
    container.appendChild(btn);
}

export function setActiveInventoryItem(index){
    if(gameState.combatState === 'active'){
        log('Vous ne pouvez pas changer d\'objet actif pendant le combat !');
        return;
    }
    if(!Array.isArray(player.inventory) || player.inventory.length === 0) return;
    if(!Number.isInteger(index) || index < 0 || index >= player.inventory.length) return;
    if(player.activeInventoryIndex === index) return;
    const chosen = player.inventory[index];
    if(chosen.type === 'shield') return;
    if(player.level < (chosen.minLevel || 1)){ log(`Nécessite niveau ${chosen.minLevel} pour utiliser ${chosen.name}.`); return; }

    player.activeInventoryIndex = index;
    const item = player.inventory[index];
    log(`Objet actif : ${item.name}.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}

export function useInventoryItem(itemId, index){
    if(gameState.combatState !== 'active'){ log("Aucun combat en cours."); return; }
    if(currentTurn !== 'player'){ log("Ce n'est pas votre tour."); return; }
    if(rejectRushedAction()) return;

    normalizeActiveInventoryIndex();
    const resolvedIndex = Number.isInteger(index) ? index : player.activeInventoryIndex;
    if(!Number.isInteger(resolvedIndex) || resolvedIndex < 0 || resolvedIndex >= player.inventory.length) {
        log("Aucun objet actif sélectionné.");
        return;
    }

    const item = player.inventory[resolvedIndex];
    if(item.id !== itemId){
        log("L'objet actif a changé, réessayez.");
        return;
    }
    if(!item){ log("Objet introuvable."); return; }

    const pa = item.actionPoints || 2;
    if(player.combatPoints < pa){
        log(`Il faut ${pa} points d'action pour utiliser ${item.name}.`);
        return;
    }

    actionGuard.markPlayerAction();
    player.combatPoints -= pa;
    const result = useItem(itemId, player, enemy, resolvedIndex);
    if(result.success){
        logActiveAction(`utilise l'objet ${item.name} (cout ${pa} PA)`);
        log(result.message);
        normalizeActiveInventoryIndex();
        updateInventoryTab();
        updateItemButton();
        saveUpdate();
        finishPlayerTurn();
    } else {
        player.combatPoints += pa;
        log(`${result.message}`);
    }
}

export function discardInventoryItem(index){
    if(!player.inventory || player.inventory.length === 0) return;
    let targetIndex = Number.isInteger(index) ? index : player.activeInventoryIndex;
    if(!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= player.inventory.length) {
        targetIndex = 0;
    }

    const item = player.inventory[targetIndex];
    player.inventory.splice(targetIndex, 1);
    normalizeActiveInventoryIndex();
    log(`Vous avez jeté ${item.name}.`);
    updateInventoryTab();
    updateItemButton();
    saveUpdate();
}

// Exports pour les fonctions accessibles globalement
window.equipSpell = equipSpell;
window.unequipSpell = unequipSpell;
window.equipWeapon = equipWeapon;
window.unequipWeapon = unequipWeapon;
window.equipGear = equipGear;
window.unequipGear = unequipGear;
window.useInventoryItem = useInventoryItem;
window.discardInventoryItem = discardInventoryItem;
window.setActiveInventoryItem = setActiveInventoryItem;
