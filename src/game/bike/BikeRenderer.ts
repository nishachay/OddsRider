import Phaser from "phaser";
import { PALETTE, SPRITE } from "../constants";
import type { Bike } from "./Bike";

const P = PALETTE;

export class BikeRenderer {
  private bikeSprite: Phaser.GameObjects.Image;
  private wheelBackSprite: Phaser.GameObjects.Image;
  private wheelFrontSprite: Phaser.GameObjects.Image;
  private riderSprite: Phaser.GameObjects.Image;
  private ragdollSprite: Phaser.GameObjects.Image;
  private flame: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
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
    this.flame = scene.add.graphics().setDepth(9);

    scene.children.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Image && child.texture.key === "flag") {
        child.setScale(SPRITE.flagScale);
      }
    });
  }

  render(bike: Bike): void {
    const back = bike.rearWheel;
    this.wheelBackSprite
      .setPosition(back.position.x + SPRITE.rearWheelOffsetX, back.position.y + SPRITE.rearWheelOffsetY)
      .setRotation(back.angle);

    const front = bike.frontWheel;
    this.wheelFrontSprite
      .setPosition(front.position.x + SPRITE.frontWheelOffsetX, front.position.y + SPRITE.frontWheelOffsetY)
      .setRotation(front.angle);

    const chassis = bike.chassis;
    this.bikeSprite
      .setPosition(chassis.position.x, chassis.position.y)
      .setRotation(chassis.angle);

    const a = chassis.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const rx = chassis.position.x + cos * SPRITE.seatLocalX - sin * SPRITE.seatLocalY;
    const ry = chassis.position.y + sin * SPRITE.seatLocalX + cos * SPRITE.seatLocalY;

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

    this.flame.clear();
    if (bike.nitroActive) {
      const ex = chassis.position.x + cos * -52 - sin * 3;
      const ey = chassis.position.y + sin * -52 + cos * 3;
      const len = 14 + Math.random() * 14;
      const g = this.flame;
      g.save();
      g.translateCanvas(ex, ey);
      g.rotateCanvas(a);
      g.fillStyle(P.toxic, 0.85);
      g.beginPath();
      g.moveTo(0, -2.5);
      g.lineTo(-len, 0);
      g.lineTo(0, 2.5);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xf4ffe0, 0.9);
      g.fillRect(0, -1, 5, 2);
      g.restore();
    }
  }
}
