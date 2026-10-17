// Hautes herbes : rencontres aléatoires non persistantes (exploration.js > grassOf / tryMove / encounterFor) et rendu des
// touffes (tilePainter.js). Cartes de test construites à la main (même fixture `synth` que exploration.test.js) ; le tirage
// passe par `ctx.random` pour des résultats déterministes.
import { readFileSync } from 'fs';
import { describe, test, expect, jest } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { REGION_LEVEL } from '../../world/index.js';
import {
    createSession, tryMove, encounterFor, markEnemyDefeated, resetAfterDefeat, enterScreen, aliveEnemies,
    grassOf, isGrassCell, encounterOf, isEncounterCell, isWildId, takeWildIntro, resetGrassSteps, WILD_INTRO, GRASS_RATE, GRASS_SAFE_STEPS
} from '../../exploration.js';
import { paintGroundTile, drawGrassFront, shade } from '../../tilePainter.js';

const catalog = JSON.parse(readFileSync(new URL('../../enemies.catalog.json', import.meta.url), 'utf8'));
const templateIds = new Set(catalog.map(t => t.id));

const TABLE = [
    { templateId: 'fungal_horror', name: 'Crapaud de boue', weight: 5, offset: -1 },
    { templateId: 'goblin_saboteur', name: "Voleur d'eau", weight: 4, offset: 0 },
    { templateId: 'forest_guardian', name: 'Esprit des diguettes', weight: 1, offset: 1 }
];

// Carte 12 x 5 : une rangée d'herbe (y = 2, x = 1..10) que le héros parcourt vers la droite depuis (0, 2).
const screenOf = (extra = {}, grass = {}) => ({
    t: {
        id: 't', region: 'rizieres', name: 'T', biome: 'paddy', w: 12, h: 5, spawn: { x: 0, y: 2 },
        obstacles: [], liquids: [], paths: [], exits: [], npcs: [], chests: [], enemies: [],
        grass: { cells: [[1, 2, 10, 1]], rate: 0.12, safeSteps: 3, table: TABLE, ...grass },
        ...extra
    }
});
const sessionOf = (extra, grass, saved = {}) => {
    const s = createSession({ screenId: 't', x: 0, y: 2, ...saved }, screenOf(extra, grass), []);
    s.rt.grace = 0;
    return s;
};
// RNG déterministe : rejoue la liste (la dernière valeur se répète).
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const always = () => 0;
const never = () => 0.999;
// n pas vers la droite ; renvoie la liste des résultats.
const walk = (s, n, ctx) => Array.from({ length: n }, () => tryMove(s, 1, 0, ctx));

describe('grassOf : données normalisées', () => {
    test('valeurs par défaut (0,12 et 3 pas) et table filtrée', () => {
        const g = grassOf(screenOf({}, { rate: undefined, safeSteps: undefined, table: [...TABLE, { name: 'sans gabarit' }, null] }).t);
        expect(g.rate).toBe(GRASS_RATE);
        expect(g.safeSteps).toBe(GRASS_SAFE_STEPS);
        expect(g.table).toHaveLength(3);
        expect(g.table[0]).toEqual({ templateId: 'fungal_horror', name: 'Crapaud de boue', weight: 5, offset: -1 });
    });
    test('poids absent ou négatif = 1, décalage absent = 0, taux borné à [0, 1]', () => {
        const g = grassOf(screenOf({}, { rate: 4, table: [{ templateId: 'fungal_horror', weight: -2 }] }).t);
        expect(g.rate).toBe(1);
        expect(g.table[0]).toMatchObject({ weight: 1, offset: 0, name: 'fungal_horror' });
    });
    test('aucune herbe sur une zone sûre, un intérieur ou une arène', () => {
        expect(grassOf(screenOf({ safe: true }).t)).toBeNull();
        expect(grassOf(screenOf({ interior: true }).t)).toBeNull();
        expect(grassOf(screenOf({ kind: 'arena' }).t)).toBeNull();
        expect(grassOf(screenOf({ arena: {} }).t)).toBeNull();
        expect(grassOf(screenOf({ grass: undefined }).t)).toBeNull();
        expect(grassOf(screenOf({}, { cells: [] }).t)).toBeNull();
        expect(grassOf(screenOf().t)).not.toBeNull();
    });
    test('isGrassCell lit les rectangles [x, y, w, h]', () => {
        const sc = screenOf({}, { cells: [[1, 1, 2, 2], [8, 0, 1, 1]] }).t;
        expect(isGrassCell(sc, 1, 1)).toBe(true);
        expect(isGrassCell(sc, 2, 2)).toBe(true);
        expect(isGrassCell(sc, 3, 2)).toBe(false);
        expect(isGrassCell(sc, 8, 0)).toBe(true);
        expect(isGrassCell(sc, 0, 0)).toBe(false);
    });
});

