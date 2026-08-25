import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RankManager, RANKS } from '../src/game/ranks';
import {
  ALL_MISSIONS,
  getMissionsForTier,
  getMissionByNumber,
} from '../src/game/missions';
import {
  MissionControl,
  ProgressRing,
  EnergyCore,
  LCDTicker,
} from '../src/game/control';
import { ScoreManager } from '../src/game/scoring';
import { GameStateManager } from '../src/game/state';

describe('Phase 3: Mission System (P3.1 - P3.7)', () => {
  // ==========================================================================
  // [P3.1 & P3.6] RankManager & 9 Ranks
  // ==========================================================================
  describe('RankManager & 9 Ranks (P3.1, P3.6)', () => {
    let rankManager: RankManager;

    beforeEach(() => {
      rankManager = new RankManager();
    });

    it('defines all 9 defender ranks with exact titles, icons, and space cadet equivalents', () => {
      expect(RANKS).toHaveLength(9);

      const expectedRanks = [
        { level: 1, title: 'Rookie Defender', spaceCadet: 'Cadet', icon: 'squid-1' },
        { level: 2, title: 'Grid Gunner', spaceCadet: 'Ensign', icon: 'squid-2' },
        { level: 3, title: 'Crab Hunter', spaceCadet: 'Lieutenant', icon: 'crab' },
        { level: 4, title: 'Wave Captain', spaceCadet: 'Captain', icon: 'crab-shield' },
        { level: 5, title: 'Octopus Slayer', spaceCadet: 'Lt. Commander', icon: 'octopus' },
        { level: 6, title: 'Fleet Commander', spaceCadet: 'Commander', icon: 'octopus-crown' },
        { level: 7, title: 'UFO Tracker', spaceCadet: 'Commodore', icon: 'ufo-small' },
        { level: 8, title: 'Mothership Hunter', spaceCadet: 'Admiral', icon: 'ufo-large' },
        { level: 9, title: 'Galactic Admiral', spaceCadet: 'Fleet Admiral', icon: 'mothership-gold' },
      ];

      for (let i = 0; i < 9; i++) {
        const r = RANKS[i];
        const exp = expectedRanks[i];
        expect(r.level).toBe(exp.level);
        expect(r.title).toBe(exp.title);
        expect(r.spaceCadetEquivalent).toBe(exp.spaceCadet);
        expect(r.icon).toBe(exp.icon);
        expect(r.promotionBonus).toBeGreaterThan(0);
      }
    });

    it('initializes at Rank 1 (Rookie Defender)', () => {
      expect(rankManager.getRankNumber()).toBe(1);
      expect(rankManager.getRank().title).toBe('Rookie Defender');
      expect(rankManager.isMaxRank()).toBe(false);
    });

    it('promotes rank sequentially from 1 to 9 and awards promotion bonus points', () => {
      const promotionListener = vi.fn();
      rankManager.onPromotion = promotionListener;

      // Promote 1 -> 2
      const res1 = rankManager.promote();
      expect(res1.promoted).toBe(true);
      expect(res1.newRank.level).toBe(2);
      expect(res1.newRank.title).toBe('Grid Gunner');
      expect(res1.bonusPoints).toBe(res1.newRank.promotionBonus);
      expect(promotionListener).toHaveBeenCalledWith(res1.newRank, res1.bonusPoints);

      // Promote 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9
      for (let lvl = 3; lvl <= 9; lvl++) {
        const res = rankManager.promote();
        expect(res.promoted).toBe(true);
        expect(res.newRank.level).toBe(lvl);
      }

      expect(rankManager.getRankNumber()).toBe(9);
      expect(rankManager.getRank().title).toBe('Galactic Admiral');
      expect(rankManager.isMaxRank()).toBe(true);

      // Capped at 9 - further promotion returns false
      const resMax = rankManager.promote();
      expect(resMax.promoted).toBe(false);
      expect(rankManager.getRankNumber()).toBe(9);
    });

    it('allows setting rank directly and demoting for testing', () => {
      rankManager.setRank(5);
      expect(rankManager.getRankNumber()).toBe(5);
      expect(rankManager.getRank().title).toBe('Octopus Slayer');

      const demoted = rankManager.demote();
      expect(demoted.demoted).toBe(true);
      expect(rankManager.getRankNumber()).toBe(4);

      rankManager.reset();
      expect(rankManager.getRankNumber()).toBe(1);
    });
  });

  // ==========================================================================
  // [P3.2 & P3.6] 18 Progress Lights Ring
  // ==========================================================================
  describe('18 Progress Lights Ring (P3.2, P3.6)', () => {
    let progressRing: ProgressRing;

    beforeEach(() => {
      progressRing = new ProgressRing();
    });

    it('initializes with 0 lit lights out of 18', () => {
      expect(progressRing.getLitCount()).toBe(0);
      expect(progressRing.maxLights).toBe(18);
      expect(progressRing.isFull()).toBe(false);
      expect(progressRing.getLightStates()).toEqual(new Array(18).fill(false));
    });

    it('increments lit lights and returns boolean array of states', () => {
      progressRing.addLights(6);
      expect(progressRing.getLitCount()).toBe(6);
      expect(progressRing.isFull()).toBe(false);

      const states = progressRing.getLightStates();
      expect(states.slice(0, 6)).toEqual(new Array(6).fill(true));
      expect(states.slice(6)).toEqual(new Array(12).fill(false));
    });

    it('detects when 18 lights threshold is reached and signals promotion', () => {
      const res1 = progressRing.addLights(10);
      expect(res1.thresholdReached).toBe(false);
      expect(progressRing.getLitCount()).toBe(10);

      // Add 8 more to reach 18 -> threshold reached, resets ring, overflow = 0
      const res2 = progressRing.addLights(8);
      expect(res2.thresholdReached).toBe(true);
      expect(res2.overflow).toBe(0);
      expect(progressRing.getLitCount()).toBe(0);
    });

    it('handles light overflow beyond 18 correctly', () => {
      progressRing.addLights(12);
      // Add 10 -> total 22 -> 18 consumed for promotion, 4 overflow remainder
      const res = progressRing.addLights(10);
      expect(res.thresholdReached).toBe(true);
      expect(res.overflow).toBe(4);
      expect(progressRing.getLitCount()).toBe(4);
    });

    it('resets ring cleanly', () => {
      progressRing.addLights(15);
      progressRing.reset();
      expect(progressRing.getLitCount()).toBe(0);
      expect(progressRing.getLightStates().every((s) => !s)).toBe(true);
    });
  });

  // ==========================================================================
  // [P3.4] All 17 Table Missions
  // ==========================================================================
  describe('All 17 Table Missions (P3.4)', () => {
    it('defines exactly 17 missions matching game design specification', () => {
      expect(ALL_MISSIONS).toHaveLength(17);

      // Check numbers 1 through 17 are unique and sequential
      const numbers = ALL_MISSIONS.map((m) => m.number);
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it('Tier 1 (Rookie Defender): 4 missions with exact objectives and rewards', () => {
      const tier1 = getMissionsForTier(1);
      expect(tier1).toHaveLength(4);

      // Mission 1: Cannon Calibration (3 ramp shots) -> 500K pts + 6 lights
      const m1 = getMissionByNumber(1)!;
      expect(m1.title).toBe('Cannon Calibration');
      expect(m1.spaceCadetName).toBe('Launch Training');
      expect(m1.pointsReward).toBe(500000);
      expect(m1.progressLightsReward).toBe(6);
      expect(m1.targetCount).toBe(3);

      // Mission 2: Atmospheric Scan (3 re-entry lanes) -> 500K pts + 6 lights
      const m2 = getMissionByNumber(2)!;
      expect(m2.title).toBe('Atmospheric Scan');
      expect(m2.spaceCadetName).toBe('Re-entry Training');
      expect(m2.pointsReward).toBe(500000);
      expect(m2.progressLightsReward).toBe(6);
      expect(m2.targetCount).toBe(3);

      // Mission 3: Alien Target Drill (8 bumper hits) -> 500K pts + 6 lights
      const m3 = getMissionByNumber(3)!;
      expect(m3.title).toBe('Alien Target Drill');
      expect(m3.spaceCadetName).toBe('Target Practice');
      expect(m3.pointsReward).toBe(500000);
      expect(m3.progressLightsReward).toBe(6);
      expect(m3.targetCount).toBe(8);

      // Mission 4: Invasion Recon (9 drop targets) -> 750K pts + 9 lights
      const m4 = getMissionByNumber(4)!;
      expect(m4.title).toBe('Invasion Recon');
      expect(m4.spaceCadetName).toBe('Science Mission');
      expect(m4.pointsReward).toBe(750000);
      expect(m4.progressLightsReward).toBe(9);
      expect(m4.targetCount).toBe(9);
    });

    it('Tier 2 (Grid Gunner & Crab Hunter): 4 missions with exact objectives and rewards', () => {
      const tier2 = getMissionsForTier(2);
      expect(tier2).toHaveLength(4);

      // Mission 5: Swarm Extermination (15 targets) -> 750K pts + 7 lights
      const m5 = getMissionByNumber(5)!;
      expect(m5.title).toBe('Swarm Extermination');
      expect(m5.pointsReward).toBe(750000);
      expect(m5.progressLightsReward).toBe(7);
      expect(m5.targetCount).toBe(15);

      // Mission 6: Civilian Evac (booster targets + UFO beam) -> 750K pts + 7 lights
      const m6 = getMissionByNumber(6)!;
      expect(m6.title).toBe('Civilian Evac');
      expect(m6.pointsReward).toBe(750000);
      expect(m6.progressLightsReward).toBe(7);

      // Mission 7: Crab Wave Assault (bumper upgrade + hits) -> 750K pts + 7 lights
      const m7 = getMissionByNumber(7)!;
      expect(m7.title).toBe('Crab Wave Assault');
      expect(m7.pointsReward).toBe(750000);
      expect(m7.progressLightsReward).toBe(7);

      // Mission 8: Classified Op (Yellow -> Red -> Green sequence) -> 1.5M pts + 10 lights
      const m8 = getMissionByNumber(8)!;
      expect(m8.title).toBe('Classified Op');
      expect(m8.pointsReward).toBe(1500000);
      expect(m8.progressLightsReward).toBe(10);
    });

    it('Tier 3 (Wave Captain & Octopus Slayer): 4 missions with exact objectives and rewards', () => {
      const tier3 = getMissionsForTier(3);
      expect(tier3).toHaveLength(4);

      // Mission 9: Rogue Asteroid -> 1M pts + 7 lights
      const m9 = getMissionByNumber(9)!;
      expect(m9.title).toBe('Rogue Asteroid');
      expect(m9.pointsReward).toBe(1000000);
      expect(m9.progressLightsReward).toBe(7);

      // Mission 10: Ion Storm -> 1M pts + 7 lights
      const m10 = getMissionByNumber(10)!;
      expect(m10.title).toBe('Ion Storm');
      expect(m10.pointsReward).toBe(1000000);
      expect(m10.progressLightsReward).toBe(7);

      // Mission 11: Gravity Anomaly -> 1M pts + 7 lights
      const m11 = getMissionByNumber(11)!;
      expect(m11.title).toBe('Gravity Anomaly');
      expect(m11.pointsReward).toBe(1000000);
      expect(m11.progressLightsReward).toBe(7);

      // Mission 12: Signal Jam (75 spins + space warp) -> 1.75M pts + 9 lights
      const m12 = getMissionByNumber(12)!;
      expect(m12.title).toBe('Signal Jam');
      expect(m12.pointsReward).toBe(1750000);
      expect(m12.progressLightsReward).toBe(9);
      expect(m12.targetCount).toBe(75);
    });

    it('Tier 4 (Fleet Commander & UFO Tracker): 4 missions with exact objectives and rewards', () => {
      const tier4 = getMissionsForTier(4);
      expect(tier4).toHaveLength(4);

      // Mission 13: Probe Recovery (top bumper hits) -> 1.25M pts + 7 lights
      const m13 = getMissionByNumber(13)!;
      expect(m13.title).toBe('Probe Recovery');
      expect(m13.pointsReward).toBe(1250000);
      expect(m13.progressLightsReward).toBe(7);
      expect(m13.targetCount).toBe(3);

      // Mission 14: Deep Space Patrol (15 rollover passes) -> 1.25M pts + 7 lights
      const m14 = getMissionByNumber(14)!;
      expect(m14.title).toBe('Deep Space Patrol');
      expect(m14.pointsReward).toBe(1250000);
      expect(m14.progressLightsReward).toBe(7);
      expect(m14.targetCount).toBe(15);

      // Mission 15: Doomsday Cannon (3 outlane passes) -> 1.25M pts + 7 lights
      const m15 = getMissionByNumber(15)!;
      expect(m15.title).toBe('Doomsday Cannon');
      expect(m15.pointsReward).toBe(1250000);
      expect(m15.progressLightsReward).toBe(7);
      expect(m15.targetCount).toBe(3);

      // Mission 16: Chrono Rift (25 slingshot hits + launch tube/UFO) -> 2M pts + 10 lights
      const m16 = getMissionByNumber(16)!;
      expect(m16.title).toBe('Chrono Rift');
      expect(m16.pointsReward).toBe(2000000);
      expect(m16.progressLightsReward).toBe(10);
      expect(m16.targetCount).toBe(25);
    });

    it('Tier 5 (Mothership Hunter & Galactic Admiral): Grand Finale Mission 17', () => {
      const tier5 = getMissionsForTier(5);
      expect(tier5).toHaveLength(1);

      // Mission 17: Final Invasion (Maelstrom) -> 5M pts + 18 lights
      const m17 = getMissionByNumber(17)!;
      expect(m17.title).toBe('Final Invasion');
      expect(m17.spaceCadetName).toBe('Maelstrom');
      expect(m17.pointsReward).toBe(5000000);
      expect(m17.progressLightsReward).toBe(18);
    });
  });

  // ==========================================================================
  // [P3.5] Energy Core & Fuel Timer
  // ==========================================================================
  describe('Energy Core & Fuel Timer (P3.5)', () => {
    let energyCore: EnergyCore;

    beforeEach(() => {
      energyCore = new EnergyCore({ maxFuel: 60.0 });
    });

    it('initializes at max fuel and inactive', () => {
      expect(energyCore.getFuel()).toBe(60.0);
      expect(energyCore.getFuelPercentage()).toBe(1.0);
      expect(energyCore.isActive).toBe(false);
    });

    it('starts countdown when activated and decrements over time', () => {
      energyCore.start();
      expect(energyCore.isActive).toBe(true);

      energyCore.update(10.0);
      expect(energyCore.getFuel()).toBeCloseTo(50.0, 1);
      expect(energyCore.getFuelPercentage()).toBeCloseTo(50 / 60, 2);
    });

    it('detects low fuel state when fuel falls below 25%', () => {
      energyCore.start();
      energyCore.update(46.0); // 14s remaining out of 60s (~23%)
      expect(energyCore.isLowFuel()).toBe(true);
    });

    it('refuels upon calling refuel()', () => {
      energyCore.start();
      energyCore.update(30.0); // 30s remaining
      energyCore.refuel(15.0);
      expect(energyCore.getFuel()).toBeCloseTo(45.0, 1);

      // Does not exceed maxFuel
      energyCore.refuel(30.0);
      expect(energyCore.getFuel()).toBe(60.0);
    });

    it('signals expiration when fuel reaches 0', () => {
      energyCore.start();
      const res = energyCore.update(65.0);
      expect(res.isExpired).toBe(true);
      expect(energyCore.getFuel()).toBe(0);
      expect(energyCore.isActive).toBe(false);
    });
  });

  // ==========================================================================
  // [P3.7] LCD Ticker Message Generator
  // ==========================================================================
  describe('LCD Ticker Message Generator (P3.7)', () => {
    let ticker: LCDTicker;

    beforeEach(() => {
      ticker = new LCDTicker();
    });

    it('generates properly formatted messages for all game states', () => {
      const mission = getMissionByNumber(1)!;
      const rank = RANKS[1]; // Grid Gunner

      // Request
      const reqMsg = ticker.formatMissionRequest(mission);
      expect(reqMsg).toContain('CANNON CALIBRATION');
      expect(reqMsg).toContain('LAUNCH RAMP');

      // Accept
      const accMsg = ticker.formatMissionAccept(mission);
      expect(accMsg).toContain('MISSION ACCEPTED');

      // Objective Progress
      const objMsg = ticker.formatMissionObjective(mission, 2, 3);
      expect(objMsg).toContain('2/3');

      // Complete
      const compMsg = ticker.formatMissionComplete(mission);
      expect(compMsg).toContain('MISSION ACCOMPLISHED');
      expect(compMsg).toContain('500,000');

      // Fail
      const failMsg = ticker.formatMissionFail('TIME EXPIRED');
      expect(failMsg).toContain('MISSION FAILED');
      expect(failMsg).toContain('TIME EXPIRED');

      // Promotion
      const promMsg = ticker.formatRankPromotion(rank, 250000);
      expect(promMsg).toContain('PROMOTED');
      expect(promMsg).toContain('GRID GUNNER');
    });

    it('queues messages and updates current active message', () => {
      ticker.setMessage('INITIAL MESSAGE');
      expect(ticker.getCurrentMessage()).toBe('INITIAL MESSAGE');

      ticker.queueMessage('URGENT ALERT', true);
      expect(ticker.getCurrentMessage()).toBe('URGENT ALERT');
    });
  });

  // ==========================================================================
  // [P3.3, P3.5, P3.6, P3.7] MissionControl Orchestrator & Lifecycle
  // ==========================================================================
  describe('MissionControl Orchestration & Full Lifecycle (P3.3 - P3.7)', () => {
    let missionControl: MissionControl;
    let scoreManager: ScoreManager;
    let gameState: GameStateManager;

    beforeEach(() => {
      scoreManager = new ScoreManager();
      gameState = new GameStateManager();
      missionControl = new MissionControl({
        scoreManager,
        gameState,
        fuelDuration: 60.0,
      });
    });

    it('initializes in IDLE state with Rank 1 and 0 progress lights', () => {
      expect(missionControl.getState()).toBe('IDLE');
      expect(missionControl.getCurrentMission()).toBeNull();
      expect(missionControl.rankManager.getRankNumber()).toBe(1);
      expect(missionControl.progressRing.getLitCount()).toBe(0);
    });

    it('requests mission via spot targets -> moves to REQUESTED state with LCD update', () => {
      const requestListener = vi.fn();
      missionControl.onMissionRequested = requestListener;

      const mission = missionControl.requestMission(1); // Cannon Calibration
      expect(missionControl.getState()).toBe('REQUESTED');
      expect(missionControl.getCurrentMission()?.id).toBe('cannon-calibration');
      expect(requestListener).toHaveBeenCalledWith(mission);
      expect(missionControl.ticker.getCurrentMessage()).toContain('CANNON CALIBRATION');
    });

    it('accepts requested mission via Cannon Launch Ramp -> moves to ACTIVE state and starts fuel timer', () => {
      const acceptListener = vi.fn();
      missionControl.onMissionAccepted = acceptListener;

      missionControl.requestMission(1);
      const accepted = missionControl.acceptMission();

      expect(accepted).toBe(true);
      expect(missionControl.getState()).toBe('ACTIVE');
      expect(missionControl.energyCore.isActive).toBe(true);
      expect(missionControl.energyCore.getFuel()).toBe(60.0);
      expect(acceptListener).toHaveBeenCalled();
      expect(missionControl.ticker.getCurrentMessage()).toContain('MISSION ACCEPTED');
    });

    it('ignores mission acceptance if no mission was requested', () => {
      const accepted = missionControl.acceptMission();
      expect(accepted).toBe(false);
      expect(missionControl.getState()).toBe('IDLE');
    });

    it('tracks single-phase objective progress (Cannon Calibration: 3 ramp shots) to completion', () => {
      const progressListener = vi.fn();
      const completeListener = vi.fn();
      missionControl.onObjectiveProgress = progressListener;
      missionControl.onMissionCompleted = completeListener;

      // Start Mission 1: Cannon Calibration (3 ramp shots)
      missionControl.requestMission(1);
      missionControl.acceptMission();

      // Shot 1
      missionControl.handleHit('ramp');
      expect(missionControl.getObjectiveProgress().currentCount).toBe(1);
      expect(progressListener).toHaveBeenCalledWith(missionControl.getCurrentMission()!, 1, 3);
      expect(missionControl.getState()).toBe('ACTIVE');

      // Shot 2
      missionControl.handleHit('ramp');
      expect(missionControl.getObjectiveProgress().currentCount).toBe(2);
      expect(missionControl.getState()).toBe('ACTIVE');

      // Shot 3 -> Complete!
      missionControl.handleHit('ramp');
      expect(missionControl.getState()).toBe('IDLE');
      expect(completeListener).toHaveBeenCalledWith(expect.anything(), 500000, 6);

      // Score awarded
      expect(scoreManager.getScore()).toBe(500000);
      // 6 progress lights awarded
      expect(missionControl.progressRing.getLitCount()).toBe(6);
      // Fuel timer stopped
      expect(missionControl.energyCore.isActive).toBe(false);
    });

    it('tracks bumper mission (Alien Target Drill: 8 bumper hits)', () => {
      missionControl.requestMission(3); // Alien Target Drill
      missionControl.acceptMission();

      for (let i = 1; i <= 7; i++) {
        missionControl.handleHit('bumper');
        expect(missionControl.getState()).toBe('ACTIVE');
      }

      missionControl.handleHit('bumper'); // 8th hit
      expect(missionControl.getState()).toBe('IDLE');
      expect(scoreManager.getScore()).toBe(500000);
      expect(missionControl.progressRing.getLitCount()).toBe(6);
    });

    it('tracks sequence mission (Classified Op: Yellow -> Red -> Green UFO sequence)', () => {
      missionControl.requestMission(8); // Classified Op
      missionControl.acceptMission();

      // Wrong sequence (Green first) -> resets or ignores sequence progress
      missionControl.handleHit('ufo_beam', { color: 'green' });
      expect(missionControl.getObjectiveProgress().currentPhase).toBe(0);

      // Correct Step 1: Yellow
      missionControl.handleHit('ufo_beam', { color: 'yellow' });
      expect(missionControl.getObjectiveProgress().currentPhase).toBe(1);

      // Correct Step 2: Red
      missionControl.handleHit('ufo_beam', { color: 'red' });
      expect(missionControl.getObjectiveProgress().currentPhase).toBe(2);

      // Correct Step 3: Green -> Complete!
      missionControl.handleHit('ufo_beam', { color: 'green' });
      expect(missionControl.getState()).toBe('IDLE');
      expect(scoreManager.getScore()).toBe(1500000);
      expect(missionControl.progressRing.getLitCount()).toBe(10);
    });

    it('fails active mission when fuel timer expires', () => {
      const failListener = vi.fn();
      missionControl.onMissionFailed = failListener;

      missionControl.requestMission(1);
      missionControl.acceptMission();
      expect(missionControl.getState()).toBe('ACTIVE');

      // Fast-forward 65 seconds
      missionControl.update(65.0);

      expect(missionControl.getState()).toBe('IDLE');
      expect(missionControl.getCurrentMission()).toBeNull();
      expect(failListener).toHaveBeenCalledWith(expect.anything(), 'TIME EXPIRED');
      expect(missionControl.ticker.getCurrentMessage()).toContain('MISSION FAILED');
    });

    it('fails active mission when ball drains without being saved', () => {
      const failListener = vi.fn();
      missionControl.onMissionFailed = failListener;

      missionControl.requestMission(1);
      missionControl.acceptMission();

      missionControl.handleBallDrain();

      expect(missionControl.getState()).toBe('IDLE');
      expect(failListener).toHaveBeenCalledWith(expect.anything(), 'BALL DRAIN');
    });

    it('promotes rank and triggers promotion bonus when 18 progress lights accumulated', () => {
      const promotionListener = vi.fn();
      missionControl.onPromotion = promotionListener;

      // Mission 1 awards 6 lights
      missionControl.requestMission(1);
      missionControl.acceptMission();
      missionControl.handleHit('ramp');
      missionControl.handleHit('ramp');
      missionControl.handleHit('ramp');
      expect(missionControl.progressRing.getLitCount()).toBe(6);
      expect(missionControl.rankManager.getRankNumber()).toBe(1);

      // Mission 2 awards 6 lights -> total 12
      missionControl.requestMission(2);
      missionControl.acceptMission();
      missionControl.handleHit('lane');
      missionControl.handleHit('lane');
      missionControl.handleHit('lane');
      expect(missionControl.progressRing.getLitCount()).toBe(12);
      expect(missionControl.rankManager.getRankNumber()).toBe(1);

      // Mission 4 (Invasion Recon) awards 9 lights -> 12 + 9 = 21 -> 18 lights reached!
      // Promotes to Rank 2 (Grid Gunner), ring resets with 3 overflow lights
      missionControl.requestMission(4);
      missionControl.acceptMission();
      for (let i = 0; i < 9; i++) {
        missionControl.handleHit('drop_target');
      }

      expect(missionControl.rankManager.getRankNumber()).toBe(2);
      expect(missionControl.rankManager.getRank().title).toBe('Grid Gunner');
      expect(missionControl.progressRing.getLitCount()).toBe(3);
      expect(promotionListener).toHaveBeenCalledWith(expect.anything(), expect.any(Number));
    });

    it('rotates to appropriate mission tier based on current rank', () => {
      // At Rank 1 -> Tier 1 missions (1-4)
      const mTier1 = missionControl.selectNextMission();
      expect(mTier1.tier).toBe(1);

      // Promote to Rank 2 (Grid Gunner) -> Tier 2 missions (5-8)
      missionControl.rankManager.setRank(2);
      const mTier2 = missionControl.selectNextMission();
      expect(mTier2.tier).toBe(2);

      // Promote to Rank 4 (Wave Captain) -> Tier 3 missions (9-12)
      missionControl.rankManager.setRank(4);
      const mTier3 = missionControl.selectNextMission();
      expect(mTier3.tier).toBe(3);

      // Promote to Rank 6 (Fleet Commander) -> Tier 4 missions (13-16)
      missionControl.rankManager.setRank(6);
      const mTier4 = missionControl.selectNextMission();
      expect(mTier4.tier).toBe(4);

      // Promote to Rank 8 (Mothership Hunter) -> Tier 5 mission 17 (Final Invasion)
      missionControl.rankManager.setRank(8);
      const mTier5 = missionControl.selectNextMission();
      expect(mTier5.tier).toBe(5);
      expect(mTier5.number).toBe(17);
    });

    it('handles grand finale completion (Mission 17: Final Invasion) with full promotion and massive score', () => {
      missionControl.rankManager.setRank(8);
      missionControl.requestMission(17);
      missionControl.acceptMission();

      // Complete all 8 phases of Final Invasion
      // Phase 1: 3 drop targets
      for (let i = 0; i < 3; i++) missionControl.handleHit('drop_target');
      // Phase 2: 3 spot targets
      for (let i = 0; i < 3; i++) missionControl.handleHit('spot_target');
      // Phase 3: 5 rollover lanes
      for (let i = 0; i < 5; i++) missionControl.handleHit('lane');
      // Phase 4: Energy core / re-entry
      missionControl.handleHit('energy_core');
      // Phase 5: Cannon ramp
      missionControl.handleHit('ramp');
      // Phase 6: Spinner
      missionControl.handleHit('spinner');
      // Phase 7: UFO Beam
      missionControl.handleHit('ufo_beam');
      // Phase 8: Mothership Tractor Beam
      missionControl.handleHit('tractor_beam');

      expect(missionControl.getState()).toBe('IDLE');
      // 5,000,000 pts awarded
      expect(scoreManager.getScore()).toBeGreaterThanOrEqual(5000000);
      // Promoted to Rank 9 (Galactic Admiral)
      expect(missionControl.rankManager.getRankNumber()).toBe(9);
      expect(missionControl.rankManager.getRank().title).toBe('Galactic Admiral');
    });
  });
});
