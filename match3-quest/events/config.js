// Configuration centralisée des événements temporaires (couche A du moteur événementiel, voir events/README.md).
//
// Activer un événement : passer son `enabled` à `true`, puis committer. Le désactiver : repasser à `false`, puis committer.
// Aucune activation par la date ou l'heure, aucune commande en jeu, aucun compte à rebours : seul ce fichier décide.
// Exception pour tester : l'URL peut forcer des événements pour la session en cours (voir `applyUrlOverrides`), lue une seule fois au chargement.
// Désactiver ne supprime rien : les sauvegardes, les quêtes terminées et les récompenses déjà acquises restent intactes.

/** Configuration versionnée (ce que décide le commit). */
export const EVENTS_DEFAULT = {
    // La Nuit des âmes errantes : royaume facultatif accessible depuis la zone sauvage des Bambous (events/wanderingSouls/).
    wanderingSouls: { enabled: true },
    // La Fête des lanternes d'hiver : village et sanctuaire de montagne accessibles depuis la zone sauvage du Tonnerre (events/winterLanternFestival/).
    winterLanternFestival: { enabled: true }
};

// Surcharge par l'URL, pour la session de l'onglet en cours : `?events=winterLanternFestival,-wanderingSouls`
// (identifiant seul ou précédé de `+` : activer ; précédé de `-` ou `!` : désactiver ; `events=` vide : aucune surcharge).
// Lue une seule fois, au premier chargement du module (jamais en continu). Mémorisée dans sessionStorage pour survivre aux rechargements
// sans le paramètre, mais perdue à la fermeture de l'onglet. Les identifiants inconnus sont ignorés.
export const EVENTS_URL_PARAM = 'events';
export const EVENTS_SESSION_KEY = 'match3.events.override';

/** Analyse la valeur du paramètre (`a,-b`) → `{ id: true|false }`, limitée aux événements connus. */
export function parseEventOverrides(value, known = Object.keys(EVENTS_DEFAULT)) {
    const out = {};
    String(value || '').split(',').map(t => t.trim()).filter(Boolean).forEach(token => {
        const off = token[0] === '-' || token[0] === '!';
        const id = token.replace(/^[-+!]/, '');
        if (known.includes(id)) out[id] = !off;
    });
    return out;
}

/** Copie de la configuration avec les surcharges appliquées (fonction pure). */
export const applyOverrides = (base, overrides) =>
    Object.fromEntries(Object.entries(base).map(([id, cfg]) => [id, id in overrides ? { ...cfg, enabled: overrides[id] } : { ...cfg }]));

// Lecture de l'URL puis de la session (navigateur seulement ; sans effet sous Node).
function readSessionOverrides(g = globalThis) {
    try {
        const raw = new URLSearchParams(g.location?.search || '').get(EVENTS_URL_PARAM);
        if (raw !== null) {
            if (raw.trim()) g.sessionStorage?.setItem(EVENTS_SESSION_KEY, raw); else g.sessionStorage?.removeItem(EVENTS_SESSION_KEY);
            return parseEventOverrides(raw);
        }
        return parseEventOverrides(g.sessionStorage?.getItem(EVENTS_SESSION_KEY));
    } catch { return {}; }
}

export const EVENTS = applyOverrides(EVENTS_DEFAULT, readSessionOverrides());

/** Un événement est actif si sa configuration existe et que `enabled` vaut exactement `true`. */
export const isEventEnabled = (id, events = EVENTS) => events?.[id]?.enabled === true;
