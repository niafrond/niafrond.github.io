// Recrues sur la route : chaque maître de classe attend le héros près du passage du village vers la zone sauvage ; la discussion s'ouvre quand le héros
// passe à côté ou essaie de quitter le village ; le maître rejoint alors l'équipe, puis un petit combat amical (sans embuscade) le fait découvrir.
import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { createSession, tryMove, talkToNpc, pendingRecruits, encounterFor, questStatus, findPath, isTerrainBlocked } from '../../exploration.js';
import { CLASS_TRIAL_QUESTS, RECRUIT_FOES } from '../../world/classTrials.js';
import { SCREENS } from '../../story.js';
import { createMapEnemy } from '../../enemies.js';

const REGION_OF = { monk: 'rizieres', barbarian: 'volcan', alchemist: 'volcan', templar: 'gobi', sorcerer: 'fleuve', shaman: 'bambous' };
const SIDE = { rizieres: 'south', volcan: 'east', gobi: 'south', fleuve: 'east', bambous: 'east' };
const STEP = { south: [0, 1], east: [1, 0] };

// Partie au village de la région, avec les conditions de la quête de rencontre remplies (quêtes exigées terminées, quête de départ commencée).
function sessionFor(quest, patch = {}) {
    const region = REGION_OF[quest.reward.class], village = SCREENS[`${region}_village`];
    const quests = Object.fromEntries((quest.requires || []).map(id => [id, 'done']));
    if (quest.startWhen?.quest) quests[quest.startWhen.quest] = 'active';
    return createSession({ screenId: village.id, x: village.spawn.x, y: village.spawn.y, quests, ...patch });
}
const master = quest => SCREENS[`${REGION_OF[quest.reward.class]}_village`].npcs.find(n => n.id === quest.giver);

describe('recrues sur la route : placement', () => {
    test.each(CLASS_TRIAL_QUESTS.map(q => [q.reward.class, q]))('%s : le maître attend près du passage vers la zone sauvage, sans fermer la route', (cls, quest) => {
        const region = REGION_OF[cls], village = SCREENS[`${region}_village`], npc = master(quest);
        expect(npc.recruit).toEqual({ quest: quest.id, classId: cls, foe: RECRUIT_FOES[cls] });
        const conn = village.connections[SIDE[region]];
        expect(conn.to).toBe(`${region}_wild`);
        const [a, b] = conn.range, mid = Math.floor((a + b) / 2);
        const gate = SIDE[region] === 'south' ? { x: mid, y: village.h - 1 } : { x: village.w - 1, y: mid };
        expect(Math.abs(npc.x - gate.x) + Math.abs(npc.y - gate.y)).toBeLessThanOrEqual(12);   // sur le chemin, pas au fond du village
        const s = sessionFor(quest);
        expect(isTerrainBlocked(village, npc.x, npc.y, false)).toBe(false);
        expect(findPath(s, gate.x, gate.y)).toBeTruthy();   // la route vers le passage reste libre
    });
});

