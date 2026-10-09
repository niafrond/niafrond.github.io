import './fixtures/playerForge.js';   // simule le chargement XHR des catalogues
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    MANA_COLORS, elementOf, elementName, weaknessOf, applyWeaknessToResistances, WEAKNESS_OF_COLOR
} from '../../elements.js';
import { colorName, weaknessLabel, buildPrep } from '../../terrain.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(dir, '../../enemies.catalog.json'), 'utf8'));

describe('éléments de mana', () => {
    test('chaque couleur a un élément et un libellé français', () => {
        MANA_COLORS.forEach(c => {
            expect(typeof elementOf(c)).toBe('string');
            expect(elementName(c)).toMatch(/^[A-Z]/);
        });
        expect(elementName('red')).toBe('Feu');
        expect(elementName('blue')).toBe('Eau');
        expect(elementName('yellow')).toBe('Air');
        expect(elementName('green')).toBe('Terre');
        expect(elementOf('RED')).toBe('fire');
        expect(elementOf('pink')).toBeNull();
        expect(elementName('pink')).toBeNull();
    });

    test('chaque couleur a une faiblesse valide, jamais elle-même', () => {
        MANA_COLORS.forEach(c => {
            expect(MANA_COLORS).toContain(weaknessOf(c));
            expect(weaknessOf(c)).not.toBe(c);
        });
        expect(weaknessOf('unknown')).toBeNull();
    });

    test('feu -> eau, et les 4 éléments classiques forment un cycle fermé', () => {
        expect(weaknessOf('red')).toBe('blue');
        let c = 'red';
        const seen = [];
        for (let i = 0; i < 4; i++) { seen.push(c); c = weaknessOf(c); }
        expect(c).toBe('red');
        expect(new Set(seen).size).toBe(4);
        expect(seen).not.toContain('purple');
        expect(Object.keys(WEAKNESS_OF_COLOR).sort()).toEqual([...MANA_COLORS].sort());
    });

    test('applyWeaknessToResistances rend la couleur faible strictement la plus basse', () => {
        const r = applyWeaknessToResistances({ red: 0.3, blue: 0.2, green: 0.1, yellow: 0.1, purple: 0.2 }, 'blue');
        expect(r.blue).toBeLessThan(0.1);
        expect(r.red).toBe(0.3);
        const ok = applyWeaknessToResistances({ red: 0.3, blue: 0.01, green: 0.1, yellow: 0.1, purple: 0.2 }, 'blue');
        expect(ok.blue).toBe(0.01);
    });

    test('libellés de terrain mentionnent l\'élément', () => {
        expect(weaknessLabel('blue')).toBe('Eau (bleu)');
        expect(colorName('blue')).toBe('bleu');
        const prep = buildPrep({ observed: true, weakColor: 'blue' });
        expect(prep.lines[0]).toContain('Faiblesse repérée : Eau (bleu)');
        expect(buildPrep({ onOutlook: true, weakColor: 'red' }).lines[0]).toContain('Feu (rouge)');
    });
});

describe('faiblesses des ennemis du catalogue', () => {
    test('weakColor valide, conforme à la table, et résistance la plus basse', async () => {
        const { weakColorOfTemplate } = await import("../../enemies.js");
        expect(catalog.length).toBeGreaterThan(0);
        catalog.forEach(t => {
            const pref = (t.spellProfile?.preferredColors?.[0] || 'red').toLowerCase();
            const weak = weakColorOfTemplate(t.id);
            expect(weak).toBe(weaknessOf(pref));
            expect(MANA_COLORS).toContain(weak);
        });
    });

    test('les résistances d\'un ennemi généré : la couleur faible est la plus basse', async () => {
        const { generateEnemyChoices } = await import('../../enemies.js');
        let checked = 0;
        for (let i = 0; i < 40; i++) {
            generateEnemyChoices(20, 4).forEach(e => {
                if (!e.weakColor) return;
                MANA_COLORS.filter(c => c !== e.weakColor).forEach(c => expect(e.resistances[e.weakColor]).toBeLessThan(e.resistances[c]));
                expect(e.weakColor).toBe(weaknessOf(e.preferredColor));
                checked++;
            });
        }
        expect(checked).toBeGreaterThan(0);
    });
});
