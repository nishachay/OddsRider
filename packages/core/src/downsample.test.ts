import { describe, expect, it } from 'vitest';
import { lttb } from './downsample.ts';
import type { PricePoint } from './types.ts';

function series(values: number[]): PricePoint[] {
  return values.map((p, i) => ({ t: 1_700_000_000 + i * 3600, p }));
}

describe('lttb', () => {
  it('returns short series untouched', () => {
    const input = series([0.2, 0.5]);
    expect(lttb(input, 600)).toEqual(input);
  });

  it('hits the requested length exactly', () => {
    const input = series(Array.from({ length: 1000 }, (_, i) => 0.5 + Math.sin(i / 20) / 4));
    expect(lttb(input, 600)).toHaveLength(600);
    expect(lttb(input, 50)).toHaveLength(50);
    expect(lttb(input, 3)).toHaveLength(3);
  });

  it('keeps the first and last point', () => {
    const input = series(Array.from({ length: 500 }, (_, i) => 0.3 + (i % 7) / 50));
    const out = lttb(input, 40);
    expect(out[0]).toEqual(input[0]);
    expect(out[out.length - 1]).toEqual(input[input.length - 1]);
  });

  it('never reorders or duplicates a timestamp', () => {
    const input = series(Array.from({ length: 900 }, (_, i) => 0.4 + Math.cos(i / 11) / 5));
    const out = lttb(input, 120);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].t).toBeGreaterThan(out[i - 1].t);
    }
  });

  it('preserves a lone spike — the whole point of LTTB', () => {
    // 400 boring points with one cliff in the middle (the FTX shape).
    const values = Array.from({ length: 400 }, () => 0.95);
    values[200] = 0.02;
    const out = lttb(series(values), 60);

    expect(out.some((point) => point.p === 0.02)).toBe(true);
    // Stride sampling would have missed it.
    expect(Math.min(...out.map((point) => point.p))).toBeCloseTo(0.02, 10);
  });

  it('is deterministic', () => {
    const input = series(Array.from({ length: 777 }, (_, i) => 0.5 + Math.sin(i) / 10));
    expect(lttb(input, 64)).toEqual(lttb(input, 64));
  });

  it('refuses a threshold that cannot make a track', () => {
    expect(() => lttb(series([0.1, 0.2, 0.3]), 2)).toThrow(/threshold/);
  });
});
