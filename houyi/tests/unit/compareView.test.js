import { describe, test, expect } from '@jest/globals';
import { compareRows, buildCompareHtml, deltaBadgesHtml } from '../../compareView.js';

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

    test('écarts avec l\'objet porté : vert si meilleur, rouge sinon, rien si identique', () => {
        const fields = [['damage', 'Dégâts'], ['actionPoints', 'PA', 'low'], ['defBonus', 'Déf']];
        const worn = { id: 'a', damage: 10, actionPoints: 3, defBonus: 2 };
        const html = deltaBadgesHtml({ id: 'b', damage: 22, actionPoints: 5, defBonus: 2 }, worn, fields);
        expect(html).toContain('<span class="delta delta-up">+12 Dégâts</span>');
        expect(html).toContain('<span class="delta delta-down">+2 PA</span>');   // plus de PA = moins bien
        expect(html).not.toContain('Déf');
        expect(deltaBadgesHtml({ id: 'c', damage: 4 }, worn, fields)).toContain('delta-down">−6 Dégâts');
        expect(deltaBadgesHtml(worn, worn, fields)).toBe('');
        expect(deltaBadgesHtml({ id: 'd', damage: 5 }, null, fields)).toBe('');
    });
});

describe('écarts d\'équipement (armes mains droite et gauche, boucliers, stuff)', () => {
    const arc = { id: 'a', type: 'weapon', damage: 10, actionPoints: 3, atkBonus: 0 };
    const arc2 = { id: 'b', type: 'weapon', damage: 20, actionPoints: 4, atkBonus: 5 };
    const bouclier = { id: 's', type: 'shield', defense: 10, absorbDamage: 0 };

    test('arme contre arme : dégâts, PA (moins = mieux) et bonus', async () => {
        const { gearDeltasHtml } = await import('../../compareView.js');
        const html = gearDeltasHtml(arc2, arc);
        expect(html).toContain('delta-up">+10 Dégâts');
        expect(html).toContain('delta-down">+1 PA');
        expect(html).toContain('delta-up">+5 Atk');
    });

    test('arme contre bouclier en main gauche : défense perdue, pas de PA comparés', async () => {
        const { gearDeltasHtml } = await import('../../compareView.js');
        const html = gearDeltasHtml(arc2, bouclier);
        expect(html).toContain('delta-down">−10 Déf');
        expect(html).toContain('+20 Dégâts');
        expect(html).not.toContain('PA');
    });

    test('bouclier contre arme en main gauche, et contre un autre bouclier', async () => {
        const { gearDeltasHtml } = await import('../../compareView.js');
        expect(gearDeltasHtml(bouclier, arc2)).toContain('delta-down">−20 Dégâts');
        expect(gearDeltasHtml({ ...bouclier, id: 's2', defense: 14 }, bouclier)).toContain('delta-up">+4 Déf');
    });

    test('emplacement vide : le gain complet ; même objet : rien', async () => {
        const { gearDeltasHtml } = await import('../../compareView.js');
        const piece = { id: 'p', type: 'stuff', slot: 'ring', defBonus: 3, maxHp: 10, manaMax: { red: 8 } };
        const html = gearDeltasHtml(piece, null);
        expect(html).toContain('+3 Déf');
        expect(html).toContain('+10 PV max');
        expect(html).toContain('+8 Qì rouge');
        expect(gearDeltasHtml(piece, piece)).toBe('');
    });

    test('stuff : qì max et résistance comparés à la pièce portée', async () => {
        const { gearDeltasHtml } = await import('../../compareView.js');
        const worn = { id: 'w', type: 'stuff', manaMax: { red: 8 }, poisonResist: 50 };
        const html = gearDeltasHtml({ id: 'n', type: 'stuff', manaMax: { red: 12 }, poisonResist: 20 }, worn);
        expect(html).toContain('delta-up">+4 Qì rouge');
        expect(html).toContain('delta-down">−30 % poison');
    });
});
