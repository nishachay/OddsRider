import Phaser from 'phaser';
import { bus, EV, activeRideStore } from '../bus';
import { PALETTE, WORLD, STEP_MS, MAX_STEPS_PER_FRAME, SPRITE, TERRAIN } from '../constants';
import { Bike } from '../bike/Bike';
import type { DriveInput } from '../bike/Bike';
import { BikeRenderer } from '../bike/BikeRenderer';
import { InputManager } from '../input/InputManager';
import { fetchRide } from '../../data/polymarket';
import { loadMuted, storeMuted } from '../audio';
import type { Ride, Difficulty } from '../../data/polymarket';
import { buildTerrain, probabilityAt } from '../terrain';
import type { Terrain } from '../terrain';
import { TrackRenderer } from '../track/TrackRenderer';
import { RideScore } from '../score';
import { FinishCelebration } from '../finish';
import { GhostRenderer, ReplayBike } from '../ghost';
import {
  PlaybackCursor,
  RunRecorder,
  trickCodeFor,
  type RecordedPose,
  type ReplayStartOptions,
  type RunResult,
} from '../replay';
import type { SharePayload } from '@oddsrider/core';
import type { GhostSnapshot } from '@oddsrider/core';

/** Forced brake once the run is over (score finished). */
const FINISH_BRAKE: DriveInput = {
  gas: false,
  brake: true,
  leanBack: false,
  leanFwd: false,
  nitro: false,
  jumpQueued: false,
};

const MONO = 'Geist Mono, monospace';
const SEGMENT_THICKNESS = 26;

interface Gate {
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  color: number;
}

export class RideScene extends Phaser.Scene {
  private bike!: Bike;
  private bikeRenderer!: BikeRenderer;
  private inputMgr!: InputManager;
  private trackRenderer!: TrackRenderer;

  private terrain: Terrain | null = null;
  private flatGround: MatterJS.BodyType | null = null;
  private flatGfx: Phaser.GameObjects.Graphics | null = null;
  private groundBodies: MatterJS.BodyType[] = [];
  private endWall: MatterJS.BodyType | null = null;
  private endWallGfx: Phaser.GameObjects.GameObject[] = [];
  private startGate!: Gate;
  private finishFx: FinishCelebration | null = null;
  private resultTimer: Phaser.Time.TimerEvent | null = null;
  private rideSpawnX = WORLD.spawnX;
  private offRestart: (() => void) | null = null;

  private muted = loadMuted();
  private wasGrounded = false;
  private attractLiftY = 0;
  // Guards the boot race: the shell may emit a ride before or after the
  // scene's own fallback fetch resolves. First application wins; the
  // fallback never overwrites an already-applied ride.
  private rideApplied = false;
  // Attract-mode camera lift (world units): framing only, so the bike rides
  // in the upper band above the title panel. Zero on playable rides.
  private acc = 0;
  private crashHandled = false;
  private nextSpeedEmitAt = 0;
  private nextNitroEmitAt = 0;
  private nextProbEmitAt = 0;
  private nextScoreEmitAt = 0;
  private nextGroundedEmitAt = 0;
  private score = new RideScore();
  private parked = false;

  // Recording + snapshot playback (replays). The recorder samples body
  // poses while riding; a cursor interpolates them with no physics.
  private recorder: RunRecorder | null = null;
  private replayPlayback: {
    cursor: PlaybackCursor;
    renderer: ReplayBike;
    focusX: number;
    focusY: number;
  } | null = null;
  private stepCount = 0;
  private endMarker: { step: number; timeMs: number; x: number; outcome: 'crash' | 'finish' } | null = null;
  private lastRideMeta: { trackId: string; trackHash: string; inverted: boolean; interval: 'ALL' | '24H' | '7D' } | null = null;
  private ghost: GhostRenderer | null = null;
  private replayBike: ReplayBike | null = null;
  private offReplay: Array<() => void> = [];
  private offGhost: (() => void) | null = null;

