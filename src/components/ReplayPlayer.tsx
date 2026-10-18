/**
 * Full-run replay player — canvas only, no Phaser and no physics.
 *
 * Poses come straight from the recorded snapshots and are interpolated by
 * `PlaybackCursor`, so playback is exact by construction. The camera chases
 * the rear wheel hub with a fixed world scale, which is why the bike leads
 * the frame instead of sitting pinned to the middle.
 */
import { useEffect, useRef, useState } from 'react';
import { PlaybackCursor } from '../game/replay';
import { BIKE } from '../game/constants';
import { formatRunTime } from '../utils/shareRun';
import type { SharePayload } from '@oddsrider/core';

const W = 960;
const H = 460;
/** World px -> canvas px. Wheel radius 25 reads as 15 px. */
const WORLD_SCALE = 0.6;
/** Camera chase factor, and how far ahead of the hub the camera aims. */
const CAM_LAG = 0.08;
const CAM_LEAD_X = 90;
const SPEEDS = [1, 0.5] as const;
const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

export default function ReplayPlayer({ payload }: { payload: SharePayload }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<PlaybackCursor | null>(null);
  const playingRef = useRef(true);
  const [playing, setPlaying] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { frames, beginStep, endStep } = payload;
    if (frames.length === 0) return;
    const from = frames[0].step;
    const span = Math.max(1, endStep - from);

    const cursor = new PlaybackCursor(frames, payload.tricks, beginStep, endStep);
    cursor.seek(from);
    cursorRef.current = cursor;

    const cam = { x: frames[0].r[0] + CAM_LEAD_X, y: frames[0].r[1] };
    const accent = payload.outcome === 'finish' ? TOXIC : CRIMSON;
    const wheelR = Math.max(2, BIKE.wheelR * WORLD_SCALE);

    let raf = 0;
    let last = performance.now();
    let lastPublish = 0;

    const draw = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;

      if (playingRef.current) {
        if (cursor.done) cursor.seek(from);
        cursor.advance(dt);
        if (cursor.done) setPlaying(false);
      }

      const pose = cursor.pose();
      if (pose) {
        cam.x += (pose.r[0] + CAM_LEAD_X - cam.x) * CAM_LAG;
        cam.y += (pose.r[1] - cam.y) * CAM_LAG;
      }
      const px = (x: number) => W / 2 + (x - cam.x) * WORLD_SCALE;
      const py = (y: number) => H * 0.52 + (y - cam.y) * WORLD_SCALE;

      ctx.fillStyle = '#0a0a0b';
      ctx.fillRect(0, 0, W, H);

      // Ground: where the rear wheel actually rode.
      ctx.beginPath();
      let started = false;
      for (const f of frames) {
        const gx = px(f.r[0]);
        if (gx < -200 || gx > W + 200) continue;
        const gy = py(f.r[1] + BIKE.wheelR);
        if (!started) {
          ctx.moveTo(gx, gy);
          started = true;
        } else {
          ctx.lineTo(gx, gy);
        }
      }
      ctx.strokeStyle = '#26282d';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.stroke();

      if (pose) {
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
      }

      if (now - lastPublish > 100) {
        lastPublish = now;
        setTimeMs(cursor.timeMs());
        setProgress(Math.min(1, Math.max(0, (cursor.step - from) / span)));
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      cursorRef.current = null;
    };
  }, [payload]);

  const restart = () => {
    const first = payload.frames[0];
    if (first) cursorRef.current?.seek(first.step);
    setTimeMs(0);
    setProgress(0);
    setPlaying(true);
  };

  const scrub = (value: number) => {
    const from = payload.frames[0]?.step ?? 0;
    const span = Math.max(1, payload.endStep - from);
    cursorRef.current?.seek(from + value * span);
    setProgress(value);
    setTimeMs(cursorRef.current?.timeMs() ?? 0);
  };

  return (
    <div className="flex flex-col gap-3 border border-line bg-bg/60">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="block h-auto w-full"
        aria-label="Replay of the shared run"
      />

      <div className="flex flex-col gap-2 px-3 pb-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="min-h-[40px] min-w-[92px] cursor-pointer border border-line px-3 py-2 font-mono text-[10px] font-bold tracking-[0.16em] text-ink uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99]"
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button
            onClick={restart}
            className="min-h-[40px] cursor-pointer border border-line px-3 py-2 font-mono text-[10px] font-bold tracking-[0.16em] text-dim uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99]"
          >
            ↺ Restart
          </button>
          <button
            onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
            className="min-h-[40px] cursor-pointer border border-line px-3 py-2 font-mono text-[10px] font-bold tracking-[0.16em] text-ink uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99]"
            title="Playback speed"
          >
            {SPEEDS[speedIndex] === 1 ? '1×' : '½×'}
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label="Replay position"
          className="h-1 flex-1 cursor-pointer accent-toxic"
        />

        <span className="font-mono text-[11px] font-bold tabular-nums text-dim">
          <span className="text-ink">{formatRunTime(timeMs)}</span> / {formatRunTime(payload.finalTimeMs)}
        </span>
      </div>
    </div>
  );
}
