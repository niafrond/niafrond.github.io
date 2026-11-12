import { enemyVersionOfSpell, enemyClassSpell } from '../../enemies.js';
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
    test('la Paume de Givre a une version ennemie : étourdissement et ralentissement du héros', () => {
        const hand = JSON.parse(readFileSync(new URL('../../spells.json', import.meta.url), 'utf8')).sorcererSpells.find(s => s.id === 'handOfIce');
        expect(enemyVersionOfSpell(hand)).toMatchObject({ effect: 'alterEnemy', alteration: 'stunned', alsoChill: true });
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

describe('sorts de classe lancés par les ennemis : tous font quelque chose', () => {
    const catalog = JSON.parse(readFileSync(new URL('../../spells.json', import.meta.url), 'utf8'));
    const classSpells = ['sorcererSpells', 'assassinSpells', 'templarSpells', 'barbarianSpells'].flatMap(k => catalog[k]);
    const NATIVE = ['statBuff', 'alterEnemy', 'preventItems', 'bonusTurn'];
    test('tous les sorts du héros ont une version ennemie qui inflige des dégâts, soigne, agit sur le plateau ou applique des effets', () => {
        classSpells.forEach(sp => {
            const v = enemyClassSpell(sp);
            expect([sp.id, !!v]).toEqual([sp.id, true]);
            const works = !v.effect || v.dmg || v.heal || v.boardSpell || v.enemyOps?.length || NATIVE.includes(v.effect);
            expect([sp.id, !!works]).toEqual([sp.id, true]);
            expect(v.id).toBe(sp.id);   // reste le même sort (classe et couleurs conservées)
            expect(v.class).toBe(sp.class);
        });
    });
    test('les sorts de rage deviennent des bonus ; les gemmes d\'action, des points d\'action', () => {
        expect(enemyClassSpell(classSpells.find(s => s.id === 'awakenQi')).enemyOps[0]).toMatchObject({ op: 'buff', attack: 6 });
        expect(enemyClassSpell(classSpells.find(s => s.id === 'focus')).enemyOps[0]).toMatchObject({ op: 'gainCP' });
        expect(enemyClassSpell(classSpells.find(s => s.id === 'furyBolt'))).toMatchObject({ type: 'damage' });
        expect(enemyClassSpell(classSpells.find(s => s.id === 'weakness')).enemyOps[0]).toMatchObject({ op: 'alter', key: 'weakened' });
        expect(enemyClassSpell(classSpells.find(s => s.id === 'poisonBlade')).enemyOps[0]).toMatchObject({ op: 'poison' });
    });
    test('Charge de Cavalerie et Paume de Givre étourdissent le héros', () => {
        expect(enemyClassSpell(classSpells.find(s => s.id === 'rush'))).toMatchObject({ effect: 'alterEnemy', alteration: 'stunned', duration: 2 });
        expect(enemyClassSpell(classSpells.find(s => s.id === 'handOfIce'))).toMatchObject({ effect: 'alterEnemy', alsoChill: true });
        expect(enemyClassSpell(classSpells.find(s => s.id === 'mageStrike'))).toMatchObject({ type: 'damage', dmg: 10 });
    });
});
