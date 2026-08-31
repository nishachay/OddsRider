import { useEffect, useState } from 'react';
import { getPlayerStats, type PlayerStats } from '../data/playerStorage';

interface NavbarProps {
  onGoHome: () => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function Navbar({
  onGoHome,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}: NavbarProps) {
  const [stats, setStats] = useState<PlayerStats>(getPlayerStats());

  useEffect(() => {
    setStats(getPlayerStats());
    const interval = setInterval(() => setStats(getPlayerStats()), 3000);
    return () => clearInterval(interval);
  }, []);

  // Focus search with '/' hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('polymarket-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="w-full bg-[#0a0a0b] border-b border-[#232529] select-none sticky top-0 z-50">
      
      {/* ── Main Top Bar (Polymarket Navigation) ── */}
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo Lockup */}
        <button
          onClick={onGoHome}
          className="flex items-baseline tracking-[0.24em] uppercase font-display font-black text-xl hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        >
          <span className="text-ink">ODDS</span>
          <span className="text-toxic">RIDER</span>
        </button>

        {/* Polymarket Search Bar with '/' Hotkey */}
        <div className="flex-1 max-w-lg relative hidden sm:block">
          <input
            id="polymarket-search"
            type="text"
            placeholder="Search Polymarket contracts, topics, politicians..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#101113] border border-[#232529] px-3.5 py-2 font-mono text-xs text-ink placeholder-dim/60 focus:border-toxic/60 focus:outline-none transition-all pr-8"
          />
          <span className="absolute right-2.5 top-2.5 font-mono text-[9px] text-dim border border-[#232529] px-1 py-0.5 pointer-events-none select-none">
            /
          </span>
        </div>

        {/* Right Actions & Player Telemetry */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 border border-[#232529] bg-[#101113] font-mono text-xs">
            <div className="flex items-baseline gap-1">
              <span className="text-[8.5px] font-sans font-extrabold text-dim">RIDES:</span>
              <span className="font-bold text-ink tabular-nums">{stats.ridesCompleted}</span>
            </div>
            <div className="w-[1px] h-3 bg-[#232529]" />
            <div className="flex items-baseline gap-1">
              <span className="text-[8.5px] font-sans font-extrabold text-dim">HIGH:</span>
              <span className="font-bold text-toxic tabular-nums">{stats.highScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Sub-Category Navigation Strip (Polymarket Horizontal Filter Bar) ── */}
      <div className="max-w-6xl mx-auto px-4 overflow-x-auto border-t border-[#1a1c22]">
        <nav className="flex items-center gap-1 py-2 font-mono text-[11px] font-bold">
          {[
            { id: 'ALL', label: '🔥 ALL MARKETS' },
            { id: 'POLITICS', label: '🏛️ POLITICS' },
            { id: 'CRYPTO', label: '🪙 CRYPTO' },
            { id: 'MACRO', label: '📈 MACRO / FED' },
            { id: 'TECH', label: '🤖 TECH / AI' },
            { id: 'LEGENDARY', label: '💀 LEGENDARY CRASHES' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectCategory(tab.id)}
              className={`px-3 py-1.5 uppercase transition-all whitespace-nowrap cursor-pointer border ${
                activeCategory === tab.id
                  ? 'border-toxic bg-toxic/10 text-toxic'
                  : 'border-transparent text-dim hover:text-ink hover:border-[#232529]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

    </header>
  );
}
