import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bus, EV } from "../game/bus";
import ResultModal from "./ResultModal";
import TouchControls from "./TouchControls";
import { loadMuted } from "../game/audio";
import { momentumUp } from "../data/tracks";
import type { Difficulty } from "../data/tracks";

const TOXIC = "#b6ff00";
const CRIMSON = "#ff3355";
const DIM = "#7c7f86";
const SUBTLE = "#9ca3af";
const INK = "#f0f0f2";

function fmtTime(ms: number): { main: string; ms: string } {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60).toString().padStart(2, "0");
  const tenths = Math.floor((ms % 1000) / 100);
  return { main: `${m}:${secs}`, ms: `.${tenths}` };
}

type TrackPts = Array<[number, number]>;
const CW = 124, CH = 32, CP = 2;

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
        <span className="absolute rounded-none animate-pulse"
          style={{ width: 4, height: 4, background: TOXIC, boxShadow: `0 0 6px ${TOXIC}`, left: dot.left - 2, top: dot.top - 2 }} />
      )}
    </div>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

interface ScorePayload { total: number; timeMs: number; finished: boolean; combo: number; }
interface PopupPayload { id: number; text: string; points: number; }
// Official contract odds from the scene: same last-trade numbers as the
// market card and preview. probDelta is null when uncomputable ("—").
interface MarketPayload { question: string; currentProb: number; probDelta: number | null; }
interface ResultPayload { finished: boolean; score: number; timeMs: number; difficulty: Difficulty; }

interface HudOverlayProps {
  onOpenLobby?: () => void;
  rideUrl?: string;
}

