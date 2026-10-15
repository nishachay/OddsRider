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
- **Settled tracks are real history.** Famous resolved markets are frozen as
  `kind: 'closed'` with their final outcome (`YES`/`NO`, strict rails rule)
  shown on the card. They never appear in movers or headline the daily while
  live tracks exist.
- **Sensitive markets never become tracks** (`packages/core/src/banned.ts`).

## Layout

| Path | Role |
|---|---|
| `packages/core/src/` | Pure domain: types, zod schemas, LTTB, stats + difficulty thresholds, whole-word categorisation, window slicing, generator, Polymarket adapter (fetch injected), ingest planner |
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
pnpm ingest -- --live-only                            # skip the settled-markets pass
pnpm ingest -- --closed-only --fixtures <dir>         # offline pipeline test
pnpm ingest -- --live-only --fixtures packages/core/fixtures --limit 2 --out /tmp/tracks
pnpm ingest                                          # live (needs Polymarket access)
```

The ingest exits non-zero when nothing usable remains — a scheduled run with
no tracks is a visible failure, never an empty silent commit.

## Known limitations (Phase 4 moves these server-side)

- Until the first ingest lands, the card is empty and says so: the index is
  missing (`TRACKS_UNREACHABLE`) or has no tracks (`TRACKS_EMPTY`), each with
  its own clear message and retry.
- The daily feature is picked client-side from the frozen list (live first),
  so it can shift when the list gains new snapshots. A server-picked daily
  comes with accounts/leaderboards.
- Track JSON lives in git for now; the planner (`planIngest`) is already
  storage-agnostic so a database slots in without touching generation.
