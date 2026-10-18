import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REDUCED_MOTION_KEY,
  applyReducedMotion,
  loadReducedMotion,
  motionReduced,
  storedMotionChoice,
  storeReducedMotion,
  systemReducedMotion,
} from './motion';

function stubStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  return store;
}

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal('window', {
    matchMedia: () => ({ matches: reduced }),
  });
}

function stubDocument() {
  const attrs = new Map<string, string>();
  vi.stubGlobal('document', {
    documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v) },
  });
  return attrs;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reduced-motion preference', () => {
  it('defaults to the OS setting when the rider has never chosen', () => {
    stubStorage();
    stubMatchMedia(true);
    expect(storedMotionChoice()).toBeNull();
    expect(loadReducedMotion()).toBe(true);

    stubMatchMedia(false);
    expect(loadReducedMotion()).toBe(false);
  });

  it('remembers the rider choice over the OS setting', () => {
    stubStorage();
    stubMatchMedia(true);
    storeReducedMotion(false);
    expect(loadReducedMotion()).toBe(false);

    storeReducedMotion(true);
    expect(loadReducedMotion()).toBe(true);
  });

  it('reads no preference (and no motion reduction) without a browser', () => {
    expect(storedMotionChoice()).toBeNull();
    expect(systemReducedMotion()).toBe(false);
    expect(motionReduced()).toBe(false);
  });

  it('mirrors the preference onto <html> for CSS', () => {
    const attrs = stubDocument();
    applyReducedMotion(true);
    expect(attrs.get('data-reduced-motion')).toBe('true');
    applyReducedMotion(false);
    expect(attrs.get('data-reduced-motion')).toBe('false');
  });

  it('exposes the saved choice to the game gate, keyed the same way', () => {
    const store = stubStorage();
    stubMatchMedia(false);
    storeReducedMotion(true);
    expect(store.get(REDUCED_MOTION_KEY)).toBe('1');
    expect(motionReduced()).toBe(true);
  });
});
