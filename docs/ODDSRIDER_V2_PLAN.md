# OddsRider v2 — Rebuild Plan

> Hand this file to your coding agent (opencode). Put it in the repo at `docs/V2_PLAN.md`.
> Work on branch `v2`. One phase = one pull request into `v2`. Merge `v2` → `main` at launch.

---

## 0. Read this first (rules for the agent)

1. **Inspect the current code before changing anything.** This plan was written from an older GitHub snapshot (last push 2026-09-03). The local repo is newer. If something here conflicts with the code, trust the code and flag it.
2. **Do not change game physics or tuning.** `src/game/` (Phaser 3.90 + Matter, fixed-timestep manual stepping, bike/rider/ragdoll tuning, asset alignment) is proven. Only *additive* changes are allowed there: new files, new bus events, new optional hooks. Never edit existing constants, colliders, or step logic.
3. **Stack stays:** React 19, Vite, TypeScript strict, pnpm, Phaser 3.90.x, Tailwind v4.
4. **Locked design rules:** near-black UI, the glowing probability track is the visual hero, toxic green = probability rising, crimson = falling. **No** gradients, glassmorphism, rounded cards, emoji, or purple/blue palette. Follow `docs/DESIGN_SYSTEM.md` where it exists.
5. **No fake data, ever.** Every number shown as "live" must come from a real source. Invented tracks must be labelled `REMIX`.
6. **No real-money features.** The owner is in India, where prediction markets are banned (PROGA 2025, in force 1 May 2026; Polymarket blocked since May 2026). No trading, betting, deposits, cash prizes, or links/logos promoting Polymarket. Build the *hooks* for later (section 8) but keep them switched off.
7. After every phase: `pnpm build` passes, `pnpm test` passes, Playwright smoke test passes with **zero console errors**.
8. If you loop on the same error more than twice, stop and write down what you tried.

---

## 1. What's wrong today (fix list)

From `src/data/polymarket.ts`:

| # | Problem | Fix |
|---|---|---|
| 1 | `currentProb`, `probDelta`, `sparkline` for live markets are computed from `Math.sin(volumeNum)` — they are fake. | Use real values from the API (`outcomePrices`, price change fields, real price history). |
| 2 | `CURATED_POLYMARKET_FEED` uses placeholder token IDs (`btc-100k-token` …) and invented curves, presented as real. Legendary crashes (FTX, Terra, SVB) look real but aren't market data. | Replace with real closed markets fetched by the backend, or mark as `REMIX` (fictional) in data and UI. |
| 3 | Browser calls `gamma-api.polymarket.com` and `clob.polymarket.com` directly. Rate limits, CORS changes, outages, no shared cache, and Indian ISPs may block these domains. | All data comes from **our own API**. The client never talks to Polymarket. |
| 4 | Silent fallback to fake data after a 3–3.5s timeout. | Server-side retries + last-good snapshot. Client shows a clear error state if our API is down. |
| 5 | Track shape changes every load (live history). Leaderboards/daily challenge can't be fair. | Tracks are **frozen, versioned snapshots** with an ID and hash. |
| 6 | Categories via keyword matching (`'eth'` matches "Ethiopia"). | Use the source's tags/events, mapped to our categories. |
| 7 | No validation of API responses. | zod schemas at every external boundary. |
| 8 | `iconEmoji` field — violates design rules. | Remove; use category glyphs/text labels. |

---

## 2. Target architecture

```
oddsrider/
├─ apps/
│  └─ web/                 # existing Vite + React + Phaser app (moved here)
│     ├─ src/game/         # UNCHANGED except additive hooks
│     ├─ src/app/          # new shell: routes, screens, ui
│     └─ api/              # Vercel serverless functions (our API)
├─ packages/
│  ├─ core/                # shared types, zod schemas, track generation, scoring rules
│  ├─ sources/             # data source adapters (polymarket, manifold)
│  └─ db/                  # drizzle schema + client (Neon Postgres)
├─ .github/workflows/      # CI + scheduled ingest
└─ docs/
```

