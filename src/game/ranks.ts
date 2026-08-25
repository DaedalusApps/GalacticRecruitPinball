/**
 * Galactic Recruit Pinball - Defender Rank & Progression System (P3.1, P3.6)
 *
 * Implements the 9 Defender ranks (re-themed from Space Cadet), insignia icon mappings,
 * rank promotion bonuses, promotion cascades, and queries.
 */

export interface RankDefinition {
  level: number;
  id: string;
  title: string;
  spaceCadetEquivalent: string;
  icon: string;
  promotionBonus: number;
  tier: number;
}

export const RANKS: readonly RankDefinition[] = [
  {
    level: 1,
    id: 'rookie-defender',
    title: 'Rookie Defender',
    spaceCadetEquivalent: 'Cadet',
    icon: 'squid-1',
    promotionBonus: 100000,
    tier: 1,
  },
  {
    level: 2,
    id: 'grid-gunner',
    title: 'Grid Gunner',
    spaceCadetEquivalent: 'Ensign',
    icon: 'squid-2',
    promotionBonus: 250000,
    tier: 2,
  },
  {
    level: 3,
    id: 'crab-hunter',
    title: 'Crab Hunter',
    spaceCadetEquivalent: 'Lieutenant',
    icon: 'crab',
    promotionBonus: 500000,
    tier: 2,
  },
  {
    level: 4,
    id: 'wave-captain',
    title: 'Wave Captain',
    spaceCadetEquivalent: 'Captain',
    icon: 'crab-shield',
    promotionBonus: 750000,
    tier: 3,
  },
  {
    level: 5,
    id: 'octopus-slayer',
    title: 'Octopus Slayer',
    spaceCadetEquivalent: 'Lt. Commander',
    icon: 'octopus',
    promotionBonus: 1000000,
    tier: 3,
  },
  {
    level: 6,
    id: 'fleet-commander',
    title: 'Fleet Commander',
    spaceCadetEquivalent: 'Commander',
    icon: 'octopus-crown',
    promotionBonus: 1500000,
    tier: 4,
  },
  {
    level: 7,
    id: 'ufo-tracker',
    title: 'UFO Tracker',
    spaceCadetEquivalent: 'Commodore',
    icon: 'ufo-small',
    promotionBonus: 2000000,
    tier: 4,
  },
  {
    level: 8,
    id: 'mothership-hunter',
    title: 'Mothership Hunter',
    spaceCadetEquivalent: 'Admiral',
    icon: 'ufo-large',
    promotionBonus: 3000000,
    tier: 5,
  },
  {
    level: 9,
    id: 'galactic-admiral',
    title: 'Galactic Admiral',
    spaceCadetEquivalent: 'Fleet Admiral',
    icon: 'mothership-gold',
    promotionBonus: 5000000,
    tier: 5,
  },
] as const;

export interface PromotionResult {
  promoted: boolean;
  oldRank: RankDefinition;
  newRank: RankDefinition;
  bonusPoints: number;
}

export interface DemotionResult {
  demoted: boolean;
  oldRank: RankDefinition;
  newRank: RankDefinition;
}

export class RankManager {
  private currentRankIndex: number = 0; // 0-indexed: level = index + 1

  public onPromotion?: (newRank: RankDefinition, bonusPoints: number) => void;

  constructor(initialLevel: number = 1) {
    this.setRank(initialLevel);
  }

  /**
   * Returns current active RankDefinition.
   */
  public getRank(): RankDefinition {
    return RANKS[this.currentRankIndex];
  }

  /**
   * Returns current rank level number (1 to 9).
   */
  public getRankNumber(): number {
    return this.getRank().level;
  }

  /**
   * Returns current rank title string.
   */
  public getRankTitle(): string {
    return this.getRank().title;
  }

  /**
   * Returns current mission tier (1 to 5) corresponding to current rank.
   */
  public getMissionTier(): number {
    return this.getRank().tier;
  }

  /**
   * Checks whether player has reached max rank (Rank 9: Galactic Admiral).
   */
  public isMaxRank(): boolean {
    return this.currentRankIndex >= RANKS.length - 1;
  }

  /**
   * Promotes the player to next rank level.
   * If already at max rank (9), returns promoted: false.
   */
  public promote(): PromotionResult {
    const oldRank = this.getRank();

    if (this.isMaxRank()) {
      return {
        promoted: false,
        oldRank,
        newRank: oldRank,
        bonusPoints: 0,
      };
    }

    this.currentRankIndex++;
    const newRank = this.getRank();
    const bonusPoints = newRank.promotionBonus;

    if (this.onPromotion) {
      this.onPromotion(newRank, bonusPoints);
    }

    return {
      promoted: true,
      oldRank,
      newRank,
      bonusPoints,
    };
  }

  /**
   * Demotes player to previous rank level (utility/debugging).
   */
  public demote(): DemotionResult {
    const oldRank = this.getRank();
    if (this.currentRankIndex > 0) {
      this.currentRankIndex--;
      return {
        demoted: true,
        oldRank,
        newRank: this.getRank(),
      };
    }
    return {
      demoted: false,
      oldRank,
      newRank: oldRank,
    };
  }

  /**
   * Sets current rank to a specific level (1 to 9).
   */
  public setRank(level: number): void {
    const clampedLevel = Math.max(1, Math.min(level, RANKS.length));
    this.currentRankIndex = clampedLevel - 1;
  }

  /**
   * Resets rank back to Rank 1 (Rookie Defender).
   */
  public reset(): void {
    this.currentRankIndex = 0;
  }
}
