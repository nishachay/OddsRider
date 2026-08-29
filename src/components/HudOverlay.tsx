import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const LINE = "#232529";
const GLASS_BG = "rgba(10, 11, 14, 0.82)";
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
const CW = 116, CH = 36, CP = 3;

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

    // Subtle dark gridlines
    ctx.strokeStyle = "#1a1d24";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CH / 2); ctx.lineTo(CW, CH / 2);
    ctx.moveTo(CW / 2, 0); ctx.lineTo(CW / 2, CH);
    ctx.stroke();

    // Track line
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
    <div className="relative rounded-md overflow-hidden" style={{ width: CW, height: CH }}>
      <canvas ref={ref} width={CW} height={CH} className="absolute inset-0" />
      {/* Corner reticles */}
      <span className="absolute top-0 left-0 w-1 h-1" style={{ borderTop: `1px solid ${TOXIC}60`, borderLeft: `1px solid ${TOXIC}60` }} />
      <span className="absolute top-0 right-0 w-1 h-1" style={{ borderTop: `1px solid ${TOXIC}60`, borderRight: `1px solid ${TOXIC}60` }} />
      <span className="absolute bottom-0 left-0 w-1 h-1" style={{ borderBottom: `1px solid ${TOXIC}60`, borderLeft: `1px solid ${TOXIC}60` }} />
      <span className="absolute bottom-0 right-0 w-1 h-1" style={{ borderBottom: `1px solid ${TOXIC}60`, borderRight: `1px solid ${TOXIC}60` }} />
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
  const [hasStarted, setHasStarted] = useState(false);

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
      setHasStarted(true);
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });
      if (!hasStarted) setHasStarted(true);
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
  }, [hasStarted]);

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaAbs = Math.abs((market?.probDelta ?? 0) * 100).toFixed(1);
  const probPct = prob === null ? null : prob * 100;

  // FULL UNTRUNCATED QUESTION TEXT
  const fullQuestion = market?.question ?? "LOADING LIVE POLYMARKET DATA...";

  const toggleMute = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyM" }));
  }, []);

  const rideAgain = useCallback(() => {
    setResult(null);
    setHasStarted(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" }));
  }, []);

  const timeObj = fmtTime(score.timeMs);
  const isNitroActive = activeKeys.has("ShiftLeft") || activeKeys.has("ShiftRight") || activeKeys.has("KeyN");
  const speedGauge = Math.min(100, Math.round((speed / 180) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono p-5">

      {/* ── TOP-LEFT: FROSTED GLASS MARKET WIDGET CARD (PROTECTED FROM TRACK LINES) ── */}
      <div className="absolute top-5 left-5 flex flex-col gap-2 max-w-xl">
        {/* Brand Badge */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md w-fit" style={{
          background: GLASS_BG,
          backdropFilter: "blur(10px)",
          border: `1px solid ${LINE}`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
        }}>
          <span className="font-display font-black text-base tracking-wider" style={{ textShadow: `0 0 10px ${TOXIC}40` }}>
            <span style={{ color: TOXIC }}>Odds</span><span style={{ color: INK }}>Rider</span>
          </span>
          <span className="text-[8px] font-extrabold tracking-widest px-1.5 py-0.5 rounded-xs" style={{ color: TOXIC, background: "rgba(182,255,0,0.1)", border: `1px solid ${TOXIC}30` }}>
            LIVE MARKET
          </span>
        </div>

        {/* Polymarket Full Question & Hero Odds Card */}
        <div className="flex flex-col gap-2 px-4 py-3 rounded-md" style={{
          background: GLASS_BG,
          backdropFilter: "blur(10px)",
          border: `1px solid ${LINE}`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.7)",
        }}>
          {/* Full Question Text (NO TRUNCATION!) */}
          <span className="font-medium text-xs leading-relaxed" style={{ color: INK }}>
            {fullQuestion}
          </span>

          {/* Hero Prediction Odds */}
          <div className="flex items-center gap-3 pt-1.5 border-t border-[#1e212a]">
            <div className="flex items-baseline gap-1.5">
              <span style={{ fontSize: 8, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>PREDICTION ODDS</span>
              <span style={{
                fontSize: 26, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em",
                color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
                textShadow: probPct === null ? "none" : deltaUp ? `0 0 14px ${TOXIC}70` : `0 0 14px ${CRIMSON}70`,
              }}>
                {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
              </span>
              <span style={{ fontSize: 9, letterSpacing: "0.15em", fontWeight: 800, color: INK }}>YES</span>
            </div>

            {market && (
              <span className="font-extrabold text-[9px] px-2 py-0.5 rounded-xs" style={{
                color: deltaUp ? TOXIC : CRIMSON,
                background: deltaUp ? "rgba(182,255,0,0.12)" : "rgba(255,51,85,0.12)",
                border: `1px solid ${deltaUp ? TOXIC : CRIMSON}40`,
              }}>
                {deltaUp ? "▲" : "▼"} {deltaAbs}% CHANGE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── TOP-CENTER: UNIFIED RACE DECK CARD (TIMER + NITRO) ────────── */}
      <div className="absolute top-5 left-1/2 flex flex-col items-center" style={{ transform: "translateX(-50%)" }}>
        <div className="flex flex-col items-center rounded-md overflow-hidden" style={{
          background: GLASS_BG,
          backdropFilter: "blur(10px)",
          border: `1px solid ${LINE}`,
          boxShadow: "0 6px 20px rgba(0,0,0,0.8)",
        }}>
          {/* Top Half: Precision Timer */}
          <div className="flex items-baseline px-5 py-1.5">
            <span style={{ fontSize: 28, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {timeObj.main}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: TOXIC, lineHeight: 1 }}>
              {timeObj.ms}
            </span>
          </div>

          {/* Bottom Half: Nitro Bar */}
          <div className="flex items-center gap-1.5 px-3.5 py-1 w-full" style={{
            borderTop: `1px solid ${LINE}`,
            background: isNitroActive ? "rgba(182,255,0,0.08)" : "transparent",
            boxShadow: isNitroActive ? `0 0 12px ${TOXIC}40` : "none",
            transition: "all 0.15s",
          }}>
            <span style={{
              fontSize: 7, letterSpacing: "0.15em", fontWeight: 800,
              color: isNitroActive ? TOXIC : DIM,
            }}>
              {isNitroActive ? "⚡ NITRO" : "NITRO"}
            </span>
            <div className="flex items-center gap-1 flex-1 h-1.5">
              {[0, 1, 2, 3, 4].map((i) => {
                const isFilled = nitro >= (i + 1) * 0.2 - 0.15;
                return (
                  <div
                    key={i}
                    className="flex-1 h-full rounded-xs transition-all duration-150"
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

        {airborne && (
          <span className="text-[8px] font-extrabold tracking-widest text-toxic animate-pulse mt-1" style={{ textShadow: `0 0 8px ${TOXIC}` }}>
            ▲ AIRBORNE
          </span>
        )}
      </div>

      {/* ── TOP-RIGHT: MINIMAP & AUDIO CARD DECK ────────────────────── */}
      <div className="absolute top-5 right-5 flex flex-col items-end gap-2">
        <div className="rounded-md overflow-hidden" style={{
          background: GLASS_BG,
          backdropFilter: "blur(10px)",
          border: `1px solid ${LINE}`,
          padding: 4,
          boxShadow: "0 4px 14px rgba(0,0,0,0.7)",
        }}>
          <MiniChart pts={track} progress={progress} />
        </div>

        <button
          className="pointer-events-auto cursor-pointer px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors"
          onClick={toggleMute}
          style={{
            background: GLASS_BG,
            backdropFilter: "blur(10px)",
            border: `1px solid ${LINE}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <span style={{ fontSize: 9, color: muted ? CRIMSON : TOXIC }}>{muted ? "✕" : "🔊"}</span>
          <span style={{ fontSize: 7, letterSpacing: "0.15em", fontWeight: 700, color: muted ? CRIMSON : DIM }}>
            {muted ? "MUTED" : "AUDIO"}
          </span>
        </button>
      </div>

      {/* ── BOTTOM-LEFT: TELEMETRY CARDS (SPEED & SCORE) ───────────── */}
      <div className="absolute bottom-5 left-5 flex items-center gap-2">
        {/* Speedometer Card */}
        <div className="flex flex-col px-3.5 py-2 rounded-md" style={{
          background: GLASS_BG,
          backdropFilter: "blur(10px)",
          border: `1px solid ${LINE}`,
          minWidth: 98, height: 48,
          boxShadow: "0 4px 14px rgba(0,0,0,0.7)",
        }}>
          <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>SPEED</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span style={{
              fontSize: 22, fontWeight: 800, lineHeight: 1,
              color: speed > 100 ? TOXIC : speed > 60 ? "#d2f060" : INK,
              textShadow: speed > 100 ? `0 0 10px ${TOXIC}80` : "none",
            }}>
              {speed.toString().padStart(3, "0")}
            </span>
            <span style={{ fontSize: 7, color: DIM, fontWeight: 700 }}>km/h</span>
          </div>
        </div>

        {/* Score Card */}
        <div className="flex flex-col px-3.5 py-2 rounded-md" style={{
          background: GLASS_BG,
          backdropFilter: "blur(10px)",
          border: `1px solid ${LINE}`,
          minWidth: 104, height: 48,
          boxShadow: "0 4px 14px rgba(0,0,0,0.7)",
        }}>
          <span style={{ fontSize: 7, letterSpacing: "0.2em", color: DIM, fontWeight: 700 }}>SCORE</span>
          <span style={{
            fontSize: 22, fontWeight: 800, lineHeight: 1, marginTop: 2,
            color: score.total > 500 ? TOXIC : score.total > 200 ? "#d2f060" : INK,
            textShadow: score.total > 500 ? `0 0 10px ${TOXIC}60` : "none",
          }}>
            {score.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── CONTROLS CARD (SHOWS ONLY BEFORE PLAYTIME, FULLY DISAPPEARS ON DRIVE) ── */}
      {!hasStarted && (
        <div className="absolute left-1/2 flex flex-col items-center gap-2 p-3.5 rounded-md transition-all duration-500" style={{
          bottom: 60, transform: "translateX(-50%)",
          background: "rgba(12, 13, 17, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid #282a35",
          boxShadow: "0 8px 32px rgba(0,0,0,0.85)",
        }}>
          <span style={{ fontSize: 7, letterSpacing: "0.3em", color: TOXIC, fontWeight: 700 }}>RIDE CONTROLS</span>
          <div className="flex items-center gap-2">
            {[
              { key: "W / ↑", label: "GAS" },
              { key: "S / ↓", label: "BRAKE" },
              { key: "A / D", label: "LEAN" },
              { key: "SPACE", label: "JUMP" },
              { key: "SHIFT", label: "NITRO" },
              { key: "R", label: "RESET" },
            ].map(({ key, label }) => (
              <div key={label} className="flex items-center gap-1 px-2 py-1 bg-[#161820] border border-[#262834] rounded-xs">
                <span style={{ fontSize: 8, fontWeight: 800, color: INK }}>{key}</span>
                <span style={{ fontSize: 7, color: DIM, letterSpacing: "0.08em" }}>{label}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 7, color: DIM, letterSpacing: "0.15em" }}>PRESS ANY KEY TO START RIDING</span>
        </div>
      )}

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
