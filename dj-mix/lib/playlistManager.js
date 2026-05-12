import { createLogger } from './logger.js';

const logger = createLogger('playlist');

export function createPlaylistManager(options) {
  const {
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
    tabBtns,
    tabPanels,
  } = options;

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
      logger.info('playlist.cacheList.load.success', {
        baseUrl,
        filesCount: files.length,
      });

      if (!files.length) {
        playlistListEl.innerHTML = `
        <div class="search-empty">
          Aucun fichier en cache. Recherchez des chansons pour les ajouter.
        </div>`;
        return;
      }

      playlistListEl.innerHTML = files.map((file, i) => `
      <div class="cache-item" data-index="${i}">
        <div class="cache-info">
          <div class="cache-name">${escHtml(file.trackName || file.name || file.title || 'Inconnu')}</div>
          <div class="cache-artist">${escHtml(file.artistName || file.artist || 'Artiste inconnu')}</div>
        </div>
        <button class="cache-add-btn" data-index="${i}" aria-label="Ajouter à la file">➕</button>
      </div>
    `).join('');

      playlistListEl.querySelectorAll('.cache-add-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = Number(btn.dataset.index);
          const file = files[idx];
          addCacheFileToQueue(file);
        });
      });
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
    switchTab,
  };
}
