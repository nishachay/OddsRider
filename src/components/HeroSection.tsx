import { useEffect, useRef } from 'react';
import { getGlobalPlatformStats, getPlayerStats } from '../data/playerStorage';

interface HeroSectionProps {
  onExploreClick: () => void;
}

export default function HeroSection({ onExploreClick }: HeroSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stats = getGlobalPlatformStats(getPlayerStats());

  // Animated Dirt Bike riding across live neon curve (StonkRider style)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let bikeProgress = 0.15;
    const W = canvas.width;
    const H = canvas.height;

    const curvePoints: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 4) {
      const p = x / W;
      const y =
        H * 0.55 +
        Math.sin(p * Math.PI * 3.2) * (H * 0.22) +
        Math.cos(p * Math.PI * 6.5) * (H * 0.12) -
        (p - 0.5) * (H * 0.18);
      curvePoints.push([x, y]);
    }

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      // 1. Draw glowing gradient fill under track
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

      // 2. Draw glowing neon track line
      ctx.beginPath();
      for (let i = 0; i < curvePoints.length; i++) {
        const [x, y] = curvePoints[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#b6ff00';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#b6ff00';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Draw Start & Finish Markers
      ctx.fillStyle = '#7c7f86';
      ctx.font = 'bold 9px Geist Mono, monospace';
      ctx.fillText('START', curvePoints[8][0], curvePoints[8][1] - 12);
      ctx.fillText('🏁 FINISH', curvePoints[curvePoints.length - 15][0] - 30, curvePoints[curvePoints.length - 15][1] - 12);

      // 4. Update & Draw Motocross Rider Dot / Icon
      bikeProgress = (bikeProgress + 0.0025) % 0.92;
      const targetIdx = Math.floor(bikeProgress * (curvePoints.length - 1));
      const [bx, by] = curvePoints[targetIdx] ?? [100, 100];
      const nextIdx = Math.min(curvePoints.length - 1, targetIdx + 2);
      const [nx, ny] = curvePoints[nextIdx] ?? [bx + 2, by];
      const angle = Math.atan2(ny - by, nx - bx);

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(angle);

      // Draw stylized dirt bike neon marker
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillRect(-6, -14, 12, 10);
      ctx.fillStyle = '#b6ff00';
      ctx.beginPath();
      ctx.arc(-5, -3, 3.5, 0, Math.PI * 2);
      ctx.arc(5, -3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <section className="w-full max-w-6xl mx-auto pt-10 pb-8 px-4 flex flex-col items-center text-center select-none">
      {/* ── Sub-Badge ── */}
      <div className="inline-flex items-center gap-2 px-3 py-1 border border-toxic/30 bg-toxic/5 mb-4">
        <span className="w-1.5 h-1.5 bg-toxic animate-ping" />
        <span className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-toxic uppercase">
          MOTOCROSS MEETS PREDICTION MARKETS
        </span>
      </div>

      {/* ── Headline ── */}
      <h1 className="font-display font-black text-4xl sm:text-6xl text-ink tracking-tight uppercase max-w-3xl leading-tight">
        Ride any <span className="text-toxic">Polymarket</span> chart.
      </h1>

      {/* ── Subtitle ── */}
      <p className="mt-3 text-sm sm:text-base text-dim max-w-2xl leading-relaxed">
        Real Polymarket orderbooks converted into playable 2D motocross tracks. Ride the probability slopes, hit nitro on surges, and finish without wrecking.
      </p>

      {/* ── Live Animated Dirt Bike Chart (StonkRider Hero) ── */}
      <div className="w-full max-w-3xl h-44 sm:h-52 relative mt-6 border border-[#1f242d] bg-[#0c0e12] flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={768}
          height={208}
          className="w-full h-full object-cover"
        />
      </div>

      {/* ── Global Platform Telemetry Counters ── */}
      <div className="w-full max-w-3xl grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-[#1f242d] font-mono">
        <div className="flex flex-col items-center">
          <span className="text-xl sm:text-2xl font-black text-ink tabular-nums">
            {stats.rides}
          </span>
          <span className="font-sans text-[8.5px] font-extrabold tracking-[0.18em] text-dim uppercase mt-0.5">
            RIDES COMPLETED
          </span>
        </div>

        <div className="flex flex-col items-center border-x border-[#1f242d]">
          <span className="text-xl sm:text-2xl font-black text-toxic tabular-nums">
            {stats.volume}
          </span>
          <span className="font-sans text-[8.5px] font-extrabold tracking-[0.18em] text-dim uppercase mt-0.5">
            PROBABILITY VOLUME
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xl sm:text-2xl font-black text-crimson tabular-nums">
            {stats.crashes}
          </span>
          <span className="font-sans text-[8.5px] font-extrabold tracking-[0.18em] text-dim uppercase mt-0.5">
            FATAL CRASHES
          </span>
        </div>
      </div>
    </section>
  );
}
