/**
 * pwa.js — PWA : installation, plein écran, mise à jour forcée
 */

import { el, getCurrentScreen, showToast } from './ui.js';
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
    const req = document.documentElement.requestFullscreen
      || document.documentElement.webkitRequestFullscreen;
    if (req) req.call(document.documentElement).catch(() => {});
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

// ─── Mise à jour forcée ────────────────────────────────────────────────────────
export async function forceUpdate() {
  showToast('🔄 Mise à jour en cours…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (err) { console.warn('forceUpdate:', err); }
  sessionStorage.setItem('_flashguess_update', '1');
  location.reload();
}

// ─── Détection installation PWA ────────────────────────────────────────────────
function isPwaInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
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
const SW_POLL_INTERVAL = 60 * 60 * 1000; // 1 heure

export function initServiceWorker() {
  if ('serviceWorker' in navigator && sessionStorage.getItem('_flashguess_update')) {
    sessionStorage.removeItem('_flashguess_update');
    if (navigator.serviceWorker.controller) {
      location.reload();
    } else {
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        reg.update().catch(() => {});

        // Polling périodique pour détecter les nouvelles versions
        setInterval(() => reg.update().catch(() => {}), SW_POLL_INTERVAL);

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
