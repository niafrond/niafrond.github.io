/**
 * main.js — Point d'entrée de l'application Quiz
 *
 * Routing :
 *   ?host=PEERID  → mode client (rejoindre)
 *   (rien)        → mode hôte (créer/configurer)
 */

import { initHost } from './host.js';
import { initClient } from './client.js';
import { setMuted, getMuted } from './sound.js';
import { getVersion, getBuildDate } from '../version.js';

// ─── Bouton mute (persistant) ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const versionEl = document.getElementById('quiz-version');
  const buildDate = getBuildDate();
  if (versionEl) {
    const dateLabel = buildDate
      ? ` · ${new Date(buildDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
      : '';
    versionEl.textContent = `v${getVersion()}${dateLabel}`;
  }

  const btnMute = document.getElementById('btn-mute');
  if (btnMute) {
    // Restaurer la préférence mute depuis localStorage
    const savedMute = localStorage.getItem('quiz_muted') === 'true';
    if (savedMute) {
      setMuted(true);
      btnMute.textContent = '🔇 Son';
      btnMute.title = 'Rétablir le son';
      btnMute.setAttribute('aria-label', 'Rétablir le son');
      btnMute.setAttribute('aria-pressed', 'true');
    } else {
      btnMute.setAttribute('aria-label', 'Couper le son');
      btnMute.setAttribute('aria-pressed', 'false');
    }

    btnMute.addEventListener('click', () => {
      const muted = !getMuted();
      setMuted(muted);
      try { localStorage.setItem('quiz_muted', muted); } catch (_) {}
      btnMute.textContent = muted ? '🔇 Son' : '🔊 Son';
      btnMute.title = muted ? 'Rétablir le son' : 'Couper le son';
      btnMute.setAttribute('aria-label', muted ? 'Rétablir le son' : 'Couper le son');
      btnMute.setAttribute('aria-pressed', String(muted));
    });
  }
});

// ─── Visibilité des éléments selon le rôle ────────────────────────────────────

function applyRoleVisibility(isHost) {
  const hostOnly = document.querySelectorAll('.host-only');
  const clientOnly = document.querySelectorAll('.client-only');
  hostOnly.forEach(el => { el.hidden = !isHost; });
  clientOnly.forEach(el => { el.hidden = isHost; });
}

// ─── Routing ──────────────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const hostParam = params.get('host');

if (hostParam) {
  applyRoleVisibility(false);
  initClient(hostParam);
} else {
  applyRoleVisibility(true);
  initHost();
}
