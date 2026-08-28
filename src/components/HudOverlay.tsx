import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const LINE = "#232529";
const BG = "rgba(10,10,11,0.97)";
const DIM = "#7c7f86";
const INK = "#f0f0f2";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 136, CH = 42, CP = 4;

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

    // Draw dark grid lines on minimap
    ctx.strokeStyle = "#16181c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CH / 2); ctx.lineTo(CW, CH / 2);
    ctx.moveTo(CW / 2, 0); ctx.lineTo(CW / 2, CH);
    ctx.stroke();

    // Draw track line
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
    <div className="relative" style={{ width: CW, height: CH, background: "#0c0d0e", border: "1px solid #1f2126" }}>
      <canvas ref={ref} width={CW} height={CH} className="absolute inset-0" />
      {/* Corner accents */}
      <span className="absolute top-0 left-0 w-1 h-1" style={{ borderTop: `1px solid ${TOXIC}`, borderLeft: `1px solid ${TOXIC}` }} />
      <span className="absolute bottom-0 right-0 w-1 h-1" style={{ borderBottom: `1px solid ${TOXIC}`, borderRight: `1px solid ${TOXIC}` }} />
      {dot && (
        <span className="absolute rounded-full"
          style={{ width: 6, height: 6, background: TOXIC, boxShadow: `0 0 8px ${TOXIC}`, left: dot.left - 3, top: dot.top - 3 }} />
      )}
    </div>
  );
}

interface ScorePayload { total: number; timeMs: number; finished: boolean; }
interface MarketPayload { question: string; probNow: number; probDelta: number; }
interface ResultPayload { finished: boolean; score: number; timeMs: number; }

