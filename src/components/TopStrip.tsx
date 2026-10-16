import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function useUtcClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
}

// Minimal arcade chrome: wordmark, section links, live clock. Nothing big.
export default function TopStrip() {
  const clock = useUtcClock();
  const link =
    'font-mono text-[10px] font-bold tracking-[0.22em] text-dim hover:text-toxic transition-colors uppercase cursor-pointer';
  return (
    <header className="w-full border-b border-[#1a1c22] bg-[#0a0a0b]/85 backdrop-blur-[2px]">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between gap-4 select-none">
        <Link to="/" className="font-poster text-lg tracking-wide text-ink hover:text-toxic transition-colors leading-none" aria-label="OddsRider home">
          ODDS<span className="text-toxic">RIDER</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6" aria-label="Sections">
          <Link to="/tracks" className={link}>
            Tracks
          </Link>
          <Link to="/daily" className={link}>
            Daily
          </Link>
          <Link to="/about" className={link}>
            How to play
          </Link>
          <span className="hidden sm:inline font-mono text-[10px] text-dim tabular-nums">{clock}</span>
        </nav>
      </div>
    </header>
  );
}
