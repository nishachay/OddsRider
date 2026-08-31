import { useEffect, useRef } from 'react';
import type { RideableMarket } from '../data/polymarket';

interface HeroSpotlightProps {
  market: RideableMarket;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

export default function HeroSpotlight({ market, onRideYes, onRideNo, onPreview }: HeroSpotlightProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probPct = Math.round(market.currentProb * 100);
  const deltaUp = market.probDelta >= 0;

  // Real Polymarket probability curve rendering with animated dirt bike marker
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let bikeProgress = 0.18;
    const W = canvas.width;
    const H = canvas.height;

    const basePts = market.sparkline;
    const curvePoints: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 4) {
      const p = x / W;
      const idx = Math.min(basePts.length - 1, Math.floor(p * (basePts.length - 1)));
      const nextIdx = Math.min(basePts.length - 1, idx + 1);
      const frac = (p * (basePts.length - 1)) - idx;
      const interpProb = basePts[idx] + (basePts[nextIdx] - basePts[idx]) * frac;
      const y = 30 + (1 - interpProb) * (H - 60);
      curvePoints.push([x, y]);
    }

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // 1. Subtle terrain gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(182, 255, 0, 0.15)');
      grad.addColorStop(1, 'rgba(182, 255, 0, 0.0)');
      ctx.beginPath();
      ctx.moveTo(curvePoints[0][0], H);
      for (const [x, y] of curvePoints) ctx.lineTo(x, y);
      ctx.lineTo(curvePoints[curvePoints.length - 1][0], H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Real Glowing Probability Track Line
      ctx.beginPath();
      for (let i = 0; i < curvePoints.length; i++) {
        const [x, y] = curvePoints[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = TOXIC;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // 3. Start & Finish Labels
      ctx.fillStyle = '#7c7f86';
      ctx.font = 'bold 9px Geist Mono, monospace';
      ctx.fillText('0% PROB (START)', curvePoints[10][0], curvePoints[10][1] - 12);
      ctx.fillStyle = TOXIC;
      ctx.fillText('100% PROB [FINISH]', curvePoints[curvePoints.length - 28][0] - 20, curvePoints[curvePoints.length - 28][1] - 14);

      // 4. Motocross Rider on the Probability Curve
      bikeProgress = (bikeProgress + 0.0022) % 0.94;
      const targetIdx = Math.floor(bikeProgress * (curvePoints.length - 1));
      const [bx, by] = curvePoints[targetIdx] ?? [100, 100];
      const nextIdx = Math.min(curvePoints.length - 1, targetIdx + 2);
      const [nx, ny] = curvePoints[nextIdx] ?? [bx + 2, by];
      const angle = Math.atan2(ny - by, nx - bx);

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);

      // Draw stylized dirt bike marker
      ctx.fillStyle = '#f0f0f2';
      ctx.fillRect(-4, -14, 8, 10);
      ctx.fillStyle = TOXIC;
      ctx.beginPath();
      ctx.arc(-5, -2, 3.5, 0, Math.PI * 2);
      ctx.arc(5, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [market]);

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-6 pb-4 select-none font-sans">
      <div className="relative border border-[#232529] bg-[#101113] p-6 sm:p-8 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
        {/* Tactical Corner Reticles */}
        <span className="absolute -top-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -top-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          
          {/* Left Column: Contract Telemetry */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-extrabold tracking-[0.24em] text-toxic uppercase px-2.5 py-1 border border-toxic/30 bg-toxic/8">
                🔥 #1 TRENDING LIVE POLYMARKET CONTRACT
              </span>
              <span className="font-mono text-[9px] font-bold text-dim uppercase border border-[#232529] px-2 py-1">
                {market.category}
              </span>
              <span className="font-mono text-[9px] font-bold text-toxic uppercase">
                • {market.difficulty}
              </span>
            </div>

            <h1
              onClick={() => onPreview(market)}
              className="font-display font-bold text-2xl sm:text-3xl text-ink leading-snug hover:text-toxic transition-colors cursor-pointer"
            >
              {market.question}
            </h1>

            {/* Probability & Volume Stats */}
            <div className="flex flex-wrap items-baseline gap-6 pt-2 font-mono">
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                  CHANCE:
                </span>
                <span className="text-3xl sm:text-4xl font-black tabular-nums text-toxic tracking-tight">
                  {probPct}%
                </span>
                <span className="font-sans text-xs font-extrabold text-ink">
                  YES
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                  24H SHIFT:
                </span>
                <span className={`text-base font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
                  {deltaUp ? '↑ +' : '↓ '}{(market.probDelta * 100).toFixed(1)}%
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                  24H VOLUME:
                </span>
                <span className="text-base font-bold text-ink tabular-nums">
                  {market.volumeFormatted}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                onClick={() => onRideYes(market)}
                className="px-6 py-3.5 bg-toxic text-bg font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-toxic/90 transition-all cursor-pointer shadow-[0_0_20px_rgba(182,255,0,0.4)]"
              >
                [ RIDE LIVE ODDS (YES ∧) ]
              </button>

              <button
                onClick={() => onRideNo(market)}
                className="px-6 py-3.5 border border-crimson/60 bg-crimson/15 text-crimson font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-crimson hover:text-bg transition-all cursor-pointer"
              >
                [ RIDE INVERSE DROP (NO ∨) ]
              </button>

              <button
                onClick={() => onPreview(market)}
                className="px-4 py-3.5 border border-[#232529] bg-[#101113] font-mono text-xs font-bold text-dim hover:text-ink transition-colors cursor-pointer"
              >
                [ INSPECT TRACK ]
              </button>
            </div>
          </div>

          {/* Right Column: Live Track Elevation Canvas */}
          <div className="w-full lg:w-[420px] h-48 sm:h-52 relative border border-[#232529] bg-[#0c0e12] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={420}
              height={208}
              className="w-full h-full object-contain"
            />
          </div>

        </div>
      </div>
    </section>
  );
}
