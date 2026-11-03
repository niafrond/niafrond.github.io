// Level design à la Pokémon (world/levelDesign.js) : corniches à sens unique avec détour, défilés d'herbes, motifs d'obstacles.
// Les cartes sont celles du monde assemblé (story.js) ; les invariants valent pour chacune.
import './fixtures/playerForge.js';   // installe le stub XHR avant le chargement de story.js
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { createSession, tryMove, ledgeAt, isTerrainBlocked } from '../../exploration.js';
import { isDesignable, isPopulable, designLevel, MOTIFS, MIN_DETOUR, LEDGE_MIN, LEDGE_MAX, CACHES_PER_MAP, MIMICS_PER_MAP } from '../../world/levelDesign.js';
import { toSet } from '../../world/expand.js';

const key = (x, y) => `${x},${y}`;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const designed = Object.values(SCREENS).filter(s => s.design && isDesignable(s));
const populated = Object.values(SCREENS).filter(isPopulable);

// Cases atteignables à pied (corniches fermées) depuis l'apparition.
function reach(s, from = s.spawn) {
    const solid = new Set([...s.npcs, ...s.chests, ...(s.waypoint ? [s.waypoint] : [])].map(e => key(e.x, e.y)));
    const seen = new Set([key(from.x, from.y)]);
    const q = [from];
    while (q.length) {
        const p = q.shift();
        for (const [dx, dy] of STEPS) {
            const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
            if (seen.has(k) || isTerrainBlocked(s, nx, ny) || solid.has(k)) continue;
            seen.add(k); q.push({ x: nx, y: ny });
        }
    }
    return seen;
}
const dist = (s, a, b) => {
    const solid = new Set([...s.npcs, ...s.chests, ...(s.waypoint ? [s.waypoint] : [])].map(e => key(e.x, e.y)));
    let frontier = [a], d = 0;
    const seen = new Set([key(a.x, a.y)]);
    while (frontier.length) {
        const next = [];
        for (const p of frontier) {
            if (p.x === b.x && p.y === b.y) return d;
            for (const [dx, dy] of STEPS) {
                const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
                if (seen.has(k) || isTerrainBlocked(s, nx, ny) || solid.has(k)) continue;
                seen.add(k); next.push({ x: nx, y: ny });
            }
        }
        frontier = next; d++;
    }
    return Infinity;
};

describe('level design : couverture', () => {
    test('toutes les routes et zones sauvages de plein air sont retouchées', () => {
        const expected = Object.values(SCREENS).filter(isDesignable).map(s => s.id);
        expect(expected.length).toBeGreaterThanOrEqual(18);
        expect(designed.map(s => s.id).sort()).toEqual(expected.sort());
    });
    test('chaque carte retouchée a au moins un motif, une corniche ou un défilé ; l\'ensemble en a de chaque sorte', () => {
        designed.forEach(s => expect({ id: s.id, n: s.design.motifs.length + s.design.ledges + s.design.defiles }).toEqual({ id: s.id, n: expect.any(Number) }));
        const total = designed.reduce((t, s) => ({ m: t.m + s.design.motifs.length, l: t.l + s.design.ledges, d: t.d + s.design.defiles }), { m: 0, l: 0, d: 0 });
        expect(total.m).toBeGreaterThanOrEqual(4);
        expect(total.l).toBeGreaterThanOrEqual(designed.length);   // au moins une corniche par carte
        expect(total.d).toBeGreaterThanOrEqual(4);
    });
    test('les motifs sont rectangulaires', () => {
        Object.values(MOTIFS).forEach(rows => expect(new Set(rows.map(r => r.length)).size).toBe(1));
    });
    test('idempotent sur une carte déjà retouchée ou non éligible', () => {
        expect(designLevel({ id: 'x_village', kind: 'village' })).toEqual({ id: 'x_village', kind: 'village' });
    });
});

