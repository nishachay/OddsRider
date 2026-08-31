import type { RideableMarket } from '../data/polymarket';

interface DailyChallengeProps {
  market: RideableMarket;
  onRide: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

export default function DailyChallenge({ market, onRide, onPreview }: DailyChallengeProps) {
  const probPct = (market.currentProb * 100).toFixed(0);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 my-4 select-none">
      <div className="relative border border-[#2d281a] bg-[#12100a] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        {/* Tactical Corner Marks */}
        <span className="absolute -top-1 -left-1 text-[10px] text-amber-500/60 font-mono leading-none">+</span>
        <span className="absolute -top-1 -right-1 text-[10px] text-amber-500/60 font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[10px] text-amber-500/60 font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[10px] text-amber-500/60 font-mono leading-none">+</span>

        {/* Left: Info */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-black tracking-[0.24em] text-amber-400 uppercase px-2 py-0.5 border border-amber-500/40 bg-amber-500/10">
              ⚡ DAILY CHALLENGE TRACK
            </span>
            <span className="font-mono text-[9px] font-bold text-dim tracking-wider uppercase border border-[#1f242d] px-2 py-0.5">
              {market.category}
            </span>
            <span className="font-mono text-[9px] font-bold text-amber-400 tracking-wider uppercase">
              • {market.difficulty}
            </span>
          </div>

          <h2 className="font-display font-bold text-lg sm:text-xl text-ink leading-snug">
            {market.question}
          </h2>

          <div className="flex items-center gap-4 font-mono text-xs text-dim">
            <span>ODDS: <strong className="text-amber-400 font-black">{probPct}% YES</strong></span>
            <span>VOLUME: <strong className="text-ink">{market.volumeFormatted}</strong></span>
            <span>TERRAIN: <strong className="text-ink">{market.volatilityLabel}</strong></span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPreview(market)}
            className="px-4 py-2.5 font-mono text-[10px] font-bold tracking-[0.16em] uppercase border border-[#232529] bg-[#14161c] text-dim hover:text-ink hover:border-[#333a48] transition-all cursor-pointer"
          >
            [ PREVIEW TRACK ]
          </button>

          <button
            onClick={() => onRide(market)}
            className="px-6 py-2.5 font-mono text-xs font-black tracking-[0.18em] uppercase border border-amber-400 bg-amber-400 text-bg hover:bg-amber-300 hover:shadow-[0_0_20px_rgba(251,191,36,0.6)] transition-all cursor-pointer"
          >
            [ RIDE TODAY'S CHALLENGE ⚡ ]
          </button>
        </div>
      </div>
    </div>
  );
}
