/**
 * Galactic Recruit Pinball - Game State Management System (P2.9, P2.10, P2.11)
 *
 * Manages ball lifecycle (3 balls default + extra balls), ball saver timer & triggers,
 * tilt accumulator / warning system / TILT state, and game over progression.
 */

import { Pinball } from '../physics/ball';
import { BALL, GAME_RULES } from '../utils/constants';

export interface GameStateManagerOptions {
  initialBalls?: number;
  ballSaverDuration?: number;
  maxTiltWarnings?: number;
}

export interface BallDrainResult {
  saved: boolean;
  gameOver: boolean;
  extraBallUsed?: boolean;
  nextBall?: boolean;
}

export class GameStateManager {
  public currentBall: number = 1;
  public maxBalls: number = GAME_RULES.INITIAL_BALLS;
  public extraBalls: number = 0;
  public isGameOver: boolean = false;

  // Ball Saver
  public isBallSaverActive: boolean = false;
  public ballSaverTimer: number = 0;
  public ballSaverDuration: number = 10.0;

  // Tilt System
  public isTilted: boolean = false;
  public tiltWarnings: number = 0;
  public maxTiltWarnings: number = GAME_RULES.MAX_TILT_WARNINGS;
  public tiltAccumulator: number = 0;
  public tiltDecayRate: number = 0.6; // Units per second decay

  // Event Callbacks
  public onGameStart?: () => void;
  public onGameOver?: () => void;
  public onNextBall?: (currentBall: number, extraBalls: number) => void;
  public onExtraBallAwarded?: (extraBallsCount: number) => void;
  public onBallSaverArmed?: (duration: number) => void;
  public onBallSaverExpired?: () => void;
  public onBallSaved?: () => void;
  public onTiltWarning?: (warningCount: number, maxWarnings: number) => void;
  public onTilt?: () => void;

  constructor(options: GameStateManagerOptions = {}) {
    this.maxBalls = options.initialBalls ?? GAME_RULES.INITIAL_BALLS;
    this.ballSaverDuration = options.ballSaverDuration ?? 10.0;
    this.maxTiltWarnings = options.maxTiltWarnings ?? GAME_RULES.MAX_TILT_WARNINGS;
    this.startNewGame();
  }

  /**
   * Resets all game state and starts Ball 1 of 3.
   */
  public startNewGame(): void {
    this.currentBall = 1;
    this.extraBalls = 0;
    this.isGameOver = false;
    this.isBallSaverActive = false;
    this.ballSaverTimer = 0;
    this.resetTilt();

    if (this.onGameStart) {
      this.onGameStart();
    }
  }

  /**
   * Awards an extra ball to the player.
   */
  public awardExtraBall(): void {
    this.extraBalls++;
    if (this.onExtraBallAwarded) {
      this.onExtraBallAwarded(this.extraBalls);
    }
  }

  /**
   * Arms the ball saver for a given duration (default 10s).
   */
  public armBallSaver(duration?: number): void {
    this.ballSaverDuration = duration ?? this.ballSaverDuration;
    this.ballSaverTimer = this.ballSaverDuration;
    this.isBallSaverActive = true;

    if (this.onBallSaverArmed) {
      this.onBallSaverArmed(this.ballSaverTimer);
    }
  }

  /**
   * Disarms / cancels the ball saver immediately.
   */
  public disarmBallSaver(): void {
    this.isBallSaverActive = false;
    this.ballSaverTimer = 0;
  }