describe('corniches', () => {
    const withLedges = designed.filter(s => s.ledges);
    test('toutes les routes et zones sauvages ont au moins une corniche', () => expect(designed.filter(s => !s.ledges).map(s => s.id)).toEqual([]));

    test.each(withLedges.map(s => [s.id, s]))('%s : segments de %i à %i cases, sens unique, jamais sur une entité', (_id, s) => {
        const cells = s.ledges;
        cells.forEach(([x, y, dx, dy]) => {
            expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
            expect(toSet(s.obstacles).has(key(x, y))).toBe(false);
            expect([...s.npcs, ...s.chests, ...s.enemies, ...s.exits].some(e => e.x === x && e.y === y)).toBe(false);
            expect(ledgeAt(s, x, y)).toEqual([dx, dy]);
            expect(isTerrainBlocked(s, x, y)).toBe(true);   // jamais marchable
        });
        expect(cells.length).toBeGreaterThanOrEqual(LEDGE_MIN);
        expect(cells.length).toBeLessThanOrEqual(LEDGE_MAX * 2);
        expect(MIN_DETOUR).toBeGreaterThanOrEqual(20);
    });

    test.each(withLedges.map(s => [s.id, s]))('%s : on saute dans le sens permis, jamais en sens inverse, le retour fait le tour', (_id, s) => {
        const [lx, ly, dx, dy] = s.ledges[Math.floor(s.ledges.length / 2)];
        const pre = { x: lx - dx, y: ly - dy }, land = { x: lx + dx, y: ly + dy };
        const sess = from => { const se = createSession({ screenId: s.id, x: from.x, y: from.y }, { [s.id]: s }, []); se.rt.grace = 99; return se; };
        // saut permis : on atterrit deux cases plus loin
        const a = sess(pre);
        const res = tryMove(a, dx, dy, { random: () => 0.999 });
        expect(res.type).toBe('moved');
        expect(res.jumped).toBe(true);
        expect({ x: a.data.x, y: a.data.y }).toEqual(land);
        // sens inverse : la corniche est un mur
        const b = sess(land);
        const back = tryMove(b, -dx, -dy, { random: () => 0.999 });
        expect(back.type).toBe('blocked');
        expect({ x: b.data.x, y: b.data.y }).toEqual(land);
        // tout le reste est un mur aussi (de côté ce n'est pas la corniche)
        // retour possible mais par un détour
        expect(dist(s, land, pre)).toBeGreaterThanOrEqual(MIN_DETOUR);
        expect(Number.isFinite(dist(s, land, pre))).toBe(true);
    });

    test.each(withLedges.map(s => [s.id, s]))('%s : sans sauter, tout ce qui est atteignable l\'est (aucune zone réservée au saut)', (_id, s) => {
        // atteignable avec corniches fermées == atteignable avec corniches ouvertes (traitées comme du sol), hors cases de corniche
        const open = { ...s, ledges: undefined };
        const closed = reach(s);
        const wide = reach(open);
        const ledgeKeys = new Set(s.ledges.map(([x, y]) => key(x, y)));
        wide.forEach(k => { if (!ledgeKeys.has(k)) expect(closed.has(k)).toBe(true); });
    });
});

