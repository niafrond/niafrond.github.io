// Simulateur de duel héros / boss, pour prouver l'équilibrage (bossBalanceSim.test.js).
//
// Ce n'est PAS le jeu : le plateau de match-3 est modélisé (une combinaison par action, couleur choisie avec une probabilité d'adresse).
// Tout le reste utilise les VRAIES règles et données : héros forgé par la vraie courbe de niveaux (playerForge.js), boss généré par
// createMapEnemy, critiques / blocages / avantage de niveau (combatStats.js resolveStrike, levelEdge), gain et réserve de qì par attribut
// (attributes.js), faiblesse et résistances du boss, affinité de couleur (game.js applyEnemyColorAffinityModifier), parures (stuff.js).
//
// Hypothèses (toutes réglables) : voir DEFAULTS. Les soins, les objets, l'ultime, les crânes et les compagnons ne sont PAS modélisés :
// le héros simulé est donc plutôt prudent (il ne se soigne jamais).
import './xhrFromDisk.js';
import { resolveStrike } from '../../../combatStats.js';
import { manaBonusFor, ATTRIBUTE_MANA_RULES } from '../../../attributes.js';
import { createMapEnemy } from '../../../enemies.js';
import { bossStartingMana, manaGainFor, isOffensiveSpell, shouldBossCast } from '../../../bossBalance.js';
import { wardedDamage, allStuff, STUFF_SLOTS } from '../../../stuff.js';
import { forgePlayer, bestWeapon, MANA_COLORS } from './playerForge.js';

export const DEFAULTS = {
    steer: 0.6,                 // part des combinaisons du héros qui visent la ressource voulue (adresse du joueur)
    lenWeights: { 3: 0.6, 4: 0.3, 5: 0.1 },   // longueur des combinaisons ; 4+ donne un tour bonus
    maxHeroTurns: 150,
    weaknessBonus: 0.25         // terrain.js WEAKNESS_DAMAGE_BONUS (boss à faiblesse repérée)
};

export function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const ATTR_OF_COLOR = Object.fromEntries(Object.entries(ATTRIBUTE_MANA_RULES).map(([attr, rule]) => [rule.color, attr]));
const spellColors = sp => (typeof sp.cost === 'object' && sp.cost ? Object.keys(sp.cost) : [sp.color]).filter(Boolean);
const costOf = sp => (typeof sp.cost === 'object' && sp.cost ? sp.cost : { [sp.color]: sp.cost });

const pickLen = (rng, weights) => { let r = rng(), acc = 0; for (const [len, w] of Object.entries(weights)) { acc += w; if (r < acc) return Number(len); } return 3; };
const gainBonus = (entity, color) => entity.isBoss ? 0 : manaBonusFor(ATTR_OF_COLOR[color], entity.attributes?.[ATTR_OF_COLOR[color]], 'gain');
const capOf = (entity, color) => (entity.maxMana ?? 50) + (entity.isBoss ? 0 : manaBonusFor(ATTR_OF_COLOR[color], entity.attributes?.[ATTR_OF_COLOR[color]], 'max'));
const canPay = (entity, sp) => Object.entries(costOf(sp)).every(([c, n]) => (entity.mana[c] || 0) >= n);
const pay = (entity, sp) => Object.entries(costOf(sp)).forEach(([c, n]) => { entity.mana[c] -= n; });

/** Meilleur stuff hors parure pour chaque emplacement (PV, attaque, défense), niveau permettant. */
export function bestPlainStuff(level) {
    const score = s => (s.maxHp || 0) / 10 + (s.atkBonus || 0) + (s.defBonus || 0);
    const worn = {};
    for (const slot of STUFF_SLOTS) {
        const pool = allStuff.filter(s => s.slot === slot && !s.quest && !s.ward && s.minLevel <= level);
        worn[slot] = pool.sort((a, b) => score(b) - score(a))[0]?.id || null;
    }
    return worn;
}

/**
 * Héros de niveau `level` : vraie courbe de niveaux, meilleure arme à deux mains, meilleur stuff hors parure, quatre sorts de dégâts.
 * `prepared` : un des sorts est de la couleur faible du boss (le joueur a varié ses sorts) ; sinon aucun sort de cette couleur.
 * `wardElement` : porte les quatre pièces ancestrales / talismans de cet élément.
 */
