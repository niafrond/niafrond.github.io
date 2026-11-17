// Quêtes des armures antiques (stuff.js `ANTIQUE_ARMORS`, énigmes de puzzle/levels.js). Logique pure, sans DOM.
//
// La quête d'une armure s'ouvre d'elle-même dès qu'une énigme de sa famille est résolue (première pièce trouvée). Elle est volontairement muette
// sur l'emplacement des autres pièces : ni PNJ, ni lieu, ni cible pour la boussole (l'objectif `puzzleSet` n'a pas de coordonnées) ; elle
// ne fait que compter les pièces et se termine toute seule quand l'armure est au complet.

import { ANTIQUE_ARMORS } from '../stuff.js';

export function applyArmorQuests(quests) {
    Object.entries(ANTIQUE_ARMORS).forEach(([set, armor]) => {
        const count = armor.pieces.length;
        quests.push({
            id: `sq_armure_${set}`, title: armor.name, chapter: '✦ Quête secondaire — Armures antiques',
            giver: null, autoStart: true, turnIn: null, requires: [], side: true,
            startWhen: { puzzleSet: set },
            objectives: [{ type: 'puzzleSet', target: set, text: `Réunir les ${count} pièces de l'${armor.name.replace(/^Armure/, 'armure')}` }],
            offer: [`Une première pièce de l'${armor.name.replace(/^Armure/, 'armure')} est à vous. Il en existe ${count} en tout, dispersées dans le monde : à vous de les trouver.`],
            hint: [`Il manque encore des pièces à l'${armor.name.replace(/^Armure/, 'armure')}.`],
            complete: [`Les ${count} pièces sont réunies : portez-les ensemble pour réveiller le pouvoir de l'armure.`],
            reward: { gold: 100, fragment: armor.name }
        });
    });
    return quests;
}
