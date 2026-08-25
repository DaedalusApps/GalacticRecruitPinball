import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FLIPPER, COLORS } from '../utils/constants';
import { createNeonAccentMaterial } from '../rendering/materials';

export type FlipperSide = 'left' | 'right' | 'upper-left';

export interface FlipperOptions {
  side: FlipperSide;
  position?: { x: number; y: number; z: number };
  material?: CANNON.Material;
  strokeSpeed?: number;
  returnSpeed?: number;
}

/**
 * Flipper encapsulates the Three.js visual bat mesh and Cannon-es kinematic physics body
 * for left, right, and upper flippers with angular velocity integration.
 */
export class Flipper {
  public side: FlipperSide;
  public mesh: THREE.Group;
  public batMesh: THREE.Mesh;
  public trimMesh: THREE.Mesh;
  public body: CANNON.Body;

  public isActivated: boolean = false;
  public currentAngle: number = 0;
  public restAngle: number = 0;
  public upAngle: number = 0;
  public strokeSpeed: number;
  public returnSpeed: number;

  constructor(options: FlipperOptions) {
    this.side = options.side;
    this.strokeSpeed = options.strokeSpeed ?? FLIPPER.ANGULAR_VELOCITY;
    this.returnSpeed = options.returnSpeed ?? FLIPPER.RETURN_ANGULAR_VELOCITY;

    // 1. Calculate Rest & Up Angles in Radians
    const restDeg = FLIPPER.REST_ANGLE_DEG;
    const strokeDeg = FLIPPER.STROKE_ANGLE_DEG;

    if (this.side === 'left' || this.side === 'upper-left') {
      this.restAngle = (-restDeg * Math.PI) / 180;
      this.upAngle = ((-restDeg + strokeDeg) * Math.PI) / 180;
    } else {
      // Right flipper mirrors symmetrically across the Y axis (-150 deg rest -> -200 deg up)
      this.restAngle = (-180 + restDeg) * (Math.PI / 180);
      this.upAngle = (-180 + restDeg - strokeDeg) * (Math.PI / 180);
    }
    this.currentAngle = this.restAngle;

    // 2. Determine Initial Position
    let initialPos = options.position;
    if (!initialPos) {
      if (this.side === 'left') {
        initialPos = FLIPPER.LEFT_POSITION;
      } else if (this.side === 'right') {
        initialPos = FLIPPER.RIGHT_POSITION;
      } else {
        initialPos = FLIPPER.UPPER_LEFT_POSITION;
      }
    }

    // 3. Create Three.js Visual Mesh Hierarchy
    const r1 = FLIPPER.RADIUS_BASE;
    const r2 = FLIPPER.RADIUS_TIP;
    const d = FLIPPER.LENGTH;
    const height = 0.8;

    // 2D Profile shape in XY plane
    const shape = new THREE.Shape();
    const alpha = Math.asin((r1 - r2) / d);

    // Base circular arc
    shape.absarc(0, 0, r1, Math.PI / 2 + alpha, -Math.PI / 2 - alpha, false);
    // Bottom edge towards tip
    shape.lineTo(d - r2 * Math.sin(alpha), -r2 * Math.cos(alpha));
    // Tip circular arc
    shape.absarc(d, 0, r2, -Math.PI / 2 - alpha, Math.PI / 2 + alpha, false);
    // Top edge towards base
    shape.lineTo(-r1 * Math.sin(alpha), r1 * Math.cos(alpha));

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    };

    const batGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    batGeom.translate(0, 0, -height / 2);

