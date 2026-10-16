/**
 * Shared domain types for OddsRider tracks.
 *
 * A track is a FROZEN snapshot of a real probability series. Once written it
 * never changes: `id` is content-addressed from `hash`, so the same id always
 * describes the same terrain. Nothing in here may invent a number.
 */

export type TrackKind = 'live' | 'closed';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'INSANE' | 'NEW';

export type Category = 'POLITICS' | 'CRYPTO' | 'MACRO' | 'TECH' | 'LEGENDARY';

export type TrackSource = 'polymarket';

/** `t` is unix SECONDS, `p` is a probability in 0..1. */
export interface PricePoint {
  t: number;
  p: number;
}

export interface TrackStats {
  /** Points in the frozen series. */
  points: number;
  /** Population standard deviation of step-to-step probability deltas. */
  volatility: number;
  /** Largest single-step fall in the series (0..1, positive magnitude). */
  maxDrop: number;
  /** Largest single-step rise in the series (0..1, positive magnitude). */
  maxRise: number;
  /** Highest minus lowest probability in the series. */
  range: number;
  /** Days between the first and last point. */
  spanDays: number;
}

export interface TrackV1 {
  id: string;
  version: 1;
  kind: TrackKind;
  source: TrackSource;
  /** Market id at the source. Stable per market. */
  sourceId: string;
  slug: string;
  question: string;
  category: Category;
  status: 'open' | 'closed' | 'resolved';
  resolution?: 'YES' | 'NO' | null;
  /** Official last-trade probability at freeze time (0..1). Never derived. */
  probability: number;
  /** Official 24h change at freeze time, or null when the source has none. */
  change24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  endDate: string | null;
  series: PricePoint[];
  /**
   * Small real preview of the series (<= PREVIEW_POINTS), downsampled from the
   * same frozen points. Cards and track previews draw this; the game rides the
   * full `series`. Never invented.
   */
  sparkline: number[];
  stats: TrackStats;
  difficulty: Difficulty;
  /** sha256 over the canonical series payload. Same input => same hash. */
  hash: string;
  createdAt: string;
}

/** The index entry for a track: everything except the series itself. */
export type TrackSummary = Omit<TrackV1, 'series'>;

export interface TrackIndex {
  version: 1;
  /** Newest `createdAt` in the manifest. */
  generatedAt: string;
  tracks: TrackSummary[];
}

/** Which trailing windows of a frozen series are worth offering in the UI. */
export interface TrackWindows {
  h24: boolean;
  d7: boolean;
}

export type RideInterval = '24H' | '7D' | 'ALL';

/**
 * What the untouched Phaser engine consumes. `market` carries the official
 * odds that the HUD displays.
 */
export interface Ride {
  market: RideMarketFacts;
  series: PricePoint[];
  inverted?: boolean;
  /** Which frozen window was sliced for this ride (replays rebuild it). */
  interval?: RideInterval;
  /** Attract-mode backdrop zoom on the home stage. Never set on the ride page. */
  attract?: boolean;
}

export interface RideMarketFacts {
  question: string;
  currentProb: number;
  probDelta: number | null;
  difficulty: Difficulty;
  /** Frozen track id + hash: what the recorder stamps every run with. */
  id: string;
  trackHash: string;
}
