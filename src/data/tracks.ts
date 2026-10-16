/**
 * Track client — the browser's ONLY data source.
 *
 * The browser reads our own frozen `/tracks/*.json` and nothing else. There
 * are no Gamma/CLOB calls here, no timeouts to remote APIs, no silent
 * fallbacks: a missing or malformed payload is a loud, typed error and the UI
 * shows a clear error state.
 */
import { activeRideStore } from '../game/bus';
import {
  DIFFICULTY_LABEL,
  parseTrack,
  parseTrackIndex,
  sliceSeries,
  type Difficulty,
  type PricePoint,
  type Ride,
  type RideInterval,
  type TrackIndex,
  type TrackKind,
  type TrackStats,
  type TrackSummary,
  type TrackV1,
} from '@oddsrider/core';

export type { Difficulty, PricePoint, Ride, RideInterval, TrackIndex, TrackKind, TrackStats, TrackSummary, TrackV1 };
export type Category = TrackSummary['category'];

/**
 * View model for every list, card, preview and stage. Field names are kept
 * stable so the race-day chrome renders frozen tracks without re-learning
 * them. Every number is either frozen official data or a real series stat —
 * nothing is estimated.
 */
export interface RideableMarket {
  /** Frozen track id. The same id is always the same terrain. */
  id: string;
  question: string;
  slug: string;
  sourceId: string;
  kind: TrackKind;
  volumeNum: number;
  /** '—' when the source published no volume. */
  volumeFormatted: string;
  category: Category;
  /** Final outcome for settled tracks (strict rails rule), else null. */
  resolution: 'YES' | 'NO' | null;
  /** Official last-trade probability at freeze time. Never derived. */
  currentProb: number;
  /** Official 24h change at freeze time, or null when unknown (UI shows "—"). */
  probDelta: number | null;
  resolutionDate: string;
  difficulty: Difficulty;
  volatilityLabel: string;
  /** Real downsampled preview from the index; the game rides the full series. */
  sparkline: number[] | null;
  stats: TrackStats;
  points: number;
  createdAt: string;
  /** True only for tradeable markets. Settled tracks are never live. */
  live: boolean;
}

export type FeedError = 'TRACKS_UNREACHABLE' | 'TRACKS_INVALID' | 'TRACKS_EMPTY';

export class TrackFeedError extends Error {
  code: FeedError;
  constructor(code: FeedError, message: string) {
    super(message);
    this.code = code;
  }
}

export function formatVolume(vol24h: number): string {
  if (vol24h >= 1_000_000) return `$${(vol24h / 1_000_000).toFixed(1)}M 24H`;
  if (vol24h >= 1_000) return `$${(vol24h / 1_000).toFixed(0)}K 24H`;
  return `$${Math.round(vol24h)} 24H`;
}

export function formatDate(endDate: string | null): string {
  if (!endDate) return 'Open';
  const d = new Date(endDate);
  if (Number.isNaN(d.getTime())) return 'Open';
  // UTC: a resolution date is a fact about the market, not the viewer's zone.
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function toRideableMarket(summary: TrackSummary): RideableMarket {
  return {
    id: summary.id,
    question: summary.question,
    slug: summary.slug,
    sourceId: summary.sourceId,
    kind: summary.kind,
    volumeNum: summary.volume24h ?? 0,
    volumeFormatted: summary.volume24h == null ? '—' : formatVolume(summary.volume24h),
    category: summary.category,
    resolution: summary.resolution ?? null,
    currentProb: summary.probability,
    probDelta: summary.change24h,
    resolutionDate: formatDate(summary.endDate),
    difficulty: summary.difficulty,
    volatilityLabel: DIFFICULTY_LABEL[summary.difficulty] ?? summary.difficulty,
    sparkline: summary.sparkline,
    stats: summary.stats,
    points: summary.stats.points,
    createdAt: summary.createdAt,
    live: summary.kind === 'live',
  };
}

async function readJson(response: Response, what: string): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new TrackFeedError('TRACKS_INVALID', `${what} is not valid JSON`);
  }
}

