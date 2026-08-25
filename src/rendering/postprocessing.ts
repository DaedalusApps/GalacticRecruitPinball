import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface PostProcessingOptions {
  bloomStrength?: number;
  bloomRadius?: number;
  bloomThreshold?: number;
  enabled?: boolean;
}

export class PostProcessingManager {
  public composer: EffectComposer | null = null;
  public renderPass: RenderPass | null = null;
  public bloomPass: UnrealBloomPass | null = null;
  public isBloomEnabled: boolean = true;
  private renderer: THREE.WebGLRenderer | null = null;

  constructor(options: PostProcessingOptions = {}) {
    this.isBloomEnabled = options.enabled ?? true;
  }

  /**
   * Initializes the EffectComposer pipeline with RenderPass and UnrealBloomPass.
   */
  public init(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    options: PostProcessingOptions = {}
  ): void {
    this.renderer = renderer;

    try {
      const size = new THREE.Vector2();
      renderer.getSize(size);

      this.composer = new EffectComposer(renderer);
      this.renderPass = new RenderPass(scene, camera);
      this.composer.addPass(this.renderPass);

      const strength = options.bloomStrength ?? 0.85;
      const radius = options.bloomRadius ?? 0.45;
      const threshold = options.bloomThreshold ?? 0.25;

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.x, size.y),
        strength,
        radius,
        threshold
      );
      this.bloomPass.enabled = this.isBloomEnabled;
      this.composer.addPass(this.bloomPass);
    } catch {
      // In non-WebGL or unsupported environments, gracefully fall back
      this.composer = null;
      this.bloomPass = null;
    }
  }

  /**
   * Renders the frame using post-processing composer if available, or direct renderer.
   */
  public render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (this.composer && this.isBloomEnabled) {
      this.composer.render();
    } else if (this.renderer) {
      this.renderer.render(scene, camera);
    }
  }

  /**
   * Updates composer buffer dimensions on viewport resize.
   */
  public setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  public setBloomEnabled(enabled: boolean): void {
    this.isBloomEnabled = enabled;
    if (this.bloomPass) {
      this.bloomPass.enabled = enabled;
    }
  }

  public setBloomStrength(strength: number): void {
    if (this.bloomPass) {
      this.bloomPass.strength = strength;
    }
  }

  public setBloomRadius(radius: number): void {
    if (this.bloomPass) {
      this.bloomPass.radius = radius;
    }
  }

  public setBloomThreshold(threshold: number): void {
    if (this.bloomPass) {
      this.bloomPass.threshold = threshold;
    }
  }

  public dispose(): void {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    this.bloomPass = null;
    this.renderPass = null;
  }
}
