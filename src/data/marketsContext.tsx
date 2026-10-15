import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  fetchTrackIndex,
  sameFeed,
  toRideableMarket,
  TrackFeedError,
  type FeedError,
  type RideableMarket,
} from './tracks';

interface MarketsValue {
  markets: RideableMarket[];
  loading: boolean;
  feedError: FeedError | null;
  reload: () => void;
}

const MarketsContext = createContext<MarketsValue>({
  markets: [],
  loading: true,
  feedError: null,
  reload: () => {},
});

export function MarketsProvider({ children }: { children: ReactNode }) {
  const [markets, setMarkets] = useState<RideableMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState<FeedError | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const index = await fetchTrackIndex();
      if (index.tracks.length === 0) {
        setFeedError('TRACKS_EMPTY');
        return;
      }
      const data = index.tracks.map(toRideableMarket);
      if (data.length > 0) setMarkets((prev) => (sameFeed(prev, data) ? prev : data));
      setFeedError(null);
    } catch (error) {
      // A failed refresh never fabricates tracks and never wipes the last
      // good list: the UI shows the error and offers a retry.
      setFeedError(error instanceof TrackFeedError ? error.code : 'TRACKS_UNREACHABLE');
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().then(() => {
      if (!cancelled) setLoading(false);
    });
    // Frozen index, cheap to re-check: refresh every 60s while visible so a
    // newly published ingest appears without a reload.
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

  return (
    <MarketsContext.Provider value={{ markets, loading, feedError, reload }}>
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
  if (!idOrSlug) return { market: null, loading };
  return {
    market: markets.find((m) => m.id === idOrSlug || m.slug === idOrSlug) ?? null,
    loading,
  };
}
