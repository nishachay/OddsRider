/**
 * ODDS RIDER - PERFECT ASSETS SPEC VERSION 0.1
 * Locked Master Dimensions & Relative 2D Composite Geometry
 */

export const PERFECT_ASSETS_V0_1 = {
  version: "0.1",
  timestamp: "2026-08-22",
  sprite: {
    bikeScale: 0.33,
    bikeOriginX: 0.5,
    bikeOriginY: 0.76,
    wheelScale: 0.52,
    rearWheelScale: 0.52,
    frontWheelScale: 0.52,

    // Rear Wheel is Base Origin (0,0)
    chassisOffsetX: 55.2,
    chassisOffsetY: -9.5,
    frontWheelOffsetX: 112.2,
    frontWheelOffsetY: 0.7,
    riderOffsetX: 55.2,
    riderOffsetY: -24.8,

    riderScale: 0.4,
    ragdollScale: 1.0,
    riderOriginY: 0.85,
    riderAngleOffset: -9.5,
    seatLocalX: 0.0,
    seatLocalY: -15.3,
    flagScale: 0.5,
  },
  physics: {
    wheelR: 25,
    backDx: -56,
    frontDx: 56,
    wheelDy: 18,
    groundTopY: 620,
  },
} as const;
