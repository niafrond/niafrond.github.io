/**
 * playlist.test.js — Tests unitaires pour blind-test/playlist.js
 * (fonctions pures uniquement — pas de fetch réseau, localStorage mocké)
 *
 * Note : lookupSongMetadata/fetchArtistAlternatives/enrichWithMusicMetadata
 * appellent audioSource.searchTracks (réseau) et ne sont volontairement pas
 * couverts ici, comme c'était déjà le cas pour l'équivalent iTunes avant ce
 * refactor.
 */

import {
  extractPlaylistId,
  addSong,
  removeSong,
  moveSong,
  shufflePlaylist,
  generateFourChoices,
  mergeSongs,
  exportPlaylistJSON,
  importPlaylistJSON,
} from '../../playlist.js';

// ─── extractPlaylistId ───────────────────────────────────────────────────────

describe('extractPlaylistId', () => {
  test('retourne null pour une entrée vide', () => {
    expect(extractPlaylistId('')).toBeNull();
    expect(extractPlaylistId(null)).toBeNull();
  });

  test('extrait depuis ?list=', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-'))
      .toBe('PLrEnWoR732-BHrPp_Pm8_VleD68f9s14-');
  });

  test('extrait depuis watch?v=...&list=', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=abc&list=PLABCD')).toBe('PLABCD');
  });

  test('retourne null si pas de paramètre list', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=abc')).toBeNull();
  });
});

// ─── addSong ─────────────────────────────────────────────────────────────────

// Mock localStorage pour les fonctions qui en ont besoin
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

beforeAll(() => {
  global.localStorage = localStorageMock;
  // crypto.randomUUID mock
  if (!global.crypto) global.crypto = {};
  if (!global.crypto.randomUUID) global.crypto.randomUUID = () => 'test-uuid-' + Math.random();
});

beforeEach(() => localStorageMock.clear());

describe('addSong', () => {
  test('ajoute une chanson avec les métadonnées fournies', () => {
    const updated = addSong([], {
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      year: 1987,
      genre: 'Pop',
    });
    expect(updated.length).toBe(1);
    expect(updated[0].title).toBe('Never Gonna Give You Up');
    expect(updated[0].artist).toBe('Rick Astley');
    expect(updated[0].year).toBe(1987);
    expect(updated[0]).not.toHaveProperty('videoId');
  });

  test('lève une erreur si le titre est vide', () => {
    expect(() => addSong([], { title: '', artist: 'A' })).toThrow();
  });

  test('utilise une valeur par défaut si artist est absent', () => {
    const updated = addSong([], { title: 'Some Track' });
    expect(updated[0].artist).toBe('?');
  });

  test('conserve cachePath/artUrl si fournis (résultat de recherche déjà résolu)', () => {
    const updated = addSong([], { title: 'T', artist: 'A', cachePath: '/cache/x.mp3', artUrl: 'https://img/x.jpg' });
    expect(updated[0].cachePath).toBe('/cache/x.mp3');
    expect(updated[0].artUrl).toBe('https://img/x.jpg');
  });
});

// ─── removeSong ──────────────────────────────────────────────────────────────

describe('removeSong', () => {
  test('supprime la chanson avec l\'id donné', () => {
    const songs = [
      { id: '1', title: 'A', artist: 'X' },
      { id: '2', title: 'B', artist: 'Y' },
    ];
    const updated = removeSong(songs, '1');
    expect(updated.length).toBe(1);
    expect(updated[0].id).toBe('2');
  });

  test('ne modifie pas si l\'id est introuvable', () => {
    const songs = [{ id: '1', title: 'A', artist: 'X' }];
    const updated = removeSong(songs, 'unknown');
    expect(updated.length).toBe(1);
  });
});

// ─── moveSong ────────────────────────────────────────────────────────────────

describe('moveSong', () => {
  const songs = [
    { id: '1', title: 'A', artist: 'X' },
    { id: '2', title: 'B', artist: 'Y' },
    { id: '3', title: 'C', artist: 'Z' },
  ];

  test('déplace vers le haut', () => {
    const updated = moveSong(songs, '2', 'up');
    expect(updated[0].id).toBe('2');
    expect(updated[1].id).toBe('1');
  });

  test('déplace vers le bas', () => {
    const updated = moveSong(songs, '2', 'down');
    expect(updated[1].id).toBe('3');
    expect(updated[2].id).toBe('2');
  });

  test('ne déplace pas si déjà en tête et direction up', () => {
    const updated = moveSong(songs, '1', 'up');
    expect(updated[0].id).toBe('1');
  });

  test('ne déplace pas si déjà en queue et direction down', () => {
    const updated = moveSong(songs, '3', 'down');
    expect(updated[2].id).toBe('3');
  });

  test('retourne le tableau inchangé si l\'id est introuvable', () => {
    const updated = moveSong(songs, 'x', 'up');
    expect(updated).toEqual(songs);
  });
});

// ─── shufflePlaylist ─────────────────────────────────────────────────────────

