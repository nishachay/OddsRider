/**
 * Minimal typings + accessor for the raw matter-js instance bundled inside Phaser.
 * Avoids adding a second copy of matter-js to the bundle.
 */
import Phaser from 'phaser';

export interface RawMatterBody {
  position: MatterJS.Vector;
  velocity: MatterJS.Vector;
  angle: number;
  angularVelocity: number;
  mass: number;
}

interface RawMatter {
  Body: {
    setPosition(body: RawMatterBody, pos: MatterJS.Vector): void;
    setAngle(body: RawMatterBody, angle: number): void;
    setAngularVelocity(body: RawMatterBody, v: number): void;
    setVelocity(body: RawMatterBody, v: MatterJS.Vector): void;
    applyForce(body: RawMatterBody, pos: MatterJS.Vector, force: MatterJS.Vector): void;
  };
}

export const RawMatter = (Phaser.Physics.Matter as unknown as { Matter: RawMatter }).Matter;

export interface CollisionPair {
  bodyA: { label: string };
  bodyB: { label: string };
}

export interface CollisionEventData {
  pairs: CollisionPair[];
}
