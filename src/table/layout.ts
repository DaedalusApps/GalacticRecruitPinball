import { BUMPERS, COLORS } from '../utils/constants';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface SlingshotLayoutConfig {
  position: Position3D;
  vertices: { x: number; y: number }[]; // In table XY coords relative to center
  kickDirection: { x: number; y: number }; // Normalized kick vector
  impulseMagnitude: number;
  score: number;
  color: number;
}

export interface BumperLayoutConfig {
  id: string;
  position: Position3D;
  radius: number;
  height: number;
  alienType: 'squid' | 'crab' | 'octopus';
}

export interface ReentryLaneLayoutConfig {
  id: string;
  index: number;
  position: Position3D;
  width: number;
  length: number;
  lightPosition: Position3D;
  color: number;
}

export interface LaneDividerConfig {
  position: Position3D;
  width: number;
  length: number;
  height: number;
}

export interface LaunchRampLayoutConfig {
  entrance: Position3D;
  exit: Position3D;
  splinePoints: Position3D[];
  exitVelocity: Position3D;
  score: number;
}

export interface DropTargetLayoutConfig {
  id: string;
  position: Position3D;
  width: number;
  depth: number;
  height: number;
  color: number;
  score: number;
}

export interface SpotTargetLayoutConfig {
  id: string;
  position: Position3D;
  radius: number;
  height: number;
  color: number;
  score: number;
}

export interface UfoBeamLayoutConfig {
  id: string;
  type: 'yellow' | 'red' | 'green';
  position: Position3D;
  color: number;
  captureRadius: number;
  ejectDirection: { x: number; y: number };
  ejectSpeed: number;
  score: number;
}

export interface SpinnerLayoutConfig {
  id: string;
  side: 'left' | 'right';
  position: Position3D;
  radius: number;
  width: number;
  color: number;
  baseScore: number;
  boostedScore: number;
}

export interface SpaceWarpLayoutConfig {
  id: string;
  position: Position3D;
  width: number;
  length: number;
  color: number;
  score: number;
}

/**
 * Complete layout specifications for table elements in Galactic Recruit Pinball.
 * Coordinates are in world units on the table playfield:
 * X: -10 (left) to +10 (right)
 * Y: -20 (drain/bottom) to +20 (top arch)
 * Z: 0 (table surface) to +3 (top of cabinet)
 */