/** The frozen manifest. Throws TrackFeedError — never returns fake tracks. */
export async function fetchTrackIndex(): Promise<TrackIndex> {
  let response: Response;
  try {
    response = await fetch('/tracks/index.json', { headers: { Accept: 'application/json' } });
  } catch {
    throw new TrackFeedError('TRACKS_UNREACHABLE', 'track index unreachable');
  }
  if (!response.ok) {
    throw new TrackFeedError('TRACKS_UNREACHABLE', `track index answered HTTP ${response.status}`);
  }
  try {
    return parseTrackIndex(await readJson(response, 'track index'));
  } catch (error) {
    if (error instanceof TrackFeedError) throw error;
    throw new TrackFeedError(
      'TRACKS_INVALID',
      `track index failed validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** One frozen track file. Throws when the id is missing or malformed. */
export async function fetchTrack(id: string): Promise<TrackV1> {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(id)) {
    throw new TrackFeedError('TRACKS_INVALID', `unusable track id: ${id}`);
  }
  let response: Response;
  try {
    response = await fetch(`/tracks/${id}.json`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new TrackFeedError('TRACKS_UNREACHABLE', `track ${id} unreachable`);
  }
  if (response.status === 404) {
    throw new Error(`NO_HISTORY: track ${id} is not published (it may have been pruned)`);
  }
  if (!response.ok) {
    throw new TrackFeedError('TRACKS_UNREACHABLE', `track ${id} answered HTTP ${response.status}`);
  }
  try {
    return parseTrack(await readJson(response, `track ${id}`));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('NO_HISTORY')) throw error;
    throw new TrackFeedError(
      'TRACKS_INVALID',
      `track ${id} failed validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** `?tf=` query values map onto windows of the frozen series. */
export function rideIntervalFromParam(tf: string | null): RideInterval {
  if (tf === '24H' || tf === '7D' || tf === 'ALL') return tf;
  return 'ALL';
}

/**
 * The authentic ride for a frozen track. The window is a trailing slice of
 * the frozen series — no data is invented by picking 24H or 7D.
 * Throws NO_HISTORY when the frozen series cannot make a track.
 */
export async function fetchRideForTrack(
  market: RideableMarket,
  inverted = false,
  interval: RideInterval = 'ALL',
): Promise<Ride> {
  const track = await fetchTrack(market.id);
  let series = sliceSeries(track.series, interval);
  if (series.length < 2) {
    throw new Error(`NO_HISTORY: no rideable series in track "${track.slug}"`);
  }

  // Riding "NO" inverts the probability (1 - p) so the track slopes inversely.
  if (inverted) {
    series = series.map((pt) => ({ t: pt.t, p: Math.max(0.02, Math.min(0.98, 1 - pt.p)) }));
  }

  const ride: Ride = {
    market: {
      question: track.question,
      currentProb: track.probability,
      probDelta: track.change24h,
      difficulty: track.difficulty,
    },
    series,
    inverted,
  };

  activeRideStore.current = ride;
  return ride;
}

/** Default ride for the engine: first live track, else first track. Never fake. */
export async function fetchRide(): Promise<Ride> {
  const index = await fetchTrackIndex();
  const summaries = index.tracks;
  const first = summaries.find((t) => t.kind === 'live') ?? summaries[0];
  if (!first) throw new Error('NO_HISTORY: no published tracks');
  return fetchRideForTrack(toRideableMarket(first), false, 'ALL');
}

export function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function isLiveList(markets: RideableMarket[]): boolean {
  return markets.some((m) => m.kind === 'live');
}

// One colour rule for every odds number and every track line, mirroring the
// in-game terrain renderer (`seg.rising ? toxic : crimson` in
// terrain.ts/trackRenderer: a segment is toxic when probability does not
// fall). Unknown or flat deltas count as rising, same as the renderer.
export function momentumUp(probDelta: number | null): boolean {
  return (probDelta ?? 0) >= 0;
}

// Biggest 24h movers: live tracks with a known delta, ranked by absolute
// swing. Unknown deltas never qualify — no guessing.
export function getBiggestMovers(markets: RideableMarket[], n = 4): RideableMarket[] {
  return markets
    .filter((m) => m.kind === 'live' && m.probDelta !== null)
    .sort((a, b) => Math.abs(b.probDelta ?? 0) - Math.abs(a.probDelta ?? 0))
    .slice(0, n);
}

// The title's featured ride: the daily's neighbour, so the two screens never
// headline the same track while choice exists. Same pool and order as
// getDailyChallenge, shifted by one — deterministic per date.
export function getTitleFeature(
  markets: RideableMarket[],
  dateStr: string = new Date().toISOString().slice(0, 10),
): RideableMarket | null {
  const live = markets.filter((m) => m.kind === 'live');
  const list = live.length > 0 ? live : markets;
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return list[(simpleHash(dateStr) + 1) % list.length];
}

// Deterministic per-day challenge so everyone rides the same track. Live
// tracks first; settled tracks headline only when nothing live is published.
export function getDailyChallenge(
  markets: RideableMarket[],
  dateStr: string = new Date().toISOString().slice(0, 10),
): RideableMarket | null {
  const live = markets.filter((m) => m.kind === 'live');
  const list = live.length > 0 ? live : markets;
  if (list.length === 0) return null;
  return list[simpleHash(dateStr) % list.length];
}

export interface HomePageData {
  dailyChallenge: RideableMarket | null;
  trending: RideableMarket[];
  legendary: RideableMarket[];
  closed: RideableMarket[];
  byCategory: Record<string, RideableMarket[]>;
  all: RideableMarket[];
  live: boolean;
}

export function getHomePageData(markets: RideableMarket[]): HomePageData {
  const trending = markets
    .filter((m) => m.kind === 'live')
    .slice()
    .sort((a, b) => b.volumeNum - a.volumeNum);
  const legendary = markets.filter((m) => m.category === 'LEGENDARY');
  const closed = markets.filter((m) => m.kind === 'closed');
  const byCategory: Record<string, RideableMarket[]> = {};
  for (const m of markets) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }
  return {
    dailyChallenge: getDailyChallenge(markets),
    trending,
    legendary,
    closed,
    byCategory,
    all: markets,
    live: isLiveList(markets),
  };
}

/**
 * Match a pasted URL against tracks we have actually frozen: our own
 * /preview/ and /ride/ links, or a polymarket.com event/market slug. A
 * Polymarket URL we have never frozen resolves to nothing — the browser never
 * calls out to fetch it.
 */
export function extractTrackSlug(input: string): string | null {
  const m = input.match(
    /(?:polymarket\.com\/(?:event|market)\/|oddsrider\/(?:preview|ride)\/|\/(?:preview|ride)\/)([^/?#]+)/i,
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function filterTracksLocal(query: string, local: RideableMarket[]): RideableMarket[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const slug = extractTrackSlug(query);
  return local.filter(
    (m) =>
      (slug !== null && (m.slug === slug || m.id === slug)) ||
      m.question.toLowerCase().includes(needle) ||
      m.category.toLowerCase().includes(needle) ||
      m.slug.toLowerCase().includes(needle),
  );
}

// Same frozen feed = same ids and same odds: skip the state update so
// canvases, countdowns, and scroll position survive a background refresh.
export function sameFeed(a: RideableMarket[], b: RideableMarket[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (m, i) =>
        m.id === b[i]?.id &&
        m.currentProb === b[i]?.currentProb &&
        m.probDelta === b[i]?.probDelta,
    )
  );
}
