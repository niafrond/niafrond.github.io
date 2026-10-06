/**
 * merchants.js — PNJ marchands (un par village) : stock déterministe, prix élevés, pièces rares et ultra rares.
 *
 * Module pur (sans DOM) : `world/index.js` y prend leurs fiches de PNJ, `shop.js` l'affichage et les achats.
 *
 * Stock d'un marchand (selon le niveau de sa région, `REGION_LEVEL`) :
 *  - « Étal » : quelques objets rechargeables et armes communs ou peu communs ;
 *  - « Pièces rares » : objets, boucliers, reliques et armes rares ;
 *  - « Pièce d'exception » : une pièce légendaire (ou, à défaut, la plus précieuse pièce rare), à prix d'or.
 * Les prix sont ceux du barème de base multipliés par `PRICE_MULT` (très cher). Les armes, boucliers et reliques sont
 * uniques (une fois achetés, plus en rayon) ; les objets rechargeables restent en vente.
 */
import { allItems } from './items.js';
import { allWeapons, weaponRarity } from './weapons.js';

export const REGION_LEVEL = { rizieres: 1, fleuve: 2, bambous: 3, gobi: 5, tonnerre: 7, volcan: 9, fauves: 11, mer: 13, fusang: 15, lune: 16 };

// Bonus d'enchères : plus c'est rare, plus c'est cher.
export const PRICE_MULT = { common: 2, uncommon: 2.5, rare: 4, legendary: 8 };
const ITEM_RARITY_PRICE = { common: 5, uncommon: 12, rare: 30, legendary: 80 };

export const baseWeaponPrice = weapon => Math.floor(weapon.minLevel * 15 + weapon.damage * 2);
export const baseItemPrice = item => Math.floor(item.minLevel * (ITEM_RARITY_PRICE[item.rarity] || 5));

export const MERCHANTS = [
    { id: 'merchant_rizieres', region: 'rizieres', name: 'Fu le Colporteur', title: 'Marchand ambulant',
      idle: ['Du riz sec, des nattes, et sous la natte… autre chose. Regarde mais ne marchande pas trop fort : mes prix sont gravés.', 'Les rizières sont vides, mais mon étal, lui, ne l\'est jamais.'] },
    { id: 'merchant_fleuve', region: 'fleuve', name: 'Dame Lian', title: 'Marchande de la berge',
      idle: ['Tout ce que le fleuve a rendu, je l\'ai nettoyé, fait briller et revendu. Avec un petit supplément pour la peine.', 'Le courant apporte, le courant reprend. Moi, je garde le meilleur.'] },
    { id: 'merchant_bambous', region: 'bambous', name: 'Maître Zhu', title: 'Marchand de la forêt',
      idle: ['Des élixirs distillés dans le creux des bambous. Les moines en font un secret, moi un commerce.', 'La qualité a un prix, voyageur. Et le prix a un parfum de thé.'] },
    { id: 'merchant_gobi', region: 'gobi', name: 'Ma le Caravanier', title: 'Marchand du désert',
      idle: ['J\'ai traversé trois mirages pour ces marchandises. Chaque pièce a une histoire, et chaque histoire un tarif.', 'L\'eau est rare dans le Gobi, les belles lames aussi. Devine ce qui coûte le plus cher.'] },
    { id: 'merchant_tonnerre', region: 'tonnerre', name: 'Tie le Fondeur', title: 'Marchand de métaux',
      idle: ['Fer d\'orage, bronze de foudre. Ça ne se marchande pas, ça se mérite.', 'Une lame forgée un jour de tonnerre vaut dix lames forgées par beau temps.'] },
    { id: 'merchant_volcan', region: 'volcan', name: 'Yan le Braisier', title: 'Marchand de braises',
      idle: ['Mes reliques sortent à peine de la forge. Elles sont chaudes, et mes prix aussi.', 'Pas de crédit : la lave ne fait pas crédit, moi non plus.'] },
    { id: 'merchant_fauves', region: 'fauves', name: 'Wu l\'Éleveur', title: 'Marchand de la plaine',
      idle: ['Croc de tigre, plume de rapace, et quelques merveilles que les chasseurs ne vendent qu\'à moi.', 'Les bêtes sont folles, mais mon commerce est sage : tout a un prix.'] },
    { id: 'merchant_mer', region: 'mer', name: 'Hai la Perlière', title: 'Marchande de perles',
      idle: ['Des perles, des coquillages, des armes repêchées là où personne ne retourne. Le prix inclut le courage.', 'La marée monte, mes tarifs aussi. Question de principe.'] },
    { id: 'merchant_fusang', region: 'fusang', name: 'Maître Tao', title: 'Marchand céleste',
      idle: ['Des reliques tombées de l\'Arbre Fusang. Elles brillent encore. Leur prix aussi, à vrai dire.', 'Les immortels paient comptant. Pourquoi pas vous ?'] },
    { id: 'merchant_lune', region: 'lune', name: 'Yutu le Lièvre', title: 'Marchand lunaire',
      idle: ['Pilons de jade, éclats de lune et trésors qu\'aucun mortel ne devrait posséder. Prix en conséquence.', 'Ici, on paie en or. Même la lune a des factures.'] }
];

