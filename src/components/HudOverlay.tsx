import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const LINE = "#232529";
const BG_CARD = "#101113";
const DIM = "#7c7f86";
const INK = "#e8e8ea";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 110, CH = 34, CP = 2;

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
    <div className="relative" style={{ width: CW, height: CH }}>
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

    const handleKeyDown = (e: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };
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
  const question = market
    ? market.question.length > 56 ? market.question.slice(0, 56) + "..." : market.question
    : "LOADING MARKET DATA...";

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

  const isGasPressed = activeKeys.has("KeyW") || activeKeys.has("ArrowUp");
  const isBrakePressed = activeKeys.has("KeyS") || activeKeys.has("ArrowDown");
  const isLeanPressed = activeKeys.has("KeyA") || activeKeys.has("KeyD") || activeKeys.has("ArrowLeft") || activeKeys.has("ArrowRight");
  const isJumpPressed = activeKeys.has("Space");
  const isResetPressed = activeKeys.has("KeyR");

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono p-5">

      {/* ── TOP-LEFT: BRAND & MARKET CONTEXT STACK ──────────────────── */}
      <div className="absolute top-5 left-5 flex flex-col gap-1 max-w-xl">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-xl tracking-wider" style={{ textShadow: `0 0 12px ${TOXIC}50` }}>
            <span style={{ color: TOXIC }}>Odds</span><span style={{ color: INK }}>Rider</span>
          </span>
          <span className="text-[9px] font-extrabold tracking-widest px-1.5 py-0.5" style={{ color: TOXIC, background: "rgba(182,255,0,0.1)", border: `1px solid ${TOXIC}30` }}>
            LIVE
          </span>
        </div>

        <span className="font-medium text-xs truncate mt-0.5" style={{ color: INK, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
          {question}
        </span>

        <div className="flex items-center gap-2 mt-0.5">
          <span style={{
            fontSize: 24, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em",
            color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
            textShadow: probPct === null ? "none" : deltaUp ? `0 0 12px ${TOXIC}60` : `0 0 12px ${CRIMSON}60`,
          }}>
            {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
          </span>
          <span style={{ fontSize: 10, letterSpacing: "0.15em", fontWeight: 800, color: INK }}>YES</span>

          {market && (
            <span className="font-extrabold text-[9px] px-1.5 py-0.5" style={{
              color: deltaUp ? TOXIC : CRIMSON,
              background: deltaUp ? "rgba(182,255,0,0.12)" : "rgba(255,51,85,0.12)",
              border: `1px solid ${deltaUp ? TOXIC : CRIMSON}40`,
            }}>
              {deltaUp ? "▲" : "▼"} {deltaAbs}%
            </span>
          )}
        </div>
      </div>

      {/* ── TOP-CENTER: RACE TIMER & NITRO BAR COMBO (STONKRIDER STYLE) ── */}
      <div className="absolute top-5 left-1/2 flex flex-col items-center gap-1" style={{ transform: "translateX(-50%)" }}>
        <div className="flex items-baseline px-4 py-1" style={{ background: BG_CARD, border: `1px solid ${LINE}` }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>
            {timeObj.main}
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, color: TOXIC, lineHeight: 1 }}>
            {timeObj.ms}
          </span>
        </div>

        {/* Nitro bar stacked directly under timer */}
        <div className="flex items-center gap-1 px-3 py-1" style={{ background: BG_CARD, border: `1px solid ${LINE}`, minWidth: 140 }}>
          <span style={{ fontSize: 7, letterSpacing: "0.15em", color: isNitroActive ? TOXIC : DIM, fontWeight: 800 }}>
            NITRO
          </span>
          <div className="flex items-center gap-1 flex-1 h-1.5 ml-1">
            {[0, 1, 2, 3, 4].map((i) => {
              const isFilled = nitro >= (i + 1) * 0.2 - 0.15;
              return (
                <div
                  key={i}
                  className="flex-1 h-full transition-all duration-150"
                  style={{
                    background: isFilled ? (nitro > 0.6 ? TOXIC : "#7ca800") : "rgba(255,255,255,0.08)",
                    boxShadow: isFilled && isNitroActive ? `0 0 6px ${TOXIC}` : "none",
                  }}
                />
              );
            })}
          </div>
        </div>

        {airborne && (
          <span className="text-[8px] font-extrabold tracking-widest text-toxic animate-pulse mt-0.5">
            AIRBORNE
          </span>
        )}
      </div>

      {/* ── TOP-RIGHT: MINIMAP BOX & AUDIO BUTTON ───────────────────── */}
      <div className="absolute top-5 right-5 flex flex-col items-end gap-2">
        <div style={{ background: BG_CARD, border: `1px solid ${LINE}`, padding: 4 }}>
          <MiniChart pts={track} progress={progress} />
        </div>

        <button
          className="pointer-events-auto cursor-pointer px-2 py-1 flex items-center gap-1.5 transition-colors"
          onClick={toggleMute}
          style={{ background: BG_CARD, border: `1px solid ${LINE}` }}
        >
          <span style={{ fontSize: 10, color: muted ? CRIMSON : TOXIC }}>{muted ? "✕" : "🔊"}</span>
          <span style={{ fontSize: 8, letterSpacing: "0.15em", fontWeight: 700, color: muted ? CRIMSON : DIM }}>
            {muted ? "MUTED" : "AUDIO"}
          </span>
        </button>
      </div>

      {/* ── BOTTOM-LEFT: TELEMETRY CARDS (ORNN-RIDER STYLE) ─────────── */}
      <div className="absolute bottom-5 left-5 flex items-center gap-2">
        {/* Speed Card */}
        <div className="flex flex-col px-3 py-2" style={{ background: BG_CARD, border: `1px solid ${LINE}`, minWidth: 90 }}>
          <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>SPEED</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span style={{
              fontSize: 20, fontWeight: 800, lineHeight: 1,
              color: speed > 100 ? TOXIC : speed > 60 ? "#d2f060" : INK,
            }}>
              {speed}
            </span>
            <span style={{ fontSize: 7, color: DIM, fontWeight: 700 }}>km/h</span>
          </div>
        </div>

        {/* Score Card */}
        <div className="flex flex-col px-3 py-2" style={{ background: BG_CARD, border: `1px solid ${LINE}`, minWidth: 100 }}>
          <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>SCORE</span>
          <span style={{
            fontSize: 20, fontWeight: 800, lineHeight: 1, marginTop: 2,
            color: score.total > 500 ? TOXIC : score.total > 200 ? "#d2f060" : INK,
          }}>
            {score.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── BOTTOM-RIGHT: CONTROLS LEGEND CARD ──────────────────────── */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-1 px-3 py-2" style={{ background: BG_CARD, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-extrabold border" style={{
              background: isGasPressed ? "rgba(182,255,0,0.2)" : "#16181e",
              borderColor: isGasPressed ? TOXIC : "#232630",
              color: isGasPressed ? TOXIC : INK,
            }}>W / ↑</span>
            <span style={{ fontSize: 7, color: DIM }}>gas</span>
          </span>

          <span className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-extrabold border" style={{
              background: isBrakePressed ? "rgba(182,255,0,0.2)" : "#16181e",
              borderColor: isBrakePressed ? TOXIC : "#232630",
              color: isBrakePressed ? TOXIC : INK,
            }}>S / ↓</span>
            <span style={{ fontSize: 7, color: DIM }}>brake</span>
          </span>

          <span className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-extrabold border" style={{
              background: isLeanPressed ? "rgba(182,255,0,0.2)" : "#16181e",
              borderColor: isLeanPressed ? TOXIC : "#232630",
              color: isLeanPressed ? TOXIC : INK,
            }}>A / D</span>
            <span style={{ fontSize: 7, color: DIM }}>lean</span>
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-extrabold border" style={{
              background: isJumpPressed ? "rgba(182,255,0,0.2)" : "#16181e",
              borderColor: isJumpPressed ? TOXIC : "#232630",
              color: isJumpPressed ? TOXIC : INK,
            }}>Space</span>
            <span style={{ fontSize: 7, color: DIM }}>jump</span>
          </span>

          <span className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-extrabold border" style={{
              background: isNitroActive ? "rgba(182,255,0,0.2)" : "#16181e",
              borderColor: isNitroActive ? TOXIC : "#232630",
              color: isNitroActive ? TOXIC : INK,
            }}>Shift</span>
            <span style={{ fontSize: 7, color: DIM }}>nitro</span>
          </span>

          <span className="flex items-center gap-1">
            <span className="px-1 py-0.5 text-[8px] font-extrabold border" style={{
              background: isResetPressed ? "rgba(182,255,0,0.2)" : "#16181e",
              borderColor: isResetPressed ? TOXIC : "#232630",
              color: isResetPressed ? TOXIC : INK,
            }}>R</span>
            <span style={{ fontSize: 7, color: DIM }}>reset</span>
          </span>
        </div>
      </div>

      {/* Crash Vignette Flash */}
      <div className="absolute inset-0 pointer-events-none" style={{
        border: `4px solid ${CRIMSON}`, opacity: crashFlash ? 0.8 : 0,
        boxShadow: crashFlash ? `inset 0 0 50px ${CRIMSON}` : "none",
        transition: "all 0.15s",
      }} />

      {/* Result modal */}
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
