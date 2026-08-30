import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const DIM = "#8a8e99";
const INK = "#f0f0f2";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 140, CH = 46, CP = 4;

function MiniChart({ pts, progress }: { pts: TrackPts | null; progress: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const geo = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  }, [pts]);
  const sc = useMemo(() => {
    if (!geo) return null;
    return { sx: (CW - CP * 2) / Math.max(1, geo.x1 - geo.x0), sy: (CH - CP * 2) / Math.max(1, geo.y1 - geo.y0) };
  }, [geo]);

  useEffect(() => {
    const c = ref.current; if (!c || !pts || !geo || !sc) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const px = (x: number) => CP + (x - geo.x0) * sc.sx;
    const py = (y: number) => CP + (y - geo.y0) * sc.sy;
    ctx.clearRect(0, 0, CW, CH);

    // 1. Draw subtle filled area under the track (Environmental depth)
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), CH); // Start at bottom left
    ctx.lineTo(px(pts[0][0]), py(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
    }
    ctx.lineTo(px(pts[pts.length - 1][0]), CH); // Drop to bottom right
    const gradient = ctx.createLinearGradient(0, 0, 0, CH);
    gradient.addColorStop(0, "rgba(182, 255, 0, 0.15)");
    gradient.addColorStop(1, "rgba(182, 255, 0, 0.0)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // 2. Draw colored line segments
    ctx.lineWidth = 1.8;
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = pts[i][1] <= pts[i - 1][1] ? TOXIC : CRIMSON;
      ctx.beginPath(); ctx.moveTo(px(pts[i-1][0]), py(pts[i-1][1]));
      ctx.lineTo(px(pts[i][0]), py(pts[i][1])); ctx.stroke();
    }
  }, [pts, geo, sc]);

  const dot = useMemo(() => {
    if (!pts || !geo || !sc) return null;
    const xT = geo.x0 + Math.min(1, Math.max(0, progress)) * (geo.x1 - geo.x0);
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][0] < xT) i++;
    const [xa, ya] = pts[i], [xb, yb] = pts[i + 1] ?? pts[i];
    const t = xb > xa ? (xT - xa) / (xb - xa) : 0;
    return { left: CP + (xT - geo.x0) * sc.sx, top: CP + (ya + (yb - ya) * t - geo.y0) * sc.sy };
  }, [pts, geo, sc, progress]);

  return (
    <div className="relative overflow-hidden rounded-md" style={{ width: CW, height: CH, background: "rgba(10, 11, 14, 0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <canvas ref={ref} width={CW} height={CH} className="absolute inset-0" />
      {dot && (
        <span className="absolute rounded-full animate-pulse"
          style={{ width: 5, height: 5, background: TOXIC, boxShadow: `0 0 10px ${TOXIC}`, left: dot.left - 2.5, top: dot.top - 2.5 }} />
      )}
    </div>
  );
}

interface ScorePayload { total: number; timeMs: number; finished: boolean; }
interface MarketPayload { question: string; probNow: number; probDelta: number; }
interface ResultPayload { finished: boolean; score: number; timeMs: number; }

export default function HudOverlay() {
  const [speed, setSpeed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nitro, setNitro] = useState(1);
  const [crashFlash, setCrashFlash] = useState(false);
  const [prob, setProb] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [track, setTrack] = useState<TrackPts | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState<ScorePayload>({ total: 0, timeMs: 0, finished: false });
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [airborne, setAirborne] = useState(false);

  useEffect(() => {
    const offs = [
      bus.on<number>(EV.SPEED, setSpeed),
      bus.on<boolean>(EV.MUTE, setMuted),
      bus.on<number>(EV.NITRO, setNitro),
      bus.on<boolean>(EV.GROUNDED, (g) => setAirborne(!g)),
      bus.on<{ pts: TrackPts }>(EV.TRACK, (t) => { setTrack(t.pts); setProgress(0); }),
      bus.on<number>(EV.POSITION, setProgress),
      bus.on<MarketPayload | null>(EV.MARKET, (m) => { setMarket(m); if (!m) setTrack(null); }),
      bus.on<ScorePayload>(EV.SCORE, setScore),
      bus.on<ResultPayload>(EV.RESULT, setResult),
      bus.on<number>(EV.PROB, setProb),
    ];
    let ct = 0;
    const offCrash = bus.on<void>(EV.CRASH, () => {
      setCrashFlash(true); window.clearTimeout(ct);
      ct = window.setTimeout(() => setCrashFlash(false), 900);
    });

    return () => { offs.forEach(f => f()); offCrash(); window.clearTimeout(ct); };
  }, []);

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaAbs = Math.abs((market?.probDelta ?? 0) * 100).toFixed(1);
  const probPct = prob === null ? null : prob * 100;
  const fullQuestion = market?.question ?? "LOADING LIVE POLYMARKET DATA...";

  const toggleMute = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyM" }));
  }, []);

  const rideAgain = useCallback(() => {
    setResult(null);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" }));
  }, []);

  const timeObj = fmtTime(score.timeMs);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono p-8">

      {/* ── TOP-LEFT: UNIFIED MARKET & SCORE DASHBOARD ── */}
      <div className="absolute top-8 left-8 flex flex-col gap-3 pointer-events-none max-w-sm">
        
        {/* Market Module */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 opacity-50">
            <span className="font-display font-black text-xs tracking-widest text-ink">
              Odds<span style={{ color: TOXIC }}>Rider</span>
            </span>
          </div>
          
          <span className="font-medium text-[11px] leading-relaxed text-ink/80 drop-shadow-md">
            {fullQuestion}
          </span>
          
          <div className="flex items-baseline gap-2 mt-1">
            <span style={{
              fontSize: 32, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em",
              color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
            }}>
              {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
            </span>
            <span style={{ fontSize: 9, letterSpacing: "0.2em", fontWeight: 800, color: INK }}>YES</span>
            
            {market && (
              <span className="font-extrabold text-[10px] ml-2" style={{ color: deltaUp ? TOXIC : CRIMSON }}>
                {deltaUp ? "▲" : "▼"} {deltaAbs}%
              </span>
            )}
          </div>
        </div>

        {/* Telemetry Module (Tight grouping right below market) */}
        <div className="flex items-center gap-8 mt-3 opacity-90">
          <div className="flex flex-col">
            <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, fontWeight: 800 }}>SPEED</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span style={{ fontSize: 22, fontWeight: 900, color: INK, lineHeight: 1 }}>
                {speed.toString().padStart(3, "0")}
              </span>
              <span style={{ fontSize: 8, color: DIM, fontWeight: 700 }}>KM/H</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, fontWeight: 800 }}>SCORE</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: INK, lineHeight: 1, mt: 0.5 }}>
              {score.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── TOP-CENTER: ARCADE HUB (TIMER + NITRO) ── */}
      <div className="absolute top-8 left-1/2 flex flex-col items-center pointer-events-none" style={{ transform: "translateX(-50%)" }}>
        <div className="flex items-baseline drop-shadow-lg">
          <span style={{ fontSize: 48, fontWeight: 900, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>{timeObj.main}</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: TOXIC, lineHeight: 1 }}>{timeObj.ms}</span>
        </div>
        
        {/* Segmented Nitro Bar directly glued under the timer (like StonkRider) */}
        <div className="w-full flex items-center gap-0.5 mt-2 bg-[#0a0a0b]/80 p-0.5 rounded-sm" style={{ height: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const isFilled = nitro >= (i + 1) * 0.2 - 0.15;
            return (
              <div key={i} className="flex-1 h-full rounded-xs transition-colors"
                   style={{ background: isFilled ? TOXIC : "transparent" }} />
            );
          })}
        </div>
      </div>

      {/* ── TOP-RIGHT: TACTICAL MINIMAP ── */}
      <div className="absolute top-8 right-8 flex flex-col items-end gap-3 pointer-events-none">
        <MiniChart pts={track} progress={progress} />
        <button
          className="pointer-events-auto cursor-pointer flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
          onClick={toggleMute}
        >
          <span style={{ fontSize: 10, color: muted ? CRIMSON : TOXIC }}>{muted ? "✕" : "🔊"}</span>
          <span style={{ fontSize: 7, letterSpacing: "0.2em", fontWeight: 700, color: muted ? CRIMSON : DIM }}>
            {muted ? "MUTED" : "AUDIO ON"}
          </span>
        </button>
      </div>

      {/* ── BOTTOM-RIGHT: CONTROLS GRID (Subtle & Dim) ── */}
      {/* Moved out of the center void to prevent text collisions and keep the track view clean */}
      <div className="absolute bottom-8 right-8 pointer-events-none p-3 rounded-md" style={{
        background: "rgba(10, 11, 14, 0.4)",
        border: "1px solid rgba(255,255,255,0.03)",
        backdropFilter: "blur(4px)"
      }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            { key: "W / ↑", label: "GAS" },
            { key: "SHIFT", label: "NITRO" },
            { key: "S / ↓", label: "BRAKE" },
            { key: "SPACE", label: "JUMP" },
            { key: "A / D", label: "LEAN" },
            { key: "R", label: "RESET" }
          ].map(({ key, label }) => (
            <div key={label} className="flex items-center gap-2 opacity-60">
              <div className="px-1.5 py-0.5 rounded-xs" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: INK }}>{key}</span>
              </div>
              <span style={{ fontSize: 7, color: DIM, letterSpacing: "0.1em" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Crash Vignette Flash */}
      <div className="absolute inset-0 pointer-events-none transition-all duration-150" style={{
        border: crashFlash ? `4px solid ${CRIMSON}` : "0px solid transparent",
        boxShadow: crashFlash ? `inset 0 0 80px ${CRIMSON}` : "none",
        opacity: crashFlash ? 0.8 : 0,
      }} />

      <ResultModal
        isOpen={Boolean(result)}
        result={result ? {
          finished: result.finished, score: result.score, timeMs: result.timeMs,
          marketQuestion: market?.question, finalProb: prob ?? undefined,
        } : null}
        onRetry={rideAgain}
      />

    </div>
  );
}
