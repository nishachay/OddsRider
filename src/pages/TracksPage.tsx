import { useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopStrip from '../components/TopStrip';
import MiniTrack from '../components/MiniTrack';
import { useMarkets } from '../data/marketsContext';
import { getHomePageData, momentumUp, type RideableMarket } from '../data/tracks';

function rideUrl(market: RideableMarket, inverted: boolean): string {
  return `/ride/${market.id}${inverted ? '?side=no' : ''}`;
}

function TrackRow({
  market,
  index,
  rowRef,
  onFocusDown,
  onFocusUp,
}: {
  market: RideableMarket;
  index: number;
  rowRef: (el: HTMLButtonElement | null) => void;
  onFocusDown: () => void;
  onFocusUp: () => void;
}) {
  const navigate = useNavigate();
  const probPct = Math.round(market.currentProb * 100);
  // One colour rule for the whole row, mirroring the in-game track renderer
  // (`seg.rising ? toxic : crimson`): the 24h direction colours BOTH the
  // silhouette and the number. A 77% that fell today reads red; a 23% that
  // climbed reads green — momentum, not level. See momentumUp.
  const momentum = momentumUp(market.probDelta) ? 'text-toxic' : 'text-crimson';

  return (
    <div className="rise group relative flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 px-4 sm:px-5 py-4 border-t border-[#232529] hover:bg-[#101113] transition-colors ease-[cubic-bezier(0.16,1,0.3,1)] select-none">
      <span className="absolute left-0 top-0 h-full w-[3px] bg-toxic opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" />
      <span className="hidden lg:block font-poster text-2xl text-[#3b414f] group-hover:text-toxic transition-colors w-10 shrink-0 tabular-nums">
        {index.toString().padStart(2, '0')}
      </span>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <button
          ref={rowRef}
          onClick={() => navigate(rideUrl(market, false))}
          onKeyDown={(e) => {
            if (e.code === 'ArrowDown') {
              e.preventDefault();
              onFocusDown();
            } else if (e.code === 'ArrowUp') {
              e.preventDefault();
              onFocusUp();
            }
          }}
          className="text-left font-display font-bold text-[16px] sm:text-[17px] leading-snug text-ink group-hover:text-toxic transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-toxic"
        >
          {market.question}
        </button>
        <span className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
          {market.category} · {market.difficulty}
          {market.kind === 'closed'
            ? market.resolution
              ? ` · Resolved ${market.resolution}`
              : ' · Settled'
            : ''}
        </span>
      </div>

      <div className="w-full sm:w-44 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
        <MiniTrack pts={market.sparkline} deltaUp={momentumUp(market.probDelta)} />
      </div>

      <div className="flex lg:flex-col items-baseline lg:items-end gap-x-2 shrink-0 lg:w-24">
        <span className={`font-poster text-4xl leading-none tabular-nums ${momentum}`}>
          {probPct}
          <span className="text-lg text-dim">%</span>
        </span>
      </div>

      <div className="grid grid-cols-2 lg:flex gap-2 shrink-0">
        <button
          onClick={() => navigate(rideUrl(market, false))}
          title="Ride the track as it happened"
          className="min-h-[48px] px-4 py-2.5 lg:py-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase bg-toxic/10 text-toxic border border-toxic/40 hover:bg-toxic hover:text-bg active:scale-[0.98] transition-all cursor-pointer text-center"
        >
          Ride yes ∧
        </button>
        <button
          onClick={() => navigate(rideUrl(market, true))}
          title="Ride the same track mirrored — rallies become descents"
          className="min-h-[48px] px-4 py-2.5 lg:py-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase bg-crimson/10 text-crimson border border-crimson/40 hover:bg-crimson hover:text-bg active:scale-[0.98] transition-all cursor-pointer text-center"
        >
          Ride no ∨
        </button>
      </div>
    </div>
  );
}

function Group({
  title,
  note,
  items,
  startIndex,
}: {
  title: string;
  note: string;
  items: RideableMarket[];
  startIndex: number;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-4 px-1">
        <h2 className="font-poster uppercase leading-none text-3xl sm:text-4xl text-ink">{title}</h2>
        <span className="font-mono text-[10px] text-dim tracking-[0.18em] pb-1 whitespace-nowrap uppercase">{note}</span>
      </div>
      <div className="border-b border-[#232529]">
        {items.map((m, i) => (
          <TrackRow
            key={m.id}
            market={m}
            index={startIndex + i + 1}
            rowRef={(el) => {
              refs.current[i] = el;
            }}
            onFocusDown={() => refs.current[Math.min(refs.current.length - 1, i + 1)]?.focus()}
            onFocusUp={() => refs.current[Math.max(0, i - 1)]?.focus()}
          />
        ))}
      </div>
    </section>
  );
}

// Level select: every frozen track, live and settled apart. Arrows move
// between rows, Enter rides the focused one; tap works everywhere.
export default function TracksPage() {
  const { markets, loading, feedError, reload } = useMarkets();
  const data = useMemo(() => getHomePageData(markets), [markets]);

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0a0a0b] text-[#f0f0f2]">
      <TopStrip />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-10 pb-16 flex flex-col gap-10">
        <div className="flex flex-col gap-2 px-1">
          <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-toxic uppercase">
            Level select
          </span>
          <h1 className="font-poster uppercase leading-[0.95] text-5xl sm:text-6xl text-ink">
            Pick your track
          </h1>
          <p className="font-mono text-[11px] text-dim tracking-[0.14em] uppercase">
            {data.trending.length} live · {data.closed.length} settled · arrows browse · Enter rides
          </p>
        </div>

        {loading && markets.length === 0 ? (
          <div className="flex flex-col gap-4 py-16 items-start">
            <div className="shimmer h-[3px] w-56" />
            <span className="font-mono text-[11px] tracking-[0.3em] text-dim uppercase">Loading tracks…</span>
          </div>
        ) : feedError ? (
          <div className="border border-amber-400/40 border-l-4 border-l-amber-400 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              {feedError === 'TRACKS_EMPTY'
                ? 'NO TRACKS PUBLISHED YET — THE NEXT INGEST WILL FILL THE CARD.'
                : 'TRACK INDEX UNREACHABLE — CHECK YOUR CONNECTION AND RETRY.'}
            </span>
            <button
              onClick={reload}
              className="shrink-0 font-bold tracking-widest hover:bg-amber-400 hover:text-bg px-2 py-1 transition-colors cursor-pointer uppercase"
            >
              Retry →
            </button>
          </div>
        ) : markets.length === 0 ? (
          <p className="font-mono text-xs text-dim uppercase tracking-[0.18em] py-16 text-center">
            Nothing on the card yet.
          </p>
        ) : (
          <>
            <Group title="Live" note="Still moving" items={data.trending} startIndex={0} />
            <Group title="Settled" note="Final results" items={data.closed} startIndex={data.trending.length} />
          </>
        )}

        <Link
          to="/"
          className="self-start font-mono text-xs font-bold tracking-[0.2em] text-toxic border-b-2 border-toxic/40 px-1 py-2 hover:bg-toxic hover:text-bg transition-colors uppercase"
        >
          ← Back to title
        </Link>
      </main>
    </div>
  );
}
