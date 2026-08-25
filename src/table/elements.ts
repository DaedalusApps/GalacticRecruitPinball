import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  TABLE_LAYOUT,
  Position3D,
  ReentryLaneLayoutConfig,
  LaunchRampLayoutConfig,
  DropTargetLayoutConfig,
  SpotTargetLayoutConfig,
  UfoBeamLayoutConfig,
  SpinnerLayoutConfig,
  SpaceWarpLayoutConfig,
} from './layout';
import { TableLight, LightGroup } from './lights';
import { Pinball } from '../physics/ball';
import { BUMPERS, COLORS, BALL } from '../utils/constants';
import { createMetallicTrimMaterial, createNeonAccentMaterial } from '../rendering/materials';

// ============================================================================
// 1. SLINGSHOT (Triangular Kicker with Impulse)
// ============================================================================

export type SlingshotSide = 'left' | 'right';

export interface SlingshotOptions {
  side: SlingshotSide;
  position?: Position3D;
  material?: CANNON.Material;
  score?: number;
  impulseMagnitude?: number;
}

export class Slingshot {
  public side: SlingshotSide;
  public position: Position3D;
  public score: number;
  public impulseMagnitude: number;
  public mesh: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public rubberMesh: THREE.Mesh;
  public body: CANNON.Body;
  public material: THREE.MeshStandardMaterial;
  public rubberMaterial: THREE.MeshStandardMaterial;

  public onHit?: (score: number) => void;
  private hitTimer: number = 0;
  private isHitAnimating: boolean = false;

  constructor(options: SlingshotOptions) {
    this.side = options.side;
    const config =
      this.side === 'left' ? TABLE_LAYOUT.SLINGSHOTS.LEFT : TABLE_LAYOUT.SLINGSHOTS.RIGHT;

    this.position = options.position ?? config.position;
    this.score = options.score ?? config.score;
    this.impulseMagnitude = options.impulseMagnitude ?? config.impulseMagnitude;

    // 1. Create Three.js 3D Visual Mesh Hierarchy
    const shape = new THREE.Shape();
    const verts = config.vertices;
    shape.moveTo(verts[0].x, verts[0].y);
    shape.lineTo(verts[1].x, verts[1].y);
    shape.lineTo(verts[2].x, verts[2].y);
    shape.closePath();

    const height = 0.8;
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.05,
      bevelThickness: 0.05,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center geometry in Z
    geom.translate(0, 0, -height / 2);

    this.material = new THREE.MeshStandardMaterial({
      color: 0x1f2430,
      metalness: 0.8,
      roughness: 0.25,
    });
    this.bodyMesh = new THREE.Mesh(geom, this.material);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.bodyMesh.name = `slingshot-${this.side}-body`;

    // Active kicker rubber / neon glowing trim line
    const rubberColor = config.color;
    this.rubberMaterial = createNeonAccentMaterial(rubberColor);

    // Kicker rubber band between top point (v0) and bottom-inner point (v1)
    const p0 = new THREE.Vector3(verts[0].x, verts[0].y, 0);
    const p1 = new THREE.Vector3(verts[1].x, verts[1].y, 0);
    const rubberLength = p0.distanceTo(p1);
    const rubberGeom = new THREE.BoxGeometry(0.12, rubberLength, height * 0.7);
    this.rubberMesh = new THREE.Mesh(rubberGeom, this.rubberMaterial);

    const midPoint = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x) - Math.PI / 2;
    this.rubberMesh.position.set(midPoint.x, midPoint.y, 0);
    this.rubberMesh.rotation.z = angle;
    this.rubberMesh.name = `slingshot-${this.side}-rubber`;

    // Acorn posts at 3 vertices
    const postMat = createMetallicTrimMaterial();
    const postGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const postGeom = new THREE.CylinderGeometry(0.18, 0.18, height + 0.2, 16);
      postGeom.rotateX(Math.PI / 2);
      const postMesh = new THREE.Mesh(postGeom, postMat);
      postMesh.position.set(verts[i].x, verts[i].y, 0);
      postGroup.add(postMesh);
    }

    this.mesh = new THREE.Group();
    this.mesh.name = `slingshot-${this.side}`;
    this.mesh.add(this.bodyMesh);
    this.mesh.add(this.rubberMesh);
    this.mesh.add(postGroup);
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // 2. Create Cannon-es Static Convex Polyhedron Body
    const halfH = height / 2;

    // Ensure 2D vertices are in counter-clockwise order
    let pA = verts[0];
    let pB = verts[1];
    let pC = verts[2];
    const cross = (pB.x - pA.x) * (pC.y - pB.y) - (pB.y - pA.y) * (pC.x - pB.x);
    if (cross < 0) {
      // Swap pB and pC to make CCW
      const temp = pB;
      pB = pC;
      pC = temp;
    }

    const cannonVerts: CANNON.Vec3[] = [
      // Bottom 3 vertices (-Z)
      new CANNON.Vec3(pA.x, pA.y, -halfH), // 0
      new CANNON.Vec3(pB.x, pB.y, -halfH), // 1
      new CANNON.Vec3(pC.x, pC.y, -halfH), // 2
      // Top 3 vertices (+Z)
      new CANNON.Vec3(pA.x, pA.y, halfH),  // 3
      new CANNON.Vec3(pB.x, pB.y, halfH),  // 4
      new CANNON.Vec3(pC.x, pC.y, halfH),  // 5
    ];

    const cannonFaces: number[][] = [
      [0, 2, 1],       // Bottom face (points -Z)
      [3, 4, 5],       // Top face (points +Z)
      [0, 1, 4, 3],    // Side face 0 (pA -> pB)
      [1, 2, 5, 4],    // Side face 1 (pB -> pC)
      [2, 0, 3, 5],    // Side face 2 (pC -> pA)
    ];

    const cannonPolyShape = new CANNON.ConvexPolyhedron({
      vertices: cannonVerts,
      faces: cannonFaces,
    });

    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: options.material,
    });
    this.body.addShape(cannonPolyShape);
    this.body.position.set(this.position.x, this.position.y, this.position.z);
    (this.body as unknown as { userData: { name: string; side: SlingshotSide } }).userData = {
      name: `slingshot-${this.side}`,
      side: this.side,
    };
  }

  /**
   * Handles ball contact: calculates rebound impulse direction, applies velocity/impulse,
   * triggers visual flash animation and invokes hit callback.
   */
  public handleBallContact(pinball: Pinball): number {
    const config =
      this.side === 'left' ? TABLE_LAYOUT.SLINGSHOTS.LEFT : TABLE_LAYOUT.SLINGSHOTS.RIGHT;

    const nx = config.kickDirection.x;
    const ny = config.kickDirection.y;
    const kickSpeed = 16;

    // Apply upward rebound impulse to ball
    pinball.body.velocity.x = nx * kickSpeed;
    pinball.body.velocity.y = Math.max(pinball.body.velocity.y, 0) + ny * kickSpeed;
    pinball.applyImpulse({
      x: nx * kickSpeed * BALL.MASS,
      y: ny * kickSpeed * BALL.MASS,
      z: 0,
    });

    // Hit animation flash
    this.isHitAnimating = true;
    this.hitTimer = 0.12;
    this.rubberMaterial.emissiveIntensity = 3.0;

    if (this.onHit) {
      this.onHit(this.score);
    }

    return this.score;
  }

  public update(deltaSec: number): void {
    if (this.isHitAnimating) {
      this.hitTimer -= deltaSec;
      if (this.hitTimer <= 0) {
        this.isHitAnimating = false;
        this.rubberMaterial.emissiveIntensity = 0.8;
      }
    }
  }
}

