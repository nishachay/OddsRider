import { useEffect, useState, useRef } from 'react';
import type { RideableMarket } from '../data/polymarket';

interface TrackPreviewProps {
  market: RideableMarket;
  onLaunchRide: (market: RideableMarket, inverted: boolean, timeframe: string) => void;
  onBack: () => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

export default function TrackPreview({ market, onLaunchRide, onBack }: TrackPreviewProps) {
  const [timeframe, setTimeframe] = useState<string>('ALL');
  const [inverted, setInverted] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const probPct = Math.round(market.currentProb * 100);
  const deltaUp = market.probDelta >= 0;

  // Render high-res track inspection chart with percentage grid and START/FINISH markers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. Draw Grid Lines (0%, 25%, 50%, 75%, 100%)
    ctx.strokeStyle = '#1a1e26';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 10px Geist Mono, monospace';

    const levels = [
      { p: 1.0, label: '100%' },
      { p: 0.75, label: '75%' },
      { p: 0.50, label: '50%' },
      { p: 0.25, label: '25%' },
      { p: 0.0, label: '0%' },
    ];

    for (const lvl of levels) {
      const y = 30 + (1 - lvl.p) * (H - 60);
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(W - 50, y);
      ctx.stroke();
      ctx.fillText(lvl.label, W - 42, y + 3);
    }

    // 2. Generate Track Points from sparkline / series
    const basePts = market.sparkline;
    const ptsCount = basePts.length;
    const plotPts: Array<[number, number]> = [];

    for (let i = 0; i < ptsCount; i++) {
      const x = 40 + (i / (ptsCount - 1)) * (W - 100);
      let rawProb = basePts[i];
      if (inverted) rawProb = 1 - rawProb;
      const y = 30 + (1 - rawProb) * (H - 60);
      plotPts.push([x, y]);
    }

    // 3. Draw Gradient Terrain Fill Under Track
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const strokeColor = inverted ? CRIMSON : TOXIC;
    grad.addColorStop(0, inverted ? 'rgba(255, 51, 85, 0.25)' : 'rgba(182, 255, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.beginPath();
    ctx.moveTo(plotPts[0][0], H - 30);
    for (const [x, y] of plotPts) ctx.lineTo(x, y);
    ctx.lineTo(plotPts[plotPts.length - 1][0], H - 30);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 4. Draw Main Glowing Probability Track Line
    ctx.beginPath();
    for (let i = 0; i < plotPts.length; i++) {
      const [x, y] = plotPts[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 5. Draw Start Marker & Finish Flag
    const [sx, sy] = plotPts[0];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 2, sy - 18, 4, 18);
    ctx.fillStyle = TOXIC;
    ctx.fillRect(sx + 2, sy - 18, 12, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Geist Mono, monospace';
    ctx.fillText('START', sx - 12, sy - 24);

    const [fx, fy] = plotPts[plotPts.length - 1];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx - 2, fy - 22, 4, 22);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(fx - 14, fy - 22, 12, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏁 FINISH', fx - 22, fy - 28);

  }, [market, inverted, timeframe]);

  // Spacebar to start race shortcut
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        onLaunchRide(market, inverted, timeframe);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [market, inverted, timeframe, onLaunchRide]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 select-none font-sans text-ink">
      
      {/* ── 1. Breadcrumb ── */}
      <nav className="flex items-center gap-2 font-mono text-[11px] text-dim mb-4">
        <button onClick={onBack} className="hover:text-toxic cursor-pointer">
          Home
        </button>
        <span>/</span>
        <span className="uppercase">{market.category}</span>
        <span>/</span>
        <span className="text-ink truncate max-w-md">{market.question}</span>
      </nav>

      {/* ── 2. Market Header (Polymarket Single Market Page layout) ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-[#1f242d]">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 border border-[#1f242d] bg-[#14161c] flex items-center justify-center text-2xl shrink-0">
            {market.iconEmoji}
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="font-display font-black text-2xl sm:text-3xl text-ink leading-snug">
              {market.question}
            </h1>

            <div className="flex items-center gap-4 font-mono text-xs text-dim">
              <span>{market.volumeFormatted}</span>
              <span>•</span>
              <span>RESOLVES: {market.resolutionDate}</span>
              <span>•</span>
              <span className="text-toxic font-bold uppercase">{market.difficulty} DIFFICULTY</span>
            </div>
          </div>
        </div>

        {/* Big Hero Probability & Delta */}
        <div className="flex flex-col items-start md:items-end font-mono">
          <span className="font-sans text-[8px] font-extrabold tracking-widest text-dim uppercase">
            CURRENT CHANCE
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-toxic tabular-nums">
              {probPct}%
            </span>
            <span className="font-sans text-xs font-bold text-ink">
              YES
            </span>
          </div>
          <span className={`text-xs font-bold ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
            {deltaUp ? '↑ +' : '↓ '}{(market.probDelta * 100).toFixed(1)}% 24H
          </span>
        </div>
      </div>

      {/* ── 3. High-Res Track Elevation Canvas (StonkRider & Polymarket Chart) ── */}
      <div className="relative border border-[#1f242d] bg-[#0c0e12] mt-6 p-4 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
        
        {/* Timeframe Filter Switcher */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-2 border-b border-[#181a22]">
          <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
            {['1D', '1W', '1M', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 uppercase border transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'border-ink bg-ink text-bg'
                    : 'border-[#1f242d] bg-[#12141a] text-dim hover:text-ink'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Invert Slope Direction (RIDE NO) Toggle */}
          <button
            onClick={() => setInverted(!inverted)}
            className={`px-3 py-1 font-mono text-[10px] font-bold uppercase border transition-all cursor-pointer ${
              inverted
                ? 'border-crimson bg-crimson/15 text-crimson'
                : 'border-[#1f242d] bg-[#12141a] text-dim hover:text-ink'
            }`}
          >
            {inverted ? '🔻 INVERTED (RIDING NO)' : '⚡ STANDARD (RIDING YES)'}
          </button>
        </div>

        {/* Canvas Chart Area */}
        <div className="w-full h-64 sm:h-72">
          <canvas
            ref={canvasRef}
            width={896}
            height={288}
            className="w-full h-full object-cover"
          />
        </div>

        {/* ── 4. Track Physics Breakdown Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-2 border-t border-[#181a22] font-mono text-center">
          <div className="flex flex-col">
            <span className="text-base font-black text-ink">120</span>
            <span className="font-sans text-[8px] font-extrabold text-dim tracking-widest uppercase">
              TERRAIN NODES
            </span>
          </div>

          <div className="flex flex-col border-l border-[#181a22]">
            <span className="text-base font-black text-toxic uppercase">{market.volatilityLabel}</span>
            <span className="font-sans text-[8px] font-extrabold text-dim tracking-widest uppercase">
              TOPOGRAPHY
            </span>
          </div>

          <div className="flex flex-col border-l border-[#181a22]">
            <span className="text-base font-black text-ink">34° INCLINE</span>
            <span className="font-sans text-[8px] font-extrabold text-dim tracking-widest uppercase">
              MAX SLOPE
            </span>
          </div>

          <div className="flex flex-col border-l border-[#181a22]">
            <span className="text-base font-black text-ink">24,000 PX</span>
            <span className="font-sans text-[8px] font-extrabold text-dim tracking-widest uppercase">
              COURSE LENGTH
            </span>
          </div>
        </div>

      </div>

      {/* ── 5. Big Full-Width Launch Action Button ── */}
      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={() => onLaunchRide(market, inverted, timeframe)}
          className="w-full py-4 font-mono text-sm font-black tracking-[0.22em] uppercase border border-toxic bg-toxic text-bg hover:bg-[#c6ff1a] hover:shadow-[0_0_30px_rgba(182,255,0,0.7)] transition-all cursor-pointer text-center"
        >
          [ RIDE THIS CHART (PRESS SPACE) 🏍️ ]
        </button>

        <button
          onClick={onBack}
          className="w-full py-2 font-mono text-[10px] font-bold tracking-widest uppercase text-dim hover:text-ink transition-colors cursor-pointer text-center"
        >
          [ ← RETURN TO MARKET FEED ]
        </button>
      </div>

    </div>
  );
}
