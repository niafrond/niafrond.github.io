// Preuve d'équilibrage : un héros SANS parure mais d'un niveau supérieur au boss peut le battre ; le niveau et les sorts de la couleur
// faible comptent ; la parure aide. Duels simulés (fixtures/duelSim.js) avec le héros de la VRAIE courbe de niveaux (≈ 10 PV par niveau),
// le boss généré par le jeu, les vrais critiques / blocages / avantage de niveau, graine fixe : résultats reproductibles.
//
// Limites assumées : plateau de match-3 modélisé (une combinaison par action, 60 % d'adresse), ni soins, ni objets, ni ultime, ni compagnons
// côté héros (il est donc plutôt prudent). Les seuils ci-dessous laissent de la marge sur les valeurs mesurées.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { buildHero, buildBoss, winRate, simulateDuel, makeRng } from './fixtures/duelSim.js';
import { MAX_LEVEL } from '../../experience.js';

const TEMPLATES = ['chiyou', 'canglong', 'wen_shen', 'huli_commun', 'zhulong_serpent', 'wu_shou', 'yingyu', 'feng_bo', 'bai_ze', 'xiangliu', 'jinwu', 'nu_gui'];
const RUNS = 60;

// Taux de victoire de chaque gabarit pour un boss de niveau `level` et un héros de niveau `heroLevel` (borné au niveau max).
function rates(level, heroLevel, { prepared = true, ward = false, runs = RUNS } = {}) {
    return TEMPLATES.map(templateId => {
        const boss = buildBoss({ templateId, level });
        const hero = buildHero({ level: Math.min(MAX_LEVEL, heroLevel), boss, prepared, wardElement: ward ? boss.preferredColor : null });
        return winRate({ hero, boss, runs }).rate;
    });
}
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;

describe('le simulateur', () => {
    test('est reproductible (même graine, même résultat) et le héros forgé suit la vraie courbe de PV', () => {
        const boss = buildBoss({ templateId: 'chiyou', level: 40 });
        const hero = buildHero({ level: 45, boss });
        const a = simulateDuel({ hero, boss, rng: makeRng(5) }), b = simulateDuel({ hero, boss, rng: makeRng(5) });
        expect(a).toEqual(b);
        expect(hero.maxHp).toBeGreaterThan(400);
        expect(hero.maxHp).toBeLessThan(1000);   // ≈ 10 PV par niveau, pas des milliers
        expect(hero.stuff.head).not.toMatch(/^ward_/);   // sans parure par défaut
    });

    test('la parure est bien portée quand on la demande', () => {
        const boss = buildBoss({ templateId: 'chiyou', level: 56 });
        const hero = buildHero({ level: 56, boss, wardElement: boss.preferredColor });
        expect(Object.values(hero.stuff).every(id => id.startsWith(`ward_${boss.preferredColor}_`))).toBe(true);
    });
});

describe('sans parure, avec un niveau supérieur, le héros peut gagner', () => {
    for (const level of [15, 30, 45, 56, 65]) {
        test(`boss de niveau ${level}, héros de niveau ${Math.min(MAX_LEVEL, level + 5)} (+5) avec les sorts de la couleur faible : chaque gabarit est battable`, () => {
            const r = rates(level, level + 5);
            expect(mean(r)).toBeGreaterThanOrEqual(0.8);
            r.forEach((rate, i) => expect({ gabarit: TEMPLATES[i], rate }).toEqual({ gabarit: TEMPLATES[i], rate: expect.any(Number) }));
            r.forEach(rate => expect(rate).toBeGreaterThanOrEqual(0.4));
        });
    }

    test('même sans sort de la couleur faible ni parure, un héros +5 gagne le plus souvent', () => {
        for (const level of [30, 45, 56]) expect(mean(rates(level, level + 5, { prepared: false }))).toBeGreaterThanOrEqual(0.5);
    });

    test('à niveau égal, sans parure, le boss reste un vrai combat (ni perdu d\'avance, ni trivial)', () => {
        for (const level of [30, 45, 56]) {
            const m = mean(rates(level, level));
            expect(m).toBeGreaterThanOrEqual(0.3);
            expect(m).toBeLessThanOrEqual(0.9);
        }
    });
});

describe('le niveau, les sorts et le stuff comptent', () => {
    test('un héros plus faible de 5 niveaux perd presque toujours', () => {
        for (const level of [30, 45, 56]) expect(mean(rates(level, level - 5, { ward: true }))).toBeLessThanOrEqual(0.25);
    });

    test('varier ses sorts compte : sans aucun sort de la couleur faible, à niveau égal, le taux de victoire s\'effondre', () => {
        for (const level of [45, 56]) {
            const withWeak = mean(rates(level, level)), without = mean(rates(level, level, { prepared: false }));
            expect(withWeak - without).toBeGreaterThanOrEqual(0.2);
        }
    });

    test('la parure de l\'élément du boss aide aux hauts niveaux et ne dessert jamais nettement', () => {
        const bare56 = mean(rates(56, 56)), ward56 = mean(rates(56, 56, { ward: true }));
        expect(ward56).toBeGreaterThanOrEqual(bare56 + 0.05);
        for (const level of [30, 45]) expect(mean(rates(level, level, { ward: true }))).toBeGreaterThanOrEqual(mean(rates(level, level)) - 0.05);
    });

    test('plus le héros a de niveaux d\'avance, mieux il gagne (monotone)', () => {
        for (const level of [30, 56]) {
            const m = [-5, 0, 5].map(d => mean(rates(level, level + d)));
            expect(m[0]).toBeLessThan(m[1]);
            expect(m[1]).toBeLessThan(m[2]);
        }
    });
});
