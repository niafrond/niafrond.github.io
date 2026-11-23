import { describe, test, expect } from '@jest/globals';
import './fixtures/xhrFromDisk.js';
import { allWeapons } from '../../weapons.js';
import { SKILLS, visibleSkills, markSeen, skillsTaughtBy, awardAp, toggleSupport, magikolithCapacity, usedMagikoliths, skillBonus, actionSpells, normalizeSkills, teachers, apForVictory } from '../../skills.js';

const hero = (extra = {}) => ({ level: 10, equippedWeapon: { id: 'arc_de_feu', rarity: 'legendary' }, skills: {}, ...extra });

describe('compétences enseignées par l\'équipement', () => {
    test('stables, 2 pour un objet commun, 3 pour un objet rare', () => {
        expect(skillsTaughtBy({ id: 'x', rarity: 'common' })).toHaveLength(2);
        const rare = skillsTaughtBy({ id: 'arc_de_feu', rarity: 'legendary' });
        expect(rare).toHaveLength(3);
        expect(skillsTaughtBy({ id: 'arc_de_feu', rarity: 'legendary' })).toEqual(rare);
        expect(skillsTaughtBy(null)).toEqual([]);
    });
    test('les PA font apprendre ; une compétence apprise reste acquise', () => {
        const h = hero();
        const res = awardAp(h, teachers(h), 1000);
        expect(res.learned.length).toBeGreaterThan(0);
        const learned = [...h.skills.learned];
        h.equippedWeapon = null;
        awardAp(h, teachers(h), 50);
        expect(h.skills.learned).toEqual(learned);
    });
    test('progression partielle', () => {
        const h = hero();
        awardAp(h, teachers(h), 1);
        expect(Object.values(h.skills.progress).every(n => n === 1)).toBe(true);
        expect(apForVictory(10)).toBe(11);
    });
});

describe('Fulu', () => {
    const soutien = SKILLS.filter(s => s.kind === 'support');
    test('une compétence non apprise ne s\'active pas', () => {
        expect(toggleSupport(hero(), soutien[0].id).ok).toBe(false);
    });
    test('la capacité limite les compétences actives', () => {
        const h = hero({ level: 1 });   // capacité 4
        h.skills = { learned: soutien.map(s => s.id) };
        normalizeSkills(h);
        expect(magikolithCapacity(h)).toBe(4);
        let refused = false;
        soutien.forEach(s => { if (!toggleSupport(h, s.id).ok) refused = true; });
        expect(refused).toBe(true);
        expect(usedMagikoliths(h)).toBeLessThanOrEqual(4);
        const first = h.skills.active[0];
        expect(toggleSupport(h, first).active).toBe(false);
    });
    test('les bonus ne comptent que les compétences actives', () => {
        const h = hero({ level: 30 });
        h.skills = { learned: ['garde_de_jade'], active: [] };
        normalizeSkills(h);
        expect(skillBonus(h, 'defense')).toBe(0);
        toggleSupport(h, 'garde_de_jade');
        expect(skillBonus(h, 'defense')).toBe(4);
    });
});

test('les compétences d\'action apprises donnent des commandes de combat', () => {
    const h = hero();
    h.skills = { learned: ['tir_perforant', 'lotus_de_soin', 'garde_de_jade'], active: ['tir_perforant', 'lotus_de_soin'] };   // une action ne devient commande de combat qu'allumée (Fulu)
    const spells = actionSpells(h);
    expect(spells.map(s => s.id)).toEqual(['skill_tir_perforant', 'skill_lotus_de_soin']);
    expect(spells[0].dmg).toBeGreaterThan(0);
    expect(spells[1].heal).toBeGreaterThan(0);
});

describe('variété et visibilité des compétences', () => {
    test('le catalogue est varié et les armes enseignent des compétences différentes', () => {
        expect(SKILLS.length).toBeGreaterThanOrEqual(30);
        const sets = new Set(allWeapons.map(w => skillsTaughtBy(w).join('|')));
        expect(sets.size).toBeGreaterThan(allWeapons.length * 0.8);
        const covered = new Set(allWeapons.flatMap(w => skillsTaughtBy(w)));
        expect(covered.size).toBeGreaterThan(SKILLS.length * 0.55);
    });
    test('une compétence jamais vue reste cachée ; celle que l\'arme enseigne devient visible, puis le reste visible', () => {
        const h = hero({ equippedWeapon: null });
        const base = 'cl_assassin_brume';   // compétence de base du Chasseur : apprise et visible d'office
        expect(visibleSkills(h).map(s => s.id)).toEqual([base]);
        const taught = skillsTaughtBy({ id: 'arc_de_bronze', rarity: 'common' });
        expect(visibleSkills(h, taught).map(s => s.id).sort()).toEqual([...taught, base].sort());
        markSeen(h, taught);
        expect(visibleSkills(h).map(s => s.id).sort()).toEqual([...taught, base].sort());
    });
});

