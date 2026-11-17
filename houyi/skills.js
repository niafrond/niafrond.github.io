// Compétences : l'équipement enseigne, les PA (points d'apprentissage) valident, les Fulu limitent les compétences de soutien actives.
// Module pur (sans DOM).
//
// - Chaque arme en main et chaque pièce de stuff portée enseigne une ou deux compétences (tirées de façon stable depuis l'id de l'objet).
// - Après chaque victoire, le héros gagne des PA ; ils progressent pour chaque compétence enseignée par ce qu'il porte.
// - Une compétence apprise l'est pour toujours (même si l'objet est remplacé).
// - Deux familles : « action » (commande de combat, comme un sort) et « soutien » (effet passif, à activer, qui coûte des Fulu).
//
// État du héros : `hero.skills = { progress: { id: PA }, learned: [id], active: [id de soutien] }`.

import { normalizeRoster } from './classRoster.js';

const SUPPORT = 'support';
const ACTION = 'action';

/** Catalogue. `ap` : PA à cumuler pour apprendre ; `cost` : Fulu (soutien) ; `bonus` : effet passif ; `spell` : fiche de commande de combat (action). */
export const SKILLS = [
    // ── Soutien (passif) ──
    { id: 'garde_de_jade', kind: SUPPORT, name: 'Garde de jade', ap: 40, cost: 2, bonus: { defense: 4 }, description: 'Défense +4 en combat.' },
    { id: 'garde_de_bronze', kind: SUPPORT, name: 'Garde de bronze', ap: 90, cost: 3, bonus: { defense: 8 }, description: 'Défense +8 en combat.' },
    { id: 'oeil_de_faucon', kind: SUPPORT, name: 'Œil de faucon', ap: 40, cost: 2, bonus: { attack: 4, chargePct: 5 }, description: 'Attaque +4 en combat ; les classes se rechargent 5 % plus vite.' },
    { id: 'oeil_du_dragon', kind: SUPPORT, name: 'Œil du dragon', ap: 90, cost: 3, bonus: { attack: 8, chargePct: 10 }, description: 'Attaque +8 en combat ; les classes se rechargent 10 % plus vite.' },
    { id: 'peau_de_serpent', kind: SUPPORT, name: 'Peau de serpent', ap: 50, cost: 2, bonus: { poisonResist: 50 }, description: 'Réduit de moitié les dégâts de poison.' },
    { id: 'souffle_regenerant', kind: SUPPORT, name: 'Souffle régénérant', ap: 70, cost: 3, bonus: { regenPct: 3 }, description: 'Rend 3 % des PV max à chaque tour.' },
    { id: 'coeur_de_transe', kind: SUPPORT, name: 'Cœur de Xiūxiān', ap: 60, cost: 2, bonus: { transePct: 30 }, description: 'La jauge de Xiūxiān se remplit 30 % plus vite.' },
    { id: 'qi_de_reserve', kind: SUPPORT, name: 'Qì de réserve', ap: 50, cost: 2, bonus: { startMana: 2 }, description: 'Commence chaque combat avec 2 qì de chaque couleur.' },
    // ── Action (commande de combat) ──
    { id: 'tir_perforant', kind: ACTION, name: 'Tir perforant', ap: 30, description: 'Une flèche qui perce l\'armure : dégâts directs.',
      spell: { cost: { red: 8 }, dmg: 20, scales: 1 } },
    { id: 'lotus_de_soin', kind: ACTION, name: 'Lotus de soin', ap: 40, description: 'Soigne le héros.',
      spell: { cost: { green: 10 }, heal: 30, scales: 1.5 } },
    { id: 'pluie_d_etincelles', kind: ACTION, name: 'Pluie d\'étincelles', ap: 80, description: 'Une gerbe d\'étincelles qui brûle l\'adversaire.',
      spell: { cost: { red: 10, yellow: 10 }, dmg: 60, scales: 1.5 } },
    { id: 'frappe_du_tigre', kind: ACTION, name: 'Frappe du tigre', ap: 100, description: 'Un coup de croc dévastateur.',
      spell: { cost: { red: 25 }, dmg: 65, scales: 2 } },
    { id: 'source_vive', kind: ACTION, name: 'Source vive', ap: 90, description: 'Soigne généreusement le héros.',
      spell: { cost: { blue: 15, green: 15 }, heal: 90, scales: 2 } }
];

