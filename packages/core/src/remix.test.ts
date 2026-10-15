import { describe, expect, it } from 'vitest';
import { evenSeries, REMIX_TRACKS, remixSeries } from './remix.ts';

describe('remix definitions', () => {
  it('are unique and well formed', () => {
    const ids = REMIX_TRACKS.map((track) => track.sourceId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const track of REMIX_TRACKS) {
      expect(track.drawing.length).toBeGreaterThanOrEqual(2);
      expect(track.spanDays).toBeGreaterThan(0);
      expect(Number.isFinite(Date.parse(`${track.endDate}T00:00:00Z`))).toBe(true);
      for (const p of track.drawing) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  it('carry no invented market numbers', () => {
    // The whole point of the remix kind: a drawing has no volume, no liquidity.
    for (const track of REMIX_TRACKS) {
      expect(track).not.toHaveProperty('volume24h');
      expect(track).not.toHaveProperty('change24h');
      expect(track).not.toHaveProperty('liquidity');
    }
  });

  it('never claims to be a polymarket market', () => {
    for (const track of REMIX_TRACKS) {
      expect(track.sourceId.startsWith('remix-')).toBe(true);
    }
  });
});

describe('evenSeries', () => {
  it('spreads the drawing evenly and ends on the given date', () => {
    const series = evenSeries([0.1, 0.2, 0.3], '2026-10-01', 30);
    const endUnix = Date.parse('2026-10-01T00:00:00Z') / 1000;
    expect(series[series.length - 1].t).toBe(endUnix);
    expect(series[0].t).toBe(endUnix - 30 * 86400);
    expect(series[1].t - series[0].t).toBe(series[2].t - series[1].t);
  });

  it('is deterministic', () => {
    expect(evenSeries([0.1, 0.5], '2022-11-11', 14)).toEqual(evenSeries([0.1, 0.5], '2022-11-11', 14));
  });

  it('refuses an unusable date or a one-point drawing', () => {
    expect(() => evenSeries([0.1, 0.2], 'not-a-date', 14)).toThrow(/end date/);
    expect(() => evenSeries([0.5], '2026-10-01', 14)).toThrow(/at least 2 points/);
  });
});

describe('remixSeries', () => {
  it('keeps every drawn value, in order', () => {
    const track = REMIX_TRACKS[0];
    expect(remixSeries(track).map((point) => point.p)).toEqual(track.drawing);
  });

  it('advances in time', () => {
    const series = remixSeries(REMIX_TRACKS[1]);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].t).toBeGreaterThan(series[i - 1].t);
    }
  });
});
