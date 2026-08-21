# AGENTS.md

Spec-driven game project. The master spec (V2) is the single source of truth for product decisions: phased build order, locked creative choices (Dark Cyber Dirt Bike only, near-black bg, glowing probability track is the visual hero). Do not redesign these.

## Commands

- Package manager is **pnpm** (spec-mandated), never npm/yarn.
- `pnpm dev` — dev server (slow first start on /mnt/e; ~10s+).
- `pnpm build` — typecheck (`tsc --noEmit`, strict) + Vite build. This is the only verification gate; there are no tests or lint yet.
- `pnpm preview` — serve `dist/`. Bind `--host 127.0.0.1` in WSL: plain `localhost` can resolve to IPv6 and fail.

## Stack pins (do not upgrade casually)

- **Phaser 3.90.x** — spec locks Phaser 3; Phaser 4 exists but its Matter API surface differs.
- React 19 + Tailwind CSS v4 (CSS-first: theme tokens live in `@theme` in `src/index.css`, no tailwind.config).
- Matter physics comes bundled inside Phaser; do NOT add the separate `matter-js` package.

## Architecture

```
src/game/
  config.ts        Phaser config: gravity y:1.1, matter autoUpdate:false, input.keyboard:false
  constants.ts     ALL tuning numbers (BIKE geometry, TUNING per-step values, WORLD, PALETTE)
  bus.ts           tiny emitter bridging Phaser scene → React HUD (EV.* events)
  scenes/RideScene.ts   fixed-step accumulator loop, camera, ground, gates
  bike/Bike.ts     bodies + suspension constraints + drive/lean/nitro/jump +
                   integrity enforcement + crash detection (one class)
  bike/BikeRenderer.ts procedural/sprite rendering synced to body poses
  input/InputManager.ts window-level keydown/keyup Set<code> (NOT Phaser keyboard)
src/components/HudOverlay.tsx  React HUD, subscribes to bus events
```

## Physics rules (hard-won — do not regress)

- Matter world steps **manually**: fixed accumulator in RideScene, `STEP_MS = 1000/60`, max 4 steps/frame. `autoUpdate: false` in config. Never let Phaser auto-step.
- Gravity is **1.1**, not Phaser's default 1 and not "feels right" guesses. All tuning lives in `constants.ts` as **per-step** units (matter velocities are px/step; multiply by 60 for px/s display).
- Bike = chassis + 2 wheels + head body, joined by 2 suspension constraints per wheel (stiffness 0.62 / damping 0.2) + 2 head pins. Derived from the proven ornn-rider reference implementation.
- `Bike.enforceIntegrity()` must run every step after `world.step`: terminal velocity caps + wheel-socket clamping. Removing it makes soft-constraint wheels blow out on hard landings ("works then collapses").
- Drive/lean mutate angular velocity directly (reference pattern); nitro uses force along chassis angle. Jump is a one-shot velocity set gated by grounded/coyote.
- Debug handle: `window.__oddsrider` exposes x/y/angle/speed/grounded/crashed/nitro/reset — used by headless smoke tests.

## Verification without a display (WSL)

Headless chromium smoke tests are the substitute for playtesting:
- Playwright + chromium-headless-shell installed under `/tmp/opencode`; system libs extracted to `/tmp/opencode/libs/root/usr/lib/x86_64-linux-gnu` (no sudo on this box) — run node with `LD_LIBRARY_PATH` pointing there.
- `/tmp` is wiped between sessions; reinstall pattern: `npm i playwright` + `apt-get download <libs>` + `dpkg -x`.
- Check telemetry assertions (speed ramps, |angle| small, x progresses, zero console errors) + screenshots, not just "it boots".

## Design language (locked)

Betting-terminal aesthetic, explicitly anti-AI-slop: radius-0 corners, 1px `#232529` borders, mono numerals (JetBrains Mono), Archivo expanded wordmark, toxic `#b6ff00` / crimson `#ff3355` accents used sparingly. Banned: gradients on UI, glassmorphism, rounded cards, emoji, purple/blue palettes. Tokens live in `index.css @theme` + `PALETTE` in `constants.ts` — change them there, not inline.

## Repo conventions

- Remote: `github.com/nishachay/OddsRider`, branch `main`, git identity configured locally (nishachay noreply email). Pushes need a user-supplied PAT (fine-grained, Contents: Read+Write); never persist tokens to `.git/config`.
- Commits: concise imperative, e.g. `Phase 1: core ride loop foundation`.
- Roadmap order per spec: Phase 2 = Polymarket Gamma/CLOB data → probability terrain generation (green/red segments), crash/finish scoring; Phase 3 = home page/markets/share card; Phase 4 = mobile/juice/caching. Don't jump ahead of the current phase.
