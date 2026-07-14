import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createApiHealthMonitor } from '../../lib/apiHealthMonitor.js';

describe('apiHealthMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('starts online', () => {
    const monitor = createApiHealthMonitor({ getDownloaderApiUrl: () => 'http://localhost:3000' });
    expect(monitor.isOffline()).toBe(false);
    monitor.destroy();
  });

  test('goes offline after reaching failure threshold', () => {
    const onOffline = jest.fn();
    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOffline,
      failureThreshold: 2,
    });

    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(false);
    expect(onOffline).not.toHaveBeenCalled();

    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(true);
    expect(onOffline).toHaveBeenCalledTimes(1);

    monitor.destroy();
  });

  test('goes online again after recordSuccess while offline', () => {
    const onOffline = jest.fn();
    const onOnline = jest.fn();
    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOffline,
      onOnline,
      failureThreshold: 1,
    });

    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(true);

    monitor.recordSuccess();
    expect(monitor.isOffline()).toBe(false);
    expect(onOnline).toHaveBeenCalledTimes(1);

    monitor.destroy();
  });

  test('recordSuccess resets failure counter', () => {
    const onOffline = jest.fn();
    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOffline,
      failureThreshold: 3,
    });

    monitor.recordFailure();
    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(false);

    monitor.recordSuccess(); // reset counter

    monitor.recordFailure();
    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(false); // needs one more failure

    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(true);

    monitor.destroy();
  });

  test('onOffline and onOnline are called at most once per transition', () => {
    const onOffline = jest.fn();
    const onOnline = jest.fn();
    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOffline,
      onOnline,
      failureThreshold: 1,
    });

    monitor.recordFailure();
    monitor.recordFailure(); // already offline, should not fire again
    expect(onOffline).toHaveBeenCalledTimes(1);

    monitor.recordSuccess();
    monitor.recordSuccess(); // already online, should not fire again
    expect(onOnline).toHaveBeenCalledTimes(1);

    monitor.destroy();
  });

  test('probes /health periodically while offline and recovers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const onOnline = jest.fn();
    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOnline,
      failureThreshold: 1,
      probeIntervalMs: 1000,
      probeTimeoutMs: 500,
    });

    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance timer to trigger one probe
    jest.advanceTimersByTime(1000);
    // Wait for async probe to resolve
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/health',
      expect.objectContaining({}),
    );
    expect(monitor.isOffline()).toBe(false);
    expect(onOnline).toHaveBeenCalledTimes(1);

    monitor.destroy();
    delete global.fetch;
  });

  // SPEC-15.1.2
  test('probe() triggers an immediate fetch to /health when offline', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const onOnline = jest.fn();
    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOnline,
      failureThreshold: 1,
      probeIntervalMs: 60000,
    });

    monitor.recordFailure();
    expect(monitor.isOffline()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    monitor.probe();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/health',
      expect.objectContaining({}),
    );
    expect(monitor.isOffline()).toBe(false);
    expect(onOnline).toHaveBeenCalledTimes(1);

    monitor.destroy();
    delete global.fetch;
  });

  // SPEC-15.1.2
  test('probe() triggers an immediate fetch to /health even when online', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      probeIntervalMs: 60000,
    });

    expect(monitor.isOffline()).toBe(false);

    monitor.probe();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/health',
      expect.objectContaining({}),
    );

    monitor.destroy();
    delete global.fetch;
  });

  test('destroy stops probing', () => {
    const onOnline = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const monitor = createApiHealthMonitor({
      getDownloaderApiUrl: () => 'http://localhost:3000',
      onOnline,
      failureThreshold: 1,
      probeIntervalMs: 1000,
    });

    monitor.recordFailure();
    monitor.destroy();

    // Advance timer — destroyed monitor should not fire fetch
    jest.advanceTimersByTime(5000);
    expect(fetchMock).not.toHaveBeenCalled();

    delete global.fetch;
  });
});
