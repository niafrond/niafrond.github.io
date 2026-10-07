// Mécaniques du jeu éprouvées sur des JOUEURS SAUVEGARDÉS forgés à des moments précis de la partie (tests/unit/fixtures/playerForge.js) :
// début de partie, niveau 5, niveau 10, niveau 15 (arène), niveau 30 (sorts multi-mana), niveau 50, niveau maximal.
//
// Tout ce qui est pur (saveManager, experience, progression, attributes, terrain, duel, arena, exploration, items, equipment, bossTips,
// weapons) est testé directement. game.js dépend du DOM : on n'en exécute que quelques fonctions pures, extraites de son code source
// (voir extractGameFunctions dans la forge). Les tirages aléatoires sont maîtrisés (Math.random simulé ou rng injecté).
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    GAME_ROOT, CLASS_IDS, MANA_COLORS, MILESTONES, MAX_ACTIVE_SPELLS, BASE_MANA_CAP, LEVEL_UP_MAX_HP_GAIN, HIGH_SPELL_FROM_LEVEL,
    NEW_PLAYER_HP, NEW_PLAYER_ATTACK, REGION_ORDER, SCREENS, REGION_UNLOCK_LEVEL, allSpells, allClassSpells, allWeapons, allItems, playerClasses,
    forgePlayer, forgeNewGame, forgeEarlyGame, forgeMidGame, forgeArenaUnlock, forgeLateGame, forgeEndGame, forgeMaxLevel,
    forgeArenaVeteran, forgeInArena, forgeBossStreak, explorationForRegions,
    exportPlayer, importJson, roundTrip, legacyFormat1Json, fileOf, exportSaveToFile, importSaveFromFile,
    gameRules, unlockedSpells, defaultLoadout, costOf, costColors, totalCost, spellCategory, bestWeapon, reusableItem, shieldItem,
    getSpellById, getClassSpellById, getWeaponById
} from './fixtures/playerForge.js';
import { MAX_LEVEL, addXP, getXPRequiredForLevel, getXPCostForLevel, getXPProgress, getXPToNextLevel, normalizeXP, initializeXP } from '../../experience.js';
import { growthExtras, applyGrowth, enemyDefenseForLevel } from '../../progression.js';
import {
    ATTRIBUTE_ORDER, ATTRIBUTE_MANA_RULES, ATTRIBUTE_STAT_EFFECTS, getAttributePoints, totalAttributePoints, respecAttributes,
    summarizeColorBonuses, manaPerMatch, manaBonusFor
} from '../../attributes.js';
import { getClassSpells } from '../../classes.js';
import { allWeapons as weaponsCatalog, weaponBiomeBonus, BIOME_WEAPON_BONUS } from '../../weapons.js';
import { useItem, tickReusableRecharge, rechargeReusableItems, isCombatLongEffect } from '../../items.js';
import { equip, getEquipmentDefenseBonus, canEquip } from '../../equipment.js';
import {
    approachOf, buildPrep, prepBanner, observationTarget, weaknessDamage, weakestColor, applyBoardBoost, spotAt,
    OBSERVE_MS, OBSERVE_RANGE, AMBUSH_BONUS_PA, WEAKNESS_DAMAGE_BONUS, OUTLOOK_TILES, FACE_FRONT, FACE_BEHIND, FACE_SIDE
} from '../../terrain.js';
import { pickTrapZone, trapDamage, mirrorLoadout, duelTurnPlan, weakenedHp, TRAP_SIZE } from '../../duel.js';
import {
    ARENA_TIERS, ARENA_HALL, arenaRoomId, arenaGuardId, arenaMasterId, arenaClearedFlag, gymGuardsGroup, arenaTier, arenaWaveLevel,
    arenaEncounterInfo, arenaRewardBonus, applyArenaScaling, normalizeArenaData, isArenaUnlocked, isChampionWave, ARENA_UNLOCK_REGION
} from '../../arena.js';
import {
    createSession, enterArena, leaveArena, inArena, tryMove, tick, markEnemyDefeated, encounterFor, prepFor, isShielded, isExitLocked,
    isEntityVisible, aliveEnemies, isEnemyAlive, currentScreen, enterScreen, entityAt, isTerrainBlocked, enemyLevel, resetAfterDefeat, START_SCREEN
} from '../../exploration.js';
import { BOSS_LOSS_THRESHOLD, recordBossLoss, recordVictory, isStreakTipDue, pickBossTip, applicableTips } from '../../bossTips.js';
import { createMapEnemy, weakColorOfTemplate } from '../../enemies.js';
import { boardSize } from '../../constants.js';

// ── Utilitaires ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const ids = list => (list || []).map(x => x.id);
const lcg = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const seq = values => { let i = 0; return () => values[i++ % values.length]; };
const read = f => readFileSync(join(GAME_ROOT, f), 'utf8');
const spent = p => totalAttributePoints(p);
const startStats = classId => Object.values(playerClasses[classId]?.startingStats || {}).reduce((a, b) => a + b, 0);

/** Ce qui doit survivre à un aller-retour, normalisé (les valeurs nulles / vides ne sont pas écrites dans le fichier). */
function essentials(p) {
    return {
        name: p.name, class: p.class ?? null, level: p.level, xp: p.xp || 0, gold: p.gold || 0, hp: p.hp, maxHp: p.maxHp, attack: p.attack, defense: p.defense || 0,
        unspent: p.unspentLevelPoints || 0, growthLevel: p.growthLevel,
        attributes: Object.fromEntries(ATTRIBUTE_ORDER.map(a => [a, p.attributes?.[a] || 0])),
        abilities: p.abilities || [], spells: ids(p.activeSpells), weapons: ids(p.weapons), equipped: p.equippedWeapon?.id ?? null,
        left: p.equipment?.leftHand?.id ?? null,
        inventory: (p.inventory || []).map(i => [i.id, i.chargesLeft, i.rechargeLeft || 0]),
        visited: p.exploration?.visitedScreens || [], screenId: p.exploration?.screenId
    };
}
const everyClass = forge => CLASS_IDS.map(c => [c, forge(c)]);

// Monde minimal pour les mécaniques de terrain : un seul écran sans obstacle.
function miniWorld({ enemies = [], spots = [], w = 12, h = 12 } = {}) {
    return { t: { id: 't', region: 'rizieres', name: 'Terrain', biome: 'paddy', w, h, spawn: { x: 0, y: 0 }, obstacles: [], liquids: [], paths: [], exits: [], npcs: [], chests: [], enemies, spots } };
}
const sentinel = (id, x, y, extra = {}) => ({ id, templateId: 'goblin_saboteur', name: `Ennemi ${id}`, kind: 'sentinel', x, y, facing: { dx: 0, dy: 1 }, offset: 0, ...extra });
const sessionIn = (player, world, pos, extra = {}) => createSession({ ...player.exploration, screenId: 't', x: pos.x, y: pos.y, ...extra }, world, []);

// Session issue d'un joueur RELU depuis son fichier de sauvegarde.
async function reloadSession(player, patch = {}) {
    const { player: relu } = await roundTrip(player);
    return { relu, session: createSession({ ...relu.exploration, ...patch }) };
}