describe('shufflePlaylist', () => {
  test('retourne un tableau de même longueur', () => {
    const songs = [1, 2, 3, 4, 5].map(i => ({ id: String(i), title: `T${i}`, artist: 'A' }));
    expect(shufflePlaylist(songs).length).toBe(5);
  });

  test('contient les mêmes éléments', () => {
    const songs = [1, 2, 3].map(i => ({ id: String(i), title: `T${i}`, artist: 'A' }));
    const shuffled = shufflePlaylist(songs);
    const ids = shuffled.map(s => s.id).sort();
    expect(ids).toEqual(['1', '2', '3']);
  });

  test('ne modifie pas le tableau source', () => {
    const songs = [{ id: '1', title: 'T', artist: 'A' }];
    const first = songs[0];
    shufflePlaylist(songs);
    expect(songs[0]).toBe(first);
  });
});

// ─── generateFourChoices ─────────────────────────────────────────────────────

describe('generateFourChoices', () => {
  function makeSong(id, title, artist) {
    return { id, title, artist, alternatives: [] };
  }

  const playlist = [
    makeSong('1', 'Song A', 'Artist A'),
    makeSong('2', 'Song B', 'Artist B'),
    makeSong('3', 'Song C', 'Artist C'),
    makeSong('4', 'Song D', 'Artist D'),
    makeSong('5', 'Song E', 'Artist E'),
  ];

  test('retourne exactement 4 choix', () => {
    const choices = generateFourChoices(playlist[0], playlist);
    expect(choices.length).toBe(4);
  });

  test('la bonne réponse est incluse', () => {
    const current = playlist[0];
    const choices = generateFourChoices(current, playlist);
    expect(choices).toContain(`${current.title} — ${current.artist}`);
  });

  test('pas de doublons parmi les 4 choix', () => {
    const choices = generateFourChoices(playlist[0], playlist);
    expect(new Set(choices).size).toBe(4);
  });

  test('la bonne réponse n\'est présente qu\'une seule fois', () => {
    const current = playlist[0];
    const correct = `${current.title} — ${current.artist}`;
    const choices = generateFourChoices(current, playlist);
    expect(choices.filter(c => c === correct).length).toBe(1);
  });
});

// ─── mergeSongs ──────────────────────────────────────────────────────────────

describe('mergeSongs', () => {
  test('ajoute les nouvelles chansons', () => {
    const existing = [{ id: '1', title: 'A', artist: 'X', alternatives: [] }];
    const imported = [{ title: 'B', artist: 'Y' }];
    const { updated, added, skipped } = mergeSongs(existing, imported);
    expect(updated.length).toBe(2);
    expect(added).toBe(1);
    expect(skipped).toBe(0);
  });

  test('déduplique par titre+artiste (insensible à la casse)', () => {
    const existing = [{ id: '1', title: 'A Song', artist: 'X Artist', alternatives: [] }];
    const imported = [{ title: 'a song', artist: 'x artist' }];
    const { updated, added, skipped } = mergeSongs(existing, imported);
    expect(updated.length).toBe(1);
    expect(added).toBe(0);
    expect(skipped).toBe(1);
  });
});

// ─── exportPlaylistJSON / importPlaylistJSON ─────────────────────────────────

describe('exportPlaylistJSON / importPlaylistJSON', () => {
  const songs = [
    { id: '1', title: 'Song A', artist: 'Artist A', year: 2020, genre: 'Pop', alternatives: [], cachePath: '/cache/a.mp3', artUrl: 'https://img/a.jpg' },
    { id: '2', title: 'Song B', artist: 'Artist B', year: null, genre: null, alternatives: [] },
  ];

  test('export produit un JSON valide', () => {
    const json = exportPlaylistJSON(songs);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('export ne contient pas cachePath/artUrl (propres au serveur de l\'hôte)', () => {
    const json = exportPlaylistJSON(songs);
    const parsed = JSON.parse(json);
    expect(parsed[0]).not.toHaveProperty('cachePath');
    expect(parsed[0]).not.toHaveProperty('artUrl');
  });

  test('import récupère les mêmes chansons', () => {
    const json = exportPlaylistJSON(songs);
    const imported = importPlaylistJSON(json);
    expect(imported.length).toBe(2);
    expect(imported[0].title).toBe('Song A');
    expect(imported[1].title).toBe('Song B');
  });

  test('import filtre les chansons sans titre', () => {
    const json = JSON.stringify([
      { title: 'A', artist: 'B' },
      { artist: 'C' },
    ]);
    const imported = importPlaylistJSON(json);
    expect(imported.length).toBe(1);
  });

  test('import lève une erreur pour un JSON invalide', () => {
    expect(() => importPlaylistJSON('not json')).toThrow();
  });

  test('import lève une erreur si le JSON n\'est pas un tableau', () => {
    expect(() => importPlaylistJSON(JSON.stringify({ foo: 'bar' }))).toThrow();
  });
});
