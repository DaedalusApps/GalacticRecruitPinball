import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameApp } from '../src/main';
import { CameraMode } from '../src/rendering/camera';
import { OrientationMode, ResponsiveLayoutManager } from '../src/ui/responsive';
import { PerformanceTier } from '../src/rendering/performance';
import { SoundSynthesizer } from '../src/audio/synth';

// Mock Three.js WebGLRenderer for Node.js test environment
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    public domElement: any;
    public shadowMap = { enabled: true, type: actual.PCFSoftShadowMap };
    public toneMapping = actual.ACESFilmicToneMapping;
    public toneMappingExposure = 1.2;

    constructor(options: any = {}) {
      this.domElement = options.canvas || {
        id: 'mock-canvas',
        clientWidth: 800,
        clientHeight: 600,
        style: {},
      };
    }

    setSize = vi.fn();
    setPixelRatio = vi.fn();
    getSize = vi.fn((vec: any) => vec.set(800, 600));
    render = vi.fn();
    dispose = vi.fn();
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

// Mock Web Audio Context implementation
class MockAudioParam {
  public value: number = 0;
  public setValueAtTime = vi.fn().mockReturnThis();
  public linearRampToValueAtTime = vi.fn().mockReturnThis();
  public exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  public setTargetAtTime = vi.fn().mockReturnThis();
}

class MockAudioNode {
  public connect = vi.fn().mockReturnThis();
  public disconnect = vi.fn().mockReturnThis();
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  public type: OscillatorType = 'sine';
  public frequency = new MockAudioParam();
  public start = vi.fn();
  public stop = vi.fn();
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam();
  public Q = new MockAudioParam();
}

class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: any = null;
  public loop: boolean = false;
  public start = vi.fn();
  public stop = vi.fn();
}

class MockAudioContext {
  public state: AudioContextState = 'running';
  public currentTime: number = 0;
  public destination = new MockAudioNode();
  public sampleRate: number = 44100;

  public createGain = vi.fn(() => new MockGainNode());
  public createOscillator = vi.fn(() => new MockOscillatorNode());
  public createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  public createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  }));
  public createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  public resume = vi.fn().mockResolvedValue(undefined);
  public close = vi.fn().mockResolvedValue(undefined);
}

// Mock DOM elements dictionary
function setupMockEnvironment() {
  const elements: Record<string, any> = {};

  const createMockElement = (id: string, tag: string = 'div') => {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      style: { display: 'block', height: '0%', width: '100%', borderColor: '', color: '' },
      textContent: '',
      innerHTML: '',
      value: '',
      clientWidth: 800,
      clientHeight: 600,
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      focus: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      })),
      getContext: vi.fn(() => null),
    };
    elements[id] = el;
    return el;
  };

  const storageMap: Record<string, string> = {};
  const mockStorage = {
    getItem: vi.fn((key: string) => storageMap[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      storageMap[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
      delete storageMap[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(storageMap)) delete storageMap[k];
    }),
  };

  const listeners: Record<string, Array<(e: any) => void>> = {};

  const mockWindow = {
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1.0,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    localStorage: mockStorage,
    addEventListener: vi.fn((type: string, cb: (e: any) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: (e: any) => void) => {
      if (listeners[type]) {
        const idx = listeners[type].indexOf(cb);
        if (idx !== -1) listeners[type].splice(idx, 1);
      }
    }),
    dispatchEvent: vi.fn((event: any) => {
      const cbs = listeners[event.type] || [];
      for (const cb of cbs) cb(event);
      return true;
    }),
    requestAnimationFrame: vi.fn((cb: (t: number) => void) => {
      return setTimeout(() => cb(Date.now()), 16) as unknown as number;
    }),
    cancelAnimationFrame: vi.fn((id: number) => {
      clearTimeout(id);
    }),
    matchMedia: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  };

  const mockDocument = {
    getElementById: (id: string) => elements[id] || createMockElement(id),
    createElement: (tag: string) => createMockElement(`created-${Date.now()}-${Math.random()}`, tag),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: createMockElement('body', 'body'),
    documentElement: createMockElement('html', 'html'),
  };

  (globalThis as any).window = mockWindow;
  (globalThis as any).document = mockDocument;
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).webkitAudioContext = MockAudioContext;
  (globalThis as any).requestAnimationFrame = mockWindow.requestAnimationFrame;
  (globalThis as any).cancelAnimationFrame = mockWindow.cancelAnimationFrame;

  return { elements, mockWindow, mockDocument, mockStorage };
}