// ============================================================================
// 2. ATTACK BUMPER (3D Sculpted Alien Bumper with Upgrades)
// ============================================================================

export interface AttackBumperOptions {
  id: string;
  position?: Position3D;
  radius?: number;
  material?: CANNON.Material;
  level?: number;
}

export class AttackBumper {
  public id: string;
  public position: Position3D;
  public radius: number;
  public level: number; // 1 = Blue (500pt), 2 = Green (1500pt), 3 = Red (4000pt)
  public mesh: THREE.Group;
  public baseMesh: THREE.Mesh;
  public capMesh: THREE.Mesh;
  public ringMesh: THREE.Mesh;
  public alienMesh: THREE.Group;
  public body: CANNON.Body;
  public capMaterial: THREE.MeshStandardMaterial;
  public ringMaterial: THREE.MeshStandardMaterial;

  public onHit?: (bumper: AttackBumper, score: number) => void;
  private hitTimer: number = 0;
  private isHitAnimating: boolean = false;

  constructor(options: AttackBumperOptions) {
    this.id = options.id;
    this.position = options.position ?? { x: 3.5, y: 11.5, z: 0.5 };
    this.radius = options.radius ?? BUMPERS.RADIUS;
    this.level = Math.max(1, Math.min(options.level ?? 1, 3));

    // 1. Create Three.js Visual Mesh Hierarchy
    this.mesh = new THREE.Group();
    this.mesh.name = this.id;

    // (a) Base chrome skirt
    const baseGeom = new THREE.CylinderGeometry(this.radius * 1.05, this.radius * 1.2, 0.25, 32);
    baseGeom.rotateX(Math.PI / 2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2b3240,
      metalness: 0.9,
      roughness: 0.2,
    });
    this.baseMesh = new THREE.Mesh(baseGeom, baseMat);
    this.baseMesh.position.set(0, 0, 0.12);
    this.baseMesh.castShadow = true;
    this.baseMesh.receiveShadow = true;
    this.mesh.add(this.baseMesh);

    // (b) Neon waist ring
    const ringGeom = new THREE.TorusGeometry(this.radius * 0.95, 0.08, 16, 32);
    this.ringMaterial = createNeonAccentMaterial(this.getColor());
    this.ringMesh = new THREE.Mesh(ringGeom, this.ringMaterial);
    this.ringMesh.position.set(0, 0, 0.35);
    this.mesh.add(this.ringMesh);

    // (c) Alien Mushroom Cap
    const capGeom = new THREE.CylinderGeometry(this.radius * 0.85, this.radius * 0.95, 0.4, 32);
    capGeom.rotateX(Math.PI / 2);
    this.capMaterial = new THREE.MeshStandardMaterial({
      color: this.getColor(),
      emissive: this.getColor(),
      emissiveIntensity: 0.9,
      metalness: 0.4,
      roughness: 0.2,
    });
    this.capMesh = new THREE.Mesh(capGeom, this.capMaterial);
    this.capMesh.position.set(0, 0, 0.55);
    this.capMesh.castShadow = true;
    this.mesh.add(this.capMesh);

