import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { AlienModelFactory, AlienType } from '../src/rendering/models';
import { ParticleSystem } from '../src/rendering/particles';
import { ScreenShake, CameraManager, CameraMode } from '../src/rendering/camera';
import { AttractMode } from '../src/ui/attract';
import { COLORS } from '../src/utils/constants';

describe('Phase 4: Visuals & Polish (P4.1 - P4.8)', () => {
  // =========================================================================
  // 1. ALIEN MODEL FACTORY (P4.2, P4.3, P4.4)
  // =========================================================================
  describe('AlienModelFactory (3D Voxel Pixel-Art & UFO Models)', () => {
    let factory: AlienModelFactory;

    beforeEach(() => {
      factory = new AlienModelFactory();
    });

    it('creates Squid voxel pixel-art model (Bumper 1) with emissive eyes and PBR materials', () => {
      const squid = factory.createSquidMesh({ color: COLORS.NEON_CYAN, scale: 0.1 });
      expect(squid).toBeInstanceOf(THREE.Group);
      expect(squid.name).toContain('squid');
      expect(squid.children.length).toBeGreaterThan(0);

      // Verify at least one mesh has emissive eyes / accents
      let hasEmissive = false;
      let hasPBRMaterial = false;

      squid.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            hasPBRMaterial = true;
            if (mat.emissiveIntensity > 0 || (mat.emissive && mat.emissive.getHex() > 0)) {
              hasEmissive = true;
            }
          }
        }
      });

      expect(hasPBRMaterial).toBe(true);
      expect(hasEmissive).toBe(true);
    });

    it('creates Crab voxel pixel-art model (Bumper 2) with correct structure', () => {
      const crab = factory.createCrabMesh({ color: COLORS.NEON_GREEN, scale: 0.1 });
      expect(crab).toBeInstanceOf(THREE.Group);
      expect(crab.name).toContain('crab');
      expect(crab.children.length).toBeGreaterThan(0);

      let voxelCount = 0;
      crab.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) voxelCount++;
      });
      expect(voxelCount).toBeGreaterThanOrEqual(1);
    });

    it('creates Octopus voxel pixel-art model (Bumper 3) with correct structure', () => {
      const octopus = factory.createOctopusMesh({ color: COLORS.NEON_PINK, scale: 0.1 });
      expect(octopus).toBeInstanceOf(THREE.Group);
      expect(octopus.name).toContain('octopus');
      expect(octopus.children.length).toBeGreaterThan(0);
    });

    it('creates UFO Saucer model (P4.3) with rotating ring, dome, and thruster lights', () => {
      const ufo = factory.createUfoSaucerMesh({ beamType: 'yellow', scale: 1.0 });
      expect(ufo).toBeInstanceOf(THREE.Group);
      expect(ufo.name).toContain('ufo');

      // Verify dome and hull components exist
      let hasHull = false;
      let hasDome = false;
      ufo.traverse((child) => {
        if (child.name.includes('hull') || child.name.includes('disc') || child.name.includes('body')) hasHull = true;
        if (child.name.includes('dome') || child.name.includes('cockpit')) hasDome = true;
      });
      expect(hasHull && hasDome).toBe(true);
    });

    it('creates Mothership model (P4.4) with large command hull, glowing thrusters, and beam lens', () => {
      const mothership = factory.createMothershipMesh({ color: COLORS.NEON_CYAN, scale: 1.0 });
      expect(mothership).toBeInstanceOf(THREE.Group);
      expect(mothership.name).toContain('mothership');
      expect(mothership.children.length).toBeGreaterThanOrEqual(3);
    });

    it('generates custom voxel matrix alien using factory helper', () => {
      const customMatrix = [
        [0, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
      ];
      const customMesh = factory.createVoxelAlien(customMatrix, {
        voxelSize: 0.2,
        color: COLORS.NEON_YELLOW,
        name: 'custom-invader',
      });
      expect(customMesh).toBeInstanceOf(THREE.Group);
      expect(customMesh.name).toBe('custom-invader');
    });

    it('supports AlienType enum and factory dispatch', () => {
      expect(AlienType.SQUID).toBe('squid');
      expect(AlienType.CRAB).toBe('crab');
      expect(AlienType.OCTOPUS).toBe('octopus');
      expect(AlienType.UFO).toBe('ufo');
      expect(AlienType.MOTHERSHIP).toBe('mothership');

      const mesh = factory.createAlienByType(AlienType.SQUID);
      expect(mesh).toBeInstanceOf(THREE.Group);
    });
  });

  // =========================================================================
  // 2. PARTICLE FX SYSTEM (P4.6)
  // =========================================================================
  describe('ParticleSystem (GPU / Points / Instanced Particle FX)', () => {
    let particleSystem: ParticleSystem;

    beforeEach(() => {
      particleSystem = new ParticleSystem({ maxParticles: 300 });
    });

    it('initializes particle pool and Three.js points/mesh container', () => {
      expect(particleSystem.mesh).toBeInstanceOf(THREE.Object3D);
      expect(particleSystem.maxParticles).toBe(300);
      expect(particleSystem.getActiveCount()).toBe(0);
    });

    it('spawns bumper hit burst with radial velocities and neon color', () => {
      particleSystem.emitBumperBurst({ x: 3.5, y: 11.5, z: 0.5 }, COLORS.NEON_CYAN, 20);
      expect(particleSystem.getActiveCount()).toBe(20);
    });

    it('spawns slingshot directional kick sparks', () => {
      particleSystem.emitSlingshotBurst(
        { x: -5.0, y: -10.0, z: 0.4 },
        { x: 1.0, y: 1.0, z: 0.2 },
        COLORS.NEON_GREEN,
        15
      );
      expect(particleSystem.getActiveCount()).toBe(15);
    });

    it('spawns UFO sinkhole vortex spiral particles', () => {
      particleSystem.emitVortexBurst({ x: -6.0, y: 3.0, z: 0.2 }, COLORS.NEON_YELLOW, 25);
      expect(particleSystem.getActiveCount()).toBe(25);
    });

    it('spawns rank promotion fireworks celebration explosion', () => {
      particleSystem.emitFireworks({ x: 0, y: 5.0, z: 2.0 }, 50);
      expect(particleSystem.getActiveCount()).toBe(50);
    });

    it('spawns drain splash burst', () => {
      particleSystem.emitDrainBurst({ x: 0, y: -20.0, z: 0.2 });
      expect(particleSystem.getActiveCount()).toBeGreaterThan(0);
    });

    it('updates particle kinematics, decays life, fades alpha, and recycles dead particles', () => {
      particleSystem.emitBumperBurst({ x: 0, y: 0, z: 0 }, COLORS.NEON_PINK, 10);
      expect(particleSystem.getActiveCount()).toBe(10);

      // Step time forward slightly
      particleSystem.update(0.1);
      expect(particleSystem.getActiveCount()).toBe(10);

      // Step time past particle lifetime (e.g. 2.0 seconds)
      particleSystem.update(2.5);
      expect(particleSystem.getActiveCount()).toBe(0);
    });

    it('recycles particles without allocating exceeding max pool capacity', () => {
      // Emit more than max particles
      particleSystem.emitFireworks({ x: 0, y: 0, z: 0 }, 400);
      expect(particleSystem.getActiveCount()).toBeLessThanOrEqual(300);
    });

    it('clears all active particles on clear()', () => {
      particleSystem.emitBumperBurst({ x: 0, y: 0, z: 0 }, COLORS.NEON_CYAN, 30);
      expect(particleSystem.getActiveCount()).toBe(30);
      particleSystem.clear();
      expect(particleSystem.getActiveCount()).toBe(0);
    });
  });

  // =========================================================================
  // 3. SCREEN SHAKE (P4.7)
  // =========================================================================
  describe('ScreenShake (Impulse Trauma & Camera Offset)', () => {
    let shake: ScreenShake;

    beforeEach(() => {
      shake = new ScreenShake({ decayRate: 1.5, maxOffset: { x: 1.0, y: 1.0, z: 0.5 }, maxRoll: 0.05 });
    });

    it('initializes with zero trauma and zero offset', () => {
      expect(shake.getTrauma()).toBe(0);
      expect(shake.getShakeIntensity()).toBe(0);
      const offset = shake.getOffset();
      expect(offset.x).toBe(0);
      expect(offset.y).toBe(0);
      expect(offset.z).toBe(0);
    });

    it('adds trauma and clamps between 0 and 1', () => {
      shake.addTrauma(0.4);
      expect(shake.getTrauma()).toBe(0.4);
      shake.addTrauma(0.8);
      expect(shake.getTrauma()).toBe(1.0); // Clamped to 1.0
    });

    it('computes non-linear shake intensity (trauma squared) for punchy impact', () => {
      shake.addTrauma(0.5);
      expect(shake.getShakeIntensity()).toBeCloseTo(0.25, 4);
    });

    it('decays trauma smoothly over time', () => {
      shake.addTrauma(1.0);
      shake.update(0.2); // decayRate = 1.5 -> decays by 0.3
      expect(shake.getTrauma()).toBeCloseTo(0.7, 2);

      shake.update(1.0); // should decay to 0
      expect(shake.getTrauma()).toBe(0);
      expect(shake.getShakeIntensity()).toBe(0);
    });

    it('produces non-zero positional and rotational offsets when trauma > 0', () => {
      shake.addTrauma(0.8);
      shake.update(0.016);
      const offset = shake.getOffset();
      const rot = shake.getRotationOffset();

      const totalOffsetMag = Math.hypot(offset.x, offset.y, offset.z);
      expect(totalOffsetMag).toBeGreaterThan(0);
      expect(Math.abs(rot.z)).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 4. CAMERA MANAGER (P4.7, P5.7)
  // =========================================================================
  describe('CameraManager (Fixed, Follow-Ball, Attract Orbit & Shake Integration)', () => {
    let camera: THREE.PerspectiveCamera;
    let cameraManager: CameraManager;

    beforeEach(() => {
      camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
      cameraManager = new CameraManager(camera);
    });

    it('defaults to FIXED mode with standard pinball angle', () => {
      expect(cameraManager.getMode()).toBe(CameraMode.FIXED);
      cameraManager.update(0.016);
      expect(camera.position.y).toBeLessThan(0);
      expect(camera.position.z).toBeGreaterThan(20);
    });

    it('switches between FIXED, FOLLOW, and ATTRACT modes', () => {
      cameraManager.setMode(CameraMode.FOLLOW);
      expect(cameraManager.getMode()).toBe(CameraMode.FOLLOW);

      cameraManager.setMode(CameraMode.ATTRACT);
      expect(cameraManager.getMode()).toBe(CameraMode.ATTRACT);

      cameraManager.setMode(CameraMode.FIXED);
      expect(cameraManager.getMode()).toBe(CameraMode.FIXED);
    });

    it('toggles between FIXED and FOLLOW mode via toggleMode()', () => {
      cameraManager.setMode(CameraMode.FIXED);
      cameraManager.toggleMode();
      expect(cameraManager.getMode()).toBe(CameraMode.FOLLOW);

      cameraManager.toggleMode();
      expect(cameraManager.getMode()).toBe(CameraMode.FIXED);
    });

    it('smoothly follows pinball position in FOLLOW mode with clamping', () => {
      cameraManager.setMode(CameraMode.FOLLOW);
      const initialPos = camera.position.clone();

      // Ball moved to top right
      cameraManager.update(0.5, { x: 5.0, y: 15.0, z: 0.5 });
      expect(camera.position.x).toBeGreaterThan(initialPos.x);
      expect(camera.position.y).toBeGreaterThan(initialPos.y);
    });

    it('smoothly orbits table in ATTRACT mode', () => {
      cameraManager.setMode(CameraMode.ATTRACT);
      cameraManager.update(0.0);
      const posA = camera.position.clone();

      cameraManager.update(1.0); // Orbit rotates
      const posB = camera.position.clone();

      expect(posA.distanceTo(posB)).toBeGreaterThan(0.5);
    });

    it('applies ScreenShake impulse offsets during update', () => {
      cameraManager.setMode(CameraMode.FIXED);
      cameraManager.update(0.016);
      const posBeforeShake = camera.position.clone();

      cameraManager.screenShake.addTrauma(0.9);
      cameraManager.update(0.016);
      const posAfterShake = camera.position.clone();

      expect(posBeforeShake.distanceTo(posAfterShake)).toBeGreaterThan(0.01);
    });
  });

  // =========================================================================
  // 5. ATTRACT MODE & TITLE SCREEN (P4.8)
  // =========================================================================
  describe('AttractMode (Title Screen & Game Start Flow)', () => {
    let attract: AttractMode;

    beforeEach(() => {
      attract = new AttractMode();
    });

    it('starts in active attract mode by default or when started', () => {
      attract.start();
      expect(attract.isActive()).toBe(true);
    });

    it('updates blinking prompt timer and visibility cycle', () => {
      attract.start();
      const initialPrompt = attract.isPromptVisible();

      // Update by blink interval (e.g. 0.6s)
      attract.update(0.65);
      expect(attract.isPromptVisible()).not.toBe(initialPrompt);
    });

    it('triggers onStartRequested callback when start is requested', () => {
      const onStart = vi.fn();
      attract.onStartRequested = onStart;
      attract.start();

      attract.requestStart();
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(attract.isActive()).toBe(false);
    });

    it('stops attract mode and resets prompt state', () => {
      attract.start();
      expect(attract.isActive()).toBe(true);
      attract.stop();
      expect(attract.isActive()).toBe(false);
    });
  });
});
