/**
 * themes.test.js — Tests unitaires pour theme-party/themes.js
 * (jsdom fournit un vrai localStorage, remis à zéro à chaque test)
 */

import {
  loadThemes, saveThemes, createTheme, addTrackToTheme, removeTrackFromTheme,
  updateTrackHints, updateTrackReponse, deleteTheme, loadSessionPlayedIds, saveSessionPlayedIds,
  markThemePlayed, resetSession, getEligibleThemesForSession, pickThemeChoices,
  getRemainingPoolThemes, loadSessionPool, saveSessionPool,
  loadSessionScreen, saveSessionScreen, loadCurrentThemeId, saveCurrentThemeId,
  loadCurrentTrackIndex, saveCurrentTrackIndex,
  exportThemeJSON, importThemeJSON, importThemePack, importThemePackJSON, mergeThemePack,
} from '../../themes.js';
import { THEME_TRACK_COUNT, THEME_CHOICE_COUNT } from '../../constants.js';

beforeEach(() => {
  localStorage.clear();
});

function fillWithTracks(theme, count) {
  for (let i = 0; i < count; i++) {
    addTrackToTheme(theme, { title: `Piste ${i}`, artist: `Artiste ${i}` });
  }
  return theme;
}

describe('génération d\'id sans crypto.randomUUID (contexte non sécurisé, ex: http:// sur IP locale)', () => {
  // crypto.randomUUID n'existe que dans un "contexte sécurisé" (HTTPS ou
  // localhost) — cette app tourne typiquement en http:// sur une IP locale
  // (soirée sur le LAN), régression réelle observée en usage.
  let originalRandomUUID;

  beforeEach(() => {
    originalRandomUUID = crypto.randomUUID;
    delete crypto.randomUUID;
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
  });

  test('createTheme génère quand même un id non vide', () => {
    expect(typeof createTheme('Animaux').id).toBe('string');
    expect(createTheme('Animaux').id.length).toBeGreaterThan(0);
  });

  test('addTrackToTheme génère quand même un id non vide', () => {
    const theme = createTheme('Animaux');
    const track = addTrackToTheme(theme, { title: 'X', artist: 'Y' });
    expect(typeof track.id).toBe('string');
    expect(track.id.length).toBeGreaterThan(0);
  });

  test('deux appels successifs ne produisent pas le même id', () => {
    expect(createTheme('A').id).not.toBe(createTheme('B').id);
  });
});

describe('persistance de la bibliothèque', () => {
  test('loadThemes renvoie [] si rien en storage', () => {
    expect(loadThemes()).toEqual([]);
  });

  test('saveThemes puis loadThemes fait un round-trip', () => {
    const theme = createTheme('Animaux');
    saveThemes([theme]);
    const loaded = loadThemes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Animaux');
  });

  test('loadThemes renvoie [] si le JSON stocké est corrompu', () => {
    localStorage.setItem('theme-party:themes', '{not json');
    expect(loadThemes()).toEqual([]);
  });
});

