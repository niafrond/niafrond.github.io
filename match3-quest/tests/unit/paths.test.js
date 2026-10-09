import { SCREENS, QUESTS } from '../../story.js';
import { COMPANIONS, BANTER } from '../../companions.js';
import {
    createSession, isShielded, markEnemyDefeated, talkToNpc, progressReached, aliveEnemies,
    collectBanter, companionsOf, startNewGamePlus, teleportToScreen
} from '../../exploration.js';

const screens = Object.values(SCREENS).filter(s => !s.arena);
const PARLEY_SUNS = ['sun_2', 'sun_3', 'sun_5', 'sun_6', 'sun_8', 'sun_9'];
const sunEntry = id => screens.flatMap(s => s.enemies.map(e => ({ s, e }))).find(x => x.e.id === id);
const allIds = new Set([
    ...QUESTS.map(q => q.id),
    ...screens.flatMap(s => [...s.enemies, ...s.npcs, ...s.chests].map(e => e.id))
]);

describe('chemins multiples vers les soleils (risque, relationnel, découverte)', () => {
    test.each(PARLEY_SUNS)('%s : gardes (risque), pourparlers (relationnel) et affaiblissement (découverte)', id => {
        const { s, e: sun } = sunEntry(id);
        expect(sun.shieldedBy).toBeTruthy();
        expect(sun.weakenedBy.length).toBeGreaterThanOrEqual(2);
        expect(sun.unsealedBy).toHaveLength(1);
        const npcId = sun.unsealedBy[0];
        const npc = s.npcs.find(n => n.id === npcId);
        expect(npc).toBeDefined();
        expect(npc.parley.lines.length).toBeGreaterThanOrEqual(2);
        expect(npc.showWhen).toBeTruthy();
        const guards = s.enemies.filter(e => e.group === sun.shieldedBy);
        expect(guards.length).toBeGreaterThanOrEqual(2);
        guards.forEach(g => expect(g.hideWhen).toBe(npcId));
        expect(allIds.has(npc.showWhen)).toBe(true);
        expect(allIds.has(npc.id)).toBe(true);
    });

    test('risque : abattre les gardes lève le bouclier', () => {
        const { s, e: sun } = sunEntry('sun_2');
        const session = createSession({});
        expect(isShielded(session, sun)).toBe(true);
        s.enemies.filter(e => e.group === sun.shieldedBy).forEach(g => markEnemyDefeated(session, g.id));
        expect(isShielded(session, sun)).toBe(false);
    });

    test('relationnel : le pourparler ne se propose qu\'après la quête annexe, puis lève le bouclier et écarte les gardes sans combat', () => {
        const { s, e: sun } = sunEntry('sun_2');
        const npc = s.npcs.find(n => n.id === sun.unsealedBy[0]);
        const session = createSession({ screenId: s.id, x: npc.x, y: npc.y + 1 });
        session.rt.grace = 0;
        expect(talkToNpc(session, npc.id)).toBeNull();                         // pas encore apparu
        session.data.quests[npc.showWhen] = 'done';
        session.data.defeated.push(npc.showWhen);
        expect(isShielded(session, sun)).toBe(true);
        const res = talkToNpc(session, npc.id);
        expect(res.type).toBe('dialog');
        expect(res.lines).toEqual(npc.parley.lines);
        expect(res.events.some(ev => ev.type === 'parley')).toBe(true);
        expect(progressReached(session, npc.id)).toBe(true);
        expect(isShielded(session, sun)).toBe(false);
        const guards = s.enemies.filter(e => e.group === sun.shieldedBy).map(g => g.id);
        expect(aliveEnemies(session).filter(e => guards.includes(e.def.id))).toHaveLength(0);
        // la conversation suivante n'est plus un pourparler
        expect(talkToNpc(session, npc.id).lines).not.toEqual(npc.parley.lines);
    });

    test('un pourparler d\'un autre soleil ne lève pas le bouclier', () => {
        const session = createSession({});
        session.data.talked.push('parley_sun3');
        expect(isShielded(session, sunEntry('sun_2').e)).toBe(true);
    });
});

describe('compagnons et dialogues contextuels', () => {
    test('compagnons : ids uniques, nom, titre, condition de recrutement valide', () => {
        expect(COMPANIONS.length).toBeGreaterThanOrEqual(3);
        expect(new Set(COMPANIONS.map(c => c.id)).size).toBe(COMPANIONS.length);
        COMPANIONS.forEach(c => {
            expect(c.name && c.title).toBeTruthy();
            if (c.joinWhen) [].concat(c.joinWhen).forEach(id => expect(allIds.has(id)).toBe(true));
            if (c.npc) expect(allIds.has(c.npc)).toBe(true);
        });
    });

    test('dialogues : ids uniques, références valides, bulles courtes, contenu suffisant', () => {
        expect(BANTER.length).toBeGreaterThanOrEqual(24);
        expect(new Set(BANTER.map(b => b.id)).size).toBe(BANTER.length);
        const compIds = new Set(COMPANIONS.map(c => c.id));
        const screenIds = new Set(screens.map(s => s.id));
        BANTER.forEach(b => {
            [].concat(b.companion).forEach(id => expect(compIds.has(id)).toBe(true));
            if (b.screen) [].concat(b.screen).forEach(id => expect(screenIds.has(id)).toBe(true));
            [b.whenDone, b.unless].filter(Boolean).forEach(c => [].concat(c).forEach(id => expect(allIds.has(id)).toBe(true)));
            const scenes = b.scenes || [{ speaker: b.speaker, lines: b.lines }];
            scenes.forEach(sc => {
                expect(sc.speaker?.name).toBeTruthy();
                expect(sc.lines.length).toBeGreaterThan(0);
                sc.lines.forEach(l => expect(l.length).toBeLessThanOrEqual(170));
            });
        });
    });

    test('au moins deux répliques exclusives (relation qui évolue selon le choix)', () => {
        expect(BANTER.filter(b => b.unless).length).toBeGreaterThanOrEqual(3);
    });

    test('collectBanter : rien sans compagnon, une seule fois, jamais plus de `limit` scènes, sauvegardé et remis à zéro en Nouvelle Partie +', () => {
        const session = createSession({});
        expect(companionsOf(session).length).toBeLessThan(COMPANIONS.length);
        const joinable = COMPANIONS.find(c => c.joinWhen);
        [].concat(joinable.joinWhen).forEach(id => { session.data.defeated.push(id); session.data.quests[id] = 'done'; });
        const entry = BANTER.find(b => [].concat(b.companion).every(id => companionsOf(session).some(c => c.id === id)) && !b.screen && !b.whenDone);
        if (entry) {
            const first = collectBanter(session, 99);
            expect(first.some(ev => ev.banter === entry.id)).toBe(true);
            expect(collectBanter(session, 99).some(ev => ev.banter === entry.id)).toBe(false);
            expect(session.data.banterSeen).toContain(entry.id);
        }
        expect(collectBanter(createSession({}), 1).length).toBeLessThanOrEqual(1);
        session.data.ended = true;
        startNewGamePlus(session);
        expect(session.data.banterSeen).toEqual([]);
    });
});
