import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image('wheel', 'assets/game/wheel.png');
    this.load.image('bike', 'assets/game/bike.png');
    this.load.image('rider', 'assets/game/rider.png');
    this.load.image('ragdoll', 'assets/game/ragdoll.png');
    this.load.image('flag', 'assets/game/flag.png');
  }

  create(): void {
    this.scene.start('ride');
  }
}
