import Phaser from 'phaser';
import { bus, EV } from '../bus';
import { PALETTE, WORLD, STEP_MS, MAX_STEPS_PER_FRAME, SPRITE, TERRAIN } from '../constants';
import { Bike } from '../bike/Bike';
import type { DriveInput } from '../bike/Bike';
import { BikeRenderer } from '../bike/BikeRenderer';
import { InputManager } from '../input/InputManager';
import { fetchRide } from '../../data/polymarket';
import { buildTerrain, probabilityAt } from '../terrain';
import type { Terrain } from '../terrain';
import { TrackRenderer } from '../track/TrackRenderer';
import { RideScore } from '../score';
import { FinishCelebration } from '../finish';

const MONO = 'JetBrains Mono, monospace';
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
  private startGate!: Gate;
  private finishFx: FinishCelebration | null = null;
  private resultTimer: Phaser.Time.TimerEvent | null = null;
  private rideSpawnX = WORLD.spawnX;
  private offRestart: (() => void) | null = null;

  private muted = false;
  private acc = 0;
  private crashHandled = false;
  private nextSpeedEmitAt = 0;
  private nextNitroEmitAt = 0;
  private nextProbEmitAt = 0;
  private nextScoreEmitAt = 0;
  private nextGroundedEmitAt = 0;
  private score = new RideScore();
  private parked = false;

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
    this.inputMgr = new InputManager();

    // Store handle so we can remove it on shutdown — prevents duplicate listeners on hot reload
    if (this.offRestart) this.offRestart();
    this.offRestart = bus.on(EV.RESTART, () => this.doReset(true));
    this.events.once('shutdown', () => {
      if (this.offRestart) { this.offRestart(); this.offRestart = null; }
    });

    const cam = this.cameras.main;
    cam.centerOn(this.bike.x, this.bike.y - 40);

    void this.loadRide();
    this.exposeDebug();
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
      const terrain = buildTerrain(ride.series);
      this.terrain = terrain;
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

      const series = ride.series;
      const probNow = series[series.length - 1]?.p ?? 0.5;
      const probDelta = probNow - (series[0]?.p ?? probNow);
      bus.emit(EV.MARKET, { question: ride.market.question, probNow, probDelta });
      
      this.matter.world.resume();
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
    for (const seg of terrain.segments) {
      const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay);
      if (len < 1) continue;
      const ang = Math.atan2(seg.by - seg.ay, seg.bx - seg.ax);
      const cx = (seg.ax + seg.bx) / 2 - (SEGMENT_THICKNESS / 2) * Math.sin(ang);
      const cy = (seg.ay + seg.by) / 2 + (SEGMENT_THICKNESS / 2) * Math.cos(ang);
      this.matter.add.rectangle(cx, cy, len, SEGMENT_THICKNESS, {
        isStatic: true,
        angle: ang,
        friction: 1,
        frictionStatic: 1,
        restitution: 0,
        label: 'ground',
      });
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
      bus.emit(EV.MUTE, this.muted);
    }

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
    }
    if (steps === MAX_STEPS_PER_FRAME && this.acc > STEP_MS) this.acc = 0;
    // Only tick score while alive — stops timer after crash
    if (!this.bike.crashed) this.score.step(steps * STEP_MS, this.bike.x);
    if (this.parked) this.bike.park();

    this.trackRenderer.update();
    this.bikeRenderer.render(this.bike);

    if (this.bike.crashed && !this.crashHandled) {
      this.crashHandled = true;
      this.score.applyCrash();
      bus.emit(EV.CRASH);
      // Snapshot the camera target at the moment of crash — avoids camera chasing the bouncing ragdoll
      this.crashCamX = this.bike.chassis.position.x;
      this.crashCamY = this.bike.chassis.position.y;
      this.resultTimer = this.time.delayedCall(1400, () => {
        bus.emit(EV.RESULT, {
          finished: false,
          score: this.score.total,
          timeMs: this.score.timeMs,
        });
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
        });
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
      ty = this.bike.chassis.position.y - 40;
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
      bus.emit(EV.SCORE, { total: this.score.total, timeMs: this.score.timeMs, finished: this.score.finished });
    }
  }

  private doReset(full: boolean): void {
    if (this.resultTimer) {
      this.resultTimer.destroy();
      this.resultTimer = null;
    }
    this.crashHandled = false;
    this.parked = false;
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
    bus.emit(EV.SCORE, { total: this.score.total, timeMs: this.score.timeMs, finished: this.score.finished });
    bus.emit(EV.SPEED, 0);
  }
}
