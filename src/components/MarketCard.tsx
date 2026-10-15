import type { RideableMarket } from '../data/tracks';

interface RaceRowProps {
  market: RideableMarket;
  index: number;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

const GOING: Record<string, string> = {
  EASY: 'text-toxic',
  MEDIUM: 'text-ink',
  HARD: 'text-orange-500',
  INSANE: 'text-crimson',
  NEW: 'text-dim',
};

// Clipped track chart. Scales through a viewBox, never overflows.
function FormLine({ pts, deltaUp }: { pts: number[] | null; deltaUp: boolean }) {
  const W = 320;
  const H = 48;
  if (!pts || pts.length < 2) {
    return (
      <div className="w-full h-12 flex items-center font-mono text-[9px] font-bold tracking-[0.2em] text-dim">
        NO FORM
      </div>
    );
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.01, max - min);
  const color = deltaUp ? TOXIC : CRIMSON;
  const line = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - 4 - ((p - min) / range) * (H - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block w-full h-12 overflow-hidden"
    >
      <polygon
        points={`0,${H} ${line} ${W},${H}`}
        fill={deltaUp ? 'rgba(182,255,0,0.07)' : 'rgba(255,51,85,0.07)'}
      />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function MarketCard({ market, index, onRideYes, onRideNo, onPreview }: RaceRowProps) {
  const probPct = Math.round(market.currentProb * 100);
  const chanceUp = market.currentProb >= 0.5;
  const deltaUp = (market.probDelta ?? 0) >= 0;
  const deltaLabel =
    market.probDelta === null
      ? '—'
      : `${deltaUp ? '+' : ''}${(market.probDelta * 100).toFixed(1)}%`;

  return (
    <div
      onClick={() => onPreview(market)}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className="rise group relative flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 px-4 sm:px-5 py-4 border-t border-[#232529] hover:bg-[#101113] transition-colors ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer select-none"
    >
      <span className="absolute left-0 top-0 h-full w-[3px] bg-toxic opacity-0 group-hover:opacity-100 transition-opacity" />

      <span className="hidden lg:block font-poster text-2xl text-[#3b414f] group-hover:text-toxic transition-colors w-10 shrink-0 tabular-nums">
        {index.toString().padStart(2, '0')}
      </span>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <span className="font-display font-bold text-[16px] sm:text-[17px] leading-snug text-ink group-hover:text-toxic transition-colors">
          {market.question}
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
          {market.category} · <span className={GOING[market.difficulty] ?? 'text-dim'}>{market.difficulty}</span>
          {' · '}
          {market.volumeFormatted}
          {market.kind === 'closed' ? (market.resolution ? ` · RESOLVED ${market.resolution}` : ' · CLOSED') : ''}
        </span>
      </div>

      <div className="w-full sm:w-44 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
        <FormLine pts={market.sparkline} deltaUp={deltaUp} />
      </div>

      <div className="flex lg:flex-col items-baseline lg:items-end gap-x-2 shrink-0 lg:w-24">
        <span className={`font-poster text-4xl leading-none tabular-nums ${chanceUp ? 'text-toxic' : 'text-crimson'}`}>
          {probPct}
          <span className="text-lg text-dim">%</span>
        </span>
        <span className={`font-mono text-[11px] font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
          {deltaLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:flex gap-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRideYes(market);
          }}
          className="px-4 py-2.5 lg:py-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase bg-toxic/10 text-toxic border border-toxic/40 hover:bg-toxic hover:text-bg active:scale-[0.98] transition-all cursor-pointer text-center"
        >
          Yes ∧
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRideNo(market);
          }}
          className="px-4 py-2.5 lg:py-2 font-mono text-[10px] font-bold tracking-[0.14em] uppercase bg-crimson/10 text-crimson border border-crimson/40 hover:bg-crimson hover:text-bg active:scale-[0.98] transition-all cursor-pointer text-center"
        >
          No ∨
        </button>
      </div>
    </div>
  );
}