export const TABLE_LAYOUT = {
  // 1. Slingshots (Triangular kickers above the main lower flippers)
  SLINGSHOTS: {
    LEFT: {
      position: { x: -5.2, y: -11.5, z: 0.5 } as Position3D,
      vertices: [
        { x: 1.0, y: 3.0 },   // Top point: (-4.2, -8.5)
        { x: 1.2, y: -2.7 },  // Bottom-inner point: (-4.0, -14.2)
        { x: -1.2, y: -2.0 }, // Bottom-outer point: (-6.4, -13.5)
      ],
      kickDirection: { x: 0.85, y: 0.52 }, // Upward & inward towards center
      impulseMagnitude: 14,
      score: 500,
      color: COLORS.NEON_CYAN,
    } as SlingshotLayoutConfig,

    RIGHT: {
      position: { x: 5.2, y: -11.5, z: 0.5 } as Position3D,
      vertices: [
        { x: -1.0, y: 3.0 },  // Top point: (4.2, -8.5)
        { x: -1.2, y: -2.7 }, // Bottom-inner point: (4.0, -14.2)
        { x: 1.2, y: -2.0 },  // Bottom-outer point: (6.4, -13.5)
      ],
      kickDirection: { x: -0.85, y: 0.52 }, // Upward & inward towards center
      impulseMagnitude: 14,
      score: 500,
      color: COLORS.NEON_PINK,
    } as SlingshotLayoutConfig,
  },

  // 2. 3 Attack Bumpers (Upper right quadrant triangle formation)
  BUMPERS: [
    {
      id: 'bumper-top',
      position: { x: 3.5, y: 11.5, z: 0.5 } as Position3D,
      radius: BUMPERS.RADIUS,
      height: 1.2,
      alienType: 'squid',
    },
    {
      id: 'bumper-bottom-left',
      position: { x: 1.2, y: 8.0, z: 0.5 } as Position3D,
      radius: BUMPERS.RADIUS,
      height: 1.2,
      alienType: 'crab',
    },
    {
      id: 'bumper-bottom-right',
      position: { x: 5.8, y: 8.0, z: 0.5 } as Position3D,
      radius: BUMPERS.RADIUS,
      height: 1.2,
      alienType: 'octopus',
    },
  ] as BumperLayoutConfig[],

  // 3. Re-entry Lanes (3 Rollover lanes located directly above Attack Bumpers)
  REENTRY_LANES: [
    {
      id: 'reentry-lane-0',
      index: 0,
      position: { x: 1.2, y: 16.5, z: 0.5 } as Position3D,
      width: 1.8,
      length: 3.0,
      lightPosition: { x: 1.2, y: 16.5, z: 0.08 } as Position3D,
      color: COLORS.NEON_GREEN,
    },
    {
      id: 'reentry-lane-1',
      index: 1,
      position: { x: 3.5, y: 16.5, z: 0.5 } as Position3D,
      width: 1.8,
      length: 3.0,
      lightPosition: { x: 3.5, y: 16.5, z: 0.08 } as Position3D,
      color: COLORS.NEON_GREEN,
    },
    {
      id: 'reentry-lane-2',
      index: 2,
      position: { x: 5.8, y: 16.5, z: 0.5 } as Position3D,
      width: 1.8,
      length: 3.0,
      lightPosition: { x: 5.8, y: 16.5, z: 0.08 } as Position3D,
      color: COLORS.NEON_GREEN,
    },
  ] as ReentryLaneLayoutConfig[],

  // 4. Lane Dividers / Guides for Re-entry Area
  LANE_DIVIDERS: [
    { position: { x: 0.2, y: 16.5, z: 0.4 }, width: 0.2, length: 3.2, height: 0.8 },
    { position: { x: 2.35, y: 16.5, z: 0.4 }, width: 0.2, length: 3.2, height: 0.8 },
    { position: { x: 4.65, y: 16.5, z: 0.4 }, width: 0.2, length: 3.2, height: 0.8 },
    { position: { x: 6.8, y: 16.5, z: 0.4 }, width: 0.2, length: 3.2, height: 0.8 },
  ] as LaneDividerConfig[],

  // 5. Inlane / Outlane Guide Geometry
  INLANE_OUTLANE_GUIDES: [
    // Left outlane outer wall
    { position: { x: -8.8, y: -13.0, z: 0.4 }, width: 0.3, length: 7.0, height: 0.8 },
    // Left inlane/outlane divider
    { position: { x: -6.8, y: -13.5, z: 0.4 }, width: 0.3, length: 6.0, height: 0.8 },
    // Right inlane/outlane divider
    { position: { x: 6.8, y: -13.5, z: 0.4 }, width: 0.3, length: 6.0, height: 0.8 },
  ],

  // 6. Cannon Launch Ramp & Wire Habitrail
  LAUNCH_RAMP: {
    entrance: { x: -6.8, y: 1.0, z: 0.5 } as Position3D,
    exit: { x: 1.0, y: 12.0, z: 0.8 } as Position3D,
    splinePoints: [
      { x: -6.8, y: 1.0, z: 0.5 },
      { x: -7.2, y: 7.0, z: 1.5 },
      { x: -6.5, y: 13.0, z: 2.2 },
      { x: -3.5, y: 17.5, z: 2.5 },
      { x: 0.0, y: 15.0, z: 1.8 },
      { x: 1.0, y: 12.0, z: 0.8 },
    ] as Position3D[],
    exitVelocity: { x: 1.5, y: -12.0, z: 0 } as Position3D,
    score: 10000,
  } as LaunchRampLayoutConfig,

  // 7. Drop Targets (Booster Targets on Mid-Left)
  DROP_TARGETS: {
    BOOSTER: [
      { id: 'booster-1', position: { x: -5.8, y: 7.0, z: 0.5 }, width: 0.3, depth: 1.2, height: 0.8, color: COLORS.NEON_YELLOW, score: 1000 },
      { id: 'booster-2', position: { x: -5.8, y: 8.8, z: 0.5 }, width: 0.3, depth: 1.2, height: 0.8, color: COLORS.NEON_YELLOW, score: 1000 },
      { id: 'booster-3', position: { x: -5.8, y: 10.6, z: 0.5 }, width: 0.3, depth: 1.2, height: 0.8, color: COLORS.NEON_YELLOW, score: 1000 },
    ] as DropTargetLayoutConfig[],
  },

  // 8. Spot Targets (Mission, Medal, and Hazards)
  SPOT_TARGETS: {
    MISSION: [
      { id: 'mission-1', position: { x: -1.6, y: 0.0, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_CYAN, score: 2000 },
      { id: 'mission-2', position: { x: 0.0, y: 0.0, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_CYAN, score: 2000 },
      { id: 'mission-3', position: { x: 1.6, y: 0.0, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_CYAN, score: 2000 },
    ] as SpotTargetLayoutConfig[],
    MEDAL: [
      { id: 'medal-1', position: { x: -3.5, y: 12.0, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_PINK, score: 3000 },
      { id: 'medal-2', position: { x: -2.0, y: 13.2, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_PINK, score: 3000 },
      { id: 'medal-3', position: { x: -0.5, y: 14.4, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_PINK, score: 3000 },
    ] as SpotTargetLayoutConfig[],
    HAZARDS_LEFT: [
      { id: 'hazard-l1', position: { x: -3.8, y: -4.5, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_YELLOW, score: 1500 },
      { id: 'hazard-l2', position: { x: -3.8, y: -3.0, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_YELLOW, score: 1500 },
      { id: 'hazard-l3', position: { x: -3.8, y: -1.5, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_YELLOW, score: 1500 },
    ] as SpotTargetLayoutConfig[],
    HAZARDS_RIGHT: [
      { id: 'hazard-r1', position: { x: 3.8, y: -4.5, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_YELLOW, score: 1500 },
      { id: 'hazard-r2', position: { x: 3.8, y: -3.0, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_YELLOW, score: 1500 },
      { id: 'hazard-r3', position: { x: 3.8, y: -1.5, z: 0.5 }, radius: 0.4, height: 0.8, color: COLORS.NEON_YELLOW, score: 1500 },
    ] as SpotTargetLayoutConfig[],
  },

  // 9. 3 UFO Beams (Yellow mid-left, Red upper-right, Green lower-left)
  UFO_BEAMS: {
    YELLOW: {
      id: 'ufo-beam-yellow',
      type: 'yellow',
      position: { x: -6.5, y: -2.5, z: 0.1 } as Position3D,
      color: COLORS.NEON_YELLOW,
      captureRadius: 1.2,
      ejectDirection: { x: 0.8, y: -0.6 },
      ejectSpeed: 16,
      score: 10000,
    } as UfoBeamLayoutConfig,
    RED: {
      id: 'ufo-beam-red',
      type: 'red',
      position: { x: 6.2, y: 3.5, z: 0.1 } as Position3D,
      color: COLORS.NEON_PINK,
      captureRadius: 1.2,
      ejectDirection: { x: -0.7, y: -0.7 },
      ejectSpeed: 16,
      score: 10000,
    } as UfoBeamLayoutConfig,
    GREEN: {
      id: 'ufo-beam-green',
      type: 'green',
      position: { x: -6.5, y: -7.5, z: 0.1 } as Position3D,
      color: COLORS.NEON_GREEN,
      captureRadius: 1.2,
      ejectDirection: { x: 0.6, y: 0.8 },
      ejectSpeed: 16,
      score: 10000,
    } as UfoBeamLayoutConfig,
  },

  // 10. Alien Spinners (Left and Right)
  SPINNERS: {
    LEFT: {
      id: 'spinner-left',
      side: 'left',
      position: { x: -6.5, y: -0.5, z: 0.6 } as Position3D,
      radius: 0.6,
      width: 1.0,
      color: COLORS.NEON_CYAN,
      baseScore: 100,
      boostedScore: 1000,
    } as SpinnerLayoutConfig,
    RIGHT: {
      id: 'spinner-right',
      side: 'right',
      position: { x: 6.5, y: -0.5, z: 0.6 } as Position3D,
      radius: 0.6,
      width: 1.0,
      color: COLORS.NEON_PINK,
      baseScore: 100,
      boostedScore: 1000,
    } as SpinnerLayoutConfig,
  },

  // 11. Space Warp Rollover
  SPACE_WARP: {
    id: 'space-warp-rollover',
    position: { x: 3.5, y: -7.5, z: 0.1 } as Position3D,
    width: 1.8,
    length: 2.0,
    color: COLORS.NEON_CYAN,
    score: 5000,
  } as SpaceWarpLayoutConfig,
} as const;

