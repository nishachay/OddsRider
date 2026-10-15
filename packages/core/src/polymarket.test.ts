import { describe, expect, it } from 'vitest';
import gammaFixtures from '../fixtures/gamma-markets.json';
import clobFixtures from '../fixtures/clob-history.json';
import {
  categoryFromTags,
  createPolymarketSource,
  extractMarketRows,
  isRideableMarket,
  DEFAULT_RIDEABLE_FILTERS,
  parseListish,
  parseNumberish,
  parseProbability,
  resolutionFromClose,
  selectRideableMarkets,
  toSourceMarket,
  type FetchImpl,
} from './polymarket.ts';
import type { PricePoint } from './types.ts';

const rows = gammaFixtures as unknown[];
const histories = clobFixtures as Record<string, PricePoint[]>;

function market(index = 0) {
  const parsed = toSourceMarket(rows[index]);
  if (!parsed) throw new Error(`fixture ${index} did not parse`);
  return parsed;
}

const yesToken = (index = 0): string => parseListish((rows[index] as { clobTokenIds: string }).clobTokenIds)[0];

describe('parseProbability', () => {
  it('reads fractions, percents and strings', () => {
    expect(parseProbability(0.62)).toBe(0.62);
    expect(parseProbability('0.62')).toBe(0.62);
    expect(parseProbability(62)).toBe(0.62);
    expect(parseProbability('62%')).toBe(0.62);
  });

  it('refuses nonsense instead of guessing', () => {
    expect(parseProbability('abc')).toBeNull();
    expect(parseProbability(undefined)).toBeNull();
    expect(parseProbability(null)).toBeNull();
  });
});

describe('parseNumberish', () => {
  it('reads plain numbers and currency strings', () => {
    expect(parseNumberish(4200000)).toBe(4200000);
    expect(parseNumberish('4,200,000')).toBe(4200000);
    expect(parseNumberish('$1.5')).toBe(1.5);
    expect(parseNumberish('n/a')).toBeNull();
  });
});

describe('parseListish', () => {
  it('handles the JSON-encoded strings Gamma actually sends', () => {
    expect(parseListish('["Yes","No"]')).toEqual(['Yes', 'No']);
  });

  it('handles real arrays and garbage', () => {
    expect(parseListish(['A'])).toEqual(['A']);
    expect(parseListish('not json')).toEqual([]);
    expect(parseListish(undefined)).toEqual([]);
  });
});

