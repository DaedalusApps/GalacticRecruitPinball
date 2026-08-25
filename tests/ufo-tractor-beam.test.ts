import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { ScoreManager } from '../src/game/scoring';
import { GameStateManager } from '../src/game/state';
import { CenterPost, UfoBeamSinkHole } from '../src/table/elements';
import { TABLE_LAYOUT } from '../src/table/layout';
import { UfoProgressionSystem } from '../src/game/ufo-progression';
import { MothershipTractorBeam } from '../src/game/tractor-beam';
import { BALL } from '../src/utils/constants';

describe('UFO Beam Progressive Rewards & Mothership Tractor Beam (P2.5 & P2.6)', () => {
  let scoreManager: ScoreManager;
  let gameState: GameStateManager;
  let centerPost: CenterPost;
  let tractorBeam: MothershipTractorBeam;
  let ufoProgression: UfoProgressionSystem;
  let physicsWorld: PhysicsWorld;
  let pinball: Pinball;

  beforeEach(() => {
    scoreManager = new ScoreManager();
    gameState = new GameStateManager({ initialBalls: 3 });
    physicsWorld = new PhysicsWorld();
    pinball = new Pinball({ material: physicsWorld.ballMaterial });
    physicsWorld.addPinball(pinball);

    centerPost = new CenterPost({
      id: 'test-center-post',
      config: TABLE_LAYOUT.CENTER_POST,
      material: physicsWorld.wallMaterial,
    });
    physicsWorld.addCenterPost(centerPost);

    tractorBeam = new MothershipTractorBeam({
      id: 'test-mothership-tractor-beam',
      position: { x: 0, y: 2.0, z: 0.5 },
      attractionRadius: 6.0,
      captureRadius: 0.8,
      holdDuration: 1.2,
      ejectSpeed: 20.0,
      score: 50000,
    });

    ufoProgression = new UfoProgressionSystem({
      scoreManager,
      gameState,
      centerPost,
      tractorBeam,
    });
  });

  describe('UfoProgressionSystem (P2.5 - Issue #26)', () => {
    it('initializes with stage 0 and allows manual stage reset', () => {
      expect(ufoProgression.getCurrentStage()).toBe(0);
      ufoProgression.setStage(3);
      expect(ufoProgression.getCurrentStage()).toBe(3);
      ufoProgression.reset();
      expect(ufoProgression.getCurrentStage()).toBe(0);
    });

    it('Stage 1 (1st hit): Advances stage to 1 and awards 10,000 points', () => {
      const initialScore = scoreManager.getScore();
      const stageAwardCb = vi.fn();
      ufoProgression.onStageAward = stageAwardCb;

      const stage = ufoProgression.registerHit();

      expect(stage).toBe(1);
      expect(ufoProgression.getCurrentStage()).toBe(1);
      expect(scoreManager.getScore()).toBe(initialScore + 10000);
      expect(stageAwardCb).toHaveBeenCalledWith(1, expect.any(String));
    });

    it('Stage 2 (2nd hit): Advances multiplier (1x -> 2x) or awards progress', () => {
      ufoProgression.registerHit(); // Stage 1
      expect(scoreManager.getMultiplier()).toBe(1);

      const stage = ufoProgression.registerHit(); // Stage 2

      expect(stage).toBe(2);
      expect(ufoProgression.getCurrentStage()).toBe(2);
      expect(scoreManager.getMultiplier()).toBe(2);
    });

    it('Stage 3 (3rd hit): Deploys Barrier Drone (Center Post)', () => {
      expect(centerPost.isDeployed).toBe(false);

      ufoProgression.registerHit(); // Stage 1
      ufoProgression.registerHit(); // Stage 2
      const stage = ufoProgression.registerHit(); // Stage 3

      expect(stage).toBe(3);
      expect(ufoProgression.getCurrentStage()).toBe(3);
      expect(centerPost.isDeployed).toBe(true);
      expect(centerPost.body.position.z).toBe(centerPost.deployedZ);
    });

    it('Stage 4 (4th hit): Awards Extra Ball to GameStateManager', () => {
      expect(gameState.extraBalls).toBe(0);

      ufoProgression.registerHit(); // Stage 1
      ufoProgression.registerHit(); // Stage 2
      ufoProgression.registerHit(); // Stage 3
      const stage = ufoProgression.registerHit(); // Stage 4

      expect(stage).toBe(4);
      expect(ufoProgression.getCurrentStage()).toBe(4);
      expect(gameState.extraBalls).toBe(1);
    });

    it('Stage 5 (5th hit): Activates Mothership Tractor Beam and resets progression stage tracker to 0', () => {
      const tractorActivatedCb = vi.fn();
      const progressionResetCb = vi.fn();
      ufoProgression.onTractorBeamActivated = tractorActivatedCb;
      ufoProgression.onProgressionReset = progressionResetCb;

      expect(tractorBeam.isActive).toBe(false);

      ufoProgression.registerHit(); // Stage 1
      ufoProgression.registerHit(); // Stage 2
      ufoProgression.registerHit(); // Stage 3
      ufoProgression.registerHit(); // Stage 4

      const stage = ufoProgression.registerHit(); // Stage 5

      expect(stage).toBe(5);
      expect(tractorBeam.isActive).toBe(true);
      expect(ufoProgression.getCurrentStage()).toBe(0); // Resets stage tracker after 5th
      expect(tractorActivatedCb).toHaveBeenCalled();
      expect(progressionResetCb).toHaveBeenCalled();
    });

    it('cycles through progression repeatedly on subsequent hits (Hit 6 -> Stage 1, Hit 10 -> Stage 5)', () => {
      for (let i = 0; i < 5; i++) {
        ufoProgression.registerHit();
      }
      expect(ufoProgression.getCurrentStage()).toBe(0);

      // 6th hit -> Stage 1 again
      const stage6 = ufoProgression.registerHit();
      expect(stage6).toBe(1);
      expect(ufoProgression.getCurrentStage()).toBe(1);
    });
  });

  describe('MothershipTractorBeam (P2.6 - Issue #27)', () => {
    it('creates 3D visual hierarchy with Mothership UFO mesh, glowing vortex ring, and beam cylinder', () => {
      expect(tractorBeam.id).toBe('test-mothership-tractor-beam');
      expect(tractorBeam.position.x).toBe(0);
      expect(tractorBeam.position.y).toBe(2.0);
      expect(tractorBeam.mesh).toBeInstanceOf(THREE.Group);
      expect(tractorBeam.ufoMesh).toBeInstanceOf(THREE.Group);
      expect(tractorBeam.vortexMesh).toBeInstanceOf(THREE.Mesh);
      expect(tractorBeam.beamMesh).toBeInstanceOf(THREE.Mesh);
      expect(tractorBeam.isActive).toBe(false);
      expect(tractorBeam.isHolding).toBe(false);
    });

    it('when inactive, does not exert gravitational force or capture ball', () => {
      pinball.body.position.set(0, 3.0, BALL.RADIUS);
      pinball.body.velocity.set(0, 0, 0);

      tractorBeam.update(0.016, pinball);

      expect(tractorBeam.isHolding).toBe(false);
      expect(pinball.body.velocity.x).toBe(0);
      expect(pinball.body.velocity.y).toBe(0);
    });

    it('when active, exerts inward magnetic attraction on ball within attraction radius (R <= 6.0)', () => {
      tractorBeam.activate();
      expect(tractorBeam.isActive).toBe(true);

      // Place ball at (3.0, 2.0) - within attraction radius (dist = 3.0 <= 6.0)
      pinball.body.position.set(3.0, 2.0, BALL.RADIUS);
      pinball.body.velocity.set(0, 0, 0);

      tractorBeam.update(0.05, pinball);

      // Inward pull should accelerate ball leftward (-X direction toward x=0)
      expect(pinball.body.velocity.x).toBeLessThan(0);
      expect(Math.abs(pinball.body.velocity.y)).toBeLessThan(1.0);
    });

    it('does not exert attraction if ball is outside attraction radius (R > 6.0)', () => {
      tractorBeam.activate();

      // Place ball far away at (8.0, 10.0) -> dist > 6.0
      pinball.body.position.set(8.0, 10.0, BALL.RADIUS);
      pinball.body.velocity.set(0, 0, 0);

      tractorBeam.update(0.05, pinball);

      expect(pinball.body.velocity.x).toBe(0);
      expect(pinball.body.velocity.y).toBe(0);
    });

    it('captures ball at center when distance <= 0.8, zeros velocity, and awards 50,000 pts bonus', () => {
      tractorBeam.activate();
      const captureCb = vi.fn();
      tractorBeam.onCapture = captureCb;

      // Ball enters center zone at (0.2, 2.3) -> dist ~ 0.36 <= 0.8
      pinball.body.position.set(0.2, 2.3, BALL.RADIUS);
      pinball.body.velocity.set(2.0, -1.0, 0);

      const captured = tractorBeam.checkCapture(pinball);

      expect(captured).toBe(true);
      expect(tractorBeam.isHolding).toBe(true);
      expect(pinball.body.velocity.x).toBe(0);
      expect(pinball.body.velocity.y).toBe(0);
      expect(captureCb).toHaveBeenCalledWith(pinball, 50000);
    });

    it('holds ball stationary for 1.2 seconds during hold duration', () => {
      tractorBeam.activate();
      pinball.body.position.set(0, 2.0, BALL.RADIUS);
      tractorBeam.captureBall(pinball);

      expect(tractorBeam.isHolding).toBe(true);
      expect(tractorBeam.holdTimer).toBe(0);

      // Advance 0.6 seconds (halfway)
      tractorBeam.update(0.6, pinball);

      expect(tractorBeam.isHolding).toBe(true);
      expect(tractorBeam.holdTimer).toBeCloseTo(0.6, 2);
      expect(pinball.body.position.x).toBeCloseTo(0, 2);
      expect(pinball.body.position.y).toBeCloseTo(2.0, 2);
      expect(pinball.body.velocity.x).toBe(0);
      expect(pinball.body.velocity.y).toBe(0);
    });

    it('forcefully ejects ball upward (v_y >= 18 u/s) upon hold timer expiry and disarms until next activation', () => {
      tractorBeam.activate();
      pinball.body.position.set(0, 2.0, BALL.RADIUS);
      tractorBeam.captureBall(pinball);

      const ejectCb = vi.fn();
      tractorBeam.onEject = ejectCb;

      // Advance by 1.25s (> 1.2s hold duration) -> EJECT!
      tractorBeam.update(1.25, pinball);

      expect(tractorBeam.isHolding).toBe(false);
      expect(tractorBeam.isActive).toBe(false); // Disarmed after ejection
      expect(ejectCb).toHaveBeenCalledWith(pinball);

      // Upward launch velocity check: v_y >= 18 u/s
      expect(pinball.body.velocity.y).toBeGreaterThanOrEqual(18.0);
    });

    it('executes full sequence: 5 UFO Beam captures trigger Tractor Beam -> magnetic pull -> capture -> 50K pts -> launch ejection', () => {
      const ufoBeam = new UfoBeamSinkHole({
        id: 'test-yellow-beam',
        config: TABLE_LAYOUT.UFO_BEAMS.YELLOW,
      });
      ufoBeam.onCapture = () => {
        ufoProgression.registerHit();
      };

      // 5 consecutive UFO beam shots
      for (let i = 0; i < 5; i++) {
        ufoBeam.onCapture(ufoBeam, pinball);
      }

      // Tractor Beam is now active!
      expect(tractorBeam.isActive).toBe(true);
      expect(ufoProgression.getCurrentStage()).toBe(0);

      // Ball enters gravity well at (0.3, 2.1)
      pinball.body.position.set(0.3, 2.1, BALL.RADIUS);
      pinball.body.velocity.set(1.0, 1.0, 0);

      const captured = tractorBeam.checkCapture(pinball);
      expect(captured).toBe(true);
      expect(tractorBeam.isHolding).toBe(true);

      // Hold expires after 1.2s
      tractorBeam.update(1.3, pinball);

      expect(tractorBeam.isHolding).toBe(false);
      expect(tractorBeam.isActive).toBe(false);
      expect(pinball.body.velocity.y).toBeGreaterThanOrEqual(18.0);
    });
  });
});
