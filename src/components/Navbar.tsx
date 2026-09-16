import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPlayerStats, type PlayerStats } from '../data/playerStorage';

function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} UTC`;
}

export default function Navbar({ onGoHome }: { onGoHome: () => void }) {
  const [stats, setStats] = useState<PlayerStats>(() => getPlayerStats());
  const clock = useUtcClock();

  useEffect(() => {
    setStats(getPlayerStats());
  }, []);

  return (
    <header className="w-full bg-[#0a0a0b] border-b border-[#232529] select-none sticky top-0 z-50">
      <div className="w-full max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <button onClick={onGoHome} className="flex items-center gap-2.5 cursor-pointer group">
          <span className="block w-3 h-3 bg-toxic group-hover:animate-pulse" />
          <span className="font-poster text-xl tracking-wide uppercase leading-none pt-1">
            <span className="text-ink">Odds</span>
            <span className="text-toxic">rider</span>
          </span>
        </button>

        <span className="hidden md:block font-mono text-[11px] text-dim tabular-nums tracking-[0.2em]">
          {clock}
        </span>

        <nav className="flex items-center gap-5 font-mono text-[11px] font-bold tracking-[0.18em] uppercase">
          <Link to="/about" className="text-dim hover:text-ink transition-colors">
            About
          </Link>
          {stats.ridesCompleted > 0 ? (
            <span className="text-dim tabular-nums hidden sm:inline">
              Best <span className="text-toxic">{stats.highScore.toLocaleString()}</span>
            </span>
          ) : (
            <span className="text-dim hidden sm:inline">First ride awaits</span>
          )}
        </nav>
      </div>
    </header>
  );
}
