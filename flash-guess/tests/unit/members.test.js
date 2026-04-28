/**
 * members.test.js — Tests unitaires pour members.js (Flash Guess)
 * Teste la persistance des membres et groupes via localStorage.
 *
 * @jest-environment jsdom
 */

import { state, GROUPS_KEY } from '../../state.js';
import {
  loadMembers, saveMembers, autoSaveMember,
  saveMembersAfterGame,
  loadGroups, saveGroups,
} from '../../members.js';

// Sauvegarder et restaurer l'état global entre les tests
const originalPlayerNames   = [...state.playerNames];
const originalPlayerIsChild = new Set(state.playerIsChild);
const originalTeams         = [...state.teams];

beforeEach(() => {
  localStorage.clear();
  state.playerNames = [];
  state.playerIsChild = new Set();
  state.teams = [];
});

afterEach(() => {
  state.playerNames   = originalPlayerNames;
  state.playerIsChild = originalPlayerIsChild;
  state.teams         = originalTeams;
});

// ─── loadMembers / saveMembers ────────────────────────────────────────────────

describe('loadMembers / saveMembers', () => {
  test('renvoie un tableau vide si localStorage est vide', () => {
    expect(loadMembers()).toEqual([]);
  });

  test('sauvegarde et recharge une liste de membres', () => {
    const members = [
      { name: 'Alice', games: 3, bestPts: 15 },
      { name: 'Bob', games: 1, bestPts: 5 },
    ];
    saveMembers(members);
    expect(loadMembers()).toEqual(members);
  });

  test('renvoie un tableau vide si les données sont invalides', () => {
    localStorage.setItem('flashguess-members', 'not-json');
    expect(loadMembers()).toEqual([]);
  });
});

// ─── autoSaveMember ───────────────────────────────────────────────────────────

describe('autoSaveMember', () => {
  test('ajoute un nouveau membre', () => {
    autoSaveMember('Alice');
    const members = loadMembers();
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ name: 'Alice', games: 0, bestPts: 0 });
  });

  test('n\'ajoute pas de doublon', () => {
    autoSaveMember('Alice');
    autoSaveMember('Alice');
    expect(loadMembers()).toHaveLength(1);
  });

  test('enregistre le flag isChild si demandé', () => {
    autoSaveMember('Petit', true);
    const members = loadMembers();
    expect(members[0].isChild).toBe(true);
  });

  test('met à jour isChild sur un membre existant', () => {
    autoSaveMember('Alice');
    expect(loadMembers()[0].isChild).toBeUndefined();
    autoSaveMember('Alice', true);
    expect(loadMembers()[0].isChild).toBe(true);
  });

  test('ne supprime pas isChild si appelé sans flag enfant', () => {
    autoSaveMember('Alice', true);
    autoSaveMember('Alice', false);
    // isChild reste true car on ne retire pas le flag une fois défini
    expect(loadMembers()[0].isChild).toBe(true);
  });
});

// ─── saveMembersAfterGame ─────────────────────────────────────────────────────

describe('saveMembersAfterGame', () => {
  test('crée des membres pour chaque joueur de chaque équipe', () => {
    state.teams = [
      { players: ['Alice', 'Bob'], score: [3, 2, 1] },
    ];
    saveMembersAfterGame();
    const members = loadMembers();
    expect(members).toHaveLength(2);
    expect(members.find(m => m.name === 'Alice')).toMatchObject({ games: 1, bestPts: 6 });
    expect(members.find(m => m.name === 'Bob')).toMatchObject({ games: 1, bestPts: 6 });
  });

  test('met à jour le meilleur score (pas la somme) pour un membre existant', () => {
    saveMembers([{ name: 'Alice', games: 2, bestPts: 10 }]);
    state.teams = [
      { players: ['Alice'], score: [1, 2, 3] },
    ];
    saveMembersAfterGame();
    const alice = loadMembers().find(m => m.name === 'Alice');
    expect(alice.games).toBe(3);
    expect(alice.bestPts).toBe(10); // max(10, 6) = 10
  });

  test('met à jour le meilleur score si la nouvelle partie est meilleure', () => {
    saveMembers([{ name: 'Alice', games: 2, bestPts: 4 }]);
    state.teams = [
      { players: ['Alice'], score: [1, 2, 3] },
    ];
    saveMembersAfterGame();
    const alice = loadMembers().find(m => m.name === 'Alice');
    expect(alice.games).toBe(3);
    expect(alice.bestPts).toBe(6); // max(4, 6) = 6
  });

  test('migre l\'ancien champ totalPts vers bestPts', () => {
    saveMembers([{ name: 'Alice', games: 2, totalPts: 8 }]);
    state.teams = [
      { players: ['Alice'], score: [1, 2, 3] },
    ];
    saveMembersAfterGame();
    const alice = loadMembers().find(m => m.name === 'Alice');
    expect(alice.bestPts).toBe(8); // max(totalPts=8, 6) = 8
    expect(alice.totalPts).toBeUndefined();
  });


  test('enregistre isChild si le joueur est marqué enfant', () => {
    state.playerIsChild = new Set(['Alice']);
    state.teams = [
      { players: ['Alice'], score: [1, 0, 0] },
    ];
    saveMembersAfterGame();
    const alice = loadMembers().find(m => m.name === 'Alice');
    expect(alice.isChild).toBe(true);
  });

  test('gère plusieurs équipes', () => {
    state.teams = [
      { players: ['Alice'], score: [5, 0, 0] },
      { players: ['Bob'], score: [3, 0, 0] },
    ];
    saveMembersAfterGame();
    const members = loadMembers();
    expect(members.find(m => m.name === 'Alice').bestPts).toBe(5);
    expect(members.find(m => m.name === 'Bob').bestPts).toBe(3);
  });
});

// ─── loadGroups / saveGroups ──────────────────────────────────────────────────

describe('loadGroups / saveGroups', () => {
  test('renvoie un tableau vide si localStorage est vide', () => {
    expect(loadGroups()).toEqual([]);
  });

  test('sauvegarde et recharge des groupes', () => {
    const groups = [
      { id: 'g1', name: 'Famille', members: ['Alice', 'Bob'] },
      { id: 'g2', name: 'Amis', members: ['Charlie'] },
    ];
    saveGroups(groups);
    expect(loadGroups()).toEqual(groups);
  });

  test('renvoie un tableau vide si les données sont invalides', () => {
    localStorage.setItem(GROUPS_KEY, 'broken');
    expect(loadGroups()).toEqual([]);
  });

  test('utilise la clé GROUPS_KEY', () => {
    saveGroups([{ id: 'x', name: 'Test', members: [] }]);
    expect(localStorage.getItem(GROUPS_KEY)).not.toBeNull();
  });
});
