import * as THREE from 'three';
import { COLORS } from '../utils/constants';

/**
 * Generates a procedural CanvasTexture for the table playfield with neon grid & sci-fi markings.
 * Returns null if running in headless/Node environment.
 */
export function createPlayfieldGridTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Dark table base
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Subtle sci-fi grid
  const gridSize = 64;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.08)';

  for (let x = 0; x <= canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 3. Main accent grid lines & center line
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.2)';
  for (let x = 0; x <= canvas.width; x += gridSize * 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // 4. Plunger lane marking on the right (~8.8% of width from right)
  const plungerX = canvas.width - 120;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
  ctx.beginPath();
  ctx.moveTo(plungerX, 0);
  ctx.lineTo(plungerX, canvas.height - 200);
  ctx.stroke();

  // 5. Center table target / insignia circle
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.35)';
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height * 0.45, 140, 0, Math.PI * 2);
  ctx.stroke();

  // Outer border glow line
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0, 255, 102, 0.4)';
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * Table Playfield Material: Glossy dark surface with neon green grid and clearcoat.
 */
export function createPlayfieldMaterial(): THREE.MeshPhysicalMaterial {
  const gridTexture = createPlayfieldGridTexture();
  return new THREE.MeshPhysicalMaterial({
    color: COLORS.TABLE_SURFACE,
    roughness: 0.15,
    metalness: 0.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    map: gridTexture,
    emissive: 0x011408,
    emissiveIntensity: 0.2,
  });
}

/**
 * Cabinet Wall Material: Dark matte composite with subtle metallic sheen.
 */
export function createCabinetMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x141824,
    roughness: 0.65,
    metalness: 0.25,
  });
}

/**
 * Metallic Trim Material: High-reflectance chrome / wire rail trim.
 */
export function createMetallicTrimMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: COLORS.WIRE_RAIL,
    roughness: 0.18,
    metalness: 0.9,
  });
}

/**
 * Neon Accent Material: Self-illuminated emissive material for lanes, arrows, and borders.
 */
export function createNeonAccentMaterial(color: number = COLORS.NEON_GREEN): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.1,
  });
}
