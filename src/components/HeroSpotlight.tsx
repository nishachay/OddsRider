import { useEffect, useRef } from 'react';
import type { RideableMarket } from '../data/polymarket';

interface HeroProps {
  market: RideableMarket;
  live: boolean;
  trackCount: number;
  onRideYes: (market: RideableMarket) => void;
  onRideNo: (market: RideableMarket) => void;
  onPreview: (market: RideableMarket) => void;
}

interface SearchStripProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: (q: string) => void;
}

const TOXIC = '#b6ff00';
const QUICK_PICKS = ['BITCOIN', 'TRUMP', 'FED', 'AI'];

const GOING: Record<string, string> = {
  EASY: 'text-toxic',
  MEDIUM: 'text-ink',
  HARD: 'text-orange-500',
  INSANE: 'text-crimson',
  NEW: 'text-dim',
};

function scrollToCard() {
  document.getElementById('card')?.scrollIntoView({ behavior: 'smooth' });
}

export default function HeroSpotlight({
  market,
  live,
  trackCount,
  onRideYes,
  onRideNo,
  onPreview,
}: HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const probPct = Math.round(market.currentProb * 100);
  const chanceUp = market.currentProb >= 0.5;

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

  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-10 sm:pt-16 pb-4 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-10 items-end">
        <div className="flex flex-col items-start gap-5">
          <span className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.3em] uppercase">
            <span className={`inline-block w-2 h-2 ${live ? 'bg-toxic animate-pulse' : 'bg-amber-400'}`} />
            <span className={live ? 'text-toxic' : 'text-amber-400'}>
              {live ? 'Live race card' : 'Offline race card'}
            </span>
          </span>

          <h1 className="font-poster uppercase leading-[0.88] text-[clamp(3.8rem,10vw,7.5rem)]">
            <span className="block text-ink">Ride the</span>
            <span className="block text-outline">odds.</span>
          </h1>

          <p className="font-sans text-sm sm:text-base text-dim max-w-md leading-relaxed">
            Real Polymarket probability charts turned into motocross tracks.
            Every rally is a climb. Every crash is a cliff.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              onClick={() => onRideYes(market)}
              className="px-8 py-4 bg-toxic text-bg font-mono text-sm font-bold tracking-[0.16em] uppercase hover:bg-toxic/90 transition-all cursor-pointer shadow-[0_0_24px_rgba(182,255,0,0.45)]"
            >
              Enter race 01
            </button>
            <button
              onClick={scrollToCard}
              className="font-mono text-[11px] font-bold tracking-[0.2em] text-dim hover:text-toxic transition-colors cursor-pointer uppercase underline underline-offset-8 decoration-[#3b414f] hover:decoration-toxic"
            >
              Browse the card
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-dim">
            <span>
              <span className="text-ink tabular-nums">{trackCount}</span> runners
            </span>
            <span>Free</span>
            <span>No account</span>
          </div>
        </div>

        {/* ── Featured race ── */}
        <div
          onClick={() => onPreview(market)}
          className="border border-[#232529] bg-[#101113] cursor-pointer group hover:border-toxic/50 transition-all"
        >
          <div className="flex items-center justify-between px-5 pt-4 font-mono text-[10px] font-bold tracking-[0.22em] uppercase">
            <span className="text-toxic">Race 01 · {market.category}</span>
            <span className={GOING[market.difficulty] ?? 'text-dim'}>
              Going · {market.difficulty}
              {!market.live && <span className="text-dim"> · Cached</span>}
            </span>
          </div>

          <div className="px-5 pt-3 font-display font-bold text-lg leading-snug text-ink group-hover:text-toxic transition-colors">
            {market.question}
          </div>

          <div className="flex items-end gap-2 px-5 pt-1">
            <span
              className={`font-poster leading-none text-7xl tabular-nums ${chanceUp ? 'text-toxic' : 'text-crimson'}`}
            >
              {probPct}
              <span className="text-2xl text-dim">%</span>
            </span>
            <span className="font-sans text-xs font-extrabold text-ink pb-1.5">YES</span>
            <span className="font-mono text-[11px] text-dim tabular-nums pb-1.5 ml-auto">
              {market.volumeFormatted}
            </span>
          </div>

          <div className="mx-5 mt-3 border border-[#232529] bg-[#0c0e12] overflow-hidden">
            <canvas ref={canvasRef} width={900} height={220} className="block w-full h-36 sm:h-40" />
          </div>

          <div className="grid grid-cols-2 mt-4 border-t border-[#232529]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRideYes(market);
              }}
              className="py-4 bg-toxic text-bg font-mono text-xs font-bold tracking-[0.18em] uppercase hover:bg-toxic/90 transition-all cursor-pointer text-center"
            >
              Ride yes ∧
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRideNo(market);
              }}
              className="py-4 border-l border-[#232529] bg-transparent text-crimson font-mono text-xs font-bold tracking-[0.18em] uppercase hover:bg-crimson hover:text-bg transition-all cursor-pointer text-center"
            >
              Ride no ∨
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SearchStrip({ query, onQueryChange, onSearch }: SearchStripProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <section id="find" className="w-full max-w-6xl mx-auto px-4 pt-12 scroll-mt-16 select-none">
      <h2 className="font-poster uppercase text-3xl sm:text-4xl text-ink leading-none">
        Find your race
      </h2>
      <p className="font-mono text-[10px] font-bold tracking-[0.22em] text-dim pt-2 uppercase">
        Search the card — or paste any Polymarket link
      </p>

      <form
        className="flex items-end gap-3 pt-4 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSearch(query.trim());
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Bitcoin, Trump, Fed…  ( / )"
          className="flex-1 bg-transparent border-b-2 border-[#3b414f] focus:border-toxic focus:outline-none font-display font-bold text-xl py-2 text-ink placeholder:text-dim/40 transition-colors"
        />
        <button
          type="submit"
          className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-toxic border-b-2 border-toxic px-1 py-2 hover:bg-toxic hover:text-bg transition-all cursor-pointer"
        >
          Find →
        </button>
      </form>

      <div className="flex items-center gap-5 pt-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase">
        {QUICK_PICKS.map((chip, i) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              onQueryChange(chip);
              onSearch(chip);
            }}
            className="text-dim hover:text-toxic transition-colors cursor-pointer"
          >
            <span className="text-[#3b414f] mr-1">0{i + 1}</span>
            {chip}
          </button>
        ))}
      </div>
    </section>
  );
}
