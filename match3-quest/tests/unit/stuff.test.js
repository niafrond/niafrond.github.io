// Stuff (casque, collier, bracelet, bague) : bonus portés, PV max, poison, protection de biome, boutique, butin et quêtes des colliers.
import './fixtures/playerForge.js';
import { describe, test, expect } from '@jest/globals';
import {
    allStuff, STUFF_SLOTS, getStuffById, grantStuff, equipStuff, unequipStuff, stuffTotals, protectsFromBiome, inflictPoison,
    lootableStuff, rollStuffDrop, CHEST_STUFF_DROP, collarForBiome, normalizeStuff, describeStuff
} from '../../stuff.js';
import { gearBonus } from '../../combatStats.js';
import { BIOME_RULES } from '../../terrain.js';
import { merchantStock, availableOffers, buyOffer, sellableEntries, sellEntry, MERCHANT_IDS } from '../../merchants.js';
import { SCREENS, QUESTS } from '../../story.js';

const hero = (extra = {}) => ({ level: 40, hp: 100, maxHp: 100, gold: 100000, stuffOwned: [], stuff: {}, statusEffects: {}, ...extra });

describe('catalogue', () => {
    test('quatre emplacements, des ids uniques, des emplacements valides', () => {
        expect(new Set(allStuff.map(s => s.id)).size).toBe(allStuff.length);
        allStuff.forEach(s => expect(STUFF_SLOTS).toContain(s.slot));
        STUFF_SLOTS.forEach(slot => expect(allStuff.filter(s => s.slot === slot).length).toBeGreaterThanOrEqual(4));
    });
    test('un collier de quête par biome hostile, jamais en boutique ni en butin', () => {
        ['volcano', 'bamboo', 'snow', 'sea'].forEach(biome => {
            const c = collarForBiome(biome);
            expect(c).toMatchObject({ slot: 'neck', quest: true });
            expect(BIOME_RULES[biome === 'snow' ? 'snow' : biome]).toBeTruthy();
            expect(lootableStuff()).not.toContain(c);
        });
    });
});

describe('porter du stuff', () => {
    test('les PV max suivent le stuff porté, et seulement lui', () => {
        const h = hero({ hp: 60 });
        grantStuff(h, 'casque_de_bronze');
        expect(equipStuff(h, 'casque_de_bronze').ok).toBe(true);
        expect([h.maxHp, h.hp]).toEqual([110, 70]);
        unequipStuff(h, 'head');
        expect([h.maxHp, h.hp]).toEqual([100, 70]);
    });
    test('remplacer une pièce retire les PV de l\'ancienne', () => {
        const h = hero();
        ['casque_de_bronze', 'casque_de_jade'].forEach(id => grantStuff(h, id));
        equipStuff(h, 'casque_de_bronze');
        equipStuff(h, 'casque_de_jade');
        expect(h.maxHp).toBe(120);
        expect(h.stuff.head).toBe('casque_de_jade');
    });
    test('niveau requis, possession et doublons', () => {
        const h = hero({ level: 1 });
        expect(equipStuff(h, 'casque_de_cuir').ok).toBe(false);   // non possédé
        grantStuff(h, 'casque_du_dragon');
        expect(grantStuff(h, 'casque_du_dragon')).toBeNull();
        expect(equipStuff(h, 'casque_du_dragon').ok).toBe(false);   // niveau 28
    });
    test('Atk / Déf s\'ajoutent à celles des armes (combatStats)', () => {
        const h = hero({ equippedWeapon: { atkBonus: 5 } });
        ['bracelet_de_tendon', 'bague_de_cuivre'].forEach(id => { grantStuff(h, id); equipStuff(h, id); });
        expect(gearBonus(h, 'attack')).toBe(5 + 3 + 2);
        expect(gearBonus(h, 'defense')).toBe(2);
        expect(stuffTotals(h)).toMatchObject({ atk: 5, def: 2, maxHp: 8 });
    });
    test('normalizeStuff écarte les ids inconnus ou mal rangés', () => {
        const h = { stuffOwned: ['casque_de_cuir', 'inconnu'], stuff: { head: 'casque_de_cuir', neck: 'casque_de_cuir', ring: 'bague_de_bois' } };
        normalizeStuff(h);
        expect(h.stuffOwned).toEqual(['casque_de_cuir']);
        expect(h.stuff).toEqual({ head: 'casque_de_cuir', neck: null, wrist: null, ring: null });
    });
    test('description lisible', () => {
        expect(describeStuff(getStuffById('collier_obsidienne'))).toContain('Protège : Volcan');
    });
});

