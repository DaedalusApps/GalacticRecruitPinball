/**
 * Galactic Recruit Pinball - Mission Control & Progression Orchestrator (P3.1 - P3.7)
 *
 * Orchestrates mission selection, request, acceptance, objective monitoring, fuel timer (Energy Core),
 * 18 progress lights ring tracking, rank promotion cascades, and LCD ticker message generation.
 */

import { RankManager, RankDefinition } from './ranks';
import {
  MissionDefinition,
  MissionEventType,
  ALL_MISSIONS,
  getMissionsForTier,
  getMissionById,
  getMissionByNumber,
} from './missions';
import { ScoreManager } from './scoring';
import { GameStateManager } from './state';
import { GAME_RULES } from '../utils/constants';

export type MissionState = 'IDLE' | 'REQUESTED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface ProgressRingAddResult {
  thresholdReached: boolean;
  overflow: number;
}

/**
 * Tracks the 18 Progress Lights Ring surrounding the table center rank badge.
 */
export class ProgressRing {
  public maxLights: number = GAME_RULES.TOTAL_PROGRESS_LIGHTS; // 18
  private litCount: number = 0;

  constructor(initialLit: number = 0) {
    this.setLitCount(initialLit);
  }

  public getLitCount(): number {
    return this.litCount;
  }

  public setLitCount(count: number): void {
    this.litCount = Math.max(0, Math.min(count, this.maxLights));
  }

  public isFull(): boolean {
    return this.litCount >= this.maxLights;
  }

  public getLightStates(): boolean[] {
    const states = new Array(this.maxLights).fill(false);
    for (let i = 0; i < this.litCount; i++) {
      states[i] = true;
    }
    return states;
  }

  /**
   * Adds lights to the ring.
   * If threshold of 18 is reached, resets ring to overflow remainder and reports thresholdReached = true.
   */
  public addLights(count: number): ProgressRingAddResult {
    const total = this.litCount + count;
    if (total >= this.maxLights) {
      const overflow = total - this.maxLights;
      this.litCount = overflow;
      return {
        thresholdReached: true,
        overflow,
      };
    } else {
      this.litCount = total;
      return {
        thresholdReached: false,
        overflow: 0,
      };
    }
  }

  public reset(): void {
    this.litCount = 0;
  }
}

/**
 * Energy Core Mission Fuel Timer (P3.5)
 */
export interface EnergyCoreOptions {
  maxFuel?: number;
  fuelRate?: number;
  lowFuelThreshold?: number; // percentage (default 0.25)
}

export class EnergyCore {
  public maxFuel: number;
  public currentFuel: number;
  public fuelRate: number; // units/sec
  public lowFuelThreshold: number;
  public isActive: boolean = false;

  constructor(options: EnergyCoreOptions = {}) {
    this.maxFuel = options.maxFuel ?? 60.0;
    this.currentFuel = this.maxFuel;
    this.fuelRate = options.fuelRate ?? 1.0;
    this.lowFuelThreshold = options.lowFuelThreshold ?? 0.25;
  }

  public start(): void {
    this.currentFuel = this.maxFuel;
    this.isActive = true;
  }

  public stop(): void {
    this.isActive = false;
  }

  public getFuel(): number {
    return this.currentFuel;
  }

  public setFuel(amount: number): void {
    this.currentFuel = Math.max(0, Math.min(amount, this.maxFuel));
  }

  public getFuelPercentage(): number {
    return this.maxFuel > 0 ? this.currentFuel / this.maxFuel : 0;
  }

  public isLowFuel(): boolean {
    return this.isActive && this.getFuelPercentage() <= this.lowFuelThreshold;
  }

  public refuel(amount: number = 15.0): void {
    this.currentFuel = Math.min(this.maxFuel, this.currentFuel + amount);
  }

  public update(deltaSec: number): { isExpired: boolean; isLowFuel: boolean } {
    if (!this.isActive) {
      return { isExpired: false, isLowFuel: false };
    }

    this.currentFuel = Math.max(0, this.currentFuel - this.fuelRate * deltaSec);

    if (this.currentFuel <= 0) {
      this.currentFuel = 0;
      this.isActive = false;
      return { isExpired: true, isLowFuel: false };
    }

    return {
      isExpired: false,
      isLowFuel: this.isLowFuel(),
    };
  }
}

