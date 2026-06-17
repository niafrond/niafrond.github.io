import { uiState } from './uiState.js';

/**
 * Gère tous les marqueurs de progression sur les decks :
 * marker AutoDJ (prochain déclenchement), zone DJ Plan, marker démarrage planifié,
 * marker durée max (snappé + brut), et rendu des zones de mix.
 *
 * @param {object} options
 * @param {object} options.automixTimeline  - { nextTriggerMs, triggeredForTrack, currentPlayingDeck }
 * @param {object} options.autoModeManager
 * @param {() => number} options.getPlaybackDurationMs
 * @param {() => object[]} options.getQueue
 * @param {() => 'A'|'B'} options.getResolvedInactiveDeck
 * @param {(item: object|null) => object|null} options.getTrackMixData
 * @param {boolean} options.djExternalPlanEnabled  - pass via getter if dynamic
 * @param {object} options.filRougeManager
 * @param {object} options.djPlanManager
 * @param {() => boolean} options.getTrackMaxDurationEnabled
 * @param {() => string} options.getTrackMaxDurationMode
 * @param {() => number} options.getTrackMaxDurationAppliedSec
 * @param {() => number} options.getTrackMaxDurationSec
 * @param {(mixData: object|null, durationMs: number) => number} options.computePctMaxDurationSec
 * @param {(sec: number) => void} options.setTrackMaxDurationAppliedSec
 * @param {(event: string, payload?: object) => void} options.logDebug
 * @param {HTMLElement|null} [options.deckAAutoDjMarker]
 * @param {HTMLElement|null} [options.deckBAutoDjMarker]
 * @param {HTMLElement|null} [options.deckAAutoDjStartMarker]
 * @param {HTMLElement|null} [options.deckBAutoDjStartMarker]
 * @param {HTMLElement|null} [options.deckADjPlanZone]
 * @param {HTMLElement|null} [options.deckBDjPlanZone]
 * @param {HTMLElement|null} [options.deckAMaxDurMarker]
 * @param {HTMLElement|null} [options.deckBMaxDurMarker]
 * @param {HTMLElement|null} [options.deckAMaxDurRawMarker]
 * @param {HTMLElement|null} [options.deckBMaxDurRawMarker]
 * @param {HTMLElement|null} [options.deckAProgressZones]
 * @param {HTMLElement|null} [options.deckBProgressZones]
 */
