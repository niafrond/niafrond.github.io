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

export async function requestLandscapeLock() {
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape');
  } catch (_) {}
}

export async function requestPortraitLock() {
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('portrait');
  } catch (_) {}
}

export function requestFullscreenIfNeeded() {
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const req = document.documentElement.requestFullscreen
    || document.documentElement.webkitRequestFullscreen;
  if (req) req.call(document.documentElement).catch(() => {});
}

export function showScreen(id, pushHistory = true) {
  _currentScreen = id;
  document.querySelectorAll('[data-screen]').forEach(s => { s.hidden = true; });
  const target = document.getElementById(id);
  if (target) target.hidden = false;
  if (GAMEPLAY_SCREENS.has(id)) {
    requestLandscapeLock();
  } else {
    requestPortraitLock();
  }
  requestFullscreenIfNeeded();
  if (pushHistory) history.pushState({ screen: id }, '');
  if (_onScreenChange) _onScreenChange(id);
}

export function showToast(msg, type = 'info') {
  const t = el('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}
