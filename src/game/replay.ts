/**
 * Snapshot recording and cursor playback — game glue, no physics here.
 *
 * While riding, every 3rd physics step (20 Hz) captures all drawn body poses
 * plus trick events. Playback interpolates those frames: no physics runs, so
 * seeking is O(1), slow motion is a cursor rate, and ghosts share the exact
 * same poses. Share links carry a quantized 10 Hz downsample (see core).
 *
 * This module never imports Phaser or the Bike: pure logic over frames.
 */
import type {
  BodyFrame,
  GhostSnapshot,
  RunMeta,
  SharePayload,
  TrickEvent,
} from '@oddsrider/core';
import { framesToGhost, poseAtStep, timeMsAtStep, TRICK_CODES } from '@oddsrider/core';

/** Steps between snapshot samples (60 Hz / 3 = 20 Hz). */
export const SNAPSHOT_EVERY_STEPS = 3;

/** Map the scene's popup text to a replay trick code. */
export function trickCodeFor(text: string): number {
  switch (text) {
    case 'BACKFLIP':
      return TRICK_CODES.BACKFLIP;
    case 'FRONTFLIP':
      return TRICK_CODES.FRONTFLIP;
    case 'BIG AIR':
      return TRICK_CODES.BIG_AIR;
    case 'WHEELIE':
      return TRICK_CODES.WHEELIE;
    case 'STOPPIE':
      return TRICK_CODES.STOPPIE;
    case 'SPEED DEMON':
      return TRICK_CODES.SPEED_DEMON;
    case 'NITRO BURN':
      return TRICK_CODES.NITRO_BURN;
    default:
      return 0;
  }
}

export interface RecordedPose {
  chassis: { x: number; y: number; angle: number };
  rear: { x: number; y: number; angle: number };
  front: { x: number; y: number; angle: number };
  ejected: boolean;
  ragdoll: { x: number; y: number; angle: number } | null;
}

export interface TrickOccurrence {
  step: number;
  code: number;
  points: number;
}

/** Live recorder: frames every 3rd step, trick events as they pop. */
export class RunRecorder {
  private frames: BodyFrame[] = [];
  readonly tricks: TrickEvent[] = [];
  private beginStep = -1;
  private lastFrameStep = -1;

  constructor(
    readonly trackId: string,
    readonly trackHash: string,
    readonly inverted: boolean,
    readonly interval: RunMeta['interval'],
  ) {}

  markBegin(step: number): void {
    if (this.beginStep < 0) this.beginStep = step;
  }

  record(step: number, pose: RecordedPose): void {
    if (step - this.lastFrameStep < SNAPSHOT_EVERY_STEPS && this.frames.length > 0) return;
    this.lastFrameStep = step;
    this.frames.push({
      step,
      c: [pose.chassis.x, pose.chassis.y, pose.chassis.angle],
      r: [pose.rear.x, pose.rear.y, pose.rear.angle],
      f: [pose.front.x, pose.front.y, pose.front.angle],
      ejected: pose.ejected,
      g: pose.ragdoll ? [pose.ragdoll.x, pose.ragdoll.y, pose.ragdoll.angle] : undefined,
    });
  }

  recordTrick(step: number, code: number, points: number): void {
    this.tricks.push({ step, code, points });
  }

  get frameCount(): number {
    return this.frames.length;
  }

  toSharePayload(meta: {
    endStep: number;
    outcome: 'crash' | 'finish';
    progress: number;
    finalScore: number;
    finalTimeMs: number;
  }): SharePayload {
    const frames = this.frames.filter((f) => f.step <= meta.endStep);
    return {
      trackId: this.trackId,
      trackHashPrefix: this.trackHash.slice(0, 16),
      inverted: this.inverted,
      interval: this.interval,
      beginStep: this.beginStep,
      endStep: meta.endStep,
      outcome: meta.outcome,
      progress: meta.progress,
      finalScore: meta.finalScore,
      finalTimeMs: meta.finalTimeMs,
      truncated: false,
      frames,
      tricks: this.tricks.filter((t) => t.step <= meta.endStep),
    };
  }

  toGhostSnapshots(): GhostSnapshot[] {
    return framesToGhost(this.frames, this.beginStep);
  }
}

export interface PlaybackCursorOptions {
  /** Slow motion factor (1 = normal speed). */
  timeScale?: number;
  /** Start paused (the chrome resumes explicitly). */
  paused?: boolean;
}

/** Step-cursor over decoded frames. Deterministic by construction. */
export class PlaybackCursor {
  timeScale = 1;
  paused = false;
  private position = 0;
  private notified = false;
  onDone: (() => void) | null = null;

  constructor(
    readonly frames: BodyFrame[],
    readonly tricks: TrickEvent[],
    readonly beginStep: number,
    readonly endStep: number,
    opts: PlaybackCursorOptions = {},
  ) {
    this.timeScale = opts.timeScale ?? 1;
    this.paused = opts.paused ?? false;
  }

  static fromShare(payload: {
    frames: BodyFrame[];
    tricks: TrickEvent[];
    beginStep: number;
    endStep: number;
  }): PlaybackCursor {
    return new PlaybackCursor(payload.frames, payload.tricks, payload.beginStep, payload.endStep);
  }

  get step(): number {
    return this.position;
  }

  get done(): boolean {
    return this.position >= this.endStep;
  }

  /** Advance by wall milliseconds (scaled); returns false at the end. */
  advance(dtMs: number): boolean {
    if (this.paused || this.done) return false;
    // 60 steps per second of score time, scaled for slow motion.
    this.position += (dtMs / (1000 / 60)) * this.timeScale;
    if (this.done) {
      this.position = this.endStep;
      if (!this.notified) {
        this.notified = true;
        this.onDone?.();
      }
      return false;
    }
    return true;
  }

  seek(step: number): void {
    this.position = Math.max(0, Math.min(step, this.endStep));
    this.notified = false;
  }

  pose(): ReturnType<typeof poseAtStep> {
    return poseAtStep(this.frames, this.position);
  }

  timeMs(): number {
    return timeMsAtStep(Math.floor(this.position), this.beginStep);
  }

  /** Trick events at or before the cursor (for redisplay, deduped by caller). */
  tricksUpTo(step: number): TrickEvent[] {
    return this.tricks.filter((t) => t.step <= step);
  }
}

/** Pending ghost handoff between the /r/ page and the next ride (same session). */
let pendingGhost: GhostSnapshot[] | null = null;

export function setPendingGhost(snapshots: GhostSnapshot[]): void {
  pendingGhost = snapshots;
}

export function takePendingGhost(): GhostSnapshot[] | null {
  const snapshots = pendingGhost;
  pendingGhost = null;
  return snapshots;
}

/** Drop an armed ghost ("Ride this track" means a clean run, no ghost). */
export function clearPendingGhost(): void {
  pendingGhost = null;
}

export interface ReplayStartOptions {
  fromStep?: number;
  /** Slow motion factor (1 = normal speed). */
  timeScale?: number;
  /** Suppress transient bus noise while replaying. */
  quiet?: boolean;
  /** Start paused (the chrome resumes explicitly). */
  paused?: boolean;
}

/** What the scene reports when a run ends: frozen end-state + its recording. */
export interface RunResult {
  finished: boolean;
  score: number;
  timeMs: number;
  difficulty: import('../data/polymarket').Difficulty;
  /** 0..1 along the course at the crash/finish moment. */
  progress: number;
  /** Inputs-only recording (share links strip snapshots). */
  recording: SharePayload;
  /** Ghost poses up to the end moment. */
  snapshots: GhostSnapshot[];
}
