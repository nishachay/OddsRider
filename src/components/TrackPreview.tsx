import { useEffect, useRef, useState } from 'react';
import type { RideableMarket } from '../data/polymarket';

interface TrackPreviewProps {
  market: RideableMarket;
  onLaunchRide: (market: RideableMarket) => void;
  onBack: () => void;
}

const GREEN = '#00df81';
const RED = '#ff4455';

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

    // 1. Draw Polymarket Probability Grid Guides (100%, 75%, 50%, 25%, 0%)
    ctx.strokeStyle = '#1a1f29';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px Geist Mono, monospace';

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
    ctx.strokeStyle = deltaUp ? GREEN : RED;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 4. Start marker
    const [sx, sy] = plotPts[0];
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 9px Geist Mono, monospace';
    ctx.fillText('START (W)', sx - 12, sy - 16);

    // 5. Finish flag
    const [fx, fy] = plotPts[plotPts.length - 1];
    ctx.font = '16px sans-serif';
    ctx.fillText('🏁', fx - 8, fy - 10);

  }, [market, deltaUp, timeframe]);

  // Spacebar to start
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault();
        onLaunchRide(market);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [market, onLaunchRide]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 select-none font-sans">
      
      {/* ── 1. Breadcrumb ── */}
      <nav className="flex items-center gap-2 font-mono text-xs text-[#7c7f86] mb-6">
        <button onClick={onBack} className="hover:text-white cursor-pointer">
          Markets
        </button>
        <span>/</span>
        <span className="uppercase">{market.category}</span>
        <span>/</span>
        <span className="text-white truncate max-w-md">{market.question}</span>
      </nav>

      {/* ── 2. Header: Polymarket Question + Live Chance + Delta ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{market.iconEmoji}</span>
          <div className="flex flex-col gap-1">
            <h1 className="font-display font-bold text-2xl text-white leading-snug">
              {market.question}
            </h1>
            <div className="flex items-center gap-3 text-xs font-mono text-[#7c7f86]">
              <span>RESOLVES: {market.resolutionDate}</span>
              <span>•</span>
              <span>VOLUME: {market.volumeFormatted}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">
                {probPct}%
              </span>
              <span className="font-sans text-xs font-bold text-[#00df81]">
                YES
              </span>
            </div>
            <span className={`text-xs font-bold ${deltaUp ? 'text-[#00df81]' : 'text-[#ff4455]'}`}>
              {deltaUp ? '↑ +' : '↓ '}{(market.probDelta * 100).toFixed(1)}% 24H
            </span>
          </div>

          <span className="text-xs text-[#7c7f86] border border-[#1b202a] rounded-lg px-2.5 py-1 uppercase">
            {market.difficulty}
          </span>
        </div>
      </div>

      {/* ── 3. High-Res Track Card (Polymarket Probability Topography) ── */}
      <div className="border border-[#1b202a] bg-[#111317] rounded-2xl p-6 shadow-2xl">
        
        {/* Timeframe Selectors */}
        <div className="flex items-center justify-between pb-4 border-b border-[#181d26]">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {['LIVE', '24H', '7D', 'ALL'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-[#00df81]/20 text-[#00df81] font-bold'
                    : 'text-[#7c7f86] hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <span className="text-xs text-[#7c7f86] border border-[#1b202a] px-3 py-1 rounded-lg font-mono">
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
        <div className="grid grid-cols-4 gap-4 pt-6 border-t border-[#181d26] text-center font-mono">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white">120</span>
            <span className="text-[10px] text-[#7c7f86] uppercase font-sans mt-0.5">PROBABILITY NODES</span>
          </div>

          <div className="flex flex-col">
            <span className="text-lg font-bold text-[#00df81] uppercase">{market.difficulty}</span>
            <span className="text-[10px] text-[#7c7f86] uppercase font-sans mt-0.5">TRACK VOLATILITY</span>
          </div>

          <div className="flex flex-col">
            <span className="text-lg font-bold text-white">32°</span>
            <span className="text-[10px] text-[#7c7f86] uppercase font-sans mt-0.5">MAX SLOPE ANGLE</span>
          </div>

          <div className="flex flex-col">
            <span className="text-lg font-bold text-white">24,000 PX</span>
            <span className="text-[10px] text-[#7c7f86] uppercase font-sans mt-0.5">RACE DISTANCE</span>
          </div>
        </div>

      </div>

      {/* ── 5. Big Action Button ── */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={() => onLaunchRide(market)}
          className="w-full py-4 bg-[#00df81] text-[#0a0a0b] font-display font-bold text-base rounded-2xl hover:bg-[#00f58d] transition-all shadow-[0_0_24px_rgba(0,223,129,0.35)] cursor-pointer text-center"
        >
          Ride these odds (Press Space) 🏍️
        </button>

        <button
          onClick={onBack}
          className="w-full py-2 font-mono text-xs text-[#7c7f86] hover:text-white transition-colors cursor-pointer text-center"
        >
          ← Return to prediction feed
        </button>
      </div>

    </div>
  );
}
