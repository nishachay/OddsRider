import { afterEach, describe, expect, it, vi } from 'vitest';
import { storeReducedMotion } from '../data/motion';
import { gateCameraShake, screenShakeAllowed, type ShakeOwner } from './motion';

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  return store;
}

// A stand-in for Phaser's camera prototype: records how it was called.
function fakeCamera(sentinel = 'shaken') {
  const calls: unknown[][] = [];
  const camera: ShakeOwner = {
    shake(...args: unknown[]) {
      calls.push(args);
      return sentinel;
    },
  };
  return { camera, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('screen-shake gate', () => {
  it('allows the shake and passes it through untouched by default', () => {
    stubStorage();
    const { camera, calls } = fakeCamera();
    gateCameraShake(camera);
    expect(screenShakeAllowed()).toBe(true);
    expect((camera.shake as (...a: unknown[]) => unknown).call(camera, 200, 0.004)).toBe('shaken');
    expect(calls).toEqual([[200, 0.004]]);
  });

  it('swallows the shake (returning the camera) when motion is reduced', () => {
    stubStorage();
    storeReducedMotion(true);
    const { camera, calls } = fakeCamera();
    const restore = gateCameraShake(camera);
    expect(screenShakeAllowed()).toBe(false);
    const result = (camera.shake as (...a: unknown[]) => unknown).call(camera, 400, 0.015);
    expect(result).toBe(camera);
    expect(calls).toEqual([]);
    restore();
  });

  it('honours a preference that changes mid-run', () => {
    stubStorage();
    const { camera, calls } = fakeCamera();
    gateCameraShake(camera);
    (camera.shake as (...a: unknown[]) => unknown).call(camera, 10, 0.001);
    storeReducedMotion(true);
    (camera.shake as (...a: unknown[]) => unknown).call(camera, 10, 0.001);
    storeReducedMotion(false);
    (camera.shake as (...a: unknown[]) => unknown).call(camera, 10, 0.001);
    expect(calls.length).toBe(2);
  });

  it('installs exactly one wrapper and restores the original', () => {
    stubStorage();
    const { camera, calls } = fakeCamera();
    const original = camera.shake;
    const restore = gateCameraShake(camera);
    gateCameraShake(camera); // second install is a no-op
    restore();
    expect(camera.shake).toBe(original);
    (camera.shake as (...a: unknown[]) => unknown).call(camera, 5, 0.01);
    expect(calls).toEqual([[5, 0.01]]);
  });
});
