// Sorts ultimes (« rage ») : une jauge se charge quand le joueur subit des dégâts ; pleine, elle permet de lancer un
// ultime (2 par classe, hors limite des 4 sorts équipés). Les ultimes coûtent beaucoup de mana.
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

// Ultimes que le joueur peut choisir : ceux de sa classe dont le niveau requis est atteint.
export function getSelectableUltimates(entity){
    if(entity?.cheatAllUltimates === true) return [...ultimateSpells];   // menu secret : tous les ultimes, toutes classes et niveaux
    return getUltimatesForClass(entity?.class).filter(spell => (entity?.level || 1) >= (spell.minLevel || 1));
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