/**
 * LCD Ticker Message Queue and Text Generator (P3.7)
 */
export interface TickerMessageItem {
  text: string;
  durationSec: number;
  priority: boolean;
}

export class LCDTicker {
  private currentMessage: string = 'GALACTIC RECRUIT DEFENDER READY';
  private messageQueue: TickerMessageItem[] = [];
  private messageTimer: number = 0;

  public getCurrentMessage(): string {
    return this.currentMessage;
  }

  public setMessage(text: string): void {
    this.currentMessage = text;
  }

  public queueMessage(text: string, priority: boolean = false, durationSec: number = 4.0): void {
    if (priority) {
      this.currentMessage = text;
      this.messageTimer = durationSec;
      this.messageQueue.unshift({ text, durationSec, priority });
    } else {
      this.messageQueue.push({ text, durationSec, priority });
      if (this.messageTimer <= 0) {
        this.advanceQueue();
      }
    }
  }

  private advanceQueue(): void {
    if (this.messageQueue.length > 0) {
      const next = this.messageQueue.shift()!;
      this.currentMessage = next.text;
      this.messageTimer = next.durationSec;
    }
  }

  public update(deltaSec: number): void {
    if (this.messageTimer > 0) {
      this.messageTimer -= deltaSec;
      if (this.messageTimer <= 0) {
        this.advanceQueue();
      }
    }
  }

  // Formatters
  public formatMissionRequest(mission: MissionDefinition): string {
    return `MISSION: ${mission.title.toUpperCase()} — SHOOT LAUNCH RAMP TO ACCEPT`;
  }

  public formatMissionAccept(mission: MissionDefinition): string {
    return `MISSION ACCEPTED: ${mission.title.toUpperCase()} — ${mission.instructions.toUpperCase()}`;
  }

  public formatMissionObjective(
    mission: MissionDefinition,
    current: number,
    total: number,
    extraText?: string
  ): string {
    const extra = extraText ? ` (${extraText.toUpperCase()})` : '';
    return `${mission.title.toUpperCase()}: ${current}/${total}${extra} COMPLETE`;
  }

  public formatMissionComplete(mission: MissionDefinition): string {
    return `MISSION ACCOMPLISHED! +${mission.pointsReward.toLocaleString('en-US')} PTS — +${mission.progressLightsReward} LIGHTS`;
  }

  public formatMissionFail(reason: string = 'TIME EXPIRED'): string {
    return `MISSION FAILED — ${reason.toUpperCase()}`;
  }

  public formatRankPromotion(rank: RankDefinition, bonus: number): string {
    return `PROMOTED TO ${rank.title.toUpperCase()}! PROMOTION BONUS: +${bonus.toLocaleString('en-US')} PTS`;
  }

  public formatLowFuel(): string {
    return 'WARNING: ENERGY CORE DEPLETING — REFUEL REQUIRED';
  }
}

/**
 * Main MissionControl State Machine (P3.3)
 */
export interface MissionControlOptions {
  scoreManager?: ScoreManager;
  gameState?: GameStateManager;
  fuelDuration?: number;
  initialRank?: number;
}

export interface ObjectiveProgress {
  currentCount: number;
  targetCount: number;
  currentPhase: number;
  totalPhases: number;
  phaseCount: number;
  phaseTarget: number;
}

export class MissionControl {
  public state: MissionState = 'IDLE';
  public rankManager: RankManager;
  public progressRing: ProgressRing;
  public energyCore: EnergyCore;
  public ticker: LCDTicker;
  public scoreManager?: ScoreManager;
  public gameState?: GameStateManager;

  private currentMission: MissionDefinition | null = null;
  private currentPhaseIndex: number = 0;
  private currentPhaseCount: number = 0;
  private currentCount: number = 0;
  private targetCount: number = 0;

  // Track mission tier rotation index
  private missionTierIndices: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  // Event Callbacks
  public onStateChange?: (state: MissionState, mission: MissionDefinition | null) => void;
  public onMissionRequested?: (mission: MissionDefinition) => void;
  public onMissionAccepted?: (mission: MissionDefinition) => void;
  public onObjectiveProgress?: (mission: MissionDefinition, current: number, target: number) => void;
  public onMissionCompleted?: (mission: MissionDefinition, scoreAwarded: number, lightsAwarded: number) => void;
  public onMissionFailed?: (mission: MissionDefinition | null, reason: string) => void;
  public onPromotion?: (newRank: RankDefinition, bonusPoints: number) => void;
  public onProgressLightsChanged?: (litCount: number, states: boolean[]) => void;
  public onFuelChanged?: (fuel: number, percentage: number, isLow: boolean) => void;
  public onTickerMessage?: (message: string) => void;

