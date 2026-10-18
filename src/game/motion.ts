import { motionReduced } from '../data/motion';

/**
 * Additive reduced-motion gate for the game stage.
 *
 * The scene files call Phaser's camera shake directly (`cameras.main.shake`).
 * Rather than edit them — they are physics-adjacent and off-limits — this wraps
 * the single shake entry point, so a rider who asked for less motion never gets
 * a shaking canvas, however the shake was requested. Installing is idempotent
 * and the returned function restores the original method.
 */

/** Structural camera view: only `shake` is wrapped, nothing else is touched. */
export interface ShakeOwner {
  shake: unknown;
}

const GATED = Symbol.for('oddsrider.screenShakeGate');

/** False when the rider asked for reduced motion (screen shake off). */
export function screenShakeAllowed(): boolean {
  return !motionReduced();
}

export function gateCameraShake(camera: ShakeOwner): () => void {
  const owner = camera as unknown as Record<PropertyKey, unknown>;
  if (owner[GATED]) return () => {}; // already gated — one wrapper, one restore
  const original = camera.shake as (...args: unknown[]) => unknown;
  owner[GATED] = original;
  camera.shake = function gatedShake(this: unknown, ...args: unknown[]) {
    if (!screenShakeAllowed()) return this;
    return original.apply(this, args);
  };
  return () => {
    camera.shake = original;
    delete owner[GATED];
  };
}
