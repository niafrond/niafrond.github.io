import { jest, describe, test, expect } from '@jest/globals';
import { createRelayStreamController } from '../../lib/relayStreamController.js';

describe('relayStreamController', () => {
  test('SPEC-9.3.5 — inactif par défaut', () => {
    const ctrl = createRelayStreamController();
    expect(ctrl.isActive()).toBe(false);
  });

  test('SPEC-9.3.6 — start() active le flux et appelle onStart', () => {
    const onStart = jest.fn();
    const ctrl = createRelayStreamController({ onStart });
    ctrl.start();
    expect(ctrl.isActive()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('SPEC-9.3.6 — start() est idempotent quand déjà actif', () => {
    const onStart = jest.fn();
    const ctrl = createRelayStreamController({ onStart });
    ctrl.start();
    ctrl.start();
    expect(ctrl.isActive()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  test('SPEC-9.3.7 — stop() désactive le flux et appelle onStop', () => {
    const onStop = jest.fn();
    const ctrl = createRelayStreamController({ onStop });
    ctrl.start();
    ctrl.stop();
    expect(ctrl.isActive()).toBe(false);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test('SPEC-9.3.7 — stop() est idempotent quand déjà inactif', () => {
    const onStop = jest.fn();
    const ctrl = createRelayStreamController({ onStop });
    ctrl.stop();
    expect(ctrl.isActive()).toBe(false);
    expect(onStop).not.toHaveBeenCalled();
  });

  test('toggle() alterne entre actif et inactif', () => {
    const onStart = jest.fn();
    const onStop = jest.fn();
    const ctrl = createRelayStreamController({ onStart, onStop });
    ctrl.toggle();
    expect(ctrl.isActive()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    ctrl.toggle();
    expect(ctrl.isActive()).toBe(false);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test('stop() sans start() préalable ne lance pas onStop', () => {
    const onStop = jest.fn();
    const ctrl = createRelayStreamController({ onStop });
    ctrl.stop();
    expect(onStop).not.toHaveBeenCalled();
  });
});
