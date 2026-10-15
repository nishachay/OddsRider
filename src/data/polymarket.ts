import { activeRideStore } from '../game/bus';

export interface PricePoint {
  t: number;
  p: number;
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE' | 'NEW';

export interface RideableMarket {
  id: string;
  question: string;
  slug: string;
  volumeNum: number;
  volumeFormatted: string;
  clobTokenId: string;
  category: 'POLITICS' | 'CRYPTO' | 'MACRO' | 'TECH' | 'LEGENDARY';
  // Real last-trade probability from Gamma outcomePrices. Never estimated.
  currentProb: number;
  // Real 24h change, or null when unknown (UI shows "—", never a guess).
  probDelta: number | null;
  resolutionDate: string;
  difficulty: Difficulty;
  volatilityLabel: string;
  // Real downsampled CLOB history, or null when unavailable.
  sparkline: number[] | null;
  // False for the bundled offline fallback feed.
  live: boolean;
}

export interface Ride {
  market: RideableMarket;
  series: PricePoint[];
  inverted?: boolean;
  // Attract mode (home stage backdrop): scene pulls the camera back for a
  // wide showroom shot. Never set on the playable ride page.
  attract?: boolean;
}

const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const CACHE_KEY = 'oddsrider_live_markets_v8';
const RIDE_CACHE_PREFIX = 'oddsrider_ride_v2_';
const CACHE_TTL_MS = 10 * 60 * 1000;
const LIST_LIMIT = 12;

// Automatic home-page filters (spec-mandated, do not skip)
const MIN_VOLUME_24H = 50000;
const MIN_RANGE = 0.03;
const MIN_HISTORY = 15;

// Difficulty from average absolute probability change per step.
// Published cutoffs so labels stay auditable, StonkRider-style.
export function computeDifficulty(sparkline: number[]): Difficulty {
  if (sparkline.length < 2) return 'NEW';
  let acc = 0;
  for (let i = 1; i < sparkline.length; i++) acc += Math.abs(sparkline[i] - sparkline[i - 1]);
  const avg = acc / (sparkline.length - 1);
  if (avg < 0.02) return 'EASY';
  if (avg < 0.05) return 'MEDIUM';
  if (avg < 0.08) return 'HARD';
  return 'INSANE';
}

export function difficultyFromDelta(delta: number | null): Difficulty {
  if (delta === null) return 'NEW';
  const a = Math.abs(delta);
  if (a > 0.3) return 'INSANE';
  if (a > 0.15) return 'HARD';
  if (a > 0.05) return 'MEDIUM';
  return 'EASY';
}

export function sparklineRange(sparkline: number[]): number {
  if (sparkline.length === 0) return 0;
  return Math.max(...sparkline) - Math.min(...sparkline);
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: 'SMOOTH HIGHWAY',
  MEDIUM: 'ROLLING RIDGES',
  HARD: 'STEEP CLIMBS',
  INSANE: 'CLIFF COUNTRY',
  NEW: 'UNRATED TRACK',
};

interface MarketsCache {
  savedAt: number;
  markets: RideableMarket[];
}

function readCache(): MarketsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketsCache;
    if (!parsed || !Array.isArray(parsed.markets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(markets: RideableMarket[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), markets }));
  } catch {
    // Ignore quota errors
  }
}

// Synchronous instant paint: fresh cache, else stale cache, else curated feed.
export function getCachedMarkets(): RideableMarket[] | null {
  const cache = readCache();
  if (!cache) return null;
  if (Date.now() - cache.savedAt > CACHE_TTL_MS) return null;
  return cache.markets.length > 0 ? cache.markets : null;
}

export function isLiveList(markets: RideableMarket[]): boolean {
  return markets.some((m) => m.live && m.category !== 'LEGENDARY');
}

export function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Biggest 24h movers: live, non-legendary markets with a known delta,
// ranked by absolute swing. Unknown deltas never qualify — no guessing.
export function getBiggestMovers(markets: RideableMarket[], n = 4): RideableMarket[] {
  return markets
    .filter((m) => m.category !== 'LEGENDARY' && m.probDelta !== null)
    .sort((a, b) => Math.abs(b.probDelta ?? 0) - Math.abs(a.probDelta ?? 0))
    .slice(0, n);
}

