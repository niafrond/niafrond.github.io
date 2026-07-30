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
 *              ordre chronologique de soumission (`cmd.requestedAt`, horodatage posé
 *              par le relais léger au moment du clic) — pas l'ordre d'arrivée réseau
 *              sur le maître, qui peut différer (polling par lot, latence variable
 *              d'un appareil à l'autre) : une commande envoyée à 3h20 ne doit jamais
 *              passer devant une commande envoyée à 3h15 même si elle arrive/termine
 *              son téléchargement avant. `_nextSlots` est maintenu trié par
 *              `requestedAt` croissant à l'insertion (cf. `_insertSortedNext`), et le
 *              commit reste FIFO strict sur ce tableau trié, quel que soit l'ordre
 *              réel de fin de téléchargement (addToQueue({asNext:true}) empile en
 *              LIFO par défaut, d'où le compteur insertOffset ci-dessous).
 *
 * Un échec de téléchargement d'un slot "next" ne le retire pas : un retry est
 * planifié automatiquement après 10 minutes, sans toast d'erreur (pas de canal
 * vers le relais).
 *
 * Retour visuel côté maître (cf. SPECS.md §9.5) : `getStatus()` expose aussi le détail
 * des pistes en cours (`now`, `next[]`), et `onChange()` est appelé à chaque mutation
 * pour permettre un rendu immédiat sans polling.
 */

const RELAY_INCOMING_NEXT_MAX_SLOTS = 10;
const RELAY_INCOMING_NEXT_RETRY_DELAY_MS = 10 * 60 * 1000;

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
  nextRetryDelayMs = RELAY_INCOMING_NEXT_RETRY_DELAY_MS,
} = {}) {
  let _nowSlot = null; // { track, deviceId } | null
  let _nextSlots = [];  // [{ track, deviceId, ready, inFlight, retryAt, retryTimer }]

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
      _handleNext(cmd.track, cmd.deviceId, cmd.requestedAt);
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

  function _handleNext(track, deviceId, requestedAt) {
    if (_nextSlots.length >= maxNextSlots) {
      logger?.info('relay.incoming.next.rejected', { name: track?.name, deviceId, count: _nextSlots.length });
      return;
    }
    // Pas d'horodatage fourni (ancien relais, champ manquant) : on le traite comme
    // "à l'instant" pour ne pas bloquer indéfiniment derrière des slots déjà présents.
    const slot = {
      track,
      deviceId,
      requestedAt: requestedAt ?? Date.now(),
      ready: false,
      inFlight: false,
      retryAt: null,
      retryTimer: null,
    };
    _insertSortedNext(slot);
    onChange?.();
    Promise.resolve(prefetchMixData?.(track)).catch(() => {});
    _startNextDownload(slot);
  }

  function _scheduleNextRetry(slot, err) {
    if (!_nextSlots.includes(slot) || slot.ready) return;
    if (slot.retryTimer) return;
    slot.inFlight = false;
    slot.retryAt = Date.now() + nextRetryDelayMs;
    logger?.warn('relay.incoming.next.downloadFailed', {
      name: slot.track?.name,
      deviceId: slot.deviceId,
      err: err?.message,
      retryInMs: nextRetryDelayMs,
    });
    slot.retryTimer = setTimeout(() => {
      slot.retryTimer = null;
      slot.retryAt = null;
      if (!_nextSlots.includes(slot) || slot.ready) return;
      _startNextDownload(slot);
    }, nextRetryDelayMs);
    _drainNext();
  }

  function _startNextDownload(slot) {
    if (slot.inFlight || slot.ready) return;
    slot.inFlight = true;
    let failureHandled = false;
    prefetchTrackToLocalCache(slot.track, {
      onError: (err) => {
        if (failureHandled) return;
        failureHandled = true;
        _scheduleNextRetry(slot, err);
      },
    }).then((ok) => {
      slot.inFlight = false;
      if (ok) {
        slot.ready = true;
        _drainNext();
        return;
      }
      if (failureHandled) return;
      failureHandled = true;
      _scheduleNextRetry(slot);
    }).catch((err) => {
      slot.inFlight = false;
      if (failureHandled) return;
      failureHandled = true;
      _scheduleNextRetry(slot, err);
    });
  }

  // Insertion triée par `requestedAt` croissant (stable : à égalité, conserve l'ordre
  // d'arrivée). Garantit qu'un slot soumis plus tôt (ex. 3h15) reste toujours devant
  // un slot soumis plus tard (ex. 3h20), quel que soit l'ordre d'arrivée réseau.
  function _insertSortedNext(slot) {
    let i = _nextSlots.length;
    while (i > 0 && _nextSlots[i - 1].requestedAt > slot.requestedAt) i--;
    _nextSlots.splice(i, 0, slot);
  }

  function _drainNext() {
    while (_nextSlots.length && _nextSlots[0].ready) {
      const slot = _nextSlots.shift();
      if (slot.retryTimer) {
        clearTimeout(slot.retryTimer);
        slot.retryTimer = null;
      }
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
