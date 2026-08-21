import Phaser from 'phaser';
import { bus, EV } from '../bus';
import { PALETTE, WORLD } from '../constants';
import { Bike } from '../bike/Bike';
import { BikeController } from '../bike/BikeController';
import { BikeRenderer } from '../bike/BikeRenderer';
import { InputManager } from '../input/InputManager';

const MONO = 'JetBrains Mono, monospace';

export class RideScene extends Phaser.Scene {
  private bike!: Bike;
  private ctrl!: BikeController;
  private bikeRenderer!: BikeRenderer;
  private inputMgr!: InputManager;
  private muted = false;
  private nextSpeedEmitAt = 0;

  constructor() {
    super('ride');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.buildGround();
    this.drawGate(WORLD.spawnX - 70, 'START', PALETTE.toxic);
    this.drawGate(WORLD.finishX, 'FINISH', PALETTE.crimson);

    this.bike = new Bike(this, WORLD.spawnX, WORLD.groundTopY - 140);
    this.ctrl = new BikeController(this, this.bike);
    this.bikeRenderer = new BikeRenderer(this);
    this.inputMgr = new InputManager(this);

    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.centerOn(this.bike.x, this.bike.y - 130);
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
      label: 'ground',
    });
  }

  private drawGate(x: number, label: string, color: number): void {
    const g = this.add.graphics().setDepth(2);
    const topY = WORLD.groundTopY - 110;
    g.lineStyle(3, color, 0.9);
    g.lineBetween(x, WORLD.groundTopY, x, topY);
    g.fillStyle(color, 0.95);
    g.fillTriangle(x, topY, x + 34, topY + 10, x, topY + 20);
    this.add
      .text(x + 6, topY + 30, label, {
        fontFamily: MONO,
        fontSize: '10px',
        color: '#7c7f86',
      })
      .setOrigin(0, 0)
      .setDepth(2);
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 33) / 1000;

    if (this.inputMgr.takeReset()) this.doReset();
    if (this.inputMgr.takeMute()) {
      this.muted = !this.muted;
      bus.emit(EV.MUTE, this.muted);
    }

    const input = this.inputMgr.readAndConsume();
    this.ctrl.update(dt, input);
    this.bikeRenderer.render(this.bike, {
      leanDir: (input.leanBack ? -1 : 0) + (input.leanForward ? 1 : 0),
      throttle: input.gas ? 1 : 0,
      nitro: this.ctrl.nitroActive,
      brake: input.brake,
    });

    const cam = this.cameras.main;
    const b = this.bike.chassis;
    const lookX = Phaser.Math.Clamp(b.velocity.x * 0.45, -300, 300);
    const targetX = b.position.x + lookX;
    const targetY = b.position.y - 130;
    const desiredScrollX = targetX - cam.width / (2 * cam.zoom);
    const desiredScrollY = targetY - cam.height / (2 * cam.zoom);
    cam.scrollX += (desiredScrollX - cam.scrollX) * 0.09;
    cam.scrollY += (desiredScrollY - cam.scrollY) * 0.06;
    const zoomTarget = 1 - Math.min(Math.abs(b.velocity.x) / 4200, 0.12);
    cam.zoom += (zoomTarget - cam.zoom) * 0.04;

    if (time > this.nextSpeedEmitAt) {
      this.nextSpeedEmitAt = time + 100;
      bus.emit(EV.SPEED, Math.round(Math.abs(b.velocity.x)));
    }
  }

  private doReset(): void {
    this.bike.reset();
    const cam = this.cameras.main;
    cam.centerOn(this.bike.x, this.bike.y - 130);
  }
}
