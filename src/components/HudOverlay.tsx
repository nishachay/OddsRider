import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const DIM = "#6b7280";
const SUBTLE = "#9ca3af";
const INK = "#f3f4f6";
const HAIRLINE = "#1f242d";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 130, CH = 38, CP = 3;

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

    // Subtle tactical horizontal gridline
    ctx.strokeStyle = "#161922";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CH / 2); ctx.lineTo(CW, CH / 2);
    ctx.stroke();

    // Area fill under track line
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), CH);
    ctx.lineTo(px(pts[0][0]), py(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
    }
    ctx.lineTo(px(pts[pts.length - 1][0]), CH);
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, "rgba(182, 255, 0, 0.12)");
    grad.addColorStop(1, "rgba(182, 255, 0, 0.0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Track line segments with color-coding
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
    <div className="relative overflow-hidden" style={{ width: CW, height: CH, borderBottom: `1px solid ${HAIRLINE}` }}>
      <canvas ref={ref} width={CW} height={CH} className="absolute inset-0" />
      {dot && (
        <span className="absolute rounded-full animate-pulse"
          style={{ width: 5, height: 5, background: TOXIC, boxShadow: `0 0 8px ${TOXIC}`, left: dot.left - 2.5, top: dot.top - 2.5 }} />
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

      {/* ── TOP DECK: STATUS, RACE TIMER & TACTICAL SPARKLINE ── */}
      <div className="flex items-start justify-between w-full">
        
        {/* Top-Left: Brand & Protocol Telemetry */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-sm tracking-[0.2em] text-ink uppercase">
              Odds<span style={{ color: TOXIC }}>Rider</span>
            </span>
            <span className="text-[8px] font-extrabold tracking-[0.2em] px-1.5 py-0.5 rounded-xs" 
                  style={{ color: TOXIC, background: "rgba(182,255,0,0.08)", border: `1px solid rgba(182,255,0,0.25)` }}>
              LIVE PROBABILITY
            </span>
          </div>
          <span className="text-[8px] tracking-[0.18em] text-[#555a66] font-bold">
            POLYMARKET CLOB PROTOCOL
          </span>
        </div>

        {/* Top-Center: Precision Racing Clock */}
        <div className="flex flex-col items-center">
          <div className="flex items-baseline tracking-tight">
            <span style={{ fontSize: 44, fontWeight: 900, color: INK, lineHeight: 1 }}>
              {timeObj.main}
            </span>
            <span style={{ fontSize: 22, fontWeight: 900, color: TOXIC, lineHeight: 1 }}>
              {timeObj.ms}
            </span>
          </div>
          <span style={{ fontSize: 8, letterSpacing: "0.25em", color: DIM, fontWeight: 800, marginTop: 2 }}>
            SESSION TIME
          </span>
          {airborne && (
            <span className="text-[8px] font-extrabold tracking-[0.2em] text-toxic animate-pulse mt-1" style={{ textShadow: `0 0 8px ${TOXIC}` }}>
              ▲ AIRBORNE
            </span>
          )}
        </div>

        {/* Top-Right: Sparkline Minimap & Controls */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 8, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>CHART SPARKLINE</span>
            <button
              className="pointer-events-auto cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
              onClick={toggleMute}
            >
              <span style={{ fontSize: 9, color: muted ? CRIMSON : TOXIC }}>{muted ? "✕" : "🔊"}</span>
              <span style={{ fontSize: 7, letterSpacing: "0.15em", fontWeight: 700, color: muted ? CRIMSON : SUBTLE }}>
                {muted ? "MUTED" : "M"}
              </span>
            </button>
          </div>
          <MiniChart pts={track} progress={progress} />
        </div>

      </div>


      {/* ── BOTTOM DECK: COCKPIT TELEMETRY & LIVE PREDICTION ENGINE ── */}
      <div className="flex items-end justify-between w-full pt-6">

        {/* Bottom-Left: Vehicle Cockpit Dashboard */}
        <div className="flex flex-col gap-3 max-w-xs">
          
          {/* Speed & Score Duo */}
          <div className="flex items-end gap-6">
            <div className="flex flex-col">
              <span style={{ fontSize: 8, letterSpacing: "0.25em", color: DIM, fontWeight: 800 }}>VELOCITY</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span style={{
                  fontSize: 34, fontWeight: 900, lineHeight: 1,
                  color: speed > 100 ? TOXIC : speed > 60 ? "#d2f060" : INK,
                  textShadow: speed > 100 ? `0 0 12px ${TOXIC}70` : "none",
                }}>
                  {speed.toString().padStart(3, "0")}
                </span>
                <span style={{ fontSize: 9, color: DIM, fontWeight: 800 }}>KM/H</span>
              </div>
            </div>

            <div className="flex flex-col pb-0.5">
              <span style={{ fontSize: 8, letterSpacing: "0.25em", color: DIM, fontWeight: 800 }}>SCORE</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: INK, lineHeight: 1, marginTop: 4 }}>
                {score.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Nitro Fuel Cell Meter */}
          <div className="flex flex-col gap-1 w-44">
            <div className="flex items-center justify-between">
              <span style={{
                fontSize: 8, letterSpacing: "0.2em", fontWeight: 800,
                color: isNitroActive ? TOXIC : DIM,
              }}>
                {isNitroActive ? "⚡ NITRO BOOST" : "NITRO RESERVE"}
              </span>
              <span style={{ fontSize: 8, color: DIM, fontWeight: 700 }}>
                {Math.round(nitro * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1 h-2">
              {[0, 1, 2, 3, 4].map((i) => {
                const isFilled = nitro >= (i + 1) * 0.2 - 0.15;
                return (
                  <div
                    key={i}
                    className="flex-1 h-full rounded-2xs transition-all duration-100"
                    style={{
                      background: isFilled ? TOXIC : "#171922",
                      boxShadow: isFilled && isNitroActive ? `0 0 8px ${TOXIC}` : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Micro Controls Footnote */}
          <div className="flex items-center gap-2.5 pt-1 text-[8px] text-[#555a66] font-bold">
            <span><strong className="text-subtle font-extrabold">W/↑</strong> GAS</span>
            <span><strong className="text-subtle font-extrabold">S/↓</strong> BRAKE</span>
            <span><strong className="text-subtle font-extrabold">A/D</strong> LEAN</span>
            <span><strong className="text-subtle font-extrabold">SPACE</strong> JUMP</span>
            <span><strong className="text-subtle font-extrabold">SHIFT</strong> NITRO</span>
            <span><strong className="text-subtle font-extrabold">R</strong> RESET</span>
          </div>

        </div>


        {/* Bottom-Right: Live Polymarket Outcome Engine */}
        <div className="flex flex-col items-end gap-1.5 max-w-lg text-right pl-6" 
             style={{ borderRight: `2px solid ${deltaUp ? TOXIC : CRIMSON}`, paddingRight: 10 }}>
          
          <span style={{ fontSize: 8, letterSpacing: "0.25em", color: DIM, fontWeight: 800 }}>
            CURRENT MARKET CONTRACT
          </span>

          {/* Full Question Text with deliberate typesetting */}
          <span className="font-medium text-xs leading-relaxed text-ink/90">
            {fullQuestion}
          </span>

          {/* Probability Hero Block */}
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <span style={{
              fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em",
              color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
              textShadow: probPct === null ? "none" : deltaUp ? `0 0 16px ${TOXIC}60` : `0 0 16px ${CRIMSON}60`,
            }}>
              {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
            </span>
            
            <span style={{ fontSize: 11, letterSpacing: "0.15em", fontWeight: 800, color: INK }}>
              YES
            </span>

            {market && (
              <span className="text-[10px] font-extrabold ml-1 px-1.5 py-0.5 rounded-xs" style={{
                color: deltaUp ? TOXIC : CRIMSON,
                background: deltaUp ? "rgba(182,255,0,0.1)" : "rgba(255,51,85,0.1)",
                border: `1px solid ${deltaUp ? TOXIC : CRIMSON}40`,
              }}>
                {deltaUp ? "▲" : "▼"} {deltaAbs}% 24H
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
