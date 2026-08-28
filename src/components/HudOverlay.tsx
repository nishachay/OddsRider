import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const LINE = "#232529";
const BG = "rgba(10,10,11,0.97)";
const DIM = "#7c7f86";
const INK = "#e8e8ea";

function fmt(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${secs}`;
}

type TrackPts = Array<[number, number]>;
const CW = 128, CH = 40, CP = 3;

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
    ctx.lineWidth = 1.5;
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
        <span className="absolute rounded-full"
          style={{ width: 6, height: 6, background: TOXIC, boxShadow: `0 0 5px ${TOXIC}`, left: dot.left - 3, top: dot.top - 3 }} />
      )}
    </div>
  );
}

interface ScorePayload { total: number; timeMs: number; finished: boolean; }
interface MarketPayload { question: string; probNow: number; probDelta: number; }
interface ResultPayload { finished: boolean; score: number; timeMs: number; }

const SEP = <span style={{ width: 1, alignSelf: "stretch", background: LINE }} />;

const CONTROLS = [
  { key: "W / ↑", label: "Gas" },
  { key: "S / ↓", label: "Brake" },
  { key: "A / D", label: "Lean" },
  { key: "SPC", label: "Jump" },
  { key: "SHIFT", label: "Nitro" },
  { key: "R", label: "Reset" },
  { key: "M", label: "Mute" },
];

export default function HudOverlay() {
  const [speed, setSpeed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nitro, setNitro] = useState(1);
  const [crashFlash, setCrashFlash] = useState(false);
  const [hintsHighlight, setHintsHighlight] = useState(true);
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
    const t1 = window.setTimeout(() => setHintsHighlight(false), 6000);
    const offFirst = bus.on<void>(EV.INPUT_FIRST, () => {
      window.setTimeout(() => setHintsHighlight(false), 3000);
    });
    return () => { offs.forEach(f => f()); offCrash(); offFirst(); window.clearTimeout(ct); window.clearTimeout(t1); };
  }, []);

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaAbs = Math.abs((market?.probDelta ?? 0) * 100).toFixed(1);
  const probPct = prob === null ? null : prob * 100;
  const question = market
    ? market.question.length > 60 ? market.question.slice(0, 60) + "..." : market.question
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

  // Nitro visual state
  const nitroPct = Math.round(nitro * 100);
  const nitroColor = nitro > 0.6 ? TOXIC : nitro > 0.25 ? "#8bc400" : nitro > 0.08 ? "#526000" : "#2a2a2a";
  const nitroGlow = nitro > 0.5 ? `0 0 8px ${TOXIC}55` : "none";
  const nitroLabel = nitro <= 0.04 ? "EMPTY" : nitro < 0.12 ? "LOW" : nitro > 0.9 ? "FULL" : `${nitroPct}%`;

  const BAR = "1px solid " + LINE;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-mono">

      {/* ── TOP BAR ─────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 flex items-stretch" style={{ height: 48, background: BG, borderBottom: BAR }}>

        {/* Wordmark */}
        <div className="flex items-center px-5 shrink-0" style={{ borderRight: BAR }}>
          <span className="font-display font-bold" style={{ fontSize: 14, letterSpacing: "0.18em", fontStretch: "118%" }}>
            <span style={{ color: TOXIC }}>Odds</span><span style={{ color: INK }}>Rider</span>
          </span>
        </div>

        {/* Live market strip — the hero of this game */}
        <div className="flex flex-1 items-center gap-3 px-4 min-w-0">
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="rounded-full" style={{ width: 5, height: 5, background: TOXIC, boxShadow: `0 0 4px ${TOXIC}` }} />
            <span style={{ fontSize: 7, letterSpacing: "0.35em", color: DIM }}>POLYMARKET</span>
          </span>
          <span className="truncate" style={{ fontSize: 10, letterSpacing: "0.04em", color: DIM }}>{question}</span>
          {market && (
            <span className="shrink-0" style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", padding: "2px 6px",
              border: `1px solid ${deltaUp ? "rgba(182,255,0,0.3)" : "rgba(255,51,85,0.3)"}`,
              color: deltaUp ? TOXIC : CRIMSON,
            }}>
              {deltaUp ? "▲" : "▼"} {deltaAbs}%
            </span>
          )}
        </div>

        {/* Probability — large, the key market number */}
        <div className="flex items-center gap-2 px-5 shrink-0" style={{ borderLeft: BAR }}>
          <span style={{
            fontSize: 24, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em",
            color: probPct === null ? DIM : deltaUp ? TOXIC : CRIMSON,
          }}>
            {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
          </span>
          <span style={{ fontSize: 8, letterSpacing: "0.22em", color: DIM }}>YES</span>
        </div>

        {/* Mini chart */}
        <div className="flex items-center px-3 shrink-0" style={{ borderLeft: BAR }}>
          <MiniChart pts={track} progress={progress} />
        </div>
      </div>

      {/* ── BOTTOM BAR ──────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 flex items-stretch" style={{ height: 58, background: BG, borderTop: BAR }}>

        {/* Speed */}
        <div className="flex flex-col justify-center px-5 shrink-0" style={{ borderRight: BAR, minWidth: 88 }}>
          <span style={{ fontSize: 7, letterSpacing: "0.35em", color: DIM }}>SPEED</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span style={{
              fontSize: 22, fontWeight: 700, lineHeight: 1,
              color: speed > 100 ? TOXIC : speed > 60 ? "#c8e860" : INK,
              transition: "color 0.3s",
            }}>{speed}</span>
            <span style={{ fontSize: 7, color: DIM }}>KM/H</span>
          </div>
        </div>

        {/* Nitro */}
        <div className="flex flex-col justify-center gap-1.5 px-5 shrink-0" style={{ borderRight: BAR, minWidth: 170 }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 7, letterSpacing: "0.35em", color: DIM }}>NITRO</span>
            <span style={{
              fontSize: 7, letterSpacing: "0.15em", fontWeight: 700,
              color: nitro <= 0.04 ? CRIMSON : nitro < 0.12 ? "#ff6633" : nitro > 0.9 ? TOXIC : DIM,
            }}>
              {nitroLabel}
            </span>
          </div>
          {/* Nitro fill bar — thicker, outer glow when charged */}
          <div className="relative" style={{
            height: 8, background: "#141415",
            boxShadow: nitro > 0.8 ? `0 0 10px ${TOXIC}35` : "none",
            transition: "box-shadow 0.4s",
          }}>
            <div className="absolute inset-y-0 left-0" style={{
              width: `${nitroPct}%`, background: nitroColor,
              boxShadow: nitroGlow, transition: "width 80ms, background 0.3s",
            }} />
            {[25, 50, 75].map(p => (
              <span key={p} className="absolute inset-y-0" style={{ left: `${p}%`, width: 1, background: "#0a0a0b", opacity: 0.7 }} />
            ))}
          </div>
        </div>

        {/* Time — center hero, larger */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <span style={{ fontSize: 7, letterSpacing: "0.45em", color: DIM }}>TIME</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: INK, lineHeight: 1, marginTop: 1, letterSpacing: "-0.02em" }}>
            {fmt(score.timeMs)}
          </span>
        </div>

        {/* Score */}
        <div className="flex flex-col justify-center px-5 shrink-0" style={{ borderLeft: BAR, minWidth: 96 }}>
          <span style={{ fontSize: 7, letterSpacing: "0.35em", color: DIM }}>SCORE</span>
          <span style={{
            fontSize: 22, fontWeight: 700, lineHeight: 1, marginTop: 2,
            color: score.total > 500 ? TOXIC : score.total > 200 ? "#c8e860" : INK,
            transition: "color 0.3s",
          }}>
            {score.total.toLocaleString()}
          </span>
        </div>

        {/* Airborne — appears only when in air */}
        <div className="flex flex-col justify-center items-center shrink-0" style={{
          borderLeft: BAR, minWidth: 58, transition: "opacity 0.12s",
          opacity: airborne ? 1 : 0,
        }}>
          <span style={{ fontSize: 7, letterSpacing: "0.3em", fontWeight: 700, color: TOXIC }}>AIR</span>
        </div>

        {/* Mute */}
        <button
          className="pointer-events-auto flex flex-col justify-center items-center shrink-0 cursor-pointer"
          onClick={toggleMute}
          style={{
            borderLeft: BAR, minWidth: 58, background: "none", border: "none",
            borderLeft: "1px solid " + LINE, outline: "none",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, color: muted ? CRIMSON : DIM }}>
            {muted ? "○" : "◉"}
          </span>
          <span style={{ fontSize: 7, letterSpacing: "0.18em", color: muted ? CRIMSON : DIM, marginTop: 2 }}>
            {muted ? "MUTED" : "AUDIO"}
          </span>
        </button>
      </div>

      {/* Crash border flash */}
      <div className="absolute inset-0" style={{
        border: `3px solid ${CRIMSON}`, opacity: crashFlash ? 0.65 : 0,
        transition: "opacity 0.18s", pointerEvents: "none",
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

      {/* Control hints — always visible but dim after first input, ABOVE the bottom bar */}
      <div className="absolute left-1/2 flex items-center gap-0" style={{
        bottom: 66, transform: "translateX(-50%)",
        background: BG, border: BAR,
        opacity: hintsHighlight ? 1 : 0.28,
        transition: "opacity 1s",
        pointerEvents: "none",
      }}>
        {CONTROLS.map(({ key, label }, i) => (
          <span key={label} className="flex items-center" style={{ borderRight: i < CONTROLS.length - 1 ? BAR : "none" }}>
            <span className="flex items-center gap-1.5 px-3 py-1.5">
              <span style={{
                fontSize: 8, fontWeight: 700, padding: "1px 4px",
                border: "1px solid #383a40", background: "#0f1012", color: INK,
                letterSpacing: "0.05em", lineHeight: 1.5,
              }}>{key}</span>
              <span style={{ fontSize: 7, color: DIM, letterSpacing: "0.12em" }}>{label}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
