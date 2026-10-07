// Forge de sauvegardes d'EXPLORATION à des moments précis de l'histoire. Chaque sauvegarde est une donnée `player.exploration`
// comme le jeu la stocke (voir exploration.js, `createSession(saved)`) ; elle est fabriquée à partir du vrai monde (story.js) :
// aucun identifiant n'est recopié, tout est lu depuis les cartes, les quêtes et les ennemis. Utilisation :
//   const session = createSession(forge.beforeBoss('volcan'));
// Les jalons sont déterministes (aucun hasard) et sans effet de bord (chaque appel renvoie un objet neuf).

import { SCREENS, QUESTS, REGION_ENTRY_SCREEN, REGION_UNLOCK_LEVEL } from '../../../story.js';
import { createSession, questRegion, START_SCREEN } from '../../../exploration.js';

export const REGIONS = ['rizieres', 'fleuve', 'bambous', 'gobi', 'tonnerre', 'volcan', 'fauves', 'mer', 'fusang', 'lune'];
// Boss principal de chaque région (le soleil, ou les deux phases de Fengmeng sur la Lune).
export const REGION_BOSSES = {
    rizieres: ['sun_1'], fleuve: ['sun_2'], bambous: ['sun_3'], gobi: ['sun_4'], tonnerre: ['sun_5'],
    volcan: ['fengmeng_2', 'sun_6'], fauves: ['sun_7'], mer: ['sun_8'], fusang: ['sun_9'], lune: ['fengmeng_3a', 'fengmeng_3b']
};
// Quête principale qui valide la région.
export const REGION_QUEST = {
    rizieres: 'q_sun_1', fleuve: 'q_sun_2', bambous: 'q_sun_3', gobi: 'q_sun_4', tonnerre: 'q_sun_5',
    volcan: 'q_sun_6', fauves: 'q_sun_7', mer: 'q_sun_8', fusang: 'q_sun_9',
    lune: 'q_fengmeng'   // le duel contre Fengmeng ; la quête finale (`final`) s'enchaîne ensuite toute seule
};
export const regionIndex = region => REGIONS.indexOf(region);
export const levelFor = region => Math.max(REGION_UNLOCK_LEVEL[region] || 1, 1);

const worldScreens = () => Object.values(SCREENS).filter(s => !s.arena);
const screensOf = region => worldScreens().filter(s => s.region === region);
// Région d'une quête, calculée sur une session neuve (PNJ donneur ou première cible).
const questRegions = (() => {
    let cache = null;
    return () => {
        if (!cache) {
            const probe = createSession(null);
            cache = new Map(QUESTS.map(q => [q.id, questRegion(probe, q)]));
        }
        return cache;
    };
})();

const emptySave = () => ({
    defeated: [], openedChests: [], quests: {}, visitedScreens: [], talked: [], waypoints: [],
    introSeen: true, ended: false, ngPlus: 0, tracked: null
});

// Marque une région entière comme terminée (ennemis, coffres, PNJ parlés, écrans visités, quêtes) ; `except` : ids d'ennemis laissés en vie.
function completeRegion(save, region, except = []) {
    screensOf(region).forEach(sc => {
        save.visitedScreens.push(sc.id);
        sc.enemies.forEach(e => { if (!except.includes(e.id)) save.defeated.push(e.id); });
        sc.chests.forEach(c => save.openedChests.push(c.id));
        sc.npcs.forEach(n => save.talked.push(n.id));
        if (sc.waypoint) save.waypoints.push(sc.id);
    });
    QUESTS.filter(q => questRegions().get(q.id) === region).forEach(q => { save.quests[q.id] = 'done'; });
}

function placeHero(save, screenId, where = 'spawn') {
    const sc = SCREENS[screenId];
    const spot = where === 'waypoint' && sc.waypoint?.spot ? sc.waypoint.spot : sc.spawn;
    save.screenId = screenId;
    save.x = spot.x;
    save.y = spot.y;
    if (!save.visitedScreens.includes(screenId)) save.visitedScreens.push(screenId);
    return save;
}

