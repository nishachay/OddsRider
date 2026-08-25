import Phaser from 'phaser';
import { SPRITE } from './constants';

export class FinishCelebration {
  private scene: Phaser.Scene;
  private x: number;
  private groundY: number;

  private img: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;

    // Use the same 2D flag as the start gate
    this.img = scene.add.image(x, groundY, 'flag').setOrigin(0.5, 1).setScale(SPRITE.flagScale).setDepth(2);
    // Tint it white/grey for the finish line
    this.img.setTint(0xffffff);

    this.label = scene.add
      .text(x + 6, groundY - 80, 'FINISH', {
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '10px',
        color: '#ffffff',
      })
      .setOrigin(0, 0)
      .setDepth(2);

    this.buildParticles();
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.groundY = y;
    this.img.setPosition(x, y);
    this.label.setPosition(x + 6, y - 80);
  }

  private buildParticles(): void {
    const scene = this.scene;
    if (!scene.textures.exists('cyber_confetti')) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 3, 3);
      g.generateTexture('cyber_confetti', 3, 3);
      g.destroy();
    }

    this.emitter = scene.add
      .particles(0, 0, 'cyber_confetti', {
        lifespan: { min: 600, max: 1200 },
        speed: { min: 80, max: 240 },
        angle: { min: 210, max: 330 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 140,
        tint: [0xb6ff00, 0xff3355, 0xffffff, 0x232529],
        emitting: false,
      })
      .setDepth(10);
  }

  cross(): void {
    if (this.emitter) {
      this.emitter.setPosition(this.x, this.groundY - 60);
      this.emitter.explode(48);
    }
  }

  destroy(): void {
    this.img.destroy();
    this.label.destroy();
    this.emitter?.destroy();
  }
}
