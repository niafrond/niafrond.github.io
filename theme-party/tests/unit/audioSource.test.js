/**
 * audioSource.test.js — Tests unitaires pour theme-party/audioSource.js
 * (fetch mocké ; jsdom fournit un vrai localStorage, remis à zéro à chaque test)
 */

import { jest } from '@jest/globals';
import * as audioSource from '../../audioSource.js';
import { DEFAULT_DOWNLOADER_API_URL } from '../../../dj-mix/lib/storageKeys.js';

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
  // apiHealthMonitor est un singleton partagé par tous les tests du fichier (import statique) ;
  // le remettre "en ligne" évite qu'un test précédent ne fasse basculer isOffline() à true.
  audioSource.apiHealthMonitor.recordSuccess();
});

afterAll(() => {
  audioSource.apiHealthMonitor.destroy();
});

describe('config API (url/token/CDN)', () => {
  test('URL par défaut si rien en storage', () => {
    expect(audioSource.getDownloaderApiUrl()).toBe(DEFAULT_DOWNLOADER_API_URL.replace(/\/+$/, ''));
  });

  test('getDownloaderApiToken est vide par défaut', () => {
    expect(audioSource.getDownloaderApiToken()).toBe('');
  });

  test('getDownloaderCdnUrl dérive de la même base URL que l\'API si non configurée', () => {
    localStorage.setItem('theme-party:downloader:api:url', 'http://10.0.0.5:8080');
    expect(audioSource.getDownloaderCdnUrl()).toBe('http://10.0.0.5:8080');
  });
});

describe('getSongKey', () => {
  test('utilise cachePath si présent', () => {
    expect(audioSource.getSongKey({ cachePath: '/cache/abc.mp3', artist: 'X', title: 'Y' })).toBe('/cache/abc.mp3');
  });

  test('retombe sur artist::title en minuscules si pas de cachePath', () => {
    expect(audioSource.getSongKey({ artist: 'Queen', title: 'Bohemian Rhapsody' })).toBe('queen::bohemian rhapsody');
  });
});

describe('searchTracks', () => {
  test('retourne [] pour un terme vide (aucun appel réseau)', async () => {
    const results = await audioSource.searchTracks('   ');
    expect(results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('normalise les résultats de /api/search', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tracks: {
          results: [
            { name: 'Bohemian Rhapsody', artist: 'Queen', artUrl: 'https://img/x.jpg', cachePath: '' },
          ],
        },
      }),
    });
    const results = await audioSource.searchTracks('bohemian rhapsody queen');
    expect(results).toEqual([
      { title: 'Bohemian Rhapsody', artist: 'Queen', artUrl: 'https://img/x.jpg', cachePath: '' },
    ]);
  });

  test('retourne [] et n\'explose pas si fetch échoue', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    const results = await audioSource.searchTracks('anything');
    expect(results).toEqual([]);
  });

  test('retourne [] si la réponse HTTP n\'est pas ok', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const results = await audioSource.searchTracks('anything');
    expect(results).toEqual([]);
  });
});

