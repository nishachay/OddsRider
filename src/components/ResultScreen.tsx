import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { starsFor } from '../game/score';
import { PlaybackCursor } from '../game/replay';
import { BIKE } from '../game/constants';
import {
  downloadBlob,
  shareCardBlob,
  shareRun,
  shareUrlFor,
  type ShareState,
} from '../utils/shareRun';
import type { SharePayload } from '@oddsrider/core';
import type { Difficulty } from '../data/tracks';
import type { MarketBest } from '../data/playerStorage';

export interface ResultScreenData {
  finished: boolean;
  score: number;
  timeMs: number;
  difficulty: Difficulty;
  /** 0..1 along the course where the run ended. */
  progress: number;
  question: string;
  /** "14 MAR" style, from the frozen track's own timestamps. */
  crashDate: string | null;
  best: MarketBest;
  isNewBest: boolean;
  /** The run's recorded poses; the screen loops their final seconds. */
  recording: SharePayload | null;
}

interface ResultScreenProps {
  result: ResultScreenData;
  onRetry: () => void;
  onShare: () => void;
  onNextTrack: (() => void) | null;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

/** How much of the run loops on the result screen, and how slowly. */
const REPLAY_SECONDS = 3;
const REPLAY_TIMESCALE = 0.5;
/** Score time runs at 60 physics steps per second. */
const STEPS_PER_SECOND = 60;
const CANVAS_W = 640;
const CANVAS_H = 200;
const CANVAS_PAD = 30;

/**
 * The last few seconds of the run, replayed at half speed.
 *
 * Poses come straight from the recording (no physics), so this is exactly what
 * happened — including the ragdoll once the rider is off the bike. The wheels'
 * contact points are drawn as the ground line, because that is where the bike
 * actually rode.
 */
function ResultReplay({ recording, finished }: { recording: SharePayload; finished: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { frames, beginStep, endStep } = recording;
    if (frames.length === 0) return;
    const from = Math.max(frames[0].step, endStep - REPLAY_SECONDS * STEPS_PER_SECOND);

    const xs: number[] = [];
    const ys: number[] = [];
    for (const f of frames) {
      if (f.step < from) continue;
      xs.push(f.c[0], f.r[0], f.f[0], f.g ? f.g[0] : f.c[0]);
      ys.push(f.c[1], f.r[1], f.f[1], f.g ? f.g[1] : f.c[1]);
    }
    if (xs.length === 0) return;

    // One fixed camera for the loop so the bike reads as moving, not drifting.
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(240, maxX - minX);
    const spanY = Math.max(160, maxY - minY);
    const scale = Math.min((CANVAS_W - CANVAS_PAD * 2) / spanX, (CANVAS_H - CANVAS_PAD * 2) / spanY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const px = (x: number) => CANVAS_W / 2 + (x - midX) * scale;
    const py = (y: number) => CANVAS_H / 2 + (y - midY) * scale;

    const accent = finished ? '#b6ff00' : '#ff3355';
    const wheelR = Math.max(3, BIKE.wheelR * scale);
    const cursor = new PlaybackCursor(frames, recording.tricks ?? [], beginStep, endStep, {
      timeScale: REPLAY_TIMESCALE,
    });
    cursor.seek(from);

    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      cursor.advance(dt);
      if (cursor.done) cursor.seek(from);

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Ground: where the wheels actually were.
      ctx.beginPath();
      let first = true;
      for (const f of frames) {
        if (f.step < from) continue;
        const gx = px(f.r[0]);
        const gy = py(f.r[1] + BIKE.wheelR);
        if (first) {
          ctx.moveTo(gx, gy);
          first = false;
        } else {
          ctx.lineTo(gx, gy);
        }
      }
      ctx.strokeStyle = '#232529';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.stroke();

      const pose = cursor.pose();
      if (!pose) {
        raf = requestAnimationFrame(draw);
        return;
      }

      // Wheels, then the chassis line between their hubs.
      ctx.strokeStyle = '#f0f0f2';
      ctx.lineWidth = 2;
      for (const wheel of [pose.r, pose.f]) {
        ctx.beginPath();
        ctx.arc(px(wheel[0]), py(wheel[1]), wheelR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px(pose.r[0]), py(pose.r[1]));
      ctx.lineTo(px(pose.f[0]), py(pose.f[1]));
      ctx.stroke();

      // Rider: on the bike, or the ragdoll once ejected.
      ctx.fillStyle = pose.ejected ? accent : '#f0f0f2';
      const rider = pose.ejected && pose.g ? pose.g : [pose.c[0], pose.c[1]];
      ctx.beginPath();
      ctx.arc(px(rider[0]), py(rider[1]), Math.max(4, wheelR * 0.55), 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [recording, finished]);

  return (
    <div className="relative overflow-hidden border border-line bg-bg/60">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="block h-[160px] w-full"
        aria-label="Replay of the last seconds of the run"
      />
      <span className="pointer-events-none absolute top-2 left-3 font-mono text-[9px] font-bold tracking-[0.22em] text-dim uppercase">
        Last {REPLAY_SECONDS} s · ½ speed
      </span>
      <span
        className={`pointer-events-none absolute top-2 right-3 font-mono text-[9px] font-bold tracking-[0.22em] uppercase ${
          finished ? 'text-toxic' : 'text-crimson'
        }`}
      >
        {finished ? 'Finish' : 'Crash'}
      </span>
    </div>
  );
}

/** Share row: how the last link share went, plus the card download. */
export function ResultActions({
  state,
  onSaveCard,
  disabled = false,
}: {
  state: ShareState;
  onSaveCard: () => void;
  /** True when the run has no snapshots, so there is no link or card. */
  disabled?: boolean;
}) {
  const status =
    state === 'shared' ? 'Shared' : state === 'copied' ? 'Link copied' : state === 'failed' ? 'Share failed' : '';
  const statusColor = state === 'failed' ? 'text-crimson' : 'text-toxic';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-line bg-bg/40 px-3 py-2.5">
      <span
        aria-live="polite"
        className={`font-mono text-[9px] font-bold tracking-[0.18em] uppercase ${statusColor}`}
      >
        {status || 'Link + 1200×630 card'}
      </span>
      <button
        onClick={onSaveCard}
        disabled={disabled}
        className="cursor-pointer border border-line px-3 py-2 font-mono text-[10px] font-bold tracking-[0.14em] text-ink uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save card (PNG)
      </button>
    </div>
  );
}

// Full result screen: what happened, where on the curve, the score, the last
// seconds replayed, and the three ways forward. Race-day chrome: Anton poster,
// mono data, momentum colour, no brackets, no reticles.
export default function ResultScreen({ result, onRetry, onShare, onNextTrack }: ResultScreenProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        e.preventDefault();
        onRetry();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRetry]);

  const accent = result.finished ? 'text-toxic' : 'text-crimson';
  const accentBg = result.finished ? 'bg-toxic' : 'bg-crimson';
  const headline = result.finished
    ? `Finished · ${formatTime(result.timeMs)}`
    : `Crashed at ${Math.round(result.progress * 100)}%${result.crashDate ? ` · ${result.crashDate}` : ''}`;
  const stars = starsFor(result.score, result.difficulty);

  // The share link carries the whole recording; the card carries its frames.
  const [shareState, setShareState] = useState<ShareState>('idle');
  const cardInput = useMemo(() => {
    if (!result.recording || result.recording.frames.length === 0) return null;
    try {
      return { payload: result.recording, question: result.question, url: shareUrlFor(result.recording) };
    } catch {
      return null;
    }
  }, [result.recording, result.question]);

  const handleShare = useCallback(async () => {
    if (!cardInput) {
      onShare();
      return;
    }
    const card = await shareCardBlob(cardInput);
    setShareState(await shareRun({ ...cardInput, card }));
    onShare();
  }, [cardInput, onShare]);

  const handleSaveCard = useCallback(async () => {
    if (!cardInput) return;
    const card = await shareCardBlob(cardInput);
    if (card) downloadBlob(card, 'oddsrider-run.png');
  }, [cardInput]);

  const shareLabel =
    shareState === 'shared' ? 'Shared' : shareState === 'copied' ? 'Link copied' : shareState === 'failed' ? 'Share failed' : 'Share';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Run result"
      className="pointer-events-auto fixed inset-0 z-50 flex select-none items-end justify-center bg-bg/80 p-4 sm:items-center"
    >
      <div className="rise flex w-full max-w-xl flex-col gap-4 border border-line bg-surface px-5 pt-5 pb-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] sm:px-7">
        <div className={`-mx-5 -mt-5 h-[3px] sm:-mx-7 ${accentBg}`} />

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-dim uppercase">
            {result.finished ? 'Run complete' : 'Run over'} · {result.difficulty} track
            {result.isNewBest && <span className="text-toxic"> · New best</span>}
          </span>
          <h2 className={`font-poster text-4xl leading-[0.95] uppercase sm:text-5xl ${accent}`}>{headline}</h2>
          <p className="pt-1 font-display text-[15px] leading-snug font-bold text-ink">{result.question}</p>
        </div>

        <div className="grid grid-cols-3 border-y border-line py-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Score</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {result.score.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-1 border-l border-line pl-4">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Time</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {formatTime(result.timeMs)}
            </span>
          </div>
          <div className="flex flex-col gap-1 border-l border-line pl-4">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Best</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {result.best.best.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Rating</span>
          <span
            className="font-mono text-lg font-black tracking-[0.14em] text-toxic"
            aria-label={`${stars} out of 5 stars`}
          >
            {'★'.repeat(stars)}
            <span className="text-line">{'★'.repeat(Math.max(0, 5 - stars))}</span>
          </span>
        </div>

        {result.recording && result.recording.frames.length > 0 ? (
          <ResultReplay recording={result.recording} finished={result.finished} />
        ) : (
          <div className="flex h-[160px] items-center justify-center border border-line bg-bg/60 font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
            Replay unavailable
          </div>
        )}

        <ResultActions state={shareState} onSaveCard={handleSaveCard} disabled={!cardInput} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onRetry}
            className={`min-h-[52px] flex-1 cursor-pointer border py-3.5 font-mono text-xs font-bold tracking-[0.16em] uppercase transition-all active:scale-[0.99] ${
              result.finished
                ? 'border-toxic bg-toxic text-bg hover:bg-toxic/90'
                : 'border-crimson/40 bg-crimson/10 text-crimson hover:bg-crimson hover:text-bg'
            }`}
          >
            Retry · R
          </button>
          <button
            onClick={handleShare}
            disabled={!cardInput}
            className="min-h-[52px] flex-1 cursor-pointer border border-line bg-transparent py-3.5 font-mono text-xs font-bold tracking-[0.16em] text-ink uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {shareLabel}
          </button>
          {onNextTrack && (
            <button
              onClick={onNextTrack}
              className="min-h-[52px] flex-1 cursor-pointer border border-line bg-transparent py-3.5 font-mono text-xs font-bold tracking-[0.16em] text-ink uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99]"
            >
              Next track →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
