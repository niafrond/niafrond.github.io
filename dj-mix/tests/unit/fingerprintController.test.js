import { describe, test, expect } from '@jest/globals';
import {
  parseFingerprintCheckResponse,
  buildFingerprintCorrectRequestBody,
  buildFingerprintCorrectToastMessage,
} from '../../lib/fingerprintController.js';

// SPEC-18.1.1 / SPEC-18.1.2
describe('SPEC-18.1.1/2 — parseFingerprintCheckResponse: matched', () => {
  test('reads data.matched (not data.match)', () => {
    expect(parseFingerprintCheckResponse({ matched: true })).toEqual({ matched: true, suggestions: [] });
  });

  test('data.match is ignored (legacy field no longer used)', () => {
    expect(parseFingerprintCheckResponse({ match: true, matched: false })).toEqual({
      matched: false,
      suggestions: [],
    });
  });
});

// SPEC-18.1.3
describe('SPEC-18.1.3 — parseFingerprintCheckResponse: single suggestion', () => {
  test('builds a one-item suggestion list from suggestedTrackName/suggestedArtistName', () => {
    const result = parseFingerprintCheckResponse({
      matched: false,
      suggestedTrackName: 'Correct Title',
      suggestedArtistName: 'Correct Artist',
      score: 87,
      reason: 'acoustid_low_confidence',
    });
    expect(result.matched).toBe(false);
    expect(result.suggestions).toEqual([
      { trackName: 'Correct Title', artistName: 'Correct Artist', score: 87, reason: 'acoustid_low_confidence' },
    ]);
  });

  test('returns no suggestions when suggestedTrackName is absent', () => {
    const result = parseFingerprintCheckResponse({ matched: false });
    expect(result.suggestions).toEqual([]);
  });
});

// SPEC-18.1.4
describe('SPEC-18.1.4 — buildFingerprintCorrectRequestBody', () => {
  test('sends only trackName/artistName in replacement (no id/artUrl/duration_ms/uri/downloadUrl)', () => {
    const body = buildFingerprintCorrectRequestBody(
      { trackName: 'Ref Title', artistName: 'Ref Artist' },
      { trackName: 'New Title', artistName: 'New Artist', downloadUrl: 'https://youtube.com/x', id: '123' },
    );
    expect(body).toEqual({
      artistName: 'Ref Artist',
      trackName: 'Ref Title',
      replacement: { trackName: 'New Title', artistName: 'New Artist' },
    });
  });

  test('falls back to name/title/artist when trackName/artistName are absent on the suggestion', () => {
    const body = buildFingerprintCorrectRequestBody(
      { trackName: 'Ref', artistName: 'RefArtist' },
      { name: 'Legacy Name', artist: 'Legacy Artist' },
    );
    expect(body.replacement).toEqual({ trackName: 'Legacy Name', artistName: 'Legacy Artist' });
  });
});

// SPEC-18.1.5
describe('SPEC-18.1.5 — buildFingerprintCorrectToastMessage', () => {
  test('renamed=true yields a rename-confirmation message', () => {
    expect(buildFingerprintCorrectToastMessage({ corrected: true, renamed: true })).toBe('Titre corrigé et renommé');
  });

  test('corrected=true, renamed=false yields a metadata-only message', () => {
    expect(buildFingerprintCorrectToastMessage({ corrected: true, renamed: false })).toBe('Correction enregistrée');
  });

  test('corrected=false yields a failure message', () => {
    expect(buildFingerprintCorrectToastMessage({ corrected: false })).toBe('Correction non appliquée');
  });
});
