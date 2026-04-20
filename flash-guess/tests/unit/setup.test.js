/**
 * setup.test.js — Tests unitaires pour setup.js (Flash Guess)
 * Teste la persistance localStorage : cardCount, selectedCategories, kidsMode.
 *
 * @jest-environment jsdom
 */

import {
  loadCardCount, saveCardCount,
  loadSelectedCategories, saveSelectedCategories,
  loadKidsMode, saveKidsMode,
} from '../../setup.js';
import { CARD_COUNT_DEFAULT } from '../../state.js';
import { CATEGORY_LABELS } from '../../words.js';

beforeEach(() => {
  localStorage.clear();
});

// ─── cardCount ────────────────────────────────────────────────────────────────

describe('loadCardCount / saveCardCount', () => {
  test('renvoie CARD_COUNT_DEFAULT si localStorage est vide', () => {
    expect(loadCardCount()).toBe(CARD_COUNT_DEFAULT);
  });

  test('sauvegarde et recharge une valeur autorisée (30)', () => {
    saveCardCount(30);
    expect(loadCardCount()).toBe(30);
  });

  test('sauvegarde et recharge 0 (toutes les cartes)', () => {
    saveCardCount(0);
    expect(loadCardCount()).toBe(0);
  });

  test('renvoie la valeur par défaut pour une valeur non autorisée', () => {
    localStorage.setItem('flashguess_card_count', '99');
    expect(loadCardCount()).toBe(CARD_COUNT_DEFAULT);
  });

  test('renvoie la valeur par défaut pour une donnée invalide', () => {
    localStorage.setItem('flashguess_card_count', 'not-a-number');
    expect(loadCardCount()).toBe(CARD_COUNT_DEFAULT);
  });

  test('accepte les valeurs 10, 20, 30, 40, 50', () => {
    [10, 20, 30, 40, 50].forEach(n => {
      saveCardCount(n);
      expect(loadCardCount()).toBe(n);
    });
  });
});

// ─── selectedCategories ───────────────────────────────────────────────────────

describe('loadSelectedCategories / saveSelectedCategories', () => {
  test('renvoie toutes les catégories si localStorage est vide', () => {
    const cats = loadSelectedCategories();
    expect(cats).toEqual(Object.keys(CATEGORY_LABELS));
  });

  test('sauvegarde et recharge un sous-ensemble', () => {
    const subset = ['history', 'sport'];
    saveSelectedCategories(subset);
    expect(loadSelectedCategories()).toEqual(subset);
  });

  test('filtre les catégories inconnues', () => {
    saveSelectedCategories(['history', 'totally_fake', 'sport']);
    const loaded = loadSelectedCategories();
    expect(loaded).toEqual(['history', 'sport']);
  });

  test('renvoie le défaut si toutes les catégories sont invalides', () => {
    saveSelectedCategories(['fake1', 'fake2']);
    expect(loadSelectedCategories()).toEqual(Object.keys(CATEGORY_LABELS));
  });

  test('renvoie le défaut si le JSON est corrompu', () => {
    localStorage.setItem('flashguess_selected_cats', 'not-json');
    expect(loadSelectedCategories()).toEqual(Object.keys(CATEGORY_LABELS));
  });

  test('renvoie le défaut si le tableau est vide', () => {
    saveSelectedCategories([]);
    expect(loadSelectedCategories()).toEqual(Object.keys(CATEGORY_LABELS));
  });
});

// ─── kidsMode ─────────────────────────────────────────────────────────────────

describe('loadKidsMode / saveKidsMode', () => {
  test('renvoie false si localStorage est vide', () => {
    expect(loadKidsMode()).toBe(false);
  });

  test('sauvegarde et recharge true', () => {
    saveKidsMode(true);
    expect(loadKidsMode()).toBe(true);
  });

  test('sauvegarde et recharge false', () => {
    saveKidsMode(false);
    expect(loadKidsMode()).toBe(false);
  });

  test('renvoie false si la donnée est invalide', () => {
    localStorage.setItem('flashguess_kids_mode', 'anything');
    expect(loadKidsMode()).toBe(false);
  });
});
