import { describe, expect, test } from '@jest/globals';
import { isLocalTrackResult } from '../../lib/searchUtils.js';

// Couvre la détection utilisée pour la pastille "disponible localement" du
// relais léger (relay.js `_renderSearchResults`, SPEC-9.7.2) et déjà réutilisée
// côté maître (lib/searchUtils.js#buildResultHTML, `.result-local-badge`).
describe('isLocalTrackResult', () => {
  test('renvoie false pour une valeur non-objet', () => {
    expect(isLocalTrackResult(null)).toBe(false);
    expect(isLocalTrackResult(undefined)).toBe(false);
  });

  test('détecte `cached: true` (forme renvoyée par /api/search pour un morceau en cache)', () => {
    expect(isLocalTrackResult({ cached: true, isLocal: true })).toBe(true);
  });

  test('détecte `isLocal: true` seul', () => {
    expect(isLocalTrackResult({ isLocal: true })).toBe(true);
  });

  test("renvoie false pour un résultat purement distant (URL iTunes, pas de flag local)", () => {
    expect(isLocalTrackResult({ artworkUrl: 'https://is1-ssl.mzstatic.com/x.jpg' })).toBe(false);
  });

  test('détecte les variantes texte ("local", "cached", "disk", "file")', () => {
    expect(isLocalTrackResult({ source: 'local' })).toBe(true);
    expect(isLocalTrackResult({ sourceType: 'cached' })).toBe(true);
    expect(isLocalTrackResult({ storage: 'disk' })).toBe(true);
    expect(isLocalTrackResult({ location: 'file' })).toBe(true);
  });

  test('ignore un champ booléen à false', () => {
    expect(isLocalTrackResult({ isLocal: false, local: false })).toBe(false);
  });
});
