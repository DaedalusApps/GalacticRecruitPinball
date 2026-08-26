import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TouchManager, TouchZone } from '../src/input/touch';
import { MotionManager } from '../src/input/motion';
import { ResponsiveLayoutManager, OrientationMode } from '../src/ui/responsive';
import { PerformanceTierManager, PerformanceTier } from '../src/rendering/performance';
import { PostProcessingManager } from '../src/rendering/postprocessing';
import { ParticleSystem } from '../src/rendering/particles';

// Mock DOM Touch Event helpers
class MockTouch {
  public identifier: number;
  public target: EventTarget;
  public clientX: number;
  public clientY: number;
  public pageX: number;
  public pageY: number;

  constructor(init: { identifier: number; clientX: number; clientY: number; target?: EventTarget }) {
    this.identifier = init.identifier;
    this.clientX = init.clientX;
    this.clientY = init.clientY;
    this.pageX = init.clientX;
    this.pageY = init.clientY;
    this.target = init.target ?? (globalThis as any);
  }
}

class MockTouchEvent {
  public type: string;
  public touches: MockTouch[];
  public targetTouches: MockTouch[];
  public changedTouches: MockTouch[];
  public cancelable: boolean;
  public defaultPrevented: boolean = false;

  constructor(
    type: string,
    init: {
      touches?: MockTouch[];
      targetTouches?: MockTouch[];
      changedTouches?: MockTouch[];
      cancelable?: boolean;
    }
  ) {
    this.type = type;
    this.touches = init.touches ?? [];
    this.targetTouches = init.targetTouches ?? [];
    this.changedTouches = init.changedTouches ?? [];
    this.cancelable = init.cancelable ?? true;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

class MockElement {
  public listeners: Map<string, Array<(e: any) => void>> = new Map();
  public clientWidth: number = 400;
  public clientHeight: number = 800;
  public style: Record<string, string> = {};

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  }

  addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void): void {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  dispatchEvent(event: any): boolean {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const cb of list) {
        cb(event);
      }
    }
    return true;
  }
}

