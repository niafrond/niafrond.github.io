// Monde aquatique, Pas de Yu (yubu) et cheval : marcher sur l'eau, accès à la Mer des Mille Îlots.
import { describe, test, expect } from '@jest/globals';
import { SCREENS, QUESTS } from '../../story.js';
import {
    createSession, tryMove, findPath, isTerrainBlocked, canWalkOnWater, YUBU_QUEST, isExitLocked, talkToNpc, openChest, questStatus,
    isRiding, isOnLiquid, autoDismount, toggleMount
} from '../../exploration.js';
import { YUBU_QUEST_ID, ARCHIPEL_ID, ISLE_ID } from '../../world/aquatic.js';

const inRects = (rects, x, y) => rects.some(([rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh);

describe('Pas de Yu : marcher sur l\'eau', () => {
    test('la quête qui l\'enseigne est celle du moteur', () => expect(YUBU_QUEST).toBe(YUBU_QUEST_ID));

    test('sans le Pas de Yu les mares bloquent ; avec, on les traverse (terrain, déplacement, chemin)', () => {
        const screen = SCREENS.rizieres_village;
        const [lx, ly] = [8, 6];   // la mare du village des Rizières (la couronne d'eau des bords n'est pas un bon repère)
        expect(isTerrainBlocked(screen, lx, ly)).toBe(true);
        expect(isTerrainBlocked(screen, lx, ly, true)).toBe(false);
        expect(isTerrainBlocked(screen, screen.obstacles[0][0], screen.obstacles[0][1], true)).toBe(true);   // un mur reste un mur
        // juste à gauche de la mare : on ne peut pas y entrer sans le Pas de Yu
        const base = { screenId: screen.id, x: lx - 1, y: ly };
        const free = createSession(base);
        expect(canWalkOnWater(free)).toBe(false);
        expect(isTerrainBlocked(screen, free.data.x, free.data.y)).toBe(false);
        expect(tryMove(free, 1, 0, { playerLevel: 5 })).toEqual({ type: 'blocked' });
        expect(findPath(free, lx, ly)).toBeNull();
        const yubu = createSession({ ...base, quests: { [YUBU_QUEST]: 'done' } });
        expect(canWalkOnWater(yubu)).toBe(true);
        expect(tryMove(yubu, 1, 0, { playerLevel: 5 })).toMatchObject({ type: 'moved' });
        expect([yubu.data.x, yubu.data.y]).toEqual([lx, ly]);
        expect(findPath(yubu, lx + 1, ly)).not.toBeNull();
    });

    test('la quête de Gui : deux reliques cachées (Tonnerre, Gobi), remise à Gui, et la mer s\'ouvre', () => {
        const quest = QUESTS.find(q => q.id === YUBU_QUEST_ID);
        expect(quest).toMatchObject({ giver: 'gui_turtle', turnIn: 'gui_turtle', side: true });
        expect(quest.reward.fragment).toBe('Pas de Yu');
        expect(quest.objectives.map(o => o.target)).toEqual(['yu_scroll_tonnerre', 'yu_stele_gobi']);
        quest.objectives.forEach(o => {
            const holder = Object.values(SCREENS).find(sc => sc.chests.some(c => c.id === o.target));
            expect(holder.id).toMatch(/^(tonnerre|gobi)_wild$/);
            const c = holder.chests.find(x => x.id === o.target);
            expect(c.x >= holder.core.w || c.y >= holder.core.h).toBe(true);   // dans le terrain agrandi
        });
        const gate = SCREENS.mer_hamlet.exits.find(e => e.to === ARCHIPEL_ID && e.span === 0);
        const gui = SCREENS.fleuve_h_tortue.npcs.find(n => n.id === 'gui_turtle');
        const s = createSession({ screenId: 'fleuve_h_tortue', x: gui.x, y: gui.y + 1 });
        expect(isExitLocked(s, gate)).toBe(true);
        expect(talkToNpc(s, 'gui_turtle').lines).toEqual(expect.arrayContaining(quest.offer));
        quest.objectives.forEach(o => {
            s.data.screenId = Object.values(SCREENS).find(sc => sc.chests.some(c => c.id === o.target)).id;
            expect(openChest(s, o.target)).toMatchObject({ type: 'chestOpened' });
        });
        expect(questStatus(s, quest)).toBe('ready');
        s.data.screenId = 'fleuve_h_tortue';
        expect(talkToNpc(s, 'gui_turtle').lines).toEqual(quest.complete);
        expect(canWalkOnWater(s)).toBe(true);
        expect(isExitLocked(s, gate)).toBe(false);
    });
});

describe('Monde aquatique', () => {
    const archipel = SCREENS[ARCHIPEL_ID], isle = SCREENS[ISLE_ID];

    test('deux cartes de mer, région mer, eaux franchissables (aquatic), accès par l\'Anse des Coquillages', () => {
        [archipel, isle].forEach(s => {
            expect(s).toMatchObject({ region: 'mer', aquatic: true });
            expect(s.liquids.length).toBeGreaterThan(0);
            const waterTile = [s.liquids[0][0], s.liquids[0][1]];
            expect(isTerrainBlocked(s, waterTile[0], waterTile[1])).toBe(false);   // on n'y entre qu'avec le Pas de Yu
        });
        const gates = SCREENS.mer_hamlet.exits.filter(e => e.to === ARCHIPEL_ID);
        expect(gates.map(e => e.span).sort()).toEqual([-1, 0, 1]);
        gates.forEach(e => expect(e.requires).toBe(YUBU_QUEST_ID));
        archipel.exits.filter(e => e.to === 'mer_hamlet').forEach(e => expect(e.requires).toBeUndefined());
        expect(archipel.exits.some(e => e.to === ISLE_ID)).toBe(true);
        expect(isle.exits.some(e => e.to === ARCHIPEL_ID)).toBe(true);
    });

    test('entités sur des cases libres, îles atteignables à pied sur l\'eau, trésor et gardien sur l\'île', () => {
        [archipel, isle].forEach(s => {
            [...s.npcs, ...s.chests, ...s.enemies].forEach(e => expect(isTerrainBlocked(s, e.x, e.y)).toBe(false));
            s.enemies.filter(e => e.patrol).forEach(e => e.patrol.forEach(([x, y]) => expect(isTerrainBlocked(s, x, y)).toBe(false)));
        });
        expect(archipel.chests).toHaveLength(3);
        expect(isle.chests.map(c => c.id)).toEqual(['mer_isle_tresor']);
        expect(isle.enemies.find(e => e.id === 'mer_ile_dragon_guardian')).toMatchObject({ permanent: true, templateId: 'frost_dragon' });
        // sur l'archipel les serpents patrouillent à la surface de l'eau
        const onWater = archipel.enemies.filter(e => e.patrol && inRects(archipel.liquids, e.x, e.y));
        expect(onWater.length).toBeGreaterThanOrEqual(2);
    });

    test('depuis l\'entrée, on atteint toutes les îles à pied (l\'eau est franchissable)', () => {
        const s = createSession({ screenId: ARCHIPEL_ID, x: archipel.spawn.x, y: archipel.spawn.y, quests: { [YUBU_QUEST]: 'done' } });
        archipel.chests.forEach(c => expect(findPath(s, c.x, c.y)).not.toBeNull());
        archipel.exits.forEach(e => expect(findPath(s, e.x, e.y)).not.toBeNull());
    });
});

describe('cheval : monter / descendre, descente automatique sur l\'eau', () => {
    const screen = SCREENS.rizieres_village;
    const [lx, ly] = [8, 6];   // mare du village des Rizières

    test('sans monture, rien ne se passe ; avec, on est en selle par défaut', () => {
        const s = createSession({});
        expect(isRiding(s, false)).toBe(false);
        expect(toggleMount(s, false)).toMatchObject({ type: 'none' });
        expect(isRiding(s, true)).toBe(true);
    });

    test('la touche fait descendre puis remonter sur la terre ferme', () => {
        const s = createSession({});
        expect(toggleMount(s, true)).toMatchObject({ type: 'dismount' });
        expect(isRiding(s, true)).toBe(false);
        expect(toggleMount(s, true)).toMatchObject({ type: 'mount' });
        expect(isRiding(s, true)).toBe(true);
    });

    test('sur l\'eau : descente automatique, remontée refusée tant qu\'on y est', () => {
        const s = createSession({ screenId: screen.id, x: lx - 1, y: ly, quests: { [YUBU_QUEST]: 'done' } });
        expect(autoDismount(s, true)).toBe(false);          // terre ferme : on reste en selle
        tryMove(s, 1, 0, { playerLevel: 5 });                // on entre dans l'eau (Pas de Yu)
        expect(isOnLiquid(s)).toBe(true);
        expect(autoDismount(s, true)).toBe(true);
        expect(isRiding(s, true)).toBe(false);
        expect(toggleMount(s, true)).toMatchObject({ type: 'refused' });
        expect(isRiding(s, true)).toBe(false);
        tryMove(s, -1, 0, { playerLevel: 5 });               // retour sur la rive
        expect(toggleMount(s, true)).toMatchObject({ type: 'mount' });
    });

    test('la sélection est enregistrée avec la progression (data.mounted)', () => {
        const s = createSession({});
        toggleMount(s, true);
        expect(createSession(JSON.parse(JSON.stringify(s.data))).data.mounted).toBe(false);
    });
});
