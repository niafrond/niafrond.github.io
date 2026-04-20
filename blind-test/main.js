/**
 * main.js — Point d'entrée, orchestration générale
 *
 * Rôles :
 *  1. Détecter si l'on est HOST (pas de ?host=) ou CLIENT (?host=PEER_ID)
 *  2. Gérer la navigation entre écrans
 *  3. Connecter peer.js ↔ game.js ↔ ui.js ↔ youtube.js
 */

import { BlindTestPeer } from './peer.js';
import { YouTubePlayer, probeEndpoints, quickCheckCachedEndpoint, getInstanceCaches, getPreferredAudioSource, setInstanceCaches } from './youtube.js';
import { GameEngine } from './game.js';
import { MSG, PHASE, MODE, TIMER, ANSWER_FORMAT, ANSWER_PROMPTS } from './constants.js';
import { getMatch3Version, getMatch3BuildDate } from '../match3-quest/version.js';
import { initUpdateChecker } from '../update-checker.js';
import {
  showOnly, show, hide, renderShareLink, renderLobbyPlayers,
  renderScoreboard, renderJokers, renderGamePhase, renderPlaylist,
  renderModeSelector, renderAnswerFormatSelector, renderFinalResults, flashBuzz,
  startTimerBar, stopTimerBar, highlightCorrectChoice,
} from './ui.js';
import {
  loadPlaylist, savePlaylist, addSong, removeSong, moveSong, fetchYouTubePlaylist, mergeSongs,
  extractVideoId, fetchVideoTitle, lookupSongMetadata, enrichWithMusicMetadata, fetchArtistAlternatives,
  exportPlaylistJSON, importPlaylistJSON,
  BUILTIN_PLAYLISTS, listSavedPlaylists, saveNamedPlaylist, loadNamedPlaylist, deleteNamedPlaylist,
  ERAS, filterByEras,
  getVideoCache, setVideoCache,
} from './playlist.js';

// ─── État local (client + host) ───────────────────────────────────────────────

function generateSessionId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const peer = new BlindTestPeer();
let yt = null; // YouTubePlayer, créé après init DOM

// État client (pas host)
const client = {
  myId: null,
  myName: '',
  players: [],
  currentRound: 0,
  mode: MODE.CLASSIC,
  answerFormat: ANSWER_FORMAT.ARTIST_THEN_TITLE,
  phase: PHASE.LOBBY,
  choices: [],
  canBuzz: false,
  lastResult: null,
  currentSong: null,
  buzzQueue: [],
  _gameCache: { playlist: [], shuffled: [] },
};

// État host
let engine = null;
let hostMode = MODE.CLASSIC;
let hostAnswerFormat = ANSWER_FORMAT.ARTIST_THEN_TITLE;
let _activePlaylist = []; // playlist filtrée passée au moteur de jeu

// État relay (quand ce client est hôte temporaire)
let _relayEngine = null;
let _relayWatcher = null;

