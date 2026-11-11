// Simulateur de combats (Node, sans DOM) pour chercher l'équilibrage : vrai plateau (matchMechanics.js), vraie résolution des coups
// (combatStats.js : critique, blocage, buffs), vrais ennemis de la carte (enemies.js > createMapEnemy), vrais pouvoirs de compagnons
// (companionPowers.js), vraie jauge de rage et vrais ultimes (ultimates.js). Usage : voir tools/balance-search.mjs.
//
// Deux profils de héros :
//  - « standard » : arme ou sort de dégâts direct dès qu'il peut, sinon le meilleur coup du plateau ;
//  - « complet » : en plus, ses 4 sorts équipés avec leurs effets (balayages de lignes et de colonnes, purges de couleur, pluie d'étoiles,
//    conversions en crânes, soins, buffs, Bastion, bouclier de qì, étourdissement, scellement, poison, confusion, vol de PA,
//    jauge de rage : gain, conversion en dégâts ou en qì), son ultime de classe (jauge pleine + qì collecté), son objet actif
//    rechargeable (soin, régénération, qì, PA, attaque, défense, résurrection) et son compagnon actif.
// L'ennemi joue comme le profil standard (arme, sorts de dégâts, plateau) et subit les statuts posés par le héros.
// Simplifications : jokers, cases de biome, sorts à cible manuelle d'une seule case (Qi Sauvage, Concentration, Méridiens Obscurs),
// résistances élémentaires du héros et altérations posées par l'ennemi sont ignorés ; un seul tour bonus par tour.
import { colors, setBoardSize } from '../constants.js';
import { collectMatches, findPossibleMatches } from '../matchMechanics.js';
import { resolveStrike, skullStrengthBonus, addStatBuff, tickStatBuffs } from '../combatStats.js';
import { ATTRIBUTE_MANA_RULES, boostedRageGain } from '../attributes.js';
import { rollCompanionPowers, COMPANION_POWERS } from '../companionPowers.js';
import { RAGE_MAX, rageFromDamage, addRage, ultimateCostEntries, rageToDamageAmount, rageToManaAmount } from '../ultimates.js';
import { resolveDifficulty, tierSettings } from '../enemyAIProfiles.js';
import { pickWeightedOption, applyScoreSharpness, FATAL_REASON } from '../enemyAIChoice.js';
import { critChance, blockChance, CRIT_MULTIPLIER } from '../combatStats.js';
import { cappedEnemyHit } from '../combatBalance.js';

export const SKULL_PROB = 0.19;   // board.js : BOARD_DROP_PROBABILITIES
export const COMBAT_PROB = 0.17;
const BASE_MANA_CAP = 50;          // game.js
const MAX_CYCLES = 80;

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomTile(rng) {
    const r = rng();
    if (r < SKULL_PROB) return 'skull';
    if (r < SKULL_PROB + COMBAT_PROB) return 'combat';
    return colors[Math.min(colors.length - 1, Math.floor((r - SKULL_PROB - COMBAT_PROB) / (1 - SKULL_PROB - COMBAT_PROB) * colors.length))];
}

function makesMatchAt(board, n, i, tile) {
    const row = Math.floor(i / n), col = i % n;
    if (col >= 2 && board[i - 1] === tile && board[i - 2] === tile) return true;
    return row >= 2 && board[i - n] === tile && board[i - 2 * n] === tile;
}

export function newBoard(n, rng) {
    setBoardSize(n);
    for (;;) {
        const board = [];
        for (let i = 0; i < n * n; i++) {
            let tile = randomTile(rng), tries = 0;
            while (makesMatchAt(board, n, i, tile) && tries++ < 20) tile = randomTile(rng);
            board.push(tile);
        }
        if (findPossibleMatches(board).length) return board;
    }
}

function settle(board, n, rng) {
    for (let col = 0; col < n; col++) {
        const kept = [];
        for (let row = n - 1; row >= 0; row--) if (board[row * n + col] !== null) kept.push(board[row * n + col]);
        for (let row = n - 1, k = 0; row >= 0; row--, k++) board[row * n + col] = k < kept.length ? kept[k] : randomTile(rng);
    }
}

// --- Combattants ---------------------------------------------------------------------------------------------------------------------------
const attrOfColor = Object.fromEntries(Object.entries(ATTRIBUTE_MANA_RULES).map(([attr, rule]) => [rule.color, attr]));
const attrPoints = (e, color) => Math.max(0, Math.floor(e.attributes?.[attrOfColor[color]] || 0));
const manaCap = (e, color) => BASE_MANA_CAP + Math.floor(attrPoints(e, color) * 1.3 + 1e-9);
const costOf = spell => (typeof spell.cost === 'number' ? { [spell.color || 'red']: spell.cost } : { ...(spell.cost || {}) });
const canPay = (e, spell) => Object.entries(costOf(spell)).every(([c, v]) => (e.mana[c] || 0) >= v);
const pay = (e, spell) => Object.entries(costOf(spell)).forEach(([c, v]) => { e.mana[c] -= v; });
const spellColors = spell => spell.colors || (typeof spell.cost === 'object' ? Object.keys(spell.cost) : [spell.color]);

