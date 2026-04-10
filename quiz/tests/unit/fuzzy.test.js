/**
 * fuzzy.test.js — Tests unitaires pour les fonctions de validation floue
 */

import { normalize, fuzzyMatch, validateAnswer, proximityScore } from '../../fuzzy.js';

// ─── normalize ────────────────────────────────────────────────────────────────

describe('normalize', () => {
  test('convertit en minuscules', () => {
    expect(normalize('PARIS')).toBe('paris');
  });

  test('supprime les accents', () => {
    expect(normalize('Château')).toBe('chateau');
    expect(normalize('éléphant')).toBe('elephant');
  });

  test('supprime les articles courants', () => {
    expect(normalize('le chat')).toBe('chat');
    expect(normalize('la maison')).toBe('maison');
    expect(normalize('les chiens')).toBe('chiens');
    expect(normalize('l\'arbre')).toBe('arbre');
    expect(normalize('the Beatles')).toBe('beatles');
    expect(normalize('a dog')).toBe('dog');
  });

  test('supprime la ponctuation', () => {
    expect(normalize('Paris!')).toBe('paris');
    expect(normalize('rock & roll')).toBe('rock roll'); // & supprimé puis espaces collapsés
  });

  test('gère les chaînes vides et null', () => {
    expect(normalize('')).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });

  test('trim les espaces', () => {
    expect(normalize('  paris  ')).toBe('paris');
  });
});

// ─── fuzzyMatch ───────────────────────────────────────────────────────────────

describe('fuzzyMatch', () => {
  test('correspondance exacte', () => {
    expect(fuzzyMatch('Paris', 'Paris')).toBe(true);
  });

  test('insensible à la casse', () => {
    expect(fuzzyMatch('paris', 'Paris')).toBe(true);
    expect(fuzzyMatch('PARIS', 'paris')).toBe(true);
  });

  test('insensible aux accents', () => {
    expect(fuzzyMatch('chateau', 'Château')).toBe(true);
    expect(fuzzyMatch('Château', 'Chateau')).toBe(true);
  });

  test('tolère 1 faute sur un mot court (6 lettres)', () => {
    expect(fuzzyMatch('Berlim', 'Berlin')).toBe(true); // 1 erreur sur 6 → threshold 2
  });

  test('tolère 1 faute sur un mot de 8 lettres', () => {
    expect(fuzzyMatch('Napolion', 'Napoleon')).toBe(true);
  });

  test('ne tolère pas 2 fautes sur un mot court (≤5 lettres)', () => {
    expect(fuzzyMatch('prais', 'Paris')).toBe(false); // 2 erreurs, threshold = 1
  });

  test('rejette une réponse totalement fausse', () => {
    expect(fuzzyMatch('Londres', 'Paris')).toBe(false);
  });

  test('gère les chaînes vides', () => {
    expect(fuzzyMatch('', 'Paris')).toBe(false);
    expect(fuzzyMatch('Paris', '')).toBe(false);
  });

  test('ignore les articles dans la comparaison', () => {
    expect(fuzzyMatch('le chat', 'chat')).toBe(true);
    expect(fuzzyMatch('chat', 'le chat')).toBe(true);
  });
});

// ─── validateAnswer ───────────────────────────────────────────────────────────

describe('validateAnswer', () => {
  test('valide une réponse correcte exacte', () => {
    expect(validateAnswer('Paris', 'Paris')).toBe(true);
  });

  test('valide une réponse avec une faute tolérée', () => {
    expect(validateAnswer('Berln', 'Berlin')).toBe(true);
  });

  test('invalide une mauvaise réponse', () => {
    expect(validateAnswer('Rome', 'Paris')).toBe(false);
  });
});

// ─── proximityScore ───────────────────────────────────────────────────────────

describe('proximityScore', () => {
  test('renvoie 0 pour une correspondance exacte', () => {
    expect(proximityScore('Paris', 'Paris')).toBe(0);
  });

  test('renvoie 0 pour une correspondance sans accents', () => {
    expect(proximityScore('chateau', 'Château')).toBe(0);
  });

  test('renvoie 1 pour une faute de frappe', () => {
    expect(proximityScore('Berlim', 'Berlin')).toBe(1);
  });

  test('renvoie une grande valeur pour des chaînes très différentes', () => {
    expect(proximityScore('abcdef', 'xyz')).toBeGreaterThan(2);
  });

  test('renvoie Infinity pour une chaîne vide', () => {
    expect(proximityScore('', 'Paris')).toBe(Infinity);
    expect(proximityScore('Paris', '')).toBe(Infinity);
  });
});
