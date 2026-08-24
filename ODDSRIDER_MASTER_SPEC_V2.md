# OddsRider — Master Specification V2 (High Detail)

Version: 2.0
Date: August 2026
Purpose: Maximum-detail specification so an AI coding agent can build OddsRider with minimal guessing.

This is the single source of truth. Follow it strictly.

## 1. Product Definition

**Name:** OddsRider
**Tagline:** Ride the odds.
**Genre:** Browser-based 2D physics motocross game
**Core Idea:** Real Polymarket probability charts are turned into rideable glowing terrain. Players control a dirt bike across the market's collective belief.

**Tone:** Dark, sharp, slightly unhinged, very online.

**Primary Reference:** StonkRider (visual language, HUD energy, bike feel), but data and meaning are completely different.

## 2. Final Locked Creative Decisions

### Vehicle

- Dark Cyber Dirt Bike
- Matte black / charcoal body
- Thin neon accent lines (default: toxic green)
- Anonymous rider wearing dark jacket + helmet with dark visor
- Clean but aggressive silhouette
- Still uses normal high-quality dirt bike physics (do not invent new vehicle physics)

### Background

- Near-black / deep charcoal base (`#0a0a0b` to `#111113`)
- Extremely subtle thematic layer only (very low opacity)
- Allowed subtle elements: faint drifting "YES"/"NO" words or ghost orderbook lines

Rules:

- Must never compete with the track
- No bright elements
- No busy patterns near the center
- Track must remain the clear visual hero

### Track Visuals

- Thin glowing continuous line
- Rising probability segments → toxic green
- Falling probability segments → crimson / red
- High contrast against the dark background
- Soft glow (not neon overload)

## 3. Tech Stack (Mandatory)

- Build tool: Vite
- Framework: React 19 + TypeScript
- Styling: Tailwind CSS
- Game Engine: Phaser 3
- Physics: matter-js (via Phaser)
- Package Manager: pnpm
- Hosting target: Vercel or Cloudflare Pages
- Backend (early): Mostly client-side + Edge Functions for proxy/caching
- Optional later: Convex or Supabase free tier for leaderboards

## 4. APIs & Data (Free Only)

### Polymarket

- Gamma API → `https://gamma-api.polymarket.com`
  - Use for: market discovery, trending, volume, tags, questions, clobTokenIds
- CLOB API → `https://clob.polymarket.com`
  - Endpoint: `/prices-history`
  - Returns probability history as `{ t, p }[]` where p is 0–1

### Required Filters (do not skip)

Only show markets that pass:

- Minimum volume (start with $50k+, make configurable)
- Minimum history length (at least 5–7 days of data preferred)
- Minimum movement (reject almost-flat series)

### Caching

Cache trending lists and popular price histories aggressively.

## 5. Gameplay Specification

### Controls

Desktop:

- ↑ or W → Gas / Accelerate
- ↓ or S → Brake
- ← or A → Lean back (wheelie)
- → or D → Lean forward (nose dive)
- Space → Jump
- Shift or N → Nitro
- R → Reset
- M → Mute

Mobile:

- Left side of screen → Lean back
- Right side of screen → Lean forward
- Tap both sides or dedicated GAS button → Accelerate
- Jump button
- Nitro button

Keep controls large and thumb-friendly.

### Bike Physics Guidelines (Critical)

- Feels weighty but responsive
- Clear weight transfer when leaning
- Suspension should compress on hard landings
- Easy to crash on steep red drops if landing is bad
- Momentum matters
- Avoid floaty or ice-like physics
- Tune until it feels close to high-quality hill climb / motocross browser games

### Terrain Generation Rules

Input: Array of `{ t: number, p: number }` where p is probability between 0 and 1.

Rules:

- Map probability 0 → 1 into a reasonable vertical range (leave padding top and bottom)
- Apply light smoothing so the track is not pure noise, but keep real sharp moves
- Color segments green when the slope is positive, red when negative
- Generate a continuous matter-js body from the points
- Start flag at the beginning, finish flag at the end
- Track should feel dramatic on volatile markets and calmer on stable ones

### Scoring System (Initial)

