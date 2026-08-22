import Phaser from "phaser";
import { PALETTE, SPRITE } from "../constants";
import type { Bike } from "./Bike";

const P = PALETTE;

export class BikeParticles {
  private scene: Phaser.Scene;
  private eNitroCore!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eNitroFringe!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eDust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eCrash!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.makeParticleTextures();
    this.makeEmitters();
  }

  private makeParticleTextures(): void {
    if (this.scene.textures.exists("soft_particle")) return;

    // Create glowing soft radial particle texture
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 8; i >= 1; i--) {
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(8, 8, i);
    }
    g.generateTexture("soft_particle", 16, 16);
    g.clear();

    // Create 4x4 dust pixel particle texture
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture("px_dust", 4, 4);
    g.destroy();
  }

  private makeEmitters(): void {
    const ADD = Phaser.BlendModes.ADD;

    // 1. Tire dust kickup
    this.eDust = this.scene.add
      .particles(0, 0, "px_dust", {
        lifespan: 480,
        speed: { min: 6, max: 36 },
        angle: { min: 190, max: 350 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.6, end: 0 },
        gravityY: 50,
        tint: [0x75846f, 0xa2ad9c, P.surfaceLine],
        emitting: false,
      })
      .setDepth(4);

    // 2. Nitro Flame Core (Amber / Orange)
    this.eNitroCore = this.scene.add
      .particles(0, 0, "soft_particle", {
        lifespan: 240,
        speed: { min: 140, max: 280 },
        angle: { min: 155, max: 205 },
        scale: { start: 0.75, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: [0xffaa00, 0xffe08a, P.crimson],
        blendMode: ADD,
        emitting: false,
      })
      .setDepth(9);

    // 3. Nitro Flame Fringe Cone (Toxic Green)
    this.eNitroFringe = this.scene.add
      .particles(0, 0, "soft_particle", {
        lifespan: 320,
        speed: { min: 80, max: 180 },
        angle: { min: 140, max: 220 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [P.toxic, P.toxicBright],
        blendMode: ADD,
        emitting: false,
      })
      .setDepth(9);

    // 4. Explosive Crash Shockwave Burst
    this.eCrash = this.scene.add
      .particles(0, 0, "soft_particle", {
        lifespan: { min: 360, max: 800 },
        speed: { min: 80, max: 320 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 200,
        tint: [P.toxic, P.crimson, 0xffaa00, 0xffffff],
        blendMode: ADD,
        emitting: false,
      })
      .setDepth(10);
  }

  update(bike: Bike): void {
    const chassis = bike.chassis;
    const a = chassis.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // Exhaust Pipe Location (relative to chassis center)
    const ex = chassis.position.x + cos * -48 - sin * -6;
    const ey = chassis.position.y + sin * -48 + cos * -6;

    if (bike.nitroActive && !bike.crashed) {
      this.eNitroCore.setPosition(ex, ey);
      this.eNitroFringe.setPosition(ex, ey);
      this.eNitroCore.emitParticle(2);
      this.eNitroFringe.emitParticle(1);
    }

    // Rear Wheel Dust Kickup when driving on ground
    if (bike.grounded && !bike.crashed && Math.abs(bike.speed) > 1.5) {
      const rwx = bike.rearWheel.position.x;
      const rwy = bike.rearWheel.position.y + 12;
      this.eDust.setPosition(rwx, rwy);
      this.eDust.emitParticle(1);
    }
  }

  explodeCrash(x: number, y: number): void {
    this.eCrash.setPosition(x, y);
    this.eCrash.explode(36);
  }
}
