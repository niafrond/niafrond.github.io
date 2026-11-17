// Effets de combat de l'équipement : dégâts contre altération, bonus de sorts, résistances, signature, parade, résistance aux contrôles.
import './fixtures/playerForge.js';
import { describe, test, expect } from '@jest/globals';
import {
    gearEffectTotals, boostedDamageDealt, resistedDamageTaken, signatureReduction, parryQiGain, resistsControl, describeEffects
} from '../../gearEffects.js';
import { allStuff, getStuffById } from '../../stuff.js';
import { allWeapons } from '../../weapons.js';
import { inflictAlteration, inflictTurnLoss } from '../../alterations.js';
import { signatureDamage } from '../../bossScript.js';
import { resolveStrike, setStrikeHooks } from '../../combatStats.js';
import { enemyVersionOfSpell } from '../../enemies.js';
import { allSpells } from '../../spells.js';
import { allItems, useItem } from '../../items.js';
import { cureStatuses, afflictionsOf } from '../../alterations.js';

const hero = (ids = [], extra = {}) => {
    const slots = {};
    ids.forEach(id => { slots[getStuffById(id).slot] = id; });
    return { level: 40, hp: 100, maxHp: 100, stuffOwned: ids, stuff: slots, statusEffects: {}, ...extra };
};

describe('catalogue', () => {
    test('chaque effet du catalogue est décrit', () => {
        [...allStuff, ...allWeapons].filter(p => p.effects).forEach(p => expect(describeEffects(p).length).toBeGreaterThan(0));
    });
    test('un ennemi ne tire aucun effet de son stuff', () => {
        const e = { stuff: { ring: 'bague_de_la_parade_fluide' }, statusEffects: {} };
        expect(gearEffectTotals(e).parryQi.chance).toBe(0);
    });
});

describe('dégâts infligés', () => {
    test('arme : +25 % contre un ennemi empoisonné, rien sinon', () => {
        const h = hero([], { equippedWeapon: allWeapons.find(w => w.id === 'arc_de_la_vipere') });
        expect(boostedDamageDealt(h, { statusEffects: { poisoned: 2 } }, 40).damage).toBe(50);
        expect(boostedDamageDealt(h, { statusEffects: {} }, 40).damage).toBe(40);
    });
    test('collier de la marée : sorts d\'Eau seulement, pas les ultimes', () => {
        const h = hero(['collier_de_la_maree']);
        expect(boostedDamageDealt(h, {}, 100, { colors: ['blue'] }).damage).toBe(115);
        expect(boostedDamageDealt(h, {}, 100, { colors: ['red'] }).damage).toBe(100);
        expect(boostedDamageDealt(h, {}, 100, { colors: ['blue'], ultimate: true }).damage).toBe(100);
    });
});

describe('dégâts subis', () => {
    test('résistances par source (crânes, armes, sorts)', () => {
        const h = hero(['bracelet_garde_crane', 'collier_des_fleches_detournees']);
        expect(resistedDamageTaken(h, 20, 'skull').damage).toBe(17);
        expect(resistedDamageTaken(h, 20, 'weapon').damage).toBe(17);
        expect(resistedDamageTaken(h, 20, 'spell').damage).toBe(20);
    });
    test('attaque signature réduite, plafonnée avec la préparation', () => {
        const h = hero(['bracelet_de_l_inflexible']);
        expect(signatureReduction(h)).toBe(0.25);
        const base = signatureDamage({ share: 0.4 }, hero()).damage;
        expect(signatureDamage({ share: 0.4 }, h).damage).toBe(Math.round(100 * 0.4 * 0.75));
        expect(base).toBe(40);
    });
});

describe('parade et contrôles', () => {
    test('parade : qì selon le jet', () => {
        const h = hero(['bague_de_la_parade_fluide']);
        expect(parryQiGain(h, () => 0.1).amount).toBe(2);
        expect(parryQiGain(h, () => 0.9).amount).toBe(0);
        expect(parryQiGain(hero(), () => 0).amount).toBe(0);
    });
    test('resolveStrike signale le blocage à la cible', () => {
        const seen = [];
        setStrikeHooks({ onBlock: (t, b) => seen.push(b) });
        resolveStrike(10, { attack: 0 }, { defense: 1000, level: 1 }, { rng: () => 0.01 });
        setStrikeHooks({ onBlock: () => {} });
        expect(seen.length).toBe(1);
    });
    test('casque du veilleur : immunisé contre l\'étourdissement', () => {
        const h = hero(['casque_du_veilleur']);
        expect(inflictTurnLoss(h, 'stunned', 1)).toMatchObject({ landed: false, reason: 'gear' });
        expect(h.statusEffects.stunned).toBeUndefined();
        expect(inflictAlteration(hero(), 'stunned', 1)).toBe(true);
        expect(resistsControl(h, 'asleep', () => 0.9)).toBe(false);
        expect(resistsControl(h, 'asleep', () => 0.1)).toBe(true);
    });
    test('la Prison du Tonnerre Glacé étourdit le héros quand l\'ennemi la lance', () => {
        const sp = enemyVersionOfSpell(allSpells.find(s => s.id === 'thunderPrison'));
        expect(sp).toMatchObject({ effect: 'alterEnemy', alteration: 'stunned' });
    });
});

describe('remèdes (effet `cure`)', () => {
    const sick = () => ({ hp: 50, maxHp: 100, mana: { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 }, inventory: [], statusEffects: { poisoned: 3, poisonDamage: 5, cursed: 2, cursePct: 30, muted: 1, sealed: 2 } });
    const withItem = id => { const p = sick(); p.inventory.push({ ...allItems.find(i => i.id === id) }); return p; };

    test('l\'antidote guérit le poison et ses champs annexes seulement', () => {
        const p = withItem('antidotePill');
        expect(useItem('antidotePill', p, null, 0).success).toBe(true);
        expect(p.statusEffects.poisoned).toBeUndefined();
        expect(p.statusEffects.poisonDamage).toBeUndefined();
        expect(p.statusEffects.cursed).toBe(2);
    });
    test('le sel de jade guérit malédiction et corruption', () => {
        const p = withItem('jadeSaltTalisman');
        useItem('jadeSaltTalisman', p, null, 0);
        expect(p.statusEffects.cursed).toBeUndefined();
        expect(p.statusEffects.cursePct).toBeUndefined();
        expect(p.statusEffects.poisoned).toBe(3);
    });
    test('l\'élixir de purification guérit tout sauf le scellement', () => {
        const p = withItem('purificationElixir');
        useItem('purificationElixir', p, null, 0);
        expect(afflictionsOf(p)).toEqual([]);
        expect(p.statusEffects.sealed).toBe(2);
    });
    test('chaque remède soigne au moins une altération connue', () => {
        allItems.filter(i => i.effect?.cure).forEach(i => {
            const keys = i.effect.cure === 'all' ? 'all' : i.effect.cure;
            const e = { statusEffects: Object.fromEntries((keys === 'all' ? ['poisoned'] : keys).map(k => [k, 2])) };
            expect(cureStatuses(e, keys).length).toBeGreaterThan(0);
        });
    });
});