    // (d) Pixel alien head ornament on top
    this.alienMesh = this.createAlienHeadMesh();
    this.alienMesh.position.set(0, 0, 0.78);
    this.mesh.add(this.alienMesh);

    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // 2. Create Cannon-es Static Cylinder Physics Body
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: options.material,
    });
    const shape = new CANNON.Cylinder(this.radius, this.radius, 1.2, 24);
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    this.body.addShape(shape, new CANNON.Vec3(0, 0, 0.5), q);
    this.body.position.set(this.position.x, this.position.y, this.position.z);
    (this.body as unknown as { userData: { name: string; type: string } }).userData = {
      name: this.id,
      type: 'bumper',
    };
  }

  private createAlienHeadMesh(): THREE.Group {
    const group = new THREE.Group();
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
    });

    // Left and right eye dots
    const eyeGeom = new THREE.BoxGeometry(0.12, 0.12, 0.08);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(-0.3, 0, 0);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(0.3, 0, 0);
    group.add(leftEye);
    group.add(rightEye);

    // Center pixel antenna/crest
    const crestGeom = new THREE.BoxGeometry(0.2, 0.1, 0.15);
    const crestMesh = new THREE.Mesh(crestGeom, this.capMaterial);
    crestMesh.position.set(0, 0.2, 0.05);
    group.add(crestMesh);

    return group;
  }

  /**
   * Returns current tier score value.
   */
  public getScoreValue(): number {
    if (this.level === 1) return BUMPERS.POINTS_TIER_1; // 500
    if (this.level === 2) return BUMPERS.POINTS_TIER_2; // 1500
    return BUMPERS.POINTS_TIER_3; // 4000
  }

  /**
   * Returns current neon color.
   */
  public getColor(): number {
    if (this.level === 1) return COLORS.NEON_CYAN; // Blue tier
    if (this.level === 2) return COLORS.NEON_GREEN; // Green tier
    return COLORS.NEON_PINK; // Red tier
  }

  /**
   * Upgrades bumper power level (1 -> 2 -> 3).
   */
  public upgrade(): void {
    if (this.level < 3) {
      this.level++;
      this.syncLevelVisuals();
    }
  }

  /**
   * Resets bumper back to Level 1 (Blue).
   */
  public resetLevel(): void {
    this.level = 1;
    this.syncLevelVisuals();
  }

  /**
   * Sets exact level (1, 2, or 3).
   */
  public setLevel(level: number): void {
    this.level = Math.max(1, Math.min(level, 3));
    this.syncLevelVisuals();
  }

  private syncLevelVisuals(): void {
    const color = this.getColor();
    this.capMaterial.color.setHex(color);
    this.capMaterial.emissive.setHex(color);
    this.ringMaterial.color.setHex(color);
    this.ringMaterial.emissive.setHex(color);
  }

  /**
   * Handles collision with pinball: calculates radial outward impulse, triggers
   * hit flash/compression animation, and returns points.
   */
  public handleBallContact(pinball: Pinball): number {
    let dx = pinball.body.position.x - this.position.x;
    let dy = pinball.body.position.y - this.position.y;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      dx = 0;
      dy = 1;
      dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const impulseSpeed = 18;

    // Apply radial outward impulse
    pinball.body.velocity.x = nx * impulseSpeed;
    pinball.body.velocity.y = ny * impulseSpeed;
    pinball.applyImpulse({
      x: nx * impulseSpeed * BALL.MASS,
      y: ny * impulseSpeed * BALL.MASS,
      z: 0,
    });

    // Hit animation
    this.isHitAnimating = true;
    this.hitTimer = 0.15;
    this.capMaterial.emissiveIntensity = 3.0;
    this.capMesh.scale.set(1.1, 1.1, 0.7);

    const score = this.getScoreValue();
    if (this.onHit) {
      this.onHit(this, score);
    }

    return score;
  }

  public update(deltaSec: number): void {
    if (this.isHitAnimating) {
      this.hitTimer -= deltaSec;
      if (this.hitTimer <= 0) {
        this.isHitAnimating = false;
        this.capMaterial.emissiveIntensity = 0.9;
        this.capMesh.scale.set(1, 1, 1);
      }
    }
  }
}

// ============================================================================
// 3. ROLLOVER LANE (Sensor Switch + Neon Indicator Lamp)
// ============================================================================

export interface RolloverLaneOptions {
  id: string;
  index: number;
  position: Position3D;
  width?: number;
  length?: number;
  color?: number;
}

export class RolloverLane {
  public id: string;
  public index: number;
  public position: Position3D;
  public width: number;
  public length: number;
  public isLit: boolean = false;
  public light: TableLight;
  public mesh: THREE.Group;
  public guideLeft: THREE.Mesh;
  public guideRight: THREE.Mesh;
  public switchMesh: THREE.Mesh;

  public onRollover?: (lane: RolloverLane, alreadyLit: boolean) => void;
  private isBallInside: boolean = false;

  constructor(options: RolloverLaneOptions) {
    this.id = options.id;
    this.index = options.index;
    this.position = options.position;
    this.width = options.width ?? 1.8;
    this.length = options.length ?? 3.0;

    // 1. Indicator Lamp
    this.light = new TableLight({
      id: `${this.id}-light`,
      position: { x: this.position.x, y: this.position.y, z: 0.08 },
      color: options.color ?? COLORS.NEON_GREEN,
      isLit: false,
    });

    // 2. Visual Guide Rails & Switch Pad
    this.mesh = new THREE.Group();
    this.mesh.name = this.id;
    this.mesh.add(this.light.mesh);

    const guideMat = createMetallicTrimMaterial();
    const guideGeom = new THREE.BoxGeometry(0.12, this.length, 0.6);

    this.guideLeft = new THREE.Mesh(guideGeom, guideMat);
    this.guideLeft.position.set(this.position.x - this.width / 2, this.position.y, 0.3);
    this.guideLeft.castShadow = true;
    this.mesh.add(this.guideLeft);

    this.guideRight = new THREE.Mesh(guideGeom, guideMat);
    this.guideRight.position.set(this.position.x + this.width / 2, this.position.y, 0.3);
    this.guideRight.castShadow = true;
    this.mesh.add(this.guideRight);

    // Switch sensor pad
    const switchGeom = new THREE.BoxGeometry(this.width * 0.5, 0.3, 0.05);
    const switchMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.switchMesh = new THREE.Mesh(switchGeom, switchMat);
    this.switchMesh.position.set(this.position.x, this.position.y, 0.04);
    this.mesh.add(this.switchMesh);
  }

  public setLit(lit: boolean): void {
    this.isLit = lit;
    if (lit) {
      this.light.turnOn();
    } else {
      this.light.turnOff();
    }
  }

  public toggleLit(): void {
    this.setLit(!this.isLit);
  }

  /**
   * Checks if pinball is currently rolling over this lane.
   */
  public checkRollover(pinball: Pinball): boolean {
    const px = pinball.body.position.x;
    const py = pinball.body.position.y;

    const insideX = Math.abs(px - this.position.x) <= this.width / 2;
    const insideY = Math.abs(py - this.position.y) <= this.length / 2;
    const currentlyInside = insideX && insideY;

    if (currentlyInside && !this.isBallInside) {
      this.isBallInside = true;
      const alreadyLit = this.isLit;
      this.setLit(true);
      if (this.onRollover) {
        this.onRollover(this, alreadyLit);
      }
      return true;
    } else if (!currentlyInside && this.isBallInside) {
      this.isBallInside = false;
    }

    return false;
  }

  public update(deltaSec: number): void {
    this.light.update(deltaSec);
  }
}

// ============================================================================
// 4. REENTRY LANE SYSTEM (Coordinates 3 Rollovers + Light Cycling + Bumper Upgrades)
// ============================================================================

export interface ReentryLaneSystemOptions {
  bumpers: AttackBumper[];
  laneConfigs?: readonly ReentryLaneLayoutConfig[];
}

