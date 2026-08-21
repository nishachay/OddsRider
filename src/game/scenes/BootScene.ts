import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image('wheel', 'assets/px/wheel.png');
    this.load.image('bike', 'assets/px/bike.png');
    this.load.image('flag', 'assets/px/flag.png');
  }

  create(): void {
    this.scene.start('ride');
  }
}
