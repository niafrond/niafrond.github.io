// Quêtes des Gardiens Célestes (world/legends.js) : relique + boss unique + PNJ, et l'ultime de légende qu'elles rapportent.
import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import './fixtures/xhrFromDisk.js';
import { SCREENS, QUESTS } from '../../story.js';
import { createSession, teleportToScreen, talkToNpc, openChest, markEnemyDefeated, questStatus } from '../../exploration.js';
import { LEGENDS } from '../../world/legends.js';
import { getQuestUltimates, getUltimateById } from '../../ultimates.js';
import { REGION_LEVEL } from '../../world/index.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));
const questOf = l => QUESTS.find(q => q.id === l.questId);

describe('catalogue des légendes', () => {
    test('quatre Gardiens, un par région, du Sud au dernier : niveaux croissants', () => {
        expect(LEGENDS.map(l => l.region)).toEqual(['volcan', 'fleuve', 'fauves', 'fusang']);
        expect(LEGENDS.map(l => l.level)).toEqual([...LEGENDS.map(l => l.level)].sort((a, b) => a - b));
        LEGENDS.forEach(l => expect(l.level).toBeGreaterThan(REGION_LEVEL[l.region]));   // un boss plus fort que la région où il vit
    });

    test('chaque quête rapporte un ultime de légende, et chaque ultime de légende a exactement une quête', () => {
        LEGENDS.forEach(l => {
            const quest = questOf(l);
            expect(quest).toBeDefined();
            const spell = getUltimateById(l.ultimate);
            expect(spell?.unlock?.quest).toBe(l.questId);
            expect(quest.reward.ultimate).toBe(l.ultimate);
            expect(quest.reward.fragment).toBe(`Ultime : ${spell.name}`);
            expect(spell.minLevel).toBeLessThanOrEqual(l.level);   // utilisable dès que le Gardien peut être vaincu
        });
        getQuestUltimates().forEach(sp => expect(LEGENDS.filter(l => l.ultimate === sp.id)).toHaveLength(1));
        getQuestUltimates().forEach(sp => expect(QUESTS.filter(q => q.id === sp.unlock.quest)).toHaveLength(1));
    });

    test('le Gardien est un modèle d\'ennemi connu, déclaré boss unique et permanent', () => {
        LEGENDS.forEach(l => {
            expect(templateIds.has(l.enemy.templateId)).toBe(true);
            const boss = SCREENS[`${l.region}_wild`].enemies.find(e => e.id === l.enemy.id);
            expect(boss).toMatchObject({ templateId: l.enemy.templateId, name: l.enemy.name, permanent: true, boss: { name: l.enemy.name, level: l.level } });
        });
    });

    test('PNJ dans le village, relique et Gardien dans la zone sauvage, sur des cases libres et distinctes', () => {
        LEGENDS.forEach(l => {
            const village = SCREENS[`${l.region}_village`], wild = SCREENS[`${l.region}_wild`];
            const npc = village.npcs.find(n => n.id === l.giver.id);
            const chest = wild.chests.find(c => c.id === l.chest.id);
            const boss = wild.enemies.find(e => e.id === l.enemy.id);
            expect(npc && chest && boss).toBeTruthy();
            const cells = [...wild.chests, ...wild.enemies, ...wild.npcs].map(e => `${e.x},${e.y}`);
            expect(new Set(cells).size).toBe(cells.length);
            expect(village.npcs.filter(n => `${n.x},${n.y}` === `${npc.x},${npc.y}`)).toHaveLength(1);
        });
    });

    test('quête annexe sans condition de classe : ni classe requise, ni quête préalable', () => {
        LEGENDS.forEach(l => {
            const quest = questOf(l);
            expect(quest.side).toBe(true);
            expect(quest.requires).toEqual([]);
            expect(quest.class).toBeUndefined();
            expect(quest.giver).toBe(l.giver.id);
            expect(quest.turnIn).toBe(l.giver.id);
            expect(quest.objectives.map(o => [o.type, o.target])).toEqual([['chest', l.chest.id], ['kill', l.enemy.id]]);
            expect(quest.offer.length).toBeGreaterThan(0);
            expect(quest.hint.length).toBeGreaterThan(0);
            expect(quest.complete.length).toBeGreaterThan(0);
        });
    });
});

describe('parcours complet d\'une quête de légende', () => {
    test.each(LEGENDS.map(l => [l.questId, l]))('%s : accepter, relique, Gardien, remise → ultime rapporté', (id, l) => {
        const session = createSession(null);
        expect(questStatus(session, questOf(l))).toBe('available');

        teleportToScreen(session, `${l.region}_village`);
        const offer = talkToNpc(session, l.giver.id);
        expect(offer.events.some(e => e.type === 'questStarted' && e.quest.id === l.questId)).toBe(true);
        expect(questStatus(session, questOf(l))).toBe('active');

        teleportToScreen(session, `${l.region}_wild`);
        expect(openChest(session, l.chest.id).events.some(e => e.type === 'chestOpened')).toBe(true);
        expect(questStatus(session, questOf(l))).toBe('active');   // le Gardien n'est pas encore vaincu
        markEnemyDefeated(session, l.enemy.id);
        expect(questStatus(session, questOf(l))).toBe('ready');

        teleportToScreen(session, `${l.region}_village`);
        const done = talkToNpc(session, l.giver.id);
        const completed = done.events.find(e => e.type === 'questCompleted');
        expect(completed.quest.id).toBe(l.questId);
        expect(completed.reward.ultimate).toBe(l.ultimate);
        expect(completed.xp).toBeGreaterThan(0);
        expect(questStatus(session, questOf(l))).toBe('done');
    });

    test('la quête de l\'ultime ne se valide pas sans avoir vaincu le Gardien', () => {
        const l = LEGENDS[0];
        const session = createSession(null);
        teleportToScreen(session, `${l.region}_village`);
        talkToNpc(session, l.giver.id);
        teleportToScreen(session, `${l.region}_wild`);
        openChest(session, l.chest.id);
        teleportToScreen(session, `${l.region}_village`);
        expect(talkToNpc(session, l.giver.id).events?.some(e => e.type === 'questCompleted') ?? false).toBe(false);
    });
});
