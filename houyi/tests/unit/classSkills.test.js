import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { CLASS_SKILLS, SKILLS, skillsFor, skillsTaughtBy, awardAp, skillBonus, actionSpells, getSkill } from '../../skills.js';

const hero = (extra = {}) => ({ level: 10, classes: { owned: ['assassin'], loadout: ['assassin'] }, skills: {}, ...extra });

describe('compétences de classe', () => {
    test('chaque classe a deux soutiens et une action', () => {
        const byClass = {};
        CLASS_SKILLS.forEach(s => { (byClass[s.classId] ||= []).push(s.kind); });
        expect(Object.keys(byClass)).toHaveLength(7);
        Object.values(byClass).forEach(kinds => expect(kinds.sort()).toEqual(['action', 'support', 'support']));
    });
    test('aucun spoil : seules les compétences des classes obtenues sont listées', () => {
        const ids = skillsFor(hero()).map(s => s.id);
        expect(ids.filter(id => id.startsWith('cl_assassin'))).toHaveLength(3);
        expect(ids.some(id => id.startsWith('cl_barbarian'))).toBe(false);
        expect(skillsFor(hero()).length).toBe(SKILLS.length + 3);
    });
    test("l'équipement enseigne aussi une compétence par classe donnée, sans changer les compétences communes", () => {
        const item = { id: 'arc_de_bronze', rarity: 'common' };
        const base = skillsTaughtBy(item);
        const withClasses = skillsTaughtBy(item, ['assassin', 'barbarian']);
        expect(withClasses.slice(0, base.length)).toEqual(base);
        expect(withClasses.filter(id => getSkill(id).classId)).toHaveLength(2);
    });
    test("les PA de classe ne vont qu'aux classes jouées", () => {
        const h = hero({ classes: { owned: ['assassin', 'barbarian'], loadout: ['assassin', 'barbarian'] } });
        awardAp(h, [{ id: 'arc_de_bronze', rarity: 'common' }], 500, ['assassin']);
        expect(h.skills.learned.some(id => id.startsWith('cl_assassin'))).toBe(true);
        expect(h.skills.learned.some(id => id.startsWith('cl_barbarian'))).toBe(false);
    });
    test('un soutien de classe ne joue que pour sa classe', () => {
        const h = hero({ skills: { learned: ['cl_assassin_oeil'], active: ['cl_assassin_oeil'], progress: {} } });
        h.turnClassId = 'barbarian';
        expect(skillBonus(h, 'attack')).toBe(0);
        h.turnClassId = 'assassin';
        expect(skillBonus(h, 'attack')).toBe(6);
    });
    test("une action de classe est marquée de sa classe", () => {
        const h = hero({ skills: { learned: ['cl_assassin_aube'], active: [], progress: {} } });
        expect(actionSpells(h).map(s => s.class)).toEqual(['assassin']);
    });
});
