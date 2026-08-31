import type { RideableMarket } from '../data/polymarket';

interface MarketCardProps {
  market: RideableMarket;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

function CircularChanceGauge({ prob }: { prob: number }) {
  const size = 52;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - prob * circumference;
  const isUp = prob >= 0.5;
  const color = isUp ? TOXIC : CRIMSON;

  return (
    <div className="relative flex items-center justify-center w-[52px] h-[52px] shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1b1f28"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
        <span className="text-[12px] font-black text-ink leading-none">
          {Math.round(prob * 100)}%
        </span>
        <span className="text-[6.5px] font-bold text-dim uppercase tracking-tighter mt-0.5">
          CHANCE
        </span>
      </div>
    </div>
  );
}

function MiniElevationSparkline({ pts, deltaUp }: { pts: number[]; deltaUp: boolean }) {
  if (!pts || pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.01, max - min);
  const W = 160, H = 32;
  const strokeColor = deltaUp ? TOXIC : CRIMSON;

  const pointsStr = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((p - min) / range) * (H - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={W} height={H} className="w-full h-8 overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pointsStr}
      />
    </svg>
  );
}

export default function MarketCard({ market, onRideYes, onRideNo, onPreview }: MarketCardProps) {
  const deltaUp = market.probDelta >= 0;
  const diffColor =
    market.difficulty === 'EASY'
      ? 'text-toxic border-toxic/40'
      : market.difficulty === 'MEDIUM'
      ? 'text-amber-400 border-amber-400/40'
      : market.difficulty === 'HARD'
      ? 'text-orange-500 border-orange-500/40'
      : 'text-crimson border-crimson/40';

  return (
    <div className="relative flex flex-col justify-between border border-[#1f242d] bg-[#0e1014] p-5 hover:border-[#333a48] transition-all group select-none">
      
      {/* ── Top Bar: Thumbnail + Category + Difficulty ── */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#181a22]">
        <div className="flex items-center gap-2">
          <span className="text-base">{market.iconEmoji}</span>
          <span className="font-mono text-[9px] font-bold tracking-widest text-dim uppercase border border-[#1f242d] px-1.5 py-0.5">
            {market.category}
          </span>
        </div>

        <span className={`font-mono text-[8.5px] font-extrabold tracking-widest uppercase border px-1.5 py-0.5 ${diffColor}`}>
          {market.difficulty}
        </span>
      </div>

      {/* ── Question Title ── */}
      <h3
        onClick={() => onPreview(market)}
        className="font-display font-semibold text-[14.5px] leading-snug text-ink/95 pt-3 flex-1 hover:text-toxic transition-colors cursor-pointer"
      >
        {market.question}
      </h3>

      {/* ── Polymarket Circular Gauge & Terrain Sparkline Row ── */}
      <div className="pt-4 flex items-center justify-between gap-3">
        <CircularChanceGauge prob={market.currentProb} />

        <div className="flex-1 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[8px] font-sans font-extrabold text-dim tracking-wider">24H:</span>
            <span className={`font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
              {deltaUp ? '+' : ''}{(market.probDelta * 100).toFixed(1)}%
            </span>
          </div>

          <div className="w-28 h-7 opacity-80 group-hover:opacity-100 transition-opacity">
            <MiniElevationSparkline pts={market.sparkline} deltaUp={deltaUp} />
          </div>
        </div>
      </div>

      {/* ── Volume & Terrain Description ── */}
      <div className="pt-3 flex items-center justify-between text-[9.5px] font-mono text-dim border-t border-[#181a22] mt-3">
        <span>{market.volumeFormatted}</span>
        <span className="text-dim/80 uppercase tracking-tight">{market.volatilityLabel}</span>
      </div>

      {/* ── Polymarket Dual Action Buttons: [ RIDE YES ∧ ] vs [ RIDE NO ∨ ] ── */}
      <div className="pt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onRideYes(market)}
          className="py-2.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase border border-toxic/50 bg-toxic/10 text-toxic hover:bg-toxic hover:text-bg hover:shadow-[0_0_16px_rgba(182,255,0,0.4)] transition-all cursor-pointer text-center"
        >
          RIDE YES ∧
        </button>

        <button
          onClick={() => onRideNo(market)}
          className="py-2.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase border border-crimson/50 bg-crimson/10 text-crimson hover:bg-crimson hover:text-bg hover:shadow-[0_0_16px_rgba(255,51,85,0.4)] transition-all cursor-pointer text-center"
        >
          RIDE NO ∨
        </button>
      </div>

      {/* Preview Link */}
      <button
        onClick={() => onPreview(market)}
        className="w-full mt-2 py-1 font-mono text-[9px] font-bold tracking-widest text-dim/70 hover:text-ink transition-colors cursor-pointer text-center"
      >
        [ INSPECT TRACK DETAILS ]
      </button>

    </div>
  );
}
