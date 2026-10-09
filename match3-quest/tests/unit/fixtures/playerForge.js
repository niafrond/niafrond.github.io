// Forge de JOUEURS sauvegardés à des moments précis de la partie (début, niveau intermédiaire, arène, haut niveau…).
// Sert aux tests de mécaniques (savedGameMechanics.test.js) : on fabrique l'objet `player` tel que le jeu le sauvegarde,
// puis son export fichier (format 2) et sa relecture, avec les VRAIS identifiants et données du jeu.
//
// Aucun nombre de règle n'est recopié : niveaux, XP, croissance, coûts de sorts, armes, objets… viennent des modules du jeu.
// Les rares constantes définies seulement dans game.js (DOM, non importable sous Node) sont lues dans son code source.
//
// spells.js et enemies.js chargent leur catalogue JSON par XMLHttpRequest synchrone : on le simule ici (lecture du fichier)
// AVANT d'importer ces modules (imports dynamiques), sinon le catalogue de sorts serait vide sous Node.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

export const GAME_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readGame = file => readFileSync(join(GAME_ROOT, file), 'utf8');

if (typeof globalThis.XMLHttpRequest === 'undefined') {
    globalThis.XMLHttpRequest = class XhrDisque {
        open(method, url) { this.file = basename(String(url).split('?')[0]); }
        send() {
            try { this.responseText = readFileSync(join(GAME_ROOT, this.file), 'utf8'); this.status = 200; } catch { this.status = 404; }
        }
    };
}
// Lecture de fichier simulée (le test saveManager.test.js fait de même) : un « fichier » est { name, content }.
if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class FileReaderSimule {
        readAsText(file) { setTimeout(() => this.onload && this.onload({ target: { result: file.content } }), 0); }
    };
}

const spellsMod = await import('../../../spells.js');
const weaponsMod = await import('../../../weapons.js');
const itemsMod = await import('../../../items.js');
const classesMod = await import('../../../classes.js');
const xpMod = await import('../../../experience.js');
const progMod = await import('../../../progression.js');
const attrMod = await import('../../../attributes.js');
const saveMod = await import('../../../saveManager.js');
const storyMod = await import('../../../story.js');

export const { allSpells, allClassSpells, getSpellById, getClassSpellById } = spellsMod;
export const { allWeapons, getWeaponById } = weaponsMod;
export const { allItems } = itemsMod;
export const { playerClasses } = classesMod;
export const { SCREENS, REGION_UNLOCK_LEVEL } = storyMod;
export const { exportSaveToFile, importSaveFromFile } = saveMod;
export const GAME_VERSION = '1.0.0-test';

