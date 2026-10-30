// Sorts ultimes : jauge de rage chargée par les dégâts subis, 2 ultimes par classe + 4 ultimes de légende (par quête, toutes classes), hors limite des 4 sorts.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import {
    RAGE_MAX, rageToManaAmount, rageToDamageAmount, getUltimatesForClass, getUltimateById, rageFromDamage, addRage, resetRage, isRageFull,
    registerUltimateCinematic, playUltimateCinematic,
    isQuestUltimate, getQuestUltimates, getSelectableUltimates, getEquippedUltimate, getLockedQuestUltimates,
    unlockUltimate, normalizeUnlockedUltimates, isUltimateUnlocked,
    ultimateCostEntries, addUltimateMana, canCastUltimateMana, spendUltimateMana, resetUltimateMana
} from '../../ultimates.js';
import { ultimateSpells, getSpellsByClass, barbarianSpells, sorcererSpells, assassinSpells, templarSpells } from '../../spells.js';
import { playerClasses } from '../../classes.js';

describe('catalogue', () => {
    test('deux ultimes différents par classe', () => {
        for (const cls of Object.keys(playerClasses)) {
            const list = getUltimatesForClass(cls);
            expect(list).toHaveLength(2);
            expect(new Set(list.map(s => s.id)).size).toBe(2);
        }
        expect(ultimateSpells).toHaveLength(12);
        expect(ultimateSpells.filter(sp => !isQuestUltimate(sp))).toHaveLength(8);
    });
    test('très gourmands en qì et très puissants', () => {
        for (const sp of ultimateSpells) {
            const total = Object.values(sp.cost).reduce((a, b) => a + b, 0);
            expect(total).toBeGreaterThanOrEqual(50);
            expect(sp.dmg).toBeGreaterThanOrEqual(100);
            expect(sp.cinematic).toBeTruthy();
        }
    });
    test('hors des sorts de classe équipables', () => {
        const ids = new Set(ultimateSpells.map(s => s.id));
        for (const cls of Object.keys(playerClasses)) {
            expect(getSpellsByClass(cls, 99).some(s => ids.has(s.id))).toBe(false);
        }
        expect(getUltimateById('ultimateSkyWolf').class).toBe('barbarian');
    });
});

describe('jauge de rage', () => {
    test('gain proportionnel aux PV perdus, au moins 1', () => {
        expect(rageFromDamage(0, 100)).toBe(0);
        expect(rageFromDamage(1, 1000)).toBe(1);
        expect(rageFromDamage(20, 100)).toBe(30);
    });
    test('plafonnée, pleine à RAGE_MAX, remise à zéro', () => {
        const hero = {};
        expect(addRage(hero, 60)).toBe(60);
        expect(isRageFull(hero)).toBe(false);
        expect(addRage(hero, 100)).toBe(RAGE_MAX - 60);
        expect(isRageFull(hero)).toBe(true);
        resetRage(hero);
        expect(hero.rage).toBe(0);
    });
});

describe('cinématique (terrain préparé)', () => {
    test('sans scène enregistrée, résolue immédiatement ; sinon la scène est jouée', async () => {
        await expect(playUltimateCinematic({ cinematic: 'inconnue' })).resolves.toBeUndefined();
        const played = [];
        registerUltimateCinematic('test-scene', async sp => { played.push(sp.id); });
        await playUltimateCinematic({ id: 'x', cinematic: 'test-scene' });
        expect(played).toEqual(['x']);
    });
});

