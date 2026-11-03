// Mode Chang'e (change/) : moteur du puzzle de soin (aucun crâne, aucune flèche), données des trois épisodes (habitants réels du jeu),
// état sauvegardé et déclencheur (mort des soleils 3, 6 et 9).
import './fixtures/playerForge.js';   // installe le stub XHR avant le chargement de story.js
import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SIZE, ENERGIES, JOKER, TILE_KINDS, GAUGE_MAX, createLevel, generateBoard, findRuns, possibleMoves, hasMove, playMove, useBreath } from '../../change/engine.js';
import { EPISODES, SUN_EPISODE, episodeById, episodeByScreen, ENERGY_LABEL, ambientOf } from '../../change/data.js';
import { TILE_ART, tileSvg } from '../../change/art.js';
import { defaultChangeData, normalizeChangeData } from '../../change/state.js';
import { createSession, markEnemyDefeated, pendingChangeEpisode, startChangeMode, endChangeMode, inChangeMode, visibleNpcs, visibleChests, aliveEnemies, tryMove, entityAt, isTerrainBlocked, activeCompanionOf, changeProgress, currentScreen, stepChangeAmbient, changeAmbientOf, changeReplayOptions, changeIsReplay } from '../../exploration.js';
import { SCREENS } from '../../story.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const seeded = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const clone = l => ({ ...l, board: l.board.slice() });

