import {
  SPOTIFY_FIL_ROUGE_POLL_MS,
  SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER,
} from './constants.js';
import { STORAGE_KEYS } from './storageKeys.js';

/**
 * Gère la synchronisation Spotify et l'import de playlists TXT dans le fil rouge.
 *
 * @param {object} options
 * @param {object} options.spotifyClient - createSpotifyClient() instance
 * @param {object} options.filRougeManager - createFilRougeManager() instance
 * @param {() => Map<string, object>} options.getFilRougeTrackStatusByKey
 * @param {(track: object, patch: object) => void} options.setFilRougeTrackStatus
 * @param {(track: object) => boolean} options.hasStemsForTrack
 * @param {() => void} options.renderFilRouge
 * @param {(reason: string) => Promise<void>} options.runDjPlanFullPass
 * @param {(items: object[], loopEnabled: boolean) => Promise<void>} options.runDjPlanIncrementalPass
 * @param {(track: object) => Promise<boolean>} options.prefetchTrackToLocalCache
 * @param {{ fetchMixData: (name: string, artist: string) => Promise<void> }} options.autoModeManager
 * @param {(msg: string, isError?: boolean) => void} options.showToast
 * @param {(event: string, payload?: object) => void} options.logWarn
 * @param {HTMLElement|null} options.spotifyStatus
 * @param {HTMLElement|null} options.spotifyConnectionBadge
 * @param {HTMLInputElement|null} options.spotifyClientIdInput
 * @param {HTMLInputElement|null} options.spotifyPlaylistInput
 * @param {HTMLElement|null} options.spotifyConnectBtn
 * @param {HTMLElement|null} options.spotifyDisconnectBtn
 * @param {HTMLElement|null} options.spotifyImportFilRougeBtn
 * @param {HTMLSelectElement|null} options.spotifyPlaylistSelect
 * @param {HTMLElement|null} options.txtPlaylistStatus
 */
