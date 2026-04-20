/**
 * pwa.js — PWA : installation, plein écran, mise à jour forcée
 */

import { el } from './ui.js';
import { showToast } from './ui.js';

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

// ─── Service Worker ────────────────────────────────────────────────────────────
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
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        }
      })
      .catch(() => {});
  }
}
