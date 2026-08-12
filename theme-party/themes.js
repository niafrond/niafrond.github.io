// ============================================================
// theme-party/themes.js — Modèle de données Thème/Piste
//
// Un Thème = { id, name, consigne, tracks: Track[], createdAt }
// Une Piste = { id, title, artist, cachePath, artUrl, hint1, hint2, reponse }
//   - cachePath/artUrl sont résolus à la volée (ensureDownloaded, voir
//     audioSource.js) et ne sont jamais persistés à l'export (comme
//     blind-test/playlist.js) : ils sont host-spécifiques.
//   - consigne = la règle du thème ("il faut donner le nom de la créature
//     cachée dans le titre"), affichée sur l'écran de manche.
//   - reponse = la réponse thématique attendue (ex: "chien"), distincte du
//     titre/artiste de la piste — c'est elle qu'affiche "Dévoiler réponse"
//     quand elle existe (sinon on retombe sur titre — artiste).
//   - hint1/hint2 sont les 2 indices révélés progressivement (10s/20s) ;
//     ce ne doit jamais être le titre ou l'artiste exact (ça spoilerait la
//     réponse) — pour un pack importé (voir importThemePack) ils viennent
//     des indice1/indice2 du pack, et restent librement éditables ensuite.
//
// Un thème n'est proposé au picker que s'il compte exactement
// THEME_TRACK_COUNT pistes (un Set complet de 7 extraits).
// ============================================================

import { THEME_TRACK_COUNT, THEME_CHOICE_COUNT } from './constants.js';

const THEMES_KEY = 'theme-party:themes';
const SESSION_PLAYED_KEY = 'theme-party:session:played-theme-ids';
const SESSION_POOL_KEY = 'theme-party:session:pool';
const SESSION_SCREEN_KEY = 'theme-party:session:screen';
const SESSION_CURRENT_THEME_KEY = 'theme-party:session:current-theme-id';
const SESSION_CURRENT_TRACK_INDEX_KEY = 'theme-party:session:current-track-index';

// crypto.randomUUID() n'existe que dans un "contexte sécurisé" (HTTPS ou
// localhost). Cette app tourne typiquement en http:// sur une IP locale
// (soirée sur le LAN, pas de HTTPS) où crypto.randomUUID est absent (mais
// `crypto` lui-même existe) — d'où ce repli plutôt qu'un throw silencieux
// à la création du 1er thème.
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Persistance de la bibliothèque de thèmes ────────────────────────────────

