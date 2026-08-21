import Phaser from 'phaser';
import { bus, EV } from '../bus';
import type { InputState } from '../bike/BikeController';

export class InputManager {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private jumpQ = false;
  private resetQ = false;
  private muteQ = false;
  private firstInputSent = false;

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    const add = (code: number): Phaser.Input.Keyboard.Key => kb.addKey(code);

    this.keys = {
      up: add(K.W),
      upAlt: add(K.UP),
      down: add(K.S),
      downAlt: add(K.DOWN),
      left: add(K.A),
      leftAlt: add(K.LEFT),
      right: add(K.D),
      rightAlt: add(K.RIGHT),
      shift: add(K.SHIFT),
      n: add(K.N),
    };

    const first = (): void => {
      if (!this.firstInputSent) {
        this.firstInputSent = true;
        bus.emit(EV.INPUT_FIRST);
      }
    };

    kb.on('keydown-SPACE', () => {
      this.jumpQ = true;
      first();
    });
    kb.on('keydown-R', () => {
      this.resetQ = true;
      first();
    });
    kb.on('keydown-M', () => {
      this.muteQ = true;
      first();
    });
    for (const key of Object.values(this.keys)) {
      key.on('down', first);
    }
  }

  readAndConsume(): InputState {
    const d = (...codes: string[]): boolean => codes.some((c) => this.keys[c].isDown);
    const state: InputState = {
      gas: d('up', 'upAlt'),
      brake: d('down', 'downAlt'),
      leanBack: d('left', 'leftAlt'),
      leanForward: d('right', 'rightAlt'),
      nitro: d('shift') || d('n'),
      jumpQueued: this.jumpQ,
    };
    this.jumpQ = false;
    return state;
  }

  takeReset(): boolean {
    const v = this.resetQ;
    this.resetQ = false;
    return v;
  }

  takeMute(): boolean {
    const v = this.muteQ;
    this.muteQ = false;
    return v;
  }

  destroy(): void {
    for (const key of Object.values(this.keys)) key.destroy();
    this.scene.input.keyboard?.removeAllListeners();
  }
}
