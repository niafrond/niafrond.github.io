// ============================================================
// pyramide/words.js — Logique de sélection des mots
// Les données brutes sont dans data.js
// ============================================================
import {
  R1_PHRASE_SETS,
  R2_WORDS,
  R3_SETS,
  R4_SETS,
  FINAL_SETS,
} from './data.js';

// Re-export des constantes pour rétrocompatibilité
export { R1_PHRASE_SETS, R2_WORDS, R3_SETS, R4_SETS, FINAL_SETS };

// Alias plat (rétrocompatibilité)
export const R1_WORDS = R1_PHRASE_SETS.flatMap(s => s.words);

/** Retourne n ensembles phrases distincts tirés aléatoirement. */
export function getR1PhraseSets(n) {
  const pool = [...R1_PHRASE_SETS].sort(() => Math.random() - 0.5);
  return pool.slice(0, Math.min(n, pool.length));
}

/** Alias historique. */
export function getR1Words() {
  return [...R1_WORDS].sort(() => Math.random() - 0.5);
}
export function getR2Words() {
  return [...R2_WORDS].sort(() => Math.random() - 0.5);
}
export function getR3Set() {
  return R3_SETS[Math.floor(Math.random() * R3_SETS.length)];
}
export function getR4Set() {
  return R4_SETS[Math.floor(Math.random() * R4_SETS.length)];
}
export function getFinalSet() {
  return [...FINAL_SETS[Math.floor(Math.random() * FINAL_SETS.length)]];
}
