/**
 * REMIX tracks — hand-drawn shapes that are NOT market data.
 *
 * These are the old curated fallback curves. They used to be presented as live
 * markets (invented volumes, invented 24h changes, real-looking "legendary
 * crash" histories). They are fiction, so now they are:
 *
 *   - `kind: 'remix'`, never `live`, never in the live list, always badged,
 *   - stripped of every invented number: no volume, no liquidity, no 24h change,
 *   - given a drawing axis only (an even time spread), which is not a claim
 *     that the market ever traded this way.
 */
import type { PricePoint } from './types.ts';

export interface RemixDefinition {
  sourceId: string;
  slug: string;
  question: string;
  /** The hand-drawn shape, 0..1. Fiction. */
  drawing: number[];
  /** Length of the drawing's x-axis. */
  spanDays: number;
  /** Fixed last day of the drawing's x-axis (ISO date, UTC). */
  endDate: string;
}

export const REMIX_TRACKS: RemixDefinition[] = [
  {
    sourceId: 'remix-bitcoin-100k',
    slug: 'will-bitcoin-reach-100000',
    question: 'Will Bitcoin reach $100,000 before end of year?',
    drawing: [0.22, 0.28, 0.35, 0.42, 0.38, 0.52, 0.65, 0.78, 0.72, 0.8, 0.85, 0.86],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-ethereum-ath',
    slug: 'ethereum-new-all-time-high',
    question: 'Will Ethereum set a new all-time high this year?',
    drawing: [0.32, 0.45, 0.65, 0.72, 0.68, 0.55, 0.42, 0.35, 0.22, 0.18, 0.15, 0.19],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-fed-hold',
    slug: 'fed-decision-september',
    question: 'Fed decision in September: will rates remain unchanged?',
    drawing: [0.31, 0.35, 0.4, 0.42, 0.48, 0.55, 0.62, 0.65, 0.67],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-election-2028',
    slug: 'presidential-election-2028',
    question: 'Presidential election winner 2028: will the Republican nominee win?',
    drawing: [0.5, 0.52, 0.48, 0.51, 0.53, 0.49, 0.52, 0.54],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-powell-out',
    slug: 'jerome-powell-out-fed-chair',
    question: 'Jerome Powell out as Fed chair in 2026?',
    drawing: [0.19, 0.18, 0.16, 0.15, 0.17, 0.14, 0.14],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-gpt5',
    slug: 'openai-gpt5-release',
    question: 'Will OpenAI announce GPT-5 before December 2026?',
    drawing: [0.6, 0.62, 0.58, 0.65, 0.7, 0.75, 0.8, 0.82],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-nyc-mayor',
    slug: 'nyc-mayoral-election-next',
    question: 'Next New York City mayoral election: will the Democrat win?',
    drawing: [0.45, 0.55, 0.6, 0.72, 0.75, 0.78, 0.8],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-solana-300',
    slug: 'solana-300-2026',
    question: 'Will Solana reach $300 in 2026?',
    drawing: [0.3, 0.35, 0.28, 0.32, 0.38, 0.44, 0.4, 0.42],
    spanDays: 30,
    endDate: '2026-10-01',
  },
  {
    sourceId: 'remix-ftx-withdrawals',
    slug: 'ftx-collapse-withdrawals',
    question: 'Will FTX resume normal withdrawals? (Nov 2022)',
    drawing: [0.98, 0.96, 0.92, 0.88, 0.75, 0.45, 0.18, 0.05, 0.01],
    spanDays: 14,
    endDate: '2022-11-11',
  },
  {
    sourceId: 'remix-terra-peg',
    slug: 'terra-luna-peg-restore',
    question: 'Will Terra USD (UST) restore its $1.00 peg? (May 2022)',
    drawing: [1, 0.98, 0.92, 0.8, 0.6, 0.3, 0.1, 0.02, 0],
    spanDays: 14,
    endDate: '2022-05-13',
  },
  {
    sourceId: 'remix-svb-depositors',
    slug: 'svb-depositors-made-whole',
    question: 'Will Silicon Valley Bank depositors be made whole? (Mar 2023)',
    drawing: [0.9, 0.7, 0.35, 0.2, 0.18, 0.45, 0.75, 0.95, 0.99],
    spanDays: 14,
    endDate: '2023-03-13',
  },
];

/** Even time axis for a drawing. Deterministic; no clock involved. */
export function evenSeries(drawing: number[], endDate: string, spanDays: number): PricePoint[] {
  const endUnix = Math.floor(Date.parse(`${endDate}T00:00:00Z`) / 1000);
  if (!Number.isFinite(endUnix)) {
    throw new Error(`evenSeries: unusable end date "${endDate}"`);
  }
  if (drawing.length < 2) throw new Error('evenSeries: a drawing needs at least 2 points');

  const start = endUnix - spanDays * 86400;
  const span = endUnix - start;
  return drawing.map((p, i) => ({
    t: Math.round(start + (i / (drawing.length - 1)) * span),
    p,
  }));
}

export function remixSeries(definition: RemixDefinition): PricePoint[] {
  return evenSeries(definition.drawing, definition.endDate, definition.spanDays);
}
