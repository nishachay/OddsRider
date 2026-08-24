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
src/App.tsx + game/PhaserGame.tsx   React mounts one Phaser.Game into a fixed div
src/game/
  config.ts        Phaser config: gravity y:1.1, matter autoUpdate:false, input.keyboard:false
  constants.ts     ALL tuning numbers (BIKE geometry, TUNING per-step values, WORLD, PALETTE, SPRITE)
  perfect_assets.ts  LOCKED sprite-alignment spec v0.1 — SPRITE in constants.ts must match it
  bus.ts           tiny emitter bridging Phaser scene → React HUD (EV.SPEED/MUTE/NITRO/CRASH/…)
  scenes/BootScene.ts   loads public/assets/game/{bike,wheel,rider,ragdoll,flag}.png
  scenes/RideScene.ts   fixed-step accumulator loop, camera lerp follow, ground/ticks/gates,
                   auto-respawn; exposes window.__oddsrider debug handle
  bike/Bike.ts     bodies + suspension constraints + drive/lean/nitro/jump +
                   integrity enforcement + crash detection + ejectRider() ragdoll (one class)
  bike/BikeRenderer.ts  sprite rendering anchored to rear-wheel hub ("Wheel-First")
  bike/CyberEffects.ts  particles/camera-shake juice engine (terminal aesthetic, no slop)
  input/InputManager.ts window-level keydown/keyup Set<code> (NOT Phaser keyboard),
                   edge-triggered R reset / M mute / Space jump
src/components/HudOverlay.tsx  React HUD, subscribes to bus events
public/assets/game/   processed game-ready PNGs   public/assets2/  original AI sources (never delete)
```

## Sprite alignment (locked — do not eyeball-tune)

Bike/rider/ragdoll placement went through many alignment commits and ended in a locked spec:
`SPRITE` (constants.ts) mirrors `src/game/perfect_assets.ts` v0.1. Rendering is **anchored on the
rear wheel hub** (wheel sprites are the base; chassis/rider are offsets from it); `BIKE.wheelR = 25`
was deliberately matched to the visual tire so tires sit flush on the ground line. If art looks
misaligned, re-measure headlessly (see root `dump_*.cjs` / `measure_*.cjs`) — don't nudge numbers.

## Physics rules (hard-won — do not regress)

- Matter world steps **manually**: fixed accumulator in RideScene, `STEP_MS = 1000/60`, max 4 steps/frame. `autoUpdate: false` in config. Never let Phaser auto-step.
- Gravity is **1.1**, not Phaser's default 1 and not "feels right" guesses. All tuning lives in `constants.ts` as **per-step** units (matter velocities are px/step; multiply by 60 for px/s display).
- Bike = chassis + 2 wheels + head body, joined by 2 suspension constraints per wheel (stiffness 0.62 / damping 0.2) + 2 head pins. Derived from the proven ornn-rider reference implementation.
- `Bike.enforceIntegrity()` must run every step after `world.step`: terminal velocity caps + wheel-socket clamping. Removing it makes soft-constraint wheels blow out on hard landings ("works then collapses").
- Drive/lean mutate angular velocity directly (reference pattern); nitro uses force along chassis angle. Jump is a one-shot velocity set gated by grounded/coyote.
- Debug handle: `window.__oddsrider` exposes x/y/angle/speed/grounded/crashed/nitro/reset — used by headless smoke tests.

## Verification without a display (WSL)

Headless chromium smoke tests are the substitute for playtesting:
- `playwright` is a devDependency, but chromium-headless-shell + system libs live under
  `/tmp/opencode` (libs extracted to `/tmp/opencode/libs/root/usr/lib/x86_64-linux-gnu`, no sudo on
  this box) — run node with `LD_LIBRARY_PATH` pointing there.
- `/tmp` is wiped between sessions; reinstall pattern: `npm i playwright` + `apt-get download <libs>` + `dpkg -x`.
- Root helpers (`smoke_test.cjs`, `measure_*.cjs`, `dump_*.cjs`) expect the preview server on
  `http://localhost:4173` and drive `window.__oddsrider`.
- Check telemetry assertions (speed ramps, |angle| small, x progresses, zero console errors) +
  screenshots, not just "it boots". `browser.close()` often hangs past timeout — output already
  printed means success.

## Design language (locked)

Betting-terminal aesthetic, explicitly anti-AI-slop: radius-0 corners, 1px `#232529` borders, mono numerals (JetBrains Mono), Archivo expanded wordmark, toxic `#b6ff00` / crimson `#ff3355` accents used sparingly. Banned: gradients on UI, glassmorphism, rounded cards, emoji, purple/blue palettes. Tokens live in `index.css @theme` + `PALETTE` in `constants.ts` — change them there, not inline.

## Code traps (learned the hard way)

- TS strict + `noUnusedLocals/noUnusedParameters` — unused imports fail the build.
- Don't name a class field `renderer` inside Scene subclasses (`Phaser.Scene` already has one).
- Matter body `label` isn't typed by Phaser: cast `(pair.bodyA as unknown as { label: string }).label`.
- No code comments unless asked; no emojis in code or UI.

## Repo conventions

- Remote: `github.com/nishachay/OddsRider`, branch `main`, git identity configured locally (nishachay noreply email). Pushes need a user-supplied PAT (fine-grained, Contents: Read+Write); never persist tokens to `.git/config`.
- Commits: concise imperative, e.g. `Phase 1: core ride loop foundation`.
- `HANDOFF.md` has deep context (physics derivation numbers, asset pipeline, WSL setup detail) but its point-in-time status sections go stale — trust `git log`, not its TODO list.
- Roadmap order per spec: Phase 2 = Polymarket Gamma/CLOB data → probability terrain generation (green/red segments), crash/finish scoring; Phase 3 = home page/markets/share card; Phase 4 = mobile/juice/caching. Don't jump ahead of the current phase.
