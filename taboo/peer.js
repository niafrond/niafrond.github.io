/**
 * peer.js — Couche réseau PeerJS (WebRTC DataChannel) pour Taboo
 *
 * Conception simplifiée pour exactement 2 téléphones (1 HOST + 1 CLIENT).
 *
 * Events émis (EventTarget) :
 *  - 'ready'        : { detail: { peerId } } — peer prêt
 *  - 'message'      : { detail: { from, data } } — message reçu
 *  - 'player-join'  : { detail: { peerId } } — le client s'est connecté (host only)
 *  - 'player-leave' : { detail: { peerId } } — déconnexion
 *  - 'error'        : { detail: { err } }
 */

const PEERJS_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_CONNECT_TIMEOUT_MS = 4000; // time to wait for ICE/TURN before retrying
const INITIAL_CONNECT_RETRY_DELAY_MS = 1500;

// TURN servers allow WebRTC to work when direct P2P fails (e.g. same LAN, behind NAT/VPN).
// openrelayproject credentials are intentionally public (Open Relay Project free TURN service).
const TURN_USER = 'openrelayproject';
const TURN_CRED = 'openrelayproject';
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:openrelay.metered.ca:80',                username: TURN_USER, credential: TURN_CRED },
    { urls: 'turn:openrelay.metered.ca:443',               username: TURN_USER, credential: TURN_CRED },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: TURN_USER, credential: TURN_CRED },
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

export class TabooPeer extends EventTarget {
  constructor() {
    super();
    this._peer = null;
    this._clientConn = null;  // Host: connexion vers l'unique client
    this._hostConn = null;    // Client: connexion vers le host
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

    this._peer.on('open', (peerId) => {
      this.peerId = peerId;
      this.dispatchEvent(new CustomEvent('ready', { detail: { peerId } }));
    });

    this._peer.on('connection', (conn) => {
      // N'accepter qu'une seule connexion (1 client max)
      if (this._clientConn && this._clientConn.open) {
        conn.close();
        return;
      }
      this._setupHostConn(conn);
    });

    this._peer.on('error', (err) => {
      console.error('[TabooPeer host]', err);
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
      this._clientConn = conn;
      this.dispatchEvent(new CustomEvent('player-join', { detail: { peerId: conn.peer } }));
    });
    conn.on('data', (data) => {
      this.dispatchEvent(new CustomEvent('message', { detail: { from: conn.peer, data } }));
    });
    conn.on('close', () => {
      this._clientConn = null;
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: conn.peer } }));
    });
    conn.on('error', () => {
      this._clientConn = null;
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: conn.peer } }));
    });
  }

  /** Envoie un message au client connecté (host only) */
  broadcast(data) {
    if (this._clientConn && this._clientConn.open) {
      this._clientConn.send(data);
    }
  }

  // ── Client ────────────────────────────────────────────────────────────────

  async joinHost(hostPeerId) {
    await loadPeerJS();
    this.isHost = false;
    this._peer = new Peer(undefined, { config: ICE_CONFIG });

    this._peer.on('open', (id) => {
      this.peerId = id;
      this._tryInitialConnect(hostPeerId, 0);
    });

    this._peer.on('error', (err) => {
      console.error('[TabooPeer client]', err);
      this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
    });
  }

  // Retries the initial connection up to 10 times with a 4-second ICE/TURN timeout.
  // On the same LAN or behind symmetric NAT, direct candidates fail quickly and
  // TURN relay candidates take longer — retrying gives TURN time to allocate.
  _tryInitialConnect(hostPeerId, attempt) {
    const MAX_INIT_ATTEMPTS = 10;
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
      console.warn(`[TabooPeer client init] tentative ${attempt + 1} échouée, nouvelle tentative…`);
      setTimeout(() => this._tryInitialConnect(hostPeerId, attempt + 1), INITIAL_CONNECT_RETRY_DELAY_MS);
    };

    conn.on('open', () => {
      if (settled) return;
      settled = true;
      this._hostConn = conn;
      this._attachClientHandlers(conn, hostPeerId);
      this.dispatchEvent(new CustomEvent('ready', { detail: { peerId: this.peerId } }));
    });

    conn.on('error', (err) => {
      console.warn(`[TabooPeer client init tentative ${attempt + 1}]`, err);
      retry();
    });

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
      this._tryReconnect(hostPeerId);
    };

    conn.on('open', () => {
      if (settled) return;
      settled = true;
      this._hostConn = conn;
      this._reconnecting = false;
      this._attachClientHandlers(conn, hostPeerId);
    });
    conn.on('error', () => retry());
    setTimeout(retry, 2000);
  }

  /** Envoie un message au host (client only) */
  sendToHost(data) {
    if (this._hostConn && this._hostConn.open) {
      this._hostConn.send(data);
    }
  }

  destroy() {
    if (this._peer) { this._peer.destroy(); this._peer = null; }
    this._clientConn = null;
    this._hostConn = null;
  }
}