describe('déclenchement des rencontres', () => {
    test('aucune rencontre pendant les safeSteps, même avec un tirage gagnant', () => {
        const s = sessionOf();
        const res = walk(s, 3, { random: always });
        expect(res.map(r => r.type)).toEqual(['moved', 'moved', 'moved']);
        expect(s.rt.grassSteps).toBe(3);
    });

    test('au-delà des safeSteps : tirage `rate` (succès si random() < rate)', () => {
        const s = sessionOf();
        walk(s, 3, { random: always });
        // 4e pas : 0,5 >= 0,12 -> rien ; 5e pas : 0,05 < 0,12 puis choix de la table
        expect(tryMove(s, 1, 0, { random: seq(0.5) }).type).toBe('moved');
        const hit = tryMove(s, 1, 0, { random: seq(0.05, 0) });
        expect(hit).toEqual({ type: 'combat', enemyId: 'wild:t:1', wild: true });
    });

    test('rate 0 : jamais ; rate 1 : à chaque pas une fois la grâce passée', () => {
        const none = sessionOf({}, { rate: 0 });
        expect(walk(none, 10, { random: always }).every(r => r.type === 'moved')).toBe(true);
        const all = sessionOf({}, { rate: 1, safeSteps: 0 });
        expect(tryMove(all, 1, 0, { random: never }).type).toBe('combat');
    });

    test('safeSteps personnalisé', () => {
        const s = sessionOf({}, { safeSteps: 0 });
        expect(tryMove(s, 1, 0, { random: always }).type).toBe('combat');
        const t = sessionOf({}, { safeSteps: 5 });
        expect(walk(t, 5, { random: always }).every(r => r.type === 'moved')).toBe(true);
        expect(tryMove(t, 1, 0, { random: always }).type).toBe('combat');
    });

    test('sans ctx.random, Math.random est utilisé', () => {
        const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
        try {
            const s = sessionOf({}, { safeSteps: 0 });
            expect(tryMove(s, 1, 0).type).toBe('combat');
        } finally { spy.mockRestore(); }
    });

    test('les pas hors herbe ne déclenchent rien et ne comptent pas', () => {
        const s = sessionOf({}, { safeSteps: 0 }, { x: 5, y: 0 });
        expect(tryMove(s, 0, 1, { random: always }).type).toBe('moved');     // (5, 1) : hors herbe
        expect(s.rt.grassSteps).toBe(0);
        expect(tryMove(s, 0, 1, { random: always }).type).toBe('combat');    // (5, 2) : herbe
    });

    test('pondération : le choix suit les poids cumulés de la table', () => {
        const pick = r => {
            const s = sessionOf({}, { safeSteps: 0, table: [
                { templateId: 'fungal_horror', name: 'A', weight: 1 },
                { templateId: 'goblin_saboteur', name: 'B', weight: 3 }
            ] });
            const res = tryMove(s, 1, 0, { random: seq(0, r) });
            return encounterFor(s, res.enemyId, 1).name;
        };
        expect(pick(0)).toBe('A');
        expect(pick(0.2499)).toBe('A');
        expect(pick(0.25)).toBe('B');
        expect(pick(0.999)).toBe('B');
        let a = 0;
        for (let i = 0; i < 100; i++) if (pick(i / 100) === 'A') a++;
        expect(a).toBe(25);
    });

    test('un poids très supérieur ne réduit pas les autres entrées à zéro (la rare existe)', () => {
        const s = sessionOf({}, { safeSteps: 0 });
        const res = tryMove(s, 1, 0, { random: seq(0, 0.99) });     // 0,99 x 10 = 9,9 : dernière entrée (poids 1)
        expect(encounterFor(s, res.enemyId, 1).name).toBe('Esprit des diguettes');
    });

    test('identifiants uniques et successifs dans une session', () => {
        const s = sessionOf({}, { safeSteps: 0, rate: 1 });
        const a = tryMove(s, 1, 0, { random: always });
        markEnemyDefeated(s, a.enemyId);
        const b = tryMove(s, 1, 0, { random: always });
        expect([a.enemyId, b.enemyId]).toEqual(['wild:t:1', 'wild:t:2']);
        expect(isWildId(a.enemyId)).toBe(true);
        expect(isWildId('sun_1')).toBe(false);
    });
});

