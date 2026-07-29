/**
 * artworkPersistence.js — décide quelle URL d'artwork utiliser pour l'affichage
 * (locale en priorité) et comble le cache local d'octets quand il manque.
 *
 * Avant cette logique, `persistArtwork`/`restoreArtwork` (audioSourceManager.js)
 * n'étaient quasiment jamais atteints en pratique : dès qu'un morceau avait déjà
 * une `artUrl` distante (recherche, import Spotify, onglet Cache, réponse de
 * l'API de téléchargement — le cas de loin le plus fréquent), le code appelant
 * s'arrêtait avant même de vérifier le cache local. Résultat : seule l'URL
 * (texte) était mémorisée, jamais les octets de l'image — chaque affichage
 * retéléchargeait la pochette (SPEC-13.3.9).
 */

/**
 * @param {object} item - doit exposer `artUrl` (et être accepté tel quel par `restoreArtwork`/`persistArtwork`)
 * @param {object} deps
 * @param {(item: object) => Promise<string|null>} deps.restoreArtwork - retourne une blob: URL locale ou null
 * @param {(item: object, artUrl: string) => Promise<void>} [deps.persistArtwork] - persiste les octets en arrière-plan
 * @returns {Promise<{ localBlobUrl: string, remoteArtUrl: string }>}
 */
export async function resolveArtworkForItem(item, { restoreArtwork, persistArtwork } = {}) {
  const isAlreadyLocalBlob = typeof item?.artUrl === 'string' && item.artUrl.startsWith('blob:');
  const remoteArtUrl = (typeof item?.artUrl === 'string' && !isAlreadyLocalBlob) ? item.artUrl : '';

  if (!item || !restoreArtwork) return { localBlobUrl: '', remoteArtUrl };

  // Already resolved to a local blob earlier this session — skip the
  // redundant IndexedDB read.
  if (isAlreadyLocalBlob) return { localBlobUrl: item.artUrl, remoteArtUrl: '' };

  const localBlobUrl = (await restoreArtwork(item).catch(() => null)) || '';

  // Pas de blob local mais une URL distante déjà connue : c'est exactement le
  // cas qui échappait auparavant à toute persistance — combler en arrière-plan
  // sans bloquer l'affichage (qui utilise remoteArtUrl entre-temps).
  if (!localBlobUrl && remoteArtUrl && persistArtwork) {
    Promise.resolve(persistArtwork(item, remoteArtUrl)).catch(() => {});
  }

  return { localBlobUrl, remoteArtUrl };
}