/** Prépare un combattant (copie) : qì de départ (1 par point d'attribut), PA à 0. */
export function fighter(src, { isHero = false } = {}) {
    const e = { ...src, statusEffects: {}, statBuffs: {}, combatPoints: 0, isHero, rage: 0, ultimateMana: {}, cooldowns: {} };
    e.mana = Object.fromEntries(colors.map(c => [c, Math.min(manaCap(e, c), attrPoints(e, c))]));
    e.weaponUsed = isHero ? src.equippedWeapon : src.weapon;
    e.spellList = isHero ? (src.activeSpells || []) : (src.spells || []);
    e.damageSpells = e.spellList.filter(s => s.dmg > 0 && (!s.effect || s.boardSpell) && !s.heal);
    e.hp = e.maxHp;
    return e;
}

function spellDamage(caster, target, spell, base = spell.dmg) {
    const cols = spellColors(spell);
    const res = cols.reduce((s, c) => s + (target.resistances?.[c] || 0), 0) / Math.max(1, cols.length);
    return Math.floor((base + attrPoints(caster, 'blue')) * (1 - res));
}
const weaponRaw = e => (e.weaponUsed ? e.weaponUsed.damage + (e.isHero ? 0 : (e.weaponPower || 0)) : 0);

// --- Un combat -----------------------------------------------------------------------------------------------------------------------------
/**
 * Joue un combat jusqu'à la mort d'un camp (ou MAX_CYCLES). `enemyDamageScale` multiplie les dégâts subis par le héros (calibrage).
 * `profile` : 'standard' ou 'complet' ; `item` : objet actif rechargeable du héros ; `companion` : id du compagnon actif.
 * Renvoie { heroWon, cycles, dealtBy: {weapon, spell, skull, other}, takenRaw, heroHpLeft, heroMaxHp, enemyHpLeft, used: {...} }.
 */
