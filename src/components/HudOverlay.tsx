import { useEffect, useMemo, useRef, useState } from 'react';
import { bus, EV } from '../game/bus';
import ResultModal from './ResultModal';

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

function Key({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-[3px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] leading-none text-ink">
      {label}
    </span>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((k) => (
        <Key key={k} label={k} />
      ))}
      <span className="font-mono text-[9px] tracking-[0.05em] text-dim">{label}</span>
    </span>
  );
}

function formatTime(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${secs}`;
}

const MAP_W = 160;
const MAP_H = 60;
const MAP_PAD = 4;

type TrackPts = Array<[number, number]>;

function MiniTrack({ pts, progress }: { pts: TrackPts | null; progress: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  const geo = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY };
  }, [pts]);

  const scale = useMemo(() => {
    if (!geo) return null;
    const sx = (MAP_W - MAP_PAD * 2) / Math.max(1, geo.maxX - geo.minX);
    const sy = (MAP_H - MAP_PAD * 2) / Math.max(1, geo.maxY - geo.minY);
    return { sx, sy, ox: MAP_PAD, oy: MAP_PAD };
  }, [geo]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !pts || !geo || !scale) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { minX, minY } = geo;
    const { sx, sy, ox, oy } = scale;
    const px = (x: number) => ox + (x - minX) * sx;
    const py = (y: number) => oy + (y - minY) * sy;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    ctx.lineWidth = 1.5;
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = pts[i][1] <= pts[i - 1][1] ? TOXIC : CRIMSON;
      ctx.beginPath();
      ctx.moveTo(px(pts[i - 1][0]), py(pts[i - 1][1]));
      ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
      ctx.stroke();
    }
  }, [pts, geo, scale]);

  const dot = useMemo(() => {
    if (!pts || !geo || !scale) return null;
    const { minX, maxX, minY } = geo;
    const { sx, sy, ox, oy } = scale;
    const xT = minX + Math.min(1, Math.max(0, progress)) * (maxX - minX);
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][0] < xT) i++;
    const [xa, ya] = pts[i];
    const [xb, yb] = pts[i + 1] ?? pts[i];
    const t = xb > xa ? (xT - xa) / (xb - xa) : 0;
    const yv = ya + (yb - ya) * t;
    return { left: ox + (xT - minX) * sx, top: oy + (yv - minY) * sy };
  }, [pts, geo, scale, progress]);

  return (
    <div className="relative rounded-sm border border-line bg-bg/90 p-1" style={{ width: MAP_W, height: MAP_H }}>
      <canvas ref={ref} width={MAP_W} height={MAP_H} className="absolute inset-0 opacity-80" />
      {dot && (
        <span
          className="absolute h-2 w-2 rounded-full bg-toxic"
          style={{ left: dot.left - 4, top: dot.top - 4, boxShadow: `0 0 6px ${TOXIC}` }}
        />
      )}
    </div>
  );
}

interface ScorePayload {
  total: number;
  timeMs: number;
  finished: boolean;
}

interface MarketPayload {
  question: string;
  probNow: number;
  probDelta: number;
}

interface ResultPayload {
  finished: boolean;
  score: number;
  timeMs: number;
}

export default function HudOverlay() {
  const [speed, setSpeed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nitro, setNitro] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(true);
  const [prob, setProb] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [track, setTrack] = useState<TrackPts | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState<ScorePayload>({ total: 0, timeMs: 0, finished: false });
  const [result, setResult] = useState<ResultPayload | null>(null);

  useEffect(() => {
    const offSpeed = bus.on<number>(EV.SPEED, setSpeed);
    const offMute = bus.on<boolean>(EV.MUTE, setMuted);
    const offNitro = bus.on<number>(EV.NITRO, setNitro);
    const offProb = bus.on<number>(EV.PROB, setProb);
    const offTrack = bus.on<{ pts: TrackPts }>(EV.TRACK, (t) => {
      setTrack(t.pts);
      setProgress(0);
    });
    const offPos = bus.on<number>(EV.POSITION, setProgress);
    const offMarket = bus.on<MarketPayload | null>(EV.MARKET, (m) => {
      setMarket(m);
      setResult(null);
      if (!m) setTrack(null);
    });
    const offScore = bus.on<ScorePayload>(EV.SCORE, (s) => {
      setScore(s);
      if (!s.finished) setResult(null);
    });
    const offResult = bus.on<ResultPayload>(EV.RESULT, setResult);
    let crashTimer = 0;
    const offCrash = bus.on<void>(EV.CRASH, () => {
      setCrashFlash(true);
      window.clearTimeout(crashTimer);
      crashTimer = window.setTimeout(() => setCrashFlash(false), 900);
    });

    const fallbackTimer = window.setTimeout(() => setHintsVisible(false), 8000);
    let hideTimer = 0;
    const offFirst = bus.on<void>(EV.INPUT_FIRST, () => {
      hideTimer = window.setTimeout(() => setHintsVisible(false), 2400);
    });

    return () => {
      offSpeed();
      offMute();
      offNitro();
      offProb();
      offTrack();
      offPos();
      offMarket();
      offScore();
      offResult();
      offCrash();
      offFirst();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(crashTimer);
    };
  }, []);

  const marketName = market
    ? market.question.length > 52
      ? `${market.question.slice(0, 52)}...`
      : market.question
    : 'LOADING POLYMARKET DATA...';

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaStr = `${deltaUp ? '+' : ''}${((market?.probDelta ?? 0) * 100).toFixed(1)}`;

  const toggleMute = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM' }));
  };

  const rideAgain = () => {
    setResult(null);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' }));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Vignette background shading */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 100%)' }}
      />

      {/* Top-Left: Separated Brand Logo */}
      <div className="absolute top-5 left-5">
        <div
          className="font-display text-lg leading-none font-bold tracking-[0.18em] drop-shadow-md"
          style={{ fontStretch: '118%' }}
        >
          <span className="text-toxic">Odds</span>
          <span className="text-ink">Rider</span>
        </div>
      </div>

      {/* Mid-Left: Cohesive Telemetry & Market Panel (Matches bottom bar style) */}
      <div className="absolute top-14 left-5 flex flex-col gap-4 border border-line bg-bg/90 px-4 py-3 shadow-2xl w-[340px]">
        
        {/* Market Strip */}
        <div className="flex flex-col gap-1.5 border-b border-line/50 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span className="h-1.5 w-1.5 shrink-0 bg-toxic" />
              <span className="truncate font-mono text-[10px] tracking-[0.06em] text-dim">
                {marketName}
              </span>
            </div>
            <span
              className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] leading-none tabular-nums font-bold ${
                deltaUp ? 'border-toxic/40 text-toxic bg-toxic/10' : 'border-crimson/40 text-crimson bg-crimson/10'
              }`}
            >
              {deltaUp ? 'UP' : 'DN'} {Math.abs(parseFloat(deltaStr)).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[9px] tracking-[0.32em] text-dim">CURRENT ODDS</span>
            <span className={`font-mono text-xl leading-none font-bold tabular-nums ${deltaUp ? 'text-toxic' : 'text-crimson'}`}>
              {prob === null ? '—' : `${(prob * 100).toFixed(2)}% YES`}
            </span>
          </div>
        </div>

        {/* Telemetry Strip */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-[0.32em] text-dim">SPEED</span>
            <div className="mt-0.5 font-mono text-lg leading-none tabular-nums text-ink font-bold">
              {speed}
              <span className="ml-1 text-[9px] text-dim font-normal">PX/S</span>
            </div>
          </div>
          <div className="h-6 w-[1px] bg-line/50" />
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-[0.32em] text-dim">SCORE</span>
            <div className="mt-0.5 font-mono text-lg leading-none tabular-nums text-ink font-bold">
              {score.total.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Top-Center: Time & Nitro Bar (Studio Aesthetic) */}
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="border border-line bg-bg/90 px-5 py-2 text-center shadow-lg">
          <div className="font-mono text-[9px] tracking-[0.32em] text-dim">TIME</div>
          <div className="mt-0.5 font-mono text-2xl leading-none tabular-nums text-ink font-bold">
            {formatTime(score.timeMs)}
          </div>
        </div>

        <div className="flex items-center gap-2 border border-line bg-bg/90 px-3 py-1.5 shadow-lg">
          <span className="font-mono text-[9px] tracking-[0.24em] text-dim">NITRO</span>
          <span className="flex gap-[3px]">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`h-2.5 w-1.5 ${nitro * 10 > i ? 'bg-toxic' : 'bg-line'}`} />
            ))}
          </span>
        </div>
      </div>

      {/* Top-Right: Track Minimap & Sound Toggle */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <MiniTrack pts={track} progress={progress} />
        <button
          onClick={toggleMute}
          className={`pointer-events-auto cursor-pointer border bg-bg/90 px-2.5 py-1 font-mono text-[9px] tracking-[0.24em] shadow-sm ${
            muted ? 'border-crimson text-crimson' : 'border-line text-dim hover:text-ink'
          }`}
        >
          {muted ? 'AUDIO OFF' : 'AUDIO ON'}
        </button>
      </div>

      {/* Crash Vignette Flash */}
      <div
        className={`absolute inset-0 border-4 border-crimson transition-opacity duration-300 ${
          crashFlash ? 'opacity-70' : 'opacity-0'
        }`}
      />

      {/* Cyber Result Overlay Modal */}
      <ResultModal
        isOpen={Boolean(result)}
        result={
          result
            ? {
                finished: result.finished,
                score: result.score,
                timeMs: result.timeMs,
                marketQuestion: market?.question,
                finalProb: prob ?? undefined,
              }
            : null
        }
        onRetry={rideAgain}
      />

      {/* Bottom-Center: Clean Intuitive Keyboard Control Hints (Studio design explicitly restored) */}
      <div
        className={`absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 border border-line bg-bg/90 px-4 py-2 shadow-2xl transition-opacity duration-700 ${
          hintsVisible ? 'opacity-100' : 'opacity-80 hover:opacity-100'
        }`}
      >
        <Hint keys={['W', '↑']} label="GAS" />
        <Hint keys={['S', '↓']} label="BRAKE" />
        <Hint keys={['A', 'D']} label="LEAN" />
        <Hint keys={['SPACE']} label="JUMP" />
        <Hint keys={['SHIFT', 'N']} label="NITRO" />
        <Hint keys={['R']} label="RESET" />
        <Hint keys={['M']} label="MUTE" />
      </div>
    </div>
  );
}