const BAR = "1px solid " + LINE;

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
    : "CONNECTING POLYMARKET FEED...";

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

  // Keyboard helper check
  const isGasPressed = activeKeys.has("KeyW") || activeKeys.has("ArrowUp");
  const isBrakePressed = activeKeys.has("KeyS") || activeKeys.has("ArrowDown");
  const isLeanPressed = activeKeys.has("KeyA") || activeKeys.has("KeyD") || activeKeys.has("ArrowLeft") || activeKeys.has("ArrowRight");
  const isJumpPressed = activeKeys.has("Space");
  const isResetPressed = activeKeys.has("KeyR");
  const isMutePressed = activeKeys.has("KeyM");

  // Speedometer fill gauge (0 to 180 km/h)
  const speedGauge = Math.min(100, Math.round((speed / 180) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono">

      {/* ── SCREEN CORNER TACTICAL BRACKETS ──────────────────────────── */}
      <div className="absolute top-2 left-2 w-3 h-3 pointer-events-none" style={{ borderTop: `1px solid ${TOXIC}`, borderLeft: `1px solid ${TOXIC}`, opacity: 0.6 }} />
      <div className="absolute top-2 right-2 w-3 h-3 pointer-events-none" style={{ borderTop: `1px solid ${TOXIC}`, borderRight: `1px solid ${TOXIC}`, opacity: 0.6 }} />
      <div className="absolute bottom-2 left-2 w-3 h-3 pointer-events-none" style={{ borderBottom: `1px solid ${TOXIC}`, borderLeft: `1px solid ${TOXIC}`, opacity: 0.6 }} />
      <div className="absolute bottom-2 right-2 w-3 h-3 pointer-events-none" style={{ borderBottom: `1px solid ${TOXIC}`, borderRight: `1px solid ${TOXIC}`, opacity: 0.6 }} />

      {/* ── TOP BAR: Header & Market Hero ────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-stretch" style={{ height: 50, background: BG, borderBottom: BAR }}>

        {/* Wordmark */}
        <div className="flex items-center px-5 shrink-0 gap-2" style={{ borderRight: BAR }}>
          <span className="font-display font-bold" style={{ fontSize: 15, letterSpacing: "0.16em", fontStretch: "120%", textShadow: `0 0 10px ${TOXIC}40` }}>
            <span style={{ color: TOXIC }}>Odds</span><span style={{ color: INK }}>Rider</span>
          </span>
          <span className="px-1 py-0.5 text-[8px] font-bold tracking-widest bg-[#161b10] text-toxic border border-[#2a3a14] rounded-none">
            v2.0
          </span>
        </div>

        {/* Live market strip */}
        <div className="flex flex-1 items-center gap-3 px-4 min-w-0">
          <span className="flex items-center gap-1.5 shrink-0 px-2 py-0.5" style={{ background: "#111317", border: "1px solid #1f2229" }}>
            <span className="rounded-full animate-pulse" style={{ width: 6, height: 6, background: TOXIC, boxShadow: `0 0 6px ${TOXIC}` }} />
            <span style={{ fontSize: 8, letterSpacing: "0.25em", fontWeight: 700, color: "#a0a4b0" }}>POLYMARKET</span>
          </span>
          <span className="truncate font-medium" style={{ fontSize: 11, letterSpacing: "0.02em", color: INK }}>{question}</span>
          {market && (
            <span className="shrink-0 font-bold" style={{
              fontSize: 9, letterSpacing: "0.1em", padding: "2px 7px",
              background: deltaUp ? "rgba(182,255,0,0.12)" : "rgba(255,51,85,0.12)",
              border: `1px solid ${deltaUp ? "rgba(182,255,0,0.4)" : "rgba(255,51,85,0.4)"}`,
              color: deltaUp ? TOXIC : CRIMSON,
              boxShadow: deltaUp ? `0 0 8px ${TOXIC}20` : `0 0 8px ${CRIMSON}20`,
            }}>
              {deltaUp ? "▲" : "▼"} {deltaAbs}%
            </span>
          )}
        </div>

        {/* Hero Probability Readout */}
        <div className="flex items-center gap-2 px-5 shrink-0" style={{ borderLeft: BAR, background: "rgba(14,16,19,0.8)" }}>
          <div className="flex flex-col items-end">
            <span style={{ fontSize: 7, letterSpacing: "0.3em", color: DIM, fontWeight: 700 }}>PROBABILITY</span>
            <div className="flex items-baseline gap-1">
              <span style={{
                fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em",
                color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
                textShadow: probPct === null ? "none" : deltaUp ? `0 0 12px ${TOXIC}60` : `0 0 12px ${CRIMSON}60`,
              }}>
                {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
              </span>
              <span style={{ fontSize: 9, letterSpacing: "0.15em", fontWeight: 700, color: INK }}>YES</span>
            </div>
          </div>
        </div>

        {/* Mini chart */}
        <div className="flex items-center px-3 shrink-0" style={{ borderLeft: BAR }}>
          <MiniChart pts={track} progress={progress} />
        </div>
      </div>

      {/* ── BOTTOM BAR: Race Telemetry ──────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex items-stretch" style={{ height: 60, background: BG, borderTop: BAR }}>

        {/* Speedometer */}
        <div className="flex flex-col justify-center px-5 shrink-0" style={{ borderRight: BAR, minWidth: 120 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 7, letterSpacing: "0.3em", color: DIM, fontWeight: 700 }}>SPEED</span>
            <span style={{ fontSize: 7, color: DIM, fontWeight: 700 }}>KM/H</span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span style={{
              fontSize: 24, fontWeight: 700, lineHeight: 1,
              color: speed > 100 ? TOXIC : speed > 60 ? "#d2f060" : INK,
              textShadow: speed > 100 ? `0 0 10px ${TOXIC}80` : "none",
              transition: "color 0.2s",
            }}>
              {speed.toString().padStart(3, "0")}
            </span>
          </div>
          {/* Velocity bar */}
          <div className="w-full bg-[#181a1f] h-1 mt-1 overflow-hidden">
            <div className="h-full transition-all duration-100" style={{
              width: `${speedGauge}%`,
              background: speed > 100 ? TOXIC : "#7ca800",
              boxShadow: speed > 100 ? `0 0 6px ${TOXIC}` : "none",
            }} />
          </div>
        </div>

        {/* Nitro Battery Gauge */}
        <div className="flex flex-col justify-center gap-1 px-5 shrink-0" style={{
          borderRight: BAR, minWidth: 180,
          background: isNitroActive ? "rgba(182,255,0,0.04)" : "transparent",
          transition: "background 0.2s",
        }}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1" style={{ fontSize: 7, letterSpacing: "0.3em", color: DIM, fontWeight: 700 }}>
              <span>NITRO</span>
              {isNitroActive && <span className="text-[7px] text-toxic font-bold animate-pulse">⚡ OVERBOOST</span>}
            </span>
            <span style={{
              fontSize: 7, letterSpacing: "0.15em", fontWeight: 700,
              color: nitro <= 0.04 ? CRIMSON : nitro < 0.15 ? "#ff6633" : nitro > 0.9 ? TOXIC : DIM,
            }}>
              {nitro <= 0.04 ? "EMPTY" : nitro < 0.15 ? "LOW" : `${Math.round(nitro * 100)}%`}
            </span>
          </div>
          {/* 5 Segmented Cyber Battery Cells */}
          <div className="flex items-center gap-1" style={{ height: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => {
              const cellThreshold = (i + 1) * 0.2;
              const isFilled = nitro >= cellThreshold - 0.15;
              return (
                <div
                  key={i}
                  className="flex-1 h-full transition-all duration-150"
                  style={{
                    background: isFilled ? (nitro > 0.6 ? TOXIC : "#7ca800") : "#16181c",
                    border: `1px solid ${isFilled ? (nitro > 0.6 ? TOXIC : "#557500") : "#242730"}`,
                    boxShadow: isFilled && isNitroActive ? `0 0 8px ${TOXIC}` : "none",
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* TIME — Precision Center Anchor */}
        <div className="flex flex-1 flex-col items-center justify-center relative">
          <span style={{ fontSize: 7, letterSpacing: "0.5em", color: DIM, fontWeight: 700 }}>RACE TIME</span>
          <div className="flex items-baseline mt-0.5">
            <span style={{ fontSize: 30, fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: "-0.03em" }}>
              {timeObj.main}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: TOXIC, lineHeight: 1 }}>
              {timeObj.ms}
            </span>
          </div>
        </div>

        {/* Airborne Indicator Badge */}
        <div className="flex flex-col justify-center items-center shrink-0 px-3" style={{
          borderLeft: BAR, minWidth: 70, transition: "all 0.15s",
          background: airborne ? "rgba(182,255,0,0.08)" : "transparent",
        }}>
          <span style={{
            fontSize: airborne ? 10 : 8, letterSpacing: "0.25em", fontWeight: 700,
            color: airborne ? TOXIC : "#262830",
            textShadow: airborne ? `0 0 8px ${TOXIC}` : "none",
            transition: "all 0.15s",
          }}>
            AIR
          </span>
          <span style={{ fontSize: 6, letterSpacing: "0.15em", color: airborne ? TOXIC : "#262830" }}>
            {airborne ? "FLIGHT" : "GROUND"}
          </span>
        </div>

        {/* Score Counter */}
        <div className="flex flex-col justify-center px-5 shrink-0" style={{ borderLeft: BAR, minWidth: 110 }}>
          <span style={{ fontSize: 7, letterSpacing: "0.3em", color: DIM, fontWeight: 700 }}>SCORE</span>
          <span style={{
            fontSize: 22, fontWeight: 700, lineHeight: 1, marginTop: 2,
            color: score.total > 500 ? TOXIC : score.total > 200 ? "#d2f060" : INK,
            textShadow: score.total > 500 ? `0 0 8px ${TOXIC}60` : "none",
            transition: "color 0.3s",
          }}>
            {score.total.toString().padStart(6, "0")}
          </span>
        </div>

        {/* Audio Toggle */}
        <button
          className="pointer-events-auto flex flex-col justify-center items-center shrink-0 cursor-pointer transition-colors"
          onClick={toggleMute}
          style={{
            borderLeft: BAR, minWidth: 64, background: "none", border: "none",
            borderLeft: "1px solid " + LINE, outline: "none",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: muted ? CRIMSON : TOXIC, letterSpacing: "0.05em" }}>
            {muted ? "MUTED" : "ON"}
          </span>
          <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, marginTop: 2 }}>AUDIO</span>
        </button>
      </div>

      {/* Crash Vignette Flash */}
      <div className="absolute inset-0 pointer-events-none" style={{
        border: `4px solid ${CRIMSON}`, opacity: crashFlash ? 0.8 : 0,
        boxShadow: crashFlash ? `inset 0 0 40px ${CRIMSON}` : "none",
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

      {/* ── REACTIVE KEYBOARD CONTROLS BAR ──────────────────────────── */}
      <div className="absolute left-1/2 flex items-center gap-1.5 px-3 py-1.5" style={{
        bottom: 70, transform: "translateX(-50%)",
        background: "rgba(10,10,11,0.95)", border: "1px solid #23262d",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        pointerEvents: "none",
      }}>
        {[
          { key: "W / ↑", label: "GAS", active: isGasPressed },
          { key: "S / ↓", label: "BRAKE", active: isBrakePressed },
          { key: "A / D", label: "LEAN", active: isLeanPressed },
          { key: "SPACE", label: "JUMP", active: isJumpPressed },
          { key: "SHIFT", label: "NITRO", active: isNitroActive },
          { key: "R", label: "RESET", active: isResetPressed },
          { key: "M", label: "MUTE", active: isMutePressed },
        ].map(({ key, label, active }) => (
          <div key={label} className="flex items-center gap-1 px-2 py-0.5 transition-all duration-100" style={{
            background: active ? "rgba(182,255,0,0.15)" : "#111317",
            border: `1px solid ${active ? TOXIC : "#22252c"}`,
            boxShadow: active ? `0 0 8px ${TOXIC}40` : "none",
          }}>
            <span style={{
              fontSize: 8, fontWeight: 700, color: active ? TOXIC : INK,
              letterSpacing: "0.05em",
            }}>
              {key}
            </span>
            <span style={{ fontSize: 7, color: active ? TOXIC : DIM, letterSpacing: "0.1em" }}>
              {label}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