describe('zones sans rencontre', () => {
    test.each([
        ['zone sûre', { safe: true }],
        ['intérieur', { interior: true }],
        ['arène', { kind: 'arena', arena: { tier: 1 } }]
    ])('%s : aucune rencontre', (_label, extra) => {
        const s = sessionOf(extra, { safeSteps: 0, rate: 1 });
        const res = walk(s, 10, { random: always });
        expect(res.every(r => r.type === 'moved')).toBe(true);
        expect(s.rt.grassSteps).toBe(0);
    });

    test('aucune rencontre tant que la grâce dure', () => {
        const s = sessionOf({}, { safeSteps: 0, rate: 1 });
        s.rt.grace = 7;
        const res = walk(s, 7, { random: always });
        // les 6 premiers pas se font sous grâce (7..2) ; au 7e la grâce tombe à 0 : la rencontre est possible
        expect(res.slice(0, 6).every(r => r.type === 'moved')).toBe(true);
        expect(res[6].type).toBe('combat');
    });

    test('une table vide ne déclenche rien', () => {
        const s = sessionOf({}, { safeSteps: 0, rate: 1, table: [] });
        expect(walk(s, 6, { random: always }).every(r => r.type === 'moved')).toBe(true);
    });

    test("l'aura d'un ennemi de la carte reste prioritaire sur l'herbe", () => {
        const guard = { id: 'guard', templateId: 'goblin_saboteur', name: 'Garde', kind: 'sentinel', x: 4, y: 1, offset: 0 };
        const s = sessionOf({ enemies: [guard] }, { safeSteps: 0, rate: 1 }, { x: 2, y: 2 });
        expect(tryMove(s, 1, 0, { random: always })).toEqual({ type: 'combat', enemyId: 'guard' });
        expect(s.rt.wildSeq).toBe(0);
    });
});

describe('remise à zéro du compteur de pas', () => {
    const two = () => ({
        ...screenOf(),
        u: { id: 'u', region: 'rizieres', name: 'U', biome: 'paddy', w: 6, h: 5, spawn: { x: 0, y: 2 },
            obstacles: [], liquids: [], paths: [], exits: [], npcs: [], chests: [], enemies: [] }
    });

    test('changement de carte', () => {
        const s = createSession({ screenId: 't', x: 0, y: 2 }, two(), []);
        s.rt.grace = 0;
        walk(s, 3, { random: always });
        expect(s.rt.grassSteps).toBe(3);
        enterScreen(s, 'u', { x: 0, y: 2 });
        expect(s.rt.grassSteps).toBe(0);
        enterScreen(s, 't', { x: 0, y: 2 });
        s.rt.grace = 0;
        // 3 pas sûrs de nouveau : la 4e case de herbe seulement peut déclencher
        expect(walk(s, 3, { random: always }).every(r => r.type === 'moved')).toBe(true);
        expect(tryMove(s, 1, 0, { random: always }).type).toBe('combat');
    });

    test('déclenchement, victoire et défaite remettent à zéro', () => {
        const s = sessionOf();
        walk(s, 3, { random: always });
        const hit = tryMove(s, 1, 0, { random: always });
        expect(hit.type).toBe('combat');
        expect(s.rt.grassSteps).toBe(0);                      // remis à zéro dès le tirage réussi

        walk(s, 2, { random: always });
        expect(s.rt.grassSteps).toBe(2);
        markEnemyDefeated(s, hit.enemyId);                    // victoire
        expect(s.rt.grassSteps).toBe(0);

        walk(s, 2, { random: always });
        resetAfterDefeat(s);                                  // défaite
        expect(s.rt.grassSteps).toBe(0);
        s.rt.grace = 0;
        resetGrassSteps(s);
        expect(s.rt.grassSteps).toBe(0);
    });

    test('après un combat, 3 nouveaux pas sûrs', () => {
        const s = sessionOf({}, { safeSteps: 3 }, { x: 0, y: 2 });
        walk(s, 3, { random: always });
        const hit = tryMove(s, 1, 0, { random: always });
        markEnemyDefeated(s, hit.enemyId);
        expect(walk(s, 3, { random: always }).every(r => r.type === 'moved')).toBe(true);
        expect(tryMove(s, 1, 0, { random: always }).type).toBe('combat');
    });
});