// Montures : achetables chez certains marchands, elles accélèrent les déplacements sur les cartes (explorationView.js).
export const MOUNTS = {
    horse: { id: 'horse', name: 'Cheval de plaine', type: 'mount', speed: 2,
        description: 'Une monture robuste et docile : vous parcourez les cartes deux fois plus vite.' }
};
// Un marchand par monture : le Maître Zhu des Bambous (3e région) vend le cheval, très cher.
// Torche : vendue par les marchands des dernières régions, elle éclaire les cavernes et cryptes plongées dans le noir (world/underground.js).
export const TORCH = { id: 'torch', name: 'Torche', type: 'torch',
    description: 'Une torche de résine qui ne s\'éteint pas : éclaire largement les cavernes et cryptes, où l\'on n\'y voit sinon qu\'à un pas.' };
export const TORCH_PRICE = 400;
// Vendue tardivement : le joueur traverse d'abord les souterrains à tâtons, puis revient avec la torche après avoir avancé dans l'intrigue.
export const TORCH_MERCHANTS = ['merchant_fauves', 'merchant_mer', 'merchant_fusang', 'merchant_lune'];
export const MOUNT_OFFERS = { merchant_bambous: { id: 'horse', price: 480 } };

export const MERCHANT_IDS = MERCHANTS.map(m => m.id);
export const getMerchant = id => MERCHANTS.find(m => m.id === id) || null;

// Fiche de PNJ (format de world/text) : le marchand n'a pas de quête, juste une boutique.
export function merchantNpc(id) {
    const m = getMerchant(id);
    if (!m) return null;
    return {
        id: m.id, name: m.name, title: m.title, merchant: true, region: m.region,
        idle: m.idle,
        greeting: [`${m.name} : « ${m.idle[0]} »`]
    };
}

