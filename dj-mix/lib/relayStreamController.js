/**
 * relayStreamController.js — État actif/inactif du flux relais
 *
 * Gère le toggle "Lancer le flux / Arrêter le flux" de manière indépendante
 * du DOM, pour rester testable.
 */
export function createRelayStreamController({ onStart, onStop } = {}) {
  let _active = false;

  function start() {
    if (_active) return;
    _active = true;
    onStart?.();
  }

  function stop() {
    if (!_active) return;
    _active = false;
    onStop?.();
  }

  function toggle() { _active ? stop() : start(); }
  function isActive() { return _active; }

  return { start, stop, toggle, isActive };
}
