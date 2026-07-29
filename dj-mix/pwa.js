/**
 * pwa.js — Installation PWA, service worker, plein écran, mise à jour APK
 */

import { getVersion } from './version.js';
import { isMobileDevice } from './lib/ramProfile.js';

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

// ─── Lien téléchargement APK Android ────────────────────────────────────────
export function initApkDownloadLink() {
  if (!isAndroidBrowser()) return;
  const link = document.getElementById('btn-download-apk');
  if (link) link.hidden = false;
}

// ─── Plein écran ─────────────────────────────────────────────────────────────
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

// On demande le vrai mode immersif dès que possible pour cacher les barres de
// navigation Android qui peuvent recouvrir des zones cliquables, que l'app soit
// installée en PWA, packagée via Capacitor ou ouverte dans le navigateur.
// Dans un WebView Capacitor (APK), requestFullscreen() est autorisé sans geste
// utilisateur préalable, ce qui permet un plein écran immédiat et permanent.
export function initAutoFullscreen() {
  // Sur un navigateur desktop, on laisse l'utilisateur passer en plein écran
  // manuellement (bouton dédié) plutôt que de forcer le mode immersif.
  if (!isCapacitor() && !isMobileDevice()) return;

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

// ─── Détection plateforme ────────────────────────────────────────────────────
function isCapacitor() {
  return !!(window.Capacitor);
}

function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent) && !isCapacitor();
}

// ─── Mise à jour APK (Capacitor) ─────────────────────────────────────────────
const APK_URL = 'https://github.com/niafrond/niafrond.github.io/releases/latest/download/dj-mix.apk';
const APK_VERSION_API = 'https://api.github.com/repos/niafrond/niafrond.github.io/releases/latest';
const APK_UPDATE_CHECK_KEY = 'djmix_apk_update_check';

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

// ─── Service Worker ─────────────────────────────────────────────────────────
let _reloadPending = false;

// SPEC-13.1.4 — les morceaux téléchargés (audio + artwork) sont persistés en
// IndexedDB (`dj-mix-blobs`, lib/blobStore.js), pas dans le Cache Storage du
// Service Worker : IndexedDB n'a pas besoin de contexte sécurisé (fonctionne
// en HTTP simple sur IP LAN, contrairement à `window.caches`) et n'est de
// toute façon jamais touché ici (`caches.delete()` ci-dessous ne peut pas
// l'affecter). `AUDIO_CACHE_NAME` ne désigne plus que l'ancien bucket Cache
// Storage (`dj-mix:audio-cache:v1`) — conservé uniquement en nettoyage de
// compatibilité pour les rares utilisateurs HTTPS ayant d'anciennes entrées ;
// vide, l'y toucher ou non n'a aucune conséquence.
const AUDIO_CACHE_NAME = 'dj-mix:audio-cache:v1';

/**
 * Force la mise à jour de la PWA : désinscrit tous les service workers et
 * vide les caches d'assets applicatifs (SW), puis recharge la page. Utile
 * quand `updateViaCache: 'none'` et l'écoute normale de `controllerchange`
 * ne suffisent pas à faire remonter du code manifestement périmé (SW bloqué
 * en `waiting`, cache navigateur tiers, etc.).
 *
 * N'affecte jamais les morceaux téléchargés (IndexedDB, voir plus haut) — rien
 * à préserver explicitement ici pour ça. L'ancien bucket Cache Storage
 * `dj-mix:audio-cache:v1` (legacy) est quand même épargné par précaution.
 */
export async function forceUpdatePwa() {
  const btn = document.getElementById('btn-force-update');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Mise à jour…';
  }

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      // Preserve the legacy audio cache bucket, just in case.
      await Promise.all(keys.filter(k => k !== AUDIO_CACHE_NAME).map(k => caches.delete(k)));
    }
  } catch (_) {
    // Silencieux — on recharge de toute façon
  } finally {
    location.reload();
  }
}

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
