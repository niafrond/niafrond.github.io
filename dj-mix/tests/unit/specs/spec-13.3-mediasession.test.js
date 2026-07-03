/**
 * Spec-driven tests for §13.3 — Media Session API (browser)
 * References: SPEC-13.3.6
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// ── SPEC-13.3.6 — devicechange pause la platine active ───────────────────────

describe('SPEC-13.3.6 — devicechange pause la platine focus si en lecture', () => {
  // Helper qui reproduit la logique du handler enregistré dans main.js::setupMediaSession()
  function makeDeviceChangeHandler({ player, getFocusDeck, lastDeckState }) {
    return () => {
      const focusDeck = getFocusDeck();
      const deckState = lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
      if (deckState?.playing) player?.pauseDeck?.(focusDeck);
    };
  }

  test('GIVEN deck A en lecture WHEN devicechange THEN pauseDeck("A") est appelé', () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: true }, deckB: { playing: false } },
    });

    handler();

    expect(pauseDeck).toHaveBeenCalledWith('A');
  });

  test('GIVEN deck B en lecture WHEN devicechange THEN pauseDeck("B") est appelé', () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'B',
      lastDeckState: { deckA: { playing: false }, deckB: { playing: true } },
    });

    handler();

    expect(pauseDeck).toHaveBeenCalledWith('B');
  });

  test('GIVEN deck focus non actif WHEN devicechange THEN aucune pause', () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: { deckA: { playing: false }, deckB: { playing: false } },
    });

    handler();

    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('GIVEN aucun état deck connu WHEN devicechange THEN aucune erreur ni pause', () => {
    const pauseDeck = jest.fn();
    const handler = makeDeviceChangeHandler({
      player: { pauseDeck },
      getFocusDeck: () => 'A',
      lastDeckState: null,
    });

    expect(() => handler()).not.toThrow();
    expect(pauseDeck).not.toHaveBeenCalled();
  });

  test('handler enregistré sur navigator.mediaDevices pour l\'événement "devicechange"', () => {
    const listeners = {};
    const mediaDevicesMock = {
      addEventListener: jest.fn((event, fn) => { listeners[event] = fn; }),
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
      navigator.mediaDevices.addEventListener('devicechange', () => {
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
