import Phaser from 'phaser';
import { bus, EV } from '../bus';
import { PALETTE, WORLD, STEP_MS, MAX_STEPS_PER_FRAME, SPRITE } from '../constants';
import { Bike } from '../bike/Bike';
import type { DriveInput } from '../bike/Bike';
import { BikeRenderer } from '../bike/BikeRenderer';
import { InputManager } from '../input/InputManager';

const MONO = 'JetBrains Mono, monospace';

export class RideScene extends Phaser.Scene {
  private bike!: Bike;
  private bikeRenderer!: BikeRenderer;
  private inputMgr!: InputManager;

  private muted = false;
  private acc = 0;
  private crashHandled = false;
  private nextSpeedEmitAt = 0;
  private nextNitroEmitAt = 0;

  constructor() {
    super('ride');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.buildGround();
    this.drawGate(WORLD.spawnX - 70, 'START', PALETTE.toxic);
    this.drawGate(WORLD.finishX, 'FINISH', PALETTE.crimson);

    this.bike = new Bike(this, WORLD.spawnX, WORLD.groundTopY - WORLD.spawnDy);
    this.bikeRenderer = new BikeRenderer(this);
    this.inputMgr = new InputManager();

    const cam = this.cameras.main;
    cam.centerOn(this.bike.x, this.bike.y - 40);

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
      reset: () => this.doReset(),
    };
  }

  private buildGround(): void {
    const g = this.add.graphics().setDepth(0);
    const y = WORLD.groundTopY;
    const half = WORLD.groundLength / 2;

    g.fillStyle(PALETTE.surface, 1);
    g.fillRect(-half, y, WORLD.groundLength, WORLD.groundThickness);
    g.lineStyle(2, PALETTE.surfaceLine, 1);
    g.lineBetween(-half, y, half, y);
    g.lineStyle(1, PALETTE.tick, 0.9);
    for (let x = 0; x <= WORLD.groundLength; x += WORLD.tickSpacing) {
      g.lineBetween(x, y + 2, x, y + 16);
    }

    for (let x = 0; x <= WORLD.markerMaxX; x += WORLD.markerSpacing) {
      this.add
        .text(x, y + 28, `${x / 1000}K`, {
          fontFamily: MONO,
          fontSize: '11px',
          color: '#7c7f86',
        })
        .setOrigin(0.5, 0)
        .setDepth(1);
    }

    this.matter.add.rectangle(half, y + WORLD.groundThickness / 2, WORLD.groundLength, WORLD.groundThickness, {
      isStatic: true,
      friction: 1,
      frictionStatic: 1,
      restitution: 0,
      label: 'ground',
    });
  }

  private drawGate(x: number, label: string, color: number): void {
    this.add.image(x, WORLD.groundTopY, 'flag').setOrigin(0.5, 1).setScale(SPRITE.flagScale).setDepth(2);
    this.add
      .text(x + 6, WORLD.groundTopY - 80, label, {
        fontFamily: MONO,
        fontSize: '10px',
        color: color === PALETTE.crimson ? '#ff3355' : '#b6ff00',
      })
      .setOrigin(0, 0)
      .setDepth(2);
  }

  update(time: number, deltaMs: number): void {
    if (this.inputMgr.takeReset()) this.doReset();
    if (this.inputMgr.takeMute()) {
      this.muted = !this.muted;
      bus.emit(EV.MUTE, this.muted);
    }

    // fixed-step accumulator — physics never varies with frame rate
    const dt = Math.min(deltaMs, 100);
    this.acc += dt;
    let steps = 0;
    const jump = this.inputMgr.consumeJump();
    while (this.acc >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      const input = this.inputMgr.read();
      const drive: DriveInput = { ...input, jumpQueued: jump && steps === 0 };
      this.bike.step(drive);
      this.acc -= STEP_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME && this.acc > STEP_MS) this.acc = 0;

    this.bikeRenderer.render(this.bike);

    if (this.bike.crashed && !this.crashHandled) {
      this.crashHandled = true;
      bus.emit(EV.CRASH);
      this.time.delayedCall(900, () => this.doReset());
    }

    // camera: lerp follow with velocity lookahead (chase the ragdoll after a crash)
    const cam = this.cameras.main;
    const ragdoll = this.bike.ejected ? this.bike.ragdollBody : null;
    const p = ragdoll ? ragdoll.position : this.bike.chassis.position;
    const spd = Math.abs(this.bike.speed);
    const dir = Math.sign(this.bike.chassis.velocity.x) || 1;
    const look = dir * Math.min(spd * 0.22, 220);
    const tx = p.x + look;
    const ty = p.y - 40;
    cam.scrollX += (tx - cam.width / 2 - cam.scrollX) * 0.08;
    cam.scrollY += (ty - cam.height / 2 - cam.scrollY) * 0.08;

    if (time > this.nextSpeedEmitAt) {
      this.nextSpeedEmitAt = time + 100;
      bus.emit(EV.SPEED, Math.round(spd));
    }
    if (time > this.nextNitroEmitAt) {
      this.nextNitroEmitAt = time + 120;
      bus.emit(EV.NITRO, this.bike.nitro);
    }
  }

  private doReset(): void {
    this.crashHandled = false;
    this.bike.reset();
    this.acc = 0;
    const cam = this.cameras.main;
    cam.centerOn(this.bike.x, this.bike.y - 40);
  }
}
