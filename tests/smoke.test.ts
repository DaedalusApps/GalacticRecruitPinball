import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TABLE, PHYSICS, BALL, FLIPPER, BUMPERS, COLORS, GAME_RULES } from '../src/utils/constants';

describe('Galactic Recruit Pinball Foundation Smoke Tests', () => {
  it('initializes Three.js Scene, Camera, and Light instances properly', () => {
    const scene = new THREE.Scene();
    expect(scene).toBeInstanceOf(THREE.Scene);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, -32, 28);
    camera.lookAt(0, 0, 0);
    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(camera.position.z).toBe(28);

    const light = new THREE.AmbientLight(COLORS.BG_DARK);
    scene.add(light);
    expect(scene.children.length).toBe(1);
  });

  it('initializes Cannon-es World and calculates gravity components from table tilt', () => {
    const world = new CANNON.World();
    expect(world).toBeInstanceOf(CANNON.World);

    const tiltRad = PHYSICS.TABLE_TILT_RAD;
    const gy = -PHYSICS.GRAVITY_MAGNITUDE * Math.sin(tiltRad);
    const gz = -PHYSICS.GRAVITY_MAGNITUDE * Math.cos(tiltRad);

    world.gravity.set(0, gy, gz);
    expect(world.gravity.x).toBe(0);
    expect(world.gravity.y).toBeCloseTo(-9.81 * Math.sin((6.5 * Math.PI) / 180), 3);
    expect(world.gravity.z).toBeCloseTo(-9.81 * Math.cos((6.5 * Math.PI) / 180), 3);
  });

  it('steps Cannon-es physics simulation with a test rigid body', () => {
    const world = new CANNON.World();
    world.gravity.set(0, -9.81, 0);

    const sphereShape = new CANNON.Sphere(BALL.RADIUS);
    const sphereBody = new CANNON.Body({
      mass: BALL.MASS,
      shape: sphereShape,
      position: new CANNON.Vec3(0, 10, 0),
    });
    world.addBody(sphereBody);

    expect(sphereBody.position.y).toBe(10);
    world.step(1 / 60, 1 / 60, 3);
    expect(sphereBody.position.y).toBeLessThan(10);
  });

  it('has consistent physics and table tuning constants', () => {
    expect(TABLE.WIDTH).toBeGreaterThan(0);
    expect(TABLE.LENGTH).toBeGreaterThan(TABLE.WIDTH);
    expect(BALL.RADIUS).toBeGreaterThan(0);
    expect(BALL.MASS).toBeGreaterThan(0);
    expect(FLIPPER.LENGTH).toBeGreaterThan(0);
    expect(BUMPERS.RADIUS).toBeGreaterThan(0);
    expect(GAME_RULES.INITIAL_BALLS).toBe(3);
    expect(GAME_RULES.MAX_RANKS).toBe(9);
    expect(GAME_RULES.TOTAL_PROGRESS_LIGHTS).toBe(18);
  });
});