// Deterministic per-day challenge so everyone rides the same market.
export function getDailyChallenge(
  markets: RideableMarket[],
  dateStr: string = new Date().toISOString().slice(0, 10),
): RideableMarket | null {
  const pool = markets.filter((m) => m.category !== 'LEGENDARY');
  const list = pool.length > 0 ? pool : markets;
  if (list.length === 0) return null;
  return list[simpleHash(dateStr) % list.length];
}

export interface HomePageData {
  dailyChallenge: RideableMarket | null;
  trending: RideableMarket[];
  legendary: RideableMarket[];
  byCategory: Record<string, RideableMarket[]>;
  all: RideableMarket[];
  live: boolean;
}

export function getHomePageData(markets: RideableMarket[]): HomePageData {
  const trending = markets
    .filter((m) => m.category !== 'LEGENDARY')
    .slice()
    .sort((a, b) => b.volumeNum - a.volumeNum);
  const legendary = markets.filter((m) => m.category === 'LEGENDARY');
  const byCategory: Record<string, RideableMarket[]> = {};
  for (const m of markets) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }
  return {
    dailyChallenge: getDailyChallenge(markets),
    trending,
    legendary,
    byCategory,
    all: markets,
    live: isLiveList(markets),
  };
}

function categorize(q: string): 'POLITICS' | 'CRYPTO' | 'MACRO' | 'TECH' {
  const s = q.toLowerCase();
  if (s.includes('election') || s.includes('trump') || s.includes('president') || s.includes('senate') || s.includes('kamala') || s.includes('biden') || s.includes('governor') || s.includes('vote') || s.includes('ceasefire') || s.includes('mayor')) {
    return 'POLITICS';
  }
  if (s.includes('btc') || s.includes('bitcoin') || s.includes('eth') || s.includes('sol') || s.includes('crypto') || s.includes('token') || s.includes('coin')) {
    return 'CRYPTO';
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

function parsePriceArray(value: unknown): number[] {
  return parseJsonArray(value)
    .map((s) => parseFloat(s))
    .filter((n) => Number.isFinite(n));
}

function parseNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace('%', ''));
    if (!Number.isFinite(n)) return null;
    return Math.abs(n) > 1 ? n / 100 : n;
  }
  return null;
}

function formatVolume(vol24h: number): string {
  if (vol24h >= 1_000_000) return `$${(vol24h / 1_000_000).toFixed(1)}M 24H`;
  if (vol24h >= 1_000) return `$${(vol24h / 1_000).toFixed(0)}K 24H`;
  return `$${Math.round(vol24h)} 24H`;
}

function formatDate(endDate: unknown): string {
  if (typeof endDate !== 'string' || !endDate) return 'Open';
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return 'Open';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function downsample(values: number[], max: number): number[] {
  if (values.length <= max) return values;
  const stride = values.length / max;
  const out: number[] = [];
  for (let i = 0; i < max; i++) out.push(values[Math.floor(i * stride)]);
  out.push(values[values.length - 1]);
  return out;
}

// Real 24h change from a history series. Handles both second and
// millisecond timestamps. Null when the span is unknowable.
function deltaFromHistory(hist: PricePoint[]): number | null {
  if (hist.length < 2) return null;
  const last = hist[hist.length - 1];
  const first = hist[0];
  const span = last.t - first.t;
  if (!(span > 0)) return null;
  const unit = span > 1e11 ? 1 : 1000;
  const cutoff = last.t - 24 * 3600 * unit;
  let ref = first.p;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].t <= cutoff) {
      ref = hist[i].p;
      break;
    }
  }
  return last.p - ref;
}

