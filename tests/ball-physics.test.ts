import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { BALL, TABLE, PHYSICS, COLORS } from '../src/utils/constants';

describe('Pinball & Physics World (P0.3 & P0.4)', () => {
  let physicsWorld: PhysicsWorld;
  let pinball: Pinball;

  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
    pinball = new Pinball({ material: physicsWorld.ballMaterial });
  });

  describe('Pinball Class (P0.3)', () => {
    it('creates chrome sphere mesh with correct visual properties', () => {
      expect(pinball.mesh).toBeInstanceOf(THREE.Mesh);
      expect(pinball.mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);

      const geom = pinball.mesh.geometry as THREE.SphereGeometry;
      expect(geom.parameters.radius).toBeCloseTo(BALL.RADIUS, 3);

      const mat = pinball.mesh.material as THREE.MeshStandardMaterial;
      expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(mat.metalness).toBeCloseTo(0.95, 2);
      expect(mat.roughness).toBeCloseTo(0.05, 2);
      expect(mat.color.getHex()).toBe(COLORS.CHROME_BALL);
    });

    it('creates dynamic Cannon-es sphere body with correct mass, radius and damping', () => {
      expect(pinball.body).toBeInstanceOf(CANNON.Body);
      expect(pinball.body.mass).toBe(BALL.MASS);
      expect(pinball.body.type).toBe(CANNON.Body.DYNAMIC);
      expect(pinball.body.linearDamping).toBeCloseTo(BALL.LINEAR_DAMPING, 3);
      expect(pinball.body.angularDamping).toBeCloseTo(BALL.ANGULAR_DAMPING, 3);

      const shape = pinball.body.shapes[0] as CANNON.Sphere;
      expect(shape).toBeInstanceOf(CANNON.Sphere);
      expect(shape.radius).toBeCloseTo(BALL.RADIUS, 3);
    });

    it('synchronizes Three.js mesh position and quaternion from physics body', () => {
      pinball.body.position.set(3, 5, 0.5);
      pinball.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 4);

      pinball.sync();

      expect(pinball.mesh.position.x).toBeCloseTo(3, 3);
      expect(pinball.mesh.position.y).toBeCloseTo(5, 3);
      expect(pinball.mesh.position.z).toBeCloseTo(0.5, 3);

      expect(pinball.mesh.quaternion.x).toBeCloseTo(pinball.body.quaternion.x, 3);
      expect(pinball.mesh.quaternion.y).toBeCloseTo(pinball.body.quaternion.y, 3);
      expect(pinball.mesh.quaternion.z).toBeCloseTo(pinball.body.quaternion.z, 3);
      expect(pinball.mesh.quaternion.w).toBeCloseTo(pinball.body.quaternion.w, 3);
    });

    it('resets ball position and zeroes out linear and angular velocities', () => {
      pinball.body.position.set(0, 10, 0.5);
      pinball.body.velocity.set(15, -20, 5);
      pinball.body.angularVelocity.set(2, 4, 1);

      pinball.reset();

      expect(pinball.body.position.x).toBeCloseTo(BALL.INITIAL_POSITION.x, 3);
      expect(pinball.body.position.y).toBeCloseTo(BALL.INITIAL_POSITION.y, 3);
      expect(pinball.body.position.z).toBeCloseTo(BALL.INITIAL_POSITION.z, 3);
      expect(pinball.body.velocity.length()).toBe(0);
      expect(pinball.body.angularVelocity.length()).toBe(0);
      expect(pinball.mesh.position.x).toBeCloseTo(BALL.INITIAL_POSITION.x, 3);
    });

    it('clamps velocity to maximum threshold', () => {
      const maxVel = PHYSICS.BALL_MAX_VELOCITY;
      pinball.body.velocity.set(100, 100, 0); // Speed ~ 141.4 > 50
      expect(pinball.body.velocity.length()).toBeGreaterThan(maxVel);

      pinball.clampVelocity();
      expect(pinball.body.velocity.length()).toBeCloseTo(maxVel, 2);
    });
  });

  describe('PhysicsWorld Setup & Boundaries (P0.4)', () => {
    it('configures world with inclined gravity vector', () => {
      const expectedGy = -PHYSICS.GRAVITY_MAGNITUDE * Math.sin(PHYSICS.TABLE_TILT_RAD);
      const expectedGz = -PHYSICS.GRAVITY_MAGNITUDE * Math.cos(PHYSICS.TABLE_TILT_RAD);

      expect(physicsWorld.world.gravity.x).toBe(0);
      expect(physicsWorld.world.gravity.y).toBeCloseTo(expectedGy, 3);
      expect(physicsWorld.world.gravity.z).toBeCloseTo(expectedGz, 3);
    });

    it('creates materials and contact materials for ball, walls, and table', () => {
      expect(physicsWorld.ballMaterial).toBeInstanceOf(CANNON.Material);
      expect(physicsWorld.wallMaterial).toBeInstanceOf(CANNON.Material);
      expect(physicsWorld.tableMaterial).toBeInstanceOf(CANNON.Material);
      expect(physicsWorld.world.contactmaterials.length).toBeGreaterThanOrEqual(2);
    });

    it('initializes table boundaries (playfield plane, left/right walls, top wall, plunger separator)', () => {
      const bodies = physicsWorld.world.bodies;
      expect(bodies.length).toBeGreaterThanOrEqual(5);

      // Verify all boundary bodies are static (mass === 0)
      const staticBodies = bodies.filter((b) => b.mass === 0);
      expect(staticBodies.length).toBeGreaterThanOrEqual(5);

      // Check left wall exists near x = -TABLE.WIDTH / 2
      const leftWall = bodies.find((b) => b.position.x < -TABLE.WIDTH / 2 + 0.5 && Math.abs(b.position.y) < 2);
      expect(leftWall).toBeDefined();

      // Check right wall exists near x = TABLE.WIDTH / 2
      const rightWall = bodies.find((b) => b.position.x > TABLE.WIDTH / 2 - 0.5 && Math.abs(b.position.y) < 2);
      expect(rightWall).toBeDefined();

      // Check top wall exists near y = TABLE.LENGTH / 2
      const topWall = bodies.find((b) => b.position.y > TABLE.LENGTH / 2 - 0.5);
      expect(topWall).toBeDefined();

      // Check plunger separator wall exists
      const plungerWall = bodies.find((b) => b.position.x > 5 && b.position.x < 9 && Math.abs(b.position.y) < 10);
      expect(plungerWall).toBeDefined();
    });
  });

  describe('Ball Physical Simulation (P0.4)', () => {
    it('moves ball down -Y when stepped due to inclined gravity', () => {
      physicsWorld.addPinball(pinball);
      pinball.body.position.set(0, 0, BALL.RADIUS);
      pinball.body.velocity.set(0, 0, 0);

      const initialY = pinball.body.position.y;

      // Step physics for 30 frames (0.5s)
      for (let i = 0; i < 30; i++) {
        physicsWorld.step(1 / 60);
      }

      expect(pinball.body.position.y).toBeLessThan(initialY);
      // Ball should stay on or near table plane (z ~ BALL.RADIUS)
      expect(pinball.body.position.z).toBeCloseTo(BALL.RADIUS, 1);
    });

    it('bounces ball off top wall with restitution when launched upwards', () => {
      physicsWorld.addPinball(pinball);
      // Position ball just below top wall moving up at 20 units/s
      pinball.body.position.set(0, 15, BALL.RADIUS);
      pinball.body.velocity.set(0, 20, 0);

      let bounced = false;
      // Step simulation until ball hits top wall and deflects back
      for (let i = 0; i < 60; i++) {
        physicsWorld.step(1 / 60);
        if (pinball.body.velocity.y < 0 && pinball.body.position.y > 18) {
          bounced = true;
          break;
        }
      }

      expect(bounced).toBe(true);
      // Ball should have reversed direction in Y
      expect(pinball.body.velocity.y).toBeLessThan(0);
    });

    it('bounces ball off left side wall when moving horizontally left', () => {
      physicsWorld.addPinball(pinball);
      // Position ball moving left at 15 units/s towards left wall (x = -10)
      pinball.body.position.set(-5, 0, BALL.RADIUS);
      pinball.body.velocity.set(-15, 0, 0);

      let bounced = false;
      for (let i = 0; i < 60; i++) {
        physicsWorld.step(1 / 60);
        if (pinball.body.velocity.x > 0 && pinball.body.position.x < -8) {
          bounced = true;
          break;
        }
      }

      expect(bounced).toBe(true);
      expect(pinball.body.velocity.x).toBeGreaterThan(0);
    });

    it('bounces ball off plunger separator wall when moving from center playfield', () => {
      physicsWorld.addPinball(pinball);
      // Position ball moving right at 15 units/s towards plunger lane separator (x = 7.6)
      pinball.body.position.set(4, 0, BALL.RADIUS);
      pinball.body.velocity.set(15, 0, 0);

      let bounced = false;
      for (let i = 0; i < 60; i++) {
        physicsWorld.step(1 / 60);
        if (pinball.body.velocity.x < 0 && pinball.body.position.x > 6) {
          bounced = true;
          break;
        }
      }

      expect(bounced).toBe(true);
      expect(pinball.body.velocity.x).toBeLessThan(0);
    });
  });
});
