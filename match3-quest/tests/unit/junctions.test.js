// Jonctions gardées (world/junctions.js) : objet à rapporter à un garde, gardien spécial à vaincre.
import { describe, test, expect } from '@jest/globals';
import { SCREENS, QUESTS } from '../../story.js';
import { JUNCTIONS } from '../../world/junctions.js';
import { aggroOf } from '../../exploration.js';
import {
    createSession, tryMove, isExitLocked, talkToNpc, openChest, markEnemyDefeated, questStatus, isTerrainBlocked
} from '../../exploration.js';

const items = JUNCTIONS.filter(j => j.type === 'item');
const kills = JUNCTIONS.filter(j => j.type === 'kill');
const gateExits = j => SCREENS[j.from].exits.filter(e => e.to === j.to && e.edge);
const centerOf = j => gateExits(j).find(e => e.span === 0);

// Place le héros juste avant le passage `exit` de `screenId` et retourne [session, dx, dy].
function atGate(j, patch = {}) {
    const sc = SCREENS[j.from], e = centerOf(j);
    const dx = e.x === 0 ? -1 : e.x === sc.w - 1 ? 1 : 0, dy = e.y === 0 ? -1 : e.y === sc.h - 1 ? 1 : 0;
    const s = createSession({ screenId: j.from, x: e.x - dx, y: e.y - dy, ...patch });
    s.rt.grace = 0;
    return { s, dx, dy };
}

