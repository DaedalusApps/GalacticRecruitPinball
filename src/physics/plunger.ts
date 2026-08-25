import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PLUNGER, BALL, COLORS } from '../utils/constants';
import { createNeonAccentMaterial } from '../rendering/materials';
import { Pinball } from './ball';

export interface PlungerOptions {
  position?: { x: number; y: number; z: number };
  minForce?: number;
  maxForce?: number;
  maxChargeTimeSec?: number;
  maxPullDistance?: number;
  material?: CANNON.Material;
}

/**
 * Helical 3D curve for procedural spring geometry generation.
 */
class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    public radius: number = 0.28,
    public height: number = 1.6,
    public turns: number = 6
  ) {
    super();
  }

  getPoint(t: number): THREE.Vector3 {
    const angle = t * this.turns * Math.PI * 2;
    const x = this.radius * Math.cos(angle);
    const z = this.radius * Math.sin(angle);
    const y = (t - 0.5) * this.height;
    return new THREE.Vector3(x, y, z);
  }
}

/**
 * Plunger encapsulates the railgun mechanical/spring assembly and Cannon-es launch physics.
 */
export class Plunger {
  public mesh: THREE.Group;
  public rodMesh: THREE.Mesh;
  public springMesh: THREE.Mesh;
  public tipMesh: THREE.Mesh;
  public housingMesh: THREE.Mesh;
  public body: CANNON.Body;

  public minForce: number;
  public maxForce: number;
  public maxChargeTimeSec: number;
  public maxPullDistance: number;

  public isCharging: boolean = false;
  public chargeRatio: number = 0; // 0.0 to 1.0
  public displacement: number = 0; // current pull-back distance along -Y
  public restPosition: { x: number; y: number; z: number };

  private snapSpeed: number = 80; // units/s return velocity upon release