// ── Constantes qui ne vivent que dans game.js (lues dans le code source, jamais recopiées) ─────────────────────────────
function sourceNumber(file, regex, label) {
    const m = readGame(file).match(regex);
    if (!m) throw new Error(`playerForge : constante introuvable dans ${file} (${label})`);
    return Number(m[1]);
}
export const LEVEL_UP_MAX_HP_GAIN = sourceNumber('game.js', /const LEVEL_UP_MAX_HP_GAIN = (\d+)/, 'LEVEL_UP_MAX_HP_GAIN');
export const BASE_MANA_CAP = sourceNumber('game.js', /const BASE_MANA_CAP = (\d+)/, 'BASE_MANA_CAP');
export const HIGH_SPELL_FROM_LEVEL = sourceNumber('game.js', /const HIGH_SPELL_FROM_LEVEL = (\d+)/, 'HIGH_SPELL_FROM_LEVEL');
export const NEW_PLAYER_HP = sourceNumber('game.js', /export let player = \{[\s\S]*?\bmaxHp:\s*(\d+)/, 'maxHp du joueur neuf');
export const NEW_PLAYER_ATTACK = sourceNumber('game.js', /export let player = \{[\s\S]*?\battack:\s*(\d+)/, 'attack du joueur neuf');
export const MAX_ACTIVE_SPELLS = 4;   // « sorts équipés (max 4) » : commentaire de game.js

export const CLASS_IDS = Object.keys(playerClasses);
export const MANA_COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
// Aptitudes (game.js > allAbilities, non importable sous Node) : identifiants seulement.
export const ABILITY_IDS = ['fireAffinity', 'iceAffinity', 'natureAffinity', 'stormAffinity', 'shadowAffinity', 'elementalist',
    'fireMastery', 'iceMastery', 'natureMastery', 'stormMastery', 'shadowMastery'];

export const costOf = spell => (typeof spell.cost === 'object' && spell.cost ? { ...spell.cost } : { [spell.color]: spell.cost });
export const costColors = spell => Object.keys(costOf(spell));
export const totalCost = spell => Object.values(costOf(spell)).reduce((a, b) => a + b, 0);

// ── Fonctions de game.js exécutées telles quelles ───────────────────────────────────────────────────────────────────────
// game.js dépend du DOM et ne s'importe pas sous Node : on en extrait le texte de quelques fonctions PURES (sans accès au DOM ni
// à l'état global) et on les évalue. On teste ainsi le vrai code du jeu ; si une fonction est renommée ou prend une dépendance,
// l'extraction échoue bruyamment (signal : l'extraire dans un module pur, par exemple spellRules.js).
export function extractGameFunctions(names, preamble = '') {
    const src = readGame('game.js');
    const parts = names.map(name => {
        const m = new RegExp(`^(?:export )?function ${name}\\(`, 'm').exec(src);
        if (!m) throw new Error(`playerForge : fonction introuvable dans game.js : ${name}`);
        const end = src.indexOf('\n}\n', m.index);
        return src.slice(m.index, end + 3).replace(/^export /, '');
    });
    return new Function(`${preamble}\n${parts.join('\n')}\nreturn { ${names.join(', ')} };`)();
}
export const gameRules = extractGameFunctions(
    ['getUnlockedSpellCap', 'buildUnlockedSpellsList', 'canEntityCastSpell', 'consumeSpellMana', 'spellColorsOf'],
    `const HIGH_SPELL_FROM_LEVEL = ${HIGH_SPELL_FROM_LEVEL};`
);

// ── Sorts : règle de déblocage de game.js (updateAvailableSpells), appliquée avec les vrais modules ───────────────────────
// Sorts génériques de niveau <= niveau du joueur + sorts de la classe, filtrés par buildUnlockedSpellsList (game.js).
export function unlockedSpells(classId, level) {
    const pool = [...spellsMod.getSpellsByLevel(level), ...(classId ? classesMod.getClassSpells(classId, level) : [])];
    return gameRules.buildUnlockedSpellsList(pool, level);
}

export function spellCategory(spell) {
    if (spell.type === 'advanced') return 'advanced';
    if (spell.class) return 'class';
    if (costColors(spell).length >= 2) return 'multi';
    return 'single';
}

// Sorts équipés par défaut : un sort avancé, un multi-mana, un sort de classe, un sort simple, puis les plus puissants restants.
export function defaultLoadout(classId, level) {
    const pool = unlockedSpells(classId, level).sort((a, b) => b.minLevel - a.minLevel);
    const picked = [];
    for (const cat of ['advanced', 'multi', 'class', 'single']) {
        const s = pool.find(x => spellCategory(x) === cat && !picked.includes(x));
        if (s) picked.push(s);
    }
    for (const s of pool) if (picked.length < MAX_ACTIVE_SPELLS && !picked.includes(s)) picked.push(s);
    return picked.slice(0, MAX_ACTIVE_SPELLS);
}

// ── Armes ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const weaponsUpTo = (level, pred = () => true) => allWeapons.filter(w => w.minLevel <= level && pred(w));
export const bestWeapon = (level, pred = () => true) => weaponsUpTo(level, pred).sort((a, b) => b.damage - a.damage)[0] || null;
export const oneHandedWeapons = level => weaponsUpTo(level, w => !w.twoHanded && !w.playerOnly);
export const twoHandedWeapons = level => weaponsUpTo(level, w => w.twoHanded);

// ── Objets ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export const reusableItem = (id, overrides = {}) => {
    const ref = allItems.find(i => i.id === id);
    if (!ref || ref.type !== 'reusable') throw new Error(`objet rechargeable inconnu : ${id}`);
    return { ...ref, effect: { ...ref.effect }, chargesLeft: ref.chargesPerCycle, rechargeLeft: 0, ...overrides };
};
export const shieldItem = id => {
    const ref = allItems.find(i => i.id === id && i.type === 'shield');
    if (!ref) throw new Error(`bouclier inconnu : ${id}`);
    return { ...ref };
};

// ── Exploration minimale : écrans visités pour N terrains (REGION_UNLOCK_LEVEL donne l'ordre des terrains) ─────────────
export const REGION_ORDER = Object.keys(REGION_UNLOCK_LEVEL);
export function explorationForRegions(regionCount, extra = {}) {
    const regions = REGION_ORDER.slice(0, Math.max(1, regionCount));
    const visited = Object.values(SCREENS).filter(s => regions.includes(s.region) && !s.interior && !s.arena).map(s => s.id);
    const last = Object.values(SCREENS).find(s => s.region === regions[regions.length - 1] && !s.interior && !s.arena);
    return { screenId: last.id, x: last.spawn.x, y: last.spawn.y, visitedScreens: visited, defeated: [], openedChests: [], quests: {},
        talked: [], waypoints: [], arena: { cleared: [], best: {}, wins: 0 }, ...extra };
}

// ── Joueur ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const ATTRIBUTE_EFFECT_ON_STATS = {   // application d'un point (game.js > applyAttributeBonus)
    strength: p => { p.attack += 1; }, morale: p => { p.attack += 1; }, agility: p => { p.defense += 1; },
    stamina: p => { p.maxHp += 1; p.hp = Math.min(p.maxHp, p.hp + 1); }, intelligence: () => {}
};

