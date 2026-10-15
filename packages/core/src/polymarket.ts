/**
 * Polymarket source adapter.
 *
 * Everything here runs at ingest time (a Node script or CI job) — never in the
 * browser. `fetch` is injected so the adapter can be driven from recorded
 * fixtures in tests, with no live calls.
 *
 * Only binary YES/NO markets are supported: a multi-outcome event has no single
 * probability to ride.
 */
import { z } from 'zod';
import { categorize } from './categorize.ts';
import type { Category, PricePoint } from './types.ts';

export const GAMMA_BASE = 'https://gamma-api.polymarket.com';
export const CLOB_BASE = 'https://clob.polymarket.com';

const numericish = z.union([z.number(), z.string()]);
const listish = z.union([z.string(), z.array(z.string())]);

export const gammaMarketRowSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  question: z.string().optional(),
  slug: z.string().optional(),
  volume24hr: numericish.optional(),
  volumeNum: numericish.optional(),
  volume: numericish.optional(),
  liquidityNum: numericish.optional(),
  liquidity: numericish.optional(),
  outcomes: listish.optional(),
  outcomePrices: listish.optional(),
  clobTokenIds: listish.optional(),
  endDate: z.string().optional(),
  oneDayPriceChange: numericish.optional(),
  priceChange24h: numericish.optional(),
  dayPriceChange: numericish.optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  tags: z
    .array(z.object({ label: z.string().optional(), slug: z.string().optional() }))
    .optional(),
});

export const clobHistorySchema = z.object({
  history: z.array(z.object({ t: z.number(), p: z.number() })).optional(),
});

export interface SourceMarket {
  source: 'polymarket';
  sourceId: string;
  slug: string;
  question: string;
  category: Category;
  status: 'open' | 'closed' | 'resolved';
  resolution: 'YES' | 'NO' | null;
  probability: number;
  change24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  endDate: string | null;
  tags: string[];
  /** Kept for future features (plan §8). Raw source ids, never displayed. */
  externalIds: Record<string, string>;
  yesTokenId: string | null;
}

export function parseListish(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** "0.62" | 0.62 | "62%" | 62 -> 0.62. Null when unusable. */
export function parseProbability(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) > 1 ? value / 100 : value;
  }
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace('%', ''));
    if (!Number.isFinite(n)) return null;
    return Math.abs(n) > 1 ? n / 100 : n;
  }
  return null;
}

