import { readFileSync } from 'fs';
import {
    ARENA_MIN_LEVEL, ARENA_TIERS, ARENA_TEMPLATES, ARENA_HALL, ARENA_BIOMES, arenaTier, isArenaUnlocked, arenaWaveLevel,
    isChampionWave, arenaEncounterInfo, applyArenaScaling, arenaRewardBonus, normalizeArenaData, buildArenaScreens,
    arenaRoomId, arenaGuardId, arenaMasterId, hallDoor
} from '../../arena.js';
import { SCREENS } from '../../story.js';
import { DECOR_NAMES } from '../../sprites/decor.js';
import {
    createSession, enterArena, leaveArena, inArena, tryMove, markEnemyDefeated, encounterFor, resetAfterDefeat,
    currentObjectiveText, isTerrainBlocked, START_SCREEN
} from '../../exploration.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const increasing = list => list.every((v, i) => i === 0 || v > list[i - 1]);
const nonDecreasing = list => list.every((v, i) => i === 0 || v >= list[i - 1]);
const arenaScreens = Object.values(SCREENS).filter(s => s.arena);

// Place le héros juste devant une sortie (côté intérieur) et la franchit.
function walkThrough(s, exit) {
    const screen = s.screens[s.data.screenId];
    const from = exit.x === 0 ? { x: 1, y: exit.y } : exit.x === screen.w - 1 ? { x: exit.x - 1, y: exit.y }
        : exit.y === 0 ? { x: exit.x, y: 1 } : { x: exit.x, y: exit.y - 1 };
    s.data.x = from.x; s.data.y = from.y; s.rt.grace = 5;
    return tryMove(s, exit.x - from.x, exit.y - from.y, { playerLevel: 20 });
}
const exitTo = (s, pred) => s.screens[s.data.screenId].exits.find(pred);

describe('Arène des Mille Flèches : cercles', () => {
    test('ouverte à partir du niveau 15', () => {
        expect(ARENA_MIN_LEVEL).toBe(15);
        expect(isArenaUnlocked(14)).toBe(false);
        expect(isArenaUnlocked(15)).toBe(true);
    });

    test('au moins 8 cercles, de plus en plus difficiles et rémunérateurs', () => {
        expect(ARENA_TIERS.length).toBeGreaterThanOrEqual(8);
        expect(ARENA_TIERS.map(t => t.id)).toEqual(ARENA_TIERS.map((_, i) => i + 1));
        expect(increasing(ARENA_TIERS.map(t => t.levelOffset))).toBe(true);
        expect(nonDecreasing(ARENA_TIERS.map(t => t.statMult))).toBe(true);
        expect(nonDecreasing(ARENA_TIERS.map(t => t.waves))).toBe(true);
        expect(increasing(ARENA_TIERS.map(t => t.rewardMult))).toBe(true);
        expect(increasing(ARENA_TIERS.map(t => t.clearGold))).toBe(true);
        const last = ARENA_TIERS[ARENA_TIERS.length - 1];
        expect(last.masterDuel).toMatchObject({ mirror: true });
        ARENA_TIERS.forEach(t => {
            expect(templateIds.has(t.master.templateId)).toBe(true);
            expect(t.master.intro).toHaveLength(2);
            expect(t.master.defeat.length).toBeGreaterThanOrEqual(2);
            expect(ARENA_BIOMES[`arena_${t.id}`]).toBeDefined();
            ARENA_BIOMES[`arena_${t.id}`].decor.forEach(d => expect(DECOR_NAMES).toContain(d));
        });
        ARENA_TEMPLATES.forEach(id => expect(templateIds.has(id)).toBe(true));
    });

    test('niveaux croissants dans un cercle ; dernier combat = maître', () => {
        ARENA_TIERS.forEach(t => {
            const levels = Array.from({ length: t.waves }, (_, i) => arenaWaveLevel(t.id, i + 1, 18));
            expect(nonDecreasing(levels)).toBe(true);
            expect(levels[0]).toBe(18 + t.levelOffset);
            expect(isChampionWave(t.id, t.waves)).toBe(true);
            expect(isChampionWave(t.id, t.waves - 1)).toBe(false);
        });
    });

    test('rencontre : règles de duel du maître, premier passage', () => {
        const t = arenaTier(7);
        const guard = arenaEncounterInfo({ arena: { tier: 7, wave: 1 } }, 20, []);
        const master = arenaEncounterInfo({ arena: { tier: 7, wave: t.waves } }, 20, []);
        expect(guard).toMatchObject({ level: 25, duel: t.duel, arena: { tier: 7, wave: 1, firstClear: false, statMult: t.statMult } });
        expect(master.duel).toEqual(t.masterDuel);
        expect(master.arena.firstClear).toBe(true);
        expect(arenaEncounterInfo({ arena: { tier: 7, wave: t.waves } }, 20, [7]).arena.firstClear).toBe(false);
    });

    test('renfort et prime', () => {
        expect(applyArenaScaling({ hp: 3, maxHp: 100, attack: 20, defense: 10 }, 1.5)).toEqual({ hp: 150, maxHp: 150, attack: 30, defense: 15 });
        expect(arenaRewardBonus(1, 2, 16).gold).toBeGreaterThan(arenaRewardBonus(1, 1, 16).gold);
        expect(arenaRewardBonus(5, 1, 16).xp).toBeGreaterThan(arenaRewardBonus(1, 1, 16).xp);
        const t = arenaTier(3);
        expect(arenaRewardBonus(3, t.waves, 16).gold).toBeGreaterThan(2 * arenaRewardBonus(3, t.waves - 1, 16).gold);
        expect(normalizeArenaData({ cleared: [2, '1', 99, 2], wins: 3 })).toEqual({ cleared: [1, 2], best: {}, wins: 3, returnTo: null });
    });
});

