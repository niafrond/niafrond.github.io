// Moteur événementiel générique (couche A). Logique pure, sans DOM, sans connaissance d'un événement en particulier.
//
// Un module d'événement est `{ id, apply(screens, quests, ctx) }` : `apply` ajoute à `screens` et `quests` ses écrans et ses quêtes
// (couche B : les données vivent dans le dossier du module). Le moteur n'appelle que les modules dont la configuration
// (events/config.js) est activée, puis marque ce qu'ils ont créé (`screen.event`, `quest.event`) pour que le jeu, les tests et la
// désactivation sachent à quel événement appartient un contenu. Un événement désactivé n'ajoute rien : le monde est alors celui du jeu permanent.

import { EVENTS, isEventEnabled } from './config.js';

/** Modules activés par la configuration, dans l'ordre de déclaration des modules. */
export const activeModules = (modules, events = EVENTS) => modules.filter(m => isEventEnabled(m.id, events));

/**
 * Applique les événements activés. Retourne les identifiants des événements réellement appliqués
 * (un module peut s'abstenir, p. ex. si l'écran qui l'héberge n'existe pas dans un monde de test).
 * @param {object} screens écrans assemblés (modifiés sur place)
 * @param {object[]} quests quêtes assemblées (modifiées sur place)
 * @param {{ modules: object[], events?: object }} options
 */
export function applyEvents(screens, quests, { modules, events = EVENTS } = {}) {
    const applied = [];
    activeModules(modules || [], events).forEach(mod => {
        const screensBefore = new Set(Object.keys(screens));
        const questsBefore = quests.length;
        if (mod.apply(screens, quests, { events, config: events[mod.id] }) === false) return;
        Object.keys(screens).filter(id => !screensBefore.has(id)).forEach(id => { screens[id].event = mod.id; });
        quests.slice(questsBefore).forEach(q => { q.event = mod.id; });
        applied.push(mod.id);
    });
    return applied;
}

/** Les écrans d'un événement donné (ou de tous les événements si `eventId` est omis). */
export const eventScreens = (screens, eventId) => Object.values(screens).filter(s => s.event && (!eventId || s.event === eventId));
