import { readFileSync, existsSync } from 'node:fs';
import { bigScale, setSpellFxIndex, spellFxHtml, spellFxIdForTitle, spellFxDurationMs } from '../../spellFx.js';

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

    test('l\'animation tourne en boucle et sa durée (d\'un cycle) est connue', () => {
        expect(spellFxDurationMs('SOUFFLE DU DRAGON DE FEU')).toBe(Math.round(index.fireball.frames / index.fireball.fps * 1000));
        expect(spellFxDurationMs("COUP D'ÉPÉE")).toBe(0);
        const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
        expect(css).toMatch(/\.spellfx \{[^}]*infinite;/);
        expect(css).not.toMatch(/\.spellfx \{[^}]*forwards/);
    });

    test('renvoie null pour un titre inconnu (l\'annonce garde son icône)', () => {
        expect(spellFxHtml('COUP D\'ÉPÉE')).toBeNull();
        setSpellFxIndex(null);
        expect(spellFxHtml('fireball')).toBeNull();
    });

    test('les sorts très chers (paliers 4-5) s\'étalent sur le plateau, les autres gardent leur taille', () => {
        const big = Object.entries(index).find(([, e]) => e.tier === 5)[0];
        const small = Object.entries(index).find(([, e]) => e.tier === 1)[0];
        const sizeOf = h => parseInt(/--px:(\d+)px/.exec(h)[1], 10);
        expect(sizeOf(spellFxHtml(big, 480))).toBeGreaterThan(sizeOf(spellFxHtml(big)));
        expect(sizeOf(spellFxHtml(big, 480))).toBeLessThanOrEqual(480);
        expect(sizeOf(spellFxHtml(big, 480))).toBeGreaterThan(480 - index[big].size);   // palier 5 : tout le plateau
        expect(spellFxHtml(big, 480)).toContain('spellfx-big');
        expect(spellFxHtml(small, 480)).toBe(spellFxHtml(small));
        expect(bigScale(96, 480, 4, 1.5)).toBe(3);   // palier 4 : 75 % du plateau
    });
});
