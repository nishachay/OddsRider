import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";

function formatTime(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${secs}`;
}

type TrackPts = Array<[number, number]>;

const MAP_W = 120;
const MAP_H = 38;
const MAP_PAD = 3;

function MiniChart({ pts, progress }: { pts: TrackPts | null; progress: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  const geo = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY };
  }, [pts]);

  const scale = useMemo(() => {
    if (!geo) return null;
    const sx = (MAP_W - MAP_PAD * 2) / Math.max(1, geo.maxX - geo.minX);
    const sy = (MAP_H - MAP_PAD * 2) / Math.max(1, geo.maxY - geo.minY);
    return { sx, sy };
  }, [geo]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !pts || !geo || !scale) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { minX, minY } = geo;
    const { sx, sy } = scale;
    const px = (x: number) => MAP_PAD + (x - minX) * sx;
    const py = (y: number) => MAP_PAD + (y - minY) * sy;
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
    const { sx, sy } = scale;
    const xT = minX + Math.min(1, Math.max(0, progress)) * (maxX - minX);
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][0] < xT) i++;
    const [xa, ya] = pts[i];
    const [xb, yb] = pts[i + 1] ?? pts[i];
    const t = xb > xa ? (xT - xa) / (xb - xa) : 0;
    const yv = ya + (yb - ya) * t;
    return { left: MAP_PAD + (xT - minX) * sx, top: MAP_PAD + (yv - minY) * sy };
  }, [pts, geo, scale, progress]);

  return (
    <div className="relative" style={{ width: MAP_W, height: MAP_H }}>
      <canvas ref={ref} width={MAP_W} height={MAP_H} className="absolute inset-0" />
      {dot && (
        <span
          className="absolute h-1.5 w-1.5 rounded-full bg-toxic"
          style={{ left: dot.left - 3, top: dot.top - 3, boxShadow: `0 0 4px ${TOXIC}` }}
        />
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
  const [nitro, setNitro] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(true);
  const [prob, setProb] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [track, setTrack] = useState<TrackPts | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState<ScorePayload>({ total: 0, timeMs: 0, finished: false });
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [isAirborne, setIsAirborne] = useState(false);

  useEffect(() => {
    const offSpeed = bus.on<number>(EV.SPEED, setSpeed);
    const offMute = bus.on<boolean>(EV.MUTE, setMuted);
    const offNitro = bus.on<number>(EV.NITRO, setNitro);
    const offProb = bus.on<number>(EV.PROB, setProb);
    const offGrounded = bus.on<boolean>(EV.GROUNDED, (g) => setIsAirborne(!g));
    const offTrack = bus.on<{ pts: TrackPts }>(EV.TRACK, (t) => { setTrack(t.pts); setProgress(0); });
    const offPos = bus.on<number>(EV.POSITION, setProgress);
    const offMarket = bus.on<MarketPayload | null>(EV.MARKET, (m) => { setMarket(m); if (!m) setTrack(null); });
    const offScore = bus.on<ScorePayload>(EV.SCORE, setScore);
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
      offSpeed(); offMute(); offNitro(); offProb(); offGrounded();
      offTrack(); offPos(); offMarket(); offScore(); offResult(); offCrash(); offFirst();
      window.clearTimeout(fallbackTimer); window.clearTimeout(hideTimer); window.clearTimeout(crashTimer);
    };
  }, []);

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaAbs = Math.abs((market?.probDelta ?? 0) * 100).toFixed(1);
  const probPct = prob === null ? null : (prob * 100);

  const toggleMute = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyM" }));
  }, []);

  const rideAgain = useCallback(() => {
    setResult(null);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" }));
  }, []);

  const questionText = market
    ? market.question.length > 58 ? market.question.slice(0, 58) + "..." : market.question
    : "LOADING MARKET DATA...";

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">

      {/* ── TOP BAR: Brand | Live Market | Probability | Chart ─────────── */}
      <div
        className="absolute top-0 left-0 right-0 flex items-stretch"
        style={{ height: 48, borderBottom: "1px solid #232529", background: "rgba(10,10,11,0.96)" }}
      >
        {/* Brand wordmark */}
        <div className="flex items-center px-5" style={{ borderRight: "1px solid #232529" }}>
          <span className="font-display font-bold tracking-[0.18em]" style={{ fontSize: 13, fontStretch: "120%" }}>
            <span style={{ color: TOXIC }}>Odds</span>
            <span style={{ color: "#e8e8ea" }}>Rider</span>
          </span>
        </div>

        {/* Market data — the hero of this game */}
        <div className="flex flex-1 items-center gap-3 px-5">
          {/* Live indicator */}
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: TOXIC, boxShadow: `0 0 4px ${TOXIC}` }}
            />
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, letterSpacing: "0.3em", color: "#7c7f86" }}>
              POLYMARKET
            </span>
          </span>
          {/* Question */}
          <span
            className="truncate"
            style={{ fontFamily: "JetBrains Mono", fontSize: 10, letterSpacing: "0.04em", color: "#7c7f86" }}
          >
            {questionText}
          </span>
          {/* Delta badge */}
          {market && (
            <span
              className="shrink-0 px-1.5 py-0.5"
              style={{
                fontFamily: "JetBrains Mono",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.1em",
                border: `1px solid ${deltaUp ? "rgba(182,255,0,0.35)" : "rgba(255,51,85,0.35)"}`,
                color: deltaUp ? TOXIC : CRIMSON,
              }}
            >
              {deltaUp ? "▲" : "▼"} {deltaAbs}%
            </span>
          )}
        </div>

        {/* Probability — large, right-aligned */}
        <div
          className="flex items-center gap-2 px-5"
          style={{ borderLeft: "1px solid #232529" }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono",
              fontSize: 22,
              fontWeight: 700,
              lineHeight: 1,
              color: probPct === null ? "#7c7f86" : (deltaUp ? TOXIC : CRIMSON),
              letterSpacing: "-0.02em",
            }}
          >
            {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
          </span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, letterSpacing: "0.2em", color: "#7c7f86" }}>
            YES
          </span>
        </div>

        {/* Mini chart */}
        <div
          className="flex items-center px-3"
          style={{ borderLeft: "1px solid #232529" }}
        >
          <MiniChart pts={track} progress={progress} />
        </div>
      </div>

      {/* ── BOTTOM BAR: Speed | Nitro | Time | Score | Progress | Controls ─ */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-stretch"
        style={{ height: 56, borderTop: "1px solid #232529", background: "rgba(10,10,11,0.96)" }}
      >
        {/* Speed */}
        <div className="flex flex-col justify-center px-5" style={{ borderRight: "1px solid #232529", minWidth: 90 }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, letterSpacing: "0.32em", color: "#7c7f86" }}>SPEED</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color: "#e8e8ea", lineHeight: 1 }}>
              {speed}
            </span>
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, color: "#7c7f86" }}>KM/H</span>
          </div>
        </div>

        {/* Nitro */}
        <div className="flex flex-col justify-center gap-1 px-5" style={{ borderRight: "1px solid #232529", minWidth: 160 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, letterSpacing: "0.32em", color: "#7c7f86" }}>NITRO</span>
            {nitro > 0.08 && (
              <span style={{ fontFamily: "JetBrains Mono", fontSize: 7, letterSpacing: "0.2em", color: TOXIC }}>READY</span>
            )}
          </div>
          <div className="relative overflow-hidden" style={{ height: 4, background: "#232529" }}>
            <div
              className="absolute inset-y-0 left-0 transition-all duration-75"
              style={{
                width: `${nitro * 100}%`,
                background: nitro > 0.6 ? TOXIC : nitro > 0.25 ? "#7ca800" : "#4a6800",
                boxShadow: nitro > 0.5 ? `0 0 6px ${TOXIC}60` : "none",
              }}
            />
          </div>
        </div>

        {/* Time — primary center */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, letterSpacing: "0.4em", color: "#7c7f86" }}>TIME</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 24, fontWeight: 700, color: "#e8e8ea", lineHeight: 1, marginTop: 2 }}>
            {formatTime(score.timeMs)}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col justify-center px-5" style={{ borderLeft: "1px solid #232529", minWidth: 100 }}>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, letterSpacing: "0.32em", color: "#7c7f86" }}>SCORE</span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 20, fontWeight: 700, color: "#e8e8ea", lineHeight: 1, marginTop: 2 }}>
            {score.total.toLocaleString()}
          </span>
        </div>

        {/* Airborne indicator */}
        <div
          className="flex flex-col justify-center items-center px-4"
          style={{ borderLeft: "1px solid #232529", minWidth: 60, opacity: isAirborne ? 1 : 0, transition: "opacity 0.1s" }}
        >
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 7, letterSpacing: "0.3em", color: TOXIC, fontWeight: 700 }}>
            AIR
          </span>
          <span style={{ fontFamily: "JetBrains Mono", fontSize: 7, letterSpacing: "0.1em", color: "rgba(182,255,0,0.5)" }}>
            TIME
          </span>
        </div>

        {/* Mute — rightmost */}
        <button
          onClick={toggleMute}
          className="pointer-events-auto flex flex-col justify-center items-center px-4 cursor-pointer"
          style={{
            borderLeft: "1px solid #232529",
            minWidth: 64,
            fontFamily: "JetBrains Mono",
            fontSize: 8,
            letterSpacing: "0.2em",
            color: muted ? CRIMSON : "#7c7f86",
            background: "none",
            border: "none",
            borderLeft: "1px solid #232529",
          }}
        >
          <span>{muted ? "MUTED" : "♪"}</span>
          <span style={{ fontSize: 7, opacity: 0.7 }}>[M]</span>
        </button>
      </div>

      {/* Crash vignette flash */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          borderWidth: 3,
          borderStyle: "solid",
          borderColor: CRIMSON,
          opacity: crashFlash ? 0.65 : 0,
          pointerEvents: "none",
        }}
      />

      {/* Result modal */}
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

      {/* Control hints — centered, above bottom bar, fully disappear after first input */}
      <div
        className="absolute left-1/2 flex items-center gap-3 transition-opacity duration-700"
        style={{
          bottom: 68,
          transform: "translateX(-50%)",
          opacity: hintsVisible ? 1 : 0,
          pointerEvents: hintsVisible ? "auto" : "none",
          background: "rgba(10,10,11,0.92)",
          border: "1px solid #232529",
          padding: "6px 14px",
        }}
      >
        {[
          { keys: ["W", "↑"], label: "GAS" },
          { keys: ["S", "↓"], label: "BRAKE" },
          { keys: ["A", "D"], label: "LEAN" },
          { keys: ["SPC"], label: "JUMP" },
          { keys: ["SHIFT"], label: "NITRO" },
          { keys: ["R"], label: "RESET" },
        ].map(({ keys, label }) => (
          <span key={label} className="flex items-center gap-1">
            {keys.map((k) => (
              <span
                key={k}
                style={{
                  fontFamily: "JetBrains Mono",
                  fontSize: 8,
                  padding: "2px 5px",
                  border: "1px solid #383a40",
                  background: "#101113",
                  color: "#e8e8ea",
                  lineHeight: 1.4,
                }}
              >
                {k}
              </span>
            ))}
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 8, color: "#7c7f86", marginLeft: 2 }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
