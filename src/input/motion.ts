export type NudgeDirection = 'left' | 'right' | 'up';
export type MotionNudgeCallback = (direction: NudgeDirection, force: number) => void;

export interface MotionManagerOptions {
  target?: EventTarget | null;
  tiltThreshold?: number; // m/s^2 delta threshold (default 15.0)
  cooldownMs?: number; // minimum time between nudges (default 250ms)
}

/**
 * MotionManager handles accelerometer DeviceMotion events for tilt-to-nudge mechanics.
 * Features noise filtering, delta thresholding, iOS permission requests, and fallback status.
 */
export class MotionManager {
  private target: EventTarget | null = null;
  private tiltThreshold: number;
  private cooldownMs: number;

  private enabled: boolean = false;
  private hasPermission: boolean = false;
  private isMotionSupported: boolean = false;
  private lastNudgeTime: number = 0;

  private lastAccX: number | null = null;
  private lastAccY: number | null = null;
  private lastAccZ: number | null = null;

  private nudgeCallbacks: MotionNudgeCallback[] = [];

  constructor(options: MotionManagerOptions = {}) {
    this.target =
      options.target !== undefined
        ? options.target
        : typeof window !== 'undefined'
        ? window
        : null;

    this.tiltThreshold = options.tiltThreshold ?? 15.0;
    this.cooldownMs = options.cooldownMs ?? 250;

    this.init();
  }

  private init(): void {
    if (typeof window !== 'undefined') {
      const dme = (window as any).DeviceMotionEvent;
      if (dme) {
        this.isMotionSupported = true;
        if (typeof dme.requestPermission !== 'function') {
          // Non-iOS standard motion support
          this.enabled = true;
          this.hasPermission = true;
          this.bindEvents();
        }
      }
    } else if (this.target) {
      // In explicit mock/target test mode
      this.enabled = true;
      this.hasPermission = true;
      this.isMotionSupported = true;
      this.bindEvents();
    }
  }

  private bindEvents(): void {
    if (this.target) {
      this.target.addEventListener('devicemotion', this.handleDeviceMotion as EventListener);
    }
  }

  /**
   * Requests permission on iOS 13+ devices or checks support.
   */
  public async requestPermission(): Promise<'granted' | 'denied' | 'unsupported'> {
    const globalObj = typeof window !== 'undefined' ? window : (globalThis as any);
    const dme = globalObj?.DeviceMotionEvent;

    if (dme && typeof dme.requestPermission === 'function') {
      try {
        const response = await dme.requestPermission();
        if (response === 'granted') {
          this.hasPermission = true;
          this.enabled = true;
          this.isMotionSupported = true;
          this.bindEvents();
          return 'granted';
        } else {
          this.hasPermission = false;
          this.enabled = false;
          return 'denied';
        }
      } catch {
        this.hasPermission = false;
        this.enabled = false;
        return 'denied';
      }
    }

    if (typeof window !== 'undefined' && 'ondevicemotion' in window) {
      this.hasPermission = true;
      this.enabled = true;
      this.isMotionSupported = true;
      this.bindEvents();
      return 'granted';
    }

    // Unsupported
    this.enabled = false;
    this.hasPermission = false;
    this.isMotionSupported = false;
    return 'unsupported';
  }

  public handleDeviceMotion = (e: any): void => {
    if (!this.enabled) return;

    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc || acc.x === null || acc.x === undefined) return;

    const currX = acc.x ?? 0;
    const currY = acc.y ?? 0;
    const currZ = acc.z ?? 0;

    if (this.lastAccX === null || this.lastAccY === null || this.lastAccZ === null) {
      this.lastAccX = currX;
      this.lastAccY = currY;
      this.lastAccZ = currZ;
      return;
    }

    // Calculate acceleration delta (jerk)
    const deltaX = currX - this.lastAccX;
    const deltaY = currY - this.lastAccY;
    const deltaZ = currZ - this.lastAccZ;

    // Update baseline with low-pass filter
    this.lastAccX = this.lastAccX * 0.8 + currX * 0.2;
    this.lastAccY = this.lastAccY * 0.8 + currY * 0.2;
    this.lastAccZ = this.lastAccZ * 0.8 + currZ * 0.2;

    const now = performance.now();
    if (now - this.lastNudgeTime < this.cooldownMs) {
      return;
    }

    // Check threshold for Left, Right, Up tilts
    if (deltaX > this.tiltThreshold) {
      this.triggerNudge('left', Math.abs(deltaX));
      this.lastNudgeTime = now;
    } else if (deltaX < -this.tiltThreshold) {
      this.triggerNudge('right', Math.abs(deltaX));
      this.lastNudgeTime = now;
    } else if (deltaY < -this.tiltThreshold || deltaZ > this.tiltThreshold) {
      this.triggerNudge('up', Math.max(Math.abs(deltaY), Math.abs(deltaZ)));
      this.lastNudgeTime = now;
    }
  };

  private triggerNudge(direction: NudgeDirection, forceMagnitude: number): void {
    const normalizedForce = Math.min(2.0, Math.max(0.5, forceMagnitude / this.tiltThreshold));
    for (const cb of this.nudgeCallbacks) {
      cb(direction, normalizedForce);
    }
  }

  public onNudge(callback: MotionNudgeCallback): () => void {
    this.nudgeCallbacks.push(callback);
    return () => {
      this.nudgeCallbacks = this.nudgeCallbacks.filter((cb) => cb !== callback);
    };
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public hasMotionPermission(): boolean {
    return this.hasPermission;
  }

  public shouldShowFallbackButtons(): boolean {
    return !this.enabled || !this.hasPermission || !this.isMotionSupported;
  }

  public destroy(): void {
    if (this.target) {
      this.target.removeEventListener('devicemotion', this.handleDeviceMotion as EventListener);
    }
    this.nudgeCallbacks = [];
    this.enabled = false;
  }
}
