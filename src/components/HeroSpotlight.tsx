import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { RideableMarket } from '../data/polymarket';
import { bus, EV } from '../game/bus';
import { fetchRideForMarket } from '../data/polymarket';

const PhaserGame = lazy(() => import('../game/PhaserGame'));

interface ArcadeProps {
  markets: RideableMarket[];
  featured: RideableMarket;
  live: boolean;
  onRide: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

interface SearchStripProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: (q: string) => void;
}

const QUICK_PICKS = ['BITCOIN', 'TRUMP', 'FED', 'AI'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function StagePoster({ market }: { market: RideableMarket }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0b]">
      <span className="font-mono text-[11px] tracking-[0.3em] text-dim animate-pulse uppercase">
        Rolling out {market.category} track…
      </span>
    </div>
  );
}

// Fullscreen arcade stage: the live game is the backdrop (attract zoom).
// Browse the rail (the stage re-terrains under you), ENTER rides.
// Gameplay code untouched — this shell only uses EV.LOAD_MARKET + attract.
export default function ArcadeStage({ markets, featured, live, onRide, onPreview }: ArcadeProps) {
  const [selId, setSelId] = useState(featured.id);
  const [stageOn, setStageOn] = useState(false);
  const selected = useMemo(
    () => markets.find((m) => m.id === selId) ?? featured,
    [markets, selId, featured],
  );
  const selRef = useRef(selected);
  selRef.current = selected;
  const railRef = useRef<HTMLDivElement | null>(null);
  const gen = useRef(0);
  const applied = useRef<string | null>(null);
  const left = useRef(false);

  const selIndex = Math.max(
    0,
    markets.findIndex((m) => m.id === selected.id),
  );
  const pct = Math.round(selected.currentProb * 100);
  const up = selected.currentProb >= 0.5;
  const delta = selected.probDelta;
  const deltaLabel =
    delta === null ? '—' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`;

  // Boot: paint the menu first, then roll out the featured terrain.
  useEffect(() => {
    const t = window.setTimeout(() => setStageOn(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  // Load terrain for the selection (debounced for rail browsing).
  // Emitting with no scene alive is harmless; late scenes read the store.
  useEffect(() => {
    if (!stageOn) return;
    const m = markets.find((x) => x.id === selId) ?? featured;
    if (applied.current === m.id) return;
    const isBoot = applied.current === null;
    const g = ++gen.current;
    const t = window.setTimeout(
      () => {
        fetchRideForMarket(m, false, 'max')
          .then((ride) => {
            if (gen.current === g) {
              applied.current = m.id;
              bus.emit(EV.LOAD_MARKET, { ...ride, attract: true });
            }
          })
          .catch(() => {});
      },
      isBoot ? 0 : 350,
    );
    return () => {
      window.clearTimeout(t);
      gen.current++;
    };
  }, [stageOn, selId, markets, featured]);

  // Keep the selected rail row in view.
  useEffect(() => {
    railRef.current
      ?.querySelector('[data-sel="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selId]);

  // Arcade keys: browse the rail, ENTER rides. Never steal typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const idx = Math.max(
        0,
        markets.findIndex((m) => m.id === selRef.current.id),
      );
      if (e.code === 'ArrowDown' || e.code === 'KeyJ') {
        e.preventDefault();
        setSelId(markets[Math.min(markets.length - 1, idx + 1)].id);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyK') {
        e.preventDefault();
        setSelId(markets[Math.max(0, idx - 1)].id);
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyW') {
        e.preventDefault();
        if (!left.current) {
          left.current = true;
          onRide(selRef.current);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [markets, onRide]);

  return (
    <section className="relative w-full h-[calc(100svh-6rem)] min-h-[540px] overflow-hidden select-none">
      <div className="absolute inset-0 bg-[#0a0a0b]">
        {stageOn ? (
          <Suspense fallback={<StagePoster market={selected} />}>
            <PhaserGame />
          </Suspense>
        ) : (
          <StagePoster market={selected} />
        )}
      </div>

      {/* Legibility scrims: content lives top + bottom, world owns the middle */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0a0a0b] via-transparent to-[#0a0a0b]" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0a0a0b]/80 via-transparent to-[#0a0a0b]/40" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full max-w-6xl mx-auto px-4 py-6 sm:py-7 flex gap-6">
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div className="max-w-2xl">
              <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.3em] uppercase">
                <span
                  className={`inline-block w-2 h-2 ${live ? 'bg-toxic animate-pulse' : 'bg-amber-400'}`}
                />
                <span className={live ? 'text-toxic' : 'text-amber-400'}>
                  {live ? 'Live' : 'Offline'} · Race {pad(selIndex + 1)} · {selected.category}
                </span>
              </span>

              <span className="block font-display font-bold text-xl sm:text-2xl text-ink leading-snug pt-3">
                {selected.question}
              </span>

              <div className="flex items-end gap-2 pt-1">
                <span
                  className={`font-poster leading-none text-6xl sm:text-7xl tabular-nums ${up ? 'text-toxic' : 'text-crimson'}`}
                  style={{ textShadow: up ? '0 0 32px rgba(182,255,0,0.35)' : '0 0 32px rgba(255,51,85,0.35)' }}
                >
                  {pct}
                  <span className="text-xl text-dim">%</span>
                </span>
                <span className="flex flex-col pb-1">
                  <span className="font-sans text-xs font-extrabold text-ink">YES</span>
                  <span
                    className={`font-mono text-[11px] font-bold tabular-nums ${delta !== null && delta < 0 ? 'text-crimson' : 'text-toxic'}`}
                  >
                    {deltaLabel} 24H
                  </span>
                </span>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-4 pointer-events-auto">
                <button
                  onClick={() => onRide(selected)}
                  className="px-8 py-4 bg-toxic text-bg font-mono text-sm font-bold tracking-[0.16em] uppercase hover:bg-toxic/90 transition-all cursor-pointer shadow-[0_0_24px_rgba(182,255,0,0.45)]"
                >
                  Enter race {pad(selIndex + 1)}
                </button>
                <button
                  onClick={() => onPreview(selected)}
                  className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim hover:text-toxic transition-colors cursor-pointer uppercase underline underline-offset-8 decoration-[#3b414f] hover:decoration-toxic"
                >
                  Inspect track
                </button>
              </div>

              <span className="hidden sm:block font-mono text-[10px] tracking-[0.2em] text-dim pt-3 uppercase">
                ↑↓ browse · Enter ride · Free · No account
              </span>
            </div>
          </div>

          <aside className="hidden lg:flex w-80 shrink-0 flex-col justify-center pointer-events-auto">
            <div className="font-mono text-[10px] font-bold tracking-[0.22em] text-dim uppercase pb-2">
              On the card · {markets.length}
            </div>
            <div ref={railRef} className="overflow-y-auto border-t border-[#232529] max-h-[52vh] bg-[#0a0a0b]/70 backdrop-blur-[2px]">
              {markets.map((m, i) => {
                const active = m.id === selected.id;
                const p = Math.round(m.currentProb * 100);
                const mUp = m.currentProb >= 0.5;
                return (
                  <button
                    key={m.id}
                    data-sel={active}
                    onClick={() => setSelId(m.id)}
                    onDoubleClick={() => onRide(m)}
                    className={`w-full flex items-center gap-3 pl-0 pr-3 py-2.5 border-b border-[#1a1c22] text-left transition-colors cursor-pointer ${
                      active ? 'bg-[#101113]' : 'hover:bg-[#101113]/60'
                    }`}
                  >
                    <span className={`w-[3px] self-stretch shrink-0 ${active ? 'bg-toxic' : 'bg-transparent'}`} />
                    <span className="font-poster text-lg text-dim w-7 shrink-0 tabular-nums">
                      {pad(i + 1)}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-display text-[13px] font-semibold text-ink">
                      {m.question}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold tabular-nums shrink-0 ${mUp ? 'text-toxic' : 'text-crimson'}`}
                    >
                      {p}%
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function SearchStrip({ query, onQueryChange, onSearch }: SearchStripProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <section id="find" className="w-full max-w-6xl mx-auto px-4 pt-12 scroll-mt-16 select-none">
      <h2 className="font-poster uppercase text-3xl sm:text-4xl text-ink leading-none">
        Find your race
      </h2>
      <p className="font-mono text-[10px] font-bold tracking-[0.22em] text-dim pt-2 uppercase">
        Search the card — or paste any Polymarket link
      </p>

      <form
        className="flex items-end gap-3 pt-4 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSearch(query.trim());
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Bitcoin, Trump, Fed…  ( / )"
          className="flex-1 bg-transparent border-b-2 border-[#3b414f] focus:border-toxic focus:outline-none font-display font-bold text-xl py-2 text-ink placeholder:text-dim/40 transition-colors"
        />
        <button
          type="submit"
          className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-toxic border-b-2 border-toxic px-1 py-2 hover:bg-toxic hover:text-bg transition-all cursor-pointer"
        >
          Find →
        </button>
      </form>

      <div className="flex items-center gap-5 pt-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase">
        {QUICK_PICKS.map((chip, i) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              onQueryChange(chip);
              onSearch(chip);
            }}
            className="text-dim hover:text-toxic transition-colors cursor-pointer"
          >
            <span className="text-[#3b414f] mr-1">0{i + 1}</span>
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
}
