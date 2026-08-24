import Phaser from 'phaser';
import { BIKE, TUNING, STEP_MS, WORLD } from '../constants';

type Body = MatterJS.BodyType;
type Constraint = MatterJS.ConstraintType;

export interface DriveInput {
  gas: boolean;
  brake: boolean;
  leanBack: boolean;
  leanFwd: boolean;
  nitro: boolean;
  jumpQueued: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function approach(cur: number, target: number, step: number): number {
  if (cur < target) return Math.min(cur + step, target);
  if (cur > target) return Math.max(cur - step, target);
  return target;
}

const TWO_PI = Math.PI * 2;

/**
 * The whole bike system: bodies, suspension, contacts, drive/lean/nitro/jump,
 * integrity enforcement and crash detection — stepped at a fixed 60Hz.
 */
export class Bike {
  readonly chassis: Body;
  readonly rearWheel: Body;
  readonly frontWheel: Body;
  readonly head: Body;

  grounded = false;
  crashed = false;
  nitroActive = false;
  ejected = false;
  ragdollBody: Body | null = null;

  private parts: (Body | Constraint)[] = [];
  private scene: Phaser.Scene;

  private contacts = 0;
  private backContacts = 0;
  private frontContacts = 0;
  private headContacts = 0;
  private chassisContacts = 0;

  private headHitEdge = false;
  private invertedMs = 0;
  private coyote = 0;
  private lastJumpAt = -1e9;
  private jumpQ = false;

  private nitroTank = 0;
  private nitroLatch = false;

  private parked = false;
  private _speed = 0;
  private _rpm = 0;
  private spawnX: number;
  private spawnY: number;
  private killY: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;
    this.killY = WORLD.groundTopY + TUNING.killDrop;

    const world = scene.matter.world;
    const group = world.nextGroup(true);
    const filter = { group, category: 0x0001, mask: 0xffffffff };

    const chassis = scene.matter.bodies.rectangle(x, y, BIKE.chassisW, BIKE.chassisH, {
      label: 'chassis',
      density: BIKE.chassisDensity,
      friction: BIKE.chassisFriction,
      frictionAir: BIKE.chassisFrictionAir,
      restitution: BIKE.chassisRestitution,
      collisionFilter: filter,
    });
    const wheelOpts = {
      label: 'wheel',
      density: BIKE.wheelDensity,
      friction: BIKE.wheelFriction,
      frictionStatic: BIKE.wheelFrictionStatic,
      restitution: BIKE.wheelRestitution,
      frictionAir: 0,
      collisionFilter: filter,
    };
    const back = scene.matter.bodies.circle(x + BIKE.backDx, y + BIKE.wheelDy, BIKE.wheelR, wheelOpts);
    const front = scene.matter.bodies.circle(x + BIKE.frontDx, y + BIKE.wheelDy, BIKE.wheelR, wheelOpts);
    const head = scene.matter.bodies.circle(x + BIKE.headDx, y + BIKE.headDy, BIKE.headR, {
      label: 'head',
      density: BIKE.headDensity,
      friction: BIKE.headFriction,
      restitution: BIKE.headRestitution,
      collisionFilter: filter,
    });

    this.chassis = chassis;
    this.rearWheel = back;
    this.frontWheel = front;
    this.head = head;

    const susp = (wheel: Body, ax: number): Constraint =>
      scene.matter.constraint.create({
        bodyA: chassis,
        pointA: { x: ax, y: 0 },
        bodyB: wheel,
        pointB: { x: 0, y: 0 },
        stiffness: BIKE.suspStiffness,
        damping: BIKE.suspDamping,
      });
    const pinHead = (px: number): Constraint =>
      scene.matter.constraint.create({
        bodyA: chassis,
        pointA: { x: px, y: BIKE.headAnchorY },
        bodyB: head,
        pointB: { x: 0, y: 0 },
        stiffness: BIKE.headStiffness,
        damping: BIKE.headDamping,
      });

