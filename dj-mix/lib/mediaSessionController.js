import { uiState } from './uiState.js';

/**
 * Gère Wake Lock, keepalive audio silencieux, Media Session et commandes
 * de transport (lecture, pause, suivant, seek, Android Auto).
 *
 * @param {object} options
 * @param {() => import('../player.js').DJPlayer|null} options.getPlayer
 * @param {() => 'A'|'B'} options.getFocusDeck
 * @param {() => number} options.getPlaybackPositionMs
 * @param {() => number} options.getPlaybackDurationMs
 * @param {() => any[]} options.getQueue
 * @param {HTMLElement|null} options.deckALaunchBtn
 * @param {HTMLElement|null} options.deckBLaunchBtn
 * @param {HTMLElement|null} options.autoMixBtn
 * @param {(cb: (cmd: object) => void) => void} options.onMediaCommand
 * @param {(idx: number, mode: string) => void} options.startPlaybackForIndex
 */
export function createMediaSessionController(options) {
  const {
    getPlayer,
    getFocusDeck,
    getPlaybackPositionMs,
    getPlaybackDurationMs,
    getQueue,
    deckALaunchBtn,
    deckBLaunchBtn,
    autoMixBtn,
    onMediaCommand,
    startPlaybackForIndex,
  } = options;

  let wakeLock = null;
  let _keepaliveAudio = null;
  let _keepalivePosInterval = null;
  let lastAudioOutputDeviceCount = null;

  // SPEC-13.3.6 — Compte les sorties audio (`kind === 'audiooutput'`) pour détecter
  // une vraie perte de sortie (débranchement) plutôt que réagir à tout `devicechange`
  // (qui se déclenche aussi sur un ajout de périphérique ou un bruit d'énumération).
  async function countAudioOutputDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audiooutput').length;
    } catch {
      return null;
    }
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  function _createSilentWavUrl() {
    const sampleRate = 8000;
    const numSamples = sampleRate;
    const buf = new ArrayBuffer(44 + numSamples);
    const v = new DataView(buf);
    const w = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + numSamples, true);
    w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, numSamples, true);
    new Uint8Array(buf, 44).fill(128);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  function startMediaKeepAlive() {
    if (_keepaliveAudio && !_keepaliveAudio.paused) return;
    if (!('mediaSession' in navigator)) return;
    if (!_keepaliveAudio) {
      _keepaliveAudio = new Audio(_createSilentWavUrl());
      _keepaliveAudio.loop = true;
      _keepaliveAudio.volume = 0.001;
    }
    _keepaliveAudio.play().catch(() => {});
    if (!_keepalivePosInterval) {
      _keepalivePosInterval = setInterval(() => updateMediaSessionPositionState(), 30_000);
    }
  }

  function stopMediaKeepAlive() {
    clearInterval(_keepalivePosInterval);
    _keepalivePosInterval = null;
    _keepaliveAudio?.pause();
  }

  function applyMediaCommand(cmd) {
    const player = getPlayer();
    switch (cmd?.action) {
      case 'play': {
        const focusDeck = getFocusDeck();
        const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
        if (deckState?.playing) break;
        if (deckState?.hasSrc) {
          player?.resumeDeck?.(focusDeck).catch(() => {});
        } else {
          if (focusDeck === 'A') deckALaunchBtn?.click();
          else deckBLaunchBtn?.click();
        }
        break;
      }
      case 'pause': {
        const focusDeck = getFocusDeck();
        const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
        if (deckState?.playing) player?.pauseDeck?.(focusDeck);
        break;
      }
      case 'next':
        autoMixBtn?.click();
        break;
      case 'seekTo':
        player?.seekTo?.(Math.max(0, Number(cmd.positionMs) || 0), { fadeMs: 0 });
        break;
      case 'playFromMediaId': {
        const queue = getQueue();
        const idx = queue.findIndex((item) => item.id === cmd.mediaId);
        if (idx >= 0) startPlaybackForIndex(idx, 'play');
        break;
      }
    }
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => {
      const focusDeck = getFocusDeck();
      const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
      if (deckState?.playing) return;
      if (deckState?.hasSrc) {
        getPlayer()?.resumeDeck?.(focusDeck).catch(() => {});
      } else {
        if (focusDeck === 'A') deckALaunchBtn?.click();
        else deckBLaunchBtn?.click();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      const focusDeck = getFocusDeck();
      const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
      if (deckState?.playing) getPlayer()?.pauseDeck?.(focusDeck);
    });
    navigator.mediaSession.setActionHandler('stop', () => {
      getPlayer()?.pause?.();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (event) => {
      const offset = Number(event?.seekOffset) || 10;
      const position = Math.max(0, (getPlaybackPositionMs() || 0) - (offset * 1000));
      getPlayer()?.seekTo?.(position, { fadeMs: 0 });
    });
    navigator.mediaSession.setActionHandler('seekforward', (event) => {
      const offset = Number(event?.seekOffset) || 10;
      const position = Math.max(0, (getPlaybackPositionMs() || 0) + (offset * 1000));
      getPlayer()?.seekTo?.(position, { fadeMs: 0 });
    });
    navigator.mediaSession.setActionHandler('seekto', (event) => {
      if (event?.fastSeek === false && !Number.isFinite(event?.seekTime)) return;
      const position = Math.max(0, Number(event?.seekTime || 0) * 1000);
      getPlayer()?.seekTo?.(position, { fadeMs: 0 });
    });
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', () => autoMixBtn?.click());

    onMediaCommand(applyMediaCommand);

    startMediaKeepAlive();

    // SPEC-13.3.6 — Pause automatique uniquement si une sortie audio a réellement
    // disparu (ex. déconnexion casque Bluetooth) ; un `devicechange` qui n'enlève
    // aucune sortie (ajout d'un périphérique, bruit d'énumération) est ignoré.
    if (navigator.mediaDevices) {
      countAudioOutputDevices().then((count) => { lastAudioOutputDeviceCount = count; });
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const previousCount = lastAudioOutputDeviceCount;
        const count = await countAudioOutputDevices();
        lastAudioOutputDeviceCount = count;
        if (previousCount === null || count === null || count >= previousCount) return;
        const focusDeck = getFocusDeck();
        const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];
        if (deckState?.playing) getPlayer()?.pauseDeck?.(focusDeck);
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !uiState.isPlaying) {
        startMediaKeepAlive();
      }
    });

    document.addEventListener('keydown', (e) => {
      const key = e.key;
      if (!key?.startsWith('Media')) return;

      e.preventDefault();
      e.stopPropagation();

      const focusDeck = getFocusDeck();
      const deckState = uiState.lastDeckState?.[focusDeck === 'A' ? 'deckA' : 'deckB'];

      switch (key) {
        case 'MediaPlayPause':
          if (deckState?.playing) {
            getPlayer()?.pauseDeck?.(focusDeck);
          } else if (deckState?.hasSrc) {
            getPlayer()?.resumeDeck?.(focusDeck).catch(() => {});
          } else {
            if (focusDeck === 'A') deckALaunchBtn?.click();
            else deckBLaunchBtn?.click();
          }
          break;
        case 'MediaPlay':
          if (!deckState?.playing) {
            if (deckState?.hasSrc) getPlayer()?.resumeDeck?.(focusDeck).catch(() => {});
            else {
              if (focusDeck === 'A') deckALaunchBtn?.click();
              else deckBLaunchBtn?.click();
            }
          }
          break;
        case 'MediaPause':
          if (deckState?.playing) getPlayer()?.pauseDeck?.(focusDeck);
          break;
        case 'MediaStop':
          getPlayer()?.pause?.();
          break;
        case 'MediaTrackNext':
          autoMixBtn?.click();
          break;
      }
    });
  }

  function updateMediaSessionPositionState(positionMs, durationMs) {
    const safePos = positionMs ?? getPlaybackPositionMs();
    const safeDur = durationMs ?? getPlaybackDurationMs();
    if (!('mediaSession' in navigator)) return;
    const dur = Number(safeDur);
    const pos = Number(safePos);
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(pos)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, dur / 1000),
        position: Math.max(0, Math.min(dur, pos)) / 1000,
        playbackRate: 1,
      });
    } catch {
      // Unsupported in some browser/Android combinations.
    }
  }

  return {
    requestWakeLock,
    releaseWakeLock,
    startMediaKeepAlive,
    stopMediaKeepAlive,
    setupMediaSession,
    updateMediaSessionPositionState,
  };
}
