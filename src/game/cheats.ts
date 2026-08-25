/**
 * Galactic Recruit Pinball - Easter Eggs & Cheat System (P5.6)
 *
 * Listens for secret multi-character cheat words ('invasion', 'maxwaves', 'tractor', 'promote')
 * as well as single-key debug triggers ('B', 'H', 'Y', 'R').
 */

export type CheatCallback = () => void;

export class CheatSystem {
  private buffer: string = '';
  private readonly maxBufferLength: number = 30;
  private cheats: Map<string, CheatCallback> = new Map();
  private debugKeys: Map<string, CheatCallback> = new Map();
  private enabled: boolean = true;
  private keydownListener?: (e: KeyboardEvent) => void;

  constructor() {
    this.setupWindowListener();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearBuffer();
    }
  }

  public getBuffer(): string {
    return this.buffer;
  }

  public clearBuffer(): void {
    this.buffer = '';
  }

  /**
   * Registers a sequence cheat keyword (e.g. 'invasion', 'maxwaves', 'tractor', 'promote').
   */
  public registerCheat(code: string, callback: CheatCallback): void {
    this.cheats.set(code.toLowerCase(), callback);
  }

  /**
   * Registers a single debug hotkey (e.g. 'b', 'h', 'y', 'r').
   */
  public registerDebugKey(key: string, callback: CheatCallback): void {
    this.debugKeys.set(key.toLowerCase(), callback);
  }

  /**
   * Handles character input and checks for registered cheat triggers.
   */
  public handleKeyDown(key: string): void {
    if (!this.enabled) return;

    const lowerKey = key.toLowerCase();

    // 1. Check single-key debug shortcut first
    if (lowerKey.length === 1 && this.debugKeys.has(lowerKey)) {
      const debugFn = this.debugKeys.get(lowerKey);
      if (debugFn) {
        debugFn();
      }
    }

    // 2. Append to rolling cheat sequence buffer
    if (/^[a-z0-9]$/i.test(key)) {
      this.buffer += lowerKey;
      if (this.buffer.length > this.maxBufferLength) {
        this.buffer = this.buffer.slice(-this.maxBufferLength);
      }

      // Check all registered multi-character cheats
      for (const [code, callback] of this.cheats.entries()) {
        if (this.buffer.endsWith(code)) {
          callback();
          this.clearBuffer();
          break;
        }
      }
    }
  }

  private setupWindowListener(): void {
    if (typeof window === 'undefined') return;

    this.keydownListener = (e: KeyboardEvent) => {
      // Ignore keystrokes in input elements (like high score initials input)
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      this.handleKeyDown(e.key);
    };

    window.addEventListener('keydown', this.keydownListener);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
    }
    this.cheats.clear();
    this.debugKeys.clear();
    this.buffer = '';
  }
}
