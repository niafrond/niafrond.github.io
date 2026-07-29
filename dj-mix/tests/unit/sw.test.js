import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { jest, describe, test, expect } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// sw.js est un script de Service Worker classique (pas un module ES) : on
// charge son code source et on l'exécute dans un scope `self`/`caches`
// simulé, en interceptant les listeners enregistrés via
// `self.addEventListener` pour pouvoir déclencher `activate` manuellement.
function loadServiceWorker() {
  const swSource = fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8');
  const listeners = {};
  const fakeSelf = {
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: jest.fn(),
    clients: { claim: jest.fn() },
  };
  // eslint-disable-next-line no-new-func
  const run = new Function('self', 'caches', 'Request', swSource);
  const fakeCaches = {
    open: jest.fn().mockResolvedValue({ addAll: jest.fn().mockResolvedValue(undefined) }),
    keys: jest.fn(),
    delete: jest.fn().mockResolvedValue(true),
  };
  run(fakeSelf, fakeCaches, class FakeRequest {});

  const currentCacheMatch = swSource.match(/const CACHE = '([^']+)'/);
  const currentCache = currentCacheMatch ? currentCacheMatch[1] : null;

  return { listeners, fakeSelf, fakeCaches, currentCache };
}

describe('SPEC-20.4 — activate() du Service Worker ne purge que les anciennes versions du cache app-shell', () => {
  test('supprime les anciens caches "djmix-v*" mais préserve le cache audio persistant et tout autre cache', async () => {
    const { listeners, fakeSelf, fakeCaches, currentCache } = loadServiceWorker();
    expect(currentCache).toBeTruthy();

    fakeCaches.keys.mockResolvedValue([
      'djmix-v0.0.0-stale', // ancienne version de l'app shell — doit être supprimée
      currentCache, // version courante — doit être conservée
      'dj-mix:audio-cache:v1', // cache audio persistant (SPEC-13.1.4) — ne doit jamais être supprimé ici
      'dj-mix:other-persistent-cache', // tout autre espace de nommage — préservé par précaution
    ]);

    let waitUntilPromise = null;
    await listeners.activate({ waitUntil: (p) => { waitUntilPromise = p; } });
    await waitUntilPromise;

    expect(fakeCaches.delete).toHaveBeenCalledTimes(1);
    expect(fakeCaches.delete).toHaveBeenCalledWith('djmix-v0.0.0-stale');
    expect(fakeCaches.delete).not.toHaveBeenCalledWith(currentCache);
    expect(fakeCaches.delete).not.toHaveBeenCalledWith('dj-mix:audio-cache:v1');
    expect(fakeCaches.delete).not.toHaveBeenCalledWith('dj-mix:other-persistent-cache');
    expect(fakeSelf.clients.claim).toHaveBeenCalled();
  });
});
