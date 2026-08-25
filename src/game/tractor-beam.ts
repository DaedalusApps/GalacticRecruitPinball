/**
 * Galactic Recruit Pinball - Mothership Tractor Beam / Gravity Well (P2.6)
 *
 * Implements the center playfield Mothership Tractor Beam:
 * - 3D Mothership UFO model hovering above the table
 * - Glowing neon vortex ring / gravity well disk on playfield surface
 * - Translucent tractor beam cylinder / cone with dynamic pulsing
 * - Magnetic inward gravitational pull on nearby pinballs (R <= 6.0)
 * - Center capture (distance <= 0.8), 1.2s hold duration, 50,000 pts bonus
 * - Forceful random upward ejection (v_y >= 18 u/s) and disarm until next activation.
 */

import * as THREE from 'three';
import { Pinball } from '../physics/ball';
import { Position3D } from '../table/layout';
import { COLORS, BALL } from '../utils/constants';
import { createMetallicTrimMaterial, createNeonAccentMaterial } from '../rendering/materials';

export interface MothershipTractorBeamOptions {
  id?: string;
  position?: Position3D;
  attractionRadius?: number;
  captureRadius?: number;
  pullForce?: number;
  holdDuration?: number;
  ejectSpeed?: number;
  score?: number;
  color?: number;
}

export class MothershipTractorBeam {
  public id: string;
  public position: Position3D;
  public attractionRadius: number;
  public captureRadius: number;
  public pullForce: number;
  public holdDuration: number;
  public ejectSpeed: number;
  public score: number;
  public color: number;

  public isActive: boolean = false;
  public isHolding: boolean = false;
  public holdTimer: number = 0;
  public heldBall: Pinball | null = null;

  // 3D Visual Mesh Hierarchy
  public mesh: THREE.Group;
  public ufoMesh: THREE.Group;
  public vortexMesh: THREE.Mesh;
  public beamMesh: THREE.Mesh;
  public vortexMaterial: THREE.MeshStandardMaterial;
  public beamMaterial: THREE.MeshStandardMaterial;
  public light: THREE.PointLight;

  // Event Callbacks
  public onActivated?: () => void;
  public onDeactivated?: () => void;
  public onCapture?: (pinball: Pinball, score: number) => void;
  public onEject?: (pinball: Pinball) => void;
  public onBallEjected?: (beam: MothershipTractorBeam, pinball: Pinball) => void;

  constructor(options: MothershipTractorBeamOptions = {}) {
    this.id = options.id ?? 'mothership-tractor-beam';
    this.position = options.position ?? { x: 0, y: 2.0, z: 0.5 };
    this.attractionRadius = options.attractionRadius ?? 6.0;
    this.captureRadius = options.captureRadius ?? 0.8;
    this.pullForce = options.pullForce ?? 25.0;
    this.holdDuration = options.holdDuration ?? 1.2;
    this.ejectSpeed = options.ejectSpeed ?? 20.0;
    this.score = options.score ?? 50000;
    this.color = options.color ?? COLORS.NEON_CYAN;

    // 1. Root Group
    this.mesh = new THREE.Group();
    this.mesh.name = this.id;
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // 2. Playfield Surface Glowing Vortex Ring
    const vortexGeom = new THREE.RingGeometry(0.2, this.captureRadius * 1.5, 32);
    this.vortexMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    this.vortexMesh = new THREE.Mesh(vortexGeom, this.vortexMaterial);
    this.vortexMesh.position.set(0, 0, 0.02);
    this.mesh.add(this.vortexMesh);

    // 3. Tractor Beam Translucent Cylinder / Cone
    const beamHeight = 3.2;
    const beamGeom = new THREE.CylinderGeometry(
      this.captureRadius * 1.2,
      this.captureRadius * 1.8,
      beamHeight,
      32,
      1,
      true
    );
    beamGeom.rotateX(Math.PI / 2);
    this.beamMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    this.beamMesh = new THREE.Mesh(beamGeom, this.beamMaterial);
    this.beamMesh.position.set(0, 0, beamHeight / 2);
    this.mesh.add(this.beamMesh);

    // 4. 3D Hovering Mothership UFO Model
    this.ufoMesh = this.createMothershipUfoMesh();
    this.ufoMesh.position.set(0, 0, beamHeight + 0.5);
    this.mesh.add(this.ufoMesh);

    // 5. Ambient glow point light
    this.light = new THREE.PointLight(this.color, 0.5, 8);
    this.light.position.set(0, 0, beamHeight / 2);
    this.mesh.add(this.light);
  }

