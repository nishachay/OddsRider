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
import { GhostRenderer } from '../ghost';
import { RunRecorder, SNAPSHOT_EVERY_STEPS, takePendingGhost, trickCodeFor, type RecordedPose, type RunResult } from '../replay';
import type { GhostSnapshot } from '@oddsrider/core';

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

  // Ghosts (read-only): the scene samples body poses while a run is alive and
  // draws the player's saved best as a translucent, physics-free rider. No
  // physics, tuning or stepping is touched — recording only reads poses.
  private ghost: GhostRenderer | null = null;
  private recorder: RunRecorder | null = null;
  /** Physics steps since the last full reset — the recorder's clock. */
  private stepCount = 0;
  private rideMeta: {
    trackId: string;
    trackHash: string;
    inverted: boolean;
    interval: 'ALL' | '24H' | '7D';
    /** The home-stage backdrop never records or races a ghost. */
    attract: boolean;
  } | null = null;

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
    this.inputMgr = new InputManager();

    // Store handle so we can remove it on shutdown — prevents duplicate listeners on hot reload
    if (this.offRestart) this.offRestart();
    this.offRestart = bus.on(EV.RESTART, () => this.doReset(true));
    const offLoadMarket = bus.on<Ride>(EV.LOAD_MARKET, (ride) => this.applyRide(ride));
    const offGhost = bus.on<{ snapshots: GhostSnapshot[] | null }>(EV.GHOST_SET, ({ snapshots }) =>
      this.ghost?.setSnapshots(snapshots),
    );
    // Detach on shutdown AND destroy: game.destroy() tears down systems
    // via destroy (not shutdown), so shutdown-only cleanup leaks bus and
    // input listeners into the next mounted game. Detach is idempotent.
    const detach = () => {
      this.inputMgr.destroy();
      if (this.offRestart) { this.offRestart(); this.offRestart = null; }
      offLoadMarket();
      offGhost();
      this.ghost?.destroy();
      this.ghost = null;
      this.recorder = null;
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
    const attract = ride.attract === true;
    const next = {
      trackId: ride.market.id,
      trackHash: ride.market.trackHash,
      inverted: ride.inverted === true,
      interval: ride.interval ?? 'ALL',
      attract,
    };
    // The feed re-emits the same ride on its poll; that is not a new terrain.
    // Only a genuinely different ride re-arms the ghost, so a duplicate
    // LOAD_MARKET cannot steal the ghost the rider asked to race.
    const newTerrain =
      !this.rideMeta ||
      this.rideMeta.trackId !== next.trackId ||
      this.rideMeta.inverted !== next.inverted ||
      this.rideMeta.interval !== next.interval;
    this.rideMeta = next;
    this.doReset(true);
    if (newTerrain) {
      // A run armed from a shared link ("Race this run" / "Race your best") is
      // handed over through replay.ts before navigation — no bus timing to
      // lose. No armed ghost means no ghost: nothing is drawn unasked for.
      this.ghost?.setSnapshots(attract ? null : takePendingGhost());
    }
    this.matter.world.resume();
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
    this.add.rectangle(wallX, wallY - 200, 80, 400, PALETTE.surface).setDepth(0);
    this.add.line(wallX - 40, wallY, 0, 0, 0, -400, PALETTE.surfaceLine).setOrigin(0, 1).setDepth(1);
    this.matter.add.rectangle(wallX, wallY - 200, 80, 400, {
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

    // fixed-step accumulator — physics never varies with frame rate
    const dt = Math.min(deltaMs, 100);
    this.acc += dt;
    let steps = 0;
    const jump = this.inputMgr.consumeJump();
    const firstRead = this.inputMgr.read();
    if (!this.score.started && (firstRead.gas || firstRead.brake || firstRead.leanBack || firstRead.leanFwd || firstRead.nitro || jump)) {
      this.score.begin();
    }
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      const input = this.inputMgr.read();
      const drive: DriveInput = this.score.finished
        ? { gas: false, brake: true, leanBack: false, leanFwd: false, nitro: false, jumpQueued: false }
        : { ...input, jumpQueued: jump && steps === 0 };
      this.bike.step(drive);
      this.acc -= STEP_MS;
      steps++;
      this.sampleStep();
    }
    if (steps === MAX_STEPS_PER_FRAME && this.acc > STEP_MS) this.acc = 0;
    // Only tick score while alive — stops timer after crash
    if (!this.bike.crashed) this.score.step(steps * STEP_MS, this.bike.x);
    if (!this.bike.crashed && !this.score.finished) {
      this.detectTricks(steps * STEP_MS, firstRead.nitro && this.bike.nitro > 0);
    }
    if (this.parked) this.bike.park();

    this.trackRenderer.update();
    this.bikeRenderer.render(this.bike);
    // Ghost (additive, render-only): posed on the run clock so it never
    // drifts ahead of or behind the rider's own timer.
    this.ghost?.update(this.score.timeMs);

    if (this.bike.crashed && !this.crashHandled) {
      this.crashHandled = true;
      this.score.applyCrash();
      bus.emit(EV.CRASH);
      bus.emit(EV.COMBO, 1);
      // Snapshot the camera target at the moment of crash — avoids camera chasing the bouncing ragdoll
      this.crashCamX = this.bike.chassis.position.x;
      this.crashCamY = this.bike.chassis.position.y;
      this.resultTimer = this.time.delayedCall(1400, () => {
        bus.emit(EV.RESULT, {
          finished: false,
          score: this.score.total,
          timeMs: this.score.timeMs,
          difficulty: this.rideDifficulty,
        });
        this.emitRunResult(false);
      });
    }

    if (!this.score.finished && !this.bike.crashed && this.bike.x >= WORLD.finishX) {
      this.score.applyFinish();
      this.finishFx?.cross();
      this.resultTimer = this.time.delayedCall(1100, () => {
        this.parked = true;
        bus.emit(EV.RESULT, {
          finished: true,
          score: this.score.total,
          timeMs: this.score.timeMs,
          difficulty: this.rideDifficulty,
        });
        this.emitRunResult(true);
      });
    }

    // camera: lerp follow with velocity lookahead
    const cam = this.cameras.main;
    const spd = Math.abs(this.bike.speed);
    let tx: number;
    let ty: number;
    if (this.bike.crashed) {
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
    bus.emit(EV.POPUP, { id: this.popupId, text, points });
    bus.emit(EV.COMBO, this.score.combo);
    // Trick events ride along with the recording (read-only, no physics).
    this.recorder?.recordTrick(this.stepCount, trickCodeFor(text), points);
  }

  /**
   * One frame of read-only pose sampling. Recording starts with the run and
   * samples every third physics step (20 Hz); it never touches the bodies.
   */
  private sampleStep(): void {
    const recorder = this.recorder;
    this.stepCount += 1;
    if (!recorder || !this.score.started) return;
    if (this.stepCount % SNAPSHOT_EVERY_STEPS !== 0) return;
    const pose: RecordedPose = {
      chassis: { x: this.bike.chassis.position.x, y: this.bike.chassis.position.y, angle: this.bike.chassis.angle },
      rear: { x: this.bike.rearWheel.position.x, y: this.bike.rearWheel.position.y, angle: this.bike.rearWheel.angle },
      front: { x: this.bike.frontWheel.position.x, y: this.bike.frontWheel.position.y, angle: this.bike.frontWheel.angle },
      ejected: this.bike.ejected,
      ragdoll: this.bike.ragdollBody
        ? { x: this.bike.ragdollBody.position.x, y: this.bike.ragdollBody.position.y, angle: this.bike.ragdollBody.angle }
        : null,
    };
    recorder.markBegin(this.stepCount);
    recorder.record(this.stepCount, pose);
  }

  /**
   * Publish the enriched run result (additive): the recording, the ghost
   * poses and where the run ended. The React chrome saves the best ghost
   * from this event — the scene never writes storage itself.
   */
  private emitRunResult(finished: boolean): void {
    const recorder = this.recorder;
    if (!recorder || recorder.frameCount === 0) return;
    const span = WORLD.finishX - this.rideSpawnX;
    const progress = finished || span <= 0 ? 1 : Math.min(1, Math.max(0, (this.crashCamX - this.rideSpawnX) / span));
    const result: RunResult = {
      finished,
      score: this.score.total,
      timeMs: this.score.timeMs,
      difficulty: this.rideDifficulty,
      progress,
      recording: recorder.toSharePayload({
        endStep: this.stepCount,
        outcome: finished ? 'finish' : 'crash',
        progress,
        finalScore: this.score.total,
        finalTimeMs: this.score.timeMs,
      }),
      snapshots: recorder.toGhostSnapshots(),
    };
    bus.emit(EV.RUN_RESULT, result);
    // The run is closed: stop sampling so the recording cannot keep growing
    // while the result sits on screen. The next reset starts a new one.
    this.recorder = null;
  }

  private doReset(full: boolean): void {
    if (this.resultTimer) {
      this.resultTimer.destroy();
      this.resultTimer = null;
    }
    this.crashHandled = false;
    // A full reset is a new run: a fresh recording and step clock. The
    // attract backdrop never records — it would grow without a result.
    if (full) {
      this.stepCount = 0;
      this.recorder = this.rideMeta && !this.rideMeta.attract
        ? new RunRecorder(this.rideMeta.trackId, this.rideMeta.trackHash, this.rideMeta.inverted, this.rideMeta.interval)
        : null;
    }
    this.parked = false;
    this.trickAirMs = 0;
    this.wheelieMs = 0;
    this.stoppieMs = 0;
    this.speedDemonMs = 0;
    this.nitroMs = 0;
    this.rotAcc = 0;
    if (full) this.score.fullReset();
    this.bike.reset();
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
