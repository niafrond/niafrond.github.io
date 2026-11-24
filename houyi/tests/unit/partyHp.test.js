import { describe, test, expect } from '@jest/globals';
import { allyMaxHp, buildAlly, buildTeam, storedAllyHp, allyHpOf, healAllyAtRest, partyStatus } from '../../allies.js';

const hero = (extra = {}) => ({ maxHp: 400, hp: 300, level: 30, classes: { owned: ['assassin', 'monk', 'barbarian'], loadout: ['assassin', 'monk'] }, ...extra });

describe("vie des compagnons entre deux combats", () => {
    test("sans PV mémorisés, un compagnon est en pleine forme ; avec, il repart avec ses PV (bornés)", () => {
        const h = hero();
        expect(buildAlly(h, 'monk').hp).toBe(allyMaxHp(h, 'monk'));
        h.allyHp = { monk: 50 };
        expect(buildAlly(h, 'monk').hp).toBe(50);
        expect(buildTeam(h).monk.hp).toBe(50);
        h.allyHp = { monk: 99999 };
        expect(storedAllyHp(h, 'monk')).toBe(allyMaxHp(h, 'monk'));
        h.allyHp = { monk: 0 };
        expect(storedAllyHp(h, 'monk')).toBe(1);
    });

    test("à terre (downAllies) : 0 PV hors combat", () => {
        const h = hero({ downAllies: ['monk'], allyHp: { monk: 80 } });
        expect(allyHpOf(h, 'monk')).toBe(0);
        expect(healAllyAtRest(h, 'monk', 100)).toBe(0);
    });

    test("soin hors combat : plafonné aux PV max, mémorisé, renvoie les PV rendus", () => {
        const h = hero({ allyHp: { monk: 100 } });
        const max = allyMaxHp(h, 'monk');
        expect(healAllyAtRest(h, 'monk', 40)).toBe(40);
        expect(h.allyHp.monk).toBe(140);
        expect(healAllyAtRest(h, 'monk', 99999)).toBe(max - 140);
        expect(h.allyHp.monk).toBe(max);
        expect(healAllyAtRest(h, 'monk', 10)).toBe(0);
    });

    test("menu de l'équipe : Hou Yi puis tous les compagnons recrutés (même hors de l'équipe de combat), avec leurs PV", () => {
        const h = hero({ allyHp: { monk: 60 }, downAllies: ['barbarian'] });
        const party = partyStatus(h);
        expect(party.map(m => m.classId)).toEqual(['assassin', 'monk', 'barbarian']);
        expect(party[0]).toMatchObject({ name: 'Hou Yi', hp: 300, maxHp: 400, ko: false });
        expect(party[1]).toMatchObject({ hp: 60, ko: false });
        expect(party[2]).toMatchObject({ hp: 0, ko: true });
        expect(partyStatus(hero({ hp: 0 }))[0].ko).toBe(true);
    });
});
