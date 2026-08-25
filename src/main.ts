import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TableScene } from './rendering/scene';
import { PhysicsWorld } from './physics/world';
import { Pinball } from './physics/ball';
import { Flipper } from './physics/flipper';
import { Plunger } from './physics/plunger';
import { KeyboardManager } from './input/keyboard';

export class GameApp {
  public tableScene: TableScene;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public physicsWorld: PhysicsWorld;
  public world: CANNON.World;
  public pinball: Pinball;
  public leftFlipper: Flipper;
  public rightFlipper: Flipper;
  public plunger: Plunger;
  public keyboard: KeyboardManager;
  public isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    // 1. Initialize Table Scene (Three.js Scene, Pinball Camera, Lights, Playfield, Cabinet)
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.tableScene = new TableScene(aspect);
    this.scene = this.tableScene.scene;
    this.camera = this.tableScene.camera;

    // 2. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // 3. Initialize Physics World, Pinball, Flippers & Plunger
    this.physicsWorld = new PhysicsWorld();
    this.world = this.physicsWorld.world;

    this.pinball = new Pinball({ material: this.physicsWorld.ballMaterial });
    this.physicsWorld.addPinball(this.pinball);
    this.scene.add(this.pinball.mesh);

    this.leftFlipper = new Flipper({
      side: 'left',
      material: this.physicsWorld.flipperMaterial,
    });
    this.physicsWorld.addFlipper(this.leftFlipper);
    this.scene.add(this.leftFlipper.mesh);

    this.rightFlipper = new Flipper({
      side: 'right',
      material: this.physicsWorld.flipperMaterial,
    });
    this.physicsWorld.addFlipper(this.rightFlipper);
    this.scene.add(this.rightFlipper.mesh);

    this.plunger = new Plunger({
      material: this.physicsWorld.wallMaterial,
    });
    this.physicsWorld.addBody(this.plunger.body);
    this.scene.add(this.plunger.mesh);

    // 4. Initialize Keyboard Controls
    this.keyboard = new KeyboardManager();
    this.setupKeyboardControls();

    // Handle Window Resizing
    window.addEventListener('resize', this.onResize);
  }

  private setupKeyboardControls(): void {
    // Flipper controls
    this.keyboard.onFlipperLeft(
      () => this.leftFlipper.activate(),
      () => this.leftFlipper.deactivate()
    );

    this.keyboard.onFlipperRight(
      () => this.rightFlipper.activate(),
      () => this.rightFlipper.deactivate()
    );

    // Plunger controls (Space / Enter / ArrowDown)
    this.keyboard.onPlunger(
      () => this.plunger.startCharge(),
      () => this.plunger.release(this.pinball)
    );

    // Nudge controls
    this.keyboard.onNudgeLeft(() => {
      this.pinball.applyImpulse({ x: 0.5, y: 0.1, z: 0 });
    });

    this.keyboard.onNudgeRight(() => {
      this.pinball.applyImpulse({ x: -0.5, y: 0.1, z: 0 });
    });

    this.keyboard.onNudgeUp(() => {
      this.pinball.applyImpulse({ x: 0, y: 0.8, z: 0 });
    });
  }

  public onResize = (): void => {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.tableScene.onResize(width, height);
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
    this.leftFlipper.update(deltaSec);
    this.rightFlipper.update(deltaSec);
    this.plunger.update(deltaSec, this.pinball);
    this.physicsWorld.step(deltaSec);
    this.pinball.sync();
  }

  private animate = (now: number): void => {
    if (!this.isRunning) return;
    const deltaSec = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.stepPhysics(deltaSec);
    this.tableScene.update(deltaSec);
    this.renderer.render(this.scene, this.camera);

    this.animFrameId = requestAnimationFrame(this.animate);
  };

  public destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.keyboard.destroy();
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
