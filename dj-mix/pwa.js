/**
 * pwa.js — Installation PWA, service worker, plein écran
 */

// ─── Installation PWA ──────────────────────────────────────────────────────
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

// ─── Plein écran ───────────────────────────────────────────────────────────
function requestImmersive() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const docEl = document.documentElement;
  if (docEl.requestFullscreen) {
    docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } else if (docEl.webkitRequestFullscreen) {
    docEl.webkitRequestFullscreen().catch(() => {});
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

// ─── Service Worker ─────────────────────────────────────────────────────────
let _reloadPending = false;

export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update().catch(() => {});
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Recharger si on n'est pas en lecture active
          const isPlaying = document.querySelector('.deck-panel.active');
          if (!isPlaying) {
            location.reload();
          } else {
            _reloadPending = true;
          }
        }, { once: true });
      }
    })
    .catch(() => {});
}