  /**
   * Registers a table nudge and checks for tilt warnings.
   */
  public registerNudge(_direction: string = 'up', strength: number = 1.0): boolean {
    if (this.isTilted || this.isGameOver) return false;

    this.tiltAccumulator += strength;

    if (this.tiltAccumulator >= 0.99) {
      this.tiltAccumulator = 0;
      this.tiltWarnings++;

      if (this.tiltWarnings >= this.maxTiltWarnings) {
        this.tilt();
        return true;
      } else {
        if (this.onTiltWarning) {
          this.onTiltWarning(this.tiltWarnings, this.maxTiltWarnings);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Forces table into full TILT mode.
   */
  public tilt(): void {
    this.isTilted = true;
    this.tiltWarnings = this.maxTiltWarnings;
    this.tiltAccumulator = 0;

    if (this.onTilt) {
      this.onTilt();
    }
  }

  /**
   * Resets tilt flags and warning counter (called when a new ball begins).
   */
  public resetTilt(): void {
    this.isTilted = false;
    this.tiltWarnings = 0;
    this.tiltAccumulator = 0;
  }

  /**
   * Returns whether active player controls (flippers, plunger, kickers) are active.
   */
  public areFlippersEnabled(): boolean {
    return !this.isTilted && !this.isGameOver;
  }

  /**
   * Handles pinball drain event. Checks ball saver, extra balls, and game over.
   */
  public handleBallDrain(pinball: Pinball): BallDrainResult {
    // 1. Check if Ball Saver is active
    if (this.isBallSaverActive) {
      // Reposition ball back to plunger lane
      pinball.body.position.set(
        BALL.INITIAL_POSITION.x,
        BALL.INITIAL_POSITION.y,
        BALL.INITIAL_POSITION.z
      );
      pinball.body.velocity.set(0, 0, 0);
      pinball.body.angularVelocity.set(0, 0, 0);
      pinball.sync();

      if (this.onBallSaved) {
        this.onBallSaved();
      }

      return {
        saved: true,
        gameOver: false,
      };
    }

    // 2. Normal Drain (loss of ball)
    this.disarmBallSaver();
    this.resetTilt();

    // Check Extra Balls
    if (this.extraBalls > 0) {
      this.extraBalls--;

      // Reset ball to plunger lane for extra ball play
      pinball.body.position.set(
        BALL.INITIAL_POSITION.x,
        BALL.INITIAL_POSITION.y,
        BALL.INITIAL_POSITION.z
      );
      pinball.body.velocity.set(0, 0, 0);
      pinball.body.angularVelocity.set(0, 0, 0);
      pinball.sync();

      if (this.onNextBall) {
        this.onNextBall(this.currentBall, this.extraBalls);
      }

      return {
        saved: false,
        gameOver: false,
        extraBallUsed: true,
      };
    }

    // Check Next Ball in regulation play
    if (this.currentBall < this.maxBalls) {
      this.currentBall++;

      // Reset ball to plunger lane
      pinball.body.position.set(
        BALL.INITIAL_POSITION.x,
        BALL.INITIAL_POSITION.y,
        BALL.INITIAL_POSITION.z
      );
      pinball.body.velocity.set(0, 0, 0);
      pinball.body.angularVelocity.set(0, 0, 0);
      pinball.sync();

      if (this.onNextBall) {
        this.onNextBall(this.currentBall, this.extraBalls);
      }

      return {
        saved: false,
        gameOver: false,
        nextBall: true,
      };
    }

    // 3. No balls left -> Game Over!
    this.isGameOver = true;
    if (this.onGameOver) {
      this.onGameOver();
    }

    return {
      saved: false,
      gameOver: true,
    };
  }

  /**
   * Per-frame update step for countdown timers and tilt decay.
   */
  public update(deltaSec: number): void {
    // 1. Ball Saver countdown
    if (this.isBallSaverActive) {
      this.ballSaverTimer -= deltaSec;
      if (this.ballSaverTimer <= 0) {
        this.ballSaverTimer = 0;
        this.isBallSaverActive = false;
        if (this.onBallSaverExpired) {
          this.onBallSaverExpired();
        }
      }
    }

    // 2. Tilt accumulator decay
    if (this.tiltAccumulator > 0) {
      this.tiltAccumulator = Math.max(0, this.tiltAccumulator - this.tiltDecayRate * deltaSec);
    }
  }
}