export function parseNumberish(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/[$,]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const TAG_CATEGORY: Record<string, Category> = {
  politics: 'POLITICS',
  election: 'POLITICS',
  elections: 'POLITICS',
  crypto: 'CRYPTO',
  economy: 'MACRO',
  macro: 'MACRO',
  fed: 'MACRO',
  business: 'MACRO',
  tech: 'TECH',
  science: 'TECH',
  ai: 'TECH',
};

/** Source tags first (plan §1 #6), whole-word categorisation as the fallback. */
export function categoryFromTags(tags: string[], question: string): Category {
  for (const tag of tags) {
    const mapped = TAG_CATEGORY[tag.toLowerCase()];
    if (mapped) return mapped;
  }
  return categorize(question);
}

export function toSourceMarket(row: unknown): SourceMarket | null {
  const parsed = gammaMarketRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const raw = parsed.data;

  const question = (raw.question ?? '').trim();
  const slug = (raw.slug ?? '').trim();
  if (!question || !slug) return null;

  const outcomes = parseListish(raw.outcomes).map((o) => o.toLowerCase());
  const tokens = parseListish(raw.clobTokenIds);
  const prices = parseListish(raw.outcomePrices).map(parseProbability);
  if (outcomes.length !== 2 || tokens.length !== 2) return null;

  const yesIndex = outcomes.indexOf('yes');
  if (yesIndex < 0) return null;

  const probability = prices[yesIndex];
  if (probability === null || probability === undefined) return null;

  const tags = (raw.tags ?? [])
    .flatMap((tag) => [tag.label, tag.slug])
    .filter((t): t is string => typeof t === 'string' && t.length > 0);

  const change24h =
    parseProbability(raw.oneDayPriceChange) ??
    parseProbability(raw.priceChange24h) ??
    parseProbability(raw.dayPriceChange);

  return {
    source: 'polymarket',
    sourceId: String(raw.id ?? slug),
    slug,
    question,
    category: categoryFromTags(tags, question),
    status: raw.closed ? 'closed' : 'open',
    resolution: null,
    probability,
    change24h,
    volume24h: parseNumberish(raw.volume24hr) ?? parseNumberish(raw.volumeNum) ?? parseNumberish(raw.volume),
    liquidity: parseNumberish(raw.liquidityNum) ?? parseNumberish(raw.liquidity),
    endDate: raw.endDate ?? null,
    tags,
    externalIds: {
      yesTokenId: tokens[yesIndex],
      noTokenId: tokens[yesIndex === 0 ? 1 : 0],
    },
    yesTokenId: tokens[yesIndex] ?? null,
  };
}

export interface HttpResponseish {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchImpl = (url: string, init?: { signal?: AbortSignal }) => Promise<HttpResponseish>;

export interface SourceAdapter {
  /** Open markets, highest 24h volume first. */
  listTrending(limit: number): Promise<SourceMarket[]>;
  /** Recently closed markets, highest total volume first. */
  listClosedByVolume(limit: number): Promise<SourceMarket[]>;
  /** Markets matching a slug, from the events and markets endpoints. */
  listBySlug(slug: string): Promise<SourceMarket[]>;
  /** Full price history for a market's YES token. */
  getHistory(market: SourceMarket, interval?: string): Promise<PricePoint[]>;
}

export function extractMarketRows(payload: unknown): unknown[] {
  // An event carries its binary markets in a nested `markets` array — both
  // at the top level (`{ events: [...] }`) and inside array responses
  // (`/events?slug=` returns `[event]`).
  const flatten = (items: unknown[]): unknown[] => {
    const rows: unknown[] = [];
    for (const item of items) {
      const nested =
        item !== null && typeof item === 'object'
          ? (item as { markets?: unknown }).markets
          : undefined;
      if (Array.isArray(nested)) rows.push(...nested);
      else rows.push(item);
    }
    return rows;
  };

  if (Array.isArray(payload)) return flatten(payload);
  if (payload && typeof payload === 'object') {
    const obj = payload as { markets?: unknown; events?: unknown };
    if (Array.isArray(obj.markets)) return flatten(obj.markets);
    if (Array.isArray(obj.events)) return flatten(obj.events);
  }
  return [];
}

export interface PolymarketSourceOptions {
  fetchImpl: FetchImpl;
  gammaBase?: string;
  clobBase?: string;
  timeoutMs?: number;
  /** Delay between sequential upstream calls, to stay polite. */
  delayMs?: number;
  attempts?: number;
}

export function createPolymarketSource(options: PolymarketSourceOptions): SourceAdapter {
  const {
    fetchImpl,
    gammaBase = GAMMA_BASE,
    clobBase = CLOB_BASE,
    timeoutMs = 10_000,
    delayMs = 150,
    attempts = 3,
  } = options;

  async function request(url: string): Promise<unknown> {
    let lastError: unknown = new Error(`request failed: ${url}`);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < attempts) await new Promise((r) => setTimeout(r, delayMs * attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  async function listMarkets(query: string, limit: number): Promise<SourceMarket[]> {
    const payload = await request(`${gammaBase}/markets?${query}&limit=${limit}`);
    const rows = extractMarketRows(payload);
    const markets: SourceMarket[] = [];
    for (const row of rows) {
      const market = toSourceMarket(row);
      if (market) markets.push(market);
    }
    return markets;
  }

  return {
    listTrending: (limit) =>
      listMarkets('active=true&closed=false&order=volume24hr&ascending=false', limit),

    listClosedByVolume: (limit) =>
      listMarkets('closed=true&order=volumeNum&ascending=false', limit),

    async listBySlug(slug: string) {
      const [fromEvents, fromMarkets] = await Promise.all([
        request(`${gammaBase}/events?slug=${encodeURIComponent(slug)}`).then(extractMarketRows),
        request(`${gammaBase}/markets?slug=${encodeURIComponent(slug)}`).then(extractMarketRows),
      ]);
      const markets: SourceMarket[] = [];
      const seen = new Set<string>();
      for (const row of [...fromEvents, ...fromMarkets]) {
        const market = toSourceMarket(row);
        // Both endpoints can return the same market; freeze it once.
        const key = `${market?.sourceId}::${market?.yesTokenId}`;
        if (market && !seen.has(key)) {
          seen.add(key);
          markets.push(market);
        }
      }
      return markets;
    },

    async getHistory(market, interval = 'max') {
      if (!market.yesTokenId) return [];
      const payload = await request(
        `${clobBase}/prices-history?market=${encodeURIComponent(market.yesTokenId)}&interval=${interval}&fidelity=60`,
      );
      const parsed = clobHistorySchema.safeParse(payload);
      if (!parsed.success) return [];
      return (parsed.data.history ?? []).filter(
        (point) => Number.isFinite(point.t) && Number.isFinite(point.p),
      );
    },
  };
}

/** Market-level rideability filters (plan §3.2). */
export const DEFAULT_RIDEABLE_FILTERS = {
  /** Flat markets make flat, boring tracks. */
  minProbability: 0.03,
  maxProbability: 0.97,
  minVolume24h: 50_000,
} as const;

/**
 * Final outcome of a settled market from its last frozen price. The band is
 * deliberately strict: anything that did not settle at the rails reports
 * null (ambiguous) instead of a guessed resolution.
 */
export const RESOLUTION_YES_AT_OR_ABOVE = 0.99;
export const RESOLUTION_NO_AT_OR_BELOW = 0.01;

export function resolutionFromClose(finalProbability: number | null): 'YES' | 'NO' | null {
  if (finalProbability === null || !Number.isFinite(finalProbability)) return null;
  if (finalProbability >= RESOLUTION_YES_AT_OR_ABOVE) return 'YES';
  if (finalProbability <= RESOLUTION_NO_AT_OR_BELOW) return 'NO';
  return null;
}

export function isRideableMarket(
  market: SourceMarket,
  filters: { minProbability: number; maxProbability: number; minVolume24h: number } = DEFAULT_RIDEABLE_FILTERS,
): boolean {
  if (market.status !== 'open') return false;
  if (market.probability < filters.minProbability) return false;
  if (market.probability > filters.maxProbability) return false;
  if ((market.volume24h ?? 0) < filters.minVolume24h) return false;
  return market.yesTokenId !== null;
}

export function selectRideableMarkets(
  markets: SourceMarket[],
  filters?: { minProbability: number; maxProbability: number; minVolume24h: number },
): SourceMarket[] {
  return markets.filter((market) => isRideableMarket(market, filters));
}
