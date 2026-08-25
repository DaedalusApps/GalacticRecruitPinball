import * as THREE from 'three';
import { COLORS } from '../utils/constants';
import { createMetallicTrimMaterial, createNeonAccentMaterial } from './materials';

export enum AlienType {
  SQUID = 'squid',
  CRAB = 'crab',
  OCTOPUS = 'octopus',
  UFO = 'ufo',
  MOTHERSHIP = 'mothership',
}

export interface VoxelAlienOptions {
  voxelSize?: number;
  depth?: number;
  color?: number;
  emissiveIntensity?: number;
  name?: string;
  scale?: number;
}

export interface UfoMeshOptions {
  scale?: number;
  color?: number;
  beamType?: 'yellow' | 'red' | 'green' | string;
  emissiveIntensity?: number;
}

export interface MothershipMeshOptions {
  scale?: number;
  color?: number;
  emissiveIntensity?: number;
}

// 0: empty, 1: body pixel, 2: emissive eye pixel
export const ALIEN_BITMAPS = {
  SQUID: [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 2, 1, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 1, 0, 1],
  ],
  CRAB: [
    [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 2, 1, 1, 1, 2, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
    [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
  ],
  OCTOPUS: [
    [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 2, 0, 1, 1, 0, 2, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  ],
  UFO_SAUCER: [
    [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  ],
};

export class AlienModelFactory {
  /**
   * Generates a 3D voxel pixel-art mesh from a 2D binary/indexed bitmap matrix.
   */
  public createVoxelAlien(matrix: number[][], options: VoxelAlienOptions = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = options.name ?? 'voxel-alien';

    const voxelSize = options.voxelSize ?? 0.12;
    const depth = options.depth ?? voxelSize * 1.5;
    const baseColor = options.color ?? COLORS.NEON_CYAN;
    const emissiveIntensity = options.emissiveIntensity ?? 1.2;

    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: emissiveIntensity * 0.8,
      metalness: 0.5,
      roughness: 0.25,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
      metalness: 0.1,
      roughness: 0.1,
    });

    const boxGeom = new THREE.BoxGeometry(voxelSize * 0.95, voxelSize * 0.95, depth);

    // Center the voxel model
    const halfWidth = (cols * voxelSize) / 2;
    const halfHeight = (rows * voxelSize) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = matrix[r][c];
        if (val === 0) continue;

        const mat = val === 2 ? eyeMat : bodyMat;
        const voxel = new THREE.Mesh(boxGeom, mat);

        const x = c * voxelSize - halfWidth + voxelSize / 2;
        const y = (rows - 1 - r) * voxelSize - halfHeight + voxelSize / 2;
        const z = depth / 2;

        voxel.position.set(x, y, z);
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        voxel.name = val === 2 ? 'voxel-eye' : 'voxel-body';
        group.add(voxel);
      }
    }

    if (options.scale) {
      group.scale.setScalar(options.scale);
    }

    return group;
  }

  /**
   * Generates Squid Alien 3D model (Bumper 1)
   */
  public createSquidMesh(options: VoxelAlienOptions = {}): THREE.Group {
    const opts: VoxelAlienOptions = {
      voxelSize: options.voxelSize ?? 0.1,
      color: options.color ?? COLORS.NEON_CYAN,
      emissiveIntensity: options.emissiveIntensity ?? 1.2,
      name: options.name ?? 'alien-squid',
      scale: options.scale ?? 1.0,
    };
    return this.createVoxelAlien(ALIEN_BITMAPS.SQUID, opts);
  }

  /**
   * Generates Crab Alien 3D model (Bumper 2)
   */
  public createCrabMesh(options: VoxelAlienOptions = {}): THREE.Group {
    const opts: VoxelAlienOptions = {
      voxelSize: options.voxelSize ?? 0.08,
      color: options.color ?? COLORS.NEON_GREEN,
      emissiveIntensity: options.emissiveIntensity ?? 1.2,
      name: options.name ?? 'alien-crab',
      scale: options.scale ?? 1.0,
    };
    return this.createVoxelAlien(ALIEN_BITMAPS.CRAB, opts);
  }

  /**
   * Generates Octopus Alien 3D model (Bumper 3)
   */
  public createOctopusMesh(options: VoxelAlienOptions = {}): THREE.Group {
    const opts: VoxelAlienOptions = {
      voxelSize: options.voxelSize ?? 0.075,
      color: options.color ?? COLORS.NEON_PINK,
      emissiveIntensity: options.emissiveIntensity ?? 1.2,
      name: options.name ?? 'alien-octopus',
      scale: options.scale ?? 1.0,
    };
    return this.createVoxelAlien(ALIEN_BITMAPS.OCTOPUS, opts);
  }

  /**
   * Generates UFO Saucer 3D model with rotating rim, command dome, and thruster lights (P4.3)
   */
  public createUfoSaucerMesh(options: UfoMeshOptions = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = `ufo-saucer-${options.beamType ?? 'default'}`;

    const color =
      options.color ??
      (options.beamType === 'yellow'
        ? COLORS.NEON_YELLOW
        : options.beamType === 'green'
          ? COLORS.NEON_GREEN
          : COLORS.NEON_PINK);

    const metallicMat = createMetallicTrimMaterial();
    const neonMat = createNeonAccentMaterial(color);
    const hullMat = new THREE.MeshPhysicalMaterial({
      color: 0x1f2430,
      metalness: 0.85,
      roughness: 0.25,
      clearcoat: 0.6,
    });

    // 1. Saucer Body Disc (Hull)
    const hullGeom = new THREE.CylinderGeometry(0.5, 0.9, 0.22, 24);
    hullGeom.rotateX(Math.PI / 2);
    const hullMesh = new THREE.Mesh(hullGeom, hullMat);
    hullMesh.name = 'ufo-hull';
    hullMesh.castShadow = true;
    group.add(hullMesh);

    // 2. Metallic Outer Torus Rim
    const rimGeom = new THREE.TorusGeometry(0.9, 0.06, 12, 24);
    const rimMesh = new THREE.Mesh(rimGeom, metallicMat);
    rimMesh.name = 'ufo-rim';
    group.add(rimMesh);

    // 3. Top Glowing Cockpit Dome
    const domeGeom = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeom.rotateX(Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeom, neonMat);
    domeMesh.position.set(0, 0, 0.11);
    domeMesh.name = 'ufo-dome';
    group.add(domeMesh);

    // 4. Perimeter Indicator Lights (4 glow pods)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const podGeom = new THREE.SphereGeometry(0.06, 8, 8);
      const podMesh = new THREE.Mesh(podGeom, neonMat);
      podMesh.position.set(Math.cos(angle) * 0.78, Math.sin(angle) * 0.78, 0);
      podMesh.name = `ufo-pod-${i}`;
      group.add(podMesh);
    }

    if (options.scale) {
      group.scale.setScalar(options.scale);
    }

    return group;
  }

  /**
   * Generates Mothership 3D model (P4.4)
   */
  public createMothershipMesh(options: MothershipMeshOptions = {}): THREE.Group {
    const group = new THREE.Group();
    group.name = 'mothership-ufo-body';

    const color = options.color ?? COLORS.NEON_CYAN;
    const metallicMat = createMetallicTrimMaterial();
    const neonMat = createNeonAccentMaterial(color);
    const darkHullMat = new THREE.MeshPhysicalMaterial({
      color: 0x141a26,
      metalness: 0.9,
      roughness: 0.2,
      clearcoat: 0.8,
    });

    // (a) Main saucer disc hull
    const saucerGeom = new THREE.CylinderGeometry(1.6, 2.4, 0.45, 32);
    saucerGeom.rotateX(Math.PI / 2);
    const saucerMesh = new THREE.Mesh(saucerGeom, darkHullMat);
    saucerMesh.name = 'mothership-hull';
    saucerMesh.castShadow = true;
    group.add(saucerMesh);

    // (b) Metallic outer rim flange
    const rimGeom = new THREE.TorusGeometry(2.4, 0.1, 16, 32);
    const rimMesh = new THREE.Mesh(rimGeom, metallicMat);
    rimMesh.name = 'mothership-rim';
    group.add(rimMesh);

    // (c) Top cockpit command dome
    const domeGeom = new THREE.SphereGeometry(0.9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    domeGeom.rotateX(Math.PI / 2);
    const domeMesh = new THREE.Mesh(domeGeom, neonMat);
    domeMesh.position.set(0, 0, 0.22);
    domeMesh.name = 'mothership-dome';
    group.add(domeMesh);

    // (d) Bottom tractor beam emitter lens
    const emitterGeom = new THREE.CylinderGeometry(0.8, 0.5, 0.2, 24);
    emitterGeom.rotateX(Math.PI / 2);
    const emitterMesh = new THREE.Mesh(emitterGeom, neonMat);
    emitterMesh.position.set(0, 0, -0.25);
    emitterMesh.name = 'mothership-emitter';
    group.add(emitterMesh);

    // (e) Perimeter thruster indicator lights (8 surrounding lights)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const thrusterGeom = new THREE.SphereGeometry(0.12, 8, 8);
      const thrusterMesh = new THREE.Mesh(thrusterGeom, neonMat);
      thrusterMesh.position.set(Math.cos(angle) * 2.1, Math.sin(angle) * 2.1, 0);
      thrusterMesh.name = `mothership-thruster-${i}`;
      group.add(thrusterMesh);
    }

    if (options.scale) {
      group.scale.setScalar(options.scale);
    }

    return group;
  }

  /**
   * Helper to dispatch creation by AlienType
   */
  public createAlienByType(type: AlienType, options: VoxelAlienOptions = {}): THREE.Group {
    switch (type) {
      case AlienType.SQUID:
        return this.createSquidMesh(options);
      case AlienType.CRAB:
        return this.createCrabMesh(options);
      case AlienType.OCTOPUS:
        return this.createOctopusMesh(options);
      case AlienType.UFO:
        return this.createUfoSaucerMesh(options);
      case AlienType.MOTHERSHIP:
        return this.createMothershipMesh(options);
      default:
        return this.createSquidMesh(options);
    }
  }
}
