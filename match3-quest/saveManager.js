// Gestionnaire de sauvegarde/chargement de parties (export/import JSON)
import { allItems } from './items.js';

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
        const json = JSON.stringify(saveData, null, 2);
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
                    const player = validateAndRestorePlayer(saveData.player);
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

    // Déterminer la progression selon les données du joueur
    if (player.exploration?.ended) {
        return "Partie terminée";
    }

    if (player.exploration?.currentQuest) {
        return `Quête: ${player.exploration.currentQuest}`;
    }

    if (player.exploration?.currentScreen) {
        return `Exploration: ${player.exploration.currentScreen}`;
    }

    return `Niveau ${player.level || 1}`;
}

/**
 * Nettoie les données du joueur avant export (supprime les données temporaires)
 * @param {Object} player - L'objet joueur
 * @returns {Object}
 */
function sanitizePlayer(player) {
    const sanitized = { ...player };

    // Supprimer les données temporaires de combat
    delete sanitized.combatInProgress;
    delete sanitized.tempAttack;
    delete sanitized.tempDefense;
    delete sanitized.tempCritChance;
    delete sanitized.shieldAbsorbLeft;

    // Supprimer les états temporaires
    delete sanitized.hasRevive;
    delete sanitized.damageReduction;
    delete sanitized.lifesteal;

    return sanitized;
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
        if (item.type === 'consumable') {
            const ref = allItems.find(i => i.id === item.id);
            if (ref && ref.type === 'reusable') {
                Object.assign(item, { type: 'reusable', chargesPerCycle: ref.chargesPerCycle, rechargeTurns: ref.rechargeTurns, description: ref.description, chargesLeft: ref.chargesPerCycle, rechargeLeft: 0 });
            }
        }
        if (item.type === 'reusable' && !Number.isInteger(item.chargesLeft)) {
            item.chargesLeft = item.chargesPerCycle || 3;
        }
        // Anciennes sauvegardes : la recharge en combat (x tours) vient du catalogue.
        if (item.type === 'reusable') {
            const ref = allItems.find(i => i.id === item.id);
            if (ref && !Number.isFinite(item.rechargeTurns)) { item.rechargeTurns = ref.rechargeTurns; item.description = ref.description; }
            if (!Number.isFinite(item.rechargeLeft)) item.rechargeLeft = 0;
        }
    });

    return player;
}