describe('recrues sur la route : déclenchement', () => {
    test('à côté du maître : le pas qui amène le héros à côté annonce la discussion', () => {
        const quest = CLASS_TRIAL_QUESTS.find(q => q.reward.class === 'monk'), npc = master(quest);
        const s = sessionFor(quest);
        expect(pendingRecruits(s).map(n => n.id)).toEqual([npc.id]);
        const village = SCREENS.rizieres_village;
        const free = (x, y) => !isTerrainBlocked(village, x, y, false) && !village.npcs.some(n => n.x === x && n.y === y) && !village.chests.some(c => c.x === x && c.y === y);
        const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => free(npc.x + dx, npc.y + dy) && free(npc.x + 2 * dx, npc.y + 2 * dy));
        s.data.x = npc.x + 2 * dir[0]; s.data.y = npc.y + 2 * dir[1];
        const res = tryMove(s, -dir[0], -dir[1]);
        expect(res).toMatchObject({ type: 'moved', autoTalk: npc.id });
    });

    test.each(CLASS_TRIAL_QUESTS.map(q => [q.reward.class, q]))('%s : essayer de quitter le village ouvre la discussion, sans quitter la carte', (cls, quest) => {
        const region = REGION_OF[cls], village = SCREENS[`${region}_village`], conn = village.connections[SIDE[region]];
        const s = sessionFor(quest);
        const [dx, dy] = STEP[SIDE[region]], mid = Math.floor((conn.range[0] + conn.range[1]) / 2);
        s.data.x = SIDE[region] === 'south' ? mid : village.w - 1;
        s.data.y = SIDE[region] === 'south' ? village.h - 1 : mid;
        const res = tryMove(s, dx, dy);
        expect(res).toEqual({ type: 'talk', npcId: quest.giver, recruit: true });
        expect(s.data.screenId).toBe(village.id);
    });

    test("pas de discussion tant que la quête est verrouillée (Shennong après Sun Wukong) ni une fois la rencontre faite", () => {
        const alchemist = CLASS_TRIAL_QUESTS.find(q => q.reward.class === 'alchemist');
        const locked = createSession({ screenId: 'volcan_village', x: SCREENS.volcan_village.spawn.x, y: SCREENS.volcan_village.spawn.y, quests: { q_sun_1: 'done' } });
        expect(pendingRecruits(locked).map(n => n.id)).toEqual(['trainer_barbarian']);   // Sun Wukong d'abord ; Shennong attend sa quête
        talkToNpc(locked, 'trainer_barbarian');
        expect(pendingRecruits(locked).map(n => n.id)).toEqual(['trainer_alchemist']);
        talkToNpc(locked, 'trainer_alchemist');
        expect(pendingRecruits(locked)).toEqual([]);
        expect(questStatus(locked, alchemist)).toBe('done');
    });
});

describe('recrues sur la route : rencontre', () => {
    test.each(CLASS_TRIAL_QUESTS.map(q => [q.reward.class, q]))('%s : il rejoint l\'équipe, puis un petit combat amical le fait découvrir', (cls, quest) => {
        const s = sessionFor(quest);
        const talk = talkToNpc(s, quest.giver);
        expect(talk.lines).toEqual([...quest.offer, ...quest.complete]);
        expect(talk.recruit).toEqual({ classId: cls });
        const done = talk.events.find(e => e.type === 'questCompleted');
        expect(done.reward.class).toBe(cls);   // la vue donne la classe : « X a rejoint votre équipe »
        expect(s.data.quests[quest.id]).toBe('done');
        // combat de découverte : ennemi de la région, plus faible que le niveau de la zone, aucune embuscade, aucun entraînement imposé
        expect(talk.combat).toMatch(/^wild:/);
        const enc = encounterFor(s, talk.combat, 10);
        expect(enc).toMatchObject({ templateId: RECRUIT_FOES[cls].templateId, name: RECRUIT_FOES[cls].name, boss: null, duel: null, training: null });
        expect(enc.friendly).toBe(true);   // PV réduits (game.js, newEnemy) : un petit combat
        expect(enc.prep.enemyFirst).toBe(false);
        expect(enc.prep.lines).toEqual([]);
        expect(createMapEnemy(enc).hp).toBeGreaterThan(0);
        // la deuxième conversation est ordinaire : plus de combat ni de nouvelle rencontre
        const again = talkToNpc(s, quest.giver);
        expect(again.combat).toBeUndefined();
        expect(again.recruit).toBeUndefined();
    });
});

describe('recrues sur la route : câblage de la vue', () => {
    test("l'annonce « a rejoint votre équipe » précède le combat, qui part à sa fermeture ; la discussion s'ouvre d'elle-même", async () => {
        const { readFileSync } = await import('node:fs');
        const view = readFileSync(new URL('../../explorationView.js', import.meta.url), 'utf8');
        expect(view).toMatch(/a rejoint votre équipe !/);
        expect(view).toMatch(/\(\) => \{ if \(talk\.combat\) startEncounter\(talk\.combat\); \}/);
        expect(view).toMatch(/res\.type === 'moved' && res\.autoTalk/);
    });
});
