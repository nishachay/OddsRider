import { useEffect, useRef, useState } from 'react';
import { getGlobalPlatformStats, getPlayerStats } from '../data/playerStorage';

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  onSearchSubmit: () => void;
}

export default function HeroSection({
  searchQuery,
  onSearchChange,
  activeCategory,
  onSelectCategory,
  onSearchSubmit,
}: HeroSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stats = getGlobalPlatformStats(getPlayerStats());

  // Animated Dirt Bike riding across sleek line (StonkRider Image 1 match)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let bikeProgress = 0.22;
    const W = canvas.width;
    const H = canvas.height;

    // StonkRider curve topography
    const curvePoints: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 3) {
      const p = x / W;
      const y =
        H * 0.58 +
        Math.sin(p * Math.PI * 3.4) * (H * 0.22) +
        Math.cos(p * Math.PI * 7.1) * (H * 0.12) -
        (p - 0.5) * (H * 0.15);
      curvePoints.push([x, y]);
    }

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // 1. Subtle terrain gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(0, 223, 129, 0.10)');
      grad.addColorStop(1, 'rgba(0, 223, 129, 0.0)');
      ctx.beginPath();
      ctx.moveTo(curvePoints[0][0], H);
      for (const [x, y] of curvePoints) ctx.lineTo(x, y);
      ctx.lineTo(curvePoints[curvePoints.length - 1][0], H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Clean Mint Line (StonkRider style)
      ctx.beginPath();
      for (let i = 0; i < curvePoints.length; i++) {
        const [x, y] = curvePoints[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#00df81';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 3. Start & Finish Labels
      ctx.fillStyle = '#6b7280';
      ctx.font = 'bold 10px Geist Mono, monospace';
      ctx.fillText('START', curvePoints[10][0], curvePoints[10][1] - 12);
      ctx.fillText('🏁', curvePoints[curvePoints.length - 16][0] - 8, curvePoints[curvePoints.length - 16][1] - 14);

      // 4. Motocross Rider Silhouette on the Line
      bikeProgress = (bikeProgress + 0.0022) % 0.94;
      const targetIdx = Math.floor(bikeProgress * (curvePoints.length - 1));
      const [bx, by] = curvePoints[targetIdx] ?? [100, 100];
      const nextIdx = Math.min(curvePoints.length - 1, targetIdx + 2);
      const [nx, ny] = curvePoints[nextIdx] ?? [bx + 2, by];
      const angle = Math.atan2(ny - by, nx - bx);

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);

      // Draw rider & bike chassis
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(-4, -14, 8, 10);
      ctx.fillStyle = '#00df81';
      ctx.beginPath();
      ctx.arc(-5, -2, 3, 0, Math.PI * 2);
      ctx.arc(5, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <section className="w-full max-w-5xl mx-auto pt-14 pb-8 px-4 flex flex-col items-center text-center select-none">
      
      {/* ── Subtitle Tagline (StonkRider Image 1) ── */}
      <span className="font-mono text-[11px] font-bold tracking-[0.26em] text-[#00df81] uppercase mb-3">
        MOTOCROSS MEETS PREDICTION MARKETS
      </span>

      {/* ── Main Clean Headline (Sentence Case, Not AI-Slop) ── */}
      <h1 className="font-display font-bold text-4xl sm:text-6xl text-white tracking-tight">
        Ride any stock chart.
      </h1>

      {/* ── Animated Chart Canvas ── */}
      <div className="w-full max-w-2xl h-44 sm:h-52 relative mt-8 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={672}
          height={208}
          className="w-full h-full object-contain"
        />
      </div>

      {/* ── Global 3 Stats (Exact StonkRider Image 1 Layout) ── */}
      <div className="w-full max-w-2xl grid grid-cols-3 gap-4 mt-6 pt-4 font-mono">
        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {stats.rides}
          </span>
          <span className="text-[11px] text-[#7c7f86] mt-1 font-sans">
            rides completed
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-[#00df81] tabular-nums">
            {stats.volume}
          </span>
          <span className="text-[11px] text-[#7c7f86] mt-1 font-sans">
            virtual dollars traded
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {stats.crashes}
          </span>
          <span className="text-[11px] text-[#7c7f86] mt-1 font-sans">
            total crashes
          </span>
        </div>
      </div>

      {/* ── Category Pill Toggle (StonkRider: [ STOCKS ] [ STARTUPS ]) ── */}
      <div className="flex items-center gap-2 mt-8 p-1 bg-[#12151b] border border-[#1f242d] rounded-lg">
        {['ALL', 'CRYPTO', 'POLITICS', 'MACRO'].map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-4 py-1.5 font-mono text-xs font-bold uppercase rounded transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-[#00df81]/20 text-[#00df81] border border-[#00df81]/40'
                : 'text-[#7c7f86] hover:text-white'
            }`}
          >
            {cat === 'ALL' ? 'MARKETS' : cat}
          </button>
        ))}
      </div>

      {/* ── Clean Search Bar (StonkRider Image 1) ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
        className="w-full max-w-lg mt-4 relative flex items-center"
      >
        <input
          type="text"
          placeholder="Search any ticker or market... (BTC, ETH, Fed, ...)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#12151b] border border-[#1f242d] rounded-xl px-4 py-3 text-sm text-white placeholder-[#525866] focus:border-[#00df81] focus:outline-none transition-all pr-24 font-sans"
        />
        <div className="absolute right-2 flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#525866] border border-[#232834] rounded px-1.5 py-0.5 select-none hidden sm:inline-block">
            /
          </span>
          <button
            type="submit"
            className="px-4 py-1.5 bg-[#00df81] text-[#0a0a0b] font-mono text-xs font-bold rounded-lg hover:bg-[#00f58d] transition-colors cursor-pointer"
          >
            Ride
          </button>
        </div>
      </form>

    </section>
  );
}