    const gunmetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x282c34,
      metalness: 0.85,
      roughness: 0.25,
    });

    this.batMesh = new THREE.Mesh(batGeom, gunmetalMaterial);
    this.batMesh.castShadow = true;
    this.batMesh.receiveShadow = true;
    this.batMesh.name = `flipper-${this.side}-bat`;

    // Neon accent edge trim
    const trimColor =
      this.side === 'left' ? COLORS.NEON_CYAN : this.side === 'right' ? COLORS.NEON_PINK : COLORS.NEON_YELLOW;
    const trimMaterial = createNeonAccentMaterial(trimColor);

    const inset = 0.08;
    const topR1 = Math.max(0.1, r1 - inset);
    const topR2 = Math.max(0.1, r2 - inset);
    const topD = d - inset;
    const topAlpha = Math.asin((topR1 - topR2) / topD);

    const topShape = new THREE.Shape();
    topShape.absarc(0, 0, topR1, Math.PI / 2 + topAlpha, -Math.PI / 2 - topAlpha, false);
    topShape.lineTo(topD - topR2 * Math.sin(topAlpha), -topR2 * Math.cos(topAlpha));
    topShape.absarc(topD, 0, topR2, -Math.PI / 2 - topAlpha, Math.PI / 2 + topAlpha, false);
    topShape.lineTo(-topR1 * Math.sin(topAlpha), topR1 * Math.cos(topAlpha));

    const trimGeom = new THREE.ShapeGeometry(topShape);
    this.trimMesh = new THREE.Mesh(trimGeom, trimMaterial);
    this.trimMesh.position.set(0, 0, height / 2 + 0.05);
    this.trimMesh.name = `flipper-${this.side}-trim`;

    this.mesh = new THREE.Group();
    this.mesh.name = `flipper-${this.side}`;
    this.mesh.add(this.batMesh);
    this.mesh.add(this.trimMesh);

    // 4. Create Cannon-es Kinematic Rigid Body
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: options.material,
    });

    // Base sphere shape
    this.body.addShape(new CANNON.Sphere(r1), new CANNON.Vec3(0, 0, 0));

    // Tip sphere shape
    this.body.addShape(new CANNON.Sphere(r2), new CANNON.Vec3(d, 0, 0));

    // Blade connecting shaft
    const avgRadius = (r1 + r2) / 2;
    this.body.addShape(
      new CANNON.Box(new CANNON.Vec3(d / 2, avgRadius, height / 2)),
      new CANNON.Vec3(d / 2, 0, 0)
    );

    this.body.position.set(initialPos.x, initialPos.y, initialPos.z);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), this.currentAngle);
    (this.body as unknown as { userData: { name: string; side: FlipperSide } }).userData = {
      name: `flipper-${this.side}`,
      side: this.side,
    };

    // Sync initial mesh transform
    this.sync();
  }

  /**
   * Activates flipper upward stroke.
   */
  public activate(): void {
    this.isActivated = true;
  }

  /**
   * Deactivates flipper allowing return spring to pull back to rest angle.
   */
  public deactivate(): void {
    this.isActivated = false;
  }

  /**
   * Updates flipper angle and angular velocity each frame.
   */
  public update(deltaSec: number): void {
    const dt = Math.max(0.0001, Math.min(deltaSec, 0.1));

    if (this.side === 'left' || this.side === 'upper-left') {
      if (this.isActivated) {
        if (this.currentAngle < this.upAngle) {
          const delta = this.strokeSpeed * dt;
          const nextAngle = Math.min(this.currentAngle + delta, this.upAngle);
          const omega = (nextAngle - this.currentAngle) / dt;
          this.currentAngle = nextAngle;
          this.body.angularVelocity.set(0, 0, omega);
        } else {
          this.currentAngle = this.upAngle;
          this.body.angularVelocity.set(0, 0, 0);
        }
      } else {
        if (this.currentAngle > this.restAngle) {
          const delta = this.returnSpeed * dt;
          const nextAngle = Math.max(this.currentAngle - delta, this.restAngle);
          const omega = (nextAngle - this.currentAngle) / dt;
          this.currentAngle = nextAngle;
          this.body.angularVelocity.set(0, 0, omega);
        } else {
          this.currentAngle = this.restAngle;
          this.body.angularVelocity.set(0, 0, 0);
        }
      }
    } else {
      // Right flipper rotates negatively (clockwise) when activating
      if (this.isActivated) {
        if (this.currentAngle > this.upAngle) {
          const delta = this.strokeSpeed * dt;
          const nextAngle = Math.max(this.currentAngle - delta, this.upAngle);
          const omega = (nextAngle - this.currentAngle) / dt;
          this.currentAngle = nextAngle;
          this.body.angularVelocity.set(0, 0, omega);
        } else {
          this.currentAngle = this.upAngle;
          this.body.angularVelocity.set(0, 0, 0);
        }
      } else {
        if (this.currentAngle < this.restAngle) {
          const delta = this.returnSpeed * dt;
          const nextAngle = Math.min(this.currentAngle + delta, this.restAngle);
          const omega = (nextAngle - this.currentAngle) / dt;
          this.currentAngle = nextAngle;
          this.body.angularVelocity.set(0, 0, omega);
        } else {
          this.currentAngle = this.restAngle;
          this.body.angularVelocity.set(0, 0, 0);
        }
      }
    }

    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), this.currentAngle);
    this.sync();
  }

  /**
   * Synchronizes Three.js mesh transform with Cannon-es body.
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
}
