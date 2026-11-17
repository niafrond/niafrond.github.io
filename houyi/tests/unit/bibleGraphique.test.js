import { existsSync } from 'fs';
import { MOTIFS, REGLES_GLOBALES, bibleFor, biblePrompt, bibleText } from '../../tools/bible-graphique.mjs';
import { BESTIARY } from '../../tools/bestiary-data.mjs';

describe('bible graphique du bestiaire', () => {
    test('chaque motif est complet et ses images de référence existent en local', () => {
        expect(REGLES_GLOBALES.length).toBeGreaterThan(3);
        for (const m of MOTIFS) {
            expect(m.traits && m.prompt && m.source && m.mots.length).toBeTruthy();
            for (const img of m.images) expect(existsSync(new URL('../../docs/bible-graphique/' + img, import.meta.url))).toBe(true);
        }
    });
    test('les créatures emblématiques reçoivent le bon motif', () => {
        const by = id => BESTIARY.find(c => c[0] === id);
        expect(bibleFor(by('qilin')).map(m => m.id)).toContain('qilin');
        expect(biblePrompt(by('qilin'))).toMatch(/qilin/i);
    });
    test('la majorité du bestiaire est couverte et le texte LLM liste les motifs', () => {
        expect(BESTIARY.filter(c => bibleFor(c).length).length).toBeGreaterThan(BESTIARY.length * 0.6);
        const t = bibleText();
        for (const m of MOTIFS) expect(t).toContain(m.nom);
    });
});
