/**
 * pwa.js — PWA : installation, plein écran, mise à jour forcée
 */

import { el, getCurrentScreen, onScreenChange } from './ui.js';
import { GAMEPLAY_SCREENS } from './state.js';
import { getVersion } from './version.js';

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

function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent) && !isCapacitor();
}

// ─── Mise à jour APK (Capacitor) ───────────────────────────────────────────────
const APK_URL = 'https://github.com/niafrond/niafrond.github.io/releases/latest/download/flash-guess.apk';
const APK_VERSION_API = 'https://api.github.com/repos/niafrond/niafrond.github.io/releases/latest';
const APK_UPDATE_CHECK_KEY = 'fg_apk_update_check';

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
 * Vérifie si une nouvelle version APK est disponible (seulement dans le contexte Capacitor).
 * Affiche le bouton de mise à jour si c'est le cas.
 * Le résultat est mis en cache 24 h pour éviter les requêtes répétées.
 */
export async function checkApkUpdate() {
  if (!isCapacitor()) return;

  try {
    // Vérifier le cache (une fois par jour maximum)
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
 * puis déclenche l'installation une fois le téléchargement terminé.
 * Si le plugin n'est pas disponible, ouvre l'URL dans le navigateur.
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
      // Le plugin télécharge en arrière-plan et lance l'installeur Android
      // automatiquement à la fin → on peut laisser le bouton désactivé.
    } else {
      // Fallback navigateur
      window.open(APK_URL, '_blank');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Mettre à jour';
      }
    }
  } catch (_) {
    // Fallback en cas d'erreur du plugin
    window.open(APK_URL, '_blank');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Mettre à jour';
    }
  }
}


// On demande le vrai mode immersif dès que possible pour cacher les barres de
// navigation Android qui peuvent recouvrir des zones cliquables, que l'app soit
// installée en PWA, packagée via Capacitor ou ouverte dans le navigateur.
// Dans un WebView Capacitor (APK), requestFullscreen() est autorisé sans geste
// utilisateur préalable, ce qui permet un plein écran immédiat et permanent.
export function initAutoFullscreen() {
  // Dans le contexte APK (Capacitor), on masque le bouton toggle car le plein
  // écran est permanent — le bouton n'aurait aucun effet utile.
  if (isCapacitor()) {
    const btn = el('btn-fullscreen');
    if (btn) btn.hidden = true;
  }

  // Tentative immédiate : fonctionne sans geste dans un WebView Capacitor.
  // Dans un navigateur, l'appel sera bloqué silencieusement si aucun geste
  // n'a encore eu lieu ; le fallback pointerdown prend alors le relais.
  requestImmersive();

  // Fallback pour les navigateurs qui exigent un geste utilisateur préalable.
  document.addEventListener('pointerdown', requestImmersive, { once: true });

  // Si le fullscreen est quitté (p. ex. par un geste système ou la touche Retour
  // Android), on le rétablit aussitôt sans attendre le prochain geste.
  function onFullscreenChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      requestImmersive();
      // Second fallback gestuel pour les navigateurs qui refusent l'appel direct.
      document.addEventListener('pointerdown', requestImmersive, { once: true });
    }
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
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
let _reloadPending = false;

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
            if (!GAMEPLAY_SCREENS.has(getCurrentScreen())) {
              location.reload();
            } else {
              _reloadPending = true;
            }
          }, { once: true });
        }
      })
      .catch(() => {});

    // Recharge dès que l'utilisateur quitte le gameplay si une mise à jour était en attente
    onScreenChange(id => {
      if (_reloadPending && !GAMEPLAY_SCREENS.has(id)) location.reload();
    });
  }
}
