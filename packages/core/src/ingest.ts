/**
 * Manifest planning — the pure half of ingest.
 *
 * The CLI does the IO (fetch, read, write, commit); everything that decides
 * *what* the track set becomes lives here, so it can be tested offline and, in
 * Phase 4, reused unchanged with a database instead of JSON files.
 *
 * Rules:
 *   - a track id is content-addressed, so an existing file is never rewritten;
 *   - only the newest `keepPerSource` snapshots per market are kept, which
 *     bounds repo growth while keeping shared links alive for a while;
 *   - the index lists each market once (newest snapshot) and only changes
 *     when the set does — it is what Home renders;
 *   - a track the sensitive-markets filter blocks is never retained, and one
 *     already on disk is pruned, so adding a blocklist entry removes old
 *     frozen tracks instead of leaving them in the manifest.
 */
import type { TrackIndex, TrackSummary, TrackV1 } from './types.ts';

/** `generatedAt` for an index with no tracks at all — visibly "nothing yet". */
export const EMPTY_INDEX_GENERATED_AT = '1970-01-01T00:00:00.000Z';

/** Snapshots kept per market. Older ones are pruned. */
export const KEEP_PER_SOURCE = 2;

export function summarize(track: TrackV1): TrackSummary {
  const { series: _series, ...summary } = track;
  return summary;
}

/** Newest first, id as the tie-break so the order is total and stable. */
export function byNewest(a: TrackSummary, b: TrackSummary): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildIndex(tracks: TrackV1[]): TrackIndex {
  const summaries = tracks.map(summarize).sort(byNewest);
  return {
    version: 1,
    generatedAt: summaries[0]?.createdAt ?? EMPTY_INDEX_GENERATED_AT,
    tracks: summaries,
  };
}

/**
 * One entry per market: the newest snapshot of each `kind:sourceId`. Every
 * snapshot stays in the manifest; this is what the UI lists.
 */
export function dedupeNewest(summaries: TrackSummary[]): TrackSummary[] {
  const seen = new Set<string>();
  const out: TrackSummary[] = [];
  for (const summary of summaries.slice().sort(byNewest)) {
    const key = `${summary.kind}:${summary.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(summary);
  }
  return out;
}

export interface IngestPlan {
  /** Tracks not seen before, ready to write. */
  write: TrackV1[];
  /** Ids of snapshots that fell out of the retention window, plus blocked ones. */
  prune: string[];
  /** The complete retained set, newest first. Blocked tracks are never in it. */
  tracks: TrackV1[];
  index: TrackIndex;
}

export interface PlanOptions {
  keepPerSource?: number;
  /**
   * Sensitive-markets filter. A blocked track is never written or retained, and
   * a blocked track already on disk is pruned, so tightening the filter removes
   * old frozen tracks instead of leaving them in the manifest forever.
   */
  isBlocked?: (track: TrackV1) => boolean;
}

export function planIngest(
  existing: TrackV1[],
  incoming: TrackV1[],
  options: PlanOptions = {},
): IngestPlan {
  const keepPerSource = options.keepPerSource ?? KEEP_PER_SOURCE;
  const isBlocked = options.isBlocked ?? (() => false);

  // Blocked ids are collected before de-duplication so a blocked snapshot that
  // is also a retention victim still lands in `prune` exactly once.
  const blockedIds = new Set<string>();
  for (const track of [...existing, ...incoming]) {
    if (isBlocked(track)) blockedIds.add(track.id);
  }

  const byId = new Map<string, TrackV1>();
  for (const track of existing) {
    if (!blockedIds.has(track.id)) byId.set(track.id, track);
  }
  for (const track of incoming) {
    if (blockedIds.has(track.id) || byId.has(track.id)) continue;
    byId.set(track.id, track);
  }

  const write: TrackV1[] = [];
  const known = new Set(existing.map((track) => track.id));
  for (const track of incoming) {
    if (known.has(track.id) || blockedIds.has(track.id)) continue;
    write.push(track);
  }

  const kept = new Set<string>();
  const perSource = new Map<string, TrackSummary[]>();
  for (const summary of [...byId.values()].map(summarize).sort(byNewest)) {
    const key = `${summary.kind}:${summary.sourceId}`;
    const list = perSource.get(key) ?? [];
    list.push(summary);
    perSource.set(key, list);
  }
  for (const list of perSource.values()) {
    for (const summary of list.slice(0, keepPerSource)) kept.add(summary.id);
  }

  const pruneCandidates = [...byId.keys()].filter((id) => !kept.has(id));
  for (const id of blockedIds) pruneCandidates.push(id);
  const prune = [...new Set(pruneCandidates)].sort();
  const tracks = [...byId.values()]
    .filter((track) => kept.has(track.id))
    .sort((a, b) => byNewest(summarize(a), summarize(b)));

  // Files keep every retained snapshot; the index lists each market once
  // (newest snapshot), because the index is what Home renders.
  const listed = dedupeNewest(tracks.map(summarize));
  const listedIds = new Set(listed.map((summary) => summary.id));
  const listedTracks = tracks.filter((track) => listedIds.has(track.id));
  return { write, prune, tracks, index: buildIndex(listedTracks) };
}
