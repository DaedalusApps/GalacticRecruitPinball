import { CONTROLS } from '../utils/constants';

export type KeyActionCallback = () => void;

export interface EventListenerTarget {
  addEventListener(type: string, listener: (e: any) => void): void;
  removeEventListener(type: string, listener: (e: any) => void): void;
}

interface ActionBinding {
  codes: readonly string[];
  downCallbacks: KeyActionCallback[];
  upCallbacks: KeyActionCallback[];
  isTriggered: boolean;
}

const GAMING_PREVENT_DEFAULT_KEYS: readonly string[] = [
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
];

/**
 * KeyboardManager manages desktop keyboard controls, action bindings,
 * preventDefault handling for gaming keys, and cheat code sequence buffers.
 */
export class KeyboardManager {
  private keyStates: Map<string, boolean> = new Map();
  private bindings: Map<string, ActionBinding> = new Map();
  private cheatBuffer: string = '';
  private maxCheatBufferLength: number = 32;
  private cheatCallbacks: Map<string, KeyActionCallback[]> = new Map();
  private target: EventListenerTarget | null = null;

  constructor(target?: EventListenerTarget | null) {
    this.target =
      target !== undefined
        ? target
        : typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined' && (globalThis as any).window
        ? (globalThis as any).window
        : null;

    this.initBindings();
    this.bindEvents();
  }

  private initBindings(): void {
    const defineAction = (name: string, codes: readonly string[]) => {
      this.bindings.set(name, {
        codes,
        downCallbacks: [],
        upCallbacks: [],
        isTriggered: false,
      });
    };

    defineAction('flipperLeft', CONTROLS.LEFT_FLIPPER);
    defineAction('flipperRight', CONTROLS.RIGHT_FLIPPER);
    defineAction('flipperUpperLeft', CONTROLS.UPPER_LEFT_FLIPPER);
    defineAction('plunger', CONTROLS.PLUNGER);
    defineAction('nudgeLeft', CONTROLS.NUDGE_LEFT);
    defineAction('nudgeRight', CONTROLS.NUDGE_RIGHT);
    defineAction('nudgeUp', CONTROLS.NUDGE_UP);
    defineAction('cameraToggle', CONTROLS.CAMERA_TOGGLE);
    defineAction('soundToggle', CONTROLS.SOUND_TOGGLE);
    defineAction('pause', CONTROLS.PAUSE);
  }

  private bindEvents(): void {
    if (this.target) {
      this.target.addEventListener('keydown', this.handleKeyDown);
      this.target.addEventListener('keyup', this.handleKeyUp);
    }
  }

  public handleKeyDown = (e: { code: string; key?: string; preventDefault?: () => void }): void => {
    // 1. Prevent default behavior for gaming keys
    if (GAMING_PREVENT_DEFAULT_KEYS.includes(e.code)) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }

    const wasDown = this.keyStates.get(e.code) ?? false;
    this.keyStates.set(e.code, true);

    // 2. Track cheat code sequences (letters and numbers)
    if (e.key && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      this.cheatBuffer += e.key.toLowerCase();
      if (this.cheatBuffer.length > this.maxCheatBufferLength) {
        this.cheatBuffer = this.cheatBuffer.slice(-this.maxCheatBufferLength);
      }
      this.checkCheatCodes();
    }

