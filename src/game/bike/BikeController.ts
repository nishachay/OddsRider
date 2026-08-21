import Phaser from 'phaser';
import { PHYSICS } from '../constants';
import { RawMatter } from '../matter';
import type { CollisionEventData } from '../matter';
import type { Bike } from './Bike';

export interface InputState {
  gas: boolean;
  brake: boolean;
  leanBack: boolean;
  leanForward: boolean;
  nitro: boolean;
  jumpQueued: boolean;
}

const MatterBody = RawMatter.Body;

export class BikeController {
  nitroActive = false;

  private lastGroundedAt = -Infinity;
  private lastJumpAt = -Infinity;

  constructor(
    private scene: Phaser.Scene,
    private bike: Bike,
  ) {
    const onContact = (event: CollisionEventData): void => {
      const now = scene.time.now;
      for (const pair of event.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const wheelInvolved =
          (a.label === 'rearWheel' || a.label === 'frontWheel' || b.label === 'rearWheel' || b.label === 'frontWheel');
        const groundInvolved = a.label === 'ground' || b.label === 'ground';
        if (wheelInvolved && groundInvolved) this.lastGroundedAt = now;
      }
    };
    scene.matter.world.on('collisionstart', onContact);
    scene.matter.world.on('collisionactive', onContact);
  }

  get isGrounded(): boolean {
    return this.scene.time.now - this.lastGroundedAt <= PHYSICS.coyoteMs;
  }

  update(dt: number, input: InputState): void {
    const P = PHYSICS;
    const rear = this.bike.rearWheel;
    const front = this.bike.frontWheel;
    const chassis = this.bike.chassis;
    const grounded = this.isGrounded;

    // --- drive / brake ---
    const nitro = input.nitro && input.gas;
    this.nitroActive = nitro;

    if (input.gas) {
      const maxFwd = P.driveMaxSpeed * (nitro ? P.nitroSpeedMult : 1);
      MatterBody.setAngularVelocity(rear, Math.min(rear.angularVelocity + P.driveAccel * dt, maxFwd));
    } else if (input.brake) {
      const step = P.brakeAccel * dt;
      for (const w of [rear, front]) {
        let nv = w.angularVelocity - step;
        if (w.angularVelocity > 0 && nv < 0) nv = 0;
        nv = Math.max(nv, -P.reverseMaxSpeed);
        MatterBody.setAngularVelocity(w, nv);
      }
    } else {
      const step = P.coastDecel * dt;
      for (const w of [rear, front]) {
        const av = w.angularVelocity;
        const nv = av > 0 ? Math.max(0, av - step) : Math.min(0, av + step);
        MatterBody.setAngularVelocity(w, nv);
      }
    }

    if (nitro) {
      MatterBody.applyForce(chassis, chassis.position, { x: P.nitroForce * chassis.mass, y: 0 });
    }

    // --- lean ---
    const dir = (input.leanBack ? -1 : 0) + (input.leanForward ? 1 : 0);
    const cap = grounded ? P.maxSpinGrounded : P.maxSpinAir;
    if (dir !== 0) {
      const rate = P.leanRate * (grounded ? 1 : P.leanRateAirMult);
      MatterBody.setAngularVelocity(chassis, Phaser.Math.Clamp(chassis.angularVelocity + dir * rate * dt, -cap, cap));
    } else if (grounded) {
      const targetAv = -chassis.angle * P.uprightSpring;
      const t = Math.min(1, P.uprightDamp * dt);
      MatterBody.setAngularVelocity(chassis, chassis.angularVelocity + (targetAv - chassis.angularVelocity) * t);
    }

    // --- jump ---
    if (input.jumpQueued) {
      input.jumpQueued = false;
      const now = this.scene.time.now;
      if (grounded && now - this.lastJumpAt > P.jumpCooldownMs) {
        this.lastJumpAt = now;
        for (const body of [chassis, rear, front]) {
          MatterBody.setVelocity(body, { x: body.velocity.x, y: -P.jumpVelocity });
        }
        if (dir !== 0) {
          MatterBody.setAngularVelocity(chassis, Phaser.Math.Clamp(dir * 2.4, -cap, cap));
        }
      }
    }
  }
}
