/**
 * main.js — Scrum Poker P2P
 *
 * Architecture :
 *  - HOST : crée la salle (pas de ?room= dans l'URL)
 *  - CLIENT : rejoint via ?room=<hostPeerId>
 *
 * L'hôte est le seul à pouvoir révéler les cartes et lancer une nouvelle mise.
 * Les clients (et l'hôte) votent en cliquant sur une carte de la Fibonacci.
 */

import { ScrumPokerPeer } from './peer.js';
import { MSG, CARDS } from './constants.js';

// ─── Peer & rôle ─────────────────────────────────────────────────────────────

const peer = new ScrumPokerPeer();
const roomId = new URLSearchParams(location.search).get('room');
const IS_HOST = !roomId;

// ─── État ─────────────────────────────────────────────────────────────────────

/** @type {{ peerId: string, name: string, voted: boolean, value: string|null }[]} */
let players = [];   // Pour le HOST : clients uniquement. Pour le CLIENT : tous les joueurs.
let myName = '';
let myVote = null;  // string | null
let story = '';
let revealed = false;

// ─── Helpers DOM ─────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== id; });
  if (id === 'screen-game' && IS_HOST) {
    el('story-input').readOnly = false;
    el('story-actions').hidden = false;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Rendu ────────────────────────────────────────────────────────────────────

function fullPlayerList() {
  if (IS_HOST) {
    return [
      { peerId: peer.peerId || '__host__', name: myName, voted: myVote !== null, value: myVote },
      ...players,
    ];
  }
  return players;
}

function renderPlayers() {
  const list = el('players-list');
  list.innerHTML = '';
  const all = fullPlayerList();

  for (const p of all) {
    const chip = document.createElement('div');
    const isMe = IS_HOST
      ? p.peerId === (peer.peerId || '__host__')
      : p.peerId === peer.peerId;

    let cls = 'player-chip';
    if (isMe) cls += ' is-me';
    if (p.voted) cls += ' voted';
    chip.className = cls;

    const dot = document.createElement('span');
    dot.className = 'player-chip-dot';

    const name = document.createElement('span');
    name.textContent = escapeHtml(p.name);

    chip.appendChild(dot);
    chip.appendChild(name);

    if (revealed && p.voted) {
      const voteSpan = document.createElement('span');
      voteSpan.className = 'player-chip-vote';
      voteSpan.textContent = p.value ?? '—';
      chip.appendChild(voteSpan);
    }

    list.appendChild(chip);
  }
}

function renderCards() {
  const grid = el('cards-grid');
  grid.innerHTML = '';

  for (const val of CARDS) {
    const btn = document.createElement('button');
    btn.className = 'poker-card' + (myVote === val ? ' selected' : '');
    btn.textContent = val;
    btn.disabled = revealed;
    btn.addEventListener('click', () => onCardClick(val));
    grid.appendChild(btn);
  }
}

function renderReveal() {
  const section = el('reveal-section');
  if (!revealed) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const all = fullPlayerList();
  const votedPlayers = all.filter(p => p.voted && p.value !== null && p.value !== undefined);
  const values = votedPlayers.map(p => p.value);
  const numericVals = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

  // Compute average
  const avg = numericVals.length > 0
    ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length
    : null;

  // Detect consensus and outliers
  const uniqueVals = new Set(values);
  const isConsensus = uniqueVals.size === 1 && values.length > 0;

  // For outlier highlighting: values deviating > 50% from average
  function isOutlier(val) {
    if (avg === null || isConsensus) return false;
    const n = parseFloat(val);
    if (isNaN(n)) return false;
    return Math.abs(n - avg) > avg * 0.5;
  }

  // Render cards
  const results = el('reveal-results');
  results.innerHTML = '';
  for (const p of all) {
    const div = document.createElement('div');
    div.className = 'reveal-card';

    const valEl = document.createElement('div');
    let valCls = 'reveal-card-value';
    if (p.voted) {
      if (isConsensus) valCls += ' consensus';
      else if (isOutlier(p.value)) valCls += ' outlier';
    }
    valEl.className = valCls;
    valEl.textContent = p.voted ? (p.value ?? '—') : '—';

    const nameEl = document.createElement('div');
    nameEl.className = 'reveal-card-name';
    nameEl.textContent = escapeHtml(p.name);
    nameEl.title = p.name;

    div.appendChild(valEl);
    div.appendChild(nameEl);
    results.appendChild(div);
  }

  // Summary
  const summary = el('reveal-summary');
  if (values.length === 0) {
    summary.innerHTML = 'Aucun vote.';
  } else if (isConsensus) {
    summary.innerHTML = `✅ Consensus : <strong>${escapeHtml(values[0])}</strong>`;
  } else {
    let html = '';
    if (avg !== null) {
      html += `Moyenne : <strong>${avg.toFixed(1)}</strong>`;
    }
    // Most common value
    const counts = {};
    values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] > 1) {
      html += `&ensp;·&ensp;Valeur majoritaire : <strong>${escapeHtml(sorted[0][0])}</strong>`;
    }
    summary.innerHTML = html;
  }
}

