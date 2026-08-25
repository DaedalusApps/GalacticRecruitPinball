/**
 * Table, Physics, Game & Visual Constants for Galactic Recruit Pinball
 */

// Table Dimensions (in world physics / render units: 1 unit ~ 10cm or scaled meters)
export const TABLE = {
  WIDTH: 20, // X axis: -10 to +10
  LENGTH: 40, // Y axis: -20 (drain) to +20 (top)
  INCLINE_ANGLE_DEG: 6.5, // Standard pinball table incline (~6.5 degrees)
  WALL_HEIGHT: 3,
  WALL_THICKNESS: 0.6,
  RESTITUTION: 0.4,
  FRICTION: 0.05,
} as const;

// Physics World Configuration
export const PHYSICS = {
  GRAVITY_MAGNITUDE: 9.81,
  // Gravity projected along table slope
  TABLE_TILT_RAD: (TABLE.INCLINE_ANGLE_DEG * Math.PI) / 180,
  TIME_STEP: 1 / 60,
  MAX_SUB_STEPS: 10,
  BALL_MAX_VELOCITY: 50,
} as const;

// Ball Configuration
export const BALL = {
  RADIUS: 0.5,
  MASS: 0.1, // kg
  LINEAR_DAMPING: 0.01,
  ANGULAR_DAMPING: 0.05,
  RESTITUTION: 0.6,
  FRICTION: 0.1,
  MAX_VELOCITY: 50,
  INITIAL_POSITION: { x: 8.8, y: -18, z: 0.5 } as const, // In the plunger lane
} as const;

// Flipper Parameters
export const FLIPPER = {
  LENGTH: 3.5,
  RADIUS_BASE: 0.6,
  RADIUS_TIP: 0.35,
  REST_ANGLE_DEG: 30, // Angle downwards towards center at rest
  STROKE_ANGLE_DEG: 50, // Angular travel
  ANGULAR_VELOCITY: 40, // rad/s on flip
  RETURN_ANGULAR_VELOCITY: 25, // rad/s on return spring
  RESTITUTION: 0.7,
  LEFT_POSITION: { x: -3.8, y: -16.5, z: 0.5 } as const,
  RIGHT_POSITION: { x: 3.8, y: -16.5, z: 0.5 } as const,
  UPPER_LEFT_POSITION: { x: -7.5, y: 5.0, z: 0.5 } as const,
} as const;

// Plunger (Railgun) Parameters
export const PLUNGER = {
  LANE_X: 8.8,
  MIN_FORCE: 5,
  MAX_FORCE: 45,
  CHARGE_RATE: 30, // Force units added per second held
  MAX_CHARGE_TIME_SEC: 1.5,
} as const;

// Bumper & Scoring Elements
export const BUMPERS = {
  RADIUS: 1.2,
  IMPULSE: 15,
  POINTS_TIER_1: 500, // Blue squid
  POINTS_TIER_2: 1500, // Green crab
  POINTS_TIER_3: 4000, // Red octopus
} as const;

// Color Palette & Visuals
export const COLORS = {
  BG_DARK: 0x050508,
  TABLE_SURFACE: 0x0a0d14,
  NEON_GREEN: 0x00ff66,
  NEON_CYAN: 0x00e5ff,
  NEON_PINK: 0xff007f,
  NEON_YELLOW: 0xffe600,
  CHROME_BALL: 0xe0e8f5,
  WIRE_RAIL: 0x88bbff,
} as const;

// Keyboard Controls
export const CONTROLS = {
  LEFT_FLIPPER: ['KeyZ', 'KeyA', 'ShiftLeft'],
  RIGHT_FLIPPER: ['Slash', 'KeyM', 'ShiftRight'],
  UPPER_LEFT_FLIPPER: ['KeyS', 'KeyW'],
  PLUNGER: ['Space', 'Enter', 'ArrowDown'],
  NUDGE_LEFT: ['KeyX', 'ArrowLeft'],
  NUDGE_RIGHT: ['Period', 'ArrowRight'],
  NUDGE_UP: ['ArrowUp'],
  CAMERA_TOGGLE: ['KeyC', 'KeyV'],
  SOUND_TOGGLE: ['KeyO'],
  PAUSE: ['KeyP', 'Escape'],
} as const;

// Game Rules & Progression
export const GAME_RULES = {
  INITIAL_BALLS: 3,
  MAX_TILT_WARNINGS: 3,
  BALL_SAVER_DURATION_SEC: 8,
  TOTAL_PROGRESS_LIGHTS: 18,
  MAX_RANKS: 9,
} as const;
