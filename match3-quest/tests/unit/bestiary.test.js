import { readFileSync } from 'fs';
import { BESTIARY_LORE, BESTIARY_SOURCE, SOURCE_LABELS, bestiaryEntries, bestiaryEntry, weakColorOf, strongColorOf } from '../../bestiary.js';
import { weaknessOf } from '../../elements.js';
import { createSession, recordBestiary, startNewGamePlus } from '../../exploration.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));

describe('Bestiaire du carnet', () => {
    test('chaque gabarit du catalogue a sa notice mythologique, sans notice orpheline', () => {
        const ids = catalog.map(t => t.id);
        expect(ids.filter(id => !BESTIARY_LORE[id])).toEqual([]);
        expect(Object.keys(BESTIARY_LORE).filter(id => !ids.includes(id))).toEqual([]);
        Object.values(BESTIARY_LORE).forEach(text => expect(text.length).toBeGreaterThan(40));
        // provenance : texte classique, folklore ou adaptation du jeu, pour chaque créature
        expect(ids.filter(id => !SOURCE_LABELS[BESTIARY_SOURCE[id]])).toEqual([]);
        expect(Object.keys(BESTIARY_SOURCE).filter(id => !ids.includes(id))).toEqual([]);
    });

    test('la faiblesse affichée est celle du combat, la force est la résistance la plus haute', () => {
        catalog.forEach(t => {
            expect(weakColorOf(t)).toBe(weaknessOf(t.spellProfile.preferredColors[0]));   // même règle que enemies.js weakColorOfTemplate
            const res = t.resistanceProfile;
            expect(res[strongColorOf(t)]).toBe(Math.max(...Object.values(res)));
        });
        const e = bestiaryEntry(catalog.find(t => t.id === 'chilong'));
        expect(e).toMatchObject({ strongColor: 'red', strongElement: 'Feu', weakColor: 'blue', weakElement: 'Eau' });
        expect(e.lore).toMatch(/Chilong/);
    });

    test('seules les créatures croisées apparaissent, triées, avec le compteur', () => {
        const { entries, known, total } = bestiaryEntries(catalog, ['qilin', 'bashe', 'inconnu']);
        expect(entries.map(e => e.id)).toEqual(['bashe', 'qilin']);
        expect(known).toBe(2);
        expect(total).toBe(catalog.length);
    });

    test('combattre ou observer inscrit la créature, une seule fois ; le bestiaire survit à la NG+', () => {
        const s = createSession({});
        expect(s.data.bestiary).toEqual([]);
        expect(recordBestiary(s, 'nian')).toBe(true);
        expect(recordBestiary(s, 'nian')).toBe(false);
        s.data.ended = true;
        startNewGamePlus(s);
        expect(s.data.bestiary).toEqual(['nian']);
        expect(createSession({ bestiary: ['nian', 'nian', 3] }).data.bestiary).toEqual(['nian']);
    });

    test('le carnet a un onglet Bestiaire et le combat inscrit la créature', () => {
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toMatch(/tab\('bestiary'/);
        expect(view).toMatch(/X\.recordBestiary\(session, enc\.templateId\)/);
        const save = readFileSync(new URL('../../saveManager.js', import.meta.url), 'utf8');
        expect(save).toMatch(/bestiary: ex\.bestiary/);
    });
});