function renderActions() {
  const btnReveal = el('btn-reveal');
  const btnReset = el('btn-reset');

  if (IS_HOST) {
    btnReveal.hidden = revealed;
    btnReset.hidden = !revealed;
  } else {
    btnReveal.hidden = true;
    btnReset.hidden = true;
  }
}

function renderAll() {
  renderPlayers();
  renderCards();
  renderReveal();
  renderActions();
}

// ─── Interactions utilisateur ─────────────────────────────────────────────────

function onCardClick(val) {
  if (revealed) return;
  myVote = myVote === val ? null : val;

  if (IS_HOST) {
    hostBroadcastPlayerList();
  } else {
    peer.sendToHost({ type: MSG.VOTE, value: myVote });
  }
  renderAll();
}

el('btn-reveal').addEventListener('click', () => {
  if (!IS_HOST || revealed) return;
  revealed = true;

  const votes = fullPlayerList().map(p => ({
    peerId: p.peerId,
    name: p.name,
    value: p.voted ? p.value : null,
  }));

  peer.broadcast({ type: MSG.REVEAL, votes });
  renderAll();
});

el('btn-reset').addEventListener('click', () => {
  if (!IS_HOST) return;
  revealed = false;
  myVote = null;
  players.forEach(p => { p.voted = false; p.value = null; });
  peer.broadcast({ type: MSG.RESET });
  renderAll();
});

el('btn-save-story').addEventListener('click', saveStory);
el('story-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && IS_HOST) {
    e.preventDefault();
    saveStory();
  }
});

function saveStory() {
  if (!IS_HOST) return;
  story = el('story-input').value.trim();
  peer.broadcast({ type: MSG.SET_STORY, story });
}

el('btn-copy-link').addEventListener('click', () => {
  const link = el('share-link').value;
  navigator.clipboard.writeText(link).then(() => {
    el('btn-copy-link').textContent = '✅ Copié !';
    setTimeout(() => { el('btn-copy-link').textContent = '📋 Copier'; }, 2000);
  }).catch(() => {
    el('share-link').select();
    document.execCommand('copy');
  });
});

// ─── Logique HOST ─────────────────────────────────────────────────────────────

function hostBroadcastPlayerList() {
  const all = fullPlayerList();
  peer.broadcast({
    type: MSG.PLAYER_LIST,
    players: all.map(p => ({
      peerId: p.peerId,
      name: p.name,
      voted: p.voted,
    })),
  });
}

function onHostMessage({ from, data }) {
  if (data.type === MSG.JOIN) {
    // Remove old entry if reconnecting
    players = players.filter(p => p.peerId !== from);
    players.push({ peerId: from, name: data.name, voted: false, value: null });

    // Send current state to the new player
    peer.sendTo(from, {
      type: MSG.JOINED,
      players: fullPlayerList().map(p => ({
        peerId: p.peerId,
        name: p.name,
        voted: p.voted,
        value: revealed ? p.value : undefined,
      })),
      story,
      revealed,
    });

    hostBroadcastPlayerList();
    renderAll();
  }

  if (data.type === MSG.VOTE) {
    const p = players.find(pl => pl.peerId === from);
    if (p) {
      p.voted = data.value !== null;
      p.value = data.value;
      hostBroadcastPlayerList();
      renderAll();
    }
  }
}

function onHostPlayerJoin() {
  // Name comes via MSG.JOIN from client — nothing to do here yet
}

