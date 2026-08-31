import { useEffect, useRef, useState } from 'react';
import type { RideableMarket } from '../data/polymarket';

interface TrackPreviewProps {
  market: RideableMarket;
  onLaunchRide: (market: RideableMarket, inverted?: boolean) => void;
  onBack: () => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

export default function TrackPreview({ market, onLaunchRide, onBack }: TrackPreviewProps) {
  const [timeframe, setTimeframe] = useState<string>('LIVE');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const deltaUp = market.probDelta >= 0;
  const probPct = Math.round(market.currentProb * 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. Draw Polymarket Probability Grid Guides
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
    const basePts = market.sparkline;
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

  }, [market, deltaUp, timeframe]);

  // Spacebar to start
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        onLaunchRide(market, false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [market, onLaunchRide]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 select-none font-sans text-ink">
      
      {/* ── 1. Breadcrumb ── */}
      <nav className="flex items-center gap-2 font-mono text-xs text-dim mb-6">
        <button onClick={onBack} className="hover:text-toxic cursor-pointer">
          Markets
        </button>
        <span>/</span>
        <span className="uppercase">{market.category}</span>
        <span>/</span>
        <span className="text-ink truncate max-w-md">{market.question}</span>
      </nav>

      {/* ── 2. Header: Polymarket Question + Live Chance + Delta ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#232529]">
        <div className="flex flex-col gap-1">
          <h1 className="font-display font-bold text-2xl text-ink leading-snug">
            {market.question}
          </h1>
          <div className="flex items-center gap-3 text-xs font-mono text-dim">
            <span>RESOLVES: {market.resolutionDate}</span>
            <span>•</span>
            <span>VOLUME: {market.volumeFormatted}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono">
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-ink tabular-nums">
                {probPct}%
              </span>
              <span className="font-sans text-xs font-bold text-toxic">
                YES
              </span>
            </div>
            <span className={`text-xs font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
              {deltaUp ? '↑ +' : '↓ '}{(market.probDelta * 100).toFixed(1)}% 24H
            </span>
          </div>

          <span className="text-xs text-dim border border-[#232529] px-2.5 py-1 uppercase">
            {market.difficulty}
          </span>
        </div>
      </div>

      {/* ── 3. High-Res Track Card (Radius-0) ── */}
      <div className="relative border border-[#232529] bg-[#101113] p-6 shadow-2xl mt-6">
        {/* Tactical Corner Reticles */}
        <span className="absolute -top-1 -left-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -top-1 -right-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[9px] text-[#3b414f] font-mono leading-none">+</span>

        {/* Timeframe Selectors */}
        <div className="flex items-center justify-between pb-4 border-b border-[#232529]">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {['LIVE', '24H', '7D', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 transition-colors cursor-pointer border ${
                  timeframe === tf
                    ? 'border-toxic bg-toxic/15 text-toxic font-bold'
                    : 'border-[#232529] text-dim hover:text-ink'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <span className="text-xs text-dim border border-[#232529] px-3 py-1 font-mono">
            {market.volatilityLabel}
          </span>
        </div>

        {/* Canvas Area */}
        <div className="w-full h-64 my-4 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={768}
            height={256}
            className="w-full h-full object-contain"
          />
        </div>

        {/* ── 4. Stats Breakdown Bar ── */}
        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-[#232529] text-center font-mono">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-ink tabular-nums">120</span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">PROBABILITY NODES</span>
          </div>

          <div className="flex flex-col border-l border-[#232529]">
            <span className="text-lg font-bold text-toxic uppercase">{market.difficulty}</span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">TRACK VOLATILITY</span>
          </div>

          <div className="flex flex-col border-l border-[#232529]">
            <span className="text-lg font-bold text-ink tabular-nums">32°</span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">MAX SLOPE ANGLE</span>
          </div>

          <div className="flex flex-col border-l border-[#232529]">
            <span className="text-lg font-bold text-ink tabular-nums">24,000 PX</span>
            <span className="text-[9.5px] text-dim uppercase font-sans font-bold tracking-wider mt-0.5">RACE DISTANCE</span>
          </div>
        </div>

      </div>

      {/* ── 5. Dual Action Buttons: RIDE YES vs RIDE NO ── */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onLaunchRide(market, false)}
            className="py-4 bg-toxic text-bg font-mono font-bold text-xs tracking-[0.18em] uppercase hover:bg-toxic/90 transition-all cursor-pointer text-center shadow-[0_0_20px_rgba(182,255,0,0.35)]"
          >
            [ RIDE LIVE ODDS (YES ∧) ]
          </button>

          <button
            onClick={() => onLaunchRide(market, true)}
            className="py-4 border border-crimson/60 bg-crimson/15 text-crimson font-mono font-bold text-xs tracking-[0.18em] uppercase hover:bg-crimson hover:text-bg transition-all cursor-pointer text-center"
          >
            [ RIDE INVERSE CRASH (NO ∨) ]
          </button>
        </div>

        <button
          onClick={onBack}
          className="w-full py-2 font-mono text-xs text-dim hover:text-ink transition-colors cursor-pointer text-center"
        >
          [ ← RETURN TO PREDICTION FEED ]
        </button>
      </div>

    </div>
  );
}
