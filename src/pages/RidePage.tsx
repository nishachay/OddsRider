import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import HudOverlay from '../components/HudOverlay';
import CountdownGate from '../components/CountdownGate';
import { audio } from '../game/audio';
import { bus, EV } from '../game/bus';
import { fetchRideForTrack, rideIntervalFromParam, type RideInterval } from '../data/tracks';
import { recordRun, saveGhostRun } from '../data/playerStorage';
import type { RunResult } from '../game/replay';
import { useMarket } from '../data/marketsContext';

// Phaser (1.5MB) loads only here, never on home/preview.
const PhaserGame = lazy(() => import('../game/PhaserGame'));

export default function RidePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { marketId } = useParams<{ marketId: string }>();
  const [searchParams] = useSearchParams();
  const { market, loading } = useMarket(marketId);
  const [loadError, setLoadError] = useState(false);
  const [noHistory, setNoHistory] = useState(false);
  const [retry, setRetry] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);
  // Title-initiated rides arrive hot: single-flash gate instead of 3-2-1.
  const quick = (location.state as { quick?: boolean } | null)?.quick === true;

  const inverted = searchParams.get('side') === 'no';
  const interval: RideInterval = rideIntervalFromParam(searchParams.get('tf'));
  const rideUrl = market
    ? `${window.location.origin}/ride/${market.id}${inverted ? '?side=no' : ''}`
    : window.location.href;

  // Fetch this ride's terrain and hand it to the scene.
  // Runs on direct-link loads too — the URL is the source of truth.
  useEffect(() => {
    if (!market) return;
    setLoadError(false);
    setNoHistory(false);
    let cancelled = false;
    fetchRideForTrack(market, inverted, interval)
      .then((ride) => {
        if (!cancelled) bus.emit(EV.LOAD_MARKET, ride);
      })
      .catch((e) => {
        console.error('Failed to launch ride:', e);
        if (cancelled) return;
        if (e instanceof Error && e.message.startsWith('NO_HISTORY')) setNoHistory(true);
        else setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [market, inverted, interval, retry]);

  // Persist finished/crashed runs to local player stats
  useEffect(() => {
    if (!market) return;
    const id = market.id;
    const offResult = bus.on<{ finished: boolean; score: number; timeMs: number } | null>(
      EV.RESULT,
      (res) => {
        if (res) recordRun(id, res.score, res.finished, res.timeMs);
      },
    );
    // The scene publishes the recorded run; the best one per terrain keeps
    // its full-fidelity snapshots so it can be raced as a ghost later.
    const offRunResult = bus.on<RunResult | null>(EV.RUN_RESULT, (res) => {
      if (!res || res.snapshots.length === 0) return;
      saveGhostRun({
        trackId: id,
        inverted,
        interval,
        score: res.score,
        timeMs: res.timeMs,
        finished: res.finished,
        snapshots: res.snapshots,
      });
    });
    const offFirst = bus.on<void>(EV.INPUT_FIRST, () => audio.start());
    return () => {
      offResult();
      offRunResult();
      offFirst();
      audio.destroy();
    };
  }, [market, inverted, interval]);

  const openGate = useCallback(() => setGateOpen(true), []);

  if (!market) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2] flex flex-col items-center justify-center gap-4">
        {loading ? (
          <p className="font-mono text-xs text-dim animate-pulse">LOADING FROZEN TRACK...</p>
        ) : (
          <>
            <p className="font-mono text-xs text-dim">TRACK NOT FOUND: {marketId}</p>
            <Link
              to="/"
              className="font-mono text-xs font-bold tracking-widest text-toxic border border-toxic/40 px-4 py-2 hover:bg-toxic hover:text-bg transition-colors"
            >
              [ BACK TO MARKETS ]
            </Link>
          </>
        )}
      </div>
    );
  }

  // Honest dead-end: no price history anywhere, so no track to ride.
  if (noHistory) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-mono text-xs font-bold tracking-widest text-crimson">NO PRICE HISTORY AVAILABLE</p>
        <p className="font-sans text-sm text-dim max-w-md">
          {market.question} has no rideable price history right now, so there is no track to build.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => {
              setNoHistory(false);
              setRetry((r) => r + 1);
            }}
            className="font-mono text-xs font-bold tracking-widest text-ink border border-[#232529] px-4 py-2 hover:border-toxic/60 hover:text-toxic transition-colors"
          >
            [ RETRY ]
          </button>
          <Link
            to={`/preview/${market.id}`}
            className="font-mono text-xs font-bold tracking-widest text-toxic border border-toxic/40 px-4 py-2 hover:bg-toxic hover:text-bg transition-colors"
          >
            [ BACK TO TRACK ]
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg z-40">
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-xs text-dim animate-pulse">SPINNING UP PHYSICS...</p>
          </div>
        }
      >
        <PhaserGame />
      </Suspense>
      <HudOverlay onOpenLobby={() => navigate('/')} rideUrl={rideUrl} />
      {!gateOpen && <CountdownGate onDone={openGate} short={quick} />}
      {loadError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 font-mono text-[11px] text-crimson border border-crimson/50 bg-[#0a0a0b]/90 px-4 py-2">
          FAILED TO LOAD TRACK DATA
        </div>
      )}
    </div>
  );
}