function onHostPlayerLeave({ peerId }) {
  players = players.filter(p => p.peerId !== peerId);
  hostBroadcastPlayerList();
  renderAll();
}

// ─── Logique CLIENT ───────────────────────────────────────────────────────────

function onClientMessage({ data }) {
  if (data.type === MSG.JOINED) {
    players = data.players;
    story = data.story;
    revealed = data.revealed;
    el('story-input').value = story;
    renderAll();
  }

  if (data.type === MSG.PLAYER_LIST) {
    // Preserve vote values from our local state if not revealed
    const oldById = Object.fromEntries(players.map(p => [p.peerId, p]));
    players = data.players.map(p => ({
      ...p,
      value: oldById[p.peerId]?.value ?? null,
    }));
    renderAll();
  }

  if (data.type === MSG.SET_STORY) {
    story = data.story;
    el('story-input').value = story;
  }

  if (data.type === MSG.REVEAL) {
    revealed = true;
    for (const v of data.votes) {
      const p = players.find(pl => pl.peerId === v.peerId);
      if (p) { p.voted = true; p.value = v.value; }
    }
    renderAll();
  }

  if (data.type === MSG.RESET) {
    revealed = false;
    myVote = null;
    players.forEach(p => { p.voted = false; p.value = null; });
    renderAll();
  }

  if (data.type === MSG.KICKED) {
    alert('Vous avez été exclu de la partie.');
    location.href = './';
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function startHost(name) {
  myName = name;
  showScreen('screen-connecting');

  peer.addEventListener('ready', ({ detail: { peerId } }) => {
    const shareUrl = `${location.origin}${location.pathname}?room=${peerId}`;
    el('share-link').value = shareUrl;
    el('share-section').hidden = false;
    el('my-name-badge').textContent = `👑 ${name}`;
    el('my-name-badge').classList.add('host');
    showScreen('screen-game');
    renderAll();
  });

  peer.addEventListener('player-join', ({ detail }) => onHostPlayerJoin(detail));
  peer.addEventListener('player-leave', ({ detail }) => onHostPlayerLeave(detail));
  peer.addEventListener('message', ({ detail }) => onHostMessage(detail));
  peer.addEventListener('error', ({ detail: { err } }) => {
    console.error('[host error]', err);
  });

  await peer.startHost();
}

async function joinRoom(name, hostPeerId) {
  myName = name;
  showScreen('screen-connecting');

  peer.addEventListener('ready', () => {
    el('my-name-badge').textContent = name;
    showScreen('screen-game');
    peer.sendToHost({ type: MSG.JOIN, name });
  });

  peer.addEventListener('message', ({ detail }) => onClientMessage(detail));

  peer.addEventListener('host-reconnecting', () => {
    el('reconnect-banner').hidden = false;
  });

  peer.addEventListener('host-reconnected', () => {
    el('reconnect-banner').hidden = true;
    // Re-send JOIN in case host lost our state
    peer.sendToHost({ type: MSG.JOIN, name });
  });

  peer.addEventListener('player-leave', () => {
    el('reconnect-banner').textContent = '❌ L\'hôte s\'est déconnecté.';
    el('reconnect-banner').hidden = false;
  });

  peer.addEventListener('error', ({ detail: { err } }) => {
    console.error('[client error]', err);
    el('join-error').textContent = `Impossible de rejoindre : ${err.message || err}`;
    el('join-error').hidden = false;
    showScreen('screen-join');
  });

  await peer.joinHost(hostPeerId);
}

function init() {
  if (IS_HOST) {
    showScreen('screen-home');

    el('btn-create').addEventListener('click', () => showScreen('screen-create'));

    el('btn-start-host').addEventListener('click', () => {
      const name = el('create-name').value.trim();
      if (!name) { el('create-name').focus(); return; }
      startHost(name);
    });

    el('create-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') el('btn-start-host').click();
    });
  } else {
    showScreen('screen-join');

    el('btn-join').addEventListener('click', () => {
      const name = el('join-name').value.trim();
      if (!name) { el('join-name').focus(); return; }
      el('join-error').hidden = true;
      joinRoom(name, roomId);
    });

    el('join-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') el('btn-join').click();
    });
  }
}

init();
