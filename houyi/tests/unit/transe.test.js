import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { TRANSE_TURNS, startTranse, tickTranse, endTranse, isInTranse, classAllowsUltimate, transeEffectFor } from '../../transe.js';
import { addRage, resetRage, RAGE_MAX, getSelectableUltimates, getEquippedUltimate } from '../../ultimates.js';

test('la Xiūxiān dure TRANSE_TURNS tours puis se termine', () => {
    const e = {};
    expect(startTranse(e)).toBe(true);
    expect(startTranse(e)).toBe(false);
    for (let i = 1; i < TRANSE_TURNS; i++) expect(tickTranse(e)).toBe(false);
    expect(tickTranse(e)).toBe(true);
    expect(isInTranse(e)).toBe(false);
});

test('la jauge pleine déclenche la Xiūxiān toute seule ; la vider la termine', () => {
    const e = { rage: 0 };
    addRage(e, RAGE_MAX - 1);
    expect(isInTranse(e)).toBe(false);
    addRage(e, 5);
    expect(isInTranse(e)).toBe(true);
    expect(e.transeStarted).toBe(true);
    resetRage(e);
    expect(isInTranse(e)).toBe(false);
    endTranse(e);
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
    expect(transeEffectFor('assassin').actionPoints).toBe(2);
    expect(transeEffectFor('templar').defense).toBeGreaterThan(0);
    expect(transeEffectFor('barbarian').attack).toBeGreaterThan(0);
    expect(transeEffectFor('x')).toEqual({});
});
