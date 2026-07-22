/**
 * relayModeManager.test.js — Tests unitaires pour createRelayModeManager
 *
 * Couvre en particulier le piège des hash de dédoublonnage (cf. SPECS.md §9.4.7/§9.6.2
 * et mémoire de session « Piège rencontré en l'implémentant ») : un changement de
 * `relayIncoming.next[].ready` ou de `filRougeNext.id` doit republier l'état côté relais
 * même quand rien d'autre (piste, queue, position) n'a changé.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { createRelayModeManager } from '../../lib/relayModeManager.js';

function baseState(overrides = {}) {
  return {
    currentTrackId: 't1',
    currentIndex: 0,
    isPlaying: true,
    activeDeck: 'A',
    transitionMode: 'auto',
    crossfadeMs: 6000,
    djMode: 'music',
    fx: { echo: false, distortion: false },
    queue: [{ id: 't1' }, { id: 't2' }],
    upcoming: [],
    relayIncoming: { nowPending: false, nextCount: 1, nextMax: 10, now: null, next: [{ ready: false }] },
    filRougeNext: { id: 'fr-1' },
    pushedAt: Date.now(),
    ...overrides,
  };
}

function mockFetchOnce(state) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => state,
  });
}

// startAsRelay() déclenche un premier sondage immédiat (_poll(), non attendu par
// l'appelant) qui enchaîne plusieurs await internes (fetch → res.json() → retour de
// _fetch()) — on vide la file de microtâches plusieurs fois pour le laisser se résoudre.
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

describe('relayModeManager — dédoublonnage relais (SPEC-9.6.2)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('un changement de relayIncoming.next[].ready (seul) republie l\'état côté relais', async () => {
    jest.useFakeTimers();
    const onApplyRelayState = jest.fn();
    const manager = createRelayModeManager({
      getDownloaderRelayUrl: () => 'http://relay.test',
      getDownloaderApiToken: () => '',
      onApplyRelayState,
    });

    mockFetchOnce(baseState());
    manager.startAsRelay('M1');
    await flush();
    expect(onApplyRelayState).toHaveBeenCalledTimes(1);

    // Seul le flag "ready" du slot "next" change — tout le reste est identique.
    mockFetchOnce(baseState({
      relayIncoming: { nowPending: false, nextCount: 1, nextMax: 10, now: null, next: [{ ready: true }] },
    }));
    await jest.advanceTimersByTimeAsync(1500);

    expect(onApplyRelayState).toHaveBeenCalledTimes(2);
  });

  test('un changement de filRougeNext.id (seul) republie l\'état côté relais', async () => {
    jest.useFakeTimers();
    const onApplyRelayState = jest.fn();
    const manager = createRelayModeManager({
      getDownloaderRelayUrl: () => 'http://relay.test',
      getDownloaderApiToken: () => '',
      onApplyRelayState,
    });

    mockFetchOnce(baseState());
    manager.startAsRelay('M1');
    await flush();
    expect(onApplyRelayState).toHaveBeenCalledTimes(1);

    mockFetchOnce(baseState({ filRougeNext: { id: 'fr-2' } }));
    await jest.advanceTimersByTimeAsync(1500);

    expect(onApplyRelayState).toHaveBeenCalledTimes(2);
  });

  test('un état strictement identique (y compris relayIncoming/filRougeNext) n\'est pas republié', async () => {
    jest.useFakeTimers();
    const onApplyRelayState = jest.fn();
    const manager = createRelayModeManager({
      getDownloaderRelayUrl: () => 'http://relay.test',
      getDownloaderApiToken: () => '',
      onApplyRelayState,
    });

    mockFetchOnce(baseState());
    manager.startAsRelay('M1');
    await flush();
    expect(onApplyRelayState).toHaveBeenCalledTimes(1);

    mockFetchOnce(baseState()); // même contenu (pushedAt diffère, non inclus dans le hash)
    await jest.advanceTimersByTimeAsync(1500);

    expect(onApplyRelayState).toHaveBeenCalledTimes(1);
  });
});

describe('relayModeManager — publication côté maître (schedulePush)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test('schedulePush est un no-op tant que le rôle n\'est pas "master"', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const manager = createRelayModeManager({
      getDownloaderRelayUrl: () => 'http://relay.test',
      getDownloaderApiToken: () => '',
    });

    manager.schedulePush(baseState());
    await jest.advanceTimersByTimeAsync(2000);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('schedulePush republie un PUT quand relayIncoming.next[].ready change seul', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const manager = createRelayModeManager({
      getDownloaderRelayUrl: () => 'http://relay.test',
      getDownloaderApiToken: () => '',
    });
    manager.startAsMaster('M1');

    manager.schedulePush(baseState());
    await jest.advanceTimersByTimeAsync(1000);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://relay.test/api/relay/state/M1',
      expect.objectContaining({ method: 'PUT' })
    );

    manager.schedulePush(baseState({
      relayIncoming: { nowPending: false, nextCount: 1, nextMax: 10, now: null, next: [{ ready: true }] },
    }));
    await jest.advanceTimersByTimeAsync(1000);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