// ─── Détection du rôle ────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const hostPeerId = params.get('host');
// L'hôte a la même URL que les joueurs (?host=PEERID), mais on sait qu'il est hôte
// parce qu'on a enregistré son flag en localStorage lors de la création.
const IS_HOST = !hostPeerId || !!localStorage.getItem(`blindtest_am_host_${hostPeerId}`);

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const versionEl = document.getElementById('blind-test-version');
  const buildDate = getMatch3BuildDate();
  if (versionEl) {
    const dateLabel = buildDate
      ? ` · ${new Date(buildDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
      : '';
    versionEl.textContent = `v${getMatch3Version()}${dateLabel}`;
  }
  initUpdateChecker(buildDate, versionEl);

  // Remove unused screens to eliminate duplicate ID conflicts
  // (host and client share some IDs like 'scoreboard', 'phase-playing', etc.)
  if (IS_HOST) {
    ['screen-join', 'screen-lobby-player', 'screen-game-client', 'screen-host-gone']
      .forEach(id => document.getElementById(id)?.remove());
    initHostUI();
  } else {
    ['screen-host-setup', 'screen-lobby-host', 'screen-game-host']
      .forEach(id => document.getElementById(id)?.remove());
    initClientUI();
  }
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
let _probeReady = false;

function _updateStartButton(players = []) {
  const btn = document.getElementById('btn-start-game');
  if (!btn) return;
  const allReady = players.length > 0 && players.every(p => p.ready);
  btn.disabled = !(_probeReady && allReady);
}

function _showItunesLoader(msg = '🎵 Correction iTunes…') {
  const el = document.getElementById('overlay-itunes');
  const msgEl = document.getElementById('overlay-itunes-msg');
  if (msgEl) msgEl.textContent = msg;
  if (el) el.style.display = 'flex';
}
function _hideItunesLoader() {
  const el = document.getElementById('overlay-itunes');
  if (el) el.style.display = 'none';
}
async function initHostUI() {
  showOnly('screen-host-setup');

  // Lance le test des endpoints dès l'affichage de l'écran de configuration,
  // bien avant que l'hôte clique sur "Créer la partie".
  // La promesse est réutilisée dans le lobby pour ne pas retester.
  const elSetupProbe = document.getElementById('probe-status-setup');
  const _probePromise = (async () => {
    // Vérification rapide de l'endpoint en cache
    const quick = await quickCheckCachedEndpoint('dQw4w9WgXcQ');
    if (quick) {
      if (elSetupProbe) {
        elSetupProbe.textContent = `✅ ${quick.source} OK (cache)`;
        elSetupProbe.style.color = 'var(--success, #22c55e)';
      }
      return quick;
    }
    // Pas de cache valide → test complet de tous les endpoints
    return probeEndpoints('dQw4w9WgXcQ', ({ source, total }) => {
      if (!elSetupProbe) return;
      if (source === 'piped-fetched') {
        elSetupProbe.textContent = `🔄 Test de ${total} instances Piped + Invidious + cobalt…`;
      }
    }).then((result) => {
      if (elSetupProbe) {
        const c = result.cobalt ? '✅ cobalt' : '❌ cobalt';
        const p = result.pipedWorking > 0 ? `✅ ${result.pipedWorking} Piped` : '❌ Piped';
        const inv = result.invidiousWorking > 0 ? `✅ ${result.invidiousWorking} Invidious` : '❌ Invidious';
        const ok = result.cobalt || result.pipedWorking > 0 || result.invidiousWorking > 0;
        elSetupProbe.innerHTML = `${c} · ${p} · ${inv}`;
        elSetupProbe.style.color = ok ? 'var(--success, #22c55e)' : 'var(--error, #ef4444)';
      }
      return result;
    });
  })().catch(() => null);

  // Playlist
  let playlist = loadPlaylist();
  renderPlaylist(playlist,
    (id) => { playlist = removeSong(playlist, id); renderPlaylist(playlist, ...playlistCallbacks()); },
    (id, dir) => { playlist = moveSong(playlist, id, dir); renderPlaylist(playlist, ...playlistCallbacks()); }
  );

  function playlistCallbacks() {
    return [
      (id) => { playlist = removeSong(playlist, id); renderPlaylist(playlist, ...playlistCallbacks()); },
      (id, dir) => { playlist = moveSong(playlist, id, dir); renderPlaylist(playlist, ...playlistCallbacks()); },
    ];
  }

  // Formulaire ajout chanson — résolution titre/artiste via oEmbed + iTunes
  const addForm = document.getElementById('add-song-form');
  const addSongStatus = document.getElementById('add-song-status');
  const addSongError = document.getElementById('add-song-error');
  if (addForm) {
    const songUrlInput = document.getElementById('song-url');

    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = songUrlInput.value.trim();
      const videoId = extractVideoId(url);
      if (!videoId) {
        if (addSongError) addSongError.textContent = 'URL YouTube invalide.';
        return;
      }
      if (addSongError) addSongError.textContent = '';
      const submitBtn = addForm.querySelector('button[type=submit]');
      if (submitBtn) submitBtn.disabled = true;

      // Court-circuit : videoId déjà enrichi dans le cache iTunes
      const vidCached = getVideoCache(videoId);
      if (vidCached) {
        if (addSongStatus) { addSongStatus.textContent = `✅ "${vidCached.title}" — ${vidCached.artist} (cache)`; addSongStatus.style.color = 'var(--success, #22c55e)'; }
        try {
          playlist = addSong(playlist, { url, title: vidCached.title, artist: vidCached.artist, year: vidCached.year, genre: vidCached.genre, alternatives: vidCached.alternatives });
          renderPlaylist(playlist, ...playlistCallbacks());
          addForm.reset();
          setTimeout(() => { if (addSongStatus) addSongStatus.textContent = ''; }, 3000);
        } catch (err) {
          if (addSongError) addSongError.textContent = err.message;
          if (addSongStatus) addSongStatus.textContent = '';
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
        return;
      }

      if (addSongStatus) { addSongStatus.textContent = '🔄 Récupération du titre…'; addSongStatus.style.color = 'var(--text-muted)'; }

      const rawTitle = await fetchVideoTitle(videoId);
      let title, artist, year = null, genre = null;

      if (rawTitle) {
        if (addSongStatus) { addSongStatus.textContent = '🎵 Correction iTunes…'; addSongStatus.style.color = 'var(--text-muted)'; }
        _showItunesLoader('🎵 Correction iTunes…');
        const meta = await lookupSongMetadata(rawTitle, null);
        if (meta) {
          title = meta.title;
          artist = meta.artist;
          year = meta.year ?? null;
          genre = meta.genre ?? null;
          if (addSongStatus) { addSongStatus.textContent = `✅ "${title}" — ${artist}`; addSongStatus.style.color = 'var(--success, #22c55e)'; }
        } else {
          // Repli : découpage sur " - "
          const parts = rawTitle.split(/ - (.+)/);
          if (parts.length >= 2) {
            title = parts[1].trim();
            artist = parts[0].trim();
            if (addSongStatus) { addSongStatus.textContent = `⚠️ "${title}" — ${artist} (iTunes sans résultat)`; addSongStatus.style.color = 'var(--warning, #f59e0b)'; }
          } else {
            // Impossible de déterminer l'artiste → on bloque l'ajout
            _hideItunesLoader();
            if (addSongStatus) { addSongStatus.textContent = '❌ Impossible d\'identifier l\'artiste. Vérifiez la vidéo.'; addSongStatus.style.color = 'var(--error, #ef4444)'; }
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
        }
        if (addSongStatus) { addSongStatus.textContent = '🔍 Recherche des alternatives…'; addSongStatus.style.color = 'var(--text-muted)'; }
        _showItunesLoader('🔍 Recherche des alternatives…');
      } else {
        if (addSongStatus) { addSongStatus.textContent = '❌ Impossible de récupérer le titre (vidéo privée ou indisponible).'; addSongStatus.style.color = 'var(--error, #ef4444)'; }
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const alternatives = await fetchArtistAlternatives(artist, title).catch(() => []);
      _hideItunesLoader();
      setVideoCache(videoId, { title, artist, year, genre, alternatives });

      try {
        playlist = addSong(playlist, { url, title, artist, year, genre, alternatives });
        renderPlaylist(playlist, ...playlistCallbacks());
        addForm.reset();
        setTimeout(() => { if (addSongStatus) addSongStatus.textContent = ''; }, 3000);
      } catch (err) {
        if (addSongError) addSongError.textContent = err.message;
        if (addSongStatus) addSongStatus.textContent = '';
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Import playlist YouTube
  const btnImport = document.getElementById('btn-import-playlist');
  const importStatus = document.getElementById('import-playlist-status');
  if (btnImport) {
    btnImport.addEventListener('click', async () => {
      const url = document.getElementById('yt-playlist-url').value.trim();
      if (!url) { importStatus.textContent = '⚠️ Collez une URL de playlist YouTube.'; return; }

      btnImport.disabled = true;
      importStatus.textContent = '⏳ Connexion à YouTube…';

      try {
        const songs = await fetchYouTubePlaylist(url, (loaded) => {
          importStatus.textContent = `⏳ ${loaded} chanson(s) chargée(s)…`;
        });
        importStatus.textContent = `🎵 Correction iTunes (0/${songs.length})…`;
        _showItunesLoader(`🎵 Correction iTunes (0/${songs.length})…`);
        const enriched = await enrichWithMusicMetadata(songs, (curr, total) => {
          const msg = `🎵 Correction iTunes (${curr}/${total})…`;
          importStatus.textContent = msg;
          _showItunesLoader(msg);
        });
        _hideItunesLoader();
        const { updated, added, skipped } = mergeSongs(playlist, enriched);
        playlist = updated;
        renderPlaylist(playlist, ...playlistCallbacks());
        document.getElementById('yt-playlist-url').value = '';
        const msg = [`✅ ${added} chanson(s) importée(s).`];
        if (skipped > 0) msg.push(`(${skipped} déjà présentes, ignorées)`);
        importStatus.textContent = msg.join(' ');
      } catch (err) {
        _hideItunesLoader();
        importStatus.textContent = '❌ ' + err.message;
      } finally {
        btnImport.disabled = false;
      }
    });
  }

  // Bouton vider la playlist
  document.getElementById('btn-clear-playlist')?.addEventListener('click', () => {
    if (!confirm('Vider toute la liste de chansons ?')) return;
    playlist = [];
    savePlaylist([]);
    renderPlaylist(playlist, ...playlistCallbacks());
  });

  // ── Export JSON ───────────────────────────────────────────────────────────────
  document.getElementById('btn-export-playlist')?.addEventListener('click', () => {
    if (playlist.length === 0) { alert('La playlist est vide.'); return; }
    const blob = new Blob([exportPlaylistJSON(playlist)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'playlist.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ── Import JSON ────────────────────────────────────────────────────────────────
  const importJsonFile = document.getElementById('import-json-file');
  const importJsonStatus = document.getElementById('import-json-status');
  importJsonFile?.addEventListener('change', async () => {
    const file = importJsonFile.files?.[0];
    if (!file) return;
    importJsonFile.value = '';
    try {
      const text = await file.text();
      const imported = importPlaylistJSON(text);
      const { updated, added, skipped } = mergeSongs(playlist, imported);
      playlist = updated;
      renderPlaylist(playlist, ...playlistCallbacks());
      renderSavedPlaylists();
      if (importJsonStatus) {
        importJsonStatus.textContent = `✅ ${added} importée(s)${skipped > 0 ? `, ${skipped} ignorée(s)` : ''}.`;
        setTimeout(() => { importJsonStatus.textContent = ''; }, 4000);
      }
    } catch (err) {
      if (importJsonStatus) importJsonStatus.textContent = '❌ ' + err.message;
    }
  });

  // ── Playlists sauvegardées ────────────────────────────────────────────────────
  function renderSavedPlaylists() {
    const container = document.getElementById('saved-playlists-list');
    if (!container) return;
    const builtins = BUILTIN_PLAYLISTS;
    const custom = listSavedPlaylists();
    const all = [...builtins, ...custom];
    if (all.length === 0) { container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Aucune playlist sauvegardée.</p>'; return; }
    container.innerHTML = '';
    for (const pl of all) {
      const isBuiltin = builtins.some(b => b.id === pl.id);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
      row.innerHTML = `
        <span style="flex:1;font-size:0.9rem;">${pl.name} <span style="color:var(--text-muted);font-size:0.8rem;">(${pl.songs.length})</span></span>
        <button class="btn btn-sm btn-primary" data-pl-load="${pl.id}">Charger</button>
        ${!isBuiltin ? `<button class="btn btn-sm btn-danger" data-pl-del="${pl.id}">✕</button>` : ''}
      `;
      container.appendChild(row);
    }
    container.querySelectorAll('[data-pl-load]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (playlist.length > 0 && !confirm('Remplacer la playlist courante ?')) return;
        const songs = loadNamedPlaylist(btn.dataset.plLoad);
        if (!songs) return;
        playlist = songs.map(s => ({ ...s, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` }));
        savePlaylist(playlist);
        renderPlaylist(playlist, ...playlistCallbacks());
      });
    });
    container.querySelectorAll('[data-pl-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Supprimer cette playlist ?')) return;
        deleteNamedPlaylist(btn.dataset.plDel);
        renderSavedPlaylists();
      });
    });
  }
  renderSavedPlaylists();

  document.getElementById('btn-save-playlist')?.addEventListener('click', () => {
    if (playlist.length === 0) { alert('La playlist est vide.'); return; }
    const name = prompt('Nom de la playlist :');
    if (!name?.trim()) return;
    saveNamedPlaylist(name, playlist);
    renderSavedPlaylists();
  });

  // ── Filtre ère ────────────────────────────────────────────────────────────────
  let selectedEras = new Set();

  const eraFilterBar = document.getElementById('era-filter-bar');
  if (eraFilterBar) {
    for (const era of ERAS) {
      const label = document.createElement('label');
      label.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-right:10px;font-size:0.85rem;cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = era.label;
      cb.addEventListener('change', () => {
        if (cb.checked) selectedEras.add(era.label); else selectedEras.delete(era.label);
        _updateEraInfo();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(era.label));
      eraFilterBar.appendChild(label);
    }
  }

  function _updateEraInfo() {
    const el = document.getElementById('era-filter-info');
    if (!el) return;
    if (selectedEras.size === 0) { el.textContent = ''; return; }
    const filtered = filterByEras(playlist, [...selectedEras]);
    el.textContent = `→ ${filtered.length} chanson(s) sur ${playlist.length} dans la sélection`;
  }

  // Sélecteur de mode
  renderModeSelector(hostMode, (mode) => { hostMode = mode; });
  renderAnswerFormatSelector(hostAnswerFormat, (format) => { hostAnswerFormat = format; });


  // Bouton "Créer la partie"
  document.getElementById('btn-create-game')?.addEventListener('click', async () => {
    const activePlaylist = selectedEras.size > 0 ? filterByEras(playlist, [...selectedEras]) : playlist;
    if (activePlaylist.length === 0) {
      alert(selectedEras.size > 0 ? 'Aucune chanson ne correspond aux ères sélectionnées.' : 'Ajoutez au moins une chanson avant de créer une partie.');
      return;
    }
    if (hostMode === MODE.FOUR_CHOICES && activePlaylist.length < 4) {
      alert('Le mode 4 choix nécessite au moins 4 chansons dans la sélection.');
      return;
    }

    document.getElementById('btn-create-game').disabled = true;
    document.getElementById('btn-create-game').textContent = 'Connexion…';
    _activePlaylist = activePlaylist;

    await peer.startHost(generateSessionId());
  });

  // Reconnexion automatique si l'hôte revient sur son URL (?host=PEERID déjà connu)
  if (hostPeerId) {
    await peer.startHost(hostPeerId);
  }

  peer.addEventListener('ready', async ({ detail: { peerId } }) => {
    // Mémoriser que cet onglet est l'hôte pour cet ID
    localStorage.setItem(`blindtest_am_host_${peerId}`, '1');
    // Mettre à jour l'URL avec le paramètre ?host= pour pouvoir la partager et se reconnecter
    history.replaceState(null, '', `${location.pathname}?host=${peerId}`);

    // Initialiser l'écran lobby host
    showOnly('screen-lobby-host');
    renderShareLink(peerId);

    // Nom de l'hôte (mémorisé pour éviter de re-demander à chaque reconnexion)
    const savedHostName = localStorage.getItem('blind-test-host-name');
    const hostName = savedHostName || prompt('Votre nom (hôte) :') || 'Hôte';
    if (!savedHostName) localStorage.setItem('blind-test-host-name', hostName);

    // YouTube — caché : blind test = son uniquement, pas besoin de voir la vidéo
    yt = new YouTubePlayer('yt-player-host', { hidden: true });
    yt.init(); // ne pas await — l'IFrame s'init en arrière-plan

    engine = new GameEngine(peer, yt, onHostStateChange);
    engine.addPlayer('__host__', hostName);

    // Bouton buzz de l'hôte (même ID que les joueurs, écran client retiré du DOM)
    document.getElementById('btn-buzz')?.addEventListener('click', () => {
      engine?.handleBuzz('__host__');
    });

    // Formulaire réponse de l'hôte
    document.getElementById('answer-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('answer-input');
      const text = input?.value.trim();
      if (!text) return;
      input.value = '';
      engine?.handleAnswer('__host__', text);
    });

    // Bouton démarrer
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      const { piped, invidious } = getInstanceCaches();
      engine.startGame(hostMode, _activePlaylist, {
        pipedInstances: piped,
        invidiousInstances: invidious,
        preferredAudioSource: getPreferredAudioSource(),
        answerFormat: hostAnswerFormat,
      });
    });

    // Bouton Suivant (phase ROUND_END)
    document.getElementById('btn-next-round')?.addEventListener('click', () => {
      engine?.hostNext();
    });

    // ── Reconnexion hôte : si on revient sur une URL existante, attendre le snapshot ──────────
    if (hostPeerId && peerId === hostPeerId) {
      const elProbe = document.getElementById('probe-status');
      if (elProbe) elProbe.textContent = '🔄 Reconnexion en cours, en attente de l\'état du jeu…';
      _probeReady = true;
      _updateStartButton(engine?.state?.players ?? []);
      return; // Pas besoin de relancer le diagnostic réseau
    }

    // ── Diagnostic des endpoints audio ─────────────────────────────────────────
    // Le test a démarré en arrière-plan dès l'écran de configuration.
    // On attend juste que la promesse se termine (peut être déjà résolue).
    const elProbe = document.getElementById('probe-status');
    if (elProbe) elProbe.textContent = '🔄 Test des endpoints en cours…';

    try {
      const result = await _probePromise;
      const { cobalt, pipedWorking, pipedTotal, invidiousWorking, invidiousTotal }
        = result ?? { cobalt: false, pipedWorking: 0, pipedTotal: 0, invidiousWorking: 0, invidiousTotal: 0 };

      if (elProbe) {
        if (result?._quick) {
          elProbe.textContent = `✅ ${result.source} OK (cache)`;
          elProbe.style.color = '';
        } else {
          const c = cobalt ? '✅ cobalt.tools' : '❌ cobalt.tools';
          const p = pipedWorking > 0 ? `✅ ${pipedWorking}/${pipedTotal} Piped` : `❌ 0/${pipedTotal} Piped`;
          const inv = invidiousWorking > 0 ? `✅ ${invidiousWorking}/${invidiousTotal} Invidious` : `❌ 0/${invidiousTotal} Invidious`;
          elProbe.innerHTML = `${c} &nbsp;·&nbsp; ${p} &nbsp;·&nbsp; ${inv}`;
          const ok = cobalt || pipedWorking > 0 || invidiousWorking > 0;
          elProbe.style.color = ok ? '' : 'var(--error, #ef4444)';
        }
      }
    } catch {
      if (elProbe) elProbe.textContent = '⚠️ Erreur lors du diagnostic réseau';
    } finally {
      _probeReady = true;
      _updateStartButton(engine?.state?.players ?? []);
    }
  });

  peer.addEventListener('player-join', ({ detail: { peerId } }) => {
    // Le nom arrive via le message JOIN
  });

  peer.addEventListener('player-leave', ({ detail: { peerId } }) => {
    engine?.removePlayer(peerId);
  });

  peer.addEventListener('message', ({ detail: { from, data } }) => {
    engine?.handleMessage(from, data);
  });

  peer.addEventListener('error', ({ detail: { err } }) => {
    alert('Erreur réseau : ' + (err?.type || err?.message || err));
    document.getElementById('btn-create-game').disabled = false;
    document.getElementById('btn-create-game').textContent = 'Créer la partie';
  });
}

