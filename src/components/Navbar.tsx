import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerStats, type PlayerStats } from '../data/playerStorage';

export default function Navbar({ onGoHome }: { onGoHome: () => void }) {
  const [stats, setStats] = useState<PlayerStats>(() => getPlayerStats());

  useEffect(() => {
    setStats(getPlayerStats());
  }, []);

  return (
    <header className="w-full bg-[#0a0a0b] border-b border-[#232529] select-none sticky top-0 z-50">
      <div className="w-full max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <button
          onClick={onGoHome}
          className="flex items-baseline tracking-[0.24em] uppercase font-display font-black text-sm cursor-pointer"
        >
          <span className="text-ink">Odds</span>
          <span className="text-toxic">Rider</span>
        </button>

        <nav className="flex items-center gap-4 font-mono text-[10px] font-bold tracking-widest uppercase">
          <Link to="/about" className="text-dim hover:text-ink transition-colors">
            About
          </Link>
          <span className="text-dim tabular-nums">
            Rides <span className="text-ink">{stats.ridesCompleted}</span>
          </span>
          <span className="text-dim tabular-nums">
            Best <span className="text-toxic">{stats.highScore.toLocaleString()}</span>
          </span>
        </nav>
      </div>
    </header>
  );
}
