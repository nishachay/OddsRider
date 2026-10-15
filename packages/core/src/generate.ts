/**
 * Track generation: a real probability series in, one frozen TrackV1 out.
 *
 * Deterministic by construction — no clock, no randomness in the id or hash.
 * `createdAt` is the only non-derived field and it is not hashed, so re-running
 * the generator over the same series yields the same id, and the ingest can
 * leave the existing file alone.
 */
import { lttb } from './downsample.ts';
import { PREVIEW_POINTS, PROBABILITY_CEIL, PROBABILITY_FLOOR, TARGET_POINTS } from './constants.ts';
import { computeStats, difficultyFromStats } from './stats.ts';
import type { PricePoint, TrackKind, TrackSource, TrackStats, TrackV1, Difficulty, Category } from './types.ts';


export interface TrackInput {
  kind: TrackKind;
  source: TrackSource;
  sourceId: string;
  slug: string;
  question: string;
  category: Category;
  status: 'open' | 'closed' | 'resolved';
  resolution?: 'YES' | 'NO' | null;
  probability: number;
  change24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  endDate: string | null;
  series: PricePoint[];
}

export function clampProbability(p: number): number {
  if (!Number.isFinite(p)) return PROBABILITY_FLOOR;
  return Math.min(PROBABILITY_CEIL, Math.max(PROBABILITY_FLOOR, p));
}

/** Sort, drop unusable points, keep the last value per timestamp, clamp. */
export function normalizeSeries(raw: PricePoint[]): PricePoint[] {
  const usable = raw.filter(
    (point) =>
      point != null &&
      Number.isFinite(point.t) &&
      Number.isFinite(point.p) &&
      point.t > 0,
  );

  usable.sort((a, b) => a.t - b.t);

  const out: PricePoint[] = [];
  for (const point of usable) {
    const value = clampProbability(point.p);
    const previous = out[out.length - 1];
    if (previous && previous.t === point.t) out[out.length - 1] = { t: point.t, p: value };
    else out.push({ t: point.t, p: value });
  }
  return out;
}

/** Canonical, stable text form of a series — the hash input. */
export function canonicalSeries(series: PricePoint[]): string {
  return JSON.stringify(series.map((point) => [point.t, Number(point.p.toFixed(6))]));
}

export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('SHA-256 unavailable: no WebCrypto in this runtime');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/**
 * Content-addressed id: the same series for the same market always produces the
 * same id, so `/ride/<id>` is forever the same terrain.
 */
export function trackIdFor(kind: TrackKind, sourceId: string, hash: string): string {
  const key = slugifyKey(sourceId) || 'market';
  const prefix = kind === 'remix' && !key.startsWith('remix-') ? 'remix-' : '';
  return `${prefix}${key}-${hash.slice(0, 12)}`;
}

export interface BuildTrackResult {
  track: TrackV1;
  stats: TrackStats;
  difficulty: Difficulty;
}

export async function buildTrack(input: TrackInput, createdAt?: string): Promise<TrackV1> {
  const series = lttb(normalizeSeries(input.series), TARGET_POINTS);
  if (series.length < 2) {
    throw new Error(`cannot build a track from ${series.length} point(s): ${input.sourceId}`);
  }

  const stats = computeStats(series);
  const hash = await sha256Hex(canonicalSeries(series));
  const sparkline = lttb(series, PREVIEW_POINTS).map((point) => point.p);

  return {
    id: trackIdFor(input.kind, input.sourceId, hash),
    version: 1,
    kind: input.kind,
    source: input.source,
    sourceId: input.sourceId,
    slug: input.slug,
    question: input.question,
    category: input.category,
    status: input.status,
    resolution: input.resolution ?? null,
    probability: clampProbability(input.probability),
    change24h: input.change24h,
    volume24h: input.volume24h,
    liquidity: input.liquidity,
    endDate: input.endDate,
    series,
    sparkline,
    stats,
    difficulty: difficultyFromStats(stats),
    hash,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}
