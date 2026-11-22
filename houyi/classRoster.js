// Équipe de Hou Yi. Hou Yi est le Chasseur (`assassin`) ; chaque autre classe est portée par un COMPAGNON (allies.js) que le héros recrute au fil de
// l'histoire (maîtres de classe rencontrés dans les villages : leur entraînement les convainc de le suivre). L'équipe de combat compte Hou Yi et
// 3 compagnons au plus (MAX_USABLE_CLASSES = 4). Certains biomes brident des classes (voir BIOME_CLASS_LIMITS) pour pousser le joueur à mêler les
// compagnons. Module pur (sans DOM).
//
// État du héros : `hero.classes = { owned: [id], loadout: [id] }` : `owned` = Hou Yi + compagnons recrutés, `loadout` = l'équipe de combat
// (loadout ⊂ owned, toujours avec Hou Yi, 1 à 4 membres). Le nom `classes` est historique : un membre = une classe = un compagnon.

export const MAX_USABLE_CLASSES = 4;
export const CLASS_IDS = ['assassin', 'barbarian', 'templar', 'sorcerer', 'monk', 'alchemist', 'shaman'];
export const START_CLASS = 'assassin';

export const CLASS_SHORT = { assassin: 'Chasseur', barbarian: 'Guerrier', templar: 'Commandant', sorcerer: 'Mage', monk: 'Moine', alchemist: 'Alchimiste', shaman: 'Chamane' };

/** Classes bridées par biome (clé = champ `biome` des cartes) : leur raison est affichée au joueur. */
export const BIOME_CLASS_LIMITS = {
    volcano: { classes: ['templar', 'monk'], reason: 'la chaleur des gorges étouffe armures et robes' },
    gobi: { classes: ['sorcerer'], reason: 'le sable brouille les talismans' },
    riverbed: { classes: ['alchemist'], reason: 'le fleuve délave les poudres et les élixirs' },
    bamboo: { classes: ['barbarian'], reason: 'les bambous serrés interdisent les grands gestes' },
    storm: { classes: ['monk', 'shaman'], reason: 'la foudre couvre les prières et les chants' },
    savanna: { classes: ['assassin'], reason: 'la plaine ouverte trahit Hou Yi' },
    coast: { classes: ['barbarian', 'alchemist'], reason: 'les embruns éteignent la rage et les fourneaux' },
    tides: { classes: ['templar', 'sorcerer'], reason: 'les hautes eaux emportent boucliers et parchemins' },
    fusang: { classes: ['shaman'], reason: 'l\'arbre céleste fait taire les esprits' },
    moon: { classes: ['barbarian', 'assassin'], reason: 'la lumière lunaire apaise les lames' }
};

const known = id => CLASS_IDS.includes(id);

export function normalizeRoster(hero) {
    if (!hero) return null;
    const raw = hero.classes && typeof hero.classes === 'object' ? hero.classes : {};
    const owned = [...new Set([...(Array.isArray(raw.owned) ? raw.owned : []), ...(hero.class ? [hero.class] : [])])].filter(known);
    if (!owned.length) owned.push(START_CLASS);
    let loadout = [...new Set(Array.isArray(raw.loadout) ? raw.loadout : [])].filter(id => owned.includes(id)).slice(0, MAX_USABLE_CLASSES);
    if (!loadout.length) loadout = owned.slice(0, MAX_USABLE_CLASSES);
    if (!loadout.includes(START_CLASS)) loadout = [START_CLASS, ...loadout].slice(0, MAX_USABLE_CLASSES);   // Hou Yi est toujours de l'équipe
    hero.classes = { owned, loadout };
    return hero.classes;
}

export const ownsClass = (hero, id) => normalizeRoster(hero).owned.includes(id);

/** Recrute un compagnon (sa classe) ; il rejoint l'équipe de combat s'il reste de la place. Renvoie { ok, added, inLoadout }. */
export function grantClass(hero, id) {
    if (!known(id)) return { ok: false, added: false, inLoadout: false };
    const roster = normalizeRoster(hero);
    if (roster.owned.includes(id)) return { ok: true, added: false, inLoadout: roster.loadout.includes(id) };
    roster.owned.push(id);
    const inLoadout = roster.loadout.length < MAX_USABLE_CLASSES;
    if (inLoadout) roster.loadout.push(id);
    return { ok: true, added: true, inLoadout };
}

/** Ajoute ou retire un compagnon recruté de l'équipe de combat (hors combat). Renvoie { ok, message }. */
export function toggleLoadout(hero, id) {
    const roster = normalizeRoster(hero);
    if (!roster.owned.includes(id)) return { ok: false, message: "Ce compagnon ne vous a pas encore rejoint." };
    if (roster.loadout.includes(id)) {
        if (id === START_CLASS) return { ok: false, message: 'Hou Yi est toujours de l\'équipe.' };
        roster.loadout = roster.loadout.filter(c => c !== id);
        return { ok: true, inLoadout: false, message: `${CLASS_SHORT[id]} quitte l'équipe de combat.` };
    }
    if (roster.loadout.length >= MAX_USABLE_CLASSES) return { ok: false, message: `Hou Yi et trois compagnons au plus : retirez-en un d'abord.` };
    roster.loadout.push(id);
    return { ok: true, inLoadout: true, message: `${CLASS_SHORT[id]} rejoint l'équipe de combat.` };
}

/**
 * Classes bridées dans ce biome pour ce héros : { id: raison }. Il reste toujours au moins une classe de combat utilisable :
 * si toutes seraient bridées, on lève la restriction de la première.
 */
export function restrictedClasses(hero, biome) {
    const limit = BIOME_CLASS_LIMITS[biome];
    if (!limit) return {};
    const loadout = normalizeRoster(hero).loadout;
    const blocked = loadout.filter(id => limit.classes.includes(id));
    if (blocked.length >= loadout.length) blocked.shift();
    return Object.fromEntries(blocked.map(id => [id, limit.reason]));
}

/** Classes utilisables ce tour : classes de combat non bridées ; en entraînement, uniquement la classe imposée. */
export function usableClasses(hero, biome, forcedClass = null) {
    if (forcedClass && known(forcedClass)) return [forcedClass];
    const restricted = restrictedClasses(hero, biome);
    return normalizeRoster(hero).loadout.filter(id => !restricted[id]);
}
