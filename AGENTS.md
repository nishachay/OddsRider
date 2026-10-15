# AGENTS.md

OddsRider: browser motocross game where real Polymarket probability charts become rideable terrain. React shell + Phaser 3 (Matter) game that mounts on `/` (arcade attract backdrop, no HUD) and `/ride/:marketId` (playable, with HUD).

## Commands

- Package manager is **pnpm** (`pnpm-lock.yaml` exists; there is no `package-lock.json`). Never npm/yarn.
- `pnpm dev` — Vite dev server (`:5173`).
- `pnpm build` — `tsc --noEmit` (strict) + Vite build. **The only verification gate: no tests, lint, or CI exist** (no test/lint scripts in `package.json`, no `.github/`).
- `pnpm preview` — serves `dist/` on `:4173`; root `*.cjs` helpers expect that port.

## Routes & data (see README for the full contract)

- `/` home (hero, daily challenge, trending, legendary crashes) · `/preview/:marketId` (track preview, timeframe select, your runs) · `/ride/:marketId` (game) · `/about`. Unknown paths redirect to `/`.
- Ride params: `?side=no` rides the inverted NO track, `?tf=24H|7D|ALL` picks the price-history window (`RidePage.tsx`).
- `src/data/polymarket.ts` fetches Gamma (odds/metadata) + CLOB (price history); `marketsContext.tsx` owns feed/cache state; `playerStorage.ts` keeps stats in localStorage (no accounts).
- Data honesty (README, binding): odds are last-trade Gamma prices; tracks map CLOB history 1:1 with no smoothing; uncomputable 24h change shows "—"; untrackable markets say so; unreachable feed shows a cached-markets notice. Never invent stats.
- Odds flow (do not re-derive): `EV.MARKET` carries the market's official `currentProb`/`probDelta` (cards = preview = HUD); `EV.PROB` is the live under-wheels interpolation for the minimap dot + result screen only. Feed state lives in `marketsContext` (`feedError`, `reload()`, silent 60s poll, same-feed dedupe).
- Deploys as static site (`vercel.json` SPA rewrites).

## Stack pins (do not upgrade casually)

- **Phaser 3.90.0** pinned; Matter physics comes bundled inside Phaser — do NOT add `matter-js`.
- React 19 + Tailwind CSS v4, CSS-first: tokens in `src/index.css` `@theme`, no `tailwind.config`.
- Fonts load via Google Fonts `<link>` in `index.html` (Space Grotesk + Geist Mono). Canvas code in `TrackRenderer.ts` / `RideScene.ts` / `finish.ts` references `'JetBrains Mono'`, which is **not** loaded — it silently falls back to monospace. Don't add font families without loading them.

## Architecture

```
src/App.tsx                      BrowserRouter + MarketsProvider + ScrollToTop, 4 routes
src/pages/                       HomePage / PreviewPage / RidePage / AboutPage
src/components/                  Navbar, Footer, MarketCard/Grid, HeroSpotlight, DailyChallenge,
                                 TrackPreview, HudOverlay, CountdownGate, ResultModal, TouchControls
src/game/
  config.ts        gravity y:1.1, matter autoUpdate:false, input.keyboard:false, scenes [Boot, Ride]
  constants.ts     ALL tuning: PALETTE, STEP_MS=1000/60, MAX_STEPS_PER_FRAME=4, BIKE, TUNING, WORLD, SPRITE
  bus.ts           emitter bridging Phaser scene → React HUD
  terrain.ts + track/TrackRenderer.ts   CLOB history → physics bodies + glow rendering
  scenes/BootScene.ts   loads public/assets/game/{bike,wheel,rider,ragdoll,flag}.png
  scenes/RideScene.ts   fixed-step accumulator, camera follow, score/tricks, auto-respawn,
                        exposes window.__oddsrider debug handle
  bike/Bike.ts     bodies + suspension constraints + drive/lean/nitro/jump + enforceIntegrity +
                   crash detection + ejectRider() ragdoll (one class)
  bike/BikeRenderer.ts  rear-wheel-hub-anchored ("Wheel-First") sprite rendering
  bike/CyberEffects.ts  particles/camera-shake juice
  input/InputManager.ts window-level keydown/keyup Set<code>, NOT Phaser keyboard (R/M/Space are edge-triggered)
  score.ts / finish.ts / audio.ts
public/assets/game/  processed PNGs   public/assets2/  original AI sources (never delete)
```

## Physics rules (hard-won — do not regress)

- Matter steps **manually**: accumulator in `RideScene` (`STEP_MS`, max 4 steps/frame), `autoUpdate: false`. Never let Phaser auto-step.
- Gravity is **1.1**. Tuning in `constants.ts` is **per-step** (Matter velocities are px/step; ×60 for px/s display).
- `Bike.enforceIntegrity()` runs every step after `world.step` (terminal-velocity caps + wheel-socket clamping). Removing it lets soft-constraint wheels blow out on hard landings.
- Drive/lean mutate angular velocity directly; nitro applies force along chassis angle; jump is a one-shot velocity set gated by grounded/coyote.

## Sprite alignment (locked — do not eyeball-tune)

`SPRITE` (`constants.ts:120`) mirrors `perfect_assets.ts` (`wheelR: 25` in both, matched to the visual tire). Rendering anchors on the **rear wheel hub**. If art looks off, re-measure headlessly (`dump_*.cjs` / `measure_*.cjs`) — don't nudge numbers.

## Design language (race-day program — the old terminal spec is retired)

Site chrome is a **race-meet program**, not the old boxed terminal: Anton poster headlines/odds (`font-poster`, loaded via Google Fonts in `index.html`), Space Grotesk questions, Geist Mono data; toxic `#b6ff00` / crimson `#ff3355` on near-black; scrolling odds ticker + live UTC clock for aliveness; numbered racecard rows (not grids); full-bleed YES/NO actions; no corner reticles, no `[ bracket ]` buttons. Motion system (`index.css`, CSS-only — no animation deps): expo easing `cubic-bezier(0.16,1,0.3,1)`, `.rise` stagger reveals on rows/rail (transform+opacity only), `active:scale` press states on CTAs, `.shimmer` skeleton for the stage loader; glow shadows only on the single arcade CTA. `docs/DESIGN_SYSTEM.md` is **superseded** for site chrome — its honesty/palette core still applies to the in-game HUD, which is untouched and must stay that way.

## Headless verification (no display on this box)

- `playwright` is a devDependency; drive `window.__oddsrider` (x/y/angle/speed/grounded/crashed/nitro/reset) against the preview server on `:4173` and assert telemetry (speed ramps, |angle| small, x progresses, zero console errors) + screenshots.
- `smoke_test.cjs` still hardcodes a stale Windows screenshot path (`E:/OddsRider/screenshot.png`) — override the path when reusing it.

## Code traps

- TS `noUnusedLocals` + `noUnusedParameters` — unused imports fail the build.

## Repo conventions

- Remote `github.com/nishachay/OddsRider`, branch `main`, local git identity configured. Concise imperative commits (e.g. `Phase 1: core ride loop foundation`).
- `HANDOFF.md` has deep background, but its status/plan sections lag the code (e.g. it claims `pixelArt:true`, which `config.ts` doesn't set) — trust code + `git log` over it.
