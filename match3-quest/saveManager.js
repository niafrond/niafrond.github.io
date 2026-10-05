// Gestionnaire de sauvegarde/chargement de parties (export/import JSON)
import { allItems, toReusable } from './items.js';
import { getWeaponById } from './weapons.js';
import { getSpellById, getClassSpellById } from './spells.js';

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

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const json = event.target.result;
                    const saveData = JSON.parse(json);

                    // Valider la structure
                    if (!saveData.metadata || !saveData.player) {
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

                    resolve({
                        success: true,
                        message: `Sauvegarde importée: ${saveData.metadata.playerName} (niveau ${saveData.metadata.level})`,
                        player,
                        metadata: saveData.metadata
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
 * stocké que par identifiant ; mana, effets de combat, caches et valeurs dérivées sont exclus.
 * @param {Object} player - L'objet joueur
 * @returns {Object}
 */
function sanitizePlayer(player) {
    const ex = player.exploration && typeof player.exploration === 'object' ? player.exploration : null;
    const arena = ex?.arena;
    return compact({
        name: player.name,
        class: player.class,
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
        abilities: player.abilities,
        activeSpells: ids(player.activeSpells),
        weapons: ids(player.weapons),
        equippedWeapon: player.equippedWeapon?.id,
        equipment: compact({ leftHand: player.equipment?.leftHand, item: player.equipment?.item }),
        inventory: player.inventory,
        activeInventoryIndex: player.activeInventoryIndex,
        merchantSold: player.merchantSold,
        defeatedBossTiers: player.defeatedBossTiers,
        bossLossStreak: player.bossLossStreak,
        visitedZoneIds: player.worldMap?.visitedZoneIds,
        currentZoneId: player.worldMap?.currentZoneId,
        exploration: ex && compact({
            screenId: ex.screenId,
            x: ex.x,
            y: ex.y,
            defeated: ex.defeated,
            openedChests: ex.openedChests,
            quests: ex.quests,
            visitedScreens: ex.visitedScreens,
            talked: ex.talked,
            waypoints: ex.waypoints,
            tracked: ex.tracked,
            introSeen: ex.introSeen,
            ended: ex.ended,
            ngPlus: ex.ngPlus,
            arena: arena && compact({
                cleared: arena.cleared,
                best: arena.best,
                wins: arena.wins,
                returnTo: arena.returnTo
            })
        })
    });
}

/**
 * Reconstitue un objet joueur utilisable par loadGameData() depuis un export compact (format 2).
 * @param {Object} data - Le contenu `player` de la sauvegarde
 * @returns {Object}
 */
function expandPlayer(data) {
    const player = { ...data };
    const spell = id => getSpellById(id) || getClassSpellById(id);
    player.activeSpells = (data.activeSpells || []).map(spell).filter(Boolean);
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
    if (!metadata.version || !metadata.timestamp) return false;

    // Valider le timestamp
    if (!Number.isInteger(metadata.timestamp)) return false;

    // Valider les chaînes
    if (metadata.playerName && typeof metadata.playerName !== 'string') return false;
    if (metadata.progress && typeof metadata.progress !== 'string') return false;

    return true;
}

/**
 * Valide et restaure les données du joueur
 * @param {Object} player - L'objet joueur à valider
 * @returns {Object|null}
 */
function validateAndRestorePlayer(player) {
    if (!player || typeof player !== 'object') return null;

    // Vérifier les champs essentiels
    if (!player.name) player.name = 'Héros';
    if (!Number.isInteger(player.level)) return null;
    if (!player.inventory || !Array.isArray(player.inventory)) player.inventory = [];

    // Initialiser les champs manquants
    if (!player.equipment) {
        player.equipment = { rightHand: null, leftHand: null, item: null };
    }

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
            // Les valeurs (soin, mana, charges, délai) viennent toujours du catalogue : un rééquilibrage s'applique aux anciennes parties.
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
