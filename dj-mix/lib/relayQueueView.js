/**
 * relayQueueView.js — Calcule la file d'attente "non lue" affichée côté relais léger.
 *
 * Le maître diffuse sa queue complète (déjà lus + en cours + à venir) ; le relais ne
 * doit afficher que les titres pas encore joués, c'est-à-dire ceux situés après le
 * morceau courant.
 */

export function getUnreadQueue({ queue = [], currentTrackId, currentIndex } = {}) {
  if (!Array.isArray(queue) || queue.length === 0) return [];

  let idx = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < queue.length
    ? currentIndex
    : -1;

  if (idx === -1 && currentTrackId != null) {
    idx = queue.findIndex((item) => item?.id === currentTrackId);
  }

  if (idx === -1) return [];

  return queue.slice(idx + 1).map((item) => ({
    id: item.id,
    name: item.name || '',
    artist: item.artist || '',
    artUrl: item.artUrl || '',
  }));
}