describe('créature d\'herbe : rencontre', () => {
    const encounter = (extra, grass, saved, enemy = 0) => {
        const s = sessionOf(extra, { safeSteps: 0, ...grass }, saved);
        const res = tryMove(s, 1, 0, { random: seq(0, enemy) });
        return { s, res, enc: encounterFor(s, res.enemyId, 1) };
    };

    test('même forme qu\'un ennemi normal : dessin du gabarit, préparation neutre, biome', () => {
        const { enc } = encounter();
        expect(enc).toMatchObject({
            enemyId: 'wild:t:1', spriteKey: 'fungal_horror', templateId: 'fungal_horror', name: 'Crapaud de boue',
            biome: 'paddy', boss: null, duel: null, wild: true
        });
        expect(enc.prep.tags).toEqual([]);
        expect(enc.prep.lines).toEqual([]);
        expect(enc.prep.playerFirst).toBe(false);
        expect(enc.prep.enemyStatus).toBeNull();
        const normal = encounterFor(createSession({}), 'rizieres_shroom', 1);
        expect(Object.keys(enc).sort()).toEqual(expect.arrayContaining(Object.keys(normal).sort()));
    });

    test('niveau = niveau de région + décalage, plancher 1', () => {
        // rizieres : niveau 1 ; offsets -1, 0, +1 de la table (tirage 0 -> A, 0,6 -> B, 0,99 -> C)
        expect(encounter({}, {}, {}, 0).enc.level).toBe(1);                                    // 1 - 1 = 0 -> plancher 1
        expect(encounter({}, {}, {}, 0.6).enc.level).toBe(REGION_LEVEL.rizieres);              // + 0
        expect(encounter({}, {}, {}, 0.99).enc.level).toBe(REGION_LEVEL.rizieres + 1);         // + 1
        const volcan = encounter({ region: 'volcan' }, {}, {}, 0.99).enc;
        expect(volcan.level).toBe(REGION_LEVEL.volcan + 1);
        expect(encounter({ region: 'volcan' }, {}, {}, 0).enc.level).toBe(REGION_LEVEL.volcan - 1);
    });

    test('Nouvelle Partie + : +1 niveau par cycle, comme les ennemis normaux', () => {
        const base = encounter({ region: 'fleuve' }, {}, {}, 0.6).enc.level;
        expect(encounter({ region: 'fleuve' }, {}, { ngPlus: 2 }, 0.6).enc.level).toBe(base + 2);
    });

    test('jamais de boss, même si la table en déclare un', () => {
        const { enc } = encounter({}, { table: [{ templateId: 'goblin_saboteur', name: 'X', weight: 1, offset: 0, boss: { level: 50 }, duel: { rapidShots: 3 } }] });
        expect(enc.boss).toBeNull();
        expect(enc.duel).toBeNull();
        expect(enc.level).toBe(REGION_LEVEL.rizieres);
    });

    test('identifiant inconnu ou périmé : null', () => {
        const s = sessionOf();
        expect(encounterFor(s, 'wild:t:99', 1)).toBeNull();
        expect(encounterFor(s, 'wild:', 1)).toBeNull();
    });

    test('les créatures de la table existent dans le catalogue (fixture)', () => {
        TABLE.forEach(t => expect(templateIds.has(t.templateId)).toBe(true));
    });
});

