import Phaser from 'phaser';
import { PALETTE } from './constants';

export class FinishCelebration {
  private scene: Phaser.Scene;
  private x: number;
  private groundY: number;
  private tapeUpper!: Phaser.GameObjects.Rectangle;
  private tapeLower!: Phaser.GameObjects.Rectangle;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private crossed = false;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;
    this.buildTape();

    if (!scene.textures.exists('confetti_px')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 3, 5);
      g.generateTexture('confetti_px', 3, 5);
      g.destroy();
    }
    this.confetti = scene.add
      .particles(0, 0, 'confetti_px', {
        lifespan: { min: 900, max: 1700 },
        speed: { min: 120, max: 380 },
        angle: { min: 200, max: 340 },
        gravityY: 420,
        rotate: { min: 0, max: 360 },
        scale: { min: 0.6, max: 1.4 },
        alpha: { start: 1, end: 0 },
        tint: [PALETTE.toxic, 0xffffff, PALETTE.crimson],
        emitting: false,
      })
      .setDepth(9);
  }

  private buildTape(): void {
    const tapeW = 4;
    const lowerH = 38;
    const upperH = 42;
    this.tapeLower = this.scene.add
      .rectangle(this.x, this.groundY - 8 - lowerH / 2, tapeW, lowerH, PALETTE.toxic)
      .setDepth(3);
    this.tapeUpper = this.scene.add
      .rectangle(this.x, this.groundY - 8 - lowerH - upperH / 2, tapeW, upperH, PALETTE.toxic)
      .setDepth(3);
  }

  reset(): void {
    this.crossed = false;
    this.tapeUpper.destroy();
    this.tapeLower.destroy();
    this.buildTape();
  }

  destroy(): void {
    this.confetti.destroy();
    this.tapeUpper.destroy();
    this.tapeLower.destroy();
  }

  cross(): void {
    if (this.crossed) return;
    this.crossed = true;
    const cx = this.tapeLower.x;
    const cy = this.tapeLower.y - 26;
    this.confetti.emitParticleAt(cx, cy, 110);
    this.scene.cameras.main.shake(200, 0.004);
    this.scene.tweens.add({
      targets: this.tapeUpper,
      x: cx - 46,
      y: cy - 46,
      angle: -150,
      alpha: 0,
      duration: 750,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: this.tapeLower,
      x: cx + 40,
      y: cy + 26,
      angle: 130,
      alpha: 0,
      duration: 750,
      ease: 'Quad.easeOut',
    });
    this.scene.time.delayedCall(800, () => {
      this.tapeUpper.destroy();
      this.tapeLower.destroy();
    });
  }
}
