import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { MAX_USABLE_CLASSES, CLASS_IDS, normalizeRoster, grantClass, toggleLoadout, hinderedClasses, usableClasses, BIOME_CLASS_LIMITS } from '../../classRoster.js';
import { playerClasses, getClassSpells } from '../../classes.js';
import { allClassSpells } from '../../spells.js';
import { QUESTS, SCREENS } from '../../story.js';

const hero = (extra = {}) => ({ class: 'assassin', level: 20, ...extra });

describe('classes obtenues en cours de route', () => {
    test('on commence avec une seule classe', () => {
        const h = hero();
        expect(normalizeRoster(h)).toEqual({ owned: ['assassin'], loadout: ['assassin'] });
    });
    test('une classe obtenue rejoint les classes de combat, jusqu\'à 4', () => {
        const h = hero();
        CLASS_IDS.slice(1).forEach(id => grantClass(h, id));
        expect(h.classes.owned).toHaveLength(CLASS_IDS.length);
        expect(h.classes.loadout).toHaveLength(MAX_USABLE_CLASSES);
        expect(grantClass(h, 'shaman')).toMatchObject({ added: false });
        expect(grantClass(h, 'inconnue').ok).toBe(false);
    });
    test('quatre classes de combat au plus ; il en reste toujours une', () => {
        const h = hero();
        CLASS_IDS.slice(1).forEach(id => grantClass(h, id));
        expect(toggleLoadout(h, 'shaman').ok).toBe(false);
        expect(toggleLoadout(h, 'barbarian').ok).toBe(true);
        expect(toggleLoadout(h, 'shaman').ok).toBe(true);
        ['templar', 'sorcerer', 'shaman'].forEach(id => toggleLoadout(h, id));
        expect(toggleLoadout(h, h.classes.loadout[0]).ok).toBe(false);
        expect(h.classes.loadout).toHaveLength(1);
        expect(toggleLoadout(hero(), 'monk').ok).toBe(false);
    });
});

describe('biomes qui entravent des classes', () => {
    test('une classe entravée reste utilisable : le biome ne l\'interdit plus', () => {
        const h = hero();
        grantClass(h, 'templar');
        expect(Object.keys(hinderedClasses(h, 'volcano'))).toEqual(['templar']);
        expect(usableClasses(h, 'volcano')).toEqual(['assassin', 'templar']);
        expect(usableClasses(h, 'paddy')).toEqual(['assassin', 'templar']);
        expect(hinderedClasses(h, 'paddy')).toEqual({});
    });
    test('toute l\'équipe de combat reste utilisable, même entièrement entravée', () => {
        const h = hero({ class: 'templar' });
        expect(usableClasses(h, 'volcano')).toEqual(normalizeRoster(h).loadout);
        const solo = hero({ class: 'assassin' });
        expect(usableClasses(solo, 'savanna')).toEqual(['assassin']);
    });
    test('l\'entraînement impose une seule classe, même bridée', () => {
        expect(usableClasses(hero(), 'volcano', 'monk')).toEqual(['monk']);
    });
    test('les biomes bridés sont des biomes du jeu et des classes connues', () => {
        Object.values(BIOME_CLASS_LIMITS).forEach(l => l.classes.forEach(c => expect(CLASS_IDS).toContain(c)));
        expect(Object.keys(BIOME_CLASS_LIMITS).length).toBeGreaterThanOrEqual(5);
    });
});

describe('contenu des classes', () => {
    test('chaque classe existe et a des sorts, dont un de niveau 1', () => {
        CLASS_IDS.forEach(id => {
            expect(playerClasses[id]).toBeTruthy();
            expect(getClassSpells(id, 99).length).toBeGreaterThanOrEqual(5);
            expect(getClassSpells(id, 1).length).toBeGreaterThanOrEqual(1);
        });
        expect(new Set(allClassSpells.map(s => s.id)).size).toBe(allClassSpells.length);
    });
    test('chaque nouvelle classe a un maître : quête et PNJ posté sur la route', () => {
        ['barbarian', 'templar', 'sorcerer', 'monk', 'alchemist', 'shaman'].forEach(cls => {
            const q = QUESTS.find(x => x.id === `q_class_${cls}`);
            expect(q).toBeTruthy();
            expect(q.reward.class).toBe(cls);
            expect(q.objectives[0].target).toBe(`trainer_${cls}`);   // le maître attend sur la route : la rencontre est l'objectif
        });
        const gated = Object.values(SCREENS).flatMap(s => s.enemies).filter(e => typeof e.showWhen === 'string' && e.showWhen.startsWith('q_class_'));
        expect(gated.length).toBeGreaterThanOrEqual(6);
    });
});
