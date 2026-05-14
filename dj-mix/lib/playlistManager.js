import { createLogger } from './logger.js';

const logger = createLogger('playlist');

function hasAvailableStems(file) {
  if (!file || typeof file !== 'object') return false;
  const statusReady = String(file.stemsStatus || '').toLowerCase() === 'ready';
  const hasVocals = typeof file.vocalsPath === 'string' && file.vocalsPath.trim().length > 0;
  const hasInstrumental = typeof file.instrumentalPath === 'string' && file.instrumentalPath.trim().length > 0;
  return statusReady || hasVocals || hasInstrumental;
}

export function createPlaylistManager(options) {
  const {
    deleteLocalCacheSong,
    escHtml,
    getCurrentIndex,
    getDownloaderApiUrl,
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
  let cacheFilterQuery = '';

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function renderCacheList() {
    const normalizedFilter = normalizeText(cacheFilterQuery);
    const visibleFiles = normalizedFilter
      ? cacheFiles.filter((file) => {
        const trackName = normalizeText(file.trackName || file.name || file.title);
        const artistName = normalizeText(file.artistName || file.artist);
        return trackName.includes(normalizedFilter) || artistName.includes(normalizedFilter);
      })
      : cacheFiles;

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
        Aucun morceau du cache ne correspond a cette recherche.
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
  }

  function setCacheFilter(query) {
    cacheFilterQuery = String(query || '').trim();
    if (getPlaylistLoaded()) {
      renderCacheList();
    }
  }

  function addCacheFileToQueue(file) {
    if (!file) return;

    const queue = getQueue();
    const item = {
      id: file.id || file.cachePath || file.path || `cache-${Date.now()}`,
      name: file.trackName || file.name || file.title || 'Inconnu',
      artist: file.artistName || file.artist || 'Artiste inconnu',
      artUrl: file.artworkUrl || file.artUrl || '',
      duration: file.duration || 0,
      sourceState: file.cachePath ? 'idle' : 'ready',
      localBlobUrl: file.url || file.localUrl || file.streamUrl || '',
      persistedSourceUrl: file.url || file.localUrl || file.streamUrl || '',
      cachePath: file.cachePath || '',
      ratingKey: file.ratingKey || '',
    };

    const isDuplicateCacheFile = queue.some(
      (q) => q.id === item.id || (q.name === item.name && q.artist === item.artist)
    );
    if (isDuplicateCacheFile) {
      showToast(`Déjà dans la file : ${item.name}`, true);
      return;
    }

    queue.push(item);
    logger.info('playlist.cacheItem.addedToQueue', {
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
      const res = await fetch(`${baseUrl}/api/cache/files`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Erreur ${res.status}: ${res.statusText}`);

      const data = await res.json();
      const files = Array.isArray(data) ? data : (data.results || data.files || []);
      cacheFiles = Array.isArray(files) ? files.slice() : [];
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
