// Stuff : casque, collier, bracelet et bague. Module pur (sans DOM).
//
// Un stuff se gagne (marchands, coffres, butin de victoire, quêtes) et se porte dans l'onglet « Stuff ». Porté, il donne :
//  - des bonus d'Attaque (`atkBonus`, % de critique) et de Défense (`defBonus`, % de blocage), comme les armes (combatStats.js) ;
//  - des PV max permanents (`maxHp`) tant qu'il est porté : le retirer les retire, les PV actuels suivent à la hausse seulement ;
//  - une résistance au poison (`poisonResist`, % de dégâts de poison évités, 100 = immunité) ;
//  - une protection de biome (`biomeProtect` : clé de règle de terrain.js), réservée aux colliers de quête, un par biome hostile :
//  - l'indétectabilité (`stealth`, collier du voile d'ombre de Fusang, avant-dernier biome) : les ennemis ne détectent plus le héros (voir exploration.js) ;
//    la lave ne brûle plus (Volcan), les bambous n'envahissent plus (Bambous), la glace ne gèle plus (Neige), la mer ne dérive plus (Mer).
//
// Le héros garde `stuffOwned` (ids possédés) et `stuff` ({ head, neck, wrist, ring } : id porté ou null).

export const STUFF_SLOTS = ['head', 'neck', 'wrist', 'ring'];
export const STUFF_SLOT_LABELS = { head: 'Casque', neck: 'Collier', wrist: 'Bracelet', ring: 'Bague' };

// Protections de biome : clé de règle (terrain.js BIOME_RULES) → libellé de l'effet.
export const BIOME_PROTECTION_TEXT = {
    volcano: 'les cases brûlantes ne vous blessent plus',
    bamboo: 'les bambous n\'envahissent plus le plateau',
    snow: 'la glace ne gèle plus les cases',
    sea: 'la mer ne fait plus dériver les rangées'
};
export const BIOME_PROTECTION_LABEL = { volcano: 'Volcan', bamboo: 'Bambous', snow: 'Neige', sea: 'Mer' };

const piece = (id, slot, name, minLevel, rarity, description, bonus = {}) => ({ id, type: 'stuff', slot, name, minLevel, rarity, description, ...bonus });

