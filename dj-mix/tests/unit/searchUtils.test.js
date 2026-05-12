import {
  buildSearchResultsSectionsHTML,
  getTrackDurationMs,
  mapApiTrackToSearchItem,
  normalizeApiSearchResponse,
  sortSearchResultsByPopularity,
  splitItunesSearchQuery,
} from '../../lib/searchUtils.js';

describe('dj-mix searchUtils', () => {
  test('splitItunesSearchQuery cleans noisy search text', () => {
    expect(splitItunesSearchQuery('Daft Punk - One More Time (Official Video) feat. Pharrell')).toEqual({
      artist: 'Daft Punk',
      title: 'One More Time',
    });
  });

  test('normalizeApiSearchResponse flattens nested track collections and skips artist-only entries', () => {
    const items = normalizeApiSearchResponse({
      results: [
        { type: 'artist', name: 'Justice' },
        {
          tracks: {
            results: [
              { title: 'Genesis', artistName: 'Justice' },
              { trackName: 'D.A.N.C.E.', artistName: 'Justice' },
            ],
          },
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title || item.trackName)).toEqual(['Genesis', 'D.A.N.C.E.']);
  });

  test('mapApiTrackToSearchItem preserves local metadata and parses duration', () => {
    const mapped = mapApiTrackToSearchItem({
      id: 'track-1',
      title: 'Strobe',
      artistName: 'deadmau5',
      cached: true,
      duration: '10:37',
      cachePath: '/cache/strobe.mp3',
      artworkUrl100: 'https://img.example/strobe.jpg',
      loudness: '-8.5 dB',
      popularity: 88,
      downloadUrl: 'https://api.example/cache/strobe.mp3',
    });

    expect(mapped).toMatchObject({
      id: 'track-1',
      name: 'Strobe',
      artist: 'deadmau5',
      isLocalResult: true,
      cachePath: '/cache/strobe.mp3',
      duration_ms: 637000,
      loudnessDb: -8.5,
      popularityScore: 88,
    });
  });

  test('sortSearchResultsByPopularity puts local songs before remote artists', () => {
    const ranked = [
      { name: 'Artist only', isLocalResult: false, isArtistResult: true, popularityScore: 999 },
      { name: 'Remote song', isLocalResult: false, isArtistResult: false, popularityScore: 50 },
      { name: 'Local song', isLocalResult: true, isArtistResult: false, popularityScore: 1 },
    ].sort(sortSearchResultsByPopularity);

    expect(ranked.map((item) => item.name)).toEqual(['Local song', 'Remote song', 'Artist only']);
  });

  test('buildSearchResultsSectionsHTML escapes HTML in rendered labels', () => {
    const html = buildSearchResultsSectionsHTML([
      {
        name: '<Track>',
        artist: 'A & B',
        artists: [{ name: 'A & B' }],
        duration_ms: 90000,
        isLocalResult: false,
        isArtistResult: false,
        artUrl: 'https://img.example/track.jpg',
      },
    ], []);

    expect(html).toContain('&lt;Track&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('1:30');
  });

  test('getTrackDurationMs handles ISO and colon formats', () => {
    expect(getTrackDurationMs({ duration: 'PT3M5S' })).toBe(185000);
    expect(getTrackDurationMs({ duration: '4:12' })).toBe(252000);
  });
});
