# OddsRider — Agent Handoff Document

Read this together with `AGENTS.md` (repo root). `AGENTS.md` = standing rules. This file = full project state, the exact current blocker, and the complete remaining plan. Everything here is verified fact unless marked GUESS/UNVERIFIED.

---

## 1. What this project is

**OddsRider**: browser-based 2D physics motocross game where **Polymarket probability charts become rideable terrain**. You bet on a market, then physically ride its probability line — rising odds = uphill glow-green segments, falling = red drops. Finish without crashing to win.

Master spec is V2 (user holds it; its decisions are repeated throughout this doc). **Phased build order is locked. Do not redesign creative choices.**

Locked creative choices:
- **Dark Cyber Dirt Bike** only (one bike, no garage)
- Near-black background (`#0a0a0b`), the **glowing probability track is the visual hero**
- Betting-terminal aesthetic ("anti-AI-slop"): radius-0 corners, 1px `#232529` borders, mono numerals (JetBrains Mono), Archivo expanded wordmark, toxic `#b6ff00` + crimson `#ff3355` accents used sparingly
- **Banned**: gradients on UI, glassmorphism, rounded cards, emoji, purple/blue palettes
- Tokens live in `src/index.css` `@theme` + `PALETTE` in `src/game/constants.ts`. Change them there, never inline.

## 2. Stack (pinned — do not upgrade casually)

- **pnpm** only (never npm/yarn)
- **Phaser 3.90.x** — spec locks Phaser 3; Phaser 4's Matter API surface differs
- React 19 + Tailwind CSS v4 (CSS-first, theme in `@theme`, no tailwind.config)
- Matter physics comes bundled inside Phaser — do NOT add `matter-js`
- TypeScript strict (`tsc --noEmit` with noUnusedLocals/noUnusedParameters)
- `pnpm build` = typecheck + vite build = **the only verification gate** (no tests/lint yet)

## 3. Architecture (current, working)

```
src/game/
  config.ts        Phaser config: gravity y:1.1, matter autoUpdate:false, input.keyboard:false,
                   render pixelArt:true, fps target 60 min 30
  constants.ts     ALL tuning numbers: PALETTE, STEP_MS=1000/60, MAX_STEPS_PER_FRAME=4,
                   BIKE geometry, TUNING (per-step units!), WORLD, SPRITE
  bus.ts           tiny emitter bridging Phaser scene → React HUD (EV.SPEED/MUTE/INPUT_FIRST/NITRO/CRASH)
  scenes/BootScene.ts   loads assets/game/{bike,wheel,rider,ragdoll,flag}.png
  scenes/RideScene.ts   fixed-step accumulator loop, camera lerp follow w/ lookahead,
                        ground + tick marks + distance labels, START/FINISH gates, auto-respawn
  bike/Bike.ts     ONE class: chassis+2 wheels+head bodies, 2 suspension constraints/wheel
                   (stiffness 0.62/damping 0.2) + 2 head pins, contact counting via
                   collisionstart/end, drive/lean/park/nitro/jump, world.step inside step(),
                   enforceIntegrity(), crash detection, ejectRider() ragdoll, reset(), destroy()
  bike/BikeRenderer.ts  sprite renderer synced to body poses (bike/wheels/rider/ragdoll + nitro flame graphics)
  input/InputManager.ts window-level keydown/keyup Set<code> (NOT Phaser keyboard),
                        edge-triggered R (reset) / M (mute) / Space (jump)
src/components/HudOverlay.tsx  React HUD: wordmark, speed px/s, nitro 10-segment meter, mute, hints, crash flash
public/assets/game/  processed game-ready PNGs (bike 300×162, wheel 80×80, rider 63×84, ragdoll 121×92, flag 20×128)
public/assets2/      original AI-generated sources (large, keep as source of truth for reprocessing)
```

## 4. Physics rules (hard-won — do not regress)