export const allStuff = [
    // Casques
    piece('casque_de_cuir', 'head', 'Casque de cuir bouilli', 1, 'common', 'Un bonnet de cuir durci à la cire : mieux que rien.', { defBonus: 2 }),
    piece('casque_de_bronze', 'head', 'Casque de bronze des rizières', 6, 'uncommon', 'Un casque de bronze martelé, orné d\'un épi.', { defBonus: 4, maxHp: 10 }),
    piece('casque_de_jade', 'head', 'Diadème de jade', 14, 'rare', 'Un diadème de jade pâle qui garde l\'esprit clair.', { defBonus: 6, maxHp: 20 }),
    piece('casque_du_dragon', 'head', 'Heaume du dragon céleste', 28, 'legendary', 'Un heaume à cornes de dragon, chaud comme une braise.', { atkBonus: 4, defBonus: 8, maxHp: 40 }),
    // Colliers
    piece('collier_de_perles', 'neck', 'Collier de perles d\'eau douce', 3, 'common', 'Des perles de rivière enfilées sur un fil de soie.', { maxHp: 8 }),
    piece('collier_antivenin', 'neck', 'Collier d\'antivenin', 8, 'uncommon', 'Une dent de mangouste montée sur cuivre : les venins s\'y brisent.', { poisonResist: 50 }),
    piece('collier_du_tigre', 'neck', 'Collier du tigre blanc', 16, 'rare', 'Trois crocs de tigre blanc : l\'audace du chasseur.', { atkBonus: 5, maxHp: 15 }),
    piece('collier_du_phenix', 'neck', 'Collier du phénix', 30, 'legendary', 'Une plume de phénix sertie d\'or : le poison s\'y consume.', { maxHp: 50, poisonResist: 100 }),
    // Bracelets
    piece('bracelet_de_cuivre', 'wrist', 'Bracelet de cuivre', 2, 'common', 'Un jonc de cuivre poli.', { atkBonus: 2 }),
    piece('bracelet_de_tendon', 'wrist', 'Bracelet de tendon', 7, 'uncommon', 'Du tendon de buffle tressé : il raffermit le poignet.', { atkBonus: 3, defBonus: 2 }),
    piece('bracelet_antidote', 'wrist', 'Bracelet d\'antidote', 12, 'rare', 'Des graines d\'angélique dans un bracelet de jade.', { defBonus: 3, poisonResist: 60 }),
    piece('bracelet_de_foudre', 'wrist', 'Bracelet de foudre', 24, 'legendary', 'Un cercle de fer d\'orage qui crépite au moindre tir.', { atkBonus: 8, defBonus: 4 }),
    // Bagues
    piece('bague_de_bois', 'ring', 'Bague de bois de pêcher', 1, 'common', 'Une bague taillée dans un noyau de pêche, porte-bonheur.', { maxHp: 5 }),
    piece('bague_de_cuivre', 'ring', 'Bague de cuivre rouge', 5, 'uncommon', 'Un anneau de cuivre rouge gravé d\'une flèche.', { atkBonus: 2, maxHp: 8 }),
    piece('bague_de_sagesse', 'ring', 'Bague du lettré', 15, 'rare', 'Le sceau d\'un lettré : le calme avant le tir.', { defBonus: 3, maxHp: 25 }),
    piece('bague_de_l_immortel', 'ring', 'Bague de l\'immortel', 32, 'legendary', 'Une bague d\'ambre où dort un souffle d\'immortel.', { atkBonus: 6, defBonus: 6, maxHp: 40, poisonResist: 30 }),
    // Colliers de biome : uniquement en récompense de leur quête (world/collars.js), jamais en boutique ni en butin.
    piece('collier_obsidienne', 'neck', 'Collier d\'obsidienne froide', 4, 'rare', 'Une obsidienne qui ne chauffe jamais : la lave vous est indifférente.', { biomeProtect: 'volcano', maxHp: 10, quest: true }),
    piece('collier_jade_vert', 'neck', 'Collier de jade vert', 17, 'rare', 'Un jade vif comme une pousse : les bambous vous laissent passer.', { biomeProtect: 'bamboo', maxHp: 15, quest: true }),
    piece('collier_braise_d_orage', 'neck', 'Collier de braise d\'orage', 22, 'rare', 'Une braise captive dans le cristal : le givre n\'y accroche pas.', { biomeProtect: 'snow', maxHp: 20, quest: true }),
    piece('collier_voile_d_ombre', 'neck', 'Collier du voile d\'ombre', 37, 'legendary', 'Un fil d\'ombre tressé aux racines de Fusang : les regards glissent sur vous.', { stealth: true, maxHp: 30, quest: true }),
    piece('collier_perle_des_marees', 'neck', 'Collier de perle des marées', 32, 'rare', 'Une perle noire qui calme les courants.', { biomeProtect: 'sea', maxHp: 25, quest: true })
];

export const getStuffById = id => allStuff.find(s => s.id === id) || null;
export const isStuff = obj => obj?.type === 'stuff';

// Stuff en vente ou en butin : tout sauf les colliers de quête.
export const lootableStuff = () => allStuff.filter(s => !s.quest);

// Collier de quête qui protège d'un biome donné.
export const collarForBiome = biome => allStuff.find(s => s.biomeProtect === biome) || null;

export function describeStuff(stuff) {
    if (!stuff) return '';
    return [
        stuff.atkBonus ? `Atk +${stuff.atkBonus}` : '',
        stuff.defBonus ? `Déf +${stuff.defBonus}` : '',
        stuff.maxHp ? `PV max +${stuff.maxHp}` : '',
        stuff.poisonResist ? (stuff.poisonResist >= 100 ? 'Immunisé au poison' : `Poison −${stuff.poisonResist} %`) : '',
        stuff.biomeProtect ? `Protège : ${BIOME_PROTECTION_LABEL[stuff.biomeProtect]}` : '',
        stuff.stealth ? 'Indétectable : évite les combats (sauf boss)' : ''
    ].filter(Boolean).join(' • ');
}