describe('CRUD piste', () => {
  test('addTrackToTheme ajoute une piste avec indices vides', () => {
    const theme = createTheme('Animaux');
    const track = addTrackToTheme(theme, { title: 'Jurassic Park Theme', artist: 'John Williams' });
    expect(theme.tracks).toHaveLength(1);
    expect(track.title).toBe('Jurassic Park Theme');
    expect(track.hint1).toBe('');
    expect(track.hint2).toBe('');
    expect(track.cachePath).toBe('');
  });

  test('addTrackToTheme refuse une 8e piste', () => {
    const theme = fillWithTracks(createTheme('Animaux'), THEME_TRACK_COUNT);
    expect(() => addTrackToTheme(theme, { title: 'Trop', artist: 'X' })).toThrow();
  });

  test('removeTrackFromTheme retire la piste ciblée uniquement', () => {
    const theme = fillWithTracks(createTheme('Animaux'), 3);
    const targetId = theme.tracks[1].id;
    removeTrackFromTheme(theme, targetId);
    expect(theme.tracks).toHaveLength(2);
    expect(theme.tracks.find((t) => t.id === targetId)).toBeUndefined();
  });

  test('updateTrackHints met à jour les 2 indices', () => {
    const theme = fillWithTracks(createTheme('Animaux'), 1);
    const trackId = theme.tracks[0].id;
    updateTrackHints(theme, trackId, { hint1: 'Chanteur', hint2: 'Surnom' });
    expect(theme.tracks[0].hint1).toBe('Chanteur');
    expect(theme.tracks[0].hint2).toBe('Surnom');
  });

  test('updateTrackHints renvoie null si la piste est introuvable', () => {
    const theme = createTheme('Animaux');
    expect(updateTrackHints(theme, 'inconnu', { hint1: 'x' })).toBeNull();
  });

  test('updateTrackReponse met à jour la réponse attendue', () => {
    const theme = fillWithTracks(createTheme('Animaux'), 1);
    const trackId = theme.tracks[0].id;
    updateTrackReponse(theme, trackId, 'chien');
    expect(theme.tracks[0].reponse).toBe('chien');
  });

  test('updateTrackReponse renvoie null si la piste est introuvable', () => {
    const theme = createTheme('Animaux');
    expect(updateTrackReponse(theme, 'inconnu', 'chien')).toBeNull();
  });

  test('createTheme accepte une consigne optionnelle', () => {
    expect(createTheme('Animaux').consigne).toBe('');
    expect(createTheme('Animaux', 'Trouve la créature').consigne).toBe('Trouve la créature');
  });

  test('deleteTheme est pur et renvoie une nouvelle liste', () => {
    const a = createTheme('A');
    const b = createTheme('B');
    const result = deleteTheme([a, b], a.id);
    expect(result).toEqual([b]);
    expect([a, b]).toHaveLength(2); // liste d'origine inchangée
  });
});

describe('session : thèmes déjà joués', () => {
  test('loadSessionPlayedIds renvoie [] par défaut', () => {
    expect(loadSessionPlayedIds()).toEqual([]);
  });

  test('markThemePlayed est pur, dédupliqué', () => {
    const ids = markThemePlayed([], 'theme-1');
    expect(ids).toEqual(['theme-1']);
    const again = markThemePlayed(ids, 'theme-1');
    expect(again).toEqual(['theme-1']);
    expect(again).toBe(ids); // déjà présent → même référence renvoyée, pas de nouvelle allocation
  });

  test('saveSessionPlayedIds puis loadSessionPlayedIds fait un round-trip', () => {
    saveSessionPlayedIds(['a', 'b']);
    expect(loadSessionPlayedIds()).toEqual(['a', 'b']);
  });

  test('resetSession efface toute la progression (played, pool, écran, thème/piste en cours)', () => {
    saveSessionPlayedIds(['a']);
    saveSessionPool(['a', 'b']);
    saveSessionScreen('screen-round');
    saveCurrentThemeId('a');
    saveCurrentTrackIndex(3);

    resetSession();

    expect(loadSessionPlayedIds()).toEqual([]);
    expect(loadSessionPool()).toEqual([]);
    expect(loadSessionScreen()).toBeNull();
    expect(loadCurrentThemeId()).toBeNull();
    expect(loadCurrentTrackIndex()).toBe(0);
  });
});

describe('persistance de l\'écran/progression courante (résiste à un rechargement)', () => {
  test('loadSessionPool renvoie [] par défaut, round-trip sinon', () => {
    expect(loadSessionPool()).toEqual([]);
    saveSessionPool(['t1', 't2', 't3']);
    expect(loadSessionPool()).toEqual(['t1', 't2', 't3']);
  });

  test('loadSessionScreen renvoie null par défaut, round-trip sinon', () => {
    expect(loadSessionScreen()).toBeNull();
    saveSessionScreen('screen-round');
    expect(loadSessionScreen()).toBe('screen-round');
  });

  test('loadCurrentThemeId renvoie null par défaut, round-trip sinon', () => {
    expect(loadCurrentThemeId()).toBeNull();
    saveCurrentThemeId('theme-42');
    expect(loadCurrentThemeId()).toBe('theme-42');
  });

  test('loadCurrentTrackIndex renvoie 0 par défaut, round-trip sinon', () => {
    expect(loadCurrentTrackIndex()).toBe(0);
    saveCurrentTrackIndex(4);
    expect(loadCurrentTrackIndex()).toBe(4);
  });
});

