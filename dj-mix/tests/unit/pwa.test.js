/**
 * Spec-driven tests for §20 — Mise à jour forcée de la PWA
 * References: SPEC-20.1–20.3
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { forceUpdatePwa, initAutoFullscreen } from '../../pwa.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DJ_MIX_DIR = join(__dirname, '..', '..');

describe('SPEC-20.1 — Bouton #btn-force-update', () => {
  test("index.html expose #btn-force-update, visible, dans le bloc Application PWA", () => {
    const html = readFileSync(join(DJ_MIX_DIR, 'index.html'), 'utf8');
    const pwaBlockMatch = html.match(/Application PWA[\s\S]*?<\/div>\s*<\/div>/);
    expect(pwaBlockMatch).not.toBeNull();
    const block = pwaBlockMatch[0];
    expect(block).toContain('id="btn-force-update"');
    const btnMatch = block.match(/<button id="btn-force-update"[^>]*>/);
    expect(btnMatch).not.toBeNull();
    expect(btnMatch[0]).not.toContain('hidden');
  });

  test('main.js relie le clic de #btn-force-update à forceUpdatePwa()', () => {
    const mainSource = readFileSync(join(DJ_MIX_DIR, 'main.js'), 'utf8');
    expect(mainSource).toContain("forceUpdatePwa");
    expect(mainSource).toMatch(/btn-force-update['"][\s\S]{0,200}forceUpdatePwa\(\)/);
  });
});

// NB: jsdom expose `window.location.reload` en propriété non-configurable /
// non-writable — impossible à espionner ici. On vérifie donc le comportement
// observable côté SW/caches, et que `forceUpdatePwa()` se termine toujours
// sans exception (y compris en cas d'échec), plutôt que l'appel à `reload()`
// lui-même.
describe('SPEC-20.2 — forceUpdatePwa() désinscrit les SW et vide les caches', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="btn-force-update"></button>';
  });

  afterEach(() => {
    delete navigator.serviceWorker;
    delete window.caches;
  });

  test('désinscrit tous les service workers et supprime les caches applicatifs, puis termine sans exception', async () => {
    const reg1 = { unregister: jest.fn().mockResolvedValue(true) };
    const reg2 = { unregister: jest.fn().mockResolvedValue(true) };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: jest.fn().mockResolvedValue([reg1, reg2]) },
      configurable: true,
    });
    const deleteCache = jest.fn().mockResolvedValue(true);
    window.caches = { keys: jest.fn().mockResolvedValue(['cache-a', 'cache-b']), delete: deleteCache };

    const btn = document.getElementById('btn-force-update');
    await expect(forceUpdatePwa()).resolves.toBeUndefined();

    expect(reg1.unregister).toHaveBeenCalled();
    expect(reg2.unregister).toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledWith('cache-a');
    expect(deleteCache).toHaveBeenCalledWith('cache-b');
    expect(btn.disabled).toBe(true);
  });

  test('préserve le cache audio dj-mix:audio-cache:v1 lors de la mise à jour (SPEC-20.2)', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: jest.fn().mockResolvedValue([]) },
      configurable: true,
    });
    const deleteCache = jest.fn().mockResolvedValue(true);
    window.caches = {
      keys: jest.fn().mockResolvedValue(['djmix-v1.0.0', 'dj-mix:audio-cache:v1']),
      delete: deleteCache,
    };

    await expect(forceUpdatePwa()).resolves.toBeUndefined();

    expect(deleteCache).toHaveBeenCalledWith('djmix-v1.0.0');
    expect(deleteCache).not.toHaveBeenCalledWith('dj-mix:audio-cache:v1');
  });

  test("termine sans exception même si la désinscription échoue", async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: jest.fn().mockRejectedValue(new Error('boom')) },
      configurable: true,
    });

    await expect(forceUpdatePwa()).resolves.toBeUndefined();
  });

  test('termine sans exception sans API serviceWorker/caches disponibles', async () => {
    await expect(forceUpdatePwa()).resolves.toBeUndefined();
  });
});

describe('SPEC-13.6.4 — initAutoFullscreen() ne force le plein écran que sur mobile/Capacitor', () => {
  let uaSpy;
  let requestFullscreenSpy;

  beforeEach(() => {
    document.documentElement.requestFullscreen = jest.fn().mockResolvedValue(undefined);
    requestFullscreenSpy = document.documentElement.requestFullscreen;
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    delete document.documentElement.requestFullscreen;
    uaSpy?.mockRestore();
    delete window.matchMedia;
    delete window.Capacitor;
  });

  test("sur navigateur desktop, ne tente aucun passage en plein écran automatique", () => {
    uaSpy = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
    );

    initAutoFullscreen();
    document.dispatchEvent(new Event('pointerdown'));

    expect(requestFullscreenSpy).not.toHaveBeenCalled();
  });

  test('sur navigateur mobile (UA Android), tente le passage en plein écran', () => {
    uaSpy = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
    );

    initAutoFullscreen();

    expect(requestFullscreenSpy).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  test('dans une WebView Capacitor (desktop UA ou non), tente le passage en plein écran', () => {
    uaSpy = jest.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
    );
    window.Capacitor = {};

    initAutoFullscreen();

    expect(requestFullscreenSpy).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });
});

describe('SPEC-20.3 — Après rechargement, un Service Worker neuf retélécharge tous les ASSETS', () => {
  test('initServiceWorker() est appelé au démarrage de main.js (réinscription systématique)', () => {
    const mainSource = readFileSync(join(DJ_MIX_DIR, 'main.js'), 'utf8');
    expect(mainSource).toContain('initServiceWorker();');
  });

  test("sw.js réinstalle tous les ASSETS avec cache: 'reload' à chaque nouvelle activation", () => {
    const swSource = readFileSync(join(DJ_MIX_DIR, 'sw.js'), 'utf8');
    expect(swSource).toContain("cache: 'reload'");
  });
});
