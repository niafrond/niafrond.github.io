import { chooseRoundPair, pickRandomTracks } from './game-logic.js';
import { StemClient } from './stem-client.js';

const TRACKS_KEY = 'mix-blind-test:tracks';
const SCORE_KEY = 'mix-blind-test:scores';

const stemClient = new StemClient();

const state = {
  tracks: loadTracks(),
  usedPairKeys: new Set(),
  round: 0,
  playing: null,
  teams: loadTeams(),
};

const refs = {
  apiUrl: document.getElementById('api-url'),
  btnSaveApi: document.getElementById('btn-save-api'),
  songForm: document.getElementById('song-form'),
  btnImportDjMix: document.getElementById('btn-import-dj-mix'),
  btnAddRandomDjMix: document.getElementById('btn-add-random-dj-mix'),
  randomAddCount: document.getElementById('random-add-count'),
  tracksBody: document.getElementById('tracks-body'),
  difficultMode: document.getElementById('difficult-mode'),
  btnStartRound: document.getElementById('btn-start-round'),
  btnStopRound: document.getElementById('btn-stop-round'),
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
};

function loadTracks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRACKS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
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
      state.tracks = state.tracks.filter((item) => item.id !== track.id);
      saveTracks();
      renderTracks();
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

function normalizeTrack(raw) {
  const name = String(raw?.name || '').trim();
  if (!name) return null;
  const artist = String(raw?.artist || '').trim();
  const cachePath = String(raw?.cachePath || '').trim();
  const bpm = Number(raw?.bpm);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    artist,
    cachePath,
    bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null,
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
  return track.cachePath || `${track.name.toLowerCase()}::${track.artist.toLowerCase()}`;
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

async function startRound() {
  if (state.playing) return;
  if (state.tracks.length < 2) {
    updateStatus('Ajoutez au moins deux chansons.', true);
    return;
  }

  const choice = chooseRoundPair(state.tracks, state.usedPairKeys, refs.difficultMode.checked);
  if (!choice) {
    state.usedPairKeys.clear();
    updateStatus('Toutes les paires ont été jouées. Réinitialisation des paires.', false);
    return;
  }

  state.round += 1;
  refs.roundLabel.textContent = `Manche ${state.round}`;
  refs.revealAnswer.textContent = 'Réponse cachée jusqu’à la fin de la manche.';

  const swap = Math.random() < 0.5;
  const vocalsTrack = swap ? choice.right : choice.left;
  const instrumentalTrack = swap ? choice.left : choice.right;

  try {
    updateStatus('Préparation des stems…');
    const [vocalsUrl, instrumentalUrl] = await Promise.all([
      stemClient.ensureStemUrl(vocalsTrack, 'vocals', (msg) => updateStatus(msg)),
      stemClient.ensureStemUrl(instrumentalTrack, 'instrumental', (msg) => updateStatus(msg)),
    ]);

    const vocalsAudio = new Audio(vocalsUrl);
    const instrumentalAudio = new Audio(instrumentalUrl);
    vocalsAudio.preload = 'auto';
    instrumentalAudio.preload = 'auto';
    vocalsAudio.volume = 1;
    instrumentalAudio.volume = 0.85;

    await Promise.all([vocalsAudio.play(), instrumentalAudio.play()]);

    state.playing = {
      pairKey: choice.key,
      vocalsTrack,
      instrumentalTrack,
      vocalsAudio,
      instrumentalAudio,
    };
    state.usedPairKeys.add(choice.key);
    refs.btnStopRound.disabled = false;
    refs.btnStartRound.disabled = true;
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

  refs.btnStopRound.disabled = true;
  refs.btnStartRound.disabled = false;

  if (showAnswer && current) {
    refs.revealAnswer.textContent = [
      `🎤 Voix : ${current.vocalsTrack.name} — ${current.vocalsTrack.artist || 'Artiste inconnu'}`,
      `🎼 Instru : ${current.instrumentalTrack.name} — ${current.instrumentalTrack.artist || 'Artiste inconnu'}`,
    ].join(' | ');
    refs.nowPlaying.textContent = '✅ Manche terminée';
  } else {
    refs.nowPlaying.textContent = '⏸️ Aucun mix en cours';
  }

  state.playing = null;
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

    mergeTracks([track]);
    refs.songForm.reset();
    updateStatus('Chanson ajoutée.');
  });

  refs.btnImportDjMix.addEventListener('click', () => {
    const imported = readDjMixQueueTracks();

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
  });

  refs.btnAddRandomDjMix.addEventListener('click', () => {
    const imported = readDjMixQueueTracks();
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
  });
}

function initApiConfig() {
  refs.apiUrl.value = stemClient.getApiUrl();
  refs.btnSaveApi.addEventListener('click', () => {
    stemClient.setApiUrl(refs.apiUrl.value);
    updateStatus('URL du serveur sauvegardée.');
  });
}

function init() {
  initApiConfig();
  wireSongForm();
  wireScoreControls();

  refs.btnStartRound.addEventListener('click', () => {
    void startRound();
  });

  refs.btnStopRound.addEventListener('click', () => {
    stopRound(true);
    updateStatus('Manche stoppée.');
  });

  renderTracks();
  renderScores();
  updateStatus('Prêt. Ajoutez des chansons puis démarrez une manche.');

  window.addEventListener('beforeunload', () => {
    stopRound(false);
    stemClient.dispose();
  });
}

init();
