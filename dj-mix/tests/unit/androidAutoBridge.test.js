import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  resolveArtworkUrl,
  pushNowPlaying,
  pushPlaybackState,
  pushQueue,
  onMediaCommand,
  getPendingMediaCommand,
} from '../../lib/androidAutoBridge.js';

const originalCapacitor = window.Capacitor;

function installNativeCapacitor(plugin) {
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { MediaSession: plugin },
  };
}

function createPluginMock() {
  return {
    updateMetadata: jest.fn().mockResolvedValue(undefined),
    updatePlaybackState: jest.fn().mockResolvedValue(undefined),
    updateQueue: jest.fn().mockResolvedValue(undefined),
    getPendingCommand: jest.fn().mockResolvedValue({}),
    addListener: jest.fn(),
  };
}

describe('androidAutoBridge', () => {
  afterEach(() => {
    window.Capacitor = originalCapacitor;
    jest.useRealTimers();
  });

  describe('hors plateforme native (PWA / navigateur classique)', () => {
    beforeEach(() => {
      delete window.Capacitor;
    });

    test('pushNowPlaying ne fait rien sans Capacitor natif', () => {
      expect(() => pushNowPlaying({ id: 't1', title: 'Titre' })).not.toThrow();
    });

    test('pushPlaybackState ne fait rien sans Capacitor natif', () => {
      expect(() => pushPlaybackState({ playing: true, positionMs: 1000 })).not.toThrow();
    });

    test('pushQueue ne fait rien sans Capacitor natif', () => {
      expect(() => pushQueue([{ id: 't1', name: 'Titre' }])).not.toThrow();
    });

    test('onMediaCommand ne fait rien sans Capacitor natif', () => {
      expect(() => onMediaCommand(jest.fn())).not.toThrow();
    });

    test('getPendingMediaCommand résout null sans Capacitor natif', async () => {
      await expect(getPendingMediaCommand()).resolves.toBeNull();
    });
  });

  describe('resolveArtworkUrl', () => {
    test('laisse passer une URL non-blob telle quelle', async () => {
      await expect(resolveArtworkUrl('https://example.com/cover.jpg')).resolves.toBe(
        'https://example.com/cover.jpg'
      );
    });

    test('convertit une URL blob: en data URI via FileReader', async () => {
      const fakeBlob = { type: 'image/jpeg' };
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });

      class FakeFileReader {
        readAsDataURL() {
          this.result = 'data:image/jpeg;base64,Zm9v';
          this.onload?.();
        }
      }
      const originalFileReader = global.FileReader;
      global.FileReader = FakeFileReader;

      await expect(resolveArtworkUrl('blob:local-cover')).resolves.toBe(
        'data:image/jpeg;base64,Zm9v'
      );

      global.fetch = originalFetch;
      global.FileReader = originalFileReader;
    });

    test("renvoie une chaîne vide si la résolution échoue", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

      await expect(resolveArtworkUrl('blob:broken')).resolves.toBe('');

      global.fetch = originalFetch;
    });
  });

  describe('pushNowPlaying', () => {
    test('transmet les métadonnées avec les clés attendues par MediaSessionPlugin.updateMetadata', async () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);

      pushNowPlaying({
        id: 'track-1',
        title: 'Mon Titre',
        artist: 'Mon Artiste',
        album: 'Mon Album',
        artworkUrl: 'https://example.com/art.jpg',
        durationMs: 215000,
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.updateMetadata).toHaveBeenCalledWith({
        id: 'track-1',
        title: 'Mon Titre',
        artist: 'Mon Artiste',
        album: 'Mon Album',
        durationMs: 215000,
        artworkUrl: 'https://example.com/art.jpg',
      });
    });

    test('applique les valeurs par défaut (title/album "DJ Mix", durationMs >= 0)', async () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);

      pushNowPlaying({});
      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'DJ Mix', album: 'DJ Mix', artist: '', durationMs: 0 })
      );
    });
  });

  describe('pushPlaybackState', () => {
    test('transmet { playing, positionMs, speed } avec speed par défaut à 1', () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);

      pushPlaybackState({ playing: true, positionMs: 4200 });

      expect(plugin.updatePlaybackState).toHaveBeenCalledWith({
        playing: true,
        positionMs: 4200,
        speed: 1,
      });
    });

    test('clamp positionMs négatif à 0', () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);

      pushPlaybackState({ playing: false, positionMs: -50, speed: 1.5 });

      expect(plugin.updatePlaybackState).toHaveBeenCalledWith({
        playing: false,
        positionMs: 0,
        speed: 1.5,
      });
    });
  });

  describe('pushQueue', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    test('anti-rebond : un seul appel à updateQueue après 500ms pour des appels rapprochés', () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);

      pushQueue([{ id: 't1', name: 'Premier' }]);
      jest.advanceTimersByTime(100);
      pushQueue([{ id: 't1', name: 'Premier' }, { id: 't2', title: 'Second' }]);

      expect(plugin.updateQueue).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(plugin.updateQueue).toHaveBeenCalledTimes(1);
      expect(plugin.updateQueue).toHaveBeenCalledWith({
        items: [
          { id: 't1', title: 'Premier', artist: '', artworkUrl: '' },
          { id: 't2', title: 'Second', artist: '', artworkUrl: '' },
        ],
      });
    });

    test('mappe artUrl vers artworkUrl et name||title vers title', () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);

      pushQueue([{ id: 't1', title: 'Titre seul', artist: 'Artiste', artUrl: 'blob:cover' }]);
      jest.advanceTimersByTime(500);

      expect(plugin.updateQueue).toHaveBeenCalledWith({
        items: [{ id: 't1', title: 'Titre seul', artist: 'Artiste', artworkUrl: 'blob:cover' }],
      });
    });
  });

  describe('onMediaCommand', () => {
    test("enregistre un listener 'mediaCommand' qui relaie les données au handler", () => {
      const plugin = createPluginMock();
      installNativeCapacitor(plugin);
      const handler = jest.fn();

      onMediaCommand(handler);

      expect(plugin.addListener).toHaveBeenCalledWith('mediaCommand', expect.any(Function));
      const relay = plugin.addListener.mock.calls[0][1];
      relay({ action: 'play' });
      expect(handler).toHaveBeenCalledWith({ action: 'play' });

      relay(null);
      expect(handler).toHaveBeenCalledWith({});
    });
  });

  describe('getPendingMediaCommand', () => {
    test('renvoie la commande si une action est présente', async () => {
      const plugin = createPluginMock();
      plugin.getPendingCommand.mockResolvedValue({ action: 'pause', positionMs: 1000 });
      installNativeCapacitor(plugin);

      await expect(getPendingMediaCommand()).resolves.toEqual({
        action: 'pause',
        positionMs: 1000,
      });
    });

    test("renvoie null si aucune action n'est en attente", async () => {
      const plugin = createPluginMock();
      plugin.getPendingCommand.mockResolvedValue({});
      installNativeCapacitor(plugin);

      await expect(getPendingMediaCommand()).resolves.toBeNull();
    });

    test('renvoie null si le plugin rejette', async () => {
      const plugin = createPluginMock();
      plugin.getPendingCommand.mockRejectedValue(new Error('native error'));
      installNativeCapacitor(plugin);

      await expect(getPendingMediaCommand()).resolves.toBeNull();
    });
  });
});
