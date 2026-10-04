import { readFileSync } from 'node:fs';
import {
    MERCHANTS, MERCHANT_IDS, REGION_LEVEL, PRICE_MULT, merchantStock, merchantNpc, availableOffers, buyOffer, offerObject,
    baseItemPrice, baseWeaponPrice
} from '../../merchants.js';
import { REGION_LEVEL as WORLD_LEVEL, REGION_ORDER } from '../../world/index.js';
import { SCREENS } from '../../story.js';
import { allItems } from '../../items.js';

const hero = (gold = 100000) => ({ gold, weapons: [], inventory: [] });

describe('PNJ marchands', () => {
    test('un marchand par région, niveaux alignés sur le monde', () => {
        expect(MERCHANTS.map(m => m.region)).toEqual(REGION_ORDER);
        expect(REGION_LEVEL).toEqual(WORLD_LEVEL);
        MERCHANTS.forEach(m => { expect(m.idle.length).toBeGreaterThan(0); expect(m.name).toBeTruthy(); });
    });

    test('chaque marchand est placé dans le village de sa région (PNJ marqué merchant)', () => {
        MERCHANTS.forEach(m => {
            const village = SCREENS[`${m.region}_village`];
            const npc = village.npcs.find(n => n.id === m.id);
            expect(npc).toBeTruthy();
            expect(npc.merchant).toBe(true);
            expect(npc.idle.length).toBeGreaterThan(0);
        });
        expect(merchantNpc('inconnu')).toBeNull();
    });

    test('stock : étal, pièces rares et pièce d\'exception, très cher, déterministe', () => {
        MERCHANT_IDS.forEach(id => {
            const stock = merchantStock(id);
            expect(stock).toEqual(merchantStock(id));
            const sections = new Set(stock.map(o => o.section));
            expect(sections.has('rare')).toBe(true);
            expect(sections.has('exceptional')).toBe(true);
            expect(new Set(stock.map(o => o.key)).size).toBe(stock.length);
            stock.forEach(o => {
                const obj = offerObject(o);
                expect(obj).toBeTruthy();
                const base = o.kind === 'weapon' ? baseWeaponPrice(obj) : baseItemPrice(obj);
                expect(o.price).toBeGreaterThanOrEqual(Math.floor(base * PRICE_MULT[o.rarity]));
                if (o.section === 'rare') expect(o.rarity).toBe('rare');
            });
            const exceptional = stock.find(o => o.section === 'exceptional');
            const rareMax = Math.max(...stock.filter(o => o.section === 'rare').map(o => o.price));
            expect(exceptional.price).toBeGreaterThanOrEqual(rareMax);
        });
    });

    test('les plus riches régions vendent de l\'ultra rare (légendaire)', () => {
        expect(merchantStock('merchant_lune').some(o => o.rarity === 'legendary')).toBe(true);
        expect(merchantStock('merchant_fusang').some(o => o.rarity === 'legendary')).toBe(true);
    });

    test('achat : or retiré, pièce unique plus en rayon, objet rechargeable toujours en vente', () => {
        const id = 'merchant_gobi';
        const h = hero(1000000);
        const offers = availableOffers(id, h);
        const unique = offers.find(o => o.unique && o.kind === 'item') || offers.find(o => o.unique);
        const res = buyOffer(id, unique.key, h);
        expect(res.ok).toBe(true);
        expect(h.gold).toBe(1000000 - unique.price);
        expect(availableOffers(id, h).some(o => o.key === unique.key)).toBe(false);
        expect(buyOffer(id, unique.key, h).ok).toBe(false);
        if (unique.kind === 'weapon') expect(h.weapons.map(w => w.id)).toContain(unique.id);
        else expect(h.inventory.map(i => i.id)).toContain(unique.id);

        const stall = offers.find(o => o.section === 'stall' && !o.unique);
        expect(buyOffer(id, stall.key, h).ok).toBe(true);
        expect(availableOffers(id, h).some(o => o.key === stall.key)).toBe(true);
    });

    test('pas assez d\'or : rien ne change', () => {
        const h = hero(5);
        const offer = merchantStock('merchant_rizieres')[0];
        const res = buyOffer('merchant_rizieres', offer.key, h);
        expect(res.ok).toBe(false);
        expect(h.gold).toBe(5);
        expect(h.inventory).toEqual([]);
        expect(h.weapons).toEqual([]);
    });

    test('une arme déjà possédée n\'est plus proposée ; le marchand vend aussi des reliques et boucliers', () => {
        const stock = merchantStock('merchant_tonnerre');
        const w = stock.find(o => o.kind === 'weapon');
        const h = hero();
        h.weapons.push(offerObject(w));
        expect(availableOffers('merchant_tonnerre', h).some(o => o.key === w.key)).toBe(false);
        const kinds = new Set(MERCHANT_IDS.flatMap(id => merchantStock(id)).filter(o => o.kind === 'item').map(o => offerObject(o).type));
        expect(kinds.has('artifact') || kinds.has('shield')).toBe(true);
    });

    test('plus d\'onglet Boutique : les marchands la remplacent ; icône de marchand au-dessus de la tête', () => {
        const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
        expect(html).not.toContain("switchTab('boutique')");
        expect(html).toContain('merchants.js');
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toContain('drawMerchantBadge(');
        expect(view).toContain('it.n.merchant');
        expect(allItems.length).toBeGreaterThan(0);
    });
});
