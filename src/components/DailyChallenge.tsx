import type { RideableMarket } from '../data/polymarket';

interface DailyChallengeProps {
  market: RideableMarket;
  onRide: (market: RideableMarket) => void;
}

export default function DailyChallenge({ market, onRide }: DailyChallengeProps) {
  const probPct = Math.round(market.currentProb * 100);

  return (
    <div className="w-full max-w-2xl mx-auto px-4 my-6 select-none font-sans">
      <div className="border border-[#382b14] bg-[#14110b] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Left: Info */}
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#f59e0b]">⚡</span>
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#f59e0b] uppercase">
              DAILY CHALLENGE TRACK
            </span>
            <span className="font-mono text-[9px] text-[#8c8270] uppercase border border-[#2d2416] px-1.5 py-0.5 rounded">
              {market.category}
            </span>
          </div>

          <h2 className="font-display font-bold text-lg text-white leading-snug">
            {market.question}
          </h2>

          <div className="flex items-center gap-3 text-xs text-[#8c8270] font-mono">
            <span>ODDS: <strong className="text-[#f59e0b] font-bold">{probPct}% CHANCE</strong></span>
            <span>•</span>
            <span>VOL: <strong className="text-white">{market.volumeFormatted}</strong></span>
            <span>•</span>
            <span className="text-[#00df81] uppercase font-bold">{market.difficulty}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onRide(market)}
            className="px-5 py-2.5 font-mono text-xs font-bold text-[#0a0a0b] bg-[#f59e0b] rounded-xl hover:bg-[#fbbf24] transition-colors cursor-pointer shadow-[0_0_16px_rgba(245,158,11,0.3)]"
          >
            Ride today's odds
          </button>
        </div>

      </div>
    </div>
  );
}
