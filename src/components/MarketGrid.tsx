import type { RideableMarket } from '../data/polymarket';
import MarketCard from './MarketCard';

interface MarketGridProps {
  markets: RideableMarket[];
  activeCategory: string;
  searchQuery: string;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

export default function MarketGrid({
  markets,
  activeCategory,
  searchQuery,
  onRideYes,
  onRideNo,
  onPreview,
}: MarketGridProps) {
  // Filter logic
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

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 select-none font-sans flex flex-col gap-12">
      
      {/* ── 1. ACTIVE LIVE MARKETS ── */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-[#232529] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-toxic animate-pulse" />
            <h2 className="font-mono text-xs font-bold tracking-[0.2em] text-ink uppercase">
              LIVE PREDICTION FEED ({filtered.length} MARKETS)
            </h2>
          </div>

          <span className="font-mono text-[10px] text-dim">
            SORTED BY 24H VOLUME
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="border border-[#232529] bg-[#101113] p-12 text-center font-mono text-xs text-dim">
            NO POLYMARKET CONTRACTS FOUND MATCHING "{searchQuery}". TRY SEARCHING "BITCOIN", "TRUMP", OR "FED".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((m) => (
              <MarketCard
                key={m.id}
                market={m}
                onRideYes={onRideYes}
                onRideNo={onRideNo}
                onPreview={onPreview}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── 2. LEGENDARY CRASHES SECTION (If not already filtered to crashes) ── */}
      {activeCategory !== 'LEGENDARY' && (
        <section className="flex flex-col gap-5 pt-4 border-t border-[#232529]">
          <div className="flex items-center justify-between border-b border-[#232529] pb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-crimson uppercase">
                💀 HISTORIC MARKET CRASHES (EXTREME VERTICAL DROP-OFFS)
              </span>
            </div>

            <span className="font-mono text-[10px] text-dim">
              INSANE DIFFICULTY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {legendary.map((m) => (
              <MarketCard
                key={m.id}
                market={m}
                onRideYes={onRideYes}
                onRideNo={onRideNo}
                onPreview={onPreview}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
