// Gestionnaire de sauvegarde/chargement de parties (export/import JSON)
import { allItems, toReusable } from './items.js';
import { getWeaponById } from './weapons.js';
import { getSpellById, getClassSpellById } from './spells.js';
import { MAX_LEVEL } from './experience.js';

// Format 2 : export compact (voir sanitizePlayer). Les sauvegardes sans `format` contiennent l'objet joueur complet.
const SAVE_FORMAT = 2;

/**
 * Métadonnées de sauvegarde
 * @typedef {Object} SaveMetadata
 * @property {string} version - Version du jeu
 * @property {number} timestamp - Moment de la sauvegarde (ms depuis epoch)
 * @property {string} playerName - Nom du héros
 * @property {number} level - Niveau du joueur
 * @property {string} progress - Progression (ex: "Quête 5: Le Dragon")
 */

/**
 * Exporte la partie actuelle en fichier JSON
 * @param {Object} player - L'objet joueur complet
 * @param {string} gameVersion - Version du jeu (ex: "1.0.0")
 * @returns {Object} { success, message, blob?, filename? }
 */
export function exportSaveToFile(player, gameVersion = "1.0.0") {
    try {
        if (!player) {
            return { success: false, message: "Aucun joueur à exporter" };
        }

        // Créer les métadonnées
        const metadata = {
            version: gameVersion,
            format: SAVE_FORMAT,
            timestamp: Date.now(),
            playerName: player.name || "Héros",
            level: player.level || 1,
            progress: getProgressString(player)
        };

        // Créer l'objet de sauvegarde
        const saveData = {
            metadata,
            player: sanitizePlayer(player)
        };

        // Convertir en JSON
        const json = JSON.stringify(saveData);
        const blob = new Blob([json], { type: 'application/json' });

        // Générer un nom de fichier
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
        const filename = `match3quest-save-${dateStr}-${timeStr}.json`;

        return {
            success: true,
            message: `Sauvegarde exportée: ${filename}`,
            blob,
            filename
        };
    } catch (error) {
        return { success: false, message: `Erreur lors de l'export: ${error.message}` };
    }
}

/** Taille maximale d'un fichier de sauvegarde importé (un export compact fait quelques dizaines de ko). */
export const MAX_SAVE_FILE_BYTES = 1024 * 1024;
const MAX_NAME_LENGTH = 40;
const MAX_TEXT_LENGTH = 200;
const MAX_ID_LENGTH = 100;
const MAX_LIST_LENGTH = 2000;
const MAX_INVENTORY = 500;
const MAX_STAT = 1e15;   // large, mais sûr pour les entiers JavaScript
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Reviver JSON : écarte les clés qui permettraient une pollution de prototype. */
function dropForbiddenKeys(key, value) {
    return FORBIDDEN_KEYS.has(key) ? undefined : value;
}