/**
 * Fabrique un joueur tel que le jeu le sauvegarde. Le niveau est atteint par la vraie courbe d'XP (addXP), les récompenses de niveau
 * (PV, points d'attribut, croissance innée) sont celles de game.js ; les points sont dépensés par priorité de classe.
 * @param {Object} [o]
 * @param {string} [o.classId='templar'] @param {number} [o.level=1] @param {string[]} [o.weaponIds] @param {string} [o.equippedWeaponId]
 * @param {string} [o.leftHandId] arme (non deux mains) en main gauche @param {string} [o.shieldId] bouclier en main gauche
 * @param {string[]} [o.spellIds] sorts équipés @param {string[]} [o.abilities] @param {Object} [o.statusEffects] @param {number} [o.gold]
 * @param {string[]} [o.inventoryIds] objets rechargeables @param {number} [o.unspent] points d'attribut non dépensés à garder
 * @param {Object} [o.extra] champs ajoutés tels quels au joueur (bossLossStreak, merchantSold…)
 * @param {number} [o.regions] terrains visités @param {Object} [o.exploration] @param {number} [o.hpPct] PV actuels (fraction des PV max)
 */
export function forgePlayer(o = {}) {
    const classId = o.classId === null ? null : (o.classId || 'templar');
    const cls = classId ? playerClasses[classId] : null;
    if (classId && !cls) throw new Error(`classe inconnue : ${classId}`);
    const level = Math.max(1, Math.min(o.level || 1, xpMod.MAX_LEVEL));

    const player = {
        name: o.name || 'Hou Yi', class: classId,
        hp: NEW_PLAYER_HP, maxHp: NEW_PLAYER_HP, attack: NEW_PLAYER_ATTACK, defense: 0,
        mana: Object.fromEntries(MANA_COLORS.map(c => [c, 0])), maxMana: BASE_MANA_CAP,
        manaCaps: Object.fromEntries(MANA_COLORS.map(c => [c, BASE_MANA_CAP])),
        level: 1, xp: 0, xpToNextLevel: 0,
        attributes: Object.fromEntries(attrMod.ATTRIBUTE_ORDER.map(a => [a, 0])),
        unspentLevelPoints: 0, abilities: [], statusEffects: {}, inventory: [], activeInventoryIndex: null,
        gold: o.gold ?? 0, torch: false, mount: null, defeatedBossTiers: [], combatPoints: 0, bonusTurn: 0,
        worldMap: { currentZoneId: null, visitedZoneIds: [] }
    };
    xpMod.initializeXP(player);
    Object.entries(cls?.startingStats || {}).forEach(([a, n]) => { player.attributes[a] += n; });   // main.js : stats de départ

    // Montée de niveaux : vraie courbe d'XP, récompenses de game.js (applyLevelUpRewards)
    if (level > 1) {
        const res = xpMod.addXP(player, xpMod.getXPRequiredForLevel(level) - player.xp);
        player.unspentLevelPoints += res.levelsGained;
        player.maxHp += res.levelsGained * LEVEL_UP_MAX_HP_GAIN;
        progMod.applyGrowth(player);
        player.hp = player.maxHp;
    } else {
        player.growthLevel = 1;
    }

    // Dépense des points d'attribut : priorité aux attributs de départ de la classe, puis à tour de rôle.
    const priority = [...Object.keys(cls?.startingStats || {}), ...attrMod.ATTRIBUTE_ORDER.filter(a => !(cls?.startingStats || {})[a])];
    const keep = Math.min(o.unspent || 0, player.unspentLevelPoints);
    let spendable = player.unspentLevelPoints - keep;
    for (let i = 0; spendable > 0; i++, spendable--) {
        const attr = priority[i % priority.length];
        player.attributes[attr] += 1;
        ATTRIBUTE_EFFECT_ON_STATS[attr](player);
    }
    player.unspentLevelPoints = keep;

    // Armes
    const startWeapon = getWeaponById(cls?.startingWeaponId || classesMod.DEFAULT_STARTING_WEAPON_ID);
    const weaponIds = o.weaponIds || [startWeapon.id];
    player.weapons = weaponIds.map(id => { const w = getWeaponById(id); if (!w) throw new Error(`arme inconnue : ${id}`); return w; });
    player.equippedWeapon = getWeaponById(o.equippedWeaponId || weaponIds[0]);
    player.equipment = { rightHand: player.equippedWeapon, leftHand: null, item: null };
    if (o.shieldId) player.equipment.leftHand = shieldItem(o.shieldId);
    if (o.leftHandId) {
        const w = getWeaponById(o.leftHandId);
        if (w.twoHanded) throw new Error('une arme à deux mains ne va pas en main gauche');
        player.equipment.leftHand = w;
        if (!player.weapons.some(x => x.id === w.id)) player.weapons.push(w);
    }

    // Sorts
    const loadout = o.spellIds ? o.spellIds.map(id => getSpellById(id) || getClassSpellById(id)) : defaultLoadout(classId, level);
    if (loadout.some(s => !s)) throw new Error('sort inconnu dans spellIds');
    player.activeSpells = loadout;
    player.spells = player.activeSpells;
    player.availableSpells = unlockedSpells(classId, level);

    player.abilities = [...(o.abilities || [])];
    player.statusEffects = { ...(o.statusEffects || {}) };
    player.inventory = (o.inventoryIds || []).map(id => reusableItem(id));
    if (player.inventory.length) player.activeInventoryIndex = 0;
    if (o.hpPct !== undefined) player.hp = Math.max(1, Math.floor(player.maxHp * o.hpPct));
    player.exploration = o.exploration || explorationForRegions(o.regions || 1);
    return Object.assign(player, o.extra || {});
}