// ─── Callback état HOST → UI ──────────────────────────────────────────────────

function onHostStateChange(state) {
  const { phase } = state;

  if (phase === PHASE.LOBBY) {
    showOnly('screen-lobby-host');
    renderLobbyPlayers(state.players);
    _updateStartButton(state.players);
    return;
  }

  showOnly('screen-game-host');

  renderScoreboard(state.players);

  // Jokers de l'hôte
  const hostPlayer = state.players.find(p => p.id === '__host__');
  if (hostPlayer) {
    renderJokers(hostPlayer, state.players, state.currentRound, (type, targetId) => {
      engine?.handleJokerUse('__host__', type, targetId);
    }, phase === PHASE.JOKER_WINDOW);
  }

  renderGamePhase(phase, {
    ...state,
    mode: state.mode,
    choices: state.choices,
    players: state.players,
    currentSong: state.currentSong,
    lastResult: state._lastResult,
    answerStep: state.answerStep,
    currentRound: state.currentRound,
    totalRounds: state.shuffled?.length ?? null,
    jokerWindowRemaining: state.jokerWindowRemaining ?? 0,
    onChoiceClick: (choice) => {
      engine?.handleFourChoiceAnswer('__host__', choice);
      document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
    },
  }, true);

  if (phase === PHASE.PLAYING) {
    const remaining = engine?._playSongStartedAt
      ? Math.max(0, TIMER.PLAY_DURATION - (Date.now() - engine._playSongStartedAt))
      : TIMER.PLAY_DURATION;
    startTimerBar(remaining, 'timer-bar-client', (remaining / TIMER.PLAY_DURATION) * 100);
    const btnBuzz = document.getElementById('btn-buzz');
    if (btnBuzz) btnBuzz.disabled = (state.mode === MODE.FOUR_CHOICES);
  } else {
    stopTimerBar();
    const btnBuzz = document.getElementById('btn-buzz');
    if (btnBuzz) btnBuzz.disabled = true;
  }

  // Formulaire de réponse : visible seulement si c'est le tour de l'hôte
  if (phase === PHASE.ANSWERING) {
    const isHostTurn = state.buzzQueue?.[0] === '__host__';
    const waitEl = document.getElementById('host-answering-wait');
    const formEl = document.getElementById('answer-form');
    if (waitEl) waitEl.hidden = isHostTurn;
    if (formEl) {
      formEl.hidden = !isHostTurn;
      if (isHostTurn) {
        const step = state.answerStep ?? 'artist';
        const label = document.getElementById('answer-step-label');
        const inp = document.getElementById('answer-input');
        const prompt = ANSWER_PROMPTS[step] ?? ANSWER_PROMPTS.artist;
        if (label) label.textContent = prompt.label;
        if (inp) { inp.placeholder = prompt.placeholder; inp.focus(); }
      }
    }
    if (isHostTurn) startTimerBar(TIMER.ANSWER_DURATION, 'timer-bar-client-answer');
  }

  if (phase === PHASE.GAME_OVER) {
    showOnly('screen-results');
    renderFinalResults(state.finalScores ?? [...state.players].sort((a,b) => b.score - a.score));
  }
}

