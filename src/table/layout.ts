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
} as const;