/** Texte sûr : chaîne tronquée, sans caractères de contrôle ni chevrons (jamais interprété comme du HTML). Null si ce n'est pas une chaîne. */
export function cleanText(value, max = MAX_TEXT_LENGTH) {
    if (typeof value !== 'string') return null;
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

/** Nombre fini borné, ou undefined (le jeu applique alors sa valeur par défaut). */
function cleanNumber(value, min, max, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    const n = Math.min(max, Math.max(min, value));
    return integer ? Math.round(n) : n;
}

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Tableau d'identifiants (chaînes bornées). */
function cleanIdList(value, maxLength = MAX_LIST_LENGTH) {
    if (!Array.isArray(value)) return undefined;
    return value.slice(0, maxLength).map(v => cleanText(v, MAX_ID_LENGTH)).filter(Boolean);
}

/** Écrase `obj[key]` par sa version nettoyée, ou supprime le champ si invalide. */
function assign(obj, key, cleaned) {
    if (cleaned === undefined || cleaned === null) delete obj[key];
    else obj[key] = cleaned;
}

/**
 * Importe une sauvegarde depuis un fichier JSON
 * @param {File} file - Le fichier de sauvegarde
 * @returns {Promise<Object>} { success, message, player?, metadata? }
 */
export async function importSaveFromFile(file) {
    return new Promise((resolve) => {
        try {
            if (!file) {
                resolve({ success: false, message: "Aucun fichier sélectionné" });
                return;
            }

            if (!file.name.endsWith('.json')) {
                resolve({ success: false, message: "Le fichier doit être un JSON" });
                return;
            }

            if (typeof file.size === 'number' && file.size > MAX_SAVE_FILE_BYTES) {
                resolve({ success: false, message: "Fichier trop volumineux (1 Mo maximum)" });
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const json = event.target.result;
                    if (typeof json !== 'string' || json.length > MAX_SAVE_FILE_BYTES) {
                        resolve({ success: false, message: "Fichier trop volumineux (1 Mo maximum)" });
                        return;
                    }
                    const saveData = JSON.parse(json, dropForbiddenKeys);

                    // Valider la structure
                    if (!isPlainObject(saveData) || !isPlainObject(saveData.metadata) || !isPlainObject(saveData.player)) {
                        resolve({ success: false, message: "Format de sauvegarde invalide" });
                        return;
                    }

                    // Valider les métadonnées
                    if (!validateMetadata(saveData.metadata)) {
                        resolve({ success: false, message: "Métadonnées de sauvegarde corrompues" });
                        return;
                    }

                    // Valider et nettoyer le joueur
                    const raw = saveData.metadata.format >= 2 ? expandPlayer(saveData.player) : saveData.player;
                    const player = validateAndRestorePlayer(raw);
                    if (!player) {
                        resolve({ success: false, message: "Données du joueur corrompues" });
                        return;
                    }

                    const metadata = saveData.metadata;
                    metadata.playerName = cleanText(metadata.playerName, MAX_NAME_LENGTH) || player.name;
                    metadata.progress = cleanText(metadata.progress) || '';
                    metadata.level = player.level;

                    resolve({
                        success: true,
                        message: `Sauvegarde importée: ${metadata.playerName} (niveau ${metadata.level})`,
                        player,
                        metadata
                    });
                } catch (error) {
                    resolve({ success: false, message: `Erreur lors de la lecture du fichier: ${error.message}` });
                }
            };

            reader.readAsText(file);
        } catch (error) {
            resolve({ success: false, message: `Erreur lors de l'import: ${error.message}` });
        }
    });
}

/**
 * Déclenche le téléchargement d'un fichier de sauvegarde
 * @param {Blob} blob - Le contenu du fichier
 * @param {string} filename - Le nom du fichier
 */
export function downloadSaveFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// === Fonctions utilitaires ===

/**
 * Obtient la chaîne de progression actuelle
 * @param {Object} player - L'objet joueur
 * @returns {string}
 */
function getProgressString(player) {
    if (!player) return "Nouveau jeu";

    const ex = player.exploration;
    if (ex?.ended) return "Partie terminée";

    const parts = [`Niveau ${player.level || 1}`];
    const quests = Object.values(ex?.quests || {});
    const done = quests.filter(s => s === 'done').length;
    const active = quests.filter(s => s === 'active').length;
    if (done) parts.push(`${done} quête${done > 1 ? 's' : ''} terminée${done > 1 ? 's' : ''}`);
    if (active) parts.push(`${active} en cours`);
    const defeated = Array.isArray(ex?.defeated) ? ex.defeated.length : 0;
    if (defeated) parts.push(`${defeated} monstre${defeated > 1 ? 's' : ''} vaincu${defeated > 1 ? 's' : ''}`);
    return parts.join(' · ');
}

/** Garde les champs non vides (listes/objets vides, 0, false, null sont omis : les défauts du jeu les recréent). */
function compact(obj) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null || value === false || value === 0) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
        out[key] = value;
    }
    return out;
}

const ids = list => (Array.isArray(list) ? list.map(x => x?.id).filter(Boolean) : []);

/**
 * Extrait de l'objet joueur ce qui compose réellement la partie : héros, stats, équipement,
 * progression (monstres vaincus, quêtes, coffres, régions). Le catalogue (armes, sorts) n'est
 * stocké que par identifiant ; qì, effets de combat, caches et valeurs dérivées sont exclus.
 * @param {Object} player - L'objet joueur
 * @returns {Object}
 */
