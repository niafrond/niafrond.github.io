import { chooseRoundPair, makePairKey, pickRandomTracks } from './game-logic.js';
import { StemClient } from './stem-client.js';
import { createDownloaderConfigManager } from '../dj-mix/lib/downloaderConfig.js';
import { createApiHealthMonitor } from '../dj-mix/lib/apiHealthMonitor.js';
import { createTrackStore } from '../dj-mix/lib/trackStore.js';
import { getTrackCacheKey } from '../dj-mix/lib/audioSourceManager.js';
import { DEFAULT_DOWNLOADER_API_URL, STORAGE_KEYS } from '../dj-mix/lib/storageKeys.js';

const TRACKS_KEY = 'mix-blind-test:tracks';
const SCORE_KEY = 'mix-blind-test:scores';

const trackStore = createTrackStore();
trackStore.restore();

const downloaderConfig = createDownloaderConfigManager({
  defaultUrl: DEFAULT_DOWNLOADER_API_URL,
  storageKey: STORAGE_KEYS.downloaderApiUrl,
  tokenStorageKey: STORAGE_KEYS.downloaderApiToken,
  cdnStorageKey: STORAGE_KEYS.downloaderCdnUrl,
  inputEl: document.getElementById('api-url'),
  tokenInputEl: document.getElementById('api-token'),
  cdnInputEl: document.getElementById('api-cdn-url'),
  saveBtn: document.getElementById('btn-save-api'),
  testBtn: document.getElementById('btn-test-api'),
  statusEl: document.getElementById('api-status'),
});

const apiHealthMonitor = createApiHealthMonitor({
  getDownloaderApiUrl: downloaderConfig.getDownloaderApiUrl,
  getDownloaderApiToken: downloaderConfig.getDownloaderApiToken,
  onOffline: () => updateStatus('Serveur API hors ligne.', true),
  onOnline: () => updateStatus('Serveur API de retour en ligne ✓', false),
});

const stemClient = new StemClient({
  getDownloaderApiUrl: downloaderConfig.getDownloaderApiUrl,
  getDownloaderApiToken: downloaderConfig.getDownloaderApiToken,
  apiHealthMonitor,
});

const state = {
  tracks: loadTracks(),
  usedPairKeys: new Set(),
  usedTrackIds: new Set(),
  round: 0,
  playing: null,
  pending: null,
  teams: loadTeams(),
};

const refs = {
  screenSetup: document.getElementById('screen-setup'),
  screenGame: document.getElementById('screen-game'),
  btnGoGame: document.getElementById('btn-go-game'),
  btnBackSetup: document.getElementById('btn-back-setup'),
  setupStatus: document.getElementById('setup-status'),
  songForm: document.getElementById('song-form'),
  btnImportDjMix: document.getElementById('btn-import-dj-mix'),
  btnAddRandomDjMix: document.getElementById('btn-add-random-dj-mix'),
  randomAddCount: document.getElementById('random-add-count'),
  tracksBody: document.getElementById('tracks-body'),
  difficultMode: document.getElementById('difficult-mode'),
  btnPreviewRound: document.getElementById('btn-preview-round'),
  btnStartRound: document.getElementById('btn-start-round'),
  btnStopRound: document.getElementById('btn-stop-round'),
  btnSwapVocals: document.getElementById('btn-swap-vocals'),
  btnSwapInstrumental: document.getElementById('btn-swap-instrumental'),
  btnSwapBoth: document.getElementById('btn-swap-both'),
  gameStatus: document.getElementById('game-status'),
  roundLabel: document.getElementById('round-label'),
  nowPlaying: document.getElementById('now-playing'),
  revealAnswer: document.getElementById('reveal-answer'),
  teamAName: document.getElementById('team-a-name'),
  teamBName: document.getElementById('team-b-name'),
  teamAScore: document.getElementById('team-a-score'),
  teamBScore: document.getElementById('team-b-score'),
  teamAPlus1: document.getElementById('team-a-plus-1'),
  teamAMinus1: document.getElementById('team-a-minus-1'),
  teamBPlus1: document.getElementById('team-b-plus-1'),
  teamBMinus1: document.getElementById('team-b-minus-1'),
  vocalsVolume: document.getElementById('vocals-volume'),
  instrumentalVolume: document.getElementById('instrumental-volume'),
  vocalsVolumeValue: document.getElementById('vocals-volume-value'),
  instrumentalVolumeValue: document.getElementById('instrumental-volume-value'),
};

