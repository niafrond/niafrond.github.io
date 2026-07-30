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
    expect(rq.getStatus().nowPending).toBe(false);
    expect(rq.getStatus().nextCount).toBe(10);
    expect(rq.getStatus().nextMax).toBe(10);

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
    expect(rq.getStatus().nowPending).toBe(false);
    expect(rq.getStatus().nextCount).toBe(2);
    expect(rq.getStatus().nextMax).toBe(2);
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

  test('SPEC-9.4.3 — un échec de téléchargement "next" conserve le slot sans ajouter la piste', async () => {
    jest.useFakeTimers();
    try {
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
      expect(rq.getStatus().nextCount).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('SPEC-9.4.3 — un slot "next" en échec est retenté après 10 minutes', async () => {
    jest.useFakeTimers();
    try {
      const addToQueue = jest.fn();
      let attempts = 0;
      const prefetchTrackToLocalCache = jest.fn((track, { onError } = {}) => {
        attempts += 1;
        if (attempts === 1) {
          onError?.(new Error('download failed'));
          return Promise.resolve(false);
        }
        return Promise.resolve(true);
      });
      const rq = createRelayIncomingQueue({
        prefetchTrackToLocalCache,
        addToQueue,
        triggerSearchFade: jest.fn(),
        getCurrentIndex: () => 0,
      });

      rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'A' } });
      await flush();

      expect(prefetchTrackToLocalCache).toHaveBeenCalledTimes(1);
      expect(addToQueue).not.toHaveBeenCalled();
      expect(rq.getStatus().nextCount).toBe(1);

      jest.advanceTimersByTime(10 * 60 * 1000 - 1);
      await flush();
      expect(prefetchTrackToLocalCache).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(1);
      await flush();
      expect(prefetchTrackToLocalCache).toHaveBeenCalledTimes(2);
      expect(addToQueue).toHaveBeenCalledTimes(1);
      expect(rq.getStatus().nextCount).toBe(0);
    } finally {
      jest.useRealTimers();
    }
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

  test('SPEC-9.4.14 — une commande "next" arrivée en second est réordonnée devant si son requestedAt est plus ancien', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const addToQueue = jest.fn();
    const prefetchTrackToLocalCache = jest.fn((track) => (track.name === 'late-arrival-early-request' ? d1.promise : d2.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    // "3h20" arrive au maître EN PREMIER (ex. réseau plus rapide) mais a été
    // envoyée par le relais APRÈS "3h15" (requestedAt plus tardif).
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'sent-3h20' }, requestedAt: 1000 * 60 * 60 * 3 + 1000 * 60 * 20 });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'late-arrival-early-request' }, requestedAt: 1000 * 60 * 60 * 3 + 1000 * 60 * 15 });

    // Les deux téléchargements se terminent en même temps.
    d1.resolve(true);
    d2.resolve(true);
    await flush();

    expect(addToQueue).toHaveBeenNthCalledWith(
      1,
      { name: 'late-arrival-early-request' },
      expect.objectContaining({ asNext: true, insertOffset: 0 })
    );
    expect(addToQueue).toHaveBeenNthCalledWith(
      2,
      { name: 'sent-3h20' },
      expect.objectContaining({ asNext: true, insertOffset: 1 })
    );
  });

  test('SPEC-9.4.14 — requestedAt manquant est traité comme "maintenant" sans faire planter le tri', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const addToQueue = jest.fn();
    const prefetchTrackToLocalCache = jest.fn((track) => (track.name === 'with-timestamp' ? d1.promise : d2.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'with-timestamp' }, requestedAt: 100 });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'no-timestamp' } });

    d1.resolve(true);
    d2.resolve(true);
    await flush();

    // requestedAt: 100 est bien plus ancien que Date.now() au moment du fallback,
    // donc reste en tête même si sa commande a été soumise en premier ici aussi.
    expect(addToQueue).toHaveBeenNthCalledWith(
      1,
      { name: 'with-timestamp' },
      expect.objectContaining({ asNext: true, insertOffset: 0 })
    );
    expect(addToQueue).toHaveBeenNthCalledWith(
      2,
      { name: 'no-timestamp' },
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

    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 0, nextMax: 10, now: null, next: [] });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'now', playNowMarker: true } });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'next' } });
    expect(rq.getStatus()).toEqual({
      nowPending: true,
      nextCount: 1,
      nextMax: 10,
      now: { name: 'now', artist: '', artUrl: '', deviceId: null },
      next: [{ name: 'next', artist: '', artUrl: '', deviceId: null, ready: false }],
    });

    dNow.resolve(true);
    dNext.resolve(true);
    await flush();
    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 0, nextMax: 10, now: null, next: [] });
  });

  test('SPEC-9.5.1 — getStatus() expose le détail de la piste "now" en cours de téléchargement', () => {
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => new Promise(() => {})),
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({
      type: 'addToQueue',
      playNow: true,
      deviceId: 'DEV001',
      track: { name: 'A', artist: 'Artist A', artUrl: 'http://x/a.jpg' },
    });

    expect(rq.getStatus().now).toEqual({
      name: 'A',
      artist: 'Artist A',
      artUrl: 'http://x/a.jpg',
      deviceId: 'DEV001',
    });
  });

  test('SPEC-9.5.1 — getStatus() expose le détail des pistes "next", avec ready=true une fois téléchargées mais pas encore committées', async () => {
    const d1 = deferred();
    const d2 = deferred();
    const prefetchTrackToLocalCache = jest.fn((track) => (track.name === 'first' ? d1.promise : d2.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, deviceId: 'DEV001', track: { name: 'first', artist: 'A1' } });
    rq.handleCommand({ type: 'addToQueue', playNow: false, deviceId: 'DEV002', track: { name: 'second', artist: 'A2' } });

    // "second" finit son téléchargement en premier mais n'est pas en tête de file :
    // reste visible avec ready:true tant que "first" n'a pas résolu.
    d2.resolve(true);
    await flush();
    expect(rq.getStatus().next).toEqual([
      { name: 'first', artist: 'A1', artUrl: '', deviceId: 'DEV001', ready: false },
      { name: 'second', artist: 'A2', artUrl: '', deviceId: 'DEV002', ready: true },
    ]);

    d1.resolve(true);
    await flush();
    expect(rq.getStatus().next).toEqual([]);
  });

  test('SPEC-9.5.2 — onChange() est appelé à chaque mutation (now et next)', async () => {
    const dNow = deferred();
    const dNext = deferred();
    const onChange = jest.fn();
    const prefetchTrackToLocalCache = jest.fn((track) => (track.playNowMarker ? dNow.promise : dNext.promise));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
      onChange,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'now', playNowMarker: true } });
    expect(onChange).toHaveBeenCalledTimes(1);

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'next' } });
    expect(onChange).toHaveBeenCalledTimes(2);

    dNow.resolve(true);
    dNext.resolve(true);
    await flush();
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  test('SPEC-9.4.11 — deviceId est propagé au logger sur rejet "now" et "next"', () => {
    const logger = { info: jest.fn(), warn: jest.fn() };
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => new Promise(() => {})),
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
      logger,
      maxNextSlots: 1,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'A' }, deviceId: 'DEV001' });
    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'B' }, deviceId: 'DEV002' });
    expect(logger.info).toHaveBeenCalledWith('relay.incoming.now.rejected', { name: 'B', deviceId: 'DEV002' });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'C' }, deviceId: 'DEV003' });
    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'D' }, deviceId: 'DEV004' });
    expect(logger.info).toHaveBeenCalledWith('relay.incoming.next.rejected', { name: 'D', deviceId: 'DEV004', count: 1 });
  });

  test('SPEC-9.4.11 — deviceId est propagé au logger sur échec de téléchargement', () => {
    jest.useFakeTimers();
    try {
      const logger = { info: jest.fn(), warn: jest.fn() };
      const prefetchTrackToLocalCache = jest.fn((track, { onError } = {}) => {
        onError?.(new Error('boom'));
        return Promise.resolve(false);
      });
      const rq = createRelayIncomingQueue({
        prefetchTrackToLocalCache,
        addToQueue: jest.fn(),
        triggerSearchFade: jest.fn(),
        getCurrentIndex: () => 0,
        logger,
      });

      rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'A' }, deviceId: 'DEV001' });
      expect(logger.warn).toHaveBeenCalledWith('relay.incoming.now.downloadFailed', { name: 'A', deviceId: 'DEV001', err: 'boom' });

      rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'B' }, deviceId: 'DEV002' });
      expect(logger.warn).toHaveBeenCalledWith(
        'relay.incoming.next.downloadFailed',
        expect.objectContaining({ name: 'B', deviceId: 'DEV002', err: 'boom' })
      );
    } finally {
      jest.useRealTimers();
    }
  });

  test('SPEC-9.4.13 — prefetchMixData() est lancé en parallèle du téléchargement audio, pour "now" et "next"', () => {
    const prefetchMixData = jest.fn(() => new Promise(() => {}));
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => new Promise(() => {})),
      prefetchMixData,
      addToQueue: jest.fn(),
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: true, track: { name: 'A', artist: 'Art' } });
    expect(prefetchMixData).toHaveBeenCalledWith({ name: 'A', artist: 'Art' });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'B', artist: 'Art2' } });
    expect(prefetchMixData).toHaveBeenCalledWith({ name: 'B', artist: 'Art2' });
  });

  test('SPEC-9.4.13 — un échec de prefetchMixData() ne bloque ni ne rejette la commande', async () => {
    const addToQueue = jest.fn();
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => Promise.resolve(true)),
      prefetchMixData: jest.fn(() => Promise.reject(new Error('mix data unavailable'))),
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'A' } });
    await flush();

    expect(addToQueue).toHaveBeenCalledTimes(1);
  });

  test('prefetchMixData omis (non fourni) : le prefetch audio fonctionne normalement', async () => {
    const addToQueue = jest.fn();
    const rq = createRelayIncomingQueue({
      prefetchTrackToLocalCache: jest.fn(() => Promise.resolve(true)),
      addToQueue,
      triggerSearchFade: jest.fn(),
      getCurrentIndex: () => 0,
    });

    rq.handleCommand({ type: 'addToQueue', playNow: false, track: { name: 'A' } });
    await flush();

    expect(addToQueue).toHaveBeenCalledTimes(1);
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
    expect(rq.getStatus()).toEqual({ nowPending: false, nextCount: 0, nextMax: 10, now: null, next: [] });
  });
});