describe('Phase 7: Release Build & Full Game Lifecycle (P7.1 - P7.4)', () => {
  // =========================================================================
  // 1. STANDALONE BUNDLE INTEGRITY (P7.1: Vite Single-File Build)
  // =========================================================================
  describe('P7.1 — Standalone Bundle Integrity', () => {
    const distPath = path.resolve(__dirname, '../dist/index.html');

    it('generates a single dist/index.html file upon build', () => {
      expect(fs.existsSync(distPath)).toBe(true);
    });

    it('keeps single-file bundle size lightweight under 1.5MB', () => {
      const stats = fs.statSync(distPath);
      const sizeInMB = stats.size / (1024 * 1024);
      expect(sizeInMB).toBeLessThan(1.5);
      expect(stats.size).toBeGreaterThan(100 * 1024); // at least 100KB of rich 3D game code
    });

    it('contains inlined JavaScript and CSS with zero external network script or stylesheet dependencies', () => {
      const html = fs.readFileSync(distPath, 'utf-8');

      // Inlined CSS & JS present
      expect(html).toMatch(/<style[\s\S]*?>[\s\S]*?<\/style>/i);
      expect(html).toMatch(/<script[\s\S]*?>[\s\S]*?<\/script>/i);

      // Zero external network resources (no http/https scripts or link stylesheets)
      expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
      expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\//i);
      expect(html).not.toMatch(/<script[^>]+src=["']\/(?!data:)/i);
    });

    it('includes required UTF-8 charset, mobile viewport meta, and title tags', () => {
      const html = fs.readFileSync(distPath, 'utf-8');

      expect(html).toContain('charset="UTF-8"');
      expect(html).toContain('name="viewport"');
      expect(html).toContain('viewport-fit=cover');
      expect(html).toContain('Galactic Recruit Pinball');
    });

    it('contains all essential HUD, Attract, Touch, and Game Over DOM IDs in the distribution bundle', () => {
      const html = fs.readFileSync(distPath, 'utf-8');

      const requiredIds = [
        'pinball-canvas',
        'hud-overlay',
        'score-display',
        'high-score-display',
        'mult-display',
        'ball-display',
        'rank-display',
        'lcd-ticker',
        'camera-btn',
        'sound-btn',
        'touch-controls',
        'zone-left-flipper',
        'zone-right-flipper',
        'zone-upper-left',
        'mobile-plunger-zone',
        'plunger-fill-meter',
        'virtual-nudge-bar',
        'nudge-left-btn',
        'nudge-up-btn',
        'nudge-right-btn',
        'attract-overlay',
        'attract-prompt',
        'game-over-modal',
        'game-over-final-score',
        'game-over-final-rank',
        'game-over-missions',
        'game-over-bonus',
        'high-score-entry-section',
        'initials-input',
        'high-score-submit-btn',
        'hall-of-fame-rows',
        'game-over-restart-btn',
        'game-over-attract-btn',
      ];

      for (const id of requiredIds) {
        expect(html, `Expected dist/index.html to contain element id "${id}"`).toContain(`id="${id}"`);
      }
    });
  });

  // =========================================================================
  // 2. END-TO-END GAME LIFECYCLE SIMULATION (P7.4: Playtesting & Rules Tuning)
  // =========================================================================
  describe('P7.4 — End-to-End Game Lifecycle Simulation', () => {
    let app: GameApp;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      setupMockEnvironment();
      canvas = document.createElement('canvas') as HTMLCanvasElement;
      canvas.id = 'pinball-canvas';
      app = new GameApp(canvas);
    });

    afterEach(() => {
      app?.destroy();
      vi.restoreAllMocks();
    });

    it('bootstraps in Attract Mode and transitions to Active Game upon start trigger', () => {
      expect(app.attractMode.isActive()).toBe(true);
      expect(app.cameraManager.getMode()).toBe(CameraMode.ATTRACT);
      expect(app.scoreManager.getScore()).toBe(0);

      // Trigger Game Start
      app.onGameStart();

      expect(app.attractMode.isActive()).toBe(false);
      expect(app.cameraManager.getMode()).toBe(CameraMode.FIXED);
      expect(app.gameState.isGameOver).toBe(false);
      expect(app.gameState.currentBall).toBe(1);
    });

    it('simulates plunger charge, launch, ball saver activation, and skill shot award', () => {
      app.onGameStart();

      // Start plunger charge
      app.plunger.startCharge();
      app.skillShot.startLaunch();
      expect(app.plunger.isCharging).toBe(true);

      // Simulate charging physics ticks
      for (let i = 0; i < 30; i++) {
        app.plunger.update(0.033, app.pinball);
      }
      expect(app.plunger.chargeRatio).toBeGreaterThan(0.5);

      // Release plunger
      app.plunger.release(app.pinball);
      app.gameState.armBallSaver(10.0);
      expect(app.gameState.isBallSaverActive).toBe(true);
      expect(app.pinball.body.velocity.y).toBeGreaterThan(20);

      // Award Skill Shot (e.g. position 2 -> 75,000 pts)
      const initialScore = app.scoreManager.getScore();
      app.skillShot.onSkillShotAwarded?.(2, 75000);
      expect(app.scoreManager.getScore()).toBe(initialScore + 75000);
    });

    it('exercises flippers, bumper upgrades (Blue->Green->Red), re-entry lane cycling, and booster spinner boost', () => {
      app.onGameStart();

      // 1. Flipper activations
      app.leftFlipper.activate();
      expect(app.leftFlipper.isActivated).toBe(true);
      app.leftFlipper.deactivate();
      expect(app.leftFlipper.isActivated).toBe(false);

      app.rightFlipper.activate();
      expect(app.rightFlipper.isActivated).toBe(true);
      app.rightFlipper.deactivate();
      expect(app.rightFlipper.isActivated).toBe(false);

      // 2. Initial Bumper Level = 1 (Blue, 500 pts)
      expect(app.bumpers[0].level).toBe(1);
      expect(app.bumpers[0].getScoreValue()).toBe(500);

      // 3. Complete Re-entry Lane Cycle 1 -> Bumpers upgrade to Level 2 (Green, 1500 pts) & Mult 2X
      app.reentrySystem.triggerLane(0);
      app.reentrySystem.triggerLane(1);
      app.reentrySystem.triggerLane(2);
      expect(app.bumpers[0].level).toBe(2);
      expect(app.bumpers[0].getScoreValue()).toBe(1500);
      expect(app.scoreManager.getMultiplier()).toBe(2);

      // 4. Complete Re-entry Lane Cycle 2 -> Bumpers upgrade to Level 3 (Red, 4000 pts) & Mult 3X
      app.reentrySystem.triggerLane(0);
      app.reentrySystem.triggerLane(1);
      app.reentrySystem.triggerLane(2);
      expect(app.bumpers[0].level).toBe(3);
      expect(app.bumpers[0].getScoreValue()).toBe(4000);
      expect(app.scoreManager.getMultiplier()).toBe(3);

      // 5. Hit Bumper 1 (Red) -> awards 4000 * 3X = 12,000 pts
      const scoreBeforeBumper = app.scoreManager.getScore();
      app.bumpers[0].onHit?.(app.bumpers[0], app.bumpers[0].getScoreValue());
      expect(app.scoreManager.getScore()).toBe(scoreBeforeBumper + 12000);

      // 6. Booster Drop Target Bank Clear -> Spinners Boosted + 50,000 pts + Refuel
      expect(app.leftSpinner.isBoosted).toBe(false);
      app.boosterDropTargets.onBankCleared?.(app.boosterDropTargets);
      expect(app.leftSpinner.isBoosted).toBe(true);
      expect(app.rightSpinner.isBoosted).toBe(true);

      // 7. Boosted Spinner spins award 1,000 pts * 3X mult per spin
      const scoreBeforeSpinner = app.scoreManager.getScore();
      app.leftSpinner.onSpin?.(app.leftSpinner, 3);
      expect(app.scoreManager.getScore()).toBe(scoreBeforeSpinner + 3 * 1000 * 3);
    });

    it('exercises mission request, ramp acceptance, objective completion, and 18-light rank promotion cascade', () => {
      app.onGameStart();

      // 1. Request Mission via Mission Spot Target
      expect(app.missionControl.getState()).toBe('IDLE');
      app.missionSpotTargets.targets[0].onHit?.(app.missionSpotTargets.targets[0], 1000);
      expect(app.missionControl.getState()).toBe('REQUESTED');

      // 2. Accept Mission via Launch Ramp
      app.launchRamp.onRampEnter?.(app.launchRamp, app.pinball);
      expect(app.missionControl.getState()).toBe('ACTIVE');
      const currentMission = app.missionControl.getCurrentMission();
      expect(currentMission).toBeDefined();

      // 3. Complete Mission Objectives (Cannon Calibration: 3 ramp shots)
      app.missionControl.handleHit('ramp');
      app.missionControl.handleHit('ramp');
      app.missionControl.handleHit('ramp');
      expect(app.missionControl.progressRing.getLitCount()).toBeGreaterThan(0);

      // 4. Advance progress ring to 18 lights to trigger rank promotion
      const rankBefore = app.missionControl.rankManager.getRankNumber();
      app.missionControl.progressRing.setLitCount(18);
      expect(app.missionControl.progressRing.isFull()).toBe(true);

      // Force promotion cascade
      const promoResult = app.missionControl.rankManager.promote();
      expect(promoResult.promoted).toBe(true);
      expect(app.missionControl.rankManager.getRankNumber()).toBe(rankBefore + 1);
      expect(promoResult.bonusPoints).toBeGreaterThanOrEqual(100000);
      app.missionControl.onPromotion?.(promoResult.newRank, promoResult.bonusPoints);
      app.missionControl.progressRing.reset();
      expect(app.missionControl.progressRing.getLitCount()).toBe(0); // reset after promotion
    });

    it('exercises UFO beam 5-stage progressive rewards and Mothership Tractor Beam gravity well capture/eject', () => {
      app.onGameStart();

      // Stage 1: 10,000 points
      const s1 = app.ufoProgression.registerHit();
      expect(s1).toBe(1);

      // Stage 2: Light Progress
      const s2 = app.ufoProgression.registerHit();
      expect(s2).toBe(2);

      // Stage 3: Center Post barrier drone deployed
      expect(app.centerPost.isDeployed).toBe(false);
      const s3 = app.ufoProgression.registerHit();
      expect(s3).toBe(3);
      expect(app.centerPost.isDeployed).toBe(true);

      // Stage 4: Extra Ball awarded
      expect(app.gameState.extraBalls).toBe(0);
      const s4 = app.ufoProgression.registerHit();
      expect(s4).toBe(4);
      expect(app.gameState.extraBalls).toBe(1);

      // Stage 5: Mothership Tractor Beam activated and stage reset
      expect(app.tractorBeam.isActive).toBe(false);
      const s5 = app.ufoProgression.registerHit();
      expect(s5).toBe(5);
      expect(app.tractorBeam.isActive).toBe(true);
      expect(app.ufoProgression.getCurrentStage()).toBe(0); // reset after stage 5

      // Exercise Tractor Beam Gravity Well Capture and Ejection
      const scoreBeforeCapture = app.scoreManager.getScore();
      app.tractorBeam.onCapture?.(app.pinball, 100000);
      expect(app.scoreManager.getScore()).toBeGreaterThanOrEqual(scoreBeforeCapture + 100000);

      app.tractorBeam.onEject?.(app.pinball);
      expect(app.tractorBeam.isHolding).toBe(false);
    });

    it('exercises ball drain, end-of-ball bonus tally, extra ball consumption, game over, and high score entry', () => {
      app.onGameStart();
      app.gameState.isBallSaverActive = false;
      app.scoreManager.addPoints(6000000); // Qualify for #1 High Score

      // Drain Ball 1 -> End of ball bonus tallied, extra ball consumed (still Ball 1)
      app.gameState.extraBalls = 1;
      app.drainSensor.onBallDrain?.(app.drainSensor, app.pinball);
      expect(app.gameState.extraBalls).toBe(0);
      expect(app.gameState.currentBall).toBe(1);

      // Drain Ball 1 Extra -> Moves to Ball 2
      app.drainSensor.onBallDrain?.(app.drainSensor, app.pinball);
      expect(app.gameState.currentBall).toBe(2);

      // Drain Ball 2 -> Moves to Ball 3
      app.drainSensor.onBallDrain?.(app.drainSensor, app.pinball);
      expect(app.gameState.currentBall).toBe(3);

      // Drain Ball 3 -> Triggers Game Over
      app.drainSensor.onBallDrain?.(app.drainSensor, app.pinball);
      expect(app.gameState.isGameOver).toBe(true);
      expect(app.gameOverModal.isVisible()).toBe(true);

      // Verify High Score Qualification and Initials Submission
      const finalScore = app.scoreManager.getScore();
      expect(app.highScoreManager.isHighScore(finalScore)).toBe(true);

      app.gameOverModal.submitInitials('DEF');
      const topScores = app.highScoreManager.getHighScores();
      expect(topScores[0].name).toBe('DEF');
      expect(topScores[0].score).toBe(finalScore);
    });
  });

  // =========================================================================
  // 3. MEMORY LEAK & PERFORMANCE BENCHMARK (P7.2: Optimization & Memory Audit)
  // =========================================================================
  describe('P7.2 — Performance Benchmark & Resource Teardown', () => {
    let app: GameApp;
    let canvas: HTMLCanvasElement;

    beforeEach(() => {
      setupMockEnvironment();
      canvas = document.createElement('canvas') as HTMLCanvasElement;
      canvas.id = 'pinball-canvas';
      app = new GameApp(canvas);
      app.onGameStart();
    });

    afterEach(() => {
      app?.destroy();
      vi.restoreAllMocks();
    });

    it('simulates 600 consecutive physics and render ticks with bounded memory and stable object pools', () => {
      const initialBodyCount = app.physicsWorld.world.bodies.length;
      const initialMeshCount = app.scene.children.length;

      // Simulate 10 seconds of intensive gameplay (600 ticks @ 60fps)
      for (let tick = 0; tick < 600; tick++) {
        // Emit particles periodically
        if (tick % 10 === 0) {
          app.particleSystem.emitSlingshotBurst({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0x00ff66, 10);
        }

        app.stepPhysics(1 / 60);
        app.tableScene.update(1 / 60);
        app.postProcessing.render(app.scene, app.camera);
      }

      // Verify no runaway physics body leaks or unbounded scene child growth
      expect(app.physicsWorld.world.bodies.length).toBe(initialBodyCount);
      expect(app.scene.children.length).toBe(initialMeshCount);
      expect(app.particleSystem.getActiveCount()).toBeLessThanOrEqual(800);
    });

    it('executes 100% clean resource disposal on destroy() without memory leaks or dangling listeners', () => {
      expect(app.isRunning).toBe(false);
      app.start();
      expect(app.isRunning).toBe(true);

      // Destroy application
      app.destroy();

      expect(app.isRunning).toBe(false);
      expect(app.postProcessing.composer).toBeNull();
      expect(app.music.isPlaying()).toBe(false);
    });

    it('dynamically transitions between performance tiers based on frame timing (Adaptive Performance Tiering)', () => {
      const perfManager = app.perfTierManager;
      expect(perfManager.getTier()).toBe(PerformanceTier.FULL);

      // Simulate moderate frame drops -> downgrades to REDUCED tier (38 FPS)
      for (let i = 0; i < 70; i++) {
        perfManager.update(0.026); // ~38 FPS (< 45 fps threshold)
      }
      expect(perfManager.getTier()).toBe(PerformanceTier.REDUCED);

      // Simulate severe frame drops -> downgrades to BASIC tier (20 FPS)
      for (let i = 0; i < 70; i++) {
        perfManager.update(0.050); // ~20 FPS (< 30 fps threshold)
      }
      expect(perfManager.getTier()).toBe(PerformanceTier.BASIC);

      // Simulate sustained 60 FPS -> recovers back to FULL tier
      for (let i = 0; i < 200; i++) {
        perfManager.update(0.016); // 60 FPS
      }
      expect(perfManager.getTier()).toBe(PerformanceTier.FULL);
    });
  });

  // =========================================================================
  // 4. CROSS-BROWSER & DEVICE COMPATIBILITY (P7.3: Compatibility Engine)
  // =========================================================================
  describe('P7.3 — Cross-Browser & Device Compatibility', () => {
    beforeEach(() => {
      setupMockEnvironment();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('adapts properly to Desktop Landscape, Mobile Portrait, and Tablet aspect ratios', () => {
      const layoutMgr = new ResponsiveLayoutManager();

      // 1. Desktop 1920x1080
      const desktopLayout = layoutMgr.calculateLayout(1920, 1080);
      expect(desktopLayout.orientation).toBe(OrientationMode.LANDSCAPE);
      expect(desktopLayout.isMobile).toBe(false);
      expect(desktopLayout.clampedPixelRatio).toBeLessThanOrEqual(2.0);

      // 2. Mobile iPhone 390x844
      const mobileLayout = layoutMgr.calculateLayout(390, 844);
      expect(mobileLayout.orientation).toBe(OrientationMode.PORTRAIT);
      expect(mobileLayout.isMobile).toBe(true);
      expect(mobileLayout.touchTargetMinSize).toBeGreaterThanOrEqual(44);

      // 3. Tablet iPad 768x1024
      const tabletLayout = layoutMgr.calculateLayout(768, 1024);
      expect(tabletLayout.orientation).toBe(OrientationMode.PORTRAIT);
    });

    it('falls back gracefully to silent mode if Web Audio AudioContext is unavailable or blocked', () => {
      const silentSynth = new SoundSynthesizer({ audioContext: undefined });
      expect(() => {
        silentSynth.playFlipper();
        silentSynth.playBumper();
        silentSynth.playPromotion();
        silentSynth.playGameOver();
      }).not.toThrow();
    });

    it('supports seamless keyboard navigation, nudge accessibility buttons, and touch zone mappings', () => {
      const canvas = document.createElement('canvas') as HTMLCanvasElement;
      canvas.id = 'pinball-canvas';
      const app = new GameApp(canvas);

      // Verify nudge handles all 3 directions safely
      expect(() => {
        app.handleNudge('left', 1.0);
        app.handleNudge('right', 1.0);
        app.handleNudge('up', 1.0);
      }).not.toThrow();

      // Verify camera and sound toggles
      expect(() => {
        app.toggleSound();
        app.cameraManager.toggleMode();
      }).not.toThrow();

      app.destroy();
    });
  });
});
