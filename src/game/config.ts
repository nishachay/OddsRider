import Phaser from 'phaser';
import { PALETTE, STEP_MS, MAX_STEPS_PER_FRAME } from './constants';
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
    fps: { target: 60, min: 30 },
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 1.1 },
        autoUpdate: false,
      },
    },
    input: { keyboard: false, mouse: true, touch: true },
    render: { pixelArt: true, powerPreference: 'high-performance' },
    scene: [BootScene, RideScene],
  };
}

export { STEP_MS, MAX_STEPS_PER_FRAME };
