import * as THREE from 'three';
import { COLORS } from '../utils/constants';

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  drag: number;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export interface ParticleBurstOptions {
  position: { x: number; y: number; z: number };
  count?: number;
  color?: number | THREE.Color;
  speed?: number;
  spread?: number;
  life?: number;
  gravity?: number;
  size?: number;
  direction?: { x: number; y: number; z: number };
  drag?: number;
}

export interface ParticleSystemOptions {
  maxParticles?: number;
}

export class ParticleSystem {
  public maxParticles: number;
  public particles: Particle[];
  public mesh: THREE.Points;
  public geometry: THREE.BufferGeometry;
  public material: THREE.PointsMaterial;

  private positions: Float32Array;
  private colors: Float32Array;
  private activeCount: number = 0;

  constructor(options: ParticleSystemOptions = {}) {
    this.maxParticles = options.maxParticles ?? 600;
    this.particles = [];

    // Pre-allocate particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        ax: 0,
        ay: 0,
        az: 0,
        drag: 0.98,
        color: new THREE.Color(COLORS.NEON_GREEN),
        size: 0.25,
        alpha: 1.0,
        life: 0,
        maxLife: 1.0,
        active: false,
      });
    }

    // Buffer attributes for GPU rendering
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.name = 'particle-system';
    this.mesh.frustumCulled = false;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Spawns a burst of particles from pool with configurable kinematics.
   */
  public emit(options: ParticleBurstOptions): void {
    const count = options.count ?? 15;
    const pos = options.position;
    const baseColor =
      typeof options.color === 'number'
        ? new THREE.Color(options.color)
        : options.color ?? new THREE.Color(COLORS.NEON_GREEN);
    const speed = options.speed ?? 8.0;
    const life = options.life ?? 0.8;
    const gravity = options.gravity ?? -9.8;
    const size = options.size ?? 0.3;
    const drag = options.drag ?? 0.96;
    const dir = options.direction;

    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      p.active = true;
      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;
      p.color.copy(baseColor);
      p.size = size * (0.8 + Math.random() * 0.4);
      p.maxLife = life * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.alpha = 1.0;
      p.drag = drag;
      p.ax = 0;
      p.ay = gravity;
      p.az = 0;

      if (dir) {
        // Directional spray
        const spread = options.spread ?? 0.4;
        p.vx = (dir.x + (Math.random() - 0.5) * spread) * speed * (0.8 + Math.random() * 0.4);
        p.vy = (dir.y + (Math.random() - 0.5) * spread) * speed * (0.8 + Math.random() * 0.4);
        p.vz = (dir.z + (Math.random() - 0.5) * spread) * speed * (0.8 + Math.random() * 0.4);
      } else {
        // Spherical / 2D radial burst
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI * 0.5;
        const rSpeed = speed * (0.5 + Math.random() * 0.8);
        p.vx = Math.cos(theta) * Math.cos(phi) * rSpeed;
        p.vy = Math.sin(theta) * Math.cos(phi) * rSpeed;
        p.vz = Math.sin(phi) * rSpeed * 0.5 + 2.0; // slight upward pop
      }

      spawned++;
    }

    this.updateActiveCount();
  }

  /**
   * Bumper hit radial spark burst.
   */
  public emitBumperBurst(position: { x: number; y: number; z: number }, color: number = COLORS.NEON_CYAN, count: number = 20): void {
    this.emit({
      position,
      count,
      color,
      speed: 10.0,
      life: 0.6,
      gravity: -6.0,
      size: 0.35,
    });
  }

  /**
   * Slingshot solenoid directional spark spray.
   */
  public emitSlingshotBurst(
    position: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number } = { x: 0, y: 1, z: 0.2 },
    color: number = COLORS.NEON_GREEN,
    count: number = 15
  ): void {
    this.emit({
      position,
      direction,
      count,
      color,
      speed: 12.0,
      spread: 0.5,
      life: 0.5,
      gravity: -8.0,
      size: 0.3,
    });
  }

  /**
   * UFO sinkhole vortex swirling inward spiral.
   */
  public emitVortexBurst(position: { x: number; y: number; z: number }, color: number = COLORS.NEON_YELLOW, count: number = 25): void {
    const c = new THREE.Color(color);
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      const angle = Math.random() * Math.PI * 2;
      const r = 1.2 + Math.random() * 0.8;

      p.active = true;
      p.x = position.x + Math.cos(angle) * r;
      p.y = position.y + Math.sin(angle) * r;
      p.z = position.z + 0.1;
      p.color.copy(c);
      p.size = 0.25;
      p.maxLife = 0.7;
      p.life = p.maxLife;
      p.alpha = 1.0;
      p.drag = 0.94;
      // Inward + tangential velocity (vortex spiral)
      const inwardSpeed = -3.0;
      const spinSpeed = 5.0;
      p.vx = Math.cos(angle) * inwardSpeed - Math.sin(angle) * spinSpeed;
      p.vy = Math.sin(angle) * inwardSpeed + Math.cos(angle) * spinSpeed;
      p.vz = 0.5;
      p.ax = 0;
      p.ay = 0;
      p.az = 0;

      spawned++;
    }
    this.updateActiveCount();
  }

  /**
   * Multi-colored fireworks explosion on promotion / mission complete / jackpot.
   */
  public emitFireworks(position: { x: number; y: number; z: number }, count: number = 50): void {
    const palette = [
      COLORS.NEON_CYAN,
      COLORS.NEON_GREEN,
      COLORS.NEON_PINK,
      COLORS.NEON_YELLOW,
      COLORS.NEON_ORANGE,
    ];

    for (let i = 0; i < palette.length; i++) {
      const subCount = Math.floor(count / palette.length);
      this.emit({
        position,
        count: subCount,
        color: palette[i],
        speed: 14.0 + Math.random() * 4.0,
        life: 1.2,
        gravity: -12.0,
        size: 0.4,
      });
    }
  }

  /**
   * Drain dissipating burst when ball is lost.
   */
  public emitDrainBurst(position: { x: number; y: number; z: number } = { x: 0, y: -20, z: 0.2 }): void {
    this.emit({
      position,
      count: 20,
      color: COLORS.NEON_PINK,
      speed: 6.0,
      life: 0.8,
      gravity: -4.0,
      size: 0.3,
    });
  }

  /**
   * Per-frame kinematics update, alpha fade, life decay, and buffer synchronization.
   */
  public update(deltaSec: number): void {
    let active = 0;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this.positions[i * 3] = 0;
        this.positions[i * 3 + 1] = 0;
        this.positions[i * 3 + 2] = -1000; // hide outside frustum
        continue;
      }

      p.life -= deltaSec;
      if (p.life <= 0) {
        p.active = false;
        this.positions[i * 3 + 2] = -1000;
        continue;
      }

      active++;

      // Velocity & Position kinematics
      p.vx += p.ax * deltaSec;
      p.vy += p.ay * deltaSec;
      p.vz += p.az * deltaSec;

      p.vx *= Math.pow(p.drag, deltaSec * 60);
      p.vy *= Math.pow(p.drag, deltaSec * 60);
      p.vz *= Math.pow(p.drag, deltaSec * 60);

      p.x += p.vx * deltaSec;
      p.y += p.vy * deltaSec;
      p.z += p.vz * deltaSec;

      // Table playfield floor bounce/clamp (z >= 0.05)
      if (p.z < 0.05) {
        p.z = 0.05;
        p.vz = -p.vz * 0.4;
      }

      const lifeRatio = p.life / p.maxLife;
      p.alpha = Math.max(0, lifeRatio);

      // Write to buffers
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;

      this.colors[i * 3] = p.color.r * p.alpha;
      this.colors[i * 3 + 1] = p.color.g * p.alpha;
      this.colors[i * 3 + 2] = p.color.b * p.alpha;
    }

    this.activeCount = active;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  private updateActiveCount(): void {
    let active = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      if (this.particles[i].active) active++;
    }
    this.activeCount = active;
  }

  /**
   * Resets all particles in the pool.
   */
  public clear(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
      this.positions[i * 3 + 2] = -1000;
    }
    this.activeCount = 0;
    if (this.geometry.attributes.position) {
      this.geometry.attributes.position.needsUpdate = true;
    }
  }
}
