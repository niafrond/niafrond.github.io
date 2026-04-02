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

// Charge PeerJS depuis CDN si pas déjà présent
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

export class BlindTestPeer extends EventTarget {
  constructor() {
    super();
    this._peer = null;
    this._connections = new Map(); // peerId → DataConnection (host only)
    this._hostConn = null;         // DataConnection vers le host (client only)
    this.isHost = false;
    this.peerId = null;
    this._isTemporaryHost = false;
  }

  // ── Host ──────────────────────────────────────────────────────────────────

  async startHost(id = undefined) {
    await loadPeerJS();
    this.isHost = true;
    this._peer = id ? new Peer(id) : new Peer();

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

    // Reconnexion automatique au serveur de signalisation si la connexion est perdue
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

  /** Envoie un message à tous les clients connectés */
  broadcast(data) {
    for (const conn of this._connections.values()) {
      if (conn.open) conn.send(data);
    }
  }

  /** Envoie un message à un client spécifique */
  sendTo(peerId, data) {
    const conn = this._connections.get(peerId);
    if (conn && conn.open) conn.send(data);
  }

  /** Déconnecte un client (kick) */
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
    this._peer = new Peer();

    this._peer.on('open', (id) => {
      this.peerId = id;
      const conn = this._peer.connect(hostPeerId, { reliable: true });
      this._hostConn = conn;

      conn.on('open', () => {
        this._attachClientConnHandlers(conn, hostPeerId);
        this.dispatchEvent(new CustomEvent('ready', { detail: { peerId: id } }));
      });

      // Erreur avant que la connexion soit ouverte
      conn.on('error', (err) => {
        console.error('[PeerJS client conn init]', err);
        this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
      });
    });

    this._peer.on('error', (err) => {
      console.error('[PeerJS client]', err);
      this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
    });
  }

  /** Attache les gestionnaires data/close/error à une connexion client active */
  _attachClientConnHandlers(conn, hostPeerId) {
    conn.on('data', (data) => {
      this.dispatchEvent(new CustomEvent('message', { detail: { from: hostPeerId, data } }));
    });
    conn.on('close', () => this._scheduleReconnect(hostPeerId));
    conn.on('error', () => this._scheduleReconnect(hostPeerId));
  }

  /** Démarre la boucle de reconnexion vers l'hôte */
  _scheduleReconnect(hostPeerId) {
    if (this._reconnecting) return;
    this._reconnecting = true;
    this._reconnectAttempts = 0;
    this.dispatchEvent(new CustomEvent('host-reconnecting'));
    setTimeout(() => this._tryReconnect(hostPeerId), 1500);
  }

  /** Tentative unique de reconnexion, puis retraite toutes les 2 secondes */
  _tryReconnect(hostPeerId) {
    if (this._reconnectAttempts >= 150) { // ~5 minutes max
      this._reconnecting = false;
      this.dispatchEvent(new CustomEvent('player-leave', { detail: { peerId: hostPeerId } }));
      return;
    }
    // Après 3 tentatives, signaler qu'un relay peut être nécessaire
    if (this._reconnectAttempts === 3) {
      this.dispatchEvent(new CustomEvent('relay-needed'));
    }
    this._reconnectAttempts++;

    const conn = this._peer.connect(hostPeerId, { reliable: true });
    let connected = false;

    conn.on('open', () => {
      connected = true;
      this._hostConn = conn;
      this._reconnecting = false;
      this._attachClientConnHandlers(conn, hostPeerId);
      this.dispatchEvent(new CustomEvent('host-reconnected', { detail: { peerId: this.peerId } }));
    });

    setTimeout(() => {
      if (!connected) {
        try { conn.close(); } catch { /* ignore */ }
        this._tryReconnect(hostPeerId);
      }
    }, 2000);
  }

  /** Envoie un message au host (mode client) */
  sendToHost(data) {
    if (this._hostConn && this._hostConn.open) {
      this._hostConn.send(data);
    }
  }

  // ── Relay (hôte temporaire côté client) ─────────────────────────────────

  /** Le client commence à accepter les connexions entrantes (devient relay) */
  becomeTemporaryHost() {
    if (this._isTemporaryHost) return;
    this._isTemporaryHost = true;
    this._peer.on('connection', (conn) => {
      if (!this._isTemporaryHost) return;
      this._setupHostConnection(conn);
    });
  }

  /** Arrête le mode relay */
  relinquishTemporaryHost() {
    this._isTemporaryHost = false;
  }

  /**
   * Se connecte à un hôte (relay ou hôte original) en réutilisant le Peer existant.
   * Déclenche 'host-reconnected' à l'ouverture.
   */
  connectToHost(newHostPeerId) {
    this._reconnecting = false;
    if (this._hostConn) {
      try { this._hostConn.close(); } catch { /* ignore */ }
      this._hostConn = null;
    }
    const conn = this._peer.connect(newHostPeerId, { reliable: true });
    this._hostConn = conn;
    let opened = false;
    conn.on('open', () => {
      opened = true;
      this._attachClientConnHandlers(conn, newHostPeerId);
      this.dispatchEvent(new CustomEvent('host-reconnected', { detail: { peerId: this.peerId } }));
    });
    conn.on('error', () => {
      if (!opened) setTimeout(() => this.connectToHost(newHostPeerId), 3000);
    });
  }

  /** Ouvre une connexion brute (pour le watcher relay → hôte original) */
  connectRaw(toPeerId) {
    return this._peer?.connect(toPeerId, { reliable: true }) ?? null;
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
