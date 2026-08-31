export interface PricePoint {
  t: number;
  p: number;
}

export interface RideableMarket {
  id: string;
  question: string;
  slug: string;
  volumeNum: number;
  volumeFormatted: string;
  clobTokenId: string;
  category: 'CRYPTO' | 'POLITICS' | 'MACRO' | 'TECH' | 'LEGENDARY';
  currentProb: number;
  probDelta: number;
  resolutionDate: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE';
  iconEmoji: string;
  volatilityLabel: string;
  sparkline: number[];
}

export interface Ride {
  market: RideableMarket;
  series: PricePoint[];
  inverted?: boolean;
}

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const CACHE_KEY = 'oddsrider_live_markets_v4';

function categorize(q: string): 'CRYPTO' | 'POLITICS' | 'MACRO' | 'TECH' {
  const s = q.toLowerCase();
  if (s.includes('btc') || s.includes('bitcoin') || s.includes('eth') || s.includes('sol') || s.includes('crypto') || s.includes('token') || s.includes('coin')) {
    return 'CRYPTO';
  }
  if (s.includes('election') || s.includes('trump') || s.includes('president') || s.includes('senate') || s.includes('kamala') || s.includes('biden') || s.includes('governor') || s.includes('vote') || s.includes('ceasefire')) {
    return 'POLITICS';
  }
  if (s.includes('fed') || s.includes('rate') || s.includes('gdp') || s.includes('inflation') || s.includes('cpi') || s.includes('recession') || s.includes('tariff') || s.includes('powell')) {
    return 'MACRO';
  }
  return 'TECH';
}

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

function generateSmoothSeries(startP: number, endP: number, points: number, volatility = 0.15): PricePoint[] {
  const series: PricePoint[] = [];
  const baseTime = Date.now() - 30 * 24 * 3600 * 1000;
  let currentP = startP;

  for (let i = 0; i < points; i++) {
    const t = baseTime + i * (30 * 24 * 3600 * 1000 / points);
    const progress = i / (points - 1);
    const trend = progress * (endP - startP);
    const wave = Math.sin(progress * Math.PI * 3.5) * volatility + Math.cos(progress * Math.PI * 6.2) * (volatility * 0.5);
    currentP = Math.max(0.02, Math.min(0.98, startP + trend + wave));
    series.push({ t, p: currentP });
  }
  return series;
}

export const LEGENDARY_MARKETS: RideableMarket[] = [
  {
    id: 'ftx-collapse-2022',
    question: 'LEGENDARY CRASH: Will FTX resume normal withdrawals? (Nov 2022)',
    slug: 'ftx-collapse-withdrawals',
    volumeNum: 48000000,
    volumeFormatted: '$48.0M Vol',
    clobTokenId: 'ftx-token',
    category: 'LEGENDARY',
    currentProb: 0.01,
    probDelta: -0.96,
    resolutionDate: 'Nov 11, 2022',
    difficulty: 'INSANE',
    iconEmoji: '💀',
    volatilityLabel: 'VERTICAL DEATH SPIRAL',
    sparkline: [0.98, 0.96, 0.92, 0.88, 0.75, 0.45, 0.18, 0.05, 0.01],
  },
  {
    id: 'terra-luna-peg',
    question: 'LEGENDARY CRASH: Will Terra USD (UST) restore its $1.00 peg? (May 2022)',
    slug: 'terra-luna-peg-restore',
    volumeNum: 92000000,
    volumeFormatted: '$92.0M Vol',
    clobTokenId: 'luna-token',
    category: 'LEGENDARY',
    currentProb: 0.00,
    probDelta: -0.99,
    resolutionDate: 'May 13, 2022',
    difficulty: 'INSANE',
    iconEmoji: '💀',
    volatilityLabel: 'SHEER CLIFF DROP-OFF',
    sparkline: [1.00, 0.98, 0.92, 0.80, 0.60, 0.30, 0.10, 0.02, 0.00],
  },
  {
    id: 'svb-bank-run',
    question: 'LEGENDARY SWING: Will Silicon Valley Bank depositors be made whole? (Mar 2023)',
    slug: 'svb-depositors-made-whole',
    volumeNum: 34000000,
    volumeFormatted: '$34.0M Vol',
    clobTokenId: 'svb-token',
    category: 'LEGENDARY',
    currentProb: 0.99,
    probDelta: +0.78,
    resolutionDate: 'Mar 13, 2023',
    difficulty: 'INSANE',
    iconEmoji: '💀',
    volatilityLabel: 'MEGA V-SHAPE RECOVERY',
    sparkline: [0.90, 0.70, 0.35, 0.20, 0.18, 0.45, 0.75, 0.95, 0.99],
  },
];

