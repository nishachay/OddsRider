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
  const probPct = Math.round(market.currentProb * 100);

  const diffBadge =
    market.difficulty === 'EASY'
      ? 'text-[#00df81] bg-[#00df81]/10 border-[#00df81]/30'
      : market.difficulty === 'MEDIUM'
      ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
      : market.difficulty === 'HARD'
      ? 'text-[#f97316] bg-[#f97316]/10 border-[#f97316]/30'
      : 'text-[#ff4455] bg-[#ff4455]/10 border-[#ff4455]/30';

  return (
    <div
      onClick={() => onSelect(market)}
      className="border border-[#1b202a] bg-[#111317] rounded-2xl p-5 hover:border-[#2e3748] transition-all cursor-pointer flex flex-col justify-between select-none group"
    >
      {/* ── Top Row: Category Icon & Difficulty ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{market.iconEmoji}</span>
          <span className="font-mono text-[9px] font-bold text-[#7c7f86] uppercase border border-[#1f242d] px-1.5 py-0.5 rounded">
            {market.category}
          </span>
        </div>

        <span className={`font-mono text-[10px] font-bold uppercase border px-2 py-0.5 rounded ${diffBadge}`}>
          {market.difficulty}
        </span>
      </div>

      {/* ── Full Question Title (Polymarket Contract) ── */}
      <h3 className="font-display font-bold text-[15px] leading-snug text-white group-hover:text-[#00df81] transition-colors pt-3 flex-1">
        {market.question}
      </h3>

      {/* ── Probability Elevation Sparkline ── */}
      <MiniChart pts={market.sparkline} deltaUp={deltaUp} />

      {/* ── Bottom Row: Odds Chance % + 24H Delta + Volume ── */}
      <div className="flex items-center justify-between pt-2 border-t border-[#161a22] font-mono text-xs">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-white">
            {probPct}%
          </span>
          <span className="text-[10px] font-sans font-bold text-[#7c7f86] uppercase">
            CHANCE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`font-bold ${deltaUp ? 'text-[#00df81]' : 'text-[#ff4455]'}`}>
            {deltaUp ? '+' : ''}{(market.probDelta * 100).toFixed(1)}% 24H
          </span>
          <span className="text-[#525866] text-[11px]">
            {market.volumeFormatted}
          </span>
        </div>
      </div>
    </div>
  );
}
