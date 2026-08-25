/**
 * Galactic Recruit Pinball - Procedural Chiptune Background Music Generator (P5.2)
 *
 * Generates the iconic Space Invaders–style 4-note descending bassline loop
 * at runtime using Web Audio API synthesis. Supports dynamic tempo scaling,
 * volume mixing, and mute controls.
 */

export interface ChiptuneMusicOptions {
  audioContext?: AudioContext;
  tempo?: number; // Beats per minute (BPM)
  volume?: number;
  muted?: boolean;
}

export class ChiptuneMusic {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private playing: boolean = false;
  private tempo: number = 96; // Default BPM
  private volume: number = 0.4;
  private muted: boolean = false;

  // Space Invaders 4-note descending bassline frequencies (Hz)
  // F2 (87.31Hz), E2 (82.41Hz), Eb2 (77.78Hz), D2 (73.42Hz)
  private readonly bassFrequencies: number[] = [87.31, 82.41, 77.78, 73.42];
  private currentNoteIndex: number = 0;
  private noteTimer: number = 0;
  private activeOsc: OscillatorNode | null = null;
  private activeGain: GainNode | null = null;

  constructor(options: ChiptuneMusicOptions = {}) {
    this.tempo = options.tempo ?? 96;
    this.volume = Math.max(0, Math.min(1, options.volume ?? 0.4));
    this.muted = options.muted ?? false;

    if (options.audioContext) {
      this.ctx = options.audioContext;
      this.initMasterGain();
    }
  }

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
    } catch {}
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public getTempo(): number {
    return this.tempo;
  }

  public setTempo(bpm: number): void {
    this.tempo = Math.max(40, Math.min(300, bpm));
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

  public getCurrentNoteIndex(): number {
    return this.currentNoteIndex;
  }

  public start(): void {
    if (this.playing) return;
    this.playing = true;
    this.currentNoteIndex = 0;
    this.noteTimer = 0;
    this.getContext();
    this.playCurrentNote();
  }

  public stop(): void {
    this.playing = false;
    this.currentNoteIndex = 0;
    this.noteTimer = 0;
    this.stopActiveNote();
  }

  private stopActiveNote(): void {
    if (this.activeOsc && this.ctx) {
      try {
        this.activeOsc.stop();
        this.activeOsc.disconnect();
      } catch {}
      this.activeOsc = null;
    }
    if (this.activeGain) {
      try {
        this.activeGain.disconnect();
      } catch {}
      this.activeGain = null;
    }
  }

  private playCurrentNote(): void {
    if (!this.playing || this.muted) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      this.stopActiveNote();

      const freq = this.bassFrequencies[this.currentNoteIndex];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const noteDuration = (60 / this.tempo) * 0.45;
      const now = ctx.currentTime;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + noteDuration + 0.02);

      this.activeOsc = osc;
      this.activeGain = gain;
    } catch {}
  }

  /**
   * Per-frame update method to advance rhythmic sequence
   */
  public update(deltaSec: number): void {
    if (!this.playing) return;

    const stepInterval = 60 / this.tempo;
    this.noteTimer += deltaSec;

    if (this.noteTimer >= stepInterval) {
      this.noteTimer -= stepInterval;
      this.currentNoteIndex = (this.currentNoteIndex + 1) % this.bassFrequencies.length;
      this.playCurrentNote();
    }
  }
}
