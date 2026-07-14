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
const ANDROID_DIR = join(REPO_ROOT, 'dj-mix-android');
const JAVA_DIR = join(ANDROID_DIR, 'src', 'main', 'java', 'io', 'github', 'niafrond', 'djmix');

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

// ── SPEC-13.5.7/.9/.11 — Contrat JS ↔ natif (régression texte) ──────────────
//
// Pas de runner Java dans ce repo (Jest uniquement) : on vérifie que les noms
// de méthodes/événements attendus côté JS sont bien présents tels quels dans
// les sources natives, pour détecter une dérive du contrat sans recompiler.

describe('SPEC-13.5.7 — MediaSessionPlugin respecte le contrat androidAutoBridge.js', () => {
  const pluginSource = readFileSync(join(JAVA_DIR, 'MediaSessionPlugin.java'), 'utf8');

  test.each([
    'updateMetadata',
    'updatePlaybackState',
    'updateQueue',
    'getPendingCommand',
    'mediaCommand',
  ])('expose %s', (symbol) => {
    expect(pluginSource).toContain(symbol);
  });
});

describe('SPEC-13.5.8 — MediaPlaybackService relaie les actions attendues par applyMediaCommand()', () => {
  const serviceSource = readFileSync(join(JAVA_DIR, 'MediaPlaybackService.java'), 'utf8');

  test.each(['"play"', '"pause"', '"next"', '"seekTo"', '"playFromMediaId"'])(
    'dispatch l\'action %s',
    (action) => {
      expect(serviceSource).toContain(action);
    }
  );
});

describe('SPEC-13.5.9 — Déclarations requises pour la détection Android Auto', () => {
  test('automotive_app_desc.xml déclare <uses name="media"/>', () => {
    const xml = readFileSync(join(ANDROID_DIR, 'src', 'main', 'res', 'xml', 'automotive_app_desc.xml'), 'utf8');
    expect(xml).toContain('<uses name="media"/>');
  });

  test('le workflow CI patche meta-data car.application, MediaBrowserService et MediaButtonReceiver', () => {
    const workflow = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'apk-djmix.yml'), 'utf8');
    expect(workflow).toContain('com.google.android.gms.car.application');
    expect(workflow).toContain('android.media.browse.MediaBrowserService');
    expect(workflow).toContain('androidx.media.session.MediaButtonReceiver');
  });
});

describe('SPEC-13.5.11 — ApkUpdaterPlugin expose downloadAndInstall', () => {
  test('le plugin Java définit la méthode downloadAndInstall appelée par pwa.js', () => {
    const pluginSource = readFileSync(join(JAVA_DIR, 'ApkUpdaterPlugin.java'), 'utf8');
    expect(pluginSource).toContain('downloadAndInstall');

    const pwaSource = readFileSync(join(DJ_MIX_DIR, 'pwa.js'), 'utf8');
    expect(pwaSource).toContain('downloadAndInstall');
  });
});
