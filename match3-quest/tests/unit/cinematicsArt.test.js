import { readFileSync, existsSync } from 'node:fs';
import { FENGMENG_DUEL_CAPTIONS } from '../../cinematics.js';

const dir = set => new URL(`../../sprites/${set}/`, import.meta.url);

describe('tableaux Pixel Lab des cinématiques', () => {
    test.each([['prologue', 5], ['ending', 4], ['fengmeng', FENGMENG_DUEL_CAPTIONS.length]])('%s : une planche paysage et portrait par tableau', (set, count) => {
        const index = JSON.parse(readFileSync(new URL('index.json', dir(set)), 'utf8'));
        for (let n = 1; n <= count; n++) {
            for (const [o, size] of [['land', [256, 144]], ['port', [144, 256]]]) {
                const meta = index[`${n}-${o}`];
                expect(meta).toBeDefined();
                expect(meta.size).toEqual(size);
                expect(meta.frames).toBeGreaterThanOrEqual(4);
                expect(existsSync(new URL(`${n}-${o}.png`, dir(set)))).toBe(true);
            }
        }
    });

    // Les planches sont générées à la demande (tools/gen-ultimates.mjs) : on ne vérifie que celles déjà présentes.
    test('ultimates : toute planche indexée existe, en portrait 144×256', () => {
        const file = new URL('index.json', dir('ultimates'));
        if (!existsSync(file)) return;
        const index = JSON.parse(readFileSync(file, 'utf8'));
        for (const [name, meta] of Object.entries(index)) {
            expect(meta.size).toEqual([144, 256]);
            expect(meta.frames).toBeGreaterThanOrEqual(4);
            expect(existsSync(new URL(`${name}.png`, dir('ultimates')))).toBe(true);
        }
    });

    test('le duel contre Fengmeng est raconté en quatre légendes', () => {
        expect(FENGMENG_DUEL_CAPTIONS).toHaveLength(4);
        FENGMENG_DUEL_CAPTIONS.forEach(c => expect(c.length).toBeGreaterThan(40));
    });
});