    this.parts = [
      chassis,
      back,
      front,
      head,
      susp(back, BIKE.backDx - BIKE.suspAnchorSpread),
      susp(back, BIKE.backDx + BIKE.suspAnchorSpread),
      susp(front, BIKE.frontDx - BIKE.suspAnchorSpread),
      susp(front, BIKE.frontDx + BIKE.suspAnchorSpread),
      pinHead(BIKE.headDx - BIKE.headAnchorSpread),
      pinHead(BIKE.headDx + BIKE.headAnchorSpread),
    ];
    world.add(this.parts);

    world.on('collisionstart', this.onCollision, this);
    world.on('collisionend', this.onCollisionEnd, this);
  }

  private onCollision(e: { pairs: MatterJS.IPair[] }): void {
    for (const pair of e.pairs) {
      const a = (pair.bodyA as unknown as { label: string }).label;
      const b = (pair.bodyB as unknown as { label: string }).label;
      if (a !== 'ground' && b !== 'ground') continue;
      const other = (a === 'ground' ? pair.bodyB : pair.bodyA) as unknown as { label: string };
      if (other.label === 'wheel') {
        this.contacts++;
        if (other === (this.rearWheel as unknown)) this.backContacts++;
        else if (other === (this.frontWheel as unknown)) this.frontContacts++;
      } else if (other.label === 'head') {
        this.headHitEdge = true;
        this.headContacts++;
      } else if (other.label === 'chassis') {
        this.chassisContacts++;
      }
    }
  }

  private onCollisionEnd(e: { pairs: MatterJS.IPair[] }): void {
    for (const pair of e.pairs) {
      const a = (pair.bodyA as unknown as { label: string }).label;
      const b = (pair.bodyB as unknown as { label: string }).label;
      if (a !== 'ground' && b !== 'ground') continue;
      const other = (a === 'ground' ? pair.bodyB : pair.bodyA) as unknown as { label: string };
      if (other.label === 'wheel') {
        this.contacts = Math.max(0, this.contacts - 1);
        if (other === (this.rearWheel as unknown)) this.backContacts = Math.max(0, this.backContacts - 1);
        else if (other === (this.frontWheel as unknown)) this.frontContacts = Math.max(0, this.frontContacts - 1);
      } else if (other.label === 'head') {
        this.headContacts = Math.max(0, this.headContacts - 1);
      } else if (other.label === 'chassis') {
        this.chassisContacts = Math.max(0, this.chassisContacts - 1);
      }
    }
  }

  get x(): number {
    return this.chassis.position.x;
  }

  get y(): number {
    return this.chassis.position.y;
  }

  get angle(): number {
    return this.chassis.angle;
  }

  get speed(): number {
    return this._speed;
  }

  get rpm(): number {
    return this._rpm;
  }

  get nitro(): number {
    return this.nitroTank;
  }

  tilt(): number {
    let a = this.chassis.angle % TWO_PI;
    if (a > Math.PI) a -= TWO_PI;
    if (a < -Math.PI) a += TWO_PI;
    return Math.abs(a);
  }

