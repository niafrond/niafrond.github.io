import { createLogger } from './logger.js';
import { extractTrackBpm, extractTrackGenre } from './searchUtils.js';
import { appendApiToken, resolveCdnArtworkUrl } from './downloaderConfig.js';

const logger = createLogger('playlist');

// SPEC-13.3.9 — file.artworkUrl coming from GET /api/cache/files may be a
// raw `/api/artwork?cachePath=...` reference (see swagger `getArtwork`):
// relative to the CDN, not to this app's own origin. Left unresolved, an
// <img src> built from it resolves against the page's own host instead
// (e.g. the GitHub Pages deployment) and 404s. Only rewrite that shape;
// an already-absolute artUrl/artworkUrl (iTunes/Deezer, or a previously
// resolved CDN URL) passes through untouched.
export function resolveCacheFileArtUrl(file, cdnBaseUrl, token) {
  const raw = file?.artworkUrl || file?.artUrl || '';
  if (typeof raw === 'string' && raw.startsWith('/api/artwork')) {
    return resolveCdnArtworkUrl(raw, cdnBaseUrl, token) || '';
  }
  return raw;
}

function hasAvailableStems(file) {
  if (!file || typeof file !== 'object') return false;
  const statusReady = String(file.stemsStatus || '').toLowerCase() === 'ready';
  const hasVocals = [file.vocals, file.vocalsPath, file.vocalsUrl, file.stems?.vocals, file.stems?.vocalsUrl]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
  const hasInstrumental = [file.instrumental, file.instrumentalPath, file.instrumentalUrl, file.stems?.instrumental, file.stems?.instrumentalUrl]
    .some((value) => typeof value === 'string' && value.trim().length > 0);
  return statusReady || hasVocals || hasInstrumental;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function appendFacetValues(target, value) {
  if (Array.isArray(value)) {
    value.forEach((entry) => appendFacetValues(target, entry));
    return;
  }

  if (value && typeof value === 'object') {
    appendFacetValues(target, value.name);
    appendFacetValues(target, value.label);
    appendFacetValues(target, value.value);
    return;
  }

  if (typeof value !== 'string' && typeof value !== 'number') return;

  String(value)
    .split(/[;,|]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => target.push(entry));
}

function dedupeFacetValues(values) {
  const seen = new Map();
  values.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.set(normalized, String(value).trim());
  });
  return Array.from(seen.values());
}

export function extractCacheGenres(file) {
  const values = [];
  const rhythm = file?.audioFeatures?.rhythm;

  [
    file?.genre,
    file?.genres,
    file?.genreName,
    file?.genreNames,
    file?.primaryGenreName,
    file?.style,
    file?.styles,
    file?.tags,
    file?.metadata?.genre,
    file?.metadata?.genres,
    file?.album?.genre,
    file?.album?.genres,
    file?.audioFeatures?.genre,
    file?.audioFeatures?.genres,
    rhythm ? `Rythme: ${rhythm}` : '',
  ].forEach((candidate) => appendFacetValues(values, candidate));

  return dedupeFacetValues(values);
}

export function extractCacheYear(file) {
  const candidates = [
    file?.year,
    file?.releaseYear,
    file?.release_date,
    file?.releaseDate,
    file?.release_date_local,
    file?.albumYear,
    file?.date,
    file?.publishedAt,
    file?.metadata?.year,
    file?.metadata?.date,
    file?.album?.release_date,
    file?.album?.releaseDate,
    file?.album?.year,
  ];

  for (const candidate of candidates) {
    const match = String(candidate || '').match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return match[1];
  }

  return '';
}

function buildCacheSearchText(file) {
  return normalizeText([
    file?.trackName,
    file?.name,
    file?.title,
    file?.artistName,
    file?.artist,
    extractCacheYear(file),
    ...extractCacheGenres(file),
  ].filter(Boolean).join(' '));
}

