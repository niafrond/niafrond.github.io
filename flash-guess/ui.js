/**
 * ui.js — Helpers DOM et navigation entre écrans
 */

import { GAMEPLAY_SCREENS } from './state.js';

let _currentScreen  = 'screen-setup';
let _toastTimer     = null;
let _onScreenChange = null;

export function getCurrentScreen() { return _currentScreen; }

export function onScreenChange(cb) { _onScreenChange = cb; }

export function el(id) { return document.getElementById(id); }

// ─── Orientation / plein écran ─────────────────────────────────────────────────
export function requestFullscreenIfNeeded() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const req = document.documentElement.requestFullscreen
    || document.documentElement.webkitRequestFullscreen;
  if (req) req.call(document.documentElement).catch(() => {});
}

export async function requestLandscapeLock() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (_) { /* Silently ignore */ }
}

export async function requestPortraitLock() {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('portrait');
    }
  } catch (_) { /* Silently ignore */ }
}

// ─── Navigation entre écrans ───────────────────────────────────────────────────
export function showScreen(id, pushHistory = true) {
  _currentScreen = id;
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  document.getElementById(id).hidden = false;
  const versionEl = document.getElementById('flashguess-version');
  if (versionEl) versionEl.hidden = (id !== 'screen-setup');
  const topControls = document.getElementById('top-right-controls');
  if (topControls) topControls.hidden = GAMEPLAY_SCREENS.has(id);
  if (GAMEPLAY_SCREENS.has(id)) {
    requestLandscapeLock();
  } else {
    requestPortraitLock();
  }
  requestFullscreenIfNeeded();
  if (pushHistory) history.pushState({ screen: id }, '');
  if (_onScreenChange) _onScreenChange(id);
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
export function showToast(msg, type = 'info') {
  const t = el('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}
