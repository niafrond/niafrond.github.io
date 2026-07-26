import { uiState } from './uiState.js';
import {
  escHtml,
  getBestArtworkUrl,
  extractTrackBpm,
  extractTrackGenre,
} from './searchUtils.js';
import { renderDjSetQualityBadge, renderDjTransitionFeedback } from './uiRenderer.js';
import { computeDjPlanIndicatorState } from './djPlanIndicator.js';
import { mapDjTransitionTypeToMode } from './djTransitionMapping.js';
import { normalizeTransitionMode, MIX_TRANSITION_MODE_LABELS } from './transitionModes.js';
import { STORAGE_KEYS } from './storageKeys.js';

/**
 * Gère le fil rouge : statuts de téléchargement/stems, rendu de la liste,
 * ajout de pistes, indicateur DJ Plan, qualité du set.
 *
 * @param {object} options
 * @param {object} options.filRougeManager
 * @param {object} options.djPlanManager
 * @param {() => boolean} options.getDjExternalPlanEnabled
 * @param {(item: object) => Promise<void>} options.fetchMissingMeta
 * @param {(item: object, opts?: object) => Promise<void>} options.addToQueue
 * @param {(id: string|null) => void} options.addSpotifyDeletedId
 * @param {(msg: string, isError?: boolean) => void} options.showToast
 * @param {(event: string, payload?: object) => void} options.logWarn
 * @param {HTMLElement|null} [options.filRougeCountEl]
 * @param {HTMLElement|null} [options.filRougePriorityCountEl]
 * @param {HTMLElement|null} [options.filRougeShuffleBtn]
 * @param {HTMLElement|null} [options.filRougeLoopBtn]
 * @param {HTMLElement|null} [options.filRougePriorityListEl]
 * @param {HTMLElement|null} [options.filRougePlaylistListEl]
 * @param {Function|null} [options.getPendingAutoFxEvents]
 * @param {HTMLElement|null} [options.djPlanIndicatorEl]
 * @param {HTMLElement|null} [options.djSetQualityBadgeEl]
 * @param {HTMLElement|null} [options.djSetProfileSelectEl]
 */
