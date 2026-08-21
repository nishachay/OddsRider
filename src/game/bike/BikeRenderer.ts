import type Phaser from 'phaser';
import { PALETTE, PHYSICS } from '../constants';
import type { Bike } from './Bike';

export interface RenderState {
  leanDir: number;
  throttle: number;
  nitro: boolean;
  brake: boolean;
}

const P = PALETTE;

export class BikeRenderer {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(10);
  }

  render(bike: Bike, s: RenderState): void {
    const g = this.g;
    g.clear();

    this.drawWheel(bike.rearWheel);
    this.drawWheel(bike.frontWheel);

    const chassis = bike.chassis;
    const cx = chassis.position.x;
    const cy = chassis.position.y;
    const ang = chassis.angle;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);

    const rearLocal = this.toLocal(bike.rearWheel.position, cx, cy, c, sn);
    const frontLocal = this.toLocal(bike.frontWheel.position, cx, cy, c, sn);

    g.save();
    g.translateCanvas(cx, cy);
    g.rotateCanvas(ang);

    // swingarm + fork
    g.lineStyle(5, P.metal, 1);
    g.lineBetween(-8, 4, rearLocal.x, rearLocal.y);
    g.lineStyle(4, P.metal, 1);
    g.lineBetween(18, -6, frontLocal.x, frontLocal.y);

    // exhaust
    g.fillStyle(P.metal, 1);
    g.fillRect(-38, 0, 22, 6);

    // body polygon
    g.fillStyle(P.body, 1);
    g.lineStyle(1.5, P.bodyEdge, 1);
    g.beginPath();
    g.moveTo(-34, 8);
    g.lineTo(-38, -2);
    g.lineTo(-20, -10);
    g.lineTo(6, -12);
    g.lineTo(26, -4);
    g.lineTo(30, 6);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // toxic accent lines
    g.lineStyle(2, P.toxic, s.brake ? 0.45 : 0.95);
    g.lineBetween(-30, -4, -6, -9);
    g.lineBetween(4, -10, 20, -6);

    // handlebar
    g.lineStyle(3, P.metal, 1);
    g.lineBetween(22, -10, 28, -16);

    // rider
    this.drawRider(s.leanDir * 7, s.throttle);

    // nitro flame
    if (s.nitro) this.drawFlame();

    g.restore();
  }

  private toLocal(p: MatterJS.Vector, cx: number, cy: number, c: number, s: number): MatterJS.Vector {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return { x: dx * c + dy * s, y: -dx * s + dy * c };
  }

  private drawRider(leanShift: number, throttle: number): void {
    const g = this.g;
    const hipX = -8 + leanShift * 0.4;
    const shoulderX = 2 + leanShift;
    const shoulderY = -30;
    const headX = 6 + leanShift * 1.3;
    const headY = -38;

    // torso
    g.lineStyle(7, P.suit, 1);
    g.lineBetween(hipX, -14, shoulderX, shoulderY);
    // arm
    g.lineStyle(4, P.suit, 1);
    g.lineBetween(shoulderX, shoulderY, 24, -14 + throttle * -1);
    // leg
    g.lineStyle(5, P.suit, 1);
    g.lineBetween(hipX, -14, -16, 0);
    g.lineBetween(-16, 0, -10, 8);

    // helmet
    g.fillStyle(P.suit, 1);
    g.fillCircle(headX, headY, 8);
    g.lineStyle(1.5, P.bodyEdge, 1);
    g.strokeCircle(headX, headY, 8);
    // visor slit
    g.fillStyle(P.visor, 1);
    g.fillRect(headX + 1, headY - 4, 8, 4);
    g.lineStyle(1, P.toxic, 0.55);
    g.lineBetween(headX + 2, headY - 2, headX + 8, headY - 2);
  }

  private drawFlame(): void {
    const g = this.g;
    const len = 12 + Math.random() * 12;
    g.fillStyle(P.toxic, 0.85);
    g.beginPath();
    g.moveTo(-40, 1);
    g.lineTo(-40 - len, 3.5);
    g.lineTo(-40, 6);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xf4ffe0, 0.9);
    g.fillRect(-40, 2.5, 5, 2);
  }

  private drawWheel(wheel: MatterJS.BodyType): void {
    const g = this.g;
    const r = PHYSICS.wheelRadius;
    const { x, y } = wheel.position;

    g.fillStyle(P.tire, 1);
    g.fillCircle(x, y, r);
    g.lineStyle(2, P.tread, 1);
    g.strokeCircle(x, y, r - 2);

    // spokes (rotate with wheel)
    g.lineStyle(1.5, P.spoke, 1);
    for (let i = 0; i < 3; i++) {
      const a = wheel.angle + (i * Math.PI) / 3;
      const dx = Math.cos(a) * (r - 7);
      const dy = Math.sin(a) * (r - 7);
      g.lineBetween(x - dx, y - dy, x + dx, y + dy);
    }

    // rim ring + hub
    g.lineStyle(2, P.toxicDim, 0.9);
    g.strokeCircle(x, y, r - 6);
    g.fillStyle(P.metal, 1);
    g.fillCircle(x, y, 4);
  }
}
