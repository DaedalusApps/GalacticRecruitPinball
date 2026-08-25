import * as THREE from 'three';
import { TABLE, COLORS } from '../utils/constants';
import { TABLE_LAYOUT } from '../table/layout';
import {
  createPlayfieldMaterial,
  createCabinetMaterial,
  createMetallicTrimMaterial,
  createNeonAccentMaterial,
} from './materials';

export class TableScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public playfieldMesh: THREE.Mesh;
  public cabinetGroup: THREE.Group;
  public ambientLight: THREE.AmbientLight;
  public spotLight: THREE.SpotLight;
  public dirLight: THREE.DirectionalLight;
  public cameraTarget: THREE.Vector3;

  constructor(aspectRatio: number = 1) {
    // 1. Initialize Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.BG_DARK);

    // 2. Initialize Perspective Camera with standard pinball viewpoint
    this.camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 1000);
    this.camera.position.set(0, -32, 28);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.camera.lookAt(this.cameraTarget);

    // 3. Initialize Lighting
    this.ambientLight = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(this.ambientLight);

    this.spotLight = new THREE.SpotLight(0xffffff, 3.5);
    this.spotLight.position.set(0, -10, 30);
    this.spotLight.target.position.set(0, 0, 0);
    this.spotLight.angle = Math.PI / 3.5;
    this.spotLight.penumbra = 0.4;
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.width = 2048;
    this.spotLight.shadow.mapSize.height = 2048;
    this.spotLight.shadow.bias = -0.0005;
    this.scene.add(this.spotLight);
    this.scene.add(this.spotLight.target);

    this.dirLight = new THREE.DirectionalLight(0x88bbff, 1.0);
    this.dirLight.position.set(10, -20, 25);
    this.scene.add(this.dirLight);

    // 4. Create Table Playfield Plane
    const playfieldGeom = new THREE.PlaneGeometry(TABLE.WIDTH, TABLE.LENGTH);
    const playfieldMat = createPlayfieldMaterial();
    this.playfieldMesh = new THREE.Mesh(playfieldGeom, playfieldMat);
    this.playfieldMesh.position.set(0, 0, 0);
    this.playfieldMesh.receiveShadow = true;
    this.playfieldMesh.name = 'playfield';
    this.scene.add(this.playfieldMesh);

    // 5. Create Cabinet Boundary Frame Meshes
    this.cabinetGroup = this.createCabinetFrame();
    this.scene.add(this.cabinetGroup);
  }

  /**
   * Creates boundary walls and metallic trim around the playfield.
   */
  private createCabinetFrame(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cabinet';

    const cabinetMat = createCabinetMaterial();
    const trimMat = createMetallicTrimMaterial();
    const neonMat = createNeonAccentMaterial(COLORS.NEON_GREEN);

    const w = TABLE.WIDTH;
    const l = TABLE.LENGTH;
    const h = TABLE.WALL_HEIGHT;
    const t = TABLE.WALL_THICKNESS;
    const halfW = w / 2;
    const halfL = l / 2;
    const halfH = h / 2;

    // Helper for box meshes
    const addBox = (
      width: number,
      length: number,
      height: number,
      x: number,
      y: number,
      z: number,
      material: THREE.Material,
      name: string
    ): THREE.Mesh => {
      const geom = new THREE.BoxGeometry(width, length, height);
      const mesh = new THREE.Mesh(geom, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      group.add(mesh);
      return mesh;
    };

    // 1. Left boundary wall
    addBox(t, l, h, -halfW - t / 2, 0, halfH, cabinetMat, 'wall-left');
    // Left top trim (metallic rail)
    addBox(t * 0.5, l, 0.2, -halfW - t / 2, 0, h + 0.1, trimMat, 'trim-left');

    // 2. Right boundary wall
    addBox(t, l, h, halfW + t / 2, 0, halfH, cabinetMat, 'wall-right');
    // Right top trim
    addBox(t * 0.5, l, 0.2, halfW + t / 2, 0, h + 0.1, trimMat, 'trim-right');

    // 3. Top boundary wall (curved arch or back wall)
    addBox(w + 2 * t, t, h, 0, halfL + t / 2, halfH, cabinetMat, 'wall-top');
    addBox(w + 2 * t, t * 0.5, 0.2, 0, halfL + t / 2, h + 0.1, trimMat, 'trim-top');

    // 4. Bottom boundary wall (drain frame)
    addBox(w + 2 * t, t, h, 0, -halfL - t / 2, halfH, cabinetMat, 'wall-bottom');
    addBox(w + 2 * t, t * 0.5, 0.2, 0, -halfL - t / 2, h + 0.1, trimMat, 'trim-bottom');

    // 5. Plunger lane separator wall (separates plunger lane on right from main playfield)
    // Plunger lane width ~ 2.4 units; positioned around x = 7.6, running from bottom up to top curve
    const plungerWallX = halfW - 2.4;
    const plungerWallLen = l * 0.8;
    const plungerWallY = -halfL + plungerWallLen / 2;
    addBox(0.4, plungerWallLen, h * 0.7, plungerWallX, plungerWallY, (h * 0.7) / 2, cabinetMat, 'wall-plunger-lane');
    addBox(0.2, plungerWallLen, 0.15, plungerWallX, plungerWallY, h * 0.7 + 0.075, trimMat, 'trim-plunger-lane');

    // 6. Subtle neon border line along table edge
    const neonRailGeom = new THREE.BoxGeometry(0.1, l, 0.1);
    const neonLeftRail = new THREE.Mesh(neonRailGeom, neonMat);
    neonLeftRail.position.set(-halfW + 0.1, 0, 0.05);
    group.add(neonLeftRail);

    const neonRightRail = new THREE.Mesh(neonRailGeom, neonMat);
    neonRightRail.position.set(halfW - 0.1, 0, 0.05);
    group.add(neonRightRail);

    // 7. Re-entry Lane Dividers (upper right area)
    for (let i = 0; i < TABLE_LAYOUT.LANE_DIVIDERS.length; i++) {
      const d = TABLE_LAYOUT.LANE_DIVIDERS[i];
      addBox(d.width, d.length, d.height, d.position.x, d.position.y, d.position.z, cabinetMat, `lane-divider-${i}`);
      addBox(d.width * 0.5, d.length, 0.1, d.position.x, d.position.y, d.position.z + d.height / 2 + 0.05, trimMat, `lane-divider-trim-${i}`);
    }

    // 8. Inlane / Outlane Guides
    for (let i = 0; i < TABLE_LAYOUT.INLANE_OUTLANE_GUIDES.length; i++) {
      const g = TABLE_LAYOUT.INLANE_OUTLANE_GUIDES[i];
      addBox(g.width, g.length, g.height, g.position.x, g.position.y, g.position.z, cabinetMat, `inlane-guide-${i}`);
      addBox(g.width * 0.5, g.length, 0.1, g.position.x, g.position.y, g.position.z + g.height / 2 + 0.05, trimMat, `inlane-guide-trim-${i}`);
    }

    return group;
  }

  /**
   * Updates camera aspect ratio on window resize.
   */
  public onResize(width: number, height: number): void {
    if (height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Per-frame scene update hook for dynamic animations/effects.
   */
  public update(_deltaSec: number): void {
    // Dynamic lighting or effects can be animated here
  }
}