// ── Compétences de classe ──────────────────────────────────────────────────
// Chaque classe a ses propres compétences, enseignées par l'équipement comme les autres (PA gagnés en jouant la classe) :
// deux de soutien (activées avec des Fulu, effet seulement quand la classe est la classe du tour) et une action (commande de combat de la classe).
// Hors de SKILLS : la table `skillsTaughtBy` des compétences communes reste inchangée. Invisibles tant que la classe n'est pas obtenue.
export const CLASS_SKILLS = [
    { id: 'cl_assassin_brume', classId: 'assassin', kind: SUPPORT, name: 'Pas de brume', ap: 50, cost: 2, bonus: { chargePct: 10 }, description: 'Le Chasseur se recharge 10 % plus vite.' },
    { id: 'cl_assassin_oeil', classId: 'assassin', kind: SUPPORT, name: 'Œil du chasseur', ap: 60, cost: 2, bonus: { attack: 6 }, description: 'Attaque +6 quand le Chasseur joue.' },
    { id: 'cl_assassin_aube', classId: 'assassin', kind: ACTION, name: 'Flèche de l\'aube', ap: 80, description: 'Une flèche lancée à la première lueur : dégâts directs.', spell: { cost: { yellow: 20 }, dmg: 70, scales: 1.5 } },
    { id: 'cl_barbarian_loup', classId: 'barbarian', kind: SUPPORT, name: 'Peau de loup', ap: 50, cost: 2, bonus: { defense: 6 }, description: 'Défense +6 quand le Guerrier joue.' },
    { id: 'cl_barbarian_sang', classId: 'barbarian', kind: SUPPORT, name: 'Sang chaud', ap: 70, cost: 2, bonus: { regenPct: 2 }, description: 'Le Guerrier récupère 2 % de ses PV max à chaque tour.' },
    { id: 'cl_barbarian_hurle', classId: 'barbarian', kind: ACTION, name: 'Hurlement de la horde', ap: 90, description: 'Un cri qui ébranle l\'adversaire : dégâts directs.', spell: { cost: { red: 25 }, dmg: 75, scales: 2 } },
    { id: 'cl_templar_formation', classId: 'templar', kind: SUPPORT, name: 'Formation serrée', ap: 60, cost: 3, bonus: { defense: 8 }, description: 'Défense +8 quand le Commandant joue.' },
    { id: 'cl_templar_ordre', classId: 'templar', kind: SUPPORT, name: 'Ordre du jour', ap: 60, cost: 2, bonus: { chargePct: 8 }, description: 'Le Commandant se recharge 8 % plus vite.' },
    { id: 'cl_templar_etendard', classId: 'templar', kind: ACTION, name: 'Coup d\'étendard', ap: 80, description: 'Un coup porté avec la hampe de l\'étendard.', spell: { cost: { red: 15, purple: 10 }, dmg: 70, scales: 1.5 } },
    { id: 'cl_sorcerer_sceau', classId: 'sorcerer', kind: SUPPORT, name: 'Sceau d\'eau claire', ap: 50, cost: 2, bonus: { poisonResist: 50 }, description: 'Le Mage résiste à moitié au poison.' },
    { id: 'cl_sorcerer_meditation', classId: 'sorcerer', kind: SUPPORT, name: 'Méditation', ap: 60, cost: 2, bonus: { startMana: 2 }, description: 'Le Mage commence le combat avec 2 qì de chaque couleur de plus.' },
    { id: 'cl_sorcerer_foudre', classId: 'sorcerer', kind: ACTION, name: 'Foudre intérieure', ap: 90, description: 'Le qì se fait foudre : dégâts directs.', spell: { cost: { blue: 25 }, dmg: 75, scales: 2 } },
    { id: 'cl_monk_souffle', classId: 'monk', kind: SUPPORT, name: 'Souffle calme', ap: 70, cost: 3, bonus: { regenPct: 3 }, description: 'Le Moine récupère 3 % de ses PV max à chaque tour.' },
    { id: 'cl_monk_paume', classId: 'monk', kind: SUPPORT, name: 'Paume légère', ap: 50, cost: 2, bonus: { chargePct: 10 }, description: 'Le Moine se recharge 10 % plus vite.' },
    { id: 'cl_monk_soin', classId: 'monk', kind: ACTION, name: 'Paume guérisseuse', ap: 70, description: 'Une paume posée sur la plaie : soin.', spell: { cost: { green: 15 }, heal: 45, scales: 1.5 } },
    { id: 'cl_alchemist_antidote', classId: 'alchemist', kind: SUPPORT, name: 'Antidote universel', ap: 70, cost: 3, bonus: { poisonResist: 100 }, description: 'L\'Alchimiste est immunisé contre le poison.' },
    { id: 'cl_alchemist_cinabre', classId: 'alchemist', kind: SUPPORT, name: 'Réserve de cinabre', ap: 60, cost: 3, bonus: { startMana: 3 }, description: 'L\'Alchimiste commence le combat avec 3 qì de chaque couleur de plus.' },
    { id: 'cl_alchemist_fiole', classId: 'alchemist', kind: ACTION, name: 'Fiole explosive', ap: 80, description: 'Une fiole lancée qui explose : dégâts directs.', spell: { cost: { red: 10, blue: 10 }, dmg: 65, scales: 1.5 } },
    { id: 'cl_shaman_lien', classId: 'shaman', kind: SUPPORT, name: 'Lien des esprits', ap: 60, cost: 2, bonus: { transePct: 30 }, description: 'La jauge de Xiūxiān du Chamane se remplit 30 % plus vite.' },
    { id: 'cl_shaman_danse', classId: 'shaman', kind: SUPPORT, name: 'Danse rapide', ap: 50, cost: 2, bonus: { chargePct: 10 }, description: 'Le Chamane se recharge 10 % plus vite.' },
    { id: 'cl_shaman_ancetres', classId: 'shaman', kind: ACTION, name: 'Appel des ancêtres', ap: 80, description: 'Les ancêtres referment les blessures : soin.', spell: { cost: { green: 10, purple: 10 }, heal: 50, scales: 1.5 } }
];

