import { readFileSync, existsSync } from 'node:fs';
import { setSpellFxIndex, spellFxHtml, spellFxIdForTitle, spellFxDurationMs } from '../../spellFx.js';

const index = JSON.parse(readFileSync(new URL('../../sprites/spellfx/index.json', import.meta.url), 'utf8'));
const spells = JSON.parse(readFileSync(new URL('../../spells.json', import.meta.url), 'utf8'));

describe('spellFx', () => {
    beforeEach(() => setSpellFxIndex(index));

    test('chaque entrée a sa planche et un nom de sort du catalogue', () => {
        const names = new Set(Object.values(spells).flat().filter(s => s && s.id).map(s => s.name));
        for (const [id, e] of Object.entries(index)) {
            expect(existsSync(new URL(`../../sprites/spellfx/${id}.png`, import.meta.url))).toBe(true);
            expect(names.has(e.name)).toBe(true);
            expect(e.frames).toBeGreaterThanOrEqual(5);
        }
    });

    test('les sorts chers ont une animation plus grande et plus longue que les sorts bon marché', () => {
        expect(index.heavenTribulationEnd.size).toBeGreaterThan(index.fireball.size);
        expect(index.heavenTribulationEnd.frames).toBeGreaterThan(index.fireball.frames);
    });

    test('retrouve le sort par le titre d\'annonce, sans tenir compte de la casse', () => {
        expect(spellFxIdForTitle('SOUFFLE DU DRAGON DE FEU')).toBe('fireball');
        expect(spellFxHtml('SOUFFLE DU DRAGON DE FEU')).toContain('data-spell="fireball"');
        expect(spellFxHtml('fireball')).toContain('spellfx');
    });

    test('l\'animation est jouée une fois et sa durée est connue', () => {
        expect(spellFxDurationMs('SOUFFLE DU DRAGON DE FEU')).toBe(Math.round(index.fireball.frames / index.fireball.fps * 1000));
        expect(spellFxDurationMs("COUP D'ÉPÉE")).toBe(0);
        const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
        expect(css).toMatch(/\.spellfx \{[^}]*forwards;/);
        expect(css).not.toMatch(/\.spellfx \{[^}]*infinite/);
    });

    test('renvoie null pour un titre inconnu (l\'annonce garde son icône)', () => {
        expect(spellFxHtml('COUP D\'ÉPÉE')).toBeNull();
        setSpellFxIndex(null);
        expect(spellFxHtml('fireball')).toBeNull();
    });
});
