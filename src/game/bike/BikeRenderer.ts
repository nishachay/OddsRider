import Phaser from 'phaser';
import { PALETTE, SPRITE } from '../constants';
import type { Bike } from './Bike';
import GUI from 'lil-gui';

const P = PALETTE;

// Mutable copy of SPRITE for live tweaking. Defaults adapted for new ~1000px assets.
export const LIVE_SPRITE = { 
  ...SPRITE, 
  bikeScale: 0.15, 
  bikeOriginX: 0.5, 
  bikeOriginY: 0.7,
  wheelScale: 0.12,
  riderScale: 0.15,
  ragdollScale: 0.15,
  riderOriginY: 0.8,
  riderAngleOffset: 0,
  seatLocalX: 0,
  seatLocalY: -20
};

// We will only create the GUI once
let gui: GUI | null = null;

export class BikeRenderer {
  private bikeSprite: Phaser.GameObjects.Image;
  private wheelBackSprite: Phaser.GameObjects.Image;
  private wheelFrontSprite: Phaser.GameObjects.Image;
  private riderSprite: Phaser.GameObjects.Image;
  private ragdollSprite: Phaser.GameObjects.Image;
  private flame: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.wheelBackSprite = scene.add.image(0, 0, 'wheel').setDepth(5).setScale(LIVE_SPRITE.wheelScale);
    this.wheelFrontSprite = scene.add.image(0, 0, 'wheel').setDepth(5).setScale(LIVE_SPRITE.wheelScale);
    this.bikeSprite = scene.add
      .image(0, 0, 'bike')
      .setOrigin(LIVE_SPRITE.bikeOriginX, LIVE_SPRITE.bikeOriginY)
      .setScale(LIVE_SPRITE.bikeScale)
      .setDepth(6);
    this.riderSprite = scene.add
      .image(0, 0, 'rider')
      .setOrigin(0.5, LIVE_SPRITE.riderOriginY)
      .setScale(LIVE_SPRITE.riderScale)
      .setDepth(7);
    this.ragdollSprite = scene.add.image(0, 0, 'ragdoll').setOrigin(0.5, 0.5).setScale(LIVE_SPRITE.ragdollScale).setDepth(7).setVisible(false);
    this.flame = scene.add.graphics().setDepth(9);

    if (!gui && typeof window !== 'undefined') {
      gui = new GUI({ title: 'HD Visual Tuning' });
      
      const viewFolder = gui.addFolder('View (Debug)');
      viewFolder.add({ zoom: 1 }, 'zoom', 0.5, 4, 0.1).onChange((v: number) => {
        scene.cameras.main.setZoom(v);
      });
      viewFolder.add({ whiteBg: false }, 'whiteBg').onChange((v: boolean) => {
        scene.cameras.main.setBackgroundColor(v ? '#ffffff' : '#0a0a0b');
      });

      const f = gui.addFolder('Sprites');
      f.add(LIVE_SPRITE, 'bikeScale', 0.01, 1.0, 0.001).onChange((v: number) => {
        this.bikeSprite.setScale(v);
      });
      f.add(LIVE_SPRITE, 'bikeOriginX', 0.0, 1.0, 0.01).onChange((v: number) => {
        this.bikeSprite.setOrigin(v, LIVE_SPRITE.bikeOriginY);
      });
      f.add(LIVE_SPRITE, 'bikeOriginY', 0.0, 1.0, 0.01).onChange((v: number) => {
        this.bikeSprite.setOrigin(LIVE_SPRITE.bikeOriginX, v);
      });
      f.add(LIVE_SPRITE, 'wheelScale', 0.01, 1.0, 0.001).onChange((v: number) => {
        this.wheelBackSprite.setScale(v);
        this.wheelFrontSprite.setScale(v);
      });
      f.add(LIVE_SPRITE, 'riderScale', 0.01, 1.0, 0.001).onChange((v: number) => {
        this.riderSprite.setScale(v);
        this.ragdollSprite.setScale(v);
      });
      f.add(LIVE_SPRITE, 'riderOriginY', 0.0, 1.0, 0.01).onChange((v: number) => {
        this.riderSprite.setOrigin(0.5, v);
      });
      f.add(LIVE_SPRITE, 'riderAngleOffset', -60, 60, 1);
      f.add(LIVE_SPRITE, 'seatLocalX', -60, 60, 1);
      f.add(LIVE_SPRITE, 'seatLocalY', -60, 60, 1);
      
      const copyBtn = {
        CopyConfig: () => {
          const out = JSON.stringify(LIVE_SPRITE, null, 2);
          navigator.clipboard.writeText(out);
          console.log("Copied to clipboard:", out);
          alert("Copied HD config to clipboard!");
        }
      };
      gui.add(copyBtn, 'CopyConfig');
    }
  }

  render(bike: Bike): void {
    const back = bike.rearWheel;
    this.wheelBackSprite.setPosition(back.position.x, back.position.y).setRotation(back.angle);
    const front = bike.frontWheel;
    this.wheelFrontSprite.setPosition(front.position.x, front.position.y).setRotation(front.angle);

    const chassis = bike.chassis;
    this.bikeSprite.setPosition(chassis.position.x, chassis.position.y).setRotation(chassis.angle);

    // rider mounted at the seat, rigid to the chassis
    const a = chassis.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const rx = chassis.position.x + cos * LIVE_SPRITE.seatLocalX - sin * LIVE_SPRITE.seatLocalY;
    const ry = chassis.position.y + sin * LIVE_SPRITE.seatLocalX + cos * LIVE_SPRITE.seatLocalY;
    
    // add angular offset (convert degrees to radians)
    const riderAngle = a + (LIVE_SPRITE.riderAngleOffset * Math.PI / 180);
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
