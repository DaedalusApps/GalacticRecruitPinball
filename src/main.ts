import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TableScene } from './rendering/scene';
import { PhysicsWorld } from './physics/world';
import { Pinball } from './physics/ball';
import { Flipper } from './physics/flipper';
import { Plunger } from './physics/plunger';
import { KeyboardManager } from './input/keyboard';
import { TABLE_LAYOUT } from './table/layout';
import { ScoreManager } from './game/scoring';
import { GameStateManager } from './game/state';
import {
  Slingshot,
  AttackBumper,
  ReentryLaneSystem,
  LaunchRamp,
  DropTargetBank,
  SpotTargetBank,
  UfoBeamSinkHole,
  AlienSpinner,
  SpaceWarpRollover,
  ShieldKickback,
  DrainSensor,
  CenterPost,
  SkillShotLane,
} from './table/elements';
import { ProgressLightsRingVisual, EnergyCoreLadderVisual } from './table/lights';
import { UfoProgressionSystem } from './game/ufo-progression';
import { MothershipTractorBeam } from './game/tractor-beam';
import { MissionControl } from './game/control';
import { CameraManager, CameraMode } from './rendering/camera';
import { ParticleSystem } from './rendering/particles';
import { PostProcessingManager } from './rendering/postprocessing';
import { AttractMode } from './ui/attract';
import { SoundSynthesizer } from './audio/synth';
import { ChiptuneMusic } from './audio/music';
import { HighScoreManager } from './ui/highscore';
import { GameOverModal } from './ui/gameover';
import { CheatSystem } from './game/cheats';
import { COLORS, TABLE } from './utils/constants';

export class GameApp {
  public tableScene: TableScene;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public physicsWorld: PhysicsWorld;
  public world: CANNON.World;
  public pinball: Pinball;
  public leftFlipper: Flipper;
  public rightFlipper: Flipper;
  public plunger: Plunger;
  public leftSlingshot: Slingshot;
  public rightSlingshot: Slingshot;
  public bumpers: AttackBumper[] = [];
  public reentrySystem: ReentryLaneSystem;
  public launchRamp: LaunchRamp;
  public boosterDropTargets: DropTargetBank;
  public missionSpotTargets: SpotTargetBank;
  public medalSpotTargets: SpotTargetBank;
  public hazardLeftSpotTargets: SpotTargetBank;
  public hazardRightSpotTargets: SpotTargetBank;
  public ufoBeams: UfoBeamSinkHole[] = [];
  public leftSpinner: AlienSpinner;
  public rightSpinner: AlienSpinner;
  public spaceWarp: SpaceWarpRollover;
  public kickback: ShieldKickback;
  public drainSensor: DrainSensor;
  public centerPost: CenterPost;
  public skillShot: SkillShotLane;
  public tractorBeam: MothershipTractorBeam;
  public ufoProgression: UfoProgressionSystem;
  public missionControl: MissionControl;
  public progressLightsRing: ProgressLightsRingVisual;
  public energyCoreLadder: EnergyCoreLadderVisual;
  public keyboard: KeyboardManager;
  public scoreManager: ScoreManager;
  public gameState: GameStateManager;

  // Phase 4 Visuals & Camera Systems
  public cameraManager: CameraManager;
  public particleSystem: ParticleSystem;
  public postProcessing: PostProcessingManager;
  public attractMode: AttractMode;

  // Phase 5 Audio, High Score, Game Over & Cheats Systems
  public soundSynth: SoundSynthesizer;
  public music: ChiptuneMusic;
  public highScoreManager: HighScoreManager;
  public gameOverModal: GameOverModal;
  public cheats: CheatSystem;

  public isRunning: boolean = false;
  private animFrameId: number | null = null;
  private lastTime: number = 0;

  // FPS tracking (debug overlay)
  private frameCount: number = 0;
  private fpsTimer: number = 0;
  private currentFps: number = 60;

