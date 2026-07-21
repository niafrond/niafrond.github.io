/**
 * relayIncomingQueue.js — File "incoming" pour les commandes du relais léger (relay.js)
 *
 * Une commande `addToQueue` reçue d'un relais ne doit pas apparaître dans la file
 * d'attente tant que la piste n'est pas téléchargée. Deux files séparées :
 *
 *   - "now"  : 1 seul slot (« Lire maintenant »). Une nouvelle demande est rejetée
 *              tant que le slot est occupé. Une fois téléchargée, la piste est
 *              jouée immédiatement via triggerSearchFade() (insertion + automix).
 *   - "next" : jusqu'à `maxNextSlots` slots (« Ajouter en suivant »), committés en
 *              FIFO strict — le 1er slot soumis atterrit juste après la piste en
 *              cours, le 2e juste après lui, quel que soit l'ordre réel de fin de
 *              téléchargement (addToQueue({asNext:true}) empile en LIFO par
 *              défaut, d'où le compteur insertOffset ci-dessous).
 *
 * Un échec de téléchargement libère le slot silencieusement : la piste n'apparaît
 * jamais dans la file, aucun toast d'erreur (pas de canal vers le relais).
 */

const RELAY_INCOMING_NEXT_MAX_SLOTS = 10;

export function createRelayIncomingQueue({
  prefetchTrackToLocalCache,
  addToQueue,
  triggerSearchFade,
  getCurrentIndex,
  showToast,
  logger,
  maxNextSlots = RELAY_INCOMING_NEXT_MAX_SLOTS,
} = {}) {
  let _nowSlot = null; // { track } | null
  let _nextSlots = [];  // [{ track, ready, failed }]

  let _lastCommitIndex = null;
  let _insertedSinceIndexChange = 0;

  function getStatus() {
    return {
      nowPending: _nowSlot !== null,
      nextCount: _nextSlots.length,
      nextMax: maxNextSlots,
    };
  }

  function handleCommand(cmd) {
    if (!cmd || cmd.type !== 'addToQueue' || !cmd.track) return;
    if (cmd.playNow) {
      _handleNow(cmd.track);
    } else {
      _handleNext(cmd.track);
    }
  }

  function _handleNow(track) {
    if (_nowSlot) {
      logger?.info('relay.incoming.now.rejected', { name: track?.name });
      return;
    }
    _nowSlot = { track };
    prefetchTrackToLocalCache(track, {
      onError: (err) => {
        logger?.warn('relay.incoming.now.downloadFailed', { name: track?.name, err: err?.message });
        _nowSlot = null;
      },
    }).then((ok) => {
      // Le slot ne libère plus le même objet si une autre commande now a déjà
      // échoué/été rejetée entre-temps (garde par référence).
      if (_nowSlot?.track !== track) return;
      _nowSlot = null;
      if (!ok) return;
      triggerSearchFade(track);
      showToast?.(`Relais : ${track.name || 'piste'} — lecture imminente`);
    });
  }

  function _handleNext(track) {
    if (_nextSlots.length >= maxNextSlots) {
      logger?.info('relay.incoming.next.rejected', { name: track?.name, count: _nextSlots.length });
      return;
    }
    const slot = { track, ready: false, failed: false };
    _nextSlots.push(slot);
    prefetchTrackToLocalCache(track, {
      onError: (err) => {
        logger?.warn('relay.incoming.next.downloadFailed', { name: track?.name, err: err?.message });
        slot.failed = true;
        _drainNext();
      },
    }).then((ok) => {
      if (slot.failed) return; // déjà traité par onError
      slot.ready = ok;
      slot.failed = !ok;
      _drainNext();
    });
  }

  function _drainNext() {
    while (_nextSlots.length && (_nextSlots[0].ready || _nextSlots[0].failed)) {
      const slot = _nextSlots.shift();
      if (slot.failed) continue;
      _commitNext(slot.track);
    }
  }

  function _commitNext(track) {
    const currentIndex = getCurrentIndex?.();
    if (currentIndex !== _lastCommitIndex) {
      _lastCommitIndex = currentIndex;
      _insertedSinceIndexChange = 0;
    }
    addToQueue(track, {
      showAddedToast: true,
      asNext: true,
      insertOffset: _insertedSinceIndexChange,
    });
    _insertedSinceIndexChange += 1;
    showToast?.(`Relais : ${track.name || 'piste'} ajoutée`);
  }

  return {
    handleCommand,
    getStatus,
  };
}
