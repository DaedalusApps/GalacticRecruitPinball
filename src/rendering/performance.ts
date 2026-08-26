import * as THREE from 'three';
import { PostProcessingManager } from './postprocessing';
import { ParticleSystem } from './particles';

export enum PerformanceTier {
  FULL = 'FULL',
  REDUCED = 'REDUCED',
  BASIC = 'BASIC',
}

export interface TierConfig {
  bloomEnabled: boolean;
  bloomStrength: number;
  particleCap: number;
  shadowMapResolution: number;
  shadowsEnabled: boolean;
}

export const TIER_CONFIGS: Record<PerformanceTier, TierConfig> = {
  [PerformanceTier.FULL]: {
    bloomEnabled: true,
    bloomStrength: 0.85,
    particleCap: 800,
    shadowMapResolution: 2048,
    shadowsEnabled: true,
  },
  [PerformanceTier.REDUCED]: {
    bloomEnabled: true,
    bloomStrength: 0.4,
    particleCap: 300,
    shadowMapResolution: 1024,
    shadowsEnabled: true,
  },
  [PerformanceTier.BASIC]: {
    bloomEnabled: false,
    bloomStrength: 0.0,
    particleCap: 100,
    shadowMapResolution: 512,
    shadowsEnabled: false,
  },
};

export type TierChangeCallback = (newTier: PerformanceTier, config: TierConfig) => void;

export interface PerformanceTierOptions {
  postProcessing?: PostProcessingManager | null;
  particleSystem?: ParticleSystem | null;
  renderer?: THREE.WebGLRenderer | null;
  spotLight?: THREE.SpotLight | null;
  initialTier?: PerformanceTier;
  sampleWindow?: number;
  downgradeFpsThreshold?: number;
  basicFpsThreshold?: number;
  upgradeFpsThreshold?: number;
}

/**
 * PerformanceTierManager dynamically monitors rolling frame durations and FPS,
 * automatically adjusting bloom, particle pool caps, and shadow map resolutions
 * between FULL, REDUCED, and BASIC quality tiers to maintain smooth frame rates.
 */
export class PerformanceTierManager {
  private currentTier: PerformanceTier;
  private postProcessing: PostProcessingManager | null;
  private particleSystem: ParticleSystem | null;
  private renderer: THREE.WebGLRenderer | null;
  private spotLight: THREE.SpotLight | null;

  private frameTimes: number[] = [];
  private sampleWindow: number;
  private downgradeFpsThreshold: number;
  private basicFpsThreshold: number;
  private upgradeFpsThreshold: number;

  private tierCallbacks: TierChangeCallback[] = [];

  constructor(options: PerformanceTierOptions = {}) {
    this.currentTier = options.initialTier ?? PerformanceTier.FULL;
    this.postProcessing = options.postProcessing ?? null;
    this.particleSystem = options.particleSystem ?? null;
    this.renderer = options.renderer ?? null;
    this.spotLight = options.spotLight ?? null;

    this.sampleWindow = options.sampleWindow ?? 60;
    this.downgradeFpsThreshold = options.downgradeFpsThreshold ?? 45;
    this.basicFpsThreshold = options.basicFpsThreshold ?? 30;
    this.upgradeFpsThreshold = options.upgradeFpsThreshold ?? 56;

    this.applyTier(this.currentTier);
  }

  public getTier(): PerformanceTier {
    return this.currentTier;
  }

  public getConfig(): TierConfig {
    return TIER_CONFIGS[this.currentTier];
  }

  public getParticleCap(): number {
    return TIER_CONFIGS[this.currentTier].particleCap;
  }

  public isBloomEnabled(): boolean {
    return TIER_CONFIGS[this.currentTier].bloomEnabled;
  }

  public setTier(tier: PerformanceTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    this.applyTier(tier);
    for (const cb of this.tierCallbacks) {
      cb(tier, TIER_CONFIGS[tier]);
    }
  }

  public recordFrame(deltaSec: number): void {
    if (deltaSec <= 0) return;
    this.frameTimes.push(deltaSec);
    if (this.frameTimes.length > this.sampleWindow) {
      this.frameTimes.shift();
    }
  }

  public getAverageFps(): number {
    if (this.frameTimes.length === 0) return 60;
    const sum = this.frameTimes.reduce((acc, val) => acc + val, 0);
    const avgDelta = sum / this.frameTimes.length;
    return avgDelta > 0 ? 1 / avgDelta : 60;
  }

  public evaluateTier(): void {
    if (this.frameTimes.length < Math.min(30, this.sampleWindow)) return;

    const avgFps = this.getAverageFps();

    if (avgFps < this.basicFpsThreshold) {
      if (this.currentTier !== PerformanceTier.BASIC) {
        this.setTier(PerformanceTier.BASIC);
      }
    } else if (avgFps < this.downgradeFpsThreshold) {
      if (this.currentTier === PerformanceTier.FULL) {
        this.setTier(PerformanceTier.REDUCED);
      }
    } else if (avgFps >= this.upgradeFpsThreshold) {
      if (this.currentTier === PerformanceTier.BASIC) {
        this.setTier(PerformanceTier.REDUCED);
      } else if (this.currentTier === PerformanceTier.REDUCED) {
        this.setTier(PerformanceTier.FULL);
      }
    }
  }

  private applyTier(tier: PerformanceTier): void {
    const config = TIER_CONFIGS[tier];

    // 1. Configure Bloom & PostProcessing
    if (this.postProcessing) {
      this.postProcessing.setBloomEnabled(config.bloomEnabled);
      this.postProcessing.setBloomStrength(config.bloomStrength);
    }

    // 2. Configure Particle pool max active limit
    if (this.particleSystem) {
      this.particleSystem.maxParticles = config.particleCap;
    }

    // 3. Configure Shadow Maps
    if (this.spotLight && this.spotLight.shadow) {
      this.spotLight.castShadow = config.shadowsEnabled;
      if (this.spotLight.shadow.mapSize) {
        this.spotLight.shadow.mapSize.width = config.shadowMapResolution;
        this.spotLight.shadow.mapSize.height = config.shadowMapResolution;
      }
    }

    if (this.renderer && this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = config.shadowsEnabled;
    }
  }

  public update(deltaSec: number): void {
    this.recordFrame(deltaSec);
    this.evaluateTier();
  }

  public onTierChange(callback: TierChangeCallback): () => void {
    this.tierCallbacks.push(callback);
    return () => {
      this.tierCallbacks = this.tierCallbacks.filter((cb) => cb !== callback);
    };
  }
}