function loadTracks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACKS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeTrack(item, { requireName: false }))
      .filter((track) => Boolean(track?.name || track?.cachePath));
  } catch (_) {
    return [];
  }
}

function loadTeams() {
  const fallback = [
    { id: 'A', name: 'Équipe A', score: 0 },
    { id: 'B', name: 'Équipe B', score: 0 },
  ];
  try {
    const parsed = JSON.parse(localStorage.getItem(SCORE_KEY) || '[]');
    if (!Array.isArray(parsed) || parsed.length !== 2) return fallback;
    return parsed.map((team, index) => ({
      id: index === 0 ? 'A' : 'B',
      name: String(team?.name || fallback[index].name),
      score: Number(team?.score) || 0,
    }));
  } catch (_) {
    return fallback;
  }
}

function saveTracks() {
  localStorage.setItem(TRACKS_KEY, JSON.stringify(state.tracks));
}

function saveTeams() {
  localStorage.setItem(SCORE_KEY, JSON.stringify(state.teams));
}

function updateStatus(message, isError = false) {
  refs.gameStatus.textContent = message;
  refs.gameStatus.classList.toggle('error', Boolean(isError));
  if (refs.setupStatus) {
    refs.setupStatus.textContent = message;
    refs.setupStatus.classList.toggle('error', Boolean(isError));
  }
}

function countUnusedTracks() {
  return state.tracks.filter((track) => !state.usedTrackIds.has(track.id)).length;
}

function showScreen(nextScreen) {
  const showSetup = nextScreen === 'setup';
  refs.screenSetup?.classList.toggle('hidden', !showSetup);
  refs.screenGame?.classList.toggle('hidden', showSetup);
}

function renderTracks() {
  refs.tracksBody.innerHTML = '';
  state.tracks.forEach((track) => {
    const row = document.createElement('tr');

    const titleCell = document.createElement('td');
    titleCell.textContent = track.name;

    const artistCell = document.createElement('td');
    artistCell.textContent = track.artist || '—';

    const bpmCell = document.createElement('td');
    bpmCell.textContent = track.bpm ? String(track.bpm) : '—';

    const cacheCell = document.createElement('td');
    cacheCell.textContent = track.cachePath || '—';

    const actionCell = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn danger';
    removeBtn.textContent = 'Supprimer';
    removeBtn.addEventListener('click', () => {
      if (state.pending && (state.pending.vocalsTrack.id === track.id || state.pending.instrumentalTrack.id === track.id)) {
        state.pending = null;
      }
      state.tracks = state.tracks.filter((item) => item.id !== track.id);
      saveTracks();
      renderTracks();
      renderPendingRound();
      updateRoundButtons();
    });
    actionCell.appendChild(removeBtn);

    row.append(titleCell, artistCell, bpmCell, cacheCell, actionCell);
    refs.tracksBody.appendChild(row);
  });
}

function renderScores() {
  refs.teamAName.value = state.teams[0].name;
  refs.teamBName.value = state.teams[1].name;
  refs.teamAScore.textContent = String(state.teams[0].score);
  refs.teamBScore.textContent = String(state.teams[1].score);
}

function normalizeTrack(raw, options = {}) {
  const { requireName = true } = options;
  const name = String(raw?.name || '').trim();
  if (requireName && !name) return null;
  const artist = String(raw?.artist || '').trim();
  const cachePath = String(raw?.cachePath || '').trim();
  const bpm = Number(raw?.bpm);
  const rawId = String(raw?.id || '').trim();
  const normalizedBpm = Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null;

  // Registre partagé avec dj-mix (mêmes mécaniques que dj-mix/lib/queueManager.js) :
  // une piste déjà connue (artwork/bpm/cachePath renseignés côté dj-mix) apparaît
  // identique ici, et inversement ce qu'on apprend ici lui profite.
  const storeKey = getTrackCacheKey({ artist, name });
  const shared = storeKey
    ? trackStore.getOrCreate({ id: storeKey, name, artist, cachePath, bpm: normalizedBpm })
    : null;

  return {
    id: rawId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    name: shared?.name || name,
    artist: shared?.artist || artist,
    cachePath: shared?.cachePath || cachePath,
    bpm: Number.isFinite(shared?.bpm) && shared.bpm > 0 ? Math.round(shared.bpm) : normalizedBpm,
  };
}

