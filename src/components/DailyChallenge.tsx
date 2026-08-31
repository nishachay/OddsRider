import type { RideableMarket } from '../data/polymarket';

interface DailyChallengeProps {
  market: RideableMarket;
  onRide: (market: RideableMarket) => void;
}

export default function DailyChallenge({ market, onRide }: DailyChallengeProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 my-6 select-none">
      <div className="border border-[#382b14] bg-[#14110b] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Left: Info */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#f59e0b]">⚡</span>
            <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-[#f59e0b] uppercase">
              DAILY CHALLENGE
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h2 className="font-display font-bold text-xl text-white">
              {market.slug.toUpperCase().slice(0, 10)} • ALL
            </h2>
          </div>

          <p className="text-xs text-[#8c8270] font-mono">
            Best 184,290 — PRO RIDER • 28 riders
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRide(market)}
            className="px-4 py-2 font-mono text-xs text-[#a89d88] border border-[#2d2416] bg-[#1a1610] rounded-xl hover:text-white transition-colors cursor-pointer"
          >
            Leaderboard
          </button>

          <button
            onClick={() => onRide(market)}
            className="px-5 py-2 font-mono text-xs font-bold text-[#0a0a0b] bg-[#f59e0b] rounded-xl hover:bg-[#fbbf24] transition-colors cursor-pointer shadow-[0_0_16px_rgba(245,158,11,0.3)]"
          >
            Ride today's challenge
          </button>
        </div>

      </div>
    </div>
  );
}
