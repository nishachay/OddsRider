import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const DIM = "#6e727d";
const INK = "#f0f0f2";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 110, CH = 32, CP = 2;

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
  const [showHints, setShowHints] = useState(true);

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

    const offFirst = bus.on<void>(EV.INPUT_FIRST, () => {
      window.setTimeout(() => setShowHints(false), 2500);
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
      offs.forEach(f => f()); offCrash(); offFirst(); window.clearTimeout(ct);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaAbs = Math.abs((market?.probDelta ?? 0) * 100).toFixed(1);
  const probPct = prob === null ? null : prob * 100;
  const question = market
    ? market.question.length > 52 ? market.question.slice(0, 52) + "..." : market.question
    : "FETCHING LIVE POLYMARKET DATA...";

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

  const speedGauge = Math.min(100, Math.round((speed / 180) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono p-6 flex flex-col justify-between">

      {/* ── TOP HEADER: Single Clean Baseline (Brand + Market + Ticker) ── */}
      <div className="flex items-center justify-between w-full">

        {/* Top-Left: Brand + Live Market Question */}
        <div className="flex items-center gap-3 max-w-2xl">
          <span className="font-display font-black text-lg tracking-wider shrink-0" style={{ textShadow: `0 0 12px ${TOXIC}40` }}>
            <span style={{ color: TOXIC }}>Odds</span><span style={{ color: INK }}>Rider</span>
          </span>

          <span className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 shrink-0" style={{ color: TOXIC, background: "rgba(182,255,0,0.1)" }}>
            LIVE
          </span>

          <span className="font-medium text-xs truncate" style={{ color: INK, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
            {question}
          </span>

          {market && (
            <span className="shrink-0 font-extrabold text-[9px] px-1.5 py-0.5" style={{
              color: deltaUp ? TOXIC : CRIMSON,
              background: deltaUp ? "rgba(182,255,0,0.1)" : "rgba(255,51,85,0.1)",
            }}>
              {deltaUp ? "▲" : "▼"} {deltaAbs}%
            </span>
          )}
        </div>

        {/* Top-Right: Hero Odds + Mini-Chart */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-baseline gap-1.5">
            <span style={{ fontSize: 9, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>PROBABILITY</span>
            <span style={{
              fontSize: 26, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em",
              color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
              textShadow: probPct === null ? "none" : deltaUp ? `0 0 14px ${TOXIC}60` : `0 0 14px ${CRIMSON}60`,
            }}>
              {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
            </span>
            <span style={{ fontSize: 9, letterSpacing: "0.1em", fontWeight: 800, color: INK }}>YES</span>
          </div>

          <MiniChart pts={track} progress={progress} />
        </div>

      </div>

      {/* ── BOTTOM HUD: Clean Telemetry Cluster & Controls Below ── */}
      <div className="flex flex-col gap-3 w-full">

        <div className="flex items-end justify-between w-full">

          {/* Bottom-Left: Speed & Nitro Grouped */}
          <div className="flex items-end gap-5">
            {/* Speedometer */}
            <div className="flex flex-col">
              <span style={{ fontSize: 8, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>SPEED</span>
              <div className="flex items-baseline gap-1">
                <span style={{
                  fontSize: 28, fontWeight: 800, lineHeight: 1,
                  color: speed > 100 ? TOXIC : speed > 60 ? "#d2f060" : INK,
                  textShadow: speed > 100 ? `0 0 12px ${TOXIC}80` : "0 2px 6px rgba(0,0,0,0.8)",
                }}>
                  {speed.toString().padStart(3, "0")}
                </span>
                <span style={{ fontSize: 8, color: DIM, fontWeight: 700 }}>KM/H</span>
              </div>
              <div className="w-20 bg-[#16181d] h-1 mt-1">
                <div className="h-full transition-all duration-100" style={{
                  width: `${speedGauge}%`, background: speed > 100 ? TOXIC : "#7ca800",
                }} />
              </div>
            </div>

            {/* Nitro Gauge */}
            <div className="flex flex-col gap-1 w-28 pb-0.5">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 8, letterSpacing: "0.15em", color: isNitroActive ? TOXIC : DIM, fontWeight: 700 }}>
                  {isNitroActive ? "⚡ NITRO" : "NITRO"}
                </span>
                <span style={{ fontSize: 8, fontWeight: 800, color: nitro <= 0.04 ? CRIMSON : nitro > 0.9 ? TOXIC : INK }}>
                  {Math.round(nitro * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1 h-1.5">
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
          </div>

          {/* Bottom-Center: Clean Race Time Anchor */}
          <div className="flex flex-col items-center">
            {airborne && (
              <span className="mb-0.5 text-[8px] font-extrabold tracking-widest text-toxic animate-pulse">
                AIRBORNE
              </span>
            )}
            <span style={{ fontSize: 8, letterSpacing: "0.3em", color: DIM, fontWeight: 700 }}>TIME</span>
            <div className="flex items-baseline">
              <span style={{ fontSize: 32, fontWeight: 800, color: INK, lineHeight: 1, textShadow: "0 4px 10px rgba(0,0,0,0.9)" }}>
                {timeObj.main}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: TOXIC, lineHeight: 1 }}>
                {timeObj.ms}
              </span>
            </div>
          </div>

          {/* Bottom-Right: Score & Audio */}
          <div className="flex items-end gap-5">
            <div className="flex flex-col items-end">
              <span style={{ fontSize: 8, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>SCORE</span>
              <span style={{
                fontSize: 26, fontWeight: 800, lineHeight: 1,
                color: score.total > 500 ? TOXIC : score.total > 200 ? "#d2f060" : INK,
                textShadow: score.total > 500 ? `0 0 10px ${TOXIC}60` : "0 2px 6px rgba(0,0,0,0.8)",
              }}>
                {score.total.toString().padStart(6, "0")}
              </span>
            </div>

            <button
              className="pointer-events-auto cursor-pointer pb-0.5 text-right opacity-75 hover:opacity-100 transition-opacity"
              onClick={toggleMute}
            >
              <span style={{ fontSize: 8, letterSpacing: "0.15em", fontWeight: 700, color: muted ? CRIMSON : TOXIC }}>
                {muted ? "MUTED" : "AUDIO ON"}
              </span>
            </button>
          </div>

        </div>

        {/* ── CONTROLS HINTS BAR: Placed at VERY BOTTOM, Fades Out on Drive ── */}
        <div className="flex items-center justify-center gap-1.5 pt-1 transition-opacity duration-700" style={{
          opacity: showHints ? 0.9 : 0.2,
          pointerEvents: "none",
        }}>
          {[
            { key: "W / ↑", label: "GAS", active: isGasPressed },
            { key: "S / ↓", label: "BRAKE", active: isBrakePressed },
            { key: "A / D", label: "LEAN", active: isLeanPressed },
            { key: "SPACE", label: "JUMP", active: isJumpPressed },
            { key: "SHIFT", label: "NITRO", active: isNitroActive },
            { key: "R", label: "RESET", active: isResetPressed },
          ].map(({ key, label, active }) => (
            <div key={label} className="flex items-center gap-1 px-1.5 py-0.5 transition-all duration-100" style={{
              background: active ? "rgba(182,255,0,0.2)" : "rgba(12,13,16,0.6)",
              borderBottom: `2px solid ${active ? TOXIC : "rgba(255,255,255,0.1)"}`,
            }}>
              <span style={{ fontSize: 8, fontWeight: 800, color: active ? TOXIC : INK }}>{key}</span>
              <span style={{ fontSize: 6, color: active ? TOXIC : DIM, letterSpacing: "0.08em" }}>{label}</span>
            </div>
          ))}
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
