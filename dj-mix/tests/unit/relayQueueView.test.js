import { describe, test, expect } from '@jest/globals';
import { getUnreadQueue } from '../../lib/relayQueueView.js';

describe('relayQueueView', () => {
  test('SPEC-9.3.8 — file vide retourne un tableau vide', () => {
    expect(getUnreadQueue({ queue: [], currentTrackId: 'a', currentIndex: 0 })).toEqual([]);
  });

  test('SPEC-9.3.8 — retourne les titres après currentIndex, mappés en forme d\'affichage', () => {
    const queue = [
      { id: 'a', name: 'A', artist: 'Art A', artUrl: 'a.jpg', extra: 'ignored' },
      { id: 'b', name: 'B', artist: 'Art B', artUrl: 'b.jpg' },
      { id: 'c', name: 'C', artist: 'Art C', artUrl: 'c.jpg' },
    ];
    expect(getUnreadQueue({ queue, currentTrackId: 'a', currentIndex: 0 })).toEqual([
      { id: 'b', name: 'B', artist: 'Art B', artUrl: 'b.jpg' },
      { id: 'c', name: 'C', artist: 'Art C', artUrl: 'c.jpg' },
    ]);
  });

  test('SPEC-9.3.8 — morceau courant en fin de file : résultat vide', () => {
    const queue = [{ id: 'a' }, { id: 'b' }];
    expect(getUnreadQueue({ queue, currentTrackId: 'b', currentIndex: 1 })).toEqual([]);
  });

  test('SPEC-9.3.8 — currentIndex absent/invalide : repli par recherche d\'id', () => {
    const queue = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    expect(getUnreadQueue({ queue, currentTrackId: 'b' })).toEqual([
      { id: 'c', name: 'C', artist: '', artUrl: '' },
    ]);
    expect(getUnreadQueue({ queue, currentTrackId: 'b', currentIndex: -1 })).toEqual([
      { id: 'c', name: 'C', artist: '', artUrl: '' },
    ]);
    expect(getUnreadQueue({ queue, currentTrackId: 'b', currentIndex: 99 })).toEqual([
      { id: 'c', name: 'C', artist: '', artUrl: '' },
    ]);
  });

  test('morceau courant introuvable (ni index ni id) : résultat vide', () => {
    const queue = [{ id: 'a' }, { id: 'b' }];
    expect(getUnreadQueue({ queue, currentTrackId: 'unknown' })).toEqual([]);
    expect(getUnreadQueue({ queue })).toEqual([]);
  });

  test('préserve l\'ordre de la file', () => {
    const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const result = getUnreadQueue({ queue, currentIndex: 0 });
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'd']);
  });
});