function sanitizePlayer(player) {
    const ex = player.exploration && typeof player.exploration === 'object' ? player.exploration : null;
    const arena = ex?.arena;
    return compact({
        name: player.name,
        class: player.class,
        playStyle: player.playStyle,
        level: player.level,
        xp: player.xp,
        unspentLevelPoints: player.unspentLevelPoints,
        growthLevel: player.growthLevel,
        hp: player.hp,
        maxHp: player.maxHp,
        attack: player.attack,
        defense: player.defense,
        attributes: compact(player.attributes || {}),
        gold: player.gold,
        mount: player.mount,
        torch: player.torch,
        abilities: player.abilities,
        activeSpells: ids(player.activeSpells),
        archivedSpells: player.archivedSpells,
        equippedUltimate: player.equippedUltimate,
        unlockedUltimates: player.unlockedUltimates,
        weapons: ids(player.weapons),
        equippedWeapon: player.equippedWeapon?.id,
        equipment: compact({ leftHand: player.equipment?.leftHand, item: player.equipment?.item }),
        inventory: player.inventory,
        stuffOwned: player.stuffOwned,
        stuff: compact(player.stuff || {}),
        activeInventoryIndex: player.activeInventoryIndex,
        merchantSold: player.merchantSold,
        sellTags: player.sellTags,
        defeatedBossTiers: player.defeatedBossTiers,
        bossLossStreak: player.bossLossStreak,
        visitedZoneIds: player.worldMap?.visitedZoneIds,
        currentZoneId: player.worldMap?.currentZoneId,
        exploration: ex && compact({
            screenId: ex.change?.return?.screenId || ex.screenId,   // en plein mode Chang'e, on sauvegarde la place de Hou Yi
            defeated: ex.defeated,
            openedChests: ex.openedChests,
            questItems: ex.questItems,
            quests: ex.quests,
            visitedScreens: ex.visitedScreens,
            fog: ex.fog,
            mimicked: ex.mimicked,
            returns: ex.returns,
            talked: ex.talked,
            waypoints: ex.waypoints,
            tracked: ex.tracked,
            introSeen: ex.introSeen,
            eventNotices: ex.eventNotices,
            eventReturn: ex.eventReturn,
            ended: ex.ended,
            ngPlus: ex.ngPlus,
            bestiary: ex.bestiary,
            change: ex.change && (ex.change.done?.length || ex.change.pending || ex.change.healed?.length || Object.keys(ex.change.hp || {}).length) ? ex.change : undefined,
            arena: arena && compact({
                cleared: arena.cleared,
                best: arena.best,
                wins: arena.wins,
                returnTo: arena.returnTo
            })
        })
    });
}

// Sorts de rage regroupés en moins de paliers : un sort supprimé d'une sauvegarde devient le palier conservé le plus proche.
const REMOVED_SPELL_ALIASES = {
    moonSpring: 'awakenQi',
    spiritFlow: 'awakenQi',
    immortalFury: 'stormTide',
    daoHeart: 'stormTide',
    celestialAwakening: 'stormTide',
    rageAlchemy: 'cinnabarTransmute',
    wrathElixir: 'cinnabarTransmute',
    emotionFurnace: 'innerCrucible',
    celestialDistill: 'innerCrucible',
    philosopherStone: 'innerCrucible',
    wrathLightning: 'furyBolt',
    etherLance: 'innerThunder',
    immortalStorm: 'innerThunder',
    daoCataclysm: 'skyJudgement',
    silentHunt: 'bloodThirst',
    shadowTrack: 'bloodThirst',
    bladeFever: 'hunterThrill',
    tigerAppetite: 'hunterThrill',
    slayerRapture: 'hunterThrill',
    shadowSiphon: 'furyTheft',
    wrathLarceny: 'furyTheft',
    celestialRapine: 'innerPlunder',
    nightTithe: 'innerPlunder',
    voidTribute: 'innerPlunder',
    vengefulBlade: 'spiteStrike',
    bloodEclipse: 'furiousLunge',
    thousandBladesDance: 'furiousLunge',
    instantDeath: 'absoluteShadowBlow',
    righteousAnger: 'battleOath',
    imperialIndignation: 'battleOath',
    mandateWrath: 'guardFervor',
    celestialZeal: 'guardFervor',
    sacredGuardianRage: 'guardFervor',
    jadeSacrifice: 'wrathOffering',
    furiousIncense: 'wrathOffering',
    warriorPrayer: 'furyAltar',
    imperialRite: 'furyAltar',
    furiousBlessing: 'furyAltar',
    imperialPunishment: 'righteousStrike',
    jadeHammer: 'guardSentence',
    celestialVerdict: 'guardSentence',
    throneWrath: 'mandateJudgement',
    bloodTide: 'bloodBoil',
    warDrums: 'bloodBoil',
    heavenFury: 'dragonBlood',
    asuraRoar: 'dragonBlood',
    warGodBlood: 'dragonBlood',
    wrathBreath: 'furyToQi',
    rageWell: 'furyToQi',
    stormMind: 'angerCirculation',
    fireHeart: 'angerCirculation',
    rageNirvana: 'angerCirculation',
    shatteredWrath: 'furyBlow',
    dragonRage: 'tigerBreaker',
    thunderFist: 'tigerBreaker',
    worldEnder: 'skySplitter'
};

