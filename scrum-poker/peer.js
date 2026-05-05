/**
 * peer.js — Couche réseau PeerJS (WebRTC DataChannel)
 *
 * Rôles :
 *  - HOST : crée un Peer, recueille les connexions entrantes, broadcast aux clients
 *  - CLIENT : se connecte au peer ID du host (lu depuis l'URL)
 *
 * Events émis sur l'objet retourné (EventTarget) :
 *  - 'ready'        : { detail: { peerId } } — peer prêt
 *  - 'message'      : { detail: { from, data } } — message reçu
 *  - 'player-join'  : { detail: { peerId } } — un client s'est connecté (host only)
 *  - 'player-leave' : { detail: { peerId } } — un client s'est déconnecté (host only)
 *  - 'error'        : { detail: { err } }
 */

import { MSG } from './constants.js';

const PEERJS_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';

const MAX_RECONNECT_ATTEMPTS = 150;
const MAX_INIT_ATTEMPTS = 10;
const INITIAL_CONNECT_TIMEOUT_MS = 4000; // time to wait for ICE/TURN before retrying
const INITIAL_CONNECT_RETRY_DELAY_MS = 1500;

// TURN servers allow WebRTC to work when direct P2P fails (e.g. behind a VPN).
// openrelayproject credentials are intentionally public (Open Relay Project free TURN service).
const TURN_USER = 'openrelayproject';
const TURN_CRED = 'openrelayproject';
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80',                  username: TURN_USER, credential: TURN_CRED },
    { urls: 'turn:openrelay.metered.ca:443',                 username: TURN_USER, credential: TURN_CRED },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp',   username: TURN_USER, credential: TURN_CRED },
  ],
  iceCandidatePoolSize: 2,
};

function loadPeerJS() {
  return new Promise((resolve, reject) => {
    if (window.Peer) { resolve(); return; }
    const s = document.createElement('script');
    s.src = PEERJS_CDN;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Impossible de charger PeerJS'));
    document.head.appendChild(s);
  });
}

export class ScrumPokerPeer extends EventTarget {
  constructor() {
    super();
    this._peer = null;
    this._connections = new Map(); // peerId → DataConnection (host only)
    this._hostConn = null;         // DataConnection vers le host (client only)
    this.isHost = false;
    this.peerId = null;
    this._reconnecting = false;
    this._reconnectAttempts = 0;
  }

  // ── Host ──────────────────────────────────────────────────────────────────

  async startHost() {
    await loadPeerJS();
    this.isHost = true;
    this._peer = new Peer(undefined, { config: ICE_CONFIG });

    this._peer.on('open', (id) => {
      this.peerId = id;
      this.dispatchEvent(new CustomEvent('ready', { detail: { peerId: id } }));
    });

    this._peer.on('connection', (conn) => {
      this._setupHostConnection(conn);
    });

    this._peer.on('error', (err) => {
      console.error('[PeerJS host]', err);
      this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
    });

    this._peer.on('disconnected', () => {
      if (!this._peer.destroyed) {
        console.warn('[PeerJS host] Déconnecté du serveur de signalisation, reconnexion…');
        setTimeout(() => { if (!this._peer.destroyed) this._peer.reconnect(); }, 1500);
      }
    });
  }

