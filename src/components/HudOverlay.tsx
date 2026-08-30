import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const DIM = "#6b7280";
const SUBTLE = "#9ca3af";
const INK = "#f3f4f6";
const LINE = "#1f242d";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 120, CH = 30, CP = 2;

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

    // Area fill under track line
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), CH);
    ctx.lineTo(px(pts[0][0]), py(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
    }
    ctx.lineTo(px(pts[pts.length - 1][0]), CH);
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, "rgba(182, 255, 0, 0.16)");
    grad.addColorStop(1, "rgba(182, 255, 0, 0.0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Colored line segments
    ctx.lineWidth = 1.6;
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
    <div className="relative overflow-hidden" style={{ width: CW, height: CH }}>
      <canvas ref={ref} width={CW} height={CH} className="absolute inset-0" />
      {dot && (
        <span className="absolute rounded-full animate-pulse"
          style={{ width: 4, height: 4, background: TOXIC, boxShadow: `0 0 6px ${TOXIC}`, left: dot.left - 2, top: dot.top - 2 }} />
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
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

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

    const handleKeyDown = (e: KeyboardEvent) => setActiveKeys((prev) => new Set(prev).add(e.code));
    const handleKeyUp = (e: KeyboardEvent) => setActiveKeys((prev) => {
      const next = new Set(prev); next.delete(e.code); return next;
    });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      offs.forEach(f => f()); offCrash(); window.clearTimeout(ct);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
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
  const isNitroActive = activeKeys.has("ShiftLeft") || activeKeys.has("ShiftRight") || activeKeys.has("KeyN");

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono p-6 sm:p-8 flex flex-col justify-between">

      {/* ── TOP DECK ── */}
      <div className="flex items-start justify-between w-full">
        
        {/* Brand: Pure, Minimalist, Confident */}
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-sm sm:text-base tracking-[0.2em] text-ink uppercase">
            Odds<span style={{ color: TOXIC }}>Rider</span>
          </span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: TOXIC, boxShadow: `0 0 6px ${TOXIC}` }} />
        </div>

        {/* Center: Precision Race Clock (Undisputed focal point, zero label clutter) */}
        <div className="flex flex-col items-center -mt-1">
          <div className="flex items-baseline tracking-tight font-mono">
            <span style={{ fontSize: 40, fontWeight: 900, color: INK, lineHeight: 1 }}>
              {timeObj.main}
            </span>
            <span style={{ fontSize: 20, fontWeight: 900, color: TOXIC, lineHeight: 1 }}>
              {timeObj.ms}
            </span>
          </div>
          {airborne && (
            <span className="text-[8px] font-extrabold tracking-[0.2em] text-toxic animate-pulse mt-0.5" style={{ textShadow: `0 0 8px ${TOXIC}` }}>
              AIRBORNE
            </span>
          )}
        </div>

        {/* Top-Right: Sparkline Chart & Audio Button */}
        <div className="flex items-center gap-2.5">
          <MiniChart pts={track} progress={progress} />
          <button
            className="pointer-events-auto cursor-pointer p-1.5 rounded-[1px] opacity-60 hover:opacity-100 transition-opacity"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${LINE}` }}
            onClick={toggleMute}
            title={muted ? "Unmute" : "Mute"}
          >
            <span style={{ fontSize: 9, color: muted ? CRIMSON : SUBTLE }}>{muted ? "✕" : "🔊"}</span>
          </button>
        </div>

      </div>


      {/* ── BOTTOM DECK ── */}
      <div className="flex items-end justify-between w-full">

        {/* Left: Cockpit Cluster */}
        <div className="flex flex-col gap-2.5 max-w-sm">
          
          {/* Speed & Score Duo */}
          <div className="flex items-baseline gap-6 font-mono">
            <div className="flex items-baseline gap-1">
              <span style={{
                fontSize: 32, fontWeight: 900, lineHeight: 1,
                color: speed > 100 ? TOXIC : INK,
                textShadow: speed > 100 ? `0 0 12px ${TOXIC}80` : "none",
              }}>
                {speed.toString().padStart(3, "0")}
              </span>
              <span style={{ fontSize: 9, color: DIM, fontWeight: 800, letterSpacing: "0.05em" }}>KM/H</span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span style={{ fontSize: 8, letterSpacing: "0.2em", color: DIM, fontWeight: 800 }}>PTS</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: INK, lineHeight: 1 }}>
                {score.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Nitro Battery Gauge */}
          <div className="flex items-center gap-2">
            <span style={{
              fontSize: 8, letterSpacing: "0.2em", fontWeight: 800,
              color: isNitroActive ? TOXIC : DIM,
            }}>
              NITRO
            </span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => {
                const isFilled = nitro >= (i + 1) * 0.2 - 0.15;
                return (
                  <div
                    key={i}
                    className="w-6 h-1.5 rounded-[1px] transition-all duration-100"
                    style={{
                      background: isFilled ? TOXIC : "#181a20",
                      boxShadow: isFilled && isNitroActive ? `0 0 8px ${TOXIC}` : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Micro Keycaps Legend */}
          <div className="flex items-center gap-2 pt-0.5 font-mono">
            {[
              { key: "W", label: "GAS" },
              { key: "S", label: "BRAKE" },
              { key: "A/D", label: "LEAN" },
              { key: "SPACE", label: "JUMP" },
              { key: "SHIFT", label: "NITRO" },
              { key: "R", label: "RESET" },
            ].map(({ key, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className="px-1 py-0.5 rounded-[1px] text-[7.5px] font-bold text-subtle" 
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #232529" }}>
                  {key}
                </span>
                <span className="text-[7px] text-[#555a66] font-bold tracking-wider">
                  {label}
                </span>
              </span>
            ))}
          </div>

        </div>


        {/* Right: Polymarket Outcome Readout */}
        <div className="flex flex-col items-end gap-1.5 max-w-md text-right pl-6" 
             style={{ borderRight: `2px solid ${deltaUp ? TOXIC : CRIMSON}`, paddingRight: 10 }}>
          
          {/* Full Question with clean typography */}
          <span className="font-medium text-xs leading-snug text-ink/90 font-mono tracking-tight">
            {fullQuestion}
          </span>

          {/* Hero Probability Block */}
          <div className="flex items-baseline gap-2 mt-0.5 font-mono">
            <span style={{
              fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em",
              color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
              textShadow: probPct === null ? "none" : deltaUp ? `0 0 16px ${TOXIC}60` : `0 0 16px ${CRIMSON}60`,
            }}>
              {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
            </span>
            
            <span style={{ fontSize: 10, letterSpacing: "0.15em", fontWeight: 800, color: INK }}>
              YES
            </span>

            {market && (
              <span className="text-[9.5px] font-extrabold ml-1 px-1.5 py-0.5 rounded-[1px]" style={{
                color: deltaUp ? TOXIC : CRIMSON,
                background: deltaUp ? "rgba(182,255,0,0.08)" : "rgba(255,51,85,0.08)",
                border: `1px solid ${deltaUp ? TOXIC : CRIMSON}30`,
              }}>
                {deltaUp ? "▲" : "▼"} {deltaAbs}%
              </span>
            )}
          </div>

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