describe('défilés d\'herbes et motifs', () => {
    test.each(designed.map(s => [s.id, s]))('%s : toutes les entités, sorties et la pierre de voyage restent atteignables', (_id, s) => {
        const seen = reach(s);
        const targets = [...s.npcs, ...s.chests, ...s.exits, ...(s.waypoint ? [s.waypoint] : [])];
        const lost = targets.filter(t => ![[0, 0], ...STEPS].some(([dx, dy]) => seen.has(key(t.x + dx, t.y + dy))));
        expect(lost.map(t => t.id || `${t.x},${t.y}`)).toEqual([]);
    });

    test.each(designed.map(s => [s.id, s]))('%s : aucune herbe ni aucun obstacle sur les chemins, sorties et entités', (_id, s) => {
        const obst = toSet(s.obstacles), grass = toSet(s.grass.cells);
        [...s.npcs, ...s.chests, ...s.exits, s.spawn].forEach(e => expect(obst.has(key(e.x, e.y))).toBe(false));
        toSet(s.paths).forEach(k => expect(obst.has(k) && !grass.has(k) ? k : null).toBeNull());
    });

    test('au moins une carte force une traversée d\'herbes (défilé)', () => {
        expect(designed.some(s => s.design.defiles > 0)).toBe(true);
    });

    test('déterministe : une même carte est toujours retouchée de la même façon', () => {
        const s = designed[0];
        const again = designLevel(JSON.parse(JSON.stringify({ ...s, obstacles: s.obstacles, design: undefined })));
        expect(again.design).toBeDefined();
    });
});

describe('brouillard de guerre (minimap)', () => {
    const s = SCREENS.rizieres_wild;
    const fresh = () => createSession({ screenId: s.id, x: s.spawn.x, y: s.spawn.y }, { [s.id]: s }, []);
    test('la case sous le héros et son voisinage sont vus, le lointain non', async () => {
        const { fogMask, FOG_RADIUS } = await import('../../exploration.js');
        const se = fresh();
        const m = fogMask(se, s);
        const { x, y } = s.spawn;
        expect(m[y * s.w + x]).toBe(1);
        expect(m[y * s.w + x + FOG_RADIUS]).toBe(1);
        expect(m[y * s.w + x + FOG_RADIUS + 3]).toBe(0);
        expect(m[y * s.w + 40]).toBe(0);
    });
    test('un pas dévoile de nouvelles cases et le masque se sauvegarde (hexadécimal) puis se relit', async () => {
        const { fogMask } = await import('../../exploration.js');
        const se = fresh();
        const before = se.rt.fogRev;
        for (let i = 0; i < 4; i++) tryMove(se, 1, 0, { random: () => 0.999 });
        expect(se.rt.fogRev).toBeGreaterThan(before);
        const saved = JSON.parse(JSON.stringify(se.data.fog));
        expect(saved[s.id]).toMatch(/^[0-9a-f]+$/);
        const again = createSession({ screenId: s.id, x: s.spawn.x, y: s.spawn.y, fog: saved }, { [s.id]: s }, []);
        const a = fogMask(se, s), b = fogMask(again, s);
        expect([...b]).toEqual([...a]);
    });
});

