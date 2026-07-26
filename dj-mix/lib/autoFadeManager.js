import { createLogger } from './logger.js';

export class AutoFadeManager {
  constructor(options) {
    this.getQueueLength = options.getQueueLength;
    this.getCurrentIndex = options.getCurrentIndex;
    this.getQueueLoopEnabled = options.getQueueLoopEnabled;
    this.isPlayerCrossfading = options.isPlayerCrossfading;
    this.isLocked = options.isLocked;
    this.onStart = options.onStart;
    this.onEnd = options.onEnd;
    this.onSkipLocked = options.onSkipLocked;
    this.onError = options.onError;
    this.perform = options.perform;
    this._inFlight = false;
    this._logger = createLogger('autofade');
  }

  getNextIndex() {
    const length = Number(this.getQueueLength?.() || 0);
    const current = Number(this.getCurrentIndex?.() || 0);
    if (length <= 1) {
      this._logger.debug('autofade.next.skipped.shortQueue', { length, current });
      return -1;
    }

    const next = current + 1;
    if (next < length) {
      this._logger.debug('autofade.next.computed', { length, current, nextIndex: next });
      return next;
    }

    // Fin de file : ne boucler que si le mode boucle est actif. Sinon, laisser
    // la place au fallback fil rouge (déclenché ailleurs, sur trackend) plutôt
    // que de rejouer arbitrairement le début de la file (cf. bug SPEC-2.9.1 —
    // "Mayores" audible alors que la file affichait encore le morceau précédent).
    if (!this.getQueueLoopEnabled?.()) {
      this._logger.debug('autofade.next.skipped.endOfQueue.loopOff', { length, current });
      return -1;
    }

    this._logger.debug('autofade.next.computed.wrapped', { length, current, nextIndex: 0 });
    return 0;
  }

  async handleReady() {
    if (this._inFlight) {
      this._logger.debug('autofade.handle.skipped.inFlight');
      return;
    }
    if (this.isLocked?.()) {
      this._logger.info('autofade.handle.skipped.locked');
      this.onSkipLocked?.();
      return;
    }
    if (this.isPlayerCrossfading?.()) {
      // Un autre déclencheur (clic manuel AutoMix, trackend/fil rouge...) a déjà
      // démarré une transition : ne pas en superposer une seconde, qui serait
      // silencieusement ignorée côté player mais mettrait quand même à jour l'état
      // de la file avec un morceau qui n'est jamais réellement devenu audible.
      this._logger.debug('autofade.handle.skipped.alreadyCrossfading');
      return;
    }

    const nextIndex = this.getNextIndex();
    if (nextIndex < 0) {
      this._logger.debug('autofade.handle.skipped.noNextTrack');
      return;
    }

    this._inFlight = true;
    this._logger.info('autofade.handle.started', { nextIndex });
    this.onStart?.();
    try {
      await this.perform?.(nextIndex);
      this._logger.info('autofade.handle.completed', { nextIndex });
    } catch (err) {
      this._logger.error('autofade.handle.failed', { nextIndex, message: err?.message });
      this.onError?.(err);
    } finally {
      this.onEnd?.();
      this._inFlight = false;
      this._logger.debug('autofade.handle.cleanupDone');
    }
  }
}
