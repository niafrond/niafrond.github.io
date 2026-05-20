/**
 * apiHealthMonitor.js – Detects when the downloader API goes offline.
 *
 * When `FAILURE_THRESHOLD` consecutive API errors are recorded:
 *   - The monitor switches to "offline" state.
 *   - All callers that check `isOffline()` skip their API calls and use local logic.
 *   - The monitor periodically probes `/health` until the server responds → goes back online.
 *
 * Usage:
 *   const monitor = createApiHealthMonitor({ getDownloaderApiUrl, onOffline, onOnline });
 *   monitor.recordSuccess();   // call after a successful API response
 *   monitor.recordFailure();   // call after a network/fetch error
 *   monitor.isOffline();       // true while the API is unreachable
 *   monitor.destroy();         // stop timers on cleanup
 */

const FAILURE_THRESHOLD = 2;      // consecutive failures before going offline
const PROBE_INTERVAL_MS = 15000;  // how often to re-check /health while offline
const PROBE_TIMEOUT_MS  = 5000;   // per-probe timeout

export function createApiHealthMonitor({
  getDownloaderApiUrl,
  onOffline = () => {},
  onOnline  = () => {},
  failureThreshold = FAILURE_THRESHOLD,
  probeIntervalMs  = PROBE_INTERVAL_MS,
  probeTimeoutMs   = PROBE_TIMEOUT_MS,
} = {}) {
  let _offline             = false;
  let _consecutiveFailures = 0;
  let _probeTimer          = null;
  let _destroyed           = false;

  function isOffline() {
    return _offline;
  }

  function _goOffline() {
    if (_offline) return;
    _offline = true;
    onOffline();
    _startProbing();
  }

  function _goOnline() {
    if (!_offline) return;
    _offline             = false;
    _consecutiveFailures = 0;
    _stopProbing();
    onOnline();
  }

  function _startProbing() {
    if (_probeTimer !== null) return;
    _probeTimer = setInterval(() => {
      void _probe();
    }, probeIntervalMs);
  }

  function _stopProbing() {
    if (_probeTimer === null) return;
    clearInterval(_probeTimer);
    _probeTimer = null;
  }

  async function _probe() {
    if (_destroyed) return;
    const baseUrl = getDownloaderApiUrl?.();
    if (!baseUrl) return;

    try {
      const res = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(probeTimeoutMs),
      });
      if (res.ok) {
        _goOnline();
      }
    } catch (_) {
      // still offline – keep probing
    }
  }

  function recordSuccess() {
    _consecutiveFailures = 0;
    if (_offline) {
      _goOnline();
    }
  }

  function recordFailure() {
    _consecutiveFailures += 1;
    if (!_offline && _consecutiveFailures >= failureThreshold) {
      _goOffline();
    }
  }

  function destroy() {
    _destroyed = true;
    _stopProbing();
  }

  return { isOffline, recordSuccess, recordFailure, destroy };
}
