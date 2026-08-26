export enum TouchZone {
  LEFT_FLIPPER = 'left_flipper',
  RIGHT_FLIPPER = 'right_flipper',
  UPPER_LEFT_FLIPPER = 'upper_left_flipper',
  PLUNGER = 'plunger',
  NONE = 'none',
}

export interface TouchRecord {
  id: number;
  zone: TouchZone;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
}

export type TouchActionCallback = () => void;
export type PlungerSwipeCallback = (distance: number, ratio: number) => void;

export interface TouchManagerOptions {
  container?: HTMLElement | null;
  upperLeftRatioX?: number;
  upperLeftRatioY?: number;
  plungerRatioX?: number;
  plungerRatioY?: number;
  preventDefault?: boolean;
}

/**
 * TouchManager handles multi-touch zones for pinball flippers and plunger swipe/hold mechanics.
 * Supports simultaneous multi-touch and touch indicator feedback.
 */
export class TouchManager {
  private container: HTMLElement | null = null;
  private upperLeftRatioX: number;
  private upperLeftRatioY: number;
  private plungerRatioX: number;
  private plungerRatioY: number;
  private preventDefault: boolean;

  private activeTouches: Map<number, TouchRecord> = new Map();

  private flipperLeftDownCbs: TouchActionCallback[] = [];
  private flipperLeftUpCbs: TouchActionCallback[] = [];

  private flipperRightDownCbs: TouchActionCallback[] = [];
  private flipperRightUpCbs: TouchActionCallback[] = [];

  private flipperUpperLeftDownCbs: TouchActionCallback[] = [];
  private flipperUpperLeftUpCbs: TouchActionCallback[] = [];

  private plungerStartCbs: TouchActionCallback[] = [];
  private plungerReleaseCbs: TouchActionCallback[] = [];
  private plungerSwipeCbs: PlungerSwipeCallback[] = [];

  private maxSwipeDistance: number = 120; // pixels for full plunger charge

  constructor(options: TouchManagerOptions = {}) {
    this.container =
      options.container !== undefined
        ? options.container
        : typeof document !== 'undefined'
        ? (document.getElementById('game-container') || document.body)
        : null;

    this.upperLeftRatioX = options.upperLeftRatioX ?? 0.5;
    this.upperLeftRatioY = options.upperLeftRatioY ?? 0.35;
    this.plungerRatioX = options.plungerRatioX ?? 0.8;
    this.plungerRatioY = options.plungerRatioY ?? 0.65;
    this.preventDefault = options.preventDefault ?? true;

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;
    this.container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.container.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
  }

  /**
   * Identifies which interactive pinball zone a coordinate falls into.
   */
  public getZoneForCoordinates(clientX: number, clientY: number): TouchZone {
    let width = typeof window !== 'undefined' ? window.innerWidth : 400;
    let height = typeof window !== 'undefined' ? window.innerHeight : 800;

    if (this.container) {
      const rect = this.container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
        clientX -= rect.left;
        clientY -= rect.top;
      }
    }

    // 1. Plunger zone (Bottom Right corner)
    if (clientX >= width * this.plungerRatioX && clientY >= height * this.plungerRatioY) {
      return TouchZone.PLUNGER;
    }

    // 2. Upper-Left Flipper zone (Top Left quadrant)
    if (clientX < width * this.upperLeftRatioX && clientY < height * this.upperLeftRatioY) {
      return TouchZone.UPPER_LEFT_FLIPPER;
    }

    // 3. Left Flipper zone (Left Half)
    if (clientX < width * 0.5) {
      return TouchZone.LEFT_FLIPPER;
    }

