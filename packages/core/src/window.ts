/**
 * Frozen-series windows.
 *
 * The series itself is immutable; a window is just a trailing slice of it, so
 * no data is ever invented by picking 24H or 7D. When a window is too thin to
 * make a track (fewer than MIN_WINDOW_POINTS points) the full frozen series is
 * returned instead, and the UI already reports the real point count.
 */
import type { PricePoint, RideInterval, TrackWindows } from './types.ts';
import { MIN_WINDOW_POINTS } from './constants.ts';

export const WINDOW_SECONDS: Record<'h24' | 'd7', number> = {
  h24: 86400,
  d7: 7 * 86400,
};

export function windowSeconds(interval: RideInterval): number | null {
  if (interval === '24H') return WINDOW_SECONDS.h24;
  if (interval === '7D') return WINDOW_SECONDS.d7;
  return null;
}

export function tailWindow(series: PricePoint[], seconds: number): PricePoint[] {
  if (series.length === 0) return [];
  const cutoff = series[series.length - 1].t - seconds;
  return series.filter((point) => point.t >= cutoff);
}

export function sliceSeries(series: PricePoint[], interval: RideInterval): PricePoint[] {
  const seconds = windowSeconds(interval);
  if (seconds === null) return series;
  const windowed = tailWindow(series, seconds);
  return windowed.length >= MIN_WINDOW_POINTS ? windowed : series;
}

/** Which trailing windows this frozen series can actually support. */
export function availableWindows(series: PricePoint[]): TrackWindows {
  return {
    h24: tailWindow(series, WINDOW_SECONDS.h24).length >= MIN_WINDOW_POINTS,
    d7: tailWindow(series, WINDOW_SECONDS.d7).length >= MIN_WINDOW_POINTS,
  };
}
