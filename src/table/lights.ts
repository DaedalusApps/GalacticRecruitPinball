import * as THREE from 'three';
import { COLORS } from '../utils/constants';

export interface TableLightOptions {
  id: string;
  position: { x: number; y: number; z: number };
  color?: number;
  offColor?: number;
  isLit?: boolean;
  radius?: number;
  shape?: 'circle' | 'rect' | 'arrow';
  width?: number;
  length?: number;
}

/**
 * TableLight represents a neon indicator lamp embedded on or above the playfield.
 * It manages emissive mesh materials, on/off states, color transitions, and blinking animations.
 */
export class TableLight {
  public id: string;
  public position: { x: number; y: number; z: number };
  public color: number;
  public offColor: number;
  public isLit: boolean;
  public mesh: THREE.Group;
  public lampMesh: THREE.Mesh;
  public bezelMesh: THREE.Mesh;
  public material: THREE.MeshStandardMaterial;

  public isBlinking: boolean = false;
  public blinkInterval: number = 0.25; // seconds
  private blinkTimer: number = 0;
  private blinkState: boolean = false;

  constructor(options: TableLightOptions) {
    this.id = options.id;
    this.position = options.position;
    this.color = options.color ?? COLORS.NEON_GREEN;
    this.offColor = options.offColor ?? 0x111822;
    this.isLit = options.isLit ?? false;

    // 1. Create Three.js Lamp Geometry
    const radius = options.radius ?? 0.35;
    let geom: THREE.BufferGeometry;

    if (options.shape === 'rect') {
      const w = options.width ?? 0.6;
      const l = options.length ?? 0.3;
      geom = new THREE.BoxGeometry(w, l, 0.05);
    } else {
      // Default circular lens
      geom = new THREE.CylinderGeometry(radius, radius, 0.06, 24);
      geom.rotateX(Math.PI / 2);
    }

    // 2. Material with emissive neon support
    this.material = new THREE.MeshStandardMaterial({
      color: this.isLit ? this.color : this.offColor,
      emissive: this.isLit ? this.color : this.offColor,
      emissiveIntensity: this.isLit ? 1.0 : 0.1,
      roughness: 0.2,
      metalness: 0.1,
    });

    this.lampMesh = new THREE.Mesh(geom, this.material);
    this.lampMesh.name = `${this.id}-lens`;

    // 3. Bezel Frame / Chrome Ring
    const bezelGeom = new THREE.CylinderGeometry(radius * 1.25, radius * 1.25, 0.04, 24);
    bezelGeom.rotateX(Math.PI / 2);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      metalness: 0.9,
      roughness: 0.3,
    });
    this.bezelMesh = new THREE.Mesh(bezelGeom, bezelMat);
    this.bezelMesh.position.set(0, 0, -0.02);
    this.bezelMesh.name = `${this.id}-bezel`;

    this.mesh = new THREE.Group();
    this.mesh.name = this.id;
    this.mesh.add(this.bezelMesh);
    this.mesh.add(this.lampMesh);
    this.mesh.position.set(this.position.x, this.position.y, this.position.z);

    this.syncMaterial();
  }

  /**
   * Turns the indicator light ON.
   */
  public turnOn(): void {
    this.isLit = true;
    this.syncMaterial();
  }

  /**
   * Turns the indicator light OFF.
   */
  public turnOff(): void {
    this.isLit = false;
    this.isBlinking = false;
    this.syncMaterial();
  }

  /**
   * Toggles the lit state.
   */
  public toggle(): void {
    this.isLit = !this.isLit;
    this.syncMaterial();
  }

  /**
   * Sets new active neon color.
   */
  public setColor(color: number): void {
    this.color = color;
    this.syncMaterial();
  }

  /**
   * Enables or disables blinking mode.
   */
  public setBlinking(enabled: boolean, intervalSec: number = 0.25): void {
    this.isBlinking = enabled;
    this.blinkInterval = intervalSec;
    this.blinkTimer = 0;
    this.blinkState = this.isLit;
  }

  /**
   * Synchronizes material color and emissive brightness based on state.
   */
  private syncMaterial(): void {
    const active = this.isBlinking ? this.blinkState : this.isLit;
    if (active) {
      this.material.color.setHex(this.color);
      this.material.emissive.setHex(this.color);
      this.material.emissiveIntensity = 1.2;
    } else {
      this.material.color.setHex(this.offColor);
      this.material.emissive.setHex(this.offColor);
      this.material.emissiveIntensity = 0.1;
    }
  }

  /**
   * Updates blinking timer animation.
   */
  public update(deltaSec: number): void {
    if (!this.isBlinking) return;

    this.blinkTimer += deltaSec;
    if (this.blinkTimer >= this.blinkInterval) {
      this.blinkTimer -= this.blinkInterval;
      this.blinkState = !this.blinkState;
      this.syncMaterial();
    }
  }
}

