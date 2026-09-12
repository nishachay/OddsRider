import type { RideableMarket } from '../data/polymarket';
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

const CATEGORIES = ['ALL', 'POLITICS', 'CRYPTO', 'MACRO', 'TECH', 'LEGENDARY'];

function CardRow({
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((m) => (
        <MarketCard
          key={m.id}
          market={m}
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
  const filtered = markets.filter((m) => {
    if (activeCategory !== 'ALL' && m.category !== activeCategory) return false;
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
  const showSearch = searchQuery.trim() !== '' || searching || searchResults !== null;
  const results = searchResults ?? filtered;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 select-none font-sans flex flex-col gap-12">

      {/* ── Category pills ── */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase border transition-colors cursor-pointer ${
              activeCategory === cat
                ? 'border-toxic bg-toxic/15 text-toxic'
                : 'border-[#232529] text-dim hover:text-ink'
            }`}
          >
            {cat === 'ALL' ? 'All markets' : cat}
          </button>
        ))}
      </div>

      {!live && (
        <div className="border border-amber-400/40 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-400">
          LIVE FEED UNAVAILABLE — SHOWING CACHED MARKETS. CONNECT TO RIDE REAL ODDS.
        </div>
      )}

      {/* ── Search results mode ── */}
      {showSearch ? (
        <section className="flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-[#232529] pb-3">
            <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-ink uppercase">
              {searching ? 'Searching Polymarket…' : `Results for "${searchQuery}" (${results.length})`}
            </h2>
            <button
              onClick={onClearSearch}
              className="font-mono text-[10px] font-bold tracking-widest text-dim hover:text-toxic transition-colors cursor-pointer uppercase"
            >
              [ Clear ]
            </button>
          </div>

          {results.length === 0 && searching ? (
            <div className="border border-[#232529] bg-[#101113] p-12 text-center font-mono text-xs text-dim animate-pulse">
              QUERYING LIVE MARKETS…
            </div>
          ) : results.length === 0 ? (
            <div className="border border-[#232529] bg-[#101113] p-12 text-center font-mono text-xs text-dim">
              NO CONTRACTS FOUND. TRY "BITCOIN", "TRUMP", OR "FED".
            </div>
          ) : (
            <CardRow items={results} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
          )}
        </section>
      ) : (
        <>
          {/* ── Trending ── */}
          <section className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-[#232529] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-toxic animate-pulse" />
                <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-ink uppercase">
                  Trending now ({filtered.length})
                </h2>
              </div>
              <span className="font-mono text-[10px] text-dim">SORTED BY 24H VOLUME</span>
            </div>

            {filtered.length === 0 ? (
              <div className="border border-[#232529] bg-[#101113] p-12 text-center font-mono text-xs text-dim">
                NOTHING IN THIS CATEGORY YET.
              </div>
            ) : (
              <CardRow items={filtered} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
            )}
          </section>

          {/* ── Legendary crashes ── */}
          {activeCategory !== 'LEGENDARY' && legendary.length > 0 && (
            <section className="flex flex-col gap-5 pt-4 border-t border-[#232529]">
              <div className="flex items-center justify-between border-b border-[#232529] pb-3">
                <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-crimson uppercase">
                  Legendary crashes
                </h2>
                <span className="font-mono text-[10px] text-dim">INSANE DIFFICULTY</span>
              </div>
              <CardRow items={legendary} onRideYes={onRideYes} onRideNo={onRideNo} onPreview={onPreview} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
