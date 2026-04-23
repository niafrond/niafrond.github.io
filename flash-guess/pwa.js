/**
 * pwa.js — PWA : installation, plein écran, mise à jour forcée
 */

import { el, getCurrentScreen } from './ui.js';
import { GAMEPLAY_SCREENS } from './state.js';

// ─── Installation PWA ──────────────────────────────────────────────────────────
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

// ─── Plein écran ───────────────────────────────────────────────────────────────
export function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen().catch(() => {});
    }
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document).catch(() => {});
  }
}

export function updateFullscreenBtn() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn  = el('btn-fullscreen');
  btn.textContent = isFs ? '⊡' : '⛶';
  btn.title       = isFs ? 'Quitter le plein écran' : 'Plein écran';
}

// ─── Détection installation PWA ────────────────────────────────────────────────
function isPwaInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

function isCapacitor() {
  return !!(window.Capacitor);
}

// ─── Plein écran automatique (PWA / APK) ───────────────────────────────────────
// En mode standalone, fullscreen PWA ou Capacitor, on demande le vrai mode
// immersif dès le premier geste utilisateur pour cacher barre d'état et de
// navigation sur Android.
export function initAutoFullscreen() {
  if (!isPwaInstalled() && !isCapacitor()) return;

  const requestImmersive = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen().catch(() => {});
    }
  };

  // Premier clic/tap déclenche le mode immersif
  document.addEventListener('pointerdown', requestImmersive, { once: true });

  // Si le fullscreen est quitté (p. ex. par un geste système), on le rétablit
  // au prochain geste utilisateur
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      document.addEventListener('pointerdown', requestImmersive, { once: true });
    }
  });
  document.addEventListener('webkitfullscreenchange', () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      document.addEventListener('pointerdown', requestImmersive, { once: true });
    }
  });
}

// ─── Notification système de mise à jour ───────────────────────────────────────
async function showUpdateNotification(reg) {
  if (GAMEPLAY_SCREENS.has(getCurrentScreen())) return;
  if (!isPwaInstalled()) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;

  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }

  const title = 'Flash Guess — Mise à jour';
  const options = {
    body: '🔄 Une nouvelle version est disponible.',
    icon: './icon-192.png',
    tag: 'fg-update',
    renotify: false,
  };

  try {
    await reg.showNotification(title, options);
  } catch (_) {
    try { new Notification(title, options); } catch (_) {}
  }
}

// ─── Service Worker ────────────────────────────────────────────────────────────
export function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none', type: 'module' })
      .then(reg => {
        reg.update().catch(() => {});

        // Notification système quand une mise à jour est prête (PWA installée)
        reg.addEventListener('updatefound', () => {
          if (!navigator.serviceWorker.controller) return; // première installation
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              showUpdateNotification(reg);
            }
          });
        });

        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!GAMEPLAY_SCREENS.has(getCurrentScreen())) location.reload();
          }, { once: true });
        }
      })
      .catch(() => {});
  }
}