/**
 * LightGroup coordinates a collection of TableLights (e.g. Re-entry Lanes, Progress Ring, UFO lights)
 * and provides bulk operations like cycling lit states left/right, checking completion, etc.
 */
export class LightGroup {
  public id: string;
  public lights: TableLight[];

  constructor(id: string, lights: TableLight[] = []) {
    this.id = id;
    this.lights = lights;
  }

  public addLight(light: TableLight): void {
    this.lights.push(light);
  }

  public allLit(): boolean {
    return this.lights.length > 0 && this.lights.every((l) => l.isLit);
  }

  public allOff(): boolean {
    return this.lights.every((l) => !l.isLit);
  }

  public getLitCount(): number {
    return this.lights.filter((l) => l.isLit).length;
  }

  public getStates(): boolean[] {
    return this.lights.map((l) => l.isLit);
  }

  public setStates(states: boolean[]): void {
    for (let i = 0; i < this.lights.length; i++) {
      if (i < states.length) {
        if (states[i]) {
          this.lights[i].turnOn();
        } else {
          this.lights[i].turnOff();
        }
      }
    }
  }

  public turnAllOn(): void {
    for (const light of this.lights) {
      light.turnOn();
    }
  }

  public turnAllOff(): void {
    for (const light of this.lights) {
      light.turnOff();
    }
  }

  /**
   * Shifts lit states to the left (with wrap around).
   * Used when left flipper is activated.
   * Example: [L0, L1, L2] -> [L1, L2, L0]
   */
  public cycleLeft(): void {
    if (this.lights.length <= 1) return;
    const states = this.getStates();
    const first = states.shift()!;
    states.push(first);
    this.setStates(states);
  }

  /**
   * Shifts lit states to the right (with wrap around).
   * Used when right flipper is activated.
   * Example: [L0, L1, L2] -> [L2, L0, L1]
   */
  public cycleRight(): void {
    if (this.lights.length <= 1) return;
    const states = this.getStates();
    const last = states.pop()!;
    states.unshift(last);
    this.setStates(states);
  }

  /**
   * Updates all lights in the group.
   */
  public update(deltaSec: number): void {
    for (const light of this.lights) {
      light.update(deltaSec);
    }
  }
}

/**
 * Visual 18 Progress Lights Ring surrounding the central rank insignia (P3.2).
 */
export class ProgressLightsRingVisual {
  public mesh: THREE.Group;
  public lights: TableLight[] = [];
  public centerInsigniaMesh: THREE.Mesh;
  public insigniaMaterial: THREE.MeshStandardMaterial;

  private isCelebrating: boolean = false;
  private celebrationTimer: number = 0;

