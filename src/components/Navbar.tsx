import { useEffect, useState } from 'react';
import { getPlayerStats, type PlayerStats } from '../data/playerStorage';

interface NavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onGoHome: () => void;
}

export default function Navbar({
  activeTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  onGoHome,
}: NavbarProps) {
  const [stats, setStats] = useState<PlayerStats>(getPlayerStats());

  useEffect(() => {
    setStats(getPlayerStats());
    const interval = setInterval(() => setStats(getPlayerStats()), 3000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('global-market-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="w-full bg-[#0e1014] border-b border-[#1f242d] sticky top-0 z-50 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* ── Left: Brand Identity ── */}
        <div className="flex items-center gap-6">
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 cursor-pointer group focus:outline-none"
          >
            <div className="w-2.5 h-2.5 bg-toxic animate-pulse shadow-[0_0_10px_#b6ff00]" />
            <div className="flex items-baseline tracking-[0.22em] uppercase font-display font-black text-xl">
              <span className="text-ink">ODDS</span>
              <span className="text-toxic">RIDER</span>
            </div>
          </button>

          {/* Category Navigation Links (Polymarket style) */}
          <nav className="hidden md:flex items-center gap-1 font-mono text-[11px] font-bold tracking-wider">
            {[
              { id: 'ALL', label: 'MARKETS' },
              { id: 'CRYPTO', label: 'CRYPTO' },
              { id: 'POLITICS', label: 'POLITICS' },
              { id: 'MACRO', label: 'MACRO/FED' },
              { id: 'LEGENDARY', label: '💀 LEGENDARY' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'text-toxic border-b-2 border-toxic'
                    : 'text-dim hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Center: Polymarket-Style Search Bar with '/' Hotkey ── */}
        <div className="flex-1 max-w-md relative hidden sm:block">
          <div className="relative flex items-center">
            <span className="absolute left-3 text-dim text-xs select-none">🔍</span>
            <input
              id="global-market-search"
              type="text"
              placeholder="Search markets, tickers, politicians..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#14161c] border border-[#1f242d] pl-9 pr-8 py-1.5 font-mono text-xs text-ink placeholder:text-dim/60 focus:border-toxic/60 focus:outline-none transition-all"
            />
            <span className="absolute right-2.5 font-mono text-[9px] font-bold text-dim/70 px-1 py-0.5 border border-[#232529] bg-[#0a0a0b] pointer-events-none select-none">
              /
            </span>
          </div>
        </div>

        {/* ── Right: Persistent Player Telemetry Chip ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 border border-[#1f242d] bg-[#14161c] font-mono">
            <div className="flex items-baseline gap-1">
              <span className="text-[8px] font-sans font-extrabold text-dim tracking-wider">RIDES:</span>
              <span className="text-xs font-bold text-ink tabular-nums">{stats.ridesCompleted}</span>
            </div>
            <div className="w-[1px] h-3 bg-[#1f242d]" />
            <div className="flex items-baseline gap-1">
              <span className="text-[8px] font-sans font-extrabold text-dim tracking-wider">BEST:</span>
              <span className="text-xs font-bold text-toxic tabular-nums">{stats.highScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}