describe('getRemainingPoolThemes', () => {
  test('renvoie les thèmes du pool dans leur ordre de tirage, en excluant les joués', () => {
    const a = createTheme('A');
    const b = createTheme('B');
    const c = createTheme('C');
    const remaining = getRemainingPoolThemes([a, b, c], [b.id, a.id, c.id], [a.id]);
    expect(remaining.map((t) => t.id)).toEqual([b.id, c.id]);
  });

  test('renvoie [] si le pool est entièrement joué', () => {
    const a = createTheme('A');
    expect(getRemainingPoolThemes([a], [a.id], [a.id])).toEqual([]);
  });

  test('ignore un id du pool qui ne correspond plus à aucun thème de la bibliothèque', () => {
    const a = createTheme('A');
    expect(getRemainingPoolThemes([a], [a.id, 'supprime'], [])).toEqual([a]);
  });
});

describe('getEligibleThemesForSession', () => {
  test('exclut les thèmes incomplets', () => {
    const complete = fillWithTracks(createTheme('Complet'), THEME_TRACK_COUNT);
    const incomplete = fillWithTracks(createTheme('Incomplet'), 3);
    const eligible = getEligibleThemesForSession([complete, incomplete], []);
    expect(eligible).toEqual([complete]);
  });

  test('exclut les thèmes déjà joués cette session', () => {
    const a = fillWithTracks(createTheme('A'), THEME_TRACK_COUNT);
    const b = fillWithTracks(createTheme('B'), THEME_TRACK_COUNT);
    const eligible = getEligibleThemesForSession([a, b], [a.id]);
    expect(eligible).toEqual([b]);
  });
});

describe('pickThemeChoices', () => {
  test('renvoie [] pour un pool vide', () => {
    expect(pickThemeChoices([])).toEqual([]);
  });

  test('renvoie tous les éléments si le pool est plus petit que count', () => {
    const pool = [createTheme('A'), createTheme('B')];
    const result = pickThemeChoices(pool, THEME_CHOICE_COUNT);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id).sort()).toEqual(pool.map((t) => t.id).sort());
  });

  test('renvoie exactement count éléments si le pool est plus grand', () => {
    const pool = Array.from({ length: 10 }, (_, i) => createTheme(`Thème ${i}`));
    const result = pickThemeChoices(pool, THEME_CHOICE_COUNT);
    expect(result).toHaveLength(THEME_CHOICE_COUNT);
    const ids = new Set(result.map((t) => t.id));
    expect(ids.size).toBe(THEME_CHOICE_COUNT); // pas de doublons
  });

  test('utilise THEME_CHOICE_COUNT par défaut', () => {
    const pool = Array.from({ length: 10 }, (_, i) => createTheme(`Thème ${i}`));
    expect(pickThemeChoices(pool)).toHaveLength(THEME_CHOICE_COUNT);
  });
});

describe('export / import JSON', () => {
  test('round-trip : mêmes pistes/indices/réponse/consigne, cachePath/artUrl vidés, id régénérés', () => {
    const theme = fillWithTracks(createTheme('Animaux', 'Trouve la créature'), 2);
    updateTrackHints(theme, theme.tracks[0].id, { hint1: 'Chanteur', hint2: 'Surnom' });
    updateTrackReponse(theme, theme.tracks[0].id, 'chien');
    theme.tracks[0].cachePath = '/cache/should-be-stripped.mp3';

    const json = exportThemeJSON(theme);
    const reimported = importThemeJSON(json);

    expect(reimported.name).toBe('Animaux');
    expect(reimported.consigne).toBe('Trouve la créature');
    expect(reimported.id).not.toBe(theme.id);
    expect(reimported.tracks).toHaveLength(2);
    expect(reimported.tracks[0].title).toBe(theme.tracks[0].title);
    expect(reimported.tracks[0].hint1).toBe('Chanteur');
    expect(reimported.tracks[0].hint2).toBe('Surnom');
    expect(reimported.tracks[0].reponse).toBe('chien');
    expect(reimported.tracks[0].cachePath).toBe('');
    expect(reimported.tracks[0].id).not.toBe(theme.tracks[0].id);
  });

  test('importThemeJSON lève une erreur sur un JSON invalide', () => {
    expect(() => importThemeJSON('{not json')).toThrow();
  });

  test('importThemeJSON lève une erreur sur un format inattendu', () => {
    expect(() => importThemeJSON(JSON.stringify({ foo: 'bar' }))).toThrow();
  });

  test('importThemeJSON ignore les pistes sans titre', () => {
    const json = JSON.stringify({ name: 'X', tracks: [{ title: '' }, { title: 'Valide', artist: 'Y' }] });
    const theme = importThemeJSON(json);
    expect(theme.tracks).toHaveLength(1);
    expect(theme.tracks[0].title).toBe('Valide');
  });
});

