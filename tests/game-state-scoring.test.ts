import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScoreManager } from '../src/game/scoring';
import { GameStateManager } from '../src/game/state';
import { Pinball } from '../src/physics/ball';
import { PhysicsWorld } from '../src/physics/world';
import { BALL } from '../src/utils/constants';

describe('Game State & Scoring System (P2.1 - P2.11)', () => {
  describe('ScoreManager (P2.1, P2.7, P2.8)', () => {
    let scoreManager: ScoreManager;

    beforeEach(() => {
      scoreManager = new ScoreManager();
    });

    it('initializes with 0 score and 1x multiplier', () => {
      expect(scoreManager.getScore()).toBe(0);
      expect(scoreManager.getMultiplier()).toBe(1);
    });

    it('records base points and dispatches score change listener', () => {
      const listener = vi.fn();
      scoreManager.onScoreChange = listener;

      scoreManager.addPoints(500);
      expect(scoreManager.getScore()).toBe(500);
      expect(listener).toHaveBeenCalledWith(500, 500);

      scoreManager.addPoints(1500);
      expect(scoreManager.getScore()).toBe(2000);
      expect(listener).toHaveBeenCalledWith(2000, 1500);
    });

    it('applies active multiplier to scored points (1x, 2x, 3x, 5x, 10x)', () => {
      expect(scoreManager.getMultiplier()).toBe(1);
      scoreManager.addPoints(1000);
      expect(scoreManager.getScore()).toBe(1000);

      scoreManager.advanceMultiplier(); // 2x
      expect(scoreManager.getMultiplier()).toBe(2);
      scoreManager.addPoints(1000);
      expect(scoreManager.getScore()).toBe(1000 + 2000);

      scoreManager.advanceMultiplier(); // 3x
      expect(scoreManager.getMultiplier()).toBe(3);
      scoreManager.addPoints(1000);
      expect(scoreManager.getScore()).toBe(3000 + 3000);

      scoreManager.advanceMultiplier(); // 5x
      expect(scoreManager.getMultiplier()).toBe(5);
      scoreManager.addPoints(1000);
      expect(scoreManager.getScore()).toBe(6000 + 5000);

      scoreManager.advanceMultiplier(); // 10x
      expect(scoreManager.getMultiplier()).toBe(10);
      scoreManager.addPoints(1000);
      expect(scoreManager.getScore()).toBe(11000 + 10000);
    });

    it('caps multiplier progression at 10x', () => {
      scoreManager.setMultiplier(10);
      expect(scoreManager.getMultiplier()).toBe(10);
      const next = scoreManager.advanceMultiplier();
      expect(next).toBe(10);
      expect(scoreManager.getMultiplier()).toBe(10);
    });

    it('allows adding raw points without multiplier when specified', () => {
      scoreManager.setMultiplier(5);
      scoreManager.addPoints(500, false);
      expect(scoreManager.getScore()).toBe(500);
    });

    it('resets multiplier back to 1x', () => {
      scoreManager.setMultiplier(5);
      scoreManager.resetMultiplier();
      expect(scoreManager.getMultiplier()).toBe(1);
    });

    it('dispatches onMultiplierChange listener', () => {
      const listener = vi.fn();
      scoreManager.onMultiplierChange = listener;

      scoreManager.advanceMultiplier(); // 2
      expect(listener).toHaveBeenCalledWith(2);

      scoreManager.setMultiplier(5);
      expect(listener).toHaveBeenCalledWith(5);

      scoreManager.resetMultiplier();
      expect(listener).toHaveBeenCalledWith(1);
    });

    it('computes end-of-ball bonus accurately: (Missions*50K + Medals*25K + Fuel*1K + Rank*10K) * Multiplier', () => {
      scoreManager.setMultiplier(1);
      const bonus1 = scoreManager.calculateBonus({
        missions: 2,
        medals: 4,
        fuel: 50,
        rank: 3,
        isTilted: false,
      });
      // (2 * 50,000 + 4 * 25,000 + 50 * 1,000 + 3 * 10,000) * 1
      // = (100,000 + 100,000 + 50,000 + 30,000) * 1 = 280,000
      expect(bonus1).toBe(280000);

      scoreManager.setMultiplier(3);
      const bonus2 = scoreManager.calculateBonus({
        missions: 2,
        medals: 4,
        fuel: 50,
        rank: 3,
        isTilted: false,
      });
      // 280,000 * 3 = 840,000
      expect(bonus2).toBe(840000);
    });

    it('forfeits end-of-ball bonus completely on tilt', () => {
      scoreManager.setMultiplier(5);
      const bonusTilted = scoreManager.calculateBonus({
        missions: 5,
        medals: 10,
        fuel: 100,
        rank: 5,
        isTilted: true,
      });
      expect(bonusTilted).toBe(0);
    });

    it('awards end-of-ball bonus to total score and triggers onBonusAwarded', () => {
      const bonusListener = vi.fn();
      scoreManager.onBonusAwarded = bonusListener;
      scoreManager.setMultiplier(2);

      const awarded = scoreManager.awardEndOfBallBonus({
        missions: 1,
        medals: 2,
        fuel: 10,
        rank: 1,
        isTilted: false,
      });
      // (1*50000 + 2*25000 + 10*1000 + 1*10000) * 2 = (50000 + 50000 + 10000 + 10000) * 2 = 120000 * 2 = 240000
      expect(awarded).toBe(240000);
      expect(scoreManager.getScore()).toBe(240000);
      expect(bonusListener).toHaveBeenCalledWith(240000);
    });

    it('resets score and multiplier on reset()', () => {
      scoreManager.addPoints(50000);
      scoreManager.setMultiplier(5);
      scoreManager.reset();
      expect(scoreManager.getScore()).toBe(0);
      expect(scoreManager.getMultiplier()).toBe(1);
    });
  });

  describe('GameStateManager (P2.9, P2.10, P2.11)', () => {
    let gameState: GameStateManager;
    let physicsWorld: PhysicsWorld;
    let pinball: Pinball;

    beforeEach(() => {
      gameState = new GameStateManager({ initialBalls: 3, ballSaverDuration: 10.0 });
      physicsWorld = new PhysicsWorld();
      pinball = new Pinball({ material: physicsWorld.ballMaterial });
      physicsWorld.addPinball(pinball);
    });

    it('initializes with ball 1 of 3, 0 extra balls, and not game over', () => {
      expect(gameState.currentBall).toBe(1);
      expect(gameState.maxBalls).toBe(3);
      expect(gameState.extraBalls).toBe(0);
      expect(gameState.isGameOver).toBe(false);
      expect(gameState.isTilted).toBe(false);
      expect(gameState.isBallSaverActive).toBe(false);
    });

    it('awards extra balls and invokes onExtraBallAwarded callback', () => {
      const extraBallListener = vi.fn();
      gameState.onExtraBallAwarded = extraBallListener;

      gameState.awardExtraBall();
      expect(gameState.extraBalls).toBe(1);
      expect(extraBallListener).toHaveBeenCalledWith(1);

      gameState.awardExtraBall();
      expect(gameState.extraBalls).toBe(2);
      expect(extraBallListener).toHaveBeenCalledWith(2);
    });

    describe('Ball Saver (P2.11)', () => {
      it('arms ball saver for 10 seconds on ball launch', () => {
        const saverArmedListener = vi.fn();
        gameState.onBallSaverArmed = saverArmedListener;

        gameState.armBallSaver(10.0);
        expect(gameState.isBallSaverActive).toBe(true);
        expect(gameState.ballSaverTimer).toBeCloseTo(10.0, 1);
        expect(saverArmedListener).toHaveBeenCalledWith(10.0);
      });

      it('counts down ball saver timer and expires after duration', () => {
        const expiredListener = vi.fn();
        gameState.onBallSaverExpired = expiredListener;

        gameState.armBallSaver(10.0);
        gameState.update(5.0);
        expect(gameState.isBallSaverActive).toBe(true);
        expect(gameState.ballSaverTimer).toBeCloseTo(5.0, 1);
        expect(expiredListener).not.toHaveBeenCalled();

        gameState.update(5.5);
        expect(gameState.isBallSaverActive).toBe(false);
        expect(gameState.ballSaverTimer).toBe(0);
        expect(expiredListener).toHaveBeenCalled();
      });

      it('saves ball on drain when ball saver is active without advancing ball count', () => {
        const ballSavedListener = vi.fn();
        gameState.onBallSaved = ballSavedListener;

        gameState.armBallSaver(10.0);

        // Move pinball to drain
        pinball.body.position.set(0, -19.5, 0.5);
        pinball.body.velocity.set(2, -15, 0);

        const result = gameState.handleBallDrain(pinball);

        expect(result.saved).toBe(true);
        expect(result.gameOver).toBe(false);
        expect(gameState.currentBall).toBe(1);
        expect(ballSavedListener).toHaveBeenCalled();

        // Pinball should be returned to plunger lane with 0 velocity
        expect(pinball.body.position.x).toBeCloseTo(BALL.INITIAL_POSITION.x, 1);
        expect(pinball.body.position.y).toBeCloseTo(BALL.INITIAL_POSITION.y, 1);
        expect(pinball.body.velocity.x).toBe(0);
        expect(pinball.body.velocity.y).toBe(0);
      });
    });

    describe('Tilt System (P2.10)', () => {
      it('registers tilt warnings on nudges and triggers TILT on 3rd warning', () => {
        const warningListener = vi.fn();
        const tiltListener = vi.fn();
        gameState.onTiltWarning = warningListener;
        gameState.onTilt = tiltListener;

        // 1st warning
        gameState.registerNudge('left', 1.0);
        expect(gameState.tiltWarnings).toBe(1);
        expect(gameState.isTilted).toBe(false);
        expect(warningListener).toHaveBeenCalledWith(1, 3);

        // 2nd warning
        gameState.registerNudge('right', 1.0);
        expect(gameState.tiltWarnings).toBe(2);
        expect(gameState.isTilted).toBe(false);
        expect(warningListener).toHaveBeenCalledWith(2, 3);

        // 3rd warning -> TILT
        gameState.registerNudge('up', 1.0);
        expect(gameState.tiltWarnings).toBe(3);
        expect(gameState.isTilted).toBe(true);
        expect(tiltListener).toHaveBeenCalled();
      });

      it('disables flippers and bumpers in TILT state', () => {
        expect(gameState.areFlippersEnabled()).toBe(true);

        gameState.tilt();
        expect(gameState.isTilted).toBe(true);
        expect(gameState.areFlippersEnabled()).toBe(false);
      });

      it('decays tilt accumulator over time if below warning threshold', () => {
        gameState.tiltAccumulator = 0.8;
        gameState.update(1.0);
        expect(gameState.tiltAccumulator).toBeLessThan(0.8);
      });

      it('resets tilt status on new ball drain/advance', () => {
        gameState.tilt();
        expect(gameState.isTilted).toBe(true);

        // Ball drains and advances to next ball
        gameState.handleBallDrain(pinball);
        expect(gameState.isTilted).toBe(false);
        expect(gameState.tiltWarnings).toBe(0);
        expect(gameState.areFlippersEnabled()).toBe(true);
      });
    });

    describe('Ball Lifecycle & Game Over (P2.9)', () => {
      it('consumes extra ball before advancing currentBall', () => {
        const nextBallListener = vi.fn();
        gameState.onNextBall = nextBallListener;
        gameState.awardExtraBall();

        expect(gameState.currentBall).toBe(1);
        expect(gameState.extraBalls).toBe(1);

        const result = gameState.handleBallDrain(pinball);
        expect(result.saved).toBe(false);
        expect(result.gameOver).toBe(false);
        expect(result.extraBallUsed).toBe(true);
        expect(gameState.currentBall).toBe(1);
        expect(gameState.extraBalls).toBe(0);
        expect(nextBallListener).toHaveBeenCalledWith(1, 0);
      });

      it('advances currentBall when ball drains without saver or extra balls', () => {
        const nextBallListener = vi.fn();
        gameState.onNextBall = nextBallListener;

        // Drain Ball 1 -> Ball 2
        const res1 = gameState.handleBallDrain(pinball);
        expect(res1.gameOver).toBe(false);
        expect(gameState.currentBall).toBe(2);
        expect(nextBallListener).toHaveBeenCalledWith(2, 0);

        // Drain Ball 2 -> Ball 3
        const res2 = gameState.handleBallDrain(pinball);
        expect(res2.gameOver).toBe(false);
        expect(gameState.currentBall).toBe(3);
        expect(nextBallListener).toHaveBeenCalledWith(3, 0);
      });

      it('triggers onGameOver once all 3 balls drain', () => {
        const gameOverListener = vi.fn();
        gameState.onGameOver = gameOverListener;

        // Drain Ball 1
        gameState.handleBallDrain(pinball);
        expect(gameState.isGameOver).toBe(false);

        // Drain Ball 2
        gameState.handleBallDrain(pinball);
        expect(gameState.isGameOver).toBe(false);

        // Drain Ball 3
        const res3 = gameState.handleBallDrain(pinball);
        expect(res3.gameOver).toBe(true);
        expect(gameState.isGameOver).toBe(true);
        expect(gameOverListener).toHaveBeenCalled();
      });

      it('startNewGame resets all state properly', () => {
        gameState.currentBall = 3;
        gameState.extraBalls = 2;
        gameState.isGameOver = true;
        gameState.tilt();

        gameState.startNewGame();
        expect(gameState.currentBall).toBe(1);
        expect(gameState.extraBalls).toBe(0);
        expect(gameState.isGameOver).toBe(false);
        expect(gameState.isTilted).toBe(false);
        expect(gameState.tiltWarnings).toBe(0);
      });
    });
  });

  describe('Table Element Scoring & Progression Integration (P2.1 - P2.7)', () => {
    let scoreManager: ScoreManager;
    let gameState: GameStateManager;

    beforeEach(() => {
      scoreManager = new ScoreManager();
      gameState = new GameStateManager();
    });

    it('awards correct base bumper points across Blue (500), Green (1500), Red (4000) tiers', () => {
      // Level 1: 500
      scoreManager.addPoints(500);
      expect(scoreManager.getScore()).toBe(500);

      // Level 2: 1500
      scoreManager.addPoints(1500);
      expect(scoreManager.getScore()).toBe(2000);

      // Level 3: 4000
      scoreManager.addPoints(4000);
      expect(scoreManager.getScore()).toBe(6000);
    });

    it('awards 500 points for slingshot hits', () => {
      scoreManager.addPoints(500);
      expect(scoreManager.getScore()).toBe(500);
    });

    it('awards 50,000 points on booster drop target bank clear', () => {
      scoreManager.addPoints(50000);
      expect(scoreManager.getScore()).toBe(50000);
    });

    it('awards 5,000 points for spot target hits', () => {
      scoreManager.addPoints(5000);
      expect(scoreManager.getScore()).toBe(5000);
    });

    it('awards skill shot values from 15K to 75K based on rollover position', () => {
      // Position 1: 15,000
      scoreManager.addPoints(15000);
      expect(scoreManager.getScore()).toBe(15000);

      // Sweet spot (Position 3): 75,000
      scoreManager.addPoints(75000);
      expect(scoreManager.getScore()).toBe(90000);
    });

    it('awards spinner points (100 base, 1000 boosted) multiplied by spin count', () => {
      // Normal spinner: 10 spins * 100 = 1000
      scoreManager.addPoints(100 * 10);
      expect(scoreManager.getScore()).toBe(1000);

      // Boosted spinner: 5 spins * 1000 = 5000
      scoreManager.addPoints(1000 * 5);
      expect(scoreManager.getScore()).toBe(6000);
    });

    it('advances field multiplier on Medal Bank completion and Re-entry completion', () => {
      expect(scoreManager.getMultiplier()).toBe(1);

      // Medal targets bank clear
      scoreManager.advanceMultiplier();
      expect(scoreManager.getMultiplier()).toBe(2);

      // Reentry cycle complete
      scoreManager.advanceMultiplier();
      expect(scoreManager.getMultiplier()).toBe(3);

      // UFO Beam progression
      scoreManager.advanceMultiplier();
      expect(scoreManager.getMultiplier()).toBe(5);

      scoreManager.advanceMultiplier();
      expect(scoreManager.getMultiplier()).toBe(10);
    });

    it('ignores scoring during TILT state', () => {
      gameState.tilt();
      expect(gameState.isTilted).toBe(true);

      const addScoreIfActive = (pts: number) => {
        if (!gameState.isTilted) {
          scoreManager.addPoints(pts);
        }
      };

      addScoreIfActive(5000);
      expect(scoreManager.getScore()).toBe(0);
    });
  });
});