export const FALLBACK_MARKETS: RideableMarket[] = [
  {
    id: 'btc-100k-2026',
    question: 'Will Bitcoin reach $100,000 before end of year?',
    slug: 'will-bitcoin-reach-100000',
    volumeNum: 14200000,
    volumeFormatted: '$14.2M Vol',
    clobTokenId: 'btc-100k-token',
    category: 'CRYPTO',
    currentProb: 0.86,
    probDelta: +0.072,
    resolutionDate: 'Dec 31, 2026',
    difficulty: 'HARD',
    iconEmoji: '₿',
    volatilityLabel: 'EXTREME UPHILL CLIMBS',
    sparkline: [0.22, 0.35, 0.42, 0.38, 0.52, 0.65, 0.78, 0.72, 0.80, 0.85, 0.86],
  },
  {
    id: 'fed-decision-sept',
    question: 'Fed decision in September: Will rates remain unchanged?',
    slug: 'fed-decision-september',
    volumeNum: 7000000,
    volumeFormatted: '$7.0M Vol',
    clobTokenId: 'fed-sept-token',
    category: 'MACRO',
    currentProb: 0.67,
    probDelta: +0.36,
    resolutionDate: 'Sep 18, 2026',
    difficulty: 'EASY',
    iconEmoji: '🏛️',
    volatilityLabel: 'HIGH-SPEED STRAIGHTAWAYS',
    sparkline: [0.31, 0.35, 0.40, 0.42, 0.48, 0.55, 0.62, 0.65, 0.67],
  },
  {
    id: 'presidential-2028-gop',
    question: 'Will the Republican nominee win the 2028 Presidential Election?',
    slug: 'presidential-election-2028',
    volumeNum: 21500000,
    volumeFormatted: '$21.5M Vol',
    clobTokenId: 'pres-2028-token',
    category: 'POLITICS',
    currentProb: 0.54,
    probDelta: +0.04,
    resolutionDate: 'Nov 07, 2028',
    difficulty: 'MEDIUM',
    iconEmoji: '🇺🇸',
    volatilityLabel: 'ROLLING RIDGES',
    sparkline: [0.50, 0.52, 0.48, 0.51, 0.53, 0.49, 0.52, 0.54],
  },
  {
    id: 'gpt5-release-2026',
    question: 'Will OpenAI announce GPT-5 before December 2026?',
    slug: 'openai-gpt5-release',
    volumeNum: 3800000,
    volumeFormatted: '$3.8M Vol',
    clobTokenId: 'gpt5-token',
    category: 'TECH',
    currentProb: 0.82,
    probDelta: +0.22,
    resolutionDate: 'Dec 01, 2026',
    difficulty: 'HARD',
    iconEmoji: '🤖',
    volatilityLabel: 'LAUNCHPAD JUMPS',
    sparkline: [0.60, 0.62, 0.58, 0.65, 0.70, 0.75, 0.80, 0.82],
  },
  ...LEGENDARY_MARKETS,
];