// Prix de base d'un stuff (les marchands y appliquent PRICE_MULT, voir merchants.js).
const STUFF_RARITY_PRICE = { common: 10, uncommon: 22, rare: 45, legendary: 100 };
export const baseStuffPrice = stuff => Math.floor(stuff.minLevel * (STUFF_RARITY_PRICE[stuff.rarity] || 10));

// ── État du héros ───────────────────────────────────────────────────────────

export const emptyStuff = () => ({ head: null, neck: null, wrist: null, ring: null });

// Garantit `hero.stuff` / `hero.stuffOwned` (anciennes sauvegardes) et écarte les ids inconnus.
export function normalizeStuff(hero) {
    if (!hero) return hero;
    hero.stuffOwned = Array.isArray(hero.stuffOwned) ? [...new Set(hero.stuffOwned.filter(id => getStuffById(id)))] : [];
    const worn = emptyStuff();
    STUFF_SLOTS.forEach(slot => {
        const id = hero.stuff?.[slot];
        const s = id && getStuffById(id);
        if (s && s.slot === slot && hero.stuffOwned.includes(id)) worn[slot] = id;
    });
    hero.stuff = worn;
    return hero;
}

// Pièces portées (fiches du catalogue).
export function wornStuff(hero) {
    return STUFF_SLOTS.map(slot => getStuffById(hero?.stuff?.[slot])).filter(Boolean);
}

// Totaux des bonus portés : { atk, def, maxHp, poisonResist (0–100), biomes: Set }.
export function stuffTotals(hero) {
    const totals = { atk: 0, def: 0, maxHp: 0, poisonResist: 0, stealth: false, biomes: new Set() };
    wornStuff(hero).forEach(s => {
        totals.atk += s.atkBonus || 0;
        totals.def += s.defBonus || 0;
        totals.maxHp += s.maxHp || 0;
        totals.poisonResist += s.poisonResist || 0;
        if (s.biomeProtect) totals.biomes.add(s.biomeProtect);
        if (s.stealth) totals.stealth = true;
    });
    totals.poisonResist = Math.min(100, totals.poisonResist);
    return totals;
}

// Collier d'ombre : les ennemis (hors boss) ne détectent plus le héros et les hautes herbes n'attirent plus de combat.
export const hasStealth = hero => stuffTotals(hero).stealth;

export const protectsFromBiome = (hero, biomeRuleKey) => stuffTotals(hero).biomes.has(biomeRuleKey);

// Ajoute un stuff à la collection (une seule fois). Renvoie la fiche si c'est un nouvel objet, sinon null.
export function grantStuff(hero, id) {
    const s = getStuffById(id);
    if (!s) return null;
    normalizeStuff(hero);
    if (hero.stuffOwned.includes(id)) return null;
    hero.stuffOwned.push(id);
    return s;
}

// Les PV max du stuff s'ajoutent à `maxHp` quand on le porte et s'en retirent quand on l'ôte.
function shiftMaxHp(hero, delta) {
    if (!delta) return;
    hero.maxHp = Math.max(1, (hero.maxHp || 0) + delta);
    hero.hp = delta > 0 ? Math.min(hero.maxHp, (hero.hp || 0) + delta) : Math.max(1, Math.min(hero.hp || 1, hero.maxHp));
}

/** Porte un stuff possédé (remplace la pièce du même emplacement). Renvoie { ok, message }. */
export function equipStuff(hero, id) {
    normalizeStuff(hero);
    const s = getStuffById(id);
    if (!s || !hero.stuffOwned.includes(id)) return { ok: false, message: 'Vous ne possédez pas cet objet.' };
    if ((hero.level || 1) < s.minLevel) return { ok: false, message: `${s.name} nécessite le niveau ${s.minLevel}.` };
    if (hero.stuff[s.slot] === id) return { ok: true, message: `${s.name} est déjà porté.` };
    unequipStuff(hero, s.slot);
    hero.stuff[s.slot] = id;
    shiftMaxHp(hero, s.maxHp || 0);
    return { ok: true, message: `${s.name} équipé.`, stuff: s };
}

/** Retire la pièce portée à un emplacement. */
export function unequipStuff(hero, slot) {
    normalizeStuff(hero);
    const s = getStuffById(hero.stuff[slot]);
    if (!s) return { ok: false, message: 'Rien à retirer.' };
    hero.stuff[slot] = null;
    shiftMaxHp(hero, -(s.maxHp || 0));
    return { ok: true, message: `${s.name} retiré.`, stuff: s };
}

