import { describe, expect, it } from 'vitest';
import {
  computeDifficulty,
  difficultyFromDelta,
  filterMarketsLocal,
  getBiggestMovers,
  getDailyChallenge,
  simpleHash,
  sparklineRange,
  sparklineToSeries,
  type Difficulty,
  type RideableMarket,
} from './polymarket';

function mk(overrides: Partial<RideableMarket> = {}): RideableMarket {
  return {
    id: 'test-market',
    question: 'Will the test pass?',
    slug: 'test-market',
    volumeNum: 100_000,
    volumeFormatted: '$100K 24H',
    clobTokenId: '11111111111111111111',
    category: 'TECH',
    currentProb: 0.5,
    probDelta: 0.01,
    resolutionDate: 'Open',
    difficulty: 'EASY',
    volatilityLabel: 'SMOOTH HIGHWAY',
    sparkline: [0.4, 0.5, 0.6],
    live: true,
    ...overrides,
  };
}

describe('computeDifficulty', () => {
  const cases: Array<[string, number[], Difficulty]> = [
    ['a single point is unrated', [0.5], 'NEW'],
    ['an empty series is unrated', [], 'NEW'],
    ['1% average steps are EASY', [0.5, 0.51], 'EASY'],
    ['3% average steps are MEDIUM', [0.5, 0.53], 'MEDIUM'],
    ['6% average steps are HARD', [0.5, 0.56], 'HARD'],
    ['20% average steps are INSANE', [0.5, 0.7], 'INSANE'],
  ];

  for (const [name, series, expected] of cases) {
    it(name, () => {
      expect(computeDifficulty(series)).toBe(expected);
    });
  }

  it('averages across the whole series, not just the ends', () => {
    // Flat start and finish, one violent middle jump: the average is what counts.
    expect(computeDifficulty([0.5, 0.5, 0.9, 0.9])).toBe('INSANE');
  });

  it('treats a rise and a fall of the same size as equally rough', () => {
    expect(computeDifficulty([0.5, 0.7])).toBe(computeDifficulty([0.7, 0.5]));
  });
});

describe('difficultyFromDelta', () => {
  it('is unrated without a known 24h delta', () => {
    expect(difficultyFromDelta(null)).toBe('NEW');
  });

  it('buckets by absolute swing', () => {
    expect(difficultyFromDelta(0.05)).toBe('EASY');
    expect(difficultyFromDelta(0.1)).toBe('MEDIUM');
    expect(difficultyFromDelta(0.2)).toBe('HARD');
    expect(difficultyFromDelta(0.4)).toBe('INSANE');
  });

  it('ignores the direction of the swing', () => {
    expect(difficultyFromDelta(-0.4)).toBe(difficultyFromDelta(0.4));
  });
});

describe('sparklineRange', () => {
  it('is zero for a flat or empty series', () => {
    expect(sparklineRange([])).toBe(0);
    expect(sparklineRange([0.5])).toBe(0);
    expect(sparklineRange([0.5, 0.5, 0.5])).toBe(0);
  });

  it('is the distance between the extremes', () => {
    expect(sparklineRange([0.2, 0.5, 0.3])).toBeCloseTo(0.3, 10);
  });
});

