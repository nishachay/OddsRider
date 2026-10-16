import { Suspense, lazy, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopStrip from '../components/TopStrip';
import { bus, EV } from '../game/bus';
import { useMarkets } from '../data/marketsContext';
import { fetchRideForTrack, getDailyChallenge, type RideableMarket } from '../data/tracks';

const PhaserGame = lazy(() => import('../game/PhaserGame'));

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Title screen: the real game rides a real track behind the menu (attract
// mode). One keypress or tap starts today's featured ride. The bike drives
// itself via a held synthetic gas key — the game side is untouched.
export default function TitleScreen() {
  const navigate = useNavigate();
  const { markets, loading, reload } = useMarkets();
  const featured: RideableMarket | null = useMemo(
    () => getDailyChallenge(markets, todayStr()),
    [markets],
  );
  const started = useRef(false);

  // Roll out the featured terrain under the menu.
  useEffect(() => {
    if (!featured) return;
    let cancelled = false;
    fetchRideForTrack(featured, false, 'ALL')
      .then((ride) => {
        if (!cancelled) bus.emit(EV.LOAD_MARKET, { ...ride, attract: true });
      })
      .catch(() => {
        // Attract is decoration; the menu works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [featured]);

  // Autopilot: hold gas for the whole visit.
  useEffect(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    return () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    };
  }, []);

  const goRide = useCallback(() => {
    if (started.current || !featured) return;
    started.current = true;
    // Title-initiated rides skip the full countdown: the player just asked
    // to ride, so the gate is a single READY flash. Direct loads keep 3-2-1.
    navigate(`/ride/${featured.id}`, { state: { quick: true } });
  }, [featured, navigate]);

  // Any key rides — except when the player is working a control on purpose.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('a,button,input,textarea')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      goRide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goRide]);

  const pct = featured ? Math.round(featured.currentProb * 100) : 0;
  const up = (featured?.currentProb ?? 0) >= 0.5;
  const delta = featured?.probDelta;
  const deltaLabel =
    delta === null || delta === undefined
      ? '—'
      : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;

  return (
    <div
      className="relative w-full h-[100svh] min-h-[540px] overflow-hidden bg-[#0a0a0b] select-none"
      onClick={(e) => {
        const el = e.target as HTMLElement | null;
        if (el && el.closest('a,button')) return;
        goRide();
      }}
    >
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0b]">
              <div className="shimmer h-[3px] w-56" />
              <span className="font-mono text-[11px] tracking-[0.3em] text-dim uppercase">
                Rolling out track…
              </span>
            </div>
          }
        >
          <PhaserGame />
        </Suspense>
      </div>

      {/* Legibility scrims */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0a0a0b]/85 via-transparent to-[#0a0a0b]/90" />

      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <div className="pointer-events-auto">
          <TopStrip />
        </div>

        <div className="flex-1 flex flex-col justify-end max-w-6xl mx-auto w-full px-4 pb-8 sm:pb-10">
          {featured ? (
            <div className="flex flex-col gap-3 max-w-2xl">
              <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase">
                <span className={`inline-block w-2 h-2 mr-2 ${featured.live ? 'bg-toxic animate-pulse' : 'bg-dim'}`} />
                <span className={featured.live ? 'text-toxic' : 'text-dim'}>
                  {featured.live ? 'Live track' : 'Settled track'} · {featured.category}
                  {featured.kind === 'closed' && featured.resolution ? ` · Resolved ${featured.resolution}` : ''}
                </span>
              </span>
              <h1 className="font-poster uppercase leading-[0.95] text-5xl sm:text-7xl text-ink">
                Odds<span className="text-toxic">rider</span>
              </h1>
              <p className="font-display font-bold text-lg sm:text-xl text-ink leading-snug">
                {featured.question}
              </p>
              <p className="font-mono text-xs text-dim tabular-nums">
                <span className={`text-2xl font-bold ${up ? 'text-toxic' : 'text-crimson'}`}>{pct}%</span>{' '}
                YES · {deltaLabel} 24H
              </p>
              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={goRide}
                  className="pointer-events-auto w-fit px-10 py-4 bg-toxic text-bg font-mono text-sm font-bold tracking-[0.16em] uppercase hover:bg-toxic/90 active:scale-[0.98] transition-all cursor-pointer shadow-[0_0_24px_rgba(182,255,0,0.45)]"
                >
                  Enter race
                </button>
                <span className="prompt-pulse font-mono text-[11px] font-bold tracking-[0.28em] text-dim uppercase">
                  Press any key · Tap to ride
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-w-2xl">
              <h1 className="font-poster uppercase leading-[0.95] text-5xl sm:text-7xl text-ink">
                Odds<span className="text-toxic">rider</span>
              </h1>
              {loading ? (
                <div className="shimmer h-[3px] w-56" />
              ) : (
                <>
                  <p className="font-mono text-xs text-dim uppercase tracking-[0.18em]">
                    No tracks published yet — check back soon.
                  </p>
                  <button
                    onClick={reload}
                    className="pointer-events-auto w-fit px-6 py-3 font-mono text-xs font-bold tracking-[0.16em] uppercase border border-toxic/40 text-toxic hover:bg-toxic hover:text-bg transition-all cursor-pointer"
                  >
                    Retry →
                  </button>
                </>
              )}
            </div>
          )}
          <p className="hidden sm:block font-mono text-[10px] tracking-[0.2em] text-dim pt-4 uppercase">
            W gas · A/D lean · Space jump · Free · No account
          </p>
        </div>
      </div>
    </div>
  );
}
