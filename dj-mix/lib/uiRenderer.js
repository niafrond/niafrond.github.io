import { escHtml, extractTrackBpm, extractTrackGenre, formatTime } from './searchUtils.js';

export function createDjMixRenderer(options) {
  const {
    deckAPanel,
    deckBPanel,
    deckAVol,
    deckBVol,
    deckAFill,
    deckBFill,
    deckABpm,
    deckBBpm,
    deckABpmReset,
    deckBBpmReset,
    deckALaunchBtn,
    deckBLaunchBtn,
    queueList,
    emptyQueue,
    autoMixBtn,
    albumArt,
    artPlaceholder,
    nextAlbumArt,
    nextArtPlaceholder,
    trackArtist,
    trackArtistA,
    trackArtistB,
    getQueue,
    getDjMode,
    getCurrentIndex,
    getCurrentTrackId,
    getIsPlaying,
    getDeckBCueIndex,
    getDeckCueDeck,
    getInactiveDeck,
    getFocusDeck,
    getDeckDisplayItems,
    getLaunchPreviewState,
    getPrevIsCrossfading,
    setPrevIsCrossfading,
    getDeckMixRatio,
    setDeckMixRatio,
    clampDeckMixRatio,
    updateDeckMixUI,
    updateDeckCueUI,
    getPlayer,
  } = options;

  function composeDeckMeta(title, artist) {
    const safeTitle = String(title || '').trim();
    const safeArtist = String(artist || '').trim();
    if (safeTitle && safeArtist) return `${safeTitle} • ${safeArtist}`;
    return safeTitle || safeArtist || '';
  }

  function isDanceMode() {
    return getDjMode?.() === 'dance';
  }

  function getDanceMetaSuffix(item) {
    if (!isDanceMode()) return '';
    const parts = [];
    const bpm = Number(extractTrackBpm(item));
    const genre = String(extractTrackGenre(item) || '').trim();
    if (Number.isFinite(bpm) && bpm > 0) parts.push(`${Math.round(bpm)} BPM`);
    if (genre) parts.push(genre);
    return parts.length ? ` • ${parts.join(' • ')}` : '';
  }

  function composeDeckMetaWithDance(item) {
    return `${composeDeckMeta(item?.name || '', item?.artist || '')}${getDanceMetaSuffix(item)}`;
  }

  function refreshDeckMetaDisplays() {
    const deckDisplayItems = getDeckDisplayItems();
    const deckAItem = deckDisplayItems?.A || null;
    const deckBItem = deckDisplayItems?.B || null;

    if (trackArtistA) trackArtistA.textContent = deckAItem ? composeDeckMetaWithDance(deckAItem) : '';
    if (trackArtistB) trackArtistB.textContent = deckBItem ? composeDeckMetaWithDance(deckBItem) : '';

    const deckABaseMeta = isDanceMode() ? getDanceMetaSuffix(deckAItem).replace(/^\s*•\s*/, '') : '';
    const deckBBaseMeta = isDanceMode() ? getDanceMetaSuffix(deckBItem).replace(/^\s*•\s*/, '') : '';

    const player = getPlayer();
    const detail = player?._lastDeckState || null;
    const rateA = detail?.deckA?.playbackRate ?? 1;
    const rateB = detail?.deckB?.playbackRate ?? 1;
    const rateAText = Math.abs(rateA - 1) > 0.005 ? `×${rateA.toFixed(2)}` : '';
    const rateBText = Math.abs(rateB - 1) > 0.005 ? `×${rateB.toFixed(2)}` : '';

    if (deckABpm) deckABpm.textContent = [deckABaseMeta, rateAText].filter(Boolean).join(' · ');
    if (deckBBpm) deckBBpm.textContent = [deckBBaseMeta, rateBText].filter(Boolean).join(' · ');
  }

  function renderSourceBadge(item) {
    if (item.sourceState === 'ready') return '• Cache ✓';
    if (item.sourceState === 'resolving') return '• Cache ...';
    if (item.sourceState === 'error') return '• Cache !';
    return '';
  }

  function buildQueueHTML() {
    const queue = getQueue();
    const currentTrackId = getCurrentTrackId();
    const isPlaying = getIsPlaying();
    const deckBCueIndex = getDeckBCueIndex();
    const deckCueDeck = getDeckCueDeck();
    const deckDisplayItems = getDeckDisplayItems();

    const loadedDeckByTrackId = new Map();
    const deckAId = deckDisplayItems?.A?.id;
    const deckBId = deckDisplayItems?.B?.id;
    if (deckAId != null) loadedDeckByTrackId.set(deckAId, 'A');
    if (deckBId != null) {
      const existing = loadedDeckByTrackId.get(deckBId);
      loadedDeckByTrackId.set(deckBId, existing ? 'AB' : 'B');
    }

    return queue.map((item, i) => {
      const isCurrent = item.id === currentTrackId;
      const cls = isCurrent ? 'queue-item is-current' : 'queue-item';
      const showPlayingBars = isCurrent && isPlaying;
      const loadedDeck = loadedDeckByTrackId.get(item.id) || '';
      const cueALoaded = loadedDeck === 'A' || loadedDeck === 'AB';
      const cueBLoaded = loadedDeck === 'B' || loadedDeck === 'AB';

      const numHtml = showPlayingBars
        ? '<div class="queue-num"><div class="playing-bars" aria-label="En cours"><span></span><span></span><span></span></div></div>'
        : `<div class="queue-num">${i + 1}</div>`;
      const cueASelected = deckBCueIndex === i && deckCueDeck === 'A';
      const cueBSelected = deckBCueIndex === i && deckCueDeck === 'B';
      const cueAClass = `queue-cue${cueASelected ? ' is-selected' : ''}${cueALoaded ? ' is-loaded-deck' : ''}`;
      const cueBClass = `queue-cue${cueBSelected ? ' is-selected' : ''}${cueBLoaded ? ' is-loaded-deck' : ''}`;
      const cueADisabled = cueALoaded ? 'disabled aria-disabled="true" title="Déjà chargée sur platine 1"' : '';
      const cueBDisabled = cueBLoaded ? 'disabled aria-disabled="true" title="Déjà chargée sur platine 2"' : '';
      const danceMeta = getDanceMetaSuffix(item);

      return `
      <div class="${cls}" data-index="${i}" role="button" tabindex="0" draggable="true">
        ${numHtml}
        <img class="queue-art" src="${escHtml(item.artUrl)}" alt="" loading="lazy">
        <div class="queue-info">
          <div class="queue-name-wrap">
            <div class="queue-name">${escHtml(item.name)}</div>
          </div>
          <div class="queue-artist">${escHtml(item.artist)} ${renderSourceBadge(item)}${escHtml(danceMeta)}</div>
        </div>
        <span class="queue-duration">${formatTime(item.duration)}</span>
        <div class="queue-actions">
          <button class="${cueAClass}" data-index="${i}" data-deck="A" aria-label="Cue platine 1" ${cueADisabled}>Cue 1</button>
          <button class="${cueBClass}" data-index="${i}" data-deck="B" aria-label="Cue platine 2" ${cueBDisabled}>Cue 2</button>
          <button class="queue-remove" data-index="${i}" aria-label="Retirer">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderDeckState(detail) {
    if (!detail) return;
    
    const deckDisplayItems = getDeckDisplayItems();
    const volA = detail.deckA?.volume || 0;
    const volB = detail.deckB?.volume || 0;
    const hasAudio = volA + volB > 0;
    const focusedDeck = hasAudio ? (volB > volA ? 'B' : 'A') : getFocusDeck();

    if (getPrevIsCrossfading() && !detail.isCrossfading) {
      const clearedDeck = focusedDeck === 'A' ? 'B' : 'A';
      deckDisplayItems[clearedDeck] = null;
    }
    setPrevIsCrossfading(detail.isCrossfading);

    if (deckAPanel) {
      deckAPanel.classList.toggle('is-playing', Boolean(detail.deckA?.playing));
      deckAPanel.classList.toggle('is-active', focusedDeck === 'A');
    }
    if (deckBPanel) {
      deckBPanel.classList.toggle('is-playing', Boolean(detail.deckB?.playing));
      deckBPanel.classList.toggle('is-active', focusedDeck === 'B');
    }

    const bIsDominant = hasAudio && volB > volA;
    if (deckAPanel) deckAPanel.classList.toggle('is-dominant', hasAudio && !bIsDominant);
    if (deckBPanel) deckBPanel.classList.toggle('is-dominant', bIsDominant);
    refreshDeckMetaDisplays();

    // Keep the mix slider state driven by the explicit UI mix ratio.
    // Deriving it back from live deck volumes causes oscillation with smoothing
    // and loudness compensation, which makes the slider flicker.
    
    updateDeckCueUI();

    if (deckAVol) deckAVol.textContent = `${Math.round((detail.deckA?.volume || 0) * 100)}%`;
    if (deckBVol) deckBVol.textContent = `${Math.round((detail.deckB?.volume || 0) * 100)}%`;

    const rateA = detail.deckA?.playbackRate ?? 1;
    const rateB = detail.deckB?.playbackRate ?? 1;
    if (deckABpmReset) deckABpmReset.hidden = Math.abs(rateA - 1) <= 0.005;
    if (deckBBpmReset) deckBBpmReset.hidden = Math.abs(rateB - 1) <= 0.005;

    if (deckALaunchBtn) deckALaunchBtn.textContent = detail.deckA?.playing ? '⏸' : '▶';
    if (deckBLaunchBtn) deckBLaunchBtn.textContent = detail.deckB?.playing ? '⏸' : '▶';

    const player = getPlayer();
    if (player) player._lastDeckState = detail;

    if (deckAFill) {
      const pctA = detail.deckA?.durationMs > 0 ? (detail.deckA.positionMs / detail.deckA.durationMs) * 100 : 0;
      deckAFill.style.width = `${Math.min(100, pctA)}%`;
    }
    if (deckBFill) {
      const pctB = detail.deckB?.durationMs > 0 ? (detail.deckB.positionMs / detail.deckB.durationMs) * 100 : 0;
      deckBFill.style.width = `${Math.min(100, pctB)}%`;
    }
  }

  function updateUpcomingArtwork() {
    const launchPreview = getLaunchPreviewState();
    const queue = getQueue();
    const currentIndex = getCurrentIndex();
    const albumArtA = albumArt;
    const albumArtB = nextAlbumArt;
    const artPlaceholderA = artPlaceholder;
    const artPlaceholderB = nextArtPlaceholder;
    const targetDeck = launchPreview.active && (launchPreview.deck === 'A' || launchPreview.deck === 'B')
      ? launchPreview.deck
      : getInactiveDeck();
    const inactiveArt = targetDeck === 'A' ? albumArtA : albumArtB;
    const inactivePlaceholder = targetDeck === 'A' ? artPlaceholderA : artPlaceholderB;
    const inactiveTrackArtist = targetDeck === 'A' ? trackArtistA : trackArtistB;

    let label = '';
    let artUrl = '';
    let artist = '';

    if (launchPreview.active) {
      label = launchPreview.title || '';
      artUrl = launchPreview.artUrl;
      artist = launchPreview.artist || '';
    } else {
      const next = queue[currentIndex + 1];
      label = next?.name || '';
      artUrl = next?.artUrl || '';
      artist = next?.artist || '';
    }

    if (artUrl) {
      inactiveArt.src = artUrl;
      inactiveArt.hidden = false;
      inactivePlaceholder.style.display = 'none';
    } else {
      inactiveArt.src = '';
      inactiveArt.hidden = true;
      inactivePlaceholder.style.display = '';
    }
    if (inactiveTrackArtist) inactiveTrackArtist.textContent = composeDeckMeta(label, artist);
  
  }

  function updateNowPlaying(item, deck = getFocusDeck()) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.name || 'DJ Mix',
        artist: item.artist || '',
        artwork: item.artUrl ? [{ src: item.artUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }

    const focusArt = deck === 'A' ? albumArt : nextAlbumArt;
    const focusPlaceholder = deck === 'A' ? artPlaceholder : nextArtPlaceholder;

    if (item.artUrl) {
      focusArt.src = item.artUrl;
      focusArt.hidden = false;
      focusPlaceholder.style.display = 'none';
    } else {
      focusArt.src = '';
      focusArt.hidden = true;
      focusPlaceholder.style.display = '';
    }

    if (deck === 'A') {
      
      if (trackArtistA) trackArtistA.textContent = composeDeckMetaWithDance(item);
    } else {
      if (trackArtistB) trackArtistB.textContent = composeDeckMetaWithDance(item);
    }

    if (trackArtist) trackArtist.textContent = item.artist;

    updateUpcomingArtwork();
    refreshDeckMetaDisplays();
  }

  return {
    autoMixBtn,
    buildQueueHTML,
    emptyQueue,
    queueList,
    renderDeckState,
    refreshDeckMetaDisplays,
    updateNowPlaying,
    updateUpcomingArtwork,
  };
}