describe('ensureDownloaded', () => {
  test('ne fait rien si track a déjà un cachePath', async () => {
    const track = { title: 'A', artist: 'B', cachePath: '/already/here.mp3' };
    const result = await audioSource.ensureDownloaded(track);
    expect(result.cachePath).toBe('/already/here.mp3');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('télécharge via POST /api/download et renseigne cachePath', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ cachePath: '/cache/new-track.mp3', artworkUrl: 'https://cdn.example/art.jpg' }),
    });
    const track = { title: 'Numb', artist: 'Linkin Park' };
    const result = await audioSource.ensureDownloaded(track);
    expect(result.cachePath).toBe('/cache/new-track.mp3');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/download'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('lève une erreur si la réponse ne contient pas de cachePath', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await expect(audioSource.ensureDownloaded({ title: 'X', artist: 'Y' })).rejects.toThrow();
  });

  test('lève une erreur si le serveur répond en erreur', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(audioSource.ensureDownloaded({ title: 'X', artist: 'Y' })).rejects.toThrow();
  });

  test('deux appels concurrents pour la même piste ne déclenchent qu\'un seul POST /api/download', async () => {
    let resolveFetch;
    global.fetch.mockImplementationOnce(() => new Promise((resolve) => { resolveFetch = resolve; }));
    // Titre/artiste uniques à ce test : trackStore est un singleton de module
    // partagé entre tous les tests du fichier (non réinitialisé par
    // beforeEach), donc réutiliser un couple artiste/titre déjà téléchargé
    // par un test précédent court-circuiterait l'appel réseau ici.
    const track = { title: 'Concurrent Track', artist: 'Concurrent Artist' };

    const p1 = audioSource.ensureDownloaded(track);
    const p2 = audioSource.ensureDownloaded(track);
    resolveFetch({ ok: true, json: async () => ({ cachePath: '/cache/concurrent.mp3' }) });
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toBe(track);
    expect(r2).toBe(track);
    expect(track.cachePath).toBe('/cache/concurrent.mp3');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('un appel une fois le cachePath renseigné ne relance aucun appel réseau', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ cachePath: '/cache/repeat.mp3' }) });
    const track = { title: 'Repeat Track', artist: 'Repeat Artist' };
    await audioSource.ensureDownloaded(track);
    await audioSource.ensureDownloaded(track);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('prefetchAudio', () => {
  test('ne fait rien pour un cachePath vide (aucun appel réseau)', async () => {
    await audioSource.prefetchAudio('');
    await audioSource.prefetchAudio(undefined);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('récupère le flux (jsdom n\'a pas Cache Storage, donc toujours cache-miss) sans lever d\'erreur', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });
    await expect(audioSource.prefetchAudio('/cache/track.mp3')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/stream'),
      expect.anything()
    );
  });

  test('avale silencieusement une erreur réseau (best-effort, ne doit jamais rejeter)', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network down'));
    await expect(audioSource.prefetchAudio('/cache/track.mp3')).resolves.toBeUndefined();
  });

  test('avale silencieusement une réponse HTTP en erreur', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(audioSource.prefetchAudio('/cache/track.mp3')).resolves.toBeUndefined();
  });

  test('deux appels concurrents pour le même cachePath ne déclenchent qu\'un seul GET /api/stream', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });

    const p1 = audioSource.prefetchAudio('/cache/concurrent-stream.mp3');
    const p2 = audioSource.prefetchAudio('/cache/concurrent-stream.mp3');
    await Promise.all([p1, p2]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('LocalAudioPlayer', () => {
  test('load() remet getCurrentTime() à 0 immédiatement (avant la résolution async de la nouvelle source), pour ne pas révéler les indices de la piste précédente', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });
    const player = new audioSource.LocalAudioPlayer();
    await player.init();
    player._audio.currentTime = 27; // simule une piste précédente déjà bien avancée (indices révélés)

    const loadPromise = player.load('/cache/next-track.mp3');
    // resolveBlobUrl est async (cache-miss jsdom → fetch mocké) : au moment de
    // cet appel synchrone, la promesse n'est pas encore résolue, donc si
    // load() ne remettait pas currentTime à 0 tout de suite, on lirait
    // encore ici la position de l'ancienne piste.
    expect(player.getCurrentTime()).toBe(0);

    await loadPromise;
  });

  // jsdom n'implémente pas URL.createObjectURL : on le stub pour que
  // resolveBlobUrl() aboutisse et que load() atteigne bien `audio.src`/`play()`
  // (sans ce stub, load() tomberait toujours dans son catch et ces deux
  // lignes ne seraient jamais exécutées, quel que soit `autoplay`).
  test('load() lance la lecture par défaut (autoplay implicite)', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    const player = new audioSource.LocalAudioPlayer();
    await player.init();
    const playSpy = jest.spyOn(player._audio, 'play').mockResolvedValue();

    await player.load('/cache/autoplay-track.mp3');

    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  test('load(key, { autoplay: false }) prépare la piste sans la lancer — c\'est le DJ qui décide quand jouer', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['x']) });
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    const player = new audioSource.LocalAudioPlayer();
    await player.init();
    const playSpy = jest.spyOn(player._audio, 'play').mockResolvedValue();

    await player.load('/cache/manual-track.mp3', { autoplay: false });

    expect(playSpy).not.toHaveBeenCalled();
    expect(player._audio.src).toContain('blob:mock-url');
  });
});