  _setupHostConnection(conn) {
    conn.on('open', () => {
      this._connections.set(conn.peer, conn);
      this.dispatchEvent(new CustomEvent('player-join', { detail: { peerId: conn.peer } }));
    });

    conn.on('data', (data) => {
      this.dispatchEvent(new CustomEvent('message', { detail: { from: conn.peer, data } }));
    });

    conn.on('close', () => {
      this._connections.delete(conn.peer);
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: conn.peer } }));
    });

    conn.on('error', (err) => {
      console.error('[PeerJS conn]', err);
      this._connections.delete(conn.peer);
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: conn.peer } }));
    });
  }

  broadcast(data) {
    for (const conn of this._connections.values()) {
      if (conn.open) conn.send(data);
    }
  }

  sendTo(peerId, data) {
    const conn = this._connections.get(peerId);
    if (conn && conn.open) conn.send(data);
  }

  kick(peerId) {
    this.sendTo(peerId, { type: MSG.KICKED });
    const conn = this._connections.get(peerId);
    if (conn) { conn.close(); this._connections.delete(peerId); }
  }

  get connectedPeerIds() {
    return [...this._connections.keys()];
  }

  // ── Client ────────────────────────────────────────────────────────────────

  async joinHost(hostPeerId) {
    await loadPeerJS();
    this.isHost = false;
    this._reconnecting = false;
    this._reconnectAttempts = 0;
    this._peer = new Peer(undefined, { config: ICE_CONFIG });

    this._peer.on('open', (id) => {
      this.peerId = id;
      this._tryInitialConnect(hostPeerId, 0);
    });

    this._peer.on('error', (err) => {
      console.error('[PeerJS client]', err);
      this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
    });
  }

  // Attempts to establish the first connection to the host, retrying on failure.
  // When all users are behind a VPN, direct P2P (STUN) often fails and TURN relay
  // negotiation can take longer than a single attempt allows.
  _tryInitialConnect(hostPeerId, attempt) {
    if (attempt >= MAX_INIT_ATTEMPTS) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: { err: new Error('Impossible de rejoindre la salle après plusieurs tentatives') },
      }));
      return;
    }

    const conn = this._peer.connect(hostPeerId, { reliable: true });
    let settled = false;

    const retry = () => {
      if (settled) return;
      settled = true;
      try { conn.close(); } catch { /* ignore */ }
      console.warn(`[PeerJS client init] tentative ${attempt + 1} échouée, nouvelle tentative…`);
      setTimeout(() => this._tryInitialConnect(hostPeerId, attempt + 1), INITIAL_CONNECT_RETRY_DELAY_MS);
    };

    conn.on('open', () => {
      if (settled) return;
      settled = true;
      this._hostConn = conn;
      this._attachClientConnHandlers(conn, hostPeerId);
      this.dispatchEvent(new CustomEvent('ready', { detail: { peerId: this.peerId } }));
    });

    conn.on('error', (err) => {
      console.warn(`[PeerJS client init attempt ${attempt + 1}]`, err);
      retry();
    });

    conn.on('close', () => retry());

    // Timeout: give ICE/TURN negotiation time to complete before retrying
    setTimeout(retry, INITIAL_CONNECT_TIMEOUT_MS);
  }

  _attachClientConnHandlers(conn, hostPeerId) {
    conn.on('data', (data) => {
      this.dispatchEvent(new CustomEvent('message', { detail: { from: hostPeerId, data } }));
    });
    conn.on('close', () => this._scheduleReconnect(hostPeerId));
    conn.on('error', () => this._scheduleReconnect(hostPeerId));
  }

  _scheduleReconnect(hostPeerId) {
    if (this._reconnecting) return;
    this._reconnecting = true;
    this._reconnectAttempts = 0;
    this.dispatchEvent(new CustomEvent('host-reconnecting'));
    setTimeout(() => this._tryReconnect(hostPeerId), 1500);
  }

  _tryReconnect(hostPeerId) {
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this._reconnecting = false;
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: hostPeerId } }));
      return;
    }
    this._reconnectAttempts++;

    const conn = this._peer.connect(hostPeerId, { reliable: true });
    let settled = false;

    const retry = () => {
      if (settled) return;
      settled = true;
      try { conn.close(); } catch { /* ignore */ }
      this._tryReconnect(hostPeerId);
    };

    conn.on('open', () => {
      if (settled) return;
      settled = true;
      this._hostConn = conn;
      this._reconnecting = false;
      this._attachClientConnHandlers(conn, hostPeerId);
      this.dispatchEvent(new CustomEvent('host-reconnected', { detail: { peerId: this.peerId } }));
    });

    conn.on('error', () => retry());

    setTimeout(retry, 2000);
  }

  sendToHost(data) {
    if (this._hostConn && this._hostConn.open) {
      this._hostConn.send(data);
    }
  }

  destroy() {
    if (this._peer) {
      this._peer.destroy();
      this._peer = null;
    }
    this._connections.clear();
    this._hostConn = null;
  }
}
