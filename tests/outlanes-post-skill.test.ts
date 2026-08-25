import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { TABLE_LAYOUT } from '../src/table/layout';
import {
  ShieldKickback,
  DrainSensor,
  CenterPost,
  SkillShotLane,
} from '../src/table/elements';
import { BALL } from '../src/utils/constants';

describe('Table Geometry & Mechanics: Outlanes, Post & Skill Shot (P1.11 - P1.13)', () => {
  let physicsWorld: PhysicsWorld;
  let pinball: Pinball;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
    pinball = new Pinball({ material: physicsWorld.ballMaterial });
    physicsWorld.addPinball(pinball);
  });

  describe('ShieldKickback (P1.11 - Issue #19)', () => {
    it('creates ShieldKickback in left outlane with solenoid kicker, neon shield barrier mesh, and light', () => {
      const kickback = new ShieldKickback({
        id: 'left-shield-kickback',
        config: TABLE_LAYOUT.KICKBACK,
        material: physicsWorld.wallMaterial,
      });

      expect(kickback.id).toBe('left-shield-kickback');
      expect(kickback.mesh).toBeInstanceOf(THREE.Group);
      expect(kickback.barrierMesh).toBeInstanceOf(THREE.Mesh);
      expect(kickback.body).toBeInstanceOf(CANNON.Body);
      expect(kickback.isArmed).toBe(false);
      expect(kickback.position.x).toBeCloseTo(TABLE_LAYOUT.KICKBACK.position.x, 1);
      expect(kickback.position.y).toBeCloseTo(TABLE_LAYOUT.KICKBACK.position.y, 1);
    });

    it('can be armed and disarmed, adjusting visual neon shield glow', () => {
      const kickback = new ShieldKickback({
        id: 'left-shield-kickback',
        config: TABLE_LAYOUT.KICKBACK,
        material: physicsWorld.wallMaterial,
      });

      expect(kickback.isArmed).toBe(false);
      expect(kickback.barrierMaterial.emissiveIntensity).toBeLessThan(0.5);

      kickback.arm();
      expect(kickback.isArmed).toBe(true);
      expect(kickback.barrierMaterial.emissiveIntensity).toBeGreaterThanOrEqual(1.0);

      kickback.disarm();
      expect(kickback.isArmed).toBe(false);
      expect(kickback.barrierMaterial.emissiveIntensity).toBeLessThan(0.5);
    });

    it('when armed, detects ball in left outlane, applies powerful upward kick impulse (vy >= 35), and disarms', () => {
      const kickback = new ShieldKickback({
        id: 'left-shield-kickback',
        config: TABLE_LAYOUT.KICKBACK,
        material: physicsWorld.wallMaterial,
      });

      const kickCb = vi.fn();
      kickback.onKickbackFired = kickCb;

      kickback.arm();
      expect(kickback.isArmed).toBe(true);

      // Position ball falling downward in left outlane
      pinball.body.position.set(
        TABLE_LAYOUT.KICKBACK.position.x,
        TABLE_LAYOUT.KICKBACK.position.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(0, -10, 0);

      const fired = kickback.checkBall(pinball);
      expect(fired).toBe(true);
      expect(kickback.isArmed).toBe(false); // Disarmed after kick
      expect(kickCb).toHaveBeenCalledWith(kickback, pinball);

      // Verify powerful upward velocity returned to table
      expect(pinball.body.velocity.y).toBeGreaterThanOrEqual(35);
    });

    it('when disarmed, does not kick ball and lets ball drain', () => {
      const kickback = new ShieldKickback({
        id: 'left-shield-kickback',
        config: TABLE_LAYOUT.KICKBACK,
        material: physicsWorld.wallMaterial,
      });

      const kickCb = vi.fn();
      kickback.onKickbackFired = kickCb;

      expect(kickback.isArmed).toBe(false);

      pinball.body.position.set(
        TABLE_LAYOUT.KICKBACK.position.x,
        TABLE_LAYOUT.KICKBACK.position.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(0, -10, 0);

      const fired = kickback.checkBall(pinball);
      expect(fired).toBe(false);
      expect(kickback.isArmed).toBe(false);
      expect(kickCb).not.toHaveBeenCalled();
      expect(pinball.body.velocity.y).toBe(-10);
    });
  });

  describe('DrainSensor (P1.11 - Issue #19)', () => {
    it('creates DrainSensor covering table bottom drain zone (y <= -19.5)', () => {
      const drain = new DrainSensor({
        id: 'bottom-drain-sensor',
        config: TABLE_LAYOUT.DRAIN,
      });

      expect(drain.id).toBe('bottom-drain-sensor');
      expect(drain.drainY).toBeLessThanOrEqual(-19.5);
      expect(drain.hasDrained).toBe(false);
      expect(drain.mesh).toBeInstanceOf(THREE.Group);
    });

    it('detects ball drain at bottom zone and fires onBallDrain callback', () => {
      const drain = new DrainSensor({
        id: 'bottom-drain-sensor',
        config: TABLE_LAYOUT.DRAIN,
      });

      const drainCb = vi.fn();
      drain.onBallDrain = drainCb;

      // Ball above drain zone
      pinball.body.position.set(0, -15, BALL.RADIUS);
      expect(drain.checkDrain(pinball)).toBe(false);
      expect(drainCb).not.toHaveBeenCalled();

      // Ball enters drain zone (y <= -19.5)
      pinball.body.position.set(0, -19.6, BALL.RADIUS);
      const drained = drain.checkDrain(pinball);
      expect(drained).toBe(true);
      expect(drain.hasDrained).toBe(true);
      expect(drainCb).toHaveBeenCalledWith(drain, pinball);

      // Subsequent check does not fire again until reset
      expect(drain.checkDrain(pinball)).toBe(false);
      expect(drainCb).toHaveBeenCalledTimes(1);

      // Reset
      drain.reset();
      expect(drain.hasDrained).toBe(false);
    });
  });

  describe('CenterPost (Barrier Drone) (P1.12 - Issue #20)', () => {
    it('creates CenterPost at (0, -16.8) with pneumatic cylinder mesh, drone icon, and static collider', () => {
      const post = new CenterPost({
        id: 'center-barrier-drone',
        config: TABLE_LAYOUT.CENTER_POST,
        material: physicsWorld.wallMaterial,
      });

      expect(post.id).toBe('center-barrier-drone');
      expect(post.mesh).toBeInstanceOf(THREE.Group);
      expect(post.postMesh).toBeInstanceOf(THREE.Mesh);
      expect(post.droneMesh).toBeInstanceOf(THREE.Group);
      expect(post.body).toBeInstanceOf(CANNON.Body);
      expect(post.isDeployed).toBe(false);
      expect(post.position.x).toBeCloseTo(0, 1);
      expect(post.position.y).toBeCloseTo(-16.8, 1);
      // Retracted initially under table
      expect(post.body.position.z).toBeCloseTo(-0.8, 1);
    });

    it('deploys center post raising static cylinder collider to z = 0.6', () => {
      const post = new CenterPost({
        id: 'center-barrier-drone',
        config: TABLE_LAYOUT.CENTER_POST,
        material: physicsWorld.wallMaterial,
      });

      expect(post.isDeployed).toBe(false);
      post.deploy();
      expect(post.isDeployed).toBe(true);
      expect(post.body.position.z).toBeCloseTo(0.6, 1);
      expect(post.mesh.position.z).toBeCloseTo(0.6, 1);
    });

    it('absorbs ball collision when deployed, deflects ball upward, triggers onBallSaved, and lowers back under table (z = -0.8)', () => {
      const post = new CenterPost({
        id: 'center-barrier-drone',
        config: TABLE_LAYOUT.CENTER_POST,
        material: physicsWorld.wallMaterial,
      });

      const saveCb = vi.fn();
      post.onBallSaved = saveCb;

      post.deploy();
      expect(post.isDeployed).toBe(true);

      // Ball drops straight down towards center drain
      pinball.body.position.set(0, -16.0, BALL.RADIUS);
      pinball.body.velocity.set(0, -12, 0);

      const saved = post.handleBallContact(pinball);
      expect(saved).toBe(true);
      expect(saveCb).toHaveBeenCalledWith(post, pinball);

      // Ball should be deflected upward away from drain
      expect(pinball.body.velocity.y).toBeGreaterThan(5);

      // Post lowers back under table
      expect(post.isDeployed).toBe(false);
      expect(post.body.position.z).toBeCloseTo(-0.8, 1);
    });

    it('does not interact or save ball when retracted under table', () => {
      const post = new CenterPost({
        id: 'center-barrier-drone',
        config: TABLE_LAYOUT.CENTER_POST,
        material: physicsWorld.wallMaterial,
      });

      const saveCb = vi.fn();
      post.onBallSaved = saveCb;

      expect(post.isDeployed).toBe(false);

      pinball.body.position.set(0, -16.0, BALL.RADIUS);
      pinball.body.velocity.set(0, -12, 0);

      const saved = post.handleBallContact(pinball);
      expect(saved).toBe(false);
      expect(saveCb).not.toHaveBeenCalled();
      expect(pinball.body.velocity.y).toBe(-12);
    });
  });

  describe('SkillShotLane (P1.13 - Issue #21)', () => {
    it('creates SkillShotLane with 6 indicator lights in plunger channel (y = -16, -10, -4, 2, 8, 14)', () => {
      const skillShot = new SkillShotLane({
        id: 'skill-shot-lane',
        config: TABLE_LAYOUT.SKILL_SHOT,
      });

      expect(skillShot.id).toBe('skill-shot-lane');
      expect(skillShot.lights.length).toBe(6);
      expect(skillShot.mesh).toBeInstanceOf(THREE.Group);

      const expectedY = [-16, -10, -4, 2, 8, 14];
      for (let i = 0; i < 6; i++) {
        expect(skillShot.lights[i].position.y).toBeCloseTo(expectedY[i], 1);
        expect(skillShot.lights[i].position.x).toBeCloseTo(TABLE_LAYOUT.SKILL_SHOT.laneX, 1);
      }
    });

    it('evaluates launch trajectory on plunger launch and awards optimal Light #3 sweet spot (75,000 pts)', () => {
      const skillShot = new SkillShotLane({
        id: 'skill-shot-lane',
        config: TABLE_LAYOUT.SKILL_SHOT,
      });

      const awardCb = vi.fn();
      skillShot.onSkillShotAwarded = awardCb;

      // Start launch evaluation
      skillShot.startLaunch();
      expect(skillShot.isEvaluating).toBe(true);

      // Ball reaches Light #3 (index 2, y = -4)
      pinball.body.position.set(
        TABLE_LAYOUT.SKILL_SHOT.laneX,
        -4.0,
        BALL.RADIUS
      );
      pinball.body.velocity.set(0, 10, 0);

      const awarded = skillShot.checkBall(pinball);
      expect(awarded).toBe(true);
      expect(skillShot.awardedLightIndex).toBe(2);
      expect(skillShot.awardedPoints).toBe(75000);
      expect(awardCb).toHaveBeenCalledWith(2, 75000);
    });

    it('awards points based on skill shot light tier (15K, 30K, 75K, 30K, 15K, 5K)', () => {
      const skillShot = new SkillShotLane({
        id: 'skill-shot-lane',
        config: TABLE_LAYOUT.SKILL_SHOT,
      });

      const expectedPoints = [15000, 30000, 75000, 30000, 15000, 5000];
      for (let i = 0; i < 6; i++) {
        expect(skillShot.getPointsForLight(i)).toBe(expectedPoints[i]);
      }
    });

    it('closes evaluation window once ball exits plunger lane into main table', () => {
      const skillShot = new SkillShotLane({
        id: 'skill-shot-lane',
        config: TABLE_LAYOUT.SKILL_SHOT,
      });

      skillShot.startLaunch();
      expect(skillShot.isEvaluating).toBe(true);

      // Ball exits plunger lane at top into table playfield (x < 7.6 or y > 18)
      pinball.body.position.set(5.0, 16.0, BALL.RADIUS);
      pinball.body.velocity.set(-10, -5, 0);

      skillShot.checkBall(pinball);
      expect(skillShot.isEvaluating).toBe(false);
    });
  });
});