describe('simpleHash', () => {
  it('is deterministic', () => {
    expect(simpleHash('2026-10-15')).toBe(simpleHash('2026-10-15'));
  });

  it('is never negative', () => {
    for (const s of ['', 'a', '2026-10-15', 'Will the fixture rate cut land in Q3?']) {
      expect(simpleHash(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it('separates different inputs', () => {
    expect(simpleHash('2026-10-15')).not.toBe(simpleHash('2026-10-16'));
  });
});

describe('getDailyChallenge', () => {
  const live1 = mk({ id: 'a', category: 'POLITICS' });
  const live2 = mk({ id: 'b', category: 'CRYPTO' });
  const legendary = mk({ id: 'c', category: 'LEGENDARY', live: false });
  const pool = [live1, live2, legendary];

  it('gives everyone the same track on the same day', () => {
    const first = getDailyChallenge(pool, '2026-10-15');
    const second = getDailyChallenge(pool, '2026-10-15');
    expect(first?.id).toBe(second?.id);
  });

  it('always picks from the pool', () => {
    for (let day = 1; day <= 28; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      expect(pool).toContain(getDailyChallenge(pool, date));
    }
  });

  it('never features a legendary (historical) track while live ones exist', () => {
    for (let day = 1; day <= 28; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`;
      expect(getDailyChallenge(pool, date)?.category).not.toBe('LEGENDARY');
    }
  });

  it('falls back to legendary tracks when nothing else is rideable', () => {
    expect(getDailyChallenge([legendary], '2026-10-15')?.id).toBe('c');
  });

  it('returns null when there is nothing to ride', () => {
    expect(getDailyChallenge([], '2026-10-15')).toBeNull();
  });
});

describe('getBiggestMovers', () => {
  const flat = mk({ id: 'flat', probDelta: 0.02 });
  const skull = mk({ id: 'skull', probDelta: -0.3 });
  const unknown = mk({ id: 'unknown', probDelta: null });
  const legendary = mk({ id: 'legendary', category: 'LEGENDARY', probDelta: 0.9, live: false });
  const markets = [flat, unknown, skull, legendary];

  it('ranks by absolute swing, biggest first', () => {
    expect(getBiggestMovers(markets, 4).map((m) => m.id)).toEqual(['skull', 'flat']);
  });

  it('never guesses from an unknown delta', () => {
    expect(getBiggestMovers(markets, 4).map((m) => m.id)).not.toContain('unknown');
  });

  it('never treats historical crashes as moving today', () => {
    expect(getBiggestMovers(markets, 4).map((m) => m.id)).not.toContain('legendary');
  });

  it('honours the limit', () => {
    expect(getBiggestMovers(markets, 1).map((m) => m.id)).toEqual(['skull']);
  });

  it('returns nothing when no delta is known', () => {
    expect(getBiggestMovers([unknown, legendary], 4)).toEqual([]);
  });
});

describe('sparklineToSeries', () => {
  it('cannot build a track from nothing', () => {
    expect(sparklineToSeries(null)).toEqual([]);
    expect(sparklineToSeries([])).toEqual([]);
  });

  it('maps every point 1:1 with no smoothing', () => {
    const series = sparklineToSeries([0.2, 0.9, 0.3]);
    expect(series.map((pt) => pt.p)).toEqual([0.2, 0.9, 0.3]);
  });

  it('clamps to the rideable band', () => {
    expect(sparklineToSeries([-1, 2]).map((pt) => pt.p)).toEqual([0.01, 0.99]);
  });

  it('advances time monotonically', () => {
    const series = sparklineToSeries([0.3, 0.4, 0.5, 0.6]);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].t).toBeGreaterThan(series[i - 1].t);
    }
  });
});

describe('filterMarketsLocal', () => {
  const markets = [
    mk({ id: 'btc', question: 'Will Bitcoin close above $150,000?', slug: 'bitcoin-150k', category: 'CRYPTO' }),
    mk({ id: 'fed', question: 'Will rates stay unchanged?', slug: 'fed-hold', category: 'MACRO' }),
  ];

  it('needs a query', () => {
    expect(filterMarketsLocal('   ', markets)).toEqual([]);
  });

  it('matches the question, ignoring case', () => {
    expect(filterMarketsLocal('bitcoin', markets).map((m) => m.id)).toEqual(['btc']);
  });

  it('matches the slug', () => {
    expect(filterMarketsLocal('fed-hold', markets).map((m) => m.id)).toEqual(['fed']);
  });

  it('matches the category', () => {
    expect(filterMarketsLocal('macro', markets).map((m) => m.id)).toEqual(['fed']);
  });

  it('returns nothing for a miss instead of guessing', () => {
    expect(filterMarketsLocal('ethiopia', markets)).toEqual([]);
  });
});