function dedupeBySource(tracks) {
  const map = new Map();
  for (const track of tracks) {
    const key = trackSourceKey(track);
    if (!map.has(key)) map.set(key, track);
  }
  return [...map.values()];
}

function trackSourceKey(track) {
  const cachePath = String(track?.cachePath || '').trim();
  if (cachePath) return cachePath;
  const name = String(track?.name || '').trim().toLowerCase();
  const artist = String(track?.artist || '').trim().toLowerCase();
  return `${name}::${artist}`;
}

function readDjMixQueueTracks() {
  const raw = localStorage.getItem('dj-mix:queue');
  const parsed = (() => {
    try {
      return JSON.parse(raw || '[]');
    } catch (_) {
      return [];
    }
  })();

  return Array.isArray(parsed)
    ? parsed
      .map((item) => normalizeTrack({
        name: item?.name || item?.title,
        artist: item?.artist,
        cachePath: item?.cachePath,
        bpm: item?.bpm,
      }))
      .filter(Boolean)
    : [];
}

function mergeTracks(nextTracks) {
  const previousCount = state.tracks.length;
  state.tracks = dedupeBySource([...state.tracks, ...nextTracks]);
  const addedCount = state.tracks.length - previousCount;
  if (addedCount > 0) {
    saveTracks();
    renderTracks();
  }
  return addedCount;
}

function sliderValueToVolume(value) {
  const parsed = Number(value);
  const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 100;
  return clamped / 100;
}

function updateVolumeSliderLabels() {
  const vocalsVolume = sliderValueToVolume(refs.vocalsVolume?.value);
  const instrumentalVolume = sliderValueToVolume(refs.instrumentalVolume?.value);
  if (refs.vocalsVolumeValue) refs.vocalsVolumeValue.textContent = `${Math.round(vocalsVolume * 100)}%`;
  if (refs.instrumentalVolumeValue) refs.instrumentalVolumeValue.textContent = `${Math.round(instrumentalVolume * 100)}%`;
}

function applyStemVolumes() {
  const vocalsVolume = sliderValueToVolume(refs.vocalsVolume?.value);
  const instrumentalVolume = sliderValueToVolume(refs.instrumentalVolume?.value);
  if (state.playing) {
    state.playing.vocalsAudio.volume = vocalsVolume;
    state.playing.instrumentalAudio.volume = instrumentalVolume;
  }
  updateVolumeSliderLabels();
}

function formatMixReveal(vocalsTrack, instrumentalTrack) {
  return [
    `🎤 Voix : ${vocalsTrack.name} — ${vocalsTrack.artist || 'Artiste inconnu'}`,
    `🎼 Instru : ${instrumentalTrack.name} — ${instrumentalTrack.artist || 'Artiste inconnu'}`,
  ].join(' | ');
}

function toFiniteBpm(value) {
  const bpm = Number(value);
  return Number.isFinite(bpm) && bpm > 0 ? bpm : null;
}

function chooseReplacementTrack(candidates, referenceBpm, difficultMode = false) {
  if (!candidates.length) return null;
  if (difficultMode) return candidates[Math.floor(Math.random() * candidates.length)];

  const refBpm = toFiniteBpm(referenceBpm);
  if (refBpm == null) return candidates[Math.floor(Math.random() * candidates.length)];

  const scored = candidates.map((track) => ({
    track,
    gap: (() => {
      const bpm = toFiniteBpm(track.bpm);
      return bpm == null ? Number.POSITIVE_INFINITY : Math.abs(bpm - refBpm);
    })(),
  })).sort((a, b) => a.gap - b.gap);

  const bestGap = scored[0].gap;
  const finalists = scored.filter((item) => item.gap === bestGap).map((item) => item.track);
  return finalists[Math.floor(Math.random() * finalists.length)];
}

function updateRoundButtons() {
  const isPlaying = Boolean(state.playing);
  const hasPending = Boolean(state.pending);
  const hasEnoughUnusedTracks = countUnusedTracks() >= 2;
  refs.btnPreviewRound.disabled = isPlaying || !hasEnoughUnusedTracks;
  refs.btnStartRound.disabled = isPlaying || !hasPending;
  refs.btnStopRound.disabled = !isPlaying;
  refs.btnSwapVocals.disabled = isPlaying || !hasPending;
  refs.btnSwapInstrumental.disabled = isPlaying || !hasPending;
  refs.btnSwapBoth.disabled = isPlaying || !hasPending;
}