describe('poison et biomes', () => {
    test('la résistance réduit puis annule le poison', () => {
        const h = hero();
        expect(inflictPoison(h, 10)).toBe(10);
        h.statusEffects = {};
        grantStuff(h, 'collier_antivenin'); equipStuff(h, 'collier_antivenin');
        expect(inflictPoison(h, 10)).toBe(5);
        h.statusEffects = {};
        grantStuff(h, 'bracelet_antidote'); equipStuff(h, 'bracelet_antidote');   // 50 + 60 → plafonné à 100 %
        expect(inflictPoison(h, 10)).toBe(0);
        expect(h.statusEffects.poisoned).toBeUndefined();
    });
    test('le collier d\'un biome protège de ce biome seulement', () => {
        const h = hero();
        grantStuff(h, 'collier_obsidienne'); equipStuff(h, 'collier_obsidienne');
        expect(protectsFromBiome(h, 'volcano')).toBe(true);
        ['bamboo', 'snow', 'sea'].forEach(b => expect(protectsFromBiome(h, b)).toBe(false));
    });
});

describe('boutique et butin', () => {
    test('chaque marchand propose des parures, jamais un collier de quête', () => {
        MERCHANT_IDS.forEach(id => {
            const offers = merchantStock(id).filter(o => o.kind === 'stuff');
            expect(offers.length).toBeGreaterThan(0);
            offers.forEach(o => expect(getStuffById(o.id).quest).toBeFalsy());
        });
    });
    test('acheter range le stuff dans la collection, et il quitte le rayon', () => {
        const h = hero();
        const offer = merchantStock('merchant_volcan').find(o => o.kind === 'stuff');
        const res = buyOffer('merchant_volcan', offer.key, h);
        expect(res.ok).toBe(true);
        expect(h.stuffOwned).toContain(offer.id);
        expect(availableOffers('merchant_volcan', h).some(o => o.key === offer.key)).toBe(false);
    });
    test('la revente refuse le stuff porté', () => {
        const h = hero();
        grantStuff(h, 'bague_de_bois'); equipStuff(h, 'bague_de_bois');
        const entry = sellableEntries(h).find(e => e.key === 'stuff:bague_de_bois');
        expect(entry.locked).toBe('Porté');
        unequipStuff(h, 'ring');
        expect(sellEntry(h, 'stuff:bague_de_bois').ok).toBe(true);
        expect(h.stuffOwned).not.toContain('bague_de_bois');
    });
    test('rollStuffDrop ne redonne pas ce qui est possédé', () => {
        const owner = hero({ stuffOwned: lootableStuff().filter(s => s.rarity !== 'legendary').map(s => s.id) });
        for (let i = 0; i < 50; i++) {
            const s = rollStuffDrop(owner, { chance: 1, rarity: { common: 1 } });
            expect(!s || s.rarity === 'legendary').toBe(true);
        }
        expect(rollStuffDrop(hero(), CHEST_STUFF_DROP[1], () => 0.99)).toBeNull();
    });
});

describe('quêtes des colliers', () => {
    test.each([['volcan', 'collier_obsidienne'], ['bambous', 'collier_jade_vert'], ['tonnerre', 'collier_braise_d_orage'], ['mer', 'collier_perle_des_marees']])(
        '%s : relique, mini-boss, remise du collier', (region, collar) => {
            const q = QUESTS.find(x => x.reward?.stuff === collar);
            expect(q).toBeTruthy();
            expect(q.objectives.map(o => o.type)).toEqual(['chest', 'kill']);
            const giver = SCREENS[`${region}_village`].npcs.find(n => n.id === q.giver);
            expect(giver).toBeTruthy();
            const wild = SCREENS[`${region}_wild`];
            expect(wild.chests.some(c => c.id === q.objectives[0].target)).toBe(true);
            const boss = wild.enemies.find(e => e.id === q.objectives[1].target);
            expect(boss).toMatchObject({ permanent: true });
            expect(getStuffById(collar).biomeProtect).toBeTruthy();
        });
});
