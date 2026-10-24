// Sorts ultimes (« rage ») : une jauge se charge quand le joueur subit des dégâts ; pleine, elle permet de lancer un
// ultime (2 par classe, hors limite des 4 sorts équipés). Les ultimes coûtent beaucoup de qì.
import { ultimateSpells } from './spells.js';

export const RAGE_MAX = 100;
// Perdre cette part des PV max remplit la jauge (150 % : la moitié des PV max suffit à la remplir ×0,75).
const RAGE_PER_MAX_HP = 1.5;

export function getUltimatesForClass(className){
    return ultimateSpells.filter(spell => spell.class === className);
}

export function getUltimateById(id){
    return ultimateSpells.find(spell => spell.id === id) || null;
}

// Ultimes de légende (les Quatre Gardiens Célestes) : gagnés en terminant une quête (`spell.unlock.quest`), quelle que soit la classe.
// Les ultimes de classe, eux, sont liés à leur classe (`spell.class`) et ne dépendent que du niveau.
export const isQuestUltimate = spell => typeof spell?.unlock?.quest === 'string';

export function getQuestUltimates(){
    return ultimateSpells.filter(isQuestUltimate);
}

/** Identifiants d'ultimes de légende valides, sans doublon (sauvegardes anciennes, modifiées ou venant d'un autre appareil). */
export function normalizeUnlockedUltimates(ids){
    const known = new Set(getQuestUltimates().map(spell => spell.id));
    return [...new Set(Array.isArray(ids) ? ids : [])].filter(id => known.has(id));
}

export const isUltimateUnlocked = (entity, spell) => isQuestUltimate(spell)
    ? normalizeUnlockedUltimates(entity?.unlockedUltimates).includes(spell.id)
    : spell?.class === entity?.class;

/** Débloque un ultime de légende pour `entity` ; retourne false s'il est inconnu, n'est pas de légende ou était déjà débloqué. */
export function unlockUltimate(entity, id){
    const spell = getUltimateById(id);
    if(!entity || !isQuestUltimate(spell)) return false;
    entity.unlockedUltimates = normalizeUnlockedUltimates(entity.unlockedUltimates);
    if(entity.unlockedUltimates.includes(id)) return false;
    entity.unlockedUltimates.push(id);
    return true;
}

// Ultimes de légende qu'une quête (terminée ou non) permettra de gagner : pour l'afficher verrouillé dans la liste.
export const getLockedQuestUltimates = entity => getQuestUltimates().filter(spell => !isUltimateUnlocked(entity, spell));

// Ultimes que le joueur peut choisir : ceux de sa classe, puis ceux de légende qu'il a débloqués, dont le niveau requis est atteint.
export function getSelectableUltimates(entity){
    if(entity?.cheatAllUltimates === true) return [...ultimateSpells];   // menu secret : tous les ultimes, toutes classes et niveaux
    const level = entity?.level || 1;
    const legends = getQuestUltimates().filter(spell => isUltimateUnlocked(entity, spell));
    return [...getUltimatesForClass(entity?.class), ...legends].filter(spell => level >= (spell.minLevel || 1));
}

// Le seul ultime accessible en combat : celui choisi dans l'onglet Sorts, à défaut le premier débloqué.
export function getEquippedUltimate(entity){
    const choices = getSelectableUltimates(entity);
    return choices.find(spell => spell.id === entity?.equippedUltimate) || choices[0] || null;
}

// Rage gagnée pour `damage` PV perdus (au moins 1 par coup reçu).
export function rageFromDamage(damage, maxHp){
    const dealt = Math.max(0, Math.floor(damage || 0));
    if(dealt <= 0) return 0;
    const ratio = dealt / Math.max(1, Math.floor(maxHp || 1));
    return Math.max(1, Math.round(ratio * RAGE_MAX * RAGE_PER_MAX_HP));
}

export function addRage(entity, amount){
    if(!entity) return 0;
    const before = Math.max(0, Math.min(RAGE_MAX, Math.floor(entity.rage || 0)));
    entity.rage = Math.min(RAGE_MAX, before + Math.max(0, Math.floor(amount || 0)));
    return entity.rage - before;
}

export function resetRage(entity){
    if(entity) entity.rage = 0;
}

export function isRageFull(entity){
    if(entity?.cheatMaxRage === true) return true;   // menu secret « rage toujours au max »
    return Math.floor(entity?.rage || 0) >= RAGE_MAX;
}

// Cinématique plein écran d'un ultime : point d'extension. Une prochaine version y enregistrera, par `spell.cinematic`
// (ex. « ultimate-sorcerer-1 »), une fonction `async (spell) => {...}` qui joue la scène avant l'effet.
const ultimateCinematics = new Map();

export function registerUltimateCinematic(id, play){
    ultimateCinematics.set(id, play);
}

export async function playUltimateCinematic(spell){
    const play = spell && ultimateCinematics.get(spell.cinematic);
    if(typeof play === 'function') await play(spell);
}
