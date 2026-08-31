export interface PricePoint {
  t: number;
  p: number;
}

export interface RideableMarket {
  id: string;
  question: string;
  slug: string;
  volumeNum: number;
  clobTokenId: string;
}

export interface Ride {
  market: RideableMarket;
  series: PricePoint[];
}

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const CACHE_KEY = 'oddsrider_cached_ride_v2';

export const MARKET_FILTERS = {
  minVolume: 25_000,
  minPoints: 30,
  minRange: 0.08,
  interval: 'max',
  fidelity: 60,
} as const;

// High-fidelity fallback dataset for instant zero-latency start
const FALLBACK_RIDES: Ride[] = [
  {
    market: {
      id: 'fed-rate-cut-fallback',
      question: 'Will there be no change in Fed interest rates after the September 2026 meeting?',
      slug: 'fed-rate-cut',
      volumeNum: 8900000,
      clobTokenId: 'fed-token-1',
    },
    series: generateFallbackSeries(0.12, 0.76, 100),
  },
  {
    market: {
      id: 'btc-100k-fallback',
      question: 'Will Bitcoin reach $100,000 before end of year?',
      slug: 'btc-100k',
      volumeNum: 14200000,
      clobTokenId: 'btc-token-1',
    },
    series: generateFallbackSeries(0.22, 0.94, 100),
  },
  {
    market: {
      id: 'us-gdp-fallback',
      question: 'Will US GDP growth exceed 3.0% annualized rate?',
      slug: 'gdp-growth',
      volumeNum: 6200000,
      clobTokenId: 'gdp-token-1',
    },
    series: generateFallbackSeries(0.15, 0.78, 100),
  },
];

function generateFallbackSeries(startP: number, peakP: number, points: number): PricePoint[] {
  const series: PricePoint[] = [];
  const baseTime = Date.now() - 30 * 24 * 3600 * 1000;
  let currentP = startP;

  for (let i = 0; i < points; i++) {
    const t = baseTime + i * (30 * 24 * 3600 * 1000 / points);
    const wave1 = Math.sin((i / points) * Math.PI * 3) * 0.18;
    const wave2 = Math.cos((i / points) * Math.PI * 5) * 0.09;
    const trend = (i / points) * (peakP - startP);
    currentP = Math.max(0.05, Math.min(0.95, startP + trend + wave1 + wave2));
    series.push({ t, p: currentP });
  }
  return series;
}

type GammaMarket = {
  id: string;
  question: string;
  slug: string;
  volumeNum?: number;
  outcomes?: string;
  clobTokenIds?: string;
};

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Fast timeout wrapper
function fetchWithTimeout(url: string, ms = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

export async function fetchRideableMarkets(limit = 8): Promise<RideableMarket[]> {
  try {
    const url = `${GAMMA}/markets?limit=${limit * 2}&active=true&closed=false&order=volume24hr&ascending=false`;
    const res = await fetchWithTimeout(url, 2500);
    if (!res.ok) throw new Error(`gamma ${res.status}`);
    const rows = (await res.json()) as GammaMarket[];
    const markets: RideableMarket[] = [];

    for (const row of rows) {
      const volumeNum = typeof row.volumeNum === 'number' ? row.volumeNum : 0;
      if (volumeNum < MARKET_FILTERS.minVolume) continue;
      const outcomes = parseJsonArray(row.outcomes);
      const tokens = parseJsonArray(row.clobTokenIds);
      if (outcomes.length < 2 || tokens.length < 2) continue;
      const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === 'yes');
      if (yesIndex < 0) continue;

      markets.push({
        id: row.id,
        question: row.question,
        slug: row.slug,
        volumeNum,
        clobTokenId: tokens[yesIndex],
      });
      if (markets.length >= limit) break;
    }
    return markets.length > 0 ? markets : FALLBACK_RIDES.map((r) => r.market);
  } catch {
    return FALLBACK_RIDES.map((r) => r.market);
  }
}

export async function fetchPriceHistory(
  clobTokenId: string,
  interval: string = MARKET_FILTERS.interval,
  fidelity: number = MARKET_FILTERS.fidelity,
): Promise<PricePoint[]> {
  const res = await fetchWithTimeout(
    `${CLOB}/prices-history?market=${clobTokenId}&interval=${interval}&fidelity=${fidelity}`,
    2500,
  );
  if (!res.ok) throw new Error(`clob ${res.status}`);
  const data = (await res.json()) as { history?: PricePoint[] };
  const history = data.history ?? [];
  if (history.length < 15) throw new Error('empty history');
  return history.slice().sort((a, b) => a.t - b.t);
}

function percentileRange(series: PricePoint[]): number {
  const ps = series.map((pt) => pt.p).sort((a, b) => a - b);
  if (ps.length === 0) return 0;
  const lo = ps[Math.floor((ps.length - 1) * 0.05)];
  const hi = ps[Math.floor((ps.length - 1) * 0.95)];
  return hi - lo;
}

export function isRideableSeries(series: PricePoint[]): boolean {
  if (series.length < MARKET_FILTERS.minPoints) return false;
  return percentileRange(series) >= MARKET_FILTERS.minRange;
}

// Instant Fast-Path Loader with Parallel Polling & LocalStorage Cache
export async function fetchRide(): Promise<Ride> {
  // 1. Check in-memory / local cache for instant boot
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr) as Ride;
      if (cached?.series?.length > 20) {
        // Trigger background refresh silently and return cache immediately
        refreshRideInBackground();
        return cached;
      }
    }
  } catch {
    // Ignore storage parse error
  }

  // 2. Fast Concurrent Fetch (Top 4 candidates in parallel)
  try {
    const candidates = await fetchRideableMarkets(4);
    const results = await Promise.all(
      candidates.map(async (market) => {
        try {
          const series = await fetchPriceHistory(market.clobTokenId);
          return { market, series };
        } catch {
          return null;
        }
      }),
    );

    for (const item of results) {
      if (item && isRideableSeries(item.series)) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(item));
        } catch {
          // Ignore storage quota
        }
        return item;
      }
    }
  } catch (err) {
    console.warn('Fast-path fallback engaged:', err);
  }

  // 3. Instant Fallback
  const fallback = FALLBACK_RIDES[Math.floor(Math.random() * FALLBACK_RIDES.length)];
  return fallback;
}

async function refreshRideInBackground() {
  try {
    const candidates = await fetchRideableMarkets(3);
    for (const market of candidates) {
      try {
        const series = await fetchPriceHistory(market.clobTokenId);
        if (isRideableSeries(series)) {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ market, series }));
          break;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Silent fail in background
  }
}