// ─── CLIENT ───────────────────────────────────────────────────────────────────

function initClientUI() {
  showOnly('screen-join');

  // Pré-remplir le nom si mémorisé
  const savedName = localStorage.getItem('blind-test-name');
  if (savedName) {
    const nameInput = document.getElementById('player-name-input');
    if (nameInput) nameInput.value = savedName;
  }

  document.getElementById('btn-join')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput?.value.trim();
    if (!name) { alert('Entrez votre prénom.'); return; }

    client.myName = name;
    localStorage.setItem('blind-test-name', name);

    document.getElementById('btn-join').disabled = true;
    document.getElementById('btn-join').textContent = 'Connexion…';

    await peer.joinHost(hostPeerId);
  });

  peer.addEventListener('ready', async ({ detail: { peerId } }) => {
    client.myId = peerId;
    // Envoyer JOIN immédiatement
    peer.sendToHost({ type: MSG.JOIN, name: client.myName });

    showOnly('screen-lobby-player');

    // YouTube caché (sync audio)
    yt = new YouTubePlayer('yt-player-client', { hidden: true });
    await yt.init();

    // Bouton Prêt
    document.getElementById('btn-ready')?.addEventListener('click', () => {
      peer.sendToHost({ type: MSG.READY });
      document.getElementById('btn-ready').disabled = true;
      document.getElementById('btn-ready').textContent = '✅ Prêt !';
    });
  });

  peer.addEventListener('message', ({ detail: { from, data } }) => {
    if (_relayEngine) {
      _relayEngine.handleMessage(from, data);
    } else {
      handleClientMessage(data);
    }
  });

  peer.addEventListener('host-reconnecting', () => {
    document.getElementById('overlay-reconnecting').style.display = 'flex';
  });

  peer.addEventListener('relay-needed', () => {
    if (client.phase === PHASE.LOBBY || _relayEngine) return;
    const relayId = _electRelayId();
    if (!relayId) return;
    if (client.myId === relayId) {
      _startRelayMode();
    } else {
      // Attendre que le relay soit prêt, puis basculer vers lui
      setTimeout(() => {
        if (peer._reconnecting) peer.connectToHost(relayId);
      }, 3000);
    }
  });

  peer.addEventListener('host-reconnected', () => {
    document.getElementById('overlay-reconnecting').style.display = 'none';
    // Si on était en pleine partie, envoyer un snapshot de l'état à l'hôte qui revient
    if (client.phase !== PHASE.LOBBY) {
      peer.sendToHost({
        type: MSG.STATE_SNAPSHOT,
        mode: client.mode,
        answerFormat: client.answerFormat,
        playlist: client._gameCache.playlist,
        shuffled: client._gameCache.shuffled,
        currentRound: client.currentRound,
        currentSong: client.currentSong,
        players: client.players,
        phase: client.phase,
        choices: client.choices,
      });
    }
    // Re-envoyer JOIN pour que l'hôte restaure notre profil
    peer.sendToHost({ type: MSG.JOIN, name: client.myName });
  });

  peer.addEventListener('player-leave', () => {
    if (client.phase !== PHASE.LOBBY && !_relayEngine) {
      // En pleine partie sans relay actif : l'overlay reste jusqu'au relay-needed ou game-over
      const overlay = document.getElementById('overlay-reconnecting');
      if (overlay.style.display !== 'flex') {
        overlay.innerHTML = [
          '<div style="font-size:2.5rem">😢</div>',
          '<p style="font-size:1.2rem;font-weight:600;color:#fff">L\'hôte a quitté la partie.</p>',
          '<a href="." style="color:#a78bfa;text-decoration:underline;font-size:0.9rem;margin-top:8px">Retour à l\'accueil</a>',
        ].join('');
        overlay.style.display = 'flex';
      }
    } else {
      document.getElementById('overlay-reconnecting').style.display = 'none';
      showOnly('screen-host-gone');
    }
  });

  peer.addEventListener('error', ({ detail: { err } }) => {
    alert('Erreur de connexion : ' + (err?.type || err?.message || err));
  });

  // Buzz button
  document.getElementById('btn-buzz')?.addEventListener('click', () => {
    if (!client.canBuzz) return;
    peer.sendToHost({ type: MSG.BUZZ });
    client.canBuzz = false;
    document.getElementById('btn-buzz').disabled = true;
    flashBuzz();
  });

  // Answer form
  document.getElementById('answer-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('answer-input');
    const text = input?.value.trim();
    if (!text) return;
    peer.sendToHost({ type: MSG.ANSWER, text });
    input.value = '';
    hide('phase-answering');
  });
}