async function fetchHistory(token: string, interval: string, timeoutMs: number): Promise<PricePoint[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${CLOB}/prices-history?market=${token}&interval=${interval}&fidelity=60`,
      { signal: controller.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { history?: PricePoint[] };
    if (!data.history || data.history.length < 2) return [];
    return data.history
      .filter((pt) => pt && Number.isFinite(pt.t) && Number.isFinite(pt.p))
      .sort((a, b) => a.t - b.t);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

interface GammaRow {
  id: string;
  question: string;
  slug: string;
  volumeNum?: number;
  volume24hr?: number;
  outcomes?: string;
  outcomePrices?: string;
  clobTokenIds?: string;
  endDate?: string;
  [key: string]: unknown;
}

function gammaChange(row: GammaRow): number | null {
  const candidates = [
    row.oneDayPriceChange,
    row.priceChange24h,
    row.dayPriceChange,
    row.priceChange,
  ];
  for (const c of candidates) {
    const n = parseNum(c);
    if (n !== null) return n;
  }
  return null;
}

async function enrichRow(row: GammaRow): Promise<RideableMarket | null> {
  const outcomes = parseJsonArray(row.outcomes);
  const prices = parsePriceArray(row.outcomePrices);
  const tokens = parseJsonArray(row.clobTokenIds);
  if (outcomes.length < 2 || tokens.length < 2) return null;
  const yesIdx = outcomes.findIndex((o) => o.toLowerCase() === 'yes');
  if (yesIdx < 0 || yesIdx >= prices.length) return null;

  const vol24h =
    parseNum(row.volume24hr) ?? (typeof row.volumeNum === 'number' ? row.volumeNum : 0);
  if (vol24h < MIN_VOLUME_24H) return null;

  const token = tokens[yesIdx];
  const currentProb = Math.min(0.99, Math.max(0.01, prices[yesIdx]));

  const hist = await fetchHistory(token, 'max', 4000);
  const sparkline = hist.length >= MIN_HISTORY ? downsample(hist.map((pt) => pt.p), 48) : null;
  if (sparkline && sparklineRange(sparkline) < MIN_RANGE) return null;

  const delta = gammaChange(row) ?? (hist.length >= MIN_HISTORY ? deltaFromHistory(hist) : null);
  const difficulty = sparkline ? computeDifficulty(sparkline) : difficultyFromDelta(delta);
  const cat = categorize(row.question);

  return {
    id: row.id || row.slug,
    question: row.question,
    slug: row.slug,
    volumeNum: vol24h,
    volumeFormatted: formatVolume(vol24h),
    clobTokenId: token,
    category: cat,
    currentProb,
    probDelta: delta,
    resolutionDate: formatDate(row.endDate),
    difficulty,
    volatilityLabel: DIFFICULTY_LABEL[difficulty],
    sparkline,
    live: true,
  };
}

export type FeedError = 'OK' | 'GAMMA_UNREACHABLE' | 'INSUFFICIENT_LIVE';

export interface FeedResult {
  markets: RideableMarket[];
  error: FeedError;
}

export async function fetchAllMarkets(): Promise<FeedResult> {
  const staleFallback = readCache()?.markets ?? null;
  const fallback = (error: FeedError): FeedResult => ({
    markets: staleFallback && staleFallback.length > 0 ? staleFallback : CURATED_POLYMARKET_FEED,
    error,
  });

  let gammaOk = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let rows: GammaRow[] = [];
    try {
      const res = await fetch(
        `${GAMMA}/markets?limit=24&active=true&closed=false&order=volume24hr&ascending=false`,
        { signal: controller.signal },
      );
      if (res.ok) {
        rows = (await res.json()) as GammaRow[];
        gammaOk = true;
      }
    } finally {
      clearTimeout(timeout);
    }

    const settled = await Promise.allSettled(rows.slice(0, LIST_LIMIT).map(enrichRow));
    const liveMarkets: RideableMarket[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) liveMarkets.push(s.value);
    }

    if (liveMarkets.length >= 4) {
      liveMarkets.sort((a, b) => b.volumeNum - a.volumeNum);
      const full = [...liveMarkets, ...CURATED_POLYMARKET_FEED.filter((m) => m.category === 'LEGENDARY')];
      writeCache(full);
      return { markets: full, error: 'OK' };
    }
    return fallback(gammaOk ? 'INSUFFICIENT_LIVE' : 'GAMMA_UNREACHABLE');
  } catch (err) {
    console.warn('Live Polymarket Gamma fetch fallback:', err);
    return fallback('GAMMA_UNREACHABLE');
  }
}

// Paste-any-Polymarket-URL: extract the slug and resolve it to a
// rideable market through Gamma. Returns null when unresolvable.
export function extractPolymarketSlug(input: string): string | null {
  const m = input.match(/polymarket\.com\/(?:event|market)\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

async function fetchGammaRows(url: string): Promise<GammaRow[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (Array.isArray(data)) return data as GammaRow[];
    const obj = data as { markets?: GammaRow[]; events?: Array<{ markets?: GammaRow[] }> };
    if (Array.isArray(obj.markets)) return obj.markets;
    if (Array.isArray(obj.events)) {
      const rows: GammaRow[] = [];
      for (const ev of obj.events) {
        if (Array.isArray(ev.markets)) rows.push(...ev.markets);
      }
      return rows;
    }
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolvePolymarketUrl(input: string): Promise<RideableMarket | null> {
  const slug = extractPolymarketSlug(input);
  if (!slug) return null;
  const [a, b] = await Promise.all([
    fetchGammaRows(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`),
    fetchGammaRows(`${GAMMA}/markets?slug=${encodeURIComponent(slug)}`),
  ]);
  for (const row of [...a, ...b]) {
    const market = await enrichRow(row);
    if (market) return market;
  }
  return null;
}
export function filterMarketsLocal(query: string, local: RideableMarket[]): RideableMarket[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return local.filter(
    (m) =>
      m.question.toLowerCase().includes(needle) ||
      m.category.toLowerCase().includes(needle) ||
      m.slug.toLowerCase().includes(needle),
  );
}

