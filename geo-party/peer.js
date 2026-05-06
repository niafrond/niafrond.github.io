/**
 * peer.js — Couche réseau PeerJS pour Geo Party
 *
 * Contrairement à Taboo (1 client), ici le HOST peut accepter N clients.
 *
 * Events émis (EventTarget) :
 *  - 'ready'        : { detail: { peerId } }
 *  - 'message'      : { detail: { from, data } }
 *  - 'player-join'  : { detail: { peerId } }
 *  - 'player-leave' : { detail: { peerId } }
 *  - 'error'        : { detail: { err } }
 */

const PEERJS_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
const INITIAL_CONNECT_TIMEOUT_MS  = 5000;
const INITIAL_CONNECT_RETRY_DELAY = 1500;
const MAX_INIT_ATTEMPTS  = 10;
const MAX_RECONNECT_ATTEMPTS = 8;

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80',                username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
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

export class GeoPeer extends EventTarget {
  constructor() {
    super();
    this._peer = null;
    this._connections = new Map(); // peerId → DataConnection (HOST only)
    this._hostConn = null;         // DataConnection (CLIENT only)
    this.isHost = false;
    this.peerId = null;
    this._reconnecting = false;
    this._reconnectAttempts = 0;
  }

  // ── HOST ──────────────────────────────────────────────────────────────────

  async startHost() {
    await loadPeerJS();
    this.isHost = true;
    this._peer = new Peer(undefined, { config: ICE_CONFIG });

    this._peer.on('open', (peerId) => {
      this.peerId = peerId;
      this.dispatchEvent(new CustomEvent('ready', { detail: { peerId } }));
    });

    this._peer.on('connection', (conn) => {
      this._setupHostConn(conn);
    });

    this._peer.on('error', (err) => {
      console.error('[GeoPeer host]', err);
      this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
    });

    this._peer.on('disconnected', () => {
      if (!this._peer.destroyed) {
        setTimeout(() => { if (!this._peer.destroyed) this._peer.reconnect(); }, 1500);
      }
    });
  }

  _setupHostConn(conn) {
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
    conn.on('error', () => {
      this._connections.delete(conn.peer);
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: conn.peer } }));
    });
  }

  /** Envoie à tous les clients (HOST only). */
  broadcast(data) {
    for (const [, conn] of this._connections) {
      if (conn.open) conn.send(data);
    }
  }

  /** Envoie à un client spécifique (HOST only). */
  sendTo(peerId, data) {
    const conn = this._connections.get(peerId);
    if (conn?.open) conn.send(data);
  }

  get playerCount() {
    return this._connections.size;
  }

  // ── CLIENT ────────────────────────────────────────────────────────────────

  async joinHost(hostPeerId) {
    await loadPeerJS();
    this.isHost = false;
    this._peer = new Peer(undefined, { config: ICE_CONFIG });

    this._peer.on('open', (id) => {
      this.peerId = id;
      this._tryInitialConnect(hostPeerId, 0);
    });

    this._peer.on('error', (err) => {
      console.error('[GeoPeer client]', err);
      this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
    });
  }

  _tryInitialConnect(hostPeerId, attempt) {
    if (attempt >= MAX_INIT_ATTEMPTS) {
      this.dispatchEvent(new CustomEvent('error', {
        detail: { err: new Error('Impossible de rejoindre après plusieurs tentatives') },
      }));
      return;
    }

    const conn = this._peer.connect(hostPeerId, { reliable: true });
    let settled = false;

    const retry = () => {
      if (settled) return;
      settled = true;
      try { conn.close(); } catch { /* ignore */ }
      setTimeout(() => this._tryInitialConnect(hostPeerId, attempt + 1), INITIAL_CONNECT_RETRY_DELAY);
    };

    conn.on('open', () => {
      if (settled) return;
      settled = true;
      this._hostConn = conn;
      this._attachClientHandlers(conn, hostPeerId);
      this.dispatchEvent(new CustomEvent('ready', { detail: { peerId: this.peerId } }));
    });
    conn.on('error', (err) => { console.warn('[GeoPeer client init]', err); retry(); });
    conn.on('close', () => retry());
    setTimeout(retry, INITIAL_CONNECT_TIMEOUT_MS);
  }

  _attachClientHandlers(conn, hostPeerId) {
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
      setTimeout(() => this._tryReconnect(hostPeerId), 2000);
    };

    conn.on('open', () => {
      if (settled) return;
      settled = true;
      this._hostConn = conn;
      this._reconnecting = false;
      this._reconnectAttempts = 0;
      this._attachClientHandlers(conn, hostPeerId);
    });
    conn.on('error', () => retry());
    setTimeout(retry, 2000);
  }

  /** Envoie au host (CLIENT only). */
  sendToHost(data) {
    if (this._hostConn?.open) this._hostConn.send(data);
  }

  destroy() {
    if (this._peer) { this._peer.destroy(); this._peer = null; }
    this._connections.clear();
    this._hostConn = null;
  }
}