  constructor(options?: {
    center?: { x: number; y: number; z: number };
    radius?: number;
    count?: number;
    color?: number;
  }) {
    const center = options?.center ?? { x: 0, y: -4.0, z: 0.08 };
    const radius = options?.radius ?? 2.6;
    const count = options?.count ?? 18;
    const color = options?.color ?? COLORS.NEON_CYAN;

    this.mesh = new THREE.Group();
    this.mesh.name = 'progress-lights-ring';
    this.mesh.position.set(center.x, center.y, center.z);

    // 1. Central Rank Insignia Disc
    const insigniaGeom = new THREE.CylinderGeometry(radius * 0.55, radius * 0.6, 0.06, 32);
    insigniaGeom.rotateX(Math.PI / 2);
    this.insigniaMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a2436,
      emissive: color,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2,
    });
    this.centerInsigniaMesh = new THREE.Mesh(insigniaGeom, this.insigniaMaterial);
    this.centerInsigniaMesh.name = 'center-rank-insignia';
    this.mesh.add(this.centerInsigniaMesh);

    // Outer decorative chrome trim ring
    const trimGeom = new THREE.TorusGeometry(radius * 1.08, 0.04, 12, 48);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x445566,
      metalness: 0.9,
      roughness: 0.2,
    });
    const trimMesh = new THREE.Mesh(trimGeom, trimMat);
    this.mesh.add(trimMesh);

    // 2. 18 Radial Indicator Lamps
    for (let i = 0; i < count; i++) {
      // Angle starting from top (PI/2) rotating clockwise (-angle)
      const angle = Math.PI / 2 - (i / count) * Math.PI * 2;
      const lx = Math.cos(angle) * radius;
      const ly = Math.sin(angle) * radius;

      const light = new TableLight({
        id: `progress-light-${i}`,
        position: { x: lx, y: ly, z: 0 },
        radius: 0.18,
        color,
        offColor: 0x0c1420,
        isLit: false,
      });

      this.lights.push(light);
      this.mesh.add(light.mesh);
    }
  }

  public setLitCount(count: number): void {
    if (this.isCelebrating) return;
    for (let i = 0; i < this.lights.length; i++) {
      if (i < count) {
        this.lights[i].turnOn();
      } else {
        this.lights[i].turnOff();
      }
    }
  }

  public setStates(states: boolean[]): void {
    if (this.isCelebrating) return;
    for (let i = 0; i < this.lights.length; i++) {
      if (i < states.length && states[i]) {
        this.lights[i].turnOn();
      } else {
        this.lights[i].turnOff();
      }
    }
  }

  public celebratePromotion(durationSec: number = 2.0): void {
    this.isCelebrating = true;
    this.celebrationTimer = durationSec;

    for (const light of this.lights) {
      light.setColor(COLORS.NEON_YELLOW);
      light.setBlinking(true, 0.1);
    }
    this.insigniaMaterial.emissive.setHex(COLORS.NEON_YELLOW);
    this.insigniaMaterial.emissiveIntensity = 2.0;
  }

  public update(deltaSec: number): void {
    if (this.isCelebrating) {
      this.celebrationTimer -= deltaSec;
      if (this.celebrationTimer <= 0) {
        this.isCelebrating = false;
        for (const light of this.lights) {
          light.setColor(COLORS.NEON_CYAN);
          light.setBlinking(false);
          light.turnOff();
        }
        this.insigniaMaterial.emissive.setHex(COLORS.NEON_CYAN);
        this.insigniaMaterial.emissiveIntensity = 0.4;
      }
    }

    for (const light of this.lights) {
      light.update(deltaSec);
    }
  }
}

/**
 * Visual Energy Core Fuel Ladder Indicator Lamps (P3.5).
 */
export class EnergyCoreLadderVisual {
  public mesh: THREE.Group;
  public lights: TableLight[] = [];
  public color: number;
  public lowFuelColor: number;

  constructor(options?: {
    position?: { x: number; y: number; z: number };
    count?: number;
    spacing?: number;
    color?: number;
    lowFuelColor?: number;
  }) {
    const pos = options?.position ?? { x: -8.2, y: 11.0, z: 0.08 };
    const count = options?.count ?? 6;
    const spacing = options?.spacing ?? 1.2;
    this.color = options?.color ?? COLORS.NEON_GREEN;
    this.lowFuelColor = options?.lowFuelColor ?? COLORS.NEON_PINK;

    this.mesh = new THREE.Group();
    this.mesh.name = 'energy-core-ladder';
    this.mesh.position.set(pos.x, pos.y, pos.z);

    // Frame rail
    const frameHeight = count * spacing + 0.6;
    const frameGeom = new THREE.BoxGeometry(0.8, frameHeight, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x151c28,
      metalness: 0.8,
      roughness: 0.3,
    });
    const frameMesh = new THREE.Mesh(frameGeom, frameMat);
    frameMesh.position.set(0, -((count - 1) * spacing) / 2, -0.02);
    this.mesh.add(frameMesh);

    for (let i = 0; i < count; i++) {
      const ly = -i * spacing;
      const light = new TableLight({
        id: `energy-core-lamp-${i}`,
        position: { x: 0, y: ly, z: 0 },
        shape: 'rect',
        width: 0.6,
        length: 0.35,
        color: this.color,
        offColor: 0x0a1018,
        isLit: true,
      });
      this.lights.push(light);
      this.mesh.add(light.mesh);
    }
  }

  public setFuelPercentage(percentage: number, isLow: boolean): void {
    const clampedPct = Math.max(0, Math.min(percentage, 1.0));
    const activeCount = Math.ceil(clampedPct * this.lights.length);
    const activeColor = isLow ? this.lowFuelColor : this.color;

    // Bottom-to-top activation: index 0 is top, count - 1 is bottom
    // We light from bottom (index count - 1) upwards
    for (let i = 0; i < this.lights.length; i++) {
      const lampFromBottom = this.lights.length - 1 - i;
      const light = this.lights[i];
      light.setColor(activeColor);

      if (lampFromBottom < activeCount) {
        if (isLow) {
          light.setBlinking(true, 0.15);
        } else {
          light.turnOn();
        }
      } else {
        light.turnOff();
      }
    }
  }

  public update(deltaSec: number): void {
    for (const light of this.lights) {
      light.update(deltaSec);
    }
  }
}
