# OddsRider track data pipeline (light Phase 1)

The browser never talks to Polymarket. A scheduled job freezes real
probability series into immutable JSON, and the app reads only that.

```
Polymarket Gamma/CLOB ──fetch, validate──▶ scripts/ingest.ts ──write──▶ public/tracks/
        (CI runners only)   (zod)            (@oddsrider/core)      *.json + index.json
                                                                        │
Browser ──fetch, validate──▶ src/data/tracks.ts ◀── /tracks/*.json ─────┘
              (zod)                │
                                   ▼
                        frozen TrackV1 → Phaser terrain
```

## Rules

- **Frozen, content-addressed tracks.** `id = <source>-<sha256(series)[:12]>`.
  The same id is always the same terrain, so `/ride/<id>` links stay fair.
- **No silent fallbacks.** A missing or malformed index/track is a typed
  `TrackFeedError` (`TRACKS_UNREACHABLE` / `TRACKS_INVALID` / `TRACKS_EMPTY`)
  and the UI shows a clear error state with a retry. Nothing is invented.
- **Official numbers travel frozen.** Cards, preview and HUD all show the
  track's frozen `probability` / `change24h`. The live under-wheels value
  (`EV.PROB`) feeds only the minimap dot and the result screen.
- **Remix is quarantined.** Hand-drawn tracks are `kind: 'remix'`, carry no
  volume/liquidity/24h change, are badged REMIX, and never appear in the live
  card, movers, or (while live tracks exist) the daily feature.
- **Sensitive markets never become tracks** (`packages/core/src/banned.ts`).

## Layout

| Path | Role |
|---|---|
| `packages/core/src/` | Pure domain: types, zod schemas, LTTB, stats + difficulty thresholds, whole-word categorisation, window slicing, generator, remix definitions, Polymarket adapter (fetch injected), ingest planner |
| `packages/core/fixtures/` | Recorded Gamma/CLOB shapes for adapter tests (synthetic values, clearly labelled) |
| `scripts/ingest.ts` | IO half: fetch → filter → build → plan → write. Run with `pnpm ingest` (Node 22 type-stripping, no extra deps) |
| `public/tracks/` | Published output: `<track-id>.json` + `index.json`. Committed, CDN-cached, immutable files |
| `src/data/tracks.ts` | Browser client: fetch + validate + view model + ride builder |
| `src/data/polymarket.ts` | 3-line compatibility shim for the untouched game engine (`fetchRide`, `Ride`, `Difficulty`, `PricePoint`) |
| `.github/workflows/ingest.yml` | Every 6h + manual dispatch; commits only when the set changed |

## Retention

Each market keeps its newest 2 snapshots (`KEEP_PER_SOURCE`). New hashes
arrive as markets move; older files are pruned so the repo stays small, while
recently shared `/ride/<id>` links keep working.

## Running it

```bash
pnpm ingest -- --remix-only                          # offline: remix tracks only
pnpm ingest -- --live-only --fixtures packages/core/fixtures --limit 2 --out /tmp/tracks
pnpm ingest                                          # live (needs Polymarket access)
```

The ingest exits non-zero when nothing usable remains — a scheduled run with
no tracks is a visible failure, never an empty silent commit.

## Known limitations (Phase 4 moves these server-side)

- Until the first live ingest lands, the card shows remix tracks only. The
  empty/error states cover every other case honestly.
- The daily feature is picked client-side from the frozen list (live first),
  so it can shift when the list gains new snapshots. A server-picked daily
  comes with accounts/leaderboards.
- Track JSON lives in git for now; the planner (`planIngest`) is already
  storage-agnostic so a database slots in without touching generation.
- No legendary (real closed-market) ingestion yet: closed-market fetching
  exists in the adapter but is unwired until its params can be verified
  against the live API.
