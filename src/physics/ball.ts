import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BALL, COLORS } from '../utils/constants';

export interface PinballOptions {
  material?: CANNON.Material;
  initialPosition?: { x: number; y: number; z: number };
}

/**
 * Pinball encapsulates the Three.js visual chrome mesh and Cannon-es dynamic rigid body.
 */
export class Pinball {
  public mesh: THREE.Mesh;
  public body: CANNON.Body;
  public material: THREE.MeshStandardMaterial;

  constructor(options?: PinballOptions) {
    // 1. Create Three.js Chrome Sphere Mesh
    const geom = new THREE.SphereGeometry(BALL.RADIUS, 32, 32);
    this.material = new THREE.MeshStandardMaterial({
      color: COLORS.CHROME_BALL,
      metalness: 0.95,
      roughness: 0.05,
    });
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'pinball';

    // 2. Create Cannon-es Dynamic Rigid Body
    const shape = new CANNON.Sphere(BALL.RADIUS);
    this.body = new CANNON.Body({
      mass: BALL.MASS,
      shape: shape,
      material: options?.material,
      linearDamping: BALL.LINEAR_DAMPING,
      angularDamping: BALL.ANGULAR_DAMPING,
    });

    const initPos = options?.initialPosition ?? BALL.INITIAL_POSITION;
    this.body.position.set(initPos.x, initPos.y, initPos.z);

    // Initial position sync
    this.sync();
  }

  /**
   * Synchronizes the Three.js mesh transform with Cannon-es physics body.
   */
  public sync(): void {
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y,
      this.body.position.z
    );
    this.mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w
    );
  }

  /**
   * Clamps the linear velocity to BALL.MAX_VELOCITY to prevent physics tunneling.
   */
  public clampVelocity(maxSpeed: number = BALL.MAX_VELOCITY): void {
    const speed = this.body.velocity.length();
    if (speed > maxSpeed && speed > 0) {
      const scale = maxSpeed / speed;
      this.body.velocity.x *= scale;
      this.body.velocity.y *= scale;
      this.body.velocity.z *= scale;
    }
  }

  /**
   * Resets position and zeroes out linear and angular velocities.
   */
  public reset(pos: { x: number; y: number; z: number } = BALL.INITIAL_POSITION): void {
    this.body.position.set(pos.x, pos.y, pos.z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.body.quaternion.set(0, 0, 0, 1);
    this.sync();
  }

  /**
   * Applies an impulse force to the pinball center or specified point.
   */
  public applyImpulse(
    impulse: CANNON.Vec3 | { x: number; y: number; z: number },
    worldPoint?: CANNON.Vec3
  ): void {
    const cannonImpulse =
      impulse instanceof CANNON.Vec3
        ? impulse
        : new CANNON.Vec3(impulse.x, impulse.y, impulse.z);
    const point = worldPoint ?? this.body.position;
    this.body.applyImpulse(cannonImpulse, point);
  }
}
