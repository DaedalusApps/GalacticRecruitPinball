import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Plunger } from '../src/physics/plunger';
import { KeyboardManager, EventListenerTarget } from '../src/input/keyboard';
import { PhysicsWorld } from '../src/physics/world';
import { Pinball } from '../src/physics/ball';
import { PLUNGER, BALL } from '../src/utils/constants';

class MockWindow implements EventListenerTarget {
  public listeners: Map<string, Array<(e: any) => void>> = new Map();

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

class MockKeyboardEvent {
  public type: string;
  public code: string;
  public key: string;
  public cancelable: boolean;
  public defaultPrevented: boolean = false;

  constructor(type: string, init?: { code?: string; key?: string; cancelable?: boolean }) {
    this.type = type;
    this.code = init?.code ?? '';
    this.key = init?.key ?? '';
    this.cancelable = init?.cancelable ?? false;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }
}

// Polyfill window and KeyboardEvent for node test environment if needed
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = new MockWindow();
}
if (typeof (globalThis as any).KeyboardEvent === 'undefined') {
  (globalThis as any).KeyboardEvent = MockKeyboardEvent;
}

describe('Plunger & Keyboard Input System (P0.7 & P0.8)', () => {
  describe('Plunger Initialization & Visual Assembly (P0.7)', () => {
    let plunger: Plunger;

    beforeEach(() => {
      plunger = new Plunger();
    });

    it('initializes Three.js 3D mesh hierarchy with rod, spring coil, and neon tip', () => {
      expect(plunger.mesh).toBeInstanceOf(THREE.Group);
      expect(plunger.mesh.name).toBe('plunger');

      expect(plunger.rodMesh).toBeInstanceOf(THREE.Mesh);
      expect(plunger.rodMesh.name).toBe('plunger-rod');

      expect(plunger.springMesh).toBeInstanceOf(THREE.Mesh);
      expect(plunger.springMesh.name).toBe('plunger-spring');

      expect(plunger.tipMesh).toBeInstanceOf(THREE.Mesh);
      expect(plunger.tipMesh.name).toBe('plunger-tip');

      // Verify tip has neon accent material
      expect(plunger.tipMesh.material).toBeInstanceOf(THREE.Material);
    });

    it('initializes Cannon-es physics body in plunger lane', () => {
      expect(plunger.body).toBeInstanceOf(CANNON.Body);
      expect(plunger.body.position.x).toBeCloseTo(PLUNGER.LANE_X, 2);
      expect(plunger.body.position.y).toBeLessThan(BALL.INITIAL_POSITION.y);
      expect(plunger.body.position.z).toBeCloseTo(0.5, 2);
    });

    it('initializes with zero charge ratio and idle state', () => {
      expect(plunger.chargeRatio).toBe(0);
      expect(plunger.isCharging).toBe(false);
    });
  });

  describe('Plunger Charging Mechanics & Animation (P0.7)', () => {
    let plunger: Plunger;

    beforeEach(() => {
      plunger = new Plunger();
    });

    it('starts charging when startCharge() is called', () => {
      plunger.startCharge();
      expect(plunger.isCharging).toBe(true);
      expect(plunger.chargeRatio).toBe(0);
    });

    it('increases chargeRatio towards 1.0 when updated over time', () => {
      plunger.startCharge();

      // Step half the max charge time
      const halfTime = PLUNGER.MAX_CHARGE_TIME_SEC / 2;
      plunger.update(halfTime);

      expect(plunger.chargeRatio).toBeGreaterThan(0.4);
      expect(plunger.chargeRatio).toBeLessThan(0.6);
      expect(plunger.chargeRatio).toBeCloseTo(0.5, 1);
    });

    it('clamps chargeRatio at 1.0 when held longer than max charge time', () => {
      plunger.startCharge();
      plunger.update(PLUNGER.MAX_CHARGE_TIME_SEC * 2);

      expect(plunger.chargeRatio).toBe(1.0);
    });

    it('pulls back visual assembly along -Y during charge', () => {
      const restTipY = plunger.tipMesh.position.y;
      plunger.startCharge();
      plunger.update(PLUNGER.MAX_CHARGE_TIME_SEC);

      expect(plunger.tipMesh.position.y).toBeLessThan(restTipY);
      expect(plunger.displacement).toBeGreaterThan(0);
    });

    it('releases charge, returns calculated launch force, and resets state', () => {
      plunger.startCharge();
      plunger.update(PLUNGER.MAX_CHARGE_TIME_SEC); // Full charge
      expect(plunger.chargeRatio).toBe(1.0);

      const force = plunger.release();
      expect(force).toBeCloseTo(PLUNGER.MAX_FORCE, 1);
      expect(plunger.isCharging).toBe(false);
      expect(plunger.chargeRatio).toBe(0);
    });
  });

  describe('Ball Launch Physical Interaction (P0.7)', () => {
    let physicsWorld: PhysicsWorld;
    let plunger: Plunger;
    let pinball: Pinball;

    beforeEach(() => {
      physicsWorld = new PhysicsWorld();
      plunger = new Plunger({ material: physicsWorld.wallMaterial });
      pinball = new Pinball({
        material: physicsWorld.ballMaterial,
        initialPosition: { x: BALL.INITIAL_POSITION.x, y: BALL.INITIAL_POSITION.y, z: BALL.INITIAL_POSITION.z },
      });
      physicsWorld.addPinball(pinball);
      physicsWorld.addBody(plunger.body);
    });

    it('detects ball in plunger lane correctly', () => {
      expect(plunger.isBallInPlungerLane(pinball)).toBe(true);

      // Move ball out to center playfield
      pinball.body.position.set(0, 0, 0.5);
      expect(plunger.isBallInPlungerLane(pinball)).toBe(false);
    });

    it('launches ball with vy > 25 units/s at full charge', () => {
      // Ball resting in plunger lane
      pinball.body.velocity.set(0, 0, 0);

      plunger.startCharge();
      plunger.update(PLUNGER.MAX_CHARGE_TIME_SEC, pinball);

      // Release plunger on ball
      plunger.release(pinball);

      expect(pinball.body.velocity.y).toBeGreaterThan(25);
    });

    it('launches ball with minimum force at zero charge time', () => {
      pinball.body.velocity.set(0, 0, 0);

      plunger.startCharge();
      // Release immediately without charging
      const force = plunger.release(pinball);

      expect(force).toBeCloseTo(PLUNGER.MIN_FORCE, 1);
      expect(pinball.body.velocity.y).toBeGreaterThan(0);
      expect(pinball.body.velocity.y).toBeLessThan(15);
    });

    it('does not launch ball if ball is not in plunger lane', () => {
      pinball.body.position.set(0, 0, 0.5);
      pinball.body.velocity.set(0, 0, 0);

      plunger.startCharge();
      plunger.update(PLUNGER.MAX_CHARGE_TIME_SEC, pinball);
      plunger.release(pinball);

      expect(pinball.body.velocity.y).toBe(0);
      expect(pinball.body.velocity.length()).toBe(0);
    });

    it('propels ball up table incline into upper playfield (y > 0) after full launch', () => {
      pinball.body.velocity.set(0, 0, 0);

      plunger.startCharge();
      plunger.update(PLUNGER.MAX_CHARGE_TIME_SEC, pinball);
      plunger.release(pinball);

      // Simulate physics step for 60 frames (1 second)
      let reachedUpperField = false;
      for (let i = 0; i < 60; i++) {
        plunger.update(1 / 60, pinball);
        physicsWorld.step(1 / 60);

        if (pinball.body.position.y > 0) {
          reachedUpperField = true;
          break;
        }
      }

      expect(reachedUpperField).toBe(true);
    });
  });

  describe('KeyboardManager Key Mapping & Actions (P0.8)', () => {
    let keyboard: KeyboardManager;
    let mockWindow: MockWindow;

    beforeEach(() => {
      mockWindow = new MockWindow();
      keyboard = new KeyboardManager(mockWindow);
    });

    afterEach(() => {
      keyboard.destroy();
    });

    it('tracks key down and key up states correctly', () => {
      expect(keyboard.isKeyDown('Space')).toBe(false);
      expect(keyboard.isKeyDown('KeyZ')).toBe(false);
      expect(keyboard.isKeyDown('KeyM')).toBe(false);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'Space' }));
      expect(keyboard.isKeyDown('Space')).toBe(true);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'Space' }));
      expect(keyboard.isKeyDown('Space')).toBe(false);
    });

    it('identifies flipper, plunger, nudge, and camera action keys', () => {
      // Left flipper
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyZ' }));
      expect(keyboard.isFlipperLeftActive()).toBe(true);
      mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'KeyZ' }));
      expect(keyboard.isFlipperLeftActive()).toBe(false);

      // Right flipper
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyM' }));
      expect(keyboard.isFlipperRightActive()).toBe(true);
      mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'KeyM' }));
      expect(keyboard.isFlipperRightActive()).toBe(false);

      // Plunger
      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'Space' }));
      expect(keyboard.isPlungerActive()).toBe(true);
      mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'Space' }));
      expect(keyboard.isPlungerActive()).toBe(false);
    });

    it('invokes registered action callbacks on keydown and keyup', () => {
      const leftDownSpy = vi.fn();
      const leftUpSpy = vi.fn();
      const plungerDownSpy = vi.fn();
      const plungerUpSpy = vi.fn();
      const cameraToggleSpy = vi.fn();
      const nudgeLeftSpy = vi.fn();
      const nudgeRightSpy = vi.fn();
      const nudgeUpSpy = vi.fn();

      keyboard.onFlipperLeft(leftDownSpy, leftUpSpy);
      keyboard.onPlunger(plungerDownSpy, plungerUpSpy);
      keyboard.onCameraToggle(cameraToggleSpy);
      keyboard.onNudgeLeft(nudgeLeftSpy);
      keyboard.onNudgeRight(nudgeRightSpy);
      keyboard.onNudgeUp(nudgeUpSpy);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyZ' }));
      expect(leftDownSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'KeyZ' }));
      expect(leftUpSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'Space' }));
      expect(plungerDownSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keyup', { code: 'Space' }));
      expect(plungerUpSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyC' }));
      expect(cameraToggleSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyX' }));
      expect(nudgeLeftSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'Period' }));
      expect(nudgeRightSpy).toHaveBeenCalledTimes(1);

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'ArrowUp' }));
      expect(nudgeUpSpy).toHaveBeenCalledTimes(1);
    });

    it('prevents default behavior for gaming keys', () => {
      const spaceEvent = new MockKeyboardEvent('keydown', { code: 'Space', cancelable: true });
      const preventSpy = vi.spyOn(spaceEvent, 'preventDefault');
      mockWindow.dispatchEvent(spaceEvent);

      expect(preventSpy).toHaveBeenCalled();
    });

    it('cleans up event listeners when destroyed', () => {
      keyboard.destroy();

      mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { code: 'KeyZ' }));
      expect(keyboard.isKeyDown('KeyZ')).toBe(false);
    });
  });

  describe('Cheat Code Sequence Buffer (P0.8 / P5.6)', () => {
    let keyboard: KeyboardManager;
    let mockWindow: MockWindow;

    beforeEach(() => {
      mockWindow = new MockWindow();
      keyboard = new KeyboardManager(mockWindow);
    });

    afterEach(() => {
      keyboard.destroy();
    });

    it('tracks typed characters in a cheat buffer', () => {
      for (const char of 'invasion') {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}` }));
      }
      expect(keyboard.getCheatBuffer()).toContain('invasion');
    });

    it('triggers cheat code callback when sequence matches', () => {
      const invasionCallback = vi.fn();
      const maxwavesCallback = vi.fn();

      keyboard.registerCheatCode('invasion', invasionCallback);
      keyboard.registerCheatCode('maxwaves', maxwavesCallback);

      for (const char of 'invasion') {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}` }));
      }

      expect(invasionCallback).toHaveBeenCalledTimes(1);
      expect(maxwavesCallback).not.toHaveBeenCalled();

      for (const char of 'maxwaves') {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}` }));
      }

      expect(maxwavesCallback).toHaveBeenCalledTimes(1);
    });

    it('resets cheat buffer on demand', () => {
      for (const char of 'abc') {
        mockWindow.dispatchEvent(new MockKeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}` }));
      }
      expect(keyboard.getCheatBuffer().length).toBeGreaterThan(0);

      keyboard.resetCheatBuffer();
      expect(keyboard.getCheatBuffer()).toBe('');
    });
  });
});
