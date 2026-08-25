import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TableScene } from '../src/rendering/scene';
import {
  createPlayfieldMaterial,
  createCabinetMaterial,
  createMetallicTrimMaterial,
  createNeonAccentMaterial,
} from '../src/rendering/materials';
import { TABLE, COLORS } from '../src/utils/constants';

describe('TableScene & Materials (P0.2)', () => {
  describe('PBR Materials', () => {
    it('creates playfield material with glossy dark surface and emissive properties', () => {
      const mat = createPlayfieldMaterial();
      expect(mat).toBeInstanceOf(THREE.Material);
      expect(mat.roughness).toBeLessThanOrEqual(0.3); // Glossy surface
      expect(mat.color.getHex()).toBe(COLORS.TABLE_SURFACE);
    });

    it('creates cabinet material with matte finish', () => {
      const mat = createCabinetMaterial();
      expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(mat.roughness).toBeGreaterThan(0.4);
      expect(mat.metalness).toBeLessThan(0.8);
    });

    it('creates metallic trim material with high metalness', () => {
      const mat = createMetallicTrimMaterial();
      expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(mat.metalness).toBeGreaterThanOrEqual(0.8);
      expect(mat.roughness).toBeLessThanOrEqual(0.3);
    });

    it('creates neon accent material with matching emissive color', () => {
      const mat = createNeonAccentMaterial(COLORS.NEON_GREEN);
      expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(mat.emissive.getHex()).toBe(COLORS.NEON_GREEN);
      expect(mat.emissiveIntensity).toBeGreaterThan(0);
    });
  });

  describe('TableScene Class', () => {
    it('initializes Three.js scene, camera, and basic hierarchy', () => {
      const tableScene = new TableScene(16 / 9);
      expect(tableScene.scene).toBeInstanceOf(THREE.Scene);
      expect(tableScene.camera).toBeInstanceOf(THREE.PerspectiveCamera);
      expect(tableScene.camera.aspect).toBeCloseTo(16 / 9, 2);
      expect(tableScene.camera.position.z).toBeGreaterThan(0);
      expect(tableScene.camera.position.y).toBeLessThan(0); // View from player end
    });

    it('creates playfield mesh matching TABLE dimensions', () => {
      const tableScene = new TableScene(1);
      expect(tableScene.playfieldMesh).toBeInstanceOf(THREE.Mesh);
      
      const geom = tableScene.playfieldMesh.geometry;
      geom.computeBoundingBox();
      const bbox = geom.boundingBox;
      expect(bbox).not.toBeNull();
      if (bbox) {
        const width = bbox.max.x - bbox.min.x;
        const length = bbox.max.y - bbox.min.y;
        expect(width).toBeCloseTo(TABLE.WIDTH, 1);
        expect(length).toBeCloseTo(TABLE.LENGTH, 1);
      }
    });

    it('creates cabinet boundary frame meshes containing the playfield', () => {
      const tableScene = new TableScene(1);
      expect(tableScene.cabinetGroup).toBeInstanceOf(THREE.Group);
      expect(tableScene.cabinetGroup.children.length).toBeGreaterThanOrEqual(4); // Left, Right, Top, Bottom walls

      // Verify cabinet is added to scene
      expect(tableScene.scene.children).toContain(tableScene.cabinetGroup);
      expect(tableScene.scene.children).toContain(tableScene.playfieldMesh);
    });

    it('configures ambient and spotlight lighting', () => {
      const tableScene = new TableScene(1);
      expect(tableScene.ambientLight).toBeInstanceOf(THREE.AmbientLight);
      expect(tableScene.spotLight).toBeInstanceOf(THREE.SpotLight);
      
      expect(tableScene.scene.children).toContain(tableScene.ambientLight);
      expect(tableScene.scene.children).toContain(tableScene.spotLight);
      expect(tableScene.spotLight.position.z).toBeGreaterThan(10);
    });

    it('handles aspect ratio resize properly', () => {
      const tableScene = new TableScene(1);
      tableScene.onResize(800, 600);
      expect(tableScene.camera.aspect).toBeCloseTo(800 / 600, 3);
    });
  });
});