export async function searchMarkets(query: string, local: RideableMarket[]): Promise<RideableMarket[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${GAMMA}/public-search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as unknown;
        const rows: GammaRow[] = Array.isArray(data)
          ? (data as GammaRow[])
          : ((data as { markets?: GammaRow[] }).markets ?? []);
        const settled = await Promise.allSettled(rows.slice(0, 8).map(enrichRow));
        const found: RideableMarket[] = [];
        for (const s of settled) {
          if (s.status === 'fulfilled' && s.value) found.push(s.value);
        }
        if (found.length > 0) return found;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Fall through to local filter
  }
  return filterMarketsLocal(q, local);
}

// Raw 1:1 mapping: every real data point becomes one terrain node.
// No interpolation, no smoothing — jagged volatility is the game.
export function sparklineToSeries(sparkline: number[] | null): PricePoint[] {
  if (!sparkline || sparkline.length === 0) return [];
  const baseTime = Date.now() - 30 * 24 * 3600 * 1000;
  const timeSpan = 30 * 24 * 3600 * 1000;
  const len = sparkline.length;
  return sparkline.map((p, i) => ({
    t: baseTime + (i / Math.max(len - 1, 1)) * timeSpan,
    p: Math.max(0.01, Math.min(0.99, p)),
  }));
}

export type RideInterval = 'max' | 'day' | 'week' | 'all';