describe('import d\'un pack de thèmes (/themes.json)', () => {
  const samplePack = {
    themes: [
      {
        theme: 'Creatures',
        consigne: 'Il faut donner le nom de la créature cachée dans le titre',
        chansons: [
          { titre: 'Chihuahua', artiste: 'DJ BoBo', indice1: 'DJ suisse vedette de l\'eurodance', indice2: 'Un tube dance sur un animal minuscule', reponse: 'chien' },
          { titre: 'Barracuda', artiste: 'Heart', indice1: 'Groupe de rock américain', indice2: 'Un riff de guitare puissant des années 70', reponse: 'poisson (barracuda)' },
        ],
      },
      {
        theme: 'Sans consigne ni réponse',
        chansons: [{ titre: 'Un titre' }],
      },
    ],
  };

  test('importThemePack mappe theme→name, consigne→consigne, titre/artiste→title/artist, hint1=indice1, hint2=indice2 (jamais titre/artiste)', () => {
    const [creatures] = importThemePack(samplePack);
    expect(creatures.name).toBe('Creatures');
    expect(creatures.consigne).toBe('Il faut donner le nom de la créature cachée dans le titre');
    expect(creatures.tracks).toHaveLength(2);
    expect(creatures.tracks[0]).toMatchObject({
      title: 'Chihuahua',
      artist: 'DJ BoBo',
      hint1: 'DJ suisse vedette de l\'eurodance',
      hint2: 'Un tube dance sur un animal minuscule',
      reponse: 'chien',
      cachePath: '',
    });
  });

  test('importThemePack tolère un thème sans consigne/réponse (valeurs vides)', () => {
    const [, sansConsigne] = importThemePack(samplePack);
    expect(sansConsigne.consigne).toBe('');
    expect(sansConsigne.tracks[0].artist).toBe('?');
    expect(sansConsigne.tracks[0].reponse).toBe('');
  });

  test('importThemePack lève une erreur si le format ne contient pas de tableau themes', () => {
    expect(() => importThemePack({})).toThrow();
    expect(() => importThemePack(null)).toThrow();
  });

  test('importThemePackJSON parse puis délègue à importThemePack', () => {
    const themes = importThemePackJSON(JSON.stringify(samplePack));
    expect(themes).toHaveLength(2);
    expect(themes[0].name).toBe('Creatures');
  });

  test('importThemePackJSON lève une erreur sur un JSON invalide', () => {
    expect(() => importThemePackJSON('{not json')).toThrow();
  });
});

describe('mergeThemePack', () => {
  test('ajoute les thèmes dont le nom n\'existe pas déjà (insensible à la casse)', () => {
    const existing = [createTheme('Animaux')];
    const incoming = [createTheme('ANIMAUX'), createTheme('Films')];
    const { merged, addedCount, skippedCount } = mergeThemePack(existing, incoming);
    expect(merged.map((t) => t.name)).toEqual(['Animaux', 'Films']);
    expect(addedCount).toBe(1);
    expect(skippedCount).toBe(1);
  });

  test('bibliothèque vide : tout est ajouté', () => {
    const incoming = [createTheme('A'), createTheme('B')];
    const { merged, addedCount, skippedCount } = mergeThemePack([], incoming);
    expect(merged).toHaveLength(2);
    expect(addedCount).toBe(2);
    expect(skippedCount).toBe(0);
  });
});
