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
    <div className="relative overflow-hidden" style={{ width: CW, height: CH }}>
      <canvas ref={ref} width={CW} height={CH} className="absolute inset-0" />
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
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono p-6">

      {/* ── TOP-LEFT: VEHICLE TELEMETRY (SPEED & NITRO) ── */}
      <div className="absolute top-6 left-6 flex flex-col gap-1 pointer-events-none">
        <span style={{ fontSize: 9, letterSpacing: "0.3em", color: DIM, fontWeight: 700 }}>SPEED</span>
        <div className="flex items-baseline gap-1.5 -mt-1">
          <span style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: speed > 100 ? TOXIC : INK }}>
            {speed.toString().padStart(3, "0")}
          </span>
          <span style={{ fontSize: 10, color: DIM, fontWeight: 700 }}>KM/H</span>
        </div>
        
        <div className="flex items-center gap-2 mt-2">
          <span style={{ fontSize: 9, letterSpacing: "0.2em", fontWeight: 800, color: isNitroActive ? TOXIC : DIM, width: 32 }}>
            NITRO
          </span>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => {
              const isFilled = nitro >= (i + 1) * 0.2 - 0.15;
              return (
                <div key={i} className="h-2 w-6 transition-colors"
                     style={{ background: isFilled ? TOXIC : "#1e212a" }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── TOP-CENTER: RACE TIMER ── */}
      <div className="absolute top-6 left-1/2 flex flex-col items-center pointer-events-none" style={{ transform: "translateX(-50%)" }}>
        <span style={{ fontSize: 9, letterSpacing: "0.3em", color: DIM, fontWeight: 800 }}>TIME</span>
        <div className="flex items-baseline mt-1">
          <span style={{ fontSize: 38, fontWeight: 900, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>{timeObj.main}</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: TOXIC, lineHeight: 1 }}>{timeObj.ms}</span>
        </div>
        {airborne && (
          <span className="text-[9px] font-extrabold tracking-widest text-toxic animate-pulse mt-2" style={{ textShadow: `0 0 8px ${TOXIC}` }}>
            ▲ AIRBORNE
          </span>
        )}
      </div>

      {/* ── TOP-RIGHT: SCORE & AUDIO ── */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3">
        <div className="flex flex-col items-end">
          <span style={{ fontSize: 9, letterSpacing: "0.3em", color: DIM, fontWeight: 800 }}>SCORE</span>
          <span style={{ fontSize: 28, fontWeight: 900, color: INK, lineHeight: 1, mt: 1 }}>
            {score.total.toString().padStart(6, "0")}
          </span>
        </div>
        <button
          className="pointer-events-auto cursor-pointer flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity mt-2"
          onClick={toggleMute}
        >
          <span style={{ fontSize: 10, color: muted ? CRIMSON : TOXIC }}>{muted ? "✕" : "🔊"}</span>
          <span style={{ fontSize: 9, letterSpacing: "0.2em", fontWeight: 800, color: muted ? CRIMSON : DIM }}>
            {muted ? "MUTED" : "AUDIO ON"}
          </span>
        </button>
      </div>

      {/* ── BOTTOM-LEFT: POLYMARKET TEXT ── */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-2.5 max-w-2xl pointer-events-none">
        <div className="flex items-center gap-2 opacity-80">
          <span className="font-display font-black text-lg tracking-widest text-ink">
            Odds<span style={{ color: TOXIC }}>Rider</span>
          </span>
          <span className="text-[9px] font-extrabold tracking-widest px-2 py-0.5" style={{ color: TOXIC, background: "rgba(182,255,0,0.1)" }}>
            LIVE MARKET
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-[13px] leading-relaxed text-ink">
            {fullQuestion}
          </span>
          <span className="font-bold text-[13px]" style={{ color: deltaUp ? TOXIC : CRIMSON }}>
            | {deltaUp ? "▲" : "▼"} {deltaAbs}%
          </span>
        </div>
      </div>

      {/* ── BOTTOM-CENTER: CONTROLS (Always visible, user preference) ── */}
      <div className="absolute bottom-6 left-1/2 flex items-center gap-4 pointer-events-none opacity-80" style={{ transform: "translateX(-50%)" }}>
        {[
          { key: "W / ↑", label: "GAS" },
          { key: "S / ↓", label: "BRAKE" },
          { key: "A / D", label: "LEAN" },
          { key: "SPACE", label: "JUMP" },
          { key: "SHIFT", label: "NITRO" },
          { key: "R", label: "RESET" },
          { key: "M", label: "MUTE" }
        ].map(({ key, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span style={{ fontSize: 10, fontWeight: 900, color: INK }}>{key}</span>
            <span style={{ fontSize: 8, color: DIM, letterSpacing: "0.1em" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── BOTTOM-RIGHT: PROBABILITY & MINIMAP ── */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 pointer-events-none">
        <div className="flex flex-col items-end">
          <span style={{ fontSize: 9, letterSpacing: "0.3em", color: DIM, fontWeight: 800 }}>PROBABILITY</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span style={{
              fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.03em",
              color: probPct === null ? DIM : TOXIC,
              textShadow: probPct === null ? "none" : `0 0 16px ${TOXIC}60`
            }}>
              {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
            </span>
            <span style={{ fontSize: 11, letterSpacing: "0.2em", fontWeight: 800, color: INK }}>YES</span>
          </div>
        </div>
        <MiniChart pts={track} progress={progress} />
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