  constructor(canvas: HTMLCanvasElement) {
    // 1. Initialize Table Scene (Three.js Scene, Pinball Camera, Lights, Playfield, Cabinet)
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    this.tableScene = new TableScene(aspect);
    this.scene = this.tableScene.scene;
    this.camera = this.tableScene.camera;

    // 2. Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // 3. Initialize Audio & UI Polish Subsystems (P5.1, P5.2, P5.4, P5.5, P5.6)
    this.soundSynth = new SoundSynthesizer();
    this.music = new ChiptuneMusic();
    this.highScoreManager = new HighScoreManager();
    this.gameOverModal = new GameOverModal({
      highScoreManager: this.highScoreManager,
      onRestart: () => this.restartGame(),
      onAttractRequested: () => this.returnToAttract(),
    });
    this.cheats = new CheatSystem();
    this.setupCheats();

    // 4. Initialize Visual Polish Subsystems (P4.5, P4.6, P4.7, P4.8)
    this.cameraManager = new CameraManager(this.camera);
    this.particleSystem = new ParticleSystem({ maxParticles: 800 });
    this.scene.add(this.particleSystem.mesh);

    this.postProcessing = new PostProcessingManager();
    this.postProcessing.init(this.renderer, this.scene, this.camera);

    this.attractMode = new AttractMode({
      onStartRequested: () => this.onGameStart(),
    });
    this.cameraManager.setMode(CameraMode.ATTRACT);
    this.attractMode.start();

    // 5. Initialize Score, Game State & Mission Control Managers
    this.scoreManager = new ScoreManager();
    this.gameState = new GameStateManager({ initialBalls: 3, ballSaverDuration: 10.0 });
    this.missionControl = new MissionControl({
      scoreManager: this.scoreManager,
      gameState: this.gameState,
      fuelDuration: 60.0,
    });
    this.setupGameStateListeners();

    // 6. Initialize Visual Lights Ring & Energy Core Ladder
    this.progressLightsRing = new ProgressLightsRingVisual();
    this.scene.add(this.progressLightsRing.mesh);

    this.energyCoreLadder = new EnergyCoreLadderVisual();
    this.scene.add(this.energyCoreLadder.mesh);

    this.setupMissionControlListeners();

    // 7. Initialize Physics World, Pinball, Flippers & Plunger
    this.physicsWorld = new PhysicsWorld();
    this.world = this.physicsWorld.world;

    this.pinball = new Pinball({ material: this.physicsWorld.ballMaterial });
    this.physicsWorld.addPinball(this.pinball);
    this.scene.add(this.pinball.mesh);

    this.leftFlipper = new Flipper({
      side: 'left',
      material: this.physicsWorld.flipperMaterial,
    });
    this.physicsWorld.addFlipper(this.leftFlipper);
    this.scene.add(this.leftFlipper.mesh);

    this.rightFlipper = new Flipper({
      side: 'right',
      material: this.physicsWorld.flipperMaterial,
    });
    this.physicsWorld.addFlipper(this.rightFlipper);
    this.scene.add(this.rightFlipper.mesh);

    this.plunger = new Plunger({
      material: this.physicsWorld.wallMaterial,
    });
    this.physicsWorld.addBody(this.plunger.body);
    this.scene.add(this.plunger.mesh);

    // 8. Initialize Slingshots (Left & Right)
    this.leftSlingshot = new Slingshot({
      side: 'left',
      material: this.physicsWorld.wallMaterial,
    });
    this.leftSlingshot.onHit = (score) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSlingshot();
        this.scoreManager.addPoints(score);
        this.missionControl.handleHit('slingshot');
        this.cameraManager.screenShake.addTrauma(0.2);
        this.particleSystem.emitSlingshotBurst(
          this.leftSlingshot.position,
          { x: 0.8, y: 1.0, z: 0.2 },
          COLORS.NEON_GREEN,
          16
        );
      }
    };
    this.physicsWorld.addSlingshot(this.leftSlingshot);
    this.scene.add(this.leftSlingshot.mesh);

    this.rightSlingshot = new Slingshot({
      side: 'right',
      material: this.physicsWorld.wallMaterial,
    });
    this.rightSlingshot.onHit = (score) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSlingshot();
        this.scoreManager.addPoints(score);
        this.missionControl.handleHit('slingshot');
        this.cameraManager.screenShake.addTrauma(0.2);
        this.particleSystem.emitSlingshotBurst(
          this.rightSlingshot.position,
          { x: -0.8, y: 1.0, z: 0.2 },
          COLORS.NEON_CYAN,
          16
        );
      }
    };
    this.physicsWorld.addSlingshot(this.rightSlingshot);
    this.scene.add(this.rightSlingshot.mesh);

    // 9. Initialize 3 Attack Bumpers (Alien Pixel Models)
    this.bumpers = TABLE_LAYOUT.BUMPERS.map(
      (cfg, idx) =>
        new AttackBumper({
          id: `bumper-${idx + 1}`,
          position: cfg.position,
          radius: cfg.radius,
          material: this.physicsWorld.wallMaterial,
        })
    );
    for (const bumper of this.bumpers) {
      bumper.onHit = (b, score) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playBumper(b.level);
          this.scoreManager.addPoints(score);
          const isTop = b.id === 'bumper-1' || b.id === 'bumper-top';
          this.missionControl.handleHit(isTop ? 'top_bumper' : 'bumper', { isTopBumper: isTop });
          this.cameraManager.screenShake.addTrauma(0.18);
          this.particleSystem.emitBumperBurst(b.position, b.getColor(), 22);
        }
      };
      this.physicsWorld.addBumper(bumper);
      this.scene.add(bumper.mesh);
    }

    // 10. Initialize Re-entry Rollover Lanes System
    this.reentrySystem = new ReentryLaneSystem({
      bumpers: this.bumpers,
      laneConfigs: TABLE_LAYOUT.REENTRY_LANES,
    });
    this.reentrySystem.onCycleComplete = () => {
      this.soundSynth.playSkillShot();
      this.scoreManager.advanceMultiplier();
      this.cameraManager.screenShake.addTrauma(0.25);
      this.particleSystem.emitFireworks({ x: 0, y: 14.0, z: 1.0 }, 25);
    };
    for (const lane of this.reentrySystem.lanes) {
      lane.onRollover = () => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playSpotTarget();
          this.missionControl.handleHit('lane');
          this.particleSystem.emitBumperBurst(lane.position, COLORS.NEON_GREEN, 10);
        }
      };
      this.scene.add(lane.mesh);
    }

    // 11. Initialize Launch Ramp & Wire Habitrail
    this.launchRamp = new LaunchRamp({
      id: 'cannon-launch-ramp',
      config: TABLE_LAYOUT.LAUNCH_RAMP,
      material: this.physicsWorld.wallMaterial,
    });
    this.launchRamp.onRampEnter = () => {
      this.soundSynth.playRamp();
      if (!this.gameState.isTilted && this.missionControl.getState() === 'REQUESTED') {
        this.missionControl.acceptMission();
      }
    };
    this.launchRamp.onRampComplete = (ramp) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playRamp();
        this.scoreManager.addPoints(ramp.score);
        this.missionControl.handleHit('ramp');
        this.particleSystem.emitSlingshotBurst(
          ramp.exit,
          { x: -1, y: -0.5, z: 0 },
          COLORS.NEON_CYAN,
          14
        );
      }
    };
    this.physicsWorld.addLaunchRamp(this.launchRamp);
    this.scene.add(this.launchRamp.mesh);

    // 12. Initialize Booster Drop Targets
    this.boosterDropTargets = new DropTargetBank({
      id: 'booster-drop-targets',
      configs: TABLE_LAYOUT.DROP_TARGETS.BOOSTER,
      material: this.physicsWorld.wallMaterial,
    });
    for (const target of this.boosterDropTargets.targets) {
      target.onHit = (t) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playDropTarget();
          this.scoreManager.addPoints(t.score);
          this.missionControl.handleHit('drop_target');
          this.particleSystem.emitBumperBurst(t.position, COLORS.NEON_YELLOW, 12);
        }
      };
    }
    this.boosterDropTargets.onBankCleared = () => {
      this.soundSynth.playMissionAccepted();
      this.leftSpinner.setBoosted(true);
      this.rightSpinner.setBoosted(true);
      this.missionControl.refuel(20);
      if (!this.gameState.isTilted) {
        this.scoreManager.addPoints(50000);
        this.cameraManager.screenShake.addTrauma(0.25);
        this.particleSystem.emitFireworks({ x: -4.5, y: 5.0, z: 1.0 }, 30);
      }
    };
    this.physicsWorld.addDropTargetBank(this.boosterDropTargets);
    for (const target of this.boosterDropTargets.targets) {
      this.scene.add(target.mesh);
    }

    // 13. Initialize Spot Target Banks
    this.missionSpotTargets = new SpotTargetBank({
      id: 'mission-spot-targets',
      configs: TABLE_LAYOUT.SPOT_TARGETS.MISSION,
      material: this.physicsWorld.wallMaterial,
    });
    for (const target of this.missionSpotTargets.targets) {
      target.onHit = (_t, score) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playSpotTarget();
          this.scoreManager.addPoints(score);
          if (this.missionControl.getState() === 'IDLE') {
            this.missionControl.requestMission();
          } else {
            this.missionControl.handleHit('spot_target');
          }
          this.particleSystem.emitBumperBurst(target.position, COLORS.NEON_CYAN, 12);
        }
      };
    }
    this.physicsWorld.addSpotTargetBank(this.missionSpotTargets);
    for (const target of this.missionSpotTargets.targets) {
      this.scene.add(target.mesh);
    }

    this.medalSpotTargets = new SpotTargetBank({
      id: 'medal-spot-targets',
      configs: TABLE_LAYOUT.SPOT_TARGETS.MEDAL,
      material: this.physicsWorld.wallMaterial,
    });
    for (const target of this.medalSpotTargets.targets) {
      target.onHit = (_t, score) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playSpotTarget();
          this.scoreManager.addPoints(score);
          this.missionControl.handleHit('medal_target');
          this.particleSystem.emitBumperBurst(target.position, COLORS.NEON_GREEN, 12);
        }
      };
    }
    this.medalSpotTargets.onBankComplete = () => {
      this.soundSynth.playSkillShot();
      this.scoreManager.advanceMultiplier();
      this.cameraManager.screenShake.addTrauma(0.25);
      this.particleSystem.emitFireworks({ x: -2.5, y: 11.0, z: 1.0 }, 25);
      this.medalSpotTargets.resetAll();
    };
    this.physicsWorld.addSpotTargetBank(this.medalSpotTargets);
    for (const target of this.medalSpotTargets.targets) {
      this.scene.add(target.mesh);
    }

    this.hazardLeftSpotTargets = new SpotTargetBank({
      id: 'hazard-left-spot-targets',
      configs: TABLE_LAYOUT.SPOT_TARGETS.HAZARDS_LEFT,
      material: this.physicsWorld.wallMaterial,
    });
    for (const target of this.hazardLeftSpotTargets.targets) {
      target.onHit = (_t, score) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playSpotTarget();
          this.scoreManager.addPoints(score);
          this.missionControl.handleHit('hazard_left');
          this.particleSystem.emitBumperBurst(target.position, COLORS.NEON_PINK, 12);
        }
      };
    }
    this.physicsWorld.addSpotTargetBank(this.hazardLeftSpotTargets);
    for (const target of this.hazardLeftSpotTargets.targets) {
      this.scene.add(target.mesh);
    }

    this.hazardRightSpotTargets = new SpotTargetBank({
      id: 'hazard-right-spot-targets',
      configs: TABLE_LAYOUT.SPOT_TARGETS.HAZARDS_RIGHT,
      material: this.physicsWorld.wallMaterial,
    });
    for (const target of this.hazardRightSpotTargets.targets) {
      target.onHit = (_t, score) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playSpotTarget();
          this.scoreManager.addPoints(score);
          this.missionControl.handleHit('hazard_right');
          this.particleSystem.emitBumperBurst(target.position, COLORS.NEON_PINK, 12);
        }
      };
    }
    this.physicsWorld.addSpotTargetBank(this.hazardRightSpotTargets);
    for (const target of this.hazardRightSpotTargets.targets) {
      this.scene.add(target.mesh);
    }

    // 14. Initialize 3 UFO Beams (Yellow, Red, Green)
    this.ufoBeams = [
      new UfoBeamSinkHole({
        id: 'ufo-beam-yellow',
        config: TABLE_LAYOUT.UFO_BEAMS.YELLOW,
      }),
      new UfoBeamSinkHole({
        id: 'ufo-beam-red',
        config: TABLE_LAYOUT.UFO_BEAMS.RED,
      }),
      new UfoBeamSinkHole({
        id: 'ufo-beam-green',
        config: TABLE_LAYOUT.UFO_BEAMS.GREEN,
      }),
    ];

    // 15. Initialize Left & Right Alien Spinners
    this.leftSpinner = new AlienSpinner({
      id: 'spinner-left',
      config: TABLE_LAYOUT.SPINNERS.LEFT,
    });
    this.leftSpinner.onSpin = (spinner, newSpins) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSpinner();
        this.scoreManager.addPoints(spinner.getPointValue() * newSpins);
        this.missionControl.handleHit('spinner', { spins: newSpins });
        this.particleSystem.emitSlingshotBurst(
          spinner.position,
          { x: 0.5, y: 0.5, z: 0.2 },
          COLORS.NEON_YELLOW,
          6 * newSpins
        );
      }
    };
    this.physicsWorld.addSpinner(this.leftSpinner);
    this.scene.add(this.leftSpinner.mesh);

    this.rightSpinner = new AlienSpinner({
      id: 'spinner-right',
      config: TABLE_LAYOUT.SPINNERS.RIGHT,
    });
    this.rightSpinner.onSpin = (spinner, newSpins) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSpinner();
        this.scoreManager.addPoints(spinner.getPointValue() * newSpins);
        this.missionControl.handleHit('spinner', { spins: newSpins });
        this.particleSystem.emitSlingshotBurst(
          spinner.position,
          { x: -0.5, y: 0.5, z: 0.2 },
          COLORS.NEON_YELLOW,
          6 * newSpins
        );
      }
    };
    this.physicsWorld.addSpinner(this.rightSpinner);
    this.scene.add(this.rightSpinner.mesh);

    // 16. Initialize Space Warp Rollover
    this.spaceWarp = new SpaceWarpRollover({
      id: 'space-warp-rollover',
      config: TABLE_LAYOUT.SPACE_WARP,
    });
    this.spaceWarp.onWarp = (warp) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSinkhole();
        this.scoreManager.addPoints(warp.score);
        this.missionControl.handleHit('space_warp');
        this.particleSystem.emitFireworks(warp.position, 20);
      }
    };
    this.physicsWorld.addSpaceWarp(this.spaceWarp);
    this.scene.add(this.spaceWarp.mesh);

    // 17. Initialize Left Outlane Shield Kickback
    this.kickback = new ShieldKickback({
      id: 'left-shield-kickback',
      config: TABLE_LAYOUT.KICKBACK,
      material: this.physicsWorld.wallMaterial,
    });
    this.kickback.onKickbackFired = (k) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playKickback();
        this.scoreManager.addPoints(k.score);
        this.missionControl.handleHit('kickback');
        this.cameraManager.screenShake.addTrauma(0.25);
        this.particleSystem.emitSlingshotBurst(
          this.kickback.position,
          { x: 0.5, y: 1.0, z: 0.2 },
          COLORS.NEON_GREEN,
          20
        );
      }
    };
    this.physicsWorld.addKickback(this.kickback);
    this.scene.add(this.kickback.mesh);

    // 18. Initialize Table Bottom Drain Sensor
    this.drainSensor = new DrainSensor({
      id: 'bottom-drain-sensor',
      config: TABLE_LAYOUT.DRAIN,
    });
    this.drainSensor.onBallDrain = (_drain, pinball) => {
      this.soundSynth.playDrain();
      this.cameraManager.screenShake.addTrauma(0.35);
      this.particleSystem.emitDrainBurst({ x: 0, y: -TABLE.LENGTH / 2 + 1, z: 0.2 });

      // Award end-of-ball bonus if ball was not saved
      if (!this.gameState.isBallSaverActive) {
        this.scoreManager.awardEndOfBallBonus({
          missions: 0,
          medals: this.medalSpotTargets.getLitCount(),
          fuel: Math.floor(this.missionControl.energyCore.getFuel()),
          rank: this.missionControl.rankManager.getRankNumber(),
          isTilted: this.gameState.isTilted,
        });
      }
      this.missionControl.handleBallDrain();
      this.gameState.handleBallDrain(pinball);
      this.drainSensor.reset();
      this.updateHUD();
    };
    this.physicsWorld.addDrainSensor(this.drainSensor);
    this.scene.add(this.drainSensor.mesh);

    // 19. Initialize Center Post (Barrier Drone)
    this.centerPost = new CenterPost({
      id: 'center-barrier-drone',
      config: TABLE_LAYOUT.CENTER_POST,
      material: this.physicsWorld.wallMaterial,
    });
    this.centerPost.onBallSaved = (post) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playCenterPost();
        this.scoreManager.addPoints(post.score);
        this.missionControl.handleHit('center_post');
        this.cameraManager.screenShake.addTrauma(0.25);
        this.particleSystem.emitBumperBurst(this.centerPost.position, COLORS.NEON_YELLOW, 20);
      }
    };
    this.physicsWorld.addCenterPost(this.centerPost);
    this.scene.add(this.centerPost.mesh);

    // 20. Initialize Mothership Tractor Beam (Gravity Well)
    this.tractorBeam = new MothershipTractorBeam({
      id: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.id,
      position: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.position,
      attractionRadius: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.attractionRadius,
      captureRadius: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.captureRadius,
      pullForce: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.pullForce,
      holdDuration: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.holdDuration,
      ejectSpeed: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.ejectSpeed,
      score: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.score,
      color: TABLE_LAYOUT.MOTHERSHIP_TRACTOR_BEAM.color,
    });
    this.tractorBeam.onCapture = (_ball, score) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSinkhole();
        this.scoreManager.addPoints(score);
        this.missionControl.handleHit('tractor_beam');
        this.cameraManager.screenShake.addTrauma(0.3);
        this.particleSystem.emitVortexBurst(
          this.tractorBeam.position,
          this.tractorBeam.color,
          35
        );
        this.updateHUD();
      }
    };
    this.tractorBeam.onEject = () => {
      this.soundSynth.playUfoEject();
      this.cameraManager.screenShake.addTrauma(0.35);
      this.particleSystem.emitFireworks(this.tractorBeam.position, 40);
    };
    this.physicsWorld.addTractorBeam(this.tractorBeam);
    this.scene.add(this.tractorBeam.mesh);

    // 21. Initialize UFO Beam Progression System (P2.5)
    this.ufoProgression = new UfoProgressionSystem({
      scoreManager: this.scoreManager,
      gameState: this.gameState,
      centerPost: this.centerPost,
      tractorBeam: this.tractorBeam,
    });

    for (const beam of this.ufoBeams) {
      beam.onCapture = (b) => {
        if (!this.gameState.isTilted) {
          this.soundSynth.playSinkhole();
          this.scoreManager.addPoints(b.score);
          this.ufoProgression.registerHit();
          this.missionControl.handleHit('ufo_beam', { color: b.beamType });
          this.cameraManager.screenShake.addTrauma(0.2);
          this.particleSystem.emitVortexBurst(b.position, b.beamColor, 25);
          this.updateHUD();
        }
      };
      beam.onBallEjected = (b) => {
        this.soundSynth.playUfoEject();
        this.cameraManager.screenShake.addTrauma(0.18);
        this.particleSystem.emitBumperBurst(b.position, b.beamColor, 18);
      };
      this.physicsWorld.addUfoBeam(beam);
      this.scene.add(beam.mesh);
    }

    // 22. Initialize Skill Shot Lane (Plunger Lane Indicator Lights)
    this.skillShot = new SkillShotLane({
      id: 'skill-shot-lane',
      config: TABLE_LAYOUT.SKILL_SHOT,
    });
    this.skillShot.onSkillShotAwarded = (_lightIndex, score) => {
      if (!this.gameState.isTilted) {
        this.soundSynth.playSkillShot();
        this.scoreManager.addPoints(score);
        this.missionControl.handleHit('skill_shot');
        this.cameraManager.screenShake.addTrauma(0.25);
        this.particleSystem.emitFireworks({ x: TABLE.WIDTH / 2 - 1.2, y: 10.0, z: 0.5 }, 25);
      }
    };
    this.physicsWorld.addSkillShotLane(this.skillShot);
    this.scene.add(this.skillShot.mesh);

    // 23. Initialize Keyboard Controls, Audio Toggles & Camera Controls
    this.keyboard = new KeyboardManager();
    this.setupKeyboardControls();
    this.setupCameraControls();
    this.setupAudioControls();

    // Update Initial HUD display
    this.updateHUD();

    // Handle Window Resizing
    window.addEventListener('resize', this.onResize);
  }

  public onGameStart(): void {
    this.attractMode.stop();
    this.gameOverModal.hide();
    this.cameraManager.setMode(CameraMode.FIXED);
    this.music.start();
    this.updateHUD();
  }

  public restartGame(): void {
    this.gameOverModal.hide();
    this.scoreManager.reset();
    this.gameState.startNewGame();
    this.missionControl.reset();
    this.boosterDropTargets.resetAll();
    this.medalSpotTargets.resetAll();
    this.reentrySystem.setStates([false, false, false]);
    this.centerPost.retract();
    this.tractorBeam.deactivate();
    this.cameraManager.setMode(CameraMode.FIXED);
    this.pinball.reset();
    this.music.start();
    this.updateHUD();
  }

  public returnToAttract(): void {
    this.gameOverModal.hide();
    this.music.stop();
    this.cameraManager.setMode(CameraMode.ATTRACT);
    this.attractMode.start();
    this.updateHUD();
  }

  private setupCheats(): void {
    // 1. Secret Keyword Cheats
    this.cheats.registerCheat('invasion', () => {
      this.scoreManager.addPoints(10000000);
      this.soundSynth.playPromotion();
      this.cameraManager.screenShake.addTrauma(0.5);
      this.particleSystem.emitFireworks({ x: 0, y: 5, z: 2 }, 60);
      this.updateHUD();
    });

    this.cheats.registerCheat('maxwaves', () => {
      this.gameState.extraBalls = 99;
      this.soundSynth.playSkillShot();
      this.updateHUD();
    });

    this.cheats.registerCheat('tractor', () => {
      this.tractorBeam.activate();
      this.soundSynth.playSinkhole();
      this.updateHUD();
    });

    this.cheats.registerCheat('promote', () => {
      const res = this.missionControl.rankManager.promote();
      if (res.promoted) {
        this.missionControl.onPromotion?.(res.newRank, res.bonusPoints);
      }
      this.updateHUD();
    });

    // 2. Single-Key Debug Shortcuts
    this.cheats.registerDebugKey('b', () => {
      this.gameState.awardExtraBall();
      this.soundSynth.playSkillShot();
      this.updateHUD();
    });

    this.cheats.registerDebugKey('h', () => {
      this.scoreManager.addPoints(1000000000);
      this.soundSynth.playPromotion();
      this.updateHUD();
    });

    this.cheats.registerDebugKey('r', () => {
      const res = this.missionControl.rankManager.promote();
      if (res.promoted) {
        this.missionControl.onPromotion?.(res.newRank, res.bonusPoints);
      }
      this.updateHUD();
    });

    this.cheats.registerDebugKey('y', () => {
      const fpsEl = document.getElementById('fps-display');
      if (fpsEl) {
        fpsEl.style.display = fpsEl.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  private setupAudioControls(): void {
    if (typeof window === 'undefined') return;

    // Toggle Sound on 'S' key
    window.addEventListener('keydown', (e) => {
      if (e.key === 's' || e.key === 'S') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        this.toggleSound();
      }
    });

    // Sound toggle button click listener
    const soundBtn = document.getElementById('sound-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.toggleSound();
      });
    }
  }

  public toggleSound(): void {
    const isMuted = this.soundSynth.toggleMute();
    this.music.setMuted(isMuted);
    this.updateHUD();
  }

  private setupCameraControls(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        this.cameraManager.toggleMode();
        this.updateHUD();
      }
    });

    const camBtn = document.getElementById('camera-btn');
    if (camBtn) {
      camBtn.addEventListener('click', () => {
        this.cameraManager.toggleMode();
        this.updateHUD();
      });
    }
  }

  private setupMissionControlListeners(): void {
    this.missionControl.onProgressLightsChanged = (_count, states) => {
      this.progressLightsRing.setStates(states);
    };

    this.missionControl.onPromotion = () => {
      this.soundSynth.playPromotion();
      this.progressLightsRing.celebratePromotion();
      this.cameraManager.screenShake.addTrauma(0.6);
      this.particleSystem.emitFireworks({ x: 0, y: 3.0, z: 2.0 }, 75);
      this.updateHUD();
    };

    this.missionControl.onFuelChanged = (_fuel, pct, isLow) => {
      this.energyCoreLadder.setFuelPercentage(pct, isLow);
      if (isLow && Math.random() < 0.1) {
        this.soundSynth.playLowFuel();
      }
    };

    this.missionControl.onTickerMessage = () => {
      this.updateHUD();
    };

    this.missionControl.onStateChange = (state) => {
      if (state === 'REQUESTED') {
        this.soundSynth.playMissionRequested();
      } else if (state === 'ACTIVE') {
        this.soundSynth.playMissionAccepted();
      } else if (state === 'COMPLETED') {
        this.soundSynth.playMissionComplete();
      }
      this.updateHUD();
    };
  }

  private setupGameStateListeners(): void {
    this.scoreManager.onScoreChange = () => {
      this.updateHUD();
    };

    this.scoreManager.onMultiplierChange = () => {
      this.updateHUD();
    };

    this.gameState.onTilt = () => {
      this.soundSynth.playTiltBuzzer();
      this.leftFlipper.deactivate();
      this.rightFlipper.deactivate();
      this.cameraManager.screenShake.addTrauma(0.4);
      this.updateHUD();
    };

    this.gameState.onTiltWarning = () => {
      this.soundSynth.playTiltWarning();
      this.cameraManager.screenShake.addTrauma(0.2);
      this.updateHUD();
    };

    this.gameState.onBallSaved = () => {
      this.soundSynth.playCenterPost();
      this.particleSystem.emitFireworks({ x: 0, y: -10, z: 1.0 }, 30);
      this.updateHUD();
    };

    this.gameState.onGameOver = () => {
      this.soundSynth.playGameOver();
      this.music.stop();

      const finalScore = this.scoreManager.getScore();
      const rankTitle = this.missionControl.rankManager.getRankTitle();
      const bonusScore = this.scoreManager.getLastBonus();
      const isHigh = this.highScoreManager.isHighScore(finalScore);

      this.gameOverModal.show({
        score: finalScore,
        rank: rankTitle,
        missionsCompleted: 0,
        bonusScore,
        isHighScore: isHigh,
      });

      this.updateHUD();
    };

    this.gameState.onNextBall = () => {
      this.updateHUD();
    };

    this.gameState.onExtraBallAwarded = () => {
      this.soundSynth.playSkillShot();
      this.cameraManager.screenShake.addTrauma(0.3);
      this.particleSystem.emitFireworks({ x: 0, y: 0, z: 2.0 }, 50);
      this.updateHUD();
    };
  }

  private setupKeyboardControls(): void {
    // Flipper controls (also cycles lit re-entry lanes)
    this.keyboard.onFlipperLeft(
      () => {
        if (this.gameState.areFlippersEnabled()) {
          this.soundSynth.playFlipper();
          this.leftFlipper.activate();
          this.reentrySystem.cycleLeft();
        }
      },
      () => this.leftFlipper.deactivate()
    );

    this.keyboard.onFlipperRight(
      () => {
        if (this.gameState.areFlippersEnabled()) {
          this.soundSynth.playFlipper();
          this.rightFlipper.activate();
          this.reentrySystem.cycleRight();
        }
      },
      () => this.rightFlipper.deactivate()
    );

    // Plunger controls (Space / Enter / ArrowDown)
    this.keyboard.onPlunger(
      () => {
        if (this.attractMode.isActive()) {
          this.attractMode.requestStart();
          return;
        }
        if (this.gameState.areFlippersEnabled()) {
          this.soundSynth.playPlungerCharge();
          this.plunger.startCharge();
          this.skillShot.startLaunch();
        }
      },
      () => {
        if (this.gameState.areFlippersEnabled()) {
          this.soundSynth.playPlungerRelease();
          this.plunger.release(this.pinball);
          this.cameraManager.screenShake.addTrauma(0.12);
          this.particleSystem.emitSlingshotBurst(
            { x: TABLE.WIDTH / 2 - 1.2, y: -TABLE.LENGTH / 2 + 3.0, z: 0.2 },
            { x: 0, y: 1, z: 0.1 },
            COLORS.NEON_CYAN,
            12
          );
          this.gameState.armBallSaver(10.0);
          this.updateHUD();
        }
      }
    );

    // Nudge controls
    this.keyboard.onNudgeLeft(() => {
      this.gameState.registerNudge('left', 1.0);
      this.cameraManager.screenShake.addTrauma(0.25);
      if (!this.gameState.isTilted) {
        this.pinball.applyImpulse({ x: 0.5, y: 0.1, z: 0 });
      }
      this.updateHUD();
    });

    this.keyboard.onNudgeRight(() => {
      this.gameState.registerNudge('right', 1.0);
      this.cameraManager.screenShake.addTrauma(0.25);
      if (!this.gameState.isTilted) {
        this.pinball.applyImpulse({ x: -0.5, y: 0.1, z: 0 });
      }
      this.updateHUD();
    });

    this.keyboard.onNudgeUp(() => {
      this.gameState.registerNudge('up', 1.0);
      this.cameraManager.screenShake.addTrauma(0.25);
      if (!this.gameState.isTilted) {
        this.pinball.applyImpulse({ x: 0, y: 0.8, z: 0 });
      }
      this.updateHUD();
    });
  }

  public updateHUD(): void {
    if (typeof document === 'undefined') return;

    const scoreElem = document.getElementById('score-display');
    const highScoreElem = document.getElementById('high-score-display');
    const multElem = document.getElementById('mult-display');
    const ballElem = document.getElementById('ball-display');
    const rankElem = document.getElementById('rank-display');
    const tickerElem = document.getElementById('lcd-ticker');
    const camModeElem = document.getElementById('camera-mode-display');
    const soundStatusElem = document.getElementById('sound-status-display');

    if (scoreElem) {
      scoreElem.textContent = this.scoreManager.getScore().toLocaleString('en-US');
    }
    if (highScoreElem && this.highScoreManager) {
      highScoreElem.textContent = this.highScoreManager.getTopScore().toLocaleString('en-US');
    }
    if (multElem) {
      multElem.textContent = `${this.scoreManager.getMultiplier()}X`;
    }
    if (rankElem && this.missionControl) {
      rankElem.textContent = this.missionControl.rankManager.getRankTitle().toUpperCase();
    }
    if (tickerElem && this.missionControl) {
      tickerElem.textContent = this.missionControl.ticker.getCurrentMessage();
    }
    if (camModeElem && this.cameraManager) {
      camModeElem.textContent = this.cameraManager.getMode().toUpperCase();
    }
    if (soundStatusElem && this.soundSynth) {
      soundStatusElem.textContent = this.soundSynth.isMuted() ? 'OFF' : 'ON';
    }
    if (ballElem) {
      if (this.gameState.isGameOver) {
        ballElem.textContent = 'GAME OVER';
      } else if (this.gameState.isTilted) {
        ballElem.textContent = 'TILT';
      } else if (this.gameState.extraBalls > 0) {
        ballElem.textContent = `${this.gameState.currentBall} (+${this.gameState.extraBalls} EXTRA)`;
      } else {
        ballElem.textContent = `${this.gameState.currentBall}`;
      }
    }
  }

  public onResize = (): void => {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.tableScene.onResize(width, height);
    this.renderer.setSize(width, height, false);
    this.postProcessing.setSize(width, height);
  };

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animate(this.lastTime);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public stepPhysics(deltaSec: number): void {
    // 1. Update Game State, Mission Control & Audio Loop
    this.gameState.update(deltaSec);
    this.missionControl.update(deltaSec);
    this.progressLightsRing.update(deltaSec);
    this.energyCoreLadder.update(deltaSec);
    this.music.update(deltaSec);

    // 2. Update Visual Systems (Particles, Attract Mode, Camera)
    this.particleSystem.update(deltaSec);
    this.attractMode.update(deltaSec);
    this.cameraManager.update(deltaSec, this.pinball.mesh.position);

    // 3. Update Flippers & Plunger
    this.leftFlipper.update(deltaSec);
    this.rightFlipper.update(deltaSec);
    this.plunger.update(deltaSec, this.pinball);
    this.leftSlingshot.update(deltaSec);
    this.rightSlingshot.update(deltaSec);
    for (const bumper of this.bumpers) {
      bumper.update(deltaSec);
    }
    this.reentrySystem.update(deltaSec, this.pinball);

    // 4. Update table elements
    this.launchRamp.checkEntry(this.pinball);
    this.launchRamp.update(deltaSec, this.pinball);
    this.boosterDropTargets.update(deltaSec);
    this.missionSpotTargets.update(deltaSec);
    this.medalSpotTargets.update(deltaSec);
    this.hazardLeftSpotTargets.update(deltaSec);
    this.hazardRightSpotTargets.update(deltaSec);
    for (const beam of this.ufoBeams) {
      beam.checkCapture(this.pinball);
      beam.update(deltaSec, this.pinball);
    }
    this.leftSpinner.update(deltaSec, this.pinball);
    this.rightSpinner.update(deltaSec, this.pinball);
    this.spaceWarp.checkRollover(this.pinball);
    this.spaceWarp.update(deltaSec);

    // 5. Update Outlanes, Drain, Center Post, Skill Shot & Tractor Beam
    this.kickback.update(deltaSec, this.pinball);
    this.drainSensor.update(deltaSec, this.pinball);
    this.centerPost.update(deltaSec, this.pinball);
    this.skillShot.update(deltaSec, this.pinball);
    this.tractorBeam.update(deltaSec, this.pinball);

    // 6. Cannon World Step & Ball Sync
    this.physicsWorld.step(deltaSec);
    this.pinball.sync();
  }

  private animate = (now: number): void => {
    if (!this.isRunning) return;
    const deltaSec = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Track FPS
    this.frameCount++;
    this.fpsTimer += deltaSec;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
      const fpsVal = document.getElementById('fps-val');
      if (fpsVal) fpsVal.textContent = String(this.currentFps);
    }

    this.stepPhysics(deltaSec);
    this.tableScene.update(deltaSec);
    this.postProcessing.render(this.scene, this.camera);

    this.animFrameId = requestAnimationFrame(this.animate);
  };

  public destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    this.keyboard.destroy();
    this.attractMode.destroy();
    this.cheats.destroy();
    this.music.stop();
    this.postProcessing.dispose();
    this.renderer.dispose();
  }
}

// Auto-boot if in browser context with canvas present
if (typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pinball-canvas') as HTMLCanvasElement;
    if (canvas) {
      const app = new GameApp(canvas);
      app.onResize();
      app.start();
      (window as unknown as { __GAME_APP__: GameApp }).__GAME_APP__ = app;
    }
  });
}