// ── Jalons ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Début de partie : niveau 1, arme de départ de la classe, aucun sort débloqué, village de départ seulement. */
export const forgeNewGame = (classId = 'templar') => forgePlayer({ classId, level: 1, gold: 0 });

/** Niveau 5 : premiers hybrides, un objet rechargeable, un peu d'or, une aptitude. */
export const forgeEarlyGame = (classId = 'templar') => forgePlayer({
    classId, level: 5, gold: 120, regions: 2, abilities: ['fireAffinity'], inventoryIds: ['healthPotion'],
    weaponIds: [(oneHandedWeapons(5)[0]).id]
});

/** Niveau 10 : sorts avancés à 3-4 couleurs en vue, bouclier en main gauche, main droite en arc léger. */
export const forgeMidGame = (classId = 'templar') => forgePlayer({
    classId, level: 10, gold: 900, regions: 3, shieldId: 'dragon_shield', abilities: ['iceAffinity', 'iceMastery'],
    inventoryIds: ['honey_vial', 'energy_stone'],
    weaponIds: [bestWeapon(10, w => !w.twoHanded && !w.playerOnly).id]
});

/** Niveau 15, 3e terrain (Bambous) atteint : l'arène est ouverte. Arme à deux mains, objets réutilisables entamés. */
export const forgeArenaUnlock = (classId = 'templar') => {
    const heavy = bestWeapon(15, w => w.twoHanded);
    const p = forgePlayer({
        classId, level: 15, gold: 2400, regions: REGION_ORDER.indexOf('bambous') + 1,
        weaponIds: [bestWeapon(15, w => !w.twoHanded && !w.playerOnly).id, heavy.id],
        equippedWeaponId: heavy.id, abilities: ['elementalist', 'fireMastery'],
        inventoryIds: ['healthPotion', 'power_talisman', 'honey_vial'], unspent: 2
    });
    p.inventory[0].chargesLeft = 0; p.inventory[0].rechargeLeft = 3;   // une potion vide, en recharge
    return p;
};

/** Niveau 30 : sorts multi-mana (hybrides, 3 à 5 couleurs, avancés), arcs lourds à deux mains, double arme main droite / gauche. */
export const forgeLateGame = (classId = 'templar') => {
    const main = bestWeapon(30, w => !w.twoHanded && !w.playerOnly);
    const off = oneHandedWeapons(30).filter(w => w.id !== main.id).sort((a, b) => b.damage - a.damage)[0];
    return forgePlayer({
        classId, level: 30, gold: 18000, regions: 7, weaponIds: [main.id, bestWeapon(30, w => w.twoHanded).id],
        equippedWeaponId: main.id, leftHandId: off.id,
        abilities: ['elementalist', 'natureMastery', 'shadowAffinity'], inventoryIds: ['energy_stone', 'power_talisman', 'protective_sachet'],
        statusEffects: { reflectDamage: 3, reflectDamagePercent: 30, drainOnHit: 2, drainOnHitAmount: 4 }, hpPct: 0.6
    });
};