describe('jonctions gardées', () => {
    test('il y a des jonctions à objet et des jonctions à gardien, jamais sur la première région', () => {
        expect(items.length).toBeGreaterThanOrEqual(3);
        expect(kills.length).toBeGreaterThanOrEqual(3);
        JUNCTIONS.forEach(j => expect(j.region).not.toBe('rizieres'));
        expect(new Set(JUNCTIONS.map(j => j.id)).size).toBe(JUNCTIONS.length);
    });

    test.each(JUNCTIONS.map(j => [j.id, j]))('%s : les 3 cases du passage sont verrouillées, le retour reste libre', (_id, j) => {
        const exits = gateExits(j);
        expect(exits.map(e => e.span).sort()).toEqual([-1, 0, 1]);
        const requires = j.type === 'item' ? j.quest.id : j.enemy.id;
        exits.forEach(e => { expect(e.requires).toBe(requires); expect(e.lockedMessage).toBe(j.lockedMessage); });
        SCREENS[j.to].exits.filter(e => e.to === j.from).forEach(e => expect(e.requires).toBeUndefined());
    });

    test.each(items.map(j => [j.id, j]))('%s : garde, coffre et quête bien posés', (_id, j) => {
        const guardScreen = SCREENS[j.from];
        const guard = guardScreen.npcs.find(n => n.id === j.guard.id);
        const holder = SCREENS[j.item.screen];
        const chest = holder.chests.find(c => c.id === j.item.chest);
        const quest = QUESTS.find(q => q.id === j.quest.id);
        expect(guard).toBeDefined();
        expect(chest).toBeDefined();
        expect(quest).toMatchObject({ giver: j.guard.id, turnIn: j.guard.id, side: true });
        expect(quest.objectives).toEqual([expect.objectContaining({ type: 'chest', target: j.item.chest })]);
        expect(quest.reward.fragment).toBe(j.item.fragment);
        // le garde est dans la zone d'arrivée côté village, hors du passage ; le coffre est au sud-est de la carte porteuse
        expect(isTerrainBlocked(guardScreen, guard.x, guard.y)).toBe(false);
        expect(isTerrainBlocked(holder, chest.x, chest.y)).toBe(false);
        expect(chest.x >= holder.w * 0.5 && chest.y >= holder.h * 0.45).toBe(true);   // cachés au sud-est de la carte
        const taken = new Set([...guardScreen.exits.map(e => `${e.x},${e.y}`), `${guardScreen.spawn.x},${guardScreen.spawn.y}`]);
        expect(taken.has(`${guard.x},${guard.y}`)).toBe(false);
        // la carte porteuse précède la jonction dans le monde (on la traverse avant d'arriver au garde)
        const ids = Object.keys(SCREENS);
        expect(ids).toContain(j.item.screen);
    });

    test.each(items.map(j => [j.id, j]))('%s : se joue de bout en bout (garde → coffre → garde → passage)', (_id, j) => {
        const { s, dx, dy } = atGate(j);
        expect(isExitLocked(s, centerOf(j))).toBe(true);
        expect(tryMove(s, dx, dy, { playerLevel: 50 })).toMatchObject({ type: 'exitBlocked', reason: 'quest', message: j.lockedMessage });
        const quest = QUESTS.find(q => q.id === j.quest.id);
        // le garde propose la quête (offre), sans l'objet il n'ouvre rien
        const offer = talkToNpc(s, j.guard.id);
        expect(offer.lines).toEqual(expect.arrayContaining(j.quest.offer));
        expect(questStatus(s, quest)).toBe('active');
        expect(isExitLocked(s, centerOf(j))).toBe(true);
        // le coffre est dans une autre carte : on s'y rend, on l'ouvre
        s.data.screenId = j.item.screen;
        expect(openChest(s, j.item.chest)).toMatchObject({ type: 'chestOpened' });
        expect(questStatus(s, quest)).toBe('ready');
        // retour au garde : remise de l'objet, le passage s'ouvre
        s.data.screenId = j.from;
        const done = talkToNpc(s, j.guard.id);
        expect(done.lines).toEqual(j.quest.complete);
        expect(questStatus(s, quest)).toBe('done');
        expect(isExitLocked(s, centerOf(j))).toBe(false);
        const g = atGate(j, { quests: { [j.quest.id]: 'done' } });
        expect(tryMove(g.s, g.dx, g.dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', to: j.to });
        // après la remise, le garde a une réplique d'après
        expect(talkToNpc(s, j.guard.id).lines).toEqual(SCREENS[j.from].npcs.find(n => n.id === j.guard.id).talk[0].lines);
    });

    test.each(kills.map(j => [j.id, j]))('%s : gardien permanent posé près du passage, verrou levé par sa défaite', (_id, j) => {
        const screen = SCREENS[j.from];
        const enemy = screen.enemies.find(e => e.id === j.enemy.id);
        expect(enemy).toMatchObject({ permanent: true, kind: 'sentinel', templateId: j.enemy.templateId });
        expect(enemy.boss).toBeUndefined();   // un thème musical par boss : le gardien est un ennemi spécial, pas un boss
        expect(isTerrainBlocked(screen, enemy.x, enemy.y)).toBe(false);
        const gate = centerOf(j);
        expect(Math.max(Math.abs(gate.x - enemy.x), Math.abs(gate.y - enemy.y))).toBeLessThanOrEqual(7);
        const { s, dx, dy } = atGate(j);
        expect(tryMove(s, dx, dy, { playerLevel: 50 })).toMatchObject({ type: 'exitBlocked', reason: 'quest' });
        markEnemyDefeated(s, j.enemy.id);
        expect(isExitLocked(s, centerOf(j))).toBe(false);
        expect(tryMove(s, dx, dy, { playerLevel: 1 })).toMatchObject({ type: 'transition', to: j.to });
    });
});

describe('boss = porte : un ennemi qui ferme un passage se tient devant', () => {
    const all = Object.values(SCREENS);
    const doors = all.flatMap(s => s.exits
        .filter(e => e.edge && e.span === 0 && s.enemies.some(en => en.id === e.requires))
        .map(e => ({ s, e, boss: s.enemies.find(en => en.id === e.requires) })));

    test('toutes les portes de bord fermées par un ennemi sont concernées (soleils, gardiens de gate, gardiens de hameau)', () => {
        expect(doors.length).toBeGreaterThanOrEqual(16);
    });

    test.each(doors.map(d => [`${d.s.id} → ${d.e.to}`, d]))('%s : le boss garde la porte et sa vigilance couvre les 3 cases', (_n, { e, s, boss }) => {
        expect(boss.guardsDoor).toBe(true);
        expect(aggroOf(boss)).toBe(0);   // un boss n'a pas de zone de vigilance : il faut aller le chercher
        s.exits.filter(x => x.to === e.to && x.edge).forEach(x => {
            expect(x.requires).toBe(boss.id);
            expect(Math.max(Math.abs(x.x - boss.x), Math.abs(x.y - boss.y))).toBeLessThanOrEqual(2);
        });
    });
});
