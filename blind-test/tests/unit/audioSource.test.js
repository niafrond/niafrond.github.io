/**
 * audioSource.test.js — Tests unitaires pour blind-test/audioSource.js
 * (fetch mocké ; jsdom fournit un vrai localStorage, remis à zéro à chaque test)
 */

import { jest } from '@jest/globals';
import * as audioSource from '../../audioSource.js';

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
  // apiHealthMonitor est un singleton partagé par tous les tests du fichier (import statique) ;
  // le remettre "en ligne" évite qu'un test précédent (2 échecs consécutifs) ne fasse basculer
  // isOffline() à true pour les tests suivants.
  audioSource.apiHealthMonitor.recordSuccess();
});

afterAll(() => {
  audioSource.apiHealthMonitor.destroy();
});

describe('config API (url/token/CDN)', () => {
  test('URL par défaut si rien en storage', () => {
    expect(audioSource.getDownloaderApiUrl()).toBe('http://vision:3000');
  });

  test('applyBroadcastConfig persiste la config reçue de l\'hôte', () => {
    audioSource.applyBroadcastConfig({ apiUrl: 'http://192.168.1.10:3000', cdnUrl: 'http://192.168.1.10:3002', apiToken: 'tok123' });
    expect(audioSource.getDownloaderApiUrl()).toBe('http://192.168.1.10:3000');
    expect(audioSource.getDownloaderCdnUrl()).toBe('http://192.168.1.10:3002');
    expect(audioSource.getDownloaderApiToken()).toBe('tok123');
  });

  test('applyBroadcastConfig ignore un payload sans apiUrl', () => {
    audioSource.applyBroadcastConfig({});
    expect(audioSource.getDownloaderApiUrl()).toBe('http://vision:3000');
  });

  test('getBroadcastConfig retourne la config courante (URL par défaut incluse)', () => {
    expect(audioSource.getBroadcastConfig()).toEqual({
      apiUrl: 'http://vision:3000',
      cdnUrl: expect.any(String),
      apiToken: '',
    });
  });

  test('getDownloaderCdnUrl dérive du port 3002 si non configurée', () => {
    audioSource.applyBroadcastConfig({ apiUrl: 'http://10.0.0.5:3000' });
    expect(audioSource.getDownloaderCdnUrl()).toBe('http://10.0.0.5:3002');
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
            { name: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, genre: 'Rock', artUrl: 'https://img/x.jpg', cachePath: '' },
          ],
        },
      }),
    });
    const results = await audioSource.searchTracks('bohemian rhapsody queen');
    expect(results).toEqual([
      { title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, genre: 'Rock', artUrl: 'https://img/x.jpg', cachePath: '' },
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
});