describe('caches invisibles, aura et coffres mimiques', () => {
    const withHidden = designed.filter(s => s.chests.some(c => c.hidden));
    const withMimic = designed.filter(s => s.chests.some(c => c.mimic));
    const make = (s, x, y) => { const se = createSession({ screenId: s.id, x, y }, { [s.id]: s }, []); se.rt.grace = 99; return se; };
    const nextTo = (s, c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: c.x - dx, y: c.y - dy, dx, dy })).find(p => !isTerrainBlocked(s, p.x, p.y) && !s.chests.some(o => o.x === p.x && o.y === p.y));

    test('chaque route et zone sauvage a au moins 8 caches invisibles', () => {
        expect(CACHES_PER_MAP).toBeGreaterThanOrEqual(8);
        expect(designed.map(s => [s.id, s.chests.filter(c => c.hidden).length]).filter(([, n]) => n < CACHES_PER_MAP)).toEqual([]);
    });
    test('toute carte de plein air (village, hameau, sanctuaire, route, zone sauvage) a au moins 3 mimiques', () => {
        expect(MIMICS_PER_MAP).toBeGreaterThanOrEqual(3);
        expect(populated.length).toBeGreaterThan(designed.length);
        expect(populated.map(s => [s.id, s.chests.filter(c => c.mimic).length]).filter(([, n]) => n < MIMICS_PER_MAP)).toEqual([]);
    });
    test('les caches et mimiques ont des identifiants uniques et ne se superposent à rien', () => {
        populated.forEach(s => {
            const ids = s.chests.map(c => c.id);
            expect(new Set(ids).size).toBe(ids.length);
            const cells = [...s.npcs, ...s.chests, ...s.enemies].map(e => key(e.x, e.y));
            expect(new Set(cells).size).toBe(cells.length);
        });
    });

    test('perception du qì : lancée en touchant le héros, 5 s, flèche vers la cache la plus proche', async () => {
        const { auraSignal, hasAura, startPerception, perceptionActive, nearestHidden, AURA_LEVEL, PERCEPTION_MS, isChestShown } = await import('../../exploration.js');
        const s = withHidden[0], cache = s.chests.find(c => c.hidden);
        const spot = nextTo(s, cache);
        const se = make(s, spot.x, spot.y);
        expect(hasAura(AURA_LEVEL - 1)).toBe(false);
        // jamais active d'elle-même
        expect(auraSignal(se, AURA_LEVEL, 0)).toBeNull();
        expect(isChestShown(se, cache, AURA_LEVEL, 0)).toBe(false);
        // sans le talent : rien ne se lance
        expect(startPerception(se, AURA_LEVEL - 1, 0)).toEqual({ ok: false, reason: 'level' });
        expect(perceptionActive(se, 1)).toBe(false);
        // avec le talent : 5 secondes
        const res = startPerception(se, AURA_LEVEL, 1000);
        expect(res.ok).toBe(true);
        expect(res.found).toBe(true);
        expect(perceptionActive(se, 1000 + PERCEPTION_MS - 1)).toBe(true);
        expect(perceptionActive(se, 1000 + PERCEPTION_MS + 1)).toBe(false);
        const sig = auraSignal(se, AURA_LEVEL, 2000);
        expect(sig.strength).toBeGreaterThan(0.8);
        // la flèche pointe vers la cache la plus proche
        const near = nearestHidden(se);
        expect(near.chest.id).toBe(s.chests.filter(c => c.hidden).sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y))[0].id);
        expect(sig.angle).toBeCloseTo(Math.atan2(near.dy, near.dx), 6);
        // la cache ne se dessine que perception lancée et tout près
        expect(isChestShown(se, cache, AURA_LEVEL - 1, 2000)).toBe(false);
        expect(isChestShown(se, cache, AURA_LEVEL, 2000)).toBe(true);
        expect(auraSignal(se, AURA_LEVEL, 1000 + PERCEPTION_MS + 1)).toBeNull();   // éteinte au bout de 5 s
        // plus de cache sur la carte (village) : rien à indiquer
        const v = SCREENS.rizieres_village;
        expect(v.chests.some(c => c.hidden)).toBe(false);
        const sv = make(v, v.spawn.x, v.spawn.y);
        expect(startPerception(sv, AURA_LEVEL, 0).found).toBe(false);
        expect(auraSignal(sv, AURA_LEVEL, 10)).toBeNull();
    });

    test('une cache s\'ouvre en butant dessus (même sans aura) et ne se rouvre pas', () => {
        const s = withHidden[0], cache = s.chests.find(c => c.hidden);
        const p = nextTo(s, cache);
        const se = make(s, p.x, p.y);
        const res = tryMove(se, p.dx, p.dy, { random: () => 0.999 });
        expect(res).toEqual({ type: 'chest', chestId: cache.id });
    });

    test('un coffre-piège est une mimique : combat d\'herbe, butin maigre à la victoire', async () => {
        const { openChest, encounterFor, markEnemyDefeated, MIMIC_NAME } = await import('../../exploration.js');
        const s = withMimic[0], mimic = s.chests.find(c => c.mimic);
        expect(mimic.mimicGold).toBeLessThan(mimic.gold);
        const se = make(s, mimic.x, mimic.y + 1);
        const res = openChest(se, mimic.id);
        expect(res.type).toBe('mimic');
        const enc = encounterFor(se, res.enemyId, 10);
        expect(enc.name).toBe(MIMIC_NAME);
        expect(enc.wild).toBe(true);
        expect(openChest(se, mimic.id)).toBeNull();   // déjà démasquée
        const events = markEnemyDefeated(se, res.enemyId);
        expect(events[0].type).toBe('chestOpened');
        expect(events[0].gold).toBe(mimic.mimicGold);
    });

    test('toutes les entités restent atteignables avec les nouveaux coffres', () => {
        populated.forEach(s => {
            const seen = reach(s);
            s.chests.filter(c => c.hidden || c.mimic).forEach(c => {
                expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(c.x + dx, c.y + dy)))).toBe(true);
            });
        });
    });
});