  /**
   * Constructs the 3D Mothership UFO model with command dome, chrome hull,
   * glowing perimeter thrusters, and bottom beam emitter.
   */
  private createMothershipUfoMesh(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'mothership-ufo-body';

    const metallicMat = createMetallicTrimMaterial();
    const neonMat = createNeonAccentMaterial(this.color);
    const darkHullMat = new THREE.MeshStandardMaterial({
      color: 0x181e2b,
      metalness: 0.9,
      roughness: 0.25,
    });

    // (a) Main saucer disc hull
    const saucerGeom = new THREE.CylinderGeometry(1.6, 2.4, 0.45, 32);
    saucerGeom.rotateX(Math.PI / 2);
    const saucerMesh = new THREE.Mesh(saucerGeom, darkHullMat);
    saucerMesh.castShadow = true;
    group.add(saucerMesh);

    // (b) Metallic outer rim flange
    const rimGeom = new THREE.TorusGeometry(2.4, 0.1, 16, 32);
    const rimMesh = new THREE.Mesh(rimGeom, metallicMat);
    group.add(rimMesh);

    // (c) Top cockpit command dome
    const domeGeom = new THREE.SphereGeometry(0.9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeom.rotateX(Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeom, neonMat);
    domeMesh.position.set(0, 0, 0.22);
    group.add(domeMesh);

    // (d) Bottom tractor beam emitter lens
    const emitterGeom = new THREE.CylinderGeometry(0.8, 0.5, 0.2, 24);
    emitterGeom.rotateX(Math.PI / 2);
    const emitterMesh = new THREE.Mesh(emitterGeom, neonMat);
    emitterMesh.position.set(0, 0, -0.25);
    group.add(emitterMesh);

    // (e) Perimeter thruster indicator lights (8 surrounding lights)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const thrusterGeom = new THREE.SphereGeometry(0.12, 8, 8);
      const thrusterMesh = new THREE.Mesh(thrusterGeom, neonMat);
      thrusterMesh.position.set(
        Math.cos(angle) * 2.1,
        Math.sin(angle) * 2.1,
        0
      );
      group.add(thrusterMesh);
    }

    return group;
  }

  /**
   * Activates the Mothership Tractor Beam (Gravity Well).
   */
  public activate(): void {
    this.isActive = true;
    this.vortexMaterial.emissiveIntensity = 2.0;
    this.vortexMaterial.opacity = 0.9;
    this.beamMaterial.emissiveIntensity = 1.2;
    this.beamMaterial.opacity = 0.5;
    this.light.intensity = 2.5;

    if (this.onActivated) {
      this.onActivated();
    }
  }

  /**
   * Deactivates / disarms the Tractor Beam.
   */
  public deactivate(): void {
    this.isActive = false;
    this.vortexMaterial.emissiveIntensity = 0.4;
    this.vortexMaterial.opacity = 0.6;
    this.beamMaterial.emissiveIntensity = 0.3;
    this.beamMaterial.opacity = 0.2;
    this.light.intensity = 0.5;

    if (this.onDeactivated) {
      this.onDeactivated();
    }
  }

  /**
   * Checks if pinball is within capture radius to initiate magnetic trap.
   */
  public checkCapture(pinball: Pinball): boolean {
    if (!this.isActive || this.isHolding) return false;

    const dx = pinball.body.position.x - this.position.x;
    const dy = pinball.body.position.y - this.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= this.captureRadius) {
      this.captureBall(pinball);
      return true;
    }