export function buildHero({ level, classId = 'templar', boss, prepared = true, wardElement = null }) {
    const weapon = bestWeapon(level, w => w.twoHanded) || bestWeapon(level);
    const hero = forgePlayer({ classId, level, weaponIds: [weapon.id], equippedWeaponId: weapon.id });
    const plain = bestPlainStuff(level);
    hero.stuffOwned = Object.values(plain).filter(Boolean);
    hero.stuff = { ...plain };
    hero.maxHp += hero.stuffOwned.reduce((n, id) => n + (allStuff.find(s => s.id === id).maxHp || 0), 0);
    if (wardElement) {
        const tier = level >= 46 ? 2 : 1;
        STUFF_SLOTS.forEach(slot => { const id = `ward_${wardElement}_${slot}_${tier}`; hero.stuffOwned.push(id); hero.stuff[slot] = id; });
        hero.maxHp += tier === 2 ? 20 * 4 : 0;
    }
    hero.hp = hero.maxHp;
    hero.maxMana = 50;
    const damaging = hero.availableSpells.filter(sp => sp.type === 'damage' && (sp.dmg || 0) > 0 && !sp.effect && sp.minLevel <= level);
    // sorts réellement payables : coût par couleur ≤ réserve (50 + 2 par point d'attribut)
    const payable = damaging.filter(sp => Object.entries(costOf(sp)).every(([c, n]) => n <= capOf(hero, c)));
    // préparé : les plus puissants, dont un de la couleur faible du boss ; non préparé : aucun sort de sa couleur faible
    const pool = !prepared && boss?.weakColor ? payable.filter(sp => !spellColors(sp).includes(boss.weakColor)) : payable;
    const strongest = [...pool].sort((a, b) => b.dmg - a.dmg);
    let loadout = strongest.slice(0, 4);
    if (prepared && boss?.weakColor && !loadout.some(sp => spellColors(sp).includes(boss.weakColor))) {
        const weak = strongest.find(sp => spellColors(sp).includes(boss.weakColor));
        if (weak) loadout = [...loadout.slice(0, 3), weak];
    }
    hero.loadout = loadout;
    hero.weapon = weapon;
    hero.mana = Object.fromEntries(MANA_COLORS.map(c => [c, manaBonusFor(ATTR_OF_COLOR[c], hero.attributes[ATTR_OF_COLOR[c]], 'initial')]));
    hero.combatPoints = 0;
    return hero;
}

/** Boss tel que le jeu le génère, avec l'avantage de niveau et le qì de départ (applyStartingAbilities de game.js). */
export function buildBoss({ templateId, level, enemyId = 'sim' }) {
    const boss = createMapEnemy({ templateId, level, boss: { name: 'Boss' }, enemyId });
    boss.mana = Object.fromEntries(MANA_COLORS.map(c => [c, 0]));   // un boss n'a pas de qì d'attribut (game.js getAttributeManaBonus)
    Object.entries(bossStartingMana(boss.spells, c => capOf(boss, c))).forEach(([c, n]) => { boss.mana[c] = Math.min(capOf(boss, c), (boss.mana[c] || 0) + n); });
    boss.maxMana = 50;
    boss.combatPoints = 0;
    return boss;
}

function heroSpellDamage(hero, boss, sp, o) {
    const colors = spellColors(sp);
    let dmg = (sp.dmg || 0) + (hero.attributes.intelligence || 0);
    const resist = colors.reduce((s, c) => s + (boss.resistances?.[c] || 0), 0) / colors.length;
    dmg = Math.floor(dmg * (1 - resist));
    if (boss.prep?.weaknessRevealed && colors.includes(boss.weakColor)) dmg = Math.ceil(dmg * (1 + o.weaknessBonus));
    return dmg;
}

// Affinité de couleur du jeu : la couleur du boss perd `niveau` dégâts, sa couleur faible en gagne autant (game.js applyEnemyColorAffinityModifier).
function affinity(boss, dmg, sp) {
    const color = (typeof sp.color === 'string' && sp.color) || Object.keys(costOf(sp))[0];
    if (color === boss.preferredColor) return Math.max(0, dmg - boss.level);
    if (color === boss.weakColor) return dmg + boss.level;
    return dmg;
}

/**
 * Un duel jusqu'à la mort d'un des deux. Renvoie { win, turns, heroHp, bossHp, bossDamageTaken }.
 */
