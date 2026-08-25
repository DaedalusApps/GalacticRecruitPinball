/**
 * Galactic Recruit Pinball - High Score & Hall of Fame Manager (P5.4)
 *
 * Manages persistent top 5 player rankings stored in localStorage.
 * Handles qualification checks, ranking order, score formatting, and defaults.
 */

export interface HighScoreEntry {
  name: string;
  score: number;
  rank: string;
  date?: string;
}

export interface HighScoreManagerOptions {
  storageKey?: string;
  maxEntries?: number;
  storage?: Storage;
}

export class HighScoreManager {
  private storageKey: string;
  private maxEntries: number;
  private storage: Storage | null = null;
  private entries: HighScoreEntry[] = [];

  public static readonly DEFAULT_SCORES: HighScoreEntry[] = [
    { name: 'ACE', score: 5000000, rank: 'FLEET ADMIRAL', date: '2026-08-01' },
    { name: 'ZAP', score: 3500000, rank: 'COMMODORE', date: '2026-08-05' },
    { name: 'NEO', score: 2000000, rank: 'STAR COMMANDER', date: '2026-08-10' },
    { name: 'FOX', score: 1000000, rank: 'SQUADRON LEADER', date: '2026-08-15' },
    { name: 'REC', score: 500000, rank: 'ROOKIE DEFENDER', date: '2026-08-20' },
  ];

  constructor(options: HighScoreManagerOptions = {}) {
    this.storageKey = options.storageKey ?? 'galactic_recruit_high_scores';
    this.maxEntries = options.maxEntries ?? 5;

    if (options.storage) {
      this.storage = options.storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    }

    this.load();
  }

  /**
   * Loads high score entries from storage or populates defaults.
   */
  public load(): void {
    if (!this.storage) {
      this.entries = [...HighScoreManager.DEFAULT_SCORES.slice(0, this.maxEntries)];
      return;
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.entries = parsed
            .map((item: any) => ({
              name: String(item.name || 'REC').toUpperCase().slice(0, 3),
              score: Number(item.score) || 0,
              rank: String(item.rank || 'ROOKIE DEFENDER'),
              date: item.date || new Date().toISOString().split('T')[0],
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, this.maxEntries);
          return;
        }
      }
    } catch {}

    this.entries = [...HighScoreManager.DEFAULT_SCORES.slice(0, this.maxEntries)];
    this.save();
  }

  /**
   * Saves high score entries to storage.
   */
  public save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {}
  }

  /**
   * Returns copy of top high score entries.
   */
  public getHighScores(): HighScoreEntry[] {
    return [...this.entries];
  }

  /**
   * Returns highest score recorded.
   */
  public getTopScore(): number {
    return this.entries.length > 0 ? this.entries[0].score : 0;
  }

  /**
   * Checks whether a given score qualifies for the Hall of Fame.
   */
  public isHighScore(score: number): boolean {
    if (this.entries.length < this.maxEntries) return true;
    return score > this.entries[this.entries.length - 1].score;
  }

  /**
   * Adds a new high score entry, maintains sort order, and trims to top entries.
   */
  public addHighScore(entry: HighScoreEntry): boolean {
    const formattedEntry: HighScoreEntry = {
      name: entry.name.toUpperCase().trim().slice(0, 3) || 'REC',
      score: Math.max(0, entry.score),
      rank: entry.rank.trim() || 'ROOKIE DEFENDER',
      date: entry.date || new Date().toISOString().split('T')[0],
    };

    if (!this.isHighScore(formattedEntry.score)) {
      return false;
    }

    this.entries.push(formattedEntry);
    this.entries.sort((a, b) => b.score - a.score);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }

    this.save();
    return true;
  }

  /**
   * Formats a score integer with commas (e.g. 1,250,000).
   */
  public formatScore(score: number): string {
    return score.toLocaleString('en-US');
  }

  /**
   * Formats a rank title.
   */
  public formatRank(rank: string): string {
    return rank.toUpperCase();
  }

  /**
   * Resets high score board to default arcade records.
   */
  public resetDefaults(): void {
    this.entries = [...HighScoreManager.DEFAULT_SCORES.slice(0, this.maxEntries)];
    this.save();
  }
}
