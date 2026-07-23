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
 *
 * Retour visuel côté maître (cf. SPECS.md §9.5) : `getStatus()` expose aussi le détail
 * des pistes en cours (`now`, `next[]`), et `onChange()` est appelé à chaque mutation
 * pour permettre un rendu immédiat sans polling.
 */

const RELAY_INCOMING_NEXT_MAX_SLOTS = 10;

export function createRelayIncomingQueue({
  prefetchTrackToLocalCache,
  prefetchMixData,
  addToQueue,
  triggerSearchFade,
  getCurrentIndex,
  showToast,
  logger,
  onChange,
  maxNextSlots = RELAY_INCOMING_NEXT_MAX_SLOTS,
} = {}) {
  let _nowSlot = null; // { track, deviceId } | null
  let _nextSlots = [];  // [{ track, deviceId, ready, failed }]

  let _lastCommitIndex = null;
  let _insertedSinceIndexChange = 0;

  function _trackSummary(track, deviceId) {
    return {
      name: track?.name || '',
      artist: track?.artist || '',
      artUrl: track?.artUrl || '',
      deviceId: deviceId || null,
    };
  }

  function getStatus() {
    return {
      nowPending: _nowSlot !== null,
      nextCount: _nextSlots.length,
      nextMax: maxNextSlots,
      now: _nowSlot ? _trackSummary(_nowSlot.track, _nowSlot.deviceId) : null,
      next: _nextSlots.map((s) => ({ ..._trackSummary(s.track, s.deviceId), ready: s.ready })),
    };
  }

  function handleCommand(cmd) {
    if (!cmd || cmd.type !== 'addToQueue' || !cmd.track) return;
    if (cmd.playNow) {
      _handleNow(cmd.track, cmd.deviceId);
    } else {
      _handleNext(cmd.track, cmd.deviceId);
    }
  }

  function _handleNow(track, deviceId) {
    if (_nowSlot) {
      logger?.info('relay.incoming.now.rejected', { name: track?.name, deviceId });
      return;
    }
    _nowSlot = { track, deviceId };
    onChange?.();
    // Lancée en parallèle du téléchargement audio, sans attendre son résultat : les
    // données de mix (offset de démarrage zone-based) ne sont sinon récupérées qu'au
    // lancement de la lecture (startPlaybackForIndex), ce qui ajoute un délai perceptible
    // (jusqu'à 700 ms, cf. main.js) même quand l'audio est déjà en cache local.
    Promise.resolve(prefetchMixData?.(track)).catch(() => {});
    prefetchTrackToLocalCache(track, {
      onError: (err) => {
        logger?.warn('relay.incoming.now.downloadFailed', { name: track?.name, deviceId, err: err?.message });
        _nowSlot = null;
        onChange?.();
      },
    }).then((ok) => {
      // Le slot ne libère plus le même objet si une autre commande now a déjà
      // échoué/été rejetée entre-temps (garde par référence).
      if (_nowSlot?.track !== track) return;
      _nowSlot = null;
      onChange?.();
      if (!ok) return;
      triggerSearchFade(track);
      showToast?.(`Relais : ${track.name || 'piste'} — lecture imminente`);
    });
  }

  function _handleNext(track, deviceId) {
    if (_nextSlots.length >= maxNextSlots) {
      logger?.info('relay.incoming.next.rejected', { name: track?.name, deviceId, count: _nextSlots.length });
      return;
    }
    const slot = { track, deviceId, ready: false, failed: false };
    _nextSlots.push(slot);
    onChange?.();
    Promise.resolve(prefetchMixData?.(track)).catch(() => {});
    prefetchTrackToLocalCache(track, {
      onError: (err) => {
        logger?.warn('relay.incoming.next.downloadFailed', { name: track?.name, deviceId, err: err?.message });
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
    // Toujours notifié, même sans commit : un slot peut passer "ready" (✓) sans
    // être en tête de file (slot précédent encore en téléchargement).
    onChange?.();
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
