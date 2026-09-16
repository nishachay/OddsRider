import Phaser from "phaser";
import { PALETTE } from "../constants";
import type { Bike } from "./Bike";

const P = PALETTE;

/**
 * OddsRider Cyber Effects Engine
 * 100% Anti-Slop, Sharp 1px Geometric Cyber-Terminal Visual FX
 */
export class CyberEffects {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private sparkEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private prevGrounded = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics().setDepth(9);

    this.makeSparkTexture();
    this.makeSparkEmitter();
    this.makeDustEmitter();
  }

  private makeSparkTexture(): void {
    if (this.scene.textures.exists("cyber_spark")) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xb6ff00, 1);
    g.fillRect(0, 0, 2, 2); // Sharp 2x2 square pixel spark
    g.generateTexture("cyber_spark", 2, 2);
    g.destroy();
  }

  private makeSparkEmitter(): void {
    this.sparkEmitter = this.scene.add
      .particles(0, 0, "cyber_spark", {
        lifespan: 220,
        speed: { min: 20, max: 120 },
        angle: { min: 160, max: 340 },
        scale: { start: 1, end: 0.2 },
        alpha: { start: 1, end: 0 },
        gravityY: 100,
        tint: [P.toxic, P.toxicDim],
        emitting: false,
      })
      .setDepth(8);
  }

  private makeDustEmitter(): void {
    this.dustEmitter = this.scene.add
      .particles(0, 0, "cyber_spark", {
        lifespan: 420,
        speed: { min: 30, max: 160 },
        angle: { min: 200, max: 340 },
        scale: { start: 1.5, end: 0.2 },
        alpha: { start: 0.7, end: 0 },
        gravityY: 160,
        tint: [0x7c7f86, 0x3b414f],
        emitting: false,
      })
      .setDepth(8);
  }

  render(bike: Bike): void {
    this.gfx.clear();
    if (bike.crashed) {
      this.prevGrounded = false;
      return;
    }

    // Landing dust burst on air-to-ground transitions, scaled by impact
    if (!this.prevGrounded && bike.grounded) {
      const impact = Math.max(0, bike.chassis.velocity.y);
      const count = Math.min(24, Math.max(4, Math.round(4 + impact * 1.5)));
      this.dustEmitter.setPosition(bike.rearWheel.position.x, bike.rearWheel.position.y + 10);
      this.dustEmitter.explode(count);
    }
    this.prevGrounded = bike.grounded;

    const chassis = bike.chassis;
    const rearWheel = bike.rearWheel;
    const a = chassis.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // 1. Sharp Cyber Laser Nitro Beam & 1px Grid Stream
    if (bike.nitroActive) {
      const ex = chassis.position.x + cos * -50 - sin * 2;
      const ey = chassis.position.y + sin * -50 + cos * 2;
      const g = this.gfx;
      g.save();
      g.translateCanvas(ex, ey);
      g.rotateCanvas(a);

      // Sharp toxic green laser beam
      const len = 28 + Math.random() * 16;
      g.fillStyle(P.toxic, 0.95);
      g.fillRect(-len, -1, len, 2);

      // Core white laser thread
      g.fillStyle(0xffffff, 1);
      g.fillRect(-len * 0.7, -0.5, len * 0.7, 1);

      // 1px trailing cyber accent dashes
      g.lineStyle(1, P.toxic, 0.6);
      g.strokeRect(-len - 12, -3, 8, 6);
      g.restore();
    }

    // 2. High-Speed Track Contact Sparks
    if (bike.grounded && Math.abs(bike.speed) > 12) {
      const rwx = rearWheel.position.x - cos * 10;
      const rwy = rearWheel.position.y + 12;
      this.sparkEmitter.setPosition(rwx, rwy);
      this.sparkEmitter.emitParticle(1);
    }
  }
}
