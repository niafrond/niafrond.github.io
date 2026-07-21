import {
  SEARCH_DEBOUNCE_MS,
} from './constants.js';
import {
  buildSearchResultsSectionsHTML,
  escHtml,
  mapApiTrackToSearchItem,
  sortSearchResultsByPopularity,
} from './searchUtils.js';
import { uiState } from './uiState.js';

/**
 * Gère la recherche de pistes (debounce, rendu des résultats, actions).
 *
 * @param {object} options
 * @param {() => string|null} options.getDownloaderApiUrl
 * @param {{ isOffline: () => boolean }} options.apiHealthMonitor
 * @param {(query: string, limit: number, skipCache: boolean) => Promise<{tracks: object[]}>} options.searchTracksRaw
 * @param {(track: object) => Promise<boolean>} options.deleteLocalCacheSong
 * @param {{ isCrossfading: boolean, activateElement?: () => void }|null} options.getPlayer
 * @param {(track: object, opts?: object) => Promise<void>} options.addToQueue
 * @param {(idx: number, mode: string) => Promise<void>} options.startPlaybackForIndex
 * @param {() => void} options.renderQueue
 * @param {() => 'A'|'B'} options.getResolvedInactiveDeck
 * @param {(deck: 'A'|'B', opts?: object) => Promise<void>} options.launchDeckFromQueue
 * @param {(deck: 'A'|'B') => string} options.deckToPlatineLabel
 * @param {() => void} options.updateDeckCueUI
 * @param {(visible: boolean) => void} options.showCrossfadeRing
 * @param {(msg: string, isError?: boolean) => void} options.showToast
 * @param {(event: string, payload?: object) => void} options.logInfo
 * @param {(event: string, payload?: object) => void} options.logError
 * @param {() => boolean} options.isCacheTabActive
 * @param {(query: string, skipCache?: boolean) => void} options.runCacheSearch
 * @param {HTMLElement|null} options.searchResults
 * @param {HTMLInputElement|null} options.searchInput
 * @param {HTMLElement|null} options.searchClear
 * @param {HTMLElement|null} options.searchClose
 * @param {HTMLElement|null} options.searchOverlay
 * @param {HTMLElement|null} options.autoMixBtn
 */
