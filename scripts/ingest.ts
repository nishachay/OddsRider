#!/usr/bin/env node --experimental-strip-types
/**
 * Frozen-track ingest.
 *
 * Fetches Polymarket data, validates it with zod, runs the generator, and
 * writes frozen TrackV1 JSON to `public/tracks/` plus `index.json`. Run it with
 * `pnpm ingest`; the scheduled GitHub Actions workflow runs it every 6 hours
 * and commits only when something changed.
 *
 *   pnpm ingest                          live markets + famous closed markets
 *   pnpm ingest -- --live-only           no closed tracks
 *   pnpm ingest -- --closed-only         no live discovery (offline-safe)
 *   pnpm ingest -- --fixtures <dir>      offline: recorded Gamma/CLOB fixtures
 *                                        as the live source (pipeline testing)
 *   pnpm ingest -- --dump <dir>          also save the raw upstream responses
 *                                        (for building recorded fixtures)
 *   pnpm ingest -- --out <dir>           output directory (default public/tracks)
 *   pnpm ingest -- --limit <n>           live markets to freeze (default 12)
 *   pnpm ingest -- --keep <n>            snapshots kept per market (default 2)
 *
 * Nothing here invents data. A market that fails validation, is blocked by the
 * sensitive-markets filter, is still open when a closed track was wanted, or
 * has too little history is skipped with a warning; if nothing usable remains
 * the run fails loudly instead of writing fakes.
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTrack,
  createPolymarketSource,
  filterBlocked,
  isRideableMarket,
  MIN_HISTORY_POINTS,
  MIN_TRACK_RANGE,
  normalizeSeries,
  parseTrack,
  planIngest,
  resolutionFromClose,
  type FetchImpl,
  type SourceMarket,
  type TrackInput,
  type TrackV1,
} from '../packages/core/src/index.ts';
import { CLOSED_MARKETS } from './closed-markets.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

interface Options {
  out: string;
  limit: number;
  keep: number;
  liveOnly: boolean;
  closedOnly: boolean;
  fixtures: string | null;
  dump: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    out: join(ROOT, 'public', 'tracks'),
    limit: 12,
    keep: 2,
    liveOnly: false,
    closedOnly: false,
    fixtures: null,
    dump: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') options.out = resolve(ROOT, argv[++i]);
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++i], 10);
    else if (arg === '--keep') options.keep = Number.parseInt(argv[++i], 10);
    else if (arg === '--live-only') options.liveOnly = true;
    else if (arg === '--closed-only') options.closedOnly = true;
    else if (arg === '--fixtures') options.fixtures = resolve(ROOT, argv[++i]);
    else if (arg === '--dump') options.dump = resolve(ROOT, argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.limit) || options.limit < 1) throw new Error('--limit must be >= 1');
  if (!Number.isFinite(options.keep) || options.keep < 1) throw new Error('--keep must be >= 1');
  return options;
}

function warn(message: string): void {
  console.warn(`ingest: warning: ${message}`);
}

async function readExistingTracks(out: string): Promise<TrackV1[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(out);
  } catch {
    return [];
  }
  const tracks: TrackV1[] = [];
  for (const entry of entries) {
    if (entry === 'index.json' || !entry.endsWith('.json')) continue;
    const raw = await readFile(join(out, entry), 'utf8');
    tracks.push(parseTrack(JSON.parse(raw)));
  }
  return tracks;
}

function seriesRange(series: Array<{ p: number }>): number {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const point of series) {
    if (point.p < low) low = point.p;
    if (point.p > high) high = point.p;
  }
  return high - low;
}

interface Upstream {
  source: ReturnType<typeof createPolymarketSource>;
}

/** Wrap fetch so `--dump` saves every raw upstream response for fixtures. */
function dumpingFetch(fetchImpl: FetchImpl, dump: (url: string, payload: unknown) => Promise<void>): FetchImpl {
  return async (url, init) => {
    const response = await fetchImpl(url, init);
    const original = response.json.bind(response);
    response.json = async () => {
      const payload = await original();
      await dump(url, payload);
      return payload;
    };
    return response;
  };
}

async function buildLiveTracks(
  upstream: Upstream,
  markets: SourceMarket[],
  options: Options,
  now: string,
): Promise<TrackV1[]> {
  const candidates = filterBlocked(
    markets.filter((market) => isRideableMarket(market)),
    (market) => market.tags,
  ).slice(0, options.limit);

  const tracks: TrackV1[] = [];
  for (const market of candidates) {
    const history = await upstream.source.getHistory(market);
    const series = normalizeSeries(history);
    if (series.length < MIN_HISTORY_POINTS) {
      warn(`skipping "${market.slug}": only ${series.length} history points`);
      continue;
    }
    if (seriesRange(series) < MIN_TRACK_RANGE) {
      warn(`skipping "${market.slug}": range too flat to ride`);
      continue;
    }
    tracks.push(
      await buildTrack(
        {
          kind: 'live',
          source: 'polymarket',
          sourceId: market.sourceId,
          slug: market.slug,
          question: market.question,
          category: market.category,
          status: 'open',
          resolution: null,
          probability: market.probability,
          change24h: market.change24h,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          endDate: market.endDate,
          series,
        },
        now,
      ),
    );
  }
  return tracks;
}

