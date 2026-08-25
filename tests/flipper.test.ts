import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Flipper } from '../src/physics/flipper';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { FLIPPER, BALL } from '../src/utils/constants';

describe('Flipper & Flipper-Ball Interaction (P0.5 & P0.6)', () => {
  let physicsWorld: PhysicsWorld;
  let leftFlipper: Flipper;
  let rightFlipper: Flipper;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
    leftFlipper = new Flipper({
      side: 'left',
      material: physicsWorld.wallMaterial,
    });
    rightFlipper = new Flipper({
      side: 'right',
      material: physicsWorld.wallMaterial,
    });
  });

  describe('Flipper Initialization (P0.5)', () => {
    it('initializes left flipper with Three.js visual mesh and Cannon-es kinematic body', () => {
      expect(leftFlipper.mesh).toBeDefined();
      expect(leftFlipper.mesh).toBeInstanceOf(THREE.Object3D);
      expect(leftFlipper.body).toBeInstanceOf(CANNON.Body);
      expect(leftFlipper.body.type).toBe(CANNON.Body.KINEMATIC);

      expect(leftFlipper.body.position.x).toBeCloseTo(FLIPPER.LEFT_POSITION.x, 3);
      expect(leftFlipper.body.position.y).toBeCloseTo(FLIPPER.LEFT_POSITION.y, 3);
      expect(leftFlipper.body.position.z).toBeCloseTo(FLIPPER.LEFT_POSITION.z, 3);
    });

    it('initializes right flipper at right position', () => {
      expect(rightFlipper.body.position.x).toBeCloseTo(FLIPPER.RIGHT_POSITION.x, 3);
      expect(rightFlipper.body.position.y).toBeCloseTo(FLIPPER.RIGHT_POSITION.y, 3);
      expect(rightFlipper.body.position.z).toBeCloseTo(FLIPPER.RIGHT_POSITION.z, 3);
    });

    it('contains bat mesh with gunmetal material and neon accent trim', () => {
      expect(leftFlipper.batMesh).toBeDefined();
      expect(leftFlipper.batMesh.material).toBeInstanceOf(THREE.Material);
      expect(leftFlipper.trimMesh).toBeDefined();
    });
  });

  describe('Flipper Arc Rotation & Angles (P0.5)', () => {
    it('initializes left flipper at rest angle (-30 deg / -0.5236 rad)', () => {
      const expectedRestRad = (-FLIPPER.REST_ANGLE_DEG * Math.PI) / 180;
      expect(leftFlipper.currentAngle).toBeCloseTo(expectedRestRad, 3);
      expect(leftFlipper.restAngle).toBeCloseTo(expectedRestRad, 3);
      expect(leftFlipper.isActivated).toBe(false);
    });

    it('rotates left flipper to up angle (+20 deg / +0.3491 rad) when activate() is called', () => {
      const expectedUpRad = ((-FLIPPER.REST_ANGLE_DEG + FLIPPER.STROKE_ANGLE_DEG) * Math.PI) / 180;
      expect(leftFlipper.upAngle).toBeCloseTo(expectedUpRad, 3);

      leftFlipper.activate();
      expect(leftFlipper.isActivated).toBe(true);

      // Step rotation over time (50 deg at 40 rad/s takes ~0.022s)
      for (let i = 0; i < 5; i++) {
        leftFlipper.update(1 / 60);
      }

      expect(leftFlipper.currentAngle).toBeCloseTo(leftFlipper.upAngle, 3);
      expect(leftFlipper.body.angularVelocity.z).toBeCloseTo(0, 3);
    });

    it('returns left flipper to rest angle when deactivate() is called', () => {
      leftFlipper.activate();
      for (let i = 0; i < 5; i++) {
        leftFlipper.update(1 / 60);
      }
      expect(leftFlipper.currentAngle).toBeCloseTo(leftFlipper.upAngle, 3);

      leftFlipper.deactivate();
      expect(leftFlipper.isActivated).toBe(false);

      // Step return over time (at 25 rad/s takes ~0.035s)
      for (let i = 0; i < 5; i++) {
        leftFlipper.update(1 / 60);
      }

      expect(leftFlipper.currentAngle).toBeCloseTo(leftFlipper.restAngle, 3);
      expect(leftFlipper.body.angularVelocity.z).toBeCloseTo(0, 3);
    });

    it('mirrors right flipper angles symmetrically', () => {
      // Left rest: -30 deg -> Right rest: -150 deg (-5pi/6 rad)
      const expectedRightRestRad = (-180 + FLIPPER.REST_ANGLE_DEG) * (Math.PI / 180);
      const expectedRightUpRad = (-180 + FLIPPER.REST_ANGLE_DEG - FLIPPER.STROKE_ANGLE_DEG) * (Math.PI / 180);

      expect(rightFlipper.restAngle).toBeCloseTo(expectedRightRestRad, 3);
      expect(rightFlipper.upAngle).toBeCloseTo(expectedRightUpRad, 3);
      expect(rightFlipper.currentAngle).toBeCloseTo(expectedRightRestRad, 3);

      rightFlipper.activate();
      for (let i = 0; i < 5; i++) {
        rightFlipper.update(1 / 60);
      }
      expect(rightFlipper.currentAngle).toBeCloseTo(rightFlipper.upAngle, 3);

      rightFlipper.deactivate();
      for (let i = 0; i < 5; i++) {
        rightFlipper.update(1 / 60);
      }
      expect(rightFlipper.currentAngle).toBeCloseTo(rightFlipper.restAngle, 3);
    });

    it('calculates non-zero angular velocity during stroke motion', () => {
      leftFlipper.activate();
      // Step a tiny fraction of a frame to catch in-flight angular velocity
      leftFlipper.update(0.005);
      expect(leftFlipper.body.angularVelocity.z).toBeCloseTo(FLIPPER.ANGULAR_VELOCITY, 1);

      rightFlipper.activate();
      rightFlipper.update(0.005);
      expect(rightFlipper.body.angularVelocity.z).toBeCloseTo(-FLIPPER.ANGULAR_VELOCITY, 1);
    });

    it('synchronizes Three.js mesh transform with Cannon-es body', () => {
      leftFlipper.activate();
      leftFlipper.update(1 / 60);

      expect(leftFlipper.mesh.position.x).toBeCloseTo(leftFlipper.body.position.x, 3);
      expect(leftFlipper.mesh.position.y).toBeCloseTo(leftFlipper.body.position.y, 3);
      expect(leftFlipper.mesh.position.z).toBeCloseTo(leftFlipper.body.position.z, 3);

      expect(leftFlipper.mesh.quaternion.z).toBeCloseTo(leftFlipper.body.quaternion.z, 3);
      expect(leftFlipper.mesh.quaternion.w).toBeCloseTo(leftFlipper.body.quaternion.w, 3);
    });
  });

  describe('Flipper-Ball Physical Interaction (P0.6)', () => {
    it('deflects ball upward with positive Y impulse when left flipper hits ball', () => {
      physicsWorld.addBody(leftFlipper.body);

      // Create ball positioned right above left flipper blade
      const pinball = new Pinball({
        material: physicsWorld.ballMaterial,
        initialPosition: { x: -2.0, y: -15.5, z: BALL.RADIUS },
      });
      physicsWorld.addPinball(pinball);

      // Ball initially falling or stationary
      pinball.body.velocity.set(0, -5, 0);

      // Activate flipper right before collision
      leftFlipper.activate();

      let hitDetected = false;
      for (let i = 0; i < 30; i++) {
        leftFlipper.update(1 / 60);
        physicsWorld.step(1 / 60);

        // If ball velocity becomes positive in Y after being below -15, flipper transferred impulse
        if (pinball.body.velocity.y > 5) {
          hitDetected = true;
          break;
        }
      }

      expect(hitDetected).toBe(true);
      expect(pinball.body.velocity.y).toBeGreaterThan(0);
      expect(pinball.body.position.y).toBeGreaterThan(-16);
    });

    it('deflects ball upward with positive Y impulse when right flipper hits ball', () => {
      physicsWorld.addBody(rightFlipper.body);

      // Create ball positioned right above right flipper blade
      const pinball = new Pinball({
        material: physicsWorld.ballMaterial,
        initialPosition: { x: 2.0, y: -15.5, z: BALL.RADIUS },
      });
      physicsWorld.addPinball(pinball);

      pinball.body.velocity.set(0, -5, 0);

      rightFlipper.activate();

      let hitDetected = false;
      for (let i = 0; i < 30; i++) {
        rightFlipper.update(1 / 60);
        physicsWorld.step(1 / 60);

        if (pinball.body.velocity.y > 5) {
          hitDetected = true;
          break;
        }
      }

      expect(hitDetected).toBe(true);
      expect(pinball.body.velocity.y).toBeGreaterThan(0);
      expect(pinball.body.position.y).toBeGreaterThan(-16);
    });
  });
});
