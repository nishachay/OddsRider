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

export const MARKET_FILTERS = {
  minVolume: 50_000,
  minPoints: 60,
  minRange: 0.12,
  interval: '1m',
  fidelity: 120,
} as const;

type GammaMarket = {
  id: string;
  question: string;
  slug: string;
  volumeNum: number;
  outcomes: string;
  clobTokenIds: string;
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

export async function fetchRideableMarkets(limit = 20): Promise<RideableMarket[]> {
  const url = `${GAMMA}/markets?limit=${limit * 4}&active=true&closed=false&order=volume24hr&ascending=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gamma ${res.status}`);
  const rows = (await res.json()) as GammaMarket[];
  const markets: RideableMarket[] = [];
  for (const row of rows) {
    const volumeNum = typeof row.volumeNum === 'number' ? row.volumeNum : 0;
    if (volumeNum < MARKET_FILTERS.minVolume) continue;
    const outcomes = parseJsonArray(row.outcomes);
    const tokens = parseJsonArray(row.clobTokenIds);
    if (outcomes.length !== 2 || tokens.length !== 2) continue;
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
  return markets;
}

export async function fetchPriceHistory(
  clobTokenId: string,
  interval: string = MARKET_FILTERS.interval,
  fidelity: number = MARKET_FILTERS.fidelity,
): Promise<PricePoint[]> {
  const res = await fetch(`${CLOB}/prices-history?market=${clobTokenId}&interval=${interval}&fidelity=${fidelity}`);
  if (!res.ok) throw new Error(`clob ${res.status}`);
  const data = (await res.json()) as { history?: PricePoint[] };
  return (data.history ?? []).slice().sort((a, b) => a.t - b.t);
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

export async function fetchRide(markets?: RideableMarket[]): Promise<Ride> {
  const candidates = markets ?? (await fetchRideableMarkets());
  const CHUNK = 12;
  for (let i = 0; i < candidates.length; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map(async (market) => {
        const series = await fetchPriceHistory(market.clobTokenId);
        return { market, series };
      }),
    );
    let best: Ride | null = null;
    let bestRange = 0;
    for (const { market, series } of results) {
      const range = seriesRange(series);
      if (isRideableSeries(series) && range > bestRange) {
        bestRange = range;
        best = { market, series };
      }
    }
    if (best) return best;
  }
  throw new Error('no rideable market found');
}
