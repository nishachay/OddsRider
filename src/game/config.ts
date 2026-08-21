import Phaser from 'phaser';
import { PALETTE, PHYSICS } from './constants';
import { BootScene } from './scenes/BootScene';
import { RideScene } from './scenes/RideScene';

export function makeGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: PALETTE.bg,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: PHYSICS.gravityY },
        enableSleeping: false,
      },
    },
    scene: [BootScene, RideScene],
  };
}
