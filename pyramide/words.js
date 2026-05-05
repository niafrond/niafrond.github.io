// ============================================================
// pyramide/words.js — Logique de sélection des mots
// Les données brutes sont dans data.js
// ============================================================
import {
  R1_PHRASE_SETS,
  R1_PHRASE_SETS_ADULTE,
  R2_WORDS,
  R3_SETS,
  R4_SETS,
  FINAL_SETS,
} from './data.js';

// Re-export des constantes pour rétrocompatibilité
export { R1_PHRASE_SETS, R1_PHRASE_SETS_ADULTE, R2_WORDS, R3_SETS, R4_SETS, FINAL_SETS };

// Alias plat (rétrocompatibilité)
export const R1_WORDS = R1_PHRASE_SETS.flatMap(s => s.words);

// Pools R1 par mode (mode taggé explicitement)
const R1_CHILD_POOL = R1_PHRASE_SETS.map(s => ({ ...s, mode: 'child' }));
const R1_ADULT_POOL = R1_PHRASE_SETS_ADULTE.map(s => ({ ...s, mode: 'adult' }));

// ── Historique localStorage (évite les répétitions entre parties) ─────────────
const USED_KEYS = {
  r1:      'pyramide_used_r1',        // child (rétrocompat)
  r1adult: 'pyramide_used_r1_adult',  // adult
  r1mix:   'pyramide_used_r1_mix',    // mix
  r2:    'pyramide_used_r2',    // set de mots (chaînes)
  r3:    'pyramide_used_r3',    // set de thèmes
  r4:    'pyramide_used_r4',    // set de thèmes
  final: 'pyramide_used_final', // première expression de chaque set
};

function _storageGet(key) {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch { return new Set(); }
}

function _storageSet(key, set) {
  try {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(key, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

/**
 * Retourne les éléments non encore utilisés de pool.
 * Si tous ont été utilisés, réinitialise l'historique et retourne pool entier.
 */
function _unusedPool(pool, usedKey, getId) {
  const used = _storageGet(usedKey);
  const unused = pool.filter(item => !used.has(getId(item)));
  if (unused.length > 0) return { items: unused, used };
  // Tout a été joué → réinitialisation
  return { items: [...pool], used: new Set() };
}

function _markUsed(usedKey, ids, existingUsed) {
  const used = existingUsed ?? _storageGet(usedKey);
  for (const id of ids) used.add(id);
  _storageSet(usedKey, used);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne n ensembles phrases distincts tirés aléatoirement (non déjà joués).
 * @param {number} n - nombre de sets à retourner
 * @param {'child'|'adult'|'mix'} [mode='child'] - mode de jeu
 */
export function getR1PhraseSets(n, mode = 'child') {
  const pool = mode === 'adult' ? R1_ADULT_POOL
             : mode === 'mix'   ? [...R1_CHILD_POOL, ...R1_ADULT_POOL]
             : R1_CHILD_POOL;
  const usedKey = mode === 'adult' ? USED_KEYS.r1adult
                : mode === 'mix'   ? USED_KEYS.r1mix
                : USED_KEYS.r1;
  const getId = s => s.theme;
  const { items, used } = _unusedPool(pool, usedKey, getId);
  const selected = [...items].sort(() => Math.random() - 0.5).slice(0, Math.min(n, items.length));
  _markUsed(usedKey, selected.map(getId), used);
  return selected;
}

/** Alias historique. */
export function getR1Words() {
  return [...R1_WORDS].sort(() => Math.random() - 0.5);
}

/**
 * Retourne tous les mots R2 mélangés, les mots non encore joués en premier.
 * Les 5 premiers (ceux utilisés par le jeu) sont marqués comme joués.
 */
export function getR2Words() {
  const { items: unused, used } = _unusedPool(R2_WORDS, USED_KEYS.r2, w => w);
  const usedWords = R2_WORDS.filter(w => used.has(w));
  const shuffledUnused = [...unused].sort(() => Math.random() - 0.5);
  const shuffledUsed   = [...usedWords].sort(() => Math.random() - 0.5);
  const ordered = [...shuffledUnused, ...shuffledUsed];
  // Marquer les 5 premiers comme joués (le jeu en utilise toujours 5)
  _markUsed(USED_KEYS.r2, ordered.slice(0, 5).map(w => w), used);
  return ordered;
}

/** Retourne un set R3 non encore joué (reset si tous épuisés). */
export function getR3Set() {
  const { items, used } = _unusedPool(R3_SETS, USED_KEYS.r3, s => s.theme);
  const set = items[Math.floor(Math.random() * items.length)];
  _markUsed(USED_KEYS.r3, [set.theme], used);
  return set;
}

/**
 * Retourne un set R4 non encore joué.
 * @param {string|null} excludeTheme - Thème à exclure (pour éviter doublons équipe A/B)
 */
export function getR4Set(excludeTheme = null) {
  const { items, used } = _unusedPool(R4_SETS, USED_KEYS.r4, s => s.theme);
  const candidates = excludeTheme ? items.filter(s => s.theme !== excludeTheme) : items;
  const pool = candidates.length > 0 ? candidates : items;
  const set = pool[Math.floor(Math.random() * pool.length)];
  _markUsed(USED_KEYS.r4, [set.theme], used);
  return set;
}

/** Retourne un set Final non encore joué (reset si tous épuisés). */
export function getFinalSet() {
  const { items, used } = _unusedPool(FINAL_SETS, USED_KEYS.final, s => s[0]);
  const set = items[Math.floor(Math.random() * items.length)];
  _markUsed(USED_KEYS.final, [set[0]], used);
  return [...set];
}