export function createSearchController(options) {
  const {
    getDownloaderApiUrl,
    apiHealthMonitor,
    searchTracksRaw,
    deleteLocalCacheSong,
    getPlayer,
    addToQueue,
    startPlaybackForIndex,
    renderQueue,
    getResolvedInactiveDeck,
    launchDeckFromQueue,
    deckToPlatineLabel,
    updateDeckCueUI,
    showCrossfadeRing,
    showToast,
    logInfo,
    logError,
    isCacheTabActive,
    runCacheSearch,
    searchResults,
    searchInput,
    searchClear,
    searchClose,
    searchOverlay,
    autoMixBtn,
  } = options;

  let lastSearchQuery = '';
  let pendingSearchAdd = false;
  let searchDebounceTimer = null;

  // ── UI helpers ────────────────────────────────────────────────────────────────

  function openSearch() {
    if (searchOverlay) searchOverlay.hidden = false;
    if (searchClose) searchClose.hidden = false;
  }

  function closeSearch() {
    if (searchOverlay) searchOverlay.hidden = true;
    if (searchClose) searchClose.hidden = true;
  }

  // ── Results rendering ────────────────────────────────────────────────────────

  function bindSearchResults(songResults, artistResults) {
    if (!searchResults) return;
    searchResults.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackName = btn.dataset.trackName;
        const artistName = btn.dataset.artistName;
        const cachePath = btn.dataset.cachePath;
        const track = { name: trackName, artist: artistName, cachePath };
        btn.disabled = true;
        btn.textContent = '…';
        deleteLocalCacheSong(track)
          .then(() => {
            showToast(`Supprimé : ${trackName}`);
            btn.closest('.search-result-item')?.remove();
          })
          .catch((err) => {
            showToast(`Erreur suppression : ${err.message}`, true);
            btn.disabled = false;
            btn.textContent = '🗑';
          });
      });
    });

    searchResults.querySelectorAll('.search-result-item').forEach((el) => {
      const resolveResult = () => {
        const kind = el.dataset.kind;
        const idx = Number(el.dataset.index);
        return kind === 'artist' ? artistResults[idx] : songResults[idx];
      };

      el.querySelector('.play-now-btn')?.addEventListener('click', (event) => {
        event.stopPropagation();
        getPlayer()?.activateElement?.();
        const result = resolveResult();
        if (!result || result?.isArtistResult) return;
        if (pendingSearchAdd) return;

        pendingSearchAdd = true;
        triggerSearchFade(result)
          .catch((err) => {
            showToast(`API: ${err.message}`, true);
          })
          .finally(() => {
            pendingSearchAdd = false;
          });
      });

      el.querySelector('.add-btn')?.addEventListener('click', (event) => {
        event.stopPropagation();
        getPlayer()?.activateElement?.();
        const result = resolveResult();
        if (!result) return;

        if (result?.isArtistResult) {
          if (searchInput) searchInput.value = result.artist || result.name || '';
          if (searchClear) searchClear.hidden = !searchInput?.value;
          lastSearchQuery = '';
          openSearch();
          if (searchResults) searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
          runSearch(searchInput?.value?.trim() || '');
          return;
        }

        if (pendingSearchAdd) return;
        pendingSearchAdd = true;

        addToQueue(result, { asNext: true })
          .catch((err) => {
            showToast(`API: ${err.message}`, true);
          })
          .finally(() => {
            pendingSearchAdd = false;
          });
      });

      el.addEventListener('click', () => {
        getPlayer()?.activateElement?.();
        const result = resolveResult();
        if (!result) return;

        if (result?.isArtistResult) {
          if (searchInput) searchInput.value = result.artist || result.name || '';
          if (searchClear) searchClear.hidden = !searchInput?.value;
          lastSearchQuery = '';
          openSearch();
          if (searchResults) searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
          runSearch(searchInput?.value?.trim() || '');
          return;
        }

        if (pendingSearchAdd) return;
        pendingSearchAdd = true;

        addToQueue(result, { asNext: true })
          .catch((err) => {
            showToast(`API: ${err.message}`, true);
          })
          .finally(() => {
            pendingSearchAdd = false;
          });
      });
    });
  }

  function renderSearchResults(tracks) {
    if (!searchResults) return;
    const seen = new Set();
    const normalized = tracks
      .map(mapApiTrackToSearchItem)
      .filter(Boolean)
      .filter((track) => {
        const key = track.id || `${track.name}|${track.artist}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(sortSearchResultsByPopularity);
    const songResults = normalized.filter((track) => !track.isArtistResult);
    const artistResults = normalized.filter((track) => track.isArtistResult);

    searchResults.innerHTML = buildSearchResultsSectionsHTML(songResults, artistResults);
    bindSearchResults(songResults, artistResults);
  }

  // ── Main search ───────────────────────────────────────────────────────────────

  async function runSearch(query, skipCache = false) {
    logInfo('runSearch(): querying API', { query, skipCache });
    lastSearchQuery = query;

    try {
      if (!getDownloaderApiUrl()) {
        if (searchResults) searchResults.innerHTML = "<div class=\"search-empty\">Configurez l'API de téléchargement dans l'onglet Config</div>";
        return;
      }

      if (apiHealthMonitor.isOffline()) {
        if (searchResults) searchResults.innerHTML = '<div class="search-empty">⚠ API hors ligne – recherche indisponible</div>';
        return;
      }

      const { tracks } = await searchTracksRaw(query, 25, skipCache);
      if (lastSearchQuery !== query) return;

      logInfo('runSearch(): results', { query, count: tracks?.length || 0 });

      if (tracks?.length) {
        renderSearchResults(tracks);
      } else {
        if (searchResults) searchResults.innerHTML = '<div class="search-empty">Aucun résultat</div>';
      }
    } catch (err) {
      logError('runSearch(): failed', { query, message: err?.message });
      if (lastSearchQuery === query && searchResults) {
        searchResults.innerHTML = `<div class="search-empty">⚠ ${escHtml(err.message)}</div>`;
      }
    }
  }

  // ── Queue index lookup ────────────────────────────────────────────────────────

  function getQueueIndexForTrack(track) {
    const trackId = track?.id || track?.ratingKey || track?.uri || track?.name;
    const trackName = track?.name || track?.title || '';
    const trackArtist = track?.artists
      ? track.artists.map((a) => a.name).join(', ')
      : (track?.artist || 'Artiste inconnu');

    return uiState.queue.findIndex(
      (q) => q.id === trackId || (q.name === trackName && q.artist === trackArtist),
    );
  }

  // ── Crossfade trigger from search ────────────────────────────────────────────

  async function triggerSearchFade(track) {
    const player = getPlayer();
    if (!player || player.isCrossfading) return;

    if (!uiState.isPlaying) {
      await addToQueue(track, { playNow: true, preferFade: false });
      return;
    }

    let targetIndex = getQueueIndexForTrack(track);
    if (targetIndex < 0) {
      await addToQueue(track, { asNext: true });
      targetIndex = getQueueIndexForTrack(track);
    }

    if (targetIndex < 0) return;

    const inactiveDeck = getResolvedInactiveDeck();
    uiState.deckBCueIndex = targetIndex;
    uiState.deckCueDeck = inactiveDeck;
    updateDeckCueUI();
    renderQueue();

    await launchDeckFromQueue(inactiveDeck, { paused: true, useCue: true });
    showToast(`Platine ${deckToPlatineLabel(inactiveDeck)} prechargee, AutoMix...`);
    autoMixBtn?.click();
    closeSearch();
  }

  // ── Event bindings ────────────────────────────────────────────────────────────

  function initSearchEvents(searchIcon) {
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        if (searchClear) searchClear.hidden = !q;
        clearTimeout(searchDebounceTimer);

        if (isCacheTabActive?.()) {
          runCacheSearch?.(q);
          return;
        }

        if (!q) {
          if (searchResults) searchResults.innerHTML = '';
          return;
        }

        if (searchResults) searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
        searchDebounceTimer = setTimeout(async () => {
          const term = searchInput.value.trim();
          if (!term) return;
          await runSearch(term);
        }, SEARCH_DEBOUNCE_MS);
      });

      searchInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        const q = searchInput.value.trim();
        event.preventDefault();
        clearTimeout(searchDebounceTimer);
        if (isCacheTabActive?.()) {
          runCacheSearch?.(q, true);
          return;
        }
        if (!q) return;
        if (searchResults) searchResults.innerHTML = '<div class="search-loading">Recherche API...</div>';
        await runSearch(q, true);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        clearTimeout(searchDebounceTimer);
        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.hidden = true;
        if (searchResults) searchResults.innerHTML = '';
        if (isCacheTabActive?.()) runCacheSearch?.('');
      });
    }

    if (searchClose) {
      searchClose.addEventListener('click', closeSearch);
    }

    if (searchOverlay) {
      searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) closeSearch();
      });
    }

    if (searchIcon) {
      searchIcon.addEventListener('click', () => openSearch());
    }
  }

  return {
    openSearch,
    closeSearch,
    runSearch,
    triggerSearchFade,
    getQueueIndexForTrack,
    renderSearchResults,
    initSearchEvents,
  };
}