export function loadThemes() {
  try {
    const raw = localStorage.getItem(THEMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveThemes(themes) {
  try {
    localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
  } catch (_) {
    // quota / navigation privée
  }
}

// ─── CRUD thème/piste ─────────────────────────────────────────────────────────

export function createTheme(name, consigne = '') {
  return {
    id: generateId(),
    name: String(name || '').trim(),
    consigne: String(consigne || '').trim(),
    tracks: [],
    createdAt: Date.now(),
  };
}

/** Ajoute une piste au thème (max THEME_TRACK_COUNT). Mute et renvoie la piste créée. */
export function addTrackToTheme(theme, { title, artist, hint1 = '', hint2 = '', reponse = '' } = {}) {
  if (theme.tracks.length >= THEME_TRACK_COUNT) {
    throw new Error(`Thème complet (${THEME_TRACK_COUNT} pistes maximum)`);
  }
  const track = {
    id: generateId(),
    title: String(title || '').trim(),
    artist: String(artist || '?').trim(),
    cachePath: '',
    artUrl: '',
    hint1: String(hint1 || '').trim(),
    hint2: String(hint2 || '').trim(),
    reponse: String(reponse || '').trim(),
  };
  theme.tracks.push(track);
  return track;
}

/** Retire une piste du thème. Mute et renvoie le thème. */
export function removeTrackFromTheme(theme, trackId) {
  theme.tracks = theme.tracks.filter((t) => t.id !== trackId);
  return theme;
}

/** Met à jour les 2 indices d'une piste. Mute et renvoie la piste, ou null si introuvable. */
export function updateTrackHints(theme, trackId, { hint1, hint2 } = {}) {
  const track = theme.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  if (hint1 !== undefined) track.hint1 = String(hint1).trim();
  if (hint2 !== undefined) track.hint2 = String(hint2).trim();
  return track;
}

/** Met à jour la réponse thématique attendue d'une piste. Mute et renvoie la piste, ou null si introuvable. */
export function updateTrackReponse(theme, trackId, reponse) {
  const track = theme.tracks.find((t) => t.id === trackId);
  if (!track) return null;
  track.reponse = String(reponse || '').trim();
  return track;
}

/** Retire un thème de la liste. Fonction pure — renvoie une nouvelle liste. */
export function deleteTheme(themes, themeId) {
  return themes.filter((t) => t.id !== themeId);
}

// ─── Session de jeu : persistance complète (survit à un rechargement) ───────
//
// Une "partie" = un pool fixe d'au plus THEME_CHOICE_COUNT thèmes tiré UNE
// SEULE fois au clic sur "Lancer une partie" (voir pickThemeChoices), puis
// qui se réduit à chaque Set terminé (5 → 4 → 3 → …) — on ne re-tire jamais
// un nouveau pool tant que la partie est en cours. L'écran courant et la
// progression (thème/piste en cours) sont aussi persistés en continu pour
// qu'un rechargement accidentel de la page (misclick) ne fasse pas perdre
// la partie : main.js restaure l'écran exact au chargement.

export function loadSessionPlayedIds() {
  try {
    const raw = localStorage.getItem(SESSION_PLAYED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveSessionPlayedIds(ids) {
  try {
    localStorage.setItem(SESSION_PLAYED_KEY, JSON.stringify(ids));
  } catch (_) {
    // quota / navigation privée
  }
}

/** Fonction pure : renvoie une nouvelle liste d'ids joués, avec themeId ajouté (dédupliqué). */
export function markThemePlayed(playedIds, themeId) {
  if (playedIds.includes(themeId)) return playedIds;
  return [...playedIds, themeId];
}

/** Le pool de thèmes tiré au lancement de la partie en cours (ids, ordre de tirage). */
export function loadSessionPool() {
  try {
    const raw = localStorage.getItem(SESSION_POOL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function saveSessionPool(themeIds) {
  try {
    localStorage.setItem(SESSION_POOL_KEY, JSON.stringify(themeIds));
  } catch (_) {
    // quota / navigation privée
  }
}

export function loadSessionScreen() {
  try {
    return localStorage.getItem(SESSION_SCREEN_KEY) || null;
  } catch (_) {
    return null;
  }
}

export function saveSessionScreen(screen) {
  try {
    localStorage.setItem(SESSION_SCREEN_KEY, screen);
  } catch (_) {
    // quota / navigation privée
  }
}

export function loadCurrentThemeId() {
  try {
    return localStorage.getItem(SESSION_CURRENT_THEME_KEY) || null;
  } catch (_) {
    return null;
  }
}

export function saveCurrentThemeId(themeId) {
  try {
    localStorage.setItem(SESSION_CURRENT_THEME_KEY, themeId || '');
  } catch (_) {
    // quota / navigation privée
  }
}

export function loadCurrentTrackIndex() {
  try {
    const raw = localStorage.getItem(SESSION_CURRENT_TRACK_INDEX_KEY);
    const parsed = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (_) {
    return 0;
  }
}

export function saveCurrentTrackIndex(index) {
  try {
    localStorage.setItem(SESSION_CURRENT_TRACK_INDEX_KEY, String(index));
  } catch (_) {
    // quota / navigation privée
  }
}

/** Efface toute la progression de la partie en cours (retour à l'accueil / nouvelle partie). */
export function resetSession() {
  try {
    localStorage.removeItem(SESSION_PLAYED_KEY);
    localStorage.removeItem(SESSION_POOL_KEY);
    localStorage.removeItem(SESSION_SCREEN_KEY);
    localStorage.removeItem(SESSION_CURRENT_THEME_KEY);
    localStorage.removeItem(SESSION_CURRENT_TRACK_INDEX_KEY);
  } catch (_) {
    // quota / navigation privée
  }
}

// ─── Sélection des thèmes proposés au picker ─────────────────────────────────

/**
 * Filtre les thèmes complets (7 pistes) et non déjà joués cette session.
 * Fonction pure, ne touche pas au localStorage.
 */
export function getEligibleThemesForSession(allThemes, playedThemeIds) {
  const playedSet = new Set(playedThemeIds);
  return allThemes.filter(
    (t) => t.tracks.length === THEME_TRACK_COUNT && !playedSet.has(t.id)
  );
}

/**
 * Le pool fixe de la partie en cours, moins les thèmes déjà joués, dans
 * l'ordre où ils avaient été tirés. Fonction pure, ne touche pas au
 * localStorage. Renvoie [] si le pool est épuisé (fin de partie) ou si un
 * thème du pool a été supprimé de la bibliothèque depuis le tirage.
 */
export function getRemainingPoolThemes(allThemes, poolThemeIds, playedThemeIds) {
  const playedSet = new Set(playedThemeIds);
  return poolThemeIds
    .filter((id) => !playedSet.has(id))
    .map((id) => allThemes.find((t) => t.id === id))
    .filter(Boolean);
}

/**
 * Choisit jusqu'à `count` thèmes au hasard (Fisher-Yates) dans le pool éligible.
 * - pool vide → []
 * - pool plus petit que `count` → tous les éléments du pool (jamais de padding/répétition)
 * - ordre randomisé à chaque appel
 * @param {object[]} pool
 * @param {number} [count=THEME_CHOICE_COUNT]
 * @returns {object[]}
 */
export function pickThemeChoices(pool, count = THEME_CHOICE_COUNT) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// ─── Export / import JSON (partage d'un thème entre appareils) ──────────────

/** Sérialise un thème sans cachePath/artUrl (host-spécifiques, re-résolus à la lecture). */
export function exportThemeJSON(theme) {
  return JSON.stringify(
    {
      name: theme.name,
      consigne: theme.consigne || '',
      tracks: theme.tracks.map((t) => ({
        title: t.title,
        artist: t.artist,
        hint1: t.hint1,
        hint2: t.hint2,
        reponse: t.reponse || '',
      })),
    },
    null,
    2
  );
}

/** @throws si le JSON est invalide ou ne respecte pas le format attendu. */
export function importThemeJSON(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (_) {
    throw new Error('Fichier JSON invalide.');
  }
  if (!parsed || typeof parsed.name !== 'string' || !Array.isArray(parsed.tracks)) {
    throw new Error('Format de thème invalide.');
  }
  return {
    id: generateId(),
    name: parsed.name.trim(),
    consigne: String(parsed.consigne || '').trim(),
    tracks: parsed.tracks
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({
        id: generateId(),
        title: String(t.title).trim(),
        artist: String(t.artist || '?').trim(),
        hint1: String(t.hint1 || '').trim(),
        hint2: String(t.hint2 || '').trim(),
        reponse: String(t.reponse || '').trim(),
        cachePath: '',
        artUrl: '',
      })),
    createdAt: Date.now(),
  };
}

// ─── Import d'un pack de thèmes (ex: /themes.json) ────────────
//
// Format source (généré par le skill blindtest-theme) :
// { themes: [ { theme, consigne, chansons: [ { titre, artiste, indice1, indice2, reponse } ] } ] }
// hint1/hint2 viennent des indice1/indice2 du pack (jamais l'artiste/titre
// exacts, pour ne pas spoiler la réponse), restant librement réajustables
// ensuite dans l'atelier.

/** Fonction pure : convertit un objet déjà parsé au format "pack" en Theme[]. @throws si le format est invalide. */
export function importThemePack(parsed) {
  if (!parsed || !Array.isArray(parsed.themes)) {
    throw new Error('Format de pack de thèmes invalide.');
  }
  return parsed.themes
    .filter((t) => t && typeof t.theme === 'string' && t.theme.trim() && Array.isArray(t.chansons))
    .map((t) => {
      const theme = createTheme(t.theme, t.consigne || '');
      t.chansons
        .filter((c) => c && typeof c.titre === 'string' && c.titre.trim())
        .slice(0, THEME_TRACK_COUNT)
        .forEach((c) => {
          addTrackToTheme(theme, {
            title: c.titre,
            artist: c.artiste || '?',
            hint1: c.indice1 || '',
            hint2: c.indice2 || '',
            reponse: c.reponse || '',
          });
        });
      return theme;
    });
}

/** @throws si le JSON est invalide ou ne respecte pas le format "pack" attendu. */
export function importThemePackJSON(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (_) {
    throw new Error('Fichier JSON invalide.');
  }
  return importThemePack(parsed);
}

/**
 * Fonction pure : fusionne newThemes dans existingThemes, en ignorant les
 * thèmes dont le nom (insensible à la casse) existe déjà — évite les doublons
 * si le pack est importé plusieurs fois.
 */
export function mergeThemePack(existingThemes, newThemes) {
  const existingNames = new Set(existingThemes.map((t) => t.name.trim().toLowerCase()));
  const added = newThemes.filter((t) => !existingNames.has(t.name.trim().toLowerCase()));
  return {
    merged: [...existingThemes, ...added],
    addedCount: added.length,
    skippedCount: newThemes.length - added.length,
  };
}
