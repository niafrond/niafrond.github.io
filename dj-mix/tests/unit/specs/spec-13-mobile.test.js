/**
 * Spec-driven tests for §13.5 — Android Auto
 * References: SPEC-13.5.1–13.5.11
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { jest, describe, test, expect, afterEach } from '@jest/globals';
import {
  pushNowPlaying,
  pushPlaybackState,
  onMediaCommand,
  getPendingMediaCommand,
} from '../../../lib/androidAutoBridge.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const DJ_MIX_DIR = join(REPO_ROOT, 'dj-mix');

const originalCapacitor = window.Capacitor;
afterEach(() => {
  window.Capacitor = originalCapacitor;
});

function installNativeCapacitor(plugin) {
  window.Capacitor = { isNativePlatform: () => true, Plugins: { MediaSession: plugin } };
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

// ── SPEC-13.5.1 — Shortcuts Android Auto déclarés dans le manifest PWA ──────

describe('SPEC-13.5.1 — Shortcuts Android Auto', () => {
  test('manifest.json déclare les 3 raccourcis Mix Auto / Playlists / Queue', () => {
    const manifest = JSON.parse(readFileSync(join(DJ_MIX_DIR, 'manifest.json'), 'utf8'));
    const urls = (manifest.shortcuts || []).map((s) => s.url);
    expect(urls.some((u) => u.includes('automix=1'))).toBe(true);
    expect(urls.some((u) => u.includes('tab=playlists'))).toBe(true);
    expect(urls.some((u) => u.includes('tab=queue'))).toBe(true);
  });
});

// ── SPEC-13.5.2/.3/.5/.6 — Contrat JS exercé via androidAutoBridge.js ───────

describe('SPEC-13.5.2 — pushNowPlaying expose title/artist/album/artwork/duration', () => {
  test('transmet les clés attendues au plugin natif', async () => {
    const plugin = createPluginMock();
    installNativeCapacitor(plugin);

    pushNowPlaying({ id: 't1', title: 'T', artist: 'A', album: 'Al', artworkUrl: 'https://x/y.jpg', durationMs: 1000 });
    await Promise.resolve();
    await Promise.resolve();

    expect(plugin.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', title: 'T', artist: 'A', album: 'Al', durationMs: 1000 })
    );
  });
});

describe('SPEC-13.5.3 — pushPlaybackState expose playing/positionMs/speed', () => {
  test('transmet playing/positionMs/speed au plugin natif', () => {
    const plugin = createPluginMock();
    installNativeCapacitor(plugin);

    pushPlaybackState({ playing: true, positionMs: 5000, speed: 1 });

    expect(plugin.updatePlaybackState).toHaveBeenCalledWith({ playing: true, positionMs: 5000, speed: 1 });
  });
});

describe('SPEC-13.5.5 — onMediaCommand / getPendingMediaCommand', () => {
  test('onMediaCommand relaie les commandes play/pause/next/seek du natif', () => {
    const plugin = createPluginMock();
    installNativeCapacitor(plugin);
    const handler = jest.fn();

    onMediaCommand(handler);
    const relay = plugin.addListener.mock.calls[0][1];
    relay({ action: 'next' });

    expect(handler).toHaveBeenCalledWith({ action: 'next' });
  });

  test('getPendingMediaCommand récupère la commande à froid', async () => {
    const plugin = createPluginMock();
    plugin.getPendingCommand.mockResolvedValue({ action: 'play' });
    installNativeCapacitor(plugin);

    await expect(getPendingMediaCommand()).resolves.toEqual({ action: 'play' });
  });
});

// ── SPEC-13.5.11 — Contrat JS ↔ natif (régression texte) ─────────────────────
//
// Le projet natif `dj-mix-android/` et son workflow ont été supprimés du dépôt (commit « cleanup ») : les anciens tests qui
// lisaient ses sources Java/XML (SPEC-13.5.7, 13.5.8, 13.5.9) sont retirés. Reste le côté JS du contrat.

describe('SPEC-13.5.11 — pwa.js appelle downloadAndInstall', () => {
  test('pwa.js référence la méthode downloadAndInstall du plugin ApkUpdater', () => {
    const pwaSource = readFileSync(join(DJ_MIX_DIR, 'pwa.js'), 'utf8');
    expect(pwaSource).toContain('downloadAndInstall');
  });
});
