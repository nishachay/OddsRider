import { useMemo } from 'react';
import type { RideableMarket } from '../data/polymarket';
import MarketCard from './MarketCard';

interface MarketGridProps {
  markets: RideableMarket[];
  activeCategory: string;
  searchQuery: string;
  onSelectMarket: (market: RideableMarket) => void;
}

export default function MarketGrid({
  markets,
  activeCategory,
  searchQuery,
  onSelectMarket,
}: MarketGridProps) {
  const trendingMarkets = useMemo(() => {
    return markets.filter((m) => {
      const isLeg = m.category === 'LEGENDARY';
      const matchCat =
        activeCategory === 'ALL'
          ? !isLeg
          : activeCategory === 'LEGENDARY'
          ? isLeg
          : m.category === activeCategory;
      const matchQuery =
        !searchQuery ||
        m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.slug.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [markets, activeCategory, searchQuery]);

  const legendaryMarkets = useMemo(() => {
    return markets.filter((m) => m.category === 'LEGENDARY');
  }, [markets]);

  const liveFeatured = markets[0];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 my-8 select-none flex flex-col gap-12">
      
      {/* ── 1. LIVE MARKET SPOTLIGHT (StonkRider Image 2 "LIVE IPO") ── */}
      {activeCategory === 'ALL' && !searchQuery && liveFeatured && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-[#7c7f86] uppercase tracking-wider">
            <span>LIVE MARKETS</span>
            <span className="w-2 h-2 rounded-full bg-[#00df81] animate-pulse" />
          </div>

          <div className="max-w-md">
            <MarketCard market={liveFeatured} onSelect={onSelectMarket} />
          </div>
        </section>
      )}

      {/* ── 2. TRENDING TRACKS GRID (StonkRider Image 2 & 3) ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between font-mono text-xs text-[#7c7f86] uppercase tracking-wider">
          <span>
            {activeCategory === 'LEGENDARY' ? 'LEGENDARY CRASHES 💀' : 'TRENDING TRACKS'} • {trendingMarkets.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trendingMarkets.length === 0 ? (
            <div className="col-span-full py-16 text-center text-sm text-[#7c7f86] border border-[#1b202a] rounded-2xl bg-[#111317]">
              No matching tracks found. Try searching another market or ticker.
            </div>
          ) : (
            trendingMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onSelect={onSelectMarket}
              />
            ))
          )}
        </div>
      </section>

      {/* ── 3. LEGENDARY CRASHES SECTION (StonkRider Image 3 & 4) ── */}
      {activeCategory === 'ALL' && !searchQuery && (
        <section className="flex flex-col gap-4 pt-4 border-t border-[#1b202a]">
          <div className="flex items-center justify-between font-mono text-xs text-[#7c7f86] uppercase tracking-wider">
            <span>LEGENDARY CRASHES 💀 • {legendaryMarkets.length}</span>
            <span className="text-[#525866] text-[10px]">...HISTORICAL COLLAPSES</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {legendaryMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                onSelect={onSelectMarket}
              />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