export class ReentryLaneSystem {
  public lanes: RolloverLane[] = [];
  public lightGroup: LightGroup;
  public bumpers: AttackBumper[];
  public onCycleComplete?: () => void;

  constructor(options: ReentryLaneSystemOptions) {
    this.bumpers = options.bumpers;
    const configs = options.laneConfigs ?? TABLE_LAYOUT.REENTRY_LANES;

    for (const cfg of configs) {
      const lane = new RolloverLane({
        id: cfg.id,
        index: cfg.index,
        position: cfg.position,
        width: cfg.width,
        length: cfg.length,
        color: cfg.color,
      });

      lane.onRollover = () => {
        this.checkAllLanesCompleted();
      };

      this.lanes.push(lane);
    }

    this.lightGroup = new LightGroup(
      'reentry-lights',
      this.lanes.map((l) => l.light)
    );
  }

  public isAllLanesLit(): boolean {
    return this.lanes.length > 0 && this.lanes.every((l) => l.isLit);
  }

  public getStates(): boolean[] {
    return this.lanes.map((l) => l.isLit);
  }

  public setStates(states: boolean[]): void {
    for (let i = 0; i < this.lanes.length; i++) {
      if (i < states.length) {
        this.lanes[i].setLit(states[i]);
      }
    }
  }

  /**
   * Left flipper press cycles lit lanes left.
   */
  public cycleLeft(): void {
    this.lightGroup.cycleLeft();
    this.syncLaneStatesFromLights();
  }

  /**
   * Right flipper press cycles lit lanes right.
   */
  public cycleRight(): void {
    this.lightGroup.cycleRight();
    this.syncLaneStatesFromLights();
  }

  private syncLaneStatesFromLights(): void {
    for (let i = 0; i < this.lanes.length; i++) {
      this.lanes[i].isLit = this.lanes[i].light.isLit;
    }
  }

  /**
   * Directly triggers a rollover on lane index.
   */
  public triggerLane(index: number): void {
    if (index >= 0 && index < this.lanes.length) {
      this.lanes[index].setLit(true);
      this.checkAllLanesCompleted();
    }
  }

  /**
   * Checks if all 3 lanes are lit, upgrades all attack bumpers, triggers callback,
   * and unlights lanes for the next cycle.
   */
  private checkAllLanesCompleted(): void {
    if (this.isAllLanesLit()) {
      // 1. Upgrade all attack bumpers
      for (const bumper of this.bumpers) {
        bumper.upgrade();
      }

      // 2. Invoke cycle complete callback
      if (this.onCycleComplete) {
        this.onCycleComplete();
      }

      // 3. Reset lanes back to unlit for next cycle
      for (const lane of this.lanes) {
        lane.setLit(false);
      }
    }
  }

  /**
   * Checks ball contact/rollover for all lanes.
   */
  public checkRollers(pinball: Pinball): void {
    for (const lane of this.lanes) {
      lane.checkRollover(pinball);
    }
  }

  public update(deltaSec: number, pinball?: Pinball): void {
    if (pinball) {
      this.checkRollers(pinball);
    }
    for (const lane of this.lanes) {
      lane.update(deltaSec);
    }
  }
}

// ============================================================================
// 5. LAUNCH RAMP & WIRE HABITRAIL (Cannon Tube + Spline Kinematics)
// ============================================================================

export interface LaunchRampOptions {
  id: string;
  config?: LaunchRampLayoutConfig;
  transitDuration?: number;
  material?: CANNON.Material;
}

export class LaunchRamp {
  public id: string;
  public entrance: Position3D;
  public exit: Position3D;
  public score: number;
  public exitVelocity: Position3D;
  public curve: THREE.CatmullRomCurve3;
  public mesh: THREE.Group;
  public entranceMesh: THREE.Mesh;
  public habitrailMesh: THREE.Mesh;
  public wireMaterial: THREE.MeshStandardMaterial;
  public entranceBody: CANNON.Body;

  public isTransporting: boolean = false;
  public transitProgress: number = 0; // t from 0 to 1
  public transitDuration: number;
  public transportingBall: Pinball | null = null;

  public onRampEnter?: (ramp: LaunchRamp, pinball: Pinball) => void;
  public onRampComplete?: (ramp: LaunchRamp, pinball: Pinball) => void;
  public onRampExit?: (ramp: LaunchRamp, pinball: Pinball) => void;

