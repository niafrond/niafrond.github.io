/**
 * Vérifie périodiquement que la platine inactive a bien une piste préchargée.
 * Détecte également le bug où le même morceau serait chargé sur les deux platines.
 *
 * @param {object} deps
 * @param {() => boolean} deps.isPlaying
 * @param {() => 'A'|'B'} deps.getActiveDeck
 * @param {() => 'A'|'B'} deps.getInactiveDeck
 * @param {(deck: 'A'|'B') => object|null} deps.getDeckItem
 * @param {(deck: 'A'|'B', item: object|null) => void} deps.setDeckItem
 * @param {(...args: any[]) => void} [deps.logDebug]
 * @param {(...args: any[]) => void} [deps.logWarn]
 * @param {number} [deps.intervalMs]
 * @returns {{ start: () => void, stop: () => void, _tick: () => void }}
 */
export function createInactivePreloadWatcher(deps) {
  const {
    isPlaying,
    getActiveDeck,
    getInactiveDeck,
    getDeckItem,
    setDeckItem,
    logDebug = () => {},
    logWarn = () => {},
    intervalMs = 10_000,
  } = deps;

  let _timer = null;
  let _watchedActiveDeck = null;

  function tick() {
    if (!isPlaying()) {
      stop();
      return;
    }

    const currentActiveDeck = getActiveDeck();
    if (currentActiveDeck !== _watchedActiveDeck) {
      logDebug('inactivePreloadCheck: platine active changée — relance de la vérification', {
        from: _watchedActiveDeck, to: currentActiveDeck,
      });
      start();
      return;
    }

    const inactiveDeck = getInactiveDeck();
    const activeItem = getDeckItem(currentActiveDeck);
    const inactiveItem = getDeckItem(inactiveDeck);

    if (activeItem && inactiveItem && activeItem.id === inactiveItem.id) {
      logWarn('inactivePreloadCheck: même morceau sur les deux platines — nettoyage de la platine inactive', {
        activeDeck: currentActiveDeck, inactiveDeck, trackId: activeItem.id, trackName: activeItem.name,
      });
      setDeckItem(inactiveDeck, null);
      return;
    }

    if (inactiveItem) {
      logDebug('inactivePreloadCheck: platine inactive préchargée — arrêt de la vérification', {
        inactiveDeck, trackId: inactiveItem.id,
      });
      stop();
      return;
    }

    logWarn('inactivePreloadCheck: platine inactive sans piste préchargée', {
      activeDeck: currentActiveDeck, inactiveDeck,
    });
  }

  function start() {
    stop();
    _watchedActiveDeck = getActiveDeck();
    _timer = setInterval(tick, intervalMs);
  }

  function stop() {
    if (_timer !== null) {
      clearInterval(_timer);
      _timer = null;
    }
    _watchedActiveDeck = null;
  }

  return { start, stop, _tick: tick };
}
