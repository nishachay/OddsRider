/**
 * Famous resolved markets, frozen as `kind: 'closed'` tracks.
 *
 * Every slug below was verified against a real Polymarket URL — none are
 * invented. The ingest resolves each slug live through Gamma (`/events?slug=`
 * and `/markets?slug=`); a slug that resolves to nothing, to a non-binary
 * market, or to a market that is still open is skipped with a warning.
 * Nothing here invents data: if a slug dies, its track simply stops
 * refreshing and the last frozen file stays until pruned.
 */
export interface ClosedMarketSpec {
  /** Polymarket event or market slug, verified against a real URL. */
  slug: string;
  /** Why this one is worth riding. */
  note: string;
  /**
   * Optional question substring picking the famous leg of a multi-outcome
   * event (e.g. the 25bps bracket of a Fed decision). Without it, the
   * most-traded settled leg wins.
   */
  pick?: string;
}

export const CLOSED_MARKETS: ClosedMarketSpec[] = [
  {
    slug: 'will-bitcoin-hit-100k-in-november',
    note: 'Bitcoin $100k in November 2024 ($28.6M volume) — resolved NO, then crossed $100k days later in December.',
  },
  {
    slug: 'ethereum-all-time-high-in-2024',
    note: 'Ethereum new ATH in 2024 ($19.5M volume) — resolved NO.',
  },
  {
    slug: 'presidential-election-winner-2024',
    note: 'US presidential election winner 2024 ($3.7B volume) — Trump. Multi-outcome event; binary legs are picked up individually.',
  },
  {
    slug: 'fed-interest-rates-december-2024',
    note: 'Fed December 2024 decision brackets ($58.8M event volume) — the 25bps-cut leg resolved YES. Event slug: sub-market slugs do not resolve on Gamma.',
    pick: '25 bps',
  },
  {
    slug: 'bitcoin-new-all-time-high-in-2024',
    note: 'Bitcoin new all-time high in 2024 — resolved YES on the October run past $73,777.',
  },
];
