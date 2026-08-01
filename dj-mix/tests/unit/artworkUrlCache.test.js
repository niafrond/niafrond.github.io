import { beforeEach, describe, expect, test } from '@jest/globals';
import { getArtworkUrl, setArtworkUrl } from '../../lib/artworkUrlCache.js';

// Couvre le mécanisme de repli utilisé par buildRelayStateSnapshot() (main.js,
// SPEC-9.3.4.1) : quand `item.artUrl` a été réécrit en blob: local côté maître,
// l'état diffusé au relais retombe sur la dernière URL distante connue pour ce
// titre, mémorisée ici par nom+artiste.
describe('artworkUrlCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('getArtworkUrl renvoie null pour un morceau inconnu', () => {
    expect(getArtworkUrl('Inconnu', 'Personne')).toBeNull();
  });

  test('setArtworkUrl puis getArtworkUrl renvoie la même URL', () => {
    setArtworkUrl('Track', 'Artist', 'https://cdn.example/art.jpg');
    expect(getArtworkUrl('Track', 'Artist')).toBe('https://cdn.example/art.jpg');
  });

  test("la casse et les espaces n'affectent pas la correspondance nom+artiste", () => {
    setArtworkUrl('My Track', 'The Artist', 'https://cdn.example/a.jpg');
    expect(getArtworkUrl('  MY TRACK  ', '  the artist  ')).toBe('https://cdn.example/a.jpg');
  });

  test('setArtworkUrl ne fait rien sans name ni url', () => {
    // Le cache est un singleton en mémoire (non réinitialisé par
    // localStorage.clear() entre les tests) — utiliser des noms uniques pour
    // ne pas dépendre de l'état laissé par les autres tests de ce fichier.
    setArtworkUrl('', 'No-op Artist', 'https://cdn.example/noop-a.jpg');
    setArtworkUrl('No-op Track', 'No-op Artist', '');
    expect(getArtworkUrl('No-op Track', 'No-op Artist')).toBeNull();
    expect(getArtworkUrl('', 'No-op Artist')).toBeNull();
  });

  test('des morceaux différents (nom ou artiste) ne se collisionnent pas', () => {
    setArtworkUrl('Track', 'Artist A', 'https://cdn.example/a.jpg');
    setArtworkUrl('Track', 'Artist B', 'https://cdn.example/b.jpg');
    setArtworkUrl('Other Track', 'Artist A', 'https://cdn.example/c.jpg');
    expect(getArtworkUrl('Track', 'Artist A')).toBe('https://cdn.example/a.jpg');
    expect(getArtworkUrl('Track', 'Artist B')).toBe('https://cdn.example/b.jpg');
    expect(getArtworkUrl('Other Track', 'Artist A')).toBe('https://cdn.example/c.jpg');
  });

  test('une URL blob: locale peut être retrouvée en repli après avoir été mémorisée en tant que distante', () => {
    // Simule buildRelayStateSnapshot() : item.artUrl vaut désormais blob:... côté
    // maître, mais la dernière URL distante connue reste accessible via le cache.
    setArtworkUrl('Fresh Song', 'New Artist', 'https://itunes.example/fresh.jpg');
    const masterArtUrl = 'blob:https://app.local/aaaa-bbbb'; // écrasé localement, inutilisable par le relais
    expect(masterArtUrl.startsWith('blob:')).toBe(true);
    expect(getArtworkUrl('Fresh Song', 'New Artist')).toBe('https://itunes.example/fresh.jpg');
  });
});
