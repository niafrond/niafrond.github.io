// Effets de plateau des sorts de flèches d'action : couverture des 4 sorts et robustesse (jamais bloquant, rien sans DOM).
import { describe, test, expect, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { playTileFx, TILE_FX } from '../../spellTileFx.js';

const gems = readFileSync(new URL('../../classSpellsActionGems.js', import.meta.url), 'utf8');

afterEach(() => { delete globalThis.document; delete globalThis.Element; });

function fakeDom(tileCount) {
    const added = [];
    const tile = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 40, height: 40 }) };
    globalThis.Element = class { animate() {} };
    Element.prototype.animate = function () { const a = {}; this.animation = a; return a; };
    globalThis.document = {
        getElementById: () => ({ children: Array.from({ length: tileCount }, () => tile) }),
        createElement: () => { const el = Object.assign(new Element(), { style: {}, setAttribute() {}, remove() { this.removed = true; } }); added.push(el); return el; },
        body: { appendChild() {} }
    };
    return added;
}

describe('spellTileFx', () => {
    test('chacun des 4 sorts a son effet, branché dans classSpellsActionGems', () => {
        ['forge', 'harvest', 'skull', 'moult'].forEach(k => {
            expect(TILE_FX[k].shards.length).toBeGreaterThan(0);
            expect(gems).toContain(`playTileFx('${k}'`);
        });
    });
    test('sans DOM ou sans case : ne fait rien et ne lève pas', () => {
        expect(() => playTileFx('forge', [0, 1])).not.toThrow();
        fakeDom(4);
        expect(() => playTileFx('inconnu', [0])).not.toThrow();
        expect(() => playTileFx('forge', [])).not.toThrow();
    });
    test('crée un anneau et des éclats par case, retirés en fin d\'animation', () => {
        const added = fakeDom(4);
        playTileFx('skull', [0, 2]);
        expect(added.length).toBeGreaterThanOrEqual(2 * 4);
        added.forEach(el => { el.animation.onfinish(); expect(el.removed).toBe(true); });
    });
});
