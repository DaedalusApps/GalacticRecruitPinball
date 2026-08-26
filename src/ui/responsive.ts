export enum OrientationMode {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape',
}

export interface LayoutInfo {
  orientation: OrientationMode;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: number;
  devicePixelRatio: number;
  clampedPixelRatio: number;
  isMobile: boolean;
  touchTargetMinSize: number;
}

export type LayoutChangeCallback = (layout: LayoutInfo) => void;

export interface ResponsiveLayoutManagerOptions {
  windowTarget?: EventTarget | null;
  maxDpiClamp?: number;
  minTouchSizePx?: number;
}

/**
 * ResponsiveLayoutManager manages portrait vs landscape layouts,
 * DPI scaling clamped to 2.0, mobile detection, and touch target size enforcement.
 */
export class ResponsiveLayoutManager {
  private target: EventTarget | null = null;
  private maxDpiClamp: number;
  private minTouchSizePx: number;
  private currentLayout: LayoutInfo;
  private layoutCallbacks: LayoutChangeCallback[] = [];

  constructor(options: ResponsiveLayoutManagerOptions = {}) {
    this.target =
      options.windowTarget !== undefined
        ? options.windowTarget
        : typeof window !== 'undefined'
        ? window
        : null;

    this.maxDpiClamp = options.maxDpiClamp ?? 2.0;
    this.minTouchSizePx = options.minTouchSizePx ?? 44;

    const width = typeof window !== 'undefined' ? window.innerWidth : 400;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    this.currentLayout = this.calculateLayout(width, height);

    this.bindEvents();
  }

  private bindEvents(): void {
    if (this.target) {
      this.target.addEventListener('resize', this.handleResize as EventListener);
      this.target.addEventListener('orientationchange', this.handleResize as EventListener);
    }
  }

  public getOrientation(width: number, height: number): OrientationMode {
    return height >= width ? OrientationMode.PORTRAIT : OrientationMode.LANDSCAPE;
  }

  public isPortrait(width?: number, height?: number): boolean {
    const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 400);
    const h = height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
    return this.getOrientation(w, h) === OrientationMode.PORTRAIT;
  }

  public isLandscape(width?: number, height?: number): boolean {
    return !this.isPortrait(width, height);
  }

  public getClampedPixelRatio(customDpr?: number): number {
    const dpr = customDpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    return Math.min(dpr, this.maxDpiClamp);
  }

  public calculateLayout(width: number, height: number): LayoutInfo {
    const orientation = this.getOrientation(width, height);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const clampedDpr = this.getClampedPixelRatio(dpr);

    const isMobile =
      width <= 768 ||
      (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)));

    return {
      orientation,
      canvasWidth: width,
      canvasHeight: height,
      aspectRatio: width / (height || 1),
      devicePixelRatio: dpr,
      clampedPixelRatio: clampedDpr,
      isMobile,
      touchTargetMinSize: this.minTouchSizePx,
    };
  }

  public handleResize = (): void => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 400;
    const height = typeof window !== 'undefined' ? window.innerHeight : 800;
    this.updateDimensions(width, height);
  };

  public updateDimensions(width: number, height: number): LayoutInfo {
    this.currentLayout = this.calculateLayout(width, height);
    this.applyDOMClasses();
    for (const cb of this.layoutCallbacks) {
      cb(this.currentLayout);
    }
    return this.currentLayout;
  }

  public applyDOMClasses(): void {
    if (typeof document === 'undefined') return;

    const body = document.body;
    if (!body) return;

    if (this.currentLayout.orientation === OrientationMode.PORTRAIT) {
      body.classList.add('portrait-mode');
      body.classList.remove('landscape-mode');
    } else {
      body.classList.add('landscape-mode');
      body.classList.remove('portrait-mode');
    }

    if (this.currentLayout.isMobile) {
      body.classList.add('is-mobile');
    } else {
      body.classList.remove('is-mobile');
    }
  }

  public getLayout(): LayoutInfo {
    return this.currentLayout;
  }

  public onLayoutChange(callback: LayoutChangeCallback): () => void {
    this.layoutCallbacks.push(callback);
    return () => {
      this.layoutCallbacks = this.layoutCallbacks.filter((cb) => cb !== callback);
    };
  }

  public destroy(): void {
    if (this.target) {
      this.target.removeEventListener('resize', this.handleResize as EventListener);
      this.target.removeEventListener('orientationchange', this.handleResize as EventListener);
    }
    this.layoutCallbacks = [];
  }
}
