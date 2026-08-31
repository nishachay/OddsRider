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
  category?: 'CRYPTO' | 'POLITICS' | 'MACRO' | 'TECH' | 'OTHER';
}

export interface LobbyMarket extends RideableMarket {
  currentProb: number;
  probDelta: number;
  volatilityLabel: string;
  sparkline: number[];
}

export interface Ride {
  market: RideableMarket;
  series: PricePoint[];
}

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const CACHE_KEY = 'oddsrider_cached_ride_v2';
const LOBBY_CACHE_KEY = 'oddsrider_lobby_markets_v1';

export const MARKET_FILTERS = {
  minVolume: 25_000,
  minPoints: 30,
  minRange: 0.08,
  interval: 'max',
  fidelity: 60,
} as const;

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

export const FALLBACK_RIDES: Ride[] = [
  {
    market: {
      id: 'btc-100k-fallback',
      question: 'Will Bitcoin reach $100,000 before end of year?',
      slug: 'btc-100k',
      volumeNum: 14200000,
      clobTokenId: 'btc-token-1',
      category: 'CRYPTO',
    },
    series: generateFallbackSeries(0.22, 0.94, 100),
  },
  {
    market: {
      id: 'fed-rate-cut-fallback',
      question: 'Will there be no change in Fed interest rates after the September 2026 meeting?',
      slug: 'fed-rate-cut',
      volumeNum: 8900000,
      clobTokenId: 'fed-token-1',
      category: 'MACRO',
    },
    series: generateFallbackSeries(0.12, 0.76, 100),
  },
  {
    market: {
      id: 'us-gdp-fallback',
      question: 'Will US GDP growth exceed 3.0% annualized rate?',
      slug: 'gdp-growth',
      volumeNum: 6200000,
      clobTokenId: 'gdp-token-1',
      category: 'MACRO',
    },
    series: generateFallbackSeries(0.15, 0.78, 100),
  },
  {
    market: {
      id: 'sol-300-fallback',
      question: 'Will Solana reach $300 in 2026?',
      slug: 'solana-300',
      volumeNum: 5100000,
      clobTokenId: 'sol-token-1',
      category: 'CRYPTO',
    },
    series: generateFallbackSeries(0.35, 0.68, 100),
  },
  {
    market: {
      id: 'pres-elect-fallback',
      question: 'Will the Republican nominee win the 2028 Presidential Election?',
      slug: 'presidential-election-2028',
      volumeNum: 21500000,
      clobTokenId: 'pres-token-1',
      category: 'POLITICS',
    },
    series: generateFallbackSeries(0.48, 0.53, 100),
  },
  {
    market: {
      id: 'openai-gpt5-fallback',
      question: 'Will OpenAI announce GPT-5 before December 2026?',
      slug: 'openai-gpt5',
      volumeNum: 3800000,
      clobTokenId: 'gpt5-token-1',
      category: 'TECH',
    },
    series: generateFallbackSeries(0.60, 0.88, 100),
  },
];

function categorizeQuestion(q: string): 'CRYPTO' | 'POLITICS' | 'MACRO' | 'TECH' | 'OTHER' {
  const s = q.toLowerCase();
  if (s.includes('btc') || s.includes('bitcoin') || s.includes('eth') || s.includes('sol') || s.includes('crypto') || s.includes('token') || s.includes('doge')) {
    return 'CRYPTO';
  }
  if (s.includes('election') || s.includes('trump') || s.includes('president') || s.includes('senate') || s.includes('kamala') || s.includes('biden') || s.includes('nominee')) {
    return 'POLITICS';
  }
  if (s.includes('fed') || s.includes('rate') || s.includes('gdp') || s.includes('inflation') || s.includes('cpi') || s.includes('tariff') || s.includes('recession')) {
    return 'MACRO';
  }
  if (s.includes('ai') || s.includes('openai') || s.includes('gpt') || s.includes('apple') || s.includes('google') || s.includes('nvidia') || s.includes('claude')) {
    return 'TECH';
  }
  return 'OTHER';
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

function fetchWithTimeout(url: string, ms = 2500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

export async function fetchRideableMarkets(limit = 12): Promise<RideableMarket[]> {
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
        category: categorizeQuestion(row.question),
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

// Fetch Full Lobby Feed of Rich Cards
export async function fetchLobbyMarkets(): Promise<LobbyMarket[]> {
  // Check local storage cache
  try {
    const cached = localStorage.getItem(LOBBY_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as LobbyMarket[];
      if (parsed.length >= 4) return parsed;
    }
  } catch {
    // Ignore
  }

  try {
    const rawMarkets = await fetchRideableMarkets(8);
    const results = await Promise.all(
      rawMarkets.map(async (m) => {
        try {
          const series = await fetchPriceHistory(m.clobTokenId);
          if (!series || series.length < 10) return null;
          const currentProb = series[series.length - 1].p;
          const startProb = series[0].p;
          const probDelta = currentProb - startProb;
          const range = percentileRange(series);

          let volatilityLabel = 'SMOOTH STRAIGHTAWAYS';
          if (range > 0.4) volatilityLabel = 'EXTREME CLIFF JUMPS';
          else if (range > 0.25) volatilityLabel = 'STEEP HILL CLIMBS';
          else if (range > 0.12) volatilityLabel = 'MODERATE WAVE ROLLS';

          // Sample 16 sparkline points
          const stride = Math.max(1, Math.floor(series.length / 16));
          const sparkline = series.filter((_, i) => i % stride === 0).map((s) => s.p);

          return {
            ...m,
            currentProb,
            probDelta,
            volatilityLabel,
            sparkline,
          } as LobbyMarket;
        } catch {
          return null;
        }
      }),
    );

    const valid = results.filter((r): r is LobbyMarket => r !== null);
    if (valid.length >= 3) {
      try {
        localStorage.setItem(LOBBY_CACHE_KEY, JSON.stringify(valid));
      } catch {
        // Ignore
      }
      return valid;
    }
  } catch (e) {
    console.warn('Lobby fetch error:', e);
  }

  // Fallback Lobby Data
  return FALLBACK_RIDES.map((r) => {
    const series = r.series;
    const currentProb = series[series.length - 1].p;
    const startProb = series[0].p;
    const stride = Math.max(1, Math.floor(series.length / 16));
    return {
      ...r.market,
      currentProb,
      probDelta: currentProb - startProb,
      volatilityLabel: 'MODERATE WAVE ROLLS',
      sparkline: series.filter((_, i) => i % stride === 0).map((s) => s.p),
    };
  });
}

// Fetch Specific Ride by Market
export async function fetchRideForMarket(market: RideableMarket): Promise<Ride> {
  try {
    const series = await fetchPriceHistory(market.clobTokenId);
    if (series && series.length >= 15) {
      return { market, series };
    }
  } catch (err) {
    console.warn('Failed to fetch series for market, using fallback curve:', err);
  }
  return {
    market,
    series: generateFallbackSeries(0.2, 0.85, 100),
  };
}

export async function fetchRide(): Promise<Ride> {
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr) as Ride;
      if (cached?.series?.length > 20) {
        return cached;
      }
    }
  } catch {
    // Ignore
  }

  try {
    const candidates = await fetchRideableMarkets(4);
    for (const market of candidates) {
      try {
        const series = await fetchPriceHistory(market.clobTokenId);
        if (isRideableSeries(series)) {
          const item = { market, series };
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(item));
          } catch {}
          return item;
        }
      } catch {}
    }
  } catch {}

  return FALLBACK_RIDES[0];
}