  // Trick detection state (angle in radians, positive = nose down)
  private trickAirMs = 0;
  private wheelieMs = 0;
  private stoppieMs = 0;
  private speedDemonMs = 0;
  private nitroMs = 0;
  private rotAcc = 0;
  private lastTrickAngle = 0;
  private popupId = 0;
  private rideDifficulty: Difficulty = 'MEDIUM';

  // Camera crash snapshot — lerp to fixed point, not live ragdoll
  private crashCamX = 0;
  private crashCamY = 0;

  constructor() {
    super('ride');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.matter.world.pause();
    this.buildFlatGround();
    this.trackRenderer = new TrackRenderer(this);

    // Flag is 80px ahead — immediately visible to the right of spawn
    this.startGate = this.createGate(WORLD.spawnX + 600, WORLD.groundTopY, 'START', PALETTE.toxic);

    this.bike = new Bike(this, WORLD.spawnX + 450, WORLD.groundTopY - WORLD.spawnDy);
    this.bikeRenderer = new BikeRenderer(this);
    this.ghost = new GhostRenderer(this);
    this.replayBike = new ReplayBike(this);
    this.inputMgr = new InputManager();

    // Store handle so we can remove it on shutdown — prevents duplicate listeners on hot reload
    if (this.offRestart) this.offRestart();
    this.offRestart = bus.on(EV.RESTART, () => this.doReset(true));
    const offLoadMarket = bus.on<Ride>(EV.LOAD_MARKET, (ride) => this.applyRide(ride));
    this.offReplay = [
      bus.on<{ share: SharePayload; opts?: ReplayStartOptions }>(EV.REPLAY_START, ({ share, opts }) =>
        this.startReplay(share, opts ?? {}),
      ),
      bus.on<{ step: number }>(EV.REPLAY_SEEK, ({ step }) => this.seekReplay(step)),
      bus.on<{ paused: boolean }>(EV.REPLAY_PAUSE, ({ paused }) => {
        if (this.replayPlayback) this.replayPlayback.cursor.paused = paused;
      }),
      bus.on<void>(EV.REPLAY_STOP, () => this.stopReplay()),
    ];
    if (this.offGhost) this.offGhost();
    this.offGhost = bus.on<{ snapshots: GhostSnapshot[] | null }>(EV.GHOST_SET, ({ snapshots }) => {
      this.ghost?.setSnapshots(snapshots);
    });
    // Detach on shutdown AND destroy: game.destroy() tears down systems
    // via destroy (not shutdown), so shutdown-only cleanup leaks bus and
    // input listeners into the next mounted game. Detach is idempotent.
    const detach = () => {
      this.inputMgr.destroy();
      if (this.offRestart) { this.offRestart(); this.offRestart = null; }
      offLoadMarket();
      for (const off of this.offReplay) off();
      this.offReplay = [];
      if (this.offGhost) { this.offGhost(); this.offGhost = null; }
      this.ghost?.destroy();
      this.ghost = null;
      this.replayBike?.destroy();
      this.replayBike = null;
      this.replayPlayback = null;
    };
    this.events.once('shutdown', detach);
    this.events.once('destroy', detach);

    const cam = this.cameras.main;
    cam.centerOn(this.bike.x, this.bike.y - 40);

    if (activeRideStore.current) {
      this.applyRide(activeRideStore.current as Ride);
    } else {
      void this.loadRide();
    }
    this.exposeDebug();
  }

  private applyRide(ride: Ride): void {
    this.rideApplied = true;
    // Attract mode pulls back for a wide showroom shot; the follow lerp
    // only moves scroll, so zoom persists. Playable rides stay at 1.
    this.cameras.main.setZoom(ride.attract === true ? 0.62 : 1);
    this.attractLiftY = ride.attract === true ? 350 : 0;
    const terrain = buildTerrain(ride.series);
    this.terrain = terrain;
    this.rideDifficulty = ride.market.difficulty;
    this.trackRenderer.setTerrain(terrain);
    this.swapToTerrain(terrain);

    const course = terrain.points.filter((pt) => pt.x >= WORLD.spawnX - 1 && pt.x <= WORLD.finishX + 1);
    const stride = Math.max(1, Math.floor(course.length / 110));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < course.length; i += stride) pts.push([course[i].x, course[i].y]);
    const lastPt = course[course.length - 1];
    if (lastPt && pts[pts.length - 1] !== undefined && pts[pts.length - 1][0] !== lastPt.x) {
      pts.push([lastPt.x, lastPt.y]);
    }
    bus.emit(EV.TRACK, { pts });

