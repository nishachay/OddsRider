import { useEffect, useRef } from 'react';
import type { RideableMarket } from '../data/polymarket';
import type { PlayerStats } from '../data/playerStorage';

interface HeroProps {
  market: RideableMarket;
  live: boolean;
  stats: PlayerStats;
  query: string;
  onQueryChange: (q: string) => void;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
  onSearch: (q: string) => void;
}

const TOXIC = '#b6ff00';

export default function HeroSpotlight({
  market,
  live,
  stats,
  query,
  onQueryChange,
  onRideYes,
  onRideNo,
  onPreview,
  onSearch,
}: HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const probPct = Math.round(market.currentProb * 100);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Animated probability curve with a rider marker rolling along it
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const basePts = market.sparkline ?? [];
    const W = canvas.width;
    const H = canvas.height;
    if (basePts.length < 2) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#7c7f86';
      ctx.font = 'bold 12px Geist Mono, monospace';
      ctx.fillText('AWAITING LIVE ODDS', 24, H / 2);
      return;
    }

    const curve: Array<[number, number]> = [];
    for (let x = 0; x <= W; x += 4) {
      const p = x / W;
      const f = p * (basePts.length - 1);
      const i = Math.min(basePts.length - 2, Math.floor(f));
      const frac = f - i;
      const v = basePts[i] + (basePts[i + 1] - basePts[i]) * frac;
      curve.push([x, 26 + (1 - v) * (H - 52)]);
    }

    let animId = 0;
    let progress = 0.15;
    const render = () => {
      ctx.clearRect(0, 0, W, H);

      ctx.beginPath();
      ctx.moveTo(curve[0][0], H);
      for (const [x, y] of curve) ctx.lineTo(x, y);
      ctx.lineTo(curve[curve.length - 1][0], H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(182, 255, 0, 0.05)';
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < curve.length; i++) {
        const [x, y] = curve[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = TOXIC;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#7c7f86';
      ctx.font = 'bold 9px Geist Mono, monospace';
      ctx.fillText('START', curve[4][0], curve[4][1] - 10);
      ctx.fillStyle = TOXIC;
      ctx.fillText('FINISH', curve[curve.length - 5][0] - 34, curve[curve.length - 5][1] - 10);

      progress = (progress + 0.002) % 0.95;
      const ti = Math.floor(progress * (curve.length - 1));
      const [bx, by] = curve[ti];
      const [nx, ny] = curve[Math.min(curve.length - 1, ti + 2)];
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(ny - by, nx - bx));
      ctx.fillStyle = '#f0f0f2';
      ctx.fillRect(-4, -13, 8, 9);
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

  const submit = () => {
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-10 pb-2 select-none">
      <div className="flex flex-col items-center text-center gap-3">
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-toxic uppercase">
          Motocross meets prediction markets
        </span>
        <h1 className="font-display font-black text-4xl sm:text-6xl text-ink tracking-tight">
          Ride the odds.
        </h1>
        <p className="font-sans text-sm sm:text-base text-dim max-w-xl leading-relaxed">
          Real Polymarket probability charts turned into motocross tracks.
          Every rally is a climb. Every crash is a cliff.
        </p>

        <div className="flex items-center gap-2 pt-1 font-mono text-[10px] font-bold tracking-widest uppercase">
          <span className={`inline-block w-2 h-2 ${live ? 'bg-toxic animate-pulse' : 'bg-amber-400'}`} />
          <span className={live ? 'text-toxic' : 'text-amber-400'}>
            {live ? 'Live feed' : 'Offline cache'}
          </span>
        </div>

        <form
          className="w-full max-w-xl flex gap-2 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
            }}
            placeholder="Search any market… ( / )"
            className="flex-1 bg-[#101113] border border-[#232529] px-4 py-3 font-mono text-sm text-ink placeholder-dim/60 focus:border-toxic/60 focus:outline-none transition-all"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-toxic text-bg font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-toxic/90 transition-all cursor-pointer"
          >
            Find
          </button>
        </form>
      </div>

      <div className="relative border border-[#232529] bg-[#101113] p-6 sm:p-8 mt-8">
        <span className="absolute -top-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -top-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase">
              <span className="tracking-[0.24em] text-toxic border border-toxic/30 bg-toxic/10 px-2.5 py-1">
                #1 Trending
              </span>
              <span className="text-dim border border-[#232529] px-2 py-1">{market.category}</span>
              <span className="text-toxic">• {market.difficulty}</span>
              {!market.live && <span className="text-amber-400">• Cached</span>}
            </div>

            <h2
              onClick={() => onPreview(market)}
              className="font-display font-bold text-2xl sm:text-3xl text-ink leading-snug hover:text-toxic transition-colors cursor-pointer"
            >
              {market.question}
            </h2>

            <div className="flex flex-wrap items-baseline gap-6 pt-1 font-mono">
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                  Chance:
                </span>
                <span className="text-3xl sm:text-4xl font-black tabular-nums text-toxic tracking-tight">
                  {probPct}%
                </span>
                <span className="font-sans text-xs font-extrabold text-ink">YES</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                  24H Volume:
                </span>
                <span className="text-base font-bold text-ink tabular-nums">{market.volumeFormatted}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                  Your rides:
                </span>
                <span className="text-base font-bold text-ink tabular-nums">
                  {stats.ridesCompleted} · Best {stats.highScore.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <button
                onClick={() => onRideYes(market)}
                className="px-6 py-3.5 bg-toxic text-bg font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-toxic/90 transition-all cursor-pointer shadow-[0_0_20px_rgba(182,255,0,0.4)]"
              >
                [ Ride Yes ]
              </button>
              <button
                onClick={() => onRideNo(market)}
                className="px-6 py-3.5 border border-crimson/60 bg-crimson/15 text-crimson font-mono text-xs font-bold tracking-[0.16em] uppercase hover:bg-crimson hover:text-bg transition-all cursor-pointer"
              >
                [ Ride No ]
              </button>
              <button
                onClick={() => onPreview(market)}
                className="px-4 py-3.5 border border-[#232529] bg-[#101113] font-mono text-xs font-bold text-dim hover:text-ink transition-colors cursor-pointer"
              >
                [ Inspect track ]
              </button>
            </div>
          </div>

          <div className="w-full lg:w-[420px] h-48 sm:h-52 relative border border-[#232529] bg-[#0c0e12]">
            <canvas ref={canvasRef} width={420} height={208} className="w-full h-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
