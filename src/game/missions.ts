/**
 * Galactic Recruit Pinball - All 17 Table Missions (P3.4)
 *
 * Implements full specifications for all 17 missions across Tier 1 to Tier 5,
 * with exact objectives, target counts, phase breakdowns, point rewards, and progress lights rewards.
 */

export type MissionTier = 1 | 2 | 3 | 4 | 5;

export type MissionEventType =
  | 'ramp'
  | 'lane'
  | 'bumper'
  | 'top_bumper'
  | 'drop_target'
  | 'spot_target'
  | 'medal_target'
  | 'hazard_left'
  | 'hazard_right'
  | 'ufo_beam'
  | 'spinner'
  | 'space_warp'
  | 'slingshot'
  | 'outlane'
  | 'kickback'
  | 'center_post'
  | 'energy_core'
  | 'tractor_beam'
  | 'skill_shot';

export interface MissionPhaseDefinition {
  phaseIndex: number;
  description: string;
  eventType: MissionEventType;
  targetCount: number;
  expectedParam?: { key: string; value: unknown };
}

export interface MissionDefinition {
  number: number;
  id: string;
  tier: MissionTier;
  title: string;
  spaceCadetName: string;
  description: string;
  instructions: string;
  pointsReward: number;
  progressLightsReward: number;
  targetCount: number;
  primaryEventType: MissionEventType;
  phases?: MissionPhaseDefinition[];
}