const dedupe = save => {
    ['defeated', 'openedChests', 'visitedScreens', 'talked', 'waypoints'].forEach(k => { save[k] = [...new Set(save[k])]; });
    return save;
};

// Toutes les régions AVANT `region` sont terminées.
function previousRegionsDone(region) {
    const save = emptySave();
    REGIONS.slice(0, regionIndex(region)).forEach(r => completeRegion(save, r));
    return save;
}

export const forge = {
    // Partie neuve : aucune sauvegarde.
    newGame: () => null,

    // Prologue vu, héros au village de départ, rien d'accompli.
    freshStart: () => dedupe(placeHero(emptySave(), START_SCREEN)),

    // Arrivée au village d'une région, toutes les régions précédentes terminées.
    arrival(region) {
        const save = previousRegionsDone(region);
        return dedupe(placeHero(save, REGION_ENTRY_SCREEN[region]));
    },

    // Devant le boss d'une région : tout est fait sauf ses boss ; quête principale active ; héros au sanctuaire.
    beforeBoss(region) {
        const save = previousRegionsDone(region);
        completeRegion(save, region, REGION_BOSSES[region]);
        const main = REGION_QUEST[region];
        if (main) {
            // la quête principale est en cours : celles qui en dépendent (directement ou non) ne sont pas encore commencées
            const blocked = new Set([main]);
            for (let grew = true; grew;) {
                grew = false;
                QUESTS.forEach(q => { if (!blocked.has(q.id) && (q.requires || []).some(r => blocked.has(r))) { blocked.add(q.id); grew = true; } });
            }
            blocked.forEach(id => { delete save.quests[id]; });
            save.quests[main] = 'active';
        }
        return dedupe(placeHero(save, region, 'waypoint'));
    },

    // Juste après la victoire sur le boss de la région.
    afterBoss(region) {
        const save = previousRegionsDone(region);
        completeRegion(save, region);
        if (region === 'lune') save.ended = true;
        return dedupe(placeHero(save, region));
    },

    // Épilogue joué : toute l'histoire est terminée.
    ended() {
        const save = emptySave();
        REGIONS.forEach(r => completeRegion(save, r));
        save.ended = true;
        return dedupe(placeHero(save, 'lune'));
    },

    // Nouvelle Partie + : histoire remise à zéro, difficulté accrue.
    newGamePlus(plus = 1) {
        return { ...emptySave(), ngPlus: plus, screenId: START_SCREEN, x: SCREENS[START_SCREEN].spawn.x, y: SCREENS[START_SCREEN].spawn.y, visitedScreens: [START_SCREEN] };
    },

    // Dans l'arène : cercles déjà terminés, héros au parvis (point de retour = pierre du terrain d'où l'on vient).
    inArena(cleared = [], fromRegion = 'bambous') {
        const save = this.afterBoss(fromRegion);
        save.arena = { cleared: [...cleared], best: 0, wins: 0, returnTo: { screenId: save.screenId, x: save.x, y: save.y } };
        return placeHero(save, 'arena_hall');
    }
};

// Variantes volontairement abîmées : le jeu doit les absorber sans planter.
export const damagedSaves = {
    emptyObject: () => ({}),
    unknownScreen: () => ({ screenId: 'inconnu_42', x: 3, y: 3 }),
    heroInsideWall: () => ({ screenId: START_SCREEN, x: 0, y: 0 }),
    wrongTypes: () => ({ defeated: 'oui', openedChests: 12, quests: [], visitedScreens: null, talked: {}, waypoints: 'x', ngPlus: -4, observed: [], arena: 'non' }),
    legacyNoPosition: () => ({ screenId: 'fleuve', defeated: [], quests: { q_sun_1: 'done' } })
};
export { createSession };
