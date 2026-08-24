import { useEffect, useMemo, useRef, useState } from 'react';
import { bus, EV } from '../game/bus';
import ResultModal from './ResultModal';

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

function Key({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center border border-line bg-bg/85 px-1 py-0.5 font-mono text-[9px] leading-none text-ink">
      {label}
    </span>
  );
}

function ControlRow({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="flex items-center gap-4">
      {items.map(([k, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <Key label={k} />
          <span className="font-mono text-[9px] tracking-[0.14em] text-dim">{label}</span>
        </span>
      ))}
    </div>
  );
}

function formatTime(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}

const MAP_W = 176;
const MAP_H = 64;
const MAP_PAD = 8;

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
    ctx.lineWidth = 1;
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
    <div className="relative border border-line bg-bg/85" style={{ width: MAP_W, height: MAP_H }}>
      <canvas ref={ref} width={MAP_W} height={MAP_H} className="absolute inset-0" />
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
  const [muted, setMuted] = useState(false);
  const [nitro, setNitro] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);
  const [prob, setProb] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [track, setTrack] = useState<TrackPts | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState<ScorePayload>({ total: 0, timeMs: 0, finished: false });
  const [result, setResult] = useState<ResultPayload | null>(null);

  useEffect(() => {
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
    const offCrash = bus.on(EV.CRASH, () => {
      setCrashFlash(true);
      window.clearTimeout(crashTimer);
      crashTimer = window.setTimeout(() => setCrashFlash(false), 900);
    });

    return () => {
      offMute();
      offNitro();
      offProb();
      offTrack();
      offPos();
      offMarket();
      offScore();
      offResult();
      offCrash();
    };
  }, []);

  const marketName = market
    ? market.question.length > 46
      ? `${market.question.slice(0, 46)}…`
      : market.question
    : 'LOADING MARKET…';

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaStr = `${deltaUp ? '+' : ''}${((market?.probDelta ?? 0) * 100).toFixed(1)}`;

  const toggleMute = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyM' }));
  };

  const rideAgain = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR' }));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.42) 100%)' }}
      />

      {/* top-left: market panel */}
      <div className="absolute top-4 left-4 w-105 border border-line bg-bg/85">
        <div className="border-b border-line px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 bg-toxic" />
            <span className="truncate font-mono text-[10px] tracking-[0.06em] text-dim">{marketName}</span>
          </div>
        </div>
        <div className="flex items-stretch">
          <div className="flex-1 px-4 py-3">
            <div className="font-mono text-[9px] tracking-[0.32em] text-dim">SCORE</div>
            <div className="mt-1.5 font-mono text-3xl leading-none tabular-nums text-ink">{score.total}</div>
          </div>
          <div className="w-px bg-line" />
          <div className="flex-1 px-4 py-3">
            <div className="font-mono text-[9px] tracking-[0.32em] text-dim">PROBABILITY</div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-mono text-3xl leading-none tabular-nums ${
                  deltaUp ? 'text-toxic' : 'text-crimson'
                }`}
              >
                {prob === null ? '—' : `${Math.round(prob * 100)}%`}
              </span>
              {market && (
                <span
                  className={`border px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums ${
                    deltaUp ? 'border-toxic/40 text-toxic' : 'border-crimson/40 text-crimson'
                  }`}
                >
                  {deltaUp ? '▲' : '▼'} {Math.abs(parseFloat(deltaStr)).toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* top-center: timer + nitro */}
      <div className="absolute top-4 left-1/2 flex -translate-x-1/2 flex-col items-stretch gap-2">
        <div className="border border-line bg-bg/85 px-5 py-2 text-center">
          <div className="font-mono text-[9px] tracking-[0.32em] text-dim">TIME</div>
          <div className="mt-1 font-mono text-2xl leading-none tabular-nums text-ink">
            {formatTime(score.timeMs)}
          </div>
        </div>
        <div className="flex items-center gap-2 border border-line bg-bg/85 px-3 py-1.5">
          <span className="font-mono text-[9px] tracking-[0.24em] text-dim">NITRO</span>
          <span className="flex gap-[3px]">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`h-2.5 w-1.5 ${nitro * 10 > i ? 'bg-toxic' : 'bg-line'}`} />
            ))}
          </span>
        </div>
      </div>

      {/* top-right: minimap + mute */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <MiniTrack pts={track} progress={progress} />
        <button
          onClick={toggleMute}
          className={`pointer-events-auto cursor-pointer border bg-bg/85 px-2 py-1 font-mono text-[9px] tracking-[0.24em] ${
            muted ? 'border-crimson text-crimson' : 'border-line text-dim hover:text-ink'
          }`}
        >
          {muted ? 'SND OFF' : 'SND ON'}
        </button>
      </div>

      {/* crash flash */}
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

      {/* bottom-right: persistent controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 border border-line bg-bg/85 px-4 py-3">
        <ControlRow items={[['↑', 'gas'], ['Shift/N', 'nitro']]} />
        <ControlRow items={[['←/→', 'lean'], ['Space', 'jump']]} />
        <ControlRow items={[['R', 'reset'], ['M', 'mute']]} />
      </div>

      {/* bottom-center: wordmark */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.42em] text-dim/70">
        ODDSRIDER
      </div>
    </div>
  );
}