// Offline fallback feed. Clearly marked live:false — the UI says so when
// this is all we have. Shapes are illustrative, not live data.
export const CURATED_POLYMARKET_FEED: RideableMarket[] = [
  {
    id: 'btc-100k-2026',
    question: 'Will Bitcoin reach $100,000 before end of year?',
    slug: 'will-bitcoin-reach-100000',
    volumeNum: 14200000,
    volumeFormatted: '$14.2M 24H',
    clobTokenId: 'btc-100k-token',
    category: 'CRYPTO',
    currentProb: 0.86,
    probDelta: +0.072,
    resolutionDate: 'Dec 31, 2026',
    difficulty: 'HARD',
    volatilityLabel: 'EXTREME UPHILL CLIMBS',
    sparkline: [0.22, 0.28, 0.35, 0.42, 0.38, 0.52, 0.65, 0.78, 0.72, 0.80, 0.85, 0.86],
    live: false,
  },
  {
    id: 'eth-ath-next',
    question: 'Will Ethereum set a new all-time high this year?',
    slug: 'ethereum-new-all-time-high',
    volumeNum: 6086276,
    volumeFormatted: '$6.1M 24H',
    clobTokenId: 'eth-ath-token',
    category: 'CRYPTO',
    currentProb: 0.19,
    probDelta: -0.13,
    resolutionDate: 'Open',
    difficulty: 'MEDIUM',
    volatilityLabel: 'ROLLERCOASTER DOWNHILL',
    sparkline: [0.32, 0.45, 0.65, 0.72, 0.68, 0.55, 0.42, 0.35, 0.22, 0.18, 0.15, 0.19],
    live: false,
  },
  {
    id: 'fed-decision-sept',
    question: 'Fed decision in September: Will rates remain unchanged?',
    slug: 'fed-decision-september',
    volumeNum: 7000000,
    volumeFormatted: '$7.0M 24H',
    clobTokenId: 'fed-sept-token',
    category: 'MACRO',
    currentProb: 0.67,
    probDelta: +0.36,
    resolutionDate: 'Sep 18, 2026',
    difficulty: 'EASY',
    volatilityLabel: 'HIGH-SPEED STRAIGHTAWAYS',
    sparkline: [0.31, 0.35, 0.40, 0.42, 0.48, 0.55, 0.62, 0.65, 0.67],
    live: false,
  },
  {
    id: 'presidential-2028-gop',
    question: 'Presidential Election Winner 2028: Will Republican nominee win?',
    slug: 'presidential-election-2028',
    volumeNum: 21500000,
    volumeFormatted: '$21.5M 24H',
    clobTokenId: 'pres-2028-token',
    category: 'POLITICS',
    currentProb: 0.54,
    probDelta: +0.04,
    resolutionDate: 'Nov 07, 2028',
    difficulty: 'MEDIUM',
    volatilityLabel: 'ROLLING RIDGES',
    sparkline: [0.50, 0.52, 0.48, 0.51, 0.53, 0.49, 0.52, 0.54],
    live: false,
  },
  {
    id: 'jerome-powell-out-2026',
    question: 'Jerome Powell out as Fed Chair in 2026?',
    slug: 'jerome-powell-out-fed-chair',
    volumeNum: 8000000,
    volumeFormatted: '$8.0M 24H',
    clobTokenId: 'powell-token',
    category: 'MACRO',
    currentProb: 0.14,
    probDelta: -0.05,
    resolutionDate: 'Dec 31, 2026',
    difficulty: 'EASY',
    volatilityLabel: 'LOW-ALTITUDE HIGHWAY',
    sparkline: [0.19, 0.18, 0.16, 0.15, 0.17, 0.14, 0.14],
    live: false,
  },
  {
    id: 'gpt5-release-2026',
    question: 'Will OpenAI announce GPT-5 before December 2026?',
    slug: 'openai-gpt5-release',
    volumeNum: 3800000,
    volumeFormatted: '$3.8M 24H',
    clobTokenId: 'gpt5-token',
    category: 'TECH',
    currentProb: 0.82,
    probDelta: +0.22,
    resolutionDate: 'Dec 01, 2026',
    difficulty: 'HARD',
    volatilityLabel: 'LAUNCHPAD JUMPS',
    sparkline: [0.60, 0.62, 0.58, 0.65, 0.70, 0.75, 0.80, 0.82],
    live: false,
  },
  {
    id: 'nyc-mayor-next',
    question: 'Next New York City Mayoral Election: Will the Democrat win?',
    slug: 'nyc-mayoral-election-next',
    volumeNum: 40000000,
    volumeFormatted: '$40.0M 24H',
    clobTokenId: 'nyc-mayor-token',
    category: 'POLITICS',
    currentProb: 0.80,
    probDelta: +0.18,
    resolutionDate: 'Open',
    difficulty: 'HARD',
    volatilityLabel: 'ASCENDING PEAKS',
    sparkline: [0.45, 0.55, 0.60, 0.72, 0.75, 0.78, 0.80],
    live: false,
  },
  {
    id: 'solana-300-2026',
    question: 'Will Solana reach $300 in 2026?',
    slug: 'solana-300-2026',
    volumeNum: 5100000,
    volumeFormatted: '$5.1M 24H',
    clobTokenId: 'sol-300-token',
    category: 'CRYPTO',
    currentProb: 0.42,
    probDelta: +0.12,
    resolutionDate: 'Dec 31, 2026',
    difficulty: 'HARD',
    volatilityLabel: 'AGGRESSIVE CLIFFS',
    sparkline: [0.30, 0.35, 0.28, 0.32, 0.38, 0.44, 0.40, 0.42],
    live: false,
  },
  // ── LEGENDARY MARKET CRASHES (EXTREME TOPOLOGY) ──
  {
    id: 'ftx-collapse-2022',
    question: 'LEGENDARY CRASH: Will FTX resume normal withdrawals? (Nov 2022)',
    slug: 'ftx-collapse-withdrawals',
    volumeNum: 48000000,
    volumeFormatted: '$48.0M 24H',
    clobTokenId: 'ftx-token',
    category: 'LEGENDARY',
    currentProb: 0.01,
    probDelta: -0.96,
    resolutionDate: 'Nov 11, 2022',
    difficulty: 'INSANE',
    volatilityLabel: 'VERTICAL DEATH SPIRAL',
    sparkline: [0.98, 0.96, 0.92, 0.88, 0.75, 0.45, 0.18, 0.05, 0.01],
    live: false,
  },
  {
    id: 'terra-luna-peg',
    question: 'LEGENDARY CRASH: Will Terra USD (UST) restore its $1.00 peg? (May 2022)',
    slug: 'terra-luna-peg-restore',
    volumeNum: 92000000,
    volumeFormatted: '$92.0M 24H',
    clobTokenId: 'luna-token',
    category: 'LEGENDARY',
    currentProb: 0.00,
    probDelta: -0.99,
    resolutionDate: 'May 13, 2022',
    difficulty: 'INSANE',
    volatilityLabel: 'SHEER CLIFF DROP-OFF',
    sparkline: [1.00, 0.98, 0.92, 0.80, 0.60, 0.30, 0.10, 0.02, 0.00],
    live: false,
  },
  {
    id: 'svb-bank-run',
    question: 'LEGENDARY SWING: Will Silicon Valley Bank depositors be made whole? (Mar 2023)',
    slug: 'svb-depositors-made-whole',
    volumeNum: 34000000,
    volumeFormatted: '$34.0M 24H',
    clobTokenId: 'svb-token',
    category: 'LEGENDARY',
    currentProb: 0.99,
    probDelta: +0.78,
    resolutionDate: 'Mar 13, 2023',
    difficulty: 'INSANE',
    volatilityLabel: 'MEGA V-SHAPE RECOVERY',
    sparkline: [0.90, 0.70, 0.35, 0.20, 0.18, 0.45, 0.75, 0.95, 0.99],
    live: false,
  },
];

