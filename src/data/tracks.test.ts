import { describe, expect, it } from 'vitest';
import type { TrackSummary } from '@oddsrider/core';
import {
  extractTrackSlug,
  filterTracksLocal,
  formatDate,
  formatVolume,
  getBiggestMovers,
  getDailyChallenge,
  getHomePageData,
  getTitleFeature,
  isLiveList,
  momentumGlyph,
  momentumUp,
  rideIntervalFromParam,
  sameFeed,
  simpleHash,
  toRideableMarket,
  type RideableMarket,
} from './tracks';

const STATS = {
  points: 48,
  volatility: 0.02,
  maxDrop: 0.12,
  maxRise: 0.2,
  range: 0.4,
  spanDays: 30,
};

function summary(overrides: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id: 'track-1',
    version: 1,
    kind: 'live',
    source: 'polymarket',
    sourceId: '100001',
    slug: 'a-market',
    question: 'Will the market do the thing?',
    category: 'TECH',
    status: 'open',
    probability: 0.62,
    change24h: 0.04,
    volume24h: 4_200_000,
    liquidity: null,
    endDate: '2026-12-31T23:59:59Z',
    sparkline: [0.4, 0.5, 0.62],
    stats: STATS,
    difficulty: 'MEDIUM',
    hash: 'a'.repeat(64),
    createdAt: '2026-10-15T00:00:00.000Z',
    ...overrides,
  };
}

function view(overrides: Partial<TrackSummary> = {}): RideableMarket {
  return toRideableMarket(summary(overrides));
}

describe('toRideableMarket', () => {
  it('carries the official frozen facts through unchanged', () => {
    const market = view();
    expect(market.currentProb).toBe(0.62);
    expect(market.probDelta).toBe(0.04);
    expect(market.live).toBe(true);
    expect(market.kind).toBe('live');
    expect(market.volatilityLabel).toBe('ROLLING RIDGES');
    expect(market.sparkline).toEqual([0.4, 0.5, 0.62]);
  });

  it('marks settled tracks as settled, never live', () => {
    const market = view({ kind: 'closed', resolution: 'YES', volume24h: 28_600_000, change24h: -0.99 });
    expect(market.live).toBe(false);
    expect(market.kind).toBe('closed');
    expect(market.resolution).toBe('YES');
    expect(market.volumeFormatted).toBe('$28.6M 24H');
  });

  it('formats volume and dates for display', () => {
    expect(view({ volume24h: 4_200_000 }).volumeFormatted).toBe('$4.2M 24H');
    expect(view({ volume24h: 12_000 }).volumeFormatted).toBe('$12K 24H');
    expect(view({ endDate: '2026-12-31T23:59:59Z' }).resolutionDate).toBe('Dec 31, 2026');
    expect(view({ endDate: null }).resolutionDate).toBe('Open');
  });
});

describe('formatVolume / formatDate', () => {
  it('formats volumes', () => {
    expect(formatVolume(4_200_000)).toBe('$4.2M 24H');
    expect(formatVolume(500)).toBe('$500 24H');
  });

  it('refuses to invent a date', () => {
    expect(formatDate(null)).toBe('Open');
    expect(formatDate('not-a-date')).toBe('Open');
  });
});

describe('simpleHash', () => {
  it('is deterministic and never negative', () => {
    expect(simpleHash('2026-10-15')).toBe(simpleHash('2026-10-15'));
    expect(simpleHash('2026-10-15')).toBeGreaterThanOrEqual(0);
    expect(simpleHash('2026-10-15')).not.toBe(simpleHash('2026-10-16'));
  });
});

describe('momentumUp', () => {
  it('reads 24h direction, never level', () => {
    expect(momentumUp(0.02)).toBe(true);
    expect(momentumUp(-0.3)).toBe(false);
    expect(momentumUp(0)).toBe(true);
  });

  it('defaults unknown deltas to rising, like the terrain renderer', () => {
    expect(momentumUp(null)).toBe(true);
  });
});

describe('momentumGlyph', () => {
  it('gives the colour cue a direction arrow', () => {
    expect(momentumGlyph(0.02)).toBe('↑');
    expect(momentumGlyph(0)).toBe('↑');
    expect(momentumGlyph(-0.3)).toBe('↓');
  });

  it('shows no arrow when the 24h change is unknown — never invents a direction', () => {
    expect(momentumGlyph(null)).toBe('');
    expect(momentumGlyph(undefined)).toBe('');
  });
});

describe('isLiveList', () => {  it('is true only when a live track is listed', () => {
    expect(isLiveList([view(), view({ kind: 'closed', resolution: 'NO' })])).toBe(true);
    expect(isLiveList([view({ kind: 'closed', resolution: 'NO' })])).toBe(false);
    expect(isLiveList([])).toBe(false);
  });
});

describe('getBiggestMovers', () => {
  it('ranks live tracks by absolute swing and never guesses', () => {
    const markets = [
      view({ id: 'flat', change24h: 0.02 }),
      view({ id: 'skull', change24h: -0.3 }),
      view({ id: 'unknown', change24h: null }),
      view({ id: 'settled', kind: 'closed', resolution: 'YES', change24h: -0.99 }),
    ];
    expect(getBiggestMovers(markets, 4).map((m) => m.id)).toEqual(['skull', 'flat']);
    expect(getBiggestMovers(markets, 1).map((m) => m.id)).toEqual(['skull']);
  });
});

