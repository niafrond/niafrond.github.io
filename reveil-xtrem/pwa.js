// Installation PWA + enregistrement du service worker (adapté de game-template/pwa.js).

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
// Visible uniquement depuis un navigateur Android (pas iOS/desktop, où
// l'APK est inutile) et seulement sur la version web — inutile de proposer
// de télécharger l'APK depuis l'intérieur de l'APK lui-même.
function isCapacitor() {
  return !!(window.Capacitor);
}

function isAndroidBrowser() {
  return /Android/i.test(navigator.userAgent) && !isCapacitor();
}

export function initApkDownloadLink() {
  if (!isAndroidBrowser()) return;
  const link = document.getElementById('btn-download-apk');
  if (link) link.hidden = false;
}

// ─── Plein écran + focus forcés à la sonnerie ──────────────────────────────
// Une alarme doit être impossible à rater : plein écran (masque barre
// d'adresse/barres système) et tentative de reprendre le focus si l'onglet
// tournait en arrière-plan au moment du déclenchement.

export function requestRingFullscreen() {
  const docEl = document.documentElement;
  const request = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
  if (!request) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;

  const tryRequest = () => request.call(docEl).catch(() => {});
  tryRequest();
  // Certains navigateurs refusent sans geste utilisateur récent : on réessaie
  // au premier tap si le premier essai silencieux a échoué.
  document.addEventListener('pointerdown', function retry() {
    document.removeEventListener('pointerdown', retry);
    if (!document.fullscreenElement && !document.webkitFullscreenElement) tryRequest();
  }, { once: true });
}

export function exitRingFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit) exit.call(document).catch(() => {});
}

// Best-effort pour ramener l'onglet au premier plan si l'app tournait en
// arrière-plan quand l'alarme a sonné : une notification cliquable, sur
// laquelle les navigateurs redonnent le focus à l'onglet d'origine au clic.
export function notifyRingIfHidden(title, body) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState !== 'hidden') return;
  try {
    const n = new Notification(title, { body, tag: 'reveil-xtrem-ring', requireInteraction: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    // Notification peut échouer selon la plateforme (ex. iOS Safari) — sans impact.
  }
}

// N'applique pas le rechargement auto tant qu'une alarme sonne (écran de
// sonnerie visible) : un rechargement à ce moment couperait la sonnerie.
export function initServiceWorker(isRingingFn) {
  if (!('serviceWorker' in navigator)) return;
  let reloadPending = false;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update().catch(() => {});
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!isRingingFn || !isRingingFn()) {
            location.reload();
          } else {
            reloadPending = true;
          }
        }, { once: true });
      }
    })
    .catch(() => {});

  setInterval(() => {
    if (reloadPending && (!isRingingFn || !isRingingFn())) location.reload();
  }, 2000);
}