export function collectCacheFilterOptions(files) {
  const genres = new Set();
  const years = new Set();
  let hasStemmedTracks = false;

  (Array.isArray(files) ? files : []).forEach((file) => {
    extractCacheGenres(file).forEach((genre) => genres.add(genre));
    const year = extractCacheYear(file);
    if (year) years.add(year);
    if (!hasStemmedTracks && hasAvailableStems(file)) {
      hasStemmedTracks = true;
    }
  });

  return {
    genres: Array.from(genres).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })),
    hasStemmedTracks,
    years: Array.from(years).sort((a, b) => Number(b) - Number(a)),
  };
}

export function filterCacheFiles(files, filters = {}) {
  const normalizedQuery = normalizeText(filters.query);
  const selectedGenre = normalizeText(filters.genre);
  const selectedYear = String(filters.year || '').trim();
  const stemsOnly = Boolean(filters.stemsOnly);

  return (Array.isArray(files) ? files : []).filter((file) => {
    if (normalizedQuery && !buildCacheSearchText(file).includes(normalizedQuery)) {
      return false;
    }

    if (selectedGenre) {
      const genres = extractCacheGenres(file).map((genre) => normalizeText(genre));
      if (!genres.includes(selectedGenre)) return false;
    }

    if (selectedYear && extractCacheYear(file) !== selectedYear) {
      return false;
    }

    if (stemsOnly && !hasAvailableStems(file)) {
      return false;
    }

    return true;
  });
}

