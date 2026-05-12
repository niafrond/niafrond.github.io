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
  }

  getNextIndex() {
    const length = Number(this.getQueueLength?.() || 0);
    const current = Number(this.getCurrentIndex?.() || 0);
    if (length <= 1) return -1;

    const next = current + 1;
    return next < length ? next : 0;
  }

  async handleReady() {
    if (this._inFlight) return;
    if (this.isLocked?.()) {
      this.onSkipLocked?.();
      return;
    }

    const nextIndex = this.getNextIndex();
    if (nextIndex < 0) return;

    this._inFlight = true;
    this.onStart?.();
    try {
      await this.perform?.(nextIndex);
    } catch (err) {
      this.onError?.(err);
    } finally {
      this.onEnd?.();
      this._inFlight = false;
    }
  }
}