function renderPendingRound() {
  if (state.pending) {
    refs.revealAnswer.textContent = formatMixReveal(state.pending.vocalsTrack, state.pending.instrumentalTrack);
    if (!state.playing) {
      refs.nowPlaying.textContent = '🧩 Combinaison prête (non lancée)';
    }
  } else if (!state.playing) {
    refs.revealAnswer.textContent = 'Préparez une combinaison pour l'afficher au game master.';
    refs.nowPlaying.textContent = '⏸️ Aucun mix en cours';
  }
}

function createPendingRoundFromPair(pair, swap = Math.random() < 0.5) {
  return {
    pairKey: pair.key,
    vocalsTrack: swap ? pair.right : pair.left,
    instrumentalTrack: swap ? pair.left : pair.right,
  };
}

function pickNewPair(excludedPairKeys = new Set()) {
  const usedWithExclusions = new Set([...state.usedPairKeys, ...excludedPairKeys]);
  const availableTracks = state.tracks.filter((track) => !state.usedTrackIds.has(track.id));
  return chooseRoundPair(availableTracks, usedWithExclusions, refs.difficultMode.checked);
}

function prepareRound() {
  if (state.playing) return;
  if (countUnusedTracks() < 2) {
    if (state.tracks.length < 2) {
      updateStatus('Ajoutez au moins deux chansons.', true);
    } else {
      updateStatus('Plus assez de chansons inédites pour préparer une nouvelle manche.', true);
    }
    return;
  }

  let choice = pickNewPair();
  if (!choice) {
    state.pending = null;
    renderPendingRound();
    updateRoundButtons();
    updateStatus('Aucune combinaison inédite restante pour cette partie.', true);
    return;
  }

  state.pending = createPendingRoundFromPair(choice);
  renderPendingRound();
  updateRoundButtons();
  updateStatus('Combinaison prête. Vous pouvez changer voix/instru avant de lancer.', false);
}

function swapPendingVocals() {
  if (!state.pending || state.playing) return;
  const fixedInstrumental = state.pending.instrumentalTrack;
  const currentVocals = state.pending.vocalsTrack;
  const candidates = state.tracks.filter((track) => (
    track.id !== fixedInstrumental.id
    && track.id !== currentVocals.id
    && !state.usedTrackIds.has(track.id)
    && !state.usedPairKeys.has(makePairKey(track, fixedInstrumental))
  ));
  const nextVocals = chooseReplacementTrack(candidates, fixedInstrumental.bpm, refs.difficultMode.checked);
  if (!nextVocals) {
    updateStatus('Aucune autre voix disponible pour cette instru.', true);
    return;
  }
  state.pending = {
    pairKey: makePairKey(nextVocals, fixedInstrumental),
    vocalsTrack: nextVocals,
    instrumentalTrack: fixedInstrumental,
  };
  renderPendingRound();
  updateRoundButtons();
  updateStatus('Voix changée.', false);
}

function swapPendingInstrumental() {
  if (!state.pending || state.playing) return;
  const fixedVocals = state.pending.vocalsTrack;
  const currentInstrumental = state.pending.instrumentalTrack;
  const candidates = state.tracks.filter((track) => (
    track.id !== fixedVocals.id
    && track.id !== currentInstrumental.id
    && !state.usedTrackIds.has(track.id)
    && !state.usedPairKeys.has(makePairKey(fixedVocals, track))
  ));
  const nextInstrumental = chooseReplacementTrack(candidates, fixedVocals.bpm, refs.difficultMode.checked);
  if (!nextInstrumental) {
    updateStatus('Aucune autre instru disponible pour cette voix.', true);
    return;
  }
  state.pending = {
    pairKey: makePairKey(fixedVocals, nextInstrumental),
    vocalsTrack: fixedVocals,
    instrumentalTrack: nextInstrumental,
  };
  renderPendingRound();
  updateRoundButtons();
  updateStatus('Instru changée.', false);
}

