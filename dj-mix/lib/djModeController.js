import {
  DANCE_MODE_MIN_INTERVAL_SEC,
  DANCE_MODE_MAX_INTERVAL_SEC,
  MUSIC_MODE_LOW_BPM_THRESHOLD,
  MUSIC_MODE_LOW_MIN_INTERVAL,
  MUSIC_MODE_LOW_MAX_INTERVAL,
  MUSIC_MODE_NORM_MIN_INTERVAL,
  MUSIC_MODE_NORM_MAX_INTERVAL,
} from './constants.js';
import { DANCE_GENRE_DEFAULTS } from './danceGenreConfig.js';
import { DJ_MODES } from './djModeConfig.js';
import {
  createDefaultAutoDjFxAllowed,
  persistAutoDjFxSettings,
} from './autoDjFxManager.js';
import {
  persistDjModeSetting,
  persistDjModeGenrePrefs,
} from './settingsStorage.js';
import { uiState } from './uiState.js';

/**
 * Gère le mode DJ (dance/music), les préférences de genre et le preset
 * d'intervalles FX associé.
 *
 * @param {object} options
 * @param {string} options.initialMode - 'dance' | 'music'
 * @param {string[]} options.initialGenrePrefs
 * @param {() => object} options.getAutoDjFxSettings
 * @param {(s: object) => void} options.setAutoDjFxSettings
 * @param {() => void} options.updateAutoDjFxConfigUI
 * @param {() => void} options.renderQueue
 * @param {(state: object) => void} options.renderDeckState
 * @param {{ refreshDeckMetaDisplays: () => void }} options.uiRenderer
 * @param {() => number|null} options.getActiveDeckBpm
 * @param {() => string|null} options.getActiveDeckGenre
 * @param {(msg: string) => void} options.logger
 * @param {HTMLElement|null} options.configDjModeDanceBtn
 * @param {HTMLElement|null} options.configDjModeMusicBtn
 * @param {HTMLElement|null} options.configDanceGenrePrefs
 * @param {HTMLElement|null} options.cacheGenreFilterFieldEl
 * @param {HTMLSelectElement|null} options.cacheGenreFilterEl
 * @param {HTMLSelectElement|null} options.configDanceGenreList
 * @param {HTMLElement|null} options.queueList
 * @param {HTMLElement|null} options.trackArtistA
 * @param {HTMLElement|null} options.trackArtistB
 */
