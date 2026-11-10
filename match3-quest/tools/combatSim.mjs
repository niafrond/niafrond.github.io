// Simulateur de combats (Node, sans DOM) pour chercher l'équilibrage : vrai plateau (matchMechanics.js), vraie résolution des coups
// (combatStats.js : critique, blocage), vrais ennemis de la carte (enemies.js > createMapEnemy), héros types des tests (playerForge.js).
// Joueur « standard » glouton : arme ou sort de dégâts dès qu'il peut, sinon le meilleur coup du plateau (crânes, puis PA / qì utiles).
// Simplifications (le jeu réel est plus riche) : sorts à effet (plateau, altérations, rage), objets, compagnons, ultimes, jokers,
// résistances élémentaires du héros et cases de biome sont ignorés ; un seul tour bonus par tour (match de 4 et plus).
// Usage : voir tools/balance-search.mjs.
import { colors, setBoardSize } from '../constants.js';
import { collectMatches, findPossibleMatches } from '../matchMechanics.js';
import { resolveStrike, skullStrengthBonus } from '../combatStats.js';
import { ATTRIBUTE_MANA_RULES } from '../attributes.js';

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

/** Prépare un combattant (copie) : qì de départ (1 par point d'attribut), PA à 0, sorts de dégâts directs seulement. */
export function fighter(src, { isHero = false } = {}) {
    const e = { ...src, statusEffects: {}, combatPoints: 0, isHero };
    e.mana = Object.fromEntries(colors.map(c => [c, Math.min(manaCap(e, c), attrPoints(e, c))]));
    e.weaponUsed = isHero ? src.equippedWeapon : src.weapon;
    const spells = isHero ? (src.activeSpells || []) : (src.spells || []);
    e.damageSpells = spells.filter(s => s.dmg > 0 && (!s.effect || s.boardSpell) && !s.heal);
    e.hp = e.maxHp;
    return e;
}

function spellDamage(caster, target, spell) {
    const cols = spell.colors || (typeof spell.cost === 'object' ? Object.keys(spell.cost) : [spell.color]);
    const res = cols.reduce((s, c) => s + (target.resistances?.[c] || 0), 0) / Math.max(1, cols.length);
    return Math.floor((spell.dmg + attrPoints(caster, 'blue')) * (1 - res));
}
const weaponRaw = e => (e.weaponUsed ? e.weaponUsed.damage + (e.isHero ? 0 : (e.weaponPower || 0)) : 0);

// --- Un combat -----------------------------------------------------------------------------------------------------------------------------
/**
 * Joue un combat jusqu'à la mort d'un camp (ou MAX_CYCLES). `enemyDamageScale` multiplie les dégâts subis par le héros (calibrage).
 * Renvoie { heroWon, cycles, dealtBy: {weapon, spell, skull}, takenRaw, heroHpLeft, enemyHpLeft }.
 */
