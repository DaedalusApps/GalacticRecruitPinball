import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { TABLE_LAYOUT } from '../src/table/layout';
import {
  LaunchRamp,
  DropTargetBank,
  SpotTargetBank,
  UfoBeamSinkHole,
  AlienSpinner,
  SpaceWarpRollover,
} from '../src/table/elements';
import { COLORS, BALL } from '../src/utils/constants';

describe('Table Elements: Targets, Ramp, Holes, Spinners & Warp (P1.5 - P1.10)', () => {
  let physicsWorld: PhysicsWorld;
  let pinball: Pinball;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
    pinball = new Pinball({ material: physicsWorld.ballMaterial });
    physicsWorld.addPinball(pinball);
  });

  describe('LaunchRamp (P1.5 - Issue #13)', () => {
    it('creates LaunchRamp with entrance mesh, CatmullRomCurve wire habitrail tube mesh, and physics triggers', () => {
      const ramp = new LaunchRamp({
        id: 'cannon-launch-ramp',
        config: TABLE_LAYOUT.LAUNCH_RAMP,
      });

      expect(ramp.id).toBe('cannon-launch-ramp');
      expect(ramp.mesh).toBeInstanceOf(THREE.Group);
      expect(ramp.curve).toBeInstanceOf(THREE.CatmullRomCurve3);
      expect(ramp.habitrailMesh).toBeInstanceOf(THREE.Mesh);
      expect(ramp.entranceMesh).toBeInstanceOf(THREE.Mesh);
      expect(ramp.isTransporting).toBe(false);
      expect(ramp.transitProgress).toBe(0);
    });

    it('detects ball entry at entrance and initiates kinematic transport along 3D spline curve', () => {
      const ramp = new LaunchRamp({
        id: 'cannon-launch-ramp',
        config: TABLE_LAYOUT.LAUNCH_RAMP,
      });

      const enterCb = vi.fn();
      ramp.onRampEnter = enterCb;

      // Position ball at entrance moving upwards (+Y)
      pinball.body.position.set(
        TABLE_LAYOUT.LAUNCH_RAMP.entrance.x,
        TABLE_LAYOUT.LAUNCH_RAMP.entrance.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(0, 15, 0);

      const entered = ramp.checkEntry(pinball);
      expect(entered).toBe(true);
      expect(ramp.isTransporting).toBe(true);
      expect(enterCb).toHaveBeenCalledWith(ramp, pinball);
    });

    it('transports ball along the spline curve during updates and ejects at upper playfield exit with outward velocity', () => {
      const ramp = new LaunchRamp({
        id: 'cannon-launch-ramp',
        config: TABLE_LAYOUT.LAUNCH_RAMP,
        transitDuration: 1.0,
      });

      const exitCb = vi.fn();
      ramp.onRampComplete = exitCb;

      ramp.enterRamp(pinball);
      expect(ramp.isTransporting).toBe(true);

      // Advance halfway (0.5s)
      ramp.update(0.5);
      expect(ramp.isTransporting).toBe(true);
      expect(ramp.transitProgress).toBeCloseTo(0.5, 2);

      const midPoint = ramp.curve.getPoint(0.5);
      expect(pinball.body.position.x).toBeCloseTo(midPoint.x, 1);
      expect(pinball.body.position.y).toBeCloseTo(midPoint.y, 1);
      expect(pinball.body.position.z).toBeCloseTo(midPoint.z, 1);

      // Advance to completion (another 0.6s -> total 1.1s > 1.0s)
      ramp.update(0.6);
      expect(ramp.isTransporting).toBe(false);
      expect(exitCb).toHaveBeenCalledWith(ramp, pinball);

      // Check exit position and velocity
      const exitPoint = ramp.curve.getPoint(1.0);
      expect(pinball.body.position.x).toBeCloseTo(exitPoint.x, 1);
      expect(pinball.body.position.y).toBeCloseTo(exitPoint.y, 1);
      expect(pinball.body.velocity.y).toBeLessThan(0); // Ejected downward/outward into playfield
    });
  });

  describe('DropTarget & DropTargetBank (P1.6 - Issue #14)', () => {
    it('creates 3 Booster drop targets with alien styling and static collision bodies', () => {
      const bank = new DropTargetBank({
        id: 'booster-targets',
        configs: TABLE_LAYOUT.DROP_TARGETS.BOOSTER,
        material: physicsWorld.wallMaterial,
      });

      expect(bank.targets.length).toBe(3);
      expect(bank.isAllDropped()).toBe(false);
      expect(bank.getDroppedCount()).toBe(0);

      for (const target of bank.targets) {
        expect(target.mesh).toBeInstanceOf(THREE.Group);
        expect(target.body).toBeInstanceOf(CANNON.Body);
        expect(target.isDropped).toBe(false);
      }
    });

    it('drops target on ball contact and lowers collision body below playfield', () => {
      const bank = new DropTargetBank({
        id: 'booster-targets',
        configs: TABLE_LAYOUT.DROP_TARGETS.BOOSTER,
        material: physicsWorld.wallMaterial,
      });

      const target0 = bank.targets[0];
      const hitCb = vi.fn();
      target0.onHit = hitCb;

      pinball.body.position.set(target0.position.x, target0.position.y, BALL.RADIUS);
      const pts = target0.handleBallContact(pinball);

      expect(pts).toBeGreaterThan(0);
      expect(target0.isDropped).toBe(true);
      expect(hitCb).toHaveBeenCalledWith(target0);
      // When dropped, body should be lowered below table surface
      expect(target0.body.position.z).toBeLessThan(0);
    });

    it('bank clear detection triggers onBankCleared callback and resets targets', () => {
      const bank = new DropTargetBank({
        id: 'booster-targets',
        configs: TABLE_LAYOUT.DROP_TARGETS.BOOSTER,
        material: physicsWorld.wallMaterial,
      });

      const bankClearCb = vi.fn();
      bank.onBankCleared = bankClearCb;

      expect(bank.isAllDropped()).toBe(false);

      // Hit targets 0 and 1
      bank.targets[0].handleBallContact(pinball);
      bank.targets[1].handleBallContact(pinball);
      expect(bank.isAllDropped()).toBe(false);
      expect(bankClearCb).not.toHaveBeenCalled();

      // Hit final target 2 -> Bank Cleared!
      bank.targets[2].handleBallContact(pinball);
      expect(bank.isAllDropped()).toBe(true);
      expect(bankClearCb).toHaveBeenCalledWith(bank);

      // Reset all targets
      bank.resetAll();
      expect(bank.isAllDropped()).toBe(false);
      expect(bank.getDroppedCount()).toBe(0);
      for (const t of bank.targets) {
        expect(t.isDropped).toBe(false);
        expect(t.body.position.z).toBeGreaterThanOrEqual(0.4);
      }
    });
  });

  describe('SpotTarget & SpotTargetBank (P1.7 - Issue #15)', () => {
    it('creates Mission (3), Medal (3), and Hazard (3 Left, 3 Right) spot target banks', () => {
      const missionBank = new SpotTargetBank({
        id: 'mission-targets',
        configs: TABLE_LAYOUT.SPOT_TARGETS.MISSION,
        material: physicsWorld.wallMaterial,
      });

      const medalBank = new SpotTargetBank({
        id: 'medal-targets',
        configs: TABLE_LAYOUT.SPOT_TARGETS.MEDAL,
        material: physicsWorld.wallMaterial,
      });

      const hazardLeftBank = new SpotTargetBank({
        id: 'hazard-left-targets',
        configs: TABLE_LAYOUT.SPOT_TARGETS.HAZARDS_LEFT,
        material: physicsWorld.wallMaterial,
      });

      const hazardRightBank = new SpotTargetBank({
        id: 'hazard-right-targets',
        configs: TABLE_LAYOUT.SPOT_TARGETS.HAZARDS_RIGHT,
        material: physicsWorld.wallMaterial,
      });

      expect(missionBank.targets.length).toBe(3);
      expect(medalBank.targets.length).toBe(3);
      expect(hazardLeftBank.targets.length).toBe(3);
      expect(hazardRightBank.targets.length).toBe(3);
    });

    it('registers ball contact on spot target, applies rebound, lights up, and fires onHit callback', () => {
      const bank = new SpotTargetBank({
        id: 'mission-targets',
        configs: TABLE_LAYOUT.SPOT_TARGETS.MISSION,
        material: physicsWorld.wallMaterial,
      });

      const target = bank.targets[0];
      const hitCb = vi.fn();
      target.onHit = hitCb;

      expect(target.isLit).toBe(false);

      pinball.body.position.set(target.position.x, target.position.y - 0.5, BALL.RADIUS);
      pinball.body.velocity.set(0, 10, 0);

      const pts = target.handleBallContact(pinball);

      expect(pts).toBeGreaterThan(0);
      expect(target.isLit).toBe(true);
      expect(hitCb).toHaveBeenCalledWith(target, pts);
      // Rebound should reverse or deflect velocity
      expect(pinball.body.velocity.y).toBeLessThan(0);
    });

    it('SpotTargetBank tracks completion and invokes onBankComplete when all targets are lit', () => {
      const bank = new SpotTargetBank({
        id: 'medal-targets',
        configs: TABLE_LAYOUT.SPOT_TARGETS.MEDAL,
        material: physicsWorld.wallMaterial,
      });

      const completeCb = vi.fn();
      bank.onBankComplete = completeCb;

      expect(bank.isAllLit()).toBe(false);

      bank.targets[0].setLit(true);
      bank.targets[1].setLit(true);
      expect(bank.isAllLit()).toBe(false);

      bank.targets[2].handleBallContact(pinball);
      expect(bank.isAllLit()).toBe(true);
      expect(completeCb).toHaveBeenCalledWith(bank);
    });
  });

  describe('UfoBeamSinkHole (P1.8 - Issue #16)', () => {
    it('creates 3 UFO Beams with 3D UFO hover mesh, glowing vortex ring, and beam cylinder', () => {
      const yellowBeam = new UfoBeamSinkHole({
        id: 'ufo-beam-yellow',
        config: TABLE_LAYOUT.UFO_BEAMS.YELLOW,
      });

      const redBeam = new UfoBeamSinkHole({
        id: 'ufo-beam-red',
        config: TABLE_LAYOUT.UFO_BEAMS.RED,
      });

      const greenBeam = new UfoBeamSinkHole({
        id: 'ufo-beam-green',
        config: TABLE_LAYOUT.UFO_BEAMS.GREEN,
      });

      expect(yellowBeam.beamColor).toBe(COLORS.NEON_YELLOW);
      expect(redBeam.beamColor).toBe(COLORS.NEON_PINK);
      expect(greenBeam.beamColor).toBe(COLORS.NEON_GREEN);

      expect(yellowBeam.mesh).toBeInstanceOf(THREE.Group);
      expect(yellowBeam.ufoMesh).toBeInstanceOf(THREE.Group);
      expect(yellowBeam.vortexMesh).toBeInstanceOf(THREE.Mesh);
      expect(yellowBeam.isHolding).toBe(false);
    });

    it('captures ball on entry, holds for 1s, and ejects from kicker with outward velocity', () => {
      const beam = new UfoBeamSinkHole({
        id: 'ufo-beam-yellow',
        config: TABLE_LAYOUT.UFO_BEAMS.YELLOW,
        holdDuration: 1.0,
      });

      const captureCb = vi.fn();
      const ejectCb = vi.fn();
      beam.onCapture = captureCb;
      beam.onBallEjected = ejectCb;

      // Ball enters capture radius
      pinball.body.position.set(
        TABLE_LAYOUT.UFO_BEAMS.YELLOW.position.x,
        TABLE_LAYOUT.UFO_BEAMS.YELLOW.position.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(3, 4, 0);

      const captured = beam.checkCapture(pinball);
      expect(captured).toBe(true);
      expect(beam.isHolding).toBe(true);
      expect(captureCb).toHaveBeenCalledWith(beam, pinball);

      // Ball is immobilized during hold
      expect(pinball.body.velocity.x).toBe(0);
      expect(pinball.body.velocity.y).toBe(0);

      // Step time by 0.5s -> still holding
      beam.update(0.5);
      expect(beam.isHolding).toBe(true);
      expect(ejectCb).not.toHaveBeenCalled();

      // Step time by 0.6s -> total 1.1s > 1.0s hold -> EJECT!
      beam.update(0.6);
      expect(beam.isHolding).toBe(false);
      expect(ejectCb).toHaveBeenCalledWith(beam, pinball);

      // Ball should have non-zero outward velocity in the eject direction
      const speed = Math.hypot(pinball.body.velocity.x, pinball.body.velocity.y);
      expect(speed).toBeGreaterThan(10);
    });
  });

  describe('AlienSpinner (P1.9 - Issue #17)', () => {
    it('creates Left and Right alien disc spinners with 3D disc mesh on metallic axle', () => {
      const leftSpinner = new AlienSpinner({
        id: 'spinner-left',
        config: TABLE_LAYOUT.SPINNERS.LEFT,
      });

      const rightSpinner = new AlienSpinner({
        id: 'spinner-right',
        config: TABLE_LAYOUT.SPINNERS.RIGHT,
      });

      expect(leftSpinner.mesh).toBeInstanceOf(THREE.Group);
      expect(leftSpinner.discMesh).toBeInstanceOf(THREE.Mesh);
      expect(leftSpinner.axleMesh).toBeInstanceOf(THREE.Mesh);
      expect(leftSpinner.angularVelocity).toBe(0);
      expect(leftSpinner.totalSpins).toBe(0);
      expect(leftSpinner.isBoosted).toBe(false);

      expect(rightSpinner.mesh).toBeInstanceOf(THREE.Group);
    });

    it('spins on ball contact, counts revolutions, triggers onSpin callback, and decays with angular friction', () => {
      const spinner = new AlienSpinner({
        id: 'spinner-left',
        config: TABLE_LAYOUT.SPINNERS.LEFT,
      });

      const spinCb = vi.fn();
      spinner.onSpin = spinCb;

      pinball.body.position.set(
        TABLE_LAYOUT.SPINNERS.LEFT.position.x,
        TABLE_LAYOUT.SPINNERS.LEFT.position.y,
        BALL.RADIUS
      );
      pinball.body.velocity.set(0, 15, 0);

      const spun = spinner.handleBallContact(pinball);
      expect(spun).toBe(true);
      expect(spinner.angularVelocity).toBeGreaterThan(20);

      // Simulate rotations across frames
      const initialVel = spinner.angularVelocity;
      spinner.update(0.1);

      expect(spinner.totalSpins).toBeGreaterThanOrEqual(0);
      expect(spinner.discMesh.rotation.x).not.toBe(0);
      expect(spinner.angularVelocity).toBeLessThan(initialVel); // Decayed by friction

      // Run multiple frames until several full revolutions complete
      for (let i = 0; i < 20; i++) {
        spinner.update(0.05);
      }
      expect(spinCb).toHaveBeenCalled();
      expect(spinner.totalSpins).toBeGreaterThan(0);
    });

    it('supports 10x spinner point boost when upgraded by Booster Target clear', () => {
      const spinner = new AlienSpinner({
        id: 'spinner-left',
        config: TABLE_LAYOUT.SPINNERS.LEFT,
      });

      expect(spinner.getPointValue()).toBe(100);

      spinner.setBoosted(true);
      expect(spinner.isBoosted).toBe(true);
      expect(spinner.getPointValue()).toBe(1000);

      spinner.setBoosted(false);
      expect(spinner.isBoosted).toBe(false);
      expect(spinner.getPointValue()).toBe(100);
    });
  });

  describe('SpaceWarpRollover (P1.10 - Issue #18)', () => {
    it('creates Space Warp rollover switch on right side with neon glyph and light', () => {
      const warp = new SpaceWarpRollover({
        id: 'space-warp-rollover',
        config: TABLE_LAYOUT.SPACE_WARP,
      });

      expect(warp.id).toBe('space-warp-rollover');
      expect(warp.mesh).toBeInstanceOf(THREE.Group);
      expect(warp.light).toBeDefined();
    });

    it('detects ball pass-through and fires onWarp event with points award', () => {
      const warp = new SpaceWarpRollover({
        id: 'space-warp-rollover',
        config: TABLE_LAYOUT.SPACE_WARP,
      });

      const warpCb = vi.fn();
      warp.onWarp = warpCb;

      pinball.body.position.set(
        TABLE_LAYOUT.SPACE_WARP.position.x,
        TABLE_LAYOUT.SPACE_WARP.position.y,
        BALL.RADIUS
      );

      const triggered = warp.checkRollover(pinball);
      expect(triggered).toBe(true);
      expect(warpCb).toHaveBeenCalledWith(warp);
    });
  });
});
