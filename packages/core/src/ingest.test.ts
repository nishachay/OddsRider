import { describe, expect, it } from 'vitest';
import { buildTrack, type TrackInput } from './generate.ts';
import {
  buildIndex,
  dedupeNewest,
  EMPTY_INDEX_GENERATED_AT,
  KEEP_PER_SOURCE,
  planIngest,
  summarize,
} from './ingest.ts';
import type { PricePoint, TrackKind, TrackV1 } from './types.ts';

function series(offset: number): PricePoint[] {
  return Array.from({ length: 20 }, (_, i) => ({
    t: 1_700_000_000 + i * 3600,
    p: 0.4 + offset + i / 200,
  }));
}

async function track(
  sourceId: string,
  {
    offset = 0,
    createdAt = '2026-10-01T00:00:00.000Z',
    kind = 'live',
  }: { offset?: number; createdAt?: string; kind?: TrackKind } = {},
): Promise<TrackV1> {
  const input: TrackInput = {
    kind,
    source: 'polymarket',
    sourceId,
    slug: `slug-${sourceId}`,
    question: `Will market ${sourceId} do the thing?`,
    category: 'TECH',
    status: 'open',
    probability: 0.5,
    change24h: 0.01,
    volume24h: 100_000,
    liquidity: null,
    endDate: null,
    series: series(offset),
  };
  return buildTrack(input, createdAt);
}