describe('combat non persistant', () => {
    test('victoire : rien dans defeated, aucun événement, sauvegarde inchangée', () => {
        const s = sessionOf({}, { safeSteps: 0 });
        const hit = tryMove(s, 1, 0, { random: always });
        const before = JSON.stringify(s.data);
        expect(s.data.defeated).toEqual([]);
        expect(markEnemyDefeated(s, hit.enemyId)).toEqual([]);
        expect(s.data.defeated).toEqual([]);
        expect(JSON.stringify(s.data)).toBe(before);
        expect(JSON.stringify(s.data)).not.toMatch(/wild/);
    });

    test("la créature n'entre pas dans l'index des ennemis de la carte et ne réapparaît pas", () => {
        const s = sessionOf({}, { safeSteps: 0 });
        const hit = tryMove(s, 1, 0, { random: always });
        expect(s.rt.enemyIndex[hit.enemyId]).toBeUndefined();
        expect(aliveEnemies(s)).toEqual([]);
        markEnemyDefeated(s, hit.enemyId);
        expect(aliveEnemies(s)).toEqual([]);
    });

    test('défaite : même comportement que pour un ennemi de la carte (retour à l\'apparition, grâce)', () => {
        const s = sessionOf({}, { safeSteps: 0 });
        tryMove(s, 1, 0, { random: always });
        tryMove(s, 1, 0, { random: never });
        resetAfterDefeat(s);
        expect({ x: s.data.x, y: s.data.y }).toEqual({ x: 0, y: 2 });
        expect(s.rt.grace).toBeGreaterThan(0);
        expect(s.data.defeated).toEqual([]);
    });

    test('mémoire : seules les dernières définitions synthétiques sont gardées', () => {
        const s = sessionOf({}, { safeSteps: 0, rate: 1 });
        for (let i = 0; i < 12; i++) {
            const r = tryMove(s, 1, 0, { random: always });
            expect(r.type).toBe('combat');
            s.data.x = 0;
        }
        expect(Object.keys(s.rt.wildDefs).length).toBeLessThanOrEqual(4);
        expect(s.rt.wildSeq).toBe(12);
    });
});

describe('message d\'explication', () => {
    test('annoncé une seule fois par session, à la première rencontre', () => {
        const s = sessionOf({}, { safeSteps: 0, rate: 1 });
        expect(takeWildIntro(s)).toBeNull();                  // rien tant qu'aucune créature n'est apparue
        tryMove(s, 1, 0, { random: always });
        expect(takeWildIntro(s)).toBe(WILD_INTRO);
        expect(takeWildIntro(s)).toBeNull();
        s.data.x = 0;
        tryMove(s, 1, 0, { random: always });                 // deuxième rencontre : plus de message
        expect(takeWildIntro(s)).toBeNull();
        expect(WILD_INTRO).toBe('Des créatures se cachent dans les hautes herbes, l\'eau et la lave.');
    });
});

describe('données réelles du Grand Monde (garde-fou, vide tant qu\'aucune carte n\'a de hautes herbes)', () => {
    const withGrass = Object.values(SCREENS).filter(sc => sc.grass);
    test('chaque `screen.grass` est exploitable : cellules, taux, table valide', () => {
        withGrass.forEach(sc => {
            const g = sc.grass;
            expect(Array.isArray(g.cells) && g.cells.length > 0).toBe(true);
            g.cells.forEach(([x, y, w, h]) => {
                expect([x, y, w, h].every(Number.isInteger)).toBe(true);
                expect(x >= 0 && y >= 0 && w >= 1 && h >= 1 && x + w <= sc.w && y + h <= sc.h).toBe(true);
            });
            if (g.rate !== undefined) expect(g.rate > 0 && g.rate <= 1).toBe(true);
            if (g.safeSteps !== undefined) expect(Number.isInteger(g.safeSteps) && g.safeSteps >= 0).toBe(true);
            expect(g.table.length).toBeGreaterThanOrEqual(3);
            expect(g.table.length).toBeLessThanOrEqual(5);
            g.table.forEach(t => {
                expect(templateIds.has(t.templateId)).toBe(true);
                expect(typeof t.name).toBe('string');
                expect(t.weight > 0).toBe(true);
                expect(Number.isInteger(t.offset)).toBe(true);
                expect(`${t.name}`).not.toMatch(/\p{Extended_Pictographic}/u);
            });
        });
    });
    test('aucune carte sûre, intérieure ou d\'arène ne porte de hautes herbes actives', () => {
        withGrass.forEach(sc => {
            if (sc.safe || sc.interior || sc.arena) expect(grassOf(sc)).toBeNull();
        });
    });
});