export const getSkill = id => SKILLS.find(s => s.id === id) || CLASS_SKILLS.find(s => s.id === id) || null;
/** Compétences affichées au héros : les communes + celles des classes qu'il a obtenues (aucun spoil sur les autres). */
export const skillsFor = hero => [...SKILLS, ...CLASS_SKILLS.filter(s => normalizeRoster(hero).owned.includes(s.classId))];
export const isSupport = skill => skill?.kind === SUPPORT;
export const isAction = skill => skill?.kind === ACTION;

// ── Ce que l'équipement enseigne ────────────────────────────────────────────

const hashOf = str => {
    let h = 0x811c9dc5;
    for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
};

/**
 * Compétences enseignées par un objet (arme ou stuff) : 1 ; 2 pour une pièce rare ou légendaire. Stable pour un id donné.
 * `classIds` : classes dont l'objet enseigne aussi une compétence de classe (même règle, dans le catalogue de chaque classe).
 */
export function skillsTaughtBy(item, classIds = []) {
    if (!item?.id) return [];
    const count = item.rarity === 'rare' || item.rarity === 'legendary' ? 2 : 1;
    const pick = (list, key) => {
        const taught = [];
        const seed = hashOf(key);
        for (let i = 0; taught.length < count && i < list.length; i++) {
            const skill = list[(seed + i * 5) % list.length];
            if (!taught.includes(skill.id)) taught.push(skill.id);
        }
        return taught;
    };
    const base = pick(SKILLS, item.id);
    return [...base, ...classIds.flatMap(cls => pick(CLASS_SKILLS.filter(s => s.classId === cls), `${item.id}:${cls}`))];
}

/** Objets actuellement portés qui enseignent : arme en main + stuff. `stuffList` : fiches de stuff portées (stuff.js `wornStuff`). */
export function teachers(hero, stuffList = []) {
    const weapon = hero?.equippedWeapon || hero?.equipment?.rightHand;
    return [weapon, ...stuffList].filter(item => item?.id);
}

// ── État du héros ───────────────────────────────────────────────────────────

export function normalizeSkills(hero) {
    if (!hero) return null;
    const raw = hero.skills && typeof hero.skills === 'object' ? hero.skills : {};
    const progress = {};
    Object.entries(raw.progress && typeof raw.progress === 'object' ? raw.progress : {}).forEach(([id, n]) => {
        if (getSkill(id) && Number.isFinite(n) && n > 0) progress[id] = Math.floor(n);
    });
    const learned = [...new Set(Array.isArray(raw.learned) ? raw.learned : [])].filter(id => getSkill(id));
    const active = [...new Set(Array.isArray(raw.active) ? raw.active : [])].filter(id => learned.includes(id) && isSupport(getSkill(id)));
    if (!hero.skills || typeof hero.skills !== 'object') hero.skills = {};
    Object.assign(hero.skills, { progress, learned, active });   // en place : les références prises plus tôt restent valides
    trimActive(hero);
    return hero.skills;
}

export const isLearned = (hero, id) => normalizeSkills(hero).learned.includes(id);
export const progressOf = (hero, id) => (isLearned(hero, id) ? getSkill(id).ap : Math.min(getSkill(id)?.ap || 0, normalizeSkills(hero).progress[id] || 0));

