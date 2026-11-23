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
        const first = h.skills.activeBy.assassin[0];
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

describe('Fulu par personnage (avis Équilibrage) : chacun a les compétences de sa classe', () => {
    const team = (extra = {}) => ({ level: 10, classes: { owned: ['assassin', 'monk', 'barbarian', 'sorcerer'], loadout: ['assassin', 'monk', 'barbarian', 'sorcerer'] }, skills: { learned: ['garde_de_jade', 'garde_de_bronze', 'oeil_de_faucon', 'tonnerre_lointain', 'cl_monk_souffle', 'cl_monk_paume', 'cl_monk_soin', 'cl_barbarian_loup', 'cl_barbarian_sang', 'cl_sorcerer_meditation'], progress: {}, activeBy: {} }, ...extra });

    test('chaque personnage a la même capacité : 4 + 1 tous les 5 niveaux (1, 5, 10, 20, 30, 50 → 4, 5, 6, 8, 10, 14)', async () => {
        const { memberFuluCapacity } = await import('../../skills.js');
        expect([1, 5, 10, 20, 30, 50].map(level => memberFuluCapacity({ level }))).toEqual([4, 5, 6, 8, 10, 14]);
        expect(memberFuluCapacity({ level: 70 })).toBeLessThanOrEqual(18);   // garde-fou : pas de dérive silencieuse
    });
    test('chaque compétence appartient à un personnage : sa classe, ou Hou Yi pour une compétence commune', async () => {
        const { skillOwner, getSkill } = await import('../../skills.js');
        expect(skillOwner(getSkill('cl_monk_paume'))).toBe('monk');
        expect(skillOwner(getSkill('garde_de_jade'))).toBe('assassin');
        expect(skillOwner(getSkill('tonnerre_lointain'))).toBe('assassin');
    });
    test('on ne peut allumer une compétence que pour son propriétaire', async () => {
        const { toggleSkill } = await import('../../skills.js');
        const h = team();
        expect(toggleSkill(h, 'cl_monk_paume', 'assassin').ok).toBe(false);
        expect(toggleSkill(h, 'garde_de_jade', 'monk').ok).toBe(false);   // une commune est à Hou Yi
        expect(toggleSkill(h, 'garde_de_jade', 'monk').message).toMatch(/appartient à Hou Yi/);
        expect(toggleSkill(h, 'cl_monk_paume').member).toBe('monk');   // sans précision : son propriétaire
        expect(toggleSkill(h, 'garde_de_jade').member).toBe('assassin');
    });
    test('les réserves sont indépendantes : les Fulu de Fuxi ne sont pas ceux de Hou Yi', async () => {
        const { toggleSkill, usedMagikoliths } = await import('../../skills.js');
        const h = team();
        toggleSkill(h, 'garde_de_bronze');   // Hou Yi : 3
        toggleSkill(h, 'cl_monk_souffle');   // Fuxi : 3
        expect(usedMagikoliths(h, 'assassin')).toBe(3);
        expect(usedMagikoliths(h, 'monk')).toBe(3);
        expect(usedMagikoliths(h, 'barbarian')).toBe(0);
    });
    test('chacun est limité par SA réserve', async () => {
        const { toggleSkill } = await import('../../skills.js');
        const h = team({ level: 1 });   // capacité 4
        expect(toggleSkill(h, 'cl_monk_souffle').ok).toBe(true);   // 3
        expect(toggleSkill(h, 'cl_monk_paume').ok).toBe(false);   // +2 : 5 > 4, même si Hou Yi n'a rien allumé
        expect(toggleSkill(h, 'cl_barbarian_loup').ok).toBe(true);   // la réserve du barbare est intacte
    });
    test('un membre qui n\'est pas dans l\'équipe ne peut rien allumer', async () => {
        const { toggleSkill } = await import('../../skills.js');
        expect(toggleSkill(team(), 'cl_shaman_danse', 'shaman').ok).toBe(false);
    });
    test('le chargement d\'une classe ne lit que les compétences de ce personnage', async () => {
        const { toggleSkill, skillBonus } = await import('../../skills.js');
        const h = team();
        toggleSkill(h, 'cl_monk_paume');
        expect(skillBonus(h, 'chargePct', 'monk')).toBe(10);
        expect(skillBonus(h, 'chargePct', 'assassin')).toBe(0);
        expect(skillBonus(h, 'chargePct', 'barbarian')).toBe(0);
    });
    test('un bonus de Hou Yi agit en permanence ; celui d\'une classe seulement quand c\'est son tour', async () => {
        const { toggleSkill, skillBonus } = await import('../../skills.js');
        const h = team();
        toggleSkill(h, 'garde_de_jade'); toggleSkill(h, 'cl_barbarian_loup');
        h.turnClassId = 'monk';
        expect(skillBonus(h, 'defense')).toBe(4);   // Hou Yi seul
        h.turnClassId = 'barbarian';
        expect(skillBonus(h, 'defense')).toBe(10);   // + Peau de loup (6)
    });
    test('qì de départ : somme de l\'équipe plafonnée à 8 par couleur (le qì est commun)', async () => {
        const { teamStartMana, START_MANA_TEAM_CAP } = await import('../../skills.js');
        const h = team({ level: 30 });
        h.skills.activeBy = { assassin: ['puits_de_qi'], sorcerer: ['cl_sorcerer_meditation'] };   // 4 + 2
        h.skills.learned.push('puits_de_qi');
        expect(START_MANA_TEAM_CAP).toBe(8);
        expect(teamStartMana(h)).toBe(6);
        h.skills.activeBy.assassin = ['puits_de_qi', 'goutte_de_qi', 'qi_de_reserve'];   // 4 + 1 + 2 + 2 : dépasse
        h.skills.learned.push('goutte_de_qi', 'qi_de_reserve');
        expect(teamStartMana(h)).toBe(8);
    });
    test('les actions : une commune est dans la liste de Hou Yi, une de classe dans celle de sa classe', async () => {
        const { toggleSkill, actionSpells } = await import('../../skills.js');
        const h = team();
        toggleSkill(h, 'tonnerre_lointain'); toggleSkill(h, 'cl_monk_soin');
        const spells = actionSpells(h);
        expect(spells.find(sp => sp.skillId === 'tonnerre_lointain').class).toBeUndefined();
        expect(spells.find(sp => sp.skillId === 'cl_monk_soin').class).toBe('monk');
    });
    test('migration : l\'ancienne liste commune va à Hou Yi, une compétence de classe à sa classe ; rien n\'est perdu', async () => {
        const { normalizeSkills } = await import('../../skills.js');
        const h = { level: 10, classes: { owned: ['assassin', 'monk'], loadout: ['assassin', 'monk'] }, skills: { learned: ['garde_de_jade', 'cl_monk_paume', 'cl_assassin_aube'], active: ['garde_de_jade', 'cl_monk_paume'], progress: {} } };
        const state = normalizeSkills(h);
        expect(state.activeBy).toEqual({ assassin: ['garde_de_jade'], monk: ['cl_monk_paume'] });
        expect(state.active).toBeUndefined();
        expect(normalizeSkills(h).activeBy).toEqual({ assassin: ['garde_de_jade'], monk: ['cl_monk_paume'] });   // idempotent
    });
    test('les anciennes sauvegardes ne perdent aucune compétence : l\'ancienne liste tenait dans la réserve de Hou Yi, inchangée', async () => {
        const { normalizeSkills, usedMagikoliths, memberFuluCapacity } = await import('../../skills.js');
        const h = { level: 5, classes: { owned: ['assassin'], loadout: ['assassin'] }, skills: { learned: ['garde_de_bronze', 'oeil_de_faucon'], active: ['garde_de_bronze', 'oeil_de_faucon'], progress: {} } };   // 3 + 2 = 5 = capacité au niveau 5
        normalizeSkills(h);
        expect(h.skills.activeBy.assassin).toEqual(['garde_de_bronze', 'oeil_de_faucon']);
        expect(usedMagikoliths(h)).toBeLessThanOrEqual(memberFuluCapacity(h));
    });
});
