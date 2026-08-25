import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { COLORS, PHYSICS, TABLE } from './utils/constants';

export class GameApp {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public world: CANNON.World;
  public isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    // 1. Initialize Three.js Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.BG_DARK);

    // 2. Initialize Camera (Perspective, pinball table angle)
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    this.camera.position.set(0, -32, 28);
    this.camera.lookAt(0, 0, 0);

    // 3. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 4. Initialize Lighting
    const ambientLight = new THREE.AmbientLight(0x223344, 1.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, -10, 20);
    this.scene.add(dirLight);

    // 5. Initialize Cannon-es Physics World
    this.world = new CANNON.World();
    // Gravity pulls downwards along tilted Y-axis and into table Z-axis
    const gx = 0;
    const gy = -PHYSICS.GRAVITY_MAGNITUDE * Math.sin(PHYSICS.TABLE_TILT_RAD);
    const gz = -PHYSICS.GRAVITY_MAGNITUDE * Math.cos(PHYSICS.TABLE_TILT_RAD);
    this.world.gravity.set(gx, gy, gz);

    // Default contact material
    this.world.defaultContactMaterial.friction = TABLE.FRICTION;
    this.world.defaultContactMaterial.restitution = TABLE.RESTITUTION;

    // Handle Window Resizing
    window.addEventListener('resize', this.onResize);
  }

  public onResize = (): void => {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public stepPhysics(deltaSec: number): void {
    const clampedDelta = Math.min(deltaSec, 0.1);
    this.world.step(PHYSICS.TIME_STEP, clampedDelta, PHYSICS.MAX_SUB_STEPS);
  }

  private animate = (now: number): void => {
    if (!this.isRunning) return;
    const deltaSec = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.stepPhysics(deltaSec);
    this.renderer.render(this.scene, this.camera);

    this.animFrameId = requestAnimationFrame(this.animate);
  };

  public destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

// Auto-boot if in browser context with canvas present
if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pinball-canvas') as HTMLCanvasElement;
    if (canvas) {
      const app = new GameApp(canvas);
      app.onResize();
      app.start();
      (window as unknown as { __GAME_APP__: GameApp }).__GAME_APP__ = app;
    }
  });
}