describe('coffres refermés au retour (mimiques)', () => {
    const s = SCREENS.rizieres_wild;
    const other = SCREENS.rizieres_village;
    const screens = { [s.id]: s, [other.id]: other };
    const fresh = () => createSession({ screenId: other.id, x: other.spawn.x, y: other.spawn.y }, screens, []);

    test('au retour, certains coffres ouverts se referment en mimiques ; jamais à la première visite', async () => {
        const { enterScreen, openChest, isMimicChest, RECLOSE_MAX } = await import('../../exploration.js');
        const se = fresh();
        const plain = s.chests.filter(c => !c.mimic && !c.questItem && !c.puzzle);
        plain.forEach(c => se.data.openedChests.push(c.id));
        enterScreen(se, s.id, s.spawn);                       // 1re visite de la zone : rien ne se referme
        expect(se.data.mimicked).toEqual([]);
        let closedTotal = [];
        for (let i = 0; i < 8; i++) {                         // allers-retours : des coffres se referment peu à peu
            enterScreen(se, other.id, other.spawn);
            enterScreen(se, s.id, s.spawn);
            closedTotal = se.data.mimicked;
        }
        expect(closedTotal.length).toBeGreaterThan(0);
        expect(closedTotal.length).toBeLessThanOrEqual(plain.length);
        const id = closedTotal[0], chest = s.chests.find(c => c.id === id);
        expect(se.data.openedChests.includes(id)).toBe(false);   // refermé
        expect(isMimicChest(se, chest)).toBe(true);
        expect(RECLOSE_MAX).toBeGreaterThan(0);
        // l'ouvrir démasque une mimique
        const res = openChest(se, id);
        expect(res.type).toBe('mimic');
    });

    test('les coffres cités comme condition ou d\'objet de quête ne se referment jamais', async () => {
        const { enterScreen } = await import('../../exploration.js');
        const se = fresh();
        s.chests.forEach(c => se.data.openedChests.push(c.id));
        for (let i = 0; i < 15; i++) { enterScreen(se, other.id, other.spawn); enterScreen(se, s.id, s.spawn); }
        const refs = new Set();
        Object.values(SCREENS).forEach(sc => [sc.npcs, sc.chests, sc.enemies, sc.exits].forEach(l => l.forEach(e => ['showWhen', 'hideWhen', 'requires'].forEach(k => [].concat(e[k] || []).forEach(v => refs.add(v))))));
        se.data.mimicked.forEach(id => {
            const c = s.chests.find(x => x.id === id);
            expect(c.questItem).toBeFalsy();
            expect(c.puzzle).toBeFalsy();
            expect(refs.has(id)).toBe(false);
        });
    });

    test('l\'état (coffres refermés, retours) se sauvegarde et se relit', async () => {
        const se = fresh();
        se.data.mimicked.push('x'); se.data.returns[s.id] = 3;
        const again = createSession(JSON.parse(JSON.stringify(se.data)), screens, []);
        expect(again.data.mimicked).toEqual(['x']);
        expect(again.data.returns[s.id]).toBe(3);
    });
});
