/**
 * fuzzy.test.js — Tests unitaires pour blind-test/fuzzy.js
 */

import {
  normalize,
  fuzzyMatch,
  validateAnswer,
  validateArtist,
  validateTitle,
  validateBothAnswer,
} from '../../fuzzy.js';

// ─── normalize ───────────────────────────────────────────────────────────────

describe('normalize', () => {
  test('retourne une chaîne vide pour une entrée falsy', () => {
    expect(normalize('')).toBe('');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });

  test('met en minuscule et retire les accents', () => {
    expect(normalize('Éléphant')).toBe('elephant');
    expect(normalize('CAFÉ')).toBe('cafe');
    expect(normalize('naïve')).toBe('naive');
  });

  test('supprime les articles courants', () => {
    expect(normalize('le chat')).toBe('chat');
    expect(normalize('la maison')).toBe('maison');
    expect(normalize('les chiens')).toBe('chiens');
    expect(normalize('the one')).toBe('one');
    expect(normalize('l\'homme')).toBe('homme');
  });

  test('supprime la ponctuation', () => {
    expect(normalize('rock & roll')).toBe('rock roll');
    expect(normalize('hello, world!')).toBe('hello world');
  });

  test('normalise les espaces multiples', () => {
    expect(normalize('  foo   bar  ')).toBe('foo bar');
  });
});

// ─── fuzzyMatch ───────────────────────────────────────────────────────────────

describe('fuzzyMatch', () => {
  test('correspondance exacte', () => {
    expect(fuzzyMatch('bonjour', 'bonjour')).toBe(true);
  });

  test('insensible à la casse', () => {
    expect(fuzzyMatch('BONJOUR', 'bonjour')).toBe(true);
  });

  test('tolère une faute sur un mot long', () => {
    expect(fuzzyMatch('elephantt', 'elephant')).toBe(true);
  });

  test('rejette une faute sur un mot très court (≤3 chars)', () => {
    expect(fuzzyMatch('bi', 'bo')).toBe(false);
  });

  test('ignore les articles', () => {
    expect(fuzzyMatch('le chat', 'chat')).toBe(true);
  });

  test('retourne false si l\'une des chaînes est vide', () => {
    expect(fuzzyMatch('', 'test')).toBe(false);
    expect(fuzzyMatch('test', '')).toBe(false);
  });

  test('correspondance avec accents', () => {
    expect(fuzzyMatch('cafe', 'café')).toBe(true);
    expect(fuzzyMatch('naif', 'naïf')).toBe(true);
  });
});

// ─── validateArtist / validateTitle ──────────────────────────────────────────

describe('validateArtist', () => {
  const song = { title: 'Shape of You', artist: 'Ed Sheeran' };

  test('accepte le bon artiste', () => {
    expect(validateArtist('Ed Sheeran', song)).toBe(true);
  });

  test('tolère les fautes d\'orthographe légères', () => {
    expect(validateArtist('Ed Shearan', song)).toBe(true);
  });

  test('rejette un artiste incorrect', () => {
    expect(validateArtist('Taylor Swift', song)).toBe(false);
  });
});

describe('validateTitle', () => {
  const song = { title: 'Bohemian Rhapsody', artist: 'Queen' };

  test('accepte le bon titre', () => {
    expect(validateTitle('Bohemian Rhapsody', song)).toBe(true);
  });

  test('tolère les fautes d\'orthographe', () => {
    expect(validateTitle('Bohemian Rapsody', song)).toBe(true);
  });

  test('rejette un titre incorrect', () => {
    expect(validateTitle('Yesterday', song)).toBe(false);
  });
});

// ─── validateAnswer (artiste OU titre) ──────────────────────────────────────

describe('validateAnswer', () => {
  const song = { title: 'Thriller', artist: 'Michael Jackson' };

  test('accepte si le titre correspond', () => {
    expect(validateAnswer('Thriller', song)).toBe(true);
  });

  test('accepte si l\'artiste correspond', () => {
    expect(validateAnswer('Michael Jackson', song)).toBe(true);
  });

  test('rejette si rien ne correspond', () => {
    expect(validateAnswer('Something else', song)).toBe(false);
  });
});

// ─── validateBothAnswer (artiste ET titre) ───────────────────────────────────

describe('validateBothAnswer', () => {
  const song = { title: 'Hotel California', artist: 'Eagles' };

  test('accepte "artiste — titre"', () => {
    expect(validateBothAnswer('Eagles — Hotel California', song)).toBe(true);
  });

  test('accepte "titre — artiste"', () => {
    expect(validateBothAnswer('Hotel California — Eagles', song)).toBe(true);
  });

  test('accepte les deux sur la même ligne sans séparateur explicite si les deux matchent', () => {
    expect(validateBothAnswer('Hotel California Eagles', song)).toBe(true);
  });

  test('rejette si seulement le titre est donné', () => {
    expect(validateBothAnswer('Hotel California', song)).toBe(false);
  });

  test('rejette si seulement l\'artiste est donné', () => {
    expect(validateBothAnswer('Eagles', song)).toBe(false);
  });

  test('retourne false si l\'entrée est vide', () => {
    expect(validateBothAnswer('', song)).toBe(false);
  });

  test('retourne false si song est incomplet', () => {
    expect(validateBothAnswer('Eagles Hotel California', { title: '', artist: 'Eagles' })).toBe(false);
  });
});
