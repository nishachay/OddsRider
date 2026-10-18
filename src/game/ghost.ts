import Phaser from 'phaser';
import { BIKE, SPRITE } from './constants';
import type { GhostSnapshot } from '@oddsrider/core';

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

/** Interpolated pose for the replay renderer. */
export interface ReplayPose {
  c: [number, number, number];
  r: [number, number, number];
  f: [number, number, number];
  ejected: boolean;
  g: [number, number, number] | null;
}

/**
 * Full-opacity replay rider: every drawn body follows its recorded pose, so
 * replays show exactly what happened — including the ragdoll after a crash.
 * Render-only; the live Matter bodies stand untouched.
 */
export class ReplayBike {
  private chassisImg: Phaser.GameObjects.Image;
  private rearImg: Phaser.GameObjects.Image;
  private frontImg: Phaser.GameObjects.Image;
  private riderImg: Phaser.GameObjects.Image;
  private ragdollImg: Phaser.GameObjects.Image;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.chassisImg = scene.add
      .image(0, 0, 'bike')
      .setOrigin(SPRITE.bikeOriginX, SPRITE.bikeOriginY)
      .setScale(SPRITE.bikeScale);
    this.rearImg = scene.add.image(0, 0, 'wheel').setScale(SPRITE.rearWheelScale);
    this.frontImg = scene.add.image(0, 0, 'wheel').setScale(SPRITE.frontWheelScale);
    this.riderImg = scene.add
      .image(0, 0, 'rider')
      .setOrigin(0.5, SPRITE.riderOriginY)
      .setScale(SPRITE.riderScale);
    this.ragdollImg = scene.add
      .image(0, 0, 'ragdoll')
      .setOrigin(0.5, 0.5)
      .setScale(SPRITE.riderScale)
      .setVisible(false);
    this.container = scene.add.container(0, 0, [
      this.chassisImg,
      this.rearImg,
      this.frontImg,
      this.riderImg,
      this.ragdollImg,
    ]);
    this.container.setDepth(6);
    this.container.setVisible(false);
  }

  render(pose: ReplayPose): void {
    this.container.setVisible(true);
    const [cx, cy, ca] = pose.c;
    const cos = Math.cos(ca);
    const sin = Math.sin(ca);
    // Chassis + wheels at their recorded poses; rider hangs off the rear hub
    // exactly like BikeRenderer frames it.
    const hubX = pose.r[0];
    const hubY = pose.r[1];
    this.rearImg.setPosition(hubX, hubY).setRotation(pose.r[2]);
    this.frontImg.setPosition(pose.f[0], pose.f[1]).setRotation(pose.f[2]);
    this.chassisImg.setPosition(cx, cy).setRotation(ca);
    void cx;
    void cy;
    if (pose.ejected && pose.g) {
      this.riderImg.setVisible(false);
      this.ragdollImg.setVisible(true).setPosition(pose.g[0], pose.g[1]).setRotation(pose.g[2]);
    } else {
      this.ragdollImg.setVisible(false);
      this.riderImg
        .setVisible(true)
        .setPosition(
          hubX + cos * SPRITE.riderOffsetX - sin * SPRITE.riderOffsetY,
          hubY + sin * SPRITE.riderOffsetX + cos * SPRITE.riderOffsetY,
        )
        .setRotation(ca + (SPRITE.riderAngleOffset * Math.PI) / 180);
    }
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