// ── Poison ──────────────────────────────────────────────────────────────────

// Ennemis dont les coups peuvent empoisonner le héros.
// Copies d'ennemis nommés (copyOf dans enemies.catalog.json) : elles gardent le venin de leur gabarit d'origine.
export const VENOMOUS_TEMPLATES = ['jiaolong', 'crapaud_boue', 'wen_shen', 'lingzhi_maudit', 'huli_jing',
    'sun_1', 'sun_3', 'sun_8', 'garde_maree', 'petit_gui', 'corbeau_demon', 'singe_demon', 'carpe_doree'];
export const POISON_CHANCE = 0.35;
export const POISON_TURNS = 3;

export const isVenomous = templateId => VENOMOUS_TEMPLATES.includes(templateId);

// Dégâts de poison par tour après résistance (0 si le stuff immunise).
export function poisonDamagePerTurn(hero, base) {
    const resist = stuffTotals(hero).poisonResist;
    return Math.max(0, Math.round(base * (1 - resist / 100)));
}

/**
 * Empoisonne le héros (statusEffects.poisoned = tours, poisonDamage = dégâts/tour). Renvoie les dégâts/tour posés (0 = protégé).
 */
export function inflictPoison(hero, baseDamage, turns = POISON_TURNS) {
    const dmg = poisonDamagePerTurn(hero, Math.max(1, Math.floor(baseDamage || 1)));
    if (dmg <= 0) return 0;
    hero.statusEffects = hero.statusEffects || {};
    hero.statusEffects.poisoned = Math.max(hero.statusEffects.poisoned || 0, turns);
    hero.statusEffects.poisonDamage = Math.max(hero.statusEffects.poisonDamage || 0, dmg);
    return dmg;
}

// ── Butin ───────────────────────────────────────────────────────────────────

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

/**
 * Tire (ou non) un stuff que le héros ne possède pas encore et peut porter ou presque (niveau + `levelBonus`).
 * @param {object} owner  { level, stuffOwned }
 * @param {{ chance: number, rarity: object, levelBonus?: number }} cfg  chance de butin, poids de rareté
 * @returns {object|null} la fiche tirée
 */
export function rollStuffDrop(owner, { chance, rarity, levelBonus = 0 }, rng = Math.random) {
    if (rng() >= chance) return null;
    const owned = new Set(owner?.stuffOwned || []);
    const maxLevel = Math.max(1, owner?.level || 1) + levelBonus;
    const entries = Object.entries(rarity).filter(([, w]) => w > 0);
    let r = rng() * entries.reduce((sum, [, w]) => sum + w, 0);
    let wanted = entries[entries.length - 1][0];
    for (const [key, w] of entries) if ((r -= w) < 0) { wanted = key; break; }
    const pool = lootableStuff().filter(s => s.minLevel <= maxLevel && !owned.has(s.id));
    // la rareté voulue, sinon d'un cran en dessous
    for (let rank = RARITY_RANK[wanted]; rank >= 0; rank--) {
        const same = pool.filter(s => RARITY_RANK[s.rarity] === rank);
        if (same.length) return same[Math.floor(rng() * same.length)];
    }
    return null;
}

// Paliers de coffre (chestLoot.js) → butin de stuff.
export const CHEST_STUFF_DROP = {
    1: { chance: 0.08, rarity: { common: 80, uncommon: 20 } },
    2: { chance: 0.15, rarity: { common: 40, uncommon: 45, rare: 15 } },
    3: { chance: 0.25, rarity: { uncommon: 40, rare: 50, legendary: 10 } },
    4: { chance: 0.4, rarity: { rare: 60, legendary: 40 }, levelBonus: 4 }
};
// Victoire ordinaire : 6 % de chance d'un stuff commun ou peu commun ; contre un ennemi de niveau supérieur, un stuff rare garanti.
export const VICTORY_STUFF_DROP = { chance: 0.06, rarity: { common: 70, uncommon: 30 } };
export const OVERLEVELED_STUFF_DROP = { chance: 1, rarity: { rare: 70, legendary: 30 } };