let randomSpy;
beforeEach(() => { randomSpy = jest.spyOn(Math, 'random').mockImplementation(lcg(20261007)); });
afterEach(() => { randomSpy.mockRestore(); });

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. La forge elle-même : des joueurs cohérents avec les règles du jeu
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('forge de joueurs : cohérence des jalons', () => {
    test.each(MILESTONES.map(m => [m.label, m]))('%s : le niveau, l\'XP et les points d\'attribut suivent les règles du jeu', (_, m) => {
        CLASS_IDS.forEach(c => {
            const p = m.forge(c);
            expect(p.level).toBe(m.level);
            expect(p.xp).toBe(getXPRequiredForLevel(m.level));
            expect(p.xpToNextLevel).toBe(m.level >= MAX_LEVEL ? getXPRequiredForLevel(MAX_LEVEL) : getXPRequiredForLevel(m.level + 1));
            // un point d'attribut par niveau gagné + les points de départ de la classe
            expect(spent(p) + p.unspentLevelPoints).toBe(m.level - 1 + startStats(c));
            expect(p.hp).toBeLessThanOrEqual(p.maxHp);
        });
    });

    test('début de partie : héros neuf, arme de départ de sa classe, aucun sort débloqué, village de départ seulement', () => {
        CLASS_IDS.forEach(c => {
            const p = forgeNewGame(c);
            expect(p.level).toBe(1);
            expect(p.xp).toBe(0);
            expect(p.equippedWeapon.id).toBe(playerClasses[c].startingWeaponId);
            expect(p.weapons).toHaveLength(1);
            expect(p.activeSpells).toEqual([]);
            expect(p.availableSpells).toEqual([]);
            expect(p.maxHp).toBe(NEW_PLAYER_HP);
            expect(p.attack).toBe(NEW_PLAYER_ATTACK);
            expect(p.unspentLevelPoints).toBe(0);
            expect(p.attributes).toMatchObject(playerClasses[c].startingStats);
            expect(p.exploration.visitedScreens.every(id => SCREENS[id].region === REGION_ORDER[0])).toBe(true);
        });
    });

    test('PV max : gain par niveau + croissance innée + points d\'endurance dépensés', () => {
        MILESTONES.forEach(m => {
            const p = m.forge('templar');
            const staminaSpent = p.attributes.stamina - (playerClasses.templar.startingStats.stamina || 0);
            expect(p.maxHp).toBe(NEW_PLAYER_HP + (m.level - 1) * LEVEL_UP_MAX_HP_GAIN + growthExtras(1, m.level).maxHp + staminaSpent);
        });
    });

    test('attaque : points de Force et de Morale dépensés + croissance innée après le niveau 18', () => {
        MILESTONES.forEach(m => {
            const p = m.forge('barbarian');
            const startAtkPoints = (playerClasses.barbarian.startingStats.strength || 0);
            const gained = p.attributes.strength + p.attributes.morale - startAtkPoints;
            expect(p.attack).toBe(NEW_PLAYER_ATTACK + gained + growthExtras(1, m.level).attack);
        });
    });

    test('un joueur de niveau 15 et plus a visité le 3e terrain ; avant, non (l\'arène dépend du terrain, pas du niveau)', () => {
        expect(isArenaUnlocked(forgeNewGame().exploration.visitedScreens)).toBe(false);
        expect(isArenaUnlocked(forgeEarlyGame().exploration.visitedScreens)).toBe(false);
        expect(isArenaUnlocked(forgeMidGame().exploration.visitedScreens)).toBe(true);
        expect(isArenaUnlocked(forgeArenaUnlock().exploration.visitedScreens)).toBe(true);
    });

    test('une arme à deux mains occupe les deux mains : jamais de main gauche avec un arc lourd équipé', () => {
        MILESTONES.forEach(m => CLASS_IDS.forEach(c => {
            const p = m.forge(c);
            if (p.equippedWeapon.twoHanded) expect(p.equipment.leftHand).toBeNull();
            expect(p.equipment.rightHand).toBe(p.equippedWeapon);
        }));
        expect(() => forgePlayer({ level: 20, equippedWeaponId: 'arc_du_juge_celeste', leftHandId: 'arc_du_juge_celeste' })).toThrow(/deux mains/);
    });

    test('les sorts équipés sont tous débloqués, au plus quatre, sans doublon', () => {
        MILESTONES.forEach(m => CLASS_IDS.forEach(c => {
            const p = m.forge(c);
            expect(p.activeSpells.length).toBeLessThanOrEqual(MAX_ACTIVE_SPELLS);
            expect(new Set(ids(p.activeSpells)).size).toBe(p.activeSpells.length);
            p.activeSpells.forEach(s => expect(ids(p.availableSpells)).toContain(s.id));
        }));
    });

    test('identifiants inconnus : la forge refuse plutôt que d\'inventer', () => {
        expect(() => forgePlayer({ classId: 'paladin' })).toThrow(/classe inconnue/);
        expect(() => forgePlayer({ weaponIds: ['epee_magique'] })).toThrow(/arme inconnue/);
        expect(() => forgePlayer({ level: 10, spellIds: ['boule_de_neige'] })).toThrow(/sort inconnu/);
        expect(() => reusableItem('jade_shield')).toThrow(/inconnu/);
        expect(() => shieldItem('honey_vial')).toThrow(/inconnu/);
    });

    test('niveau hors bornes : ramené entre 1 et le niveau maximal', () => {
        expect(forgePlayer({ level: 0 }).level).toBe(1);
        expect(forgePlayer({ level: 9999 }).level).toBe(MAX_LEVEL);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. Aller-retour export -> import (format 2) à chaque jalon
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('sauvegarde : aller-retour fichier à chaque jalon', () => {
    test.each(MILESTONES.map(m => [m.label, m]))('%s : rien n\'est perdu (niveau, XP, or, aptitudes, sorts, armes, objets, exploration)', async (_, m) => {
        for (const c of CLASS_IDS) {
            const p = m.forge(c);
            const { player: relu } = await roundTrip(p);
            expect(essentials(relu)).toEqual(essentials(p));
        }
    });

    test('les sorts et armes relus sont les fiches du catalogue actuel (identifiants seulement dans le fichier)', async () => {
        const p = forgeLateGame('sorcerer');
        const { player: relu, data } = await roundTrip(p);
        expect(data.player.activeSpells.every(s => typeof s === 'string')).toBe(true);
        expect(data.player.weapons.every(w => typeof w === 'string')).toBe(true);
        expect(typeof data.player.equippedWeapon).toBe('string');
        relu.activeSpells.forEach((s, i) => expect(s).toEqual(p.activeSpells[i]));
        expect(relu.equippedWeapon).toEqual(p.equippedWeapon);
    });

    test('niveau 30 : sorts multi-mana (coûts multi-couleurs) intacts après l\'aller-retour', async () => {
        for (const c of CLASS_IDS) {
            const p = forgeLateGame(c);
            const { player: relu } = await roundTrip(p);
            relu.activeSpells.forEach((s, i) => expect(costOf(s)).toEqual(costOf(p.activeSpells[i])));
            expect(relu.activeSpells.some(s => costColors(s).length >= 2)).toBe(true);
            expect(relu.activeSpells.some(s => s.type === 'advanced' && costColors(s).length >= 3)).toBe(true);
        }
    });

    test('niveau 30 : arc en main droite et seconde arme en main gauche conservés', async () => {
        const p = forgeLateGame();
        expect(p.equipment.leftHand).toBeTruthy();
        const { player: relu } = await roundTrip(p);
        expect(relu.equipment.leftHand.id).toBe(p.equipment.leftHand.id);
        expect(relu.equipment.rightHand.id).toBe(p.equippedWeapon.id);
        expect(ids(relu.weapons)).toContain(p.equipment.leftHand.id);
    });

    test('niveau 15 : arc à deux mains équipé, main gauche vide après relecture', async () => {
        const { player: relu } = await roundTrip(forgeArenaUnlock());
        expect(relu.equippedWeapon.twoHanded).toBe(true);
        expect(relu.equipment.leftHand ?? null).toBeNull();
    });

    test('niveau 10 : le bouclier de la main gauche (objet complet) revient avec sa défense', async () => {
        const p = forgeMidGame();
        const { player: relu } = await roundTrip(p);
        expect(relu.equipment.leftHand).toMatchObject({ id: 'dragon_shield', type: 'shield', defense: shieldItem('dragon_shield').defense });
        expect(getEquipmentDefenseBonus(relu)).toBe(getEquipmentDefenseBonus(p));
    });

    test('objets rechargeables : charges restantes et compte à rebours de recharge conservés', async () => {
        const p = forgeArenaUnlock();
        const potion = p.inventory[0];
        expect([potion.chargesLeft, potion.rechargeLeft]).toEqual([0, 3]);
        const { player: relu } = await roundTrip(p);
        expect(relu.inventory).toHaveLength(p.inventory.length);
        expect([relu.inventory[0].chargesLeft, relu.inventory[0].rechargeLeft]).toEqual([0, 3]);
        expect(relu.inventory[1].chargesLeft).toBe(p.inventory[1].chargesPerCycle);
    });

    test('ce qui est propre au combat n\'est pas écrit : mana, effets de statut, sorts débloqués, plafonds', async () => {
        const p = forgeLateGame();
        p.mana.red = 33;
        p.tempAttack = 15;
        expect(Object.keys(p.statusEffects).length).toBeGreaterThan(0);
        const { data, player: relu } = await roundTrip(p);
        ['mana', 'manaCaps', 'maxMana', 'statusEffects', 'availableSpells', 'spells', 'tempAttack', 'tempDefense', 'xpToNextLevel'].forEach(k => {
            expect(data.player).not.toHaveProperty(k);
        });
        expect(relu.statusEffects).toBeUndefined();
        expect(relu.mana).toBeUndefined();
        expect(relu.hp).toBe(p.hp);   // les PV, eux, sont conservés
    });

    test('valeurs vides omises : héros neuf = fichier minuscule, sans listes ni zéros', async () => {
        const { data } = await roundTrip(forgeNewGame('assassin'));
        expect(data.player.gold).toBeUndefined();
        expect(data.player.abilities).toBeUndefined();
        expect(data.player.inventory).toBeUndefined();
        expect(data.player.activeSpells).toBeUndefined();
        expect(data.player.attributes).toEqual(playerClasses.assassin.startingStats);
    });

    test('métadonnées : format 2, nom, niveau, progression lisible', async () => {
        for (const m of MILESTONES) {
            const p = m.forge('templar');
            const { data, metadata } = await roundTrip(p);
            expect(data.metadata).toMatchObject({ format: 2, playerName: p.name, level: p.level });
            expect(metadata.progress).toContain(`Niveau ${p.level}`);
            expect(Number.isInteger(metadata.timestamp)).toBe(true);
        }
    });

    test('XP : la prochaine marche est recalculée au chargement, sans niveau offert ni retiré', async () => {
        for (const m of MILESTONES) {
            const p = m.forge('sorcerer');
            const { player: relu } = await roundTrip(p);
            normalizeXP(relu);   // game.js > loadGameData : l'XP nulle d'un héros neuf n'est pas écrite, elle est recalée ici
            expect({ level: relu.level, xp: relu.xp }).toEqual({ level: p.level, xp: p.xp });
            expect(relu.xpToNextLevel).toBe(m.level >= MAX_LEVEL ? getXPRequiredForLevel(MAX_LEVEL) : getXPRequiredForLevel(m.level + 1));
        }
    });

    test('croissance innée : le niveau de croissance est sauvegardé, le rattrapage ne se rejoue pas', async () => {
        for (const level of [10, 30, 70]) {
            const { player: relu } = await roundTrip(forgePlayer({ level }));
            const attack = relu.attack, maxHp = relu.maxHp;
            expect(applyGrowth(relu)).toEqual({ attack: 0, maxHp: 0 });
            expect([relu.attack, relu.maxHp]).toEqual([attack, maxHp]);
        }
    });

    test('cas limite : joueur sans classe (« Sans classe »)', async () => {
        const p = forgePlayer({ classId: null, level: 4 });
        expect(p.class).toBeNull();
        const { player: relu } = await roundTrip(p);
        expect(relu.class).toBeUndefined();
        expect(relu.level).toBe(4);
        expect(relu.equippedWeapon.id).toBe('arc_de_fortune');
    });

    test('cas limite : nom accentué et or très élevé', async () => {
        const p = forgePlayer({ level: 30, name: 'Yì le Précis', gold: 2 ** 40 });
        const { player: relu, metadata } = await roundTrip(p);
        expect(relu.name).toBe('Yì le Précis');
        expect(relu.gold).toBe(2 ** 40);
        expect(metadata.playerName).toBe('Yì le Précis');
    });

    test('cas limite : un export ne modifie pas le joueur en mémoire', async () => {
        const p = forgeLateGame();
        const copy = JSON.parse(JSON.stringify(p));
        await exportPlayer(p);
        expect(JSON.parse(JSON.stringify(p))).toEqual(copy);
    });

    test('exporter sans joueur échoue proprement', () => {
        expect(exportSaveToFile(null)).toMatchObject({ success: false });
        expect(exportSaveToFile(undefined).message).toMatch(/Aucun joueur/);
    });

    test('un joueur de niveau maximal reste cohérent après relecture', async () => {
        const p = forgeMaxLevel('barbarian');
        const { player: relu } = await roundTrip(p);
        expect(relu.level).toBe(MAX_LEVEL);
        expect(relu.xp).toBe(getXPRequiredForLevel(MAX_LEVEL));
        expect(getXPProgress(relu)).toBe(100);
        expect(getXPToNextLevel(relu)).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 3. Rétrocompatibilité : ancien format 1 et champs manquants
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('sauvegarde : rétrocompatibilité', () => {
    test('format 1 (objet joueur complet, sans `format`) : importé tel quel, niveau et or conservés', async () => {
        const p = forgeEarlyGame('assassin');
        const res = await importJson(legacyFormat1Json(p));
        expect(res.success).toBe(true);
        expect(res.metadata.format).toBeUndefined();
        expect(res.player.level).toBe(p.level);
        expect(res.player.gold).toBe(p.gold);
        expect(res.player.activeSpells).toHaveLength(p.activeSpells.length);
        expect(res.player.weapons.map(w => w.id)).toEqual(ids(p.weapons));
    });

    test('format 1 : un ancien consommable devient un objet rechargeable, sans jamais être détruit', async () => {
        const p = forgeEarlyGame();
        const catalog = allItems.find(i => i.id === 'healthPotion');
        const res = await importJson(legacyFormat1Json(p, { inventory: [{ id: 'healthPotion', name: 'Élixir de Vie', type: 'consumable' }, { id: 'objet_perdu', type: 'consumable' }] }));
        expect(res.player.inventory).toHaveLength(2);
        expect(res.player.inventory[0]).toMatchObject({ type: 'reusable', chargesPerCycle: catalog.chargesPerCycle, chargesLeft: catalog.chargesPerCycle, rechargeTurns: catalog.rechargeTurns });
        // inconnu du catalogue : 1 charge, rechargée en 3 tours
        expect(res.player.inventory[1]).toMatchObject({ type: 'reusable', chargesPerCycle: 1, rechargeTurns: 3, chargesLeft: 1 });
    });

    test('un rééquilibrage du catalogue s\'applique aux anciennes parties (effet, délai) et les charges sont plafonnées', async () => {
        const ref = allItems.find(i => i.id === 'honey_vial');
        const stale = { ...reusableItem('honey_vial'), effect: { heal: 9999 }, chargesPerCycle: 50, chargesLeft: 50, rechargeTurns: 1, description: 'ancienne' };
        const res = await importJson(legacyFormat1Json(forgeMidGame(), { inventory: [stale] }));
        const item = res.player.inventory[0];
        expect(item.effect).toEqual(ref.effect);
        expect(item.chargesPerCycle).toBe(ref.chargesPerCycle);
        expect(item.rechargeTurns).toBe(ref.rechargeTurns);
        expect(item.chargesLeft).toBe(ref.chargesPerCycle);
        expect(item.description).toBe(ref.description);
    });

    test('objet rechargeable sans charges enregistrées : plein par défaut, recharge à zéro', async () => {
        const raw = { id: 'honey_vial', type: 'reusable', effect: { heal: 1 } };
        const res = await importJson(legacyFormat1Json(forgeMidGame(), { inventory: [raw] }));
        expect(res.player.inventory[0].chargesLeft).toBe(allItems.find(i => i.id === 'honey_vial').chargesPerCycle);
        expect(res.player.inventory[0].rechargeLeft).toBe(0);
    });

    test('champs manquants (format 1) : valeurs par défaut sûres', async () => {
        const json = JSON.stringify({ metadata: { version: '0.1.0', timestamp: 1600000000000 }, player: { level: 7 } });
        const res = await importJson(json);
        expect(res.success).toBe(true);
        expect(res.player).toMatchObject({ name: 'Héros', level: 7, inventory: [], equipment: { rightHand: null, leftHand: null, item: null }, exploration: {} });
        expect(res.player.spells).toEqual({});
        expect(res.player.equippedSpells).toEqual([]);
    });

    test('champs manquants (format 2) : listes vides, aucune arme, aucune main occupée', async () => {
        const json = JSON.stringify({ metadata: { version: '1.0.0', format: 2, timestamp: 1700000000000 }, player: { level: 3 } });
        const res = await importJson(json);
        expect(res.success).toBe(true);
        expect(res.player).toMatchObject({ name: 'Héros', level: 3, activeSpells: [], weapons: [], equippedWeapon: null, inventory: [] });
        expect(res.player.equipment).toEqual({ rightHand: null, leftHand: null, item: null });
        expect(res.player.worldMap).toEqual({ currentZoneId: null, visitedZoneIds: [] });
    });

    test('format 2 : identifiants d\'armes hérités convertis en arcs, identifiants inconnus ignorés', async () => {
        const { data } = await roundTrip(forgeEarlyGame());
        data.player.weapons = ['rusty_sword', 'iron_sword', 'arme_disparue'];
        data.player.equippedWeapon = 'steel_sword';
        const res = await importJson(JSON.stringify(data));
        expect(ids(res.player.weapons)).toEqual(['arc_de_fortune', 'arc_leger']);
        expect(res.player.equippedWeapon.id).toBe('arc_de_precision');
        expect(res.player.weapons.every(w => w.type === 'bow')).toBe(true);
    });

    test('format 2 : sorts inconnus ignorés, sorts de classe retrouvés', async () => {
        const { data } = await roundTrip(forgeArenaUnlock('sorcerer'));
        data.player.activeSpells = ['fireball', 'sort_disparu', 'mageStrike', 'fiveHarmony'];
        const res = await importJson(JSON.stringify(data));
        expect(ids(res.player.activeSpells)).toEqual(['fireball', 'mageStrike', 'fiveHarmony']);
        expect(res.player.activeSpells[1].class).toBe('sorcerer');
    });

    test('format 2 : sauvegarde tronquée à la main (sans exploration, sans arène) rechargeable en session', async () => {
        const { data } = await roundTrip(forgeArenaVeteran());
        delete data.player.exploration;
        const res = await importJson(JSON.stringify(data));
        expect(res.player.exploration).toEqual({});
        const s = createSession(res.player.exploration);
        expect(s.data.screenId).toBe(START_SCREEN);
        expect(s.data.arena).toEqual({ cleared: [], best: {}, wins: 0, returnTo: null });
    });

    test.each([
        ['niveau non entier', { level: '12' }, /corrompues/],
        ['niveau absent', { level: undefined }, /corrompues/]
    ])('cas limite : %s -> refus', async (_, patch, msg) => {
        const { data } = await roundTrip(forgeEarlyGame());
        Object.assign(data.player, patch);
        const res = await importJson(JSON.stringify(data));
        expect(res.success).toBe(false);
        expect(res.message).toMatch(msg);
    });

    test('cas limite : fichiers invalides', async () => {
        const good = await exportPlayer(forgeEarlyGame());
        expect(await importSaveFromFile(null)).toMatchObject({ success: false });
        expect((await importSaveFromFile({ name: 'sauvegarde.txt', content: good.json })).message).toMatch(/JSON/);
        expect((await importJson('pas du json')).message).toMatch(/lecture/);
        expect((await importJson(JSON.stringify({ player: {} }))).message).toMatch(/invalide/);
        const noStamp = { ...good.data, metadata: { ...good.data.metadata, timestamp: undefined } };
        expect((await importJson(JSON.stringify(noStamp))).message).toMatch(/corrompues/);
        const floatStamp = { ...good.data, metadata: { ...good.data.metadata, timestamp: 1.5 } };
        expect((await importJson(JSON.stringify(floatStamp))).success).toBe(false);
    });

    test('ancienne partie niveau 30 sans niveau de croissance : rattrapage unique de la croissance innée', async () => {
        const p = forgePlayer({ level: 30 });
        const stats = { attack: p.attack, maxHp: p.maxHp };
        const legacy = { attack: stats.attack - growthExtras(1, 30).attack, maxHp: stats.maxHp - growthExtras(1, 30).maxHp, growthLevel: undefined };
        const res = await importJson(legacyFormat1Json(p, legacy));
        const loaded = res.player;
        expect(applyGrowth(loaded)).toEqual(growthExtras(1, 30));
        expect({ attack: loaded.attack, maxHp: loaded.maxHp }).toEqual(stats);
        expect(applyGrowth(loaded)).toEqual({ attack: 0, maxHp: 0 });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 4. Progression : niveaux, XP, attributs, sorts débloqués
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('progression des joueurs sauvegardés', () => {
    test('de chaque jalon au suivant : l\'XP cumulée franchit exactement les niveaux attendus', () => {
        const pairs = MILESTONES.slice(0, -1).map((m, i) => [m, MILESTONES[i + 1]]);
        pairs.forEach(([from, to]) => {
            const p = from.forge('templar');
            const res = addXP(p, getXPRequiredForLevel(to.level) - p.xp);
            expect(res).toMatchObject({ leveledUp: true, newLevel: to.level, levelsGained: to.level - from.level });
            expect(p.xpToNextLevel).toBe(getXPRequiredForLevel(to.level + 1));
        });
    });

    test('un gain d\'XP d\'un cran en dessous du palier ne fait pas monter de niveau (cas limite)', () => {
        const p = forgeEarlyGame();
        const need = getXPRequiredForLevel(p.level + 1) - p.xp;
        expect(addXP(p, need - 1)).toMatchObject({ leveledUp: false, levelsGained: 0 });
        expect(p.level).toBe(5);
        expect(getXPToNextLevel(p)).toBe(1);
        expect(addXP(p, 1)).toMatchObject({ leveledUp: true, newLevel: 6 });
    });

    test('plusieurs niveaux d\'un coup depuis le début de partie', () => {
        const p = forgeNewGame();
        expect(addXP(p, getXPRequiredForLevel(15))).toMatchObject({ newLevel: 15, levelsGained: 14 });
    });

    test('niveau maximal : plus aucun gain, XP plafonnée', () => {
        const p = forgeMaxLevel();
        expect(addXP(p, 10 ** 9)).toMatchObject({ leveledUp: false, newLevel: MAX_LEVEL, levelsGained: 0 });
        expect(p.xp).toBeLessThanOrEqual(getXPRequiredForLevel(MAX_LEVEL));
        expect(p.level).toBe(MAX_LEVEL);
    });

    test('initializeXP sur un joueur forgé ne change rien (déjà recalé sur la courbe)', () => {
        MILESTONES.forEach(m => {
            const p = m.forge('templar');
            const before = { level: p.level, xp: p.xp, next: p.xpToNextLevel };
            initializeXP(p);
            expect({ level: p.level, xp: p.xp, next: p.xpToNextLevel }).toEqual(before);
        });
    });

    test('le coût de chaque palier croît : jamais deux niveaux au même coût', () => {
        for (let n = 3; n <= MAX_LEVEL; n++) expect(getXPCostForLevel(n)).toBeGreaterThan(getXPCostForLevel(n - 1));
    });

    test('réinitialiser les points rend tous les points dépensés et retire leurs effets (puis redépenser donne les mêmes stats)', () => {
        MILESTONES.forEach(m => CLASS_IDS.forEach(c => {
            const p = m.forge(c);
            const attrs = { ...p.attributes };
            const stats = { attack: p.attack, defense: p.defense, maxHp: p.maxHp };
            const total = spent(p);
            const unspentBefore = p.unspentLevelPoints;
            const { refunded } = respecAttributes(p);
            expect(refunded).toBe(total);
            expect(p.unspentLevelPoints).toBe(unspentBefore + total);
            expect(spent(p)).toBe(0);
            expect(p.hp).toBeGreaterThanOrEqual(1);
            expect(p.hp).toBeLessThanOrEqual(p.maxHp);
            // on redépense à l'identique : mêmes attaque et PV max qu'avant ; la défense ne peut que rester ou monter (voir note)
            ATTRIBUTE_ORDER.forEach(a => {
                for (let i = 0; i < attrs[a]; i++) {
                    p.attributes[a]++;
                    const eff = ATTRIBUTE_STAT_EFFECTS[a];
                    if (eff.stat === 'attack' || eff.stat === 'defense' || eff.stat === 'maxHp') p[eff.stat] += eff.amount;
                }
            });
            expect({ attack: p.attack, maxHp: p.maxHp }).toEqual({ attack: stats.attack, maxHp: stats.maxHp });
            // NOTE (compte rendu) : les points de départ de la classe (Agilité 2 de l'Archer céleste) n'ont jamais donné de défense ;
            // le retrait de respecAttributes est borné à 0, puis la redépense les convertit en vraie défense : au plus +points de départ.
            expect(p.defense).toBeGreaterThanOrEqual(stats.defense);
            expect(p.defense - stats.defense).toBeLessThanOrEqual(startStats(c));
        }));
    });

    test('réinitialiser sans aucun point dépensé ne fait rien (cas limite)', () => {
        const p = forgePlayer({ classId: null, level: 1 });
        expect(respecAttributes(p)).toEqual({ refunded: 0 });
        expect(p.unspentLevelPoints).toBe(0);
    });

    test('bonus de couleur : +1 mana par point à chaque match, réserve +maxPerPoint par point', () => {
        const p = forgeMidGame('templar');
        summarizeColorBonuses(p).forEach(row => {
            const rule = ATTRIBUTE_MANA_RULES[row.attr];
            expect(row.color).toBe(rule.color);
            expect(row.perMatch3).toBe(3 + rule.bonuses.gain * row.points);
            expect(row.initial).toBe(rule.bonuses.initial * row.points);
            expect(row.cap).toBe(p.maxMana + rule.bonuses.max * row.points);
            expect(manaPerMatch(row.attr, row.points, 5)).toBe(5 + rule.bonuses.gain * row.points);
        });
        expect(manaBonusFor('strength', -4, 'gain')).toBe(0);   // points négatifs : jamais de malus
    });

    test('chaque classe reçoit ses points de départ dans les bons attributs', () => {
        CLASS_IDS.forEach(c => {
            const p = forgeNewGame(c);
            ATTRIBUTE_ORDER.forEach(a => expect(getAttributePoints(p, a)).toBe(playerClasses[c].startingStats[a] || 0));
        });
    });
});

describe('déblocage des sorts selon le niveau et la classe', () => {
    test('niveau 1 : aucun sort ; niveau n : n - 1 sorts ordinaires (les sorts avancés viennent en plus, dès leur niveau)', () => {
        CLASS_IDS.forEach(c => {
            expect(unlockedSpells(c, 1)).toEqual([]);
            for (let L = 2; L <= HIGH_SPELL_FROM_LEVEL; L++) {
                const list = unlockedSpells(c, L);
                const ordinary = list.filter(s => s.type !== 'advanced');
                expect(ordinary.length).toBe(L - 1);
                list.forEach(s => expect(s.minLevel).toBeLessThanOrEqual(HIGH_SPELL_FROM_LEVEL));
            }
        });
    });

    test('jamais un sort avant son niveau minimal, jamais le sort d\'une autre classe (niveaux 1 à 70)', () => {
        CLASS_IDS.forEach(c => {
            for (let L = 1; L <= MAX_LEVEL; L++) {
                unlockedSpells(c, L).forEach(s => {
                    expect(s.minLevel).toBeLessThanOrEqual(L);
                    if (s.class) expect(s.class).toBe(c);
                });
            }
        });
    });

    test('le déblocage ne retire jamais un sort en montant de niveau (la liste ne fait que s\'allonger)', () => {
        CLASS_IDS.forEach(c => {
            let previous = new Set();
            for (let L = 1; L <= MAX_LEVEL; L++) {
                const now = new Set(ids(unlockedSpells(c, L)));
                previous.forEach(id => expect(now.has(id)).toBe(true));
                previous = now;
            }
        });
    });

    test('sorts multi-mana de haut niveau : débloqués pile à leur niveau, hors plafond (niveau 16 à 70)', () => {
        const high = allSpells.filter(s => s.minLevel > HIGH_SPELL_FROM_LEVEL);
        expect(high.length).toBeGreaterThan(0);
        CLASS_IDS.forEach(c => high.forEach(s => {
            expect(ids(unlockedSpells(c, s.minLevel))).toContain(s.id);
            expect(ids(unlockedSpells(c, s.minLevel - 1))).not.toContain(s.id);
        }));
    });

    test('niveau maximal : le dernier sort du jeu (Fin de la Tribulation) n\'existe qu\'au niveau 70', () => {
        expect(ids(unlockedSpells('barbarian', MAX_LEVEL))).toContain('heavenTribulationEnd');
        expect(ids(unlockedSpells('barbarian', MAX_LEVEL - 1))).not.toContain('heavenTribulationEnd');
    });

    test('chaque classe a au moins un sort de classe dès le niveau 2 (premier sort de sa liste)', () => {
        CLASS_IDS.forEach(c => {
            const first = getClassSpells(c, 1);
            expect(first.length).toBeGreaterThan(0);
            first.forEach(s => expect(s.class).toBe(c));
        });
    });

    test('getClassSpells : classe inconnue ou niveau nul -> aucun sort', () => {
        expect(getClassSpells('paladin', 70)).toEqual([]);
        expect(getClassSpells('sorcerer', 0)).toEqual([]);
        expect(getClassSpells(null, 70)).toEqual([]);
    });

    test('identifiants de sorts uniques sur tout le catalogue (sinon une sauvegarde relirait le mauvais sort)', () => {
        const all = [...allSpells, ...allClassSpells].map(s => s.id);
        expect(new Set(all).size).toBe(all.length);
        all.forEach(id => expect(getSpellById(id) || getClassSpellById(id)).toBeTruthy());
    });

    test('un sort avancé est disponible dès son niveau minimal, hors plafond « niveau - 1 » (correctif : il fallait attendre les niveaux 38 à 48)', () => {
        const advanced = allSpells.filter(s => s.type === 'advanced');
        expect(advanced.length).toBeGreaterThanOrEqual(8);
        CLASS_IDS.forEach(c => {
            advanced.forEach(spell => {
                expect(ids(unlockedSpells(c, spell.minLevel))).toContain(spell.id);
                if (spell.minLevel > 1) expect(ids(unlockedSpells(c, spell.minLevel - 1))).not.toContain(spell.id);
            });
        });
    });

    test('Lame des Quatre Vents est libre au niveau 8 et le nombre de sorts ordinaires reste plafonné à niveau - 1 (cas limite)', () => {
        const bladeWinds = allSpells.find(s => s.id === 'bladeWinds');
        expect(bladeWinds.minLevel).toBe(8);
        CLASS_IDS.forEach(c => {
            const list = unlockedSpells(c, 8);
            expect(ids(list)).toContain('bladeWinds');
            expect(list.filter(s => s.type !== 'advanced')).toHaveLength(7);
        });
    });

    test('la règle de déblocage utilisée par la forge est bien celle de game.js (constante et plafond)', () => {
        const src = read('game.js');
        expect(src).toContain(`const HIGH_SPELL_FROM_LEVEL = ${HIGH_SPELL_FROM_LEVEL}`);
        expect(gameRules.getUnlockedSpellCap(1)).toBe(0);
        expect(gameRules.getUnlockedSpellCap(40)).toBe(39);
        expect(gameRules.getUnlockedSpellCap(undefined)).toBe(0);
    });

    test('équipement par défaut de la forge : au niveau 30, un sort avancé, un multi-mana, un sort de classe', () => {
        CLASS_IDS.forEach(c => {
            const cats = defaultLoadout(c, 30).map(spellCategory);
            expect(cats).toEqual(expect.arrayContaining(['advanced', 'multi', 'class']));
        });
    });
});

describe('garde-fous d\'équilibrage sur des héros sauvegardés', () => {
    // Les ennemis tirent leurs statistiques de gabarits ; Math.random est simulé (suite déterministe).
    const fight = (p, level) => {
        const enemy = createMapEnemy({ templateId: 'orc_warmaster', level, enemyId: 'e' });
        const perHit = Math.max(1, p.equippedWeapon.damage + p.attack - enemy.defense);
        const enemyHit = Math.max(1, enemy.attack - (p.defense || 0));
        return { enemy, hitsToKill: Math.ceil(enemy.maxHp / perHit), hitsToDie: Math.ceil(p.maxHp / enemyHit) };
    };

    test.each(MILESTONES.map(m => [m.label, m]))('%s : un ennemi du même niveau n\'est ni un jouet ni un mur', (_, m) => {
        CLASS_IDS.forEach(c => {
            const { hitsToKill, hitsToDie } = fight(m.forge(c), m.level);
            expect(hitsToKill).toBeGreaterThanOrEqual(1);
            expect(hitsToKill).toBeLessThanOrEqual(12);
            expect(hitsToDie).toBeGreaterThanOrEqual(2);
        });
    });

    test('la défense ennemie ne dépasse jamais l\'attaque cumulée (arme + attaque) d\'un héros du même niveau', () => {
        MILESTONES.forEach(m => {
            const p = m.forge('templar');
            expect(p.equippedWeapon.damage + p.attack).toBeGreaterThan(enemyDefenseForLevel(m.level));
        });
    });

    test('un sort multi-mana est lançable avec les points d\'attribut du niveau où il apparaît (couleurs cumulées)', () => {
        const maxPerPoint = ATTRIBUTE_MANA_RULES.strength.bonuses.max;
        allSpells.filter(s => s.minLevel > HIGH_SPELL_FROM_LEVEL && typeof s.cost === 'object').forEach(s => {
            const pointsNeeded = Object.values(costOf(s)).reduce((sum, amount) => sum + Math.max(0, Math.ceil((amount - BASE_MANA_CAP) / maxPerPoint)), 0);
            expect(pointsNeeded).toBeLessThanOrEqual(s.minLevel - 1);
        });
    });

    test('coût de chaque sort : couleurs connues, montants entiers positifs', () => {
        [...allSpells, ...allClassSpells].forEach(s => {
            costColors(s).forEach(c => expect(MANA_COLORS).toContain(c));
            Object.values(costOf(s)).forEach(n => { expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThan(0); });
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 5. Sorts multi-mana et avancés
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('sorts multi-mana : coût par couleur (règles exécutées depuis game.js)', () => {
    const manaFor = (spell, delta = {}) => ({ mana: Object.fromEntries(MANA_COLORS.map(c => [c, (costOf(spell)[c] || 0) + (delta[c] || 0)])) });
    const multi = [...allSpells, ...allClassSpells].filter(s => costColors(s).length >= 2);

    test('il existe des sorts à 2, 3, 4 et 5 couleurs', () => {
        const counts = new Set(multi.map(s => costColors(s).length));
        [2, 3, 4, 5].forEach(n => expect(counts.has(n)).toBe(true));
    });

    test.each(multi.map(s => [s.id, s]))('%s : lançable avec exactement son coût, refusé s\'il manque 1 dans UNE couleur', (_, s) => {
        expect(gameRules.canEntityCastSpell(manaFor(s), s)).toBe(true);
        costColors(s).forEach(c => expect(gameRules.canEntityCastSpell(manaFor(s, { [c]: -1 }), s)).toBe(false));
    });

    test.each(multi.map(s => [s.id, s]))('%s : lancer retire le coût de chaque couleur et ne touche pas aux autres', (_, s) => {
        const entity = manaFor(s, { red: 3, purple: 3 });
        const before = { ...entity.mana };
        gameRules.consumeSpellMana(entity, s);
        MANA_COLORS.forEach(c => expect(entity.mana[c]).toBe(before[c] - (costOf(s)[c] || 0)));
    });

    test('mana insuffisant : le retrait ne descend jamais sous zéro (cas limite)', () => {
        const s = getSpellById('jadeEmperorDecree');
        const entity = { mana: { red: 1, blue: 0, green: 7, yellow: 0, purple: 0 } };
        gameRules.consumeSpellMana(entity, s);
        expect(Object.values(entity.mana).every(n => n >= 0)).toBe(true);
        expect(entity.mana.green).toBe(0);
    });

    test('sort à coût numérique (une couleur) : lit la couleur du sort', () => {
        const fire = getSpellById('fireball');
        expect(typeof fire.cost).toBe('number');
        expect(gameRules.canEntityCastSpell({ mana: { red: fire.cost } }, fire)).toBe(true);
        expect(gameRules.canEntityCastSpell({ mana: { red: fire.cost - 1, blue: 99 } }, fire)).toBe(false);
        const e = { mana: { red: fire.cost + 2 } };
        gameRules.consumeSpellMana(e, fire);
        expect(e.mana.red).toBe(2);
    });

    test('entrées invalides : jamais lançable, aucune exception', () => {
        const s = getSpellById('vaporBurst');
        expect(gameRules.canEntityCastSpell(null, s)).toBe(false);
        expect(gameRules.canEntityCastSpell({}, s)).toBe(false);
        expect(gameRules.canEntityCastSpell({ mana: {} }, null)).toBe(false);
        expect(() => gameRules.consumeSpellMana(null, s)).not.toThrow();
        expect(gameRules.spellColorsOf(null)).toEqual([]);
        expect(gameRules.spellColorsOf(s)).toEqual(costColors(s));
    });

    test('les sorts équipés d\'un héros de niveau 30 : réserve pleine = sorts tous lançables un par un', () => {
        CLASS_IDS.forEach(c => {
            const p = forgeLateGame(c);
            p.activeSpells.forEach(s => {
                const entity = { mana: Object.fromEntries(MANA_COLORS.map(color => [color, BASE_MANA_CAP])) };
                if (Object.values(costOf(s)).every(n => n <= BASE_MANA_CAP)) expect(gameRules.canEntityCastSpell(entity, s)).toBe(true);
            });
        });
    });
});

describe('sorts avancés (3 à 5 couleurs) et effets de classe', () => {
    const advanced = allSpells.filter(s => s.type === 'advanced');
    const effectsSource = read('classSpellEffects.js');

    test('huit sorts avancés, de 3 à 5 couleurs, coût total dans la réserve de base', () => {
        expect(advanced).toHaveLength(8);
        advanced.forEach(s => {
            expect(costColors(s).length).toBeGreaterThanOrEqual(3);
            expect(costColors(s).length).toBeLessThanOrEqual(MANA_COLORS.length);
            expect(totalCost(s)).toBeLessThanOrEqual(BASE_MANA_CAP);
            expect(s.effect).toBeTruthy();
        });
    });

    test('chaque sort à effet (classe ou avancé) a son traitement dans classSpellEffects.js', () => {
        [...allSpells, ...allClassSpells].filter(s => s.effect).forEach(s => {
            expect(effectsSource).toContain(`case '${s.effect}'`);
        });
    });

    test('les sorts avancés sont réservés au joueur : les ennemis n\'en tirent pas (tirages simulés, niveaux 10 à 70)', () => {
        const rng = lcg(7);
        randomSpy.mockImplementation(rng);
        const templates = ['orc_warmaster', 'crypt_lich', 'moon_priestess', 'storm_knight', 'shadow_assassin', 'ice_witch'];
        for (const templateId of templates) {
            for (const level of [10, 17, 30, 50, 70]) {
                const enemy = createMapEnemy({ templateId, level, enemyId: 'x' });
                (enemy.spells || []).filter(s => !s.class).forEach(s => {
                    expect(s.playerOnly).toBeFalsy();
                    expect(s.effect).toBeUndefined();
                });
                if (enemy.weapon) expect(enemy.weapon.playerOnly).toBeFalsy();
            }
        }
    });

    test('Harmonie des Cinq Éléments : les cinq couleurs à parts égales ; Pluie des Mille Étoiles : cinq couleurs aussi', () => {
        const harmony = getSpellById('fiveHarmony');
        expect(new Set(Object.values(costOf(harmony))).size).toBe(1);
        expect(costColors(harmony).sort()).toEqual([...MANA_COLORS].sort());
        expect(costColors(getSpellById('starRain'))).toHaveLength(5);
    });

    test('un héros de niveau 17 (premier sort avancé libre) peut équiper Harmonie et son coût entre dans la réserve de base', () => {
        CLASS_IDS.forEach(c => {
            const p = forgePlayer({ classId: c, level: 17, spellIds: ['fiveHarmony'] });
            expect(ids(p.availableSpells)).toContain('fiveHarmony');
            expect(Math.max(...Object.values(costOf(p.activeSpells[0])))).toBeLessThanOrEqual(BASE_MANA_CAP);
        });
    });

    test('Souffle de Jade Céleste (4 couleurs, soin) et Harmonie (100 dégâts + soin) : les trois effets annoncés existent', () => {
        expect(getSpellById('jadeBreath').effect).toBe('secondWind');
        expect(getSpellById('fiveHarmony').effect).toBe('harmony');
        expect(getSpellById('thunderPrison').effect).toBe('cageEnemy');
    });

    test('dégâts des sorts multi-mana de haut niveau : croissent avec le niveau requis', () => {
        const dmg = allSpells.filter(s => s.playerOnly && s.type === 'damage').sort((a, b) => a.minLevel - b.minLevel);
        expect(dmg.length).toBeGreaterThan(5);
        for (let i = 1; i < dmg.length; i++) expect(dmg[i].dmg).toBeGreaterThan(dmg[i - 1].dmg);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 6. Armes (deux mains, arcs lourds, main droite / gauche), équipement et objets réutilisables
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('armes et équipement des joueurs sauvegardés', () => {
    test('arme de départ de chaque classe : au catalogue, niveau 1, à une main, utilisable par le joueur', () => {
        CLASS_IDS.forEach(c => {
            const w = getWeaponById(playerClasses[c].startingWeaponId);
            expect(w).toBeTruthy();
            expect(w.minLevel).toBe(1);
            expect(w.twoHanded).toBe(false);
            expect(w.playerOnly).toBeFalsy();
        });
    });

    test('arcs lourds : à deux mains, de plus en plus puissants et gourmands en points d\'action', () => {
        const heavy = allWeapons.filter(w => w.playerOnly).sort((a, b) => a.minLevel - b.minLevel);
        expect(heavy.length).toBeGreaterThanOrEqual(8);
        heavy.forEach(w => expect(w.twoHanded).toBe(true));
        for (let i = 1; i < heavy.length; i++) {
            expect(heavy[i].damage).toBeGreaterThan(heavy[i - 1].damage);
            expect(heavy[i].actionPoints).toBeGreaterThanOrEqual(heavy[i - 1].actionPoints);
        }
    });

    test('meilleur arc du niveau : jamais un arc d\'un niveau supérieur à celui du joueur', () => {
        MILESTONES.forEach(m => {
            const w = bestWeapon(m.level);
            expect(w.minLevel).toBeLessThanOrEqual(m.level);
            weaponsCatalog.filter(x => x.minLevel <= m.level).forEach(x => expect(x.damage).toBeLessThanOrEqual(w.damage));
        });
    });

    test('bouclier : refusé tant qu\'un arc à deux mains est équipé (niveau 15), accepté avec un arc à une main (niveau 10)', () => {
        const heavyHero = forgeArenaUnlock();
        const shield = shieldItem('jade_shield');
        const refused = equip({ equipment: { ...heavyHero.equipment, rightHand: { ...heavyHero.equippedWeapon, type: 'weapon' } } }, shield, 'leftHand');
        expect(refused.success).toBe(false);
        expect(refused.message).toMatch(/deux mains/);

        const lightHero = forgeMidGame();
        const swapped = equip(lightHero, shieldItem('ancestral_shield'), 'leftHand');
        expect(swapped.success).toBe(true);
        expect(swapped.unequipped.id).toBe('dragon_shield');
        expect(lightHero.equipment.leftHand.id).toBe('ancestral_shield');
    });

    test('un bouclier ne va qu\'en main gauche ; un objet rechargeable ne va que dans l\'emplacement d\'objet', () => {
        const shield = shieldItem('jade_shield');
        expect(canEquip(shield, 'rightHand')).toBe(false);
        expect(canEquip(shield, 'leftHand')).toBe(true);
        const potion = reusableItem('healthPotion');
        expect(canEquip(potion, 'item')).toBe(true);
        expect(canEquip(potion, 'leftHand')).toBe(false);
    });

    test('défense d\'équipement : bouclier de main gauche + objet porté, additifs ; main vide = 0', () => {
        const p = forgeMidGame();
        expect(getEquipmentDefenseBonus(p)).toBe(shieldItem('dragon_shield').defense);
        expect(getEquipmentDefenseBonus(forgeNewGame())).toBe(0);
        p.equipment.item = { ...shieldItem('jade_shield') };
        expect(getEquipmentDefenseBonus(p)).toBe(shieldItem('dragon_shield').defense + shieldItem('jade_shield').defense);
    });

    test('bonus de biome : +25 % (minimum +2) seulement dans le biome de l\'arme', () => {
        const main = forgeLateGame().equippedWeapon;
        const biomeWeapon = allWeapons.find(w => w.biome && w.damage >= 8);
        expect(weaponBiomeBonus(biomeWeapon, biomeWeapon.biome)).toBe(Math.max(2, Math.round(biomeWeapon.damage * BIOME_WEAPON_BONUS)));
        expect(weaponBiomeBonus(biomeWeapon, 'autre')).toBe(0);
        expect(weaponBiomeBonus({ biome: 'x', damage: 4 }, 'x')).toBe(2);   // plancher
        expect(weaponBiomeBonus({ damage: 99 }, 'x')).toBe(0);
        expect(weaponBiomeBonus(null, 'x')).toBe(0);
        expect(weaponBiomeBonus(main, undefined)).toBe(0);
    });

    test('identifiants d\'armes de chaque jalon : toujours des fiches du catalogue, aucun doublon', () => {
        MILESTONES.forEach(m => CLASS_IDS.forEach(c => {
            const p = m.forge(c);
            expect(new Set(ids(p.weapons)).size).toBe(p.weapons.length);
            p.weapons.forEach(w => expect(getWeaponById(w.id)).toEqual(w));
        }));
    });
});

describe('objets réutilisables des joueurs sauvegardés', () => {
    test('potion vidée au niveau 15 : refusée avec son compte à rebours, rechargée après le bon nombre de tours', () => {
        const p = forgeArenaUnlock();
        p.hp = p.maxHp - 5;
        const potion = p.inventory[0];
        const refus = useItem(potion.id, p, null, 0);
        expect(refus.success).toBe(false);
        expect(refus.message).toContain('3 tours');
        expect(tickReusableRecharge(p)).toEqual([]);
        expect(tickReusableRecharge(p)).toEqual([]);
        expect(tickReusableRecharge(p)).toEqual([potion]);
        expect(potion.chargesLeft).toBe(potion.chargesPerCycle);
        expect(useItem(potion.id, p, null, 0).success).toBe(true);
        expect(p.hp).toBe(p.maxHp);   // le soin ne dépasse jamais les PV max
    });

    test('même après relecture du fichier, la recharge reprend où elle en était', async () => {
        const { player: relu } = await roundTrip(forgeArenaUnlock());
        tickReusableRecharge(relu);
        tickReusableRecharge(relu);
        expect(relu.inventory[0].chargesLeft).toBe(0);
        expect(tickReusableRecharge(relu)).toHaveLength(1);
        expect(relu.inventory[0].chargesLeft).toBe(relu.inventory[0].chargesPerCycle);
    });

    test('bonus « pour ce combat » (Talisman de Puissance) : une seule application, même relu depuis le fichier', async () => {
        const { player: relu } = await roundTrip(forgeArenaUnlock());
        const talisman = relu.inventory.find(i => i.id === 'power_talisman');
        expect(isCombatLongEffect(talisman.effect)).toBe(true);
        const attack = relu.attack;
        const idx = relu.inventory.indexOf(talisman);
        expect(useItem('power_talisman', relu, null, idx).success).toBe(true);
        expect(relu.attack).toBe(attack + talisman.effect.tempAttack);
        talisman.chargesLeft = talisman.chargesPerCycle;
        expect(useItem('power_talisman', relu, null, idx).success).toBe(false);
        expect(relu.attack).toBe(attack + talisman.effect.tempAttack);
        expect(relu.itemBuffs).toBeDefined();
    });

    test('pierre d\'énergie : mana de chaque couleur, plafonné à la réserve du joueur', () => {
        const p = forgeLateGame();
        const stone = p.inventory.find(i => i.id === 'energy_stone');
        p.mana.red = BASE_MANA_CAP - 1;
        useItem('energy_stone', p, null, p.inventory.indexOf(stone));
        expect(p.mana.red).toBe(BASE_MANA_CAP);
        MANA_COLORS.filter(c => c !== 'red').forEach(c => expect(p.mana[c]).toBe(stone.effect.mana));
    });

    test('dernière charge consommée : le compte à rebours démarre ; avec deux charges, une seule est retirée (cas limite)', () => {
        const p = forgePlayer({ level: 10, inventoryIds: ['honey_vial'] });
        const vial = p.inventory[0];
        p.hp = 1;
        expect(useItem('honey_vial', p, null, 0).success).toBe(true);
        expect(vial.chargesLeft).toBe(vial.chargesPerCycle - 1);
        expect(vial.rechargeLeft).toBe(0);
        expect(useItem('honey_vial', p, null, 0).success).toBe(true);
        expect(vial.chargesLeft).toBe(0);
        expect(vial.rechargeLeft).toBe(vial.rechargeTurns);
    });

    test('recharger au retour en exploration remplit toutes les charges', () => {
        const p = forgeArenaUnlock();
        const recharged = rechargeReusableItems(p);
        expect(recharged.map(i => i.id)).toEqual(['healthPotion']);
        p.inventory.forEach(i => expect(i.chargesLeft).toBe(i.chargesPerCycle));
    });

    test('objet introuvable ou inventaire vide : refus propre', () => {
        const p = forgeNewGame();
        expect(useItem('healthPotion', p, null)).toMatchObject({ success: false, message: 'Objet introuvable' });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 7. Terrain : embuscade, faiblesse observée, piège, hautes herbes, belvédère, bandeau
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('terrain : approche et embuscade', () => {
    const enemy = { x: 5, y: 5 };
    const down = { dx: 0, dy: 1 };

    test('de dos : embuscade (+1 PA pour l\'arme équipée, le héros joue en premier)', () => {
        CLASS_IDS.forEach(c => {
            const hero = forgeEarlyGame(c);
            const approach = approachOf(down, enemy, { x: 5, y: 3 });
            expect(approach).toBe(FACE_BEHIND);
            const prep = buildPrep({ approach });
            expect(prep.tags).toEqual(['ambush']);
            expect(prep.playerFirst).toBe(true);
            expect(hero.equippedWeapon.actionPoints + prep.playerBonusPA).toBe(hero.equippedWeapon.actionPoints + AMBUSH_BONUS_PA);
        });
    });

    test('de face et de côté : aucun avantage ni handicap', () => {
        expect(approachOf(down, enemy, { x: 5, y: 8 })).toBe(FACE_FRONT);
        expect(approachOf(down, enemy, { x: 9, y: 5 })).toBe(FACE_SIDE);
        expect(buildPrep({ approach: FACE_FRONT })).toMatchObject({ tags: [], playerBonusPA: 0, playerFirst: false, enemyFirst: false });
        expect(buildPrep({ approach: FACE_SIDE }).tags).toEqual([]);
    });

    test('diagonale : le côté dépend du regard (derrière en diagonale = embuscade)', () => {
        expect(approachOf(down, enemy, { x: 6, y: 3 })).toBe(FACE_BEHIND);
        expect(approachOf(down, enemy, { x: 6, y: 7 })).toBe(FACE_FRONT);
    });

    test('regard inconnu ou nul : l\'ennemi est réputé regarder vers le bas (cas limite)', () => {
        expect(approachOf(undefined, enemy, { x: 5, y: 3 })).toBe(FACE_BEHIND);
        expect(approachOf({ dx: 0, dy: 0 }, enemy, { x: 5, y: 8 })).toBe(FACE_FRONT);
    });

    test('combat engagé par un héros sauvegardé arrivé dans le dos d\'une sentinelle : la rencontre porte l\'embuscade jusqu\'à l\'ennemi créé', () => {
        const hero = forgeArenaUnlock('assassin');
        const s = sessionIn(hero, miniWorld({ enemies: [sentinel('s1', 5, 5)] }), { x: 5, y: 3 });
        const enc = encounterFor(s, 's1', hero.level);
        expect(enc.prep.tags).toEqual(['ambush']);
        const foe = createMapEnemy(enc);
        expect(foe.prep).toMatchObject({ tags: ['ambush'], playerBonusPA: AMBUSH_BONUS_PA, playerFirst: true });
        expect(foe.biome).toBe('paddy');
    });

    test('l\'embuscade n\'existe pas contre un boss, un duel ni un adversaire d\'arène', () => {
        const hero = forgeArenaUnlock();
        const world = miniWorld({ enemies: [
            sentinel('boss', 5, 5, { boss: { name: 'Boss', level: 5 }, permanent: true }),
            sentinel('duelliste', 8, 5, { duel: { mirror: true }, permanent: true }),
            sentinel('gardien', 2, 5, { arena: { tier: 1, wave: 1 }, permanent: true })
        ] });
        const s = sessionIn(hero, world, { x: 5, y: 3 });
        ['boss', 'duelliste', 'gardien'].forEach(id => expect(prepFor(s, s.rt.enemyIndex[id].def).tags).toEqual([]));
    });
});

describe('terrain : faiblesse observée à une case de l\'ennemi', () => {
    const at = (dx, dy, extra = {}) => ({ id: 'a', x: 5 + dx, y: 5 + dy, aggro: 4, ...extra });
    const pos = { x: 5, y: 5 };

    test('la règle : portée de 1 case, 3 secondes d\'immobilité', () => {
        expect(OBSERVE_RANGE).toBe(1);
        expect(OBSERVE_MS).toBe(3000);
    });

    test('immobile pendant OBSERVE_MS à une case : faiblesse repérée ; une milliseconde de moins : rien', () => {
        expect(observationTarget(OBSERVE_MS, pos, [at(1, 0)])).toBe('a');
        expect(observationTarget(OBSERVE_MS - 1, pos, [at(1, 0)])).toBeNull();
    });

    test('toutes les cases adjacentes (diagonales comprises) comptent, pas à deux cases', () => {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
            if (dx || dy) expect(observationTarget(OBSERVE_MS, pos, [at(dx, dy)])).toBe('a');
        }
        [[2, 0], [0, -2], [2, 2], [-3, 1]].forEach(([dx, dy]) => expect(observationTarget(OBSERVE_MS, pos, [at(dx, dy)])).toBeNull());
    });

    test('sur la même case ou déjà observé : pas de nouvelle observation ; boss protégé et mirage jamais observables', () => {
        expect(observationTarget(OBSERVE_MS, pos, [at(1, 0)], { a: true })).toBeNull();
        expect(observationTarget(OBSERVE_MS, pos, [at(1, 0, { shielded: true })])).toBeNull();
        expect(observationTarget(OBSERVE_MS, pos, [at(1, 0, { illusion: true })])).toBeNull();
    });

    test('plusieurs ennemis à portée : le plus proche non observé ; portée personnalisée respectée', () => {
        const near = { id: 'near', x: 6, y: 5 }, far = { id: 'far', x: 7, y: 5 };
        expect(observationTarget(OBSERVE_MS, pos, [far, near], {}, 2)).toBe('near');
        expect(observationTarget(OBSERVE_MS, pos, [far, near], { near: true }, 2)).toBe('far');
        expect(observationTarget(OBSERVE_MS, pos, [far])).toBeNull();
        expect(observationTarget(OBSERVE_MS, pos, [])).toBeNull();
    });

    test('en jeu : un héros relu depuis son fichier qui reste immobile 3 s à côté d\'une sentinelle perce sa faiblesse, qui entre dans la préparation du combat', async () => {
        const { player: relu } = await roundTrip(forgeEarlyGame('templar'));
        const s = sessionIn(relu, miniWorld({ enemies: [sentinel('s1', 5, 5)] }), { x: 6, y: 5 });   // à côté (de côté : pas d'embuscade)
        expect(tick(s, OBSERVE_MS - 200).some(e => e.type === 'observed')).toBe(false);
        const events = tick(s, 200);
        expect(events).toContainEqual(expect.objectContaining({ type: 'observed', enemyId: 's1', templateId: 'goblin_saboteur' }));
        const prep = prepFor(s, s.rt.enemyIndex.s1.def);
        expect(prep.tags).toContain('observed');
        expect(prep.weaknessRevealed).toBe(true);
        expect(tick(s, OBSERVE_MS).some(e => e.type === 'observed')).toBe(false);   // une seule fois
    });

    test('en jeu : à deux cases, ou après un pas (immobilité remise à zéro), aucune observation', () => {
        const hero = forgeEarlyGame();
        const far = sessionIn(hero, miniWorld({ enemies: [sentinel('s1', 5, 5)] }), { x: 7, y: 5 });
        expect(tick(far, OBSERVE_MS * 2).some(e => e.type === 'observed')).toBe(false);
        expect(far.data.observed).toEqual({});

        const moving = sessionIn(hero, miniWorld({ enemies: [sentinel('s1', 5, 5)] }), { x: 7, y: 7 });
        tick(moving, OBSERVE_MS - 500);
        expect(tryMove(moving, -1, 0, { playerLevel: 5 })).toMatchObject({ type: 'moved' });   // 6,7 : encore loin (2 cases)
        expect(moving.rt.stillMs).toBe(0);
    });

    test('la faiblesse repérée n\'est pas écrite dans le fichier : après rechargement, il faut observer de nouveau', async () => {
        const hero = forgeEarlyGame();
        const s = sessionIn(hero, miniWorld({ enemies: [sentinel('s1', 5, 5)] }), { x: 6, y: 5 });
        tick(s, OBSERVE_MS);
        expect(s.data.observed.s1).toBe(true);
        hero.exploration = { ...hero.exploration, ...s.data };
        const { player: relu } = await roundTrip(hero);
        expect(relu.exploration.observed).toBeUndefined();
        const again = sessionIn(relu, miniWorld({ enemies: [sentinel('s1', 5, 5)] }), { x: 6, y: 5 });
        expect(again.data.observed).toEqual({});
    });

    test('dégâts de faiblesse : +25 % (arrondi au supérieur) sur la couleur faible, pour les sorts du héros de niveau 30', () => {
        const hero = forgeLateGame('sorcerer');
        hero.activeSpells.filter(s => s.dmg).forEach(s => {
            costColors(s).forEach(color => {
                expect(weaknessDamage(s.dmg, color, color, true)).toBe(Math.ceil(s.dmg * (1 + WEAKNESS_DAMAGE_BONUS)));
                expect(weaknessDamage(s.dmg, color, color, false)).toBe(s.dmg);
                const other = MANA_COLORS.find(c => c !== color);
                expect(weaknessDamage(s.dmg, other, color, true)).toBe(s.dmg);
            });
        });
        expect(weaknessDamage(1, 'red', 'red', true)).toBe(2);   // arrondi au supérieur dès le premier point
        expect(weaknessDamage(0, 'red', 'red', true)).toBe(0);
        expect(weaknessDamage(10, 'red', null, true)).toBe(10);
    });

    test('couleur faible : la moins résistée, ordre fixe en cas d\'égalité ; valeurs absentes ignorées', () => {
        expect(weakestColor({ red: 0.3, blue: 0.1, green: 0.1, yellow: 0.5, purple: 0.2 })).toBe('blue');
        expect(weakestColor({ red: 0.2, blue: 0.2, green: 0.2, yellow: 0.2, purple: 0.2 })).toBe('red');
        expect(weakestColor({ green: 0.4, purple: 0.1 })).toBe('purple');
        expect(weakestColor({ red: 'x' })).toBeNull();
        expect(weakestColor(undefined)).toBeNull();
    });

    test('chaque gabarit d\'ennemi a une couleur faible connue (la faiblesse repérée a toujours un sens)', () => {
        const catalog = JSON.parse(read('enemies.catalog.json'));
        catalog.forEach(t => expect(MANA_COLORS).toContain(weakColorOfTemplate(t.id)));
    });
});

describe('terrain : piège, hautes herbes, belvédère', () => {
    const world = (kind, where) => miniWorld({ enemies: [sentinel('s1', 5, 5)], spots: [{ kind, ...where }] });
    const hero = () => forgeMidGame('barbarian');

    test('ennemi dans un piège : commence empoisonné', () => {
        const s = sessionIn(hero(), world('trap', { x: 5, y: 5 }), { x: 5, y: 8 });
        const prep = prepFor(s, s.rt.enemyIndex.s1.def);
        expect(prep.enemyStatus).toEqual({ poisoned: 3 });
        expect(prep.tags).toEqual(['trap']);
    });

    test('ennemi dans les hautes herbes : commence désorienté', () => {
        const s = sessionIn(hero(), world('tallGrass', { x: 5, y: 5 }), { x: 5, y: 8 });
        expect(prepFor(s, s.rt.enemyIndex.s1.def).enemyStatus).toEqual({ confused: 2 });
    });

    test('piège ET herbes sous l\'ennemi : le piège l\'emporte', () => {
        expect(buildPrep({ enemyOnTrap: true, enemyOnGrass: true })).toMatchObject({ enemyStatus: { poisoned: 3 }, tags: ['trap'] });
    });

    test('piège placé à côté de l\'ennemi (pas dessous) : sans effet', () => {
        const s = sessionIn(hero(), world('trap', { x: 6, y: 5 }), { x: 5, y: 8 });
        expect(prepFor(s, s.rt.enemyIndex.s1.def).enemyStatus).toBeNull();
        expect(spotAt(s.screens.t.spots, 5, 5, 'trap')).toBeNull();
        expect(spotAt(s.screens.t.spots, 6, 5, 'trap')).not.toBeNull();
        expect(spotAt(s.screens.t.spots, 6, 5, 'tallGrass')).toBeNull();
        expect(spotAt(undefined, 0, 0)).toBeNull();
    });

    test('combat lancé depuis un belvédère : le plateau démarre avec des tuiles de la couleur faible', () => {
        const s = sessionIn(hero(), world('outlook', { x: 5, y: 8 }), { x: 5, y: 8 });
        const prep = prepFor(s, s.rt.enemyIndex.s1.def);
        expect(prep.boardBoost).toEqual({ count: OUTLOOK_TILES });
        expect(prep.tags).toContain('outlook');
        // hors belvédère : rien
        const away = sessionIn(hero(), world('outlook', { x: 1, y: 1 }), { x: 5, y: 8 });
        expect(prepFor(away, away.rt.enemyIndex.s1.def).boardBoost).toBeNull();
    });

    test('belvédère : exactement OUTLOOK_TILES tuiles converties, jamais celles déjà de la bonne couleur', () => {
        const board = Array.from({ length: boardSize * boardSize }, (_, i) => MANA_COLORS[i % MANA_COLORS.length]);
        const reds = board.filter(t => t === 'red').length;
        const changed = applyBoardBoost(board, 'red', OUTLOOK_TILES, seq([0.1, 0.9, 0.5, 0.3, 0.7]));
        expect(changed).toHaveLength(OUTLOOK_TILES);
        expect(new Set(changed).size).toBe(OUTLOOK_TILES);
        expect(board.filter(t => t === 'red').length).toBe(reds + OUTLOOK_TILES);
        changed.forEach(i => expect(board[i]).toBe('red'));
    });

    test('belvédère : tirage déterministe avec le même rng, et pas assez de candidates = on convertit ce qu\'on peut (cas limite)', () => {
        const mk = () => Array.from({ length: 16 }, (_, i) => MANA_COLORS[i % MANA_COLORS.length]);
        const a = mk(), b = mk();
        expect(applyBoardBoost(a, 'blue', 5, lcg(3))).toEqual(applyBoardBoost(b, 'blue', 5, lcg(3)));
        const almost = ['blue', 'blue', 'blue', 'red'];
        expect(applyBoardBoost(almost, 'blue', 5, () => 0)).toEqual([3]);
        const allBlue = ['blue', 'blue'];
        expect(applyBoardBoost(allBlue, 'blue', 5, () => 0)).toEqual([]);
        expect(applyBoardBoost(['mur', 'red'], 'blue', 5, () => 0)).toEqual([1]);   // les cases spéciales ne sont jamais converties
    });

    test('avantages cumulés : embuscade + piège + belvédère + faiblesse observée', () => {
        const prep = buildPrep({ approach: FACE_BEHIND, observed: true, enemyOnTrap: true, onOutlook: true });
        expect(prep.tags).toEqual(['ambush', 'observed', 'trap', 'outlook']);
        expect(prep.lines).toHaveLength(4);
        expect(prep).toMatchObject({ playerBonusPA: AMBUSH_BONUS_PA, playerFirst: true, weaknessRevealed: true, enemyStatus: { poisoned: 3 }, boardBoost: { count: OUTLOOK_TILES } });
    });
});

describe('terrain : bandeau d\'avantage (prepBanner)', () => {
    test('aucune préparation : pas de bandeau (combat de face normal)', () => {
        expect(prepBanner(null)).toBeNull();
        expect(prepBanner(undefined)).toBeNull();
        expect(prepBanner(buildPrep())).toBeNull();
        expect(prepBanner(buildPrep({ approach: FACE_FRONT }))).toBeNull();
        expect(prepBanner({ lines: [] })).toBeNull();
    });

    test.each([
        ['embuscade', { approach: FACE_BEHIND }, 'Attaque surprise !'],
        ['piège', { enemyOnTrap: true }, 'Piège !'],
        ['hautes herbes', { enemyOnGrass: true }, 'Hautes herbes !'],
        ['belvédère', { onOutlook: true }, 'Position dominante !'],
        ['faiblesse repérée', { observed: true }, 'Faiblesse repérée !']
    ])('%s : titre du bandeau', (_, ctx, title) => {
        const banner = prepBanner(buildPrep(ctx));
        expect(banner.title).toBe(title);
        expect(banner.icon).toBeTruthy();
        expect(banner.lines.length).toBe(1);
    });

    test('le titre suit l\'avantage principal, et une ligne est affichée par conséquence', () => {
        const banner = prepBanner(buildPrep({ observed: true, enemyOnTrap: true, approach: FACE_BEHIND }));
        expect(banner.title).toBe('Attaque surprise !');
        expect(banner.lines).toHaveLength(3);
    });

    test('quand l\'ennemi joue en premier : bandeau « vous attend » et ligne ajoutée', () => {
        const prep = { ...buildPrep({ onOutlook: true }), enemyFirst: true };
        const banner = prepBanner(prep, 'Loup de braise');
        expect(banner.title).toBe('Loup de braise vous attend !');
        expect(banner.lines.at(-1)).toBe('Loup de braise joue en premier.');
        expect(prep.lines).toHaveLength(1);   // la préparation d'origine n'est pas modifiée
    });

    test('cas limite : étiquette inconnue -> titre générique ; nom d\'ennemi par défaut', () => {
        expect(prepBanner({ tags: ['inconnue'], lines: ['x'] }).title).toBe('Avantage du terrain !');
        expect(prepBanner({ tags: ['ambush'], lines: ['x'], enemyFirst: true }).title).toBe('L\'ennemi vous attend !');
    });

    test('le bandeau n\'a ni emoji ni texte vide', () => {
        [{ approach: FACE_BEHIND }, { enemyOnTrap: true }, { enemyOnGrass: true }, { onOutlook: true }, { observed: true }].forEach(ctx => {
            const b = prepBanner(buildPrep(ctx));
            [b.title, ...b.lines].forEach(t => { expect(t.length).toBeGreaterThan(3); expect(/\p{Extended_Pictographic}/u.test(t)).toBe(false); });
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 8. Duel contre Fengmeng (miroir, tirs rapides, pièges de zone, deux phases)
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('duel : règles appliquées au héros sauvegardé', () => {
    test('l\'Archer Miroir copie les sorts équipés et l\'arme du héros, par copies indépendantes', () => {
        MILESTONES.filter(m => m.level >= 5).forEach(m => {
            const hero = m.forge('assassin');
            const copy = mirrorLoadout(hero, getClassSpells('assassin', hero.level));
            expect(ids(copy.spells)).toEqual(ids(hero.activeSpells));
            expect(copy.weapon).toEqual(hero.equippedWeapon);
            expect(copy.playerClass).toBe('assassin');
            copy.spells.forEach((s, i) => expect(s).not.toBe(hero.activeSpells[i]));
            expect(copy.weapon).not.toBe(hero.equippedWeapon);
        });
    });

    test('héros sans sort équipé (début de partie) : le miroir prend les sorts de classe connus, quatre au plus', () => {
        CLASS_IDS.forEach(c => {
            const hero = forgeNewGame(c);
            const copy = mirrorLoadout(hero, getClassSpells(c, 99));
            expect(copy.spells.length).toBeGreaterThan(0);
            expect(copy.spells.length).toBeLessThanOrEqual(4);
            copy.spells.forEach(s => expect(s.class).toBe(c));
            expect(copy.weapon.id).toBe(playerClasses[c].startingWeaponId);
        });
    });

    test('le miroir copie aussi les sorts multi-mana et avancés du héros de niveau 30', () => {
        const hero = forgeLateGame('templar');
        const copy = mirrorLoadout(hero);
        expect(copy.spells.some(s => s.type === 'advanced')).toBe(true);
        copy.spells.forEach((s, i) => expect(costOf(s)).toEqual(costOf(hero.activeSpells[i])));
    });

    test('phase 1 : le héros entre affaibli (fraction des PV max), jamais à 0 PV', () => {
        const pct = SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3a').duel.heroHpPct;
        MILESTONES.forEach(m => {
            const hero = m.forge('templar');
            const hp = weakenedHp(hero.maxHp, pct);
            expect(hp).toBe(Math.max(1, Math.floor(hero.maxHp * pct)));
            expect(hp).toBeGreaterThanOrEqual(1);
            expect(hp).toBeLessThan(hero.maxHp);
        });
        expect(weakenedHp(1, pct)).toBe(1);
        expect(weakenedHp(100, 0)).toBe(100);
        expect(weakenedHp(100, 1)).toBe(100);
        expect(weakenedHp(100, -0.5)).toBe(100);
    });

    test('phase 2 : tirs rapides tous les 3 tours, pièges de zone tous les 2 tours (les deux au tour 6)', () => {
        const duel = SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3b').duel;
        const plan = Array.from({ length: 12 }, (_, i) => duelTurnPlan(duel, i + 1, 0));
        expect(plan.map((p, i) => p.layTrap ? i + 1 : 0).filter(Boolean)).toEqual([2, 4, 6, 8, 10, 12]);
        expect(plan.map((p, i) => p.rapidShot ? i + 1 : 0).filter(Boolean)).toEqual([3, 6, 9, 12]);
        expect(duelTurnPlan(duel, 6, 4)).toEqual({ detonate: 4, layTrap: true, rapidShot: true });
        expect(duelTurnPlan({ mirror: true }, 6, 2)).toEqual({ detonate: 2, layTrap: false, rapidShot: false });   // phase 1 : ni piège ni tir rapide
        expect(duelTurnPlan(undefined, 6, 2)).toEqual({ detonate: 0, layTrap: false, rapidShot: false });
        expect(duelTurnPlan(duel, 5, -3).detonate).toBe(0);   // cas limite : cases piégées négatives
    });

    test('une zone piégée est un carré contigu dans le plateau, quel que soit le tirage', () => {
        [0, 0.25, 0.5, 0.75, 0.999999].forEach(a => [0, 0.5, 0.999999].forEach(b => {
            const cells = pickTrapZone(boardSize, seq([a, b]));
            expect(cells).toHaveLength(TRAP_SIZE * TRAP_SIZE);
            cells.forEach(i => { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(boardSize * boardSize); });
            const rows = cells.map(i => Math.floor(i / boardSize)), cols = cells.map(i => i % boardSize);
            expect(Math.max(...rows) - Math.min(...rows)).toBe(TRAP_SIZE - 1);
            expect(Math.max(...cols) - Math.min(...cols)).toBe(TRAP_SIZE - 1);
        }));
        expect(pickTrapZone(TRAP_SIZE, () => 0.9)).toEqual([0, 1, 2, TRAP_SIZE, TRAP_SIZE + 1, TRAP_SIZE + 2, 2 * TRAP_SIZE, 2 * TRAP_SIZE + 1, 2 * TRAP_SIZE + 2]);   // plateau minimal : une seule zone possible
    });

    test('piège : plus il reste de cases, plus on perd ; une détonation complète n\'achève pas un héros de niveau 19 à PV pleins', () => {
        const s = createSession({ screenId: 'lune', x: SCREENS.lune.spawn.x, y: SCREENS.lune.spawn.y, defeated: ['fengmeng_3a'] });
        const foe = createMapEnemy(encounterFor(s, 'fengmeng_3b', 19));
        let previous = -1;
        for (let cells = 0; cells <= TRAP_SIZE * TRAP_SIZE; cells++) {
            const dmg = trapDamage(cells, foe.attack);
            expect(dmg).toBeGreaterThanOrEqual(previous);
            previous = dmg;
        }
        const hero = forgePlayer({ classId: 'templar', level: 19 });
        expect(trapDamage(TRAP_SIZE * TRAP_SIZE, foe.attack)).toBeLessThan(hero.maxHp);
        expect(trapDamage(-4, foe.attack)).toBe(0);
        expect(trapDamage(3, 0)).toBe(3 * 2);   // plancher de 2 par case
    });
});

describe('duel : deux phases de Fengmeng sur une sauvegarde', () => {
    const loneAt = (patch = {}) => createSession({ screenId: 'lune', x: SCREENS.lune.spawn.x, y: SCREENS.lune.spawn.y, ...patch });

    test('phase 2 invisible tant que la phase 1 n\'est pas vaincue', () => {
        const s = loneAt();
        const phase2 = SCREENS.lune.enemies.find(e => e.id === 'fengmeng_3b');
        expect(isEntityVisible(s, phase2)).toBe(false);
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3a');
        expect(aliveEnemies(s).map(e => e.def.id)).not.toContain('fengmeng_3b');
    });

    test('vaincre la phase 1 fait apparaître la phase 2 (niveau supérieur, règles de fureur)', () => {
        const s = loneAt();
        const level1 = encounterFor(s, 'fengmeng_3a', 18);
        const events = markEnemyDefeated(s, 'fengmeng_3a');
        expect(events.some(e => e.type === 'scene')).toBe(true);
        expect(aliveEnemies(s).map(e => e.def.id)).toContain('fengmeng_3b');
        const level2 = encounterFor(s, 'fengmeng_3b', 19);
        expect(level1.duel).toMatchObject({ mirror: true });
        expect(level1.duel.rapidShots).toBeUndefined();
        expect(level2.duel).toMatchObject({ rapidShots: expect.any(Number), zoneTraps: expect.any(Number) });
        expect(level2.duel.mirror).toBeUndefined();
        expect(level2.level).toBeGreaterThan(level1.level);
        expect(level1.boss).toBeTruthy();
        expect(level2.boss).toBeTruthy();
    });

    test('un héros de niveau 15 sauvegardé entre les deux phases retrouve la phase 2 après relecture', async () => {
        const hero = forgeEndGame();
        hero.exploration = { ...hero.exploration, screenId: 'lune', x: SCREENS.lune.spawn.x, y: SCREENS.lune.spawn.y, defeated: ['fengmeng_3a'] };
        const { session } = await reloadSession(hero);
        expect(aliveEnemies(session).map(e => e.def.id)).toEqual(expect.arrayContaining(['fengmeng_3b']));
        expect(isEnemyAlive(session, 'fengmeng_3a')).toBe(false);
    });

    test('phase 2 vaincue : la mort de Fengmeng est définitive (permanent) et ne revient pas après un rechargement', async () => {
        const s = loneAt({ defeated: ['fengmeng_3a'] });
        markEnemyDefeated(s, 'fengmeng_3b');
        const hero = forgeMaxLevel();
        hero.exploration = { ...hero.exploration, ...s.data };
        const { session } = await reloadSession(hero);
        expect(aliveEnemies(session).filter(e => e.def.id.startsWith('fengmeng')).map(e => e.def.id)).toEqual([]);
    });

    test('le niveau du duel est fixe : il ne dépend ni du niveau du héros ni de sa classe, seulement de la Nouvelle Partie +', async () => {
        const base = encounterFor(loneAt(), 'fengmeng_3a', 1).level;
        for (const forge of [forgeNewGame, forgeArenaUnlock, forgeMaxLevel]) {
            expect(encounterFor(loneAt(), 'fengmeng_3a', forge().level).level).toBe(base);
        }
        expect(encounterFor(loneAt({ ngPlus: 2 }), 'fengmeng_3a', 1).level).toBe(base + 3 * 2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 9. Arène des Mille Flèches
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('arène : accès et état d\'un héros sauvegardé', () => {
    test('ouverte dès le 3e terrain, quel que soit le niveau ; fermée avant (même au niveau 15)', () => {
        expect(ARENA_UNLOCK_REGION).toBe(REGION_ORDER[2]);
        MILESTONES.forEach(m => {
            const hero = m.forge('templar');
            const unlocked = isArenaUnlocked(hero.exploration.visitedScreens);
            expect(unlocked).toBe(REGION_ORDER.filter(r => hero.exploration.visitedScreens.some(id => SCREENS[id].region === r)).includes(ARENA_UNLOCK_REGION));
        });
        const lowLevelFarAway = forgePlayer({ level: 1, regions: 3 });
        expect(isArenaUnlocked(lowLevelFarAway.exploration.visitedScreens)).toBe(true);
        const level15TwoTerrains = forgePlayer({ level: 15, regions: 2 });
        expect(isArenaUnlocked(level15TwoTerrains.exploration.visitedScreens)).toBe(false);
    });

    test('un terrain plus avancé compte aussi ; aucune visite ou valeur invalide -> fermée (cas limite)', () => {
        expect(isArenaUnlocked(forgePlayer({ level: 40, regions: REGION_ORDER.length }).exploration.visitedScreens)).toBe(true);
        expect(isArenaUnlocked([])).toBe(false);
        expect(isArenaUnlocked(null)).toBe(false);
        expect(isArenaUnlocked(['arena_hall'])).toBe(false);
    });

    test('progression d\'arène (cercles terminés, records, victoires) conservée par le fichier', async () => {
        const { player: relu, data } = await roundTrip(forgeArenaVeteran());
        expect(data.player.exploration.arena).toEqual({ cleared: [1, 2], best: { 1: 4, 2: 4, 3: 2 }, wins: 11 });
        const s = createSession(relu.exploration);
        expect(s.data.arena).toMatchObject({ cleared: [1, 2], best: { 1: 4, 2: 4, 3: 2 }, wins: 11 });
    });

    test('portes : cercles 1 à 3 ouverts pour le vétéran, cercle 4 fermé ; le héros neuf ne peut entrer qu\'au cercle 1', async () => {
        const door = (s, tier) => currentScreen(s).exits.find(e => e.to === arenaRoomId(tier));
        const { session: vet } = await reloadSession(forgeArenaVeteran());
        expect(enterArena(vet)).toBe(true);
        [1, 2, 3].forEach(t => expect(isExitLocked(vet, door(vet, t))).toBe(false));
        expect(isExitLocked(vet, door(vet, 4))).toBe(true);

        const { session: rookie } = await reloadSession(forgeArenaUnlock());
        enterArena(rookie);
        expect(isExitLocked(rookie, door(rookie, 1))).toBe(false);
        expect(isExitLocked(rookie, door(rookie, 2))).toBe(true);
        expect(door(rookie, 2).requires).toBe(arenaClearedFlag(1));
    });

    test('héros sauvegardé DANS l\'arène : rechargé dans le parvis, sortie vers son point de retour', async () => {
        const hero = forgeInArena();
        const back = { ...hero.exploration.arena.returnTo };
        const { relu, session } = await reloadSession(hero);
        expect(relu.exploration.arena.returnTo).toEqual(back);
        expect(inArena(session)).toBe(true);
        expect(session.data.screenId).toBe(ARENA_HALL);
        expect(leaveArena(session)).toBe(true);
        expect(inArena(session)).toBe(false);
        expect(session.data.screenId).toBe(back.screenId);
    });

    test('défaite dans l\'arène : le héros est expulsé vers son point de retour, sans perdre sa progression d\'arène', async () => {
        const { session } = await reloadSession(forgeInArena());
        const room = arenaRoomId(1);
        enterScreen(session, room, SCREENS[room].spawn);
        const wins = session.data.arena.wins;
        resetAfterDefeat(session);
        expect(inArena(session)).toBe(false);
        expect(session.data.arena.cleared).toEqual([1, 2]);
        expect(session.data.arena.wins).toBe(wins);
    });

    test('point de retour invalide dans le fichier : retour au village de départ (cas limite)', async () => {
        const hero = forgeInArena();
        hero.exploration.arena.returnTo = { screenId: 'ecran_disparu', x: 3, y: 3 };
        const { session } = await reloadSession(hero);
        expect(leaveArena(session)).toBe(true);
        expect(session.data.screenId).toBe(START_SCREEN);
    });

    test('hors de l\'arène : sortir ne fait rien ; entrer deux fois non plus', async () => {
        const { session } = await reloadSession(forgeArenaUnlock());
        expect(leaveArena(session)).toBe(false);
        expect(enterArena(session)).toBe(true);
        expect(enterArena(session)).toBe(false);
    });
});

describe('arène : cercles, gardiens, maître protégé, primes', () => {
    const tier = id => ARENA_TIERS.find(t => t.id === id);

    test('maître d\'arène intouchable tant qu\'il reste un gardien vivant ; accessible quand le dernier tombe', async () => {
        const { session: s } = await reloadSession(forgeArenaVeteran());
        const t = tier(3);
        enterArena(s);
        enterScreen(s, arenaRoomId(3), SCREENS[arenaRoomId(3)].spawn);
        const master = s.rt.enemyIndex[arenaMasterId(3)].def;
        const guards = Array.from({ length: t.waves - 1 }, (_, i) => arenaGuardId(3, i + 1));
        expect(master.shieldedBy).toBe(gymGuardsGroup(3));
        expect(isShielded(s, master)).toBe(true);
        guards.slice(0, -1).forEach(g => { markEnemyDefeated(s, g); expect(isShielded(s, master)).toBe(true); });
        markEnemyDefeated(s, guards.at(-1));
        expect(isShielded(s, master)).toBe(false);
    });

    test('le contact avec le maître protégé affiche son texte au lieu de lancer le combat', async () => {
        const { session: s } = await reloadSession(forgeArenaVeteran());
        enterArena(s);
        enterScreen(s, arenaRoomId(1), SCREENS[arenaRoomId(1)].spawn);
        const master = s.rt.enemyIndex[arenaMasterId(1)].def;
        s.data.x = master.x; s.data.y = master.y + 1; s.rt.grace = 0;
        const res = tryMove(s, 0, -1, { playerLevel: 15 });
        expect(res.type).toBe('shielded');
        expect(res.lines.join(' ')).toContain(tier(1).master.name);
    });

    test('première victoire sur un maître : prime de premier passage ; déjà terminé dans la sauvegarde : plus de prime', async () => {
        const { session: s } = await reloadSession(forgeArenaVeteran());
        const cleared = s.data.arena.cleared;
        expect(arenaEncounterInfo(s.rt.enemyIndex[arenaMasterId(2)].def, 15, cleared).arena.firstClear).toBe(false);   // déjà vaincu
        expect(arenaEncounterInfo(s.rt.enemyIndex[arenaMasterId(3)].def, 15, cleared).arena.firstClear).toBe(true);
        const ev = markEnemyDefeated(s, arenaMasterId(3));
        expect(ev.find(e => e.type === 'arenaCleared')).toMatchObject({ tier: 3, firstClear: true });
        expect(s.data.arena.cleared).toEqual([1, 2, 3]);
        const again = markEnemyDefeated(s, arenaMasterId(2));
        expect(again.find(e => e.type === 'arenaCleared').firstClear).toBe(false);
        expect(s.data.arena.cleared).toEqual([1, 2, 3]);
    });

    test('vaincre un gardien ne termine pas le cercle ; il compte une victoire et le record de combat', async () => {
        const { session: s } = await reloadSession(forgeArenaVeteran());
        const wins = s.data.arena.wins;
        const ev = markEnemyDefeated(s, arenaGuardId(4, 2));
        expect(ev.find(e => e.type === 'arenaCleared')).toBeUndefined();
        expect(s.data.arena.wins).toBe(wins + 1);
        expect(s.data.arena.best[4]).toBe(2);
        markEnemyDefeated(s, arenaGuardId(4, 1));
        expect(s.data.arena.best[4]).toBe(2);   // le record ne recule pas
    });

    test('les gardiens reviennent au parvis : le cercle peut être refait', async () => {
        const { session: s } = await reloadSession(forgeArenaVeteran());
        enterArena(s);
        markEnemyDefeated(s, arenaGuardId(1, 1));
        expect(isEnemyAlive(s, arenaGuardId(1, 1))).toBe(false);
        enterScreen(s, ARENA_HALL, SCREENS[ARENA_HALL].spawn);
        expect(isEnemyAlive(s, arenaGuardId(1, 1))).toBe(true);
    });

    test('niveau des adversaires : fixe, croissant de cercle en cercle, indépendant du héros', () => {
        ARENA_TIERS.forEach(t => {
            expect(arenaWaveLevel(t.id, 1)).toBe(t.baseLevel);
            expect(arenaWaveLevel(t.id, 3)).toBe(t.baseLevel + 1);
            for (let w = 2; w <= t.waves; w++) expect(arenaWaveLevel(t.id, w)).toBeGreaterThanOrEqual(arenaWaveLevel(t.id, w - 1));
        });
        const lowHero = forgeNewGame(), maxHero = forgeMaxLevel();
        const def = { arena: { tier: 5, wave: 2 } };
        expect(arenaEncounterInfo(def, lowHero.level).level).toBe(arenaEncounterInfo(def, maxHero.level).level);
    });

    test('cas limites : cercle ou combat hors bornes ramenés dans le cercle', () => {
        expect(arenaWaveLevel(999, 1)).toBe(ARENA_TIERS[0].baseLevel);
        expect(arenaWaveLevel(1, 0)).toBe(ARENA_TIERS[0].baseLevel);
        expect(arenaTier('3')).toBe(tier(3));
        expect(arenaTier(0)).toBeNull();
        const huge = arenaEncounterInfo({ arena: { tier: 1, wave: 99 } }, 10, []);
        expect(huge.arena.wave).toBe(tier(1).waves);
        expect(huge.arena.firstClear).toBe(true);
        expect(isChampionWave(1, tier(1).waves)).toBe(true);
        expect(isChampionWave(1, 1)).toBe(false);
    });

    test('règles de duel du maître : tirs rapides au cercle 3, miroir au dernier cercle, aucune pour les gardiens', () => {
        expect(arenaEncounterInfo({ arena: { tier: 3, wave: tier(3).waves } }, 15, []).duel).toEqual(tier(3).masterDuel);
        expect(arenaEncounterInfo({ arena: { tier: 3, wave: 1 } }, 15, []).duel).toBeNull();
        const last = ARENA_TIERS.at(-1);
        expect(arenaEncounterInfo({ arena: { tier: last.id, wave: last.waves } }, 70, []).duel).toMatchObject({ mirror: true });
    });

    test('le maître du dernier cercle copie le héros de niveau maximal (duel miroir)', () => {
        const hero = forgeMaxLevel('sorcerer');
        const last = ARENA_TIERS.at(-1);
        const duel = arenaEncounterInfo({ arena: { tier: last.id, wave: last.waves } }, hero.level, []).duel;
        expect(duel.mirror).toBe(true);
        const copy = mirrorLoadout(hero, getClassSpells('sorcerer', hero.level));
        expect(ids(copy.spells)).toEqual(ids(hero.activeSpells));
        expect(copy.weapon.id).toBe(hero.equippedWeapon.id);
    });

    test('renfort des adversaires : PV, attaque et défense multipliés, jamais en dessous de 1 PV ; neutre à ×1', () => {
        const base = () => ({ maxHp: 100, hp: 40, attack: 20, defense: 10 });
        const scaled = applyArenaScaling(base(), 1.35);
        expect(scaled).toEqual({ maxHp: 135, hp: 135, attack: 27, defense: 14 });
        expect(applyArenaScaling(base(), 1)).toEqual(base());
        expect(applyArenaScaling(base(), 0.5)).toEqual(base());
        expect(applyArenaScaling(null, 2)).toBeNull();
        expect(applyArenaScaling({ maxHp: 0, hp: 0, attack: 0 }, 2)).toMatchObject({ maxHp: 1, attack: 1, defense: 0 });
    });

    test('primes : croissantes de cercle en cercle, doublées pour le maître, jamais négatives', () => {
        ARENA_TIERS.forEach(t => {
            const guard = arenaRewardBonus(t.id, 1, t.baseLevel), master = arenaRewardBonus(t.id, t.waves, arenaWaveLevel(t.id, t.waves));
            expect(guard.gold).toBeGreaterThan(0);
            expect(guard.xp).toBeGreaterThan(0);
            expect(master.gold).toBeGreaterThan(guard.gold);
            expect(master.xp).toBeGreaterThan(guard.xp);
        });
        for (let i = 1; i < ARENA_TIERS.length; i++) {
            const a = ARENA_TIERS[i - 1], b = ARENA_TIERS[i];
            expect(arenaRewardBonus(b.id, 1, b.baseLevel).gold).toBeGreaterThan(arenaRewardBonus(a.id, 1, a.baseLevel).gold);
        }
        expect(arenaRewardBonus(1, -3, -3).gold).toBeGreaterThan(0);   // valeurs invalides ramenées à 1
    });

    test('la prime de premier passage du maître est une grosse prime (or et XP supérieurs à la prime ordinaire)', () => {
        ARENA_TIERS.forEach(t => {
            const ordinary = arenaRewardBonus(t.id, t.waves, arenaWaveLevel(t.id, t.waves));
            expect(t.clearGold).toBeGreaterThan(ordinary.gold);
            expect(t.clearXp).toBeGreaterThan(ordinary.xp);
        });
    });

    test('données d\'arène corrompues dans un fichier : normalisées sans exception', () => {
        expect(normalizeArenaData({ cleared: ['x', 99, 2, 2, '3', null], best: 5, wins: -4, returnTo: { x: 1 } })).toEqual({ cleared: [2, 3], best: {}, wins: 0, returnTo: null });
        expect(normalizeArenaData(undefined)).toEqual({ cleared: [], best: {}, wins: 0, returnTo: null });
        expect(normalizeArenaData({ cleared: 'oui' }).cleared).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 10. Boss : soleil protégé, mirages, Dixième Soleil, conseils après défaites
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('boss : soleil protégé par sa meute', () => {
    const fauves = () => Object.values(SCREENS).find(s => s.enemies.some(e => e.id === 'sun_7'));
    const pack = () => fauves().enemies.filter(e => e.group === 'beast_pack').map(e => e.id);
    const standNextToBoss = (s, fromAbove = true) => {
        const boss = s.rt.enemyIndex.sun_7.def;
        s.data.x = boss.x; s.data.y = boss.y + (fromAbove ? -1 : 1); s.rt.grace = 0;
        return fromAbove ? [0, 1] : [0, -1];
    };
    const sessionAt = (patch = {}) => createSession({ screenId: fauves().id, x: fauves().spawn.x, y: fauves().spawn.y, ...patch });

    test('la meute compte quatre bêtes ; le soleil est intouchable tant qu\'une seule vit', () => {
        expect(pack()).toHaveLength(4);
        const s = sessionAt();
        const sun = s.rt.enemyIndex.sun_7.def;
        expect(isShielded(s, sun)).toBe(true);
        pack().slice(0, 3).forEach(id => markEnemyDefeated(s, id));
        expect(isShielded(s, sun)).toBe(true);
        markEnemyDefeated(s, pack()[3]);
        expect(isShielded(s, sun)).toBe(false);
    });

    test('contact avec le soleil protégé : texte du bouclier, aucun combat, héros immobile ; une fois la meute abattue : combat', () => {
        const s = sessionAt();
        const [dx, dy] = standNextToBoss(s);
        const at = { x: s.data.x, y: s.data.y };
        const shielded = tryMove(s, dx, dy, { playerLevel: 30 });
        expect(shielded.type).toBe('shielded');
        expect(shielded.enemyId).toBe('sun_7');
        expect(shielded.lines.length).toBeGreaterThan(0);
        expect({ x: s.data.x, y: s.data.y }).toEqual(at);
        pack().forEach(id => markEnemyDefeated(s, id));
        expect(tryMove(s, dx, dy, { playerLevel: 30 })).toMatchObject({ type: 'combat', enemyId: 'sun_7' });
    });

    test('un soleil protégé n\'a pas de zone de vigilance : passer à côté ne déclenche rien', () => {
        const s = sessionAt();
        const boss = s.rt.enemyIndex.sun_7.def;
        s.data.x = boss.x - 1; s.data.y = boss.y - 2; s.rt.grace = 0;
        expect(tryMove(s, 0, 1, { playerLevel: 30 }).type).not.toBe('combat');
        expect(isShielded(s, boss)).toBe(true);
    });

    test('la meute abattue (partiellement ou totalement) est conservée par la sauvegarde', async () => {
        const hero = forgeArenaUnlock();
        hero.exploration = { ...hero.exploration, screenId: fauves().id, x: fauves().spawn.x, y: fauves().spawn.y, defeated: pack().slice(0, 3) };
        const { session: partial } = await reloadSession(hero);
        expect(isShielded(partial, partial.rt.enemyIndex.sun_7.def)).toBe(true);
        hero.exploration.defeated = pack();
        const { session: full } = await reloadSession(hero);
        expect(isShielded(full, full.rt.enemyIndex.sun_7.def)).toBe(false);
    });

    test('niveau du soleil : fixe pour tous les héros, +3 par cycle de Nouvelle Partie +', async () => {
        const base = encounterFor(sessionAt(), 'sun_7', 1).level;
        expect(base).toBe(fauves().enemies.find(e => e.id === 'sun_7').boss.level);
        for (const forge of [forgeNewGame, forgeLateGame, forgeMaxLevel]) {
            expect(encounterFor(sessionAt(), 'sun_7', forge().level).level).toBe(base);
        }
        const hero = forgeMaxLevel();
        hero.exploration = { ...hero.exploration, ngPlus: 2, screenId: fauves().id, x: fauves().spawn.x, y: fauves().spawn.y };
        const { session } = await reloadSession(hero);
        expect(session.data.ngPlus).toBe(2);
        expect(encounterFor(session, 'sun_7', 70).level).toBe(base + 6);
    });

    test('rencontre du soleil : c\'est un boss (statistiques renforcées) sans préparation de terrain', () => {
        const s = sessionAt();
        pack().forEach(id => markEnemyDefeated(s, id));
        const enc = encounterFor(s, 'sun_7', 20);
        expect(enc.boss).toMatchObject({ name: 'Soleil des Bêtes Folles' });
        expect(enc.prep.tags).toEqual([]);
        const sun = createMapEnemy(enc);
        const normal = createMapEnemy({ ...enc, boss: null });
        expect(sun.maxHp).toBeGreaterThan(normal.maxHp);
        expect(sun.name).toBe('Soleil des Bêtes Folles');
    });
});

describe('boss : mirages (illusions) du désert de Gobi', () => {
    const gobi = () => Object.values(SCREENS).find(s => s.enemies.some(e => e.illusion));
    const mirage = () => gobi().enemies.find(e => e.illusion);
    const next = (s, def) => { s.data.x = def.x; s.data.y = def.y + 1; s.rt.grace = 0; };
    const sessionAt = (patch = {}) => createSession({ screenId: gobi().id, x: gobi().spawn.x, y: gobi().spawn.y, ...patch });

    test('un mirage se dissipe au contact : aucun combat, le héros ne bouge pas, texte du Narrateur', () => {
        const s = sessionAt();
        const m = mirage();
        next(s, m);
        const res = tryMove(s, 0, -1, { playerLevel: 5 });
        expect(res).toMatchObject({ type: 'illusion', enemyId: m.id });
        expect(res.lines.length).toBeGreaterThan(0);
        expect(isEnemyAlive(s, m.id)).toBe(false);
    });

    test('un mirage dissipé ne revient pas, même après rechargement de la sauvegarde', async () => {
        const s = sessionAt();
        next(s, mirage());
        tryMove(s, 0, -1, { playerLevel: 5 });
        const hero = forgeEarlyGame();
        hero.exploration = { ...hero.exploration, ...s.data };
        const { session } = await reloadSession(hero);
        expect(isEnemyAlive(session, mirage().id)).toBe(false);
    });

    test('les mirages ne donnent ni victoire d\'arène ni progression : seule la liste des vaincus change', () => {
        const s = sessionAt();
        const wins = s.data.arena.wins;
        next(s, mirage());
        tryMove(s, 0, -1, { playerLevel: 5 });
        expect(s.data.arena.wins).toBe(wins);
        expect(s.data.defeated).toEqual([mirage().id]);
    });

    test('le vrai soleil du désert n\'est pas une illusion : le contact lance le combat', () => {
        const real = gobi().enemies.find(e => e.id === 'sun_4');
        expect(real.illusion).toBeFalsy();
        const s = sessionAt();
        s.data.x = real.x; s.data.y = real.y + 1; s.rt.grace = 0;
        expect(tryMove(s, 0, -1, { playerLevel: 30 })).toMatchObject({ type: 'combat', enemyId: 'sun_4' });
    });

    test('les mirages sont permanents (jamais réapparus au changement d\'écran) et portent un texte', () => {
        gobi().enemies.filter(e => e.illusion).forEach(e => {
            expect(e.permanent).toBe(true);
            expect(e.illusionLines.length).toBeGreaterThan(0);
        });
    });
});

describe('boss : Dixième Soleil et sentier du Pic de la Lune', () => {
    const fusang = () => SCREENS.fusang;
    const lunePath = () => fusang().exits.filter(e => e.requires === 'sun_9');   // le sentier du Pic de la Lune (plusieurs cases d'entrée)
    const sessionAt = (patch = {}) => createSession({ screenId: 'fusang', x: fusang().spawn.x, y: fusang().spawn.y, ...patch });

    test('le Dixième Soleil est un personnage, pas un ennemi : jamais de combat contre lui', () => {
        const ten = fusang().npcs.find(n => n.id === 'sun_ten');
        expect(ten).toBeTruthy();
        expect(fusang().enemies.some(e => e.id === 'sun_ten')).toBe(false);
        const s = sessionAt();
        s.data.x = ten.x; s.data.y = ten.y + 1; s.rt.grace = 0;
        const res = tryMove(s, 0, -1, { playerLevel: 17 });
        expect(res).toMatchObject({ type: 'talk', npcId: 'sun_ten' });
        expect(entityAt(s, ten.x, ten.y)).toMatchObject({ type: 'npc' });
    });

    test('le Neuvième Soleil se tient devant le Dixième ; le sentier de la Lune reste fermé tant qu\'il n\'est pas abattu', () => {
        expect(fusang().enemies.some(e => e.id === 'sun_9')).toBe(true);
        expect(fusang().npcs.some(n => n.id === 'sun_ten')).toBe(true);   // sur la même cime
        const s = sessionAt();
        const exit = lunePath()[0];
        expect(exit.requires).toBe('sun_9');
        expect(isExitLocked(s, exit)).toBe(true);
        s.data.x = exit.x - 1; s.data.y = exit.y; s.rt.grace = 5;
        expect(tryMove(s, 1, 0, { playerLevel: 70 })).toMatchObject({ type: 'exitBlocked', reason: 'quest' });
        markEnemyDefeated(s, 'sun_9');
        expect(isExitLocked(s, exit)).toBe(false);
        s.data.x = exit.x - 1; s.data.y = exit.y;
        expect(tryMove(s, 1, 0, { playerLevel: 70 })).toMatchObject({ type: 'transition', to: exit.to });
    });

    test('le verrou tient pour un héros de niveau maximal comme pour un héros de niveau 17 (niveau sans effet sur l\'histoire)', async () => {
        for (const forge of [forgeArenaUnlock, forgeMaxLevel]) {
            const hero = forge();
            hero.exploration = { ...hero.exploration, screenId: 'fusang', x: fusang().spawn.x, y: fusang().spawn.y, defeated: [] };
            const { session } = await reloadSession(hero);
            lunePath().forEach(e => expect(isExitLocked(session, e)).toBe(true));
        }
    });

    test('après le Neuvième Soleil sauvegardé, le chemin est ouvert au rechargement', async () => {
        const hero = forgeEndGame();
        hero.exploration = { ...hero.exploration, screenId: 'fusang', x: fusang().spawn.x, y: fusang().spawn.y, defeated: ['sun_9'] };
        const { session } = await reloadSession(hero);
        lunePath().forEach(e => expect(isExitLocked(session, e)).toBe(false));
        expect(isEnemyAlive(session, 'sun_9')).toBe(false);
    });
});

describe('boss : conseils après des défaites répétées (héros sauvegardé)', () => {
    test('la série de défaites est sauvegardée et rechargée', async () => {
        const hero = forgeBossStreak();
        const { player: relu, data } = await roundTrip(hero);
        expect(data.player.bossLossStreak).toEqual({ id: 'sun_7', count: BOSS_LOSS_THRESHOLD });
        expect(relu.bossLossStreak).toEqual({ id: 'sun_7', count: BOSS_LOSS_THRESHOLD });
    });

    test('trois défaites de suite contre le même boss : un conseil adapté au héros (points à dépenser, or)', async () => {
        const hero = forgeBossStreak();
        const { player: relu } = await roundTrip(hero);
        expect(isStreakTipDue(relu.bossLossStreak)).toBe(true);
        const ctx = { playerLevel: relu.level, bossLevel: 13, gold: relu.gold, unspentPoints: relu.unspentLevelPoints };
        const tips = applicableTips(ctx);
        expect(tips.join(' ')).toMatch(/points d'attribut/);
        expect(tips.join(' ')).toMatch(/or/);
        expect(tips[0]).toContain('niveau 13');   // boss plus fort que le héros : le conseil le dit
        expect(tips).toContain(pickBossTip(relu.bossLossStreak, ctx));
    });

    test('le conseil change à chaque nouvelle défaite, et boucle sur la liste', () => {
        const ctx = { playerLevel: 11, bossLevel: 13, gold: 350, unspentPoints: 3 };
        const tips = applicableTips(ctx);
        const picked = Array.from({ length: tips.length + 1 }, (_, i) => pickBossTip({ id: 'sun_7', count: BOSS_LOSS_THRESHOLD + i }, ctx));
        expect(new Set(picked.slice(0, tips.length)).size).toBe(tips.length);
        expect(picked.at(-1)).toBe(picked[0]);
    });

    test('cas limite : deux défaites seulement -> aucun conseil ; boss différent -> la série repart à 1 ; une victoire l\'interrompt', () => {
        expect(pickBossTip({ id: 'sun_7', count: BOSS_LOSS_THRESHOLD - 1 })).toBeNull();
        expect(pickBossTip(null)).toBeNull();
        expect(recordBossLoss({ id: 'sun_7', count: 2 }, 'sun_7')).toEqual({ id: 'sun_7', count: 3 });
        expect(recordBossLoss({ id: 'sun_7', count: 2 }, 'sun_8')).toEqual({ id: 'sun_8', count: 1 });
        expect(recordBossLoss(null, 'sun_1')).toEqual({ id: 'sun_1', count: 1 });
        expect(recordBossLoss({ id: 'sun_7', count: 2 }, null)).toEqual({ id: 'sun_7', count: 2 });
        expect(recordVictory()).toBeNull();
    });

    test('héros sans points à dépenser et sans or : pas de conseil sur les points ; riche : conseil d\'achat', () => {
        const tips = applicableTips({ playerLevel: 30, bossLevel: 20, gold: 0, unspentPoints: 0 });
        expect(tips.join(' ')).not.toMatch(/points d'attribut/);
        expect(tips[0]).not.toContain('niveau 20');   // boss plus faible : conseil générique
        expect(applicableTips({ gold: 100 }).join(' ')).toMatch(/marchands/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 11. Le monde vu depuis une sauvegarde : région, niveau conseillé
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('monde : un héros sauvegardé se recharge à l\'endroit voulu', () => {
    test.each(MILESTONES.map(m => [m.label, m]))('%s : la session reprend à l\'écran sauvegardé, à la pierre du terrain, sur une case libre', async (_, m) => {
        for (const c of CLASS_IDS) {
            const hero = m.forge(c);
            const { session, relu } = await reloadSession(hero);
            expect(session.data.screenId).toBe(hero.exploration.screenId);
            // la position n'est pas écrite dans le fichier : le héros reparaît à la pierre du terrain (sinon à l'entrée) de son écran
            const spot = currentScreen(session).waypoint?.spot || currentScreen(session).spawn;
            expect([session.data.x, session.data.y]).toEqual([spot.x, spot.y]);
            expect(isTerrainBlocked(currentScreen(session), session.data.x, session.data.y)).toBe(false);
            expect(relu.exploration.visitedScreens).toEqual(hero.exploration.visitedScreens);
        }
    });

    test('le niveau recommandé d\'une région ne bloque jamais : le héros neuf est seulement prévenu', () => {
        const crossing = Object.values(SCREENS).filter(sc => !sc.arena).flatMap(sc => sc.exits
            .filter(e => SCREENS[e.to] && SCREENS[e.to].region !== sc.region && !e.requires && (REGION_UNLOCK_LEVEL[SCREENS[e.to].region] || 1) > 1)
            .map(e => ({ sc, e })))[0];
        expect(crossing).toBeTruthy();
        const { sc, e } = crossing;
        const s = createSession({ ...forgeNewGame().exploration, screenId: sc.id, x: sc.spawn.x, y: sc.spawn.y });
        const from = { x: e.x === 0 ? 1 : e.x === sc.w - 1 ? e.x - 1 : e.x, y: e.y === 0 ? 1 : e.y === sc.h - 1 ? e.y - 1 : e.y };
        s.data.x = from.x; s.data.y = from.y; s.rt.grace = 5;
        const res = tryMove(s, e.x - from.x, e.y - from.y, { playerLevel: 1 });
        expect(res).toMatchObject({ type: 'transition', to: e.to });
        expect(res.warning).toMatchObject({ minLevel: REGION_UNLOCK_LEVEL[SCREENS[e.to].region] });
    });

    test('ordre des terrains : le niveau conseillé augmente de terrain en terrain', () => {
        const levels = REGION_ORDER.map(r => REGION_UNLOCK_LEVEL[r]);
        for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
        expect(explorationForRegions(REGION_ORDER.indexOf(ARENA_UNLOCK_REGION) + 1).visitedScreens.some(id => SCREENS[id].region === ARENA_UNLOCK_REGION)).toBe(true);
    });

    test('niveau d\'un ennemi normal : celui de sa région, jamais celui du héros', () => {
        const def = { id: 'x' };
        expect(enemyLevel(def, 7, 0)).toBe(7);
        expect(enemyLevel({ id: 'x', offset: 2 }, 7, 0)).toBe(9);
        expect(enemyLevel(def, 7, 2)).toBe(9);                          // +1 par cycle pour les ennemis normaux
        expect(enemyLevel({ boss: { level: 10 } }, 7, 2)).toBe(16);     // +3 par cycle pour les boss
        expect(enemyLevel({ boss: {} }, 7, 0)).toBe(1);
    });
});
