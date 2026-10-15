import { describe, expect, it } from 'vitest';
import { PREVIEW_POINTS, TARGET_POINTS } from './constants.ts';
import {
  buildTrack,
  canonicalSeries,
  clampProbability,
  normalizeSeries,
  sha256Hex,
  slugifyKey,
  trackIdFor,
  type TrackInput,
} from './generate.ts';
import type { PricePoint } from './types.ts';

function input(overrides: Partial<TrackInput> = {}): TrackInput {
  const series: PricePoint[] = Array.from({ length: 50 }, (_, i) => ({
    t: 1_700_000_000 + i * 3600,
    p: 0.4 + i / 500,
  }));
  return {
    kind: 'live',
    source: 'polymarket',
    sourceId: '123456',
    slug: 'a-market',
    question: 'Will the thing happen?',
    category: 'TECH',
    status: 'open',
    probability: 0.5,
    change24h: 0.02,
    volume24h: 1_000_000,
    liquidity: 50_000,
    endDate: '2026-12-31T23:59:59Z',
    series,
    ...overrides,
  };
}

describe('normalizeSeries', () => {
  it('sorts by time', () => {
    const out = normalizeSeries([
      { t: 300, p: 0.3 },
      { t: 100, p: 0.1 },
      { t: 200, p: 0.2 },
    ]);
    expect(out.map((p) => p.t)).toEqual([100, 200, 300]);
  });

  it('drops unusable points instead of guessing', () => {
    const out = normalizeSeries([
      { t: 100, p: 0.5 },
      { t: Number.NaN, p: 0.5 },
      { t: 200, p: Number.POSITIVE_INFINITY },
      { t: 0, p: 0.5 },
      { t: 300, p: 0.5 },
    ]);
    expect(out.map((p) => p.t)).toEqual([100, 300]);
  });

  it('keeps the last value per timestamp', () => {
    const out = normalizeSeries([
      { t: 100, p: 0.5 },
      { t: 100, p: 0.7 },
    ]);
    expect(out).toEqual([{ t: 100, p: 0.7 }]);
  });

  it('clamps to the rideable band', () => {
    const out = normalizeSeries([
      { t: 100, p: -5 },
      { t: 200, p: 5 },
    ]);
    expect(out).toEqual([
      { t: 100, p: 0.01 },
      { t: 200, p: 0.99 },
    ]);
  });
});

describe('clampProbability', () => {
  it('never lets a track touch the rails', () => {
    expect(clampProbability(0)).toBe(0.01);
    expect(clampProbability(1)).toBe(0.99);
    expect(clampProbability(Number.NaN)).toBe(0.01);
    expect(clampProbability(0.5)).toBe(0.5);
  });
});

describe('sha256Hex', () => {
  it('matches the known digest of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('canonicalSeries', () => {
  it('is stable against float noise in the last digits', () => {
    const a = canonicalSeries([{ t: 1, p: 0.1234567 }]);
    const b = canonicalSeries([{ t: 1, p: 0.12345670001 }]);
    expect(a).toBe(b);
  });

  it('changes when the shape changes', () => {
    const a = canonicalSeries([{ t: 1, p: 0.1 }, { t: 2, p: 0.2 }]);
    const b = canonicalSeries([{ t: 1, p: 0.1 }, { t: 2, p: 0.3 }]);
    expect(a).not.toBe(b);
  });
});

describe('trackIdFor / slugifyKey', () => {
  it('produces a readable, safe id', () => {
    expect(slugifyKey('Will BTC hit 100k? (2026)')).toBe('will-btc-hit-100k-2026');
    expect(trackIdFor('live', '123456', 'a'.repeat(64))).toBe('123456-aaaaaaaaaaaa');
  });

  it('marks remix tracks in the id', () => {
    expect(trackIdFor('remix', 'btc-crash', 'b'.repeat(64))).toBe('remix-btc-crash-bbbbbbbbbbbb');
  });

  it('never doubles the remix prefix', () => {
    expect(trackIdFor('remix', 'remix-btc', 'b'.repeat(64))).toBe('remix-btc-bbbbbbbbbbbb');
  });

  it('never returns an empty key', () => {
    expect(trackIdFor('live', '!!!', 'c'.repeat(64))).toBe('market-cccccccccccc');
  });
});

describe('buildTrack', () => {
  it('is deterministic: same series, same id and hash', async () => {
    const a = await buildTrack(input(), '2026-10-01T00:00:00.000Z');
    const b = await buildTrack(input(), '2026-10-01T00:00:00.000Z');
    expect(a.id).toBe(b.id);
    expect(a.hash).toBe(b.hash);
    expect(a.series).toEqual(b.series);
  });

  it('gives a different id when the market moves', async () => {
    const a = await buildTrack(input());
    const moved = input({
      series: Array.from({ length: 50 }, (_, i) => ({ t: 1_700_000_000 + i * 3600, p: 0.2 + i / 500 })),
    });
    const b = await buildTrack(moved);
    expect(a.id).not.toBe(b.id);
  });

  it('caps the series at TARGET_POINTS while keeping the ends', async () => {
    const long = input({
      series: Array.from({ length: 5_000 }, (_, i) => ({
        t: 1_700_000_000 + i * 600,
        p: 0.3 + Math.sin(i / 40) / 4,
      })),
    });
    const track = await buildTrack(long);
    expect(track.series).toHaveLength(TARGET_POINTS);
    expect(track.series[0].t).toBe(1_700_000_000);
  });

  it('records the official facts unchanged', async () => {
    const track = await buildTrack(
      input({ probability: 0.62, change24h: -0.11, volume24h: 4_200_000, liquidity: null }),
    );
    expect(track.probability).toBe(0.62);
    expect(track.change24h).toBe(-0.11);
    expect(track.volume24h).toBe(4_200_000);
    expect(track.liquidity).toBeNull();
    expect(track.version).toBe(1);
  });

  it('derives difficulty and stats from the frozen series only', async () => {
    const track = await buildTrack(input());
    expect(track.stats.points).toBe(track.series.length);
    expect(['EASY', 'MEDIUM', 'HARD', 'INSANE']).toContain(track.difficulty);
  });

  it('ships a real downsampled preview, never invented', async () => {
    const track = await buildTrack(input());
    expect(track.sparkline.length).toBeGreaterThanOrEqual(2);
    expect(track.sparkline.length).toBeLessThanOrEqual(PREVIEW_POINTS);
    // Every preview value comes from the frozen series.
    for (const p of track.sparkline) {
      expect(track.series.map((pt) => pt.p)).toContain(p);
    }
    expect(track.sparkline[0]).toBe(track.series[0].p);
    expect(track.sparkline[track.sparkline.length - 1]).toBe(
      track.series[track.series.length - 1].p,
    );
  });

  it('refuses to build a track from nothing', async () => {
    await expect(buildTrack(input({ series: [] }))).rejects.toThrow(/cannot build a track/);
    await expect(buildTrack(input({ series: [{ t: 1, p: 0.5 }] }))).rejects.toThrow(/cannot build a track/);
  });
});
