import Phaser from 'phaser';
import { PHYSICS } from '../constants';
import { RawMatter } from '../matter';

const MatterBody = RawMatter.Body;

export class Bike {
  readonly chassis: MatterJS.BodyType;
  readonly rearWheel: MatterJS.BodyType;
  readonly frontWheel: MatterJS.BodyType;

  private spawnX: number;
  private spawnY: number;
  private constraints: MatterJS.ConstraintType[] = [];

  constructor(
    private scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.spawnX = x;
    this.spawnY = y;

    const group = scene.matter.world.nextGroup(true);
    const cf = { group };

    this.chassis = scene.matter.add.rectangle(x, y, PHYSICS.chassisWidth, PHYSICS.chassisHeight, {
      density: PHYSICS.chassisDensity,
      chamfer: { radius: PHYSICS.chassisChamfer },
      friction: PHYSICS.chassisFriction,
      collisionFilter: cf,
      label: 'chassis',
    });

    const mkWheel = (ox: number, label: string): MatterJS.BodyType =>
      scene.matter.add.circle(x + ox, y + PHYSICS.rearWheelOffset.y, PHYSICS.wheelRadius, {
        density: PHYSICS.wheelDensity,
        friction: PHYSICS.wheelFriction,
        frictionStatic: PHYSICS.wheelFrictionStatic,
        restitution: PHYSICS.wheelRestitution,
        collisionFilter: cf,
        label,
      });

    this.rearWheel = mkWheel(PHYSICS.rearWheelOffset.x, 'rearWheel');
    this.frontWheel = mkWheel(PHYSICS.frontWheelOffset.x, 'frontWheel');

    this.addSuspension(this.rearWheel, PHYSICS.rearWheelOffset.x, false);
    this.addSuspension(this.frontWheel, PHYSICS.frontWheelOffset.x, true);
  }

  private addSuspension(wheel: MatterJS.BodyType, wheelOx: number, mirror: boolean): void {
    const wheelY = this.spawnY + PHYSICS.rearWheelOffset.y;
    for (const anchor of PHYSICS.suspAnchors) {
      const a = { x: mirror ? -anchor.x : anchor.x, y: anchor.y };
      const ax = this.spawnX + a.x;
      const ay = this.spawnY + a.y;
      const len = Phaser.Math.Distance.Between(ax, ay, this.spawnX + wheelOx, wheelY);
      this.constraints.push(
        this.scene.matter.add.constraint(this.chassis, wheel, len, PHYSICS.suspStiffness, {
          pointA: a,
          damping: PHYSICS.suspDamping,
        }),
      );
    }
  }

  get x(): number {
    return this.chassis.position.x;
  }

  get y(): number {
    return this.chassis.position.y;
  }

  reset(): void {
    const place = (body: MatterJS.BodyType, ox: number, oy: number): void => {
      MatterBody.setPosition(body, { x: this.spawnX + ox, y: this.spawnY + oy });
      MatterBody.setAngle(body, 0);
      MatterBody.setAngularVelocity(body, 0);
      MatterBody.setVelocity(body, { x: 0, y: 0 });
    };
    place(this.chassis, 0, 0);
    place(this.rearWheel, PHYSICS.rearWheelOffset.x, PHYSICS.rearWheelOffset.y);
    place(this.frontWheel, PHYSICS.frontWheelOffset.x, PHYSICS.frontWheelOffset.y);
  }

  destroy(): void {
    for (const c of this.constraints) this.scene.matter.world.remove(c);
    this.scene.matter.world.remove(this.chassis);
    this.scene.matter.world.remove(this.rearWheel);
    this.scene.matter.world.remove(this.frontWheel);
  }
}
