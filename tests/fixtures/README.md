# Test fixtures

Test data only. **Not real market data.** Nothing here came from Polymarket and
nothing here should ever be presented as live odds.

Why it exists: the Playwright smoke test must run with **no network access**, so
the app has to be fed deterministic, offline payloads.

| File | Shape | Used by |
|---|---|---|
| `gamma-markets.json` | Gamma `/markets` response (array of market rows) | smoke test route mock |
| `clob-history.json` | CLOB `/prices-history` responses, keyed by YES token id | smoke test route mock |

`gamma-markets.json` is shape-faithful to the real thing: `outcomes`,
`outcomePrices` and `clobTokenIds` are JSON-encoded **strings**, exactly as Gamma
sends them, so the app's real parsing path runs. Each token id in
`clob-history.json` has 48 points spanning 30 days ending at the fixed
timestamp `1790812800` (2026-10-01T00:00:00Z), so the fixture never drifts.

Constraints the fixtures must keep satisfying (they are what the app's feed
filter requires):

- at least 4 markets, so the feed is accepted instead of falling back to the
  bundled curated list,
- `volume24hr >= 50000`,
- at least 15 history points per token, with a sparkline range `>= 0.03`,
- `oneDayPriceChange` present, so 24H deltas are "known" rather than `—`.

The questions are deliberately synthetic ("the fixture rate cut") so a
screenshot can never be mistaken for a real market.
