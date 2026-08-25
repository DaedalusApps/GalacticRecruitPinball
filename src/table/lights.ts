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