function handleClientMessage(data) {
  const { type } = data;

  // Étape locale en cours (synchronisé depuis ANSWER_STEP)
  if (!handleClientMessage._step) handleClientMessage._step = 'artist';

  switch (type) {
    case MSG.PLAYER_LIST: {
      client.players = data.players;
      renderLobbyPlayers(data.players);
      renderScoreboard(data.players);
      const me = data.players.find(p => p.id === client.myId);
      if (me) renderJokers(me, data.players, client.currentRound, onJokerClick, client.phase === PHASE.JOKER_WINDOW);
      break;
    }

    case MSG.GAME_START: {
      client.mode = data.mode;
      client.answerFormat = data.answerFormat ?? ANSWER_FORMAT.ARTIST_THEN_TITLE;
      client._gameCache = { playlist: data.playlist ?? [], shuffled: data.shuffled ?? [] };
      if (data.pipedInstances?.length || data.invidiousInstances?.length || data.preferredAudioSource) {
        setInstanceCaches(data.pipedInstances ?? [], data.invidiousInstances ?? [], data.preferredAudioSource ?? null);
      }
      showOnly('screen-game-client');
      break;
    }

    case MSG.JOKER_WINDOW: {
      client.phase = PHASE.JOKER_WINDOW;
      if (data.videoId) yt?.prefetch(data.videoId).catch(() => {});
      showOnly('screen-game-client');
      renderGamePhase(PHASE.JOKER_WINDOW, { jokerWindowRemaining: data.remainingS }, false);
      const meJw = client.players.find(p => p.id === client.myId);
      if (meJw) renderJokers(meJw, client.players, client.currentRound, onJokerClick, true);
      break;
    }

    case 'COUNTDOWN': {
      client.phase = PHASE.COUNTDOWN;
      if (data.videoId) yt?.prefetch(data.videoId).catch(() => {});
      showOnly('screen-game-client');
      renderGamePhase(PHASE.COUNTDOWN, { countdown: data.count }, false);
      const me2 = client.players.find(p => p.id === client.myId);
      if (me2) renderJokers(me2, client.players, client.currentRound, onJokerClick, false);
      break;
    }

    case MSG.PLAY_SONG: {
      client.phase = PHASE.PLAYING;
      client.canBuzz = client.mode !== MODE.FOUR_CHOICES;
      client.choices = data.choices ?? [];
      client.currentRound++;
      handleClientMessage._step = client.answerFormat === ANSWER_FORMAT.BOTH_TOGETHER
        ? 'both'
        : client.answerFormat === ANSWER_FORMAT.EITHER_ONE
          ? 'either'
          : 'artist';
      // Mettre à jour currentSong dès maintenant (utile pour le snapshot si le host se déconnecte)
      client.currentSong = client._gameCache.shuffled[client.currentRound - 1] ?? client.currentSong;

      yt.load(data.videoId, data.startAt ?? 0);

      const me = client.players.find(p => p.id === client.myId);
      renderGamePhase(PHASE.PLAYING, {
        mode: client.mode,
        choices: client.choices,
        eliminatedChoices: [],
        currentRound: client.currentRound,
        onChoiceClick: (choice) => {
          peer.sendToHost({ type: MSG.ANSWER, text: choice });
          // Désactive tous les boutons pour éviter le double-clic
          document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
        },
      }, false);

      const remMs = data.remainingMs ?? TIMER.PLAY_DURATION;
      startTimerBar(remMs, 'timer-bar-client', (remMs / TIMER.PLAY_DURATION) * 100);
      if (client.mode !== MODE.FOUR_CHOICES) {
        document.getElementById('btn-buzz').disabled = false;
      }
      break;
    }

    case MSG.STOP_MUSIC: {
      yt.pause();
      stopTimerBar();
      client.canBuzz = false;
      document.getElementById('btn-buzz').disabled = true;
      break;
    }

    case MSG.ANSWER_STEP: {
      // L'hôte indique si on attend l'artiste ou le titre
      handleClientMessage._step = data.step ?? 'artist';
      if (data.playerId === client.myId) {
        const step = handleClientMessage._step;
        const label = document.getElementById('answer-step-label');
        const inp = document.getElementById('answer-input');
        const prompt = ANSWER_PROMPTS[step] ?? ANSWER_PROMPTS.artist;
        if (label) label.textContent = prompt.label;
        if (inp) inp.placeholder = prompt.placeholder;
        inp?.focus();
        startTimerBar(TIMER.ANSWER_DURATION, 'timer-bar-client-answer');
      }
      // Mettre à jour le label pour les spectateurs aussi
      const stepLabel = document.getElementById('answer-step-label');
      if (stepLabel) {
        const step = handleClientMessage._step;
        if (data.playerId !== client.myId) {
          const buzzerName = client.players.find(p => p.id === data.playerId)?.name ?? '?';
          if (step === 'artist') stepLabel.textContent = `🎤 ${buzzerName} donne l’artiste…`;
          else if (step === 'title') stepLabel.textContent = `🎵 ${buzzerName} donne le titre…`;
          else if (step === 'both') stepLabel.textContent = `🎶 ${buzzerName} donne l’artiste et le titre…`;
          else stepLabel.textContent = `🎵 ${buzzerName} donne l’artiste ou le titre…`;
        }
      }
      break;
    }

    case MSG.RESUME_MUSIC: {
      client.phase = PHASE.PLAYING;
      client.canBuzz = client.mode !== MODE.FOUR_CHOICES;
      handleClientMessage._step = client.answerFormat === ANSWER_FORMAT.BOTH_TOGETHER
        ? 'both'
        : client.answerFormat === ANSWER_FORMAT.EITHER_ONE
          ? 'either'
          : 'artist';
      yt.play();
      renderGamePhase(PHASE.PLAYING, {
        mode: client.mode,
        choices: client.choices,
        eliminatedChoices: [],
        currentRound: client.currentRound,
        onChoiceClick: (choice) => {
          peer.sendToHost({ type: MSG.ANSWER, text: choice });
          document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
        },
      }, false);
      const remMs2 = data.remainingMs ?? TIMER.PLAY_DURATION;
      startTimerBar(remMs2, 'timer-bar-client', (remMs2 / TIMER.PLAY_DURATION) * 100);
      if (client.mode !== MODE.FOUR_CHOICES) {
        document.getElementById('btn-buzz').disabled = false;
      }
      break;
    }

    case MSG.BUZZ_QUEUE: {
      client.buzzQueue = data.queue;
      client.phase = PHASE.BUZZED;
      renderGamePhase(PHASE.BUZZED, { buzzQueue: data.queue, players: client.players, currentRound: client.currentRound }, false);

      // Si c'est mon tour de répondre
      if (data.queue[0] === client.myId) {
        handleClientMessage._step = client.answerFormat === ANSWER_FORMAT.BOTH_TOGETHER
          ? 'both'
          : client.answerFormat === ANSWER_FORMAT.EITHER_ONE
            ? 'either'
            : 'artist';
        show('phase-answering');
        const label = document.getElementById('answer-step-label');
        const inp = document.getElementById('answer-input');
        const prompt = ANSWER_PROMPTS[handleClientMessage._step] ?? ANSWER_PROMPTS.artist;
        if (label) label.textContent = prompt.label;
        if (inp) { inp.placeholder = prompt.placeholder; inp.focus(); }
        startTimerBar(TIMER.ANSWER_DURATION, 'timer-bar-client');
      }
      break;
    }

    case MSG.WRONG_CHOICE: {
      if (data.scores) {
        client.players = client.players.map(p => ({
          ...p,
          score: data.scores[p.id] ?? p.score,
        }));
        renderScoreboard(client.players);
      }
      const eliminated = data.eliminatedChoices ?? [];
      renderGamePhase(PHASE.PLAYING, {
        mode: client.mode,
        choices: client.choices,
        eliminatedChoices: eliminated,
        currentRound: client.currentRound,
        onChoiceClick: (choice) => {
          peer.sendToHost({ type: MSG.ANSWER, text: choice });
          document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
        },
      }, false);
      break;
    }

    case MSG.ANSWER_RESULT: {
      client.lastResult = data;
      stopTimerBar();
      renderGamePhase(PHASE.ANSWER_RESULT, { lastResult: data }, false);

      if (data.correct && client.mode === MODE.FOUR_CHOICES) {
        const song = `${data.expected?.title} — ${data.expected?.artist}`;
        highlightCorrectChoice(song);
      }

      // Mise à jour scores
      if (data.scores) {
        client.players = client.players.map(p => ({
          ...p,
          score: data.scores[p.id] ?? p.score,
        }));
        renderScoreboard(client.players);
      }

      const me = client.players.find(p => p.id === client.myId);
      if (me) renderJokers(me, client.players, client.currentRound, onJokerClick, false);
      break;
    }

    case MSG.JOKER_EFFECT: {
      if (data.players) client.players = data.players;
      if (data.scores) {
        client.players = client.players.map(p => ({
          ...p,
          score: data.scores[p.id] ?? p.score,
        }));
      }
      renderScoreboard(client.players);
      const me = client.players.find(p => p.id === client.myId);
      if (me) renderJokers(me, client.players, client.currentRound, onJokerClick, client.phase === PHASE.JOKER_WINDOW);
      showJokerNotification(data);
      break;
    }

    case MSG.ROUND_END: {
      client.phase = PHASE.ROUND_END;
      stopTimerBar();
      client.currentSong = { videoId: data.videoId, title: data.title, artist: data.artist };
      renderGamePhase(PHASE.ROUND_END, {
        currentSong: client.currentSong,
        playbackError: data.playbackError ?? null,
      }, false);
      break;
    }

    case MSG.GAME_OVER: {
      showOnly('screen-results');
      renderFinalResults(data.finalScores);
      break;
    }

    case MSG.KICKED: {
      alert('Vous avez été déconnecté de la partie.');
      showOnly('screen-home');
      break;
    }

    case MSG.HOST_RETURN: {
      // Le relay annonce que l'hôte original est de retour
      document.getElementById('overlay-reconnecting').style.display = 'none';
      peer.connectToHost(data.hostPeerId);
      break;
    }
  }
}

