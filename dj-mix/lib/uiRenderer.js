import { escHtml, extractTrackBpm, extractTrackGenre, formatTime } from './searchUtils.js';
import { pushNowPlaying } from './androidAutoBridge.js';

async function _fetchArtworkDataUri(url) {
  if (!url) return '';
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

const MAX_VISIBLE_PLAYED_TRACKS = 5;

export function createDjMixRenderer(options) {
  const {
    deckAPanel,
    deckBPanel,
    deckAVol,
    deckBVol,
    deckAFill,
    deckBFill,
    deckATime,
    deckBTime,
    deckATitle,
    deckBTitle,
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

  const lastDeckMetaItems = {
    A: null,
    B: null,
  };

  // Tracks last-rendered state to avoid redundant DOM writes on every deckstate tick
  const lastRenderedMeta = {
    A: { id: undefined, mode: undefined },
    B: { id: undefined, mode: undefined },
  };

  // Tracks last-rendered deck state to skip writes when nothing changed
  const lastRenderedDeckState = {
    A: { playing: undefined, volPct: undefined, fillPct: undefined, rateHidden: undefined, timeText: undefined },
    B: { playing: undefined, volPct: undefined, fillPct: undefined, rateHidden: undefined, timeText: undefined },
  };

  function composeDeckMeta(title, artist) {
    const safeTitle = String(title || '').trim();
    const safeArtist = String(artist || '').trim();
    if (safeTitle && safeArtist) return `${safeTitle} • ${safeArtist}`;
    return safeTitle || safeArtist || '';
  }

  function getMediaSessionArtwork(item) {
    if (item?.artUrl) {
      return [{ src: item.artUrl, sizes: '512x512', type: 'image/jpeg' }];
    }

    return [{
      src: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 512 512%27%3E%3Crect width=%27512%27 height=%27512%27 rx=%27100%27 fill=%270a0a0f%27/%3E%3Ctext x=%27256%27 y=%27340%27 text-anchor=%27middle%27 font-size=%27300%27%3E%F0%9F%8E%9A%EF%B8%8F%3C/text%3E%3C/svg%3E',
      sizes: '512x512',
      type: 'image/svg+xml',
    }];
  }

  function buildDanceMetaChips(item, extraClass = '') {
    const bpm = Number(extractTrackBpm(item));
    const genre = String(extractTrackGenre(item) || '').trim();
    const bpmHtml = Number.isFinite(bpm) && bpm > 0 ? `<span class="queue-chip">${Math.round(bpm)} BPM</span>` : '';
    const genreHtml = genre
      ? `<button type="button" class="queue-chip queue-chip--genre" data-genre="${escHtml(genre)}" aria-label="Filtrer par genre ${escHtml(genre)}">${escHtml(genre)}</button>`
      : '';
    if (!bpmHtml && !genreHtml) return '';
    const className = extraClass ? `queue-chips ${extraClass}` : 'queue-chips';
    return `<div class="${className}">${bpmHtml}${genreHtml}</div>`;
  }

  function renderDeckMetaContent(target, item, fallbackTitle = '', fallbackArtist = '') {
    if (!target) return;
    const mainLabel = item
      ? composeDeckMeta(item?.name || '', item?.artist || '')
      : composeDeckMeta(fallbackTitle, fallbackArtist);
    const chipsHtml = item ? buildDanceMetaChips(item, 'deck-chips') : '';
    target.innerHTML = mainLabel
      ? `<div class="deck-track-main">${escHtml(mainLabel)}</div>${chipsHtml}`
      : chipsHtml;
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

  function composeDeckHeadMeta(item) {
    if (!item) return '';
    const parts = [];
    const bpm = Number(extractTrackBpm(item));
    const genre = String(extractTrackGenre(item) || '').trim();
    if (Number.isFinite(bpm) && bpm > 0) parts.push(`${Math.round(bpm)} BPM`);
    if (genre) parts.push(genre);
    return parts.join(' · ');
  }

  function isDeckArtworkVisible(deck) {
    if (deck === 'A') return Boolean(albumArt && albumArt.hidden === false);
    return Boolean(nextAlbumArt && nextAlbumArt.hidden === false);
  }

  function resolveDeckMetaItem(deck, deckDisplayItems, launchPreview, queue, currentIndex) {
    const loadedItem = deckDisplayItems?.[deck] || null;
    let nextItem = loadedItem;

    if (!nextItem && launchPreview?.active && launchPreview.deck === deck && launchPreview.item) {
      nextItem = launchPreview.item;
    }

    if (!nextItem && deck === getInactiveDeck()) {
      nextItem = queue[currentIndex + 1] || null;
    }

    if (!nextItem && deck === getFocusDeck()) {
      nextItem = queue[currentIndex] || null;
    }

    if (nextItem) {
      lastDeckMetaItems[deck] = nextItem;
      return nextItem;
    }

    if (isDeckArtworkVisible(deck) && lastDeckMetaItems[deck]) {
      return lastDeckMetaItems[deck];
    }

    lastDeckMetaItems[deck] = null;
    return null;
  }

  function refreshDeckMetaDisplays() {
    const deckDisplayItems = getDeckDisplayItems();
    const launchPreview = getLaunchPreviewState();
    const queue = getQueue();
    const currentIndex = getCurrentIndex();
    const deckAItem = resolveDeckMetaItem('A', deckDisplayItems, launchPreview, queue, currentIndex);
    const deckBItem = resolveDeckMetaItem('B', deckDisplayItems, launchPreview, queue, currentIndex);
    const currentMode = getDjMode?.() ?? null;

    const deckAId = deckAItem?.id ?? null;
    if (deckAId !== lastRenderedMeta.A.id || currentMode !== lastRenderedMeta.A.mode) {
      renderDeckMetaContent(trackArtistA, deckAItem);
      if (deckATitle) deckATitle.textContent = composeDeckHeadMeta(deckAItem);
      lastRenderedMeta.A.id = deckAId;
      lastRenderedMeta.A.mode = currentMode;
    }

    const deckBId = deckBItem?.id ?? null;
    if (deckBId !== lastRenderedMeta.B.id || currentMode !== lastRenderedMeta.B.mode) {
      renderDeckMetaContent(trackArtistB, deckBItem);
      if (deckBTitle) deckBTitle.textContent = composeDeckHeadMeta(deckBItem);
      lastRenderedMeta.B.id = deckBId;
      lastRenderedMeta.B.mode = currentMode;
    }

    const player = getPlayer();
    const detail = player?._lastDeckState || null;
    const rateA = detail?.deckA?.playbackRate ?? 1;
    const rateB = detail?.deckB?.playbackRate ?? 1;
    const rateAText = Math.abs(rateA - 1) > 0.005 ? `×${rateA.toFixed(2)}` : '';
    const rateBText = Math.abs(rateB - 1) > 0.005 ? `×${rateB.toFixed(2)}` : '';
    if (deckABpm && deckABpm.textContent !== rateAText) deckABpm.textContent = rateAText;
    if (deckBBpm && deckBBpm.textContent !== rateBText) deckBBpm.textContent = rateBText;
  }

  function renderSourceBadge(item) {
    let html = '';
    if (item.queueSource === 'fil-rouge') {
      html += '<span class="queue-filrouge-dot" title="Fil rouge" aria-label="Fil rouge"></span>';
    }
    if (item.sourceState === 'ready') html += '<span class="queue-cache-dot is-ready" aria-label="Cache prêt" title="Cache prêt"></span>';
    else if (item.sourceState === 'resolving') html += '<span class="queue-cache-dot is-resolving" aria-label="Cache en cours" title="Cache en cours"></span>';
    else if (item.sourceState === 'error') html += '<span class="queue-cache-dot is-error" aria-label="Erreur cache" title="Erreur cache"></span>';
    return html;
  }

  function buildQueueHTML() {
    const queue = getQueue();
    const currentIndex = getCurrentIndex();
    const currentTrackId = getCurrentTrackId();
    const isPlaying = getIsPlaying();
    const deckBCueIndex = getDeckBCueIndex();
    const deckCueDeck = getDeckCueDeck();
    const deckDisplayItems = getDeckDisplayItems();
    const visibleStartIndex = currentIndex > 0
      ? Math.max(0, currentIndex - MAX_VISIBLE_PLAYED_TRACKS)
      : 0;

    const loadedDeckByTrackId = new Map();
    const deckAId = deckDisplayItems?.A?.id;
    const deckBId = deckDisplayItems?.B?.id;
    if (deckAId != null) loadedDeckByTrackId.set(deckAId, 'A');
    if (deckBId != null) {
      const existing = loadedDeckByTrackId.get(deckBId);
      loadedDeckByTrackId.set(deckBId, existing ? 'AB' : 'B');
    }

    return queue.slice(visibleStartIndex).map((item, offset) => {
      const i = visibleStartIndex + offset;
      const isCurrent = i === currentIndex || (currentIndex < 0 && item.id === currentTrackId);
      const isPlayed = currentIndex > 0 && i < currentIndex;
      const cls = [
        'queue-item',
        isCurrent ? 'is-current' : '',
        isPlayed ? 'is-played' : '',
      ].filter(Boolean).join(' ');
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
      const cueADisabled = cueALoaded ? ' disabled aria-disabled="true" title="Déjà chargée sur platine 1"' : '';
      const cueBDisabled = cueBLoaded ? ' disabled aria-disabled="true" title="Déjà chargée sur platine 2"' : '';
      const metaChips = isDanceMode() ? buildDanceMetaChips(item) : '';
      const sourceBadge = renderSourceBadge(item);
      const deckBadge = loadedDeck === 'AB'
        ? '<span class="queue-deck-badge">DJ 1+2</span>'
        : loadedDeck === 'A'
          ? '<span class="queue-deck-badge">platine 1</span>'
          : loadedDeck === 'B'
            ? '<span class="queue-deck-badge">platine 2</span>'
            : '';

      return `
      <div class="${cls}" data-index="${i}" role="button" tabindex="0" draggable="true">
        ${numHtml}
        <img class="queue-art"${item.artUrl ? ` src="${escHtml(item.artUrl)}"` : ' hidden'} alt="" loading="lazy" onerror="this.hidden=true">
        <div class="queue-info">
          <div class="queue-name-wrap">
            <div class="queue-name">${escHtml(item.name)}</div>
            ${sourceBadge}
            ${deckBadge}
          </div>
          <div class="queue-artist">${escHtml(item.artist)}</div>
          ${metaChips}
        </div>
        <div class="queue-actions">
          <button class="${cueAClass}" data-index="${i}" data-deck="A"${cueADisabled} aria-label="Cue platine 1">1</button>
          <button class="${cueBClass}" data-index="${i}" data-deck="B"${cueBDisabled} aria-label="Cue platine 2">2</button>
          <button class="queue-fp-btn" data-index="${i}" aria-label="Contrôle empreinte" title="Contrôle empreinte"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg></button>
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

    const volPctA = Math.round((detail.deckA?.volume || 0) * 100);
    const volPctB = Math.round((detail.deckB?.volume || 0) * 100);
    if (deckAVol && lastRenderedDeckState.A.volPct !== volPctA) {
      deckAVol.textContent = `${volPctA}%`;
      lastRenderedDeckState.A.volPct = volPctA;
    }
    if (deckBVol && lastRenderedDeckState.B.volPct !== volPctB) {
      deckBVol.textContent = `${volPctB}%`;
      lastRenderedDeckState.B.volPct = volPctB;
    }

    const rateA = detail.deckA?.playbackRate ?? 1;
    const rateB = detail.deckB?.playbackRate ?? 1;
    const rateAHidden = Math.abs(rateA - 1) <= 0.005;
    const rateBHidden = Math.abs(rateB - 1) <= 0.005;
    if (deckABpmReset && lastRenderedDeckState.A.rateHidden !== rateAHidden) {
      deckABpmReset.hidden = rateAHidden;
      lastRenderedDeckState.A.rateHidden = rateAHidden;
    }
    if (deckBBpmReset && lastRenderedDeckState.B.rateHidden !== rateBHidden) {
      deckBBpmReset.hidden = rateBHidden;
      lastRenderedDeckState.B.rateHidden = rateBHidden;
    }

    const playingA = Boolean(detail.deckA?.playing);
    const playingB = Boolean(detail.deckB?.playing);
    if (deckALaunchBtn && lastRenderedDeckState.A.playing !== playingA) {
      deckALaunchBtn.textContent = playingA ? '⏸' : '▶';
      lastRenderedDeckState.A.playing = playingA;
    }
    if (deckBLaunchBtn && lastRenderedDeckState.B.playing !== playingB) {
      deckBLaunchBtn.textContent = playingB ? '⏸' : '▶';
      lastRenderedDeckState.B.playing = playingB;
    }

    const player = getPlayer();
    if (player) player._lastDeckState = detail;

    if (deckAFill) {
      const pctA = detail.deckA?.durationMs > 0 ? Math.min(100, (detail.deckA.positionMs / detail.deckA.durationMs) * 100) : 0;
      const pctARounded = Math.round(pctA * 10) / 10; // 0.1% precision, avoids sub-pixel thrashing
      if (lastRenderedDeckState.A.fillPct !== pctARounded) {
        deckAFill.style.width = `${pctARounded}%`;
        lastRenderedDeckState.A.fillPct = pctARounded;
      }
    }
    if (deckBFill) {
      const pctB = detail.deckB?.durationMs > 0 ? Math.min(100, (detail.deckB.positionMs / detail.deckB.durationMs) * 100) : 0;
      const pctBRounded = Math.round(pctB * 10) / 10;
      if (lastRenderedDeckState.B.fillPct !== pctBRounded) {
        deckBFill.style.width = `${pctBRounded}%`;
        lastRenderedDeckState.B.fillPct = pctBRounded;
      }
    }

    if (deckATime) {
      const timeA = detail.deckA?.durationMs > 0
        ? `${formatTime(detail.deckA.positionMs)} / ${formatTime(detail.deckA.durationMs)}`
        : '';
      if (lastRenderedDeckState.A.timeText !== timeA) {
        deckATime.textContent = timeA;
        lastRenderedDeckState.A.timeText = timeA;
      }
    }
    if (deckBTime) {
      const timeB = detail.deckB?.durationMs > 0
        ? `${formatTime(detail.deckB.positionMs)} / ${formatTime(detail.deckB.durationMs)}`
        : '';
      if (lastRenderedDeckState.B.timeText !== timeB) {
        deckBTime.textContent = timeB;
        lastRenderedDeckState.B.timeText = timeB;
      }
    }
  }

  function updateUpcomingArtwork() {
    const launchPreview = getLaunchPreviewState();
    const queue = getQueue();
    const currentIndex = getCurrentIndex();
    const deckDisplayItems = getDeckDisplayItems();
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
    const loadedDeckItem = resolveDeckMetaItem(targetDeck, deckDisplayItems, launchPreview, queue, currentIndex);

    let label = '';
    let artUrl = '';
    let artist = '';
    let displayItem = loadedDeckItem;

    if (launchPreview.active) {
      label = launchPreview.title || '';
      artUrl = launchPreview.artUrl;
      artist = launchPreview.artist || '';
    } else {
      const next = queue[currentIndex + 1];
      label = next?.name || '';
      artUrl = next?.artUrl || '';
      artist = next?.artist || '';
      displayItem = loadedDeckItem || next || null;
    }

    if (artUrl) {
      inactiveArt.onerror = () => {
        inactiveArt.hidden = true;
        inactivePlaceholder.style.display = '';
      };
      inactiveArt.src = artUrl;
      inactiveArt.hidden = false;
      inactivePlaceholder.style.display = 'none';
    } else {
      inactiveArt.src = '';
      inactiveArt.hidden = true;
      inactivePlaceholder.style.display = '';
    }
    renderDeckMetaContent(inactiveTrackArtist, displayItem, label, artist);
  
  }

  function updateNowPlaying(item, deck = getFocusDeck()) {
    if ('mediaSession' in navigator) {
      const safeTitle = String(item?.name || item?.title || 'DJ Mix').trim() || 'DJ Mix';
      const safeArtist = String(item?.artist || item?.artistName || '').trim();
      const safeAlbum = String(item?.album?.name || item?.albumName || item?.collectionName || 'DJ Mix').trim() || 'DJ Mix';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: safeTitle,
        artist: safeArtist,
        album: safeAlbum,
        artwork: getMediaSessionArtwork(item),
      });

      // Convertir l'artwork en data URI pour que la notification système puisse l'afficher
      // quel que soit le type d'URL (blob: local, https:// CDN ou serveur API local).
      const artUrl = item?.artUrl || '';
      if (artUrl) {
        _fetchArtworkDataUri(artUrl).then((resolvedUrl) => {
          if (!resolvedUrl || !navigator.mediaSession?.metadata) return;
          if (navigator.mediaSession.metadata.title !== safeTitle) return;
          const [, mimeType] = resolvedUrl.match(/^data:([^;]+);/) || [];
          navigator.mediaSession.metadata = new MediaMetadata({
            title: safeTitle,
            artist: safeArtist,
            album: safeAlbum,
            artwork: [{ src: resolvedUrl, sizes: '512x512', type: mimeType || 'image/jpeg' }],
          });
        }).catch(() => {});
      }

      pushNowPlaying({
        id: item?.id,
        title: safeTitle,
        artist: safeArtist,
        album: safeAlbum,
        artworkUrl: item?.artUrl || '',
        durationMs: item?.duration || 0,
      });
    }

    const focusArt = deck === 'A' ? albumArt : nextAlbumArt;
    const focusPlaceholder = deck === 'A' ? artPlaceholder : nextArtPlaceholder;

    if (item.artUrl) {
      focusArt.onerror = () => {
        focusArt.hidden = true;
        focusPlaceholder.style.display = '';
      };
      focusArt.src = item.artUrl;
      focusArt.hidden = false;
      focusPlaceholder.style.display = 'none';
    } else {
      focusArt.src = '';
      focusArt.hidden = true;
      focusPlaceholder.style.display = '';
    }

    if (deck === 'A') {
      renderDeckMetaContent(trackArtistA, item);
    } else {
      renderDeckMetaContent(trackArtistB, item);
    }

    if (trackArtist) trackArtist.textContent = item.artist;

    updateUpcomingArtwork();
    refreshDeckMetaDisplays();
  }

  function invalidateDeckMetaCache() {
    lastRenderedMeta.A.id = undefined;
    lastRenderedMeta.A.mode = undefined;
    lastRenderedMeta.B.id = undefined;
    lastRenderedMeta.B.mode = undefined;
  }

  return {
    autoMixBtn,
    buildQueueHTML,
    emptyQueue,
    queueList,
    renderDeckState,
    refreshDeckMetaDisplays,
    invalidateDeckMetaCache,
    updateNowPlaying,
    updateUpcomingArtwork,
  };
}

/**
 * Affiche (ou masque) le badge de qualité de set basé sur `globalSetScore`
 * renvoyé par `/api/dj/batch`. `reasons[]` est exposé en tooltip.
 * @param {HTMLElement|null} el
 * @param {{globalSetScore: number, reasons?: string[], globalComponents?: object|null}|null} quality
 */
export function renderDjSetQualityBadge(el, quality) {
  if (!el) return;

  const score = Number(quality?.globalSetScore);
  if (!quality || !Number.isFinite(score)) {
    el.hidden = true;
    el.textContent = '';
    el.removeAttribute('title');
    return;
  }

  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  el.hidden = false;
  el.textContent = `Qualité du set : ${pct}%`;

  const reasons = Array.isArray(quality.reasons) ? quality.reasons.filter(Boolean) : [];
  if (reasons.length) {
    el.title = reasons.join('\n');
  } else {
    el.removeAttribute('title');
  }
}

/**
 * Génère le HTML des boutons de feedback 👍/👎 pour la transition planifiée
 * d'un item du fil rouge (`item.djTransition`). Retourne une chaîne vide si
 * aucun `decisionId` n'est disponible (boutons masqués).
 * @param {{djTransition?: {decisionId?: string}}|null} item
 * @returns {string}
 */
export function renderDjTransitionFeedback(item) {
  const decisionId = item?.djTransition?.decisionId;
  if (!decisionId) return '';

  const safeId = escHtml(String(decisionId));
  return `
    <div class="filrouge-dj-feedback" data-decision-id="${safeId}">
      <button type="button" class="filrouge-dj-feedback-btn filrouge-dj-feedback-good" data-feedback="good" title="Bonne transition" aria-label="Bonne transition">👍</button>
      <button type="button" class="filrouge-dj-feedback-btn filrouge-dj-feedback-bad" data-feedback="bad" title="Mauvaise transition" aria-label="Mauvaise transition">👎</button>
    </div>
  `.trim();
}
