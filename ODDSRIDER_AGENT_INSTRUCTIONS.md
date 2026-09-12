# OddsRider — Complete Agent Instructions (Master Document)

**Version:** 1.0  
**Date:** September 2026  
**Purpose:** Single source of truth for the AI coding agent. Follow this document strictly. Do not invent new architecture or creative direction.

---

## 1. Product Definition (Locked)

**Name:** OddsRider  
**Tagline:** Ride the odds.  
**One sentence:** A free browser motocross game that turns real Polymarket probability charts into rideable glowing tracks.

**Core Fantasy:**  
You are not riding money. You are riding what the crowd currently believes.

**Reference:** StonkRider (visual energy, HUD layout, bike feel, chart-as-track).  
OddsRider must feel almost identical in gameplay, but the data and meaning are Polymarket probability instead of stock prices.

**Tone:** Dark, sharp, slightly unhinged, made for people who already refresh Polymarket. Share cards must look good at 2am on X.

---

## 2. What Must Be Kept (Do Not Change)

- All existing game assets (`public/assets/game/`)
- Bike physics, constants, Matter.js setup, and tuning numbers
- Existing HUD visual style and layout philosophy
- Design tokens and dark aesthetic (near-black background, toxic green `#b6ff00`, crimson `#ff3355`)
- Event bus pattern (`bus.ts`)
- Phaser 3.90 + React 19 + TypeScript + Tailwind CSS v4 + pnpm stack

---

## 3. Critical Problems to Fix

The current app is a prototype, not a real product:

1. Everything lives in one `App.tsx` with local `view` state (`'home' | 'preview' | 'game'`).
2. Phaser is always mounted (just hidden with CSS).
3. No real routing → refresh, back button, and shareable links are fragile.
4. Home page discovery is not fully automatic from live Polymarket data.
5. The shell (home → game) does not feel like something a real developer would publish.

**Goal of this rebuild:** Keep the game 90% the same. Make the shell production-grade.

---

## 4. Required Architecture

### Routing (Mandatory)

Use **React Router**.

```
/                     → HomePage
/preview/:marketId    → PreviewPage
/ride/:marketId       → RidePage   (ONLY place Phaser is mounted)
```

- URL is the source of truth.
- Browser back/forward and refresh must work.
- Shareable links must work (`/ride/some-market-id`).

### Folder Structure

```
src/
  main.tsx
  App.tsx                     # only BrowserRouter + Routes

  pages/
    HomePage.tsx
    PreviewPage.tsx
    RidePage.tsx

  components/                 # reuse existing ones
    Navbar.tsx
    HeroSpotlight.tsx
    MarketGrid.tsx
    TrackPreview.tsx
    HudOverlay.tsx
    Footer.tsx
    ShareCard.tsx

  game/                       # keep almost untouched
    PhaserGame.tsx
    bus.ts
    config.ts
    constants.ts
    scenes/
    bike/
    track/
    ...

  data/
    polymarket.ts             # clean automatic data layer
    playerStorage.ts

  types/
```

### Key Rules

- Phaser **only mounts inside RidePage**.
- Home and Preview pages never load the game engine.
- Communication between Phaser and React HUD stays on the existing event bus.
- No more global `view` state machine.

---

## 5. Home Page Specification (Exact)

Dark theme, clean, high negative space, very similar energy to StonkRider.

**Order of sections:**

1. **Navbar** (sticky)
   - Left: OddsRider wordmark
   - Center/Right: Category pills + Search

2. **Hero**
   - Big title: “Ride the odds.”
   - Short subtitle
   - Live stats (rides, crashes, etc.)

3. **Daily Challenge** (most important discovery section)
   - One featured market for the day (deterministic so everyone sees the same one)
   - Best score + number of riders (can be local/simple at first)
   - Big “Ride today’s challenge” button

4. **Trending Now**
   - Auto-pulled high-volume Polymarket markets
   - Cards showing: question, current probability, sparkline, difficulty, volume

5. **Categories**
   - Politics / Crypto / Sports / Geopolitics / Tech / Economy / etc.

6. **Legendary Rides**
   - Curated famous past markets (hardcode a good list first)

7. **Search**
   - Filter markets by question text

8. **Footer**

### Market Card Content
- Shortened question
- Current probability (large)
- Mini sparkline (green/red)
- Volume or change
- Difficulty badge (Easy / Medium / Hard / Insane)
- “Ride” button

---

## 6. Automatic Polymarket Data Layer