    // 4. Right Flipper zone (Right Half)
    return TouchZone.RIGHT_FLIPPER;
  }

  public handleTouchStart = (e: TouchEvent): void => {
    if (this.preventDefault && e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const changed = e.changedTouches ? Array.from(e.changedTouches) : [];
    for (const t of changed) {
      const zone = this.getZoneForCoordinates(t.clientX, t.clientY);
      const record: TouchRecord = {
        id: t.identifier,
        zone,
        startX: t.clientX,
        startY: t.clientY,
        currentX: t.clientX,
        currentY: t.clientY,
        startTime: performance.now(),
      };
      this.activeTouches.set(t.identifier, record);

      this.dispatchZoneStart(zone);
    }
  };

  public handleTouchMove = (e: TouchEvent): void => {
    if (this.preventDefault && e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const changed = e.changedTouches ? Array.from(e.changedTouches) : [];
    for (const t of changed) {
      const record = this.activeTouches.get(t.identifier);
      if (!record) continue;

      record.currentX = t.clientX;
      record.currentY = t.clientY;

      if (record.zone === TouchZone.PLUNGER) {
        const dist = Math.max(0, record.currentY - record.startY);
        const ratio = Math.min(1.0, dist / this.maxSwipeDistance);
        for (const cb of this.plungerSwipeCbs) {
          cb(dist, ratio);
        }
      }
    }
  };

  public handleTouchEnd = (e: TouchEvent): void => {
    if (this.preventDefault && e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    const changed = e.changedTouches ? Array.from(e.changedTouches) : [];
    for (const t of changed) {
      const record = this.activeTouches.get(t.identifier);
      if (!record) continue;

      this.activeTouches.delete(t.identifier);
      this.dispatchZoneEnd(record.zone);
    }
  };

  public handleTouchCancel = (e: TouchEvent): void => {
    this.handleTouchEnd(e);
  };

  private dispatchZoneStart(zone: TouchZone): void {
    if (zone === TouchZone.LEFT_FLIPPER) {
      for (const cb of this.flipperLeftDownCbs) cb();
    } else if (zone === TouchZone.RIGHT_FLIPPER) {
      for (const cb of this.flipperRightDownCbs) cb();
    } else if (zone === TouchZone.UPPER_LEFT_FLIPPER) {
      for (const cb of this.flipperUpperLeftDownCbs) cb();
    } else if (zone === TouchZone.PLUNGER) {
      for (const cb of this.plungerStartCbs) cb();
    }
  }

  private dispatchZoneEnd(zone: TouchZone): void {
    // Only dispatch UP if no other active touches remain in the same zone
    const stillActive = Array.from(this.activeTouches.values()).some((r) => r.zone === zone);
    if (!stillActive) {
      if (zone === TouchZone.LEFT_FLIPPER) {
        for (const cb of this.flipperLeftUpCbs) cb();
      } else if (zone === TouchZone.RIGHT_FLIPPER) {
        for (const cb of this.flipperRightUpCbs) cb();
      } else if (zone === TouchZone.UPPER_LEFT_FLIPPER) {
        for (const cb of this.flipperUpperLeftUpCbs) cb();
      } else if (zone === TouchZone.PLUNGER) {
        for (const cb of this.plungerReleaseCbs) cb();
      }
    }
  }

  // --- Subscriptions ---

  public onFlipperLeft(downCb: TouchActionCallback, upCb?: TouchActionCallback): () => void {
    this.flipperLeftDownCbs.push(downCb);
    if (upCb) this.flipperLeftUpCbs.push(upCb);
    return () => {
      this.flipperLeftDownCbs = this.flipperLeftDownCbs.filter((cb) => cb !== downCb);
      if (upCb) this.flipperLeftUpCbs = this.flipperLeftUpCbs.filter((cb) => cb !== upCb);
    };
  }

  public onFlipperRight(downCb: TouchActionCallback, upCb?: TouchActionCallback): () => void {
    this.flipperRightDownCbs.push(downCb);
    if (upCb) this.flipperRightUpCbs.push(upCb);
    return () => {
      this.flipperRightDownCbs = this.flipperRightDownCbs.filter((cb) => cb !== downCb);
      if (upCb) this.flipperRightUpCbs = this.flipperRightUpCbs.filter((cb) => cb !== upCb);
    };
  }

  public onFlipperUpperLeft(downCb: TouchActionCallback, upCb?: TouchActionCallback): () => void {
    this.flipperUpperLeftDownCbs.push(downCb);
    if (upCb) this.flipperUpperLeftUpCbs.push(upCb);
    return () => {
      this.flipperUpperLeftDownCbs = this.flipperUpperLeftDownCbs.filter((cb) => cb !== downCb);
      if (upCb) this.flipperUpperLeftUpCbs = this.flipperUpperLeftUpCbs.filter((cb) => cb !== upCb);
    };
  }

  public onPlunger(
    startCb: TouchActionCallback,
    releaseCb?: TouchActionCallback,
    swipeCb?: PlungerSwipeCallback
  ): () => void {
    this.plungerStartCbs.push(startCb);
    if (releaseCb) this.plungerReleaseCbs.push(releaseCb);
    if (swipeCb) this.plungerSwipeCbs.push(swipeCb);
    return () => {
      this.plungerStartCbs = this.plungerStartCbs.filter((cb) => cb !== startCb);
      if (releaseCb) this.plungerReleaseCbs = this.plungerReleaseCbs.filter((cb) => cb !== releaseCb);
      if (swipeCb) this.plungerSwipeCbs = this.plungerSwipeCbs.filter((cb) => cb !== swipeCb);
    };
  }

  // --- Active Queries ---

  public isFlipperLeftActive(): boolean {
    return Array.from(this.activeTouches.values()).some((r) => r.zone === TouchZone.LEFT_FLIPPER);
  }

  public isFlipperRightActive(): boolean {
    return Array.from(this.activeTouches.values()).some((r) => r.zone === TouchZone.RIGHT_FLIPPER);
  }

  public isFlipperUpperLeftActive(): boolean {
    return Array.from(this.activeTouches.values()).some((r) => r.zone === TouchZone.UPPER_LEFT_FLIPPER);
  }

  public isPlungerActive(): boolean {
    return Array.from(this.activeTouches.values()).some((r) => r.zone === TouchZone.PLUNGER);
  }

  public getPlungerSwipeDistance(): number {
    for (const record of this.activeTouches.values()) {
      if (record.zone === TouchZone.PLUNGER) {
        return Math.max(0, record.currentY - record.startY);
      }
    }
    return 0;
  }

  public getActiveTouchCount(): number {
    return this.activeTouches.size;
  }

  public destroy(): void {
    if (this.container) {
      this.container.removeEventListener('touchstart', this.handleTouchStart);
      this.container.removeEventListener('touchmove', this.handleTouchMove);
      this.container.removeEventListener('touchend', this.handleTouchEnd);
      this.container.removeEventListener('touchcancel', this.handleTouchCancel);
    }
    this.activeTouches.clear();
    this.flipperLeftDownCbs = [];
    this.flipperLeftUpCbs = [];
    this.flipperRightDownCbs = [];
    this.flipperRightUpCbs = [];
    this.flipperUpperLeftDownCbs = [];
    this.flipperUpperLeftUpCbs = [];
    this.plungerStartCbs = [];
    this.plungerReleaseCbs = [];
    this.plungerSwipeCbs = [];
  }
}