export function simulateDuel({ hero, boss, rng, options = {} }) {
    const o = { ...DEFAULTS, ...options };
    const h = { ...hero, mana: { ...hero.mana }, attributes: { ...hero.attributes }, combatPoints: 0, hp: hero.maxHp };
    const b = { ...boss, mana: { ...boss.mana }, hp: boss.maxHp, combatPoints: 0 };
    h.levelEdge = Math.max(0, h.level - b.level);
    b.levelEdge = Math.max(0, b.level - h.level);
    const rngf = () => rng();
    const matchLen = () => pickLen(rngf, o.lenWeights);

    const heroGain = (color, len) => { h.mana[color] = Math.min(capOf(h, color), (h.mana[color] || 0) + len + gainBonus(h, color)); };

    function heroAct() {
        // meilleure action immédiate
        let best = null;
        for (const sp of h.loadout) {
            if (!canPay(h, sp)) continue;
            const base = heroSpellDamage(h, b, sp, o);
            const exp = affinity(b, base, sp);
            if (!best || exp > best.exp) best = { kind: 'spell', sp, exp, base };
        }
        if (h.combatPoints >= h.weapon.actionPoints) {
            const exp = h.weapon.damage;
            if (!best || exp > best.exp) best = { kind: 'weapon', exp };
        }
        if (best?.kind === 'spell') {
            pay(h, best.sp);
            const dmg = affinity(b, best.base, best.sp);
            b.hp -= resolveStrike(dmg, h, b, { rng: rngf }).damage;
            return false;
        }
        if (best?.kind === 'weapon') {
            h.combatPoints -= h.weapon.actionPoints;
            b.hp -= resolveStrike(h.weapon.damage, h, b, { rng: rngf }).damage;
            return false;
        }
        // sinon : une combinaison sur le plateau. Cible : le qì qui manque au meilleur sort, sinon les épées de l'arme.
        const target = h.loadout.length ? [...h.loadout].sort((x, y) => heroSpellDamage(h, b, y, o) - heroSpellDamage(h, b, x, o))[0] : null;
        let want = 'swords';
        if (target) {
            const missing = Object.entries(costOf(target)).filter(([c, n]) => (h.mana[c] || 0) < n).sort((x, y) => (y[1] - h.mana[y[0]]) - (x[1] - h.mana[x[0]]));
            if (missing.length) want = missing[0][0];
        }
        const pool = [...MANA_COLORS, 'swords'];
        const type = rngf() < o.steer ? want : pool[Math.floor(rngf() * pool.length)];
        const len = matchLen();
        if (type === 'swords') h.combatPoints += len; else heroGain(type, len);
        return len >= 4;   // tour bonus
    }

    function bossAct() {
        const offensive = b.spells.filter(sp => isOffensiveSpell(sp) && canPay(b, sp)).sort((x, y) => y.dmg - x.dmg);
        const spellEval = offensive.length ? { spell: offensive[0] } : null;
        if (spellEval && (shouldBossCast(b, spellEval, rngf) || rngf() < 0.15)) {
            const sp = spellEval.spell;
            pay(b, sp);
            let raw = (sp.dmg || 0) + (b.spellPower || 0);
            raw = wardedDamage(raw, h, spellColors(sp));
            h.hp -= resolveStrike(raw, b, h, { rng: rngf }).damage;
            return false;
        }
        if (b.weapon && b.combatPoints >= b.weapon.actionPoints && rngf() < 0.5) {
            b.combatPoints -= b.weapon.actionPoints;
            h.hp -= resolveStrike(b.weapon.damage + (b.weaponPower || 0), b, h, { rng: rngf }).damage;
            return false;
        }
        const pool = [...MANA_COLORS, 'swords'];
        const type = pool[Math.floor(rngf() * pool.length)];
        const len = matchLen();
        if (type === 'swords') b.combatPoints += len;
        else b.mana[type] = Math.min(capOf(b, type), (b.mana[type] || 0) + len + manaGainFor(gainBonus(b, type), b));
        return len >= 4;
    }

    let turns = 0, heroFirst = rngf() < 0.5;
    while (turns < o.maxHeroTurns && h.hp > 0 && b.hp > 0) {
        const order = heroFirst ? ['hero', 'boss'] : ['boss', 'hero'];
        for (const who of order) {
            if (h.hp <= 0 || b.hp <= 0) break;
            let again = true, guard = 0;
            while (again && guard++ < 4 && h.hp > 0 && b.hp > 0) again = who === 'hero' ? heroAct() : bossAct();
        }
        turns++;
    }
    return { win: b.hp <= 0 && h.hp > 0, turns, heroHp: Math.max(0, h.hp), bossHp: Math.max(0, b.hp) };
}

/** Taux de victoire sur `runs` duels (graine fixe : résultat reproductible). */
export function winRate({ hero, boss, runs = 120, seed = 1, options }) {
    let wins = 0, turns = 0;
    for (let i = 0; i < runs; i++) {
        const r = simulateDuel({ hero, boss, rng: makeRng(seed * 7919 + i * 104729), options });
        if (r.win) wins++;
        turns += r.turns;
    }
    return { rate: wins / runs, avgTurns: turns / runs };
}
