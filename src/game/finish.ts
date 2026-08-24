import Phaser from 'phaser';

export class FinishCelebration {
  private scene: Phaser.Scene;
  private x: number;
  private groundY: number;

  private gantryGfx: Phaser.GameObjects.Graphics;
  private bannerSprite: Phaser.GameObjects.TileSprite | null = null;
  private laserLine: Phaser.GameObjects.Graphics;
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;

    this.gantryGfx = scene.add.graphics().setDepth(2);
    this.laserLine = scene.add.graphics().setDepth(3);

    this.buildGantry();
    this.buildParticles();
  }

  private buildGantry(): void {
    const scene = this.scene;
    const g = this.gantryGfx;
    const x = this.x;
    const y = this.groundY;

    const span = 90;
    const height = 140;
    const topY = y - height;

    // 1. Dual Cyber Structural Pylons
    g.fillStyle(0x1a1c23, 1);
    g.fillRect(x - span - 4, topY, 8, height);
    g.fillRect(x + span - 4, topY, 8, height);

    // 1px Outer Neon Edges
    g.lineStyle(1, 0x2e3340, 1);
    g.strokeRect(x - span - 4, topY, 8, height);
    g.strokeRect(x + span - 4, topY, 8, height);

    // Pylon Status Lights (Toxic Green)
    g.fillStyle(0xb6ff00, 1);
    g.fillRect(x - span - 2, topY + 12, 4, 12);
    g.fillRect(x + span - 2, topY + 12, 4, 12);

    // 2. Animated Digital Checkerboard Header Banner
    if (!scene.textures.exists('cyber_banner')) {
      const bg = scene.make.graphics({ x: 0, y: 0 }, false);
      const sq = 8;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 12; col++) {
          bg.fillStyle((row + col) % 2 === 0 ? 0xb6ff00 : 0x0a0a0b, 1);
          bg.fillRect(col * sq, row * sq, sq, sq);
        }
      }
      bg.generateTexture('cyber_banner', 96, 16);
      bg.destroy();
    }

    this.bannerSprite = scene.add
      .tileSprite(x, topY + 8, span * 2, 16, 'cyber_banner')
      .setDepth(3);

    // Header Frame Border
    g.lineStyle(1, 0xb6ff00, 0.8);
    g.strokeRect(x - span, topY, span * 2, 16);

    // 3. Laser Gate Line
    const laser = this.laserLine;
    laser.clear();
    laser.lineStyle(2, 0xb6ff00, 0.85);
    laser.lineBetween(x, topY + 16, x, y);
    laser.fillStyle(0xffffff, 0.9);
    laser.fillRect(x - 1, topY + 16, 2, height - 16);
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
    // Pulse laser gate line on finish
    this.scene.tweens.add({
      targets: this.laserLine,
      alpha: { from: 1, to: 0 },
      duration: 300,
      yoyo: true,
      repeat: 3,
    });
  }

  destroy(): void {
    this.gantryGfx.destroy();
    this.bannerSprite?.destroy();
    this.laserLine.destroy();
    this.emitter?.destroy();
  }
}
