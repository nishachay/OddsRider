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

export const WORLD = {
  spawnX: 320,
  groundTopY: 620,
  groundLength: 200_000,
  groundThickness: 400,
  tickSpacing: 500,
  markerSpacing: 2_500,
  markerMaxX: 60_000,
  finishX: 60_000,
};

export const PHYSICS = {
  gravityY: 2.4,

  wheelRadius: 21,
  wheelDensity: 0.0015,
  wheelFriction: 1.05,
  wheelFrictionStatic: 1.2,
  wheelRestitution: 0.1,

  chassisWidth: 74,
  chassisHeight: 22,
  chassisDensity: 0.0022,
  chassisChamfer: 10,
  chassisFriction: 0.4,

  suspStiffness: 0.38,
  suspDamping: 0.1,

  rearWheelOffset: { x: -27, y: 31 },
  frontWheelOffset: { x: 29, y: 31 },
  suspAnchors: [
    { x: -24, y: 9 },
    { x: 6, y: 9 },
  ],

  driveMaxSpeed: 38,
  driveAccel: 70,
  coastDecel: 14,
  reverseMaxSpeed: 9,
  brakeAccel: 160,

  leanRate: 3.4,
  leanRateAirMult: 1.7,
  maxSpinAir: 6.2,
  maxSpinGrounded: 2.6,
  uprightSpring: 9,
  uprightDamp: 2.2,

  jumpVelocity: 12.5,
  jumpCooldownMs: 350,
  coyoteMs: 90,

  nitroSpeedMult: 1.35,
  nitroForce: 0.002,
};
