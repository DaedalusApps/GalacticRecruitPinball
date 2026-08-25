/**
 * Galactic Recruit Pinball - Attract Mode & Title Screen Controller (P4.8)
 *
 * Manages the attract state loop, title screen HUD banner, blinking "PRESS SPACE TO START" prompt,
 * camera attract demo orbit, and seamless transition into active gameplay.
 */

export interface AttractModeOptions {
  blinkInterval?: number;
  onStartRequested?: () => void;
}

export class AttractMode {
  private active: boolean = false;
  private promptVisible: boolean = true;
  private blinkTimer: number = 0;
  public blinkInterval: number;

  public onStartRequested?: () => void;
  private keydownHandler?: (e: KeyboardEvent) => void;
  private pointerHandler?: (e: MouseEvent | TouchEvent) => void;

  constructor(options: AttractModeOptions = {}) {
    this.blinkInterval = options.blinkInterval ?? 0.6;
    this.onStartRequested = options.onStartRequested;
    this.setupListeners();
  }

  public isActive(): boolean {
    return this.active;
  }

  public isPromptVisible(): boolean {
    return this.promptVisible;
  }

  public start(): void {
    this.active = true;
    this.promptVisible = true;
    this.blinkTimer = 0;
    this.updateDOMVisibility();
  }

  public stop(): void {
    this.active = false;
    this.promptVisible = false;
    this.updateDOMVisibility();
  }

  public requestStart(): void {
    if (!this.active) return;
    this.stop();
    if (this.onStartRequested) {
      this.onStartRequested();
    }
  }

  public update(deltaSec: number): void {
    if (!this.active) return;

    this.blinkTimer += deltaSec;
    if (this.blinkTimer >= this.blinkInterval) {
      this.blinkTimer -= this.blinkInterval;
      this.promptVisible = !this.promptVisible;
      this.updatePromptDOM();
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.active) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.requestStart();
      }
    };

    this.pointerHandler = () => {
      if (!this.active) return;
      this.requestStart();
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('pointerdown', this.pointerHandler);
  }

  private updateDOMVisibility(): void {
    if (typeof document === 'undefined') return;

    const attractOverlay = document.getElementById('attract-overlay');
    if (attractOverlay) {
      attractOverlay.style.display = this.active ? 'flex' : 'none';
    }
    this.updatePromptDOM();
  }

  private updatePromptDOM(): void {
    if (typeof document === 'undefined') return;

    const promptElem = document.getElementById('attract-prompt');
    if (promptElem) {
      promptElem.style.opacity = this.active && this.promptVisible ? '1' : '0.15';
    }
  }

  public destroy(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    if (this.pointerHandler) {
      window.removeEventListener('pointerdown', this.pointerHandler);
    }
  }
}