// PRNG déterministe (mulberry32) à partir d'une chaîne.
function rngFor(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    let a = (h >>> 0) || 1;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function sample(pool, count, rng) {
    const left = pool.slice();
    const out = [];
    while (out.length < count && left.length) out.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
    return out;
}

const offerOf = (kind, obj, section, rarity) => {
    const base = kind === 'weapon' ? baseWeaponPrice(obj) : baseItemPrice(obj);
    const unique = kind === 'weapon' || obj.type !== 'reusable';
    return { key: `${kind}:${obj.id}`, kind, id: obj.id, section, rarity, unique, price: Math.floor(base * (PRICE_MULT[rarity] || 2)) };
};

/**
 * Stock d'un marchand : liste d'offres { key, kind: 'item'|'weapon', id, section: 'stall'|'rare'|'exceptional',
 * rarity, unique, price }. Déterministe (même marchand, même Nouvelle Partie + → même stock).
 */
export function merchantStock(merchantId, ngPlus = 0) {
    const m = getMerchant(merchantId);
    if (!m) return [];
    const L = REGION_LEVEL[m.region] || 1;
    const rng = rngFor(`${merchantId}|${ngPlus}`);
    const items = allItems.map(i => ({ kind: 'item', obj: i, rarity: i.rarity }));
    const weapons = allWeapons.map(w => ({ kind: 'weapon', obj: w, rarity: weaponRarity(w) }));
    const all = [...items, ...weapons];
    const fits = (e, rarities, up, down = 99) => rarities.includes(e.rarity) && e.obj.minLevel <= L + up && e.obj.minLevel >= L - down;

    const stall = [
        ...sample(items.filter(e => e.obj.type === 'reusable' && fits(e, ['common', 'uncommon'], 1)), 3, rng),
        ...sample(weapons.filter(e => fits(e, ['common', 'uncommon'], 2, 5)), 2, rng)
    ];
    const rareEntries = sample(all.filter(e => fits(e, ['rare'], 6, 8)), 3, rng);
    const legendary = all.filter(e => fits(e, ['legendary'], 9, 12));
    const exceptional = legendary.length
        ? sample(legendary, 1, rng)
        : all.filter(e => fits(e, ['rare'], 9, 12) && !rareEntries.includes(e))
            .sort((a, b) => (b.kind === 'weapon' ? baseWeaponPrice(b.obj) : baseItemPrice(b.obj)) - (a.kind === 'weapon' ? baseWeaponPrice(a.obj) : baseItemPrice(a.obj))).slice(0, 1);

    const mount = MOUNT_OFFERS[merchantId];
    return [
        ...(TORCH_MERCHANTS.includes(merchantId) ? [{ key: 'torch:torch', kind: 'torch', id: 'torch', section: 'gear', rarity: 'common', unique: true, price: TORCH_PRICE }] : []),
        ...(mount ? [{ key: `mount:${mount.id}`, kind: 'mount', id: mount.id, section: 'mount', rarity: 'rare', unique: true, price: mount.price }] : []),
        ...stall.map(e => offerOf(e.kind, e.obj, 'stall', e.rarity)),
        ...rareEntries.map(e => offerOf(e.kind, e.obj, 'rare', e.rarity)),
        ...exceptional.map(e => {
            const o = offerOf(e.kind, e.obj, 'exceptional', e.rarity);
            // « prix d'or » : la pièce d'exception vaut au moins 1,5 fois une pièce rare comparable.
            return { ...o, price: Math.floor(o.price * (e.rarity === 'legendary' ? 1 : 1.5)) };
        })
    ];
}

export function offerObject(offer) {
    if (offer.kind === 'mount') return MOUNTS[offer.id] || null;
    if (offer.kind === 'torch') return TORCH;
    return offer.kind === 'weapon' ? allWeapons.find(w => w.id === offer.id) : allItems.find(i => i.id === offer.id);
}

// Offres encore en rayon : une pièce unique déjà achetée (ou déjà possédée, pour une arme) disparaît.
export function availableOffers(merchantId, hero, ngPlus = 0) {
    const sold = hero.merchantSold?.[merchantId] || [];
    return merchantStock(merchantId, ngPlus).filter(o => {
        if (o.unique && sold.includes(o.key)) return false;
        if (o.kind === 'weapon' && (hero.weapons || []).some(w => w.id === o.id)) return false;
        if (o.kind === 'mount' && hero.mount) return false;   // une seule monture
        if (o.kind === 'torch' && hero.torch) return false;   // une seule torche
        return true;
    });
}

// Achat d'une offre : retire l'or, ajoute l'arme / l'objet au sac. Renvoie { ok, message }.
export function buyOffer(merchantId, key, hero, ngPlus = 0) {
    const offer = availableOffers(merchantId, hero, ngPlus).find(o => o.key === key);
    if (!offer) return { ok: false, message: 'Cette pièce n\'est plus en vente.' };
    const obj = offerObject(offer);
    if (!obj) return { ok: false, message: 'Marchandise introuvable.' };
    if ((hero.gold || 0) < offer.price) {
        return { ok: false, message: `Pas assez d'or ! Coût : ${offer.price}, vous avez ${hero.gold || 0}.` };
    }
    hero.gold -= offer.price;
    if (offer.kind === 'torch') {
        hero.torch = true;
    } else if (offer.kind === 'mount') {
        hero.mount = obj.id;
    } else if (offer.kind === 'weapon') {
        if (!hero.weapons) hero.weapons = [];
        hero.weapons.push(obj);
    } else {
        if (!hero.inventory) hero.inventory = [];
        hero.inventory.push({ ...obj });
    }
    if (offer.unique) {
        if (!hero.merchantSold) hero.merchantSold = {};
        (hero.merchantSold[merchantId] = hero.merchantSold[merchantId] || []).push(offer.key);
    }
    return { ok: true, message: `${obj.name} acheté pour ${offer.price} pièces d'or !`, offer, obj };
}


// ── Revente au marchand ─────────────────────────────────────────────────────
// Le marchand rachète à SELL_RATIO du barème de base (sans la majoration de vente). Jamais le matériel activé :
// armes en main, objet actif du combat, reliques portées (bonus permanent déjà appliqué). Un bouclier porté n'est pas dans le sac.
export const SELL_RATIO = 0.4;

export const sellPriceOf = (kind, obj) => Math.max(1, Math.floor((kind === 'weapon' ? baseWeaponPrice(obj) : baseItemPrice(obj)) * SELL_RATIO));

const equippedWeaponIds = hero => new Set([hero.equippedWeapon?.id, hero.equipment?.rightHand?.id, hero.equipment?.leftHand?.id].filter(Boolean));

/** Pourquoi cette pièce ne peut pas être vendue (null si elle le peut). */
export function sellLockReason(hero, kind, obj, inventoryIndex = null) {
    if (kind === 'weapon') return equippedWeaponIds(hero).has(obj.id) ? 'Équipée' : null;
    if (inventoryIndex !== null && inventoryIndex === hero.activeInventoryIndex && obj.type !== 'shield') return 'Objet actif';
    if (obj.type === 'artifact' && obj.applied) return 'Relique portée';
    return null;
}

/** Tout ce que le héros possède et peut montrer au marchand : [{ key, kind, obj, price, locked }]. */
export function sellableEntries(hero) {
    const weapons = (hero.weapons || []).map(w => ({ key: `weapon:${w.id}`, kind: 'weapon', obj: w, rarity: weaponRarity(w), price: sellPriceOf('weapon', w), locked: sellLockReason(hero, 'weapon', w) }));
    const items = (hero.inventory || []).map((it, index) => ({ key: `inv:${index}`, kind: 'item', obj: it, rarity: it.rarity || 'common', price: sellPriceOf('item', it), locked: sellLockReason(hero, 'item', it, index), index }));
    return [...weapons, ...items];
}

/** Vend une pièce (clé de `sellableEntries`) : retire l'objet, crédite l'or, recale l'index de l'objet actif. */
export function sellEntry(hero, key) {
    const entry = sellableEntries(hero).find(e => e.key === key);
    if (!entry) return { ok: false, message: 'Vous ne possédez plus cette pièce.' };
    if (entry.locked) return { ok: false, message: `${entry.obj.name} ne peut pas être vendu : ${entry.locked.toLowerCase()}.` };
    if (entry.kind === 'weapon') {
        hero.weapons = hero.weapons.filter(w => w.id !== entry.obj.id);
    } else {
        hero.inventory.splice(entry.index, 1);
        if (Number.isInteger(hero.activeInventoryIndex)) {
            if (hero.activeInventoryIndex > entry.index) hero.activeInventoryIndex--;
            if (hero.inventory.length === 0) hero.activeInventoryIndex = null;
        }
    }
    hero.gold = (hero.gold || 0) + entry.price;
    return { ok: true, message: `${entry.obj.name} vendu pour ${entry.price} pièces d'or.`, entry };
}