  constructor(options: MissionControlOptions = {}) {
    this.scoreManager = options.scoreManager;
    this.gameState = options.gameState;
    this.rankManager = new RankManager(options.initialRank ?? 1);
    this.progressRing = new ProgressRing(0);
    this.energyCore = new EnergyCore({ maxFuel: options.fuelDuration ?? 60.0 });
    this.ticker = new LCDTicker();

    this.rankManager.onPromotion = (newRank, bonusPoints) => {
      if (this.scoreManager) {
        this.scoreManager.addPoints(bonusPoints, false);
      }
      this.ticker.queueMessage(this.ticker.formatRankPromotion(newRank, bonusPoints), true, 5.0);
      if (this.onPromotion) {
        this.onPromotion(newRank, bonusPoints);
      }
    };
  }

  public getState(): MissionState {
    return this.state;
  }

  public getCurrentMission(): MissionDefinition | null {
    return this.currentMission;
  }

  public getObjectiveProgress(): ObjectiveProgress {
    const totalPhases = this.currentMission?.phases?.length ?? 1;
    const phaseTarget = this.currentMission?.phases
      ? this.currentMission.phases[this.currentPhaseIndex]?.targetCount ?? 1
      : this.targetCount;

    return {
      currentCount: this.currentCount,
      targetCount: this.targetCount,
      currentPhase: this.currentPhaseIndex,
      totalPhases,
      phaseCount: this.currentPhaseCount,
      phaseTarget,
    };
  }

  /**
   * Selects the next mission appropriate for current player rank tier.
   */
  public selectNextMission(): MissionDefinition {
    const tier = this.rankManager.getMissionTier() as 1 | 2 | 3 | 4 | 5;
    const available = getMissionsForTier(tier);
    if (available.length === 0) {
      return ALL_MISSIONS[0];
    }
    const idx = this.missionTierIndices[tier] % available.length;
    return available[idx];
  }

  /**
   * Requests a mission (triggered by Mission Spot Targets hit).
   * Moves state machine to REQUESTED.
   */
  public requestMission(missionNumberOrId?: number | string): MissionDefinition {
    let mission: MissionDefinition | undefined;

    if (typeof missionNumberOrId === 'number') {
      mission = getMissionByNumber(missionNumberOrId);
    } else if (typeof missionNumberOrId === 'string') {
      mission = getMissionById(missionNumberOrId);
    }

    if (!mission) {
      mission = this.selectNextMission();
      const tier = this.rankManager.getMissionTier() as 1 | 2 | 3 | 4 | 5;
      this.missionTierIndices[tier]++;
    }

    this.currentMission = mission;
    this.state = 'REQUESTED';
    this.currentCount = 0;
    this.currentPhaseIndex = 0;
    this.currentPhaseCount = 0;
    this.targetCount = mission.targetCount;

    const reqMsg = this.ticker.formatMissionRequest(mission);
    this.ticker.queueMessage(reqMsg, true, 4.0);

    if (this.onMissionRequested) {
      this.onMissionRequested(mission);
    }
    if (this.onStateChange) {
      this.onStateChange(this.state, this.currentMission);
    }
    if (this.onTickerMessage) {
      this.onTickerMessage(this.ticker.getCurrentMessage());
    }

    return mission;
  }

  /**
   * Accepts the currently requested mission (triggered by Cannon Launch Ramp shot).
   * Moves state machine to ACTIVE and starts Energy Core fuel timer.
   */
  public acceptMission(): boolean {
    if (this.state !== 'REQUESTED' || !this.currentMission) {
      return false;
    }

    this.state = 'ACTIVE';
    this.energyCore.start();

    const accMsg = this.ticker.formatMissionAccept(this.currentMission);
    this.ticker.queueMessage(accMsg, true, 4.0);

    if (this.onMissionAccepted) {
      this.onMissionAccepted(this.currentMission);
    }
    if (this.onStateChange) {
      this.onStateChange(this.state, this.currentMission);
    }
    if (this.onTickerMessage) {
      this.onTickerMessage(this.ticker.getCurrentMessage());
    }
    if (this.onFuelChanged) {
      this.onFuelChanged(
        this.energyCore.getFuel(),
        this.energyCore.getFuelPercentage(),
        this.energyCore.isLowFuel()
      );
    }

    return true;
  }

