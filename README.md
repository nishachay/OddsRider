# OddsRider — Ride the odds.

A free browser motocross game that turns real Polymarket probability charts
into rideable glowing tracks. Pick a market, ride what the crowd believes.

## Run it

Package manager is **pnpm**.

- `pnpm install`
- `pnpm dev` — dev server (Vite, default http://localhost:5173)
- `pnpm build` — typecheck (`tsc --noEmit`, strict) + production build
- `pnpm preview` — serve the production build locally

## Routes

- `/` — home: hero, daily challenge, trending, legendary crashes
- `/preview/:marketId` — track preview + your runs + timeframe select
- `/ride/:marketId` — the game (only place the Phaser engine mounts)
- `/about` — disclaimer, data honesty note, privacy

Ride options: `?side=no` rides the inverted (NO) track,
`?tf=24H|7D|ALL` selects the price-history window.

## Data honesty rules

- Displayed odds are last-trade prices from Polymarket's public Gamma API.
- Tracks come from public CLOB price histories, mapped 1:1 (no smoothing).
- A 24h change shows "—" when it can't be computed. A track with no
  history cannot be built — the UI says so instead of fabricating one.
- When the live feed is unreachable, the home page says it is showing
  cached markets. No stat is ever invented.
- All player stats live in your browser's localStorage. No accounts, no tracking.

## Controls

Desktop: W/↑ gas · S/↓ brake · A/D or ←/→ lean · Space jump ·
Shift/N nitro · R reset · M mute. Touch controls appear on mobile.

Scoring: distance (max 1000) + tricks (flip 500, stoppie 400, wheelie 300,
big air 200) with a combo multiplier up to ×5. Crash costs 500 and resets
the combo. Finish pays 1000.

## Stack

Vite + React 19 + TypeScript (strict) + Tailwind CSS v4 + Phaser 3.90
(Matter physics, manually stepped) + pnpm. Deploys as a static site
(`vercel.json` ships SPA rewrites).
