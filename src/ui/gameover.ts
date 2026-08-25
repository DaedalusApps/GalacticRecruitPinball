/**
 * Galactic Recruit Pinball - Game Over Screen & Name Entry Modal (P5.5)
 *
 * Manages the Game Over HUD modal overlay, score/rank/mission stats breakdown,
 * 3-character initials validation/submission for high score leaderboard,
 * and restart / attract mode transitions.
 */

import { HighScoreEntry, HighScoreManager } from './highscore';

export interface GameOverData {
  score: number;
  rank: string;
  missionsCompleted: number;
  bonusScore: number;
  isHighScore: boolean;
}

export interface GameOverModalOptions {
  containerId?: string;
  highScoreManager?: HighScoreManager;
  onRestart?: () => void;
  onAttractRequested?: () => void;
  onScoreSubmitted?: (entry: HighScoreEntry) => void;
}

export class GameOverModal {
  private containerId: string;
  private visible: boolean = false;
  private currentData: GameOverData | null = null;
  private highScoreManager: HighScoreManager;

  public onRestart?: () => void;
  public onAttractRequested?: () => void;
  public onScoreSubmitted?: (entry: HighScoreEntry) => void;

  constructor(options: GameOverModalOptions = {}) {
    this.containerId = options.containerId ?? 'game-over-modal';
    this.highScoreManager = options.highScoreManager ?? new HighScoreManager();
    this.onRestart = options.onRestart;
    this.onAttractRequested = options.onAttractRequested;
    this.onScoreSubmitted = options.onScoreSubmitted;

    this.setupDOMListeners();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getScoreData(): GameOverData | null {
    return this.currentData;
  }

  public validateInitials(initials: string): boolean {
    if (!initials || initials.length !== 3) return false;
    return /^[A-Z0-9]{3}$/.test(initials);
  }

  public sanitizeInitials(initials: string): string {
    return initials.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  }

  public show(data: GameOverData): void {
    this.currentData = data;
    this.visible = true;
    this.updateDOM();
  }

  public hide(): void {
    this.visible = false;
    this.currentData = null;
    if (typeof document !== 'undefined') {
      const container = document.getElementById(this.containerId);
      if (container) {
        container.style.display = 'none';
      }
    }
  }

  public submitInitials(initials: string): boolean {
    const clean = this.sanitizeInitials(initials);
    if (!this.validateInitials(clean)) return false;

    if (this.currentData) {
      const entry: HighScoreEntry = {
        name: clean,
        score: this.currentData.score,
        rank: this.currentData.rank,
        date: new Date().toISOString().split('T')[0],
      };

      this.highScoreManager.addHighScore(entry);

      if (this.onScoreSubmitted) {
        this.onScoreSubmitted(entry);
      }

      this.currentData.isHighScore = false;
      this.updateDOM();
      return true;
    }

    return false;
  }

  public requestRestart(): void {
    this.hide();
    if (this.onRestart) {
      this.onRestart();
    }
  }

  public requestAttract(): void {
    this.hide();
    if (this.onAttractRequested) {
      this.onAttractRequested();
    }
  }

  private setupDOMListeners(): void {
    if (typeof document === 'undefined') return;

    // Submit button listener
    const submitBtn = document.getElementById('high-score-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const input = document.getElementById('initials-input') as HTMLInputElement | null;
        if (input) {
          this.submitInitials(input.value);
        }
      });
    }

    // Initials input Enter key
    const input = document.getElementById('initials-input') as HTMLInputElement | null;
    if (input) {
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.submitInitials(input.value);
        }
      });
      input.addEventListener('input', () => {
        input.value = this.sanitizeInitials(input.value);
      });
    }

    // Play again button
    const restartBtn = document.getElementById('game-over-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.requestRestart();
      });
    }

    // Title / Attract button
    const attractBtn = document.getElementById('game-over-attract-btn');
    if (attractBtn) {
      attractBtn.addEventListener('click', () => {
        this.requestAttract();
      });
    }
  }

  private updateDOM(): void {
    if (typeof document === 'undefined') return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.style.display = this.visible ? 'flex' : 'none';
    if (!this.visible || !this.currentData) return;

    // Score stats
    const finalScoreEl = document.getElementById('game-over-final-score');
    if (finalScoreEl) finalScoreEl.textContent = this.currentData.score.toLocaleString('en-US');

    const finalRankEl = document.getElementById('game-over-final-rank');
    if (finalRankEl) finalRankEl.textContent = this.currentData.rank.toUpperCase();

    const missionsEl = document.getElementById('game-over-missions');
    if (missionsEl) missionsEl.textContent = String(this.currentData.missionsCompleted);

    const bonusEl = document.getElementById('game-over-bonus');
    if (bonusEl) bonusEl.textContent = this.currentData.bonusScore.toLocaleString('en-US');

    // High score entry section visibility
    const nameEntrySec = document.getElementById('high-score-entry-section');
    if (nameEntrySec) {
      nameEntrySec.style.display = this.currentData.isHighScore ? 'block' : 'none';
      if (this.currentData.isHighScore) {
        const input = document.getElementById('initials-input') as HTMLInputElement | null;
        if (input) {
          input.value = '';
          input.focus();
        }
      }
    }

    // Leaderboard table
    const tableBody = document.getElementById('hall-of-fame-rows');
    if (tableBody) {
      const topScores = this.highScoreManager.getHighScores();
      tableBody.innerHTML = topScores
        .map(
          (s, idx) => `
        <tr>
          <td style="color: #00e5ff; font-weight: bold;">#${idx + 1}</td>
          <td style="color: #00ff66; font-weight: bold; letter-spacing: 2px;">${s.name}</td>
          <td style="color: #ffffff; text-align: right;">${s.score.toLocaleString('en-US')}</td>
          <td style="color: #ffee00; font-size: 0.75rem; text-align: right;">${s.rank}</td>
        </tr>`
        )
        .join('');
    }
  }

  public destroy(): void {
    this.hide();
  }
}
