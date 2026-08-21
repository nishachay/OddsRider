import Phaser from 'phaser';
import { PALETTE } from '../constants';
import type { Bike } from './Bike';

const P = PALETTE;

// bike.png is 150x70; rear axle (19,47), front axle (131,47) -> chassis centre (75,29).
const BIKE_ORIGIN_X = 75 / 150;
const BIKE_ORIGIN_Y = 29 / 70;

export class BikeRenderer {
  private bikeSprite: Phaser.GameObjects.Image;
  private wheelBackSprite: Phaser.GameObjects.Image;
  private wheelFrontSprite: Phaser.GameObjects.Image;
  private flame: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.wheelBackSprite = scene.add.image(0, 0, 'wheel').setDepth(5);
    this.wheelFrontSprite = scene.add.image(0, 0, 'wheel').setDepth(5);
    this.bikeSprite = scene.add.image(0, 0, 'bike').setOrigin(BIKE_ORIGIN_X, BIKE_ORIGIN_Y).setDepth(6);
    this.flame = scene.add.graphics().setDepth(9);
  }

  render(bike: Bike): void {
    const back = bike.rearWheel;
    this.wheelBackSprite.setPosition(back.position.x, back.position.y).setRotation(back.angle);
    const front = bike.frontWheel;
    this.wheelFrontSprite.setPosition(front.position.x, front.position.y).setRotation(front.angle);

    const chassis = bike.chassis;
    this.bikeSprite.setPosition(chassis.position.x, chassis.position.y).setRotation(chassis.angle);

    this.flame.clear();
    if (bike.nitroActive) {
      const a = chassis.angle;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      // exhaust tip in chassis-local (-52, 3)
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
