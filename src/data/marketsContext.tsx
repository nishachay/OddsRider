import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  fetchAllMarkets,
  getCachedMarkets,
  CURATED_POLYMARKET_FEED,
  type RideableMarket,
} from './polymarket';

interface MarketsValue {
  markets: RideableMarket[];
  loading: boolean;
}

const MarketsContext = createContext<MarketsValue>({
  markets: CURATED_POLYMARKET_FEED,
  loading: true,
});

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [markets, setMarkets] = useState<RideableMarket[]>(() => getCachedMarkets() ?? CURATED_POLYMARKET_FEED);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAllMarkets().then((data) => {
      if (cancelled) return;
      if (data && data.length > 0) setMarkets(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MarketsContext.Provider value={{ markets, loading }}>
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
