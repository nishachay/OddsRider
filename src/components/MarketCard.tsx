import type { RideableMarket } from '../data/polymarket';

interface MarketCardProps {
  market: RideableMarket;
  onSelect: (market: RideableMarket) => void;
}

const GREEN = '#00df81';
const RED = '#ff4455';

function MiniChart({ pts, deltaUp }: { pts: number[]; deltaUp: boolean }) {
  if (!pts || pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.01, max - min);
  const W = 280, H = 54;
  const strokeColor = deltaUp ? GREEN : RED;

  const pointsStr = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((p - min) / range) * (H - 10) - 5;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={W} height={H} className="w-full h-14 overflow-visible my-3">
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

export default function MarketCard({ market, onSelect }: MarketCardProps) {
  const deltaUp = market.probDelta >= 0;
  const ticker = market.slug.toUpperCase().slice(0, 8);

  const diffIcon =
    market.difficulty === 'EASY'
      ? '🟢 EASY'
      : market.difficulty === 'MEDIUM'
      ? '🟠 MEDIUM'
      : market.difficulty === 'HARD'
      ? '🔴 HARD'
      : '💀 INSANE';

  return (
    <div
      onClick={() => onSelect(market)}
      className="border border-[#1b202a] bg-[#111317] rounded-2xl p-5 hover:border-[#2e3748] transition-all cursor-pointer flex flex-col justify-between select-none group"
    >
      {/* ── Top Row: Ticker & Difficulty ── */}
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-lg text-white group-hover:text-[#00df81] transition-colors">
          {ticker}
        </span>
        <span className="font-mono text-[11px] text-[#7c7f86]">
          {diffIcon}
        </span>
      </div>

      {/* ── Middle: Smooth StonkRider Elevation Chart Line ── */}
      <MiniChart pts={market.sparkline} deltaUp={deltaUp} />

      {/* ── Bottom Row: Full Question & Delta ── */}
      <div className="flex items-end justify-between gap-2 pt-1 border-t border-[#161a22]">
        <span className="text-xs text-[#7c7f86] truncate max-w-[200px]" title={market.question}>
          {market.question}
        </span>
        <span className={`font-mono text-xs font-bold tabular-nums ${deltaUp ? 'text-[#00df81]' : 'text-[#ff4455]'}`}>
          {deltaUp ? '+' : ''}{(market.probDelta * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
