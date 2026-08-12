// ============================================================
// theme-party/roundTimer.js — Machine à états pure pour la révélation
// des indices et l'arrêt automatique de la lecture.
//
// Volontairement sans DOM, sans setTimeout/setInterval et sans horloge
// interne : main.js pilote une boucle requestAnimationFrame qui lit le
// temps de lecture réel (player.getCurrentTime()) et appelle
// advanceHintReveal() à chaque frame. Ça garde la révélation des indices
// synchronisée sur la position audio réelle (robuste aux latences réseau)
// plutôt que sur une horloge murale.
// ============================================================

export function createHintRevealState() {
  return {
    hint1Revealed: false,
    hint2Revealed: false,
    stopped: false, // true une fois TIMER.PLAY_MAX atteint — l'appelant doit mettre en pause
  };
}

/** Repart de zéro — à appeler en passant à la piste suivante ou en relançant la piste. */
export function resetHintReveal() {
  return createHintRevealState();
}

/**
 * Fonction pure : à partir de l'état courant et du temps de lecture écoulé
 * (ms) depuis le début de la piste, renvoie le PROCHAIN état. Ne mute jamais
 * son entrée. Idempotente : rappeler avec le même elapsedMs (ou un elapsedMs
 * plus petit, ex. lecture qui recule) ne redécoche jamais un indice déjà révélé.
 *
 * @param {{hint1Revealed:boolean, hint2Revealed:boolean, stopped:boolean}} state
 * @param {number} elapsedMs
 * @param {{HINT_1:number, HINT_2:number, PLAY_MAX:number}} timings
 * @returns {object} nouvel état (même forme) + `changed:boolean` pour permettre
 *                    à l'appelant de sauter un re-rendu si rien n'a changé.
 */
export function advanceHintReveal(state, elapsedMs, timings) {
  const next = { ...state };
  let changed = false;

  if (!next.hint1Revealed && elapsedMs >= timings.HINT_1) {
    next.hint1Revealed = true;
    changed = true;
  }
  if (!next.hint2Revealed && elapsedMs >= timings.HINT_2) {
    next.hint2Revealed = true;
    changed = true;
  }
  if (!next.stopped && elapsedMs >= timings.PLAY_MAX) {
    next.stopped = true;
    changed = true;
  }

  return { ...next, changed };
}