// ── PA ──────────────────────────────────────────────────────────────────────

/** PA gagnés pour un combat gagné contre un ennemi de ce niveau. */
export const apForVictory = enemyLevel => 6 + Math.floor(Math.max(1, enemyLevel || 1) / 2);

/** Donne `amount` PA à chaque compétence enseignée par `items` et pas encore apprise. Renvoie { gained: [{ skill, ap }], learned: [skill] }. */
export function awardAp(hero, items, amount, classIds = []) {
    const state = normalizeSkills(hero);
    const result = { gained: [], learned: [] };
    const ap = Math.max(0, Math.floor(amount || 0));
    if (ap <= 0) return result;
    const ids = [...new Set(items.flatMap(item => skillsTaughtBy(item, classIds)))];   // classIds : classes jouées pendant le combat
    ids.forEach(id => {
        if (state.learned.includes(id)) return;
        const skill = getSkill(id);
        state.progress[id] = Math.min(skill.ap, (state.progress[id] || 0) + ap);
        result.gained.push({ skill, ap });
        if (state.progress[id] >= skill.ap) {
            state.learned.push(id);
            delete state.progress[id];
            result.learned.push(skill);
        }
    });
    return result;
}

// ── Fulu ────────────────────────────────────────────────────────────

/** Capacité en Fulu : 4 au départ, +1 tous les 5 niveaux. */
export const magikolithCapacity = hero => 4 + Math.floor(Math.max(1, hero?.level || 1) / 5);

export const usedMagikoliths = hero => normalizeSkills(hero).active.reduce((n, id) => n + (getSkill(id)?.cost || 0), 0);

function trimActive(hero) {
    const state = hero.skills;
    let used = 0;
    const cap = magikolithCapacity(hero);
    state.active = state.active.filter(id => {
        const cost = getSkill(id)?.cost || 0;
        if (used + cost > cap) return false;
        used += cost;
        return true;
    });
}

/** Active ou désactive une compétence de soutien apprise. Renvoie { ok, message }. */
export function toggleSupport(hero, id) {
    const state = normalizeSkills(hero);
    const skill = getSkill(id);
    if (!skill || !isSupport(skill)) return { ok: false, message: 'Cette compétence ne s\'active pas.' };
    if (!state.learned.includes(id)) return { ok: false, message: `${skill.name} n'est pas encore apprise.` };
    if (state.active.includes(id)) {
        hero.skills.active = hero.skills.active.filter(a => a !== id);
        return { ok: true, active: false, message: `${skill.name} désactivée.` };
    }
    const left = magikolithCapacity(hero) - usedMagikoliths(hero);
    if (skill.cost > left) return { ok: false, message: `Pas assez de Fulu : ${skill.name} en demande ${skill.cost}, il en reste ${left}.` };
    hero.skills.active.push(id);   // `hero.skills` (et non `state`) : la normalisation recrée l'objet à chaque lecture
    return { ok: true, active: true, message: `${skill.name} activée.` };
}

// ── Effets ──────────────────────────────────────────────────────────────────

/** Somme d'un bonus (`attack`, `defense`, `poisonResist`, `regenPct`, `transePct`, `startMana`) des compétences de soutien actives. */
export function skillBonus(hero, key) {
    if (!hero?.skills?.active?.length) return 0;
    // Une compétence de classe ne joue que quand cette classe est la classe du tour (`hero.turnClassId`, posé par game.js).
    return hero.skills.active.reduce((n, id) => {
        const skill = getSkill(id);
        if (skill?.classId && skill.classId !== hero.turnClassId) return n;
        return n + (skill?.bonus?.[key] || 0);
    }, 0);
}

/** Commandes de combat : fiches de sort des compétences d'action apprises (même forme que les sorts du jeu). */
export function actionSpells(hero) {
    const state = normalizeSkills(hero);
    const level = Math.max(1, hero?.level || 1);
    return state.learned.map(getSkill).filter(isAction).map(skill => ({
        id: `skill_${skill.id}`, skillId: skill.id, name: skill.name, skill: true, ...(skill.classId ? { class: skill.classId } : {}),
        minLevel: 1, cost: { ...skill.spell.cost }, description: skill.description,
        ...(skill.spell.dmg ? { dmg: Math.round(skill.spell.dmg + level * skill.spell.scales) } : {}),
        ...(skill.spell.heal ? { heal: Math.round(skill.spell.heal + level * skill.spell.scales) } : {})
    }));
}
