import { useEffect, useRef } from 'react';
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

  // Animated Dirt Bike riding across live neon Polymarket probability curve
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let bikeProgress = 0.22;
    const W = canvas.width;
    const H = canvas.height;

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
      grad.addColorStop(0, 'rgba(182, 255, 0, 0.12)');
      grad.addColorStop(1, 'rgba(182, 255, 0, 0.0)');
      ctx.beginPath();
      ctx.moveTo(curvePoints[0][0], H);
      for (const [x, y] of curvePoints) ctx.lineTo(x, y);
      ctx.lineTo(curvePoints[curvePoints.length - 1][0], H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // 2. Clean Glowing Probability Line (Locked #b6ff00 Toxic Green)
      ctx.beginPath();
      for (let i = 0; i < curvePoints.length; i++) {
        const [x, y] = curvePoints[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#b6ff00';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 3. Start & Finish Labels
      ctx.fillStyle = '#7c7f86';
      ctx.font = 'bold 10px Geist Mono, monospace';
      ctx.fillText('0% PROB [START]', curvePoints[10][0], curvePoints[10][1] - 12);
      ctx.fillText('100% PROB [FINISH]', curvePoints[curvePoints.length - 25][0] - 20, curvePoints[curvePoints.length - 25][1] - 14);

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

      // Draw rider & bike chassis
      ctx.fillStyle = '#f0f0f2';
      ctx.fillRect(-4, -14, 8, 10);
      ctx.fillStyle = '#b6ff00';
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
    <section className="w-full max-w-5xl mx-auto pt-14 pb-8 px-4 flex flex-col items-center text-center select-none font-sans">
      
      {/* ── Subtitle Tagline ── */}
      <span className="font-mono text-[10.5px] font-extrabold tracking-[0.26em] text-toxic uppercase mb-3">
        PREDICTION MARKETS MEETS MOTOCROSS
      </span>

      {/* ── Main Clean Headline (Space Grotesk) ── */}
      <h1 className="font-display font-bold text-4xl sm:text-6xl text-ink tracking-tight">
        Ride any Polymarket odds.
      </h1>

      {/* ── Animated Chart Canvas ── */}
      <div className="w-full max-w-2xl h-44 sm:h-52 relative mt-8 flex items-center justify-center border border-[#232529] bg-[#101113]">
        <canvas
          ref={canvasRef}
          width={672}
          height={208}
          className="w-full h-full object-contain"
        />
      </div>

      {/* ── Global 3 Stats (Geist Mono Tabular Numerals) ── */}
      <div className="w-full max-w-2xl grid grid-cols-3 gap-4 mt-6 pt-4 font-mono border-t border-[#232529]">
        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-ink tabular-nums">
            {stats.rides}
          </span>
          <span className="text-[10px] text-dim font-sans uppercase font-extrabold tracking-wider mt-1">
            rides completed
          </span>
        </div>

        <div className="flex flex-col items-center border-x border-[#232529]">
          <span className="text-2xl sm:text-3xl font-bold text-toxic tabular-nums">
            {stats.volume}
          </span>
          <span className="text-[10px] text-dim font-sans uppercase font-extrabold tracking-wider mt-1">
            probability volume
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold text-crimson tabular-nums">
            {stats.crashes}
          </span>
          <span className="text-[10px] text-dim font-sans uppercase font-extrabold tracking-wider mt-1">
            total wipeouts
          </span>
        </div>
      </div>

      {/* ── Polymarket Category Pill Switcher (Radius-0) ── */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-8 p-1.5 bg-[#101113] border border-[#232529]">
        {[
          { id: 'ALL', label: 'ALL MARKETS' },
          { id: 'POLITICS', label: 'POLITICS' },
          { id: 'CRYPTO', label: 'CRYPTO' },
          { id: 'MACRO', label: 'MACRO / FED' },
          { id: 'TECH', label: 'TECH / AI' },
          { id: 'LEGENDARY', label: 'LEGENDARY CRASHES' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-toxic/15 text-toxic border border-toxic/40'
                : 'text-dim hover:text-ink border border-transparent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Search Bar (Radius-0) ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
        className="w-full max-w-lg mt-4 relative flex items-center"
      >
        <input
          type="text"
          placeholder="Search any Polymarket question... (Bitcoin, Trump, Fed, OpenAI...)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#101113] border border-[#232529] px-4 py-3 text-sm text-ink placeholder-dim/60 focus:border-toxic/60 focus:outline-none transition-all pr-24 font-sans"
        />
        <div className="absolute right-2 flex items-center gap-2">
          <span className="font-mono text-[9.5px] text-dim border border-[#232529] px-1.5 py-0.5 select-none hidden sm:inline-block">
            /
          </span>
          <button
            type="submit"
            className="px-4 py-1.5 bg-toxic text-bg font-mono text-xs font-bold uppercase hover:bg-toxic/90 transition-colors cursor-pointer"
          >
            Ride
          </button>
        </div>
      </form>

    </section>
  );
}