function swapPendingBoth() {
  if (!state.pending || state.playing) return;
  const excluded = new Set([state.pending.pairKey]);
  const choice = pickNewPair(excluded);
  if (!choice) {
    updateStatus('Aucune autre combinaison disponible.', true);
    return;
  }
  state.pending = createPendingRoundFromPair(choice);
  renderPendingRound();
  updateRoundButtons();
  updateStatus('Voix + instru changées.', false);
}

async function startRound() {
  if (state.playing) return;
  if (!state.pending) {
    updateStatus('Préparez une combinaison avant de lancer.', true);
    return;
  }
  const pending = state.pending;

  state.round += 1;
  refs.roundLabel.textContent = `Manche ${state.round}`;
  refs.revealAnswer.textContent = formatMixReveal(pending.vocalsTrack, pending.instrumentalTrack);

  try {
    updateStatus('Préparation des stems…');
    const [vocalsUrl, instrumentalUrl] = await Promise.all([
      stemClient.ensureStemUrl(pending.vocalsTrack, 'vocals', (msg) => updateStatus(msg)),
      stemClient.ensureStemUrl(pending.instrumentalTrack, 'instrumental', (msg) => updateStatus(msg)),
    ]);

    const vocalsAudio = new Audio(vocalsUrl);
    const instrumentalAudio = new Audio(instrumentalUrl);
    vocalsAudio.preload = 'auto';
    instrumentalAudio.preload = 'auto';
    vocalsAudio.volume = sliderValueToVolume(refs.vocalsVolume?.value);
    instrumentalAudio.volume = sliderValueToVolume(refs.instrumentalVolume?.value);

    await Promise.all([vocalsAudio.play(), instrumentalAudio.play()]);

    state.playing = {
      pairKey: pending.pairKey,
      vocalsTrack: pending.vocalsTrack,
      instrumentalTrack: pending.instrumentalTrack,
      vocalsAudio,
      instrumentalAudio,
    };
    state.pending = null;
    state.usedPairKeys.add(pending.pairKey);
    state.usedTrackIds.add(pending.vocalsTrack.id);
    state.usedTrackIds.add(pending.instrumentalTrack.id);
    updateRoundButtons();
    refs.nowPlaying.textContent = '🎧 Mix en cours…';
    updateStatus('Manche lancée. Le game master gère les points.', false);
  } catch (error) {
    updateStatus(error?.message || 'Impossible de lancer la manche.', true);
    stopRound(false);
  }
}

function stopRound(showAnswer = true) {
  const current = state.playing;
  if (current) {
    current.vocalsAudio.pause();
    current.instrumentalAudio.pause();
    current.vocalsAudio.currentTime = 0;
    current.instrumentalAudio.currentTime = 0;
  }

  if (showAnswer && current) {
    refs.revealAnswer.textContent = formatMixReveal(current.vocalsTrack, current.instrumentalTrack);
    refs.nowPlaying.textContent = '✅ Manche terminée';
  }

  state.playing = null;
  renderPendingRound();
  updateRoundButtons();
}

function wireScoreControls() {
  refs.teamAPlus1.addEventListener('click', () => adjustScore(0, 1));
  refs.teamAMinus1.addEventListener('click', () => adjustScore(0, -1));
  refs.teamBPlus1.addEventListener('click', () => adjustScore(1, 1));
  refs.teamBMinus1.addEventListener('click', () => adjustScore(1, -1));

  refs.teamAName.addEventListener('change', () => {
    state.teams[0].name = refs.teamAName.value.trim() || 'Équipe A';
    saveTeams();
    renderScores();
  });

  refs.teamBName.addEventListener('change', () => {
    state.teams[1].name = refs.teamBName.value.trim() || 'Équipe B';
    saveTeams();
    renderScores();
  });
}

function wireVolumeControls() {
  refs.vocalsVolume?.addEventListener('input', () => applyStemVolumes());
  refs.instrumentalVolume?.addEventListener('input', () => applyStemVolumes());
}

function adjustScore(index, delta) {
  state.teams[index].score += delta;
  saveTeams();
  renderScores();
}