These were learned by porting the proven ornn-rider reference implementation (https://github.com/ayush-that/ornn-rider, StonkRider-style). The first custom-physics attempt collapsed; do not "improve" these without extreme care:

- Matter world steps **manually**: fixed accumulator in RideScene, `STEP_MS = 1000/60`, max 4 steps/frame, `autoUpdate:false`. Never let Phaser auto-step.
- Gravity **1.1** (not default 1).
- All tuning in `constants.ts` TUNING as **per-step units** (matter velocities are px/step; ×60 for px/s display).
- Bike bodies: chassis 90×22 rect (density 0.0022, frictionAir 0.012), wheels r20 (±56,+18 chassis-local, friction 1.4/static 2.0, frictionAir 0), head r11 at (-6,-30).
- `Bike.enforceIntegrity()` runs EVERY step after `world.step`: velocity caps (fall 20, horiz 48 px/step) + wheel-socket clamping (lat ±8, vert travel −8..+20, hard snap at ±55, bump-stop compress 8). Removing it = soft-constraint wheels blow out on hard landings ("works then collapses").
- Drive/lean mutate angular velocity directly (maxWheelAv 1.3, accel 0.12, wheelie torque 0.018 capped av 0.11, flipLean 0.05 air / groundLean 0.006). Nitro = force along chassis angle (0.0029×mass), latch/arm logic, tank drain 0.4/s trickle 0.05/s. Jump = one-shot vy set (−6.5), gated grounded/coyote(6 steps)/cooldown 350ms.
- Park damping zeroes velocities when idle+grounded+speed<0.6 (kills spring jitter).
- Crash: head contact while tilt>0.9, or touching+tilt>2.4 sustained 900ms, or y>killY. On crash → `ejectRider()` flings a ragdoll body (14×30 chamfered rect, own collision group, chassis velocity + forward-up impulse), camera chases ragdoll, auto-respawn after 900ms.
- Debug handle `window.__oddsrider` exposes x/y/angle/speed/grounded/crashed/nitro/reset — used by headless smoke tests.

Verified telemetry (last passing run): speed ramps 325→1184 px/s under gas, |angle| stays <0.07 cruising, wheelie recovers, jump raises y ~44px, reset returns x=320, **zero console errors**.

## 5. WHERE WE ARE STUCK (exact current state)

**Task in progress:** replacing procedural placeholder sprites with user-generated AI art and wiring rider + ragdoll. Code is fully written; **visual alignment verification is pending.**

Sequence of events:
1. User generated 5 AI images → placed in `public/assets2/` (bike 2816×1536, wheel/rider/ragdoll 2048², flag 1440×2912, all RGBA PNGs).
2. Built a playwright-based processor (`process-assets.mjs`) that trims alpha-bbox + resizes → wrote `public/assets/game/*.png`. Works.
3. Wired into code: BootScene paths, BikeRenderer (bike origin/scale, wheels scale 0.5, rider mounted at SEAT_LOCAL, ragdoll follows ejected body), `Bike.ejectRider()` + reset cleanup, RideScene camera-chases-ragdoll + gate label colors. Deleted old `public/assets/px/`.
4. First alignment attempt WRONG: a density-scan for hub centers locked onto the engine block (hubs actually sit lower). Game showed bike art floating above the physics wheels.
5. Two independent methods then AGREED on true hub centers in processed `bike.png` (300×162): **rear (33,144), front (267,138)** (full-image ring-Hough peaks + ASCII alpha-map blob centroids). Span 234px ↔ physics wheelbase 112 → **scale = 112/234 ≈ 0.4786**. Chassis-center in sprite coords = hub midpoint (150,141) minus world axle offset (0,+18)/scale → **(150, 103.4)** → origin (0.5, 0.6382).
6. `SPRITE` in `src/game/constants.ts` was JUST updated with these corrected values:
   ```ts
   bikeScale: 112/234, bikeOriginX: 150/300, bikeOriginY: 103.4/162,
   wheelScale: 0.5, seatLocalX: -10, seatLocalY: -26, riderOriginY: 0.55, flagScale: 0.5
   ```
7. `pnpm build` was started and **ABORTED mid-run by the user** — typecheck status UNKNOWN. **First action: run `pnpm build`.**
8. Dev server is running on port 5173 (`--host 0.0.0.0`, vite dev serves latest source on refresh — no rebuild needed for user's localhost view).

### Immediate TODO list (in order)
1. `pnpm build` — fix any typecheck errors (should be none; last full build passed before the constants edit).
2. Ask user to hard-refresh http://localhost:5173 and eyeball:
   - bike art hubs aligned with drawn wheel sprites at rest, under suspension compression, and mid-rotation
   - rider sitting on the seat plausibly (`seatLocalX:-10, seatLocalY:-26` is a GUESS derived from seat-pad position in the art — tune ±10px as needed; rider origin y 0.55 also a guess)
   - ragdoll eject on crash looks right (ragdoll origin 0.5/0.5, scale 0.5)
   - flag gates look right (origin 0.5/1 planted on ground, height 64 world px)
3. If alignment still off: re-measure. Reliable methods (scripts existed in `/tmp/opencode/smoke/` but `/tmp` is wiped between sessions — recreate from specs below):
   - **Ring Hough**: edge pixels (alpha>60 adjacent to alpha<25), vote centers step 3 over whole image, radii 16–42 step 2, score = count/(2πr), take top peaks separated >45px. This found the correct hubs.
   - **ASCII alpha dump**: draw image to canvas, print alpha as text grid (3px blocks) — lets a text-only model "see" shapes.
4. Run headless smoke test (procedure §7), confirm zero console errors + telemetry still passes + take screenshots.
5. Commit (concise imperative, e.g. `Phase 1: AI art integration + rider/ragdoll`). Push needs user PAT (§8).

### Known accepted quirks (decided, don't churn)
- AI bike art has wheels baked in despite "no wheels" prompt — accepted; the separately-drawn wheel sprites cover them.
- Physics wheels r=20 (40px world) vs baked art tires ≈29px world — decided: keep proven physics untouched, draw wheel sprites at 40px (slightly larger than baked tires).
- Art hubs differ vertically by 6px (144 vs 138) — art isn't perfectly level; physics forces level; ~2.4 world px discrepancy, negligible.
- Ragdoll uses its own collision group (collides with bike) — matches reference behavior.

## 6. Asset pipeline (reproducible)

Sources in `public/assets2/` (never delete). Processing = headless chromium page (playwright) because images must be decoded on canvas:

```
read public/assets2/<name>.png → base64 → page.evaluate:
  Image decode → alpha bbox trim → resize:
    bike → width 300 (keep aspect)     wheel → 80×80 (square, from max bbox side)
    rider → height 84                  ragdoll → height 92
    flag → height 128
  → canvas.toDataURL → node writes public/assets/game/<name>.png
```
Gotchas: pass images as base64 data URIs (file:// blocked in about:blank); b64 map keys are names without extension; `chromium.launch()` from playwright installed under `/tmp/opencode/smoke/node_modules`.

If re-processing or generating NEW art: prompts used originally (Nano Banana style): dark cyber dirt bike, side view facing right, matte black body panels with toxic green (#b6ff00) accent lines, NO background, transparent PNG. Wheel: symmetric knobby tire with rim, centered. Rider: seated attack position character in dark gear + helmet, side view facing right. Ragdoll: same character limp/crash pose. Flag: tall pole with pennant.

## 7. Environment: WSL, no display (critical operational knowledge)

- Working dir `/mnt/e/OddsRider` (Windows mount — slow first builds, ~10s+).
- **Headless testing** substitutes for playtesting:
  - Playwright + chromium-headless-shell installed under `/tmp/opencode/smoke` with system libs extracted to `/tmp/opencode/libs/root/usr/lib/x86_64-linux-gnu` (no sudo on box).
  - Run node with `LD_LIBRARY_PATH=/tmp/opencode/libs/root/usr/lib/x86_64-linux-gnu`.
  - **`/tmp` is wiped between sessions.** Reinstall pattern: `npm i playwright` in /tmp/opencode/smoke, then `apt-get download <missing libs>` + `dpkg -x` into that libs root (libs historically needed: libnss3, libnspr4, libatk1.0-0, libatk-bridge2.0-0, libcups2, libdrm2, libxkbcommon0, libatspi2.0-0, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1, libasound2 — download whatever ldd says is missing).
- Smoke test procedure:
  1. `(pnpm exec vite preview --port 4173 --host 127.0.0.1 &)` from repo root; poll `curl http://127.0.0.1:4173/` until 200 (~12s cold start). Plain `localhost` can resolve IPv6 and fail in WSL.
  2. Node script drives the page: wait for `window.__oddsrider`, dispatch keyboard events (ArrowRight gas, ArrowUp/Down lean, Space jump, ShiftLeft nitro, KeyR reset), sample telemetry every ~500ms, assert: speed ramps, |angle| small, x progresses, zero console errors. Save screenshots.
  3. `browser.close()`/`pkill` often hangs past shell timeout — results already printed; treat timeout-after-output as success.
  4. Kill preview server afterwards.
- A vite dev server may already be running on :5173 (check `ss -tlnp | grep 5173`). User views it from Windows browser at http://localhost:5173.

## 8. Git / pushing

- Remote `github.com/nishachay/OddsRider`, branch `main`. Identity configured locally (nishachay / nishachay@users.noreply.github.com).
- Commits: concise imperative (`Phase 1: core ride loop foundation`).
- **Pushes require a user-supplied PAT** (fine-grained, Contents: Read+Write). Never persist tokens to `.git/config`. One-time push pattern:
  `git push https://<TOKEN>@github.com/nishachay/OddsRider main` (ask user to paste token, use once, don't store).
- State: commit `abe7586` (Phase 1 foundation) is pushed. Commit `ef5ee60` (proven physics + pixel sprites) is LOCAL ONLY — unpushed. Today's art-integration changes are UNCOMMITTED.

## 9. Remaining plan (spec V2 phases — in order, don't skip ahead)

### Phase 1 (current) — FINISH
Complete §5 TODO list. Phase 1 scope: controllable Dark Cyber Dirt Bike on flat test ground with distance markers, START/FINISH gates, speed/nitro HUD, crash + ragdoll + respawn, AI art. Done when visually verified + committed (+ pushed).

### Phase 2 — Polymarket data → probability terrain + scoring (the core novel mechanic)
1. **Data**: Polymarket Gamma API (`https://gamma-api.polymarket.com`, public/no key) for markets/events (`/markets`, `/events`, filter active, single-outcome binary markets ideal). Price/probability history via CLOB `https://clob.polymarket.com/prices-history?market=<clobTokenId>&interval=<1m|1w|1d|max>&fidelity=<minutes>` — clobTokenIds come from Gamma market JSON (`clobTokenIds` field, JSON-encoded array). UNVERIFIED: exact field shapes drift; inspect live responses first. If CORS blocks browser calls, add a tiny vite dev middleware proxy (server-side fetch) rather than changing app architecture.
2. **Market selection UI (minimal)**: dropdown/search of a few curated active markets (e.g. by volume) + "RIDE" button. Betting-terminal styling.
3. **Probability series → terrain**:
   - Fetch probability history for chosen outcome (0..1). Resample to N control points spanning `WORLD.finishX` (start at spawnX). Map probability p → world height (invert so riding feels like climbing rising odds; decide direction: higher probability = higher elevation).
   - Smooth (moving average / Catmull-Rom), clamp slope so the bike can actually traverse (physics is tuned for mild slopes; cap maybe ±35° segment angle, playtest).
   - Render as THE VISUAL HERO: thick glowing track line — toxic `#b6ff00` segments where probability rising, crimson `#ff3355` falling, glow via layered strokes (wide low-alpha + narrow bright). Fill under line near-black surface like current ground.
   - Physics ground: replace flat rectangle with static bodies following the heightmap. Prefer many thin static rectangles/trapezoids per segment (Matter `Bodies.fromVertices` needs poly-decomp for concave shapes — avoid; segment chaining is simpler and robust). Keep `label:'ground'` so Bike contact logic works unchanged. Extend integrity/clamps only if needed.
   - Gates: START at spawn, FINISH at end. Distance markers along track.
4. **HUD integration**: live market question + current probability % (bus event from scene, e.g. `EV.PROB`), payout/EV readout.
5. **Scoring**: reach FINISH without crash → win (payout per market odds at ride start); crash or fall → lose. Result overlay (React, betting-terminal style) with retry.
6. Verify: build + headless smoke (mock/stub API in test; real API manual check by user) + user playtest.

### Phase 3 — Home page / markets / share card
- Home page (React route or scene swap): OddsRider wordmark, market list cards (radius-0, 1px borders, mono numerals), featured market hero, "how it works" strip. No gradients/rounded corners.
- Routing: react-router or simple state switch between Home ↔ Ride.
- Share card: canvas-rendered PNG (result + market question + final odds + time) downloadable/copied — betting-terminal styled, for socials.

### Phase 4 — Mobile / juice / caching
- Touch controls: left half = brake, right half = gas, on-screen buttons lean back/fwd, jump, nitro (pointer events, InputManager extension).
- Juice: landing dust particles, tire trail, subtle camera kick on land/crash, WebAudio-synthesized engine hum + nitro whoosh (no audio assets), screen flash already exists for crash.
- Caching/perf: localStorage market cache with TTL, preload assets, keep bundle lean.

## 10. Code conventions & traps learned

- TS strict with noUnusedLocals/noUnusedParameters — watch unused imports.
- Don't name class fields `renderer` inside Scene subclasses (Phaser.Scene has `renderer`) — use `bikeRenderer`.
- Matter body `label` isn't in Phaser types: cast `(pair.bodyA as unknown as { label: string }).label`.
- collisionFilter needs `{ group, category: 0x0001, mask: 0xffffffff }`.
- No code comments unless asked; no emojis; minimal output style.
- Never let Phaser auto-step matter; never add separate matter-js dep; never upgrade to Phaser 4.
- When user reports something "looks broken", believe them and instrument (ASCII dumps, numeric probes) — two visual bugs were found this way.

## 11. File inventory (as of handoff)

Modified/uncommitted today: `src/game/constants.ts` (SPRITE block added, corrected values), `src/game/scenes/BootScene.ts` (assets/game paths), `src/game/bike/BikeRenderer.ts` (rewritten: rider+ragdoll), `src/game/bike/Bike.ts` (ejected/ragdollBody fields, ejectRider(), reset cleanup), `src/game/scenes/RideScene.ts` (SPRITE import, camera chases ragdoll, gate label colors). New: `public/assets/game/*` (5 files), `HANDOFF.md` (this file). Deleted: `public/assets/px/`. Earlier local-only commit: `ef5ee60`.

---

*End of handoff. Work phases in order. Verify everything headlessly. Ask the user to eyeball visuals — they have localhost:5173 open.*
