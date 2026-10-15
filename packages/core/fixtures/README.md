# Adapter fixtures

**Recorded from the live Polymarket API** (Gamma `/markets` + CLOB
`/prices-history`) on 2026-10-15, captured via the ingest `--dump` artifact.
Every value in these files is a genuine API response — nothing is hand-drawn
or invented. If a value looks odd, the API really said that.

| File | Shape |
|---|---|
| `gamma-markets.json` | 2 rows of a Gamma `/markets` response (array of market rows) |
| `clob-history.json` | CLOB `/prices-history` responses, keyed by YES token id |
| `gamma-sports-row.json` | 1 complete recorded Gamma row: a single-game moneyline market, for the sports filter test |

- `outcomes`, `outcomePrices` and `clobTokenIds` are JSON-encoded **strings**,
  exactly as Gamma sends them.
- Market 0: Indiana data-center moratorium (probability 0.125, 385 history
  points). Market 1: Fed October-2026 no-change (probability 0.725, 721 points).
- The tests must keep passing with the adapter's own filters
  (`minVolume24h`, probability band, binary-only), so the recorded markets
  satisfy them: `volume24hr >= 50000`, both outcomes present, a YES token, and
  at least 15 history points with a range `>= 0.03`.

There is deliberately **no minimum market count**: the old "4 live markets or
fall back to the curated list" rule is gone along with the silent fallback.

To re-record: dispatch the ingest workflow (it uploads `ingest-dump` on every
manual run), then take 2 binary rows plus their YES-token histories.
