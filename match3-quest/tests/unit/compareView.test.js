import { describe, test, expect } from '@jest/globals';
import { compareRows, buildCompareHtml } from '../../compareView.js';

describe('comparaison', () => {
    test('sorts : coût total et valeur plus haute mise en évidence', () => {
        const a = { name: 'A', cost: { red: 2, blue: 3 }, dmg: 10, minLevel: 3 };
        const b = { name: 'B', cost: 4, color: 'red', dmg: 30, minLevel: 3 };
        expect(compareRows('spell', a)[0].num).toBe(5);
        const html = buildCompareHtml('spell', a, b);
        expect(html).toContain('<td>10</td><td class="cmp-better">30</td>');   // dégâts : B meilleur
        // coût en gomettes (disque de couleur avec la quantité) : B moins cher
        expect(html).toMatch(/<td><span class="cost-badge"[^>]*>2<\/span><span class="cost-badge"[^>]*>3<\/span><\/td><td class="cmp-better"><span class="cost-badge"[^>]*>4<\/span><\/td>/);
    });

    test('armes et stuffs', () => {
        const w = compareRows('weapon', { damage: 20, actionPoints: 4, minLevel: 5, twoHanded: true });
        expect(w.find(r => r.label === 'Mains').text).toBe('Deux mains');
        const s = compareRows('stuff', { slot: 'ring', rarity: 'rare', atkBonus: 2, minLevel: 9 });
        expect(s[0].text).toBe('Bague');
        expect(buildCompareHtml('stuff', { name: '<x>', slot: 'ring' }, { name: 'y', slot: 'head' })).toContain('&lt;x&gt;');
    });
});
