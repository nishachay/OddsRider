/**
 * Track statistics and difficulty. All thresholds live here, in one place, so
 * labels stay auditable and testable.
 */
import type { Difficulty, PricePoint, TrackStats } from './types.ts';

/**
 * Difficulty comes from how rough the terrain is, not from how big the market
 * is. `volatility` is the population standard deviation of step deltas; a
 * single violent cliff escalates to HARD/INSANE on its own, because one drop
 * is what makes a track memorable.
 */
export const DIFFICULTY_THRESHOLDS = {
  /** volatility >= this => at least MEDIUM */
  medium: 0.01,
  /** volatility >= this => at least HARD */
  hard: 0.025,
  /** volatility >= this => INSANE */
  insane: 0.05,
  /** a single step of this size => at least HARD, regardless of the average */
  stepHard: 0.15,
  /** a single step of this size => INSANE, regardless of the average */
  stepInsane: 0.3,
} as const;

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: 'SMOOTH HIGHWAY',
  MEDIUM: 'ROLLING RIDGES',
  HARD: 'STEEP CLIMBS',
  INSANE: 'CLIFF COUNTRY',
  NEW: 'UNRATED TRACK',
};

export function computeStats(series: PricePoint[]): TrackStats {
  const points = series.length;
  if (points === 0) {
    return { points: 0, volatility: 0, maxDrop: 0, maxRise: 0, range: 0, spanDays: 0 };
  }

  let maxDrop = 0;
  let maxRise = 0;
  let lowest = series[0].p;
  let highest = series[0].p;

  const deltas: number[] = [];
  for (let i = 1; i < points; i++) {
    const delta = series[i].p - series[i - 1].p;
    deltas.push(delta);
    if (-delta > maxDrop) maxDrop = -delta;
    if (delta > maxRise) maxRise = delta;
    if (series[i].p < lowest) lowest = series[i].p;
    if (series[i].p > highest) highest = series[i].p;
  }

  const mean = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const variance =
    deltas.length > 0
      ? deltas.reduce((acc, d) => acc + (d - mean) ** 2, 0) / deltas.length
      : 0;

  const spanSeconds = series[points - 1].t - series[0].t;

  return {
    points,
    volatility: Math.sqrt(variance),
    maxDrop,
    maxRise,
    range: highest - lowest,
    spanDays: spanSeconds > 0 ? spanSeconds / 86400 : 0,
  };
}

export function difficultyFromStats(stats: TrackStats): Difficulty {
  if (stats.points < 2) return 'NEW';

  const { volatility, maxDrop, maxRise } = stats;
  const worstStep = Math.max(maxDrop, maxRise);

  if (worstStep >= DIFFICULTY_THRESHOLDS.stepInsane || volatility >= DIFFICULTY_THRESHOLDS.insane) {
    return 'INSANE';
  }
  if (worstStep >= DIFFICULTY_THRESHOLDS.stepHard || volatility >= DIFFICULTY_THRESHOLDS.hard) {
    return 'HARD';
  }
  if (volatility >= DIFFICULTY_THRESHOLDS.medium) return 'MEDIUM';
  return 'EASY';
}
