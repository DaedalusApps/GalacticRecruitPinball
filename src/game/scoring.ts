/**
 * Galactic Recruit Pinball - Score Management System (P2.1, P2.7, P2.8)
 *
 * Handles base element points, field multiplier progression (1x, 2x, 3x, 5x, 10x),
 * end-of-ball bonus calculation, tilt bonus forfeiture, and event listeners.
 */

export const MULTIPLIER_VALUES = [1, 2, 3, 5, 10] as const;
export type MultiplierValue = (typeof MULTIPLIER_VALUES)[number];

export interface EndOfBallBonusParams {
  missions?: number;
  medals?: number;
  fuel?: number;
  rank?: number;
  isTilted?: boolean;
}

export class ScoreManager {
  private score: number = 0;
  private multiplierIndex: number = 0;
  private lastBonus: number = 0;

  public onScoreChange?: (totalScore: number, delta: number) => void;
  public onMultiplierChange?: (multiplier: number) => void;
  public onBonusAwarded?: (bonus: number) => void;

  constructor(initialScore: number = 0) {
    this.score = initialScore;
    this.multiplierIndex = 0;
  }

  public getLastBonus(): number {
    return this.lastBonus;
  }

  /**
   * Returns current total score.
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * Sets current score directly.
   */
  public setScore(newScore: number): void {
    const delta = newScore - this.score;
    this.score = Math.max(0, newScore);
    if (this.onScoreChange && delta !== 0) {
      this.onScoreChange(this.score, delta);
    }
  }

  /**
   * Returns the current active field multiplier.
   */
  public getMultiplier(): number {
    return MULTIPLIER_VALUES[this.multiplierIndex];
  }

  /**
   * Advances the field multiplier to the next step (1x -> 2x -> 3x -> 5x -> 10x).
   * Capped at 10x max.
   */
  public advanceMultiplier(): number {
    if (this.multiplierIndex < MULTIPLIER_VALUES.length - 1) {
      this.multiplierIndex++;
      const mult = this.getMultiplier();
      if (this.onMultiplierChange) {
        this.onMultiplierChange(mult);
      }
      return mult;
    }
    return this.getMultiplier();
  }

  /**
   * Sets the multiplier value directly.
   */
  public setMultiplier(multiplier: number): void {
    const foundIdx = MULTIPLIER_VALUES.indexOf(multiplier as MultiplierValue);
    if (foundIdx !== -1) {
      this.multiplierIndex = foundIdx;
    } else {
      // Find closest valid multiplier index
      let closestIdx = 0;
      for (let i = 0; i < MULTIPLIER_VALUES.length; i++) {
        if (MULTIPLIER_VALUES[i] <= multiplier) {
          closestIdx = i;
        }
      }
      this.multiplierIndex = closestIdx;
    }

    if (this.onMultiplierChange) {
      this.onMultiplierChange(this.getMultiplier());
    }
  }

  /**
   * Resets multiplier back to base 1x.
   */
  public resetMultiplier(): void {
    const prev = this.getMultiplier();
    this.multiplierIndex = 0;
    if (this.onMultiplierChange && prev !== 1) {
      this.onMultiplierChange(1);
    }
  }

  /**
   * Adds points to total score, applying active field multiplier if requested.
   */
  public addPoints(basePoints: number, applyMultiplier: boolean = true): number {
    if (basePoints <= 0) return 0;
    const multiplier = applyMultiplier ? this.getMultiplier() : 1;
    const delta = basePoints * multiplier;
    this.score += delta;

    if (this.onScoreChange) {
      this.onScoreChange(this.score, delta);
    }

    return delta;
  }

  /**
   * Computes end-of-ball bonus according to game formula:
   * Bonus = (Missions * 50,000 + Medals * 25,000 + Fuel * 1,000 + Rank * 10,000) * Multiplier
   * NOTE: Completely forfeited (0 pts) if tilted!
   */
  public calculateBonus(params: EndOfBallBonusParams): number {
    if (params.isTilted) {
      return 0;
    }

    const missions = params.missions ?? 0;
    const medals = params.medals ?? 0;
    const fuel = params.fuel ?? 0;
    const rank = params.rank ?? 1;

    const baseBonus =
      missions * 50000 +
      medals * 25000 +
      fuel * 1000 +
      rank * 10000;

    return baseBonus * this.getMultiplier();
  }

  /**
   * Calculates, awards and records end-of-ball bonus points into the score.
   */
  public awardEndOfBallBonus(params: EndOfBallBonusParams): number {
    const bonus = this.calculateBonus(params);
    this.lastBonus = bonus;
    if (bonus > 0) {
      this.score += bonus;
      if (this.onScoreChange) {
        this.onScoreChange(this.score, bonus);
      }
    }

    if (this.onBonusAwarded) {
      this.onBonusAwarded(bonus);
    }

    return bonus;
  }

  /**
   * Resets entire scoring state back to 0.
   */
  public reset(): void {
    this.score = 0;
    this.multiplierIndex = 0;
    if (this.onScoreChange) {
      this.onScoreChange(0, 0);
    }
    if (this.onMultiplierChange) {
      this.onMultiplierChange(1);
    }
  }
}
