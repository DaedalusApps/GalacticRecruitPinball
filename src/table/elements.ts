import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TABLE_LAYOUT, Position3D, ReentryLaneLayoutConfig } from './layout';
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