  constructor(options: LaunchRampOptions) {
    this.id = options.id;
    const config = options.config ?? TABLE_LAYOUT.LAUNCH_RAMP;
    this.entrance = config.entrance;
    this.exit = config.exit;
    this.score = config.score;
    this.exitVelocity = config.exitVelocity;
    this.transitDuration = options.transitDuration ?? 1.0;

    // 1. Build 3D Spline Guide Curve
    const points = config.splinePoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this.curve = new THREE.CatmullRomCurve3(points);

    // 2. Three.js Visual Mesh Hierarchy
    this.mesh = new THREE.Group();
    this.mesh.name = this.id;

    // Entrance chute mesh
    const entranceGeom = new THREE.BoxGeometry(1.6, 1.8, 0.8);
    const entranceMat = new THREE.MeshStandardMaterial({
      color: 0x1f2636,
      metalness: 0.8,
      roughness: 0.25,
    });
    this.entranceMesh = new THREE.Mesh(entranceGeom, entranceMat);
    this.entranceMesh.position.set(this.entrance.x, this.entrance.y, this.entrance.z);
    this.entranceMesh.castShadow = true;
    this.mesh.add(this.entranceMesh);

    // Wire habitrail tube geometry
    const tubeGeom = new THREE.TubeGeometry(this.curve, 64, 0.08, 8, false);
    this.wireMaterial = createMetallicTrimMaterial();
    this.habitrailMesh = new THREE.Mesh(tubeGeom, this.wireMaterial);
    this.habitrailMesh.castShadow = true;
    this.mesh.add(this.habitrailMesh);

    // Glowing neon guide rail
    const neonMat = createNeonAccentMaterial(COLORS.NEON_CYAN);
    const glowGeom = new THREE.TubeGeometry(this.curve, 64, 0.03, 6, false);
    const glowMesh = new THREE.Mesh(glowGeom, neonMat);
    glowMesh.position.set(0, 0, 0.1);
    this.mesh.add(glowMesh);

    // Support posts along curve
    for (let i = 1; i < points.length - 1; i++) {
      const pt = points[i];
      const postGeom = new THREE.CylinderGeometry(0.06, 0.06, pt.z, 8);
      postGeom.rotateX(Math.PI / 2);
      const postMesh = new THREE.Mesh(postGeom, this.wireMaterial);
      postMesh.position.set(pt.x, pt.y, pt.z / 2);
      this.mesh.add(postMesh);
    }

    // 3. Static Physics Body for Entrance funnel
    this.entranceBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: options.material,
    });
    this.entranceBody.addShape(new CANNON.Box(new CANNON.Vec3(0.8, 0.9, 0.4)));
    this.entranceBody.position.set(this.entrance.x, this.entrance.y, this.entrance.z);
    (this.entranceBody as unknown as { userData: { name: string; type: string } }).userData = {
      name: this.id,
      type: 'ramp-entrance',
    };
  }

  public checkEntry(pinball: Pinball): boolean {
    if (this.isTransporting) return false;
    const px = pinball.body.position.x;
    const py = pinball.body.position.y;
    const dx = px - this.entrance.x;
    const dy = py - this.entrance.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 1.4 && pinball.body.velocity.y > -2) {
      this.enterRamp(pinball);
      return true;
    }
    return false;
  }

  public enterRamp(pinball: Pinball): void {
    this.isTransporting = true;
    this.transportingBall = pinball;
    this.transitProgress = 0;

    pinball.body.velocity.set(0, 0, 0);
    pinball.body.angularVelocity.set(0, 0, 0);

    const startPt = this.curve.getPoint(0);
    pinball.body.position.set(startPt.x, startPt.y, startPt.z);
    pinball.sync();

    if (this.onRampEnter) {
      this.onRampEnter(this, pinball);
    }
  }

  public update(deltaSec: number, pinball?: Pinball): void {
    const targetBall = this.transportingBall ?? pinball;

    if (this.isTransporting && targetBall) {
      this.transitProgress += deltaSec / this.transitDuration;

      if (this.transitProgress >= 1.0) {
        this.transitProgress = 1.0;
        const exitPt = this.curve.getPoint(1.0);
        targetBall.body.position.set(exitPt.x, exitPt.y, exitPt.z);
        targetBall.body.velocity.set(
          this.exitVelocity.x,
          this.exitVelocity.y,
          this.exitVelocity.z
        );
        targetBall.sync();

        this.isTransporting = false;
        const completedBall = targetBall;
        this.transportingBall = null;

        if (this.onRampComplete) {
          this.onRampComplete(this, completedBall);
        }
        if (this.onRampExit) {
          this.onRampExit(this, completedBall);
        }
      } else {
        const pt = this.curve.getPoint(this.transitProgress);
        targetBall.body.position.set(pt.x, pt.y, pt.z);
        targetBall.body.velocity.set(0, 0, 0);
        targetBall.sync();
      }
    }
  }
}

// ============================================================================
// 6. DROP TARGET & DROP TARGET BANK (Booster Targets with Bank Clear Bonus)
// ============================================================================

export interface DropTargetOptions {
  id: string;
  config: DropTargetLayoutConfig;
  material?: CANNON.Material;
}

export class DropTarget {
  public id: string;
  public position: Position3D;
  public width: number;
  public depth: number;
  public height: number;
  public color: number;
  public score: number;
  public isDropped: boolean = false;
  public mesh: THREE.Group;
  public plateMesh: THREE.Mesh;
  public body: CANNON.Body;
  public material: THREE.MeshStandardMaterial;
  public raisedZ: number;
  public droppedZ: number;

  public onHit?: (target: DropTarget) => void;

  constructor(options: DropTargetOptions) {
    this.id = options.id;
    const cfg = options.config;
    this.position = cfg.position;
    this.width = cfg.width;
    this.depth = cfg.depth;
    this.height = cfg.height;
    this.color = cfg.color;
    this.score = cfg.score;
    this.raisedZ = cfg.position.z;
    this.droppedZ = cfg.position.z - 1.2;

    this.mesh = new THREE.Group();
    this.mesh.name = this.id;

    // Visual target plate
    const plateGeom = new THREE.BoxGeometry(this.width, this.depth, this.height);
    this.material = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.6,
      metalness: 0.5,
      roughness: 0.2,
    });
    this.plateMesh = new THREE.Mesh(plateGeom, this.material);
    this.plateMesh.castShadow = true;
    this.mesh.add(this.plateMesh);

    // Bezel frame
    const bezelGeom = new THREE.BoxGeometry(this.width + 0.1, this.depth + 0.1, 0.1);
    const bezelMat = createMetallicTrimMaterial();
    const bezelMesh = new THREE.Mesh(bezelGeom, bezelMat);
    bezelMesh.position.set(0, 0, -this.height / 2);
    this.mesh.add(bezelMesh);

    this.mesh.position.set(this.position.x, this.position.y, this.raisedZ);

    // Cannon Static Body
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: options.material,
    });
    this.body.addShape(
      new CANNON.Box(new CANNON.Vec3(this.width / 2, this.depth / 2, this.height / 2))
    );
    this.body.position.set(this.position.x, this.position.y, this.raisedZ);
    (this.body as unknown as { userData: { name: string; type: string } }).userData = {
      name: this.id,
      type: 'drop-target',
    };
  }

  public drop(): void {
    if (this.isDropped) return;
    this.isDropped = true;
    this.body.position.z = this.droppedZ;
    this.mesh.position.z = this.droppedZ;
    this.material.emissiveIntensity = 0.1;
  }

  public reset(): void {
    this.isDropped = false;
    this.body.position.z = this.raisedZ;
    this.mesh.position.z = this.raisedZ;
    this.material.emissiveIntensity = 0.6;
  }

  public handleBallContact(pinball?: Pinball): number {
    if (this.isDropped) return 0;
    this.drop();
    if (pinball) {
      pinball.body.velocity.x *= 0.8;
      pinball.body.velocity.y *= 0.8;
    }
    if (this.onHit) {
      this.onHit(this);
    }
    return this.score;
  }

  public update(deltaSec: number): void {
    const targetZ = this.isDropped ? this.droppedZ : this.raisedZ;
    if (Math.abs(this.mesh.position.z - targetZ) > 0.01) {
      this.mesh.position.z += (targetZ - this.mesh.position.z) * Math.min(deltaSec * 15, 1.0);
    }
  }
}