/**
 * Reconstitue un objet joueur utilisable par loadGameData() depuis un export compact (format 2).
 * @param {Object} data - Le contenu `player` de la sauvegarde
 * @returns {Object}
 */
function expandPlayer(data) {
    const player = { ...data };
    const spell = id => getSpellById(id) || getClassSpellById(id) || getClassSpellById(REMOVED_SPELL_ALIASES[id]);   // sort supprimé : remplacé par son palier conservé
    player.activeSpells = [...new Map((data.activeSpells || []).map(spell).filter(Boolean).map(sp => [sp.id, sp])).values()];
    player.spells = player.activeSpells;
    player.weapons = (data.weapons || []).map(getWeaponById).filter(Boolean);
    player.equippedWeapon = (data.equippedWeapon && getWeaponById(data.equippedWeapon)) || null;
    player.equipment = { rightHand: player.equippedWeapon, leftHand: null, item: null, ...(data.equipment || {}) };
    player.worldMap = { currentZoneId: data.currentZoneId ?? null, visitedZoneIds: data.visitedZoneIds || [] };
    delete player.visitedZoneIds;
    delete player.currentZoneId;
    return player;
}

/**
 * Valide les métadonnées de sauvegarde
 * @param {Object} metadata - Les métadonnées
 * @returns {boolean}
 */
function validateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return false;

    // Vérifier les champs essentiels
    if (typeof metadata.version !== 'string' || !metadata.version || !metadata.timestamp) return false;
    if (metadata.format !== undefined && !Number.isInteger(metadata.format)) return false;

    // Valider le timestamp
    if (!Number.isInteger(metadata.timestamp) || metadata.timestamp < 0) return false;

    // Valider les chaînes
    if (metadata.playerName && typeof metadata.playerName !== 'string') return false;
    if (metadata.progress && typeof metadata.progress !== 'string') return false;

    return true;
}

/**
 * Nettoie en place les champs connus d'un joueur importé : types, bornes, longueurs.
 * Un champ invalide est retiré (le jeu applique alors sa valeur par défaut) plutôt que de refuser toute la sauvegarde.
 * Les champs inconnus ne sont pas modifiés : les sauvegardes existantes restent compatibles.
 */