    // Official contract numbers travel with the ride. The HUD shows these —
    // never range-derived values — so cards, preview, and game always agree.
    bus.emit(EV.MARKET, {
      question: ride.market.question,
      currentProb: ride.market.currentProb,
      probDelta: ride.market.probDelta,
    });
    this.lastRideMeta = {
      trackId: ride.market.id,
      trackHash: ride.market.trackHash,
      inverted: ride.inverted === true,
      interval: ride.interval ?? 'ALL',
    };
    this.replayPlayback = null;
    this.replayBike?.hide();
    this.doReset(true);
    this.matter.world.resume();
  }

  /** Full-body pose for the frame recorder. */
  private poseNow(): RecordedPose {
    const ragdoll = this.bike.ragdollBody;
    return {
      chassis: { x: this.bike.chassis.position.x, y: this.bike.chassis.position.y, angle: this.bike.chassis.angle },
      rear: {
        x: this.bike.rearWheel.position.x,
        y: this.bike.rearWheel.position.y,
        angle: this.bike.rearWheel.angle,
      },
      front: {
        x: this.bike.frontWheel.position.x,
        y: this.bike.frontWheel.position.y,
        angle: this.bike.frontWheel.angle,
      },
      ejected: this.bike.ejected,
      ragdoll: ragdoll ? { x: ragdoll.position.x, y: ragdoll.position.y, angle: ragdoll.angle } : null,
    };
  }

  /** Result payload from the frozen end marker (crash/finish moment), never
   *  from settled-ragdoll positions seconds later. */
  private resultPayload(finished: boolean): RunResult {
    const marker = this.endMarker ?? {
      step: this.stepCount,
      timeMs: this.score.timeMs,
      x: this.bike.x,
      outcome: finished ? ('finish' as const) : ('crash' as const),
    };
    const span = WORLD.finishX - this.rideSpawnX;
    const progress = span > 0 ? Math.min(1, Math.max(0, (marker.x - this.rideSpawnX) / span)) : 0;
    const meta = this.lastRideMeta;
    const recording: SharePayload =
      this.recorder !== null
        ? this.recorder.toSharePayload({
            endStep: marker.step,
            outcome: marker.outcome,
            progress,
            finalScore: this.score.total,
            finalTimeMs: this.score.timeMs,
          })
        : {
            trackId: meta?.trackId ?? 'unknown',
            trackHashPrefix: (meta?.trackHash ?? '').slice(0, 16).padEnd(16, '0'),
            inverted: meta?.inverted ?? false,
            interval: meta?.interval ?? 'ALL',
            beginStep: -1,
            endStep: Math.max(marker.step, 1),
            outcome: marker.outcome,
            progress,
            finalScore: this.score.total,
            finalTimeMs: this.score.timeMs,
            truncated: false,
            frames: [],
            tricks: [],
          };
    return {
      finished,
      score: this.score.total,
      timeMs: this.score.timeMs,
      difficulty: this.rideDifficulty,
      progress,
      recording,
      snapshots: this.recorder !== null ? this.recorder.toGhostSnapshots() : [],
    };
  }

  /** Start snapshot playback (replay viewer, crash loops). No physics runs:
   *  the cursor interpolates recorded poses, so this is exact by construction. */
  private startReplay(share: SharePayload, opts: ReplayStartOptions): void {
    if (!this.replayBike) return;
    const cursor = new PlaybackCursor(share.frames, share.tricks, share.beginStep, share.endStep, {
      timeScale: opts.timeScale ?? 1,
      paused: opts.paused ?? false,
    });
    cursor.onDone = () => bus.emit(EV.REPLAY_DONE);
    this.replayPlayback = { cursor, renderer: this.replayBike, focusX: 0, focusY: 0 };
    const fromStep = Math.max(0, Math.min(opts.fromStep ?? 0, share.endStep));
    cursor.seek(fromStep);
  }

  /** Seek is O(1): jump the cursor, nothing re-simulates. */
  private seekReplay(step: number): void {
    const playback = this.replayPlayback;
    if (!playback) return;
    playback.cursor.seek(step);
  }

  private stopReplay(): void {
    if (this.replayPlayback) {
      this.replayPlayback.renderer.hide();
      this.replayPlayback = null;
    }
    this.acc = 0;
    // Drain stale edge-triggered queues so a leftover jump/reset/mute from
    // the replay chrome can't fire into live play.
    this.inputMgr.consumeJump();
    this.inputMgr.takeReset();
    this.inputMgr.takeMute();
  }

  private exposeDebug(): void {
    (window as unknown as Record<string, unknown>).__oddsrider = {
      x: () => this.bike.x,
      y: () => this.bike.y,
      angle: () => this.bike.angle,
      speed: () => this.bike.speed,
      grounded: () => this.bike.grounded,
      crashed: () => this.bike.crashed,
      nitro: () => this.bike.nitro,
      zoom: () => this.cameras.main.zoom,
      prob: () => (this.terrain ? probabilityAt(this.terrain.points, this.bike.x) : null),
      score: () => this.score.total,
      simMs: () => this.score.timeMs,
      fps: () => Math.round(this.game.loop.actualFps),
      loopInfo: () => {
        const loop = this.game.loop as unknown as { delta: number; frame: number; fps: number; rawFps: number };
        return { delta: Math.round(loop.delta), frame: loop.frame, fps: Math.round(loop.fps), rawFps: Math.round(loop.rawFps) };
      },
      surfaceY: (x: number) => this.trackRenderer.groundYAt(x),
      probe: () => ({
        rear: this.bike.rearWheel.position,
        front: this.bike.frontWheel.position,
        rearAv: this.bike.rearWheel.angularVelocity,
        grounded: this.bike.grounded,
        chassisY: this.bike.chassis.position.y,
      }),
      reset: () => this.doReset(true),
      stepCount: () => this.stepCount,
      replayStep: () => (this.replayPlayback ? Math.floor(this.replayPlayback.cursor.step) : -1),
      replayTimeMs: () => (this.replayPlayback ? this.replayPlayback.cursor.timeMs() : this.score.timeMs),
      replayPose: () => {
        const pose = this.replayPlayback?.cursor.pose();
        return pose ? { ...pose } : null;
      },
      ghosts: () => this.ghost?.count ?? 0,
      /** Live recording so far (frames + ghost poses). */
      recording: () => {
        const marker = this.endMarker;
        const endStep = marker?.step ?? this.stepCount;
        if (!this.recorder || !this.lastRideMeta) return null;
        const share = this.recorder.toSharePayload({
          endStep,
          outcome: marker?.outcome ?? (this.bike.crashed ? 'crash' : 'finish'),
          progress: 0,
          finalScore: this.score.total,
          finalTimeMs: this.score.timeMs,
        });
        return {
          share,
          snapshots: this.recorder.toGhostSnapshots(),
          endStep,
        };
      },
      /** Start snapshot playback of a share payload (headless tests). */
      replayRun: (payload: SharePayload) => this.startReplay(payload, {}),
      /** Place the bike above a track position (test hook for screenshots). */
      teleport: (x: number) => {
        const y = this.trackRenderer.groundYAt(x) - 120;
        this.bike.moveTo(x, y);
      },
      /** Enter the genuine crash-handling path (test hook for result UX). */
      forceCrash: () => {
        this.bike.crashed = true;
      },
    };
  }

  private async loadRide(): Promise<void> {
    try {
      const ride = await fetchRide();
      // Never overwrite a ride the shell already delivered (attract race).
      if (!this.rideApplied) this.applyRide(ride);
    } catch (err) {
      console.warn('loadRide failed', err);
      bus.emit(EV.MARKET, null);
      this.matter.world.resume();
    }
  }

  private swapToTerrain(terrain: Terrain): void {
    if (this.flatGround) {
      this.matter.world.remove(this.flatGround);
      this.flatGround = null;
    }
    if (this.flatGfx) {
      this.flatGfx.destroy();
      this.flatGfx = null;
    }
    // Remove all previous terrain ground bodies from physics world
    for (const b of this.groundBodies) {
      this.matter.world.remove(b);
    }
    this.groundBodies = [];

    for (const seg of terrain.segments) {
      const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
      if (len < 1) continue;
      const ang = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
      const cx = (seg.ax + seg.bx) / 2 - (SEGMENT_THICKNESS / 2) * Math.sin(ang);
      const cy = (seg.ay + seg.by) / 2 + (SEGMENT_THICKNESS / 2) * Math.cos(ang);
      const body = this.matter.add.rectangle(cx, cy, len, SEGMENT_THICKNESS, {
        isStatic: true,
        angle: ang,
        friction: 1,
        frictionStatic: 1,
        restitution: 0,
        label: 'ground',
      });
      this.groundBodies.push(body);
    }
    const spawnX = WORLD.spawnX + 450;
    const spawnY = WORLD.groundTopY - WORLD.spawnDy;
    this.rideSpawnX = spawnX;
    this.bike.setSpawn(spawnX, spawnY);
    this.bike.reset();
    this.score.setCourse(spawnX);
    this.finishFx?.destroy();
    this.finishFx = new FinishCelebration(this, WORLD.finishX, this.trackRenderer.groundYAt(WORLD.finishX));
    this.placeGate(this.startGate, WORLD.spawnX + 600, WORLD.groundTopY);

    const wallX = WORLD.finishX + TERRAIN.runout + 60;
    const wallY = this.trackRenderer.groundYAt(wallX);
    // Idempotent: re-applying a ride must not stack duplicate walls (extra
    // static bodies change contact solving — and leak visuals).
    if (this.endWall) {
      this.matter.world.remove(this.endWall);
      this.endWall = null;
    }
    for (const obj of this.endWallGfx) obj.destroy();
    this.endWallGfx = [];
    this.endWallGfx.push(
      this.add.rectangle(wallX, wallY - 200, 80, 400, PALETTE.surface).setDepth(0),
      this.add.line(wallX - 40, wallY, 0, 0, 0, -400, PALETTE.surfaceLine).setOrigin(0, 1).setDepth(1),
    );
    this.endWall = this.matter.add.rectangle(wallX, wallY - 200, 80, 400, {
      isStatic: true,
      friction: 0.4,
      restitution: 0,
      label: 'ground',
    });
    this.acc = 0;
    this.cameras.main.centerOn(this.bike.x, this.bike.y - 40);
  }

  private buildFlatGround(): void {
    const g = this.add.graphics().setDepth(0);
    this.flatGfx = g;
    const y = WORLD.groundTopY;
    const half = WORLD.groundLength / 2;

    g.fillStyle(PALETTE.surface, 1);
    g.fillRect(-half, y, WORLD.groundLength, WORLD.groundThickness);
    g.lineStyle(2, PALETTE.surfaceLine, 1);
    g.lineBetween(-half, y, half, y);

    this.flatGround = this.matter.add.rectangle(half, y + WORLD.groundThickness / 2, WORLD.groundLength, WORLD.groundThickness, {
      isStatic: true,
      friction: 1,
      frictionStatic: 1,
      restitution: 0,
      label: 'ground',
    });
  }

  private createGate(x: number, y: number, text: string, color: number): Gate {
    const img = this.add.image(x, y, 'flag').setOrigin(0.5, 1).setScale(SPRITE.flagScale).setDepth(2);
    const label = this.add
      .text(x + 6, y - 80, text, {
        fontFamily: MONO,
        fontSize: '10px',
        color: color === PALETTE.crimson ? '#ff3355' : '#b6ff00',
      })
      .setOrigin(0, 0)
      .setDepth(2);
    return { img, label, color };
  }

  private placeGate(gate: Gate, x: number, y: number): void {
    gate.img.setPosition(x, y);
    gate.label.setPosition(x + 6, y - 80);
  }

  update(time: number, deltaMs: number): void {
    if (!this.terrain) return;
    
    if (this.inputMgr.takeReset()) this.doReset(true);
    if (this.inputMgr.takeMute()) {
      this.muted = !this.muted;
      storeMuted(this.muted);
      bus.emit(EV.MUTE, this.muted);
    }
    // Landing hook (additive): airborne → grounded transition feeds the
    // landing sound. Physics untouched.
    if (this.bike.grounded && !this.wasGrounded) bus.emit(EV.LAND);
    this.wasGrounded = this.bike.grounded;

    // fixed-step accumulator — physics never varies with frame rate.
    // Playback runs no physics at all: the cursor interpolates recorded
    // poses, so seeking is O(1) and slow motion is a cursor rate.
    const playback = this.replayPlayback;
    if (playback) {
      const advanced = playback.cursor.advance(deltaMs);
      const pose = playback.cursor.pose();
      if (pose) {
        playback.renderer.render(pose);
        playback.focusX = pose.c[0];
        playback.focusY = pose.c[1];
      }
      if (!advanced) this.acc = 0;
    }
    const dt = Math.min(deltaMs, 100);
    this.acc += dt;
    let steps = 0;
    const jump = this.inputMgr.consumeJump();
    const liveFirst = this.inputMgr.read();
    while (!playback && this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      const idx = this.stepCount;
      const input = this.inputMgr.read();
      const drive: DriveInput = this.score.finished
        ? { ...FINISH_BRAKE }
        : { ...input, jumpQueued: jump && steps === 0 };
      if (
        !this.score.started &&
        (drive.gas || drive.brake || drive.leanBack || drive.leanFwd || drive.nitro || drive.jumpQueued)
      ) {
        this.score.begin();
        this.recorder?.markBegin(idx);
      }
      this.bike.step(drive);
      this.acc -= STEP_MS;
      steps++;
      this.stepCount++;
      if (!this.endMarker) {
        this.recorder?.record(idx, this.poseNow());
      }
    }
    if (steps === MAX_STEPS_PER_FRAME && this.acc > STEP_MS) this.acc = 0;
    // Only tick score while alive — stops timer after crash
    if (!playback && !this.bike.crashed) this.score.step(steps * STEP_MS, this.bike.x);
    if (!playback && !this.bike.crashed && !this.score.finished) {
      this.detectTricks(steps * STEP_MS, liveFirst.nitro && this.bike.nitro > 0);
    }
    if (!playback && this.parked) this.bike.park();

    this.trackRenderer.update();
    this.bikeRenderer.setHidden(playback !== null);
    this.bikeRenderer.render(this.bike);
    if (this.ghost && !playback) this.ghost.update(this.score.timeMs);

    if (this.bike.crashed && !this.crashHandled) {
      this.crashHandled = true;
      this.score.applyCrash();
      this.endMarker = { step: this.stepCount, timeMs: this.score.timeMs, x: this.bike.x, outcome: 'crash' };
      bus.emit(EV.CRASH);
      bus.emit(EV.COMBO, 1);
      // Snapshot the camera target at the moment of crash — avoids camera chasing the bouncing ragdoll
      this.crashCamX = this.bike.chassis.position.x;
      this.crashCamY = this.bike.chassis.position.y;
      this.resultTimer = this.time.delayedCall(1400, () => {
        bus.emit(EV.RESULT, this.resultPayload(false));
      });
    }

    if (!this.score.finished && !this.bike.crashed && this.bike.x >= WORLD.finishX) {
      this.score.applyFinish();
      this.endMarker = { step: this.stepCount, timeMs: this.score.timeMs, x: this.bike.x, outcome: 'finish' };
      this.finishFx?.cross();
      this.resultTimer = this.time.delayedCall(1100, () => {
        this.parked = true;
        bus.emit(EV.RESULT, this.resultPayload(true));
      });
    }

    // camera: lerp follow with velocity lookahead
    const cam = this.cameras.main;
    const spd = Math.abs(this.bike.speed);
    let tx: number;
    let ty: number;
    if (playback) {
      // Replay framing follows the recorded pose, same lerp feel.
      tx = playback.focusX;
      ty = playback.focusY - 40 + this.attractLiftY;
    } else if (this.bike.crashed) {
      // After crash: smoothly zoom out and hold at crash position — don't chase ragdoll
      tx = this.crashCamX;
      ty = this.crashCamY - 60;
    } else {
      const dir = Math.sign(this.bike.chassis.velocity.x) || 1;
      const look = dir * Math.min(spd * 0.22, 220);
      tx = this.bike.chassis.position.x + look;
      ty = this.bike.chassis.position.y - 40 + this.attractLiftY;
    }
    cam.scrollX += (tx - cam.width / 2 - cam.scrollX) * 0.08;
    cam.scrollY += (ty - cam.height / 2 - cam.scrollY) * 0.08;

    if (time > this.nextSpeedEmitAt) {
      this.nextSpeedEmitAt = time + 100;
      // Convert physics px/step speed to km/h (feels natural for a dirt bike: 0 to ~250 km/h range)
      bus.emit(EV.SPEED, Math.round(spd * 0.06));
    }
    if (time > this.nextNitroEmitAt) {
      this.nextNitroEmitAt = time + 120;
      bus.emit(EV.NITRO, this.bike.nitro);
    }
    if (time > this.nextGroundedEmitAt) {
      this.nextGroundedEmitAt = time + 80;
      bus.emit(EV.GROUNDED, this.bike.grounded);
    }
    if (this.terrain && time > this.nextProbEmitAt) {
      this.nextProbEmitAt = time + 150;
      bus.emit(EV.PROB, probabilityAt(this.terrain.points, this.bike.x));
      const span = WORLD.finishX - this.rideSpawnX;
      bus.emit(EV.POSITION, span > 0 ? Math.min(1, Math.max(0, (this.bike.x - this.rideSpawnX) / span)) : 0);
    }
    if (time > this.nextScoreEmitAt) {
      this.nextScoreEmitAt = time + 150;
      bus.emit(EV.SCORE, { total: this.score.total, timeMs: this.score.timeMs, finished: this.score.finished, combo: this.score.combo });
    }
  }

  private detectTricks(dtMs: number, nitroBurning: boolean): void {
    if (dtMs <= 0) {
      this.lastTrickAngle = this.bike.angle;
      return;
    }
    const angle = this.bike.angle;
    let d = angle - this.lastTrickAngle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.lastTrickAngle = angle;

    if (!this.bike.grounded) {
      this.trickAirMs += dtMs;
      this.rotAcc += d;
      while (this.rotAcc >= Math.PI * 2 || this.rotAcc <= -Math.PI * 2) {
        const backflip = this.rotAcc < 0;
        this.rotAcc += backflip ? Math.PI * 2 : -Math.PI * 2;
        this.popup(backflip ? 'BACKFLIP' : 'FRONTFLIP', this.score.awardTrick(500));
      }
      return;
    }

    if (this.trickAirMs >= 1400) {
      this.popup('BIG AIR', this.score.awardAir());
    }
    this.trickAirMs = 0;
    this.rotAcc = 0;

    // Ground-trick counters freeze across brief hops and reset only
    // once the bike clearly levels out — porpoising must not eat progress.
    // Wheelie band sits just outside cruise pitch noise (±0.07).
    if (angle < -0.08) {
      if (this.wheelieMs >= 0) {
        this.wheelieMs += dtMs;
        if (this.wheelieMs >= 1000) {
          this.popup('WHEELIE', this.score.awardTrick(300));
          this.wheelieMs = -2000;
        }
      } else {
        this.wheelieMs += dtMs;
      }
    } else if (angle > 0) {
      this.wheelieMs = 0;
    }

    if (angle > 0.35) {
      if (this.stoppieMs >= 0) {
        this.stoppieMs += dtMs;
        if (this.stoppieMs >= 1200) {
          this.popup('STOPPIE', this.score.awardTrick(400));
          this.stoppieMs = -2000;
        }
      } else {
        this.stoppieMs += dtMs;
      }
    } else if (angle < 0.1) {
      this.stoppieMs = 0;
    }

    // Speed demon: hold near top speed. Nitro burn: small trickle bonus.
    if (Math.abs(this.bike.speed) >= 1200) {
      this.speedDemonMs += dtMs;
      if (this.speedDemonMs >= 5000) {
        this.popup('SPEED DEMON', this.score.awardTrick(200));
        this.speedDemonMs = 0;
      }
    } else {
      this.speedDemonMs = 0;
    }

    if (nitroBurning) {
      this.nitroMs += dtMs;
      if (this.nitroMs >= 3000) {
        this.popup('NITRO BURN', this.score.awardFlat(30));
        this.nitroMs = 0;
      }
    } else {
      this.nitroMs = 0;
    }
  }

  private popup(text: string, points: number): void {
    this.popupId += 1;
    if (!this.endMarker) {
      const code = trickCodeFor(text);
      if (code !== 0) this.recorder?.recordTrick(this.stepCount, code, points);
    }
    bus.emit(EV.POPUP, { id: this.popupId, text, points });
    bus.emit(EV.COMBO, this.score.combo);
  }

  private doReset(full: boolean): void {
    if (this.resultTimer) {
      this.resultTimer.destroy();
      this.resultTimer = null;
    }
    // A reset starts a new run: replay/drive state restarts from step 0.
    this.stepCount = 0;
    this.acc = 0;
    this.endMarker = null;
    this.recorder = this.lastRideMeta
      ? new RunRecorder(
          this.lastRideMeta.trackId,
          this.lastRideMeta.trackHash,
          this.lastRideMeta.inverted,
          this.lastRideMeta.interval,
        )
      : null;
    // Pristine collision state: stale pairs from before the reset would
    // otherwise resolve differently than a fresh run (replay-exactness).
    // Detector state rebuilds from current bounds every update.
    const engine = this.matter.world.engine as unknown as {
      pairs?: { table: Record<string, unknown>; list: unknown[] };
      world?: { isModified: boolean };
    } | undefined;
    if (engine?.pairs) {
      engine.pairs.table = {};
      engine.pairs.list = [];
    }
    // The position solver warm-starts from each body's impulse cache,
    // including static terrain — clear every cached impulse or identical
    // resets diverge within steps (replay-exactness).
    for (const body of [...this.groundBodies, this.flatGround, this.endWall]) {
      if (body) {
        body.positionImpulse.x = 0;
        body.positionImpulse.y = 0;
      }
    }
    // Re-seed the detector's body order canonically: it sorts bodies in
    // place every update, so a stale order (with tied bounds) resolves
    // contacts differently than a fresh run.
    if (engine?.world) {
      engine.world.isModified = true;
    }
    this.crashHandled = false;
    this.parked = false;
    this.trickAirMs = 0;
    this.wheelieMs = 0;
    this.stoppieMs = 0;
    this.speedDemonMs = 0;
    this.nitroMs = 0;
    this.rotAcc = 0;
    this.popupId = 0;
    if (full) this.score.fullReset();
    this.bike.reset();
    // Sync AFTER the bike moves: post-reset angle is exactly 0.
    this.lastTrickAngle = this.bike.angle;
    this.acc = 0;
    this.crashCamX = this.bike.x;
    this.crashCamY = this.bike.y;
    const cam = this.cameras.main;
    cam.centerOn(this.bike.x, this.bike.y - 40);
    cam.scrollX = this.bike.x - cam.width / 2;
    cam.scrollY = this.bike.y - 40 - cam.height / 2;
    bus.emit(EV.RESULT, null);
    bus.emit(EV.SCORE, { total: this.score.total, timeMs: this.score.timeMs, finished: this.score.finished, combo: this.score.combo });
    bus.emit(EV.SPEED, 0);
  }
}
