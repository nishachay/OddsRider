# Adapter fixtures

Test data only. **Not real market data.** Nothing here came from Polymarket and
nothing here should ever be presented as live odds.

These drive the Polymarket adapter tests in `packages/core` — the shape is
faithful to the real Gamma + CLOB payloads so the parsing path under test is the
same one the ingest uses, but the values are synthetic ("the fixture rate cut"),
so a screenshot or a log line can never be mistaken for a real market.

| File | Shape |
|---|---|
| `gamma-markets.json` | Gamma `/markets` response (array of market rows) |
| `clob-history.json` | CLOB `/prices-history` responses, keyed by YES token id |

`outcomes`, `outcomePrices` and `clobTokenIds` are JSON-encoded **strings**,
exactly as Gamma sends them. Each token has 48 points spanning 30 days ending at
the fixed timestamp `1790812800` (2026-10-01T00:00:00Z), so the fixtures never
drift.

The tests must keep passing with the adapter's own filters
(`minVolume24h`, probability band, binary-only), so the fixtures satisfy them:
`volume24hr >= 50000`, both outcomes present, a YES token, and at least 15
history points with a range `>= 0.03`.

There is deliberately **no minimum market count**: the old "4 live markets or
fall back to the curated list" rule is gone along with the silent fallback.