function sanitizeImportedPlayer(player) {
    player.name = cleanText(player.name, MAX_NAME_LENGTH) || 'Héros';
    assign(player, 'class', cleanText(player.class, MAX_ID_LENGTH));
    assign(player, 'playStyle', cleanText(player.playStyle, MAX_ID_LENGTH));
    player.level = cleanNumber(player.level, 1, MAX_LEVEL, true);

    for (const key of ['xp', 'xpToNextLevel', 'unspentLevelPoints', 'growthLevel', 'hp', 'maxHp', 'maxMana', 'attack', 'defense', 'gold', 'activeInventoryIndex']) {
        assign(player, key, cleanNumber(player[key], 0, MAX_STAT, true));
    }
    // Série de défaites contre un boss : { id, count }
    if (isPlainObject(player.bossLossStreak)) {
        const id = cleanText(player.bossLossStreak.id, MAX_ID_LENGTH);
        const count = cleanNumber(player.bossLossStreak.count, 0, 1000, true);
        if (id && count !== undefined) player.bossLossStreak = { id, count }; else delete player.bossLossStreak;
    } else delete player.bossLossStreak;
    if (player.maxHp !== undefined && player.hp !== undefined) player.hp = Math.min(player.hp, player.maxHp);

    if (isPlainObject(player.attributes)) {
        for (const key of Object.keys(player.attributes)) assign(player.attributes, key, cleanNumber(player.attributes[key], 0, 1000, true));
    } else delete player.attributes;

    for (const key of ['mount', 'torch']) {
        if (typeof player[key] !== 'boolean' && typeof player[key] !== 'string') delete player[key];
        else if (typeof player[key] === 'string') player[key] = cleanText(player[key], MAX_ID_LENGTH);
    }
    for (const key of ['equippedUltimate', 'currentZoneId']) assign(player, key, cleanText(player[key], MAX_ID_LENGTH));
    for (const key of ['abilities', 'archivedSpells', 'unlockedUltimates', 'stuffOwned', 'merchantSold', 'sellTags', 'defeatedBossTiers', 'visitedZoneIds']) {
        if (player[key] === undefined) continue;
        if (!Array.isArray(player[key])) { delete player[key]; continue; }
        player[key] = player[key].slice(0, MAX_LIST_LENGTH).filter(v => typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string').map(v => typeof v === 'string' ? cleanText(v, MAX_ID_LENGTH) : v);
    }

    if (Array.isArray(player.inventory)) player.inventory = player.inventory.slice(0, MAX_INVENTORY).filter(isPlainObject);
    else delete player.inventory;
    if (player.stuffOwned !== undefined && !Array.isArray(player.stuffOwned)) delete player.stuffOwned;

    if (player.exploration !== undefined && !isPlainObject(player.exploration)) delete player.exploration;
    if (isPlainObject(player.exploration)) {
        const ex = player.exploration;
        for (const key of ['defeated', 'openedChests', 'visitedScreens', 'waypoints', 'talked', 'introSeen']) assign(ex, key, cleanIdList(ex[key]));
        assign(ex, 'screenId', cleanText(ex.screenId, MAX_ID_LENGTH));
        for (const key of ['quests', 'questItems', 'fog', 'bestiary']) if (ex[key] !== undefined && !isPlainObject(ex[key]) && !Array.isArray(ex[key])) delete ex[key];
    }
    return player;
}

/**
 * Valide et restaure les données du joueur
 * @param {Object} player - L'objet joueur à valider
 * @returns {Object|null}
 */
function validateAndRestorePlayer(player) {
    if (!player || typeof player !== 'object') return null;

    // Vérifier les champs essentiels
    if (!Number.isInteger(player.level)) return null;
    sanitizeImportedPlayer(player);
    if (!player.inventory || !Array.isArray(player.inventory)) player.inventory = [];

    // Initialiser les champs manquants
    if (!player.equipment) {
        player.equipment = { rightHand: null, leftHand: null, item: null };
    }

    if (!Array.isArray(player.stuffOwned)) player.stuffOwned = [];
    if (!player.stuff || typeof player.stuff !== 'object') player.stuff = { head: null, neck: null, wrist: null, ring: null };
    if (!player.spells) player.spells = {};
    if (!player.equippedSpells) player.equippedSpells = [];
    if (!player.exploration) player.exploration = {};

    // Initialiser les charges des objets rechargeables
    player.inventory.forEach(item => {
        // Anciens consommables (à usage unique) : désormais rechargeables en x tours, comme tous les objets.
        toReusable(item);
        if (item.type === 'reusable' && !Number.isInteger(item.chargesLeft)) {
            item.chargesLeft = item.chargesPerCycle || 3;
        }
        // Anciennes sauvegardes : la recharge en combat (x tours) vient du catalogue.
        if (item.type === 'reusable') {
            const ref = allItems.find(i => i.id === item.id);
            // Les valeurs (soin, qì, charges, délai) viennent toujours du catalogue : un rééquilibrage s'applique aux anciennes parties.
            if (ref) {
                Object.assign(item, { effect: { ...ref.effect }, description: ref.description, chargesPerCycle: ref.chargesPerCycle, rechargeTurns: ref.rechargeTurns });
                if (ref.actionPoints) item.actionPoints = ref.actionPoints;
                item.chargesLeft = Math.min(item.chargesLeft, ref.chargesPerCycle);
            }
            if (!Number.isFinite(item.rechargeLeft)) item.rechargeLeft = 0;
        }
    });

    return player;
}
