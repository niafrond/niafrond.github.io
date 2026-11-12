// Budget des statistiques : Attaque, Défense et qì plafonnent à 100 au niveau 70 sans jamais le dépasser avant (équipement compris).
import { describe, test, expect } from '@jest/globals';
import { MAX_LEVEL } from '../../experience.js';
import { STAT_MAX, maxStatAtLevel, maxGearBonus, tradeoffPieces, tradeoffValue } from '../../statBudget.js';
import { growthExtras } from '../../progression.js';
import { allWeapons } from '../../weapons.js';
import { allStuff } from '../../stuff.js';
import { allItems, applyArtifactEffects, normalizeRelics, relicSlots, wornRelics, equipRelic, unequipRelic } from '../../items.js';
import { rawAttack, rawDefense } from '../../combatStats.js';

describe('budget des statistiques (100 au niveau max)', () => {
    for (const stat of ['atk', 'def', 'qi']) {
        test(`${stat} : exactement ${STAT_MAX} au niveau ${MAX_LEVEL} pour un build spécialisé`, () => {
            expect(maxStatAtLevel(stat, MAX_LEVEL)).toBe(STAT_MAX);
        });

        test(`${stat} : ne dépasse jamais ${STAT_MAX}, croît avec le niveau et reste loin du plafond au niveau 20`, () => {
            let previous = 0;
            for (let level = 1; level <= MAX_LEVEL; level++) {
                const value = maxStatAtLevel(stat, level);
                expect(value).toBeLessThanOrEqual(STAT_MAX);
                expect(value).toBeGreaterThanOrEqual(previous);
                previous = value;
            }
            expect(maxStatAtLevel(stat, 20)).toBeLessThanOrEqual(70);   // l'équipement s'ajoute aux points : pas de plafond atteint à mi-parcours
            expect(maxStatAtLevel(stat, 20)).toBeLessThan(maxStatAtLevel(stat, 50));
        });
    }

    test('plus de croissance innée d\'attaque : elle ferait dépasser 100 bien avant le niveau 70', () => {
        expect(growthExtras(1, MAX_LEVEL).attack).toBe(0);
    });

    test('l\'équipement ne représente qu\'une part du budget (au plus 31 pour l\'attaque et la défense, 27 pour le qì)', () => {
        expect(maxGearBonus('atk', MAX_LEVEL)).toBe(16);
        expect(maxGearBonus('def', MAX_LEVEL)).toBe(31);
        expect(maxGearBonus('qi', MAX_LEVEL)).toBe(27);
    });

    test('aucune pièce normale ne dépasse un plafond individuel (un objet très fort doit être un objet à compromis)', () => {
        const pieces = [...allWeapons, ...allStuff, ...allItems.filter(i => i.type === 'shield')].filter(p => !tradeoffPieces().includes(p));
        pieces.forEach(p => {
            expect(p.atkBonus || 0).toBeLessThanOrEqual(6);
            expect((p.defBonus || 0) + (p.type === 'shield' ? p.defense || 0 : 0)).toBeLessThanOrEqual(16);
        });
    });

    test('objets à compromis : ils en valent la peine (gain ≥ 1,5 × coût) malgré un coût important (coût ≥ la moitié du gain)', () => {
        const pieces = tradeoffPieces();
        expect(pieces.length).toBeGreaterThanOrEqual(5);
        pieces.forEach(p => {
            const { gain, cost } = tradeoffValue(p);
            expect(cost).toBeGreaterThanOrEqual(gain / 2);
            expect(gain).toBeGreaterThanOrEqual(1.5 * cost);
        });
    });

    test('un objet à compromis donne bien plus qu\'une pièce normale de son emplacement (sinon personne ne le porterait)', () => {
        const normal = allStuff.filter(p => !tradeoffPieces().includes(p) && !p.quest);
        tradeoffPieces().filter(p => p.type === 'stuff').forEach(p => {
            const peers = normal.filter(q => q.slot === p.slot && q.minLevel <= p.minLevel + 10);
            const best = Math.max(0, ...peers.map(q => Math.max(q.atkBonus || 0, q.defBonus || 0, q.manaMax ? Math.max(...Object.values(q.manaMax)) : 0)));
            expect(tradeoffValue(p).gain).toBeGreaterThanOrEqual(2 * best);
        });
    });

    test('un compromis (Atk haute, Déf négative) s\'additionne algébriquement et ne descend jamais sous 0', () => {
        const hero = { attack: 10, defense: 3, equippedWeapon: { atkBonus: 12, defBonus: -8 } };
        expect(rawAttack(hero)).toBe(22);
        expect(rawDefense(hero)).toBe(0);
    });
});

describe('reliques : emplacements limités, une seule par identifiant', () => {
    const relic = (id, eff = { permDefense: 8 }) => ({ id, name: id, type: 'artifact', effect: eff, applied: false });
    const hero = (level, inventory) => ({ level, defense: 0, maxHp: 10, hp: 10, maxMana: 50, attack: 0, inventory });

    test('3 emplacements au niveau 1, 10 au niveau 70, croissance régulière', () => {
        expect(relicSlots(1)).toBe(3);
        expect(relicSlots(MAX_LEVEL)).toBe(10);
        for (let l = 2; l <= MAX_LEVEL; l++) expect(relicSlots(l) - relicSlots(l - 1)).toBeLessThanOrEqual(1);
    });
    test('un doublon n\'ajoute aucun bonus', () => {
        const h = hero(70, [relic('a'), relic('a'), relic('a')]);
        applyArtifactEffects(h);
        expect(h.defense).toBe(8);
        expect(wornRelics(h)).toHaveLength(1);
    });
    test('au-delà des emplacements, les reliques restent dans le sac ; un niveau de plus en libère', () => {
        const h = hero(1, ['a', 'b', 'c', 'd'].map(id => relic(id, { permDefense: 1 })));
        applyArtifactEffects(h);
        expect(wornRelics(h)).toHaveLength(3);
        expect(h.defense).toBe(3);
        h.level = relicSlots(1) === 3 ? 12 : 12;
        applyArtifactEffects(h);
        expect(wornRelics(h)).toHaveLength(Math.min(4, relicSlots(12)));
    });
    test('retirer une relique retire son effet et elle n\'est pas remise toute seule', () => {
        const h = hero(70, [relic('a')]);
        applyArtifactEffects(h);
        unequipRelic(h, h.inventory[0]);
        expect(h.defense).toBe(0);
        applyArtifactEffects(h);
        expect(h.defense).toBe(0);
        expect(equipRelic(h, h.inventory[0]).ok).toBe(true);
        expect(h.defense).toBe(8);
    });
    test('ancienne sauvegarde : doublons et excédent retirés', () => {
        const h = hero(1, ['a', 'a', 'b', 'c', 'd', 'e'].map(id => ({ ...relic(id, { permDefense: 1 }), applied: true })));
        h.defense = 6;
        expect(normalizeRelics(h)).toBe(3);
        expect(h.defense).toBe(3);
        expect(wornRelics(h)).toHaveLength(3);
        expect(normalizeRelics(h)).toBe(0);
    });
});