| Action | Points |
| --- | --- |
| Course progress | +1000 base |
| Backflip / Frontflip | +500 |
| Big Air (long airtime) | +200 |
| Wheelie | +300 |
| Stoppie | +400 |
| Nitro usage (optional) | small bonus |
| Finish the track | +1000 |
| Crash | −500 + reset combo |

- Combo multiplier up to ×5 if player chains tricks without crashing
- Show floating popup texts ("Big Air! +200", etc.)

### HUD (In-Game)

Must include:

- Top left: Score + current market short name
- Top center: Timer
- Top right: Mini overview of the full track + mute button
- Floating labels on track for significant % moves
- Nitro indicator
- Control hints (can fade after a few seconds)

Match the density and energy of StonkRider's HUD.

### End Screen / Share Card

After finish or crash, show:

- Market question
- Final score
- Whether finished or crashed
- Visual of the path taken (or key moment)
- "Ride again" and "Share" buttons

Share card should look good on X (dark, sharp, clear question + score).

## 6. Home Page Specification

Sections (in order):

1. **Hero** — Title: "Ride the odds." Short subtitle. Live stats (total rides, crashes, etc.)
2. **Daily Challenge** — One featured market. Best score + number of riders today. Big CTA button.
3. **Trending Now** — Horizontal or grid of high-quality current markets. Auto-refreshed from Polymarket with filters.
4. **Categories** — Politics, Crypto, Sports, Geopolitics, Tech, Economy, etc.
5. **Legendary Rides** — Curated list of famous past markets.
6. **Search** — Search Polymarket markets by question.

### Market Card Content

- Shortened question
- Current probability (or leading outcome)
- Mini sparkline
- Volume or 24h change
- Difficulty badge (Easy / Medium / Hard / Insane)
- "Ride" button

### Difficulty Calculation

Compute volatility of the probability series and map to: Easy / Medium / Hard / Insane.

## 7. Phased Build Order (Follow Exactly)

### Phase 1 – Foundation

- Initialize Vite + React + TypeScript + Tailwind + Phaser 3 + matter-js
- Clean folder structure
- Near-black background
- Basic Phaser scene
- Controllable Dark Cyber Dirt Bike on flat ground
- Desktop controls working

### Phase 2 – Core Ride Loop

- Probability → terrain generation function
- Load one real Polymarket market
- Full glowing track with green/red segments
- Basic HUD
- Crash detection
- Finish detection
- Simple scoring + popups

### Phase 3 – Product

- Complete home page with all sections
- Market cards
- Navigation into rides
- Daily Challenge (basic version)
- End screen + shareable result card

### Phase 4 – Polish

- Mobile controls
- Better filters
- Difficulty system
- Sound toggle
- Juice and feel improvements
- Caching layer

## 8. AI Agent Rules

- The glowing probability track is the most important visual element. Never let the background fight it.
- Bike physics quality is more important than visual flair in early phases.
- Prefer working vertical slices.
- Use real Polymarket data as soon as the bike moves.
- Keep the aesthetic dark, sharp, and slightly unhinged.
- Do not invent new vehicle types.
- Match StonkRider HUD energy without copying assets.
- When in doubt, choose the simpler implementation that feels good.

### First Command to Run

1. Read the entire ODDSRIDER_MASTER_SPEC_V2.md carefully.
2. Bootstrap the project using the exact tech stack specified.
3. Create a clean folder structure.
4. Implement Phase 1 only: a Phaser scene with a Dark Cyber Dirt Bike that can accelerate, lean, and jump on flat ground using matter-js.
5. Use a near-black background.
6. Do not implement Polymarket data or terrain generation yet.
7. When finished, summarize what was done and wait.

## 9. Acceptance Criteria

### Phase 1 is done when:

- Bike moves convincingly with gas, lean, and jump
- Physics feel weighty and controllable
- Background is near-black
- No major console errors

### Phase 2 is done when:

- A real Polymarket probability series can be ridden
- Track is glowing green/red correctly
- Player can crash and finish
- Basic score exists

### MVP is done when:

- User can browse markets on the home page
- Select one and ride it
- See a result screen with score
- Share card is generated

---

End of Specification.

Build exactly what is written here.
Do not simplify the core fantasy.
Do not replace the bike.
Do not make the background busy.

This is OddsRider.
