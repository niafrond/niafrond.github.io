import { readFileSync } from 'node:fs';
import {
    MERCHANTS, MERCHANT_IDS, REGION_LEVEL, PRICE_MULT, merchantStock, merchantNpc, availableOffers, buyOffer, offerObject,
    baseItemPrice, baseWeaponPrice, SELL_RATIO, sellableEntries, sellEntry, sellPriceOf, toggleSellTag, allShieldsTagged, surplusEntries, sellSurplus
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
            stock.filter(o => o.kind !== 'mount' && o.kind !== 'torch').forEach(o => {
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

    test('le cheval : vendu par le marchand des Bambous seulement, très cher, achat unique, monture enregistrée', () => {
        const horse = merchantStock('merchant_bambous').find(o => o.kind === 'mount');
        expect(horse).toMatchObject({ id: 'horse', section: 'mount', unique: true });
        expect(horse.price).toBeGreaterThanOrEqual(400);
        MERCHANT_IDS.filter(id => id !== 'merchant_bambous').forEach(id => expect(merchantStock(id).some(o => o.kind === 'mount')).toBe(false));
        expect(offerObject(horse)).toMatchObject({ name: 'Cheval de plaine', speed: 2 });
        const poor = { gold: horse.price - 1, inventory: [], weapons: [] };
        expect(buyOffer('merchant_bambous', horse.key, poor)).toMatchObject({ ok: false });
        expect(poor.mount).toBeUndefined();
        const rich = { gold: horse.price + 20, inventory: [], weapons: [] };
        expect(buyOffer('merchant_bambous', horse.key, rich)).toMatchObject({ ok: true });
        expect(rich).toMatchObject({ mount: 'horse', gold: 20 });
        expect(availableOffers('merchant_bambous', rich).some(o => o.kind === 'mount')).toBe(false);   // une seule monture
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

describe('revente aux marchands', () => {
    const sword = { id: 'rusty_sword', name: 'Sabre', type: 'sword', damage: 10, actionPoints: 3, minLevel: 1 };
    const axe = { id: 'wood_axe', name: 'Hache', type: 'axe', damage: 12, actionPoints: 3, minLevel: 2 };
    const mk = () => ({
        gold: 0, weapons: [sword, axe], equippedWeapon: sword, equipment: { rightHand: sword, leftHand: null, item: null },
        inventory: [
            { id: 'healthPotion', name: 'Élixir', type: 'reusable', rarity: 'common', minLevel: 1 },
            { id: 'honey_vial', name: 'Miel', type: 'reusable', rarity: 'uncommon', minLevel: 3 },
            { id: 'ringOfVitality', name: 'Bracelet', type: 'artifact', rarity: 'rare', minLevel: 8, applied: true },
            { id: 'jade_shield', name: 'Bouclier', type: 'shield', rarity: 'uncommon', minLevel: 5, defense: 8 }
        ],
        activeInventoryIndex: 1
    });

    test('rachat à 40 % du barème de base (jamais plus que le prix d\'achat)', () => {
        const w = { ...axe };
        expect(sellPriceOf('weapon', w)).toBe(Math.floor(baseWeaponPrice(w) * SELL_RATIO));
        merchantStock('merchant_gobi').filter(o => o.kind !== 'torch').forEach(o => expect(sellPriceOf(o.kind, offerObject(o))).toBeLessThan(o.price));
    });

    test('le stuff activé est verrouillé : arme en main, objet actif, relique portée', () => {
        const h = mk();
        const by = k => sellableEntries(h).find(e => e.key === k);
        expect(by('weapon:rusty_sword').locked).toBe('Équipée');
        expect(by('weapon:wood_axe').locked).toBeNull();
        expect(by('inv:0').locked).toBeNull();
        expect(by('inv:1').locked).toBe('Objet actif');
        expect(by('inv:2').locked).toBe('Relique portée');
        expect(by('inv:3').locked).toBeNull();            // un bouclier du sac n'est pas porté
        const g = h.gold;
        expect(sellEntry(h, 'weapon:rusty_sword').ok).toBe(false);
        expect(sellEntry(h, 'inv:1').ok).toBe(false);
        expect(sellEntry(h, 'inv:2').ok).toBe(false);
        expect(h.gold).toBe(g);
        expect(h.weapons).toHaveLength(2);
        expect(h.inventory).toHaveLength(4);
    });

    test('arme en main gauche ou main droite seule : verrouillée aussi', () => {
        const h = { gold: 0, weapons: [sword, axe], equipment: { rightHand: null, leftHand: axe, item: null }, inventory: [] };
        expect(sellableEntries(h).find(e => e.key === 'weapon:wood_axe').locked).toBe('Équipée');
        expect(sellableEntries(h).find(e => e.key === 'weapon:rusty_sword').locked).toBeNull();
    });

    test('vente : or crédité, objet retiré, index de l\'objet actif recalé', () => {
        const h = mk();
        const price = sellPriceOf('item', h.inventory[0]);
        expect(sellEntry(h, 'inv:0')).toMatchObject({ ok: true });
        expect(h.gold).toBe(price);
        expect(h.inventory.map(i => i.id)).toEqual(['honey_vial', 'ringOfVitality', 'jade_shield']);
        expect(h.activeInventoryIndex).toBe(0);                // l'objet actif (Miel) est toujours le même
        expect(h.inventory[h.activeInventoryIndex].id).toBe('honey_vial');
        expect(sellEntry(h, 'weapon:wood_axe').ok).toBe(true);
        expect(h.weapons.map(w => w.id)).toEqual(['rusty_sword']);
        expect(sellEntry(h, 'weapon:wood_axe').ok).toBe(false);
    });

    test('la fenêtre propose Acheter / Vendre', () => {
        const src = readFileSync(new URL('../../shop.js', import.meta.url), 'utf8');
        expect(src).toContain('data-sell');
        expect(src).toContain('data-mode="sell"');
    });

    test('les objets spéciaux de quête (exploration.questItems) ne sont jamais proposés à la vente', () => {
        const h = { ...hero(), exploration: { questItems: [{ id: 'qi_x', name: 'Sceau', quest: 'q' }] } };
        expect(sellableEntries(h).some(e => /Sceau|qi_x/.test(e.obj.name + e.obj.id))).toBe(false);
    });
});


describe('excédent à vendre (tag bouton pièce)', () => {
    const potion = { id: 'p1', name: 'Potion', type: 'consumable', rarity: 'common', minLevel: 1 };
    const mk = (n, extra = {}) => ({ gold: 0, weapons: [], inventory: Array.from({ length: n }, () => ({ ...potion })), activeInventoryIndex: null, ...extra });

    test('tag basculant ; un exemplaire est toujours gardé', () => {
        const h = mk(3);
        expect(surplusEntries(h)).toEqual([]);
        expect(toggleSellTag(h, 'p1')).toBe(true);
        const [e] = surplusEntries(h);
        expect(e.qty).toBe(2);
        const res = sellSurplus(h, 'p1');
        expect(res.ok).toBe(true);
        expect(h.inventory).toHaveLength(1);
        expect(h.gold).toBe(sellPriceOf('item', potion) * 2);
        expect(h.sellTags).toEqual([]);
        expect(toggleSellTag(h, 'p1')).toBe(true);
        expect(toggleSellTag(h, 'p1')).toBe(false);
    });

    test('un exemplaire actif compte comme celui gardé', () => {
        const h = mk(3, { activeInventoryIndex: 1 });
        toggleSellTag(h, 'p1');
        expect(surplusEntries(h)[0].qty).toBe(2);
        sellSurplus(h, 'p1');
        expect(h.inventory).toHaveLength(1);
        expect(h.activeInventoryIndex).toBe(0);
    });

    test('armes et boucliers : taggables même sans doublon, jamais équipés', () => {
        const sword = { id: 'rusty_sword', name: 'Sabre', type: 'sword', damage: 10, actionPoints: 3, minLevel: 1 };
        const axe = { id: 'wood_axe', name: 'Hache', type: 'axe', damage: 12, actionPoints: 3, minLevel: 2 };
        const shield = { id: 'sh', name: 'Targe', type: 'shield', rarity: 'common', minLevel: 1, defense: 2 };
        const h = { gold: 0, weapons: [sword, axe], equippedWeapon: sword, equipment: { rightHand: sword, leftHand: null, item: null }, inventory: [shield], activeInventoryIndex: null };
        toggleSellTag(h, 'weapon:wood_axe');
        toggleSellTag(h, 'weapon:rusty_sword');   // équipée : ignorée
        toggleSellTag(h, 'sh');
        expect(surplusEntries(h).map(e => e.id).sort()).toEqual(['sh', 'weapon:wood_axe']);
        expect(sellSurplus(h, 'weapon:wood_axe').ok).toBe(true);
        expect(sellSurplus(h, 'sh').ok).toBe(true);
        expect(h.weapons).toEqual([sword]);
        expect(h.inventory).toEqual([]);
        expect(h.gold).toBeGreaterThan(0);
    });

    test('allShieldsTagged : vrai seulement si tous les boucliers du sac sont tagués et aucun n\'est porté', () => {
        const mkShield = id => ({ id, name: id, type: 'shield', rarity: 'common', minLevel: 1 });
        const h = { weapons: [], equipment: { leftHand: null }, inventory: [mkShield('a'), mkShield('b')], sellTags: ['a'] };
        expect(allShieldsTagged(h)).toBe(false);
        h.sellTags.push('b');
        expect(allShieldsTagged(h)).toBe(true);
        h.equipment.leftHand = mkShield('c');
        expect(allShieldsTagged(h)).toBe(false);
        expect(allShieldsTagged({ inventory: [], sellTags: [] })).toBe(false);
    });
});

describe('pièces standard : un objet de chaque type en permanence', () => {
    const TYPES = ['reusable', 'shield', 'artifact'];

    test('chaque marchand vend au moins un objet standard de chaque type, jamais retiré du rayon', () => {
        MERCHANT_IDS.forEach(id => {
            const standard = merchantStock(id).filter(o => o.section === 'standard');
            expect(standard.map(o => offerObject(o).type).sort()).toEqual([...TYPES].sort());
            standard.forEach(o => {
                expect(o.unique).toBe(false);
                expect(['common', 'uncommon', 'rare']).toContain(o.rarity);
            });
            expect(new Set(merchantStock(id).map(o => o.key)).size).toBe(merchantStock(id).length);
        });
    });

    test('achat répété : le bouclier et l\'objet restent en rayon, la relique n\'est jamais achetée en double', () => {
        const id = 'merchant_tonnerre';
        const h = hero(10000000);
        merchantStock(id).filter(o => o.section === 'standard').forEach(o => {
            expect(buyOffer(id, o.key, h).ok).toBe(true);
            expect(availableOffers(id, h).some(a => a.key === o.key)).toBe(true);
            const again = buyOffer(id, o.key, h);
            expect(again.ok).toBe(offerObject(o).type !== 'artifact');
        });
    });
});
