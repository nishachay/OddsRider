import Phaser from 'phaser';
import { BIKE, SPRITE } from './constants';
import type { GhostSnapshot } from './replay';

const GHOST_ALPHA = 0.35;

/**
 * Faint replay rider. Render-only images driven by recorded rear-hub poses —
 * never Matter bodies, so a ghost can never collide with the player.
 * Framing mirrors BikeRenderer: everything hangs off the rear wheel hub.
 */
export class GhostRenderer {
  private container: Phaser.GameObjects.Container;
  private chassisImg: Phaser.GameObjects.Image;
  private rearImg: Phaser.GameObjects.Image;
  private frontImg: Phaser.GameObjects.Image;
  private riderImg: Phaser.GameObjects.Image;
  private snapshots: GhostSnapshot[] = [];

  constructor(scene: Phaser.Scene) {
    this.chassisImg = scene.add
      .image(SPRITE.chassisOffsetX, SPRITE.chassisOffsetY, 'bike')
      .setOrigin(SPRITE.bikeOriginX, SPRITE.bikeOriginY)
      .setScale(SPRITE.bikeScale)
      .setAlpha(GHOST_ALPHA);
    this.rearImg = scene.add.image(0, 0, 'wheel').setScale(SPRITE.rearWheelScale).setAlpha(GHOST_ALPHA);
    this.frontImg = scene.add
      .image(BIKE.frontDx - BIKE.backDx, 0, 'wheel')
      .setScale(SPRITE.frontWheelScale)
      .setAlpha(GHOST_ALPHA);
    this.riderImg = scene.add
      .image(SPRITE.riderOffsetX, SPRITE.riderOffsetY, 'rider')
      .setOrigin(0.5, SPRITE.riderOriginY)
      .setScale(SPRITE.riderScale)
      .setAlpha(GHOST_ALPHA);
    this.container = scene.add.container(0, 0, [
      this.chassisImg,
      this.rearImg,
      this.frontImg,
      this.riderImg,
    ]);
    this.container.setDepth(4);
    this.container.setVisible(false);
  }

  get count(): number {
    return this.snapshots.length;
  }

  setSnapshots(snapshots: GhostSnapshot[] | null): void {
    this.snapshots = snapshots ?? [];
    this.container.setVisible(this.snapshots.length > 0);
  }

  /** Pose the ghost at the player's score-time (holds the final pose past the end). */
  update(timeMs: number): void {
    if (this.snapshots.length === 0) return;
    const last = this.snapshots[this.snapshots.length - 1];
    let x = last.x;
    let y = last.y;
    let a = last.a;
    if (timeMs < last.t) {
      const first = this.snapshots[0];
      if (timeMs <= first.t) {
        x = first.x;
        y = first.y;
        a = first.a;
      } else {
        for (let i = 1; i < this.snapshots.length; i++) {
          const p = this.snapshots[i - 1];
          const q = this.snapshots[i];
          if (q.t >= timeMs) {
            const span = q.t - p.t;
            const k = span > 0 ? (timeMs - p.t) / span : 0;
            x = p.x + (q.x - p.x) * k;
            y = p.y + (q.y - p.y) * k;
            a = p.a + (q.a - p.a) * k;
            break;
          }
        }
      }
    }
    this.container.setPosition(x, y);
    this.container.setRotation(a);
    // Wheels spin with distance travelled, like the real thing.
    const spin = x / BIKE.wheelR + a;
    this.rearImg.setRotation(spin);
    this.frontImg.setRotation(spin);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
