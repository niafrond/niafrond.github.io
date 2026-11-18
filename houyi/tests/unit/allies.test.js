import { describe, test, expect } from '@jest/globals';
import * as require_allies from '../../allies.js';
import { reviveAlly, ALLIES, ALLY_IDS, MAX_ALLIES, allyMaxHp, buildAlly, buildTeam, pickEnemyTarget, damageAlly, healAlly, livingAllies, isAllyKnockedOut, teamAllies, recruitedAllies, memberName } from '../../allies.js';
import { CLASS_IDS, MAX_USABLE_CLASSES, START_CLASS, normalizeRoster, grantClass, toggleLoadout, usableClasses } from '../../classRoster.js';

const hero = (extra = {}) => ({ maxHp: 400, hp: 400, defense: 10, attack: 20, level: 30, classes: { owned: ['assassin'], loadout: ['assassin'] }, ...extra });

describe('compagnons de combat', () => {
    test('six compagnons, un par classe autre que celle de Hou Yi, chacun avec son dessin', () => {
        expect(ALLY_IDS.sort()).toEqual(CLASS_IDS.filter(id => id !== START_CLASS).sort());
        ALLY_IDS.forEach(id => { expect(ALLIES[id].sprite).toBe(`ally_${id}`); expect(ALLIES[id].name).toBeTruthy(); });
        expect(memberName('assassin')).toBe('Hou Yi');
        expect(MAX_ALLIES + 1).toBe(MAX_USABLE_CLASSES);
    });
    test("les PV d'un compagnon sont une part de ceux de Hou Yi", () => {
        expect(allyMaxHp(hero(), 'templar')).toBe(400);
        expect(allyMaxHp(hero(), 'sorcerer')).toBe(200);
        expect(allyMaxHp(hero({ maxHp: 800 }), 'sorcerer')).toBe(400);
    });
    test("recruter ajoute un compagnon à l'équipe ; Hou Yi reste toujours de l'équipe", () => {
        const h = hero();
        grantClass(h, 'barbarian'); grantClass(h, 'monk');
        expect(recruitedAllies(h)).toEqual(['barbarian', 'monk']);
        expect(teamAllies(h)).toEqual(['barbarian', 'monk']);
        expect(toggleLoadout(h, START_CLASS).ok).toBe(false);   // on ne retire pas Hou Yi
        h.classes.loadout = ['barbarian'];
        expect(normalizeRoster(h).loadout).toContain(START_CLASS);
        expect(toggleLoadout(h, 'barbarian').ok).toBe(true);
        expect(toggleLoadout(h, 'shaman').ok).toBe(false);       // pas encore recruté
    });
    test("l'équipe ne dépasse pas Hou Yi et trois compagnons", () => {
        const h = hero();
        ['barbarian', 'templar', 'sorcerer', 'monk'].forEach(id => grantClass(h, id));
        expect(normalizeRoster(h).loadout).toHaveLength(MAX_USABLE_CLASSES);
        expect(toggleLoadout(h, 'monk').ok).toBe(false);
    });
    test('au combat : une carte par compagnon, en pleine forme, avec une barre de vie', () => {
        const h = hero();
        grantClass(h, 'templar'); grantClass(h, 'alchemist');
        const team = buildTeam(h);
        expect(Object.keys(team)).toEqual(['templar', 'alchemist']);
        expect(team.templar).toMatchObject({ hp: 400, maxHp: 400, ko: false, isAlly: true, name: 'Capitaine Heng' });
        expect(team.alchemist.maxHp).toBe(220);
    });
    test('hors de combat à 0 PV : le compagnon ne joue plus et ne peut plus être visé', () => {
        const a = buildAlly(hero(), 'sorcerer');
        expect(damageAlly(a, 50)).toEqual({ damage: 50, ko: false });
        expect(damageAlly(a, 999)).toEqual({ damage: 150, ko: true });
        expect(a.ko).toBe(true);
        expect(damageAlly(a, 10).damage).toBe(0);
        expect(healAlly(a, 100)).toBe(0);
        const team = { sorcerer: a, monk: buildAlly(hero(), 'monk') };
        expect(livingAllies(team).map(x => x.classId)).toEqual(['monk']);
        expect(isAllyKnockedOut(team, 'sorcerer')).toBe(true);
        expect(pickEnemyTarget(team, () => 0)?.classId).toBe('monk');
    });
    test('une action ennemie sur quatre vise un compagnon vivant, sinon Hou Yi', () => {
        const team = buildTeam(Object.assign(hero(), { classes: { owned: ['assassin', 'monk'], loadout: ['assassin', 'monk'] } }));
        expect(pickEnemyTarget(team, () => 0.9)).toBeNull();
        expect(pickEnemyTarget(team, () => 0.1)?.classId).toBe('monk');
        expect(pickEnemyTarget({}, () => 0)).toBeNull();
    });
    test('un compagnon soigné ne dépasse pas ses PV max', () => {
        const a = buildAlly(hero(), 'monk');
        damageAlly(a, 100);
        expect(healAlly(a, 1000)).toBe(100);
        expect(a.hp).toBe(a.maxHp);
    });
});

