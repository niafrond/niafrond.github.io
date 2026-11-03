// Cartes plus vastes et moins rectangulaires + parcours varié (world/enlarge.js, world/index.js TURNS).
import './fixtures/playerForge.js';   // installe le stub XHR avant le chargement de story.js
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { TURNS } from '../../world/index.js';
import { enlargeScreen, isEnlargeable, ENLARGED_LIMITS, WING_ROWS } from '../../world/enlarge.js';
import { isTerrainBlocked } from '../../exploration.js';

const routes = Object.values(SCREENS).filter(s => s.kind === 'wild' && s.native && /_(wild|road)$/.test(s.id) && s.biome !== 'tides');
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

describe('cartes agrandies', () => {
    test('toutes les routes natives (hors Hautes-Eaux) sont agrandies à 64 cases de large, dans la limite de cases', () => {
        expect(routes.length).toBeGreaterThanOrEqual(19);
        routes.forEach(s => {
            expect({ id: s.id, enlarged: Boolean(s.enlarged), w: s.w }).toEqual({ id: s.id, enlarged: true, w: 64 });
            expect(s.h).toBeGreaterThanOrEqual(16 + 2 * WING_ROWS);
            expect(s.w * s.h).toBeLessThanOrEqual(ENLARGED_LIMITS.maxCells);
        });
    });

    test('le contour n\'est plus un rectangle : excroissances en haut et en bas, coins rognés', () => {
        routes.forEach(s => {
            // première case praticable de chaque colonne : le profil du haut varie (presqu'îles), il y a des colonnes sans rien dans les lignes neuves
            const free = (x, y) => !isTerrainBlocked(s, x, y, true);   // l'eau de bordure compte comme fermée ici (walkOnWater = false ci-dessous)
            void free;
            const top = [], bottom = [];
            for (let x = 0; x < s.w; x++) {
                let y = 0; while (y < s.h && isTerrainBlocked(s, x, y)) y++;
                top.push(y);
                let yb = s.h - 1; while (yb >= 0 && isTerrainBlocked(s, x, yb)) yb--;
                bottom.push(s.h - 1 - yb);
            }
            expect({ id: s.id, hauts: new Set(top).size >= 4 }).toEqual({ id: s.id, hauts: true });
            expect({ id: s.id, bas: new Set(bottom).size >= 4 }).toEqual({ id: s.id, bas: true });
        });
    });

    test('une carte non éligible (petite, intérieure, Hautes-Eaux) reste telle quelle', () => {
        const small = { id: 'x_wild', kind: 'wild', native: true, w: 20, h: 10, biome: 'paddy' };
        expect(isEnlargeable(small)).toBe(false);
        expect(enlargeScreen(small)).toBe(small);
        expect(SCREENS.marees_wild.enlarged).toBeUndefined();
        expect(enlargeScreen(SCREENS.fleuve_wild)).toBe(SCREENS.fleuve_wild);   // déjà agrandie : idempotent
    });
});

describe('parcours varié (entrées et sorties pas toujours à gauche et à droite)', () => {
    const sidesOf = id => Object.fromEntries(Object.entries(SCREENS[id].connections || {}).map(([dir, c]) => [c.to, dir]));

    test.each(Object.entries(TURNS))('%s : les passages déplacés se font face de part et d\'autre', (region, turn) => {
        if (turn.road) {
            expect(sidesOf(`${region}_road`)[`${region}_village`]).toBe(turn.road);
            expect(sidesOf(`${region}_village`)[`${region}_road`]).toBe(OPPOSITE[turn.road]);
        }
        if (turn.wild) {
            expect(sidesOf(`${region}_wild`)[`${region}_village`]).toBe(turn.wild);
            expect(sidesOf(`${region}_village`)[`${region}_wild`]).toBe(OPPOSITE[turn.wild]);
        }
    });

    test('plusieurs régions entrent ou sortent par le haut ou le bas, la chaîne reste ouest → est vers le sanctuaire', () => {
        const turned = Object.keys(TURNS);
        expect(turned.length).toBeGreaterThanOrEqual(6);
        Object.keys(TURNS).forEach(r => {
            expect(sidesOf(`${r}_wild`)[r]).toBe('east');   // la zone sauvage mène toujours au sanctuaire par l'est
        });
        // au moins une entrée de village par le haut, une par le bas, une entrée de zone sauvage par le haut
        const entries = turned.map(r => Object.entries(sidesOf(`${r}_village`)).filter(([to]) => to === `${r}_road`).map(([, d]) => d)[0]);
        expect(entries).toEqual(expect.arrayContaining(['north', 'south']));
        expect(turned.some(r => sidesOf(`${r}_wild`)[`${r}_village`] === 'north')).toBe(true);
    });

    test('l\'arrivée par le haut ou le bas se fait sur une case libre, face au passage', () => {
        Object.entries(TURNS).forEach(([r, turn]) => {
            [turn.road && `${r}_road`, turn.wild && `${r}_wild`].filter(Boolean).forEach(id => {
                const s = SCREENS[id];
                expect(isTerrainBlocked(s, s.spawn.x, s.spawn.y)).toBe(false);
            });
        });
    });
});
