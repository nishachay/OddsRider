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
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - prob * circumference;
  const isUp = prob >= 0.5;
  const color = isUp ? TOXIC : CRIMSON;

  return (
    <div className="relative flex items-center justify-center w-12 h-12 shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f242d"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
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
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
        <span className="text-[11.5px] font-black text-ink leading-none tabular-nums">
          {Math.round(prob * 100)}%
        </span>
        <span className="text-[6px] font-bold text-dim uppercase tracking-tighter mt-0.5">
          CHANCE
        </span>
      </div>
    </div>
  );
}

function MiniSparkline({ pts, deltaUp }: { pts: number[]; deltaUp: boolean }) {
  if (!pts || pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.01, max - min);
  const W = 160, H = 34;
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

  const diffBadge =
    market.difficulty === 'EASY'
      ? 'text-toxic bg-toxic/10 border-toxic/30'
      : market.difficulty === 'MEDIUM'
      ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
      : market.difficulty === 'HARD'
      ? 'text-orange-500 bg-orange-500/10 border-orange-500/30'
      : 'text-crimson bg-crimson/10 border-crimson/30';

  return (
    <div className="relative border border-[#232529] bg-[#101113] p-5 flex flex-col justify-between select-none group hover:border-[#3b414f] transition-all">
      {/* Tactical Corner Reticles */}
      <span className="absolute -top-1 -left-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>
      <span className="absolute -top-1 -right-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>
      <span className="absolute -bottom-1 -left-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>
      <span className="absolute -bottom-1 -right-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>

      {/* ── Top Row: Category & Difficulty ── */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1a1c22]">
        <div className="flex items-center gap-2">
          <span className="text-sm">{market.iconEmoji}</span>
          <span className="font-mono text-[9px] font-bold text-dim uppercase border border-[#232529] px-2 py-0.5">
            {market.category}
          </span>
        </div>

        <span className={`font-mono text-[9.5px] font-bold uppercase border px-2 py-0.5 ${diffBadge}`}>
          {market.difficulty}
        </span>
      </div>

      {/* ── Question Title ── */}
      <h3
        onClick={() => onPreview(market)}
        className="font-display font-semibold text-[14.5px] leading-snug text-ink group-hover:text-toxic transition-colors pt-3 flex-1 cursor-pointer"
      >
        {market.question}
      </h3>

      {/* ── Polymarket Circular Chance Gauge & Sparkline ── */}
      <div className="pt-4 flex items-center justify-between gap-3">
        <CircularChanceGauge prob={market.currentProb} />

        <div className="flex-1 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[8px] font-sans font-extrabold text-dim uppercase">24H:</span>
            <span className={`font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
              {deltaUp ? '+' : ''}{(market.probDelta * 100).toFixed(1)}%
            </span>
          </div>

          <div className="w-28 h-7 opacity-80 group-hover:opacity-100 transition-opacity">
            <MiniSparkline pts={market.sparkline} deltaUp={deltaUp} />
          </div>
        </div>
      </div>

      {/* ── Volume & Volatility ── */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#1a1c22] font-mono text-[10px] text-dim">
        <span className="text-ink font-bold tabular-nums">{market.volumeFormatted}</span>
        <span className="uppercase">{market.volatilityLabel}</span>
      </div>

      {/* ── Polymarket Dual Action Buttons: [ RIDE YES ∧ ] vs [ RIDE NO ∨ ] ── */}
      <div className="pt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onRideYes(market)}
          className="py-2.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase border border-toxic/40 bg-toxic/10 text-toxic hover:bg-toxic hover:text-bg transition-all cursor-pointer text-center"
        >
          RIDE YES ∧
        </button>

        <button
          onClick={() => onRideNo(market)}
          className="py-2.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase border border-crimson/40 bg-crimson/10 text-crimson hover:bg-crimson hover:text-bg transition-all cursor-pointer text-center"
        >
          RIDE NO ∨
        </button>
      </div>

      {/* Preview Link */}
      <button
        onClick={() => onPreview(market)}
        className="w-full mt-2 py-1 font-mono text-[9px] font-bold tracking-widest text-dim hover:text-ink transition-colors cursor-pointer text-center"
      >
        [ INSPECT TRACK ]
      </button>

    </div>
  );
}