describe('summarize / buildIndex', () => {
  it('drops the series but keeps the hash', async () => {
    const built = await track('1');
    const summary = summarize(built);
    expect(summary).not.toHaveProperty('series');
    expect(summary.hash).toBe(built.hash);
  });

  it('sorts newest first and stamps the freshest snapshot', async () => {
    const older = await track('1', { createdAt: '2026-09-01T00:00:00.000Z' });
    const newer = await track('2', { createdAt: '2026-10-01T00:00:00.000Z' });
    const index = buildIndex([older, newer]);
    expect(index.tracks.map((t) => t.sourceId)).toEqual(['2', '1']);
    expect(index.generatedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('is honest about an empty manifest', () => {
    const index = buildIndex([]);
    expect(index.tracks).toEqual([]);
    expect(index.generatedAt).toBe(EMPTY_INDEX_GENERATED_AT);
  });
});

describe('dedupeNewest', () => {
  it('keeps one entry per market: the newest', async () => {
    const v1 = await track('1', { createdAt: '2026-09-01T00:00:00.000Z', offset: 0 });
    const v2 = await track('1', { createdAt: '2026-10-01T00:00:00.000Z', offset: 0.1 });
    const other = await track('2', { createdAt: '2026-09-15T00:00:00.000Z' });

    const list = dedupeNewest([summarize(v1), summarize(v2), summarize(other)]);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(v2.id);
    expect(list.map((t) => t.sourceId)).toEqual(['1', '2']);
  });

  it('treats a closed and a live track with the same source id as different', async () => {
    const live = await track('shared', { kind: 'live' });
    const closed = await track('shared', { kind: 'closed', offset: 0.2 });
    expect(dedupeNewest([summarize(live), summarize(closed)])).toHaveLength(2);
  });

  it('never drops a kind when only one exists', async () => {
    const closed = await track('only-closed', { kind: 'closed' });
    expect(dedupeNewest([summarize(closed)])).toHaveLength(1);
  });
});

describe('planIngest', () => {
  it('writes only what is new', async () => {
    const a = await track('1');
    const b = await track('2');
    const plan = planIngest([a], [a, b]);
    expect(plan.write.map((t) => t.id)).toEqual([b.id]);
    expect(plan.index.tracks).toHaveLength(2);
  });

  it('is idempotent: replaying the same ingest writes nothing', async () => {
    const first = planIngest([], [await track('1'), await track('2')]);
    expect(first.write).toHaveLength(2);

    const second = planIngest(first.tracks, [await track('1'), await track('2')]);
    expect(second.write).toEqual([]);
    expect(second.prune).toEqual([]);
    expect(second.index).toEqual(first.index);
  });

  it(`keeps at most ${KEEP_PER_SOURCE} snapshots per market`, async () => {
    const snapshots = [
      await track('1', { offset: 0, createdAt: '2026-09-01T00:00:00.000Z' }),
      await track('1', { offset: 0.05, createdAt: '2026-09-15T00:00:00.000Z' }),
      await track('1', { offset: 0.1, createdAt: '2026-10-01T00:00:00.000Z' }),
    ];
    const plan = planIngest([], snapshots);

    expect(plan.tracks).toHaveLength(KEEP_PER_SOURCE);
    expect(plan.prune).toEqual([snapshots[0].id]);
    // The freshest snapshot survives, so shared links keep working.
    expect(plan.tracks[0].id).toBe(snapshots[2].id);
  });

  it('does not prune across markets', async () => {
    const plan = planIngest([], [await track('1'), await track('2'), await track('3')]);
    expect(plan.prune).toEqual([]);
    expect(plan.tracks).toHaveLength(3);
  });

  it('accepts a custom retention window', async () => {
    const snapshots = [
      await track('1', { offset: 0, createdAt: '2026-09-01T00:00:00.000Z' }),
      await track('1', { offset: 0.1, createdAt: '2026-10-01T00:00:00.000Z' }),
    ];
    const plan = planIngest([], snapshots, { keepPerSource: 1 });
    expect(plan.tracks).toHaveLength(1);
    expect(plan.prune).toHaveLength(1);
  });

  it('lists each market once in the index: the newest snapshot', async () => {
    const snapshots = [
      await track('1', { offset: 0, createdAt: '2026-09-01T00:00:00.000Z' }),
      await track('1', { offset: 0.05, createdAt: '2026-09-15T00:00:00.000Z' }),
      await track('1', { offset: 0.1, createdAt: '2026-10-01T00:00:00.000Z' }),
      await track('2', { createdAt: '2026-09-20T00:00:00.000Z' }),
    ];
    const plan = planIngest([], snapshots);

    // Files keep both retained snapshots; the index (what Home renders)
    // lists market 1 once, at its newest snapshot.
    expect(plan.tracks).toHaveLength(KEEP_PER_SOURCE + 1);
    expect(plan.index.tracks).toHaveLength(2);
    const keys = plan.index.tracks.map((t) => `${t.kind}:${t.sourceId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(plan.index.tracks.find((t) => t.sourceId === '1')?.id).toBe(snapshots[2].id);
    expect(plan.index.generatedAt).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('planIngest with the sensitive-markets filter', () => {
  it('prunes a frozen track that the blocklist now names', async () => {
    const blocked = await track('4641065', { createdAt: '2026-10-15T00:00:00.000Z' });
    const kept = await track('2', { createdAt: '2026-10-14T00:00:00.000Z' });

    const plan = planIngest([blocked, kept], [], { isBlocked: (t) => t.sourceId === '4641065' });

    expect(plan.prune).toEqual([blocked.id]);
    expect(plan.tracks.map((t) => t.sourceId)).toEqual(['2']);
    expect(plan.index.tracks.map((t) => t.sourceId)).toEqual(['2']);
  });

  it('never writes a blocked incoming track, even when it is new', async () => {
    const plan = planIngest([], [await track('blocked'), await track('ok')], {
      isBlocked: (t) => t.sourceId === 'blocked',
    });

    expect(plan.write.map((t) => t.sourceId)).toEqual(['ok']);
    expect(plan.tracks.map((t) => t.sourceId)).toEqual(['ok']);
  });

  it('is idempotent once the blocked track is gone', async () => {
    const blocked = await track('blocked');
    const filter = (t: TrackV1) => t.sourceId === 'blocked';
    const first = planIngest([blocked], [], { isBlocked: filter });
    const second = planIngest(first.tracks, [], { isBlocked: filter });

    expect(first.prune).toEqual([blocked.id]);
    expect(second.prune).toEqual([]);
    expect(second.index).toEqual(first.index);
  });

  it('leaves tracks alone when no filter is supplied', async () => {
    const plan = planIngest([await track('4641065')], []);
    expect(plan.prune).toEqual([]);
    expect(plan.index.tracks.map((t) => t.sourceId)).toEqual(['4641065']);
  });
});