// Generate the authentic unique track for any chosen Polymarket market.
// Throws NO_HISTORY when neither CLOB nor any sparkline exists —
// callers must show "data unavailable", never fabricate a track.
export async function fetchRideForMarket(
  market: RideableMarket,
  inverted = false,
  interval: RideInterval = 'max',
): Promise<Ride> {
  let series: PricePoint[] = [];
  const cacheKey = `${market.clobTokenId}:${interval}`;

  if (market.clobTokenId && !market.clobTokenId.includes('token')) {
    series = readRideCache(cacheKey);
    if (series.length < MIN_HISTORY) {
      series = [];
      const clobInterval = interval === 'max' || interval === 'all' ? 'max' : interval;
      let hist = await fetchHistory(market.clobTokenId, clobInterval, 3500);
      if (hist.length < MIN_HISTORY && clobInterval !== 'max') {
        hist = await fetchHistory(market.clobTokenId, 'max', 3500);
      }
      if (hist.length >= MIN_HISTORY) {
        series = hist;
        writeRideCache(cacheKey, series);
      }
    }
  }

  if (series.length < MIN_HISTORY) {
    series = sparklineToSeries(market.sparkline);
  }

  // Hand-drawn fallback sparklines are short by design; only refuse when
  // there is genuinely nothing to build from.
  if (series.length < 2) {
    throw new Error(`NO_HISTORY: no price history for "${market.slug}"`);
  }

  // If riding "NO", invert the probability (1 - p) so the track slopes inversely
  if (inverted) {
    series = series.map((pt) => ({ t: pt.t, p: Math.max(0.02, Math.min(0.98, 1 - pt.p)) }));
  }

  const ride: Ride = {
    market,
    series,
    inverted,
  };

  activeRideStore.current = ride;
  return ride;
}

interface RideCache {
  savedAt: number;
  series: PricePoint[];
}

function readRideCache(key: string): PricePoint[] {
  try {
    const raw = localStorage.getItem(RIDE_CACHE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RideCache;
    if (!parsed || !Array.isArray(parsed.series)) return [];
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return [];
    return parsed.series;
  } catch {
    return [];
  }
}

function writeRideCache(key: string, series: PricePoint[]): void {
  try {
    localStorage.setItem(
      RIDE_CACHE_PREFIX + key,
      JSON.stringify({ savedAt: Date.now(), series }),
    );
  } catch {
    // Ignore quota errors
  }
}

export async function fetchRide(): Promise<Ride> {
  const defaultMarket = CURATED_POLYMARKET_FEED[0];
  return fetchRideForMarket(defaultMarket, false);
}
