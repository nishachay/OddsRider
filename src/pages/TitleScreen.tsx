import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopStrip from '../components/TopStrip';
import GameStage from '../components/GameStage';
import { EmptyTracksState, FeedErrorState } from '../components/LoadStates';
import { activeRideStore, bus, EV } from '../game/bus';
import { useMarkets } from '../data/marketsContext';
import { fetchRideForTrack, getTitleFeature, momentumUp, type RideableMarket } from '../data/tracks';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Title screen: the real game rides a real track behind the menu (attract
// mode). One keypress or tap starts today's featured ride. The bike drives
// itself via a held synthetic gas key — the game side is untouched.
export default function TitleScreen() {
  const navigate = useNavigate();
  const { markets, loading, feedError, reload } = useMarkets();
  const featured: RideableMarket | null = useMemo(
    () => getTitleFeature(markets, todayStr()),
    [markets],
  );
  const started = useRef(false);

  // Roll out the featured terrain under the menu. The attract flag travels
  // in the store itself (not just the emitted copy) so a scene that boots
  // after the emit still applies the wide showroom framing.
  useEffect(() => {
    if (!featured) return;
    let cancelled = false;
    fetchRideForTrack(featured, false, 'ALL')
      .then((ride) => {
        if (cancelled) return;
        const attractRide = { ...ride, attract: true };
        activeRideStore.current = attractRide;
        bus.emit(EV.LOAD_MARKET, attractRide);
      })
      .catch(() => {
        // Attract is decoration; the menu works without it.
      });
    return () => {
      cancelled = true;
    };
  }, [featured]);

  // Autopilot: hold gas for the whole visit. The key goes down only once the
  // scene exists (its InputManager listens on window), and is re-asserted
  // on focus because the game clears keys on blur.
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const hold = () => {
      if (cancelled) return;
      const handle = (window as unknown as { __oddsrider?: unknown }).__oddsrider;
      if (handle) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      } else {
        timer = window.setTimeout(hold, 250);
      }
    };
    hold();
    const refocus = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.addEventListener('focus', refocus);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('focus', refocus);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    };
  }, []);

  // Attract watchdog: full gas with no skill wedges or loops crashes. If the
  // bike is crashed, or sim time advances a full second with no forward
  // progress, restart it via the game's own reset path so the backdrop keeps
  // riding. Sim-gated (not wall-clock) so slow headless GPUs don't cause
  // spurious restarts.
  const lastProbe = useRef<{ x: number; simMs: number } | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => {
      const handle = (window as unknown as { __oddsrider?: Record<string, () => unknown> }).__oddsrider;
      if (!handle) return;
      try {
        const x = handle.x() as number;
        const simMs = handle.simMs() as number;
        const crashed = handle.crashed() as boolean;
        const prev = lastProbe.current;
        if (crashed || (prev !== null && simMs - prev.simMs >= 1000 && Math.abs(x - prev.x) < 5)) {
          bus.emit(EV.RESTART);
          lastProbe.current = null;
        } else {
          lastProbe.current = { x, simMs };
        }
      } catch {
        // Debug handle not ready yet.
      }
    }, 2500);
    return () => window.clearInterval(t);
  }, []);

  const goRide = useCallback(() => {
    if (started.current || !featured) return;
    started.current = true;
    // Title-initiated rides skip the full countdown: the player just asked
    // to ride, so the gate is a single READY flash. Direct loads keep 3-2-1.
    navigate(`/ride/${featured.id}`, { state: { quick: true } });
  }, [featured, navigate]);

  // Any key rides — except when the player is working a control on purpose.
  // (e.target can be window/document for synthetic events: no .closest there.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Synthetic keys (including the attract autopilot's held gas) never ride.
      if (!e.isTrusted) return;
      const el = e.target as HTMLElement | null;
      if (el && typeof el.closest === 'function' && el.closest('a,button,input,textarea')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      goRide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goRide]);

  const pct = featured ? Math.round(featured.currentProb * 100) : 0;
  // Same momentum rule as everywhere else: 24h direction, not level.
  const up = momentumUp(featured?.probDelta ?? null);
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
        if (el && typeof el.closest === 'function' && el.closest('a,button')) return;
        goRide();
      }}
    >
      <div className="absolute inset-0">
        <GameStage label="Rolling out track" />
      </div>

      {/* Legibility scrims */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0a0a0b]/85 via-transparent to-[#0a0a0b]/90" />

      <div className="absolute inset-0 flex flex-col pointer-events-none">
        <div className="pointer-events-auto">
          <TopStrip hideWordmark />
        </div>

        <div className="flex-1" />

        {/* Solid backing: the hero text sits fully below the world — no ground
            line or bike ever crosses it, at any viewport. */}
        <div className="pointer-events-none w-full bg-[#0a0a0b] border-t border-[#1a1c22]">
          <div className="max-w-6xl mx-auto w-full px-4 py-5 sm:py-6 flex flex-col">
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
                ) : feedError ? (
                  <FeedErrorState code={feedError} onRetry={reload} />
                ) : (
                  <EmptyTracksState onRetry={reload} />
                )}
              </div>
            )}
            <p className="hidden sm:block font-mono text-[10px] tracking-[0.2em] text-dim pt-4 uppercase">
              W gas · A/D lean · Space jump · Free · No account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
