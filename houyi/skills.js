// Compétences : l'équipement enseigne, les PA (points d'apprentissage) valident, les magikolithes limitent les compétences de soutien actives.
// Module pur (sans DOM).
//
// - Chaque arme en main et chaque pièce de stuff portée enseigne une ou deux compétences (tirées de façon stable depuis l'id de l'objet).
// - Après chaque victoire, le héros gagne des PA ; ils progressent pour chaque compétence enseignée par ce qu'il porte.
// - Une compétence apprise l'est pour toujours (même si l'objet est remplacé).
// - Deux familles : « action » (commande de combat, comme un sort) et « soutien » (effet passif, à activer, qui coûte des magikolithes).
//
// État du héros : `hero.skills = { progress: { id: PA }, learned: [id], active: [id de soutien] }`.

const SUPPORT = 'support';
const ACTION = 'action';

/** Catalogue. `ap` : PA à cumuler pour apprendre ; `cost` : magikolithes (soutien) ; `bonus` : effet passif ; `spell` : fiche de commande de combat (action). */
export const SKILLS = [
    // ── Soutien (passif) ──
    { id: 'garde_de_jade', kind: SUPPORT, name: 'Garde de jade', ap: 40, cost: 2, bonus: { defense: 4 }, description: 'Défense +4 en combat.' },
    { id: 'garde_de_bronze', kind: SUPPORT, name: 'Garde de bronze', ap: 90, cost: 3, bonus: { defense: 8 }, description: 'Défense +8 en combat.' },
    { id: 'oeil_de_faucon', kind: SUPPORT, name: 'Œil de faucon', ap: 40, cost: 2, bonus: { attack: 4 }, description: 'Attaque +4 en combat.' },
    { id: 'oeil_du_dragon', kind: SUPPORT, name: 'Œil du dragon', ap: 90, cost: 3, bonus: { attack: 8 }, description: 'Attaque +8 en combat.' },
    { id: 'peau_de_serpent', kind: SUPPORT, name: 'Peau de serpent', ap: 50, cost: 2, bonus: { poisonResist: 50 }, description: 'Réduit de moitié les dégâts de poison.' },
    { id: 'souffle_regenerant', kind: SUPPORT, name: 'Souffle régénérant', ap: 70, cost: 3, bonus: { regenPct: 3 }, description: 'Rend 3 % des PV max à chaque tour.' },
    { id: 'coeur_de_transe', kind: SUPPORT, name: 'Cœur de transe', ap: 60, cost: 2, bonus: { transePct: 30 }, description: 'La jauge de Transe se remplit 30 % plus vite.' },
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

export const getSkill = id => SKILLS.find(s => s.id === id) || null;
export const isSupport = skill => skill?.kind === SUPPORT;
export const isAction = skill => skill?.kind === ACTION;

// ── Ce que l'équipement enseigne ────────────────────────────────────────────

const hashOf = str => {
    let h = 0x811c9dc5;
    for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
};

/** Compétences enseignées par un objet (arme ou stuff) : 1 ; 2 pour une pièce rare ou légendaire. Stable pour un id donné. */
export function skillsTaughtBy(item) {
    if (!item?.id) return [];
    const count = item.rarity === 'rare' || item.rarity === 'legendary' ? 2 : 1;
    const taught = [];
    const seed = hashOf(item.id);
    for (let i = 0; taught.length < count && i < SKILLS.length; i++) {
        const skill = SKILLS[(seed + i * 5) % SKILLS.length];
        if (!taught.includes(skill.id)) taught.push(skill.id);
    }
    return taught;
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
export function awardAp(hero, items, amount) {
    const state = normalizeSkills(hero);
    const result = { gained: [], learned: [] };
    const ap = Math.max(0, Math.floor(amount || 0));
    if (ap <= 0) return result;
    const ids = [...new Set(items.flatMap(skillsTaughtBy))];
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

// ── Magikolithes ────────────────────────────────────────────────────────────

/** Capacité en magikolithes : 4 au départ, +1 tous les 5 niveaux. */
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
    if (skill.cost > left) return { ok: false, message: `Pas assez de magikolithes : ${skill.name} en demande ${skill.cost}, il en reste ${left}.` };
    hero.skills.active.push(id);   // `hero.skills` (et non `state`) : la normalisation recrée l'objet à chaque lecture
    return { ok: true, active: true, message: `${skill.name} activée.` };
}

// ── Effets ──────────────────────────────────────────────────────────────────

/** Somme d'un bonus (`attack`, `defense`, `poisonResist`, `regenPct`, `transePct`, `startMana`) des compétences de soutien actives. */
export function skillBonus(hero, key) {
    if (!hero?.skills?.active?.length) return 0;
    return hero.skills.active.reduce((n, id) => n + (getSkill(id)?.bonus?.[key] || 0), 0);
}

/** Commandes de combat : fiches de sort des compétences d'action apprises (même forme que les sorts du jeu). */
export function actionSpells(hero) {
    const state = normalizeSkills(hero);
    const level = Math.max(1, hero?.level || 1);
    return state.learned.map(getSkill).filter(isAction).map(skill => ({
        id: `skill_${skill.id}`, skillId: skill.id, name: skill.name, skill: true,
        minLevel: 1, cost: { ...skill.spell.cost }, description: skill.description,
        ...(skill.spell.dmg ? { dmg: Math.round(skill.spell.dmg + level * skill.spell.scales) } : {}),
        ...(skill.spell.heal ? { heal: Math.round(skill.spell.heal + level * skill.spell.scales) } : {})
    }));
}