export const ALL_MISSIONS: readonly MissionDefinition[] = [
  // ==========================================================================
  // TIER 1: Rookie Defender Missions (1 - 4)
  // ==========================================================================
  {
    number: 1,
    id: 'cannon-calibration',
    tier: 1,
    title: 'Cannon Calibration',
    spaceCadetName: 'Launch Training',
    description: 'Calibrate the defense rail launcher by shooting the Cannon Launch Ramp 3 times.',
    instructions: 'SHOOT CANNON LAUNCH RAMP 3 TIMES',
    pointsReward: 500000,
    progressLightsReward: 6,
    targetCount: 3,
    primaryEventType: 'ramp',
  },
  {
    number: 2,
    id: 'atmospheric-scan',
    tier: 1,
    title: 'Atmospheric Scan',
    spaceCadetName: 'Re-entry Training',
    description: 'Scan planetary perimeter by sending the ball through any Re-entry Lane 3 times.',
    instructions: 'PASS THROUGH RE-ENTRY LANES 3 TIMES',
    pointsReward: 500000,
    progressLightsReward: 6,
    targetCount: 3,
    primaryEventType: 'lane',
  },
  {
    number: 3,
    id: 'alien-target-drill',
    tier: 1,
    title: 'Alien Target Drill',
    spaceCadetName: 'Target Practice',
    description: 'Engage incoming alien vanguard by hitting the Attack Bumpers 8 times.',
    instructions: 'HIT ATTACK BUMPERS 8 TIMES',
    pointsReward: 500000,
    progressLightsReward: 6,
    targetCount: 8,
    primaryEventType: 'bumper',
  },
  {
    number: 4,
    id: 'invasion-recon',
    tier: 1,
    title: 'Invasion Recon',
    spaceCadetName: 'Science Mission',
    description: 'Collect tactical intelligence by hitting any 9 Drop Targets across the playfield.',
    instructions: 'HIT 9 DROP TARGETS',
    pointsReward: 750000,
    progressLightsReward: 9,
    targetCount: 9,
    primaryEventType: 'drop_target',
  },

  // ==========================================================================
  // TIER 2: Grid Gunner & Crab Hunter Missions (5 - 8)
  // ==========================================================================
  {
    number: 5,
    id: 'swarm-extermination',
    tier: 2,
    title: 'Swarm Extermination',
    spaceCadetName: 'Bug Hunt',
    description: 'Repel alien swarm forces by striking 15 targets (drop + spot targets combined).',
    instructions: 'HIT 15 TARGETS (DROP OR SPOT)',
    pointsReward: 750000,
    progressLightsReward: 7,
    targetCount: 15,
    primaryEventType: 'spot_target', // Handled as any target
  },
  {
    number: 6,
    id: 'civilian-evac',
    tier: 2,
    title: 'Civilian Evac',
    spaceCadetName: 'Rescue Mission',
    description: 'Upgrade booster power grid then enter any UFO Abduction Beam to complete evacuation.',
    instructions: 'HIT 3 DROP TARGETS THEN ENTER UFO BEAM',
    pointsReward: 750000,
    progressLightsReward: 7,
    targetCount: 4, // 3 drops + 1 UFO beam
    primaryEventType: 'drop_target',
    phases: [
      {
        phaseIndex: 0,
        description: 'Hit 3 Drop Targets',
        eventType: 'drop_target',
        targetCount: 3,
      },
      {
        phaseIndex: 1,
        description: 'Enter UFO Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
      },
    ],
  },
  {
    number: 7,
    id: 'crab-wave-assault',
    tier: 2,
    title: 'Crab Wave Assault',
    spaceCadetName: 'Alien Menace',
    description: 'Assault crab invaders by hitting the Attack Bumpers 8 times.',
    instructions: 'HIT ATTACK BUMPERS 8 TIMES',
    pointsReward: 750000,
    progressLightsReward: 7,
    targetCount: 8,
    primaryEventType: 'bumper',
  },
  {
    number: 8,
    id: 'classified-op',
    tier: 2,
    title: 'Classified Op',
    spaceCadetName: 'Secret Mission',
    description: 'Infiltrate enemy warp corridors in precise sequence: Yellow -> Red -> Green UFO Beams.',
    instructions: 'ENTER UFO BEAMS: YELLOW -> RED -> GREEN',
    pointsReward: 1500000,
    progressLightsReward: 10,
    targetCount: 3,
    primaryEventType: 'ufo_beam',
    phases: [
      {
        phaseIndex: 0,
        description: 'Enter Yellow UFO Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
        expectedParam: { key: 'color', value: 'yellow' },
      },
      {
        phaseIndex: 1,
        description: 'Enter Red UFO Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
        expectedParam: { key: 'color', value: 'red' },
      },
      {
        phaseIndex: 2,
        description: 'Enter Green UFO Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
        expectedParam: { key: 'color', value: 'green' },
      },
    ],
  },

  // ==========================================================================
  // TIER 3: Wave Captain & Octopus Slayer Missions (9 - 12)
  // ==========================================================================
  {
    number: 9,
    id: 'rogue-asteroid',
    tier: 3,
    title: 'Rogue Asteroid',
    spaceCadetName: 'Stray Comet',
    description: 'Target right hazard zone then enter UFO Beam to deflect asteroid collision course.',
    instructions: 'HIT 3 RIGHT HAZARDS THEN ENTER UFO BEAM',
    pointsReward: 1000000,
    progressLightsReward: 7,
    targetCount: 4,
    primaryEventType: 'hazard_right',
    phases: [
      {
        phaseIndex: 0,
        description: 'Hit 3 Right Hazard Targets',
        eventType: 'hazard_right',
        targetCount: 3,
      },
      {
        phaseIndex: 1,
        description: 'Enter UFO Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
      },
    ],
  },
  {
    number: 10,
    id: 'ion-storm',
    tier: 3,
    title: 'Ion Storm',
    spaceCadetName: 'Space Radiation',
    description: 'Shield against ion radiation by hitting 3 Left Hazards then escaping through UFO Beam.',
    instructions: 'HIT 3 LEFT HAZARDS THEN ENTER UFO BEAM',
    pointsReward: 1000000,
    progressLightsReward: 7,
    targetCount: 4,
    primaryEventType: 'hazard_left',
    phases: [
      {
        phaseIndex: 0,
        description: 'Hit 3 Left Hazard Targets',
        eventType: 'hazard_left',
        targetCount: 3,
      },
      {
        phaseIndex: 1,
        description: 'Enter UFO Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
      },
    ],
  },
  {
    number: 11,
    id: 'gravity-anomaly',
    tier: 3,
    title: 'Gravity Anomaly',
    spaceCadetName: 'Black Hole',
    description: 'Supercharge slingshot repulsors then plunge into Mothership Tractor Beam gravity well.',
    instructions: 'HIT SLINGSHOTS 5 TIMES THEN ENTER TRACTOR BEAM',
    pointsReward: 1000000,
    progressLightsReward: 7,
    targetCount: 6,
    primaryEventType: 'slingshot',
    phases: [
      {
        phaseIndex: 0,
        description: 'Hit Slingshots 5 Times',
        eventType: 'slingshot',
        targetCount: 5,
      },
      {
        phaseIndex: 1,
        description: 'Enter Mothership Tractor Beam',
        eventType: 'tractor_beam',
        targetCount: 1,
      },
    ],
  },
  {
    number: 12,
    id: 'signal-jam',
    tier: 3,
    title: 'Signal Jam',
    spaceCadetName: 'Cosmic Plague',
    description: 'Disrupt alien communications by spinning Alien Discs 75 times then triggering Space Warp.',
    instructions: 'SPIN ALIEN DISCS 75 TIMES THEN HIT SPACE WARP',
    pointsReward: 1750000,
    progressLightsReward: 9,
    targetCount: 75,
    primaryEventType: 'spinner',
    phases: [
      {
        phaseIndex: 0,
        description: 'Spin Alien Discs 75 Times',
        eventType: 'spinner',
        targetCount: 75,
      },
      {
        phaseIndex: 1,
        description: 'Hit Space Warp Rollover',
        eventType: 'space_warp',
        targetCount: 1,
      },
    ],
  },

  // ==========================================================================
  // TIER 4: Fleet Commander & UFO Tracker Missions (13 - 16)
  // ==========================================================================
  {
    number: 13,
    id: 'probe-recovery',
    tier: 4,
    title: 'Probe Recovery',
    spaceCadetName: 'Satellite Retrieval',
    description: 'Retrieve stranded deep-space probe telemetry by striking top attack bumper 3 times.',
    instructions: 'HIT TOP ATTACK BUMPER 3 TIMES',
    pointsReward: 1250000,
    progressLightsReward: 7,
    targetCount: 3,
    primaryEventType: 'top_bumper',
  },
  {
    number: 14,
    id: 'deep-space-patrol',
    tier: 4,
    title: 'Deep Space Patrol',
    spaceCadetName: 'Recon',
    description: 'Execute deep patrol sweep by passing through any rollover lanes 15 times.',
    instructions: 'PASS THROUGH ROLLOVER LANES 15 TIMES',
    pointsReward: 1250000,
    progressLightsReward: 7,
    targetCount: 15,
    primaryEventType: 'lane',
  },
  {
    number: 15,
    id: 'doomsday-cannon',
    tier: 4,
    title: 'Doomsday Cannon',
    spaceCadetName: 'Doomsday Machine',
    description: 'Disarm doomsday weapon charge by routing ball through table outlanes 3 times.',
    instructions: 'PASS THROUGH OUTLANES 3 TIMES',
    pointsReward: 1250000,
    progressLightsReward: 7,
    targetCount: 3,
    primaryEventType: 'outlane',
  },
  {
    number: 16,
    id: 'chrono-rift',
    tier: 4,
    title: 'Chrono Rift',
    spaceCadetName: 'Time Warp',
    description: 'Stabilize temporal rupture by energizing slingshots 25 times then shooting Launch Ramp or UFO Beam.',
    instructions: 'HIT SLINGSHOTS 25 TIMES THEN SHOOT LAUNCH RAMP OR UFO BEAM',
    pointsReward: 2000000,
    progressLightsReward: 10,
    targetCount: 25,
    primaryEventType: 'slingshot',
    phases: [
      {
        phaseIndex: 0,
        description: 'Hit Slingshots 25 Times',
        eventType: 'slingshot',
        targetCount: 25,
      },
      {
        phaseIndex: 1,
        description: 'Shoot Launch Ramp or Enter UFO Beam',
        eventType: 'ramp',
        targetCount: 1,
      },
    ],
  },

  // ==========================================================================
  // TIER 5: Grand Finale Mission (17)
  // ==========================================================================
  {
    number: 17,
    id: 'final-invasion',
    tier: 5,
    title: 'Final Invasion',
    spaceCadetName: 'Maelstrom',
    description: 'The Ultimate Battle! Complete an 8-phase assault across all table systems for the Grand Victory.',
    instructions: 'FINAL INVASION: COMPLETE ALL 8 ASSAULT PHASES',
    pointsReward: 5000000,
    progressLightsReward: 18,
    targetCount: 8,
    primaryEventType: 'drop_target',
    phases: [
      {
        phaseIndex: 0,
        description: '1/8: Hit 3 Drop Targets',
        eventType: 'drop_target',
        targetCount: 3,
      },
      {
        phaseIndex: 1,
        description: '2/8: Hit 3 Spot Targets',
        eventType: 'spot_target',
        targetCount: 3,
      },
      {
        phaseIndex: 2,
        description: '3/8: Pass 5 Rollover Lanes',
        eventType: 'lane',
        targetCount: 5,
      },
      {
        phaseIndex: 3,
        description: '4/8: Shoot Energy Core / Re-entry',
        eventType: 'energy_core',
        targetCount: 1,
      },
      {
        phaseIndex: 4,
        description: '5/8: Shoot Cannon Launch Ramp',
        eventType: 'ramp',
        targetCount: 1,
      },
      {
        phaseIndex: 5,
        description: '6/8: Spin Alien Disc',
        eventType: 'spinner',
        targetCount: 1,
      },
      {
        phaseIndex: 6,
        description: '7/8: Enter UFO Abduction Beam',
        eventType: 'ufo_beam',
        targetCount: 1,
      },
      {
        phaseIndex: 7,
        description: '8/8: Enter Mothership Tractor Beam',
        eventType: 'tractor_beam',
        targetCount: 1,
      },
    ],
  },
] as const;

/**
 * Returns all missions available for a specific tier (1 to 5).
 */
export function getMissionsForTier(tier: MissionTier): MissionDefinition[] {
  return ALL_MISSIONS.filter((m) => m.tier === tier);
}

/**
 * Returns a mission definition by its numeric ID (1 to 17).
 */
export function getMissionByNumber(num: number): MissionDefinition | undefined {
  return ALL_MISSIONS.find((m) => m.number === num);
}

/**
 * Returns a mission definition by its string ID.
 */
export function getMissionById(id: string): MissionDefinition | undefined {
  return ALL_MISSIONS.find((m) => m.id === id);
}