describe('ultimes de légende (gagnés par quête, toutes classes)', () => {
    const legends = ultimateSpells.filter(isQuestUltimate);
    const hero = (cls, level, unlocked = []) => ({ class: cls, level, unlockedUltimates: unlocked });

    test('quatre ultimes, sans classe, chacun lié à une quête et à un indice affiché', () => {
        expect(getQuestUltimates().map(s => s.id)).toEqual(['ultimateVermilionBird', 'ultimateBlackTortoise', 'ultimateWhiteTiger', 'ultimateAzureDragon']);
        for (const sp of legends) {
            expect(sp.class).toBeUndefined();
            expect(sp.unlock.quest).toMatch(/^sq_legend_/);
            expect(sp.unlock.hint).toContain('Quête');
            expect(sp.legend).toBeTruthy();
        }
        expect(new Set(legends.map(s => s.cinematic)).size).toBe(4);
        expect(new Set(legends.map(s => s.unlock.quest)).size).toBe(4);
        expect(legends.map(s => s.minLevel)).toEqual([...legends.map(s => s.minLevel)].sort((a, b) => a - b));   // du Sud au dernier Gardien : niveaux croissants
    });

    test('jamais proposés comme ultimes de classe', () => {
        for (const cls of Object.keys(playerClasses)) getUltimatesForClass(cls).forEach(sp => expect(isQuestUltimate(sp)).toBe(false));
    });

    test("verrouillés tant que la quête n'est pas faite : aucune classe ne les voit", () => {
        for (const cls of Object.keys(playerClasses)) {
            const ids = getSelectableUltimates(hero(cls, 99)).map(s => s.id);
            legends.forEach(sp => expect(ids).not.toContain(sp.id));
            expect(getLockedQuestUltimates(hero(cls, 99))).toHaveLength(4);
        }
    });

    test('débloqués, ils sont disponibles pour TOUTES les classes, dès que le niveau requis est atteint', () => {
        const tiger = getUltimateById('ultimateWhiteTiger');
        for (const cls of Object.keys(playerClasses)) {
            expect(getSelectableUltimates(hero(cls, tiger.minLevel, [tiger.id])).map(s => s.id)).toContain(tiger.id);
            expect(getSelectableUltimates(hero(cls, tiger.minLevel - 1, [tiger.id])).map(s => s.id)).not.toContain(tiger.id);   // débloqué mais trop faible
        }
    });

    test("un ultime de légende débloqué s'ajoute à ceux de la classe sans les remplacer", () => {
        const ids = getSelectableUltimates(hero('sorcerer', 99, ['ultimateAzureDragon'])).map(s => s.id);
        expect(ids).toEqual(['ultimateFiveElements', 'ultimateHeavenlyThunder', 'ultimateAzureDragon']);
    });

    test("choisi, il est l'ultime équipé ; non débloqué, le choix retombe sur un ultime de classe", () => {
        const withIt = { ...hero('barbarian', 99, ['ultimateBlackTortoise']), equippedUltimate: 'ultimateBlackTortoise' };
        expect(getEquippedUltimate(withIt).id).toBe('ultimateBlackTortoise');
        const without = { ...hero('barbarian', 99), equippedUltimate: 'ultimateBlackTortoise' };
        expect(getEquippedUltimate(without).id).toBe('ultimateThousandRiders');
    });

    test("unlockUltimate : une seule fois, refuse l'inconnu et les ultimes de classe", () => {
        const h = hero('templar', 1);
        expect(unlockUltimate(h, 'ultimateVermilionBird')).toBe(true);
        expect(unlockUltimate(h, 'ultimateVermilionBird')).toBe(false);
        expect(unlockUltimate(h, 'ultimateSkyWolf')).toBe(false);
        expect(unlockUltimate(h, 'nimporte-quoi')).toBe(false);
        expect(unlockUltimate(null, 'ultimateVermilionBird')).toBe(false);
        expect(h.unlockedUltimates).toEqual(['ultimateVermilionBird']);
        expect(isUltimateUnlocked(h, getUltimateById('ultimateVermilionBird'))).toBe(true);
        expect(isUltimateUnlocked(h, getUltimateById('ultimateWhiteTiger'))).toBe(false);
    });

    test('normalizeUnlockedUltimates : sauvegardes anciennes, modifiées ou corrompues', () => {
        expect(normalizeUnlockedUltimates(undefined)).toEqual([]);
        expect(normalizeUnlockedUltimates('ultimateWhiteTiger')).toEqual([]);
        expect(normalizeUnlockedUltimates(['ultimateWhiteTiger', 'ultimateWhiteTiger', 'ultimateSkyWolf', 42, null, 'x', 'ultimateAzureDragon']))
            .toEqual(['ultimateWhiteTiger', 'ultimateAzureDragon']);
    });

    test('menu secret : tous les ultimes, légendes comprises', () => {
        expect(getSelectableUltimates({ class: 'sorcerer', level: 1, cheatAllUltimates: true })).toHaveLength(12);
    });

    test('qì collecté : coût ×1,5 (arrondi au-dessus), même si le qì a été dépensé, surplus conservé', () => {
        const spell = { cost: { red: 25, blue: 25, green: 25 } };
        expect(ultimateCostEntries(spell)).toEqual([['red', 38], ['blue', 38], ['green', 38]]);
        const hero = { mana: { red: 0, blue: 0, green: 0 } };
        ['red', 'blue', 'green'].forEach(c => addUltimateMana(hero, c, 30));
        expect(canCastUltimateMana(hero, spell)).toBe(false);
        ['red', 'blue', 'green'].forEach(c => addUltimateMana(hero, c, 10));
        expect(canCastUltimateMana(hero, spell)).toBe(true);
        spendUltimateMana(hero, spell);
        expect(hero.ultimateMana).toEqual({ red: 2, blue: 2, green: 2 });
        resetUltimateMana(hero);
        expect(canCastUltimateMana(hero, spell)).toBe(false);
    });
});

describe('sorts de rage (gain, conversion en qì, conversion en dégâts)', () => {
    test('le catalogue barbare contient les trois effets', () => {
        const effects = barbarianSpells.map(spell => spell.effect);
        expect(effects).toEqual(expect.arrayContaining(['rageGain', 'rageToMana', 'rageToDamage']));
    });

    test('conversion de la rage en qì par couleur', () => {
        expect(rageToManaAmount(100, 0.1)).toBe(10);
        expect(rageToManaAmount(9, 0.1)).toBe(0);
        expect(rageToManaAmount(undefined, 0.1)).toBe(0);
    });

    test('conversion de la rage en dégâts', () => {
        expect(rageToDamageAmount(100, 3)).toBe(300);
        expect(rageToDamageAmount(0, 3)).toBe(0);
    });

    test('chaque classe a, pour chaque effet de rage, un sort tous les 10 niveaux de 20 à 70, de plus en plus fort', () => {
        const field = { rageGain: 'rageGain', rageToMana: 'manaPerRage', rageToDamage: 'dmgPerRage' };
        const byClass = { barbarian: barbarianSpells, sorcerer: sorcererSpells, assassin: assassinSpells, templar: templarSpells };
        for(const [className, list] of Object.entries(byClass)) {
            for(const [effect, key] of Object.entries(field)) {
                const tiers = list.filter(spell => spell.effect === effect).sort((a, b) => a.minLevel - b.minLevel);
                for(const level of [20, 30, 40, 50, 60, 70]) expect(tiers.some(spell => spell.minLevel === level)).toBe(true);
                tiers.forEach((spell, i) => { if(i > 0) expect(spell[key]).toBeGreaterThan(tiers[i - 1][key]); });
                expect(tiers.length).toBeGreaterThan(0);
                expect(getSpellsByClass(className, 70).filter(spell => spell.effect === effect)).toHaveLength(tiers.length);
            }
        }
    });
});
