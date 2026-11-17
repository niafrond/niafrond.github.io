import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { TRANSE_TURNS, startTranse, tickTranse, endTranse, isInTranse, classAllowsUltimate, transeEffectFor, switchGauge, storeGauge } from '../../transe.js';
import { addRage, resetRage, RAGE_MAX, getSelectableUltimates, getEquippedUltimate } from '../../ultimates.js';

test('la Xiūxiān dure TRANSE_TURNS tours puis se termine', () => {
    const e = {};
    expect(startTranse(e)).toBe(true);
    expect(startTranse(e)).toBe(false);
    for (let i = 1; i < TRANSE_TURNS; i++) expect(tickTranse(e)).toBe(false);
    expect(tickTranse(e)).toBe(true);
    expect(isInTranse(e)).toBe(false);
});

test('la jauge pleine ne déclenche rien toute seule : la Xiūxiān est volontaire ; la vider la termine', () => {
    const e = { rage: 0 };
    addRage(e, RAGE_MAX + 50);
    expect(e.rage).toBe(RAGE_MAX);
    expect(isInTranse(e)).toBe(false);
    expect(startTranse(e)).toBe(true);
    expect(isInTranse(e)).toBe(true);
    resetRage(e);
    expect(isInTranse(e)).toBe(false);
});

test('seul le sorcier peut lancer l\'ultime, quelle que soit la classe du héros', () => {
    expect(classAllowsUltimate('sorcerer')).toBe(true);
    ['assassin', 'templar', 'barbarian', null].forEach(c => expect(classAllowsUltimate(c)).toBe(false));
    const guerrier = { class: 'barbarian', level: 99 };
    const ids = getSelectableUltimates(guerrier).map(s => s.class);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(c => c === 'sorcerer')).toBe(true);
    expect(getEquippedUltimate(guerrier)).not.toBeNull();
});

test('effets de Xiūxiān par classe', () => {
    expect(transeEffectFor('assassin').strikePct).toBeGreaterThan(0);
    expect(transeEffectFor('templar').defense).toBeGreaterThan(0);
    expect(transeEffectFor('barbarian').physMult).toBe(2);
    expect(transeEffectFor('sorcerer').doubleCast).toBe(true);
    expect(transeEffectFor('monk').freePotions).toBeUndefined();   // les potions ne coûtent plus de PA : plus d'effet « potions gratuites »
    expect(transeEffectFor('shaman').paMult).toBe(2);
    expect(transeEffectFor('x')).toEqual({});
});

describe('une Xiūxiān par classe', () => {
    test('chaque classe a sa jauge, rangée quand on change de classe', () => {
        const e = { rage: 0 };
        switchGauge(e, 'assassin');
        e.rage = 40;
        switchGauge(e, 'sorcerer');
        expect(e.rage).toBe(0);
        e.rage = 90;
        switchGauge(e, 'assassin');
        expect(e.rage).toBe(40);
        storeGauge(e);
        expect(e.rages).toEqual({ assassin: 40, sorcerer: 90 });
    });
    test('la Xiūxiān appartient à la classe dont la jauge était pleine ; la finir ne vide que cette jauge', () => {
        const e = { rage: 0 };
        switchGauge(e, 'templar'); e.rage = 100;
        switchGauge(e, 'barbarian'); e.rage = 100;
        switchGauge(e, 'templar');
        startTranse(e);
        expect(e.transeClass).toBe('templar');
        switchGauge(e, 'barbarian');   // on change de classe : la Xiūxiān du commandant continue
        expect(isInTranse(e)).toBe(true);
        for (let i = 0; i < TRANSE_TURNS; i++) tickTranse(e);
        expect(isInTranse(e)).toBe(false);
        expect(e.rages.templar).toBe(0);
        expect(e.rage).toBe(100);   // la jauge du guerrier, affichée, est intacte
        switchGauge(e, 'templar');
        expect(e.rage).toBe(0);
    });
    test('chaque Xiūxiān a un nom et une description', () => {
        ['assassin', 'barbarian', 'templar', 'sorcerer', 'monk', 'alchemist', 'shaman'].forEach(c => { expect(transeEffectFor(c).name.length).toBeGreaterThan(5); expect(transeEffectFor(c).text.length).toBeGreaterThan(10); });
    });
    test('toutes les classes ont un effet', () => {
        ['assassin', 'barbarian', 'templar', 'sorcerer', 'monk', 'alchemist', 'shaman'].forEach(c => expect(Object.keys(transeEffectFor(c)).length).toBeGreaterThan(1));
    });
});
