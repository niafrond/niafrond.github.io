import { enemyVersionOfSpell } from '../../enemies.js';
import { readFileSync } from 'node:fs';

const genericSpells = JSON.parse(readFileSync(new URL('../../spells.json', import.meta.url), 'utf8')).allSpells;   // spells.js charge le catalogue par XHR : absent sous jest
const byId = id => genericSpells.find(s => s.id === id);

describe('sorts génériques lancés par les ennemis', () => {
    test('un sort réservé au joueur sans effet de plateau reste tel quel', () => {
        const sp = byId('twinDragonsStrike');
        expect(enemyVersionOfSpell(sp)).toBe(sp);
        expect(enemyVersionOfSpell(byId('immortalPeach')).heal).toBe(168);
    });
    test("un sort de plateau reste un sort de plateau pour l'ennemi, avec une estimation de dégâts pour l'IA", () => {
        const row = enemyVersionOfSpell(byId('emberScythe'));   // 3 par case rouge, 8 cases, 1 couleur sur 5
        expect(row.dmg).toBe(5);
        expect(row.effect).toBe('sweepRow');
        expect(row.boardSpell).toBe(true);
        expect(enemyVersionOfSpell(byId('crimsonPurge')).dmg).toBe(26);   // 2 × 64 × 1/5
        expect(enemyVersionOfSpell(byId('dragonCross')).boardSpell).toBe(true);
    });
    test("Harmonie des Cinq Éléments garde dégâts et soin, Souffle de Jade soigne sans tour bonus", () => {
        const harmony = enemyVersionOfSpell(byId('fiveHarmony'));
        expect(harmony.dmg).toBe(100);
        expect(harmony.heal).toBe(40);
        expect(harmony.effect).toBeUndefined();
        const wind = enemyVersionOfSpell(byId('jadeBreath'));
        expect(wind.heal).toBe(50);
        expect(wind.effect).toBeUndefined();
        expect(wind.cooldown).toBeUndefined();
    });
    test("les sorts qui agissent sur le plateau du joueur n'ont pas d'équivalent", () => {
        expect(enemyVersionOfSpell(byId('brasierSeals'))).toBeNull();
        expect(enemyVersionOfSpell(byId('thunderPrison'))).toMatchObject({ effect: 'alterEnemy', alteration: 'stunned' });   // l'ennemi étourdit le héros
    });
    test('chaque sort générique à effet de plateau est marqué boardSpell ; harmonie et souffle de jade sont convertis', () => {
        genericSpells.forEach(sp => {
            const v = enemyVersionOfSpell(sp);
            if(!v || !v.effect || v.effect === 'alterEnemy') return;   // alterEnemy : étourdissement du héros (Prison du Tonnerre Glacé)
            expect(['sweepRow', 'sweepCol', 'sweepCross', 'clearColor', 'destroyColumns', 'starRain']).toContain(v.effect);
            expect(v.boardSpell).toBe(true);
        });
    });
});
