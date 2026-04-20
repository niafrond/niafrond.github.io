/**
 * words.test.js — Tests unitaires pour words.js (Flash Guess)
 *
 * @jest-environment jsdom
 */

import {
  shuffle,
  loadWords,
  saveWords,
  resetWords,
  getShuffledWords,
  getCategoryInfo,
  CATEGORY_LABELS,
  DEFAULT_WORDS,
} from '../../words.js';

beforeEach(() => {
  localStorage.clear();
});

// ─── shuffle ──────────────────────────────────────────────────────────────────

describe('shuffle', () => {
  test('renvoie un tableau de même longueur', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toHaveLength(arr.length);
  });

  test('contient les mêmes éléments que l\'original', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual(arr.sort());
  });

  test('ne modifie pas le tableau original', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });

  test('fonctionne avec un tableau vide', () => {
    expect(shuffle([])).toEqual([]);
  });

  test('fonctionne avec un seul élément', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});

// ─── loadWords / saveWords / resetWords ───────────────────────────────────────

describe('loadWords / saveWords / resetWords', () => {
  test('renvoie les mots par défaut si localStorage est vide', () => {
    const words = loadWords();
    expect(words.length).toBe(DEFAULT_WORDS.length);
    expect(words[0]).toMatchObject({ word: expect.any(String), category: expect.any(String) });
  });

  test('renvoie les mots par défaut si les données sont invalides', () => {
    localStorage.setItem('flashguess_custom_words', 'not-json');
    expect(loadWords().length).toBe(DEFAULT_WORDS.length);
  });

  test('renvoie les mots par défaut si le tableau est vide', () => {
    localStorage.setItem('flashguess_custom_words', '[]');
    expect(loadWords().length).toBe(DEFAULT_WORDS.length);
  });

  test('renvoie les mots par défaut si aucune entrée valide', () => {
    localStorage.setItem('flashguess_custom_words', JSON.stringify([{ word: '', category: '' }]));
    expect(loadWords().length).toBe(DEFAULT_WORDS.length);
  });

  test('sauvegarde et recharge des mots personnalisés', () => {
    const custom = [
      { word: 'Test', category: 'general_knowledge' },
      { word: 'Bonjour', category: 'kids', kidFriendly: true },
    ];
    saveWords(custom);
    const loaded = loadWords();
    expect(loaded).toHaveLength(2);
    expect(loaded[0]).toMatchObject({ word: 'Test', category: 'general_knowledge' });
    expect(loaded[1]).toMatchObject({ word: 'Bonjour', category: 'kids', kidFriendly: true });
  });

  test('trim les espaces sur word et category', () => {
    saveWords([{ word: '  Espace  ', category: '  history  ' }]);
    const loaded = loadWords();
    expect(loaded[0].word).toBe('Espace');
    expect(loaded[0].category).toBe('history');
  });

  test('resetWords supprime les données et retourne aux mots par défaut', () => {
    saveWords([{ word: 'Custom', category: 'history' }]);
    resetWords();
    const loaded = loadWords();
    expect(loaded.length).toBe(DEFAULT_WORDS.length);
  });
});

// ─── getShuffledWords ─────────────────────────────────────────────────────────

describe('getShuffledWords', () => {
  test('renvoie les mots sans kidFriendly si kidsMode désactivé', () => {
    const words = getShuffledWords();
    const expected = DEFAULT_WORDS.filter(w => !w.kidFriendly);
    expect(words.length).toBe(expected.length);
  });

  test('filtre par catégorie', () => {
    const words = getShuffledWords(['history']);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every(w => w.category === 'history')).toBe(true);
  });

  test('inclut les mots enfants en mode enfant', () => {
    const words = getShuffledWords(null, true);
    expect(words.length).toBe(DEFAULT_WORDS.length);
    expect(words.some(w => w.kidFriendly === true)).toBe(true);
  });

  test('filtre par catégorie en mode enfant', () => {
    const words = getShuffledWords(['sport'], true);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every(w => w.category === 'sport')).toBe(true);
    expect(words.some(w => w.kidFriendly === true)).toBe(true);
  });

  test('renvoie un tableau vide si aucune correspondance', () => {
    const words = getShuffledWords(['inexistant']);
    expect(words).toHaveLength(0);
  });
});

// ─── getCategoryInfo ──────────────────────────────────────────────────────────

describe('getCategoryInfo', () => {
  test('renvoie le label et emoji pour une catégorie connue', () => {
    const info = getCategoryInfo('history');
    expect(info).toEqual(CATEGORY_LABELS['history']);
    expect(info.label).toBe('Histoire');
    expect(info.emoji).toBe('🏛️');
  });

  test('renvoie un fallback pour une catégorie inconnue', () => {
    const info = getCategoryInfo('unknown_category');
    expect(info).toEqual({ label: 'unknown_category', emoji: '❓' });
  });
});

// ─── DEFAULT_WORDS intégrité ──────────────────────────────────────────────────

describe('DEFAULT_WORDS', () => {
  test('contient au moins 100 mots', () => {
    expect(DEFAULT_WORDS.length).toBeGreaterThanOrEqual(100);
  });

  test('chaque mot a word et category valides', () => {
    DEFAULT_WORDS.forEach(w => {
      expect(typeof w.word).toBe('string');
      expect(w.word.trim().length).toBeGreaterThan(0);
      expect(typeof w.category).toBe('string');
      expect(w.category.trim().length).toBeGreaterThan(0);
    });
  });

  test('toutes les catégories sont dans CATEGORY_LABELS', () => {
    const validKeys = Object.keys(CATEGORY_LABELS);
    DEFAULT_WORDS.forEach(w => {
      expect(validKeys).toContain(w.category);
    });
  });

  test('les mots kidFriendly existent', () => {
    const kids = DEFAULT_WORDS.filter(w => w.kidFriendly === true);
    expect(kids.length).toBeGreaterThan(0);
  });
});
