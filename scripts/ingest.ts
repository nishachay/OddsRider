#!/usr/bin/env node --experimental-strip-types
/**
 * Frozen-track ingest.
 *
 * Fetches Polymarket data, validates it with zod, runs the generator, and
 * writes frozen TrackV1 JSON to `public/tracks/` plus `index.json`. Run it with
 * `pnpm ingest`; the scheduled GitHub Actions workflow runs it every 6 hours
 * and commits only when something changed.
 *
 *   pnpm ingest                          live markets + remix tracks
 *   pnpm ingest -- --remix-only          no network: remix tracks only
 *   pnpm ingest -- --live-only           no remix tracks
 *   pnpm ingest -- --fixtures <dir>      offline: recorded Gamma/CLOB fixtures
 *                                        as the live source (pipeline testing)
 *   pnpm ingest -- --out <dir>           output directory (default public/tracks)
 *   pnpm ingest -- --limit <n>           live markets to freeze (default 12)
 *   pnpm ingest -- --keep <n>            snapshots kept per market (default 2)
 *
 * Nothing here invents data. A market that fails validation, is blocked by the
 * sensitive-markets filter, or has too little history is skipped with a warning;
 * if nothing usable remains the run fails loudly instead of writing fakes.
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
  REMIX_TRACKS,
  remixSeries,
  type FetchImpl,
  type SourceMarket,
  type TrackInput,
  type TrackV1,
} from '../packages/core/src/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

interface Options {
  out: string;
  limit: number;
  keep: number;
  remixOnly: boolean;
  liveOnly: boolean;
  fixtures: string | null;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    out: join(ROOT, 'public', 'tracks'),
    limit: 12,
    keep: 2,
    remixOnly: false,
    liveOnly: false,
    fixtures: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') options.out = resolve(ROOT, argv[++i]);
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++i], 10);
    else if (arg === '--keep') options.keep = Number.parseInt(argv[++i], 10);
    else if (arg === '--remix-only') options.remixOnly = true;
    else if (arg === '--live-only') options.liveOnly = true;
    else if (arg === '--fixtures') options.fixtures = resolve(ROOT, argv[++i]);
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

async function buildRemixTracks(now: string): Promise<TrackV1[]> {
  const tracks: TrackV1[] = [];
  for (const definition of REMIX_TRACKS) {
    const series = remixSeries(definition);
    const input: TrackInput = {
      kind: 'remix',
      source: 'remix',
      sourceId: definition.sourceId,
      slug: definition.slug,
      question: definition.question,
      category: 'REMIX',
      status: 'closed',
      resolution: null,
      probability: series[series.length - 1].p,
      change24h: null,
      volume24h: null,
      liquidity: null,
      endDate: null,
      series,
    };
    tracks.push(await buildTrack(input, now));
  }
  return tracks;
}

function fixtureFetch(gamma: unknown[], histories: Record<string, Array<{ t: number; p: number }>>): FetchImpl {
  return async (url: string) => {
    if (url.includes('/markets')) {
      return { ok: true, status: 200, json: async () => gamma };
    }
    const token = new URL(url).searchParams.get('market') ?? '';
    return { ok: true, status: 200, json: async () => ({ history: histories[token] ?? [] }) };
  };
}

async function buildLiveTracks(options: Options, now: string): Promise<TrackV1[]> {
  let fetchImpl: FetchImpl;
  if (options.fixtures) {
    const gamma = JSON.parse(
      await readFile(join(options.fixtures, 'gamma-markets.json'), 'utf8'),
    ) as unknown[];
    const histories = JSON.parse(
      await readFile(join(options.fixtures, 'clob-history.json'), 'utf8'),
    ) as Record<string, Array<{ t: number; p: number }>>;
    fetchImpl = fixtureFetch(gamma, histories);
  } else {
    fetchImpl = async (url: string, init?: { signal?: AbortSignal }) => {
      const response = await fetch(url, { signal: init?.signal });
      return {
        ok: response.ok,
        status: response.status,
        json: async () => response.json() as Promise<unknown>,
      };
    };
  }

  const source = createPolymarketSource({ fetchImpl });
  const trending = await source.listTrending(Math.max(options.limit * 2, options.limit));
  const candidates = filterBlocked(
    trending.filter((market: SourceMarket) => isRideableMarket(market)),
    (market: SourceMarket) => market.tags,
  ).slice(0, options.limit);

  const tracks: TrackV1[] = [];
  for (const market of candidates) {
    const history = await source.getHistory(market);
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

async function main(): Promise<void> {
  // pnpm passes its own `--` separator through; ignore it.
  const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
  const now = new Date().toISOString();

  const existing = await readExistingTracks(options.out);
  const incoming: TrackV1[] = [];

  if (!options.liveOnly) {
    incoming.push(...(await buildRemixTracks(now)));
  }
  if (!options.remixOnly) {
    try {
      incoming.push(...(await buildLiveTracks(options, now)));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${reason} (hint: Polymarket is unreachable from this network; use --remix-only or --fixtures <dir> for offline runs)`,
      );
    }
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
