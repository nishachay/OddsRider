import { describe, expect, it } from 'vitest';
import { buildTrack, type TrackInput } from './generate.ts';
import { parseTrack, parseTrackIndex, safeParseTrack } from './schemas.ts';
import type { PricePoint } from './types.ts';

const series: PricePoint[] = Array.from({ length: 20 }, (_, i) => ({
  t: 1_700_000_000 + i * 3600,
  p: 0.4 + i / 200,
}));

function input(overrides: Partial<TrackInput> = {}): TrackInput {
  return {
    kind: 'live',
    source: 'polymarket',
    sourceId: '1',
    slug: 'a-market',
    question: 'Will the thing happen?',
    category: 'TECH',
    status: 'open',
    probability: 0.5,
    change24h: 0.01,
    volume24h: 100_000,
    liquidity: null,
    endDate: null,
    series,
    ...overrides,
  };
}

describe('track schemas', () => {
  it('accepts a freshly generated track', async () => {
    const track = await buildTrack(input());
    expect(parseTrack(track).id).toBe(track.id);
  });

  it('rejects a truncated series', async () => {
    const track = await buildTrack(input());
    expect(() => parseTrack({ ...track, series: [track.series[0]] })).toThrow();
  });

  it('rejects a probability outside the rideable band', async () => {
    const track = await buildTrack(input());
    expect(() => parseTrack({ ...track, probability: 1.2 })).toThrow();
    expect(() => parseTrack({ ...track, series: [{ t: 1, p: 1.5 }] })).toThrow();
  });

  it('rejects an id without a real sha256', async () => {
    const track = await buildTrack(input());
    expect(() => parseTrack({ ...track, hash: 'not-a-hash' })).toThrow(/sha256/);
  });

  it('rejects an unknown version or kind', async () => {
    const track = await buildTrack(input());
    expect(() => parseTrack({ ...track, version: 2 })).toThrow();
    expect(() => parseTrack({ ...track, kind: 'invented' })).toThrow();
  });

  it('reports failure instead of silently dropping a bad summary', async () => {
    const track = await buildTrack(input());
    expect(safeParseTrack(track)).not.toBeNull();
    expect(safeParseTrack({ ...track, id: '' })).toBeNull();
  });

  it('validates a whole index', async () => {
    const track = await buildTrack(input());
    const { series: _series, ...summary } = track;
    const index = parseTrackIndex({
      version: 1,
      generatedAt: track.createdAt,
      tracks: [summary],
    });
    expect(index.tracks).toHaveLength(1);
    expect(() => parseTrackIndex({ version: 1, generatedAt: 'x', tracks: [{}] })).toThrow();
  });
});