describe('extractMarketRows', () => {
  it('accepts a bare array', () => {
    expect(extractMarketRows([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it('flattens an events payload', () => {
    expect(extractMarketRows({ events: [{ markets: [{ id: 1 }, { id: 2 }] }] })).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it('flattens events nested inside an array response', () => {
    // `/events?slug=` returns `[event]` — the event itself is not a market.
    expect(
      extractMarketRows([{ id: 9, title: 'An event', markets: [{ id: 1 }, { id: 2 }] }]),
    ).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('returns nothing for an unusable payload', () => {
    expect(extractMarketRows({ nope: true })).toEqual([]);
    expect(extractMarketRows('nope')).toEqual([]);
  });
});

describe('toSourceMarket', () => {
  it('maps a fixture row', () => {
    const parsed = market(0);
    expect(parsed.sourceId).toBe('100001');
    expect(parsed.probability).toBeCloseTo(0.62, 6);
    expect(parsed.volume24h).toBe(4_200_000);
    expect(parsed.change24h).toBeCloseTo(0.04, 6);
    expect(parsed.yesTokenId).toBe(yesToken(0));
    expect(parsed.status).toBe('open');
  });

  it('keeps raw source ids for later (plan §8)', () => {
    expect(market(1).externalIds.noTokenId).toBeTruthy();
  });

  it('rejects multi-outcome markets', () => {
    expect(
      toSourceMarket({
        id: '1',
        question: 'Who wins?',
        slug: 'who-wins',
        outcomes: '["A","B","C"]',
        outcomePrices: '["0.4","0.3","0.3"]',
        clobTokenIds: '["1","2","3"]',
      }),
    ).toBeNull();
  });

  it('rejects markets with no YES leg', () => {
    expect(
      toSourceMarket({
        id: '1',
        question: 'Which way?',
        slug: 'which-way',
        outcomes: '["Up","Down"]',
        outcomePrices: '["0.4","0.6"]',
        clobTokenIds: '["1","2"]',
      }),
    ).toBeNull();
  });

  it('rejects a row without a usable price', () => {
    expect(
      toSourceMarket({
        id: '1',
        question: 'Will it?',
        slug: 'will-it',
        outcomes: '["Yes","No"]',
        outcomePrices: '["abc","def"]',
        clobTokenIds: '["1","2"]',
      }),
    ).toBeNull();
  });

  it('leaves an unknown 24h change as null rather than guessing', () => {
    const parsed = toSourceMarket({
      id: '9',
      question: 'Will the feed work?',
      slug: 'will-the-feed-work',
      outcomes: '["Yes","No"]',
      outcomePrices: '["0.5","0.5"]',
      clobTokenIds: '["1","2"]',
      volume24hr: 100_000,
    });
    expect(parsed?.change24h).toBeNull();
  });
});

describe('categoryFromTags', () => {
  it('prefers explicit source tags', () => {
    expect(categoryFromTags(['Crypto'], 'Will it rain?')).toBe('CRYPTO');
    expect(categoryFromTags(['Politics'], 'Will ETH pump?')).toBe('POLITICS');
  });

  it('falls back to whole-word categorisation', () => {
    expect(categoryFromTags([], 'Will the Fed cut rates?')).toBe('MACRO');
    expect(categoryFromTags(['Unknown Tag'], 'Will Ethiopia hold elections?')).toBe('POLITICS');
  });
});

describe('rideability filters', () => {
  it('accepts the fixture markets', () => {
    expect(selectRideableMarkets([market(0), market(1)])).toHaveLength(2);
  });

  it('rejects flat markets near the rails', () => {
    expect(isRideableMarket({ ...market(0), probability: 0.01 })).toBe(false);
    expect(isRideableMarket({ ...market(0), probability: 0.99 })).toBe(false);
  });

  it('rejects illiquid markets', () => {
    expect(isRideableMarket({ ...market(0), volume24h: DEFAULT_RIDEABLE_FILTERS.minVolume24h - 1 })).toBe(false);
    expect(isRideableMarket({ ...market(0), volume24h: null })).toBe(false);
  });

  it('rejects closed markets and missing tokens', () => {
    expect(isRideableMarket({ ...market(0), status: 'closed' })).toBe(false);
    expect(isRideableMarket({ ...market(0), yesTokenId: null })).toBe(false);
  });
});

describe('createPolymarketSource (recorded fixtures, no live calls)', () => {
  const calls: string[] = [];
  const fetchImpl: FetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/markets')) return { ok: true, status: 200, json: async () => rows };
    const token = new URL(url).searchParams.get('market');
    return { ok: true, status: 200, json: async () => ({ history: histories[token ?? ''] ?? [] }) };
  };
  const source = createPolymarketSource({ fetchImpl, attempts: 1 });

  it('lists trending markets from the recorded payload', async () => {
    const markets = await source.listTrending(24);
    expect(markets).toHaveLength(2);
    expect(markets[0].sourceId).toBe('100001');
    expect(calls[0]).toContain('/markets?active=true&closed=false&order=volume24hr');
  });

  it('reads price history for a market token', async () => {
    const history = await source.getHistory(market(0));
    expect(history).toHaveLength(48);
    expect(calls[calls.length - 1]).toContain('/prices-history');
  });

  it('returns no history when a market has no token', async () => {
    expect(await source.getHistory({ ...market(0), yesTokenId: null })).toEqual([]);
  });

  it('surfaces an upstream failure instead of inventing data', async () => {
    const failing = createPolymarketSource({
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
      attempts: 1,
    });
    await expect(failing.listTrending(5)).rejects.toThrow(/HTTP 503/);
  });

  it('tolerates a malformed history payload', async () => {
    const weird = createPolymarketSource({
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ history: 'nope' }) }),
      attempts: 1,
    });
    expect(await weird.getHistory(market(0))).toEqual([]);
  });

  it('resolves a slug through both the events and markets endpoints', async () => {
    const markets = await source.listBySlug('a-market');
    expect(markets.length).toBeGreaterThan(0);
    expect(calls.some((url) => url.includes('/events?slug=a-market'))).toBe(true);
    expect(calls.some((url) => url.includes('/markets?slug=a-market'))).toBe(true);
  });

  it('returns nothing when a slug resolves nowhere', async () => {
    const empty = createPolymarketSource({
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => [] }),
      attempts: 1,
    });
    expect(await empty.listBySlug('no-such-market')).toEqual([]);
  });
});

describe('resolutionFromClose', () => {
  it('calls the rails, never the middle', () => {
    expect(resolutionFromClose(1)).toBe('YES');
    expect(resolutionFromClose(0.995)).toBe('YES');
    expect(resolutionFromClose(0)).toBe('NO');
    expect(resolutionFromClose(0.005)).toBe('NO');
    expect(resolutionFromClose(0.62)).toBeNull();
    expect(resolutionFromClose(0.5)).toBeNull();
    expect(resolutionFromClose(null)).toBeNull();
    expect(resolutionFromClose(Number.NaN)).toBeNull();
  });
});
