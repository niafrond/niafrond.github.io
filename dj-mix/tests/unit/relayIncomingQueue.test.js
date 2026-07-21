import { jest, describe, test, expect } from '@jest/globals';
import { createRelayIncomingQueue } from '../../lib/relayIncomingQueue.js';

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('relayIncomingQueue', () => {
  test('SPEC-9.4.1 — un slot "now" occupé rejette une nouvelle commande "Lire maintenant"', () => {
    const prefetchTrackToLocalCache = jest.fn(() => new Promise(() => {}));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'A' } });
    expect(rq.getStatus().nowPending).toBe(true);

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'B' } });
    expect(prefetchTrackToLocalCache).toHaveBeenCalledTimes(1);
  });

  test('SPEC-9.4.2 — la file "next" rejette une 11e demande au-delà de nextMax slots', () => {
    const prefetchTrackToLocalCache = jest.fn(() => new Promise(() => {}));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    for (let i = 0; i < 10; i++) {
      rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: `t${i}` } });
    }
    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 10, nextMax: 10 });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'overflow' } });
    expect(rq.getStatus().nextCount).toBe(10);
    expect(prefetchTrackToLocalCache).toHaveBeenCalledTimes(10);
  });

  test('SPEC-9.4.2 — nextMax est configurable via maxNextSlots', () => {
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => new Promise(() => {})),
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
      maxNextSlots: 2,
    });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'a' } });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'b' } });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'c' } });
    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 2, nextMax: 2 });
  });

  test('SPEC-9.4.3 — la piste n\'est ajoutée à la file qu\'une fois le téléchargement résolu', async () => {
    const d = deferred();
    const addToQueue = jest.fn();
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => d.promise),
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'A' } });
    expect(addToQueue).not.toHaveBeenCalled();

    d.resolve(true);
    await flush();
    expect(addToQueue).toHaveBeenCalledTimes(1);
    expect(rq.getStatus().nextCount).toBe(0);
  });

  test('SPEC-9.4.3 — un échec de téléchargement libère le slot sans ajouter la piste', async () => {
    const addToQueue = jest.fn();
    const prefetchTrackToLocalCache = jest.fn((track, { onError } = {}) => {
      onError?.(new Error('download failed'));
      return Promise.resolve(false);
    });
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'A' } });
    await flush();

    expect(addToQueue).not.toHaveBeenCalled();
    expect(rq.getStatus().nextCount).toBe(0);
  });

  test('SPEC-9.4.4/9.4.5 — FIFO strict sur "next" même si les téléchargements finissent dans le désordre', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const addToQueue = jest.fn();
    const prefetchTrackToLocalCache = jest.fn((track) => (track.name === 'first' ? d1.promise : d2.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 5,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'first' } });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'second' } });

    // "second" finit son téléchargement en premier — ne doit pas être committé
    // avant "first" (soumis en premier).
    d2.resolve(true);
    await flush();
    expect(addToQueue).not.toHaveBeenCalled();

    d1.resolve(true);
    await flush();

    expect(addToQueue).toHaveBeenNthCalledWith(
      1,
      { name: 'first' },
      expect.objectContaining({ asNext: true, insertOffset: 0 })
    );
    expect(addToQueue).toHaveBeenNthCalledWith(
      2,
      { name: 'second' },
      expect.objectContaining({ asNext: true, insertOffset: 1 })
    );
  });

  test('SPEC-9.4.5 — le compteur insertOffset se remet à 0 si currentIndex change entre deux commits', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const addToQueue = jest.fn();
    let currentIndex = 0;
    const prefetchTrackToLocalCache = jest.fn((track) => (track.name === 'a' ? d1.promise : d2.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => currentIndex,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'a' } });
    d1.resolve(true);
    await flush();
    expect(addToQueue).toHaveBeenNthCalledWith(1, { name: 'a' }, expect.objectContaining({ insertOffset: 0 }));

    currentIndex = 1; // la piste précédente a avancé entre-temps

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'b' } });
    d2.resolve(true);
    await flush();
    expect(addToQueue).toHaveBeenNthCalledWith(2, { name: 'b' }, expect.objectContaining({ insertOffset: 0 }));
  });

  test('SPEC-9.4.6 — "now" utilise triggerSearchFade (pas addToQueue) et libère le slot avant l\'appel', async () => {
    const d = deferred();
    const addToQueue = jest.fn();
    const triggerSearchFade = jest.fn();
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => d.promise),
      addToQueue,
      triggerSearchFade,
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'X' } });
    expect(rq.getStatus().nowPending).toBe(true);

    d.resolve(true);
    await flush();

    expect(rq.getStatus().nowPending).toBe(false);
    expect(triggerSearchFade).toHaveBeenCalledWith({ name: 'X' });
    expect(addToQueue).not.toHaveBeenCalled();
  });

  test('getStatus() reflète nowPending/nextCount à chaque étape', async () => {
    const dNow = deferred();
    const dNext = deferred();
    const prefetchTrackToLocalCache = jest.fn((track) => (track.playNowMarker ? dNow.promise : dNext.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 0, nextMax: 10 });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'now', playNowMarker: true } });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'next' } });
    expect(rq.getStatus()).toEqual({ nowPending: true, nextCount: 1, nextMax: 10 });

    dNow.resolve(true);
    dNext.resolve(true);
    await flush();
    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 0, nextMax: 10 });
  });

  test('une commande d\'un autre type ou sans piste est ignorée', () => {
    const prefetchTrackToLocalCache = jest.fn();
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'somethingElse', track: { name: 'A' } });
    rq.handleCommand({ type: 'addToQueue' });
    rq.handleCommand(null);

    expect(prefetchTrackToLocalCache).not.toHaveBeenCalled();
    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 0, nextMax: 10 });
  });
});
