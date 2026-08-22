export const PALETTE = {
  bg: 0x0a0a0b,
  surface: 0x121316,
  surfaceLine: 0x2a2c31,
  tick: 0x1d1f23,
  ink: 0xe8e8ea,
  dim: 0x7c7f86,
  toxic: 0xb6ff00,
  toxicDim: 0x8cc400,
  crimson: 0xff3355,
  tire: 0x141518,
  tread: 0x1f2126,
  body: 0x17181b,
  bodyEdge: 0x33363c,
  metal: 0x22242a,
  spoke: 0x2c2f35,
  suit: 0x1a1b1f,
  visor: 0x050506,
} as const;

export const STEP_MS = 1000 / 60;
export const MAX_STEPS_PER_FRAME = 4;

export const BIKE = {
  backDx: -56,
  frontDx: 56,
  wheelDy: 18,
  headDx: -6,
  headDy: -30,
  wheelR: 20,
  chassisW: 90,
  chassisH: 22,
  headR: 11,

  chassisDensity: 0.0022,
  chassisFriction: 0.2,
  chassisFrictionAir: 0.012,
  chassisRestitution: 0.1,

  wheelDensity: 0.0016,
  wheelFriction: 1.4,
  wheelFrictionStatic: 2.0,
  wheelRestitution: 0.15,

  headDensity: 0.0008,
  headFriction: 0.4,
  headRestitution: 0.1,

  suspStiffness: 0.62,
  suspDamping: 0.2,
  suspAnchorSpread: 14,

  headStiffness: 0.9,
  headDamping: 0.1,
  headAnchorSpread: 10,
  headAnchorY: -8,
} as const;

export const TUNING = {
  maxWheelAv: 1.3,
  wheelAccel: 0.12,
  brakeDecel: 0.09,
  reverseTargetAv: -0.28,

  wheelieTorque: 0.018,
  maxWheelieAv: 0.11,

  flipLean: 0.05,
  groundLean: 0.006,
  tippedAngle: 1.75,

  maxFallPerStep: 20,
  maxHorizPerStep: 48,
  latMax: 8,
  vertTravel: 20,
  vertSnap: 55,
  compressMax: 8,

  parkSpeed: 0.6,

  jumpVelocity: 6.5,
  jumpCooldownMs: 350,
  coyoteSteps: 6,

  nitroDrain: 0.4,
  nitroTrickle: 0.05,
  nitroArm: 0.1,
  nitroForce: 0.0029,

  invertedCrashTilt: 2.4,
  invertedCrashMs: 900,
  headCrashTilt: 0.9,

  killDrop: 600,
  winBonus: 1000,
} as const;

export const WORLD = {
  spawnX: 320,
  spawnDy: 60,
  groundTopY: 620,
  groundLength: 200_000,
  groundThickness: 400,
  tickSpacing: 500,
  markerSpacing: 2_500,
  markerMaxX: 60_000,
  finishX: 60_000,
};

export const SPRITE = {
  bikeScale: 0.063,
  bikeOriginX: 0.5,
  bikeOriginY: 0.76,
  wheelScale: 0.025,
  rearWheelScale: 0.025,
  frontWheelScale: 0.025,
  rearWheelOffsetX: 0,
  rearWheelOffsetY: 0,
  frontWheelOffsetX: 0,
  frontWheelOffsetY: 0,
  riderScale: 0.082,
  ragdollScale: 0.082,
  riderOriginY: 0.85,
  riderAngleOffset: 10,
  seatLocalX: 5,
  seatLocalY: -10,
  flagScale: 0.06,
};
