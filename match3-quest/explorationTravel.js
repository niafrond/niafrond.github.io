// Pierres de voyage (voyage rapide), progression par région, bestiaire et introduction.
// Extrait de exploration.js (ré-exporté par celui-ci).
import { STORY_INTRO } from './story.js';
import { REGION_ORDER } from './world/index.js';
import { questById } from './explorationQuests.js';
import { REGION_NUMBER, questRegion } from './explorationGuide.js';
import { currentScreen, enterScreen } from './exploration.js';

// ── Pierres de voyage (voyage rapide) ─────────────────────────────────────

// Un village est un lieu de repos : sa pierre est découverte dès qu'on y entre.
export function discoverVillageWaypoint(session) {
    const screen = currentScreen(session);
    if (screen.waypoint && screen.kind === 'village' && !session.data.waypoints.includes(screen.id)) {
        session.data.waypoints.push(screen.id);
    }
}

export function activateWaypoint(session, screenId) {
    const screen = session.screens[screenId];
    if (!screen?.waypoint) return null;
    const isNew = !session.data.waypoints.includes(screenId);
    if (isNew) session.data.waypoints.push(screenId);
    return { type: 'waypoint', screenId, name: screen.waypoint.name, isNew };
}

// Pierres activées, dans l'ordre du monde (région, puis village → zone sauvage → sanctuaire).
export function waypointList(session) {
    const kindRank = { village: 0, wild: 1 };
    return session.data.waypoints
        .map(id => session.screens[id])
        .filter(screen => screen?.waypoint)
        .map(screen => ({
            screenId: screen.id, region: screen.region, name: screen.waypoint.name, screenName: screen.name,
            kind: screen.kind || 'sanctuary', current: screen.id === session.data.screenId
        }))
        .sort((a, b) => REGION_NUMBER(a.region) - REGION_NUMBER(b.region)
            || (kindRank[a.kind] ?? 2) - (kindRank[b.kind] ?? 2));
}

// Le héros se tient à côté d'une borne de voyage (la pierre de l'écran courant) : seul endroit d'où l'on peut voyager.
export function nearWaypoint(session) {
    const wp = currentScreen(session)?.waypoint;
    return Boolean(wp) && Math.max(Math.abs(wp.x - session.data.x), Math.abs(wp.y - session.data.y)) <= 2;
}

// Voyage rapide : seulement depuis une borne de voyage, impossible vers une pierre non activée ; arrivée à côté de la pierre.
export function fastTravel(session, screenId) {
    const screen = session.screens[screenId];
    if (!nearWaypoint(session)) return false;
    if (!screen?.waypoint || !session.data.waypoints.includes(screenId)) return false;
    return enterScreen(session, screenId, screen.waypoint.spot || screen.spawn);
}

// Progression par région : coffres, quêtes annexes, pierres.
export function regionProgress(session) {
    return REGION_ORDER.map(region => {
        const zones = Object.values(session.screens).filter(s => s.region === region);
        const chests = zones.flatMap(s => s.chests).filter(c => c.id !== 'moon_altar');
        const side = session.quests.filter(q => q.side && questRegion(session, q) === region);
        const stones = zones.filter(s => s.waypoint);
        return {
            region,
            visited: zones.some(s => session.data.visitedScreens.includes(s.id)),
            chestsOpened: chests.filter(c => session.data.openedChests.includes(c.id)).length,
            chestsTotal: chests.length,
            sideDone: side.filter(q => session.data.quests[q.id] === 'done').length,
            sideTotal: side.length,
            stonesFound: stones.filter(s => session.data.waypoints.includes(s.id)).length,
            stonesTotal: stones.length
        };
    });
}

// Bestiaire : une créature (gabarit) y entre dès qu'on la combat ou qu'on l'observe. Renvoie true si elle est nouvelle.
export function recordBestiary(session, templateId) {
    if (typeof templateId !== 'string' || !templateId || session.data.bestiary.includes(templateId)) return false;
    session.data.bestiary.push(templateId);
    return true;
}

export function needsIntro(session) {
    return !session.data.introSeen;
}

export function markIntroSeen(session) {
    session.data.introSeen = true;
    return STORY_INTRO;
}

export { questById };

// Mode Chang'e : épisode commencé et inachevé (le bouton miroir de l'interface le rouvre), ou null.
