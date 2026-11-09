import { inflictAlteration, cursedDamage, wakeIfAsleep, healEntity, tickAlterations, confusedSelfHit, setAlterationHooks, isMuted } from '../../alterations.js';
import { blockChance } from '../../combatStats.js';

const mk = (extra = {}) => ({ name: 'Cible', hp: 50, maxHp: 100, mana: { red: 5, blue: 0, green: 0, yellow: 0, purple: 0 }, statusEffects: {}, ...extra });

test('Muet : posé puis dissipé au bout de la durée', () => {
    const e = mk();
    expect(inflictAlteration(e, 'muted', 2)).toBe(true);
    expect(isMuted(e)).toBe(true);
    tickAlterations(e);
    expect(isMuted(e)).toBe(true);
    tickAlterations(e);
    expect(isMuted(e)).toBe(false);
});

test('immunité aux effets négatifs : altération refusée', () => {
    const e = mk({ statusEffects: { immunityEffects: 2 } });
    expect(inflictAlteration(e, 'cursed', 3)).toBe(false);
});

test('Maudit : +30 % de dégâts (arrondi au supérieur)', () => {
    const e = mk();
    inflictAlteration(e, 'cursed', 3);
    expect(cursedDamage(e, 10)).toBe(13);
    expect(cursedDamage(mk(), 10)).toBe(10);
});

test('Pétrifié : plus aucune chance de blocage', () => {
    const e = mk({ level: 10, defense: 50 });
    inflictAlteration(e, 'petrified', 2);
    expect(blockChance(e)).toBe(0);
});

test('Endormi : un dégât réveille', () => {
    const e = mk();
    inflictAlteration(e, 'asleep', 3);
    expect(wakeIfAsleep(e)).toBe(true);
    expect(wakeIfAsleep(e)).toBe(false);
});

test('Épuisé : le qì d\'une couleur qui en a se vide à chaque tour', () => {
    const e = mk();
    inflictAlteration(e, 'exhausted', 2, { exhaustDrain: 3 });
    tickAlterations(e, () => 0);
    expect(e.mana.red).toBe(2);
});

test('Corrompu : le soin devient des dégâts', () => {
    const dealt = [];
    setAlterationHooks({ damage: (t, d) => { dealt.push(d); t.hp -= d; } });
    const e = mk();
    inflictAlteration(e, 'corrupted', 2);
    expect(healEntity(e, 20)).toEqual({ healed: 0, harmed: 20 });
    expect(e.hp).toBe(30);
    expect(healEntity(mk(), 20).healed).toBe(20);
});

test('Confus : se frappe lui-même selon la chance', () => {
    const e = mk();
    expect(confusedSelfHit(e, () => 0)).toBe(false);
    inflictAlteration(e, 'confused', 2);
    expect(confusedSelfHit(e, () => 0.1)).toBe(true);
    expect(confusedSelfHit(e, () => 0.9)).toBe(false);
});
