import * as THREE from 'three';
import { TABLE } from '../utils/constants';

export interface ScreenShakeOptions {
  decayRate?: number;
  maxOffset?: { x: number; y: number; z: number };
  maxRoll?: number;
}

export class ScreenShake {
  private trauma: number = 0;
  public decayRate: number;
  public maxOffset: { x: number; y: number; z: number };
  public maxRoll: number;

  private offset: THREE.Vector3 = new THREE.Vector3();
  private rotationOffset: THREE.Euler = new THREE.Euler();
  private time: number = 0;

  constructor(options: ScreenShakeOptions = {}) {
    this.decayRate = options.decayRate ?? 1.5;
    this.maxOffset = options.maxOffset ?? { x: 0.8, y: 0.8, z: 0.4 };
    this.maxRoll = options.maxRoll ?? 0.05;
  }

  public getTrauma(): number {
    return this.trauma;
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, Math.max(0, this.trauma + amount));
  }

  public getShakeIntensity(): number {
    return this.trauma * this.trauma;
  }

  public update(deltaSec: number): void {
    if (this.trauma <= 0) {
      this.offset.set(0, 0, 0);
      this.rotationOffset.set(0, 0, 0);
      return;
    }

    this.time += deltaSec * 35.0; // High frequency shake
    const intensity = this.getShakeIntensity();

    // Pseudo-random pseudo-harmonic noise offsets
    const noiseX = Math.sin(this.time * 1.1) * Math.cos(this.time * 2.3);
    const noiseY = Math.cos(this.time * 1.3) * Math.sin(this.time * 1.7);
    const noiseZ = Math.sin(this.time * 0.9) * Math.cos(this.time * 1.5);
    const noiseRoll = Math.sin(this.time * 1.4) * Math.cos(this.time * 1.9);

    this.offset.set(
      noiseX * this.maxOffset.x * intensity,
      noiseY * this.maxOffset.y * intensity,
      noiseZ * this.maxOffset.z * intensity
    );

    this.rotationOffset.set(
      noiseY * this.maxRoll * 0.5 * intensity,
      noiseX * this.maxRoll * 0.5 * intensity,
      noiseRoll * this.maxRoll * intensity
    );

    // Decay trauma over time
    this.trauma = Math.max(0, this.trauma - this.decayRate * deltaSec);
  }

  public getOffset(): THREE.Vector3 {
    return this.offset;
  }

  public getRotationOffset(): THREE.Euler {
    return this.rotationOffset;
  }

  public reset(): void {
    this.trauma = 0;
    this.offset.set(0, 0, 0);
    this.rotationOffset.set(0, 0, 0);
  }
}

export enum CameraMode {
  FIXED = 'fixed',
  FOLLOW = 'follow',
  ATTRACT = 'attract',
}

export interface CameraManagerOptions {
  fixedPos?: THREE.Vector3;
  fixedTarget?: THREE.Vector3;
  followLerpSpeed?: number;
  orbitSpeed?: number;
}

export class CameraManager {
  public camera: THREE.PerspectiveCamera;
  public screenShake: ScreenShake;
  public mode: CameraMode = CameraMode.FIXED;

  public fixedPos: THREE.Vector3;
  public fixedTarget: THREE.Vector3;
  public currentPos: THREE.Vector3;
  public currentTarget: THREE.Vector3;

  public followLerpSpeed: number;
  public orbitSpeed: number;
  private orbitAngle: number = 0;

  constructor(camera: THREE.PerspectiveCamera, options: CameraManagerOptions = {}) {
    this.camera = camera;
    this.screenShake = new ScreenShake();

    this.fixedPos = options.fixedPos ?? new THREE.Vector3(0, -32, 28);
    this.fixedTarget = options.fixedTarget ?? new THREE.Vector3(0, 0, 0);

    this.currentPos = this.fixedPos.clone();
    this.currentTarget = this.fixedTarget.clone();

    this.followLerpSpeed = options.followLerpSpeed ?? 5.0;
    this.orbitSpeed = options.orbitSpeed ?? 0.35;

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentTarget);
  }

  public getMode(): CameraMode {
    return this.mode;
  }

  public setMode(mode: CameraMode): void {
    this.mode = mode;
  }

  public toggleMode(): void {
    if (this.mode === CameraMode.FIXED) {
      this.setMode(CameraMode.FOLLOW);
    } else {
      this.setMode(CameraMode.FIXED);
    }
  }

  /**
   * Updates camera position and orientation according to current mode and screen shake.
   */
  public update(deltaSec: number, ballPos?: { x: number; y: number; z: number }): void {
    // 1. Update Screen Shake offsets
    this.screenShake.update(deltaSec);

    // 2. Compute Mode-Specific Target Base Positions
    if (this.mode === CameraMode.ATTRACT) {
      this.orbitAngle += deltaSec * this.orbitSpeed;
      const radius = 32.0;
      const height = 24.0;
      const targetX = Math.sin(this.orbitAngle) * radius;
      const targetY = Math.cos(this.orbitAngle) * (radius * 0.9) - 4.0;

      this.currentPos.set(targetX, targetY, height);
      this.currentTarget.set(0, 2.0, 0);
    } else if (this.mode === CameraMode.FOLLOW && ballPos) {
      // Clamped smooth ball follow
      const halfW = TABLE.WIDTH / 2;
      const halfL = TABLE.LENGTH / 2;

      const clampedBallX = Math.max(-halfW * 0.7, Math.min(halfW * 0.7, ballPos.x));
      const clampedBallY = Math.max(-halfL * 0.8, Math.min(halfL * 0.8, ballPos.y));

      const desiredX = clampedBallX * 0.5;
      const desiredY = clampedBallY * 0.65 - 24.0;
      const desiredZ = 24.0;

      const targetLookX = clampedBallX * 0.35;
      const targetLookY = clampedBallY * 0.5;
      const targetLookZ = 0;

      const t = Math.min(1.0, deltaSec * this.followLerpSpeed);
      this.currentPos.lerp(new THREE.Vector3(desiredX, desiredY, desiredZ), t);
      this.currentTarget.lerp(new THREE.Vector3(targetLookX, targetLookY, targetLookZ), t);
    } else {
      // FIXED Classic Pinball View
      const t = Math.min(1.0, deltaSec * 6.0);
      this.currentPos.lerp(this.fixedPos, t);
      this.currentTarget.lerp(this.fixedTarget, t);
    }

    // 3. Apply Camera Position with Screen Shake offset
    const shakeOffset = this.screenShake.getOffset();
    this.camera.position.set(
      this.currentPos.x + shakeOffset.x,
      this.currentPos.y + shakeOffset.y,
      this.currentPos.z + shakeOffset.z
    );

    // 4. Orient Camera to Target
    this.camera.lookAt(
      this.currentTarget.x + shakeOffset.x * 0.5,
      this.currentTarget.y + shakeOffset.y * 0.5,
      this.currentTarget.z
    );

    // 5. Apply Rotational Shake Roll
    const rotOffset = this.screenShake.getRotationOffset();
    this.camera.rotation.z += rotOffset.z;
  }
}