    return false;
  }

  /**
   * Captures and immobilizes the pinball at the center of the gravity well.
   */
  public captureBall(pinball: Pinball): void {
    this.isHolding = true;
    this.holdTimer = 0;
    this.heldBall = pinball;

    // Zero out velocities and immobilize ball at center
    pinball.body.position.set(this.position.x, this.position.y, BALL.RADIUS);
    pinball.body.velocity.set(0, 0, 0);
    pinball.body.angularVelocity.set(0, 0, 0);
    pinball.sync();

    if (this.onCapture) {
      this.onCapture(pinball, this.score);
    }
  }

  /**
   * Applies magnetic gravitational pull towards the center attractor (0, 2.0)
   * on any active pinball within R <= attractionRadius.
   */
  public applyAttraction(deltaSec: number, pinball: Pinball): void {
    if (!this.isActive || this.isHolding) return;

    const dx = this.position.x - pinball.body.position.x;
    const dy = this.position.y - pinball.body.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.001 && dist <= this.attractionRadius) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Inward pull acceleration: increases as ball gets closer
      const proximityFactor = Math.max(0.2, 1.0 - dist / this.attractionRadius);
      const accel = this.pullForce * proximityFactor;

      pinball.body.velocity.x += nx * accel * deltaSec;
      pinball.body.velocity.y += ny * accel * deltaSec;

      pinball.applyImpulse({
        x: nx * accel * deltaSec * BALL.MASS,
        y: ny * accel * deltaSec * BALL.MASS,
        z: 0,
      });
    }
  }

  /**
   * Ejects trapped ball with random high-velocity upward launch (v_y >= 18 u/s)
   * and disarms the tractor beam until the next activation.
   */
  public ejectBall(): void {
    if (!this.heldBall) return;

    const ball = this.heldBall;
    this.heldBall = null;
    this.isHolding = false;
    this.holdTimer = 0;

    // Upward launch velocity (v_y >= 18) and random horizontal deflection
    const vy = Math.max(18.0, this.ejectSpeed + (Math.random() - 0.5) * 4.0);
    const vx = (Math.random() - 0.5) * 10.0;

    ball.body.velocity.set(vx, vy, 0);
    ball.applyImpulse({
      x: vx * BALL.MASS,
      y: vy * BALL.MASS,
      z: 0,
    });
    ball.sync();

    // Disarm until next activation
    this.deactivate();

    if (this.onEject) {
      this.onEject(ball);
    }
    if (this.onBallEjected) {
      this.onBallEjected(this, ball);
    }
  }

  /**
   * Per-frame update: visual animations, hold duration timer, gravitational attraction.
   */
  public update(deltaSec: number, pinball?: Pinball): void {
    // 1. Visual Animations
    const spinRate = this.isActive ? 2.5 : 0.5;
    this.ufoMesh.rotation.z += deltaSec * spinRate;
    this.vortexMesh.rotation.z -= deltaSec * (this.isActive ? 4.0 : 0.8);

    if (this.isActive) {
      const pulse = Math.sin(performance.now() * 0.008) * 0.2 + 0.8;
      this.beamMaterial.opacity = 0.3 * pulse + 0.2;
      this.vortexMaterial.emissiveIntensity = 1.5 * pulse + 0.5;
    }

    // 2. Physics & Ball Capture/Holding
    if (this.isHolding && this.heldBall) {
      // Keep trapped ball centered
      this.heldBall.body.position.set(this.position.x, this.position.y, BALL.RADIUS);
      this.heldBall.body.velocity.set(0, 0, 0);
      this.heldBall.sync();

      this.holdTimer += deltaSec;
      if (this.holdTimer >= this.holdDuration) {
        this.ejectBall();
      }
    } else if (this.isActive && pinball) {
      const captured = this.checkCapture(pinball);
      if (!captured) {
        this.applyAttraction(deltaSec, pinball);
      }
    }
  }
}
