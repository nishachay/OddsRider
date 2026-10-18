import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getGhostRun,
  ghostKey,
  ghostsEnabled,
  saveGhostRun,
  setGhostsEnabled,
  type GhostRun,
} from './playerStorage.ts';

// Node has no localStorage: a Map-backed stub is enough for the ghost store,
// which is the only part of playerStorage this file exercises.
function stubStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

function run(overrides: Partial<Omit<GhostRun, 'savedAt'>> = {}): Omit<GhostRun, 'savedAt'> {
  return {
    trackId: '253591-576fcffa80a5',
    inverted: false,
    interval: 'ALL',
    score: 1200,
    timeMs: 9000,
    finished: false,
    snapshots: [
      { t: 0, x: 850, y: 470, a: 0 },
      { t: 50, x: 900, y: 468, a: -0.02 },
    ],
    ...overrides,
  };
}

beforeEach(stubStorage);
afterEach(() => vi.unstubAllGlobals());

describe('ghost keys', () => {
  it('separates terrain: side and window are part of the key', () => {
    expect(ghostKey('abc')).toBe('abc:YES:ALL');
    expect(ghostKey('abc', true)).toBe('abc:NO:ALL');
    expect(ghostKey('abc', false, '7D')).toBe('abc:YES:7D');
    expect(new Set([ghostKey('abc'), ghostKey('abc', true), ghostKey('abc', false, '7D')]).size).toBe(3);
  });
});

describe('best-run ghosts', () => {
  it('round-trips the snapshots and starts empty', () => {
    expect(getGhostRun('253591-576fcffa80a5')).toBeNull();
    expect(saveGhostRun(run())).toBe(true);
    const saved = getGhostRun('253591-576fcffa80a5');
    expect(saved?.score).toBe(1200);
    expect(saved?.snapshots).toHaveLength(2);
    expect(saved?.savedAt).toBeGreaterThan(0);
  });

  it('keeps only the better run, per terrain', () => {
    saveGhostRun(run({ score: 1200 }));
    expect(saveGhostRun(run({ score: 900, snapshots: [{ t: 0, x: 0, y: 0, a: 0 }] }))).toBe(false);
    expect(getGhostRun('253591-576fcffa80a5')?.score).toBe(1200);
    expect(getGhostRun('253591-576fcffa80a5')?.snapshots).toHaveLength(2);

    expect(saveGhostRun(run({ score: 1500 }))).toBe(true);
    expect(getGhostRun('253591-576fcffa80a5')?.score).toBe(1500);

    // A different side or window is a different track: its own best.
    expect(getGhostRun('253591-576fcffa80a5', true)).toBeNull();
    saveGhostRun(run({ score: 100, inverted: true }));
    expect(getGhostRun('253591-576fcffa80a5', true)?.score).toBe(100);
    expect(getGhostRun('253591-576fcffa80a5')?.score).toBe(1500);
  });

  it('survives corrupt storage instead of throwing', () => {
    localStorage.setItem('oddsrider_ghosts_v1', '{not json');
    expect(getGhostRun('253591-576fcffa80a5')).toBeNull();
    expect(saveGhostRun(run())).toBe(true);
    expect(getGhostRun('253591-576fcffa80a5')?.score).toBe(1200);
  });
});

describe('ghost preference', () => {
  it('defaults to on and remembers being switched off', () => {
    expect(ghostsEnabled()).toBe(true);
    setGhostsEnabled(false);
    expect(ghostsEnabled()).toBe(false);
    setGhostsEnabled(true);
    expect(ghostsEnabled()).toBe(true);
  });
});
