// Sorts qui détruisent ou remplacent les flèches d'action (tuiles « combat ») : déclaration, branchement et clip sonore.
import { describe, test, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';

const spells = JSON.parse(readFileSync(new URL('../../spells.json', import.meta.url), 'utf8'));
const effects = readFileSync(new URL('../../classSpellEffects.js', import.meta.url), 'utf8');
const all = Object.values(spells).flat();
const NEW = { legionForge: 'colorsToActionGems', steelHarvest: 'actionGemsToMana', brokenBlades: 'actionGemsToSkulls', steelMoult: 'actionGemsToColor' };

describe('sorts de flèches d\'action', () => {
    test.each(Object.entries(NEW))('%s : déclaré (%s), branché dans le dispatcher, avec son clip', (id, effect) => {
        const sp = all.find(s => s.id === id);
        expect(sp?.effect).toBe(effect);
        expect(effects).toContain(`case '${effect}'`);
        expect(existsSync(new URL(`../../audio/sfx/spell-${id}.mp3`, import.meta.url))).toBe(true);
    });
});
