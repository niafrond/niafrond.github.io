/**
 * pwa.js — PWA : installation, plein écran, mise à jour forcée
 */

import { getVersion } from '../version.js';

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

// ─── Lien téléchargement APK Android ──────────────────────────────────────────
export function initApkDownloadLink() {
  if (!isAndroidBrowser()) return;
  const link = document.getElementById('btn-download-apk');
  if (link) link.hidden = false;
}

// ─── Plein écran ───────────────────────────────────────────────────────────────
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

export function updateFullscreenBtn() {
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  const btn  = document.getElementById('btn-fullscreen');
  if (!btn) return;
  btn.textContent = isFs ? '⊡' : '⛶';
  btn.title       = isFs ? 'Quitter le plein écran' : 'Plein écran';
}

// ─── Détection installation PWA ────────────────────────────────────────────────
function isCapacitor() {
  return !!(window.Capacitor);
}

function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent) && !isCapacitor();
}

// ─── Mise à jour APK (Capacitor) ───────────────────────────────────────────────
const APK_URL = 'https://github.com/niafrond/niafrond.github.io/releases/latest/download/pyramide.apk';
const APK_VERSION_API = 'https://api.github.com/repos/niafrond/niafrond.github.io/releases/latest';
const APK_UPDATE_CHECK_KEY = 'pyramide_apk_update_check';

function _parseVersionParts(str) {
  const m = String(str).replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
}

function _isNewerVersion(latest, current) {
  const [lMaj, lMin, lPat] = _parseVersionParts(latest);
  const [cMaj, cMin, cPat] = _parseVersionParts(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

/**
 * Vérifie si une nouvelle version APK est disponible (contexte Capacitor uniquement).
 * Affiche le bouton de mise à jour si c'est le cas.
 * Le résultat est mis en cache 24 h.
 */
export async function checkApkUpdate() {
  if (!isCapacitor()) return;

  try {
    const cached = localStorage.getItem(APK_UPDATE_CHECK_KEY);
    if (cached) {
      const { latestTag, checked } = JSON.parse(cached);
      if (Date.now() - checked < 24 * 60 * 60 * 1000) {
        if (latestTag && _isNewerVersion(latestTag, getVersion())) _showApkUpdateBtn(latestTag);
        return;
      }
    }

    const res = await fetch(APK_VERSION_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!res.ok) return;
    const { tag_name: latestTag } = await res.json();

    localStorage.setItem(APK_UPDATE_CHECK_KEY, JSON.stringify({ latestTag, checked: Date.now() }));

    if (_isNewerVersion(latestTag, getVersion())) _showApkUpdateBtn(latestTag);
  } catch (_) {
    // Silencieux — la vérification de mise à jour est optionnelle
  }
}

function _showApkUpdateBtn(latestVersion) {
  const btn = document.getElementById('btn-apk-update');
  if (!btn) return;
  btn.dataset.version = latestVersion;
  btn.hidden = false;
}

/**
 * Lance le téléchargement en arrière-plan via le plugin natif Capacitor,
 * puis déclenche l'installation. Fallback : ouvre l'URL dans le navigateur.
 */
export async function doApkUpdate() {
  const btn = document.getElementById('btn-apk-update');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Téléchargement…';
  }

  try {
    const plugin = window.Capacitor?.Plugins?.ApkUpdater;
    if (plugin) {
      await plugin.downloadAndInstall({ url: APK_URL });
    } else {
      window.open(APK_URL, '_blank');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Mettre à jour';
      }
    }
  } catch (_) {
    window.open(APK_URL, '_blank');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Mettre à jour';
    }
  }
}

// ─── Plein écran automatique ───────────────────────────────────────────────────
// On demande le mode immersif dès que possible pour cacher les barres de navigation
// Android. Dans un WebView Capacitor, requestFullscreen() est autorisé sans geste.
export function initAutoFullscreen() {
  // Dans le contexte APK (Capacitor), on masque le bouton toggle car le plein
  // écran est permanent.
  if (isCapacitor()) {
    const btn = document.getElementById('btn-fullscreen');
    if (btn) btn.hidden = true;
  }

  requestImmersive();
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

// ─── Service Worker ────────────────────────────────────────────────────────────
let _reloadPending = false;

/**
 * Enregistre le service worker et met en place la mise à jour différée :
 * si une mise à jour arrive pendant le gameplay, elle est reportée à la fin du tour.
 *
 * @param {() => string}  getCurrentScreenFn - renvoie l'ID de l'écran courant
 * @param {Set<string>}   gameplayScreens    - écrans considérés comme "en jeu"
 */
export function initServiceWorker(getCurrentScreenFn, gameplayScreens) {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update().catch(() => {});

      reg.addEventListener('updatefound', () => {
        if (!navigator.serviceWorker.controller) return; // première installation
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            _tryShowUpdateNotification(reg);
          }
        });
      });

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!gameplayScreens.has(getCurrentScreenFn())) {
            location.reload();
          } else {
            _reloadPending = true;
          }
        }, { once: true });
      }
    })
    .catch(() => {});
}

/**
 * À appeler à chaque changement d'écran : recharge la page si une mise à jour
 * était en attente et que le joueur vient de quitter le gameplay.
 */
export function checkPendingReload(currentScreen, gameplayScreens) {
  if (_reloadPending && !gameplayScreens.has(currentScreen)) location.reload();
}

async function _tryShowUpdateNotification(reg) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;

  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
  }

  const title = 'Pyramide — Mise à jour';
  const options = {
    body: '🔄 Une nouvelle version est disponible.',
    icon: './icon.svg',
    tag: 'pyramide-update',
    renotify: false,
  };

  try {
    await reg.showNotification(title, options);
  } catch (_) {
    try { new Notification(title, options); } catch (_) {}
  }
}
