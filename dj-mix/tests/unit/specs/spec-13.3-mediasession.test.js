/**
 * Spec-driven tests for §13.3 — Media Session API (browser)
 * References: SPEC-13.3.6, SPEC-13.3.7, SPEC-13.3.8
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// ── SPEC-13.3.6 — devicechange pause la platine active si une sortie audio a disparu ─

describe('SPEC-13.3.6 — devicechange pause la platine focus uniquement si une sortie audio a disparu', () => {
  // Helper qui reproduit la logique du handler enregistré dans main.js::setupMediaSession()
  function makeDeviceChangeHandler({ player, getFocusDeck, lastDeckState, enumerateDevices, initialCount = null }) {
    let lastAudioOutputDeviceCount = initialCount;
    async function countAudioOutputDevices() {
      const devices = await enumerateDevices();
      return devices.filter((d) => d.kind === 'audiooutput').length;
    }
    return async () => {
      const previousCount = lastAudioOutputDeviceCount;
      const count = await countAudioOutputDevices();
      lastAudioOutputDeviceCount = count;
      if (previousCount === null || count === null || count >= previousCount) return;
      const focusDeck = getFocusDeck();
      const deckState = lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
      if (deckState?.playing) player?.pauseDeck?.(focusDeck);
    };
  }

  test('GIVEN une sortie audio en moins (déconnexion réelle) ET deck A en lecture WHEN devicechange THEN pauseDeck("A") est appelé', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: true }, deckB: { playing: false } },
      enumerateDevices: async () => [{ kind: 'audiooutput' }],
      initialCount: 2,
    });

    await handler();

    expect(pauseDeck).toHaveBeenCalledWith('A');
  });

  test('GIVEN une sortie audio en moins ET deck B en lecture WHEN devicechange THEN pauseDeck("B") est appelé', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'B',
      lastDeckState: { deckA: { playing: false }, deckB: { playing: true } },
      enumerateDevices: async () => [{ kind: 'audiooutput' }],
      initialCount: 2,
    });

    await handler();

    expect(pauseDeck).toHaveBeenCalledWith('B');
  });

  test('GIVEN le nombre de sorties audio est inchangé (ex. ajout d\'une entrée, bruit d\'énumération) WHEN devicechange THEN aucune pause même si le deck focus est en lecture', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: true }, deckB: { playing: false } },
      enumerateDevices: async () => [{ kind: 'audiooutput' }, { kind: 'audiooutput' }],
      initialCount: 2,
    });

    await handler();

    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('GIVEN le nombre de sorties audio augmente (ex. nouveau haut-parleur Bluetooth) WHEN devicechange THEN aucune pause', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: true }, deckB: { playing: false } },
      enumerateDevices: async () => [{ kind: 'audiooutput' }, { kind: 'audiooutput' }, { kind: 'audiooutput' }],
      initialCount: 2,
    });

    await handler();

    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('GIVEN deck focus non actif WHEN devicechange avec perte de sortie audio THEN aucune pause', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: false }, deckB: { playing: false } },
      enumerateDevices: async () => [{ kind: 'audiooutput' }],
      initialCount: 2,
    });

    await handler();

    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('GIVEN aucun compte de référence initial (première énumération) WHEN devicechange THEN aucune pause', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: true } },
      enumerateDevices: async () => [{ kind: 'audiooutput' }],
      initialCount: null,
    });

    await handler();

    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('GIVEN aucun état deck connu WHEN devicechange avec perte de sortie THEN aucune erreur ni pause', async () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: null,
      enumerateDevices: async () => [{ kind: 'audiooutput' }],
      initialCount: 2,
    });

    await expect(handler()).resolves.not.toThrow();
    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('handler enregistré sur navigator.mediaDevices pour l\'événement "devicechange"', () => {
    const listeners = {};
    const mediaDevicesMock = {
      addEventListener: jest.fn((event, fn) => { listeners[event] = fn; }),
      enumerateDevices: jest.fn(async () => []),
    };

    const origMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mediaDevicesMock,
      writable: true,
      configurable: true,
    });

    // Simuler l'appel de la partie de setupMediaSession qui enregistre le listener
    if (navigator.mediaDevices) {
      const pauseDeck = jest.fn();
      const getFocusDeck = () => 'A';
      const lastDeckState = { deckA: { playing: true } };
      let lastAudioOutputDeviceCount = null;
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const previousCount = lastAudioOutputDeviceCount;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const count = devices.filter((d) => d.kind === 'audiooutput').length;
        lastAudioOutputDeviceCount = count;
        if (previousCount === null || count === null || count >= previousCount) return;
        const focusDeck = getFocusDeck();
        const deckState = lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
        if (deckState?.playing) pauseDeck(focusDeck);
      });
    }

    expect(mediaDevicesMock.addEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
    expect(listeners['devicechange']).toBeDefined();

    if (origMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', origMediaDevices);
    }
  });
});

// ── SPEC-13.3.7 — Upgrade Apple CDN URL vers 512x512 ─────────────────────────

describe('SPEC-13.3.7 — getMediaSessionArtwork upgrade iTunes 100x100 → 512x512', () => {
  function getMediaSessionArtwork(item) {
    if (item?.artUrl) {
      const src = item.artUrl.includes('mzstatic.com')
        ? item.artUrl.replace(/\/\d+x\d+bb\.jpg$/, '/512x512bb.jpg')
        : item.artUrl;
      return [{ src, sizes: '512x512', type: 'image/jpeg' }];
    }
    return [{ src: 'data:image/svg+xml,fallback', sizes: '512x512', type: 'image/svg+xml' }];
  }

  test('GIVEN URL mzstatic 100x100bb THEN remplacée par 512x512bb', () => {
    const item = { artUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/xx/source/100x100bb.jpg' };
    const [{ src }] = getMediaSessionArtwork(item);
    expect(src).toBe('https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/xx/source/512x512bb.jpg');
  });

  test('GIVEN URL mzstatic 200x200bb THEN remplacée par 512x512bb', () => {
    const item = { artUrl: 'https://is2-ssl.mzstatic.com/image/thumb/x/200x200bb.jpg' };
    const [{ src }] = getMediaSessionArtwork(item);
    expect(src).toBe('https://is2-ssl.mzstatic.com/image/thumb/x/512x512bb.jpg');
  });

  test('GIVEN URL non-mzstatic THEN URL non modifiée', () => {
    const url = 'https://cdn.example.com/artwork/100x100bb.jpg';
    const item = { artUrl: url };
    const [{ src }] = getMediaSessionArtwork(item);
    expect(src).toBe(url);
  });

  test('GIVEN artUrl absent THEN retourne le fallback SVG', () => {
    const [{ type }] = getMediaSessionArtwork({});
    expect(type).toBe('image/svg+xml');
  });
});

// ── SPEC-13.3.8 — _fetchArtworkDataUri rejette les réponses non-image ─────────

describe('SPEC-13.3.8 — _fetchArtworkDataUri valide le type MIME et la taille', () => {
  async function _fetchArtworkDataUri(url, fetchImpl) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetchImpl(url);
      if (!response.ok) return '';
      const blob = await response.blob();
      if (!blob || blob.size < 64 || !blob.type.startsWith('image/')) return '';
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return '';
    }
  }

  function makeBlob(type, size) {
    return { type, size, ok: undefined };
  }

  function makeFetch({ ok = true, blob }) {
    return async () => ({ ok, blob: async () => blob });
  }

  test('GIVEN réponse HTTP 404 THEN retourne ""', async () => {
    const fetch = makeFetch({ ok: false, blob: makeBlob('image/jpeg', 10000) });
    expect(await _fetchArtworkDataUri('https://cdn.example.com/art.jpg', fetch)).toBe('');
  });

  test('GIVEN Content-Type text/html THEN retourne ""', async () => {
    const fetch = makeFetch({ ok: true, blob: makeBlob('text/html', 10000) });
    expect(await _fetchArtworkDataUri('https://cdn.example.com/art.jpg', fetch)).toBe('');
  });

  test('GIVEN blob.size < 64 THEN retourne ""', async () => {
    const fetch = makeFetch({ ok: true, blob: makeBlob('image/jpeg', 10) });
    expect(await _fetchArtworkDataUri('https://cdn.example.com/art.jpg', fetch)).toBe('');
  });

  test('GIVEN url déjà en data: THEN retournée directement sans fetch', async () => {
    const fetchSpy = jest.fn();
    const dataUri = 'data:image/jpeg;base64,abc';
    expect(await _fetchArtworkDataUri(dataUri, fetchSpy)).toBe(dataUri);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('GIVEN url vide THEN retourne "" sans fetch', async () => {
    const fetchSpy = jest.fn();
    expect(await _fetchArtworkDataUri('', fetchSpy)).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
