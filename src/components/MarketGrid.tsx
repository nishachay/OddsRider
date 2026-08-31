import { useMemo, useState } from 'react';
import type { RideableMarket } from '../data/polymarket';
import MarketCard from './MarketCard';

interface MarketGridProps {
  markets: RideableMarket[];
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

export default function MarketGrid({
  markets,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onRideYes,
  onRideNo,
  onPreview,
}: MarketGridProps) {
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');

  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      const matchCat =
        activeCategory === 'ALL' ||
        (activeCategory === 'LEGENDARY' ? m.category === 'LEGENDARY' : m.category === activeCategory);
      const matchDiff = filterDifficulty === 'ALL' || m.difficulty === filterDifficulty;
      const matchQuery =
        !searchQuery ||
        m.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchDiff && matchQuery;
    });
  }, [markets, activeCategory, filterDifficulty, searchQuery]);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 my-6 select-none">
      
      {/* ── Section Header & Filters ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1f242d]">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display font-black text-xl text-ink uppercase tracking-wider">
            {activeCategory === 'LEGENDARY' ? '💀 LEGENDARY MARKET CRASHES' : 'TRENDING RACETRACKS'}
          </h2>
          <span className="font-mono text-xs text-dim">
            ({filteredMarkets.length} AVAILABLE)
          </span>
        </div>

        {/* Difficulty Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-[9.5px] font-bold">
          {['ALL', 'EASY', 'MEDIUM', 'HARD', 'INSANE'].map((diff) => (
            <button
              key={diff}
              onClick={() => setFilterDifficulty(diff)}
              className={`px-2.5 py-1 uppercase border transition-all cursor-pointer ${
                filterDifficulty === diff
                  ? 'border-toxic bg-toxic/15 text-toxic'
                  : 'border-[#1f242d] bg-[#12141a] text-dim hover:text-ink'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3-Column Market Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredMarkets.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center border border-[#1f242d] bg-[#0e1014]">
            <span className="font-mono text-xs text-dim uppercase tracking-widest">
              NO MATCHING PREDICTION MARKETS FOUND
            </span>
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              onRideYes={onRideYes}
              onRideNo={onRideNo}
              onPreview={onPreview}
            />
          ))
        )}
      </div>

    </section>
  );
}
