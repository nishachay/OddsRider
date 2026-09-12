import type { RideableMarket } from '../data/polymarket';
import { getMarketBest } from '../data/playerStorage';

interface DailyChallengeProps {
  market: RideableMarket;
  dateStr: string;
  onRide: (market: RideableMarket) => void;
}

export default function DailyChallenge({ market, dateStr, onRide }: DailyChallengeProps) {
  const best = getMarketBest(market.id);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-6 select-none font-sans">
      <div className="relative border border-[#3a2f12] bg-[#12100a] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
        <span className="absolute -top-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -top-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[9px] font-extrabold tracking-[0.24em] text-amber-400 uppercase">
            Daily Challenge — {dateStr}
          </span>
          <button
            onClick={() => onRide(market)}
            className="font-display font-bold text-xl sm:text-2xl text-ink leading-snug hover:text-toxic transition-colors cursor-pointer text-left"
          >
            {market.question}
          </button>
          <span className="font-mono text-[11px] text-dim">
            {best.plays > 0 ? (
              <>BEST {best.best.toLocaleString()} · {best.plays} RIDER{best.plays === 1 ? '' : 'S'} TODAY</>
            ) : (
              <>NO RIDERS YET TODAY — SET THE LINE</>
            )}
          </span>
        </div>

        <button
          onClick={() => onRide(market)}
          className="shrink-0 px-6 py-3.5 bg-amber-400 text-bg font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-amber-300 transition-all cursor-pointer"
        >
          [ RIDE TODAY'S CHALLENGE ]
        </button>
      </div>
    </section>
  );
}
