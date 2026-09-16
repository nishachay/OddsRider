import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  fetchAllMarkets,
  getCachedMarkets,
  CURATED_POLYMARKET_FEED,
  type FeedError,
  type RideableMarket,
} from './polymarket';

interface MarketsValue {
  markets: RideableMarket[];
  loading: boolean;
  feedError: FeedError | null;
  reload: () => void;
  ingestMarket: (m: RideableMarket) => void;
}

const MarketsContext = createContext<MarketsValue>({
  markets: CURATED_POLYMARKET_FEED,
  loading: true,
  feedError: null,
  reload: () => {},
  ingestMarket: () => {},
});

// Same feed = same ids and same odds: skip the state update so canvases,
// countdowns, and scroll position survive a background refresh.
function sameFeed(a: RideableMarket[], b: RideableMarket[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (m, i) =>
        m.id === b[i]?.id &&
        m.currentProb === b[i]?.currentProb &&
        m.probDelta === b[i]?.probDelta,
    )
  );
}

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [markets, setMarkets] = useState<RideableMarket[]>(() => getCachedMarkets() ?? CURATED_POLYMARKET_FEED);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState<FeedError | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { markets: data, error } = await fetchAllMarkets();
      if (data.length > 0) setMarkets((prev) => (sameFeed(prev, data) ? prev : data));
      setFeedError(error === 'OK' ? null : error);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().then(() => {
      if (!cancelled) setLoading(false);
    });
    // Live odds without reloads: silent refresh every 60s while visible.
    const t = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [refresh]);

  const reload = useCallback(() => {
    void refresh();
  }, [refresh]);

  const ingestMarket = useCallback((m: RideableMarket) => {
    setMarkets((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
  }, []);

  return (
    <MarketsContext.Provider value={{ markets, loading, feedError, reload, ingestMarket }}>
      {children}
    </MarketsContext.Provider>
  );
}

export function useMarkets(): MarketsValue {
  return useContext(MarketsContext);
}

export function useMarket(idOrSlug: string | undefined): {
  market: RideableMarket | null;
  loading: boolean;
} {
  const { markets, loading } = useMarkets();
  const find = useCallback(
    (list: RideableMarket[]) =>
      list.find((m) => m.id === idOrSlug || m.slug === idOrSlug) ?? null,
    [idOrSlug],
  );
  const fromLive = idOrSlug ? find(markets) : null;
  if (fromLive) return { market: fromLive, loading };
  if (!idOrSlug) return { market: null, loading };
  const fromCurated = find(CURATED_POLYMARKET_FEED);
  return { market: fromCurated, loading };
}