  /** One fixed 60Hz simulation step. */
  step(input: DriveInput): void {
    const B = this.scene.matter.body;
    const chassis = this.chassis;

    if (input.jumpQueued) this.jumpQ = true;

    // --- drive ---
    if (input.gas) {
      const av = this.rearWheel.angularVelocity;
      B.setAngularVelocity(this.rearWheel, Math.min(av + TUNING.wheelAccel, TUNING.maxWheelAv));
      const spool = Math.max(0, 1 - av / TUNING.maxWheelAv);
      if (spool > 0 && this.grounded && chassis.angularVelocity > -TUNING.maxWheelieAv) {
        B.setAngularVelocity(chassis, chassis.angularVelocity - TUNING.wheelieTorque * spool);
      }
    } else if (input.brake) {
      B.setAngularVelocity(this.rearWheel, approach(this.rearWheel.angularVelocity, TUNING.reverseTargetAv, TUNING.brakeDecel));
      B.setAngularVelocity(this.frontWheel, approach(this.frontWheel.angularVelocity, 0, TUNING.brakeDecel));
    }

    // --- static park (kills spring jitter at standstill) ---
    this.parked = !input.gas && !input.brake && this.grounded && chassis.speed < TUNING.parkSpeed;
    if (this.parked) {
      for (const b of [chassis, this.rearWheel, this.frontWheel, this.head]) {
        B.setVelocity(b, { x: 0, y: 0 });
      }
      B.setAngularVelocity(this.rearWheel, 0);
      B.setAngularVelocity(this.frontWheel, 0);
    }

    // --- lean ---
    const tipped = this.tilt() > TUNING.tippedAngle;
    if (input.leanBack || input.leanFwd) {
      const k = this.grounded && !tipped ? TUNING.groundLean : TUNING.flipLean;
      const dir = input.leanFwd ? 1 : -1;
      B.setAngularVelocity(chassis, chassis.angularVelocity + dir * k);
    }

    // --- nitro ---
    const dtS = STEP_MS / 1000;
    if (this.nitroLatch) {
      if (!input.nitro || this.nitroTank <= 0) this.nitroLatch = false;
    } else if (input.nitro && this.nitroTank >= TUNING.nitroArm) {
      this.nitroLatch = true;
    }
    this.nitroActive = this.nitroLatch && this.nitroTank > 0;
    if (this.nitroActive) {
      this.nitroTank = clamp(this.nitroTank - TUNING.nitroDrain * dtS, 0, 1);
      const a = chassis.angle;
      const f = TUNING.nitroForce * chassis.mass;
      B.applyForce(chassis, chassis.position, { x: Math.cos(a) * f, y: Math.sin(a) * f });
    } else {
      this.nitroTank = clamp(this.nitroTank + TUNING.nitroTrickle * dtS, 0, 1);
    }

    // --- jump ---
    if (this.jumpQ) {
      this.jumpQ = false;
      const now = this.scene.time.now;
      if ((this.grounded || this.coyote > 0) && now - this.lastJumpAt > TUNING.jumpCooldownMs) {
        this.lastJumpAt = now;
        for (const b of [chassis, this.rearWheel, this.frontWheel]) {
          B.setVelocity(b, { x: b.velocity.x, y: Math.min(b.velocity.y, -TUNING.jumpVelocity) });
        }
      }
    }

    // --- step the world ---
    this.scene.matter.world.step(STEP_MS);

    // --- post-step state ---
    this.enforceIntegrity();
    this.grounded = this.contacts > 0;
    this.coyote = this.grounded ? TUNING.coyoteSteps : Math.max(0, this.coyote - 1);
    this._speed = this.parked ? 0 : chassis.speed * 60;
    this._rpm = Math.min(Math.abs(this.rearWheel.angularVelocity) / TUNING.maxWheelAv, 1);

    const touching = this.grounded || this.headContacts > 0 || this.chassisContacts > 0;
    if (touching && this.tilt() > TUNING.invertedCrashTilt) {
      this.invertedMs += STEP_MS;
      if (this.invertedMs > TUNING.invertedCrashMs) this.crashed = true;
    } else {
      this.invertedMs = 0;
    }

    if (this.headContacts > 0 && this.tilt() > TUNING.headCrashTilt) {
      this.crashed = true;
    } else if (this.headHitEdge) {
      this.headHitEdge = false;
    }

    if (chassis.position.y > this.killY) this.crashed = true;

    if (this.crashed && !this.ejected) this.ejectRider();
  }

  /** Fling the rider off the bike as a free physics body (crash feedback). */
  private ejectRider(): void {
    this.ejected = true;
    const world = this.scene.matter.world;
    const B = this.scene.matter.body;
    const h = this.head.position;
    const group = world.nextGroup(true);
    const body = this.scene.matter.bodies.rectangle(h.x, h.y + 6, 14, 30, {
      label: 'ragdoll',
      density: 0.0012,
      friction: 0.6,
      frictionAir: 0.02,
      restitution: 0.25,
      chamfer: { radius: 6 },
      collisionFilter: { group, category: 0x0001, mask: 0xffffffff },
    });
    const cv = this.chassis.velocity;
    const a = this.chassis.angle;
    B.setAngle(body, a);
    B.setVelocity(body, { x: cv.x + Math.cos(a) * 2.75 + 1.5, y: cv.y - 5.5 });
    B.setAngularVelocity(body, 0.3 + Math.random() * 0.25);
    world.add(body);
    this.ragdollBody = body;
  }

