import {
  MAX_PARALLEL_DOWNLOADS,
  MIN_PARALLEL_DOWNLOADS,
  TARGET_MS_PER_TRACK_DOWNLOAD,
} from './constants.js';

/**
 * Calcule la taille du prochain batch de téléchargements en parallèle à
 * partir du temps moyen observé par morceau sur le batch qui vient de
 * s'exécuter. Trop lent par morceau (bande passante diluée entre trop de
 * téléchargements simultanés) → on réduit le parallélisme. Largement sous la
 * cible → on l'augmente pour mieux utiliser la bande passante disponible.
 *
 * @param {object} params
 * @param {number} params.currentSize - taille du batch qui vient de s'exécuter
 * @param {number} params.elapsedMs - durée totale du batch (ms)
 * @param {number} params.completedCount - nombre de morceaux traités dans ce batch
 * @returns {number} prochaine taille de batch, entre MIN_PARALLEL_DOWNLOADS et MAX_PARALLEL_DOWNLOADS
 */
export function computeNextBatchSize({ currentSize, elapsedMs, completedCount }) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || !Number.isFinite(completedCount) || completedCount <= 0) {
    return currentSize;
  }
  const msPerTrack = elapsedMs / completedCount;
  if (msPerTrack > TARGET_MS_PER_TRACK_DOWNLOAD && currentSize > MIN_PARALLEL_DOWNLOADS) {
    return currentSize - 1;
  }
  if (msPerTrack < TARGET_MS_PER_TRACK_DOWNLOAD / 2 && currentSize < MAX_PARALLEL_DOWNLOADS) {
    return currentSize + 1;
  }
  return currentSize;
}