    // 3. Trigger action down callbacks if not already held down (repeat suppression)
    if (!wasDown) {
      for (const binding of this.bindings.values()) {
        if (binding.codes.includes(e.code)) {
          if (!binding.isTriggered) {
            binding.isTriggered = true;
            for (const cb of binding.downCallbacks) {
              cb();
            }
          }
        }
      }
    }
  };

  public handleKeyUp = (e: { code: string }): void => {
    this.keyStates.set(e.code, false);

    // Check if any binding is no longer triggered by any of its keys
    for (const binding of this.bindings.values()) {
      if (binding.codes.includes(e.code)) {
        const stillHeld = binding.codes.some((code) => this.keyStates.get(code) === true);
        if (!stillHeld && binding.isTriggered) {
          binding.isTriggered = false;
          for (const cb of binding.upCallbacks) {
            cb();
          }
        }
      }
    }
  };

  /**
   * Registers a listener for an action's down/up states.
   */
  private registerAction(
    actionName: string,
    downCallback: KeyActionCallback,
    upCallback?: KeyActionCallback
  ): () => void {
    const binding = this.bindings.get(actionName);
    if (!binding) return () => {};

    binding.downCallbacks.push(downCallback);
    if (upCallback) {
      binding.upCallbacks.push(upCallback);
    }

    return () => {
      const dIdx = binding.downCallbacks.indexOf(downCallback);
      if (dIdx !== -1) binding.downCallbacks.splice(dIdx, 1);
      if (upCallback) {
        const uIdx = binding.upCallbacks.indexOf(upCallback);
        if (uIdx !== -1) binding.upCallbacks.splice(uIdx, 1);
      }
    };
  }

  // --- Convenience Action Subscriptions ---

  public onFlipperLeft(downCb: KeyActionCallback, upCb?: KeyActionCallback): () => void {
    return this.registerAction('flipperLeft', downCb, upCb);
  }

  public onFlipperRight(downCb: KeyActionCallback, upCb?: KeyActionCallback): () => void {
    return this.registerAction('flipperRight', downCb, upCb);
  }

  public onFlipperUpperLeft(downCb: KeyActionCallback, upCb?: KeyActionCallback): () => void {
    return this.registerAction('flipperUpperLeft', downCb, upCb);
  }

  public onPlunger(downCb: KeyActionCallback, upCb?: KeyActionCallback): () => void {
    return this.registerAction('plunger', downCb, upCb);
  }

  public onCameraToggle(cb: KeyActionCallback): () => void {
    return this.registerAction('cameraToggle', cb);
  }

  public onNudgeLeft(cb: KeyActionCallback): () => void {
    return this.registerAction('nudgeLeft', cb);
  }

  public onNudgeRight(cb: KeyActionCallback): () => void {
    return this.registerAction('nudgeRight', cb);
  }

  public onNudgeUp(cb: KeyActionCallback): () => void {
    return this.registerAction('nudgeUp', cb);
  }

  public onSoundToggle(cb: KeyActionCallback): () => void {
    return this.registerAction('soundToggle', cb);
  }

  public onPause(cb: KeyActionCallback): () => void {
    return this.registerAction('pause', cb);
  }

  // --- Key State Queries ---

  public isKeyDown(code: string): boolean {
    return this.keyStates.get(code) ?? false;
  }

  public isFlipperLeftActive(): boolean {
    return CONTROLS.LEFT_FLIPPER.some((code) => this.isKeyDown(code));
  }

  public isFlipperRightActive(): boolean {
    return CONTROLS.RIGHT_FLIPPER.some((code) => this.isKeyDown(code));
  }

  public isPlungerActive(): boolean {
    return CONTROLS.PLUNGER.some((code) => this.isKeyDown(code));
  }

  // --- Cheat Code Sequence Buffer ---

  public registerCheatCode(code: string, callback: KeyActionCallback): () => void {
    const normalized = code.toLowerCase();
    if (!this.cheatCallbacks.has(normalized)) {
      this.cheatCallbacks.set(normalized, []);
    }
    this.cheatCallbacks.get(normalized)!.push(callback);

    return () => {
      const list = this.cheatCallbacks.get(normalized);
      if (list) {
        const idx = list.indexOf(callback);
        if (idx !== -1) list.splice(idx, 1);
      }
    };
  }

  private checkCheatCodes(): void {
    for (const [code, callbacks] of this.cheatCallbacks.entries()) {
      if (this.cheatBuffer.endsWith(code)) {
        for (const cb of callbacks) {
          cb();
        }
      }
    }
  }

  public getCheatBuffer(): string {
    return this.cheatBuffer;
  }

  public resetCheatBuffer(): void {
    this.cheatBuffer = '';
  }

  /**
   * Cleans up all event listeners.
   */
  public destroy(): void {
    if (this.target) {
      this.target.removeEventListener('keydown', this.handleKeyDown);
      this.target.removeEventListener('keyup', this.handleKeyUp);
    }
    this.keyStates.clear();
    this.cheatBuffer = '';
    for (const binding of this.bindings.values()) {
      binding.isTriggered = false;
      binding.downCallbacks = [];
      binding.upCallbacks = [];
    }
    this.cheatCallbacks.clear();
  }
}
