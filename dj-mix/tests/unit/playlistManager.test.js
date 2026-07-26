import {
  collectCacheFilterOptions,
  extractCacheGenres,
  extractCacheYear,
  filterCacheFiles,
  resolveCacheFileArtUrl,
} from '../../lib/playlistManager.js';

describe('playlistManager cache filters', () => {
  const files = [
    {
      trackName: 'Midnight Echo',
      artistName: 'Nova',
      genres: ['House', 'Dance'],
      releaseDate: '2024-03-10',
      stemsStatus: 'ready',
    },
    {
      trackName: 'Velvet Sky',
      artistName: 'Lune',
      genre: 'Pop',
      metadata: { year: '2023' },
      audioFeatures: { rhythm: 'groove' },
    },
    {
      trackName: 'Archive Cut',
      artistName: 'Cassette',
      primaryGenreName: 'Synthwave',
      year: 2021,
    },
  ];

  test('extracts genres from multiple metadata shapes', () => {
    expect(extractCacheGenres(files[0])).toEqual(['House', 'Dance']);
    expect(extractCacheGenres(files[1])).toEqual(['Pop', 'Rythme: groove']);
  });

  test('extracts a 4-digit year from cache metadata', () => {
    expect(extractCacheYear(files[0])).toBe('2024');
    expect(extractCacheYear(files[1])).toBe('2023');
    expect(extractCacheYear(files[2])).toBe('2021');
  });

  test('collects sorted filter options from cache files', () => {
    expect(collectCacheFilterOptions(files)).toEqual({
      genres: ['Dance', 'House', 'Pop', 'Rythme: groove', 'Synthwave'],
      hasStemmedTracks: true,
      years: ['2024', '2023', '2021'],
    });
  });

  test('filters cache files by query, genre, year and stems', () => {
    expect(filterCacheFiles(files, { query: 'nova' })).toEqual([files[0]]);
    expect(filterCacheFiles(files, { genre: 'Pop' })).toEqual([files[1]]);
    expect(filterCacheFiles(files, { year: '2021' })).toEqual([files[2]]);
    expect(filterCacheFiles(files, { stemsOnly: true })).toEqual([files[0]]);
    expect(filterCacheFiles(files, { query: 'groove', genre: 'Rythme: groove' })).toEqual([files[1]]);
  });
});

describe('resolveCacheFileArtUrl', () => {
  // SPEC-13.3.9 — regression test: GET /api/cache/files can return an
  // artworkUrl still shaped as a bare `/api/artwork?cachePath=...` reference,
  // which must be prefixed with the CDN base URL (+ token) before it's used
  // as an <img src>, or it resolves against the app's own origin and 404s.
  test('prefixes a bare /api/artwork reference with the CDN base URL and token', () => {
    const file = { artworkUrl: '/api/artwork?cachePath=%2Fmnt%2Fart.jpg' };
    expect(resolveCacheFileArtUrl(file, 'http://vision:3002', 'secret'))
      .toBe('http://vision:3002/api/artwork?cachePath=%2Fmnt%2Fart.jpg&token=secret');
  });

  test('leaves an already-absolute artworkUrl (iTunes/Deezer) untouched', () => {
    const file = { artworkUrl: 'https://mzstatic.com/art.jpg' };
    expect(resolveCacheFileArtUrl(file, 'http://vision:3002', 'secret')).toBe('https://mzstatic.com/art.jpg');
  });

  test('falls back to file.artUrl when artworkUrl is absent', () => {
    const file = { artUrl: 'https://cdn.example.com/art.jpg' };
    expect(resolveCacheFileArtUrl(file, 'http://vision:3002', 'secret')).toBe('https://cdn.example.com/art.jpg');
  });

  test('returns empty string when a bare reference cannot be resolved (no CDN URL configured)', () => {
    const file = { artworkUrl: '/api/artwork?cachePath=%2Fmnt%2Fart.jpg' };
    expect(resolveCacheFileArtUrl(file, '', 'secret')).toBe('');
  });
});