export function createDjModeController(options) {
  const {
    initialMode,
    initialGenrePrefs,
    getAutoDjFxSettings,
    setAutoDjFxSettings,
    updateAutoDjFxConfigUI,
    renderQueue,
    renderDeckState,
    uiRenderer: uiRnd,
    getActiveDeckBpm,
    getActiveDeckGenre,
    logger,
    configDjModeDanceBtn,
    configDjModeMusicBtn,
    configDanceGenrePrefs,
    cacheGenreFilterFieldEl,
    cacheGenreFilterEl,
    configDanceGenreList,
    queueList,
    trackArtistA,
    trackArtistB,
  } = options;

  let djMode = initialMode || 'music';
  let djModeGenrePrefs = Array.isArray(initialGenrePrefs) ? [...initialGenrePrefs] : [];

  function getDjMode() { return djMode; }
  function getDjModeGenrePrefs() { return djModeGenrePrefs; }

  function getDanceGenreOptions() {
    const fromQueue = uiState.queue.map((item) => String(item?.genre || '').trim()).filter(Boolean);
    const fromDecks = [
      String(uiState.deckDisplayItems.A?.genre || '').trim(),
      String(uiState.deckDisplayItems.B?.genre || '').trim(),
    ].filter(Boolean);
    return Array.from(new Set([...DANCE_GENRE_DEFAULTS, ...djModeGenrePrefs, ...fromQueue, ...fromDecks]));
  }

  function renderGenreList() {
    if (!configDanceGenreList) return;
    const optionValues = getDanceGenreOptions();
    configDanceGenreList.innerHTML = '';

    for (const genre of optionValues) {
      const option = document.createElement('option');
      option.value = genre;
      option.textContent = genre;
      configDanceGenreList.appendChild(option);
    }

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = 'Tous les genres';
    configDanceGenreList.insertBefore(emptyOption, configDanceGenreList.firstChild);

    const selectedGenre = String(djModeGenrePrefs[0] || '').trim().toLowerCase();
    configDanceGenreList.value = '';
    if (selectedGenre) {
      for (const option of configDanceGenreList.options) {
        if (String(option.value).trim().toLowerCase() === selectedGenre) {
          configDanceGenreList.value = option.value;
          break;
        }
      }
    }
  }

  function renderDjModeUI() {
    const isDance = djMode === 'dance';
    if (configDjModeDanceBtn) {
      configDjModeDanceBtn.classList.toggle('dj-mode-btn--active', isDance);
      configDjModeDanceBtn.setAttribute('aria-pressed', String(isDance));
    }
    if (configDjModeMusicBtn) {
      configDjModeMusicBtn.classList.toggle('dj-mode-btn--active', !isDance);
      configDjModeMusicBtn.setAttribute('aria-pressed', String(!isDance));
    }
    if (configDanceGenrePrefs) {
      configDanceGenrePrefs.hidden = !isDance;
    }
    if (cacheGenreFilterFieldEl) {
      cacheGenreFilterFieldEl.hidden = !isDance;
      if (!isDance && cacheGenreFilterEl && cacheGenreFilterEl.value) {
        cacheGenreFilterEl.value = '';
        cacheGenreFilterEl.dispatchEvent(new Event('change'));
      }
    }
    if (isDance) renderGenreList();
  }

  function applyDjModeFxPreset(mode, currentBpm) {
    const disabledInMusicLow = ['brake', 'backspin', 'scratching', 'roll'];
    const disabledInMusicNormal = ['brake', 'backspin'];
    const allowed = { ...createDefaultAutoDjFxAllowed() };

    let minIntervalSec;
    let maxIntervalSec;

    if (mode === 'dance') {
      minIntervalSec = DANCE_MODE_MIN_INTERVAL_SEC;
      maxIntervalSec = DANCE_MODE_MAX_INTERVAL_SEC;
    } else {
      const bpm = Number.isFinite(currentBpm) ? currentBpm : MUSIC_MODE_LOW_BPM_THRESHOLD;
      if (bpm < MUSIC_MODE_LOW_BPM_THRESHOLD) {
        minIntervalSec = MUSIC_MODE_LOW_MIN_INTERVAL;
        maxIntervalSec = MUSIC_MODE_LOW_MAX_INTERVAL;
        for (const type of disabledInMusicLow) allowed[type] = false;
      } else {
        minIntervalSec = MUSIC_MODE_NORM_MIN_INTERVAL;
        maxIntervalSec = MUSIC_MODE_NORM_MAX_INTERVAL;
        for (const type of disabledInMusicNormal) allowed[type] = false;
      }
    }

    const updated = {
      ...getAutoDjFxSettings(),
      minIntervalSec,
      maxIntervalSec,
      allowed,
    };
    setAutoDjFxSettings(updated);
    persistAutoDjFxSettings(updated);
    updateAutoDjFxConfigUI();
  }

  function setPreferredDanceGenre(genre) {
    const selected = String(genre || '').trim();
    djModeGenrePrefs = selected ? [selected] : [];
    persistDjModeGenrePrefs(djModeGenrePrefs);
    renderGenreList();
  }

  function handleGenreChipClick(event) {
    const target = event.target instanceof HTMLElement
      ? event.target.closest('.queue-chip--genre[data-genre]')
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    setPreferredDanceGenre(target.dataset.genre);
  }

  function suggestGenreFromCurrentTrack() {
    if (djMode !== 'dance') return;
    const genre = getActiveDeckGenre();
    if (!genre || djModeGenrePrefs.includes(genre)) return;
    djModeGenrePrefs = [genre];
    persistDjModeGenrePrefs(djModeGenrePrefs);
    renderGenreList();
  }

  function setDjMode(mode) {
    djMode = mode;
    persistDjModeSetting(mode);
    applyDjModeFxPreset(mode, getActiveDeckBpm());
    renderDjModeUI();
    renderQueue();
    uiRnd?.refreshDeckMetaDisplays();
    if (uiState.lastDeckState) renderDeckState(uiState.lastDeckState);
    logger?.(`djMode: changed ${mode} bpm=${getActiveDeckBpm()}`);
  }

  function initDjModeButtons() {
    if (configDjModeDanceBtn) {
      configDjModeDanceBtn.title = DJ_MODES.dance.title;
      configDjModeDanceBtn.setAttribute('aria-label', DJ_MODES.dance.ariaLabel);
    }
    if (configDjModeMusicBtn) {
      configDjModeMusicBtn.title = DJ_MODES.music.title;
      configDjModeMusicBtn.setAttribute('aria-label', DJ_MODES.music.ariaLabel);
    }

    configDjModeDanceBtn?.addEventListener('click', () => setDjMode('dance'));
    configDjModeMusicBtn?.addEventListener('click', () => setDjMode('music'));

    configDanceGenreList?.addEventListener('change', () => {
      setPreferredDanceGenre(configDanceGenreList.value);
    });

    const genreChipTargets = [queueList, trackArtistA, trackArtistB];
    for (const el of genreChipTargets) {
      el?.addEventListener('click', handleGenreChipClick, el === queueList);
    }
  }

  return {
    getDjMode,
    getDjModeGenrePrefs,
    setDjMode,
    renderDjModeUI,
    renderGenreList,
    setPreferredDanceGenre,
    suggestGenreFromCurrentTrack,
    applyDjModeFxPreset,
    handleGenreChipClick,
    initDjModeButtons,
  };
}