export function simulateFight(heroSrc, enemySrc, { seed = 1, boardSize = 8, enemyDamageScale = 1, maxCycles = MAX_CYCLES, immortal = false, profile = 'standard', item = null, companion = null, ultimate = null, aiPreference = 'greedy' } = {}) {
    const rng = mulberry32(seed);
    const full = profile === 'complet';
    const hero = fighter(heroSrc, { isHero: true }), enemy = fighter(enemySrc);
    if (immortal) { hero.hp = hero.maxHp = 1e9; enemy.hp = enemy.maxHp = 1e9; }   // mesure des taux : personne ne meurt
    hero.levelEdge = Math.max(0, (hero.level || 0) - (enemy.level || 0));
    enemy.levelEdge = Math.max(0, (enemy.level || 0) - (hero.level || 0));
    // IA de l'ennemi : 'greedy' (toujours le meilleur choix) ou préférence du jeu ('auto', 'easy', 'normal', 'hard', 'expert'),
    // résolue comme dans le jeu (enemyAIProfiles.js : palier selon le niveau, ennemi affaibli ou hors niveau, boss compris).
    const ai = aiPreference === 'greedy' ? null : (() => {
        const { tier, special } = resolveDifficulty({ preference: aiPreference, enemyLevel: enemy.level || 1, playerLevel: hero.level || 1, enemyProfile: enemySrc });
        return { tier: special || tier, ...tierSettings(tier, special) };
    })();
    const n = boardSize;
    let board = newBoard(n, rng);
    const stats = { dealtBy: { weapon: 0, spell: 0, skull: 0, other: 0 }, takenRaw: 0, healed: 0, used: { spells: 0, ultimate: 0, item: 0, companion: 0 } };
    const itemState = item ? { def: item, charges: item.chargesPerCycle || 1, recharge: 0 } : null;
    const revive = { used: false };

    const heal = amount => {
        const gained = Math.max(0, Math.min(hero.maxHp - hero.hp, Math.floor(amount)));
        hero.hp += gained; stats.healed += gained;
        return gained;
    };
    const gainMana = (e, color, amount, bonus = true) => {
        const total = Math.max(0, Math.floor(amount + (bonus ? attrPoints(e, color) : 0)));
        e.mana[color] = Math.min(manaCap(e, color), (e.mana[color] || 0) + total);
        if (e.isHero && total > 0) e.ultimateMana[color] = (e.ultimateMana[color] || 0) + total;
    };

    // Dégâts : `strike` (arme, crânes, sorts) passe par critique / blocage ; sinon dégâts directs (poison, compagnon).
    const hit = (attacker, target, raw, source, { strike = true, unblockable = false } = {}) => {
        if (raw <= 0 || target.hp <= 0) return 0;
        // Coup de l'ennemi : multiplicateur appliqué AVANT critique / blocage et plafonné comme dans le jeu (cappedEnemyHit).
        const scaled = target.isHero ? cappedEnemyHit(raw, enemyDamageScale, target.maxHp) : raw;
        let dmg = strike ? resolveStrike(scaled, attacker, unblockable ? {} : target, { rng }).damage : Math.floor(scaled);
        if (target.isHero) {
            stats.takenRaw += dmg * raw / Math.max(1, scaled);   // brut, sans le multiplicateur
            const shield = hero.statusEffects.manaShield;   // Furtivité : le qì violet absorbe les dégâts
            if (shield > 0 && dmg > 0) { const absorbed = Math.min(hero.mana.purple || 0, dmg); hero.mana.purple -= absorbed; dmg -= absorbed; }
            hero.hp -= dmg;
            if (full && dmg > 0) addRage(hero, boostedRageGain(hero, rageFromDamage(dmg, hero.maxHp)));
            if (hero.hp <= 0 && itemState?.def.effect.revive && itemState.charges > 0 && !revive.used) {   // Plume de phénix
                revive.used = true; itemState.charges--; hero.hp = Math.max(1, Math.floor(hero.maxHp * itemState.def.effect.revive));
            }
        } else {
            stats.dealtBy[source] += Math.min(dmg, Math.max(0, target.hp));
            target.hp -= dmg;
        }
        return dmg;
    };

    // Résout les combinaisons (et cascades) au profit de `e` ; renvoie true si un match de 4+ donne un tour bonus.
    const cascade = (e, target) => {
        let bonus = false;
        for (let guard = 0; guard < 30; guard++) {
            const matches = collectMatches(board);
            if (!matches.length) break;
            const cleared = new Set();
            for (const { indices, info } of matches) {
                indices.forEach(i => cleared.add(i));
                if (info.type === 'skull') hit(e, target, info.len * (1 + skullStrengthBonus(e)), 'skull');
                else if (info.type === 'combat') e.combatPoints += info.len;
                else gainMana(e, info.color, (e.statusEffects.confused || 0) > 0 ? 1 : info.len, (e.statusEffects.confused || 0) <= 0);
                if (info.len >= 4) bonus = true;
            }
            cleared.forEach(i => { board[i] = null; });
            settle(board, n, rng);
        }
        if (!findPossibleMatches(board).length) board = newBoard(n, rng);
        return bonus;
    };

    // Détruit des cases (sorts de plateau) : qì des couleurs pour le lanceur, crânes = dégâts, épées = PA ; dégâts par case du sort.
    const destroy = (e, target, indices, spell) => {
        const unique = [...new Set(indices)].filter(i => board[i] != null);
        const hitColors = spell ? spellColors(spell) : [];
        let hits = 0, skulls = 0;
        unique.forEach(i => {
            const t = board[i];
            if (colors.includes(t)) { gainMana(e, t, 1, false); if (hitColors.includes(t)) hits++; }
            else if (t === 'skull') skulls++;
            else if (t === 'combat') e.combatPoints++;
            board[i] = null;
        });
        if (spell?.dmgPerTile) hit(e, target, spell.dmgPerTile * hits, 'spell');
        if (skulls) hit(e, target, skulls * (1 + skullStrengthBonus(e)), 'skull');
        settle(board, n, rng);
        return cascade(e, target);
    };
    const rows = () => [...Array(n).keys()].map(r => [...Array(n).keys()].map(c => r * n + c));
    const cols = () => [...Array(n).keys()].map(c => [...Array(n).keys()].map(r => r * n + c));
    const lineValue = (line, spell) => line.reduce((v, i) => v + (spellColors(spell).includes(board[i]) ? spell.dmgPerTile || 1 : 0) + (board[i] === 'skull' ? 2 : 0) + (board[i] === 'combat' ? 0.5 : 0), 0);
    const bestLines = (lines, spell, k) => [...lines].sort((a, b) => lineValue(b, spell) - lineValue(a, spell)).slice(0, k);

    const scoreMove = (e, info) => {
        const needs = new Set(e.spellList.flatMap(s => Object.keys(costOf(s))));
        if (info.type === 'skull') return info.len * (1 + skullStrengthBonus(e)) * 3;
        if (info.type === 'combat') return e.weaponUsed ? info.len * 2.5 : 0.5 * info.len;
        return info.len * (needs.has(info.color) ? 2 : 0.7);
    };
    const boardMove = (e, target, random = false) => {
        const moves = findPossibleMatches(board);
        if (!moves.length) { board = newBoard(n, rng); return false; }
        if (random) {   // coup de plateau au hasard (IA facile / normale, ou coup « stupide »)
            const m = moves[Math.floor(rng() * moves.length)];
            [board[m.from], board[m.to]] = [board[m.to], board[m.from]];
            return cascade(e, target);
        }
        let best = null, bestScore = -1;
        for (const m of moves) {
            [board[m.from], board[m.to]] = [board[m.to], board[m.from]];
            const score = collectMatches(board).reduce((s, x) => s + scoreMove(e, x.info) + (x.info.len >= 4 ? 6 : 0), 0) + rng() * 0.01;
            [board[m.from], board[m.to]] = [board[m.to], board[m.from]];
            if (score > bestScore) { bestScore = score; best = m; }
        }
        [board[best.from], board[best.to]] = [board[best.to], board[best.from]];
        return cascade(e, target);
    };

    const useWeapon = (e, target) => {
        e.combatPoints -= e.weaponUsed.actionPoints;
        const bonus = e.statusEffects.flameblade || 0; delete e.statusEffects.flameblade;   // Lame de Feu Pourpre
        hit(e, target, weaponRaw(e) + bonus, 'weapon');
        return false;
    };
    const weaponReady = e => e.weaponUsed && e.combatPoints >= e.weaponUsed.actionPoints && !((e.statusEffects.sealed || 0) > 0);
    const ready = (e, s) => canPay(e, s) && !((e.cooldowns[s.id] || 0) > 0);
    const cast = (e, s) => { pay(e, s); if (s.cooldown) e.cooldowns[s.id] = s.cooldown + 1; stats.used.spells++; };

    // --- Effets des sorts du héros (profil complet) : renvoie true si le sort donne un tour bonus. ---
    const castEffect = (s) => {
        const target = enemy;
        cast(hero, s);
        switch (s.effect) {
            case 'sweepRow': return destroy(hero, target, bestLines(rows(), s, 1).flat(), s);
            case 'sweepCol': return destroy(hero, target, bestLines(cols(), s, 1).flat(), s);
            case 'sweepCross': return destroy(hero, target, [...bestLines(rows(), s, 1).flat(), ...bestLines(cols(), s, 1).flat()], s);
            case 'destroyColumns': return destroy(hero, target, bestLines(cols(), s, s.columns || 3).flat(), s);
            case 'starRain': return destroy(hero, target, [...bestLines(rows(), s, s.rows || 2).flat(), ...bestLines(cols(), s, s.columns || 2).flat()], s);
            case 'clearColor': return destroy(hero, target, board.map((t, i) => (spellColors(s).includes(t) ? i : -1)).filter(i => i >= 0), s);
            case 'harmony': {
                hit(hero, target, spellDamage(hero, target, s), 'spell'); heal(s.heal || 0);
                colors.forEach(c => { target.mana[c] = Math.max(0, (target.mana[c] || 0) - (s.manaDrain || 0)); });
                return false;
            }
            case 'secondWind': heal(s.heal || 0); return false;
            case 'skullsFromColors': case 'redToSkulls': {
                const from = s.convert || ['red'];
                board.forEach((t, i) => { if (from.includes(t)) board[i] = 'skull'; });
                return cascade(hero, target);
            }
            case 'createSkull': {
                const picks = board.map((t, i) => (colors.includes(t) ? i : -1)).filter(i => i >= 0).sort(() => rng() - 0.5).slice(0, 3);
                picks.forEach(i => { board[i] = 'skull'; });
                return cascade(hero, target);
            }
            case 'yellowToPurple': {
                let count = 0; board.forEach((t, i) => { if (t === 'yellow') { board[i] = 'purple'; count++; } });
                hit(hero, target, count * 2, 'spell');
                return cascade(hero, target);
            }
            case 'yellowDamage': {
                const idx = board.map((t, i) => (t === 'yellow' ? i : -1)).filter(i => i >= 0);
                hit(hero, target, idx.length * 2, 'spell');
                return destroy(hero, target, idx, null);
            }
            case 'purpleToDefense': {
                const idx = board.map((t, i) => (t === 'purple' ? i : -1)).filter(i => i >= 0);
                hero.defense = (hero.defense || 0) + idx.length * 5;
                return destroy(hero, target, idx, null);
            }
            case 'destroyActionGemHeal': {
                const idx = board.map((t, i) => (t === 'combat' ? i : -1)).filter(i => i >= 0);
                heal(idx.length * (s.healPerGem || 10));
                idx.forEach(i => { board[i] = null; }); settle(board, n, rng);
                return cascade(hero, target);
            }
            case 'scaleWithBlue': { const bonus = Math.floor((hero.mana.blue || 0) / 3); hit(hero, target, spellDamage(hero, target, s, (s.baseDmg || 0) + bonus), 'spell'); return false; }
            case 'defenseAttack': hit(hero, target, (s.baseDmg || 0) + Math.floor((hero.defense || 0) / 3), 'spell'); return false;
            case 'bonusTurn': hit(hero, target, spellDamage(hero, target, s), 'spell'); return true;
            case 'enchantWeapon': hero.statusEffects.flameblade = hero.mana.red || 0; hero.mana.red = 0; return false;
            case 'statBuff': addStatBuff(hero, { attack: s.atkBuff || 0, defense: s.defBuff || 0, turns: s.duration || 3 }); return false;
            case 'damageBoost': addStatBuff(hero, { attack: s.atkBonus || 10, turns: s.duration || 3 }); return false;
            case 'blockAll': hero.statusEffects.shieldWall = s.duration || 5; return false;
            case 'damageToManaPurple': hero.statusEffects.manaShield = s.duration || 3; return false;
            case 'stunEnemy': target.statusEffects.stunned = Math.max(target.statusEffects.stunned || 0, 2); return false;
            case 'preventItems': target.statusEffects.sealed = s.duration || 3; return false;
            case 'applyPoison': target.statusEffects.poisoned = s.duration || 5; target.statusEffects.poisonDamage = s.poisonDmg || 3; return false;
            case 'reduceManaGain': target.statusEffects.confused = s.duration || 4; return false;
            case 'stealCP': { const stolen = Math.min(s.cpSteal || 5, target.combatPoints); target.combatPoints -= stolen; hero.combatPoints += stolen; return false; }
            case 'giveRedMana': gainMana(hero, 'red', s.manaGain || 20, false); return false;
            case 'rageGain': addRage(hero, boostedRageGain(hero, s.rageGain || 40)); return false;
            case 'rageToMana': { const each = rageToManaAmount(hero.rage, s.manaPerRage); colors.forEach(c => gainMana(hero, c, each, false)); hero.rage = 0; return false; }
            case 'rageToDamage': {
                const total = rageToDamageAmount(hero.rage, s.dmgPerRage);
                const shots = Math.max(1, s.shots || 1);
                for (let k = 0; k < shots; k++) hit(hero, target, Math.floor(total / shots), 'spell');
                if (s.defPerRage) addStatBuff(hero, { defense: Math.floor(hero.rage * s.defPerRage), turns: 3 });
                hero.rage = 0;
                return false;
            }
            default:   // sorts de dégâts directs et de soin
                if (s.heal && !s.dmg) { heal(s.heal); return false; }
                if (s.dmg) hit(hero, target, spellDamage(hero, target, s), 'spell');
                return false;
        }
    };

    // L'ultime est presque prêt (≥ 70 % du qì collecté requis) : on garde la rage pour lui.
    const savingForUltimate = () => Boolean(ultimate) && ultimateCostEntries(ultimate).every(([c, need]) => (hero.ultimateMana[c] || 0) >= need * 0.7);

    // Valeur « dégâts » espérée d'un sort du héros (pour choisir) ; 0 = pas un sort de dégâts.
    const damageValue = s => {
        if (!s.effect) return s.dmg ? spellDamage(hero, enemy, s) : 0;
        switch (s.effect) {
            case 'sweepRow': return lineValue(bestLines(rows(), s, 1)[0], s);
            case 'sweepCol': return lineValue(bestLines(cols(), s, 1)[0], s);
            case 'sweepCross': return lineValue(bestLines(rows(), s, 1)[0], s) + lineValue(bestLines(cols(), s, 1)[0], s);
            case 'destroyColumns': return bestLines(cols(), s, s.columns || 3).reduce((v, l) => v + lineValue(l, s), 0);
            case 'starRain': return bestLines(rows(), s, 2).concat(bestLines(cols(), s, 2)).reduce((v, l) => v + lineValue(l, s), 0);
            case 'clearColor': return board.filter(t => spellColors(s).includes(t)).length * (s.dmgPerTile || 1);
            case 'harmony': return spellDamage(hero, enemy, s);
            case 'skullsFromColors': case 'redToSkulls': return board.filter(t => (s.convert || ['red']).includes(t)).length * 1.2 * (1 + skullStrengthBonus(hero));
            case 'yellowToPurple': case 'yellowDamage': return board.filter(t => t === 'yellow').length * 2;
            case 'scaleWithBlue': return (s.baseDmg || 0) + Math.floor((hero.mana.blue || 0) / 3);
            case 'defenseAttack': return (s.baseDmg || 0) + Math.floor((hero.defense || 0) / 3);
            case 'bonusTurn': return (s.dmg || 0) + 12;
            case 'rageToDamage': return hero.rage >= 50 && !savingForUltimate() ? rageToDamageAmount(hero.rage, s.dmgPerRage) : 0;
            default: return s.dmg && !s.effect ? spellDamage(hero, enemy, s) : 0;
        }
    };

    // Décision d'une action du héros complet : ultime, survie, rage, buffs et contrôles utiles, puis meilleure option de dégâts.
    const heroFullAction = () => {
        const target = enemy;
        const hpPct = hero.hp / hero.maxHp;
        const spells = hero.spellList.filter(s => ready(hero, s));
        const has = eff => spells.find(s => s.effect === eff);
        if (ultimate && hero.rage >= RAGE_MAX && ultimateCostEntries(ultimate).every(([c, need]) => (hero.ultimateMana[c] || 0) >= need)) {
            ultimateCostEntries(ultimate).forEach(([c, need]) => { hero.ultimateMana[c] -= need; });
            hero.rage = 0; stats.used.ultimate++;
            hit(hero, target, ultimate.dmg || 0, 'spell', { unblockable: true });
            if (ultimate.healPercent) heal(hero.maxHp * ultimate.healPercent / 100);
            if (ultimate.defBuff) addStatBuff(hero, { defense: ultimate.defBuff, turns: ultimate.duration || 3 });
            if (ultimate.stunTurns) target.statusEffects.stunned = Math.max(target.statusEffects.stunned || 0, ultimate.stunTurns);
            return false;
        }
        // Survie : objet de soin, sort de soin, Bastion, bouclier de qì.
        if (hpPct < 0.4) {
            if (itemState && itemState.charges > 0 && (itemState.def.effect.heal || itemState.def.effect.regen) && hero.combatPoints >= (itemState.def.actionPoints || 0)) {
                itemState.charges--; itemState.recharge = itemState.def.rechargeTurns || 6; hero.combatPoints -= itemState.def.actionPoints || 0; stats.used.item++;
                if (itemState.def.effect.heal) heal(itemState.def.effect.heal);
                if (itemState.def.effect.regen) hero.statusEffects.regen = { amount: itemState.def.effect.regen, turns: itemState.def.effect.duration || 3 };
                return false;
            }
            const healSpell = spells.find(s => (s.heal && s.effect !== 'harmony') || s.effect === 'secondWind') || has('harmony');
            if (healSpell) return castEffect(healSpell);
            const reinforce = has('destroyActionGemHeal'); if (reinforce && board.filter(t => t === 'combat').length >= 4) return castEffect(reinforce);
        }
        if (hpPct < 0.6) {
            const wall = has('blockAll'); if (wall && !(hero.statusEffects.shieldWall > 0)) return castEffect(wall);
            const stealth = has('damageToManaPurple'); if (stealth && !(hero.statusEffects.manaShield > 0) && (hero.mana.purple || 0) >= 15) return castEffect(stealth);
        }
        // Objet offensif ou de ressources (qì, PA, attaque, défense) dès qu'il est chargé.
        if (itemState && itemState.charges > 0 && !itemState.def.effect.heal && !itemState.def.effect.regen && !itemState.def.effect.revive && hero.combatPoints >= (itemState.def.actionPoints || 0)) {
            const eff = itemState.def.effect;
            itemState.charges--; itemState.recharge = itemState.def.rechargeTurns || 6; hero.combatPoints -= itemState.def.actionPoints || 0; stats.used.item++;
            if (eff.mana) colors.forEach(c => gainMana(hero, c, eff.mana, false));
            if (eff.randomMana) gainMana(hero, colors[Math.floor(rng() * colors.length)], eff.randomMana, false);
            if (eff.gainActionPoints) hero.combatPoints += eff.gainActionPoints;
            if (eff.tempAttack || eff.tempDefense) addStatBuff(hero, { attack: Math.max(0, eff.tempAttack || 0), defense: Math.max(0, eff.tempDefense || 0), turns: 3 });
            return false;
        }
        // Rage : la remplir si un sort de rage ou l'ultime peut s'en servir ; la convertir quand elle est haute.
        const rageUser = hero.spellList.some(s => s.effect === 'rageToDamage' || s.effect === 'rageToMana') || ultimate;
        const gain = has('rageGain'); if (gain && rageUser && hero.rage < 60) return castEffect(gain);
        const toMana = has('rageToMana'); if (toMana && hero.rage >= 70 && !savingForUltimate()) return castEffect(toMana);
        // Buffs et contrôles qui ne sont pas déjà actifs.
        const buff = spells.find(s => (s.effect === 'statBuff' || s.effect === 'damageBoost') && !(hero.statBuffs?.attack || hero.statBuffs?.defense));
        if (buff && target.hp > target.maxHp * 0.25) return castEffect(buff);
        const stun = has('stunEnemy'); if (stun && !(target.statusEffects.stunned > 0)) return castEffect(stun);
        const seal = has('preventItems'); if (seal && target.weaponUsed && !(target.statusEffects.sealed > 0)) return castEffect(seal);
        const poison = has('applyPoison'); if (poison && !(target.statusEffects.poisoned > 0)) return castEffect(poison);
        const confuse = has('reduceManaGain'); if (confuse && !(target.statusEffects.confused > 0)) return castEffect(confuse);
        const steal = has('stealCP'); if (steal && target.combatPoints >= 3) return castEffect(steal);
        const wall = has('purpleToDefense'); if (wall && board.filter(t => t === 'purple').length >= 6) return castEffect(wall);
        const red = has('giveRedMana'); if (red && (hero.mana.red || 0) < 15 && hero.spellList.some(s => costOf(s).red)) return castEffect(red);
        const flame = has('enchantWeapon'); if (flame && hero.weaponUsed && (hero.mana.red || 0) >= 12 && !hero.statusEffects.flameblade) return castEffect(flame);
        // Meilleure option de dégâts : arme ou sort, sinon le plateau.
        let best = null, bestValue = 0;
        for (const s of spells) { const v = damageValue(s); if (v > bestValue) { bestValue = v; best = s; } }
        if (weaponReady(hero) && weaponRaw(hero) + (hero.statusEffects.flameblade || 0) >= bestValue) return useWeapon(hero, target);
        if (best && bestValue >= 8) return castEffect(best);
        return boardMove(hero, target);
    };

    // Action « standard » (ennemi, et héros standard) : arme ou sort de dégâts direct, sinon le plateau.
    const standardAction = (e, target) => {
        const spell = e.damageSpells.filter(s => canPay(e, s)).sort((a, b) => spellDamage(e, target, b) - spellDamage(e, target, a))[0];
        const spellDmg = spell ? spellDamage(e, target, spell) : 0;
        if (weaponReady(e) && weaponRaw(e) >= spellDmg) return useWeapon(e, target);
        if (spell) { pay(e, spell); hit(e, target, spellDmg, 'spell'); return false; }
        return boardMove(e, target);
    };

    // Décision de l'ennemi selon son palier : mêmes scores et même tirage que enemyAI.js (makeDecision, evaluateSpells / Weapon / BoardMove),
    // sans personnalité ; seuls ses sorts de dégâts sont pris en compte.
    const enemyTierAction = () => {
        const target = hero, e = enemy, d = ai;
        const vulnerable = target.hp < target.maxHp * (d.aggressiveThreshold ?? 0.6);
        const options = [];
        const spell = e.damageSpells.filter(sp => canPay(e, sp)).sort((a, b) => spellDamage(e, target, b) - spellDamage(e, target, a))[0];
        if (spell) {
            const dmg = cappedEnemyHit(spellDamage(e, target, spell), enemyDamageScale, target.maxHp);
            const fatal = dmg >= target.hp;
            let score = (vulnerable ? 80 : 40) + Math.floor(dmg / 5) + (fatal ? 200 : 0);
            score = d.strategicThinking ? score + rng() * 20 : rng() * 100;
            options.push({ type: 'spell', spell, dmg, score, probability: d.spellUseProbability, data: { reason: fatal ? FATAL_REASON : '' } });
        }
        if (weaponReady(e)) {
            const dmg = Math.floor(cappedEnemyHit(weaponRaw(e), enemyDamageScale, target.maxHp) * (1 + (critChance(e) / 100) * (CRIT_MULTIPLIER - 1)) * (1 - (blockChance(target) / 100) * 0.7));
            const fatal = dmg >= target.hp;
            let score = (fatal ? 200 : vulnerable ? 70 : 40) + Math.floor(dmg / 3);
            score = d.strategicThinking ? score + rng() * 15 : rng() * 100;
            options.push({ type: 'weapon', score, probability: d.weaponUseProbability, data: { reason: fatal ? FATAL_REASON : '' } });
        }
        const manaTotal = colors.reduce((t, c) => t + (e.mana[c] || 0), 0);
        let boardScore = 30 + (manaTotal < 10 ? 40 : 0) + (!spell && e.combatPoints < 5 ? 50 : 0);
        if (!d.strategicThinking) boardScore += rng() * 30;
        options.push({ type: 'board', score: boardScore, probability: d.boardMoveProbability, data: { reason: '' } });
        let chosen, stupid = false;
        if (d.stupidityChance > 0 && rng() < d.stupidityChance) { stupid = true; chosen = options[Math.floor(rng() * options.length)]; }
        else {
            const lethal = options.filter(o => o.data.reason === FATAL_REASON).sort((a, b) => b.score - a.score)[0];
            if (lethal && rng() < (d.lethalAwareness || 0)) chosen = lethal;
            else {
                if (d.strategicThinking) applyScoreSharpness(options, d.scoreSharpness);
                chosen = pickWeightedOption(options, rng);
            }
        }
        if (chosen.type === 'weapon') return useWeapon(e, target);
        if (chosen.type === 'spell') { pay(e, chosen.spell); hit(e, target, spellDamage(e, target, chosen.spell), 'spell'); return false; }
        return boardMove(e, target, stupid || d.randomBoardMove);
    };

    const endHeroTurn = () => {
        tickStatBuffs(hero);
        ['shieldWall', 'manaShield'].forEach(k => { if (hero.statusEffects[k] > 0) hero.statusEffects[k]--; });
        Object.keys(hero.cooldowns).forEach(k => { if (hero.cooldowns[k] > 0) hero.cooldowns[k]--; });
        const regen = hero.statusEffects.regen;
        if (regen?.turns > 0) { heal(regen.amount); regen.turns--; }
        if (itemState && itemState.charges < (itemState.def.chargesPerCycle || 1) && --itemState.recharge <= 0) itemState.charges = itemState.def.chargesPerCycle || 1;
        if (!full || !companion || enemy.hp <= 0) return { extraMove: false };
        let extraMove = false;
        if (COMPANION_POWERS[companion]?.kind === 'extraMove' && rng() < COMPANION_POWERS[companion].chance) { extraMove = true; stats.used.companion++; }
        rollCompanionPowers([companion], hero, rng, enemy).forEach(({ power, amount, color }) => {
            stats.used.companion++;
            if (power.kind === 'heal') heal(amount);
            else if (power.kind === 'splash') hit(hero, enemy, amount, 'other', { strike: false });
            else if (power.kind === 'mana') gainMana(hero, color, amount, false);
            else if (power.kind === 'mirage') enemy.statusEffects.mirage = 1;
            else if (power.kind === 'rage') addRage(hero, Math.round(RAGE_MAX * amount));
            else if (power.kind === 'steal') { gainMana(hero, color, enemy.mana[color] || 0, false); enemy.mana[color] = 0; }
            else if (power.kind === 'arrows') { const c = colors[Math.floor(rng() * colors.length)]; board.forEach((t, i) => { if (t === c) board[i] = 'combat'; }); cascade(hero, enemy); }
        });
        return { extraMove };
    };

    const heroTurn = () => {
        let bonusLeft = 1;
        while (hero.hp > 0 && enemy.hp > 0) {
            const bonus = full ? heroFullAction() : standardAction(hero, enemy);
            if (!(bonus && bonusLeft-- > 0)) break;
        }
        if (enemy.hp > 0 && endHeroTurn().extraMove) boardMove(hero, enemy);   // Xiao Gui : coup supplémentaire
    };

    const enemyTurn = () => {
        const st = enemy.statusEffects;
        if (st.poisoned > 0) { hit(hero, enemy, st.poisonDamage || 1, 'other', { strike: false }); st.poisoned--; }
        if (enemy.hp <= 0) return;
        const skip = (st.stunned > 0) || (st.mirage > 0);
        if (st.stunned > 0) st.stunned--;
        if (st.mirage > 0) st.mirage--;
        if (!skip) {
            let bonusLeft = 1;
            while (enemy.hp > 0 && hero.hp > 0) {
                const bonus = ai ? enemyTierAction() : standardAction(enemy, hero);
                if (!(bonus && bonusLeft-- > 0)) break;
            }
        }
        tickStatBuffs(enemy);
        ['sealed', 'confused'].forEach(k => { if (st[k] > 0) st[k]--; });
    };

    let cycles = 0;
    while (hero.hp > 0 && enemy.hp > 0 && cycles < maxCycles) {
        cycles++;
        heroTurn();
        if (enemy.hp <= 0) break;
        enemyTurn();
    }
    stats.aiTier = ai?.tier || 'greedy';
    stats.rageEnd = hero.rage; stats.ultMana = { ...hero.ultimateMana };
    return { heroWon: enemy.hp <= 0 && hero.hp > 0, cycles, ...stats, heroHpLeft: Math.max(0, hero.hp), heroMaxHp: hero.maxHp, enemyHpLeft: Math.max(0, enemy.hp), timeout: hero.hp > 0 && enemy.hp > 0 };
}