export default function HudOverlay({ onOpenLobby, rideUrl }: HudOverlayProps) {
  const [speed, setSpeed] = useState(0);
  const [muted, setMuted] = useState(loadMuted);
  const [nitro, setNitro] = useState(1);
  const [crashFlash, setCrashFlash] = useState(false);
  const [prob, setProb] = useState<number | null>(null);
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [track, setTrack] = useState<TrackPts | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState<ScorePayload>({ total: 0, timeMs: 0, finished: false, combo: 1 });
  const [combo, setCombo] = useState(1);
  const [popups, setPopups] = useState<PopupPayload[]>([]);
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
      bus.on<ScorePayload>(EV.SCORE, (s) => {
        setScore(s);
        setCombo(s.combo);
      }),
      bus.on<ResultPayload>(EV.RESULT, setResult),
      bus.on<number>(EV.PROB, setProb),
      bus.on<number>(EV.COMBO, setCombo),
      bus.on<PopupPayload>(EV.POPUP, (p) => {
        setPopups((prev) => [...prev.slice(-3), p]);
        window.setTimeout(() => {
          setPopups((prev) => prev.filter((x) => x.id !== p.id));
        }, 1600);
      }),
    ];
    let ct = 0;
    const offCrash = bus.on<void>(EV.CRASH, () => {
      setCrashFlash(true); window.clearTimeout(ct);
      ct = window.setTimeout(() => setCrashFlash(false), 900);
    });

    const offFirst = bus.on<void>(EV.INPUT_FIRST, () => setHasStarted(true));

    const handleKeyDown = (e: KeyboardEvent) => {
      setActiveKeys((prev) => new Set(prev).add(e.code));
      if (!["KeyM", "KeyR"].includes(e.code)) setHasStarted(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => setActiveKeys((prev) => {
      const next = new Set(prev); next.delete(e.code); return next;
    });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      offs.forEach(f => f()); offCrash(); offFirst(); window.clearTimeout(ct);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const deltaUp = (market?.probDelta ?? 0) >= 0;
  const deltaKnown = market?.probDelta != null;
  const deltaColor = !deltaKnown ? DIM : deltaUp ? TOXIC : CRIMSON;
  const deltaLabel = !deltaKnown ? "—" : `${deltaUp ? "+" : ""}${((market?.probDelta ?? 0) * 100).toFixed(1)}%`;
  // Official contract odds. The live under-wheels value (EV.PROB) feeds the
  // minimap dot and the result screen — never the hero number.
  // Hero number follows the same momentum rule as the terrain colours
  // (momentumUp): rising reads toxic, falling reads crimson.
  const chanceUp = momentumUp(market?.probDelta ?? null);
  const probPct = market ? market.currentProb * 100 : prob === null ? null : prob * 100;
  const heroColor = probPct === null ? DIM : chanceUp ? TOXIC : CRIMSON;
  const fullQuestion = market?.question ?? "LOADING TRACK DATA...";

  const toggleMute = useCallback(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyM" }));
  }, []);

  const rideAgain = useCallback(() => {
    setResult(null);
    setHasStarted(false);
    bus.emit(EV.RESTART);
  }, []);

  const timeObj = fmtTime(score.timeMs);
  const isNitroActive = activeKeys.has("ShiftLeft") || activeKeys.has("ShiftRight") || activeKeys.has("KeyN");

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-sans p-6 sm:p-8 flex flex-col justify-between">

      {/* ── TOP DECK: FOCUS & TACTICAL SPARKLINE ── */}
      <div className="flex items-start justify-between w-full">

        {/* Top-Left: Brand Identity & Lobby Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-baseline tracking-[0.24em] uppercase font-display font-black text-sm sm:text-base">
            <span className="text-ink">Odds</span>
            <span style={{ color: TOXIC }}>Rider</span>
          </div>

          {onOpenLobby && (
            <button
              onClick={onOpenLobby}
              className="pointer-events-auto cursor-pointer font-mono text-[9px] font-bold tracking-widest uppercase border border-[#232529] bg-[#12141a] px-2 py-1 text-dim hover:text-toxic hover:border-toxic/50 transition-all"
              title="Return to Market Lobby"
            >
              [ MARKETS ]
            </button>
          )}
        </div>

        {/* Top-Center: Precision Race Clock */}
        <div className="flex flex-col items-center -mt-1 font-mono">
          <div className="flex items-baseline tracking-tight tabular-nums">
            <span style={{ fontSize: 40, fontWeight: 700, color: INK, lineHeight: 1 }}>
              {timeObj.main}
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: TOXIC, lineHeight: 1 }}>
              {timeObj.ms}
            </span>
          </div>
          {airborne && (
            <span className="font-sans text-[8px] font-extrabold tracking-[0.22em] text-toxic animate-pulse mt-0.5" style={{ textShadow: `0 0 8px ${TOXIC}` }}>
              AIRBORNE
            </span>
          )}
        </div>

        {/* Top-Right: Tactical Sparkline Stacked with Audio Control */}
        <div className="flex flex-col items-end gap-1.5">
          <MiniChart pts={track} progress={progress} />
          <button
            className="pointer-events-auto cursor-pointer flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
            onClick={toggleMute}
            title={muted ? "Unmute (M)" : "Mute (M)"}
          >
            <span style={{ color: muted ? CRIMSON : SUBTLE }}>
              <VolumeIcon muted={muted} />
            </span>
            <span className="text-[8px] font-sans font-bold tracking-[0.16em]" style={{ color: muted ? CRIMSON : DIM }}>
              {muted ? "MUTED" : "AUDIO"}
            </span>
          </button>
        </div>

      </div>


      {/* ── BOTTOM DECK: COCKPIT INSTRUMENT PANEL & PREDICTION OUTCOME ── */}
      <div className="flex items-end justify-between w-full">

        {/* Bottom-Left: Pure Cockpit Telemetry (Speed + Score + Nitro) */}
        <div className="flex flex-col gap-2">

          {/* Speed & Score Baseline Duo */}
          <div className="flex items-baseline gap-6 font-mono tabular-nums">
            <div className="flex items-baseline gap-1">
              <span style={{
                fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em",
                color: speed > 100 ? TOXIC : INK,
                textShadow: speed > 100 ? `0 0 12px ${TOXIC}80` : "none",
              }}>
                {speed.toString().padStart(3, "0")}
              </span>
              <span className="font-sans" style={{ fontSize: 9, color: DIM, fontWeight: 700, letterSpacing: "0.08em" }}>
                KM/H
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="font-sans" style={{ fontSize: 8, letterSpacing: "0.22em", color: DIM, fontWeight: 800 }}>
                SCORE
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: INK, lineHeight: 1 }}>
                {score.total.toLocaleString()}
              </span>
              {combo > 1 && (
                <span className="font-mono" style={{ fontSize: 11, fontWeight: 800, color: TOXIC, textShadow: `0 0 10px ${TOXIC}80` }}>
                  ×{combo}
                </span>
              )}
            </div>
          </div>

          {/* Nitro Fuel Meter */}
          <div className="flex items-center gap-2">
            <span className="font-sans" style={{
              fontSize: 8, letterSpacing: "0.22em", fontWeight: 800,
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
                    className="w-5 h-1.5 transition-all duration-100"
                    style={{
                      background: isFilled ? TOXIC : "#181a20",
                      boxShadow: isFilled && isNitroActive ? `0 0 8px ${TOXIC}` : "none",
                    }}
                  />
                );
              })}
            </div>
            <span className="font-mono text-[8px] text-dim ml-1">
              {Math.round(nitro * 100)}%
            </span>
          </div>

        </div>


        {/* Bottom-Center: Start-Gate Keycaps Helper (Gracefully Fades Out On Drive) */}
        <div
          className="flex items-center gap-2 pb-1 font-sans transition-opacity duration-500 ease-out"
          style={{ opacity: hasStarted ? 0 : 0.75 }}
        >
          {[
            { key: "W", label: "GAS" },
            { key: "S", label: "BRAKE" },
            { key: "A/D", label: "LEAN" },
            { key: "SPACE", label: "JUMP" },
            { key: "SHIFT", label: "NITRO" },
            { key: "R", label: "RESET" },
          ].map(({ key, label }) => (
            <span key={label} className="flex items-center gap-1">
              <span className="font-mono px-1 py-0.5 text-[7.5px] font-bold text-subtle leading-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid #232529" }}>
                {key}
              </span>
              <span className="text-[7px] text-[#7c7f86] font-bold tracking-wider">
                {label}
              </span>
            </span>
          ))}
        </div>


        {/* Bottom-Right: Race Outcome Column */}
        <div className="flex flex-col items-end gap-1.5 max-w-[460px] text-right pl-6"
              style={{ borderRight: `2px solid ${heroColor}`, paddingRight: 12 }}>

          {/* Full Question Text */}
          <span className="font-sans font-medium text-[12.5px] leading-[1.38] text-ink/90 tracking-[-0.01em]">
            {fullQuestion}
          </span>

          {/* Hero Probability + Financial Delta Block */}
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-baseline gap-1 font-mono tabular-nums">
              <span style={{
                fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em",
                color: heroColor,
                textShadow: probPct === null ? "none" : `0 0 16px ${heroColor}60`,
              }}>
                {probPct === null ? "—" : `${probPct.toFixed(1)}%`}
              </span>

              <span className="font-sans font-extrabold text-[10px] tracking-[0.18em] text-ink ml-0.5">
                YES
              </span>
            </div>

            {market && (
              <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.5" style={{
                color: deltaColor,
                background: `${deltaColor}14`,
                border: `1px solid ${deltaColor}30`,
              }}>
                {deltaLabel}
              </span>
            )}
          </div>

        </div>

      </div>

      {/* Trick popups */}
      {popups.length > 0 && (
        <div className="absolute inset-x-0 bottom-32 flex flex-col items-center gap-1">
          {popups.map((p) => (
            <span
              key={p.id}
              className="font-mono text-sm font-black tracking-widest tabular-nums animate-pulse"
              style={{ color: TOXIC, textShadow: `0 0 14px ${TOXIC}90` }}
            >
              {p.text} +{p.points.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {/* Crash Vignette Flash */}      <div className="absolute inset-0 pointer-events-none transition-all duration-150" style={{
        border: crashFlash ? `4px solid ${CRIMSON}` : "0px solid transparent",
        boxShadow: crashFlash ? `inset 0 0 80px ${CRIMSON}` : "none",
        opacity: crashFlash ? 0.8 : 0,
      }} />

      {/* Result Modal */}
      <TouchControls />
      <ResultModal
        isOpen={Boolean(result)}
        result={result ? {
          finished: result.finished, score: result.score, timeMs: result.timeMs,
          difficulty: result.difficulty,
          marketQuestion: market?.question, finalProb: prob ?? undefined,
          trackPts: track,
        } : null}
        onRetry={rideAgain}
        onOpenLobby={onOpenLobby}
        rideUrl={rideUrl}
      />

    </div>
  );
}