function wireSongForm() {
  refs.songForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(refs.songForm);
    const track = normalizeTrack({
      name: formData.get('name'),
      artist: formData.get('artist'),
      cachePath: formData.get('cachePath'),
      bpm: formData.get('bpm'),
    });

    if (!track) {
      updateStatus('Nom de chanson requis.', true);
      return;
    }

    const addedCount = mergeTracks([track]);
    refs.songForm.reset();
    if (!addedCount) {
      updateStatus('Cette chanson est déjà dans la bibliothèque.', true);
      return;
    }
    updateStatus('Chanson ajoutée.');
  });

  refs.btnImportDjMix.addEventListener('click', () => {
    void (async () => {
      let imported = readDjMixQueueTracks();
      if (!imported.length) {
        updateStatus('Chargement du cache serveur…');
        imported = (await stemClient.fetchServerCacheTracks())
          .map((raw) => normalizeTrack(raw, { requireName: false }))
          .filter((track) => Boolean(track?.name || track?.cachePath));
      }

      if (!imported.length) {
        updateStatus('Aucune chanson importable trouvée dans DJ Mix.', true);
        return;
      }

      const addedCount = mergeTracks(imported);
      if (!addedCount) {
        updateStatus('Toutes les chansons DJ Mix sont déjà présentes.', true);
        return;
      }
      updateStatus(`${addedCount} chanson(s) importée(s) depuis DJ Mix.`);
    })();
  });

  refs.btnAddRandomDjMix.addEventListener('click', () => {
    void (async () => {
      let imported = readDjMixQueueTracks();
      if (!imported.length) {
        updateStatus('Chargement du cache serveur…');
        imported = (await stemClient.fetchServerCacheTracks())
          .map((raw) => normalizeTrack(raw, { requireName: false }))
          .filter((track) => Boolean(track?.name || track?.cachePath));
      }

      if (!imported.length) {
        updateStatus('Aucune chanson importable trouvée dans DJ Mix.', true);
        return;
      }

      const existingKeys = new Set(state.tracks.map((track) => trackSourceKey(track)));
      const available = imported.filter((track) => !existingKeys.has(trackSourceKey(track)));
      if (!available.length) {
        updateStatus('Toutes les chansons DJ Mix sont déjà présentes.', true);
        return;
      }

      const requestedCount = Math.floor(Number(refs.randomAddCount?.value));
      const picked = pickRandomTracks(available, requestedCount);
      mergeTracks(picked);
      updateStatus(`${picked.length} chanson(s) aléatoire(s) ajoutée(s) depuis DJ Mix.`);
    })();
  });
}

function initApiConfig() {
  downloaderConfig.loadIntoForm();
  downloaderConfig.setupEvents();
}

function startNewGameSession() {
  stopRound(false);
  state.pending = null;
  state.usedPairKeys.clear();
  state.usedTrackIds.clear();
  state.round = 0;
  refs.roundLabel.textContent = 'Manche 0';
  renderPendingRound();
  updateRoundButtons();
}

function init() {
  initApiConfig();
  wireSongForm();
  wireScoreControls();
  wireVolumeControls();
  updateVolumeSliderLabels();

  refs.btnStartRound.addEventListener('click', () => {
    void startRound();
  });
  refs.btnPreviewRound.addEventListener('click', () => {
    prepareRound();
  });
  refs.btnSwapVocals.addEventListener('click', () => {
    swapPendingVocals();
  });
  refs.btnSwapInstrumental.addEventListener('click', () => {
    swapPendingInstrumental();
  });
  refs.btnSwapBoth.addEventListener('click', () => {
    swapPendingBoth();
  });

  refs.btnStopRound.addEventListener('click', () => {
    stopRound(true);
    updateStatus('Manche stoppée.');
  });

  refs.btnGoGame?.addEventListener('click', () => {
    if (state.tracks.length < 2) {
      updateStatus('Ajoutez au moins deux chansons avant de commencer la partie.', true);
      return;
    }
    startNewGameSession();
    showScreen('game');
    updateStatus('Partie initialisée. Préparez une combinaison.', false);
  });

  refs.btnBackSetup?.addEventListener('click', () => {
    stopRound(false);
    showScreen('setup');
    updateStatus('Retour à la configuration.', false);
  });

  renderTracks();
  renderScores();
  renderPendingRound();
  updateRoundButtons();
  showScreen('setup');
  updateStatus('Configurez l'API, ajoutez des chansons puis passez à l'écran partie.');

  window.addEventListener('beforeunload', () => {
    stopRound(false);
    stemClient.dispose();
  });
}

init();