describe('recrutement des compagnons par région', () => {
    test('1 dans la 1re région, 2 dans la 2e, puis 1 par région', async () => {
        const { CLASS_TRIAL_QUESTS } = await import('../../world/classTrials.js');
        const { REGION_ORDER } = await import('../../world/index.js');
        const perRegion = {};
        ALLY_IDS.forEach(id => { perRegion[ALLIES[id].region] = (perRegion[ALLIES[id].region] || 0) + 1; });
        expect(REGION_ORDER.slice(0, 5).map(r => perRegion[r] || 0)).toEqual([1, 2, 1, 1, 1]);
        expect(Object.values(perRegion).reduce((a, b) => a + b, 0)).toBe(6);
        expect(CLASS_TRIAL_QUESTS).toHaveLength(6);
        CLASS_TRIAL_QUESTS.forEach(q => expect(ALLIES[q.reward.class]).toBeTruthy());
    });
});

describe('IA : ciblage des compagnons', () => {
    const team = () => { const h = hero({ classes: { owned: ['assassin', 'monk', 'templar'], loadout: ['assassin', 'monk', 'templar'] } }); return buildTeam(h); };
    test("l'ennemi s'acharne sur le compagnon le plus faible", () => {
        const t = team();
        damageAlly(t.monk, 250);   // monk : 280 PV max -> 30 PV
        // tirage < chance, puis < 0,6 : le plus faible
        const rolls = [0.05, 0.3];
        expect(pickEnemyTarget(t, () => rolls.shift())?.classId).toBe('monk');
    });
    test('un compagnon presque à terre est visé plus souvent (chance relevée)', () => {
        const t = team();
        const fresh = [0.3, 0.3];   // 0,3 > 0,25 : Hou Yi
        expect(pickEnemyTarget(t, () => fresh.shift(), 1)).toBeNull();
        damageAlly(t.monk, 250);
        const wounded = [0.3, 0.3];   // 0,3 < 0,25 × 1,6 : un compagnon, le plus faible
        expect(pickEnemyTarget(t, () => wounded.shift(), 1)?.classId).toBe('monk');
    });
    test('si Hou Yi est en danger, l\'ennemi se concentre sur lui', () => {
        const t = team();
        expect(pickEnemyTarget(t, () => 0.2, 0.2)).toBeNull();   // 0,2 > 0,25 × 0,4
        expect(pickEnemyTarget(t, () => 0.05, 0.2)).not.toBeNull();
    });
});

describe('équipe : ranimer, soigner et renforcer', () => {
    test('les objets d\'équipe existent (ranimer, soigner, bonus) et sont à usage unique', async () => {
        const { allItems, isTeamItem, teamItemKind } = await import('../../items.js');
        const { isSingleUse } = await import('../../itemReuse.js');
        const ids = ['qilin_hair', 'qilin_horn', 'crane_feather', 'xuanwu_balm', 'white_tiger_claw', 'azure_dragon_scale'];
        ids.forEach(id => { const it = allItems.find(i => i.id === id); expect(it).toBeTruthy(); expect(isTeamItem(it)).toBe(true); expect(isSingleUse(it)).toBe(true); });
        expect(teamItemKind(allItems.find(i => i.id === 'qilin_hair'))).toBe('revive');
        expect(teamItemKind(allItems.find(i => i.id === 'crane_feather'))).toBe('heal');
        expect(teamItemKind(allItems.find(i => i.id === 'white_tiger_claw'))).toBe('buff');
        expect(isTeamItem(allItems.find(i => i.id === 'phoenixFeather'))).toBe(false);   // la Plume de Fenghuang relève Hou Yi lui-même
    });
    test("un objet d'équipe sans cible valable n'est pas consommé", async () => {
        const { allItems, useItem } = await import('../../items.js');
        const h = { hp: 10, maxHp: 100, level: 50, statusEffects: {}, mana: {}, manaCaps: {}, inventory: [{ ...allItems.find(i => i.id === 'qilin_hair') }] };
        const refus = useItem('qilin_hair', h, {}, 0, { allyEffect: () => ({ ok: false, message: 'Personne à ranimer' }) });
        expect(refus.success).toBe(false);
        expect(h.inventory).toHaveLength(1);
        const ok = useItem('qilin_hair', h, {}, 0, { allyEffect: () => ({ ok: true, message: 'Tu est ranimé. ' }) });
        expect(ok.success).toBe(true);
        expect(h.inventory).toHaveLength(0);   // usage unique : consommé
    });
    test('ranimer un compagnon le relève avec la part de PV demandée', () => {
        const a = buildAlly(hero(), 'monk');
        damageAlly(a, 9999);
        expect(a.ko).toBe(true);
        expect(reviveAlly(a, 0.5)).toBe(Math.round(a.maxHp * 0.5));
        expect(a.ko).toBe(false);
        expect(reviveAlly(a, 1)).toBe(0);   // déjà debout
    });
    test("Hou Yi à terre : les coups vont à un compagnon vivant ; l'équipe est battue quand tous sont à terre", () => {
        const { isMemberKO, pickAnyAlly } = require_allies;
        const t = buildTeam(Object.assign(hero(), { classes: { owned: ['assassin', 'monk'], loadout: ['assassin', 'monk'] } }));
        expect(isMemberKO(t, true, 'assassin')).toBe(true);
        expect(isMemberKO(t, false, 'assassin')).toBe(false);
        expect(pickAnyAlly(t, () => 0.9)?.classId).toBe('monk');
        damageAlly(t.monk, 9999);
        expect(pickAnyAlly(t)).toBeNull();
        expect(livingAllies(t)).toHaveLength(0);
    });
});
