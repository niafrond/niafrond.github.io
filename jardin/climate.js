// Climat par département : rusticité, régions, conversion de codes (pur).
import { departements } from './data/climate.js';

const byCode = new Map(departements.map((d) => [d.code, d]));

/** Normalise un code département (« 7 » → « 07 », « 2a » → « 2A »). */
function normCode(code) {
  if (code === null || code === undefined) return null;
  let c = String(code).trim().toUpperCase();
  if (/^\d$/.test(c)) c = `0${c}`;
  return c;
}

/** Données climatiques d'un département, ou null. */
export function climateForDepartement(code) {
  const c = normCode(code);
  return (c && byCode.get(c)) || null;
}

/** Liste triée (fr) des régions métropolitaines. */
export function regions() {
  return [...new Set(departements.map((d) => d.region))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Corrige le minimum extrême pour l'altitude : −0,6 °C par 100 m (altitude inconnue/≤ 0 : inchangé). */
export function adjustTminForAltitude(tminC, altitudeM) {
  if (typeof altitudeM !== 'number' || !isFinite(altitudeM) || altitudeM <= 0) return tminC;
  return Math.round((tminC - 0.6 * (altitudeM / 100)) * 10) / 10;
}

/** Zone de rusticité USDA (ex. « 8b ») pour un minimum extrême en °C. */
export function hardinessZone(tminC) {
  const idx = Math.floor((tminC + 51.1) / 2.78);
  if (idx < 0) return '1a';
  return `${Math.floor(idx / 2) + 1}${idx % 2 ? 'b' : 'a'}`;
}

/** Code département depuis un code INSEE de commune (5 caractères) ; null si invalide ou hors métropole. */
export function departementFromCommuneCode(insee) {
  if (insee === null || insee === undefined) return null;
  const s = String(insee).trim().toUpperCase();
  if (!/^(\d{5}|2[AB]\d{3})$/.test(s)) return null;
  const code = s.slice(0, 2); // « 20 » (ancien code corse) → absent de la table → null
  return byCode.has(code) ? code : null;
}
