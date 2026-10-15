import { useEffect, useState } from 'react';
import type { RideableMarket } from '../data/polymarket';
import { getMarketBest } from '../data/playerStorage';

interface DailyChallengeProps {
  market: RideableMarket;
  dateStr: string;
  onRide: (market: RideableMarket) => void;
}

function useNextDropCountdown(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const ms = Math.max(0, next - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function DailyChallenge({ market, dateStr, onRide }: DailyChallengeProps) {
  const best = getMarketBest(market.id);
  const countdown = useNextDropCountdown();

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-12 select-none">
      <div className="border border-[#3a2f12] bg-[#12100a] border-l-4 border-l-amber-400 px-5 sm:px-8 py-6 flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-amber-400 uppercase">
            Feature race · {dateStr}
          </span>
          <button
            onClick={() => onRide(market)}
            className="font-display font-bold text-xl sm:text-2xl text-ink leading-snug hover:text-amber-300 transition-colors cursor-pointer text-left"
          >
            {market.question}
          </button>
          <span className="font-mono text-[11px] text-dim tabular-nums">
            {best.plays > 0 ? (
              <>
                BEST {best.best.toLocaleString()} · {best.plays} RIDER{best.plays === 1 ? '' : 'S'} TODAY
              </>
            ) : (
              <>NO RIDERS YET TODAY — SET THE LINE</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col">
            <span className="font-poster text-4xl sm:text-5xl text-amber-400 tabular-nums leading-none">
              {countdown}
            </span>
            <span className="font-mono text-[9px] font-bold tracking-[0.24em] text-dim uppercase pt-1">
              Until next race
            </span>
          </div>
          <button
            onClick={() => onRide(market)}
            className="px-6 py-4 bg-amber-400 text-bg font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-amber-300 active:scale-[0.98] transition-all cursor-pointer"
          >
            Enter →
          </button>
        </div>
      </div>
    </section>
  );
}