The home page must work fully automatically from live data.

**APIs (free, public):**
- Gamma API: `https://gamma-api.polymarket.com` → market discovery, volume, tags, questions, clobTokenIds
- CLOB API: `https://clob.polymarket.com` → `/prices-history` for probability series

**Required filters (do not skip):**
- Minimum volume (start at $50k+)
- Minimum history length (prefer 5–7+ days)
- Minimum movement (reject almost-flat series)
- Still active

**Daily Challenge:**
Must be deterministic per day so all users see the same challenge:

```ts
function getDailyChallenge(markets: Market[]) {
  const today = new Date().toISOString().slice(0, 10);
  const hash = simpleHash(today);
  return markets[hash % markets.length];
}
```

**Caching:**
- Cache market list in memory + localStorage (5–10 min TTL)
- Cache individual price histories
- Show cached data instantly, refresh in background

**Difficulty calculation (simple):**
Based on average absolute probability change. Map to Easy / Medium / Hard / Insane.

Create one clean module:

```ts
// src/data/polymarket.ts
export async function getHomePageData() {
  // returns { dailyChallenge, trending, byCategory, all }
}
```

---

## 7. Ride Flow

1. User clicks a market on Home or Preview.
2. Navigate to `/ride/:marketId`.
3. RidePage fetches the ride data and emits `EV.LOAD_MARKET` on the bus.
4. Phaser loads the terrain and starts the ride.
5. On finish or crash → emit result → show ShareCard modal.
6. “Back to lobby” navigates to `/`.

Keep the existing bike, physics, HUD, scoring, and visual style.

---

## 8. Share Card

Must look good when posted on X at 2am:
- Dark background
- Clear market question
- Final score + Finished / Crashed
- Glowing track silhouette or key moment
- Clean OddsRider branding

---

## 9. Free UI Resources (Use These)

Prefer these free tools to improve the home page without breaking the existing dark aesthetic:

- **shadcn/ui** — best free React + Tailwind components (copy into project)
- **Magic UI** — free animated components, cards, effects (works with shadcn)
- **HyperUI** — clean free Tailwind sections and cards
- Keep your existing design tokens and colors. Do not switch to a completely different design system.

Do **not** introduce heavy paid UI kits or glassmorphism / rounded-card trends that fight the locked dark, sharp, anti-AI-slop aesthetic.

---

## 10. Phased Execution Order (Follow Strictly)

### Phase A — Shell & Routing (Do this first)
1. Add React Router.
2. Split into HomePage, PreviewPage, RidePage.
3. Move Phaser so it only mounts on `/ride/:marketId`.
4. Make market selection drive the URL.
5. Verify: refresh, back button, and direct links work.

### Phase B — Automatic Home Page
1. Build clean `polymarket.ts` data layer with filtering + caching.
2. Implement Daily Challenge (deterministic).
3. Implement Trending, Categories, Search, Legendary section.
4. Reuse and adapt existing components (HeroSpotlight, MarketGrid, etc.).

### Phase C — Polish the Loop
1. Perfect the transition into the ride.
2. Make ShareCard excellent.
3. Mobile-friendly controls and layout.
4. Performance and loading states.

---

## 11. Coding Rules for the Agent

- Prefer simple, readable code.
- TypeScript strict.
- Do not “improve” the bike physics or constants unless explicitly asked.
- Do not add new major systems (auth, leaderboards, accounts) until the core loop is solid.
- Every change must answer: “Does this make the game more fun or more shareable?”
- After structural changes, the app must still build with `pnpm build`.
- Keep the visual language: near-black, thin borders, toxic green + crimson, lots of negative space, no emoji clutter, no glassmorphism.

---

## 12. Success Criteria

The project is in a good state when:

- User lands on a clean, automatic home page powered by live Polymarket data.
- Daily Challenge is the same for everyone that day.
- Clicking a market goes to a real URL and starts the ride cleanly.
- Phaser only exists while riding.
- Browser back button and refresh work.
- Share card looks good on X.
- The whole experience feels like a real product, not a local prototype.

---

## 13. First Commands for the Agent

1. Read this entire document.
2. Inspect the current `src/App.tsx` and routing situation.
3. Implement Phase A (proper React Router + split pages + Phaser only on RidePage).
4. Do not touch bike physics or assets.
5. When Phase A is stable, move to Phase B (automatic Polymarket home page).

**Do not redesign the creative vision. Do not simplify the core fantasy. Build exactly what this document describes.**

---

End of Instructions.