export interface DropTargetBankOptions {
  id: string;
  configs?: readonly DropTargetLayoutConfig[];
  material?: CANNON.Material;
}

export class DropTargetBank {
  public id: string;
  public targets: DropTarget[] = [];
  public onBankCleared?: (bank: DropTargetBank) => void;

  constructor(options: DropTargetBankOptions) {
    this.id = options.id;
    const configs = options.configs ?? TABLE_LAYOUT.DROP_TARGETS.BOOSTER;
    for (const cfg of configs) {
      const target = new DropTarget({
        id: cfg.id,
        config: cfg,
        material: options.material,
      });
      target.onHit = () => {
        if (this.isAllDropped() && this.onBankCleared) {
          this.onBankCleared(this);
        }
      };
      this.targets.push(target);
    }
  }

  public isAllDropped(): boolean {
    return this.targets.length > 0 && this.targets.every((t) => t.isDropped);
  }

  public getDroppedCount(): number {
    return this.targets.filter((t) => t.isDropped).length;
  }

  public resetAll(): void {
    for (const target of this.targets) {
      target.reset();
    }
  }

  public update(deltaSec: number): void {
    for (const target of this.targets) {
      target.update(deltaSec);
    }
  }
}

// ============================================================================
// 7. SPOT TARGET & SPOT TARGET BANK (Mission, Medal, Hazard Targets)
// ============================================================================

export interface SpotTargetOptions {
  id: string;
  config: SpotTargetLayoutConfig;
  material?: CANNON.Material;
}

export class SpotTarget {
  public id: string;
  public position: Position3D;
  public radius: number;
  public height: number;
  public color: number;
  public score: number;
  public isLit: boolean = false;
  public mesh: THREE.Group;
  public targetMesh: THREE.Mesh;
  public body: CANNON.Body;
  public material: THREE.MeshStandardMaterial;

  public onHit?: (target: SpotTarget, score: number) => void;
  private isHitAnimating: boolean = false;
  private hitTimer: number = 0;

  constructor(options: SpotTargetOptions) {
    this.id = options.id;
    const cfg = options.config;
    this.position = cfg.position;
    this.radius = cfg.radius;
    this.height = cfg.height;
    this.color = cfg.color;
    this.score = cfg.score;

    this.mesh = new THREE.Group();
    this.mesh.name = this.id;

    // Visual standup target
    const geom = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 24);
    geom.rotateX(Math.PI / 2);
    this.material = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.3,
      metalness: 0.6,
      roughness: 0.2,
    });
    this.targetMesh = new THREE.Mesh(geom, this.material);
    this.targetMesh.castShadow = true;
    this.mesh.add(this.targetMesh);

    // Bezel ring
    const bezelGeom = new THREE.TorusGeometry(this.radius * 1.05, 0.05, 12, 24);
    const bezelMat = createMetallicTrimMaterial();
    const bezelMesh = new THREE.Mesh(bezelGeom, bezelMat);
    this.mesh.add(bezelMesh);

    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // Cannon Static Body
    this.body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC,
      material: options.material,
    });
    const shape = new CANNON.Cylinder(this.radius, this.radius, this.height, 16);
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    this.body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
    this.body.position.set(this.position.x, this.position.y, this.position.z);
    (this.body as unknown as { userData: { name: string; type: string } }).userData = {
      name: this.id,
      type: 'spot-target',
    };
  }

  public setLit(lit: boolean): void {
    this.isLit = lit;
    this.material.emissiveIntensity = lit ? 1.0 : 0.3;
  }

  public reset(): void {
    this.setLit(false);
  }

  public handleBallContact(pinball: Pinball): number {
    this.setLit(true);

    let dx = pinball.body.position.x - this.position.x;
    let dy = pinball.body.position.y - this.position.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 0.001) {
      dx = 0;
      dy = -1;
      dist = 1;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const reboundSpeed = 12;

    pinball.body.velocity.x = nx * reboundSpeed;
    pinball.body.velocity.y = ny * reboundSpeed;
    pinball.applyImpulse({
      x: nx * reboundSpeed * BALL.MASS,
      y: ny * reboundSpeed * BALL.MASS,
      z: 0,
    });

    this.isHitAnimating = true;
    this.hitTimer = 0.15;
    this.material.emissiveIntensity = 2.5;

    if (this.onHit) {
      this.onHit(this, this.score);
    }

    return this.score;
  }

  public update(deltaSec: number): void {
    if (this.isHitAnimating) {
      this.hitTimer -= deltaSec;
      if (this.hitTimer <= 0) {
        this.isHitAnimating = false;
        this.material.emissiveIntensity = this.isLit ? 1.0 : 0.3;
      }
    }
  }
}

export interface SpotTargetBankOptions {
  id: string;
  configs: readonly SpotTargetLayoutConfig[];
  material?: CANNON.Material;
}

export class SpotTargetBank {
  public id: string;
  public targets: SpotTarget[] = [];
  public onBankComplete?: (bank: SpotTargetBank) => void;

  constructor(options: SpotTargetBankOptions) {
    this.id = options.id;
    for (const cfg of options.configs) {
      const target = new SpotTarget({
        id: cfg.id,
        config: cfg,
        material: options.material,
      });
      target.onHit = () => {
        if (this.isAllLit() && this.onBankComplete) {
          this.onBankComplete(this);
        }
      };
      this.targets.push(target);
    }
  }

  public isAllLit(): boolean {
    return this.targets.length > 0 && this.targets.every((t) => t.isLit);
  }

  public getLitCount(): number {
    return this.targets.filter((t) => t.isLit).length;
  }

  public resetAll(): void {
    for (const target of this.targets) {
      target.reset();
    }
  }

  public update(deltaSec: number): void {
    for (const target of this.targets) {
      target.update(deltaSec);
    }
  }
}

// ============================================================================
// 8. UFO BEAM SINK HOLE (3D UFO Hover Saucer + Vortex + Teleport Impulse)
// ============================================================================

