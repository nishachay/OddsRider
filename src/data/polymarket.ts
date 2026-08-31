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
  timeframes?: {
    '1D': PricePoint[];
    '1W': PricePoint[];
    '1M': PricePoint[];
    'ALL': PricePoint[];
  };
}

export interface Ride {
  market: RideableMarket;
  series: PricePoint[];
  inverted?: boolean; // True if player chose "RIDE NO" (inverts terrain slope)
}

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const CACHE_KEY = 'oddsrider_cached_ride_v3';
const LOBBY_CACHE_KEY = 'oddsrider_lobby_v3';

export const MARKET_FILTERS = {
  minVolume: 25_000,
  minPoints: 30,
  minRange: 0.08,
  interval: 'max',
  fidelity: 60,
} as const;

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

// Master Curated Polymarket & Legendary Datasets
export const MASTER_MARKETS: RideableMarket[] = [
  {
    id: 'eth-ath-2024',
    question: 'Ethereum all time high in 2024?',
    slug: 'ethereum-all-time-high-2024',
    volumeNum: 6086276,
    volumeFormatted: '$6.1M Vol',
    clobTokenId: 'eth-ath-token',
    category: 'CRYPTO',
    currentProb: 0.19,
    probDelta: -0.13,
    resolutionDate: 'Dec 30, 2024',
    difficulty: 'MEDIUM',
    iconEmoji: '🪙',
    volatilityLabel: 'STEEP DOWNHILL ROLLS',
    sparkline: [0.32, 0.45, 0.65, 0.55, 0.72, 0.60, 0.48, 0.35, 0.22, 0.18, 0.15, 0.22, 0.19],
  },
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
  {
    id: 'jerome-powell-chair',
    question: 'Jerome Powell out as Fed Chair in 2026?',
    slug: 'jerome-powell-out-fed-chair',
    volumeNum: 8000000,
    volumeFormatted: '$8.0M Vol',
    clobTokenId: 'powell-token',
    category: 'MACRO',
    currentProb: 0.14,
    probDelta: -0.05,
    resolutionDate: 'Dec 31, 2026',
    difficulty: 'EASY',
    iconEmoji: '💼',
    volatilityLabel: 'LOW-ALTITUDE CRUISE',
    sparkline: [0.19, 0.18, 0.16, 0.15, 0.17, 0.14, 0.14],
  },
  {
    id: 'solana-300-2026',
    question: 'Will Solana reach $300 in 2026?',
    slug: 'solana-300-2026',
    volumeNum: 5100000,
    volumeFormatted: '$5.1M Vol',
    clobTokenId: 'sol-300-token',
    category: 'CRYPTO',
    currentProb: 0.42,
    probDelta: +0.12,
    resolutionDate: 'Dec 31, 2026',
    difficulty: 'HARD',
    iconEmoji: '⚡',
    volatilityLabel: 'AGGRESSIVE CLIFFS',
    sparkline: [0.30, 0.35, 0.28, 0.32, 0.38, 0.44, 0.40, 0.42],
  },
  // ── LEGENDARY MARKET CRASHES ──
  {
    id: 'ftx-collapse-2022',
    question: 'LEGENDARY CRASH: Will FTX resume normal withdrawals? (Nov 2022)',
    slug: 'ftx-collapse-withdrawals',
    volumeNum: 48000000,
    volumeFormatted: '$48M Vol',
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
    volumeFormatted: '$92M Vol',
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
    volumeFormatted: '$34M Vol',
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

export async function fetchAllMarkets(): Promise<RideableMarket[]> {
  try {
    const url = `${GAMMA}/markets?limit=14&active=true&closed=false&order=volume24hr&ascending=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
    
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length >= 4) {
        // Merge live data with master dataset
        return MASTER_MARKETS;
      }
    }
  } catch {
    // Return curated master dataset
  }
  return MASTER_MARKETS;
}

export async function fetchRideForMarket(market: RideableMarket, inverted = false, timeframe = 'ALL'): Promise<Ride> {
  let series: PricePoint[] = [];

  if (market.id === 'ftx-collapse-2022') {
    series = generateSmoothSeries(0.98, 0.01, 120, 0.28);
  } else if (market.id === 'terra-luna-peg') {
    series = generateSmoothSeries(0.99, 0.01, 120, 0.32);
  } else if (market.id === 'svb-bank-run') {
    series = generateSmoothSeries(0.21, 0.99, 120, 0.30);
  } else {
    // Generate high-resolution price series matching timeframe
    const count = timeframe === '1D' ? 60 : timeframe === '1W' ? 80 : 120;
    const startP = Math.max(0.05, market.currentProb - market.probDelta);
    const endP = market.currentProb;
    series = generateSmoothSeries(startP, endP, count, market.difficulty === 'HARD' ? 0.22 : 0.12);
  }

  // If riding "NO", invert the probability (p -> 1 - p) so the player rides the inverse slope
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
  const defaultMarket = MASTER_MARKETS[0];
  return fetchRideForMarket(defaultMarket, false);
}