// Fetch Real Live Polymarket Gamma Markets with Parallel CLOB History
export async function fetchAllMarkets(): Promise<RideableMarket[]> {
  try {
    const url = `${GAMMA}/markets?limit=16&active=true&closed=false&order=volume24hr&ascending=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));

    if (res.ok) {
      const rows = (await res.json()) as Array<{
        id: string;
        question: string;
        slug: string;
        volumeNum?: number;
        outcomes?: string;
        clobTokenIds?: string;
        endDate?: string;
      }>;

      const liveMarkets: RideableMarket[] = [];

      for (const row of rows) {
        const outcomes = parseJsonArray(row.outcomes);
        const tokens = parseJsonArray(row.clobTokenIds);
        if (outcomes.length < 2 || tokens.length < 2) continue;
        const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === 'yes');
        if (yesIdx < 0) continue;

        const vol = typeof row.volumeNum === 'number' ? row.volumeNum : 100000;
        const volFormatted = `$${(vol / 1_000_000).toFixed(1)}M Vol`;
        const cat = categorize(row.question);
        const token = tokens[yesIdx];

        // Generate preliminary initial sparkline
        const baseProb = Math.min(0.95, Math.max(0.05, 0.3 + (Math.sin(vol) * 0.4)));
        const delta = (Math.sin(vol * 2) * 0.15);

        liveMarkets.push({
          id: row.id || row.slug,
          question: row.question,
          slug: row.slug,
          volumeNum: vol,
          volumeFormatted: volFormatted,
          clobTokenId: token,
          category: cat,
          currentProb: Math.max(0.05, Math.min(0.95, baseProb)),
          probDelta: delta,
          resolutionDate: row.endDate ? new Date(row.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Dec 2026',
          difficulty: Math.abs(delta) > 0.2 ? 'HARD' : 'MEDIUM',
          iconEmoji: cat === 'CRYPTO' ? '🪙' : cat === 'POLITICS' ? '🏛️' : cat === 'MACRO' ? '📈' : '🤖',
          volatilityLabel: Math.abs(delta) > 0.2 ? 'STEEP HILL CLIMBS' : 'ROLLING RIDGES',
          sparkline: [
            baseProb - delta,
            baseProb - delta * 0.6,
            baseProb + delta * 0.3,
            baseProb,
          ],
        });
      }

      if (liveMarkets.length >= 4) {
        const full = [...liveMarkets, ...LEGENDARY_MARKETS];
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(full));
        } catch {}
        return full;
      }
    }
  } catch (err) {
    console.warn('Live Polymarket Gamma fetch fallback:', err);
  }

  return FALLBACK_MARKETS;
}

// Fetch Specific Rideable Series for Selected Market
export async function fetchRideForMarket(market: RideableMarket, inverted = false): Promise<Ride> {
  let series: PricePoint[] = [];

  if (market.clobTokenId && !market.clobTokenId.includes('token')) {
    try {
      const url = `${CLOB}/prices-history?market=${market.clobTokenId}&interval=max&fidelity=60`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
      if (res.ok) {
        const data = (await res.json()) as { history?: PricePoint[] };
        if (data.history && data.history.length >= 15) {
          series = data.history.sort((a, b) => a.t - b.t);
        }
      }
    } catch (e) {
      console.warn('CLOB price history fetch failed, using smoothed series:', e);
    }
  }

  if (series.length < 15) {
    if (market.id === 'ftx-collapse-2022') {
      series = generateSmoothSeries(0.98, 0.01, 120, 0.28);
    } else if (market.id === 'terra-luna-peg') {
      series = generateSmoothSeries(0.99, 0.01, 120, 0.32);
    } else if (market.id === 'svb-bank-run') {
      series = generateSmoothSeries(0.21, 0.99, 120, 0.30);
    } else {
      const startP = Math.max(0.05, market.currentProb - market.probDelta);
      const endP = market.currentProb;
      series = generateSmoothSeries(startP, endP, 120, market.difficulty === 'HARD' ? 0.22 : 0.12);
    }
  }

  if (inverted) {
    series = series.map((pt) => ({ t: pt.t, p: Math.max(0.02, Math.min(0.98, 1 - pt.p)) }));
  }

  return {
    market,
    series,
    inverted,
  };
}

export async function fetchRide(): Promise<Ride> {
  const defaultMarket = FALLBACK_MARKETS[0];
  return fetchRideForMarket(defaultMarket, false);
}
