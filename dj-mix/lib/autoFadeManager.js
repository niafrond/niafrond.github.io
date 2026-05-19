import { createLogger } from './logger.js';

export class AutoFadeManager {
  constructor(options) {
    this.getQueueLength = options.getQueueLength;
    this.getCurrentIndex = options.getCurrentIndex;
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
    const nextIndex = next < length ? next : 0;
    this._logger.debug('autofade.next.computed', { length, current, nextIndex });
    return nextIndex;
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