async function buildClosedTracks(upstream: Upstream, now: string): Promise<TrackV1[]> {
  const tracks: TrackV1[] = [];
  for (const spec of CLOSED_MARKETS) {
    let candidates: SourceMarket[] = [];
    try {
      candidates = await upstream.source.listBySlug(spec.slug);
    } catch (error) {
      warn(`skipping "${spec.slug}": lookup failed (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    const market = candidates.find((row) => row.status === 'closed') ?? candidates[0];
    if (!market) {
      warn(`skipping "${spec.slug}": slug resolved nowhere`);
      continue;
    }
    if (market.status !== 'closed') {
      warn(`skipping "${market.slug}": still open, not a settled track`);
      continue;
    }
    if (market.yesTokenId === null) {
      warn(`skipping "${market.slug}": no price token`);
      continue;
    }
    const series = normalizeSeries(await upstream.source.getHistory(market));
    if (series.length < MIN_HISTORY_POINTS) {
      warn(`skipping "${market.slug}": only ${series.length} history points`);
      continue;
    }
    if (seriesRange(series) < MIN_TRACK_RANGE) {
      warn(`skipping "${market.slug}": range too flat to ride`);
      continue;
    }
    const finalProbability = series[series.length - 1].p;
    tracks.push(
      await buildTrack(
        {
          kind: 'closed',
          source: 'polymarket',
          sourceId: market.sourceId,
          slug: market.slug,
          question: market.question,
          category: market.category,
          status: 'closed',
          resolution: resolutionFromClose(finalProbability),
          probability: market.probability,
          change24h: market.change24h,
          volume24h: market.volume24h,
          liquidity: market.liquidity,
          endDate: market.endDate,
          series,
        },
        now,
      ),
    );
  }
  return tracks;
}

async function main(): Promise<void> {
  // pnpm passes its own `--` separator through; ignore it.
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
  const now = new Date().toISOString();

  const dumpPayload = async (url: string, payload: unknown): Promise<void> => {
    if (!options.dump) return;
    const urlObject = new URL(url);
    const slug = urlObject.searchParams.get('slug') ?? urlObject.searchParams.get('market') ?? 'trending';
    const safe = slug.replace(/[^a-z0-9-]+/gi, '-').slice(0, 80);
    const what = url.includes('/prices-history') ? 'clob' : 'gamma';
    await mkdir(options.dump, { recursive: true });
    await writeFile(join(options.dump, `${what}-${safe}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  };

  let fetchImpl: FetchImpl;
  if (options.fixtures) {
    const gamma = JSON.parse(
      await readFile(join(options.fixtures, 'gamma-markets.json'), 'utf8'),
    ) as unknown[];
    const histories = JSON.parse(
      await readFile(join(options.fixtures, 'clob-history.json'), 'utf8'),
    ) as Record<string, Array<{ t: number; p: number }>>;
    fetchImpl = async (url: string) => {
      if (url.includes('/events?slug=') || url.includes('/markets?slug=')) {
        const slug = new URL(url).searchParams.get('slug') ?? '';
        const rows = (gamma as Array<{ slug?: string }>).filter((row) => row.slug === slug);
        return { ok: true, status: 200, json: async () => rows };
      }
      if (url.includes('/markets')) {
        return { ok: true, status: 200, json: async () => gamma };
      }
      const token = new URL(url).searchParams.get('market') ?? '';
      return { ok: true, status: 200, json: async () => ({ history: histories[token] ?? [] }) };
    };
  } else {
    const liveFetch: FetchImpl = async (url: string, init?: { signal?: AbortSignal }) => {
      const response = await fetch(url, { signal: init?.signal });
      return {
        ok: response.ok,
        status: response.status,
        json: async () => response.json() as Promise<unknown>,
      };
    };
    fetchImpl = liveFetch;
  }

  const upstream: Upstream = {
    source: createPolymarketSource({
      fetchImpl: options.dump ? dumpingFetch(fetchImpl, dumpPayload) : fetchImpl,
    }),
  };

  const existing = await readExistingTracks(options.out);
  const incoming: TrackV1[] = [];

  if (!options.closedOnly) {
    try {
      const trending = await upstream.source.listTrending(Math.max(options.limit * 2, options.limit));
      incoming.push(...(await buildLiveTracks(upstream, trending, options, now)));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${reason} (hint: Polymarket is unreachable from this network; use --closed-only or --fixtures <dir> for offline runs)`,
      );
    }
  }
  if (!options.liveOnly) {
    incoming.push(...(await buildClosedTracks(upstream, now)));
  }
  if (incoming.length === 0 && existing.length === 0) {
    throw new Error('no usable tracks: every market failed validation or was filtered out');
  }

  const plan = planIngest(existing, incoming, { keepPerSource: options.keep });

  await mkdir(options.out, { recursive: true });
  for (const track of plan.write) {
    await writeFile(join(options.out, `${track.id}.json`), `${JSON.stringify(track, null, 2)}\n`);
  }
  for (const id of plan.prune) {
    await rm(join(options.out, `${id}.json`), { force: true });
  }
  await writeFile(join(options.out, 'index.json'), `${JSON.stringify(plan.index, null, 2)}\n`);

  console.log(
    `ingest: ${plan.tracks.length} tracks (${plan.write.length} new, ${plan.prune.length} pruned) -> ${options.out}`,
  );
}

main().catch((error: unknown) => {
  console.error(`ingest: FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