  constructor(options?: PlungerOptions) {
    this.minForce = options?.minForce ?? PLUNGER.MIN_FORCE;
    this.maxForce = options?.maxForce ?? PLUNGER.MAX_FORCE;
    this.maxChargeTimeSec = options?.maxChargeTimeSec ?? PLUNGER.MAX_CHARGE_TIME_SEC;
    this.maxPullDistance = options?.maxPullDistance ?? 2.0;

    const posX = options?.position?.x ?? PLUNGER.LANE_X;
    const posY = options?.position?.y ?? -19.2;
    const posZ = options?.position?.z ?? 0.5;
    this.restPosition = { x: posX, y: posY, z: posZ };

    // 1. Create Three.js 3D Visual Mesh Assembly
    this.mesh = new THREE.Group();
    this.mesh.name = 'plunger';

    // (a) Plunger Central Railgun Rod
    const rodGeom = new THREE.CylinderGeometry(0.1, 0.1, 2.8, 16);
    // Align cylinder along Y axis
    rodGeom.rotateX(Math.PI / 2);
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0x3a404d,
      metalness: 0.9,
      roughness: 0.2,
    });
    this.rodMesh = new THREE.Mesh(rodGeom, rodMat);
    this.rodMesh.name = 'plunger-rod';
    this.rodMesh.castShadow = true;
    this.rodMesh.receiveShadow = true;
    this.mesh.add(this.rodMesh);

    // (b) Helical Coil Spring
    const helixCurve = new HelixCurve(0.25, 1.5, 6);
    const springGeom = new THREE.TubeGeometry(helixCurve, 64, 0.04, 8, false);
    const springMat = new THREE.MeshStandardMaterial({
      color: COLORS.NEON_CYAN,
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(COLORS.NEON_CYAN),
      emissiveIntensity: 0.3,
    });
    this.springMesh = new THREE.Mesh(springGeom, springMat);
    this.springMesh.name = 'plunger-spring';
    this.springMesh.castShadow = true;
    this.mesh.add(this.springMesh);

    // (c) Neon Tip / Piston Cap
    const tipGeom = new THREE.CylinderGeometry(0.42, 0.45, 0.25, 24);
    tipGeom.rotateX(Math.PI / 2);
    const tipMat = createNeonAccentMaterial(COLORS.NEON_GREEN);
    this.tipMesh = new THREE.Mesh(tipGeom, tipMat);
    this.tipMesh.name = 'plunger-tip';
    this.tipMesh.castShadow = true;
    this.mesh.add(this.tipMesh);

    // (d) Housing Guide Base
    const housingGeom = new THREE.BoxGeometry(1.2, 0.4, 0.6);
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x1f232b,
      metalness: 0.7,
      roughness: 0.4,
    });
    this.housingMesh = new THREE.Mesh(housingGeom, housingMat);
    this.housingMesh.name = 'plunger-housing';
    this.housingMesh.position.set(this.restPosition.x, this.restPosition.y - 1.2, this.restPosition.z);
    this.mesh.add(this.housingMesh);

    // 2. Create Cannon-es Physics Kinematic Body
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: options?.material,
    });
    const shape = new CANNON.Cylinder(0.45, 0.45, 0.3, 16);
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    this.body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
    this.body.position.set(this.restPosition.x, this.restPosition.y, this.restPosition.z);
    (this.body as unknown as { userData: { name: string } }).userData = {
      name: 'plunger',
    };

    // Initial transform sync
    this.sync();
  }

  /**
   * Starts charging the plunger spring (pulling it back).
   */
  public startCharge(): void {
    this.isCharging = true;
  }

  /**
   * Releases plunger spring and launches any ball situated in the plunger lane.
   * @param pinballs Optional single pinball or array of pinballs to check for launch
   * @returns Calculated launch force
   */
  public release(pinballs?: Pinball | Pinball[]): number {
    const launchForce = this.minForce + this.chargeRatio * (this.maxForce - this.minForce);

    if (pinballs) {
      const balls = Array.isArray(pinballs) ? pinballs : [pinballs];
      for (const ball of balls) {
        if (this.isBallInPlungerLane(ball)) {
          this.applyLaunchImpulse(ball, launchForce);
        }
      }
    }

    this.isCharging = false;
    this.chargeRatio = 0;
    return launchForce;
  }

  /**
   * Checks whether a pinball is positioned within the plunger lane launch zone.
   */
  public isBallInPlungerLane(ball: Pinball): boolean {
    const px = ball.body.position.x;
    const py = ball.body.position.y;
    // Plunger lane X boundaries: ~7.5 to 10.0
    // Launch zone Y boundaries: -19.8 to -15.5
    const inLaneX = px >= 7.5 && px <= 10.0;
    const inLaneY = py >= -19.8 && py <= -15.5;
    return inLaneX && inLaneY;
  }

  /**
   * Directly applies launch impulse to pinball.
   */
  public applyLaunchImpulse(ball: Pinball, force: number): void {
    // Ball mass is BALL.MASS (0.1 kg). Impulse = force * BALL.MASS
    // At force = 45, impulse = 4.5 N*s, delta_vy = 45 units/s.
    const impulseY = force * BALL.MASS;
    ball.body.velocity.set(0, 0, 0);
    ball.applyImpulse({ x: 0, y: impulseY, z: 0 });
  }

  /**
   * Updates plunger charge state, pull-back animation, snap release, and mesh transforms.
   */
  public update(deltaSec: number, _pinballs?: Pinball | Pinball[]): void {
    const dt = Math.max(0, deltaSec);

    if (this.isCharging) {
      this.chargeRatio = Math.min(1.0, this.chargeRatio + dt / this.maxChargeTimeSec);
      this.displacement = this.chargeRatio * this.maxPullDistance;
    } else {
      if (this.displacement > 0) {
        this.displacement = Math.max(0, this.displacement - this.snapSpeed * dt);
      }
    }

    this.body.position.set(
      this.restPosition.x,
      this.restPosition.y - this.displacement,
      this.restPosition.z
    );

    this.sync();
  }

  /**
   * Synchronizes Three.js visual parts (rod, spring compression, neon tip) with current displacement.
   */
  public sync(): void {
    const currentY = this.restPosition.y - this.displacement;

    // Tip position
    this.tipMesh.position.set(this.restPosition.x, currentY + 0.6, this.restPosition.z);

    // Rod position
    this.rodMesh.position.set(this.restPosition.x, currentY - 0.6, this.restPosition.z);

    // Spring position and compression scale
    const springCenterY = (this.restPosition.y - 1.2 + currentY + 0.5) / 2;
    this.springMesh.position.set(this.restPosition.x, springCenterY, this.restPosition.z);

    const compressionScale = Math.max(
      0.3,
      1.0 - (this.displacement / this.maxPullDistance) * 0.5
    );
    this.springMesh.scale.set(1, compressionScale, 1);
  }
}
