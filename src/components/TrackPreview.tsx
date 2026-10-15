import { useEffect, useRef, useState } from 'react';
import type { RideableMarket } from '../data/tracks';

interface TrackPreviewProps {
  market: RideableMarket;
  onLaunchRide: (market: RideableMarket, inverted?: boolean, timeframe?: string) => void;
  onBack: () => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

export default function TrackPreview({ market, onLaunchRide, onBack }: TrackPreviewProps) {
  const [timeframe, setTimeframe] = useState<string>('ALL');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const deltaUp = (market.probDelta ?? 0) >= 0;
  const probPct = Math.round(market.currentProb * 100);
  const chanceUp = market.currentProb >= 0.5;
  const deltaLabel =
    market.probDelta === null
      ? '—'
      : `${deltaUp ? '+' : ''}${(market.probDelta * 100).toFixed(1)}%`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const basePts = market.sparkline ?? [];
    if (basePts.length < 2) {
      ctx.fillStyle = '#7c7f86';
      ctx.font = 'bold 12px Geist Mono, monospace';
      ctx.fillText('NO PRICE HISTORY AVAILABLE', 40, H / 2);
      return;
    }

    // 1. Draw probability grid guides
    ctx.strokeStyle = '#232529';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#7c7f86';
    ctx.font = 'bold 10px Geist Mono, monospace';

    const levels = [
      { y: 30, label: '100% YES' },
      { y: H / 2, label: '50%' },
      { y: H - 30, label: '0% NO' },
    ];

    for (const lvl of levels) {
      ctx.beginPath();
      ctx.moveTo(30, lvl.y);
      ctx.lineTo(W - 70, lvl.y);
      ctx.stroke();
      ctx.fillText(lvl.label, W - 60, lvl.y + 3);
    }

    // 2. Generate elevation points
    const plotPts: Array<[number, number]> = [];
    for (let i = 0; i < basePts.length; i++) {
      const x = 40 + (i / (basePts.length - 1)) * (W - 130);
      const y = 30 + (1 - basePts[i]) * (H - 70);
      plotPts.push([x, y]);
    }

    // 3. Draw smooth probability curve
    ctx.beginPath();
    for (let i = 0; i < plotPts.length; i++) {
      const [x, y] = plotPts[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = deltaUp ? TOXIC : CRIMSON;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 4. Start marker
    const [sx, sy] = plotPts[0];
    ctx.fillStyle = '#7c7f86';
    ctx.font = 'bold 9px Geist Mono, monospace';
    ctx.fillText('START (W)', sx - 12, sy - 16);

    // 5. Finish flag label
    const [fx, fy] = plotPts[plotPts.length - 1];
    ctx.fillStyle = TOXIC;
    ctx.fillText('FINISH GATE', fx - 25, fy - 16);

  }, [market, market.sparkline, deltaUp, timeframe]);

  // Spacebar to start
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        onLaunchRide(market, false, timeframe);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [market, onLaunchRide, timeframe]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 select-none text-ink">

      {/* ── 1. Breadcrumb ── */}
      <nav className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-dim mb-6 uppercase">
        <button onClick={onBack} className="hover:text-toxic cursor-pointer">
          ← All races
        </button>
        <span className="text-[#3b414f]">/</span>
        <span>{market.category}</span>
      </nav>

      {/* ── 2. Header: question + poster odds ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b-2 border-[#f0f0f2]">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-toxic uppercase">
            {market.kind === 'closed'
              ? market.resolution
                ? `Settled · resolved ${market.resolution}`
                : 'Settled track'
              : `Race card · ${market.difficulty}`}
          </span>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-ink leading-snug">
            {market.question}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-dim uppercase tracking-[0.14em]">
            <span>Resolves {market.resolutionDate}</span>
            <span>·</span>
            <span>{market.volumeFormatted}</span>
            <span>·</span>
            <span>{market.volatilityLabel}</span>
          </div>
        </div>

        <div className="flex items-end gap-2 shrink-0">
          <span className={`font-poster leading-none text-7xl tabular-nums ${chanceUp ? 'text-toxic' : 'text-crimson'}`}>
            {probPct}
            <span className="text-2xl text-dim">%</span>
          </span>
          <span className="flex flex-col pb-1">
            <span className="font-sans text-xs font-extrabold text-ink">YES</span>
            <span className={`font-mono text-[11px] font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
              {deltaLabel} 24H
            </span>
          </span>
        </div>
      </div>

      {/* ── 3. Track chart ── */}
      <div className="border border-[#232529] bg-[#101113] mt-6">
        <div className="flex items-center gap-5 px-6 pt-4 font-mono text-xs">
          {['ALL', '24H', '7D'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`pb-1 border-b-2 transition-colors cursor-pointer ${
                timeframe === tf
                  ? 'border-toxic text-toxic font-bold'
                  : 'border-transparent text-dim hover:text-ink'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="w-full h-64 px-2 py-4 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={768}
            height={256}
            className="w-full h-full object-contain"
          />
        </div>

        {/* ── 4. Stats strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-5 border-t border-[#232529] text-center font-mono">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-ink tabular-nums">
              {market.sparkline ? market.sparkline.length : '—'}
            </span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">Probability nodes</span>
          </div>

          <div className="flex flex-col sm:border-l sm:border-[#232529]">
            <span className="text-lg font-bold text-toxic uppercase">{market.difficulty}</span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">Track volatility</span>
          </div>

          <div className="flex flex-col border-t sm:border-t-0 border-[#232529] pt-4 sm:pt-0 sm:border-l">
            <span className="text-lg font-bold text-crimson tabular-nums">
              −{(market.stats.maxDrop * 100).toFixed(1)}%
            </span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">Max drop, frozen series</span>
          </div>

          <div className="flex flex-col border-t sm:border-t-0 border-[#232529] pt-4 sm:pt-0 sm:border-l">
            <span className="text-lg font-bold text-toxic tabular-nums">
              +{(market.stats.maxRise * 100).toFixed(1)}%
            </span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">Max rise, frozen series</span>
          </div>
        </div>
      </div>

      {/* ── 5. Dual ride actions, full-bleed ── */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 border border-[#232529] divide-y sm:divide-y-0 sm:divide-x divide-[#232529]">
        <button
          onClick={() => onLaunchRide(market, false, timeframe)}
          className="py-4 bg-toxic text-bg font-mono font-bold text-xs tracking-[0.18em] uppercase hover:bg-toxic/90 active:scale-[0.99] transition-all cursor-pointer text-center"
        >
          Ride yes ∧
        </button>

        <button
          onClick={() => onLaunchRide(market, true, timeframe)}
          className="py-4 bg-transparent text-crimson font-mono font-bold text-xs tracking-[0.18em] uppercase hover:bg-crimson hover:text-bg active:scale-[0.99] transition-all cursor-pointer text-center"
        >
          Ride no ∨
        </button>
      </div>

    </div>
  );
}