function onJokerClick(type, targetId) {
  peer.sendToHost({ type: MSG.JOKER_USE, jokerType: type, targetId });
}

function showJokerNotification(data) {
  const notif = document.getElementById('joker-notification');
  if (!notif) return;
  const from = client.players.find(p => p.id === data.fromId)?.name ?? '?';
  const target = data.targetId ? client.players.find(p => p.id === data.targetId)?.name ?? '?' : '';
  const msgs = {
    STEAL: `🎯 ${from} vole des points à ${target} !`,
    DOUBLE: `⚡ ${from} active le double !`,
    BLOCK: `🛡️ ${from} bloque ${target} !`,
  };
  notif.textContent = msgs[data.jokerType] ?? '';
  notif.classList.add('show');
  setTimeout(() => notif.classList.remove('show'), 3000);
}

// ─── Relay (hôte temporaire côté client) ─────────────────────────────────────

/** Élit le relay de façon déterministe : premier peer ID non-host trié */
function _electRelayId() {
  const nonHost = client.players.filter(p => p.id !== '__host__').map(p => p.id).sort();
  return nonHost[0] ?? null;
}

/** Ce client prend le rôle d'hôte temporaire */
function _startRelayMode() {
  const overlay = document.getElementById('overlay-reconnecting');
  overlay.innerHTML = [
    '<div style="font-size:2rem">🎤</div>',
    '<p style="font-size:1.1rem;font-weight:600;color:#fff">Vous êtes l\'hôte temporaire</p>',
    '<p style="font-size:0.85rem;color:rgba(255,255,255,.65)">La partie continue automatiquement…</p>',
  ].join('');
  overlay.style.display = 'flex';
  setTimeout(() => { overlay.style.display = 'none'; }, 4000);

  peer.becomeTemporaryHost();

  _relayEngine = new GameEngine(peer, yt, () => {}); // UI pilotée par le relay engine lui-même via broadcast
  _relayEngine.autoAdvance = true;
  _relayEngine.restoreFromSnapshot({
    mode: client.mode,
    answerFormat: client.answerFormat,
    playlist: client._gameCache.playlist,
    shuffled: client._gameCache.shuffled,
    currentRound: client.currentRound,
    currentSong: client.currentSong,
    players: client.players,
    phase: client.phase,
    choices: client.choices,
  });

  // Essayer de reconnecter à l'hôte original en arrière-plan toutes les 10 s
  _relayWatcher = setInterval(() => {
    const conn = peer.connectRaw(hostPeerId);
    if (!conn) return;
    let opened = false;
    conn.on('open', () => {
      if (opened) return;
      opened = true;
      clearInterval(_relayWatcher);
      _relayWatcher = null;
      // Envoyer l'état courant à l'hôte original qui revient
      const snap = {
        type: MSG.STATE_SNAPSHOT,
        mode: client.mode,
        answerFormat: client.answerFormat,
        playlist: client._gameCache.playlist,
        shuffled: client._gameCache.shuffled,
        currentRound: client.currentRound,
        currentSong: _relayEngine ? _relayEngine.state.currentSong : client.currentSong,
        players: _relayEngine ? _relayEngine.state.players : client.players,
        phase: client.phase,
        choices: client.choices,
      };
      conn.send(snap);
      conn.send({ type: MSG.JOIN, name: client.myName });
      // Laisser le temps à l'hôte de restaurer l'état, puis annoncer son retour
      setTimeout(() => {
        _relayEngine?.peer.broadcast({ type: MSG.HOST_RETURN, hostPeerId });
        peer.relinquishTemporaryHost();
        _relayEngine = null;
        try { conn.close(); } catch { /* ignore */ }
        // Se reconnecter soi-même à l'hôte original
        peer.connectToHost(hostPeerId);
      }, 1000);
    });
    // Fermer si pas ouvert après 3s (tentative suivante dans 10s)
    setTimeout(() => { if (!opened) { try { conn.close(); } catch { /* ignore */ } } }, 3000);
  }, 10000);
}

// ─── Démarrage ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
