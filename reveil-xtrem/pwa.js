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
