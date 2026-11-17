import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { allWeapons } from '../../weapons.js';
import { SKILLS, visibleSkills, markSeen, skillsTaughtBy, awardAp, toggleSupport, magikolithCapacity, usedMagikoliths, skillBonus, actionSpells, normalizeSkills, teachers, apForVictory } from '../../skills.js';

const hero = (extra = {}) => ({ level: 10, equippedWeapon: { id: 'arc_de_feu', rarity: 'legendary' }, skills: {}, ...extra });

describe('compétences enseignées par l\'équipement', () => {
    test('stables, 2 pour un objet commun, 3 pour un objet rare', () => {
        expect(skillsTaughtBy({ id: 'x', rarity: 'common' })).toHaveLength(2);
        const rare = skillsTaughtBy({ id: 'arc_de_feu', rarity: 'legendary' });
        expect(rare).toHaveLength(3);
        expect(skillsTaughtBy({ id: 'arc_de_feu', rarity: 'legendary' })).toEqual(rare);
        expect(skillsTaughtBy(null)).toEqual([]);
    });
    test('les PA font apprendre ; une compétence apprise reste acquise', () => {
        const h = hero();
        const res = awardAp(h, teachers(h), 1000);
        expect(res.learned.length).toBeGreaterThan(0);
        const learned = [...h.skills.learned];
        h.equippedWeapon = null;
        awardAp(h, teachers(h), 50);
        expect(h.skills.learned).toEqual(learned);
    });
    test('progression partielle', () => {
        const h = hero();
        awardAp(h, teachers(h), 1);
        expect(Object.values(h.skills.progress).every(n => n === 1)).toBe(true);
        expect(apForVictory(10)).toBe(11);
    });
});

describe('Fulu', () => {
    const soutien = SKILLS.filter(s => s.kind === 'support');
    test('une compétence non apprise ne s\'active pas', () => {
        expect(toggleSupport(hero(), soutien[0].id).ok).toBe(false);
    });
    test('la capacité limite les compétences actives', () => {
        const h = hero({ level: 1 });   // capacité 4
        h.skills = { learned: soutien.map(s => s.id) };
        normalizeSkills(h);
        expect(magikolithCapacity(h)).toBe(4);
        let refused = false;
        soutien.forEach(s => { if (!toggleSupport(h, s.id).ok) refused = true; });
        expect(refused).toBe(true);
        expect(usedMagikoliths(h)).toBeLessThanOrEqual(4);
        const first = h.skills.active[0];
        expect(toggleSupport(h, first).active).toBe(false);
    });
    test('les bonus ne comptent que les compétences actives', () => {
        const h = hero({ level: 30 });
        h.skills = { learned: ['garde_de_jade'], active: [] };
        normalizeSkills(h);
        expect(skillBonus(h, 'defense')).toBe(0);
        toggleSupport(h, 'garde_de_jade');
        expect(skillBonus(h, 'defense')).toBe(4);
    });
});

test('les compétences d\'action apprises donnent des commandes de combat', () => {
    const h = hero();
    h.skills = { learned: ['tir_perforant', 'lotus_de_soin', 'garde_de_jade'] };
    const spells = actionSpells(h);
    expect(spells.map(s => s.id)).toEqual(['skill_tir_perforant', 'skill_lotus_de_soin']);
    expect(spells[0].dmg).toBeGreaterThan(0);
    expect(spells[1].heal).toBeGreaterThan(0);
});

describe('variété et visibilité des compétences', () => {
    test('le catalogue est varié et les armes enseignent des compétences différentes', () => {
        expect(SKILLS.length).toBeGreaterThanOrEqual(30);
        const sets = new Set(allWeapons.map(w => skillsTaughtBy(w).join('|')));
        expect(sets.size).toBeGreaterThan(allWeapons.length * 0.8);
        const covered = new Set(allWeapons.flatMap(w => skillsTaughtBy(w)));
        expect(covered.size).toBeGreaterThan(SKILLS.length * 0.55);
    });
    test('une compétence jamais vue reste cachée ; celle que l\'arme enseigne devient visible, puis le reste visible', () => {
        const h = hero({ equippedWeapon: null });
        expect(visibleSkills(h)).toEqual([]);
        const taught = skillsTaughtBy({ id: 'arc_de_bronze', rarity: 'common' });
        expect(visibleSkills(h, taught).map(s => s.id).sort()).toEqual([...taught].sort());
        markSeen(h, taught);
        expect(visibleSkills(h).map(s => s.id).sort()).toEqual([...taught].sort());
    });
});
