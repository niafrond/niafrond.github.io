/**
 * pwa.js — PWA : installation, plein écran, service worker
 */

import { el, getCurrentScreen, onScreenChange } from './ui.js';
import { GAMEPLAY_SCREENS } from './state.js';

let _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaInstallPrompt = e;
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.hidden = false;
});

window.addEventListener('appinstalled', () => {
  _pwaInstallPrompt = null;
  const btn = document.getElementById('btn-install-pwa');
  if (btn) btn.hidden = true;
});

export async function installPwa() {
  if (!_pwaInstallPrompt) return;
  _pwaInstallPrompt.prompt();
  const { outcome } = await _pwaInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    _pwaInstallPrompt = null;
    const btn = document.getElementById('btn-install-pwa');
    if (btn) btn.hidden = true;
  }
}

function requestImmersive() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const docEl = document.documentElement;
  if (docEl.requestFullscreen) {
    docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } else if (docEl.webkitRequestFullscreen) {
    docEl.webkitRequestFullscreen().catch(() => {});
  }
}

function lockLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

export function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    requestImmersive();
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document).catch(() => {});
  }
}

export function updateFullscreenBtn() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn  = el('btn-fullscreen');
  if (!btn) return;
  btn.textContent = isFs ? '⊡' : '⛶';
  btn.title       = isFs ? 'Quitter le plein écran' : 'Plein écran';
}

export function initAutoFullscreen() {
  if (isCapacitor()) {
    const btn = el('btn-fullscreen');
    if (btn) btn.hidden = true;
  }
  requestImmersive();
  lockLandscape();
  document.addEventListener('pointerdown', requestImmersive, { once: true });

  function onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      requestImmersive();
      document.addEventListener('pointerdown', requestImmersive, { once: true });
    }
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}

function isCapacitor() { return !!(window.Capacitor); }

let _reloadPending = false;

export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update().catch(() => {});
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!GAMEPLAY_SCREENS.has(getCurrentScreen())) {
            location.reload();
          } else {
            _reloadPending = true;
          }
        }, { once: true });
      }
    })
    .catch(() => {});

  onScreenChange(id => {
    if (_reloadPending && !GAMEPLAY_SCREENS.has(id)) location.reload();
  });
}