- **pnpm workspaces.** If the monorepo move is too disruptive in phase 1, keep the app at root and add `packages/*` first; move the app later.
- **Hosting:** Vercel. Pin serverless functions to a region **outside India** (e.g. `fra1` or `iad1`) in `vercel.json`.
- **Database:** Neon Postgres + Drizzle (same as the owner's `outtake` project).
- **Scheduled ingest:** GitHub Actions cron every 15 min calls `POST /api/cron/ingest` with a secret header (Vercel Hobby crons are limited to daily). Alternative: Cloudflare Worker cron.
- **Caching:** API responses get `Cache-Control: s-maxage=…, stale-while-revalidate=…` so the CDN serves most traffic.

---

## 3. Data layer (Phase 1)

### 3.1 Source adapter interface (`packages/sources`)

```ts
export interface SourceMarket {
  source: 'polymarket' | 'manifold';
  sourceId: string;          // market id in the source
  slug: string;
  question: string;
  category: Category;        // mapped from source tags
  status: 'open' | 'closed' | 'resolved';
  resolution?: 'YES' | 'NO' | null;
  probability: number;       // 0..1, real
  change24h: number | null;  // real
  volume24h: number | null;
  liquidity: number | null;
  endDate: string | null;
  externalIds: Record<string, string>; // e.g. { yesTokenId, noTokenId } — kept for future features
}

export interface SourceAdapter {
  id: SourceMarket['source'];
  listTrending(limit: number): Promise<SourceMarket[]>;
  listClosedNotable(limit: number): Promise<SourceMarket[]>;
  getHistory(m: SourceMarket): Promise<{ t: number; p: number }[]>; // unix seconds, 0..1
}
```

### 3.2 Polymarket adapter

- Discovery: Gamma `GET /events?active=true&closed=false&order=volume24hr&ascending=false&limit=50` (events, not raw markets, so multi-outcome events are handled). Verify exact params/fields at docs.polymarket.com before coding.
- Per market use real fields: `outcomes`, `outcomePrices`, `clobTokenIds` (JSON strings — parse), volume, liquidity, end date, tags.
- Only binary YES/NO markets for v2. Skip markets with low liquidity, `probability < 0.03 || > 0.97` (flat tracks), or under N history points.
- History: CLOB `GET /prices-history?market={yesTokenId}&interval=…&fidelity=…`. Prefer the batch endpoint if available.
- Closed notable markets for **Legendary**: Gamma with `closed=true`, sorted by volume; pick ones with dramatic curves (see stats below).
- Respect rate limits: sequential with small delay, exponential backoff, cap per run.

### 3.3 Manifold adapter (phase 1b, optional)

- Play-money markets; good second source. Public API at `api.manifold.markets` (verify endpoints for markets and probability history).

### 3.4 Track generation (`packages/core/track.ts`)

Pure, deterministic, unit-tested:

1. Sort points, dedupe, clamp to `[0.01, 0.99]`.
2. Downsample to a fixed count (e.g. 600 points) with LTTB so spikes survive.
3. Light smoothing that preserves extremes (don't kill cliffs).
4. Compute stats: `volatility` (stdev of deltas), `maxDrop`, `maxRise`, `range`, `length`.
5. Difficulty from stats: `EASY | MEDIUM | HARD | INSANE` (thresholds as constants, tested).
6. Output `TrackV1 { id, version: 1, source, sourceId, question, category, series, stats, difficulty, hash, createdAt }`.
7. `hash` = sha256 of the series → same input = same track.

Inversion ("ride NO") = `1 - p`, generated client-side from the same frozen track.

### 3.5 Database (`packages/db`, Drizzle)

```
markets      (id, source, source_id, slug, question, category, status, resolution,
              probability, change_24h, volume_24h, liquidity, end_date,
              external_ids jsonb, updated_at)           unique(source, source_id)
tracks       (id, market_id, version, series jsonb, stats jsonb, difficulty,
              hash unique, kind  -- 'live'|'legendary'|'remix', created_at)
daily_rides  (date primary key, track_id, sponsor_id null)
players      (id, guest_token_hash, handle null, created_at)
runs         (id, track_id, player_id, inverted bool, score int, time_ms int,
              finished bool, crash_pct real null, inputs bytea, verified bool default false,
              created_at)
sponsors     (id, name, url, logo_url, billboard_text, starts_at, ends_at, status)   -- phase 5
flags        (key primary key, value jsonb)                                        -- optional, env is fine
```

### 3.6 API endpoints (`apps/web/api`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/cron/ingest` | Secret header. Pulls sources → upserts markets → creates new track version if hash changed. Picks tomorrow's Daily Ride if missing. |
| GET | `/api/tracks?kind=live\|legendary\|remix&category=` | List for track select. CDN cache 5 min. |
| GET | `/api/tracks/:id` | Frozen track. Cache forever (`immutable`). |
| GET | `/api/daily` | Today's Daily Ride (UTC date) + countdown. |
| POST | `/api/runs` | Submit run (phase 4). |
| GET | `/api/leaderboard/:trackId` | Top runs (phase 4). |
| GET | `/api/runs/:id` | Run + inputs for replay/ghost (phase 3). |
| GET | `/api/og/run/:id` | Share image (phase 3). |

All responses validated with zod; errors return `{ error: { code, message } }`.

### 3.7 Phase 1 tasks

- [ ] Create branch `v2`.
- [ ] Set up pnpm workspaces + `packages/core`, `packages/sources`, `packages/db`.
- [ ] zod schemas for Gamma/CLOB responses (only the fields we use).
- [ ] Polymarket adapter + tests with recorded fixture JSON (no live calls in tests).
- [ ] Track generator + tests (determinism, clamping, difficulty thresholds, spike preservation).
- [ ] Drizzle schema + migration on Neon.
- [ ] `/api/cron/ingest`, `/api/tracks`, `/api/tracks/:id`, `/api/daily`.
- [ ] GitHub Actions scheduled workflow (every 15 min) calling ingest with secret.
- [ ] Replace `src/data/polymarket.ts` usage in the app with a small client (`src/app/api.ts`) hitting our API.
- [ ] Delete fake fields (`Math.sin` logic, placeholder token IDs, `iconEmoji`).
- [ ] Legendary: real closed markets, or curated curves explicitly stored as `kind='remix'`.

**Done when:** the app loads tracks only from our API, every number is real, the same track ID always renders the same terrain, and the browser makes zero requests to polymarket domains.

---

## 4. New experience — arcade first (Phase 2)

### 4.1 Routes (use React Router or TanStack Router; URLs must be shareable)

| Route | Screen |
|---|---|
| `/` | Title screen |
| `/tracks` | Track select |
| `/daily` | Daily Ride |
| `/ride/:trackId` (`?side=no`) | Ride |
| `/r/:runId` | Shared run (replay + "ride this track") |
| `/leaderboard/:trackId` | Leaderboard (phase 4) |

Remove the dashboard-style home (`HeroSpotlight`, `MarketGrid`, `MarketCard`, `Lobby`, big `Navbar`/`Footer`). Keep only what the new screens need.

### 4.2 Title screen

- Full-screen Phaser canvas with today's Daily Ride terrain in **attract mode** (camera slowly pans the track, or a ghost rides it).
- Big minimal logo, the market question, `PRESS ANY KEY` / `TAP TO RIDE`.
- Any key/tap → starts the Daily Ride practice run. **Goal: playing within 3 seconds of page load.**
- Small text links: Tracks · Leaderboard · How to play.

### 4.3 Track select

- Feels like a racing game level select, not a finance grid.
- Sections: **Daily** · **Trending** · **Legendary** · **Remix**.
- Each track row/tile: question (truncated), category label, difficulty, current probability (live tracks), mini track silhouette drawn from the series in green/crimson, your best time.
- Keyboard navigation (arrows + Enter) and touch.
- YES/NO side toggle (NO = inverted track). Wording: "Ride YES" / "Ride NO" — game sides, not bets.

### 4.4 Daily Ride

- One track per UTC day, same for everyone.
- One **scored** run per day per player; unlimited practice runs (clearly labelled).
- Countdown to next Daily Ride.
- Streak counter (local first, server later).

### 4.5 HUD (refine existing `HudOverlay`)

- Current probability under the rider, speed, time, mini-map of the full track with position marker.
- Trick popups (wheelie, air time, nitro) with score.

### 4.6 Mobile

- On-screen controls: throttle, brake/lean back, lean forward, nitro. Large hit areas, no hover dependence.
- Landscape prompt on portrait phones.
- Test on a mid-range Android phone.

### 4.7 Sound

- Engine pitch tied to speed, landing thud, crash sting, finish sting. Mute toggle remembered in localStorage. Keep it subtle.

### 4.8 Phase 2 tasks

- [ ] Router + new screen components under `src/app/screens/`.
- [ ] Attract mode (additive game hook: `bus.emit(EV.ATTRACT_START, track)`).
- [ ] Track select with keyboard + touch.
- [ ] Daily Ride flow + practice/scored distinction.
- [ ] Mobile controls feeding the same input system the keyboard uses.
- [ ] Sound manager.
- [ ] Remove old dashboard components.

**Done when:** a new visitor lands on `/`, presses a key, and is riding today's track in under 3 s on desktop; the whole flow works on a phone.

---

## 5. Results, sharing, ghosts (Phase 3)

### 5.1 Input recording (additive game hook)

- Record player inputs per fixed physics step as compact events: `[stepIndex, inputBitmask]` only when input changes. Store with run.
- Because physics is fixed-timestep and deterministic, replaying inputs on the same track reproduces the run. **Verify determinism first:** record a run, replay it 10×, positions at the end must match. If not, find nondeterminism (Math.random, variable dt, async loading) and fix in *new* code paths only — do not touch tuning.

### 5.2 Result screen (rework `ResultModal`)

- Score, time, finished/crashed, **crash point % and date on the curve** ("Crashed at 62% · 14 Mar").
- Instant crash replay (last ~3 s in slow motion) from recorded inputs.
- Buttons: Retry · Next track · Share.
- An empty, hidden **action slot** component (`<ResultActions />`) for future features (section 8).

### 5.3 Sharing

- `/api/og/run/:id` → 1200×630 image (Vercel OG): track silhouette, crash marker, score, question.
- Share text: `I rode "{question}" and crashed at {pct}% — beat me: {url}`.
- `/r/:runId` page shows replay + "Ride this track". Proper OG/Twitter meta tags.

### 5.4 Ghosts

- Ghost = replay of a stored run rendered as a translucent bike with **no collision** with the player (separate render-only body or separate Matter world). Additive code only.
- Options in track screen: race your best · race #1 · race a friend's shared run.

### 5.5 Phase 3 tasks

- [ ] Determinism test (automated).
- [ ] Input recorder + replayer.
- [ ] Result screen with crash replay.
- [ ] OG image endpoint + share flow + `/r/:runId`.
- [ ] Ghost rendering.

---

## 6. Players, leaderboards, anti-cheat (Phase 4)

- **Guest-first:** on first visit, create a guest player (random token in localStorage, hash stored server-side). No sign-up needed to play. Optional handle.
- Optional sign-in later (e.g. GitHub/Google) to keep streaks across devices.
- `POST /api/runs` with `{ trackId, inverted, inputs, claimedScore, claimedTimeMs }`.
- **Anti-cheat, stepwise:**
  1. Plausibility checks: time ≥ track minimum, score ≤ theoretical max, input rate sane, one scored Daily Ride per player per day, rate limit per IP/player.
  2. Server replay verification: run the physics headless in Node with the recorded inputs and compare score/time. Only feasible if the physics can run without Phaser rendering — investigate extracting a headless Matter step from the game; if too invasive, keep step 1 and mark runs `verified=false`.
- Leaderboards per track and per Daily Ride (top 100 + your rank). Only `verified` runs on the main board once step 2 exists.

---

## 7. Money, safe from India (Phase 5)

- **Sponsored Daily Ride / tracks:** sponsor name on title screen and track ("The Fed Ride, presented by X"), branded finish gate.
- **In-world billboards:** additive background layer in the game showing sponsor text/logo at set points along the track. Data from `sponsors` table.
- **Self-serve booking page** `/sponsor`: available dates, price, preview, checkout. Use a payment provider that supports an India-based seller selling globally (check Razorpay international, or a merchant of record like Paddle / Lemon Squeezy — confirm India support before building).
- **Allowed sponsors only:** no betting, trading, crypto-exchange, or money-game advertisers (Indian law bans advertising them). Manual approval step.
- **Cosmetics (later):** bike colours, rider suits, trails, crash effects. Pay-for-looks only, never pay-to-win. Stored per player.
- **Later:** Pro tier (any market URL → track, private leagues, unlimited ghosts), embeds for news sites (`/embed/:trackId`), game portals (Poki/CrazyGames builds).
- Talk to a lawyer familiar with PROGA before charging anyone.

---

## 8. Hooks for the future (build now, keep OFF)

- **Feature flags:** `packages/core/flags.ts` reading env/DB. Example: `TRADING_ACTIONS=false`, `SPONSORS=false`, `COSMETICS=false`.
- **Geo gate:** server reads `x-vercel-ip-country`; `/api/config` returns enabled features per country. Any money-related feature is hard-disabled for `IN` regardless of flags.
- **Result action slot:** `<ResultActions />` renders nothing unless a flag + geo allows it.
- **External IDs kept:** `markets.external_ids` stores source IDs (e.g. Polymarket token IDs) so future features can plug in without schema changes.
- **Game packaging:** keep `src/game` importable as its own module with a clean API (`mountGame(el, track, options)`) so it can be embedded or licensed separately.

---

## 9. Quality, CI, deploy (every phase)

- **Tests:** Vitest for `packages/*` (adapters with fixtures, track gen, scoring, flags). Playwright smoke: load `/`, start ride, ride 5 s, no console errors, result screen appears after forced crash.
- **CI:** GitHub Actions on PRs into `v2`: install, typecheck, lint, test, build, Playwright.
- **Env vars:** `DATABASE_URL`, `INGEST_SECRET`, flags. Never commit secrets.
- **Error monitoring:** add Sentry (or similar) to web + API.
- **Analytics:** privacy-friendly (Plausible/Umami or PostHog): track page load → first ride time, rides per session, share clicks, daily return.
- **Performance budget:** first ride under 3 s on desktop broadband; JS bundle split so Phaser loads in parallel with the title screen.

---

## 10. Phase order

1. Data backend + real data (section 3)
2. Title screen, track select, Daily Ride, mobile, sound (section 4)
3. Results, sharing, ghosts (section 5)
4. Players, leaderboards, anti-cheat (section 6)
5. Sponsors, cosmetics, launch deploy (sections 7, 9)

## 11. Launch checklist

- [ ] All data real; Remix tracks labelled.
- [ ] No Polymarket links/logos promoting trading; no money features enabled.
- [ ] Phone tested.
- [ ] OG share images work on X and WhatsApp.
- [ ] Daily Ride rotates at 00:00 UTC automatically.
- [ ] Sentry + analytics live.
- [ ] Landing clip ready: "I rode the election odds and crashed at 62%."

---

## 12. Gaps to close (added after review)

- **Verify against local code first.** This plan came from the 2026-09-03 GitHub snapshot. Push the latest local version before starting, and have the agent diff plan vs code.
- **Data terms:** read Polymarket's and Manifold's API/data terms before any commercial use (sponsors, Pro). Add source attribution text ("Data: Polymarket") without promotional links, if the terms require attribution.
- **Sensitive markets filter:** exclude markets about deaths, wars, attacks, disasters, and individuals' health from Daily Ride and every sponsored slot. Keep a manual blocklist plus keyword/tag filter in ingest.
- **Core game loop gaps:** confirm finish-line detection, scoring rules (distance, tricks, time bonus), and the end-of-track flow exist and work on frozen tracks; implement if missing (additive).
- **Loading and error states:** asset preloading with a minimal progress bar, offline/API-down screen, empty states for leaderboards.
- **Admin panel** (`/admin`, protected): approve sponsors, pick or override Daily Ride, blocklist markets, hide abusive handles.
- **Moderation:** profanity filter on handles; report button on shared runs.
- **Legal pages:** privacy policy, terms, cookie notice if analytics uses cookies; account/data deletion endpoint.
- **SEO:** per-track pages with titles and descriptions; sitemap of tracks.
- **Accessibility:** remappable keys, reduced-motion option (disables screen shake), colour-blind-safe up/down cue in addition to green/crimson (e.g. arrow glyphs).
- **Backups:** Neon point-in-time restore on; a test that ingest is idempotent (running twice creates no duplicate tracks).

---

## Starter prompt for opencode

> Read `docs/V2_PLAN.md` fully, then inspect the repo. Summarise any differences between the plan and the current code. Then start Phase 1 on branch `v2`: set up workspaces and `packages/core` with the track generator and its tests. Do not modify existing files in `src/game/`. Stop after the track generator tests pass and show me the diff.
