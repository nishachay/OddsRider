# POLYMARKET MECHANICS & API ROADMAP

This document outlines the advanced gameplay mechanics and architecture unlocked from the official **Polymarket Gamma and CLOB APIs**. These features are slated for Phase 2 and Phase 3 expansion.

---

## 1. Core Polymarket API Architecture

Polymarket divides its services into two primary endpoints:

1. **Gamma API (Discovery & Metadata)**:
   - Base URL: `https://gamma-api.polymarket.com`
   - Endpoints:
     - `GET /events?active=true&closed=false&order=volume_24hr&ascending=false&limit=100`: High-liquidity discovery.
     - `GET /events?slug={slug}`: Resolves any public Polymarket URL slug to its market IDs and token IDs.
     - `GET /markets?slug={slug}`: Specific market detail and metadata.
     - `GET /tags`: Discover categories (Politics, Crypto, Pop Culture, Sports, Macro).

2. **CLOB API (Central Limit Order Book & Telemetry)**:
   - Base URL: `https://clob.polymarket.com`
   - Endpoints:
     - `GET /prices-history?market={clobTokenId}&interval=max&fidelity=60`: Historical price timeseries.
     - `GET /book?token_id={clobTokenId}`: Real-time bids and asks (order book depth).
     - `GET /price?token_id={clobTokenId}`: Instant midpoint/current price.
     - `GET /trades`: Recent trade execution history.
     - `WSS wss://ws-subscriptions-clob.polymarket.com/ws/market`: Live streaming price ticks and order book updates.

---

## 2. Advanced Polymarket Gameplay Mechanics

### 🐋 1. "Whale Trade Shockwaves" (Live WebSocket Trades)
- **Data Source**: CLOB WebSocket stream (`/trades` / order execution channel).
- **Mechanic**: While riding live markets, real-world trades exceeding a volume threshold (e.g. >$25,000 USD) spawn physical game events:
  - Large **YES** buys create an instant neon toxic shockwave and forward boost ramp.
  - Large **NO** dumps create sudden terrain turbulence or seismic dips.
  - Generates live golden yield coins directly along the path.

### 🔀 2. "Multi-Outcome Branching Tracks" (Multi-Candidate Markets)
- **Data Source**: Gamma events with multiple outcome tokens (e.g. *2028 US Presidential Election: Vance vs. Harris vs. Newsom*).
- **Mechanic**: Multi-lane vertical roller coaster:
  - Each candidate's probability curve is rendered as an independent parallel or intersecting track in the same physical space.
  - The rider can jump between candidate lines mid-air using ramps and gravity flips.
  - Riding surging candidates provides downhill momentum; jumping off collapsing candidates prevents catastrophic falls.

### 🌊 3. "Liquidity & Volume Terrain Physics"
- **Data Source**: Gamma API `volume_24hr`, `liquidity`, and CLOB `/book` spread.
- **Mechanic**:
  - **Mega-Cap Markets (Volume >$50M)**: High-speed, super-smooth neon asphalt highways with maximum grip and terminal velocity multipliers.
  - **Illiquid / Micro-Cap Markets**: High-friction, jagged, rocky terrain with sharp cliff edges and unpredictable bounce physics.

### 🔗 4. "Paste Any Polymarket URL" (Procedural Level Generator)
- **Data Source**: Gamma API slug resolver (`GET /events?slug={slug}`).
- **Mechanic**: Players can copy any URL directly from Polymarket (e.g. `polymarket.com/event/fed-rate-decision`), paste it into the OddsRider search bar, and immediately generate a 100% playable, custom physics level.

### 🏁 5. "100% vs 0% Resolution Gauntlets" (Historical Markets)
- **Data Source**: Gamma API `GET /events?closed=true`.
- **Mechanic**:
  - **100% YES Apex Runs**: Track culminates in a supersonic vertical rocket launch through the 100% finish gate.
  - **0% NO Death Drops**: Track collapses into a fatal void where survival requires a frame-perfect nitro jump.

---

## 3. Phase 2 Implementation Order

1. **Market Data Service (`src/services/polymarket.ts`)**:
   - Gamma API event search & URL slug parser.
   - CLOB price-history fetcher with fallback caching.
2. **Procedural Track Generator (`src/game/track/TrackGenerator.ts`)**:
   - Convert price points `(timestamp, price)` into smooth Matter.js vertex chains.
   - Dynamic green/red segment coloring based on price slope.
3. **Live HUD Event Hookup**:
   - Stream actual Polymarket question, live probability, and 24h delta directly into the locked HUD system.
