// Configuration centralisée des événements temporaires (couche A du moteur événementiel, voir events/README.md).
//
// Activer un événement : passer son `enabled` à `true`, puis committer. Le désactiver : repasser à `false`, puis committer.
// Aucune activation par la date ou l'heure, aucune commande en jeu, aucun compte à rebours : seul ce fichier décide.
// Désactiver ne supprime rien : les sauvegardes, les quêtes terminées et les récompenses déjà acquises restent intactes.

export const EVENTS = {
    // La Nuit des âmes errantes : royaume facultatif accessible depuis la zone sauvage des Bambous (events/wanderingSouls/).
    wanderingSouls: { enabled: true },
    // La Fête des lanternes d'hiver : village et sanctuaire de montagne accessibles depuis la zone sauvage du Tonnerre (events/winterLanternFestival/).
    // Préparée mais INACTIVE : passer `enabled` à true puis committer pour la lancer.
    winterLanternFestival: { enabled: false }
};

/** Un événement est actif si sa configuration existe et que `enabled` vaut exactement `true`. */
export const isEventEnabled = (id, events = EVENTS) => events?.[id]?.enabled === true;