describe('moteur du puzzle de soin', () => {
    test('les seules tuiles qui existent sont les cinq énergies et la lune : 0 % de crâne et de flèche', () => {
        expect(TILE_KINDS).toEqual([...ENERGIES, JOKER]);
        const forbidden = ['skull', 'combat', 'arrow', 'fleche', 'sun', 'crane'];
        TILE_KINDS.forEach(k => forbidden.forEach(f => expect(k.toLowerCase()).not.toContain(f)));
        const rng = seeded(1);
        for (let g = 0; g < 150; g++) {
            const lv = createLevel({ color: ENERGIES[g % 5], need: 40, moves: 14 }, rng);
            lv.board.forEach(t => expect(ENERGIES).toContain(t));    // départ : énergies seulement, aucun joker
            for (let m = 0; m < 14 && !lv.over; m++) {
                const mv = possibleMoves(lv.board);
                const [a, b] = mv[Math.floor(rng() * mv.length)];
                const r = playMove(lv, a, b);
                expect(r.ok).toBe(true);
                r.steps.forEach(s => s.board.forEach(t => expect(TILE_KINDS).toContain(t)));
                lv.board.forEach(t => expect(TILE_KINDS).toContain(t));
                if (lv.gauge >= GAUGE_MAX) useBreath(lv);
            }
        }
    });

    test('un plateau neuf n\'a aucun alignement et au moins un coup', () => {
        const rng = seeded(7);
        for (let i = 0; i < 100; i++) {
            const b = generateBoard(rng);
            expect(b).toHaveLength(SIZE * SIZE);
            expect(findRuns(b)).toHaveLength(0);
            expect(hasMove(b)).toBe(true);
        }
    });

    test('un coup sans alignement est refusé et ne coûte rien', () => {
        const rng = seeded(3);
        const lv = createLevel({ color: 'jade', need: 20, moves: 10 }, rng);
        const all = [];
        for (let a = 0; a < SIZE * SIZE; a++) for (const b of [a + 1, a + SIZE]) if (b < SIZE * SIZE && (b !== a + 1 || b % SIZE)) all.push([a, b]);
        const legal = new Set(possibleMoves(lv.board).map(([a, b]) => `${a},${b}`));
        const bad = all.find(([a, b]) => !legal.has(`${a},${b}`));
        const before = lv.board.slice();
        const r = playMove(lv, bad[0], bad[1]);
        expect(r.ok).toBe(false);
        expect(lv.movesLeft).toBe(10);
        expect(lv.board).toEqual(before);
        expect(playMove(lv, 0, 9).ok).toBe(false);   // cases non voisines
    });

    test('seuls les alignements de la couleur demandée soignent ; le soin ne dépasse jamais le besoin', () => {
        const rng = seeded(11);
        for (let g = 0; g < 80; g++) {
            const color = ENERGIES[g % 5];
            const lv = createLevel({ color, need: 12, moves: 20 }, rng);
            while (!lv.over) {
                const mv = possibleMoves(lv.board), [a, b] = mv[Math.floor(rng() * mv.length)];
                const r = playMove(lv, a, b);
                expect(r.gain).toBeGreaterThanOrEqual(0);
                expect(lv.hp).toBeLessThanOrEqual(lv.need);
                expect(r.steps.reduce((n, s) => n + s.gain, 0)).toBe(r.gain);
            }
            expect(lv.over).toBe(true);
            expect(lv.won).toBe(lv.hp >= lv.need);
            if (!lv.won) expect(lv.movesLeft).toBe(0);
        }
    });

    test('les soins déjà obtenus sont conservés entre deux tentatives', () => {
        const lv = createLevel({ color: 'eau', need: 30, moves: 5, hp: 17 }, seeded(5));
        expect(lv.hp).toBe(17);
        expect(createLevel({ color: 'eau', need: 30, moves: 5, hp: 999 }, seeded(5)).hp).toBe(30);   // jamais au-delà du besoin
        expect(createLevel({ color: 'eau', need: 30, moves: 5, hp: -4 }, seeded(5)).hp).toBe(0);
        expect(() => createLevel({ color: 'rouge', need: 5, moves: 5 })).toThrow();
    });

    test('un joueur qui joue vraiment finit par réussir : aucun niveau n\'est impossible', () => {
        // Aucun chronomètre ni ennemi : plus de coups = échec doux, on recommence avec les soins conservés ; dix tentatives gloutonnes y suffisent.
        for (const ep of EPISODES) for (const n of ep.injured) {
            const rng = seeded(n.need * 31 + n.moves), data = { hp: 0 };
            let healed = false;
            for (let attempt = 0; attempt < 10 && !healed; attempt++) {
                const lv = createLevel({ color: n.color, need: n.need, moves: n.moves, hp: data.hp }, rng);
                while (!lv.over) {
                    let best = null, bs = -1;
                    for (const m of possibleMoves(lv.board)) { const t = clone(lv); t.rng = rng; t.movesLeft = 99; t.hp = 0; t.gauge = 0; const r = playMove(t, m[0], m[1]); if (r.gain > bs) { bs = r.gain; best = m; } }
                    playMove(lv, best[0], best[1]);
                    if (lv.gauge >= GAUGE_MAX) useBreath(lv);
                }
                data.hp = lv.hp; healed = lv.won;
            }
            expect(healed).toBe(true);
        }
    });

    test('le souffle lunaire exige une jauge pleine et ne coûte aucun coup', () => {
        const lv = createLevel({ color: 'perle', need: 80, moves: 9 }, seeded(2));
        expect(useBreath(lv).ok).toBe(false);
        lv.gauge = GAUGE_MAX;
        const r = useBreath(lv);
        expect(r.ok).toBe(true);
        expect(lv.movesLeft).toBe(9);
        expect(lv.gauge).toBe(0);
    });
});

