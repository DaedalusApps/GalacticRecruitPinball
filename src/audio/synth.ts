/**
 * Galactic Recruit Pinball - Web Audio Procedural Sound Synthesizer (P5.1)
 *
 * Generates all 18+ game SFX procedurally at runtime using the Web Audio API
 * with zero external audio assets. Supports oscillators (square, triangle, sine, sawtooth),
 * white/pink noise bursts, biquad filters, pitch sweeps, and ADSR envelopes.
 */

export enum SoundType {
  FLIPPER = 'flipper',
  BUMPER = 'bumper',
  SLINGSHOT = 'slingshot',
  PLUNGER_CHARGE = 'plunger_charge',
  PLUNGER_RELEASE = 'plunger_release',
  DROP_TARGET = 'drop_target',
  SPOT_TARGET = 'spot_target',
  SINKHOLE = 'sinkhole',
  UFO_EJECT = 'ufo_eject',
  SPINNER = 'spinner',
  RAMP = 'ramp',
  KICKBACK = 'kickback',
  CENTER_POST = 'center_post',
  SKILL_SHOT = 'skill_shot',
  MISSION_REQUESTED = 'mission_requested',
  MISSION_ACCEPTED = 'mission_accepted',
  MISSION_COMPLETE = 'mission_complete',
  PROMOTION = 'promotion',
  LOW_FUEL = 'low_fuel',
  TILT_WARNING = 'tilt_warning',
  TILT_BUZZER = 'tilt_buzzer',
  DRAIN = 'drain',
  GAME_OVER = 'game_over',
}

