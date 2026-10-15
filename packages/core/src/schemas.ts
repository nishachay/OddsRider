/**
 * Validation at every boundary.
 *
 * Nothing enters the app as a track or an index without passing these schemas.
 * A malformed payload is a hard error, never a silent fallback.
 */
import { z } from 'zod';
import { PROBABILITY_CEIL, PROBABILITY_FLOOR } from './constants.ts';
import type { TrackIndex, TrackSummary, TrackV1 } from './types.ts';

export const pricePointSchema = z.object({
  t: z.number().finite().positive(),
  p: z.number().finite().min(PROBABILITY_FLOOR).max(PROBABILITY_CEIL),
});

export const trackStatsSchema = z.object({
  points: z.number().int().nonnegative(),
  volatility: z.number().finite().nonnegative(),
  maxDrop: z.number().finite().nonnegative(),
  maxRise: z.number().finite().nonnegative(),
  range: z.number().finite().nonnegative(),
  spanDays: z.number().finite().nonnegative(),
});

export const trackKindSchema = z.enum(['live', 'closed']);
export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD', 'INSANE', 'NEW']);
export const categorySchema = z.enum(['POLITICS', 'CRYPTO', 'MACRO', 'TECH', 'LEGENDARY']);

export const trackSummarySchema = z.object({
  id: z.string().min(3),
  version: z.literal(1),
  kind: trackKindSchema,
  source: z.enum(['polymarket']),
  sourceId: z.string().min(1),
  slug: z.string().min(1),
  question: z.string().min(1),
  category: categorySchema,
  status: z.enum(['open', 'closed', 'resolved']),
  resolution: z.enum(['YES', 'NO']).nullable().optional(),
  probability: z.number().finite().min(PROBABILITY_FLOOR).max(PROBABILITY_CEIL),
  change24h: z.number().finite().nullable(),
  volume24h: z.number().finite().nonnegative().nullable(),
  liquidity: z.number().finite().nonnegative().nullable(),
  endDate: z.string().nullable(),
  sparkline: z.array(z.number().finite().min(PROBABILITY_FLOOR).max(PROBABILITY_CEIL)).min(2),
  stats: trackStatsSchema,
  difficulty: difficultySchema,
  hash: z.string().regex(/^[0-9a-f]{64}$/, 'hash must be a sha256 hex digest'),
  createdAt: z.string().min(1),
}).superRefine((summary, ctx) => {
  // A settled track without a final YES/NO is corrupt data: the ingest must
  // fail loudly instead of publishing it, so the schema rejects it here.
  if (summary.kind === 'closed' && summary.resolution !== 'YES' && summary.resolution !== 'NO') {
    ctx.addIssue({ code: 'custom', message: 'closed tracks require resolution YES or NO' });
  }
});

export const trackV1Schema = trackSummarySchema.extend({
  series: z.array(pricePointSchema).min(2),
});

export const trackIndexSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().min(1),
  tracks: z.array(trackSummarySchema),
});

export function parseTrackIndex(value: unknown): TrackIndex {
  return trackIndexSchema.parse(value);
}

export function parseTrack(value: unknown): TrackV1 {
  return trackV1Schema.parse(value);
}

export function safeParseTrack(value: unknown): TrackSummary | null {
  const result = trackSummarySchema.safeParse(value);
  return result.success ? result.data : null;
}
