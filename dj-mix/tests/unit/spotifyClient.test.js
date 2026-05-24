import { normalizeSpotifyPlaylistTracks, parseSpotifyPlaylistId } from '../../lib/spotifyClient.js';

describe('spotifyClient helpers', () => {
  test('parseSpotifyPlaylistId accepte URL, URI et ID brut', () => {
    const id = '37i9dQZF1DX4dyzvuaRJ0n';
    expect(parseSpotifyPlaylistId(id)).toBe(id);
    expect(parseSpotifyPlaylistId(`spotify:playlist:${id}`)).toBe(id);
    expect(parseSpotifyPlaylistId(`https://open.spotify.com/playlist/${id}?si=abc`)).toBe(id);
  });

  test('parseSpotifyPlaylistId retourne vide pour entrée invalide', () => {
    expect(parseSpotifyPlaylistId('')).toBe('');
    expect(parseSpotifyPlaylistId('https://open.spotify.com/album/123')).toBe('');
    expect(parseSpotifyPlaylistId('invalide')).toBe('');
  });

  test('normalizeSpotifyPlaylistTracks déduplique et normalise les pistes', () => {
    const items = [
      {
        track: {
          id: 'trackA',
          uri: 'spotify:track:trackA',
          name: 'Song A',
          duration_ms: 210000,
          artists: [{ name: 'Artist A' }],
          album: { images: [{ url: 'https://img/a.jpg' }] },
        },
      },
      {
        track: {
          id: 'trackA',
          uri: 'spotify:track:trackA',
          name: 'Song A',
          duration_ms: 210000,
          artists: [{ name: 'Artist A' }],
          album: { images: [{ url: 'https://img/a.jpg' }] },
        },
      },
      {
        track: {
          id: 'trackB',
          uri: 'spotify:track:trackB',
          name: 'Song B',
          duration_ms: 180000,
          artists: [{ name: 'Artist B1' }, { name: 'Artist B2' }],
          album: { images: [{ url: 'https://img/b.jpg' }] },
        },
      },
    ];

    expect(normalizeSpotifyPlaylistTracks(items)).toEqual([
      {
        id: 'spotify:trackA',
        spotifyTrackId: 'trackA',
        spotifyUri: 'spotify:track:trackA',
        name: 'Song A',
        artist: 'Artist A',
        artUrl: 'https://img/a.jpg',
        duration: 210000,
        bpm: null,
        genre: '',
        cachePath: '',
        persistedSourceUrl: '',
        ratingKey: '',
        stemsStatus: '',
        stems: null,
        source: 'spotify',
      },
      {
        id: 'spotify:trackB',
        spotifyTrackId: 'trackB',
        spotifyUri: 'spotify:track:trackB',
        name: 'Song B',
        artist: 'Artist B1, Artist B2',
        artUrl: 'https://img/b.jpg',
        duration: 180000,
        bpm: null,
        genre: '',
        cachePath: '',
        persistedSourceUrl: '',
        ratingKey: '',
        stemsStatus: '',
        stems: null,
        source: 'spotify',
      },
    ]);
  });
});
