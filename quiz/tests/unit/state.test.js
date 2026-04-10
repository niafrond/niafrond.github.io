/**
 * state.test.js — Tests unitaires pour les utilitaires de persistance (state.js)
 * Environnement jsdom pour la disponibilité de localStorage.
 *
 * @jest-environment jsdom
 */

import {
  saveSession, loadSession, clearSession,
  loadLeaderboard, saveToLeaderboard,
  loadAskedQuestions, saveAskedQuestions, prioritizeUnasked,
  STORAGE_KEY, LEADERBOARD_KEY, PARTY_ASKED_KEY,
} from '../../state.js';

beforeEach(() => {
  localStorage.clear();
});

// ─── Session ──────────────────────────────────────────────────────────────────

describe('session (saveSession / loadSession / clearSession)', () => {
  test('renvoie null si aucune session sauvegardée', () => {
    expect(loadSession()).toBeNull();
  });

  test('sauvegarde et recharge une session', () => {
    saveSession('host123', 'Alice');
    const s = loadSession();
    expect(s).toEqual({ hostPeerId: 'host123', playerName: 'Alice' });
  });

  test('efface la session', () => {
    saveSession('host123', 'Alice');
    clearSession();
    expect(loadSession()).toBeNull();
  });

  test('utilise la clé STORAGE_KEY', () => {
    saveSession('h', 'n');
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

// ─── Leaderboard ─────────────────────────────────────────────────────────────

describe('leaderboard (loadLeaderboard / saveToLeaderboard)', () => {
  test('renvoie un tableau vide si aucun classement', () => {
    expect(loadLeaderboard()).toEqual([]);
  });

  test('ajoute des entrées de score', () => {
    saveToLeaderboard([
      { name: 'Alice', score: 80 },
      { name: 'Bob', score: 60 },
    ]);
    const entries = loadLeaderboard();
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('Alice'); // trié par score décroissant
    expect(entries[0].score).toBe(80);
  });

  test('trie par score décroissant', () => {
    saveToLeaderboard([{ name: 'Bob', score: 30 }, { name: 'Alice', score: 90 }]);
    const entries = loadLeaderboard();
    expect(entries[0].score).toBeGreaterThanOrEqual(entries[1].score);
  });

  test('ignore les entrées avec score ≤ 0 ou sans nom', () => {
    saveToLeaderboard([
      { name: 'Alice', score: 0 },
      { name: '', score: 50 },
      { name: 'Bob', score: 10 },
    ]);
    const entries = loadLeaderboard();
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Bob');
  });

  test('conserve au maximum 20 entrées', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ name: `P${i}`, score: i + 1 }));
    saveToLeaderboard(many);
    expect(loadLeaderboard().length).toBeLessThanOrEqual(20);
  });

  test('accumule les entrées entre plusieurs appels', () => {
    saveToLeaderboard([{ name: 'Alice', score: 50 }]);
    saveToLeaderboard([{ name: 'Bob', score: 70 }]);
    expect(loadLeaderboard()).toHaveLength(2);
  });

  test('utilise la clé LEADERBOARD_KEY', () => {
    saveToLeaderboard([{ name: 'Alice', score: 5 }]);
    expect(localStorage.getItem(LEADERBOARD_KEY)).not.toBeNull();
  });
});

// ─── Questions posées (party) ─────────────────────────────────────────────────

describe('askedQuestions (loadAskedQuestions / saveAskedQuestions / prioritizeUnasked)', () => {
  test('renvoie un Set vide au départ', () => {
    expect(loadAskedQuestions().size).toBe(0);
  });

  test('sauvegarde et recharge les IDs posés', () => {
    saveAskedQuestions(['q1', 'q2', 'q3']);
    const s = loadAskedQuestions();
    expect(s.has('q1')).toBe(true);
    expect(s.has('q4')).toBe(false);
  });

  test('accumule les IDs entre les appels', () => {
    saveAskedQuestions(['q1']);
    saveAskedQuestions(['q2']);
    const s = loadAskedQuestions();
    expect(s.has('q1')).toBe(true);
    expect(s.has('q2')).toBe(true);
  });

  test('ne dépasse pas 300 entrées', () => {
    const ids = Array.from({ length: 350 }, (_, i) => `q${i}`);
    saveAskedQuestions(ids);
    const s = loadAskedQuestions();
    expect(s.size).toBeLessThanOrEqual(300);
  });

  test('utilise la clé PARTY_ASKED_KEY', () => {
    saveAskedQuestions(['q1']);
    expect(localStorage.getItem(PARTY_ASKED_KEY)).not.toBeNull();
  });

  describe('prioritizeUnasked', () => {
    const questions = [
      { id: 'q1', text: 'Q1' },
      { id: 'q2', text: 'Q2' },
      { id: 'q3', text: 'Q3' },
    ];

    test('place les questions non posées en premier', () => {
      saveAskedQuestions(['q1', 'q3']);
      const result = prioritizeUnasked(questions);
      expect(result[0].id).toBe('q2');
    });

    test('renvoie toutes les questions', () => {
      const result = prioritizeUnasked(questions);
      expect(result).toHaveLength(3);
    });

    test('fonctionne si toutes les questions ont déjà été posées', () => {
      saveAskedQuestions(['q1', 'q2', 'q3']);
      const result = prioritizeUnasked(questions);
      expect(result).toHaveLength(3);
    });

    test('gère les questions sans id', () => {
      const mixed = [{ text: 'no-id' }, { id: 'q1', text: 'with-id' }];
      saveAskedQuestions(['q1']);
      const result = prioritizeUnasked(mixed);
      // la question sans id n'a pas été posée — mais elle a pas d'id donc traitée comme "asked"
      expect(result).toHaveLength(2);
    });
  });
});