describe('getDailyChallenge', () => {
  it('gives everyone the same track on the same day', () => {
    const pool = [view({ id: 'a' }), view({ id: 'b' })];
    expect(getDailyChallenge(pool, '2026-10-15')?.id).toBe(getDailyChallenge(pool, '2026-10-15')?.id);
  });

  it('never headlines a settled track while live tracks exist', () => {
    const pool = [view({ id: 'a' }), view({ id: 's', kind: 'closed', resolution: 'YES' })];
    for (let day = 1; day <= 28; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      expect(getDailyChallenge(pool, date)?.kind).toBe('live');
    }
  });

  it('falls back to settled tracks when nothing live is published', () => {
    const pool = [view({ id: 's', kind: 'closed', resolution: 'YES' })];
    expect(getDailyChallenge(pool, '2026-10-15')?.id).toBe('s');
  });

  it('returns null when there is nothing to ride', () => {
    expect(getDailyChallenge([], '2026-10-15')).toBeNull();
  });
});

describe('getTitleFeature', () => {
  it('differs from the daily pick while choice exists', () => {
    const pool = [view({ id: 'a' }), view({ id: 'b' }), view({ id: 'c' })];
    for (let day = 1; day <= 28; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      expect(getTitleFeature(pool, date)?.id).not.toBe(getDailyChallenge(pool, date)?.id);
      expect(getTitleFeature(pool, date)?.id).toBe(getTitleFeature(pool, date)?.id);
    }
  });

  it('falls back to the only track when there is no choice', () => {
    const pool = [view({ id: 'a' })];
    expect(getTitleFeature(pool, '2026-10-15')?.id).toBe('a');
  });

  it('returns null when there is nothing to ride', () => {
    expect(getTitleFeature([], '2026-10-15')).toBeNull();
  });
});

describe('getHomePageData', () => {
  it('keeps settled tracks out of the trending card', () => {
    const data = getHomePageData([
      view({ id: 'live', volume24h: 100 }),
      view({ id: 's', kind: 'closed', resolution: 'NO', volume24h: 50 }),
    ]);
    expect(data.trending.map((m) => m.id)).toEqual(['live']);
    expect(data.closed.map((m) => m.id)).toEqual(['s']);
    expect(data.live).toBe(true);
  });
});

describe('extractTrackSlug', () => {
  it('matches our own preview and ride links', () => {
    expect(extractTrackSlug('/preview/a-market')).toBe('a-market');
    expect(extractTrackSlug('/ride/a-market?side=no')).toBe('a-market');
  });

  it('matches a pasted Polymarket URL by slug', () => {
    expect(extractTrackSlug('https://polymarket.com/event/a-market')).toBe('a-market');
    expect(extractTrackSlug('https://polymarket.com/market/a-market?foo=1')).toBe('a-market');
  });

  it('returns null for anything else', () => {
    expect(extractTrackSlug('bitcoin')).toBeNull();
    expect(extractTrackSlug('https://example.com/a-market')).toBeNull();
  });
});

describe('filterTracksLocal', () => {
  const markets = [
    view({ id: 'btc', question: 'Will Bitcoin close above $150,000?', slug: 'bitcoin-150k', category: 'CRYPTO' }),
    view({ id: 'fed', question: 'Will rates stay unchanged?', slug: 'fed-hold', category: 'MACRO' }),
  ];

  it('needs a query', () => {
    expect(filterTracksLocal('   ', markets)).toEqual([]);
  });

  it('matches the question, slug and category', () => {
    expect(filterTracksLocal('bitcoin', markets).map((m) => m.id)).toEqual(['btc']);
    expect(filterTracksLocal('fed-hold', markets).map((m) => m.id)).toEqual(['fed']);
    expect(filterTracksLocal('macro', markets).map((m) => m.id)).toEqual(['fed']);
  });

  it('resolves a pasted slug against frozen tracks', () => {
    expect(filterTracksLocal('https://polymarket.com/event/fed-hold', markets).map((m) => m.id)).toEqual([
      'fed',
    ]);
  });

  it('returns nothing for a miss instead of guessing', () => {
    expect(filterTracksLocal('ethiopia', markets)).toEqual([]);
  });
});

describe('rideIntervalFromParam', () => {
  it('accepts the documented windows and defaults to ALL', () => {
    expect(rideIntervalFromParam('24H')).toBe('24H');
    expect(rideIntervalFromParam('7D')).toBe('7D');
    expect(rideIntervalFromParam('ALL')).toBe('ALL');
    expect(rideIntervalFromParam(null)).toBe('ALL');
    expect(rideIntervalFromParam('day')).toBe('ALL');
  });
});

describe('sameFeed', () => {
  it('detects identical and changed feeds', () => {
    const a = [view({ id: 'a' })];
    expect(sameFeed(a, [view({ id: 'a' })])).toBe(true);
    expect(sameFeed(a, [view({ id: 'b' })])).toBe(false);
    expect(sameFeed(a, [view({ id: 'a', probability: 0.7 })])).toBe(false);
    expect(sameFeed(a, [])).toBe(false);
  });
});