describe('Arène des Mille Flèches : salles à explorer', () => {
    test('un parvis à 8 portes, puis une salle par combat ; un gardien par salle, le maître dans la dernière', () => {
        const built = buildArenaScreens();
        expect(Object.keys(built).sort()).toEqual(arenaScreens.map(s => s.id).sort());
        const hall = SCREENS[ARENA_HALL];
        expect(hall.exits.filter(e => e.to && e.to.startsWith('arena_c'))).toHaveLength(ARENA_TIERS.length);
        expect(hall.exits.some(e => e.leaveArena)).toBe(true);
        ARENA_BIOMES.arena_hall.decor.forEach(d => expect(DECOR_NAMES).toContain(d));
        ARENA_TIERS.forEach(t => {
            for (let r = 1; r <= t.waves; r++) {
                const room = SCREENS[arenaRoomId(t.id, r)];
                expect(room).toBeDefined();
                expect(room.enemies).toHaveLength(1);
                const e = room.enemies[0];
                expect(templateIds.has(e.templateId)).toBe(true);
                expect(e.permanent).toBe(true);
                if (r < t.waves) {
                    expect(e.id).toBe(arenaGuardId(t.id, r));
                    expect(e.boss).toBeUndefined();
                    expect(room.exits.find(x => x.to === arenaRoomId(t.id, r + 1)).requires).toBe(e.id);
                } else {
                    expect(e.id).toBe(arenaMasterId(t.id));
                    expect(e.boss).toBeTruthy();
                    expect(e.name).toContain(t.master.name);
                    expect(room.exits.find(x => x.leaveArena).requires).toBe(e.id);
                }
                // retour possible vers la salle précédente (ou le parvis)
                const back = room.exits.find(x => x.x === 0);
                expect(back.to).toBe(r === 1 ? ARENA_HALL : arenaRoomId(t.id, r - 1));
            }
        });
    });

    test('sorties appariées, arrivées libres, entités sur des tuiles libres', () => {
        arenaScreens.forEach(s => {
            s.exits.filter(e => !e.leaveArena).forEach(e => {
                const target = SCREENS[e.to];
                expect(target).toBeDefined();
                expect(isTerrainBlocked(target, e.arrive.x, e.arrive.y)).toBe(false);
                expect(target.exits.some(x => x.to === s.id)).toBe(true);
            });
            [...s.enemies, { ...s.spawn }].forEach(p => expect(isTerrainBlocked(s, p.x, p.y)).toBe(false));
        });
        SCREENS[ARENA_HALL].exits.filter(e => !e.leaveArena).forEach(e => {
            const door = hallDoor(Number(e.to.match(/arena_c(\d+)/)[1]));
            expect([e.x, e.y]).toEqual([door.x, door.y]);
        });
        const doors = SCREENS[ARENA_HALL].exits.map(e => `${e.x},${e.y}`);
        expect(new Set(doors).size).toBe(doors.length);
    });

    test('entrer, traverser un cercle de salle en salle, battre le maître : le cercle suivant s\'ouvre', () => {
        const s = createSession({});
        const start = { ...s.data };
        expect(enterArena(s)).toBe(true);
        expect(inArena(s)).toBe(true);
        expect(s.data.screenId).toBe(ARENA_HALL);
        expect(currentObjectiveText(s)).toMatch(/cercles terminés/);
        // porte du cercle 2 fermée
        const door2 = exitTo(s, e => e.to === arenaRoomId(2, 1));
        expect(walkThrough(s, door2)).toMatchObject({ type: 'exitBlocked' });
        // cercle 1 : salle après salle
        expect(walkThrough(s, exitTo(s, e => e.to === arenaRoomId(1, 1)))).toMatchObject({ type: 'transition', to: arenaRoomId(1, 1) });
        const t1 = arenaTier(1);
        for (let r = 1; r < t1.waves; r++) {
            const next = exitTo(s, e => e.to === arenaRoomId(1, r + 1));
            expect(walkThrough(s, next)).toMatchObject({ type: 'exitBlocked' });   // gardien debout
            const enc = encounterFor(s, arenaGuardId(1, r), 20);
            expect(enc.arena).toMatchObject({ tier: 1, wave: r });
            expect(markEnemyDefeated(s, arenaGuardId(1, r)).filter(e => e.type === 'arenaCleared')).toEqual([]);
            expect(walkThrough(s, next)).toMatchObject({ type: 'transition' });
        }
        expect(currentObjectiveText(s)).toMatch(/Maîtresse Tong/);
        const master = encounterFor(s, arenaMasterId(1), 20);
        expect(master.boss).toBeTruthy();
        expect(master.introLines).toHaveLength(2);
        expect(master.arena.firstClear).toBe(true);
        const ev = markEnemyDefeated(s, arenaMasterId(1));
        expect(ev.map(e => e.type)).toEqual(['scene', 'arenaCleared']);
        expect(ev[1]).toMatchObject({ tier: 1, firstClear: true });
        expect(ev[1].next.id).toBe(2);
        expect(s.data.arena.cleared).toEqual([1]);
        expect(s.data.arena.best[1]).toBe(t1.waves);
        // la sortie de la salle du maître ramène hors de l'arène, au point d'entrée
        expect(walkThrough(s, exitTo(s, e => e.leaveArena))).toMatchObject({ type: 'transition', to: start.screenId });
        expect(inArena(s)).toBe(false);
        expect([s.data.x, s.data.y]).toEqual([start.x, start.y]);
        // de retour : gardiens remis en place, porte du cercle 2 ouverte, maître du cercle 1 sans prime de 1er passage
        enterArena(s);
        expect(s.data.defeated.some(id => id.startsWith('arena_c'))).toBe(false);
        expect(walkThrough(s, exitTo(s, e => e.to === arenaRoomId(2, 1)))).toMatchObject({ type: 'transition', to: arenaRoomId(2, 1) });
        expect(encounterFor(s, arenaMasterId(1), 20).arena.firstClear).toBe(false);
        expect(markEnemyDefeated(s, arenaMasterId(1)).find(e => e.type === 'arenaCleared').firstClear).toBe(false);
    });

    test('on peut sortir à tout moment ; une défaite expulse de l\'arène', () => {
        const s = createSession({});
        const start = s.data.screenId;
        expect(leaveArena(s)).toBe(false);                 // pas dans l'arène
        enterArena(s);
        expect(enterArena(s)).toBe(false);                 // déjà dedans
        walkThrough(s, exitTo(s, e => e.to === arenaRoomId(1, 1)));
        expect(leaveArena(s)).toBe(true);
        expect(s.data.screenId).toBe(start);
        expect(s.data.arena.returnTo).toBeNull();
        enterArena(s);
        walkThrough(s, exitTo(s, e => e.to === arenaRoomId(1, 1)));
        resetAfterDefeat(s);
        expect(inArena(s)).toBe(false);
        expect(s.data.screenId).toBe(start);
        // point de retour invalide : retour au village de départ
        enterArena(s);
        s.data.arena.returnTo = { screenId: 'inconnu', x: 0, y: 0 };
        leaveArena(s);
        expect(s.data.screenId).toBe(START_SCREEN);
    });

    test('ancienne sauvegarde sans données d\'arène', () => {
        const s = createSession({ screenId: START_SCREEN, x: SCREENS[START_SCREEN].spawn.x, y: SCREENS[START_SCREEN].spawn.y });
        expect(s.data.arena).toEqual({ cleared: [], best: {}, wins: 0, returnTo: null });
    });
});