export function createSpotifyController(options) {
  const {
    spotifyClient,
    filRougeManager,
    setFilRougeTrackStatus,
    hasStemsForTrack,
    renderFilRouge,
    runDjPlanFullPass,
    runDjPlanIncrementalPass,
    prefetchTrackToLocalCache,
    autoModeManager,
    showToast,
    logWarn,
    spotifyStatus,
    spotifyConnectionBadge,
    spotifyClientIdInput,
    spotifyPlaylistInput,
    spotifyConnectBtn,
    spotifyDisconnectBtn,
    spotifyImportFilRougeBtn,
    spotifyPlaylistSelect,
    txtPlaylistStatus,
  } = options;

  let spotifySyncTimer = null;
  let spotifySyncInFlight = false;
  let spotifySyncBackoffAttempts = 0;
  let spotifyPrefetchGeneration = 0;

  // ── Storage helpers ─────────────────────────────────────────────────────────

  function readSpotifyFilRougeSource() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.spotifyFilRougeSource);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeSpotifyFilRougeSource(source) {
    try {
      if (!source) {
        localStorage.removeItem(STORAGE_KEYS.spotifyFilRougeSource);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.spotifyFilRougeSource, JSON.stringify(source));
    } catch {
      // ignore storage failures
    }
  }

  function addSpotifyDeletedId(trackId) {
    if (trackId == null) return;
    const source = readSpotifyFilRougeSource();
    if (!source?.playlistId) return;
    const deleted = new Set((source.deletedIds || []).map(String));
    deleted.add(String(trackId));
    writeSpotifyFilRougeSource({ ...source, deletedIds: [...deleted] });
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────

  function setSpotifyStatus(message, isError = false) {
    if (!spotifyStatus) return;
    const connected = spotifyClient.isConnected();
    spotifyStatus.textContent = String(message || '');
    spotifyStatus.classList.remove('is-connected', 'is-disconnected', 'is-error');
    if (isError) {
      spotifyStatus.classList.add('is-error');
    } else if (connected) {
      spotifyStatus.classList.add('is-connected');
    } else {
      spotifyStatus.classList.add('is-disconnected');
    }

    if (spotifyConnectionBadge) {
      spotifyConnectionBadge.classList.remove('is-connected', 'is-disconnected', 'is-error');
      if (isError) {
        spotifyConnectionBadge.classList.add('is-error');
        spotifyConnectionBadge.textContent = '● Erreur Spotify';
      } else if (connected) {
        spotifyConnectionBadge.classList.add('is-connected');
        spotifyConnectionBadge.textContent = '● Connecté';
      } else {
        spotifyConnectionBadge.classList.add('is-disconnected');
        spotifyConnectionBadge.textContent = '● Déconnecté';
      }
    }
  }

  function setTxtPlaylistStatus(msg, isError = false) {
    if (!txtPlaylistStatus) return;
    txtPlaylistStatus.textContent = msg;
    txtPlaylistStatus.style.color = isError ? 'var(--error, #e55)' : '';
  }

  function updateSpotifyConfigUi() {
    if (spotifyClientIdInput) {
      spotifyClientIdInput.value = spotifyClient.getStoredClientId();
    }
    const connected = spotifyClient.isConnected();
    const source = readSpotifyFilRougeSource();
    if (spotifyPlaylistInput && source?.playlistId && !spotifyPlaylistInput.value.trim()) {
      spotifyPlaylistInput.value = source.playlistId;
    }
    if (spotifyConnectBtn) spotifyConnectBtn.disabled = connected;
    if (spotifyDisconnectBtn) spotifyDisconnectBtn.disabled = !connected;
    if (spotifyImportFilRougeBtn) spotifyImportFilRougeBtn.disabled = !connected;

    if (spotifyConnectBtn) {
      spotifyConnectBtn.textContent = connected ? 'Spotify connecté' : 'Se connecter';
    }

    if (spotifyPlaylistInput) {
      spotifyPlaylistInput.disabled = !connected;
    }
    if (spotifyPlaylistSelect) {
      spotifyPlaylistSelect.disabled = !connected;
    }

    if (connected) {
      setSpotifyStatus(source?.playlistName
        ? `Spotify connecté. Sync active: ${source.playlistName}`
        : 'Spotify connecté. Vous pouvez importer une playlist dans le fil rouge.');
      return;
    }
    if (spotifyPlaylistSelect) {
      spotifyPlaylistSelect.innerHTML = '<option value="">Choisir une playlist Spotify</option>';
    }
    setSpotifyStatus("Spotify non connecté. Optionnel pour utiliser l'application.");
  }

  async function refreshSpotifyPlaylistDropdown() {
    if (!spotifyPlaylistSelect) return;
    if (!spotifyClient.isConnected()) return;
    try {
      const playlists = await spotifyClient.fetchUserPlaylists();
      const currentVal = spotifyPlaylistSelect.value || spotifyPlaylistInput?.value?.trim() || '';
      spotifyPlaylistSelect.innerHTML = '<option value="">Choisir une playlist Spotify</option>';
      for (const pl of playlists) {
        const opt = document.createElement('option');
        opt.value = pl.playlistId;
        opt.textContent = pl.playlistName || pl.playlistId;
        if (pl.playlistId === currentVal) opt.selected = true;
        spotifyPlaylistSelect.appendChild(opt);
      }
    } catch (err) {
      logWarn('spotify: failed to fetch user playlists', { error: err?.message });
    }
  }

  // ── Sync helpers ─────────────────────────────────────────────────────────────

  function stopSpotifyFilRougeSync() {
    if (spotifySyncTimer) {
      clearTimeout(spotifySyncTimer);
      spotifySyncTimer = null;
    }
  }

  function resetSpotifyFilRougeBackoff() {
    spotifySyncBackoffAttempts = 0;
  }

  function getSpotifyFilRougeNextDelayMs(error) {
    const retryAfterMs = Number(error?.retryAfterMs) || 0;
    const exponentialMs = SPOTIFY_FIL_ROUGE_POLL_MS
      * Math.min(2 ** spotifySyncBackoffAttempts, SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER);
    return Math.max(SPOTIFY_FIL_ROUGE_POLL_MS, retryAfterMs, exponentialMs);
  }

  // ── Track status helpers ─────────────────────────────────────────────────────

  function applySpotifyPlaylistToFilRouge(tracks) {
    filRougeManager.clearPriorityQueue();
    filRougeManager.clearPlaylist();
    for (const track of tracks) {
      setFilRougeTrackStatus(track, {
        downloadState: track?.cachePath || track?.persistedSourceUrl ? 'done' : 'idle',
      });
      filRougeManager.addToPlaylist(track);
    }
    renderFilRouge();
    runDjPlanFullPass('spotify-import').catch(() => {});
  }

  function mergeSpotifyTracksToFilRouge(freshTracks) {
    const source = readSpotifyFilRougeSource();
    const deletedIds = new Set((source?.deletedIds || []).map(String));
    const currentPlaylist = filRougeManager.getPlaylist();
    const currentById = new Map(currentPlaylist.map((item) => [String(item.id), item]));

    let added = 0;
    const merged = [];
    const newIds = [];

    for (const track of freshTracks) {
      const id = String(track.id);
      if (deletedIds.has(id)) continue;

      if (currentById.has(id)) {
        merged.push(currentById.get(id));
      } else {
        setFilRougeTrackStatus(track, {
          downloadState: track?.cachePath || track?.persistedSourceUrl ? 'done' : 'idle',
        });
        merged.push(track);
        newIds.push(id);
        added++;
      }
    }

    filRougeManager.setPlaylist(merged);
    renderFilRouge();

    if (newIds.length) {
      const newItems = filRougeManager.getPlaylist().filter((item) => newIds.includes(String(item.id)));
      runDjPlanIncrementalPass(newItems, filRougeManager.isLoopEnabled()).catch(() => {});
    }

    return { added };
  }

  async function syncSpotifyFilRougeIfChanged(opts = {}) {
    const { silent = false } = opts;
    const source = readSpotifyFilRougeSource();
    if (!source?.playlistId) return false;
    if (spotifySyncInFlight) return false;
    spotifySyncInFlight = true;
    try {
      const snapshot = await spotifyClient.fetchPlaylistSnapshot(source.playlistId);
      if (snapshot?.snapshot_id && source.snapshotId && snapshot.snapshot_id === source.snapshotId) {
        return false;
      }

      const { tracks, fingerprint } = await spotifyClient.fetchPlaylistTracks(source.playlistId);
      const { added } = mergeSpotifyTracksToFilRouge(tracks);
      writeSpotifyFilRougeSource({
        ...source,
        playlistName: snapshot?.name || source.playlistName || '',
        snapshotId: snapshot?.snapshot_id || '',
        fingerprint,
        updatedAt: Date.now(),
      });
      updateSpotifyConfigUi();
      if (!silent) {
        const msg = added > 0
          ? `Fil rouge Spotify mis à jour (+${added} nouveau${added > 1 ? 'x' : ''})`
          : `Fil rouge Spotify mis à jour`;
        showToast(msg);
      }
      startSpotifyPlaylistPrefetch(tracks).catch(() => {});
      return true;
    } catch (err) {
      if (!silent) setSpotifyStatus(`Erreur sync Spotify: ${err.message}`, true);
      throw err;
    } finally {
      spotifySyncInFlight = false;
    }
  }

  function startSpotifyFilRougeSyncLoop() {
    stopSpotifyFilRougeSync();
    resetSpotifyFilRougeBackoff();
    const source = readSpotifyFilRougeSource();
    if (!source?.playlistId || !spotifyClient.isConnected()) return;

    const runSync = async () => {
      const currentSource = readSpotifyFilRougeSource();
      if (!currentSource?.playlistId || !spotifyClient.isConnected()) {
        stopSpotifyFilRougeSync();
        return;
      }

      let nextDelayMs = SPOTIFY_FIL_ROUGE_POLL_MS;
      try {
        await syncSpotifyFilRougeIfChanged({ silent: true });
        resetSpotifyFilRougeBackoff();
      } catch (err) {
        spotifySyncBackoffAttempts = Math.min(
          spotifySyncBackoffAttempts + 1,
          Math.log2(SPOTIFY_FIL_ROUGE_BACKOFF_MAX_MULTIPLIER),
        );
        nextDelayMs = getSpotifyFilRougeNextDelayMs(err);
      }

      spotifySyncTimer = setTimeout(() => {
        runSync().catch(() => {});
      }, nextDelayMs);
    };

    spotifySyncTimer = setTimeout(() => {
      runSync().catch(() => {});
    }, SPOTIFY_FIL_ROUGE_POLL_MS);
  }

  async function importSpotifyPlaylistToFilRouge(playlistInputEl) {
    const parsedId = spotifyClient.parseSpotifyPlaylistId(playlistInputEl?.value);
    if (!parsedId) {
      throw new Error('Playlist Spotify invalide (URL/URI/ID attendu)');
    }
    const snapshot = await spotifyClient.fetchPlaylistSnapshot(parsedId);
    const { tracks, fingerprint } = await spotifyClient.fetchPlaylistTracks(parsedId);
    applySpotifyPlaylistToFilRouge(tracks);
    writeSpotifyFilRougeSource({
      playlistId: parsedId,
      playlistName: snapshot?.name || '',
      snapshotId: snapshot?.snapshot_id || '',
      fingerprint,
      updatedAt: Date.now(),
    });
    startSpotifyFilRougeSyncLoop();
    updateSpotifyConfigUi();
    showToast(`Fil rouge importé depuis Spotify (${tracks.length} morceau${tracks.length > 1 ? 'x' : ''})`);
    startSpotifyPlaylistPrefetch(tracks).catch(() => {});
  }

  async function startSpotifyPlaylistPrefetch(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    const generation = ++spotifyPrefetchGeneration;
    let cached = 0;
    let failed = 0;
    const BATCH_SIZE = 3;
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      if (spotifyPrefetchGeneration !== generation) return;
      const batch = tracks.slice(i, i + BATCH_SIZE);
      setSpotifyStatus(`Cache Spotify : ${i + 1}–${Math.min(i + BATCH_SIZE, tracks.length)} / ${tracks.length}…`);
      const batchResults = await Promise.allSettled(
        batch.map((track) => prefetchTrackToLocalCache(track).catch(() => false)),
      );
      for (let j = 0; j < batch.length; j++) {
        const track = batch[j];
        const ok = batchResults[j].status === 'fulfilled' && batchResults[j].value;
        if (ok) {
          cached++;
          autoModeManager.fetchMixData(track.name, track.artist).catch(() => {});
        } else {
          failed++;
        }
      }
    }
    if (spotifyPrefetchGeneration !== generation) return;
    const summary = failed > 0
      ? `Cache Spotify : ${cached} mis en cache, ${failed} échec${failed > 1 ? 's' : ''}`
      : `Cache Spotify : ${cached} morceau${cached > 1 ? 'x' : ''} mis en cache`;
    setSpotifyStatus(summary);
  }

  // ── TXT playlist helpers ─────────────────────────────────────────────────────

  function parseTxtPlaylist(text) {
    const tracks = [];
    const lines = String(text || '').split(/\r?\n/);
    for (const line of lines) {
      const rawTrimmed = line.trim();
      if (!rawTrimmed || rawTrimmed.startsWith('#')) continue;
      // Strip leading line numbers: "1. ", "1- ", "1) ", "1: ", or bare "1 "
      const trimmed = rawTrimmed.replace(/^\d+(?:[.):]\s*|-\s*|\s+)/, '');
      if (!trimmed) continue;
      let artist, name;
      const splitMatch = trimmed.match(/^(.+?)\s+(?:-|–|—)\s+(.+)$/u);
      if (splitMatch) {
        artist = splitMatch[1].trim();
        name = splitMatch[2].trim();
      } else {
        artist = 'Artiste inconnu';
        name = trimmed;
      }
      if (!name) continue;
      tracks.push({
        id: `txt-${tracks.length}-${encodeURIComponent(artist)}-${encodeURIComponent(name)}`,
        name,
        artist: artist || 'Artiste inconnu',
        artUrl: '',
        duration: 0,
        bpm: null,
        genre: '',
        cachePath: '',
        persistedSourceUrl: '',
        ratingKey: '',
        stemsStatus: '',
        stems: null,
        source: 'txt',
      });
    }
    return tracks;
  }

  function applyTxtPlaylistToFilRouge(tracks, fetchArtwork) {
    stopSpotifyFilRougeSync();
    writeSpotifyFilRougeSource(null);
    spotifyPrefetchGeneration++;
    filRougeManager.clearPriorityQueue();
    filRougeManager.clearPlaylist();
    for (const track of tracks) {
      setFilRougeTrackStatus(track, { downloadState: 'idle' });
      filRougeManager.addToPlaylist(track);
    }
    updateSpotifyConfigUi();
    renderFilRouge();
    runDjPlanFullPass('txt-import').catch(() => {});
    if (typeof fetchArtwork === 'function') {
      startTxtPlaylistPrefetch(tracks, fetchArtwork).catch(() => {});
    }
  }

  async function startTxtPlaylistPrefetch(tracks, fetchArtwork) {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    const generation = ++spotifyPrefetchGeneration;
    let cached = 0;
    let failed = 0;

    const BATCH_SIZE = 3;
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      if (spotifyPrefetchGeneration !== generation) return;
      const batch = tracks.slice(i, i + BATCH_SIZE);
      for (const track of batch) {
        setFilRougeTrackStatus(track, { downloadState: 'downloading' });
      }
      setTxtPlaylistStatus(`Téléchargement serveur TXT : ${i + 1}–${Math.min(i + BATCH_SIZE, tracks.length)} / ${tracks.length}…`);
      renderFilRouge();
      const batchResults = await Promise.allSettled(
        batch.map((track) => prefetchTrackToLocalCache(track).catch(() => false)),
      );
      await Promise.allSettled(
        batchResults.map(async (result, j) => {
          const track = batch[j];
          const ok = result.status === 'fulfilled' && result.value;
          if (ok) {
            cached++;
            const mixData = await autoModeManager.fetchMixData(track.name, track.artist).catch(() => null);
            setFilRougeTrackStatus(track, { downloadState: 'done', hasMixInfo: Boolean(mixData) });
          } else {
            failed++;
            setFilRougeTrackStatus(track, { downloadState: 'error' });
          }
          if (typeof fetchArtwork === 'function') {
            await fetchArtwork(track).catch(() => {});
          }
        }),
      );
      renderFilRouge();
    }

    if (spotifyPrefetchGeneration !== generation) return;
    const summary = failed > 0
      ? `Import TXT : ${cached} mis en cache serveur, ${failed} échec${failed > 1 ? 's' : ''}.`
      : `Import TXT : ${cached} morceau${cached > 1 ? 'x' : ''} mis en cache serveur.`;
    setTxtPlaylistStatus(summary, failed > 0 && cached === 0);
  }

  return {
    readSpotifyFilRougeSource,
    writeSpotifyFilRougeSource,
    addSpotifyDeletedId,
    setSpotifyStatus,
    updateSpotifyConfigUi,
    refreshSpotifyPlaylistDropdown,
    stopSpotifyFilRougeSync,
    startSpotifyFilRougeSyncLoop,
    syncSpotifyFilRougeIfChanged,
    importSpotifyPlaylistToFilRouge,
    applySpotifyPlaylistToFilRouge,
    mergeSpotifyTracksToFilRouge,
    parseTxtPlaylist,
    applyTxtPlaylistToFilRouge,
  };
}
