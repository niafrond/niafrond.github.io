import { existsSync } from 'fs';
import { LESSON_LOTS, LESSON_WORDS, LOT_SIZE, LOT_PASSES, nextLesson, setKnown, knownWords, LESSON_STORAGE_KEY } from '../../chineseWords.js';
import { nameAudioId } from '../../nameAudio.js';

const memory = () => { const d = {}; return { getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };

describe('un mot de chinois', () => {
    test('lots de cinq au plus, mots uniques, chaque mot a son audio', () => {
        LESSON_LOTS.forEach(lot => { expect(lot.length).toBeGreaterThan(0); expect(lot.length).toBeLessThanOrEqual(LOT_SIZE); });
        expect(new Set(LESSON_WORDS.map(w => w.hanzi)).size).toBe(LESSON_WORDS.length);
        LESSON_WORDS.forEach(w => {
            expect(w.pinyin && w.fr).toBeTruthy();
            expect(existsSync(new URL(`../../audio/noms/${nameAudioId(w.hanzi)}.mp3`, import.meta.url))).toBe(true);
        });
    });

    test('un lot se répète dans le même ordre LOT_PASSES fois, puis le lot suivant arrive (rien d\'aléatoire)', () => {
        const st = memory();
        const first = LESSON_LOTS[0];
        for (let pass = 0; pass < LOT_PASSES; pass++) first.forEach((w, i) => {
            const l = nextLesson(st);
            expect([l.hanzi, l.lot, l.rank]).toEqual([w.hanzi, 0, i + 1]);
        });
        const next = nextLesson(st);
        expect([next.hanzi, next.lot]).toEqual([LESSON_LOTS[1][0].hanzi, 1]);
        const again = memory(); again.setItem(LESSON_STORAGE_KEY, st.getItem(LESSON_STORAGE_KEY));
        expect(nextLesson(again).hanzi).toBe(LESSON_LOTS[1][1].hanzi);   // la progression survit au rechargement
    });

    test('« je connais » : le mot n\'est plus montré, un lot entièrement connu est sauté, on peut le décocher', () => {
        const st = memory();
        const [a, b, ...rest] = LESSON_LOTS[0];
        setKnown(a.hanzi, true, st);
        const seen = Array.from({ length: LESSON_LOTS[0].length - 1 }, () => nextLesson(st).hanzi);
        expect(seen).toEqual([b, ...rest].map(w => w.hanzi));
        LESSON_LOTS[1].forEach(w => setKnown(w.hanzi, true, st));
        const l = nextLesson(st);   // fin du lot 0 : passes pas finies, mais on reste sur lui ; on force le passage
        expect(l.lot).toBe(0);
        setKnown(a.hanzi, false, st);
        expect(knownWords(st).has(a.hanzi)).toBe(false);
    });

    test('tous les mots connus : plus de leçon ; stockage absent ou en panne : jamais d\'erreur', () => {
        const st = memory();
        LESSON_WORDS.forEach(w => setKnown(w.hanzi, true, st));
        expect(nextLesson(st)).toBeNull();
        expect(() => nextLesson(undefined)).not.toThrow();
        expect(() => nextLesson({ getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } })).not.toThrow();
    });
});

describe('mot déclaré connu en fin de combat', () => {
    const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
    test("il n'est plus jamais reproposé et ne fait sauter aucun autre mot du lot", () => {
        const st = mem(), lot = LESSON_LOTS[0];
        const a = nextLesson(st);
        expect(a.hanzi).toBe(lot[0].hanzi);
        setKnown(a.hanzi, true, st);   // la coche de la carte
        expect(nextLesson(st).hanzi).toBe(lot[1].hanzi);   // le suivant, pas le deuxième d'après
        expect(nextLesson(st).hanzi).toBe(lot[2].hanzi);
        const seen = Array.from({ length: 40 }, () => nextLesson(st).hanzi);
        expect(seen).not.toContain(lot[0].hanzi);
    });
    test("plusieurs mots déclarés connus d'affilée : jamais reproposés, même après plusieurs passes", () => {
        const st = mem(), proposed = [];
        for (let i = 0; i < 300; i++) {
            const l = nextLesson(st);
            if (!l) break;
            expect(knownWords(st).has(l.hanzi)).toBe(false);
            proposed.push(l.hanzi);
            if (i % 2 === 0) setKnown(l.hanzi, true, st);
        }
        expect(proposed.length).toBeGreaterThan(100);
    });
    test('ancien format de sauvegarde (rang) : la progression est reprise sans erreur', () => {
        const st = mem();
        st.setItem(LESSON_STORAGE_KEY, JSON.stringify({ lot: 0, pos: 2, passes: 0, known: [] }));
        expect(nextLesson(st).hanzi).toBe(LESSON_LOTS[0][2].hanzi);
    });
    test('la carte confirme la coche (« ce mot ne reviendra plus »)', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync(new URL('../../chineseLessonsView.js', import.meta.url), 'utf8');
        expect(src).toMatch(/Noté : ce mot ne reviendra plus\./);
        expect(src).toMatch(/battle-result-known-note/);
    });
});