describe('description chiffrée des compétences d\'action', () => {
    test('dégâts ou soin et coût en qì, jamais de phrase d\'ambiance', async () => {
        const { skillDescription, getSkill } = await import('../../skills.js');
        expect(skillDescription(getSkill('tonnerre_lointain'))).toBe('Inflige 70 dégâts (+2 par niveau). Coût : 25 qì jaune.');
        expect(skillDescription(getSkill('tonnerre_lointain'), 2)).toBe('Inflige 74 dégâts. Coût : 25 qì jaune.');
        expect(skillDescription(getSkill('lotus_de_soin'), 5)).toBe('Soigne 38 PV. Coût : 10 qì vert.');
        expect(skillDescription(getSkill('salve_double'))).toMatch(/^Inflige 62 dégâts.*10 qì rouge \+ 10 qì jaune/);
        expect(skillDescription(getSkill('garde_de_jade'))).toBe('Défense +4 en combat.');   // un soutien garde sa phrase chiffrée
    });
    test('la fiche de sort d\'une action apprise porte la même description chiffrée', async () => {
        const { actionSpells, SKILLS } = await import('../../skills.js');
        const hero = { level: 2, skills: { progress: {}, learned: ['tonnerre_lointain'], active: ['tonnerre_lointain'] } };
        expect(actionSpells(hero)[0].description).toBe('Inflige 74 dégâts. Coût : 25 qì jaune.');
        expect(SKILLS.length).toBeGreaterThan(0);
    });
});

describe('actions : elles s\'allument avec des Fulu, comme les soutiens', () => {
    const base = () => ({ level: 1, skills: { learned: ['tir_perforant', 'frappe_du_tigre', 'tonnerre_lointain'], active: [], progress: {} } });
    test('chaque action a un coût en Fulu selon ses PA (1 à 4)', async () => {
        const { SKILLS, CLASS_SKILLS, actionFuluCost } = await import('../../skills.js');
        [...SKILLS, ...CLASS_SKILLS].filter(s => s.spell).forEach(s => { expect(s.cost).toBe(actionFuluCost(s.ap)); expect(s.cost).toBeGreaterThanOrEqual(1); });
        expect([30, 40, 41, 70, 71, 100, 101].map(actionFuluCost)).toEqual([1, 1, 2, 2, 3, 3, 4]);
    });
    test('apprise mais éteinte : aucune commande de combat', async () => {
        const { actionSpells } = await import('../../skills.js');
        expect(actionSpells(base())).toEqual([]);
    });
    test('allumer une action la rend disponible et consomme des Fulu ; l\'éteindre les rend', async () => {
        const { toggleSkill, actionSpells, usedMagikoliths } = await import('../../skills.js');
        const h = base();
        expect(toggleSkill(h, 'tir_perforant')).toMatchObject({ ok: true, active: true });
        expect(usedMagikoliths(h)).toBe(1);
        expect(actionSpells(h).map(s => s.id)).toEqual(['skill_tir_perforant']);
        expect(toggleSkill(h, 'tir_perforant')).toMatchObject({ ok: true, active: false });
        expect(usedMagikoliths(h)).toBe(0);
        expect(actionSpells(h)).toEqual([]);
    });
    test('pas assez de Fulu : l\'action reste éteinte', async () => {
        const { toggleSkill, magikolithCapacity } = await import('../../skills.js');
        const h = base();   // capacité 4 : Tonnerre lointain (3) puis Frappe du tigre (3) ne tiennent pas ensemble
        expect(magikolithCapacity(h)).toBe(4);
        expect(toggleSkill(h, 'tonnerre_lointain').ok).toBe(true);
        const refused = toggleSkill(h, 'frappe_du_tigre');
        expect(refused.ok).toBe(false);
        expect(refused.message).toMatch(/Fulu/);
    });
    test('une action non apprise ne s\'allume pas', async () => {
        const { toggleSkill } = await import('../../skills.js');
        expect(toggleSkill({ level: 1, skills: { learned: [], active: [], progress: {} } }, 'tir_perforant').ok).toBe(false);
    });
});
