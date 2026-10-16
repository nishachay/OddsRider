/**
 * Run recording and deterministic replay — game glue, no physics here.
 *
 * Recording captures the exact drive state the bike consumes per fixed step,
 * so replaying the same events reproduces the run bit-for-bit regardless of
 * wall-clock timing. Ghost poses regenerate from any playback, which keeps
 * share links to inputs-only (tweet-short) while local bests keep snapshots.
 *
 * This module never imports Phaser or the Bike: it is pure logic over step
 * indices and can be unit-tested in node.
 */
import {
  driveAtStep,
  driveFromMask,
  maskFromDrive,
  type DriveState,
  type GhostSnapshot,
  type SharePayload,
  type StepEvents,
} from '@oddsrider/core';
import type { DriveInput } from './bike/Bike';
import type { Difficulty } from '../data/polymarket';

export type {
  DriveState,
  GhostSnapshot,
  SharePayload,
  StepEvents,
} from '@oddsrider/core';

export interface StepDrive extends DriveState {
  step: number;
}

/** Convert recorded state to the drive shape the bike consumes. */
export function toDriveInput(rec: DriveState): DriveInput {
  return {
    gas: rec.gas,
    brake: rec.brake,
    leanBack: rec.leanBack,
    leanFwd: rec.leanFwd,
    nitro: rec.nitro,
    jumpQueued: rec.jump,
  };
}

/** Live recorder: one entry per input change, snapshots every Nth step. */
export class RunRecorder {
  private events: StepEvents = [];
  private lastMask: number | null = null;
  readonly snapshots: GhostSnapshot[] = [];
  private lastSnapshotStep = -1;

  constructor(
    readonly trackId: string,
    readonly trackHash: string,
    readonly inverted: boolean,
    readonly interval: SharePayload['interval'],
    private readonly snapshotEverySteps = 6,
  ) {}

  /** Record the drive consumed at a step, plus an optional ghost pose. */
  record(step: number, drive: DriveState, pose?: { t: number; x: number; y: number; a: number }): void {
    const mask = maskFromDrive(drive);
    if (this.lastMask === null) {
      this.events.push([0, mask]);
      this.lastMask = mask;
    } else if (mask !== this.lastMask) {
      this.events.push([step, mask]);
      this.lastMask = mask;
    }
    if (pose && step - this.lastSnapshotStep >= this.snapshotEverySteps) {
      this.lastSnapshotStep = step;
      this.snapshots.push({ t: pose.t, x: pose.x, y: pose.y, a: pose.a });
    }
  }

  get eventCount(): number {
    return this.events.length;
  }

  toSharePayload(meta: { endStep: number; outcome: 'crash' | 'finish'; endX: number }): SharePayload {
    return {
      trackId: this.trackId,
      trackHashPrefix: this.trackHash.slice(0, 16),
      inverted: this.inverted,
      interval: this.interval,
      events: this.events.map(([s, m]) => [s, m] as [number, number]),
      endStep: meta.endStep,
      outcome: meta.outcome,
      endX: meta.endX,
    };
  }
}

/** Playback driver: feeds recorded drives by step index. */
export class ReplayDriver {
  /** Suppresses transient bus noise (popups, crash/result scheduling). */
  quiet = true;
  /** Slow motion factor for crash loops (1 = normal speed). */
  timeScale = 1;
  paused = false;
  private notified = false;
  onDone: (() => void) | null = null;

  constructor(
    readonly events: StepEvents,
    readonly endStep: number,
  ) {}

  static fromPayload(payload: SharePayload): ReplayDriver {
    return new ReplayDriver(payload.events, payload.endStep);
  }

  inputAt(step: number): DriveState {
    return driveFromMask(driveAtStep(this.events, step));
  }

  /** First step carrying any input — the score begins there (mirrors live). */
  get beginStep(): number {
    for (const [step, mask] of this.events) {
      if (mask !== 0) return step;
    }
    return -1;
  }

  isDone(stepCount: number): boolean {
    return stepCount >= this.endStep;
  }

  /** Fires onDone once when the playback crosses its recorded end. */
  checkDone(stepCount: number): void {
    if (!this.notified && this.isDone(stepCount)) {
      this.notified = true;
      this.onDone?.();
    }
  }

  resetNotified(): void {
    this.notified = false;
  }
}

/** What the scene reports when a run ends: frozen end-state + its recording. */
export interface RunResult {
  finished: boolean;
  score: number;
  timeMs: number;
  difficulty: Difficulty;
  /** 0..1 along the course at the crash/finish moment. */
  progress: number;
  /** Inputs-only recording (share links strip snapshots). */
  recording: SharePayload;
  /** Ghost poses up to the end moment. */
  snapshots: GhostSnapshot[];
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

/** Options for EV.REPLAY_START. */
export interface ReplayStartOptions {
  fromStep?: number;
  /** Slow motion factor (1 = normal speed). */
  timeScale?: number;
  /** Suppress transient bus noise while replaying. */
  quiet?: boolean;
  /** Start paused (the chrome resumes explicitly). */
  paused?: boolean;
}