describe('rendu des touffes (tilePainter)', () => {
    const biome = { a: '#a8d672', b: '#9ecb68', path: '#e6d29a', cliff: '#8a6a3a', liquid: '#6ab7c9' };
    // contexte 2D factice : enregistre les remplissages
    const fakeCtx = () => {
        const calls = [];
        return {
            calls, fillStyle: '#000', imageSmoothingEnabled: true,
            fillRect(x, y, w, h) { calls.push({ fill: this.fillStyle, x, y, w, h }); },
            save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {}
        };
    };
    const opts = (extra = {}) => ({ isPath: () => false, isLiquid: () => false, biomeId: 'paddy', ...extra });
    const paint = (isTall, x = 5, y = 5) => {
        const g = fakeCtx();
        paintGroundTile(g, biome, 48, 0, 0, x, y, opts({ isTall }));
        return g.calls;
    };

    test('une case de hautes herbes est peinte plus sombre que l\'herbe normale, dans la teinte du biome', () => {
        const plain = paint(null);
        const tall = paint(() => true);
        expect(tall.length).toBeGreaterThan(plain.length);
        const bg = shade(biome.a, -30);
        expect(tall.some(c => c.fill === bg)).toBe(true);
        expect(plain.some(c => c.fill === bg)).toBe(false);
        // le fond sombre couvre l'essentiel de la case
        const area = tall.filter(c => c.fill === bg).reduce((n, c) => n + c.w * c.h, 0);
        expect(area).toBeGreaterThan(48 * 48 * 0.5);
    });

    test('les cases voisines (non herbeuses) ne reçoivent pas de touffes', () => {
        const tall = paint((x, y) => x === 5 && y === 5);
        expect(tall.some(c => c.fill === shade(biome.a, -78))).toBe(true);
        const neighbour = paint((x, y) => x === 5 && y === 5, 6, 5);
        expect(neighbour.some(c => c.fill === shade(biome.a, -78))).toBe(false);
    });

    test('toutes les cases peintes restent dans la tuile', () => {
        paint(() => true, 3, 4).forEach(c => {
            expect(c.x).toBeGreaterThanOrEqual(0);
            expect(c.y).toBeGreaterThanOrEqual(0);
            expect(c.x + c.w).toBeLessThanOrEqual(48);
            expect(c.y + c.h).toBeLessThanOrEqual(48);
        });
    });

    test('frémissement : les brins de premier plan bougent avec le temps', () => {
        const at = now => { const g = fakeCtx(); drawGrassFront(g, 48, 10, 10, biome, now, true); return g.calls.map(c => c.x).join(','); };
        expect(at(0)).not.toBe(at(300));
        expect(at(0)).toBe(at(0));
    });
});

describe('eau et lave : agissent comme des buissons', () => {
    test('une case liquide est une case de rencontre, avec la table des herbes de la carte', () => {
        const sc = screenOf({ liquids: [[5, 0, 1, 1]], aquatic: true }).t;
        expect(isEncounterCell(sc, 5, 0)).toBe(true);
        expect(isEncounterCell(sc, 1, 2)).toBe(true);
        expect(isEncounterCell(sc, 0, 4)).toBe(false);
        expect(encounterOf(sc).table).toHaveLength(3);
    });
    test('marcher dans un écran aquatique déclenche des rencontres', () => {
        const s = sessionOf({ liquids: [[1, 2, 10, 1]], aquatic: true }, { cells: [[0, 4, 1, 1]], safeSteps: 0 });
        const res = walk(s, 3, { random: always });
        expect(res.some(r => r.type === 'combat' && r.wild)).toBe(true);
    });
    test('sans herbe sur la carte, la table de la carte sauvage de la région sert de repli', () => {
        const sc = { id: 'x', region: 'volcan', liquids: [[0, 0, 1, 1]], obstacles: [] };
        expect(encounterOf(sc).table.length).toBeGreaterThan(0);
        expect(isEncounterCell(sc, 0, 0)).toBe(true);
    });
    test('aucune rencontre sur l\'eau d\'une zone sûre ou d\'un intérieur', () => {
        expect(encounterOf({ id: 'x', region: 'volcan', safe: true, liquids: [[0, 0, 1, 1]] })).toBeNull();
        expect(encounterOf({ id: 'x', region: 'volcan', interior: true, liquids: [[0, 0, 1, 1]] })).toBeNull();
    });
});