describe('Mobile Mode Subsystems (Phase 6)', () => {
  describe('P6.1 & P6.2: TouchManager (Flipper Tap Zones & Plunger Gestures)', () => {
    let mockContainer: MockElement;
    let touchManager: TouchManager;

    beforeEach(() => {
      mockContainer = new MockElement();
      mockContainer.clientWidth = 400;
      mockContainer.clientHeight = 800;
      touchManager = new TouchManager({ container: mockContainer as any });
    });

    afterEach(() => {
      touchManager.destroy();
    });

    it('identifies Left Flipper zone in lower-left screen half', () => {
      const zone = touchManager.getZoneForCoordinates(100, 600);
      expect(zone).toBe(TouchZone.LEFT_FLIPPER);
    });

    it('identifies Right Flipper zone in lower-right screen half (excluding plunger corner)', () => {
      const zone = touchManager.getZoneForCoordinates(250, 500);
      expect(zone).toBe(TouchZone.RIGHT_FLIPPER);
    });

    it('identifies Upper-Left Flipper zone in upper-left quadrant', () => {
      const zone = touchManager.getZoneForCoordinates(80, 150);
      expect(zone).toBe(TouchZone.UPPER_LEFT_FLIPPER);
    });

    it('identifies Plunger zone in bottom-right corner', () => {
      const zone = touchManager.getZoneForCoordinates(360, 750);
      expect(zone).toBe(TouchZone.PLUNGER);
    });

    it('triggers flipper callbacks on touchstart and touchend', () => {
      const leftDownSpy = vi.fn();
      const leftUpSpy = vi.fn();
      const rightDownSpy = vi.fn();
      const rightUpSpy = vi.fn();

      touchManager.onFlipperLeft(leftDownSpy, leftUpSpy);
      touchManager.onFlipperRight(rightDownSpy, rightUpSpy);

      // Touch left flipper
      const touchLeft = new MockTouch({ identifier: 1, clientX: 100, clientY: 600 });
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchstart', {
          touches: [touchLeft],
          changedTouches: [touchLeft],
        })
      );

      expect(leftDownSpy).toHaveBeenCalledTimes(1);
      expect(touchManager.isFlipperLeftActive()).toBe(true);

      // Release left flipper
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchend', {
          touches: [],
          changedTouches: [touchLeft],
        })
      );

      expect(leftUpSpy).toHaveBeenCalledTimes(1);
      expect(touchManager.isFlipperLeftActive()).toBe(false);
    });

    it('handles simultaneous multi-touch inputs (two flippers at once)', () => {
      const leftDownSpy = vi.fn();
      const rightDownSpy = vi.fn();
      touchManager.onFlipperLeft(leftDownSpy);
      touchManager.onFlipperRight(rightDownSpy);

      const touchL = new MockTouch({ identifier: 1, clientX: 100, clientY: 500 });
      const touchR = new MockTouch({ identifier: 2, clientX: 300, clientY: 500 });

      // Start Left
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchstart', {
          touches: [touchL],
          changedTouches: [touchL],
        })
      );
      expect(leftDownSpy).toHaveBeenCalledTimes(1);
      expect(rightDownSpy).toHaveBeenCalledTimes(0);

      // Start Right simultaneously
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchstart', {
          touches: [touchL, touchR],
          changedTouches: [touchR],
        })
      );
      expect(rightDownSpy).toHaveBeenCalledTimes(1);
      expect(touchManager.isFlipperLeftActive()).toBe(true);
      expect(touchManager.isFlipperRightActive()).toBe(true);

      // Release Left while holding Right
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchend', {
          touches: [touchR],
          changedTouches: [touchL],
        })
      );
      expect(touchManager.isFlipperLeftActive()).toBe(false);
      expect(touchManager.isFlipperRightActive()).toBe(true);
    });

    it('handles plunger hold charging and release on touchend', () => {
      const plungerStartSpy = vi.fn();
      const plungerReleaseSpy = vi.fn();
      touchManager.onPlunger(plungerStartSpy, plungerReleaseSpy);

      const touchP = new MockTouch({ identifier: 3, clientX: 360, clientY: 750 });

      mockContainer.dispatchEvent(
        new MockTouchEvent('touchstart', {
          touches: [touchP],
          changedTouches: [touchP],
        })
      );
      expect(plungerStartSpy).toHaveBeenCalledTimes(1);
      expect(touchManager.isPlungerActive()).toBe(true);

      // Touch move / swipe downwards in plunger zone
      const touchPMoved = new MockTouch({ identifier: 3, clientX: 360, clientY: 790 });
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchmove', {
          touches: [touchPMoved],
          changedTouches: [touchPMoved],
        })
      );
      expect(touchManager.getPlungerSwipeDistance()).toBeGreaterThan(0);

      // Release plunger
      mockContainer.dispatchEvent(
        new MockTouchEvent('touchend', {
          touches: [],
          changedTouches: [touchPMoved],
        })
      );
      expect(plungerReleaseSpy).toHaveBeenCalledTimes(1);
      expect(touchManager.isPlungerActive()).toBe(false);
    });

    it('prevents default touch gestures to stop scrolling and zooming', () => {
      const touchEvent = new MockTouchEvent('touchstart', {
        touches: [new MockTouch({ identifier: 1, clientX: 100, clientY: 100 })],
        cancelable: true,
      });
      mockContainer.dispatchEvent(touchEvent);
      expect(touchEvent.defaultPrevented).toBe(true);
    });
  });

  describe('P6.3 & P6.8: MotionManager (Tilt-to-Nudge & Motion Permissions)', () => {
    let mockWindow: MockElement;
    let motionManager: MotionManager;

    beforeEach(() => {
      mockWindow = new MockElement();
      motionManager = new MotionManager({
        target: mockWindow as any,
        tiltThreshold: 15.0,
        cooldownMs: 200,
      });
    });

    afterEach(() => {
      motionManager.destroy();
    });

    it('filters minor accelerometer noise below threshold without triggering nudge', () => {
      const nudgeSpy = vi.fn();
      motionManager.onNudge(nudgeSpy);

      // Send minor gravity reading (~9.8 m/s^2)
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 0.5, y: 9.8, z: 1.0 },
      });

      // Small jitter (+2 m/s^2 delta)
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 2.5, y: 9.8, z: 1.0 },
      });

      expect(nudgeSpy).not.toHaveBeenCalled();
    });

    it('triggers Left Nudge on strong leftward tilt/shake (>15 m/s^2)', () => {
      const nudgeSpy = vi.fn();
      motionManager.onNudge(nudgeSpy);

      // Baseline
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 },
      });

      // Big positive X jerk (phone tilted / shaken left)
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 18.0, y: 9.8, z: 0 },
      });

      expect(nudgeSpy).toHaveBeenCalledTimes(1);
      expect(nudgeSpy).toHaveBeenCalledWith('left', expect.any(Number));
    });

    it('triggers Right Nudge on strong rightward tilt/shake (<-15 m/s^2)', () => {
      const nudgeSpy = vi.fn();
      motionManager.onNudge(nudgeSpy);

      // Baseline
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 },
      });

      // Big negative X jerk
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: -18.0, y: 9.8, z: 0 },
      });

      expect(nudgeSpy).toHaveBeenCalledTimes(1);
      expect(nudgeSpy).toHaveBeenCalledWith('right', expect.any(Number));
    });

    it('triggers Up Nudge on strong forward shake/tilt', () => {
      const nudgeSpy = vi.fn();
      motionManager.onNudge(nudgeSpy);

      // Baseline
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 },
      });

      // Big negative Y / forward jerk
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 0, y: -8.0, z: 0 }, // delta = -8 - 9.8 = -17.8
      });

      expect(nudgeSpy).toHaveBeenCalledTimes(1);
      expect(nudgeSpy).toHaveBeenCalledWith('up', expect.any(Number));
    });

    it('enforces cooldown period between consecutive tilt nudges', () => {
      const nudgeSpy = vi.fn();
      motionManager.onNudge(nudgeSpy);

      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 0, y: 9.8, z: 0 },
      });

      // Jerk 1
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: 20.0, y: 9.8, z: 0 },
      });
      expect(nudgeSpy).toHaveBeenCalledTimes(1);

      // Immediate Jerk 2 within cooldown (<200ms)
      mockWindow.dispatchEvent({
        type: 'devicemotion',
        accelerationIncludingGravity: { x: -20.0, y: 9.8, z: 0 },
      });
      expect(nudgeSpy).toHaveBeenCalledTimes(1); // Ignored due to cooldown
    });

    it('supports iOS 13+ DeviceMotionEvent.requestPermission flow', async () => {
      const mockRequestPermission = vi.fn().mockResolvedValue('granted');
      (globalThis as any).DeviceMotionEvent = {
        requestPermission: mockRequestPermission,
      };

      const result = await motionManager.requestPermission();
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
      expect(motionManager.isEnabled()).toBe(true);

      delete (globalThis as any).DeviceMotionEvent;
    });

    it('reports fallback nudge buttons needed when motion is unsupported or denied', async () => {
      // In environment without DeviceMotionEvent permission support
      await motionManager.requestPermission();
      expect(motionManager.shouldShowFallbackButtons()).toBe(true);
    });
  });

  describe('P6.4, P6.5 & P6.7: ResponsiveLayoutManager (Portrait/Landscape & DPI Scaling)', () => {
    let mockWindow: MockElement;
    let layoutManager: ResponsiveLayoutManager;

    beforeEach(() => {
      mockWindow = new MockElement();
      mockWindow.clientWidth = 390;
      mockWindow.clientHeight = 844; // iPhone 12/13/14 portrait dimensions
      layoutManager = new ResponsiveLayoutManager({
        windowTarget: mockWindow as any,
      });
    });

    afterEach(() => {
      layoutManager.destroy();
    });

    it('detects Portrait orientation when height > width', () => {
      expect(layoutManager.getOrientation(390, 844)).toBe(OrientationMode.PORTRAIT);
      expect(layoutManager.isPortrait(390, 844)).toBe(true);
      expect(layoutManager.isLandscape(390, 844)).toBe(false);
    });

    it('detects Landscape orientation when width > height', () => {
      expect(layoutManager.getOrientation(844, 390)).toBe(OrientationMode.LANDSCAPE);
      expect(layoutManager.isLandscape(844, 390)).toBe(true);
      expect(layoutManager.isPortrait(844, 390)).toBe(false);
    });

    it('clamps devicePixelRatio to maximum of 2 for crisp rendering and performance', () => {
      // High-DPI screen with DPR = 3 (e.g. iPhone Super Retina)
      expect(layoutManager.getClampedPixelRatio(3)).toBe(2);

      // Standard screen DPR = 1
      expect(layoutManager.getClampedPixelRatio(1)).toBe(1);

      // Mid-range screen DPR = 1.5
      expect(layoutManager.getClampedPixelRatio(1.5)).toBe(1.5);
    });

    it('calculates optimal table aspect ratio and scale for mobile viewport', () => {
      const dims = layoutManager.calculateLayout(390, 844);
      expect(dims.orientation).toBe(OrientationMode.PORTRAIT);
      expect(dims.canvasWidth).toBe(390);
      expect(dims.canvasHeight).toBe(844);
      expect(dims.isMobile).toBe(true);
      expect(dims.touchTargetMinSize).toBeGreaterThanOrEqual(44);
    });

    it('dispatches layout change listener on resize / orientation change', () => {
      const layoutSpy = vi.fn();
      layoutManager.onLayoutChange(layoutSpy);

      layoutManager.updateDimensions(844, 390);
      expect(layoutSpy).toHaveBeenCalledTimes(1);
      expect(layoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orientation: OrientationMode.LANDSCAPE,
        })
      );
    });
  });

  describe('P6.6: PerformanceTierManager (Adaptive Quality Scaling)', () => {
    let perfManager: PerformanceTierManager;
    let postProcessing: PostProcessingManager;
    let particleSystem: ParticleSystem;

    beforeEach(() => {
      postProcessing = new PostProcessingManager({ enabled: true });
      particleSystem = new ParticleSystem({ maxParticles: 800 });
      perfManager = new PerformanceTierManager({
        postProcessing,
        particleSystem,
        initialTier: PerformanceTier.FULL,
      });
    });

    it('initializes in FULL quality tier with max visual effects', () => {
      expect(perfManager.getTier()).toBe(PerformanceTier.FULL);
      expect(perfManager.getParticleCap()).toBe(800);
      expect(perfManager.isBloomEnabled()).toBe(true);
    });

    it('downgrades to REDUCED tier when average frame rate drops below 45 FPS', () => {
      // Simulate low FPS (frame time = 28ms ~ 35 FPS) over 60 frames
      for (let i = 0; i < 60; i++) {
        perfManager.recordFrame(0.028);
      }

      perfManager.evaluateTier();
      expect(perfManager.getTier()).toBe(PerformanceTier.REDUCED);
      expect(perfManager.getParticleCap()).toBe(300);
    });

    it('downgrades to BASIC tier when frame rate severely lags below 30 FPS', () => {
      perfManager.setTier(PerformanceTier.REDUCED);

      // Simulate severe lag (frame time = 45ms ~ 22 FPS)
      for (let i = 0; i < 60; i++) {
        perfManager.recordFrame(0.045);
      }

      perfManager.evaluateTier();
      expect(perfManager.getTier()).toBe(PerformanceTier.BASIC);
      expect(perfManager.getParticleCap()).toBe(100);
      expect(perfManager.isBloomEnabled()).toBe(false);
    });

    it('upgrades tier back to FULL when frame rate recovers smoothly to 60 FPS', () => {
      perfManager.setTier(PerformanceTier.REDUCED);

      // Simulate smooth 60 FPS (16.6ms)
      for (let i = 0; i < 120; i++) {
        perfManager.recordFrame(0.016);
      }

      perfManager.evaluateTier();
      expect(perfManager.getTier()).toBe(PerformanceTier.FULL);
      expect(perfManager.getParticleCap()).toBe(800);
      expect(perfManager.isBloomEnabled()).toBe(true);
    });

    it('applies tier configuration to rendering subsystems directly', () => {
      perfManager.setTier(PerformanceTier.BASIC);
      expect(postProcessing.isBloomEnabled).toBe(false);
    });
  });
});