export function createFilRougeController(options) {
  const {
    filRougeManager,
    djPlanManager,
    getDjExternalPlanEnabled,
    fetchMissingMeta,
    addToQueue,
    addSpotifyDeletedId,
    showToast,
    logWarn,
    filRougeCountEl = null,
    filRougePriorityCountEl = null,
    filRougeShuffleBtn = null,
    filRougeLoopBtn = null,
    filRougePriorityListEl = null,
    filRougePlaylistListEl = null,
    getPendingAutoFxEvents = null,
    djPlanIndicatorEl = null,
    djSetQualityBadgeEl = null,
    djSetProfileSelectEl = null,
    filRougeSortSelectEl = null,
    getDownloaderApiUrl = null,
    getDownloaderApiToken = null,
    getTrackMaxDurationAppliedSec = null,
  } = options;

  // ── Private state ────────────────────────────────────────────────────────────

  const filRougeTrackStatusByKey = new Map();
  let sortMode = localStorage.getItem(STORAGE_KEYS.filRougeSortMode) || 'original';

  // ── Track key and status ─────────────────────────────────────────────────────

  function getFilRougeTrackKey(item) {
    if (!item) return '';
    return String(item.id || item.cachePath || `${item.artist || ''}::${item.name || item.title || ''}`);
  }

  function hasStemsForTrack(item) {
    return Boolean(
      item?.localStemUrls?.vocalsUrl
        || item?.localStemUrls?.instrumentalUrl
        || item?.localStemUrls?.echoUrl
        || item?.localStemUrls?.distortionUrl
        || item?.stems?.vocalsUrl
        || item?.stems?.instrumentalUrl
        || item?.stems?.echoUrl
        || item?.stems?.distortionUrl,
    );
  }

  function setFilRougeTrackStatus(item, patch = {}) {
    const key = getFilRougeTrackKey(item);
    if (!key) return;
    const prev = filRougeTrackStatusByKey.get(key) || {};
    filRougeTrackStatusByKey.set(key, { ...prev, ...patch, updatedAt: Date.now() });
  }

  function getFilRougeTrackStatus(item) {
    const key = getFilRougeTrackKey(item);
    const stored = key ? filRougeTrackStatusByKey.get(key) : null;
    const inferredDone = Boolean(item?.cachePath || item?.persistedSourceUrl);
    const downloadState = stored?.downloadState || (inferredDone ? 'done' : 'idle');
    const hasMixInfo = Boolean(stored?.hasMixInfo);
    return { downloadState, hasMixInfo };
  }

  // ── Transition time formatter (used in indicator HTML) ────────────────────────

  function formatZoneTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const wholeSeconds = Math.floor(seconds);
    const minutes = Math.floor(wholeSeconds / 60);
    const remainingSeconds = String(wholeSeconds % 60).padStart(2, '0');
    const tenths = Math.floor((seconds - wholeSeconds) * 10);
    return `${minutes}:${remainingSeconds}.${tenths}`;
  }

  // ── Dance chips helper ────────────────────────────────────────────────────────

  function buildFilRougeDanceChips(item) {
    const bpm = Number(extractTrackBpm(item));
    const genre = String(extractTrackGenre(item) || '').trim();
    const bpmHtml = Number.isFinite(bpm) && bpm > 0
      ? `<span class="queue-chip">${Math.round(bpm)} BPM</span>`
      : '';
    const genreHtml = genre
      ? `<button type="button" class="queue-chip queue-chip--genre" data-genre="${escHtml(genre)}" aria-label="Filtrer par genre ${escHtml(genre)}">${escHtml(genre)}</button>`
      : '';
    if (!bpmHtml && !genreHtml) return '';
    return `<div class="queue-chips">${bpmHtml}${genreHtml}</div>`;
  }

  // ── DJ Plan indicator ─────────────────────────────────────────────────────────

  const DJ_TRANSITION_TYPE_LABELS = {
    phrase_mix: 'Phrase mix',
    long_blend: 'Long blend',
    quick_cut: 'Quick cut',
    drop_swap: 'Drop swap',
    echo_out: 'Echo out',
  };

  const FX_MODE_LABELS = {
    filter_sweep_low_high: 'Filter sweep',
    echo_out_light: 'Echo out',
    reverb_short_simple: 'Reverb',
    short_loop: 'Loop',
    brake_tape_stop_simple: 'Brake',
    short_reverse: 'Backspin',
    filter_automation: 'Filter auto',
    crossfade_lowpass: 'Low-pass',
    crossfade_highpass_in: 'High-pass',
    filter_dual_sweep: 'Double filtre',
    echo_lowpass: 'Echo + LP',
    bass_swap: 'Bass swap',
    kick_swap: 'Kick swap',
    beat_repeat: 'Beat repeat',
    backspin: 'Backspin',
    echo_freeze: 'Echo freeze',
  };

  function resolveDjPlanMode(transition) {
    const raw = transition.automixMode
      ? normalizeTransitionMode(transition.automixMode)
      : mapDjTransitionTypeToMode(transition.transitionType);
    return raw || null;
  }

  function updateDjPlanIndicator() {
    if (!djPlanIndicatorEl) return;

    const indicatorState = computeDjPlanIndicatorState({
      enabled: getDjExternalPlanEnabled(),
      playlist: filRougeManager.getPlaylist(),
      playingId: uiState.currentTrackId,
      currentIndex: filRougeManager.getCurrentIndex(),
    });

    if (!indicatorState.visible) {
      djPlanIndicatorEl.hidden = true;
      return;
    }

    djPlanIndicatorEl.hidden = false;

    if (indicatorState.state === 'no-track') {
      djPlanIndicatorEl.innerHTML = `<div class="dj-plan-card dj-plan-card--pending"><span class="dj-plan-pending-msg">DJ Plan actif — aucun morceau fil rouge en cours</span></div>`;
      return;
    }

    if (indicatorState.state === 'no-transition') {
      const { item } = indicatorState;
      const trackLabel = item.artist
        ? `${escHtml(item.artist)} — ${escHtml(item.name || '')}`
        : escHtml(item.name || '');
      djPlanIndicatorEl.innerHTML = `<div class="dj-plan-card dj-plan-card--pending"><span class="dj-plan-pending-msg">Transition en attente de calcul…</span><span class="dj-plan-pending-track">${trackLabel}</span></div>`;
      return;
    }

    if (indicatorState.state === 'next-not-found') {
      djPlanIndicatorEl.innerHTML = `<div class="dj-plan-card dj-plan-card--pending"><span class="dj-plan-pending-msg">Morceau suivant introuvable dans la playlist</span></div>`;
      return;
    }

    // state === 'ready'
    const { item, transition: t, nextItem } = indicatorState;
    const typeLabel = DJ_TRANSITION_TYPE_LABELS[t.transitionType] || t.transitionType || '—';
    const scorePct = Number.isFinite(t.compatibilityScore) ? Math.round(t.compatibilityScore * 100) : null;
    const scoreClass = scorePct === null ? '' : scorePct >= 70 ? 'is-good' : scorePct >= 50 ? 'is-ok' : 'is-low';
    const mixOutFmt = Number.isFinite(t.mixOutSec) && t.mixOutSec > 0 ? formatZoneTime(t.mixOutSec) : null;
    const mixInFmt = Number.isFinite(t.mixInSec) && t.mixInSec > 0 ? formatZoneTime(t.mixInSec) : null;
    const crossfadeSec = Number.isFinite(t.crossfadeDurationSec) ? Math.round(t.crossfadeDurationSec) : null;
    const bpm = Number.isFinite(t.recommendedBpm) && t.recommendedBpm > 0 ? Math.round(t.recommendedBpm) : null;
    const decisionId = t.decisionId ? escHtml(String(t.decisionId)) : '';
    const nextLabel = nextItem.artist
      ? `${escHtml(nextItem.artist)} — ${escHtml(nextItem.name || '')}`
      : escHtml(nextItem.name || '');

    const resolvedMode = resolveDjPlanMode(t);
    const modeLabel = resolvedMode ? (MIX_TRANSITION_MODE_LABELS[resolvedMode] || resolvedMode) : null;
    const fxLabel = resolvedMode ? (FX_MODE_LABELS[resolvedMode] || null) : null;

    const pendingFxEvents = (getPendingAutoFxEvents?.() || [])
      .filter((e) => e && !e.triggered)
      .sort((a, b) => a.timeMs - b.timeMs);

    const fxChipsHtml = pendingFxEvents.length > 0
      ? pendingFxEvents.map((e) => {
        const timeFmt = formatZoneTime(e.timeMs / 1000);
        return `<span class="dj-plan-fx-chip" title="${escHtml(e.reason || '')}"><span class="dj-plan-fx-chip-label">${escHtml(e.label || e.type)}</span><span class="dj-plan-fx-chip-time">${timeFmt}</span></span>`;
      }).join('')
      : `<span class="dj-plan-fx-chip dj-plan-fx-chip--empty">Aucun FX prévu</span>`;

    djPlanIndicatorEl.innerHTML = `
    <div class="dj-plan-card">
      <div class="dj-plan-card-header">
        <span class="dj-plan-type-badge">${escHtml(typeLabel)}</span>
        ${modeLabel ? `<span class="dj-plan-mode-badge" title="Mode de transition">${escHtml(modeLabel)}</span>` : ''}
        ${fxLabel ? `<span class="dj-plan-fx-badge" title="Effet appliqué">FX ${escHtml(fxLabel)}</span>` : ''}
        ${scorePct !== null ? `<span class="dj-plan-score ${scoreClass}" title="Score de compatibilité">${scorePct}%</span>` : ''}
        ${decisionId ? `
        <div class="dj-plan-card-feedback filrouge-dj-feedback" data-decision-id="${decisionId}">
          <button type="button" class="filrouge-dj-feedback-btn" data-feedback="good" title="Bonne transition" aria-label="Bonne transition">👍</button>
          <button type="button" class="filrouge-dj-feedback-btn" data-feedback="bad" title="Mauvaise transition" aria-label="Mauvaise transition">👎</button>
        </div>` : ''}
      </div>
      <div class="dj-plan-timeline">
        <div class="dj-plan-timeline-out">
          <span class="dj-plan-tl-label">Sort à</span>
          <span class="dj-plan-tl-time">${mixOutFmt ?? '--:--'}</span>
        </div>
        <div class="dj-plan-fx-chips">${fxChipsHtml}</div>
        <div class="dj-plan-timeline-in">
          <span class="dj-plan-tl-label">Entre à</span>
          <span class="dj-plan-tl-time">${mixInFmt ?? '--:--'}</span>
        </div>
      </div>
      <div class="dj-plan-card-meta">
        ${crossfadeSec !== null ? `<span class="dj-plan-meta-fade">${crossfadeSec}s fondu</span>` : ''}
        ${bpm !== null ? `<span class="dj-plan-meta-bpm">BPM cible : ${bpm}</span>` : ''}
        <span class="dj-plan-next-track">→ ${nextLabel}</span>
      </div>
    </div>`;

    djPlanIndicatorEl.querySelectorAll('.filrouge-dj-feedback-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const container = btn.closest('.filrouge-dj-feedback');
        const dId = container?.dataset.decisionId;
        const feedback = btn.dataset.feedback;
        if (!dId || !feedback) return;
        const result = await djPlanManager.submitFeedback(dId, feedback);
        if (!result) { showToast("Feedback DJ : échec de l'envoi", true); return; }
        djPlanIndicatorEl.querySelectorAll('.filrouge-dj-feedback-btn').forEach((b) => {
          b.classList.toggle('is-selected', b === btn);
        });
        showToast(feedback === 'good' ? '👍 Merci pour le retour' : '👎 Merci pour le retour');
      });
    });
  }

  // ── DJ set quality ────────────────────────────────────────────────────────────

  let _qualityRefreshTimer = null;
  function scheduleDjSetQualityRefresh() {
    if (_qualityRefreshTimer !== null) clearTimeout(_qualityRefreshTimer);
    _qualityRefreshTimer = setTimeout(() => {
      _qualityRefreshTimer = null;
      runDjSetQualityRefresh().catch(() => {});
    }, 1000);
  }

  async function runDjSetQualityRefresh({ forceRefresh = false } = {}) {
    try {
      const quality = await djPlanManager.computeSetQuality({ forceRefresh });
      renderDjSetQualityBadge(djSetQualityBadgeEl, quality);
      updateDjPlanIndicator();
    } catch (err) {
      logWarn('djPlan: computeSetQuality failed', { error: err?.message });
      renderDjSetQualityBadge(djSetQualityBadgeEl, null);
    }
  }

  // ── DJ plan passes ────────────────────────────────────────────────────────────

  async function runDjPlanFullPass(reason) {
    if (!filRougeManager.isActive()) {
      renderDjSetQualityBadge(djSetQualityBadgeEl, null);
      return;
    }

    const currentIndex = filRougeManager.getCurrentIndex();
    const playlist = filRougeManager.getPlaylist();
    const promises = [runDjSetQualityRefresh()];
    if (currentIndex >= 0 && currentIndex < playlist.length) {
      promises.push(djPlanManager.planCurrentToNextTransition(playlist[currentIndex]));
    }
    await Promise.all(promises);

    updateDjPlanIndicator();
    renderFilRouge();
  }

  async function runDjPlanIncrementalPass(items, withWrap) {
    try {
      await djPlanManager.planEdgesForNewItems(items, { withWrap });
      renderFilRouge();
    } catch (err) {
      logWarn('djPlan: planEdgesForNewItems failed', { error: err?.message });
    }
    await runDjSetQualityRefresh();
  }

  // ── Profile select ────────────────────────────────────────────────────────────

  const DJ_SET_PROFILE_LABELS = {
    club_peak: "Club (pic d'énergie)",
    wedding: 'Mariage',
    festival: 'Festival',
    warmup: 'Mise en route',
    afterparty: 'After-party',
  };

  async function initDjSetProfileSelect() {
    if (!djSetProfileSelectEl) return;

    const result = await djPlanManager.getSetProfiles();
    const profiles = Array.isArray(result?.profiles) && result.profiles.length
      ? result.profiles
      : Object.keys(DJ_SET_PROFILE_LABELS).map((id) => ({ id }));

    djSetProfileSelectEl.innerHTML = profiles.map((profile) => {
      const id = profile?.id;
      const label = DJ_SET_PROFILE_LABELS[id] || id;
      return `<option value="${escHtml(id)}">${escHtml(label)}</option>`;
    }).join('');

    const selected = djPlanManager.getSelectedSetProfile();
    if (profiles.some((p) => p.id === selected)) {
      djSetProfileSelectEl.value = selected;
    }

    djSetProfileSelectEl.addEventListener('change', () => {
      djPlanManager.setSelectedSetProfile(djSetProfileSelectEl.value);
      runDjSetQualityRefresh({ forceRefresh: true }).catch(() => {});
    });
  }

  // ── addToFilRouge ─────────────────────────────────────────────────────────────

  function addToFilRouge(item) {
    if (!item) return;
    const filRougeItem = {
      id: item.id || item.cachePath || `fr-${Date.now()}`,
      name: item.name || item.trackName || item.title || 'Inconnu',
      artist: item.artist || item.artistName || 'Artiste inconnu',
      artUrl: getBestArtworkUrl(item),
      duration: item.duration || 0,
      bpm: extractTrackBpm(item),
      genre: extractTrackGenre(item),
      cachePath: item.cachePath || '',
      persistedSourceUrl: item.persistedSourceUrl || item.url || item.localUrl || item.streamUrl || '',
      ratingKey: item.ratingKey || '',
      stemsStatus: item.stemsStatus || '',
      stems: item.stems || null,
    };
    const added = filRougeManager.addToPlaylist(filRougeItem);
    if (added) {
      setFilRougeTrackStatus(filRougeItem, {
        downloadState: filRougeItem.cachePath || filRougeItem.persistedSourceUrl ? 'done' : 'idle',
      });
      showToast(`"${filRougeItem.name}" ajouté au fil rouge`);
      const playlistItem = filRougeManager.getPlaylist().find((p) => p.id === filRougeItem.id);
      if (playlistItem) {
        runDjPlanIncrementalPass([playlistItem], filRougeManager.isLoopEnabled()).catch(() => {});
      }
    } else {
      showToast(`Déjà dans le fil rouge`, true);
    }
    renderFilRouge();
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────

  async function _apiFetchFilRougeSort(tracks, mode) {
    const baseUrl = getDownloaderApiUrl?.();
    if (!baseUrl) throw new Error('API URL manquante');
    const token = getDownloaderApiToken?.();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const body = { tracks, mode };
    const appliedSec = getTrackMaxDurationAppliedSec?.() || 0;
    if (appliedSec > 0) body.maxDuration = { value: appliedSec, unit: 's' };
    const res = await fetch(`${baseUrl}/api/fil-rouge/sort`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`sort API ${res.status}`);
    const data = await res.json();
    const sortedTracks = Array.isArray(data.tracks) ? data.tracks : data;
    const transitions = Array.isArray(data.transitions) ? data.transitions : [];
    return { tracks: sortedTracks, transitions, totalDurationSec: data.totalDurationSec ?? null };
  }

  async function sortFilRouge(mode) {
    sortMode = mode;
    localStorage.setItem(STORAGE_KEYS.filRougeSortMode, sortMode);
    if (mode === 'original') { renderFilRouge(); return; }
    const playlist = filRougeManager.getPlaylist();
    if (!playlist.length) { renderFilRouge(); return; }
    try {
      const { tracks: sorted, transitions } = await _apiFetchFilRougeSort(playlist, mode);
      if (Array.isArray(sorted) && sorted.length) {
        const localById = new Map(playlist.map((item) => [String(item.id), item]));
        const reordered = sorted.map((apiItem) => localById.get(String(apiItem.id))).filter(Boolean);
        playlist.forEach((item) => {
          if (!reordered.some((r) => String(r.id) === String(item.id))) reordered.push(item);
        });
        filRougeManager.setPlaylist(reordered);
        for (let i = 0; i < transitions.length; i++) {
          const t = transitions[i];
          if (!t || !reordered[i] || !reordered[i + 1]) continue;
          filRougeManager.patchPlaylistItem(reordered[i].id, {
            djTransition: {
              toItemId: reordered[i + 1].id,
              automixMode: t.automixMode || null,
              mixOutSec: t.mixOutSec,
              mixInSec: t.mixInSec,
              mixInSecDefined: Number.isFinite(t.mixInSec),
              crossfadeDurationSec: t.crossfadeDurationSec,
              compatibilityScore: t.compatibilityScore,
              transitionType: null,
              recommendedBpm: null,
              decisionId: null,
              computedAt: Date.now(),
            },
          });
        }
      }
    } catch (err) {
      console.error('[filRouge] sortFilRouge error:', err);
      showToast('Tri indisponible (API)', true);
    }
    renderFilRouge();
  }

  // ── renderFilRouge ────────────────────────────────────────────────────────────

  function renderFilRouge() {
    updateDjPlanIndicator();

    const playlist = filRougeManager.getPlaylist();
    const priorityQueue = filRougeManager.getPriorityQueue();
    const filRougeIndex = filRougeManager.getCurrentIndex();

    const visibleStart = filRougeIndex > 0 ? Math.max(0, filRougeIndex - 2) : 0;
    playlist.slice(visibleStart, visibleStart + 20).forEach((item) => {
      if (!item.bpm || !item.genre) fetchMissingMeta(item).catch(() => {});
    });
    priorityQueue.slice(0, 10).forEach((item) => {
      if (!item.bpm || !item.genre) fetchMissingMeta(item).catch(() => {});
    });

    if (filRougeCountEl) {
      filRougeCountEl.textContent = `${playlist.length} morceau${playlist.length > 1 ? 'x' : ''}`;
    }
    if (filRougePriorityCountEl) {
      filRougePriorityCountEl.textContent = String(priorityQueue.length);
    }
    if (filRougeShuffleBtn) {
      const on = filRougeManager.isShuffleEnabled();
      filRougeShuffleBtn.textContent = `Shuffle: ${on ? 'ON' : 'OFF'}`;
      filRougeShuffleBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (filRougeLoopBtn) {
      const on = filRougeManager.isLoopEnabled();
      filRougeLoopBtn.textContent = `Loop: ${on ? 'ON' : 'OFF'}`;
      filRougeLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (filRougeSortSelectEl) {
      filRougeSortSelectEl.value = sortMode;
      filRougeSortSelectEl.onchange = (e) => sortFilRouge(e.target.value);
    }

    if (filRougePriorityListEl) {
      if (!priorityQueue.length) {
        filRougePriorityListEl.innerHTML = '<div class="filrouge-empty">Aucun morceau en file prioritaire</div>';
      } else {
        filRougePriorityListEl.innerHTML = priorityQueue.map((item, idx) => `
          <div class="filrouge-item filrouge-priority-item" data-index="${idx}">
            <img class="filrouge-art"${item.artUrl ? ` src="${escHtml(item.artUrl)}"` : ' hidden'} alt="" loading="lazy" onerror="this.hidden=true">
            <div class="filrouge-info">
              <span class="filrouge-pos">${idx + 1}.</span>
              <div class="filrouge-name">${escHtml(item.name || 'Inconnu')}</div>
              <div class="filrouge-artist">${escHtml(item.artist || '')}</div>
              ${buildFilRougeDanceChips(item)}
            </div>
            <button class="filrouge-remove-btn" data-type="priority" data-index="${idx}" aria-label="Retirer">✕</button>
          </div>
        `).join('');
      }
    }

    if (filRougePlaylistListEl) {
      if (!playlist.length) {
        filRougePlaylistListEl.innerHTML = '<div class="filrouge-empty">Playlist vide. Ajoutez des morceaux depuis le Cache.</div>';
      } else {
        filRougePlaylistListEl.innerHTML = playlist.map((item, idx) => {
          const status = getFilRougeTrackStatus(item);
          const downloadLabel = status.downloadState === 'downloading'
            ? 'Download en cours'
            : status.downloadState === 'done'
              ? 'Download fini'
              : status.downloadState === 'error'
                ? 'Download erreur'
                : 'Download en attente';
          const downloadClass = status.downloadState === 'downloading' ? 'is-downloading'
            : status.downloadState === 'done' ? 'is-done'
            : status.downloadState === 'error' ? 'is-error'
            : 'is-idle';
          const mixInfoLabel = status.hasMixInfo ? 'Mix info ✓' : 'Mix info --';
          const mixInfoClass = status.hasMixInfo ? 'is-done' : 'is-idle';
          return `
          <div class="filrouge-item${idx === filRougeIndex ? ' filrouge-current' : ''}" data-index="${idx}">
            <img class="filrouge-art"${item.artUrl ? ` src="${escHtml(item.artUrl)}"` : ' hidden'} alt="" loading="lazy" onerror="this.hidden=true">
            <div class="filrouge-info">
              <span class="filrouge-pos">${idx + 1}.</span>
              <div class="filrouge-meta">
                <div class="filrouge-name">${escHtml(item.name || 'Inconnu')}</div>
                <div class="filrouge-artist">${escHtml(item.artist || '')}</div>
                ${buildFilRougeDanceChips(item)}
                <div class="filrouge-statuses">
                  <span class="filrouge-status ${downloadClass}">${downloadLabel}</span>
                  <span class="filrouge-status ${mixInfoClass}">${mixInfoLabel}</span>
                </div>
              </div>
            </div>
            <div class="filrouge-actions">
              ${renderDjTransitionFeedback(item)}
              ${item.djTrackId ? `<button class="filrouge-iconic-btn${item.djIsIconic ? ' is-iconic' : ''}" data-item-id="${item.id}" title="${item.djIsIconic ? 'Retirer le statut iconic' : 'Marquer comme iconic (ne jamais couper)'}" aria-label="${item.djIsIconic ? 'Retirer iconic' : 'Marquer iconic'}">${item.djIsIconic ? '★' : '☆'}</button>` : ''}
              ${idx < filRougeIndex
                ? `<button class="filrouge-set-current-btn" data-index="${idx}" aria-label="Revenir à ce morceau" title="Revenir à ce morceau">⏪</button>`
                : idx > filRougeIndex + 1
                  ? `<button class="filrouge-set-current-btn" data-index="${idx}" aria-label="Sauter à ce morceau" title="Sauter ici (skip les ${idx - filRougeIndex - 1} morceau${idx - filRougeIndex - 1 > 1 ? 'x' : ''} précédents)">⏩</button>`
                  : ''
              }
              <button class="filrouge-priority-add-btn" data-index="${idx}" aria-label="Ajouter à la file d'attente" title="Ajouter à la file d'attente">⏭</button>
              <button class="filrouge-remove-btn" data-type="playlist" data-index="${idx}" aria-label="Retirer">✕</button>
            </div>
          </div>`;
        }).join('');
      }
    }

    // Attach event handlers after DOM is written
    document.querySelectorAll('.filrouge-remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const idx = Number(btn.dataset.index);
        if (type === 'priority') {
          filRougeManager.removeFromPriorityQueue(idx);
        } else {
          const removed = filRougeManager.getPlaylist()[idx];
          const key = getFilRougeTrackKey(removed);
          if (key) filRougeTrackStatusByKey.delete(key);
          addSpotifyDeletedId(removed?.id);
          filRougeManager.removeFromPlaylist(idx);
        }
        renderFilRouge();
      });
    });

    document.querySelectorAll('.filrouge-priority-add-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const item = filRougeManager.getPlaylist()[idx];
        if (item) {
          addToQueue(item, { source: 'fil-rouge', showAddedToast: false });
          showToast(`"${item.name}" → file d'attente`);
        }
      });
    });

    document.querySelectorAll('.filrouge-set-current-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const item = filRougeManager.getPlaylist()[idx];
        if (!item) return;
        filRougeManager.jumpToIndex(idx);
        renderFilRouge();
        showToast(`⏩ Fil rouge : prochain → "${item.name}"`);
      });
    });

    document.querySelectorAll('.filrouge-dj-feedback-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const container = btn.closest('.filrouge-dj-feedback');
        const decisionId = container?.dataset.decisionId;
        const feedback = btn.dataset.feedback;
        if (!decisionId || !feedback) return;
        const result = await djPlanManager.submitFeedback(decisionId, feedback);
        if (!result) { showToast("Feedback DJ: échec de l'envoi", true); return; }
        container.querySelectorAll('.filrouge-dj-feedback-btn').forEach((b) => {
          b.classList.toggle('is-selected', b === btn);
        });
        showToast(feedback === 'good' ? '👍 Merci pour le retour' : '👎 Merci pour le retour');
      });
    });

    document.querySelectorAll('.filrouge-iconic-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.itemId;
        const item = filRougeManager.getPlaylist().find((p) => String(p.id) === String(itemId));
        if (!item) return;
        const newIconic = !item.djIsIconic;
        const result = await djPlanManager.setIconic(item, newIconic);
        if (!result) { showToast('Iconic DJ : échec', true); return; }
        renderFilRouge();
        showToast(newIconic ? '★ Morceau marqué iconic' : '☆ Statut iconic retiré');
      });
    });
  }

  return {
    hasStemsForTrack,
    setFilRougeTrackStatus,
    getFilRougeTrackStatus,
    addToFilRouge,
    renderFilRouge,
    sortFilRouge,
    updateDjPlanIndicator,
    runDjSetQualityRefresh,
    runDjPlanFullPass,
    runDjPlanIncrementalPass,
    scheduleDjSetQualityRefresh,
    initDjSetProfileSelect,
  };
}
