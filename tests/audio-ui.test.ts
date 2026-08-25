import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SoundSynthesizer, SoundType } from '../src/audio/synth';
import { ChiptuneMusic } from '../src/audio/music';
import { HighScoreManager } from '../src/ui/highscore';
import { GameOverModal, GameOverData } from '../src/ui/gameover';
import { CheatSystem } from '../src/game/cheats';

// Mock Web Audio Context implementation for unit testing
export class MockAudioParam {
  public value: number = 0;
  public setValueAtTime = vi.fn().mockReturnThis();
  public linearRampToValueAtTime = vi.fn().mockReturnThis();
  public exponentialRampToValueAtTime = vi.fn().mockReturnThis();
  public setTargetAtTime = vi.fn().mockReturnThis();
}

export class MockAudioNode {
  public connect = vi.fn().mockReturnThis();
  public disconnect = vi.fn().mockReturnThis();
}

export class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam();
}

export class MockOscillatorNode extends MockAudioNode {
  public type: OscillatorType = 'sine';
  public frequency = new MockAudioParam();
  public start = vi.fn();
  public stop = vi.fn();
}

export class MockBiquadFilterNode extends MockAudioNode {
  public type: BiquadFilterType = 'lowpass';
  public frequency = new MockAudioParam();
  public Q = new MockAudioParam();
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: any = null;
  public loop: boolean = false;
  public start = vi.fn();
  public stop = vi.fn();
}

export class MockAudioContext {
  public state: AudioContextState = 'running';
  public currentTime: number = 0;
  public destination = new MockAudioNode();
  public sampleRate: number = 44100;

  public createGain = vi.fn(() => new MockGainNode());
  public createOscillator = vi.fn(() => new MockOscillatorNode());
  public createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  public createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  }));
  public createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  public resume = vi.fn().mockResolvedValue(undefined);
  public close = vi.fn().mockResolvedValue(undefined);
}

