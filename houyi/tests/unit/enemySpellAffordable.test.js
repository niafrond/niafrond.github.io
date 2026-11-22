// Les ennemis n'ont pas de sort hors de portée : un sort multimana dont le coût dépasse la réserve de qì qu'ils peuvent atteindre
// (50 de base + points d'attribut + équipement) occuperait un des 4 emplacements du grimoire sans jamais pouvoir être lancé.
import { describe, test, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { BASE_MANA_CAP } from '../../constants.js';

const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
let canEnemyAffordSpell, createMapEnemy;
beforeAll(async () => {
    globalThis.XMLHttpRequest = class {   // spells.js et enemies.js chargent leur catalogue par XHR synchrone
        open(_method, url) { this.url = url; }
        send() { this.status = 200; this.responseText = read(this.url.includes('catalog') ? 'enemies.catalog.json' : 'spells.json'); }
    };
    ({ canEnemyAffordSpell, createMapEnemy } = await import('../../enemies.js'));
});

describe('canEnemyAffordSpell', () => {
    const spell = { id: 'x', cost: { red: 56, blue: 40 } };
    test('un sort à un seul nombre de qì est toujours à portée', () => {
        expect(canEnemyAffordSpell({ id: 'y', cost: 30, color: 'red' }, { attributes: {} })).toBe(true);
    });
    test('coût au-delà de la réserve de base : hors de portée sans attribut', () => {
        expect(BASE_MANA_CAP).toBe(50);
        expect(canEnemyAffordSpell(spell, { attributes: { strength: 0 } })).toBe(false);
        expect(canEnemyAffordSpell({ id: 'z', cost: { red: 50, blue: 50 } }, { attributes: {} })).toBe(true);   // cas limite : pile la réserve
    });
    test("les points d'attribut de la couleur ou l'équipement relèvent la réserve", () => {
        expect(canEnemyAffordSpell(spell, { attributes: { strength: 60 } })).toBe(true);
        expect(canEnemyAffordSpell(spell, { attributes: {}, weapon: { manaMax: { red: 10 } } })).toBe(true);
        expect(canEnemyAffordSpell(spell, { attributes: { intelligence: 60 } })).toBe(false);   // mauvaise couleur : le rouge reste à 50
    });
});

describe('grimoire des ennemis', () => {
    test('aucun sort du grimoire ne dépasse la réserve de qì atteignable (niveaux 35 à 70)', () => {
        const templates = JSON.parse(read('enemies.catalog.json')).map(t => t.id);
        for (const templateId of templates) {
            for (const level of [35, 50, 70]) {
                const enemy = createMapEnemy({ templateId, level, enemyId: 'x' });
                enemy.spells.forEach(sp => expect([templateId, level, sp.id, canEnemyAffordSpell(sp, enemy)]).toEqual([templateId, level, sp.id, true]));
                expect(enemy.spells.length).toBeGreaterThan(0);
            }
        }
    });
});