  /**
   * Refuels the Energy Core by a specified amount (e.g. from lane / booster / energy chute hit).
   */
  public refuel(amount: number = 15.0): void {
    if (this.state === 'ACTIVE') {
      this.energyCore.refuel(amount);
      if (this.onFuelChanged) {
        this.onFuelChanged(
          this.energyCore.getFuel(),
          this.energyCore.getFuelPercentage(),
          this.energyCore.isLowFuel()
        );
      }
    }
  }

  /**
   * Handles table element hit event and tests objective completion.
   */
  public handleHit(eventType: MissionEventType, payload?: Record<string, unknown>): boolean {
    if (this.state !== 'ACTIVE' || !this.currentMission) {
      return false;
    }

    const mission = this.currentMission;

    // Check Multi-phase missions
    if (mission.phases && mission.phases.length > 0) {
      const phase = mission.phases[this.currentPhaseIndex];
      if (!phase) return false;

      // Check event match
      let isMatch = false;

      if (phase.eventType === eventType) {
        isMatch = true;
      } else if (
        phase.eventType === 'spot_target' &&
        (eventType === 'spot_target' ||
          eventType === 'medal_target' ||
          eventType === 'hazard_left' ||
          eventType === 'hazard_right')
      ) {
        isMatch = true;
      } else if (
        phase.eventType === 'lane' &&
        (eventType === 'lane' || eventType === 'space_warp')
      ) {
        isMatch = true;
      } else if (
        phase.eventType === 'energy_core' &&
        (eventType === 'energy_core' || eventType === 'lane')
      ) {
        isMatch = true;
      }

      // Check expected parameter (e.g. UFO sequence color)
      if (isMatch && phase.expectedParam) {
        const paramKey = phase.expectedParam.key;
        const expectedVal = phase.expectedParam.value;
        if (payload?.[paramKey] !== expectedVal) {
          isMatch = false;
        }
      }

      if (isMatch) {
        const increment =
          eventType === 'spinner' && typeof payload?.spins === 'number'
            ? payload.spins
            : 1;

        this.currentPhaseCount += increment;
        this.currentCount += increment;

        if (this.currentPhaseCount >= phase.targetCount) {
          // Advance phase
          this.currentPhaseIndex++;
          this.currentPhaseCount = 0;

          if (this.currentPhaseIndex >= mission.phases.length) {
            // All phases complete!
            this.completeMission();
            return true;
          } else {
            const nextPhase = mission.phases[this.currentPhaseIndex];
            const msg = `${mission.title.toUpperCase()}: ${nextPhase.description.toUpperCase()}`;
            this.ticker.queueMessage(msg, true, 3.0);
            if (this.onObjectiveProgress) {
              this.onObjectiveProgress(mission, this.currentPhaseIndex, mission.phases.length);
            }
          }
        } else {
          const msg = this.ticker.formatMissionObjective(
            mission,
            this.currentPhaseCount,
            phase.targetCount,
            phase.description
          );
          this.ticker.setMessage(msg);
          if (this.onObjectiveProgress) {
            this.onObjectiveProgress(mission, this.currentPhaseCount, phase.targetCount);
          }
        }
        return true;
      }
      return false;
    }

    // Single-phase mission objective checking
    let isHitMatch = false;

    if (mission.primaryEventType === eventType) {
      isHitMatch = true;
    } else if (
      mission.id === 'swarm-extermination' &&
      (eventType === 'drop_target' ||
        eventType === 'spot_target' ||
        eventType === 'medal_target' ||
        eventType === 'hazard_left' ||
        eventType === 'hazard_right')
    ) {
      isHitMatch = true;
    } else if (
      mission.id === 'probe-recovery' &&
      (eventType === 'top_bumper' || eventType === 'bumper')
    ) {
      isHitMatch = true;
    } else if (
      mission.id === 'deep-space-patrol' &&
      (eventType === 'lane' || eventType === 'space_warp' || eventType === 'skill_shot')
    ) {
      isHitMatch = true;
    } else if (
      mission.id === 'doomsday-cannon' &&
      (eventType === 'outlane' || eventType === 'kickback')
    ) {
      isHitMatch = true;
    } else if (
      mission.id === 'alien-target-drill' &&
      (eventType === 'bumper' || eventType === 'top_bumper')
    ) {
      isHitMatch = true;
    }

    if (isHitMatch) {
      const increment =
        eventType === 'spinner' && typeof payload?.spins === 'number'
          ? payload.spins
          : 1;

      this.currentCount += increment;

      if (this.currentCount >= this.targetCount) {
        this.completeMission();
      } else {
        const msg = this.ticker.formatMissionObjective(
          mission,
          this.currentCount,
          this.targetCount
        );
        this.ticker.setMessage(msg);
        if (this.onObjectiveProgress) {
          this.onObjectiveProgress(mission, this.currentCount, this.targetCount);
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Completes the current mission, awards points and progress lights, and checks for promotion.
   */
  public completeMission(): void {
    if (!this.currentMission) return;

    const mission = this.currentMission;
    this.state = 'COMPLETED';
    this.energyCore.stop();

    // 1. Award Points to ScoreManager
    if (this.scoreManager) {
      this.scoreManager.addPoints(mission.pointsReward, true);
    }

    // 2. Award Progress Lights to Progress Ring
    const lightsRes = this.progressRing.addLights(mission.progressLightsReward);

    // 3. LCD Ticker Update
    const compMsg = this.ticker.formatMissionComplete(mission);
    this.ticker.queueMessage(compMsg, true, 4.0);

    if (this.onMissionCompleted) {
      this.onMissionCompleted(mission, mission.pointsReward, mission.progressLightsReward);
    }
    if (this.onProgressLightsChanged) {
      this.onProgressLightsChanged(
        this.progressRing.getLitCount(),
        this.progressRing.getLightStates()
      );
    }

    // 4. Check Promotion (18 lights threshold reached)
    if (lightsRes.thresholdReached) {
      this.rankManager.promote();
    }

    // Reset state back to IDLE
    this.state = 'IDLE';
    this.currentMission = null;
    this.currentCount = 0;
    this.currentPhaseIndex = 0;
    this.currentPhaseCount = 0;

    if (this.onStateChange) {
      this.onStateChange(this.state, null);
    }
  }

  /**
   * Fails active mission (fuel expiry or ball drain).
   */
  public failMission(reason: string = 'TIME EXPIRED'): void {
    if (this.state !== 'ACTIVE') return;

    const mission = this.currentMission;
    this.state = 'FAILED';
    this.energyCore.stop();

    const failMsg = this.ticker.formatMissionFail(reason);
    this.ticker.queueMessage(failMsg, true, 3.5);

    if (this.onMissionFailed) {
      this.onMissionFailed(mission, reason);
    }

    this.state = 'IDLE';
    this.currentMission = null;
    this.currentCount = 0;
    this.currentPhaseIndex = 0;
    this.currentPhaseCount = 0;

    if (this.onStateChange) {
      this.onStateChange(this.state, null);
    }
  }

  /**
   * Handles pinball drain event -> fails active mission.
   */
  public handleBallDrain(): void {
    if (this.state === 'ACTIVE') {
      this.failMission('BALL DRAIN');
    }
  }

  /**
   * Per-frame update step for Energy Core fuel timer and LCD ticker.
   */
  public update(deltaSec: number): void {
    this.ticker.update(deltaSec);

    if (this.state === 'ACTIVE') {
      const fuelUpdate = this.energyCore.update(deltaSec);

      if (this.onFuelChanged) {
        this.onFuelChanged(
          this.energyCore.getFuel(),
          this.energyCore.getFuelPercentage(),
          this.energyCore.isLowFuel()
        );
      }

      if (fuelUpdate.isExpired) {
        this.failMission('TIME EXPIRED');
      }
    }
  }

  /**
   * Resets mission control completely.
   */
  public reset(): void {
    this.state = 'IDLE';
    this.currentMission = null;
    this.currentCount = 0;
    this.currentPhaseIndex = 0;
    this.currentPhaseCount = 0;
    this.progressRing.reset();
    this.energyCore.stop();
    this.rankManager.reset();
    this.ticker.setMessage('GALACTIC RECRUIT DEFENDER READY');
  }
}