describe('données des trois épisodes', () => {
    const npcsByRegion = () => { const out = {}; Object.values(SCREENS).forEach(sc => (sc.npcs || []).forEach(n => { (out[sc.region] ||= new Map()).set(n.id, n); })); return out; };

    test('trois épisodes de cinq blessés au plus, déclenchés par les soleils 3, 6 et 9', () => {
        expect(EPISODES.map(e => e.id)).toEqual([1, 2, 3]);
        expect(SUN_EPISODE).toEqual({ sun_4: 1, sun_5: 2, sun_9: 3 });
        EPISODES.forEach(e => {
            expect(e.injured.length).toBeLessThanOrEqual(5);
            expect(e.injured.length).toBe(5);
            expect(SUN_EPISODE[e.sun]).toBe(e.id);
            expect(e.intro.length).toBeGreaterThan(0);
            expect(e.outro.length).toBeGreaterThan(0);
            expect(episodeById(e.id)).toBe(e);
        });
        expect(episodeById(3).finale).toBeTruthy();   // l'épisode 3 s'achève par la coupure du miroir
    });

    test('chaque blessé est un habitant existant du village de l\'épisode, avec une énergie valide', () => {
        EPISODES.forEach(e => {
            const here = npcsByRegion()[e.region];
            e.injured.forEach(n => {
                expect(here.has(n.id)).toBe(true);   // un habitant réel de la région de l'épisode (story.js / world/text/)
                expect(ENERGIES).toContain(n.color);
                expect(ENERGY_LABEL[n.color]).toBeTruthy();
                expect(n.need).toBeGreaterThan(0);
                expect(n.moves).toBeGreaterThan(0);
                expect(n.cake).toHaveLength(2);
                expect(n.thanks.length).toBeGreaterThan(10);
            });
        });
        const ids = EPISODES.flatMap(e => e.injured.map(n => n.id));
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('chaque blessé a un sprite généré dans le jeu', () => {
        const gen = fs.readFileSync(path.join(ROOT, 'sprites/generated.js'), 'utf8');
        ['change', 'change_jouable', ...EPISODES.flatMap(e => e.injured.map(n => n.id))].forEach(id => expect(gen).toContain(`  "${id}": {`));
    });

    test('la difficulté croît d\'un épisode à l\'autre', () => {
        const mean = e => e.injured.reduce((s, n) => s + n.need, 0) / e.injured.length;
        expect(mean(EPISODES[0])).toBeLessThan(mean(EPISODES[1]));
        expect(mean(EPISODES[1])).toBeLessThan(mean(EPISODES[2]));
    });

    test('les dessins couvrent exactement les cinq énergies et la lune', () => {
        expect(TILE_ART.sort()).toEqual([...TILE_KINDS].sort());
        TILE_KINDS.forEach(k => expect(tileSvg(k)).toContain('<svg'));
        expect(tileSvg('skull')).toBe('');
        expect(tileSvg('combat')).toBe('');
    });

    test('les animations de transition existent', () => {
        ['mirror-in.gif', 'mirror-out.gif'].forEach(f => expect(fs.existsSync(path.join(ROOT, 'sprites/change', f))).toBe(true));
    });
});

describe('état sauvegardé et déclencheur', () => {
    test('normalizeChangeData garde seulement ce qui est valide', () => {
        expect(normalizeChangeData(undefined)).toEqual(defaultChangeData());
        expect(normalizeChangeData('x')).toEqual(defaultChangeData());
        const d = normalizeChangeData({ done: [1, 1, 9, 'a'], pending: 2, hp: { farmer_lin: 7.9, inconnu: 3, ping: -1 }, healed: ['ping', 'ping', 'zzz'] });
        expect(d).toEqual({ done: [1], pending: 2, hp: { farmer_lin: 7 }, healed: ['ping'], return: null, keep: null });
        expect(normalizeChangeData({ return: { screenId: 'gobi', x: 3, y: 4 } }).return).toEqual({ screenId: 'gobi', x: 3, y: 4 });
        expect(normalizeChangeData({ return: { screenId: 'gobi', x: 'a', y: 4 } }).return).toBeNull();
        expect(normalizeChangeData({ pending: 7 }).pending).toBeNull();
    });

    test('la mort des soleils 3, 6 et 9 déclenche l\'épisode correspondant, une seule fois', () => {
        const session = createSession(null);
        const ev = id => markEnemyDefeated(session, id).filter(e => e.type === 'changeEpisode');
        expect(ev('sun_4')).toEqual([{ type: 'changeEpisode', episode: 1 }]);
        expect(ev('sun_4')).toEqual([]);   // déjà vaincu : rien de plus
        expect(ev('sun_5')).toEqual([{ type: 'changeEpisode', episode: 2 }]);
        expect(ev('sun_9')).toEqual([{ type: 'changeEpisode', episode: 3 }]);
        expect(ev('sun_1')).toEqual([]);
        expect(ev('sun_2')).toEqual([]);
    });

    test('l\'épisode se déclenche avant l\'arrivée du messager du Fusang', () => {
        const session = createSession(null);
        const events = markEnemyDefeated(session, 'sun_9');
        const i = events.findIndex(e => e.type === 'changeEpisode'), j = events.findIndex(e => e.type === 'npcArrival');
        expect(i).toBeGreaterThanOrEqual(0);
        if (j >= 0) expect(i).toBeLessThan(j);
    });

    test('la session porte l\'état du mode et le bouton miroir sait ce qui est en cours', () => {
        const s = createSession(null);
        expect(s.data.change).toEqual(defaultChangeData());
        expect(pendingChangeEpisode(s)).toBeNull();
        s.data.change.pending = 2;
        expect(pendingChangeEpisode(s)).toBe(2);
        const loaded = createSession({ change: { done: [1], pending: 3, hp: { hunter_wu: 20 }, healed: [] } });
        expect(loaded.data.change.pending).toBe(3);
        expect(loaded.data.change.hp.hunter_wu).toBe(20);
        expect(createSession({ change: 42 }).data.change).toEqual(defaultChangeData());
    });
});

// Vérité terrain : parcours en largeur avec le VRAI tryMove (obstacles, sorties, passages de bord compris), position remise à chaque essai.
function walkFrom(session, screen) {
    const start = [session.data.x, session.data.y], key = (x, y) => `${x},${y}`;
    const seen = new Set([key(...start)]), todo = [start], talk = new Map();
    for (let i = 0; i < todo.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        session.data.x = todo[i][0]; session.data.y = todo[i][1];
        const r = tryMove(session, dx, dy);
        if (r.type === 'talk') { talk.set(r.npcId, [todo[i][0], todo[i][1]]); continue; }
        if (r.type !== 'moved') continue;
        const nx = todo[i][0] + dx, ny = todo[i][1] + dy;
        if (session.data.screenId !== screen.id) throw new Error('Chang\'e a quitté le village');
        if (!seen.has(key(nx, ny))) { seen.add(key(nx, ny)); todo.push([nx, ny]); }
    }
    session.data.x = start[0]; session.data.y = start[1];
    return { seen, talk };
}

describe('Chang\'e explore le village (mode dans le moteur d\'exploration)', () => {
    const fresh = () => { const s = createSession(null); s.data.x = 5; s.data.y = 6; return s; };

    test('chaque épisode a son village, avec le sprite et les habitants', () => {
        EPISODES.forEach(e => { expect(SCREENS[e.screen]).toBeTruthy(); expect(SCREENS[e.screen].region).toBe(e.region); expect(episodeByScreen(e.screen)).toBe(e); });
    });

    test('l\'arrivée au village : cinq blessés, aucun ennemi ni coffre, Hou Yi mis de côté', () => {
        EPISODES.forEach(ep => {
            const session = fresh(), before = { screenId: session.data.screenId, x: session.data.x, y: session.data.y };
            const screen = startChangeMode(session, ep.id);
            expect(screen.id).toBe(ep.screen);
            expect(inChangeMode(session)).toBe(true);
            expect(session.data.screenId).toBe(ep.screen);
            expect(session.data.change.return).toEqual(before);
            expect(session.data.change.pending).toBe(ep.id);
            const npcs = visibleNpcs(session).filter(n => n.injured);
            expect(npcs.map(n => n.id)).toEqual(ep.injured.map(n => n.id));
            const cells = new Set(npcs.map(n => `${n.x},${n.y}`));
            expect(cells.size).toBe(5);
            npcs.forEach(n => { expect(isTerrainBlocked(screen, n.x, n.y)).toBe(false); expect(n.injured).toBe(true); expect(entityAt(session, n.x, n.y)).toMatchObject({ type: 'npc' }); });
            // étalés sur le village : jamais attroupés (au moins 4 cases entre deux blessés, 4 pas du départ), et tous accessibles à pied
            const pts = npcs.map(n => [n.x, n.y]);
            for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThanOrEqual(4);
            pts.forEach(([x, y]) => expect(Math.hypot(x - screen.spawn.x, y - screen.spawn.y)).toBeGreaterThanOrEqual(3));
            npcs.forEach(n => expect(n.need).toBeGreaterThan(0));
            expect(aliveEnemies(session)).toEqual([]);
            expect(visibleChests(session)).toEqual([]);
            expect(activeCompanionOf(session)).toBeNull();
            expect(changeProgress(session)).toHaveLength(5);
            expect(startChangeMode(session, ep.id)).toBeNull();   // pas deux fois
        });
    });

    test('chaque blessé est accessible à pied (vrai tryMove, obstacles compris), loin des bords et des sorties', () => {
        EPISODES.forEach(ep => {
            const session = createSession(null), screen = startChangeMode(session, ep.id);
            const { seen, talk } = walkFrom(session, screen);
            visibleNpcs(session).filter(n => n.injured).forEach(n => {
                expect(talk.has(n.id)).toBe(true);   // on peut le toucher
                expect(n.x).toBeGreaterThanOrEqual(4); expect(n.y).toBeGreaterThanOrEqual(4);
                expect(n.x).toBeLessThan(screen.w - 4); expect(n.y).toBeLessThan(screen.h - 4);
                expect(screen.exits.some(e => e.x === n.x && e.y === n.y)).toBe(false);
            });
            expect(seen.size).toBeGreaterThan(100);
        });
    });

    test('des habitants de passage se baladent : six par village, jamais sur un obstacle, un blessé ou Chang\'e, et ils restent près de leur attache', () => {
        EPISODES.forEach(ep => {
            const session = createSession(null), screen = startChangeMode(session, ep.id);
            const amb = () => visibleNpcs(session).filter(n => n.ambient);
            expect(amb()).toHaveLength(6);
            amb().forEach(a => { expect(ambientOf(ep.id, a.id)).toBeTruthy(); expect(changeAmbientOf(session, a.id).line.length).toBeGreaterThan(20); });
            const homes = amb().map(a => [a.hx, a.hy]);
            let seed = 9; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
            const start = amb().map(a => `${a.x},${a.y}`).join('|');
            let moves = 0;
            for (let t = 0; t < 600; t++) {
                if (stepChangeAmbient(session, 500, rng)) moves++;
                const cells = visibleNpcs(session).map(n => `${n.x},${n.y}`);
                expect(new Set(cells).size).toBe(cells.length);   // jamais deux PNJ sur la même case
                amb().forEach((a, i) => {
                    expect(isTerrainBlocked(screen, a.x, a.y)).toBe(false);
                    expect(Math.hypot(a.x - homes[i][0], a.y - homes[i][1])).toBeLessThanOrEqual(4.5);
                    expect(a.x === session.data.x && a.y === session.data.y).toBe(false);
                });
            }
            expect(moves).toBeGreaterThan(50);
            expect(amb().map(a => `${a.x},${a.y}`).join('|')).not.toBe(start);
            // après la balade, les blessés restent accessibles et les habitants aussi (on les touche sans quitter le village)
            const { talk } = walkFrom(session, screen);
            visibleNpcs(session).filter(n => n.injured).forEach(n => expect(talk.has(n.id)).toBe(true));
        });
    });

    test('Chang\'e ne quitte pas le village : bords et sorties répondent « changeStay »', () => {
        const session = fresh();
        const screen = startChangeMode(session, 1);
        session.data.x = 0; session.data.y = Math.min(screen.h - 1, 2);
        expect(tryMove(session, -1, 0)).toEqual({ type: 'changeStay' });
        session.data.x = screen.w - 1;
        expect(tryMove(session, 1, 0)).toEqual({ type: 'changeStay' });
        screen.exits.forEach(e => {
            session.data.x = e.x; session.data.y = e.y;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
                const nx = e.x + dx, ny = e.y + dy;
                if (nx < 0 || ny < 0 || nx >= screen.w || ny >= screen.h) return;
                const r = tryMove(session, dx, dy);
                expect(['moved', 'blocked', 'talk', 'changeStay']).toContain(r.type);
            });
        });
        expect(session.data.screenId).toBe(screen.id);
    });

    test('marcher sur une sortie ne la franchit pas, toucher un blessé donne un « talk », aucun combat d\'herbe', () => {
        const session = fresh();
        const screen = startChangeMode(session, 1);
        const e = screen.exits[0];
        const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [e.x - dx, e.y - dy, dx, dy]).find(([x, y]) => x >= 0 && y >= 0 && x < screen.w && y < screen.h && !isTerrainBlocked(screen, x, y) && !entityAt(session, x, y));
        if (around) { session.data.x = around[0]; session.data.y = around[1]; expect(tryMove(session, around[2], around[3]).type).toBe('changeStay'); }
        const npc = visibleNpcs(session)[0];
        const step = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [npc.x - dx, npc.y - dy, dx, dy]).find(([x, y]) => x >= 0 && y >= 0 && x < screen.w && y < screen.h && !isTerrainBlocked(screen, x, y) && !entityAt(session, x, y));
        session.data.x = step[0]; session.data.y = step[1];
        expect(tryMove(session, step[2], step[3])).toEqual({ type: 'talk', npcId: npc.id });
        // des centaines de pas : jamais de rencontre
        for (let i = 0; i < 300; i++) { const r = tryMove(session, i % 2 ? 1 : -1, 0, { random: () => 0 }); expect(['moved', 'blocked', 'talk', 'changeStay']).toContain(r.type); }
    });

    test('la fin du mode replace Hou Yi ; terminé = épisode noté fait, quitté = épisode toujours en cours', () => {
        const session = fresh();
        startChangeMode(session, 2);
        const back = endChangeMode(session);
        expect(back).toEqual({ screenId: 'rizieres_village', x: 5, y: 6 });
        expect(inChangeMode(session)).toBe(false);
        expect(session.data.screenId).toBe('rizieres_village');
        expect(session.data.change.pending).toBe(2);
        expect(session.data.change.return).toBeNull();
        expect(visibleNpcs(session).some(n => n.injured)).toBe(false);
        startChangeMode(session, 2);
        endChangeMode(session, { done: true });
        expect(session.data.change.done).toEqual([2]);
        expect(session.data.change.pending).toBeNull();
        expect(currentScreen(session).id).toBe('rizieres_village');
    });

    test('un chargement en plein mode ne ramène jamais la partie dans le village de Chang\'e', () => {
        const loaded = createSession({ change: { done: [], pending: 1, hp: {}, healed: [], return: { screenId: 'gobi', x: 3, y: 3 } } });
        expect(loaded.data.change.return).toBeNull();
        expect(loaded.data.change.pending).toBe(1);
        expect(inChangeMode(loaded)).toBe(false);
    });

    test('l\'épisode 1 commence par l\'aveu de la goutte d\'élixir ; aucune énergie n\'est lunaire', () => {
        const text = episodeById(1).arrival.map(l => l.text).join(' ');
        expect(text).toContain('goutte');
        expect(text).toContain('élixir');
        expect(text).toContain('accident');
        Object.values(ENERGY_LABEL).forEach(l => expect(l.toLowerCase()).not.toContain('lun'));
        expect(episodeById(2).arrival).toBe(undefined);
    });
});

