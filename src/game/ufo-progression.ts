/**
 * Galactic Recruit Pinball - UFO Beam Progressive Rewards System (P2.5)
 *
 * Tracks consecutive UFO Beam (wormhole) hits toward Tractor Beam activation:
 * Stage 1 (1st hit): Awards 10,000 pts.
 * Stage 2 (2nd hit): Advances multiplier or awards progress lights.
 * Stage 3 (3rd hit): Deploys Barrier Drone (Center Post).
 * Stage 4 (4th hit): Awards Extra Ball to GameStateManager.
 * Stage 5 (5th hit): Activates Mothership Tractor Beam (Gravity Well) and resets stage tracker.
 */

import { ScoreManager } from './scoring';
import { GameStateManager } from './state';
import { CenterPost } from '../table/elements';
import { MothershipTractorBeam } from './tractor-beam';

export interface UfoProgressionSystemOptions {
  scoreManager?: ScoreManager;
  gameState?: GameStateManager;
  centerPost?: CenterPost;
  tractorBeam?: MothershipTractorBeam;
  initialStage?: number;
}

export class UfoProgressionSystem {
  public currentStage: number = 0;
  public maxStages: number = 5;

  public scoreManager?: ScoreManager;
  public gameState?: GameStateManager;
  public centerPost?: CenterPost;
  public tractorBeam?: MothershipTractorBeam;

  // Event Callbacks
  public onStageAward?: (stage: number, rewardDescription: string) => void;
  public onProgressionReset?: () => void;
  public onTractorBeamActivated?: () => void;

  constructor(options: UfoProgressionSystemOptions = {}) {
    this.scoreManager = options.scoreManager;
    this.gameState = options.gameState;
    this.centerPost = options.centerPost;
    this.tractorBeam = options.tractorBeam;
    this.currentStage = options.initialStage ?? 0;
  }

  /**
   * Returns the current progressive stage (0 = none, 1-5).
   */
  public getCurrentStage(): number {
    return this.currentStage;
  }

  /**
   * Directly sets the current stage.
   */
  public setStage(stage: number): void {
    this.currentStage = Math.max(0, Math.min(stage, this.maxStages));
  }

  /**
   * Resets stage progression tracker back to 0.
   */
  public reset(): void {
    this.currentStage = 0;
  }

  /**
   * Registers a UFO Beam entry, advances the stage tracker (1 -> 2 -> 3 -> 4 -> 5 -> reset),
   * applies the corresponding stage reward, and returns the awarded stage number.
   */
  public registerHit(): number {
    this.currentStage++;
    const awardedStage = this.currentStage;

    switch (awardedStage) {
      case 1: {
        // Stage 1: Award 10,000 points
        if (this.scoreManager) {
          this.scoreManager.addPoints(10000);
        }
        if (this.onStageAward) {
          this.onStageAward(1, '10,000 Points');
        }
        break;
      }

      case 2: {
        // Stage 2: Advance Field Multiplier / Progress Lights
        if (this.scoreManager) {
          this.scoreManager.advanceMultiplier();
        }
        if (this.onStageAward) {
          this.onStageAward(2, 'Multiplier Advanced');
        }
        break;
      }

      case 3: {
        // Stage 3: Deploy Barrier Drone (Center Post)
        if (this.centerPost) {
          this.centerPost.deploy();
        }
        if (this.onStageAward) {
          this.onStageAward(3, 'Barrier Drone Deployed');
        }
        break;
      }

      case 4: {
        // Stage 4: Award Extra Ball
        if (this.gameState) {
          this.gameState.awardExtraBall();
        }
        if (this.onStageAward) {
          this.onStageAward(4, 'Extra Ball Awarded');
        }
        break;
      }

      case 5: {
        // Stage 5: Activate Mothership Tractor Beam and reset progression
        if (this.tractorBeam) {
          this.tractorBeam.activate();
        }
        if (this.onStageAward) {
          this.onStageAward(5, 'Mothership Tractor Beam Activated');
        }
        if (this.onTractorBeamActivated) {
          this.onTractorBeamActivated();
        }

        // Reset progression tracker
        this.reset();
        if (this.onProgressionReset) {
          this.onProgressionReset();
        }
        break;
      }

      default: {
        // Wrap around if higher
        this.currentStage = 1;
        if (this.scoreManager) {
          this.scoreManager.addPoints(10000);
        }
        if (this.onStageAward) {
          this.onStageAward(1, '10,000 Points');
        }
        return 1;
      }
    }

    return awardedStage;
  }
}
