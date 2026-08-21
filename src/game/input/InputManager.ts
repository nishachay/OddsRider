import { bus, EV } from '../bus';

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export interface ContinuousInput {
  gas: boolean;
  brake: boolean;
  leanBack: boolean;
  leanFwd: boolean;
  nitro: boolean;
}

/**
 * Window-level keyboard state (works with synthetic events, no Phaser
 * keyboard capture) + edge-triggered R / M / Space.
 */
export class InputManager {
  private keys = new Set<string>();
  private jumpQ = false;
  private resetQ = false;
  private muteQ = false;
  private firstSent = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (!e.repeat) {
      if (e.code === 'Space') {
        this.jumpQ = true;
        this.first();
      } else if (e.code === 'KeyR') {
        this.resetQ = true;
        this.first();
      } else if (e.code === 'KeyM') {
        this.muteQ = true;
        this.first();
      } else if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyN') {
        this.first();
      }
    }
    if (PREVENT.has(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  private first(): void {
    if (!this.firstSent) {
      this.firstSent = true;
      bus.emit(EV.INPUT_FIRST);
    }
  }

  read(): ContinuousInput {
    const k = this.keys;
    return {
      gas: k.has('KeyW') || k.has('ArrowUp'),
      brake: k.has('KeyS') || k.has('ArrowDown'),
      leanBack: k.has('KeyA') || k.has('ArrowLeft'),
      leanFwd: k.has('KeyD') || k.has('ArrowRight'),
      nitro: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN'),
    };
  }

  consumeJump(): boolean {
    const v = this.jumpQ;
    this.jumpQ = false;
    return v;
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
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