/** Niveau 50 : arcs lourds de légende, tous les sorts multi-mana de haut niveau débloqués. */
export const forgeEndGame = (classId = 'templar') => {
    const heavy = bestWeapon(50, w => w.twoHanded);
    return forgePlayer({
        classId, level: 50, gold: 90000, regions: REGION_ORDER.length, weaponIds: [heavy.id], equippedWeaponId: heavy.id,
        abilities: ['elementalist'], inventoryIds: ['energy_stone']
    });
};

/** Niveau maximal (MAX_LEVEL) : XP plafonnée, le meilleur arc du jeu. */
export const forgeMaxLevel = (classId = 'templar') => {
    const heavy = bestWeapon(xpMod.MAX_LEVEL, w => w.twoHanded);
    return forgePlayer({ classId, level: xpMod.MAX_LEVEL, gold: 250000, regions: REGION_ORDER.length, weaponIds: [heavy.id], equippedWeaponId: heavy.id });
};

/** Niveau 15, arène déjà entamée : cercles 1 et 2 terminés (porte du cercle 3 ouverte), records et victoires. */
export function forgeArenaVeteran(classId = 'templar') {
    const p = forgeArenaUnlock(classId);
    p.exploration.arena = { cleared: [1, 2], best: { 1: 4, 2: 4, 3: 2 }, wins: 11, returnTo: null };
    return p;
}

/** Joueur dans le parvis de l'arène (point de retour mémorisé : le village du 3e terrain). */
export function forgeInArena(classId = 'templar') {
    const p = forgeArenaVeteran(classId);
    const back = { screenId: p.exploration.screenId, x: p.exploration.x, y: p.exploration.y };
    const hall = SCREENS.arena_hall;
    Object.assign(p.exploration, { screenId: hall.id, x: hall.spawn.x, y: hall.spawn.y });
    p.exploration.arena.returnTo = back;
    return p;
}

/** Joueur qui vient de perdre trois fois de suite contre le même boss (conseil de progression dû), points à dépenser et or en poche. */
export const forgeBossStreak = (classId = 'templar', bossId = 'sun_7') => forgePlayer({
    classId, level: 11, gold: 350, regions: 7, unspent: 3, extra: { bossLossStreak: { id: bossId, count: 3 } }
});

export const MILESTONES = [
    { id: 'debut', label: 'début de partie (niveau 1)', level: 1, forge: forgeNewGame },
    { id: 'niveau5', label: 'niveau 5', level: 5, forge: forgeEarlyGame },
    { id: 'niveau10', label: 'niveau 10', level: 10, forge: forgeMidGame },
    { id: 'arene', label: 'niveau 15, arène débloquée', level: 15, forge: forgeArenaUnlock },
    { id: 'niveau30', label: 'niveau 30, sorts multi-mana', level: 30, forge: forgeLateGame },
    { id: 'niveau50', label: 'niveau 50', level: 50, forge: forgeEndGame },
    { id: 'max', label: 'niveau maximal', level: xpMod.MAX_LEVEL, forge: forgeMaxLevel }
];

// ── Export / import fichier (format 2) ──────────────────────────────────────────────────────────────────────────────────
/** Exporte puis rend { result, json, data } (data = contenu JSON du fichier). */
export async function exportPlayer(player, version = GAME_VERSION) {
    const result = exportSaveToFile(player, version);
    if (!result.success) throw new Error(result.message);
    const json = await result.blob.text();
    return { result, json, data: JSON.parse(json) };
}
export const fileOf = (json, name = 'sauvegarde.json') => ({ name, content: json });
export const importJson = json => importSaveFromFile(fileOf(json));

/** Export puis relecture : renvoie { player, metadata, data } du joueur relu. */
export async function roundTrip(player) {
    const { json, data } = await exportPlayer(player);
    const imported = await importJson(json);
    if (!imported.success) throw new Error(imported.message);
    return { player: imported.player, metadata: imported.metadata, data, json };
}

/** Sauvegarde d'AVANT le format 2 : pas de `format`, objet joueur complet (armes et sorts en objets). */
export function legacyFormat1Json(player, overrides = {}) {
    const metadata = { version: '0.9.0', timestamp: 1700000000000, playerName: player.name, level: player.level, progress: 'ancienne partie' };
    return JSON.stringify({ metadata, player: { ...JSON.parse(JSON.stringify(player)), ...overrides } });
}
