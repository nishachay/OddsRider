import type { RideableMarket } from '../data/polymarket';

interface DailyChallengeProps {
  market: RideableMarket;
  onRide: (market: RideableMarket) => void;
}

export default function DailyChallenge({ market, onRide }: DailyChallengeProps) {
  const probPct = Math.round(market.currentProb * 100);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 my-6 select-none font-sans">
      <div className="relative border border-[#2d2516] bg-[#12100a] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tactical Corner Reticles */}
        <span className="absolute -top-1 -left-1 text-[9px] text-[#5e4b25] font-mono leading-none">+</span>
        <span className="absolute -top-1 -right-1 text-[9px] text-[#5e4b25] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[9px] text-[#5e4b25] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[9px] text-[#5e4b25] font-mono leading-none">+</span>

        {/* Left: Info */}
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-extrabold tracking-[0.22em] text-amber-400 uppercase px-2 py-0.5 border border-amber-400/30 bg-amber-400/10">
              DAILY CHALLENGE TRACK
            </span>
            <span className="font-mono text-[9px] font-bold text-dim uppercase border border-[#232529] px-2 py-0.5">
              {market.category}
            </span>
          </div>

          <h2 className="font-display font-semibold text-lg text-ink leading-snug">
            {market.question}
          </h2>

          <div className="flex items-center gap-4 text-xs text-dim font-mono">
            <span>ODDS: <strong className="text-amber-400 font-bold tabular-nums">{probPct}% YES</strong></span>
            <span>•</span>
            <span>VOL: <strong className="text-ink tabular-nums">{market.volumeFormatted}</strong></span>
            <span>•</span>
            <span className="text-toxic uppercase font-bold">{market.difficulty}</span>
          </div>
        </div>

        {/* Right: Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onRide(market)}
            className="px-6 py-3 font-mono text-xs font-bold tracking-[0.16em] uppercase border border-amber-400 bg-amber-400/15 text-amber-300 hover:bg-amber-400 hover:text-bg transition-all cursor-pointer"
          >
            [ RIDE TODAY'S ODDS ]
          </button>
        </div>

      </div>
    </div>
  );
}