  /**
   * Hard landings blow soft-constraint wheels out of their sockets; clamp the
   * socket error every step so the bike can never collapse or scatter.
   */
  private enforceIntegrity(): void {
    const B = this.scene.matter.body;
    for (const b of [this.chassis, this.rearWheel, this.frontWheel]) {
      const vx = clamp(b.velocity.x, -TUNING.maxHorizPerStep, TUNING.maxHorizPerStep);
      const vy = Math.min(b.velocity.y, TUNING.maxFallPerStep);
      if (vx !== b.velocity.x || vy !== b.velocity.y) B.setVelocity(b, { x: vx, y: vy });
    }

    const a = this.chassis.angle;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const p = this.chassis.position;
    const fix = (wheel: Body, dx: number): void => {
      const sx = p.x + cos * dx - sin * BIKE.wheelDy;
      const sy = p.y + sin * dx + cos * BIKE.wheelDy;
      const ex = wheel.position.x - sx;
      const ey = wheel.position.y - sy;
      let lat = cos * ex + sin * ey;
      let vert = -sin * ex + cos * ey;
      let changed = false;
      let hard = false;
      if (lat > TUNING.latMax) {
        lat = TUNING.latMax;
        changed = true;
      } else if (lat < -TUNING.latMax) {
        lat = -TUNING.latMax;
        changed = true;
      }
      if (vert < -TUNING.compressMax) {
        changed = true;
        if (vert < -TUNING.vertSnap) hard = true;
        vert = -TUNING.compressMax;
      } else if (vert > TUNING.vertTravel) {
        changed = true;
        if (vert > TUNING.vertSnap) {
          vert = TUNING.vertTravel;
          hard = true;
        } else vert = TUNING.vertTravel + (vert - TUNING.vertTravel) * 0.65;
      }
      if (!changed) return;
      const nex = cos * lat - sin * vert;
      const ney = sin * lat + cos * vert;
      B.setPosition(wheel, { x: sx + nex, y: sy + ney });
      if (hard) {
        B.setVelocity(wheel, {
          x: (wheel.velocity.x + this.chassis.velocity.x) * 0.5,
          y: (wheel.velocity.y + this.chassis.velocity.y) * 0.5,
        });
      }
    };
    fix(this.rearWheel, BIKE.backDx);
    fix(this.frontWheel, BIKE.frontDx);
  }

  setSpawn(x: number, y: number): void {
    this.spawnX = x;
    this.spawnY = y;
    this.killY = y + TUNING.killDrop;
  }

  reset(): void {
    const B = this.scene.matter.body;
    const place = (b: Body, ox: number, oy: number): void => {
      B.setPosition(b, { x: this.spawnX + ox, y: this.spawnY + oy });
      B.setVelocity(b, { x: 0, y: 0 });
      B.setAngularVelocity(b, 0);
      B.setAngle(b, 0);
    };
    place(this.chassis, 0, 0);
    place(this.rearWheel, BIKE.backDx, BIKE.wheelDy);
    place(this.frontWheel, BIKE.frontDx, BIKE.wheelDy);
    place(this.head, BIKE.headDx, BIKE.headDy);
    if (this.ragdollBody) {
      this.scene.matter.world.remove(this.ragdollBody);
      this.ragdollBody = null;
    }
    this.ejected = false;
    this.contacts = 0;
    this.backContacts = 0;
    this.frontContacts = 0;
    this.headContacts = 0;
    this.chassisContacts = 0;
    this.grounded = false;
    this.crashed = false;
    this.invertedMs = 0;
    this.coyote = 0;
    this._speed = 0;
    this._rpm = 0;
  }

  destroy(): void {
    const world = this.scene.matter.world;
    world.off('collisionstart', this.onCollision, this);
    world.off('collisionend', this.onCollisionEnd, this);
    world.remove(this.parts);
  }
}
