import type { RideableMarket } from '../data/tracks';
import { useMarkets } from '../data/marketsContext';
import MarketCard from './MarketCard';

interface MarketGridProps {
  markets: RideableMarket[];
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  searchResults: RideableMarket[] | null;
  searching: boolean;
  onClearSearch: () => void;
  live: boolean;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

const DIVISIONS = ['ALL', 'POLITICS', 'CRYPTO', 'MACRO', 'TECH', 'LEGENDARY', 'CLOSED'];

const FEED_REASON: Record<string, string> = {
  TRACKS_UNREACHABLE: 'TRACK INDEX UNREACHABLE — CHECK YOUR CONNECTION AND RETRY.',
  TRACKS_INVALID: 'TRACK INDEX FAILED VALIDATION — THE PUBLISHED DATA IS MALFORMED.',
  TRACKS_EMPTY: 'NO TRACKS PUBLISHED YET — THE NEXT INGEST WILL FILL THE CARD.',
};

function RaceList({
  items,
  onRideYes,
  onRideNo,
  onPreview,
}: {
  items: RideableMarket[];
  onRideYes: (m: RideableMarket) => void;
  onRideNo: (m: RideableMarket) => void;
  onPreview: (m: RideableMarket) => void;
}) {
  return (
    <div className="border-b border-[#232529]">
      {items.map((m, i) => (
        <MarketCard
          key={m.id}
          market={m}
          index={i + 1}
          onRideYes={onRideYes}
          onRideNo={onRideNo}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

export default function MarketGrid({
  markets,
  activeCategory,
  onSelectCategory,
  searchQuery,
  searchResults,
  searching,
  onClearSearch,
  live,
  onRideYes,
  onRideNo,
  onPreview,
}: MarketGridProps) {
  const { reload, feedError } = useMarkets();
  // Legendary and settled tracks run in their own races — never duplicate
  // them inside the main card.
  const filtered = markets.filter((m) => {
    if (activeCategory === 'ALL') return m.category !== 'LEGENDARY' && m.kind !== 'closed';
    if (activeCategory === 'CLOSED') return m.kind === 'closed';
    if (m.category !== activeCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        m.question.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.volatilityLabel.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const legendary = markets.filter((m) => m.category === 'LEGENDARY');
  const closed = markets.filter((m) => m.kind === 'closed');
  const showSearch = searchQuery.trim() !== '' || searching || searchResults !== null;
  const results = searchResults ?? filtered;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-12 pb-16 select-none flex flex-col gap-10">

      <div className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-poster uppercase leading-none text-4xl sm:text-5xl text-ink">
            {activeCategory === 'LEGENDARY'
              ? 'Legendary crashes'
              : activeCategory === 'CLOSED'
                ? 'Settled tracks'
                : "Today's card"}
          </h2>
          <span className="font-mono text-[10px] text-dim tracking-[0.18em] pb-1 whitespace-nowrap">
            SORTED BY 24H VOLUME
          </span>
        </div>

        {/* ── Divisions ── */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] font-bold tracking-[0.18em] uppercase">
          {DIVISIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`pb-1 border-b-2 transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'text-toxic border-toxic'
                  : 'text-dim border-transparent hover:text-ink'
              }`}
            >
              {cat === 'ALL' ? 'All races' : cat}
            </button>
          ))}
        </div>
      </div>

      {!live && (
        <div className="border border-amber-400/40 border-l-4 border-l-amber-400 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            TRACK FEED UNAVAILABLE.{' '}
            {FEED_REASON[feedError ?? 'TRACKS_UNREACHABLE']}
          </span>
          <button
            onClick={reload}
            className="shrink-0 font-bold tracking-widest hover:bg-amber-400 hover:text-bg px-2 py-1 transition-colors cursor-pointer uppercase"
          >
            Retry →
          </button>
        </div>
      )}

      {/* ── Search results mode ── */}
      {showSearch ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold tracking-[0.2em] text-ink uppercase">
              {searching ? 'Searching tracks…' : `Results for "${searchQuery}" (${results.length})`}
            </h3>
            <button
              onClick={onClearSearch}
              className="font-mono text-[10px] font-bold tracking-widest text-dim hover:text-toxic transition-colors cursor-pointer uppercase"
            >
              Clear ×
            </button>
          </div>

          {results.length === 0 && searching ? (
            <div className="border-y border-[#232529] p-12 text-center font-mono text-xs text-dim animate-pulse">
              SEARCHING FROZEN TRACKS…
            </div>
          ) : results.length === 0 ? (
            <div className="border-y border-[#232529] p-12 text-center font-mono text-xs text-dim">
              NO RUNNERS FOUND. TRY "BITCOIN", "TRUMP", OR "FED".
            </div>
          ) : (
            <RaceList items={results} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
          )}
        </section>
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="border-y border-[#232529] p-12 text-center font-mono text-xs text-dim">
              NOTHING IN THIS DIVISION YET.
            </div>
          ) : (
            <RaceList items={filtered} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
          )}

          {/* ── Legendary crashes ── */}
          {activeCategory !== 'LEGENDARY' && legendary.length > 0 && (
            <section className="flex flex-col gap-4 pt-2">
              <h3 className="font-poster uppercase leading-none text-3xl sm:text-4xl text-crimson">
                Legendary crashes
              </h3>
              <RaceList items={legendary} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
            </section>
          )}

          {/* ── Settled: real resolved markets, final outcome on the card ── */}
          {activeCategory !== 'CLOSED' && closed.length > 0 && (
            <section className="flex flex-col gap-4 pt-2">
              <h3 className="font-poster uppercase leading-none text-3xl sm:text-4xl text-dim">
                Settled tracks
              </h3>
              <p className="font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
                Real resolved markets — the final result rides with you.
              </p>
              <RaceList items={closed} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
