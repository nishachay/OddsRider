import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  fetchTrack,
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
  const { markets, loading: listLoading } = useMarkets();
  const [standalone, setStandalone] = useState<RideableMarket | null>(null);
  const [standaloneLoading, setStandaloneLoading] = useState(false);

  const fromList = idOrSlug ? (markets.find((m) => m.id === idOrSlug || m.slug === idOrSlug) ?? null) : null;

  useEffect(() => {
    // The index lists each market once (newest snapshot), but retained files
    // stay on disk: a shared link to an older snapshot resolves here, straight
    // from its frozen file. Slugs only resolve through the index.
    if (!idOrSlug || fromList || listLoading) return;
    let cancelled = false;
    setStandalone(null);
    setStandaloneLoading(true);
    fetchTrack(idOrSlug).then(
      (track) => {
        if (!cancelled) {
          setStandalone(toRideableMarket(track));
          setStandaloneLoading(false);
        }
      },
      () => {
        if (!cancelled) setStandaloneLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [idOrSlug, fromList, listLoading]);

  if (fromList) return { market: fromList, loading: listLoading };
  if (standalone) return { market: standalone, loading: false };
  return { market: null, loading: listLoading || standaloneLoading };
}