export function createDeckMarkerController(options) {
  const {
    automixTimeline,
    autoModeManager,
    getPlaybackDurationMs,
    getQueue,
    getResolvedInactiveDeck,
    getTrackMixData,
    filRougeManager,
    djPlanManager,
    getTrackMaxDurationEnabled,
    getTrackMaxDurationMode,
    getTrackMaxDurationAppliedSec,
    getTrackMaxDurationSec,
    computePctMaxDurationSec,
    setTrackMaxDurationAppliedSec,
    logDebug,
    deckAAutoDjMarker = null,
    deckBAutoDjMarker = null,
    deckAAutoDjStartMarker = null,
    deckBAutoDjStartMarker = null,
    deckADjPlanZone = null,
    deckBDjPlanZone = null,
    deckAMaxDurMarker = null,
    deckBMaxDurMarker = null,
    deckAMaxDurRawMarker = null,
    deckBMaxDurRawMarker = null,
    deckAProgressZones = null,
    deckBProgressZones = null,
  } = options;

  // Whether DJ external plan is enabled — stored as a getter for live reads
  let _djExternalPlanEnabled = Boolean(options.djExternalPlanEnabled);
  function setDjExternalPlanEnabled(enabled) { _djExternalPlanEnabled = Boolean(enabled); }

  // ── Private caches ────────────────────────────────────────────────────────────

  let _plannedStartMarkerLastKey = null;

  const _maxDurMarkerCache = {
    key: null,
    markerMs: null,
    maxMs: null,
    maxExceedsDuration: null,
    rawLogged: false,
    renderKey: null,
  };

  // ── updateAutoDjMarker ────────────────────────────────────────────────────────

  function updateAutoDjMarker() {
    const isEnabled = autoModeManager.isAutoModeEnabled();
    const playbackDurationMs = getPlaybackDurationMs();
    const queue = getQueue();
    const durationMs = playbackDurationMs > 0
      ? playbackDurationMs
      : (queue[uiState.currentIndex]?.duration ?? 0);
    const hasTiming = automixTimeline.nextTriggerMs > 0 && durationMs > 0
      && !automixTimeline.triggeredForTrack;

    if (deckAAutoDjMarker) deckAAutoDjMarker.hidden = true;
    if (deckBAutoDjMarker) deckBAutoDjMarker.hidden = true;

    if (isEnabled && hasTiming) {
      const pct = Math.min(100, Math.max(0, (automixTimeline.nextTriggerMs / durationMs) * 100));
      const marker = automixTimeline.currentPlayingDeck === 'B' ? deckBAutoDjMarker : deckAAutoDjMarker;
      if (marker) {
        marker.style.left = `${pct}%`;
        marker.hidden = false;
      }
    }

    updateDjPlanZone(durationMs);
  }

  // ── updateDjPlanZone ──────────────────────────────────────────────────────────

  function updateDjPlanZone(durationMs) {
    if (deckADjPlanZone) deckADjPlanZone.hidden = true;
    if (deckBDjPlanZone) deckBDjPlanZone.hidden = true;

    if (!_djExternalPlanEnabled) return;

    const nextItem = filRougeManager?.peekNextTrackFromAny?.();
    const djPlan = djPlanManager?.getDjTransitionPlan(nextItem);
    if (!djPlan || !Number.isFinite(djPlan.mixOutSec) || djPlan.mixOutSec <= 0) return;
    if (!Number.isFinite(djPlan.crossfadeDurationSec) || djPlan.crossfadeDurationSec <= 0) return;

    const playbackDurationMs = getPlaybackDurationMs();
    const queue = getQueue();
    const dur = durationMs > 0 ? durationMs
      : (playbackDurationMs > 0 ? playbackDurationMs : (queue[uiState.currentIndex]?.duration ?? 0));
    if (dur <= 0) return;

    const durationSec = dur / 1000;
    const leftPct = Math.max(0, Math.min(100, (djPlan.mixOutSec / durationSec) * 100));
    const widthPct = Math.max(0.5, Math.min(100 - leftPct, (djPlan.crossfadeDurationSec / durationSec) * 100));

    const playingDeck = automixTimeline.currentPlayingDeck || 'A';
    const zone = playingDeck === 'B' ? deckBDjPlanZone : deckADjPlanZone;
    if (!zone) return;

    const scorePct = Math.round((djPlan.compatibilityScore ?? 0) * 100);
    const transitionLabel = djPlan.transitionType ? ` · ${djPlan.transitionType}` : '';
    const nextName = nextItem?.name ? ` → ${nextItem.name}` : '';
    zone.style.left = `${leftPct}%`;
    zone.style.width = `${widthPct}%`;
    zone.title = `DJ Plan : crossfade ${Math.round(djPlan.crossfadeDurationSec)}s${transitionLabel} · score ${scorePct}%${nextName}`;
    zone.hidden = false;
  }

  // ── updatePlannedStartMarker ──────────────────────────────────────────────────

  function updatePlannedStartMarker() {
    const inactiveDeck = getResolvedInactiveDeck();
    const item = uiState.deckDisplayItems[inactiveDeck];

    if (!item) {
      if (_plannedStartMarkerLastKey !== null) {
        if (deckAAutoDjStartMarker) deckAAutoDjStartMarker.hidden = true;
        if (deckBAutoDjStartMarker) deckBAutoDjStartMarker.hidden = true;
        _plannedStartMarkerLastKey = null;
      }
      return;
    }

    const queue = getQueue();
    const durationMs = Number(item.duration) || (queue.find((q) => q.id === item.id)?.duration ?? 0);
    const startPositionMs = Math.max(0, Number(item.autoDjStartOffsetMs) || 0);
    const cacheKey = `${inactiveDeck}|${item.id}|${startPositionMs}|${durationMs}`;
    if (cacheKey === _plannedStartMarkerLastKey) return;
    _plannedStartMarkerLastKey = cacheKey;

    if (deckAAutoDjStartMarker) deckAAutoDjStartMarker.hidden = true;
    if (deckBAutoDjStartMarker) deckBAutoDjStartMarker.hidden = true;

    if (!durationMs || startPositionMs <= 0 || startPositionMs >= durationMs) return;

    const pct = Math.min(100, Math.max(0, (startPositionMs / durationMs) * 100));
    const marker = inactiveDeck === 'B' ? deckBAutoDjStartMarker : deckAAutoDjStartMarker;
    if (marker) {
      marker.style.left = `${pct}%`;
      marker.title = `Démarrage AutoDJ prévu à ${Math.round(startPositionMs / 1000)}s`;
      marker.hidden = false;
    }
  }

  // ── updateMaxDurationMarker ───────────────────────────────────────────────────

  function updateMaxDurationMarker() {
    const playingDeck = automixTimeline.currentPlayingDeck || 'A';
    const playbackDurationMs = getPlaybackDurationMs();
    const queue = getQueue();
    const deckStateDurationMs = uiState.lastDeckState?.[`deck${playingDeck}`]?.durationMs ?? 0;
    const durationMs = deckStateDurationMs > 0
      ? deckStateDurationMs
      : (playbackDurationMs > 0 ? playbackDurationMs : (queue[uiState.currentIndex]?.duration ?? 0));

    const currentItem = queue[uiState.currentIndex];
    const fallbackMixData = autoModeManager.getCurrentTrackMixData?.();
    const mixData = getTrackMixData(currentItem) || fallbackMixData || null;

    const trackMaxDurationEnabled = getTrackMaxDurationEnabled();
    const trackMaxDurationMode = getTrackMaxDurationMode();
    const trackMaxDurationAppliedSec = getTrackMaxDurationAppliedSec();
    const trackMaxDurationSec = getTrackMaxDurationSec();

    let effectiveMaxDurationSec;
    if (!trackMaxDurationEnabled) {
      effectiveMaxDurationSec = 0;
    } else if (trackMaxDurationMode === 'pct') {
      effectiveMaxDurationSec = durationMs > 0 ? computePctMaxDurationSec(mixData, durationMs) : 0;
      if (effectiveMaxDurationSec > 0 && effectiveMaxDurationSec !== trackMaxDurationAppliedSec) {
        setTrackMaxDurationAppliedSec(effectiveMaxDurationSec);
      }
    } else {
      effectiveMaxDurationSec = uiState.isPlaying ? trackMaxDurationAppliedSec : trackMaxDurationSec;
    }

    if (effectiveMaxDurationSec <= 0 || durationMs <= 0) {
      if (_maxDurMarkerCache.renderKey !== 'off') {
        _maxDurMarkerCache.renderKey = 'off';
        if (deckAMaxDurMarker) deckAMaxDurMarker.hidden = true;
        if (deckBMaxDurMarker) deckBMaxDurMarker.hidden = true;
        if (deckAMaxDurRawMarker) deckAMaxDurRawMarker.hidden = true;
        if (deckBMaxDurRawMarker) deckBMaxDurRawMarker.hidden = true;
      }
      return;
    }

    const startOffsetMs = Math.max(0, Number(currentItem?.autoDjStartOffsetMs) || 0);
    const maxMs = effectiveMaxDurationSec * 1000 + startOffsetMs;
    const maxExceedsDuration = maxMs >= durationMs;

    const cacheKey = `${currentItem?.id}|${effectiveMaxDurationSec}|${durationMs}`;
    let markerMs;
    if (_maxDurMarkerCache.key === cacheKey && _maxDurMarkerCache.markerMs !== null) {
      markerMs = _maxDurMarkerCache.markerMs;
    } else {
      markerMs = maxExceedsDuration ? durationMs : maxMs;

      if (mixData && typeof autoModeManager.findBestTransitionZone === 'function') {
        const preferredZone = maxExceedsDuration
          ? autoModeManager.findBestTransitionZone(mixData, {})
          : autoModeManager.findBestTransitionZone(mixData, {
              targetSec: effectiveMaxDurationSec + startOffsetMs / 1000,
            });

        const zoneEndSec = Number.isFinite(Number(preferredZone?.triggerSec))
          ? Number(preferredZone.triggerSec)
          : Number(preferredZone?.zone?.endSec);

        if (Number.isFinite(zoneEndSec) && zoneEndSec > 0) {
          markerMs = Math.min(durationMs, zoneEndSec * 1000);
        } else if (maxExceedsDuration) {
          markerMs = Math.max(durationMs - 20000, durationMs * 0.75);
        }
      } else if (maxExceedsDuration) {
        markerMs = Math.max(durationMs - 20000, durationMs * 0.75);
      }

      if (mixData && typeof autoModeManager.advancePastMaxDurationBlock === 'function') {
        const adjustedMs = autoModeManager.advancePastMaxDurationBlock(markerMs, mixData, durationMs);
        if (adjustedMs !== markerMs && adjustedMs < durationMs) {
          markerMs = adjustedMs;
        }
      }

      _maxDurMarkerCache.key = cacheKey;
      _maxDurMarkerCache.markerMs = markerMs;
      _maxDurMarkerCache.maxMs = maxMs;
      _maxDurMarkerCache.maxExceedsDuration = maxExceedsDuration;
      _maxDurMarkerCache.rawLogged = false;
    }

    if (uiState.isPlaying && trackMaxDurationEnabled) {
      const snappedAppliedSec = Math.max(0, Math.round((markerMs - startOffsetMs) / 1000));
      if (snappedAppliedSec !== getTrackMaxDurationAppliedSec()) {
        setTrackMaxDurationAppliedSec(snappedAppliedSec);
      }
    }

    const pct = Math.min(100, (markerMs / durationMs) * 100);
    const userRawMs = trackMaxDurationSec * 1000 + startOffsetMs;
    const rawPct = !maxExceedsDuration ? Math.min(100, (userRawMs / durationMs) * 100) : -1;
    const rawVisible = rawPct >= 0 && Math.abs(rawPct - pct) > 0.2;

    const renderKey = `${playingDeck}|${pct.toFixed(3)}|${rawVisible ? rawPct.toFixed(3) : 'off'}`;
    if (renderKey === _maxDurMarkerCache.renderKey) return;
    _maxDurMarkerCache.renderKey = renderKey;

    const inactiveDeck = playingDeck === 'B' ? 'A' : 'B';
    const inactiveMarker = inactiveDeck === 'A' ? deckAMaxDurMarker : deckBMaxDurMarker;
    const inactiveRawMarker = inactiveDeck === 'A' ? deckAMaxDurRawMarker : deckBMaxDurRawMarker;
    if (inactiveMarker) inactiveMarker.hidden = true;
    if (inactiveRawMarker) inactiveRawMarker.hidden = true;

    const marker = playingDeck === 'B' ? deckBMaxDurMarker : deckAMaxDurMarker;
    if (marker) {
      marker.style.left = `${pct}%`;
      marker.hidden = false;
    }

    const rawMarker = playingDeck === 'B' ? deckBMaxDurRawMarker : deckAMaxDurRawMarker;
    if (!maxExceedsDuration) {
      if (!_maxDurMarkerCache.rawLogged) {
        logDebug?.('maxDuration: raw marker', {
          track: currentItem?.name,
          userSettingSec: trackMaxDurationSec,
          startOffsetSec: startOffsetMs / 1000,
          rawMs: userRawMs,
          rawSec: userRawMs / 1000,
          rawPct,
          adjustedMs: markerMs,
          adjustedSec: markerMs / 1000,
          adjustedPct: pct,
          diffSec: (markerMs - userRawMs) / 1000,
          rawVisible,
        });
        _maxDurMarkerCache.rawLogged = true;
      }
      if (rawMarker) {
        if (rawVisible) {
          rawMarker.style.left = `${rawPct}%`;
          rawMarker.hidden = false;
        } else {
          rawMarker.hidden = true;
        }
      }
    } else {
      if (!_maxDurMarkerCache.rawLogged) {
        logDebug?.('maxDuration: raw marker hidden (maxExceedsDuration)', {
          track: currentItem?.name,
          effectiveMaxDurationSec,
          durationSec: durationMs / 1000,
          adjustedSec: markerMs / 1000,
          adjustedPct: pct,
        });
        _maxDurMarkerCache.rawLogged = true;
      }
      if (rawMarker) rawMarker.hidden = true;
    }
  }

  // ── renderMixZones ────────────────────────────────────────────────────────────

  const MIX_ZONE_CONFIG = {
    peakZones: { label: 'Peak', className: 'zone-peak' },
    safeTransitionZones: { label: 'Zone sûre', className: 'zone-safe' },
    avoidTransitionZones: { label: 'À éviter', className: 'zone-avoid' },
    dropZones: { label: 'Drop', className: 'zone-drop' },
    breakdownZones: { label: 'Breakdown', className: 'zone-breakdown' },
    neverMissZones: { label: 'Never Miss', className: 'zone-never-miss' },
  };

  function formatZoneTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const wholeSeconds = Math.floor(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0');
    const tenths = Math.floor((seconds - wholeSeconds) * 10);
    return `${minutes}:${remainingSeconds}.${tenths}`;
  }

  function renderMixZones() {
    const renderLayer = (layer, mixData, durationMs) => {
      if (!layer) return;
      layer.replaceChildren();
      const durationSec = Number(mixData?.durationSec) || (durationMs > 0 ? durationMs / 1000 : 0);
      if (!mixData || !Number.isFinite(durationSec) || durationSec <= 0) return;

      const zoneTypes = [
        'peakZones', 'breakdownZones', 'safeTransitionZones',
        'dropZones', 'avoidTransitionZones', 'neverMissZones',
      ];

      for (const zoneType of zoneTypes) {
        const config = MIX_ZONE_CONFIG[zoneType];
        const zones = Array.isArray(mixData[zoneType]) ? mixData[zoneType] : [];

        for (const zone of zones) {
          const startSec = Number(zone?.startSec);
          const endSec = Number(zone?.endSec);
          if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;

          const leftPct = Math.max(0, Math.min(100, (startSec / durationSec) * 100));
          const widthPct = Math.max(0.3, Math.min(100 - leftPct, ((endSec - startSec) / durationSec) * 100));
          const zoneEl = document.createElement('div');
          zoneEl.className = `deck-progress-zone ${config.className}`;
          zoneEl.style.left = `${leftPct}%`;
          zoneEl.style.width = `${widthPct}%`;

          const zoneScore = Number.isFinite(Number(zone?.score)) ? Number(zone.score)
            : Number.isFinite(Number(zone?.neverMissScore)) ? Number(zone.neverMissScore)
            : null;
          const zoneLabel = zone?.label ? ` · ${zone.label}` : '';
          const zoneReason = zone?.reason && zone.reason !== zone?.label ? ` · ${zone.reason}` : '';
          const zoneScoreTxt = zoneScore !== null ? ` · score ${zoneScore.toFixed(3)}` : '';
          zoneEl.title = `${config.label} ${formatZoneTime(startSec)} → ${formatZoneTime(endSec)}${zoneLabel}${zoneReason}${zoneScoreTxt}`;
          zoneEl.dataset.zoneType = zoneType;
          if (zone?.reason) zoneEl.dataset.reason = zone.reason;
          if (zoneScore !== null) zoneEl.dataset.score = String(zoneScore);

          layer.appendChild(zoneEl);
        }
      }
    };

    const playbackDurationMs = getPlaybackDurationMs();
    const queue = getQueue();
    const playbackDuration = playbackDurationMs > 0
      ? playbackDurationMs
      : (queue[uiState.currentIndex]?.duration ?? 0);
    const mixDataA = getTrackMixData(uiState.deckDisplayItems.A)
      || (automixTimeline.currentPlayingDeck === 'A' ? autoModeManager.getCurrentTrackMixData?.() : null)
      || (automixTimeline.currentPlayingDeck !== 'A' ? autoModeManager.getNextTrackMixData?.() : null);
    const mixDataB = getTrackMixData(uiState.deckDisplayItems.B)
      || (automixTimeline.currentPlayingDeck === 'B' ? autoModeManager.getCurrentTrackMixData?.() : null)
      || (automixTimeline.currentPlayingDeck !== 'B' ? autoModeManager.getNextTrackMixData?.() : null);

    renderLayer(deckAProgressZones, mixDataA, playbackDuration);
    renderLayer(deckBProgressZones, mixDataB, playbackDuration);
  }

  return {
    setDjExternalPlanEnabled,
    updateAutoDjMarker,
    updateDjPlanZone,
    updatePlannedStartMarker,
    updateMaxDurationMarker,
    renderMixZones,
  };
}
