# ODDSRIDER MASTER DESIGN SYSTEM

*Status: Locked & Authoritative*

OddsRider uses a **Cyberpunk Betting-Terminal** aesthetic. It is explicitly anti-AI-slop: zero emojis, zero glassmorphism, zero rounded cards, and zero gratuitous gradients. Every pixel serves either telemetry or financial prediction context.

---

## 1. Typography Tokens

We operate a strict **2-Font System**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Space Grotesk (Primary Interface, Editorial & Brand)                     │
│    • Weights: 500 (Medium), 700 (Bold), 800 (ExtraBold), 900 (Black)        │
│    • Usage: Brand Wordmark, Market Questions, Badges, Keycap Labels, Units  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Geist Mono (Precision Telemetry & Data)                                  │
│    • Weights: 400 (Regular), 700 (Bold), 800 (Black)                        │
│    • Feature: Always paired with `tabular-nums` for zero number jitter      │
│    • Usage: Race Timer, Speedometer, Score, Percentages, Keycap Characters  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hierarchy & Style Rules

| Role | Font Family | Size | Weight | Tracking | Color |
|---|---|---|---|---|---|
| **Brand Wordmark** | `Space Grotesk` | 16px | 900 (Black) | `0.24em` (Wide) | `#f0f0f2` + `#b6ff00` |
| **Race Clock** | `Geist Mono` | 40px / 20px | 700 (Bold) | `-0.02em` | `#f0f0f2` / `#b6ff00` |
| **Speedometer** | `Geist Mono` | 34px | 700 (Bold) | `-0.03em` | `#f0f0f2` (glows toxic at 100+) |
| **Market Question** | `Space Grotesk` | 12.5px | 500 (Medium) | `-0.01em` | `#f0f0f2` / 90% opacity |
| **Hero Probability** | `Geist Mono` | 36px | 800 (Black) | `-0.04em` | `#b6ff00` (up) / `#ff3355` (down) |
| **Outcome Label** | `Space Grotesk` | 10px | 800 (Black) | `0.18em` | `#f0f0f2` |
| **Delta Tag** | `Geist Mono` | 9.5px | 700 (Bold) | `0.00em` | `#b6ff00` (up) / `#ff3355` (down) |
| **Micro Labels** | `Space Grotesk` | 8px–9px | 800 (Black) | `0.22em` | `#7c7f86` (Dim) |
| **Keycap Badges** | `Geist Mono` | 7.5px | 700 (Bold) | `0.00em` | `#9ca3af` / 1px `#232529` border |

---

## 2. Color Palette (Tailwind `@theme`)

* **Background Base**: `#0a0a0b` (Pure near-black)
* **Surface Background**: `#101113`
* **Structural Borders**: `#1f242d` / `#232529` (1px hairlines)
* **Primary Ink (Text)**: `#f0f0f2`
* **Dim Gray (Labels)**: `#7c7f86`
* **Subtle Gray**: `#9ca3af`
* **Toxic Accent**: `#b6ff00` (Bullish / Nitro / Primary Glow)
* **Crimson Accent**: `#ff3355` (Bearish / Crashes / Muted)

---

## 3. Spatial HUD Architecture (2-Deck Grid)

The game viewport is divided into **Two Primary Decks** using vertical `justify-between` spacing:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ODDSRIDER                                  0:00.0                   [ ~~~/\~~. ]      │  <-- TOP DECK (Sky)
│                                                                        [🔊 AUDIO]      │
│                                                                                        │
│                                                                                        │
│                                      ( 🏍️ RIDER )                                      │
│  ────────────────────────────────────────────────────────────────────────────────────  │  <-- Physical Ground
│                                                                                        │
│  000 KM/H   SCORE 0                 [W] GAS · [S] BRAKE · ...   Will there be no       │  <-- BOTTOM DECK
│  NITRO [■■■■■] 100%                 (Fades on drive)            change in Fed rate...? │      (Sub-Terrain)
│                                                                 16.2% YES  +7.0% 24H   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Top Deck (Airspace & Time)**:
   - Left: `ODDSRIDER` brand wordmark.
   - Center: Tabular Race Timer (`0:00.0`).
   - Right: Tactical MiniChart sparkline with **stacked 1px SVG Audio Toggle** directly below it.
2. **Bottom Deck (Cockpit & Market Engine)**:
   - Left: Cockpit Cluster (Speed, Score, 5-cell Nitro Fuel Bar).
   - Center: Floating start-gate Keycaps helper (auto-fades to 0% opacity on drive).
   - Right: Polymarket Outcome Column with 2px vertical neon momentum indicator line.

---

## 4. UI Rules for Homepage, Markets & Modals

1. **Radius-0 or Micro-Chamfer (Max 2px)**: No pill buttons, no bubbly cards.
2. **Tabular Numerals**: Any dynamic number must use `font-mono tabular-nums`.
3. **No Unicode Emojis**: Use custom 1px geometric SVGs or clean text.
4. **Institutional Notation**: Financial deltas use `+7.0%` / `-3.2%`, not emoji arrows.
5. **No AI Slop Labels**: Never write generic headers like "CURRENT MARKET CONTRACT" or "SESSION TIME".