export function createPlaylistManager(options) {
  const {
    addToFilRouge,
    addToPriorityQueue,
    cacheFilterCountEl,
    cacheGenreFilterEl,
    cacheResetFiltersBtn,
    cacheStemsFilterEl,
    cacheYearFilterEl,
    deleteLocalCacheSong,
    escHtml,
    getCurrentIndex,
    getDownloaderApiToken,
    getDownloaderApiUrl,
    getDownloaderCdnUrl,
    getPlayer,
    getPlaylistLoaded,
    getQueue,
    playlistListEl,
    renderQueue,
    saveQueue,
    setCurrentIndex,
    setPendingAutoplay,
    setPlaylistLoaded,
    showToast,
    startPlaybackForIndex,
    triggerCacheFade,
    tabBtns,
    tabPanels,
  } = options;

  let cacheFiles = [];
  const cacheFilters = {
    genre: '',
    query: '',
    stemsOnly: false,
    year: '',
  };

  function hasActiveCacheFilters() {
    return Boolean(cacheFilters.query || cacheFilters.genre || cacheFilters.year || cacheFilters.stemsOnly);
  }

  function renderFilterOptions() {
    const { genres, hasStemmedTracks, years } = collectCacheFilterOptions(cacheFiles);

    if (cacheGenreFilterEl) {
      cacheGenreFilterEl.innerHTML = [
        '<option value="">Tous les genres</option>',
        ...genres.map((genre) => `<option value="${escHtml(genre)}">${escHtml(genre)}</option>`),
      ].join('');
      cacheGenreFilterEl.value = cacheFilters.genre;
      cacheGenreFilterEl.disabled = genres.length === 0;
    }

    if (cacheYearFilterEl) {
      cacheYearFilterEl.innerHTML = [
        '<option value="">Toutes les années</option>',
        ...years.map((year) => `<option value="${escHtml(year)}">${escHtml(year)}</option>`),
      ].join('');
      cacheYearFilterEl.value = cacheFilters.year;
      cacheYearFilterEl.disabled = years.length === 0;
    }

    if (cacheStemsFilterEl) {
      cacheStemsFilterEl.checked = cacheFilters.stemsOnly;
      cacheStemsFilterEl.disabled = !hasStemmedTracks;
      if (!hasStemmedTracks) {
        cacheFilters.stemsOnly = false;
        cacheStemsFilterEl.checked = false;
      }
    }

    if (cacheResetFiltersBtn) {
      cacheResetFiltersBtn.hidden = !hasActiveCacheFilters();
    }
  }

  function renderCacheList() {
    renderFilterOptions();
    let visibleFiles = filterCacheFiles(cacheFiles, cacheFilters);

    // Trier alphabétiquement par titre
    visibleFiles = visibleFiles.slice().sort((a, b) => {
      const titleA = (a.trackName || a.name || a.title || 'Inconnu').toLowerCase();
      const titleB = (b.trackName || b.name || b.title || 'Inconnu').toLowerCase();
      return titleA.localeCompare(titleB, 'fr');
    });

    if (cacheFilterCountEl) {
      cacheFilterCountEl.textContent = cacheFiles.length
        ? `${visibleFiles.length} / ${cacheFiles.length} morceau${cacheFiles.length > 1 ? 'x' : ''}`
        : '0 morceau';
    }

    if (!cacheFiles.length) {
      playlistListEl.innerHTML = `
      <div class="search-empty">
        Aucun fichier en cache. Recherchez des chansons pour les ajouter.
      </div>`;
      return;
    }

    if (!visibleFiles.length) {
      playlistListEl.innerHTML = `
      <div class="search-empty">
        Aucun morceau du cache ne correspond aux filtres actifs.
      </div>`;
      return;
    }

    playlistListEl.innerHTML = visibleFiles.map((file) => {
      const sourceIndex = cacheFiles.indexOf(file);
      return `
      <div class="cache-item" data-index="${sourceIndex}">
        <div class="cache-info">
          <div class="cache-name">${escHtml(file.trackName || file.name || file.title || 'Inconnu')}${hasAvailableStems(file) ? ' <span class="cache-stem-badge" title="Stems disponibles">🧩</span>' : ''}</div>
          <div class="cache-artist">${escHtml(file.artistName || file.artist || 'Artiste inconnu')}</div>
        </div>
        <div class="cache-actions">
          <button class="cache-fade-btn" data-index="${sourceIndex}" aria-label="Charger sur platine inactive puis AutoMix">Fade</button>
          <button class="cache-add-btn" data-index="${sourceIndex}" aria-label="Ajouter a la file">➕</button>
          <button class="cache-filrouge-btn" data-index="${sourceIndex}" aria-label="Ajouter au fil rouge" title="Ajouter au fil rouge">🎶</button>
          <button class="cache-priority-btn" data-index="${sourceIndex}" aria-label="File du mix" title="Ajouter à la file du mix">⏭</button>
          <button class="cache-delete-btn" data-index="${sourceIndex}" aria-label="Supprimer du cache API">🗑</button>
        </div>
      </div>
    `;
    }).join('');

    playlistListEl.querySelectorAll('.cache-add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const file = cacheFiles[idx];
        addCacheFileToQueue(file);
      });
    });

    playlistListEl.querySelectorAll('.cache-fade-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const file = cacheFiles[idx];
        if (!file) return;

        const previous = btn.textContent;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await triggerCacheFade?.(file);
        } catch (err) {
          showToast(`Erreur fade: ${err.message}`, true);
        } finally {
          btn.disabled = false;
          btn.textContent = previous;
        }
      });
    });

    playlistListEl.querySelectorAll('.cache-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const file = cacheFiles[idx];
        if (!file) return;

        const track = {
          cachePath: file.cachePath || '',
          name: file.trackName || file.name || file.title || '',
          artist: file.artistName || file.artist || '',
        };

        const previous = btn.textContent;
        btn.disabled = true;
        btn.textContent = '…';
        try {
          await deleteLocalCacheSong(track);
          showToast(`Supprime: ${track.name || 'morceau cache'}`);
          cacheFiles.splice(idx, 1);
          renderCacheList();
        } catch (err) {
          showToast(`Erreur suppression: ${err.message}`, true);
          btn.disabled = false;
          btn.textContent = previous;
        }
      });
    });

    playlistListEl.querySelectorAll('.cache-filrouge-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const file = cacheFiles[idx];
        if (file && addToFilRouge) addToFilRouge(file);
      });
    });

    playlistListEl.querySelectorAll('.cache-priority-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const file = cacheFiles[idx];
        if (file && addToPriorityQueue) addToPriorityQueue(file);
      });
    });
  }

  function setCacheFilter(query) {
    cacheFilters.query = String(query || '').trim();
    if (getPlaylistLoaded()) {
      renderCacheList();
    }
  }

  function resetCacheFilters() {
    cacheFilters.genre = '';
    cacheFilters.stemsOnly = false;
    cacheFilters.year = '';
    if (cacheGenreFilterEl) cacheGenreFilterEl.value = '';
    if (cacheYearFilterEl) cacheYearFilterEl.value = '';
    if (cacheStemsFilterEl) cacheStemsFilterEl.checked = false;
    if (getPlaylistLoaded()) {
      renderCacheList();
    } else {
      renderFilterOptions();
    }
  }

  function addCacheFileToQueue(file) {
    if (!file) return;

    const vocalsSource = file.vocals || file.vocalsUrl || file.vocalsPath || file.stems?.vocals || file.stems?.vocalsUrl || '';
    const instrumentalSource = file.instrumental || file.instrumentalUrl || file.instrumentalPath || file.stems?.instrumental || file.stems?.instrumentalUrl || '';
    const queue = getQueue();
    const item = {
      id: file.id || file.cachePath || file.path || `cache-${Date.now()}`,
      name: file.trackName || file.name || file.title || 'Inconnu',
      artist: file.artistName || file.artist || 'Artiste inconnu',
      artUrl: resolveCacheFileArtUrl(file, getDownloaderCdnUrl?.() || getDownloaderApiUrl?.() || '', getDownloaderApiToken?.()),
      duration: file.duration || 0,
      bpm: extractTrackBpm(file),
      genre: extractTrackGenre(file),
      sourceState: file.cachePath ? 'idle' : 'ready',
      localBlobUrl: file.url || file.localUrl || file.streamUrl || '',
      persistedSourceUrl: file.url || file.localUrl || file.streamUrl || '',
      cachePath: file.cachePath || '',
      ratingKey: file.ratingKey || '',
      stemsStatus: file.stemsStatus || '',
      vocals: vocalsSource,
      instrumental: instrumentalSource,
      stems: {
        vocals: vocalsSource,
        instrumental: instrumentalSource,
      },
    };

    const isDuplicateCacheFile = queue.some(
      (q) => q.id === item.id || (q.name === item.name && q.artist === item.artist)
    );
    if (isDuplicateCacheFile) {
      showToast(`Déjà dans la file : ${item.name}`, true);
      return;
    }

    const currentIndex = getCurrentIndex();
    const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
    const currentIsFilRouge = currentTrack?.queueSource === 'fil-rouge';
    const firstFilRougeIndex = queue.findIndex((entry) => entry.queueSource === 'fil-rouge');
    const insertIndex = currentIsFilRouge
      ? Math.min(currentIndex + 1, queue.length)
      : (firstFilRougeIndex >= 0 ? firstFilRougeIndex : queue.length);
    queue.splice(insertIndex, 0, item);

    logger.info('playlist.cacheItem.addedToQueue', {
      addedIndex: insertIndex,
      id: item.id,
      name: item.name,
      artist: item.artist,
      queueLength: queue.length,
    });

    if (getCurrentIndex() < 0 && queue.length === 1) {
      setCurrentIndex(0);
      setPendingAutoplay(true);
      const player = getPlayer();
      if (player && player.isReady) {
        startPlaybackForIndex(0, 'play').catch((err) => showToast(`Erreur: ${err.message}`, true));
      }
    }
    renderQueue();
    saveQueue();
    showToast(`"${item.name}" ajouté à la file`);
  }

  async function fetchAllCacheFiles(baseUrl, onProgress) {
    const headers = { Accept: 'application/json' };
    const pageSize = 200;
    const allFiles = [];
    let offset = 0;
    let pageIndex = 0;

    while (true) {
      const pageUrl = appendApiToken(`${baseUrl}/api/cache/files?limit=${pageSize}&offset=${offset}`, getDownloaderApiToken?.());
      const res = await fetch(pageUrl, { headers });
      if (!res.ok) throw new Error(`Erreur ${res.status}: ${res.statusText}`);

      const data = await res.json();
      if (Array.isArray(data)) {
        return data.slice();
      }

      const pageResults = Array.isArray(data?.results)
        ? data.results
        : (Array.isArray(data?.files) ? data.files : []);

      allFiles.push(...pageResults);

      if (typeof onProgress === 'function') {
        onProgress({
          files: allFiles,
          pageResults,
          hasMore: Boolean(data?.hasMore),
          count: Number.isFinite(Number(data?.count)) ? Number(data.count) : null,
        });
      }

      const hasMore = Boolean(data?.hasMore);
      if (!hasMore || pageResults.length === 0) {
        break;
      }

      offset += pageResults.length;
      pageIndex += 1;

      // Safety net against malformed pagination responses.
      if (pageIndex > 1000) {
        throw new Error('Pagination cache interrompue (trop de pages)');
      }
    }

    return allFiles;
  }

  async function loadPlaylists() {
    setPlaylistLoaded(true);
    logger.info('playlist.cacheList.load.begin');

    const baseUrl = getDownloaderApiUrl();
    if (!baseUrl) {
      logger.warn('playlist.cacheList.load.missingApiUrl');
      playlistListEl.innerHTML = `
      <div class="search-empty">
        URL API manquante. Configurez l'API dans l'onglet Configuration.
      </div>`;
      return;
    }

    playlistListEl.innerHTML = '<div class="search-loading">Chargement du cache...</div>';

    try {
      cacheFiles = await fetchAllCacheFiles(baseUrl, ({ files, hasMore, count }) => {
        cacheFiles = files.slice();
        if (!cacheFiles.length) {
          renderFilterOptions();
          playlistListEl.innerHTML = '<div class="search-loading">Chargement du cache...</div>';
          return;
        }

        renderCacheList();

        if (hasMore) {
          const loaded = cacheFiles.length;
          logger.info('playlist.cacheList.load.progress', { loaded, count });
        }
      });
      logger.info('playlist.cacheList.load.success', {
        baseUrl,
        filesCount: cacheFiles.length,
      });

      renderCacheList();
    } catch (err) {
      logger.error('playlist.cacheList.load.failed', {
        message: err?.message,
      });
      playlistListEl.innerHTML = `
      <div class="search-empty">
        Erreur lors du chargement du cache: ${escHtml(err.message)}
      </div>`;
    }
  }

  cacheGenreFilterEl?.addEventListener('change', () => {
    cacheFilters.genre = String(cacheGenreFilterEl.value || '').trim();
    if (getPlaylistLoaded()) renderCacheList();
  });

  cacheYearFilterEl?.addEventListener('change', () => {
    cacheFilters.year = String(cacheYearFilterEl.value || '').trim();
    if (getPlaylistLoaded()) renderCacheList();
  });

  cacheStemsFilterEl?.addEventListener('change', () => {
    cacheFilters.stemsOnly = Boolean(cacheStemsFilterEl.checked);
    if (getPlaylistLoaded()) renderCacheList();
  });

  cacheResetFiltersBtn?.addEventListener('click', () => {
    resetCacheFilters();
  });

  renderFilterOptions();

  function switchTab(name) {
    tabBtns.forEach((btn) => {
      const on = btn.dataset.tab === name;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    Object.entries(tabPanels).forEach(([key, panel]) => {
      const on = key === name;
      panel.classList.toggle('active', on);
      panel.hidden = !on;
    });

    if (name === 'playlist' && !getPlaylistLoaded()) loadPlaylists();
  }

  return {
    addCacheFileToQueue,
    loadPlaylists,
    setCacheFilter,
    switchTab,
  };
}