export interface SoundSynthesizerOptions {
  audioContext?: AudioContext;
  volume?: number;
  muted?: boolean;
}

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 1.0;
  private muted: boolean = false;

  constructor(options: SoundSynthesizerOptions = {}) {
    this.volume = Math.max(0, Math.min(1, options.volume ?? 1.0));
    this.muted = options.muted ?? false;

    if (options.audioContext) {
      this.ctx = options.audioContext;
      this.initMasterGain();
    }
  }

  /**
   * Initializes or returns the audio context. Resumes if suspended.
   */
  public getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initMasterGain();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private initMasterGain(): void {
    if (!this.ctx) return;
    try {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    } catch {
      // Audio context might be a mock or not connected
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx && !this.muted) {
      try {
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      } catch {}
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      } catch {}
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // =========================================================================
  // CORE SYNTHESIS HELPERS
  // =========================================================================

  private createTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gainValue: number = 0.25,
    attackTime: number = 0.005,
    decayTime: number = 0.05
  ): { osc: OscillatorNode; gain: GainNode } | null {
    if (this.muted) return null;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return null;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainValue, now + attackTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration + decayTime);

      return { osc, gain };
    } catch {
      return null;
    }
  }

  private createSweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sawtooth',
    gainValue: number = 0.3
  ): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);

      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch {}
  }

  private createNoiseBurst(
    duration: number,
    filterFreq: number = 2000,
    filterType: BiquadFilterType = 'lowpass',
    gainValue: number = 0.3
  ): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
      noise.stop(now + duration + 0.02);
    } catch {}
  }

  // =========================================================================
  // 18+ PROCEDURAL GAME SFX EVENTS
  // =========================================================================

  /**
   * 1. Flipper: Solenoid clack (noise burst + low punch)
   */
  public playFlipper(): void {
    if (this.muted) return;
    this.createNoiseBurst(0.04, 1800, 'bandpass', 0.25);
    this.createSweep(180, 50, 0.05, 'triangle', 0.35);
  }

  /**
   * 2. Bumper Hit: Classic arcade boop with pitch scaling by bumper tier/level
   */
  public playBumper(level: number = 1): void {
    if (this.muted) return;
    const baseFreqs = [440, 587.33, 783.99, 1046.5];
    const freq = baseFreqs[Math.min(Math.max(level - 1, 0), baseFreqs.length - 1)] || 440;
    this.createSweep(freq, freq * 1.5, 0.09, 'square', 0.28);
    this.createNoiseBurst(0.03, 3000, 'highpass', 0.15);
  }

  /**
   * 3. Slingshot: Sharp impulse kicker sound
   */
  public playSlingshot(): void {
    if (this.muted) return;
    this.createSweep(600, 120, 0.07, 'sawtooth', 0.3);
    this.createNoiseBurst(0.03, 2500, 'bandpass', 0.25);
  }

  /**
   * 4. Plunger: Electromagnetic charge-up whine
   */
  public playPlungerCharge(power: number = 1.0): void {
    if (this.muted) return;
    const freq = 120 + power * 400;
    this.createSweep(120, freq, 0.2, 'sawtooth', 0.2);
  }

  /**
   * 5. Plunger: Spring release snap
   */
  public playPlungerRelease(): void {
    if (this.muted) return;
    this.createSweep(350, 40, 0.12, 'triangle', 0.4);
    this.createNoiseBurst(0.06, 2200, 'lowpass', 0.3);
  }

  /**
   * 6. Drop Target: Metallic click/clonk
   */
  public playDropTarget(): void {
    if (this.muted) return;
    this.createTone(520, 0.06, 'square', 0.25);
    this.createSweep(260, 90, 0.08, 'sawtooth', 0.2);
  }

  /**
   * 7. Spot Target: Electronic ping
   */
  public playSpotTarget(): void {
    if (this.muted) return;
    this.createTone(880, 0.08, 'triangle', 0.25);
    this.createTone(1320, 0.06, 'sine', 0.15);
  }

  /**
   * 8. Sinkhole / UFO Capture: Descending theremin-style warble / suction
   */
  public playSinkhole(): void {
    if (this.muted) return;
    this.createSweep(900, 180, 0.35, 'sine', 0.3);
    this.createSweep(450, 90, 0.35, 'triangle', 0.25);
  }

  /**
   * 9. UFO Eject: Pop + launch whoosh
   */
  public playUfoEject(): void {
    if (this.muted) return;
    this.createSweep(140, 720, 0.15, 'sawtooth', 0.3);
    this.createNoiseBurst(0.08, 1800, 'bandpass', 0.2);
  }

  /**
   * 10. Alien Spinner: High-speed flutter / whirring
   */
  public playSpinner(): void {
    if (this.muted) return;
    this.createTone(660 + Math.random() * 200, 0.04, 'square', 0.18);
    this.createNoiseBurst(0.02, 3500, 'highpass', 0.12);
  }

  /**
   * 11. Launch Ramp: Sci-fi whoosh
   */
  public playRamp(): void {
    if (this.muted) return;
    this.createNoiseBurst(0.25, 2400, 'bandpass', 0.25);
    this.createSweep(220, 880, 0.25, 'sine', 0.2);
  }

  /**
   * 12. Shield Kickback: High-energy electric boost
   */
  public playKickback(): void {
    if (this.muted) return;
    this.createSweep(150, 950, 0.18, 'sawtooth', 0.35);
    this.createNoiseBurst(0.1, 4000, 'bandpass', 0.3);
  }

  /**
   * 13. Center Post: Barrier drone save / bounce
   */
  public playCenterPost(): void {
    if (this.muted) return;
    this.createTone(330, 0.1, 'triangle', 0.35);
    this.createSweep(110, 440, 0.12, 'square', 0.25);
  }

  /**
   * 14. Skill Shot: Ascending chime cascade
   */
  public playSkillShot(): void {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.createTone(freq, 0.12, 'triangle', 0.25);
      }, idx * 60);
    });
  }

  /**
   * 15. Mission Requested: Two-tone alert chime
   */
  public playMissionRequested(): void {
    if (this.muted) return;
    this.createTone(587.33, 0.12, 'square', 0.25);
    setTimeout(() => {
      this.createTone(880.0, 0.18, 'square', 0.28);
    }, 120);
  }

  /**
   * 16. Mission Accepted: Energetic 8-bit fanfare
   */
  public playMissionAccepted(): void {
    if (this.muted) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.createTone(freq, 0.1, 'square', 0.25);
      }, idx * 70);
    });
  }

  /**
   * 17. Mission Complete: Victory jingle
   */
  public playMissionComplete(): void {
    if (this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.createTone(freq, 0.15, 'triangle', 0.3);
      }, idx * 80);
    });
  }

  /**
   * 18. Promotion: Grand ascending fanfare with layered chords
   */
  public playPromotion(): void {
    if (this.muted) return;
    const chords = [
      [261.63, 329.63, 392.0],
      [329.63, 415.3, 493.88],
      [392.0, 493.88, 587.33],
      [523.25, 659.25, 783.99, 1046.5],
    ];

    chords.forEach((chord, step) => {
      setTimeout(() => {
        chord.forEach((freq) => {
          this.createTone(freq, 0.22, 'sawtooth', 0.15);
          this.createTone(freq, 0.22, 'triangle', 0.15);
        });
      }, step * 120);
    });
  }

  /**
   * 19. Low Fuel Warning: Urgent beep
   */
  public playLowFuel(): void {
    if (this.muted) return;
    this.createTone(880, 0.08, 'square', 0.2);
    setTimeout(() => {
      this.createTone(880, 0.08, 'square', 0.2);
    }, 100);
  }

  /**
   * 20. Tilt Warning: Warning buzz
   */
  public playTiltWarning(): void {
    if (this.muted) return;
    this.createTone(130, 0.18, 'sawtooth', 0.35);
    this.createNoiseBurst(0.12, 1200, 'bandpass', 0.2);
  }

  /**
   * 21. TILT Buzzer: Power-down descending tone
   */
  public playTiltBuzzer(): void {
    if (this.muted) return;
    this.createSweep(350, 40, 0.6, 'sawtooth', 0.4);
  }

  /**
   * 22. Drain: Lost-life descending tone
   */
  public playDrain(): void {
    if (this.muted) return;
    this.createSweep(440, 80, 0.45, 'triangle', 0.35);
  }

  /**
   * 23. Game Over: Classic Space Invaders game-over melody
   */
  public playGameOver(): void {
    if (this.muted) return;
    const notes = [440, 415.3, 392.0, 369.99, 349.23, 329.63, 293.66, 220];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.createTone(freq, 0.18, 'square', 0.25);
      }, idx * 100);
    });
  }

  /**
   * Generic sound dispatcher
   */
  public playSound(type: SoundType, ...args: any[]): void {
    switch (type) {
      case SoundType.FLIPPER:
        this.playFlipper();
        break;
      case SoundType.BUMPER:
        this.playBumper(args[0] ?? 1);
        break;
      case SoundType.SLINGSHOT:
        this.playSlingshot();
        break;
      case SoundType.PLUNGER_CHARGE:
        this.playPlungerCharge(args[0] ?? 1.0);
        break;
      case SoundType.PLUNGER_RELEASE:
        this.playPlungerRelease();
        break;
      case SoundType.DROP_TARGET:
        this.playDropTarget();
        break;
      case SoundType.SPOT_TARGET:
        this.playSpotTarget();
        break;
      case SoundType.SINKHOLE:
        this.playSinkhole();
        break;
      case SoundType.UFO_EJECT:
        this.playUfoEject();
        break;
      case SoundType.SPINNER:
        this.playSpinner();
        break;
      case SoundType.RAMP:
        this.playRamp();
        break;
      case SoundType.KICKBACK:
        this.playKickback();
        break;
      case SoundType.CENTER_POST:
        this.playCenterPost();
        break;
      case SoundType.SKILL_SHOT:
        this.playSkillShot();
        break;
      case SoundType.MISSION_REQUESTED:
        this.playMissionRequested();
        break;
      case SoundType.MISSION_ACCEPTED:
        this.playMissionAccepted();
        break;
      case SoundType.MISSION_COMPLETE:
        this.playMissionComplete();
        break;
      case SoundType.PROMOTION:
        this.playPromotion();
        break;
      case SoundType.LOW_FUEL:
        this.playLowFuel();
        break;
      case SoundType.TILT_WARNING:
        this.playTiltWarning();
        break;
      case SoundType.TILT_BUZZER:
        this.playTiltBuzzer();
        break;
      case SoundType.DRAIN:
        this.playDrain();
        break;
      case SoundType.GAME_OVER:
        this.playGameOver();
        break;
    }
  }
}
