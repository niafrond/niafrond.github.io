import {
  collectCacheFilterOptions,
  extractCacheGenres,
  extractCacheYear,
  filterCacheFiles,
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