export function simulateFight(heroSrc, enemySrc, { seed = 1, boardSize = 8, enemyDamageScale = 1, maxCycles = MAX_CYCLES, immortal = false } = {}) {
    const rng = mulberry32(seed);
    const hero = fighter(heroSrc, { isHero: true }), enemy = fighter(enemySrc);
    if (immortal) { hero.hp = hero.maxHp = 1e9; enemy.hp = enemy.maxHp = 1e9; }   // mesure des taux : personne ne meurt
    hero.levelEdge = Math.max(0, (hero.level || 0) - (enemy.level || 0));
    enemy.levelEdge = Math.max(0, (enemy.level || 0) - (hero.level || 0));
    const n = boardSize;
    let board = newBoard(n, rng);
    const stats = { dealtBy: { weapon: 0, spell: 0, skull: 0 }, takenRaw: 0 };

    const hit = (attacker, target, raw, source) => {
        if (raw <= 0) return;
        let dmg = resolveStrike(raw, attacker, target, { rng }).damage;
        if (target.isHero) { stats.takenRaw += dmg; dmg = Math.max(dmg > 0 ? 1 : 0, Math.round(dmg * enemyDamageScale)); }
        else stats.dealtBy[source] += Math.min(dmg, Math.max(0, target.hp));
        target.hp -= dmg;
    };

    const bestSpell = (e, target) => e.damageSpells.filter(s => canPay(e, s)).sort((a, b) => spellDamage(e, target, b) - spellDamage(e, target, a))[0];
    const neededColors = e => new Set(e.damageSpells.flatMap(s => Object.keys(costOf(s))));

    const scoreMove = (e, target, info) => {
        const needs = neededColors(e);
        if (info.type === 'skull') return info.len * (1 + skullStrengthBonus(e)) * 3;
        if (info.type === 'combat') return e.weaponUsed ? info.len * 2.5 : 0.5 * info.len;
        return info.len * (needs.has(info.color) ? 2 : 0.7);
    };

    const boardMove = (e, target) => {
        const moves = findPossibleMatches(board);
        if (!moves.length) { board = newBoard(n, rng); return false; }
        let best = null, bestScore = -1;
        for (const m of moves) {
            [board[m.from], board[m.to]] = [board[m.to], board[m.from]];
            const score = collectMatches(board).reduce((s, x) => s + scoreMove(e, target, x.info) + (x.info.len >= 4 ? 6 : 0), 0) + rng() * 0.01;
            [board[m.from], board[m.to]] = [board[m.to], board[m.from]];
            if (score > bestScore) { bestScore = score; best = m; }
        }
        [board[best.from], board[best.to]] = [board[best.to], board[best.from]];
        let bonus = false;
        for (let guard = 0; guard < 30; guard++) {
            const matches = collectMatches(board);
            if (!matches.length) break;
            const cleared = new Set();
            for (const { indices, info } of matches) {
                indices.forEach(i => cleared.add(i));
                if (info.type === 'skull') hit(e, target, info.len * (1 + skullStrengthBonus(e)), 'skull');
                else if (info.type === 'combat') e.combatPoints += info.len;
                else e.mana[info.color] = Math.min(manaCap(e, info.color), (e.mana[info.color] || 0) + info.len + attrPoints(e, info.color));
                if (info.len >= 4) bonus = true;
            }
            cleared.forEach(i => { board[i] = null; });
            settle(board, n, rng);
        }
        if (!findPossibleMatches(board).length) board = newBoard(n, rng);
        return bonus;
    };

    const act = (e, target) => {
        const spell = bestSpell(e, target);
        const weaponOk = e.weaponUsed && e.combatPoints >= e.weaponUsed.actionPoints;
        const spellDmg = spell ? spellDamage(e, target, spell) : 0;
        if (weaponOk && weaponRaw(e) >= spellDmg) { e.combatPoints -= e.weaponUsed.actionPoints; hit(e, target, weaponRaw(e), 'weapon'); return false; }
        if (spell) { pay(e, spell); hit(e, target, spellDmg, 'spell'); return false; }
        return boardMove(e, target);
    };

    const turn = (e, target) => {
        let bonusLeft = 1;
        while (e.hp > 0 && target.hp > 0) {
            const bonus = act(e, target);
            if (!(bonus && bonusLeft-- > 0)) break;
        }
    };

    let cycles = 0;
    while (hero.hp > 0 && enemy.hp > 0 && cycles < maxCycles) {
        cycles++;
        turn(hero, enemy);
        if (enemy.hp <= 0) break;
        turn(enemy, hero);
    }
    return { heroWon: enemy.hp <= 0 && hero.hp > 0, cycles, ...stats, heroHpLeft: Math.max(0, hero.hp), heroMaxHp: hero.maxHp, enemyHpLeft: Math.max(0, enemy.hp), timeout: hero.hp > 0 && enemy.hp > 0 };
}
