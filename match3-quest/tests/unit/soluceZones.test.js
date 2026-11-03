// Soluce (soluce/zones.html, tools/build-soluce.mjs) : chaque zone de chaque région a sa carte annotée et la liste exacte de ses passages
// (côté, position), cohérente avec les connexions du monde assemblé ; relancer `node --import ./match3-quest/tests/unit/fixtures/xhrFromDisk.js
// match3-quest/tools/build-soluce.mjs` si ce test échoue après un changement de cartes.
import './fixtures/xhrFromDisk.js';
import { readFileSync, existsSync } from 'node:fs';
import { describe, test, expect } from '@jest/globals';
import { SCREENS } from '../../story.js';
import { zoneScreens } from '../../tools/soluce-targets.mjs';

const read = f => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
const html = read('soluce/zones.html');
const DIR_FR = { north: 'nord', south: 'sud', east: 'est', west: 'ouest' };
const section = id => { const i = html.indexOf(`id="zone-${id}"`); const j = html.indexOf('<h3 id="zone-', i + 10); const k = html.indexOf('<h2', i + 10); return html.slice(i, Math.min(...[j, k].filter(x => x > 0), html.length)); };

describe('soluce : zones et jonctions', () => {
    const zones = zoneScreens();

    test('toutes les zones de la chaîne des régions sont couvertes, avec leur capture', () => {
        expect(zones.length).toBeGreaterThanOrEqual(40);
        zones.forEach(id => {
            expect({ id, ancre: html.includes(`id="zone-${id}"`) }).toEqual({ id, ancre: true });
            expect({ id, capture: existsSync(new URL(`../../soluce/img/${id}.jpg`, import.meta.url)) }).toEqual({ id, capture: true });
        });
    });

    test('chaque passage de bord est écrit avec son côté, et la zone voisine est liée', () => {
        zones.forEach(id => {
            const text = section(id);
            Object.entries(SCREENS[id].connections || {}).filter(([, c]) => SCREENS[c.to]).forEach(([dir, c]) => {
                expect({ id, dir, texte: text.includes(`bord ${DIR_FR[dir]}`) }).toEqual({ id, dir, texte: true });
                expect({ id, dir, lien: text.includes(`href="#zone-${c.to}"`) }).toEqual({ id, dir, lien: true });
            });
        });
    });

    test('les marqueurs de passage (cadres bleus) sont posés sur les cartes, et la page est dans le menu et l\'accueil', () => {
        expect((html.match(/class="ring exit"/g) || []).length).toBeGreaterThan(60);
        expect(html).toContain('class="ring door"');
        expect(read('soluce.html')).toContain('soluce/zones.html');
        expect(read('soluce/parcours.html')).toContain('zones.html');
    });

    test('le parcours varié est visible : au moins une route sort par le haut ou le bas', () => {
        expect(html).toMatch(/sortie par le <b>bord (nord|sud)<\/b>/);
    });
});
