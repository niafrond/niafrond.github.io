/**
 * Spec-driven tests for §20 — Mise à jour forcée de la PWA
 * References: SPEC-20.1–20.3
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { forceUpdatePwa } from '../../pwa.js';

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

  test('désinscrit tous les service workers et supprime tous les caches, puis termine sans exception', async () => {
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

describe('SPEC-19.6.1 — backgroundfetchfail moissonne les réponses déjà reçues', () => {
  test('_handleBgFetchFail réutilise _harvestBgFetchRecords et poste BG_FETCH_DONE avec le détail par clé', () => {
    const swSource = readFileSync(join(DJ_MIX_DIR, 'sw.js'), 'utf8');
    const failHandler = swSource.slice(swSource.indexOf('async function _handleBgFetchFail'));
    expect(failHandler).toContain('_harvestBgFetchRecords(bgFetch)');
    expect(failHandler).toContain("type: 'BG_FETCH_DONE'");
    // BG_FETCH_FAIL reste le repli si la moisson elle-même échoue.
    expect(failHandler).toContain("type: 'BG_FETCH_FAIL'");
  });

  test('les deux handlers success/fail partagent la même moisson (blobs mis en cache une seule fois)', () => {
    const swSource = readFileSync(join(DJ_MIX_DIR, 'sw.js'), 'utf8');
    expect(swSource.match(/audioCache\.put\(/g)).toHaveLength(1);
    expect(swSource).toContain('async function _harvestBgFetchRecords');
  });
});