describe('le miroir de la maison : rejeu des épisodes terminés', () => {
    const all = ep => ep.injured.map(n => n.id);

    test('le miroir est dans la maison de Hou Yi et Chang\'e, avec son dessin', () => {
        const house = SCREENS.rizieres_h_houyi;
        const mirror = house.npcs.find(n => n.id === 'houyi_mirror');
        expect(mirror).toBeTruthy();
        expect(mirror.name).toBe('Le miroir');
        expect(isTerrainBlocked(house, mirror.x, mirror.y)).toBe(false);
        expect(house.npcs.some(n => n.x === mirror.x && n.y === mirror.y && n.id !== mirror.id)).toBe(false);
        expect(fs.readFileSync(path.join(ROOT, 'sprites/generated.js'), 'utf8')).toContain('  "houyi_mirror": {');
    });

    test('rien à revoir tant qu\'aucun épisode n\'est commencé ; ensuite le miroir propose revoir ou reprendre', () => {
        const s = createSession(null);
        expect(changeReplayOptions(s)).toEqual([]);
        s.data.change.done = [1, 3]; s.data.change.pending = 2;
        expect(changeReplayOptions(s)).toEqual([
            { episode: 1, village: 'Hameau de Dongqiao', kind: 'replay' },
            { episode: 2, village: 'Port-à-Sec de Hekou', kind: 'resume' },
            { episode: 3, village: 'Enclos de Caoyuan', kind: 'replay' }
        ]);
    });

    test('rejouer un épisode terminé : ses habitants sont de nouveau blessés, les autres soins et l\'épisode ouvert ne bougent pas', () => {
        const s = createSession(null), ch = s.data.change, ep1 = episodeById(1), ep2 = episodeById(2);
        ch.done = [1]; ch.pending = 2;
        ch.healed = [...all(ep1), ep2.injured[0].id]; ch.hp = { ...Object.fromEntries(all(ep1).map(id => [id, 30])), [ep2.injured[0].id]: 34, [ep2.injured[1].id]: 9 };
        startChangeMode(s, 1);
        expect(changeIsReplay(s)).toBe(true);
        expect(changeProgress(s).every(p => !p.healed)).toBe(true);        // tout le monde est blessé à nouveau
        expect(ch.healed).toEqual([ep2.injured[0].id]);                     // l'épisode 2 n'est pas touché
        expect(ch.hp[ep2.injured[1].id]).toBe(9);
        expect(ch.pending).toBe(2);                                          // un rejeu n'ouvre ni ne ferme rien
        expect(ch.done).toEqual([1]);
        // on soigne le premier habitant pendant le rejeu, puis on quitte par le miroir
        ch.healed.push(ep1.injured[0].id); ch.hp[ep1.injured[0].id] = ep1.injured[0].need;
        endChangeMode(s);
        expect(ch.keep).toBeNull();
        all(ep1).forEach(id => expect(ch.healed).toContain(id));            // le Livre des noms n'a rien perdu
        expect(ch.hp[ep1.injured[1].id]).toBe(30);
        expect(ch.done).toEqual([1]);
        expect(ch.pending).toBe(2);
    });

    test('finir un rejeu laisse l\'épisode terminé et ne ferme pas l\'épisode resté ouvert', () => {
        const s = createSession(null), ch = s.data.change;
        ch.done = [1]; ch.pending = 2; ch.healed = all(episodeById(1));
        startChangeMode(s, 1);
        endChangeMode(s, { done: true });
        expect(ch.done).toEqual([1]);
        expect(ch.pending).toBe(2);
        all(episodeById(1)).forEach(id => expect(ch.healed).toContain(id));
    });

    test('une partie sauvegardée en plein rejeu rend les soins mis de côté', () => {
        const s = createSession(null), ch = s.data.change;
        ch.done = [1]; ch.healed = all(episodeById(1)); ch.hp = { farmer_lin: 24 };
        startChangeMode(s, 1);
        const saved = JSON.parse(JSON.stringify(s.data));   // sauvegarde faite pendant le rejeu
        const loaded = createSession(saved);
        all(episodeById(1)).forEach(id => expect(loaded.data.change.healed).toContain(id));
        expect(loaded.data.change.hp.farmer_lin).toBe(24);
        expect(loaded.data.change.keep).toBeNull();
    });

    test('une première fois (épisode pas encore terminé) n\'est pas un rejeu', () => {
        const s = createSession(null);
        startChangeMode(s, 2);
        expect(changeIsReplay(s)).toBe(false);
        expect(s.data.change.pending).toBe(2);
        expect(s.data.change.keep).toBeNull();
    });
});
