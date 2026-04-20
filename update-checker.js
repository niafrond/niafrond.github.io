/**
 * update-checker.js — Vérification automatique des mises à jour
 *
 * Interroge match3-quest/version.js une fois par heure (et à la demande).
 * Affiche un bandeau discret si une version plus récente est disponible.
 *
 * Usage :
 *   import { initUpdateChecker } from '../update-checker.js';
 *   const { checkNow } = initUpdateChecker(getMatch3BuildDate(), document.getElementById('version-badge'));
 */

const VERSION_URL = `${location.origin}/match3-quest/version.js`;
const CHECK_INTERVAL = 60 * 60 * 1000; // 1 heure

// ─── Bandeau de mise à jour ───────────────────────────────────────────────────

function createUpdateBanner() {
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  Object.assign(banner.style, {
    position:       'fixed',
    bottom:         '52px',
    left:           '50%',
    transform:      'translateX(-50%)',
    zIndex:         '9100',
    display:        'none',
    alignItems:     'center',
    gap:            '10px',
    padding:        '7px 14px',
    borderRadius:   '999px',
    background:     'rgba(15, 23, 42, 0.92)',
    border:         '1px solid rgba(124, 58, 237, 0.55)',
    color:          '#e2e8f0',
    fontSize:       '0.82rem',
    lineHeight:     '1.2',
    backdropFilter: 'blur(10px)',
    boxShadow:      '0 4px 18px rgba(0, 0, 0, 0.45)',
    whiteSpace:     'nowrap',
    userSelect:     'none',
  });

  const text = document.createElement('span');
  text.textContent = '🔄 Mise à jour disponible';

  const reloadBtn = document.createElement('button');
  reloadBtn.textContent = 'Recharger';
  reloadBtn.setAttribute('aria-label', 'Recharger la page pour appliquer la mise à jour');
  Object.assign(reloadBtn.style, {
    background:   'rgba(124, 58, 237, 0.85)',
    color:        '#fff',
    border:       'none',
    borderRadius: '999px',
    padding:      '4px 12px',
    fontSize:     '0.78rem',
    fontWeight:   '600',
    cursor:       'pointer',
    lineHeight:   '1.4',
  });
  reloadBtn.addEventListener('click', () => location.reload());

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = '✕';
  dismissBtn.setAttribute('aria-label', 'Ignorer la mise à jour');
  Object.assign(dismissBtn.style, {
    background:  'transparent',
    color:       'rgba(226, 232, 240, 0.65)',
    border:      'none',
    padding:     '2px 5px',
    cursor:      'pointer',
    fontSize:    '0.78rem',
    lineHeight:  '1',
  });
  dismissBtn.addEventListener('click', () => { banner.style.display = 'none'; });

  banner.append(text, reloadBtn, dismissBtn);
  document.body.appendChild(banner);
  return banner;
}

// ─── Point d'entrée ───────────────────────────────────────────────────────────

/**
 * @param {string} currentBuildDate  — buildDate de la version actuellement chargée
 * @param {HTMLElement|null} versionEl — élément cliquable pour forcer la vérification (optionnel)
 * @returns {{ checkNow: () => Promise<void> }}
 */
export function initUpdateChecker(currentBuildDate, versionEl = null) {
  let banner = null;
  let updateDetected = false;

  function showBanner() {
    if (!banner) banner = createUpdateBanner();
    banner.style.display = 'flex';
  }

  async function check() {
    try {
      const res = await fetch(`${VERSION_URL}?_cb=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      const m = text.match(/buildDate:\s*'([^']+)'/);
      if (!m) return;
      const remoteBuildDate = m[1];
      if (currentBuildDate && new Date(remoteBuildDate) > new Date(currentBuildDate)) {
        updateDetected = true;
        showBanner();
      }
    } catch (_) {
      // Erreur réseau — on ignore silencieusement
    }
  }

  // Rendre le badge de version cliquable pour forcer une vérification
  if (versionEl) {
    versionEl.style.cursor = 'pointer';
    versionEl.title = 'Cliquer pour vérifier les mises à jour';
    versionEl.addEventListener('click', () => {
      if (updateDetected) {
        showBanner();
      } else {
        check();
      }
    });
  }

  // Première vérification après quelques secondes (sans bloquer le démarrage)
  setTimeout(check, 8000);
  // Vérification toutes les heures
  setInterval(check, CHECK_INTERVAL);

  return { checkNow: check };
}
