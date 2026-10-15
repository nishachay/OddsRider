import { describe, expect, it } from 'vitest';
import { MIN_WINDOW_POINTS } from './constants.ts';
import { availableWindows, sliceSeries, tailWindow, windowSeconds } from './window.ts';
import type { PricePoint } from './types.ts';

const HOUR = 3600;
const DAY = 86400;

/** One point per hour, ending at a fixed time. */
function hourly(hours: number): PricePoint[] {
  const end = 1_790_000_000;
  return Array.from({ length: hours }, (_, i) => ({
    t: end - (hours - 1 - i) * HOUR,
    p: 0.4 + Math.sin(i / 5) / 10,
  }));
}

describe('windowSeconds', () => {
  it('maps the ride intervals', () => {
    expect(windowSeconds('24H')).toBe(DAY);
    expect(windowSeconds('7D')).toBe(7 * DAY);
    expect(windowSeconds('ALL')).toBeNull();
  });
});

describe('tailWindow', () => {
  it('keeps only the trailing points', () => {
    const series = hourly(48);
    expect(tailWindow(series, DAY)).toHaveLength(25);
  });

  it('keeps everything inside a wide window', () => {
    const series = hourly(48);
    expect(tailWindow(series, 30 * DAY)).toHaveLength(48);
  });

  it('handles an empty series', () => {
    expect(tailWindow([], DAY)).toEqual([]);
  });
});

describe('sliceSeries', () => {
  it('returns the whole frozen series for ALL', () => {
    const series = hourly(200);
    expect(sliceSeries(series, 'ALL')).toEqual(series);
  });

  it('slices to the requested window when it is thick enough', () => {
    const series = hourly(200);
    // 24 hourly gaps end exactly on the last point.
    expect(sliceSeries(series, '24H')).toHaveLength(25);
    expect(sliceSeries(series, '7D')).toHaveLength(7 * 24 + 1);
  });

  it('falls back to the full series when a window is too thin', () => {
    // Five days of hourly points: 24H is fine, but nothing here is thin enough
    // to trigger the clamp, so slice a genuinely sparse series instead.
    const sparse: PricePoint[] = [
      { t: 1_790_000_000 - 3 * DAY, p: 0.4 },
      { t: 1_790_000_000, p: 0.6 },
    ];
    expect(sliceSeries(sparse, '24H')).toEqual(sparse);
  });

  it('never invents points', () => {
    const series = hourly(100);
    const windowed = sliceSeries(series, '24H');
    for (const point of windowed) {
      expect(series).toContain(point);
    }
  });
});

describe('availableWindows', () => {
  it('reports both windows for hourly history', () => {
    expect(availableWindows(hourly(24 * 10))).toEqual({ h24: true, d7: true });
  });

  it('knows when a track has no usable 24H window', () => {
    const coarse = hourly(24 * 10).filter((_, i) => i % 8 === 0); // every 8 hours
    expect(availableWindows(coarse).h24).toBe(false);
    expect(availableWindows(coarse).d7).toBe(true);
  });
});