describe('Phase 5: Audio & UI (P5.1 - P5.7)', () => {
  // =========================================================================
  // 1. PROCEDURAL SOUND SYNTHESIZER (P5.1)
  // =========================================================================
  describe('SoundSynthesizer (Web Audio Procedural SFX)', () => {
    let synth: SoundSynthesizer;
    let mockCtx: MockAudioContext;

    beforeEach(() => {
      mockCtx = new MockAudioContext();
      synth = new SoundSynthesizer({ audioContext: mockCtx as unknown as AudioContext });
    });

    it('initializes with audio context, master gain, and unmuted by default', () => {
      expect(synth).toBeDefined();
      expect(synth.isMuted()).toBe(false);
      expect(synth.getVolume()).toBeCloseTo(1.0);
    });

    it('allows setting master volume and clamping between 0 and 1', () => {
      synth.setVolume(0.5);
      expect(synth.getVolume()).toBeCloseTo(0.5);

      synth.setVolume(1.5);
      expect(synth.getVolume()).toBe(1.0);

      synth.setVolume(-0.2);
      expect(synth.getVolume()).toBe(0.0);
    });

    it('toggles mute state correctly', () => {
      expect(synth.isMuted()).toBe(false);
      const isMutedNow = synth.toggleMute();
      expect(isMutedNow).toBe(true);
      expect(synth.isMuted()).toBe(true);

      synth.setMuted(false);
      expect(synth.isMuted()).toBe(false);
    });

    it('synthesizes flipper solenoid clack sound', () => {
      synth.playFlipper();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('synthesizes bumper hits with pitch scaling based on level/tier', () => {
      synth.playBumper(1);
      expect(mockCtx.createOscillator).toHaveBeenCalled();

      synth.playBumper(2);
      synth.playBumper(3);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('synthesizes slingshot impulse sound', () => {
      synth.playSlingshot();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes plunger charge-up whine and release snap', () => {
      synth.playPlungerCharge(0.8);
      synth.playPlungerRelease();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('synthesizes drop target and spot target hits', () => {
      synth.playDropTarget();
      synth.playSpotTarget();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes sinkhole capture and UFO eject sounds', () => {
      synth.playSinkhole();
      synth.playUfoEject();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes spinner flutter, ramp sci-fi whoosh, and kickback boost', () => {
      synth.playSpinner();
      synth.playRamp();
      synth.playKickback();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('synthesizes center post barrier save and skill shot chime cascade', () => {
      synth.playCenterPost();
      synth.playSkillShot();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes mission events: requested, accepted, complete, promotion fanfare', () => {
      synth.playMissionRequested();
      synth.playMissionAccepted();
      synth.playMissionComplete();
      synth.playPromotion();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes tilt warning, tilt buzzer, drain, and game over melodies', () => {
      synth.playTiltWarning();
      synth.playTiltBuzzer();
      synth.playDrain();
      synth.playGameOver();
      synth.playLowFuel();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });

    it('does not trigger audio graph when muted', () => {
      synth.setMuted(true);
      const oscCountBefore = mockCtx.createOscillator.mock.calls.length;
      synth.playFlipper();
      synth.playBumper();
      synth.playPromotion();
      expect(mockCtx.createOscillator.mock.calls.length).toBe(oscCountBefore);
    });

    it('supports playSound by sound type enum', () => {
      synth.playSound(SoundType.SLINGSHOT);
      synth.playSound(SoundType.PROMOTION);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. BACKGROUND CHIPTUNE MUSIC GENERATOR (P5.2)
  // =========================================================================
  describe('ChiptuneMusic (Space Invaders 4-Note Bassline Generator)', () => {
    let music: ChiptuneMusic;
    let mockCtx: MockAudioContext;

    beforeEach(() => {
      mockCtx = new MockAudioContext();
      music = new ChiptuneMusic({ audioContext: mockCtx as unknown as AudioContext });
    });

    it('initializes in stopped state with default tempo and volume', () => {
      expect(music.isPlaying()).toBe(false);
      expect(music.getTempo()).toBeGreaterThan(0);
      expect(music.getVolume()).toBeCloseTo(0.4);
      expect(music.isMuted()).toBe(false);
    });

    it('starts and stops music playback', () => {
      music.start();
      expect(music.isPlaying()).toBe(true);

      music.stop();
      expect(music.isPlaying()).toBe(false);
    });

    it('allows tempo scaling (BPM adjustment)', () => {
      music.setTempo(140);
      expect(music.getTempo()).toBe(140);

      music.setTempo(60);
      expect(music.getTempo()).toBe(60);
    });

    it('allows volume control and mute toggling', () => {
      music.setVolume(0.8);
      expect(music.getVolume()).toBeCloseTo(0.8);

      const muted = music.toggleMute();
      expect(muted).toBe(true);
      expect(music.isMuted()).toBe(true);

      music.setMuted(false);
      expect(music.isMuted()).toBe(false);
    });

    it('advances 4-note bassline pattern during update steps', () => {
      music.start();
      expect(music.getCurrentNoteIndex()).toBe(0);

      // Simulate timer / delta updates
      music.update(0.3);
      const noteIdx = music.getCurrentNoteIndex();
      expect(noteIdx).toBeGreaterThanOrEqual(0);
      expect(noteIdx).toBeLessThan(4);
    });
  });

  // =========================================================================
  // 3. HIGH SCORE SYSTEM (P5.4)
  // =========================================================================
  describe('HighScoreManager (Persistent Hall of Fame)', () => {
    let highScoreMgr: HighScoreManager;
    let storageMock: Record<string, string>;

    beforeEach(() => {
      storageMock = {};
      const fakeLocalStorage = {
        getItem: vi.fn((key: string) => storageMock[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete storageMock[key];
        }),
        clear: vi.fn(() => {
          storageMock = {};
        }),
      };
      highScoreMgr = new HighScoreManager({ storage: fakeLocalStorage as any });
    });

    it('initializes with top 5 default hall of fame entries if storage empty', () => {
      const scores = highScoreMgr.getHighScores();
      expect(scores.length).toBe(5);
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
      expect(highScoreMgr.getTopScore()).toBe(scores[0].score);
    });

    it('checks if a score qualifies for high score hall of fame', () => {
      const lowestDefault = highScoreMgr.getHighScores()[4].score;
      expect(highScoreMgr.isHighScore(lowestDefault + 1000)).toBe(true);
      expect(highScoreMgr.isHighScore(lowestDefault - 1000)).toBe(false);
    });

    it('adds a new high score entry, sorts descending, and keeps top 5', () => {
      const topScore = highScoreMgr.getTopScore();
      const newScore = topScore + 500000;

      const added = highScoreMgr.addHighScore({
        name: 'ACE',
        score: newScore,
        rank: 'FLEET ADMIRAL',
      });

      expect(added).toBe(true);
      const updated = highScoreMgr.getHighScores();
      expect(updated.length).toBe(5);
      expect(updated[0].name).toBe('ACE');
      expect(updated[0].score).toBe(newScore);
    });

    it('formats score strings with thousands separators', () => {
      expect(highScoreMgr.formatScore(1250000)).toBe('1,250,000');
      expect(highScoreMgr.formatScore(0)).toBe('0');
    });

    it('resets high scores back to default records', () => {
      highScoreMgr.addHighScore({ name: 'ZZZ', score: 99999999, rank: 'LEGEND' });
      expect(highScoreMgr.getTopScore()).toBe(99999999);

      highScoreMgr.resetDefaults();
      expect(highScoreMgr.getTopScore()).toBeLessThan(99999999);
      expect(highScoreMgr.getHighScores().length).toBe(5);
    });
  });

  // =========================================================================
  // 4. GAME OVER MODAL & NAME ENTRY (P5.5)
  // =========================================================================
  describe('GameOverModal (End Screen & Leaderboard UI)', () => {
    let modal: GameOverModal;

    beforeEach(() => {
      // Mock DOM element for tests
      const mockElements: Record<string, any> = {};
      const createMockElement = (id: string) => {
        const el = {
          id,
          style: { display: 'none' },
          textContent: '',
          value: '',
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
          },
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          focus: vi.fn(),
          innerHTML: '',
        };
        mockElements[id] = el;
        return el;
      };

      if (typeof globalThis.document === 'undefined') {
        (globalThis as any).document = {
          getElementById: (id: string) => mockElements[id] || createMockElement(id),
          createElement: (_tag: string) => createMockElement('created'),
        };
      }

      modal = new GameOverModal({ containerId: 'game-over-modal' });
    });

    afterEach(() => {
      modal.destroy();
    });

    it('initializes in hidden state', () => {
      expect(modal.isVisible()).toBe(false);
    });

    it('shows game over modal with score, rank, and mission stats breakdown', () => {
      const data: GameOverData = {
        score: 2500000,
        rank: 'STAR COMMANDER',
        missionsCompleted: 5,
        bonusScore: 350000,
        isHighScore: true,
      };

      modal.show(data);
      expect(modal.isVisible()).toBe(true);
      expect(modal.getScoreData()).toEqual(data);
    });

    it('validates 3-character initials for name entry', () => {
      expect(modal.validateInitials('ABC')).toBe(true);
      expect(modal.validateInitials('AB')).toBe(false);
      expect(modal.validateInitials('ABCD')).toBe(false);
      expect(modal.validateInitials('A!@')).toBe(false);
      expect(modal.sanitizeInitials('ab1')).toBe('AB1');
    });

    it('invokes onScoreSubmitted callback when valid name is entered', () => {
      const onSubmit = vi.fn();
      modal.onScoreSubmitted = onSubmit;

      modal.show({
        score: 1800000,
        rank: 'SPACE CADET',
        missionsCompleted: 2,
        bonusScore: 50000,
        isHighScore: true,
      });

      modal.submitInitials('DEF');
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DEF',
          score: 1800000,
          rank: 'SPACE CADET',
        })
      );
    });

    it('invokes onRestart and onAttractRequested callbacks', () => {
      const onRestart = vi.fn();
      const onAttract = vi.fn();
      modal.onRestart = onRestart;
      modal.onAttractRequested = onAttract;

      modal.requestRestart();
      expect(onRestart).toHaveBeenCalled();

      modal.requestAttract();
      expect(onAttract).toHaveBeenCalled();
    });

    it('hides modal and resets state', () => {
      modal.show({ score: 100, rank: 'ROOKIE', missionsCompleted: 0, bonusScore: 0, isHighScore: false });
      expect(modal.isVisible()).toBe(true);

      modal.hide();
      expect(modal.isVisible()).toBe(false);
    });
  });

  // =========================================================================
  // 5. EASTER EGGS & CHEAT SYSTEM (P5.6)
  // =========================================================================
  describe('CheatSystem (Secret Codes & Debug Keys)', () => {
    let cheats: CheatSystem;

    beforeEach(() => {
      cheats = new CheatSystem();
    });

    afterEach(() => {
      cheats.destroy();
    });

    it('registers and triggers word cheat codes ("invasion", "maxwaves", "tractor", "promote")', () => {
      const onInvasion = vi.fn();
      const onMaxWaves = vi.fn();
      const onTractor = vi.fn();
      const onPromote = vi.fn();

      cheats.registerCheat('invasion', onInvasion);
      cheats.registerCheat('maxwaves', onMaxWaves);
      cheats.registerCheat('tractor', onTractor);
      cheats.registerCheat('promote', onPromote);

      // Type "invasion"
      for (const char of 'invasion') {
        cheats.handleKeyDown(char);
      }
      expect(onInvasion).toHaveBeenCalledTimes(1);

      // Type "maxwaves"
      for (const char of 'maxwaves') {
        cheats.handleKeyDown(char);
      }
      expect(onMaxWaves).toHaveBeenCalledTimes(1);

      // Type "tractor"
      for (const char of 'tractor') {
        cheats.handleKeyDown(char);
      }
      expect(onTractor).toHaveBeenCalledTimes(1);

      // Type "promote"
      for (const char of 'promote') {
        cheats.handleKeyDown(char);
      }
      expect(onPromote).toHaveBeenCalledTimes(1);
    });

    it('registers single debug keys ("B", "H", "Y", "R")', () => {
      const onExtraBall = vi.fn();
      const onBillionPts = vi.fn();
      const onToggleFps = vi.fn();
      const onRankUp = vi.fn();

      cheats.registerDebugKey('b', onExtraBall);
      cheats.registerDebugKey('h', onBillionPts);
      cheats.registerDebugKey('y', onToggleFps);
      cheats.registerDebugKey('r', onRankUp);

      cheats.handleKeyDown('b');
      expect(onExtraBall).toHaveBeenCalledTimes(1);

      cheats.handleKeyDown('H'); // case-insensitive
      expect(onBillionPts).toHaveBeenCalledTimes(1);

      cheats.handleKeyDown('Y');
      expect(onToggleFps).toHaveBeenCalledTimes(1);

      cheats.handleKeyDown('r');
      expect(onRankUp).toHaveBeenCalledTimes(1);
    });

    it('can be enabled or disabled', () => {
      const onCheat = vi.fn();
      cheats.registerCheat('secret', onCheat);

      cheats.setEnabled(false);
      expect(cheats.isEnabled()).toBe(false);

      for (const char of 'secret') {
        cheats.handleKeyDown(char);
      }
      expect(onCheat).not.toHaveBeenCalled();

      cheats.setEnabled(true);
      for (const char of 'secret') {
        cheats.handleKeyDown(char);
      }
      expect(onCheat).toHaveBeenCalledTimes(1);
    });

    it('clears sequence buffer on demand', () => {
      cheats.handleKeyDown('i');
      cheats.handleKeyDown('n');
      cheats.handleKeyDown('v');
      expect(cheats.getBuffer()).toBe('inv');

      cheats.clearBuffer();
      expect(cheats.getBuffer()).toBe('');
    });
  });
});
