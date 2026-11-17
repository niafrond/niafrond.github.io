// Histoire et cartes d'exploration de Match3-Quest : « La Légende de Hou Yi ».
//
// Fantasy chinoise : l'archer Hou Yi doit abattre neuf des dix soleils (UNIVERS.md est la source de
// vérité pour les identifiants). Données pures (aucun accès DOM) : la logique est dans exploration.js,
// le rendu dans explorationView.js. Chaque écran est une carte de 14 x 10 tuiles, une région = un écran
// (id d'écran = id de région) ; on n'en affiche qu'un à la fois, les sorties (`exits`) mènent à l'écran
// voisin : sortie à l'ouest (x = 0) vers la région précédente, sortie à l'est (x = 13) vers la suivante.
// Chaque écran a un coin « village » à l'ouest (PNJ, quêtes) et un « sanctuaire » à l'est (le Soleil-Boss).
//
// Rectangles : [x, y, largeur, hauteur] en tuiles. Les `obstacles` et `liquids` sont
// infranchissables, les `paths` sont purement décoratifs.
//
// Ennemis :
//  - kind 'sentinel' : immobile, se déclenche si on passe à `AGGRO_RADIUS` tuile(s) (2 sur les cartes agrandies, `scaledAggro` pour
//    un goulet à garder fermé : 3 pour Fengmeng) ;
//  - kind 'patrol'   : fait des allers-retours entre les points de `patrol` ;
//  - permanent:true  : ne réapparaît jamais (ennemis d'histoire : boss, quêtes, groupes, scènes). Sinon il revient à chaque
//                      entrée dans l'écran (le joueur peut donc s'entraîner) SAUF s'il barre un chemin (sa zone de
//                      vigilance sépare deux sorties/PNJ/coffres : voir `blocksPath` et `respawns` dans exploration.js) ;
//  - boss            : { name, level } → combat de boss (niveau au moins égal à celui du joueur) ;
//  - offset          : écart de niveau par rapport au joueur (-1, 0 ou +1) pour les ennemis normaux ;
//  - spriteKey       : clé de sprite si différente de l'id (les mirages réutilisent `sun_4`) ;
//  - illusion:true   : mirage, pas de combat : il se dissipe au contact (`illusionLines`) ;
//  - shieldedBy      : id d'un `group` d'ennemis ; tant qu'il n'est pas vaincu, le boss est intouchable
//                      (le contact affiche `shieldLines`) ;
//  - unsealedBy      : [conditions] ; chemin relationnel : si l'une est remplie (ex. le pourparler `parley_sunN`), le bouclier tombe sans combat ;
//  - parley          : sur un PNJ, { lines } ; la 1re conversation est un pourparler (le PNJ compte comme « parlé » : son id devient une
//                      condition remplie). Les gardes du soleil portent `hideWhen` = id du PNJ, le PNJ `showWhen` = une quête annexe ;
//  - weakenedBy      : [conditions] ; chaque condition remplie retire 1 niveau au boss (2 au plus) ;
//  - defeatScene     : { speaker: { name, title?, npc? | enemy? }, lines } jouée après la victoire ;
//  - afterScenes     : [{ speaker, lines }] interlude à plusieurs voix (speaker.hero : le héros) après le texte de victoire ;
//  - duel            : règles de duel de Fengmeng (mirror, heroHpPct, rapidShots, zoneTraps : voir duel.js) ;
//  - showWhen / hideWhen : (aussi sur PNJ et coffres) l'entité n'existe qu'après / jusqu'à ce que la
//                      condition d'avancement (id de quête, d'ennemi vaincu ou de coffre) soit remplie.
// Sorties : `requires` (+ `lockedMessage`) les ferme tant que la condition d'avancement n'est pas remplie.

import { assembleWorld } from './world/index.js';
import { EVENTS, EVENTS_DEFAULT } from './events/config.js';
import { activeModules } from './events/engine.js';
import { EVENT_MODULES } from './events/registry.js';
import { buildArenaScreens } from './arena.js';
import { STORY_TITLE, STORY_INTRO, STORY_ENDING } from './storyText.js';
import { BASE_SCREENS } from './storyScreens.js';
import { BASE_QUESTS } from './storyQuests.js';
export { STORY_TITLE, STORY_INTRO, STORY_ENDING };




// Niveau minimal du joueur pour ENTRER dans un écran de la région (brume magique sinon).
export const REGION_UNLOCK_LEVEL = {
    rizieres: 1,
    volcan: 4,
    gobi: 6,
    fleuve: 11,
    bambous: 17,
    tonnerre: 22,
    fauves: 27,
    mer: 32,
    fusang: 37,
    marees: 38,
    lune: 40
};


// Monde final : les 10 sanctuaires ci-dessus, précédés de villages et de zones sauvages (world/).
// L'assemblage coûte plusieurs secondes sur un vieux téléphone : on lit l'instantané précalculé (world/snapshot.js, tools/build-world-snapshot.mjs)
// tant que la configuration d'événements est celle par défaut (le monde en dépend) ; sinon, ou si l'instantané manque, on assemble.
async function loadWorld() {
    if (JSON.stringify(EVENTS) === JSON.stringify(EVENTS_DEFAULT)) {
        try {
            const snapshot = (await import('./world/snapshot.js')).default;
            // Effet de bord de l'assemblage que l'instantané ne porte pas : l'inscription des énigmes des événements actifs dans PUZZLES.
            activeModules(EVENT_MODULES).forEach(mod => mod.registerPuzzles?.());
            return snapshot;
        } catch { /* instantané absent : assemblage ci-dessous */ }
    }
    return assembleWorld(BASE_SCREENS, BASE_QUESTS);
}
const WORLD = await loadWorld();
// L'Arène des Mille Flèches (arena.js) : parvis + salles des huit cercles, hors de la chaîne des régions.
export const SCREENS = { ...WORLD.screens, ...buildArenaScreens() };
export const QUESTS = WORLD.quests;
// Monde à l'ancienne (cartes à leur taille d'origine, sans agrandissement ni jonctions) : réservé aux tests de mécanique du moteur.
// Monde assemblé avec des options (p. ex. `{ events: { wanderingSouls: { enabled: false } } }` : voir events/config.js) : réservé aux tests.
export const buildWorld = (options = {}) => assembleWorld(BASE_SCREENS, BASE_QUESTS, undefined, undefined, options);
export const buildLegacyWorld = () => assembleWorld(BASE_SCREENS, BASE_QUESTS, undefined, undefined, { legacy: true });

// Écran d'arrivée d'une région depuis la carte du monde : son village quand il existe, sinon son sanctuaire.
export const REGION_ENTRY_SCREEN = Object.fromEntries(
    ['rizieres', 'volcan', 'gobi', 'fleuve', 'bambous', 'tonnerre', 'fauves', 'mer', 'fusang', 'marees', 'lune']
        .map(region => [region, SCREENS[`${region}_village`] ? `${region}_village` : region])
);