export interface UfoBeamSinkHoleOptions {
  id: string;
  config: UfoBeamLayoutConfig;
  holdDuration?: number;
}

export class UfoBeamSinkHole {
  public id: string;
  public beamType: 'yellow' | 'red' | 'green';
  public position: Position3D;
  public beamColor: number;
  public captureRadius: number;
  public ejectDirection: { x: number; y: number };
  public ejectSpeed: number;
  public score: number;

  public mesh: THREE.Group;
  public ufoMesh: THREE.Group;
  public vortexMesh: THREE.Mesh;
  public beamMesh: THREE.Mesh;

  public isHolding: boolean = false;
  public holdTimer: number = 0;
  public holdDuration: number;
  public heldBall: Pinball | null = null;

  public onCapture?: (beam: UfoBeamSinkHole, pinball: Pinball) => void;
  public onBallEjected?: (beam: UfoBeamSinkHole, pinball: Pinball) => void;

  constructor(options: UfoBeamSinkHoleOptions) {
    this.id = options.id;
    const cfg = options.config;
    this.beamType = cfg.type;
    this.position = cfg.position;
    this.beamColor = cfg.color;
    this.captureRadius = cfg.captureRadius;
    this.ejectDirection = cfg.ejectDirection;
    this.ejectSpeed = cfg.ejectSpeed;
    this.score = cfg.score;
    this.holdDuration = options.holdDuration ?? 1.0;

    this.mesh = new THREE.Group();
    this.mesh.name = this.id;
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // 1. Glowing Vortex Ring on Table Surface
    const vortexGeom = new THREE.RingGeometry(0.3, this.captureRadius * 0.9, 32);
    const vortexMat = new THREE.MeshStandardMaterial({
      color: this.beamColor,
      emissive: this.beamColor,
      emissiveIntensity: 1.0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.vortexMesh = new THREE.Mesh(vortexGeom, vortexMat);
    this.mesh.add(this.vortexMesh);

    // 2. Teleport Beam Cylinder
    const beamHeight = 2.4;
    const beamGeom = new THREE.CylinderGeometry(
      this.captureRadius * 0.7,
      this.captureRadius * 0.85,
      beamHeight,
      24,
      1,
      true
    );
    beamGeom.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshStandardMaterial({
      color: this.beamColor,
      emissive: this.beamColor,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.beamMesh = new THREE.Mesh(beamGeom, beamMat);
    this.beamMesh.position.set(0, 0, beamHeight / 2);
    this.mesh.add(this.beamMesh);

    // 3. 3D Hovering UFO Saucer Mesh at top
    this.ufoMesh = this.createUfoMesh();
    this.ufoMesh.position.set(0, 0, beamHeight + 0.3);
    this.mesh.add(this.ufoMesh);
  }

  private createUfoMesh(): THREE.Group {
    const group = new THREE.Group();
    const ufoMat = new THREE.MeshStandardMaterial({
      color: 0x334455,
      metalness: 0.85,
      roughness: 0.2,
    });
    const glowMat = createNeonAccentMaterial(this.beamColor);

    const saucerGeom = new THREE.CylinderGeometry(0.9, 1.3, 0.25, 24);
    saucerGeom.rotateX(Math.PI / 2);
    const saucer = new THREE.Mesh(saucerGeom, ufoMat);
    group.add(saucer);

    const domeGeom = new THREE.SphereGeometry(0.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeom.rotateX(Math.PI / 2);
    const dome = new THREE.Mesh(domeGeom, glowMat);
    dome.position.set(0, 0, 0.12);
    group.add(dome);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dotGeom = new THREE.SphereGeometry(0.08, 8, 8);
      const dot = new THREE.Mesh(dotGeom, glowMat);
      dot.position.set(Math.cos(angle) * 1.1, Math.sin(angle) * 1.1, 0);
      group.add(dot);
    }

    return group;
  }

  public checkCapture(pinball: Pinball): boolean {
    if (this.isHolding) return false;

    const dx = pinball.body.position.x - this.position.x;
    const dy = pinball.body.position.y - this.position.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= this.captureRadius) {
      this.captureBall(pinball);
      return true;
    }
    return false;
  }

  public captureBall(pinball: Pinball): void {
    this.isHolding = true;
    this.holdTimer = this.holdDuration;
    this.heldBall = pinball;

    pinball.body.position.set(this.position.x, this.position.y, BALL.RADIUS);
    pinball.body.velocity.set(0, 0, 0);
    pinball.body.angularVelocity.set(0, 0, 0);
    pinball.sync();

    if (this.onCapture) {
      this.onCapture(this, pinball);
    }
  }

  public update(deltaSec: number, pinball?: Pinball): void {
    this.ufoMesh.rotation.z += deltaSec * 1.5;
    this.vortexMesh.rotation.z -= deltaSec * (this.isHolding ? 8.0 : 2.0);

    const targetBall = this.heldBall ?? pinball;

    if (this.isHolding && targetBall) {
      this.holdTimer -= deltaSec;

      targetBall.body.position.set(this.position.x, this.position.y, BALL.RADIUS);
      targetBall.body.velocity.set(0, 0, 0);
      targetBall.sync();

      if (this.holdTimer <= 0) {
        this.isHolding = false;
        const ejectedBall = targetBall;
        this.heldBall = null;

        const mag = Math.hypot(this.ejectDirection.x, this.ejectDirection.y) || 1;
        const nx = this.ejectDirection.x / mag;
        const ny = this.ejectDirection.y / mag;

        ejectedBall.body.position.set(
          this.position.x + nx * (this.captureRadius + 0.2),
          this.position.y + ny * (this.captureRadius + 0.2),
          BALL.RADIUS
        );
        ejectedBall.body.velocity.set(nx * this.ejectSpeed, ny * this.ejectSpeed, 0);
        ejectedBall.sync();

        if (this.onBallEjected) {
          this.onBallEjected(this, ejectedBall);
        }
      }
    }
  }
}

// ============================================================================
// 9. ALIEN SPINNER (3D Alien Disc on Metallic Axle + Angular Spin/Decay)
// ============================================================================

export interface AlienSpinnerOptions {
  id: string;
  config: SpinnerLayoutConfig;
}

export class AlienSpinner {
  public id: string;
  public side: 'left' | 'right';
  public position: Position3D;
  public radius: number;
  public width: number;
  public color: number;
  public baseScore: number;
  public boostedScore: number;
  public isBoosted: boolean = false;

  public mesh: THREE.Group;
  public discMesh: THREE.Mesh;
  public axleMesh: THREE.Mesh;
  public discMaterial: THREE.MeshStandardMaterial;

  public angularVelocity: number = 0;
  public angularFriction: number = 2.5;
  public accumulatedAngle: number = 0;
  public totalSpins: number = 0;

  public onSpin?: (spinner: AlienSpinner, newSpins: number) => void;

  constructor(options: AlienSpinnerOptions) {
    this.id = options.id;
    const cfg = options.config;
    this.side = cfg.side;
    this.position = cfg.position;
    this.radius = cfg.radius;
    this.width = cfg.width;
    this.color = cfg.color;
    this.baseScore = cfg.baseScore;
    this.boostedScore = cfg.boostedScore;

    this.mesh = new THREE.Group();
    this.mesh.name = this.id;
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    // Axle horizontal bar
    const axleGeom = new THREE.CylinderGeometry(0.05, 0.05, this.width * 1.4, 16);
    axleGeom.rotateZ(Math.PI / 2);
    const axleMat = createMetallicTrimMaterial();
    this.axleMesh = new THREE.Mesh(axleGeom, axleMat);
    this.mesh.add(this.axleMesh);

    // Disc plate
    const discGeom = new THREE.BoxGeometry(this.width * 0.9, 0.06, this.radius * 2);
    this.discMaterial = new THREE.MeshStandardMaterial({
      color: this.color,
      emissive: this.color,
      emissiveIntensity: 0.7,
      metalness: 0.4,
      roughness: 0.2,
    });
    this.discMesh = new THREE.Mesh(discGeom, this.discMaterial);
    this.mesh.add(this.discMesh);
  }

  public setBoosted(boosted: boolean): void {
    this.isBoosted = boosted;
    this.discMaterial.emissiveIntensity = boosted ? 1.5 : 0.7;
  }

  public getPointValue(): number {
    return this.isBoosted ? this.boostedScore : this.baseScore;
  }

  public spin(initialAngularVelocity: number): void {
    this.angularVelocity = initialAngularVelocity;
  }

  public handleBallContact(pinball: Pinball): boolean {
    const px = pinball.body.position.x;
    const py = pinball.body.position.y;

    const dx = Math.abs(px - this.position.x);
    const dy = Math.abs(py - this.position.y);

    if (dx <= this.width && dy <= this.radius + 0.6) {
      const speed = Math.hypot(pinball.body.velocity.x, pinball.body.velocity.y);
      const spinSpeed = Math.max(speed * 3.5, 25);
      this.spin(spinSpeed);
      return true;
    }
    return false;
  }

  public resetSpins(): void {
    this.totalSpins = 0;
    this.accumulatedAngle = 0;
  }

  public update(deltaSec: number, pinball?: Pinball): void {
    if (pinball) {
      this.handleBallContact(pinball);
    }

    if (Math.abs(this.angularVelocity) > 0.01) {
      const dTheta = this.angularVelocity * deltaSec;
      this.discMesh.rotation.x += dTheta;
      this.accumulatedAngle += Math.abs(dTheta);

      const currentSpins = Math.floor(this.accumulatedAngle / (Math.PI * 2));
      if (currentSpins > this.totalSpins) {
        const newSpins = currentSpins - this.totalSpins;
        this.totalSpins = currentSpins;
        if (this.onSpin) {
          this.onSpin(this, newSpins);
        }
      }

      this.angularVelocity *= Math.max(0, 1 - this.angularFriction * deltaSec);
    } else {
      this.angularVelocity = 0;
    }
  }
}

// ============================================================================
// 10. SPACE WARP ROLLOVER (Neon Rollover Switch + Warp Event)
// ============================================================================

export interface SpaceWarpRolloverOptions {
  id: string;
  config: SpaceWarpLayoutConfig;
}

export class SpaceWarpRollover {
  public id: string;
  public position: Position3D;
  public width: number;
  public length: number;
  public color: number;
  public score: number;
  public isLit: boolean = false;
  public mesh: THREE.Group;
  public light: TableLight;
  public switchMesh: THREE.Mesh;

  public onWarp?: (rollover: SpaceWarpRollover) => void;
  private isBallInside: boolean = false;

  constructor(options: SpaceWarpRolloverOptions) {
    this.id = options.id;
    const cfg = options.config;
    this.position = cfg.position;
    this.width = cfg.width;
    this.length = cfg.length;
    this.color = cfg.color;
    this.score = cfg.score;

    this.mesh = new THREE.Group();
    this.mesh.name = this.id;

    // TableLight neon glyph indicator
    this.light = new TableLight({
      id: `${this.id}-light`,
      position: { x: this.position.x, y: this.position.y, z: 0.08 },
      color: this.color,
      isLit: false,
    });
    this.mesh.add(this.light.mesh);

    // Switch pad
    const switchGeom = new THREE.BoxGeometry(this.width * 0.6, 0.4, 0.05);
    const switchMat = new THREE.MeshStandardMaterial({
      color: 0x2a3b4c,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.switchMesh = new THREE.Mesh(switchGeom, switchMat);
    this.switchMesh.position.set(this.position.x, this.position.y, 0.04);
    this.mesh.add(this.switchMesh);
  }

  public checkRollover(pinball: Pinball): boolean {
    const px = pinball.body.position.x;
    const py = pinball.body.position.y;

    const insideX = Math.abs(px - this.position.x) <= this.width / 2;
    const insideY = Math.abs(py - this.position.y) <= this.length / 2;
    const currentlyInside = insideX && insideY;

    if (currentlyInside && !this.isBallInside) {
      this.isBallInside = true;
      this.isLit = true;
      this.light.turnOn();
      if (this.onWarp) {
        this.onWarp(this);
      }
      return true;
    } else if (!currentlyInside && this.isBallInside) {
      this.isBallInside = false;
    }

    return false;
  }

  public update(deltaSec: number): void {
    this.light.update(deltaSec);
  }
}

