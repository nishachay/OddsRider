import { describe, expect, it } from 'vitest';
import { difficultyFromStats, computeStats, DIFFICULTY_THRESHOLDS } from './stats.ts';
import type { PricePoint } from './types.ts';

function series(values: number[], stepSeconds = 3600): PricePoint[] {
  return values.map((p, i) => ({ t: 1_700_000_000 + i * stepSeconds, p }));
}

describe('computeStats', () => {
  it('reports nothing for an empty series', () => {
    expect(computeStats([])).toEqual({
      points: 0,
      volatility: 0,
      maxDrop: 0,
      maxRise: 0,
      range: 0,
      spanDays: 0,
    });
  });

  it('measures the extremes of the series', () => {
    const stats = computeStats(series([0.2, 0.5, 0.9, 0.4]));
    expect(stats.maxRise).toBeCloseTo(0.4, 10);
    expect(stats.maxDrop).toBeCloseTo(0.5, 10);
    expect(stats.range).toBeCloseTo(0.7, 10);
    expect(stats.points).toBe(4);
  });

  it('treats a flat series as zero volatility', () => {
    const stats = computeStats(series([0.5, 0.5, 0.5]));
    expect(stats.volatility).toBe(0);
    expect(stats.maxDrop).toBe(0);
    expect(stats.maxRise).toBe(0);
  });

  it('reports the span in days', () => {
    const stats = computeStats(series([0.4, 0.5, 0.6], 86400));
    expect(stats.spanDays).toBeCloseTo(2, 6);
  });
});

describe('difficultyFromStats', () => {
  it('cannot rate fewer than two points', () => {
    expect(difficultyFromStats(computeStats(series([0.5])))).toBe('NEW');
    expect(difficultyFromStats(computeStats([]))).toBe('NEW');
  });

  it('rates calm terrain EASY', () => {
    expect(difficultyFromStats(computeStats(series([0.5, 0.5005, 0.501])))).toBe('EASY');
  });

  it('rates choppy terrain MEDIUM', () => {
    const stats = computeStats(series([0.5, 0.52, 0.51, 0.53, 0.5]));
    expect(stats.volatility).toBeGreaterThanOrEqual(DIFFICULTY_THRESHOLDS.medium);
    expect(difficultyFromStats(stats)).toBe('MEDIUM');
  });

  it('escalates on a single cliff even when the average is calm', () => {
    // 40 deltas, only one of which is non-zero: the average stays calm, so
    // difficulty has to come from the size of the single step.
    const step = (low: number) => {
      const values = Array.from({ length: 41 }, () => 0.9);
      for (let i = 20; i < values.length; i++) values[i] = low;
      return values;
    };

    const cliff = computeStats(series(step(0.7)));
    expect(cliff.volatility).toBeLessThan(DIFFICULTY_THRESHOLDS.insane);
    expect(difficultyFromStats(cliff)).toBe('HARD');

    const collapse = computeStats(series(step(0.5)));
    expect(difficultyFromStats(collapse)).toBe('INSANE');
  });

  it('rates sustained violence INSANE', () => {
    const stats = computeStats(series([0.5, 0.6, 0.45, 0.62, 0.4, 0.7, 0.35, 0.75]));
    expect(difficultyFromStats(stats)).toBe('INSANE');
  });

  it('uses published thresholds, not vibes', () => {
    expect(DIFFICULTY_THRESHOLDS.medium).toBeLessThan(DIFFICULTY_THRESHOLDS.hard);
    expect(DIFFICULTY_THRESHOLDS.hard).toBeLessThan(DIFFICULTY_THRESHOLDS.insane);
    expect(DIFFICULTY_THRESHOLDS.stepHard).toBeLessThan(DIFFICULTY_THRESHOLDS.stepInsane);
  });
});
