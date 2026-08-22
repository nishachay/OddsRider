import Phaser from "phaser";
import { PALETTE, SPRITE } from "../constants";
import { bus, EV } from "../bus";
import type { Bike } from "./Bike";
import { BikeParticles } from "./BikeParticles";

const P = PALETTE;

export class BikeRenderer {
  private bikeSprite: Phaser.GameObjects.Image;
  private wheelBackSprite: Phaser.GameObjects.Image;
  private wheelFrontSprite: Phaser.GameObjects.Image;
  private riderSprite: Phaser.GameObjects.Image;
  private ragdollSprite: Phaser.GameObjects.Image;
  public particles: BikeParticles;

  constructor(scene: Phaser.Scene) {
    this.particles = new BikeParticles(scene);

    this.wheelBackSprite = scene.add.image(0, 0, "wheel").setDepth(5).setScale(SPRITE.rearWheelScale);
    this.wheelFrontSprite = scene.add.image(0, 0, "wheel").setDepth(5).setScale(SPRITE.frontWheelScale);
    this.bikeSprite = scene.add
      .image(0, 0, "bike")
      .setOrigin(SPRITE.bikeOriginX, SPRITE.bikeOriginY)
      .setScale(SPRITE.bikeScale)
      .setDepth(6);
    this.riderSprite = scene.add
      .image(0, 0, "rider")
      .setOrigin(0.5, SPRITE.riderOriginY)
      .setScale(SPRITE.riderScale)
      .setDepth(7);
    this.ragdollSprite = scene.add.image(0, 0, "ragdoll").setOrigin(0.5, 0.5).setScale(SPRITE.ragdollScale).setDepth(7).setVisible(false);

    // LIVE 100% REAL-TIME SYNC FROM STUDIO TO PHASER GAME SCENE
    bus.on(EV.STUDIO_UPDATE, () => {
      this.bikeSprite.setScale(SPRITE.bikeScale);
      this.wheelBackSprite.setScale(SPRITE.rearWheelScale);
      this.wheelFrontSprite.setScale(SPRITE.frontWheelScale);
      this.riderSprite.setScale(SPRITE.riderScale);
    });

    scene.children.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Image && child.texture.key === "flag") {
        child.setScale(SPRITE.flagScale);
      }
    });
  }

  render(bike: Bike): void {
    const rearWheel = bike.rearWheel;
    const frontWheel = bike.frontWheel;
    const chassis = bike.chassis;

    // Update particle emitters (tire dust, nitro flames)
    this.particles.update(bike);

    // 1. REAR WHEEL (Anchored directly to track contact physics body)
    this.wheelBackSprite
      .setPosition(rearWheel.position.x, rearWheel.position.y)
      .setRotation(rearWheel.angle);

    // 2. FRONT WHEEL (Anchored directly to track contact physics body)
    this.wheelFrontSprite
      .setPosition(frontWheel.position.x, frontWheel.position.y)
      .setRotation(frontWheel.angle);

    const a = chassis.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // 3. CHASSIS BIKE (Positioned relative to Rear Wheel Base)
    const cx = rearWheel.position.x + cos * SPRITE.chassisOffsetX - sin * SPRITE.chassisOffsetY;
    const cy = rearWheel.position.y + sin * SPRITE.chassisOffsetX + cos * SPRITE.chassisOffsetY;
    this.bikeSprite
      .setPosition(cx, cy)
      .setRotation(a);

    // 4. RIDER (Positioned relative to Rear Wheel Base)
    const rx = rearWheel.position.x + cos * SPRITE.riderOffsetX - sin * SPRITE.riderOffsetY;
    const ry = rearWheel.position.y + sin * SPRITE.riderOffsetX + cos * SPRITE.riderOffsetY;
    const riderAngle = a + (SPRITE.riderAngleOffset * Math.PI / 180);
    this.riderSprite.setPosition(rx, ry).setRotation(riderAngle).setVisible(!bike.ejected);

    if (bike.ejected && bike.ragdollBody) {
      this.ragdollSprite
        .setPosition(bike.ragdollBody.position.x, bike.ragdollBody.position.y)
        .setRotation(bike.ragdollBody.angle)
        .setVisible(true);
    } else {
      this.ragdollSprite.setVisible(false);
    }
  }
}
